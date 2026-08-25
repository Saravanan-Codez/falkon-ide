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
import { Emitter } from "../../../../../../base/common/event.js";
import { equals } from "../../../../../../base/common/objects.js";
import { URI } from "../../../../../../base/common/uri.js";
import { localize } from "../../../../../../nls.js";
import { createFileSystemProviderError, FileSystemProviderErrorCode } from "../../../../../../platform/files/common/files.js";
import { ILogService } from "../../../../../../platform/log/common/log.js";
import { IAgentHostService } from "../../../../../../platform/agentHost/common/agentService.js";
import { ActionType } from "../../../../../../platform/agentHost/common/state/protocol/actions.js";
import { ROOT_STATE_URI } from "../../../../../../platform/agentHost/common/state/sessionState.js";
import {
  AbstractAgentHostConfigFileSystemProvider,
  AbstractAgentHostConfigSchemaRegistrar,
  serializeAgentHostConfigDocument
} from "./agentHostConfigEditor.js";
const AGENT_HOST_SETTINGS_SCHEME = "agent-host-settings";
const AGENT_HOST_SETTINGS_LOCAL_AUTHORITY = "local";
function agentHostSettingsUri() {
  return URI.from({
    scheme: AGENT_HOST_SETTINGS_SCHEME,
    authority: AGENT_HOST_SETTINGS_LOCAL_AUTHORITY,
    path: `/settings.jsonc`
  });
}
function parseAmbientHostSettingsUri(uri) {
  if (uri.scheme !== AGENT_HOST_SETTINGS_SCHEME || uri.authority !== AGENT_HOST_SETTINGS_LOCAL_AUTHORITY || uri.path !== "/settings.jsonc") {
    return void 0;
  }
  return { kind: "local" };
}
const hostSettingsPropertyFilter = () => true;
const hostSettingsLocale = {
  get header() {
    return localize("agentHostSettings.header", "Agent host settings.");
  },
  get saveHint() {
    return localize("agentHostSettings.saveHint", "Edit values below and save to apply. Unknown properties are ignored.");
  },
  get parseError() {
    return localize("agentHostSettings.parseError", "Failed to parse agent host settings as JSON.");
  },
  get notObject() {
    return localize("agentHostSettings.notObject", "Agent host settings must be a JSON object.");
  }
};
function readRootConfig(state) {
  if (!state || state instanceof Error) {
    return void 0;
  }
  return state.config;
}
let AgentHostSettingsFileSystemProvider = class extends AbstractAgentHostConfigFileSystemProvider {
  constructor(_schemaRegistrar, _agentHostService, logService) {
    super(logService);
    this._schemaRegistrar = _schemaRegistrar;
    this._agentHostService = _agentHostService;
    this._schemeLabel = AGENT_HOST_SETTINGS_SCHEME;
    this._traceTag = "AgentHostSettings";
    this._locale = hostSettingsLocale;
    this._onDidChangeRootConfig = this._register(new Emitter());
    this._syncRootConfig(this._agentHostService.rootState.value);
    this._register(this._agentHostService.rootState.onDidChange((state) => this._syncRootConfig(state)));
  }
  _syncRootConfig(state) {
    const next = readRootConfig(state);
    const prev = this._rootConfig;
    if (prev === next) {
      return;
    }
    if (!next) {
      this._rootConfig = void 0;
      this._onDidChangeRootConfig.fire();
      return;
    }
    if (prev?.schema === next.schema && equals(prev.values, next.values)) {
      return;
    }
    this._rootConfig = next;
    this._onDidChangeRootConfig.fire();
  }
  _parseUri(resource) {
    return parseAmbientHostSettingsUri(resource);
  }
  _resolveTarget() {
    return this._agentHostService;
  }
  _missingTargetError() {
    return createFileSystemProviderError("Agent host is not available", FileSystemProviderErrorCode.FileNotFound);
  }
  _serialize() {
    return serializeAgentHostConfigDocument(this._rootConfig, hostSettingsPropertyFilter, hostSettingsLocale);
  }
  _watchChanges(_target, _ctx, fire) {
    return this._onDidChangeRootConfig.event(() => fire());
  }
  _ensureSchemaRegistered(target) {
    this._schemaRegistrar.ensureRegistered(target);
  }
  _hasConfig() {
    return this._rootConfig !== void 0;
  }
  async _replaceConfig(_target, _ctx, values) {
    const current = this._rootConfig;
    if (!current) {
      return;
    }
    const nextValues = {};
    for (const [key, value] of Object.entries(values)) {
      if (current.schema.properties[key]) {
        nextValues[key] = value;
      }
    }
    if (equals(nextValues, current.values)) {
      return;
    }
    this._rootConfig = { ...current, values: nextValues };
    this._onDidChangeRootConfig.fire();
    this._agentHostService.dispatch(ROOT_STATE_URI, {
      type: ActionType.RootConfigChanged,
      config: nextValues,
      replace: true
    });
  }
  _describeForTrace() {
    return "local agent host";
  }
};
AgentHostSettingsFileSystemProvider = __decorateClass([
  __decorateParam(1, IAgentHostService),
  __decorateParam(2, ILogService)
], AgentHostSettingsFileSystemProvider);
let AgentHostSettingsSchemaRegistrar = class extends AbstractAgentHostConfigSchemaRegistrar {
  constructor(_agentHostService) {
    super();
    this._agentHostService = _agentHostService;
    this._register(this._agentHostService.rootState.onDidChange(() => {
      if (!this._isRegistered(this._agentHostService)) {
        return;
      }
      this._refreshSchema(this._agentHostService);
    }));
  }
  _propertyFilter() {
    return hostSettingsPropertyFilter;
  }
  _settingsUri() {
    return agentHostSettingsUri().toString();
  }
  _schemaId() {
    return `vscode://schemas/agent-host-settings/${AGENT_HOST_SETTINGS_LOCAL_AUTHORITY}.jsonc`;
  }
  _getConfig(target) {
    return readRootConfig(target.rootState.value);
  }
};
AgentHostSettingsSchemaRegistrar = __decorateClass([
  __decorateParam(0, IAgentHostService)
], AgentHostSettingsSchemaRegistrar);
export {
  AGENT_HOST_SETTINGS_LOCAL_AUTHORITY,
  AGENT_HOST_SETTINGS_SCHEME,
  AgentHostSettingsFileSystemProvider,
  AgentHostSettingsSchemaRegistrar,
  agentHostSettingsUri
};
