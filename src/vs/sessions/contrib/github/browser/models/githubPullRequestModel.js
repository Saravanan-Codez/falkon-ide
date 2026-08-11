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
import { Disposable, DisposableSet, ReferenceCollection, toDisposable } from "../../../../../base/common/lifecycle.js";
import { observableValue, transaction } from "../../../../../base/common/observable.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { computeMergeability, GitHubPRFetcher } from "../fetchers/githubPRFetcher.js";
const LOG_PREFIX = "[GitHubPullRequestModel]";
const TRACE_PREFIX = "[PR-ICON-TRACE]";
const DEFAULT_POLL_INTERVAL_MS = 6e4;
let GitHubPullRequestModelReferenceCollection = class extends ReferenceCollection {
  constructor(apiClient, _logService) {
    super();
    this._logService = _logService;
    this._fetcher = new GitHubPRFetcher(apiClient);
  }
  createReferencedObject(key, owner, repo, prNumber) {
    this._logService.trace(`${TRACE_PREFIX} [GitHubPullRequestModelReferenceCollection][createReferencedObject] Creating PR model for ${key}`);
    return new GitHubPullRequestModel(owner, repo, prNumber, this._fetcher, this._logService);
  }
  destroyReferencedObject(key, object) {
    this._logService.trace(`${TRACE_PREFIX} [GitHubPullRequestModelReferenceCollection][destroyReferencedObject] Disposing PR model for ${key}`);
    object.dispose();
  }
};
GitHubPullRequestModelReferenceCollection = __decorateClass([
  __decorateParam(1, ILogService)
], GitHubPullRequestModelReferenceCollection);
class GitHubPullRequestModel extends Disposable {
  constructor(owner, repo, prNumber, _fetcher, _logService) {
    super();
    this.owner = owner;
    this.repo = repo;
    this.prNumber = prNumber;
    this._fetcher = _fetcher;
    this._logService = _logService;
    this._pullRequestEtag = void 0;
    this._pullRequest = observableValue(this, void 0);
    this.pullRequest = this._pullRequest;
    this._reviewsEtag = void 0;
    this._reviews = observableValue(this, void 0);
    this.reviews = this._reviews;
    this._mergeability = observableValue(this, void 0);
    this.mergeability = this._mergeability;
    this._refreshPromise = void 0;
    this._pollingDisposables = this._register(new DisposableSet());
    this._pollScheduler = this._register(new RunOnceScheduler(() => this._poll(), DEFAULT_POLL_INTERVAL_MS));
  }
  /**
   * Refresh all PR data: pull request info, and mergeability.
   */
  refresh() {
    if (!this._refreshPromise) {
      this._refreshPromise = this._refresh().finally(() => {
        this._refreshPromise = void 0;
      });
    }
    return this._refreshPromise;
  }
  /**
   * Post a top-level issue comment on the PR.
   */
  async postIssueComment(body) {
    return this._fetcher.postIssueComment(this.owner, this.repo, this.prNumber, body);
  }
  /**
   * Start periodic polling. Each cycle refreshes all PR data.
   */
  startPolling(intervalMs = DEFAULT_POLL_INTERVAL_MS) {
    const disposable = toDisposable(() => {
      this._pollingDisposables.deleteAndDispose(disposable);
      if (this._pollingDisposables.size === 0) {
        this._pollScheduler.cancel();
      }
    });
    this._pollingDisposables.add(disposable);
    if (this._pollingDisposables.size === 1) {
      this._logService.trace(`${TRACE_PREFIX} [PRModel] Start polling ${this.owner}/${this.repo}#${this.prNumber} every ${intervalMs}ms`);
      this._pollScheduler.schedule(intervalMs);
    }
    return disposable;
  }
  async _poll() {
    this._logService.trace(`${TRACE_PREFIX} [PRModel] Poll cycle for ${this.owner}/${this.repo}#${this.prNumber}`);
    await this.refresh();
    if (!this._store.isDisposed && this._pollingDisposables.size > 0) {
      this._pollScheduler.schedule();
    }
  }
  async _refresh() {
    this._logService.trace(`${TRACE_PREFIX} [PRModel] Refreshing ${this.owner}/${this.repo}#${this.prNumber} (prEtag ${this._pullRequestEtag ?? "none"}, reviewsEtag ${this._reviewsEtag ?? "none"})`);
    try {
      const [pr, reviews] = await Promise.all([
        this._fetcher.getPullRequest(this.owner, this.repo, this.prNumber, this._pullRequestEtag),
        this._fetcher.getReviews(this.owner, this.repo, this.prNumber, this._reviewsEtag)
      ]);
      transaction((tx) => {
        if (pr.statusCode === 200 && pr.data) {
          this._pullRequestEtag = pr.etag;
          this._pullRequest.set(pr.data, tx);
        }
        if (reviews.statusCode === 200 && reviews.data) {
          this._reviewsEtag = reviews.etag;
          this._reviews.set(reviews.data, tx);
        }
        if (pr.statusCode === 200 || reviews.statusCode === 200) {
          const prData = pr.data ?? this._pullRequest.get();
          const reviewsData = reviews.data ?? this._reviews.get();
          if (prData && reviewsData) {
            const mergeability = computeMergeability(prData, reviewsData);
            this._mergeability.set(mergeability, tx);
          }
        }
      });
      const current = this._pullRequest.get();
      this._logService.trace(`${TRACE_PREFIX} [PRModel] Refreshed ${this.owner}/${this.repo}#${this.prNumber}: prStatus ${pr.statusCode}, reviewsStatus ${reviews.statusCode}, state ${current?.state ?? "unknown"}, isDraft ${current?.isDraft ?? "unknown"}, headSha ${current?.headSha ?? "unknown"}`);
    } catch (err) {
      this._logService.error(`${TRACE_PREFIX} ${LOG_PREFIX} Failed to refresh PR #${this.prNumber}:`, err);
    }
  }
  dispose() {
    super.dispose();
  }
}
export {
  GitHubPullRequestModel,
  GitHubPullRequestModelReferenceCollection
};
