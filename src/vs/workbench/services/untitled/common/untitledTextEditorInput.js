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
import { DEFAULT_EDITOR_ASSOCIATION, findViewStateForEditor, isUntitledResourceEditorInput, Verbosity } from "../../../common/editor.js";
import { AbstractTextResourceEditorInput } from "../../../common/editor/textResourceEditorInput.js";
import { ITextFileService } from "../../textfile/common/textfiles.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { IEditorService } from "../../editor/common/editorService.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { isEqual, toLocalResource } from "../../../../base/common/resources.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { IPathService } from "../../path/common/pathService.js";
import { IFilesConfigurationService } from "../../filesConfiguration/common/filesConfigurationService.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { DisposableStore, dispose } from "../../../../base/common/lifecycle.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { ICustomEditorLabelService } from "../../editor/common/customEditorLabelService.js";
let UntitledTextEditorInput = class extends AbstractTextResourceEditorInput {
  constructor(model, textFileService, labelService, editorService, fileService, environmentService, pathService, filesConfigurationService, textModelService, textResourceConfigurationService, customEditorLabelService) {
    super(model.resource, void 0, editorService, textFileService, labelService, fileService, filesConfigurationService, textResourceConfigurationService, customEditorLabelService);
    this.model = model;
    this.environmentService = environmentService;
    this.pathService = pathService;
    this.textModelService = textModelService;
    this.modelResolve = void 0;
    this.modelDisposables = this._register(new DisposableStore());
    this.cachedUntitledTextEditorModelReference = void 0;
    this.registerModelListeners(model);
    this._register(this.textFileService.untitled.onDidCreate((model2) => this.onDidCreateUntitledModel(model2)));
  }
  static {
    this.ID = "workbench.editors.untitledEditorInput";
  }
  get typeId() {
    return UntitledTextEditorInput.ID;
  }
  get editorId() {
    return DEFAULT_EDITOR_ASSOCIATION.id;
  }
  registerModelListeners(model) {
    this.modelDisposables.clear();
    this.modelDisposables.add(model.onDidChangeDirty(() => this._onDidChangeDirty.fire()));
    this.modelDisposables.add(model.onDidChangeName(() => this._onDidChangeLabel.fire()));
    this.modelDisposables.add(model.onDidRevert(() => this.dispose()));
  }
  onDidCreateUntitledModel(model) {
    if (isEqual(model.resource, this.model.resource) && model !== this.model) {
      this.model = model;
      this.registerModelListeners(model);
    }
  }
  getName() {
    return this.model.name;
  }
  getDescription(verbosity = Verbosity.MEDIUM) {
    if (!this.model.hasAssociatedFilePath) {
      const descriptionCandidate = this.resource.path;
      if (descriptionCandidate !== this.getName()) {
        return descriptionCandidate;
      }
      return void 0;
    }
    return super.getDescription(verbosity);
  }
  getTitle(verbosity) {
    if (!this.model.hasAssociatedFilePath) {
      const name = this.getName();
      const description = this.getDescription();
      if (description && description !== name) {
        return `${name} \u2022 ${description}`;
      }
      return name;
    }
    return super.getTitle(verbosity);
  }
  isDirty() {
    return this.model.isDirty();
  }
  getEncoding() {
    return this.model.getEncoding();
  }
  setEncoding(encoding, mode) {
    return this.model.setEncoding(encoding);
  }
  get hasLanguageSetExplicitly() {
    return this.model.hasLanguageSetExplicitly;
  }
  get hasAssociatedFilePath() {
    return this.model.hasAssociatedFilePath;
  }
  setLanguageId(languageId, source) {
    this.model.setLanguageId(languageId, source);
  }
  getLanguageId() {
    return this.model.getLanguageId();
  }
  async resolve() {
    if (!this.modelResolve) {
      this.modelResolve = (async () => {
        this.cachedUntitledTextEditorModelReference = await this.textModelService.createModelReference(this.resource);
      })();
    }
    await this.modelResolve;
    if (this.isDisposed()) {
      this.disposeModelReference();
    }
    return this.model;
  }
  toUntyped(options) {
    const untypedInput = {
      resource: this.model.hasAssociatedFilePath ? toLocalResource(this.model.resource, this.environmentService.remoteAuthority, this.pathService.defaultUriScheme) : this.resource,
      forceUntitled: true,
      options: {
        override: this.editorId
      }
    };
    if (typeof options?.preserveViewState === "number") {
      untypedInput.encoding = this.getEncoding();
      untypedInput.languageId = this.getLanguageId();
      untypedInput.contents = this.model.isModified() ? this.model.textEditorModel?.getValue() : void 0;
      untypedInput.options.viewState = findViewStateForEditor(this, options.preserveViewState, this.editorService);
      if (typeof untypedInput.contents === "string" && !this.model.hasAssociatedFilePath && !options.preserveResource) {
        untypedInput.resource = void 0;
      }
    }
    return untypedInput;
  }
  matches(otherInput) {
    if (this === otherInput) {
      return true;
    }
    if (otherInput instanceof UntitledTextEditorInput) {
      return isEqual(otherInput.resource, this.resource);
    }
    if (isUntitledResourceEditorInput(otherInput)) {
      return super.matches(otherInput);
    }
    return false;
  }
  dispose() {
    this.modelResolve = void 0;
    this.disposeModelReference();
    super.dispose();
  }
  disposeModelReference() {
    dispose(this.cachedUntitledTextEditorModelReference);
    this.cachedUntitledTextEditorModelReference = void 0;
  }
};
UntitledTextEditorInput = __decorateClass([
  __decorateParam(1, ITextFileService),
  __decorateParam(2, ILabelService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IFileService),
  __decorateParam(5, IWorkbenchEnvironmentService),
  __decorateParam(6, IPathService),
  __decorateParam(7, IFilesConfigurationService),
  __decorateParam(8, ITextModelService),
  __decorateParam(9, ITextResourceConfigurationService),
  __decorateParam(10, ICustomEditorLabelService)
], UntitledTextEditorInput);
export {
  UntitledTextEditorInput
};
