import * as nls from "../../nls.js";
var AccessibilityHelpNLS;
((AccessibilityHelpNLS2) => {
  AccessibilityHelpNLS2.accessibilityHelpTitle = nls.localize("accessibilityHelpTitle", "Accessibility Help");
  AccessibilityHelpNLS2.openingDocs = nls.localize("openingDocs", "Opening the Accessibility documentation page.");
  AccessibilityHelpNLS2.readonlyDiffEditor = nls.localize("readonlyDiffEditor", "You are in a read-only pane of a diff editor.");
  AccessibilityHelpNLS2.editableDiffEditor = nls.localize("editableDiffEditor", "You are in a pane of a diff editor.");
  AccessibilityHelpNLS2.readonlyEditor = nls.localize("readonlyEditor", "You are in a read-only code editor.");
  AccessibilityHelpNLS2.editableEditor = nls.localize("editableEditor", "You are in a code editor.");
  AccessibilityHelpNLS2.defaultWindowTitleIncludesEditorState = nls.localize("defaultWindowTitleIncludesEditorState", "activeEditorState - such as modified, problems, and more, is included as a part of the window.title setting by default. Disable it with accessibility.windowTitleOptimized.");
  AccessibilityHelpNLS2.defaultWindowTitleExcludingEditorState = nls.localize("defaultWindowTitleExcludingEditorState", "activeEditorState - such as modified, problems, and more, is currently not included as a part of the window.title setting by default. Enable it with accessibility.windowTitleOptimized.");
  AccessibilityHelpNLS2.toolbar = nls.localize("toolbar", "Around the workbench, when the screen reader announces you've landed in a toolbar, use narrow keys to navigate between the toolbar's actions.");
  AccessibilityHelpNLS2.changeConfigToOnMac = nls.localize("changeConfigToOnMac", "Configure the application to be optimized for usage with a Screen Reader (Command+E).");
  AccessibilityHelpNLS2.changeConfigToOnWinLinux = nls.localize("changeConfigToOnWinLinux", "Configure the application to be optimized for usage with a Screen Reader (Control+E).");
  AccessibilityHelpNLS2.auto_on = nls.localize("auto_on", "The application is configured to be optimized for usage with a Screen Reader.");
  AccessibilityHelpNLS2.auto_off = nls.localize("auto_off", "The application is configured to never be optimized for usage with a Screen Reader.");
  AccessibilityHelpNLS2.screenReaderModeEnabled = nls.localize("screenReaderModeEnabled", "Screen Reader Optimized Mode enabled.");
  AccessibilityHelpNLS2.screenReaderModeDisabled = nls.localize("screenReaderModeDisabled", "Screen Reader Optimized Mode disabled.");
  AccessibilityHelpNLS2.tabFocusModeOnMsg = nls.localize("tabFocusModeOnMsg", "Pressing Tab in the current editor will move focus to the next focusable element. Toggle this behavior{0}.", "<keybinding:editor.action.toggleTabFocusMode>");
  AccessibilityHelpNLS2.tabFocusModeOffMsg = nls.localize("tabFocusModeOffMsg", "Pressing Tab in the current editor will insert the tab character. Toggle this behavior{0}.", "<keybinding:editor.action.toggleTabFocusMode>");
  AccessibilityHelpNLS2.stickScroll = nls.localize("stickScrollKb", "Focus Sticky Scroll{0} to focus the currently nested scopes.", "<keybinding:editor.action.focusStickyDebugConsole>");
  AccessibilityHelpNLS2.suggestActions = nls.localize("suggestActionsKb", "Trigger the suggest widget{0} to show possible inline suggestions.", "<keybinding:editor.action.triggerSuggest>");
  AccessibilityHelpNLS2.acceptSuggestAction = nls.localize("acceptSuggestAction", "Accept suggestion{0} to accept the currently selected suggestion.", "<keybinding:acceptSelectedSuggestion>");
  AccessibilityHelpNLS2.toggleSuggestionFocus = nls.localize("toggleSuggestionFocus", "Toggle focus between the suggest widget and the editor{0} and toggle details focus with{1} to learn more about the suggestion.", "<keybinding:focusSuggestion>", "<keybinding:toggleSuggestionFocus>");
  AccessibilityHelpNLS2.codeFolding = nls.localize("codeFolding", "Use code folding to collapse blocks of code and focus on the code you're interested in via the Toggle Folding Command{0}.", "<keybinding:editor.toggleFold>");
  AccessibilityHelpNLS2.intellisense = nls.localize("intellisense", "Use Intellisense to improve coding efficiency and reduce errors. Trigger suggestions{0}.", "<keybinding:editor.action.triggerSuggest>");
  AccessibilityHelpNLS2.showOrFocusHover = nls.localize("showOrFocusHover", "Show or focus the hover{0} to read information about the current symbol.", "<keybinding:editor.action.showHover>");
  AccessibilityHelpNLS2.goToSymbol = nls.localize("goToSymbol", "Go to Symbol{0} to quickly navigate between symbols in the current file.", "<keybinding:workbench.action.gotoSymbol>");
  AccessibilityHelpNLS2.showAccessibilityHelpAction = nls.localize("showAccessibilityHelpAction", "Show Accessibility Help");
  AccessibilityHelpNLS2.listSignalSounds = nls.localize("listSignalSoundsCommand", "Run the command: List Signal Sounds for an overview of all sounds and their current status.");
  AccessibilityHelpNLS2.listAlerts = nls.localize("listAnnouncementsCommand", "Run the command: List Signal Announcements for an overview of announcements and their current status.");
  AccessibilityHelpNLS2.announceCursorPosition = nls.localize("announceCursorPosition", "Run the command: Announce Cursor Position{0} to hear the current line and column.", "<keybinding:editor.action.announceCursorPosition>");
  AccessibilityHelpNLS2.focusNotifications = nls.localize("focusNotifications", "Focus notification toasts{0} to navigate them with the keyboard. Accept the primary action of a focused notification{1}.", "<keybinding:notifications.focusToasts>", "<keybinding:notification.acceptPrimaryAction>");
  AccessibilityHelpNLS2.quickChat = nls.localize("quickChatCommand", "Toggle quick chat{0} to open or close a chat session.", "<keybinding:workbench.action.quickchat.toggle>");
  AccessibilityHelpNLS2.startInlineChat = nls.localize("startInlineChatCommand", "Start inline chat{0} to create an in editor chat session.", "<keybinding:inlineChat.start>");
  AccessibilityHelpNLS2.startDebugging = nls.localize("debug.startDebugging", "The Debug: Start Debugging command{0} will start a debug session.", "<keybinding:workbench.action.debug.start>");
  AccessibilityHelpNLS2.setBreakpoint = nls.localize("debugConsole.setBreakpoint", "The Debug: Inline Breakpoint command{0} will set or unset a breakpoint at the current cursor position in the active editor.", "<keybinding:editor.debug.action.toggleInlineBreakpoint>");
  AccessibilityHelpNLS2.addToWatch = nls.localize("debugConsole.addToWatch", "The Debug: Add to Watch command{0} will add the selected text to the watch view.", "<keybinding:editor.debug.action.selectionToWatch>");
  AccessibilityHelpNLS2.debugExecuteSelection = nls.localize("debugConsole.executeSelection", "The Debug: Execute Selection command{0} will execute the selected text in the debug console.", "<keybinding:editor.debug.action.selectionToRepl>");
  AccessibilityHelpNLS2.chatEditorModification = nls.localize("chatEditorModification", "The editor contains pending modifications that have been made by chat.");
  AccessibilityHelpNLS2.chatEditorRequestInProgress = nls.localize("chatEditorRequestInProgress", "The editor is currently waiting for modifications to be made by chat.");
  AccessibilityHelpNLS2.chatEditActions = nls.localize("chatEditing.navigation", "Navigate between edits in the editor with navigate previous{0} and next{1} and accept{2}, reject{3} or view the diff{4} for the current change. Accept edits across all files{5}.", "<keybinding:chatEditor.action.navigatePrevious>", "<keybinding:chatEditor.action.navigateNext>", "<keybinding:chatEditor.action.acceptHunk>", "<keybinding:chatEditor.action.undoHunk>", "<keybinding:chatEditor.action.toggleDiff>", "<keybinding:chatEditor.action.acceptAllEdits>");
  AccessibilityHelpNLS2.editorDictation = nls.localize("editorDictation", "Start or stop dictation in the editor{0}.", "<keybinding:workbench.action.editorDictation.start>");
})(AccessibilityHelpNLS || (AccessibilityHelpNLS = {}));
var InspectTokensNLS;
((InspectTokensNLS2) => {
  InspectTokensNLS2.inspectTokensAction = nls.localize("inspectTokens", "Developer: Inspect Tokens");
})(InspectTokensNLS || (InspectTokensNLS = {}));
var GoToLineNLS;
((GoToLineNLS2) => {
  GoToLineNLS2.gotoLineActionLabel = nls.localize("gotoLineActionLabel", "Go to Line/Column...");
  GoToLineNLS2.gotoOffsetActionLabel = nls.localize("gotoOffsetActionLabel", "Go to Offset...");
})(GoToLineNLS || (GoToLineNLS = {}));
var QuickHelpNLS;
((QuickHelpNLS2) => {
  QuickHelpNLS2.helpQuickAccessActionLabel = nls.localize("helpQuickAccess", "Show all Quick Access Providers");
})(QuickHelpNLS || (QuickHelpNLS = {}));
var QuickCommandNLS;
((QuickCommandNLS2) => {
  QuickCommandNLS2.quickCommandActionLabel = nls.localize("quickCommandActionLabel", "Command Palette");
  QuickCommandNLS2.quickCommandHelp = nls.localize("quickCommandActionHelp", "Show And Run Commands");
})(QuickCommandNLS || (QuickCommandNLS = {}));
var QuickOutlineNLS;
((QuickOutlineNLS2) => {
  QuickOutlineNLS2.quickOutlineActionLabel = nls.localize("quickOutlineActionLabel", "Go to Symbol...");
  QuickOutlineNLS2.quickOutlineByCategoryActionLabel = nls.localize("quickOutlineByCategoryActionLabel", "Go to Symbol by Category...");
})(QuickOutlineNLS || (QuickOutlineNLS = {}));
var StandaloneCodeEditorNLS;
((StandaloneCodeEditorNLS2) => {
  StandaloneCodeEditorNLS2.editorViewAccessibleLabel = nls.localize("editorViewAccessibleLabel", "Editor content");
})(StandaloneCodeEditorNLS || (StandaloneCodeEditorNLS = {}));
var ToggleHighContrastNLS;
((ToggleHighContrastNLS2) => {
  ToggleHighContrastNLS2.toggleHighContrast = nls.localize("toggleHighContrast", "Toggle High Contrast Theme");
})(ToggleHighContrastNLS || (ToggleHighContrastNLS = {}));
var StandaloneServicesNLS;
((StandaloneServicesNLS2) => {
  StandaloneServicesNLS2.bulkEditServiceSummary = nls.localize("bulkEditServiceSummary", "Made {0} edits in {1} files");
})(StandaloneServicesNLS || (StandaloneServicesNLS = {}));
export {
  AccessibilityHelpNLS,
  GoToLineNLS,
  InspectTokensNLS,
  QuickCommandNLS,
  QuickHelpNLS,
  QuickOutlineNLS,
  StandaloneCodeEditorNLS,
  StandaloneServicesNLS,
  ToggleHighContrastNLS
};
