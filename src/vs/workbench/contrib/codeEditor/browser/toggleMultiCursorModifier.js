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
import { isMacintosh } from "../../../../base/common/platform.js";
import { localize, localize2 } from "../../../../nls.js";
import { Action2, MenuId, MenuRegistry, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
class ToggleMultiCursorModifierAction extends Action2 {
  static {
    this.ID = "workbench.action.toggleMultiCursorModifier";
  }
  static {
    this.multiCursorModifierConfigurationKey = "editor.multiCursorModifier";
  }
  constructor() {
    super({
      id: ToggleMultiCursorModifierAction.ID,
      title: localize2("toggleLocation", "Toggle Multi-Cursor Modifier"),
      f1: true
    });
  }
  run(accessor) {
    const configurationService = accessor.get(IConfigurationService);
    const editorConf = configurationService.getValue("editor");
    const newValue = editorConf.multiCursorModifier === "ctrlCmd" ? "alt" : "ctrlCmd";
    return configurationService.updateValue(ToggleMultiCursorModifierAction.multiCursorModifierConfigurationKey, newValue);
  }
}
const multiCursorModifier = new RawContextKey("multiCursorModifier", "altKey");
let MultiCursorModifierContextKeyController = class extends Disposable {
  constructor(configurationService, contextKeyService) {
    super();
    this.configurationService = configurationService;
    this._multiCursorModifier = multiCursorModifier.bindTo(contextKeyService);
    this._update();
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("editor.multiCursorModifier")) {
        this._update();
      }
    }));
  }
  _update() {
    const editorConf = this.configurationService.getValue("editor");
    const value = editorConf.multiCursorModifier === "ctrlCmd" ? "ctrlCmd" : "altKey";
    this._multiCursorModifier.set(value);
  }
};
MultiCursorModifierContextKeyController = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IContextKeyService)
], MultiCursorModifierContextKeyController);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(MultiCursorModifierContextKeyController, LifecyclePhase.Restored);
registerAction2(ToggleMultiCursorModifierAction);
MenuRegistry.appendMenuItem(MenuId.MenubarSelectionMenu, {
  group: "4_config",
  command: {
    id: ToggleMultiCursorModifierAction.ID,
    title: localize("miMultiCursorAlt", "Switch to Alt+Click for Multi-Cursor")
  },
  when: multiCursorModifier.isEqualTo("ctrlCmd"),
  order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarSelectionMenu, {
  group: "4_config",
  command: {
    id: ToggleMultiCursorModifierAction.ID,
    title: isMacintosh ? localize("miMultiCursorCmd", "Switch to Cmd+Click for Multi-Cursor") : localize("miMultiCursorCtrl", "Switch to Ctrl+Click for Multi-Cursor")
  },
  when: multiCursorModifier.isEqualTo("altKey"),
  order: 1
});
export {
  ToggleMultiCursorModifierAction
};
