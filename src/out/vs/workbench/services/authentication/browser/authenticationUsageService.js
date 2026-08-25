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
import { Queue } from "../../../../base/common/async.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IAuthenticationService } from "../common/authentication.js";
const IAuthenticationUsageService = createDecorator("IAuthenticationUsageService");
let AuthenticationUsageService = class extends Disposable {
  constructor(_storageService, _authenticationService, _logService, productService) {
    super();
    this._storageService = _storageService;
    this._authenticationService = _authenticationService;
    this._logService = _logService;
    this._queue = this._register(new Queue());
    this._extensionsUsingAuth = /* @__PURE__ */ new Set();
    this._disposed = false;
    this._register(toDisposable(() => this._disposed = true));
    const trustedExtensionAuthAccess = productService.trustedExtensionAuthAccess;
    if (Array.isArray(trustedExtensionAuthAccess)) {
      for (const extensionId of trustedExtensionAuthAccess) {
        this._extensionsUsingAuth.add(extensionId);
      }
    } else if (trustedExtensionAuthAccess) {
      for (const extensions of Object.values(trustedExtensionAuthAccess)) {
        for (const extensionId of extensions) {
          this._extensionsUsingAuth.add(extensionId);
        }
      }
    }
    this._register(this._authenticationService.onDidRegisterAuthenticationProvider(
      (provider) => this._queue.queue(
        () => this._addExtensionsToCache(provider.id)
      )
    ));
  }
  async initializeExtensionUsageCache() {
    await this._queue.queue(() => Promise.all(this._authenticationService.getProviderIds().map((providerId) => this._addExtensionsToCache(providerId))));
  }
  async extensionUsesAuth(extensionId) {
    await this._queue.whenIdle();
    return this._extensionsUsingAuth.has(extensionId);
  }
  readAccountUsages(providerId, accountName) {
    const accountKey = `${providerId}-${accountName}-usages`;
    const storedUsages = this._storageService.get(accountKey, StorageScope.APPLICATION);
    let usages = [];
    if (storedUsages) {
      try {
        usages = JSON.parse(storedUsages);
      } catch (e) {
      }
    }
    return usages;
  }
  removeAccountUsage(providerId, accountName) {
    const accountKey = `${providerId}-${accountName}-usages`;
    this._storageService.remove(accountKey, StorageScope.APPLICATION);
  }
  addAccountUsage(providerId, accountName, scopes, extensionId, extensionName) {
    const accountKey = `${providerId}-${accountName}-usages`;
    const usages = this.readAccountUsages(providerId, accountName);
    const existingUsageIndex = usages.findIndex((usage) => usage.extensionId === extensionId);
    if (existingUsageIndex > -1) {
      usages.splice(existingUsageIndex, 1, {
        extensionId,
        extensionName,
        scopes,
        lastUsed: Date.now()
      });
    } else {
      usages.push({
        extensionId,
        extensionName,
        scopes,
        lastUsed: Date.now()
      });
    }
    this._storageService.store(accountKey, JSON.stringify(usages), StorageScope.APPLICATION, StorageTarget.MACHINE);
    this._extensionsUsingAuth.add(extensionId);
  }
  async _addExtensionsToCache(providerId) {
    if (this._disposed) {
      return;
    }
    try {
      const accounts = await this._authenticationService.getAccounts(providerId);
      for (const account of accounts) {
        const usage = this.readAccountUsages(providerId, account.label);
        for (const u of usage) {
          this._extensionsUsingAuth.add(u.extensionId);
        }
      }
    } catch (e) {
      this._logService.error(e);
    }
  }
};
AuthenticationUsageService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, IAuthenticationService),
  __decorateParam(2, ILogService),
  __decorateParam(3, IProductService)
], AuthenticationUsageService);
registerSingleton(IAuthenticationUsageService, AuthenticationUsageService, InstantiationType.Delayed);
export {
  AuthenticationUsageService,
  IAuthenticationUsageService
};
