import { Disposable } from "../../base/common/lifecycle.js";
import { Emitter, Event } from "../../base/common/event.js";
import { mainWindow } from "../../base/browser/window.js";
class MobileNavigationStack extends Disposable {
  constructor() {
    super();
    this._stack = [];
    this._nextId = 0;
    this._onDidPop = this._register(new Emitter());
    this.onDidPop = this._onDidPop.event;
    this._pendingSilentPops = 0;
    this._register(Event.fromDOMEventEmitter(mainWindow, "popstate")((e) => {
      this._onPopState(e);
    }));
  }
  push(layer) {
    const id = this._nextId++;
    this._stack.push({ layer, id });
    mainWindow.history.pushState({ layer, id }, "");
  }
  pop() {
    const entry = this._stack.pop();
    if (entry) {
      this._onDidPop.fire(entry.layer);
    }
    return entry?.layer;
  }
  peek() {
    return this._stack.length > 0 ? this._stack[this._stack.length - 1].layer : void 0;
  }
  has(layer) {
    return this._stack.some((e) => e.layer === layer);
  }
  clear() {
    this._stack.length = 0;
  }
  /**
   * Removes the topmost entry matching `layer` from the stack (without
   * firing {@link onDidPop}) and rewinds the browser history by one entry.
   * Use this when a layer is closed by UI interaction (e.g., backdrop click)
   * so the history and stack stay in sync without recursing back into
   * close handlers.
   *
   * Concurrent silent pops are handled via a counter: each call increments
   * {@link _pendingSilentPops} and the matching {@link _onPopState} decrements
   * it, so rapid back-button taps or multiple overlay closes cannot leak
   * suppression state across unrelated pops.
   */
  popSilently(layer) {
    for (let i = this._stack.length - 1; i >= 0; i--) {
      if (this._stack[i].layer === layer) {
        this._stack.splice(i, 1);
        this._pendingSilentPops++;
        mainWindow.history.back();
        return;
      }
    }
  }
  _onPopState(e) {
    if (this._pendingSilentPops > 0) {
      this._pendingSilentPops--;
      return;
    }
    if (this._stack.length === 0) {
      return;
    }
    const top = this._stack[this._stack.length - 1];
    const state = e.state;
    if (state && typeof state.id === "number" && state.id >= top.id) {
      return;
    }
    this.pop();
  }
}
export {
  MobileNavigationStack
};
