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
import { ITextFileService, TextFileEditorModelState } from "../../../../services/textfile/common/textfiles.js";
import { ILifecycleService } from "../../../../services/lifecycle/common/lifecycle.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { distinct, coalesce } from "../../../../../base/common/arrays.js";
import { IHostService } from "../../../../services/host/browser/host.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { RunOnceWorker } from "../../../../../base/common/async.js";
import { ICodeEditorService } from "../../../../../editor/browser/services/codeEditorService.js";
import { IFilesConfigurationService } from "../../../../services/filesConfiguration/common/filesConfigurationService.js";
import { FILE_EDITOR_INPUT_ID } from "../../common/files.js";
import { Schemas } from "../../../../../base/common/network.js";
import { UntitledTextEditorInput } from "../../../../services/untitled/common/untitledTextEditorInput.js";
import { IWorkingCopyEditorService } from "../../../../services/workingCopy/common/workingCopyEditorService.js";
import { DEFAULT_EDITOR_ASSOCIATION } from "../../../../common/editor.js";
let TextFileEditorTracker = class extends Disposable {
  constructor(editorService, textFileService, lifecycleService, hostService, codeEditorService, filesConfigurationService, workingCopyEditorService) {
    super();
    this.editorService = editorService;
    this.textFileService = textFileService;
    this.lifecycleService = lifecycleService;
    this.hostService = hostService;
    this.codeEditorService = codeEditorService;
    this.filesConfigurationService = filesConfigurationService;
    this.workingCopyEditorService = workingCopyEditorService;
    //#region Text File: Ensure every dirty text and untitled file is opened in an editor
    this.ensureDirtyFilesAreOpenedWorker = this._register(new RunOnceWorker((units) => this.ensureDirtyTextFilesAreOpened(units), this.getDirtyTextFileTrackerDelay()));
    this.registerListeners();
  }
  static {
    this.ID = "workbench.contrib.textFileEditorTracker";
  }
  registerListeners() {
    this._register(this.textFileService.files.onDidChangeDirty((model) => this.ensureDirtyFilesAreOpenedWorker.work(model.resource)));
    this._register(this.textFileService.files.onDidSaveError((model) => this.ensureDirtyFilesAreOpenedWorker.work(model.resource)));
    this._register(this.textFileService.untitled.onDidChangeDirty((model) => this.ensureDirtyFilesAreOpenedWorker.work(model.resource)));
    this._register(this.hostService.onDidChangeFocus((hasFocus) => hasFocus ? this.reloadVisibleTextFileEditors() : void 0));
    this._register(this.lifecycleService.onDidShutdown(() => this.dispose()));
  }
  getDirtyTextFileTrackerDelay() {
    return 800;
  }
  ensureDirtyTextFilesAreOpened(resources) {
    this.doEnsureDirtyTextFilesAreOpened(distinct(resources.filter((resource) => {
      if (!this.textFileService.isDirty(resource)) {
        return false;
      }
      const fileModel = this.textFileService.files.get(resource);
      if (fileModel?.hasState(TextFileEditorModelState.PENDING_SAVE)) {
        return false;
      }
      if (resource.scheme !== Schemas.untitled && !fileModel?.hasState(TextFileEditorModelState.ERROR) && this.filesConfigurationService.hasShortAutoSaveDelay(resource)) {
        return false;
      }
      if (this.editorService.isOpened({ resource, typeId: resource.scheme === Schemas.untitled ? UntitledTextEditorInput.ID : FILE_EDITOR_INPUT_ID, editorId: DEFAULT_EDITOR_ASSOCIATION.id })) {
        return false;
      }
      const model = fileModel ?? this.textFileService.untitled.get(resource);
      if (model && this.workingCopyEditorService.findEditor(model)) {
        return false;
      }
      return true;
    }), (resource) => resource.toString()));
  }
  doEnsureDirtyTextFilesAreOpened(resources) {
    if (!resources.length) {
      return;
    }
    this.editorService.openEditors(resources.map((resource) => ({
      resource,
      options: { inactive: true, pinned: true, preserveFocus: true }
    })));
  }
  //#endregion
  //#region Window Focus Change: Update visible code editors when focus is gained that have a known text file model
  reloadVisibleTextFileEditors() {
    distinct(
      coalesce(this.codeEditorService.listCodeEditors().map((codeEditor) => {
        const resource = codeEditor.getModel()?.uri;
        if (!resource) {
          return void 0;
        }
        const model = this.textFileService.files.get(resource);
        if (!model || model.isDirty() || !model.isResolved()) {
          return void 0;
        }
        return model;
      })),
      (model) => model.resource.toString()
    ).forEach((model) => this.textFileService.files.resolve(model.resource, { reload: { async: true } }));
  }
  //#endregion
};
TextFileEditorTracker = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, ITextFileService),
  __decorateParam(2, ILifecycleService),
  __decorateParam(3, IHostService),
  __decorateParam(4, ICodeEditorService),
  __decorateParam(5, IFilesConfigurationService),
  __decorateParam(6, IWorkingCopyEditorService)
], TextFileEditorTracker);
export {
  TextFileEditorTracker
};
