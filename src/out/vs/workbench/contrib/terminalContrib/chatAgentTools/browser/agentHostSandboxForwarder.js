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
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { equals } from "../../../../../base/common/objects.js";
import { AgentHostSdkSandboxEnabledSettingId } from "../../../../../platform/agentHost/common/agentService.js";
import { AgentHostCustomTerminalToolEnabledSettingId } from "../../../../../platform/agentHost/common/copilotCliConfig.js";
import { IAgentHostConnectionsService } from "../../../../../platform/agentHost/common/agentHostConnectionsService.js";
import { AgentHostSandboxConfigKey, AgentHostSandboxKey } from "../../../../../platform/agentHost/common/sandboxConfigSchema.js";
import { AgentSandboxEnabledValue } from "../../../../../platform/sandbox/common/settings.js";
import { ActionType } from "../../../../../platform/agentHost/common/state/protocol/actions.js";
import { ROOT_STATE_URI } from "../../../../../platform/agentHost/common/state/sessionState.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { readAgentHostSandboxValues, SANDBOX_SETTING_KEYS } from "../common/sandboxSettingsReader.js";
const HOST_POLICY_SETTING_KEYS = [
  AgentHostCustomTerminalToolEnabledSettingId,
  AgentHostSdkSandboxEnabledSettingId
];
let AgentHostSandboxForwarder = class extends Disposable {
  constructor(_connectionsService, _configurationService, _logService) {
    super();
    this._connectionsService = _connectionsService;
    this._configurationService = _configurationService;
    this._logService = _logService;
    /**
     * Connections that have already had their initial push attempted
     * (successfully or via a pending listener waiting for the sandbox
     * schema). Used to avoid re-scheduling pushes for connections that
     * are still present across `onDidChangeConnections` events.
     */
    this._scheduled = /* @__PURE__ */ new Map();
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (SANDBOX_SETTING_KEYS.some((key) => e.affectsConfiguration(key)) || HOST_POLICY_SETTING_KEYS.some((key) => e.affectsConfiguration(key))) {
        this._desired = void 0;
        this._pushToAllConnections();
      }
    }));
    this._register(this._connectionsService.onDidChangeConnections(() => {
      this._syncConnectionListeners();
    }));
    this._syncConnectionListeners();
  }
  static {
    this.ID = "workbench.contrib.agentHostSandboxForwarder";
  }
  _syncConnectionListeners() {
    const live = /* @__PURE__ */ new Set();
    for (const info of this._connectionsService.connections) {
      if (!info.connection) {
        continue;
      }
      live.add(info.connection);
      if (!this._scheduled.has(info.connection)) {
        this._scheduleInitialPush(info.connection);
      }
    }
    for (const [connection, listener] of this._scheduled) {
      if (!live.has(connection)) {
        listener.dispose();
        this._scheduled.delete(connection);
      }
    }
  }
  /**
   * Push immediately if the host is already advertising the sandbox
   * schema; otherwise subscribe to `rootState.onDidChange` long enough
   * to catch the schema and push exactly once, then unsubscribe.
   */
  _scheduleInitialPush(connection) {
    if (this._tryPush(connection)) {
      this._scheduled.set(connection, Disposable.None);
      return;
    }
    const listener = connection.rootState.onDidChange(() => {
      if (this._tryPush(connection)) {
        this._scheduled.get(connection)?.dispose();
        this._scheduled.set(connection, Disposable.None);
      }
    });
    this._scheduled.set(connection, listener);
  }
  _pushToAllConnections() {
    for (const info of this._connectionsService.connections) {
      if (info.connection) {
        this._tryPush(info.connection);
      }
    }
  }
  /**
   * Attempt to dispatch the desired sandbox config to `connection`.
   * Returns `true` once the host has advertised the sandbox schema
   * (whether or not an actual dispatch was needed); `false` if the
   * schema is not yet available and the caller should keep waiting.
   */
  _tryPush(connection) {
    const rootState = connection.rootState.value;
    if (!rootState || rootState instanceof Error) {
      return false;
    }
    const schemaProperties = rootState.config?.schema.properties;
    if (!schemaProperties?.[AgentHostSandboxConfigKey.Sandbox]) {
      return false;
    }
    const desired = this._getDesired();
    const current = rootState.config?.values?.[AgentHostSandboxConfigKey.Sandbox] ?? {};
    if (!equals(current, desired)) {
      connection.dispatch(ROOT_STATE_URI, {
        type: ActionType.RootConfigChanged,
        config: { [AgentHostSandboxConfigKey.Sandbox]: desired }
      });
    }
    return true;
  }
  _getDesired() {
    if (this._desired === void 0) {
      this._desired = this._computeDesired();
    }
    return this._desired;
  }
  /**
   * Compute the sandbox config to forward to the Agent Host.
   *
   *  - When the Agent Host's own terminal sandbox engine is enabled
   *    (`chat.agentHost.customTerminalTool.enabled === true`), forward the
   *    user's full `chat.agent.sandbox.*` policy verbatim. The engine reads
   *    those values directly.
   *
   *  - Otherwise (the SDK runs the shell tool), gate on
   *    `chat.agentHost.sdkSandbox.enabled`:
   *      - `'off'` (the default) — forward an empty object so any
   *        previously-pushed values are cleared and the SDK runs commands
   *        unsandboxed.
   *      - `'on'` / `'allowNetwork'` — forward the user's policy but
   *        override both `enabled` and `enabled.windows` with the SDK
   *        sandbox value. The SDK sandbox mode is independent of the
   *        engine sandbox mode, so the user can run the SDK sandboxed
   *        even when the engine sandbox is off.
   */
  _computeDesired() {
    const customTerminalToolEnabled = this._configurationService.getValue(AgentHostCustomTerminalToolEnabledSettingId) === true;
    const values = readAgentHostSandboxValues(this._configurationService, this._logService);
    if (customTerminalToolEnabled) {
      return values;
    }
    const sdkSandbox = this._configurationService.getValue(AgentHostSdkSandboxEnabledSettingId) ?? AgentSandboxEnabledValue.Off;
    if (sdkSandbox !== AgentSandboxEnabledValue.On && sdkSandbox !== AgentSandboxEnabledValue.AllowNetwork) {
      return {};
    }
    values[AgentHostSandboxKey.Enabled] = sdkSandbox;
    values[AgentHostSandboxKey.WindowsEnabled] = sdkSandbox;
    return values;
  }
  dispose() {
    for (const listener of this._scheduled.values()) {
      listener.dispose();
    }
    this._scheduled.clear();
    super.dispose();
  }
};
AgentHostSandboxForwarder = __decorateClass([
  __decorateParam(0, IAgentHostConnectionsService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, ILogService)
], AgentHostSandboxForwarder);
export {
  AgentHostSandboxForwarder
};
