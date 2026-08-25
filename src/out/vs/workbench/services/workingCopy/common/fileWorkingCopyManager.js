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
import { localize } from "../../../../nls.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { Promises } from "../../../../base/common/async.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { toLocalResource, joinPath, isEqual, basename, dirname } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { IFileDialogService, IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { SaveSourceRegistry } from "../../../common/editor.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { IPathService } from "../../path/common/pathService.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { StoredFileWorkingCopyState } from "./storedFileWorkingCopy.js";
import { StoredFileWorkingCopyManager } from "./storedFileWorkingCopyManager.js";
import { UntitledFileWorkingCopy } from "./untitledFileWorkingCopy.js";
import { UntitledFileWorkingCopyManager } from "./untitledFileWorkingCopyManager.js";
import { IWorkingCopyFileService } from "./workingCopyFileService.js";
import { SnapshotContext } from "./fileWorkingCopy.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IEditorService } from "../../editor/common/editorService.js";
import { IElevatedFileService } from "../../files/common/elevatedFileService.js";
import { IFilesConfigurationService } from "../../filesConfiguration/common/filesConfigurationService.js";
import { ILifecycleService } from "../../lifecycle/common/lifecycle.js";
import { IWorkingCopyBackupService } from "./workingCopyBackup.js";
import { IWorkingCopyEditorService } from "./workingCopyEditorService.js";
import { IWorkingCopyService } from "./workingCopyService.js";
import { Schemas } from "../../../../base/common/network.js";
import { IDecorationsService } from "../../decorations/common/decorations.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { listErrorForeground } from "../../../../platform/theme/common/colorRegistry.js";
import { IProgressService } from "../../../../platform/progress/common/progress.js";
let FileWorkingCopyManager = class extends Disposable {
  constructor(workingCopyTypeId, storedWorkingCopyModelFactory, untitledWorkingCopyModelFactory, fileService, lifecycleService, labelService, logService, workingCopyFileService, workingCopyBackupService, uriIdentityService, fileDialogService, filesConfigurationService, workingCopyService, notificationService, workingCopyEditorService, editorService, elevatedFileService, pathService, environmentService, dialogService, decorationsService, progressService) {
    super();
    this.workingCopyTypeId = workingCopyTypeId;
    this.storedWorkingCopyModelFactory = storedWorkingCopyModelFactory;
    this.untitledWorkingCopyModelFactory = untitledWorkingCopyModelFactory;
    this.fileService = fileService;
    this.logService = logService;
    this.workingCopyFileService = workingCopyFileService;
    this.uriIdentityService = uriIdentityService;
    this.fileDialogService = fileDialogService;
    this.filesConfigurationService = filesConfigurationService;
    this.pathService = pathService;
    this.environmentService = environmentService;
    this.dialogService = dialogService;
    this.decorationsService = decorationsService;
    this.stored = this._register(new StoredFileWorkingCopyManager(
      this.workingCopyTypeId,
      this.storedWorkingCopyModelFactory,
      fileService,
      lifecycleService,
      labelService,
      logService,
      workingCopyFileService,
      workingCopyBackupService,
      uriIdentityService,
      filesConfigurationService,
      workingCopyService,
      notificationService,
      workingCopyEditorService,
      editorService,
      elevatedFileService,
      progressService
    ));
    this.untitled = this._register(new UntitledFileWorkingCopyManager(
      this.workingCopyTypeId,
      this.untitledWorkingCopyModelFactory,
      async (workingCopy, options) => {
        const result = await this.saveAs(workingCopy.resource, void 0, options);
        return !!result;
      },
      fileService,
      labelService,
      logService,
      workingCopyBackupService,
      workingCopyService
    ));
    this.onDidCreate = Event.any(this.stored.onDidCreate, this.untitled.onDidCreate);
    this.provideDecorations();
  }
  static {
    this.FILE_WORKING_COPY_SAVE_CREATE_SOURCE = SaveSourceRegistry.registerSource("fileWorkingCopyCreate.source", localize("fileWorkingCopyCreate.source", "File Created"));
  }
  static {
    this.FILE_WORKING_COPY_SAVE_REPLACE_SOURCE = SaveSourceRegistry.registerSource("fileWorkingCopyReplace.source", localize("fileWorkingCopyReplace.source", "File Replaced"));
  }
  //#region decorations
  provideDecorations() {
    const provider = this._register(new class extends Disposable {
      constructor(stored) {
        super();
        this.stored = stored;
        this.label = localize("fileWorkingCopyDecorations", "File Working Copy Decorations");
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
        this.registerListeners();
      }
      registerListeners() {
        this._register(this.stored.onDidResolve((workingCopy) => {
          if (workingCopy.isReadonly() || workingCopy.hasState(StoredFileWorkingCopyState.ORPHAN)) {
            this._onDidChange.fire([workingCopy.resource]);
          }
        }));
        this._register(this.stored.onDidRemove((workingCopyUri) => this._onDidChange.fire([workingCopyUri])));
        this._register(this.stored.onDidChangeReadonly((workingCopy) => this._onDidChange.fire([workingCopy.resource])));
        this._register(this.stored.onDidChangeOrphaned((workingCopy) => this._onDidChange.fire([workingCopy.resource])));
      }
      provideDecorations(uri) {
        const workingCopy = this.stored.get(uri);
        if (!workingCopy || workingCopy.isDisposed()) {
          return void 0;
        }
        const isReadonly = workingCopy.isReadonly();
        const isOrphaned = workingCopy.hasState(StoredFileWorkingCopyState.ORPHAN);
        if (isReadonly && isOrphaned) {
          return {
            color: listErrorForeground,
            letter: Codicon.lockSmall,
            strikethrough: true,
            tooltip: localize("readonlyAndDeleted", "Deleted, Read-only")
          };
        } else if (isReadonly) {
          return {
            letter: Codicon.lockSmall,
            tooltip: localize("readonly", "Read-only")
          };
        } else if (isOrphaned) {
          return {
            color: listErrorForeground,
            strikethrough: true,
            tooltip: localize("deleted", "Deleted")
          };
        }
        return void 0;
      }
    }(this.stored));
    this._register(this.decorationsService.registerDecorationsProvider(provider));
  }
  //#endregion
  //#region get / get all
  get workingCopies() {
    return [...this.stored.workingCopies, ...this.untitled.workingCopies];
  }
  get(resource) {
    return this.stored.get(resource) ?? this.untitled.get(resource);
  }
  resolve(arg1, arg2) {
    if (URI.isUri(arg1)) {
      if (arg1.scheme === Schemas.untitled) {
        return this.untitled.resolve({ untitledResource: arg1 });
      } else {
        return this.stored.resolve(arg1, arg2);
      }
    }
    return this.untitled.resolve(arg1);
  }
  //#endregion
  //#region Save
  async saveAs(source, target, options) {
    if (!target) {
      const workingCopy = this.get(source);
      if (workingCopy instanceof UntitledFileWorkingCopy && workingCopy.hasAssociatedFilePath) {
        target = await this.suggestSavePath(source);
      } else {
        target = await this.fileDialogService.pickFileToSave(await this.suggestSavePath(options?.suggestedTarget ?? source), options?.availableFileSystems);
      }
    }
    if (!target) {
      return;
    }
    if (this.filesConfigurationService.isReadonly(target)) {
      const confirmed = await this.confirmMakeWriteable(target);
      if (!confirmed) {
        return;
      } else {
        this.filesConfigurationService.updateReadonly(target, false);
      }
    }
    if (this.fileService.hasProvider(source) && isEqual(source, target)) {
      return this.doSave(source, {
        ...options,
        force: true
        /* force to save, even if not dirty (https://github.com/microsoft/vscode/issues/99619) */
      });
    }
    if (this.fileService.hasProvider(source) && this.uriIdentityService.extUri.isEqual(source, target) && await this.fileService.exists(source)) {
      await this.workingCopyFileService.move([{ file: { source, target } }], CancellationToken.None);
      return await this.doSave(source, options) ?? await this.doSave(target, options);
    }
    return this.doSaveAs(source, target, options);
  }
  async doSave(resource, options) {
    const storedFileWorkingCopy = this.stored.get(resource);
    if (storedFileWorkingCopy) {
      const success = await storedFileWorkingCopy.save(options);
      if (success) {
        return storedFileWorkingCopy;
      }
    }
    return void 0;
  }
  async doSaveAs(source, target, options) {
    let sourceContents;
    const sourceWorkingCopy = this.get(source);
    if (sourceWorkingCopy?.isResolved()) {
      sourceContents = await sourceWorkingCopy.model.snapshot(SnapshotContext.Save, CancellationToken.None);
    } else {
      sourceContents = (await this.fileService.readFileStream(source)).value;
    }
    const { targetFileExists, targetStoredFileWorkingCopy } = await this.doResolveSaveTarget(source, target);
    if (sourceWorkingCopy instanceof UntitledFileWorkingCopy && sourceWorkingCopy.hasAssociatedFilePath && targetFileExists && this.uriIdentityService.extUri.isEqual(target, toLocalResource(sourceWorkingCopy.resource, this.environmentService.remoteAuthority, this.pathService.defaultUriScheme))) {
      const overwrite = await this.confirmOverwrite(target);
      if (!overwrite) {
        return void 0;
      }
    }
    await targetStoredFileWorkingCopy.model?.update(sourceContents, CancellationToken.None);
    if (!options?.source) {
      options = {
        ...options,
        source: targetFileExists ? FileWorkingCopyManager.FILE_WORKING_COPY_SAVE_REPLACE_SOURCE : FileWorkingCopyManager.FILE_WORKING_COPY_SAVE_CREATE_SOURCE
      };
    }
    const success = await targetStoredFileWorkingCopy.save({
      ...options,
      from: source,
      force: true
      /* force to save, even if not dirty (https://github.com/microsoft/vscode/issues/99619) */
    });
    if (!success) {
      return void 0;
    }
    try {
      await sourceWorkingCopy?.revert();
    } catch (error) {
      this.logService.error(error);
    }
    if (source.scheme === Schemas.untitled) {
      this.untitled.notifyDidSave(source, target);
    }
    return targetStoredFileWorkingCopy;
  }
  async doResolveSaveTarget(source, target) {
    let targetFileExists = false;
    let targetStoredFileWorkingCopy = this.stored.get(target);
    if (targetStoredFileWorkingCopy?.isResolved()) {
      targetFileExists = true;
    } else {
      targetFileExists = await this.fileService.exists(target);
      if (!targetFileExists) {
        await this.workingCopyFileService.create([{ resource: target }], CancellationToken.None);
      }
      if (this.uriIdentityService.extUri.isEqual(source, target) && this.get(source)) {
        targetStoredFileWorkingCopy = await this.stored.resolve(source);
      } else {
        targetStoredFileWorkingCopy = await this.stored.resolve(target);
      }
    }
    return { targetFileExists, targetStoredFileWorkingCopy };
  }
  async confirmOverwrite(resource) {
    const { confirmed } = await this.dialogService.confirm({
      type: "warning",
      message: localize("confirmOverwrite", "'{0}' already exists. Do you want to replace it?", basename(resource)),
      detail: localize("overwriteIrreversible", "A file or folder with the name '{0}' already exists in the folder '{1}'. Replacing it will overwrite its current contents.", basename(resource), basename(dirname(resource))),
      primaryButton: localize({ key: "replaceButtonLabel", comment: ["&& denotes a mnemonic"] }, "&&Replace")
    });
    return confirmed;
  }
  async confirmMakeWriteable(resource) {
    const { confirmed } = await this.dialogService.confirm({
      type: "warning",
      message: localize("confirmMakeWriteable", "'{0}' is marked as read-only. Do you want to save anyway?", basename(resource)),
      detail: localize("confirmMakeWriteableDetail", "Paths can be configured as read-only via settings."),
      primaryButton: localize({ key: "makeWriteableButtonLabel", comment: ["&& denotes a mnemonic"] }, "&&Save Anyway")
    });
    return confirmed;
  }
  async suggestSavePath(resource) {
    if (this.fileService.hasProvider(resource)) {
      return resource;
    }
    const workingCopy = this.get(resource);
    if (workingCopy instanceof UntitledFileWorkingCopy && workingCopy.hasAssociatedFilePath) {
      return toLocalResource(resource, this.environmentService.remoteAuthority, this.pathService.defaultUriScheme);
    }
    const defaultFilePath = await this.fileDialogService.defaultFilePath();
    if (workingCopy) {
      const candidatePath = joinPath(defaultFilePath, workingCopy.name);
      if (await this.pathService.hasValidBasename(candidatePath, workingCopy.name)) {
        return candidatePath;
      }
    }
    return joinPath(defaultFilePath, basename(resource));
  }
  //#endregion
  //#region Lifecycle
  async destroy() {
    await Promises.settled([
      this.stored.destroy(),
      this.untitled.destroy()
    ]);
  }
  //#endregion
};
FileWorkingCopyManager = __decorateClass([
  __decorateParam(3, IFileService),
  __decorateParam(4, ILifecycleService),
  __decorateParam(5, ILabelService),
  __decorateParam(6, ILogService),
  __decorateParam(7, IWorkingCopyFileService),
  __decorateParam(8, IWorkingCopyBackupService),
  __decorateParam(9, IUriIdentityService),
  __decorateParam(10, IFileDialogService),
  __decorateParam(11, IFilesConfigurationService),
  __decorateParam(12, IWorkingCopyService),
  __decorateParam(13, INotificationService),
  __decorateParam(14, IWorkingCopyEditorService),
  __decorateParam(15, IEditorService),
  __decorateParam(16, IElevatedFileService),
  __decorateParam(17, IPathService),
  __decorateParam(18, IWorkbenchEnvironmentService),
  __decorateParam(19, IDialogService),
  __decorateParam(20, IDecorationsService),
  __decorateParam(21, IProgressService)
], FileWorkingCopyManager);
export {
  FileWorkingCopyManager
};
