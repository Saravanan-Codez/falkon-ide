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
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
function urlsEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (a === void 0 || b === void 0) {
    return false;
  }
  try {
    return new URL(a).toString() === new URL(b).toString();
  } catch {
    return false;
  }
}
const IAuthenticationMcpAccessService = createDecorator("IAuthenticationMcpAccessService");
let AuthenticationMcpAccessService = class extends Disposable {
  constructor(_storageService, _productService) {
    super();
    this._storageService = _storageService;
    this._productService = _productService;
    this._onDidChangeMcpSessionAccess = this._register(new Emitter());
    this.onDidChangeMcpSessionAccess = this._onDidChangeMcpSessionAccess.event;
  }
  isAccessAllowed(providerId, accountName, mcpServerId) {
    return this._isAccessAllowed(providerId, accountName, mcpServerId, void 0);
  }
  isAccessAllowedForUrl(providerId, accountName, mcpServerId, mcpServerUrl) {
    return this._isAccessAllowed(providerId, accountName, mcpServerId, mcpServerUrl);
  }
  _isAccessAllowed(providerId, accountName, mcpServerId, mcpServerUrl) {
    const trustedMCPServerAuthAccess = this._productService.trustedMcpAuthAccess;
    if (Array.isArray(trustedMCPServerAuthAccess)) {
      if (trustedMCPServerAuthAccess.includes(mcpServerId)) {
        return true;
      }
    } else if (trustedMCPServerAuthAccess?.[providerId]?.includes(mcpServerId)) {
      return true;
    }
    const allowList = this.readAllowedMcpServers(providerId, accountName);
    const mcpServerData = allowList.find((mcpServer) => mcpServer.id === mcpServerId);
    if (!mcpServerData) {
      return void 0;
    }
    if (mcpServerUrl !== void 0 && !urlsEqual(mcpServerData.url, mcpServerUrl)) {
      return void 0;
    }
    return mcpServerData.allowed !== void 0 ? mcpServerData.allowed : true;
  }
  readAllowedMcpServers(providerId, accountName) {
    let trustedMCPServers = [];
    try {
      const trustedMCPServerSrc = this._storageService.get(`mcpserver-${providerId}-${accountName}`, StorageScope.APPLICATION);
      if (trustedMCPServerSrc) {
        trustedMCPServers = JSON.parse(trustedMCPServerSrc);
      }
    } catch (err) {
    }
    const trustedMcpServerAuthAccess = this._productService.trustedMcpAuthAccess;
    const trustedMcpServerIds = (
      // Case 1: trustedMcpServerAuthAccess is an array
      Array.isArray(trustedMcpServerAuthAccess) ? trustedMcpServerAuthAccess : typeof trustedMcpServerAuthAccess === "object" ? trustedMcpServerAuthAccess[providerId] ?? [] : []
    );
    for (const mcpServerId of trustedMcpServerIds) {
      const existingServer = trustedMCPServers.find((server) => server.id === mcpServerId);
      if (!existingServer) {
        trustedMCPServers.push({
          id: mcpServerId,
          name: mcpServerId,
          // Default to ID, caller can update with proper name
          allowed: true,
          trusted: true
        });
      } else {
        existingServer.allowed = true;
        existingServer.trusted = true;
      }
    }
    return trustedMCPServers;
  }
  updateAllowedMcpServers(providerId, accountName, mcpServers) {
    const allowList = this.readAllowedMcpServers(providerId, accountName);
    for (const mcpServer of mcpServers) {
      const index = allowList.findIndex((e) => e.id === mcpServer.id);
      if (index === -1) {
        allowList.push(mcpServer);
      } else {
        allowList[index].allowed = mcpServer.allowed;
        if (mcpServer.name && mcpServer.name !== mcpServer.id && allowList[index].name !== mcpServer.name) {
          allowList[index].name = mcpServer.name;
        }
        if (mcpServer.url !== void 0) {
          allowList[index].url = mcpServer.url;
        }
        if (mcpServer.agentHost !== void 0) {
          allowList[index].agentHost = mcpServer.agentHost;
        }
      }
    }
    const userManagedServers = allowList.filter((server) => !server.trusted);
    this._storageService.store(`mcpserver-${providerId}-${accountName}`, JSON.stringify(userManagedServers), StorageScope.APPLICATION, StorageTarget.USER);
    this._onDidChangeMcpSessionAccess.fire({ providerId, accountName });
  }
  removeAllowedMcpServers(providerId, accountName) {
    this._storageService.remove(`mcpserver-${providerId}-${accountName}`, StorageScope.APPLICATION);
    this._onDidChangeMcpSessionAccess.fire({ providerId, accountName });
  }
};
AuthenticationMcpAccessService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, IProductService)
], AuthenticationMcpAccessService);
registerSingleton(IAuthenticationMcpAccessService, AuthenticationMcpAccessService, InstantiationType.Delayed);
export {
  AuthenticationMcpAccessService,
  IAuthenticationMcpAccessService,
  urlsEqual
};
