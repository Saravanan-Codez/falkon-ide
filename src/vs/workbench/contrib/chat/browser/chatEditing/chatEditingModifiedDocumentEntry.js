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
import { MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../base/common/network.js";
import { autorun, transaction } from "../../../../../base/common/observable.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { assertType } from "../../../../../base/common/types.js";
import { getCodeEditor } from "../../../../../editor/browser/editorBrowser.js";
import { TextEdit as EditorTextEdit } from "../../../../../editor/common/core/edits/textEdit.js";
import { StringText } from "../../../../../editor/common/core/text/abstractText.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { SingleModelEditStackElement } from "../../../../../editor/common/model/editStack.js";
import { createTextBufferFactoryFromSnapshot } from "../../../../../editor/common/model/textModel.js";
import { IEditorWorkerService } from "../../../../../editor/common/services/editorWorker.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { localize } from "../../../../../nls.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IMarkerService } from "../../../../../platform/markers/common/markers.js";
import { IUndoRedoService } from "../../../../../platform/undoRedo/common/undoRedo.js";
import { SaveReason } from "../../../../common/editor.js";
import { IFilesConfigurationService } from "../../../../services/filesConfiguration/common/filesConfigurationService.js";
import { ITextFileService, isTextFileEditorModel, stringToSnapshot } from "../../../../services/textfile/common/textfiles.js";
import { IAiEditTelemetryService } from "../../../editTelemetry/browser/telemetry/aiEditTelemetry/aiEditTelemetryService.js";
import { IChatService } from "../../common/chatService/chatService.js";
import { ModifiedFileEntryState } from "../../common/editing/chatEditingService.js";
import { ChatEditingCodeEditorIntegration } from "./chatEditingCodeEditorIntegration.js";
import { AbstractChatEditingModifiedFileEntry } from "./chatEditingModifiedFileEntry.js";
import { ChatEditingTextModelChangeService } from "./chatEditingTextModelChangeService.js";
import { ChatEditingSnapshotTextModelContentProvider, ChatEditingTextModelContentProvider } from "./chatEditingTextModelContentProviders.js";
let ChatEditingModifiedDocumentEntry = class extends AbstractChatEditingModifiedFileEntry {
  constructor(resourceRef, _multiDiffEntryDelegate, telemetryInfo, kind, initialContent, markerService, modelService, textModelService, languageService, configService, fileConfigService, chatService, _textFileService, fileService, undoRedoService, instantiationService, aiEditTelemetryService, _editorWorkerService) {
    super(
      resourceRef.object.textEditorModel.uri,
      telemetryInfo,
      kind,
      configService,
      fileConfigService,
      chatService,
      fileService,
      undoRedoService,
      instantiationService,
      aiEditTelemetryService
    );
    this._multiDiffEntryDelegate = _multiDiffEntryDelegate;
    this._textFileService = _textFileService;
    this._editorWorkerService = _editorWorkerService;
    this._docFileEditorModel = this._register(resourceRef).object;
    this.modifiedModel = resourceRef.object.textEditorModel;
    this.originalURI = ChatEditingTextModelContentProvider.getFileURI(telemetryInfo.sessionResource, this.entryId, this.modifiedURI.path);
    this.initialContent = initialContent ?? this.modifiedModel.getValue();
    const docSnapshot = this.originalModel = this._register(
      modelService.createModel(
        createTextBufferFactoryFromSnapshot(initialContent !== void 0 ? stringToSnapshot(initialContent) : this.modifiedModel.createSnapshot()),
        languageService.createById(this.modifiedModel.getLanguageId()),
        this.originalURI,
        false
      )
    );
    this._textModelChangeService = this._register(instantiationService.createInstance(
      ChatEditingTextModelChangeService,
      this.originalModel,
      this.modifiedModel,
      this._stateObs,
      () => this._isExternalEditInProgress
    ));
    this._register(this._textModelChangeService.onDidAcceptOrRejectAllHunks((action) => {
      this._stateObs.set(action, void 0);
      this._notifySessionAction(action === ModifiedFileEntryState.Accepted ? "accepted" : "rejected");
    }));
    this._register(this._textModelChangeService.onDidAcceptOrRejectLines((action) => {
      this._notifyAction({
        kind: "chatEditingHunkAction",
        uri: this.modifiedURI,
        outcome: action.state,
        languageId: this.modifiedModel.getLanguageId(),
        ...action
      });
    }));
    (async () => {
      const reference = await textModelService.createModelReference(docSnapshot.uri);
      if (this._store.isDisposed) {
        reference.dispose();
        return;
      }
      this._register(reference);
    })();
    this._register(this._textModelChangeService.onDidUserEditModel(() => {
      this._userEditScheduler.schedule();
      const didResetToOriginalContent = this.modifiedModel.getValue() === this.initialContent;
      if (this._stateObs.get() === ModifiedFileEntryState.Modified && didResetToOriginalContent) {
        this._stateObs.set(ModifiedFileEntryState.Rejected, void 0);
      }
    }));
    const resourceFilter = this._register(new MutableDisposable());
    this._register(autorun((r) => {
      const inProgress = this._waitsForLastEdits.read(r);
      if (inProgress) {
        const res = this._lastModifyingResponseObs.read(r);
        const req = res && res.session.getRequests().find((value) => value.id === res.requestId);
        resourceFilter.value = markerService.installResourceFilter(this.modifiedURI, req?.message.text || localize("default", "Chat Edits"));
      } else {
        resourceFilter.clear();
      }
    }));
  }
  get changesCount() {
    return this._textModelChangeService.diffInfo.map((diff) => diff.changes.length);
  }
  get diffInfo() {
    return this._textModelChangeService.diffInfo;
  }
  get linesAdded() {
    return this._textModelChangeService.diffInfo.map((diff) => {
      let added = 0;
      for (const c of diff.changes) {
        added += Math.max(0, c.modified.endLineNumberExclusive - c.modified.startLineNumber);
      }
      return added;
    });
  }
  get linesRemoved() {
    return this._textModelChangeService.diffInfo.map((diff) => {
      let removed = 0;
      for (const c of diff.changes) {
        removed += Math.max(0, c.original.endLineNumberExclusive - c.original.startLineNumber);
      }
      return removed;
    });
  }
  getDiffInfo() {
    return this._textModelChangeService.getDiffInfo();
  }
  equalsSnapshot(snapshot) {
    return !!snapshot && isEqual(this.modifiedURI, snapshot.resource) && this.modifiedModel.getLanguageId() === snapshot.languageId && this.originalModel.getValue() === snapshot.original && this.modifiedModel.getValue() === snapshot.current && this.state.get() === snapshot.state;
  }
  createSnapshot(chatSessionResource, requestId, undoStop) {
    return {
      resource: this.modifiedURI,
      languageId: this.modifiedModel.getLanguageId(),
      snapshotUri: ChatEditingSnapshotTextModelContentProvider.getSnapshotFileURI(chatSessionResource, requestId, undoStop, this.modifiedURI.path, this.modifiedURI.scheme, this.modifiedURI.authority),
      original: this.originalModel.getValue(),
      current: this.modifiedModel.getValue(),
      state: this.state.get(),
      telemetryInfo: this._telemetryInfo
    };
  }
  getCurrentContents() {
    return this.modifiedModel.getValue();
  }
  async restoreFromSnapshot(snapshot, restoreToDisk = true) {
    this._stateObs.set(snapshot.state, void 0);
    await this._textModelChangeService.resetDocumentValues(snapshot.original, restoreToDisk ? snapshot.current : void 0);
  }
  async resetToInitialContent() {
    await this._textModelChangeService.resetDocumentValues(void 0, this.initialContent);
  }
  async resetEditTrackerToInitialContent() {
    await this._textModelChangeService.resetDocumentValues(this.initialContent, void 0);
  }
  async _areOriginalAndModifiedIdentical() {
    return this._textModelChangeService.areOriginalAndModifiedIdentical();
  }
  _resetEditsState(tx) {
    super._resetEditsState(tx);
    this._textModelChangeService.clearCurrentEditLineDecoration();
  }
  _createUndoRedoElement(response) {
    const request = response.session.getRequests().find((req) => req.id === response.requestId);
    const label = request?.message.text ? localize("chatEditing1", "Chat Edit: '{0}'", request.message.text) : localize("chatEditing2", "Chat Edit");
    return new SingleModelEditStackElement(label, "chat.edit", this.modifiedModel, null);
  }
  async acceptAgentEdits(resource, textEdits, isLastEdits, responseModel) {
    const result = await this._textModelChangeService.acceptAgentEdits(resource, textEdits, isLastEdits, responseModel);
    transaction((tx) => {
      this._waitsForLastEdits.set(!isLastEdits, tx);
      this._stateObs.set(ModifiedFileEntryState.Modified, tx);
      if (!isLastEdits) {
        this._rewriteRatioObs.set(result.rewriteRatio, tx);
      } else {
        this._resetEditsState(tx);
        this._rewriteRatioObs.set(1, tx);
      }
    });
    if (isLastEdits && this._shouldAutoSave()) {
      await this._textFileService.save(this.modifiedModel.uri, {
        reason: SaveReason.AUTO,
        skipSaveParticipants: true
      });
    }
  }
  async _doAccept() {
    this._textModelChangeService.keep();
    this._multiDiffEntryDelegate.collapse(void 0);
    const config = this._fileConfigService.getAutoSaveConfiguration(this.modifiedURI);
    if (!config.autoSave || !this._textFileService.isDirty(this.modifiedURI)) {
      try {
        await this._textFileService.save(this.modifiedURI, {
          reason: SaveReason.EXPLICIT,
          force: true,
          ignoreErrorHandler: true
        });
      } catch {
      }
    }
  }
  async _doReject() {
    if (this.createdInRequestId === this._telemetryInfo.requestId) {
      if (isTextFileEditorModel(this._docFileEditorModel)) {
        await this._docFileEditorModel.revert({ soft: true });
        await this._fileService.del(this.modifiedURI).catch((err) => {
        });
      }
      this._onDidDelete.fire();
    } else {
      this._textModelChangeService.undo();
      if (this._textModelChangeService.allEditsAreFromUs && isTextFileEditorModel(this._docFileEditorModel) && this._shouldAutoSave()) {
        await this._docFileEditorModel.save({ reason: SaveReason.EXPLICIT, skipSaveParticipants: true });
      }
      this._multiDiffEntryDelegate.collapse(void 0);
    }
  }
  _createEditorIntegration(editor) {
    const codeEditor = getCodeEditor(editor.getControl());
    assertType(codeEditor);
    const diffInfo = this._textModelChangeService.diffInfo;
    return this._instantiationService.createInstance(ChatEditingCodeEditorIntegration, this, codeEditor, diffInfo, false);
  }
  _shouldAutoSave() {
    return this.modifiedURI.scheme !== Schemas.untitled;
  }
  async computeEditsFromSnapshots(beforeSnapshot, afterSnapshot) {
    const stringEdit = await this._editorWorkerService.computeStringEditFromDiff(
      beforeSnapshot,
      afterSnapshot,
      { maxComputationTimeMs: 5e3 },
      "advanced"
    );
    const editorTextEdit = EditorTextEdit.fromStringEdit(stringEdit, new StringText(beforeSnapshot));
    return editorTextEdit.replacements.slice();
  }
  async save() {
    if (this.modifiedModel.uri.scheme === Schemas.untitled) {
      return;
    }
    if (this._textFileService.isDirty(this.modifiedModel.uri)) {
      await this._textFileService.save(this.modifiedModel.uri, {
        reason: SaveReason.EXPLICIT,
        skipSaveParticipants: true
      });
    }
  }
  async revertToDisk() {
    if (this.modifiedModel.uri.scheme === Schemas.untitled) {
      return;
    }
    const fileModel = this._textFileService.files.get(this.modifiedModel.uri);
    if (fileModel && !fileModel.isDisposed()) {
      await fileModel.revert({ soft: false });
    }
  }
};
ChatEditingModifiedDocumentEntry = __decorateClass([
  __decorateParam(5, IMarkerService),
  __decorateParam(6, IModelService),
  __decorateParam(7, ITextModelService),
  __decorateParam(8, ILanguageService),
  __decorateParam(9, IConfigurationService),
  __decorateParam(10, IFilesConfigurationService),
  __decorateParam(11, IChatService),
  __decorateParam(12, ITextFileService),
  __decorateParam(13, IFileService),
  __decorateParam(14, IUndoRedoService),
  __decorateParam(15, IInstantiationService),
  __decorateParam(16, IAiEditTelemetryService),
  __decorateParam(17, IEditorWorkerService)
], ChatEditingModifiedDocumentEntry);
export {
  ChatEditingModifiedDocumentEntry
};
