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
import { Throttler } from "../../../base/common/async.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable, MutableDisposable } from "../../../base/common/lifecycle.js";
import { equals } from "../../../base/common/objects.js";
import { ILogService } from "../../log/common/log.js";
import { collectManagedSettingsDefinitions, MANAGED_SETTINGS_CONTROL_DEFINITIONS } from "../common/copilotManagedSettings.js";
let NativeManagedSettingsService = class extends Disposable {
  constructor(logService, productName, watcherOptions, watcherFactory) {
    super();
    this.logService = logService;
    this.productName = productName;
    this.watcherOptions = watcherOptions;
    this.watcherFactory = watcherFactory;
    this.throttler = this._register(new Throttler());
    this.watcher = this._register(new MutableDisposable());
    this.managedSettingsValues = /* @__PURE__ */ new Map();
    this.watchedSettings = MANAGED_SETTINGS_CONTROL_DEFINITIONS;
    this.initializationVersion = 0;
    this._onDidChangeManagedSettings = this._register(new Emitter());
    this.onDidChangeManagedSettings = this._onDidChangeManagedSettings.event;
  }
  get managedSettings() {
    return Object.fromEntries(this.managedSettingsValues);
  }
  async initialize() {
    await this.ensureWatcher();
    return this.managedSettings;
  }
  async updatePolicyDefinitions(policyDefinitions) {
    const managedSettings = {
      ...collectManagedSettingsDefinitions(policyDefinitions),
      ...MANAGED_SETTINGS_CONTROL_DEFINITIONS
    };
    if (equals(this.watchedSettings, managedSettings)) {
      return this.initialize();
    }
    this.watchedSettings = managedSettings;
    const changed = this.pruneManagedSettingsValues();
    await this.ensureWatcher(true);
    if (changed) {
      this._onDidChangeManagedSettings.fire(this.managedSettings);
    }
    return this.managedSettings;
  }
  ensureWatcher(force = false) {
    if (!force && this.initializationPromise) {
      return this.initializationPromise;
    }
    const update = this.updateWatcherAndTrack(++this.initializationVersion);
    this.initializationPromise = update;
    return update;
  }
  async updateWatcherAndTrack(version) {
    try {
      await this.updateWatcher();
    } catch (error) {
      if (this.initializationVersion === version) {
        this.initializationPromise = void 0;
      }
      throw error;
    }
  }
  pruneManagedSettingsValues() {
    let changed = false;
    for (const key of this.managedSettingsValues.keys()) {
      if (!this.watchedSettings[key]) {
        this.managedSettingsValues.delete(key);
        changed = true;
      }
    }
    return changed;
  }
  async updateWatcher() {
    const managedSettingDefinitions = this.getManagedSettingDefinitions();
    this.logService.trace(`NativeManagedSettingsService#updateWatcher - Found ${Object.keys(managedSettingDefinitions).length} managed-settings definitions`);
    if (Object.keys(managedSettingDefinitions).length === 0) {
      this.watcher.clear();
      const hadManagedSettings = this.managedSettingsValues.size > 0;
      this.managedSettingsValues.clear();
      if (hadManagedSettings) {
        this._onDidChangeManagedSettings.fire(this.managedSettings);
      }
      return;
    }
    const { createWatcher } = this.watcherFactory ? { createWatcher: this.watcherFactory } : await import("@vscode/policy-watcher");
    await this.throttler.queue(() => new Promise((c, e) => {
      try {
        this.logService.trace(`Creating native managed-settings watcher for productName ${this.productName}`);
        this.watcher.value = createWatcher(this.productName, managedSettingDefinitions, (update) => {
          this._onDidManagedSettingsChange(update);
          c();
        }, this.watcherOptions);
      } catch (err) {
        this.logService.error(`NativeManagedSettingsService#updateWatcher - Error creating watcher:`, err);
        e(err);
      }
    }));
  }
  /**
   * Project the internal {@link IManagedSettingsPolicyDefinitions} (readonly, and free to grow
   * extra fields) down to the minimal `{ type }` payload the external `@vscode/policy-watcher`
   * native module expects. Deliberately a fresh, narrowly-typed copy rather than handing the
   * watcher our internal state: it decouples the two shapes so a future field on
   * `IManagedSettingPolicyDefinition` cannot silently leak across the native boundary.
   */
  getManagedSettingDefinitions() {
    const definitions = {};
    for (const key in this.watchedSettings) {
      definitions[key] = { type: this.watchedSettings[key].type };
    }
    return definitions;
  }
  _onDidManagedSettingsChange(update) {
    this.logService.trace(`NativeManagedSettingsService#_onDidManagedSettingsChange - Updated managed-settings values: ${JSON.stringify(update)}`);
    let changed = false;
    for (const [key, value] of Object.entries(update)) {
      if (value === void 0) {
        changed = this.managedSettingsValues.delete(key) || changed;
      } else {
        if (this.managedSettingsValues.get(key) !== value) {
          this.managedSettingsValues.set(key, value);
          changed = true;
        }
      }
    }
    if (changed) {
      this._onDidChangeManagedSettings.fire(this.managedSettings);
    }
  }
};
NativeManagedSettingsService = __decorateClass([
  __decorateParam(0, ILogService)
], NativeManagedSettingsService);
export {
  NativeManagedSettingsService
};
