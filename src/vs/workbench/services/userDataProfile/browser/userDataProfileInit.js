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
import { IStorageService, StorageScope } from "../../../../platform/storage/common/storage.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { Barrier, Promises } from "../../../../base/common/async.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IUserDataProfileService } from "../common/userDataProfile.js";
import { SettingsResourceInitializer } from "./settingsResource.js";
import { GlobalStateResourceInitializer } from "./globalStateResource.js";
import { KeybindingsResourceInitializer } from "./keybindingsResource.js";
import { TasksResourceInitializer } from "./tasksResource.js";
import { SnippetsResourceInitializer } from "./snippetsResource.js";
import { McpResourceInitializer } from "./mcpProfileResource.js";
import { ExtensionsResourceInitializer } from "./extensionsResource.js";
import { IBrowserWorkbenchEnvironmentService } from "../../environment/browser/environmentService.js";
import { isString } from "../../../../base/common/types.js";
import { IRequestService, asJson } from "../../../../platform/request/common/request.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { URI } from "../../../../base/common/uri.js";
import { ProfileResourceType } from "../../../../platform/userDataProfile/common/userDataProfile.js";
let UserDataProfileInitializer = class {
  constructor(environmentService, fileService, userDataProfileService, storageService, logService, uriIdentityService, requestService) {
    this.environmentService = environmentService;
    this.fileService = fileService;
    this.userDataProfileService = userDataProfileService;
    this.storageService = storageService;
    this.logService = logService;
    this.uriIdentityService = uriIdentityService;
    this.requestService = requestService;
    this.initialized = [];
    this.initializationFinished = new Barrier();
  }
  async whenInitializationFinished() {
    await this.initializationFinished.wait();
  }
  async requiresInitialization() {
    if (!this.environmentService.options?.profile?.contents) {
      return false;
    }
    if (!this.storageService.isNew(StorageScope.PROFILE)) {
      return false;
    }
    return true;
  }
  async initializeRequiredResources() {
    this.logService.trace(`UserDataProfileInitializer#initializeRequiredResources`);
    const promises = [];
    const profileTemplate = await this.getProfileTemplate();
    if (profileTemplate?.settings) {
      promises.push(this.initialize(new SettingsResourceInitializer(this.userDataProfileService, this.fileService, this.logService), profileTemplate.settings, ProfileResourceType.Settings));
    }
    if (profileTemplate?.globalState) {
      promises.push(this.initialize(new GlobalStateResourceInitializer(this.storageService), profileTemplate.globalState, ProfileResourceType.GlobalState));
    }
    await Promise.all(promises);
  }
  async initializeOtherResources(instantiationService) {
    try {
      this.logService.trace(`UserDataProfileInitializer#initializeOtherResources`);
      const promises = [];
      const profileTemplate = await this.getProfileTemplate();
      if (profileTemplate?.keybindings) {
        promises.push(this.initialize(new KeybindingsResourceInitializer(this.userDataProfileService, this.fileService, this.logService), profileTemplate.keybindings, ProfileResourceType.Keybindings));
      }
      if (profileTemplate?.tasks) {
        promises.push(this.initialize(new TasksResourceInitializer(this.userDataProfileService, this.fileService, this.logService), profileTemplate.tasks, ProfileResourceType.Tasks));
      }
      if (profileTemplate?.mcp) {
        promises.push(this.initialize(new McpResourceInitializer(this.userDataProfileService, this.fileService, this.logService), profileTemplate.mcp, ProfileResourceType.Mcp));
      }
      if (profileTemplate?.snippets) {
        promises.push(this.initialize(new SnippetsResourceInitializer(this.userDataProfileService, this.fileService, this.uriIdentityService, this.logService), profileTemplate.snippets, ProfileResourceType.Snippets));
      }
      promises.push(this.initializeInstalledExtensions(instantiationService));
      await Promises.settled(promises);
    } finally {
      this.initializationFinished.open();
    }
  }
  async initializeInstalledExtensions(instantiationService) {
    if (!this.initializeInstalledExtensionsPromise) {
      const profileTemplate = await this.getProfileTemplate();
      if (profileTemplate?.extensions) {
        this.initializeInstalledExtensionsPromise = this.initialize(instantiationService.createInstance(ExtensionsResourceInitializer), profileTemplate.extensions, ProfileResourceType.Extensions);
      } else {
        this.initializeInstalledExtensionsPromise = Promise.resolve();
      }
    }
    return this.initializeInstalledExtensionsPromise;
  }
  getProfileTemplate() {
    if (!this.profileTemplatePromise) {
      this.profileTemplatePromise = this.doGetProfileTemplate();
    }
    return this.profileTemplatePromise;
  }
  async doGetProfileTemplate() {
    if (!this.environmentService.options?.profile?.contents) {
      return null;
    }
    if (isString(this.environmentService.options.profile.contents)) {
      try {
        return JSON.parse(this.environmentService.options.profile.contents);
      } catch (error) {
        this.logService.error(error);
        return null;
      }
    }
    try {
      const url = URI.revive(this.environmentService.options.profile.contents).toString(true);
      const context = await this.requestService.request({ type: "GET", url, callSite: "userDataProfileInit.initializeProfile" }, CancellationToken.None);
      if (context.res.statusCode === 200) {
        return await asJson(context);
      } else {
        this.logService.warn(`UserDataProfileInitializer: Failed to get profile from URL: ${url}. Status code: ${context.res.statusCode}.`);
      }
    } catch (error) {
      this.logService.error(error);
    }
    return null;
  }
  async initialize(initializer, content, profileResource) {
    try {
      if (this.initialized.includes(profileResource)) {
        this.logService.info(`UserDataProfileInitializer: ${profileResource} initialized already.`);
        return;
      }
      this.initialized.push(profileResource);
      this.logService.trace(`UserDataProfileInitializer: Initializing ${profileResource}`);
      await initializer.initialize(content);
      this.logService.info(`UserDataProfileInitializer: Initialized ${profileResource}`);
    } catch (error) {
      this.logService.info(`UserDataProfileInitializer: Error while initializing ${profileResource}`);
      this.logService.error(error);
    }
  }
};
UserDataProfileInitializer = __decorateClass([
  __decorateParam(0, IBrowserWorkbenchEnvironmentService),
  __decorateParam(1, IFileService),
  __decorateParam(2, IUserDataProfileService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, ILogService),
  __decorateParam(5, IUriIdentityService),
  __decorateParam(6, IRequestService)
], UserDataProfileInitializer);
export {
  UserDataProfileInitializer
};
