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
import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { isWeb } from "../../../base/common/platform.js";
import { IEnvironmentService } from "../../environment/common/environment.js";
import { IStorageService, StorageScope, StorageTarget } from "../../storage/common/storage.js";
import { ALL_SYNC_RESOURCES, getEnablementKey, IUserDataSyncStoreManagementService, SyncResource } from "./userDataSync.js";
const enablementKey = "sync.enable";
let UserDataSyncEnablementService = class extends Disposable {
  constructor(storageService, environmentService, userDataSyncStoreManagementService) {
    super();
    this.storageService = storageService;
    this.environmentService = environmentService;
    this.userDataSyncStoreManagementService = userDataSyncStoreManagementService;
    this._onDidChangeEnablement = this._register(new Emitter());
    this.onDidChangeEnablement = this._onDidChangeEnablement.event;
    this._onDidChangeResourceEnablement = this._register(new Emitter());
    this.onDidChangeResourceEnablement = this._onDidChangeResourceEnablement.event;
    this._register(storageService.onDidChangeValue(StorageScope.APPLICATION, void 0, this._store)((e) => this.onDidStorageChange(e)));
  }
  isEnabled() {
    switch (this.environmentService.sync) {
      case "on":
        return true;
      case "off":
        return false;
    }
    return this.storageService.getBoolean(enablementKey, StorageScope.APPLICATION, false);
  }
  canToggleEnablement() {
    return this.userDataSyncStoreManagementService.userDataSyncStore !== void 0 && this.environmentService.sync === void 0;
  }
  setEnablement(enabled) {
    if (enabled && !this.canToggleEnablement()) {
      return;
    }
    this.storageService.store(enablementKey, enabled, StorageScope.APPLICATION, StorageTarget.MACHINE);
  }
  isResourceEnabled(resource, defaultValue) {
    const storedValue = this.storageService.getBoolean(getEnablementKey(resource), StorageScope.APPLICATION);
    defaultValue = defaultValue ?? resource !== SyncResource.Prompts;
    return storedValue ?? defaultValue;
  }
  isResourceEnablementConfigured(resource) {
    const storedValue = this.storageService.getBoolean(getEnablementKey(resource), StorageScope.APPLICATION);
    return storedValue !== void 0;
  }
  setResourceEnablement(resource, enabled) {
    if (this.isResourceEnabled(resource) !== enabled) {
      const resourceEnablementKey = getEnablementKey(resource);
      this.storeResourceEnablement(resourceEnablementKey, enabled);
    }
  }
  getResourceSyncStateVersion(resource) {
    return void 0;
  }
  storeResourceEnablement(resourceEnablementKey, enabled) {
    this.storageService.store(resourceEnablementKey, enabled, StorageScope.APPLICATION, isWeb ? StorageTarget.USER : StorageTarget.MACHINE);
  }
  onDidStorageChange(storageChangeEvent) {
    if (enablementKey === storageChangeEvent.key) {
      this._onDidChangeEnablement.fire(this.isEnabled());
      return;
    }
    const resourceKey = ALL_SYNC_RESOURCES.filter((resourceKey2) => getEnablementKey(resourceKey2) === storageChangeEvent.key)[0];
    if (resourceKey) {
      this._onDidChangeResourceEnablement.fire([resourceKey, this.isResourceEnabled(resourceKey)]);
      return;
    }
  }
};
UserDataSyncEnablementService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, IEnvironmentService),
  __decorateParam(2, IUserDataSyncStoreManagementService)
], UserDataSyncEnablementService);
export {
  UserDataSyncEnablementService
};
