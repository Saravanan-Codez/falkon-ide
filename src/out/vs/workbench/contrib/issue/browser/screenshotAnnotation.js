import { $, addDisposableListener, append, EventType, getWindow } from "../../../../base/browser/dom.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { renderIcon } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Emitter } from "../../../../base/common/event.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { defaultButtonStyles } from "../../../../platform/theme/browser/defaultStyles.js";
var AnnotationTool = /* @__PURE__ */ ((AnnotationTool2) => {
  AnnotationTool2["Select"] = "select";
  AnnotationTool2["Freehand"] = "freehand";
  AnnotationTool2["Rectangle"] = "rectangle";
  AnnotationTool2["Ellipse"] = "ellipse";
  AnnotationTool2["Arrow"] = "arrow";
  AnnotationTool2["Text"] = "text";
  AnnotationTool2["Eraser"] = "eraser";
  AnnotationTool2["Pan"] = "pan";
  AnnotationTool2["Crop"] = "crop";
  AnnotationTool2["Move"] = "move";
  return AnnotationTool2;
})(AnnotationTool || {});
const COLORS = [
  "#ff3b30",
  // red
  "#007aff",
  // blue
  "#34c759",
  // green
  "#ffcc00",
  // yellow
  "#000000",
  // black
  "#ffffff"
  // white
];
const LIGHT_SWATCH_COLORS = /* @__PURE__ */ new Set(["#34c759", "#ffcc00", "#ffffff", "transparent"]);
const FONT_FAMILIES = [
  { label: "Sans-serif", value: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { label: "Monospace", value: '"Cascadia Code", "Fira Code", Consolas, monospace' },
  { label: "Serif", value: 'Georgia, "Times New Roman", serif' }
];
const DEFAULT_TEXT_BOX_WIDTH = 240;
const MIN_TEXT_BOX_WIDTH = 48;
const TEXT_DRAG_THRESHOLD = 4;
const CANVAS_BREATHING_ROOM = 64;
const FILL_COLORS = ["transparent", ...COLORS];
const STROKE_WIDTHS = [2, 4, 8, 12];
const TEXT_SIZES = [14, 18, 24, 32, 48];
function cloneDrawAction(action, identityMap = /* @__PURE__ */ new Map()) {
  const existing = identityMap.get(action);
  if (existing) {
    return existing;
  }
  const clone = {
    type: action.type,
    strokeColor: action.strokeColor,
    fillColor: action.fillColor,
    opacity: action.opacity,
    lineWidth: action.lineWidth,
    fontSize: action.fontSize,
    fontFamily: action.fontFamily,
    points: action.points ? action.points.map((p) => ({ x: p.x, y: p.y })) : void 0,
    rect: action.rect ? { ...action.rect } : void 0,
    ellipseRect: action.ellipseRect ? { ...action.ellipseRect } : void 0,
    arrowStart: action.arrowStart ? { ...action.arrowStart } : void 0,
    arrowEnd: action.arrowEnd ? { ...action.arrowEnd } : void 0,
    text: action.text,
    textPos: action.textPos ? { ...action.textPos } : void 0,
    textWidth: action.textWidth,
    cropFrom: action.cropFrom === void 0 ? void 0 : action.cropFrom === null ? null : { ...action.cropFrom },
    cropTo: action.cropTo === void 0 ? void 0 : action.cropTo === null ? null : { ...action.cropTo },
    moveBefore: action.moveBefore ? cloneMoveSnapshot(action.moveBefore) : void 0,
    moveAfter: action.moveAfter ? cloneMoveSnapshot(action.moveAfter) : void 0
  };
  identityMap.set(action, clone);
  clone.erasedActions = action.erasedActions ? action.erasedActions.map((a) => cloneDrawAction(a, identityMap)) : void 0;
  clone.erasedIndices = action.erasedIndices ? action.erasedIndices.slice() : void 0;
  clone.moveTarget = action.moveTarget ? cloneDrawAction(action.moveTarget, identityMap) : void 0;
  return clone;
}
function cloneMoveSnapshot(s) {
  return {
    points: s.points ? s.points.map((p) => ({ x: p.x, y: p.y })) : void 0,
    rect: s.rect ? { ...s.rect } : void 0,
    ellipseRect: s.ellipseRect ? { ...s.ellipseRect } : void 0,
    arrowStart: s.arrowStart ? { ...s.arrowStart } : void 0,
    arrowEnd: s.arrowEnd ? { ...s.arrowEnd } : void 0,
    textPos: s.textPos ? { ...s.textPos } : void 0,
    textWidth: s.textWidth
  };
}
function captureMoveSnapshot(action) {
  return cloneMoveSnapshot({
    points: action.points,
    rect: action.rect,
    ellipseRect: action.ellipseRect,
    arrowStart: action.arrowStart,
    arrowEnd: action.arrowEnd,
    textPos: action.textPos,
    textWidth: action.textWidth
  });
}
function applyMoveSnapshot(action, snapshot) {
  const fresh = cloneMoveSnapshot(snapshot);
  action.points = fresh.points;
  action.rect = fresh.rect;
  action.ellipseRect = fresh.ellipseRect;
  action.arrowStart = fresh.arrowStart;
  action.arrowEnd = fresh.arrowEnd;
  action.textPos = fresh.textPos;
  action.textWidth = fresh.textWidth;
}
function moveSnapshotsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
class ScreenshotAnnotationEditor {
  constructor(screenshot, parentElement, initialState) {
    this.screenshot = screenshot;
    this.parentElement = parentElement;
    this.initialState = initialState;
    this.disposables = new DisposableStore();
    this.toolOptionsDisposables = new DisposableStore();
    this._onDidSave = new Emitter();
    this.onDidSave = this._onDidSave.event;
    this._onDidCancel = new Emitter();
    this.onDidCancel = this._onDidCancel.event;
    this.activeTool = "freehand" /* Freehand */;
    this.activeStrokeColor = COLORS[0];
    this.activeFillColor = "transparent";
    this.activeLineWidth = 4;
    this.activeOpacity = 1;
    this.actions = [];
    this.undoneActions = [];
    this.currentAction = null;
    this.isDrawing = false;
    this.isErasing = false;
    /** Actions erased during the current pointer drag; committed to undo stack on pointer-up. */
    this.pendingEraseActions = [];
    /** Original index (in `actions[]`) of each entry in `pendingEraseActions`, captured at the moment it was removed. */
    this.pendingEraseIndices = [];
    this.imageElement = null;
    this.imageWidth = 0;
    this.imageHeight = 0;
    this.scale = 1;
    // Pan & zoom
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this.lastPanPoint = { x: 0, y: 0 };
    // Crop with handles
    this.cropMode = false;
    this.cropRegion = null;
    this.cropDragHandle = null;
    this.cropDragStart = { x: 0, y: 0 };
    this.cropRegionStart = null;
    this.hasUserZoomed = false;
    /** Pending wheel-zoom delta accumulated across rapid wheel events; flushed on rAF. */
    this.pendingZoom = null;
    this.pendingZoomRaf = 0;
    // Original image preserved so crops can be expanded back
    this.originalImage = null;
    // Current crop region in original-image coords (null = no crop applied)
    this.currentCrop = null;
    // Pre-crop state restored on Cancel
    this.preCropState = null;
    this.mainToolbar = null;
    this.cropToolbar = null;
    // Selection (Select tool)
    this.selectedActionIndex = -1;
    this.isDraggingSelected = false;
    this.isResizingSelectedText = false;
    this.dragStart = { x: 0, y: 0 };
    this.selectedTextResizeStartWidth = DEFAULT_TEXT_BOX_WIDTH;
    /** Captured at the start of a Select-tool drag/resize so a Move sentinel can be committed on pointer-up. */
    this.pendingMove = null;
    // Text configuration
    this.activeFontSize = 18;
    this.activeFontFamily = FONT_FAMILIES[0].value;
    this.textPlacementState = null;
    this.textEditState = null;
    this.textEditor = null;
    this.textCaretVisible = true;
    this.textCaretInterval = null;
    // Tool buttons (for active state management)
    this.toolButtons = [];
    this.undoBtn = null;
    this.redoBtn = null;
    this.toolOptionsPopover = null;
    this.createUI();
    this.loadImage();
  }
  /** Annotations are stored in original-image coords. While in crop mode the canvas already shows the original image, so the offset is 0. */
  get cropOffsetX() {
    return this.cropMode ? 0 : this.currentCrop?.x ?? 0;
  }
  get cropOffsetY() {
    return this.cropMode ? 0 : this.currentCrop?.y ?? 0;
  }
  createUI() {
    this.container = append(this.parentElement, $("div.issue-reporter-annotation-overlay"));
    this.container.tabIndex = -1;
    const toolbar = append(this.container, $("div.annotation-toolbar"));
    this.mainToolbar = toolbar;
    const drawingTools = [
      { tool: "select" /* Select */, label: localize("select", "Select / Move"), icon: renderIcon(Codicon.inspect) },
      { tool: "pan" /* Pan */, label: localize("pan", "Pan"), icon: renderIcon(Codicon.move) }
    ];
    for (const { tool, label, icon } of drawingTools) {
      this.addToolButton(toolbar, tool, label, icon);
    }
    const cropBtn = append(toolbar, $("button.tool-btn.crop-btn"));
    cropBtn.appendChild(renderIcon(Codicon.screenCut));
    cropBtn.title = localize("crop", "Crop");
    cropBtn.setAttribute("aria-label", localize("crop", "Crop"));
    this.toolButtons.push({ element: cropBtn, tool: "crop" /* Crop */ });
    this.disposables.add(addDisposableListener(cropBtn, EventType.CLICK, () => {
      this.setActiveTool("crop" /* Crop */);
    }));
    const moreDrawingTools = [
      { tool: "freehand" /* Freehand */, label: localize("freehand", "Draw"), icon: renderIcon(Codicon.edit) },
      { tool: "rectangle" /* Rectangle */, label: localize("rectangle", "Rectangle"), icon: renderIcon(Codicon.primitiveSquare) },
      { tool: "ellipse" /* Ellipse */, label: localize("ellipse", "Ellipse"), icon: renderIcon(Codicon.circle) },
      { tool: "arrow" /* Arrow */, label: localize("arrow", "Arrow"), icon: renderIcon(Codicon.arrowRight) },
      { tool: "eraser" /* Eraser */, label: localize("eraser", "Eraser"), icon: renderIcon(Codicon.eraser) }
    ];
    for (const { tool, label, icon } of moreDrawingTools) {
      this.addToolButton(toolbar, tool, label, icon);
    }
    this.addToolButton(toolbar, "text" /* Text */, localize("text", "Text"), renderIcon(Codicon.symbolString));
    this.toolOptionsPopover = append(this.container, $("div.annotation-tool-options-popover"));
    this.toolOptionsPopover.style.display = "none";
    this.disposables.add(addDisposableListener(this.container, EventType.CLICK, (e) => {
      if (!this.toolOptionsPopover || this.toolOptionsPopover.style.display === "none") {
        return;
      }
      const target = e.target;
      if (!this.toolOptionsPopover.contains(target) && !this.toolButtons.some((button) => button.element.contains(target))) {
        this.hideToolOptions();
      }
    }));
    this.renderToolOptions();
    append(toolbar, $("div.toolbar-separator"));
    const undoBtn = append(toolbar, $("button.tool-btn"));
    undoBtn.appendChild(renderIcon(Codicon.discard));
    undoBtn.title = localize("undo", "Undo");
    undoBtn.setAttribute("aria-label", localize("undo", "Undo"));
    this.disposables.add(addDisposableListener(undoBtn, EventType.CLICK, () => this.undo()));
    this.undoBtn = undoBtn;
    const redoBtn = append(toolbar, $("button.tool-btn"));
    redoBtn.appendChild(renderIcon(Codicon.redo));
    redoBtn.title = localize("redo", "Redo");
    redoBtn.setAttribute("aria-label", localize("redo", "Redo"));
    this.disposables.add(addDisposableListener(redoBtn, EventType.CLICK, () => this.redo()));
    this.redoBtn = redoBtn;
    this.updateUndoRedoState();
    append(toolbar, $("div.toolbar-separator"));
    const discardBtn = this.disposables.add(new Button(toolbar, { ...defaultButtonStyles, secondary: true }));
    discardBtn.label = localize("discard", "Discard");
    this.disposables.add(discardBtn.onDidClick(() => {
      this.cancelTextEdit();
      this._onDidCancel.fire();
      this.dispose();
    }));
    const saveBtn = this.disposables.add(new Button(toolbar, defaultButtonStyles));
    saveBtn.label = localize("save", "Save");
    this.disposables.add(saveBtn.onDidClick(() => {
      this.commitTextEdit();
      const dataUrl = this.compositeToDataUrl();
      this._onDidSave.fire({ dataUrl, state: this.captureState() });
      this.dispose();
    }));
    const cropToolbar = append(this.container, $("div.annotation-toolbar.annotation-crop-toolbar"));
    cropToolbar.style.display = "none";
    this.cropToolbar = cropToolbar;
    const cropCancelBtn = this.disposables.add(new Button(cropToolbar, { ...defaultButtonStyles, secondary: true }));
    cropCancelBtn.label = localize("cancel", "Cancel");
    this.disposables.add(cropCancelBtn.onDidClick(() => {
      this.cancelCrop();
    }));
    const cropApplyBtn = this.disposables.add(new Button(cropToolbar, defaultButtonStyles));
    cropApplyBtn.label = localize("apply", "Apply");
    this.disposables.add(cropApplyBtn.onDidClick(() => {
      this.commitCrop();
    }));
    const hint = append(this.container, $("div.annotation-hint"));
    hint.textContent = localize("annotationHint", "Edit screenshot to highlight the problem");
    const canvasContainer = append(this.container, $("div.annotation-canvas-container"));
    this.canvas = append(canvasContainer, $("canvas"));
    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D canvas context");
    }
    this.ctx = ctx;
    this.disposables.add(addDisposableListener(this.canvas, EventType.POINTER_DOWN, (e) => this.onPointerDown(e)));
    this.disposables.add(addDisposableListener(this.canvas, EventType.POINTER_MOVE, (e) => this.onPointerMove(e)));
    this.disposables.add(addDisposableListener(this.canvas, EventType.POINTER_UP, (e) => this.onPointerUp(e)));
    this.disposables.add(addDisposableListener(this.canvas, EventType.DBLCLICK, () => {
      this.commitCrop();
    }));
    this.disposables.add(addDisposableListener(canvasContainer, EventType.WHEEL, (e) => {
      e.preventDefault();
      if (e.ctrlKey) {
        const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
        const factor = delta < 0 ? 1.1 : 0.9;
        const containerRect = canvasContainer.getBoundingClientRect();
        const cx = e.clientX - (containerRect.left + containerRect.width / 2);
        const cy = e.clientY - (containerRect.top + containerRect.height / 2);
        if (this.pendingZoom) {
          this.pendingZoom.factor *= factor;
          this.pendingZoom.cx = cx;
          this.pendingZoom.cy = cy;
        } else {
          this.pendingZoom = { factor, cx, cy };
        }
        if (!this.pendingZoomRaf) {
          const targetWindow = getWindow(this.canvas);
          this.pendingZoomRaf = targetWindow.requestAnimationFrame(() => {
            this.pendingZoomRaf = 0;
            this.flushPendingZoom();
          });
        }
      } else {
        this.panX -= e.deltaX;
        this.panY -= e.deltaY;
        this.clampPan();
        this.canvas.style.transform = `translate(${this.panX}px, ${this.panY}px)`;
      }
    }, { passive: false }));
    this.disposables.add(addDisposableListener(this.container, EventType.KEY_DOWN, (e) => {
      if (this.textEditState) {
        return;
      }
      if (this.textPlacementState && e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        this.cancelTextPlacement();
        return;
      }
      if (e.key === "Escape") {
        if (this.cropMode) {
          e.preventDefault();
          e.stopPropagation();
          this.cancelCrop();
          return;
        }
        if (this.selectedActionIndex >= 0) {
          this.selectedActionIndex = -1;
          this.redraw();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        this._onDidCancel.fire();
        this.dispose();
      } else if (e.key === "Enter" && this.cropMode) {
        e.preventDefault();
        this.commitCrop();
      } else if ((e.key === "Delete" || e.key === "Backspace") && this.selectedActionIndex >= 0) {
        e.preventDefault();
        const removedIndex = this.selectedActionIndex;
        const [removed] = this.actions.splice(removedIndex, 1);
        this.selectedActionIndex = -1;
        this.actions.push({
          type: "eraser" /* Eraser */,
          strokeColor: "",
          opacity: 1,
          lineWidth: 0,
          erasedActions: [removed],
          erasedIndices: [removedIndex]
        });
        this.undoneActions.length = 0;
        this.updateUndoRedoState();
        this.redraw();
      }
    }));
    const resizeObserver = new ResizeObserver(() => {
      if (this.imageElement) {
        if (this.hasUserZoomed) {
          const minScale = this.getFitScale();
          if (this.scale < minScale) {
            this.scale = minScale;
          }
        }
        this.sizeCanvas();
        this.clampPan();
        this.canvas.style.transform = `translate(${this.panX}px, ${this.panY}px)`;
        this.redraw();
      }
    });
    resizeObserver.observe(canvasContainer);
    this.disposables.add({ dispose: () => resizeObserver.disconnect() });
  }
  addToolButton(toolbar, tool, label, icon) {
    const btn = append(toolbar, $("button.tool-btn"));
    btn.appendChild(icon);
    btn.title = label;
    btn.setAttribute("aria-label", label);
    btn.setAttribute("aria-pressed", String(tool === this.activeTool));
    if (tool === this.activeTool) {
      btn.classList.add("active");
    }
    this.toolButtons.push({ element: btn, tool });
    this.disposables.add(addDisposableListener(btn, EventType.CLICK, (e) => {
      e.stopPropagation();
      this.setActiveTool(tool);
    }));
  }
  renderToolOptions() {
    if (!this.toolOptionsPopover) {
      return;
    }
    this.toolOptionsDisposables.clear();
    this.toolOptionsPopover.textContent = "";
    this.toolOptionsPopover.setAttribute("role", "group");
    this.toolOptionsPopover.setAttribute("aria-label", localize("toolOptions", "Tool Options"));
    this.appendColorOptions(
      this.toolOptionsPopover,
      this.activeTool === "text" /* Text */ ? localize("textColor", "Text Color") : localize("strokeColor", "Stroke Color"),
      COLORS,
      this.activeStrokeColor,
      localize("setStrokeColor", "Set Stroke Color"),
      (color) => {
        this.activeStrokeColor = color;
        this.applyToolOptionsToTextEdit();
      }
    );
    if (this.activeTool !== "freehand" /* Freehand */ && this.activeTool !== "arrow" /* Arrow */) {
      this.appendColorOptions(
        this.toolOptionsPopover,
        this.activeTool === "text" /* Text */ ? localize("textBackgroundColor", "Background Color") : localize("fillColor", "Fill Color"),
        FILL_COLORS,
        this.activeFillColor,
        localize("setFillColor", "Set Fill Color"),
        (color) => {
          this.activeFillColor = color;
          this.applyToolOptionsToTextEdit();
        }
      );
    }
    this.appendSizeOptions(this.toolOptionsPopover);
    this.appendOpacityOptions(this.toolOptionsPopover);
  }
  appendColorOptions(container, label, colors, selectedColor, ariaLabelPrefix, onSelect) {
    const group = append(container, $("div.annotation-tool-options-group"));
    append(group, $("span.annotation-tool-options-label")).textContent = label;
    const swatches = append(group, $("div.annotation-color-swatches"));
    for (const color of colors) {
      const swatch = append(swatches, $("button.annotation-color-swatch"));
      const isTransparent = color === "transparent";
      swatch.classList.toggle("transparent", isTransparent);
      swatch.classList.toggle("light-swatch", LIGHT_SWATCH_COLORS.has(color));
      swatch.style.backgroundColor = isTransparent ? "transparent" : color;
      swatch.setAttribute("aria-label", isTransparent ? localize("transparentColor", "{0}: Transparent", ariaLabelPrefix) : localize("colorValue", "{0}: {1}", ariaLabelPrefix, color));
      swatch.setAttribute("aria-pressed", String(color === selectedColor));
      swatch.classList.toggle("active", color === selectedColor);
      this.toolOptionsDisposables.add(addDisposableListener(swatch, EventType.CLICK, (e) => {
        e.stopPropagation();
        onSelect(color);
        this.renderToolOptions();
        this.redraw();
      }));
    }
  }
  appendSizeOptions(container) {
    const isText = this.activeTool === "text" /* Text */;
    const values = isText ? TEXT_SIZES : STROKE_WIDTHS;
    const selectedValue = isText ? this.activeFontSize : this.activeLineWidth;
    const group = append(container, $("div.annotation-tool-options-group"));
    append(group, $("span.annotation-tool-options-label")).textContent = isText ? localize("textSize", "Text Size") : localize("strokeWidth", "Stroke Width");
    const buttons = append(group, $("div.annotation-size-buttons"));
    for (const value of values) {
      const button = append(buttons, $("button.annotation-size-button"));
      button.textContent = `${value}`;
      button.setAttribute("aria-label", isText ? localize("setTextSize", "Set Text Size to {0}px", value) : localize("setStrokeWidth", "Set Stroke Width to {0}px", value));
      button.setAttribute("aria-pressed", String(value === selectedValue));
      button.classList.toggle("active", value === selectedValue);
      this.toolOptionsDisposables.add(addDisposableListener(button, EventType.CLICK, (e) => {
        e.stopPropagation();
        if (isText) {
          this.activeFontSize = value;
        } else {
          this.activeLineWidth = value;
        }
        this.applyToolOptionsToTextEdit();
        this.renderToolOptions();
        this.redraw();
      }));
    }
  }
  appendOpacityOptions(container) {
    const group = append(container, $("div.annotation-tool-options-group.annotation-opacity-options"));
    const label = append(group, $("label.annotation-tool-options-label"));
    label.textContent = localize("opacity", "Opacity");
    const input = append(group, $("input.annotation-opacity-slider"));
    input.type = "range";
    input.min = "20";
    input.max = "100";
    input.step = "10";
    input.value = `${Math.round(this.activeOpacity * 100)}`;
    input.setAttribute("aria-label", localize("setOpacity", "Set Opacity"));
    const value = append(group, $("span.annotation-opacity-value"));
    value.textContent = `${input.value}%`;
    this.toolOptionsDisposables.add(addDisposableListener(input, EventType.INPUT, (e) => {
      e.stopPropagation();
      this.activeOpacity = Number(input.value) / 100;
      value.textContent = `${input.value}%`;
      this.applyToolOptionsToTextEdit();
      this.redraw();
    }));
  }
  applyToolOptionsToTextEdit() {
    if (!this.textEditState) {
      return;
    }
    this.textEditState.strokeColor = this.activeStrokeColor;
    this.textEditState.fillColor = this.activeFillColor;
    this.textEditState.opacity = this.activeOpacity;
    this.textEditState.fontSize = this.activeFontSize;
  }
  showToolOptions(anchor) {
    if (!this.toolOptionsPopover || !this.hasToolOptions(this.activeTool)) {
      this.hideToolOptions();
      return;
    }
    this.renderToolOptions();
    const containerRect = this.container.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    this.toolOptionsPopover.style.top = `${anchorRect.bottom - containerRect.top + 6}px`;
    this.toolOptionsPopover.style.display = "flex";
    const halfWidth = this.toolOptionsPopover.offsetWidth / 2;
    const desiredLeft = anchorRect.left + anchorRect.width / 2 - containerRect.left;
    const minLeft = halfWidth + 8;
    const maxLeft = Math.max(minLeft, containerRect.width - halfWidth - 8);
    this.toolOptionsPopover.style.left = `${Math.min(Math.max(desiredLeft, minLeft), maxLeft)}px`;
  }
  hideToolOptions() {
    if (this.toolOptionsPopover) {
      this.toolOptionsPopover.style.display = "none";
    }
  }
  hasToolOptions(tool) {
    return tool === "freehand" /* Freehand */ || tool === "rectangle" /* Rectangle */ || tool === "ellipse" /* Ellipse */ || tool === "arrow" /* Arrow */ || tool === "text" /* Text */;
  }
  setActiveTool(tool) {
    if (this.textEditState && tool !== "text" /* Text */) {
      this.commitTextEdit();
    }
    if (this.textPlacementState && tool !== "text" /* Text */) {
      this.cancelTextPlacement();
    }
    if (tool === "crop" /* Crop */) {
      this.hideToolOptions();
      this.enterCropMode();
      return;
    }
    this.activeTool = tool;
    this.selectedActionIndex = -1;
    for (const tb of this.toolButtons) {
      tb.element.classList.toggle("active", tb.tool === tool);
      tb.element.setAttribute("aria-pressed", String(tb.tool === tool));
    }
    const activeToolButton = this.toolButtons.find((tb) => tb.tool === tool)?.element;
    if (activeToolButton && this.hasToolOptions(tool)) {
      this.showToolOptions(activeToolButton);
    } else {
      this.hideToolOptions();
    }
    this.canvas.style.cursor = tool === "select" /* Select */ ? "default" : tool === "pan" /* Pan */ ? "grab" : tool === "eraser" /* Eraser */ ? `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewport='0 0 24 24'><circle cx='12' cy='12' r='9' fill='none' stroke='%23fff' stroke-width='2'/><circle cx='12' cy='12' r='9' fill='none' stroke='%23000' stroke-width='1' stroke-dasharray='2 2'/></svg>") 12 12, cell` : "crosshair";
    this.redraw();
  }
  enterCropMode() {
    if (this.cropMode || !this.originalImage) {
      return;
    }
    this.preCropState = {
      element: this.imageElement,
      width: this.imageWidth,
      height: this.imageHeight,
      currentCrop: this.currentCrop
    };
    this.imageElement = this.originalImage.element;
    this.imageWidth = this.originalImage.width;
    this.imageHeight = this.originalImage.height;
    this.cropRegion = this.currentCrop ? { ...this.currentCrop } : { x: 0, y: 0, width: this.originalImage.width, height: this.originalImage.height };
    this.cropMode = true;
    for (const tb of this.toolButtons) {
      tb.element.classList.toggle("active", tb.tool === "crop" /* Crop */);
    }
    if (this.mainToolbar) {
      this.mainToolbar.style.display = "none";
    }
    if (this.cropToolbar) {
      this.cropToolbar.style.display = "";
    }
    this.hasUserZoomed = false;
    this.panX = 0;
    this.panY = 0;
    this.canvas.style.transform = "";
    this.canvas.style.cursor = "default";
    this.sizeCanvas();
    this.redraw();
  }
  exitCropMode() {
    this.cropMode = false;
    this.cropRegion = null;
    this.cropDragHandle = null;
    this.cropRegionStart = null;
    this.preCropState = null;
    if (this.mainToolbar) {
      this.mainToolbar.style.display = "";
    }
    if (this.cropToolbar) {
      this.cropToolbar.style.display = "none";
    }
    this.setActiveTool(this.activeTool);
  }
  commitCrop() {
    if (!this.cropMode || !this.cropRegion || !this.originalImage) {
      return;
    }
    const cr = this.normalizeCropRect(this.cropRegion);
    if (cr.width < 10 || cr.height < 10) {
      return;
    }
    const cropFrom = this.preCropState?.currentCrop ?? null;
    const cropAction = {
      type: "crop" /* Crop */,
      strokeColor: "",
      opacity: 1,
      lineWidth: 0,
      cropFrom,
      cropTo: cr
    };
    this.actions.push(cropAction);
    this.undoneActions.length = 0;
    this.updateUndoRedoState();
    this.hasUserZoomed = false;
    this.panX = 0;
    this.panY = 0;
    this.canvas.style.transform = "";
    this.exitCropMode();
    this.applyDisplayedCrop(cr);
  }
  cancelCrop() {
    if (!this.cropMode || !this.preCropState) {
      this.exitCropMode();
      return;
    }
    this.imageElement = this.preCropState.element;
    this.imageWidth = this.preCropState.width;
    this.imageHeight = this.preCropState.height;
    this.currentCrop = this.preCropState.currentCrop;
    this.hasUserZoomed = false;
    this.panX = 0;
    this.panY = 0;
    this.canvas.style.transform = "";
    this.exitCropMode();
    this.sizeCanvas();
    this.redraw();
  }
  loadImage() {
    const img = mainWindow.document.createElement("img");
    img.onload = () => {
      this.imageElement = img;
      this.imageWidth = img.naturalWidth;
      this.imageHeight = img.naturalHeight;
      this.originalImage = { element: img, width: img.naturalWidth, height: img.naturalHeight };
      this.currentCrop = null;
      if (this.initialState && (this.initialState.actions.length || this.initialState.undoneActions.length)) {
        const identityMap = /* @__PURE__ */ new Map();
        this.actions.push(...this.initialState.actions.map((a) => cloneDrawAction(a, identityMap)));
        this.undoneActions.push(...this.initialState.undoneActions.map((a) => cloneDrawAction(a, identityMap)));
        this.updateUndoRedoState();
      }
      this.applyDisplayedCrop(this.initialState?.crop ?? null);
    };
    img.src = this.screenshot.dataUrl;
  }
  /**
   * Update the displayed image to reflect the given crop (or the full original
   * when null). Cropped images are re-rasterized from the preserved original so
   * undo/redo of crop actions is fully reversible without keeping intermediate
   * image elements around.
   */
  applyDisplayedCrop(crop) {
    if (!this.originalImage) {
      return;
    }
    if (!crop) {
      this.imageElement = this.originalImage.element;
      this.imageWidth = this.originalImage.width;
      this.imageHeight = this.originalImage.height;
      this.currentCrop = null;
      this.sizeCanvas();
      this.redraw();
      return;
    }
    const cr = {
      x: Math.max(0, Math.min(this.originalImage.width, crop.x)),
      y: Math.max(0, Math.min(this.originalImage.height, crop.y)),
      width: Math.max(1, Math.min(this.originalImage.width - Math.max(0, crop.x), crop.width)),
      height: Math.max(1, Math.min(this.originalImage.height - Math.max(0, crop.y), crop.height))
    };
    const cropCanvas = mainWindow.document.createElement("canvas");
    cropCanvas.width = cr.width;
    cropCanvas.height = cr.height;
    const cropCtx = cropCanvas.getContext("2d");
    cropCtx.drawImage(this.originalImage.element, cr.x, cr.y, cr.width, cr.height, 0, 0, cr.width, cr.height);
    const croppedImg = mainWindow.document.createElement("img");
    croppedImg.onload = () => {
      this.imageElement = croppedImg;
      this.imageWidth = croppedImg.naturalWidth;
      this.imageHeight = croppedImg.naturalHeight;
      this.currentCrop = cr;
      this.sizeCanvas();
      this.redraw();
    };
    croppedImg.src = cropCanvas.toDataURL("image/png");
  }
  captureState() {
    const identityMap = /* @__PURE__ */ new Map();
    return {
      actions: this.actions.map((a) => cloneDrawAction(a, identityMap)),
      undoneActions: this.undoneActions.map((a) => cloneDrawAction(a, identityMap)),
      crop: this.currentCrop ? { ...this.currentCrop } : null
    };
  }
  sizeCanvas() {
    const container = this.canvas.parentElement;
    if (!container) {
      return;
    }
    const targetWindow = getWindow(this.canvas);
    const dpr = targetWindow.devicePixelRatio || 1;
    const maxWidth = container.clientWidth - CANVAS_BREATHING_ROOM * 2;
    const maxHeight = container.clientHeight - CANVAS_BREATHING_ROOM * 2;
    if (!this.hasUserZoomed) {
      const scaleX = maxWidth / this.imageWidth;
      const scaleY = maxHeight / this.imageHeight;
      this.scale = Math.min(scaleX, scaleY, 1);
    }
    const displayWidth = Math.floor(this.imageWidth * this.scale);
    const displayHeight = Math.floor(this.imageHeight * this.scale);
    this.canvas.style.width = `${displayWidth}px`;
    this.canvas.style.height = `${displayHeight}px`;
    const MAX_BACKING_DIM = 4096;
    const naturalW = displayWidth * dpr;
    const naturalH = displayHeight * dpr;
    const overage = Math.max(1, naturalW / MAX_BACKING_DIM, naturalH / MAX_BACKING_DIM);
    const effectiveDpr = dpr / overage;
    this.canvas.width = Math.max(1, Math.floor(displayWidth * effectiveDpr));
    this.canvas.height = Math.max(1, Math.floor(displayHeight * effectiveDpr));
    this.ctx.setTransform(effectiveDpr, 0, 0, effectiveDpr, 0, 0);
  }
  canvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / this.scale + this.cropOffsetX,
      y: (e.clientY - rect.top) / this.scale + this.cropOffsetY
    };
  }
  onPointerDown(e) {
    const pos = this.canvasCoords(e);
    if (this.cropMode && this.cropRegion) {
      const handle = this.cropHandleHitTest(pos);
      if (handle) {
        this.cropDragHandle = handle;
        this.cropDragStart = pos;
        this.cropRegionStart = { ...this.cropRegion };
        this.canvas.setPointerCapture(e.pointerId);
      }
      return;
    }
    if (this.activeTool === "select" /* Select */) {
      const hitIndex = this.hitTest(pos);
      this.selectedActionIndex = hitIndex;
      if (hitIndex >= 0) {
        const hitAction = this.actions[hitIndex];
        this.pendingMove = { target: hitAction, before: captureMoveSnapshot(hitAction) };
        if (hitAction.type === "text" /* Text */ && this.isNearTextResizeHandle(pos, hitAction)) {
          this.isResizingSelectedText = true;
          this.dragStart = { x: pos.x, y: pos.y };
          this.selectedTextResizeStartWidth = hitAction.textWidth ?? DEFAULT_TEXT_BOX_WIDTH;
          this.canvas.setPointerCapture(e.pointerId);
          this.canvas.style.cursor = "ew-resize";
        } else {
          this.isDraggingSelected = true;
          this.dragStart = { x: pos.x, y: pos.y };
          this.canvas.setPointerCapture(e.pointerId);
          this.canvas.style.cursor = "move";
        }
      }
      this.redraw();
      return;
    }
    this.selectedActionIndex = -1;
    if (this.activeTool === "text" /* Text */) {
      this.commitTextEdit();
      this.textPlacementState = {
        start: pos,
        current: pos,
        pointerId: e.pointerId
      };
      this.canvas.setPointerCapture(e.pointerId);
      this.redraw();
      return;
    }
    if (this.activeTool === "eraser" /* Eraser */) {
      this.isErasing = true;
      this.canvas.setPointerCapture(e.pointerId);
      this.eraseAt(pos);
      return;
    }
    if (this.activeTool === "pan" /* Pan */) {
      this.isPanning = true;
      this.lastPanPoint = { x: e.clientX, y: e.clientY };
      this.canvas.setPointerCapture(e.pointerId);
      this.canvas.style.cursor = "grabbing";
      return;
    }
    this.isDrawing = true;
    this.canvas.setPointerCapture(e.pointerId);
    switch (this.activeTool) {
      case "freehand" /* Freehand */:
        this.currentAction = {
          type: "freehand" /* Freehand */,
          strokeColor: this.activeStrokeColor,
          opacity: this.activeOpacity,
          lineWidth: this.activeLineWidth,
          points: [pos]
        };
        break;
      case "rectangle" /* Rectangle */:
        this.currentAction = {
          type: "rectangle" /* Rectangle */,
          strokeColor: this.activeStrokeColor,
          fillColor: this.activeFillColor,
          opacity: this.activeOpacity,
          lineWidth: this.activeLineWidth,
          rect: { x: pos.x, y: pos.y, width: 0, height: 0 }
        };
        break;
      case "ellipse" /* Ellipse */:
        this.currentAction = {
          type: "ellipse" /* Ellipse */,
          strokeColor: this.activeStrokeColor,
          fillColor: this.activeFillColor,
          opacity: this.activeOpacity,
          lineWidth: this.activeLineWidth,
          ellipseRect: { x: pos.x, y: pos.y, width: 0, height: 0 }
        };
        break;
      case "arrow" /* Arrow */:
        this.currentAction = {
          type: "arrow" /* Arrow */,
          strokeColor: this.activeStrokeColor,
          opacity: this.activeOpacity,
          lineWidth: this.activeLineWidth,
          arrowStart: pos,
          arrowEnd: pos
        };
        break;
    }
  }
  onPointerMove(e) {
    if (this.cropMode) {
      const pos2 = this.canvasCoords(e);
      if (this.cropDragHandle && this.cropRegionStart) {
        this.updateCropRegion(pos2);
        this.redraw();
        return;
      }
      const handle = this.cropHandleHitTest(pos2);
      this.canvas.style.cursor = this.cropCursorFor(handle);
      return;
    }
    if (this.isResizingSelectedText && this.selectedActionIndex >= 0) {
      const pos2 = this.canvasCoords(e);
      const action = this.actions[this.selectedActionIndex];
      if (action.type === "text" /* Text */) {
        action.textWidth = Math.max(MIN_TEXT_BOX_WIDTH, this.selectedTextResizeStartWidth + (pos2.x - this.dragStart.x));
        this.redraw();
      }
      return;
    }
    if (this.isDraggingSelected && this.selectedActionIndex >= 0) {
      const pos2 = this.canvasCoords(e);
      const dx = pos2.x - this.dragStart.x;
      const dy = pos2.y - this.dragStart.y;
      this.moveAction(this.actions[this.selectedActionIndex], dx, dy);
      this.dragStart = { x: pos2.x, y: pos2.y };
      this.redraw();
      return;
    }
    if (this.isPanning) {
      const dx = e.clientX - this.lastPanPoint.x;
      const dy = e.clientY - this.lastPanPoint.y;
      this.panX += dx;
      this.panY += dy;
      this.lastPanPoint = { x: e.clientX, y: e.clientY };
      this.clampPan();
      this.canvas.style.transform = `translate(${this.panX}px, ${this.panY}px)`;
      return;
    }
    if (this.textPlacementState) {
      const pos2 = this.canvasCoords(e);
      this.textPlacementState.current = pos2;
      this.redraw();
      return;
    }
    if (this.isErasing) {
      const pos2 = this.canvasCoords(e);
      this.eraseAt(pos2);
      return;
    }
    if (this.activeTool === "select" /* Select */ && this.selectedActionIndex >= 0) {
      const pos2 = this.canvasCoords(e);
      const action = this.actions[this.selectedActionIndex];
      if (action.type === "text" /* Text */ && this.isNearTextResizeHandle(pos2, action)) {
        this.canvas.style.cursor = "ew-resize";
      } else if (this.selectedActionIndex >= 0) {
        this.canvas.style.cursor = "default";
      }
    }
    if (!this.isDrawing) {
      return;
    }
    const pos = this.canvasCoords(e);
    if (!this.currentAction) {
      return;
    }
    switch (this.currentAction.type) {
      case "freehand" /* Freehand */:
        this.currentAction.points.push(pos);
        break;
      case "rectangle" /* Rectangle */: {
        const rect = this.currentAction.rect;
        this.currentAction.rect = {
          ...rect,
          width: pos.x - rect.x,
          height: pos.y - rect.y
        };
        break;
      }
      case "ellipse" /* Ellipse */: {
        const er = this.currentAction.ellipseRect;
        let w = pos.x - er.x;
        let h = pos.y - er.y;
        if (e.shiftKey) {
          const size = Math.max(Math.abs(w), Math.abs(h));
          w = Math.sign(w) * size;
          h = Math.sign(h) * size;
        }
        this.currentAction.ellipseRect = { ...er, width: w, height: h };
        break;
      }
      case "arrow" /* Arrow */:
        this.currentAction.arrowEnd = pos;
        break;
    }
    this.redraw();
  }
  onPointerUp(e) {
    if (this.cropMode && this.cropDragHandle) {
      this.cropDragHandle = null;
      this.cropRegionStart = null;
      this.canvas.releasePointerCapture(e.pointerId);
      return;
    }
    if (this.isResizingSelectedText) {
      this.isResizingSelectedText = false;
      this.canvas.releasePointerCapture(e.pointerId);
      this.canvas.style.cursor = "default";
      this.commitPendingMove();
      return;
    }
    if (this.isDraggingSelected) {
      this.isDraggingSelected = false;
      this.canvas.releasePointerCapture(e.pointerId);
      this.canvas.style.cursor = "default";
      this.commitPendingMove();
      return;
    }
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.releasePointerCapture(e.pointerId);
      this.canvas.style.cursor = this.activeTool === "pan" /* Pan */ ? "grab" : "crosshair";
      return;
    }
    if (this.isErasing) {
      this.isErasing = false;
      this.canvas.releasePointerCapture(e.pointerId);
      if (this.pendingEraseActions.length > 0) {
        this.actions.push({
          type: "eraser" /* Eraser */,
          strokeColor: "",
          opacity: 1,
          lineWidth: 0,
          erasedActions: this.pendingEraseActions.slice(),
          erasedIndices: this.pendingEraseIndices.slice()
        });
        this.pendingEraseActions = [];
        this.pendingEraseIndices = [];
        this.undoneActions.length = 0;
        this.updateUndoRedoState();
      }
      return;
    }
    if (this.textPlacementState) {
      const { start, current, pointerId } = this.textPlacementState;
      if (pointerId === e.pointerId) {
        this.canvas.releasePointerCapture(e.pointerId);
      }
      const dx = current.x - start.x;
      const didDrag = Math.abs(dx) >= TEXT_DRAG_THRESHOLD;
      const x = didDrag ? Math.min(start.x, current.x) : start.x;
      const rawWidth = didDrag ? Math.abs(dx) : this.getMaxTextWidthFrom(start.x);
      const width = didDrag ? Math.max(1, Math.min(rawWidth, this.getTextImageRight() - x)) : rawWidth;
      const y = start.y;
      this.textPlacementState = null;
      this.startTextEdit({ x, y }, width, didDrag);
      return;
    }
    if (!this.isDrawing) {
      return;
    }
    this.canvas.releasePointerCapture(e.pointerId);
    this.isDrawing = false;
    if (this.currentAction) {
      this.actions.push(this.currentAction);
      this.undoneActions.length = 0;
      this.updateUndoRedoState();
      this.currentAction = null;
    }
    this.redraw();
  }
  eraseAt(pos) {
    const hitIndex = this.hitTest(pos);
    if (hitIndex < 0) {
      return;
    }
    const [erased] = this.actions.splice(hitIndex, 1);
    this.pendingEraseActions.push(erased);
    this.pendingEraseIndices.push(hitIndex);
    this.selectedActionIndex = -1;
    this.redraw();
  }
  commitPendingMove() {
    const pending = this.pendingMove;
    this.pendingMove = null;
    if (!pending) {
      return;
    }
    const after = captureMoveSnapshot(pending.target);
    if (moveSnapshotsEqual(pending.before, after)) {
      return;
    }
    this.actions.push({
      type: "move" /* Move */,
      strokeColor: "",
      opacity: 1,
      lineWidth: 0,
      moveTarget: pending.target,
      moveBefore: pending.before,
      moveAfter: after
    });
    this.undoneActions.length = 0;
    this.updateUndoRedoState();
  }
  updateUndoRedoState() {
    if (this.undoBtn) {
      this.undoBtn.disabled = this.actions.length === 0;
    }
    if (this.redoBtn) {
      this.redoBtn.disabled = this.undoneActions.length === 0;
    }
  }
  undo() {
    if (this.textPlacementState) {
      this.cancelTextPlacement();
      return;
    }
    if (this.textEditState) {
      this.cancelTextEdit();
      return;
    }
    const action = this.actions.pop();
    if (!action) {
      return;
    }
    if (action.type === "eraser" /* Eraser */ && action.erasedActions) {
      const erased = action.erasedActions;
      const indices = action.erasedIndices ?? erased.map(() => this.actions.length);
      for (let i = erased.length - 1; i >= 0; i--) {
        const idx = Math.min(indices[i], this.actions.length);
        this.actions.splice(idx, 0, erased[i]);
      }
    }
    this.undoneActions.push(action);
    this.updateUndoRedoState();
    this.selectedActionIndex = -1;
    if (action.type === "crop" /* Crop */) {
      this.applyDisplayedCrop(action.cropFrom ?? null);
    } else if (action.type === "move" /* Move */ && action.moveTarget && action.moveBefore) {
      applyMoveSnapshot(action.moveTarget, action.moveBefore);
      this.redraw();
    } else {
      this.redraw();
    }
  }
  redo() {
    if (this.textPlacementState) {
      return;
    }
    if (this.textEditState) {
      return;
    }
    const action = this.undoneActions.pop();
    if (!action) {
      return;
    }
    if (action.type === "eraser" /* Eraser */ && action.erasedActions) {
      for (const erased of action.erasedActions) {
        const idx = this.actions.indexOf(erased);
        if (idx >= 0) {
          this.actions.splice(idx, 1);
        }
      }
    }
    this.actions.push(action);
    this.selectedActionIndex = -1;
    this.updateUndoRedoState();
    if (action.type === "crop" /* Crop */) {
      this.applyDisplayedCrop(action.cropTo ?? null);
    } else if (action.type === "move" /* Move */ && action.moveTarget && action.moveAfter) {
      applyMoveSnapshot(action.moveTarget, action.moveAfter);
      this.redraw();
    } else {
      this.redraw();
    }
  }
  cropHandleHitTest(pos) {
    if (!this.cropRegion) {
      return null;
    }
    const r = this.normalizeCropRect(this.cropRegion);
    const handlePx = 12;
    const tol = handlePx / this.scale;
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    const handles = [
      { name: "nw", x: r.x, y: r.y },
      { name: "n", x: cx, y: r.y },
      { name: "ne", x: r.x + r.width, y: r.y },
      { name: "e", x: r.x + r.width, y: cy },
      { name: "se", x: r.x + r.width, y: r.y + r.height },
      { name: "s", x: cx, y: r.y + r.height },
      { name: "sw", x: r.x, y: r.y + r.height },
      { name: "w", x: r.x, y: cy }
    ];
    for (const h of handles) {
      if (Math.abs(pos.x - h.x) <= tol && Math.abs(pos.y - h.y) <= tol) {
        return h.name;
      }
    }
    if (pos.x >= r.x && pos.x <= r.x + r.width && pos.y >= r.y && pos.y <= r.y + r.height) {
      return "move";
    }
    return null;
  }
  cropCursorFor(handle) {
    switch (handle) {
      case "nw":
      case "se":
        return "nwse-resize";
      case "ne":
      case "sw":
        return "nesw-resize";
      case "n":
      case "s":
        return "ns-resize";
      case "e":
      case "w":
        return "ew-resize";
      case "move":
        return "move";
      default:
        return "default";
    }
  }
  updateCropRegion(pos) {
    if (!this.cropRegionStart || !this.cropDragHandle) {
      return;
    }
    const dx = pos.x - this.cropDragStart.x;
    const dy = pos.y - this.cropDragStart.y;
    const start = this.cropRegionStart;
    if (this.cropDragHandle === "move") {
      const x2 = Math.max(0, Math.min(this.imageWidth - start.width, start.x + dx));
      const y2 = Math.max(0, Math.min(this.imageHeight - start.height, start.y + dy));
      this.cropRegion = { x: x2, y: y2, width: start.width, height: start.height };
      return;
    }
    let { x, y, width, height } = start;
    switch (this.cropDragHandle) {
      case "nw":
        x += dx;
        y += dy;
        width -= dx;
        height -= dy;
        break;
      case "n":
        y += dy;
        height -= dy;
        break;
      case "ne":
        y += dy;
        width += dx;
        height -= dy;
        break;
      case "e":
        width += dx;
        break;
      case "se":
        width += dx;
        height += dy;
        break;
      case "s":
        height += dy;
        break;
      case "sw":
        x += dx;
        width -= dx;
        height += dy;
        break;
      case "w":
        x += dx;
        width -= dx;
        break;
    }
    x = Math.max(0, Math.min(this.imageWidth, x));
    y = Math.max(0, Math.min(this.imageHeight, y));
    width = Math.max(10, Math.min(this.imageWidth - x, width));
    height = Math.max(10, Math.min(this.imageHeight - y, height));
    this.cropRegion = { x, y, width, height };
  }
  normalizeCropRect(r) {
    return {
      x: r.width < 0 ? r.x + r.width : r.x,
      y: r.height < 0 ? r.y + r.height : r.y,
      width: Math.abs(r.width),
      height: Math.abs(r.height)
    };
  }
  startTextEdit(pos, width, showBoxOutline) {
    this.commitTextEdit();
    const editor = mainWindow.document.createElement("textarea");
    editor.setAttribute("aria-label", localize("typeText", "Type text"));
    editor.setAttribute("wrap", "off");
    editor.style.position = "fixed";
    editor.style.left = "-10000px";
    editor.style.top = "0";
    editor.style.width = "1px";
    editor.style.height = "1px";
    editor.style.opacity = "0";
    editor.style.pointerEvents = "none";
    editor.style.padding = "0";
    editor.style.border = "0";
    editor.style.margin = "0";
    editor.style.resize = "none";
    editor.style.overflow = "hidden";
    this.container.appendChild(editor);
    this.textEditState = {
      pos,
      text: "",
      caretIndex: 0,
      strokeColor: this.activeStrokeColor,
      fillColor: this.activeFillColor,
      opacity: this.activeOpacity,
      fontSize: this.activeFontSize,
      fontFamily: this.activeFontFamily,
      width,
      showBoxOutline
    };
    this.textEditor = editor;
    this.startTextCaretBlink();
    const sync = () => {
      if (!this.textEditState || this.textEditor !== editor) {
        return;
      }
      this.textEditState.text = editor.value;
      this.textEditState.caretIndex = editor.selectionStart ?? editor.value.length;
      this.textCaretVisible = true;
      this.redraw();
    };
    editor.addEventListener("input", sync);
    editor.addEventListener("keyup", sync);
    editor.addEventListener("click", sync);
    editor.addEventListener("select", sync);
    editor.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.commitTextEdit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.cancelTextEdit();
      }
    });
    editor.addEventListener("blur", () => {
      if (this.textEditor === editor) {
        this.commitTextEdit();
      }
    });
    setTimeout(() => {
      if (this.textEditor === editor) {
        editor.focus();
        editor.setSelectionRange(editor.value.length, editor.value.length);
      }
    }, 0);
    this.redraw();
  }
  startTextCaretBlink() {
    if (this.textCaretInterval !== null) {
      getWindow(this.container).clearInterval(this.textCaretInterval);
    }
    this.textCaretVisible = true;
    this.textCaretInterval = getWindow(this.container).setInterval(() => {
      if (!this.textEditState) {
        return;
      }
      this.textCaretVisible = !this.textCaretVisible;
      this.redraw();
    }, 500);
  }
  stopTextCaretBlink() {
    if (this.textCaretInterval !== null) {
      getWindow(this.container).clearInterval(this.textCaretInterval);
      this.textCaretInterval = null;
    }
    this.textCaretVisible = true;
  }
  commitTextEdit() {
    if (!this.textEditState) {
      return;
    }
    const { text, pos, strokeColor, fillColor, opacity, fontFamily, fontSize, width } = this.textEditState;
    this.cleanupTextEditor();
    if (text.trim()) {
      this.actions.push({
        type: "text" /* Text */,
        strokeColor,
        fillColor,
        opacity,
        lineWidth: 1,
        fontSize,
        fontFamily,
        text,
        textPos: pos,
        textWidth: width
      });
      this.undoneActions.length = 0;
      this.updateUndoRedoState();
    }
    this.redraw();
  }
  cancelTextEdit() {
    if (!this.textEditState) {
      return;
    }
    this.cleanupTextEditor();
    this.redraw();
  }
  cancelTextPlacement() {
    if (!this.textPlacementState) {
      return;
    }
    if (this.canvas.hasPointerCapture(this.textPlacementState.pointerId)) {
      this.canvas.releasePointerCapture(this.textPlacementState.pointerId);
    }
    this.textPlacementState = null;
    this.redraw();
  }
  getTextImageRight() {
    return this.cropOffsetX + this.imageWidth;
  }
  getMaxTextWidthFrom(startX) {
    return Math.max(1, this.getTextImageRight() - startX);
  }
  cleanupTextEditor() {
    this.stopTextCaretBlink();
    this.textEditor?.remove();
    this.textEditor = null;
    this.textEditState = null;
    this.container.focus();
  }
  redraw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.imageElement) {
      this.ctx.drawImage(this.imageElement, 0, 0, this.imageWidth * this.scale, this.imageHeight * this.scale);
    }
    this.ctx.save();
    this.ctx.translate(-this.cropOffsetX * this.scale, -this.cropOffsetY * this.scale);
    for (const action of this.actions) {
      this.drawAction(action);
    }
    if (this.selectedActionIndex >= 0 && this.selectedActionIndex < this.actions.length) {
      this.drawSelectionHighlight(this.actions[this.selectedActionIndex]);
    }
    if (this.currentAction) {
      this.drawAction(this.currentAction);
    }
    if (this.textEditState) {
      this.drawTextEditState();
    }
    if (this.textPlacementState) {
      this.drawTextPlacementState();
    }
    this.ctx.restore();
    if (this.cropMode && this.cropRegion) {
      const r = this.normalizeCropRect(this.cropRegion);
      const dpr = getWindow(this.canvas).devicePixelRatio || 1;
      const cw = this.canvas.width / dpr;
      const ch = this.canvas.height / dpr;
      const rx = r.x * this.scale;
      const ry = r.y * this.scale;
      const rw = r.width * this.scale;
      const rh = r.height * this.scale;
      this.ctx.save();
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      this.ctx.fillRect(0, 0, cw, ry);
      this.ctx.fillRect(0, ry + rh, cw, ch - (ry + rh));
      this.ctx.fillRect(0, ry, rx, rh);
      this.ctx.fillRect(rx + rw, ry, cw - (rx + rw), rh);
      this.ctx.strokeStyle = "#ffffff";
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(rx, ry, rw, rh);
      const handleSize = 10;
      const half = handleSize / 2;
      const handles = [
        { x: rx, y: ry },
        // nw
        { x: rx + rw / 2, y: ry },
        // n
        { x: rx + rw, y: ry },
        // ne
        { x: rx + rw, y: ry + rh / 2 },
        // e
        { x: rx + rw, y: ry + rh },
        // se
        { x: rx + rw / 2, y: ry + rh },
        // s
        { x: rx, y: ry + rh },
        // sw
        { x: rx, y: ry + rh / 2 }
        // w
      ];
      this.ctx.fillStyle = "#ffffff";
      this.ctx.strokeStyle = "#000000";
      this.ctx.lineWidth = 1;
      for (const h of handles) {
        this.ctx.fillRect(h.x - half, h.y - half, handleSize, handleSize);
        this.ctx.strokeRect(h.x - half, h.y - half, handleSize, handleSize);
      }
      this.ctx.restore();
    }
  }
  drawAction(action) {
    if (action.type === "eraser" /* Eraser */ || action.type === "crop" /* Crop */ || action.type === "move" /* Move */) {
      return;
    }
    this.ctx.save();
    const fillColor = action.fillColor ?? "transparent";
    this.ctx.globalAlpha = action.opacity;
    this.ctx.strokeStyle = action.strokeColor;
    this.ctx.fillStyle = this.isTransparent(fillColor) ? action.strokeColor : fillColor;
    this.ctx.lineWidth = action.lineWidth * this.scale;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    switch (action.type) {
      case "freehand" /* Freehand */:
        if (action.points && action.points.length > 0) {
          this.ctx.beginPath();
          this.ctx.moveTo(action.points[0].x * this.scale, action.points[0].y * this.scale);
          for (let i = 1; i < action.points.length; i++) {
            this.ctx.lineTo(action.points[i].x * this.scale, action.points[i].y * this.scale);
          }
          this.ctx.stroke();
        }
        break;
      case "rectangle" /* Rectangle */:
        if (action.rect) {
          if (!this.isTransparent(fillColor)) {
            this.ctx.fillRect(
              action.rect.x * this.scale,
              action.rect.y * this.scale,
              action.rect.width * this.scale,
              action.rect.height * this.scale
            );
          }
          this.ctx.strokeRect(
            action.rect.x * this.scale,
            action.rect.y * this.scale,
            action.rect.width * this.scale,
            action.rect.height * this.scale
          );
        }
        break;
      case "ellipse" /* Ellipse */:
        if (action.ellipseRect) {
          const r = action.ellipseRect;
          const cx = (r.x + r.width / 2) * this.scale;
          const cy = (r.y + r.height / 2) * this.scale;
          const rx = Math.abs(r.width / 2) * this.scale;
          const ry = Math.abs(r.height / 2) * this.scale;
          this.ctx.beginPath();
          this.ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          if (!this.isTransparent(fillColor)) {
            this.ctx.fill();
          }
          this.ctx.stroke();
        }
        break;
      case "arrow" /* Arrow */:
        if (action.arrowStart && action.arrowEnd) {
          this.drawArrow(
            action.arrowStart.x * this.scale,
            action.arrowStart.y * this.scale,
            action.arrowEnd.x * this.scale,
            action.arrowEnd.y * this.scale
          );
        }
        break;
      case "text" /* Text */:
        if (action.text && action.textPos) {
          const fontSize = (action.fontSize || 16) * this.scale;
          const fontFamily = action.fontFamily || "sans-serif";
          const width = (action.textWidth ?? DEFAULT_TEXT_BOX_WIDTH) * this.scale;
          this.ctx.font = `${fontSize}px ${fontFamily}`;
          this.ctx.textBaseline = "alphabetic";
          if (!this.isTransparent(fillColor)) {
            const layout = this.measureWrappedText(action.text, width, fontSize, fontFamily);
            this.ctx.fillRect(
              action.textPos.x * this.scale,
              action.textPos.y * this.scale - fontSize,
              width,
              Math.max(layout.height, fontSize * 1.2)
            );
          }
          this.ctx.fillStyle = action.strokeColor;
          this.drawWrappedText(action.text, action.textPos.x * this.scale, action.textPos.y * this.scale, width, fontSize, fontFamily);
        }
        break;
    }
    this.ctx.restore();
  }
  drawTextEditState() {
    if (!this.textEditState) {
      return;
    }
    const { pos, text, strokeColor, fillColor, opacity, fontFamily, fontSize, caretIndex, width, showBoxOutline } = this.textEditState;
    const scaledFontSize = fontSize * this.scale;
    const scaledWidth = width * this.scale;
    this.ctx.save();
    this.ctx.globalAlpha = opacity;
    this.ctx.fillStyle = strokeColor;
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = Math.max(1, this.scale);
    this.ctx.font = `${scaledFontSize}px ${fontFamily}`;
    this.ctx.textBaseline = "alphabetic";
    if (!this.isTransparent(fillColor)) {
      const layout2 = this.measureWrappedText(text, scaledWidth, scaledFontSize, fontFamily);
      this.ctx.fillStyle = fillColor;
      this.ctx.fillRect(
        pos.x * this.scale,
        pos.y * this.scale - scaledFontSize,
        scaledWidth,
        Math.max(layout2.height, scaledFontSize * 1.2)
      );
      this.ctx.fillStyle = strokeColor;
    }
    const layout = this.drawWrappedText(text, pos.x * this.scale, pos.y * this.scale, scaledWidth, scaledFontSize, fontFamily);
    if (showBoxOutline) {
      this.ctx.setLineDash([4, 4]);
      this.ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      this.ctx.strokeRect(
        pos.x * this.scale,
        pos.y * this.scale - scaledFontSize,
        scaledWidth,
        Math.max(layout.height, scaledFontSize * 1.2)
      );
      this.ctx.setLineDash([]);
    }
    if (this.textCaretVisible) {
      const caret = this.getTextCaretMetrics(text, caretIndex, scaledWidth, scaledFontSize, fontFamily);
      const caretX = pos.x * this.scale + caret.x;
      const baselineY = pos.y * this.scale + caret.baselineOffsetY;
      this.ctx.beginPath();
      this.ctx.moveTo(caretX, baselineY - scaledFontSize);
      this.ctx.lineTo(caretX, baselineY + Math.max(2, this.scale));
      this.ctx.stroke();
    }
    this.ctx.restore();
  }
  isTransparent(color) {
    return color === "transparent";
  }
  drawTextPlacementState() {
    if (!this.textPlacementState) {
      return;
    }
    const { start, current } = this.textPlacementState;
    const dx = current.x - start.x;
    const didDrag = Math.abs(dx) >= TEXT_DRAG_THRESHOLD;
    if (!didDrag) {
      return;
    }
    const x = Math.min(start.x, current.x);
    const width = Math.max(1, Math.min(Math.abs(dx), this.getTextImageRight() - x));
    const y = (start.y - this.activeFontSize) * this.scale;
    const height = this.activeFontSize * this.scale * 1.2;
    this.ctx.save();
    this.ctx.setLineDash([4, 4]);
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    this.ctx.lineWidth = Math.max(1, this.scale);
    this.ctx.strokeRect(x * this.scale, y, width * this.scale, height);
    this.ctx.setLineDash([]);
    this.ctx.restore();
  }
  drawWrappedText(text, x, baselineY, maxWidth, fontSize, fontFamily) {
    const layout = this.measureWrappedText(text, maxWidth, fontSize, fontFamily);
    const lineHeight = layout.lineHeight;
    for (let i = 0; i < layout.lines.length; i++) {
      const line = layout.lines[i];
      this.ctx.fillText(line.text, x, baselineY + i * lineHeight);
    }
    return {
      width: layout.width,
      height: layout.height,
      lineHeight
    };
  }
  getTextCaretMetrics(text, caretIndex, maxWidth, fontSize, fontFamily) {
    const layout = this.measureWrappedText(text, maxWidth, fontSize, fontFamily);
    const line = [...layout.lines].reverse().find((candidate) => candidate.startIndex <= caretIndex) ?? layout.lines[0];
    const safeCaretIndex = Math.min(Math.max(caretIndex, line.startIndex), line.endIndex);
    const beforeCaret = line.text.slice(0, safeCaretIndex - line.startIndex);
    this.ctx.save();
    this.ctx.font = `${fontSize}px ${fontFamily}`;
    const x = this.ctx.measureText(beforeCaret).width;
    this.ctx.restore();
    return {
      x,
      baselineOffsetY: line.lineIndex * layout.lineHeight
    };
  }
  measureWrappedText(text, maxWidth, fontSize, fontFamily) {
    this.ctx.save();
    this.ctx.font = `${fontSize}px ${fontFamily}`;
    const lineHeight = fontSize * 1.2;
    const lines = [];
    const paragraphs = text.split("\n");
    let globalIndex = 0;
    let lineIndex = 0;
    let maxLineWidth = 0;
    for (let p = 0; p < paragraphs.length; p++) {
      const paragraph = paragraphs[p];
      const paragraphStart = globalIndex;
      const paragraphEnd = paragraphStart + paragraph.length;
      if (paragraph.length === 0) {
        lines.push({ text: "", startIndex: paragraphStart, endIndex: paragraphStart, lineIndex });
        lineIndex++;
      } else {
        let lineStart = paragraphStart;
        while (lineStart < paragraphEnd) {
          let bestEnd = lineStart + 1;
          let lastWhitespaceBreak = -1;
          for (let i = lineStart + 1; i <= paragraphEnd; i++) {
            const candidate = text.slice(lineStart, i);
            if (this.ctx.measureText(candidate).width <= maxWidth) {
              bestEnd = i;
              if (/\s/.test(text[i - 1])) {
                lastWhitespaceBreak = i;
              }
            } else {
              break;
            }
          }
          let lineEnd = bestEnd;
          if (bestEnd < paragraphEnd && lastWhitespaceBreak > lineStart) {
            lineEnd = lastWhitespaceBreak;
          }
          if (lineEnd <= lineStart) {
            lineEnd = lineStart + 1;
          }
          const rawLineText = text.slice(lineStart, lineEnd);
          const lineText = rawLineText.replace(/\s+$/u, "");
          lines.push({ text: lineText, startIndex: lineStart, endIndex: lineEnd, lineIndex });
          maxLineWidth = Math.max(maxLineWidth, this.ctx.measureText(lineText).width);
          lineIndex++;
          lineStart = lineEnd;
          while (lineStart < paragraphEnd && /\s/u.test(text[lineStart])) {
            lineStart++;
          }
        }
      }
      globalIndex = paragraphEnd + 1;
    }
    if (lines.length === 0) {
      lines.push({ text: "", startIndex: 0, endIndex: 0, lineIndex: 0 });
    }
    if (maxLineWidth === 0) {
      for (const line of lines) {
        maxLineWidth = Math.max(maxLineWidth, this.ctx.measureText(line.text).width);
      }
    }
    this.ctx.restore();
    return {
      lines,
      width: Math.max(maxLineWidth, maxWidth),
      height: lines.length * lineHeight,
      lineHeight
    };
  }
  hitTest(pos) {
    for (let i = this.actions.length - 1; i >= 0; i--) {
      if (this.isPointOnAction(pos, this.actions[i])) {
        return i;
      }
    }
    return -1;
  }
  isPointOnAction(pos, action) {
    const threshold = 8;
    switch (action.type) {
      case "freehand" /* Freehand */:
        if (action.points) {
          for (let i = 1; i < action.points.length; i++) {
            if (this.pointToSegmentDist(pos, action.points[i - 1], action.points[i]) < threshold) {
              return true;
            }
          }
        }
        return false;
      case "rectangle" /* Rectangle */:
        if (action.rect) {
          const r = action.rect;
          const nx = Math.min(r.x, r.x + r.width);
          const ny = Math.min(r.y, r.y + r.height);
          const nw = Math.abs(r.width);
          const nh = Math.abs(r.height);
          return pos.x >= nx - threshold && pos.x <= nx + nw + threshold && pos.y >= ny - threshold && pos.y <= ny + nh + threshold;
        }
        return false;
      case "ellipse" /* Ellipse */:
        if (action.ellipseRect) {
          const er = action.ellipseRect;
          const cx = er.x + er.width / 2;
          const cy = er.y + er.height / 2;
          const rx = Math.abs(er.width / 2);
          const ry = Math.abs(er.height / 2);
          if (rx < 1 || ry < 1) {
            return false;
          }
          const dx = (pos.x - cx) / rx;
          const dy = (pos.y - cy) / ry;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (!this.isTransparent(action.fillColor ?? "transparent")) {
            return dist <= 1 + threshold / Math.min(rx, ry);
          }
          const normalizedThreshold = threshold / Math.min(rx, ry);
          return Math.abs(dist - 1) < normalizedThreshold;
        }
        return false;
      case "arrow" /* Arrow */:
        if (action.arrowStart && action.arrowEnd) {
          return this.pointToSegmentDist(pos, action.arrowStart, action.arrowEnd) < threshold;
        }
        return false;
      case "text" /* Text */:
        if (action.text && action.textPos) {
          const bounds = this.getActionBounds(action);
          if (!bounds) {
            return false;
          }
          return pos.x >= action.textPos.x - threshold && pos.x <= bounds.x + bounds.width + threshold && pos.y >= bounds.y - threshold && pos.y <= bounds.y + bounds.height + threshold;
        }
        return false;
    }
    return false;
  }
  pointToSegmentDist(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq === 0) {
      return Math.hypot(p.x - a.x, p.y - a.y);
    }
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));
    const projX = a.x + t * dx;
    const projY = a.y + t * dy;
    return Math.hypot(p.x - projX, p.y - projY);
  }
  moveAction(action, dx, dy) {
    switch (action.type) {
      case "freehand" /* Freehand */:
        if (action.points) {
          for (const pt of action.points) {
            pt.x += dx;
            pt.y += dy;
          }
        }
        break;
      case "rectangle" /* Rectangle */:
        if (action.rect) {
          action.rect.x += dx;
          action.rect.y += dy;
        }
        break;
      case "ellipse" /* Ellipse */:
        if (action.ellipseRect) {
          action.ellipseRect.x += dx;
          action.ellipseRect.y += dy;
        }
        break;
      case "arrow" /* Arrow */:
        if (action.arrowStart) {
          action.arrowStart.x += dx;
          action.arrowStart.y += dy;
        }
        if (action.arrowEnd) {
          action.arrowEnd.x += dx;
          action.arrowEnd.y += dy;
        }
        break;
      case "text" /* Text */:
        if (action.textPos) {
          action.textPos.x += dx;
          action.textPos.y += dy;
        }
        break;
    }
  }
  drawSelectionHighlight(action) {
    this.ctx.save();
    this.ctx.strokeStyle = "#007acc";
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([4, 4]);
    const pad = 6;
    const bounds = this.getActionBounds(action);
    if (bounds) {
      this.ctx.strokeRect(
        (bounds.x - pad) * this.scale,
        (bounds.y - pad) * this.scale,
        (bounds.width + pad * 2) * this.scale,
        (bounds.height + pad * 2) * this.scale
      );
      if (action.type === "text" /* Text */) {
        const handleSize = 8;
        const handleX = (bounds.x + bounds.width + pad) * this.scale;
        const handleY = (bounds.y + bounds.height / 2) * this.scale;
        this.ctx.fillStyle = "#007acc";
        this.ctx.fillRect(handleX - handleSize / 2, handleY - handleSize / 2, handleSize, handleSize);
      }
    }
    this.ctx.setLineDash([]);
    this.ctx.restore();
  }
  isNearTextResizeHandle(pos, action) {
    if (action.type !== "text" /* Text */) {
      return false;
    }
    const bounds = this.getActionBounds(action);
    if (!bounds) {
      return false;
    }
    const threshold = 8;
    const handleX = bounds.x + bounds.width;
    const handleY = bounds.y + bounds.height / 2;
    return Math.abs(pos.x - handleX) <= threshold && Math.abs(pos.y - handleY) <= threshold * 2;
  }
  getActionBounds(action) {
    switch (action.type) {
      case "freehand" /* Freehand */:
        if (action.points && action.points.length > 0) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const pt of action.points) {
            minX = Math.min(minX, pt.x);
            minY = Math.min(minY, pt.y);
            maxX = Math.max(maxX, pt.x);
            maxY = Math.max(maxY, pt.y);
          }
          return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        }
        return null;
      case "rectangle" /* Rectangle */:
        if (action.rect) {
          const r = action.rect;
          return {
            x: Math.min(r.x, r.x + r.width),
            y: Math.min(r.y, r.y + r.height),
            width: Math.abs(r.width),
            height: Math.abs(r.height)
          };
        }
        return null;
      case "ellipse" /* Ellipse */:
        if (action.ellipseRect) {
          const er = action.ellipseRect;
          return {
            x: Math.min(er.x, er.x + er.width),
            y: Math.min(er.y, er.y + er.height),
            width: Math.abs(er.width),
            height: Math.abs(er.height)
          };
        }
        return null;
      case "arrow" /* Arrow */:
        if (action.arrowStart && action.arrowEnd) {
          const minX = Math.min(action.arrowStart.x, action.arrowEnd.x);
          const minY = Math.min(action.arrowStart.y, action.arrowEnd.y);
          const maxX = Math.max(action.arrowStart.x, action.arrowEnd.x);
          const maxY = Math.max(action.arrowStart.y, action.arrowEnd.y);
          return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        }
        return null;
      case "text" /* Text */:
        if (action.text && action.textPos) {
          const fontSize = action.fontSize || 16;
          const fontFamily = action.fontFamily || "sans-serif";
          const textWidth = action.textWidth ?? DEFAULT_TEXT_BOX_WIDTH;
          const layout = this.measureWrappedText(action.text, textWidth, fontSize, fontFamily);
          return {
            x: action.textPos.x,
            y: action.textPos.y - fontSize,
            width: textWidth,
            height: layout.height
          };
        }
        return null;
    }
    return null;
  }
  drawArrow(fromX, fromY, toX, toY) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const length = Math.hypot(dx, dy);
    if (length === 0) {
      return;
    }
    const unitX = dx / length;
    const unitY = dy / length;
    const normalX = -unitY;
    const normalY = unitX;
    const lineWidth = this.ctx.lineWidth;
    const headLength = Math.min(Math.max(12 * this.scale, lineWidth * 3), length);
    const headWidth = Math.max(10 * this.scale, lineWidth * 2.5);
    const baseX = toX - unitX * headLength;
    const baseY = toY - unitY * headLength;
    this.ctx.beginPath();
    this.ctx.moveTo(fromX, fromY);
    this.ctx.lineTo(baseX, baseY);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(toX, toY);
    this.ctx.lineTo(baseX + normalX * headWidth / 2, baseY + normalY * headWidth / 2);
    this.ctx.lineTo(baseX - normalX * headWidth / 2, baseY - normalY * headWidth / 2);
    this.ctx.closePath();
    this.ctx.fillStyle = this.ctx.strokeStyle;
    this.ctx.fill();
  }
  flushPendingZoom() {
    const pending = this.pendingZoom;
    this.pendingZoom = null;
    if (!pending) {
      return;
    }
    const minScale = this.getFitScale();
    const maxScale = 8;
    const desiredScale = this.scale * pending.factor;
    const newScale = Math.max(minScale, Math.min(maxScale, desiredScale));
    if (newScale === this.scale) {
      return;
    }
    const halfImgW = this.imageWidth * this.scale / 2;
    const halfImgH = this.imageHeight * this.scale / 2;
    const anchorCx = this.panX + Math.max(-halfImgW, Math.min(halfImgW, pending.cx - this.panX));
    const anchorCy = this.panY + Math.max(-halfImgH, Math.min(halfImgH, pending.cy - this.panY));
    const r = newScale / this.scale;
    this.panX = anchorCx * (1 - r) + this.panX * r;
    this.panY = anchorCy * (1 - r) + this.panY * r;
    this.scale = newScale;
    this.hasUserZoomed = true;
    if (newScale === minScale) {
      this.panX = 0;
      this.panY = 0;
    }
    this.sizeCanvas();
    this.canvas.style.transform = `translate(${this.panX}px, ${this.panY}px)`;
    this.redraw();
  }
  getFitScale() {
    const container = this.canvas.parentElement;
    if (!container || !this.imageWidth || !this.imageHeight) {
      return 1;
    }
    const maxWidth = Math.max(1, container.clientWidth - CANVAS_BREATHING_ROOM * 2);
    const maxHeight = Math.max(1, container.clientHeight - CANVAS_BREATHING_ROOM * 2);
    return Math.min(maxWidth / this.imageWidth, maxHeight / this.imageHeight, 1);
  }
  clampPan() {
    const container = this.canvas.parentElement;
    if (!container) {
      return;
    }
    const imgW = this.imageWidth * this.scale;
    const imgH = this.imageHeight * this.scale;
    const cW = container.clientWidth;
    const cH = container.clientHeight;
    const maxPanX = Math.abs(cW - imgW) / 2;
    const maxPanY = Math.abs(cH - imgH) / 2;
    this.panX = Math.max(-maxPanX, Math.min(maxPanX, this.panX));
    this.panY = Math.max(-maxPanY, Math.min(maxPanY, this.panY));
  }
  compositeToDataUrl() {
    const finalCanvas = mainWindow.document.createElement("canvas");
    finalCanvas.width = this.imageWidth;
    finalCanvas.height = this.imageHeight;
    const ctx = finalCanvas.getContext("2d");
    if (this.imageElement) {
      ctx.drawImage(this.imageElement, 0, 0, this.imageWidth, this.imageHeight);
    }
    const savedScale = this.scale;
    this.scale = 1;
    const savedCtx = this.ctx;
    this.ctx = ctx;
    const offX = this.currentCrop?.x ?? 0;
    const offY = this.currentCrop?.y ?? 0;
    ctx.save();
    ctx.translate(-offX, -offY);
    for (const action of this.actions) {
      this.drawAction(action);
    }
    ctx.restore();
    this.ctx = savedCtx;
    this.scale = savedScale;
    return finalCanvas.toDataURL("image/png");
  }
  dispose() {
    if (this.pendingZoomRaf) {
      getWindow(this.canvas).cancelAnimationFrame(this.pendingZoomRaf);
      this.pendingZoomRaf = 0;
      this.pendingZoom = null;
    }
    this.cancelTextPlacement();
    this.cleanupTextEditor();
    this.container.remove();
    this.toolOptionsDisposables.dispose();
    this.disposables.dispose();
    this._onDidSave.dispose();
    this._onDidCancel.dispose();
  }
}
export {
  ScreenshotAnnotationEditor
};
