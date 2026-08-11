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
import { Emitter, Event } from "../../../../base/common/event.js";
import { Disposable, DisposableMap, DisposableStore, isDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { equalsIgnoreCase, isFalsyOrWhitespace } from "../../../../base/common/strings.js";
import { isString } from "../../../../base/common/types.js";
import { localize } from "../../../../nls.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IAuthenticationAccessService } from "./authenticationAccessService.js";
import { IAuthenticationService, isAuthenticationWwwAuthenticateRequest } from "../common/authentication.js";
import { IBrowserWorkbenchEnvironmentService } from "../../environment/browser/environmentService.js";
import { ActivationKind, IExtensionService } from "../../extensions/common/extensions.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { ExtensionsRegistry } from "../../extensions/common/extensionsRegistry.js";
import { match } from "../../../../base/common/glob.js";
import { parseWWWAuthenticateHeader } from "../../../../base/common/oauth.js";
import { raceCancellation, raceTimeout } from "../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
function getAuthenticationProviderActivationEvent(id) {
  return `onAuthenticationRequest:${id}`;
}
async function getCurrentAuthenticationSessionInfo(secretStorageService, productService) {
  const authenticationSessionValue = await secretStorageService.get(`${productService.urlProtocol}.loginAccount`);
  if (authenticationSessionValue) {
    try {
      const authenticationSessionInfo = JSON.parse(authenticationSessionValue);
      if (authenticationSessionInfo && isString(authenticationSessionInfo.id) && isString(authenticationSessionInfo.accessToken) && isString(authenticationSessionInfo.providerId)) {
        return authenticationSessionInfo;
      }
    } catch (e) {
      console.error(`Failed parsing current auth session value: ${e}`);
    }
  }
  return void 0;
}
const authenticationDefinitionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: {
      type: "string",
      description: localize("authentication.id", "The id of the authentication provider.")
    },
    label: {
      type: "string",
      description: localize("authentication.label", "The human readable name of the authentication provider.")
    },
    authorizationServerGlobs: {
      type: "array",
      items: {
        type: "string",
        description: localize("authentication.authorizationServerGlobs", "A list of globs that match the authorization servers that this provider supports.")
      },
      description: localize("authentication.authorizationServerGlobsDescription", "A list of globs that match the authorization servers that this provider supports.")
    }
  }
};
const authenticationExtPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "authentication",
  jsonSchema: {
    description: localize({ key: "authenticationExtensionPoint", comment: [`'Contributes' means adds here`] }, "Contributes authentication"),
    type: "array",
    items: authenticationDefinitionSchema
  },
  activationEventsGenerator: function* (authenticationProviders) {
    for (const authenticationProvider of authenticationProviders) {
      if (authenticationProvider.id) {
        yield `onAuthenticationRequest:${authenticationProvider.id}`;
      }
    }
  }
});
let AuthenticationService = class extends Disposable {
  constructor(_extensionService, authenticationAccessService, _environmentService, _logService) {
    super();
    this._extensionService = _extensionService;
    this._environmentService = _environmentService;
    this._logService = _logService;
    this._onDidRegisterAuthenticationProvider = this._register(new Emitter());
    this.onDidRegisterAuthenticationProvider = this._onDidRegisterAuthenticationProvider.event;
    this._onDidUnregisterAuthenticationProvider = this._register(new Emitter());
    this.onDidUnregisterAuthenticationProvider = this._onDidUnregisterAuthenticationProvider.event;
    this._onDidChangeSessions = this._register(new Emitter());
    this.onDidChangeSessions = this._onDidChangeSessions.event;
    this._onDidChangeDeclaredProviders = this._register(new Emitter());
    this.onDidChangeDeclaredProviders = this._onDidChangeDeclaredProviders.event;
    this._authenticationProviders = /* @__PURE__ */ new Map();
    this._authenticationProviderDisposables = this._register(new DisposableMap());
    this._dynamicAuthenticationProviderIds = /* @__PURE__ */ new Set();
    this._delegates = [];
    this._disposedSource = new CancellationTokenSource();
    this._declaredProviders = [];
    this._register(toDisposable(() => this._disposedSource.dispose(true)));
    this._register(authenticationAccessService.onDidChangeExtensionSessionAccess((e) => {
      this._onDidChangeSessions.fire({
        providerId: e.providerId,
        label: e.accountName,
        event: {
          added: [],
          changed: [],
          removed: []
        }
      });
    }));
    this._registerEnvContributedAuthenticationProviders();
    this._registerAuthenticationExtensionPointHandler();
  }
  get declaredProviders() {
    return this._declaredProviders;
  }
  _registerEnvContributedAuthenticationProviders() {
    if (!this._environmentService.options?.authenticationProviders?.length) {
      return;
    }
    for (const provider of this._environmentService.options.authenticationProviders) {
      this.registerDeclaredAuthenticationProvider(provider);
      this.registerAuthenticationProvider(provider.id, provider);
    }
  }
  _registerAuthenticationExtensionPointHandler() {
    this._register(authenticationExtPoint.setHandler((_extensions, { added, removed }) => {
      this._logService.debug(`Found authentication providers. added: ${added.length}, removed: ${removed.length}`);
      added.forEach((point) => {
        for (const provider of point.value) {
          if (isFalsyOrWhitespace(provider.id)) {
            point.collector.error(localize("authentication.missingId", "An authentication contribution must specify an id."));
            continue;
          }
          if (isFalsyOrWhitespace(provider.label)) {
            point.collector.error(localize("authentication.missingLabel", "An authentication contribution must specify a label."));
            continue;
          }
          if (!this.declaredProviders.some((p) => p.id === provider.id)) {
            this.registerDeclaredAuthenticationProvider(provider);
            this._logService.debug(`Declared authentication provider: ${provider.id}`);
          } else {
            point.collector.error(localize("authentication.idConflict", "This authentication id '{0}' has already been registered", provider.id));
          }
        }
      });
      const removedExtPoints = removed.flatMap((r) => r.value);
      removedExtPoints.forEach((point) => {
        const provider = this.declaredProviders.find((provider2) => provider2.id === point.id);
        if (provider) {
          this.unregisterDeclaredAuthenticationProvider(provider.id);
          this._logService.debug(`Undeclared authentication provider: ${provider.id}`);
        }
      });
    }));
  }
  registerDeclaredAuthenticationProvider(provider) {
    if (isFalsyOrWhitespace(provider.id)) {
      throw new Error(localize("authentication.missingId", "An authentication contribution must specify an id."));
    }
    if (isFalsyOrWhitespace(provider.label)) {
      throw new Error(localize("authentication.missingLabel", "An authentication contribution must specify a label."));
    }
    if (this.declaredProviders.some((p) => p.id === provider.id)) {
      throw new Error(localize("authentication.idConflict", "This authentication id '{0}' has already been registered", provider.id));
    }
    this._declaredProviders.push(provider);
    this._onDidChangeDeclaredProviders.fire();
  }
  unregisterDeclaredAuthenticationProvider(id) {
    const index = this.declaredProviders.findIndex((provider) => provider.id === id);
    if (index > -1) {
      this.declaredProviders.splice(index, 1);
    }
    this._onDidChangeDeclaredProviders.fire();
  }
  isAuthenticationProviderRegistered(id) {
    return this._authenticationProviders.has(id);
  }
  isDynamicAuthenticationProvider(id) {
    return this._dynamicAuthenticationProviderIds.has(id);
  }
  registerAuthenticationProvider(id, authenticationProvider) {
    this._authenticationProviders.set(id, authenticationProvider);
    const disposableStore = new DisposableStore();
    disposableStore.add(authenticationProvider.onDidChangeSessions((e) => this._onDidChangeSessions.fire({
      providerId: id,
      label: authenticationProvider.label,
      event: e
    })));
    if (isDisposable(authenticationProvider)) {
      disposableStore.add(authenticationProvider);
    }
    this._authenticationProviderDisposables.set(id, disposableStore);
    this._onDidRegisterAuthenticationProvider.fire({ id, label: authenticationProvider.label });
  }
  unregisterAuthenticationProvider(id) {
    const provider = this._authenticationProviders.get(id);
    if (provider) {
      this._authenticationProviders.delete(id);
      this._dynamicAuthenticationProviderIds.delete(id);
      this._onDidUnregisterAuthenticationProvider.fire({ id, label: provider.label });
    }
    this._authenticationProviderDisposables.deleteAndDispose(id);
  }
  getProviderIds() {
    const providerIds = [];
    this._authenticationProviders.forEach((provider) => {
      providerIds.push(provider.id);
    });
    return providerIds;
  }
  getProvider(id) {
    if (this._authenticationProviders.has(id)) {
      return this._authenticationProviders.get(id);
    }
    throw new Error(`No authentication provider '${id}' is currently registered.`);
  }
  async getAccounts(id) {
    const sessions = await this.getSessions(id);
    const accounts = new Array();
    const seenAccounts = /* @__PURE__ */ new Set();
    for (const session of sessions) {
      if (!seenAccounts.has(session.account.label)) {
        seenAccounts.add(session.account.label);
        accounts.push(session.account);
      }
    }
    return accounts;
  }
  async getSessions(id, scopeListOrRequest, options, activateImmediate = false) {
    if (this._disposedSource.token.isCancellationRequested) {
      return [];
    }
    const authProvider = this._authenticationProviders.get(id) || await this.tryActivateProvider(id, activateImmediate);
    if (authProvider) {
      const server = options?.authorizationServer;
      if (server) {
        if (!this.matchesProvider(authProvider, server)) {
          throw new Error(`The authentication provider '${id}' does not support the authorization server '${server.toString(true)}'.`);
        }
      }
      if (isAuthenticationWwwAuthenticateRequest(scopeListOrRequest)) {
        if (!authProvider.getSessionsFromChallenges) {
          throw new Error(`The authentication provider '${id}' does not support getting sessions from challenges.`);
        }
        return await authProvider.getSessionsFromChallenges(
          { challenges: parseWWWAuthenticateHeader(scopeListOrRequest.wwwAuthenticate), fallbackScopes: scopeListOrRequest.fallbackScopes },
          { ...options }
        );
      }
      return await authProvider.getSessions(scopeListOrRequest ? [...scopeListOrRequest] : void 0, { ...options });
    } else {
      throw new Error(`No authentication provider '${id}' is currently registered.`);
    }
  }
  async createSession(id, scopeListOrRequest, options) {
    if (this._disposedSource.token.isCancellationRequested) {
      throw new Error("Authentication service is disposed.");
    }
    const authProvider = this._authenticationProviders.get(id) || await this.tryActivateProvider(id, !!options?.activateImmediate);
    if (authProvider) {
      if (isAuthenticationWwwAuthenticateRequest(scopeListOrRequest)) {
        if (!authProvider.createSessionFromChallenges) {
          throw new Error(`The authentication provider '${id}' does not support creating sessions from challenges.`);
        }
        return await authProvider.createSessionFromChallenges(
          { challenges: parseWWWAuthenticateHeader(scopeListOrRequest.wwwAuthenticate), fallbackScopes: scopeListOrRequest.fallbackScopes },
          { ...options }
        );
      }
      return await authProvider.createSession([...scopeListOrRequest], { ...options });
    } else {
      throw new Error(`No authentication provider '${id}' is currently registered.`);
    }
  }
  async removeSession(id, sessionId) {
    if (this._disposedSource.token.isCancellationRequested) {
      throw new Error("Authentication service is disposed.");
    }
    const authProvider = this._authenticationProviders.get(id);
    if (authProvider) {
      return authProvider.removeSession(sessionId);
    } else {
      throw new Error(`No authentication provider '${id}' is currently registered.`);
    }
  }
  async getOrActivateProviderIdForServer(authorizationServer, resourceServer) {
    for (const provider of this._authenticationProviders.values()) {
      if (this.matchesProvider(provider, authorizationServer, resourceServer)) {
        return provider.id;
      }
    }
    const authServerStr = authorizationServer.toString(true);
    const providers = this._declaredProviders.filter((p) => !this._authenticationProviders.has(p.id)).filter((p) => !!p.authorizationServerGlobs?.some((i) => match(i, authServerStr, { ignoreCase: true })));
    for (const provider of providers) {
      const activeProvider = await this.tryActivateProvider(provider.id, true);
      if (this.matchesProvider(activeProvider, authorizationServer, resourceServer)) {
        return activeProvider.id;
      }
    }
    return void 0;
  }
  async createDynamicAuthenticationProvider(authorizationServer, serverMetadata, resource, clientId, clientSecret) {
    const delegate = this._delegates[0];
    if (!delegate) {
      this._logService.error("No authentication provider host delegate found");
      return void 0;
    }
    const providerId = await delegate.create(authorizationServer, serverMetadata, resource, clientId, clientSecret);
    const provider = this._authenticationProviders.get(providerId);
    if (provider) {
      this._logService.debug(`Created dynamic authentication provider: ${providerId}`);
      this._dynamicAuthenticationProviderIds.add(providerId);
      return provider;
    }
    this._logService.error(`Failed to create dynamic authentication provider: ${providerId}`);
    return void 0;
  }
  async createOrGetXaaProvider(issuer) {
    const providerId = `xaa:${issuer.toString(true)}`;
    if (this._authenticationProviders.has(providerId)) {
      return providerId;
    }
    const delegate = this._delegates.find((d) => !!d.createXaa);
    if (!delegate) {
      this._logService.error("No authentication provider host delegate supports XAA");
      return void 0;
    }
    const created = await delegate.createXaa(issuer);
    if (this._authenticationProviders.has(created)) {
      this._logService.debug(`Created XAA authentication provider: ${created}`);
      return created;
    }
    this._logService.error(`Failed to create XAA authentication provider for issuer: ${issuer.toString(true)}`);
    return void 0;
  }
  registerAuthenticationProviderHostDelegate(delegate) {
    this._delegates.push(delegate);
    this._delegates.sort((a, b) => b.priority - a.priority);
    return {
      dispose: () => {
        const index = this._delegates.indexOf(delegate);
        if (index !== -1) {
          this._delegates.splice(index, 1);
        }
      }
    };
  }
  matchesProvider(provider, authorizationServer, resourceServer) {
    if (resourceServer && provider.resourceServer) {
      const resourceServerStr = resourceServer.toString(true);
      const providerResourceServerStr = provider.resourceServer.toString(true);
      if (!equalsIgnoreCase(providerResourceServerStr, resourceServerStr)) {
        return false;
      }
    }
    if (provider.authorizationServers) {
      const authServerStr = authorizationServer.toString(true);
      for (const server of provider.authorizationServers) {
        const str = server.toString(true);
        if (equalsIgnoreCase(str, authServerStr) || match(str, authServerStr, { ignoreCase: true })) {
          return true;
        }
      }
    }
    return false;
  }
  async tryActivateProvider(providerId, activateImmediate) {
    const store = new DisposableStore();
    try {
      const activationPromise = this._extensionService.activateByEvent(
        getAuthenticationProviderActivationEvent(providerId),
        activateImmediate ? ActivationKind.Immediate : ActivationKind.Normal
      );
      let provider = this._authenticationProviders.get(providerId);
      if (provider) {
        return provider;
      }
      if (this._disposedSource.token.isCancellationRequested) {
        throw new Error("Authentication service is disposed.");
      }
      const providerRegistered = raceCancellation(
        Event.toPromise(
          Event.filter(
            this.onDidRegisterAuthenticationProvider,
            (e) => e.id === providerId,
            store
          ),
          store
        ),
        this._disposedSource.token
      );
      await Promise.race([activationPromise, providerRegistered]);
      provider = this._authenticationProviders.get(providerId);
      if (provider) {
        return provider;
      }
      const result = await raceTimeout(providerRegistered, 5e3);
      provider = this._authenticationProviders.get(providerId);
      if (provider) {
        return provider;
      }
      if (!result) {
        throw new Error(`Timed out waiting for authentication provider '${providerId}' to register.`);
      }
      throw new Error(`No authentication provider '${providerId}' is currently registered.`);
    } finally {
      store.dispose();
    }
  }
};
AuthenticationService = __decorateClass([
  __decorateParam(0, IExtensionService),
  __decorateParam(1, IAuthenticationAccessService),
  __decorateParam(2, IBrowserWorkbenchEnvironmentService),
  __decorateParam(3, ILogService)
], AuthenticationService);
registerSingleton(IAuthenticationService, AuthenticationService, InstantiationType.Delayed);
export {
  AuthenticationService,
  getAuthenticationProviderActivationEvent,
  getCurrentAuthenticationSessionInfo
};
