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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IAuthenticationService } from "../common/authentication.js";
const IAuthenticationMcpUsageService = createDecorator("IAuthenticationMcpUsageService");
let AuthenticationMcpUsageService = class extends Disposable {
  constructor(_storageService, _authenticationService, _logService, productService) {
    super();
    this._storageService = _storageService;
    this._authenticationService = _authenticationService;
    this._logService = _logService;
    this._queue = new Queue();
    this._mcpServersUsingAuth = /* @__PURE__ */ new Set();
    const trustedMcpAuthAccess = productService.trustedMcpAuthAccess;
    if (Array.isArray(trustedMcpAuthAccess)) {
      for (const mcpServerId of trustedMcpAuthAccess) {
        this._mcpServersUsingAuth.add(mcpServerId);
      }
    } else if (trustedMcpAuthAccess) {
      for (const mcpServers of Object.values(trustedMcpAuthAccess)) {
        for (const mcpServerId of mcpServers) {
          this._mcpServersUsingAuth.add(mcpServerId);
        }
      }
    }
    this._register(this._authenticationService.onDidRegisterAuthenticationProvider(
      (provider) => this._queue.queue(
        () => this._addToCache(provider.id)
      )
    ));
  }
  async initializeUsageCache() {
    await this._queue.queue(() => Promise.all(this._authenticationService.getProviderIds().map((providerId) => this._addToCache(providerId))));
  }
  async hasUsedAuth(mcpServerId) {
    await this._queue.whenIdle();
    return this._mcpServersUsingAuth.has(mcpServerId);
  }
  readAccountUsages(providerId, accountName) {
    const accountKey = `${providerId}-${accountName}-mcpserver-usages`;
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
    const accountKey = `${providerId}-${accountName}-mcpserver-usages`;
    this._storageService.remove(accountKey, StorageScope.APPLICATION);
  }
  addAccountUsage(providerId, accountName, scopes, mcpServerId, mcpServerName) {
    const accountKey = `${providerId}-${accountName}-mcpserver-usages`;
    const usages = this.readAccountUsages(providerId, accountName);
    const existingUsageIndex = usages.findIndex((usage) => usage.mcpServerId === mcpServerId);
    if (existingUsageIndex > -1) {
      usages.splice(existingUsageIndex, 1, {
        mcpServerId,
        mcpServerName,
        scopes,
        lastUsed: Date.now()
      });
    } else {
      usages.push({
        mcpServerId,
        mcpServerName,
        scopes,
        lastUsed: Date.now()
      });
    }
    this._storageService.store(accountKey, JSON.stringify(usages), StorageScope.APPLICATION, StorageTarget.MACHINE);
    this._mcpServersUsingAuth.add(mcpServerId);
  }
  async _addToCache(providerId) {
    try {
      const accounts = await this._authenticationService.getAccounts(providerId);
      for (const account of accounts) {
        const usage = this.readAccountUsages(providerId, account.label);
        for (const u of usage) {
          this._mcpServersUsingAuth.add(u.mcpServerId);
        }
      }
    } catch (e) {
      this._logService.error(e);
    }
  }
};
AuthenticationMcpUsageService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, IAuthenticationService),
  __decorateParam(2, ILogService),
  __decorateParam(3, IProductService)
], AuthenticationMcpUsageService);
registerSingleton(IAuthenticationMcpUsageService, AuthenticationMcpUsageService, InstantiationType.Delayed);
export {
  AuthenticationMcpUsageService,
  IAuthenticationMcpUsageService
};
