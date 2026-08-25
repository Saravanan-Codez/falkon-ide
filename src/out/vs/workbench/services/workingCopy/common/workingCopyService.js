import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { Emitter } from "../../../../base/common/event.js";
import { URI } from "../../../../base/common/uri.js";
import { Disposable, toDisposable, DisposableStore, DisposableMap } from "../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
const IWorkingCopyService = createDecorator("workingCopyService");
class WorkingCopyLeakError extends Error {
  constructor(message, stack) {
    super(message);
    this.name = "WorkingCopyLeakError";
    this.stack = stack;
  }
}
class WorkingCopyService extends Disposable {
  constructor() {
    super(...arguments);
    //#region Events
    this._onDidRegister = this._register(new Emitter());
    this.onDidRegister = this._onDidRegister.event;
    this._onDidUnregister = this._register(new Emitter());
    this.onDidUnregister = this._onDidUnregister.event;
    this._onDidChangeDirty = this._register(new Emitter());
    this.onDidChangeDirty = this._onDidChangeDirty.event;
    this._onDidChangeContent = this._register(new Emitter());
    this.onDidChangeContent = this._onDidChangeContent.event;
    this._onDidSave = this._register(new Emitter());
    this.onDidSave = this._onDidSave.event;
    this._workingCopies = /* @__PURE__ */ new Set();
    this.mapResourceToWorkingCopies = new ResourceMap();
    this.mapWorkingCopyToListeners = this._register(new DisposableMap());
    this.mapLeakToCounter = /* @__PURE__ */ new Map();
  }
  //#endregion
  //#region Registry
  get workingCopies() {
    return Array.from(this._workingCopies.values());
  }
  registerWorkingCopy(workingCopy) {
    let workingCopiesForResource = this.mapResourceToWorkingCopies.get(workingCopy.resource);
    if (workingCopiesForResource?.has(workingCopy.typeId)) {
      throw new Error(`Cannot register more than one working copy with the same resource ${workingCopy.resource.toString()} and type ${workingCopy.typeId}.`);
    }
    this._workingCopies.add(workingCopy);
    if (!workingCopiesForResource) {
      workingCopiesForResource = /* @__PURE__ */ new Map();
      this.mapResourceToWorkingCopies.set(workingCopy.resource, workingCopiesForResource);
    }
    workingCopiesForResource.set(workingCopy.typeId, workingCopy);
    const disposables = new DisposableStore();
    disposables.add(workingCopy.onDidChangeContent(() => this._onDidChangeContent.fire(workingCopy)));
    disposables.add(workingCopy.onDidChangeDirty(() => this._onDidChangeDirty.fire(workingCopy)));
    disposables.add(workingCopy.onDidSave((e) => this._onDidSave.fire({ workingCopy, ...e })));
    this.mapWorkingCopyToListeners.set(workingCopy, disposables);
    this._onDidRegister.fire(workingCopy);
    if (workingCopy.isDirty()) {
      this._onDidChangeDirty.fire(workingCopy);
    }
    const leakId = this.trackLeaks(workingCopy);
    return toDisposable(() => {
      if (leakId) {
        this.untrackLeaks(leakId);
      }
      this.unregisterWorkingCopy(workingCopy);
      this._onDidUnregister.fire(workingCopy);
    });
  }
  unregisterWorkingCopy(workingCopy) {
    this._workingCopies.delete(workingCopy);
    const workingCopiesForResource = this.mapResourceToWorkingCopies.get(workingCopy.resource);
    if (workingCopiesForResource?.delete(workingCopy.typeId) && workingCopiesForResource.size === 0) {
      this.mapResourceToWorkingCopies.delete(workingCopy.resource);
    }
    if (workingCopy.isDirty()) {
      this._onDidChangeDirty.fire(workingCopy);
    }
    this.mapWorkingCopyToListeners.deleteAndDispose(workingCopy);
  }
  has(resourceOrIdentifier) {
    if (URI.isUri(resourceOrIdentifier)) {
      return this.mapResourceToWorkingCopies.has(resourceOrIdentifier);
    }
    return this.mapResourceToWorkingCopies.get(resourceOrIdentifier.resource)?.has(resourceOrIdentifier.typeId) ?? false;
  }
  get(identifier) {
    return this.mapResourceToWorkingCopies.get(identifier.resource)?.get(identifier.typeId);
  }
  getAll(resource) {
    const workingCopies = this.mapResourceToWorkingCopies.get(resource);
    if (!workingCopies) {
      return void 0;
    }
    return Array.from(workingCopies.values());
  }
  static {
    //#endregion
    //#region Leak Monitoring
    this.LEAK_TRACKING_THRESHOLD = 256;
  }
  static {
    this.LEAK_REPORTING_THRESHOLD = 2 * WorkingCopyService.LEAK_TRACKING_THRESHOLD;
  }
  static {
    this.LEAK_REPORTED = false;
  }
  trackLeaks(workingCopy) {
    if (WorkingCopyService.LEAK_REPORTED || this._workingCopies.size < WorkingCopyService.LEAK_TRACKING_THRESHOLD) {
      return void 0;
    }
    const leakId = `${workingCopy.resource.scheme}#${workingCopy.typeId || "<no typeId>"}
${new Error().stack?.split("\n").slice(2).join("\n") ?? ""}`;
    const leakCounter = (this.mapLeakToCounter.get(leakId) ?? 0) + 1;
    this.mapLeakToCounter.set(leakId, leakCounter);
    if (this._workingCopies.size > WorkingCopyService.LEAK_REPORTING_THRESHOLD) {
      WorkingCopyService.LEAK_REPORTED = true;
      const [topLeak, topCount] = Array.from(this.mapLeakToCounter.entries()).reduce(
        ([topLeak2, topCount2], [key, val]) => val > topCount2 ? [key, val] : [topLeak2, topCount2]
      );
      const message = `Potential working copy LEAK detected, having ${this._workingCopies.size} working copies already. Most frequent owner (${topCount})`;
      onUnexpectedError(new WorkingCopyLeakError(message, topLeak));
    }
    return leakId;
  }
  untrackLeaks(leakId) {
    const stackCounter = (this.mapLeakToCounter.get(leakId) ?? 1) - 1;
    this.mapLeakToCounter.set(leakId, stackCounter);
    if (stackCounter === 0) {
      this.mapLeakToCounter.delete(leakId);
    }
  }
  //#endregion
  //#region Dirty Tracking
  get hasDirty() {
    for (const workingCopy of this._workingCopies) {
      if (workingCopy.isDirty()) {
        return true;
      }
    }
    return false;
  }
  get dirtyCount() {
    let totalDirtyCount = 0;
    for (const workingCopy of this._workingCopies) {
      if (workingCopy.isDirty()) {
        totalDirtyCount++;
      }
    }
    return totalDirtyCount;
  }
  get dirtyWorkingCopies() {
    return this.workingCopies.filter((workingCopy) => workingCopy.isDirty());
  }
  get modifiedCount() {
    let totalModifiedCount = 0;
    for (const workingCopy of this._workingCopies) {
      if (workingCopy.isModified()) {
        totalModifiedCount++;
      }
    }
    return totalModifiedCount;
  }
  get modifiedWorkingCopies() {
    return this.workingCopies.filter((workingCopy) => workingCopy.isModified());
  }
  isDirty(resource, typeId) {
    const workingCopies = this.mapResourceToWorkingCopies.get(resource);
    if (workingCopies) {
      if (typeof typeId === "string") {
        return workingCopies.get(typeId)?.isDirty() ?? false;
      } else {
        for (const [, workingCopy] of workingCopies) {
          if (workingCopy.isDirty()) {
            return true;
          }
        }
      }
    }
    return false;
  }
  //#endregion
}
registerSingleton(IWorkingCopyService, WorkingCopyService, InstantiationType.Delayed);
export {
  IWorkingCopyService,
  WorkingCopyService
};
