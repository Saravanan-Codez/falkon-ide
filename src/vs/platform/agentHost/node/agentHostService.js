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
import { Queue } from "../../../base/common/async.js";
import { Event } from "../../../base/common/event.js";
import { Disposable, MutableDisposable } from "../../../base/common/lifecycle.js";
import { ILogService, ILoggerService } from "../../log/common/log.js";
import { RemoteLoggerChannelClient } from "../../log/common/logIpc.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { reportAgentHostProcessError } from "../common/agentHostProcessTelemetry.js";
import { AgentHostLaunchKind } from "../common/agentHostTelemetry.js";
import { AgentHostIpcChannels } from "../common/agentService.js";
var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2[Constants2["MaxRestarts"] = 5] = "MaxRestarts";
  return Constants2;
})(Constants || {});
const WINDOWS_EXPECTED_SHUTDOWN_EXIT_CODES = /* @__PURE__ */ new Set([
  3221226091,
  // STATUS_DLL_INIT_FAILED_LOGOFF
  1073807364
  // DBG_TERMINATE_PROCESS
]);
function isExpectedWindowsShutdownExit(platform, code) {
  return platform === "win32" && WINDOWS_EXPECTED_SHUTDOWN_EXIT_CODES.has(code >>> 0);
}
let AgentHostProcessManager = class extends Disposable {
  constructor(_starter, _platform = process.platform, _logService, _loggerService, _telemetryService) {
    super();
    this._starter = _starter;
    this._platform = _platform;
    this._logService = _logService;
    this._loggerService = _loggerService;
    this._telemetryService = _telemetryService;
    this._started = false;
    this._wasQuitRequested = false;
    this._restartCount = 0;
    this._lifecycleQueue = this._register(new Queue());
    this._connection = this._register(new MutableDisposable());
    this._register(this._starter);
    if (this._starter.onRequestConnection) {
      this._register(Event.once(this._starter.onRequestConnection)(() => this._ensureStarted()));
    }
    if (this._starter.onRequestRestart) {
      this._register(this._starter.onRequestRestart(() => void this.restart()));
    }
    if (this._starter.onWillShutdown) {
      this._register(this._starter.onWillShutdown(() => this._wasQuitRequested = true));
    }
  }
  _ensureStarted() {
    void this._lifecycleQueue.queue(() => this._start());
  }
  restart() {
    return this._lifecycleQueue.queue(async () => {
      this._logService.info("AgentHostProcessManager: explicitly restarting agent host");
      this._connection.clear();
      this._started = false;
      this._restartCount = 0;
      await this._start();
    });
  }
  async _start() {
    if (this._started) {
      return;
    }
    this._started = true;
    try {
      const connection = await this._starter.start();
      if (this._store.isDisposed) {
        connection.store.dispose();
        return;
      }
      this._logService.info("AgentHostProcessManager: agent host started");
      connection.store.add(new RemoteLoggerChannelClient(this._loggerService, connection.client.getChannel(AgentHostIpcChannels.Logger)));
      connection.store.add(connection.onDidProcessExit((e) => {
        if (this._wasQuitRequested || this._store.isDisposed) {
          return;
        }
        if (isExpectedWindowsShutdownExit(this._platform, e.code)) {
          this._logService.info(`AgentHostProcessManager: agent host terminated during Windows shutdown with code ${e.code}`);
          if (this._connection.value === connection.store) {
            this._connection.clear();
          }
          return;
        }
        const willRestart = this._restartCount < 5 /* MaxRestarts */;
        reportAgentHostProcessError(this._telemetryService, {
          hostLaunchKind: AgentHostLaunchKind.VSCodeMainProcess,
          kind: "unexpectedExit",
          code: e.code,
          restartCount: this._restartCount,
          willRestart
        });
        if (this._connection.value === connection.store) {
          this._connection.clear();
        }
        if (willRestart) {
          this._logService.error(`AgentHostProcessManager: agent host terminated unexpectedly with code ${e.code}`);
          this._restartCount++;
          this._started = false;
          this._ensureStarted();
        } else {
          this._logService.error(`AgentHostProcessManager: agent host terminated with code ${e.code}, giving up after ${5 /* MaxRestarts */} restarts`);
        }
      }));
      this._connection.value = connection.store;
    } catch (error) {
      this._started = false;
      this._logService.error("AgentHostProcessManager: failed to start agent host", error);
      reportAgentHostProcessError(this._telemetryService, {
        hostLaunchKind: AgentHostLaunchKind.VSCodeMainProcess,
        kind: "startFailed",
        restartCount: this._restartCount,
        willRestart: false
      }, error);
    }
  }
};
AgentHostProcessManager = __decorateClass([
  __decorateParam(2, ILogService),
  __decorateParam(3, ILoggerService),
  __decorateParam(4, ITelemetryService)
], AgentHostProcessManager);
export {
  AgentHostProcessManager
};
