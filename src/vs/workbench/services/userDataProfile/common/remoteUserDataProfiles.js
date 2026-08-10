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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { IRemoteAgentService } from "../../remote/common/remoteAgentService.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IUserDataProfileService } from "./userDataProfile.js";
import { distinct } from "../../../../base/common/arrays.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { UserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfileIpc.js";
import { ErrorNoTelemetry } from "../../../../base/common/errors.js";
const associatedRemoteProfilesKey = "associatedRemoteProfiles";
const IRemoteUserDataProfilesService = createDecorator("IRemoteUserDataProfilesService");
let RemoteUserDataProfilesService = class extends Disposable {
  constructor(environmentService, remoteAgentService, userDataProfilesService, userDataProfileService, storageService, logService) {
    super();
    this.environmentService = environmentService;
    this.remoteAgentService = remoteAgentService;
    this.userDataProfilesService = userDataProfilesService;
    this.userDataProfileService = userDataProfileService;
    this.storageService = storageService;
    this.logService = logService;
    this.initPromise = this.init();
  }
  async init() {
    const connection = this.remoteAgentService.getConnection();
    if (!connection) {
      return;
    }
    const environment = await this.remoteAgentService.getEnvironment();
    if (!environment) {
      return;
    }
    this.remoteUserDataProfilesService = new UserDataProfilesService(environment.profiles.all, environment.profiles.home, connection.getChannel("userDataProfiles"));
    this._register(this.userDataProfilesService.onDidChangeProfiles((e) => this.onDidChangeLocalProfiles(e)));
    const remoteProfile = await this.getAssociatedRemoteProfile(this.userDataProfileService.currentProfile, this.remoteUserDataProfilesService);
    if (!remoteProfile.isDefault) {
      this.setAssociatedRemoteProfiles([...this.getAssociatedRemoteProfiles(), remoteProfile.id]);
    }
    this.cleanUp();
  }
  async onDidChangeLocalProfiles(e) {
    for (const profile of e.removed) {
      const remoteProfile = this.remoteUserDataProfilesService?.profiles.find((p) => p.id === profile.id);
      if (remoteProfile) {
        await this.remoteUserDataProfilesService?.removeProfile(remoteProfile);
      }
    }
  }
  async getRemoteProfiles() {
    await this.initPromise;
    if (!this.remoteUserDataProfilesService) {
      throw new ErrorNoTelemetry("Remote profiles service not available in the current window");
    }
    return this.remoteUserDataProfilesService.profiles;
  }
  async getRemoteProfile(localProfile) {
    await this.initPromise;
    if (!this.remoteUserDataProfilesService) {
      throw new ErrorNoTelemetry("Remote profiles service not available in the current window");
    }
    return this.getAssociatedRemoteProfile(localProfile, this.remoteUserDataProfilesService);
  }
  async getAssociatedRemoteProfile(localProfile, remoteUserDataProfilesService) {
    if (localProfile.isDefault) {
      return remoteUserDataProfilesService.defaultProfile;
    }
    let profile = remoteUserDataProfilesService.profiles.find((p) => p.id === localProfile.id);
    if (!profile) {
      profile = await remoteUserDataProfilesService.createProfile(localProfile.id, localProfile.name, {
        transient: localProfile.isTransient,
        useDefaultFlags: localProfile.useDefaultFlags
      });
      this.setAssociatedRemoteProfiles([...this.getAssociatedRemoteProfiles(), this.userDataProfileService.currentProfile.id]);
    }
    return profile;
  }
  getAssociatedRemoteProfiles() {
    if (this.environmentService.remoteAuthority) {
      const remotes = this.parseAssociatedRemoteProfiles();
      return remotes[this.environmentService.remoteAuthority] ?? [];
    }
    return [];
  }
  setAssociatedRemoteProfiles(profiles) {
    if (this.environmentService.remoteAuthority) {
      const remotes = this.parseAssociatedRemoteProfiles();
      profiles = distinct(profiles);
      if (profiles.length) {
        remotes[this.environmentService.remoteAuthority] = profiles;
      } else {
        delete remotes[this.environmentService.remoteAuthority];
      }
      if (Object.keys(remotes).length) {
        this.storageService.store(associatedRemoteProfilesKey, JSON.stringify(remotes), StorageScope.APPLICATION, StorageTarget.MACHINE);
      } else {
        this.storageService.remove(associatedRemoteProfilesKey, StorageScope.APPLICATION);
      }
    }
  }
  parseAssociatedRemoteProfiles() {
    if (this.environmentService.remoteAuthority) {
      const value = this.storageService.get(associatedRemoteProfilesKey, StorageScope.APPLICATION);
      try {
        return value ? JSON.parse(value) : {};
      } catch (error) {
        this.logService.error(error);
      }
    }
    return {};
  }
  async cleanUp() {
    const associatedRemoteProfiles = [];
    for (const profileId of this.getAssociatedRemoteProfiles()) {
      const remoteProfile = this.remoteUserDataProfilesService?.profiles.find((p) => p.id === profileId);
      if (!remoteProfile) {
        continue;
      }
      const localProfile = this.userDataProfilesService.profiles.find((p) => p.id === profileId);
      if (localProfile) {
        if (localProfile.name !== remoteProfile.name) {
          await this.remoteUserDataProfilesService?.updateProfile(remoteProfile, { name: localProfile.name });
        }
        associatedRemoteProfiles.push(profileId);
        continue;
      }
      if (remoteProfile) {
        await this.remoteUserDataProfilesService?.removeProfile(remoteProfile);
      }
    }
    this.setAssociatedRemoteProfiles(associatedRemoteProfiles);
  }
};
RemoteUserDataProfilesService = __decorateClass([
  __decorateParam(0, IWorkbenchEnvironmentService),
  __decorateParam(1, IRemoteAgentService),
  __decorateParam(2, IUserDataProfilesService),
  __decorateParam(3, IUserDataProfileService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, ILogService)
], RemoteUserDataProfilesService);
registerSingleton(IRemoteUserDataProfilesService, RemoteUserDataProfilesService, InstantiationType.Delayed);
export {
  IRemoteUserDataProfilesService
};
