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
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, DisposableMap, DisposableStore } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { ActionType } from "../../../../platform/agentHost/common/state/protocol/common/actions.js";
import { StateComponents } from "../../../../platform/agentHost/common/state/sessionState.js";
import { FEEDBACK_ANNOTATION_META_KEY, readFeedbackAnnotationMeta } from "../../../../platform/agentHost/common/meta/agentFeedbackAnnotations.js";
import { isAgentHostProviderId } from "../../../common/agentHostSessionsProvider.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { ISessionsProvidersService } from "../../../services/sessions/browser/sessionsProvidersService.js";
import { AgentFeedbackKind, AgentFeedbackState } from "./agentFeedbackModel.js";
function orderFeedbackItems(items) {
  const fileOrder = /* @__PURE__ */ new Map();
  for (const item of items) {
    const key = item.resourceUri.toString();
    if (!fileOrder.has(key)) {
      fileOrder.set(key, fileOrder.size);
    }
  }
  return items.slice().sort((a, b) => {
    const fa = fileOrder.get(a.resourceUri.toString());
    const fb = fileOrder.get(b.resourceUri.toString());
    if (fa !== fb) {
      return fa - fb;
    }
    return a.range.startLineNumber - b.range.startLineNumber;
  });
}
class InMemoryAgentFeedbackItemsBackend extends Disposable {
  constructor() {
    super(...arguments);
    this._onDidChangeItems = this._register(new Emitter());
    this.onDidChangeItems = this._onDidChangeItems.event;
    /** sessionResource → feedback items (insertion order; display order applied on read) */
    this._bySession = /* @__PURE__ */ new Map();
    this._sessionResourceByKey = /* @__PURE__ */ new Map();
  }
  getItems(sessionResource) {
    return orderFeedbackItems(this._bySession.get(sessionResource.toString()) ?? []);
  }
  hasLoaded(_sessionResource) {
    return true;
  }
  upsert(feedback) {
    const key = feedback.sessionResource.toString();
    let items = this._bySession.get(key);
    if (!items) {
      items = [];
      this._bySession.set(key, items);
      this._sessionResourceByKey.set(key, feedback.sessionResource);
    }
    const idx = items.findIndex((f) => f.id === feedback.id);
    if (idx >= 0) {
      items[idx] = feedback;
    } else {
      items.push(feedback);
    }
    this._onDidChangeItems.fire(feedback.sessionResource);
  }
  remove(sessionResource, feedbackId) {
    const key = sessionResource.toString();
    const items = this._bySession.get(key);
    if (!items) {
      return;
    }
    const idx = items.findIndex((f) => f.id === feedbackId);
    if (idx < 0) {
      return;
    }
    items.splice(idx, 1);
    if (!items.length) {
      this._bySession.delete(key);
      this._sessionResourceByKey.delete(key);
    }
    this._onDidChangeItems.fire(sessionResource);
  }
  clear(sessionResource) {
    const key = sessionResource.toString();
    if (this._bySession.delete(key)) {
      this._sessionResourceByKey.delete(key);
      this._onDidChangeItems.fire(sessionResource);
    }
  }
  getSessionsWithItems() {
    return [...this._sessionResourceByKey.values()];
  }
}
const KIND_FROM_VALUE = {
  user: AgentFeedbackKind.UserReview,
  codeReview: AgentFeedbackKind.AgentReview,
  prReview: AgentFeedbackKind.PRReview
};
const STATE_FROM_VALUE = {
  created: AgentFeedbackState.Created,
  accepted: AgentFeedbackState.Accepted,
  submitted: AgentFeedbackState.Submitted,
  resolved: AgentFeedbackState.Resolved
};
function asCodeReviewSuggestion(suggestion) {
  if (suggestion && typeof suggestion === "object" && Array.isArray(suggestion.edits)) {
    return suggestion;
  }
  return void 0;
}
function readFeedbackMeta(annotation) {
  const base = readFeedbackAnnotationMeta(annotation);
  if (!base) {
    return void 0;
  }
  return {
    kind: KIND_FROM_VALUE[base.kind],
    state: STATE_FROM_VALUE[base.state],
    sessionResource: base.sessionResource,
    suggestion: asCodeReviewSuggestion(base.suggestion),
    codeSelection: base.codeSelection,
    diffHunks: base.diffHunks,
    sourcePRReviewCommentId: base.sourcePRReviewCommentId,
    pendingAgentReveal: base.pendingAgentReveal
  };
}
function toTextRange(range) {
  return {
    start: { line: range.startLineNumber - 1, character: range.startColumn - 1 },
    end: { line: range.endLineNumber - 1, character: range.endColumn - 1 }
  };
}
function fromTextRange(range) {
  if (!range) {
    return { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 };
  }
  return {
    startLineNumber: range.start.line + 1,
    startColumn: range.start.character + 1,
    endLineNumber: range.end.line + 1,
    endColumn: range.end.character + 1
  };
}
function entryText(text) {
  return typeof text === "string" ? text : text.markdown;
}
function feedbackToAnnotation(feedback) {
  const entries = [{ id: `${feedback.id}:0`, text: feedback.text }];
  for (let i = 0; i < (feedback.replies?.length ?? 0); i++) {
    entries.push({ id: `${feedback.id}:r${i}`, text: feedback.replies[i] });
  }
  const meta = {
    kind: feedback.kind,
    state: feedback.state,
    sessionResource: feedback.sessionResource.toString(),
    suggestion: feedback.suggestion,
    codeSelection: feedback.codeSelection,
    diffHunks: feedback.diffHunks,
    sourcePRReviewCommentId: feedback.sourcePRReviewCommentId,
    pendingAgentReveal: feedback.pendingAgentReveal
  };
  return {
    id: feedback.id,
    turnId: "",
    resource: feedback.resourceUri.toString(),
    range: toTextRange(feedback.range),
    resolved: feedback.state === AgentFeedbackState.Resolved,
    entries,
    _meta: { [FEEDBACK_ANNOTATION_META_KEY]: meta }
  };
}
function annotationToFeedback(annotation, sessionResource) {
  const entries = annotation.entries ?? [];
  const meta = readFeedbackMeta(annotation);
  if (!meta || !entries.length) {
    return void 0;
  }
  const replies = entries.slice(1).map((e) => entryText(e.text));
  return {
    id: annotation.id,
    text: entryText(entries[0].text),
    resourceUri: URI.parse(annotation.resource),
    range: fromTextRange(annotation.range),
    sessionResource,
    suggestion: meta?.suggestion,
    codeSelection: meta?.codeSelection,
    diffHunks: meta?.diffHunks,
    kind: meta?.kind ?? AgentFeedbackKind.UserReview,
    sourcePRReviewCommentId: meta?.sourcePRReviewCommentId,
    replies: replies.length ? replies : void 0,
    state: annotation.resolved ? AgentFeedbackState.Resolved : meta?.state ?? AgentFeedbackState.Accepted,
    pendingAgentReveal: meta?.pendingAgentReveal
  };
}
let AnnotationsAgentFeedbackItemsBackend = class extends Disposable {
  constructor(_sessionsManagementService, _sessionsProvidersService) {
    super();
    this._sessionsManagementService = _sessionsManagementService;
    this._sessionsProvidersService = _sessionsProvidersService;
    this._onDidChangeItems = this._register(new Emitter());
    this.onDidChangeItems = this._onDidChangeItems.event;
    this._channels = this._register(new DisposableMap());
    this._channelBySession = /* @__PURE__ */ new Map();
    this._sessionResourceByKey = /* @__PURE__ */ new Map();
    /** Local cache so reads work before the first snapshot arrives. */
    this._cacheBySession = /* @__PURE__ */ new Map();
    /**
     * Signature of the feedback set we last fired {@link onDidChangeItems} for,
     * per session. The annotations channel is shared and may carry non-feedback
     * annotations; comparing signatures means churn from those does not fire a
     * spurious feedback-items change (which would bump recency / navigation).
     */
    this._signatureBySession = /* @__PURE__ */ new Map();
    /**
     * Sessions whose annotations snapshot has been received. Used to fire
     * {@link onDidChangeItems} exactly once when loading completes (even when the
     * loaded feedback set is empty), so consumers that seed feedback can wait for
     * the authoritative set before acting.
     */
    this._loadedBySession = /* @__PURE__ */ new Set();
    this._register(this._sessionsManagementService.onDidDeleteSession((session) => this._releaseChannel(session.resource)));
  }
  static {
    this.OWNER = "AnnotationsAgentFeedbackItemsBackend";
  }
  getItems(sessionResource) {
    const channel = this._ensureChannel(sessionResource);
    if (channel && this._hasSnapshot(channel.subscription)) {
      return orderFeedbackItems(this._decode(channel.subscription, sessionResource));
    }
    return orderFeedbackItems(this._cacheBySession.get(sessionResource.toString()) ?? []);
  }
  hasLoaded(sessionResource) {
    const channel = this._ensureChannel(sessionResource);
    return channel ? this._hasSnapshot(channel.subscription) : false;
  }
  upsert(feedback) {
    const channel = this._ensureChannel(feedback.sessionResource);
    this._cacheUpsert(feedback);
    if (!channel) {
      this._onDidChangeItems.fire(feedback.sessionResource);
      return;
    }
    channel.connection.dispatch(channel.annotationsUri.toString(), {
      type: ActionType.AnnotationsSet,
      annotation: feedbackToAnnotation(feedback)
    });
    if (!this._hasSnapshot(channel.subscription)) {
      this._onDidChangeItems.fire(feedback.sessionResource);
    }
  }
  remove(sessionResource, feedbackId) {
    const channel = this._ensureChannel(sessionResource);
    this._cacheRemove(sessionResource, feedbackId);
    if (!channel) {
      this._onDidChangeItems.fire(sessionResource);
      return;
    }
    channel.connection.dispatch(channel.annotationsUri.toString(), {
      type: ActionType.AnnotationsRemoved,
      annotationId: feedbackId
    });
    if (!this._hasSnapshot(channel.subscription)) {
      this._onDidChangeItems.fire(sessionResource);
    }
  }
  clear(sessionResource) {
    const items = this.getItems(sessionResource);
    const channel = this._ensureChannel(sessionResource);
    this._cacheBySession.delete(sessionResource.toString());
    if (channel) {
      for (const item of items) {
        channel.connection.dispatch(channel.annotationsUri.toString(), {
          type: ActionType.AnnotationsRemoved,
          annotationId: item.id
        });
      }
    }
    this._onDidChangeItems.fire(sessionResource);
  }
  getSessionsWithItems() {
    const result = [];
    for (const resource of this._sessionResourceByKey.values()) {
      if (this.getItems(resource).length > 0) {
        result.push(resource);
      }
    }
    return result;
  }
  /**
   * Returns the annotations channel URI backing the given session's feedback,
   * or `undefined` when the session is not an agent-host session (or no channel
   * could be resolved). Each feedback item id is an annotation id on this
   * channel, so callers can reference specific comments by id.
   */
  getAnnotationsChannelResource(sessionResource) {
    return this._ensureChannel(sessionResource)?.annotationsUri;
  }
  _hasSnapshot(subscription) {
    const value = subscription.value;
    return value !== void 0 && !(value instanceof Error);
  }
  _decode(subscription, sessionResource) {
    const value = subscription.value;
    if (!value || value instanceof Error) {
      return [];
    }
    const items = [];
    for (const annotation of value.annotations) {
      const feedback = annotationToFeedback(annotation, sessionResource);
      if (feedback) {
        items.push(feedback);
      }
    }
    return items;
  }
  /**
   * Fire {@link onDidChangeItems} only when the session's feedback set actually
   * changed. The annotations channel is generic and may carry annotations from
   * other features; without this guard their churn would bump feedback recency
   * ordering and navigation even though no feedback changed.
   */
  _onAnnotationsChange(sessionResource) {
    const key = sessionResource.toString();
    const channel = this._channelBySession.get(key);
    if (!channel) {
      return;
    }
    if (this._hasSnapshot(channel.subscription) && !this._loadedBySession.has(key)) {
      this._loadedBySession.add(key);
      this._signatureBySession.set(key, this._feedbackSignature(channel.subscription));
      this._onDidChangeItems.fire(sessionResource);
      return;
    }
    const signature = this._feedbackSignature(channel.subscription);
    if (this._signatureBySession.get(key) === signature) {
      return;
    }
    this._signatureBySession.set(key, signature);
    this._onDidChangeItems.fire(sessionResource);
  }
  /**
   * A stable signature of the feedback-bearing annotations in the
   * subscription's current snapshot (sorted by id). Excludes annotations
   * without feedback metadata so unrelated annotation activity on the shared
   * channel is ignored.
   */
  _feedbackSignature(subscription) {
    const value = subscription.value;
    if (!value || value instanceof Error) {
      return "";
    }
    const feedback = value.annotations.map((annotation) => ({ annotation, meta: readFeedbackMeta(annotation) })).filter(({ annotation, meta }) => meta !== void 0 && (annotation.entries?.length ?? 0) > 0).map(({ annotation, meta }) => ({
      id: annotation.id,
      resource: annotation.resource,
      range: annotation.range,
      resolved: annotation.resolved,
      entries: annotation.entries,
      meta
    })).sort((a, b) => a.id.localeCompare(b.id));
    return JSON.stringify(feedback);
  }
  _cacheUpsert(feedback) {
    const key = feedback.sessionResource.toString();
    let items = this._cacheBySession.get(key);
    if (!items) {
      items = [];
      this._cacheBySession.set(key, items);
    }
    const idx = items.findIndex((f) => f.id === feedback.id);
    if (idx >= 0) {
      items[idx] = feedback;
    } else {
      items.push(feedback);
    }
  }
  _cacheRemove(sessionResource, feedbackId) {
    const key = sessionResource.toString();
    const items = this._cacheBySession.get(key);
    if (!items) {
      return;
    }
    const idx = items.findIndex((f) => f.id === feedbackId);
    if (idx >= 0) {
      items.splice(idx, 1);
    }
  }
  _releaseChannel(sessionResource) {
    const key = sessionResource.toString();
    this._channels.deleteAndDispose(key);
    this._channelBySession.delete(key);
    this._sessionResourceByKey.delete(key);
    this._cacheBySession.delete(key);
    this._signatureBySession.delete(key);
    this._loadedBySession.delete(key);
  }
  _ensureChannel(sessionResource) {
    const key = sessionResource.toString();
    const existing = this._channelBySession.get(key);
    if (existing) {
      return existing;
    }
    const session = this._sessionsManagementService.getSession(sessionResource);
    if (!session || !isAgentHostProviderId(session.providerId)) {
      return void 0;
    }
    const provider = this._sessionsProvidersService.getProvider(session.providerId);
    if (!provider?.getFeedbackAnnotationsChannel) {
      return void 0;
    }
    const resolved = provider.getFeedbackAnnotationsChannel(session.sessionId);
    if (!resolved) {
      return void 0;
    }
    const store = new DisposableStore();
    const ref = store.add(resolved.connection.getSubscription(StateComponents.Annotations, resolved.annotationsUri, AnnotationsAgentFeedbackItemsBackend.OWNER));
    const channel = {
      connection: resolved.connection,
      annotationsUri: resolved.annotationsUri,
      subscription: ref.object
    };
    this._signatureBySession.set(key, this._feedbackSignature(ref.object));
    if (this._hasSnapshot(ref.object)) {
      this._loadedBySession.add(key);
    }
    store.add(ref.object.onDidChange(() => this._onAnnotationsChange(sessionResource)));
    this._channels.set(key, store);
    this._channelBySession.set(key, channel);
    this._sessionResourceByKey.set(key, sessionResource);
    return channel;
  }
};
AnnotationsAgentFeedbackItemsBackend = __decorateClass([
  __decorateParam(0, ISessionsManagementService),
  __decorateParam(1, ISessionsProvidersService)
], AnnotationsAgentFeedbackItemsBackend);
export {
  AnnotationsAgentFeedbackItemsBackend,
  InMemoryAgentFeedbackItemsBackend,
  orderFeedbackItems
};
