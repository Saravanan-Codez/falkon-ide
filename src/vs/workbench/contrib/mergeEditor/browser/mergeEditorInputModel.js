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
import { assertFn } from "../../../../base/common/assert.js";
import { BugIndicatingError, onUnexpectedError } from "../../../../base/common/errors.js";
import { Event } from "../../../../base/common/event.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { derived, observableFromEvent, observableValue } from "../../../../base/common/observable.js";
import { basename } from "../../../../base/common/resources.js";
import Severity from "../../../../base/common/severity.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { localize } from "../../../../nls.js";
import { ConfirmResult, IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { SaveSourceRegistry } from "../../../common/editor.js";
import { EditorModel } from "../../../common/editor/editorModel.js";
import { conflictMarkers } from "./mergeMarkers/mergeMarkersController.js";
import { MergeDiffComputer } from "./model/diffComputer.js";
import { MergeEditorModel } from "./model/mergeEditorModel.js";
import { StorageCloseWithConflicts } from "../common/mergeEditor.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { ITextFileService } from "../../../services/textfile/common/textfiles.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
let TempFileMergeEditorModeFactory = class {
  constructor(_mergeEditorTelemetry, _instantiationService, _textModelService, _modelService) {
    this._mergeEditorTelemetry = _mergeEditorTelemetry;
    this._instantiationService = _instantiationService;
    this._textModelService = _textModelService;
    this._modelService = _modelService;
  }
  async createInputModel(args) {
    const store = new DisposableStore();
    const [
      base,
      result,
      input1Data,
      input2Data
    ] = await Promise.all([
      this._textModelService.createModelReference(args.base),
      this._textModelService.createModelReference(args.result),
      toInputData(args.input1, this._textModelService, store),
      toInputData(args.input2, this._textModelService, store)
    ]);
    store.add(base);
    store.add(result);
    const tempResultUri = result.object.textEditorModel.uri.with({ scheme: "merge-result" });
    const temporaryResultModel = this._modelService.createModel(
      "",
      {
        languageId: result.object.textEditorModel.getLanguageId(),
        onDidChange: Event.None
      },
      tempResultUri
    );
    store.add(temporaryResultModel);
    const mergeDiffComputer = this._instantiationService.createInstance(MergeDiffComputer);
    const model = this._instantiationService.createInstance(
      MergeEditorModel,
      base.object.textEditorModel,
      input1Data,
      input2Data,
      temporaryResultModel,
      mergeDiffComputer,
      {
        resetResult: true
      },
      this._mergeEditorTelemetry
    );
    store.add(model);
    await model.onInitialized;
    return this._instantiationService.createInstance(TempFileMergeEditorInputModel, model, store, result.object, args.result);
  }
};
TempFileMergeEditorModeFactory = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ITextModelService),
  __decorateParam(3, IModelService)
], TempFileMergeEditorModeFactory);
let TempFileMergeEditorInputModel = class extends EditorModel {
  constructor(model, disposable, result, resultUri, textFileService, dialogService, editorService) {
    super();
    this.model = model;
    this.disposable = disposable;
    this.result = result;
    this.resultUri = resultUri;
    this.textFileService = textFileService;
    this.dialogService = dialogService;
    this.editorService = editorService;
    this.savedAltVersionId = observableValue(this, this.model.resultTextModel.getAlternativeVersionId());
    this.altVersionId = observableFromEvent(
      this,
      (e) => this.model.resultTextModel.onDidChangeContent(e),
      () => (
        /** @description getAlternativeVersionId */
        this.model.resultTextModel.getAlternativeVersionId()
      )
    );
    this.isDirty = derived(this, (reader) => this.altVersionId.read(reader) !== this.savedAltVersionId.read(reader));
    this.finished = false;
  }
  dispose() {
    this.disposable.dispose();
    super.dispose();
  }
  async accept() {
    const value = await this.model.resultTextModel.getValue();
    this.result.textEditorModel.setValue(value);
    this.savedAltVersionId.set(this.model.resultTextModel.getAlternativeVersionId(), void 0);
    await this.textFileService.save(this.result.textEditorModel.uri);
    this.finished = true;
  }
  async _discard() {
    await this.textFileService.revert(this.model.resultTextModel.uri);
    this.savedAltVersionId.set(this.model.resultTextModel.getAlternativeVersionId(), void 0);
    this.finished = true;
  }
  shouldConfirmClose() {
    return true;
  }
  async confirmClose(inputModels) {
    assertFn(
      () => inputModels.some((m) => m === this)
    );
    const someDirty = inputModels.some((m) => m.isDirty.get());
    let choice;
    if (someDirty) {
      const isMany = inputModels.length > 1;
      const message = isMany ? localize("messageN", "Do you want keep the merge result of {0} files?", inputModels.length) : localize("message1", "Do you want keep the merge result of {0}?", basename(inputModels[0].model.resultTextModel.uri));
      const hasUnhandledConflicts = inputModels.some((m) => m.model.hasUnhandledConflicts.get());
      const buttons = [
        {
          label: hasUnhandledConflicts ? localize({ key: "saveWithConflict", comment: ["&& denotes a mnemonic"] }, "&&Save With Conflicts") : localize({ key: "save", comment: ["&& denotes a mnemonic"] }, "&&Save"),
          run: () => ConfirmResult.SAVE
        },
        {
          label: localize({ key: "discard", comment: ["&& denotes a mnemonic"] }, "Do&&n't Save"),
          run: () => ConfirmResult.DONT_SAVE
        }
      ];
      choice = (await this.dialogService.prompt({
        type: Severity.Info,
        message,
        detail: hasUnhandledConflicts ? isMany ? localize("detailNConflicts", "The files contain unhandled conflicts. The merge results will be lost if you don't save them.") : localize("detail1Conflicts", "The file contains unhandled conflicts. The merge result will be lost if you don't save it.") : isMany ? localize("detailN", "The merge results will be lost if you don't save them.") : localize("detail1", "The merge result will be lost if you don't save it."),
        buttons,
        cancelButton: {
          run: () => ConfirmResult.CANCEL
        }
      })).result;
    } else {
      choice = ConfirmResult.DONT_SAVE;
    }
    if (choice === ConfirmResult.SAVE) {
      await Promise.all(inputModels.map((m) => m.accept()));
    } else if (choice === ConfirmResult.DONT_SAVE) {
      await Promise.all(inputModels.map((m) => m._discard()));
    } else {
    }
    return choice;
  }
  async save(options) {
    if (this.finished) {
      return;
    }
    (async () => {
      const { confirmed } = await this.dialogService.confirm({
        message: localize(
          "saveTempFile.message",
          "Do you want to accept the merge result?"
        ),
        detail: localize(
          "saveTempFile.detail",
          "This will write the merge result to the original file and close the merge editor."
        ),
        primaryButton: localize({ key: "acceptMerge", comment: ["&& denotes a mnemonic"] }, "&&Accept Merge")
      });
      if (confirmed) {
        await this.accept();
        const editors = this.editorService.findEditors(this.resultUri).filter((e) => e.editor.typeId === "mergeEditor.Input");
        await this.editorService.closeEditors(editors);
      }
    })();
  }
  async revert(options) {
  }
};
TempFileMergeEditorInputModel = __decorateClass([
  __decorateParam(4, ITextFileService),
  __decorateParam(5, IDialogService),
  __decorateParam(6, IEditorService)
], TempFileMergeEditorInputModel);
let WorkspaceMergeEditorModeFactory = class {
  constructor(_mergeEditorTelemetry, _instantiationService, _textModelService, textFileService, _modelService, _languageService) {
    this._mergeEditorTelemetry = _mergeEditorTelemetry;
    this._instantiationService = _instantiationService;
    this._textModelService = _textModelService;
    this.textFileService = textFileService;
    this._modelService = _modelService;
    this._languageService = _languageService;
  }
  static {
    this.FILE_SAVED_SOURCE = SaveSourceRegistry.registerSource("merge-editor.source", localize("merge-editor.source", "Before Resolving Conflicts In Merge Editor"));
  }
  async createInputModel(args) {
    const store = new DisposableStore();
    let [
      base,
      result,
      input1Data,
      input2Data
    ] = await Promise.all([
      this._textModelService.createModelReference(args.base).then((v) => ({
        object: v.object.textEditorModel,
        dispose: () => v.dispose()
      })).catch((e) => {
        onUnexpectedError(e);
        console.error(e);
        return void 0;
      }),
      this._textModelService.createModelReference(args.result),
      toInputData(args.input1, this._textModelService, store),
      toInputData(args.input2, this._textModelService, store)
    ]);
    if (base === void 0) {
      const tm = this._modelService.createModel("", this._languageService.createById(result.object.getLanguageId()));
      base = {
        dispose: () => {
          tm.dispose();
        },
        object: tm
      };
    }
    store.add(base);
    store.add(result);
    const resultTextFileModel = this.textFileService.files.models.find(
      (m) => m.resource.toString() === result.object.textEditorModel.uri.toString()
    );
    if (!resultTextFileModel) {
      throw new BugIndicatingError();
    }
    await resultTextFileModel.save({ source: WorkspaceMergeEditorModeFactory.FILE_SAVED_SOURCE });
    const lines = resultTextFileModel.textEditorModel.getLinesContent();
    const hasConflictMarkers = lines.some((l) => l.startsWith(conflictMarkers.start));
    const resetResult = hasConflictMarkers;
    const mergeDiffComputer = this._instantiationService.createInstance(MergeDiffComputer);
    const model = this._instantiationService.createInstance(
      MergeEditorModel,
      base.object,
      input1Data,
      input2Data,
      result.object.textEditorModel,
      mergeDiffComputer,
      {
        resetResult
      },
      this._mergeEditorTelemetry
    );
    store.add(model);
    await model.onInitialized;
    return this._instantiationService.createInstance(WorkspaceMergeEditorInputModel, model, store, resultTextFileModel, this._mergeEditorTelemetry);
  }
};
WorkspaceMergeEditorModeFactory = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ITextModelService),
  __decorateParam(3, ITextFileService),
  __decorateParam(4, IModelService),
  __decorateParam(5, ILanguageService)
], WorkspaceMergeEditorModeFactory);
let WorkspaceMergeEditorInputModel = class extends EditorModel {
  constructor(model, disposableStore, resultTextFileModel, telemetry, _dialogService, _storageService) {
    super();
    this.model = model;
    this.disposableStore = disposableStore;
    this.resultTextFileModel = resultTextFileModel;
    this.telemetry = telemetry;
    this._dialogService = _dialogService;
    this._storageService = _storageService;
    this.isDirty = observableFromEvent(
      this,
      Event.any(this.resultTextFileModel.onDidChangeDirty, this.resultTextFileModel.onDidSaveError),
      () => (
        /** @description isDirty */
        this.resultTextFileModel.isDirty()
      )
    );
    this.reported = false;
    this.dateTimeOpened = /* @__PURE__ */ new Date();
  }
  dispose() {
    this.disposableStore.dispose();
    super.dispose();
    this.reportClose(false);
  }
  reportClose(accepted) {
    if (!this.reported) {
      const remainingConflictCount = this.model.unhandledConflictsCount.get();
      const durationOpenedMs = (/* @__PURE__ */ new Date()).getTime() - this.dateTimeOpened.getTime();
      this.telemetry.reportMergeEditorClosed({
        durationOpenedSecs: durationOpenedMs / 1e3,
        remainingConflictCount,
        accepted,
        conflictCount: this.model.conflictCount,
        combinableConflictCount: this.model.combinableConflictCount,
        conflictsResolvedWithBase: this.model.conflictsResolvedWithBase,
        conflictsResolvedWithInput1: this.model.conflictsResolvedWithInput1,
        conflictsResolvedWithInput2: this.model.conflictsResolvedWithInput2,
        conflictsResolvedWithSmartCombination: this.model.conflictsResolvedWithSmartCombination,
        manuallySolvedConflictCountThatEqualNone: this.model.manuallySolvedConflictCountThatEqualNone,
        manuallySolvedConflictCountThatEqualSmartCombine: this.model.manuallySolvedConflictCountThatEqualSmartCombine,
        manuallySolvedConflictCountThatEqualInput1: this.model.manuallySolvedConflictCountThatEqualInput1,
        manuallySolvedConflictCountThatEqualInput2: this.model.manuallySolvedConflictCountThatEqualInput2,
        manuallySolvedConflictCountThatEqualNoneAndStartedWithBase: this.model.manuallySolvedConflictCountThatEqualNoneAndStartedWithBase,
        manuallySolvedConflictCountThatEqualNoneAndStartedWithInput1: this.model.manuallySolvedConflictCountThatEqualNoneAndStartedWithInput1,
        manuallySolvedConflictCountThatEqualNoneAndStartedWithInput2: this.model.manuallySolvedConflictCountThatEqualNoneAndStartedWithInput2,
        manuallySolvedConflictCountThatEqualNoneAndStartedWithBothNonSmart: this.model.manuallySolvedConflictCountThatEqualNoneAndStartedWithBothNonSmart,
        manuallySolvedConflictCountThatEqualNoneAndStartedWithBothSmart: this.model.manuallySolvedConflictCountThatEqualNoneAndStartedWithBothSmart
      });
      this.reported = true;
    }
  }
  async accept() {
    this.reportClose(true);
    await this.resultTextFileModel.save();
  }
  get resultUri() {
    return this.resultTextFileModel.resource;
  }
  async save(options) {
    await this.resultTextFileModel.save(options);
  }
  /**
   * If save resets the dirty state, revert must do so too.
  */
  async revert(options) {
    await this.resultTextFileModel.revert(options);
  }
  shouldConfirmClose() {
    return true;
  }
  async confirmClose(inputModels) {
    const isMany = inputModels.length > 1;
    const someDirty = inputModels.some((m) => m.isDirty.get());
    const someUnhandledConflicts = inputModels.some((m) => m.model.hasUnhandledConflicts.get());
    if (someDirty) {
      const message = isMany ? localize("workspace.messageN", "Do you want to save the changes you made to {0} files?", inputModels.length) : localize("workspace.message1", "Do you want to save the changes you made to {0}?", basename(inputModels[0].resultUri));
      const { result } = await this._dialogService.prompt({
        type: Severity.Info,
        message,
        detail: someUnhandledConflicts ? isMany ? localize("workspace.detailN.unhandled", "The files contain unhandled conflicts. Your changes will be lost if you don't save them.") : localize("workspace.detail1.unhandled", "The file contains unhandled conflicts. Your changes will be lost if you don't save them.") : isMany ? localize("workspace.detailN.handled", "Your changes will be lost if you don't save them.") : localize("workspace.detail1.handled", "Your changes will be lost if you don't save them."),
        buttons: [
          {
            label: someUnhandledConflicts ? localize({ key: "workspace.saveWithConflict", comment: ["&& denotes a mnemonic"] }, "&&Save with Conflicts") : localize({ key: "workspace.save", comment: ["&& denotes a mnemonic"] }, "&&Save"),
            run: () => ConfirmResult.SAVE
          },
          {
            label: localize({ key: "workspace.doNotSave", comment: ["&& denotes a mnemonic"] }, "Do&&n't Save"),
            run: () => ConfirmResult.DONT_SAVE
          }
        ],
        cancelButton: {
          run: () => ConfirmResult.CANCEL
        }
      });
      return result;
    } else if (someUnhandledConflicts && !this._storageService.getBoolean(StorageCloseWithConflicts, StorageScope.PROFILE, false)) {
      const { confirmed, checkboxChecked } = await this._dialogService.confirm({
        message: isMany ? localize("workspace.messageN.nonDirty", "Do you want to close {0} merge editors?", inputModels.length) : localize("workspace.message1.nonDirty", "Do you want to close the merge editor for {0}?", basename(inputModels[0].resultUri)),
        detail: someUnhandledConflicts ? isMany ? localize("workspace.detailN.unhandled.nonDirty", "The files contain unhandled conflicts.") : localize("workspace.detail1.unhandled.nonDirty", "The file contains unhandled conflicts.") : void 0,
        primaryButton: someUnhandledConflicts ? localize({ key: "workspace.closeWithConflicts", comment: ["&& denotes a mnemonic"] }, "&&Close with Conflicts") : localize({ key: "workspace.close", comment: ["&& denotes a mnemonic"] }, "&&Close"),
        checkbox: { label: localize("noMoreWarn", "Do not ask me again") }
      });
      if (checkboxChecked) {
        this._storageService.store(StorageCloseWithConflicts, true, StorageScope.PROFILE, StorageTarget.USER);
      }
      return confirmed ? ConfirmResult.SAVE : ConfirmResult.CANCEL;
    } else {
      return ConfirmResult.SAVE;
    }
  }
};
WorkspaceMergeEditorInputModel = __decorateClass([
  __decorateParam(4, IDialogService),
  __decorateParam(5, IStorageService)
], WorkspaceMergeEditorInputModel);
async function toInputData(data, textModelService, store) {
  const ref = await textModelService.createModelReference(data.uri);
  store.add(ref);
  return {
    textModel: ref.object.textEditorModel,
    title: data.title,
    description: data.description,
    detail: data.detail
  };
}
export {
  TempFileMergeEditorModeFactory,
  WorkspaceMergeEditorModeFactory
};
