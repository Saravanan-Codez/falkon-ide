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
import { URI } from "../../../../base/common/uri.js";
import { combinedDisposable, DisposableMap } from "../../../../base/common/lifecycle.js";
import { basename, isEqual } from "../../../../base/common/resources.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IAgentHostCustomizationService, AbstractAgentHostCustomizationService } from "../../../../workbench/contrib/chat/browser/agentSessions/agentHost/agentHostCustomizationService.js";
import { isAgentHostProvider } from "../../../common/agentHostSessionsProvider.js";
import { ISessionsProvidersService } from "../../sessions/browser/sessionsProvidersService.js";
import { ISessionsManagementService } from "../../sessions/common/sessionsManagement.js";
import { ISessionsService } from "../../sessions/browser/sessionsService.js";
import { CustomizationType } from "../../../../platform/agentHost/common/state/sessionState.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
let AgentHostCustomizationService = class extends AbstractAgentHostCustomizationService {
  constructor(_sessionsManagementService, _sessionsService, _sessionsProvidersService, instantiationService, logService, storageService) {
    super(instantiationService, logService, storageService);
    this._sessionsManagementService = _sessionsManagementService;
    this._sessionsService = _sessionsService;
    this._sessionsProvidersService = _sessionsProvidersService;
    this._providerListeners = this._register(new DisposableMap());
    this._register(this._sessionsManagementService.onDidChangeSessions((e) => {
      for (const session of e.removed) {
        this._clearMcpServerTracking(session.resource);
        this._disposeMcpDiagnostics(session.resource);
      }
      this._fireCustomAgentsChanged();
      this._fireCustomizationsChanged();
    }));
  }
  _getSession(sessionResource) {
    const activeSession = this._sessionsService.activeSession.get();
    if (activeSession && isEqual(activeSession.resource, sessionResource)) {
      return activeSession;
    }
    return this._sessionsManagementService.getSession(sessionResource);
  }
  _getAHSProvider(session) {
    const provider = this._sessionsProvidersService.getProvider(session.providerId);
    if (provider && isAgentHostProvider(provider)) {
      this._ensureProviderListener(provider);
      return provider;
    }
    return void 0;
  }
  _resolveTarget(sessionResource) {
    const session = this._getSession(sessionResource);
    if (!session) {
      return void 0;
    }
    const provider = this._getAHSProvider(session);
    if (!provider) {
      return void 0;
    }
    const servers = provider.getMcpServers(session.sessionId);
    return {
      customizations: provider.getCustomizations(session.sessionId),
      workingDirectory: provider.getWorkingDirectory(session.sessionId),
      workingDirectories: provider.getWorkingDirectories(session.sessionId),
      rootConfig: provider.getRootConfig(),
      authenticate: (request) => provider.authenticate(request),
      setCustomizationEnabled: (rawId, enabled) => {
        servers.find((server) => this._serverIdMatchesRawId(server.id, rawId))?.setEnabled(enabled);
      },
      startMcpServer: (rawId) => {
        return servers.find((server) => this._serverIdMatchesRawId(server.id, rawId))?.start() ?? Promise.resolve();
      },
      stopMcpServer: (rawId) => {
        return servers.find((server) => this._serverIdMatchesRawId(server.id, rawId))?.stop() ?? Promise.resolve();
      },
      setRootConfigValue: (property, value) => {
        void provider.setRootConfigValue(property, value);
      }
    };
  }
  getCustomAgents(sessionResource) {
    const session = this._getSession(sessionResource);
    if (session) {
      const provider = this._getAHSProvider(session);
      if (provider) {
        const agents = provider.getCustomAgents(session.sessionId);
        const activeMode = session.mode.get()?.id;
        return agents.length === 0 && activeMode ? [this._agentFromMode(activeMode)] : agents;
      }
    }
    return [];
  }
  _ensureProviderListener(provider) {
    if (this._providerListeners.has(provider)) {
      return;
    }
    this._providerListeners.set(provider, combinedDisposable(
      provider.onDidChangeCustomAgents(() => {
        this._fireCustomAgentsChanged();
      }),
      provider.onDidChangeCustomizations(() => {
        this._fireCustomizationsChanged();
      })
    ));
  }
  _serverIdMatchesRawId(serverId, rawId) {
    const separator = serverId.indexOf("/");
    return serverId === rawId || separator >= 0 && serverId.slice(separator + 1) === rawId;
  }
  _agentFromMode(uri) {
    return {
      id: uri,
      uri,
      name: agentNameFromUri(uri),
      type: CustomizationType.Agent
    };
  }
};
AgentHostCustomizationService = __decorateClass([
  __decorateParam(0, ISessionsManagementService),
  __decorateParam(1, ISessionsService),
  __decorateParam(2, ISessionsProvidersService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, ILogService),
  __decorateParam(5, IStorageService)
], AgentHostCustomizationService);
function agentNameFromUri(uri) {
  try {
    let name = basename(URI.parse(uri));
    for (const suffix of [".agent.md", ".md"]) {
      if (name.endsWith(suffix)) {
        name = name.substring(0, name.length - suffix.length);
        break;
      }
    }
    return name || uri;
  } catch {
    return uri;
  }
}
registerSingleton(IAgentHostCustomizationService, AgentHostCustomizationService, InstantiationType.Delayed);
export {
  AgentHostCustomizationService
};
