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
import { timeout } from "../../../../base/common/async.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { FileChangeType, IFileService } from "../../../../platform/files/common/files.js";
let ResourceWorkingCopy = class extends Disposable {
  constructor(resource, fileService) {
    super();
    this.resource = resource;
    this.fileService = fileService;
    //#region Orphaned Tracking
    this._onDidChangeOrphaned = this._register(new Emitter());
    this.onDidChangeOrphaned = this._onDidChangeOrphaned.event;
    this.orphaned = false;
    //#endregion
    //#region Dispose
    this._onWillDispose = this._register(new Emitter());
    this.onWillDispose = this._onWillDispose.event;
    this._register(this.fileService.onDidFilesChange((e) => this.onDidFilesChange(e)));
  }
  isOrphaned() {
    return this.orphaned;
  }
  async onDidFilesChange(e) {
    let fileEventImpactsUs = false;
    let newInOrphanModeGuess;
    if (this.orphaned) {
      const fileWorkingCopyResourceAdded = e.contains(this.resource, FileChangeType.ADDED);
      if (fileWorkingCopyResourceAdded) {
        newInOrphanModeGuess = false;
        fileEventImpactsUs = true;
      }
    } else {
      const fileWorkingCopyResourceDeleted = e.contains(this.resource, FileChangeType.DELETED);
      if (fileWorkingCopyResourceDeleted) {
        newInOrphanModeGuess = true;
        fileEventImpactsUs = true;
      }
    }
    if (fileEventImpactsUs && this.orphaned !== newInOrphanModeGuess) {
      let newInOrphanModeValidated = false;
      if (newInOrphanModeGuess) {
        await timeout(100, CancellationToken.None);
        if (this.isDisposed()) {
          newInOrphanModeValidated = true;
        } else {
          const exists = await this.fileService.exists(this.resource);
          newInOrphanModeValidated = !exists;
        }
      }
      if (this.orphaned !== newInOrphanModeValidated && !this.isDisposed()) {
        this.setOrphaned(newInOrphanModeValidated);
      }
    }
  }
  setOrphaned(orphaned) {
    if (this.orphaned !== orphaned) {
      this.orphaned = orphaned;
      this._onDidChangeOrphaned.fire();
    }
  }
  isDisposed() {
    return this._store.isDisposed;
  }
  dispose() {
    this.orphaned = false;
    this._onWillDispose.fire();
    super.dispose();
  }
  //#endregion
  //#region Modified Tracking
  isModified() {
    return this.isDirty();
  }
  //#endregion
};
ResourceWorkingCopy = __decorateClass([
  __decorateParam(1, IFileService)
], ResourceWorkingCopy);
export {
  ResourceWorkingCopy
};
