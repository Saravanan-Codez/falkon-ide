import { getWindow, ModifierKeyEmitter, trackFocus } from "../../../base/browser/dom.js";
import { observableFromEvent, observableValue } from "../../../base/common/observable.js";
import { InstantiationType, registerSingleton } from "../../instantiation/common/extensions.js";
import { IUserInteractionService } from "./userInteractionService.js";
class UserInteractionService {
  constructor() {
    this._modifierObservables = /* @__PURE__ */ new WeakMap();
  }
  readModifierKeyStatus(element, reader) {
    const win = element instanceof Window ? element : getWindow(element);
    let obs = this._modifierObservables.get(win);
    if (!obs) {
      const emitter = ModifierKeyEmitter.getInstance();
      obs = observableFromEvent(
        this,
        emitter.event,
        () => ({
          ctrlKey: emitter.keyStatus.ctrlKey,
          shiftKey: emitter.keyStatus.shiftKey,
          altKey: emitter.keyStatus.altKey,
          metaKey: emitter.keyStatus.metaKey
        })
      );
      this._modifierObservables.set(win, obs);
    }
    return obs.read(reader);
  }
  createFocusTracker(element, store) {
    const tracker = store.add(trackFocus(element));
    const hasFocusWithin = (el) => {
      if (el instanceof Window) {
        return el.document.hasFocus();
      }
      const shadowRoot = el.getRootNode() instanceof ShadowRoot ? el.getRootNode() : null;
      const activeElement = shadowRoot ? shadowRoot.activeElement : el.ownerDocument.activeElement;
      return el.contains(activeElement);
    };
    const value = observableValue("isFocused", hasFocusWithin(element));
    store.add(tracker.onDidFocus(() => value.set(true, void 0)));
    store.add(tracker.onDidBlur(() => value.set(false, void 0)));
    return value;
  }
  createHoverTracker(element, store) {
    const value = observableValue("isHovered", false);
    const onEnter = () => value.set(true, void 0);
    const onLeave = () => value.set(false, void 0);
    element.addEventListener("mouseenter", onEnter);
    element.addEventListener("mouseleave", onLeave);
    store.add({
      dispose: () => {
        element.removeEventListener("mouseenter", onEnter);
        element.removeEventListener("mouseleave", onLeave);
      }
    });
    return value;
  }
  createDomFocusTracker(element) {
    return trackFocus(element);
  }
}
registerSingleton(IUserInteractionService, UserInteractionService, InstantiationType.Delayed);
export {
  UserInteractionService
};
