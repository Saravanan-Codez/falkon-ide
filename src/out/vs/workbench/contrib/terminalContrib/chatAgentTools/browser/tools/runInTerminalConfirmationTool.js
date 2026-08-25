import { Codicon } from "../../../../../../base/common/codicons.js";
import { escapeMarkdownSyntaxTokens, MarkdownString } from "../../../../../../base/common/htmlContent.js";
import { localize } from "../../../../../../nls.js";
import { ToolDataSource, ToolInvocationPresentation } from "../../../../chat/common/tools/languageModelToolsService.js";
import { RunInTerminalTool } from "./runInTerminalTool.js";
import { TerminalToolId } from "./toolIds.js";
const ConfirmTerminalCommandToolData = {
  id: TerminalToolId.ConfirmTerminalCommand,
  displayName: localize("confirmTerminalCommandTool.displayName", "Confirm Terminal Command"),
  modelDescription: [
    "This tool allows you to get explicit user confirmation for a terminal command without executing it.",
    "",
    "When to use:",
    "- When you need to verify user approval before executing a command",
    "- When you want to show command details, auto-approval status, and simplified versions to the user",
    "- When you need the user to review a potentially risky command",
    "",
    "The tool will:",
    "- Show the command with syntax highlighting",
    "- Display auto-approval status if enabled",
    "- Show simplified version of the command if applicable",
    "- Provide custom actions for creating auto-approval rules",
    "- Return approval/rejection status",
    "",
    "After confirmation, use a tool to actually execute the command."
  ].join("\n"),
  userDescription: localize("confirmTerminalCommandTool.userDescription", "Tool for confirming terminal commands"),
  source: ToolDataSource.Internal,
  icon: Codicon.shield,
  inputSchema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "The command to confirm with the user."
      },
      explanation: {
        type: "string",
        description: "A one-sentence description of what the command does. This will be shown to the user in the confirmation dialog."
      },
      goal: {
        type: "string",
        description: "A short description of the goal or purpose of the command."
      },
      mode: {
        type: "string",
        enum: ["sync", "async"],
        description: "Execution mode this command would use if run."
      },
      sandboxBypass: {
        type: "boolean",
        description: "Set to true when the command will run outside the sandbox. The confirmation makes the elevated risk clear to the user."
      },
      sandboxBypassReason: {
        type: "string",
        description: "A short explanation of why the command needs to run outside the sandbox. Only meaningful when sandboxBypass is true."
      }
    },
    required: [
      "command",
      "explanation",
      "goal",
      "mode"
    ]
  }
};
class ConfirmTerminalCommandTool extends RunInTerminalTool {
  get _enableCommandLineSandboxRewriting() {
    return false;
  }
  async prepareToolInvocation(context, token) {
    const preparedInvocation = await super.prepareToolInvocation(context, token);
    if (preparedInvocation) {
      preparedInvocation.presentation = ToolInvocationPresentation.HiddenAfterComplete;
      const params = context.parameters;
      if (params.sandboxBypass === true) {
        const title = localize("confirmTerminalCommandTool.sandboxBypass.title", "Run in terminal outside the sandbox?");
        const reason = typeof params.sandboxBypassReason === "string" ? escapeMarkdownSyntaxTokens(params.sandboxBypassReason.trim()) : "";
        const message = new MarkdownString(reason ? localize("confirmTerminalCommandTool.sandboxBypass.message.reason", "This command will run outside the sandbox.\n\nReason: {0}", reason) : localize("confirmTerminalCommandTool.sandboxBypass.message", "This command will run outside the sandbox."));
        if (preparedInvocation.confirmationMessages) {
          preparedInvocation.confirmationMessages.title = title;
          preparedInvocation.confirmationMessages.message = message;
        } else {
          preparedInvocation.confirmationMessages = { title, message };
        }
      }
    }
    return preparedInvocation;
  }
  async invoke(invocation, countTokens, progress, token) {
    return {
      content: [{
        kind: "text",
        value: "yes"
      }]
    };
  }
}
export {
  ConfirmTerminalCommandTool,
  ConfirmTerminalCommandToolData
};
