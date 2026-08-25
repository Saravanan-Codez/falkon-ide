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
import { RunOnceScheduler } from "../../../../../base/common/async.js";
import { VSBuffer } from "../../../../../base/common/buffer.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../base/common/network.js";
import { dirname, joinPath } from "../../../../../base/common/resources.js";
import { URI } from "../../../../../base/common/uri.js";
import { localize } from "../../../../../nls.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { IAgentHostService } from "../../../../../platform/agentHost/common/agentService.js";
import { agentHostAuthority } from "../../../../../platform/agentHost/common/agentHostUri.js";
import { IRemoteAgentHostService } from "../../../../../platform/agentHost/common/remoteAgentHostService.js";
import { buildDefaultChatUri, CustomizationType, readUsageInfoMeta, StateComponents } from "../../../../../platform/agentHost/common/state/sessionState.js";
import { IWorkbenchEnvironmentService } from "../../../../services/environment/common/environmentService.js";
import { IPathService } from "../../../../services/path/common/pathService.js";
import { ChatDebugHookResult, ChatDebugLogLevel, IChatDebugService } from "../../common/chatDebugService.js";
import { IAgentHostCustomizationService } from "../agentSessions/agentHost/agentHostCustomizationService.js";
import { AgentHostAgentDebugLogEnabledSettingId, AgentHostAgentDebugLogMaxEventsSettingId } from "../../common/promptSyntax/promptTypes.js";
import { buildLocalSessionStateUri, COPILOT_CLI_EH_SCHEME, COPILOT_CLI_LOCAL_AH_SCHEME, getCopilotCliSessionRawId, resolveEventsUri } from "../copilotCliEventsUri.js";
import { AgentHostCustomizationRecorder, AgentHostUsageRecorder, buildAgentHostCustomizationsUri, buildAgentHostUsageUri, readAgentHostCustomizationsSnapshot, readAgentHostUsageRecords } from "./agentHostUsageSidecar.js";
const MAX_DISCOVERED_SESSIONS = 30;
const TITLE_READ_BYTES = 64 * 1024;
const MAX_RESOLVED_DETAILS = 5e4;
const DEFAULT_MAX_EVENTS_IN_MEMORY = 1e4;
const MAX_EVENT_PAYLOAD = 4e3;
const MAX_DETAIL_PAYLOAD = 1e5;
let AgentHostChatDebugContribution = class extends Disposable {
  constructor(_chatDebugService, _fileService, _pathService, _remoteAgentHostService, _agentHostService, _configurationService, _logService, _environmentService, _customizationService) {
    super();
    this._chatDebugService = _chatDebugService;
    this._fileService = _fileService;
    this._pathService = _pathService;
    this._remoteAgentHostService = _remoteAgentHostService;
    this._agentHostService = _agentHostService;
    this._configurationService = _configurationService;
    this._logService = _logService;
    this._environmentService = _environmentService;
    this._customizationService = _customizationService;
    /** Resolved (expanded) detail for each emitted event id. */
    this._resolved = /* @__PURE__ */ new Map();
    /** Guards against concurrent/overlapping session discovery scans. */
    this._discovering = false;
    /** True once the lazy fetcher has run at least once (i.e. the panel has been opened). */
    this._hasFetchedOnce = false;
    /** Watches the currently-viewed session's events.jsonl for live refresh. */
    this._liveRefresh = this._register(new MutableDisposable());
    const provider = {
      provideChatDebugLog: (sessionResource, token) => this._provideChatDebugLog(sessionResource, token),
      resolveChatDebugLogEvent: async (eventId) => this._resolved.get(eventId)
    };
    this._register(this._chatDebugService.registerProvider(provider));
    this._register(new AgentHostUsageRecorder(
      this._environmentService.userRoamingDataHome,
      () => this._configurationService.getValue(AgentHostAgentDebugLogEnabledSettingId),
      this._fileService,
      this._logService,
      this._agentHostService,
      this._remoteAgentHostService
    ));
    this._register(new AgentHostCustomizationRecorder(
      this._environmentService.userRoamingDataHome,
      () => this._configurationService.getValue(AgentHostAgentDebugLogEnabledSettingId),
      this._fileService,
      this._logService,
      this._agentHostService,
      this._remoteAgentHostService
    ));
    this._register(this._chatDebugService.onDidEndSession((sessionResource) => {
      if (sessionResource.toString() === this._watchedSessionKey) {
        this._liveRefresh.clear();
        this._watchedSessionKey = void 0;
        this._liveRead = void 0;
        this._usageRead = void 0;
      }
    }));
    this._register(this._chatDebugService.registerAvailableSessionsFetcher((token) => this._fetchLocalSessions(token)));
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(AgentHostAgentDebugLogEnabledSettingId) && this._hasFetchedOnce) {
        this._maybeDiscoverLocalSessions();
      }
    }));
  }
  static {
    this.ID = "workbench.contrib.agentHostChatDebug";
  }
  /**
   * Lazy fetcher registered with {@link IChatDebugService}. Invoked (at most
   * once) when the home view first requests the available session list, so no
   * disk scan happens until the panel is opened. Returns nothing when file
   * logging is disabled.
   */
  async _fetchLocalSessions(token) {
    this._hasFetchedOnce = true;
    if (!this._configurationService.getValue(AgentHostAgentDebugLogEnabledSettingId)) {
      return [];
    }
    try {
      return await this._discoverLocalSessions(token);
    } catch (err) {
      this._logService.warn(`[AgentHostChatDebug] session discovery failed: ${toErrorMessage(err)}`);
      return [];
    }
  }
  /**
   * Runs {@link _discoverLocalSessions} when file logging is enabled and adds
   * the results to the available-sessions list, guarding against overlapping
   * scans. Used for the re-scan when logging is enabled after the panel has
   * already loaded once (the initial load goes through {@link _fetchLocalSessions}).
   * Safe to call repeatedly: {@link IChatDebugService.addAvailableSessionResources}
   * dedupes by URI.
   */
  async _maybeDiscoverLocalSessions() {
    if (this._discovering || !this._configurationService.getValue(AgentHostAgentDebugLogEnabledSettingId)) {
      return;
    }
    this._discovering = true;
    try {
      const sessions = await this._discoverLocalSessions(CancellationToken.None);
      if (sessions.length > 0) {
        this._chatDebugService.addAvailableSessionResources(sessions);
      }
    } catch (err) {
      this._logService.warn(`[AgentHostChatDebug] session discovery failed: ${toErrorMessage(err)}`);
    } finally {
      this._discovering = false;
    }
  }
  _resolveEventsUri(sessionResource) {
    const userHome = this._pathService.userHome({ preferLocal: true });
    const result = resolveEventsUri(
      sessionResource,
      userHome,
      (authority) => this._remoteAgentHostService.connections.find((c) => agentHostAuthority(c.address) === authority)
    );
    return result.kind === "ok" ? result.resource : void 0;
  }
  /**
   * Watches the given session's events.jsonl and re-invokes providers when it
   * changes, so the panel updates as new turns/requests stream in. Only one
   * session (the one currently shown) is watched at a time. Remote
   * (non-`file`) sessions are not watched; they still load on open.
   */
  _ensureLiveRefresh(sessionResource, eventsUri) {
    const key = sessionResource.toString();
    if (this._watchedSessionKey === key) {
      return;
    }
    if (eventsUri.scheme !== Schemas.file) {
      this._liveRefresh.clear();
      this._watchedSessionKey = void 0;
      return;
    }
    this._watchedSessionKey = key;
    const store = new DisposableStore();
    const scheduler = store.add(new RunOnceScheduler(() => {
      this._chatDebugService.invokeProviders(sessionResource);
    }, 400));
    const watcher = store.add(this._fileService.createWatcher(dirname(eventsUri), { recursive: false, excludes: [] }));
    store.add(watcher.onDidChange((e) => {
      const affects = e.affects(eventsUri);
      if (affects) {
        scheduler.schedule();
      }
    }));
    const liveSub = this._sessionChatSubscription(sessionResource);
    if (liveSub) {
      store.add(liveSub.onDidChange(() => scheduler.schedule()));
    }
    store.add(this._customizationService.onDidChangeCustomizations(() => scheduler.schedule()));
    this._liveRefresh.value = store;
  }
  /**
   * Returns the live AHP chat-state subscription for a local Agent Host
   * session, if one is currently active (i.e. the session is open/subscribed).
   * Turns (and their usage) live on the session's default chat channel, so we
   * subscribe to that channel rather than the session. Read-only: never
   * creates a subscription.
   */
  _sessionChatSubscription(sessionResource) {
    if (sessionResource.scheme !== COPILOT_CLI_LOCAL_AH_SCHEME) {
      return void 0;
    }
    const rawId = getCopilotCliSessionRawId(sessionResource);
    if (!rawId) {
      return void 0;
    }
    const backendSession = URI.from({ scheme: COPILOT_CLI_EH_SCHEME, path: `/${rawId}` });
    const chatUri = URI.parse(buildDefaultChatUri(backendSession.toString()));
    return this._agentHostService.getSubscriptionUnmanaged(StateComponents.Chat, chatUri);
  }
  /**
   * Reads live Copilot AIU from the AHP session state as a fallback usage
   * source for in-progress sessions (no `session.shutdown` summary yet).
   * Only AIU is reliable live; input/cache need the shutdown summary (F1).
   */
  _getLiveUsageTotals(sessionResource) {
    const chat = this._sessionChatSubscription(sessionResource)?.value;
    if (!chat || chat instanceof Error) {
      return void 0;
    }
    return sumChatStateUsage(chat);
  }
  /**
   * Reads the client-local usage sidecar for a session (exact per-request
   * token metrics captured live). Returns `undefined` when the session has no
   * sidecar (e.g. it ran before capture shipped), so the converter falls back
   * to the session.shutdown summary / live totals.
   */
  async _readUsageRecords(sessionResource) {
    const rawId = getCopilotCliSessionRawId(sessionResource);
    if (!rawId) {
      return void 0;
    }
    const uri = buildAgentHostUsageUri(this._environmentService.userRoamingDataHome, rawId);
    const key = uri.toString();
    let size;
    try {
      const stat = await this._fileService.stat(uri);
      size = stat.size ?? 0;
    } catch {
      this._usageRead = void 0;
      return void 0;
    }
    if (this._usageRead?.key === key && this._usageRead.size === size) {
      return this._usageRead.records.length > 0 ? this._usageRead.records : void 0;
    }
    const records = await readAgentHostUsageRecords(this._fileService, uri);
    this._usageRead = { key, size, records };
    return records.length > 0 ? records : void 0;
  }
  /**
   * Reads the client-local customization snapshot for a session (the last
   * loaded skills/hooks/agents/MCP captured live). Used as a fallback for
   * historical/closed sessions, where the live customization service has no
   * active state subscription and returns nothing. Returns `undefined` when no
   * snapshot exists (e.g. the session ran before capture shipped).
   */
  async _readCustomizationsSnapshot(sessionResource) {
    const rawId = getCopilotCliSessionRawId(sessionResource);
    if (!rawId) {
      return void 0;
    }
    const uri = buildAgentHostCustomizationsUri(this._environmentService.userRoamingDataHome, rawId);
    const snapshot = await readAgentHostCustomizationsSnapshot(this._fileService, uri);
    return snapshot && snapshot.length > 0 ? snapshot : void 0;
  }
  async _provideChatDebugLog(sessionResource, token) {
    if (!this._configurationService.getValue(AgentHostAgentDebugLogEnabledSettingId)) {
      return void 0;
    }
    const eventsUri = this._resolveEventsUri(sessionResource);
    if (!eventsUri) {
      return void 0;
    }
    this._ensureLiveRefresh(sessionResource, eventsUri);
    const records = await this._readEventRecords(eventsUri, token);
    if (records === void 0) {
      return void 0;
    }
    if (token.isCancellationRequested) {
      return void 0;
    }
    const liveUsageTotals = this._getLiveUsageTotals(sessionResource);
    const usageRecords = await this._readUsageRecords(sessionResource);
    if (token.isCancellationRequested) {
      return void 0;
    }
    let customizations = this._customizationService.getCustomizations(sessionResource);
    if (customizations.length === 0) {
      customizations = await this._readCustomizationsSnapshot(sessionResource) ?? customizations;
      if (token.isCancellationRequested) {
        return void 0;
      }
    }
    const { events, resolved } = convertAgentHostEventsToDebugEvents(records, sessionResource, liveUsageTotals, usageRecords, customizations);
    for (const [id, detail] of resolved) {
      this._resolved.set(id, detail);
      if (this._resolved.size > MAX_RESOLVED_DETAILS) {
        const first = this._resolved.keys().next().value;
        if (first !== void 0) {
          this._resolved.delete(first);
        }
      }
    }
    return events;
  }
  /**
   * Reads the session's `events.jsonl` into parsed records, reading only the
   * bytes appended since the last read for the actively-viewed session.
   *
   * The Copilot CLI appends to `events.jsonl` line-by-line from a separate
   * process, so a live session is an append-only stream. Rather than
   * re-reading and re-`JSON.parse`-ing the whole (potentially multi-MB) file
   * on every change — which is O(N) per tick and O(N^2) over a long session —
   * we cache the parsed records plus the byte offset consumed so far and read
   * only the new tail. A full read is used on first view, a cache miss, or
   * when the file shrank (rotation/truncation).
   *
   * Byte offsets are only ever advanced to a newline boundary (`\n` is a
   * single byte that never appears inside a multi-byte UTF-8 sequence), so a
   * tail read never starts mid-codepoint; any trailing partial line is kept
   * as `pendingBytes` and prepended to the next read.
   *
   * Returns `undefined` when the file does not exist yet or cannot be read.
   */
  /**
   * The configured in-memory event cap for agent host sessions (see
   * {@link AgentHostAgentDebugLogMaxEventsSettingId}). The raw record cache is
   * trimmed to this many entries so a long-running session does not retain an
   * unbounded array, matching the capped public event buffer.
   */
  _maxRecordsInMemory() {
    const configured = this._configurationService.getValue(AgentHostAgentDebugLogMaxEventsSettingId);
    if (typeof configured === "number" && Number.isFinite(configured) && configured >= 1) {
      return Math.floor(configured);
    }
    return DEFAULT_MAX_EVENTS_IN_MEMORY;
  }
  /** Trims `records` in place to the most recent {@link _maxRecordsInMemory} entries. */
  _capRecordsInMemory(records) {
    const max = this._maxRecordsInMemory();
    if (records.length > max) {
      records.splice(0, records.length - max);
    }
  }
  async _readEventRecords(eventsUri, token) {
    const key = eventsUri.toString();
    let size;
    try {
      const stat = await this._fileService.stat(eventsUri);
      size = stat.size ?? 0;
    } catch {
      this._liveRead = void 0;
      return void 0;
    }
    if (token.isCancellationRequested) {
      return void 0;
    }
    const cache = this._liveRead?.key === key ? this._liveRead : void 0;
    if (cache && size >= cache.consumedBytes) {
      if (size === cache.consumedBytes) {
        return cache.records;
      }
      try {
        const content = await this._fileService.readFile(eventsUri, { position: cache.consumedBytes, length: size - cache.consumedBytes });
        if (token.isCancellationRequested) {
          return void 0;
        }
        const combined = cache.pendingBytes.byteLength ? VSBuffer.concat([cache.pendingBytes, content.value]) : content.value;
        const lastNewline2 = lastIndexOfNewline(combined);
        if (lastNewline2 >= 0) {
          appendJsonlRecords(combined.slice(0, lastNewline2 + 1).toString(), cache.records);
          cache.pendingBytes = combined.slice(lastNewline2 + 1);
        } else {
          cache.pendingBytes = combined;
        }
        cache.consumedBytes = size;
        this._capRecordsInMemory(cache.records);
        return cache.records;
      } catch {
      }
    }
    let buffer;
    try {
      const content = await this._fileService.readFile(eventsUri);
      buffer = content.value;
    } catch {
      this._liveRead = void 0;
      return void 0;
    }
    if (token.isCancellationRequested) {
      return void 0;
    }
    const lastNewline = lastIndexOfNewline(buffer);
    const records = [];
    if (lastNewline >= 0) {
      appendJsonlRecords(buffer.slice(0, lastNewline + 1).toString(), records);
    }
    this._capRecordsInMemory(records);
    this._liveRead = {
      key,
      consumedBytes: buffer.byteLength,
      pendingBytes: lastNewline >= 0 ? buffer.slice(lastNewline + 1) : buffer,
      records
    };
    return records;
  }
  async _discoverLocalSessions(token) {
    const userHome = this._pathService.userHome({ preferLocal: true });
    const sessionStateDir = buildLocalSessionStateUri(userHome);
    let stat;
    try {
      stat = await this._fileService.resolve(sessionStateDir, { resolveMetadata: true });
    } catch {
      return [];
    }
    if (token.isCancellationRequested) {
      return [];
    }
    const folders = (stat.children ?? []).filter((child) => child.isDirectory).sort((a, b) => b.mtime - a.mtime).slice(0, MAX_DISCOVERED_SESSIONS);
    const found = await Promise.all(folders.map(async (folder) => {
      const eventsUri = joinPath(folder.resource, "events.jsonl");
      let title;
      try {
        const head = await this._fileService.readFile(eventsUri, { length: TITLE_READ_BYTES });
        title = extractSessionTitle(head.value.toString()) ?? fallbackSessionTitle(folder.name);
      } catch {
        return void 0;
      }
      return { uri: URI.from({ scheme: COPILOT_CLI_LOCAL_AH_SCHEME, path: `/${folder.name}` }), title };
    }));
    if (token.isCancellationRequested) {
      return [];
    }
    return found.filter((s) => s !== void 0);
  }
};
AgentHostChatDebugContribution = __decorateClass([
  __decorateParam(0, IChatDebugService),
  __decorateParam(1, IFileService),
  __decorateParam(2, IPathService),
  __decorateParam(3, IRemoteAgentHostService),
  __decorateParam(4, IAgentHostService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, ILogService),
  __decorateParam(7, IWorkbenchEnvironmentService),
  __decorateParam(8, IAgentHostCustomizationService)
], AgentHostChatDebugContribution);
function convertAgentHostEventsToDebugEvents(records, sessionResource, fallbackUsageTotals, usageRecords, customizations) {
  const completeByToolCallId = /* @__PURE__ */ new Map();
  const turnStartByTurnId = /* @__PURE__ */ new Map();
  const hookEndByInvocationId = /* @__PURE__ */ new Map();
  const permissionCompleteByRequestId = /* @__PURE__ */ new Map();
  const subagentCompleteByToolCallId = /* @__PURE__ */ new Map();
  for (const record of records) {
    if (record.type === "tool.execution_complete") {
      const toolCallId = asString(record.data.toolCallId);
      if (toolCallId) {
        completeByToolCallId.set(toolCallId, record);
      }
    } else if (record.type === "assistant.turn_start") {
      const turnId = asString(record.data.turnId);
      if (turnId) {
        turnStartByTurnId.set(turnId, record);
      }
    } else if (record.type === "hook.end") {
      const invocationId = asString(record.data.hookInvocationId);
      if (invocationId) {
        hookEndByInvocationId.set(invocationId, record);
      }
    } else if (record.type === "permission.completed") {
      const requestId = asString(record.data.requestId);
      if (requestId) {
        permissionCompleteByRequestId.set(requestId, record);
      }
    } else if (record.type === "subagent.completed") {
      const toolCallId = asString(record.data.toolCallId);
      if (toolCallId) {
        subagentCompleteByToolCallId.set(toolCallId, record);
      }
    }
  }
  const events = [];
  const resolved = /* @__PURE__ */ new Map();
  const modelTurnRefs = [];
  let rootEventId;
  let rootCreated;
  const currentUserMessageByAgent = /* @__PURE__ */ new Map();
  const currentAssistantMessageByAgent = /* @__PURE__ */ new Map();
  const toolEventByToolCallId = /* @__PURE__ */ new Map();
  const hasConfiguredHooks = !!customizations && flattenCustomizations(customizations).some((c) => c.type === CustomizationType.Hook && c.enabled);
  for (const record of records) {
    const created = new Date(record.timestamp);
    const agentKey = record.agentId ?? "";
    const turnParent = currentAssistantMessageByAgent.get(agentKey) ?? currentUserMessageByAgent.get(agentKey) ?? rootEventId;
    switch (record.type) {
      case "session.start": {
        rootEventId = record.id;
        rootCreated = created;
        const model = asString(record.data.selectedModel);
        const effort = asString(record.data.reasoningEffort);
        const version = asString(record.data.copilotVersion);
        const context = asRecord(record.data.context);
        const repository = asString(context?.repository);
        const branch = asString(context?.branch);
        const parts = [];
        if (model) {
          parts.push(effort ? localize("agentHost.debug.sessionStartedDetails", "model={0}, reasoningEffort={1}", model, effort) : localize("agentHost.debug.sessionStartedModel", "model={0}", model));
        }
        if (version) {
          parts.push(localize("agentHost.debug.sessionCliVersion", "CLI {0}", version));
        }
        if (repository) {
          parts.push(branch ? localize("agentHost.debug.sessionRepoBranch", "{0}@{1}", repository, branch) : repository);
        }
        events.push({
          kind: "generic",
          id: record.id,
          sessionResource,
          created,
          parentEventId: void 0,
          name: localize("agentHost.debug.sessionStarted", "Session Started"),
          details: parts.length ? parts.join(", ") : void 0,
          level: ChatDebugLogLevel.Info,
          category: "session"
        });
        break;
      }
      case "user.message": {
        const content = asString(record.data.content) ?? "";
        const transformed = asString(record.data.transformedContent);
        const sections = [
          { name: localize("agentHost.debug.userRequest", "User Request"), content }
        ];
        if (transformed && transformed !== content) {
          sections.push({ name: localize("agentHost.debug.fullPrompt", "Full Prompt"), content: transformed });
        }
        const message = summarize(content);
        currentUserMessageByAgent.set(agentKey, record.id);
        currentAssistantMessageByAgent.delete(agentKey);
        events.push({ kind: "userMessage", id: record.id, sessionResource, created, parentEventId: rootEventId, message, sections });
        resolved.set(record.id, { kind: "message", type: "user", message, sections });
        break;
      }
      case "assistant.message": {
        const model = asString(record.data.model);
        const outputTokens = asNumber(record.data.outputTokens);
        const content = asString(record.data.content) ?? "";
        const reasoning = asString(record.data.reasoningText);
        const parentToolCallId = asString(record.data.parentToolCallId);
        const spawningTool = parentToolCallId ? toolEventByToolCallId.get(parentToolCallId) : void 0;
        const parentEventId = spawningTool ?? currentUserMessageByAgent.get(agentKey) ?? rootEventId;
        const turnId = asString(record.data.turnId);
        const turnStart = turnId ? turnStartByTurnId.get(turnId) : void 0;
        const durationInMillis = turnStart ? diffMillis(turnStart.timestamp, record.timestamp) : void 0;
        currentAssistantMessageByAgent.set(agentKey, record.id);
        modelTurnRefs.push({ index: events.length, id: record.id, turnId, outputTokens });
        events.push({
          kind: "modelTurn",
          id: record.id,
          sessionResource,
          created,
          parentEventId,
          model,
          requestName: "copilotcli",
          outputTokens,
          durationInMillis
        });
        const sections = [];
        if (content) {
          sections.push({ name: localize("agentHost.debug.response", "Response"), content });
        }
        if (reasoning) {
          sections.push({ name: localize("agentHost.debug.reasoning", "Reasoning"), content: reasoning });
        }
        resolved.set(record.id, { kind: "modelTurn", requestName: "copilotcli", model, outputTokens, durationInMillis, sections });
        break;
      }
      case "tool.execution_start": {
        const toolName = asString(record.data.toolName) ?? "tool";
        const toolCallId = asString(record.data.toolCallId);
        const complete = toolCallId ? completeByToolCallId.get(toolCallId) : void 0;
        const success = complete ? asBoolean(complete.data.success) : void 0;
        const result = success === void 0 ? void 0 : success ? "success" : "error";
        const durationInMillis = complete ? diffMillis(record.timestamp, complete.timestamp) : void 0;
        const fullInput = stringifyPayload(record.data.arguments);
        const fullOutput = complete ? stringifyPayload(complete.data.result) : void 0;
        const parentToolCallId = asString(record.data.parentToolCallId);
        const parentTool = parentToolCallId ? toolEventByToolCallId.get(parentToolCallId) : void 0;
        const parentEventId = parentTool ?? currentAssistantMessageByAgent.get(agentKey) ?? currentUserMessageByAgent.get(agentKey) ?? rootEventId;
        if (toolCallId) {
          toolEventByToolCallId.set(toolCallId, record.id);
        }
        events.push({
          kind: "toolCall",
          id: record.id,
          sessionResource,
          created,
          parentEventId,
          toolName,
          toolCallId,
          result,
          durationInMillis,
          input: truncate(fullInput, MAX_EVENT_PAYLOAD),
          output: truncate(fullOutput, MAX_EVENT_PAYLOAD)
        });
        resolved.set(record.id, {
          kind: "toolCall",
          toolName,
          result,
          durationInMillis,
          input: truncate(fullInput, MAX_DETAIL_PAYLOAD),
          output: truncate(fullOutput, MAX_DETAIL_PAYLOAD)
        });
        break;
      }
      // `tool.execution_complete` is folded into its start record above.
      case "session.error": {
        const message = asString(record.data.message) ?? localize("agentHost.debug.unknownError", "Unknown error");
        const errorType = asString(record.data.errorType);
        const stack = asString(record.data.stack);
        events.push({
          kind: "generic",
          id: record.id,
          sessionResource,
          created,
          parentEventId: turnParent,
          name: errorType ? localize("agentHost.debug.sessionErrorTyped", "Error ({0})", errorType) : localize("agentHost.debug.sessionError", "Error"),
          details: truncate(message, MAX_EVENT_PAYLOAD),
          level: ChatDebugLogLevel.Error,
          category: "session"
        });
        const detailText = stack ? `${message}

${stack}` : message;
        resolved.set(record.id, { kind: "text", value: truncate(detailText, MAX_DETAIL_PAYLOAD) ?? detailText });
        break;
      }
      case "session.warning": {
        const message = asString(record.data.message) ?? "";
        const warningType = asString(record.data.warningType);
        events.push({
          kind: "generic",
          id: record.id,
          sessionResource,
          created,
          parentEventId: turnParent,
          name: warningType ? localize("agentHost.debug.sessionWarningTyped", "Warning ({0})", warningType) : localize("agentHost.debug.sessionWarning", "Warning"),
          details: truncate(message, MAX_EVENT_PAYLOAD),
          level: ChatDebugLogLevel.Warning,
          category: "session"
        });
        if (message) {
          resolved.set(record.id, { kind: "text", value: truncate(message, MAX_DETAIL_PAYLOAD) ?? message });
        }
        break;
      }
      case "session.model_change": {
        const previousModel = asString(record.data.previousModel);
        const newModel = asString(record.data.newModel);
        const effort = asString(record.data.reasoningEffort);
        const change = previousModel && newModel ? localize("agentHost.debug.modelChangeFromTo", "{0} \u2192 {1}", previousModel, newModel) : newModel;
        const details = change && effort ? localize("agentHost.debug.modelChangeEffort", "{0} (reasoningEffort={1})", change, effort) : change;
        events.push({
          kind: "generic",
          id: record.id,
          sessionResource,
          created,
          parentEventId: turnParent,
          name: localize("agentHost.debug.modelChanged", "Model Changed"),
          details,
          level: ChatDebugLogLevel.Info,
          category: "session"
        });
        break;
      }
      case "hook.start": {
        const hookType = asString(record.data.hookType) ?? "hook";
        const invocationId = asString(record.data.hookInvocationId);
        const end = invocationId ? hookEndByInvocationId.get(invocationId) : void 0;
        const success = end ? asBoolean(end.data.success) : void 0;
        const isError = hookType === "errorOccurred";
        if ((hookType === "preToolUse" || hookType === "postToolUse") && !hasConfiguredHooks) {
          break;
        }
        const hookParent = hookType === "preToolUse" ? currentUserMessageByAgent.get(agentKey) ?? rootEventId : turnParent;
        if (!isError && success !== false) {
          events.push({
            kind: "generic",
            id: record.id,
            sessionResource,
            created,
            parentEventId: hookParent,
            name: localize("agentHost.debug.hookRan", "Hook: {0}", hookType),
            level: ChatDebugLogLevel.Info,
            category: "hook"
          });
          const routineInput = stringifyPayload(record.data.input);
          resolved.set(record.id, {
            kind: "hook",
            hookType,
            result: success === void 0 ? void 0 : success ? ChatDebugHookResult.Success : ChatDebugHookResult.Error,
            input: truncate(routineInput, MAX_DETAIL_PAYLOAD)
          });
          break;
        }
        const input = asRecord(record.data.input);
        const errorContext = asString(input?.errorContext);
        const recoverable = asBoolean(input?.recoverable);
        events.push({
          kind: "generic",
          id: record.id,
          sessionResource,
          created,
          parentEventId: hookParent,
          name: isError ? errorContext ? localize("agentHost.debug.hookErrorContext", "Error During {0}", errorContext) : localize("agentHost.debug.hookError", "Error Occurred") : localize("agentHost.debug.hookFailed", "Hook Failed: {0}", hookType),
          details: isError && recoverable !== void 0 ? recoverable ? localize("agentHost.debug.hookRecoverable", "Recoverable; retrying") : localize("agentHost.debug.hookUnrecoverable", "Unrecoverable") : void 0,
          level: isError ? recoverable === false ? ChatDebugLogLevel.Error : ChatDebugLogLevel.Warning : ChatDebugLogLevel.Error,
          category: "hook"
        });
        const inputText = stringifyPayload(record.data.input);
        const endError = asRecord(end?.data.error);
        const errorParts = endError ? [asString(endError.message), asString(endError.source)].filter((s) => !!s) : [];
        const outputText = end && end.data.output !== void 0 ? stringifyPayload(end.data.output) : void 0;
        resolved.set(record.id, {
          kind: "hook",
          hookType,
          result: success === void 0 ? void 0 : success ? ChatDebugHookResult.Success : ChatDebugHookResult.Error,
          input: truncate(inputText, MAX_DETAIL_PAYLOAD),
          output: outputText ? truncate(outputText, MAX_DETAIL_PAYLOAD) : void 0,
          errorMessage: errorParts.length > 0 ? truncate(errorParts.join("\n"), MAX_DETAIL_PAYLOAD) : void 0
        });
        break;
      }
      // `hook.end` is folded into its `hook.start` above.
      case "permission.requested": {
        const requestId = asString(record.data.requestId);
        const permissionRequest = asRecord(record.data.permissionRequest);
        const kind = asString(permissionRequest?.kind) ?? "permission";
        const intention = asString(permissionRequest?.intention);
        const toolCallId = asString(permissionRequest?.toolCallId);
        const completed = requestId ? permissionCompleteByRequestId.get(requestId) : void 0;
        const resultKind = completed ? asString(asRecord(completed.data.result)?.kind) : void 0;
        if (resultKind === "approved") {
          break;
        }
        const parentEventId = (toolCallId ? toolEventByToolCallId.get(toolCallId) : void 0) ?? turnParent;
        events.push({
          kind: "generic",
          id: record.id,
          sessionResource,
          created,
          parentEventId,
          name: resultKind ? localize("agentHost.debug.permissionResolved", "Permission {0}: {1}", resultKind, kind) : localize("agentHost.debug.permissionPending", "Awaiting Permission: {0}", kind),
          details: intention,
          level: ChatDebugLogLevel.Warning,
          category: "permission"
        });
        const path = asString(permissionRequest?.path);
        const lines = [
          localize("agentHost.debug.permissionKind", "kind: {0}", kind),
          intention ? localize("agentHost.debug.permissionIntention", "intention: {0}", intention) : void 0,
          path ? localize("agentHost.debug.permissionPath", "path: {0}", path) : void 0,
          localize("agentHost.debug.permissionResult", "result: {0}", resultKind ?? localize("agentHost.debug.permissionPendingValue", "pending"))
        ].filter((l) => !!l);
        resolved.set(record.id, { kind: "text", value: lines.join("\n") });
        break;
      }
      // `permission.completed` is folded into its `permission.requested` above.
      case "subagent.started": {
        const toolCallId = asString(record.data.toolCallId);
        const agentName = asString(record.data.agentDisplayName) ?? asString(record.data.agentName) ?? "subagent";
        const description = asString(record.data.agentDescription);
        const model = asString(record.data.model);
        const complete = toolCallId ? subagentCompleteByToolCallId.get(toolCallId) : void 0;
        const toolCallCount = complete ? asNumber(complete.data.totalToolCalls) : void 0;
        const totalTokens = complete ? asNumber(complete.data.totalTokens) : void 0;
        const durationInMillis = complete ? asNumber(complete.data.durationMs) : void 0;
        const parentEventId = (toolCallId ? toolEventByToolCallId.get(toolCallId) : void 0) ?? turnParent;
        events.push({
          kind: "subagentInvocation",
          id: record.id,
          sessionResource,
          created,
          parentEventId,
          agentName,
          description,
          status: complete ? "completed" : "running",
          toolCallCount,
          durationInMillis
        });
        const lines = [
          localize("agentHost.debug.subagentName", "agent: {0}", agentName),
          model ? localize("agentHost.debug.subagentModel", "model: {0}", model) : void 0,
          toolCallCount !== void 0 ? localize("agentHost.debug.subagentToolCalls", "tool calls: {0}", toolCallCount) : void 0,
          totalTokens !== void 0 ? localize("agentHost.debug.subagentTokens", "tokens: {0}", totalTokens) : void 0,
          description ? `
${description}` : void 0
        ].filter((l) => !!l);
        resolved.set(record.id, { kind: "text", value: lines.join("\n") });
        break;
      }
      // `subagent.completed` is folded into its `subagent.started` above.
      case "session.compaction_start": {
        const systemTokens = asNumber(record.data.systemTokens) ?? 0;
        const conversationTokens = asNumber(record.data.conversationTokens) ?? 0;
        const toolTokens = asNumber(record.data.toolDefinitionsTokens) ?? 0;
        events.push({
          kind: "generic",
          id: record.id,
          sessionResource,
          created,
          parentEventId: turnParent,
          name: localize("agentHost.debug.compaction", "Context Compaction"),
          details: localize("agentHost.debug.compactionTokens", "system={0}, conversation={1}, tools={2} tokens", systemTokens, conversationTokens, toolTokens),
          level: ChatDebugLogLevel.Info,
          category: "session"
        });
        break;
      }
      case "session.compaction_complete": {
        if (asBoolean(record.data.success) !== false) {
          break;
        }
        const error = asString(record.data.error);
        events.push({
          kind: "generic",
          id: record.id,
          sessionResource,
          created,
          parentEventId: turnParent,
          name: localize("agentHost.debug.compactionFailed", "Context Compaction Failed"),
          details: truncate(error, MAX_EVENT_PAYLOAD),
          level: ChatDebugLogLevel.Error,
          category: "session"
        });
        if (error) {
          resolved.set(record.id, { kind: "text", value: truncate(error, MAX_DETAIL_PAYLOAD) ?? error });
        }
        break;
      }
      case "abort": {
        const reason = asString(record.data.reason);
        events.push({
          kind: "generic",
          id: record.id,
          sessionResource,
          created,
          parentEventId: turnParent,
          name: localize("agentHost.debug.aborted", "Aborted"),
          details: reason,
          level: ChatDebugLogLevel.Warning,
          category: "session"
        });
        break;
      }
      case "skill.invoked": {
        const name = asString(record.data.name) ?? "skill";
        const trigger = asString(record.data.trigger);
        const source = asString(record.data.pluginName) ?? asString(record.data.source);
        const content = asString(record.data.content);
        events.push({
          kind: "generic",
          id: record.id,
          sessionResource,
          created,
          parentEventId: turnParent,
          name: localize("agentHost.debug.skillInvoked", "Skill Invoked: {0}", name),
          details: [trigger, source].filter(Boolean).join(" \xB7 ") || void 0,
          level: ChatDebugLogLevel.Info,
          category: "customization"
        });
        if (content) {
          resolved.set(record.id, { kind: "text", value: truncate(content, MAX_DETAIL_PAYLOAD) ?? content });
        }
        break;
      }
    }
  }
  const fillTurnsWithTotals = (targets, totals) => {
    const n = targets.length;
    if (n === 0) {
      return;
    }
    const inputs = totals.inputTokens !== void 0 ? distributeEvenly(totals.inputTokens, n) : void 0;
    const cached = totals.cacheReadTokens !== void 0 ? distributeEvenly(totals.cacheReadTokens, n) : void 0;
    const aiu = distributeEvenly(totals.totalNanoAiu, n);
    for (let i = 0; i < n; i++) {
      const ref = targets[i];
      const turn = events[ref.index];
      const inputTokens = inputs?.[i];
      const cachedTokens = cached?.[i];
      const totalTokens = inputTokens !== void 0 ? inputTokens + (ref.outputTokens ?? 0) : void 0;
      const copilotUsageNanoAiu = aiu[i] > 0 ? aiu[i] : void 0;
      events[ref.index] = { ...turn, inputTokens, cachedTokens, totalTokens, copilotUsageNanoAiu };
      const detail = resolved.get(ref.id);
      if (detail?.kind === "modelTurn") {
        resolved.set(ref.id, { ...detail, inputTokens, cachedTokens, totalTokens });
      }
    }
  };
  if (usageRecords && usageRecords.length > 0 && modelTurnRefs.length > 0) {
    const coverage = applyPerTurnUsage(events, resolved, modelTurnRefs, usageRecords);
    const uncovered = modelTurnRefs.filter((_ref, i) => !coverage.covered.has(i));
    if (uncovered.length > 0) {
      const totals = extractSessionUsageTotals(records) ?? fallbackUsageTotals;
      if (totals) {
        fillTurnsWithTotals(uncovered, {
          inputTokens: totals.inputTokens !== void 0 ? Math.max(0, totals.inputTokens - coverage.assignedInput) : void 0,
          cacheReadTokens: totals.cacheReadTokens !== void 0 ? Math.max(0, totals.cacheReadTokens - coverage.assignedCache) : void 0,
          totalNanoAiu: Math.max(0, totals.totalNanoAiu - coverage.assignedAiu)
        });
      }
    }
  } else if (modelTurnRefs.length > 0) {
    const totals = extractSessionUsageTotals(records) ?? fallbackUsageTotals;
    if (totals) {
      fillTurnsWithTotals(modelTurnRefs, totals);
    }
  }
  if (customizations && customizations.length > 0) {
    const created = rootCreated ?? (records.length > 0 ? new Date(records[0].timestamp) : /* @__PURE__ */ new Date());
    const { events: customEvents, resolved: customResolved } = buildCustomizationDebugEvents(customizations, sessionResource, rootEventId, created);
    events.push(...customEvents);
    for (const [id, detail] of customResolved) {
      resolved.set(id, detail);
    }
  }
  return { events, resolved };
}
const CUSTOMIZATION_TYPE_ORDER = [
  CustomizationType.Skill,
  CustomizationType.Hook,
  CustomizationType.Agent,
  CustomizationType.McpServer,
  CustomizationType.Rule,
  CustomizationType.Prompt
];
function flattenCustomizations(customizations) {
  const out = [];
  const visit = (c) => {
    if (c.type === CustomizationType.Plugin || c.type === CustomizationType.Directory) {
      for (const child of c.children ?? []) {
        visit(child);
      }
      return;
    }
    out.push({
      type: c.type,
      name: c.name,
      uri: c.uri,
      enabled: c.enabled !== false,
      description: c.description
    });
  };
  for (const c of customizations) {
    visit(c);
  }
  return out;
}
function customizationDiscoveryName(type) {
  switch (type) {
    case CustomizationType.Skill:
      return localize("agentHost.debug.skillDiscovery", "Skill Discovery");
    case CustomizationType.Hook:
      return localize("agentHost.debug.hookDiscovery", "Hook Discovery");
    case CustomizationType.Agent:
      return localize("agentHost.debug.agentDiscovery", "Agent Discovery");
    case CustomizationType.McpServer:
      return localize("agentHost.debug.mcpDiscovery", "MCP Server Discovery");
    case CustomizationType.Rule:
      return localize("agentHost.debug.ruleDiscovery", "Instructions Discovery");
    case CustomizationType.Prompt:
      return localize("agentHost.debug.promptDiscovery", "Prompt Discovery");
    default:
      return localize("agentHost.debug.customizationDiscovery", "Customization Discovery");
  }
}
function customizationSummaryCategory(c) {
  if (!c.enabled) {
    return "skipped";
  }
  switch (c.type) {
    case CustomizationType.Skill:
      return "skill";
    case CustomizationType.Agent:
      return "custom-agent";
    case CustomizationType.Hook:
      return "hook";
    case CustomizationType.Rule:
      return "applying";
    default:
      return void 0;
  }
}
function buildCustomizationDebugEvents(customizations, sessionResource, parentEventId, created) {
  const events = [];
  const resolved = /* @__PURE__ */ new Map();
  const flat = flattenCustomizations(customizations);
  if (flat.length === 0) {
    return { events, resolved };
  }
  const byType = /* @__PURE__ */ new Map();
  for (const c of flat) {
    const list = byType.get(c.type);
    if (list) {
      list.push(c);
    } else {
      byType.set(c.type, [c]);
    }
  }
  const key = sessionResource.toString();
  for (const type of CUSTOMIZATION_TYPE_ORDER) {
    const list = byType.get(type);
    if (!list || list.length === 0) {
      continue;
    }
    const id = `agentHostCustomization:${key}:${type}`;
    const loadedCount = list.filter((c) => c.enabled).length;
    const skippedCount = list.length - loadedCount;
    events.push({
      kind: "generic",
      id,
      sessionResource,
      created,
      parentEventId,
      name: customizationDiscoveryName(type),
      details: skippedCount > 0 ? localize("agentHost.debug.customizationLoadedSkipped", "{0} loaded, {1} disabled", loadedCount, skippedCount) : localize("agentHost.debug.customizationLoaded", "{0} loaded", loadedCount),
      level: ChatDebugLogLevel.Info,
      category: "discovery"
    });
    const files = list.map((c) => ({
      uri: URI.parse(c.uri),
      name: c.name,
      status: c.enabled ? "loaded" : "skipped",
      skipReason: c.enabled ? void 0 : localize("agentHost.debug.customizationDisabled", "disabled")
    }));
    resolved.set(id, { kind: "fileList", discoveryType: type, durationInMillis: 0, files });
  }
  const logs = [];
  for (const c of flat) {
    const category = customizationSummaryCategory(c);
    if (!category) {
      continue;
    }
    logs.push({ category, name: c.name, uri: URI.parse(c.uri), reason: c.description });
  }
  if (logs.length > 0) {
    const id = `agentHostCustomization:${key}:summary`;
    const counts = {
      instructions: logs.filter((e) => e.category === "applying" || e.category === "referenced").length,
      skills: logs.filter((e) => e.category === "skill").length,
      agents: logs.filter((e) => e.category === "custom-agent").length,
      hooks: logs.filter((e) => e.category === "hook").length,
      skipped: logs.filter((e) => e.category === "skipped").length
    };
    events.push({
      kind: "generic",
      id,
      sessionResource,
      created,
      parentEventId,
      name: localize("agentHost.debug.customizationsResolved", "Resolve Customizations"),
      details: localize("agentHost.debug.customizationsResolvedDetails", "{0} skills, {1} agents, {2} hooks, {3} instructions", counts.skills, counts.agents, counts.hooks, counts.instructions),
      level: ChatDebugLogLevel.Info,
      category: "customization"
    });
    resolved.set(id, { kind: "customizationSummary", resolutionLogs: logs, durationInMillis: 0, counts });
  }
  return { events, resolved };
}
function applyPerTurnUsage(events, resolved, modelTurnRefs, usageRecords) {
  const assign = (ref, inputTokens, cachedTokens, copilotUsageNanoAiu) => {
    const turn = events[ref.index];
    const totalTokens = inputTokens !== void 0 ? inputTokens + (ref.outputTokens ?? 0) : void 0;
    events[ref.index] = { ...turn, inputTokens, cachedTokens, totalTokens, copilotUsageNanoAiu };
    const detail = resolved.get(ref.id);
    if (detail?.kind === "modelTurn") {
      resolved.set(ref.id, { ...detail, inputTokens, cachedTokens, totalTokens });
    }
  };
  const aiuByRecordIndex = new Array(usageRecords.length).fill(void 0);
  for (let start = 0; start < usageRecords.length; ) {
    let end = start;
    while (end + 1 < usageRecords.length && usageRecords[end + 1].turnId === usageRecords[start].turnId) {
      end++;
    }
    let maxAiu = 0;
    for (let i = start; i <= end; i++) {
      maxAiu = Math.max(maxAiu, usageRecords[i].totalNanoAiu ?? 0);
    }
    if (maxAiu > 0) {
      aiuByRecordIndex[end] = maxAiu;
    }
    start = end + 1;
  }
  let recordIndex = 0;
  let assignedInput = 0;
  let assignedCache = 0;
  let assignedAiu = 0;
  const covered = /* @__PURE__ */ new Set();
  for (let refIdx = 0; refIdx < modelTurnRefs.length; refIdx++) {
    if (recordIndex >= usageRecords.length) {
      break;
    }
    const ref = modelTurnRefs[refIdx];
    const record = usageRecords[recordIndex];
    if (ref.outputTokens !== void 0 && record.outputTokens !== void 0 && ref.outputTokens !== record.outputTokens) {
      continue;
    }
    const aiu = aiuByRecordIndex[recordIndex];
    assign(ref, record.inputTokens, record.cacheReadTokens, aiu);
    assignedInput += record.inputTokens ?? 0;
    assignedCache += record.cacheReadTokens ?? 0;
    assignedAiu += aiu ?? 0;
    covered.add(refIdx);
    recordIndex++;
  }
  return { covered, assignedInput, assignedCache, assignedAiu };
}
function extractSessionUsageTotals(records) {
  let shutdown;
  for (const record of records) {
    if (record.type === "session.shutdown") {
      shutdown = record;
    }
  }
  if (!shutdown) {
    return void 0;
  }
  let inputTokens = 0;
  let cacheReadTokens = 0;
  let perModelNanoAiu = 0;
  const modelMetrics = shutdown.data.modelMetrics;
  if (modelMetrics && typeof modelMetrics === "object") {
    for (const metric of Object.values(modelMetrics)) {
      const entry = metric;
      const usage = entry?.usage;
      inputTokens += asNumber(usage?.inputTokens) ?? 0;
      cacheReadTokens += asNumber(usage?.cacheReadTokens) ?? 0;
      perModelNanoAiu += asNumber(entry?.totalNanoAiu) ?? 0;
    }
  }
  const totalNanoAiu = asNumber(shutdown.data.totalNanoAiu) ?? perModelNanoAiu;
  return { inputTokens, cacheReadTokens, totalNanoAiu };
}
function distributeEvenly(total, n) {
  if (n <= 0) {
    return [];
  }
  const base = Math.floor(total / n);
  const parts = new Array(n).fill(base);
  let remainder = total - base * n;
  for (let i = n - 1; remainder > 0; i--, remainder--) {
    parts[i] += 1;
  }
  return parts;
}
function sumChatStateUsage(chat) {
  let totalNanoAiu = 0;
  let hasUsage = false;
  const add = (usage) => {
    if (!usage) {
      return;
    }
    hasUsage = true;
    totalNanoAiu += readCopilotNanoAiu(usage);
  };
  for (const turn of chat.turns) {
    add(turn.usage);
  }
  add(chat.activeTurn?.usage);
  return hasUsage ? { totalNanoAiu } : void 0;
}
function readCopilotNanoAiu(usage) {
  return readUsageInfoMeta(usage).copilotUsage?.totalNanoAiu ?? 0;
}
function parseJsonl(text) {
  const records = [];
  appendJsonlRecords(text, records);
  return records;
}
function appendJsonlRecords(text, records) {
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed.type === "string" && typeof parsed.id === "string" && typeof parsed.timestamp === "string" && (parsed.parentId === null || typeof parsed.parentId === "string") && parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)) {
        records.push(parsed);
      }
    } catch {
    }
  }
}
function lastIndexOfNewline(buffer) {
  const bytes = buffer.buffer;
  for (let i = bytes.length - 1; i >= 0; i--) {
    if (bytes[i] === 10) {
      return i;
    }
  }
  return -1;
}
function fallbackSessionTitle(sessionId) {
  return localize("agentHost.debug.untitledSession", "Copilot CLI Session {0}", sessionId.slice(0, 8));
}
function extractSessionTitle(text) {
  for (const record of parseJsonl(text)) {
    if (record.type === "user.message") {
      const content = asString(record.data.content);
      if (content) {
        return summarize(content);
      }
    }
  }
  return void 0;
}
function asString(value) {
  return typeof value === "string" ? value : void 0;
}
function asNumber(value) {
  return typeof value === "number" && isFinite(value) ? value : void 0;
}
function asBoolean(value) {
  return typeof value === "boolean" ? value : void 0;
}
function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function diffMillis(start, end) {
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  return isFinite(a) && isFinite(b) && b >= a ? b - a : void 0;
}
function stringifyPayload(value) {
  if (value === void 0 || value === null) {
    return void 0;
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, void 0, 2);
  } catch {
    return void 0;
  }
}
function truncate(value, max) {
  if (value === void 0) {
    return void 0;
  }
  return value.length > max ? value.slice(0, max) + "\u2026" : value;
}
function summarize(content) {
  const firstLine = content.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  return firstLine.length > 100 ? firstLine.slice(0, 100) + "\u2026" : firstLine;
}
function toErrorMessage(err) {
  return err instanceof Error ? err.message : String(err);
}
export {
  AgentHostChatDebugContribution,
  buildCustomizationDebugEvents,
  convertAgentHostEventsToDebugEvents,
  parseJsonl
};
