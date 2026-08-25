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
import { DisposableStore, dispose } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { UntitledFileWorkingCopy } from "./untitledFileWorkingCopy.js";
import { Emitter } from "../../../../base/common/event.js";
import { Schemas } from "../../../../base/common/network.js";
import { IWorkingCopyService } from "./workingCopyService.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IWorkingCopyBackupService } from "./workingCopyBackup.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { BaseFileWorkingCopyManager } from "./abstractFileWorkingCopyManager.js";
import { ResourceMap } from "../../../../base/common/map.js";
let UntitledFileWorkingCopyManager = class extends BaseFileWorkingCopyManager {
  constructor(workingCopyTypeId, modelFactory, saveDelegate, fileService, labelService, logService, workingCopyBackupService, workingCopyService) {
    super(fileService, logService, workingCopyBackupService);
    this.workingCopyTypeId = workingCopyTypeId;
    this.modelFactory = modelFactory;
    this.saveDelegate = saveDelegate;
    this.labelService = labelService;
    this.workingCopyService = workingCopyService;
    //#region Events
    this._onDidSave = this._register(new Emitter());
    this.onDidSave = this._onDidSave.event;
    this._onDidChangeDirty = this._register(new Emitter());
    this.onDidChangeDirty = this._onDidChangeDirty.event;
    this._onWillDispose = this._register(new Emitter());
    this.onWillDispose = this._onWillDispose.event;
    //#endregion
    this.mapResourceToWorkingCopyListeners = new ResourceMap();
  }
  async resolve(options) {
    const workingCopy = this.doCreateOrGet(options);
    await workingCopy.resolve();
    return workingCopy;
  }
  doCreateOrGet(options = /* @__PURE__ */ Object.create(null)) {
    const massagedOptions = this.massageOptions(options);
    if (massagedOptions.untitledResource) {
      const existingWorkingCopy = this.get(massagedOptions.untitledResource);
      if (existingWorkingCopy) {
        return existingWorkingCopy;
      }
    }
    return this.doCreate(massagedOptions);
  }
  massageOptions(options) {
    const massagedOptions = /* @__PURE__ */ Object.create(null);
    if (options.associatedResource) {
      massagedOptions.untitledResource = URI.from({
        scheme: Schemas.untitled,
        authority: options.associatedResource.authority,
        fragment: options.associatedResource.fragment,
        path: options.associatedResource.path,
        query: options.associatedResource.query
      });
      massagedOptions.associatedResource = options.associatedResource;
    } else {
      if (options.untitledResource?.scheme === Schemas.untitled) {
        massagedOptions.untitledResource = options.untitledResource;
      }
      massagedOptions.isScratchpad = options.isScratchpad;
    }
    massagedOptions.contents = options.contents;
    return massagedOptions;
  }
  doCreate(options) {
    let untitledResource = options.untitledResource;
    if (!untitledResource) {
      let counter = 1;
      do {
        untitledResource = URI.from({
          scheme: Schemas.untitled,
          path: options.isScratchpad ? `Scratchpad-${counter}` : `Untitled-${counter}`,
          query: this.workingCopyTypeId ? `typeId=${this.workingCopyTypeId}` : (
            // distinguish untitled resources among others by encoding the `typeId` as query param
            void 0
          )
          // keep untitled resources for text files as they are (when `typeId === ''`)
        });
        counter++;
      } while (this.has(untitledResource));
    }
    const workingCopy = new UntitledFileWorkingCopy(
      this.workingCopyTypeId,
      untitledResource,
      this.labelService.getUriBasenameLabel(untitledResource),
      !!options.associatedResource,
      !!options.isScratchpad,
      options.contents,
      this.modelFactory,
      this.saveDelegate,
      this.workingCopyService,
      this.workingCopyBackupService,
      this.logService
    );
    this.registerWorkingCopy(workingCopy);
    return workingCopy;
  }
  registerWorkingCopy(workingCopy) {
    const workingCopyListeners = new DisposableStore();
    workingCopyListeners.add(workingCopy.onDidChangeDirty(() => this._onDidChangeDirty.fire(workingCopy)));
    workingCopyListeners.add(workingCopy.onWillDispose(() => this._onWillDispose.fire(workingCopy)));
    this.mapResourceToWorkingCopyListeners.set(workingCopy.resource, workingCopyListeners);
    this.add(workingCopy.resource, workingCopy);
    if (workingCopy.isDirty()) {
      this._onDidChangeDirty.fire(workingCopy);
    }
  }
  remove(resource) {
    const removed = super.remove(resource);
    const workingCopyListener = this.mapResourceToWorkingCopyListeners.get(resource);
    if (workingCopyListener) {
      dispose(workingCopyListener);
      this.mapResourceToWorkingCopyListeners.delete(resource);
    }
    return removed;
  }
  //#endregion
  //#region Lifecycle
  dispose() {
    super.dispose();
    dispose(this.mapResourceToWorkingCopyListeners.values());
    this.mapResourceToWorkingCopyListeners.clear();
  }
  //#endregion
  notifyDidSave(source, target) {
    this._onDidSave.fire({ source, target });
  }
};
UntitledFileWorkingCopyManager = __decorateClass([
  __decorateParam(3, IFileService),
  __decorateParam(4, ILabelService),
  __decorateParam(5, ILogService),
  __decorateParam(6, IWorkingCopyBackupService),
  __decorateParam(7, IWorkingCopyService)
], UntitledFileWorkingCopyManager);
export {
  UntitledFileWorkingCopyManager
};
