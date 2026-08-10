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
import * as dom from "../../../../base/browser/dom.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { autorun, derived, observableSignalFromEvent, observableValue } from "../../../../base/common/observable.js";
import { localize } from "../../../../nls.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { SessionStatus } from "../../../services/sessions/common/session.js";
import { IGitHubService } from "../../github/browser/githubService.js";
import { GitHubCheckStatus } from "../../github/common/types.js";
import { FIX_CI_CHECKS_COMMAND_ID, getFailedChecks, REVEAL_CI_CHECKS_COMMAND_ID } from "../../changes/browser/checksActions.js";
import { AgentFeedbackKind, AgentFeedbackState, IAgentFeedbackService } from "../../agentFeedback/browser/agentFeedbackService.js";
import { SessionInputBannerWidget } from "./sessionInputBannerWidget.js";
const STORAGE_KEY_CI_DISMISSED = "sessions.inputBanners.ci.dismissed";
const STORAGE_KEY_COMMENTS_DISMISSED = "sessions.inputBanners.comments.dismissed";
const REVIEWABLE_KINDS = /* @__PURE__ */ new Set([AgentFeedbackKind.PRReview, AgentFeedbackKind.AgentReview]);
let SessionInputBanners = class extends Disposable {
  constructor(sessionsService, gitHubService, feedbackService, commandService, storageService, instantiationService, logService) {
    super();
    this.sessionsService = sessionsService;
    this.gitHubService = gitHubService;
    this.feedbackService = feedbackService;
    this.commandService = commandService;
    this.storageService = storageService;
    this.instantiationService = instantiationService;
    this.logService = logService;
    this._ciContent = this._register(new MutableDisposable());
    this._commentsContent = this._register(new MutableDisposable());
    this._active = observableValue(this, false);
    this._debugData = observableValue(this, void 0);
    this._ciDismissed = observableValue(this, /* @__PURE__ */ new Set());
    this._commentsDismissed = observableValue(this, /* @__PURE__ */ new Set());
    /**
     * The session whose banners should be shown, or undefined when inactive or
     * while the session/chat is still in progress. Banners only surface once the
     * session has completed so they don't distract from a running agent.
     */
    this._session = derived(this, (reader) => {
      if (!this._active.read(reader)) {
        return void 0;
      }
      const session = this.sessionsService.activeSession.read(reader);
      if (!session || session.status.read(reader) !== SessionStatus.Completed) {
        return void 0;
      }
      return session;
    });
    this._ciState = derived(this, (reader) => {
      const debugData = this._debugData.read(reader);
      if (debugData) {
        return debugData.ciFailed > 0 ? { sessionId: "debug", failed: debugData.ciFailed, completed: debugData.ciFailed, pending: debugData.ciPending, debug: true } : void 0;
      }
      const session = this._session.read(reader);
      if (!session || this._ciDismissed.read(reader).has(session.sessionId)) {
        return void 0;
      }
      const ciModel = this.gitHubService.activeSessionPullRequestCIObs.read(reader);
      if (!ciModel) {
        return void 0;
      }
      if (ciModel.fixRequested.read(reader)) {
        return void 0;
      }
      const checks = ciModel.checks.read(reader);
      const failed = getFailedChecks(checks).length;
      if (failed === 0) {
        return void 0;
      }
      const completed = checks.filter((check) => check.status === GitHubCheckStatus.Completed).length;
      const pending = checks.length - completed;
      return { sessionId: session.sessionId, failed, completed, pending };
    });
    this._commentsState = derived(this, (reader) => {
      const debugData = this._debugData.read(reader);
      if (debugData) {
        const count = debugData.prFeedback + debugData.agentFeedback;
        if (count === 0) {
          return void 0;
        }
        const kind2 = debugData.prFeedback > 0 && debugData.agentFeedback > 0 ? "mixed" : debugData.prFeedback > 0 ? "pr" : "agent";
        return { sessionId: "debug", sessionResource: URI.from({ scheme: "session-chat-pills-debug", path: "/feedback" }), count, kind: kind2, firstCommentId: "debug", debug: true };
      }
      const session = this._session.read(reader);
      if (!session || this._commentsDismissed.read(reader).has(session.sessionId)) {
        return void 0;
      }
      this._feedbackChanged.read(reader);
      const created = this.feedbackService.getFeedback(session.resource).filter((item) => item.state === AgentFeedbackState.Created && REVIEWABLE_KINDS.has(item.kind));
      if (created.length === 0) {
        return void 0;
      }
      const allPR = created.every((item) => item.kind === AgentFeedbackKind.PRReview);
      const allAgent = created.every((item) => item.kind === AgentFeedbackKind.AgentReview);
      const kind = allPR ? "pr" : allAgent ? "agent" : "mixed";
      return { sessionId: session.sessionId, sessionResource: session.resource, count: created.length, kind, firstCommentId: created[0].id };
    });
    this.domNode = dom.$(".session-input-banners");
    this._ciSlot = dom.append(this.domNode, dom.$(".session-input-banner-slot"));
    this._commentsSlot = dom.append(this.domNode, dom.$(".session-input-banner-slot"));
    this._feedbackChanged = observableSignalFromEvent(this, this.feedbackService.onDidChangeFeedback);
    this._ciDismissed.set(this._readDismissed(STORAGE_KEY_CI_DISMISSED), void 0);
    this._commentsDismissed.set(this._readDismissed(STORAGE_KEY_COMMENTS_DISMISSED), void 0);
    this._register(this.storageService.onDidChangeValue(StorageScope.PROFILE, STORAGE_KEY_CI_DISMISSED, this._store)(() => {
      this._ciDismissed.set(this._readDismissed(STORAGE_KEY_CI_DISMISSED), void 0);
    }));
    this._register(this.storageService.onDidChangeValue(StorageScope.PROFILE, STORAGE_KEY_COMMENTS_DISMISSED, this._store)(() => {
      this._commentsDismissed.set(this._readDismissed(STORAGE_KEY_COMMENTS_DISMISSED), void 0);
    }));
    this._register(autorun((reader) => this._renderCIBanner(this._ciState.read(reader))));
    this._register(autorun((reader) => this._renderCommentsBanner(this._commentsState.read(reader))));
  }
  /** Marks whether the owning chat view is the active session. */
  setActive(active) {
    this._active.set(active, void 0);
  }
  setDebugData(data) {
    this._debugData.set(data, void 0);
  }
  _renderCIBanner(state) {
    const store = this._ciContent.value = new DisposableStore();
    dom.clearNode(this._ciSlot);
    if (!state) {
      return;
    }
    const failedText = state.completed === 1 ? localize("ci.oneCheckFailed", "1 check failed") : localize("ci.checksFailed", "{0} out of {1} checks failed", state.failed, state.completed);
    const text = state.pending > 0 ? localize("ci.checksFailedPending", "{0}, {1} pending", failedText, state.pending) : failedText;
    this._renderBanner(this._ciSlot, store, {
      icon: Codicon.warning,
      accent: true,
      text,
      ariaLabel: text,
      dismissTooltip: localize("ci.dismiss", "Hide for this session"),
      actions: [
        {
          label: localize("ci.fixChecks", "Fix Checks"),
          primary: true,
          run: () => state.debug ? void 0 : this._executeCommand(FIX_CI_CHECKS_COMMAND_ID)
        },
        {
          label: localize("ci.revealChecks", "Reveal"),
          run: () => {
            if (!state.debug) {
              void this._executeCommand(REVEAL_CI_CHECKS_COMMAND_ID);
            }
          }
        }
      ],
      dismiss: () => {
        if (!state.debug) {
          this._dismiss(STORAGE_KEY_CI_DISMISSED, this._ciDismissed, state.sessionId);
        }
      }
    });
  }
  _renderCommentsBanner(state) {
    const store = this._commentsContent.value = new DisposableStore();
    dom.clearNode(this._commentsSlot);
    if (!state) {
      return;
    }
    const text = this._commentsBannerText(state.kind, state.count);
    this._renderBanner(this._commentsSlot, store, {
      icon: Codicon.commentDiscussion,
      accent: false,
      text,
      ariaLabel: text,
      dismissTooltip: localize("comments.dismiss", "Hide for this session"),
      actions: [
        {
          label: localize("comments.address", "Address Comments"),
          primary: true,
          run: () => state.debug ? void 0 : this._addressComments(state.sessionResource).catch((err) => this.logService.error("[SessionInputBanners] Failed to address comments", err))
        },
        {
          label: localize("comments.reveal", "Reveal"),
          run: () => {
            if (!state.debug) {
              this._revealComment(state.sessionResource, state.firstCommentId);
            }
          }
        }
      ],
      dismiss: () => {
        if (!state.debug) {
          this._dismiss(STORAGE_KEY_COMMENTS_DISMISSED, this._commentsDismissed, state.sessionId);
        }
      }
    });
  }
  _renderBanner(container, store, banner) {
    const widget = store.add(this.instantiationService.createInstance(SessionInputBannerWidget, banner));
    container.appendChild(widget.domNode);
  }
  _commentsBannerText(kind, count) {
    switch (kind) {
      case "pr":
        return count === 1 ? localize("comments.pr.one", "1 PR comment") : localize("comments.pr.many", "{0} PR comments", count);
      case "agent":
        return count === 1 ? localize("comments.agent.one", "1 agent comment") : localize("comments.agent.many", "{0} agent comments", count);
      case "mixed":
        return count === 1 ? localize("comments.one", "1 comment") : localize("comments.many", "{0} comments", count);
    }
  }
  async _executeCommand(commandId) {
    try {
      await this.commandService.executeCommand(commandId);
    } catch (err) {
      this.logService.error("[SessionInputBanners] command failed", commandId, err);
    }
  }
  async _addressComments(sessionResource) {
    const created = this.feedbackService.getFeedback(sessionResource).filter((item) => item.state === AgentFeedbackState.Created && REVIEWABLE_KINDS.has(item.kind));
    for (const item of created) {
      this.feedbackService.acceptFeedback(sessionResource, item.id);
    }
    const submitted = await this.feedbackService.submitFeedback(sessionResource);
    if (!submitted) {
      this.logService.error("[SessionInputBanners] Failed to submit feedback for session", sessionResource.toString());
    }
  }
  _revealComment(sessionResource, commentId) {
    this.feedbackService.revealFeedback(sessionResource, commentId).catch((err) => this.logService.error("[SessionInputBanners] Failed to reveal comment", err));
  }
  _dismiss(storageKey, observable, sessionId) {
    const next = new Set(observable.get());
    next.add(sessionId);
    this.storageService.store(storageKey, JSON.stringify([...next]), StorageScope.PROFILE, StorageTarget.USER);
    observable.set(next, void 0);
  }
  _readDismissed(storageKey) {
    const raw = this.storageService.get(storageKey, StorageScope.PROFILE);
    if (!raw) {
      return /* @__PURE__ */ new Set();
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? new Set(parsed.filter((id) => typeof id === "string")) : /* @__PURE__ */ new Set();
    } catch {
      return /* @__PURE__ */ new Set();
    }
  }
};
SessionInputBanners = __decorateClass([
  __decorateParam(0, ISessionsService),
  __decorateParam(1, IGitHubService),
  __decorateParam(2, IAgentFeedbackService),
  __decorateParam(3, ICommandService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, ILogService)
], SessionInputBanners);
export {
  SessionInputBanners
};
