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
import { Disposable } from "../../../base/common/lifecycle.js";
import * as nls from "../../../nls.js";
import { AllowedExtensionsConfigKey } from "./extensionManagement.js";
import { ExtensionType, TargetPlatform } from "../../extensions/common/extensions.js";
import { IProductService } from "../../product/common/productService.js";
import { createCommandUri, MarkdownString } from "../../../base/common/htmlContent.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { isBoolean, isObject, isUndefined } from "../../../base/common/types.js";
import { Emitter } from "../../../base/common/event.js";
function isGalleryExtension(extension) {
  return extension.type === "gallery";
}
function isIExtension(extension) {
  return extension.type === ExtensionType.User || extension.type === ExtensionType.System;
}
const VersionRegex = /^(?<version>\d+\.\d+\.\d+(-.*)?)(@(?<platform>.+))?$/;
let AllowedExtensionsService = class extends Disposable {
  constructor(productService, configurationService) {
    super();
    this.configurationService = configurationService;
    this._onDidChangeAllowedExtensions = this._register(new Emitter());
    this.onDidChangeAllowedExtensionsConfigValue = this._onDidChangeAllowedExtensions.event;
    this.publisherOrgs = productService.extensionPublisherOrgs?.map((p) => p.toLowerCase()) ?? [];
    this._allowedExtensionsConfigValue = this.getAllowedExtensionsValue();
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(AllowedExtensionsConfigKey)) {
        this._allowedExtensionsConfigValue = this.getAllowedExtensionsValue();
        this._onDidChangeAllowedExtensions.fire();
      }
    }));
  }
  get allowedExtensionsConfigValue() {
    return this._allowedExtensionsConfigValue;
  }
  getAllowedExtensionsValue() {
    const value = this.configurationService.getValue(AllowedExtensionsConfigKey);
    if (!isObject(value) || Array.isArray(value)) {
      return void 0;
    }
    const entries = Object.entries(value).map(([key, value2]) => [key.toLowerCase(), value2]);
    if (entries.length === 1 && entries[0][0] === "*" && entries[0][1] === true) {
      return void 0;
    }
    return Object.fromEntries(entries);
  }
  isAllowed(extension) {
    if (!this._allowedExtensionsConfigValue) {
      return true;
    }
    let id, version, targetPlatform, prerelease, publisher, publisherDisplayName;
    if (isGalleryExtension(extension)) {
      id = extension.identifier.id.toLowerCase();
      version = extension.version;
      prerelease = extension.properties.isPreReleaseVersion;
      publisher = extension.publisher.toLowerCase();
      publisherDisplayName = extension.publisherDisplayName.toLowerCase();
      targetPlatform = extension.properties.targetPlatform;
    } else if (isIExtension(extension)) {
      id = extension.identifier.id.toLowerCase();
      version = extension.manifest.version;
      prerelease = extension.preRelease;
      publisher = extension.manifest.publisher.toLowerCase();
      publisherDisplayName = extension.publisherDisplayName?.toLowerCase();
      targetPlatform = extension.targetPlatform;
    } else {
      id = extension.id.toLowerCase();
      version = extension.version ?? "*";
      targetPlatform = extension.targetPlatform ?? TargetPlatform.UNIVERSAL;
      prerelease = extension.prerelease ?? false;
      publisher = extension.id.substring(0, extension.id.indexOf(".")).toLowerCase();
      publisherDisplayName = extension.publisherDisplayName?.toLowerCase();
    }
    const settingsCommandLink = createCommandUri("workbench.action.openSettings", { query: `@id:${AllowedExtensionsConfigKey}` }).toString();
    const extensionValue = this._allowedExtensionsConfigValue[id];
    const extensionReason = new MarkdownString(nls.localize("specific extension not allowed", "it is not in the [allowed list]({0})", settingsCommandLink));
    if (!isUndefined(extensionValue)) {
      if (isBoolean(extensionValue)) {
        return extensionValue ? true : extensionReason;
      }
      if (extensionValue === "stable" && prerelease) {
        return new MarkdownString(nls.localize("extension prerelease not allowed", "the pre-release versions of this extension are not in the [allowed list]({0})", settingsCommandLink));
      }
      if (version !== "*" && Array.isArray(extensionValue) && !extensionValue.some((v) => {
        const match = VersionRegex.exec(v);
        if (match && match.groups) {
          const { platform: p, version: v2 } = match.groups;
          if (v2 !== version) {
            return false;
          }
          if (targetPlatform !== TargetPlatform.UNIVERSAL && p && targetPlatform !== p) {
            return false;
          }
          return true;
        }
        return false;
      })) {
        return new MarkdownString(nls.localize("specific version of extension not allowed", "the version {0} of this extension is not in the [allowed list]({1})", version, settingsCommandLink));
      }
      return true;
    }
    const publisherKey = publisherDisplayName && this.publisherOrgs.includes(publisherDisplayName) ? publisherDisplayName : publisher;
    const publisherValue = this._allowedExtensionsConfigValue[publisherKey];
    if (!isUndefined(publisherValue)) {
      if (isBoolean(publisherValue)) {
        return publisherValue ? true : new MarkdownString(nls.localize("publisher not allowed", "the extensions from this publisher are not in the [allowed list]({1})", publisherKey, settingsCommandLink));
      }
      if (publisherValue === "stable" && prerelease) {
        return new MarkdownString(nls.localize("prerelease versions from this publisher not allowed", "the pre-release versions from this publisher are not in the [allowed list]({1})", publisherKey, settingsCommandLink));
      }
      return true;
    }
    if (this._allowedExtensionsConfigValue["*"] === true) {
      return true;
    }
    return extensionReason;
  }
};
AllowedExtensionsService = __decorateClass([
  __decorateParam(0, IProductService),
  __decorateParam(1, IConfigurationService)
], AllowedExtensionsService);
export {
  AllowedExtensionsService
};
