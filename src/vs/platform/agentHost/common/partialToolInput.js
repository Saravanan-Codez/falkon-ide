import { parse } from "../../../base/common/json.js";
const MAX_PARTIAL_TOOL_INPUT_PARSE_LENGTH = 4 * 1024;
let lastDisplayInput;
let lastDisplayValue;
function parsePartialToolInput(raw, maxLength) {
  const parsed = parse(maxLength === void 0 ? raw : raw.slice(0, maxLength));
  return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) && Object.keys(parsed).length > 0 ? { ...parsed } : void 0;
}
function parsePartialToolInputForDisplay(raw) {
  const input = raw.slice(0, MAX_PARTIAL_TOOL_INPUT_PARSE_LENGTH);
  if (input !== lastDisplayInput) {
    lastDisplayInput = input;
    lastDisplayValue = parsePartialToolInput(input);
  }
  return lastDisplayValue ? { ...lastDisplayValue } : void 0;
}
export {
  parsePartialToolInput,
  parsePartialToolInputForDisplay
};
