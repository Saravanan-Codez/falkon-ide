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
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IHostColorSchemeService } from "../common/hostColorSchemeService.js";
import { INativeWorkbenchEnvironmentService } from "../../environment/electron-browser/environmentService.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { isBoolean, isObject } from "../../../../base/common/types.js";
import { ILifecycleService, StartupKind } from "../../lifecycle/common/lifecycle.js";
let NativeHostColorSchemeService = class extends Disposable {
  constructor(nativeHostService, environmentService, storageService, lifecycleService) {
    super();
    this.nativeHostService = nativeHostService;
    this.storageService = storageService;
    this._onDidChangeColorScheme = this._register(new Emitter());
    this.onDidChangeColorScheme = this._onDidChangeColorScheme.event;
    this._register(this.nativeHostService.onDidChangeColorScheme((scheme) => this.update(scheme)));
    let initial = environmentService.window.colorScheme;
    if (lifecycleService.startupKind === StartupKind.ReloadedWindow) {
      initial = this.getStoredValue(initial);
    }
    this.dark = initial.dark;
    this.highContrast = initial.highContrast;
    this.nativeHostService.getOSColorScheme().then((scheme) => this.update(scheme));
  }
  static {
    // we remember the last color scheme value to restore for reloaded window
    this.STORAGE_KEY = "HostColorSchemeData";
  }
  getStoredValue(dftl) {
    const stored = this.storageService.get(NativeHostColorSchemeService.STORAGE_KEY, StorageScope.APPLICATION);
    if (stored) {
      try {
        const scheme = JSON.parse(stored);
        if (isObject(scheme) && isBoolean(scheme.highContrast) && isBoolean(scheme.dark)) {
          return scheme;
        }
      } catch (e) {
      }
    }
    return dftl;
  }
  update({ highContrast, dark }) {
    if (dark !== this.dark || highContrast !== this.highContrast) {
      this.dark = dark;
      this.highContrast = highContrast;
      this.storageService.store(NativeHostColorSchemeService.STORAGE_KEY, JSON.stringify({ highContrast, dark }), StorageScope.APPLICATION, StorageTarget.MACHINE);
      this._onDidChangeColorScheme.fire();
    }
  }
};
NativeHostColorSchemeService = __decorateClass([
  __decorateParam(0, INativeHostService),
  __decorateParam(1, INativeWorkbenchEnvironmentService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, ILifecycleService)
], NativeHostColorSchemeService);
registerSingleton(IHostColorSchemeService, NativeHostColorSchemeService, InstantiationType.Delayed);
export {
  NativeHostColorSchemeService
};
