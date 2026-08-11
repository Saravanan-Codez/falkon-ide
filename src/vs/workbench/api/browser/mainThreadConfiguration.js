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
import { URI } from "../../../base/common/uri.js";
import { Registry } from "../../../platform/registry/common/platform.js";
import { Extensions as ConfigurationExtensions, ConfigurationScope, getScopes } from "../../../platform/configuration/common/configurationRegistry.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../platform/workspace/common/workspace.js";
import { MainContext, ExtHostContext } from "../common/extHost.protocol.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { ConfigurationTarget, IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { IEnvironmentService } from "../../../platform/environment/common/environment.js";
let MainThreadConfiguration = class {
  constructor(extHostContext, _workspaceContextService, configurationService, _environmentService) {
    this._workspaceContextService = _workspaceContextService;
    this.configurationService = configurationService;
    this._environmentService = _environmentService;
    const proxy = extHostContext.getProxy(ExtHostContext.ExtHostConfiguration);
    proxy.$initializeConfiguration(this._getConfigurationData());
    this._configurationListener = configurationService.onDidChangeConfiguration((e) => {
      proxy.$acceptConfigurationChanged(this._getConfigurationData(), e.change);
    });
  }
  _getConfigurationData() {
    const configurationData = { ...this.configurationService.getConfigurationData(), configurationScopes: [] };
    if (!this._environmentService.isBuilt || this._environmentService.isExtensionDevelopment) {
      configurationData.configurationScopes = getScopes();
    }
    return configurationData;
  }
  dispose() {
    this._configurationListener.dispose();
  }
  $updateConfigurationOption(target, key, value, overrides, scopeToLanguage) {
    overrides = { resource: overrides?.resource ? URI.revive(overrides.resource) : void 0, overrideIdentifier: overrides?.overrideIdentifier };
    return this.writeConfiguration(target, key, value, overrides, scopeToLanguage);
  }
  $removeConfigurationOption(target, key, overrides, scopeToLanguage) {
    overrides = { resource: overrides?.resource ? URI.revive(overrides.resource) : void 0, overrideIdentifier: overrides?.overrideIdentifier };
    return this.writeConfiguration(target, key, void 0, overrides, scopeToLanguage);
  }
  writeConfiguration(target, key, value, overrides, scopeToLanguage) {
    target = target !== null && target !== void 0 ? target : this.deriveConfigurationTarget(key, overrides);
    const configurationValue = this.configurationService.inspect(key, overrides);
    switch (target) {
      case ConfigurationTarget.MEMORY:
        return this._updateValue(key, value, target, configurationValue?.memory?.override, overrides, scopeToLanguage);
      case ConfigurationTarget.WORKSPACE_FOLDER:
        return this._updateValue(key, value, target, configurationValue?.workspaceFolder?.override, overrides, scopeToLanguage);
      case ConfigurationTarget.WORKSPACE:
        return this._updateValue(key, value, target, configurationValue?.workspace?.override, overrides, scopeToLanguage);
      case ConfigurationTarget.USER_REMOTE:
        return this._updateValue(key, value, target, configurationValue?.userRemote?.override, overrides, scopeToLanguage);
      default:
        return this._updateValue(key, value, target, configurationValue?.userLocal?.override, overrides, scopeToLanguage);
    }
  }
  _updateValue(key, value, configurationTarget, overriddenValue, overrides, scopeToLanguage) {
    overrides = scopeToLanguage === true ? overrides : scopeToLanguage === false ? { resource: overrides.resource } : overrides.overrideIdentifier && overriddenValue !== void 0 ? overrides : { resource: overrides.resource };
    return this.configurationService.updateValue(key, value, overrides, configurationTarget, { donotNotifyError: true });
  }
  deriveConfigurationTarget(key, overrides) {
    if (overrides.resource && this._workspaceContextService.getWorkbenchState() === WorkbenchState.WORKSPACE) {
      const configurationProperties = Registry.as(ConfigurationExtensions.Configuration).getConfigurationProperties();
      if (configurationProperties[key] && (configurationProperties[key].scope === ConfigurationScope.RESOURCE || configurationProperties[key].scope === ConfigurationScope.LANGUAGE_OVERRIDABLE)) {
        return ConfigurationTarget.WORKSPACE_FOLDER;
      }
    }
    return ConfigurationTarget.WORKSPACE;
  }
};
MainThreadConfiguration = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadConfiguration),
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IEnvironmentService)
], MainThreadConfiguration);
export {
  MainThreadConfiguration
};
