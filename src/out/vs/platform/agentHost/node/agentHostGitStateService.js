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
import { equals as objectEquals } from "../../../base/common/objects.js";
import { URI } from "../../../base/common/uri.js";
import { Emitter } from "../../../base/common/event.js";
import { ILogService } from "../../log/common/log.js";
import { META_GIT_STATE, META_GITHUB_STATE } from "../common/agentHostGitStateService.js";
import { readSessionGitHubState, readSessionGitState, SessionLifecycle, withMostRecentSessionPullRequest, withSessionGitHubState, withSessionGitState } from "../common/state/sessionState.js";
import { MAX_SESSION_ISSUE_REFERENCES, parseGitHubIssueReferences, toGitHubIssueUrl } from "../common/githubIssueReferences.js";
import { IAgentHostGitService, parseUpstreamBranchName } from "../common/agentHostGitService.js";
import { IAgentHostStateManager } from "./agentHostStateManager.js";
import { ISessionDataService } from "../common/sessionDataService.js";
import { IAgentHostOctoKitService } from "./shared/agentHostOctoKitService.js";
import { IAgentService } from "../common/agentService.js";
import { IAgentHostGitHubEndpointService } from "./agentHostGitHubEndpointService.js";
import { Disposable, toDisposable } from "../../../base/common/lifecycle.js";
import { CancellationTokenSource } from "../../../base/common/cancellation.js";
import { ThrottlerByKey, SequencerByKey, timeout } from "../../../base/common/async.js";
import { isCancellationError } from "../../../base/common/errors.js";
let AgentHostGitStateService = class extends Disposable {
  constructor(_stateManager, _gitService, _octoKitService, _agentService, _gitHubEndpointService, _logService, _sessionDataService) {
    super();
    this._stateManager = _stateManager;
    this._gitService = _gitService;
    this._octoKitService = _octoKitService;
    this._agentService = _agentService;
    this._gitHubEndpointService = _gitHubEndpointService;
    this._logService = _logService;
    this._sessionDataService = _sessionDataService;
    this._onDidRefreshSessionGitState = this._register(new Emitter());
    this.onDidRefreshSessionGitState = this._onDidRefreshSessionGitState.event;
    this._gitStateRefreshThrottler = this._register(new ThrottlerByKey());
    this._gitStateRefreshCancellationTokenSource = new CancellationTokenSource();
    /**
     * Serializes pull request lookups per session so overlapping triggers (turn
     * completion, session restore, a refresh observing a branch change) issue at
     * most one GitHub request at a time and observe each other's writes.
     */
    this._pullRequestSequencer = new SequencerByKey();
    this._pullRequestAbortController = new AbortController();
    this._register(toDisposable(() => this._gitStateRefreshCancellationTokenSource.dispose(true)));
    this._register(toDisposable(() => this._pullRequestAbortController.abort()));
  }
  async attachSessionGitHubPullRequest(sessionKey, workingDirectory) {
    await this.refreshSessionGitState(sessionKey, workingDirectory);
    await this._queuePullRequestLookup(sessionKey);
  }
  /**
   * Queues a pull request lookup on the session's sequencer so overlapping
   * triggers (turn completion, session restore, a refresh observing a branch
   * change) issue at most one GitHub request at a time.
   */
  _queuePullRequestLookup(sessionKey) {
    return this._pullRequestSequencer.queue(sessionKey, () => this._attachSessionGitHubPullRequest(sessionKey));
  }
  async _attachSessionGitHubPullRequest(sessionKey) {
    const state = this._stateManager.getSessionState(sessionKey);
    if (!state) {
      return;
    }
    if (state.lifecycle !== SessionLifecycle.Ready) {
      return;
    }
    const gitHubState = readSessionGitHubState(this._stateManager.getSessionState(sessionKey)?._meta);
    if (!gitHubState?.owner || !gitHubState?.repo) {
      return;
    }
    const gitState = readSessionGitState(state._meta);
    const branchName = gitState?.branchName;
    if (!branchName || branchName === gitState?.baseBranchName) {
      return;
    }
    if (gitHubState.pullRequestBranchName === branchName) {
      return;
    }
    try {
      const repoResource = this._gitHubEndpointService.getRepoResource();
      const authToken = this._agentService.getAuthToken({
        resource: repoResource.resource,
        scopes: repoResource.scopes_supported
      });
      if (!authToken) {
        return;
      }
      const pr = await this._findPullRequestForCheckout(state, gitHubState.owner, gitHubState.repo, gitState, branchName, authToken);
      if (!pr?.url) {
        this._logService.trace(`[AgentHostGitStateService][attachSessionGitHubPullRequest] No pull request found for ${sessionKey} on branch ${branchName}`);
        return;
      }
      const currentBranchName = readSessionGitState(this._stateManager.getSessionState(sessionKey)?._meta)?.branchName;
      if (currentBranchName !== branchName) {
        return;
      }
      const currentGitHubState = readSessionGitHubState(this._stateManager.getSessionState(sessionKey)?._meta);
      await this.setSessionGitHubState(sessionKey, withMostRecentSessionPullRequest(currentGitHubState, pr.url, branchName));
    } catch (error) {
      this._logService.warn(`[AgentHostGitStateService][attachSessionGitHubPullRequest] Failed to find pull request for ${sessionKey}`, error);
    }
  }
  /**
   * Resolves the pull request of the branch that is currently checked out,
   * preferring the remote head branch and falling back to the commit at HEAD
   * for local branches whose name never reached the remote.
   */
  async _findPullRequestForCheckout(state, owner, repo, gitState, branchName, authToken) {
    const signal = this._pullRequestAbortController.signal;
    const githubHeadOwner = gitState?.githubHeadOwner;
    const upstreamBranch = githubHeadOwner ? parseUpstreamBranchName(gitState?.upstreamBranchName) : void 0;
    const headBranch = upstreamBranch?.branch ?? branchName;
    const headOwner = upstreamBranch && githubHeadOwner ? githubHeadOwner : owner;
    const pullRequestByBranch = await this._octoKitService.findPullRequestByHeadBranch(owner, repo, headBranch, authToken, signal, headOwner);
    if (pullRequestByBranch) {
      return pullRequestByBranch;
    }
    const workingDirectory = state.workingDirectories?.[0];
    if (!workingDirectory) {
      return void 0;
    }
    const headSha = await this._gitService.revParse(URI.parse(workingDirectory), "HEAD");
    return headSha ? this._octoKitService.findPullRequestByHeadSha(owner, repo, headSha, authToken, signal) : void 0;
  }
  /**
   * Scans a user message for GitHub issue references and merges them into the
   * session's GitHub state. References already recorded are preserved and keep
   * their position, so the list reflects the order in which the session first
   * mentioned each issue.
   */
  async attachSessionGitHubIssues(sessionKey, text) {
    const references = parseGitHubIssueReferences(text);
    if (references.length === 0) {
      return;
    }
    const currentUrls = readSessionGitHubState(this._stateManager.getSessionState(sessionKey)?._meta)?.issueUrls ?? [];
    const nextUrls = [...currentUrls];
    for (const reference of references) {
      const url = toGitHubIssueUrl(reference);
      if (!nextUrls.includes(url)) {
        nextUrls.push(url);
      }
    }
    if (nextUrls.length === currentUrls.length) {
      return;
    }
    await this.setSessionGitHubState(sessionKey, {
      issueUrls: nextUrls.slice(0, MAX_SESSION_ISSUE_REFERENCES)
    });
  }
  async refreshSessionGitState(sessionKey, workingDirectory) {
    const sessionState = this._stateManager.getSessionState(sessionKey);
    if (sessionState?.lifecycle === SessionLifecycle.CreationFailed) {
      return;
    }
    if (!workingDirectory) {
      const workingDirectoryStr = sessionState?.workingDirectories?.[0];
      if (workingDirectoryStr) {
        workingDirectory = URI.parse(workingDirectoryStr);
      }
    }
    if (!workingDirectory) {
      return;
    }
    await this._gitStateRefreshThrottler.queue(sessionKey, async () => {
      try {
        this._logService.trace(`[AgentHostGitStateService][refreshSessionGitState] Refreshing git state for ${sessionKey}, ${workingDirectory?.fsPath}`);
        const gitState = await this._gitService.getSessionGitState(workingDirectory);
        if (gitState) {
          const currentMeta = this._stateManager.getSessionState(sessionKey)?._meta;
          const previousGitState = readSessionGitState(currentMeta);
          if (!objectEquals(previousGitState, gitState)) {
            await this._setSessionGitState(sessionKey, gitState);
            if (gitState.githubOwner && gitState.githubRepo) {
              await this.setSessionGitHubState(sessionKey, {
                owner: gitState.githubOwner,
                repo: gitState.githubRepo
              });
              if (previousGitState?.branchName !== gitState.branchName) {
                await this._queuePullRequestLookup(sessionKey);
              }
            }
          }
        }
        this._onDidRefreshSessionGitState.fire(sessionKey);
        await timeout(5e3, this._gitStateRefreshCancellationTokenSource.token);
      } catch (error) {
        if (isCancellationError(error)) {
          return;
        }
        this._logService.warn(`[AgentHostGitStateService][refreshSessionGitState] Failed to compute git state for ${sessionKey}:`, error);
      }
    });
  }
  async setSessionGitHubState(sessionKey, state) {
    const currentMeta = this._stateManager.getSessionState(sessionKey)?._meta;
    const currentState = readSessionGitHubState(currentMeta);
    const nextState = { ...currentState ?? {}, ...state };
    if (objectEquals(currentState, nextState)) {
      return;
    }
    const nextMeta = withSessionGitHubState(currentMeta, nextState);
    this._stateManager.setSessionMeta(sessionKey, nextMeta);
    await this._saveSessionState(sessionKey, META_GITHUB_STATE, JSON.stringify(nextState));
  }
  async _setSessionGitState(sessionKey, gitState) {
    const currentMeta = this._stateManager.getSessionState(sessionKey)?._meta;
    const nextMeta = withSessionGitState(currentMeta, gitState);
    this._stateManager.setSessionMeta(sessionKey, nextMeta);
    await this._saveSessionState(sessionKey, META_GIT_STATE, JSON.stringify(gitState));
  }
  async _saveSessionState(sessionKey, key, value) {
    const state = this._stateManager.getSessionState(sessionKey);
    if (state?.lifecycle === SessionLifecycle.Creating) {
      return;
    }
    let databaseRef;
    try {
      databaseRef = this._sessionDataService.openDatabase(URI.parse(sessionKey));
    } catch (error) {
      this._logService.warn(`[AgentHostGitStateService][_saveSessionState] Failed to open session database for ${sessionKey}`, error);
      return;
    }
    try {
      await databaseRef.object.setMetadata(key, value);
    } catch (error) {
      this._logService.warn(`[AgentHostGitStateService][_saveSessionState] Failed to persist ${key}`, error);
    } finally {
      databaseRef.dispose();
    }
  }
};
AgentHostGitStateService = __decorateClass([
  __decorateParam(0, IAgentHostStateManager),
  __decorateParam(1, IAgentHostGitService),
  __decorateParam(2, IAgentHostOctoKitService),
  __decorateParam(3, IAgentService),
  __decorateParam(4, IAgentHostGitHubEndpointService),
  __decorateParam(5, ILogService),
  __decorateParam(6, ISessionDataService)
], AgentHostGitStateService);
export {
  AgentHostGitStateService
};
