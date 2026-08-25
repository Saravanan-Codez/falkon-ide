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
import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { IExtHostRpcService } from "./extHostRpcService.js";
import { MainContext } from "./extHost.protocol.js";
let ExtHostPower = class extends Disposable {
  constructor(extHostRpc) {
    super();
    // Events
    this._onDidSuspend = this._register(new Emitter());
    this.onDidSuspend = this._onDidSuspend.event;
    this._onDidResume = this._register(new Emitter());
    this.onDidResume = this._onDidResume.event;
    this._onDidChangeOnBatteryPower = this._register(new Emitter());
    this.onDidChangeOnBatteryPower = this._onDidChangeOnBatteryPower.event;
    this._onDidChangeThermalState = this._register(new Emitter());
    this.onDidChangeThermalState = this._onDidChangeThermalState.event;
    this._onDidChangeSpeedLimit = this._register(new Emitter());
    this.onDidChangeSpeedLimit = this._onDidChangeSpeedLimit.event;
    this._onWillShutdown = this._register(new Emitter());
    this.onWillShutdown = this._onWillShutdown.event;
    this._onDidLockScreen = this._register(new Emitter());
    this.onDidLockScreen = this._onDidLockScreen.event;
    this._onDidUnlockScreen = this._register(new Emitter());
    this.onDidUnlockScreen = this._onDidUnlockScreen.event;
    this._proxy = extHostRpc.getProxy(MainContext.MainThreadPower);
  }
  // === Proxy callbacks (called by MainThread) ===
  $onDidSuspend() {
    this._onDidSuspend.fire();
  }
  $onDidResume() {
    this._onDidResume.fire();
  }
  $onDidChangeOnBatteryPower(isOnBattery) {
    this._onDidChangeOnBatteryPower.fire(isOnBattery);
  }
  $onDidChangeThermalState(state) {
    this._onDidChangeThermalState.fire(state);
  }
  $onDidChangeSpeedLimit(limit) {
    this._onDidChangeSpeedLimit.fire(limit);
  }
  $onWillShutdown() {
    this._onWillShutdown.fire();
  }
  $onDidLockScreen() {
    this._onDidLockScreen.fire();
  }
  $onDidUnlockScreen() {
    this._onDidUnlockScreen.fire();
  }
  // === API for extensions ===
  getSystemIdleState(idleThresholdSeconds) {
    return this._proxy.$getSystemIdleState(idleThresholdSeconds);
  }
  getSystemIdleTime() {
    return this._proxy.$getSystemIdleTime();
  }
  getCurrentThermalState() {
    return this._proxy.$getCurrentThermalState();
  }
  isOnBatteryPower() {
    return this._proxy.$isOnBatteryPower();
  }
  async startPowerSaveBlocker(type) {
    const id = await this._proxy.$startPowerSaveBlocker(type);
    const proxy = this._proxy;
    const isSupported = id >= 0;
    let disposed = false;
    return {
      id,
      get isStarted() {
        return isSupported && !disposed;
      },
      dispose: () => {
        if (isSupported && !disposed) {
          disposed = true;
          proxy.$stopPowerSaveBlocker(id);
        }
      }
    };
  }
};
ExtHostPower = __decorateClass([
  __decorateParam(0, IExtHostRpcService)
], ExtHostPower);
const IExtHostPower = createDecorator("IExtHostPower");
export {
  ExtHostPower,
  IExtHostPower
};
