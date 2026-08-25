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
import * as DOM from "../../base/browser/dom.js";
import { disposableTimeout } from "../../base/common/async.js";
import { Disposable, DisposableMap, DisposableStore } from "../../base/common/lifecycle.js";
import { ThemeIcon } from "../../base/common/themables.js";
import { createPixelSpinner } from "../../base/browser/ui/pixelSpinner/pixelSpinner.js";
import { asCssVariable } from "../../platform/theme/common/colorUtils.js";
import { IAccessibilityService } from "../../platform/accessibility/common/accessibility.js";
import { isActiveSessionStatus, SessionStatus } from "../services/sessions/common/session.js";
import { ISessionsListModelService } from "../services/sessions/browser/sessionsListModelService.js";
const $ = DOM.$;
const ICON_SWAP_FADE_MS = 180;
const ICON_FADING_OUT_ATTR = "iconFadingOut";
const PIXEL_SPINNER_GRID_KEY = "__pixel_spinner_grid__";
const PIXEL_SPINNER_RING_KEY = "__pixel_spinner_ring__";
let SessionStatusIcon = class extends Disposable {
  constructor(_container, _accessibilityService, _sessionsListModelService) {
    super();
    this._container = _container;
    this._accessibilityService = _accessibilityService;
    this._sessionsListModelService = _sessionsListModelService;
    /** Owns the removal timers for outgoing icons mid cross-fade. */
    this._swapStore = this._register(new DisposableStore());
    this._iconDisposables = this._register(new DisposableMap());
    if (!this._container.style.position) {
      this._container.style.position = "relative";
    }
    this._register(this._accessibilityService.onDidChangeReducedMotion(() => {
      if (this._lastInputs) {
        this._render(this._lastInputs);
      }
    }));
  }
  /**
   * Updates the rendered status. Cross-fades when the glyph/variant changes
   * within one session; a different session resource snaps to the new icon.
   */
  setStatus(status, isRead, isArchived, completedStateIcon, sessionResource) {
    const sessionResourceKey = sessionResource?.toString();
    if (sessionResourceKey !== void 0 && sessionResourceKey !== this._currentSessionResource) {
      this.reset();
      this._currentSessionResource = sessionResourceKey;
    }
    const inputs = { status, isRead, isArchived, completedStateIcon };
    this._lastInputs = inputs;
    this._render(inputs);
  }
  /**
   * Clears the cached glyph so the next {@link setStatus} renders without a
   * cross-fade. Use when the host is rebound to a different session.
   */
  reset() {
    this._currentCacheKey = void 0;
    this._currentSessionResource = void 0;
    this._lastInputs = void 0;
    this._swapStore.clear();
    this._iconDisposables.clearAndDisposeAll();
    DOM.clearNode(this._container);
  }
  _render(inputs) {
    const { status, isRead, isArchived, completedStateIcon } = inputs;
    const isSpinner = isActiveSessionStatus(status) && !this._accessibilityService.isMotionReduced();
    let cacheKey;
    let color;
    let createIcon;
    if (isSpinner) {
      const isNeedsInput = status === SessionStatus.NeedsInput;
      const variant = isNeedsInput ? "ring" : "grid";
      cacheKey = isNeedsInput ? PIXEL_SPINNER_RING_KEY : PIXEL_SPINNER_GRID_KEY;
      color = isNeedsInput ? asCssVariable("list.warningForeground") : asCssVariable("textLink.foreground");
      createIcon = () => {
        const spinner = createPixelSpinner(void 0, { variant });
        return { element: spinner.element, disposable: spinner };
      };
    } else {
      const icon = this._sessionsListModelService.getStatusIcon(status, isRead, isArchived, completedStateIcon);
      cacheKey = ThemeIcon.asCSSSelector(icon);
      color = icon.color ? asCssVariable(icon.color.id) : "";
      createIcon = () => ({ element: $(`span${cacheKey}`) });
    }
    this._container.classList.toggle("session-icon-pulse", status === SessionStatus.NeedsInput);
    if (this._currentCacheKey === cacheKey) {
      this._recolorActiveIcon(color);
      return;
    }
    const animate = this._currentCacheKey !== void 0;
    this._currentCacheKey = cacheKey;
    const { element: iconElement, disposable: iconDisposable } = createIcon();
    iconElement.style.color = color;
    this._swapIcon(iconElement, animate, iconDisposable);
  }
  /** Updates the color of the current (non fading-out) icon without rebuilding it. */
  _recolorActiveIcon(color) {
    for (const child of Array.from(this._container.children)) {
      if (child.dataset[ICON_FADING_OUT_ATTR] !== "1") {
        child.style.color = color;
        break;
      }
    }
  }
  /**
   * Swaps the container contents to `newChild` with a brief opacity cross-fade.
   * Outgoing children are taken out of normal flow (`position: absolute`) so the
   * new child can settle into its slot during the fade. Safe to call repeatedly:
   * each outgoing element is marked so a follow-up swap never re-processes it.
   */
  _swapIcon(newChild, animate, disposable) {
    if (!animate) {
      this._iconDisposables.clearAndDisposeAll();
      DOM.clearNode(this._container);
      this._container.appendChild(newChild);
      if (disposable) {
        this._iconDisposables.set(newChild, disposable);
      }
      return;
    }
    for (const existing of Array.from(this._container.children)) {
      if (existing.dataset[ICON_FADING_OUT_ATTR] === "1") {
        continue;
      }
      existing.dataset[ICON_FADING_OUT_ATTR] = "1";
      existing.style.position = "absolute";
      existing.style.top = "0";
      existing.style.left = "0";
      existing.style.transition = `opacity ${ICON_SWAP_FADE_MS}ms ease`;
      DOM.scheduleAtNextAnimationFrame(DOM.getWindow(existing), () => {
        existing.style.opacity = "0";
      });
      disposableTimeout(() => {
        existing.remove();
        this._iconDisposables.deleteAndDispose(existing);
      }, ICON_SWAP_FADE_MS + 40, this._swapStore);
    }
    newChild.style.opacity = "0";
    newChild.style.transition = `opacity ${ICON_SWAP_FADE_MS}ms ease`;
    this._container.appendChild(newChild);
    if (disposable) {
      this._iconDisposables.set(newChild, disposable);
    }
    DOM.scheduleAtNextAnimationFrame(DOM.getWindow(newChild), () => {
      newChild.style.opacity = "1";
    });
  }
};
SessionStatusIcon = __decorateClass([
  __decorateParam(1, IAccessibilityService),
  __decorateParam(2, ISessionsListModelService)
], SessionStatusIcon);
export {
  SessionStatusIcon
};
