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
import { SequencerByKey } from "../../../../../../base/common/async.js";
import { Emitter } from "../../../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { ResourceMap, ResourceSet } from "../../../../../../base/common/map.js";
import { equals } from "../../../../../../base/common/objects.js";
import { autorun } from "../../../../../../base/common/observable.js";
import { isEqual } from "../../../../../../base/common/resources.js";
import { URI } from "../../../../../../base/common/uri.js";
import { generateUuid } from "../../../../../../base/common/uuid.js";
import { IAgentHostService } from "../../../../../../platform/agentHost/common/agentService.js";
import { KNOWN_MODE_VALUES, SessionConfigKey } from "../../../../../../platform/agentHost/common/sessionConfigKeys.js";
import { migrateLegacyAutopilotConfig } from "../../../../../../platform/agentHost/common/agentHostSchema.js";
import { ActionType } from "../../../../../../platform/agentHost/common/state/protocol/actions.js";
import { areSessionWorkingDirectoriesEqual } from "../../../../../../platform/agentHost/common/state/sessionWorkingDirectories.js";
import { withSessionMultiRootMetadata } from "../../../../../../platform/agentHost/common/state/sessionState.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { InstantiationType, registerSingleton } from "../../../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../../platform/log/common/log.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../../../platform/workspace/common/workspace.js";
import { IWorkspaceTrustManagementService } from "../../../../../../platform/workspace/common/workspaceTrust.js";
import { IWorkbenchEnvironmentService } from "../../../../../services/environment/common/environmentService.js";
import { ChatConfiguration, getChatPermissionLevelFromDefaultConfiguration } from "../../../common/constants.js";
import { IChatService } from "../../../common/chatService/chatService.js";
import { IAgentHostNewSessionFolderService, computeDesiredWorkingDirectories, computeWorkingDirectories, hasImmutablePrimaryWorkingDirectory, supportsMultipleWorkingDirectories } from "./agentHostNewSessionFolderService.js";
import { IAgentHostActiveClientService } from "./agentHostActiveClientService.js";
import { IAgentHostImportConversationStore } from "./agentHostImportConversationStore.js";
const IAgentHostUntitledProvisionalSessionService = createDecorator("agentHostUntitledProvisionalSessionService");
let AgentHostUntitledProvisionalSessionService = class extends Disposable {
  constructor(_agentHostService, _logService, chatService, _configurationService, _environmentService, _newSessionFolderService, _workspaceContextService, _workspaceTrustManagementService, _importConversationStore, _activeClientService) {
    super();
    this._agentHostService = _agentHostService;
    this._logService = _logService;
    this._configurationService = _configurationService;
    this._environmentService = _environmentService;
    this._newSessionFolderService = _newSessionFolderService;
    this._workspaceContextService = _workspaceContextService;
    this._workspaceTrustManagementService = _workspaceTrustManagementService;
    this._importConversationStore = _importConversationStore;
    this._activeClientService = _activeClientService;
    this._entries = new ResourceMap();
    this._pending = new ResourceMap();
    this._resolvedConfigs = new ResourceMap();
    this._resolvedConfigRequestSeq = new ResourceMap();
    this._pendingBackendDisposals = new ResourceSet();
    // URIs that were the source of a successful `tryRebind`. The chat widget
    // briefly reattaches to the old untitled URI before its viewModel switches
    // to the new real URI; without this tombstone the picker would call
    // `getOrCreate` again and spin up an orphan provisional session on the agent.
    this._rebound = new ResourceSet();
    this._sequencer = new SequencerByKey();
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._register(chatService.onDidDisposeSession((e) => {
      for (const sessionResource of e.sessionResources) {
        if (this._entries.has(sessionResource)) {
          void this.disposeSession(sessionResource);
        }
        this._resolvedConfigs.delete(sessionResource);
        this._resolvedConfigRequestSeq.delete(sessionResource);
        this._rebound.delete(sessionResource);
      }
    }));
    this._register(this._newSessionFolderService.onDidChangeFolder((sessionResource) => {
      const folder = this._newSessionFolderService.getFolder(sessionResource);
      if (folder && this._entries.has(sessionResource)) {
        void this._changeWorkingDirectory(sessionResource, folder);
      }
    }));
    this._register(this._workspaceContextService.onDidChangeWorkspaceFolders(() => {
      for (const [sessionResource, entry] of this._entries) {
        if (entry.disposed) {
          continue;
        }
        if (!entry.usesWorkspaceRootSet && (this._computeWorkingDirectories(entry.workingDirectory, entry.provider)?.length ?? 0) > 1) {
          entry.usesWorkspaceRootSet = true;
        }
        if (entry.usesWorkspaceRootSet && !this._generationMatchingDesiredState(entry)) {
          void this._queue(sessionResource, () => this._reconcileGeneration(sessionResource, entry));
        }
      }
    }));
    this._register(this._agentHostService.onAgentHostStart(() => this._retryPendingBackendDisposals()));
  }
  get(sessionResource) {
    const entry = this._entries.get(sessionResource);
    if (!entry || entry.disposed) {
      return void 0;
    }
    return this._generationMatchingDesiredState(entry)?.backendSession;
  }
  _computeWorkingDirectories(primary, provider) {
    return computeWorkingDirectories(primary, this._workspaceContextService.getWorkspace().folders.map((folder) => folder.uri), this._agentHostService.rootState.value, provider);
  }
  _computeEntryWorkingDirectories(entry) {
    const primary = entry.workingDirectory;
    if (!primary || !entry.usesWorkspaceRootSet || !supportsMultipleWorkingDirectories(this._agentHostService.rootState.value, entry.provider)) {
      return primary ? [primary] : void 0;
    }
    const current = entry.generation?.workingDirectories ?? [primary];
    return computeDesiredWorkingDirectories(
      primary,
      current,
      this._workspaceContextService.getWorkspace().folders.map((folder) => folder.uri)
    );
  }
  getInitialSessionMetadata() {
    const workspace = this._workspaceContextService.getWorkspace();
    if (this._environmentService.isSessionsWindow || this._workspaceContextService.getWorkbenchState() !== WorkbenchState.WORKSPACE || !URI.isUri(workspace.configuration)) {
      return void 0;
    }
    return withSessionMultiRootMetadata(void 0, {
      workspaceFile: workspace.configuration.toString()
    });
  }
  getInitialSessionConfig() {
    return this._getInitialConfig();
  }
  async waitForPending(sessionResource) {
    while (true) {
      const pending = this._pending.get(sessionResource);
      if (!pending) {
        return this.get(sessionResource);
      }
      try {
        await pending;
      } catch {
        return void 0;
      }
      if (this._pending.get(sessionResource) === pending) {
        return this.get(sessionResource);
      }
    }
  }
  getOrCreate(sessionResource, provider, workingDirectory) {
    const existing = this.get(sessionResource);
    if (existing) {
      return Promise.resolve(existing);
    }
    if (this._rebound.has(sessionResource)) {
      return Promise.resolve(void 0);
    }
    const inflight = this._pending.get(sessionResource);
    if (inflight) {
      return inflight.then(() => this.get(sessionResource));
    }
    const entry = this._ensureEntry(sessionResource, provider, workingDirectory);
    if (!entry) {
      return Promise.resolve(void 0);
    }
    return this._queue(sessionResource, async () => {
      const settled = this.get(sessionResource);
      if (settled) {
        return settled;
      }
      return this._reconcileGeneration(sessionResource, entry);
    });
  }
  _ensureEntry(sessionResource, provider, workingDirectory) {
    const existing = this._entries.get(sessionResource);
    if (existing) {
      return existing;
    }
    if (this._rebound.has(sessionResource)) {
      return void 0;
    }
    const entry = this._createEntry(provider, { ...this._getInitialConfig() ?? {} }, 0, workingDirectory);
    this._entries.set(sessionResource, entry);
    return entry;
  }
  _createEntry(provider, config, configVersion, workingDirectory, resolvedConfig) {
    const entry = {
      provider,
      activeClientSync: new DisposableStore(),
      generation: void 0,
      config,
      configVersion,
      workingDirectory,
      usesWorkspaceRootSet: (this._computeWorkingDirectories(workingDirectory, provider)?.length ?? 0) > 1,
      resolvedConfig,
      disposed: false
    };
    entry.activeClientSync.add(autorun((reader) => {
      this._activeClientService.getCustomizations(`agent-host-${provider}`).read(reader);
      this._publishActiveClient(entry);
    }));
    return entry;
  }
  _publishActiveClient(entry) {
    if (entry.disposed || !entry.generation) {
      return;
    }
    this._agentHostService.dispatch(entry.generation.backendSession.toString(), {
      type: ActionType.SessionActiveClientSet,
      activeClient: this._activeClientService.getActiveClient(`agent-host-${entry.provider}`, this._agentHostService.clientId)
    });
  }
  /**
   * Serializes lifecycle work for one logical draft and records its latest tail
   * so external callers can wait for a stable current generation.
   */
  _queue(sessionResource, task) {
    const work = this._sequencer.queue(sessionResource.toString(), task);
    this._pending.set(sessionResource, work);
    void work.finally(() => {
      if (this._pending.get(sessionResource) === work) {
        this._pending.delete(sessionResource);
      }
    }).catch(() => {
    });
    return work;
  }
  _generationMatchingDesiredState(entry) {
    const generation = entry.generation;
    const desired = this._computeEntryWorkingDirectories(entry);
    return generation && this._sameUri(generation.workingDirectory, entry.workingDirectory) && this._sameWorkingDirectories(entry.provider, generation.workingDirectories, desired) ? generation : void 0;
  }
  _sameUri(first, second) {
    return first === void 0 || second === void 0 ? first === second : isEqual(first, second);
  }
  /** Provider-agnostic: only an agent advertising `immutablePrimary` pins index 0. */
  _sameWorkingDirectories(provider, first, second) {
    return areSessionWorkingDirectoriesEqual(first, second, hasImmutablePrimaryWorkingDirectory(this._agentHostService.rootState.value, provider));
  }
  _newProvisionalUri(provider) {
    return URI.from({ scheme: provider, path: `/${generateUuid()}` });
  }
  /**
   * Ensures the published generation realizes the draft's current folder and config.
   * It keeps the previous generation hidden until a valid candidate can replace it, discarding stale candidates along the way.
   */
  async _reconcileGeneration(sessionResource, entry) {
    while (this._entries.get(sessionResource) === entry && !entry.disposed) {
      const currentGeneration = this._generationMatchingDesiredState(entry);
      if (currentGeneration) {
        return currentGeneration.backendSession;
      }
      const workingDirectory = entry.workingDirectory;
      const workingDirectories = this._computeEntryWorkingDirectories(entry);
      const configVersion = entry.configVersion;
      const config = { ...entry.config };
      if (!await this._isTargetFolderTrusted(workingDirectory)) {
        await this._retireGeneration(sessionResource, entry);
        return void 0;
      }
      const candidate = this._newProvisionalUri(entry.provider);
      let created;
      try {
        created = await this._agentHostService.createSession({
          provider: entry.provider,
          session: candidate,
          _meta: this.getInitialSessionMetadata(),
          workingDirectories,
          config,
          progressToken: generateUuid()
        });
      } catch (err) {
        this._logService.warn(`[AgentHostProvisional] Failed to create provisional session for ${sessionResource.toString()}: ${err instanceof Error ? err.message : String(err)}`);
        await this._disposeBackend(candidate, "failed provisional candidate");
        await this._retireGeneration(sessionResource, entry);
        return void 0;
      }
      if (this._entries.get(sessionResource) !== entry || entry.disposed || entry.configVersion !== configVersion || !this._sameUri(entry.workingDirectory, workingDirectory) || !this._sameWorkingDirectories(entry.provider, this._computeEntryWorkingDirectories(entry), workingDirectories)) {
        await this._disposeBackend(created, "obsolete provisional candidate");
        continue;
      }
      const previous = entry.generation;
      entry.generation = { backendSession: created, workingDirectory, workingDirectories };
      this._publishActiveClient(entry);
      this._onDidChange.fire(sessionResource);
      if (previous) {
        await this._disposeBackend(previous.backendSession, "replaced provisional generation");
      }
      return created;
    }
    return void 0;
  }
  async _retireGeneration(sessionResource, entry) {
    const generation = entry.generation;
    if (!generation) {
      return;
    }
    entry.generation = void 0;
    if (this._entries.get(sessionResource) === entry) {
      this._onDidChange.fire(sessionResource);
    }
    await this._disposeBackend(generation.backendSession, "retired provisional generation");
  }
  async _disposeBackend(backendSession, reason) {
    this._pendingBackendDisposals.add(backendSession);
    try {
      await this._agentHostService.disposeSession(backendSession);
      this._pendingBackendDisposals.delete(backendSession);
      return true;
    } catch (err) {
      this._logService.warn(`[AgentHostProvisional] Failed to dispose ${reason} ${backendSession.toString()}: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }
  _retryPendingBackendDisposals() {
    for (const backendSession of this._pendingBackendDisposals) {
      void this._disposeBackend(backendSession, "pending provisional cleanup");
    }
  }
  /**
   * Whether the folder the provisional agent would run in is trusted. When a
   * working directory is known (it may be a standalone folder outside the
   * open workspace, e.g. a per-session folder), gate on that folder's trust;
   * otherwise fall back to whole-workspace trust.
   */
  async _isTargetFolderTrusted(workingDirectory) {
    if (workingDirectory) {
      const { trusted } = await this._workspaceTrustManagementService.getUriTrustInfo(workingDirectory);
      return trusted;
    }
    return this._workspaceTrustManagementService.isWorkspaceTrusted();
  }
  tryRebind(oldSessionResource, newSessionResource, provider, workingDirectory) {
    return this._queue(oldSessionResource, async () => {
      const alreadyBound = this.get(newSessionResource);
      if (alreadyBound) {
        return alreadyBound;
      }
      const oldEntry = this._entries.get(oldSessionResource);
      if (!oldEntry || oldEntry.disposed) {
        return void 0;
      }
      const newBackendSession = this._toBackendUri(newSessionResource, provider);
      const imported = this._importConversationStore.take(newSessionResource);
      while (this._entries.get(oldSessionResource) === oldEntry && !oldEntry.disposed) {
        const config = { ...oldEntry.config };
        const configVersion = oldEntry.configVersion;
        const targetWorkingDirectory = oldEntry.workingDirectory ?? workingDirectory;
        if (!oldEntry.usesWorkspaceRootSet && (this._computeWorkingDirectories(targetWorkingDirectory, provider)?.length ?? 0) > 1) {
          oldEntry.usesWorkspaceRootSet = true;
        }
        const targetWorkingDirectories = this._computeEntryWorkingDirectories(oldEntry);
        let created;
        try {
          created = await this._agentHostService.createSession({
            provider,
            session: newBackendSession,
            _meta: this.getInitialSessionMetadata(),
            workingDirectories: targetWorkingDirectories,
            config,
            ...imported ? { model: imported.model, importConversation: { turns: imported.turns, model: imported.model } } : {},
            progressToken: generateUuid()
          });
        } catch (err) {
          this._logService.warn(`[AgentHostProvisional] Failed to create rebound provisional: ${err instanceof Error ? err.message : String(err)}`);
          this._restoreImportedConversation(newSessionResource, imported);
          const disposed = await this._disposeBackend(newBackendSession, "failed rebound candidate");
          if (!disposed) {
            throw new Error(`Cannot safely recover rebound session ${newBackendSession.toString()} until its candidate is retired`);
          }
          return void 0;
        }
        if (this._entries.get(oldSessionResource) !== oldEntry || oldEntry.disposed) {
          const disposed = await this._disposeBackend(created, "retired rebound candidate");
          this._restoreImportedConversation(newSessionResource, imported);
          if (!disposed) {
            throw new Error(`Cannot safely recover rebound session ${newBackendSession.toString()} until its candidate is retired`);
          }
          return void 0;
        }
        if (oldEntry.configVersion !== configVersion || !this._sameUri(oldEntry.workingDirectory ?? workingDirectory, targetWorkingDirectory) || !this._sameWorkingDirectories(oldEntry.provider, this._computeEntryWorkingDirectories(oldEntry), targetWorkingDirectories)) {
          const disposed = await this._disposeBackend(created, "obsolete rebound candidate");
          if (!disposed) {
            this._restoreImportedConversation(newSessionResource, imported);
            throw new Error(`Cannot safely retry rebound session ${newBackendSession.toString()} until its stale candidate is retired`);
          }
          continue;
        }
        const oldGeneration = oldEntry.generation;
        const newEntry = this._createEntry(provider, config, configVersion, targetWorkingDirectory, oldEntry.resolvedConfig);
        newEntry.usesWorkspaceRootSet = oldEntry.usesWorkspaceRootSet;
        newEntry.generation = { backendSession: created, workingDirectory: targetWorkingDirectory, workingDirectories: targetWorkingDirectories };
        this._entries.set(newSessionResource, newEntry);
        this._publishActiveClient(newEntry);
        this._entries.delete(oldSessionResource);
        oldEntry.disposed = true;
        oldEntry.activeClientSync.dispose();
        this._resolvedConfigs.delete(oldSessionResource);
        this._resolvedConfigRequestSeq.delete(oldSessionResource);
        this._rebound.add(oldSessionResource);
        this._onDidChange.fire(newSessionResource);
        if (oldGeneration) {
          await this._disposeBackend(oldGeneration.backendSession, "temporary provisional generation");
        }
        return created;
      }
      this._restoreImportedConversation(newSessionResource, imported);
      return void 0;
    });
  }
  _restoreImportedConversation(sessionResource, imported) {
    if (imported) {
      this._importConversationStore.set(sessionResource, imported);
    }
  }
  /**
   * Recreate the provisional backend session for `sessionResource` at a new
   * working directory, preserving the user's config choices. A created
   * session's cwd is immutable, so the only way to honor a folder change is to
   * dispose and recreate. The replacement uses a fresh backend URI so existing
   * subscribers acquire an authoritative snapshot for the new incarnation.
   */
  _changeWorkingDirectory(sessionResource, newWorkingDirectory) {
    const entry = this._entries.get(sessionResource);
    if (!entry || entry.disposed || this._sameUri(entry.workingDirectory, newWorkingDirectory)) {
      return Promise.resolve();
    }
    entry.workingDirectory = newWorkingDirectory;
    entry.usesWorkspaceRootSet = (this._computeWorkingDirectories(newWorkingDirectory, entry.provider)?.length ?? 0) > 1;
    entry.configVersion++;
    entry.resolvedConfig = void 0;
    const work = this._queue(sessionResource, async () => {
      if (this._entries.get(sessionResource) !== entry || entry.disposed) {
        return;
      }
      const backend = await this._reconcileGeneration(sessionResource, entry);
      if (!backend) {
        return;
      }
      const configVersion = entry.configVersion;
      const workingDirectory = entry.workingDirectory;
      try {
        const resolved = await this._agentHostService.resolveSessionConfig({
          provider: entry.provider,
          workingDirectory,
          config: { ...entry.config }
        });
        if (this._entries.get(sessionResource) === entry && !entry.disposed && entry.configVersion === configVersion && this._sameUri(entry.workingDirectory, workingDirectory)) {
          entry.config = { ...entry.config, ...resolved.values };
          entry.resolvedConfig = resolved;
        }
      } catch (err) {
        this._logService.warn(`[AgentHostProvisional] schema re-resolve after cwd change failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      this._onDidChange.fire(sessionResource);
    });
    this._onDidChange.fire(sessionResource);
    return work;
  }
  disposeSession(sessionResource) {
    const entry = this._entries.get(sessionResource);
    this._resolvedConfigs.delete(sessionResource);
    this._resolvedConfigRequestSeq.delete(sessionResource);
    if (!entry) {
      return Promise.resolve();
    }
    entry.disposed = true;
    entry.activeClientSync.dispose();
    this._entries.delete(sessionResource);
    this._onDidChange.fire(sessionResource);
    return this._queue(sessionResource, async () => {
      if (entry.generation) {
        await this._disposeBackend(entry.generation.backendSession, "provisional generation");
        entry.generation = void 0;
      }
    });
  }
  dispose() {
    for (const [, entry] of this._entries) {
      entry.disposed = true;
      entry.activeClientSync.dispose();
      if (entry.generation) {
        this._agentHostService.disposeSession(entry.generation.backendSession).catch(() => {
        });
      }
    }
    for (const backendSession of this._pendingBackendDisposals) {
      this._agentHostService.disposeSession(backendSession).catch(() => {
      });
    }
    this._entries.clear();
    this._pending.clear();
    this._pendingBackendDisposals.clear();
    this._resolvedConfigs.clear();
    this._resolvedConfigRequestSeq.clear();
    this._rebound.clear();
    super.dispose();
  }
  /**
   * Convert the chat-input UI session URI (`agent-host-PROVIDER:/<id>`)
   * to the agent-host backend URI (`PROVIDER:/<id>`).
   */
  _toBackendUri(sessionResource, provider) {
    const rawId = sessionResource.path.replace(/^\//, "");
    return URI.from({ scheme: provider, path: `/${rawId}` });
  }
  getResolvedConfig(sessionResource) {
    return this._entries.get(sessionResource)?.resolvedConfig ?? this._resolvedConfigs.get(sessionResource);
  }
  async refreshResolvedConfig(sessionResource, provider, workingDirectory, config) {
    const seq = (this._resolvedConfigRequestSeq.get(sessionResource) ?? 0) + 1;
    this._resolvedConfigRequestSeq.set(sessionResource, seq);
    try {
      const resolved = await this._agentHostService.resolveSessionConfig({
        provider,
        workingDirectory,
        config
      });
      if (this._resolvedConfigRequestSeq.get(sessionResource) !== seq) {
        return;
      }
      const entry = this._entries.get(sessionResource);
      if (entry) {
        entry.config = { ...entry.config, ...resolved.values };
        entry.resolvedConfig = resolved;
      } else {
        this._resolvedConfigs.set(sessionResource, resolved);
      }
      this._onDidChange.fire(sessionResource);
    } catch (err) {
      this._logService.warn(`[AgentHostProvisional] schema re-resolve failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  async applyConfigChange(sessionResource, provider, workingDirectory, partial) {
    const entry = this._ensureEntry(sessionResource, provider, workingDirectory);
    if (!entry) {
      return void 0;
    }
    Object.assign(entry.config, partial);
    entry.configVersion++;
    if (entry.resolvedConfig) {
      entry.resolvedConfig = {
        ...entry.resolvedConfig,
        values: { ...entry.resolvedConfig.values, ...partial }
      };
    }
    return this._queue(sessionResource, async () => {
      if (this._entries.get(sessionResource) !== entry || entry.disposed) {
        return void 0;
      }
      const backend = await this._reconcileGeneration(sessionResource, entry);
      if (!backend || this._entries.get(sessionResource) !== entry || entry.disposed) {
        return void 0;
      }
      this._agentHostService.dispatch(backend.toString(), {
        type: ActionType.SessionConfigChanged,
        config: partial
      });
      const configVersion = entry.configVersion;
      const resolvedWorkingDirectory = entry.workingDirectory;
      try {
        const resolved = await this._agentHostService.resolveSessionConfig({
          provider,
          workingDirectory: resolvedWorkingDirectory,
          config: { ...entry.config }
        });
        const stillCurrent = this._entries.get(sessionResource);
        if (stillCurrent === entry && !entry.disposed && entry.configVersion === configVersion && this._sameUri(entry.workingDirectory, resolvedWorkingDirectory)) {
          const resolvedValues = { ...resolved.values };
          const mergedConfig = { ...entry.config, ...resolvedValues };
          const configChanged = !equals(entry.config, mergedConfig);
          const resolvedChanged = !equals(entry.resolvedConfig, resolved);
          if (configChanged || resolvedChanged) {
            entry.config = mergedConfig;
            entry.resolvedConfig = resolved;
            this._onDidChange.fire(sessionResource);
          }
        }
      } catch (err) {
        this._logService.warn(`[AgentHostProvisional] schema re-resolve failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      return backend;
    });
  }
  /**
   * Workbench-side initial config seed sent at `createSession` time so the
   * agent's own server-side defaults don't fill `state.config.values` for
   * keys the workbench wants to control. Without this, the merge filter in
   * `agentHostSessionHandler` sees those agent defaults as "user-set" and
   * drops the workbench defaults.
   *
   * - `isolation`: workbench has no isolation picker, so always `'folder'`.
   * - `mode` / `autoApprove`: seeded from the single
   *   `chat.defaultConfiguration` object setting (`mode` and
   *   `approvals` properties). The approval seed is clamped to `'default'`
   *   when the `chat.tools.global.autoApprove` policy is off. The local-only
   *   `chat.permissions.default` setting is NOT used.
   *
   * Skipped entirely in the Agents window, where the sessions provider
   * supplies config via `request.agentHostSessionConfig` instead.
   */
  _getInitialConfig() {
    if (this._environmentService.isSessionsWindow) {
      return void 0;
    }
    const config = { [SessionConfigKey.Isolation]: "folder" };
    const configuredDefaults = this._configurationService.getValue(ChatConfiguration.DefaultConfiguration);
    const policyValue = this._configurationService.inspect(ChatConfiguration.GlobalAutoApprove).policyValue;
    const configuredApprovals = getChatPermissionLevelFromDefaultConfiguration(configuredDefaults?.approvals);
    if (configuredApprovals) {
      const policyRestricted = policyValue === false;
      config[SessionConfigKey.AutoApprove] = policyRestricted && configuredApprovals !== "default" ? "default" : configuredApprovals;
    }
    const configuredMode = configuredDefaults?.mode;
    if (typeof configuredMode === "string" && KNOWN_MODE_VALUES.has(configuredMode)) {
      config[SessionConfigKey.Mode] = configuredMode;
    }
    return migrateLegacyAutopilotConfig(config);
  }
};
AgentHostUntitledProvisionalSessionService = __decorateClass([
  __decorateParam(0, IAgentHostService),
  __decorateParam(1, ILogService),
  __decorateParam(2, IChatService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IWorkbenchEnvironmentService),
  __decorateParam(5, IAgentHostNewSessionFolderService),
  __decorateParam(6, IWorkspaceContextService),
  __decorateParam(7, IWorkspaceTrustManagementService),
  __decorateParam(8, IAgentHostImportConversationStore),
  __decorateParam(9, IAgentHostActiveClientService)
], AgentHostUntitledProvisionalSessionService);
registerSingleton(
  IAgentHostUntitledProvisionalSessionService,
  AgentHostUntitledProvisionalSessionService,
  InstantiationType.Delayed
);
export {
  AgentHostUntitledProvisionalSessionService,
  IAgentHostUntitledProvisionalSessionService
};
