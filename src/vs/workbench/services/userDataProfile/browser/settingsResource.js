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
import { VSBuffer } from "../../../../base/common/buffer.js";
import { ConfigurationScope, Extensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { FileOperationError, FileOperationResult, IFileService } from "../../../../platform/files/common/files.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IUserDataProfileService } from "../common/userDataProfile.js";
import { updateIgnoredSettings } from "../../../../platform/userDataSync/common/settingsMerge.js";
import { IUserDataSyncUtilService } from "../../../../platform/userDataSync/common/userDataSync.js";
import { TreeItemCollapsibleState } from "../../../common/views.js";
import { ProfileResourceType } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { API_OPEN_EDITOR_COMMAND_ID } from "../../../browser/parts/editor/editorCommands.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { localize } from "../../../../nls.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
let SettingsResourceInitializer = class {
  constructor(userDataProfileService, fileService, logService) {
    this.userDataProfileService = userDataProfileService;
    this.fileService = fileService;
    this.logService = logService;
  }
  async initialize(content) {
    const settingsContent = JSON.parse(content);
    if (settingsContent.settings === null) {
      this.logService.info(`Initializing Profile: No settings to apply...`);
      return;
    }
    await this.fileService.writeFile(this.userDataProfileService.currentProfile.settingsResource, VSBuffer.fromString(settingsContent.settings));
  }
};
SettingsResourceInitializer = __decorateClass([
  __decorateParam(0, IUserDataProfileService),
  __decorateParam(1, IFileService),
  __decorateParam(2, ILogService)
], SettingsResourceInitializer);
let SettingsResource = class {
  constructor(fileService, userDataSyncUtilService, logService) {
    this.fileService = fileService;
    this.userDataSyncUtilService = userDataSyncUtilService;
    this.logService = logService;
  }
  async getContent(profile) {
    const settingsContent = await this.getSettingsContent(profile);
    return JSON.stringify(settingsContent);
  }
  async getSettingsContent(profile) {
    const localContent = await this.getLocalFileContent(profile);
    if (localContent === null) {
      return { settings: null };
    } else {
      const ignoredSettings = this.getIgnoredSettings();
      const formattingOptions = await this.userDataSyncUtilService.resolveFormattingOptions(profile.settingsResource);
      const settings = updateIgnoredSettings(localContent || "{}", "{}", ignoredSettings, formattingOptions);
      return { settings };
    }
  }
  async apply(content, profile) {
    const settingsContent = JSON.parse(content);
    if (settingsContent.settings === null) {
      this.logService.info(`Importing Profile (${profile.name}): No settings to apply...`);
      return;
    }
    const localSettingsContent = await this.getLocalFileContent(profile);
    const formattingOptions = await this.userDataSyncUtilService.resolveFormattingOptions(profile.settingsResource);
    const contentToUpdate = updateIgnoredSettings(settingsContent.settings, localSettingsContent || "{}", this.getIgnoredSettings(), formattingOptions);
    await this.fileService.writeFile(profile.settingsResource, VSBuffer.fromString(contentToUpdate));
  }
  getIgnoredSettings() {
    const allSettings = Registry.as(Extensions.Configuration).getConfigurationProperties();
    const ignoredSettings = Object.keys(allSettings).filter((key) => allSettings[key]?.scope === ConfigurationScope.MACHINE || allSettings[key]?.scope === ConfigurationScope.APPLICATION_MACHINE || allSettings[key]?.scope === ConfigurationScope.MACHINE_OVERRIDABLE);
    return ignoredSettings;
  }
  async getLocalFileContent(profile) {
    try {
      const content = await this.fileService.readFile(profile.settingsResource);
      return content.value.toString();
    } catch (error) {
      if (error instanceof FileOperationError && error.fileOperationResult === FileOperationResult.FILE_NOT_FOUND) {
        return null;
      } else {
        throw error;
      }
    }
  }
};
SettingsResource = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IUserDataSyncUtilService),
  __decorateParam(2, ILogService)
], SettingsResource);
let SettingsResourceTreeItem = class {
  constructor(profile, uriIdentityService, instantiationService) {
    this.profile = profile;
    this.uriIdentityService = uriIdentityService;
    this.instantiationService = instantiationService;
    this.type = ProfileResourceType.Settings;
    this.handle = ProfileResourceType.Settings;
    this.label = { label: localize("settings", "Settings") };
    this.collapsibleState = TreeItemCollapsibleState.Expanded;
  }
  async getChildren() {
    return [{
      handle: this.profile.settingsResource.toString(),
      resourceUri: this.profile.settingsResource,
      collapsibleState: TreeItemCollapsibleState.None,
      parent: this,
      accessibilityInformation: {
        label: this.uriIdentityService.extUri.basename(this.profile.settingsResource)
      },
      command: {
        id: API_OPEN_EDITOR_COMMAND_ID,
        title: "",
        arguments: [this.profile.settingsResource, void 0, void 0]
      }
    }];
  }
  async hasContent() {
    const settingsContent = await this.instantiationService.createInstance(SettingsResource).getSettingsContent(this.profile);
    return settingsContent.settings !== null;
  }
  async getContent() {
    return this.instantiationService.createInstance(SettingsResource).getContent(this.profile);
  }
  isFromDefaultProfile() {
    return !this.profile.isDefault && !!this.profile.useDefaultFlags?.settings;
  }
};
SettingsResourceTreeItem = __decorateClass([
  __decorateParam(1, IUriIdentityService),
  __decorateParam(2, IInstantiationService)
], SettingsResourceTreeItem);
export {
  SettingsResource,
  SettingsResourceInitializer,
  SettingsResourceTreeItem
};
