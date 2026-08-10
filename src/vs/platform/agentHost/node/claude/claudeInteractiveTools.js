import { localize } from "../../../../nls.js";
import { ConfirmationOptionKind, ChatInputAnswerState, ChatInputAnswerValueKind, ChatInputQuestionKind, ToolCallStatus } from "../../common/state/protocol/state.js";
import { getClaudeToolDisplayName } from "./claudeToolDisplay.js";
function buildExitPlanModeConfirmationState(input, toolUseID) {
  const plan = typeof input.plan === "string" ? input.plan : "";
  return {
    status: ToolCallStatus.PendingConfirmation,
    toolCallId: toolUseID,
    toolName: "ExitPlanMode",
    displayName: getClaudeToolDisplayName("ExitPlanMode"),
    invocationMessage: { markdown: plan },
    toolInput: JSON.stringify(input),
    confirmationTitle: localize("claude.exitPlanMode.title", "Ready to code?"),
    options: [
      { id: "approve", label: localize("claude.exitPlanMode.approve", "Approve"), kind: ConfirmationOptionKind.Approve },
      { id: "deny", label: localize("claude.exitPlanMode.deny", "Deny"), kind: ConfirmationOptionKind.Deny }
    ]
  };
}
function parseAskUserQuestionInput(input) {
  const askInput = input;
  if (!askInput.questions?.length) {
    return void 0;
  }
  return { questions: askInput.questions };
}
function askUserQuestionId(header, idx) {
  return header || `q-${idx}`;
}
function buildAskUserSessionInputQuestions(askInput) {
  return askInput.questions.map((q, idx) => {
    const opts = q.options.map((opt) => ({
      id: opt.label,
      label: opt.label,
      ...opt.description !== void 0 ? { description: opt.description } : {}
    }));
    const id = askUserQuestionId(q.header, idx);
    return q.multiSelect ? {
      id,
      kind: ChatInputQuestionKind.MultiSelect,
      title: q.header,
      message: q.question,
      options: opts,
      allowFreeformInput: q.allowFreeformInput ?? false
    } : {
      id,
      kind: ChatInputQuestionKind.SingleSelect,
      title: q.header,
      message: q.question,
      options: opts,
      allowFreeformInput: q.allowFreeformInput ?? false
    };
  });
}
function flattenAskUserAnswers(askInput, answers) {
  const result = {};
  for (let idx = 0; idx < askInput.questions.length; idx++) {
    const q = askInput.questions[idx];
    const a = answers[askUserQuestionId(q.header, idx)];
    if (!a || a.state === ChatInputAnswerState.Skipped) {
      continue;
    }
    const parts = [];
    const value = a.value;
    if (value.kind === ChatInputAnswerValueKind.Selected) {
      if (value.value) {
        parts.push(value.value);
      }
      if (value.freeformValues) {
        parts.push(...value.freeformValues);
      }
    } else if (value.kind === ChatInputAnswerValueKind.SelectedMany) {
      parts.push(...value.value);
      if (value.freeformValues) {
        parts.push(...value.freeformValues);
      }
    } else if (value.kind === ChatInputAnswerValueKind.Text) {
      parts.push(value.value);
    }
    if (parts.length > 0) {
      result[q.question] = parts.join(", ");
    }
  }
  return result;
}
export {
  buildAskUserSessionInputQuestions,
  buildExitPlanModeConfirmationState,
  flattenAskUserAnswers,
  parseAskUserQuestionInput
};
