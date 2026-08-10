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
import { Disposable, DisposableMap, DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../../base/common/observable.js";
import { affectsAgentHostProviderPreference, IAgentHostService, shouldSurfaceLocalAgentHostProvider } from "../../../../../../platform/agentHost/common/agentService.js";
import { IAgentHostEnablementService } from "../../../../../../platform/agentHost/common/agentHostEnablementService.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { IWorkbenchEnvironmentService } from "../../../../../services/environment/common/environmentService.js";
import { IChatSessionsService } from "../../../common/chatSessionsService.js";
import { IAgentHostSessionWorkingDirectoryResolver } from "./agentHostSessionWorkingDirectoryResolver.js";
import { AgentHostSessionListController } from "./agentHostSessionListController.js";
import { AgentHostSessionListStore } from "./agentHostSessionListStore.js";
let AgentHostSessionListContribution = class extends Disposable {
  constructor(_agentHostService, _chatSessionsService, _configurationService, _instantiationService, environmentService, _workingDirectoryResolver, agentHostEnablementService) {
    super();
    this._agentHostService = _agentHostService;
    this._chatSessionsService = _chatSessionsService;
    this._configurationService = _configurationService;
    this._instantiationService = _instantiationService;
    this._workingDirectoryResolver = _workingDirectoryResolver;
    this._agentRegistrations = this._register(new DisposableMap());
    this._initialized = false;
    this._isSessionsWindow = environmentService.isSessionsWindow;
    if (this._isSessionsWindow) {
      return;
    }
    this._register(autorun((reader) => {
      if (agentHostEnablementService.enabled.read(reader)) {
        this._initialize();
      }
    }));
  }
  static {
    this.ID = "workbench.contrib.agentHostSessionListContribution";
  }
  _initialize() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;
    const sessionListStore = this._register(this._instantiationService.createInstance(AgentHostSessionListStore, this._agentHostService));
    this._register(this._agentHostService.rootState.onDidChange((rootState) => {
      this._handleRootStateChange(rootState, sessionListStore);
    }));
    this._register(this._agentHostService.onAgentHostStart(() => {
      sessionListStore.resetCache();
    }));
    const initialRootState = this._agentHostService.rootState.value;
    if (initialRootState && !(initialRootState instanceof Error)) {
      this._handleRootStateChange(initialRootState, sessionListStore);
    }
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (!affectsAgentHostProviderPreference(e, this._isSessionsWindow)) {
        return;
      }
      const current = this._agentHostService.rootState.value;
      if (current && !(current instanceof Error)) {
        this._handleRootStateChange(current, sessionListStore);
      }
    }));
  }
  _shouldRegisterAgent(provider) {
    return shouldSurfaceLocalAgentHostProvider(provider, this._configurationService, this._isSessionsWindow);
  }
  _handleRootStateChange(rootState, sessionListStore) {
    const allowed = rootState.agents.filter((agent) => this._shouldRegisterAgent(agent.provider));
    const incoming = new Set(allowed.map((agent) => agent.provider));
    for (const [provider] of this._agentRegistrations) {
      if (!incoming.has(provider)) {
        this._agentRegistrations.deleteAndDispose(provider);
      }
    }
    for (const agent of allowed) {
      if (!this._agentRegistrations.has(agent.provider)) {
        this._registerAgent(agent, sessionListStore);
      }
    }
  }
  _registerAgent(agent, sessionListStore) {
    const store = new DisposableStore();
    this._agentRegistrations.set(agent.provider, store);
    const sessionType = `agent-host-${agent.provider}`;
    const listController = store.add(this._instantiationService.createInstance(AgentHostSessionListController, sessionType, agent.provider, sessionListStore, void 0, "local"));
    store.add(this._chatSessionsService.registerChatSessionItemController(sessionType, listController));
    store.add(this._workingDirectoryResolver.registerResolver(sessionType, (_sessionResource) => void 0, (sessionResource) => listController.isNewSession(sessionResource)));
  }
};
AgentHostSessionListContribution = __decorateClass([
  __decorateParam(0, IAgentHostService),
  __decorateParam(1, IChatSessionsService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IWorkbenchEnvironmentService),
  __decorateParam(5, IAgentHostSessionWorkingDirectoryResolver),
  __decorateParam(6, IAgentHostEnablementService)
], AgentHostSessionListContribution);
export {
  AgentHostSessionListContribution
};
