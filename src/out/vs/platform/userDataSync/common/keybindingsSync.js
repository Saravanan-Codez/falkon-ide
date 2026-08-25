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
import { isNonEmptyArray } from "../../../base/common/arrays.js";
import { VSBuffer } from "../../../base/common/buffer.js";
import { Event } from "../../../base/common/event.js";
import { parse } from "../../../base/common/json.js";
import { OperatingSystem, OS } from "../../../base/common/platform.js";
import { isUndefined } from "../../../base/common/types.js";
import { localize } from "../../../nls.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { IEnvironmentService } from "../../environment/common/environment.js";
import { FileOperationResult, IFileService } from "../../files/common/files.js";
import { IStorageService } from "../../storage/common/storage.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { IUriIdentityService } from "../../uriIdentity/common/uriIdentity.js";
import { IUserDataProfilesService } from "../../userDataProfile/common/userDataProfile.js";
import { AbstractInitializer, AbstractJsonFileSynchroniser } from "./abstractSynchronizer.js";
import { merge } from "./keybindingsMerge.js";
import { Change, IUserDataSyncLocalStoreService, IUserDataSyncLogService, IUserDataSyncEnablementService, IUserDataSyncStoreService, IUserDataSyncUtilService, SyncResource, UserDataSyncError, UserDataSyncErrorCode, USER_DATA_SYNC_SCHEME, CONFIG_SYNC_KEYBINDINGS_PER_PLATFORM } from "./userDataSync.js";
function getKeybindingsContentFromSyncContent(syncContent, platformSpecific, logService) {
  try {
    const parsed = JSON.parse(syncContent);
    if (!platformSpecific) {
      return isUndefined(parsed.all) ? null : parsed.all;
    }
    switch (OS) {
      case OperatingSystem.Macintosh:
        return isUndefined(parsed.mac) ? null : parsed.mac;
      case OperatingSystem.Linux:
        return isUndefined(parsed.linux) ? null : parsed.linux;
      case OperatingSystem.Windows:
        return isUndefined(parsed.windows) ? null : parsed.windows;
    }
  } catch (e) {
    logService.error(e);
    return null;
  }
}
let KeybindingsSynchroniser = class extends AbstractJsonFileSynchroniser {
  constructor(profile, collection, userDataSyncStoreService, userDataSyncLocalStoreService, logService, configurationService, userDataSyncEnablementService, fileService, environmentService, storageService, userDataSyncUtilService, telemetryService, uriIdentityService) {
    super(profile.keybindingsResource, { syncResource: SyncResource.Keybindings, profile }, collection, fileService, environmentService, storageService, userDataSyncStoreService, userDataSyncLocalStoreService, userDataSyncEnablementService, telemetryService, logService, userDataSyncUtilService, configurationService, uriIdentityService);
    /* Version 2: Change settings from `sync.${setting}` to `settingsSync.{setting}` */
    this.version = 2;
    this.previewResource = this.extUri.joinPath(this.syncPreviewFolder, "keybindings.json");
    this.baseResource = this.previewResource.with({ scheme: USER_DATA_SYNC_SCHEME, authority: "base" });
    this.localResource = this.previewResource.with({ scheme: USER_DATA_SYNC_SCHEME, authority: "local" });
    this.remoteResource = this.previewResource.with({ scheme: USER_DATA_SYNC_SCHEME, authority: "remote" });
    this.acceptedResource = this.previewResource.with({ scheme: USER_DATA_SYNC_SCHEME, authority: "accepted" });
    this._register(Event.filter(configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration("settingsSync.keybindingsPerPlatform"))(() => this.triggerLocalChange()));
  }
  async generateSyncPreview(remoteUserData, lastSyncUserData, isRemoteDataFromCurrentMachine, userDataSyncConfiguration) {
    const remoteContent = remoteUserData.syncData ? getKeybindingsContentFromSyncContent(remoteUserData.syncData.content, userDataSyncConfiguration.keybindingsPerPlatform ?? this.syncKeybindingsPerPlatform(), this.logService) : null;
    lastSyncUserData = lastSyncUserData === null && isRemoteDataFromCurrentMachine ? remoteUserData : lastSyncUserData;
    const lastSyncContent = lastSyncUserData ? this.getKeybindingsContentFromLastSyncUserData(lastSyncUserData) : null;
    const fileContent = await this.getLocalFileContent();
    const formattingOptions = await this.getFormattingOptions();
    let mergedContent = null;
    let hasLocalChanged = false;
    let hasRemoteChanged = false;
    let hasConflicts = false;
    if (remoteContent) {
      let localContent2 = fileContent ? fileContent.value.toString() : "[]";
      localContent2 = localContent2 || "[]";
      if (this.hasErrors(localContent2, true)) {
        throw new UserDataSyncError(localize("errorInvalidSettings", "Unable to sync keybindings because the content in the file is not valid. Please open the file and correct it."), UserDataSyncErrorCode.LocalInvalidContent, this.resource);
      }
      if (!lastSyncContent || lastSyncContent !== localContent2 || lastSyncContent !== remoteContent) {
        this.logService.trace(`${this.syncResourceLogLabel}: Merging remote keybindings with local keybindings...`);
        const result = await merge(localContent2, remoteContent, lastSyncContent, formattingOptions, this.userDataSyncUtilService);
        if (result.hasChanges) {
          mergedContent = result.mergeContent;
          hasConflicts = result.hasConflicts;
          hasLocalChanged = hasConflicts || result.mergeContent !== localContent2;
          hasRemoteChanged = hasConflicts || result.mergeContent !== remoteContent;
        }
      }
    } else if (fileContent) {
      this.logService.trace(`${this.syncResourceLogLabel}: Remote keybindings does not exist. Synchronizing keybindings for the first time.`);
      mergedContent = fileContent.value.toString();
      hasRemoteChanged = true;
    }
    const previewResult = {
      content: hasConflicts ? lastSyncContent : mergedContent,
      localChange: hasLocalChanged ? fileContent ? Change.Modified : Change.Added : Change.None,
      remoteChange: hasRemoteChanged ? Change.Modified : Change.None,
      hasConflicts
    };
    const localContent = fileContent ? fileContent.value.toString() : null;
    return [{
      fileContent,
      baseResource: this.baseResource,
      baseContent: lastSyncContent,
      localResource: this.localResource,
      localContent,
      localChange: previewResult.localChange,
      remoteResource: this.remoteResource,
      remoteContent,
      remoteChange: previewResult.remoteChange,
      previewResource: this.previewResource,
      previewResult,
      acceptedResource: this.acceptedResource
    }];
  }
  async hasRemoteChanged(lastSyncUserData) {
    const lastSyncContent = this.getKeybindingsContentFromLastSyncUserData(lastSyncUserData);
    if (lastSyncContent === null) {
      return true;
    }
    const fileContent = await this.getLocalFileContent();
    const localContent = fileContent ? fileContent.value.toString() : "";
    const formattingOptions = await this.getFormattingOptions();
    const result = await merge(localContent || "[]", lastSyncContent, lastSyncContent, formattingOptions, this.userDataSyncUtilService);
    return result.hasConflicts || result.mergeContent !== lastSyncContent;
  }
  async getMergeResult(resourcePreview, token) {
    return resourcePreview.previewResult;
  }
  async getAcceptResult(resourcePreview, resource, content, token) {
    if (this.extUri.isEqual(resource, this.localResource)) {
      return {
        content: resourcePreview.fileContent ? resourcePreview.fileContent.value.toString() : null,
        localChange: Change.None,
        remoteChange: Change.Modified
      };
    }
    if (this.extUri.isEqual(resource, this.remoteResource)) {
      return {
        content: resourcePreview.remoteContent,
        localChange: Change.Modified,
        remoteChange: Change.None
      };
    }
    if (this.extUri.isEqual(resource, this.previewResource)) {
      if (content === void 0) {
        return {
          content: resourcePreview.previewResult.content,
          localChange: resourcePreview.previewResult.localChange,
          remoteChange: resourcePreview.previewResult.remoteChange
        };
      } else {
        return {
          content,
          localChange: Change.Modified,
          remoteChange: Change.Modified
        };
      }
    }
    throw new Error(`Invalid Resource: ${resource.toString()}`);
  }
  async applyResult(remoteUserData, lastSyncUserData, resourcePreviews, force) {
    const { fileContent } = resourcePreviews[0][0];
    let { content, localChange, remoteChange } = resourcePreviews[0][1];
    if (localChange === Change.None && remoteChange === Change.None) {
      this.logService.info(`${this.syncResourceLogLabel}: No changes found during synchronizing keybindings.`);
    }
    if (content !== null) {
      content = content.trim();
      content = content || "[]";
      if (this.hasErrors(content, true)) {
        throw new UserDataSyncError(localize("errorInvalidSettings", "Unable to sync keybindings because the content in the file is not valid. Please open the file and correct it."), UserDataSyncErrorCode.LocalInvalidContent, this.resource);
      }
    }
    if (localChange !== Change.None) {
      this.logService.trace(`${this.syncResourceLogLabel}: Updating local keybindings...`);
      if (fileContent) {
        await this.backupLocal(this.toSyncContent(fileContent.value.toString()));
      }
      await this.updateLocalFileContent(content || "[]", fileContent, force);
      this.logService.info(`${this.syncResourceLogLabel}: Updated local keybindings`);
    }
    if (remoteChange !== Change.None) {
      this.logService.trace(`${this.syncResourceLogLabel}: Updating remote keybindings...`);
      const remoteContents = this.toSyncContent(content || "[]", remoteUserData.syncData?.content);
      remoteUserData = await this.updateRemoteUserData(remoteContents, force ? null : remoteUserData.ref);
      this.logService.info(`${this.syncResourceLogLabel}: Updated remote keybindings`);
    }
    try {
      await this.fileService.del(this.previewResource);
    } catch (e) {
    }
    if (lastSyncUserData?.ref !== remoteUserData.ref) {
      this.logService.trace(`${this.syncResourceLogLabel}: Updating last synchronized keybindings...`);
      await this.updateLastSyncUserData(remoteUserData, { platformSpecific: this.syncKeybindingsPerPlatform() });
      this.logService.info(`${this.syncResourceLogLabel}: Updated last synchronized keybindings`);
    }
  }
  async hasLocalData() {
    try {
      const localFileContent = await this.getLocalFileContent();
      if (localFileContent) {
        const keybindings = parse(localFileContent.value.toString());
        if (isNonEmptyArray(keybindings)) {
          return true;
        }
      }
    } catch (error) {
      if (error.fileOperationResult !== FileOperationResult.FILE_NOT_FOUND) {
        return true;
      }
    }
    return false;
  }
  async resolveContent(uri) {
    if (this.extUri.isEqual(this.remoteResource, uri) || this.extUri.isEqual(this.baseResource, uri) || this.extUri.isEqual(this.localResource, uri) || this.extUri.isEqual(this.acceptedResource, uri)) {
      return this.resolvePreviewContent(uri);
    }
    return null;
  }
  getKeybindingsContentFromLastSyncUserData(lastSyncUserData) {
    if (!lastSyncUserData.syncData) {
      return null;
    }
    if (lastSyncUserData.platformSpecific !== void 0 && lastSyncUserData.platformSpecific !== this.syncKeybindingsPerPlatform()) {
      return null;
    }
    return getKeybindingsContentFromSyncContent(lastSyncUserData.syncData.content, this.syncKeybindingsPerPlatform(), this.logService);
  }
  toSyncContent(keybindingsContent, syncContent) {
    let parsed = {};
    try {
      parsed = JSON.parse(syncContent || "{}");
    } catch (e) {
      this.logService.error(e);
    }
    if (this.syncKeybindingsPerPlatform()) {
      delete parsed.all;
    } else {
      parsed.all = keybindingsContent;
    }
    switch (OS) {
      case OperatingSystem.Macintosh:
        parsed.mac = keybindingsContent;
        break;
      case OperatingSystem.Linux:
        parsed.linux = keybindingsContent;
        break;
      case OperatingSystem.Windows:
        parsed.windows = keybindingsContent;
        break;
    }
    return JSON.stringify(parsed);
  }
  syncKeybindingsPerPlatform() {
    return !!this.configurationService.getValue(CONFIG_SYNC_KEYBINDINGS_PER_PLATFORM);
  }
};
KeybindingsSynchroniser = __decorateClass([
  __decorateParam(2, IUserDataSyncStoreService),
  __decorateParam(3, IUserDataSyncLocalStoreService),
  __decorateParam(4, IUserDataSyncLogService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IUserDataSyncEnablementService),
  __decorateParam(7, IFileService),
  __decorateParam(8, IEnvironmentService),
  __decorateParam(9, IStorageService),
  __decorateParam(10, IUserDataSyncUtilService),
  __decorateParam(11, ITelemetryService),
  __decorateParam(12, IUriIdentityService)
], KeybindingsSynchroniser);
let KeybindingsInitializer = class extends AbstractInitializer {
  constructor(fileService, userDataProfilesService, environmentService, logService, storageService, uriIdentityService) {
    super(SyncResource.Keybindings, userDataProfilesService, environmentService, logService, fileService, storageService, uriIdentityService);
  }
  async doInitialize(remoteUserData) {
    const keybindingsContent = remoteUserData.syncData ? this.getKeybindingsContentFromSyncContent(remoteUserData.syncData.content) : null;
    if (!keybindingsContent) {
      this.logService.info("Skipping initializing keybindings because remote keybindings does not exist.");
      return;
    }
    const isEmpty = await this.isEmpty();
    if (!isEmpty) {
      this.logService.info("Skipping initializing keybindings because local keybindings exist.");
      return;
    }
    await this.fileService.writeFile(this.userDataProfilesService.defaultProfile.keybindingsResource, VSBuffer.fromString(keybindingsContent));
    await this.updateLastSyncUserData(remoteUserData);
  }
  async isEmpty() {
    try {
      const fileContent = await this.fileService.readFile(this.userDataProfilesService.defaultProfile.settingsResource);
      const keybindings = parse(fileContent.value.toString());
      return !isNonEmptyArray(keybindings);
    } catch (error) {
      return error.fileOperationResult === FileOperationResult.FILE_NOT_FOUND;
    }
  }
  getKeybindingsContentFromSyncContent(syncContent) {
    try {
      return getKeybindingsContentFromSyncContent(syncContent, true, this.logService);
    } catch (e) {
      this.logService.error(e);
      return null;
    }
  }
};
KeybindingsInitializer = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IUserDataProfilesService),
  __decorateParam(2, IEnvironmentService),
  __decorateParam(3, IUserDataSyncLogService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, IUriIdentityService)
], KeybindingsInitializer);
export {
  KeybindingsInitializer,
  KeybindingsSynchroniser,
  getKeybindingsContentFromSyncContent
};
