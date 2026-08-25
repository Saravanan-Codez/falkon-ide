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
import { autorun } from "../../../../base/common/observable.js";
import { isEqual } from "../../../../base/common/resources.js";
import { isDefined } from "../../../../base/common/types.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { DEFAULT_EDITOR_ASSOCIATION, EditorInputCapabilities, isResourceMergeEditorInput } from "../../../common/editor.js";
import { ICustomEditorLabelService } from "../../../services/editor/common/customEditorLabelService.js";
import { AbstractTextResourceEditorInput } from "../../../common/editor/textResourceEditorInput.js";
import { TempFileMergeEditorModeFactory, WorkspaceMergeEditorModeFactory } from "./mergeEditorInputModel.js";
import { MergeEditorTelemetry } from "./telemetry.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IFilesConfigurationService } from "../../../services/filesConfiguration/common/filesConfigurationService.js";
import { ITextFileService } from "../../../services/textfile/common/textfiles.js";
import { alert } from "../../../../base/browser/ui/aria/aria.js";
import { ILogService } from "../../../../platform/log/common/log.js";
class MergeEditorInputData {
  constructor(uri, title, detail, description) {
    this.uri = uri;
    this.title = title;
    this.detail = detail;
    this.description = description;
  }
}
let MergeEditorInput = class extends AbstractTextResourceEditorInput {
  constructor(base, input1, input2, result, _instaService, editorService, textFileService, labelService, fileService, configurationService, filesConfigurationService, textResourceConfigurationService, customEditorLabelService, logService) {
    super(result, void 0, editorService, textFileService, labelService, fileService, filesConfigurationService, textResourceConfigurationService, customEditorLabelService);
    this.base = base;
    this.input1 = input1;
    this.input2 = input2;
    this.result = result;
    this._instaService = _instaService;
    this.configurationService = configurationService;
    this.logService = logService;
    this._focusedEditor = "result";
    this.closeHandler = {
      showConfirm: () => this._inputModel?.shouldConfirmClose() ?? false,
      confirm: async (editors) => {
        assertFn(() => editors.every((e) => e.editor instanceof MergeEditorInput));
        const inputModels = editors.map((e) => e.editor._inputModel).filter(isDefined);
        return await this._inputModel.confirmClose(inputModels);
      }
    };
    this.mergeEditorModeFactory = this._instaService.createInstance(
      this.useWorkingCopy ? TempFileMergeEditorModeFactory : WorkspaceMergeEditorModeFactory,
      this._instaService.createInstance(MergeEditorTelemetry)
    );
  }
  static {
    this.ID = "mergeEditor.Input";
  }
  get useWorkingCopy() {
    return this.configurationService.getValue("mergeEditor.useWorkingCopy") ?? false;
  }
  dispose() {
    super.dispose();
  }
  get typeId() {
    return MergeEditorInput.ID;
  }
  get editorId() {
    return DEFAULT_EDITOR_ASSOCIATION.id;
  }
  get capabilities() {
    let capabilities = super.capabilities | EditorInputCapabilities.MultipleEditors;
    if (this.useWorkingCopy) {
      capabilities |= EditorInputCapabilities.Untitled;
    }
    return capabilities;
  }
  getName() {
    return localize("name", "Merging: {0}", super.getName());
  }
  async resolve() {
    if (!this._inputModel) {
      const inputModel = this._register(await this.mergeEditorModeFactory.createInputModel({
        base: this.base,
        input1: this.input1,
        input2: this.input2,
        result: this.result
      }));
      this._inputModel = inputModel;
      this._register(autorun((reader) => {
        inputModel.isDirty.read(reader);
        this._onDidChangeDirty.fire();
      }));
      await this._inputModel.model.onInitialized;
    }
    return this._inputModel;
  }
  async accept() {
    await this._inputModel?.accept();
  }
  async save(group, options) {
    await this._inputModel?.save(options);
    return void 0;
  }
  toUntyped() {
    return {
      input1: { resource: this.input1.uri, label: this.input1.title, description: this.input1.description, detail: this.input1.detail },
      input2: { resource: this.input2.uri, label: this.input2.title, description: this.input2.description, detail: this.input2.detail },
      base: { resource: this.base },
      result: { resource: this.result },
      options: {
        override: this.typeId
      }
    };
  }
  matches(otherInput) {
    if (this === otherInput) {
      return true;
    }
    if (otherInput instanceof MergeEditorInput) {
      return isEqual(this.base, otherInput.base) && isEqual(this.input1.uri, otherInput.input1.uri) && isEqual(this.input2.uri, otherInput.input2.uri) && isEqual(this.result, otherInput.result);
    }
    if (isResourceMergeEditorInput(otherInput)) {
      return (this.editorId === otherInput.options?.override || otherInput.options?.override === void 0) && isEqual(this.base, otherInput.base.resource) && isEqual(this.input1.uri, otherInput.input1.resource) && isEqual(this.input2.uri, otherInput.input2.resource) && isEqual(this.result, otherInput.result.resource);
    }
    return false;
  }
  async revert(group, options) {
    return this._inputModel?.revert(options);
  }
  // ---- FileEditorInput
  isDirty() {
    return this._inputModel?.isDirty.get() ?? false;
  }
  setLanguageId(languageId, source) {
    this._inputModel?.model.setLanguageId(languageId, source);
  }
  /**
   * Updates the focused editor and triggers a name change event
   */
  updateFocusedEditor(editor) {
    if (this._focusedEditor !== editor) {
      this._focusedEditor = editor;
      this.logService.trace("alertFocusedEditor", editor);
      alertFocusedEditor(editor);
    }
  }
  // implement get/set encoding
};
MergeEditorInput = __decorateClass([
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IEditorService),
  __decorateParam(6, ITextFileService),
  __decorateParam(7, ILabelService),
  __decorateParam(8, IFileService),
  __decorateParam(9, IConfigurationService),
  __decorateParam(10, IFilesConfigurationService),
  __decorateParam(11, ITextResourceConfigurationService),
  __decorateParam(12, ICustomEditorLabelService),
  __decorateParam(13, ILogService)
], MergeEditorInput);
function alertFocusedEditor(editor) {
  switch (editor) {
    case "input1":
      alert(localize("mergeEditor.input1", "Incoming, Left Input"));
      break;
    case "input2":
      alert(localize("mergeEditor.input2", "Current, Right Input"));
      break;
    case "result":
      alert(localize("mergeEditor.result", "Merge Result"));
      break;
  }
}
export {
  MergeEditorInput,
  MergeEditorInputData
};
