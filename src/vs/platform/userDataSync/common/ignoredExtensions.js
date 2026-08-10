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
import { distinct } from "../../../base/common/arrays.js";
import { ConfigurationTarget, IConfigurationService } from "../../configuration/common/configuration.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
const IIgnoredExtensionsManagementService = createDecorator("IIgnoredExtensionsManagementService");
let IgnoredExtensionsManagementService = class {
  constructor(configurationService) {
    this.configurationService = configurationService;
  }
  hasToNeverSyncExtension(extensionId) {
    const configuredIgnoredExtensions = this.getConfiguredIgnoredExtensions();
    return configuredIgnoredExtensions.includes(extensionId.toLowerCase());
  }
  hasToAlwaysSyncExtension(extensionId) {
    const configuredIgnoredExtensions = this.getConfiguredIgnoredExtensions();
    return configuredIgnoredExtensions.includes(`-${extensionId.toLowerCase()}`);
  }
  updateIgnoredExtensions(ignoredExtensionId, ignore) {
    let currentValue = [...this.configurationService.getValue("settingsSync.ignoredExtensions")].map((id) => id.toLowerCase());
    currentValue = currentValue.filter((v) => v !== ignoredExtensionId && v !== `-${ignoredExtensionId}`);
    if (ignore) {
      currentValue.push(ignoredExtensionId.toLowerCase());
    }
    return this.configurationService.updateValue("settingsSync.ignoredExtensions", currentValue.length ? currentValue : void 0, ConfigurationTarget.USER);
  }
  updateSynchronizedExtensions(extensionId, sync) {
    let currentValue = [...this.configurationService.getValue("settingsSync.ignoredExtensions")].map((id) => id.toLowerCase());
    currentValue = currentValue.filter((v) => v !== extensionId && v !== `-${extensionId}`);
    if (sync) {
      currentValue.push(`-${extensionId.toLowerCase()}`);
    }
    return this.configurationService.updateValue("settingsSync.ignoredExtensions", currentValue.length ? currentValue : void 0, ConfigurationTarget.USER);
  }
  getIgnoredExtensions(installed) {
    const defaultIgnoredExtensions = installed.filter((i) => i.isMachineScoped).map((i) => i.identifier.id.toLowerCase());
    const value = this.getConfiguredIgnoredExtensions().map((id) => id.toLowerCase());
    const added = [], removed = [];
    if (Array.isArray(value)) {
      for (const key of value) {
        if (key.startsWith("-")) {
          removed.push(key.substring(1));
        } else {
          added.push(key);
        }
      }
    }
    return distinct([...defaultIgnoredExtensions, ...added].filter((setting) => !removed.includes(setting)));
  }
  getConfiguredIgnoredExtensions() {
    return (this.configurationService.getValue("settingsSync.ignoredExtensions") || []).map((id) => id.toLowerCase());
  }
};
IgnoredExtensionsManagementService = __decorateClass([
  __decorateParam(0, IConfigurationService)
], IgnoredExtensionsManagementService);
export {
  IIgnoredExtensionsManagementService,
  IgnoredExtensionsManagementService
};
