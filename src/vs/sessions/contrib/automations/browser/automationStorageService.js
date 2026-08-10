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
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { BrowserStorageService } from "../../../../workbench/services/storage/browser/storageService.js";
import { AUTOMATION_STORAGE_KEY } from "../common/automationStorageService.js";
let BrowserAutomationStorageService = class {
  constructor(storageService) {
    if (!(storageService instanceof BrowserStorageService)) {
      throw new Error("Browser automation storage requires BrowserStorageService.");
    }
    this.storageService = storageService;
  }
  async read() {
    return this.storageService.getApplicationStorageValue(AUTOMATION_STORAGE_KEY);
  }
  async compareAndSwap(expectedValue, newValue) {
    return this.storageService.compareAndSwapApplicationStorage(AUTOMATION_STORAGE_KEY, expectedValue, newValue);
  }
};
BrowserAutomationStorageService = __decorateClass([
  __decorateParam(0, IStorageService)
], BrowserAutomationStorageService);
export {
  BrowserAutomationStorageService
};
