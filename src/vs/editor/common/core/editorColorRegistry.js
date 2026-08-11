import * as nls from "../../../nls.js";
import { Color, RGBA } from "../../../base/common/color.js";
import { activeContrastBorder, editorBackground, registerColor, editorWarningForeground, editorInfoForeground, editorWarningBorder, editorInfoBorder, contrastBorder, editorFindMatchHighlight, editorWarningBackground } from "../../../platform/theme/common/colorRegistry.js";
import { registerThemingParticipant } from "../../../platform/theme/common/themeService.js";
const editorLineHighlight = registerColor("editor.lineHighlightBackground", null, nls.localize("lineHighlight", "Background color for the highlight of line at the cursor position."));
const editorInactiveLineHighlight = registerColor("editor.inactiveLineHighlightBackground", editorLineHighlight, nls.localize("inactiveLineHighlight", "Background color for the highlight of line at the cursor position when the editor is not focused."));
const editorLineHighlightBorder = registerColor("editor.lineHighlightBorder", { dark: "#282828", light: "#eeeeee", hcDark: "#f38518", hcLight: contrastBorder }, nls.localize("lineHighlightBorderBox", "Background color for the border around the line at the cursor position."));
const editorRangeHighlight = registerColor("editor.rangeHighlightBackground", { dark: "#ffffff0b", light: "#fdff0033", hcDark: null, hcLight: null }, nls.localize("rangeHighlight", "Background color of highlighted ranges, like by quick open and find features. The color must not be opaque so as not to hide underlying decorations."), true);
const editorRangeHighlightBorder = registerColor("editor.rangeHighlightBorder", { dark: null, light: null, hcDark: activeContrastBorder, hcLight: activeContrastBorder }, nls.localize("rangeHighlightBorder", "Background color of the border around highlighted ranges."));
const editorSymbolHighlight = registerColor("editor.symbolHighlightBackground", { dark: editorFindMatchHighlight, light: editorFindMatchHighlight, hcDark: null, hcLight: null }, nls.localize("symbolHighlight", "Background color of highlighted symbol, like for go to definition or go next/previous symbol. The color must not be opaque so as not to hide underlying decorations."), true);
const editorSymbolHighlightBorder = registerColor("editor.symbolHighlightBorder", { dark: null, light: null, hcDark: activeContrastBorder, hcLight: activeContrastBorder }, nls.localize("symbolHighlightBorder", "Background color of the border around highlighted symbols."));
const editorCursorForeground = registerColor("editorCursor.foreground", { dark: "#AEAFAD", light: Color.black, hcDark: Color.white, hcLight: "#0F4A85" }, nls.localize("caret", "Color of the editor cursor."));
const editorCursorBackground = registerColor("editorCursor.background", null, nls.localize("editorCursorBackground", "The background color of the editor cursor. Allows customizing the color of a character overlapped by a block cursor."));
const editorMultiCursorPrimaryForeground = registerColor("editorMultiCursor.primary.foreground", editorCursorForeground, nls.localize("editorMultiCursorPrimaryForeground", "Color of the primary editor cursor when multiple cursors are present."));
const editorMultiCursorPrimaryBackground = registerColor("editorMultiCursor.primary.background", editorCursorBackground, nls.localize("editorMultiCursorPrimaryBackground", "The background color of the primary editor cursor when multiple cursors are present. Allows customizing the color of a character overlapped by a block cursor."));
const editorMultiCursorSecondaryForeground = registerColor("editorMultiCursor.secondary.foreground", editorCursorForeground, nls.localize("editorMultiCursorSecondaryForeground", "Color of secondary editor cursors when multiple cursors are present."));
const editorMultiCursorSecondaryBackground = registerColor("editorMultiCursor.secondary.background", editorCursorBackground, nls.localize("editorMultiCursorSecondaryBackground", "The background color of secondary editor cursors when multiple cursors are present. Allows customizing the color of a character overlapped by a block cursor."));
const editorWhitespaces = registerColor("editorWhitespace.foreground", { dark: "#e3e4e229", light: "#33333333", hcDark: "#e3e4e229", hcLight: "#CCCCCC" }, nls.localize("editorWhitespaces", "Color of whitespace characters in the editor."));
const editorLineNumbers = registerColor("editorLineNumber.foreground", { dark: "#858585", light: "#237893", hcDark: Color.white, hcLight: "#292929" }, nls.localize("editorLineNumbers", "Color of editor line numbers."));
const deprecatedEditorIndentGuides = registerColor("editorIndentGuide.background", editorWhitespaces, nls.localize("editorIndentGuides", "Color of the editor indentation guides."), false, nls.localize("deprecatedEditorIndentGuides", "'editorIndentGuide.background' is deprecated. Use 'editorIndentGuide.background1' instead."));
const deprecatedEditorActiveIndentGuides = registerColor("editorIndentGuide.activeBackground", editorWhitespaces, nls.localize("editorActiveIndentGuide", "Color of the active editor indentation guides."), false, nls.localize("deprecatedEditorActiveIndentGuide", "'editorIndentGuide.activeBackground' is deprecated. Use 'editorIndentGuide.activeBackground1' instead."));
const editorIndentGuide1 = registerColor("editorIndentGuide.background1", deprecatedEditorIndentGuides, nls.localize("editorIndentGuides1", "Color of the editor indentation guides (1)."));
const editorIndentGuide2 = registerColor("editorIndentGuide.background2", "#00000000", nls.localize("editorIndentGuides2", "Color of the editor indentation guides (2)."));
const editorIndentGuide3 = registerColor("editorIndentGuide.background3", "#00000000", nls.localize("editorIndentGuides3", "Color of the editor indentation guides (3)."));
const editorIndentGuide4 = registerColor("editorIndentGuide.background4", "#00000000", nls.localize("editorIndentGuides4", "Color of the editor indentation guides (4)."));
const editorIndentGuide5 = registerColor("editorIndentGuide.background5", "#00000000", nls.localize("editorIndentGuides5", "Color of the editor indentation guides (5)."));
const editorIndentGuide6 = registerColor("editorIndentGuide.background6", "#00000000", nls.localize("editorIndentGuides6", "Color of the editor indentation guides (6)."));
const editorActiveIndentGuide1 = registerColor("editorIndentGuide.activeBackground1", deprecatedEditorActiveIndentGuides, nls.localize("editorActiveIndentGuide1", "Color of the active editor indentation guides (1)."));
const editorActiveIndentGuide2 = registerColor("editorIndentGuide.activeBackground2", "#00000000", nls.localize("editorActiveIndentGuide2", "Color of the active editor indentation guides (2)."));
const editorActiveIndentGuide3 = registerColor("editorIndentGuide.activeBackground3", "#00000000", nls.localize("editorActiveIndentGuide3", "Color of the active editor indentation guides (3)."));
const editorActiveIndentGuide4 = registerColor("editorIndentGuide.activeBackground4", "#00000000", nls.localize("editorActiveIndentGuide4", "Color of the active editor indentation guides (4)."));
const editorActiveIndentGuide5 = registerColor("editorIndentGuide.activeBackground5", "#00000000", nls.localize("editorActiveIndentGuide5", "Color of the active editor indentation guides (5)."));
const editorActiveIndentGuide6 = registerColor("editorIndentGuide.activeBackground6", "#00000000", nls.localize("editorActiveIndentGuide6", "Color of the active editor indentation guides (6)."));
const deprecatedEditorActiveLineNumber = registerColor("editorActiveLineNumber.foreground", { dark: "#c6c6c6", light: "#0B216F", hcDark: activeContrastBorder, hcLight: activeContrastBorder }, nls.localize("editorActiveLineNumber", "Color of editor active line number"), false, nls.localize("deprecatedEditorActiveLineNumber", "Id is deprecated. Use 'editorLineNumber.activeForeground' instead."));
const editorActiveLineNumber = registerColor("editorLineNumber.activeForeground", deprecatedEditorActiveLineNumber, nls.localize("editorActiveLineNumber", "Color of editor active line number"));
const editorDimmedLineNumber = registerColor("editorLineNumber.dimmedForeground", null, nls.localize("editorDimmedLineNumber", "Color of the final editor line when editor.renderFinalNewline is set to dimmed."));
const editorRuler = registerColor("editorRuler.foreground", { dark: "#5A5A5A", light: Color.lightgrey, hcDark: Color.white, hcLight: "#292929" }, nls.localize("editorRuler", "Color of the editor rulers."));
const editorCodeLensForeground = registerColor("editorCodeLens.foreground", { dark: "#999999", light: "#919191", hcDark: "#999999", hcLight: "#292929" }, nls.localize("editorCodeLensForeground", "Foreground color of editor CodeLens"));
const editorBracketMatchBackground = registerColor("editorBracketMatch.background", { dark: "#0064001a", light: "#0064001a", hcDark: "#0064001a", hcLight: "#0000" }, nls.localize("editorBracketMatchBackground", "Background color behind matching brackets"));
const editorBracketMatchBorder = registerColor("editorBracketMatch.border", { dark: "#888", light: "#B9B9B9", hcDark: contrastBorder, hcLight: contrastBorder }, nls.localize("editorBracketMatchBorder", "Color for matching brackets boxes"));
const editorBracketMatchForeground = registerColor("editorBracketMatch.foreground", null, nls.localize("editorBracketMatchForeground", "Foreground color for matching brackets"));
const editorOverviewRulerBorder = registerColor("editorOverviewRuler.border", { dark: "#7f7f7f4d", light: "#7f7f7f4d", hcDark: "#7f7f7f4d", hcLight: "#666666" }, nls.localize("editorOverviewRulerBorder", "Color of the overview ruler border."));
const editorOverviewRulerBackground = registerColor("editorOverviewRuler.background", null, nls.localize("editorOverviewRulerBackground", "Background color of the editor overview ruler."));
const editorGutter = registerColor("editorGutter.background", editorBackground, nls.localize("editorGutter", "Background color of the editor gutter. The gutter contains the glyph margins and the line numbers."));
const editorUnnecessaryCodeBorder = registerColor("editorUnnecessaryCode.border", { dark: null, light: null, hcDark: Color.fromHex("#fff").transparent(0.8), hcLight: contrastBorder }, nls.localize("unnecessaryCodeBorder", "Border color of unnecessary (unused) source code in the editor."));
const editorUnnecessaryCodeOpacity = registerColor("editorUnnecessaryCode.opacity", { dark: Color.fromHex("#000a"), light: Color.fromHex("#0007"), hcDark: null, hcLight: null }, nls.localize("unnecessaryCodeOpacity", `Opacity of unnecessary (unused) source code in the editor. For example, "#000000c0" will render the code with 75% opacity. For high contrast themes, use the  'editorUnnecessaryCode.border' theme color to underline unnecessary code instead of fading it out.`));
const ghostTextBorder = registerColor("editorGhostText.border", { dark: null, light: null, hcDark: Color.fromHex("#fff").transparent(0.8), hcLight: Color.fromHex("#292929").transparent(0.8) }, nls.localize("editorGhostTextBorder", "Border color of ghost text in the editor."));
const ghostTextForeground = registerColor("editorGhostText.foreground", { dark: Color.fromHex("#ffffff56"), light: Color.fromHex("#0007"), hcDark: null, hcLight: null }, nls.localize("editorGhostTextForeground", "Foreground color of the ghost text in the editor."));
const ghostTextBackground = registerColor("editorGhostText.background", null, nls.localize("editorGhostTextBackground", "Background color of the ghost text in the editor."));
const rulerRangeDefault = new Color(new RGBA(0, 122, 204, 0.6));
const overviewRulerRangeHighlight = registerColor("editorOverviewRuler.rangeHighlightForeground", rulerRangeDefault, nls.localize("overviewRulerRangeHighlight", "Overview ruler marker color for range highlights. The color must not be opaque so as not to hide underlying decorations."), true);
const overviewRulerError = registerColor("editorOverviewRuler.errorForeground", { dark: new Color(new RGBA(255, 18, 18, 0.7)), light: new Color(new RGBA(255, 18, 18, 0.7)), hcDark: new Color(new RGBA(255, 50, 50, 1)), hcLight: "#B5200D" }, nls.localize("overviewRuleError", "Overview ruler marker color for errors."));
const overviewRulerWarning = registerColor("editorOverviewRuler.warningForeground", { dark: editorWarningForeground, light: editorWarningForeground, hcDark: editorWarningBorder, hcLight: editorWarningBorder }, nls.localize("overviewRuleWarning", "Overview ruler marker color for warnings."));
const overviewRulerInfo = registerColor("editorOverviewRuler.infoForeground", { dark: editorInfoForeground, light: editorInfoForeground, hcDark: editorInfoBorder, hcLight: editorInfoBorder }, nls.localize("overviewRuleInfo", "Overview ruler marker color for infos."));
const editorBracketHighlightingForeground1 = registerColor("editorBracketHighlight.foreground1", { dark: "#FFD700", light: "#0431FAFF", hcDark: "#FFD700", hcLight: "#0431FAFF" }, nls.localize("editorBracketHighlightForeground1", "Foreground color of brackets (1). Requires enabling bracket pair colorization."));
const editorBracketHighlightingForeground2 = registerColor("editorBracketHighlight.foreground2", { dark: "#DA70D6", light: "#319331FF", hcDark: "#DA70D6", hcLight: "#319331FF" }, nls.localize("editorBracketHighlightForeground2", "Foreground color of brackets (2). Requires enabling bracket pair colorization."));
const editorBracketHighlightingForeground3 = registerColor("editorBracketHighlight.foreground3", { dark: "#179FFF", light: "#7B3814FF", hcDark: "#87CEFA", hcLight: "#7B3814FF" }, nls.localize("editorBracketHighlightForeground3", "Foreground color of brackets (3). Requires enabling bracket pair colorization."));
const editorBracketHighlightingForeground4 = registerColor("editorBracketHighlight.foreground4", "#00000000", nls.localize("editorBracketHighlightForeground4", "Foreground color of brackets (4). Requires enabling bracket pair colorization."));
const editorBracketHighlightingForeground5 = registerColor("editorBracketHighlight.foreground5", "#00000000", nls.localize("editorBracketHighlightForeground5", "Foreground color of brackets (5). Requires enabling bracket pair colorization."));
const editorBracketHighlightingForeground6 = registerColor("editorBracketHighlight.foreground6", "#00000000", nls.localize("editorBracketHighlightForeground6", "Foreground color of brackets (6). Requires enabling bracket pair colorization."));
const editorBracketHighlightingUnexpectedBracketForeground = registerColor("editorBracketHighlight.unexpectedBracket.foreground", { dark: new Color(new RGBA(255, 18, 18, 0.8)), light: new Color(new RGBA(255, 18, 18, 0.8)), hcDark: new Color(new RGBA(255, 50, 50, 1)), hcLight: "#B5200D" }, nls.localize("editorBracketHighlightUnexpectedBracketForeground", "Foreground color of unexpected brackets."));
const editorBracketPairGuideBackground1 = registerColor("editorBracketPairGuide.background1", "#00000000", nls.localize("editorBracketPairGuide.background1", "Background color of inactive bracket pair guides (1). Requires enabling bracket pair guides."));
const editorBracketPairGuideBackground2 = registerColor("editorBracketPairGuide.background2", "#00000000", nls.localize("editorBracketPairGuide.background2", "Background color of inactive bracket pair guides (2). Requires enabling bracket pair guides."));
const editorBracketPairGuideBackground3 = registerColor("editorBracketPairGuide.background3", "#00000000", nls.localize("editorBracketPairGuide.background3", "Background color of inactive bracket pair guides (3). Requires enabling bracket pair guides."));
const editorBracketPairGuideBackground4 = registerColor("editorBracketPairGuide.background4", "#00000000", nls.localize("editorBracketPairGuide.background4", "Background color of inactive bracket pair guides (4). Requires enabling bracket pair guides."));
const editorBracketPairGuideBackground5 = registerColor("editorBracketPairGuide.background5", "#00000000", nls.localize("editorBracketPairGuide.background5", "Background color of inactive bracket pair guides (5). Requires enabling bracket pair guides."));
const editorBracketPairGuideBackground6 = registerColor("editorBracketPairGuide.background6", "#00000000", nls.localize("editorBracketPairGuide.background6", "Background color of inactive bracket pair guides (6). Requires enabling bracket pair guides."));
const editorBracketPairGuideActiveBackground1 = registerColor("editorBracketPairGuide.activeBackground1", "#00000000", nls.localize("editorBracketPairGuide.activeBackground1", "Background color of active bracket pair guides (1). Requires enabling bracket pair guides."));
const editorBracketPairGuideActiveBackground2 = registerColor("editorBracketPairGuide.activeBackground2", "#00000000", nls.localize("editorBracketPairGuide.activeBackground2", "Background color of active bracket pair guides (2). Requires enabling bracket pair guides."));
const editorBracketPairGuideActiveBackground3 = registerColor("editorBracketPairGuide.activeBackground3", "#00000000", nls.localize("editorBracketPairGuide.activeBackground3", "Background color of active bracket pair guides (3). Requires enabling bracket pair guides."));
const editorBracketPairGuideActiveBackground4 = registerColor("editorBracketPairGuide.activeBackground4", "#00000000", nls.localize("editorBracketPairGuide.activeBackground4", "Background color of active bracket pair guides (4). Requires enabling bracket pair guides."));
const editorBracketPairGuideActiveBackground5 = registerColor("editorBracketPairGuide.activeBackground5", "#00000000", nls.localize("editorBracketPairGuide.activeBackground5", "Background color of active bracket pair guides (5). Requires enabling bracket pair guides."));
const editorBracketPairGuideActiveBackground6 = registerColor("editorBracketPairGuide.activeBackground6", "#00000000", nls.localize("editorBracketPairGuide.activeBackground6", "Background color of active bracket pair guides (6). Requires enabling bracket pair guides."));
const editorUnicodeHighlightBorder = registerColor("editorUnicodeHighlight.border", editorWarningForeground, nls.localize("editorUnicodeHighlight.border", "Border color used to highlight unicode characters."));
const editorUnicodeHighlightBackground = registerColor("editorUnicodeHighlight.background", editorWarningBackground, nls.localize("editorUnicodeHighlight.background", "Background color used to highlight unicode characters."));
registerThemingParticipant((theme, collector) => {
  const background = theme.getColor(editorBackground);
  const lineHighlight = theme.getColor(editorLineHighlight);
  const imeBackground = lineHighlight && !lineHighlight.isTransparent() ? lineHighlight : background;
  if (imeBackground) {
    collector.addRule(`.monaco-editor .inputarea.ime-input { background-color: ${imeBackground}; }`);
  }
});
export {
  deprecatedEditorActiveIndentGuides,
  deprecatedEditorIndentGuides,
  editorActiveIndentGuide1,
  editorActiveIndentGuide2,
  editorActiveIndentGuide3,
  editorActiveIndentGuide4,
  editorActiveIndentGuide5,
  editorActiveIndentGuide6,
  editorActiveLineNumber,
  editorBracketHighlightingForeground1,
  editorBracketHighlightingForeground2,
  editorBracketHighlightingForeground3,
  editorBracketHighlightingForeground4,
  editorBracketHighlightingForeground5,
  editorBracketHighlightingForeground6,
  editorBracketHighlightingUnexpectedBracketForeground,
  editorBracketMatchBackground,
  editorBracketMatchBorder,
  editorBracketMatchForeground,
  editorBracketPairGuideActiveBackground1,
  editorBracketPairGuideActiveBackground2,
  editorBracketPairGuideActiveBackground3,
  editorBracketPairGuideActiveBackground4,
  editorBracketPairGuideActiveBackground5,
  editorBracketPairGuideActiveBackground6,
  editorBracketPairGuideBackground1,
  editorBracketPairGuideBackground2,
  editorBracketPairGuideBackground3,
  editorBracketPairGuideBackground4,
  editorBracketPairGuideBackground5,
  editorBracketPairGuideBackground6,
  editorCodeLensForeground,
  editorCursorBackground,
  editorCursorForeground,
  editorDimmedLineNumber,
  editorGutter,
  editorInactiveLineHighlight,
  editorIndentGuide1,
  editorIndentGuide2,
  editorIndentGuide3,
  editorIndentGuide4,
  editorIndentGuide5,
  editorIndentGuide6,
  editorLineHighlight,
  editorLineHighlightBorder,
  editorLineNumbers,
  editorMultiCursorPrimaryBackground,
  editorMultiCursorPrimaryForeground,
  editorMultiCursorSecondaryBackground,
  editorMultiCursorSecondaryForeground,
  editorOverviewRulerBackground,
  editorOverviewRulerBorder,
  editorRangeHighlight,
  editorRangeHighlightBorder,
  editorRuler,
  editorSymbolHighlight,
  editorSymbolHighlightBorder,
  editorUnicodeHighlightBackground,
  editorUnicodeHighlightBorder,
  editorUnnecessaryCodeBorder,
  editorUnnecessaryCodeOpacity,
  editorWhitespaces,
  ghostTextBackground,
  ghostTextBorder,
  ghostTextForeground,
  overviewRulerError,
  overviewRulerInfo,
  overviewRulerRangeHighlight,
  overviewRulerWarning
};
