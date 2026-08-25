import { inputPlaceholderForeground } from "../../../../../../../platform/theme/common/colorRegistry.js";
function getRangeForPlaceholder(editorRange) {
  return {
    startLineNumber: editorRange.startLineNumber,
    endLineNumber: editorRange.endLineNumber,
    startColumn: editorRange.endColumn + 1,
    endColumn: 1e3
  };
}
function getInputPlaceholderColor(themeService) {
  const theme = themeService.getColorTheme();
  const transparentForeground = theme.getColor(inputPlaceholderForeground);
  return transparentForeground?.toString();
}
export {
  getInputPlaceholderColor,
  getRangeForPlaceholder
};
