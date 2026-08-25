import { KeybindingsRegistry } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import * as platform from "../../../../base/common/platform.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { getActiveWindow } from "../../../../base/browser/dom.js";
if (platform.isMacintosh) {
  let bindExecuteCommand = function(command) {
    return () => {
      getActiveWindow().document.execCommand(command);
    };
  };
  KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: "execCut",
    primary: KeyMod.CtrlCmd | KeyCode.KeyX,
    handler: bindExecuteCommand("cut"),
    weight: 0,
    when: void 0
  });
  KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: "execCopy",
    primary: KeyMod.CtrlCmd | KeyCode.KeyC,
    handler: bindExecuteCommand("copy"),
    weight: 0,
    when: void 0
  });
  KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: "execPaste",
    primary: KeyMod.CtrlCmd | KeyCode.KeyV,
    handler: bindExecuteCommand("paste"),
    weight: 0,
    when: void 0
  });
}
