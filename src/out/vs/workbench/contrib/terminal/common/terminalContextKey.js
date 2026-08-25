import { localize } from "../../../../nls.js";
import { ContextKeyExpr, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { TerminalSettingId } from "../../../../platform/terminal/common/terminal.js";
import { TERMINAL_VIEW_ID } from "./terminal.js";
import { TerminalContribContextKeyStrings } from "../terminalContribExports.js";
var TerminalContextKeyStrings = /* @__PURE__ */ ((TerminalContextKeyStrings2) => {
  TerminalContextKeyStrings2["IsOpen"] = "terminalIsOpen";
  TerminalContextKeyStrings2["Count"] = "terminalCount";
  TerminalContextKeyStrings2["GroupCount"] = "terminalGroupCount";
  TerminalContextKeyStrings2["TabsNarrow"] = "isTerminalTabsNarrow";
  TerminalContextKeyStrings2["HasFixedWidth"] = "terminalHasFixedWidth";
  TerminalContextKeyStrings2["ProcessSupported"] = "terminalProcessSupported";
  TerminalContextKeyStrings2["Focus"] = "terminalFocus";
  TerminalContextKeyStrings2["FocusInAny"] = "terminalFocusInAny";
  TerminalContextKeyStrings2["AccessibleBufferFocus"] = "terminalAccessibleBufferFocus";
  TerminalContextKeyStrings2["AccessibleBufferOnLastLine"] = "terminalAccessibleBufferOnLastLine";
  TerminalContextKeyStrings2["EditorFocus"] = "terminalEditorFocus";
  TerminalContextKeyStrings2["TabsFocus"] = "terminalTabsFocus";
  TerminalContextKeyStrings2["WebExtensionContributedProfile"] = "terminalWebExtensionContributedProfile";
  TerminalContextKeyStrings2["TerminalHasBeenCreated"] = "terminalHasBeenCreated";
  TerminalContextKeyStrings2["TerminalEditorActive"] = "terminalEditorActive";
  TerminalContextKeyStrings2["TabsMouse"] = "terminalTabsMouse";
  TerminalContextKeyStrings2["AltBufferActive"] = "terminalAltBufferActive";
  TerminalContextKeyStrings2["SuggestWidgetVisible"] = "terminalSuggestWidgetVisible";
  TerminalContextKeyStrings2["A11yTreeFocus"] = "terminalA11yTreeFocus";
  TerminalContextKeyStrings2["ViewShowing"] = "terminalViewShowing";
  TerminalContextKeyStrings2["TextSelected"] = "terminalTextSelected";
  TerminalContextKeyStrings2["TextSelectedInFocused"] = "terminalTextSelectedInFocused";
  TerminalContextKeyStrings2["FindVisible"] = "terminalFindVisible";
  TerminalContextKeyStrings2["FindInputFocused"] = "terminalFindInputFocused";
  TerminalContextKeyStrings2["FindFocused"] = "terminalFindFocused";
  TerminalContextKeyStrings2["TabsSingularSelection"] = "terminalTabsSingularSelection";
  TerminalContextKeyStrings2["SplitTerminal"] = "terminalSplitTerminal";
  TerminalContextKeyStrings2["SplitPaneActive"] = "terminalSplitPaneActive";
  TerminalContextKeyStrings2["ShellType"] = "terminalShellType";
  TerminalContextKeyStrings2["InTerminalRunCommandPicker"] = "inTerminalRunCommandPicker";
  TerminalContextKeyStrings2["TerminalShellIntegrationEnabled"] = "terminalShellIntegrationEnabled";
  TerminalContextKeyStrings2["DictationInProgress"] = "terminalDictationInProgress";
  return TerminalContextKeyStrings2;
})(TerminalContextKeyStrings || {});
var TerminalContextKeys;
((TerminalContextKeys2) => {
  TerminalContextKeys2.isOpen = new RawContextKey("terminalIsOpen" /* IsOpen */, false, true);
  TerminalContextKeys2.focus = new RawContextKey("terminalFocus" /* Focus */, false, localize("terminalFocusContextKey", "Whether the terminal is focused."));
  TerminalContextKeys2.focusInAny = new RawContextKey("terminalFocusInAny" /* FocusInAny */, false, localize("terminalFocusInAnyContextKey", "Whether any terminal is focused, including detached terminals used in other UI."));
  TerminalContextKeys2.editorFocus = new RawContextKey("terminalEditorFocus" /* EditorFocus */, false, localize("terminalEditorFocusContextKey", "Whether a terminal in the editor area is focused."));
  TerminalContextKeys2.count = new RawContextKey("terminalCount" /* Count */, 0, localize("terminalCountContextKey", "The current number of terminals."));
  TerminalContextKeys2.groupCount = new RawContextKey("terminalGroupCount" /* GroupCount */, 0, true);
  TerminalContextKeys2.tabsNarrow = new RawContextKey("isTerminalTabsNarrow" /* TabsNarrow */, false, true);
  TerminalContextKeys2.terminalHasFixedWidth = new RawContextKey("terminalHasFixedWidth" /* HasFixedWidth */, false, true);
  TerminalContextKeys2.tabsFocus = new RawContextKey("terminalTabsFocus" /* TabsFocus */, false, localize("terminalTabsFocusContextKey", "Whether the terminal tabs widget is focused."));
  TerminalContextKeys2.webExtensionContributedProfile = new RawContextKey("terminalWebExtensionContributedProfile" /* WebExtensionContributedProfile */, false, true);
  TerminalContextKeys2.terminalHasBeenCreated = new RawContextKey("terminalHasBeenCreated" /* TerminalHasBeenCreated */, false, true);
  TerminalContextKeys2.terminalEditorActive = new RawContextKey("terminalEditorActive" /* TerminalEditorActive */, false, true);
  TerminalContextKeys2.tabsMouse = new RawContextKey("terminalTabsMouse" /* TabsMouse */, false, true);
  TerminalContextKeys2.shellType = new RawContextKey("terminalShellType" /* ShellType */, void 0, { type: "string", description: localize("terminalShellTypeContextKey", "The shell type of the active terminal, this is set if the type can be detected.") });
  TerminalContextKeys2.altBufferActive = new RawContextKey("terminalAltBufferActive" /* AltBufferActive */, false, localize("terminalAltBufferActive", "Whether the terminal's alt buffer is active."));
  TerminalContextKeys2.suggestWidgetVisible = new RawContextKey("terminalSuggestWidgetVisible" /* SuggestWidgetVisible */, false, localize("terminalSuggestWidgetVisible", "Whether the terminal's suggest widget is visible."));
  TerminalContextKeys2.notFocus = TerminalContextKeys2.focus.toNegated();
  TerminalContextKeys2.viewShowing = new RawContextKey("terminalViewShowing" /* ViewShowing */, false, localize("terminalViewShowing", "Whether the terminal view is showing"));
  TerminalContextKeys2.textSelected = new RawContextKey("terminalTextSelected" /* TextSelected */, false, localize("terminalTextSelectedContextKey", "Whether text is selected in the active terminal."));
  TerminalContextKeys2.textSelectedInFocused = new RawContextKey("terminalTextSelectedInFocused" /* TextSelectedInFocused */, false, localize("terminalTextSelectedInFocusedContextKey", "Whether text is selected in a focused terminal."));
  TerminalContextKeys2.notTextSelected = TerminalContextKeys2.textSelected.toNegated();
  TerminalContextKeys2.findVisible = new RawContextKey("terminalFindVisible" /* FindVisible */, false, true);
  TerminalContextKeys2.notFindVisible = TerminalContextKeys2.findVisible.toNegated();
  TerminalContextKeys2.findInputFocus = new RawContextKey("terminalFindInputFocused" /* FindInputFocused */, false, true);
  TerminalContextKeys2.findFocus = new RawContextKey("terminalFindFocused" /* FindFocused */, false, true);
  TerminalContextKeys2.notFindFocus = TerminalContextKeys2.findInputFocus.toNegated();
  TerminalContextKeys2.processSupported = new RawContextKey("terminalProcessSupported" /* ProcessSupported */, false, localize("terminalProcessSupportedContextKey", "Whether terminal processes can be launched in the current workspace."));
  TerminalContextKeys2.tabsSingularSelection = new RawContextKey("terminalTabsSingularSelection" /* TabsSingularSelection */, false, localize("terminalTabsSingularSelectedContextKey", "Whether one terminal is selected in the terminal tabs list."));
  TerminalContextKeys2.splitTerminalTabFocused = new RawContextKey("terminalSplitTerminal" /* SplitTerminal */, false, localize("isSplitTerminalContextKey", "Whether the focused tab's terminal is a split terminal."));
  TerminalContextKeys2.splitTerminalActive = new RawContextKey("terminalSplitPaneActive" /* SplitPaneActive */, false, localize("splitPaneActive", "Whether the active terminal is a split pane."));
  TerminalContextKeys2.inTerminalRunCommandPicker = new RawContextKey("inTerminalRunCommandPicker" /* InTerminalRunCommandPicker */, false, localize("inTerminalRunCommandPickerContextKey", "Whether the terminal run command picker is currently open."));
  TerminalContextKeys2.terminalShellIntegrationEnabled = new RawContextKey("terminalShellIntegrationEnabled" /* TerminalShellIntegrationEnabled */, false, localize("terminalShellIntegrationEnabled", "Whether shell integration is enabled in the active terminal"));
  TerminalContextKeys2.terminalDictationInProgress = new RawContextKey("terminalDictationInProgress" /* DictationInProgress */, false);
  TerminalContextKeys2.shouldShowViewInlineActions = ContextKeyExpr.and(
    ContextKeyExpr.equals("view", TERMINAL_VIEW_ID),
    ContextKeyExpr.notEquals(`config.${TerminalSettingId.TabsHideCondition}`, "never"),
    ContextKeyExpr.not(TerminalContribContextKeyStrings.ChatHasHiddenTerminals),
    ContextKeyExpr.or(
      ContextKeyExpr.not(`config.${TerminalSettingId.TabsEnabled}`),
      ContextKeyExpr.and(
        ContextKeyExpr.equals(`config.${TerminalSettingId.TabsShowActions}`, "singleTerminal"),
        ContextKeyExpr.equals("terminalGroupCount" /* GroupCount */, 1)
      ),
      ContextKeyExpr.and(
        ContextKeyExpr.equals(`config.${TerminalSettingId.TabsShowActions}`, "singleTerminalOrNarrow"),
        ContextKeyExpr.or(
          ContextKeyExpr.equals("terminalGroupCount" /* GroupCount */, 1),
          ContextKeyExpr.has("isTerminalTabsNarrow" /* TabsNarrow */)
        )
      ),
      ContextKeyExpr.and(
        ContextKeyExpr.equals(`config.${TerminalSettingId.TabsShowActions}`, "singleGroup"),
        ContextKeyExpr.equals("terminalGroupCount" /* GroupCount */, 1)
      ),
      ContextKeyExpr.equals(`config.${TerminalSettingId.TabsShowActions}`, "always")
    )
  );
})(TerminalContextKeys || (TerminalContextKeys = {}));
export {
  TerminalContextKeyStrings,
  TerminalContextKeys
};
