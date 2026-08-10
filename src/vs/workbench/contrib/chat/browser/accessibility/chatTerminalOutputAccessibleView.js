import { AccessibleContentProvider, AccessibleViewProviderId, AccessibleViewType } from "../../../../../platform/accessibility/browser/accessibleView.js";
import { AccessibilityVerbositySettingId } from "../../../accessibility/browser/accessibilityConfiguration.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
import { ITerminalChatService } from "../../../terminal/browser/terminal.js";
class ChatTerminalOutputAccessibleView {
  constructor() {
    this.priority = 115;
    this.name = "chatTerminalOutput";
    this.type = AccessibleViewType.View;
    this.when = ChatContextKeys.inChatTerminalToolOutput;
  }
  getProvider(accessor) {
    const terminalChatService = accessor.get(ITerminalChatService);
    const part = terminalChatService.getFocusedProgressPart();
    if (!part) {
      return;
    }
    const content = part.getCommandAndOutputAsText();
    if (!content) {
      return;
    }
    return new AccessibleContentProvider(
      AccessibleViewProviderId.ChatTerminalOutput,
      { type: AccessibleViewType.View, id: AccessibleViewProviderId.ChatTerminalOutput, language: "text" },
      () => content,
      () => part.focusOutput(),
      AccessibilityVerbositySettingId.TerminalChatOutput
    );
  }
}
export {
  ChatTerminalOutputAccessibleView
};
