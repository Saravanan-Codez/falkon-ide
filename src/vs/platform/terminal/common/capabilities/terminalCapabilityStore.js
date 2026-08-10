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
import { memoize } from "../../../../base/common/decorators.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { TerminalCapability } from "./capabilities.js";
class TerminalCapabilityStore extends Disposable {
  constructor() {
    super(...arguments);
    this._map = /* @__PURE__ */ new Map();
    this._onDidAddCapability = this._register(new Emitter());
    this._onDidRemoveCapability = this._register(new Emitter());
  }
  get onDidAddCapability() {
    return this._onDidAddCapability.event;
  }
  get onDidRemoveCapability() {
    return this._onDidRemoveCapability.event;
  }
  get onDidChangeCapabilities() {
    return Event.map(Event.any(
      this._onDidAddCapability.event,
      this._onDidRemoveCapability.event
    ), () => void 0, this._store);
  }
  get onDidAddCommandDetectionCapability() {
    return Event.map(Event.filter(this.onDidAddCapability, (e) => e.id === TerminalCapability.CommandDetection, this._store), (e) => e.capability, this._store);
  }
  get onDidRemoveCommandDetectionCapability() {
    return Event.map(Event.filter(this.onDidRemoveCapability, (e) => e.id === TerminalCapability.CommandDetection, this._store), () => void 0, this._store);
  }
  get onDidAddCwdDetectionCapability() {
    return Event.map(Event.filter(this.onDidAddCapability, (e) => e.id === TerminalCapability.CwdDetection, this._store), (e) => e.capability, this._store);
  }
  get onDidRemoveCwdDetectionCapability() {
    return Event.map(Event.filter(this.onDidRemoveCapability, (e) => e.id === TerminalCapability.CwdDetection, this._store), () => void 0, this._store);
  }
  get items() {
    return this._map.keys();
  }
  createOnDidRemoveCapabilityOfTypeEvent(type) {
    return Event.map(Event.filter(this.onDidRemoveCapability, (e) => e.id === type), (e) => e.capability);
  }
  createOnDidAddCapabilityOfTypeEvent(type) {
    return Event.map(Event.filter(this.onDidAddCapability, (e) => e.id === type), (e) => e.capability);
  }
  add(capability, impl) {
    this._map.set(capability, impl);
    this._onDidAddCapability.fire(createCapabilityEvent(capability, impl));
  }
  get(capability) {
    return this._map.get(capability);
  }
  remove(capability) {
    const impl = this._map.get(capability);
    if (!impl) {
      return;
    }
    this._map.delete(capability);
    this._onDidRemoveCapability.fire(createCapabilityEvent(capability, impl));
  }
  has(capability) {
    return this._map.has(capability);
  }
}
__decorateClass([
  memoize
], TerminalCapabilityStore.prototype, "onDidChangeCapabilities", 1);
__decorateClass([
  memoize
], TerminalCapabilityStore.prototype, "onDidAddCommandDetectionCapability", 1);
__decorateClass([
  memoize
], TerminalCapabilityStore.prototype, "onDidRemoveCommandDetectionCapability", 1);
__decorateClass([
  memoize
], TerminalCapabilityStore.prototype, "onDidAddCwdDetectionCapability", 1);
__decorateClass([
  memoize
], TerminalCapabilityStore.prototype, "onDidRemoveCwdDetectionCapability", 1);
class TerminalCapabilityStoreMultiplexer extends Disposable {
  constructor() {
    super(...arguments);
    this._stores = [];
    this._onDidAddCapability = this._register(new Emitter());
    this._onDidRemoveCapability = this._register(new Emitter());
  }
  get onDidAddCapability() {
    return this._onDidAddCapability.event;
  }
  get onDidRemoveCapability() {
    return this._onDidRemoveCapability.event;
  }
  get onDidChangeCapabilities() {
    return Event.map(Event.any(
      this._onDidAddCapability.event,
      this._onDidRemoveCapability.event
    ), () => void 0, this._store);
  }
  get onDidAddCommandDetectionCapability() {
    return Event.map(Event.filter(this.onDidAddCapability, (e) => e.id === TerminalCapability.CommandDetection, this._store), (e) => e.capability, this._store);
  }
  get onDidRemoveCommandDetectionCapability() {
    return Event.map(Event.filter(this.onDidRemoveCapability, (e) => e.id === TerminalCapability.CommandDetection, this._store), () => void 0, this._store);
  }
  get onDidAddCwdDetectionCapability() {
    return Event.map(Event.filter(this.onDidAddCapability, (e) => e.id === TerminalCapability.CwdDetection, this._store), (e) => e.capability, this._store);
  }
  get onDidRemoveCwdDetectionCapability() {
    return Event.map(Event.filter(this.onDidRemoveCapability, (e) => e.id === TerminalCapability.CwdDetection, this._store), () => void 0, this._store);
  }
  get items() {
    return this._items();
  }
  createOnDidRemoveCapabilityOfTypeEvent(type) {
    return Event.map(Event.filter(this.onDidRemoveCapability, (e) => e.id === type), (e) => e.capability);
  }
  createOnDidAddCapabilityOfTypeEvent(type) {
    return Event.map(Event.filter(this.onDidAddCapability, (e) => e.id === type), (e) => e.capability);
  }
  *_items() {
    for (const store of this._stores) {
      for (const c of store.items) {
        yield c;
      }
    }
  }
  has(capability) {
    for (const store of this._stores) {
      for (const c of store.items) {
        if (c === capability) {
          return true;
        }
      }
    }
    return false;
  }
  get(capability) {
    for (const store of this._stores) {
      const c = store.get(capability);
      if (c) {
        return c;
      }
    }
    return void 0;
  }
  add(store) {
    this._stores.push(store);
    for (const capability of store.items) {
      this._onDidAddCapability.fire(createCapabilityEvent(capability, store.get(capability)));
    }
    this._register(store.onDidAddCapability((e) => this._onDidAddCapability.fire(e)));
    this._register(store.onDidRemoveCapability((e) => this._onDidRemoveCapability.fire(e)));
  }
}
__decorateClass([
  memoize
], TerminalCapabilityStoreMultiplexer.prototype, "onDidChangeCapabilities", 1);
__decorateClass([
  memoize
], TerminalCapabilityStoreMultiplexer.prototype, "onDidAddCommandDetectionCapability", 1);
__decorateClass([
  memoize
], TerminalCapabilityStoreMultiplexer.prototype, "onDidRemoveCommandDetectionCapability", 1);
__decorateClass([
  memoize
], TerminalCapabilityStoreMultiplexer.prototype, "onDidAddCwdDetectionCapability", 1);
__decorateClass([
  memoize
], TerminalCapabilityStoreMultiplexer.prototype, "onDidRemoveCwdDetectionCapability", 1);
function createCapabilityEvent(capability, impl) {
  return { id: capability, capability: impl };
}
export {
  TerminalCapabilityStore,
  TerminalCapabilityStoreMultiplexer
};
