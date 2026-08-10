import { Barrier } from "../../../../base/common/async.js";
import { Emitter } from "../../../../base/common/event.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { ProcessPropertyType } from "../../../../platform/terminal/common/terminal.js";
import { AGENT_HOST_SCHEME, fromAgentHostUri } from "../../../../platform/agentHost/common/agentHostUri.js";
import { ActionType } from "../../../../platform/agentHost/common/state/sessionActions.js";
import { TerminalClaimKind } from "../../../../platform/agentHost/common/state/protocol/state.js";
import { StateComponents } from "../../../../platform/agentHost/common/state/sessionState.js";
import { BasePty } from "../common/basePty.js";
var AhpCommandMarkKind = /* @__PURE__ */ ((AhpCommandMarkKind2) => {
  AhpCommandMarkKind2["Executed"] = "s";
  AhpCommandMarkKind2["End"] = "e";
  return AhpCommandMarkKind2;
})(AhpCommandMarkKind || {});
function getAhpCommandMarkId(commandId, kind) {
  return `ahp-${commandId}-${kind}`;
}
function getAhpCommandMarkCode(commandId, kind) {
  return `\x1B]633;SetMark;Id=${getAhpCommandMarkId(commandId, kind)};Hidden\x07`;
}
const COPILOT_SENTINEL_PREFIX = "<<<COPILOT_SENTINEL_";
function isCopilotSentinelCommand(commandLine) {
  return commandLine.includes(COPILOT_SENTINEL_PREFIX);
}
class AgentHostPty extends BasePty {
  constructor(id, _connection, _terminalUri, _options) {
    super(
      id,
      /* shouldPersist */
      false
    );
    this._connection = _connection;
    this._terminalUri = _terminalUri;
    this._options = _options;
    this._startBarrier = new Barrier();
    this._subscriptionDisposables = this._register(new DisposableStore());
    this._initialCwd = "";
    this._onCommandExecuted = this._register(new Emitter());
    this.onCommandExecuted = this._onCommandExecuted.event;
    this._onCommandFinished = this._register(new Emitter());
    this.onCommandFinished = this._onCommandFinished.event;
    this._onSupportsCommandDetection = this._register(new Emitter());
    this.onSupportsCommandDetection = this._onSupportsCommandDetection.event;
    this._supportsCommandDetection = false;
    /**
     * Command IDs for sentinel commands that should be suppressed from shell
     * integration events. When the copilot shell tools fall back to sentinel-
     * based exit code detection, shell integration may also detect the sentinel
     * echo as a real command — we filter those out here.
     */
    this._suppressedCommandIds = /* @__PURE__ */ new Set();
  }
  get supportsCommandDetection() {
    return this._supportsCommandDetection;
  }
  async start() {
    try {
      if (!this._options?.attachOnly) {
        await this._connection.createTerminal({
          channel: this._terminalUri.toString(),
          claim: { kind: TerminalClaimKind.Client, clientId: this._connection.clientId },
          name: this._options?.name,
          cwd: this._resolveCwdForProtocol(this._options?.cwd),
          cols: this._lastDimensions.cols > 0 ? this._lastDimensions.cols : void 0,
          rows: this._lastDimensions.rows > 0 ? this._lastDimensions.rows : void 0
        });
      }
      this._subscriptionRef = this._connection.getSubscription(StateComponents.Terminal, this._terminalUri, "AgentHostPty");
      const subscription = this._subscriptionRef.object;
      if (subscription.value === void 0) {
        await new Promise((resolve) => {
          const listener = subscription.onDidChange(() => {
            listener.dispose();
            resolve();
          });
          this._subscriptionDisposables.add(listener);
        });
      }
      const state = subscription.value;
      if (state.supportsCommandDetection) {
        this._supportsCommandDetection = true;
        this._onSupportsCommandDetection.fire();
      }
      this._replayContent(state.content);
      this._initialCwd = state.cwd?.toString() ?? "";
      this._properties.cwd = this._initialCwd;
      this._properties.initialCwd = this._initialCwd;
      if (state.title) {
        this._properties.title = state.title;
      }
      this._subscriptionDisposables.add(subscription.onDidApplyAction((envelope) => {
        this._handleAction(envelope);
      }));
      this._startBarrier.open();
      this.handleReady({ pid: -1, cwd: this._initialCwd, windowsPty: void 0 });
      return void 0;
    } catch (err) {
      this._startBarrier.open();
      return { message: err instanceof Error ? err.message : String(err) };
    }
  }
  _handleAction(envelope) {
    const action = envelope.action;
    switch (action.type) {
      case ActionType.TerminalData:
        this.handleData(action.data);
        break;
      case ActionType.TerminalExited:
        this.handleExit(action.exitCode);
        break;
      case ActionType.TerminalCwdChanged:
        this._properties.cwd = action.cwd.toString();
        this.handleDidChangeProperty({ type: ProcessPropertyType.Cwd, value: action.cwd.toString() });
        break;
      case ActionType.TerminalTitleChanged:
        this._properties.title = action.title;
        this.handleDidChangeProperty({ type: ProcessPropertyType.Title, value: action.title });
        break;
      case ActionType.TerminalResized:
        if (envelope.origin?.clientId !== this._connection.clientId) {
          this.handleDidChangeProperty({
            type: ProcessPropertyType.OverrideDimensions,
            value: { cols: action.cols, rows: action.rows }
          });
        }
        break;
      case ActionType.TerminalCommandDetectionAvailable:
        if (!this._supportsCommandDetection) {
          this._supportsCommandDetection = true;
          this._onSupportsCommandDetection.fire();
        }
        break;
      case ActionType.TerminalCommandExecuted:
        if (isCopilotSentinelCommand(action.commandLine)) {
          this._suppressedCommandIds.add(action.commandId);
          break;
        }
        this.handleData(getAhpCommandMarkCode(action.commandId, "s" /* Executed */));
        this._onCommandExecuted.fire({
          commandId: action.commandId,
          commandLine: action.commandLine,
          timestamp: action.timestamp
        });
        break;
      case ActionType.TerminalCommandFinished:
        if (this._suppressedCommandIds.delete(action.commandId)) {
          break;
        }
        this.handleData(getAhpCommandMarkCode(action.commandId, "e" /* End */));
        this._onCommandFinished.fire({
          commandId: action.commandId,
          exitCode: action.exitCode,
          durationMs: action.durationMs
        });
        break;
    }
  }
  /**
   * Replays structured terminal content parts from the initial state snapshot.
   * Emits command lifecycle events for command parts so that consumers
   * (e.g. {@link AhpTerminalCommandSource}) can reconstruct command history.
   */
  _replayContent(content) {
    for (const part of content) {
      if (part.type === "unclassified") {
        if (part.value) {
          this.handleData(part.value);
        }
      } else if (part.type === "command") {
        if (isCopilotSentinelCommand(part.commandLine)) {
          continue;
        }
        this.handleData(getAhpCommandMarkCode(part.commandId, "s" /* Executed */));
        this._onCommandExecuted.fire({
          commandId: part.commandId,
          commandLine: part.commandLine,
          timestamp: part.timestamp,
          storedOutput: part.output
        });
        if (part.output) {
          this.handleData(part.output);
        }
        if (part.isComplete) {
          this.handleData(getAhpCommandMarkCode(part.commandId, "e" /* End */));
          this._onCommandFinished.fire({
            commandId: part.commandId,
            exitCode: part.exitCode,
            durationMs: part.durationMs
          });
        }
      }
    }
  }
  /**
   * Resolves a cwd URI for sending over the protocol. Agent-host URIs
   * are unwrapped to their original URI via {@link fromAgentHostUri}.
   */
  _resolveCwdForProtocol(cwd) {
    if (!cwd) {
      return void 0;
    }
    if (cwd.scheme === AGENT_HOST_SCHEME) {
      return fromAgentHostUri(cwd).toString();
    }
    return cwd.toString();
  }
  input(data) {
    if (this._inReplay) {
      return;
    }
    this._startBarrier.wait().then(() => {
      this._connection.dispatch(
        this._terminalUri.toString(),
        { type: ActionType.TerminalInput, data }
      );
    });
  }
  resize(cols, rows) {
    if (this._inReplay || this._lastDimensions.cols === cols && this._lastDimensions.rows === rows) {
      return;
    }
    this._lastDimensions.cols = cols;
    this._lastDimensions.rows = rows;
    this._startBarrier.wait().then(() => {
      this._connection.dispatch(
        this._terminalUri.toString(),
        { type: ActionType.TerminalResized, cols, rows }
      );
    });
  }
  shutdown(_immediate) {
    this._startBarrier.wait().then(() => {
      if (!this._options?.attachOnly) {
        this._connection.disposeTerminal(this._terminalUri);
      }
      this._subscriptionRef?.dispose();
      this._subscriptionRef = void 0;
      this._subscriptionDisposables.clear();
      this.handleExit(void 0);
    });
  }
  async getInitialCwd() {
    return this._initialCwd;
  }
  async getCwd() {
    return this._properties.cwd || this._initialCwd;
  }
  async clearBuffer() {
    this._connection.dispatch(
      this._terminalUri.toString(),
      { type: ActionType.TerminalCleared }
    );
  }
  acknowledgeDataEvent(_charCount) {
  }
  async setUnicodeVersion(_version) {
  }
  processBinary(_data) {
    return Promise.resolve();
  }
  sendSignal(_signal) {
  }
  async refreshProperty(type) {
    return this._properties[type];
  }
  async updateProperty(_type, _value) {
  }
  /**
   * Reconnect this pty to a new agent host connection. Tears down the
   * old subscription and re-subscribes with the new connection, replaying
   * content from the server-side snapshot. Terminal output during the
   * disconnect gap is a stream (not state), so some loss is expected.
   *
   * @returns `true` if reconnection succeeded, `false` otherwise.
   */
  async reconnect(newConnection) {
    this._subscriptionDisposables.clear();
    this._subscriptionRef?.dispose();
    this._subscriptionRef = void 0;
    this._connection = newConnection;
    try {
      this._subscriptionRef = this._connection.getSubscription(StateComponents.Terminal, this._terminalUri, "AgentHostPty");
      const subscription = this._subscriptionRef.object;
      if (subscription.value === void 0) {
        const RECONNECT_HYDRATE_TIMEOUT_MS = 1e4;
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            listener.dispose();
            reject(new Error("Reconnect hydration timed out"));
          }, RECONNECT_HYDRATE_TIMEOUT_MS);
          const listener = subscription.onDidChange(() => {
            clearTimeout(timer);
            listener.dispose();
            resolve();
          });
          this._subscriptionDisposables.add(listener);
        });
      }
      const state = subscription.value;
      if (state.supportsCommandDetection && !this._supportsCommandDetection) {
        this._supportsCommandDetection = true;
        this._onSupportsCommandDetection.fire();
      }
      this.handleData("\x1B[2J\x1B[3J\x1B[H");
      this._replayContent(state.content);
      if (state.cwd) {
        this._properties.cwd = state.cwd.toString();
      }
      if (state.title) {
        this._properties.title = state.title;
      }
      this._subscriptionDisposables.add(subscription.onDidApplyAction((envelope) => {
        this._handleAction(envelope);
      }));
      return true;
    } catch (err) {
      console.warn("[AgentHostPty] Reconnection failed:", err instanceof Error ? err.message : String(err));
      return false;
    }
  }
  /** The terminal URI this pty is subscribed to. */
  get terminalUri() {
    return this._terminalUri;
  }
  dispose() {
    this._subscriptionRef?.dispose();
    this._subscriptionRef = void 0;
    super.dispose();
  }
}
export {
  AgentHostPty,
  AhpCommandMarkKind,
  getAhpCommandMarkId
};
