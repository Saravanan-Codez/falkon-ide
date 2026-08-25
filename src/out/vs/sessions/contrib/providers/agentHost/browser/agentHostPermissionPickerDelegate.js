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
import { Disposable, DisposableMap } from "../../../../../base/common/lifecycle.js";
import { derived, observableSignal } from "../../../../../base/common/observable.js";
import { localize } from "../../../../../nls.js";
import { KNOWN_AUTO_APPROVE_VALUES, SessionConfigKey } from "../../../../../platform/agentHost/common/sessionConfigKeys.js";
import { narrowClaudePermissionMode } from "../../../../../platform/agentHost/common/claudeSessionConfigKeys.js";
import { narrowCodexPermissionsPreset } from "../../../../../platform/agentHost/common/codexSessionConfigKeys.js";
import { ChatConfiguration, ChatPermissionLevel, isChatPermissionLevel } from "../../../../../workbench/contrib/chat/common/constants.js";
import { isAgentHostProvider } from "../../../../common/agentHostSessionsProvider.js";
import { ISessionsProvidersService } from "../../../../services/sessions/browser/sessionsProvidersService.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { isAssistedPermissionsEnabled, isPermissionLevelVisible } from "../../../../../workbench/contrib/chat/common/agentHostConfigPolicy.js";
const REQUIRED_AUTO_APPROVE_VALUE = "default";
const REQUIRED_MODE_VALUE = "interactive";
const REQUIRED_PERMISSION_MODE_VALUE = "default";
const REQUIRED_CODEX_APPROVALS_VALUE = "default";
function isWellKnownAutoApproveSchema(schema) {
  if (schema.type !== "string" || !Array.isArray(schema.enum) || schema.enum.length === 0) {
    return false;
  }
  if (!schema.enum.includes(REQUIRED_AUTO_APPROVE_VALUE)) {
    return false;
  }
  return schema.enum.every((value) => typeof value === "string" && KNOWN_AUTO_APPROVE_VALUES.has(value));
}
let AgentHostPermissionPickerDelegate = class extends Disposable {
  constructor(_session, _sessionsProvidersService, _configurationService) {
    super();
    this._session = _session;
    this._sessionsProvidersService = _sessionsProvidersService;
    this._configurationService = _configurationService;
    /** Fires every time any agent-host provider's session config changes. */
    this._configChangedSignal = observableSignal("agentHostPermissionPicker.configChanged");
    this._providerSubscriptions = this._register(new DisposableMap());
    /** Agent-host sessions seed their default approval level from this setting. */
    this.defaultSettingKey = ChatConfiguration.DefaultConfiguration;
    this._watchProviders(this._sessionsProvidersService.getProviders());
    this._register(this._sessionsProvidersService.onDidChangeProviders((e) => {
      for (const provider of e.removed) {
        this._providerSubscriptions.deleteAndDispose(provider.id);
      }
      this._watchProviders(e.added);
      this._configChangedSignal.trigger(void 0);
    }));
    this.currentPermissionLevel = derived(this, (reader) => this._readLevel(reader));
    this.isApplicable = derived(this, (reader) => this._readIsWellKnown(reader));
    this.isResolving = derived(this, (reader) => {
      this._configChangedSignal.read(reader);
      const session = this._session.read(reader);
      if (!session) {
        return false;
      }
      const provider = this._getProvider(session.providerId);
      return provider?.isSessionConfigResolving(session.sessionId).read(reader) ?? false;
    });
  }
  get availableLevels() {
    const session = this._session.get();
    if (!session) {
      return [ChatPermissionLevel.Default];
    }
    const provider = this._getProvider(session.providerId);
    const schema = provider?.getSessionConfig(session.sessionId)?.schema.properties[SessionConfigKey.AutoApprove];
    const values = schema?.type === "string" && Array.isArray(schema.enum) ? schema.enum : [];
    const assistedPermissionsEnabled = isAssistedPermissionsEnabled(this._configurationService);
    return [
      ChatPermissionLevel.Default,
      ChatPermissionLevel.Assisted,
      ChatPermissionLevel.AutoApprove
    ].filter((level) => values.includes(level) && isPermissionLevelVisible(level, assistedPermissionsEnabled));
  }
  getPermissionLevelMeta(level, meta) {
    switch (level) {
      case ChatPermissionLevel.Default:
        return { ...meta, detail: localize("agentHostPermissionPicker.askWhenNeeded.detail", "Asks when approval settings don't apply") };
      case ChatPermissionLevel.Assisted:
        return { ...meta, detail: localize("agentHostPermissionPicker.approveWhenSafe.detail", "Evaluates risk before running tools") };
      case ChatPermissionLevel.AutoApprove:
        return { ...meta, detail: localize("agentHostPermissionPicker.allowAll.detail", "Runs tool calls without asking") };
      case ChatPermissionLevel.Autopilot:
        return meta;
    }
  }
  setPermissionLevel(level) {
    if (!isPermissionLevelVisible(level, isAssistedPermissionsEnabled(this._configurationService))) {
      return;
    }
    const session = this._session.get();
    if (!session) {
      return;
    }
    const provider = this._getProvider(session.providerId);
    if (!provider) {
      return;
    }
    if (provider.isSessionConfigResolving(session.sessionId).get()) {
      return;
    }
    if (!this.availableLevels.includes(level)) {
      return;
    }
    provider.setSessionConfigValue(session.sessionId, SessionConfigKey.AutoApprove, level).catch(() => {
    });
  }
  getPermissionLevelHover(level, _meta) {
    switch (level) {
      case ChatPermissionLevel.Default:
        return localize("agentHostPermissionPicker.defaultApprovalsHover", "Copilot asks before running tools unless your configured settings allow the tool.");
      case ChatPermissionLevel.AutoApprove:
        return localize("agentHostPermissionPicker.autoApproveHover", "Copilot runs all tools without asking for approval.");
      case ChatPermissionLevel.Assisted:
        return localize("agentHostPermissionPicker.assistedHover", "An LLM judge evaluates each tool call. Tools it doesn't approve require your approval.");
      case ChatPermissionLevel.Autopilot:
        return localize("agentHostPermissionPicker.autopilotApprovalsHover", "Copilot runs tools without asking for approval and continues until the task is done.");
    }
  }
  _readLevel(reader) {
    this._configChangedSignal.read(reader);
    const session = this._session.read(reader);
    if (!session) {
      return ChatPermissionLevel.Default;
    }
    const provider = this._getProvider(session.providerId);
    if (!provider) {
      return ChatPermissionLevel.Default;
    }
    const value = provider.getSessionConfig(session.sessionId)?.values[SessionConfigKey.AutoApprove];
    if (value === ChatPermissionLevel.Autopilot) {
      return ChatPermissionLevel.Default;
    }
    return isChatPermissionLevel(value) ? value : ChatPermissionLevel.Default;
  }
  _readIsWellKnown(reader) {
    this._configChangedSignal.read(reader);
    const session = this._session.read(reader);
    if (!session) {
      return false;
    }
    const provider = this._getProvider(session.providerId);
    if (!provider) {
      return false;
    }
    const schema = provider.getSessionConfig(session.sessionId)?.schema.properties[SessionConfigKey.AutoApprove];
    return !!schema && isWellKnownAutoApproveSchema(schema);
  }
  _getProvider(providerId) {
    const provider = this._sessionsProvidersService.getProvider(providerId);
    return provider && isAgentHostProvider(provider) ? provider : void 0;
  }
  _watchProviders(providers) {
    for (const provider of providers) {
      if (!isAgentHostProvider(provider) || this._providerSubscriptions.has(provider.id)) {
        continue;
      }
      this._providerSubscriptions.set(provider.id, provider.onDidChangeSessionConfig(() => {
        this._configChangedSignal.trigger(void 0);
      }));
    }
  }
};
AgentHostPermissionPickerDelegate = __decorateClass([
  __decorateParam(1, ISessionsProvidersService),
  __decorateParam(2, IConfigurationService)
], AgentHostPermissionPickerDelegate);
function isWellKnownModeSchema(schema) {
  if (schema.type !== "string" || !Array.isArray(schema.enum) || schema.enum.length === 0) {
    return false;
  }
  if (!schema.enum.includes(REQUIRED_MODE_VALUE)) {
    return false;
  }
  return true;
}
function isWellKnownModeValue(schema, value) {
  return isWellKnownModeSchema(schema) && schema.enum.some((candidate) => String(candidate) === value);
}
function isWellKnownClaudePermissionModeSchema(schema) {
  if (schema.type !== "string" || !Array.isArray(schema.enum) || schema.enum.length === 0) {
    return false;
  }
  if (!schema.enum.includes(REQUIRED_PERMISSION_MODE_VALUE)) {
    return false;
  }
  return schema.enum.every((value) => narrowClaudePermissionMode(value) !== void 0);
}
function isWellKnownCodexApprovalsSchema(schema) {
  if (schema.type !== "string" || !Array.isArray(schema.enum) || schema.enum.length === 0) {
    return false;
  }
  if (!schema.enum.includes(REQUIRED_CODEX_APPROVALS_VALUE)) {
    return false;
  }
  return schema.enum.every((value) => narrowCodexPermissionsPreset(value) !== void 0);
}
export {
  AgentHostPermissionPickerDelegate,
  isWellKnownAutoApproveSchema,
  isWellKnownClaudePermissionModeSchema,
  isWellKnownCodexApprovalsSchema,
  isWellKnownModeSchema,
  isWellKnownModeValue
};
