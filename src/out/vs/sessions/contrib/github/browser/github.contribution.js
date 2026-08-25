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
import { Disposable, DisposableMap } from "../../../../base/common/lifecycle.js";
import { autorun, derived, derivedOpts } from "../../../../base/common/observable.js";
import { structuralEquals } from "../../../../base/common/equals.js";
import { isEqual } from "../../../../base/common/resources.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../workbench/common/contributions.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { GitHubPullRequestState } from "../common/types.js";
import { GitHubService, IGitHubService } from "./githubService.js";
import { IPullRequestIconCache, PullRequestIconCache } from "./pullRequestIconCache.js";
import "./pullRequestActions.js";
import "./issueActions.js";
const TRACE_PREFIX = "[PR-ICON-TRACE]";
let GitHubPullRequestPollingContribution = class extends Disposable {
  constructor(_gitHubService, _sessionsManagementService, _sessionsService, _logService) {
    super();
    this._gitHubService = _gitHubService;
    this._sessionsManagementService = _sessionsManagementService;
    this._sessionsService = _sessionsService;
    this._logService = _logService;
    /** Per-session pollers, keyed by `session.sessionId`. */
    this._sessionTrackers = this._register(new DisposableMap());
    const activeSessionResourceObs = derivedOpts({ equalsFn: isEqual }, (reader) => {
      const activeSession = this._sessionsService.activeSession.read(reader);
      if (!activeSession || !activeSession.resource || activeSession.isArchived.read(reader)) {
        return void 0;
      }
      return activeSession.resource;
    });
    this._register(autorun((reader) => {
      const activeSessionResource = activeSessionResourceObs.read(reader);
      if (!activeSessionResource) {
        return;
      }
      const model = this._gitHubService.activeSessionPullRequestObs.read(reader);
      model?.refresh();
    }));
    this._register(autorun((reader) => {
      const activeSessionResource = activeSessionResourceObs.read(reader);
      if (!activeSessionResource) {
        return;
      }
      const model = this._gitHubService.activeSessionPullRequestCIObs.read(reader);
      if (!model) {
        return;
      }
      model.refresh();
      reader.store.add(model.startPolling());
    }));
    this._register(autorun((reader) => {
      const activeSessionResource = activeSessionResourceObs.read(reader);
      if (!activeSessionResource) {
        return;
      }
      const model = this._gitHubService.activeSessionPullRequestReviewThreadsObs.read(reader);
      if (!model) {
        return;
      }
      model.refresh();
      reader.store.add(model.startPolling());
    }));
    this._sessionsManagementService.onDidChangeSessions(this._onDidChangeSessions, this, this._store);
    this._onDidChangeSessions({ added: this._sessionsManagementService.getSessions(), removed: [], changed: [] });
  }
  static {
    this.ID = "sessions.contrib.githubPullRequestPolling";
  }
  _onDidChangeSessions(e) {
    for (const session of e.added) {
      this._trackSession(session);
    }
    for (const session of e.changed) {
      this._trackSession(session);
    }
    for (const session of e.removed) {
      if (this._sessionTrackers.has(session.sessionId)) {
        this._logService.trace(`${TRACE_PREFIX} [PollingContribution] Session ${session.sessionId} removed; disposing its poller (PR model no longer kept warm)`);
        this._sessionTrackers.deleteAndDispose(session.sessionId);
      }
    }
    this._logService.trace(`${TRACE_PREFIX} [PollingContribution] onDidChangeSessions (added ${e.added.length}, changed ${e.changed.length}, removed ${e.removed.length}); now tracking ${this._sessionTrackers.size} session poller(s)`);
  }
  _trackSession(session) {
    if (this._sessionTrackers.has(session.sessionId)) {
      return;
    }
    this._logService.trace(`${TRACE_PREFIX} [PollingContribution] Session ${session.sessionId} now tracked; poller will keep its PR model warm once a PR number resolves`);
    this._sessionTrackers.set(session.sessionId, this._createSessionPoller(session));
  }
  /**
   * Reactively poll the pull request for a single session.
   *
   * Unlike a one-shot snapshot, the returned autorun re-runs when the session's
   * pull-request identity changes — so polling starts once a provider resolves
   * the PR number asynchronously (e.g. the agent host), and stops when the
   * session is archived or the PR goes away. A merged pull request can never
   * change again, so it stops polling unless it is the active session.
   */
  _createSessionPoller(session) {
    const pullRequestIdentityObs = derivedOpts(
      { owner: this, equalsFn: structuralEquals },
      (reader) => {
        if (session.isArchived.read(reader)) {
          return { kind: "archived" };
        }
        const workspace = session.workspace.read(reader);
        if (!workspace) {
          return { kind: "no-workspace" };
        }
        const gitRepository = workspace.folders[0]?.gitRepository;
        if (!gitRepository) {
          return { kind: "no-git-repository" };
        }
        const gitHubInfo = gitRepository.gitHubInfo.read(reader);
        if (!gitHubInfo?.pullRequest) {
          return { kind: "no-pull-request" };
        }
        return { kind: "ok", owner: gitHubInfo.owner, repo: gitHubInfo.repo, prNumber: gitHubInfo.pullRequest.number };
      }
    );
    return autorun((reader) => {
      const identity = pullRequestIdentityObs.read(reader);
      if (identity.kind !== "ok") {
        this._logService.trace(`${TRACE_PREFIX} [PollingContribution] Session ${session.sessionId} has no PR identity yet (reason: ${identity.kind}); NOT keeping a PR model warm. Will re-run reactively if this input changes.`);
        return;
      }
      const { owner, repo, prNumber } = identity;
      this._logService.trace(`${TRACE_PREFIX} [PollingContribution] Session ${session.sessionId} resolved PR identity ${owner}/${repo}#${prNumber}; acquiring model and refreshing`);
      const modelRef = reader.store.add(this._gitHubService.createPullRequestModelReference(owner, repo, prNumber));
      const model = modelRef.object;
      model.refresh();
      const shouldPollObs = derived(this, (pollReader) => {
        const prDetails = model.pullRequest.read(pollReader);
        const isMerged = prDetails?.state === GitHubPullRequestState.Merged;
        return !isMerged || this._isActiveSession(session, pollReader);
      });
      reader.store.add(autorun((pollReader) => {
        if (!shouldPollObs.read(pollReader)) {
          this._logService.trace(`${TRACE_PREFIX} [PollingContribution] Session ${session.sessionId} PR ${owner}/${repo}#${prNumber} is merged and not active; not polling`);
          return;
        }
        this._logService.trace(`${TRACE_PREFIX} [PollingContribution] Session ${session.sessionId} starting PR polling for ${owner}/${repo}#${prNumber}`);
        pollReader.store.add(model.startPolling());
      }));
      reader.store.add(autorun((statusReader) => {
        const prDetails = model.pullRequest.read(statusReader);
        if (!prDetails || prDetails.isDraft || prDetails.state !== GitHubPullRequestState.Open) {
          return;
        }
        this._logService.trace(`${TRACE_PREFIX} [PollingContribution] Session ${session.sessionId} starting CI + review-thread polling for ${owner}/${repo}#${prNumber}@${prDetails.headSha}`);
        const ciModelRef = statusReader.store.add(this._gitHubService.createPullRequestCIModelReference(owner, repo, prNumber, prDetails.headSha));
        ciModelRef.object.refresh();
        statusReader.store.add(ciModelRef.object.startPolling());
        const reviewThreadsModelRef = statusReader.store.add(this._gitHubService.createPullRequestReviewThreadsModelReference(owner, repo, prNumber));
        reviewThreadsModelRef.object.refresh();
        statusReader.store.add(reviewThreadsModelRef.object.startPolling());
      }));
    });
  }
  _isActiveSession(session, reader) {
    const activeSession = this._sessionsService.activeSession.read(reader);
    if (!activeSession || activeSession.isArchived.read(reader)) {
      return false;
    }
    return isEqual(activeSession.resource, session.resource);
  }
};
GitHubPullRequestPollingContribution = __decorateClass([
  __decorateParam(0, IGitHubService),
  __decorateParam(1, ISessionsManagementService),
  __decorateParam(2, ISessionsService),
  __decorateParam(3, ILogService)
], GitHubPullRequestPollingContribution);
registerWorkbenchContribution2(GitHubPullRequestPollingContribution.ID, GitHubPullRequestPollingContribution, WorkbenchPhase.AfterRestored);
registerSingleton(IGitHubService, GitHubService, InstantiationType.Delayed);
registerSingleton(IPullRequestIconCache, PullRequestIconCache, InstantiationType.Delayed);
export {
  GitHubPullRequestPollingContribution
};
