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
import { Sequencer } from "../../../../../../base/common/async.js";
import { VSBuffer } from "../../../../../../base/common/buffer.js";
import { Emitter } from "../../../../../../base/common/event.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../../base/common/network.js";
import { constObservable, derived, derivedOpts, observableValue, transaction } from "../../../../../../base/common/observable.js";
import { URI } from "../../../../../../base/common/uri.js";
import { toAgentHostUri } from "../../../../../../platform/agentHost/common/agentHostUri.js";
import { FileEditKind, ToolCallStatus } from "../../../../../../platform/agentHost/common/state/sessionState.js";
import { IFileService } from "../../../../../../platform/files/common/files.js";
import { ILogService } from "../../../../../../platform/log/common/log.js";
import { ChatEditingSessionState } from "../../../common/editing/chatEditingService.js";
import { fileEditsToExternalEdits } from "./stateToProgressAdapter.js";
let AgentHostSnapshotController = class extends Disposable {
  constructor(chatSessionResource, _connectionAuthority, _logService, _fileService) {
    super();
    this.chatSessionResource = chatSessionResource;
    this._connectionAuthority = _connectionAuthority;
    this._logService = _logService;
    this._fileService = _fileService;
    this.supportsKeepUndo = false;
    this.isGlobalEditingSession = false;
    this.state = constObservable(ChatEditingSessionState.Idle);
    this.entries = constObservable([]);
    this.requestDisablement = derivedOpts(
      { equalsFn: (a, b) => a.length === b.length && a.every((v, i) => v.requestId === b[i].requestId) },
      (reader) => {
        const currentIdx = this._currentCheckpointIndex.read(reader);
        const disabled = [];
        for (let i = currentIdx + 1; i < this._checkpoints.length; i++) {
          disabled.push({ requestId: this._checkpoints[i].requestId });
        }
        return disabled;
      }
    );
    this.canUndo = derived(this, (r) => this._currentCheckpointIndex.read(r) >= 0);
    this.canRedo = derived(this, (r) => this._currentCheckpointIndex.read(r) < this._checkpoints.length - 1);
    this._onDidDispose = this._register(new Emitter());
    this.onDidDispose = this._onDidDispose.event;
    this._checkpoints = [];
    this._currentCheckpointIndex = observableValue(this, -1);
    this._undoRedoSequencer = new Sequencer();
  }
  // ---- Hydration from protocol state --------------------------------------
  /**
   * Ensures a checkpoint exists for the given request. Called at the start
   * of every turn (and during history hydration) so {@link requestDisablement}
   * and {@link restoreSnapshot} can reference every request, even ones that
   * produce no file edits.
   *
   * Splices away stale checkpoints past the current index (undo branch
   * semantics) when a new request arrives after a checkpoint restore.
   */
  ensureRequestCheckpoint(requestId) {
    if (this._checkpoints.some((cp) => cp.requestId === requestId)) {
      return;
    }
    const currentIdx = this._currentCheckpointIndex.get();
    if (currentIdx < this._checkpoints.length - 1) {
      this._checkpoints.splice(currentIdx + 1);
    }
    this._checkpoints.push({ requestId, edits: [], seenToolCallIds: /* @__PURE__ */ new Set() });
    transaction((tx) => {
      this._currentCheckpointIndex.set(this._checkpoints.length - 1, tx);
    });
  }
  /**
   * Folds a completed tool call's file edits into the checkpoint for the
   * given request. Idempotent on `toolCallId`.
   */
  addToolCallEdits(requestId, tc) {
    if (tc.status !== ToolCallStatus.Completed) {
      return;
    }
    this.ensureRequestCheckpoint(requestId);
    const cp = this._checkpoints.find((c) => c.requestId === requestId);
    if (!cp || cp.seenToolCallIds.has(tc.toolCallId)) {
      return;
    }
    cp.seenToolCallIds.add(tc.toolCallId);
    const fileEdits = fileEditsToExternalEdits(tc);
    if (fileEdits.length === 0) {
      return;
    }
    const authority = this._connectionAuthority;
    for (const edit of fileEdits) {
      const resource = toAgentHostUri(edit.resource, authority);
      const entry = {
        kind: edit.kind,
        resource,
        originalResource: edit.originalResource ? toAgentHostUri(edit.originalResource, authority) : void 0,
        beforeContentUri: edit.beforeContentUri ? toAgentHostUri(edit.beforeContentUri, authority) : void 0,
        afterContentUri: edit.afterContentUri ? toAgentHostUri(edit.afterContentUri, authority) : void 0,
        undoStopId: edit.undoStopId,
        diff: edit.diff
      };
      const existingIdx = cp.edits.findIndex((e) => e.resource.toString() === resource.toString());
      if (existingIdx < 0) {
        cp.edits.push(entry);
      } else {
        cp.edits[existingIdx] = mergeFileEdit(cp.edits[existingIdx], entry);
      }
    }
  }
  // ---- Snapshots ----------------------------------------------------------
  _findCheckpointIndex(requestId) {
    return this._checkpoints.findIndex((cp) => cp.requestId === requestId);
  }
  async restoreSnapshot(requestId, _stopId) {
    return this._undoRedoSequencer.queue(async () => {
      const cpIdx = this._findCheckpointIndex(requestId);
      if (cpIdx < 0) {
        this._logService.warn(`[AgentHostSnapshotController] No checkpoint found for requestId=${requestId}`);
        return;
      }
      await this._navigateToCheckpointIndex(cpIdx - 1);
    });
  }
  /**
   * Steps a single checkpoint backwards, undoing the edits of the current
   * checkpoint. The "Undo" UI invokes this once per click.
   */
  async undoInteraction() {
    return this._undoRedoSequencer.queue(async () => {
      const currentIdx = this._currentCheckpointIndex.get();
      if (currentIdx < 0) {
        return;
      }
      await this._navigateToCheckpointIndex(currentIdx - 1);
    });
  }
  /**
   * Steps a single checkpoint forwards, redoing the edits of the next
   * checkpoint.
   *
   * Implementing this is essential: the "Redo" action repeatedly calls this
   * while {@link canRedo} is `true`, so a no-op implementation would spin
   * forever and hang the window.
   */
  async redoInteraction() {
    return this._undoRedoSequencer.queue(async () => {
      const currentIdx = this._currentCheckpointIndex.get();
      if (currentIdx >= this._checkpoints.length - 1) {
        return;
      }
      await this._navigateToCheckpointIndex(currentIdx + 1);
    });
  }
  /**
   * Moves the on-disk file state and the checkpoint cursor to `targetIdx`,
   * writing each crossed checkpoint's before/after content. Must run inside
   * the {@link _undoRedoSequencer} to avoid racing writes.
   */
  async _navigateToCheckpointIndex(targetIdx) {
    const currentIdx = this._currentCheckpointIndex.get();
    if (targetIdx < currentIdx) {
      for (let i = currentIdx; i > targetIdx; i--) {
        await this._writeCheckpointContent(this._checkpoints[i], "before");
      }
    } else if (targetIdx > currentIdx) {
      for (let i = currentIdx + 1; i <= targetIdx; i++) {
        await this._writeCheckpointContent(this._checkpoints[i], "after");
      }
    }
    transaction((tx) => {
      this._currentCheckpointIndex.set(targetIdx, tx);
    });
  }
  getSnapshotUri(requestId, uri, _stopId) {
    const cp = this._checkpoints.find((c) => c.requestId === requestId);
    if (!cp || !cp.edits.some((e) => e.resource.toString() === uri.toString())) {
      return void 0;
    }
    return URI.from({
      scheme: Schemas.chatEditingSnapshotScheme,
      path: uri.path,
      query: JSON.stringify({ session: this.chatSessionResource.toString(), requestId, undoStop: "" })
    });
  }
  async getSnapshotContents(requestId, uri, _stopId) {
    const cp = this._checkpoints.find((c) => c.requestId === requestId);
    if (!cp) {
      return void 0;
    }
    const uriStr = uri.toString();
    let edit;
    for (let i = cp.edits.length - 1; i >= 0; i--) {
      if (cp.edits[i].resource.toString() === uriStr) {
        edit = cp.edits[i];
        break;
      }
    }
    if (!edit) {
      return void 0;
    }
    try {
      if (!edit.afterContentUri) {
        return VSBuffer.fromByteArray([]);
      }
      const content = await this._fileService.readFile(edit.afterContentUri);
      return content.value;
    } catch (err) {
      this._logService.warn(`[AgentHostSnapshotController] Failed to fetch snapshot content`, err);
      return void 0;
    }
  }
  async getSnapshotModel(_requestId, _undoStop, _snapshotUri) {
    return null;
  }
  hasEditsInRequest(requestId, _reader) {
    const cp = this._checkpoints.find((c) => c.requestId === requestId);
    return !!cp && cp.edits.length > 0;
  }
  // ---- Unsupported / no-op (agent host owns edits server-side) ------------
  async show(_previousChanges) {
  }
  getEntry(_uri) {
    return void 0;
  }
  readEntry(_uri, _reader) {
    return void 0;
  }
  async accept(..._uris) {
  }
  async reject(..._uris) {
  }
  getEntryDiffBetweenStops(_uri, _requestId, _stopId) {
    return void 0;
  }
  getEntryDiffBetweenRequests(_uri, _startRequestId, _stopRequestId) {
    return constObservable(void 0);
  }
  getDiffsForFilesInSession() {
    return constObservable([]);
  }
  getDiffsForFilesInRequest(_requestId) {
    return constObservable([]);
  }
  getDiffForSession() {
    return constObservable({ added: 0, removed: 0 });
  }
  async triggerExplanationGeneration() {
  }
  clearExplanations() {
  }
  hasExplanations() {
    return false;
  }
  startStreamingEdits(_resource, _responseModel, _inUndoStop) {
    throw new Error("Not supported for agent host sessions");
  }
  applyWorkspaceEdit(_edit, _responseModel, _undoStopId) {
    throw new Error("Not supported for agent host sessions");
  }
  async startExternalEdits(_responseModel, _operationId, _resources, _undoStopId, _contentFor) {
    throw new Error("Not supported for agent host sessions");
  }
  async stopExternalEdits(_responseModel, _operationId, _contentFor) {
    throw new Error("Not supported for agent host sessions");
  }
  // ---- Stop / Dispose -----------------------------------------------------
  async stop(_clearState) {
    this.dispose();
  }
  dispose() {
    this._onDidDispose.fire();
    super.dispose();
  }
  // ---- Private helpers ----------------------------------------------------
  async _writeCheckpointContent(checkpoint, direction) {
    const ops = checkpoint.edits.map(async (edit) => {
      try {
        if (direction === "before") {
          switch (edit.kind) {
            case FileEditKind.Create:
              await this._fileService.del(edit.resource);
              break;
            case FileEditKind.Delete:
              if (edit.beforeContentUri) {
                const content = await this._fileService.readFile(edit.beforeContentUri);
                await this._fileService.writeFile(edit.resource, content.value);
              }
              break;
            case FileEditKind.Rename:
              if (edit.originalResource) {
                await this._fileService.move(edit.resource, edit.originalResource, true);
              }
              if (edit.beforeContentUri && edit.originalResource) {
                const content = await this._fileService.readFile(edit.beforeContentUri);
                await this._fileService.writeFile(edit.originalResource, content.value);
              }
              break;
            case FileEditKind.Edit:
              if (edit.beforeContentUri) {
                const content = await this._fileService.readFile(edit.beforeContentUri);
                await this._fileService.writeFile(edit.resource, content.value);
              }
              break;
          }
        } else {
          switch (edit.kind) {
            case FileEditKind.Create:
              if (edit.afterContentUri) {
                const content = await this._fileService.readFile(edit.afterContentUri);
                await this._fileService.writeFile(edit.resource, content.value);
              }
              break;
            case FileEditKind.Delete:
              await this._fileService.del(edit.resource);
              break;
            case FileEditKind.Rename:
              if (edit.originalResource) {
                await this._fileService.move(edit.originalResource, edit.resource, true);
              }
              if (edit.afterContentUri) {
                const content = await this._fileService.readFile(edit.afterContentUri);
                await this._fileService.writeFile(edit.resource, content.value);
              }
              break;
            case FileEditKind.Edit:
              if (edit.afterContentUri) {
                const content = await this._fileService.readFile(edit.afterContentUri);
                await this._fileService.writeFile(edit.resource, content.value);
              }
              break;
          }
        }
      } catch (err) {
        this._logService.warn(`[AgentHostSnapshotController] Failed to ${direction === "before" ? "undo" : "redo"} ${edit.kind} for ${edit.resource.toString()}`, err);
      }
    });
    await Promise.all(ops);
  }
};
AgentHostSnapshotController = __decorateClass([
  __decorateParam(2, ILogService),
  __decorateParam(3, IFileService)
], AgentHostSnapshotController);
function mergeFileEdit(prev, next) {
  const startsAbsent = prev.kind === FileEditKind.Create;
  const endsAbsent = next.kind === FileEditKind.Delete;
  let kind;
  if (startsAbsent && endsAbsent) {
    kind = FileEditKind.Edit;
  } else if (startsAbsent) {
    kind = FileEditKind.Create;
  } else if (endsAbsent) {
    kind = FileEditKind.Delete;
  } else {
    kind = FileEditKind.Edit;
  }
  return {
    kind,
    resource: next.resource,
    // Renames within a single request are uncommon; if the second edit
    // is itself a rename keep its originalResource, otherwise carry
    // forward the first one.
    originalResource: next.originalResource ?? prev.originalResource,
    beforeContentUri: prev.beforeContentUri,
    afterContentUri: next.afterContentUri,
    undoStopId: prev.undoStopId,
    diff: next.diff ?? prev.diff
  };
}
export {
  AgentHostSnapshotController
};
