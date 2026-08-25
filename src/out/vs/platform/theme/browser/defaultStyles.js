import { keybindingLabelBackground, keybindingLabelBorder, keybindingLabelBottomBorder, keybindingLabelForeground, asCssVariable, widgetShadow, buttonForeground, buttonSeparator, buttonBackground, buttonHoverBackground, buttonSecondaryForeground, buttonSecondaryBackground, buttonSecondaryHoverBackground, buttonBorder, progressBarBackground, inputActiveOptionBorder, inputActiveOptionForeground, inputActiveOptionBackground, editorWidgetBackground, editorWidgetForeground, contrastBorder, checkboxBorder, checkboxBackground, checkboxForeground, problemsErrorIconForeground, problemsWarningIconForeground, problemsInfoIconForeground, inputBackground, inputForeground, inputBorder, textLinkForeground, inputValidationInfoBorder, inputValidationInfoBackground, inputValidationInfoForeground, inputValidationWarningBorder, inputValidationWarningBackground, inputValidationWarningForeground, inputValidationErrorBorder, inputValidationErrorBackground, inputValidationErrorForeground, listFilterWidgetBackground, listFilterWidgetNoMatchesOutline, listFilterWidgetOutline, listFilterWidgetShadow, badgeBackground, badgeForeground, breadcrumbsBackground, breadcrumbsForeground, breadcrumbsFocusForeground, breadcrumbsActiveSelectionForeground, activeContrastBorder, listActiveSelectionBackground, listActiveSelectionForeground, listActiveSelectionIconForeground, listDropOverBackground, listFocusAndSelectionOutline, listFocusBackground, listFocusForeground, listFocusOutline, listHoverBackground, listHoverForeground, listInactiveFocusBackground, listInactiveFocusOutline, listInactiveSelectionBackground, listInactiveSelectionForeground, listInactiveSelectionIconForeground, tableColumnsBorder, tableOddRowsBackgroundColor, treeIndentGuidesStroke, asCssVariableWithDefault, editorWidgetBorder, focusBorder, pickerGroupForeground, quickInputListFocusBackground, quickInputListFocusForeground, quickInputListFocusIconForeground, selectBackground, selectBorder, selectForeground, selectListBackground, treeInactiveIndentGuidesStroke, menuBorder, menuForeground, menuBackground, menuSelectionBorder, menuSeparatorBackground, scrollbarShadow, scrollbarSliderActiveBackground, scrollbarSliderBackground, scrollbarSliderHoverBackground, listDropBetweenBackground, radioActiveBackground, radioActiveForeground, radioInactiveBackground, radioInactiveForeground, radioInactiveBorder, radioInactiveHoverBackground, radioActiveBorder, checkboxDisabledBackground, checkboxDisabledForeground, widgetBorder, buttonSecondaryBorder } from "../common/colorRegistry.js";
import { Color } from "../../../base/common/color.js";
function overrideStyles(override, styles) {
  const result = { ...styles };
  for (const key in override) {
    const val = override[key];
    result[key] = val !== void 0 ? asCssVariable(val) : void 0;
  }
  return result;
}
const defaultKeybindingLabelStyles = {
  keybindingLabelBackground: asCssVariable(keybindingLabelBackground),
  keybindingLabelForeground: asCssVariable(keybindingLabelForeground),
  keybindingLabelBorder: asCssVariable(keybindingLabelBorder),
  keybindingLabelBottomBorder: asCssVariable(keybindingLabelBottomBorder),
  keybindingLabelShadow: asCssVariable(widgetShadow)
};
function getKeybindingLabelStyles(override) {
  return overrideStyles(override, defaultKeybindingLabelStyles);
}
const defaultButtonStyles = {
  buttonForeground: asCssVariable(buttonForeground),
  buttonSeparator: asCssVariable(buttonSeparator),
  buttonBackground: asCssVariable(buttonBackground),
  buttonHoverBackground: asCssVariable(buttonHoverBackground),
  buttonSecondaryForeground: asCssVariable(buttonSecondaryForeground),
  buttonSecondaryBackground: asCssVariable(buttonSecondaryBackground),
  buttonSecondaryHoverBackground: asCssVariable(buttonSecondaryHoverBackground),
  buttonSecondaryBorder: asCssVariable(buttonSecondaryBorder),
  buttonBorder: asCssVariable(buttonBorder)
};
function getButtonStyles(override) {
  return overrideStyles(override, defaultButtonStyles);
}
const defaultProgressBarStyles = {
  progressBarBackground: asCssVariable(progressBarBackground)
};
function getProgressBarStyles(override) {
  return overrideStyles(override, defaultProgressBarStyles);
}
const defaultToggleStyles = {
  inputActiveOptionBorder: asCssVariable(inputActiveOptionBorder),
  inputActiveOptionForeground: asCssVariable(inputActiveOptionForeground),
  inputActiveOptionBackground: asCssVariable(inputActiveOptionBackground)
};
const defaultRadioStyles = {
  activeForeground: asCssVariable(radioActiveForeground),
  activeBackground: asCssVariable(radioActiveBackground),
  activeBorder: asCssVariable(radioActiveBorder),
  inactiveForeground: asCssVariable(radioInactiveForeground),
  inactiveBackground: asCssVariable(radioInactiveBackground),
  inactiveBorder: asCssVariable(radioInactiveBorder),
  inactiveHoverBackground: asCssVariable(radioInactiveHoverBackground)
};
function getToggleStyles(override) {
  return overrideStyles(override, defaultToggleStyles);
}
const defaultCheckboxStyles = {
  checkboxBackground: asCssVariable(checkboxBackground),
  checkboxBorder: asCssVariable(checkboxBorder),
  checkboxForeground: asCssVariable(checkboxForeground),
  checkboxDisabledBackground: asCssVariable(checkboxDisabledBackground),
  checkboxDisabledForeground: asCssVariable(checkboxDisabledForeground)
};
const defaultDialogStyles = {
  dialogBackground: asCssVariable(editorWidgetBackground),
  dialogForeground: asCssVariable(editorWidgetForeground),
  dialogShadow: asCssVariable(widgetShadow),
  dialogBorder: asCssVariable(widgetBorder),
  errorIconForeground: asCssVariable(problemsErrorIconForeground),
  warningIconForeground: asCssVariable(problemsWarningIconForeground),
  infoIconForeground: asCssVariable(problemsInfoIconForeground),
  textLinkForeground: asCssVariable(textLinkForeground)
};
function getDialogStyle(override) {
  return overrideStyles(override, defaultDialogStyles);
}
const defaultInputBoxStyles = {
  inputBackground: asCssVariable(inputBackground),
  inputForeground: asCssVariable(inputForeground),
  inputBorder: asCssVariable(inputBorder),
  inputValidationInfoBorder: asCssVariable(inputValidationInfoBorder),
  inputValidationInfoBackground: asCssVariable(inputValidationInfoBackground),
  inputValidationInfoForeground: asCssVariable(inputValidationInfoForeground),
  inputValidationWarningBorder: asCssVariable(inputValidationWarningBorder),
  inputValidationWarningBackground: asCssVariable(inputValidationWarningBackground),
  inputValidationWarningForeground: asCssVariable(inputValidationWarningForeground),
  inputValidationErrorBorder: asCssVariable(inputValidationErrorBorder),
  inputValidationErrorBackground: asCssVariable(inputValidationErrorBackground),
  inputValidationErrorForeground: asCssVariable(inputValidationErrorForeground)
};
function getInputBoxStyle(override) {
  return overrideStyles(override, defaultInputBoxStyles);
}
const defaultFindWidgetStyles = {
  listFilterWidgetBackground: asCssVariable(listFilterWidgetBackground),
  listFilterWidgetOutline: asCssVariable(listFilterWidgetOutline),
  listFilterWidgetNoMatchesOutline: asCssVariable(listFilterWidgetNoMatchesOutline),
  listFilterWidgetShadow: asCssVariable(listFilterWidgetShadow),
  inputBoxStyles: defaultInputBoxStyles,
  toggleStyles: defaultToggleStyles
};
const defaultCountBadgeStyles = {
  badgeBackground: asCssVariable(badgeBackground),
  badgeForeground: asCssVariable(badgeForeground),
  badgeBorder: asCssVariable(contrastBorder)
};
function getCountBadgeStyle(override) {
  return overrideStyles(override, defaultCountBadgeStyles);
}
const defaultBreadcrumbsWidgetStyles = {
  breadcrumbsBackground: asCssVariable(breadcrumbsBackground),
  breadcrumbsForeground: asCssVariable(breadcrumbsForeground),
  breadcrumbsHoverForeground: asCssVariable(breadcrumbsFocusForeground),
  breadcrumbsFocusForeground: asCssVariable(breadcrumbsFocusForeground),
  breadcrumbsFocusAndSelectionForeground: asCssVariable(breadcrumbsActiveSelectionForeground)
};
function getBreadcrumbsWidgetStyles(override) {
  return overrideStyles(override, defaultBreadcrumbsWidgetStyles);
}
const defaultListStyles = {
  listBackground: void 0,
  listInactiveFocusForeground: void 0,
  listFocusBackground: asCssVariable(listFocusBackground),
  listFocusForeground: asCssVariable(listFocusForeground),
  listFocusOutline: asCssVariable(listFocusOutline),
  listActiveSelectionBackground: asCssVariable(listActiveSelectionBackground),
  listActiveSelectionForeground: asCssVariable(listActiveSelectionForeground),
  listActiveSelectionIconForeground: asCssVariable(listActiveSelectionIconForeground),
  listFocusAndSelectionOutline: asCssVariable(listFocusAndSelectionOutline),
  listFocusAndSelectionBackground: asCssVariable(listActiveSelectionBackground),
  listFocusAndSelectionForeground: asCssVariable(listActiveSelectionForeground),
  listInactiveSelectionBackground: asCssVariable(listInactiveSelectionBackground),
  listInactiveSelectionIconForeground: asCssVariable(listInactiveSelectionIconForeground),
  listInactiveSelectionForeground: asCssVariable(listInactiveSelectionForeground),
  listInactiveFocusBackground: asCssVariable(listInactiveFocusBackground),
  listInactiveFocusOutline: asCssVariable(listInactiveFocusOutline),
  listHoverBackground: asCssVariable(listHoverBackground),
  listHoverForeground: asCssVariable(listHoverForeground),
  listDropOverBackground: asCssVariable(listDropOverBackground),
  listDropBetweenBackground: asCssVariable(listDropBetweenBackground),
  listSelectionOutline: asCssVariable(activeContrastBorder),
  listHoverOutline: asCssVariable(activeContrastBorder),
  treeIndentGuidesStroke: asCssVariable(treeIndentGuidesStroke),
  treeInactiveIndentGuidesStroke: asCssVariable(treeInactiveIndentGuidesStroke),
  treeStickyScrollBackground: void 0,
  treeStickyScrollBorder: void 0,
  treeStickyScrollShadow: asCssVariable(scrollbarShadow),
  tableColumnsBorder: asCssVariable(tableColumnsBorder),
  tableOddRowsBackgroundColor: asCssVariable(tableOddRowsBackgroundColor)
};
function getListStyles(override) {
  return overrideStyles(override, defaultListStyles);
}
const defaultSelectBoxStyles = {
  selectBackground: asCssVariable(selectBackground),
  selectListBackground: asCssVariable(selectListBackground),
  selectForeground: asCssVariable(selectForeground),
  decoratorRightForeground: asCssVariable(pickerGroupForeground),
  selectBorder: asCssVariable(selectBorder),
  focusBorder: asCssVariable(focusBorder),
  listFocusBackground: asCssVariable(quickInputListFocusBackground),
  listInactiveSelectionIconForeground: asCssVariable(quickInputListFocusIconForeground),
  listFocusForeground: asCssVariable(quickInputListFocusForeground),
  listFocusOutline: asCssVariableWithDefault(activeContrastBorder, Color.transparent.toString()),
  listHoverBackground: asCssVariable(listHoverBackground),
  listHoverForeground: asCssVariable(listHoverForeground),
  listHoverOutline: asCssVariable(activeContrastBorder),
  selectListBorder: asCssVariable(editorWidgetBorder),
  listBackground: void 0,
  listActiveSelectionBackground: void 0,
  listActiveSelectionForeground: void 0,
  listActiveSelectionIconForeground: void 0,
  listFocusAndSelectionBackground: void 0,
  listDropOverBackground: void 0,
  listDropBetweenBackground: void 0,
  listInactiveSelectionBackground: void 0,
  listInactiveSelectionForeground: void 0,
  listInactiveFocusBackground: void 0,
  listInactiveFocusOutline: void 0,
  listSelectionOutline: void 0,
  listFocusAndSelectionForeground: void 0,
  listFocusAndSelectionOutline: void 0,
  listInactiveFocusForeground: void 0,
  tableColumnsBorder: void 0,
  tableOddRowsBackgroundColor: void 0,
  treeIndentGuidesStroke: void 0,
  treeInactiveIndentGuidesStroke: void 0,
  treeStickyScrollBackground: void 0,
  treeStickyScrollBorder: void 0,
  treeStickyScrollShadow: void 0
};
function getSelectBoxStyles(override) {
  return overrideStyles(override, defaultSelectBoxStyles);
}
const defaultMenuStyles = {
  shadowColor: asCssVariable(widgetShadow),
  borderColor: asCssVariableWithDefault(menuBorder, editorWidgetBorder),
  foregroundColor: asCssVariable(menuForeground),
  backgroundColor: asCssVariable(menuBackground),
  selectionForegroundColor: asCssVariable(listHoverForeground),
  selectionBackgroundColor: asCssVariable(listHoverBackground),
  selectionBorderColor: asCssVariable(menuSelectionBorder),
  separatorColor: asCssVariable(menuSeparatorBackground),
  scrollbarShadow: asCssVariable(scrollbarShadow),
  scrollbarSliderBackground: asCssVariable(scrollbarSliderBackground),
  scrollbarSliderHoverBackground: asCssVariable(scrollbarSliderHoverBackground),
  scrollbarSliderActiveBackground: asCssVariable(scrollbarSliderActiveBackground)
};
function getMenuStyles(override) {
  return overrideStyles(override, defaultMenuStyles);
}
export {
  defaultBreadcrumbsWidgetStyles,
  defaultButtonStyles,
  defaultCheckboxStyles,
  defaultCountBadgeStyles,
  defaultDialogStyles,
  defaultFindWidgetStyles,
  defaultInputBoxStyles,
  defaultKeybindingLabelStyles,
  defaultListStyles,
  defaultMenuStyles,
  defaultProgressBarStyles,
  defaultRadioStyles,
  defaultSelectBoxStyles,
  defaultToggleStyles,
  getBreadcrumbsWidgetStyles,
  getButtonStyles,
  getCountBadgeStyle,
  getDialogStyle,
  getInputBoxStyle,
  getKeybindingLabelStyles,
  getListStyles,
  getMenuStyles,
  getProgressBarStyles,
  getSelectBoxStyles,
  getToggleStyles
};
