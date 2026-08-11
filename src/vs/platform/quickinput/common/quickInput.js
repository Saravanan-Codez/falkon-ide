import { createDecorator } from "../../instantiation/common/instantiation.js";
import { Schemas } from "../../../base/common/network.js";
function isKeyModified(keyMods) {
  return keyMods.ctrlCmd || keyMods.alt || keyMods.shift;
}
const NO_KEY_MODS = { ctrlCmd: false, alt: false, shift: false };
var QuickInputHideReason = /* @__PURE__ */ ((QuickInputHideReason2) => {
  QuickInputHideReason2[QuickInputHideReason2["Blur"] = 1] = "Blur";
  QuickInputHideReason2[QuickInputHideReason2["Gesture"] = 2] = "Gesture";
  QuickInputHideReason2[QuickInputHideReason2["Other"] = 3] = "Other";
  return QuickInputHideReason2;
})(QuickInputHideReason || {});
var QuickInputType = /* @__PURE__ */ ((QuickInputType2) => {
  QuickInputType2["QuickPick"] = "quickPick";
  QuickInputType2["InputBox"] = "inputBox";
  QuickInputType2["QuickWidget"] = "quickWidget";
  QuickInputType2["QuickTree"] = "quickTree";
  return QuickInputType2;
})(QuickInputType || {});
var ItemActivation = /* @__PURE__ */ ((ItemActivation2) => {
  ItemActivation2[ItemActivation2["NONE"] = 0] = "NONE";
  ItemActivation2[ItemActivation2["FIRST"] = 1] = "FIRST";
  ItemActivation2[ItemActivation2["SECOND"] = 2] = "SECOND";
  ItemActivation2[ItemActivation2["LAST"] = 3] = "LAST";
  return ItemActivation2;
})(ItemActivation || {});
var QuickPickFocus = /* @__PURE__ */ ((QuickPickFocus2) => {
  QuickPickFocus2[QuickPickFocus2["First"] = 1] = "First";
  QuickPickFocus2[QuickPickFocus2["Second"] = 2] = "Second";
  QuickPickFocus2[QuickPickFocus2["Last"] = 3] = "Last";
  QuickPickFocus2[QuickPickFocus2["Next"] = 4] = "Next";
  QuickPickFocus2[QuickPickFocus2["Previous"] = 5] = "Previous";
  QuickPickFocus2[QuickPickFocus2["NextPage"] = 6] = "NextPage";
  QuickPickFocus2[QuickPickFocus2["PreviousPage"] = 7] = "PreviousPage";
  QuickPickFocus2[QuickPickFocus2["NextSeparator"] = 8] = "NextSeparator";
  QuickPickFocus2[QuickPickFocus2["PreviousSeparator"] = 9] = "PreviousSeparator";
  return QuickPickFocus2;
})(QuickPickFocus || {});
var QuickInputButtonLocation = /* @__PURE__ */ ((QuickInputButtonLocation2) => {
  QuickInputButtonLocation2[QuickInputButtonLocation2["Title"] = 1] = "Title";
  QuickInputButtonLocation2[QuickInputButtonLocation2["Inline"] = 2] = "Inline";
  QuickInputButtonLocation2[QuickInputButtonLocation2["Input"] = 3] = "Input";
  return QuickInputButtonLocation2;
})(QuickInputButtonLocation || {});
class QuickPickItemScorerAccessor {
  constructor(options) {
    this.options = options;
  }
  getItemLabel(entry) {
    return entry.label;
  }
  getItemDescription(entry) {
    if (this.options?.skipDescription) {
      return void 0;
    }
    return entry.description;
  }
  getItemPath(entry) {
    if (this.options?.skipPath) {
      return void 0;
    }
    if (entry.resource?.scheme === Schemas.file) {
      return entry.resource.fsPath;
    }
    return entry.resource?.path;
  }
}
const quickPickItemScorerAccessor = new QuickPickItemScorerAccessor();
const IQuickInputService = createDecorator("quickInputService");
export {
  IQuickInputService,
  ItemActivation,
  NO_KEY_MODS,
  QuickInputButtonLocation,
  QuickInputHideReason,
  QuickInputType,
  QuickPickFocus,
  QuickPickItemScorerAccessor,
  isKeyModified,
  quickPickItemScorerAccessor
};
