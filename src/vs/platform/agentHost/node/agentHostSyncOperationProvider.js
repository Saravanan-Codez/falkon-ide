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
import { ChangesetOperationScope, ChangesetOperationStatus, SessionLifecycle } from "../common/state/sessionState.js";
import { IAgentHostStateManager } from "./agentHostStateManager.js";
import { AgentHostSyncOperationHandler } from "./agentHostSyncOperationHandler.js";
let AgentHostSyncOperationContribution = class extends Disposable {
  constructor(_stateManager, _instantiationService) {
    super();
    this._stateManager = _stateManager;
    this._instantiationService = _instantiationService;
  }
  registerHandlers(registry) {
    this._registry = registry;
    const store = new DisposableStore();
    const getSessionState = (sessionKey) => this._stateManager.getSessionState(sessionKey);
    const handler = this._instantiationService.createInstance(AgentHostSyncOperationHandler, getSessionState, (sessionKey) => this._onSynced(sessionKey));
    store.add(registry.registerChangesetOperationHandler(AgentHostSyncOperationHandler.OPERATION_SYNC, handler));
    store.add({ dispose: () => {
      this._registry = void 0;
    } });
    return store;
  }
  getOperations({ sessionKey, gitState }) {
    const state = this._stateManager.getSessionState(sessionKey);
    if (state?.lifecycle === SessionLifecycle.Creating && (gitState?.uncommittedChanges ?? 0) > 0) {
      return void 0;
    }
    if (!gitState?.upstreamBranchName || (gitState?.outgoingChanges ?? 0) === 0) {
      return void 0;
    }
    return [{
      id: AgentHostSyncOperationHandler.OPERATION_SYNC,
      label: localize("agentHost.changeset.sync", "Sync Changes {0}\u2191", gitState.outgoingChanges),
      icon: "sync",
      group: "sync",
      scopes: [ChangesetOperationScope.Changeset],
      status: ChangesetOperationStatus.Idle
    }];
  }
  async _onSynced(sessionKey) {
    this._registry?.onDidChangeOperations(sessionKey);
    await this._registry?.refreshSessionGitState(sessionKey);
  }
};
AgentHostSyncOperationContribution = __decorateClass([
  __decorateParam(0, IAgentHostStateManager),
  __decorateParam(1, IInstantiationService)
], AgentHostSyncOperationContribution);
export {
  AgentHostSyncOperationContribution
};
