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
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, dispose } from "../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { Promises } from "../../../../base/common/async.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IWorkingCopyBackupService } from "./workingCopyBackup.js";
let BaseFileWorkingCopyManager = class extends Disposable {
  constructor(fileService, logService, workingCopyBackupService) {
    super();
    this.fileService = fileService;
    this.logService = logService;
    this.workingCopyBackupService = workingCopyBackupService;
    this._onDidCreate = this._register(new Emitter());
    this.onDidCreate = this._onDidCreate.event;
    this.mapResourceToWorkingCopy = new ResourceMap();
    this.mapResourceToDisposeListener = new ResourceMap();
  }
  has(resource) {
    return this.mapResourceToWorkingCopy.has(resource);
  }
  add(resource, workingCopy) {
    const knownWorkingCopy = this.get(resource);
    if (knownWorkingCopy === workingCopy) {
      return;
    }
    this.mapResourceToWorkingCopy.set(resource, workingCopy);
    this.mapResourceToDisposeListener.get(resource)?.dispose();
    this.mapResourceToDisposeListener.set(resource, workingCopy.onWillDispose(() => this.remove(resource)));
    this._onDidCreate.fire(workingCopy);
  }
  remove(resource) {
    const disposeListener = this.mapResourceToDisposeListener.get(resource);
    if (disposeListener) {
      dispose(disposeListener);
      this.mapResourceToDisposeListener.delete(resource);
    }
    return this.mapResourceToWorkingCopy.delete(resource);
  }
  //#region Get / Get all
  get workingCopies() {
    return [...this.mapResourceToWorkingCopy.values()];
  }
  get(resource) {
    return this.mapResourceToWorkingCopy.get(resource);
  }
  //#endregion
  //#region Lifecycle
  dispose() {
    super.dispose();
    this.mapResourceToWorkingCopy.clear();
    dispose(this.mapResourceToDisposeListener.values());
    this.mapResourceToDisposeListener.clear();
  }
  async destroy() {
    try {
      await Promises.settled(this.workingCopies.map(async (workingCopy) => {
        if (workingCopy.isDirty()) {
          await this.saveWithFallback(workingCopy);
        }
      }));
    } catch (error) {
      this.logService.error(error);
    }
    dispose(this.mapResourceToWorkingCopy.values());
    this.dispose();
  }
  async saveWithFallback(workingCopy) {
    let saveSuccess = false;
    try {
      saveSuccess = await workingCopy.save();
    } catch (error) {
    }
    if (!saveSuccess || workingCopy.isDirty()) {
      const backup = await this.workingCopyBackupService.resolve(workingCopy);
      if (backup) {
        await this.fileService.writeFile(workingCopy.resource, backup.value, { unlock: true });
      }
    }
  }
  //#endregion
};
BaseFileWorkingCopyManager = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, ILogService),
  __decorateParam(2, IWorkingCopyBackupService)
], BaseFileWorkingCopyManager);
export {
  BaseFileWorkingCopyManager
};
