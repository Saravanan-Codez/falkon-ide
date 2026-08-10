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
import { autorun, derivedOpts, observableValue } from "../../../../base/common/observable.js";
import { isEqual } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { Range } from "../../../../editor/common/core/range.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IGitHubService } from "../../github/browser/githubService.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
var PRReviewStateKind = /* @__PURE__ */ ((PRReviewStateKind2) => {
  PRReviewStateKind2["None"] = "none";
  PRReviewStateKind2["Loading"] = "loading";
  PRReviewStateKind2["Loaded"] = "loaded";
  PRReviewStateKind2["Error"] = "error";
  return PRReviewStateKind2;
})(PRReviewStateKind || {});
const ICodeReviewService = createDecorator("codeReviewService");
let CodeReviewService = class extends Disposable {
  constructor(_logService, _gitHubService, _sessionsManagementService, _sessionsService) {
    super();
    this._logService = _logService;
    this._gitHubService = _gitHubService;
    this._sessionsManagementService = _sessionsManagementService;
    this._sessionsService = _sessionsService;
    this._prReviewBySession = /* @__PURE__ */ new Map();
    /**
     * PR review comment IDs that have been locally handled — converted to agent
     * feedback or dismissed from the `viewUnreviewedComments` confirmation — and
     * are therefore hidden from the PR review state (per session).
     */
    this._convertedPRCommentsBySession = /* @__PURE__ */ new Map();
    this._registerSessionListeners();
    const activeSessionResourceObs = derivedOpts({ equalsFn: isEqual }, (reader) => {
      return this._sessionsService.activeSession.read(reader)?.resource;
    });
    this._register(autorun((reader) => {
      const activeSessionResource = activeSessionResourceObs.read(reader);
      if (!activeSessionResource) {
        return;
      }
      const reviewThreadsModel = this._gitHubService.activeSessionPullRequestReviewThreadsObs.read(reader);
      if (!reviewThreadsModel) {
        return;
      }
      const data = this._getOrCreatePRReviewData(activeSessionResource);
      if (data.state.read(void 0).kind === "none" /* None */) {
        data.state.set({ kind: "loading" /* Loading */ }, void 0);
      }
      const session = this._sessionsManagementService.getSession(activeSessionResource);
      const workspace = session?.workspace.read(void 0);
      reader.store.add(autorun((innerReader) => {
        const threads = reviewThreadsModel.reviewThreads.read(innerReader);
        const converted = this._convertedPRCommentsBySession.get(activeSessionResource.toString());
        const comments = [];
        for (const thread of threads) {
          if (thread.isResolved) {
            continue;
          }
          const threadId = String(thread.id);
          if (converted?.has(threadId)) {
            continue;
          }
          const baseUri = workspace?.folders[0]?.workingDirectory;
          if (!baseUri) {
            continue;
          }
          const fileUri = URI.joinPath(baseUri, thread.path);
          const line = thread.line ?? 1;
          const firstComment = thread.comments[0];
          comments.push({
            id: String(thread.id),
            uri: fileUri,
            range: new Range(line, 1, line, 1),
            body: firstComment?.body ?? "",
            author: firstComment?.author.login ?? ""
          });
        }
        data.state.set({ kind: "loaded" /* Loaded */, comments }, void 0);
      }));
    }));
  }
  _registerSessionListeners() {
    this._register(this._sessionsManagementService.onDidChangeSessions((e) => {
      for (const session of [...e.removed, ...e.changed.filter((s) => s.isArchived.get())]) {
        this._disposePRReview(session.resource);
      }
    }));
  }
  getPRReviewState(sessionResource) {
    return this._getOrCreatePRReviewData(sessionResource).state;
  }
  async resolvePRReviewThread(sessionResource, threadId) {
    const session = this._sessionsManagementService.getSession(sessionResource);
    const gitHubInfo = session?.workspace.get()?.folders[0]?.gitRepository?.gitHubInfo.get();
    if (gitHubInfo?.pullRequest) {
      const modelRef = this._gitHubService.createPullRequestReviewThreadsModelReference(gitHubInfo.owner, gitHubInfo.repo, gitHubInfo.pullRequest.number);
      try {
        await modelRef.object.resolveThread(threadId);
      } catch (err) {
        this._logService.warn("[CodeReviewService] Failed to resolve PR thread on GitHub:", err);
      } finally {
        modelRef.dispose();
      }
    }
    const data = this._prReviewBySession.get(sessionResource.toString());
    if (data) {
      const currentState = data.state.get();
      if (currentState.kind === "loaded" /* Loaded */) {
        const filtered = currentState.comments.filter((c) => c.id !== threadId);
        data.state.set({ kind: "loaded" /* Loaded */, comments: filtered }, void 0);
      }
    }
  }
  markPRReviewCommentConverted(sessionResource, commentId) {
    this._suppressPRReviewComment(sessionResource, commentId);
  }
  dismissPRReviewComment(sessionResource, commentId) {
    this._suppressPRReviewComment(sessionResource, commentId);
  }
  /**
   * Hide a PR review comment from the session's review state and remember it
   * so the projection autorun keeps filtering it. Shared by
   * {@link markPRReviewCommentConverted} and {@link dismissPRReviewComment}.
   */
  _suppressPRReviewComment(sessionResource, commentId) {
    const key = sessionResource.toString();
    let converted = this._convertedPRCommentsBySession.get(key);
    if (!converted) {
      converted = /* @__PURE__ */ new Set();
      this._convertedPRCommentsBySession.set(key, converted);
    }
    converted.add(commentId);
    const data = this._prReviewBySession.get(key);
    if (data) {
      const currentState = data.state.get();
      if (currentState.kind === "loaded" /* Loaded */) {
        const filtered = currentState.comments.filter((c) => c.id !== commentId);
        data.state.set({ kind: "loaded" /* Loaded */, comments: filtered }, void 0);
      }
    }
  }
  _getOrCreatePRReviewData(sessionResource) {
    const key = sessionResource.toString();
    let data = this._prReviewBySession.get(key);
    if (!data) {
      data = {
        state: observableValue(`prReview.state.${key}`, { kind: "none" /* None */ })
      };
      this._prReviewBySession.set(key, data);
    }
    return data;
  }
  _disposePRReview(sessionResource) {
    const key = sessionResource.toString();
    this._convertedPRCommentsBySession.delete(key);
    this._prReviewBySession.delete(key);
  }
  dispose() {
    this._prReviewBySession.clear();
    super.dispose();
  }
};
CodeReviewService = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, IGitHubService),
  __decorateParam(2, ISessionsManagementService),
  __decorateParam(3, ISessionsService)
], CodeReviewService);
export {
  CodeReviewService,
  ICodeReviewService,
  PRReviewStateKind
};
