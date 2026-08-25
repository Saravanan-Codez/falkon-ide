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
import { localize, localize2 } from "../../../../nls.js";
import { IStatusbarService } from "../../../services/statusbar/browser/statusbar.js";
import { Action } from "../../../../base/common/actions.js";
import { Parts, IWorkbenchLayoutService } from "../../../services/layout/browser/layoutService.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { StatusBarFocused } from "../../../common/contextkeys.js";
import { getActiveWindow } from "../../../../base/browser/dom.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
class ToggleStatusbarEntryVisibilityAction extends Action {
  constructor(id, label, model) {
    super(id, label, void 0, true);
    this.model = model;
    this.checked = !model.isHidden(id);
  }
  async run() {
    if (this.model.isHidden(this.id)) {
      this.model.show(this.id);
    } else {
      this.model.hide(this.id);
    }
  }
}
class HideStatusbarEntryAction extends Action {
  constructor(id, name, model) {
    super(id, localize("hide", "Hide '{0}'", name), void 0, true);
    this.model = model;
  }
  async run() {
    this.model.hide(this.id);
  }
}
let ManageExtensionAction = class extends Action {
  constructor(extensionId, commandService) {
    super("statusbar.manage.extension", localize("manageExtension", "Manage Extension"));
    this.extensionId = extensionId;
    this.commandService = commandService;
  }
  run() {
    return this.commandService.executeCommand("_extensions.manage", this.extensionId);
  }
};
ManageExtensionAction = __decorateClass([
  __decorateParam(1, ICommandService)
], ManageExtensionAction);
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "workbench.statusBar.focusPrevious",
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyCode.LeftArrow,
  secondary: [KeyCode.UpArrow],
  when: StatusBarFocused,
  handler: (accessor) => {
    const statusBarService = accessor.get(IStatusbarService);
    statusBarService.focusPreviousEntry();
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "workbench.statusBar.focusNext",
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyCode.RightArrow,
  secondary: [KeyCode.DownArrow],
  when: StatusBarFocused,
  handler: (accessor) => {
    const statusBarService = accessor.get(IStatusbarService);
    statusBarService.focusNextEntry();
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "workbench.statusBar.focusFirst",
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyCode.Home,
  when: StatusBarFocused,
  handler: (accessor) => {
    const statusBarService = accessor.get(IStatusbarService);
    statusBarService.focus(false);
    statusBarService.focusNextEntry();
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "workbench.statusBar.focusLast",
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyCode.End,
  when: StatusBarFocused,
  handler: (accessor) => {
    const statusBarService = accessor.get(IStatusbarService);
    statusBarService.focus(false);
    statusBarService.focusPreviousEntry();
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "workbench.statusBar.clearFocus",
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyCode.Escape,
  when: StatusBarFocused,
  handler: (accessor) => {
    const statusBarService = accessor.get(IStatusbarService);
    const editorService = accessor.get(IEditorService);
    if (statusBarService.isEntryFocused()) {
      statusBarService.focus(false);
    } else if (editorService.activeEditorPane) {
      editorService.activeEditorPane.focus();
    }
  }
});
class FocusStatusBarAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.focusStatusBar",
      title: localize2("focusStatusBar", "Focus Status Bar"),
      category: Categories.View,
      f1: true
    });
  }
  async run(accessor) {
    const layoutService = accessor.get(IWorkbenchLayoutService);
    layoutService.focusPart(Parts.STATUSBAR_PART, getActiveWindow());
  }
}
registerAction2(FocusStatusBarAction);
export {
  HideStatusbarEntryAction,
  ManageExtensionAction,
  ToggleStatusbarEntryVisibilityAction
};
