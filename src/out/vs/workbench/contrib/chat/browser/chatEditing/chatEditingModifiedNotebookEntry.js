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
import { streamToBuffer } from "../../../../../base/common/buffer.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { StringSHA1 } from "../../../../../base/common/hash.js";
import { DisposableStore, thenRegisterOrDispose } from "../../../../../base/common/lifecycle.js";
import { ResourceMap, ResourceSet } from "../../../../../base/common/map.js";
import { Schemas } from "../../../../../base/common/network.js";
import { autorun, ObservablePromise, observableValue, transaction } from "../../../../../base/common/observable.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { assertType } from "../../../../../base/common/types.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { LineRange } from "../../../../../editor/common/core/ranges/lineRange.js";
import { nullDocumentDiff } from "../../../../../editor/common/diff/documentDiffProvider.js";
import { DetailedLineRangeMapping, RangeMapping } from "../../../../../editor/common/diff/rangeMapping.js";
import { TextEdit } from "../../../../../editor/common/languages.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { localize } from "../../../../../nls.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IUndoRedoService, UndoRedoElementType } from "../../../../../platform/undoRedo/common/undoRedo.js";
import { SaveReason } from "../../../../common/editor.js";
import { IFilesConfigurationService } from "../../../../services/filesConfiguration/common/filesConfigurationService.js";
import { SnapshotContext } from "../../../../services/workingCopy/common/fileWorkingCopy.js";
import { IAiEditTelemetryService } from "../../../editTelemetry/browser/telemetry/aiEditTelemetry/aiEditTelemetryService.js";
import { NotebookTextDiffEditor } from "../../../notebook/browser/diff/notebookDiffEditor.js";
import { getNotebookEditorFromEditorPane } from "../../../notebook/browser/notebookBrowser.js";
import { CellEditType, NotebookCellsChangeType, NotebookSetting } from "../../../notebook/common/notebookCommon.js";
import { computeDiff } from "../../../notebook/common/notebookDiff.js";
import { INotebookEditorModelResolverService } from "../../../notebook/common/notebookEditorModelResolverService.js";
import { INotebookLoggingService } from "../../../notebook/common/notebookLoggingService.js";
import { INotebookService } from "../../../notebook/common/notebookService.js";
import { INotebookEditorWorkerService } from "../../../notebook/common/services/notebookWorkerService.js";
import { IChatService } from "../../common/chatService/chatService.js";
import { ModifiedFileEntryState } from "../../common/editing/chatEditingService.js";
import { AbstractChatEditingModifiedFileEntry } from "./chatEditingModifiedFileEntry.js";
import { createSnapshot, deserializeSnapshot, getNotebookSnapshotFileURI, restoreSnapshot, SnapshotComparer } from "./notebook/chatEditingModifiedNotebookSnapshot.js";
import { ChatEditingNewNotebookContentEdits } from "./notebook/chatEditingNewNotebookContentEdits.js";
import { ChatEditingNotebookCellEntry } from "./notebook/chatEditingNotebookCellEntry.js";
import { ChatEditingNotebookDiffEditorIntegration, ChatEditingNotebookEditorIntegration } from "./notebook/chatEditingNotebookEditorIntegration.js";
import { ChatEditingNotebookFileSystemProvider } from "./notebook/chatEditingNotebookFileSystemProvider.js";
import { adjustCellDiffAndOriginalModelBasedOnCellAddDelete, adjustCellDiffAndOriginalModelBasedOnCellMovements, adjustCellDiffForKeepingAnInsertedCell, adjustCellDiffForRevertingADeletedCell, adjustCellDiffForRevertingAnInsertedCell, calculateNotebookRewriteRatio, getCorrespondingOriginalCellIndex, isTransientIPyNbExtensionEvent } from "./notebook/helpers.js";
import { countChanges, sortCellChanges } from "./notebook/notebookCellChanges.js";
const SnapshotLanguageId = "VSCodeChatNotebookSnapshotLanguage";
let ChatEditingModifiedNotebookEntry = class extends AbstractChatEditingModifiedFileEntry {
  constructor(modifiedResourceRef, originalResourceRef, _multiDiffEntryDelegate, transientOptions, telemetryInfo, kind, initialContent, configurationService, fileConfigService, chatService, fileService, instantiationService, textModelService, modelService, undoRedoService, notebookEditorWorkerService, loggingService, notebookResolver, aiEditTelemetryService) {
    super(modifiedResourceRef.object.notebook.uri, telemetryInfo, kind, configurationService, fileConfigService, chatService, fileService, undoRedoService, instantiationService, aiEditTelemetryService);
    this.modifiedResourceRef = modifiedResourceRef;
    this._multiDiffEntryDelegate = _multiDiffEntryDelegate;
    this.transientOptions = transientOptions;
    this.configurationService = configurationService;
    this.textModelService = textModelService;
    this.modelService = modelService;
    this.notebookEditorWorkerService = notebookEditorWorkerService;
    this.loggingService = loggingService;
    this.notebookResolver = notebookResolver;
    /**
     * Whether we're still generating diffs from a response.
     */
    this._isProcessingResponse = observableValue("isProcessingResponse", false);
    this._isEditFromUs = false;
    /**
     * Whether all edits are from us, e.g. is possible a user has made edits, then this will be false.
     */
    this._allEditsAreFromUs = true;
    this._changesCount = observableValue(this, 0);
    this.changesCount = this._changesCount;
    this.cellEntryMap = new ResourceMap();
    this.modifiedToOriginalCell = new ResourceMap();
    this._cellsDiffInfo = observableValue("diffInfo", []);
    /**
     * List of Cell URIs that are edited,
     * Will be cleared once all edits have been accepted.
     * I.e. this will only contain URIS while acceptAgentEdits is being called & before `isLastEdit` is sent.
     * I.e. this is populated only when edits are being streamed.
     */
    this.editedCells = new ResourceSet();
    this.computeRequestId = 0;
    this.cellTextModelMap = new ResourceMap();
    this.initialContentComparer = new SnapshotComparer(initialContent);
    this.modifiedModel = this._register(modifiedResourceRef).object.notebook;
    this.originalModel = this._register(originalResourceRef).object.notebook;
    this.originalURI = this.originalModel.uri;
    this.initialContent = initialContent;
    this.initializeModelsFromDiff();
    this._register(this.modifiedModel.onDidChangeContent(this.mirrorNotebookEdits, this));
  }
  static {
    this.NewModelCounter = 0;
  }
  get isProcessingResponse() {
    return this._isProcessingResponse;
  }
  get cellsDiffInfo() {
    return this._cellsDiffInfo;
  }
  get viewType() {
    return this.modifiedModel.viewType;
  }
  static async create(uri, _multiDiffEntryDelegate, telemetryInfo, chatKind, initialContent, instantiationService) {
    return instantiationService.invokeFunction(async (accessor) => {
      const notebookService = accessor.get(INotebookService);
      const resolver = accessor.get(INotebookEditorModelResolverService);
      const configurationServie = accessor.get(IConfigurationService);
      const resourceRef = await resolver.resolve(uri);
      const notebook = resourceRef.object.notebook;
      const originalUri = getNotebookSnapshotFileURI(telemetryInfo.sessionResource, telemetryInfo.requestId, generateUuid(), notebook.uri.scheme === Schemas.untitled ? `/${notebook.uri.path}` : notebook.uri.path, notebook.viewType);
      const [options, buffer] = await Promise.all([
        notebookService.withNotebookDataProvider(resourceRef.object.notebook.notebookType),
        notebookService.createNotebookTextDocumentSnapshot(notebook.uri, SnapshotContext.Backup, CancellationToken.None).then((s) => streamToBuffer(s))
      ]);
      const disposables = new DisposableStore();
      disposables.add(ChatEditingNotebookFileSystemProvider.registerFile(originalUri, buffer));
      const originalRef = await resolver.resolve(originalUri, notebook.viewType);
      if (initialContent !== void 0) {
        try {
          restoreSnapshot(originalRef.object.notebook, initialContent);
        } catch (ex) {
          console.error(`Error restoring snapshot: ${initialContent}`, ex);
          initialContent = createSnapshot(notebook, options.serializer.options, configurationServie);
        }
      } else {
        initialContent = createSnapshot(notebook, options.serializer.options, configurationServie);
        restoreSnapshot(originalRef.object.notebook, initialContent);
        const edits = [];
        notebook.cells.forEach((cell, index) => {
          const internalId = generateCellHash(cell.uri);
          edits.push({ editType: CellEditType.PartialInternalMetadata, index, internalMetadata: { internalId } });
        });
        resourceRef.object.notebook.applyEdits(edits, true, void 0, () => void 0, void 0, false);
        originalRef.object.notebook.applyEdits(edits, true, void 0, () => void 0, void 0, false);
      }
      const instance = instantiationService.createInstance(ChatEditingModifiedNotebookEntry, resourceRef, originalRef, _multiDiffEntryDelegate, options.serializer.options, telemetryInfo, chatKind, initialContent);
      instance._register(disposables);
      return instance;
    });
  }
  static canHandleSnapshotContent(initialContent) {
    if (!initialContent) {
      return false;
    }
    try {
      deserializeSnapshot(initialContent);
      return true;
    } catch (ex) {
      return false;
    }
  }
  static canHandleSnapshot(snapshot) {
    if (snapshot.languageId === SnapshotLanguageId && ChatEditingModifiedNotebookEntry.canHandleSnapshotContent(snapshot.current)) {
      return true;
    }
    return false;
  }
  initializeModelsFromDiffImpl(cellsDiffInfo) {
    this.cellEntryMap.forEach((entry) => entry.dispose());
    this.cellEntryMap.clear();
    const diffs = cellsDiffInfo.map((cellDiff, i) => {
      switch (cellDiff.type) {
        case "delete":
          return this.createDeleteCellDiffInfo(cellDiff.originalCellIndex);
        case "insert":
          return this.createInsertedCellDiffInfo(cellDiff.modifiedCellIndex);
        default:
          return this.createModifiedCellDiffInfo(cellDiff.modifiedCellIndex, cellDiff.originalCellIndex);
      }
    });
    this._cellsDiffInfo.set(diffs, void 0);
    this._changesCount.set(countChanges(diffs), void 0);
  }
  getIndexOfCellHandle(handle) {
    return this.modifiedModel.cells.findIndex((c) => c.handle === handle);
  }
  async initializeModelsFromDiff() {
    const id = ++this.computeRequestId;
    if (this._areOriginalAndModifiedIdenticalImpl()) {
      const cellsDiffInfo2 = this.modifiedModel.cells.map((_, index) => {
        return { type: "unchanged", originalCellIndex: index, modifiedCellIndex: index };
      });
      this.initializeModelsFromDiffImpl(cellsDiffInfo2);
      return;
    }
    const cellsDiffInfo = [];
    try {
      this._isProcessingResponse.set(true, void 0);
      const notebookDiff = await this.notebookEditorWorkerService.computeDiff(this.originalURI, this.modifiedURI);
      if (id !== this.computeRequestId || this._store.isDisposed) {
        return;
      }
      const result = computeDiff(this.originalModel, this.modifiedModel, notebookDiff);
      if (result.cellDiffInfo.length) {
        cellsDiffInfo.push(...result.cellDiffInfo);
      }
    } catch (ex) {
      this.loggingService.error("Notebook Chat", "Error computing diff:\n" + ex);
    } finally {
      this._isProcessingResponse.set(false, void 0);
    }
    this.initializeModelsFromDiffImpl(cellsDiffInfo);
  }
  updateCellDiffInfo(cellsDiffInfo, transcation) {
    this._cellsDiffInfo.set(sortCellChanges(cellsDiffInfo), transcation);
    this._changesCount.set(countChanges(cellsDiffInfo), transcation);
  }
  mirrorNotebookEdits(e) {
    if (this._isEditFromUs || this._isExternalEditInProgress || Array.from(this.cellEntryMap.values()).some((entry) => entry.isEditFromUs)) {
      return;
    }
    let didResetToOriginalContent = this.initialContentComparer.isEqual(this.modifiedModel);
    const currentState = this._stateObs.get();
    if (currentState === ModifiedFileEntryState.Modified && didResetToOriginalContent) {
      this._stateObs.set(ModifiedFileEntryState.Rejected, void 0);
      this.updateCellDiffInfo([], void 0);
      this.initializeModelsFromDiff();
      this._notifySessionAction("rejected");
      return;
    }
    if (!e.rawEvents.length) {
      return;
    }
    if (currentState === ModifiedFileEntryState.Rejected) {
      return;
    }
    if (isTransientIPyNbExtensionEvent(this.modifiedModel.notebookType, e)) {
      return;
    }
    this._allEditsAreFromUs = false;
    this._userEditScheduler.schedule();
    for (const event of e.rawEvents.filter((event2) => event2.kind !== NotebookCellsChangeType.ChangeCellContent)) {
      switch (event.kind) {
        case NotebookCellsChangeType.ChangeDocumentMetadata: {
          const edit = {
            editType: CellEditType.DocumentMetadata,
            metadata: this.modifiedModel.metadata
          };
          this.originalModel.applyEdits([edit], true, void 0, () => void 0, void 0, false);
          break;
        }
        case NotebookCellsChangeType.ModelChange: {
          let cellDiffs = sortCellChanges(this._cellsDiffInfo.get());
          this._applyEditsSync(() => {
            event.changes.forEach((change) => {
              change[2].forEach((cell, i) => {
                if (cell.internalMetadata.internalId) {
                  return;
                }
                const index = change[0] + i;
                const internalId = generateCellHash(cell.uri);
                const edits = [{ editType: CellEditType.PartialInternalMetadata, index, internalMetadata: { internalId } }];
                this.modifiedModel.applyEdits(edits, true, void 0, () => void 0, void 0, false);
                cell.internalMetadata ??= {};
                cell.internalMetadata.internalId = internalId;
              });
            });
          });
          event.changes.forEach((change) => {
            cellDiffs = adjustCellDiffAndOriginalModelBasedOnCellAddDelete(
              change,
              cellDiffs,
              this.modifiedModel.cells.length,
              this.originalModel.cells.length,
              this.originalModel.applyEdits.bind(this.originalModel),
              this.createModifiedCellDiffInfo.bind(this)
            );
          });
          this.updateCellDiffInfo(cellDiffs, void 0);
          this.disposeDeletedCellEntries();
          break;
        }
        case NotebookCellsChangeType.ChangeCellLanguage: {
          const index = getCorrespondingOriginalCellIndex(event.index, this._cellsDiffInfo.get());
          if (typeof index === "number") {
            const edit = {
              editType: CellEditType.CellLanguage,
              index,
              language: event.language
            };
            this.originalModel.applyEdits([edit], true, void 0, () => void 0, void 0, false);
          }
          break;
        }
        case NotebookCellsChangeType.ChangeCellMetadata: {
          const index = getCorrespondingOriginalCellIndex(event.index, this._cellsDiffInfo.get());
          if (typeof index === "number") {
            const edit = {
              editType: CellEditType.Metadata,
              index,
              metadata: event.metadata
            };
            this.originalModel.applyEdits([edit], true, void 0, () => void 0, void 0, false);
          }
          break;
        }
        case NotebookCellsChangeType.ChangeCellMime:
          break;
        case NotebookCellsChangeType.ChangeCellInternalMetadata: {
          const index = getCorrespondingOriginalCellIndex(event.index, this._cellsDiffInfo.get());
          if (typeof index === "number") {
            const edit = {
              editType: CellEditType.PartialInternalMetadata,
              index,
              internalMetadata: event.internalMetadata
            };
            this.originalModel.applyEdits([edit], true, void 0, () => void 0, void 0, false);
          }
          break;
        }
        case NotebookCellsChangeType.Output: {
          const index = getCorrespondingOriginalCellIndex(event.index, this._cellsDiffInfo.get());
          if (typeof index === "number") {
            const edit = {
              editType: CellEditType.Output,
              index,
              append: event.append,
              outputs: event.outputs
            };
            this.originalModel.applyEdits([edit], true, void 0, () => void 0, void 0, false);
          }
          break;
        }
        case NotebookCellsChangeType.OutputItem: {
          break;
        }
        case NotebookCellsChangeType.Move: {
          const result = adjustCellDiffAndOriginalModelBasedOnCellMovements(event, this._cellsDiffInfo.get().slice());
          if (result) {
            this.originalModel.applyEdits(result[1], true, void 0, () => void 0, void 0, false);
            this._cellsDiffInfo.set(result[0], void 0);
          }
          break;
        }
        default: {
          break;
        }
      }
    }
    didResetToOriginalContent = this.initialContentComparer.isEqual(this.modifiedModel);
    if (currentState === ModifiedFileEntryState.Modified && didResetToOriginalContent) {
      this._stateObs.set(ModifiedFileEntryState.Rejected, void 0);
      this.updateCellDiffInfo([], void 0);
      this.initializeModelsFromDiff();
      return;
    }
  }
  async _doAccept() {
    this.updateCellDiffInfo([], void 0);
    const snapshot = createSnapshot(this.modifiedModel, this.transientOptions, this.configurationService);
    restoreSnapshot(this.originalModel, snapshot);
    this.initializeModelsFromDiff();
    await this._collapse(void 0);
    const config = this._fileConfigService.getAutoSaveConfiguration(this.modifiedURI);
    if (this.modifiedModel.uri.scheme !== Schemas.untitled && (!config.autoSave || !this.notebookResolver.isDirty(this.modifiedURI))) {
      await this._applyEdits(async () => {
        try {
          await this.modifiedResourceRef.object.save({
            reason: SaveReason.EXPLICIT,
            force: true
          });
        } catch {
        }
      });
    }
  }
  async _doReject() {
    this.updateCellDiffInfo([], void 0);
    if (this.createdInRequestId === this._telemetryInfo.requestId) {
      await this._applyEdits(async () => {
        await this.modifiedResourceRef.object.revert({ soft: true });
        await this._fileService.del(this.modifiedURI);
      });
      this._onDidDelete.fire();
    } else {
      await this._applyEdits(async () => {
        const snapshot = createSnapshot(this.originalModel, this.transientOptions, this.configurationService);
        this.restoreSnapshotInModifiedModel(snapshot);
        if (this._allEditsAreFromUs && Array.from(this.cellEntryMap.values()).every((entry) => entry.allEditsAreFromUs)) {
          await this.modifiedResourceRef.object.save({ reason: SaveReason.EXPLICIT, skipSaveParticipants: true });
        }
      });
      this.initializeModelsFromDiff();
      await this._collapse(void 0);
    }
  }
  async _collapse(transaction2) {
    this._multiDiffEntryDelegate.collapse(transaction2);
  }
  _createEditorIntegration(editor) {
    const notebookEditor = getNotebookEditorFromEditorPane(editor);
    if (!notebookEditor && editor.getId() === NotebookTextDiffEditor.ID) {
      const diffEditor = editor.getControl();
      return this._instantiationService.createInstance(ChatEditingNotebookDiffEditorIntegration, diffEditor, this._cellsDiffInfo);
    }
    assertType(notebookEditor);
    return this._instantiationService.createInstance(ChatEditingNotebookEditorIntegration, this, editor, this.modifiedModel, this.originalModel, this._cellsDiffInfo);
  }
  _resetEditsState(tx) {
    super._resetEditsState(tx);
    this.cellEntryMap.forEach((entry) => !entry.isDisposed && entry.clearCurrentEditLineDecoration());
  }
  _createUndoRedoElement(response) {
    const request = response.session.getRequests().find((req) => req.id === response.requestId);
    const label = request?.message.text ? localize("chatNotebookEdit1", "Chat Edit: '{0}'", request.message.text) : localize("chatNotebookEdit2", "Chat Edit");
    const transientOptions = this.transientOptions;
    const outputSizeLimit = this.configurationService.getValue(NotebookSetting.outputBackupSizeLimit) * 1024;
    let initial = createSnapshot(this.modifiedModel, transientOptions, outputSizeLimit);
    let last = "";
    let redoState = ModifiedFileEntryState.Rejected;
    return {
      type: UndoRedoElementType.Resource,
      resource: this.modifiedURI,
      label,
      code: "chat.edit",
      confirmBeforeUndo: false,
      undo: async () => {
        last = createSnapshot(this.modifiedModel, transientOptions, outputSizeLimit);
        this._isEditFromUs = true;
        try {
          restoreSnapshot(this.modifiedModel, initial);
          restoreSnapshot(this.originalModel, initial);
        } finally {
          this._isEditFromUs = false;
        }
        redoState = this._stateObs.get() === ModifiedFileEntryState.Accepted ? ModifiedFileEntryState.Accepted : ModifiedFileEntryState.Rejected;
        this._stateObs.set(ModifiedFileEntryState.Rejected, void 0);
        this.updateCellDiffInfo([], void 0);
        this.initializeModelsFromDiff();
        this._notifySessionAction("userModified");
      },
      redo: async () => {
        initial = createSnapshot(this.modifiedModel, transientOptions, outputSizeLimit);
        this._isEditFromUs = true;
        try {
          restoreSnapshot(this.modifiedModel, last);
          restoreSnapshot(this.originalModel, last);
        } finally {
          this._isEditFromUs = false;
        }
        this._stateObs.set(redoState, void 0);
        this.updateCellDiffInfo([], void 0);
        this.initializeModelsFromDiff();
        this._notifySessionAction("userModified");
      }
    };
  }
  async _areOriginalAndModifiedIdentical() {
    return this._areOriginalAndModifiedIdenticalImpl();
  }
  _areOriginalAndModifiedIdenticalImpl() {
    const snapshot = createSnapshot(this.originalModel, this.transientOptions, this.configurationService);
    return new SnapshotComparer(snapshot).isEqual(this.modifiedModel);
  }
  async acceptAgentEdits(resource, edits, isLastEdits, responseModel) {
    const isCellUri = resource.scheme === Schemas.vscodeNotebookCell;
    const cell = isCellUri && this.modifiedModel.cells.find((cell2) => isEqual(cell2.uri, resource));
    let cellEntry;
    if (cell) {
      const index = this.modifiedModel.cells.indexOf(cell);
      const entry = this._cellsDiffInfo.get().slice().find((entry2) => entry2.modifiedCellIndex === index);
      if (!entry) {
        console.error("Original cell model not found");
        return;
      }
      cellEntry = this.getOrCreateModifiedTextFileEntryForCell(cell, await entry.modifiedModel.promise, await entry.originalModel.promise);
    }
    const finishPreviousCells = async () => {
      await Promise.all(Array.from(this.editedCells).map(async (uri) => {
        const cell2 = this.modifiedModel.cells.find((cell3) => isEqual(cell3.uri, uri));
        const cellEntry2 = cell2 && this.cellEntryMap.get(cell2.uri);
        await cellEntry2?.acceptAgentEdits([], true, responseModel);
      }));
      this.editedCells.clear();
    };
    await this._applyEdits(async () => {
      await Promise.all(edits.map(async (edit, idx) => {
        const last = isLastEdits && idx === edits.length - 1;
        if (TextEdit.isTextEdit(edit)) {
          if (isEqual(resource, this.modifiedModel.uri)) {
            this.newNotebookEditGenerator ??= this._instantiationService.createInstance(ChatEditingNewNotebookContentEdits, this.modifiedModel);
            this.newNotebookEditGenerator.acceptTextEdits([edit]);
          } else {
            this.newNotebookEditGenerator = void 0;
            if (!this.editedCells.has(resource)) {
              await finishPreviousCells();
              this.editedCells.add(resource);
            }
            await cellEntry?.acceptAgentEdits([edit], last, responseModel);
          }
        } else {
          this.newNotebookEditGenerator = void 0;
          this.acceptNotebookEdit(edit);
        }
      }));
    });
    if (isLastEdits) {
      await finishPreviousCells();
    }
    isLastEdits = !isCellUri && isLastEdits;
    if (isLastEdits && this.newNotebookEditGenerator) {
      const notebookEdits = await this.newNotebookEditGenerator.generateEdits();
      this.newNotebookEditGenerator = void 0;
      notebookEdits.forEach((edit) => this.acceptNotebookEdit(edit));
    }
    transaction((tx) => {
      this._waitsForLastEdits.set(!isLastEdits, tx);
      this._stateObs.set(ModifiedFileEntryState.Modified, tx);
      if (!isLastEdits) {
        const newRewriteRation = Math.max(this._rewriteRatioObs.get(), calculateNotebookRewriteRatio(this._cellsDiffInfo.get(), this.originalModel, this.modifiedModel));
        this._rewriteRatioObs.set(Math.min(1, newRewriteRation), tx);
      } else {
        this.editedCells.clear();
        this._resetEditsState(tx);
        this._rewriteRatioObs.set(1, tx);
      }
    });
    if (isLastEdits && this._shouldAutoSave()) {
      await this.modifiedResourceRef.object.save({
        reason: SaveReason.AUTO,
        skipSaveParticipants: true
      });
    }
  }
  disposeDeletedCellEntries() {
    const cellsUris = new ResourceSet(this.modifiedModel.cells.map((cell) => cell.uri));
    Array.from(this.cellEntryMap.keys()).forEach((uri) => {
      if (cellsUris.has(uri)) {
        return;
      }
      this.cellEntryMap.get(uri)?.dispose();
      this.cellEntryMap.delete(uri);
    });
  }
  acceptNotebookEdit(edit) {
    this.modifiedModel.applyEdits([edit], true, void 0, () => void 0, void 0, false);
    this.disposeDeletedCellEntries();
    if (edit.editType !== CellEditType.Replace) {
      return;
    }
    edit.cells.forEach((_, i) => {
      const index = edit.index + i;
      const cell = this.modifiedModel.cells[index];
      if (cell.internalMetadata.internalId) {
        return;
      }
      const internalId = generateCellHash(cell.uri);
      const edits = [{ editType: CellEditType.PartialInternalMetadata, index, internalMetadata: { internalId } }];
      this.modifiedModel.applyEdits(edits, true, void 0, () => void 0, void 0, false);
    });
    let diff = [];
    if (edit.count === 0) {
      diff = sortCellChanges(this._cellsDiffInfo.get());
      diff.forEach((d) => {
        if (d.type !== "delete" && d.modifiedCellIndex >= edit.index) {
          d.modifiedCellIndex += edit.cells.length;
        }
      });
      const diffInsert = edit.cells.map((_, i) => this.createInsertedCellDiffInfo(edit.index + i));
      diff.splice(edit.index, 0, ...diffInsert);
    } else {
      diff = sortCellChanges(this._cellsDiffInfo.get()).map((d) => {
        if (d.type === "unchanged" && d.modifiedCellIndex >= edit.index && d.modifiedCellIndex <= edit.index + edit.count - 1) {
          return this.createDeleteCellDiffInfo(d.originalCellIndex);
        }
        if (d.type !== "delete" && d.modifiedCellIndex >= edit.index + edit.count) {
          d.modifiedCellIndex -= edit.count;
          return d;
        }
        return d;
      });
    }
    this.updateCellDiffInfo(diff, void 0);
  }
  computeStateAfterAcceptingRejectingChanges(accepted) {
    const currentSnapshot = createSnapshot(this.modifiedModel, this.transientOptions, this.configurationService);
    if (new SnapshotComparer(currentSnapshot).isEqual(this.originalModel)) {
      const state = accepted ? ModifiedFileEntryState.Accepted : ModifiedFileEntryState.Rejected;
      this._stateObs.set(state, void 0);
      this._notifySessionAction(accepted ? "accepted" : "rejected");
    }
  }
  createModifiedCellDiffInfo(modifiedCellIndex, originalCellIndex) {
    const modifiedCell = this.modifiedModel.cells[modifiedCellIndex];
    const originalCell = this.originalModel.cells[originalCellIndex];
    this.modifiedToOriginalCell.set(modifiedCell.uri, originalCell.uri);
    const modifiedCellModelPromise = this.resolveCellModel(modifiedCell.uri);
    const originalCellModelPromise = this.resolveCellModel(originalCell.uri);
    Promise.all([modifiedCellModelPromise, originalCellModelPromise]).then(([modifiedCellModel, originalCellModel]) => {
      this.getOrCreateModifiedTextFileEntryForCell(modifiedCell, modifiedCellModel, originalCellModel);
    });
    const diff = observableValue("diff", nullDocumentDiff);
    const unchangedCell = {
      type: "unchanged",
      modifiedCellIndex,
      originalCellIndex,
      keep: async (changes) => {
        const [modifiedCellModel, originalCellModel] = await Promise.all([modifiedCellModelPromise, originalCellModelPromise]);
        const entry = this.getOrCreateModifiedTextFileEntryForCell(modifiedCell, modifiedCellModel, originalCellModel);
        return entry ? entry.keep(changes) : false;
      },
      undo: async (changes) => {
        const [modifiedCellModel, originalCellModel] = await Promise.all([modifiedCellModelPromise, originalCellModelPromise]);
        const entry = this.getOrCreateModifiedTextFileEntryForCell(modifiedCell, modifiedCellModel, originalCellModel);
        return entry ? entry.undo(changes) : false;
      },
      modifiedModel: new ObservablePromise(modifiedCellModelPromise),
      originalModel: new ObservablePromise(originalCellModelPromise),
      diff
    };
    return unchangedCell;
  }
  createInsertedCellDiffInfo(modifiedCellIndex) {
    const cell = this.modifiedModel.cells[modifiedCellIndex];
    const lines = cell.getValue().split(/\r?\n/);
    const originalRange = new Range(1, 0, 1, 0);
    const modifiedRange = new Range(1, 0, lines.length, lines[lines.length - 1].length);
    const innerChanges = new RangeMapping(originalRange, modifiedRange);
    const changes = [new DetailedLineRangeMapping(new LineRange(1, 1), new LineRange(1, lines.length), [innerChanges])];
    const originalModelUri = this.modifiedModel.uri.with({ query: (ChatEditingModifiedNotebookEntry.NewModelCounter++).toString(), scheme: "emptyCell" });
    const originalModel = this.modelService.getModel(originalModelUri) || this._register(this.modelService.createModel("", null, originalModelUri));
    this.modifiedToOriginalCell.set(cell.uri, originalModelUri);
    const keep = async () => {
      this._applyEditsSync(() => this.keepPreviouslyInsertedCell(cell));
      this.computeStateAfterAcceptingRejectingChanges(true);
      return true;
    };
    const undo = async () => {
      this._applyEditsSync(() => this.undoPreviouslyInsertedCell(cell));
      this.computeStateAfterAcceptingRejectingChanges(false);
      return true;
    };
    this.resolveCellModel(cell.uri).then((modifiedModel) => {
      if (this._store.isDisposed) {
        return;
      }
      this.getOrCreateModifiedTextFileEntryForCell(cell, modifiedModel, originalModel);
    });
    return {
      type: "insert",
      originalCellIndex: void 0,
      modifiedCellIndex,
      keep,
      undo,
      modifiedModel: new ObservablePromise(this.resolveCellModel(cell.uri)),
      originalModel: new ObservablePromise(Promise.resolve(originalModel)),
      diff: observableValue("deletedCellDiff", {
        changes,
        identical: false,
        moves: [],
        quitEarly: false
      })
    };
  }
  createDeleteCellDiffInfo(originalCellIndex) {
    const originalCell = this.originalModel.cells[originalCellIndex];
    const lines = new Array(originalCell.textBuffer.getLineCount()).fill(0).map((_, i) => originalCell.textBuffer.getLineContent(i + 1));
    const originalRange = new Range(1, 0, lines.length, lines[lines.length - 1].length);
    const modifiedRange = new Range(1, 0, 1, 0);
    const innerChanges = new RangeMapping(modifiedRange, originalRange);
    const changes = [new DetailedLineRangeMapping(new LineRange(1, lines.length), new LineRange(1, 1), [innerChanges])];
    const modifiedModelUri = this.modifiedModel.uri.with({ query: (ChatEditingModifiedNotebookEntry.NewModelCounter++).toString(), scheme: "emptyCell" });
    const modifiedModel = this.modelService.getModel(modifiedModelUri) || this._register(this.modelService.createModel("", null, modifiedModelUri));
    const keep = async () => {
      this._applyEditsSync(() => this.keepPreviouslyDeletedCell(this.originalModel.cells.indexOf(originalCell)));
      this.computeStateAfterAcceptingRejectingChanges(true);
      return true;
    };
    const undo = async () => {
      this._applyEditsSync(() => this.undoPreviouslyDeletedCell(this.originalModel.cells.indexOf(originalCell), originalCell));
      this.computeStateAfterAcceptingRejectingChanges(false);
      return true;
    };
    return {
      type: "delete",
      modifiedCellIndex: void 0,
      originalCellIndex,
      originalModel: new ObservablePromise(this.resolveCellModel(originalCell.uri)),
      modifiedModel: new ObservablePromise(Promise.resolve(modifiedModel)),
      keep,
      undo,
      diff: observableValue("cellDiff", {
        changes,
        identical: false,
        moves: [],
        quitEarly: false
      })
    };
  }
  undoPreviouslyInsertedCell(cell) {
    let diffs = [];
    this._applyEditsSync(() => {
      const index = this.modifiedModel.cells.indexOf(cell);
      diffs = adjustCellDiffForRevertingAnInsertedCell(
        index,
        this._cellsDiffInfo.get(),
        this.modifiedModel.applyEdits.bind(this.modifiedModel)
      );
    });
    this.disposeDeletedCellEntries();
    this.updateCellDiffInfo(diffs, void 0);
  }
  keepPreviouslyInsertedCell(cell) {
    const modifiedCellIndex = this.modifiedModel.cells.indexOf(cell);
    if (modifiedCellIndex === -1) {
      return;
    }
    const cellToInsert = {
      cellKind: cell.cellKind,
      language: cell.language,
      metadata: cell.metadata,
      outputs: cell.outputs,
      source: cell.getValue(),
      mime: cell.mime,
      internalMetadata: {
        internalId: cell.internalMetadata.internalId
      }
    };
    this.cellEntryMap.get(cell.uri)?.dispose();
    this.cellEntryMap.delete(cell.uri);
    const cellDiffs = adjustCellDiffForKeepingAnInsertedCell(
      modifiedCellIndex,
      this._cellsDiffInfo.get().slice(),
      cellToInsert,
      this.originalModel.applyEdits.bind(this.originalModel),
      this.createModifiedCellDiffInfo.bind(this)
    );
    this.updateCellDiffInfo(cellDiffs, void 0);
  }
  undoPreviouslyDeletedCell(deletedOriginalIndex, originalCell) {
    const cellToInsert = {
      cellKind: originalCell.cellKind,
      language: originalCell.language,
      metadata: originalCell.metadata,
      outputs: originalCell.outputs,
      source: originalCell.getValue(),
      mime: originalCell.mime,
      internalMetadata: {
        internalId: originalCell.internalMetadata.internalId
      }
    };
    let cellDiffs = [];
    this._applyEditsSync(() => {
      cellDiffs = adjustCellDiffForRevertingADeletedCell(
        deletedOriginalIndex,
        this._cellsDiffInfo.get(),
        cellToInsert,
        this.modifiedModel.applyEdits.bind(this.modifiedModel),
        this.createModifiedCellDiffInfo.bind(this)
      );
    });
    this.updateCellDiffInfo(cellDiffs, void 0);
  }
  keepPreviouslyDeletedCell(deletedOriginalIndex) {
    const edit = { cells: [], count: 1, editType: CellEditType.Replace, index: deletedOriginalIndex };
    this.originalModel.applyEdits([edit], true, void 0, () => void 0, void 0, false);
    const diffs = sortCellChanges(this._cellsDiffInfo.get()).filter((d) => !(d.type === "delete" && d.originalCellIndex === deletedOriginalIndex)).map((diff) => {
      if (diff.type !== "insert" && diff.originalCellIndex > deletedOriginalIndex) {
        return {
          ...diff,
          originalCellIndex: diff.originalCellIndex - 1
        };
      }
      return diff;
    });
    this.updateCellDiffInfo(diffs, void 0);
  }
  async _applyEdits(operation) {
    this._isEditFromUs = true;
    try {
      await operation();
    } finally {
      this._isEditFromUs = false;
    }
  }
  _applyEditsSync(operation) {
    this._isEditFromUs = true;
    try {
      operation();
    } finally {
      this._isEditFromUs = false;
    }
  }
  _safeCreateSnapshot(model) {
    try {
      return createSnapshot(model, this.transientOptions, this.configurationService);
    } catch (e) {
      this.loggingService.error("Notebook Chat", `Error creating snapshot: ${e instanceof Error ? e.message : e}`);
      return this.initialContent;
    }
  }
  getCurrentSnapshot() {
    return this._safeCreateSnapshot(this.modifiedModel);
  }
  createSnapshot(chatSessionResource, requestId, undoStop) {
    const original = this._safeCreateSnapshot(this.originalModel);
    const current = this.getCurrentSnapshot();
    return {
      resource: this.modifiedURI,
      languageId: SnapshotLanguageId,
      snapshotUri: getNotebookSnapshotFileURI(chatSessionResource, requestId, undoStop, this.modifiedURI.path, this.modifiedModel.viewType),
      original,
      current,
      state: this.state.get(),
      telemetryInfo: this.telemetryInfo
    };
  }
  equalsSnapshot(snapshot) {
    return !!snapshot && isEqual(this.modifiedURI, snapshot.resource) && this.state.get() === snapshot.state && new SnapshotComparer(snapshot.original).isEqual(this.originalModel) && new SnapshotComparer(snapshot.current).isEqual(this.modifiedModel);
  }
  async restoreFromSnapshot(snapshot, restoreToDisk = true) {
    this.updateCellDiffInfo([], void 0);
    this._stateObs.set(snapshot.state, void 0);
    restoreSnapshot(this.originalModel, snapshot.original);
    if (restoreToDisk) {
      this.restoreSnapshotInModifiedModel(snapshot.current);
    }
    this.initializeModelsFromDiff();
  }
  async resetEditTrackerToInitialContent() {
    if (this.initialContent) {
      restoreSnapshot(this.originalModel, this.initialContent);
    }
    this.updateCellDiffInfo([], void 0);
    this.initializeModelsFromDiff();
  }
  async resetToInitialContent() {
    this.updateCellDiffInfo([], void 0);
    this.restoreSnapshotInModifiedModel(this.initialContent);
    this.initializeModelsFromDiff();
  }
  restoreModifiedModelFromSnapshot(snapshot) {
    this.restoreSnapshotInModifiedModel(snapshot);
    return this.initializeModelsFromDiff();
  }
  restoreSnapshotInModifiedModel(snapshot) {
    if (snapshot === createSnapshot(this.modifiedModel, this.transientOptions, this.configurationService)) {
      return;
    }
    this._applyEditsSync(() => {
      this.modifiedModel.pushStackElement();
      restoreSnapshot(this.modifiedModel, snapshot);
      this.modifiedModel.pushStackElement();
    });
  }
  async resolveCellModel(cellURI) {
    const cell = this.originalModel.cells.concat(this.modifiedModel.cells).find((cell2) => isEqual(cell2.uri, cellURI));
    if (!cell) {
      throw new Error("Cell not found");
    }
    const model = this.cellTextModelMap.get(cell.uri);
    if (model) {
      this.cellTextModelMap.set(cell.uri, model);
      return model;
    } else {
      const textEditorModel = await thenRegisterOrDispose(this.textModelService.createModelReference(cell.uri), this._store);
      const model2 = textEditorModel.object.textEditorModel;
      this.cellTextModelMap.set(cell.uri, model2);
      return model2;
    }
  }
  getOrCreateModifiedTextFileEntryForCell(cell, modifiedCellModel, originalCellModel) {
    let cellEntry = this.cellEntryMap.get(cell.uri);
    if (cellEntry) {
      return cellEntry;
    }
    if (this._store.isDisposed) {
      return;
    }
    const disposables = new DisposableStore();
    cellEntry = this._register(this._instantiationService.createInstance(ChatEditingNotebookCellEntry, this.modifiedResourceRef.object.resource, cell, modifiedCellModel, originalCellModel, () => this._isExternalEditInProgress, disposables));
    this.cellEntryMap.set(cell.uri, cellEntry);
    disposables.add(autorun((r) => {
      if (this.modifiedModel.cells.indexOf(cell) === -1) {
        return;
      }
      const diffs = this.cellsDiffInfo.read(void 0).slice();
      const index = this.modifiedModel.cells.indexOf(cell);
      let entry = diffs.find((entry2) => entry2.modifiedCellIndex === index);
      if (!entry) {
        return;
      }
      const entryIndex = diffs.indexOf(entry);
      entry.diff.set(cellEntry.diffInfo.read(r), void 0);
      if (cellEntry.diffInfo.read(void 0).identical && entry.type === "modified") {
        entry = {
          ...entry,
          type: "unchanged"
        };
      }
      if (!cellEntry.diffInfo.read(void 0).identical && entry.type === "unchanged") {
        entry = {
          ...entry,
          type: "modified"
        };
      }
      diffs.splice(entryIndex, 1, { ...entry });
      transaction((tx) => {
        this.updateCellDiffInfo(diffs, tx);
      });
    }));
    disposables.add(autorun((r) => {
      if (this.modifiedModel.cells.indexOf(cell) === -1) {
        return;
      }
      const cellState = cellEntry.state.read(r);
      if (cellState === ModifiedFileEntryState.Accepted) {
        this.computeStateAfterAcceptingRejectingChanges(true);
      } else if (cellState === ModifiedFileEntryState.Rejected) {
        this.computeStateAfterAcceptingRejectingChanges(false);
      }
    }));
    return cellEntry;
  }
  async computeEditsFromSnapshots(beforeSnapshot, afterSnapshot) {
    const beforeData = deserializeSnapshot(beforeSnapshot);
    const afterData = deserializeSnapshot(afterSnapshot);
    const edits = [];
    if (beforeData.data.cells.length > 0) {
      edits.push({
        editType: CellEditType.Replace,
        index: 0,
        count: beforeData.data.cells.length,
        cells: afterData.data.cells
      });
    } else if (afterData.data.cells.length > 0) {
      edits.push({
        editType: CellEditType.Replace,
        index: 0,
        count: 0,
        cells: afterData.data.cells
      });
    }
    return edits;
  }
  _shouldAutoSave() {
    return this.modifiedURI.scheme !== Schemas.untitled;
  }
  async save() {
    if (this.modifiedModel.uri.scheme === Schemas.untitled) {
      return;
    }
    if (this.notebookResolver.isDirty(this.modifiedModel.uri)) {
      await this.modifiedResourceRef.object.save({
        reason: SaveReason.EXPLICIT,
        skipSaveParticipants: true
      });
    }
  }
  async revertToDisk() {
    if (this.modifiedModel.uri.scheme === Schemas.untitled) {
      return;
    }
    await this.modifiedResourceRef.object.revert({ soft: false });
  }
};
ChatEditingModifiedNotebookEntry = __decorateClass([
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IFilesConfigurationService),
  __decorateParam(9, IChatService),
  __decorateParam(10, IFileService),
  __decorateParam(11, IInstantiationService),
  __decorateParam(12, ITextModelService),
  __decorateParam(13, IModelService),
  __decorateParam(14, IUndoRedoService),
  __decorateParam(15, INotebookEditorWorkerService),
  __decorateParam(16, INotebookLoggingService),
  __decorateParam(17, INotebookEditorModelResolverService),
  __decorateParam(18, IAiEditTelemetryService)
], ChatEditingModifiedNotebookEntry);
function generateCellHash(cellUri) {
  const hash = new StringSHA1();
  hash.update(cellUri.toString());
  return hash.digest().substring(0, 8);
}
export {
  ChatEditingModifiedNotebookEntry
};
