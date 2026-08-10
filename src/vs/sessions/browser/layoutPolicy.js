import { Disposable } from "../../base/common/lifecycle.js";
import { observableValue, derived } from "../../base/common/observable.js";
import { isIOS, isMobile } from "../../base/common/platform.js";
import { isAndroid } from "../../base/browser/browser.js";
import { Gesture } from "../../base/browser/touch.js";
const PHONE_MAX_WIDTH = 640;
const TABLET_MAX_WIDTH = 1024;
const isMobilePlatform = isMobile;
function classifyViewport(width) {
  if (!isMobilePlatform) {
    return "desktop";
  }
  if (width < PHONE_MAX_WIDTH) {
    return "phone";
  }
  if (width < TABLET_MAX_WIDTH) {
    return "tablet";
  }
  return "desktop";
}
class SessionsLayoutPolicy extends Disposable {
  constructor() {
    super();
    // --- Observables ---
    this._viewportClass = observableValue(this, "desktop");
    /** Current viewport class derived from the most recent `update()` call. */
    this.viewportClass = this._viewportClass;
    /**
     * Whether the agents window uses the single-pane layout (editor spans the
     * detail panel as a docked auxiliary bar). Resolved once at startup from the
     * setting; toggling requires a window reload. Never active on phone (which
     * has its own mobile layout).
     */
    this._singlePane = false;
    /** `true` when the viewport class is `phone`. */
    this.isPhoneLayout = derived(this, (reader) => {
      return this._viewportClass.read(reader) === "phone";
    });
    this.isIOS = isIOS;
    this.isAndroid = isAndroid;
    this.isTouchDevice = Gesture.isTouchDevice();
  }
  get isSinglePane() {
    return this._singlePane && this._viewportClass.get() !== "phone";
  }
  /** Set once at startup (from the redesign setting) before the first layout. */
  setSinglePane(value) {
    this._singlePane = value;
  }
  /**
   * Update the viewport classification. Call this from the workbench
   * `layout()` method whenever the container dimensions change.
   *
   * @param width  Container width in pixels.
   * @param height Container height in pixels (reserved for future use).
   */
  update(width, _height) {
    const next = classifyViewport(width);
    if (this._viewportClass.get() !== next) {
      this._viewportClass.set(next, void 0);
    }
  }
  /**
   * Returns the default part visibility for the given viewport class.
   * If no class is supplied the current observed class is used.
   */
  getPartVisibilityDefaults(viewportClass) {
    const vc = viewportClass ?? this._viewportClass.get();
    switch (vc) {
      case "phone":
        return { sidebar: false, auxiliaryBar: false, panel: false, sessions: true, editor: false };
      case "tablet":
      case "desktop":
        return { sidebar: true, auxiliaryBar: true, panel: false, sessions: true, editor: false };
    }
  }
  /**
   * Returns the default part sizes for the given viewport dimensions.
   * If no viewport class is supplied the current observed class is used.
   *
   * @param width  Container width in pixels.
   * @param height Container height in pixels (reserved for future use).
   * @param viewportClass Optional explicit viewport class override.
   */
  getPartSizes(width, _height, viewportClass) {
    const vc = viewportClass ?? this._viewportClass.get();
    switch (vc) {
      case "phone":
        return {
          sideBarSize: 0,
          auxiliaryBarSize: 0,
          panelSize: 0,
          sessionsWidth: width
        };
      case "tablet":
      case "desktop":
        return {
          sideBarSize: 300,
          auxiliaryBarSize: 340,
          panelSize: 300,
          sessionsWidth: width - 300
        };
    }
  }
}
export {
  SessionsLayoutPolicy
};
