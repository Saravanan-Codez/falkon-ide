import { Codicon } from "../../../base/common/codicons.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { localize } from "../../../nls.js";
var PermissionCategory = /* @__PURE__ */ ((PermissionCategory2) => {
  PermissionCategory2["Location"] = "location";
  PermissionCategory2["Camera"] = "camera";
  PermissionCategory2["Microphone"] = "microphone";
  PermissionCategory2["Notifications"] = "notifications";
  PermissionCategory2["Sensors"] = "sensors";
  PermissionCategory2["Clipboard"] = "clipboard";
  PermissionCategory2["Devices"] = "devices";
  return PermissionCategory2;
})(PermissionCategory || {});
const PERMISSION_CATEGORY_DESCRIPTORS = {
  ["location" /* Location */]: {
    category: "location" /* Location */,
    label: localize("browserPermission.location.label", "Location"),
    description: localize("browserPermission.location.description", "Access this device's geographic location"),
    icon: Codicon.location,
    permissions: ["geolocation", "geolocation-approximate"],
    defaultState: "ask"
  },
  ["camera" /* Camera */]: {
    category: "camera" /* Camera */,
    label: localize("browserPermission.camera.label", "Camera"),
    description: localize("browserPermission.camera.description", "Capture video from cameras"),
    icon: Codicon.deviceCamera,
    // `media` is shared with Microphone; disambiguated via mediaType/mediaTypes.
    permissions: ["media"],
    defaultState: "ask"
  },
  ["microphone" /* Microphone */]: {
    category: "microphone" /* Microphone */,
    label: localize("browserPermission.microphone.label", "Microphone"),
    description: localize("browserPermission.microphone.description", "Capture audio from microphones"),
    icon: Codicon.mic,
    permissions: ["media"],
    defaultState: "ask"
  },
  ["sensors" /* Sensors */]: {
    category: "sensors" /* Sensors */,
    label: localize("browserPermission.sensors.label", "Sensors"),
    description: localize("browserPermission.sensors.description", "Read motion and environmental sensors"),
    icon: Codicon.pulse,
    permissions: ["sensors"],
    defaultState: "allow"
  },
  ["clipboard" /* Clipboard */]: {
    category: "clipboard" /* Clipboard */,
    label: localize("browserPermission.clipboard.label", "Clipboard"),
    description: localize("browserPermission.clipboard.description", "Read from and write to the system clipboard"),
    icon: Codicon.clippy,
    permissions: ["clipboard-read"],
    defaultState: "ask"
  },
  ["notifications" /* Notifications */]: {
    category: "notifications" /* Notifications */,
    label: localize("browserPermission.notifications.label", "Notifications"),
    description: localize("browserPermission.notifications.description", "Display desktop notifications"),
    icon: Codicon.bell,
    permissions: ["notifications"],
    defaultState: "ask"
  },
  ["devices" /* Devices */]: {
    category: "devices" /* Devices */,
    label: localize("browserPermission.devices.label", "Devices"),
    description: localize("browserPermission.devices.description", "Request access to USB, serial, HID, and Bluetooth devices"),
    icon: Codicon.plug,
    // Each device kind has its own native chooser; this decision only gates
    // whether that chooser is allowed to surface. Bluetooth has no Electron
    // permission string (it is gated in the chooser handler directly).
    permissions: ["usb", "serial", "hid"],
    defaultState: "allow"
  }
  /**
   * Permissions not listed here are either always allowed (see
   * {@link ALWAYS_ALLOWED_PERMISSIONS}) or, by default, always denied:
   *
   * No-op in Electron due to missing backend support
   *   - Smart Cards (`smart-card`)
   *   - NFC (`nfc`)
   *   - Protected Content (`mediaKeySystem`)
   *   - Augmented / Virtual Reality, Hand Tracking (`ar`, `vr`, `hand-tracking`)
   *   - Payment Handlers (`payment-handler`)
   *   - Background Sync (`background-sync`, `periodic-background-sync`, `background-fetch`)
   *   - Printing (`web-printing`)
   *   - App Installation (`web-app-installation`)
   *   - Storage Access (`storage-access`, `top-level-storage-access`)
   *
   * Not currently implemented (in approximate order of 'might want')
   *   - Local Network Access (`local-network-access`, `local-network`, `loopback-network`)
   *   - Screen Capture, Captured Surface Control (`display-capture`, `captured-surface-control`)
   *   - File Writing (`fileSystem`)
   *   - Open External (`openExternal`)
   *   - MIDI (`midi`, `midiSysex`)
   *   - Persistent Storage (`persistent-storage`)
   *   - Device Activity (`idle-detection`)
   *   - Audio Output (`speaker-selection`)
   *   - Wake Lock (`screen-wake-lock`, `system-wake-lock`)
   *   - Window Management (`window-management`)
   *   - Fonts (`local-fonts`)
   *   - Automatic Fullscreen (`automatic-fullscreen`)
   */
};
const ALWAYS_ALLOWED_PERMISSIONS = /* @__PURE__ */ new Set([
  "pointerLock",
  "keyboardLock",
  "fullscreen",
  "clipboard-sanitized-write"
]);
function isAlwaysAllowedPermission(permission) {
  return ALWAYS_ALLOWED_PERMISSIONS.has(permission);
}
const ALL_PERMISSION_CATEGORIES = Object.keys(PERMISSION_CATEGORY_DESCRIPTORS);
const DEFAULT_PERMISSION_STATES = Object.freeze(
  Object.fromEntries(ALL_PERMISSION_CATEGORIES.map((category) => [category, PERMISSION_CATEGORY_DESCRIPTORS[category].defaultState]))
);
const PERMISSION_TO_CATEGORIES = (() => {
  const map = /* @__PURE__ */ new Map();
  for (const category of ALL_PERMISSION_CATEGORIES) {
    for (const permission of PERMISSION_CATEGORY_DESCRIPTORS[category].permissions) {
      if (permission === "media") {
        continue;
      }
      const existing = map.get(permission);
      if (existing) {
        existing.push(category);
      } else {
        map.set(permission, [category]);
      }
    }
  }
  return map;
})();
function electronPermissionToCategories(permission, mediaKinds) {
  if (permission === "media") {
    return resolveMediaCategories(mediaKinds);
  }
  return PERMISSION_TO_CATEGORIES.get(permission) ?? [];
}
function resolveMediaCategories(mediaKinds) {
  const categories = /* @__PURE__ */ new Set();
  for (const kind of mediaKinds ?? []) {
    categories.add(kind === "video" ? "camera" /* Camera */ : "microphone" /* Microphone */);
  }
  if (categories.size === 0) {
    return ["camera" /* Camera */, "microphone" /* Microphone */];
  }
  return [...categories];
}
function toOriginKey(url) {
  const trimmed = url?.trim();
  if (!trimmed || trimmed === "null") {
    return "";
  }
  try {
    const parsed = new URL(trimmed);
    if (!parsed.host) {
      return `${parsed.protocol}//${parsed.pathname}`;
    }
    return parsed.origin;
  } catch {
    return trimmed;
  }
}
const VALID_CATEGORIES = new Set(ALL_PERMISSION_CATEGORIES);
class BrowserPermissionStore extends Disposable {
  constructor() {
    super(...arguments);
    this._data = /* @__PURE__ */ new Map();
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
  }
  /**
   * The default state assumed for a category when an origin has recorded no decision.
   */
  defaultStateFor(category) {
    return PERMISSION_CATEGORY_DESCRIPTORS[category].defaultState;
  }
  /** Get the recorded decision for a (origin, category) pair. */
  getDecision(origin, category) {
    return this._data.get(toOriginKey(origin))?.get(category);
  }
  /**
   * Resolve the effective boolean decision for a (origin, category) pair,
   * applying {@link defaultStateFor} when the recorded state is 'ask'.
   */
  isAllowed(origin, category) {
    return (this.getDecision(origin, category) ?? this.defaultStateFor(category)) === "allow";
  }
  /** Set (or clear, via `null`) the decision for a (origin, category) pair. */
  set(origin, category, decision) {
    const key = toOriginKey(origin);
    if (!key) {
      return;
    }
    if (decision === null) {
      const categories = this._data.get(key);
      if (!categories?.delete(category)) {
        return;
      }
      if (categories.size === 0) {
        this._data.delete(key);
      }
    } else {
      let categories = this._data.get(key);
      if (categories?.get(category) === decision) {
        return;
      }
      if (!categories) {
        categories = /* @__PURE__ */ new Map();
        this._data.set(key, categories);
      }
      categories.set(category, decision);
    }
    this._onDidChange.fire();
  }
  /** Set (or clear) the decision for several categories of one origin at once. */
  setMany(origin, grants) {
    for (const { category, state } of grants) {
      this.set(origin, category, state);
    }
  }
  /** Remove all recorded state for an origin. */
  clearOrigin(origin) {
    const key = toOriginKey(origin);
    if (this._data.delete(key)) {
      this._onDidChange.fire();
    }
  }
  /** Remove all recorded state for every origin. */
  clear() {
    if (this._data.size === 0) {
      return;
    }
    this._data.clear();
    this._onDidChange.fire();
  }
  /**
   * Return the full category->state map for one origin, including categories
   * with no recorded decision. Ideal for rendering a
   * per-site settings page.
   */
  getOrigin(origin) {
    const result = { ...DEFAULT_PERMISSION_STATES };
    const recorded = this._data.get(toOriginKey(origin));
    if (recorded) {
      for (const [category, state] of recorded) {
        result[category] = state;
      }
    }
    return result;
  }
  /** All origins that have at least one recorded decision. */
  origins() {
    return [...this._data.keys()];
  }
  /** Flat list of every recorded grant. */
  list() {
    const grants = [];
    for (const [origin, categories] of this._data) {
      for (const [category, state] of categories) {
        grants.push({ origin, category, state });
      }
    }
    return grants;
  }
  serialize() {
    const origins = {};
    for (const [origin, categories] of this._data) {
      const entry = {};
      for (const [category, state] of categories) {
        entry[category] = state;
      }
      origins[origin] = entry;
    }
    return { origins };
  }
  hydrate(snapshot) {
    this._data.clear();
    if (snapshot?.origins && typeof snapshot.origins === "object") {
      for (const [origin, categories] of Object.entries(snapshot.origins)) {
        if (!categories || typeof categories !== "object") {
          continue;
        }
        const key = toOriginKey(origin);
        if (!key) {
          continue;
        }
        let target;
        for (const [category, state] of Object.entries(categories)) {
          if (!VALID_CATEGORIES.has(category) || state !== "allow" && state !== "deny") {
            continue;
          }
          if (!target) {
            target = /* @__PURE__ */ new Map();
            this._data.set(key, target);
          }
          target.set(category, state);
        }
      }
    }
    this._onDidChange.fire();
  }
}
export {
  ALL_PERMISSION_CATEGORIES,
  ALWAYS_ALLOWED_PERMISSIONS,
  BrowserPermissionStore,
  PERMISSION_CATEGORY_DESCRIPTORS,
  PermissionCategory,
  electronPermissionToCategories,
  isAlwaysAllowedPermission,
  toOriginKey
};
