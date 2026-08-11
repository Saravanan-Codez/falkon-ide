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
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { observableValue, transaction } from "../../../../../../base/common/observable.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { CellEditState } from "../../../../notebook/browser/notebookBrowser.js";
import { INotebookEditorService } from "../../../../notebook/browser/services/notebookEditorService.js";
import { CellKind } from "../../../../notebook/common/notebookCommon.js";
import { ModifiedFileEntryState } from "../../../common/editing/chatEditingService.js";
import { ChatEditingTextModelChangeService } from "../chatEditingTextModelChangeService.js";
let ChatEditingNotebookCellEntry = class extends Disposable {
  constructor(notebookUri, cell, modifiedModel, originalModel, isExternalEditInProgress, disposables, notebookEditorService, instantiationService) {
    super();
    this.notebookUri = notebookUri;
    this.cell = cell;
    this.modifiedModel = modifiedModel;
    this.originalModel = originalModel;
    this.notebookEditorService = notebookEditorService;
    this.instantiationService = instantiationService;
    this._maxModifiedLineNumber = observableValue(this, 0);
    this.maxModifiedLineNumber = this._maxModifiedLineNumber;
    this._stateObs = observableValue(this, ModifiedFileEntryState.Modified);
    this.state = this._stateObs;
    this.initialContent = this.originalModel.getValue();
    this._register(disposables);
    this._textModelChangeService = this._register(this.instantiationService.createInstance(ChatEditingTextModelChangeService, this.originalModel, this.modifiedModel, this.state, isExternalEditInProgress));
    this._register(this._textModelChangeService.onDidAcceptOrRejectAllHunks((action) => {
      this.revertMarkdownPreviewState();
      this._stateObs.set(action, void 0);
    }));
    this._register(this._textModelChangeService.onDidUserEditModel(() => {
      const didResetToOriginalContent = this.modifiedModel.getValue() === this.initialContent;
      if (this._stateObs.get() === ModifiedFileEntryState.Modified && didResetToOriginalContent) {
        this._stateObs.set(ModifiedFileEntryState.Rejected, void 0);
      }
    }));
  }
  get isDisposed() {
    return this._store.isDisposed;
  }
  get isEditFromUs() {
    return this._textModelChangeService.isEditFromUs;
  }
  get allEditsAreFromUs() {
    return this._textModelChangeService.allEditsAreFromUs;
  }
  get diffInfo() {
    return this._textModelChangeService.diffInfo;
  }
  clearCurrentEditLineDecoration() {
    if (this.modifiedModel.isDisposed()) {
      return;
    }
    this._textModelChangeService.clearCurrentEditLineDecoration();
  }
  async acceptAgentEdits(textEdits, isLastEdits, responseModel) {
    const { maxLineNumber } = await this._textModelChangeService.acceptAgentEdits(this.modifiedModel.uri, textEdits, isLastEdits, responseModel);
    transaction((tx) => {
      if (!isLastEdits) {
        this._stateObs.set(ModifiedFileEntryState.Modified, tx);
        this._maxModifiedLineNumber.set(maxLineNumber, tx);
      } else {
        this._maxModifiedLineNumber.set(0, tx);
      }
    });
  }
  revertMarkdownPreviewState() {
    if (this.cell.cellKind !== CellKind.Markup) {
      return;
    }
    const notebookEditor = this.notebookEditorService.retrieveExistingWidgetFromURI(this.notebookUri)?.value;
    if (notebookEditor) {
      const vm = notebookEditor.getCellByHandle(this.cell.handle);
      if (vm?.getEditState() === CellEditState.Editing && (vm.editStateSource === "chatEdit" || vm.editStateSource === "chatEditNavigation")) {
        vm?.updateEditState(CellEditState.Preview, "chatEdit");
      }
    }
  }
  async keep(change) {
    return this._textModelChangeService.diffInfo.get().keep(change);
  }
  async undo(change) {
    return this._textModelChangeService.diffInfo.get().undo(change);
  }
};
ChatEditingNotebookCellEntry = __decorateClass([
  __decorateParam(6, INotebookEditorService),
  __decorateParam(7, IInstantiationService)
], ChatEditingNotebookCellEntry);
export {
  ChatEditingNotebookCellEntry
};
