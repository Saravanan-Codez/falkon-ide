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
import { SaveReason } from "../../../common/editor.js";
import { IWorkingCopyService } from "../../../services/workingCopy/common/workingCopyService.js";
let SaveAccessibilitySignalContribution = class extends Disposable {
  constructor(_accessibilitySignalService, _workingCopyService) {
    super();
    this._accessibilitySignalService = _accessibilitySignalService;
    this._workingCopyService = _workingCopyService;
    this._register(this._workingCopyService.onDidSave((e) => this._accessibilitySignalService.playSignal(AccessibilitySignal.save, { userGesture: e.reason === SaveReason.EXPLICIT })));
  }
  static {
    this.ID = "workbench.contrib.saveAccessibilitySignal";
  }
};
SaveAccessibilitySignalContribution = __decorateClass([
  __decorateParam(0, IAccessibilitySignalService),
  __decorateParam(1, IWorkingCopyService)
], SaveAccessibilitySignalContribution);
export {
  SaveAccessibilitySignalContribution
};
