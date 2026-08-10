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
import { Disposable, DisposableStore } from "../../../base/common/lifecycle.js";
import { localize } from "../../../nls.js";
import { IInstantiationService } from "../../instantiation/common/instantiation.js";
import { IAgentHostGitStateService } from "../common/agentHostGitStateService.js";
import { ChangesetOperationScope, ChangesetOperationStatus, hasSessionPullRequestForBranch, readSessionGitHubState, SessionLifecycle, withMostRecentSessionPullRequest } from "../common/state/sessionState.js";
import { AgentHostPullRequestOperationHandler } from "./agentHostPullRequestOperationHandler.js";
import { IAgentHostStateManager } from "./agentHostStateManager.js";
let AgentHostPullRequestOperationContribution = class extends Disposable {
  constructor(_stateManager, _instantiationService, _gitStateService) {
    super();
    this._stateManager = _stateManager;
    this._instantiationService = _instantiationService;
    this._gitStateService = _gitStateService;
  }
  registerHandlers(registry) {
    this._registry = registry;
    const store = new DisposableStore();
    const getSessionState = (sessionKey) => this._stateManager.getSessionState(sessionKey);
    const onCreated = (event) => this._onPullRequestCreated(event);
    const createPrHandler = this._instantiationService.createInstance(AgentHostPullRequestOperationHandler, false, void 0, getSessionState, onCreated);
    const createDraftPrHandler = this._instantiationService.createInstance(AgentHostPullRequestOperationHandler, true, void 0, getSessionState, onCreated);
    const createAutoMergePrHandler = this._instantiationService.createInstance(AgentHostPullRequestOperationHandler, false, "MERGE", getSessionState, onCreated);
    const createAutoSquashPrHandler = this._instantiationService.createInstance(AgentHostPullRequestOperationHandler, false, "SQUASH", getSessionState, onCreated);
    const createAutoRebasePrHandler = this._instantiationService.createInstance(AgentHostPullRequestOperationHandler, false, "REBASE", getSessionState, onCreated);
    store.add(registry.registerChangesetOperationHandler(AgentHostPullRequestOperationHandler.OPERATION_CREATE_PR, createPrHandler));
    store.add(registry.registerChangesetOperationHandler(AgentHostPullRequestOperationHandler.OPERATION_CREATE_DRAFT_PR, createDraftPrHandler));
    store.add(registry.registerChangesetOperationHandler(AgentHostPullRequestOperationHandler.OPERATION_CREATE_PR_AUTO_MERGE, createAutoMergePrHandler));
    store.add(registry.registerChangesetOperationHandler(AgentHostPullRequestOperationHandler.OPERATION_CREATE_PR_AUTO_SQUASH, createAutoSquashPrHandler));
    store.add(registry.registerChangesetOperationHandler(AgentHostPullRequestOperationHandler.OPERATION_CREATE_PR_AUTO_REBASE, createAutoRebasePrHandler));
    store.add({ dispose: () => {
      this._registry = void 0;
    } });
    return store;
  }
  getOperations({ sessionKey, gitState, gitHubState }) {
    const state = this._stateManager.getSessionState(sessionKey);
    if (state?.lifecycle === SessionLifecycle.Creating) {
      return void 0;
    }
    if (hasSessionPullRequestForBranch(gitHubState, gitState?.branchName)) {
      return void 0;
    }
    const outgoingChanges = gitState?.outgoingChanges ?? 0;
    const uncommittedChanges = gitState?.uncommittedChanges ?? 0;
    const hasChanges = outgoingChanges > 0 || uncommittedChanges > 0;
    if (!gitState?.hasGitHubRemote || !hasChanges) {
      return void 0;
    }
    return [
      {
        id: "create-pr",
        label: localize("agentHost.changeset.createPR", "Create PR"),
        icon: "git-pull-request-create",
        group: "pull-request",
        scopes: [ChangesetOperationScope.Changeset],
        status: ChangesetOperationStatus.Idle
      },
      {
        id: "create-pr-auto-merge",
        label: localize("agentHost.changeset.createPRAutoMerge", "Create PR (Auto-Merge)"),
        icon: "git-merge",
        group: "pull-request",
        scopes: [ChangesetOperationScope.Changeset],
        status: ChangesetOperationStatus.Idle
      },
      {
        id: "create-pr-auto-squash",
        label: localize("agentHost.changeset.createPRAutoSquash", "Create PR (Auto-Squash)"),
        icon: "git-merge",
        group: "pull-request",
        scopes: [ChangesetOperationScope.Changeset],
        status: ChangesetOperationStatus.Idle
      },
      {
        id: "create-pr-auto-rebase",
        label: localize("agentHost.changeset.createPRAutoRebase", "Create PR (Auto-Rebase)"),
        icon: "git-merge",
        group: "pull-request",
        scopes: [ChangesetOperationScope.Changeset],
        status: ChangesetOperationStatus.Idle
      },
      {
        id: "create-draft-pr",
        label: localize("agentHost.changeset.createDraftPR", "Create Draft PR"),
        icon: "git-pull-request-draft",
        group: "pull-request_draft",
        scopes: [ChangesetOperationScope.Changeset],
        status: ChangesetOperationStatus.Idle
      }
    ];
  }
  _onPullRequestCreated(event) {
    const sessionKey = event.sessionKey;
    this._registry?.onDidChangeOperations(sessionKey);
    this._registry?.refreshSessionGitState(sessionKey);
    const gitHubState = readSessionGitHubState(this._stateManager.getSessionState(sessionKey)?._meta);
    this._gitStateService.setSessionGitHubState(sessionKey, withMostRecentSessionPullRequest(gitHubState, event.pullRequestUrl, event.branchName));
  }
};
AgentHostPullRequestOperationContribution = __decorateClass([
  __decorateParam(0, IAgentHostStateManager),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IAgentHostGitStateService)
], AgentHostPullRequestOperationContribution);
export {
  AgentHostPullRequestOperationContribution
};
