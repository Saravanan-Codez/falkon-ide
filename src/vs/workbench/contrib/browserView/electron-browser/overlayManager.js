import { Disposable } from "../../../../base/common/lifecycle.js";
import { MicrotaskEmitter } from "../../../../base/common/event.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { getDomNodePagePosition } from "../../../../base/browser/dom.js";
var BrowserOverlayType = /* @__PURE__ */ ((BrowserOverlayType2) => {
  BrowserOverlayType2["Menu"] = "menu";
  BrowserOverlayType2["QuickInput"] = "quickInput";
  BrowserOverlayType2["Hover"] = "hover";
  BrowserOverlayType2["Dialog"] = "dialog";
  BrowserOverlayType2["Notification"] = "notification";
  BrowserOverlayType2["Unknown"] = "unknown";
  return BrowserOverlayType2;
})(BrowserOverlayType || {});
const OVERLAY_DEFINITIONS = [
  { className: "monaco-menu-container", type: "menu" /* Menu */ },
  { className: "action-list-submenu-panel", type: "menu" /* Menu */ },
  { className: "quick-input-widget", type: "quickInput" /* QuickInput */ },
  { className: "monaco-hover", type: "hover" /* Hover */ },
  { className: "editor-widget", type: "hover" /* Hover */ },
  { className: "suggest-details-container", type: "hover" /* Hover */ },
  { className: "monaco-dialog-modal-block", type: "dialog" /* Dialog */ },
  { className: "monaco-modal-editor-block", type: "dialog" /* Dialog */ },
  { className: "notifications-center", type: "notification" /* Notification */ },
  { className: "notification-toast-container", type: "notification" /* Notification */ },
  // Context view is very generic, so treat the content as unknown
  { className: "context-view", type: "unknown" /* Unknown */ }
];
const HIT_TEST_EXCLUDED_CLASSES = [
  // Transparent full-screen layers that context menus and action widgets render to capture clicks.
  // They sit in higher z-index stacking contexts above other UI, but are not tracked overlays,
  // so hit-testing must skip them to find the overlay actually painted underneath.
  "context-view-block",
  "context-view-pointerBlock",
  // Webview overlay elements exist in their own DOM structure and are positioned dynamically,
  // so they interfere with hit-testing because they are not descendants of the tracked overlay.
  // Ignore them and depend on the element the webview is anchored to for overlay detection.
  "webview",
  "webview-overlay-content"
];
function isExcludedFromOverlayHitTest(element) {
  return HIT_TEST_EXCLUDED_CLASSES.some((className) => element.classList.contains(className));
}
const IBrowserOverlayManager = createDecorator("browserOverlayManager");
class BrowserOverlayManager extends Disposable {
  constructor(targetWindow) {
    super();
    this.targetWindow = targetWindow;
    this._onDidChangeOverlayState = this._register(new MicrotaskEmitter({
      onWillAddFirstListener: () => {
        this._observerIsConnected = true;
        this._structuralObserver.observe(this.targetWindow.document.body, {
          childList: true,
          subtree: true
        });
        this.updateTrackedElements();
      },
      onDidRemoveLastListener: () => {
        this._observerIsConnected = false;
        this._structuralObserver.disconnect();
        this.stopTrackingElements();
      },
      // Must be passed to prevent duplicate emits
      merge: () => {
      }
    }));
    this.onDidChangeOverlayState = this._onDidChangeOverlayState.event;
    this._overlayCollections = /* @__PURE__ */ new Map();
    this._overlayRectangles = /* @__PURE__ */ new WeakMap();
    this._elementObservers = /* @__PURE__ */ new WeakMap();
    this._observerIsConnected = false;
    this._shadowRootObservers = /* @__PURE__ */ new WeakMap();
    this._shadowRootOverlayCache = /* @__PURE__ */ new WeakMap();
    for (const overlayDefinition of OVERLAY_DEFINITIONS) {
      this._overlayCollections.set(overlayDefinition.className, {
        type: overlayDefinition.type,
        // We need dynamic collections for overlay detection, using getElementsByClassName is intentional here
        // eslint-disable-next-line no-restricted-syntax
        collection: this.targetWindow.document.getElementsByClassName(overlayDefinition.className)
      });
    }
    this._shadowRootHostCollection = this.targetWindow.document.getElementsByClassName("shadow-root-host");
    this._structuralObserver = new targetWindow.MutationObserver((mutations) => {
      let didRemove = false;
      for (const mutation of mutations) {
        for (const node of mutation.removedNodes) {
          if (this._elementObservers.has(node)) {
            const observer = this._elementObservers.get(node);
            observer?.disconnect();
            this._elementObservers.delete(node);
            didRemove = true;
          }
          if (this._overlayRectangles.delete(node)) {
            didRemove = true;
          }
          const hostElement = node;
          if (hostElement.shadowRoot) {
            const shadowRoot = hostElement.shadowRoot;
            const observer = this._shadowRootObservers.get(shadowRoot);
            if (observer) {
              observer.disconnect();
              this._shadowRootObservers.delete(shadowRoot);
              this._shadowRootOverlayCache.delete(shadowRoot);
              didRemove = true;
            }
          }
        }
      }
      this.updateTrackedElements(didRemove);
    });
  }
  *overlays() {
    for (const entry of this._overlayCollections.values()) {
      for (const element of entry.collection) {
        yield { element, type: entry.type };
      }
    }
    for (const hostElement of this._shadowRootHostCollection) {
      const shadowRoot = hostElement.shadowRoot;
      if (shadowRoot) {
        let cache = this._shadowRootOverlayCache.get(shadowRoot);
        if (!cache) {
          cache = [];
          for (const overlayDefinition of OVERLAY_DEFINITIONS) {
            const elements = shadowRoot.querySelectorAll(`.${overlayDefinition.className}`);
            for (const element of elements) {
              cache.push({ element, type: overlayDefinition.type });
            }
          }
          this._shadowRootOverlayCache.set(shadowRoot, cache);
        }
        yield* cache;
      }
    }
  }
  updateTrackedElements(shouldEmit = false) {
    for (const host of this._shadowRootHostCollection) {
      const hostElement = host;
      const shadowRoot = hostElement.shadowRoot;
      if (shadowRoot && !this._shadowRootObservers.has(shadowRoot)) {
        const observer = new this.targetWindow.MutationObserver(() => {
          this._shadowRootOverlayCache.delete(shadowRoot);
          this._onDidChangeOverlayState.fire();
        });
        observer.observe(shadowRoot, {
          childList: true,
          subtree: true
        });
        this._shadowRootObservers.set(shadowRoot, observer);
        shouldEmit = true;
      }
    }
    for (const overlay of this.overlays()) {
      if (!this._elementObservers.has(overlay.element)) {
        const observer = new this.targetWindow.MutationObserver((records) => {
          if (records.every((record) => record.target.parentElement?.closest(".browser-container"))) {
            return;
          }
          this._overlayRectangles.delete(overlay.element);
          this._onDidChangeOverlayState.fire();
        });
        this._elementObservers.set(overlay.element, observer);
        observer.observe(overlay.element, {
          attributes: true,
          attributeFilter: ["style", "class"],
          childList: true,
          subtree: true
        });
        shouldEmit = true;
      }
    }
    if (shouldEmit) {
      this._onDidChangeOverlayState.fire();
    }
  }
  getRect(element) {
    if (!this._overlayRectangles.has(element)) {
      const rect = getDomNodePagePosition(element);
      if (!this._observerIsConnected) {
        return rect;
      }
      this._overlayRectangles.set(element, rect);
    }
    return this._overlayRectangles.get(element);
  }
  getOverlappingOverlays(element) {
    const elementRect = getDomNodePagePosition(element);
    const overlappingOverlays = [];
    const overlays = Array.from(this.overlays());
    for (const overlay of overlays) {
      if (overlay.element.contains(element)) {
        continue;
      }
      const overlayRect = this.getRect(overlay.element);
      const overlapCenter = getOverlappingRectangleCenterPoint(elementRect, overlayRect);
      if (overlapCenter) {
        const clientX = overlapCenter.x - this.targetWindow.scrollX;
        const clientY = overlapCenter.y - this.targetWindow.scrollY;
        const elementAtPoint = this.getTopmostElementAt(clientX, clientY);
        if (elementAtPoint && overlay.element.contains(elementAtPoint)) {
          overlappingOverlays.push({
            type: overlay.type,
            rect: overlayRect
          });
        }
      }
    }
    return overlappingOverlays;
  }
  getTopmostElementAt(clientX, clientY) {
    const topmostAt = (root) => {
      const elementAtPoint2 = root.elementFromPoint(clientX, clientY);
      if (elementAtPoint2 && !isExcludedFromOverlayHitTest(elementAtPoint2)) {
        return elementAtPoint2;
      }
      return root.elementsFromPoint(clientX, clientY).find((el) => !isExcludedFromOverlayHitTest(el)) ?? null;
    };
    const elementAtPoint = topmostAt(this.targetWindow.document);
    if (elementAtPoint?.shadowRoot) {
      return topmostAt(elementAtPoint.shadowRoot);
    }
    return elementAtPoint;
  }
  stopTrackingElements() {
    for (const overlay of this.overlays()) {
      const observer = this._elementObservers.get(overlay.element);
      observer?.disconnect();
    }
    for (const hostElement of this._shadowRootHostCollection) {
      const shadowRoot = hostElement.shadowRoot;
      const shadowObserver = this._shadowRootObservers.get(shadowRoot);
      shadowObserver?.disconnect();
    }
    this._shadowRootObservers = /* @__PURE__ */ new WeakMap();
    this._shadowRootOverlayCache = /* @__PURE__ */ new WeakMap();
    this._overlayRectangles = /* @__PURE__ */ new WeakMap();
    this._elementObservers = /* @__PURE__ */ new WeakMap();
  }
  dispose() {
    this._observerIsConnected = false;
    this._structuralObserver.disconnect();
    this.stopTrackingElements();
    super.dispose();
  }
}
function getOverlappingRectangleCenterPoint(rect1, rect2) {
  const overlapLeft = Math.max(rect1.left, rect2.left);
  const overlapRight = Math.min(rect1.left + rect1.width, rect2.left + rect2.width);
  const overlapTop = Math.max(rect1.top, rect2.top);
  const overlapBottom = Math.min(rect1.top + rect1.height, rect2.top + rect2.height);
  if (overlapRight > overlapLeft && overlapBottom > overlapTop) {
    return {
      x: (overlapLeft + overlapRight) / 2,
      y: (overlapTop + overlapBottom) / 2
    };
  }
  return null;
}
export {
  BrowserOverlayManager,
  BrowserOverlayType,
  IBrowserOverlayManager
};
