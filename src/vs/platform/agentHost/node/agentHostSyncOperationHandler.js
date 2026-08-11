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
import { URI } from "../../../base/common/uri.js";
import { localize } from "../../../nls.js";
import { parseChangesetUri } from "../common/changesetUri.js";
import { AHP_SESSION_NOT_FOUND, JsonRpcErrorCodes, ProtocolError } from "../common/state/sessionProtocol.js";
import { readSessionGitState } from "../common/state/sessionState.js";
import { ILogService } from "../../log/common/log.js";
import { IAgentHostGitService } from "../common/agentHostGitService.js";
let AgentHostSyncOperationHandler = class {
  constructor(_getSessionState, _onSynced, _gitService, _logService) {
    this._getSessionState = _getSessionState;
    this._onSynced = _onSynced;
    this._gitService = _gitService;
    this._logService = _logService;
  }
  static {
    this.OPERATION_SYNC = "sync";
  }
  async invoke(params, token) {
    const parsed = parseChangesetUri(params.channel);
    if (!parsed) {
      throw new ProtocolError(JsonRpcErrorCodes.InvalidParams, `Not a changeset URI: ${params.channel}`);
    }
    this._throwIfCancelled(token);
    const sessionUri = parsed.sessionUri;
    const sessionState = this._getSessionState(sessionUri);
    if (!sessionState) {
      throw new ProtocolError(AHP_SESSION_NOT_FOUND, `Session not found: ${sessionUri}`);
    }
    const workingDirectoryStr = sessionState.workingDirectories?.[0];
    if (!workingDirectoryStr) {
      throw new ProtocolError(JsonRpcErrorCodes.InternalError, `Session has no working directory: ${sessionUri}`);
    }
    const workingDirectory = URI.parse(workingDirectoryStr);
    const gitState = readSessionGitState(sessionState._meta);
    const branchName = gitState?.branchName ?? await this._gitService.getCurrentBranch(workingDirectory);
    if (!branchName) {
      throw new ProtocolError(JsonRpcErrorCodes.InternalError, `Could not determine current branch for ${workingDirectory}`);
    }
    this._throwIfCancelled(token);
    this._logService.info(`[AgentHostSyncOperationHandler] Syncing branch ${branchName} for session ${sessionUri}`);
    try {
      await this._gitService.pull(workingDirectory);
      await this._gitService.push(workingDirectory);
    } catch (err) {
      this._throwIfCancelled(token);
      throw new ProtocolError(JsonRpcErrorCodes.InternalError, `Failed to sync changes: ${err instanceof Error ? err.message : String(err)}`);
    }
    try {
      await this._onSynced(sessionUri);
    } catch (err) {
      this._logService.warn(`[AgentHostSyncOperationHandler] Post-sync refresh failed for session ${sessionUri}: ${err instanceof Error ? err.message : String(err)}`);
    }
    return { message: { markdown: localize("agentHost.changeset.sync.synced", "Synced changes.") } };
  }
  _throwIfCancelled(token) {
    if (token.isCancellationRequested) {
      throw new ProtocolError(JsonRpcErrorCodes.InternalError, localize("agentHost.changeset.sync.cancelled", "Sync operation was cancelled."));
    }
  }
};
AgentHostSyncOperationHandler = __decorateClass([
  __decorateParam(2, IAgentHostGitService),
  __decorateParam(3, ILogService)
], AgentHostSyncOperationHandler);
export {
  AgentHostSyncOperationHandler
};
