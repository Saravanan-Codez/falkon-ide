import * as nls from "../../../nls.js";
import { OS, OperatingSystem } from "../../../base/common/platform.js";
import { ConfigurationScope, Extensions as ConfigExtensions } from "../../configuration/common/configurationRegistry.js";
import { Registry } from "../../registry/common/platform.js";
var DispatchConfig = /* @__PURE__ */ ((DispatchConfig2) => {
  DispatchConfig2[DispatchConfig2["Code"] = 0] = "Code";
  DispatchConfig2[DispatchConfig2["KeyCode"] = 1] = "KeyCode";
  return DispatchConfig2;
})(DispatchConfig || {});
function readKeyboardConfig(configurationService) {
  const keyboard = configurationService.getValue("keyboard");
  const dispatch = keyboard?.dispatch === "keyCode" ? 1 /* KeyCode */ : 0 /* Code */;
  const mapAltGrToCtrlAlt = Boolean(keyboard?.mapAltGrToCtrlAlt);
  return { dispatch, mapAltGrToCtrlAlt };
}
const configurationRegistry = Registry.as(ConfigExtensions.Configuration);
const keyboardConfiguration = {
  "id": "keyboard",
  "order": 15,
  "type": "object",
  "title": nls.localize("keyboardConfigurationTitle", "Keyboard"),
  "properties": {
    "keyboard.dispatch": {
      scope: ConfigurationScope.APPLICATION,
      type: "string",
      enum: ["code", "keyCode"],
      default: "code",
      markdownDescription: nls.localize("dispatch", "Controls the dispatching logic for key presses to use either `code` (recommended) or `keyCode`."),
      included: OS === OperatingSystem.Macintosh || OS === OperatingSystem.Linux
    },
    "keyboard.mapAltGrToCtrlAlt": {
      scope: ConfigurationScope.APPLICATION,
      type: "boolean",
      default: false,
      markdownDescription: nls.localize("mapAltGrToCtrlAlt", "Controls if the AltGraph+ modifier should be treated as Ctrl+Alt+."),
      included: OS === OperatingSystem.Windows
    }
  }
};
configurationRegistry.registerConfiguration(keyboardConfiguration);
export {
  DispatchConfig,
  readKeyboardConfig
};
