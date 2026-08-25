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
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { URI } from "../../../../../base/common/uri.js";
import { UriTemplate } from "../../../../../base/common/uriTemplate.js";
import { ILogService, LogLevel } from "../../../../../platform/log/common/log.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { iterateOtlpLogRecords, logLevelToOtlpLevelName, severityNumberToLogLevel } from "../../../../../platform/agentHost/common/otlp/otlpLogEmitter.js";
import { AgentHostClientState } from "../../../../../platform/agentHost/browser/remoteAgentHostProtocolClient.js";
import { remoteAgentHostLogOutputChannelId } from "../../../../../platform/agentHost/common/remoteAgentHostService.js";
import { formatHostBuildInfo, readHostBuildInfo } from "../../../../../platform/agentHost/common/state/sessionState.js";
import { Extensions, IOutputService } from "../../../../../workbench/services/output/common/output.js";
let RemoteAgentHostLogForwarder = class extends Disposable {
  constructor(_client, address, displayName, _outputService, _logService) {
    super();
    this._client = _client;
    this._outputService = _outputService;
    this._logService = _logService;
    this._channelRegistered = false;
    /** Whether the one-time host build-info header has been written. */
    this._buildInfoHeaderWritten = false;
    /** Tracks whatever needs to be torn down for a single subscribe cycle. */
    this._subscriptionStore = this._register(new MutableDisposable());
    this._channelId = remoteAgentHostLogOutputChannelId(address);
    this._channelLabel = `Agent Host (${displayName})`;
    this._register(_client.onDidChangeConnectionState((state) => {
      switch (state) {
        case AgentHostClientState.Connected:
          this._attach();
          break;
        case AgentHostClientState.Reconnecting:
        case AgentHostClientState.Incompatible:
        case AgentHostClientState.Closed:
          this._detach();
          break;
        case AgentHostClientState.Connecting:
          break;
      }
    }));
    this._register(_logService.onDidChangeLogLevel(() => this._attach()));
    this._register(_client.onDidReceiveOtlpLogs((params) => {
      this._handleBatch(params.payload);
    }));
    if (_client.connectionState === AgentHostClientState.Connected) {
      this._attach();
    }
  }
  /**
   * (Re-)subscribe to the host's logs channel at the level matching the
   * workbench's current log level. Replaces any prior subscription.
   * Silent no-op when the host did not advertise a logs channel —
   * there is nothing to subscribe to.
   */
  _attach() {
    if (this._client.connectionState !== AgentHostClientState.Connected) {
      return;
    }
    const template = this._client.initializeResult.get()?.telemetry?.logs;
    if (!template) {
      return;
    }
    const desiredLevel = this._levelFromLogService();
    if (!desiredLevel) {
      this._detach();
      return;
    }
    if (this._subscriptionStore.value && this._currentLevel === desiredLevel) {
      return;
    }
    this._ensureChannelRegistered();
    this._writeHostBuildInfoHeader();
    const store = new DisposableStore();
    this._subscriptionStore.value = store;
    this._currentLevel = desiredLevel;
    const channelUri = this._expandLogsChannel(template, desiredLevel);
    this._client.subscribeStateless(URI.parse(channelUri)).catch((err) => {
      this._appendLine(`Failed to subscribe to OTLP logs channel ${channelUri}: ${formatError(err)}`);
    });
    store.add(toDisposable(() => {
      try {
        this._client.unsubscribe(URI.parse(channelUri));
      } catch {
      }
    }));
  }
  /**
   * Register the per-host Output channel on first attach. Subsequent
   * calls are no-ops — registering the same id twice replaces the
   * existing channel.
   *
   * The channel is intentionally never deregistered: the host count is
   * small, and the user typically wants to inspect logs after a host
   * has disconnected (e.g. when diagnosing why it dropped).
   */
  _ensureChannelRegistered() {
    if (this._channelRegistered) {
      return;
    }
    this._channelRegistered = true;
    const registry = Registry.as(Extensions.OutputChannels);
    if (!registry.getChannel(this._channelId)) {
      registry.registerChannel({
        id: this._channelId,
        label: this._channelLabel,
        log: false,
        languageId: "log"
      });
    }
  }
  /**
   * Drop the current subscription (if any). Idempotent. The Output
   * channel registration is preserved — only the in-flight subscribe
   * is undone.
   */
  _detach() {
    this._subscriptionStore.clear();
    this._currentLevel = void 0;
  }
  /**
   * Resolve the level we want to subscribe at from the workbench's
   * global log level. `Off` yields `undefined` so the caller can drop
   * any existing subscription.
   */
  _levelFromLogService() {
    const level = this._logService.getLevel();
    if (level === LogLevel.Off) {
      return void 0;
    }
    return logLevelToOtlpLevelName(level) ?? "info";
  }
  /**
   * Expand the host's RFC 6570 URI template to a concrete subscribable
   * channel URI. Hosts that hard-code a literal channel (no template
   * variables) round-trip verbatim — `UriTemplate.resolve` substitutes
   * any `{level}` variable and otherwise emits the literal sequence.
   *
   * Using `UriTemplate.parse` (rather than a hand-rolled `.replace`)
   * keeps the implementation spec-conformant: the host can theoretically
   * advertise variants like `{?level}` or pin additional unknown
   * variables the protocol may later define.
   */
  _expandLogsChannel(template, level) {
    return UriTemplate.parse(template).resolve({ level });
  }
  /**
   * Decode an OTLP/JSON `ExportLogsServiceRequest` payload and append
   * each contained record to the registered Output channel. Records
   * whose severity is below the workbench's current log level are
   * filtered defensively (the host *should* have honoured `{level}`
   * but the spec says we MUST still filter).
   */
  _handleBatch(payload) {
    if (!this._channelRegistered) {
      return;
    }
    const loggerLevel = this._logService.getLevel();
    if (loggerLevel === LogLevel.Off) {
      return;
    }
    for (const record of iterateOtlpLogRecords(payload)) {
      const level = severityNumberToLogLevel(record.severityNumber);
      if (level < loggerLevel) {
        continue;
      }
      this._appendLine(formatRecord(record));
    }
  }
  /**
   * Write a one-time header line with the host's build info (version,
   * commit, date, quality) read from the connected client's root state.
   * Lets the user see which build is hosting the agent host in the
   * forwarded Output channel. No-op when the root state has not arrived
   * or carries no build info, and only ever writes once.
   */
  _writeHostBuildInfoHeader() {
    if (this._buildInfoHeaderWritten) {
      return;
    }
    const rootState = this._client.rootState.value;
    if (!rootState || rootState instanceof Error) {
      return;
    }
    const buildInfo = readHostBuildInfo(rootState);
    if (!buildInfo) {
      return;
    }
    this._buildInfoHeaderWritten = true;
    this._appendLine(`Agent host version ${formatHostBuildInfo(buildInfo)}`);
  }
  _appendLine(text) {
    if (!this._outputChannel) {
      this._outputChannel = this._outputService.getChannel(this._channelId);
      if (!this._outputChannel) {
        return;
      }
    }
    this._outputChannel.append(text.endsWith("\n") ? text : `${text}
`);
  }
};
RemoteAgentHostLogForwarder = __decorateClass([
  __decorateParam(3, IOutputService),
  __decorateParam(4, ILogService)
], RemoteAgentHostLogForwarder);
function formatRecord(record) {
  const timestamp = formatTimestamp(record.timeUnixNano);
  const severity = record.severityText.toUpperCase().padEnd(5);
  const attributes = record.attributes && Object.keys(record.attributes).length > 0 ? ` ${JSON.stringify(record.attributes)}` : "";
  return `[${timestamp}] [${severity}] ${record.body}${attributes}`;
}
function formatTimestamp(timeUnixNano) {
  const ms = timeUnixNano.length > 6 ? Number(timeUnixNano.slice(0, -6)) : 0;
  if (!Number.isFinite(ms)) {
    return (/* @__PURE__ */ new Date()).toISOString();
  }
  return new Date(ms).toISOString();
}
function formatError(err) {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
export {
  RemoteAgentHostLogForwarder
};
