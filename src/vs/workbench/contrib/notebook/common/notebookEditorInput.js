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
import * as glob from "../../../../base/common/glob.js";
import { EditorInputCapabilities, Verbosity, isResourceEditorInput } from "../../../common/editor.js";
import { INotebookService, SimpleNotebookProviderInfo } from "./notebookService.js";
import { URI } from "../../../../base/common/uri.js";
import { isEqual, toLocalResource } from "../../../../base/common/resources.js";
import { IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { INotebookEditorModelResolverService } from "./notebookEditorModelResolverService.js";
import { CellEditType, CellUri } from "./notebookCommon.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { Schemas } from "../../../../base/common/network.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { AbstractResourceEditorInput } from "../../../common/editor/resourceEditorInput.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { IFilesConfigurationService } from "../../../services/filesConfiguration/common/filesConfigurationService.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { localize } from "../../../../nls.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { ICustomEditorLabelService } from "../../../services/editor/common/customEditorLabelService.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { IPathService } from "../../../services/path/common/pathService.js";
import { isAbsolute } from "../../../../base/common/path.js";
let NotebookEditorInput = class extends AbstractResourceEditorInput {
  constructor(resource, preferredResource, viewType, options, _notebookService, _notebookModelResolverService, _fileDialogService, labelService, fileService, filesConfigurationService, extensionService, editorService, textResourceConfigurationService, customEditorLabelService, environmentService, pathService) {
    super(resource, preferredResource, labelService, fileService, filesConfigurationService, textResourceConfigurationService, customEditorLabelService);
    this.viewType = viewType;
    this.options = options;
    this._notebookService = _notebookService;
    this._notebookModelResolverService = _notebookModelResolverService;
    this._fileDialogService = _fileDialogService;
    this.environmentService = environmentService;
    this.pathService = pathService;
    this.editorModelReference = null;
    this._defaultDirtyState = false;
    this._defaultDirtyState = !!options.startDirty;
    this._sideLoadedListener = _notebookService.onDidAddNotebookDocument((e) => {
      if (e.viewType === this.viewType && e.uri.toString() === this.resource.toString()) {
        this.resolve().catch(onUnexpectedError);
      }
    });
    this._register(extensionService.onWillStop((e) => {
      if (!e.auto && !this.isDirty()) {
        return;
      }
      const reason = e.auto ? localize("vetoAutoExtHostRestart", "An extension provided notebook for '{0}' is still open that would close otherwise.", this.getName()) : localize("vetoExtHostRestart", "An extension provided notebook for '{0}' could not be saved.", this.getName());
      e.veto((async () => {
        const editors = editorService.findEditors(this);
        if (e.auto) {
          return true;
        }
        if (editors.length > 0) {
          const result = await editorService.save(editors[0]);
          if (result.success) {
            return false;
          }
        }
        return true;
      })(), reason);
    }));
  }
  static getOrCreate(instantiationService, resource, preferredResource, viewType, options = {}) {
    const editor = instantiationService.createInstance(NotebookEditorInput, resource, preferredResource, viewType, options);
    if (preferredResource) {
      editor.setPreferredResource(preferredResource);
    }
    return editor;
  }
  static {
    this.ID = "workbench.input.notebook";
  }
  dispose() {
    this._sideLoadedListener.dispose();
    this.editorModelReference?.dispose();
    this.editorModelReference = null;
    super.dispose();
  }
  get typeId() {
    return NotebookEditorInput.ID;
  }
  get editorId() {
    return this.viewType;
  }
  get capabilities() {
    let capabilities = EditorInputCapabilities.None;
    if (this.resource.scheme === Schemas.untitled) {
      capabilities |= EditorInputCapabilities.Untitled;
    }
    if (this.editorModelReference) {
      if (this.editorModelReference.object.isReadonly()) {
        capabilities |= EditorInputCapabilities.Readonly;
      }
    } else {
      if (this.filesConfigurationService.isReadonly(this.resource)) {
        capabilities |= EditorInputCapabilities.Readonly;
      }
    }
    if (!(capabilities & EditorInputCapabilities.Readonly)) {
      capabilities |= EditorInputCapabilities.CanDropIntoEditor;
    }
    return capabilities;
  }
  getDescription(verbosity = Verbosity.MEDIUM) {
    if (!this.hasCapability(EditorInputCapabilities.Untitled) || this.editorModelReference?.object.hasAssociatedFilePath()) {
      return super.getDescription(verbosity);
    }
    return void 0;
  }
  isReadonly() {
    if (!this.editorModelReference) {
      return this.filesConfigurationService.isReadonly(this.resource);
    }
    return this.editorModelReference.object.isReadonly();
  }
  isDirty() {
    if (!this.editorModelReference) {
      return this._defaultDirtyState;
    }
    return this.editorModelReference.object.isDirty();
  }
  isSaving() {
    const model = this.editorModelReference?.object;
    if (!model || !model.isDirty() || model.hasErrorState || this.hasCapability(EditorInputCapabilities.Untitled)) {
      return false;
    }
    return this.filesConfigurationService.hasShortAutoSaveDelay(this);
  }
  async save(group, options) {
    if (this.editorModelReference) {
      if (this.hasCapability(EditorInputCapabilities.Untitled)) {
        return this.saveAs(group, options);
      } else {
        await this.editorModelReference.object.save(options);
      }
      return this;
    }
    return void 0;
  }
  async saveAs(group, options) {
    if (!this.editorModelReference) {
      return void 0;
    }
    const provider = this._notebookService.getContributedNotebookType(this.viewType);
    if (!provider) {
      return void 0;
    }
    const pathCandidate = this.hasCapability(EditorInputCapabilities.Untitled) ? await this._suggestName(provider) : this.editorModelReference.object.resource;
    let target;
    if (this.editorModelReference.object.hasAssociatedFilePath()) {
      target = pathCandidate;
    } else {
      target = await this._fileDialogService.pickFileToSave(pathCandidate, options?.availableFileSystems);
      if (!target) {
        return void 0;
      }
    }
    if (!provider.matches(target)) {
      const patterns = provider.selectors.map((pattern) => {
        if (typeof pattern === "string") {
          return pattern;
        }
        if (glob.isRelativePattern(pattern)) {
          return `${pattern} (base ${pattern.base})`;
        }
        if (pattern.exclude) {
          return `${pattern.include} (exclude: ${pattern.exclude})`;
        } else {
          return `${pattern.include}`;
        }
      }).join(", ");
      throw new Error(`File name ${target} is not supported by ${provider.providerDisplayName}.

Please make sure the file name matches following patterns:
${patterns}`);
    }
    return await this.editorModelReference.object.saveAs(target);
  }
  async _suggestName(provider) {
    const resource = await this.ensureAbsolutePath(this.ensureProviderExtension(provider));
    const remoteAuthority = this.environmentService.remoteAuthority;
    return toLocalResource(resource, remoteAuthority, this.pathService.defaultUriScheme);
  }
  async ensureAbsolutePath(resource) {
    if (resource.scheme !== Schemas.untitled || isAbsolute(resource.path)) {
      return resource;
    }
    const defaultFilePath = await this._fileDialogService.defaultFilePath();
    return URI.joinPath(defaultFilePath, resource.path);
  }
  ensureProviderExtension(provider) {
    const firstSelector = provider.selectors[0];
    let selectorStr = firstSelector && typeof firstSelector === "string" ? firstSelector : void 0;
    if (!selectorStr && firstSelector) {
      const include = firstSelector.include;
      if (typeof include === "string") {
        selectorStr = include;
      }
    }
    const resource = this.resource;
    if (selectorStr) {
      const matches = /^\*\.([A-Za-z_-]*)$/.exec(selectorStr);
      if (matches && matches.length > 1) {
        const fileExt = matches[1];
        if (!resource.path.endsWith(fileExt)) {
          return resource.with({ path: resource.path + "." + fileExt });
        }
      }
    }
    return resource;
  }
  // called when users rename a notebook document
  async rename(group, target) {
    if (this.editorModelReference) {
      return { editor: { resource: target }, options: { override: this.viewType } };
    }
    return void 0;
  }
  async revert(_group, options) {
    if (this.editorModelReference && this.editorModelReference.object.isDirty()) {
      await this.editorModelReference.object.revert(options);
    }
  }
  async resolve(_options, perf) {
    if (!await this._notebookService.canResolve(this.viewType)) {
      return null;
    }
    perf?.mark("extensionActivated");
    this._sideLoadedListener.dispose();
    if (!this.editorModelReference) {
      const scratchpad = this.capabilities & EditorInputCapabilities.Scratchpad ? true : false;
      const ref = await this._notebookModelResolverService.resolve(this.resource, this.viewType, { limits: this.ensureLimits(_options), scratchpad, viewType: this.editorId });
      if (this.editorModelReference) {
        ref.dispose();
        return this.editorModelReference.object;
      }
      this.editorModelReference = ref;
      if (this.isDisposed()) {
        this.editorModelReference.dispose();
        this.editorModelReference = null;
        return null;
      }
      this._register(this.editorModelReference.object.onDidChangeDirty(() => this._onDidChangeDirty.fire()));
      this._register(this.editorModelReference.object.onDidChangeReadonly(() => this._onDidChangeCapabilities.fire()));
      this._register(this.editorModelReference.object.onDidRevertUntitled(() => this.dispose()));
      if (this.editorModelReference.object.isDirty()) {
        this._onDidChangeDirty.fire();
      }
    } else {
      this.editorModelReference.object.load({ limits: this.ensureLimits(_options) });
    }
    if (this.options._backupId) {
      const info = await this._notebookService.withNotebookDataProvider(this.editorModelReference.object.notebook.viewType);
      if (!(info instanceof SimpleNotebookProviderInfo)) {
        throw new Error("CANNOT open file notebook with this provider");
      }
      const data = await info.serializer.dataToNotebook(VSBuffer.fromString(JSON.stringify({ __webview_backup: this.options._backupId })));
      this.editorModelReference.object.notebook.applyEdits([
        {
          editType: CellEditType.Replace,
          index: 0,
          count: this.editorModelReference.object.notebook.length,
          cells: data.cells
        }
      ], true, void 0, () => void 0, void 0, false);
      if (this.options._workingCopy) {
        this.options._backupId = void 0;
        this.options._workingCopy = void 0;
        this.options.startDirty = void 0;
      }
    }
    return this.editorModelReference.object;
  }
  toUntyped() {
    return {
      resource: this.resource,
      options: {
        override: this.viewType
      }
    };
  }
  matches(otherInput) {
    if (super.matches(otherInput)) {
      return true;
    }
    if (otherInput instanceof NotebookEditorInput) {
      return this.viewType === otherInput.viewType && isEqual(this.resource, otherInput.resource);
    }
    if (isResourceEditorInput(otherInput) && otherInput.resource.scheme === CellUri.scheme) {
      return isEqual(this.resource, CellUri.parse(otherInput.resource)?.notebook);
    }
    return false;
  }
};
NotebookEditorInput = __decorateClass([
  __decorateParam(4, INotebookService),
  __decorateParam(5, INotebookEditorModelResolverService),
  __decorateParam(6, IFileDialogService),
  __decorateParam(7, ILabelService),
  __decorateParam(8, IFileService),
  __decorateParam(9, IFilesConfigurationService),
  __decorateParam(10, IExtensionService),
  __decorateParam(11, IEditorService),
  __decorateParam(12, ITextResourceConfigurationService),
  __decorateParam(13, ICustomEditorLabelService),
  __decorateParam(14, IWorkbenchEnvironmentService),
  __decorateParam(15, IPathService)
], NotebookEditorInput);
function isCompositeNotebookEditorInput(thing) {
  return !!thing && typeof thing === "object" && Array.isArray(thing.editorInputs) && thing.editorInputs.every((input) => input instanceof NotebookEditorInput);
}
function isNotebookEditorInput(thing) {
  return !!thing && typeof thing === "object" && thing.typeId === NotebookEditorInput.ID;
}
export {
  NotebookEditorInput,
  isCompositeNotebookEditorInput,
  isNotebookEditorInput
};
