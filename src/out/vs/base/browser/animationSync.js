import { addDisposableListener, getWindow, onDidUnregisterWindow } from "./dom.js";
import { Disposable, toDisposable } from "../common/lifecycle.js";
function synchronizeCSSAnimations(element, options) {
  if (typeof element.getAnimations !== "function") {
    return;
  }
  for (const animation of element.getAnimations({ subtree: options?.subtree })) {
    const animationName = animation.animationName;
    if (animationName === void 0) {
      continue;
    }
    if (options?.animationNames && !options.animationNames.has(animationName)) {
      continue;
    }
    try {
      animation.startTime = 0;
    } catch {
    }
  }
}
const animationVisibilityObservers = /* @__PURE__ */ new Map();
let unregisterWindowListener;
function pauseCSSAnimationsWhenHidden(element, options) {
  const targetWindow = getWindow(element);
  if (typeof targetWindow.IntersectionObserver !== "function") {
    return Disposable.None;
  }
  let state = animationVisibilityObservers.get(targetWindow);
  if (!state) {
    const trackedAnimations = /* @__PURE__ */ new Map();
    const intersectingElements = /* @__PURE__ */ new Set();
    const observer = new targetWindow.IntersectionObserver((entries) => {
      const toResync = [];
      for (const entry of entries) {
        const target = entry.target;
        const trackedAnimation = trackedAnimations.get(target);
        if (!trackedAnimation) {
          continue;
        }
        if (entry.isIntersecting) {
          intersectingElements.add(target);
        } else {
          intersectingElements.delete(target);
        }
        const paused = targetWindow.document.hidden || !entry.isIntersecting;
        target.classList.toggle(trackedAnimation.options.pausedClass, paused);
        if (!paused) {
          toResync.push([target, trackedAnimation.options]);
        }
      }
      for (const [target, trackedOptions] of toResync) {
        synchronizeCSSAnimations(target, trackedOptions);
      }
      disposeVisibilityObserverIfEmpty(targetWindow, animationVisibilityObservers.get(targetWindow));
    });
    const visibilityListener = addDisposableListener(targetWindow.document, "visibilitychange", () => {
      const documentHidden = targetWindow.document.hidden;
      const toResync = [];
      for (const [target, trackedAnimation] of trackedAnimations) {
        const paused = documentHidden || !intersectingElements.has(target);
        target.classList.toggle(trackedAnimation.options.pausedClass, paused);
        if (!paused) {
          toResync.push([target, trackedAnimation.options]);
        }
      }
      for (const [target, trackedOptions] of toResync) {
        synchronizeCSSAnimations(target, trackedOptions);
      }
      disposeVisibilityObserverIfEmpty(targetWindow, animationVisibilityObservers.get(targetWindow));
    });
    state = { observer, trackedAnimations, intersectingElements, visibilityListener };
    animationVisibilityObservers.set(targetWindow, state);
    if (!unregisterWindowListener) {
      unregisterWindowListener = onDidUnregisterWindow((window) => {
        const state2 = animationVisibilityObservers.get(window);
        if (state2) {
          state2.observer.disconnect();
          state2.visibilityListener.dispose();
          animationVisibilityObservers.delete(window);
          disposeUnregisterWindowListenerIfUnused();
        }
      });
    }
  }
  element.classList.add(options.pausedClass);
  state.trackedAnimations.set(element, { options });
  state.observer.observe(element);
  return toDisposable(() => {
    state.observer.unobserve(element);
    state.trackedAnimations.delete(element);
    state.intersectingElements.delete(element);
    element.classList.remove(options.pausedClass);
    disposeVisibilityObserverIfEmpty(targetWindow, state);
  });
}
function disposeVisibilityObserverIfEmpty(targetWindow, state) {
  if (!state || state.trackedAnimations.size !== 0 || animationVisibilityObservers.get(targetWindow) !== state) {
    return;
  }
  state.observer.disconnect();
  state.visibilityListener.dispose();
  animationVisibilityObservers.delete(targetWindow);
  disposeUnregisterWindowListenerIfUnused();
}
function disposeUnregisterWindowListenerIfUnused() {
  if (animationVisibilityObservers.size === 0) {
    unregisterWindowListener?.dispose();
    unregisterWindowListener = void 0;
  }
}
export {
  pauseCSSAnimationsWhenHidden,
  synchronizeCSSAnimations
};
