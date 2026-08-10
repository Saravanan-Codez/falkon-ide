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
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IRemoteUserDataProfilesService } from "../../userDataProfile/common/remoteUserDataProfiles.js";
import { ProfileAwareExtensionManagementChannelClient } from "./extensionManagementChannelClient.js";
import { IUserDataProfileService } from "../../userDataProfile/common/userDataProfile.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IAllowedExtensionsService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
let RemoteExtensionManagementService = class extends ProfileAwareExtensionManagementChannelClient {
  constructor(channel, productService, allowedExtensionsService, userDataProfileService, userDataProfilesService, remoteUserDataProfilesService, uriIdentityService) {
    super(channel, productService, allowedExtensionsService, userDataProfileService, uriIdentityService);
    this.userDataProfilesService = userDataProfilesService;
    this.remoteUserDataProfilesService = remoteUserDataProfilesService;
  }
  async filterEvent(profileLocation, applicationScoped) {
    if (applicationScoped) {
      return true;
    }
    if (!profileLocation && this.userDataProfileService.currentProfile.isDefault) {
      return true;
    }
    const currentRemoteProfile = await this.remoteUserDataProfilesService.getRemoteProfile(this.userDataProfileService.currentProfile);
    if (this.uriIdentityService.extUri.isEqual(currentRemoteProfile.extensionsResource, profileLocation)) {
      return true;
    }
    return false;
  }
  async getProfileLocation(profileLocation) {
    if (!profileLocation && this.userDataProfileService.currentProfile.isDefault) {
      return void 0;
    }
    profileLocation = await super.getProfileLocation(profileLocation);
    let profile = this.userDataProfilesService.profiles.find((p) => this.uriIdentityService.extUri.isEqual(p.extensionsResource, profileLocation));
    if (profile) {
      profile = await this.remoteUserDataProfilesService.getRemoteProfile(profile);
    } else {
      profile = (await this.remoteUserDataProfilesService.getRemoteProfiles()).find((p) => this.uriIdentityService.extUri.isEqual(p.extensionsResource, profileLocation));
    }
    return profile?.extensionsResource;
  }
  async switchExtensionsProfile(previousProfileLocation, currentProfileLocation, preserveExtensions) {
    const remoteProfiles = await this.remoteUserDataProfilesService.getRemoteProfiles();
    const previousProfile = remoteProfiles.find((p) => this.uriIdentityService.extUri.isEqual(p.extensionsResource, previousProfileLocation));
    const currentProfile = remoteProfiles.find((p) => this.uriIdentityService.extUri.isEqual(p.extensionsResource, currentProfileLocation));
    if (previousProfile?.id === currentProfile?.id) {
      return { added: [], removed: [] };
    }
    return super.switchExtensionsProfile(previousProfileLocation, currentProfileLocation, preserveExtensions);
  }
};
RemoteExtensionManagementService = __decorateClass([
  __decorateParam(1, IProductService),
  __decorateParam(2, IAllowedExtensionsService),
  __decorateParam(3, IUserDataProfileService),
  __decorateParam(4, IUserDataProfilesService),
  __decorateParam(5, IRemoteUserDataProfilesService),
  __decorateParam(6, IUriIdentityService)
], RemoteExtensionManagementService);
export {
  RemoteExtensionManagementService
};
