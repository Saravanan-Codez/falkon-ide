import { localize } from "../../../../../../nls.js";
import { Action2, registerAction2 } from "../../../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { NotebookSetting } from "../../../common/notebookCommon.js";
var NotebookProfileType = /* @__PURE__ */ ((NotebookProfileType2) => {
  NotebookProfileType2["default"] = "default";
  NotebookProfileType2["jupyter"] = "jupyter";
  NotebookProfileType2["colab"] = "colab";
  return NotebookProfileType2;
})(NotebookProfileType || {});
const profiles = {
  ["default" /* default */]: {
    [NotebookSetting.focusIndicator]: "gutter",
    [NotebookSetting.insertToolbarLocation]: "both",
    [NotebookSetting.globalToolbar]: true,
    [NotebookSetting.cellToolbarLocation]: { default: "right" },
    [NotebookSetting.compactView]: true,
    [NotebookSetting.showCellStatusBar]: "visible",
    [NotebookSetting.consolidatedRunButton]: true,
    [NotebookSetting.undoRedoPerCell]: false
  },
  ["jupyter" /* jupyter */]: {
    [NotebookSetting.focusIndicator]: "gutter",
    [NotebookSetting.insertToolbarLocation]: "notebookToolbar",
    [NotebookSetting.globalToolbar]: true,
    [NotebookSetting.cellToolbarLocation]: { default: "left" },
    [NotebookSetting.compactView]: true,
    [NotebookSetting.showCellStatusBar]: "visible",
    [NotebookSetting.consolidatedRunButton]: false,
    [NotebookSetting.undoRedoPerCell]: true
  },
  ["colab" /* colab */]: {
    [NotebookSetting.focusIndicator]: "border",
    [NotebookSetting.insertToolbarLocation]: "betweenCells",
    [NotebookSetting.globalToolbar]: false,
    [NotebookSetting.cellToolbarLocation]: { default: "right" },
    [NotebookSetting.compactView]: false,
    [NotebookSetting.showCellStatusBar]: "hidden",
    [NotebookSetting.consolidatedRunButton]: true,
    [NotebookSetting.undoRedoPerCell]: false
  }
};
async function applyProfile(configService, profile) {
  const promises = [];
  for (const settingKey in profile) {
    promises.push(configService.updateValue(settingKey, profile[settingKey]));
  }
  await Promise.all(promises);
}
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "notebook.setProfile",
      title: localize("setProfileTitle", "Set Profile")
    });
  }
  async run(accessor, args) {
    if (!isSetProfileArgs(args)) {
      return;
    }
    const configService = accessor.get(IConfigurationService);
    return applyProfile(configService, profiles[args.profile]);
  }
});
function isSetProfileArgs(args) {
  const setProfileArgs = args;
  return setProfileArgs.profile === "colab" /* colab */ || setProfileArgs.profile === "default" /* default */ || setProfileArgs.profile === "jupyter" /* jupyter */;
}
export {
  NotebookProfileType
};
