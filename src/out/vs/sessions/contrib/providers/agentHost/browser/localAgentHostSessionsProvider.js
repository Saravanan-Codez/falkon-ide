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
import { Codicon } from "../../../../../base/common/codicons.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../base/common/network.js";
import { autorun, constObservable } from "../../../../../base/common/observable.js";
import { basename, dirname } from "../../../../../base/common/resources.js";
import { localize } from "../../../../../nls.js";
import { LOCAL_AGENT_HOST_AUTHORITY, toAgentHostUri } from "../../../../../platform/agentHost/common/agentHostUri.js";
import { affectsAgentHostProviderPreference, IAgentHostService, shouldSurfaceLocalAgentHostProvider } from "../../../../../platform/agentHost/common/agentService.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { IStorageService } from "../../../../../platform/storage/common/storage.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { IWorkspaceTrustManagementService } from "../../../../../platform/workspace/common/workspaceTrust.js";
import { IAgentHostActiveClientService } from "../../../../../workbench/contrib/chat/browser/agentSessions/agentHost/agentHostActiveClientService.js";
import { IChatWidgetService } from "../../../../../workbench/contrib/chat/browser/chat.js";
import { IChatService } from "../../../../../workbench/contrib/chat/common/chatService/chatService.js";
import { IChatSessionsService } from "../../../../../workbench/contrib/chat/common/chatSessionsService.js";
import { ILanguageModelsService } from "../../../../../workbench/contrib/chat/common/languageModels.js";
import { IWorkbenchEnvironmentService } from "../../../../../workbench/services/environment/common/environmentService.js";
import { LOCAL_AGENT_HOST_PROVIDER_ID } from "../../../../common/agentHostSessionsProvider.js";
import { buildAgentHostSessionWorkspace, readBranchProtectionPatterns } from "../../../../common/agentHostSessionWorkspace.js";
import { SESSION_WORKSPACE_GROUP_LOCAL } from "../../../../services/sessions/common/session.js";
import { ISessionsService } from "../../../../services/sessions/browser/sessionsService.js";
import { IGitHubService } from "../../../github/browser/githubService.js";
import { BaseAgentHostSessionsProvider } from "./baseAgentHostSessionsProvider.js";
const LOCAL_RESOURCE_SCHEME_PREFIX = "agent-host-";
const LOCAL_AGENT_HOST_CACHED_SESSIONS_STORAGE_KEY = "localAgentHost.cachedSessions.v2";
const LOCAL_AGENT_HOST_CACHED_SESSIONS_STORAGE_KEY_LEGACY = "localAgentHost.cachedSessions";
let LocalAgentHostSessionsProvider = class extends BaseAgentHostSessionsProvider {
  constructor(_agentHostService, chatSessionsService, chatService, chatWidgetService, languageModelsService, _labelService, _configurationService, logService, gitHubService, instantiationService, sessionsService, activeClientService, storageService, dialogService, environmentService, workspaceTrustManagementService) {
    super(chatSessionsService, chatService, chatWidgetService, languageModelsService, _configurationService, logService, gitHubService, instantiationService, sessionsService, activeClientService, storageService, dialogService, workspaceTrustManagementService);
    this._agentHostService = _agentHostService;
    this._labelService = _labelService;
    this._configurationService = _configurationService;
    this.id = LOCAL_AGENT_HOST_PROVIDER_ID;
    this.icon = Codicon.vm;
    this.supportsLocalWorkspaces = true;
    this.supportsQuickChats = true;
    this._isSessionsWindow = environmentService.isSessionsWindow;
    this.label = localize("localAgentHostLabel", "Local Agent Host");
    this.browseActions = [];
    this._enableSessionCachePersistence(LOCAL_AGENT_HOST_CACHED_SESSIONS_STORAGE_KEY, LOCAL_AGENT_HOST_CACHED_SESSIONS_STORAGE_KEY_LEGACY);
    const connectionListeners = this._register(new DisposableStore());
    const bindConnection = () => {
      connectionListeners.clear();
      this._attachConnectionListeners(this._agentHostService, connectionListeners);
      const rootState = this._agentHostService.rootState;
      this._syncRootState(rootState.value);
      connectionListeners.add(rootState.onDidChange(() => this._syncRootState(rootState.value)));
      if (rootState.onDidError) {
        connectionListeners.add(rootState.onDidError((error) => this._syncRootState(error)));
      }
    };
    bindConnection();
    this._register(this._agentHostService.onAgentHostStart(bindConnection));
    this._register(autorun((reader) => {
      if (this._agentHostService.authenticationPending.read(reader)) {
        return;
      }
      this._refreshSessions();
      this._resumeNewSessionAfterAuthenticationSettles();
    }));
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (affectsAgentHostProviderPreference(e, this._isSessionsWindow)) {
        this._syncRootState(this._agentHostService.rootState.value);
        this._onDidChangeSessions.fire({ added: [], removed: [], changed: [] });
      }
    }));
  }
  get order() {
    return -1;
  }
  // -- BaseAgentHostSessionsProvider hooks ---------------------------------
  get connection() {
    return this._agentHostService;
  }
  get authenticationPending() {
    return this._agentHostService.authenticationPending;
  }
  _shouldAdvertiseAgent(provider) {
    return shouldSurfaceLocalAgentHostProvider(provider, this._configurationService, this._isSessionsWindow);
  }
  /**
   * Local resource scheme: `agent-host-${provider}`. Must match the type
   * string registered by AgentHostContribution. Distinct from the logical
   * {@link ISession.sessionType}, which is the agent provider name itself
   * (e.g. `copilotcli`) so the same agent shares one session type across
   * local and remote hosts.
   */
  resourceSchemeForProvider(provider) {
    return `${LOCAL_RESOURCE_SCHEME_PREFIX}${provider}`;
  }
  _adapterOptions() {
    return {
      buildWorkspace: (project, workingDirectories, gitHubInfo, gitState) => {
        const primary = workingDirectories?.[0];
        const uriForDescription = project?.uri ?? primary;
        const description = uriForDescription ? this._labelService.getUriLabel(dirname(uriForDescription), { relative: false }) : void 0;
        const branchProtectionPatterns = readBranchProtectionPatterns(this._configurationService, primary ?? project?.uri);
        return LocalAgentHostSessionsProvider.buildWorkspace(project, workingDirectories, gitHubInfo, gitState, description, branchProtectionPatterns);
      }
    };
  }
  _formatSessionTypeLabel(agentLabel) {
    return agentLabel;
  }
  _diffUriMapper() {
    return (uri) => toAgentHostUri(uri, LOCAL_AGENT_HOST_AUTHORITY);
  }
  // -- Workspaces ----------------------------------------------------------
  static buildWorkspace(project, workingDirectories, gitHubInfo, gitState, description, branchProtectionPatterns) {
    return buildAgentHostSessionWorkspace(project, workingDirectories, { providerLabel: void 0, fallbackIcon: Codicon.folder, requiresWorkspaceTrust: true, description, branchProtectionPatterns, group: SESSION_WORKSPACE_GROUP_LOCAL }, gitHubInfo, gitState);
  }
  resolveWorkspace(repositoryUri) {
    if (repositoryUri.scheme !== Schemas.file) {
      return void 0;
    }
    const folderName = basename(repositoryUri) || repositoryUri.path;
    return {
      uri: repositoryUri,
      label: folderName,
      description: this._labelService.getUriLabel(dirname(repositoryUri), { relative: false }),
      group: SESSION_WORKSPACE_GROUP_LOCAL,
      icon: Codicon.folder,
      folders: [{
        root: repositoryUri,
        workingDirectory: repositoryUri,
        name: folderName,
        description: void 0,
        gitRepository: { uri: repositoryUri, workTreeUri: void 0, baseBranchName: void 0, gitHubInfo: constObservable(void 0) }
      }],
      requiresWorkspaceTrust: true,
      isVirtualWorkspace: false
    };
  }
};
LocalAgentHostSessionsProvider = __decorateClass([
  __decorateParam(0, IAgentHostService),
  __decorateParam(1, IChatSessionsService),
  __decorateParam(2, IChatService),
  __decorateParam(3, IChatWidgetService),
  __decorateParam(4, ILanguageModelsService),
  __decorateParam(5, ILabelService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, ILogService),
  __decorateParam(8, IGitHubService),
  __decorateParam(9, IInstantiationService),
  __decorateParam(10, ISessionsService),
  __decorateParam(11, IAgentHostActiveClientService),
  __decorateParam(12, IStorageService),
  __decorateParam(13, IDialogService),
  __decorateParam(14, IWorkbenchEnvironmentService),
  __decorateParam(15, IWorkspaceTrustManagementService)
], LocalAgentHostSessionsProvider);
export {
  LocalAgentHostSessionsProvider
};
