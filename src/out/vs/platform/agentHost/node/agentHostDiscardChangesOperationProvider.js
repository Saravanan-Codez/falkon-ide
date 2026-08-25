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
import { ChangesetKind } from "../common/changesetUri.js";
import { ChangesetOperationScope, ChangesetOperationStatus } from "../common/state/sessionState.js";
import { AgentHostDiscardChangesOperationHandler } from "./agentHostDiscardChangesOperationHandler.js";
import { IAgentHostStateManager } from "./agentHostStateManager.js";
let AgentHostDiscardChangesOperationContribution = class extends Disposable {
  constructor(_stateManager, _instantiationService) {
    super();
    this._stateManager = _stateManager;
    this._instantiationService = _instantiationService;
  }
  registerHandlers(registry) {
    const store = new DisposableStore();
    const getSessionState = (sessionKey) => this._stateManager.getSessionState(sessionKey);
    const handler = this._instantiationService.createInstance(AgentHostDiscardChangesOperationHandler, getSessionState);
    store.add(registry.registerChangesetOperationHandler(AgentHostDiscardChangesOperationHandler.OPERATION_DISCARD_CHANGES, handler));
    return store;
  }
  getOperations({ changesetKind, gitState }) {
    if (changesetKind !== ChangesetKind.Uncommitted || (gitState?.uncommittedChanges ?? 0) <= 0) {
      return [];
    }
    return [{
      id: AgentHostDiscardChangesOperationHandler.OPERATION_DISCARD_CHANGES,
      label: localize("agentHost.changeset.discardChanges", "Discard Changes"),
      confirmation: localize("agentHost.changeset.discardChanges.confirmation", "Are you sure you want to discard the changes in '{0}'? This action cannot be undone."),
      icon: "discard",
      scopes: [ChangesetOperationScope.Resource],
      status: ChangesetOperationStatus.Idle
    }];
  }
};
AgentHostDiscardChangesOperationContribution = __decorateClass([
  __decorateParam(0, IAgentHostStateManager),
  __decorateParam(1, IInstantiationService)
], AgentHostDiscardChangesOperationContribution);
export {
  AgentHostDiscardChangesOperationContribution
};
