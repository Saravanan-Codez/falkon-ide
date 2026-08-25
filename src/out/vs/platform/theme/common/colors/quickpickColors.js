import * as nls from "../../../../nls.js";
import { Color, RGBA } from "../../../../base/common/color.js";
import { registerColor, oneOf } from "../colorUtils.js";
import { editorWidgetBackground, editorWidgetForeground } from "./editorColors.js";
import { listActiveSelectionBackground, listActiveSelectionForeground, listActiveSelectionIconForeground, listFocusHighlightForeground } from "./listColors.js";
const quickInputBackground = registerColor(
  "quickInput.background",
  editorWidgetBackground,
  nls.localize("pickerBackground", "Quick picker background color. The quick picker widget is the container for pickers like the command palette.")
);
const quickInputForeground = registerColor(
  "quickInput.foreground",
  editorWidgetForeground,
  nls.localize("pickerForeground", "Quick picker foreground color. The quick picker widget is the container for pickers like the command palette.")
);
const quickInputTitleBackground = registerColor(
  "quickInputTitle.background",
  { dark: new Color(new RGBA(255, 255, 255, 0.105)), light: new Color(new RGBA(0, 0, 0, 0.06)), hcDark: "#000000", hcLight: Color.white },
  nls.localize("pickerTitleBackground", "Quick picker title background color. The quick picker widget is the container for pickers like the command palette.")
);
const pickerGroupForeground = registerColor(
  "pickerGroup.foreground",
  { dark: "#3794FF", light: "#0066BF", hcDark: Color.white, hcLight: "#0F4A85" },
  nls.localize("pickerGroupForeground", "Quick picker color for grouping labels.")
);
const pickerGroupBorder = registerColor(
  "pickerGroup.border",
  { dark: "#3F3F46", light: "#CCCEDB", hcDark: Color.white, hcLight: "#0F4A85" },
  nls.localize("pickerGroupBorder", "Quick picker color for grouping borders.")
);
const _deprecatedQuickInputListFocusBackground = registerColor(
  "quickInput.list.focusBackground",
  null,
  "",
  void 0,
  nls.localize("quickInput.list.focusBackground deprecation", "Please use quickInputList.focusBackground instead")
);
const quickInputListFocusForeground = registerColor(
  "quickInputList.focusForeground",
  listActiveSelectionForeground,
  nls.localize("quickInput.listFocusForeground", "Quick picker foreground color for the focused item.")
);
const quickInputListFocusIconForeground = registerColor(
  "quickInputList.focusIconForeground",
  listActiveSelectionIconForeground,
  nls.localize("quickInput.listFocusIconForeground", "Quick picker icon foreground color for the focused item.")
);
const quickInputListFocusBackground = registerColor(
  "quickInputList.focusBackground",
  { dark: oneOf(_deprecatedQuickInputListFocusBackground, listActiveSelectionBackground), light: oneOf(_deprecatedQuickInputListFocusBackground, listActiveSelectionBackground), hcDark: null, hcLight: null },
  nls.localize("quickInput.listFocusBackground", "Quick picker background color for the focused item.")
);
const quickInputListFocusHighlightForeground = registerColor(
  "quickInputList.focusHighlightForeground",
  listFocusHighlightForeground,
  nls.localize("quickInput.listFocusHighlightForeground", "Quick picker foreground color of the match highlights on the focused item.")
);
export {
  _deprecatedQuickInputListFocusBackground,
  pickerGroupBorder,
  pickerGroupForeground,
  quickInputBackground,
  quickInputForeground,
  quickInputListFocusBackground,
  quickInputListFocusForeground,
  quickInputListFocusHighlightForeground,
  quickInputListFocusIconForeground,
  quickInputTitleBackground
};
