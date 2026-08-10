import { hasKey } from "../../../../base/common/types.js";
import { ChatInputAnswerState, ChatInputAnswerValueKind, ChatInputQuestionKind, ChatInputRequestPurpose, ChatInputResponseKind } from "../../common/state/sessionState.js";
function buildElicitationRequest(requestId, params) {
  if (params.mode === "url") {
    const request = { id: requestId, purpose: ChatInputRequestPurpose.Elicitation, message: params.message };
    if (params.url) {
      request.url = params.url;
    }
    return request;
  }
  if (params.mode !== "form") {
    return { id: requestId, purpose: ChatInputRequestPurpose.Elicitation, message: params.message };
  }
  const required = new Set(params.requestedSchema.required ?? []);
  const questions = [];
  for (const [name, field] of Object.entries(params.requestedSchema.properties)) {
    if (field) {
      questions.push(elicitationFieldToQuestion(name, field, required.has(name)));
    }
  }
  return questions.length > 0 ? { id: requestId, purpose: ChatInputRequestPurpose.Elicitation, message: params.message, questions } : { id: requestId, purpose: ChatInputRequestPurpose.Elicitation, message: params.message };
}
function elicitationResponseFromAnswers(params, response, answers) {
  if (response === ChatInputResponseKind.Decline) {
    return { action: "decline", content: null, _meta: null };
  }
  if (response !== ChatInputResponseKind.Accept) {
    return { action: "cancel", content: null, _meta: null };
  }
  if (params.mode !== "form") {
    return { action: "accept", content: null, _meta: null };
  }
  const content = {};
  for (const [name, field] of Object.entries(params.requestedSchema.properties)) {
    if (!field) {
      continue;
    }
    const value = elicitationAnswerToValue(answers?.[name]);
    if (value !== void 0) {
      content[name] = value;
    }
  }
  return { action: "accept", content, _meta: null };
}
function declinedElicitationResponse() {
  return { action: "decline", content: null, _meta: null };
}
function cancelledElicitationResponse() {
  return { action: "cancel", content: null, _meta: null };
}
function elicitationFieldToQuestion(id, field, required) {
  const base = { id, title: field.title, message: field.description ?? field.title ?? id, required };
  switch (field.type) {
    case "boolean":
      return { ...base, kind: ChatInputQuestionKind.Boolean, defaultValue: field.default };
    case "number":
    case "integer":
      return {
        ...base,
        kind: field.type === "integer" ? ChatInputQuestionKind.Integer : ChatInputQuestionKind.Number,
        min: field.minimum,
        max: field.maximum,
        defaultValue: field.default
      };
    case "array":
      return {
        ...base,
        kind: ChatInputQuestionKind.MultiSelect,
        options: hasKey(field.items, { anyOf: true }) ? field.items.anyOf.map((o) => ({ id: o.const, label: o.title || o.const })) : field.items.enum.map((v) => ({ id: v, label: v })),
        min: bigintToNumber(field.minItems),
        max: bigintToNumber(field.maxItems)
      };
    case "string":
      if (hasKey(field, { oneOf: true })) {
        return {
          ...base,
          kind: ChatInputQuestionKind.SingleSelect,
          options: field.oneOf.map((o) => ({ id: o.const, label: o.title || o.const }))
        };
      }
      if (hasKey(field, { enum: true })) {
        const names = field.enumNames;
        return {
          ...base,
          kind: ChatInputQuestionKind.SingleSelect,
          options: field.enum.map((v, i) => ({ id: v, label: names?.[i] || v }))
        };
      }
      return {
        ...base,
        kind: ChatInputQuestionKind.Text,
        format: field.format,
        min: field.minLength,
        max: field.maxLength,
        defaultValue: field.default
      };
  }
}
function elicitationAnswerToValue(answer) {
  if (!answer || answer.state === ChatInputAnswerState.Skipped) {
    return void 0;
  }
  const { value } = answer;
  switch (value.kind) {
    case ChatInputAnswerValueKind.Text:
      return value.value;
    case ChatInputAnswerValueKind.Number:
      return value.value;
    case ChatInputAnswerValueKind.Boolean:
      return value.value;
    case ChatInputAnswerValueKind.Selected:
      return value.value;
    case ChatInputAnswerValueKind.SelectedMany:
      return value.value;
  }
}
function bigintToNumber(value) {
  return value === null || value === void 0 ? void 0 : Number(value);
}
export {
  buildElicitationRequest,
  cancelledElicitationResponse,
  declinedElicitationResponse,
  elicitationResponseFromAnswers
};
