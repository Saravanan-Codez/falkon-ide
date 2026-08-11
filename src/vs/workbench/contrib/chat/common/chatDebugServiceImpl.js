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
import { timeout } from "../../../../base/common/async.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Emitter } from "../../../../base/common/event.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { extUri } from "../../../../base/common/resources.js";
import { ChatDebugLogLevel } from "./chatDebugService.js";
import { isAgentHostTarget, localChatSessionType } from "./chatSessionsService.js";
import { getChatSessionType } from "./model/chatUri.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { AgentHostAgentDebugLogMaxEventsSettingId } from "./promptSyntax/promptTypes.js";
class SessionEventBuffer {
  constructor(capacity) {
    this.capacity = capacity;
    this._head = 0;
    this._size = 0;
    this._buffer = new Array(capacity);
  }
  get size() {
    return this._size;
  }
  push(event) {
    const idx = (this._head + this._size) % this.capacity;
    this._buffer[idx] = event;
    if (this._size < this.capacity) {
      this._size++;
    } else {
      this._head = (this._head + 1) % this.capacity;
    }
  }
  /** Return events in insertion order. */
  toArray() {
    const result = [];
    for (let i = 0; i < this._size; i++) {
      const event = this._buffer[(this._head + i) % this.capacity];
      if (event) {
        result.push(event);
      }
    }
    return result;
  }
  /** Remove events matching the predicate and compact in-place. */
  removeWhere(predicate) {
    let write = 0;
    for (let i = 0; i < this._size; i++) {
      const idx = (this._head + i) % this.capacity;
      const event = this._buffer[idx];
      if (event && predicate(event)) {
        continue;
      }
      if (write !== i) {
        const writeIdx = (this._head + write) % this.capacity;
        this._buffer[writeIdx] = event;
      }
      write++;
    }
    for (let i = write; i < this._size; i++) {
      this._buffer[(this._head + i) % this.capacity] = void 0;
    }
    this._size = write;
  }
  clear() {
    this._buffer.fill(void 0);
    this._head = 0;
    this._size = 0;
  }
}
let ChatDebugServiceImpl = class extends Disposable {
  constructor(_configurationService) {
    super();
    this._configurationService = _configurationService;
    /** Per-session event buffers. Ordered from oldest to newest session (LRU). */
    this._sessionBuffers = new ResourceMap();
    /** Ordered list of session URIs for LRU eviction. */
    this._sessionOrder = [];
    /** Per-session tracking of seen event IDs to deduplicate events
     *  that share the same ID (e.g. subagentInvocation + userMessage
     *  emitted from the same span). Stores id → event kind so we can
     *  keep the richer event kind on collision. */
    this._seenEventIds = new ResourceMap();
    this._onDidAddEvent = this._register(new Emitter());
    this.onDidAddEvent = this._onDidAddEvent.event;
    this._onDidClearProviderEvents = this._register(new Emitter());
    this.onDidClearProviderEvents = this._onDidClearProviderEvents.event;
    this._onDidEndSession = this._register(new Emitter());
    this.onDidEndSession = this._onDidEndSession.event;
    this._onDidChangeAvailableSessionResources = this._register(new Emitter());
    this.onDidChangeAvailableSessionResources = this._onDidChangeAvailableSessionResources.event;
    this._providers = /* @__PURE__ */ new Set();
    this._invocationCts = new ResourceMap();
    /**
     * Sessions whose provider events should be cleared before the next batch of
     * provider events is applied. The clear is deferred until the first new
     * provider event actually arrives so that a provider which transiently
     * returns nothing (e.g. an Agent Host `events.jsonl` mid-rewrite) does not
     * wipe the events currently shown.
     */
    this._pendingProviderClear = new ResourceMap();
    /** Events that were returned by providers (not internally logged). */
    this._providerEvents = /* @__PURE__ */ new WeakSet();
    /** Session URIs created via import. */
    this._importedSessions = new ResourceMap();
    /** Session URIs reported by providers as available on disk (historical sessions). */
    this._availableSessionResources = [];
    this._availableSessionResourceSet = /* @__PURE__ */ new Set();
    /** Titles for historical sessions discovered from disk. */
    this._historicalSessionTitles = new ResourceMap();
    /** Human-readable titles for imported sessions. */
    this._importedSessionTitles = new ResourceMap();
    /** Lazy fetchers for available sessions from providers. Each is invoked at most once. */
    this._availableSessionsFetchers = /* @__PURE__ */ new Set();
    this._availableSessionsRequested = false;
  }
  static {
    this.MAX_EVENTS_PER_SESSION = 1e4;
  }
  static {
    this.MAX_SESSIONS = 5;
  }
  static {
    /** Priority for deduplicating events with the same ID: lower = richer. */
    this._eventKindPriority = {
      subagentInvocation: 0,
      modelTurn: 1,
      toolCall: 2,
      agentResponse: 3,
      userMessage: 4,
      generic: 5
    };
  }
  static {
    /** Session types eligible for debug logging and provider invocation. */
    this._debugEligibleSessionTypes = /* @__PURE__ */ new Set([
      localChatSessionType,
      // local sessions
      "copilotcli",
      // Copilot CLI background sessions
      "agent-host-copilotcli"
      // local Agent Host Copilot CLI sessions
    ]);
  }
  _isDebugEligibleSession(sessionResource) {
    const sessionType = getChatSessionType(sessionResource);
    return ChatDebugServiceImpl._debugEligibleSessionTypes.has(sessionType) || sessionType.startsWith("remote-") && sessionType.endsWith("-copilotcli") || this._importedSessions.has(sessionResource);
  }
  /**
   * The in-memory event capacity for a session. Agent host (Copilot CLI)
   * sessions honor a dedicated, configurable cap so their (potentially large)
   * on-disk logs can be surfaced without changing the local-session default;
   * all other sessions use {@link ChatDebugServiceImpl.MAX_EVENTS_PER_SESSION}.
   */
  _capacityForSession(sessionResource) {
    if (!isAgentHostTarget(getChatSessionType(sessionResource))) {
      return ChatDebugServiceImpl.MAX_EVENTS_PER_SESSION;
    }
    const configured = this._configurationService.getValue(AgentHostAgentDebugLogMaxEventsSettingId);
    if (typeof configured === "number" && Number.isFinite(configured) && configured >= 1) {
      return Math.floor(configured);
    }
    return ChatDebugServiceImpl.MAX_EVENTS_PER_SESSION;
  }
  log(sessionResource, name, details, level = ChatDebugLogLevel.Info, options) {
    if (!this._isDebugEligibleSession(sessionResource)) {
      return;
    }
    this.addEvent({
      kind: "generic",
      id: options?.id,
      sessionResource,
      created: /* @__PURE__ */ new Date(),
      name,
      details,
      level,
      category: options?.category,
      parentEventId: options?.parentEventId
    });
  }
  addEvent(event) {
    let buffer = this._sessionBuffers.get(event.sessionResource);
    const capacity = buffer?.capacity ?? this._capacityForSession(event.sessionResource);
    if (event.id) {
      let seen = this._seenEventIds.get(event.sessionResource);
      if (!seen) {
        seen = /* @__PURE__ */ new Map();
        this._seenEventIds.set(event.sessionResource, seen);
      }
      const existingKind = seen.get(event.id);
      if (existingKind !== void 0) {
        const priority = ChatDebugServiceImpl._eventKindPriority;
        if ((priority[event.kind] ?? 5) >= (priority[existingKind] ?? 5)) {
          return;
        }
      }
      seen.set(event.id, event.kind);
      if (seen.size > capacity) {
        const firstKey = seen.keys().next().value;
        if (firstKey !== void 0) {
          seen.delete(firstKey);
        }
      }
    }
    if (!buffer) {
      if (this._sessionOrder.length >= ChatDebugServiceImpl.MAX_SESSIONS) {
        const evicted = this._sessionOrder.shift();
        this._evictSession(evicted);
      }
      buffer = new SessionEventBuffer(capacity);
      this._sessionBuffers.set(event.sessionResource, buffer);
      this._sessionOrder.push(event.sessionResource);
    } else {
      const last = this._sessionOrder.length - 1;
      if (last < 0 || !extUri.isEqual(this._sessionOrder[last], event.sessionResource)) {
        const idx = this._sessionOrder.findIndex((u) => extUri.isEqual(u, event.sessionResource));
        if (idx !== -1 && idx !== last) {
          this._sessionOrder.splice(idx, 1);
          this._sessionOrder.push(event.sessionResource);
        }
      }
    }
    buffer.push(event);
    this._onDidAddEvent.fire(event);
  }
  addProviderEvent(event) {
    if (this._pendingProviderClear.has(event.sessionResource)) {
      this._pendingProviderClear.delete(event.sessionResource);
      this._clearProviderEvents(event.sessionResource);
    }
    this._providerEvents.add(event);
    this.addEvent(event);
  }
  getEvents(sessionResource) {
    if (sessionResource) {
      const buffer = this._sessionBuffers.get(sessionResource);
      if (!buffer) {
        return [];
      }
      let result2 = buffer.toArray();
      if (!this._isSorted(result2)) {
        result2.sort((a, b) => a.created.getTime() - b.created.getTime());
      }
      result2 = this._deduplicateEvents(result2);
      return result2;
    }
    const result = [];
    for (const buffer of this._sessionBuffers.values()) {
      result.push(...buffer.toArray());
    }
    result.sort((a, b) => a.created.getTime() - b.created.getTime());
    return result;
  }
  _isSorted(events) {
    for (let i = 1; i < events.length; i++) {
      if (events[i].created.getTime() < events[i - 1].created.getTime()) {
        return false;
      }
    }
    return true;
  }
  _deduplicateEvents(events) {
    const seen = /* @__PURE__ */ new Map();
    const priority = ChatDebugServiceImpl._eventKindPriority;
    const result = [];
    for (const event of events) {
      if (!event.id) {
        result.push(event);
        continue;
      }
      const existingIdx = seen.get(event.id);
      if (existingIdx === void 0) {
        seen.set(event.id, result.length);
        result.push(event);
      } else {
        const existing = result[existingIdx];
        if ((priority[event.kind] ?? 5) < (priority[existing.kind] ?? 5)) {
          result[existingIdx] = event;
        }
      }
    }
    return result;
  }
  getSessionResources() {
    return [...this._sessionOrder];
  }
  clear() {
    this._sessionBuffers.clear();
    this._sessionOrder.length = 0;
    this._seenEventIds.clear();
    this._importedSessions.clear();
    this._importedSessionTitles.clear();
    this._availableSessionResources.length = 0;
    this._availableSessionResourceSet.clear();
    this._historicalSessionTitles.clear();
  }
  /** Remove all ancillary state for an evicted session. */
  _evictSession(sessionResource) {
    this._sessionBuffers.delete(sessionResource);
    this._seenEventIds.delete(sessionResource);
    this._importedSessions.delete(sessionResource);
    this._importedSessionTitles.delete(sessionResource);
    const cts = this._invocationCts.get(sessionResource);
    if (cts) {
      cts.cancel();
      cts.dispose();
      this._invocationCts.delete(sessionResource);
    }
  }
  registerProvider(provider) {
    this._providers.add(provider);
    for (const [sessionResource, cts] of this._invocationCts) {
      if (!cts.token.isCancellationRequested) {
        this._invokeProvider(provider, sessionResource, cts.token).catch(onUnexpectedError);
      }
    }
    return toDisposable(() => {
      this._providers.delete(provider);
    });
  }
  hasInvokedProviders(sessionResource) {
    return this._invocationCts.has(sessionResource);
  }
  async invokeProviders(sessionResource) {
    if (!this._isDebugEligibleSession(sessionResource)) {
      return;
    }
    const existingCts = this._invocationCts.get(sessionResource);
    if (existingCts) {
      existingCts.cancel();
      existingCts.dispose();
    }
    this._pendingProviderClear.set(sessionResource, true);
    const cts = new CancellationTokenSource();
    this._invocationCts.set(sessionResource, cts);
    try {
      const promises = [...this._providers].map(
        (provider) => this._invokeProvider(provider, sessionResource, cts.token)
      );
      await Promise.allSettled(promises);
    } catch (err) {
      onUnexpectedError(err);
    }
  }
  async _invokeProvider(provider, sessionResource, token) {
    try {
      const events = await provider.provideChatDebugLog(sessionResource, token);
      if (events) {
        const BATCH_SIZE = 500;
        for (let i = 0; i < events.length; i++) {
          if (token.isCancellationRequested) {
            break;
          }
          this.addProviderEvent({
            ...events[i],
            sessionResource: events[i].sessionResource ?? sessionResource
          });
          if (i > 0 && i % BATCH_SIZE === 0) {
            await timeout(0);
          }
        }
      }
    } catch (err) {
      onUnexpectedError(err);
    }
  }
  endSession(sessionResource) {
    const cts = this._invocationCts.get(sessionResource);
    if (cts) {
      cts.cancel();
      cts.dispose();
      this._invocationCts.delete(sessionResource);
    }
    this._onDidEndSession.fire(sessionResource);
  }
  _clearProviderEvents(sessionResource) {
    const buffer = this._sessionBuffers.get(sessionResource);
    if (buffer) {
      const coreEvents = buffer.toArray().filter((e) => !this._providerEvents.has(e));
      buffer.clear();
      for (const e of coreEvents) {
        buffer.push(e);
      }
    }
    this._seenEventIds.delete(sessionResource);
    this._onDidClearProviderEvents.fire(sessionResource);
  }
  async resolveEvent(eventId) {
    for (const provider of this._providers) {
      if (provider.resolveChatDebugLogEvent) {
        try {
          const resolved = await provider.resolveChatDebugLogEvent(eventId, CancellationToken.None);
          if (resolved !== void 0) {
            return resolved;
          }
        } catch (err) {
          onUnexpectedError(err);
        }
      }
    }
    return void 0;
  }
  isCoreEvent(event) {
    return !this._providerEvents.has(event);
  }
  setImportedSessionTitle(sessionResource, title) {
    this._importedSessionTitles.set(sessionResource, title);
  }
  getImportedSessionTitle(sessionResource) {
    return this._importedSessionTitles.get(sessionResource);
  }
  addAvailableSessionResources(resources) {
    let added = false;
    for (const { uri, title } of resources) {
      const key = uri.toString();
      if (!this._availableSessionResourceSet.has(key)) {
        this._availableSessionResourceSet.add(key);
        this._availableSessionResources.push(uri);
        added = true;
      }
      if (title) {
        this._historicalSessionTitles.set(uri, title);
      }
    }
    if (added) {
      this._onDidChangeAvailableSessionResources.fire();
    }
  }
  getAvailableSessionResources() {
    this._availableSessionsRequested = true;
    this._tryFetchAvailableSessions();
    const known = new Set(this._sessionOrder.map((u) => u.toString()));
    const result = [...this._sessionOrder];
    for (const uri of this._availableSessionResources) {
      if (!known.has(uri.toString())) {
        known.add(uri.toString());
        result.push(uri);
      }
    }
    return result;
  }
  registerAvailableSessionsFetcher(fetcher) {
    const entry = { fetcher, started: false };
    this._availableSessionsFetchers.add(entry);
    this._tryFetchAvailableSessions();
    return toDisposable(() => this._availableSessionsFetchers.delete(entry));
  }
  _tryFetchAvailableSessions() {
    if (!this._availableSessionsRequested) {
      return;
    }
    for (const entry of this._availableSessionsFetchers) {
      if (entry.started) {
        continue;
      }
      entry.started = true;
      entry.fetcher(CancellationToken.None).then((entries) => {
        if (entries.length > 0) {
          this.addAvailableSessionResources(entries);
        }
      }).catch(onUnexpectedError);
    }
  }
  getHistoricalSessionTitle(sessionResource) {
    return this._historicalSessionTitles.get(sessionResource);
  }
  async exportLog(sessionResource) {
    for (const provider of this._providers) {
      if (provider.provideChatDebugLogExport) {
        try {
          const data = await provider.provideChatDebugLogExport(sessionResource, CancellationToken.None);
          if (data !== void 0) {
            return data;
          }
        } catch (err) {
          onUnexpectedError(err);
        }
      }
    }
    return void 0;
  }
  async importLog(data) {
    for (const provider of this._providers) {
      if (provider.resolveChatDebugLogImport) {
        try {
          const sessionUri = await provider.resolveChatDebugLogImport(data, CancellationToken.None);
          if (sessionUri !== void 0) {
            this._importedSessions.set(sessionUri, true);
            return sessionUri;
          }
        } catch (err) {
          onUnexpectedError(err);
        }
      }
    }
    return void 0;
  }
  dispose() {
    for (const cts of this._invocationCts.values()) {
      cts.cancel();
      cts.dispose();
    }
    this._invocationCts.clear();
    this.clear();
    this._providers.clear();
    super.dispose();
  }
};
ChatDebugServiceImpl = __decorateClass([
  __decorateParam(0, IConfigurationService)
], ChatDebugServiceImpl);
export {
  ChatDebugServiceImpl
};
