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
import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { browserZoomDefaultIndex, browserZoomFactors } from "../../../../platform/browserView/common/browserView.js";
import { zoomLevelToZoomFactor } from "../../../../platform/window/common/window.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
const IBrowserZoomService = createDecorator("browserZoomService");
const BROWSER_ZOOM_PER_HOST_STORAGE_KEY = "browserView.zoomPerHost";
const MATCH_WINDOW_ZOOM_LABEL = "Match Window";
const ZOOM_LABEL_TO_INDEX = new Map(
  browserZoomFactors.map((f, i) => [`${Math.round(f * 100)}%`, i])
);
let BrowserZoomService = class extends Disposable {
  // default: zoom level 0 → factor 1.0
  constructor(configurationService, storageService) {
    super();
    this.configurationService = configurationService;
    this.storageService = storageService;
    this._onDidChangeZoom = this._register(new Emitter());
    this.onDidChangeZoom = this._onDidChangeZoom.event;
    /** In-memory only; dropped on restart. */
    this._ephemeralZoomMap = /* @__PURE__ */ new Map();
    this._windowZoomFactor = zoomLevelToZoomFactor(0);
    this._persistentZoomMap = this._readPersistentZoomMap();
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("workbench.browser.pageZoom")) {
        this._onDidChangeZoom.fire({ host: void 0, isEphemeralChange: false });
      }
    }));
  }
  getEffectiveZoomIndex(host, isEphemeral) {
    if (host !== void 0) {
      if (isEphemeral) {
        const ephemeralIndex = this._ephemeralZoomMap.get(host);
        if (ephemeralIndex !== void 0) {
          return this._clamp(ephemeralIndex);
        }
      } else {
        const persistentIndex = this._persistentZoomMap[host];
        if (persistentIndex !== void 0) {
          return this._clamp(persistentIndex);
        }
      }
    }
    return this._getDefaultZoomIndex();
  }
  setHostZoomIndex(host, zoomIndex, isEphemeral) {
    const clamped = this._clamp(zoomIndex);
    const defaultIndex = this._getDefaultZoomIndex();
    const matchesDefault = clamped === defaultIndex;
    if (isEphemeral) {
      if (matchesDefault) {
        if (!this._ephemeralZoomMap.has(host)) {
          return;
        }
        this._ephemeralZoomMap.delete(host);
      } else {
        if (this._ephemeralZoomMap.get(host) === clamped) {
          return;
        }
        this._ephemeralZoomMap.set(host, clamped);
      }
      this._onDidChangeZoom.fire({ host, isEphemeralChange: true });
    } else {
      let persistentChanged = false;
      if (matchesDefault) {
        if (Object.prototype.hasOwnProperty.call(this._persistentZoomMap, host)) {
          delete this._persistentZoomMap[host];
          persistentChanged = true;
        }
      } else if (this._persistentZoomMap[host] !== clamped) {
        this._persistentZoomMap[host] = clamped;
        persistentChanged = true;
      }
      let ephemeralChanged = false;
      if (matchesDefault) {
        ephemeralChanged = this._ephemeralZoomMap.delete(host);
      } else if (this._ephemeralZoomMap.get(host) !== clamped) {
        this._ephemeralZoomMap.set(host, clamped);
        ephemeralChanged = true;
      }
      if (!persistentChanged && !ephemeralChanged) {
        return;
      }
      if (persistentChanged) {
        this._writePersistentZoomMap();
      }
      this._onDidChangeZoom.fire({ host, isEphemeralChange: false });
    }
  }
  notifyWindowZoomChanged(windowZoomFactor) {
    this._windowZoomFactor = windowZoomFactor;
    const label = this.configurationService.getValue("workbench.browser.pageZoom");
    if (label === MATCH_WINDOW_ZOOM_LABEL) {
      this._onDidChangeZoom.fire({ host: void 0, isEphemeralChange: false });
    }
  }
  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  _getDefaultZoomIndex() {
    const label = this.configurationService.getValue("workbench.browser.pageZoom");
    if (label === MATCH_WINDOW_ZOOM_LABEL) {
      return this._getMatchWindowZoomIndex();
    }
    return ZOOM_LABEL_TO_INDEX.get(label) ?? browserZoomDefaultIndex;
  }
  /**
   * Finds the browser zoom index whose factor is closest to the application's current UI zoom
   * factor, measuring distance on a log scale (since window zoom levels are powers of 1.2).
   */
  _getMatchWindowZoomIndex() {
    const windowFactor = this._windowZoomFactor;
    let bestIndex = browserZoomDefaultIndex;
    let bestDist = Infinity;
    for (let i = 0; i < browserZoomFactors.length; i++) {
      const dist = Math.abs(Math.log(browserZoomFactors[i]) - Math.log(windowFactor));
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
      }
    }
    return bestIndex;
  }
  /**
   * Reads the persistent per-host zoom map from storage.
   * The stored format is a JSON object mapping host strings to zoom indices.
   */
  _readPersistentZoomMap() {
    const raw = this.storageService.get(BROWSER_ZOOM_PER_HOST_STORAGE_KEY, StorageScope.PROFILE);
    if (!raw) {
      return {};
    }
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return {};
      }
      const result = {};
      for (const [host, index] of Object.entries(parsed)) {
        if (typeof index === "number" && index >= 0 && index < browserZoomFactors.length) {
          result[host] = index;
        }
      }
      return result;
    } catch {
      return {};
    }
  }
  _writePersistentZoomMap() {
    const hasEntries = Object.keys(this._persistentZoomMap).length > 0;
    if (hasEntries) {
      this.storageService.store(BROWSER_ZOOM_PER_HOST_STORAGE_KEY, JSON.stringify(this._persistentZoomMap), StorageScope.PROFILE, StorageTarget.MACHINE);
    } else {
      this.storageService.remove(BROWSER_ZOOM_PER_HOST_STORAGE_KEY, StorageScope.PROFILE);
    }
  }
  _clamp(index) {
    return Math.max(0, Math.min(Math.trunc(index), browserZoomFactors.length - 1));
  }
};
BrowserZoomService = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IStorageService)
], BrowserZoomService);
export {
  BrowserZoomService,
  IBrowserZoomService,
  MATCH_WINDOW_ZOOM_LABEL
};
