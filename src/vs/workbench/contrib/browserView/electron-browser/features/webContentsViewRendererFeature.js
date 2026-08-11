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
import { localize } from "../../../../../nls.js";
import { $, addDisposableListener, EventType, registerExternalFocusChecker } from "../../../../../base/browser/dom.js";
import { getZoomFactor } from "../../../../../base/browser/browser.js";
import { StandardKeyboardEvent } from "../../../../../base/browser/keyboardEvent.js";
import { encodeBase64 } from "../../../../../base/common/buffer.js";
import { MutableDisposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import {
  BrowserEditor,
  BrowserEditorContribution,
  BrowserWidgetLocation
} from "../browserEditor.js";
import { BrowserOverlayManager, BrowserOverlayType } from "../overlayManager.js";
let WebContentsViewRendererFeature = class extends BrowserEditorContribution {
  constructor(editor, logService, keybindingService) {
    super(editor);
    this.logService = logService;
    this.keybindingService = keybindingService;
    this._editorVisible = false;
    this._overlayObscured = false;
    this._placeholderScreenshot = $(".browser-placeholder-screenshot");
    this._overlayPauseEl = $(".browser-overlay-paused");
    this._screenshotHandle = this._register(new MutableDisposable());
    this._overlayManager = this._register(new BrowserOverlayManager(editor.window));
    const message = $(".browser-overlay-paused-message");
    const heading = $(".browser-overlay-paused-heading");
    const detail = $(".browser-overlay-paused-detail");
    heading.textContent = localize("browser.overlayPauseHeading.notification", "Paused due to Notification");
    detail.textContent = localize("browser.overlayPauseDetail.notification", "Dismiss the notification to continue using the browser.");
    message.appendChild(heading);
    message.appendChild(detail);
    this._overlayPauseEl.appendChild(message);
    this._placeholderContent = { location: BrowserWidgetLocation.ContentArea, element: this._placeholderScreenshot, order: 100 };
    this._overlayPauseContent = { location: BrowserWidgetLocation.ContentArea, element: this._overlayPauseEl, order: 200 };
    this._register(this._overlayManager.onDidChangeOverlayState(() => this._refreshOverlayObscured()));
    this._refresh();
  }
  get widgets() {
    return [this._placeholderContent, this._overlayPauseContent];
  }
  beforeContainerLayout() {
    return {
      padding: { top: 3, right: 3, bottom: 3, left: 3 },
      // Snap CSS-pixel values down so `v × hostZoom` is an exact integer:
      // main places the WCV at `round(v × hostZoom) × systemDPR` physical
      // pixels while CSS renders it at `v × hostZoom × systemDPR`, so this
      // collapses main's rounding to a no-op and keeps the WebContentsView
      // aligned with the placeholder screenshot. We snap the absolute
      // origin (pane origin + local offset) then derive the corresponding
      // local position so the DOM element and the WCV land on the same
      // physical pixel. Runs late so it refines whatever sizing upstream
      // contributions (e.g. device emulation) produced.
      compute: (current, pane) => {
        const z = getZoomFactor(this.editor.window);
        const snap = (v) => Math.floor(v * z) / z;
        const absLeft = pane.originX + (current.left ?? 0);
        const absTop = pane.originY + (current.top ?? 0);
        return {
          ...current,
          width: snap(current.width),
          height: snap(current.height),
          left: snap(absLeft) - pane.originX,
          top: snap(absTop) - pane.originY
        };
      },
      priority: 1e3
    };
  }
  onContainerCreated(container) {
    this._container = container;
    this._register(addDisposableListener(container, EventType.FOCUS, () => this.tryFocus()));
    this._register(addDisposableListener(container, EventType.BLUR, () => this._cancelFocusTimeout()));
    this._register(registerExternalFocusChecker(() => ({
      hasFocus: this._model?.focused ?? false,
      window: this._model?.focused ? this.editor.window : void 0
    })));
    this._refreshOverlayObscured();
  }
  // -- Base contribution hooks --------------------------------------------
  onPaneVisibilityChanged(visible) {
    if (this._editorVisible === visible) {
      return;
    }
    this._editorVisible = visible;
    this._refresh();
  }
  afterContainerLayout() {
    this._refreshOverlayObscured();
  }
  tryFocus() {
    if (!this.editor.input?.url) {
      return false;
    }
    this._container?.focus();
    if (this._focusTimeout || !this._model) {
      return true;
    }
    this._focusTimeout = setTimeout(() => {
      this._focusTimeout = void 0;
      const doc = this._container?.ownerDocument;
      if (!doc?.hasFocus() || doc.activeElement !== this._container) {
        return;
      }
      if (this._model?.visible) {
        void this._model.focus();
      } else {
        this.editor.ensureBrowserFocus();
      }
    }, 10);
    return true;
  }
  // -- Model lifecycle ----------------------------------------------------
  onModelAttached(model, store) {
    this._model = model;
    this._setBackgroundImage(model.screenshot);
    store.add(model.onDidChangeVisibility(() => void this._doScreenshot()));
    store.add(model.onDidKeyCommand((keyEvent) => void this._handleKeyEvent(keyEvent)));
    store.add(model.onDidNavigate(() => this._refresh()));
    store.add(model.onDidChangeLoadingState(() => this._refresh()));
    this._refresh();
    void this._doScreenshot();
  }
  onModelDetached() {
    if (this._model) {
      void this._model.setVisible(false);
    }
    this._model = void 0;
    this._screenshotHandle.clear();
    this._cancelFocusTimeout();
    this._setBackgroundImage(void 0);
    this._refresh();
  }
  dispose() {
    this._cancelFocusTimeout();
    super.dispose();
  }
  // -- Internals ----------------------------------------------------------
  _shouldShowPage() {
    return this._editorVisible && !this._overlayObscured && !!this._model?.url && !this._model?.error;
  }
  /**
   * Recompute visibility of our content layers and the underlying page based
   * on the latest editor/overlay/model state.
   */
  _refresh() {
    const placeholderActive = !!this._model?.url && !this._model?.error;
    this._placeholderScreenshot.style.display = placeholderActive ? "" : "none";
    const pauseActive = !!this._model?.url && this._editorVisible && this._overlayObscured;
    this._overlayPauseEl.classList.toggle("visible", pauseActive);
    if (!this._model) {
      return;
    }
    const show = this._shouldShowPage();
    if (show === this._model.visible) {
      return;
    }
    if (show) {
      void this._model.setVisible(true);
      const ownerDoc = this._container?.ownerDocument;
      if (ownerDoc?.hasFocus() && ownerDoc.activeElement === this._container) {
        this.tryFocus();
      }
    } else {
      void this._doScreenshot();
      this.editor.window.requestAnimationFrame(() => {
        if (this._model && !this._shouldShowPage()) {
          void this._model.setVisible(false);
        }
      });
    }
  }
  _refreshOverlayObscured() {
    if (!this._container) {
      return;
    }
    const overlays = this._overlayManager.getOverlappingOverlays(this._container);
    const obscured = overlays.length > 0;
    const hasNotification = overlays.some((o) => o.type === BrowserOverlayType.Notification);
    this._overlayPauseEl.classList.toggle("show-message", hasNotification);
    if (obscured !== this._overlayObscured) {
      this._overlayObscured = obscured;
      this._refresh();
    }
  }
  async _doScreenshot() {
    if (!this._model) {
      return;
    }
    this._screenshotHandle.clear();
    if (!this._model.visible) {
      return;
    }
    try {
      const screenshot = await this._model.captureScreenshot({ quality: 80 });
      this._setBackgroundImage(screenshot);
    } catch (error) {
      this.logService.error("Failed to capture browser view screenshot", error);
    }
    const handle = setTimeout(() => void this._doScreenshot(), 1e3);
    this._screenshotHandle.value = toDisposable(() => clearTimeout(handle));
  }
  _setBackgroundImage(buffer) {
    if (buffer) {
      const dataUrl = `data:image/jpeg;base64,${encodeBase64(buffer)}`;
      this._placeholderScreenshot.style.backgroundImage = `url('${dataUrl}')`;
    } else {
      this._placeholderScreenshot.style.backgroundImage = "";
    }
  }
  async _handleKeyEvent(keyEvent) {
    if (!this._container) {
      return;
    }
    try {
      const syntheticEvent = new KeyboardEvent("keydown", keyEvent);
      const standardEvent = new StandardKeyboardEvent(syntheticEvent);
      this.keybindingService.dispatchEvent(standardEvent, this._container);
    } catch (error) {
      this.logService.error("WebContentsViewRendererFeature: Error dispatching key event", error);
    }
  }
  _cancelFocusTimeout() {
    if (this._focusTimeout) {
      clearTimeout(this._focusTimeout);
      this._focusTimeout = void 0;
    }
  }
};
WebContentsViewRendererFeature = __decorateClass([
  __decorateParam(1, ILogService),
  __decorateParam(2, IKeybindingService)
], WebContentsViewRendererFeature);
BrowserEditor.registerContribution(WebContentsViewRendererFeature);
