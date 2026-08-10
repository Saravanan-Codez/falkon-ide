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
import { URI } from "../../../../../base/common/uri.js";
import { localize } from "../../../../../nls.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { ISessionsProvidersService } from "../../../../services/sessions/browser/sessionsProvidersService.js";
import {
  AbstractMultiProviderAgentHostConfigSchemaRegistrar,
  AbstractSessionsAgentHostConfigFileSystemProvider,
  buildAgentHostConfigJsonSchema,
  serializeAgentHostConfigDocument
} from "./agentHostSettingsShared.js";
const AGENT_HOST_SETTINGS_SCHEME = "agent-host-settings";
function agentHostSettingsUri(providerId) {
  return URI.from({
    scheme: AGENT_HOST_SETTINGS_SCHEME,
    authority: providerId,
    path: `/settings.jsonc`
  });
}
function parseHostSettingsUri(uri) {
  if (uri.scheme !== AGENT_HOST_SETTINGS_SCHEME) {
    return void 0;
  }
  const providerId = uri.authority;
  if (!providerId) {
    return void 0;
  }
  return { providerId };
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
function serializeHostSettings(provider) {
  return serializeAgentHostConfigDocument(provider.getRootConfig(), hostSettingsPropertyFilter, hostSettingsLocale);
}
function buildHostSettingsJsonSchema(config) {
  return buildAgentHostConfigJsonSchema(config, hostSettingsPropertyFilter);
}
let AgentHostSettingsFileSystemProvider = class extends AbstractSessionsAgentHostConfigFileSystemProvider {
  constructor(_schemaRegistrar, sessionsProvidersService, logService) {
    super(sessionsProvidersService, logService);
    this._schemaRegistrar = _schemaRegistrar;
    this._schemeLabel = AGENT_HOST_SETTINGS_SCHEME;
    this._traceTag = "AgentHostSettings";
    this._locale = hostSettingsLocale;
  }
  _parseUri(resource) {
    return parseHostSettingsUri(resource);
  }
  _serialize(provider) {
    return serializeHostSettings(provider);
  }
  _watchChanges(provider, _ctx, fire) {
    return provider.onDidChangeRootConfig(() => fire());
  }
  _ensureSchemaRegistered(provider) {
    this._schemaRegistrar.ensureRegistered(provider);
  }
  _hasConfig(provider) {
    return provider.getRootConfig() !== void 0;
  }
  _replaceConfig(provider, _ctx, values) {
    return provider.replaceRootConfig(values);
  }
  _describeForTrace(ctx) {
    return `provider ${ctx.providerId}`;
  }
};
AgentHostSettingsFileSystemProvider = __decorateClass([
  __decorateParam(1, ISessionsProvidersService),
  __decorateParam(2, ILogService)
], AgentHostSettingsFileSystemProvider);
class AgentHostSettingsSchemaRegistrar extends AbstractMultiProviderAgentHostConfigSchemaRegistrar {
  _propertyFilter() {
    return hostSettingsPropertyFilter;
  }
  _settingsUri(provider) {
    return agentHostSettingsUri(provider.id).toString();
  }
  _schemaId(provider) {
    return `vscode://schemas/agent-host-settings/${provider.id}.jsonc`;
  }
  _getConfig(target) {
    return target.getRootConfig();
  }
  _targetsForProvider(provider) {
    return [provider];
  }
  _observeProvider(provider, onChanged, _onRemoved) {
    return provider.onDidChangeRootConfig(() => onChanged(provider));
  }
}
export {
  AGENT_HOST_SETTINGS_SCHEME,
  AgentHostSettingsFileSystemProvider,
  AgentHostSettingsSchemaRegistrar,
  agentHostSettingsUri,
  buildHostSettingsJsonSchema,
  serializeHostSettings
};
