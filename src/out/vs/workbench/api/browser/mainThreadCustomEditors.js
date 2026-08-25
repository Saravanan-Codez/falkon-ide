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
import { multibyteAwareBtoa } from "../../../base/common/strings.js";
import { createCancelablePromise, DeferredPromise } from "../../../base/common/async.js";
import { CancellationToken, CancellationTokenSource } from "../../../base/common/cancellation.js";
import { isCancellationError, onUnexpectedError } from "../../../base/common/errors.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { Disposable, DisposableMap, DisposableStore } from "../../../base/common/lifecycle.js";
import { Schemas } from "../../../base/common/network.js";
import { basename } from "../../../base/common/path.js";
import { isEqual, isEqualOrParent, toLocalResource } from "../../../base/common/resources.js";
import { URI } from "../../../base/common/uri.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { localize } from "../../../nls.js";
import { IFileDialogService } from "../../../platform/dialogs/common/dialogs.js";
import { FileOperation, IFileService } from "../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../platform/label/common/label.js";
import { IStorageService } from "../../../platform/storage/common/storage.js";
import { IUndoRedoService, UndoRedoElementType } from "../../../platform/undoRedo/common/undoRedo.js";
import { reviveWebviewExtension } from "./mainThreadWebviews.js";
import * as extHostProtocol from "../common/extHost.protocol.js";
import { CustomEditorDiffInput, CustomEditorSideBySideDiffInput } from "../../contrib/customEditor/browser/customEditorDiffInput.js";
import { CustomEditorInput } from "../../contrib/customEditor/browser/customEditorInput.js";
import { ICustomEditorService } from "../../contrib/customEditor/common/customEditor.js";
import { CustomTextEditorModel } from "../../contrib/customEditor/common/customTextEditorModel.js";
import { ExtensionKeyedWebviewOriginStore } from "../../contrib/webview/browser/webview.js";
import { IWebviewWorkbenchService } from "../../contrib/webviewPanel/browser/webviewWorkbenchService.js";
import { editorGroupToColumn } from "../../services/editor/common/editorGroupColumn.js";
import { IEditorGroupsService } from "../../services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../services/editor/common/editorService.js";
import { IWorkbenchEnvironmentService } from "../../services/environment/common/environmentService.js";
import { IExtensionService } from "../../services/extensions/common/extensions.js";
import { IPathService } from "../../services/path/common/pathService.js";
import { ResourceWorkingCopy } from "../../services/workingCopy/common/resourceWorkingCopy.js";
import { NO_TYPE_ID, WorkingCopyCapabilities } from "../../services/workingCopy/common/workingCopy.js";
import { IWorkingCopyFileService } from "../../services/workingCopy/common/workingCopyFileService.js";
import { IWorkingCopyService } from "../../services/workingCopy/common/workingCopyService.js";
import { IUriIdentityService } from "../../../platform/uriIdentity/common/uriIdentity.js";
import { IUntitledTextEditorService } from "../../services/untitled/common/untitledTextEditorService.js";
var CustomEditorModelType = /* @__PURE__ */ ((CustomEditorModelType2) => {
  CustomEditorModelType2[CustomEditorModelType2["Custom"] = 0] = "Custom";
  CustomEditorModelType2[CustomEditorModelType2["Text"] = 1] = "Text";
  return CustomEditorModelType2;
})(CustomEditorModelType || {});
let MainThreadCustomEditors = class extends Disposable {
  constructor(context, mainThreadWebview, mainThreadWebviewPanels, extensionService, storageService, workingCopyService, workingCopyFileService, _customEditorService, _editorGroupService, _editorService, _instantiationService, _webviewWorkbenchService, _uriIdentityService, _untitledTextEditorService) {
    super();
    this.mainThreadWebview = mainThreadWebview;
    this.mainThreadWebviewPanels = mainThreadWebviewPanels;
    this._customEditorService = _customEditorService;
    this._editorGroupService = _editorGroupService;
    this._editorService = _editorService;
    this._instantiationService = _instantiationService;
    this._webviewWorkbenchService = _webviewWorkbenchService;
    this._uriIdentityService = _uriIdentityService;
    this._untitledTextEditorService = _untitledTextEditorService;
    this._editorProviders = this._register(new DisposableMap());
    this._editorRenameBackups = /* @__PURE__ */ new Map();
    this._pendingSideBySideDiffResolutions = /* @__PURE__ */ new Map();
    this._webviewOriginStore = new ExtensionKeyedWebviewOriginStore("mainThreadCustomEditors.origins", storageService);
    this._proxyCustomEditors = context.getProxy(extHostProtocol.ExtHostContext.ExtHostCustomEditors);
    this._register(workingCopyFileService.registerWorkingCopyProvider((editorResource) => {
      const matchedWorkingCopies = [];
      for (const workingCopy of workingCopyService.workingCopies) {
        if (workingCopy instanceof MainThreadCustomEditorModel) {
          if (isEqualOrParent(editorResource, workingCopy.editorResource)) {
            matchedWorkingCopies.push(workingCopy);
          }
        }
      }
      return matchedWorkingCopies;
    }));
    this._register(_webviewWorkbenchService.registerResolver({
      canResolve: (webview) => {
        if (webview instanceof CustomEditorInput || webview instanceof CustomEditorDiffInput || webview instanceof CustomEditorSideBySideDiffInput) {
          extensionService.activateByEvent(`onCustomEditor:${webview.viewType}`);
        }
        return false;
      },
      resolveWebview: () => {
        throw new Error("not implemented");
      }
    }));
    this._register(workingCopyFileService.onWillRunWorkingCopyFileOperation(async (e) => this.onWillRunWorkingCopyFileOperation(e)));
  }
  $registerTextEditorProvider(extensionData, viewType, options, capabilities, serializeBuffersForPostMessage) {
    this.registerEditorProvider(
      1 /* Text */,
      reviveWebviewExtension(extensionData),
      viewType,
      options,
      capabilities,
      true,
      serializeBuffersForPostMessage
    );
  }
  $registerCustomEditorProvider(extensionData, viewType, options, capabilities, supportsMultipleEditorsPerDocument, serializeBuffersForPostMessage) {
    this.registerEditorProvider(
      0 /* Custom */,
      reviveWebviewExtension(extensionData),
      viewType,
      options,
      capabilities,
      supportsMultipleEditorsPerDocument,
      serializeBuffersForPostMessage
    );
  }
  registerEditorProvider(modelType, extension, viewType, options, capabilities, supportsMultipleEditorsPerDocument, serializeBuffersForPostMessage) {
    if (this._editorProviders.has(viewType)) {
      throw new Error(`Provider for ${viewType} already registered`);
    }
    const disposables = new DisposableStore();
    disposables.add(this._customEditorService.registerCustomEditorCapabilities(viewType, {
      supportsMultipleEditorsPerDocument,
      isTextEditor: modelType === 1 /* Text */,
      supportsInlineDiff: capabilities.supportsInlineDiff,
      supportsSideBySideDiff: capabilities.supportsSideBySideDiff
    }));
    disposables.add(this._webviewWorkbenchService.registerResolver({
      canResolve: (webviewInput) => {
        return (webviewInput instanceof CustomEditorInput || webviewInput instanceof CustomEditorDiffInput || webviewInput instanceof CustomEditorSideBySideDiffInput) && webviewInput.viewType === viewType;
      },
      resolveWebview: async (webviewInput, cancellation) => {
        if (!(webviewInput instanceof CustomEditorInput || webviewInput instanceof CustomEditorDiffInput || webviewInput instanceof CustomEditorSideBySideDiffInput)) {
          return;
        }
        const handle = generateUuid();
        webviewInput.webview.origin = this._webviewOriginStore.getOrigin(viewType, extension.id);
        this.mainThreadWebviewPanels.addWebviewInput(handle, webviewInput, { serializeBuffersForPostMessage });
        webviewInput.webview.options = options;
        webviewInput.webview.extension = extension;
        const resource = webviewInput instanceof CustomEditorDiffInput ? webviewInput.modifiedResource : webviewInput.resource;
        let backupId;
        if (webviewInput instanceof CustomEditorInput) {
          backupId = webviewInput.backupId;
          if (webviewInput.oldResource && !webviewInput.backupId) {
            const backup = this._editorRenameBackups.get(webviewInput.oldResource.toString());
            backupId = backup?.backupId;
            this._editorRenameBackups.delete(webviewInput.oldResource.toString());
          }
        }
        let modelRef;
        const additionalModelRefs = new DisposableStore();
        try {
          modelRef = await this.getOrCreateCustomEditorModel(modelType, resource, viewType, { backupId }, cancellation);
          if (webviewInput instanceof CustomEditorDiffInput && !isEqual(webviewInput.originalResource, resource)) {
            additionalModelRefs.add(await this.getOrCreateCustomEditorModel(modelType, webviewInput.originalResource, viewType, {}, cancellation));
          } else if (modelType === 1 /* Text */ && webviewInput instanceof CustomEditorSideBySideDiffInput) {
            const otherResource = webviewInput.side === "original" ? webviewInput.modifiedResource : webviewInput.originalResource;
            if (!isEqual(otherResource, resource)) {
              additionalModelRefs.add(await this.getOrCreateCustomEditorModel(modelType, otherResource, viewType, {}, cancellation));
            }
          }
        } catch (error) {
          onUnexpectedError(error);
          webviewInput.webview.setHtml(this.mainThreadWebview.getWebviewResolvedFailedContent(viewType));
          additionalModelRefs.dispose();
          modelRef?.dispose();
          return;
        }
        if (!modelRef) {
          additionalModelRefs.dispose();
          return;
        }
        let resolvedModelRef = modelRef;
        if (cancellation.isCancellationRequested) {
          additionalModelRefs.dispose();
          resolvedModelRef.dispose();
          return;
        }
        const disposeModelRefs = () => {
          additionalModelRefs.dispose();
          if (resolvedModelRef.object.isDirty()) {
            const sub = resolvedModelRef.object.onDidChangeDirty(() => {
              if (!resolvedModelRef.object.isDirty()) {
                sub.dispose();
                resolvedModelRef.dispose();
              }
            });
            return;
          }
          resolvedModelRef.dispose();
        };
        const disposeSub = webviewInput.webview.onDidDispose(() => {
          disposeSub.dispose();
          inputDisposeSub.dispose();
          disposeModelRefs();
        });
        const inputDisposeSub = webviewInput.onWillDispose(() => {
          inputDisposeSub.dispose();
          disposeSub.dispose();
          disposeModelRefs();
        });
        if (webviewInput instanceof CustomEditorInput && capabilities.supportsMove) {
          webviewInput.onMove(async (newResource) => {
            const oldModel = resolvedModelRef;
            resolvedModelRef = await this.getOrCreateCustomEditorModel(modelType, newResource, viewType, {}, CancellationToken.None);
            this._proxyCustomEditors.$onMoveCustomEditor(handle, newResource, viewType);
            oldModel.dispose();
          });
        }
        try {
          const initData = {
            title: webviewInput.getTitle(),
            contentOptions: webviewInput.webview.contentOptions,
            options: webviewInput.webview.options,
            active: webviewInput === this._editorService.activeEditor
          };
          const position = editorGroupToColumn(this._editorGroupService, webviewInput.group || 0);
          if (webviewInput instanceof CustomEditorDiffInput) {
            const originalResource = modelType === 1 /* Text */ ? this._uriIdentityService.asCanonicalUri(webviewInput.originalResource) : webviewInput.originalResource;
            const modifiedResource = modelType === 1 /* Text */ ? this._uriIdentityService.asCanonicalUri(webviewInput.modifiedResource) : webviewInput.modifiedResource;
            await this._proxyCustomEditors.$resolveCustomEditorInlineDiff(
              originalResource,
              modifiedResource,
              handle,
              viewType,
              initData,
              position,
              cancellation
            );
          } else if (webviewInput instanceof CustomEditorSideBySideDiffInput) {
            await this.resolveCustomEditorSideBySideDiff(modelType, webviewInput, handle, viewType, initData, position, cancellation);
          } else {
            const actualResource = modelType === 1 /* Text */ ? this._uriIdentityService.asCanonicalUri(resource) : resource;
            await this._proxyCustomEditors.$resolveCustomEditor(actualResource, handle, viewType, initData, position, cancellation);
          }
        } catch (error) {
          onUnexpectedError(error);
          webviewInput.webview.setHtml(this.mainThreadWebview.getWebviewResolvedFailedContent(viewType));
          additionalModelRefs.dispose();
          resolvedModelRef.dispose();
          return;
        }
      }
    }));
    this._editorProviders.set(viewType, disposables);
  }
  resolveCustomEditorSideBySideDiff(modelType, webviewInput, handle, viewType, initData, position, cancellation) {
    let pending = this._pendingSideBySideDiffResolutions.get(webviewInput.diffId);
    if (!pending) {
      pending = {
        promise: new DeferredPromise(),
        cancellation: new CancellationTokenSource(),
        disposables: new DisposableStore()
      };
      this._pendingSideBySideDiffResolutions.set(webviewInput.diffId, pending);
    }
    const cleanup = () => {
      this._pendingSideBySideDiffResolutions.delete(webviewInput.diffId);
      pending.disposables.dispose();
      pending.cancellation.dispose();
    };
    pending.disposables.add(cancellation.onCancellationRequested(() => {
      pending.cancellation.cancel();
      if (!pending.started) {
        pending.promise.cancel();
        cleanup();
      }
    }));
    pending[webviewInput.side] = { handle, initData };
    if (pending.original && pending.modified && !pending.started) {
      pending.started = true;
      pending.promise.settleWith((async () => {
        try {
          const originalResource = modelType === 1 /* Text */ ? this._uriIdentityService.asCanonicalUri(webviewInput.originalResource) : webviewInput.originalResource;
          const modifiedResource = modelType === 1 /* Text */ ? this._uriIdentityService.asCanonicalUri(webviewInput.modifiedResource) : webviewInput.modifiedResource;
          await this._proxyCustomEditors.$resolveCustomEditorSideBySideDiff(
            originalResource,
            modifiedResource,
            {
              original: pending.original.handle,
              modified: pending.modified.handle
            },
            viewType,
            {
              original: pending.original.initData,
              modified: pending.modified.initData
            },
            position,
            pending.cancellation.token
          );
        } finally {
          cleanup();
        }
      })());
    }
    return pending.promise.p;
  }
  $unregisterEditorProvider(viewType) {
    if (!this._editorProviders.has(viewType)) {
      throw new Error(`No provider for ${viewType} registered`);
    }
    this._editorProviders.deleteAndDispose(viewType);
    this._customEditorService.models.disposeAllModelsForView(viewType);
  }
  async getOrCreateCustomEditorModel(modelType, resource, viewType, options, cancellation) {
    const existingModel = this._customEditorService.models.tryRetain(resource, viewType);
    if (existingModel) {
      return existingModel;
    }
    switch (modelType) {
      case 1 /* Text */: {
        const model = CustomTextEditorModel.create(this._instantiationService, viewType, resource);
        return this._customEditorService.models.add(resource, viewType, model);
      }
      case 0 /* Custom */: {
        const model = MainThreadCustomEditorModel.create(this._instantiationService, this._proxyCustomEditors, viewType, resource, options, this._untitledTextEditorService, () => {
          return Array.from(this.mainThreadWebviewPanels.webviewInputs).filter((editor) => editor instanceof CustomEditorInput && isEqual(editor.resource, resource) || editor instanceof CustomEditorDiffInput && (isEqual(editor.originalResource, resource) || isEqual(editor.modifiedResource, resource)) || editor instanceof CustomEditorSideBySideDiffInput && isEqual(editor.resource, resource));
        }, cancellation);
        return this._customEditorService.models.add(resource, viewType, model);
      }
    }
  }
  async $onDidEdit(resourceComponents, viewType, editId, label) {
    const model = await this.getCustomEditorModel(resourceComponents, viewType);
    model.pushEdit(editId, label);
  }
  async $onContentChange(resourceComponents, viewType) {
    const model = await this.getCustomEditorModel(resourceComponents, viewType);
    model.changeContent();
  }
  async getCustomEditorModel(resourceComponents, viewType) {
    const resource = URI.revive(resourceComponents);
    const model = await this._customEditorService.models.get(resource, viewType);
    if (!model || !(model instanceof MainThreadCustomEditorModel)) {
      throw new Error("Could not find model for webview editor");
    }
    return model;
  }
  //#region Working Copy
  async onWillRunWorkingCopyFileOperation(e) {
    if (e.operation !== FileOperation.MOVE) {
      return;
    }
    e.waitUntil((async () => {
      const models = [];
      for (const file of e.files) {
        if (file.source) {
          models.push(...await this._customEditorService.models.getAllModels(file.source));
        }
      }
      for (const model of models) {
        if (model instanceof MainThreadCustomEditorModel && model.isDirty()) {
          const workingCopy = await model.backup(CancellationToken.None);
          if (workingCopy.meta) {
            this._editorRenameBackups.set(model.editorResource.toString(), workingCopy.meta);
          }
        }
      }
    })());
  }
  //#endregion
};
MainThreadCustomEditors = __decorateClass([
  __decorateParam(3, IExtensionService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, IWorkingCopyService),
  __decorateParam(6, IWorkingCopyFileService),
  __decorateParam(7, ICustomEditorService),
  __decorateParam(8, IEditorGroupsService),
  __decorateParam(9, IEditorService),
  __decorateParam(10, IInstantiationService),
  __decorateParam(11, IWebviewWorkbenchService),
  __decorateParam(12, IUriIdentityService),
  __decorateParam(13, IUntitledTextEditorService)
], MainThreadCustomEditors);
var HotExitState;
((HotExitState2) => {
  let Type;
  ((Type2) => {
    Type2[Type2["Allowed"] = 0] = "Allowed";
    Type2[Type2["NotAllowed"] = 1] = "NotAllowed";
    Type2[Type2["Pending"] = 2] = "Pending";
  })(Type = HotExitState2.Type || (HotExitState2.Type = {}));
  HotExitState2.Allowed = Object.freeze({ type: 0 /* Allowed */ });
  HotExitState2.NotAllowed = Object.freeze({ type: 1 /* NotAllowed */ });
  class Pending {
    constructor(operation) {
      this.operation = operation;
      this.type = 2 /* Pending */;
    }
  }
  HotExitState2.Pending = Pending;
})(HotExitState || (HotExitState = {}));
let MainThreadCustomEditorModel = class extends ResourceWorkingCopy {
  constructor(_proxy, _viewType, _editorResource, fromBackup, _editable, startDirty, _getEditors, _fileDialogService, fileService, _labelService, _undoService, _environmentService, workingCopyService, _pathService, extensionService) {
    super(MainThreadCustomEditorModel.toWorkingCopyResource(_viewType, _editorResource), fileService);
    this._proxy = _proxy;
    this._viewType = _viewType;
    this._editorResource = _editorResource;
    this._editable = _editable;
    this._getEditors = _getEditors;
    this._fileDialogService = _fileDialogService;
    this._labelService = _labelService;
    this._undoService = _undoService;
    this._environmentService = _environmentService;
    this._pathService = _pathService;
    this._fromBackup = false;
    this._hotExitState = HotExitState.Allowed;
    this._currentEditIndex = -1;
    this._savePoint = -1;
    this._edits = [];
    // TODO@mjbvz consider to enable a `typeId` that is specific for custom
    // editors. Using a distinct `typeId` allows the working copy to have
    // any resource (including file based resources) even if other working
    // copies exist with the same resource.
    //
    // IMPORTANT: changing the `typeId` has an impact on backups for this
    // working copy. Any value that is not the empty string will be used
    // as seed to the backup. Only change the `typeId` if you have implemented
    // a fallback solution to resolve any existing backups that do not have
    // this seed.
    this.typeId = NO_TYPE_ID;
    this._onDidChangeDirty = this._register(new Emitter());
    this.onDidChangeDirty = this._onDidChangeDirty.event;
    this._onDidChangeContent = this._register(new Emitter());
    this.onDidChangeContent = this._onDidChangeContent.event;
    this._onDidSave = this._register(new Emitter());
    this.onDidSave = this._onDidSave.event;
    this.onDidChangeReadonly = Event.None;
    this._fromBackup = fromBackup;
    this._isDirtyFromContentChange = startDirty;
    if (_editable) {
      this._register(workingCopyService.registerWorkingCopy(this));
      this._register(extensionService.onWillStop((e) => {
        e.veto(true, localize("vetoExtHostRestart", "An extension provided editor for '{0}' is still open that would close otherwise.", this.name));
      }));
    }
  }
  static async create(instantiationService, proxy, viewType, resource, options, untitledTextEditorService, getEditors, cancellation) {
    const editors = getEditors();
    let untitledDocumentData;
    const primaryCustomEditorInput = editors.find((editor) => editor instanceof CustomEditorInput);
    if (primaryCustomEditorInput) {
      untitledDocumentData = primaryCustomEditorInput.untitledDocumentData;
    }
    const { editable } = await proxy.$createCustomDocument(resource, viewType, options.backupId, untitledDocumentData, cancellation);
    if (untitledDocumentData && resource.scheme === Schemas.untitled) {
      untitledTextEditorService.get(resource)?.revert();
    }
    return instantiationService.createInstance(MainThreadCustomEditorModel, proxy, viewType, resource, !!options.backupId, editable, !!untitledDocumentData, getEditors);
  }
  get editorResource() {
    return this._editorResource;
  }
  dispose() {
    if (this._editable) {
      this._undoService.removeElements(this._editorResource);
    }
    this._proxy.$disposeCustomDocument(this._editorResource, this._viewType);
    super.dispose();
  }
  //#region IWorkingCopy
  // Make sure each custom editor has a unique resource for backup and edits
  static toWorkingCopyResource(viewType, resource) {
    const authority = viewType.replace(/[^a-z0-9\-_]/gi, "-");
    const path = `/${multibyteAwareBtoa(resource.with({ query: null, fragment: null }).toString(true))}`;
    return URI.from({
      scheme: Schemas.vscodeCustomEditor,
      authority,
      path,
      query: JSON.stringify(resource.toJSON())
    });
  }
  get name() {
    return basename(this._labelService.getUriLabel(this._editorResource));
  }
  get capabilities() {
    return this.isUntitled() ? WorkingCopyCapabilities.Untitled : WorkingCopyCapabilities.None;
  }
  isDirty() {
    if (this._isDirtyFromContentChange) {
      return true;
    }
    if (this._edits.length > 0) {
      return this._savePoint !== this._currentEditIndex;
    }
    return this._fromBackup;
  }
  isUntitled() {
    return this._editorResource.scheme === Schemas.untitled;
  }
  //#endregion
  isReadonly() {
    return !this._editable;
  }
  get viewType() {
    return this._viewType;
  }
  get backupId() {
    return this._backupId;
  }
  pushEdit(editId, label) {
    if (!this._editable) {
      throw new Error("Document is not editable");
    }
    this.change(() => {
      this.spliceEdits(editId);
      this._currentEditIndex = this._edits.length - 1;
    });
    this._undoService.pushElement({
      type: UndoRedoElementType.Resource,
      resource: this._editorResource,
      label: label ?? localize("defaultEditLabel", "Edit"),
      code: "undoredo.customEditorEdit",
      undo: () => this.undo(),
      redo: () => this.redo()
    });
  }
  changeContent() {
    this.change(() => {
      this._isDirtyFromContentChange = true;
    });
  }
  async undo() {
    if (!this._editable) {
      return;
    }
    if (this._currentEditIndex < 0) {
      return;
    }
    const undoneEdit = this._edits[this._currentEditIndex];
    this.change(() => {
      --this._currentEditIndex;
    });
    await this._proxy.$undo(this._editorResource, this.viewType, undoneEdit, this.isDirty());
  }
  async redo() {
    if (!this._editable) {
      return;
    }
    if (this._currentEditIndex >= this._edits.length - 1) {
      return;
    }
    const redoneEdit = this._edits[this._currentEditIndex + 1];
    this.change(() => {
      ++this._currentEditIndex;
    });
    await this._proxy.$redo(this._editorResource, this.viewType, redoneEdit, this.isDirty());
  }
  spliceEdits(editToInsert) {
    const start = this._currentEditIndex + 1;
    const toRemove = this._edits.length - this._currentEditIndex;
    const removedEdits = typeof editToInsert === "number" ? this._edits.splice(start, toRemove, editToInsert) : this._edits.splice(start, toRemove);
    if (removedEdits.length) {
      this._proxy.$disposeEdits(this._editorResource, this._viewType, removedEdits);
    }
  }
  change(makeEdit) {
    const wasDirty = this.isDirty();
    makeEdit();
    this._onDidChangeContent.fire();
    if (this.isDirty() !== wasDirty) {
      this._onDidChangeDirty.fire();
    }
  }
  async revert(options) {
    if (!this._editable) {
      return;
    }
    if (this._currentEditIndex === this._savePoint && !this._isDirtyFromContentChange && !this._fromBackup) {
      return;
    }
    if (!options?.soft) {
      this._proxy.$revert(this._editorResource, this.viewType, CancellationToken.None);
    }
    this.change(() => {
      this._isDirtyFromContentChange = false;
      this._fromBackup = false;
      this._currentEditIndex = this._savePoint;
      this.spliceEdits();
    });
  }
  async save(options) {
    const result = !!await this.saveCustomEditor(options);
    if (result) {
      this._onDidSave.fire({ reason: options?.reason, source: options?.source });
    }
    return result;
  }
  async saveCustomEditor(options) {
    if (!this._editable) {
      return void 0;
    }
    if (this.isUntitled()) {
      const targetUri = await this.suggestUntitledSavePath(options);
      if (!targetUri) {
        return void 0;
      }
      await this.saveCustomEditorAs(this._editorResource, targetUri, options);
      return targetUri;
    }
    const savePromise = createCancelablePromise((token) => this._proxy.$onSave(this._editorResource, this.viewType, token));
    this._ongoingSave?.cancel();
    this._ongoingSave = savePromise;
    try {
      await savePromise;
      if (this._ongoingSave === savePromise) {
        this.change(() => {
          this._isDirtyFromContentChange = false;
          this._savePoint = this._currentEditIndex;
          this._fromBackup = false;
        });
      }
    } finally {
      if (this._ongoingSave === savePromise) {
        this._ongoingSave = void 0;
      }
    }
    return this._editorResource;
  }
  suggestUntitledSavePath(options) {
    if (!this.isUntitled()) {
      throw new Error("Resource is not untitled");
    }
    const remoteAuthority = this._environmentService.remoteAuthority;
    const localResource = toLocalResource(this._editorResource, remoteAuthority, this._pathService.defaultUriScheme);
    return this._fileDialogService.pickFileToSave(localResource, options?.availableFileSystems);
  }
  async saveCustomEditorAs(resource, targetResource, _options) {
    if (this._editable) {
      await createCancelablePromise((token) => this._proxy.$onSaveAs(this._editorResource, this.viewType, targetResource, token));
      this.change(() => {
        this._isDirtyFromContentChange = false;
        this._savePoint = this._currentEditIndex;
        this._fromBackup = false;
      });
      return true;
    } else {
      await this.fileService.copy(
        resource,
        targetResource,
        false
        /* overwrite */
      );
      return true;
    }
  }
  get canHotExit() {
    return typeof this._backupId === "string" && this._hotExitState.type === 0 /* Allowed */;
  }
  async backup(token) {
    const editors = this._getEditors();
    if (!editors.length) {
      throw new Error("No editors found for resource, cannot back up");
    }
    const primaryEditor = editors[0];
    const backupMeta = {
      viewType: this.viewType,
      editorResource: this._editorResource,
      customTitle: primaryEditor.getWebviewTitle(),
      iconPath: primaryEditor.iconPath,
      backupId: "",
      extension: primaryEditor.extension ? {
        id: primaryEditor.extension.id.value,
        location: primaryEditor.extension.location
      } : void 0,
      webview: {
        origin: primaryEditor.webview.origin,
        options: primaryEditor.webview.options,
        state: primaryEditor.webview.state
      }
    };
    const backupData = {
      meta: backupMeta
    };
    if (!this._editable) {
      return backupData;
    }
    if (this._hotExitState.type === 2 /* Pending */) {
      this._hotExitState.operation.cancel();
    }
    const pendingState = new HotExitState.Pending(
      createCancelablePromise((token2) => this._proxy.$backup(this._editorResource.toJSON(), this.viewType, token2))
    );
    this._hotExitState = pendingState;
    token.onCancellationRequested(() => {
      pendingState.operation.cancel();
    });
    let errorMessage = "";
    try {
      const backupId = await pendingState.operation;
      if (this._hotExitState === pendingState) {
        this._hotExitState = HotExitState.Allowed;
        backupData.meta.backupId = backupId;
        this._backupId = backupId;
      }
    } catch (e) {
      if (isCancellationError(e)) {
        throw e;
      }
      if (this._hotExitState === pendingState) {
        this._hotExitState = HotExitState.NotAllowed;
      }
      if (e.message) {
        errorMessage = e.message;
      }
    }
    if (this._hotExitState === HotExitState.Allowed) {
      return backupData;
    }
    throw new Error(`Cannot backup in this state: ${errorMessage}`);
  }
};
MainThreadCustomEditorModel = __decorateClass([
  __decorateParam(7, IFileDialogService),
  __decorateParam(8, IFileService),
  __decorateParam(9, ILabelService),
  __decorateParam(10, IUndoRedoService),
  __decorateParam(11, IWorkbenchEnvironmentService),
  __decorateParam(12, IWorkingCopyService),
  __decorateParam(13, IPathService),
  __decorateParam(14, IExtensionService)
], MainThreadCustomEditorModel);
export {
  MainThreadCustomEditors
};
