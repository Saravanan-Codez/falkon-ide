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
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { LinkedMap, Touch } from "../../../../../base/common/map.js";
import { localize2 } from "../../../../../nls.js";
import { Categories } from "../../../../../platform/action/common/actionCommonCategories.js";
import { Action2, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { INotebookKernelHistoryService, INotebookKernelService } from "../../common/notebookKernelService.js";
import { INotebookLoggingService } from "../../common/notebookLoggingService.js";
const MAX_KERNELS_IN_HISTORY = 5;
let NotebookKernelHistoryService = class extends Disposable {
  constructor(_storageService, _notebookKernelService, _notebookLoggingService) {
    super();
    this._storageService = _storageService;
    this._notebookKernelService = _notebookKernelService;
    this._notebookLoggingService = _notebookLoggingService;
    this._mostRecentKernelsMap = {};
    this._loadState();
    this._register(this._storageService.onWillSaveState(() => this._saveState()));
    this._register(this._storageService.onDidChangeValue(StorageScope.WORKSPACE, NotebookKernelHistoryService.STORAGE_KEY, this._store)(() => {
      this._loadState();
    }));
  }
  static {
    this.STORAGE_KEY = "notebook.kernelHistory";
  }
  getKernels(notebook) {
    const allAvailableKernels = this._notebookKernelService.getMatchingKernel(notebook);
    const allKernels = allAvailableKernels.all;
    const selectedKernel = allAvailableKernels.selected;
    const suggested = allAvailableKernels.all.length === 1 ? allAvailableKernels.all[0] : void 0;
    this._notebookLoggingService.debug("History", `getMatchingKernels: ${allAvailableKernels.all.length} kernels available for ${notebook.uri.path}. Selected: ${allAvailableKernels.selected?.label}. Suggested: ${suggested?.label}`);
    const mostRecentKernelIds = this._mostRecentKernelsMap[notebook.notebookType] ? [...this._mostRecentKernelsMap[notebook.notebookType].values()] : [];
    const all = mostRecentKernelIds.map((kernelId) => allKernels.find((kernel) => kernel.id === kernelId)).filter((kernel) => !!kernel);
    this._notebookLoggingService.debug("History", `mru: ${mostRecentKernelIds.length} kernels in history, ${all.length} registered already.`);
    return {
      selected: selectedKernel ?? suggested,
      all
    };
  }
  addMostRecentKernel(kernel) {
    const key = kernel.id;
    const viewType = kernel.viewType;
    const recentKeynels = this._mostRecentKernelsMap[viewType] ?? new LinkedMap();
    recentKeynels.set(key, key, Touch.AsOld);
    if (recentKeynels.size > MAX_KERNELS_IN_HISTORY) {
      const reserved = [...recentKeynels.entries()].slice(0, MAX_KERNELS_IN_HISTORY);
      recentKeynels.fromJSON(reserved);
    }
    this._mostRecentKernelsMap[viewType] = recentKeynels;
  }
  _saveState() {
    let notEmpty = false;
    for (const [_, kernels] of Object.entries(this._mostRecentKernelsMap)) {
      notEmpty = notEmpty || kernels.size > 0;
    }
    if (notEmpty) {
      const serialized = this._serialize();
      this._storageService.store(NotebookKernelHistoryService.STORAGE_KEY, JSON.stringify(serialized), StorageScope.WORKSPACE, StorageTarget.USER);
    } else {
      this._storageService.remove(NotebookKernelHistoryService.STORAGE_KEY, StorageScope.WORKSPACE);
    }
  }
  _loadState() {
    const serialized = this._storageService.get(NotebookKernelHistoryService.STORAGE_KEY, StorageScope.WORKSPACE);
    if (serialized) {
      try {
        this._deserialize(JSON.parse(serialized));
      } catch (e) {
        this._mostRecentKernelsMap = {};
      }
    } else {
      this._mostRecentKernelsMap = {};
    }
  }
  _serialize() {
    const result = /* @__PURE__ */ Object.create(null);
    for (const [viewType, kernels] of Object.entries(this._mostRecentKernelsMap)) {
      result[viewType] = {
        entries: [...kernels.values()]
      };
    }
    return result;
  }
  _deserialize(serialized) {
    this._mostRecentKernelsMap = {};
    for (const [viewType, kernels] of Object.entries(serialized)) {
      const linkedMap = new LinkedMap();
      const mapValues = [];
      for (const entry of kernels.entries) {
        mapValues.push([entry, entry]);
      }
      linkedMap.fromJSON(mapValues);
      this._mostRecentKernelsMap[viewType] = linkedMap;
    }
  }
  _clear() {
    this._mostRecentKernelsMap = {};
    this._saveState();
  }
};
NotebookKernelHistoryService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, INotebookKernelService),
  __decorateParam(2, INotebookLoggingService)
], NotebookKernelHistoryService);
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "notebook.clearNotebookKernelsMRUCache",
      title: localize2("workbench.notebook.clearNotebookKernelsMRUCache", "Clear Notebook Kernels MRU Cache"),
      category: Categories.Developer,
      f1: true
    });
  }
  async run(accessor) {
    const historyService = accessor.get(INotebookKernelHistoryService);
    historyService._clear();
  }
});
export {
  NotebookKernelHistoryService
};
