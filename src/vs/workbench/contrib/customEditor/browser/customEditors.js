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
import "./media/customEditor.css";
import { coalesce } from "../../../../base/common/arrays.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { extname, isEqual } from "../../../../base/common/resources.js";
import { assertReturnsDefined } from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { RedoCommand, UndoCommand } from "../../../../editor/browser/editorExtensions.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { FileOperation, IFileService } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { DEFAULT_EDITOR_ASSOCIATION, EditorExtensions } from "../../../common/editor.js";
import { DiffEditorInput } from "../../../common/editor/diffEditorInput.js";
import { ActiveCustomEditorDiffCanToggleLayoutContext, ActiveCustomEditorTextDiffContext } from "../../../common/contextkeys.js";
import { CONTEXT_ACTIVE_CUSTOM_EDITOR_ID, CONTEXT_FOCUSED_CUSTOM_EDITOR_IS_EDITABLE, CustomEditorDiffEditorLayout, CustomEditorInfoCollection } from "../common/customEditor.js";
import { CustomEditorModelManager } from "../common/customEditorModelManager.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IEditorResolverService, RegisteredEditorPriority } from "../../../services/editor/common/editorResolverService.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { ContributedCustomEditors } from "../common/contributedCustomEditors.js";
import { CustomEditorDiffInput, CustomEditorSideBySideDiffInput } from "./customEditorDiffInput.js";
import { CustomEditorInput } from "./customEditorInput.js";
let CustomEditorService = class extends Disposable {
  constructor(fileService, storageService, editorService, editorGroupService, instantiationService, uriIdentityService, editorResolverService, textResourceConfigurationService, extensionService) {
    super();
    this.editorService = editorService;
    this.editorGroupService = editorGroupService;
    this.instantiationService = instantiationService;
    this.uriIdentityService = uriIdentityService;
    this.editorResolverService = editorResolverService;
    this.textResourceConfigurationService = textResourceConfigurationService;
    this.extensionService = extensionService;
    this._untitledCounter = 0;
    this._editorResolverDisposables = this._register(new DisposableStore());
    this._editorCapabilities = /* @__PURE__ */ new Map();
    this._onDidChangeEditorTypes = this._register(new Emitter());
    this.onDidChangeEditorTypes = this._onDidChangeEditorTypes.event;
    this._fileEditorFactory = Registry.as(EditorExtensions.EditorFactory).getFileEditorFactory();
    this._models = new CustomEditorModelManager();
    this._contributedEditors = this._register(new ContributedCustomEditors(storageService));
    this.editorResolverService.bufferChangeEvents(this.registerContributionPoints.bind(this));
    this._register(this._contributedEditors.onChange(() => {
      this.editorResolverService.bufferChangeEvents(this.registerContributionPoints.bind(this));
      this._onDidChangeEditorTypes.fire();
    }));
    const activeCustomEditorContextKeyProvider = {
      contextKey: CONTEXT_ACTIVE_CUSTOM_EDITOR_ID,
      getGroupContextKeyValue: (group) => this.getActiveCustomEditorId(group),
      onDidChange: this.onDidChangeEditorTypes
    };
    const customEditorIsEditableContextKeyProvider = {
      contextKey: CONTEXT_FOCUSED_CUSTOM_EDITOR_IS_EDITABLE,
      getGroupContextKeyValue: (group) => this.getCustomEditorIsEditable(group),
      onDidChange: this.onDidChangeEditorTypes
    };
    const customEditorDiffCanToggleLayoutContextKeyProvider = {
      contextKey: ActiveCustomEditorDiffCanToggleLayoutContext,
      getGroupContextKeyValue: (group) => this.getActiveCustomEditorDiffCanToggleLayout(group),
      onDidChange: this.onDidChangeEditorTypes
    };
    const customEditorTextDiffContextKeyProvider = {
      contextKey: ActiveCustomEditorTextDiffContext,
      getGroupContextKeyValue: (group) => this.getActiveCustomEditorTextDiff(group),
      onDidChange: this.onDidChangeEditorTypes
    };
    this._register(this.editorGroupService.registerContextKeyProvider(activeCustomEditorContextKeyProvider));
    this._register(this.editorGroupService.registerContextKeyProvider(customEditorIsEditableContextKeyProvider));
    this._register(this.editorGroupService.registerContextKeyProvider(customEditorDiffCanToggleLayoutContextKeyProvider));
    this._register(this.editorGroupService.registerContextKeyProvider(customEditorTextDiffContextKeyProvider));
    this._register(this.textResourceConfigurationService.onDidChangeConfiguration((e) => {
      void this.updateCustomDiffEditorsForDiffConfigurationChange(e);
    }));
    this._register(fileService.onDidRunOperation((e) => {
      if (e.isOperation(FileOperation.MOVE)) {
        this.handleMovedFileInOpenedFileEditors(e.resource, this.uriIdentityService.asCanonicalUri(e.target.resource));
      }
      if (e.isOperation(FileOperation.DELETE)) {
        this.handleDeletedFile(e.resource);
      }
    }));
    const PRIORITY = 105;
    this._register(UndoCommand.addImplementation(PRIORITY, "custom-editor", () => {
      return this.withActiveCustomEditor((editor) => editor.undo());
    }));
    this._register(RedoCommand.addImplementation(PRIORITY, "custom-editor", () => {
      return this.withActiveCustomEditor((editor) => editor.redo());
    }));
  }
  getEditorTypes() {
    return [...this._contributedEditors];
  }
  withActiveCustomEditor(f) {
    const editor = this.getActiveCustomEditorUndoRedoInput();
    if (editor) {
      const result = f(editor);
      if (result) {
        return result;
      }
      return true;
    }
    return false;
  }
  getActiveCustomEditorUndoRedoInput() {
    const activeEditor = this.editorService.activeEditor;
    if (activeEditor instanceof CustomEditorInput || activeEditor instanceof CustomEditorDiffInput || activeEditor instanceof CustomEditorSideBySideDiffInput) {
      return activeEditor;
    }
    if (activeEditor instanceof DiffEditorInput && activeEditor.modified instanceof CustomEditorSideBySideDiffInput) {
      return activeEditor.modified;
    }
    return void 0;
  }
  registerContributionPoints() {
    this._editorResolverDisposables.clear();
    for (const contributedEditor of this._contributedEditors) {
      for (const globPattern of contributedEditor.selector) {
        if (!globPattern.filenamePattern) {
          continue;
        }
        this._editorResolverDisposables.add(this.editorResolverService.registerEditor(
          globPattern.filenamePattern,
          {
            id: contributedEditor.id,
            label: contributedEditor.displayName,
            detail: contributedEditor.providerDisplayName,
            priority: contributedEditor.priority
          },
          {
            singlePerResource: () => !(this.getCustomEditorCapabilities(contributedEditor.id)?.supportsMultipleEditorsPerDocument ?? false)
          },
          {
            createEditorInput: ({ resource, label }, group) => {
              return { editor: CustomEditorInput.create(this.instantiationService, { resource, viewType: contributedEditor.id, webviewTitle: void 0, preferredName: label, iconPath: void 0 }, group.id) };
            },
            createUntitledEditorInput: ({ resource }, group) => {
              return { editor: CustomEditorInput.create(this.instantiationService, { resource: resource ?? URI.from({ scheme: Schemas.untitled, authority: `Untitled-${this._untitledCounter++}` }), viewType: contributedEditor.id, webviewTitle: void 0, preferredName: void 0, iconPath: void 0 }, group.id) };
            },
            createDiffEditorInput: async (diffEditorInput, group) => {
              await this.extensionService.activateByEvent(`onCustomEditor:${contributedEditor.id}`);
              return { editor: this.createDiffEditorInput(diffEditorInput, contributedEditor, group) };
            }
          }
        ));
      }
    }
  }
  createDiffEditorInput(editor, contributedEditor, group) {
    const originalResource = assertReturnsDefined(editor.original.resource);
    const modifiedResource = assertReturnsDefined(editor.modified.resource);
    const diffEditorLayout = this.getDiffEditorLayout(contributedEditor, modifiedResource);
    if (diffEditorLayout === CustomEditorDiffEditorLayout.Inline) {
      return CustomEditorDiffInput.create(this.instantiationService, {
        originalResource,
        modifiedResource,
        viewType: contributedEditor.id,
        label: editor.label,
        description: editor.description,
        iconPath: void 0
      }, group);
    }
    if (diffEditorLayout === CustomEditorDiffEditorLayout.SideBySide) {
      const diffId = generateUuid();
      const originalOverride2 = CustomEditorSideBySideDiffInput.create(this.instantiationService, {
        originalResource,
        modifiedResource,
        viewType: contributedEditor.id,
        diffId,
        side: "original",
        label: editor.label,
        description: editor.description,
        iconPath: void 0
      }, group);
      const modifiedOverride2 = CustomEditorSideBySideDiffInput.create(this.instantiationService, {
        originalResource,
        modifiedResource,
        viewType: contributedEditor.id,
        diffId,
        side: "modified",
        label: editor.label,
        description: editor.description,
        iconPath: void 0
      }, group);
      return this.instantiationService.createInstance(DiffEditorInput, editor.label, editor.description, originalOverride2, modifiedOverride2, true);
    }
    const modifiedOverride = CustomEditorInput.create(this.instantiationService, { resource: modifiedResource, viewType: contributedEditor.id, webviewTitle: void 0, preferredName: void 0, iconPath: void 0 }, group.id, { customClasses: "modified" });
    const originalOverride = CustomEditorInput.create(this.instantiationService, { resource: originalResource, viewType: contributedEditor.id, webviewTitle: void 0, preferredName: void 0, iconPath: void 0 }, group.id, { customClasses: "original" });
    return this.instantiationService.createInstance(DiffEditorInput, editor.label, editor.description, originalOverride, modifiedOverride, true);
  }
  getDiffEditorLayout(contributedEditor, modifiedResource) {
    const capabilities = this.getCustomEditorCapabilities(contributedEditor.id);
    const supportsInlineDiff = capabilities?.supportsInlineDiff === true;
    const supportsSideBySideDiff = capabilities?.supportsSideBySideDiff === true;
    if (supportsInlineDiff && supportsSideBySideDiff) {
      return this.textResourceConfigurationService.getValue(modifiedResource, "diffEditor.renderSideBySide") ? CustomEditorDiffEditorLayout.SideBySide : CustomEditorDiffEditorLayout.Inline;
    }
    return supportsInlineDiff ? CustomEditorDiffEditorLayout.Inline : supportsSideBySideDiff ? CustomEditorDiffEditorLayout.SideBySide : void 0;
  }
  async updateCustomDiffEditorsForDiffConfigurationChange(e) {
    for (const group of this.editorGroupService.groups) {
      const replacements = [];
      for (const editor of group.editors) {
        const diffInfo = this.getCustomEditorDiffInputInfo(editor);
        const contributedEditor = diffInfo ? this._contributedEditors.get(diffInfo.viewType) : void 0;
        if (!diffInfo || !contributedEditor || !e.affectsConfiguration(diffInfo.modifiedResource, "diffEditor.renderSideBySide") || !this.getCustomEditorCapabilities(contributedEditor.id)?.supportsInlineDiff || !this.getCustomEditorCapabilities(contributedEditor.id)?.supportsSideBySideDiff || this.getDiffEditorLayout(contributedEditor, diffInfo.modifiedResource) === diffInfo.layout) {
          continue;
        }
        replacements.push({
          editor,
          replacement: {
            original: { resource: diffInfo.originalResource },
            modified: { resource: diffInfo.modifiedResource },
            label: editor.getName(),
            description: editor.getDescription(),
            options: {
              override: diffInfo.viewType,
              pinned: group.isPinned(editor),
              sticky: group.isSticky(editor),
              preserveFocus: group.activeEditor !== editor
            }
          }
        });
      }
      if (replacements.length) {
        await this.editorService.replaceEditors(replacements, group);
      }
    }
  }
  getCustomEditorDiffInputInfo(input) {
    if (input instanceof CustomEditorDiffInput) {
      return {
        viewType: input.viewType,
        originalResource: input.originalResource,
        modifiedResource: input.modifiedResource,
        layout: CustomEditorDiffEditorLayout.Inline
      };
    }
    if (input instanceof DiffEditorInput && input.original instanceof CustomEditorSideBySideDiffInput && input.modified instanceof CustomEditorSideBySideDiffInput && input.original.side === "original" && input.modified.side === "modified" && input.original.viewType === input.modified.viewType && input.original.diffId === input.modified.diffId) {
      return {
        viewType: input.original.viewType,
        originalResource: input.original.originalResource,
        modifiedResource: input.original.modifiedResource,
        layout: CustomEditorDiffEditorLayout.SideBySide
      };
    }
    return void 0;
  }
  get models() {
    return this._models;
  }
  getCustomEditor(viewType) {
    return this._contributedEditors.get(viewType);
  }
  getContributedCustomEditors(resource) {
    return new CustomEditorInfoCollection(this._contributedEditors.getContributedEditors(resource));
  }
  getUserConfiguredCustomEditors(resource) {
    const resourceAssocations = this.editorResolverService.getAssociationsForResource(resource);
    return new CustomEditorInfoCollection(
      coalesce(resourceAssocations.map((association) => this._contributedEditors.get(association.viewType)))
    );
  }
  getAllCustomEditors(resource) {
    return new CustomEditorInfoCollection([
      ...this.getUserConfiguredCustomEditors(resource).allEditors,
      ...this.getContributedCustomEditors(resource).allEditors
    ]);
  }
  registerCustomEditorCapabilities(viewType, options) {
    if (this._editorCapabilities.has(viewType)) {
      throw new Error(`Capabilities for ${viewType} already set`);
    }
    this._editorCapabilities.set(viewType, options);
    this._onDidChangeEditorTypes.fire();
    return toDisposable(() => {
      this._editorCapabilities.delete(viewType);
      this._onDidChangeEditorTypes.fire();
    });
  }
  getCustomEditorCapabilities(viewType) {
    return this._editorCapabilities.get(viewType);
  }
  getActiveCustomEditorId(group) {
    const activeEditorPane = group.activeEditorPane;
    const input = activeEditorPane?.input;
    const diffInfo = this.getCustomEditorDiffInputInfo(input);
    if (diffInfo) {
      return diffInfo.viewType;
    }
    return input instanceof CustomEditorInput && input.resource ? input.viewType : "";
  }
  getActiveCustomEditorDiffCanToggleLayout(group) {
    const diffInfo = this.getCustomEditorDiffInputInfo(group.activeEditorPane?.input);
    const capabilities = diffInfo ? this.getCustomEditorCapabilities(diffInfo.viewType) : void 0;
    return capabilities?.supportsInlineDiff === true && capabilities.supportsSideBySideDiff === true;
  }
  getActiveCustomEditorTextDiff(group) {
    const diffInfo = this.getCustomEditorDiffInputInfo(group.activeEditorPane?.input);
    return !!diffInfo && this.getCustomEditorCapabilities(diffInfo.viewType)?.isTextEditor === true;
  }
  getCustomEditorIsEditable(group) {
    const activeEditorPane = group.activeEditorPane;
    const resource = activeEditorPane?.input?.resource;
    if (!resource) {
      return false;
    }
    return activeEditorPane?.input instanceof CustomEditorInput;
  }
  handleDeletedFile(resource) {
    this._models.disposeAllModelsForResource(resource);
  }
  async handleMovedFileInOpenedFileEditors(oldResource, newResource) {
    if (extname(oldResource).toLowerCase() === extname(newResource).toLowerCase()) {
      return;
    }
    const possibleEditors = this.getAllCustomEditors(newResource);
    if (!possibleEditors.allEditors.some((editor) => editor.priority.editor !== RegisteredEditorPriority.option)) {
      return;
    }
    const editorsToReplace = /* @__PURE__ */ new Map();
    for (const group of this.editorGroupService.groups) {
      for (const editor of group.editors) {
        if (this._fileEditorFactory.isFileEditor(editor) && !(editor instanceof CustomEditorInput) && isEqual(editor.resource, newResource)) {
          let entry = editorsToReplace.get(group.id);
          if (!entry) {
            entry = [];
            editorsToReplace.set(group.id, entry);
          }
          entry.push(editor);
        }
      }
    }
    if (!editorsToReplace.size) {
      return;
    }
    for (const [group, entries] of editorsToReplace) {
      this.editorService.replaceEditors(entries.map((editor) => {
        let replacement;
        if (possibleEditors.defaultEditor) {
          const viewType = possibleEditors.defaultEditor.id;
          replacement = CustomEditorInput.create(this.instantiationService, { resource: newResource, viewType, webviewTitle: void 0, preferredName: void 0, iconPath: void 0 }, group);
        } else {
          replacement = { resource: newResource, options: { override: DEFAULT_EDITOR_ASSOCIATION.id } };
        }
        return {
          editor,
          replacement,
          options: {
            preserveFocus: true
          }
        };
      }), group);
    }
  }
};
CustomEditorService = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IEditorService),
  __decorateParam(3, IEditorGroupsService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IUriIdentityService),
  __decorateParam(6, IEditorResolverService),
  __decorateParam(7, ITextResourceConfigurationService),
  __decorateParam(8, IExtensionService)
], CustomEditorService);
export {
  CustomEditorService
};
