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
import { CancellationToken } from "../../../base/common/cancellation.js";
import { Disposable, toDisposable } from "../../../base/common/lifecycle.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { ILifecycleMainService } from "../../lifecycle/electron-main/lifecycleMainService.js";
import { ILogService } from "../../log/common/log.js";
import { IWindowsMainService } from "../../windows/electron-main/windows.js";
const IGlobalKeybindingsMainService = createDecorator("globalKeybindingsMainService");
let GlobalKeybindingsMainService = class extends Disposable {
  constructor(globalShortcut, windowsMainService, lifecycleMainService, logService) {
    super();
    this.globalShortcut = globalShortcut;
    this.windowsMainService = windowsMainService;
    this.logService = logService;
    /** Per-window desired bindings, keyed by window id then by accelerator. */
    this.registry = /* @__PURE__ */ new Map();
    /** Accelerators this service currently owns an OS registration for. */
    this.registeredAccelerators = /* @__PURE__ */ new Set();
    /** Accelerators that were desired but failed to register (e.g. already taken). */
    this.failedAccelerators = /* @__PURE__ */ new Set();
    this._register(this.windowsMainService.onDidDestroyWindow((window) => this.onDidDestroyWindow(window)));
    this._register(lifecycleMainService.onWillShutdown(() => this.unregisterAll()));
    this._register(toDisposable(() => this.unregisterAll()));
  }
  updateKeybindings(windowId, keybindings) {
    const perWindow = /* @__PURE__ */ new Map();
    for (const keybinding of keybindings) {
      if (!this.isValid(keybinding)) {
        this.logService.warn(`[GlobalKeybindings] ignoring invalid system-wide keybinding: ${JSON.stringify(keybinding)}`);
        continue;
      }
      if (perWindow.has(keybinding.accelerator)) {
        this.logService.warn(`[GlobalKeybindings] duplicate accelerator '${keybinding.accelerator}' in window ${windowId}, keeping first`);
        continue;
      }
      perWindow.set(keybinding.accelerator, keybinding);
    }
    if (perWindow.size > 0) {
      this.registry.set(windowId, perWindow);
    } else {
      this.registry.delete(windowId);
    }
    this.reconcile();
    const failed = [];
    for (const keybinding of perWindow.values()) {
      if (this.failedAccelerators.has(keybinding.accelerator)) {
        failed.push(keybinding.userSettingsLabel ?? keybinding.accelerator);
      }
    }
    return { failed };
  }
  isValid(keybinding) {
    return typeof keybinding.accelerator === "string" && keybinding.accelerator.length > 0 && typeof keybinding.commandId === "string" && keybinding.commandId.length > 0;
  }
  /**
   * Reconciles the OS registrations against the union of all windows' desired accelerators.
   * Unregisters only accelerators this service owns; never touches shortcuts owned elsewhere.
   */
  reconcile() {
    const desired = /* @__PURE__ */ new Set();
    for (const perWindow of this.registry.values()) {
      for (const accelerator of perWindow.keys()) {
        desired.add(accelerator);
      }
    }
    for (const accelerator of [...this.registeredAccelerators]) {
      if (!desired.has(accelerator)) {
        this.globalShortcut.unregister(accelerator);
        this.registeredAccelerators.delete(accelerator);
        this.failedAccelerators.delete(accelerator);
      }
    }
    for (const accelerator of desired) {
      if (this.registeredAccelerators.has(accelerator)) {
        continue;
      }
      let registered = false;
      try {
        registered = this.globalShortcut.register(accelerator, () => this.onTrigger(accelerator));
      } catch (error) {
        this.logService.error(`[GlobalKeybindings] error registering '${accelerator}'`, error);
      }
      if (registered) {
        this.registeredAccelerators.add(accelerator);
        this.failedAccelerators.delete(accelerator);
      } else {
        this.failedAccelerators.add(accelerator);
        this.logService.warn(`[GlobalKeybindings] failed to register accelerator '${accelerator}' (already taken by the OS or another application)`);
      }
    }
  }
  onTrigger(accelerator) {
    const owners = [];
    for (const [windowId, perWindow] of this.registry) {
      if (perWindow.has(accelerator)) {
        owners.push(windowId);
      }
    }
    if (owners.length === 0) {
      return;
    }
    let target;
    const focused = this.windowsMainService.getFocusedWindow();
    if (focused && this.registry.get(focused.id)?.has(accelerator)) {
      target = focused;
    } else {
      target = owners.map((windowId) => this.windowsMainService.getWindowById(windowId)).filter((window) => !!window).sort((a, b) => a.id - b.id).at(0);
    }
    if (!target) {
      this.logService.warn(`[GlobalKeybindings] no live window to handle accelerator '${accelerator}'`);
      return;
    }
    const binding = this.registry.get(target.id)?.get(accelerator);
    if (!binding) {
      return;
    }
    this.logService.trace(`[GlobalKeybindings] trigger '${accelerator}' -> '${binding.commandId}' in window ${target.id}`);
    const payload = {
      id: binding.commandId,
      from: "systemWideKeybinding",
      args: binding.args === void 0 ? void 0 : [binding.args]
    };
    target.sendWhenReady("vscode:runAction", CancellationToken.None, payload);
  }
  onDidDestroyWindow(window) {
    if (this.registry.delete(window.id)) {
      this.reconcile();
    }
  }
  unregisterAll() {
    for (const accelerator of this.registeredAccelerators) {
      this.globalShortcut.unregister(accelerator);
    }
    this.registeredAccelerators.clear();
    this.failedAccelerators.clear();
    this.registry.clear();
  }
};
GlobalKeybindingsMainService = __decorateClass([
  __decorateParam(1, IWindowsMainService),
  __decorateParam(2, ILifecycleMainService),
  __decorateParam(3, ILogService)
], GlobalKeybindingsMainService);
export {
  GlobalKeybindingsMainService,
  IGlobalKeybindingsMainService
};
