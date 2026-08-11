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
import { equals as arraysEqual } from "../../../../../base/common/arrays.js";
import { findFirst, findLast, findLastIdx } from "../../../../../base/common/arraysFind.js";
import { assertNever } from "../../../../../base/common/assert.js";
import { ThrottledDelayer } from "../../../../../base/common/async.js";
import { Event } from "../../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { mapsStrictEqualIgnoreOrder, ResourceMap, ResourceSet } from "../../../../../base/common/map.js";
import { equals as objectsEqual } from "../../../../../base/common/objects.js";
import { constObservable, derived, derivedOpts, ObservablePromise, observableSignalFromEvent, observableValue, observableValueOpts, transaction } from "../../../../../base/common/observable.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { isDefined } from "../../../../../base/common/types.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { DefaultEndOfLine, EndOfLinePreference, ValidAnnotatedEditOperation } from "../../../../../editor/common/model.js";
import { createTextBuffer } from "../../../../../editor/common/model/textModel.js";
import { IEditorWorkerService } from "../../../../../editor/common/services/editorWorker.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { CellEditType, CellUri } from "../../../notebook/common/notebookCommon.js";
import { INotebookEditorModelResolverService } from "../../../notebook/common/notebookEditorModelResolverService.js";
import { INotebookService } from "../../../notebook/common/notebookService.js";
import { emptySessionEntryDiff } from "../../common/editing/chatEditingService.js";
import { FileOperationType } from "./chatEditingOperations.js";
import { ChatEditingSnapshotTextModelContentProvider } from "./chatEditingTextModelContentProviders.js";
import { createSnapshot as createNotebookSnapshot, restoreSnapshot as restoreNotebookSnapshot } from "./notebook/chatEditingModifiedNotebookSnapshot.js";
const START_REQUEST_EPOCH = "$$start";
const STOP_ID_EPOCH_PREFIX = "__epoch_";
let ChatEditingCheckpointTimelineImpl = class {
  constructor(chatSessionResource, _delegate, _notebookEditorModelResolverService, _notebookService, _textModelService, _editorWorkerService, _configurationService) {
    this.chatSessionResource = chatSessionResource;
    this._delegate = _delegate;
    this._notebookEditorModelResolverService = _notebookEditorModelResolverService;
    this._notebookService = _notebookService;
    this._textModelService = _textModelService;
    this._editorWorkerService = _editorWorkerService;
    this._configurationService = _configurationService;
    this._epochCounter = 0;
    this._checkpoints = observableValue(this, []);
    this._currentEpoch = observableValue(this, 0);
    this._operations = observableValueOpts({ equalsFn: () => false }, []);
    // mutable
    this._fileBaselines = /* @__PURE__ */ new Map();
    // key: `${uri}::${requestId}`
    this._refCountedDiffs = /* @__PURE__ */ new Map();
    this._finalizedDiffCache = /* @__PURE__ */ new Map();
    /** Gets the checkpoint, if any, we can 'undo' to. */
    this._willUndoToCheckpoint = derived((reader) => {
      const currentEpoch = this._currentEpoch.read(reader);
      const checkpoints = this._checkpoints.read(reader);
      if (checkpoints.length < 2 || currentEpoch <= checkpoints[1].epoch) {
        return void 0;
      }
      const operations = this._operations.read(reader);
      const currentCheckpointIdx = findLastIdx(checkpoints, (cp) => cp.epoch < currentEpoch);
      const startOfRequest = currentCheckpointIdx === -1 ? void 0 : findLast(checkpoints, (cp) => cp.undoStopId === void 0, currentCheckpointIdx);
      const previousOperation = findLast(operations, (op) => op.epoch < currentEpoch);
      const previousCheckpoint = previousOperation && findLast(checkpoints, (cp) => cp.epoch < previousOperation.epoch);
      if (!startOfRequest) {
        return previousCheckpoint;
      }
      if (!previousCheckpoint) {
        return startOfRequest;
      }
      if (!operations.some((op) => op.epoch > startOfRequest.epoch && op.epoch < previousCheckpoint.epoch)) {
        return startOfRequest;
      }
      return previousCheckpoint.epoch > startOfRequest.epoch ? previousCheckpoint : startOfRequest;
    });
    this.canUndo = this._willUndoToCheckpoint.map((cp) => !!cp);
    /**
     * Gets the epoch we'll redo this. Unlike undo this doesn't only use checkpoints
     * because we could potentially redo to a 'tip' operation that's not checkpointed yet.
     */
    this._willRedoToEpoch = derived((reader) => {
      const currentEpoch = this._currentEpoch.read(reader);
      const operations = this._operations.read(reader);
      const checkpoints = this._checkpoints.read(reader);
      const maxEncounteredEpoch = Math.max(operations.at(-1)?.epoch || 0, checkpoints.at(-1)?.epoch || 0);
      if (currentEpoch > maxEncounteredEpoch) {
        return void 0;
      }
      const nextOperation = operations.find((op) => op.epoch >= currentEpoch);
      if (!nextOperation) {
        const nextRequestStart = checkpoints.find((cp) => cp.epoch >= currentEpoch && cp.undoStopId === void 0);
        if (!nextRequestStart) {
          return maxEncounteredEpoch + 1;
        }
        const requestAfter = checkpoints.find((cp) => cp.epoch > nextRequestStart.epoch && cp.undoStopId === void 0);
        return requestAfter ? requestAfter.epoch : maxEncounteredEpoch + 1;
      }
      const nextCheckpoint = checkpoints.find((op) => op.epoch > nextOperation.epoch);
      const currentCheckpoint = findLast(checkpoints, (cp) => cp.epoch < currentEpoch);
      if (currentCheckpoint && nextOperation && currentCheckpoint.requestId !== nextOperation.requestId) {
        const startOfNextRequestIdx = findLastIdx(checkpoints, (cp, i) => cp.undoStopId === void 0 && checkpoints[i - 1]?.requestId === currentCheckpoint.requestId);
        const startOfNextRequest = startOfNextRequestIdx === -1 ? void 0 : checkpoints[startOfNextRequestIdx];
        if (startOfNextRequest && nextOperation.requestId !== startOfNextRequest.requestId) {
          const requestAfterTheNext = findFirst(checkpoints, (op) => op.undoStopId === void 0, startOfNextRequestIdx + 1);
          if (requestAfterTheNext) {
            return requestAfterTheNext.epoch;
          }
        }
      }
      return Math.min(
        nextCheckpoint?.epoch || Infinity,
        maxEncounteredEpoch + 1
      );
    });
    this.canRedo = this._willRedoToEpoch.map((e) => !!e);
    this.requestDisablement = derivedOpts(
      { equalsFn: (a, b) => arraysEqual(a, b, objectsEqual) },
      (reader) => {
        const currentEpoch = this._currentEpoch.read(reader);
        const operations = this._operations.read(reader);
        const checkpoints = this._checkpoints.read(reader);
        const maxEncounteredEpoch = Math.max(operations.at(-1)?.epoch || 0, checkpoints.at(-1)?.epoch || 0);
        if (currentEpoch > maxEncounteredEpoch) {
          return [];
        }
        const lastAppliedOperation = findLast(operations, (op) => op.epoch < currentEpoch)?.epoch || 0;
        const lastAppliedRequest = findLast(checkpoints, (cp) => cp.epoch < currentEpoch && cp.undoStopId === void 0)?.epoch || 0;
        const stopDisablingAtEpoch = Math.max(lastAppliedOperation, lastAppliedRequest);
        const disablement = /* @__PURE__ */ new Map();
        for (let i = checkpoints.length - 1; i >= 0; i--) {
          const { undoStopId, requestId, epoch } = checkpoints[i];
          if (epoch <= stopDisablingAtEpoch) {
            break;
          }
          if (requestId) {
            disablement.set(requestId, undoStopId);
          }
        }
        return [...disablement].map(([requestId, afterUndoStop]) => ({ requestId, afterUndoStop }));
      }
    );
    this.createCheckpoint(void 0, void 0, "Initial State", "Starting point before any edits");
  }
  createCheckpoint(requestId, undoStopId, label, description) {
    const existingCheckpoints = this._checkpoints.get();
    const existing = existingCheckpoints.find((c) => c.undoStopId === undoStopId && c.requestId === requestId);
    if (existing) {
      return existing.checkpointId;
    }
    const { checkpoints, operations } = this._getVisibleOperationsAndCheckpoints();
    const checkpointId = generateUuid();
    const epoch = this.incrementEpoch();
    checkpoints.push({
      checkpointId,
      requestId,
      undoStopId,
      epoch,
      label,
      description
    });
    transaction((tx) => {
      this._checkpoints.set(checkpoints, tx);
      this._operations.set(operations, tx);
      this._currentEpoch.set(epoch + 1, tx);
    });
    return checkpointId;
  }
  async undoToLastCheckpoint() {
    const checkpoint = this._willUndoToCheckpoint.get();
    if (checkpoint) {
      await this.navigateToCheckpoint(checkpoint.checkpointId);
    }
  }
  async redoToNextCheckpoint() {
    const targetEpoch = this._willRedoToEpoch.get();
    if (targetEpoch) {
      await this._navigateToEpoch(targetEpoch);
    }
  }
  navigateToCheckpoint(checkpointId) {
    const targetCheckpoint = this._getCheckpoint(checkpointId);
    if (!targetCheckpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }
    if (targetCheckpoint.undoStopId === void 0) {
      return this._navigateToEpoch(targetCheckpoint.epoch + 1, targetCheckpoint.epoch);
    } else {
      return this._navigateToEpoch(targetCheckpoint.epoch + 1);
    }
  }
  getContentURIAtStop(requestId, fileURI, stopId) {
    return ChatEditingSnapshotTextModelContentProvider.getSnapshotFileURI(this.chatSessionResource, requestId, stopId, fileURI.path, fileURI.scheme, fileURI.authority);
  }
  async _navigateToEpoch(restoreToEpoch, navigateToEpoch = restoreToEpoch) {
    const currentEpoch = this._currentEpoch.get();
    if (currentEpoch !== restoreToEpoch) {
      const urisToRestore = await this._applyFileSystemOperations(currentEpoch, restoreToEpoch);
      await this._reconstructAllFileContents(restoreToEpoch, urisToRestore);
    }
    this._currentEpoch.set(navigateToEpoch, void 0);
  }
  _getCheckpoint(checkpointId) {
    return this._checkpoints.get().find((c) => c.checkpointId === checkpointId);
  }
  incrementEpoch() {
    return this._epochCounter++;
  }
  recordFileOperation(operation) {
    const { currentEpoch, checkpoints, operations } = this._getVisibleOperationsAndCheckpoints();
    if (operation.epoch < currentEpoch) {
      throw new Error(`Cannot record operation at epoch ${operation.epoch} when current epoch is ${currentEpoch}`);
    }
    operations.push(operation);
    transaction((tx) => {
      this._checkpoints.set(checkpoints, tx);
      this._operations.set(operations, tx);
      this._currentEpoch.set(operation.epoch + 1, tx);
    });
  }
  _getVisibleOperationsAndCheckpoints() {
    const currentEpoch = this._currentEpoch.get();
    const checkpoints = this._checkpoints.get();
    const operations = this._operations.get();
    return {
      currentEpoch,
      checkpoints: checkpoints.filter((c) => c.epoch < currentEpoch),
      operations: operations.filter((op) => op.epoch < currentEpoch)
    };
  }
  recordFileBaseline(baseline) {
    const key = this._getBaselineKey(baseline.uri, baseline.requestId);
    this._fileBaselines.set(key, baseline);
  }
  _getFileBaseline(uri, requestId) {
    const key = this._getBaselineKey(uri, requestId);
    return this._fileBaselines.get(key);
  }
  hasFileBaseline(uri, requestId) {
    const key = this._getBaselineKey(uri, requestId);
    return this._fileBaselines.has(key) || this._operations.get().some((op) => op.type === FileOperationType.Create && op.requestId === requestId && isEqual(uri, op.uri));
  }
  async getContentAtStop(requestId, contentURI, stopId) {
    let toEpoch;
    if (stopId?.startsWith(STOP_ID_EPOCH_PREFIX)) {
      toEpoch = Number(stopId.slice(STOP_ID_EPOCH_PREFIX.length));
    } else {
      toEpoch = this._checkpoints.get().find((c) => c.requestId === requestId && c.undoStopId === stopId)?.epoch;
    }
    const fileURI = this._getTimelineCanonicalUriForPath(contentURI);
    if (!toEpoch || !fileURI) {
      return "";
    }
    const baseline = await this._findBestBaselineForFile(fileURI, toEpoch, requestId);
    if (!baseline) {
      return "";
    }
    const operations = this._getFileOperationsInRange(fileURI, baseline.epoch, toEpoch);
    const replayed = await this._replayOperations(baseline, operations);
    return replayed.exists ? replayed.content : void 0;
  }
  _getTimelineCanonicalUriForPath(contentURI) {
    for (const it of [this._fileBaselines.values(), this._operations.get()]) {
      for (const thing of it) {
        if (thing.uri.path === contentURI.path) {
          return thing.uri;
        }
      }
    }
    return void 0;
  }
  /**
   * Creates a callback that is invoked when data at the stop changes. This
   * will not fire initially and may be debounced internally.
   */
  onDidChangeContentsAtStop(requestId, contentURI, stopId, callback) {
    if (!stopId || !stopId.startsWith(STOP_ID_EPOCH_PREFIX)) {
      return Disposable.None;
    }
    const target = Number(stopId.slice(STOP_ID_EPOCH_PREFIX.length));
    if (target <= this._epochCounter) {
      return Disposable.None;
    }
    const store = new DisposableStore();
    const scheduler = store.add(new ThrottledDelayer(500));
    store.add(Event.fromObservableLight(this._operations)(() => {
      scheduler.trigger(async () => {
        if (this._operations.get().at(-1)?.epoch >= target) {
          store.dispose();
        }
        const content = await this.getContentAtStop(requestId, contentURI, stopId);
        if (content !== void 0) {
          callback(content);
        }
      });
    }));
    return store;
  }
  _getCheckpointBeforeEpoch(epoch, reader) {
    return findLast(this._checkpoints.read(reader), (c) => c.epoch <= epoch);
  }
  async _reconstructFileState(uri, targetEpoch) {
    const targetCheckpoint = this._getCheckpointBeforeEpoch(targetEpoch);
    if (!targetCheckpoint) {
      throw new Error(`Checkpoint for epoch ${targetEpoch} not found`);
    }
    const baseline = await this._findBestBaselineForFile(uri, targetEpoch, targetCheckpoint.requestId || "");
    if (!baseline) {
      return {
        exists: false,
        uri
      };
    }
    const operations = this._getFileOperationsInRange(uri, baseline.epoch, targetEpoch);
    return this._replayOperations(baseline, operations);
  }
  getStateForPersistence() {
    return {
      checkpoints: this._checkpoints.get(),
      currentEpoch: this._currentEpoch.get(),
      fileBaselines: [...this._fileBaselines],
      operations: this._operations.get(),
      epochCounter: this._epochCounter
    };
  }
  restoreFromState(state, tx) {
    this._checkpoints.set(state.checkpoints, tx);
    this._currentEpoch.set(state.currentEpoch, tx);
    this._operations.set(state.operations.slice(), tx);
    this._epochCounter = state.epochCounter;
    this._fileBaselines.clear();
    for (const [key, baseline] of state.fileBaselines) {
      this._fileBaselines.set(key, baseline);
    }
  }
  getCheckpointIdForRequest(requestId, undoStopId) {
    const checkpoints = this._checkpoints.get();
    return checkpoints.find((c) => c.requestId === requestId && c.undoStopId === undoStopId)?.checkpointId;
  }
  async _reconstructAllFileContents(targetEpoch, filesToReconstruct) {
    await Promise.all(Array.from(filesToReconstruct).map(async (uri) => {
      const reconstructedState = await this._reconstructFileState(uri, targetEpoch);
      if (reconstructedState.exists) {
        await this._delegate.setContents(reconstructedState.uri, reconstructedState.content, reconstructedState.telemetryInfo);
      }
    }));
  }
  _getBaselineKey(uri, requestId) {
    return `${uri.toString()}::${requestId}`;
  }
  async _findBestBaselineForFile(uri, epoch, requestId) {
    let currentRequestId = requestId;
    const operations = this._operations.get();
    for (let i = operations.length - 1; i >= 0; i--) {
      const operation = operations[i];
      if (operation.epoch > epoch) {
        continue;
      }
      if (operation.type === FileOperationType.Create && isEqual(operation.uri, uri)) {
        return {
          uri: operation.uri,
          requestId: operation.requestId,
          content: operation.initialContent,
          epoch: operation.epoch,
          telemetryInfo: operation.telemetryInfo
        };
      }
      if (operation.type === FileOperationType.Rename && isEqual(operation.newUri, uri)) {
        const prev = await this._findBestBaselineForFile(operation.oldUri, operation.epoch, operation.requestId);
        if (!prev) {
          return void 0;
        }
        const operations2 = this._getFileOperationsInRange(operation.oldUri, prev.epoch, operation.epoch);
        const replayed = await this._replayOperations(prev, operations2);
        return {
          uri,
          epoch: operation.epoch,
          content: replayed.exists ? replayed.content : "",
          requestId: operation.requestId,
          telemetryInfo: prev.telemetryInfo,
          notebookViewType: replayed.exists ? replayed.notebookViewType : void 0
        };
      }
      if (currentRequestId && operation.requestId !== currentRequestId) {
        const baseline = this._getFileBaseline(uri, currentRequestId);
        if (baseline) {
          return baseline;
        }
      }
      currentRequestId = operation.requestId;
    }
    return this._getFileBaseline(uri, currentRequestId);
  }
  _getFileOperationsInRange(uri, fromEpoch, toEpoch) {
    return this._operations.get().filter((op) => {
      const cellUri = CellUri.parse(op.uri);
      return op.epoch >= fromEpoch && op.epoch < toEpoch && (isEqual(op.uri, uri) || cellUri && isEqual(cellUri.notebook, uri));
    }).sort((a, b) => a.epoch - b.epoch);
  }
  async _replayOperations(baseline, operations) {
    let currentState = {
      exists: true,
      content: baseline.content,
      uri: baseline.uri,
      telemetryInfo: baseline.telemetryInfo
    };
    if (baseline.notebookViewType) {
      currentState.notebook = await this._notebookEditorModelResolverService.createUntitledNotebookTextModel(baseline.notebookViewType);
      if (baseline.content) {
        restoreNotebookSnapshot(currentState.notebook, baseline.content);
      }
    }
    for (const operation of operations) {
      currentState = await this._applyOperationToState(currentState, operation, baseline.telemetryInfo);
    }
    if (currentState.exists && currentState.notebook) {
      const info = await this._notebookService.withNotebookDataProvider(currentState.notebook.viewType);
      currentState.content = createNotebookSnapshot(currentState.notebook, info.serializer.options, this._configurationService);
      currentState.notebook.dispose();
    }
    return currentState;
  }
  async _applyOperationToState(state, operation, telemetryInfo) {
    switch (operation.type) {
      case FileOperationType.Create: {
        if (state.exists && state.notebook) {
          state.notebook.dispose();
        }
        let notebook;
        if (operation.notebookViewType) {
          notebook = await this._notebookEditorModelResolverService.createUntitledNotebookTextModel(operation.notebookViewType);
          if (operation.initialContent) {
            restoreNotebookSnapshot(notebook, operation.initialContent);
          }
        }
        return {
          exists: true,
          content: operation.initialContent,
          uri: operation.uri,
          telemetryInfo,
          notebookViewType: operation.notebookViewType,
          notebook
        };
      }
      case FileOperationType.Delete:
        if (state.exists && state.notebook) {
          state.notebook.dispose();
        }
        return {
          exists: false,
          uri: operation.uri
        };
      case FileOperationType.Rename:
        return {
          ...state,
          uri: operation.newUri
        };
      case FileOperationType.TextEdit: {
        if (!state.exists) {
          throw new Error("Cannot apply text edits to non-existent file");
        }
        const nbCell = operation.cellIndex !== void 0 && state.notebook?.cells.at(operation.cellIndex);
        if (nbCell) {
          const newContent = this._applyTextEditsToContent(nbCell.getValue(), operation.edits);
          state.notebook.applyEdits([{
            editType: CellEditType.Replace,
            index: operation.cellIndex,
            count: 1,
            cells: [{ cellKind: nbCell.cellKind, language: nbCell.language, mime: nbCell.language, source: newContent, outputs: nbCell.outputs }]
          }], true, void 0, () => void 0, void 0);
          return state;
        }
        return {
          ...state,
          content: this._applyTextEditsToContent(state.content, operation.edits)
        };
      }
      case FileOperationType.NotebookEdit:
        if (!state.exists) {
          throw new Error("Cannot apply notebook edits to non-existent file");
        }
        if (!state.notebook) {
          throw new Error("Cannot apply notebook edits to non-notebook file");
        }
        state.notebook.applyEdits(operation.cellEdits.slice(), true, void 0, () => void 0, void 0);
        return state;
      default:
        assertNever(operation);
    }
  }
  async _applyFileSystemOperations(fromEpoch, toEpoch) {
    const isMovingForward = toEpoch > fromEpoch;
    const operations = this._operations.get().filter((op) => {
      if (isMovingForward) {
        return op.epoch >= fromEpoch && op.epoch < toEpoch;
      } else {
        return op.epoch < fromEpoch && op.epoch >= toEpoch;
      }
    }).sort((a, b) => isMovingForward ? a.epoch - b.epoch : b.epoch - a.epoch);
    const urisToRestore = new ResourceSet();
    for (const operation of operations) {
      await this._applyFileSystemOperation(operation, isMovingForward, urisToRestore);
    }
    return urisToRestore;
  }
  async _applyFileSystemOperation(operation, isMovingForward, urisToRestore) {
    switch (operation.type) {
      case FileOperationType.Create:
        if (isMovingForward) {
          await this._delegate.createFile(operation.uri, operation.initialContent);
          urisToRestore.add(operation.uri);
        } else {
          await this._delegate.deleteFile(operation.uri);
          urisToRestore.delete(operation.uri);
        }
        break;
      case FileOperationType.Delete:
        if (isMovingForward) {
          await this._delegate.deleteFile(operation.uri);
          urisToRestore.delete(operation.uri);
        } else {
          await this._delegate.createFile(operation.uri, operation.finalContent);
          urisToRestore.add(operation.uri);
        }
        break;
      case FileOperationType.Rename:
        if (isMovingForward) {
          await this._delegate.renameFile(operation.oldUri, operation.newUri);
          urisToRestore.delete(operation.oldUri);
          urisToRestore.add(operation.newUri);
        } else {
          await this._delegate.renameFile(operation.newUri, operation.oldUri);
          urisToRestore.delete(operation.newUri);
          urisToRestore.add(operation.oldUri);
        }
        break;
      // Text and notebook edits don't affect file system structure
      case FileOperationType.TextEdit:
      case FileOperationType.NotebookEdit:
        urisToRestore.add(CellUri.parse(operation.uri)?.notebook ?? operation.uri);
        break;
      default:
        assertNever(operation);
    }
  }
  _applyTextEditsToContent(content, edits) {
    const { textBuffer, disposable } = createTextBuffer(content, DefaultEndOfLine.LF);
    try {
      textBuffer.applyEdits(edits.map(
        (edit) => new ValidAnnotatedEditOperation(null, Range.lift(edit.range), edit.text, false, false, false)
      ), false, false);
      const fullRange = textBuffer.getRangeAt(0, textBuffer.getLength());
      return textBuffer.getValueInRange(fullRange, EndOfLinePreference.TextDefined);
    } finally {
      disposable.dispose();
    }
  }
  getEntryDiffBetweenStops(uri, requestId, stopId) {
    const epochs = derivedOpts({ equalsFn: (a, b) => a.start === b.start && a.end === b.end }, (reader) => {
      const checkpoints = this._checkpoints.read(reader);
      const startIndex = checkpoints.findIndex((c) => c.requestId === requestId && c.undoStopId === stopId);
      return { start: checkpoints[startIndex], end: checkpoints[startIndex + 1] };
    });
    return this._getEntryDiffBetweenEpochs(uri, `s\0${requestId}\0${stopId}`, epochs);
  }
  /** Gets the epoch bounds of the request. If stopRequestId is undefined, gets ONLY the single request's bounds */
  _getRequestEpochBounds(startRequestId, stopRequestId) {
    return derivedOpts({ equalsFn: (a, b) => a.start === b.start && a.end === b.end }, (reader) => {
      const checkpoints = this._checkpoints.read(reader);
      const startIndex = checkpoints.findIndex((c) => c.requestId === startRequestId);
      const start = startIndex === -1 ? checkpoints[0] : checkpoints[startIndex];
      let end;
      if (stopRequestId === void 0) {
        end = findFirst(checkpoints, (c) => c.requestId !== startRequestId, startIndex + 1);
      } else {
        end = checkpoints.find((c) => c.requestId === stopRequestId) || findFirst(checkpoints, (c) => c.requestId !== startRequestId, startIndex + 1) || checkpoints[checkpoints.length - 1];
      }
      return { start, end };
    });
  }
  getEntryDiffBetweenRequests(uri, startRequestId, stopRequestId) {
    return this._getEntryDiffBetweenEpochs(uri, `r\0${startRequestId}\0${stopRequestId}`, this._getRequestEpochBounds(startRequestId, stopRequestId));
  }
  _getEntryDiffBetweenEpochs(uri, cacheKey, epochs) {
    const key = `${uri.toString()}\0${cacheKey}`;
    const cached = this._finalizedDiffCache.get(key);
    if (cached) {
      return constObservable(cached);
    }
    let obs = this._refCountedDiffs.get(key);
    if (!obs) {
      obs = this._getEntryDiffBetweenEpochsInner(
        uri,
        key,
        epochs,
        () => this._refCountedDiffs.delete(key)
      );
      this._refCountedDiffs.set(key, obs);
    }
    return obs;
  }
  _getEntryDiffBetweenEpochsInner(uri, cacheKey, epochs, onLastObserverRemoved) {
    const modelRefsPromise = derived(this, (reader) => {
      const { start, end } = epochs.read(reader);
      if (!start) {
        return void 0;
      }
      const store = reader.store.add(new DisposableStore());
      const originalURI = this.getContentURIAtStop(start.requestId || START_REQUEST_EPOCH, uri, STOP_ID_EPOCH_PREFIX + start.epoch);
      const modifiedURI = this.getContentURIAtStop(end?.requestId || start.requestId || START_REQUEST_EPOCH, uri, STOP_ID_EPOCH_PREFIX + (end?.epoch || Number.MAX_SAFE_INTEGER));
      const promise = Promise.all([
        this._textModelService.createModelReference(originalURI),
        this._textModelService.createModelReference(modifiedURI)
      ]).then((refs) => {
        if (store.isDisposed) {
          refs.forEach((r) => r.dispose());
        } else {
          refs.forEach((r) => store.add(r));
        }
        return {
          refs: refs.map((r) => ({
            model: r.object.textEditorModel,
            onChange: observableSignalFromEvent(this, r.object.textEditorModel.onDidChangeContent.bind(r.object.textEditorModel))
          })),
          isFinal: !!end
        };
      }).catch((error) => {
        return { refs: [], isFinal: true, error };
      });
      return {
        originalURI,
        modifiedURI,
        promise: new ObservablePromise(promise)
      };
    });
    const diff = derived((reader) => {
      const modelsData = modelRefsPromise.read(reader);
      if (!modelsData) {
        return;
      }
      const { originalURI, modifiedURI, promise } = modelsData;
      const promiseData = promise?.promiseResult.read(reader);
      if (!promiseData?.data) {
        return { originalURI, modifiedURI, promise: void 0 };
      }
      const { refs, isFinal, error } = promiseData.data;
      if (error) {
        return { originalURI, modifiedURI, promise: new ObservablePromise(Promise.resolve(emptySessionEntryDiff(originalURI, modifiedURI))) };
      }
      refs.forEach((m) => m.onChange.read(reader));
      return { originalURI, modifiedURI, promise: new ObservablePromise(this._computeDiff(originalURI, modifiedURI, !!isFinal)) };
    });
    return derivedOpts({ onLastObserverRemoved }, (reader) => {
      const result = diff.read(reader);
      if (!result) {
        return void 0;
      }
      const promised = result.promise?.promiseResult.read(reader);
      if (promised?.data) {
        if (promised.data.isFinal) {
          this._finalizedDiffCache.set(cacheKey, promised.data);
        }
        return promised.data;
      }
      if (promised?.error) {
        return emptySessionEntryDiff(result.originalURI, result.modifiedURI);
      }
      return { ...emptySessionEntryDiff(result.originalURI, result.modifiedURI), isBusy: true };
    });
  }
  _computeDiff(originalUri, modifiedUri, isFinal) {
    return this._editorWorkerService.computeDiff(
      originalUri,
      modifiedUri,
      { ignoreTrimWhitespace: false, computeMoves: false, maxComputationTimeMs: 3e3 },
      "advanced"
    ).then((diff) => {
      const entryDiff = {
        originalURI: originalUri,
        modifiedURI: modifiedUri,
        identical: !!diff?.identical,
        isFinal,
        quitEarly: !diff || diff.quitEarly,
        added: 0,
        removed: 0,
        isBusy: false
      };
      if (diff) {
        for (const change of diff.changes) {
          entryDiff.removed += change.original.endLineNumberExclusive - change.original.startLineNumber;
          entryDiff.added += change.modified.endLineNumberExclusive - change.modified.startLineNumber;
        }
      }
      return entryDiff;
    });
  }
  hasEditsInRequest(requestId, reader) {
    for (const value of this._fileBaselines.values()) {
      if (value.requestId === requestId) {
        return true;
      }
    }
    for (const operation of this._operations.read(reader)) {
      if (operation.requestId === requestId) {
        return true;
      }
    }
    return false;
  }
  getDiffsForFilesInRequest(requestId) {
    const boundsObservable = this._getRequestEpochBounds(requestId);
    const startEpochs = derivedOpts({ equalsFn: mapsStrictEqualIgnoreOrder }, (reader) => {
      const uris = new ResourceMap();
      for (const value of this._fileBaselines.values()) {
        if (value.requestId === requestId) {
          uris.set(value.uri, value.epoch);
        }
      }
      const bounds = boundsObservable.read(reader);
      for (const operation of this._operations.read(reader)) {
        if (operation.epoch < bounds.start.epoch) {
          continue;
        }
        if (bounds.end && operation.epoch >= bounds.end.epoch) {
          break;
        }
        if (operation.type === FileOperationType.Create) {
          uris.set(operation.uri, 0);
        }
      }
      return uris;
    });
    return this._getDiffsForFilesAtEpochs(startEpochs, boundsObservable.map((b) => b.end));
  }
  _getDiffsForFilesAtEpochs(startEpochs, endCheckpointObs) {
    const prevDiffs = new ResourceMap();
    let prevEndCheckpoint = void 0;
    const perFileDiffs = derived(this, (reader) => {
      const checkpoints = this._checkpoints.read(reader);
      const firstCheckpoint = checkpoints[0];
      if (!firstCheckpoint) {
        return [];
      }
      const endCheckpoint = endCheckpointObs.read(reader);
      if (endCheckpoint !== prevEndCheckpoint) {
        prevDiffs.clear();
        prevEndCheckpoint = endCheckpoint;
      }
      const uris = startEpochs.read(reader);
      const diffs = [];
      for (const [uri, epoch] of uris) {
        const obs = prevDiffs.get(uri) ?? this._getEntryDiffBetweenEpochs(
          uri,
          `e\0${epoch}\0${endCheckpoint?.epoch}`,
          constObservable({ start: checkpoints.findLast((cp) => cp.epoch <= epoch) || firstCheckpoint, end: endCheckpoint })
        );
        prevDiffs.set(uri, obs);
        diffs.push(obs);
      }
      return diffs;
    });
    return perFileDiffs.map((diffs, reader) => {
      return diffs.flatMap((d) => d.read(reader)).filter(isDefined);
    });
  }
  getDiffsForFilesInSession() {
    const startEpochs = derivedOpts({ equalsFn: mapsStrictEqualIgnoreOrder }, (reader) => {
      const uris = new ResourceMap();
      for (const baseline of this._fileBaselines.values()) {
        uris.set(baseline.uri, Math.min(baseline.epoch, uris.get(baseline.uri) ?? Number.MAX_SAFE_INTEGER));
      }
      for (const operation of this._operations.read(reader)) {
        if (operation.type === FileOperationType.Create) {
          uris.set(operation.uri, 0);
        }
      }
      return uris;
    });
    return this._getDiffsForFilesAtEpochs(startEpochs, constObservable(void 0));
  }
  getDiffForSession() {
    const fileDiffs = this.getDiffsForFilesInSession();
    return derived((reader) => {
      const diffs = fileDiffs.read(reader);
      let added = 0;
      let removed = 0;
      for (const diff of diffs) {
        added += diff.added;
        removed += diff.removed;
      }
      return { added, removed };
    });
  }
};
ChatEditingCheckpointTimelineImpl = __decorateClass([
  __decorateParam(2, INotebookEditorModelResolverService),
  __decorateParam(3, INotebookService),
  __decorateParam(4, ITextModelService),
  __decorateParam(5, IEditorWorkerService),
  __decorateParam(6, IConfigurationService)
], ChatEditingCheckpointTimelineImpl);
export {
  ChatEditingCheckpointTimelineImpl
};
