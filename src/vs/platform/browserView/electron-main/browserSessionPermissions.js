import { DeferredPromise } from "../../../base/common/async.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable, toDisposable } from "../../../base/common/lifecycle.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { webContents as electronWebContents } from "electron";
import { localize } from "../../../nls.js";
import { StorageScope, StorageTarget } from "../../storage/common/storage.js";
import {
  BrowserPermissionStore,
  PermissionCategory,
  electronPermissionToCategories,
  isAlwaysAllowedPermission,
  toOriginKey
} from "../common/browserPermissions.js";
import { BrowserViewStorageScope } from "../common/browserView.js";
const PROMPT_TIMEOUT_MS = 3e4;
class BrowserSessionPermissions extends Disposable {
  constructor(session) {
    super();
    this._permissionStore = this._register(new BrowserPermissionStore());
    /** Fires on any change to the store (set, clear, hydrate). */
    this.onDidChange = this._permissionStore.onDidChange;
    this._persistable = false;
    /** While set, store changes are coalesced into a single deferred flush. */
    this._batching = false;
    this._batchDirty = false;
    this._onDidRequestPermission = this._register(new Emitter());
    this.onDidRequestPermission = this._onDidRequestPermission.event;
    this._onDidRequestDevice = this._register(new Emitter());
    this.onDidRequestDevice = this._onDidRequestDevice.event;
    this._pending = /* @__PURE__ */ new Set();
    this._pendingDevices = /* @__PURE__ */ new Map();
    this.storageKeys = session.storageScope === BrowserViewStorageScope.Ephemeral ? {} : { permissions: `browser.permissions.${session.id}` };
    this._register(this._permissionStore.onDidChange(() => {
      this._resolvePending();
      if (this._batching) {
        this._batchDirty = true;
        return;
      }
      if (this._persistable) {
        this._flushNow();
      }
    }));
    this._register(toDisposable(() => {
      for (const pending of this._pending) {
        pending.deferred.complete();
      }
      this._pending.clear();
      for (const device of [...this._pendingDevices.values()]) {
        device.settle(null);
      }
    }));
  }
  /**
   * Install the permission request / check / device handlers on the session.
   * Backed entirely by {@link BrowserPermissionStore}; unrecorded categories
   * are brokered to the owning browser view via {@link onDidRequestPermission}.
   */
  configure(electronSession) {
    electronSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
      this._resolveRequest(webContents, permission, details).then(callback, () => callback(false));
    });
    electronSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin, details) => {
      if (isAlwaysAllowedPermission(permission)) {
        return true;
      }
      const origin = toOriginKey(details.requestingUrl || requestingOrigin);
      const categories = electronPermissionToCategories(permission, mediaKindsFromDetails(details));
      if (categories.length === 0) {
        return false;
      }
      return categories.every((category) => this._permissionStore.isAllowed(origin, category));
    });
    electronSession.on("select-usb-device", (event, details, callback) => {
      event.preventDefault();
      const target = this._frameTarget(details.frame);
      if (!target || !this._deviceAllowed(target.origin)) {
        callback();
        return;
      }
      this._beginDeviceRequest({
        webContents: target.webContents,
        origin: target.origin,
        deviceType: "usb",
        devices: details.deviceList.map(usbCandidate),
        invoke: (deviceId) => deviceId === null ? callback() : callback(deviceId)
      });
    });
    electronSession.on("usb-device-added", (_event, device, webContents) => {
      this._addDevice(webContents, "usb", usbCandidate(device));
    });
    electronSession.on("usb-device-removed", (_event, device, webContents) => {
      this._removeDevice(webContents, "usb", device.deviceId);
    });
    electronSession.on("select-serial-port", (event, portList, webContents, callback) => {
      event.preventDefault();
      const origin = toOriginKey(webContents.getURL());
      if (!this._deviceAllowed(origin)) {
        callback("");
        return;
      }
      this._beginDeviceRequest({
        webContents,
        origin,
        deviceType: "serial",
        devices: portList.map(serialCandidate),
        invoke: (deviceId) => callback(deviceId ?? "")
      });
    });
    electronSession.on("serial-port-added", (_event, port, webContents) => {
      this._addDevice(webContents, "serial", serialCandidate(port));
    });
    electronSession.on("serial-port-removed", (_event, port, webContents) => {
      this._removeDevice(webContents, "serial", port.portId);
    });
    electronSession.on("select-hid-device", (event, details, callback) => {
      event.preventDefault();
      const target = this._frameTarget(details.frame);
      if (!target || !this._deviceAllowed(target.origin)) {
        callback(null);
        return;
      }
      this._beginDeviceRequest({
        webContents: target.webContents,
        origin: target.origin,
        deviceType: "hid",
        devices: details.deviceList.map(hidCandidate),
        invoke: (deviceId) => callback(deviceId ?? null)
      });
    });
    electronSession.on("hid-device-added", (_event, details) => {
      const target = this._frameTarget(details.frame);
      if (target) {
        this._addDevice(target.webContents, "hid", hidCandidate(details.device));
      }
    });
    electronSession.on("hid-device-removed", (_event, details) => {
      const target = this._frameTarget(details.frame);
      if (target) {
        this._removeDevice(target.webContents, "hid", details.device.deviceId);
      }
    });
  }
  connectStorage(storage) {
    if (this._storage || !this.storageKeys.permissions) {
      return;
    }
    this._storage = storage;
    this._load();
    this._persistable = true;
  }
  serialize() {
    return this._permissionStore.serialize();
  }
  set(origin, grants) {
    const key = toOriginKey(origin);
    for (const grant of grants) {
      if (grant.state === null) {
        this._resolvePendingForCategory(key, grant.category);
      }
    }
    this._batching = true;
    this._batchDirty = false;
    try {
      this._permissionStore.setMany(origin, grants);
    } finally {
      this._batching = false;
    }
    if (this._batchDirty && this._persistable) {
      this._flushNow();
    }
  }
  _resolvePendingForCategory(origin, category) {
    if (!origin || this._pending.size === 0) {
      return;
    }
    for (const pending of [...this._pending]) {
      if (pending.origin === origin && pending.category === category) {
        pending.deferred.complete();
      }
    }
  }
  clear() {
    this._permissionStore.clear();
  }
  // -- Device choosers -------------------------------------------------
  beginBluetoothRequest(webContents, devices, callback) {
    const origin = toOriginKey(webContents.getURL());
    if (!this._deviceAllowed(origin)) {
      callback("");
      return;
    }
    const candidates = devices.map(bluetoothCandidate);
    const existing = this._findActiveDevice(webContents, "bluetooth");
    if (existing) {
      existing.devices = candidates;
      existing.invoke = (deviceId) => callback(deviceId ?? "");
      this._emitDeviceRequest(existing);
      return;
    }
    this._beginDeviceRequest({
      webContents,
      origin,
      deviceType: "bluetooth",
      devices: candidates,
      invoke: (deviceId) => callback(deviceId ?? "")
    });
  }
  resolveDevice(requestId, deviceId) {
    this._pendingDevices.get(requestId)?.settle(deviceId);
  }
  /** Begin a device chooser: register it, emit it, and cancel if unclaimed. */
  _beginDeviceRequest(params) {
    const requestId = generateUuid();
    const settle = (deviceId) => {
      if (pending.settled) {
        return;
      }
      pending.settled = true;
      params.webContents.off("destroyed", cancel);
      this._pendingDevices.delete(requestId);
      pending.invoke(deviceId);
    };
    const cancel = () => settle(null);
    const pending = {
      requestId,
      webContents: params.webContents,
      origin: params.origin,
      deviceType: params.deviceType,
      devices: params.devices,
      settled: false,
      invoke: params.invoke,
      settle
    };
    params.webContents.on("destroyed", cancel);
    this._pendingDevices.set(requestId, pending);
    if (!this._emitDeviceRequest(pending)) {
      cancel();
    }
  }
  _emitDeviceRequest(pending) {
    let claimed = false;
    this._onDidRequestDevice.fire({
      webContents: pending.webContents,
      origin: pending.origin,
      requestId: pending.requestId,
      deviceType: pending.deviceType,
      devices: pending.devices,
      claim: () => {
        claimed = true;
      }
    });
    return claimed;
  }
  _addDevice(webContents, deviceType, candidate) {
    const pending = this._findActiveDevice(webContents, deviceType);
    if (!pending || pending.devices.some((device) => device.deviceId === candidate.deviceId)) {
      return;
    }
    pending.devices = [...pending.devices, candidate];
    this._emitDeviceRequest(pending);
  }
  _removeDevice(webContents, deviceType, deviceId) {
    const pending = this._findActiveDevice(webContents, deviceType);
    if (!pending) {
      return;
    }
    const next = pending.devices.filter((device) => device.deviceId !== deviceId);
    if (next.length === pending.devices.length) {
      return;
    }
    pending.devices = next;
    this._emitDeviceRequest(pending);
  }
  _findActiveDevice(webContents, deviceType) {
    for (const pending of this._pendingDevices.values()) {
      if (!pending.settled && pending.webContents === webContents && pending.deviceType === deviceType) {
        return pending;
      }
    }
    return void 0;
  }
  /** Resolve the owning web contents and origin for a requesting frame. */
  _frameTarget(frame) {
    if (!frame) {
      return void 0;
    }
    const webContents = electronWebContents.fromFrame(frame);
    if (!webContents) {
      return void 0;
    }
    return { webContents, origin: toOriginKey(frame.url || webContents.getURL()) };
  }
  _deviceAllowed(origin) {
    return !!origin && this._permissionStore.isAllowed(origin, PermissionCategory.Devices);
  }
  async _resolveRequest(webContents, permission, details) {
    if (isAlwaysAllowedPermission(permission)) {
      return true;
    }
    const origin = toOriginKey(details?.requestingUrl ?? webContents?.getURL());
    const categories = electronPermissionToCategories(permission, mediaKindsFromDetails(details));
    if (categories.length === 0 || !origin) {
      return false;
    }
    if (categories.every((category) => this._permissionStore.isAllowed(origin, category))) {
      return true;
    }
    if (categories.some((category) => this._permissionStore.getDecision(origin, category) === "deny")) {
      return false;
    }
    for (const category of categories) {
      if (!this._permissionStore.getDecision(origin, category)) {
        await this._prompt(webContents, origin, category);
      }
    }
    return categories.every((category) => this._permissionStore.isAllowed(origin, category));
  }
  _prompt(webContents, origin, category) {
    if (!webContents) {
      return Promise.resolve();
    }
    let claimed = false;
    this._onDidRequestPermission.fire({
      webContents,
      request: { origin, category },
      claim: () => {
        claimed = true;
      }
    });
    if (!claimed) {
      return Promise.resolve();
    }
    const pending = { origin, category, deferred: new DeferredPromise() };
    this._pending.add(pending);
    const timer = setTimeout(() => pending.deferred.complete(), PROMPT_TIMEOUT_MS);
    return pending.deferred.p.finally(() => {
      clearTimeout(timer);
      this._pending.delete(pending);
    });
  }
  /** Resolve any pending request whose (origin, category) now has a decision. */
  _resolvePending() {
    if (this._pending.size === 0) {
      return;
    }
    for (const pending of [...this._pending]) {
      if (this._permissionStore.getDecision(pending.origin, pending.category)) {
        pending.deferred.complete();
      }
    }
  }
  _load() {
    const storage = this._storage;
    const key = this.storageKeys.permissions;
    if (!storage || !key) {
      return;
    }
    const snapshot = parseSnapshot(storage.get(key, StorageScope.APPLICATION));
    this._persistable = false;
    try {
      this._permissionStore.hydrate(snapshot);
    } finally {
      this._persistable = true;
    }
  }
  _flushNow() {
    const storage = this._storage;
    const key = this.storageKeys.permissions;
    if (!storage || !key) {
      return;
    }
    const snapshot = this._permissionStore.serialize();
    if (Object.keys(snapshot.origins).length === 0) {
      storage.remove(key, StorageScope.APPLICATION);
    } else {
      storage.store(key, JSON.stringify(snapshot), StorageScope.APPLICATION, StorageTarget.MACHINE);
    }
  }
}
function parseSnapshot(raw) {
  if (!raw) {
    return void 0;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return void 0;
    }
    return parsed;
  } catch {
    return void 0;
  }
}
function mediaKindsFromDetails(details) {
  if (!details) {
    return void 0;
  }
  const kinds = /* @__PURE__ */ new Set();
  if ("mediaTypes" in details && details.mediaTypes) {
    for (const kind of details.mediaTypes) {
      kinds.add(kind);
    }
  }
  if ("mediaType" in details && (details.mediaType === "video" || details.mediaType === "audio")) {
    kinds.add(details.mediaType);
  }
  return kinds.size ? [...kinds] : void 0;
}
function vendorProductHex(vendorId, productId) {
  const hex = (value) => (value ?? 0).toString(16).padStart(4, "0");
  return `${hex(vendorId)}:${hex(productId)}`;
}
function usbCandidate(device) {
  const ids = vendorProductHex(device.vendorId, device.productId);
  return {
    deviceId: device.deviceId,
    label: device.productName || device.manufacturerName || localize("browser.device.usb", "USB Device {0}", ids),
    detail: device.serialNumber ? `${ids} \xB7 ${device.serialNumber}` : ids
  };
}
function serialCandidate(port) {
  const ids = port.vendorId && port.productId ? `${port.vendorId}:${port.productId}` : void 0;
  return {
    deviceId: port.portId,
    label: `${port.portName} (${port.displayName})`,
    detail: ids
  };
}
function hidCandidate(device) {
  const ids = vendorProductHex(device.vendorId, device.productId);
  return {
    deviceId: device.deviceId,
    label: device.name || localize("browser.device.hid", "HID Device {0}", ids),
    detail: device.serialNumber ? `${ids} \xB7 ${device.serialNumber}` : ids
  };
}
function bluetoothCandidate(device) {
  return {
    deviceId: device.deviceId,
    label: device.deviceName || device.deviceId,
    detail: device.deviceId
  };
}
export {
  BrowserSessionPermissions
};
