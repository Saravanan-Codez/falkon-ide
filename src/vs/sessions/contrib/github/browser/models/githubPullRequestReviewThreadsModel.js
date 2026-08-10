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
import { Disposable, ReferenceCollection, toDisposable } from "../../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../../base/common/observable.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { GitHubPRFetcher } from "../fetchers/githubPRFetcher.js";
const LOG_PREFIX = "[GitHubPullRequestReviewThreadsModel]";
const TRACE_PREFIX = "[PR-ICON-TRACE]";
const DEFAULT_POLL_INTERVAL_MS = 6e4;
let GitHubPullRequestReviewThreadsModelReferenceCollection = class extends ReferenceCollection {
  constructor(apiClient, _logService) {
    super();
    this._logService = _logService;
    this._fetcher = new GitHubPRFetcher(apiClient);
  }
  createReferencedObject(key, owner, repo, prNumber) {
    this._logService.trace(`${TRACE_PREFIX} [GitHubPullRequestReviewThreadsModelReferenceCollection][createReferencedObject] Creating PR review threads model for ${key}`);
    return new GitHubPullRequestReviewThreadsModel(owner, repo, prNumber, this._fetcher, this._logService);
  }
  destroyReferencedObject(key, object) {
    this._logService.trace(`${TRACE_PREFIX} [GitHubPullRequestReviewThreadsModelReferenceCollection][destroyReferencedObject] Disposing PR review threads model for ${key}`);
    object.dispose();
  }
};
GitHubPullRequestReviewThreadsModelReferenceCollection = __decorateClass([
  __decorateParam(1, ILogService)
], GitHubPullRequestReviewThreadsModelReferenceCollection);
class GitHubPullRequestReviewThreadsModel extends Disposable {
  constructor(owner, repo, prNumber, _fetcher, _logService) {
    super();
    this.owner = owner;
    this.repo = repo;
    this.prNumber = prNumber;
    this._fetcher = _fetcher;
    this._logService = _logService;
    this._reviewThreads = observableValue(this, []);
    this.reviewThreads = this._reviewThreads;
    this._refreshPromise = void 0;
    this._pollingClientCount = 0;
    this._pollScheduler = this._register(new RunOnceScheduler(() => this._poll(), DEFAULT_POLL_INTERVAL_MS));
  }
  /**
   * Refresh review thread data.
   */
  refresh(force = false) {
    if (force && this._refreshPromise) {
      return this._refreshPromise.then(() => this.refresh(true));
    }
    if (force) {
      return this._refresh();
    }
    if (!this._refreshPromise) {
      this._refreshPromise = this._refresh().finally(() => {
        this._refreshPromise = void 0;
      });
    }
    return this._refreshPromise;
  }
  async _refresh() {
    this._logService.trace(`${TRACE_PREFIX} [ReviewThreadsModel] Refreshing review threads for ${this.owner}/${this.repo}#${this.prNumber}`);
    try {
      const data = await this._fetcher.getReviewThreads(this.owner, this.repo, this.prNumber);
      this._reviewThreads.set(data, void 0);
      const unresolved = data.filter((thread) => !thread.isResolved).length;
      this._logService.trace(`${TRACE_PREFIX} [ReviewThreadsModel] Refreshed review threads for ${this.owner}/${this.repo}#${this.prNumber}: ${data.length} thread(s), ${unresolved} unresolved`);
    } catch (err) {
      this._logService.error(`${TRACE_PREFIX} ${LOG_PREFIX} Failed to refresh threads for PR #${this.prNumber}:`, err);
    }
  }
  /**
   * Post a reply to an existing review thread and refresh threads.
   */
  async postReviewComment(body, inReplyTo) {
    const comment = await this._fetcher.postReviewComment(this.owner, this.repo, this.prNumber, body, inReplyTo);
    await this.refresh(true);
    return comment;
  }
  /**
   * Resolve a review thread and refresh the thread list.
   */
  async resolveThread(threadId) {
    await this._fetcher.resolveThread(this.owner, this.repo, threadId);
    await this.refresh(true);
  }
  /**
   * Start periodic polling. Each cycle refreshes review thread data.
   */
  startPolling(intervalMs = DEFAULT_POLL_INTERVAL_MS) {
    if (this._pollingClientCount++ === 0) {
      this._logService.trace(`${TRACE_PREFIX} [ReviewThreadsModel] Start polling ${this.owner}/${this.repo}#${this.prNumber} every ${intervalMs}ms`);
      this._pollScheduler.schedule(intervalMs);
    }
    return toDisposable(() => {
      if (this._store.isDisposed) {
        return;
      }
      if (--this._pollingClientCount === 0) {
        this._pollScheduler.cancel();
      }
    });
  }
  async _poll() {
    this._logService.trace(`${TRACE_PREFIX} [ReviewThreadsModel] Poll cycle for ${this.owner}/${this.repo}#${this.prNumber}`);
    await this.refresh();
    if (!this._store.isDisposed && this._pollingClientCount > 0) {
      this._pollScheduler.schedule();
    }
  }
  dispose() {
    super.dispose();
  }
}
export {
  GitHubPullRequestReviewThreadsModel,
  GitHubPullRequestReviewThreadsModelReferenceCollection
};
