import * as nls from "../../../../nls.js";
import { Color } from "../../../../base/common/color.js";
import { registerColor, darken, lighten, transparent, ifDefinedThenElse } from "../colorUtils.js";
import { foreground, contrastBorder, activeContrastBorder, focusBorder, iconForeground } from "./baseColors.js";
import { editorWidgetBackground, editorFindMatchHighlightBorder, editorFindMatchHighlight, widgetShadow, editorWidgetForeground } from "./editorColors.js";
const listFocusBackground = registerColor(
  "list.focusBackground",
  null,
  nls.localize("listFocusBackground", "List/Tree background color for the focused item when the list/tree is active. An active list/tree has keyboard focus, an inactive does not.")
);
const listFocusForeground = registerColor(
  "list.focusForeground",
  null,
  nls.localize("listFocusForeground", "List/Tree foreground color for the focused item when the list/tree is active. An active list/tree has keyboard focus, an inactive does not.")
);
const listFocusOutline = registerColor(
  "list.focusOutline",
  { dark: focusBorder, light: focusBorder, hcDark: activeContrastBorder, hcLight: activeContrastBorder },
  nls.localize("listFocusOutline", "List/Tree outline color for the focused item when the list/tree is active. An active list/tree has keyboard focus, an inactive does not.")
);
const listFocusAndSelectionOutline = registerColor(
  "list.focusAndSelectionOutline",
  null,
  nls.localize("listFocusAndSelectionOutline", "List/Tree outline color for the focused item when the list/tree is active and selected. An active list/tree has keyboard focus, an inactive does not.")
);
const listActiveSelectionBackground = registerColor(
  "list.activeSelectionBackground",
  { dark: "#04395E", light: "#0060C0", hcDark: null, hcLight: Color.fromHex("#0F4A85").transparent(0.1) },
  nls.localize("listActiveSelectionBackground", "List/Tree background color for the selected item when the list/tree is active. An active list/tree has keyboard focus, an inactive does not.")
);
const listActiveSelectionForeground = registerColor(
  "list.activeSelectionForeground",
  { dark: Color.white, light: Color.white, hcDark: null, hcLight: null },
  nls.localize("listActiveSelectionForeground", "List/Tree foreground color for the selected item when the list/tree is active. An active list/tree has keyboard focus, an inactive does not.")
);
const listActiveSelectionIconForeground = registerColor(
  "list.activeSelectionIconForeground",
  null,
  nls.localize("listActiveSelectionIconForeground", "List/Tree icon foreground color for the selected item when the list/tree is active. An active list/tree has keyboard focus, an inactive does not.")
);
const listInactiveSelectionBackground = registerColor(
  "list.inactiveSelectionBackground",
  { dark: "#37373D", light: "#E4E6F1", hcDark: null, hcLight: Color.fromHex("#0F4A85").transparent(0.1) },
  nls.localize("listInactiveSelectionBackground", "List/Tree background color for the selected item when the list/tree is inactive. An active list/tree has keyboard focus, an inactive does not.")
);
const listInactiveSelectionForeground = registerColor(
  "list.inactiveSelectionForeground",
  null,
  nls.localize("listInactiveSelectionForeground", "List/Tree foreground color for the selected item when the list/tree is inactive. An active list/tree has keyboard focus, an inactive does not.")
);
const listInactiveSelectionIconForeground = registerColor(
  "list.inactiveSelectionIconForeground",
  null,
  nls.localize("listInactiveSelectionIconForeground", "List/Tree icon foreground color for the selected item when the list/tree is inactive. An active list/tree has keyboard focus, an inactive does not.")
);
const listInactiveFocusBackground = registerColor(
  "list.inactiveFocusBackground",
  null,
  nls.localize("listInactiveFocusBackground", "List/Tree background color for the focused item when the list/tree is inactive. An active list/tree has keyboard focus, an inactive does not.")
);
const listInactiveFocusOutline = registerColor(
  "list.inactiveFocusOutline",
  null,
  nls.localize("listInactiveFocusOutline", "List/Tree outline color for the focused item when the list/tree is inactive. An active list/tree has keyboard focus, an inactive does not.")
);
const listHoverBackground = registerColor(
  "list.hoverBackground",
  { dark: "#2A2D2E", light: "#F0F0F0", hcDark: Color.white.transparent(0.1), hcLight: Color.fromHex("#0F4A85").transparent(0.1) },
  nls.localize("listHoverBackground", "List/Tree background when hovering over items using the mouse.")
);
const listHoverForeground = registerColor(
  "list.hoverForeground",
  null,
  nls.localize("listHoverForeground", "List/Tree foreground when hovering over items using the mouse.")
);
const listDropOverBackground = registerColor(
  "list.dropBackground",
  { dark: "#062F4A", light: "#D6EBFF", hcDark: null, hcLight: null },
  nls.localize("listDropBackground", "List/Tree drag and drop background when moving items over other items when using the mouse.")
);
const listDropBetweenBackground = registerColor(
  "list.dropBetweenBackground",
  { dark: iconForeground, light: iconForeground, hcDark: null, hcLight: null },
  nls.localize("listDropBetweenBackground", "List/Tree drag and drop border color when moving items between items when using the mouse.")
);
const listHighlightForeground = registerColor(
  "list.highlightForeground",
  { dark: "#2AAAFF", light: "#0066BF", hcDark: focusBorder, hcLight: focusBorder },
  nls.localize("highlight", "List/Tree foreground color of the match highlights when searching inside the list/tree.")
);
const listFocusHighlightForeground = registerColor(
  "list.focusHighlightForeground",
  { dark: listHighlightForeground, light: ifDefinedThenElse(listActiveSelectionBackground, listHighlightForeground, "#BBE7FF"), hcDark: listHighlightForeground, hcLight: listHighlightForeground },
  nls.localize("listFocusHighlightForeground", "List/Tree foreground color of the match highlights on actively focused items when searching inside the list/tree.")
);
const listInvalidItemForeground = registerColor(
  "list.invalidItemForeground",
  { dark: "#B89500", light: "#B89500", hcDark: "#B89500", hcLight: "#B5200D" },
  nls.localize("invalidItemForeground", "List/Tree foreground color for invalid items, for example an unresolved root in explorer.")
);
const listErrorForeground = registerColor(
  "list.errorForeground",
  { dark: "#F88070", light: "#B01011", hcDark: null, hcLight: null },
  nls.localize("listErrorForeground", "Foreground color of list items containing errors.")
);
const listWarningForeground = registerColor(
  "list.warningForeground",
  { dark: "#CCA700", light: "#855F00", hcDark: null, hcLight: null },
  nls.localize("listWarningForeground", "Foreground color of list items containing warnings.")
);
const listFilterWidgetBackground = registerColor(
  "listFilterWidget.background",
  { light: darken(editorWidgetBackground, 0), dark: lighten(editorWidgetBackground, 0), hcDark: editorWidgetBackground, hcLight: editorWidgetBackground },
  nls.localize("listFilterWidgetBackground", "Background color of the type filter widget in lists and trees.")
);
const listFilterWidgetOutline = registerColor(
  "listFilterWidget.outline",
  { dark: Color.transparent, light: Color.transparent, hcDark: "#f38518", hcLight: "#007ACC" },
  nls.localize("listFilterWidgetOutline", "Outline color of the type filter widget in lists and trees.")
);
const listFilterWidgetNoMatchesOutline = registerColor(
  "listFilterWidget.noMatchesOutline",
  { dark: "#BE1100", light: "#BE1100", hcDark: contrastBorder, hcLight: contrastBorder },
  nls.localize("listFilterWidgetNoMatchesOutline", "Outline color of the type filter widget in lists and trees, when there are no matches.")
);
const listFilterWidgetShadow = registerColor(
  "listFilterWidget.shadow",
  widgetShadow,
  nls.localize("listFilterWidgetShadow", "Shadow color of the type filter widget in lists and trees.")
);
const listFilterMatchHighlight = registerColor(
  "list.filterMatchBackground",
  { dark: editorFindMatchHighlight, light: editorFindMatchHighlight, hcDark: null, hcLight: null },
  nls.localize("listFilterMatchHighlight", "Background color of the filtered match.")
);
const listFilterMatchHighlightBorder = registerColor(
  "list.filterMatchBorder",
  { dark: editorFindMatchHighlightBorder, light: editorFindMatchHighlightBorder, hcDark: contrastBorder, hcLight: activeContrastBorder },
  nls.localize("listFilterMatchHighlightBorder", "Border color of the filtered match.")
);
const listDeemphasizedForeground = registerColor(
  "list.deemphasizedForeground",
  { dark: "#8C8C8C", light: "#8E8E90", hcDark: "#A7A8A9", hcLight: "#666666" },
  nls.localize("listDeemphasizedForeground", "List/Tree foreground color for items that are deemphasized.")
);
const treeIndentGuidesStroke = registerColor(
  "tree.indentGuidesStroke",
  { dark: "#585858", light: "#a9a9a9", hcDark: "#a9a9a9", hcLight: "#a5a5a5" },
  nls.localize("treeIndentGuidesStroke", "Tree stroke color for the indentation guides.")
);
const treeInactiveIndentGuidesStroke = registerColor(
  "tree.inactiveIndentGuidesStroke",
  transparent(treeIndentGuidesStroke, 0.4),
  nls.localize("treeInactiveIndentGuidesStroke", "Tree stroke color for the indentation guides that are not active.")
);
const tableColumnsBorder = registerColor(
  "tree.tableColumnsBorder",
  { dark: "#CCCCCC20", light: "#61616120", hcDark: null, hcLight: null },
  nls.localize("tableColumnsBorder", "Table border color between columns.")
);
const tableOddRowsBackgroundColor = registerColor(
  "tree.tableOddRowsBackground",
  { dark: transparent(foreground, 0.04), light: transparent(foreground, 0.04), hcDark: null, hcLight: null },
  nls.localize("tableOddRowsBackgroundColor", "Background color for odd table rows.")
);
const editorActionListBackground = registerColor(
  "editorActionList.background",
  editorWidgetBackground,
  nls.localize("editorActionListBackground", "Action List background color.")
);
const editorActionListForeground = registerColor(
  "editorActionList.foreground",
  editorWidgetForeground,
  nls.localize("editorActionListForeground", "Action List foreground color.")
);
const editorActionListFocusForeground = registerColor(
  "editorActionList.focusForeground",
  listActiveSelectionForeground,
  nls.localize("editorActionListFocusForeground", "Action List foreground color for the focused item.")
);
const editorActionListFocusBackground = registerColor(
  "editorActionList.focusBackground",
  listActiveSelectionBackground,
  nls.localize("editorActionListFocusBackground", "Action List background color for the focused item.")
);
export {
  editorActionListBackground,
  editorActionListFocusBackground,
  editorActionListFocusForeground,
  editorActionListForeground,
  listActiveSelectionBackground,
  listActiveSelectionForeground,
  listActiveSelectionIconForeground,
  listDeemphasizedForeground,
  listDropBetweenBackground,
  listDropOverBackground,
  listErrorForeground,
  listFilterMatchHighlight,
  listFilterMatchHighlightBorder,
  listFilterWidgetBackground,
  listFilterWidgetNoMatchesOutline,
  listFilterWidgetOutline,
  listFilterWidgetShadow,
  listFocusAndSelectionOutline,
  listFocusBackground,
  listFocusForeground,
  listFocusHighlightForeground,
  listFocusOutline,
  listHighlightForeground,
  listHoverBackground,
  listHoverForeground,
  listInactiveFocusBackground,
  listInactiveFocusOutline,
  listInactiveSelectionBackground,
  listInactiveSelectionForeground,
  listInactiveSelectionIconForeground,
  listInvalidItemForeground,
  listWarningForeground,
  tableColumnsBorder,
  tableOddRowsBackgroundColor,
  treeInactiveIndentGuidesStroke,
  treeIndentGuidesStroke
};
