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
import { basename } from "../../../base/common/resources.js";
import { URI } from "../../../base/common/uri.js";
import { localize } from "../../../nls.js";
import { ChangesetKind, parseChangesetUri } from "../common/changesetUri.js";
import { ChangesetOperationTargetKind } from "../common/state/protocol/channels-changeset/commands.js";
import { AHP_SESSION_NOT_FOUND, JsonRpcErrorCodes, ProtocolError } from "../common/state/sessionProtocol.js";
import { ILogService } from "../../log/common/log.js";
import { IAgentHostGitService } from "../common/agentHostGitService.js";
let AgentHostDiscardChangesOperationHandler = class {
  constructor(_getSessionState, _agentHostGitService, _logService) {
    this._getSessionState = _getSessionState;
    this._agentHostGitService = _agentHostGitService;
    this._logService = _logService;
  }
  static {
    this.OPERATION_DISCARD_CHANGES = "discard-changes";
  }
  async invoke(params, token) {
    const abortController = new AbortController();
    if (token.isCancellationRequested) {
      abortController.abort();
    }
    const cancellationListener = token.onCancellationRequested(() => abortController.abort());
    try {
      return await this._invoke(params, token, abortController.signal);
    } finally {
      cancellationListener.dispose();
    }
  }
  async _invoke(params, token, _signal) {
    const parsed = parseChangesetUri(params.channel);
    if (!parsed || parsed.kind !== ChangesetKind.Uncommitted) {
      throw new ProtocolError(JsonRpcErrorCodes.InvalidParams, `Not an uncommitted changeset URI: ${params.channel}`);
    }
    this._throwIfCancelled(token);
    const sessionUri = parsed.sessionUri;
    const sessionState = this._getSessionState(sessionUri);
    if (!sessionState) {
      throw new ProtocolError(AHP_SESSION_NOT_FOUND, `Session not found: ${sessionUri}`);
    }
    if (params.target?.kind !== ChangesetOperationTargetKind.Resource) {
      throw new ProtocolError(
        JsonRpcErrorCodes.InvalidParams,
        `Operation '${AgentHostDiscardChangesOperationHandler.OPERATION_DISCARD_CHANGES}' requires a resource target.`
      );
    }
    const workingDirectoryStr = sessionState.workingDirectories?.[0];
    if (!workingDirectoryStr) {
      throw new ProtocolError(JsonRpcErrorCodes.InternalError, `Session has no working directory: ${sessionUri}`);
    }
    const workingDirectory = URI.parse(workingDirectoryStr);
    const resource = URI.parse(params.target.resource);
    this._logService.info(`[AgentHostDiscardChangesOperationHandler] Restoring '${resource.fsPath}' for session ${sessionUri}`);
    try {
      await this._agentHostGitService.restore(workingDirectory, [resource.fsPath]);
    } catch (err) {
      this._throwIfCancelled(token);
      throw new ProtocolError(
        JsonRpcErrorCodes.InternalError,
        `Failed to discard changes: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    return { message: { markdown: localize("agentHost.changeset.discardChanges.discarded", "Discarded changes to `{0}`.", basename(resource)) } };
  }
  _throwIfCancelled(token) {
    if (token.isCancellationRequested) {
      throw new ProtocolError(JsonRpcErrorCodes.InternalError, localize("agentHost.changeset.discardChanges.cancelled", "Discard changes operation was cancelled."));
    }
  }
};
AgentHostDiscardChangesOperationHandler = __decorateClass([
  __decorateParam(1, IAgentHostGitService),
  __decorateParam(2, ILogService)
], AgentHostDiscardChangesOperationHandler);
export {
  AgentHostDiscardChangesOperationHandler
};
