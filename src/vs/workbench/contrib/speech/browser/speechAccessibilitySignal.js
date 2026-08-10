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
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { ISpeechService } from "../common/speechService.js";
let SpeechAccessibilitySignalContribution = class extends Disposable {
  constructor(_accessibilitySignalService, _speechService) {
    super();
    this._accessibilitySignalService = _accessibilitySignalService;
    this._speechService = _speechService;
    this._register(this._speechService.onDidStartSpeechToTextSession(() => this._accessibilitySignalService.playSignal(AccessibilitySignal.voiceRecordingStarted)));
    this._register(this._speechService.onDidEndSpeechToTextSession(() => this._accessibilitySignalService.playSignal(AccessibilitySignal.voiceRecordingStopped)));
  }
  static {
    this.ID = "workbench.contrib.speechAccessibilitySignal";
  }
};
SpeechAccessibilitySignalContribution = __decorateClass([
  __decorateParam(0, IAccessibilitySignalService),
  __decorateParam(1, ISpeechService)
], SpeechAccessibilitySignalContribution);
export {
  SpeechAccessibilitySignalContribution
};
