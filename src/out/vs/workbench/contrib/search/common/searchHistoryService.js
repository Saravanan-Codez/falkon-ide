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
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { isEmptyObject } from "../../../../base/common/types.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
const ISearchHistoryService = createDecorator("searchHistoryService");
let SearchHistoryService = class {
  constructor(storageService) {
    this.storageService = storageService;
    this._onDidClearHistory = new Emitter();
    this.onDidClearHistory = this._onDidClearHistory.event;
  }
  static {
    this.SEARCH_HISTORY_KEY = "workbench.search.history";
  }
  clearHistory() {
    this.storageService.remove(SearchHistoryService.SEARCH_HISTORY_KEY, StorageScope.WORKSPACE);
    this._onDidClearHistory.fire();
  }
  load() {
    let result;
    const raw = this.storageService.get(SearchHistoryService.SEARCH_HISTORY_KEY, StorageScope.WORKSPACE);
    if (raw) {
      try {
        result = JSON.parse(raw);
      } catch (e) {
      }
    }
    return result || {};
  }
  save(history) {
    if (isEmptyObject(history)) {
      this.storageService.remove(SearchHistoryService.SEARCH_HISTORY_KEY, StorageScope.WORKSPACE);
    } else {
      this.storageService.store(SearchHistoryService.SEARCH_HISTORY_KEY, JSON.stringify(history), StorageScope.WORKSPACE, StorageTarget.USER);
    }
  }
};
SearchHistoryService = __decorateClass([
  __decorateParam(0, IStorageService)
], SearchHistoryService);
export {
  ISearchHistoryService,
  SearchHistoryService
};
