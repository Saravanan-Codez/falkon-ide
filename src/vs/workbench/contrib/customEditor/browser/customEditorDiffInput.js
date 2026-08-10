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
import { basename, isEqual } from "../../../../base/common/resources.js";
import { MutableDisposable } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IUndoRedoService } from "../../../../platform/undoRedo/common/undoRedo.js";
import { EditorInputCapabilities, isEditorInput, isResourceEditorInput, isResourceDiffEditorInput } from "../../../common/editor.js";
import { IFilesConfigurationService } from "../../../services/filesConfiguration/common/filesConfigurationService.js";
import { ICustomEditorService } from "../common/customEditor.js";
import { IWebviewService } from "../../webview/browser/webview.js";
import { IWebviewWorkbenchService, LazilyResolvedWebviewEditorInput } from "../../webviewPanel/browser/webviewWorkbenchService.js";
function getCustomEditorSideBySideDiffInputResource(init) {
  return init.side === "original" ? init.originalResource : init.modifiedResource;
}
let CustomEditorDiffInput = class extends LazilyResolvedWebviewEditorInput {
  constructor(init, webview, themeService, webviewWorkbenchService, instantiationService, customEditorService, filesConfigurationService, fileDialogService, undoRedoService) {
    super({ providedId: init.viewType, viewType: init.viewType, name: init.label ?? "", iconPath: init.iconPath }, webview, themeService, webviewWorkbenchService);
    this.init = init;
    this.instantiationService = instantiationService;
    this.customEditorService = customEditorService;
    this.filesConfigurationService = filesConfigurationService;
    this.fileDialogService = fileDialogService;
    this.undoRedoService = undoRedoService;
    this._modelRef = this._register(new MutableDisposable());
    this._register(this.filesConfigurationService.onDidChangeReadonly(() => this._onDidChangeCapabilities.fire()));
  }
  static create(instantiationService, init, group) {
    return instantiationService.invokeFunction((accessor) => {
      const webview = accessor.get(IWebviewService).createWebviewOverlay({
        providedViewType: init.viewType,
        title: init.label,
        options: {},
        contentOptions: {},
        extension: void 0
      });
      const input = instantiationService.createInstance(CustomEditorDiffInput, init, webview);
      if (group) {
        input.updateGroup(group.id);
      }
      return input;
    });
  }
  static {
    this.typeId = "workbench.editors.customDiffEditor";
  }
  get typeId() {
    return CustomEditorDiffInput.typeId;
  }
  get editorId() {
    return this.viewType;
  }
  get capabilities() {
    let capabilities = EditorInputCapabilities.Singleton | EditorInputCapabilities.CanDropIntoEditor;
    if (this.isReadonly()) {
      capabilities |= EditorInputCapabilities.Readonly;
    }
    return capabilities;
  }
  get resource() {
    return this.modifiedResource;
  }
  get originalResource() {
    return this.init.originalResource;
  }
  get modifiedResource() {
    return this.init.modifiedResource;
  }
  get diffResources() {
    return {
      original: this.originalResource,
      modified: this.modifiedResource
    };
  }
  getName() {
    return this.init.label ?? localize("customEditorDiffLabel", "{0} - {1}", basename(this.originalResource), basename(this.modifiedResource));
  }
  getDescription(_verbosity) {
    return this.init.description ?? super.getDescription();
  }
  getTitle(verbosity) {
    const description = this.getDescription(verbosity);
    if (description) {
      return localize("customEditorDiffTitle", "{0} ({1})", this.getName(), description);
    }
    return this.getName();
  }
  isReadonly() {
    const modelRef = this._modelRef.value;
    if (!modelRef) {
      return this.filesConfigurationService.isReadonly(this.modifiedResource);
    }
    return modelRef.object.isReadonly();
  }
  isDirty() {
    return this._modelRef.value?.object.isDirty() ?? false;
  }
  matches(otherInput) {
    if (this === otherInput) {
      return true;
    }
    if (otherInput instanceof CustomEditorDiffInput) {
      return this.viewType === otherInput.viewType && isEqual(this.originalResource, otherInput.originalResource) && isEqual(this.modifiedResource, otherInput.modifiedResource);
    }
    if (isEditorInput(otherInput)) {
      return false;
    }
    if (isResourceDiffEditorInput(otherInput)) {
      const override = otherInput.options?.override;
      return override === this.viewType && isEqual(this.originalResource, otherInput.original.resource) && isEqual(this.modifiedResource, otherInput.modified.resource);
    }
    return false;
  }
  copy() {
    return CustomEditorDiffInput.create(this.instantiationService, this.init, void 0);
  }
  async save(groupId, options) {
    const modelRef = this._modelRef.value;
    if (!modelRef) {
      return void 0;
    }
    const target = await modelRef.object.saveCustomEditor(options);
    if (!target) {
      return void 0;
    }
    if (!isEqual(target, this.modifiedResource)) {
      return this.toUntypedWithModifiedResource(target);
    }
    return this;
  }
  async saveAs(groupId, options) {
    const modelRef = this._modelRef.value;
    if (!modelRef) {
      return void 0;
    }
    const target = await this.fileDialogService.pickFileToSave(this.modifiedResource, options?.availableFileSystems);
    if (!target) {
      return void 0;
    }
    if (!await modelRef.object.saveCustomEditorAs(this.modifiedResource, target, options)) {
      return void 0;
    }
    return this.toUntypedWithModifiedResource(target);
  }
  async revert(group, options) {
    await this._modelRef.value?.object.revert(options);
  }
  async resolve() {
    await super.resolve();
    if (this.isDisposed()) {
      return null;
    }
    if (!this._modelRef.value) {
      const modelRef = this.customEditorService.models.tryRetain(this.modifiedResource, this.viewType);
      if (modelRef) {
        const oldCapabilities = this.capabilities;
        const retainedModelRef = await modelRef;
        if (this.isDisposed()) {
          retainedModelRef.dispose();
          return null;
        }
        this._modelRef.value = retainedModelRef;
        this._register(retainedModelRef.object.onDidChangeDirty(() => this._onDidChangeDirty.fire()));
        this._register(retainedModelRef.object.onDidChangeReadonly(() => this._onDidChangeCapabilities.fire()));
        if (this.isDirty()) {
          this._onDidChangeDirty.fire();
        }
        if (this.capabilities !== oldCapabilities) {
          this._onDidChangeCapabilities.fire();
        }
      }
    }
    return null;
  }
  undo() {
    return this.undoRedoService.undo(this.modifiedResource);
  }
  redo() {
    return this.undoRedoService.redo(this.modifiedResource);
  }
  toUntyped(_options) {
    return this.toUntypedWithModifiedResource(this.modifiedResource);
  }
  toUntypedWithModifiedResource(modifiedResource) {
    return {
      original: { resource: this.originalResource },
      modified: { resource: modifiedResource },
      label: this.init.label,
      description: this.init.description,
      options: {
        override: this.viewType
      }
    };
  }
};
CustomEditorDiffInput = __decorateClass([
  __decorateParam(2, IThemeService),
  __decorateParam(3, IWebviewWorkbenchService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, ICustomEditorService),
  __decorateParam(6, IFilesConfigurationService),
  __decorateParam(7, IFileDialogService),
  __decorateParam(8, IUndoRedoService)
], CustomEditorDiffInput);
let CustomEditorSideBySideDiffInput = class extends LazilyResolvedWebviewEditorInput {
  constructor(init, webview, themeService, webviewWorkbenchService, instantiationService, customEditorService, filesConfigurationService, fileDialogService, undoRedoService) {
    super({ providedId: init.viewType, viewType: init.viewType, name: basename(getCustomEditorSideBySideDiffInputResource(init)), iconPath: init.iconPath }, webview, themeService, webviewWorkbenchService);
    this.init = init;
    this.instantiationService = instantiationService;
    this.customEditorService = customEditorService;
    this.filesConfigurationService = filesConfigurationService;
    this.fileDialogService = fileDialogService;
    this.undoRedoService = undoRedoService;
    this._modelRef = this._register(new MutableDisposable());
    this._register(this.filesConfigurationService.onDidChangeReadonly(() => this._onDidChangeCapabilities.fire()));
  }
  static create(instantiationService, init, group) {
    return instantiationService.invokeFunction((accessor) => {
      const webview = accessor.get(IWebviewService).createWebviewOverlay({
        providedViewType: init.viewType,
        title: basename(getCustomEditorSideBySideDiffInputResource(init)),
        options: {},
        contentOptions: {},
        extension: void 0
      });
      const input = instantiationService.createInstance(CustomEditorSideBySideDiffInput, init, webview);
      if (group) {
        input.updateGroup(group.id);
      }
      return input;
    });
  }
  static {
    this.typeId = "workbench.editors.customSideBySideDiffEditor";
  }
  get typeId() {
    return CustomEditorSideBySideDiffInput.typeId;
  }
  get editorId() {
    return this.viewType;
  }
  get capabilities() {
    let capabilities = EditorInputCapabilities.Singleton | EditorInputCapabilities.CanDropIntoEditor;
    if (this.isReadonly()) {
      capabilities |= EditorInputCapabilities.Readonly;
    }
    return capabilities;
  }
  get resource() {
    return this.side === "original" ? this.originalResource : this.modifiedResource;
  }
  get originalResource() {
    return this.init.originalResource;
  }
  get modifiedResource() {
    return this.init.modifiedResource;
  }
  get side() {
    return this.init.side;
  }
  get diffId() {
    return this.init.diffId;
  }
  getName() {
    return basename(this.resource);
  }
  getDescription(_verbosity) {
    return this.init.description ?? super.getDescription();
  }
  getTitle(verbosity) {
    const description = this.getDescription(verbosity);
    if (description) {
      return localize("customEditorSideBySideDiffTitle", "{0} ({1})", this.getName(), description);
    }
    return this.getName();
  }
  isReadonly() {
    if (this.side === "original") {
      return true;
    }
    const modelRef = this._modelRef.value;
    if (!modelRef) {
      return this.filesConfigurationService.isReadonly(this.modifiedResource);
    }
    return modelRef.object.isReadonly();
  }
  isDirty() {
    return this.side === "modified" ? this._modelRef.value?.object.isDirty() ?? false : false;
  }
  matches(otherInput) {
    if (this === otherInput) {
      return true;
    }
    if (otherInput instanceof CustomEditorSideBySideDiffInput) {
      return this.editorId === otherInput.editorId && this.side === otherInput.side && isEqual(this.originalResource, otherInput.originalResource) && isEqual(this.modifiedResource, otherInput.modifiedResource);
    }
    if (isEditorInput(otherInput)) {
      return false;
    }
    if (isResourceEditorInput(otherInput)) {
      return isEqual(this.resource, otherInput.resource);
    }
    return false;
  }
  copy() {
    return CustomEditorSideBySideDiffInput.create(this.instantiationService, this.init, void 0);
  }
  async save(groupId, options) {
    const modelRef = this._modelRef.value;
    if (!modelRef) {
      return void 0;
    }
    const target = await modelRef.object.saveCustomEditor(options);
    if (!target) {
      return void 0;
    }
    if (!isEqual(target, this.modifiedResource)) {
      return { resource: target };
    }
    return this;
  }
  async saveAs(groupId, options) {
    const modelRef = this._modelRef.value;
    if (!modelRef) {
      return void 0;
    }
    const target = await this.fileDialogService.pickFileToSave(this.modifiedResource, options?.availableFileSystems);
    if (!target) {
      return void 0;
    }
    if (!await modelRef.object.saveCustomEditorAs(this.modifiedResource, target, options)) {
      return void 0;
    }
    return { resource: target };
  }
  async revert(group, options) {
    await this._modelRef.value?.object.revert(options);
  }
  async resolve() {
    await super.resolve();
    if (this.isDisposed()) {
      return null;
    }
    if (this.side === "modified" && !this._modelRef.value) {
      const modelRef = this.customEditorService.models.tryRetain(this.modifiedResource, this.viewType);
      if (modelRef) {
        const oldCapabilities = this.capabilities;
        const retainedModelRef = await modelRef;
        if (this.isDisposed()) {
          retainedModelRef.dispose();
          return null;
        }
        this._modelRef.value = retainedModelRef;
        this._register(retainedModelRef.object.onDidChangeDirty(() => this._onDidChangeDirty.fire()));
        this._register(retainedModelRef.object.onDidChangeReadonly(() => this._onDidChangeCapabilities.fire()));
        if (this.isDirty()) {
          this._onDidChangeDirty.fire();
        }
        if (this.capabilities !== oldCapabilities) {
          this._onDidChangeCapabilities.fire();
        }
      }
    }
    return null;
  }
  undo() {
    return this.undoRedoService.undo(this.modifiedResource);
  }
  redo() {
    return this.undoRedoService.redo(this.modifiedResource);
  }
  toUntyped(_options) {
    return { resource: this.resource };
  }
};
CustomEditorSideBySideDiffInput = __decorateClass([
  __decorateParam(2, IThemeService),
  __decorateParam(3, IWebviewWorkbenchService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, ICustomEditorService),
  __decorateParam(6, IFilesConfigurationService),
  __decorateParam(7, IFileDialogService),
  __decorateParam(8, IUndoRedoService)
], CustomEditorSideBySideDiffInput);
export {
  CustomEditorDiffInput,
  CustomEditorSideBySideDiffInput
};
