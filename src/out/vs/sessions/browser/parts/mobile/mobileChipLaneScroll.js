import * as dom from "../../../../base/browser/dom.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { isPhoneLayout } from "./mobileLayout.js";
const TAP_THRESHOLD_PX = 6;
function installMobileChipLaneScroll(lane, layoutService) {
  const store = new DisposableStore();
  let pointerId;
  let startX = 0;
  let startScrollLeft = 0;
  let didDrag = false;
  store.add(dom.addDisposableListener(lane, dom.EventType.POINTER_DOWN, (e) => {
    if (!isPhoneLayout(layoutService)) {
      return;
    }
    if (!e.isPrimary || e.pointerType !== "touch" && e.pointerType !== "mouse") {
      return;
    }
    pointerId = e.pointerId;
    startX = e.clientX;
    startScrollLeft = lane.scrollLeft;
    didDrag = false;
  }));
  store.add(dom.addDisposableListener(lane, dom.EventType.POINTER_MOVE, (e) => {
    if (pointerId !== e.pointerId) {
      return;
    }
    const deltaX = e.clientX - startX;
    if (!didDrag && Math.abs(deltaX) < TAP_THRESHOLD_PX) {
      return;
    }
    if (!didDrag) {
      didDrag = true;
      try {
        lane.setPointerCapture(e.pointerId);
      } catch {
      }
    }
    lane.scrollLeft = startScrollLeft - deltaX;
    e.preventDefault();
  }));
  const endDrag = (e) => {
    if (pointerId !== e.pointerId) {
      return;
    }
    pointerId = void 0;
    if (!didDrag) {
      return;
    }
    try {
      lane.releasePointerCapture(e.pointerId);
    } catch {
    }
    const swallow = (clickEvent) => {
      clickEvent.preventDefault();
      clickEvent.stopPropagation();
      lane.removeEventListener("click", swallow, true);
    };
    lane.addEventListener("click", swallow, true);
    dom.getWindow(lane).setTimeout(() => lane.removeEventListener("click", swallow, true), 0);
  };
  store.add(dom.addDisposableListener(lane, dom.EventType.POINTER_UP, endDrag));
  store.add(dom.addDisposableListener(lane, "pointercancel", endDrag));
  return store;
}
export {
  installMobileChipLaneScroll
};
