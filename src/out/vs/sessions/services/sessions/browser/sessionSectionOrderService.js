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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
const ISessionSectionOrderService = createDecorator("sessionSectionOrderService");
let SessionSectionOrderService = class extends Disposable {
  constructor(storageService) {
    super();
    this.storageService = storageService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._order = [];
    this._promoted = /* @__PURE__ */ new Set();
    this.load();
  }
  static {
    this.STORAGE_KEY = "sessionsListControl.sectionOrder";
  }
  resolveOrder(defaultOrderedIds) {
    return resolveSectionOrder(this._order, defaultOrderedIds);
  }
  reorder(visibleOrder, draggedId, targetId, position, promoteId) {
    const visibleAfter = spliceSectionOrder(visibleOrder, draggedId, targetId, position);
    if (!visibleAfter) {
      return;
    }
    const next = mergeSectionOrder(this._order, visibleAfter);
    const orderChanged = !arraysEqual(next, this._order);
    const promoteChanged = promoteId !== void 0 && !this._promoted.has(promoteId);
    if (!orderChanged && !promoteChanged) {
      return;
    }
    this._order = next;
    if (promoteId !== void 0) {
      this._promoted.add(promoteId);
    }
    this.save();
    this._onDidChange.fire();
  }
  isPromoted(id) {
    return this._promoted.has(id);
  }
  retain(liveIds) {
    const live = liveIds instanceof Set ? liveIds : new Set(liveIds);
    const order = this._order.filter((id) => live.has(id));
    const promoted = [...this._promoted].filter((id) => live.has(id));
    if (order.length === this._order.length && promoted.length === this._promoted.size) {
      return;
    }
    this._order = order;
    this._promoted = new Set(promoted);
    this.save();
  }
  // -- Storage --
  load() {
    const raw = this.storageService.get(SessionSectionOrderService.STORAGE_KEY, StorageScope.PROFILE);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.order)) {
        this._order = parsed.order.filter((id) => typeof id === "string");
      }
      if (Array.isArray(parsed.promoted)) {
        this._promoted = new Set(parsed.promoted.filter((id) => typeof id === "string"));
      }
    } catch {
    }
  }
  save() {
    if (this._order.length === 0 && this._promoted.size === 0) {
      this.storageService.remove(SessionSectionOrderService.STORAGE_KEY, StorageScope.PROFILE);
      return;
    }
    const state = { order: this._order, promoted: [...this._promoted] };
    this.storageService.store(SessionSectionOrderService.STORAGE_KEY, JSON.stringify(state), StorageScope.PROFILE, StorageTarget.USER);
  }
};
SessionSectionOrderService = __decorateClass([
  __decorateParam(0, IStorageService)
], SessionSectionOrderService);
function resolveSectionOrder(persisted, defaultOrderedIds) {
  const live = new Set(defaultOrderedIds);
  const result = persisted.filter((id) => live.has(id));
  const placed = new Set(result);
  for (let i = 0; i < defaultOrderedIds.length; i++) {
    const id = defaultOrderedIds[i];
    if (placed.has(id)) {
      continue;
    }
    let insertAt = 0;
    for (let j = i - 1; j >= 0; j--) {
      const idx = result.indexOf(defaultOrderedIds[j]);
      if (idx !== -1) {
        insertAt = idx + 1;
        break;
      }
    }
    result.splice(insertAt, 0, id);
    placed.add(id);
  }
  return result;
}
function spliceSectionOrder(order, draggedId, targetId, position) {
  const without = order.filter((id) => id !== draggedId);
  const targetIndex = without.indexOf(targetId);
  if (targetIndex === -1) {
    return void 0;
  }
  const insertIndex = position === "before" ? targetIndex : targetIndex + 1;
  without.splice(insertIndex, 0, draggedId);
  return without;
}
function mergeSectionOrder(persisted, visibleAfter) {
  const scope = new Set(visibleAfter);
  const head = [];
  const trailing = /* @__PURE__ */ new Map();
  let lastInScope;
  for (const id of persisted) {
    if (scope.has(id)) {
      lastInScope = id;
      continue;
    }
    if (lastInScope === void 0) {
      head.push(id);
    } else {
      let arr = trailing.get(lastInScope);
      if (!arr) {
        arr = [];
        trailing.set(lastInScope, arr);
      }
      arr.push(id);
    }
  }
  const result = [...head];
  for (const id of visibleAfter) {
    result.push(id);
    const t = trailing.get(id);
    if (t) {
      result.push(...t);
    }
  }
  return result;
}
function arraysEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}
registerSingleton(ISessionSectionOrderService, SessionSectionOrderService, InstantiationType.Delayed);
export {
  ISessionSectionOrderService,
  SessionSectionOrderService,
  mergeSectionOrder,
  resolveSectionOrder,
  spliceSectionOrder
};
