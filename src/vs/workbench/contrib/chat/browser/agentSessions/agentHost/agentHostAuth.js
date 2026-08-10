import { fetchAuthorizationServerMetadata } from "../../../../../../base/common/oauth.js";
import { SequencerByKey } from "../../../../../../base/common/async.js";
import { CancellationError } from "../../../../../../base/common/errors.js";
import { URI } from "../../../../../../base/common/uri.js";
import { ICommandService } from "../../../../../../platform/commands/common/commands.js";
import { ILabelService } from "../../../../../../platform/label/common/label.js";
import { ILogService } from "../../../../../../platform/log/common/log.js";
import { localize } from "../../../../../../nls.js";
import { IAuthenticationMcpAccessService } from "../../../../../services/authentication/browser/authenticationMcpAccessService.js";
import { IAuthenticationMcpService } from "../../../../../services/authentication/browser/authenticationMcpService.js";
import { IAuthenticationMcpUsageService } from "../../../../../services/authentication/browser/authenticationMcpUsageService.js";
import { getDynamicAuthenticationProviderId, IAuthenticationService } from "../../../../../services/authentication/common/authentication.js";
import { IDynamicAuthenticationProviderStorageService } from "../../../../../services/authentication/common/dynamicAuthenticationProviderStorage.js";
import { CHAT_SETUP_ACTION_ID } from "../../actions/chatActions.js";
function agentHostMcpServerId(authority, serverName, resourceUrl) {
  return `agent-host-mcp:${authority}/${encodeURIComponent(serverName)}/${encodeURIComponent(resourceUrl)}`;
}
class AgentHostAuthTokenCache {
  constructor() {
    this._completedTokens = /* @__PURE__ */ new Map();
    this._pendingAuthentications = /* @__PURE__ */ new Map();
    this._keyGenerations = /* @__PURE__ */ new Map();
    this._globalGeneration = 0;
  }
  /**
   * Forwards a token once per resource/scope pair. Same-token callers share
   * and await an in-flight authentication.
   */
  async authenticate(resource, scopes, token, authenticate) {
    const key = this._key(resource, scopes);
    const globalGeneration = this._globalGeneration;
    const keyGeneration = this._keyGenerations.get(key) ?? 0;
    const pending = this._pendingAuthentications.get(key);
    if (pending) {
      if (pending.token === token) {
        await pending.promise;
        if (!this._isCurrentGeneration(key, globalGeneration, keyGeneration)) {
          throw new CancellationError();
        }
        return false;
      }
      try {
        await pending.promise;
      } catch {
      }
      if (!this._isCurrentGeneration(key, globalGeneration, keyGeneration)) {
        throw new CancellationError();
      }
      return this.authenticate(resource, scopes, token, authenticate);
    }
    if (this._completedTokens.get(key) === token) {
      return false;
    }
    const promise = (async () => {
      await authenticate();
      if (!this._isCurrentGeneration(key, globalGeneration, keyGeneration)) {
        throw new CancellationError();
      }
      this._completedTokens.set(key, token);
    })();
    this._pendingAuthentications.set(key, { token, promise });
    try {
      await promise;
      return true;
    } finally {
      if (this._pendingAuthentications.get(key)?.promise === promise) {
        this._pendingAuthentications.delete(key);
      }
    }
  }
  /**
   * Clear the cached token for a specific resource/scope pair, a whole resource,
   * or all resources if no argument is given. Call after a failed `authenticate`
   * RPC or when the agent host process restarts.
   */
  clear(resource, scopes) {
    if (resource !== void 0) {
      if (scopes !== void 0) {
        const key = this._key(resource, scopes);
        this._invalidateKey(key);
        this._completedTokens.delete(key);
        this._pendingAuthentications.delete(key);
        return;
      }
      const prefix = `${resource}\0`;
      const keys = /* @__PURE__ */ new Set([...this._completedTokens.keys(), ...this._pendingAuthentications.keys(), ...this._keyGenerations.keys()]);
      for (const key of keys) {
        if (key.startsWith(prefix)) {
          this._invalidateKey(key);
          this._completedTokens.delete(key);
          this._pendingAuthentications.delete(key);
        }
      }
    } else {
      this._globalGeneration++;
      this._completedTokens.clear();
      this._pendingAuthentications.clear();
      this._keyGenerations.clear();
    }
  }
  _invalidateKey(key) {
    this._keyGenerations.set(key, (this._keyGenerations.get(key) ?? 0) + 1);
  }
  _isCurrentGeneration(key, globalGeneration, keyGeneration) {
    return this._globalGeneration === globalGeneration && (this._keyGenerations.get(key) ?? 0) === keyGeneration;
  }
  _key(resource, scopes) {
    return `${resource}\0${scopes ? [...new Set(scopes)].sort().join("\0") : ""}`;
  }
}
async function resolveTokenForResource(resourceServer, authorizationServers, scopes, authenticationService, logService, logPrefix) {
  for (const server of authorizationServers) {
    const serverUri = URI.parse(server);
    const providerId = await authenticationService.getOrActivateProviderIdForServer(serverUri, resourceServer);
    if (!providerId) {
      logService.trace(`${logPrefix} No auth provider found for server: ${server}`);
      continue;
    }
    logService.trace(`${logPrefix} Resolved auth provider '${providerId}' for server: ${server}`);
    const sessions = await authenticationService.getSessions(providerId, [...scopes], { authorizationServer: serverUri }, true);
    if (sessions.length > 0) {
      return sessions[0].accessToken;
    }
    const allSessions = await authenticationService.getSessions(providerId, void 0, { authorizationServer: serverUri }, true);
    const requestedSet = new Set(scopes);
    let bestToken;
    let bestExtraScopes = Infinity;
    for (const session of allSessions) {
      const sessionScopes = new Set(session.scopes);
      let isSuperset = true;
      for (const scope of requestedSet) {
        if (!sessionScopes.has(scope)) {
          isSuperset = false;
          break;
        }
      }
      if (isSuperset) {
        const extraScopes = sessionScopes.size - requestedSet.size;
        if (extraScopes < bestExtraScopes) {
          bestExtraScopes = extraScopes;
          bestToken = session.accessToken;
        }
      }
    }
    if (bestToken) {
      return bestToken;
    }
  }
  return void 0;
}
async function forwardAuthenticationToken(options, resource, scopes, token) {
  const request = { resource, scopes, token };
  if (options.authTokenCache) {
    return options.authTokenCache.authenticate(resource, scopes, token, () => options.authenticate(request));
  }
  await options.authenticate(request);
  return true;
}
async function authenticateProtectedResources(accessor, agents, options) {
  const authenticationService = accessor.get(IAuthenticationService);
  const logService = accessor.get(ILogService);
  for (const agent of agents) {
    for (const resource of agent.protectedResources ?? []) {
      const resourceUri = URI.parse(resource.resource);
      const scopes = resource.scopes_supported ?? [];
      const token = await resolveTokenForResource(
        resourceUri,
        resource.authorization_servers ?? [],
        scopes,
        authenticationService,
        logService,
        options.logPrefix
      );
      if (!token) {
        logService.info(`${options.logPrefix} No token resolved for resource: ${resource.resource}`);
        continue;
      }
      const authenticated = await forwardAuthenticationToken(options, resource.resource, scopes, token);
      if (!authenticated) {
        logService.trace(`${options.logPrefix} Auth token for ${resource.resource} unchanged; skipping authenticate RPC`);
        continue;
      }
      logService.info(`${options.logPrefix} Authenticating for resource: ${resource.resource}`);
    }
  }
}
async function resolveAuthenticationInteractively(accessor, protectedResources, options) {
  const authenticationService = accessor.get(IAuthenticationService);
  const commandService = accessor.get(ICommandService);
  const logService = accessor.get(ILogService);
  for (const resource of protectedResources) {
    const resourceUri = URI.parse(resource.resource);
    const scopes = resource.scopes_supported ?? [];
    let token = await resolveTokenForResource(
      resourceUri,
      resource.authorization_servers ?? [],
      scopes,
      authenticationService,
      logService,
      options.logPrefix
    );
    if (token) {
      await forwardAuthenticationToken(options, resource.resource, scopes, token);
      logService.info(`${options.logPrefix} Interactive authentication succeeded for ${resource.resource}`);
      return true;
    }
    const setupResult = await commandService.executeCommand(CHAT_SETUP_ACTION_ID, void 0, {
      forceSignInDialog: true,
      additionalScopes: scopes,
      dialogTitle: localize("agentHost.signInDialogTitle", "Sign in to use GitHub Copilot"),
      disableChatViewReveal: true,
      returnResult: true
    });
    if (setupResult?.success === void 0) {
      return false;
    }
    if (!setupResult.success) {
      throw setupResult.error ?? new Error(localize("agentHost.signInFailed", "Failed to sign in to use GitHub Copilot."));
    }
    token = await resolveTokenForResource(
      resourceUri,
      resource.authorization_servers ?? [],
      scopes,
      authenticationService,
      logService,
      options.logPrefix
    );
    if (!token) {
      return false;
    }
    await forwardAuthenticationToken(options, resource.resource, scopes, token);
    logService.info(`${options.logPrefix} Interactive authentication succeeded for ${resource.resource}`);
    return true;
  }
  return false;
}
async function resolveMcpServerAuthentication(accessor, protectedResource, options) {
  const authenticationService = accessor.get(IAuthenticationService);
  const authenticationMcpAccessService = accessor.get(IAuthenticationMcpAccessService);
  const authenticationMcpService = accessor.get(IAuthenticationMcpService);
  const authenticationMcpUsageService = accessor.get(IAuthenticationMcpUsageService);
  const dynamicAuthenticationProviderStorageService = accessor.get(IDynamicAuthenticationProviderStorageService);
  const logService = accessor.get(ILogService);
  const agentHostMeta = options.agentHost ? { authority: options.agentHost.authority, label: accessor.get(ILabelService).getHostLabel(options.agentHost.scheme, options.agentHost.authority) } : void 0;
  const scopes = options.scopes.length > 0 || isGitHubMcpResource(protectedResource) ? options.scopes : protectedResource.scopes_supported ?? [];
  const authenticationOperations = getMcpAuthenticationOperations(authenticationService);
  for (const authorizationServer of protectedResource.authorization_servers ?? []) {
    const authorizationServerUri = URI.parse(authorizationServer);
    const providerOperationId = getDynamicAuthenticationProviderId(authorizationServerUri, protectedResource);
    const authenticated = await authenticationOperations.queue(providerOperationId, async () => {
      const providerId = await getOrCreateProviderForMcpResource(
        authorizationServerUri,
        protectedResource,
        options.oauthClient,
        authenticationService,
        dynamicAuthenticationProviderStorageService,
        logService,
        options.logPrefix,
        options.allowInteraction,
        options.authorizationServerMetadataFetcher ?? fetchAuthorizationServerMetadata
      );
      if (!providerId) {
        return false;
      }
      const oauthClientOptions = options.oauthClient ? { clientId: options.oauthClient.clientId, clientSecret: options.oauthClient.clientSecret } : {};
      const sessions = await authenticationService.getSessions(providerId, [...scopes], {
        authorizationServer: authorizationServerUri,
        resource: protectedResource.resource,
        ...oauthClientOptions,
        silent: !options.allowInteraction
      }, true);
      const allowedSession = getAllowedMcpSession(providerId, sessions, authenticationMcpAccessService, authenticationMcpService, options);
      if (allowedSession) {
        await authenticateMcpSession(providerId, allowedSession, scopes, authenticationMcpAccessService, authenticationMcpService, authenticationMcpUsageService, logService, options, false, agentHostMeta);
        return true;
      }
      if (!options.allowInteraction) {
        return false;
      }
      const provider = authenticationService.getProvider(providerId);
      const session = sessions.length ? provider.supportsMultipleAccounts ? await authenticationMcpService.selectSession(providerId, options.mcpServerId, options.mcpServerName, [...scopes], sessions) : sessions[0] : await authenticationService.createSession(providerId, [...scopes], {
        activateImmediate: true,
        authorizationServer: authorizationServerUri,
        resource: protectedResource.resource,
        ...oauthClientOptions
      });
      await authenticateMcpSession(providerId, session, scopes, authenticationMcpAccessService, authenticationMcpService, authenticationMcpUsageService, logService, options, true, agentHostMeta);
      return true;
    });
    if (authenticated) {
      return true;
    }
  }
  return false;
}
const mcpAuthenticationOperations = /* @__PURE__ */ new WeakMap();
function getMcpAuthenticationOperations(authenticationService) {
  let operations = mcpAuthenticationOperations.get(authenticationService);
  if (!operations) {
    operations = new SequencerByKey();
    mcpAuthenticationOperations.set(authenticationService, operations);
  }
  return operations;
}
function isGitHubMcpResource(resource) {
  return resource.resource_name === "GitHub MCP Server";
}
async function getOrCreateProviderForMcpResource(authorizationServer, protectedResource, oauthClient, authenticationService, dynamicAuthenticationProviderStorageService, logService, logPrefix, allowCreation, authorizationServerMetadataFetcher) {
  const resourceUri = URI.parse(protectedResource.resource);
  const dynamicProviderId = getDynamicAuthenticationProviderId(authorizationServer, protectedResource);
  let clientId = oauthClient?.clientId;
  let clientSecret = oauthClient?.clientSecret;
  if (oauthClient) {
    const isProviderActive = authenticationService.isDynamicAuthenticationProvider(dynamicProviderId);
    const registeredClient = await dynamicAuthenticationProviderStorageService.getClientRegistration(dynamicProviderId);
    const clientMatches = registeredClient?.clientId === oauthClient.clientId && registeredClient.clientSecret === oauthClient.clientSecret;
    if (clientMatches) {
      if (isProviderActive) {
        return dynamicProviderId;
      }
    } else {
      if (!allowCreation) {
        return void 0;
      }
      if (isProviderActive) {
        authenticationService.unregisterAuthenticationProvider(dynamicProviderId);
        await dynamicAuthenticationProviderStorageService.removeDynamicProvider(dynamicProviderId);
      }
    }
  } else {
    const existing = await authenticationService.getOrActivateProviderIdForServer(authorizationServer, resourceUri);
    if (existing) {
      return existing;
    }
    const registeredClient = await dynamicAuthenticationProviderStorageService.getClientRegistration(dynamicProviderId);
    if (!registeredClient?.clientId && !allowCreation) {
      return void 0;
    }
    clientId = registeredClient?.clientId;
    clientSecret = registeredClient?.clientSecret;
  }
  try {
    const { metadata } = await authorizationServerMetadataFetcher(authorizationServer.toString(true));
    const provider = await authenticationService.createDynamicAuthenticationProvider(authorizationServer, metadata, protectedResource, clientId, clientSecret);
    return provider?.id;
  } catch (err) {
    logService.warn(`${logPrefix} Failed to create MCP auth provider for ${authorizationServer.toString(true)}`, err);
    return void 0;
  }
}
function getAllowedMcpSession(providerId, sessions, authenticationMcpAccessService, authenticationMcpService, options) {
  const accountNamePreference = authenticationMcpService.getAccountPreference(options.mcpServerId, providerId);
  if (accountNamePreference) {
    const preferred = sessions.find((session) => session.account.label === accountNamePreference);
    if (preferred && authenticationMcpAccessService.isAccessAllowedForUrl(providerId, preferred.account.label, options.mcpServerId, options.mcpServerUrl)) {
      return preferred;
    }
  }
  if (sessions.length === 1 && authenticationMcpAccessService.isAccessAllowedForUrl(providerId, sessions[0].account.label, options.mcpServerId, options.mcpServerUrl)) {
    return sessions[0];
  }
  return void 0;
}
async function authenticateMcpSession(providerId, session, scopes, authenticationMcpAccessService, authenticationMcpService, authenticationMcpUsageService, logService, options, updateAccess, agentHost) {
  await forwardAuthenticationToken(options, options.mcpServerUrl, scopes, session.accessToken);
  if (updateAccess) {
    authenticationMcpAccessService.updateAllowedMcpServers(providerId, session.account.label, [{ id: options.mcpServerId, name: options.mcpServerName, allowed: true, url: options.mcpServerUrl, agentHost }]);
    authenticationMcpService.updateAccountPreference(options.mcpServerId, providerId, session.account);
  }
  authenticationMcpUsageService.addAccountUsage(providerId, session.account.label, scopes, options.mcpServerId, options.mcpServerName);
  logService.info(`${options.logPrefix} MCP authentication succeeded for ${options.mcpServerName}`);
}
export {
  AgentHostAuthTokenCache,
  agentHostMcpServerId,
  authenticateProtectedResources,
  resolveAuthenticationInteractively,
  resolveMcpServerAuthentication,
  resolveTokenForResource
};
