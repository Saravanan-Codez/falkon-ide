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
import { localize } from "../../../../../nls.js";
import { toErrorMessage } from "../../../../../base/common/errorMessage.js";
import { basename, isEqual } from "../../../../../base/common/resources.js";
import { Action } from "../../../../../base/common/actions.js";
import { URI } from "../../../../../base/common/uri.js";
import { FileOperationResult } from "../../../../../platform/files/common/files.js";
import { ITextFileService } from "../../../../services/textfile/common/textfiles.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { dispose, Disposable } from "../../../../../base/common/lifecycle.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { ResourceMap } from "../../../../../base/common/map.js";
import { DiffEditorInput } from "../../../../common/editor/diffEditorInput.js";
import { IContextKeyService, RawContextKey } from "../../../../../platform/contextkey/common/contextkey.js";
import { TextFileContentProvider } from "../../common/files.js";
import { FileEditorInput } from "./fileEditorInput.js";
import { SAVE_FILE_AS_LABEL } from "../fileConstants.js";
import { INotificationService, Severity } from "../../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { Event } from "../../../../../base/common/event.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { isWindows } from "../../../../../base/common/platform.js";
import { Schemas } from "../../../../../base/common/network.js";
import { IPreferencesService } from "../../../../services/preferences/common/preferences.js";
import { SaveReason, SideBySideEditor } from "../../../../common/editor.js";
import { hash } from "../../../../../base/common/hash.js";
const CONFLICT_RESOLUTION_CONTEXT = "saveConflictResolutionContext";
const CONFLICT_RESOLUTION_SCHEME = "conflictResolution";
const LEARN_MORE_DIRTY_WRITE_IGNORE_KEY = "learnMoreDirtyWriteError";
const conflictEditorHelp = localize("userGuide", "Use the actions in the editor tool bar to either undo your changes or overwrite the content of the file with your changes.");
let TextFileSaveErrorHandler = class extends Disposable {
  constructor(notificationService, textFileService, contextKeyService, editorService, textModelService, instantiationService, storageService) {
    super();
    this.notificationService = notificationService;
    this.textFileService = textFileService;
    this.editorService = editorService;
    this.instantiationService = instantiationService;
    this.storageService = storageService;
    this.messages = new ResourceMap();
    this.activeConflictResolutionResource = void 0;
    this.conflictResolutionContext = new RawContextKey(CONFLICT_RESOLUTION_CONTEXT, false, true).bindTo(contextKeyService);
    const provider = this._register(instantiationService.createInstance(TextFileContentProvider));
    this._register(textModelService.registerTextModelContentProvider(CONFLICT_RESOLUTION_SCHEME, provider));
    this.textFileService.files.saveErrorHandler = this;
    this.registerListeners();
  }
  static {
    this.ID = "workbench.contrib.textFileSaveErrorHandler";
  }
  registerListeners() {
    this._register(this.textFileService.files.onDidSave((e) => this.onFileSavedOrReverted(e.model.resource)));
    this._register(this.textFileService.files.onDidRevert((model) => this.onFileSavedOrReverted(model.resource)));
    this._register(this.editorService.onDidActiveEditorChange(() => this.onActiveEditorChanged()));
  }
  onActiveEditorChanged() {
    let isActiveEditorSaveConflictResolution = false;
    let activeConflictResolutionResource;
    const activeInput = this.editorService.activeEditor;
    if (activeInput instanceof DiffEditorInput) {
      const resource = activeInput.original.resource;
      if (resource?.scheme === CONFLICT_RESOLUTION_SCHEME) {
        isActiveEditorSaveConflictResolution = true;
        activeConflictResolutionResource = activeInput.modified.resource;
      }
    }
    this.conflictResolutionContext.set(isActiveEditorSaveConflictResolution);
    this.activeConflictResolutionResource = activeConflictResolutionResource;
  }
  onFileSavedOrReverted(resource) {
    const messageHandle = this.messages.get(resource);
    if (messageHandle) {
      messageHandle.close();
      this.messages.delete(resource);
    }
  }
  onSaveError(error, model, options) {
    const fileOperationError = error;
    const resource = model.resource;
    let message;
    const primaryActions = [];
    const secondaryActions = [];
    if (fileOperationError.fileOperationResult === FileOperationResult.FILE_MODIFIED_SINCE) {
      if (this.activeConflictResolutionResource && isEqual(this.activeConflictResolutionResource, model.resource)) {
        if (this.storageService.getBoolean(LEARN_MORE_DIRTY_WRITE_IGNORE_KEY, StorageScope.APPLICATION)) {
          return;
        }
        message = conflictEditorHelp;
        primaryActions.push(this.instantiationService.createInstance(ResolveConflictLearnMoreAction));
        secondaryActions.push(this.instantiationService.createInstance(DoNotShowResolveConflictLearnMoreAction));
      } else {
        message = localize("staleSaveError", "Failed to save '{0}': The content of the file is newer. Please compare your version with the file contents or overwrite the content of the file with your changes.", basename(resource));
        primaryActions.push(this.instantiationService.createInstance(ResolveSaveConflictAction, model));
        primaryActions.push(this.instantiationService.createInstance(SaveModelIgnoreModifiedSinceAction, model, options));
        secondaryActions.push(this.instantiationService.createInstance(ConfigureSaveConflictAction));
      }
    } else {
      const isWriteLocked = fileOperationError.fileOperationResult === FileOperationResult.FILE_WRITE_LOCKED;
      const triedToUnlock = isWriteLocked && fileOperationError.options?.unlock;
      const isPermissionDenied = fileOperationError.fileOperationResult === FileOperationResult.FILE_PERMISSION_DENIED;
      const canSaveElevated = resource.scheme === Schemas.file;
      if (canSaveElevated && (isPermissionDenied || triedToUnlock)) {
        primaryActions.push(this.instantiationService.createInstance(SaveModelElevatedAction, model, options, !!triedToUnlock));
      } else if (isWriteLocked) {
        primaryActions.push(this.instantiationService.createInstance(UnlockModelAction, model, options));
      } else {
        primaryActions.push(this.instantiationService.createInstance(RetrySaveModelAction, model, options));
      }
      primaryActions.push(this.instantiationService.createInstance(SaveModelAsAction, model));
      primaryActions.push(this.instantiationService.createInstance(RevertModelAction, model));
      if (isWriteLocked) {
        if (triedToUnlock && canSaveElevated) {
          message = isWindows ? localize("readonlySaveErrorAdmin", "Failed to save '{0}': File is read-only. Select 'Overwrite as Admin' to retry as administrator.", basename(resource)) : localize("readonlySaveErrorSudo", "Failed to save '{0}': File is read-only. Select 'Overwrite as Sudo' to retry as superuser.", basename(resource));
        } else {
          message = localize("readonlySaveError", "Failed to save '{0}': File is read-only. Select 'Overwrite' to attempt to make it writeable.", basename(resource));
        }
      } else if (canSaveElevated && isPermissionDenied) {
        message = isWindows ? localize("permissionDeniedSaveError", "Failed to save '{0}': Insufficient permissions. Select 'Retry as Admin' to retry as administrator.", basename(resource)) : localize("permissionDeniedSaveErrorSudo", "Failed to save '{0}': Insufficient permissions. Select 'Retry as Sudo' to retry as superuser.", basename(resource));
      } else {
        message = localize({ key: "genericSaveError", comment: ["{0} is the resource that failed to save and {1} the error message"] }, "Failed to save '{0}': {1}", basename(resource), toErrorMessage(error, false));
      }
    }
    const actions = { primary: primaryActions, secondary: secondaryActions };
    const handle = this.notificationService.notify({
      id: `${hash(model.resource.toString())}`,
      // unique per model (https://github.com/microsoft/vscode/issues/121539)
      severity: Severity.Error,
      message,
      actions
    });
    Event.once(handle.onDidClose)(() => {
      dispose(primaryActions);
      dispose(secondaryActions);
    });
    this.messages.set(model.resource, handle);
  }
  dispose() {
    super.dispose();
    this.messages.clear();
  }
};
TextFileSaveErrorHandler = __decorateClass([
  __decorateParam(0, INotificationService),
  __decorateParam(1, ITextFileService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, ITextModelService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IStorageService)
], TextFileSaveErrorHandler);
const pendingResolveSaveConflictMessages = [];
function clearPendingResolveSaveConflictMessages() {
  while (pendingResolveSaveConflictMessages.length > 0) {
    const item = pendingResolveSaveConflictMessages.pop();
    item?.close();
  }
}
let ResolveConflictLearnMoreAction = class extends Action {
  constructor(openerService) {
    super("workbench.files.action.resolveConflictLearnMore", localize("learnMore", "Learn More"));
    this.openerService = openerService;
  }
  async run() {
    await this.openerService.open(URI.parse("https://go.microsoft.com/fwlink/?linkid=868264"));
  }
};
ResolveConflictLearnMoreAction = __decorateClass([
  __decorateParam(0, IOpenerService)
], ResolveConflictLearnMoreAction);
let DoNotShowResolveConflictLearnMoreAction = class extends Action {
  constructor(storageService) {
    super("workbench.files.action.resolveConflictLearnMoreDoNotShowAgain", localize("dontShowAgain", "Don't Show Again"));
    this.storageService = storageService;
  }
  async run(notification) {
    this.storageService.store(LEARN_MORE_DIRTY_WRITE_IGNORE_KEY, true, StorageScope.APPLICATION, StorageTarget.USER);
    notification.dispose();
  }
};
DoNotShowResolveConflictLearnMoreAction = __decorateClass([
  __decorateParam(0, IStorageService)
], DoNotShowResolveConflictLearnMoreAction);
let ResolveSaveConflictAction = class extends Action {
  constructor(model, editorService, notificationService, instantiationService, productService) {
    super("workbench.files.action.resolveConflict", localize("compareChanges", "Compare"));
    this.model = model;
    this.editorService = editorService;
    this.notificationService = notificationService;
    this.instantiationService = instantiationService;
    this.productService = productService;
  }
  async run() {
    if (!this.model.isDisposed()) {
      const resource = this.model.resource;
      const name = basename(resource);
      const editorLabel = localize("saveConflictDiffLabel", "{0} (in file) \u2194 {1} (in {2}) - Resolve save conflict", name, name, this.productService.nameLong);
      await TextFileContentProvider.open(resource, CONFLICT_RESOLUTION_SCHEME, editorLabel, this.editorService, { pinned: true });
      const actions = { primary: [this.instantiationService.createInstance(ResolveConflictLearnMoreAction)] };
      const handle = this.notificationService.notify({
        id: `${hash(resource.toString())}`,
        // unique per model
        severity: Severity.Info,
        message: conflictEditorHelp,
        actions,
        neverShowAgain: { id: LEARN_MORE_DIRTY_WRITE_IGNORE_KEY, isSecondary: true }
      });
      Event.once(handle.onDidClose)(() => dispose(actions.primary));
      pendingResolveSaveConflictMessages.push(handle);
    }
  }
};
ResolveSaveConflictAction = __decorateClass([
  __decorateParam(1, IEditorService),
  __decorateParam(2, INotificationService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IProductService)
], ResolveSaveConflictAction);
class SaveModelElevatedAction extends Action {
  constructor(model, options, triedToUnlock) {
    super("workbench.files.action.saveModelElevated", triedToUnlock ? isWindows ? localize("overwriteElevated", "Overwrite as Admin...") : localize("overwriteElevatedSudo", "Overwrite as Sudo...") : isWindows ? localize("saveElevated", "Retry as Admin...") : localize("saveElevatedSudo", "Retry as Sudo..."));
    this.model = model;
    this.options = options;
    this.triedToUnlock = triedToUnlock;
  }
  async run() {
    if (!this.model.isDisposed()) {
      await this.model.save({
        ...this.options,
        writeElevated: true,
        writeUnlock: this.triedToUnlock,
        reason: SaveReason.EXPLICIT
      });
    }
  }
}
class RetrySaveModelAction extends Action {
  constructor(model, options) {
    super("workbench.files.action.saveModel", localize("retry", "Retry"));
    this.model = model;
    this.options = options;
  }
  async run() {
    if (!this.model.isDisposed()) {
      await this.model.save({ ...this.options, reason: SaveReason.EXPLICIT });
    }
  }
}
class RevertModelAction extends Action {
  constructor(model) {
    super("workbench.files.action.revertModel", localize("revert", "Revert"));
    this.model = model;
  }
  async run() {
    if (!this.model.isDisposed()) {
      await this.model.revert();
    }
  }
}
let SaveModelAsAction = class extends Action {
  constructor(model, editorService) {
    super("workbench.files.action.saveModelAs", SAVE_FILE_AS_LABEL.value);
    this.model = model;
    this.editorService = editorService;
  }
  async run() {
    if (!this.model.isDisposed()) {
      const editor = this.findEditor();
      if (editor) {
        await this.editorService.save(editor, { saveAs: true, reason: SaveReason.EXPLICIT });
      }
    }
  }
  findEditor() {
    let preferredMatchingEditor;
    const editors = this.editorService.findEditors(this.model.resource, { supportSideBySide: SideBySideEditor.PRIMARY });
    for (const identifier of editors) {
      if (identifier.editor instanceof FileEditorInput) {
        preferredMatchingEditor = identifier;
        break;
      } else if (!preferredMatchingEditor) {
        preferredMatchingEditor = identifier;
      }
    }
    return preferredMatchingEditor;
  }
};
SaveModelAsAction = __decorateClass([
  __decorateParam(1, IEditorService)
], SaveModelAsAction);
class UnlockModelAction extends Action {
  constructor(model, options) {
    super("workbench.files.action.unlock", localize("overwrite", "Overwrite"));
    this.model = model;
    this.options = options;
  }
  async run() {
    if (!this.model.isDisposed()) {
      await this.model.save({ ...this.options, writeUnlock: true, reason: SaveReason.EXPLICIT });
    }
  }
}
class SaveModelIgnoreModifiedSinceAction extends Action {
  constructor(model, options) {
    super("workbench.files.action.saveIgnoreModifiedSince", localize("overwrite", "Overwrite"));
    this.model = model;
    this.options = options;
  }
  async run() {
    if (!this.model.isDisposed()) {
      await this.model.save({ ...this.options, ignoreModifiedSince: true, reason: SaveReason.EXPLICIT });
    }
  }
}
let ConfigureSaveConflictAction = class extends Action {
  constructor(preferencesService) {
    super("workbench.files.action.configureSaveConflict", localize("configure", "Configure"));
    this.preferencesService = preferencesService;
  }
  async run() {
    this.preferencesService.openSettings({ query: "files.saveConflictResolution" });
  }
};
ConfigureSaveConflictAction = __decorateClass([
  __decorateParam(0, IPreferencesService)
], ConfigureSaveConflictAction);
const acceptLocalChangesCommand = (accessor, resource) => {
  return acceptOrRevertLocalChangesCommand(accessor, resource, true);
};
const revertLocalChangesCommand = (accessor, resource) => {
  return acceptOrRevertLocalChangesCommand(accessor, resource, false);
};
async function acceptOrRevertLocalChangesCommand(accessor, resource, accept) {
  const editorService = accessor.get(IEditorService);
  if (!URI.isUri(resource)) {
    return;
  }
  const editorPane = editorService.activeEditorPane;
  if (!editorPane) {
    return;
  }
  const editor = editorPane.input;
  const group = editorPane.group;
  clearPendingResolveSaveConflictMessages();
  if (accept) {
    const options = { ignoreModifiedSince: true, reason: SaveReason.EXPLICIT };
    await editorService.save({ editor, groupId: group.id }, options);
  } else {
    await editorService.revert({ editor, groupId: group.id });
  }
  await editorService.openEditor({ resource }, group);
  return group.closeEditor(editor);
}
export {
  CONFLICT_RESOLUTION_CONTEXT,
  CONFLICT_RESOLUTION_SCHEME,
  TextFileSaveErrorHandler,
  acceptLocalChangesCommand,
  revertLocalChangesCommand
};
