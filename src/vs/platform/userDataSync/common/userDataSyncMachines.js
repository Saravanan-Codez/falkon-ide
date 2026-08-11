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
import { isAndroid, isChrome, isEdge, isFirefox, isSafari, isWeb, Platform, platform, PlatformToString } from "../../../base/common/platform.js";
import { escapeRegExpCharacters } from "../../../base/common/strings.js";
import { localize } from "../../../nls.js";
import { IEnvironmentService } from "../../environment/common/environment.js";
import { IFileService } from "../../files/common/files.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { IProductService } from "../../product/common/productService.js";
import { getServiceMachineId } from "../../externalServices/common/serviceMachineId.js";
import { IStorageService, StorageScope, StorageTarget } from "../../storage/common/storage.js";
import { IUserDataSyncLogService, IUserDataSyncStoreService } from "./userDataSync.js";
const IUserDataSyncMachinesService = createDecorator("IUserDataSyncMachinesService");
const currentMachineNameKey = "sync.currentMachineName";
const Safari = "Safari";
const Chrome = "Chrome";
const Edge = "Edge";
const Firefox = "Firefox";
const Android = "Android";
function isWebPlatform(platform2) {
  switch (platform2) {
    case Safari:
    case Chrome:
    case Edge:
    case Firefox:
    case Android:
    case PlatformToString(Platform.Web):
      return true;
  }
  return false;
}
function getPlatformName() {
  if (isSafari) {
    return Safari;
  }
  if (isChrome) {
    return Chrome;
  }
  if (isEdge) {
    return Edge;
  }
  if (isFirefox) {
    return Firefox;
  }
  if (isAndroid) {
    return Android;
  }
  return PlatformToString(isWeb ? Platform.Web : platform);
}
let UserDataSyncMachinesService = class extends Disposable {
  constructor(environmentService, fileService, storageService, userDataSyncStoreService, logService, productService) {
    super();
    this.storageService = storageService;
    this.userDataSyncStoreService = userDataSyncStoreService;
    this.logService = logService;
    this.productService = productService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this.userData = null;
    this.currentMachineIdPromise = getServiceMachineId(environmentService, fileService, storageService);
  }
  static {
    this.VERSION = 1;
  }
  static {
    this.RESOURCE = "machines";
  }
  async getMachines(manifest) {
    const currentMachineId = await this.currentMachineIdPromise;
    const machineData = await this.readMachinesData(manifest);
    return machineData.machines.map((machine) => ({ ...machine, ...{ isCurrent: machine.id === currentMachineId } }));
  }
  async addCurrentMachine(manifest) {
    const currentMachineId = await this.currentMachineIdPromise;
    const machineData = await this.readMachinesData(manifest);
    if (!machineData.machines.some(({ id }) => id === currentMachineId)) {
      machineData.machines.push({ id: currentMachineId, name: this.computeCurrentMachineName(machineData.machines), platform: getPlatformName() });
      await this.writeMachinesData(machineData);
    }
  }
  async removeCurrentMachine(manifest) {
    const currentMachineId = await this.currentMachineIdPromise;
    const machineData = await this.readMachinesData(manifest);
    const updatedMachines = machineData.machines.filter(({ id }) => id !== currentMachineId);
    if (updatedMachines.length !== machineData.machines.length) {
      machineData.machines = updatedMachines;
      await this.writeMachinesData(machineData);
    }
  }
  async renameMachine(machineId, name, manifest) {
    const machineData = await this.readMachinesData(manifest);
    const machine = machineData.machines.find(({ id }) => id === machineId);
    if (machine) {
      machine.name = name;
      await this.writeMachinesData(machineData);
      const currentMachineId = await this.currentMachineIdPromise;
      if (machineId === currentMachineId) {
        this.storageService.store(currentMachineNameKey, name, StorageScope.APPLICATION, StorageTarget.MACHINE);
      }
    }
  }
  async setEnablements(enablements) {
    const machineData = await this.readMachinesData();
    for (const [machineId, enabled] of enablements) {
      const machine = machineData.machines.find((machine2) => machine2.id === machineId);
      if (machine) {
        machine.disabled = enabled ? void 0 : true;
      }
    }
    await this.writeMachinesData(machineData);
  }
  computeCurrentMachineName(machines) {
    const previousName = this.storageService.get(currentMachineNameKey, StorageScope.APPLICATION);
    if (previousName) {
      if (!machines.some((machine) => machine.name === previousName)) {
        return previousName;
      }
      this.storageService.remove(currentMachineNameKey, StorageScope.APPLICATION);
    }
    const namePrefix = `${this.productService.embedderIdentifier ? `${this.productService.embedderIdentifier} - ` : ""}${getPlatformName()} (${this.productService.nameShort})`;
    const nameRegEx = new RegExp(`${escapeRegExpCharacters(namePrefix)}\\s#(\\d+)`);
    let nameIndex = 0;
    for (const machine of machines) {
      const matches = nameRegEx.exec(machine.name);
      const index = matches ? parseInt(matches[1]) : 0;
      nameIndex = index > nameIndex ? index : nameIndex;
    }
    return `${namePrefix} #${nameIndex + 1}`;
  }
  async readMachinesData(manifest) {
    this.userData = await this.readUserData(manifest);
    const machinesData = this.parse(this.userData);
    if (machinesData.version !== UserDataSyncMachinesService.VERSION) {
      throw new Error(localize("error incompatible", "Cannot read machines data as the current version is incompatible. Please update {0} and try again.", this.productService.nameLong));
    }
    return machinesData;
  }
  async writeMachinesData(machinesData) {
    const content = JSON.stringify(machinesData);
    const ref = await this.userDataSyncStoreService.writeResource(UserDataSyncMachinesService.RESOURCE, content, this.userData?.ref || null);
    this.userData = { ref, content };
    this._onDidChange.fire();
  }
  async readUserData(manifest) {
    if (this.userData) {
      const latestRef = manifest && manifest.latest ? manifest.latest[UserDataSyncMachinesService.RESOURCE] : void 0;
      if (this.userData.ref === latestRef) {
        return this.userData;
      }
      if (latestRef === void 0 && this.userData.content === null) {
        return this.userData;
      }
    }
    return this.userDataSyncStoreService.readResource(UserDataSyncMachinesService.RESOURCE, this.userData);
  }
  parse(userData) {
    if (userData.content !== null) {
      try {
        return JSON.parse(userData.content);
      } catch (e) {
        this.logService.error(e);
      }
    }
    return {
      version: UserDataSyncMachinesService.VERSION,
      machines: []
    };
  }
};
UserDataSyncMachinesService = __decorateClass([
  __decorateParam(0, IEnvironmentService),
  __decorateParam(1, IFileService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, IUserDataSyncStoreService),
  __decorateParam(4, IUserDataSyncLogService),
  __decorateParam(5, IProductService)
], UserDataSyncMachinesService);
export {
  IUserDataSyncMachinesService,
  UserDataSyncMachinesService,
  isWebPlatform
};
