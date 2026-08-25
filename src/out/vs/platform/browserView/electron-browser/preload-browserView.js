const commentElementSelectionMode = "comment";
let localizedStrings = {
  addComment: "Add Comment",
  addCommentPlaceholder: "Add a comment",
  commentOnSelectedElement: "Comment on selected element",
  elementComment: "Element comment {0}",
  elementCommentWithBody: "Element comment {0}: {1}",
  emptyElementComment: "Empty element comment {0}",
  removeComment: "Remove Comment",
  removeElementComment: "Remove element comment"
};
function init() {
  const { contextBridge, ipcRenderer } = require("electron");
  const nativeCtrlCmdKeybindings = {
    mac: {
      always: /* @__PURE__ */ new Set(["arrowup", "arrowdown", "arrowleft", "arrowright", "backspace", "delete"]),
      noShift: /* @__PURE__ */ new Set(["a", "c", "v", "x", "z"]),
      withShift: /* @__PURE__ */ new Set(["v", "z"])
    },
    nonMac: {
      always: /* @__PURE__ */ new Set(["arrowup", "arrowdown", "arrowleft", "arrowright", "home", "end", "backspace", "delete"]),
      noShift: /* @__PURE__ */ new Set(["a", "c", "v", "x", "z", "y"]),
      withShift: /* @__PURE__ */ new Set(["v", "z"])
    }
  };
  window.addEventListener("keydown", (event) => {
    if (!(event instanceof KeyboardEvent) || !event.isTrusted) {
      return;
    }
    if (event.defaultPrevented) {
      return;
    }
    const isNonEditingKey = event.key === "Escape" || /^F\d+$/.test(event.key) || event.key.startsWith("Audio") || event.key.startsWith("Media") || event.key.startsWith("Browser");
    if (!(event.ctrlKey || event.altKey || event.metaKey) && !isNonEditingKey) {
      return;
    }
    if (event.key === "Control" || event.key === "Shift" || event.key === "Alt" || event.key === "Meta") {
      return;
    }
    const isMac = navigator.platform.indexOf("Mac") >= 0;
    if (event.altKey && !event.ctrlKey && !event.metaKey) {
      if (isMac || /^Numpad\d+$/.test(event.code)) {
        return;
      }
    }
    if (event.key === "F10" && event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
      return;
    }
    const ctrlCmd = isMac ? event.metaKey : event.ctrlKey;
    if (ctrlCmd && !event.altKey) {
      let key = event.key.toLowerCase();
      if (!/^[a-z]$/.test(key) && /^Key[A-Z]$/.test(event.code)) {
        key = event.code.slice(3).toLowerCase();
      }
      const keySetsToCheck = [
        nativeCtrlCmdKeybindings[isMac ? "mac" : "nonMac"].always,
        nativeCtrlCmdKeybindings[isMac ? "mac" : "nonMac"][event.shiftKey ? "withShift" : "noShift"]
      ];
      if (keySetsToCheck.some((set) => set.has(key))) {
        return;
      }
      if (isMac && event.ctrlKey && !event.shiftKey && key === " ") {
        return;
      }
    }
    event.preventDefault();
    event.stopPropagation();
    ipcRenderer.send("vscode:browserView:keydown", {
      key: event.key,
      keyCode: event.keyCode,
      code: event.code,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
      repeat: event.repeat
    });
  });
  const elementPicker = new ElementPicker(
    (el, comment) => {
      const elementId = track(el);
      ipcRenderer.send("vscode:browserView:elementPicked", { elementId, comment });
      return elementId;
    },
    (elementId) => ipcRenderer.send("vscode:browserView:elementCommentRemoved", elementId),
    () => ipcRenderer.send("vscode:browserView:elementPickStopped")
  );
  const areaPicker = new AreaPicker(
    (rect) => ipcRenderer.send("vscode:browserView:areaPicked", rect),
    () => ipcRenderer.send("vscode:browserView:areaPickStopped")
  );
  const trackedElementsById = /* @__PURE__ */ new Map();
  const finalizationRegistry = new FinalizationRegistry((id) => {
    trackedElementsById.delete(id);
  });
  function track(element) {
    const id = `el-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    trackedElementsById.set(id, new WeakRef(element));
    finalizationRegistry.register(element, id);
    return id;
  }
  let contextMenuTarget;
  window.addEventListener("contextmenu", (event) => {
    if (!event.isTrusted) {
      return;
    }
    const target = elementPicker.resolveContextMenuTarget(event);
    if (target) {
      const els = [target];
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) {
        els.push(selection.anchorNode, selection.focusNode);
      }
      contextMenuTarget = {
        ref: new WeakRef(findCommonVisibleAncestor(els) ?? target),
        anchor: { x: event.clientX, y: event.clientY }
      };
    } else {
      contextMenuTarget = void 0;
    }
  }, { capture: true });
  ipcRenderer.on("vscode:browserView:setTheme", (_event, theme) => {
    elementPicker.setTheme(theme);
    areaPicker.setTheme(theme);
  });
  ipcRenderer.on("vscode:browserView:setLocalizedStrings", (_event, strings) => {
    localizedStrings = strings;
    elementPicker.updateLocalizedStrings();
  });
  ipcRenderer.on("vscode:browserView:startElementPicker", (_event, options) => {
    elementPicker.start(options);
  });
  ipcRenderer.on("vscode:browserView:stopElementPicker", (_event) => {
    elementPicker.stop();
  });
  ipcRenderer.on("vscode:browserView:startAreaPicker", (_event) => {
    areaPicker.start();
  });
  ipcRenderer.on("vscode:browserView:stopAreaPicker", (_event) => {
    areaPicker.stop();
  });
  ipcRenderer.on("vscode:browserView:highlightElement", (_event, { elementId }) => {
    const element = getElement(elementId);
    if (element) {
      elementPicker.highlight(element);
    }
  });
  ipcRenderer.on("vscode:browserView:showElementComment", (_event, { elementId }) => {
    const element = getElement(elementId);
    if (element && contextMenuTarget) {
      elementPicker.comment(element, contextMenuTarget.anchor);
    }
  });
  ipcRenderer.on("vscode:browserView:hideHighlight", (_event) => {
    elementPicker.hideHighlight();
  });
  ipcRenderer.on("vscode:browserView:setElementComments", (_event, update) => {
    elementPicker.updateComments(update);
  });
  const getElement = (id) => {
    switch (id) {
      case "active":
        return document.activeElement;
      case "context-menu-target":
        return contextMenuTarget?.ref.deref() ?? null;
      default:
        return trackedElementsById.get(id)?.deref() ?? null;
    }
  };
  const isolatedHelpers = {
    /**
     * Get the currently selected text in the page.
     */
    getSelectedText() {
      try {
        return window.getSelection()?.toString() ?? "";
      } catch {
        return "";
      }
    }
  };
  const frameToken = `frame-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const mainWorldHelpers = {
    getElement,
    /** Opaque token exposed for CDP-side frame matching. */
    getFrameToken() {
      return frameToken;
    }
  };
  try {
    contextBridge.exposeInIsolatedWorld(999, "browserViewAPI", isolatedHelpers);
    contextBridge.exposeInMainWorld("__vscode_helpers", mainWorldHelpers);
  } catch (error) {
    console.error(error);
  }
  ipcRenderer.send("vscode:browserView:preloadReady", frameToken);
}
function findCommonVisibleAncestor(candidates) {
  const filteredNodes = candidates.filter((c) => !!c);
  const unique = [...new Set(filteredNodes.map((node) => node instanceof Element ? node : node.parentElement).filter((e) => !!e))];
  if (unique.length === 0) {
    return void 0;
  }
  const findVisible = (el) => {
    for (let cur = el; cur; cur = cur.parentElement) {
      const width = cur instanceof HTMLElement ? cur.offsetWidth : cur.clientWidth;
      const height = cur instanceof HTMLElement ? cur.offsetHeight : cur.clientHeight;
      if (width > 0 && height > 0) {
        return cur;
      }
    }
    return el;
  };
  if (unique.length === 1) {
    return findVisible(unique[0]);
  }
  const firstChain = [];
  for (let cur = unique[0]; cur; cur = cur.parentElement) {
    firstChain.unshift(cur);
  }
  let common = firstChain;
  for (let i = 1; i < unique.length; i++) {
    const otherChain = [];
    for (let cur = unique[i]; cur; cur = cur.parentElement) {
      otherChain.unshift(cur);
    }
    let j = 0;
    const limit = Math.min(common.length, otherChain.length);
    while (j < limit && common[j] === otherChain[j]) {
      j++;
    }
    common = common.slice(0, j);
    if (common.length === 0) {
      return void 0;
    }
  }
  return findVisible(common[common.length - 1]);
}
class ElementPicker {
  constructor(_onPicked, _onCommentRemoved, _onStopped) {
    this._onPicked = _onPicked;
    this._onCommentRemoved = _onCommentRemoved;
    this._onStopped = _onStopped;
    this._selectionActive = false;
    this._continuous = false;
    this._commentMode = false;
    this._comments = /* @__PURE__ */ new Map();
    this._pendingComments = /* @__PURE__ */ new Map();
    this._scheduledCommentPins = /* @__PURE__ */ new Map();
    this._dismissedCommentOnPointerDown = false;
    this._commentPointerInteraction = false;
    this._commentBackdropRequest = 0;
    this._commentPreviewCollapsing = false;
    this._reducedMotion = false;
    // --- Event handlers ---
    this._onPointerMove = (e) => {
      if (!this._selectionActive) {
        return;
      }
      const isOverPicker = e.composedPath().includes(this._shadowHost);
      if (this._commentTarget) {
        if (!isOverPicker) {
          this._commentPointerInteraction = true;
        }
        return;
      }
      const pendingComment = this._pendingCommentInteractionId ? this._pendingComments.get(this._pendingCommentInteractionId) : void 0;
      if (pendingComment) {
        if (!isOverPicker) {
          pendingComment.pointerInteraction = true;
        }
        return;
      }
      if (this._commentPreviewElementId || this._externalHighlightTarget || isOverPicker) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (!this._dragStart) {
        this._updateHighlight(this._pickElementAt(e.clientX, e.clientY));
        return;
      }
      const dx = Math.abs(e.clientX - this._dragStart.x);
      const dy = Math.abs(e.clientY - this._dragStart.y);
      if (dx < ElementPicker._DRAG_THRESHOLD_PX && dy < ElementPicker._DRAG_THRESHOLD_PX) {
        return;
      }
      const left = Math.min(this._dragStart.x, e.clientX);
      const top = Math.min(this._dragStart.y, e.clientY);
      this._dragbox.style.display = "block";
      this._dragbox.style.left = `${left}px`;
      this._dragbox.style.top = `${top}px`;
      this._dragbox.style.width = `${dx}px`;
      this._dragbox.style.height = `${dy}px`;
      this._updateHighlight(this._pickRegionAncestor({ x: left, y: top, width: dx, height: dy }));
    };
    this._onPointerLeave = () => {
      if (!this._selectionActive) {
        return;
      }
      if (this._commentTarget) {
        this._commentPointerInteraction = true;
        return;
      }
      const pendingComment = this._pendingCommentInteractionId ? this._pendingComments.get(this._pendingCommentInteractionId) : void 0;
      if (pendingComment) {
        pendingComment.pointerInteraction = true;
        return;
      }
      if (this._commentPreviewElementId || this._externalHighlightTarget) {
        return;
      }
      if (!this._dragStart) {
        this._updateHighlight(this._focusedTarget);
      }
    };
    this._onPointerDown = (e) => {
      if (!this._selectionActive) {
        return;
      }
      this._dismissedCommentOnPointerDown = false;
      if (e.composedPath().includes(this._shadowHost)) {
        return;
      }
      if (this._pendingCommentInteractionId) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (this._commentTarget) {
        this._dismissedCommentOnPointerDown = true;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      this._dragStart = { x: e.clientX, y: e.clientY };
      this._dragStartTarget = this._pickElementAt(e.clientX, e.clientY);
      if (this._cursorStylesheet) {
        this._cursorStylesheet.textContent = ElementPicker._CURSOR_CROSSHAIR;
      }
      e.preventDefault();
      e.stopPropagation();
    };
    this._onPointerUp = (e) => {
      if (!this._selectionActive) {
        return;
      }
      if (this._dismissedCommentOnPointerDown) {
        e.preventDefault();
        e.stopPropagation();
        const commentTarget = this._commentTarget;
        if (commentTarget) {
          window.setTimeout(() => {
            if (this._commentTarget === commentTarget) {
              this._finishCommentInteraction();
            }
          });
        }
        return;
      }
      if (e.composedPath().includes(this._shadowHost)) {
        return;
      }
      if (!this._dragStart) {
        return;
      }
      const dx = Math.abs(e.clientX - this._dragStart.x);
      const dy = Math.abs(e.clientY - this._dragStart.y);
      const start = this._dragStart;
      this._dragStart = void 0;
      if (this._cursorStylesheet) {
        this._cursorStylesheet.textContent = ElementPicker._CURSOR_DEFAULT;
      }
      if (dx < ElementPicker._DRAG_THRESHOLD_PX && dy < ElementPicker._DRAG_THRESHOLD_PX) {
        const target = this._dragStartTarget ?? this._pickElementAt(e.clientX, e.clientY);
        this._dragStartTarget = void 0;
        if (target) {
          this._commit(target, { x: e.clientX, y: e.clientY });
        }
      } else {
        this._dragStartTarget = void 0;
        this._dragbox.style.display = "none";
        this._updateHighlight(void 0);
        const left = Math.min(start.x, e.clientX);
        const top = Math.min(start.y, e.clientY);
        const ancestor = this._pickRegionAncestor({ x: left, y: top, width: dx, height: dy });
        if (ancestor) {
          this._commit(ancestor, { x: e.clientX, y: e.clientY });
        }
      }
      e.preventDefault();
      e.stopPropagation();
    };
    this._onClick = (e) => {
      if (!this._selectionActive) {
        return;
      }
      if (this._dismissedCommentOnPointerDown) {
        this._dismissedCommentOnPointerDown = false;
        e.preventDefault();
        e.stopPropagation();
        this._finishCommentInteraction();
        return;
      }
      if (e.composedPath().includes(this._shadowHost)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    };
    this._onFocusIn = (event) => {
      if (!this._selectionActive || this._commentTarget || this._pendingCommentInteractionId || this._externalHighlightTarget) {
        return;
      }
      if (event.composedPath().includes(this._shadowHost)) {
        return;
      }
      const focusedElement = this._getFocusedElement();
      this._focusedTarget = focusedElement?.matches(":focus-visible") ? focusedElement : void 0;
      this._updateHighlight(this._focusedTarget);
    };
    this._onWindowBlur = () => {
      if (!this._selectionActive || this._commentTarget || this._externalHighlightTarget) {
        return;
      }
      this._focusedTarget = void 0;
      this._updateHighlight(void 0);
    };
    this._onKeyDown = (e) => {
      if (!this._selectionActive) {
        return;
      }
      if (e.key === "Escape") {
        if (this._commentTarget) {
          const target = this._commentTarget;
          this._focusCommentTarget(target);
          this._finishCommentInteraction();
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        this.stop();
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === "Enter" && !e.isComposing) {
        if (this._pendingCommentInteractionId) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        const focusedElement = this._getFocusedElement();
        if (focusedElement) {
          e.preventDefault();
          e.stopPropagation();
          this._commit(focusedElement);
        }
      }
    };
    const shadowHost = document.createElement("div");
    shadowHost.setAttribute("data-vscode-pick-host", "");
    shadowHost.style.cssText = "position: absolute; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647; pointer-events: none;";
    const root = shadowHost.attachShadow({ mode: "closed" });
    root.appendChild(ElementPicker._buildStyle());
    this._shadowHost = shadowHost;
    const svgNamespace = "http://www.w3.org/2000/svg";
    const commentBackdrop = document.createElementNS(svgNamespace, "svg");
    commentBackdrop.classList.add("comment-backdrop");
    const backdropMaskId = `vscode-comment-cutout-${Math.random().toString(36).slice(2)}`;
    const backdropDefinitions = document.createElementNS(svgNamespace, "defs");
    const backdropMask = document.createElementNS(svgNamespace, "mask");
    backdropMask.id = backdropMaskId;
    backdropMask.setAttribute("maskUnits", "userSpaceOnUse");
    backdropMask.setAttribute("x", "0");
    backdropMask.setAttribute("y", "0");
    backdropMask.setAttribute("width", "100%");
    backdropMask.setAttribute("height", "100%");
    const backdropMaskFill = document.createElementNS(svgNamespace, "rect");
    backdropMaskFill.setAttribute("width", "100%");
    backdropMaskFill.setAttribute("height", "100%");
    backdropMaskFill.setAttribute("fill", "white");
    const backdropCutout = document.createElementNS(svgNamespace, "rect");
    backdropCutout.setAttribute("fill", "black");
    backdropMask.append(backdropMaskFill, backdropCutout);
    backdropDefinitions.appendChild(backdropMask);
    const backdropFill = document.createElementNS(svgNamespace, "rect");
    backdropFill.classList.add("comment-backdrop-fill");
    backdropFill.setAttribute("width", "100%");
    backdropFill.setAttribute("height", "100%");
    backdropFill.setAttribute("mask", `url(#${backdropMaskId})`);
    const highlightShape = document.createElementNS(svgNamespace, "rect");
    highlightShape.classList.add("highlight-shape");
    highlightShape.style.display = "none";
    commentBackdrop.append(backdropDefinitions, backdropFill, highlightShape);
    root.appendChild(commentBackdrop);
    this._commentBackdrop = commentBackdrop;
    this._commentBackdropCutout = backdropCutout;
    this._highlightShape = highlightShape;
    const highlight = document.createElement("div");
    highlight.className = "highlight";
    highlight.style.display = "none";
    root.appendChild(highlight);
    this._highlight = highlight;
    const commentPreviewRemoveButton = document.createElement("button");
    commentPreviewRemoveButton.className = "comment-preview-remove";
    commentPreviewRemoveButton.type = "button";
    const commentPreviewRemoveIcon = document.createElementNS(svgNamespace, "svg");
    commentPreviewRemoveIcon.setAttribute("viewBox", "0 0 16 16");
    commentPreviewRemoveIcon.setAttribute("fill", "currentColor");
    commentPreviewRemoveIcon.setAttribute("aria-hidden", "true");
    const commentPreviewRemoveIconPath = document.createElementNS(svgNamespace, "path");
    commentPreviewRemoveIconPath.setAttribute("d", "M3.854 3.146a.5.5 0 0 0-.708.708L7.293 8l-4.147 4.146a.5.5 0 0 0 .708.708L8 8.707l4.146 4.147a.5.5 0 0 0 .708-.708L8.707 8l4.147-4.146a.5.5 0 0 0-.708-.708L8 7.293 3.854 3.146Z");
    commentPreviewRemoveIcon.appendChild(commentPreviewRemoveIconPath);
    commentPreviewRemoveButton.appendChild(commentPreviewRemoveIcon);
    commentPreviewRemoveButton.title = localizedStrings.removeComment;
    commentPreviewRemoveButton.setAttribute("aria-label", localizedStrings.removeElementComment);
    commentPreviewRemoveButton.addEventListener("click", () => {
      if (this._commentPreviewElementId) {
        this._removeComment(this._commentPreviewElementId);
      }
    });
    this._commentPreviewRemoveButton = commentPreviewRemoveButton;
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    root.appendChild(overlay);
    this._overlay = overlay;
    const label = document.createElement("div");
    label.className = "label";
    label.style.display = "none";
    root.appendChild(label);
    this._label = label;
    const labelInfo = document.createElement("span");
    labelInfo.className = "label-info";
    label.appendChild(labelInfo);
    const labelSelector = document.createElement("span");
    labelSelector.className = "label-selector";
    labelInfo.appendChild(labelSelector);
    this._labelSelector = labelSelector;
    const labelClasses = document.createElement("span");
    labelClasses.className = "label-classes";
    labelInfo.appendChild(labelClasses);
    this._labelClasses = labelClasses;
    const labelDims = document.createElement("span");
    labelDims.className = "label-dims";
    label.appendChild(labelDims);
    this._labelDims = labelDims;
    const commentPreviewHitArea = document.createElement("div");
    commentPreviewHitArea.className = "comment-preview-hit-area";
    commentPreviewHitArea.style.display = "none";
    root.appendChild(commentPreviewHitArea);
    this._commentPreviewHitArea = commentPreviewHitArea;
    const commentPreview = document.createElement("div");
    commentPreview.className = "comment-surface comment-preview";
    commentPreview.style.display = "none";
    commentPreview.setAttribute("role", "note");
    const commentPreviewBody = document.createElement("span");
    commentPreviewBody.className = "comment-preview-body";
    commentPreview.appendChild(commentPreviewBody);
    commentPreview.appendChild(commentPreviewRemoveButton);
    commentPreviewHitArea.appendChild(commentPreview);
    this._commentPreview = commentPreview;
    this._commentPreviewBody = commentPreviewBody;
    commentPreviewHitArea.addEventListener("mouseenter", () => this._cancelCommentPreviewHide());
    commentPreviewHitArea.addEventListener("mouseleave", () => this._scheduleCommentPreviewHide());
    commentPreviewHitArea.addEventListener("focusin", () => this._cancelCommentPreviewHide());
    commentPreviewHitArea.addEventListener("focusout", () => this._scheduleCommentPreviewHide());
    const dragbox = document.createElement("div");
    dragbox.className = "dragbox";
    dragbox.style.display = "none";
    root.appendChild(dragbox);
    this._dragbox = dragbox;
    const commentLayer = document.createElement("div");
    commentLayer.className = "comment-layer";
    root.appendChild(commentLayer);
    this._commentLayer = commentLayer;
    const commentComposer = document.createElement("div");
    commentComposer.className = "comment-surface comment-composer";
    commentComposer.style.display = "none";
    commentComposer.setAttribute("role", "dialog");
    commentComposer.setAttribute("aria-label", localizedStrings.commentOnSelectedElement);
    commentComposer.setAttribute("aria-modal", "true");
    commentLayer.appendChild(commentComposer);
    this._commentComposer = commentComposer;
    const commentInput = document.createElement("textarea");
    commentInput.className = "comment-input";
    commentInput.rows = 1;
    commentInput.placeholder = localizedStrings.addCommentPlaceholder;
    commentInput.setAttribute("aria-label", localizedStrings.commentOnSelectedElement);
    commentInput.addEventListener("input", () => this._layoutCommentInput());
    commentInput.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Enter" && !event.isComposing) {
        event.preventDefault();
        this._submitComment();
      }
    });
    commentInput.addEventListener("keypress", (event) => event.stopPropagation());
    commentInput.addEventListener("keyup", (event) => event.stopPropagation());
    commentComposer.appendChild(commentInput);
    this._commentInput = commentInput;
    const sendButton = document.createElement("button");
    sendButton.className = "comment-send";
    sendButton.type = "button";
    const sendButtonIcon = document.createElementNS(svgNamespace, "svg");
    sendButtonIcon.setAttribute("viewBox", "0 0 16 16");
    sendButtonIcon.setAttribute("fill", "currentColor");
    sendButtonIcon.setAttribute("aria-hidden", "true");
    const sendButtonIconPath = document.createElementNS(svgNamespace, "path");
    sendButtonIconPath.setAttribute("d", "M8.5 3a.5.5 0 0 0-1 0v4.5H3a.5.5 0 0 0 0 1h4.5V13a.5.5 0 0 0 1 0V8.5H13a.5.5 0 0 0 0-1H8.5V3Z");
    sendButtonIcon.appendChild(sendButtonIconPath);
    sendButton.appendChild(sendButtonIcon);
    sendButton.title = localizedStrings.addComment;
    sendButton.setAttribute("aria-label", localizedStrings.addComment);
    sendButton.addEventListener("click", () => this._submitComment());
    commentComposer.appendChild(sendButton);
    this._commentSendButton = sendButton;
    commentComposer.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") {
        return;
      }
      if (event.shiftKey && event.target === commentInput) {
        event.preventDefault();
        sendButton.focus();
      } else if (!event.shiftKey && event.target === sendButton) {
        event.preventDefault();
        commentInput.focus();
      }
    });
    window.addEventListener("scroll", () => this._onScrollOrResize(), { passive: true, capture: true });
    window.addEventListener("resize", () => this._onScrollOrResize());
  }
  static {
    this._DRAG_THRESHOLD_PX = 4;
  }
  static {
    this._COMMENT_PIN_SIZE = 22;
  }
  static {
    this._COMMENT_PIN_RESTORE_FRAMES = 5;
  }
  static {
    this._COMMENT_PIN_RESTORE_TIMEOUT = 100;
  }
  static {
    this._COMMENT_PREVIEW_HIT_PADDING = ElementPicker._COMMENT_PIN_SIZE / 2;
  }
  static {
    this._COMMENT_PREVIEW_HIDE_DELAY = 80;
  }
  static {
    this._COMMENT_SURFACE_ANIMATION_DURATION = 140;
  }
  static {
    this._COMMENT_SUPPORTING_FADE_DURATION = 120;
  }
  static {
    this._CURSOR_DEFAULT = "/* VS Code injected style */ * { cursor: default !important; }";
  }
  static {
    this._CURSOR_CROSSHAIR = "/* VS Code injected style */ * { cursor: crosshair !important; }";
  }
  start(options) {
    if (this._selectionActive) {
      this._updateSelectionOptions(options);
      return true;
    }
    this._commentMode = options.mode === commentElementSelectionMode;
    this._continuous = options.continuous ?? false;
    this._ensureMounted();
    this._selectionActive = true;
    this._overlay.style.display = "block";
    const cursorStyle = document.createElement("style");
    cursorStyle.textContent = ElementPicker._CURSOR_DEFAULT;
    document.head.appendChild(cursorStyle);
    this._cursorStylesheet = cursorStyle;
    window.addEventListener("pointermove", this._onPointerMove, true);
    document.addEventListener("pointerleave", this._onPointerLeave, true);
    window.addEventListener("pointerdown", this._onPointerDown, true);
    window.addEventListener("pointerup", this._onPointerUp, true);
    window.addEventListener("click", this._onClick, true);
    window.addEventListener("contextmenu", this._onClick, true);
    window.addEventListener("focusin", this._onFocusIn, true);
    window.addEventListener("blur", this._onWindowBlur);
    window.addEventListener("keydown", this._onKeyDown, true);
    if (!this._externalHighlightTarget) {
      const focusedElement = this._getFocusedElement();
      this._focusedTarget = options.highlightFocusedElement ? focusedElement : void 0;
      this._updateHighlight(this._focusedTarget);
    }
    return true;
  }
  _updateSelectionOptions(options) {
    const wasCommentMode = this._commentMode;
    this._commentMode = options.mode === commentElementSelectionMode;
    this._continuous = options.continuous ?? false;
    if (wasCommentMode && !this._commentMode && this._commentTarget) {
      this._closeCommentComposer();
    }
    if (options.highlightFocusedElement && !this._commentTarget && !this._commentPreviewElementId && !this._externalHighlightTarget) {
      this._focusedTarget = this._getFocusedElement();
      this._updateHighlight(this._focusedTarget);
    }
  }
  stop() {
    if (!this._selectionActive) {
      return;
    }
    this._hideActiveCommentPreview();
    this._selectionActive = false;
    this._closeCommentComposer();
    this._overlay.style.display = "none";
    this._cursorStylesheet?.remove();
    this._cursorStylesheet = void 0;
    window.removeEventListener("pointermove", this._onPointerMove, true);
    document.removeEventListener("pointerleave", this._onPointerLeave, true);
    window.removeEventListener("pointerdown", this._onPointerDown, true);
    window.removeEventListener("pointerup", this._onPointerUp, true);
    window.removeEventListener("click", this._onClick, true);
    window.removeEventListener("contextmenu", this._onClick, true);
    window.removeEventListener("focusin", this._onFocusIn, true);
    window.removeEventListener("blur", this._onWindowBlur);
    window.removeEventListener("keydown", this._onKeyDown, true);
    this._highlight.style.display = "none";
    this._label.style.display = "none";
    this._dragbox.style.display = "none";
    this._dragStart = void 0;
    this._dragStartTarget = void 0;
    this._dismissedCommentOnPointerDown = false;
    this._highlightTarget = void 0;
    this._focusedTarget = void 0;
    if (this._externalHighlightTarget) {
      this._updateHighlight(this._externalHighlightTarget);
    }
    this._onStopped();
    this._unmountWhenIdle();
  }
  /**
   * Update the theme colors applied to the overlay.
   * Can be called at any time; takes effect immediately.
   */
  setTheme(theme) {
    ElementPicker._applyTheme(this._shadowHost, theme);
    this._reducedMotion = theme.reducedMotion ?? false;
    this._shadowHost.classList.toggle("reduce-motion", this._reducedMotion);
  }
  updateLocalizedStrings() {
    this._applyLocalizedStrings();
  }
  resolveContextMenuTarget(event) {
    if (this._commentPreviewElementId && event.composedPath().includes(this._shadowHost)) {
      this._hideActiveCommentPreview();
      return this._pickElementAt(event.clientX, event.clientY);
    }
    return event.target instanceof Element ? event.target : void 0;
  }
  /**
   * Highlight a specific element without starting a pick session.
   * Mounts the shadow host if not already in the document.
   */
  highlight(element) {
    this._ensureMounted();
    this._externalHighlightTarget = element;
    this._hideActiveCommentPreview();
    this._updateHighlight(element);
  }
  /**
   * Hide any current highlight. If no pick session is active, also
   * removes the shadow host from the document.
   */
  hideHighlight() {
    this._externalHighlightTarget = void 0;
    if (this._commentTarget) {
      return;
    }
    this._updateHighlight(void 0);
    this._unmountWhenIdle();
  }
  comment(element, anchor) {
    this._externalHighlightTarget = void 0;
    if (this._selectionActive) {
      this.stop();
    }
    this.start({ mode: commentElementSelectionMode });
    this._showCommentComposer(element, anchor, true);
  }
  updateComments(update) {
    if (update.comments) {
      const incoming = new Map(update.comments.map((comment, index) => [comment.elementId, { body: comment.body, ordinal: index + 1 }]));
      for (const [elementId, comment] of this._comments) {
        const incomingComment = incoming.get(elementId);
        if (!incomingComment) {
          if (this._commentPreviewElementId === elementId) {
            this._hideActiveCommentPreview();
          }
          comment.pin.remove();
          this._comments.delete(elementId);
        } else {
          comment.ordinal = incomingComment.ordinal;
          if (incomingComment.body === comment.body) {
            continue;
          }
          comment.body = incomingComment.body;
          if (this._commentPreviewElementId === elementId) {
            this._setCommentPreviewBody(incomingComment.body);
            this._renderHighlight(comment.target);
          }
        }
      }
      for (const [elementId, comment] of incoming) {
        if (this._comments.has(elementId)) {
          continue;
        }
        const pending = this._pendingComments.get(elementId);
        if (pending) {
          this._scheduleCommentPin(elementId, comment.body, comment.ordinal);
        }
      }
      for (const elementId of this._scheduledCommentPins.keys()) {
        if (!incoming.has(elementId)) {
          this._discardPendingComment(elementId);
        }
      }
    }
    for (const elementId of update.pendingCommentIdsToDiscard ?? []) {
      this._discardPendingComment(elementId);
    }
    this._updateCommentPinNumbers();
    this._unmountWhenIdle();
  }
  _onScrollOrResize() {
    if (this._commentPreviewCollapsing) {
      this._hideActiveCommentPreview();
    }
    this._cancelCommentAnimations();
    if (this._highlightTarget) {
      this._renderHighlight(this._highlightTarget);
    }
    if (this._commentBackdropTarget) {
      this._layoutCommentBackdrop(this._commentBackdropTarget);
    }
    for (const comment of this._comments.values()) {
      this._layoutCommentPin(comment);
    }
  }
  // --- Picking helpers ---
  _getFocusedElement() {
    if (!document.hasFocus()) {
      return void 0;
    }
    let activeElement = document.activeElement;
    while (activeElement?.shadowRoot?.activeElement) {
      activeElement = activeElement.shadowRoot.activeElement;
    }
    if (!activeElement || activeElement === document.body || activeElement === document.documentElement || activeElement === this._shadowHost || activeElement instanceof HTMLIFrameElement) {
      return void 0;
    }
    return activeElement;
  }
  /** Return the page element under a viewport point, skipping our own overlay host. */
  _pickElementAt(x, y) {
    const candidates = document.elementsFromPoint(x, y);
    for (const el of candidates) {
      if (el === this._shadowHost || this._shadowHost.contains(el)) {
        continue;
      }
      return el;
    }
    return void 0;
  }
  /**
   * Resolve the element that "covers" a drag rectangle.
   *
   * Samples `elementFromPoint` at the 4 corners, 4 edge midpoints, and
   * center, then returns their deepest common ancestor.
   */
  _pickRegionAncestor(rect) {
    const { x, y, width, height } = rect;
    const x2 = x + width;
    const y2 = y + height;
    const cx = x + width / 2;
    const cy = y + height / 2;
    const samples = [];
    for (const [sx, sy] of [
      [x, y],
      [x2, y],
      [x, y2],
      [x2, y2],
      // corners
      [cx, y],
      [cx, y2],
      [x, cy],
      [x2, cy],
      // edge midpoints
      [cx, cy]
      // center
    ]) {
      const el = this._pickElementAt(sx, sy);
      if (el) {
        samples.push(el);
      }
    }
    return findCommonVisibleAncestor(samples);
  }
  // --- Highlight ---
  _renderHighlight(target) {
    const highlight = this._highlight;
    const label = this._label;
    const rect = target.getBoundingClientRect();
    const scrollX = window.scrollX || 0;
    const scrollY = window.scrollY || 0;
    const viewportHeight = window.innerHeight;
    const viewportWidth = document.documentElement.clientWidth;
    const visibleRect = this._getVisibleTargetBounds(rect);
    const labelHeight = 22;
    highlight.style.display = "block";
    highlight.style.left = `${rect.left + scrollX}px`;
    highlight.style.top = `${rect.top + scrollY}px`;
    highlight.style.width = `${rect.width}px`;
    highlight.style.height = `${rect.height}px`;
    this._highlightShape.style.display = "block";
    this._highlightShape.setAttribute("x", `${visibleRect.x}`);
    this._highlightShape.setAttribute("y", `${visibleRect.y}`);
    this._highlightShape.setAttribute("width", `${visibleRect.width}`);
    this._highlightShape.setAttribute("height", `${visibleRect.height}`);
    this._highlightShape.setAttribute("rx", "2");
    const tagName = String(target.tagName || "").toLowerCase();
    const idPart = target.id ? `#${target.id}` : "";
    const classPart = target.classList.length ? "." + [...target.classList].join(".") : "";
    this._labelSelector.textContent = tagName + idPart;
    this._labelClasses.textContent = classPart;
    this._labelDims.textContent = `${Math.round(rect.width)} \xD7 ${Math.round(rect.height)}`;
    label.style.display = "inline-flex";
    const idealTop = rect.top - labelHeight;
    const labelTop = Math.max(0, Math.min(viewportHeight - labelHeight, idealTop));
    label.style.left = "0";
    const naturalWidth = label.offsetWidth;
    const idealLeft = rect.left;
    const labelLeft = Math.max(0, Math.min(idealLeft, viewportWidth - naturalWidth));
    label.style.left = `${labelLeft}px`;
    label.style.top = `${labelTop}px`;
    if (this._commentPreview.style.display !== "none") {
      const previewPlacement = this._layoutCommentSurface(this._commentPreview, visibleRect, viewportWidth, viewportHeight);
      if (this._commentPreviewElementId && previewPlacement === "above" && this._elementsOverlap(label, this._commentPreview)) {
        label.style.top = `${Math.max(0, Math.min(viewportHeight - labelHeight, visibleRect.bottom + 2))}px`;
      }
    }
    if (this._commentComposer.style.display !== "none") {
      this._layoutCommentSurface(this._commentComposer, visibleRect, viewportWidth, viewportHeight);
    }
  }
  _elementsOverlap(first, second) {
    const firstBounds = first.getBoundingClientRect();
    const secondBounds = second.getBoundingClientRect();
    return firstBounds.left < secondBounds.right && firstBounds.right > secondBounds.left && firstBounds.top < secondBounds.bottom && firstBounds.bottom > secondBounds.top;
  }
  _getVisibleTargetBounds(rect) {
    const left = Math.max(0, Math.min(rect.left, window.innerWidth));
    const right = Math.max(left, Math.min(rect.right, window.innerWidth));
    const top = Math.max(0, Math.min(rect.top, window.innerHeight));
    const bottom = Math.max(top, Math.min(rect.bottom, window.innerHeight));
    return new DOMRect(left, top, right - left, bottom - top);
  }
  _layoutCommentSurface(surface, targetBounds, viewportWidth, viewportHeight) {
    if (surface === this._commentPreview) {
      surface.style.width = "max-content";
      surface.style.minWidth = "0";
      surface.style.maxWidth = `${Math.min(320, viewportWidth - 16)}px`;
      const comment = this._commentPreviewElementId ? this._comments.get(this._commentPreviewElementId) : void 0;
      if (comment) {
        const pinBounds = comment.pin.getBoundingClientRect();
        return this._layoutCommentSurfaceAtAnchor(
          surface,
          { x: pinBounds.left + pinBounds.width / 2, y: pinBounds.top + pinBounds.height / 2 },
          viewportWidth,
          viewportHeight
        );
      }
    } else if (surface === this._commentComposer && this._commentAnchor) {
      surface.style.maxWidth = `${Math.min(320, viewportWidth - 16)}px`;
      return this._layoutCommentSurfaceAtAnchor(
        surface,
        { x: this._commentAnchor.x - window.scrollX, y: this._commentAnchor.y - window.scrollY },
        viewportWidth,
        viewportHeight
      );
    }
    const surfaceHeight = surface.offsetHeight;
    const belowTop = targetBounds.bottom;
    const placement = belowTop + surfaceHeight <= viewportHeight - 8 ? "below" : "above";
    const surfaceTop = belowTop + surfaceHeight <= viewportHeight - 8 ? belowTop : Math.max(0, targetBounds.top - surfaceHeight);
    const surfaceWidth = surface.offsetWidth;
    const alignLeft = targetBounds.left + surfaceWidth <= viewportWidth;
    const alignment = alignLeft ? "left" : "right";
    const surfaceLeft = alignLeft ? Math.max(0, targetBounds.left) : Math.max(0, targetBounds.right - surfaceWidth);
    surface.dataset.attachmentCorner = `${placement === "below" ? "top" : "bottom"}-${alignment}`;
    this._setCommentSurfacePosition(surface, surfaceLeft, surfaceTop);
    return placement;
  }
  _layoutCommentSurfaceAtAnchor(surface, anchor, viewportWidth, viewportHeight) {
    const viewportInset = 8;
    let surfaceWidth = surface.offsetWidth;
    const availableRight = Math.max(0, viewportWidth - viewportInset - anchor.x);
    const availableLeft = Math.max(0, anchor.x - viewportInset);
    const opensRight = surfaceWidth <= availableRight || surfaceWidth > availableLeft && availableRight >= availableLeft;
    const availableWidth = opensRight ? availableRight : availableLeft;
    if (surfaceWidth > availableWidth) {
      surface.style.maxWidth = `${availableWidth}px`;
      surfaceWidth = surface.offsetWidth;
    }
    const surfaceHeight = surface.offsetHeight;
    const availableBelow = Math.max(0, viewportHeight - viewportInset - anchor.y);
    const availableAbove = Math.max(0, anchor.y - viewportInset);
    const opensAbove = surfaceHeight <= availableAbove || surfaceHeight > availableBelow && availableAbove >= availableBelow;
    const opensBelow = !opensAbove;
    const placement = opensBelow ? "below" : "above";
    const alignment = opensRight ? "left" : "right";
    surface.dataset.attachmentCorner = `${opensBelow ? "top" : "bottom"}-${alignment}`;
    const surfaceLeft = opensRight ? anchor.x : anchor.x - surfaceWidth;
    const surfaceTop = opensBelow ? anchor.y : Math.max(viewportInset, anchor.y - surfaceHeight);
    this._setCommentSurfacePosition(surface, surfaceLeft, surfaceTop);
    return placement;
  }
  _setCommentSurfacePosition(surface, left, top) {
    if (surface !== this._commentPreview) {
      surface.style.left = `${left}px`;
      surface.style.top = `${top}px`;
      return;
    }
    const padding = ElementPicker._COMMENT_PREVIEW_HIT_PADDING;
    this._commentPreviewHitArea.style.left = `${left - padding}px`;
    this._commentPreviewHitArea.style.top = `${top - padding}px`;
    this._commentPreviewHitArea.style.width = `${surface.offsetWidth + padding * 2}px`;
    this._commentPreviewHitArea.style.height = `${surface.offsetHeight + padding * 2}px`;
    surface.style.left = `${padding}px`;
    surface.style.top = `${padding}px`;
  }
  _updateHighlight(target) {
    this._highlightTarget = target;
    if (!target) {
      this._highlight.style.display = "none";
      this._highlightShape.style.display = "none";
      this._label.style.display = "none";
      return;
    }
    this._renderHighlight(target);
  }
  // --- Commit ---
  _commit(target, anchor) {
    if (!this._selectionActive) {
      return;
    }
    if (this._commentMode) {
      this._showCommentComposer(target, anchor ?? this._getDefaultCommentAnchor(target), anchor !== void 0);
      return;
    }
    requestAnimationFrame(() => {
      if (!this._continuous) {
        this.stop();
      } else {
        this._updateHighlight(void 0);
      }
      this._onPicked(target);
    });
  }
  _getDefaultCommentAnchor(target) {
    const bounds = target.getBoundingClientRect();
    return { x: bounds.left, y: bounds.bottom };
  }
  _showCommentComposer(target, anchor, pointerInteraction = false) {
    this._externalHighlightTarget = void 0;
    this._hideActiveCommentPreview();
    this._commentTarget = target;
    this._commentPointerInteraction = pointerInteraction;
    this._commentAnchor = {
      x: anchor.x + window.scrollX,
      y: anchor.y + window.scrollY
    };
    this._showCommentBackdrop(target);
    this._commentLayer.classList.add("composing");
    this._commentInput.value = "";
    this._commentComposer.style.display = "flex";
    this._resizeCommentInput();
    this._updateHighlight(target);
    this._animateCommentComposer();
    this._commentInput.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      if (this._commentTarget === target) {
        this._commentInput.focus({ preventScroll: true });
      }
    });
  }
  _animateCommentComposer() {
    if (this._reducedMotion) {
      return;
    }
    this._cancelCommentAnimations();
    this._commentAnimation = {
      surface: this._animateCommentSurface(this._commentComposer),
      supporting: []
    };
  }
  _setCommentSurfaceTransformOrigin(surface) {
    const [verticalOrigin, horizontalOrigin] = (surface.dataset.attachmentCorner ?? "top-left").split("-");
    surface.style.transformOrigin = `${horizontalOrigin} ${verticalOrigin}`;
  }
  _closeCommentComposer() {
    this._commentTarget = void 0;
    this._commentAnchor = void 0;
    this._hideCommentBackdrop();
    this._commentLayer.classList.remove("composing");
    this._commentComposer.style.display = "none";
    this._commentInput.value = "";
    this._cancelCommentAnimations();
    this._updateHighlight(void 0);
  }
  _finishCommentInteraction() {
    if (this._continuous) {
      this._closeCommentComposer();
    } else {
      this.stop();
    }
  }
  _submitComment() {
    const target = this._commentTarget;
    const anchor = this._commentAnchor;
    if (!target || !anchor) {
      return;
    }
    const body = this._commentInput.value.replace(/\r?\n/g, " ");
    const pendingComment = {
      target,
      anchor,
      body,
      pointerInteraction: this._commentPointerInteraction
    };
    this._commentLayer.classList.add("comment-capture-pending");
    this._finishCommentInteraction();
    const elementId = this._onPicked(target, body);
    this._pendingComments.set(elementId, pendingComment);
    this._pendingCommentInteractionId = elementId;
  }
  _restoreInteractionAfterComment(elementId, pending) {
    if (this._pendingCommentInteractionId === elementId) {
      this._pendingCommentInteractionId = void 0;
      this._commentLayer.classList.remove("comment-capture-pending");
    }
    if (this._commentTarget) {
      return;
    }
    if (!pending.pointerInteraction) {
      this._focusCommentTarget(pending.target);
    }
  }
  _focusCommentTarget(target) {
    if (!target.isConnected || !(target instanceof HTMLElement || target instanceof SVGElement)) {
      return;
    }
    const hadTabIndex = target.hasAttribute("tabindex");
    if (!hadTabIndex) {
      target.tabIndex = -1;
    }
    target.focus({ preventScroll: true });
    if (!hadTabIndex) {
      target.removeAttribute("tabindex");
    }
  }
  _discardPendingComment(elementId) {
    const pending = this._pendingComments.get(elementId);
    this._pendingComments.delete(elementId);
    this._cancelScheduledCommentPin(elementId);
    if (pending) {
      this._restoreInteractionAfterComment(elementId, pending);
    }
  }
  _cancelScheduledCommentPin(elementId) {
    const scheduled = this._scheduledCommentPins.get(elementId);
    if (!scheduled) {
      return;
    }
    window.clearTimeout(scheduled.timeout);
    cancelAnimationFrame(scheduled.animationFrame);
    this._scheduledCommentPins.delete(elementId);
  }
  _scheduleCommentPin(elementId, body, ordinal) {
    const existing = this._scheduledCommentPins.get(elementId);
    if (existing) {
      existing.body = body;
      existing.ordinal = ordinal;
      return;
    }
    const scheduled = { body, ordinal, animationFrame: 0, timeout: 0 };
    this._scheduledCommentPins.set(elementId, scheduled);
    let frameCount = 0;
    const finish = () => {
      if (this._scheduledCommentPins.get(elementId) !== scheduled) {
        return;
      }
      this._cancelScheduledCommentPin(elementId);
      const pending = this._pendingComments.get(elementId);
      if (pending) {
        this._createCommentPin(elementId, pending.target, pending.anchor, scheduled.body, scheduled.ordinal);
      }
    };
    const waitForFrame = () => {
      if (this._scheduledCommentPins.get(elementId) !== scheduled) {
        return;
      }
      frameCount++;
      if (frameCount >= ElementPicker._COMMENT_PIN_RESTORE_FRAMES) {
        finish();
      } else {
        scheduled.animationFrame = requestAnimationFrame(waitForFrame);
      }
    };
    scheduled.timeout = window.setTimeout(finish, ElementPicker._COMMENT_PIN_RESTORE_TIMEOUT);
    scheduled.animationFrame = requestAnimationFrame(waitForFrame);
  }
  _createCommentPin(elementId, target, anchor, body, ordinal) {
    this._ensureMounted();
    const existing = this._comments.get(elementId);
    if (existing && this._commentPreviewElementId === elementId) {
      this._hideActiveCommentPreview();
    }
    existing?.pin.remove();
    const pending = this._pendingComments.get(elementId);
    this._pendingComments.delete(elementId);
    const rect = target.getBoundingClientRect();
    const offset = {
      x: anchor.x - (rect.left + window.scrollX),
      y: anchor.y - (rect.top + window.scrollY)
    };
    const pin = document.createElement("div");
    pin.className = "comment-pin";
    pin.tabIndex = 0;
    pin.setAttribute("role", "note");
    const bubble = document.createElement("span");
    bubble.className = "comment-pin-bubble";
    const numberElement = document.createElement("span");
    numberElement.className = "comment-pin-number";
    bubble.appendChild(numberElement);
    pin.appendChild(bubble);
    const show = () => {
      if (this._commentTarget || this._pendingCommentInteractionId || this._externalHighlightTarget) {
        return;
      }
      this._showCommentPreview(elementId, target, body);
    };
    pin.addEventListener("pointermove", show);
    pin.addEventListener("focusin", show);
    pin.addEventListener("focusout", () => this._scheduleCommentPreviewHide());
    this._commentLayer.appendChild(pin);
    const comment = { target, pin, numberElement, body, ordinal, offset };
    this._comments.set(elementId, comment);
    this._updateCommentPinNumbers();
    this._layoutCommentPin(comment);
    if (pending) {
      this._restoreInteractionAfterComment(elementId, pending);
    }
  }
  _updateCommentPinNumbers() {
    for (const comment of this._comments.values()) {
      const numberLabel = String(comment.ordinal);
      comment.numberElement.textContent = numberLabel;
      comment.pin.title = comment.body || this._formatLocalizedString(localizedStrings.elementComment, numberLabel);
      comment.pin.setAttribute(
        "aria-label",
        comment.body ? this._formatLocalizedString(localizedStrings.elementCommentWithBody, numberLabel, comment.body) : this._formatLocalizedString(localizedStrings.emptyElementComment, numberLabel)
      );
    }
  }
  _applyLocalizedStrings() {
    this._commentPreviewRemoveButton.title = localizedStrings.removeComment;
    this._commentPreviewRemoveButton.setAttribute("aria-label", localizedStrings.removeElementComment);
    this._commentComposer.setAttribute("aria-label", localizedStrings.commentOnSelectedElement);
    this._commentInput.placeholder = localizedStrings.addCommentPlaceholder;
    this._commentInput.setAttribute("aria-label", localizedStrings.commentOnSelectedElement);
    this._commentSendButton.title = localizedStrings.addComment;
    this._commentSendButton.setAttribute("aria-label", localizedStrings.addComment);
    this._updateCommentPinNumbers();
  }
  _formatLocalizedString(template, ...values) {
    return template.replace(/\{(\d+)\}/g, (_, index) => values[Number(index)] ?? "");
  }
  _layoutCommentPin(comment) {
    const rect = comment.target.getBoundingClientRect();
    const x = rect.left + window.scrollX + comment.offset.x;
    const y = rect.top + window.scrollY + comment.offset.y;
    const scrollingElement = document.scrollingElement ?? document.documentElement;
    const halfWidth = comment.pin.offsetWidth / 2;
    const halfHeight = comment.pin.offsetHeight / 2;
    const clampedX = Math.max(halfWidth, Math.min(x, scrollingElement.scrollWidth - halfWidth));
    const clampedY = Math.max(halfHeight, Math.min(y, scrollingElement.scrollHeight - halfHeight));
    comment.pin.style.left = `${clampedX}px`;
    comment.pin.style.top = `${clampedY}px`;
  }
  _showCommentPreview(elementId, target, fallbackBody) {
    if (this._pendingCommentInteractionId || this._commentPreviewCollapsing) {
      return;
    }
    if (this._commentPreviewElementId === elementId) {
      this._cancelCommentPreviewHide();
      return;
    }
    this._hideActiveCommentPreview();
    this._commentPreviewElementId = elementId;
    const comment = this._comments.get(elementId);
    if (comment) {
      comment.pin.classList.add("previewing");
      comment.pin.after(this._commentPreviewHitArea);
    }
    const body = comment?.body ?? fallbackBody;
    this._setCommentPreviewBody(body);
    this._shadowHost.classList.add("comment-preview-active");
    this._updateHighlight(target);
    this._showCommentBackdrop(target);
    if (comment) {
      this._animateCommentPreview();
    }
  }
  _setCommentPreviewBody(body) {
    this._commentPreviewBody.textContent = body;
    this._commentPreview.title = body;
    this._commentPreview.classList.toggle("empty", !body);
    this._commentPreviewHitArea.style.display = "block";
    this._commentPreview.style.display = "flex";
  }
  _animateCommentPreview(collapsing = false) {
    if (this._reducedMotion) {
      return void 0;
    }
    const previewAnimation = this._animateCommentSurface(this._commentPreview, collapsing);
    const supportingKeyframes = collapsing ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1 }];
    const supportingAnimations = [];
    for (const element of [this._highlightShape, this._label]) {
      if (element.style.display === "none") {
        continue;
      }
      const animation = element.animate(supportingKeyframes, { duration: ElementPicker._COMMENT_SUPPORTING_FADE_DURATION, easing: "linear", fill: "both" });
      supportingAnimations.push(animation);
    }
    this._commentAnimation = { surface: previewAnimation, supporting: supportingAnimations };
    return previewAnimation;
  }
  _animateCommentSurface(surface, collapsing = false) {
    this._setCommentSurfaceTransformOrigin(surface);
    return surface.animate(
      collapsing ? [{ transform: "scale(1)" }, { transform: "scale(0)" }] : [{ transform: "scale(0)" }, { transform: "scale(1)" }],
      { duration: ElementPicker._COMMENT_SURFACE_ANIMATION_DURATION, easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "forwards" }
    );
  }
  _scheduleCommentPreviewHide() {
    if (this._commentPreviewCollapsing) {
      return;
    }
    this._cancelCommentPreviewHide();
    this._commentPreviewHideTimeout = window.setTimeout(() => {
      this._commentPreviewHideTimeout = void 0;
      const comment = this._commentPreviewElementId ? this._comments.get(this._commentPreviewElementId) : void 0;
      const pinFocused = comment?.pin.matches(":focus-within") ?? false;
      const hitAreaActive = this._commentPreviewHitArea.matches(":hover, :focus-within");
      if (pinFocused || hitAreaActive) {
        return;
      }
      this._collapseActiveCommentPreview();
    }, ElementPicker._COMMENT_PREVIEW_HIDE_DELAY);
  }
  _cancelCommentPreviewHide() {
    if (this._commentPreviewHideTimeout !== void 0) {
      window.clearTimeout(this._commentPreviewHideTimeout);
      this._commentPreviewHideTimeout = void 0;
    }
  }
  _collapseActiveCommentPreview() {
    if (this._commentPreviewCollapsing) {
      return;
    }
    const elementId = this._commentPreviewElementId;
    const comment = elementId ? this._comments.get(elementId) : void 0;
    if (!elementId || !comment || this._reducedMotion) {
      this._hideActiveCommentPreview();
      return;
    }
    this._commentPreviewCollapsing = true;
    this._shadowHost.classList.add("comment-preview-collapsing");
    this._hideCommentBackdrop();
    const commentAnimation = this._commentAnimation;
    let surfaceAnimation;
    if (commentAnimation) {
      surfaceAnimation = commentAnimation.surface;
      surfaceAnimation.reverse();
      for (const animation of commentAnimation.supporting) {
        animation.reverse();
      }
    } else {
      surfaceAnimation = this._animateCommentPreview(true);
    }
    if (!surfaceAnimation) {
      this._hideActiveCommentPreview();
      return;
    }
    surfaceAnimation.onfinish = () => {
      if (this._commentPreviewCollapsing && this._commentPreviewElementId === elementId) {
        this._commentPreviewCollapsing = false;
        this._hideActiveCommentPreview();
      }
    };
  }
  _cancelCommentAnimations() {
    if (!this._commentAnimation) {
      return;
    }
    this._commentAnimation.surface.cancel();
    for (const animation of this._commentAnimation.supporting) {
      animation.cancel();
    }
    this._commentAnimation = void 0;
  }
  _hideActiveCommentPreview() {
    this._cancelCommentPreviewHide();
    this._commentPreviewCollapsing = false;
    this._shadowHost.classList.remove("comment-preview-collapsing");
    if (this._commentPreviewElementId) {
      this._comments.get(this._commentPreviewElementId)?.pin.classList.remove("previewing");
    }
    this._commentPreviewElementId = void 0;
    this._shadowHost.classList.remove("comment-preview-active");
    this._commentPreviewHitArea.style.display = "none";
    this._commentPreview.style.display = "none";
    this._hideCommentBackdrop();
    if (!this._commentTarget) {
      this._updateHighlight(this._externalHighlightTarget);
    }
    this._cancelCommentAnimations();
  }
  _removeComment(elementId) {
    const comment = this._comments.get(elementId);
    if (!comment) {
      return;
    }
    this._hideActiveCommentPreview();
    comment.pin.remove();
    this._comments.delete(elementId);
    this._updateCommentPinNumbers();
    this._unmountWhenIdle();
    this._onCommentRemoved(elementId);
  }
  _layoutCommentInput() {
    this._resizeCommentInput();
    this._layoutCommentComposer();
  }
  _resizeCommentInput() {
    this._commentInput.style.height = "auto";
    this._commentInput.style.height = `${Math.min(this._commentInput.scrollHeight, 96)}px`;
  }
  _layoutCommentBackdrop(target) {
    const rect = this._getVisibleTargetBounds(target.getBoundingClientRect());
    this._commentBackdropCutout.setAttribute("x", `${rect.x}`);
    this._commentBackdropCutout.setAttribute("y", `${rect.y}`);
    this._commentBackdropCutout.setAttribute("width", `${rect.width}`);
    this._commentBackdropCutout.setAttribute("height", `${rect.height}`);
    this._commentBackdropCutout.setAttribute("rx", "2");
  }
  _showCommentBackdrop(target) {
    const request = ++this._commentBackdropRequest;
    this._commentBackdropTarget = target;
    this._layoutCommentBackdrop(target);
    this._commentBackdrop.classList.remove("visible");
    requestAnimationFrame(() => {
      if (this._commentBackdropRequest === request) {
        this._commentBackdrop.classList.add("visible");
      }
    });
  }
  _hideCommentBackdrop() {
    this._commentBackdropRequest++;
    this._commentBackdropTarget = void 0;
    this._commentBackdrop.classList.remove("visible");
  }
  _layoutCommentComposer() {
    if (!this._commentTarget) {
      return;
    }
    this._renderHighlight(this._commentTarget);
  }
  _ensureMounted() {
    if (!this._shadowHost.parentNode) {
      document.documentElement.appendChild(this._shadowHost);
    }
  }
  _unmountWhenIdle() {
    if (!this._selectionActive && !this._highlightTarget && this._comments.size === 0) {
      this._shadowHost.remove();
    }
  }
  // --- Static helpers ---
  /**
   * Inject the shadow-root stylesheet. Custom properties on the host
   * element drive the colors so the workbench can theme them.
   *
   * We deliberately do **not** use a `*` selector with `all: initial` —
   * that would also reset `<style>`'s default `display: none`, causing
   * the literal CSS source to render as page text.
   */
  static _buildStyle() {
    const style = document.createElement("style");
    style.textContent = `
			:host {
				all: initial;
				font-family: var(--pick-font, system-ui, -apple-system, sans-serif);
				pointer-events: none !important;
			}
			.highlight {
				position: absolute; box-sizing: border-box;
				z-index: 2;
			}
			.comment-backdrop {
				position: fixed;
				inset: 0;
				width: 100%;
				height: 100%;
				pointer-events: none;
				z-index: 2;
			}
			.comment-backdrop-fill {
				fill: var(--vscode-widget-shadow, transparent);
				opacity: 0;
				transition: opacity 120ms linear;
			}
			.comment-backdrop.visible .comment-backdrop-fill {
				opacity: 1;
			}
			.highlight-shape {
				fill: color-mix(in srgb, var(--vscode-focusBorder, #0078d4) 12%, transparent);
				stroke: var(--vscode-focusBorder, #0078d4);
				stroke-width: 2px;
			}
			.overlay {
				position: fixed; inset: 0;
				background: transparent; box-sizing: border-box;
				z-index: 2;
			}
			.comment-layer {
				position: absolute; inset: 0; pointer-events: none;
			}
			.comment-surface {
				position: fixed;
				box-sizing: border-box;
				width: min(320px, calc(100vw - 16px));
				border: var(--vscode-strokeThickness, 1px) solid var(--vscode-editorWidget-border, var(--vscode-contrastBorder, #454545));
				border-radius: var(--vscode-cornerRadius-large, 8px);
				background: var(--vscode-editorWidget-background, #252526);
				color: var(--vscode-editorWidget-foreground, #cccccc);
				box-shadow: 0 2px 6px var(--vscode-widget-shadow, transparent);
				font-size: 13px;
				font-weight: 400;
				z-index: 4;
			}
			.comment-surface[data-attachment-corner='top-left'] {
				border-top-left-radius: 0;
			}
			.comment-surface[data-attachment-corner='top-right'] {
				border-top-right-radius: 0;
			}
			.comment-surface[data-attachment-corner='bottom-left'] {
				border-bottom-left-radius: 0;
			}
			.comment-surface[data-attachment-corner='bottom-right'] {
				border-bottom-right-radius: 0;
			}
			.comment-preview-hit-area {
				position: fixed;
				pointer-events: none;
				z-index: 4;
			}
			.comment-preview {
				position: absolute;
				align-items: flex-start;
				gap: 8px;
				max-height: 96px;
				padding: 6px 8px;
				overflow: hidden;
				line-height: 20px;
				pointer-events: none;
			}
			.comment-preview.empty {
				gap: 0;
				padding: 4px;
			}
			.comment-preview.empty .comment-preview-body {
				display: none;
			}
			.comment-preview.empty .comment-preview-remove {
				margin-block: 0;
			}
			.comment-preview-body {
				flex: 1;
				min-width: 0;
				max-height: 82px;
				overflow-x: hidden;
				overflow-y: auto;
				overflow-wrap: anywhere;
				scrollbar-width: thin;
				white-space: pre-wrap;
			}
			:host(.comment-preview-active) .comment-preview-hit-area,
			:host(.comment-preview-active) .comment-preview {
				pointer-events: auto;
			}
			:host(.comment-preview-collapsing) .comment-preview-hit-area,
			:host(.comment-preview-collapsing) .comment-preview {
				pointer-events: none;
			}
			.comment-preview-remove {
				flex: none;
				display: grid;
				place-items: center;
				box-sizing: border-box;
				width: 24px;
				height: 24px;
				margin-block: -2px;
				padding: 0;
				border: 0;
				border-radius: var(--vscode-cornerRadius-small, 4px);
				background: transparent;
				color: var(--vscode-editorWidget-foreground, inherit);
				cursor: pointer;
				font-family: inherit;
			}
			.comment-preview-remove svg {
				display: block;
				width: var(--vscode-codiconFontSize, 16px);
				height: var(--vscode-codiconFontSize, 16px);
			}
			.comment-preview-remove:hover {
				background: var(--vscode-toolbar-hoverBackground, transparent);
			}
			.comment-composer {
				align-items: flex-end; gap: 6px; padding: 6px;
				pointer-events: auto;
			}
			.comment-input {
				flex: 1; min-width: 0; resize: none; overflow: auto;
				scrollbar-width: none;
				box-sizing: border-box; margin: 0; padding: 2px 6px;
				background: transparent; color: inherit;
				border: var(--vscode-strokeThickness, 1px) solid var(--vscode-editorWidget-border, var(--vscode-contrastBorder, #454545));
				border-radius: var(--vscode-cornerRadius-small, 4px);
				outline: 0;
				font: inherit;
				line-height: 20px;
				caret-color: var(--vscode-focusBorder, currentColor);
			}
			.comment-input::-webkit-scrollbar {
				display: none;
			}
			.comment-input::placeholder {
				color: var(--vscode-input-placeholderForeground, var(--vscode-descriptionForeground, #ccccccb3));
				opacity: 1;
			}
			.comment-send {
				box-sizing: border-box; border: 0; cursor: pointer; font-family: inherit;
			}
			.comment-send {
				flex: none; width: 24px; height: 24px; padding: 0;
				border-radius: var(--vscode-cornerRadius-small, 4px);
				background: transparent;
				color: var(--vscode-editorWidget-foreground, #cccccc);
				display: grid;
				place-items: center;
			}
			.comment-send svg {
				display: block;
				width: var(--vscode-codiconFontSize, 16px);
				height: var(--vscode-codiconFontSize, 16px);
			}
			.comment-send:hover {
				background: var(--vscode-toolbar-hoverBackground, transparent);
			}
			.comment-pin {
				position: absolute;
				display: grid;
				place-items: center;
				width: 22px;
				height: 22px;
				transform: translate(-11px, -11px);
				pointer-events: auto;
				z-index: 0;
				transition: opacity 120ms linear;
			}
			.comment-layer.composing .comment-pin {
				opacity: 0;
				pointer-events: none;
				z-index: auto;
			}
			.comment-layer.comment-capture-pending .comment-pin {
				visibility: hidden;
			}
			.comment-pin:hover, .comment-pin:focus-within {
				z-index: 1;
			}
			.comment-pin.previewing {
				z-index: 0;
			}
			:host(.comment-preview-active) .comment-pin:not(.previewing) {
				opacity: 0.35;
			}
			.comment-pin.previewing .comment-pin-bubble {
				width: 6px;
				height: 6px;
				border-width: 0;
			}
			.comment-pin.previewing .comment-pin-number {
				opacity: 0;
			}
			.comment-pin-bubble {
				box-sizing: border-box;
				display: grid;
				place-items: center;
				width: 22px;
				height: 22px;
				padding: 0;
				border: var(--vscode-strokeThickness, 1px) solid var(--vscode-editorWidget-background, #252526);
				border-radius: var(--vscode-cornerRadius-circle, 9999px);
				background: var(--vscode-button-background, #0078d4);
				color: var(--vscode-button-foreground, white);
				box-shadow: 0 2px 6px var(--vscode-widget-shadow, transparent);
				transition: width 140ms cubic-bezier(0.2, 0, 0, 1), height 140ms cubic-bezier(0.2, 0, 0, 1), border-width 140ms cubic-bezier(0.2, 0, 0, 1);
			}
			.comment-pin-number {
				display: block;
				width: 100%;
				font-size: 11px;
				font-weight: 600;
				line-height: 12px;
				text-align: center;
				transition: opacity 80ms linear;
			}
			.comment-send:focus-visible, .comment-preview-remove:focus-visible, .comment-pin:focus-visible, .comment-input:focus-visible {
				outline: 2px solid var(--vscode-focusBorder, #0078d4);
				outline-offset: 2px;
			}
			:host(.reduce-motion) .comment-backdrop-fill,
			:host(.reduce-motion) .comment-pin,
			:host(.reduce-motion) .comment-pin-bubble,
			:host(.reduce-motion) .comment-pin-number {
				transition: none;
			}
			.label {
				position: fixed; box-sizing: border-box;
				display: inline-flex; align-items: center; gap: 6px; height: 20px; padding: 0 6px;
				max-width: min(100%, 320px);
				background: var(--vscode-button-background, #0078d4);
				color: var(--vscode-button-foreground, white);
				font-family: inherit;
				font-size: 11px; line-height: 20px;
				white-space: nowrap;
				border-radius: 2px;
				box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
				z-index: 3;
			}
			.label-info {
				display: inline-block; overflow: hidden; text-overflow: ellipsis; min-width: 0;
			}
			.label-selector {
				font-weight: 600;
			}
			.label-dims {
				flex-shrink: 0; opacity: 0.8;
			}
			.dragbox {
				position: fixed; box-sizing: border-box;
				border: 1px dotted var(--vscode-focusBorder, #a0aabe);
				background: transparent;
				z-index: 2;
			}
		`;
    return style;
  }
  static _applyTheme(host, theme) {
    host.style.setProperty("--vscode-focusBorder", theme?.focusBorder ?? null);
    host.style.setProperty("--vscode-button-background", theme?.buttonBackground ?? null);
    host.style.setProperty("--vscode-button-foreground", theme?.buttonForeground ?? null);
    host.style.setProperty("--vscode-editorWidget-background", theme?.widgetBackground ?? null);
    host.style.setProperty("--vscode-editorWidget-foreground", theme?.widgetForeground ?? null);
    host.style.setProperty("--vscode-editorWidget-border", theme?.widgetBorder ?? null);
    host.style.setProperty("--vscode-widget-shadow", theme?.widgetShadow ?? null);
    host.style.setProperty("--vscode-contrastBorder", theme?.contrastBorder ?? null);
    host.style.setProperty("--vscode-descriptionForeground", theme?.descriptionForeground ?? null);
    host.style.setProperty("--vscode-input-placeholderForeground", theme?.inputPlaceholderForeground ?? null);
    host.style.setProperty("--vscode-toolbar-hoverBackground", theme?.toolbarHoverBackground ?? null);
    host.style.setProperty("--pick-font", theme?.font ?? null);
  }
}
class AreaPicker {
  constructor(_onPicked, _onStopped) {
    this._onPicked = _onPicked;
    this._onStopped = _onStopped;
    this._selectionActive = false;
    this._onPointerDown = (e) => {
      if (!this._selectionActive || e.button !== 0) {
        return;
      }
      this._dragStart = { x: e.clientX, y: e.clientY };
      this._dragbox.style.display = "block";
      this._dragbox.style.left = `${e.clientX}px`;
      this._dragbox.style.top = `${e.clientY}px`;
      this._dragbox.style.width = "0px";
      this._dragbox.style.height = "0px";
      e.preventDefault();
      e.stopPropagation();
    };
    this._onPointerMove = (e) => {
      if (!this._selectionActive || !this._dragStart) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const left = Math.min(this._dragStart.x, e.clientX);
      const top = Math.min(this._dragStart.y, e.clientY);
      const width = Math.abs(e.clientX - this._dragStart.x);
      const height = Math.abs(e.clientY - this._dragStart.y);
      this._dragbox.style.left = `${left}px`;
      this._dragbox.style.top = `${top}px`;
      this._dragbox.style.width = `${width}px`;
      this._dragbox.style.height = `${height}px`;
    };
    this._onPointerUp = (e) => {
      if (!this._selectionActive || !this._dragStart) {
        return;
      }
      const start = this._dragStart;
      const left = Math.min(start.x, e.clientX);
      const top = Math.min(start.y, e.clientY);
      const width = Math.abs(e.clientX - start.x);
      const height = Math.abs(e.clientY - start.y);
      this._teardown();
      e.preventDefault();
      e.stopPropagation();
      if (width < AreaPicker._MIN_AREA_PX || height < AreaPicker._MIN_AREA_PX) {
        this._onStopped();
        return;
      }
      const vv = window.visualViewport;
      const offsetLeft = vv?.offsetLeft ?? 0;
      const offsetTop = vv?.offsetTop ?? 0;
      const rect = { x: left - offsetLeft, y: top - offsetTop, width, height };
      this._onPicked(rect);
    };
    this._onClick = (e) => {
      if (!this._selectionActive) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    };
    this._onKeyDown = (e) => {
      if (!this._selectionActive) {
        return;
      }
      if (e.key === "Escape") {
        this.stop();
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const shadowHost = document.createElement("div");
    shadowHost.setAttribute("data-vscode-area-pick-host", "");
    shadowHost.style.cssText = "position: absolute; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647; pointer-events: none;";
    const root = shadowHost.attachShadow({ mode: "closed" });
    root.appendChild(AreaPicker._buildStyle());
    this._shadowHost = shadowHost;
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    root.appendChild(overlay);
    const dragbox = document.createElement("div");
    dragbox.className = "dragbox";
    dragbox.style.display = "none";
    root.appendChild(dragbox);
    this._dragbox = dragbox;
  }
  static {
    this._MIN_AREA_PX = 4;
  }
  static {
    this._CURSOR_CROSSHAIR = "/* VS Code injected style */ * { cursor: crosshair !important; }";
  }
  start() {
    if (this._selectionActive) {
      return;
    }
    this._dragStart = void 0;
    document.documentElement.appendChild(this._shadowHost);
    this._selectionActive = true;
    const cursorStyle = document.createElement("style");
    cursorStyle.setAttribute("data-vscode-area-pick-cursor", "");
    cursorStyle.textContent = AreaPicker._CURSOR_CROSSHAIR;
    document.head.appendChild(cursorStyle);
    this._cursorStylesheet = cursorStyle;
    window.addEventListener("pointermove", this._onPointerMove, true);
    window.addEventListener("pointerdown", this._onPointerDown, true);
    window.addEventListener("pointerup", this._onPointerUp, true);
    window.addEventListener("click", this._onClick, true);
    window.addEventListener("contextmenu", this._onClick, true);
    window.addEventListener("keydown", this._onKeyDown, true);
  }
  stop() {
    if (!this._selectionActive) {
      return;
    }
    this._teardown();
    this._onStopped();
  }
  /**
   * Synchronous teardown of the overlay, cursor style, and event listeners.
   * Used by both {@link stop} (which then fires `_onStopped`) and `_onPointerUp`
   * (which fires `_onPicked` or `_onStopped` after teardown completes, so the
   * IPC consumer can capture the page without our overlay in the frame).
   */
  _teardown() {
    this._selectionActive = false;
    this._shadowHost.remove();
    this._cursorStylesheet?.remove();
    this._cursorStylesheet = void 0;
    window.removeEventListener("pointermove", this._onPointerMove, true);
    window.removeEventListener("pointerdown", this._onPointerDown, true);
    window.removeEventListener("pointerup", this._onPointerUp, true);
    window.removeEventListener("click", this._onClick, true);
    window.removeEventListener("contextmenu", this._onClick, true);
    window.removeEventListener("keydown", this._onKeyDown, true);
    this._dragbox.style.display = "none";
    this._dragbox.style.left = "0px";
    this._dragbox.style.top = "0px";
    this._dragbox.style.width = "0px";
    this._dragbox.style.height = "0px";
    this._dragStart = void 0;
  }
  setTheme(theme) {
    this._shadowHost.style.setProperty("--vscode-focusBorder", theme?.focusBorder ?? null);
  }
  static _buildStyle() {
    const style = document.createElement("style");
    style.textContent = `
			:host {
				all: initial;
				pointer-events: none !important;
			}
			.overlay {
				position: fixed; inset: 0;
				background: transparent;
				z-index: 1;
				/* Capture hit-testing so pointer events don't reach the underlying
				 * page during a pick \u2014 otherwise hover/:hover styles would
				 * fire on elements beneath the cursor while we're dragging. */
				pointer-events: auto;
			}
			.dragbox {
				position: fixed; box-sizing: border-box;
				border: 1px dashed var(--vscode-focusBorder, #0078d4);
				background: color-mix(in srgb, var(--vscode-focusBorder, #0078d4) 12%, transparent);
				z-index: 2;
				pointer-events: auto;
			}
		`;
    return style;
  }
}
init();
