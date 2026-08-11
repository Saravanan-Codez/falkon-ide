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
import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ExtensionIdentifier } from "../../../../platform/extensions/common/extensions.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
const IAuthenticationAccessService = createDecorator("IAuthenticationAccessService");
let AuthenticationAccessService = class extends Disposable {
  constructor(_storageService, _productService) {
    super();
    this._storageService = _storageService;
    this._productService = _productService;
    this._onDidChangeExtensionSessionAccess = this._register(new Emitter());
    this.onDidChangeExtensionSessionAccess = this._onDidChangeExtensionSessionAccess.event;
  }
  isAccessAllowed(providerId, accountName, extensionId) {
    const trustedExtensionAuthAccess = this._productService.trustedExtensionAuthAccess;
    const extensionKey = ExtensionIdentifier.toKey(extensionId);
    if (Array.isArray(trustedExtensionAuthAccess)) {
      if (trustedExtensionAuthAccess.includes(extensionKey)) {
        return true;
      }
    } else if (trustedExtensionAuthAccess?.[providerId]?.includes(extensionKey)) {
      return true;
    }
    const allowList = this.readAllowedExtensions(providerId, accountName);
    const extensionData = allowList.find((extension) => extension.id === extensionKey);
    if (!extensionData) {
      return void 0;
    }
    return extensionData.allowed !== void 0 ? extensionData.allowed : true;
  }
  readAllowedExtensions(providerId, accountName) {
    let trustedExtensions = [];
    try {
      const trustedExtensionSrc = this._storageService.get(`${providerId}-${accountName}`, StorageScope.APPLICATION);
      if (trustedExtensionSrc) {
        trustedExtensions = JSON.parse(trustedExtensionSrc);
      }
    } catch (err) {
    }
    const trustedExtensionAuthAccess = this._productService.trustedExtensionAuthAccess;
    const trustedExtensionIds = (
      // Case 1: trustedExtensionAuthAccess is an array
      Array.isArray(trustedExtensionAuthAccess) ? trustedExtensionAuthAccess : typeof trustedExtensionAuthAccess === "object" ? trustedExtensionAuthAccess[providerId] ?? [] : []
    );
    for (const extensionId of trustedExtensionIds) {
      const extensionKey = ExtensionIdentifier.toKey(extensionId);
      const existingExtension = trustedExtensions.find((extension) => extension.id === extensionKey);
      if (!existingExtension) {
        trustedExtensions.push({
          id: extensionKey,
          name: extensionId,
          // Use original casing for display name
          allowed: true,
          trusted: true
        });
      } else {
        existingExtension.allowed = true;
        existingExtension.trusted = true;
      }
    }
    return trustedExtensions;
  }
  updateAllowedExtensions(providerId, accountName, extensions) {
    const allowList = this.readAllowedExtensions(providerId, accountName);
    for (const extension of extensions) {
      const extensionKey = ExtensionIdentifier.toKey(extension.id);
      const index = allowList.findIndex((e) => e.id === extensionKey);
      if (index === -1) {
        allowList.push({
          ...extension,
          id: extensionKey
        });
      } else {
        allowList[index].allowed = extension.allowed;
        if (extension.name && extension.name !== extensionKey && allowList[index].name !== extension.name) {
          allowList[index].name = extension.name;
        }
      }
    }
    const userManagedExtensions = allowList.filter((extension) => !extension.trusted);
    this._storageService.store(`${providerId}-${accountName}`, JSON.stringify(userManagedExtensions), StorageScope.APPLICATION, StorageTarget.USER);
    this._onDidChangeExtensionSessionAccess.fire({ providerId, accountName });
  }
  removeAllowedExtensions(providerId, accountName) {
    this._storageService.remove(`${providerId}-${accountName}`, StorageScope.APPLICATION);
    this._onDidChangeExtensionSessionAccess.fire({ providerId, accountName });
  }
};
AuthenticationAccessService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, IProductService)
], AuthenticationAccessService);
registerSingleton(IAuthenticationAccessService, AuthenticationAccessService, InstantiationType.Delayed);
export {
  AuthenticationAccessService,
  IAuthenticationAccessService
};
