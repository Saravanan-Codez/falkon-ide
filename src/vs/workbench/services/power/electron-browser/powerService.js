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
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { IPowerService } from "../common/powerService.js";
import { Event } from "../../../../base/common/event.js";
let NativePowerService = class extends Disposable {
  constructor(nativeHostService) {
    super();
    this.nativeHostService = nativeHostService;
    this.onDidSuspend = nativeHostService.onDidSuspendOS;
    this.onDidResume = Event.map(nativeHostService.onDidResumeOS, () => void 0);
    this.onDidChangeOnBatteryPower = nativeHostService.onDidChangeOnBatteryPower;
    this.onDidChangeThermalState = nativeHostService.onDidChangeThermalState;
    this.onDidChangeSpeedLimit = nativeHostService.onDidChangeSpeedLimit;
    this.onWillShutdown = nativeHostService.onWillShutdownOS;
    this.onDidLockScreen = nativeHostService.onDidLockScreen;
    this.onDidUnlockScreen = nativeHostService.onDidUnlockScreen;
  }
  async getSystemIdleState(idleThreshold) {
    return this.nativeHostService.getSystemIdleState(idleThreshold);
  }
  async getSystemIdleTime() {
    return this.nativeHostService.getSystemIdleTime();
  }
  async getCurrentThermalState() {
    return this.nativeHostService.getCurrentThermalState();
  }
  async isOnBatteryPower() {
    return this.nativeHostService.isOnBatteryPower();
  }
  async startPowerSaveBlocker(type) {
    return this.nativeHostService.startPowerSaveBlocker(type);
  }
  async stopPowerSaveBlocker(id) {
    return this.nativeHostService.stopPowerSaveBlocker(id);
  }
  async isPowerSaveBlockerStarted(id) {
    return this.nativeHostService.isPowerSaveBlockerStarted(id);
  }
};
NativePowerService = __decorateClass([
  __decorateParam(0, INativeHostService)
], NativePowerService);
registerSingleton(IPowerService, NativePowerService, InstantiationType.Delayed);
export {
  NativePowerService
};
