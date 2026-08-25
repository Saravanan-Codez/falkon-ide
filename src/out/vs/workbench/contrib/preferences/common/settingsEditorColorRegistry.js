import { Color, RGBA } from "../../../../base/common/color.js";
import { localize } from "../../../../nls.js";
import { editorWidgetBorder, focusBorder, inputBackground, inputBorder, inputForeground, listHoverBackground, registerColor, selectBackground, selectBorder, selectForeground, checkboxBackground, checkboxBorder, checkboxForeground, transparent } from "../../../../platform/theme/common/colorRegistry.js";
import { PANEL_BORDER } from "../../../common/theme.js";
const settingsHeaderForeground = registerColor("settings.headerForeground", { light: "#444444", dark: "#e7e7e7", hcDark: "#ffffff", hcLight: "#292929" }, localize("headerForeground", "The foreground color for a section header or active title."));
const settingsHeaderHoverForeground = registerColor("settings.settingsHeaderHoverForeground", transparent(settingsHeaderForeground, 0.7), localize("settingsHeaderHoverForeground", "The foreground color for a section header or hovered title."));
const modifiedItemIndicator = registerColor("settings.modifiedItemIndicator", {
  light: new Color(new RGBA(102, 175, 224)),
  dark: new Color(new RGBA(12, 125, 157)),
  hcDark: new Color(new RGBA(0, 73, 122)),
  hcLight: new Color(new RGBA(102, 175, 224))
}, localize("modifiedItemForeground", "The color of the modified setting indicator."));
const settingsHeaderBorder = registerColor("settings.headerBorder", PANEL_BORDER, localize("settingsHeaderBorder", "The color of the header container border."));
const settingsSashBorder = registerColor("settings.sashBorder", PANEL_BORDER, localize("settingsSashBorder", "The color of the Settings editor splitview sash border."));
const settingsSelectBackground = registerColor(`settings.dropdownBackground`, selectBackground, localize("settingsDropdownBackground", "Settings editor dropdown background."));
const settingsSelectForeground = registerColor("settings.dropdownForeground", selectForeground, localize("settingsDropdownForeground", "Settings editor dropdown foreground."));
const settingsSelectBorder = registerColor("settings.dropdownBorder", selectBorder, localize("settingsDropdownBorder", "Settings editor dropdown border."));
const settingsSelectListBorder = registerColor("settings.dropdownListBorder", editorWidgetBorder, localize("settingsDropdownListBorder", "Settings editor dropdown list border. This surrounds the options and separates the options from the description."));
const settingsCheckboxBackground = registerColor("settings.checkboxBackground", checkboxBackground, localize("settingsCheckboxBackground", "Settings editor checkbox background."));
const settingsCheckboxForeground = registerColor("settings.checkboxForeground", checkboxForeground, localize("settingsCheckboxForeground", "Settings editor checkbox foreground."));
const settingsCheckboxBorder = registerColor("settings.checkboxBorder", checkboxBorder, localize("settingsCheckboxBorder", "Settings editor checkbox border."));
const settingsTextInputBackground = registerColor("settings.textInputBackground", inputBackground, localize("textInputBoxBackground", "Settings editor text input box background."));
const settingsTextInputForeground = registerColor("settings.textInputForeground", inputForeground, localize("textInputBoxForeground", "Settings editor text input box foreground."));
const settingsTextInputBorder = registerColor("settings.textInputBorder", inputBorder, localize("textInputBoxBorder", "Settings editor text input box border."));
const settingsNumberInputBackground = registerColor("settings.numberInputBackground", inputBackground, localize("numberInputBoxBackground", "Settings editor number input box background."));
const settingsNumberInputForeground = registerColor("settings.numberInputForeground", inputForeground, localize("numberInputBoxForeground", "Settings editor number input box foreground."));
const settingsNumberInputBorder = registerColor("settings.numberInputBorder", inputBorder, localize("numberInputBoxBorder", "Settings editor number input box border."));
const focusedRowBackground = registerColor("settings.focusedRowBackground", {
  dark: transparent(listHoverBackground, 0.6),
  light: transparent(listHoverBackground, 0.6),
  hcDark: null,
  hcLight: null
}, localize("focusedRowBackground", "The background color of a settings row when focused."));
const rowHoverBackground = registerColor("settings.rowHoverBackground", {
  dark: transparent(listHoverBackground, 0.3),
  light: transparent(listHoverBackground, 0.3),
  hcDark: null,
  hcLight: null
}, localize("settings.rowHoverBackground", "The background color of a settings row when hovered."));
const focusedRowBorder = registerColor("settings.focusedRowBorder", focusBorder, localize("settings.focusedRowBorder", "The color of the row's top and bottom border when the row is focused."));
export {
  focusedRowBackground,
  focusedRowBorder,
  modifiedItemIndicator,
  rowHoverBackground,
  settingsCheckboxBackground,
  settingsCheckboxBorder,
  settingsCheckboxForeground,
  settingsHeaderBorder,
  settingsHeaderForeground,
  settingsHeaderHoverForeground,
  settingsNumberInputBackground,
  settingsNumberInputBorder,
  settingsNumberInputForeground,
  settingsSashBorder,
  settingsSelectBackground,
  settingsSelectBorder,
  settingsSelectForeground,
  settingsSelectListBorder,
  settingsTextInputBackground,
  settingsTextInputBorder,
  settingsTextInputForeground
};
