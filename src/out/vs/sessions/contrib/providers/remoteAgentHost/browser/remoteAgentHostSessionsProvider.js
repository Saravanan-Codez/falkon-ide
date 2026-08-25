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
import { Emitter } from "../../../../../base/common/event.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../base/common/network.js";
import { constObservable, observableValue } from "../../../../../base/common/observable.js";
import { isWeb } from "../../../../../base/common/platform.js";
import { basename, dirname } from "../../../../../base/common/resources.js";
import { URI } from "../../../../../base/common/uri.js";
import { localize } from "../../../../../nls.js";
import { agentHostUri } from "../../../../../platform/agentHost/common/agentHostFileSystemProvider.js";
import { AGENT_HOST_SCHEME, agentHostAuthority, fromAgentHostUri, toAgentHostUri } from "../../../../../platform/agentHost/common/agentHostUri.js";
import { AgentSession } from "../../../../../platform/agentHost/common/agentService.js";
import { IRemoteAgentHostService, RemoteAgentHostConnectionStatus } from "../../../../../platform/agentHost/common/remoteAgentHostService.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IDialogService, IFileDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { IWorkspaceTrustManagementService } from "../../../../../platform/workspace/common/workspaceTrust.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { IStorageService } from "../../../../../platform/storage/common/storage.js";
import { IAgentHostActiveClientService } from "../../../../../workbench/contrib/chat/browser/agentSessions/agentHost/agentHostActiveClientService.js";
import { IChatWidgetService } from "../../../../../workbench/contrib/chat/browser/chat.js";
import { IChatService } from "../../../../../workbench/contrib/chat/common/chatService/chatService.js";
import { IChatSessionsService } from "../../../../../workbench/contrib/chat/common/chatSessionsService.js";
import { ILanguageModelsService } from "../../../../../workbench/contrib/chat/common/languageModels.js";
import { buildAgentHostSessionWorkspace, readBranchProtectionPatterns } from "../../../../common/agentHostSessionWorkspace.js";
import { SESSION_WORKSPACE_GROUP_REMOTE } from "../../../../services/sessions/common/session.js";
import { ISessionsService } from "../../../../services/sessions/browser/sessionsService.js";
import { IGitHubService } from "../../../github/browser/githubService.js";
import { BaseAgentHostSessionsProvider } from "../../agentHost/browser/baseAgentHostSessionsProvider.js";
import { remoteAgentHostSessionTypeId } from "../../../../../platform/agentHost/common/agentHostSessionType.js";
const CACHED_SESSIONS_STORAGE_PREFIX = "remoteAgentHost.cachedSessions.v2.";
const CACHED_SESSIONS_STORAGE_PREFIX_LEGACY = "remoteAgentHost.cachedSessions.";
function toLocalProjectUri(uri, connectionAuthority) {
  return uri.scheme === Schemas.file ? toAgentHostUri(uri, connectionAuthority) : uri;
}
let RemoteAgentHostSessionsProvider = class extends BaseAgentHostSessionsProvider {
  constructor(config, _fileDialogService, _notificationService, storageService, chatSessionsService, chatService, chatWidgetService, languageModelsService, _remoteAgentHostService, _labelService, _configurationService, logService, gitHubService, instantiationService, sessionsService, activeClientService, dialogService, workspaceTrustManagementService) {
    super(chatSessionsService, chatService, chatWidgetService, languageModelsService, _configurationService, logService, gitHubService, instantiationService, sessionsService, activeClientService, storageService, dialogService, workspaceTrustManagementService);
    this._fileDialogService = _fileDialogService;
    this._notificationService = _notificationService;
    this._remoteAgentHostService = _remoteAgentHostService;
    this._labelService = _labelService;
    this._configurationService = _configurationService;
    this.icon = Codicon.remote;
    this._connectionStatus = observableValue("connectionStatus", RemoteAgentHostConnectionStatus.disconnected);
    /**
     * Forces this host's sessions read-only. Distinct from `disconnected`: a disconnected host may
     * come back, so its sessions stay writable and queue on reconnect, whereas this marks a host
     * that is gone and whose sessions exist only as replayed history.
     */
    this._readOnly = observableValue("providerReadOnly", false);
    this.connectionStatus = this._connectionStatus;
    /**
     * `true` while we are still resolving and pushing tokens for the host's
     * `protectedResources`. Defaults to `true` so that sessions surface as
     * loading until the first authentication pass settles.
     */
    this._authenticationPending = observableValue("authenticationPending", true);
    this._authenticationSettled = false;
    this._onDidDisconnect = this._register(new Emitter());
    this._connectionListeners = this._register(new DisposableStore());
    /**
     * When `true`, the provider has been marked unreachable and sessions are
     * hidden from {@link getSessions}, even though {@link _sessionCache} and
     * persistent storage are retained. Cleared when a new connection is wired
     * up in {@link setConnection}, at which point the cached entries are
     * re-announced so the UI can repopulate.
     */
    this._unpublished = false;
    this._connectionAuthority = agentHostAuthority(config.address);
    this._connectOnDemand = config.connectOnDemand;
    this._disconnectOnDemand = config.disconnectOnDemand;
    this._sessionSchemeAlias = config.sessionSchemeAlias;
    this.onDidReportConnectProgress = config.onDidReportConnectProgress;
    this.canConnectOnDemand = !!config.connectOnDemand;
    const displayName = config.name || config.address;
    this.id = `agenthost-${this._connectionAuthority}`;
    this.label = displayName;
    this.remoteAddress = config.address;
    this.remoteLocationPreferenceKey = config.preferenceKey ?? config.address;
    this._storageKey = `${CACHED_SESSIONS_STORAGE_PREFIX}${this._connectionAuthority}`;
    this.browseActions = [{
      label: localize("folders", "Folders"),
      description: displayName,
      group: SESSION_WORKSPACE_GROUP_REMOTE,
      icon: Codicon.remote,
      providerId: this.id,
      run: () => this._browseForFolder(),
      listFolders: (query, token) => this._listRemoteFolders(query, token)
    }];
    this._enableSessionCachePersistence(this._storageKey, `${CACHED_SESSIONS_STORAGE_PREFIX_LEGACY}${this._connectionAuthority}`);
  }
  get onConnectionLost() {
    return this._onDidDisconnect.event;
  }
  /**
   * Overridable seam so tests can exercise both the web and non-web
   * branches of the label/description gating without depending on the
   * ambient {@link isWeb} constant (the browser test runner always
   * reports `isWeb === true`).
   */
  get isWebPlatform() {
    return isWeb;
  }
  // -- BaseAgentHostSessionsProvider hooks ---------------------------------
  get connection() {
    return this._connection;
  }
  get authenticationPending() {
    return this._authenticationPending;
  }
  /**
   * Suspend cache-change tracking while sessions are unpublished (offline) so
   * the on-disk snapshot survives an unreachable host. See
   * {@link unpublishCachedSessions}.
   */
  _shouldTrackSessionCacheChanges() {
    return !this._unpublished;
  }
  _adapterOptions() {
    const web = this.isWebPlatform;
    return {
      readOnly: this._readOnly,
      buildWorkspace: (project, workingDirectories, gitHubInfo, gitState) => {
        const primary = workingDirectories?.[0];
        const uriForDescription = project?.uri ?? primary;
        const description = uriForDescription ? this._labelService.getUriLabel(dirname(uriForDescription), { relative: false }) : void 0;
        const branchProtectionPatterns = readBranchProtectionPatterns(this._configurationService, primary ?? project?.uri);
        return RemoteAgentHostSessionsProvider.buildWorkspace(project, workingDirectories, web ? void 0 : this.label, gitHubInfo, gitState, description, branchProtectionPatterns);
      }
    };
  }
  resourceSchemeForProvider(provider) {
    return remoteAgentHostSessionTypeId(this._connectionAuthority, provider);
  }
  getSessions() {
    return this._unpublished ? [] : super.getSessions();
  }
  mapWorkingDirectoryUri(uri) {
    return toAgentHostUri(uri, this._connectionAuthority);
  }
  mapProjectUri(uri) {
    return toLocalProjectUri(uri, this._connectionAuthority);
  }
  _diffUriMapper() {
    return (uri) => toAgentHostUri(uri, this._connectionAuthority);
  }
  _validateBeforeCreate(_sessionType) {
    if (!this._connection) {
      throw new Error(localize("notConnectedSession", "Cannot create session: not connected to remote agent host '{0}'.", this.label));
    }
  }
  _noAgentsErrorMessage() {
    return localize("noAgents", "Remote agent host '{0}' has not advertised any agents yet.", this.label);
  }
  _notConnectedSendErrorMessage() {
    return localize("notConnectedSend", "Cannot send request: not connected to remote agent host '{0}'.", this.label);
  }
  // -- Connection lifecycle ------------------------------------------------
  /**
   * Establish (or re-establish) the connection for this host on demand.
   * Tunnel-backed providers use their relay hook; other providers fall
   * back to the generic remote agent host reconnect path.
   */
  async connect() {
    if (this._connectOnDemand) {
      await this._connectOnDemand();
      return;
    }
    this._remoteAgentHostService.reconnect(this.remoteAddress);
  }
  /**
   * Tear down the active connection for this host. Tunnel-backed providers
   * use their relay hook; other providers fall back to the generic remote
   * agent host disconnect path. Cached sessions are hidden from the UI so
   * the sessions list reflects the disconnected state; the persisted cache
   * is retained so sessions can be restored on reconnect.
   */
  async disconnect() {
    this.unpublishCachedSessions();
    if (this._disconnectOnDemand) {
      await this._disconnectOnDemand();
      return;
    }
    await this._remoteAgentHostService.removeRemoteAgentHost(this.remoteAddress);
  }
  /** Update the connection status for this provider. */
  setConnectionStatus(status) {
    this._connectionStatus.set(status, void 0);
  }
  /**
   * Forces every session on this host to be read-only.
   *
   * Set when the host is permanently unreachable and its sessions are being served from
   * persisted history: the conversation is genuine, but there is no host left to send to, so the
   * composer must be hidden rather than accept input that can never be delivered.
   */
  setReadOnly(readOnly) {
    this._readOnly.set(readOnly, void 0);
  }
  /**
   * Seed discovered session summaries into the cache so they surface in the
   * sessions list **before** a connection is established (lazy discovery). Each
   * summary becomes a cached adapter keyed by its raw session id; entries that
   * already exist (e.g. from a prior live `listSessions()` or persistence) are
   * left untouched so the live refresh stays authoritative. Opening a seeded
   * session triggers `connectOnDemand` via the async activation registry, after
   * which `_refreshSessions` reconciles the seed with the host's real state.
   */
  seedSessions(metas) {
    const added = [];
    for (const rawMeta of metas) {
      const meta = this._adoptSessionMeta(rawMeta);
      const rawId = AgentSession.id(meta.session);
      if (this._sessionCache.has(rawId)) {
        continue;
      }
      const adapter = this.createAdapter(meta);
      this._sessionCache.set(rawId, adapter);
      added.push(adapter);
    }
    if (added.length > 0) {
      this._onDidChangeSessions.fire({ added, removed: [], changed: [] });
    }
  }
  /**
   * Map a host-reported session URI onto the UI scheme, so the session routes to the agent's
   * content provider. The raw id is preserved, so cache keys are unaffected.
   */
  _adoptSessionMeta(meta) {
    const alias = this._sessionSchemeAlias;
    if (!alias || meta.session.scheme !== alias.backend) {
      return meta;
    }
    return { ...meta, session: meta.session.with({ scheme: alias.ui }) };
  }
  /**
   * Inverse of {@link _adoptSessionMeta}: map the UI scheme back to the one the host's session
   * registry is keyed by, so backend calls address the URI the host knows.
   */
  _backendSessionScheme(agentProvider) {
    const alias = this._sessionSchemeAlias;
    return alias && agentProvider === alias.ui ? alias.backend : agentProvider;
  }
  setAuthenticationPending(pending) {
    if (this._authenticationSettled) {
      return;
    }
    if (!pending) {
      this._authenticationSettled = true;
    }
    this._authenticationPending.set(pending, void 0);
    if (!pending) {
      this._resumeNewSessionAfterAuthenticationSettles();
    }
  }
  /**
   * Wire a live connection to this provider, enabling session operations and folder browsing.
   */
  setConnection(connection, defaultDirectory) {
    if (this._connection === connection && this._defaultDirectory === defaultDirectory) {
      return;
    }
    const wasUnpublished = this._unpublished;
    this._connectionListeners.clear();
    this._sessionStateSubscriptions.clearAndDisposeAll();
    this._connection = connection;
    this._defaultDirectory = defaultDirectory;
    this._unpublished = false;
    this._syncRootState(connection.rootState.value);
    this._connectionListeners.add(connection.rootState.onDidChange(() => {
      this._syncRootState(connection.rootState.value);
    }));
    if (connection.rootState.onDidError) {
      this._connectionListeners.add(connection.rootState.onDidError((error) => {
        this._syncRootState(error);
      }));
    }
    this._attachConnectionListeners(connection, this._connectionListeners);
    this._refreshSessions(wasUnpublished);
  }
  /**
   * Clear the connection, e.g. when the remote host disconnects.
   * Retains the provider registration so it remains visible in the UI,
   * and **preserves** the cached session list so previously loaded
   * sessions stay visible while we're offline. Callers that know the
   * host is unreachable should follow up with {@link unpublishCachedSessions}.
   */
  clearConnection() {
    this._connectionListeners.clear();
    this._sessionStateSubscriptions.clearAndDisposeAll();
    this._onDidDisconnect.fire();
    this._connection = void 0;
    this._defaultDirectory = void 0;
    this._disposeAllNewSessions();
    this._syncRootState(void 0);
    if (this._pendingSession) {
      const pending = this._pendingSession;
      this._pendingSession = void 0;
      this._onDidChangeSessions.fire({ added: [], removed: [pending], changed: [] });
    }
    this._cacheInitialized = false;
    this._cancelSessionRefreshRetry();
  }
  /**
   * Hide cached sessions from the UI without discarding them. Called by the
   * host-tracking contributions when they determine the remote host is
   * unreachable (tunnel offline or SSH reconnect failed). The in-memory
   * cache and persisted storage are left intact so the sessions can be
   * restored if the host comes back online in this session, or on the next
   * launch. The next {@link setConnection} call re-announces the cached
   * entries.
   */
  unpublishCachedSessions() {
    if (this._unpublished) {
      return;
    }
    this._unpublished = true;
    if (this._sessionCache.size > 0) {
      this._onDidChangeSessions.fire({ added: [], removed: [], changed: [] });
    }
  }
  // -- Session-type sync ---------------------------------------------------
  _formatSessionTypeLabel(agentLabel) {
    if (this.isWebPlatform) {
      return agentLabel;
    }
    return `${agentLabel} [${this.label}]`;
  }
  // -- Workspaces ----------------------------------------------------------
  static buildWorkspace(project, workingDirectories, providerLabel, gitHubInfo, gitState, description, branchProtectionPatterns) {
    return buildAgentHostSessionWorkspace(project, workingDirectories, { providerLabel, fallbackIcon: Codicon.remote, requiresWorkspaceTrust: true, description, branchProtectionPatterns, group: SESSION_WORKSPACE_GROUP_REMOTE }, gitHubInfo, gitState);
  }
  _buildWorkspaceFromUri(uri) {
    const folderName = basename(uri) || uri.path;
    return {
      uri,
      label: this.isWebPlatform ? folderName : `${folderName} [${this.label}]`,
      description: this._labelService.getUriLabel(dirname(uri), { relative: false }),
      group: SESSION_WORKSPACE_GROUP_REMOTE,
      icon: Codicon.remote,
      folders: [{
        root: uri,
        workingDirectory: uri,
        name: folderName,
        description: void 0,
        gitRepository: { uri, workTreeUri: void 0, baseBranchName: void 0, gitHubInfo: constObservable(void 0) }
      }],
      requiresWorkspaceTrust: true,
      isVirtualWorkspace: false
    };
  }
  resolveWorkspace(repositoryUri) {
    if (repositoryUri.scheme !== AGENT_HOST_SCHEME) {
      return void 0;
    }
    if (repositoryUri.authority !== this._connectionAuthority) {
      return void 0;
    }
    return this._buildWorkspaceFromUri(repositoryUri);
  }
  // -- Browse --------------------------------------------------------------
  async _browseForFolder() {
    if (!this._connection && this._connectOnDemand) {
      try {
        await this._connectOnDemand();
      } catch (err) {
        this._notificationService.error(localize("connectFailed", "Failed to connect to remote agent host '{0}': {1}", this.label, err instanceof Error ? err.message : String(err)));
        return void 0;
      }
    }
    if (!this._connection) {
      this._notificationService.error(localize("notConnected", "Unable to connect to remote agent host '{0}'.", this.label));
      return void 0;
    }
    const defaultUri = agentHostUri(this._connectionAuthority, this._defaultDirectory ?? "/");
    try {
      const selected = await this._fileDialogService.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        title: localize("selectRemoteFolder", "Select Folder on {0}", this.label),
        availableFileSystems: [AGENT_HOST_SCHEME],
        defaultUri
      });
      if (selected?.[0]) {
        return this._buildWorkspaceFromUri(selected[0]);
      }
    } catch {
    }
    return void 0;
  }
  /**
   * Enumerate subdirectories below {@link _defaultDirectory}, filtered
   * by a case-insensitive substring query. Backs the inline folder
   * list rendered by the mobile workspace picker sheet so users can
   * pick a folder without opening a separate file-dialog.
   *
   * The query supports light path navigation: a `/` in the query is
   * treated as a path delimiter, listing children of `<default>/<prefix>`
   * and matching the part after the last slash. So typing `projects/`
   * drills into the `projects` directory, and `projects/foo` lists
   * children of `projects` whose name contains `foo`.
   *
   * Hidden directories (those starting with `.`) are omitted, results
   * are sorted by name, and the cancellation token is honored before
   * and after the network round-trip so stale queries don't surface
   * after the user has typed more characters.
   */
  async _listRemoteFolders(query, token) {
    if (!this._connection && this._connectOnDemand) {
      try {
        await this._connectOnDemand();
      } catch {
        return [];
      }
    }
    if (!this._connection || token.isCancellationRequested) {
      return [];
    }
    const rootAgentHostUri = agentHostUri(this._connectionAuthority, this._defaultDirectory ?? "/");
    const trimmed = query.trim();
    const lastSlash = trimmed.lastIndexOf("/");
    let listingAgentHostUri = rootAgentHostUri;
    let filter = trimmed;
    if (lastSlash >= 0) {
      const subPath = trimmed.slice(0, lastSlash).replace(/^\/+|\/+$/g, "");
      filter = trimmed.slice(lastSlash + 1);
      if (subPath) {
        listingAgentHostUri = URI.joinPath(rootAgentHostUri, subPath);
      }
    }
    const listingOriginalUri = fromAgentHostUri(listingAgentHostUri);
    let entries;
    try {
      const result = await this._connection.resourceList(listingOriginalUri);
      entries = result.entries;
    } catch {
      return [];
    }
    if (token.isCancellationRequested) {
      return [];
    }
    const lowerFilter = filter.toLocaleLowerCase();
    const folders = [];
    for (const entry of entries) {
      if (entry.type !== "directory") {
        continue;
      }
      if (entry.name.startsWith(".")) {
        continue;
      }
      if (lowerFilter && !entry.name.toLocaleLowerCase().includes(lowerFilter)) {
        continue;
      }
      const childUri = URI.joinPath(listingAgentHostUri, entry.name);
      folders.push({ ...this._buildWorkspaceFromUri(childUri), icon: Codicon.folder });
    }
    folders.sort((a, b) => a.label.localeCompare(b.label));
    return folders;
  }
};
RemoteAgentHostSessionsProvider = __decorateClass([
  __decorateParam(1, IFileDialogService),
  __decorateParam(2, INotificationService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IChatSessionsService),
  __decorateParam(5, IChatService),
  __decorateParam(6, IChatWidgetService),
  __decorateParam(7, ILanguageModelsService),
  __decorateParam(8, IRemoteAgentHostService),
  __decorateParam(9, ILabelService),
  __decorateParam(10, IConfigurationService),
  __decorateParam(11, ILogService),
  __decorateParam(12, IGitHubService),
  __decorateParam(13, IInstantiationService),
  __decorateParam(14, ISessionsService),
  __decorateParam(15, IAgentHostActiveClientService),
  __decorateParam(16, IDialogService),
  __decorateParam(17, IWorkspaceTrustManagementService)
], RemoteAgentHostSessionsProvider);
export {
  RemoteAgentHostSessionsProvider
};
