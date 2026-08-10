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
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { IActionViewItemService } from "../../../../../platform/actions/browser/actionViewItemService.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../../workbench/common/contributions.js";
import { Menus } from "../../../../browser/menus.js";
import { ISessionContext } from "../../../../services/sessions/browser/sessionContext.js";
import { PickerActionViewItem } from "./copilotChatSessionsActions.js";
import { MobilePermissionPicker } from "./mobilePermissionPicker.js";
import { CopilotPermissionPickerDelegate } from "./permissionPicker.js";
let CopilotPermissionPickerWebContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.copilotPermissionPickerWeb";
  }
  constructor(actionViewItemService) {
    super();
    this._register(actionViewItemService.register(
      Menus.NewSessionControl,
      "sessions.defaultCopilot.permissionPicker",
      (_action, _options, scopedInstantiationService) => {
        const { session } = scopedInstantiationService.invokeFunction((accessor) => accessor.get(ISessionContext));
        const delegate = scopedInstantiationService.createInstance(CopilotPermissionPickerDelegate, session);
        const picker = scopedInstantiationService.createInstance(MobilePermissionPicker, delegate);
        return new PickerActionViewItem(picker, delegate);
      }
    ));
  }
};
CopilotPermissionPickerWebContribution = __decorateClass([
  __decorateParam(0, IActionViewItemService)
], CopilotPermissionPickerWebContribution);
registerWorkbenchContribution2(CopilotPermissionPickerWebContribution.ID, CopilotPermissionPickerWebContribution, WorkbenchPhase.AfterRestored);
