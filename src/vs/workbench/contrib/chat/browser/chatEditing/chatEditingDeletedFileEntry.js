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
import { VSBuffer } from "../../../../../base/common/buffer.js";
import { constObservable, observableValue, transaction } from "../../../../../base/common/observable.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { LineRange } from "../../../../../editor/common/core/ranges/lineRange.js";
import { DetailedLineRangeMapping } from "../../../../../editor/common/diff/rangeMapping.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { createTextBufferFactoryFromSnapshot } from "../../../../../editor/common/model/textModel.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IUndoRedoService, UndoRedoElementType } from "../../../../../platform/undoRedo/common/undoRedo.js";
import { IFilesConfigurationService } from "../../../../services/filesConfiguration/common/filesConfigurationService.js";
import { stringToSnapshot } from "../../../../services/textfile/common/textfiles.js";
import { IAiEditTelemetryService } from "../../../editTelemetry/browser/telemetry/aiEditTelemetry/aiEditTelemetryService.js";
import { IChatService } from "../../common/chatService/chatService.js";
import { ChatEditKind, ModifiedFileEntryState } from "../../common/editing/chatEditingService.js";
import { AbstractChatEditingModifiedFileEntry } from "./chatEditingModifiedFileEntry.js";
import { ChatEditingTextModelContentProvider } from "./chatEditingTextModelContentProviders.js";
let ChatEditingDeletedFileEntry = class extends AbstractChatEditingModifiedFileEntry {
  constructor(resource, originalContent, _multiDiffEntryDelegate, telemetryInfo, _languageId, _modelService, _languageService, configService, fileConfigService, chatService, fileService, undoRedoService, instantiationService, aiEditTelemetryService) {
    super(
      resource,
      telemetryInfo,
      ChatEditKind.Deleted,
      configService,
      fileConfigService,
      chatService,
      fileService,
      undoRedoService,
      instantiationService,
      aiEditTelemetryService
    );
    this._multiDiffEntryDelegate = _multiDiffEntryDelegate;
    this._languageId = _languageId;
    this._modelService = _modelService;
    this._languageService = _languageService;
    this.linesAdded = constObservable(0);
    this._changesCount = observableValue(this, 1);
    this.changesCount = this._changesCount;
    this.isDeletion = true;
    this._originalContent = originalContent;
    this.initialContent = originalContent;
    this.originalURI = ChatEditingTextModelContentProvider.getFileURI(telemetryInfo.sessionResource, this.entryId, resource.path);
    this.diffInfo = constObservable(this._diffInfo());
    this.linesRemoved = constObservable(this._getOrCreateOriginalModel().getLineCount());
  }
  dispose() {
    this._originalModel?.dispose();
    this._modifiedModel?.dispose();
    super.dispose();
  }
  /**
   * Gets or creates the original model for diff display.
   */
  _getOrCreateOriginalModel() {
    if (!this._originalModel || this._originalModel.isDisposed()) {
      this._originalModel = this._modelService.createModel(
        createTextBufferFactoryFromSnapshot(stringToSnapshot(this._originalContent)),
        this._languageService.createById(this._languageId),
        this.originalURI,
        false
      );
    }
    return this._originalModel;
  }
  /**
   * Gets or creates an empty model representing the deleted state.
   */
  _getOrCreateModifiedModel() {
    if (!this._modifiedModel || this._modifiedModel.isDisposed()) {
      this._modifiedModel = this._modelService.createModel(
        "",
        this._languageService.createById(this._languageId),
        this.modifiedURI.with({ scheme: "deleted-file" }),
        false
      );
    }
    return this._modifiedModel;
  }
  _diffInfo() {
    const originalModel = this._getOrCreateOriginalModel();
    this._getOrCreateModifiedModel();
    const originalLineCount = originalModel.getLineCount();
    return {
      changes: [new DetailedLineRangeMapping(
        new LineRange(1, originalLineCount + 1),
        new LineRange(1, 1),
        void 0
      )],
      quitEarly: false,
      identical: false,
      moves: []
    };
  }
  getDiffInfo() {
    return Promise.resolve(this._diffInfo());
  }
  equalsSnapshot(snapshot) {
    return !!snapshot && isEqual(this.modifiedURI, snapshot.resource) && this._languageId === snapshot.languageId && this._originalContent === snapshot.original && snapshot.current === "" && this.state.get() === snapshot.state;
  }
  createSnapshot(chatSessionResource, requestId, undoStop) {
    return {
      resource: this.modifiedURI,
      languageId: this._languageId,
      snapshotUri: this.originalURI,
      original: this._originalContent,
      current: "",
      // File is deleted, so current content is empty
      state: this.state.get(),
      telemetryInfo: this._telemetryInfo,
      isDeleted: true
    };
  }
  async restoreFromSnapshot(snapshot, restoreToDisk = true) {
    this._stateObs.set(snapshot.state, void 0);
    if (restoreToDisk && snapshot.current !== "") {
      await this._fileService.writeFile(this.modifiedURI, VSBuffer.fromString(snapshot.current));
    }
  }
  async resetToInitialContent() {
    await this._fileService.writeFile(this.modifiedURI, VSBuffer.fromString(this._originalContent));
  }
  resetEditTrackerToInitialContent() {
    return Promise.resolve();
  }
  async _areOriginalAndModifiedIdentical() {
    return this._originalContent === "";
  }
  _createUndoRedoElement(response) {
    return {
      type: UndoRedoElementType.Resource,
      resource: this.modifiedURI,
      label: "Chat File Deletion",
      code: "chat.delete",
      undo: async () => {
        await this._fileService.writeFile(this.modifiedURI, VSBuffer.fromString(this._originalContent));
      },
      redo: async () => {
        await this._fileService.del(this.modifiedURI, { useTrash: false });
      }
    };
  }
  async acceptAgentEdits(_uri, _edits, isLastEdits, _responseModel) {
    transaction((tx) => {
      this._waitsForLastEdits.set(!isLastEdits, tx);
      this._stateObs.set(ModifiedFileEntryState.Modified, tx);
      if (isLastEdits) {
        this._resetEditsState(tx);
        this._rewriteRatioObs.set(1, tx);
      }
    });
  }
  async _doAccept() {
    this._multiDiffEntryDelegate.collapse(void 0);
  }
  async _doReject() {
    await this._fileService.writeFile(this.modifiedURI, VSBuffer.fromString(this._originalContent));
    this._multiDiffEntryDelegate.collapse(void 0);
  }
  _createEditorIntegration(_editor) {
    return {
      currentIndex: observableValue(this, 0),
      reveal: () => {
      },
      next: () => false,
      previous: () => false,
      enableAccessibleDiffView: () => {
      },
      acceptNearestChange: async () => {
      },
      rejectNearestChange: async () => {
      },
      toggleDiff: async () => {
      },
      dispose: () => {
      }
    };
  }
  async computeEditsFromSnapshots(_beforeSnapshot, _afterSnapshot) {
    return [];
  }
  async save() {
  }
  async revertToDisk() {
  }
};
ChatEditingDeletedFileEntry = __decorateClass([
  __decorateParam(5, IModelService),
  __decorateParam(6, ILanguageService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IFilesConfigurationService),
  __decorateParam(9, IChatService),
  __decorateParam(10, IFileService),
  __decorateParam(11, IUndoRedoService),
  __decorateParam(12, IInstantiationService),
  __decorateParam(13, IAiEditTelemetryService)
], ChatEditingDeletedFileEntry);
export {
  ChatEditingDeletedFileEntry
};
