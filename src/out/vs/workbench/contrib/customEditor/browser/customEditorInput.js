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
import { getWindow } from "../../../../base/browser/dom.js";
import { toAction } from "../../../../base/common/actions.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { Schemas } from "../../../../base/common/network.js";
import { basename } from "../../../../base/common/path.js";
import { dirname, isEqual } from "../../../../base/common/resources.js";
import { assertReturnsDefined } from "../../../../base/common/types.js";
import { localize } from "../../../../nls.js";
import { IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { IUndoRedoService } from "../../../../platform/undoRedo/common/undoRedo.js";
import { EditorInputCapabilities, Verbosity, createEditorOpenError } from "../../../common/editor.js";
import { ICustomEditorLabelService } from "../../../services/editor/common/customEditorLabelService.js";
import { ICustomEditorService } from "../common/customEditor.js";
import { IWebviewService } from "../../webview/browser/webview.js";
import { IWebviewWorkbenchService, LazilyResolvedWebviewEditorInput } from "../../webviewPanel/browser/webviewWorkbenchService.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IFilesConfigurationService } from "../../../services/filesConfiguration/common/filesConfigurationService.js";
import { IWorkbenchLayoutService } from "../../../services/layout/browser/layoutService.js";
import { IUntitledTextEditorService } from "../../../services/untitled/common/untitledTextEditorService.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
let CustomEditorInput = class extends LazilyResolvedWebviewEditorInput {
  constructor(init, webview, options, themeService, webviewWorkbenchService, instantiationService, labelService, customEditorService, fileDialogService, undoRedoService, fileService, filesConfigurationService, editorGroupsService, layoutService, customEditorLabelService) {
    super({ providedId: init.viewType, viewType: init.viewType, name: init.preferredName ?? "", iconPath: init.iconPath }, webview, themeService, webviewWorkbenchService);
    this.instantiationService = instantiationService;
    this.labelService = labelService;
    this.customEditorService = customEditorService;
    this.fileDialogService = fileDialogService;
    this.undoRedoService = undoRedoService;
    this.fileService = fileService;
    this.filesConfigurationService = filesConfigurationService;
    this.editorGroupsService = editorGroupsService;
    this.layoutService = layoutService;
    this.customEditorLabelService = customEditorLabelService;
    this._editorName = void 0;
    this._shortDescription = void 0;
    this._mediumDescription = void 0;
    this._longDescription = void 0;
    this._shortTitle = void 0;
    this._mediumTitle = void 0;
    this._longTitle = void 0;
    this._editorResource = init.resource;
    this.oldResource = options.oldResource;
    this._defaultDirtyState = options.startsDirty;
    this._backupId = options.backupId;
    this._untitledDocumentData = options.untitledDocumentData;
    this.registerListeners();
  }
  static create(instantiationService, init, group, options) {
    return instantiationService.invokeFunction((accessor) => {
      const untitledTextEditorService = accessor.get(IUntitledTextEditorService);
      const untitledTextModel = untitledTextEditorService.get(init.resource);
      const untitledString = untitledTextModel?.textEditorModel?.getValue();
      const untitledDocumentData = untitledString ? VSBuffer.fromString(untitledString) : void 0;
      const webview = accessor.get(IWebviewService).createWebviewOverlay({
        providedViewType: init.viewType,
        title: init.webviewTitle,
        options: { customClasses: options?.customClasses },
        contentOptions: {},
        extension: void 0
      });
      const input = instantiationService.createInstance(CustomEditorInput, init, webview, { untitledDocumentData, oldResource: options?.oldResource });
      if (typeof group !== "undefined") {
        input.updateGroup(group);
      }
      return input;
    });
  }
  static {
    this.typeId = "workbench.editors.webviewEditor";
  }
  get resource() {
    return this._editorResource;
  }
  registerListeners() {
    this._register(this.labelService.onDidChangeFormatters((e) => this.onLabelEvent(e.scheme)));
    this._register(this.fileService.onDidChangeFileSystemProviderRegistrations((e) => this.onLabelEvent(e.scheme)));
    this._register(this.fileService.onDidChangeFileSystemProviderCapabilities((e) => this.onLabelEvent(e.scheme)));
    this._register(this.customEditorLabelService.onDidChange(() => this.updateLabel()));
    this._register(this.filesConfigurationService.onDidChangeReadonly(() => this._onDidChangeCapabilities.fire()));
  }
  onLabelEvent(scheme) {
    if (scheme === this.resource.scheme) {
      this.updateLabel();
    }
  }
  updateLabel() {
    this._editorName = void 0;
    this._shortDescription = void 0;
    this._mediumDescription = void 0;
    this._longDescription = void 0;
    this._shortTitle = void 0;
    this._mediumTitle = void 0;
    this._longTitle = void 0;
    this._onDidChangeLabel.fire();
  }
  get typeId() {
    return CustomEditorInput.typeId;
  }
  get editorId() {
    return this.viewType;
  }
  get capabilities() {
    let capabilities = EditorInputCapabilities.None;
    capabilities |= EditorInputCapabilities.CanDropIntoEditor;
    if (!this.customEditorService.getCustomEditorCapabilities(this.viewType)?.supportsMultipleEditorsPerDocument) {
      capabilities |= EditorInputCapabilities.Singleton;
    }
    if (this.isReadonly()) {
      capabilities |= EditorInputCapabilities.Readonly;
    }
    if (this.resource.scheme === Schemas.untitled) {
      capabilities |= EditorInputCapabilities.Untitled;
    }
    return capabilities;
  }
  getName() {
    const customTitle = this.getWebviewTitle();
    if (customTitle) {
      return customTitle;
    }
    this._editorName ??= this.customEditorLabelService.getName(this.resource) ?? basename(this.labelService.getUriLabel(this.resource));
    return this._editorName;
  }
  getDescription(verbosity = Verbosity.MEDIUM) {
    switch (verbosity) {
      case Verbosity.SHORT:
        return this.shortDescription;
      case Verbosity.LONG:
        return this.longDescription;
      case Verbosity.MEDIUM:
      default:
        return this.mediumDescription;
    }
  }
  get shortDescription() {
    this._shortDescription ??= this.labelService.getUriBasenameLabel(dirname(this.resource));
    return this._shortDescription;
  }
  get mediumDescription() {
    this._mediumDescription ??= this.labelService.getUriLabel(dirname(this.resource), { relative: true });
    return this._mediumDescription;
  }
  get longDescription() {
    this._longDescription ??= this.labelService.getUriLabel(dirname(this.resource));
    return this._longDescription;
  }
  get shortTitle() {
    this._shortTitle ??= this.getName();
    return this._shortTitle;
  }
  get mediumTitle() {
    this._mediumTitle ??= this.labelService.getUriLabel(this.resource, { relative: true });
    return this._mediumTitle;
  }
  get longTitle() {
    this._longTitle ??= this.labelService.getUriLabel(this.resource);
    return this._longTitle;
  }
  getTitle(verbosity) {
    const customTitle = this.getWebviewTitle();
    if (customTitle) {
      return customTitle;
    }
    switch (verbosity) {
      case Verbosity.SHORT:
        return this.shortTitle;
      case Verbosity.LONG:
        return this.longTitle;
      default:
      case Verbosity.MEDIUM:
        return this.mediumTitle;
    }
  }
  matches(other) {
    if (super.matches(other)) {
      return true;
    }
    return this === other || other instanceof CustomEditorInput && this.viewType === other.viewType && isEqual(this.resource, other.resource);
  }
  copy() {
    return CustomEditorInput.create(
      this.instantiationService,
      { resource: this.resource, viewType: this.viewType, webviewTitle: this.getWebviewTitle(), preferredName: void 0, iconPath: this.iconPath },
      this.group,
      this.webview.options
    );
  }
  isReadonly() {
    if (!this._modelRef) {
      return this.filesConfigurationService.isReadonly(this.resource);
    }
    return this._modelRef.object.isReadonly();
  }
  isDirty() {
    if (!this._modelRef) {
      return !!this._defaultDirtyState;
    }
    return this._modelRef.object.isDirty();
  }
  async save(groupId, options) {
    if (!this._modelRef) {
      return void 0;
    }
    const target = await this._modelRef.object.saveCustomEditor(options);
    if (!target) {
      return void 0;
    }
    if (!isEqual(target, this.resource)) {
      return { resource: target };
    }
    return this;
  }
  async saveAs(groupId, options) {
    if (!this._modelRef) {
      return void 0;
    }
    const dialogPath = this._editorResource;
    const target = await this.fileDialogService.pickFileToSave(dialogPath, options?.availableFileSystems);
    if (!target) {
      return void 0;
    }
    if (!await this._modelRef.object.saveCustomEditorAs(this._editorResource, target, options)) {
      return void 0;
    }
    return (await this.rename(groupId, target))?.editor;
  }
  async revert(group, options) {
    if (this._modelRef) {
      return this._modelRef.object.revert(options);
    }
    this._defaultDirtyState = false;
    this._onDidChangeDirty.fire();
  }
  async resolve() {
    await super.resolve();
    if (this.isDisposed()) {
      return null;
    }
    if (!this._modelRef) {
      const oldCapabilities = this.capabilities;
      this._modelRef = this._register(assertReturnsDefined(await this.customEditorService.models.tryRetain(this.resource, this.viewType)));
      this._register(this._modelRef.object.onDidChangeDirty(() => this._onDidChangeDirty.fire()));
      this._register(this._modelRef.object.onDidChangeReadonly(() => this._onDidChangeCapabilities.fire()));
      if (this._untitledDocumentData) {
        this._defaultDirtyState = true;
      }
      if (this.isDirty()) {
        this._onDidChangeDirty.fire();
      }
      if (this.capabilities !== oldCapabilities) {
        this._onDidChangeCapabilities.fire();
      }
    }
    return null;
  }
  async rename(group, newResource) {
    return { editor: { resource: newResource } };
  }
  undo() {
    assertReturnsDefined(this._modelRef);
    return this.undoRedoService.undo(this.resource);
  }
  redo() {
    assertReturnsDefined(this._modelRef);
    return this.undoRedoService.redo(this.resource);
  }
  onMove(handler) {
    this._moveHandler = handler;
  }
  transfer(other) {
    if (!super.transfer(other)) {
      return;
    }
    other._moveHandler = this._moveHandler;
    this._moveHandler = void 0;
    return other;
  }
  get backupId() {
    if (this._modelRef) {
      return this._modelRef.object.backupId;
    }
    return this._backupId;
  }
  get untitledDocumentData() {
    return this._untitledDocumentData;
  }
  toUntyped() {
    return {
      resource: this.resource,
      options: {
        override: this.viewType
      }
    };
  }
  claim(claimant, targetWindow, scopedContextKeyService) {
    if (this.doCanMove(targetWindow.vscodeWindowId) !== true) {
      throw createEditorOpenError(localize("editorUnsupportedInWindow", "Unable to open the editor in this window, it contains modifications that can only be saved in the original window."), [
        toAction({
          id: "openInOriginalWindow",
          label: localize("reopenInOriginalWindow", "Open in Original Window"),
          run: async () => {
            const originalPart = this.editorGroupsService.getPart(this.layoutService.getContainer(getWindow(this.webview.container).window));
            const currentPart = this.editorGroupsService.getPart(this.layoutService.getContainer(targetWindow.window));
            currentPart.activeGroup.moveEditor(this, originalPart.activeGroup);
          }
        })
      ], { forceMessage: true });
    }
    return super.claim(claimant, targetWindow, scopedContextKeyService);
  }
  canMove(sourceGroup, targetGroup) {
    const resolvedTargetGroup = this.editorGroupsService.getGroup(targetGroup);
    if (resolvedTargetGroup) {
      const canMove = this.doCanMove(resolvedTargetGroup.windowId);
      if (typeof canMove === "string") {
        return canMove;
      }
    }
    return super.canMove(sourceGroup, targetGroup);
  }
  doCanMove(targetWindowId) {
    if (this.isModified() && this._modelRef?.object.canHotExit === false) {
      const sourceWindowId = getWindow(this.webview.container).vscodeWindowId;
      if (sourceWindowId !== targetWindowId) {
        return localize("editorCannotMove", "Unable to move '{0}': The editor contains changes that can only be saved in its current window.", this.getName());
      }
    }
    return true;
  }
};
CustomEditorInput = __decorateClass([
  __decorateParam(3, IThemeService),
  __decorateParam(4, IWebviewWorkbenchService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, ILabelService),
  __decorateParam(7, ICustomEditorService),
  __decorateParam(8, IFileDialogService),
  __decorateParam(9, IUndoRedoService),
  __decorateParam(10, IFileService),
  __decorateParam(11, IFilesConfigurationService),
  __decorateParam(12, IEditorGroupsService),
  __decorateParam(13, IWorkbenchLayoutService),
  __decorateParam(14, ICustomEditorLabelService)
], CustomEditorInput);
export {
  CustomEditorInput
};
