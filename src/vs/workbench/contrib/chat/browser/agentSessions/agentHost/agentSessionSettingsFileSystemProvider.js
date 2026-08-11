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
import { equals } from "../../../../../../base/common/objects.js";
import { URI } from "../../../../../../base/common/uri.js";
import { localize } from "../../../../../../nls.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { ILogService } from "../../../../../../platform/log/common/log.js";
import { IAgentHostService } from "../../../../../../platform/agentHost/common/agentService.js";
import { ActionType } from "../../../../../../platform/agentHost/common/state/protocol/actions.js";
import { StateComponents } from "../../../../../../platform/agentHost/common/state/sessionState.js";
import { isAutoApprovePolicyRestricted, normalizeSessionConfigValue } from "../../../common/agentHostConfigPolicy.js";
import {
  AbstractAgentHostConfigFileSystemProvider,
  AbstractAgentHostConfigSchemaRegistrar,
  serializeAgentHostConfigDocument
} from "./agentHostConfigEditor.js";
const AGENT_SESSION_SETTINGS_SCHEME = "agent-session-settings";
const SUBSCRIPTION_OWNER = "AgentSessionSettingsEditor";
function agentSessionSettingsUri(backendSession) {
  const rawId = backendSession.path.startsWith("/") ? backendSession.path.substring(1) : backendSession.path;
  return URI.from({
    scheme: AGENT_SESSION_SETTINGS_SCHEME,
    authority: backendSession.scheme,
    path: `/${rawId}.jsonc`
  });
}
function parseSessionSettingsUri(uri) {
  if (uri.scheme !== AGENT_SESSION_SETTINGS_SCHEME || !uri.authority) {
    return void 0;
  }
  let rawId = uri.path.startsWith("/") ? uri.path.substring(1) : uri.path;
  const lastDot = rawId.lastIndexOf(".");
  if (lastDot > 0) {
    rawId = rawId.substring(0, lastDot);
  }
  if (!rawId) {
    return void 0;
  }
  return { backendSession: URI.from({ scheme: uri.authority, path: `/${rawId}` }) };
}
const sessionSettingsPropertyFilter = (_key, schema) => {
  const s = schema;
  return s.sessionMutable === true && s.readOnly !== true;
};
const sessionSettingsLocale = {
  get header() {
    return localize("chatAgentSessionSettings.header", "Session settings for this agent host session.");
  },
  get saveHint() {
    return localize("chatAgentSessionSettings.saveHint", "Edit values below and save to apply. Unknown or non-mutable properties are ignored.");
  },
  get parseError() {
    return localize("chatAgentSessionSettings.parseError", "Failed to parse agent session settings as JSON.");
  },
  get notObject() {
    return localize("chatAgentSessionSettings.notObject", "Agent session settings must be a JSON object.");
  }
};
function readSessionConfig(state) {
  if (!state || state instanceof Error || !state.config) {
    return void 0;
  }
  return state.config;
}
let AgentSessionSettingsFileSystemProvider = class extends AbstractAgentHostConfigFileSystemProvider {
  constructor(_schemaRegistrar, _agentHostService, _configurationService, logService) {
    super(logService);
    this._schemaRegistrar = _schemaRegistrar;
    this._agentHostService = _agentHostService;
    this._configurationService = _configurationService;
    this._schemeLabel = AGENT_SESSION_SETTINGS_SCHEME;
    this._traceTag = "AgentSessionSettings";
    this._locale = sessionSettingsLocale;
  }
  _parseUri(resource) {
    return parseSessionSettingsUri(resource);
  }
  _resolveTarget(ctx) {
    const ref = this._agentHostService.getSubscription(StateComponents.Session, ctx.backendSession, SUBSCRIPTION_OWNER);
    return { backendSession: ctx.backendSession, ref };
  }
  _releaseTarget(target) {
    target.ref.dispose();
  }
  _serialize(target) {
    return serializeAgentHostConfigDocument(readSessionConfig(target.ref.object.value), sessionSettingsPropertyFilter, sessionSettingsLocale);
  }
  _watchChanges(target, _ctx, fire) {
    return target.ref.object.onDidChange(() => fire());
  }
  _ensureSchemaRegistered(target) {
    this._schemaRegistrar.ensureRegistered(target.backendSession);
  }
  _hasConfig(target) {
    return readSessionConfig(target.ref.object.value) !== void 0;
  }
  // The input is the user's full view of editable values. Dispatch as a
  // replace: every non-editable property is forced through unchanged from
  // the current values, and an editable property the user omitted is left
  // out of the replacement payload entirely, clearing it. Editable values
  // the user *did* supply are still clamped by
  // normalizeSessionConfigValue - otherwise an org auto-approve policy
  // enforced everywhere else (chip picker, sessions-window replace) could
  // be bypassed simply by editing this JSONC document directly.
  async _replaceConfig(target, ctx, values) {
    const current = readSessionConfig(target.ref.object.value);
    if (!current) {
      return;
    }
    const policyRestricted = isAutoApprovePolicyRestricted(this._configurationService);
    const nextValues = {};
    for (const [key, schema] of Object.entries(current.schema.properties)) {
      if (sessionSettingsPropertyFilter(key, schema)) {
        if (Object.hasOwn(values, key)) {
          nextValues[key] = normalizeSessionConfigValue(key, values[key], policyRestricted);
        }
      } else if (Object.hasOwn(current.values, key)) {
        nextValues[key] = current.values[key];
      }
    }
    if (equals(nextValues, current.values)) {
      return;
    }
    this._agentHostService.dispatch(ctx.backendSession.toString(), {
      type: ActionType.SessionConfigChanged,
      config: nextValues,
      replace: true
    });
  }
  _describeForTrace(ctx) {
    return `session ${ctx.backendSession.toString()}`;
  }
};
AgentSessionSettingsFileSystemProvider = __decorateClass([
  __decorateParam(1, IAgentHostService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, ILogService)
], AgentSessionSettingsFileSystemProvider);
let AgentSessionSettingsSchemaRegistrar = class extends AbstractAgentHostConfigSchemaRegistrar {
  constructor(_agentHostService) {
    super();
    this._agentHostService = _agentHostService;
  }
  _propertyFilter() {
    return sessionSettingsPropertyFilter;
  }
  _settingsUri(backendSession) {
    return agentSessionSettingsUri(backendSession).toString();
  }
  _schemaId(backendSession) {
    const rawId = backendSession.path.startsWith("/") ? backendSession.path.substring(1) : backendSession.path;
    return `vscode://schemas/agent-session-settings/${backendSession.scheme}/${rawId}.jsonc`;
  }
  _getConfig(backendSession) {
    const sub = this._agentHostService.getSubscriptionUnmanaged(StateComponents.Session, backendSession);
    return readSessionConfig(sub?.value);
  }
};
AgentSessionSettingsSchemaRegistrar = __decorateClass([
  __decorateParam(0, IAgentHostService)
], AgentSessionSettingsSchemaRegistrar);
export {
  AGENT_SESSION_SETTINGS_SCHEME,
  AgentSessionSettingsFileSystemProvider,
  AgentSessionSettingsSchemaRegistrar,
  agentSessionSettingsUri
};
