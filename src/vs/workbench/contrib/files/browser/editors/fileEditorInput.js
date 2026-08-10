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
import { EditorInputCapabilities, DEFAULT_EDITOR_ASSOCIATION, findViewStateForEditor, isResourceEditorInput } from "../../../../common/editor.js";
import { AbstractTextResourceEditorInput } from "../../../../common/editor/textResourceEditorInput.js";
import { BinaryEditorModel } from "../../../../common/editor/binaryEditorModel.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { ITextFileService, TextFileEditorModelState, TextFileResolveReason, TextFileOperationResult } from "../../../../services/textfile/common/textfiles.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { dispose, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { FILE_EDITOR_INPUT_ID, TEXT_FILE_EDITOR_ID, BINARY_FILE_EDITOR_ID } from "../../common/files.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { IFilesConfigurationService } from "../../../../services/filesConfiguration/common/filesConfigurationService.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { Event } from "../../../../../base/common/event.js";
import { Schemas } from "../../../../../base/common/network.js";
import { createTextBufferFactory } from "../../../../../editor/common/model/textModel.js";
import { IPathService } from "../../../../services/path/common/pathService.js";
import { ITextResourceConfigurationService } from "../../../../../editor/common/services/textResourceConfiguration.js";
import { ICustomEditorLabelService } from "../../../../services/editor/common/customEditorLabelService.js";
var ForceOpenAs = /* @__PURE__ */ ((ForceOpenAs2) => {
  ForceOpenAs2[ForceOpenAs2["None"] = 0] = "None";
  ForceOpenAs2[ForceOpenAs2["Text"] = 1] = "Text";
  ForceOpenAs2[ForceOpenAs2["Binary"] = 2] = "Binary";
  return ForceOpenAs2;
})(ForceOpenAs || {});
let FileEditorInput = class extends AbstractTextResourceEditorInput {
  constructor(resource, preferredResource, preferredName, preferredDescription, preferredEncoding, preferredLanguageId, preferredContents, instantiationService, textFileService, textModelService, labelService, fileService, filesConfigurationService, editorService, pathService, textResourceConfigurationService, customEditorLabelService) {
    super(resource, preferredResource, editorService, textFileService, labelService, fileService, filesConfigurationService, textResourceConfigurationService, customEditorLabelService);
    this.instantiationService = instantiationService;
    this.textModelService = textModelService;
    this.pathService = pathService;
    this.forceOpenAs = 0 /* None */;
    this.model = void 0;
    this.cachedTextFileModelReference = void 0;
    this.modelListeners = this._register(new DisposableStore());
    this.model = this.textFileService.files.get(resource);
    if (preferredName) {
      this.setPreferredName(preferredName);
    }
    if (preferredDescription) {
      this.setPreferredDescription(preferredDescription);
    }
    if (preferredEncoding) {
      this.setPreferredEncoding(preferredEncoding);
    }
    if (preferredLanguageId) {
      this.setPreferredLanguageId(preferredLanguageId);
    }
    if (typeof preferredContents === "string") {
      this.setPreferredContents(preferredContents);
    }
    this._register(this.textFileService.files.onDidCreate((model) => this.onDidCreateTextFileModel(model)));
    if (this.model) {
      this.registerModelListeners(this.model);
    }
  }
  get typeId() {
    return FILE_EDITOR_INPUT_ID;
  }
  get editorId() {
    return DEFAULT_EDITOR_ASSOCIATION.id;
  }
  get capabilities() {
    let capabilities = EditorInputCapabilities.CanSplitInGroup;
    if (this.model) {
      if (this.model.isReadonly()) {
        capabilities |= EditorInputCapabilities.Readonly;
      }
    } else {
      if (this.fileService.hasProvider(this.resource)) {
        if (this.filesConfigurationService.isReadonly(this.resource)) {
          capabilities |= EditorInputCapabilities.Readonly;
        }
      } else {
        capabilities |= EditorInputCapabilities.Untitled;
      }
    }
    if (!(capabilities & EditorInputCapabilities.Readonly)) {
      capabilities |= EditorInputCapabilities.CanDropIntoEditor;
    }
    return capabilities;
  }
  onDidCreateTextFileModel(model) {
    if (isEqual(model.resource, this.resource)) {
      this.model = model;
      this.registerModelListeners(model);
    }
  }
  registerModelListeners(model) {
    this.modelListeners.clear();
    this.modelListeners.add(model.onDidChangeDirty(() => this._onDidChangeDirty.fire()));
    this.modelListeners.add(model.onDidChangeReadonly(() => this._onDidChangeCapabilities.fire()));
    this.modelListeners.add(model.onDidSaveError(() => this._onDidChangeDirty.fire()));
    this.modelListeners.add(Event.once(model.onWillDispose)(() => {
      this.modelListeners.clear();
      this.model = void 0;
    }));
  }
  getName() {
    return this.preferredName || super.getName();
  }
  setPreferredName(name) {
    if (!this.allowLabelOverride()) {
      return;
    }
    if (this.preferredName !== name) {
      this.preferredName = name;
      this._onDidChangeLabel.fire();
    }
  }
  allowLabelOverride() {
    return this.resource.scheme !== this.pathService.defaultUriScheme && this.resource.scheme !== Schemas.vscodeUserData && this.resource.scheme !== Schemas.file && this.resource.scheme !== Schemas.vscodeRemote;
  }
  getPreferredName() {
    return this.preferredName;
  }
  isReadonly() {
    return this.model ? this.model.isReadonly() : this.filesConfigurationService.isReadonly(this.resource);
  }
  getDescription(verbosity) {
    return this.preferredDescription || super.getDescription(verbosity);
  }
  setPreferredDescription(description) {
    if (!this.allowLabelOverride()) {
      return;
    }
    if (this.preferredDescription !== description) {
      this.preferredDescription = description;
      this._onDidChangeLabel.fire();
    }
  }
  getPreferredDescription() {
    return this.preferredDescription;
  }
  getTitle(verbosity) {
    let title = super.getTitle(verbosity);
    const preferredTitle = this.getPreferredTitle();
    if (preferredTitle) {
      title = `${preferredTitle} (${title})`;
    }
    return title;
  }
  getPreferredTitle() {
    if (this.preferredName && this.preferredDescription) {
      return `${this.preferredName} ${this.preferredDescription}`;
    }
    if (this.preferredName || this.preferredDescription) {
      return this.preferredName ?? this.preferredDescription;
    }
    return void 0;
  }
  getEncoding() {
    if (this.model) {
      return this.model.getEncoding();
    }
    return this.preferredEncoding;
  }
  getPreferredEncoding() {
    return this.preferredEncoding;
  }
  async setEncoding(encoding, mode) {
    this.setPreferredEncoding(encoding);
    return this.model?.setEncoding(encoding, mode);
  }
  setPreferredEncoding(encoding) {
    this.preferredEncoding = encoding;
    this.setForceOpenAsText();
  }
  getLanguageId() {
    if (this.model) {
      return this.model.getLanguageId();
    }
    return this.preferredLanguageId;
  }
  getPreferredLanguageId() {
    return this.preferredLanguageId;
  }
  setLanguageId(languageId, source) {
    this.setPreferredLanguageId(languageId);
    this.model?.setLanguageId(languageId, source);
  }
  setPreferredLanguageId(languageId) {
    this.preferredLanguageId = languageId;
    this.setForceOpenAsText();
  }
  setPreferredContents(contents) {
    this.preferredContents = contents;
    this.setForceOpenAsText();
  }
  setForceOpenAsText() {
    this.forceOpenAs = 1 /* Text */;
  }
  setForceOpenAsBinary() {
    this.forceOpenAs = 2 /* Binary */;
  }
  isDirty() {
    return !!this.model?.isDirty();
  }
  isSaving() {
    if (this.model?.hasState(TextFileEditorModelState.SAVED) || this.model?.hasState(TextFileEditorModelState.CONFLICT) || this.model?.hasState(TextFileEditorModelState.ERROR)) {
      return false;
    }
    if (this.filesConfigurationService.hasShortAutoSaveDelay(this)) {
      return true;
    }
    return super.isSaving();
  }
  prefersEditorPane(editorPanes) {
    if (this.forceOpenAs === 2 /* Binary */) {
      return editorPanes.find((editorPane) => editorPane.typeId === BINARY_FILE_EDITOR_ID);
    }
    return editorPanes.find((editorPane) => editorPane.typeId === TEXT_FILE_EDITOR_ID);
  }
  resolve(options) {
    if (this.forceOpenAs === 2 /* Binary */) {
      return this.doResolveAsBinary();
    }
    return this.doResolveAsText(options);
  }
  async doResolveAsText(options) {
    try {
      const preferredContents = this.preferredContents;
      this.preferredContents = void 0;
      await this.textFileService.files.resolve(this.resource, {
        languageId: this.preferredLanguageId,
        encoding: this.preferredEncoding,
        contents: typeof preferredContents === "string" ? createTextBufferFactory(preferredContents) : void 0,
        reload: { async: true },
        // trigger a reload of the model if it exists already but do not wait to show the model
        allowBinary: this.forceOpenAs === 1 /* Text */,
        reason: TextFileResolveReason.EDITOR,
        limits: this.ensureLimits(options)
      });
      if (!this.cachedTextFileModelReference) {
        this.cachedTextFileModelReference = await this.textModelService.createModelReference(this.resource);
      }
      const model = this.cachedTextFileModelReference.object;
      if (this.isDisposed()) {
        this.disposeModelReference();
      }
      return model;
    } catch (error) {
      if (error.textFileOperationResult === TextFileOperationResult.FILE_IS_BINARY) {
        return this.doResolveAsBinary();
      }
      throw error;
    }
  }
  async doResolveAsBinary() {
    const model = this.instantiationService.createInstance(BinaryEditorModel, this.preferredResource, this.getName());
    await model.resolve();
    return model;
  }
  isResolved() {
    return !!this.model;
  }
  async rename(group, target) {
    return {
      editor: {
        resource: target,
        encoding: this.getEncoding(),
        options: {
          viewState: findViewStateForEditor(this, group, this.editorService)
        }
      }
    };
  }
  toUntyped(options) {
    const untypedInput = {
      resource: this.preferredResource,
      forceFile: true,
      options: {
        override: this.editorId
      }
    };
    if (typeof options?.preserveViewState === "number") {
      untypedInput.encoding = this.getEncoding();
      untypedInput.languageId = this.getLanguageId();
      untypedInput.contents = (() => {
        const model = this.textFileService.files.get(this.resource);
        if (model?.isDirty() && !model.textEditorModel.isTooLargeForHeapOperation()) {
          return model.textEditorModel.getValue();
        }
        return void 0;
      })();
      untypedInput.options = {
        ...untypedInput.options,
        viewState: findViewStateForEditor(this, options.preserveViewState, this.editorService)
      };
    }
    return untypedInput;
  }
  matches(otherInput) {
    if (this === otherInput) {
      return true;
    }
    if (otherInput instanceof FileEditorInput) {
      return isEqual(otherInput.resource, this.resource);
    }
    if (isResourceEditorInput(otherInput)) {
      return super.matches(otherInput);
    }
    return false;
  }
  dispose() {
    this.model = void 0;
    this.disposeModelReference();
    super.dispose();
  }
  disposeModelReference() {
    dispose(this.cachedTextFileModelReference);
    this.cachedTextFileModelReference = void 0;
  }
};
FileEditorInput = __decorateClass([
  __decorateParam(7, IInstantiationService),
  __decorateParam(8, ITextFileService),
  __decorateParam(9, ITextModelService),
  __decorateParam(10, ILabelService),
  __decorateParam(11, IFileService),
  __decorateParam(12, IFilesConfigurationService),
  __decorateParam(13, IEditorService),
  __decorateParam(14, IPathService),
  __decorateParam(15, ITextResourceConfigurationService),
  __decorateParam(16, ICustomEditorLabelService)
], FileEditorInput);
export {
  FileEditorInput
};
