var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { Disposable, MutableDisposable, toDisposable } from "../../base/common/lifecycle.js";
import { ProxyChannel } from "../../base/parts/ipc/common/ipc.js";
import { reportAgentHostProcessError } from "../../platform/agentHost/common/agentHostProcessTelemetry.js";
import { AgentHostLaunchKind } from "../../platform/agentHost/common/agentHostTelemetry.js";
import { AgentHostIpcChannels } from "../../platform/agentHost/common/agentService.js";
import { createDecorator } from "../../platform/instantiation/common/instantiation.js";
import { ILogService, ILoggerService } from "../../platform/log/common/log.js";
import { RemoteLoggerChannelClient } from "../../platform/log/common/logIpc.js";
import { ITelemetryService } from "../../platform/telemetry/common/telemetry.js";
import { IServerLifetimeService } from "./serverLifetimeService.js";
const IServerAgentHostManager = createDecorator("serverAgentHostManager");
var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2[Constants2["MaxRestarts"] = 5] = "MaxRestarts";
  return Constants2;
})(Constants || {});
let ServerAgentHostManager = class extends Disposable {
  constructor(_starter, options = {}, _logService, _loggerService, _serverLifetimeService, _telemetryService) {
    super();
    this._starter = _starter;
    this._logService = _logService;
    this._loggerService = _loggerService;
    this._serverLifetimeService = _serverLifetimeService;
    this._telemetryService = _telemetryService;
    this._restartCount = 0;
    /** Lifetime token held while sessions are active or standalone WebSocket clients are connected. */
    this._lifetimeToken = this._register(new MutableDisposable());
    this._hasActiveSessions = false;
    this._connectionCount = 0;
    this._register(this._starter);
    if (options.startMode !== "lazy") {
      void this.ensureStarted().catch(() => void 0);
    }
  }
  ensureStarted() {
    if (!this._startPromise) {
      const startPromise = this._start();
      this._startPromise = startPromise;
      void startPromise.catch(() => {
        if (this._startPromise === startPromise) {
          this._startPromise = void 0;
        }
      });
    }
    return this._startPromise;
  }
  /**
   * Retries startup in-place until it succeeds or the crash-retry budget is
   * exhausted, so the caller's `ensureStarted()` stays pending across
   * automatic retries instead of rejecting while a retry is still in flight.
   * A rejection here therefore means "no agent host, and we stopped trying".
   */
  async _start() {
    while (true) {
      try {
        await this._startOnce();
        return;
      } catch (error) {
        if (this._store.isDisposed) {
          return;
        }
        const willRestart = this._restartCount <= 5 /* MaxRestarts */;
        reportAgentHostProcessError(this._telemetryService, {
          hostLaunchKind: AgentHostLaunchKind.VSCodeCLI,
          kind: "startFailed",
          restartCount: this._restartCount,
          willRestart
        }, error);
        if (!willRestart) {
          this._logService.error(`ServerAgentHostManager: agent host failed to start, giving up after ${5 /* MaxRestarts */} restarts`, error);
          this._restartCount = 0;
          throw error;
        }
        this._logService.error("ServerAgentHostManager: agent host failed to start", error);
        this._restartCount++;
      }
    }
  }
  async _startOnce() {
    const connection = await this._starter.start();
    if (this._store.isDisposed) {
      connection.store.dispose();
      return;
    }
    this._trackActiveSessions(connection);
    try {
      await this._trackClientConnections(connection);
    } catch (error) {
      connection.store.dispose();
      throw error;
    }
    if (this._store.isDisposed || connection.store.isDisposed) {
      connection.store.dispose();
      return;
    }
    this._logService.info("ServerAgentHostManager: agent host started");
    connection.store.add(new RemoteLoggerChannelClient(this._loggerService, connection.client.getChannel(AgentHostIpcChannels.Logger)));
    connection.store.add(connection.onDidProcessExit((e) => this._handleUnexpectedExit(connection, e)));
    this._register(toDisposable(() => connection.store.dispose()));
  }
  _handleUnexpectedExit(connection, e) {
    if (this._store.isDisposed) {
      return;
    }
    this._hasActiveSessions = false;
    this._connectionCount = 0;
    this._lifetimeToken.clear();
    const willRestart = this._restartCount <= 5 /* MaxRestarts */;
    reportAgentHostProcessError(this._telemetryService, {
      hostLaunchKind: AgentHostLaunchKind.VSCodeCLI,
      kind: "unexpectedExit",
      code: e.code,
      restartCount: this._restartCount,
      willRestart
    });
    connection.store.dispose();
    this._startPromise = void 0;
    if (willRestart) {
      this._logService.error(`ServerAgentHostManager: agent host terminated unexpectedly with code ${e.code}`);
      this._restartCount++;
      void this.ensureStarted().catch(() => void 0);
    } else {
      this._logService.error(`ServerAgentHostManager: agent host terminated with code ${e.code}, giving up after ${5 /* MaxRestarts */} restarts`);
      this._restartCount = 0;
    }
  }
  _trackActiveSessions(connection) {
    const agentService = ProxyChannel.toService(connection.client.getChannel(AgentHostIpcChannels.AgentHost));
    connection.store.add(agentService.onDidAction((envelope) => {
      if (envelope.action.type === "root/activeSessionsChanged") {
        this._hasActiveSessions = envelope.action.activeSessions > 0;
        this._updateLifetimeToken();
      }
    }));
  }
  async _trackClientConnections(connection) {
    const connectionTracker = ProxyChannel.toService(connection.client.getChannel(AgentHostIpcChannels.ConnectionTracker));
    connection.store.add(connectionTracker.onDidChangeConnectionCount((count) => {
      this._connectionCount = count;
      this._updateLifetimeToken();
    }));
    await connectionTracker.waitForConfiguredWebSocketServer();
  }
  _updateLifetimeToken() {
    if (this._hasActiveSessions || this._connectionCount > 0) {
      this._lifetimeToken.value ??= this._serverLifetimeService.active("AgentHost");
    } else {
      this._lifetimeToken.clear();
    }
  }
};
ServerAgentHostManager = __decorateClass([
  __decorateParam(2, ILogService),
  __decorateParam(3, ILoggerService),
  __decorateParam(4, IServerLifetimeService),
  __decorateParam(5, ITelemetryService)
], ServerAgentHostManager);
export {
  IServerAgentHostManager,
  ServerAgentHostManager
};
