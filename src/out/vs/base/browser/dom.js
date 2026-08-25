import * as browser from "./browser.js";
import { BrowserFeatures } from "./canIUse.js";
import { hasModifierKeys, StandardKeyboardEvent } from "./keyboardEvent.js";
import { StandardMouseEvent } from "./mouseEvent.js";
import { AbstractIdleValue, IntervalTimer, TimeoutTimer, _runWhenIdle } from "../common/async.js";
import { BugIndicatingError, onUnexpectedError } from "../common/errors.js";
import * as event from "../common/event.js";
import { KeyCode } from "../common/keyCodes.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../common/lifecycle.js";
import { RemoteAuthorities } from "../common/network.js";
import * as platform from "../common/platform.js";
import { URI } from "../common/uri.js";
import { hash } from "../common/hash.js";
import { ensureCodeWindow, mainWindow } from "./window.js";
import { isPointWithinTriangle } from "../common/numbers.js";
import { derived, derivedOpts, observableValue, isObservable } from "../common/observable.js";
const {
  registerWindow,
  getWindow,
  getDocument,
  getWindows,
  getWindowsCount,
  getWindowId,
  getWindowById,
  hasWindow,
  onDidRegisterWindow,
  onWillUnregisterWindow,
  onDidUnregisterWindow
} = (function() {
  const windows = /* @__PURE__ */ new Map();
  ensureCodeWindow(mainWindow, 1);
  const mainWindowRegistration = { window: mainWindow, disposables: new DisposableStore() };
  windows.set(mainWindow.vscodeWindowId, mainWindowRegistration);
  const onDidRegisterWindow2 = new event.Emitter();
  const onDidUnregisterWindow2 = new event.Emitter();
  const onWillUnregisterWindow2 = new event.Emitter();
  function getWindowById2(windowId, fallbackToMain) {
    const window = typeof windowId === "number" ? windows.get(windowId) : void 0;
    return window ?? (fallbackToMain ? mainWindowRegistration : void 0);
  }
  return {
    onDidRegisterWindow: onDidRegisterWindow2.event,
    onWillUnregisterWindow: onWillUnregisterWindow2.event,
    onDidUnregisterWindow: onDidUnregisterWindow2.event,
    registerWindow(window) {
      if (windows.has(window.vscodeWindowId)) {
        return Disposable.None;
      }
      const disposables = new DisposableStore();
      const registeredWindow = {
        window,
        disposables: disposables.add(new DisposableStore())
      };
      windows.set(window.vscodeWindowId, registeredWindow);
      disposables.add(toDisposable(() => {
        windows.delete(window.vscodeWindowId);
        onDidUnregisterWindow2.fire(window);
      }));
      disposables.add(addDisposableListener(window, EventType.BEFORE_UNLOAD, () => {
        onWillUnregisterWindow2.fire(window);
      }));
      onDidRegisterWindow2.fire(registeredWindow);
      return disposables;
    },
    getWindows() {
      return windows.values();
    },
    getWindowsCount() {
      return windows.size;
    },
    getWindowId(targetWindow) {
      return targetWindow.vscodeWindowId;
    },
    hasWindow(windowId) {
      return windows.has(windowId);
    },
    getWindowById: getWindowById2,
    getWindow(e) {
      const candidateNode = e;
      if (candidateNode?.ownerDocument?.defaultView) {
        return candidateNode.ownerDocument.defaultView.window;
      }
      const candidateEvent = e;
      if (candidateEvent?.view) {
        return candidateEvent.view.window;
      }
      return mainWindow;
    },
    getDocument(e) {
      const candidateNode = e;
      return getWindow(candidateNode).document;
    }
  };
})();
const externalFocusCheckers = /* @__PURE__ */ new Set();
function registerExternalFocusChecker(checker) {
  externalFocusCheckers.add(checker);
  return toDisposable(() => {
    externalFocusCheckers.delete(checker);
  });
}
function hasExternalFocus() {
  for (const checker of externalFocusCheckers) {
    if (checker().hasFocus) {
      return true;
    }
  }
  return false;
}
function getExternalFocusWindow() {
  for (const checker of externalFocusCheckers) {
    const info = checker();
    if (info.hasFocus && info.window) {
      return info.window;
    }
  }
  return void 0;
}
function hasAppFocus() {
  for (const { window } of getWindows()) {
    if (window.document.hasFocus()) {
      return true;
    }
  }
  if (hasExternalFocus()) {
    return true;
  }
  return false;
}
function clearNode(node) {
  while (node.firstChild) {
    node.firstChild.remove();
  }
}
class DomListener {
  constructor(node, type, handler, options) {
    this._node = node;
    this._type = type;
    this._handler = handler;
    this._options = options || false;
    this._node.addEventListener(this._type, this._handler, this._options);
  }
  dispose() {
    if (!this._handler) {
      return;
    }
    this._node.removeEventListener(this._type, this._handler, this._options);
    this._node = null;
    this._handler = null;
  }
}
function addDisposableListener(node, type, handler, useCaptureOrOptions) {
  return new DomListener(node, type, handler, useCaptureOrOptions);
}
function _wrapAsStandardMouseEvent(targetWindow, handler) {
  return function(e) {
    return handler(new StandardMouseEvent(targetWindow, e));
  };
}
function _wrapAsStandardKeyboardEvent(handler) {
  return function(e) {
    return handler(new StandardKeyboardEvent(e));
  };
}
const addStandardDisposableListener = function addStandardDisposableListener2(node, type, handler, useCapture) {
  let wrapHandler = handler;
  if (type === "click" || type === "mousedown" || type === "contextmenu") {
    wrapHandler = _wrapAsStandardMouseEvent(getWindow(node), handler);
  } else if (type === "keydown" || type === "keypress" || type === "keyup") {
    wrapHandler = _wrapAsStandardKeyboardEvent(handler);
  }
  return addDisposableListener(node, type, wrapHandler, useCapture);
};
const addStandardDisposableGenericMouseDownListener = function addStandardDisposableListener3(node, handler, useCapture) {
  const wrapHandler = _wrapAsStandardMouseEvent(getWindow(node), handler);
  return addDisposableGenericMouseDownListener(node, wrapHandler, useCapture);
};
const addStandardDisposableGenericMouseUpListener = function addStandardDisposableListener4(node, handler, useCapture) {
  const wrapHandler = _wrapAsStandardMouseEvent(getWindow(node), handler);
  return addDisposableGenericMouseUpListener(node, wrapHandler, useCapture);
};
function addDisposableGenericMouseDownListener(node, handler, useCapture) {
  return addDisposableListener(node, platform.isIOS && BrowserFeatures.pointerEvents ? EventType.POINTER_DOWN : EventType.MOUSE_DOWN, handler, useCapture);
}
function addDisposableGenericMouseMoveListener(node, handler, useCapture) {
  return addDisposableListener(node, platform.isIOS && BrowserFeatures.pointerEvents ? EventType.POINTER_MOVE : EventType.MOUSE_MOVE, handler, useCapture);
}
function addDisposableGenericMouseUpListener(node, handler, useCapture) {
  return addDisposableListener(node, platform.isIOS && BrowserFeatures.pointerEvents ? EventType.POINTER_UP : EventType.MOUSE_UP, handler, useCapture);
}
function runWhenWindowIdle(targetWindow, callback, timeout) {
  return _runWhenIdle(targetWindow, callback, timeout);
}
class WindowIdleValue extends AbstractIdleValue {
  constructor(targetWindow, executor) {
    super(targetWindow, executor);
  }
}
let runAtThisOrScheduleAtNextAnimationFrame;
let scheduleAtNextAnimationFrame;
function disposableWindowInterval(targetWindow, handler, interval, iterations) {
  let iteration = 0;
  const timer = targetWindow.setInterval(() => {
    iteration++;
    if (typeof iterations === "number" && iteration >= iterations || handler() === true) {
      disposable.dispose();
    }
  }, interval);
  const disposable = toDisposable(() => {
    targetWindow.clearInterval(timer);
  });
  return disposable;
}
class WindowIntervalTimer extends IntervalTimer {
  /**
   *
   * @param node The optional node from which the target window is determined
   */
  constructor(node) {
    super();
    this.defaultTarget = node && getWindow(node);
  }
  cancelAndSet(runner, interval, targetWindow) {
    return super.cancelAndSet(runner, interval, targetWindow ?? this.defaultTarget);
  }
}
class AnimationFrameQueueItem {
  constructor(runner, priority = 0) {
    this._runner = runner;
    this.priority = priority;
    this._canceled = false;
  }
  dispose() {
    this._canceled = true;
  }
  execute() {
    if (this._canceled) {
      return;
    }
    try {
      this._runner();
    } catch (e) {
      onUnexpectedError(e);
    }
  }
  // Sort by priority (largest to lowest)
  static sort(a, b) {
    return b.priority - a.priority;
  }
}
(function() {
  const NEXT_QUEUE = /* @__PURE__ */ new Map();
  const CURRENT_QUEUE = /* @__PURE__ */ new Map();
  const animFrameRequested = /* @__PURE__ */ new Map();
  const inAnimationFrameRunner = /* @__PURE__ */ new Map();
  const animationFrameRunner = (targetWindowId) => {
    animFrameRequested.set(targetWindowId, false);
    const currentQueue = NEXT_QUEUE.get(targetWindowId) ?? [];
    CURRENT_QUEUE.set(targetWindowId, currentQueue);
    NEXT_QUEUE.set(targetWindowId, []);
    inAnimationFrameRunner.set(targetWindowId, true);
    while (currentQueue.length > 0) {
      currentQueue.sort(AnimationFrameQueueItem.sort);
      const top = currentQueue.shift();
      top.execute();
    }
    inAnimationFrameRunner.set(targetWindowId, false);
  };
  scheduleAtNextAnimationFrame = (targetWindow, runner, priority = 0) => {
    const targetWindowId = getWindowId(targetWindow);
    const item = new AnimationFrameQueueItem(runner, priority);
    let nextQueue = NEXT_QUEUE.get(targetWindowId);
    if (!nextQueue) {
      nextQueue = [];
      NEXT_QUEUE.set(targetWindowId, nextQueue);
    }
    nextQueue.push(item);
    if (!animFrameRequested.get(targetWindowId)) {
      animFrameRequested.set(targetWindowId, true);
      targetWindow.requestAnimationFrame(() => animationFrameRunner(targetWindowId));
    }
    return item;
  };
  runAtThisOrScheduleAtNextAnimationFrame = (targetWindow, runner, priority) => {
    const targetWindowId = getWindowId(targetWindow);
    if (inAnimationFrameRunner.get(targetWindowId)) {
      const item = new AnimationFrameQueueItem(runner, priority);
      let currentQueue = CURRENT_QUEUE.get(targetWindowId);
      if (!currentQueue) {
        currentQueue = [];
        CURRENT_QUEUE.set(targetWindowId, currentQueue);
      }
      currentQueue.push(item);
      return item;
    } else {
      return scheduleAtNextAnimationFrame(targetWindow, runner, priority);
    }
  };
})();
function measure(targetWindow, callback) {
  return scheduleAtNextAnimationFrame(
    targetWindow,
    callback,
    1e4
    /* must be early */
  );
}
function modify(targetWindow, callback) {
  return scheduleAtNextAnimationFrame(
    targetWindow,
    callback,
    -1e4
    /* must be late */
  );
}
class AnimationFrameScheduler {
  constructor(node, runner) {
    this.pendingRunner = new MutableDisposable();
    this.node = node;
    this.runner = runner;
  }
  dispose() {
    this.pendingRunner.dispose();
  }
  /**
   * Cancel the currently scheduled runner (if any).
   */
  cancel() {
    this.pendingRunner.clear();
  }
  /**
   * Schedule the runner to execute at the next animation frame.
   * If already scheduled, this is a no-op (the existing schedule is kept).
   * If currently in an animation frame, the runner will execute immediately.
   */
  schedule() {
    if (this.pendingRunner.value) {
      return;
    }
    this.pendingRunner.value = runAtThisOrScheduleAtNextAnimationFrame(getWindow(this.node), () => {
      this.pendingRunner.clear();
      this.runner();
    });
  }
  /**
   * Returns true if a runner is scheduled.
   */
  isScheduled() {
    return this.pendingRunner.value !== void 0;
  }
}
const MINIMUM_TIME_MS = 8;
function DEFAULT_EVENT_MERGER(_lastEvent, currentEvent) {
  return currentEvent;
}
class TimeoutThrottledDomListener extends Disposable {
  constructor(node, type, handler, eventMerger = DEFAULT_EVENT_MERGER, minimumTimeMs = MINIMUM_TIME_MS) {
    super();
    let lastEvent = null;
    let lastHandlerTime = 0;
    const timeout = this._register(new TimeoutTimer());
    const invokeHandler = () => {
      lastHandlerTime = (/* @__PURE__ */ new Date()).getTime();
      handler(lastEvent);
      lastEvent = null;
    };
    this._register(addDisposableListener(node, type, (e) => {
      lastEvent = eventMerger(lastEvent, e);
      const elapsedTime = (/* @__PURE__ */ new Date()).getTime() - lastHandlerTime;
      if (elapsedTime >= minimumTimeMs) {
        timeout.cancel();
        invokeHandler();
      } else {
        timeout.setIfNotSet(invokeHandler, minimumTimeMs - elapsedTime);
      }
    }));
  }
}
function addDisposableThrottledListener(node, type, handler, eventMerger, minimumTimeMs) {
  return new TimeoutThrottledDomListener(node, type, handler, eventMerger, minimumTimeMs);
}
function getComputedStyle(el) {
  return getWindow(el).getComputedStyle(el, null);
}
function getClientArea(element, defaultValue, fallbackElement) {
  const elWindow = getWindow(element);
  const elDocument = elWindow.document;
  if (element !== elDocument.body) {
    return new Dimension(element.clientWidth, element.clientHeight);
  }
  if (platform.isIOS && elWindow?.visualViewport) {
    return new Dimension(elWindow.visualViewport.width, elWindow.visualViewport.height);
  }
  if (elWindow?.innerWidth && elWindow.innerHeight) {
    return new Dimension(elWindow.innerWidth, elWindow.innerHeight);
  }
  if (elDocument.body && elDocument.body.clientWidth && elDocument.body.clientHeight) {
    return new Dimension(elDocument.body.clientWidth, elDocument.body.clientHeight);
  }
  if (elDocument.documentElement && elDocument.documentElement.clientWidth && elDocument.documentElement.clientHeight) {
    return new Dimension(elDocument.documentElement.clientWidth, elDocument.documentElement.clientHeight);
  }
  if (fallbackElement) {
    return getClientArea(fallbackElement, defaultValue);
  }
  if (defaultValue) {
    return defaultValue;
  }
  throw new Error("Unable to figure out browser width and height");
}
class SizeUtils {
  // Adapted from WinJS
  // Converts a CSS positioning string for the specified element to pixels.
  static convertToPixels(element, value) {
    return parseFloat(value) || 0;
  }
  static getDimension(element, cssPropertyName) {
    const computedStyle = getComputedStyle(element);
    const value = computedStyle ? computedStyle.getPropertyValue(cssPropertyName) : "0";
    return SizeUtils.convertToPixels(element, value);
  }
  static getBorderLeftWidth(element) {
    return SizeUtils.getDimension(element, "border-left-width");
  }
  static getBorderRightWidth(element) {
    return SizeUtils.getDimension(element, "border-right-width");
  }
  static getBorderTopWidth(element) {
    return SizeUtils.getDimension(element, "border-top-width");
  }
  static getBorderBottomWidth(element) {
    return SizeUtils.getDimension(element, "border-bottom-width");
  }
  static getPaddingLeft(element) {
    return SizeUtils.getDimension(element, "padding-left");
  }
  static getPaddingRight(element) {
    return SizeUtils.getDimension(element, "padding-right");
  }
  static getPaddingTop(element) {
    return SizeUtils.getDimension(element, "padding-top");
  }
  static getPaddingBottom(element) {
    return SizeUtils.getDimension(element, "padding-bottom");
  }
  static getMarginLeft(element) {
    return SizeUtils.getDimension(element, "margin-left");
  }
  static getMarginTop(element) {
    return SizeUtils.getDimension(element, "margin-top");
  }
  static getMarginRight(element) {
    return SizeUtils.getDimension(element, "margin-right");
  }
  static getMarginBottom(element) {
    return SizeUtils.getDimension(element, "margin-bottom");
  }
}
class Dimension {
  constructor(width, height) {
    this.width = width;
    this.height = height;
  }
  static {
    this.None = new Dimension(0, 0);
  }
  with(width = this.width, height = this.height) {
    if (width !== this.width || height !== this.height) {
      return new Dimension(width, height);
    } else {
      return this;
    }
  }
  static is(obj) {
    return typeof obj === "object" && typeof obj.height === "number" && typeof obj.width === "number";
  }
  static lift(obj) {
    if (obj instanceof Dimension) {
      return obj;
    } else {
      return new Dimension(obj.width, obj.height);
    }
  }
  static equals(a, b) {
    if (a === b) {
      return true;
    }
    if (!a || !b) {
      return false;
    }
    return a.width === b.width && a.height === b.height;
  }
}
function getTopLeftOffset(element) {
  let offsetParent = element.offsetParent;
  let top = element.offsetTop;
  let left = element.offsetLeft;
  while ((element = element.parentNode) !== null && element !== element.ownerDocument.body && element !== element.ownerDocument.documentElement) {
    top -= element.scrollTop;
    const c = isShadowRoot(element) ? null : getComputedStyle(element);
    if (c) {
      left -= c.direction !== "rtl" ? element.scrollLeft : -element.scrollLeft;
    }
    if (element === offsetParent) {
      left += SizeUtils.getBorderLeftWidth(element);
      top += SizeUtils.getBorderTopWidth(element);
      top += element.offsetTop;
      left += element.offsetLeft;
      offsetParent = element.offsetParent;
    }
  }
  return {
    left,
    top
  };
}
function size(element, width, height) {
  if (typeof width === "number") {
    element.style.width = `${width}px`;
  }
  if (typeof height === "number") {
    element.style.height = `${height}px`;
  }
}
function position(element, top, right, bottom, left, position2 = "absolute") {
  if (typeof top === "number") {
    element.style.top = `${top}px`;
  }
  if (typeof right === "number") {
    element.style.right = `${right}px`;
  }
  if (typeof bottom === "number") {
    element.style.bottom = `${bottom}px`;
  }
  if (typeof left === "number") {
    element.style.left = `${left}px`;
  }
  element.style.position = position2;
}
function getDomNodePagePosition(domNode) {
  const bb = domNode.getBoundingClientRect();
  const window = getWindow(domNode);
  return {
    left: bb.left + window.scrollX,
    top: bb.top + window.scrollY,
    width: bb.width,
    height: bb.height
  };
}
function getDomNodeZoomLevel(domNode) {
  let testElement = domNode;
  let zoom = 1;
  do {
    const elementZoomLevel = getComputedStyle(testElement).zoom;
    if (elementZoomLevel !== null && elementZoomLevel !== void 0 && elementZoomLevel !== "1") {
      zoom *= elementZoomLevel;
    }
    testElement = testElement.parentElement;
  } while (testElement !== null && testElement !== testElement.ownerDocument.documentElement);
  return zoom;
}
function getTotalWidth(element) {
  const margin = SizeUtils.getMarginLeft(element) + SizeUtils.getMarginRight(element);
  return element.offsetWidth + margin;
}
function getContentWidth(element) {
  const border = SizeUtils.getBorderLeftWidth(element) + SizeUtils.getBorderRightWidth(element);
  const padding = SizeUtils.getPaddingLeft(element) + SizeUtils.getPaddingRight(element);
  return element.offsetWidth - border - padding;
}
function getTotalScrollWidth(element) {
  const margin = SizeUtils.getMarginLeft(element) + SizeUtils.getMarginRight(element);
  return element.scrollWidth + margin;
}
function getContentHeight(element) {
  const border = SizeUtils.getBorderTopWidth(element) + SizeUtils.getBorderBottomWidth(element);
  const padding = SizeUtils.getPaddingTop(element) + SizeUtils.getPaddingBottom(element);
  return element.offsetHeight - border - padding;
}
function getTotalHeight(element) {
  const margin = SizeUtils.getMarginTop(element) + SizeUtils.getMarginBottom(element);
  return element.offsetHeight + margin;
}
function getRelativeLeft(element, parent) {
  if (element === null) {
    return 0;
  }
  const elementPosition = getTopLeftOffset(element);
  const parentPosition = getTopLeftOffset(parent);
  return elementPosition.left - parentPosition.left;
}
function getLargestChildWidth(parent, children) {
  const childWidths = children.map((child) => {
    return Math.max(getTotalScrollWidth(child), getTotalWidth(child)) + getRelativeLeft(child, parent) || 0;
  });
  const maxWidth = Math.max(...childWidths);
  return maxWidth;
}
function isAncestor(testChild, testAncestor) {
  return Boolean(testAncestor?.contains(testChild));
}
const parentFlowToDataKey = "parentFlowToElementId";
function setParentFlowTo(fromChildElement, toParentElement) {
  fromChildElement.dataset[parentFlowToDataKey] = toParentElement.id;
}
function getParentFlowToElement(node) {
  const flowToParentId = node.dataset[parentFlowToDataKey];
  if (typeof flowToParentId === "string") {
    return node.ownerDocument.getElementById(flowToParentId);
  }
  return null;
}
function isAncestorUsingFlowTo(testChild, testAncestor) {
  let node = testChild;
  while (node) {
    if (node === testAncestor) {
      return true;
    }
    if (isHTMLElement(node)) {
      const flowToParentElement = getParentFlowToElement(node);
      if (flowToParentElement) {
        node = flowToParentElement;
        continue;
      }
    }
    node = node.parentNode;
  }
  return false;
}
function findParentWithClass(node, clazz, stopAtClazzOrNode) {
  while (node && node.nodeType === node.ELEMENT_NODE) {
    if (typeof clazz === "string" ? node.classList.contains(clazz) : clazz.every((candidate) => node.classList.contains(candidate))) {
      return node;
    }
    if (stopAtClazzOrNode) {
      if (typeof stopAtClazzOrNode === "string") {
        if (node.classList.contains(stopAtClazzOrNode)) {
          return null;
        }
      } else {
        if (node === stopAtClazzOrNode) {
          return null;
        }
      }
    }
    node = node.parentNode;
  }
  return null;
}
function hasParentWithClass(node, clazz, stopAtClazzOrNode) {
  return !!findParentWithClass(node, clazz, stopAtClazzOrNode);
}
function isShadowRoot(node) {
  return node && !!node.host && !!node.mode;
}
function isInShadowDOM(domNode) {
  return !!getShadowRoot(domNode);
}
function getShadowRoot(domNode) {
  while (domNode.parentNode) {
    if (domNode === domNode.ownerDocument?.body) {
      return null;
    }
    domNode = domNode.parentNode;
  }
  return isShadowRoot(domNode) ? domNode : null;
}
function getActiveElement() {
  let result = getActiveDocument().activeElement;
  while (result?.shadowRoot) {
    result = result.shadowRoot.activeElement;
  }
  return result;
}
function isActiveElement(element) {
  return getActiveElement() === element;
}
function isAncestorOfActiveElement(ancestor) {
  return isAncestor(getActiveElement(), ancestor);
}
function isActiveDocument(element) {
  return element.ownerDocument === getActiveDocument();
}
function getActiveDocument() {
  if (getWindowsCount() <= 1) {
    return mainWindow.document;
  }
  const documents = Array.from(getWindows()).map(({ window }) => window.document);
  const focusedDoc = documents.find((doc) => doc.hasFocus());
  if (focusedDoc) {
    return focusedDoc;
  }
  const externalWindow = getExternalFocusWindow();
  if (externalWindow) {
    return externalWindow.document;
  }
  return mainWindow.document;
}
function getActiveWindow() {
  const document2 = getActiveDocument();
  return document2.defaultView?.window ?? mainWindow;
}
const sharedMutationObserver = new class {
  constructor() {
    this.mutationObservers = /* @__PURE__ */ new Map();
  }
  observe(target, disposables, options) {
    let mutationObserversPerTarget = this.mutationObservers.get(target);
    if (!mutationObserversPerTarget) {
      mutationObserversPerTarget = /* @__PURE__ */ new Map();
      this.mutationObservers.set(target, mutationObserversPerTarget);
    }
    const optionsHash = hash(options);
    let mutationObserverPerOptions = mutationObserversPerTarget.get(optionsHash);
    if (!mutationObserverPerOptions) {
      const onDidMutate = new event.Emitter();
      const observer = new MutationObserver((mutations) => onDidMutate.fire(mutations));
      observer.observe(target, options);
      const resolvedMutationObserverPerOptions = mutationObserverPerOptions = {
        users: 1,
        observer,
        onDidMutate: onDidMutate.event
      };
      disposables.add(toDisposable(() => {
        resolvedMutationObserverPerOptions.users -= 1;
        if (resolvedMutationObserverPerOptions.users === 0) {
          onDidMutate.dispose();
          observer.disconnect();
          mutationObserversPerTarget?.delete(optionsHash);
          if (mutationObserversPerTarget?.size === 0) {
            this.mutationObservers.delete(target);
          }
        }
      }));
      mutationObserversPerTarget.set(optionsHash, mutationObserverPerOptions);
    } else {
      mutationObserverPerOptions.users += 1;
    }
    return mutationObserverPerOptions.onDidMutate;
  }
}();
function createMetaElement(container = mainWindow.document.head) {
  return createHeadElement("meta", container);
}
function createLinkElement(container = mainWindow.document.head) {
  return createHeadElement("link", container);
}
function createHeadElement(tagName, container = mainWindow.document.head) {
  const element = document.createElement(tagName);
  container.appendChild(element);
  return element;
}
function isHTMLElement(e) {
  return e instanceof HTMLElement || e instanceof getWindow(e).HTMLElement;
}
function isHTMLAnchorElement(e) {
  return e instanceof HTMLAnchorElement || e instanceof getWindow(e).HTMLAnchorElement;
}
function isHTMLSpanElement(e) {
  return e instanceof HTMLSpanElement || e instanceof getWindow(e).HTMLSpanElement;
}
function isHTMLTextAreaElement(e) {
  return e instanceof HTMLTextAreaElement || e instanceof getWindow(e).HTMLTextAreaElement;
}
function isHTMLInputElement(e) {
  return e instanceof HTMLInputElement || e instanceof getWindow(e).HTMLInputElement;
}
function isHTMLButtonElement(e) {
  return e instanceof HTMLButtonElement || e instanceof getWindow(e).HTMLButtonElement;
}
function isHTMLDivElement(e) {
  return e instanceof HTMLDivElement || e instanceof getWindow(e).HTMLDivElement;
}
function isSVGElement(e) {
  return e instanceof SVGElement || e instanceof getWindow(e).SVGElement;
}
function isMouseEvent(e) {
  return e instanceof MouseEvent || e instanceof getWindow(e).MouseEvent;
}
function isKeyboardEvent(e) {
  return e instanceof KeyboardEvent || e instanceof getWindow(e).KeyboardEvent;
}
function isPointerEvent(e) {
  return e instanceof PointerEvent || e instanceof getWindow(e).PointerEvent;
}
function isDragEvent(e) {
  return e instanceof DragEvent || e instanceof getWindow(e).DragEvent;
}
const EventType = {
  // Mouse
  CLICK: "click",
  AUXCLICK: "auxclick",
  DBLCLICK: "dblclick",
  MOUSE_UP: "mouseup",
  MOUSE_DOWN: "mousedown",
  MOUSE_OVER: "mouseover",
  MOUSE_MOVE: "mousemove",
  MOUSE_OUT: "mouseout",
  MOUSE_ENTER: "mouseenter",
  MOUSE_LEAVE: "mouseleave",
  MOUSE_WHEEL: "wheel",
  POINTER_UP: "pointerup",
  POINTER_DOWN: "pointerdown",
  POINTER_MOVE: "pointermove",
  POINTER_LEAVE: "pointerleave",
  CONTEXT_MENU: "contextmenu",
  WHEEL: "wheel",
  // Keyboard
  KEY_DOWN: "keydown",
  KEY_PRESS: "keypress",
  KEY_UP: "keyup",
  // HTML Document
  LOAD: "load",
  BEFORE_UNLOAD: "beforeunload",
  UNLOAD: "unload",
  PAGE_SHOW: "pageshow",
  PAGE_HIDE: "pagehide",
  PASTE: "paste",
  ABORT: "abort",
  ERROR: "error",
  RESIZE: "resize",
  SCROLL: "scroll",
  FULLSCREEN_CHANGE: "fullscreenchange",
  WK_FULLSCREEN_CHANGE: "webkitfullscreenchange",
  // Form
  SELECT: "select",
  CHANGE: "change",
  SUBMIT: "submit",
  RESET: "reset",
  FOCUS: "focus",
  FOCUS_IN: "focusin",
  FOCUS_OUT: "focusout",
  BLUR: "blur",
  INPUT: "input",
  // Local Storage
  STORAGE: "storage",
  // Drag
  DRAG_START: "dragstart",
  DRAG: "drag",
  DRAG_ENTER: "dragenter",
  DRAG_LEAVE: "dragleave",
  DRAG_OVER: "dragover",
  DROP: "drop",
  DRAG_END: "dragend",
  // Animation
  ANIMATION_START: browser.isWebKit ? "webkitAnimationStart" : "animationstart",
  ANIMATION_END: browser.isWebKit ? "webkitAnimationEnd" : "animationend",
  ANIMATION_ITERATION: browser.isWebKit ? "webkitAnimationIteration" : "animationiteration"
};
function isEventLike(obj) {
  const candidate = obj;
  return !!(candidate && typeof candidate.preventDefault === "function" && typeof candidate.stopPropagation === "function");
}
const EventHelper = {
  stop: (e, cancelBubble) => {
    e.preventDefault();
    if (cancelBubble) {
      e.stopPropagation();
    }
    return e;
  }
};
function saveParentsScrollTop(node) {
  const r = [];
  for (let i = 0; node && node.nodeType === node.ELEMENT_NODE; i++) {
    r[i] = node.scrollTop;
    node = node.parentNode;
  }
  return r;
}
function restoreParentsScrollTop(node, state) {
  for (let i = 0; node && node.nodeType === node.ELEMENT_NODE; i++) {
    if (node.scrollTop !== state[i]) {
      node.scrollTop = state[i];
    }
    node = node.parentNode;
  }
}
class FocusTracker extends Disposable {
  constructor(element) {
    super();
    this._onDidFocus = this._register(new event.Emitter());
    this._onDidBlur = this._register(new event.Emitter());
    let hasFocus = FocusTracker.hasFocusWithin(element);
    let loosingFocus = false;
    const onFocus = () => {
      loosingFocus = false;
      if (!hasFocus) {
        hasFocus = true;
        this._onDidFocus.fire();
      }
    };
    const onBlur = () => {
      if (hasFocus) {
        loosingFocus = true;
        (isHTMLElement(element) ? getWindow(element) : element).setTimeout(() => {
          if (loosingFocus) {
            loosingFocus = false;
            hasFocus = false;
            this._onDidBlur.fire();
          }
        }, 0);
      }
    };
    this._refreshStateHandler = () => {
      const currentNodeHasFocus = FocusTracker.hasFocusWithin(element);
      if (currentNodeHasFocus !== hasFocus) {
        if (hasFocus) {
          onBlur();
        } else {
          onFocus();
        }
      }
    };
    this._register(addDisposableListener(element, EventType.FOCUS, onFocus, true));
    this._register(addDisposableListener(element, EventType.BLUR, onBlur, true));
    if (isHTMLElement(element)) {
      this._register(addDisposableListener(element, EventType.FOCUS_IN, () => this._refreshStateHandler()));
      this._register(addDisposableListener(element, EventType.FOCUS_OUT, () => this._refreshStateHandler()));
    }
  }
  get onDidFocus() {
    return this._onDidFocus.event;
  }
  get onDidBlur() {
    return this._onDidBlur.event;
  }
  static hasFocusWithin(element) {
    if (isHTMLElement(element)) {
      const shadowRoot = getShadowRoot(element);
      const activeElement = shadowRoot ? shadowRoot.activeElement : element.ownerDocument.activeElement;
      return isAncestor(activeElement, element);
    } else {
      const window = element;
      return isAncestor(window.document.activeElement, window.document);
    }
  }
  refreshState() {
    this._refreshStateHandler();
  }
}
function trackFocus(element) {
  return new FocusTracker(element);
}
function after(sibling, child) {
  sibling.after(child);
  return child;
}
function append(parent, ...children) {
  parent.append(...children);
  if (children.length === 1 && typeof children[0] !== "string") {
    return children[0];
  }
}
function prepend(parent, child) {
  parent.insertBefore(child, parent.firstChild);
  return child;
}
function reset(parent, ...children) {
  parent.textContent = "";
  append(parent, ...children);
}
const SELECTOR_REGEX = /([\w\-]+)?(#([\w\-]+))?((\.([\w\-]+))*)/;
var Namespace = /* @__PURE__ */ ((Namespace2) => {
  Namespace2["HTML"] = "http://www.w3.org/1999/xhtml";
  Namespace2["SVG"] = "http://www.w3.org/2000/svg";
  return Namespace2;
})(Namespace || {});
function _$(namespace, description, attrs, ...children) {
  const match = SELECTOR_REGEX.exec(description);
  if (!match) {
    throw new Error("Bad use of emmet");
  }
  const tagName = match[1] || "div";
  let result;
  if (namespace !== "http://www.w3.org/1999/xhtml" /* HTML */) {
    result = document.createElementNS(namespace, tagName);
  } else {
    result = document.createElement(tagName);
  }
  if (match[3]) {
    result.id = match[3];
  }
  if (match[4]) {
    result.className = match[4].replace(/\./g, " ").trim();
  }
  if (attrs) {
    Object.entries(attrs).forEach(([name, value]) => {
      if (typeof value === "undefined") {
        return;
      }
      if (/^on\w+$/.test(name)) {
        result[name] = value;
      } else if (name === "selected") {
        if (value) {
          result.setAttribute(name, "true");
        }
      } else {
        result.setAttribute(name, value);
      }
    });
  }
  result.append(...children);
  return result;
}
function $(description, attrs, ...children) {
  return _$("http://www.w3.org/1999/xhtml" /* HTML */, description, attrs, ...children);
}
$.SVG = function(description, attrs, ...children) {
  return _$("http://www.w3.org/2000/svg" /* SVG */, description, attrs, ...children);
};
function join(nodes, separator) {
  const result = [];
  nodes.forEach((node, index) => {
    if (index > 0) {
      if (separator instanceof Node) {
        result.push(separator.cloneNode());
      } else {
        result.push(document.createTextNode(separator));
      }
    }
    result.push(node);
  });
  return result;
}
function setVisibility(visible, ...elements) {
  if (visible) {
    show(...elements);
  } else {
    hide(...elements);
  }
}
function show(...elements) {
  for (const element of elements) {
    element.style.display = "";
    element.removeAttribute("aria-hidden");
  }
}
function hide(...elements) {
  for (const element of elements) {
    element.style.display = "none";
    element.setAttribute("aria-hidden", "true");
  }
}
function findParentWithAttribute(node, attribute) {
  while (node && node.nodeType === node.ELEMENT_NODE) {
    if (isHTMLElement(node) && node.hasAttribute(attribute)) {
      return node;
    }
    node = node.parentNode;
  }
  return null;
}
function removeTabIndexAndUpdateFocus(node) {
  if (!node || !node.hasAttribute("tabIndex")) {
    return;
  }
  if (node.ownerDocument.activeElement === node) {
    const parentFocusable = findParentWithAttribute(node.parentElement, "tabIndex");
    parentFocusable?.focus();
  }
  node.removeAttribute("tabindex");
}
function finalHandler(fn) {
  return (e) => {
    e.preventDefault();
    e.stopPropagation();
    fn(e);
  };
}
function domContentLoaded(targetWindow) {
  return new Promise((resolve2) => {
    const readyState = targetWindow.document.readyState;
    if (readyState === "complete" || targetWindow.document && targetWindow.document.body !== null) {
      resolve2(void 0);
    } else {
      const listener = () => {
        targetWindow.window.removeEventListener("DOMContentLoaded", listener, false);
        resolve2();
      };
      targetWindow.window.addEventListener("DOMContentLoaded", listener, false);
    }
  });
}
function computeScreenAwareSize(window, cssPx) {
  const screenPx = window.devicePixelRatio * cssPx;
  return Math.max(1, Math.floor(screenPx)) / window.devicePixelRatio;
}
function windowOpenNoOpener(url) {
  mainWindow.open(url, "_blank", "noopener");
}
const popupWidth = 780, popupHeight = 640;
function windowOpenPopup(url) {
  const left = Math.floor(mainWindow.screenLeft + mainWindow.innerWidth / 2 - popupWidth / 2);
  const top = Math.floor(mainWindow.screenTop + mainWindow.innerHeight / 2 - popupHeight / 2);
  mainWindow.open(
    url,
    "_blank",
    `width=${popupWidth},height=${popupHeight},top=${top},left=${left}`
  );
}
function windowOpenWithSuccess(url, noOpener = true) {
  const newTab = mainWindow.open();
  if (newTab) {
    if (noOpener) {
      newTab.opener = null;
    }
    newTab.location.href = url;
    return true;
  }
  return false;
}
function animate(targetWindow, fn) {
  const step = () => {
    fn();
    stepDisposable = scheduleAtNextAnimationFrame(targetWindow, step);
  };
  let stepDisposable = scheduleAtNextAnimationFrame(targetWindow, step);
  return toDisposable(() => stepDisposable.dispose());
}
RemoteAuthorities.setPreferredWebSchema(/^https:/.test(mainWindow.location.href) ? "https" : "http");
function triggerDownload(dataOrUri, name) {
  let url;
  if (URI.isUri(dataOrUri)) {
    url = dataOrUri.toString(true);
  } else {
    const blob = new Blob([dataOrUri]);
    url = URL.createObjectURL(blob);
    setTimeout(() => URL.revokeObjectURL(url));
  }
  const activeWindow = getActiveWindow();
  const anchor = document.createElement("a");
  activeWindow.document.body.appendChild(anchor);
  anchor.download = name;
  anchor.href = url;
  anchor.click();
  setTimeout(() => anchor.remove());
}
function triggerUpload() {
  return new Promise((resolve2) => {
    const activeWindow = getActiveWindow();
    const input = document.createElement("input");
    activeWindow.document.body.appendChild(input);
    input.type = "file";
    input.multiple = true;
    event.Event.once(event.Event.fromDOMEventEmitter(input, "input"))(() => {
      resolve2(input.files ?? void 0);
    });
    input.click();
    setTimeout(() => input.remove());
  });
}
var DetectedFullscreenMode = /* @__PURE__ */ ((DetectedFullscreenMode2) => {
  DetectedFullscreenMode2[DetectedFullscreenMode2["DOCUMENT"] = 1] = "DOCUMENT";
  DetectedFullscreenMode2[DetectedFullscreenMode2["BROWSER"] = 2] = "BROWSER";
  return DetectedFullscreenMode2;
})(DetectedFullscreenMode || {});
function detectFullscreen(targetWindow) {
  if (targetWindow.document.fullscreenElement || targetWindow.document.webkitFullscreenElement || targetWindow.document.webkitIsFullScreen) {
    return { mode: 1 /* DOCUMENT */, guess: false };
  }
  if (targetWindow.innerHeight === targetWindow.screen.height) {
    return { mode: 2 /* BROWSER */, guess: false };
  }
  if (platform.isMacintosh || platform.isLinux) {
    if (targetWindow.outerHeight === targetWindow.screen.height && targetWindow.outerWidth === targetWindow.screen.width) {
      return { mode: 2 /* BROWSER */, guess: true };
    }
  }
  return null;
}
class ModifierKeyEmitter extends event.Emitter {
  constructor() {
    super();
    this._subscriptions = new DisposableStore();
    this._keyStatus = {
      altKey: false,
      shiftKey: false,
      ctrlKey: false,
      metaKey: false
    };
    this._subscriptions.add(event.Event.runAndSubscribe(onDidRegisterWindow, ({ window, disposables }) => this.registerListeners(window, disposables), { window: mainWindow, disposables: this._subscriptions }));
  }
  registerListeners(window, disposables) {
    disposables.add(addDisposableListener(window, "keydown", (e) => {
      if (e.defaultPrevented) {
        return;
      }
      const event2 = new StandardKeyboardEvent(e);
      if (event2.keyCode === KeyCode.Alt && e.repeat) {
        return;
      }
      if (e.altKey && !this._keyStatus.altKey) {
        this._keyStatus.lastKeyPressed = "alt";
      } else if (e.ctrlKey && !this._keyStatus.ctrlKey) {
        this._keyStatus.lastKeyPressed = "ctrl";
      } else if (e.metaKey && !this._keyStatus.metaKey) {
        this._keyStatus.lastKeyPressed = "meta";
      } else if (e.shiftKey && !this._keyStatus.shiftKey) {
        this._keyStatus.lastKeyPressed = "shift";
      } else if (event2.keyCode !== KeyCode.Alt) {
        this._keyStatus.lastKeyPressed = void 0;
      } else {
        return;
      }
      this._keyStatus.altKey = e.altKey;
      this._keyStatus.ctrlKey = e.ctrlKey;
      this._keyStatus.metaKey = e.metaKey;
      this._keyStatus.shiftKey = e.shiftKey;
      if (this._keyStatus.lastKeyPressed) {
        this._keyStatus.event = e;
        this.fire(this._keyStatus);
      }
    }, true));
    disposables.add(addDisposableListener(window, "keyup", (e) => {
      if (e.defaultPrevented) {
        return;
      }
      if (!e.altKey && this._keyStatus.altKey) {
        this._keyStatus.lastKeyReleased = "alt";
      } else if (!e.ctrlKey && this._keyStatus.ctrlKey) {
        this._keyStatus.lastKeyReleased = "ctrl";
      } else if (!e.metaKey && this._keyStatus.metaKey) {
        this._keyStatus.lastKeyReleased = "meta";
      } else if (!e.shiftKey && this._keyStatus.shiftKey) {
        this._keyStatus.lastKeyReleased = "shift";
      } else {
        this._keyStatus.lastKeyReleased = void 0;
      }
      if (this._keyStatus.lastKeyPressed !== this._keyStatus.lastKeyReleased) {
        this._keyStatus.lastKeyPressed = void 0;
      }
      this._keyStatus.altKey = e.altKey;
      this._keyStatus.ctrlKey = e.ctrlKey;
      this._keyStatus.metaKey = e.metaKey;
      this._keyStatus.shiftKey = e.shiftKey;
      if (this._keyStatus.lastKeyReleased) {
        this._keyStatus.event = e;
        this.fire(this._keyStatus);
      }
    }, true));
    disposables.add(addDisposableListener(window.document.body, "mousedown", () => {
      this._keyStatus.lastKeyPressed = void 0;
    }, true));
    disposables.add(addDisposableListener(window.document.body, "mouseup", () => {
      this._keyStatus.lastKeyPressed = void 0;
    }, true));
    disposables.add(addDisposableListener(window.document.body, "mousemove", (e) => {
      if (e.buttons) {
        this._keyStatus.lastKeyPressed = void 0;
      }
    }, true));
    disposables.add(addDisposableListener(window, "blur", () => {
      this.resetKeyStatus();
    }));
  }
  get keyStatus() {
    return this._keyStatus;
  }
  get isModifierPressed() {
    return hasModifierKeys(this._keyStatus);
  }
  /**
   * Allows to explicitly reset the key status based on more knowledge (#109062)
   */
  resetKeyStatus() {
    this.doResetKeyStatus();
    this.fire(this._keyStatus);
  }
  doResetKeyStatus() {
    this._keyStatus = {
      altKey: false,
      shiftKey: false,
      ctrlKey: false,
      metaKey: false
    };
  }
  static getInstance() {
    if (!ModifierKeyEmitter.instance) {
      ModifierKeyEmitter.instance = new ModifierKeyEmitter();
    }
    return ModifierKeyEmitter.instance;
  }
  static disposeInstance() {
    if (ModifierKeyEmitter.instance) {
      ModifierKeyEmitter.instance.dispose();
      ModifierKeyEmitter.instance = void 0;
    }
  }
  dispose() {
    super.dispose();
    this._subscriptions.dispose();
  }
}
function getCookieValue(name) {
  const match = document.cookie.match("(^|[^;]+)\\s*" + name + "\\s*=\\s*([^;]+)");
  return match ? match.pop() : void 0;
}
class DragAndDropObserver extends Disposable {
  constructor(element, callbacks) {
    super();
    this.element = element;
    this.callbacks = callbacks;
    // A helper to fix issues with repeated DRAG_ENTER / DRAG_LEAVE
    // calls see https://github.com/microsoft/vscode/issues/14470
    // when the element has child elements where the events are fired
    // repeadedly.
    this.counter = 0;
    // Allows to measure the duration of the drag operation.
    this.dragStartTime = 0;
    this.registerListeners();
  }
  registerListeners() {
    if (this.callbacks.onDragStart) {
      this._register(addDisposableListener(this.element, EventType.DRAG_START, (e) => {
        this.callbacks.onDragStart?.(e);
      }));
    }
    if (this.callbacks.onDrag) {
      this._register(addDisposableListener(this.element, EventType.DRAG, (e) => {
        this.callbacks.onDrag?.(e);
      }));
    }
    this._register(addDisposableListener(this.element, EventType.DRAG_ENTER, (e) => {
      this.counter++;
      this.dragStartTime = e.timeStamp;
      this.callbacks.onDragEnter?.(e);
    }));
    this._register(addDisposableListener(this.element, EventType.DRAG_OVER, (e) => {
      e.preventDefault();
      this.callbacks.onDragOver?.(e, e.timeStamp - this.dragStartTime);
    }));
    this._register(addDisposableListener(this.element, EventType.DRAG_LEAVE, (e) => {
      this.counter--;
      if (this.counter === 0) {
        this.dragStartTime = 0;
        this.callbacks.onDragLeave?.(e);
      }
    }));
    this._register(addDisposableListener(this.element, EventType.DRAG_END, (e) => {
      this.counter = 0;
      this.dragStartTime = 0;
      this.callbacks.onDragEnd?.(e);
    }));
    this._register(addDisposableListener(this.element, EventType.DROP, (e) => {
      this.counter = 0;
      this.dragStartTime = 0;
      this.callbacks.onDrop?.(e);
    }));
  }
}
class DisposableResizeObserver extends Disposable {
  constructor(name, callback, targetWindow = mainWindow, options) {
    super();
    this.name = name;
    const ctor = options?.resizeObserverCtor ?? targetWindow.ResizeObserver;
    this.observer = new ctor((entries, observer) => {
      recordDisposableResizeObserverInvocation(targetWindow, this.name);
      try {
        callback(entries, observer);
      } catch (e) {
        onUnexpectedError(e);
      }
    });
    this._register(toDisposable(() => this.observer.disconnect()));
  }
  observe(target, options) {
    this.observer.observe(target, options);
    return toDisposable(() => this.observer.unobserve(target));
  }
}
const maxRecentDisposableResizeObservers = 8;
const recentDisposableResizeObserverContexts = /* @__PURE__ */ new WeakMap();
function recordDisposableResizeObserverInvocation(targetWindow, name) {
  let context = recentDisposableResizeObserverContexts.get(targetWindow);
  if (!context) {
    context = { names: /* @__PURE__ */ new Set(), overflow: false };
    recentDisposableResizeObserverContexts.set(targetWindow, context);
    targetWindow.requestAnimationFrame(() => recentDisposableResizeObserverContexts.delete(targetWindow));
  }
  if (context.names.has(name)) {
    return;
  }
  if (context.names.size < maxRecentDisposableResizeObservers) {
    context.names.add(name);
  } else {
    context.overflow = true;
    const largestName = Array.from(context.names).sort().at(-1);
    if (name < largestName) {
      context.names.delete(largestName);
      context.names.add(name);
    }
  }
}
function getRecentDisposableResizeObserverContextForLoopError(message, targetWindow = mainWindow) {
  if (typeof message !== "string" || !message.includes("ResizeObserver loop")) {
    return void 0;
  }
  const context = recentDisposableResizeObserverContexts.get(targetWindow);
  if (!context) {
    return void 0;
  }
  const names = Array.from(context.names).sort();
  if (context.overflow) {
    names.push("<overflow>");
  }
  return `[ResizeObserverLoopContext(${names.join(",")})] ${message}`;
}
const H_REGEX = /(?<tag>[\w\-]+)?(?:#(?<id>[\w\-]+))?(?<class>(?:\.(?:[\w\-]+))*)(?:@(?<name>(?:[\w\_])+))?/;
function h(tag, ...args) {
  let attributes;
  let children;
  if (Array.isArray(args[0])) {
    attributes = {};
    children = args[0];
  } else {
    attributes = args[0] || {};
    children = args[1];
  }
  const match = H_REGEX.exec(tag);
  if (!match || !match.groups) {
    throw new Error("Bad use of h");
  }
  const tagName = match.groups["tag"] || "div";
  const el = document.createElement(tagName);
  if (match.groups["id"]) {
    el.id = match.groups["id"];
  }
  const classNames = [];
  if (match.groups["class"]) {
    for (const className of match.groups["class"].split(".")) {
      if (className !== "") {
        classNames.push(className);
      }
    }
  }
  if (attributes.className !== void 0) {
    for (const className of attributes.className.split(".")) {
      if (className !== "") {
        classNames.push(className);
      }
    }
  }
  if (classNames.length > 0) {
    el.className = classNames.join(" ");
  }
  const result = {};
  if (match.groups["name"]) {
    result[match.groups["name"]] = el;
  }
  if (children) {
    for (const c of children) {
      if (isHTMLElement(c)) {
        el.appendChild(c);
      } else if (typeof c === "string") {
        el.append(c);
      } else if ("root" in c) {
        Object.assign(result, c);
        el.appendChild(c.root);
      }
    }
  }
  for (const [key, value] of Object.entries(attributes)) {
    if (key === "className") {
      continue;
    } else if (key === "style") {
      for (const [cssKey, cssValue] of Object.entries(value)) {
        el.style.setProperty(
          camelCaseToHyphenCase(cssKey),
          typeof cssValue === "number" ? cssValue + "px" : "" + cssValue
        );
      }
    } else if (key === "tabIndex") {
      el.tabIndex = value;
    } else {
      el.setAttribute(camelCaseToHyphenCase(key), value.toString());
    }
  }
  result["root"] = el;
  return result;
}
function svgElem(tag, ...args) {
  let attributes;
  let children;
  if (Array.isArray(args[0])) {
    attributes = {};
    children = args[0];
  } else {
    attributes = args[0] || {};
    children = args[1];
  }
  const match = H_REGEX.exec(tag);
  if (!match || !match.groups) {
    throw new Error("Bad use of h");
  }
  const tagName = match.groups["tag"] || "div";
  const el = document.createElementNS("http://www.w3.org/2000/svg", tagName);
  if (match.groups["id"]) {
    el.id = match.groups["id"];
  }
  const classNames = [];
  if (match.groups["class"]) {
    for (const className of match.groups["class"].split(".")) {
      if (className !== "") {
        classNames.push(className);
      }
    }
  }
  if (attributes.className !== void 0) {
    for (const className of attributes.className.split(".")) {
      if (className !== "") {
        classNames.push(className);
      }
    }
  }
  if (classNames.length > 0) {
    el.className = classNames.join(" ");
  }
  const result = {};
  if (match.groups["name"]) {
    result[match.groups["name"]] = el;
  }
  if (children) {
    for (const c of children) {
      if (isHTMLElement(c)) {
        el.appendChild(c);
      } else if (typeof c === "string") {
        el.append(c);
      } else if ("root" in c) {
        Object.assign(result, c);
        el.appendChild(c.root);
      }
    }
  }
  for (const [key, value] of Object.entries(attributes)) {
    if (key === "className") {
      continue;
    } else if (key === "style") {
      for (const [cssKey, cssValue] of Object.entries(value)) {
        el.style.setProperty(
          camelCaseToHyphenCase(cssKey),
          typeof cssValue === "number" ? cssValue + "px" : "" + cssValue
        );
      }
    } else if (key === "tabIndex") {
      el.tabIndex = value;
    } else {
      el.setAttribute(camelCaseToHyphenCase(key), value.toString());
    }
  }
  result["root"] = el;
  return result;
}
function camelCaseToHyphenCase(str) {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}
function copyAttributes(from, to, filter) {
  for (const { name, value } of from.attributes) {
    if (!filter || filter.includes(name)) {
      to.setAttribute(name, value);
    }
  }
}
function copyAttribute(from, to, name) {
  const value = from.getAttribute(name);
  if (value) {
    to.setAttribute(name, value);
  } else {
    to.removeAttribute(name);
  }
}
function trackAttributes(from, to, filter) {
  copyAttributes(from, to, filter);
  const disposables = new DisposableStore();
  disposables.add(sharedMutationObserver.observe(from, disposables, { attributes: true, attributeFilter: filter })((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && mutation.attributeName) {
        copyAttribute(from, to, mutation.attributeName);
      }
    }
  }));
  return disposables;
}
function isEditableElement(element) {
  return element.tagName.toLowerCase() === "input" || element.tagName.toLowerCase() === "textarea" || isHTMLElement(element) && !!element.editContext;
}
class SafeTriangle {
  constructor(originX, originY, target) {
    this.originX = originX;
    this.originY = originY;
    // 4 points (x, y), 8 length
    this.points = new Int16Array(8);
    const { top, left, right, bottom } = target.getBoundingClientRect();
    const t = this.points;
    let i = 0;
    t[i++] = left;
    t[i++] = top;
    t[i++] = right;
    t[i++] = top;
    t[i++] = left;
    t[i++] = bottom;
    t[i++] = right;
    t[i++] = bottom;
  }
  contains(x, y) {
    const { points, originX, originY } = this;
    for (let i = 0; i < 4; i++) {
      const p1 = 2 * i;
      const p2 = 2 * ((i + 1) % 4);
      if (isPointWithinTriangle(x, y, originX, originY, points[p1], points[p1 + 1], points[p2], points[p2 + 1])) {
        return true;
      }
    }
    return false;
  }
}
var n;
((n2) => {
  function nodeNs(elementNs = void 0) {
    return (tag, attributes, children) => {
      const className = attributes.class;
      delete attributes.class;
      const ref2 = attributes.ref;
      delete attributes.ref;
      const obsRef = attributes.obsRef;
      delete attributes.obsRef;
      return new ObserverNodeWithElement(tag, ref2, obsRef, elementNs, className, attributes, children);
    };
  }
  function node(tag, elementNs = void 0) {
    const f = nodeNs(elementNs);
    return (attributes, children) => {
      return f(tag, attributes, children);
    };
  }
  n2.div = node("div");
  n2.elem = nodeNs(void 0);
  n2.svg = node("svg", "http://www.w3.org/2000/svg");
  n2.svgElem = nodeNs("http://www.w3.org/2000/svg");
  function ref() {
    let value = void 0;
    const result = function(val) {
      value = val;
    };
    Object.defineProperty(result, "element", {
      get() {
        if (!value) {
          throw new BugIndicatingError("Make sure the ref is set before accessing the element. Maybe wrong initialization order?");
        }
        return value;
      }
    });
    return result;
  }
  n2.ref = ref;
})(n || (n = {}));
class ObserverNode {
  constructor(tag, ref, obsRef, ns, className, attributes, children) {
    this._deriveds = [];
    this._isHovered = void 0;
    this._didMouseMoveDuringHover = void 0;
    this._element = ns ? document.createElementNS(ns, tag) : document.createElement(tag);
    if (ref) {
      ref(this._element);
    }
    if (obsRef) {
      this._deriveds.push(derived((_reader) => {
        obsRef(this);
        _reader.store.add({
          dispose: () => {
            obsRef(null);
          }
        });
      }));
    }
    if (className) {
      if (hasObservable(className)) {
        this._deriveds.push(derived(this, (reader) => {
          setClassName(this._element, getClassName(className, reader));
        }));
      } else {
        setClassName(this._element, getClassName(className, void 0));
      }
    }
    for (const [key, value] of Object.entries(attributes)) {
      if (key === "style") {
        for (const [cssKey, cssValue] of Object.entries(value)) {
          const key2 = camelCaseToHyphenCase(cssKey);
          if (isObservable(cssValue)) {
            this._deriveds.push(derivedOpts({ owner: this, debugName: () => `set.style.${key2}` }, (reader) => {
              this._element.style.setProperty(key2, convertCssValue(cssValue.read(reader)));
            }));
          } else {
            this._element.style.setProperty(key2, convertCssValue(cssValue));
          }
        }
      } else if (key === "tabIndex") {
        if (isObservable(value)) {
          this._deriveds.push(derived(this, (reader) => {
            this._element.tabIndex = value.read(reader);
          }));
        } else {
          this._element.tabIndex = value;
        }
      } else if (key.startsWith("on")) {
        this._element[key] = value;
      } else {
        if (isObservable(value)) {
          this._deriveds.push(derivedOpts({ owner: this, debugName: () => `set.${key}` }, (reader) => {
            setOrRemoveAttribute(this._element, key, value.read(reader));
          }));
        } else {
          setOrRemoveAttribute(this._element, key, value);
        }
      }
    }
    if (children) {
      let getChildren = function(reader, children2) {
        if (isObservable(children2)) {
          return getChildren(reader, children2.read(reader));
        }
        if (Array.isArray(children2)) {
          return children2.flatMap((c) => getChildren(reader, c));
        }
        if (children2 instanceof ObserverNode) {
          if (reader) {
            children2.readEffect(reader);
          }
          return [children2._element];
        }
        if (children2) {
          return [children2];
        }
        return [];
      };
      const d = derived(this, (reader) => {
        this._element.replaceChildren(...getChildren(reader, children));
      });
      this._deriveds.push(d);
      if (!childrenIsObservable(children)) {
        d.get();
      }
    }
  }
  readEffect(reader) {
    for (const d of this._deriveds) {
      d.read(reader);
    }
  }
  keepUpdated(store) {
    derived((reader) => {
      this.readEffect(reader);
    }).recomputeInitiallyAndOnChange(store);
    return this;
  }
  /**
   * Creates a live element that will keep the element updated as long as the returned object is not disposed.
  */
  toDisposableLiveElement() {
    const store = new DisposableStore();
    this.keepUpdated(store);
    return new LiveElement(this._element, store);
  }
  get isHovered() {
    if (!this._isHovered) {
      const hovered = observableValue("hovered", false);
      this._element.addEventListener("mouseenter", (_e) => hovered.set(true, void 0));
      this._element.addEventListener("mouseleave", (_e) => hovered.set(false, void 0));
      this._isHovered = hovered;
    }
    return this._isHovered;
  }
  get didMouseMoveDuringHover() {
    if (!this._didMouseMoveDuringHover) {
      let _hovering = false;
      const hovered = observableValue("didMouseMoveDuringHover", false);
      this._element.addEventListener("mouseenter", (_e) => {
        _hovering = true;
      });
      this._element.addEventListener("mousemove", (_e) => {
        if (_hovering) {
          hovered.set(true, void 0);
        }
      });
      this._element.addEventListener("mouseleave", (_e) => {
        _hovering = false;
        hovered.set(false, void 0);
      });
      this._didMouseMoveDuringHover = hovered;
    }
    return this._didMouseMoveDuringHover;
  }
}
function setClassName(domNode, className) {
  if (isSVGElement(domNode)) {
    domNode.setAttribute("class", className);
  } else {
    domNode.className = className;
  }
}
function resolve(value, reader, cb) {
  if (isObservable(value)) {
    cb(value.read(reader));
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) {
      resolve(v, reader, cb);
    }
    return;
  }
  cb(value);
}
function getClassName(className, reader) {
  let result = "";
  resolve(className, reader, (val) => {
    if (val) {
      if (result.length === 0) {
        result = val;
      } else {
        result += " " + val;
      }
    }
  });
  return result;
}
function hasObservable(value) {
  if (isObservable(value)) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some((v) => hasObservable(v));
  }
  return false;
}
function convertCssValue(value) {
  if (typeof value === "number") {
    return value + "px";
  }
  return value;
}
function childrenIsObservable(children) {
  if (isObservable(children)) {
    return true;
  }
  if (Array.isArray(children)) {
    return children.some((c) => childrenIsObservable(c));
  }
  return false;
}
class LiveElement {
  constructor(element, _disposable) {
    this.element = element;
    this._disposable = _disposable;
  }
  dispose() {
    this._disposable.dispose();
  }
}
class ObserverNodeWithElement extends ObserverNode {
  get element() {
    return this._element;
  }
}
function setOrRemoveAttribute(element, key, value) {
  if (value === null || value === void 0) {
    element.removeAttribute(camelCaseToHyphenCase(key));
  } else {
    element.setAttribute(camelCaseToHyphenCase(key), String(value));
  }
}
class ConnectionObserverElement extends HTMLElement {
  disconnectedCallback() {
    this.onDidDisconnect?.();
  }
  connectedCallback() {
    this.onDidConnect?.();
  }
}
if (!customElements.get("connection-observer")) {
  customElements.define("connection-observer", ConnectionObserverElement);
}
export {
  $,
  AnimationFrameScheduler,
  ConnectionObserverElement,
  DetectedFullscreenMode,
  Dimension,
  DisposableResizeObserver,
  DragAndDropObserver,
  EventHelper,
  EventType,
  LiveElement,
  ModifierKeyEmitter,
  Namespace,
  ObserverNode,
  ObserverNodeWithElement,
  SafeTriangle,
  WindowIdleValue,
  WindowIntervalTimer,
  addDisposableGenericMouseDownListener,
  addDisposableGenericMouseMoveListener,
  addDisposableGenericMouseUpListener,
  addDisposableListener,
  addDisposableThrottledListener,
  addStandardDisposableGenericMouseDownListener,
  addStandardDisposableGenericMouseUpListener,
  addStandardDisposableListener,
  after,
  animate,
  append,
  clearNode,
  computeScreenAwareSize,
  copyAttributes,
  createLinkElement,
  createMetaElement,
  detectFullscreen,
  disposableWindowInterval,
  domContentLoaded,
  finalHandler,
  findParentWithClass,
  getActiveDocument,
  getActiveElement,
  getActiveWindow,
  getClientArea,
  getComputedStyle,
  getContentHeight,
  getContentWidth,
  getCookieValue,
  getDocument,
  getDomNodePagePosition,
  getDomNodeZoomLevel,
  getExternalFocusWindow,
  getLargestChildWidth,
  getRecentDisposableResizeObserverContextForLoopError,
  getShadowRoot,
  getTopLeftOffset,
  getTotalHeight,
  getTotalScrollWidth,
  getTotalWidth,
  getWindow,
  getWindowById,
  getWindowId,
  getWindows,
  getWindowsCount,
  h,
  hasAppFocus,
  hasExternalFocus,
  hasParentWithClass,
  hasWindow,
  hide,
  isActiveDocument,
  isActiveElement,
  isAncestor,
  isAncestorOfActiveElement,
  isAncestorUsingFlowTo,
  isDragEvent,
  isEditableElement,
  isEventLike,
  isHTMLAnchorElement,
  isHTMLButtonElement,
  isHTMLDivElement,
  isHTMLElement,
  isHTMLInputElement,
  isHTMLSpanElement,
  isHTMLTextAreaElement,
  isInShadowDOM,
  isKeyboardEvent,
  isMouseEvent,
  isPointerEvent,
  isSVGElement,
  isShadowRoot,
  join,
  measure,
  modify,
  n,
  onDidRegisterWindow,
  onDidUnregisterWindow,
  onWillUnregisterWindow,
  position,
  prepend,
  registerExternalFocusChecker,
  registerWindow,
  removeTabIndexAndUpdateFocus,
  reset,
  restoreParentsScrollTop,
  runAtThisOrScheduleAtNextAnimationFrame,
  runWhenWindowIdle,
  saveParentsScrollTop,
  scheduleAtNextAnimationFrame,
  setParentFlowTo,
  setVisibility,
  sharedMutationObserver,
  show,
  size,
  svgElem,
  trackAttributes,
  trackFocus,
  triggerDownload,
  triggerUpload,
  windowOpenNoOpener,
  windowOpenPopup,
  windowOpenWithSuccess
};
