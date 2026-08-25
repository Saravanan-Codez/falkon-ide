import * as dom from "../../base/browser/dom.js";
import * as domStylesheetsJs from "../../base/browser/domStylesheets.js";
import { GlobalPointerMoveMonitor } from "../../base/browser/globalPointerMoveMonitor.js";
import { StandardMouseEvent } from "../../base/browser/mouseEvent.js";
import { RunOnceScheduler } from "../../base/common/async.js";
import { Disposable, DisposableMap, DisposableStore } from "../../base/common/lifecycle.js";
import { asCssVariable } from "../../platform/theme/common/colorRegistry.js";
class PageCoordinates {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this._pageCoordinatesBrand = void 0;
  }
  toClientCoordinates(targetWindow) {
    return new ClientCoordinates(this.x - targetWindow.scrollX, this.y - targetWindow.scrollY);
  }
}
class ClientCoordinates {
  constructor(clientX, clientY) {
    this.clientX = clientX;
    this.clientY = clientY;
    this._clientCoordinatesBrand = void 0;
  }
  toPageCoordinates(targetWindow) {
    return new PageCoordinates(this.clientX + targetWindow.scrollX, this.clientY + targetWindow.scrollY);
  }
}
class EditorPagePosition {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this._editorPagePositionBrand = void 0;
  }
}
class CoordinatesRelativeToEditor {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this._positionRelativeToEditorBrand = void 0;
  }
}
function createEditorPagePosition(editorViewDomNode) {
  const editorPos = dom.getDomNodePagePosition(editorViewDomNode);
  return new EditorPagePosition(editorPos.left, editorPos.top, editorPos.width, editorPos.height);
}
function createCoordinatesRelativeToEditor(editorViewDomNode, editorPagePosition, pos) {
  const scaleX = editorPagePosition.width / editorViewDomNode.offsetWidth;
  const scaleY = editorPagePosition.height / editorViewDomNode.offsetHeight;
  const relativeX = (pos.x - editorPagePosition.x) / scaleX;
  const relativeY = (pos.y - editorPagePosition.y) / scaleY;
  return new CoordinatesRelativeToEditor(relativeX, relativeY);
}
class EditorMouseEvent extends StandardMouseEvent {
  constructor(e, isFromPointerCapture, editorViewDomNode) {
    super(dom.getWindow(editorViewDomNode), e);
    this._editorMouseEventBrand = void 0;
    this.isFromPointerCapture = isFromPointerCapture;
    this.pos = new PageCoordinates(this.posx, this.posy);
    this._editorViewDomNode = editorViewDomNode;
  }
  /**
   * Editor's coordinates relative to the whole document.
   */
  get editorPos() {
    this._editorPos ??= createEditorPagePosition(this._editorViewDomNode);
    return this._editorPos;
  }
  /**
   * Coordinates relative to the (top;left) of the editor.
   * *NOTE*: These coordinates are preferred because they take into account transformations applied to the editor.
   * *NOTE*: These coordinates could be negative if the mouse position is outside the editor.
  */
  get relativePos() {
    this._relativePos ??= createCoordinatesRelativeToEditor(this._editorViewDomNode, this.editorPos, this.pos);
    return this._relativePos;
  }
}
class EditorMouseEventFactory {
  constructor(editorViewDomNode) {
    this._editorViewDomNode = editorViewDomNode;
  }
  _create(e) {
    return new EditorMouseEvent(e, false, this._editorViewDomNode);
  }
  onContextMenu(target, callback) {
    return dom.addDisposableListener(target, dom.EventType.CONTEXT_MENU, (e) => {
      callback(this._create(e));
    });
  }
  onMouseUp(target, callback) {
    return dom.addDisposableListener(target, dom.EventType.MOUSE_UP, (e) => {
      callback(this._create(e));
    });
  }
  onMouseDown(target, callback) {
    return dom.addDisposableListener(target, dom.EventType.MOUSE_DOWN, (e) => {
      callback(this._create(e));
    });
  }
  onPointerDown(target, callback) {
    return dom.addDisposableListener(target, dom.EventType.POINTER_DOWN, (e) => {
      callback(this._create(e), e.pointerId);
    });
  }
  onMouseLeave(target, callback) {
    return dom.addDisposableListener(target, dom.EventType.MOUSE_LEAVE, (e) => {
      callback(this._create(e));
    });
  }
  onMouseMove(target, callback) {
    return dom.addDisposableListener(target, dom.EventType.MOUSE_MOVE, (e) => callback(this._create(e)));
  }
}
class EditorPointerEventFactory {
  constructor(editorViewDomNode) {
    this._editorViewDomNode = editorViewDomNode;
  }
  _create(e) {
    return new EditorMouseEvent(e, false, this._editorViewDomNode);
  }
  onPointerUp(target, callback) {
    return dom.addDisposableListener(target, "pointerup", (e) => {
      callback(this._create(e));
    });
  }
  onPointerDown(target, callback) {
    return dom.addDisposableListener(target, dom.EventType.POINTER_DOWN, (e) => {
      callback(this._create(e), e.pointerId);
    });
  }
  onPointerLeave(target, callback) {
    return dom.addDisposableListener(target, dom.EventType.POINTER_LEAVE, (e) => {
      callback(this._create(e));
    });
  }
  onPointerMove(target, callback) {
    return dom.addDisposableListener(target, "pointermove", (e) => callback(this._create(e)));
  }
}
class GlobalEditorPointerMoveMonitor extends Disposable {
  constructor(editorViewDomNode) {
    super();
    this._editorViewDomNode = editorViewDomNode;
    this._globalPointerMoveMonitor = this._register(new GlobalPointerMoveMonitor());
    this._keydownListener = null;
  }
  startMonitoring(initialElement, pointerId, initialButtons, pointerMoveCallback, onStopCallback) {
    this._keydownListener = dom.addStandardDisposableListener(initialElement.ownerDocument, "keydown", (e) => {
      const chord = e.toKeyCodeChord();
      if (chord.isModifierKey()) {
        return;
      }
      this._globalPointerMoveMonitor.stopMonitoring(true, e.browserEvent);
    }, true);
    this._globalPointerMoveMonitor.startMonitoring(
      initialElement,
      pointerId,
      initialButtons,
      (e) => {
        pointerMoveCallback(new EditorMouseEvent(e, true, this._editorViewDomNode));
      },
      (e) => {
        this._keydownListener.dispose();
        onStopCallback(e);
      }
    );
  }
  stopMonitoring() {
    this._globalPointerMoveMonitor.stopMonitoring(true);
  }
}
class DynamicCssRules {
  constructor(_editor) {
    this._editor = _editor;
    this._instanceId = ++DynamicCssRules._idPool;
    this._counter = 0;
    this._rules = new DisposableMap();
    // We delay garbage collection so that hanging rules can be reused.
    this._garbageCollectionScheduler = new RunOnceScheduler(() => this.garbageCollect(), 1e3);
  }
  static {
    this._idPool = 0;
  }
  dispose() {
    this._rules.dispose();
    this._garbageCollectionScheduler.dispose();
  }
  createClassNameRef(options) {
    const rule = this.getOrCreateRule(options);
    rule.increaseRefCount();
    return {
      className: rule.className,
      dispose: () => {
        rule.decreaseRefCount();
        this._garbageCollectionScheduler.schedule();
      }
    };
  }
  getOrCreateRule(properties) {
    const key = this.computeUniqueKey(properties);
    let existingRule = this._rules.get(key);
    if (!existingRule) {
      const counter = this._counter++;
      existingRule = new RefCountedCssRule(
        key,
        `dyn-rule-${this._instanceId}-${counter}`,
        dom.isInShadowDOM(this._editor.getContainerDomNode()) ? this._editor.getContainerDomNode() : void 0,
        properties
      );
      this._rules.set(key, existingRule);
    }
    return existingRule;
  }
  computeUniqueKey(properties) {
    return JSON.stringify(properties);
  }
  garbageCollect() {
    for (const rule of this._rules.values()) {
      if (!rule.hasReferences()) {
        this._rules.deleteAndDispose(rule.key);
      }
    }
  }
}
class RefCountedCssRule {
  constructor(key, className, _containerElement, properties) {
    this.key = key;
    this.className = className;
    this.properties = properties;
    this._referenceCount = 0;
    this._styleElementDisposables = new DisposableStore();
    this._styleElement = domStylesheetsJs.createStyleSheet(_containerElement, void 0, this._styleElementDisposables);
    this._styleElement.textContent = this.getCssText(this.className, this.properties);
  }
  getCssText(className, properties) {
    let str = `.${className} {`;
    for (const prop in properties) {
      const value = properties[prop];
      let cssValue;
      if (typeof value === "object") {
        cssValue = asCssVariable(value.id);
      } else {
        cssValue = value;
      }
      const cssPropName = camelToDashes(prop);
      str += `
	${cssPropName}: ${cssValue};`;
    }
    str += `
}`;
    return str;
  }
  dispose() {
    this._styleElementDisposables.dispose();
    this._styleElement = void 0;
  }
  increaseRefCount() {
    this._referenceCount++;
  }
  decreaseRefCount() {
    this._referenceCount--;
  }
  hasReferences() {
    return this._referenceCount > 0;
  }
}
function camelToDashes(str) {
  return str.replace(/(^[A-Z])/, ([first]) => first.toLowerCase()).replace(/([A-Z])/g, ([letter]) => `-${letter.toLowerCase()}`);
}
export {
  ClientCoordinates,
  CoordinatesRelativeToEditor,
  DynamicCssRules,
  EditorMouseEvent,
  EditorMouseEventFactory,
  EditorPagePosition,
  EditorPointerEventFactory,
  GlobalEditorPointerMoveMonitor,
  PageCoordinates,
  createCoordinatesRelativeToEditor,
  createEditorPagePosition
};
