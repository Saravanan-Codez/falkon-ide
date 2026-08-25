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
import { localize } from "../../../../nls.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { ProfileResourceType } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { IUserDataProfileStorageService } from "../../../../platform/userDataProfile/common/userDataProfileStorageService.js";
import { API_OPEN_EDITOR_COMMAND_ID } from "../../../browser/parts/editor/editorCommands.js";
import { TreeItemCollapsibleState } from "../../../common/views.js";
let GlobalStateResourceInitializer = class {
  constructor(storageService) {
    this.storageService = storageService;
  }
  async initialize(content) {
    const globalState = JSON.parse(content);
    const storageKeys = Object.keys(globalState.storage);
    if (storageKeys.length) {
      const storageEntries = [];
      for (const key of storageKeys) {
        storageEntries.push({ key, value: globalState.storage[key], scope: StorageScope.PROFILE, target: StorageTarget.USER });
      }
      this.storageService.storeAll(storageEntries, true);
    }
  }
};
GlobalStateResourceInitializer = __decorateClass([
  __decorateParam(0, IStorageService)
], GlobalStateResourceInitializer);
let GlobalStateResource = class {
  constructor(storageService, userDataProfileStorageService, logService) {
    this.storageService = storageService;
    this.userDataProfileStorageService = userDataProfileStorageService;
    this.logService = logService;
  }
  async getContent(profile) {
    const globalState = await this.getGlobalState(profile);
    return JSON.stringify(globalState);
  }
  async apply(content, profile) {
    const globalState = JSON.parse(content);
    await this.writeGlobalState(globalState, profile);
  }
  async getGlobalState(profile) {
    const storage = {};
    const storageData = await this.userDataProfileStorageService.readStorageData(profile);
    for (const [key, value] of storageData) {
      if (value.value !== void 0 && value.target === StorageTarget.USER) {
        storage[key] = value.value;
      }
    }
    return { storage };
  }
  async writeGlobalState(globalState, profile) {
    const storageKeys = Object.keys(globalState.storage);
    if (storageKeys.length) {
      const updatedStorage = /* @__PURE__ */ new Map();
      const nonProfileKeys = [
        // Do not include application scope user target keys because they also include default profile user target keys
        ...this.storageService.keys(StorageScope.APPLICATION, StorageTarget.MACHINE),
        ...this.storageService.keys(StorageScope.WORKSPACE, StorageTarget.USER),
        ...this.storageService.keys(StorageScope.WORKSPACE, StorageTarget.MACHINE)
      ];
      for (const key of storageKeys) {
        if (nonProfileKeys.includes(key)) {
          this.logService.info(`Importing Profile (${profile.name}): Ignoring global state key '${key}' because it is not a profile key.`);
        } else {
          updatedStorage.set(key, globalState.storage[key]);
        }
      }
      await this.userDataProfileStorageService.updateStorageData(profile, updatedStorage, StorageTarget.USER);
    }
  }
};
GlobalStateResource = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, IUserDataProfileStorageService),
  __decorateParam(2, ILogService)
], GlobalStateResource);
class GlobalStateResourceTreeItem {
  constructor(resource, uriIdentityService) {
    this.resource = resource;
    this.uriIdentityService = uriIdentityService;
    this.type = ProfileResourceType.GlobalState;
    this.handle = ProfileResourceType.GlobalState;
    this.label = { label: localize("globalState", "UI State") };
    this.collapsibleState = TreeItemCollapsibleState.Collapsed;
  }
  async getChildren() {
    return [{
      handle: this.resource.toString(),
      resourceUri: this.resource,
      collapsibleState: TreeItemCollapsibleState.None,
      accessibilityInformation: {
        label: this.uriIdentityService.extUri.basename(this.resource)
      },
      parent: this,
      command: {
        id: API_OPEN_EDITOR_COMMAND_ID,
        title: "",
        arguments: [this.resource, void 0, void 0]
      }
    }];
  }
}
let GlobalStateResourceExportTreeItem = class extends GlobalStateResourceTreeItem {
  constructor(profile, resource, uriIdentityService, instantiationService) {
    super(resource, uriIdentityService);
    this.profile = profile;
    this.instantiationService = instantiationService;
  }
  async hasContent() {
    const globalState = await this.instantiationService.createInstance(GlobalStateResource).getGlobalState(this.profile);
    return Object.keys(globalState.storage).length > 0;
  }
  async getContent() {
    return this.instantiationService.createInstance(GlobalStateResource).getContent(this.profile);
  }
  isFromDefaultProfile() {
    return !this.profile.isDefault && !!this.profile.useDefaultFlags?.globalState;
  }
};
GlobalStateResourceExportTreeItem = __decorateClass([
  __decorateParam(2, IUriIdentityService),
  __decorateParam(3, IInstantiationService)
], GlobalStateResourceExportTreeItem);
let GlobalStateResourceImportTreeItem = class extends GlobalStateResourceTreeItem {
  constructor(content, resource, uriIdentityService) {
    super(resource, uriIdentityService);
    this.content = content;
  }
  async getContent() {
    return this.content;
  }
  isFromDefaultProfile() {
    return false;
  }
};
GlobalStateResourceImportTreeItem = __decorateClass([
  __decorateParam(2, IUriIdentityService)
], GlobalStateResourceImportTreeItem);
export {
  GlobalStateResource,
  GlobalStateResourceExportTreeItem,
  GlobalStateResourceImportTreeItem,
  GlobalStateResourceInitializer,
  GlobalStateResourceTreeItem
};
