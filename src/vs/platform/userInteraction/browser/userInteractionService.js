import { constObservable } from "../../../base/common/observable.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { Emitter } from "../../../base/common/event.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
const IUserInteractionService = createDecorator("userInteractionService");
class MockUserInteractionService {
  constructor(_simulateFocus = true, _simulateHover = false, _modifiers = { ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }) {
    this._simulateFocus = _simulateFocus;
    this._simulateHover = _simulateHover;
    this._modifiers = _modifiers;
  }
  readModifierKeyStatus(_element, _reader) {
    return this._modifiers;
  }
  createFocusTracker(_element, _store) {
    return constObservable(this._simulateFocus);
  }
  createHoverTracker(_element, _store) {
    return constObservable(this._simulateHover);
  }
  createDomFocusTracker(_element) {
    const tracker = new class extends Disposable {
      constructor() {
        super(...arguments);
        this._onDidFocus = this._register(new Emitter());
        this.onDidFocus = this._onDidFocus.event;
        this._onDidBlur = this._register(new Emitter());
        this.onDidBlur = this._onDidBlur.event;
      }
      refreshState() {
      }
      fireFocus() {
        this._onDidFocus.fire();
      }
    }();
    if (this._simulateFocus) {
      queueMicrotask(() => tracker.fireFocus());
    }
    return tracker;
  }
}
export {
  IUserInteractionService,
  MockUserInteractionService
};
