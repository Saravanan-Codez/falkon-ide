import { ChatInputAnswerState, ChatInputAnswerValueKind, ChatInputQuestionKind, ChatInputRequestPurpose, ChatInputResponseKind } from "../../common/state/sessionState.js";
function buildUserInputRequest(requestId, questions) {
  return {
    id: requestId,
    purpose: ChatInputRequestPurpose.AskUser,
    questions: questions.map((q) => {
      if (q.options && q.options.length > 0) {
        return {
          kind: ChatInputQuestionKind.SingleSelect,
          id: q.id,
          title: q.header,
          message: q.question,
          required: true,
          options: q.options.map((o) => ({ id: o.label, label: o.label, description: o.description || void 0 })),
          allowFreeformInput: q.isOther
        };
      }
      return {
        kind: ChatInputQuestionKind.Text,
        id: q.id,
        title: q.header,
        message: q.question,
        required: true
      };
    })
  };
}
function userInputResponseFromAnswers(questions, response, answers) {
  const out = {};
  for (const q of questions) {
    out[q.id] = { answers: answerStrings(answers?.[q.id], response) };
  }
  return { answers: out };
}
function emptyUserInputResponse(questions) {
  const out = {};
  for (const q of questions) {
    out[q.id] = { answers: [] };
  }
  return { answers: out };
}
function answerStrings(answer, response) {
  if (response !== ChatInputResponseKind.Accept || !answer || answer.state === ChatInputAnswerState.Skipped) {
    return [];
  }
  const { value } = answer;
  switch (value.kind) {
    case ChatInputAnswerValueKind.Text:
      return [value.value];
    case ChatInputAnswerValueKind.Number:
    case ChatInputAnswerValueKind.Boolean:
      return [String(value.value)];
    case ChatInputAnswerValueKind.Selected:
      return [value.value, ...value.freeformValues ?? []];
    case ChatInputAnswerValueKind.SelectedMany:
      return [...value.value, ...value.freeformValues ?? []];
  }
}
export {
  answerStrings,
  buildUserInputRequest,
  emptyUserInputResponse,
  userInputResponseFromAnswers
};
