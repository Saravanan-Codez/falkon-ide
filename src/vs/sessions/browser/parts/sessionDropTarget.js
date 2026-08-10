var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import "./media/sessionDropTarget.css";
import { $, addDisposableListener, DragAndDropObserver, EventHelper, EventType, getWindow } from "../../../base/browser/dom.js";
import { RunOnceScheduler } from "../../../base/common/async.js";
import { toDisposable } from "../../../base/common/lifecycle.js";
import { assertReturnsAllDefined, assertReturnsDefined } from "../../../base/common/types.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { LocalSelectionTransfer } from "../../../platform/dnd/browser/dnd.js";
import { activeContrastBorder } from "../../../platform/theme/common/colorRegistry.js";
import { IThemeService, Themable } from "../../../platform/theme/common/themeService.js";
import { EDITOR_DRAG_AND_DROP_BACKGROUND } from "../../../workbench/common/theme.js";
import { DraggedSessionIdentifier } from "../dnd.js";
import { ISessionsManagementService } from "../../services/sessions/common/sessionsManagement.js";
import { ISessionsService } from "../../services/sessions/browser/sessionsService.js";
let SessionDropOverlay = class extends Themable {
  constructor(targetSessionId, _targetElement, themeService, _sessionsManagementService, _sessionsService) {
    super(themeService);
    this.targetSessionId = targetSessionId;
    this._targetElement = _targetElement;
    this._sessionsManagementService = _sessionsManagementService;
    this._sessionsService = _sessionsService;
    this._disposed = false;
    this._sessionTransfer = LocalSelectionTransfer.getInstance();
    this._cleanupOverlayScheduler = this._register(new RunOnceScheduler(() => this.dispose(), 300));
    this._create();
  }
  static {
    this.OVERLAY_ID = "monaco-workbench-session-drop-overlay";
  }
  get disposed() {
    return this._disposed;
  }
  _create() {
    const container = this._container = $("div", { id: SessionDropOverlay.OVERLAY_ID });
    this._targetElement.appendChild(container);
    this._targetElement.classList.add("dragged-over");
    this._register(toDisposable(() => {
      container.remove();
      this._targetElement.classList.remove("dragged-over");
    }));
    this._overlay = $(".session-drop-overlay-indicator");
    container.appendChild(this._overlay);
    this._registerListeners(container);
    this.updateStyles();
  }
  updateStyles() {
    const overlay = assertReturnsDefined(this._overlay);
    overlay.style.backgroundColor = this.getColor(EDITOR_DRAG_AND_DROP_BACKGROUND) || "";
    const activeContrastBorderColor = this.getColor(activeContrastBorder);
    overlay.style.outlineColor = activeContrastBorderColor || "";
    overlay.style.outlineOffset = activeContrastBorderColor ? "-2px" : "";
    overlay.style.outlineStyle = activeContrastBorderColor ? "dashed" : "";
    overlay.style.outlineWidth = activeContrastBorderColor ? "2px" : "";
  }
  _registerListeners(container) {
    this._register(new DragAndDropObserver(container, {
      onDragOver: (e) => {
        if (!this._sessionTransfer.hasData(DraggedSessionIdentifier.prototype)) {
          this._hideOverlay();
          return;
        }
        this._positionOverlay(e.offsetX);
        if (this._cleanupOverlayScheduler.isScheduled()) {
          this._cleanupOverlayScheduler.cancel();
        }
      },
      onDragLeave: () => this.dispose(),
      onDragEnd: () => this.dispose(),
      onDrop: (e) => {
        EventHelper.stop(e, true);
        const side = this._currentSide;
        this.dispose();
        if (side) {
          this._handleDrop(side);
        }
      }
    }));
    this._register(addDisposableListener(container, EventType.MOUSE_OVER, () => {
      if (!this._cleanupOverlayScheduler.isScheduled()) {
        this._cleanupOverlayScheduler.schedule();
      }
    }));
  }
  _handleDrop(side) {
    const data = this._sessionTransfer.getData(DraggedSessionIdentifier.prototype);
    this._sessionTransfer.clearData(DraggedSessionIdentifier.prototype);
    if (!Array.isArray(data) || data.length === 0) {
      return;
    }
    const sessions = [];
    for (const dragged of data) {
      if (dragged.sessionId === this.targetSessionId) {
        continue;
      }
      const session = this._sessionsManagementService.getSession(dragged.resource);
      if (session) {
        sessions.push(session);
      }
    }
    if (sessions.length === 0) {
      return;
    }
    const primary = sessions[0];
    const ordered = side === "right" ? [...sessions].reverse() : sessions;
    for (const session of ordered) {
      this._sessionsService.insertAt(session, this.targetSessionId, side, session === primary);
    }
  }
  _positionOverlay(mousePosX) {
    const width = this._targetElement.clientWidth;
    const side = mousePosX < width / 2 ? "left" : "right";
    if (side === "left") {
      this._doPositionOverlay({ left: "0", width: "50%" });
    } else {
      this._doPositionOverlay({ left: "50%", width: "50%" });
    }
    const overlay = assertReturnsDefined(this._overlay);
    overlay.style.opacity = "1";
    setTimeout(() => overlay.classList.add("overlay-move-transition"), 0);
    this._currentSide = side;
  }
  _doPositionOverlay(options) {
    const [container, overlay] = assertReturnsAllDefined(this._container, this._overlay);
    container.style.height = "100%";
    overlay.style.top = "0";
    overlay.style.height = "100%";
    overlay.style.left = options.left;
    overlay.style.width = options.width;
  }
  _hideOverlay() {
    const overlay = assertReturnsDefined(this._overlay);
    this._doPositionOverlay({ left: "0", width: "100%" });
    overlay.style.opacity = "0";
    overlay.classList.remove("overlay-move-transition");
    this._currentSide = void 0;
  }
  contains(element) {
    return element === this._container || element === this._overlay;
  }
  dispose() {
    super.dispose();
    this._disposed = true;
  }
};
SessionDropOverlay = __decorateClass([
  __decorateParam(2, IThemeService),
  __decorateParam(3, ISessionsManagementService),
  __decorateParam(4, ISessionsService)
], SessionDropOverlay);
let SessionDropTarget = class extends Themable {
  constructor(_container, _delegate, themeService, _instantiationService) {
    super(themeService);
    this._container = _container;
    this._delegate = _delegate;
    this._instantiationService = _instantiationService;
    this._counter = 0;
    this._sessionTransfer = LocalSelectionTransfer.getInstance();
    this._registerListeners();
  }
  get overlay() {
    if (this._overlay && !this._overlay.disposed) {
      return this._overlay;
    }
    return void 0;
  }
  _registerListeners() {
    this._register(addDisposableListener(this._container, EventType.DRAG_ENTER, (e) => this._onDragEnter(e)));
    this._register(addDisposableListener(this._container, EventType.DRAG_LEAVE, () => this._onDragLeave()));
    for (const target of [this._container, getWindow(this._container)]) {
      this._register(addDisposableListener(target, EventType.DRAG_END, () => this._onDragEnd()));
    }
  }
  _onDragEnter(event) {
    this._counter++;
    if (!this._sessionTransfer.hasData(DraggedSessionIdentifier.prototype)) {
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "none";
      }
      return;
    }
    this._updateContainer(true);
    const target = event.target;
    if (!target) {
      return;
    }
    if (this.overlay && !this.overlay.contains(target)) {
      this._disposeOverlay();
    }
    if (this.overlay) {
      return;
    }
    const targetView = this._delegate.findTargetView(target);
    if (!targetView) {
      return;
    }
    this._overlay = this._instantiationService.createInstance(
      SessionDropOverlay,
      targetView.sessionId,
      targetView.element
    );
  }
  _onDragLeave() {
    this._counter--;
    if (this._counter === 0) {
      this._updateContainer(false);
    }
  }
  _onDragEnd() {
    this._counter = 0;
    this._updateContainer(false);
    this._disposeOverlay();
  }
  _updateContainer(isDraggedOver) {
    this._container.classList.toggle("dragged-over", isDraggedOver);
  }
  dispose() {
    super.dispose();
    this._disposeOverlay();
  }
  _disposeOverlay() {
    if (this._overlay) {
      this._overlay.dispose();
      this._overlay = void 0;
    }
  }
};
SessionDropTarget = __decorateClass([
  __decorateParam(2, IThemeService),
  __decorateParam(3, IInstantiationService)
], SessionDropTarget);
export {
  SessionDropTarget
};
