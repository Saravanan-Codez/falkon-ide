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
import { CancellationToken } from "../../../base/common/cancellation.js";
import { toErrorMessage } from "../../../base/common/errorMessage.js";
import { Disposable, DisposableMap, toDisposable } from "../../../base/common/lifecycle.js";
import { parseChangesetUri } from "../common/changesetUri.js";
import { AHP_SESSION_NOT_FOUND, JsonRpcErrorCodes, ProtocolError } from "../common/state/sessionProtocol.js";
import { ActionType } from "../common/state/sessionActions.js";
import { ChangesetOperationScope, ChangesetOperationStatus, ChangesetOperationTargetKind, readSessionGitHubState, readSessionGitState } from "../common/state/sessionState.js";
import { IAgentHostStateManager } from "./agentHostStateManager.js";
import { IAgentHostChangesetSubscriptionService } from "../common/agentHostChangesetSubscriptionService.js";
import { IAgentHostGitStateService } from "../common/agentHostGitStateService.js";
let AgentHostChangesetOperationService = class extends Disposable {
  constructor(_stateManager, _gitStateService, _changesetSubscriptions) {
    super();
    this._stateManager = _stateManager;
    this._gitStateService = _gitStateService;
    this._changesetSubscriptions = _changesetSubscriptions;
    this._handlerRegistrations = this._register(new DisposableMap());
    this._changesetOperationHandlers = /* @__PURE__ */ new Map();
    this._inFlightOperations = /* @__PURE__ */ new Map();
    this._registry = {
      registerChangesetOperationHandler: (operationId, handler) => this._registerChangesetOperationHandler(operationId, handler),
      refreshSessionGitState: (sessionKey) => this._gitStateService.refreshSessionGitState(sessionKey),
      onDidChangeOperations: (sessionKey) => this.updateOperations(sessionKey)
    };
  }
  registerContribution(contribution) {
    if (this._handlerRegistrations.has(contribution)) {
      throw new Error("Changeset operation contribution already registered");
    }
    this._handlerRegistrations.set(contribution, contribution.registerHandlers(this._registry));
    return toDisposable(() => {
      this._handlerRegistrations.deleteAndDispose(contribution);
      contribution.dispose();
    });
  }
  getOperations(sessionKey, changeset, gitState, gitHubState) {
    if (!gitState) {
      const sessionState = this._stateManager.getSessionState(sessionKey);
      gitState = readSessionGitState(sessionState?._meta);
      if (!gitState) {
        return [];
      }
    }
    if (!gitHubState) {
      gitHubState = readSessionGitHubState(this._stateManager.getSessionState(sessionKey)?._meta);
    }
    const parsed = parseChangesetUri(changeset);
    if (!parsed) {
      return [];
    }
    return this._getOperations({
      sessionKey,
      changesetUri: changeset,
      changesetKind: parsed.kind,
      gitState,
      gitHubState
    });
  }
  _getOperations(context) {
    const operations = [];
    for (const contribution of this._handlerRegistrations.keys()) {
      const contributed = contribution.getOperations(context);
      if (contributed) {
        operations.push(...contributed);
      }
    }
    if (this._stateManager.hasActiveTurn(context.sessionKey)) {
      return operations.map((operation) => ({
        ...operation,
        status: ChangesetOperationStatus.Disabled
      }));
    }
    return operations;
  }
  updateOperations(sessionKey, changeset, gitState, gitHubState) {
    if (!gitState) {
      const sessionState = this._stateManager.getSessionState(sessionKey);
      gitState = readSessionGitState(sessionState?._meta);
      if (!gitState) {
        return;
      }
    }
    if (!gitHubState) {
      const sessionState = this._stateManager.getSessionState(sessionKey);
      gitHubState = readSessionGitHubState(sessionState?._meta);
    }
    const changesets = changeset ? [changeset] : this._changesetSubscriptions.getSessionSubscriptions(sessionKey);
    for (const changeset2 of changesets) {
      const operations = this.getOperations(sessionKey, changeset2, gitState, gitHubState);
      this._stateManager.dispatchServerAction(changeset2, {
        type: ActionType.ChangesetOperationsChanged,
        operations: [...operations]
      });
    }
  }
  async invokeChangesetOperation(params) {
    const state = this._stateManager.getChangesetState(params.channel);
    if (!state) {
      throw new ProtocolError(AHP_SESSION_NOT_FOUND, `Changeset not found: ${params.channel}`);
    }
    const op = state.operations?.find((o) => o.id === params.operationId);
    if (!op) {
      throw new ProtocolError(JsonRpcErrorCodes.InvalidParams, `Unknown operation '${params.operationId}' on changeset ${params.channel}`);
    }
    if (op.status === ChangesetOperationStatus.Disabled) {
      throw new ProtocolError(JsonRpcErrorCodes.InvalidParams, `Operation '${params.operationId}' is disabled on changeset ${params.channel}`);
    }
    const parsed = parseChangesetUri(params.channel);
    if (parsed && this._stateManager.hasActiveTurn(parsed.sessionUri)) {
      throw new ProtocolError(JsonRpcErrorCodes.InvalidParams, `Operation '${params.operationId}' is disabled while a turn is active on changeset ${params.channel}`);
    }
    const targetKind = params.target?.kind === ChangesetOperationTargetKind.Resource ? ChangesetOperationScope.Resource : params.target?.kind === ChangesetOperationTargetKind.Range ? ChangesetOperationScope.Range : ChangesetOperationScope.Changeset;
    if (!op.scopes.includes(targetKind)) {
      throw new ProtocolError(JsonRpcErrorCodes.InvalidParams, `Operation '${params.operationId}' does not support scope '${targetKind}' (allowed: ${op.scopes.join(", ")})`);
    }
    const handler = this._changesetOperationHandlers.get(params.operationId);
    if (!handler) {
      throw new ProtocolError(JsonRpcErrorCodes.InternalError, `No operation handler registered for '${params.operationId}' on changeset ${params.channel}`);
    }
    return this._invokeChangesetOperation(handler, params);
  }
  _invokeChangesetOperation(handler, params) {
    const operationKey = `${params.channel}\0${params.operationId}\0${JSON.stringify(params.target ?? null)}`;
    const inFlightOperationResult = this._inFlightOperations.get(operationKey);
    if (inFlightOperationResult) {
      return inFlightOperationResult;
    }
    this._stateManager.dispatchServerAction(params.channel, {
      type: ActionType.ChangesetOperationStatusChanged,
      operationId: params.operationId,
      status: ChangesetOperationStatus.Running
    });
    const operationPromise = handler.invoke(params, CancellationToken.None).then((result) => {
      this._stateManager.dispatchServerAction(params.channel, {
        type: ActionType.ChangesetOperationStatusChanged,
        operationId: params.operationId,
        status: ChangesetOperationStatus.Idle
      });
      return result;
    }).catch((error) => {
      this._stateManager.dispatchServerAction(params.channel, {
        type: ActionType.ChangesetOperationStatusChanged,
        operationId: params.operationId,
        status: ChangesetOperationStatus.Error,
        error: toChangesetOperationError(error)
      });
      throw error;
    }).finally(() => {
      if (this._inFlightOperations.get(operationKey) === operationPromise) {
        this._inFlightOperations.delete(operationKey);
      }
    });
    this._inFlightOperations.set(operationKey, operationPromise);
    return operationPromise;
  }
  _registerChangesetOperationHandler(operationId, handler) {
    if (this._changesetOperationHandlers.has(operationId)) {
      throw new Error(`Changeset operation handler already registered for '${operationId}'`);
    }
    this._changesetOperationHandlers.set(operationId, handler);
    return toDisposable(() => {
      if (this._changesetOperationHandlers.get(operationId) === handler) {
        this._changesetOperationHandlers.delete(operationId);
      }
    });
  }
};
AgentHostChangesetOperationService = __decorateClass([
  __decorateParam(0, IAgentHostStateManager),
  __decorateParam(1, IAgentHostGitStateService),
  __decorateParam(2, IAgentHostChangesetSubscriptionService)
], AgentHostChangesetOperationService);
function toChangesetOperationError(error) {
  const message = toErrorMessage(error);
  return error instanceof Error ? { errorType: error.name, message, stack: error.stack } : { errorType: "Error", message };
}
export {
  AgentHostChangesetOperationService
};
