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
import { createDecorator, IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { GitHubApiClient } from "./githubApiClient.js";
import { GitHubRepositoryModelReferenceCollection } from "./models/githubRepositoryModel.js";
import { GitHubPullRequestModelReferenceCollection } from "./models/githubPullRequestModel.js";
import { GitHubPullRequestReviewThreadsModelReferenceCollection } from "./models/githubPullRequestReviewThreadsModel.js";
import { GitHubPullRequestCIModelReferenceCollection } from "./models/githubPullRequestCIModel.js";
import { GitHubIssueModelReferenceCollection } from "./models/githubIssueModel.js";
import { GitHubChangesFetcher } from "./fetchers/githubChangesFetcher.js";
import { GitHubRecentUserWorkFetcher } from "./fetchers/githubRecentUserWorkFetcher.js";
import { getPullRequestKey } from "../common/utils.js";
import { derived, derivedOpts } from "../../../../base/common/observable.js";
import { structuralEquals } from "../../../../base/common/equals.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
const TRACE_PREFIX = "[PR-ICON-TRACE]";
const IGitHubService = createDecorator("sessionsGitHubService");
let GitHubService = class extends Disposable {
  constructor(instantiationService, sessionsService, _logService) {
    super();
    this._logService = _logService;
    /**
     * Cache of in-flight / resolved `findPullRequestNumberByHeadBranch`
     * lookups, keyed by `${owner}/${repo}#${branch}`. Promises are kept
     * indefinitely — PR-number assignment is monotonic for the lifetime of
     * a branch, and live PR state (open/closed/draft, CI) is refreshed via
     * `createPullRequestModelReference` once we know the number.
     */
    this._findPRByBranchCache = /* @__PURE__ */ new Map();
    const apiClient = this._register(instantiationService.createInstance(GitHubApiClient));
    this._apiClient = apiClient;
    this._changesFetcher = new GitHubChangesFetcher(apiClient);
    this._recentUserWorkFetcher = new GitHubRecentUserWorkFetcher(apiClient);
    this._repositoryReferences = instantiationService.createInstance(GitHubRepositoryModelReferenceCollection, apiClient);
    this._pullRequestReferences = instantiationService.createInstance(GitHubPullRequestModelReferenceCollection, apiClient);
    this._pullRequestReviewThreadsReferences = instantiationService.createInstance(GitHubPullRequestReviewThreadsModelReferenceCollection, apiClient);
    this._pullRequestCIReferences = instantiationService.createInstance(GitHubPullRequestCIModelReferenceCollection, apiClient);
    this._issueReferences = instantiationService.createInstance(GitHubIssueModelReferenceCollection, apiClient);
    const gitHubInfoObs = derivedOpts(
      { equalsFn: structuralEquals },
      (reader) => {
        const gitHubInfo = sessionsService.activeSession.read(reader)?.workspace.read(reader)?.folders[0]?.gitRepository?.gitHubInfo.read(reader);
        if (!gitHubInfo?.pullRequest) {
          return void 0;
        }
        return {
          owner: gitHubInfo.owner,
          repo: gitHubInfo.repo,
          pullRequestNumber: gitHubInfo.pullRequest.number
        };
      }
    );
    this.activeSessionPullRequestObs = derived((reader) => {
      const gitHubInfo = gitHubInfoObs.read(reader);
      if (!gitHubInfo) {
        return void 0;
      }
      const prModelRef = this.createPullRequestModelReference(gitHubInfo.owner, gitHubInfo.repo, gitHubInfo.pullRequestNumber);
      reader.store.add(prModelRef);
      return prModelRef.object;
    });
    const pullRequestInfoObs = derivedOpts(
      { equalsFn: structuralEquals },
      (reader) => {
        const pullRequest = this.activeSessionPullRequestObs.read(reader);
        const pullRequestDetails = pullRequest?.pullRequest.read(reader);
        if (!pullRequest || !pullRequestDetails) {
          return void 0;
        }
        return {
          owner: pullRequest.owner,
          repo: pullRequest.repo,
          prNumber: pullRequest.prNumber,
          headSha: pullRequestDetails.headSha
        };
      }
    );
    this.activeSessionPullRequestCIObs = derived((reader) => {
      const pullRequestInfo = pullRequestInfoObs.read(reader);
      if (!pullRequestInfo) {
        return void 0;
      }
      const prModelRef = this.createPullRequestCIModelReference(pullRequestInfo.owner, pullRequestInfo.repo, pullRequestInfo.prNumber, pullRequestInfo.headSha);
      reader.store.add(prModelRef);
      return prModelRef.object;
    });
    this.activeSessionPullRequestReviewThreadsObs = derived((reader) => {
      const gitHubInfo = gitHubInfoObs.read(reader);
      if (!gitHubInfo) {
        return void 0;
      }
      const reviewThreadsModelRef = this.createPullRequestReviewThreadsModelReference(gitHubInfo.owner, gitHubInfo.repo, gitHubInfo.pullRequestNumber);
      reader.store.add(reviewThreadsModelRef);
      return reviewThreadsModelRef.object;
    });
  }
  createRepositoryModelReference(owner, repo) {
    return this._repositoryReferences.acquire(`${owner}/${repo}`, owner, repo);
  }
  createPullRequestModelReference(owner, repo, prNumber) {
    return this._pullRequestReferences.acquire(getPullRequestKey(owner, repo, prNumber), owner, repo, prNumber);
  }
  createPullRequestReviewThreadsModelReference(owner, repo, prNumber) {
    return this._pullRequestReviewThreadsReferences.acquire(getPullRequestKey(owner, repo, prNumber), owner, repo, prNumber);
  }
  createPullRequestCIModelReference(owner, repo, prNumber, headSha) {
    return this._pullRequestCIReferences.acquire(`${getPullRequestKey(owner, repo, prNumber)}/${headSha}`, owner, repo, prNumber, headSha);
  }
  createIssueModelReference(owner, repo, issueNumber) {
    return this._issueReferences.acquire(`${owner}/${repo}/issues/${issueNumber}`, owner, repo, issueNumber);
  }
  getRecentAssignedIssues(owner, repo, token) {
    return this._recentUserWorkFetcher.getRecentAssignedIssues(owner, repo, token);
  }
  getRecentAuthoredPullRequests(owner, repo, token) {
    return this._recentUserWorkFetcher.getRecentAuthoredPullRequests(owner, repo, token);
  }
  getPullRequestReviewThreads(owner, repo, pullRequestNumber, token) {
    return this._recentUserWorkFetcher.getPullRequestReviewThreads(owner, repo, pullRequestNumber, token);
  }
  getIssuesWithLinkedPullRequests(owner, repo, issueNumbers, token) {
    return this._recentUserWorkFetcher.getIssuesWithLinkedPullRequests(owner, repo, issueNumbers, token);
  }
  getChangedFiles(owner, repo, base, head) {
    return this._changesFetcher.getChangedFiles(owner, repo, base, head);
  }
  findPullRequestNumberByHeadBranch(owner, repo, branch) {
    const key = `${owner}/${repo}#${branch}`;
    let promise = this._findPRByBranchCache.get(key);
    if (!promise) {
      this._logService.trace(`${TRACE_PREFIX} [GitHubService] findPullRequestNumberByHeadBranch cache MISS for ${key}; starting lookup`);
      promise = this._fetchPullRequestNumberByHeadBranch(owner, repo, branch);
      this._findPRByBranchCache.set(key, promise);
      promise.then(
        (value) => {
          if (typeof value !== "number") {
            this._logService.trace(`${TRACE_PREFIX} [GitHubService] findPullRequestNumberByHeadBranch for ${key} resolved with NO pr number; dropping cache entry so a later call retries`);
            this._findPRByBranchCache.delete(key);
          } else {
            this._logService.trace(`${TRACE_PREFIX} [GitHubService] findPullRequestNumberByHeadBranch for ${key} resolved PR #${value}; caching indefinitely`);
          }
        },
        (err) => {
          this._logService.trace(`${TRACE_PREFIX} [GitHubService] findPullRequestNumberByHeadBranch for ${key} FAILED; dropping cache entry.`, err);
          this._findPRByBranchCache.delete(key);
        }
      );
    } else {
      this._logService.trace(`${TRACE_PREFIX} [GitHubService] findPullRequestNumberByHeadBranch cache HIT for ${key}`);
    }
    return promise.catch(() => void 0);
  }
  async _fetchPullRequestNumberByHeadBranch(owner, repo, branch) {
    const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?head=${encodeURIComponent(`${owner}:${branch}`)}&state=all&sort=updated&direction=desc&per_page=1`;
    this._logService.trace(`${TRACE_PREFIX} [GitHubService] Fetching PR number for head ${owner}:${branch} via GET ${path}`);
    const response = await this._apiClient.request(
      "GET",
      path,
      "githubApi.findPullRequestByHeadBranch"
    );
    const first = response.data?.[0];
    this._logService.trace(`${TRACE_PREFIX} [GitHubService] PR number lookup for ${owner}:${branch} -> ${first ? `#${first.number}` : "no match"} (status ${response.statusCode}, ${response.data?.length ?? 0} result(s))`);
    return first ? first.number : void 0;
  }
};
GitHubService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, ISessionsService),
  __decorateParam(2, ILogService)
], GitHubService);
export {
  GitHubService,
  IGitHubService
};
