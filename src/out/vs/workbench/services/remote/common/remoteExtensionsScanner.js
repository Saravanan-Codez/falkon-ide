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
import { IRemoteAgentService } from "./remoteAgentService.js";
import { IRemoteExtensionsScannerService, RemoteExtensionsScannerChannelName } from "../../../../platform/remote/common/remoteExtensionsScanner.js";
import * as platform from "../../../../base/common/platform.js";
import { URI } from "../../../../base/common/uri.js";
import { IUserDataProfileService } from "../../userDataProfile/common/userDataProfile.js";
import { IRemoteUserDataProfilesService } from "../../userDataProfile/common/remoteUserDataProfiles.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IActiveLanguagePackService } from "../../localization/common/locale.js";
import { IWorkbenchExtensionManagementService } from "../../extensionManagement/common/extensionManagement.js";
let RemoteExtensionsScannerService = class {
  constructor(remoteAgentService, environmentService, userDataProfileService, remoteUserDataProfilesService, activeLanguagePackService, extensionManagementService, logService) {
    this.remoteAgentService = remoteAgentService;
    this.environmentService = environmentService;
    this.userDataProfileService = userDataProfileService;
    this.remoteUserDataProfilesService = remoteUserDataProfilesService;
    this.activeLanguagePackService = activeLanguagePackService;
    this.extensionManagementService = extensionManagementService;
    this.logService = logService;
  }
  whenExtensionsReady() {
    return this.withChannel(
      (channel) => channel.call("whenExtensionsReady"),
      { failed: [] }
    );
  }
  async scanExtensions() {
    try {
      const languagePack = await this.activeLanguagePackService.getExtensionIdProvidingCurrentLocale();
      return await this.withChannel(
        async (channel) => {
          const profileLocation = this.userDataProfileService.currentProfile.isDefault ? void 0 : (await this.remoteUserDataProfilesService.getRemoteProfile(this.userDataProfileService.currentProfile)).extensionsResource;
          const scannedExtensions = await channel.call("scanExtensions", [
            platform.language,
            profileLocation,
            this.extensionManagementService.getInstalledWorkspaceExtensionLocations(),
            this.environmentService.extensionDevelopmentLocationURI,
            languagePack
          ]);
          scannedExtensions.forEach((extension) => {
            extension.extensionLocation = URI.revive(extension.extensionLocation);
          });
          return scannedExtensions;
        },
        []
      );
    } catch (error) {
      this.logService.error(error);
      return [];
    }
  }
  withChannel(callback, fallback) {
    const connection = this.remoteAgentService.getConnection();
    if (!connection) {
      return Promise.resolve(fallback);
    }
    return connection.withChannel(RemoteExtensionsScannerChannelName, (channel) => callback(channel));
  }
};
RemoteExtensionsScannerService = __decorateClass([
  __decorateParam(0, IRemoteAgentService),
  __decorateParam(1, IWorkbenchEnvironmentService),
  __decorateParam(2, IUserDataProfileService),
  __decorateParam(3, IRemoteUserDataProfilesService),
  __decorateParam(4, IActiveLanguagePackService),
  __decorateParam(5, IWorkbenchExtensionManagementService),
  __decorateParam(6, ILogService)
], RemoteExtensionsScannerService);
registerSingleton(IRemoteExtensionsScannerService, RemoteExtensionsScannerService, InstantiationType.Delayed);
