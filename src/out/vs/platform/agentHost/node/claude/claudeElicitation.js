import { isObject, isString } from "../../../../base/common/types.js";
import { vArray, vNumber, vObj, vOptionalProp, vString, vUnknown } from "../../../../base/common/validation.js";
import { ChatInputAnswerState, ChatInputAnswerValueKind, ChatInputQuestionKind, ChatInputRequestPurpose, ChatInputResponseKind } from "../../common/state/sessionState.js";
const vTitledOption = vObj({ const: vString(), title: vOptionalProp(vString()) });
const vElicitationField = vObj({
  type: vOptionalProp(vString()),
  title: vOptionalProp(vString()),
  description: vOptionalProp(vString()),
  format: vOptionalProp(vString()),
  default: vOptionalProp(vUnknown()),
  minimum: vOptionalProp(vNumber()),
  maximum: vOptionalProp(vNumber()),
  minLength: vOptionalProp(vNumber()),
  maxLength: vOptionalProp(vNumber()),
  minItems: vOptionalProp(vNumber()),
  maxItems: vOptionalProp(vNumber()),
  enum: vOptionalProp(vArray(vString())),
  enumNames: vOptionalProp(vArray(vString())),
  oneOf: vOptionalProp(vArray(vTitledOption)),
  items: vOptionalProp(vObj({
    enum: vOptionalProp(vArray(vString())),
    anyOf: vOptionalProp(vArray(vTitledOption))
  }))
});
function _assertElicitationFieldCoversSchema(field) {
  return field;
}
function parseElicitationSchema(schema) {
  if (!isObject(schema)) {
    return void 0;
  }
  const properties = schema.properties;
  if (!isObject(properties)) {
    return void 0;
  }
  const rawRequired = schema.required;
  const required = new Set(Array.isArray(rawRequired) ? rawRequired.filter(isString) : []);
  const fields = [];
  for (const [name, field] of Object.entries(properties)) {
    const { content, error } = vElicitationField.validate(field);
    if (!error) {
      fields.push([name, content]);
    }
  }
  return { fields, required };
}
function buildElicitationRequest(requestId, request) {
  if (request.mode === "url") {
    const result = { id: requestId, purpose: ChatInputRequestPurpose.Elicitation, message: request.message };
    if (request.url) {
      result.url = request.url;
    }
    return result;
  }
  const schema = parseElicitationSchema(request.requestedSchema);
  if (!schema || schema.fields.length === 0) {
    return { id: requestId, purpose: ChatInputRequestPurpose.Elicitation, message: request.message };
  }
  const questions = schema.fields.map(([name, field]) => elicitationFieldToQuestion(name, field, schema.required.has(name)));
  return { id: requestId, purpose: ChatInputRequestPurpose.Elicitation, message: request.message, questions };
}
function elicitationResultFromAnswers(request, response, answers) {
  if (response === ChatInputResponseKind.Decline) {
    return { action: "decline" };
  }
  if (response !== ChatInputResponseKind.Accept) {
    return { action: "cancel" };
  }
  const schema = request.mode === "url" ? void 0 : parseElicitationSchema(request.requestedSchema);
  if (!schema) {
    return { action: "accept" };
  }
  const entries = [];
  for (const [name, field] of schema.fields) {
    const answer = answers && Object.hasOwn(answers, name) ? answers[name] : void 0;
    const value = elicitationAnswerToValue(field, answer);
    if (value !== void 0) {
      entries.push([name, value]);
    }
  }
  return { action: "accept", content: Object.fromEntries(entries) };
}
function cancelledElicitationResult() {
  return { action: "cancel" };
}
function elicitationFieldToQuestion(id, field, required) {
  const base = { id, title: field.title ?? id, message: field.description ?? field.title ?? id, required };
  switch (field.type) {
    case "boolean":
      return { ...base, kind: ChatInputQuestionKind.Boolean, defaultValue: typeof field.default === "boolean" ? field.default : void 0 };
    case "number":
    case "integer":
      return {
        ...base,
        kind: field.type === "integer" ? ChatInputQuestionKind.Integer : ChatInputQuestionKind.Number,
        min: field.minimum,
        max: field.maximum,
        defaultValue: typeof field.default === "number" ? field.default : void 0
      };
    case "array":
      return {
        ...base,
        kind: ChatInputQuestionKind.MultiSelect,
        // MCP enum arrays are strict — only the declared options are valid —
        // but the workbench defaults an omitted `allowFreeformInput` to true.
        allowFreeformInput: false,
        options: field.items?.anyOf ? field.items.anyOf.map((o) => ({ id: o.const, label: o.title || o.const })) : (field.items?.enum ?? []).map((v) => ({ id: v, label: v })),
        min: field.minItems,
        max: field.maxItems
      };
    case "string":
    default:
      if (field.oneOf) {
        return {
          ...base,
          kind: ChatInputQuestionKind.SingleSelect,
          allowFreeformInput: false,
          options: field.oneOf.map((o) => ({ id: o.const, label: o.title || o.const }))
        };
      }
      if (field.enum) {
        const names = field.enumNames;
        return {
          ...base,
          kind: ChatInputQuestionKind.SingleSelect,
          allowFreeformInput: false,
          options: field.enum.map((v, i) => ({ id: v, label: names?.[i] || v }))
        };
      }
      return {
        ...base,
        kind: ChatInputQuestionKind.Text,
        format: field.format,
        min: field.minLength,
        max: field.maxLength,
        defaultValue: typeof field.default === "string" ? field.default : void 0
      };
  }
}
function elicitationAnswerToValue(field, answer) {
  if (!answer || answer.state === ChatInputAnswerState.Skipped) {
    return void 0;
  }
  const { value } = answer;
  switch (field.type) {
    case "boolean":
      if (value.kind === ChatInputAnswerValueKind.Boolean) {
        return value.value;
      }
      if (value.kind === ChatInputAnswerValueKind.Text) {
        if (value.value === "true") {
          return true;
        }
        if (value.value === "false") {
          return false;
        }
      }
      return void 0;
    case "number":
    case "integer": {
      const n = value.kind === ChatInputAnswerValueKind.Number ? value.value : value.kind === ChatInputAnswerValueKind.Text && value.value.trim() !== "" ? Number(value.value) : void 0;
      if (n === void 0 || !Number.isFinite(n)) {
        return void 0;
      }
      return field.type === "integer" ? Math.trunc(n) : n;
    }
    case "array":
      if (value.kind === ChatInputAnswerValueKind.SelectedMany) {
        return [...value.value, ...value.freeformValues ?? []];
      }
      if (value.kind === ChatInputAnswerValueKind.Selected) {
        return value.value ? [value.value, ...value.freeformValues ?? []] : [...value.freeformValues ?? []];
      }
      if (value.kind === ChatInputAnswerValueKind.Text) {
        return value.value ? [value.value] : [];
      }
      return void 0;
    case "string":
    default:
      if (value.kind === ChatInputAnswerValueKind.Text) {
        return value.value;
      }
      if (value.kind === ChatInputAnswerValueKind.Selected) {
        return value.value;
      }
      return void 0;
  }
}
export {
  buildElicitationRequest,
  cancelledElicitationResult,
  elicitationResultFromAnswers
};
