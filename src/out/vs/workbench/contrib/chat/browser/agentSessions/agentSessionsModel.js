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
import { ThrottledDelayer } from "../../../../../base/common/async.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, DisposableMap } from "../../../../../base/common/lifecycle.js";
import { ResourceMap, ResourceSet } from "../../../../../base/common/map.js";
import { MarshalledId } from "../../../../../base/common/marshallingIds.js";
import { safeStringify } from "../../../../../base/common/objects.js";
import { derived, observableSignalFromEvent } from "../../../../../base/common/observable.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { URI } from "../../../../../base/common/uri.js";
import { localize } from "../../../../../nls.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILogService, LogLevel } from "../../../../../platform/log/common/log.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { IWorkspaceTrustManagementService } from "../../../../../platform/workspace/common/workspaceTrust.js";
import { IChatEntitlementService } from "../../../../services/chat/common/chatEntitlementService.js";
import { ILifecycleService } from "../../../../services/lifecycle/common/lifecycle.js";
import { Extensions, IOutputService } from "../../../../services/output/common/output.js";
import { ChatSessionStatus as AgentSessionStatus, IChatSessionsService, isSessionInProgressStatus } from "../../common/chatSessionsService.js";
import { getChatSessionType } from "../../common/model/chatUri.js";
import { IChatWidgetService } from "../chat.js";
import { COPILOT_CLI_EH_SCHEME, COPILOT_CLI_LOCAL_AH_SCHEME, getCopilotCliSessionRawId } from "../copilotCliEventsUri.js";
import { AgentSessionProviders, getAgentSessionProvider, getAgentSessionProviderIcon, getAgentSessionProviderName, isAgentHostTarget, isBuiltInAgentSessionProvider } from "./agentSessions.js";
import { ChatSessionStatus, isSessionInProgressStatus as isSessionInProgressStatus2 } from "../../common/chatSessionsService.js";
function hasValidDiff(changes) {
  if (!changes) {
    return false;
  }
  if (changes instanceof Array) {
    return changes.length > 0;
  }
  return changes.files > 0 || changes.insertions > 0 || changes.deletions > 0;
}
function getAgentChangesSummary(changes) {
  if (!changes) {
    return;
  }
  if (!(changes instanceof Array)) {
    return changes;
  }
  let insertions = 0;
  let deletions = 0;
  for (const change of changes) {
    insertions += change.insertions;
    deletions += change.deletions;
  }
  return { files: changes.length, insertions, deletions };
}
function isLocalAgentSessionItem(session) {
  return session.providerType === AgentSessionProviders.Local;
}
function getAgentSessionPullRequestUri(session) {
  const metadata = session.metadata;
  if (!metadata) {
    return void 0;
  }
  const url = metadata.pullRequestUrl;
  if (typeof url === "string" && url) {
    try {
      return URI.parse(url);
    } catch {
    }
  }
  const prNumber = metadata.pullRequestNumber;
  const owner = metadata.owner;
  const name = metadata.name;
  if (typeof prNumber === "number" && typeof owner === "string" && owner && typeof name === "string" && name) {
    return URI.parse(`https://github.com/${owner}/${name}/pull/${prNumber}`);
  }
  return void 0;
}
function getAgentSessionPullRequestContextValue(session) {
  return getAgentSessionPullRequestUri(session) ? "available" : "none";
}
function isAgentHostAgentSessionItem(session) {
  return isAgentHostTarget(session.providerType);
}
function isAgentSession(obj) {
  const session = obj;
  return URI.isUri(session?.resource) && typeof session.isArchived === "function" && typeof session.setArchived === "function" && typeof session.isPinned === "function" && typeof session.setPinned === "function" && typeof session.isRead === "function" && typeof session.isMarkedUnread === "function" && typeof session.setRead === "function";
}
function isAgentSessionsModel(obj) {
  const sessionsModel = obj;
  return Array.isArray(sessionsModel?.sessions) && typeof sessionsModel?.getSession === "function";
}
function countUnreadSessions(sessions) {
  let unread = 0;
  for (const session of sessions) {
    if (!session.isArchived() && session.status === AgentSessionStatus.Completed && !session.isRead()) {
      unread++;
    }
  }
  return unread;
}
var AgentSessionSection = /* @__PURE__ */ ((AgentSessionSection2) => {
  AgentSessionSection2["Pinned"] = "pinned";
  AgentSessionSection2["Today"] = "today";
  AgentSessionSection2["Yesterday"] = "yesterday";
  AgentSessionSection2["Week"] = "week";
  AgentSessionSection2["Older"] = "older";
  AgentSessionSection2["Archived"] = "archived";
  AgentSessionSection2["More"] = "more";
  AgentSessionSection2["Repository"] = "repository";
  return AgentSessionSection2;
})(AgentSessionSection || {});
function isAgentSessionSection(obj) {
  const candidate = obj;
  return typeof candidate.section === "string" && Array.isArray(candidate.sessions);
}
function isAgentSessionShowMore(obj) {
  return obj?.showMore === true;
}
function isAgentSessionShowLess(obj) {
  return obj?.showLess === true;
}
function isMarshalledAgentSessionContext(thing) {
  if (typeof thing === "object" && thing !== null) {
    const candidate = thing;
    return candidate.$mid === MarshalledId.AgentSessionContext && typeof candidate.session === "object" && candidate.session !== null;
  }
  return false;
}
const agentSessionsOutputChannelId = "agentSessionsOutput";
const agentSessionsOutputChannelLabel = localize("agentSessionsOutput", "Agent Sessions");
function statusToString(status) {
  switch (status) {
    case AgentSessionStatus.Failed:
      return "Failed";
    case AgentSessionStatus.Completed:
      return "Completed";
    case AgentSessionStatus.InProgress:
      return "InProgress";
    case AgentSessionStatus.NeedsInput:
      return "NeedsInput";
    default:
      return `Unknown(${status})`;
  }
}
let AgentSessionsLogger = class extends Disposable {
  constructor(getSessionsData, logService, outputService, chatEntitlementService) {
    super();
    this.getSessionsData = getSessionsData;
    this.logService = logService;
    this.outputService = outputService;
    this.chatEntitlementService = chatEntitlementService;
    this.isChannelRegistered = false;
    this.updateChannelRegistration();
    this.registerListeners();
  }
  updateChannelRegistration() {
    const chatDisabled = this.chatEntitlementService.sentiment.hidden;
    if (chatDisabled && this.isChannelRegistered) {
      Registry.as(Extensions.OutputChannels).removeChannel(agentSessionsOutputChannelId);
      this.isChannelRegistered = false;
    } else if (!chatDisabled && !this.isChannelRegistered) {
      Registry.as(Extensions.OutputChannels).registerChannel({
        id: agentSessionsOutputChannelId,
        label: agentSessionsOutputChannelLabel,
        log: false
      });
      this.isChannelRegistered = true;
    }
  }
  registerListeners() {
    this._register(this.logService.onDidChangeLogLevel((level) => {
      if (level === LogLevel.Trace) {
        this.logAllStatsIfTrace("Log level changed to trace");
      }
    }));
    this._register(this.chatEntitlementService.onDidChangeSentiment(() => {
      this.updateChannelRegistration();
    }));
  }
  logIfTrace(msg) {
    if (this.logService.getLevel() !== LogLevel.Trace) {
      return;
    }
    this.trace(`[Agent Sessions] ${msg}`);
  }
  logAllStatsIfTrace(reason) {
    if (this.logService.getLevel() !== LogLevel.Trace) {
      return;
    }
    this.logAllSessions(reason);
    this.logSessionStates();
  }
  logAllSessions(reason) {
    const { sessions, sessionStates } = this.getSessionsData();
    const lines = [];
    lines.push(`=== Agent Sessions (${reason}) ===`);
    let count = 0;
    for (const session of sessions) {
      count++;
      const state = sessionStates.get(session.resource);
      lines.push(`--- Session: ${session.label} ---`);
      lines.push(`  Resource: ${session.resource.toString()}`);
      lines.push(`  Provider Type: ${session.providerType}`);
      lines.push(`  Provider Label: ${session.providerLabel}`);
      lines.push(`  Status: ${statusToString(session.status)}`);
      lines.push(`  Icon: ${session.icon.id}`);
      if (session.description) {
        lines.push(`  Description: ${typeof session.description === "string" ? session.description : session.description.value}`);
      }
      if (session.badge) {
        lines.push(`  Badge: ${typeof session.badge === "string" ? session.badge : session.badge.value}`);
      }
      if (session.tooltip) {
        lines.push(`  Tooltip: ${typeof session.tooltip === "string" ? session.tooltip : session.tooltip.value}`);
      }
      lines.push(`  Timing:`);
      lines.push(`    Created: ${session.timing.created ? new Date(session.timing.created).toISOString() : "N/A"}`);
      lines.push(`    Last Request Started: ${session.timing.lastRequestStarted ? new Date(session.timing.lastRequestStarted).toISOString() : "N/A"}`);
      lines.push(`    Last Request Ended: ${session.timing.lastRequestEnded ? new Date(session.timing.lastRequestEnded).toISOString() : "N/A"}`);
      if (session.changes) {
        const summary = getAgentChangesSummary(session.changes);
        if (summary) {
          lines.push(`  Changes: ${summary.files} files, +${summary.insertions} -${summary.deletions}`);
        }
      }
      if (session.metadata && Object.keys(session.metadata).length > 0) {
        lines.push(`  Metadata:`);
        for (const [key, value] of Object.entries(session.metadata)) {
          const renderedValue = typeof value === "string" ? value : safeStringify(value);
          lines.push(`    ${key}: ${renderedValue}`);
        }
      }
      lines.push(`  State:`);
      lines.push(`    Archived (provider): ${session.archived ?? "N/A"}`);
      lines.push(`    Archived (computed): ${session.isArchived()}`);
      lines.push(`    Archived (stored): ${state?.archived ?? "N/A"}`);
      lines.push(`    Pinned: ${session.isPinned()}`);
      lines.push(`    Pinned (stored): ${state?.pinned ?? "N/A"}`);
      lines.push(`    Read: ${session.isRead()}`);
      lines.push(`    Read date (stored): ${state?.read ? new Date(state.read).toISOString() : "N/A"}`);
      lines.push("");
    }
    lines.unshift(`Total sessions: ${count}`, "");
    lines.push(`=== End Agent Sessions ===`);
    this.trace(lines.join("\n"));
  }
  logSessionStates() {
    const { sessionStates } = this.getSessionsData();
    const lines = [];
    lines.push(`=== Session States ===`);
    lines.push(`Total stored states: ${sessionStates.size}`);
    lines.push("");
    for (const [resource, state] of sessionStates) {
      lines.push(`URI: ${resource.toString()}`);
      lines.push(`  Archived: ${state.archived}`);
      lines.push(`  Pinned: ${state.pinned}`);
      lines.push(`  Read: ${state.read ? new Date(state.read).toISOString() : "0 (unread)"}`);
      lines.push("");
    }
    lines.push(`=== End Session States ===`);
    this.trace(lines.join("\n"));
  }
  trace(msg) {
    const channel = this.outputService.getChannel(agentSessionsOutputChannelId);
    if (!channel) {
      return;
    }
    channel.append(`${msg}
`);
  }
};
AgentSessionsLogger = __decorateClass([
  __decorateParam(1, ILogService),
  __decorateParam(2, IOutputService),
  __decorateParam(3, IChatEntitlementService)
], AgentSessionsLogger);
let AgentSessionsModel = class extends Disposable {
  constructor(chatSessionsService, lifecycleService, instantiationService, storageService, productService, chatWidgetService, workspaceContextService, workspaceTrustManagementService, chatEntitlementService) {
    super();
    this.chatSessionsService = chatSessionsService;
    this.lifecycleService = lifecycleService;
    this.instantiationService = instantiationService;
    this.storageService = storageService;
    this.productService = productService;
    this.chatWidgetService = chatWidgetService;
    this.workspaceContextService = workspaceContextService;
    this.workspaceTrustManagementService = workspaceTrustManagementService;
    this.chatEntitlementService = chatEntitlementService;
    this._onWillResolve = this._register(new Emitter());
    this.onWillResolve = this._onWillResolve.event;
    this._onDidResolve = this._register(new Emitter());
    this.onDidResolve = this._onDidResolve.event;
    this._onDidChangeSessions = this._register(new Emitter());
    this.onDidChangeSessions = this._onDidChangeSessions.event;
    this._onDidChangeSessionArchivedState = this._register(new Emitter());
    this.onDidChangeSessionArchivedState = this._onDidChangeSessionArchivedState.event;
    this._resolved = false;
    this.resolvers = this._register(new DisposableMap());
    this._sessionObservables = new ResourceMap();
    this._resolvedResources = new ResourceSet();
    this.explicitlyMarkedUnreadSessions = new ResourceSet();
    this.migratedReadResources = new ResourceSet();
    this._sessions = new ResourceMap();
    this.cache = this.instantiationService.createInstance(AgentSessionsCache);
    for (const data of this.cache.loadCachedSessions()) {
      const session = this.toAgentSession(data);
      this._sessions.set(session.resource, session);
    }
    this.sessionStates = this.cache.loadSessionStates();
    this.logger = this._register(this.instantiationService.createInstance(
      AgentSessionsLogger,
      () => ({
        sessions: this._sessions.values(),
        sessionStates: this.sessionStates
      })
    ));
    this.logger.logAllStatsIfTrace("Loaded cached sessions");
    this.readDateBaseline = this.resolveReadDateBaseline();
    this.loadMigratedReadResources();
    this.registerListeners();
  }
  get resolved() {
    return this._resolved;
  }
  get sessions() {
    return this._dedupeMigratedCopilotCliSessions(Array.from(this._sessions.values()));
  }
  registerListeners() {
    this._register(this.chatSessionsService.onDidChangeItemsProviders(({ chatSessionType }) => this.resolve(chatSessionType)));
    this._register(this.chatSessionsService.onDidChangeAvailability(() => this.resolve(void 0)));
    this._register(this.chatSessionsService.onDidChangeSessionItems((delta) => {
      const changedChatSessionTypes = /* @__PURE__ */ new Set();
      for (const resource of delta.addedOrUpdated ?? []) {
        changedChatSessionTypes.add(getChatSessionType(resource.resource));
      }
      for (const resource of delta.removed ?? []) {
        changedChatSessionTypes.add(getChatSessionType(resource));
      }
      for (const chatSessionType of changedChatSessionTypes) {
        this.resolveProvider(chatSessionType, {
          refreshProvider: false
          /* skip because we react on an event already */
        });
      }
    }));
    this._register(this.workspaceContextService.onDidChangeWorkspaceFolders(() => this.resolve(void 0)));
    this._register(this.workspaceTrustManagementService.onDidChangeTrust(() => this.resolve(void 0)));
    this._register(this.storageService.onWillSaveState(() => {
      this.cache.saveCachedSessions(Array.from(this._sessions.values()));
      this.cache.saveSessionStates(this.sessionStates);
    }));
  }
  getSession(resource) {
    return this._sessions.get(resource);
  }
  /**
   * Hide the extension-host `copilotcli:` row when its agent-host
   * `agent-host-copilotcli:` twin is present, so the list shows a single entry
   * per legacy Copilot CLI session — the agent-host one, which migrates on open.
   * Only display is deduped; {@link getSession} and the cache use the full map so
   * a hidden row can still resolve.
   */
  _dedupeMigratedCopilotCliSessions(sessions) {
    let migratedRawIds;
    for (const session of sessions) {
      if (session.resource.scheme === COPILOT_CLI_LOCAL_AH_SCHEME) {
        const rawId = getCopilotCliSessionRawId(session.resource);
        if (rawId) {
          (migratedRawIds ??= /* @__PURE__ */ new Set()).add(rawId);
        }
      }
    }
    if (!migratedRawIds) {
      return sessions;
    }
    return sessions.filter((session) => {
      if (session.resource.scheme === COPILOT_CLI_EH_SCHEME) {
        const rawId = getCopilotCliSessionRawId(session.resource);
        if (rawId && migratedRawIds.has(rawId)) {
          return false;
        }
      }
      return true;
    });
  }
  observeSession(resource) {
    if (!this._resolvedResources.has(resource)) {
      this._resolvedResources.add(resource);
      const sessionType = getChatSessionType(resource);
      this.chatSessionsService.resolveChatSessionItem(sessionType, resource, CancellationToken.None).catch((error) => this.logger.logIfTrace(`observeSession: resolve failed for ${resource.toString()}: ${error instanceof Error ? error.message : String(error)}`));
    }
    let observable = this._sessionObservables.get(resource);
    if (!observable) {
      this._changedSignal ??= observableSignalFromEvent("agentSessionsChanged", this.onDidChangeSessions);
      const signal = this._changedSignal;
      observable = derived((reader) => {
        signal.read(reader);
        return this._sessions.get(resource);
      });
      this._sessionObservables.set(resource, observable);
    }
    return observable;
  }
  async resolve(provider) {
    const providers = Array.isArray(provider) ? provider : provider !== void 0 ? [provider] : this.chatSessionsService.getRegisteredChatSessionItemProviders();
    await Promise.all(providers.map((provider2) => this.resolveProvider(provider2, { refreshProvider: true })));
  }
  resolveProvider(provider, options) {
    if (this.chatEntitlementService.sentiment.hidden) {
      return Promise.resolve();
    }
    let resolver = this.resolvers.get(provider);
    if (!resolver) {
      resolver = new ThrottledDelayer(500);
      this.resolvers.set(provider, resolver);
    }
    return resolver.trigger(async (token) => {
      if (token.isCancellationRequested || this.lifecycleService.willShutdown) {
        return;
      }
      try {
        this._onWillResolve.fire(provider);
        return await this.doResolveProvider(provider, options, token);
      } catch (error) {
        this.logger.logIfTrace(`Error resolving sessions for provider ${provider}: ${error instanceof Error ? error.stack : String(error)}`);
      } finally {
        this._onDidResolve.fire(provider);
      }
    });
  }
  async doResolveProvider(provider, options, token) {
    if (options.refreshProvider) {
      await this.chatSessionsService.refreshChatSessionItems([provider], token);
      for (const resource of [...this._resolvedResources]) {
        if (getChatSessionType(resource) === provider) {
          this._resolvedResources.delete(resource);
          if (this._sessionObservables.has(resource)) {
            this.observeSession(resource);
          }
        }
      }
    }
    const mapSessionContributionToType = /* @__PURE__ */ new Map();
    for (const contribution of this.chatSessionsService.getAllChatSessionContributions()) {
      mapSessionContributionToType.set(contribution.type, contribution);
    }
    const sessions = new ResourceMap();
    for await (const { chatSessionType, items: providerSessions } of this.chatSessionsService.getChatSessionItems([provider], token)) {
      if (token.isCancellationRequested) {
        return;
      }
      for (const session of providerSessions) {
        let icon;
        let providerLabel;
        const agentSessionProvider = getAgentSessionProvider(chatSessionType);
        if (agentSessionProvider !== void 0) {
          providerLabel = getAgentSessionProviderName(agentSessionProvider);
          icon = getAgentSessionProviderIcon(agentSessionProvider);
        } else {
          providerLabel = mapSessionContributionToType.get(chatSessionType)?.name ?? chatSessionType;
          icon = session.iconPath ?? Codicon.terminal;
        }
        const changes = session.changes ?? getAgentChangesSummary(this._sessions.get(session.resource)?.changes);
        const normalizedChanges = changes && !(changes instanceof Array) ? { files: changes.files, insertions: changes.insertions, deletions: changes.deletions } : changes;
        const shouldKeepOpenSessionRead = session.isRead === false && this.chatSessionsService.canSetChatSessionItemRead(session.resource) && !this.explicitlyMarkedUnreadSessions.has(session.resource) && !!this.chatWidgetService.getWidgetBySessionResource(session.resource);
        if (shouldKeepOpenSessionRead) {
          this.chatSessionsService.setChatSessionItemRead(session.resource, true);
        }
        if (session.isRead) {
          this.explicitlyMarkedUnreadSessions.delete(session.resource);
        }
        sessions.set(session.resource, this.toAgentSession({
          providerType: chatSessionType,
          providerLabel,
          resource: session.resource,
          label: session.label.split("\n")[0],
          // protect against weird multi-line labels that break our layout
          description: session.description,
          icon,
          badge: session.badge,
          tooltip: session.tooltip,
          status: session.status ?? AgentSessionStatus.Completed,
          archived: session.archived,
          providerIsRead: shouldKeepOpenSessionRead ? true : session.isRead,
          timing: session.timing,
          changes: normalizedChanges,
          metadata: session.metadata,
          legacyResource: session.legacyResource
        }));
      }
    }
    for (const [, session] of this._sessions) {
      if (session.providerType !== provider && !sessions.has(session.resource) && (isBuiltInAgentSessionProvider(session.providerType) || mapSessionContributionToType.has(session.providerType))) {
        sessions.set(session.resource, session);
      }
    }
    for (const resource of this.explicitlyMarkedUnreadSessions) {
      if (!sessions.has(resource)) {
        this.explicitlyMarkedUnreadSessions.delete(resource);
      }
    }
    const sessionsWithChangedArchivedState = [];
    for (const [, session] of sessions) {
      const previousSession = this._sessions.get(session.resource);
      if (previousSession && this.isArchived(previousSession) !== this.isArchived(session)) {
        sessionsWithChangedArchivedState.push(session);
      }
    }
    this._sessions = sessions;
    this._resolved = true;
    this.migrateReadStateToProvider(sessions.values());
    this.logger.logAllStatsIfTrace("Sessions resolved from providers");
    for (const session of sessionsWithChangedArchivedState) {
      this._onDidChangeSessionArchivedState.fire(session);
    }
    this._onDidChangeSessions.fire();
  }
  toAgentSession(data) {
    return {
      ...data,
      isArchived: () => this.isArchived(data),
      setArchived: (archived) => this.setArchived(data, archived),
      isPinned: () => this.isPinned(data),
      setPinned: (pinned) => this.setPinned(data, pinned),
      isRead: () => this.isRead(data),
      isMarkedUnread: () => this.isMarkedUnread(data),
      setRead: (read) => this.setRead(data, read)
    };
  }
  static {
    //#region States
    this.UNREAD_MARKER = -1;
  }
  /**
   * Resolve the state entry for a session, honoring a one-way migration from
   * {@link IAgentSessionData.legacyResource} when no entry yet exists for the
   * session's current resource. Adopts the legacy entry forward (copies it onto
   * the current resource key and removes the legacy entry). Returns undefined if
   * neither a current nor a legacy entry exists.
   */
  resolveStateEntry(session) {
    const own = this.sessionStates.get(session.resource);
    if (own !== void 0) {
      return own;
    }
    const legacy = session.legacyResource;
    if (!legacy) {
      return void 0;
    }
    if (legacy.scheme !== session.resource.scheme || legacy.toString() === session.resource.toString()) {
      return void 0;
    }
    const prev = this.sessionStates.get(legacy);
    if (prev === void 0) {
      return void 0;
    }
    this.sessionStates.set(session.resource, { ...prev });
    this.sessionStates.delete(legacy);
    return this.sessionStates.get(session.resource);
  }
  isArchived(session) {
    if (this.chatSessionsService.canSetChatSessionItemArchived(session.resource)) {
      return Boolean(session.archived);
    }
    return this.resolveStateEntry(session)?.archived ?? Boolean(session.archived);
  }
  setArchived(session, archived) {
    if (archived) {
      this.setRead(session, true);
    }
    if (archived === this.isArchived(session)) {
      return;
    }
    if (this.chatSessionsService.canSetChatSessionItemArchived(session.resource)) {
      this.chatSessionsService.setChatSessionItemArchived(session.resource, archived);
      return;
    }
    const state = this.resolveStateEntry(session) ?? {};
    this.sessionStates.set(session.resource, { ...state, archived });
    const agentSession = this._sessions.get(session.resource);
    if (agentSession) {
      this._onDidChangeSessionArchivedState.fire(agentSession);
    }
    this._onDidChangeSessions.fire();
  }
  isPinned(session) {
    return this.resolveStateEntry(session)?.pinned ?? false;
  }
  setPinned(session, pinned) {
    if (pinned === this.isPinned(session)) {
      return;
    }
    const state = this.resolveStateEntry(session) ?? {};
    this.sessionStates.set(session.resource, { ...state, pinned });
    this._onDidChangeSessions.fire();
  }
  isMarkedUnread(session) {
    if (this.ownsReadState(session)) {
      return !this.isRead(session);
    }
    return this.resolveStateEntry(session)?.read === AgentSessionsModel.UNREAD_MARKER;
  }
  /**
   * Whether the session's provider owns read state. When it does the value is
   * shared with every other client on the same backend (the agent window, or
   * another window on the same agent host), so the local heuristics below must
   * not second-guess it.
   */
  ownsReadState(session) {
    return this.chatSessionsService.canSetChatSessionItemRead(session.resource);
  }
  isRead(session) {
    if (this.isArchived(session)) {
      return true;
    }
    if (this.ownsReadState(session)) {
      return session.providerIsRead ?? true;
    }
    const storedReadDate = this.resolveStateEntry(session)?.read;
    if (storedReadDate === AgentSessionsModel.UNREAD_MARKER) {
      return false;
    }
    if (this.localReadDateCoversActivity(session, storedReadDate)) {
      return true;
    }
    return !!this.chatWidgetService.getWidgetBySessionResource(session.resource);
  }
  static {
    /** Grace window absorbing a click away from a session just before it finishes. */
    this.READ_GRACE_WINDOW = 2e3;
  }
  /**
   * Whether the locally-stored read timestamp covers the session's last
   * activity. Falls back to the read-date baseline when nothing is stored.
   */
  localReadDateCoversActivity(session, storedReadDate) {
    const readDate = Math.max(storedReadDate ?? 0, this.readDateBaseline);
    return readDate >= this.sessionTimeForReadStateTracking(session) - AgentSessionsModel.READ_GRACE_WINDOW;
  }
  sessionTimeForReadStateTracking(session) {
    return session.timing.lastRequestEnded ?? session.timing.created;
  }
  setRead(session, read, skipEvent) {
    if (this.ownsReadState(session)) {
      if (read) {
        this.explicitlyMarkedUnreadSessions.delete(session.resource);
      } else {
        this.explicitlyMarkedUnreadSessions.add(session.resource);
      }
      if (read === (session.providerIsRead ?? true)) {
        return;
      }
      this.chatSessionsService.setChatSessionItemRead(session.resource, read);
      return;
    }
    const state = this.resolveStateEntry(session) ?? {};
    let newRead;
    if (read) {
      newRead = Math.max(Date.now(), this.sessionTimeForReadStateTracking(session));
      if (typeof state.read === "number" && state.read >= newRead) {
        return;
      }
    } else {
      newRead = AgentSessionsModel.UNREAD_MARKER;
      if (state.read === AgentSessionsModel.UNREAD_MARKER) {
        return;
      }
    }
    this.sessionStates.set(session.resource, { ...state, read: newRead });
    if (!skipEvent) {
      this._onDidChangeSessions.fire();
    }
  }
  static {
    this.READ_MIGRATION_DONE_KEY = "agentSessions.providerReadMigration";
  }
  /**
   * One-time hand-off of locally-tracked read state to providers that own it,
   * so sessions read before the provider took ownership don't all resurface as
   * unread. Only ever promotes to read, and runs at most once per session so a
   * later "Mark as Unread" is not undone on the next refresh.
   *
   * The ledger is application-scoped even though the local state it hands off
   * is per-workspace: the provider-owned state it writes to is global, so a
   * second workspace that can see the same session (an empty window lists them
   * all) must not migrate it again and re-promote a deliberate "Mark as Unread".
   */
  migrateReadStateToProvider(sessions) {
    let changed = false;
    for (const session of sessions) {
      if (this.migratedReadResources.has(session.resource) || !this.ownsReadState(session)) {
        continue;
      }
      if (session.providerIsRead === void 0) {
        continue;
      }
      this.migratedReadResources.add(session.resource);
      changed = true;
      if (session.providerIsRead) {
        continue;
      }
      const storedReadDate = this.resolveStateEntry(session)?.read;
      if (storedReadDate === AgentSessionsModel.UNREAD_MARKER) {
        continue;
      }
      if (this.localReadDateCoversActivity(session, storedReadDate)) {
        this.chatSessionsService.setChatSessionItemRead(session.resource, true);
      }
    }
    if (changed) {
      this.storageService.store(
        AgentSessionsModel.READ_MIGRATION_DONE_KEY,
        JSON.stringify(Array.from(this.migratedReadResources).map((resource) => resource.toString())),
        StorageScope.APPLICATION,
        StorageTarget.MACHINE
      );
    }
  }
  loadMigratedReadResources() {
    const raw = this.storageService.get(AgentSessionsModel.READ_MIGRATION_DONE_KEY, StorageScope.APPLICATION);
    if (!raw) {
      return;
    }
    try {
      for (const entry of JSON.parse(raw)) {
        this.migratedReadResources.add(URI.parse(entry));
      }
    } catch {
    }
  }
  static {
    this.READ_DATE_BASELINE_KEY = "agentSessions.readDateBaseline2";
  }
  resolveReadDateBaseline() {
    let readDateBaseline = this.storageService.getNumber(AgentSessionsModel.READ_DATE_BASELINE_KEY, StorageScope.WORKSPACE, 0);
    if (readDateBaseline > 0) {
      return readDateBaseline;
    }
    readDateBaseline = this.productService.quality === "stable" ? Date.now() - 7 * 24 * 60 * 60 * 1e3 : Date.now();
    this.storageService.store(AgentSessionsModel.READ_DATE_BASELINE_KEY, readDateBaseline, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    return readDateBaseline;
  }
  //#endregion
};
AgentSessionsModel = __decorateClass([
  __decorateParam(0, IChatSessionsService),
  __decorateParam(1, ILifecycleService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IProductService),
  __decorateParam(5, IChatWidgetService),
  __decorateParam(6, IWorkspaceContextService),
  __decorateParam(7, IWorkspaceTrustManagementService),
  __decorateParam(8, IChatEntitlementService)
], AgentSessionsModel);
let AgentSessionsCache = class {
  constructor(storageService) {
    this.storageService = storageService;
  }
  static {
    this.SESSIONS_STORAGE_KEY = "agentSessions.model.cache";
  }
  static {
    this.STATE_STORAGE_KEY = "agentSessions.state.cache";
  }
  //#region Sessions
  saveCachedSessions(sessions) {
    const serialized = sessions.map((session) => ({
      providerType: session.providerType,
      providerLabel: session.providerLabel,
      resource: session.resource.toString(),
      icon: session.icon.id,
      label: session.label,
      description: session.description,
      badge: session.badge,
      tooltip: session.tooltip,
      status: isSessionInProgressStatus(session.status) ? AgentSessionStatus.Completed : session.status,
      // never cache sessions as in progress, this needs to be live state
      archived: session.archived,
      isRead: session.providerIsRead,
      timing: session.timing,
      changes: getAgentChangesSummary(session.changes),
      metadata: session.metadata,
      legacyResource: session.legacyResource?.toString()
    }));
    this.storageService.store(AgentSessionsCache.SESSIONS_STORAGE_KEY, safeStringify(serialized), StorageScope.WORKSPACE, StorageTarget.MACHINE);
  }
  loadCachedSessions() {
    const sessionsCache = this.storageService.get(AgentSessionsCache.SESSIONS_STORAGE_KEY, StorageScope.WORKSPACE);
    if (!sessionsCache) {
      return [];
    }
    try {
      const cached = JSON.parse(sessionsCache);
      return cached.map((session) => ({
        providerType: session.providerType,
        providerLabel: session.providerLabel,
        resource: typeof session.resource === "string" ? URI.parse(session.resource) : URI.revive(session.resource),
        icon: ThemeIcon.fromId(session.icon),
        label: session.label,
        description: session.description,
        badge: session.badge,
        tooltip: session.tooltip,
        status: session.status,
        archived: session.archived,
        providerIsRead: session.isRead,
        timing: {
          created: session.timing.created ?? 0,
          lastRequestStarted: session.timing.lastRequestStarted,
          lastRequestEnded: session.timing.lastRequestEnded
        },
        changes: getAgentChangesSummary(session.changes),
        metadata: session.metadata,
        legacyResource: session.legacyResource ? URI.parse(session.legacyResource) : void 0
      }));
    } catch {
      return [];
    }
  }
  //#endregion
  //#region States
  saveSessionStates(states) {
    const serialized = Array.from(states.entries()).map(([resource, state]) => ({
      resource: resource.toString(),
      archived: state.archived,
      pinned: state.pinned,
      read: state.read
    }));
    this.storageService.store(AgentSessionsCache.STATE_STORAGE_KEY, JSON.stringify(serialized), StorageScope.WORKSPACE, StorageTarget.MACHINE);
  }
  loadSessionStates() {
    const states = new ResourceMap();
    const statesCache = this.storageService.get(AgentSessionsCache.STATE_STORAGE_KEY, StorageScope.WORKSPACE);
    if (!statesCache) {
      return states;
    }
    try {
      const cached = JSON.parse(statesCache);
      for (const entry of cached) {
        states.set(typeof entry.resource === "string" ? URI.parse(entry.resource) : URI.revive(entry.resource), {
          archived: entry.archived,
          pinned: entry.pinned,
          read: entry.read
        });
      }
    } catch {
    }
    return states;
  }
  //#endregion
};
AgentSessionsCache = __decorateClass([
  __decorateParam(0, IStorageService)
], AgentSessionsCache);
export {
  AgentSessionSection,
  ChatSessionStatus as AgentSessionStatus,
  AgentSessionsCache,
  AgentSessionsModel,
  countUnreadSessions,
  getAgentChangesSummary,
  getAgentSessionPullRequestContextValue,
  getAgentSessionPullRequestUri,
  hasValidDiff,
  isAgentHostAgentSessionItem,
  isAgentSession,
  isAgentSessionSection,
  isAgentSessionShowLess,
  isAgentSessionShowMore,
  isAgentSessionsModel,
  isLocalAgentSessionItem,
  isMarshalledAgentSessionContext,
  isSessionInProgressStatus2 as isSessionInProgressStatus
};
