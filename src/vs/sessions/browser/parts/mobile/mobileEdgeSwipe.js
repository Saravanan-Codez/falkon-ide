import { DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { addDisposableListener, EventType } from "../../../../base/browser/dom.js";
import { Parts } from "../../../../workbench/services/layout/browser/layoutService.js";
const EDGE_HIT_ZONE_PX = 16;
const COMMIT_TRAVEL_PX = 48;
const VERTICAL_TOLERANCE_PX = 32;
const COMMIT_WINDOW_MS = 500;
function installMobileEdgeSwipeToOpenSidebar(mainContainer, openSidebar, layoutService) {
  const store = new DisposableStore();
  let tracking = false;
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let activePointerId;
  const reset = () => {
    tracking = false;
    activePointerId = void 0;
  };
  const isPhoneLayout = () => {
    return mainContainer.classList.contains("phone-layout");
  };
  store.add(addDisposableListener(mainContainer, EventType.POINTER_DOWN, (e) => {
    if (tracking) {
      return;
    }
    if (e.pointerType !== "touch" && e.pointerType !== "pen") {
      return;
    }
    if (!isPhoneLayout()) {
      return;
    }
    const rect = mainContainer.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    if (localX >= EDGE_HIT_ZONE_PX) {
      return;
    }
    if (layoutService.isVisible(Parts.SIDEBAR_PART)) {
      return;
    }
    tracking = true;
    activePointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    startTime = Date.now();
    try {
      mainContainer.setPointerCapture(e.pointerId);
    } catch {
    }
  }, true));
  store.add(addDisposableListener(mainContainer, EventType.POINTER_MOVE, (e) => {
    if (!tracking || e.pointerId !== activePointerId) {
      return;
    }
    const dx = e.clientX - startX;
    const dy = Math.abs(e.clientY - startY);
    const elapsed = Date.now() - startTime;
    if (elapsed > COMMIT_WINDOW_MS || dy > VERTICAL_TOLERANCE_PX) {
      reset();
      return;
    }
    if (dx >= COMMIT_TRAVEL_PX) {
      reset();
      openSidebar();
    }
  }, true));
  const cancel = (e) => {
    if (e.pointerId === activePointerId) {
      reset();
    }
  };
  store.add(addDisposableListener(mainContainer, EventType.POINTER_UP, cancel, true));
  store.add(addDisposableListener(mainContainer, "pointercancel", cancel, true));
  store.add(toDisposable(reset));
  return store;
}
export {
  installMobileEdgeSwipeToOpenSidebar
};
