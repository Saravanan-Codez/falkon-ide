import { localize } from "../../../../../nls.js";
var TerminalOscNotificationsSettingId = /* @__PURE__ */ ((TerminalOscNotificationsSettingId2) => {
  TerminalOscNotificationsSettingId2["EnableNotifications"] = "terminal.integrated.enableNotifications";
  return TerminalOscNotificationsSettingId2;
})(TerminalOscNotificationsSettingId || {});
const terminalOscNotificationsConfiguration = {
  ["terminal.integrated.enableNotifications" /* EnableNotifications */]: {
    description: localize("terminal.integrated.enableNotifications", "Controls whether notifications sent from the terminal via OSC 99 are shown. This uses notifications inside the product instead of desktop notifications. Sounds, icons and filtering are not supported."),
    type: "boolean",
    default: true
  }
};
export {
  TerminalOscNotificationsSettingId,
  terminalOscNotificationsConfiguration
};
