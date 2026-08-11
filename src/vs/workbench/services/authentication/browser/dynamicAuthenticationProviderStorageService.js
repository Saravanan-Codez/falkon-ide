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
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IDynamicAuthenticationProviderStorageService } from "../common/dynamicAuthenticationProviderStorage.js";
import { ISecretStorageService } from "../../../../platform/secrets/common/secrets.js";
import { isAuthorizationTokenResponse } from "../../../../base/common/oauth.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Queue } from "../../../../base/common/async.js";
let DynamicAuthenticationProviderStorageService = class extends Disposable {
  constructor(storageService, secretStorageService, logService) {
    super();
    this.storageService = storageService;
    this.secretStorageService = secretStorageService;
    this.logService = logService;
    this._onDidChangeTokens = this._register(new Emitter());
    this.onDidChangeTokens = this._onDidChangeTokens.event;
    const queue = new Queue();
    this._register(this.secretStorageService.onDidChangeSecret(async (key) => {
      let payload;
      try {
        payload = JSON.parse(key);
      } catch (error) {
      }
      if (payload?.isDynamicAuthProvider) {
        void queue.queue(async () => {
          const tokens = await this.getSessionsForDynamicAuthProvider(payload.authProviderId, payload.clientId);
          this._onDidChangeTokens.fire({
            authProviderId: payload.authProviderId,
            clientId: payload.clientId,
            tokens
          });
        });
      }
    }));
  }
  static {
    this.PROVIDERS_STORAGE_KEY = "dynamicAuthProviders";
  }
  async getClientRegistration(providerId) {
    const key = `dynamicAuthProvider:clientRegistration:${providerId}`;
    const credentialsValue = await this.secretStorageService.get(key);
    if (credentialsValue) {
      try {
        const credentials = JSON.parse(credentialsValue);
        if (credentials && (credentials.clientId || credentials.clientSecret)) {
          return credentials;
        }
      } catch {
        await this.secretStorageService.delete(key);
      }
    }
    const providers = this._getStoredProviders();
    const provider = providers.find((p) => p.providerId === providerId);
    return provider?.clientId ? { clientId: provider.clientId } : void 0;
  }
  getClientId(providerId) {
    const providers = this._getStoredProviders();
    const provider = providers.find((p) => p.providerId === providerId);
    return provider?.clientId;
  }
  async storeClientRegistration(providerId, authorizationServer, clientId, clientSecret, label) {
    this._trackProvider(providerId, authorizationServer, clientId, label);
    const key = `dynamicAuthProvider:clientRegistration:${providerId}`;
    const credentials = { clientId, clientSecret };
    await this.secretStorageService.set(key, JSON.stringify(credentials));
  }
  _trackProvider(providerId, authorizationServer, clientId, label) {
    const providers = this._getStoredProviders();
    const existingProviderIndex = providers.findIndex((p) => p.providerId === providerId);
    if (existingProviderIndex === -1) {
      const newProvider = {
        providerId,
        label: label || providerId,
        // Use provided label or providerId as default
        authorizationServer,
        clientId
      };
      providers.push(newProvider);
      this._storeProviders(providers);
    } else {
      const existingProvider = providers[existingProviderIndex];
      const updatedProvider = {
        providerId,
        label: label || existingProvider.label,
        authorizationServer,
        clientId
      };
      providers[existingProviderIndex] = updatedProvider;
      this._storeProviders(providers);
    }
  }
  _getStoredProviders() {
    const stored = this.storageService.get(DynamicAuthenticationProviderStorageService.PROVIDERS_STORAGE_KEY, StorageScope.APPLICATION, "[]");
    try {
      const providerInfos = JSON.parse(stored);
      for (const providerInfo of providerInfos) {
        if (!providerInfo.authorizationServer) {
          providerInfo.authorizationServer = providerInfo.issuer;
        }
      }
      return providerInfos;
    } catch {
      return [];
    }
  }
  _storeProviders(providers) {
    this.storageService.store(
      DynamicAuthenticationProviderStorageService.PROVIDERS_STORAGE_KEY,
      JSON.stringify(providers),
      StorageScope.APPLICATION,
      StorageTarget.MACHINE
    );
  }
  getInteractedProviders() {
    return this._getStoredProviders();
  }
  async removeDynamicProvider(providerId) {
    const providers = this._getStoredProviders();
    const providerInfo = providers.find((p) => p.providerId === providerId);
    const filteredProviders = providers.filter((p) => p.providerId !== providerId);
    this._storeProviders(filteredProviders);
    if (providerInfo) {
      const secretKey = JSON.stringify({ isDynamicAuthProvider: true, authProviderId: providerId, clientId: providerInfo.clientId });
      await this.secretStorageService.delete(secretKey);
    }
    const credentialsKey = `dynamicAuthProvider:clientRegistration:${providerId}`;
    await this.secretStorageService.delete(credentialsKey);
  }
  async getSessionsForDynamicAuthProvider(authProviderId, clientId) {
    const key = JSON.stringify({ isDynamicAuthProvider: true, authProviderId, clientId });
    const value = await this.secretStorageService.get(key);
    if (value) {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed) || !parsed.every((t) => typeof t.created_at === "number" && isAuthorizationTokenResponse(t))) {
        this.logService.error(`Invalid session data for ${authProviderId} (${clientId}) in secret storage:`, parsed);
        await this.secretStorageService.delete(key);
        return void 0;
      }
      return parsed;
    }
    return void 0;
  }
  async setSessionsForDynamicAuthProvider(authProviderId, clientId, sessions) {
    const key = JSON.stringify({ isDynamicAuthProvider: true, authProviderId, clientId });
    const value = JSON.stringify(sessions);
    await this.secretStorageService.set(key, value);
    this.logService.trace(`Set session data for ${authProviderId} (${clientId}) in secret storage:`, sessions);
  }
};
DynamicAuthenticationProviderStorageService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, ISecretStorageService),
  __decorateParam(2, ILogService)
], DynamicAuthenticationProviderStorageService);
registerSingleton(IDynamicAuthenticationProviderStorageService, DynamicAuthenticationProviderStorageService, InstantiationType.Delayed);
export {
  DynamicAuthenticationProviderStorageService
};
