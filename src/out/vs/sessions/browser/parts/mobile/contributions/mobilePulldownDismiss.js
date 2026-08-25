import { DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
import { addDisposableListener, EventType } from "../../../../../base/browser/dom.js";
const COMMIT_THRESHOLD_PX = 120;
const DEAD_ZONE_PX = 8;
const COMMIT_VELOCITY = 0.6;
const DISMISS_ANIM_MS = 250;
const SNAP_BACK_ANIM_MS = 200;
function installPulldownDismiss(overlayRoot, headerHandle, onDismiss) {
  const store = new DisposableStore();
  let tracking = false;
  let dragging = false;
  let dismissed = false;
  let activePointerId;
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let lastY = 0;
  let lastT = 0;
  let velocity = 0;
  let originalTransition = "";
  const applyDragStyles = () => {
    originalTransition = overlayRoot.style.transition;
    overlayRoot.style.transition = "none";
    overlayRoot.style.willChange = "transform, opacity";
  };
  const resetStyles = () => {
    overlayRoot.style.transform = "";
    overlayRoot.style.opacity = "";
    overlayRoot.style.transition = originalTransition;
    overlayRoot.style.willChange = "";
  };
  const update = (dy) => {
    const translate = Math.max(0, dy);
    overlayRoot.style.transform = `translateY(${translate}px)`;
    const opacity = Math.max(0.5, 1 - Math.min(translate / COMMIT_THRESHOLD_PX, 0.5));
    overlayRoot.style.opacity = String(opacity);
  };
  const finish = (commit) => {
    if (!commit) {
      overlayRoot.style.transition = `transform ${SNAP_BACK_ANIM_MS}ms ease, opacity ${SNAP_BACK_ANIM_MS}ms ease`;
      overlayRoot.style.transform = "translateY(0)";
      overlayRoot.style.opacity = "1";
      const onEnd = () => {
        resetStyles();
        overlayRoot.removeEventListener("transitionend", onEnd);
      };
      overlayRoot.addEventListener("transitionend", onEnd, { once: true });
      return;
    }
    if (dismissed) {
      return;
    }
    dismissed = true;
    overlayRoot.style.transition = `transform ${DISMISS_ANIM_MS}ms ease, opacity ${DISMISS_ANIM_MS}ms ease`;
    overlayRoot.style.transform = "translateY(100%)";
    overlayRoot.style.opacity = "0";
    const timeoutId = overlayRoot.ownerDocument.defaultView?.setTimeout(() => {
      onDismiss();
    }, DISMISS_ANIM_MS) ?? 0;
    store.add(toDisposable(() => {
      overlayRoot.ownerDocument.defaultView?.clearTimeout(timeoutId);
    }));
  };
  store.add(addDisposableListener(headerHandle, EventType.POINTER_DOWN, (e) => {
    if (tracking || dismissed) {
      return;
    }
    if (e.pointerType !== "touch" && e.pointerType !== "pen") {
      return;
    }
    tracking = true;
    dragging = false;
    activePointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    startTime = Date.now();
    lastY = startY;
    lastT = startTime;
    velocity = 0;
  }));
  store.add(addDisposableListener(headerHandle, EventType.POINTER_MOVE, (e) => {
    if (!tracking || e.pointerId !== activePointerId) {
      return;
    }
    const dy = e.clientY - startY;
    const dx = e.clientX - startX;
    if (!dragging) {
      if (Math.abs(dy) < DEAD_ZONE_PX) {
        return;
      }
      if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) {
        tracking = false;
        activePointerId = void 0;
        return;
      }
      dragging = true;
      applyDragStyles();
      try {
        headerHandle.setPointerCapture(e.pointerId);
      } catch {
      }
    }
    const now = Date.now();
    const dt = now - lastT;
    if (dt > 0) {
      velocity = (e.clientY - lastY) / dt;
    }
    lastY = e.clientY;
    lastT = now;
    update(dy);
    e.preventDefault();
  }, { passive: false }));
  const release = (e) => {
    if (e.pointerId !== activePointerId) {
      return;
    }
    const wasDragging = dragging;
    const dy = e.clientY - startY;
    tracking = false;
    dragging = false;
    activePointerId = void 0;
    if (!wasDragging) {
      return;
    }
    const commit = dy > COMMIT_THRESHOLD_PX || velocity > COMMIT_VELOCITY;
    finish(commit);
  };
  store.add(addDisposableListener(headerHandle, EventType.POINTER_UP, release));
  store.add(addDisposableListener(headerHandle, "pointercancel", release));
  store.add(toDisposable(() => {
    if (!dismissed) {
      resetStyles();
    }
  }));
  return store;
}
export {
  installPulldownDismiss
};
