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
import { Disposable } from "../../../base/common/lifecycle.js";
import { Emitter } from "../../../base/common/event.js";
import { ILogService } from "../../log/common/log.js";
let BrowserViewEmulator = class extends Disposable {
  constructor(browser, logService) {
    super();
    this.browser = browser;
    this.logService = logService;
    this._lastLayout = { containerWidth: 1024, containerHeight: 768, scale: 1, hostZoom: 1 };
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._defaultUserAgent = this.browser.webContents.getUserAgent();
    const onNavigate = () => {
      this._lastApplied = void 0;
      void this._reapply();
    };
    this.browser.webContents.on("did-navigate", onNavigate);
    this._register(this.browser.debugger.registerCommandInterceptor((method, params, session) => this._intercept(method, params, session)));
  }
  get device() {
    return this._device;
  }
  get emulatedScaleFactor() {
    if (!this._lastLayout) {
      return 1;
    }
    return this._lastLayout.scale * this._lastLayout.hostZoom;
  }
  async setDevice(device) {
    const prev = this._device;
    this._device = device;
    const nextUA = device?.userAgent;
    if (prev?.userAgent !== nextUA) {
      this.browser.webContents.setUserAgent(nextUA ?? this._defaultUserAgent);
    }
    if (prev && !device && this.isSafeToApplyEmulation()) {
      this.browser.webContents.disableDeviceEmulation();
      void this._applyTouchAndMedia();
    }
    this._lastApplied = void 0;
    if (device && this.isSafeToApplyEmulation()) {
      this._reapply();
    }
    this._onDidChange.fire(device);
  }
  /**
   * Update the cached layout (container size + scale + host zoom) and reapply
   * emulation. The emulated viewport is derived from the current device's
   * width / height; when those are undefined the viewport auto-fits to the
   * container at the given scale. `hostZoom` is the host window's
   * CSS-to-screen zoom factor — bounds in main are multiplied by it, so the
   * emulation scale must be too or the emulated viewport won't fill the
   * WebContentsView when the workbench is zoomed.
   */
  applyScreenEmulation(containerWidth, containerHeight, scale, hostZoom) {
    this._lastLayout = { containerWidth, containerHeight, scale, hostZoom };
    this._reapply();
  }
  _reapply() {
    if (!this._device || !this.isSafeToApplyEmulation()) {
      return;
    }
    const { containerWidth, containerHeight, scale, hostZoom } = this._lastLayout;
    const s = Math.max(0.01, scale);
    const z = Math.max(0.01, hostZoom);
    const w = Math.max(1, Math.round(this._device.width || containerWidth / s));
    const h = Math.max(1, Math.round(this._device.height || containerHeight / s));
    const mobile = !!this._device.mobile;
    const last = this._lastApplied;
    if (last && last.viewportWidth === w && last.viewportHeight === h && Math.abs(last.scale - s) < 1e-4 && Math.abs(last.hostZoom - z) < 1e-4 && last.mobile === mobile) {
      return;
    }
    this._lastApplied = { viewportWidth: w, viewportHeight: h, scale: s, hostZoom: z, mobile };
    const params = {
      screenPosition: mobile ? "mobile" : "desktop",
      screenSize: { width: w, height: h },
      viewSize: { width: w, height: h },
      deviceScaleFactor: this._device.deviceScaleFactor ?? 0,
      viewPosition: { x: 0, y: 0 },
      scale: s * z
    };
    if (mobile && !last) {
      this.browser.webContents.enableDeviceEmulation({
        ...params,
        screenPosition: "desktop"
      });
    }
    this.browser.webContents.enableDeviceEmulation(params);
    if (mobile !== last?.mobile) {
      void this._applyTouchAndMedia();
    }
  }
  isSafeToApplyEmulation() {
    return !this.browser.webContents.isDestroyed() && !!this.browser.webContents.getURL();
  }
  async _applyTouchAndMedia() {
    if (!this.isSafeToApplyEmulation()) {
      return;
    }
    const device = this._device;
    const mobile = !!this._device?.mobile;
    try {
      await this.browser.debugger.sendCommandRaw("Emulation.setTouchEmulationEnabled", { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 });
      if (this.device !== device) {
        return;
      }
      await this.browser.debugger.sendCommandRaw("Emulation.setEmulatedMedia", { features: this._device ? [{ name: "pointer", value: mobile ? "coarse" : "fine" }] : [] });
      if (this.device !== device) {
        return;
      }
      await this.browser.debugger.sendCommandRaw("Emulation.setEmitTouchEventsForMouse", { enabled: mobile });
    } catch (err) {
      this.logService.error("[BrowserViewEmulator] _applyTouchAndMedia failed", err);
    }
  }
  /**
   * Intercept incoming CDP emulation commands and fold the ones that map onto
   * {@link IBrowserDeviceProfile} into the device. Anything we don't model
   * (geolocation, timezone, CPU throttling, locale, vision deficiency, …)
   * falls through to raw CDP. Only the root session is intercepted — worker
   * and iframe sub-sessions get pass-through behavior.
   */
  _intercept(method, params, session) {
    if (session && session.targetId !== this.browser.debugger.targetId) {
      return void 0;
    }
    switch (method) {
      case "Emulation.setDeviceMetricsOverride": {
        const p = params ?? {};
        const next = {
          ...this._device,
          // CDP uses 0 to disable the corresponding override.
          width: p.width || void 0,
          height: p.height || void 0,
          mobile: p.mobile ?? this._device?.mobile,
          deviceScaleFactor: p.deviceScaleFactor ?? this._device?.deviceScaleFactor
        };
        return this.setDevice(next).then(() => ({}));
      }
      case "Emulation.clearDeviceMetricsOverride": {
        if (!this._device) {
          return Promise.resolve({});
        }
        const { width, height, mobile, deviceScaleFactor, ...rest } = this._device;
        const hasRest = Object.values(rest).some((v) => v !== void 0);
        return this.setDevice(hasRest ? rest : void 0).then(() => ({}));
      }
      case "Emulation.setUserAgentOverride": {
        const p = params ?? {};
        if (p.acceptLanguage !== void 0 || p.platform !== void 0 || p.userAgentMetadata !== void 0) {
          return void 0;
        }
        const ua = p.userAgent || void 0;
        return this.setDevice({ ...this._device, userAgent: ua }).then(() => ({}));
      }
      case "Input.dispatchMouseEvent":
      case "Input.dispatchDragEvent":
      case "Input.synthesizeScrollGesture":
      case "Input.synthesizePinchGesture":
      case "Input.synthesizeTapGesture":
      case "Input.dispatchTouchEvent":
        this._scaleInputCoordinates(params);
        return void 0;
      // let the event pass through with the modified parameters
      default:
        return void 0;
    }
  }
  /**
   * Scale any coordinate-bearing fields on a CDP `Input.*` params object in
   * place so screen-space coordinates map onto the emulated viewport. Handles
   * point coordinates (`x` / `y`), mouse wheel deltas (`deltaX` / `deltaY`),
   * scroll distances (`xDistance` / `yDistance`) and touch points.
   */
  _scaleInputCoordinates(params) {
    const scale = this.emulatedScaleFactor;
    const p = params ?? {};
    if (p.x) {
      p.x *= scale;
    }
    if (p.y) {
      p.y *= scale;
    }
    if (p.deltaX) {
      p.deltaX *= scale;
    }
    if (p.deltaY) {
      p.deltaY *= scale;
    }
    if (p.xDistance) {
      p.xDistance *= scale;
    }
    if (p.yDistance) {
      p.yDistance *= scale;
    }
    if (Array.isArray(p.touchPoints)) {
      p.touchPoints = p.touchPoints.map((t) => ({
        ...t,
        x: t.x * scale,
        y: t.y * scale
      }));
    }
  }
};
BrowserViewEmulator = __decorateClass([
  __decorateParam(1, ILogService)
], BrowserViewEmulator);
export {
  BrowserViewEmulator
};
