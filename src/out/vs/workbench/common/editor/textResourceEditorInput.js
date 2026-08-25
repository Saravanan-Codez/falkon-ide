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
import { DEFAULT_EDITOR_ASSOCIATION, isResourceEditorInput } from "../editor.js";
import { AbstractResourceEditorInput } from "./resourceEditorInput.js";
import { ITextFileService } from "../../services/textfile/common/textfiles.js";
import { IEditorService } from "../../services/editor/common/editorService.js";
import { IFileService } from "../../../platform/files/common/files.js";
import { ILabelService } from "../../../platform/label/common/label.js";
import { Schemas } from "../../../base/common/network.js";
import { isEqual } from "../../../base/common/resources.js";
import { ITextModelService } from "../../../editor/common/services/resolverService.js";
import { TextResourceEditorModel } from "./textResourceEditorModel.js";
import { createTextBufferFactory } from "../../../editor/common/model/textModel.js";
import { IFilesConfigurationService } from "../../services/filesConfiguration/common/filesConfigurationService.js";
import { ITextResourceConfigurationService } from "../../../editor/common/services/textResourceConfiguration.js";
import { ICustomEditorLabelService } from "../../services/editor/common/customEditorLabelService.js";
let AbstractTextResourceEditorInput = class extends AbstractResourceEditorInput {
  constructor(resource, preferredResource, editorService, textFileService, labelService, fileService, filesConfigurationService, textResourceConfigurationService, customEditorLabelService) {
    super(resource, preferredResource, labelService, fileService, filesConfigurationService, textResourceConfigurationService, customEditorLabelService);
    this.editorService = editorService;
    this.textFileService = textFileService;
  }
  save(group, options) {
    if (this.resource.scheme !== Schemas.untitled && !this.fileService.hasProvider(this.resource)) {
      return this.saveAs(group, options);
    }
    return this.doSave(options, false, group);
  }
  saveAs(group, options) {
    return this.doSave(options, true, group);
  }
  async doSave(options, saveAs, group) {
    let target;
    if (saveAs) {
      target = await this.textFileService.saveAs(this.resource, void 0, { ...options, suggestedTarget: this.preferredResource });
    } else {
      target = await this.textFileService.save(this.resource, options);
    }
    if (!target) {
      return void 0;
    }
    return { resource: target };
  }
  async revert(group, options) {
    await this.textFileService.revert(this.resource, options);
  }
};
AbstractTextResourceEditorInput = __decorateClass([
  __decorateParam(2, IEditorService),
  __decorateParam(3, ITextFileService),
  __decorateParam(4, ILabelService),
  __decorateParam(5, IFileService),
  __decorateParam(6, IFilesConfigurationService),
  __decorateParam(7, ITextResourceConfigurationService),
  __decorateParam(8, ICustomEditorLabelService)
], AbstractTextResourceEditorInput);
let TextResourceEditorInput = class extends AbstractTextResourceEditorInput {
  constructor(resource, name, description, preferredLanguageId, preferredContents, textModelService, textFileService, editorService, fileService, labelService, filesConfigurationService, textResourceConfigurationService, customEditorLabelService) {
    super(resource, void 0, editorService, textFileService, labelService, fileService, filesConfigurationService, textResourceConfigurationService, customEditorLabelService);
    this.name = name;
    this.description = description;
    this.preferredLanguageId = preferredLanguageId;
    this.preferredContents = preferredContents;
    this.textModelService = textModelService;
    this.cachedModel = void 0;
    this.modelReference = void 0;
  }
  static {
    this.ID = "workbench.editors.resourceEditorInput";
  }
  get typeId() {
    return TextResourceEditorInput.ID;
  }
  get editorId() {
    return DEFAULT_EDITOR_ASSOCIATION.id;
  }
  getName() {
    return this.name || super.getName();
  }
  setName(name) {
    if (this.name !== name) {
      this.name = name;
      this._onDidChangeLabel.fire();
    }
  }
  getDescription() {
    return this.description;
  }
  setDescription(description) {
    if (this.description !== description) {
      this.description = description;
      this._onDidChangeLabel.fire();
    }
  }
  setLanguageId(languageId, source) {
    this.setPreferredLanguageId(languageId);
    this.cachedModel?.setLanguageId(languageId, source);
  }
  setPreferredLanguageId(languageId) {
    this.preferredLanguageId = languageId;
  }
  setPreferredContents(contents) {
    this.preferredContents = contents;
  }
  async resolve() {
    const preferredContents = this.preferredContents;
    const preferredLanguageId = this.preferredLanguageId;
    this.preferredContents = void 0;
    this.preferredLanguageId = void 0;
    if (!this.modelReference) {
      this.modelReference = this.textModelService.createModelReference(this.resource);
    }
    const ref = await this.modelReference;
    const model = ref.object;
    if (!(model instanceof TextResourceEditorModel)) {
      ref.dispose();
      this.modelReference = void 0;
      throw new Error(`Unexpected model for TextResourceEditorInput: ${this.resource}`);
    }
    this.cachedModel = model;
    if (typeof preferredContents === "string" || typeof preferredLanguageId === "string") {
      model.updateTextEditorModel(typeof preferredContents === "string" ? createTextBufferFactory(preferredContents) : void 0, preferredLanguageId);
    }
    return model;
  }
  matches(otherInput) {
    if (this === otherInput) {
      return true;
    }
    if (otherInput instanceof TextResourceEditorInput) {
      return isEqual(otherInput.resource, this.resource);
    }
    if (isResourceEditorInput(otherInput)) {
      return super.matches(otherInput);
    }
    return false;
  }
  dispose() {
    if (this.modelReference) {
      this.modelReference.then((ref) => ref.dispose());
      this.modelReference = void 0;
    }
    this.cachedModel = void 0;
    super.dispose();
  }
};
TextResourceEditorInput = __decorateClass([
  __decorateParam(5, ITextModelService),
  __decorateParam(6, ITextFileService),
  __decorateParam(7, IEditorService),
  __decorateParam(8, IFileService),
  __decorateParam(9, ILabelService),
  __decorateParam(10, IFilesConfigurationService),
  __decorateParam(11, ITextResourceConfigurationService),
  __decorateParam(12, ICustomEditorLabelService)
], TextResourceEditorInput);
export {
  AbstractTextResourceEditorInput,
  TextResourceEditorInput
};
