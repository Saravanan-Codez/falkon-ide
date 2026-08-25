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
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IMainProcessService } from "../../../../platform/ipc/common/mainProcessService.js";
import { AUTOMATION_STORAGE_KEY, IAutomationStorageService } from "../common/automationStorageService.js";
const baseRequest = {
  profile: void 0,
  workspace: void 0
};
let NativeAutomationStorageService = class {
  constructor(mainProcessService) {
    this.channel = mainProcessService.getChannel("storage");
  }
  read() {
    const request = {
      ...baseRequest,
      key: AUTOMATION_STORAGE_KEY
    };
    return this.channel.call("getValue", request);
  }
  compareAndSwap(expectedValue, newValue) {
    const request = {
      ...baseRequest,
      key: AUTOMATION_STORAGE_KEY,
      expectedValue,
      newValue
    };
    return this.channel.call("compareAndSwap", request);
  }
};
NativeAutomationStorageService = __decorateClass([
  __decorateParam(0, IMainProcessService)
], NativeAutomationStorageService);
registerSingleton(IAutomationStorageService, NativeAutomationStorageService, InstantiationType.Delayed);
