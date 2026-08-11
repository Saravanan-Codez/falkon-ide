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
import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { Position } from "../core/position.js";
import { ILanguageService } from "../languages/language.js";
import { IModelService } from "./model.js";
import { IConfigurationService, ConfigurationTarget } from "../../../platform/configuration/common/configuration.js";
let TextResourceConfigurationService = class extends Disposable {
  constructor(configurationService, modelService, languageService) {
    super();
    this.configurationService = configurationService;
    this.modelService = modelService;
    this.languageService = languageService;
    this._onDidChangeConfiguration = this._register(new Emitter());
    this.onDidChangeConfiguration = this._onDidChangeConfiguration.event;
    this._register(this.configurationService.onDidChangeConfiguration((e) => this._onDidChangeConfiguration.fire(this.toResourceConfigurationChangeEvent(e))));
  }
  getValue(resource, arg2, arg3) {
    if (typeof arg3 === "string") {
      return this._getValue(resource, Position.isIPosition(arg2) ? arg2 : null, arg3);
    }
    return this._getValue(resource, null, typeof arg2 === "string" ? arg2 : void 0);
  }
  updateValue(resource, key, value, configurationTarget) {
    const language = resource ? this.getLanguage(resource, null) : null;
    const configurationValue = this.configurationService.inspect(key, { resource, overrideIdentifier: language });
    if (configurationTarget === void 0) {
      configurationTarget = this.deriveConfigurationTarget(configurationValue, language);
    }
    const overrideIdentifier = language && configurationValue.overrideIdentifiers?.includes(language) ? language : void 0;
    return this.configurationService.updateValue(key, value, { resource, overrideIdentifier }, configurationTarget);
  }
  deriveConfigurationTarget(configurationValue, language) {
    if (language) {
      if (configurationValue.memory?.override !== void 0) {
        return ConfigurationTarget.MEMORY;
      }
      if (configurationValue.workspaceFolder?.override !== void 0) {
        return ConfigurationTarget.WORKSPACE_FOLDER;
      }
      if (configurationValue.workspace?.override !== void 0) {
        return ConfigurationTarget.WORKSPACE;
      }
      if (configurationValue.userRemote?.override !== void 0) {
        return ConfigurationTarget.USER_REMOTE;
      }
      if (configurationValue.userLocal?.override !== void 0) {
        return ConfigurationTarget.USER_LOCAL;
      }
    }
    if (configurationValue.memory?.value !== void 0) {
      return ConfigurationTarget.MEMORY;
    }
    if (configurationValue.workspaceFolder?.value !== void 0) {
      return ConfigurationTarget.WORKSPACE_FOLDER;
    }
    if (configurationValue.workspace?.value !== void 0) {
      return ConfigurationTarget.WORKSPACE;
    }
    if (configurationValue.userRemote?.value !== void 0) {
      return ConfigurationTarget.USER_REMOTE;
    }
    return ConfigurationTarget.USER_LOCAL;
  }
  _getValue(resource, position, section) {
    const language = resource ? this.getLanguage(resource, position) : void 0;
    if (typeof section === "undefined") {
      return this.configurationService.getValue({ resource, overrideIdentifier: language });
    }
    return this.configurationService.getValue(section, { resource, overrideIdentifier: language });
  }
  inspect(resource, position, section) {
    const language = resource ? this.getLanguage(resource, position) : void 0;
    return this.configurationService.inspect(section, { resource, overrideIdentifier: language });
  }
  getLanguage(resource, position) {
    const model = this.modelService.getModel(resource);
    if (model) {
      return position ? model.getLanguageIdAtPosition(position.lineNumber, position.column) : model.getLanguageId();
    }
    return this.languageService.guessLanguageIdByFilepathOrFirstLine(resource);
  }
  toResourceConfigurationChangeEvent(configurationChangeEvent) {
    return {
      affectedKeys: configurationChangeEvent.affectedKeys,
      affectsConfiguration: (resource, configuration) => {
        const overrideIdentifier = resource ? this.getLanguage(resource, null) : void 0;
        if (configurationChangeEvent.affectsConfiguration(configuration, { resource, overrideIdentifier })) {
          return true;
        }
        if (overrideIdentifier) {
          return configurationChangeEvent.affectedKeys.has(`[${overrideIdentifier}]`);
        }
        return false;
      }
    };
  }
};
TextResourceConfigurationService = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IModelService),
  __decorateParam(2, ILanguageService)
], TextResourceConfigurationService);
export {
  TextResourceConfigurationService
};
