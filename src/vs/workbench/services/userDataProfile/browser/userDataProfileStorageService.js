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
import { Emitter, Event } from "../../../../base/common/event.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { AbstractUserDataProfileStorageService, IUserDataProfileStorageService } from "../../../../platform/userDataProfile/common/userDataProfileStorageService.js";
import { isProfileUsingDefaultStorage, IStorageService, StorageScope } from "../../../../platform/storage/common/storage.js";
import { IndexedDBStorageDatabase } from "../../storage/browser/storageService.js";
import { IUserDataProfileService } from "../common/userDataProfile.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
let UserDataProfileStorageService = class extends AbstractUserDataProfileStorageService {
  constructor(storageService, userDataProfileService, logService) {
    super(true, storageService);
    this.userDataProfileService = userDataProfileService;
    this.logService = logService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    const disposables = this._register(new DisposableStore());
    this._register(Event.filter(storageService.onDidChangeTarget, (e) => e.scope === StorageScope.PROFILE, disposables)(() => this.onDidChangeStorageTargetInCurrentProfile()));
    this._register(storageService.onDidChangeValue(StorageScope.PROFILE, void 0, disposables)((e) => this.onDidChangeStorageValueInCurrentProfile(e)));
  }
  onDidChangeStorageTargetInCurrentProfile() {
    this._onDidChange.fire({ targetChanges: [this.userDataProfileService.currentProfile], valueChanges: [] });
  }
  onDidChangeStorageValueInCurrentProfile(e) {
    this._onDidChange.fire({ targetChanges: [], valueChanges: [{ profile: this.userDataProfileService.currentProfile, changes: [e] }] });
  }
  createStorageDatabase(profile) {
    return isProfileUsingDefaultStorage(profile) ? IndexedDBStorageDatabase.createApplicationStorage(this.logService) : IndexedDBStorageDatabase.createProfileStorage(profile, this.logService);
  }
};
UserDataProfileStorageService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, IUserDataProfileService),
  __decorateParam(2, ILogService)
], UserDataProfileStorageService);
registerSingleton(IUserDataProfileStorageService, UserDataProfileStorageService, InstantiationType.Delayed);
export {
  UserDataProfileStorageService
};
