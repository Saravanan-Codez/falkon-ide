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
import { Disposable } from "../../../base/common/lifecycle.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { IPowerService } from "../../services/power/common/powerService.js";
let MainThreadPower = class extends Disposable {
  constructor(extHostContext, powerService) {
    super();
    this.powerService = powerService;
    this.proxy = extHostContext.getProxy(ExtHostContext.ExtHostPower);
    this._register(this.powerService.onDidSuspend(this.proxy.$onDidSuspend, this.proxy));
    this._register(this.powerService.onDidResume(this.proxy.$onDidResume, this.proxy));
    this._register(this.powerService.onDidChangeOnBatteryPower(this.proxy.$onDidChangeOnBatteryPower, this.proxy));
    this._register(this.powerService.onDidChangeThermalState((state) => this.proxy.$onDidChangeThermalState(state), this));
    this._register(this.powerService.onDidChangeSpeedLimit(this.proxy.$onDidChangeSpeedLimit, this.proxy));
    this._register(this.powerService.onWillShutdown(this.proxy.$onWillShutdown, this.proxy));
    this._register(this.powerService.onDidLockScreen(this.proxy.$onDidLockScreen, this.proxy));
    this._register(this.powerService.onDidUnlockScreen(this.proxy.$onDidUnlockScreen, this.proxy));
  }
  async $getSystemIdleState(idleThreshold) {
    return this.powerService.getSystemIdleState(idleThreshold);
  }
  async $getSystemIdleTime() {
    return this.powerService.getSystemIdleTime();
  }
  async $getCurrentThermalState() {
    return this.powerService.getCurrentThermalState();
  }
  async $isOnBatteryPower() {
    return this.powerService.isOnBatteryPower();
  }
  async $startPowerSaveBlocker(type) {
    return this.powerService.startPowerSaveBlocker(type);
  }
  async $stopPowerSaveBlocker(id) {
    return this.powerService.stopPowerSaveBlocker(id);
  }
  async $isPowerSaveBlockerStarted(id) {
    return this.powerService.isPowerSaveBlockerStarted(id);
  }
};
MainThreadPower = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadPower),
  __decorateParam(1, IPowerService)
], MainThreadPower);
export {
  MainThreadPower
};
