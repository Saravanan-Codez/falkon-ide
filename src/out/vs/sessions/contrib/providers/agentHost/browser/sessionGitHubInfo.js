import { structuralEquals } from "../../../../../base/common/equals.js";
import { derived, derivedOpts, observableFromPromise } from "../../../../../base/common/observable.js";
import { URI } from "../../../../../base/common/uri.js";
import { readSessionGitState } from "../../../../../platform/agentHost/common/state/sessionState.js";
import { computePullRequestIcon } from "../../../github/common/types.js";
import { computePullRequestIconStatus } from "../../../github/browser/pullRequestIconStatus.js";
const TRACE_PREFIX = "[PR-ICON-TRACE]";
class SessionGitHubInfoResolver {
  constructor(meta, _sessionId, _gitHubService, _logService) {
    this._sessionId = _sessionId;
    this._gitHubService = _gitHubService;
    this._logService = _logService;
    /**
     * Per-coords cache of promise-backed PR-number observables.
     * {@link observableFromPromise} starts unresolved (`value === undefined`) and
     * only settles on a later microtask, so creating a fresh one on every recompute
     * would make the PR number — and therefore `gitHubInfo.pullRequest` — flap back
     * to `undefined`. Reusing the cached observable keeps a resolved PR number
     * sticky; a "no PR yet" lookup is evicted so a PR created later is still picked up.
     */
    this._pullRequestNumberCache = /* @__PURE__ */ new Map();
    this._coords = derivedOpts(
      { owner: this, equalsFn: structuralEquals },
      (reader) => {
        const git = readSessionGitState(meta.read(reader));
        if (git?.githubOwner && git?.githubRepo && git?.branchName) {
          return { owner: git.githubOwner, repo: git.githubRepo, branch: git.branchName };
        }
        return void 0;
      }
    );
    this._pullRequestNumber = derived(this, (reader) => {
      const coords = this._coords.read(reader);
      if (!coords || !this._gitHubService) {
        return void 0;
      }
      return this._pullRequestNumberFor(coords, this._gitHubService);
    });
    this.gitHubInfo = derived(this, (reader) => this._computeGitHubInfo(reader));
  }
  /**
   * Get — or create and cache — the sticky promise-backed PR-number observable for
   * `coords`. See {@link _pullRequestNumberCache} for why the observable is reused.
   */
  _pullRequestNumberFor(coords, gitHubService) {
    const key = `${coords.owner}/${coords.repo}@${coords.branch}`;
    const cached = this._pullRequestNumberCache.get(key);
    if (cached) {
      this._logService.trace(`${TRACE_PREFIX} [IconAdapter] Session ${this._sessionId} reusing sticky PR-number observable for ${key} (current value ${cached.get().value ?? "unresolved"})`);
      return cached;
    }
    this._logService.trace(`${TRACE_PREFIX} [IconAdapter] Session ${this._sessionId} no cached PR-number observable for ${key}; starting lookup`);
    const lookup = gitHubService.findPullRequestNumberByHeadBranch(coords.owner, coords.repo, coords.branch);
    const prNumberObs = observableFromPromise(lookup);
    this._pullRequestNumberCache.set(key, prNumberObs);
    lookup.then((prNumber) => {
      if (prNumber === void 0) {
        const evicted = this._pullRequestNumberCache.get(key) === prNumberObs;
        if (evicted) {
          this._pullRequestNumberCache.delete(key);
        }
        this._logService.trace(`${TRACE_PREFIX} [IconAdapter] Session ${this._sessionId} PR-number lookup for ${key} resolved with no PR${evicted ? "; evicted cache entry so a later recompute retries" : " (cache entry already replaced)"}`);
      } else {
        this._logService.trace(`${TRACE_PREFIX} [IconAdapter] Session ${this._sessionId} PR-number lookup for ${key} resolved PR #${prNumber}; kept sticky`);
      }
    });
    return prNumberObs;
  }
  _computeGitHubInfo(reader) {
    const coords = this._coords.read(reader);
    if (!coords) {
      this._logService.trace(`${TRACE_PREFIX} [IconAdapter] Session ${this._sessionId} has no GitHub coords (missing owner/repo/branch in git state); no PR icon`);
      return void 0;
    }
    const coordsLabel = `${coords.owner}/${coords.repo}@${coords.branch}`;
    const pullRequestNumberObs = this._pullRequestNumber.read(reader);
    if (!pullRequestNumberObs) {
      this._logService.trace(`${TRACE_PREFIX} [IconAdapter] Session ${this._sessionId} coords ${coordsLabel}: no GitHub service available; emitting gitHubInfo without pullRequest`);
      return { owner: coords.owner, repo: coords.repo };
    }
    const resolved = pullRequestNumberObs.read(reader);
    const prNumber = resolved.value;
    if (prNumber === void 0) {
      const reason = Object.hasOwn(resolved, "value") ? "no pull request targets this branch" : "PR number lookup still pending";
      this._logService.trace(`${TRACE_PREFIX} [IconAdapter] Session ${this._sessionId} coords ${coordsLabel}: ${reason}; emitting gitHubInfo without pullRequest`);
      return { owner: coords.owner, repo: coords.repo };
    }
    const uri = URI.parse(`https://github.com/${coords.owner}/${coords.repo}/pull/${prNumber}`);
    const icon = this._computePullRequestIcon(reader, coords, prNumber);
    return {
      owner: coords.owner,
      repo: coords.repo,
      pullRequest: { number: prNumber, uri, icon }
    };
  }
  /**
   * Compute the PR status icon from the live, shared pull-request model. For open,
   * non-draft pull requests the icon is refined by CI check status (failing checks)
   * and unresolved review threads. Returns `undefined` until the live model has been
   * refreshed (or when no GitHub service is available), so the caller can keep the
   * pull request without an icon while the first fetch is in flight.
   */
  _computePullRequestIcon(reader, coords, prNumber) {
    const gitHubService = this._gitHubService;
    if (!gitHubService) {
      this._logService.trace(`${TRACE_PREFIX} [IconAdapter] Session ${this._sessionId} PR ${coords.owner}/${coords.repo}#${prNumber}: no GitHub service available; icon undefined`);
      return void 0;
    }
    const prRef = reader.store.add(gitHubService.createPullRequestModelReference(coords.owner, coords.repo, prNumber));
    const livePR = prRef.object.pullRequest.read(reader);
    if (!livePR) {
      this._logService.trace(`${TRACE_PREFIX} [IconAdapter] Session ${this._sessionId} PR ${coords.owner}/${coords.repo}#${prNumber}: livePR not loaded yet; icon undefined (waiting for PR model refresh)`);
      return void 0;
    }
    const status = computePullRequestIconStatus(reader, gitHubService, coords.owner, coords.repo, livePR);
    const icon = computePullRequestIcon(livePR.isDraft ? "draft" : livePR.state, status);
    this._logService.trace(`${TRACE_PREFIX} [IconAdapter] Session ${this._sessionId} PR ${coords.owner}/${coords.repo}#${prNumber}: livePR present (state ${livePR.state}, isDraft ${livePR.isDraft}, headSha ${livePR.headSha}), hasFailingChecks ${!!status.hasFailingChecks}, hasUnresolvedComments ${!!status.hasUnresolvedComments} -> icon ${icon?.id ?? "none"}`);
    return icon;
  }
}
export {
  SessionGitHubInfoResolver
};
