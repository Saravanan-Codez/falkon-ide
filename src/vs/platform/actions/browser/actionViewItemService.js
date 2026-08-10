import { Emitter, Event } from "../../../base/common/event.js";
import { Disposable, toDisposable } from "../../../base/common/lifecycle.js";
import { InstantiationType, registerSingleton } from "../../instantiation/common/extensions.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { MenuId } from "../common/actions.js";
const IActionViewItemService = createDecorator("IActionViewItemService");
class NullActionViewItemService {
  constructor() {
    this.onDidChange = Event.None;
  }
  register(menu, commandId, provider, event) {
    return Disposable.None;
  }
  lookUp(menu, commandId) {
    return void 0;
  }
}
class ActionViewItemService {
  constructor() {
    this._providers = /* @__PURE__ */ new Map();
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
  }
  dispose() {
    this._onDidChange.dispose();
  }
  register(menu, commandOrSubmenuId, provider, event) {
    const id = this._makeKey(menu, commandOrSubmenuId);
    if (this._providers.has(id)) {
      throw new Error(`A provider for the command ${commandOrSubmenuId} and menu ${menu} is already registered.`);
    }
    this._providers.set(id, provider);
    const listener = event?.(() => {
      this._onDidChange.fire(menu);
    });
    return toDisposable(() => {
      listener?.dispose();
      this._providers.delete(id);
    });
  }
  lookUp(menu, commandOrMenuId) {
    return this._providers.get(this._makeKey(menu, commandOrMenuId));
  }
  _makeKey(menu, commandOrMenuId) {
    return `${menu.id}/${commandOrMenuId instanceof MenuId ? commandOrMenuId.id : commandOrMenuId}`;
  }
}
registerSingleton(IActionViewItemService, ActionViewItemService, InstantiationType.Delayed);
export {
  IActionViewItemService,
  NullActionViewItemService
};
