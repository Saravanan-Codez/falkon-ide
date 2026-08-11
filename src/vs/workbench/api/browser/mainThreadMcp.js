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
import { mapFindFirst } from "../../../base/common/arraysFind.js";
import { disposableTimeout, RunOnceScheduler } from "../../../base/common/async.js";
import { CancellationError } from "../../../base/common/errors.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable, DisposableMap, DisposableStore, MutableDisposable } from "../../../base/common/lifecycle.js";
import { autorun, observableValue } from "../../../base/common/observable.js";
import Severity from "../../../base/common/severity.js";
import { URI } from "../../../base/common/uri.js";
import { generateUuid } from "../../../base/common/uuid.js";
import * as nls from "../../../nls.js";
import { ContextKeyExpr, IContextKeyService } from "../../../platform/contextkey/common/contextkey.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { IDialogService } from "../../../platform/dialogs/common/dialogs.js";
import { ExtensionIdentifier } from "../../../platform/extensions/common/extensions.js";
import { LogLevel } from "../../../platform/log/common/log.js";
import { ITelemetryService } from "../../../platform/telemetry/common/telemetry.js";
import { ISecretStorageService } from "../../../platform/secrets/common/secrets.js";
import { IWorkbenchMcpGatewayService } from "../../contrib/mcp/common/mcpGatewayService.js";
import { IMcpRegistry } from "../../contrib/mcp/common/mcpRegistryTypes.js";
import { extensionPrefixedIdentifier, McpCollectionSortOrder, McpConnectionState, McpServerDefinition, McpServerLaunch, McpServerTransportType, McpServerTrust, mcpOAuthClientSecretStorageKey, UserInteractionRequiredError } from "../../contrib/mcp/common/mcpTypes.js";
import { mcpEnterpriseManagedAuthIdpSection } from "../../contrib/mcp/common/mcpConfiguration.js";
import { IAuthenticationMcpAccessService } from "../../services/authentication/browser/authenticationMcpAccessService.js";
import { IAuthenticationMcpService } from "../../services/authentication/browser/authenticationMcpService.js";
import { IAuthenticationMcpUsageService } from "../../services/authentication/browser/authenticationMcpUsageService.js";
import { IAuthenticationService } from "../../services/authentication/common/authentication.js";
import { IDynamicAuthenticationProviderStorageService } from "../../services/authentication/common/dynamicAuthenticationProviderStorage.js";
import { ExtensionHostKind, extensionHostKindToString } from "../../services/extensions/common/extensionHostKind.js";
import { IExtensionService } from "../../services/extensions/common/extensions.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
let MainThreadMcp = class extends Disposable {
  constructor(_extHostContext, _mcpRegistry, dialogService, _authenticationService, authenticationMcpServersService, authenticationMCPServerAccessService, authenticationMCPServerUsageService, _dynamicAuthenticationProviderStorageService, _extensionService, _contextKeyService, _telemetryService, _mcpGatewayService, _configurationService, _secretStorageService) {
    super();
    this._extHostContext = _extHostContext;
    this._mcpRegistry = _mcpRegistry;
    this.dialogService = dialogService;
    this._authenticationService = _authenticationService;
    this.authenticationMcpServersService = authenticationMcpServersService;
    this.authenticationMCPServerAccessService = authenticationMCPServerAccessService;
    this.authenticationMCPServerUsageService = authenticationMCPServerUsageService;
    this._dynamicAuthenticationProviderStorageService = _dynamicAuthenticationProviderStorageService;
    this._extensionService = _extensionService;
    this._contextKeyService = _contextKeyService;
    this._telemetryService = _telemetryService;
    this._mcpGatewayService = _mcpGatewayService;
    this._configurationService = _configurationService;
    this._secretStorageService = _secretStorageService;
    this._serverIdCounter = 0;
    this._servers = /* @__PURE__ */ new Map();
    this._serverDefinitions = /* @__PURE__ */ new Map();
    this._serverAuthTracking = new McpServerAuthTracker();
    this._collectionDefinitions = this._register(new DisposableMap());
    this._gateways = this._register(new DisposableMap());
    this._register(_authenticationService.onDidChangeSessions((e) => this._onDidChangeAuthSessions(e.providerId, e.label)));
    const proxy = this._proxy = _extHostContext.getProxy(ExtHostContext.ExtHostMcp);
    this._register(this._mcpRegistry.registerDelegate({
      // Prefer Node.js extension hosts when they're available. No CORS issues etc.
      priority: _extHostContext.extensionHostKind === ExtensionHostKind.LocalWebWorker ? 0 : 1,
      waitForInitialProviderPromises() {
        return proxy.$waitForInitialCollectionProviders();
      },
      canStart(collection, serverDefinition) {
        if (collection.remoteAuthority !== _extHostContext.remoteAuthority) {
          return false;
        }
        if (serverDefinition.launch.type === McpServerTransportType.Stdio && _extHostContext.extensionHostKind === ExtensionHostKind.LocalWebWorker) {
          return false;
        }
        return true;
      },
      async substituteVariables(serverDefinition, launch) {
        const ser = await proxy.$substituteVariables(serverDefinition.variableReplacement?.folder?.uri, McpServerLaunch.toSerialized(launch));
        return McpServerLaunch.fromSerialized(ser);
      },
      start: (_collection, serverDefiniton, resolveLaunch, options) => {
        const id = ++this._serverIdCounter;
        const launch = new ExtHostMcpServerLaunch(
          _extHostContext.extensionHostKind,
          () => proxy.$stopMcp(id),
          (msg) => proxy.$sendMessage(id, JSON.stringify(msg))
        );
        this._servers.set(id, launch);
        this._serverDefinitions.set(id, serverDefiniton);
        proxy.$startMcp(id, {
          launch: resolveLaunch,
          defaultCwd: serverDefiniton.variableReplacement?.folder?.uri,
          errorOnUserInteraction: options?.errorOnUserInteraction
        });
        return launch;
      }
    }));
    const onDidChangeMcpServerDefinitionsTrigger = this._register(new RunOnceScheduler(() => this._publishServerDefinitions(), 500));
    this._register(autorun((reader) => {
      const collections = this._mcpRegistry.collections.read(reader);
      for (const collection of collections) {
        collection.serverDefinitions.read(reader);
      }
      if (!onDidChangeMcpServerDefinitionsTrigger.isScheduled()) {
        onDidChangeMcpServerDefinitionsTrigger.schedule();
      }
    }));
    onDidChangeMcpServerDefinitionsTrigger.schedule();
  }
  _publishServerDefinitions() {
    const collections = this._mcpRegistry.collections.get();
    const allServers = [];
    for (const collection of collections) {
      const servers = collection.serverDefinitions.get();
      for (const server of servers) {
        allServers.push(McpServerDefinition.toSerialized(server));
      }
    }
    this._proxy.$onDidChangeMcpServerDefinitions(allServers);
  }
  $upsertMcpCollection(collection, serversDto) {
    const servers = serversDto.map(McpServerDefinition.fromSerialized);
    const existing = this._collectionDefinitions.get(collection.id);
    if (existing) {
      existing.servers.set(servers, void 0);
    } else {
      const serverDefinitions = observableValue("mcpServers", servers);
      const extensionId = new ExtensionIdentifier(collection.extensionId);
      const store = new DisposableStore();
      const handle = store.add(new MutableDisposable());
      const register = () => {
        handle.value ??= this._mcpRegistry.registerCollection({
          ...collection,
          source: extensionId,
          order: McpCollectionSortOrder.Extension,
          resolveServerLanch: collection.canResolveLaunch ? (async (def) => {
            const r = await this._proxy.$resolveMcpLaunch(collection.id, def.label);
            return r ? McpServerLaunch.fromSerialized(r) : void 0;
          }) : void 0,
          trustBehavior: collection.isTrustedByDefault ? McpServerTrust.Kind.Trusted : McpServerTrust.Kind.TrustedOnNonce,
          remoteAuthority: this._extHostContext.remoteAuthority,
          serverDefinitions
        });
      };
      const whenClauseStr = mapFindFirst(this._extensionService.extensions, (e) => ExtensionIdentifier.equals(extensionId, e.identifier) ? e.contributes?.mcpServerDefinitionProviders?.find((p) => extensionPrefixedIdentifier(extensionId, p.id) === collection.id)?.when : void 0);
      const whenClause = whenClauseStr && ContextKeyExpr.deserialize(whenClauseStr);
      if (!whenClause) {
        register();
      } else {
        const evaluate = () => {
          if (this._contextKeyService.contextMatchesRules(whenClause)) {
            register();
          } else {
            handle.clear();
          }
        };
        store.add(this._contextKeyService.onDidChangeContext(evaluate));
        evaluate();
      }
      this._collectionDefinitions.set(collection.id, {
        servers: serverDefinitions,
        dispose: () => store.dispose()
      });
    }
  }
  $deleteMcpCollection(collectionId) {
    this._collectionDefinitions.deleteAndDispose(collectionId);
  }
  $onDidChangeState(id, update) {
    const server = this._servers.get(id);
    if (!server) {
      return;
    }
    server.state.set(update, void 0);
    if (!McpConnectionState.isRunning(update)) {
      server.dispose();
      this._servers.delete(id);
      this._serverDefinitions.delete(id);
      this._serverAuthTracking.untrack(id);
    }
  }
  $onDidPublishLog(id, level, log) {
    if (typeof level === "string") {
      level = LogLevel.Info;
      log = level;
    }
    this._servers.get(id)?.pushLog(level, log);
  }
  $onDidReceiveMessage(id, message) {
    this._servers.get(id)?.pushMessage(message);
  }
  async $getTokenForProviderId(id, providerId, scopes, options = {}) {
    const server = this._serverDefinitions.get(id);
    if (!server) {
      return void 0;
    }
    return this._getSessionForProvider(id, server, providerId, scopes, void 0, options.errorOnUserInteraction, options.clientId);
  }
  async $getTokenFromServerMetadata(id, authDetails, { errorOnUserInteraction, forceNewRegistration, clientId } = {}) {
    const server = this._serverDefinitions.get(id);
    if (!server) {
      return void 0;
    }
    const authorizationServer = URI.revive(authDetails.authorizationServer);
    const resourceServer = authDetails.resourceMetadata?.resource ? URI.parse(authDetails.resourceMetadata.resource) : void 0;
    const resolvedScopes = authDetails.scopes ?? authDetails.resourceMetadata?.scopes_supported ?? authDetails.authorizationServerMetadata.scopes_supported ?? [];
    if (authDetails.enterpriseManaged) {
      const resource = authDetails.resourceMetadata?.resource;
      if (!resource) {
        throw new Error(nls.localize("mcp.enterpriseManaged.missingResource", "The enterprise-managed MCP server '{0}' did not advertise a protected-resource metadata document with a 'resource' identifier.", server.label));
      }
      const resourceAuthServers = authDetails.resourceMetadata?.authorization_servers ?? [];
      const audience = resourceAuthServers[0];
      if (!audience) {
        throw new Error(nls.localize("mcp.enterpriseManaged.missingAS", "The enterprise-managed MCP server '{0}' did not advertise an `authorization_servers` entry in its protected-resource metadata.", server.label));
      }
      const xaaScopes = authDetails.scopes ?? authDetails.resourceMetadata?.scopes_supported ?? [];
      const issuer = this._ensureXaaIssuer();
      const xaaProviderId = await this._authenticationService.createOrGetXaaProvider(issuer);
      if (!xaaProviderId) {
        return void 0;
      }
      const resourceClientId = clientId ?? authDetails.clientId;
      let resourceClientSecret;
      if (resourceClientId) {
        try {
          resourceClientSecret = await this._secretStorageService.get(mcpOAuthClientSecretStorageKey(resource, resourceClientId));
        } catch {
        }
      }
      return this._getSessionForProvider(id, server, xaaProviderId, xaaScopes, issuer, errorOnUserInteraction, resourceClientId, resource, audience, resourceClientSecret);
    }
    let providerId = await this._authenticationService.getOrActivateProviderIdForServer(authorizationServer, resourceServer);
    const resolvedClientId = clientId ?? authDetails.clientId;
    const mcpServerUrl = server.launch.type === McpServerTransportType.HTTP ? server.launch.uri.toString(true) : void 0;
    let clientSecret;
    let didLookupClientSecret = false;
    if (resolvedClientId && mcpServerUrl) {
      try {
        clientSecret = await this._secretStorageService.get(mcpOAuthClientSecretStorageKey(mcpServerUrl, resolvedClientId));
        didLookupClientSecret = true;
      } catch {
      }
    }
    if (didLookupClientSecret && providerId && !forceNewRegistration && this._authenticationService.isDynamicAuthenticationProvider(providerId)) {
      const registered = await this._dynamicAuthenticationProviderStorageService.getClientRegistration(providerId);
      if (registered && registered.clientSecret !== clientSecret) {
        forceNewRegistration = true;
      }
    }
    if (forceNewRegistration && providerId) {
      if (!this._authenticationService.isDynamicAuthenticationProvider(providerId)) {
        throw new Error("Cannot force new registration for a non-dynamic authentication provider.");
      }
      this._authenticationService.unregisterAuthenticationProvider(providerId);
      await this._dynamicAuthenticationProviderStorageService.removeDynamicProvider(providerId);
      providerId = void 0;
    }
    if (!providerId) {
      const provider = await this._authenticationService.createDynamicAuthenticationProvider(authorizationServer, authDetails.authorizationServerMetadata, authDetails.resourceMetadata, resolvedClientId, clientSecret);
      if (!provider) {
        return void 0;
      }
      providerId = provider.id;
    }
    return this._getSessionForProvider(
      id,
      server,
      providerId,
      resolvedScopes,
      authorizationServer,
      errorOnUserInteraction,
      resolvedClientId,
      authDetails.resourceMetadata?.resource,
      /* audience */
      void 0,
      clientSecret
    );
  }
  _ensureXaaIssuer() {
    const config = this._configurationService.getValue(mcpEnterpriseManagedAuthIdpSection) ?? {};
    const configuredIssuer = config.issuer?.trim();
    if (!configuredIssuer) {
      throw new Error(nls.localize("mcp.enterpriseManaged.issuerMissing", "Enterprise-managed MCP authentication requires `mcp.enterpriseManagedAuth.idp.issuer` to be configured. Set it via enterprise policy (Windows Group Policy / macOS managed preferences / Linux `/etc/vscode/policy.json`) or, for local testing, by hand-editing `settings.json`."));
    }
    let parsed;
    try {
      parsed = URI.parse(configuredIssuer);
    } catch {
      throw new Error(nls.localize("mcp.enterpriseManaged.issuerInvalid", "Enterprise-managed MCP authentication requires `mcp.enterpriseManagedAuth.idp.issuer` to be a valid URL; got '{0}'.", configuredIssuer));
    }
    if (parsed.scheme !== "https" && parsed.scheme !== "http") {
      throw new Error(nls.localize("mcp.enterpriseManaged.issuerNotHttp", "Enterprise-managed MCP authentication requires `mcp.enterpriseManagedAuth.idp.issuer` to use the `https` or `http` scheme; got '{0}'.", configuredIssuer));
    }
    return parsed;
  }
  async _getSessionForProvider(serverId, server, providerId, scopes, authorizationServer, errorOnUserInteraction = false, clientId, resource, audience, clientSecret) {
    const authContext = { authorizationServer, clientId, resource, audience };
    const sessions = await this._authenticationService.getSessions(providerId, scopes, { authorizationServer, clientId, clientSecret, resource, audience }, true);
    if (server.launch.type !== McpServerTransportType.HTTP) {
      return void 0;
    }
    const mcpServerUrl = server.launch.uri.toString(true);
    const accountNamePreference = this.authenticationMcpServersService.getAccountPreference(server.id, providerId);
    let matchingAccountPreferenceSession;
    if (accountNamePreference) {
      matchingAccountPreferenceSession = sessions.find((session2) => session2.account.label === accountNamePreference);
    }
    const provider = this._authenticationService.getProvider(providerId);
    let session;
    if (sessions.length) {
      if (matchingAccountPreferenceSession && this.authenticationMCPServerAccessService.isAccessAllowedForUrl(providerId, matchingAccountPreferenceSession.account.label, server.id, mcpServerUrl)) {
        this.authenticationMCPServerUsageService.addAccountUsage(providerId, matchingAccountPreferenceSession.account.label, scopes, server.id, server.label);
        this._serverAuthTracking.track(providerId, serverId, scopes, authContext);
        return matchingAccountPreferenceSession.accessToken;
      }
      if (!provider.supportsMultipleAccounts && this.authenticationMCPServerAccessService.isAccessAllowedForUrl(providerId, sessions[0].account.label, server.id, mcpServerUrl)) {
        this.authenticationMCPServerUsageService.addAccountUsage(providerId, sessions[0].account.label, scopes, server.id, server.label);
        this._serverAuthTracking.track(providerId, serverId, scopes, authContext);
        return sessions[0].accessToken;
      }
    }
    if (errorOnUserInteraction) {
      throw new UserInteractionRequiredError("authentication");
    }
    const isAllowed = await this.loginPrompt(server.label, provider.label, false);
    if (!isAllowed) {
      throw new Error("User did not consent to login.");
    }
    if (sessions.length) {
      if (provider.supportsMultipleAccounts && errorOnUserInteraction) {
        throw new UserInteractionRequiredError("authentication");
      }
      session = provider.supportsMultipleAccounts ? await this.authenticationMcpServersService.selectSession(providerId, server.id, server.label, scopes, sessions) : sessions[0];
    } else {
      if (errorOnUserInteraction) {
        throw new UserInteractionRequiredError("authentication");
      }
      const accountToCreate = matchingAccountPreferenceSession?.account;
      do {
        session = await this._authenticationService.createSession(
          providerId,
          scopes,
          {
            activateImmediate: true,
            account: accountToCreate,
            authorizationServer,
            clientId,
            clientSecret,
            resource,
            audience
          }
        );
      } while (accountToCreate && accountToCreate.label !== session.account.label && !await this.continueWithIncorrectAccountPrompt(session.account.label, accountToCreate.label));
    }
    this.authenticationMCPServerAccessService.updateAllowedMcpServers(providerId, session.account.label, [{ id: server.id, name: server.label, allowed: true, url: mcpServerUrl }]);
    this.authenticationMcpServersService.updateAccountPreference(server.id, providerId, session.account);
    this.authenticationMCPServerUsageService.addAccountUsage(providerId, session.account.label, scopes, server.id, server.label);
    this._serverAuthTracking.track(providerId, serverId, scopes, authContext);
    return session.accessToken;
  }
  async continueWithIncorrectAccountPrompt(chosenAccountLabel, requestedAccountLabel) {
    const result = await this.dialogService.prompt({
      message: nls.localize("incorrectAccount", "Incorrect account detected"),
      detail: nls.localize("incorrectAccountDetail", "The chosen account, {0}, does not match the requested account, {1}.", chosenAccountLabel, requestedAccountLabel),
      type: Severity.Warning,
      cancelButton: true,
      buttons: [
        {
          label: nls.localize("keep", "Keep {0}", chosenAccountLabel),
          run: () => chosenAccountLabel
        },
        {
          label: nls.localize("loginWith", "Login with {0}", requestedAccountLabel),
          run: () => requestedAccountLabel
        }
      ]
    });
    if (!result.result) {
      throw new CancellationError();
    }
    return result.result === chosenAccountLabel;
  }
  async _onDidChangeAuthSessions(providerId, providerLabel) {
    const serversUsingProvider = this._serverAuthTracking.get(providerId);
    if (!serversUsingProvider) {
      return;
    }
    for (const { serverId, scopes, context } of serversUsingProvider) {
      const server = this._servers.get(serverId);
      const serverDefinition = this._serverDefinitions.get(serverId);
      if (!server || !serverDefinition) {
        continue;
      }
      const state = server.state.get();
      if (state.state !== McpConnectionState.Kind.Running) {
        continue;
      }
      try {
        await this._getSessionForProvider(serverId, serverDefinition, providerId, scopes, context.authorizationServer, true, context.clientId, context.resource, context.audience);
      } catch (e) {
        if (UserInteractionRequiredError.is(e)) {
          server.pushLog(LogLevel.Warning, nls.localize("mcpAuthSessionRemoved", "Authentication session for {0} removed, stopping server", providerLabel));
          server.stop();
        }
      }
    }
  }
  $logMcpAuthSetup(data) {
    this._telemetryService.publicLog2("mcp/authSetup", data);
  }
  async $startMcpGateway(chatSessionResource) {
    const result = await this._mcpGatewayService.createGateway(
      this._extHostContext.extensionHostKind === ExtensionHostKind.Remote,
      chatSessionResource ? URI.revive(chatSessionResource) : void 0
    );
    if (!result) {
      return void 0;
    }
    if (this._store.isDisposed) {
      result.dispose();
      return void 0;
    }
    const gatewayId = generateUuid();
    const store = new DisposableStore();
    store.add(result);
    store.add(result.onDidChangeServers((servers) => {
      this._proxy.$onDidChangeGatewayServers(gatewayId, servers.map((s) => ({ label: s.label, address: s.address })));
    }));
    this._gateways.set(gatewayId, store);
    return {
      servers: result.servers.map((s) => ({ label: s.label, address: s.address })),
      gatewayId
    };
  }
  $disposeMcpGateway(gatewayId) {
    this._gateways.deleteAndDispose(gatewayId);
  }
  async loginPrompt(mcpLabel, providerLabel, recreatingSession) {
    const message = recreatingSession ? nls.localize("confirmRelogin", "The MCP Server Definition '{0}' wants you to authenticate to {1}.", mcpLabel, providerLabel) : nls.localize("confirmLogin", "The MCP Server Definition '{0}' wants to authenticate to {1}.", mcpLabel, providerLabel);
    const buttons = [
      {
        label: nls.localize({ key: "allow", comment: ["&& denotes a mnemonic"] }, "&&Allow"),
        run() {
          return true;
        }
      }
    ];
    const { result } = await this.dialogService.prompt({
      type: Severity.Info,
      message,
      buttons,
      cancelButton: true
    });
    return result ?? false;
  }
  dispose() {
    for (const server of this._servers.values()) {
      server.extHostDispose();
    }
    this._servers.clear();
    this._serverDefinitions.clear();
    this._serverAuthTracking.clear();
    super.dispose();
  }
};
MainThreadMcp = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadMcp),
  __decorateParam(1, IMcpRegistry),
  __decorateParam(2, IDialogService),
  __decorateParam(3, IAuthenticationService),
  __decorateParam(4, IAuthenticationMcpService),
  __decorateParam(5, IAuthenticationMcpAccessService),
  __decorateParam(6, IAuthenticationMcpUsageService),
  __decorateParam(7, IDynamicAuthenticationProviderStorageService),
  __decorateParam(8, IExtensionService),
  __decorateParam(9, IContextKeyService),
  __decorateParam(10, ITelemetryService),
  __decorateParam(11, IWorkbenchMcpGatewayService),
  __decorateParam(12, IConfigurationService),
  __decorateParam(13, ISecretStorageService)
], MainThreadMcp);
class ExtHostMcpServerLaunch extends Disposable {
  constructor(extHostKind, stop, send) {
    super();
    this.stop = stop;
    this.send = send;
    this.state = observableValue("mcpServerState", { state: McpConnectionState.Kind.Starting });
    this._onDidLog = this._register(new Emitter());
    this.onDidLog = this._onDidLog.event;
    this._onDidReceiveMessage = this._register(new Emitter());
    this.onDidReceiveMessage = this._onDidReceiveMessage.event;
    this._register(disposableTimeout(() => {
      this.pushLog(LogLevel.Info, `Starting server from ${extensionHostKindToString(extHostKind)} extension host`);
    }));
  }
  pushLog(level, message) {
    this._onDidLog.fire({ message, level });
  }
  pushMessage(message) {
    let parsed;
    try {
      parsed = JSON.parse(message);
    } catch (e) {
      this.pushLog(LogLevel.Warning, `Failed to parse message: ${JSON.stringify(message)}`);
    }
    if (parsed) {
      if (Array.isArray(parsed)) {
        parsed.forEach((p) => this._onDidReceiveMessage.fire(p));
      } else {
        this._onDidReceiveMessage.fire(parsed);
      }
    }
  }
  extHostDispose() {
    if (McpConnectionState.isRunning(this.state.get())) {
      this.pushLog(LogLevel.Warning, "Extension host shut down, server will stop.");
      this.state.set({ state: McpConnectionState.Kind.Stopped }, void 0);
    }
    this.dispose();
  }
  dispose() {
    if (McpConnectionState.isRunning(this.state.get())) {
      this.stop();
    }
    super.dispose();
  }
}
class McpServerAuthTracker {
  constructor() {
    // Provider ID -> Array of tracked servers (serverId, scopes, and the auth context to replay)
    this._tracking = /* @__PURE__ */ new Map();
  }
  /**
   * Track authentication for a server with a specific provider.
   * Replaces any existing tracking for this server/provider combination.
   */
  track(providerId, serverId, scopes, context) {
    const servers = this._tracking.get(providerId) || [];
    const filtered = servers.filter((s) => s.serverId !== serverId);
    filtered.push({ serverId, scopes, context });
    this._tracking.set(providerId, filtered);
  }
  /**
   * Remove all authentication tracking for a server across all providers.
   */
  untrack(serverId) {
    for (const [providerId, servers] of this._tracking.entries()) {
      const filtered = servers.filter((s) => s.serverId !== serverId);
      if (filtered.length === 0) {
        this._tracking.delete(providerId);
      } else {
        this._tracking.set(providerId, filtered);
      }
    }
  }
  /**
   * Get all servers using a specific authentication provider.
   */
  get(providerId) {
    return this._tracking.get(providerId);
  }
  /**
   * Clear all tracking data.
   */
  clear() {
    this._tracking.clear();
  }
}
export {
  MainThreadMcp,
  McpServerAuthTracker
};
