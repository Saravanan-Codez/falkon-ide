import * as dom from "../../../../base/browser/dom.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { isPhoneLayout } from "./mobileLayout.js";
const DEFAULT_HOLD_TIME_MS = 500;
const DEFAULT_MOVE_THRESHOLD_PX = 6;
const CLICK_SUPPRESSOR_TIMEOUT_MS = 1e3;
function installLongPress(element, handler, options) {
  const store = new DisposableStore();
  const holdTimeMs = options?.holdTimeMs ?? DEFAULT_HOLD_TIME_MS;
  const moveThresholdPx = options?.moveThresholdPx ?? DEFAULT_MOVE_THRESHOLD_PX;
  const suppressSyntheticClick = options?.suppressSyntheticClick ?? true;
  const layoutService = options?.layoutService;
  let pointerId;
  let startX = 0;
  let startY = 0;
  let timerId;
  let clickSuppressor;
  const targetWindow = dom.getWindow(element);
  const cancelTimer = () => {
    if (timerId !== void 0) {
      targetWindow.clearTimeout(timerId);
      timerId = void 0;
    }
  };
  const reset = () => {
    cancelTimer();
    pointerId = void 0;
  };
  const clearClickSuppressor = () => {
    clickSuppressor?.dispose();
    clickSuppressor = void 0;
  };
  store.add(dom.addDisposableListener(element, dom.EventType.POINTER_DOWN, (e) => {
    if (layoutService && !isPhoneLayout(layoutService)) {
      return;
    }
    if (!e.isPrimary || e.pointerType !== "touch" && e.pointerType !== "mouse") {
      return;
    }
    cancelTimer();
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    try {
      element.setPointerCapture(e.pointerId);
    } catch {
    }
    timerId = targetWindow.setTimeout(() => {
      timerId = void 0;
      pointerId = void 0;
      handler(e);
      if (suppressSyntheticClick) {
        clearClickSuppressor();
        const suppressorStore = new DisposableStore();
        clickSuppressor = suppressorStore;
        const swallow = (clickEvent) => {
          clickEvent.preventDefault();
          clickEvent.stopPropagation();
          clearClickSuppressor();
        };
        element.addEventListener("click", swallow, true);
        suppressorStore.add({ dispose: () => element.removeEventListener("click", swallow, true) });
        suppressorStore.add(dom.addDisposableListener(element, dom.EventType.POINTER_UP, (pointerEvent) => {
          if (pointerEvent.pointerId !== e.pointerId) {
            return;
          }
          targetWindow.setTimeout(() => clearClickSuppressor(), 0);
        }, true));
        suppressorStore.add(dom.addDisposableListener(element, "pointercancel", () => clearClickSuppressor(), true));
        const suppressorTimeout = targetWindow.setTimeout(() => clearClickSuppressor(), CLICK_SUPPRESSOR_TIMEOUT_MS);
        suppressorStore.add({ dispose: () => targetWindow.clearTimeout(suppressorTimeout) });
      }
    }, holdTimeMs);
  }));
  store.add(dom.addDisposableListener(element, dom.EventType.POINTER_MOVE, (e) => {
    if (pointerId !== e.pointerId) {
      return;
    }
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > moveThresholdPx || Math.abs(dy) > moveThresholdPx) {
      reset();
    }
  }));
  const end = (e) => {
    if (pointerId !== e.pointerId) {
      return;
    }
    reset();
  };
  store.add(dom.addDisposableListener(element, dom.EventType.POINTER_UP, end));
  store.add(dom.addDisposableListener(element, "pointercancel", end));
  store.add({ dispose: cancelTimer });
  store.add({ dispose: clearClickSuppressor });
  return store;
}
export {
  installLongPress
};
