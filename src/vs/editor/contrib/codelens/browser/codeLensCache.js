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
import { Event } from "../../../../base/common/event.js";
import { LRUCache } from "../../../../base/common/map.js";
import { Range } from "../../../common/core/range.js";
import { CodeLensModel } from "./codelens.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget, WillSaveStateReason } from "../../../../platform/storage/common/storage.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { runWhenWindowIdle } from "../../../../base/browser/dom.js";
const ICodeLensCache = createDecorator("ICodeLensCache");
class CacheItem {
  constructor(lineCount, data) {
    this.lineCount = lineCount;
    this.data = data;
  }
}
let CodeLensCache = class {
  constructor(storageService) {
    this._fakeProvider = new class {
      provideCodeLenses() {
        throw new Error("not supported");
      }
    }();
    this._cache = new LRUCache(20, 0.75);
    const oldkey = "codelens/cache";
    runWhenWindowIdle(mainWindow, () => storageService.remove(oldkey, StorageScope.WORKSPACE));
    const key = "codelens/cache2";
    const raw = storageService.get(key, StorageScope.WORKSPACE, "{}");
    this._deserialize(raw);
    const onWillSaveStateBecauseOfShutdown = Event.filter(storageService.onWillSaveState, (e) => e.reason === WillSaveStateReason.SHUTDOWN);
    Event.once(onWillSaveStateBecauseOfShutdown)((e) => {
      storageService.store(key, this._serialize(), StorageScope.WORKSPACE, StorageTarget.MACHINE);
    });
  }
  put(model, data) {
    const copyItems = data.lenses.map((item2) => {
      return {
        range: item2.symbol.range,
        command: item2.symbol.command && { id: "", title: item2.symbol.command?.title }
      };
    });
    const copyModel = new CodeLensModel();
    copyModel.add({ lenses: copyItems }, this._fakeProvider);
    const item = new CacheItem(model.getLineCount(), copyModel);
    this._cache.set(model.uri.toString(), item);
  }
  get(model) {
    const item = this._cache.get(model.uri.toString());
    return item && item.lineCount === model.getLineCount() ? item.data : void 0;
  }
  delete(model) {
    this._cache.delete(model.uri.toString());
  }
  // --- persistence
  _serialize() {
    const data = /* @__PURE__ */ Object.create(null);
    for (const [key, value] of this._cache) {
      const lines = /* @__PURE__ */ new Set();
      for (const d of value.data.lenses) {
        lines.add(d.symbol.range.startLineNumber);
      }
      data[key] = {
        lineCount: value.lineCount,
        lines: [...lines.values()]
      };
    }
    return JSON.stringify(data);
  }
  _deserialize(raw) {
    try {
      const data = JSON.parse(raw);
      for (const key in data) {
        const element = data[key];
        const lenses = [];
        for (const line of element.lines) {
          lenses.push({ range: new Range(line, 1, line, 11) });
        }
        const model = new CodeLensModel();
        model.add({ lenses }, this._fakeProvider);
        this._cache.set(key, new CacheItem(element.lineCount, model));
      }
    } catch {
    }
  }
};
CodeLensCache = __decorateClass([
  __decorateParam(0, IStorageService)
], CodeLensCache);
registerSingleton(ICodeLensCache, CodeLensCache, InstantiationType.Delayed);
export {
  CodeLensCache,
  ICodeLensCache
};
