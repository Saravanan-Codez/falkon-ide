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
import { timeout } from "../../../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../../../base/common/cancellation.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { appendEscapedMarkdownInlineCode, createCommandUri, isMarkdownString, MarkdownString } from "../../../../../../base/common/htmlContent.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../../nls.js";
import { CommandsRegistry } from "../../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { hasKey } from "../../../../../../base/common/types.js";
import { IChatWidgetService } from "../../../../chat/browser/chat.js";
import { IChatService } from "../../../../chat/common/chatService/chatService.js";
import { ToolDataSource } from "../../../../chat/common/tools/languageModelToolsService.js";
import { ITerminalChatService, ITerminalService } from "../../../../terminal/browser/terminal.js";
import { getOutput } from "../outputHelpers.js";
import { buildCommandDisplayText, isMultilineCommand, normalizeCommandForExecution } from "../runInTerminalHelpers.js";
import { RunInTerminalTool } from "./runInTerminalTool.js";
import { isSessionAutoApproveLevel } from "./terminalToolAutoApprove.js";
import { TerminalToolId } from "./toolIds.js";
const SendToTerminalToolData = {
  id: TerminalToolId.SendToTerminal,
  toolReferenceName: "sendToTerminal",
  displayName: localize("sendToTerminalTool.displayName", "Send to Terminal"),
  modelDescription: `Send input text to an active terminal execution (identified by the \`id\` returned from ${TerminalToolId.RunInTerminal}). The 'command' field may be empty or whitespace to press Enter (useful for interactive prompts). By default, returns the last 20 lines of terminal output captured shortly after sending. Set 'waitForOutput' to true for interactive programs (games, REPLs, etc.) to wait until the terminal becomes idle before returning output \u2014 this gives you the program's response to your input.`,
  icon: Codicon.terminal,
  source: ToolDataSource.Internal,
  inputSchema: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: `The ID of an active terminal execution to send a command to (returned by ${TerminalToolId.RunInTerminal} for async executions, or for sync executions that timed out and were moved to the background).`,
        pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
      },
      command: {
        type: "string",
        description: "The input text to send to the terminal. The text is sent followed by Enter. Provide an empty or whitespace string to send just Enter (for interactive prompts)."
      },
      waitForOutput: {
        type: "boolean",
        description: "When true, waits for the terminal to become idle (no new output for a short period) before returning, instead of returning immediately. Use this for interactive programs where you need to see the full response to your input. Defaults to false."
      }
    },
    required: [
      "id",
      "command"
    ]
  }
};
function isCancelSignal(command) {
  return /^[\u0003\u0004\u001c]$/.test(command.trim());
}
const FocusTerminalByIdCommandId = "workbench.action.terminal.chat.focusTerminalById";
CommandsRegistry.registerCommand(FocusTerminalByIdCommandId, async (accessor, instanceId) => {
  const terminalService = accessor.get(ITerminalService);
  const instance = terminalService.getInstanceFromId(instanceId);
  if (instance) {
    terminalService.setActiveInstance(instance);
    await terminalService.revealActiveTerminal();
    instance.focus();
  }
});
const FocusTerminalByExecutionIdCommandId = "workbench.action.terminal.chat.focusTerminalByExecutionId";
CommandsRegistry.registerCommand(FocusTerminalByExecutionIdCommandId, async (accessor, executionId) => {
  const execution = RunInTerminalTool.getExecution(executionId);
  if (execution) {
    const terminalService = accessor.get(ITerminalService);
    terminalService.setActiveInstance(execution.instance);
    await terminalService.revealActiveTerminal();
    execution.instance.focus();
  }
});
let SendToTerminalTool = class extends Disposable {
  constructor(_configurationService, _chatService, _chatWidgetService, _terminalChatService) {
    super();
    this._configurationService = _configurationService;
    this._chatService = _chatService;
    this._chatWidgetService = _chatWidgetService;
    this._terminalChatService = _terminalChatService;
  }
  async prepareToolInvocation(context, _token) {
    const args = context.parameters;
    const isEmptyInput = !args.command || !args.command.trim();
    const terminalLabel = this._getTerminalLabel(args);
    const invocationMessage = new MarkdownString();
    const pastTenseMessage = new MarkdownString();
    const questionText = this._getQuestionContextForTerminal(context.chatSessionResource, args);
    if (isEmptyInput) {
      invocationMessage.appendMarkdown(localize("send.progressive.enter", "Pressing `Enter` in terminal"));
      pastTenseMessage.appendMarkdown(localize("send.past.enter", "Pressed `Enter` in terminal"));
    } else {
      const displayCommand = buildCommandDisplayText(args.command);
      const safeInlineCode = appendEscapedMarkdownInlineCode(displayCommand);
      invocationMessage.appendMarkdown(localize("send.progressive", "Sending {0} to terminal", safeInlineCode));
      pastTenseMessage.appendMarkdown(localize("send.past", "Sent {0} to terminal", safeInlineCode));
    }
    if (questionText) {
      const replyPrefix = ` (${localize("send.replyingTo", "replying to: ")}`;
      invocationMessage.appendMarkdown(replyPrefix);
      invocationMessage.appendText(questionText);
      invocationMessage.appendMarkdown(")");
      pastTenseMessage.appendMarkdown(replyPrefix);
      pastTenseMessage.appendText(questionText);
      pastTenseMessage.appendMarkdown(")");
    }
    const instanceId = this._getTerminalInstanceId(args);
    const confirmationMessage = new MarkdownString("", { isTrusted: { enabledCommands: [FocusTerminalByIdCommandId] } });
    const safeTerminalLabel = appendEscapedMarkdownInlineCode(terminalLabel);
    const baseMessage = isEmptyInput ? localize("send.confirm.message.enter", "Press `Enter` in terminal {0}", safeTerminalLabel) : localize("send.confirm.message", "Run {0} in terminal {1}", appendEscapedMarkdownInlineCode(buildCommandDisplayText(args.command)), safeTerminalLabel);
    if (instanceId !== void 0) {
      const focusUri = createCommandUri(FocusTerminalByIdCommandId, instanceId);
      confirmationMessage.appendMarkdown(`${baseMessage} \u2014 [${localize("focusTerminal", "Focus Terminal")}](${focusUri})`);
    } else {
      confirmationMessage.appendMarkdown(baseMessage);
    }
    const chatSessionResource = context.chatSessionResource;
    const isSessionAutoApproved = chatSessionResource && (isSessionAutoApproveLevel(chatSessionResource, this._configurationService, this._chatWidgetService, this._chatService) || this._terminalChatService.hasChatSessionAutoApproval(chatSessionResource));
    const isAnsweringQuestion = questionText !== void 0;
    const shouldShowConfirmation = !isSessionAutoApproved && !isAnsweringQuestion || context.forceConfirmationReason !== void 0;
    const confirmationMessages = shouldShowConfirmation ? {
      title: localize("send.confirm.title", "Send to Terminal"),
      message: confirmationMessage,
      allowAutoConfirm: void 0
    } : void 0;
    return {
      invocationMessage,
      pastTenseMessage,
      confirmationMessages
    };
  }
  /**
   * Returns a human-friendly label for the target terminal, using the
   * terminal instance title (which reflects the running process) instead
   * of the raw UUID or numeric id.
   */
  _getTerminalLabel(args) {
    if (args.id) {
      const execution = RunInTerminalTool.getExecution(args.id);
      if (execution) {
        return execution.instance.title;
      }
    }
    return args.id ?? "";
  }
  /**
   * Returns the numeric terminal instanceId for the target terminal, used
   * to build command URIs for the "Focus Terminal" link.
   */
  _getTerminalInstanceId(args) {
    if (args.id) {
      const execution = RunInTerminalTool.getExecution(args.id);
      if (execution) {
        return execution.instance.instanceId;
      }
    }
    return void 0;
  }
  /**
   * Searches the current session's responses for the most recent question
   * carousel associated with the target terminal, then uses positional
   * matching to return the specific question that this send_to_terminal
   * call is answering.
   *
   * When a carousel contains multiple questions, the model calls
   * send_to_terminal once per answer in order. This method counts prior
   * send_to_terminal invocations since the carousel to determine the
   * current question index, then verifies the command matches the answer
   * at that position.
   */
  _getQuestionContextForTerminal(chatSessionResource, args) {
    if (!chatSessionResource) {
      return void 0;
    }
    const model = this._chatService.getSession(chatSessionResource);
    if (!model) {
      return void 0;
    }
    if (!args.id) {
      return void 0;
    }
    const commandText = args.command?.trim();
    const requests = model.getRequests();
    for (let i = requests.length - 1; i >= 0; i--) {
      const response = requests[i].response;
      if (!response) {
        continue;
      }
      const parts = response.response.value;
      let carouselIndex = -1;
      let carousel;
      for (let j = parts.length - 1; j >= 0; j--) {
        const part = parts[j];
        if (part.kind === "questionCarousel") {
          const candidate = part;
          if (!candidate.terminalId || candidate.questions.length === 0) {
            continue;
          }
          if (candidate.terminalId === args.id) {
            carouselIndex = j;
            carousel = candidate;
            break;
          }
        }
      }
      if (!carousel || carouselIndex === -1) {
        continue;
      }
      let sendCount = 0;
      for (let j = carouselIndex + 1; j < parts.length; j++) {
        if (parts[j].kind === "toolInvocation" && parts[j].toolId === TerminalToolId.SendToTerminal) {
          sendCount++;
        }
      }
      const questionIndex = sendCount;
      if (questionIndex >= carousel.questions.length) {
        return void 0;
      }
      const question = carousel.questions[questionIndex];
      if (carousel.data) {
        const answer = carousel.data[question.id];
        if (this._answerMatchesCommand(answer, commandText)) {
          return this._getQuestionText(question);
        }
      }
      return void 0;
    }
    return void 0;
  }
  _getQuestionText(question) {
    const text = question.message ?? question.title;
    return isMarkdownString(text) ? text.value : text;
  }
  /**
   * Checks whether a carousel answer value matches the command text being sent.
   * An empty/unprovided answer matches an empty command (i.e. pressing Enter to
   * accept the default), since that is the expected way to skip a question.
   */
  _answerMatchesCommand(answer, commandText) {
    if (answer === void 0) {
      return commandText === "";
    }
    if (typeof answer === "string") {
      return answer.trim() === commandText;
    }
    if (hasKey(answer, { selectedValues: true })) {
      const multi = answer;
      if (multi.selectedValues.some((v) => v.trim() === commandText)) {
        return true;
      }
      if (multi.freeformValue?.trim() === commandText) {
        return true;
      }
      return commandText === "" && multi.selectedValues.length === 0 && !multi.freeformValue?.trim();
    }
    if (hasKey(answer, { selectedValue: true })) {
      const single = answer;
      if (single.selectedValue?.trim() === commandText || single.freeformValue?.trim() === commandText) {
        return true;
      }
      return commandText === "" && !single.selectedValue?.trim() && !single.freeformValue?.trim();
    }
    return false;
  }
  async invoke(invocation, _countTokens, _progress, token) {
    const args = invocation.parameters;
    if (!args.id) {
      return {
        content: [{
          kind: "text",
          value: `Error: 'id' (the active terminal execution UUID returned by ${TerminalToolId.RunInTerminal}) must be provided.`
        }]
      };
    }
    const execution = RunInTerminalTool.getExecution(args.id);
    if (!execution) {
      return {
        content: [{
          kind: "text",
          value: `Error: No active terminal execution found with ID ${args.id}. The terminal may have already been killed or the ID is invalid. The ID must be the exact value returned by ${TerminalToolId.RunInTerminal}.`
        }]
      };
    }
    const startMarker = execution.instance.registerMarker?.();
    if (isMultilineCommand(args.command)) {
      await execution.instance.sendText(args.command, true, true);
    } else {
      await execution.instance.sendText(normalizeCommandForExecution(args.command), true);
    }
    let recentOutput;
    if (args.waitForOutput) {
      recentOutput = await this._waitForIdleOutput(execution, startMarker, token);
    } else {
      await timeout(2e3, token);
      recentOutput = getOutput(execution.instance, startMarker ?? void 0, { lastNLines: 20 });
    }
    const steering = isCancelSignal(args.command) ? `

Note: The input you sent was a cancel signal (Ctrl-C / Ctrl-D / Ctrl-\\). The previously running command was interrupted, not completed. This is not a signal to end the turn \u2014 if you intend to run a recovery or follow-up command, issue it now in this same turn. Call ${TerminalToolId.GetTerminalOutput} first if you need to verify the shell is back at a prompt.` : "";
    return {
      content: [{
        kind: "text",
        value: `Successfully sent command to terminal ${args.id}.${recentOutput ? `

Terminal output:
${recentOutput}` : ""}${steering}`
      }]
    };
  }
  /**
   * Waits for the terminal to become idle (no new output for a sustained period)
   * and returns the output produced since the given marker.
   */
  async _waitForIdleOutput(execution, startMarker, token) {
    const maxWaitMs = 3e4;
    const idleThresholdMs = 2e3;
    const pollIntervalMs = 500;
    let waited = 0;
    let lastDataTime = Date.now();
    const cts = new CancellationTokenSource(token);
    const dataListener = execution.instance.onData(() => {
      lastDataTime = Date.now();
    });
    try {
      while (!cts.token.isCancellationRequested && waited < maxWaitMs) {
        await timeout(pollIntervalMs, cts.token);
        waited += pollIntervalMs;
        const timeSinceLastData = Date.now() - lastDataTime;
        if (timeSinceLastData >= idleThresholdMs) {
          break;
        }
      }
    } finally {
      dataListener.dispose();
      cts.dispose();
    }
    return getOutput(execution.instance, startMarker ?? void 0);
  }
};
SendToTerminalTool = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IChatService),
  __decorateParam(2, IChatWidgetService),
  __decorateParam(3, ITerminalChatService)
], SendToTerminalTool);
export {
  SendToTerminalTool,
  SendToTerminalToolData
};
