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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { ICodeReviewService } from "../../codeReview/browser/codeReviewService.js";
import { AgentFeedbackKind, AgentFeedbackState, IAgentFeedbackService } from "./agentFeedbackService.js";
let AgentFeedbackPRThreadResolverContribution = class extends Disposable {
  constructor(_agentFeedbackService, _codeReviewService, _logService) {
    super();
    this._agentFeedbackService = _agentFeedbackService;
    this._codeReviewService = _codeReviewService;
    this._logService = _logService;
    /** Per session: last-seen PR-review comments by feedback id. */
    this._seenBySession = /* @__PURE__ */ new Map();
    /** Per session: thread ids we have already requested resolution for. */
    this._requestedBySession = /* @__PURE__ */ new Map();
    this._register(this._agentFeedbackService.onDidChangeFeedback((e) => this._onDidChangeFeedback(e)));
  }
  static {
    this.ID = "workbench.contrib.agentFeedbackPRThreadResolver";
  }
  _onDidChangeFeedback(e) {
    const key = e.sessionResource.toString();
    const previous = this._seenBySession.get(key) ?? /* @__PURE__ */ new Map();
    const next = /* @__PURE__ */ new Map();
    const threadsToResolve = /* @__PURE__ */ new Set();
    for (const item of e.feedbackItems) {
      if (item.kind !== AgentFeedbackKind.PRReview || !item.sourcePRReviewCommentId) {
        continue;
      }
      const threadId = item.sourcePRReviewCommentId;
      next.set(item.id, { state: item.state, threadId });
      const before = previous.get(item.id);
      if (item.state === AgentFeedbackState.Resolved && before && before.state !== AgentFeedbackState.Resolved) {
        threadsToResolve.add(threadId);
      }
    }
    for (const [id, before] of previous) {
      if (next.has(id)) {
        continue;
      }
      if (before.state === AgentFeedbackState.Submitted || before.state === AgentFeedbackState.Resolved) {
        threadsToResolve.add(before.threadId);
      }
    }
    this._seenBySession.set(key, next);
    if (threadsToResolve.size === 0) {
      return;
    }
    let requested = this._requestedBySession.get(key);
    if (!requested) {
      requested = /* @__PURE__ */ new Set();
      this._requestedBySession.set(key, requested);
    }
    for (const threadId of threadsToResolve) {
      if (requested.has(threadId)) {
        continue;
      }
      requested.add(threadId);
      this._resolveThread(e.sessionResource, threadId);
    }
  }
  _resolveThread(sessionResource, threadId) {
    this._codeReviewService.resolvePRReviewThread(sessionResource, threadId).catch((err) => this._logService.warn("[AgentFeedback] Failed to resolve PR review thread on GitHub", threadId, err));
  }
};
AgentFeedbackPRThreadResolverContribution = __decorateClass([
  __decorateParam(0, IAgentFeedbackService),
  __decorateParam(1, ICodeReviewService),
  __decorateParam(2, ILogService)
], AgentFeedbackPRThreadResolverContribution);
export {
  AgentFeedbackPRThreadResolverContribution
};
