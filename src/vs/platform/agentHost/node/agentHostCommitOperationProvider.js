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
import { ChangesetOperationScope, ChangesetOperationStatus, hasSessionPullRequestForBranch } from "../common/state/sessionState.js";
import { AgentHostCommitOperationHandler } from "./agentHostCommitOperationHandler.js";
import { IAgentHostStateManager } from "./agentHostStateManager.js";
let AgentHostCommitOperationContribution = class extends Disposable {
  constructor(_stateManager, _instantiationService) {
    super();
    this._stateManager = _stateManager;
    this._instantiationService = _instantiationService;
  }
  registerHandlers(registry) {
    this._registry = registry;
    const store = new DisposableStore();
    const getSessionState = (sessionKey) => this._stateManager.getSessionState(sessionKey);
    const handler = this._instantiationService.createInstance(AgentHostCommitOperationHandler, getSessionState, (sessionKey) => this._onCommitted(sessionKey));
    store.add(registry.registerChangesetOperationHandler(AgentHostCommitOperationHandler.OPERATION_COMMIT, handler));
    store.add({ dispose: () => {
      this._registry = void 0;
    } });
    return store;
  }
  getOperations({ changesetKind, gitHubState, gitState }) {
    if ((gitState?.uncommittedChanges ?? 0) <= 0) {
      return [];
    }
    if (!hasSessionPullRequestForBranch(gitHubState, gitState?.branchName) && changesetKind !== "uncommitted") {
      return [];
    }
    return [{
      id: AgentHostCommitOperationHandler.OPERATION_COMMIT,
      label: localize("agentHost.changeset.commit", "Commit Changes"),
      icon: "git-commit",
      group: "commit",
      scopes: [ChangesetOperationScope.Changeset],
      status: ChangesetOperationStatus.Idle
    }];
  }
  async _onCommitted(sessionKey) {
    this._registry?.onDidChangeOperations(sessionKey);
    await this._registry?.refreshSessionGitState(sessionKey);
  }
};
AgentHostCommitOperationContribution = __decorateClass([
  __decorateParam(0, IAgentHostStateManager),
  __decorateParam(1, IInstantiationService)
], AgentHostCommitOperationContribution);
export {
  AgentHostCommitOperationContribution
};
