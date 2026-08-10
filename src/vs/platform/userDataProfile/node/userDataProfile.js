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
import { URI } from "../../../base/common/uri.js";
import { INativeEnvironmentService } from "../../environment/common/environment.js";
import { IFileService } from "../../files/common/files.js";
import { ILogService } from "../../log/common/log.js";
import { IStateReadService, IStateService } from "../../state/node/state.js";
import { IUriIdentityService } from "../../uriIdentity/common/uriIdentity.js";
import { UserDataProfilesService as BaseUserDataProfilesService } from "../common/userDataProfile.js";
import { isString } from "../../../base/common/types.js";
import { SaveStrategy, StateService } from "../../state/node/stateService.js";
let UserDataProfilesReadonlyService = class extends BaseUserDataProfilesService {
  constructor(stateReadonlyService, uriIdentityService, nativeEnvironmentService, fileService, logService) {
    super(nativeEnvironmentService, fileService, uriIdentityService, logService);
    this.stateReadonlyService = stateReadonlyService;
    this.nativeEnvironmentService = nativeEnvironmentService;
  }
  getStoredProfiles() {
    const storedProfilesState = this.stateReadonlyService.getItem(UserDataProfilesReadonlyService.PROFILES_KEY, []);
    return storedProfilesState.map((p) => ({
      ...p,
      location: isString(p.location) ? this.uriIdentityService.extUri.joinPath(this.profilesHome, p.location) : URI.revive(p.location)
    }));
  }
  getStoredProfileAssociations() {
    return this.stateReadonlyService.getItem(UserDataProfilesReadonlyService.PROFILE_ASSOCIATIONS_KEY, {});
  }
  getDefaultProfileExtensionsLocation() {
    return this.uriIdentityService.extUri.joinPath(URI.file(this.nativeEnvironmentService.extensionsPath).with({ scheme: this.profilesHome.scheme }), "extensions.json");
  }
};
UserDataProfilesReadonlyService = __decorateClass([
  __decorateParam(0, IStateReadService),
  __decorateParam(1, IUriIdentityService),
  __decorateParam(2, INativeEnvironmentService),
  __decorateParam(3, IFileService),
  __decorateParam(4, ILogService)
], UserDataProfilesReadonlyService);
let UserDataProfilesService = class extends UserDataProfilesReadonlyService {
  constructor(stateService, uriIdentityService, environmentService, fileService, logService) {
    super(stateService, uriIdentityService, environmentService, fileService, logService);
    this.stateService = stateService;
  }
  saveStoredProfiles(storedProfiles) {
    if (storedProfiles.length) {
      this.stateService.setItem(UserDataProfilesService.PROFILES_KEY, storedProfiles.map((profile) => ({ ...profile, location: this.uriIdentityService.extUri.relativePath(this.profilesHome, profile.location) })));
    } else {
      this.stateService.removeItem(UserDataProfilesService.PROFILES_KEY);
    }
  }
  saveStoredProfileAssociations(storedProfileAssociations) {
    if (storedProfileAssociations.emptyWindows || storedProfileAssociations.workspaces) {
      this.stateService.setItem(UserDataProfilesService.PROFILE_ASSOCIATIONS_KEY, storedProfileAssociations);
    } else {
      this.stateService.removeItem(UserDataProfilesService.PROFILE_ASSOCIATIONS_KEY);
    }
  }
};
UserDataProfilesService = __decorateClass([
  __decorateParam(0, IStateService),
  __decorateParam(1, IUriIdentityService),
  __decorateParam(2, INativeEnvironmentService),
  __decorateParam(3, IFileService),
  __decorateParam(4, ILogService)
], UserDataProfilesService);
let ServerUserDataProfilesService = class extends UserDataProfilesService {
  constructor(uriIdentityService, environmentService, fileService, logService) {
    super(new StateService(SaveStrategy.IMMEDIATE, environmentService, logService, fileService), uriIdentityService, environmentService, fileService, logService);
  }
  async init() {
    await this.stateService.init();
    return super.init();
  }
};
ServerUserDataProfilesService = __decorateClass([
  __decorateParam(0, IUriIdentityService),
  __decorateParam(1, INativeEnvironmentService),
  __decorateParam(2, IFileService),
  __decorateParam(3, ILogService)
], ServerUserDataProfilesService);
export {
  ServerUserDataProfilesService,
  UserDataProfilesReadonlyService,
  UserDataProfilesService
};
