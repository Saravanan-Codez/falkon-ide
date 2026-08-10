import { createDecorator } from "../../../../../platform/instantiation/common/instantiation.js";
async function computeCombinationKey(toolId, parameters) {
  const input = toolId + ":" + JSON.stringify(parameters);
  const encoded = new TextEncoder().encode(input);
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashHex = Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return toolId + ":combination:" + hashHex;
}
const ILanguageModelToolsConfirmationService = createDecorator("ILanguageModelToolsConfirmationService");
export {
  ILanguageModelToolsConfirmationService,
  computeCombinationKey
};
