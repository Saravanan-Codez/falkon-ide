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
import { RunOnceScheduler } from "../../../base/common/async.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "./accessibilitySignalService.js";
const PROGRESS_SIGNAL_LOOP_DELAY = 5e3;
let AccessibilityProgressSignalScheduler = class extends Disposable {
  constructor(msDelayTime, msLoopTime, _accessibilitySignalService) {
    super();
    this._accessibilitySignalService = _accessibilitySignalService;
    this._scheduler = this._register(new RunOnceScheduler(() => {
      this._signalLoop = this._accessibilitySignalService.playSignalLoop(AccessibilitySignal.progress, msLoopTime ?? PROGRESS_SIGNAL_LOOP_DELAY);
    }, msDelayTime));
    this._scheduler.schedule();
  }
  dispose() {
    super.dispose();
    this._signalLoop?.dispose();
    this._scheduler.dispose();
  }
};
AccessibilityProgressSignalScheduler = __decorateClass([
  __decorateParam(2, IAccessibilitySignalService)
], AccessibilityProgressSignalScheduler);
export {
  AccessibilityProgressSignalScheduler
};
