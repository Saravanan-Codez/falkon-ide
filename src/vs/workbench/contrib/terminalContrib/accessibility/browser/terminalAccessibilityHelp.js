var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../nls.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { ShellIntegrationStatus, TerminalSettingId, WindowsShellType } from "../../../../../platform/terminal/common/terminal.js";
import { AccessibilityCommandId } from "../../../accessibility/common/accessibilityCommands.js";
import { TerminalCommandId } from "../../../terminal/common/terminal.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { TerminalAccessibilitySettingId } from "../common/terminalAccessibilityConfiguration.js";
import { TerminalAccessibilityCommandId } from "../common/terminal.accessibility.js";
import { TerminalLinksCommandId } from "../../links/common/terminal.links.js";
import { AccessibleViewProviderId, AccessibleViewType } from "../../../../../platform/accessibility/browser/accessibleView.js";
import { accessibleViewIsShown, accessibleViewCurrentProviderId, AccessibilityVerbositySettingId } from "../../../accessibility/browser/accessibilityConfiguration.js";
import { TerminalHistoryCommandId } from "../../history/common/terminal.history.js";
import { TerminalSuggestCommandId } from "../../suggest/common/terminal.suggest.js";
import { TerminalSuggestSettingId } from "../../suggest/common/terminalSuggestConfiguration.js";
import { HasSpeechProvider } from "../../../speech/common/speechService.js";
import { ChatContextKeys } from "../../../chat/common/actions/chatContextKeys.js";
var ClassName = /* @__PURE__ */ ((ClassName2) => {
  ClassName2["Active"] = "active";
  ClassName2["EditorTextArea"] = "textarea";
  return ClassName2;
})(ClassName || {});
let TerminalAccessibilityHelpProvider = class extends Disposable {
  constructor(_instance, _xterm, _commandService, _configurationService, _contextKeyService) {
    super();
    this._instance = _instance;
    this._commandService = _commandService;
    this._configurationService = _configurationService;
    this._contextKeyService = _contextKeyService;
    this.id = AccessibleViewProviderId.TerminalHelp;
    this._hasShellIntegration = false;
    this.options = {
      type: AccessibleViewType.Help,
      readMoreUrl: "https://code.visualstudio.com/docs/editor/accessibility#_terminal-accessibility"
    };
    this.verbositySettingKey = AccessibilityVerbositySettingId.Terminal;
    this._hasShellIntegration = _xterm.shellIntegration.status === ShellIntegrationStatus.VSCode;
  }
  onClose() {
    const expr = ContextKeyExpr.and(accessibleViewIsShown, ContextKeyExpr.equals(accessibleViewCurrentProviderId.key, AccessibleViewProviderId.TerminalHelp));
    if (expr?.evaluate(this._contextKeyService.getContext(null))) {
      this._commandService.executeCommand(TerminalAccessibilityCommandId.FocusAccessibleBuffer);
    } else {
      this._instance.focus();
    }
    this.dispose();
  }
  provideContent() {
    const content = [
      localize("focusAccessibleTerminalView", "The Focus Accessible Terminal View command<keybinding:{0}> enables screen readers to read terminal contents.", TerminalAccessibilityCommandId.FocusAccessibleBuffer),
      localize("preserveCursor", "Customize the behavior of the cursor when toggling between the terminal and accessible view with `terminal.integrated.accessibleViewPreserveCursorPosition.`"),
      localize("openDetectedLink", "The Open Detected Link command<keybinding:{0}> enables screen readers to easily open links found in the terminal.", TerminalLinksCommandId.OpenDetectedLink),
      localize("newWithProfile", "The Create New Terminal (With Profile) command<keybinding:{0}> allows for easy terminal creation using a specific profile.", TerminalCommandId.NewWithProfile),
      localize("focusAfterRun", "Configure what gets focused after running selected text in the terminal with `{0}`.", TerminalSettingId.FocusAfterRun)
    ];
    if (!this._configurationService.getValue(TerminalAccessibilitySettingId.AccessibleViewFocusOnCommandExecution)) {
      content.push(localize("focusViewOnExecution", "Enable `terminal.integrated.accessibleViewFocusOnCommandExecution` to automatically focus the terminal accessible view when a command is executed in the terminal."));
    }
    if (this._configurationService.getValue(TerminalSuggestSettingId.Enabled)) {
      content.push(localize("suggestTrigger", "The terminal request completions command can be invoked manually<keybinding:{0}>, but also appears while typing.", TerminalSuggestCommandId.TriggerSuggest));
      content.push(localize("suggest", "When the terminal suggest widget is focused:"));
      content.push(localize("suggestCommands", "- Accept the suggestion<keybinding:{0}> and configure suggest settings<keybinding:{1}>.", TerminalSuggestCommandId.AcceptSelectedSuggestion, TerminalSuggestCommandId.ConfigureSettings));
      content.push(localize("suggestCommandsMore", "- Toggle between the widget and terminal<keybinding:{0}> and toggle details focus<keybinding:{1}> to learn more about the suggestion.", TerminalSuggestCommandId.ToggleDetails, TerminalSuggestCommandId.ToggleDetailsFocus));
      content.push(localize("suggestLearnMore", "- Learn more about the suggestion<keybinding:{0}>.", TerminalSuggestCommandId.LearnMore));
      content.push(localize("suggestConfigure", "-Configure suggest settings<keybinding:{0}> ", TerminalSuggestCommandId.ConfigureSettings));
    }
    if (this._instance.shellType === WindowsShellType.CommandPrompt) {
      content.push(localize("commandPromptMigration", "Consider using powershell instead of command prompt for an improved experience"));
    }
    if (HasSpeechProvider.getValue(this._contextKeyService) || ChatContextKeys.enabled.getValue(this._contextKeyService) && ChatContextKeys.speechToTextConfigured.getValue(this._contextKeyService)) {
      content.push(localize("terminalDictation", "Start or stop dictation in the terminal<keybinding:{0}>.", TerminalCommandId.StartVoice));
    }
    if (this._hasShellIntegration) {
      content.push(localize("shellIntegration", "The terminal has a feature called shell integration that offers an enhanced experience and provides useful commands for screen readers such as:"));
      content.push("- " + localize("goToNextCommand", "Go to Next Command<keybinding:{0}> in the accessible view", TerminalAccessibilityCommandId.AccessibleBufferGoToNextCommand));
      content.push("- " + localize("goToPreviousCommand", "Go to Previous Command<keybinding:{0}> in the accessible view", TerminalAccessibilityCommandId.AccessibleBufferGoToPreviousCommand));
      content.push("- " + localize("goToSymbol", "Go to Symbol<keybinding:{0}>", AccessibilityCommandId.GoToSymbol));
      content.push("- " + localize("runRecentCommand", "Run Recent Command<keybinding:{0}>", TerminalHistoryCommandId.RunRecentCommand));
      content.push("- " + localize("goToRecentDirectory", "Go to Recent Directory<keybinding:{0}>", TerminalHistoryCommandId.GoToRecentDirectory));
    } else {
      content.push(localize("noShellIntegration", "Shell integration is not enabled. Some accessibility features may not be available."));
    }
    return content.join("\n");
  }
};
TerminalAccessibilityHelpProvider = __decorateClass([
  __decorateParam(2, ICommandService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IContextKeyService)
], TerminalAccessibilityHelpProvider);
export {
  ClassName,
  TerminalAccessibilityHelpProvider
};
