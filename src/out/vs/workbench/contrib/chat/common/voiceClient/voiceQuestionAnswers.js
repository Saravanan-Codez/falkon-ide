import { findQuestionValidationFailure } from "../chatService/chatQuestionCarouselHelpers.js";
function resolveQuestionAnswers(questions, answers) {
  if (answers.length === 0) {
    return void 0;
  }
  const byId = new Map(questions.map((q) => [q.id, q]));
  const resolved = {};
  for (const answer of answers) {
    const question = byId.get(answer.question_id);
    if (!question || Object.hasOwn(resolved, question.id)) {
      return void 0;
    }
    const values = new Set((question.options ?? []).map((o) => o.value));
    const freeform = answer.freeform?.trim() || void 0;
    if (freeform !== void 0 && question.validation && findQuestionValidationFailure(freeform, question.validation)) {
      return void 0;
    }
    if (question.type === "text") {
      if (answer.value !== void 0 || answer.values !== void 0 || !freeform) {
        return void 0;
      }
      resolved[question.id] = freeform;
      continue;
    }
    if (freeform !== void 0 && question.allowFreeformInput === false) {
      return void 0;
    }
    if (question.type === "singleSelect") {
      if (answer.values !== void 0) {
        return void 0;
      }
      if (answer.value !== void 0) {
        if (!values.has(answer.value)) {
          return void 0;
        }
        resolved[question.id] = {
          selectedValue: answer.value,
          ...freeform ? { freeformValue: freeform } : {}
        };
        continue;
      }
      if (!freeform) {
        return void 0;
      }
      resolved[question.id] = { freeformValue: freeform };
      continue;
    }
    if (answer.value !== void 0) {
      return void 0;
    }
    const selected = answer.values ?? [];
    if (selected.some((value) => !values.has(value))) {
      return void 0;
    }
    if (selected.length === 0 && !freeform) {
      return void 0;
    }
    resolved[question.id] = {
      selectedValues: selected,
      ...freeform ? { freeformValue: freeform } : {}
    };
  }
  return resolved;
}
export {
  resolveQuestionAnswers
};
