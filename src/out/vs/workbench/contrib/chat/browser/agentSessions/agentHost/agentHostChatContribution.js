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
import { Codicon } from "../../../../../../base/common/codicons.js";
import { Event } from "../../../../../../base/common/event.js";
import { Disposable, DisposableMap, DisposableStore, toDisposable } from "../../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../../base/common/observable.js";
import { mark } from "../../../../../../base/common/performance.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { localize } from "../../../../../../nls.js";
import { affectsAgentHostProviderPreference, IAgentHostService, protectedResourcesRequireGitHubCopilotSignIn, shouldSurfaceLocalAgentHostProvider } from "../../../../../../platform/agentHost/common/agentService.js";
import { IAgentHostEnablementService } from "../../../../../../platform/agentHost/common/agentHostEnablementService.js";
import { LOCAL_AGENT_HOST_AUTHORITY } from "../../../../../../platform/agentHost/common/agentHostUri.js";
import { NotificationType } from "../../../../../../platform/agentHost/common/state/sessionActions.js";
import { CHATGPT_SUBSCRIPTION_MODEL_SOURCE_ID } from "../../../../../../platform/agentHost/common/agentModelSource.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IDefaultAccountService } from "../../../../../../platform/defaultAccount/common/defaultAccount.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../../platform/log/common/log.js";
import { Registry } from "../../../../../../platform/registry/common/platform.js";
import { IAgentHostFileSystemService } from "../../../../../services/agentHost/common/agentHostFileSystemService.js";
import { IAuthenticationService } from "../../../../../services/authentication/common/authentication.js";
import { IWorkbenchEnvironmentService } from "../../../../../services/environment/common/environmentService.js";
import { ChatSessionsExtensions, IChatSessionsService, isLocalAgentHostTarget } from "../../../common/chatSessionsService.js";
import { ICustomizationHarnessService } from "../../../common/customizationHarnessService.js";
import { ILanguageModelsService } from "../../../common/languageModels.js";
import { languageModelSourcePresentationRegistry } from "../../../common/languageModelSourcePresentation.js";
import { Target } from "../../../common/promptSyntax/promptTypes.js";
import { AgentCustomizationItemProvider } from "./agentCustomizationItemProvider.js";
import { AgentHostDownloadProgress } from "./agentHostDownloadProgress.js";
import { authenticateProtectedResources, AgentHostAuthTokenCache, resolveAuthenticationInteractively } from "./agentHostAuth.js";
import { AgentHostLanguageModelProvider, agentHostProviderSupportsAutoModel } from "./agentHostLanguageModelProvider.js";
import { AgentHostSessionHandler } from "./agentHostSessionHandler.js";
import { AgentHostPromptCacheNotification } from "./agentHostPromptCacheNotification.js";
import { IAgentHostActiveClientService } from "./agentHostActiveClientService.js";
import { IAgentHostProtectedResourcesService } from "./agentHostProtectedResourcesService.js";
import { AICustomizationManagementSection } from "../../../common/aiCustomizationWorkspaceService.js";
const LOCAL_AGENT_HOST_SESSION_TYPE_PREFIX = "agent-host-";
languageModelSourcePresentationRegistry.register({
  ownerVendor: "agent-host-codex",
  sourceId: CHATGPT_SUBSCRIPTION_MODEL_SOURCE_ID,
  label: localize("agentHostModelSource.chatGPT.label", "ChatGPT"),
  icon: Codicon.openai,
  description: localize("agentHostModelSource.chatGPT.description", "Models provided by your ChatGPT subscription")
});
Registry.as(ChatSessionsExtensions.AsyncActivation).register({
  matchSessionType: (sessionType) => isLocalAgentHostTarget(sessionType),
  waitForActivation: waitForLocalAgentHostActivation
});
async function waitForLocalAgentHostActivation(accessor, sessionType) {
  const agentHostEnablementService = accessor.get(IAgentHostEnablementService);
  const agentHostService = accessor.get(IAgentHostService);
  const configurationService = accessor.get(IConfigurationService);
  const environmentService = accessor.get(IWorkbenchEnvironmentService);
  if (!agentHostEnablementService.enabled.get()) {
    return false;
  }
  const provider = getLocalAgentHostProviderForSessionType(sessionType);
  if (!provider) {
    return false;
  }
  while (true) {
    const rootState = agentHostService.rootState.value;
    if (rootState instanceof Error) {
      return false;
    }
    if (rootState) {
      return rootState.agents.some((agent) => agent.provider === provider && shouldSurfaceLocalAgentHostProvider(agent.provider, configurationService, environmentService.isSessionsWindow));
    }
    const changed = await Promise.race([
      Event.toPromise(agentHostService.rootState.onDidChange).then(() => true),
      Event.toPromise(agentHostService.onAgentHostExit).then(() => false)
    ]);
    if (!changed) {
      return false;
    }
  }
}
function getLocalAgentHostProviderForSessionType(sessionType) {
  if (!isLocalAgentHostTarget(sessionType) || !sessionType.startsWith(LOCAL_AGENT_HOST_SESSION_TYPE_PREFIX)) {
    return void 0;
  }
  return sessionType.slice(LOCAL_AGENT_HOST_SESSION_TYPE_PREFIX.length) || void 0;
}
import { AgentHostSessionHandler as AgentHostSessionHandler2 } from "./agentHostSessionHandler.js";
let AgentHostContribution = class extends Disposable {
  constructor(_agentHostService, _chatSessionsService, _defaultAccountService, _authenticationService, _logService, _languageModelsService, _instantiationService, _agentHostFileSystemService, _configurationService, _customizationHarnessService, environmentService, _activeClientService, _protectedResourcesService, agentHostEnablementService) {
    super();
    this._agentHostService = _agentHostService;
    this._chatSessionsService = _chatSessionsService;
    this._defaultAccountService = _defaultAccountService;
    this._authenticationService = _authenticationService;
    this._logService = _logService;
    this._languageModelsService = _languageModelsService;
    this._instantiationService = _instantiationService;
    this._agentHostFileSystemService = _agentHostFileSystemService;
    this._configurationService = _configurationService;
    this._customizationHarnessService = _customizationHarnessService;
    this._activeClientService = _activeClientService;
    this._protectedResourcesService = _protectedResourcesService;
    this._agentRegistrations = this._register(new DisposableMap());
    /** Model providers keyed by agent provider, for pushing model updates. */
    this._modelProviders = /* @__PURE__ */ new Map();
    /** Dedupes redundant `authenticate` RPCs when the resolved token hasn't changed. */
    this._authTokenCache = new AgentHostAuthTokenCache();
    this._initialized = false;
    this._didStartInitialAuthentication = false;
    this._isSessionsWindow = environmentService.isSessionsWindow;
    this._enableSmokeTestDriver = !!environmentService.enableSmokeTestDriver;
    this._register(autorun((reader) => {
      const enabled = agentHostEnablementService.enabled.read(reader);
      if (enabled) {
        this._initialize();
      }
    }));
  }
  static {
    this.ID = "workbench.contrib.agentHostContribution";
  }
  _initialize() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;
    this._promptCacheNotification = this._register(this._instantiationService.createInstance(AgentHostPromptCacheNotification));
    this._register(this._agentHostFileSystemService.registerAuthority(LOCAL_AGENT_HOST_AUTHORITY, this._agentHostService));
    this._register(this._agentHostService.rootState.onDidChange((rootState) => {
      this._handleRootStateChange(rootState);
    }));
    this._register(this._agentHostService.onAgentHostStart(() => {
      this._authTokenCache.clear();
    }));
    if (!this._isSessionsWindow) {
      const downloadProgress = this._register(this._instantiationService.createInstance(AgentHostDownloadProgress));
      this._register(this._agentHostService.onDidNotification((n) => {
        if (n.type === NotificationType.Progress) {
          downloadProgress.handleProgress(n);
        }
      }));
    }
    const initialRootState = this._agentHostService.rootState.value;
    if (initialRootState && !(initialRootState instanceof Error)) {
      this._handleRootStateChange(initialRootState);
    }
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (!affectsAgentHostProviderPreference(e, this._isSessionsWindow)) {
        return;
      }
      const current = this._agentHostService.rootState.value;
      if (current && !(current instanceof Error)) {
        this._handleRootStateChange(current);
      }
    }));
  }
  _shouldRegisterAgent(provider) {
    return shouldSurfaceLocalAgentHostProvider(provider, this._configurationService, this._isSessionsWindow);
  }
  _handleRootStateChange(rootState) {
    const allowed = rootState.agents.filter((a) => this._shouldRegisterAgent(a.provider));
    const incoming = new Set(allowed.map((a) => a.provider));
    for (const [provider] of this._agentRegistrations) {
      if (!incoming.has(provider)) {
        this._agentRegistrations.deleteAndDispose(provider);
        this._modelProviders.delete(provider);
      }
    }
    this._authenticateWithServer(allowed).catch(() => {
    });
    for (const agent of allowed) {
      if (!this._agentRegistrations.has(agent.provider)) {
        this._registerAgent(agent);
      } else {
        const modelProvider = this._modelProviders.get(agent.provider);
        modelProvider?.updateModels(agent.models);
      }
    }
  }
  _registerAgent(agent) {
    const store = new DisposableStore();
    this._agentRegistrations.set(agent.provider, store);
    const sessionType = `agent-host-${agent.provider}`;
    const agentId = sessionType;
    const vendor = sessionType;
    const ahService = this._agentHostService;
    store.add(this._chatSessionsService.registerChatSessionContribution({
      type: sessionType,
      name: agentId,
      displayName: agent.displayName,
      description: agent.description,
      customAgentTarget: this._isSessionsWindow ? void 0 : Target.GitHubCopilot,
      canDelegate: true,
      requiresCustomModels: true,
      supportsAutoModel: agentHostProviderSupportsAutoModel(agent.provider),
      // Derived live from the agent's currently-advertised protected resources
      // (via the protected-resources service): an agent that marks the GitHub
      // Copilot resource `required: false` (Claude in native mode, Codex on
      // OpenAI) is usable without signing in. Falls back to "required" until the
      // agent host resolves. The paired `onDidChangeRequiresCopilotSignIn` lets
      // the sessions service re-evaluate this when the set changes.
      requiresCopilotSignIn: () => {
        const resources = this._protectedResourcesService.getProtectedResources(agent.provider);
        return resources !== void 0 ? protectedResourcesRequireGitHubCopilotSignIn(resources) : true;
      },
      onDidChangeRequiresCopilotSignIn: Event.signal(Event.filter(this._protectedResourcesService.onDidChange, (provider) => provider === agent.provider, store)),
      agentHostProviderId: agent.provider,
      supportsDelegation: true,
      capabilities: {
        supportsCheckpoints: true,
        supportsPromptAttachments: true,
        supportsImageAttachments: true,
        get terminalCommandPrefix() {
          return ahService.initializeResult.get()?.terminalCommandPrefix;
        }
      }
    }));
    const agentRegistration = store.add(this._activeClientService.registerForAgent(sessionType));
    const syncProvider = agentRegistration.syncProvider;
    const itemProvider = store.add(this._instantiationService.createInstance(
      AgentCustomizationItemProvider,
      "local",
      void 0,
      (syncedUri) => agentRegistration.bundler.getOrigin(syncedUri)
    ));
    itemProvider.setDraftCustomAgents(this._activeClientService.getCustomAgents(sessionType));
    itemProvider.setDraftCustomizations(this._activeClientService.getCustomizations(sessionType));
    store.add(this._customizationHarnessService.registerExternalHarness({
      id: sessionType,
      label: localize("agentHostHarnessLabel.local", "{0} [Agent Host]", agent.displayName),
      icon: ThemeIcon.fromId(Codicon.server.id),
      // The Tools section is surfaced for the Copilot CLI agent host only.
      hiddenSections: agent.provider === "copilotcli" ? [AICustomizationManagementSection.Prompts] : [AICustomizationManagementSection.Tools, AICustomizationManagementSection.Prompts],
      hideGenerateButton: true,
      syncProvider,
      itemProvider
    }));
    const sessionHandler = store.add(this._instantiationService.createInstance(AgentHostSessionHandler, {
      provider: agent.provider,
      agentId,
      sessionType,
      fullName: agent.displayName,
      description: agent.description,
      connection: this._agentHostService,
      connectionAuthority: LOCAL_AGENT_HOST_AUTHORITY,
      resolveAuthentication: (resources) => this._resolveAuthenticationInteractively(resources),
      promptCacheNotification: this._promptCacheNotification
    }));
    store.add(this._chatSessionsService.registerChatSessionContentProvider(sessionType, sessionHandler));
    const vendorDescriptor = { vendor, displayName: agent.displayName, configuration: void 0, managementCommand: void 0, when: void 0 };
    this._languageModelsService.deltaLanguageModelChatProviderDescriptors([vendorDescriptor], []);
    store.add(toDisposable(() => this._languageModelsService.deltaLanguageModelChatProviderDescriptors([], [vendorDescriptor])));
    const modelProvider = store.add(new AgentHostLanguageModelProvider(sessionType, vendor));
    this._modelProviders.set(agent.provider, modelProvider);
    store.add(toDisposable(() => this._modelProviders.delete(agent.provider)));
    store.add(this._languageModelsService.registerLanguageModelProvider(vendor, modelProvider));
    modelProvider.updateModels(agent.models);
    store.add(this._defaultAccountService.onDidChangeDefaultAccount(() => {
      const agents = this._getRootAgents();
      this._authenticateWithServer(agents).catch(() => {
      });
    }));
    store.add(this._authenticationService.onDidChangeSessions(() => {
      const agents = this._getRootAgents();
      this._authenticateWithServer(agents).catch(() => {
      });
    }));
  }
  _getRootAgents() {
    const rootState = this._agentHostService.rootState.value;
    const agents = rootState && !(rootState instanceof Error) ? rootState.agents : [];
    return agents.filter((a) => this._shouldRegisterAgent(a.provider));
  }
  /**
   * Authenticate using protectedResources from agent info in root state.
   * Resolves tokens via the standard VS Code authentication service.
   */
  async _authenticateWithServer(agents) {
    const isInitialAuthentication = agents.length > 0 && !this._didStartInitialAuthentication;
    if (isInitialAuthentication) {
      this._didStartInitialAuthentication = true;
      mark("code/agentHost/willAuthenticate");
    }
    this._agentHostService.setAuthenticationPending(true);
    try {
      const testToken = this._getScenarioAutomationToken();
      if (testToken !== void 0) {
        await this._seedTestToken(agents, testToken);
        return;
      }
      await this._instantiationService.invokeFunction(authenticateProtectedResources, agents, {
        authTokenCache: this._authTokenCache,
        logPrefix: "[AgentHost]",
        authenticate: (request) => this._agentHostService.authenticate(request)
      });
    } catch (err) {
      this._logService.error("[AgentHost] Failed to authenticate with server", err);
    } finally {
      this._agentHostService.setAuthenticationPending(false);
      if (isInitialAuthentication) {
        mark("code/agentHost/didAuthenticate");
      }
    }
  }
  /**
   * Interactively prompt the user to authenticate when the server requires it.
   * Uses protectedResources from root state, resolves the auth provider,
   * creates a session (which triggers the login UI), and pushes the token
   * to the server. Returns true if authentication succeeded.
   */
  async _resolveAuthenticationInteractively(protectedResources) {
    const testToken = this._getScenarioAutomationToken();
    if (testToken !== void 0) {
      for (const resource of protectedResources) {
        await this._authTokenCache.authenticate(
          resource.resource,
          resource.scopes_supported,
          testToken,
          () => this._agentHostService.authenticate({ resource: resource.resource, token: testToken })
        );
      }
      return protectedResources.length > 0;
    }
    return this._instantiationService.invokeFunction(resolveAuthenticationInteractively, protectedResources, {
      authTokenCache: this._authTokenCache,
      logPrefix: "[AgentHost]",
      authenticate: (request) => this._agentHostService.authenticate(request)
    });
  }
  async _seedTestToken(agents, token) {
    for (const agent of agents) {
      for (const resource of agent.protectedResources ?? []) {
        await this._authTokenCache.authenticate(
          resource.resource,
          resource.scopes_supported,
          token,
          () => this._agentHostService.authenticate({ resource: resource.resource, token })
        );
      }
    }
  }
  _getScenarioAutomationToken() {
    if (!this._enableSmokeTestDriver) {
      return void 0;
    }
    const token = this._configurationService.getValue("chat.agentHost.unsafeTestToken");
    return typeof token === "string" && token.length > 0 ? token : void 0;
  }
};
AgentHostContribution = __decorateClass([
  __decorateParam(0, IAgentHostService),
  __decorateParam(1, IChatSessionsService),
  __decorateParam(2, IDefaultAccountService),
  __decorateParam(3, IAuthenticationService),
  __decorateParam(4, ILogService),
  __decorateParam(5, ILanguageModelsService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IAgentHostFileSystemService),
  __decorateParam(8, IConfigurationService),
  __decorateParam(9, ICustomizationHarnessService),
  __decorateParam(10, IWorkbenchEnvironmentService),
  __decorateParam(11, IAgentHostActiveClientService),
  __decorateParam(12, IAgentHostProtectedResourcesService),
  __decorateParam(13, IAgentHostEnablementService)
], AgentHostContribution);
export {
  AgentHostContribution,
  AgentHostSessionHandler2 as AgentHostSessionHandler
};
