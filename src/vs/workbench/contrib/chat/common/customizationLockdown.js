import { PromptsType } from "./promptSyntax/promptTypes.js";
function isStrictPluginOnlyCustomizationEnabled(value) {
  return value === true;
}
function isPromptTypeBlocked(value, type) {
  switch (type) {
    case PromptsType.skill:
    case PromptsType.agent:
    case PromptsType.hook:
    case PromptsType.instructions:
      return isStrictPluginOnlyCustomizationEnabled(value);
    default:
      return false;
  }
}
export {
  isPromptTypeBlocked,
  isStrictPluginOnlyCustomizationEnabled
};
