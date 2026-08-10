import { Codicon } from "../../../../../../../base/common/codicons.js";
import { localize } from "../../../../../../../nls.js";
import { registerIcon } from "../../../../../../../platform/theme/common/iconRegistry.js";
import { isAutoLanguageModel } from "../../../../common/languageModels.js";
const copilotModelProviderIcon = registerIcon("chat-model-provider-copilot", Codicon.copilotCompact, localize("chatModelProviderCopilotIcon", "Icon for Copilot models."));
const openAIModelProviderIcon = registerIcon("chat-model-provider-openai", Codicon.openai, localize("chatModelProviderOpenAIIcon", "Icon for OpenAI models."));
const claudeModelProviderIcon = registerIcon("chat-model-provider-claude", Codicon.claude, localize("chatModelProviderClaudeIcon", "Icon for Claude models."));
const geminiModelProviderIcon = registerIcon("chat-model-provider-gemini", Codicon.googleGemini, localize("chatModelProviderGeminiIcon", "Icon for Gemini models."));
const kimiModelProviderIcon = registerIcon("chat-model-provider-kimi", Codicon.kimi, localize("chatModelProviderKimiIcon", "Icon for Kimi models."));
const microsoftModelProviderIcon = registerIcon("chat-model-provider-microsoft", Codicon.microsoft, localize("chatModelProviderMicrosoftIcon", "Icon for Microsoft models."));
const xAIModelProviderIcon = registerIcon("chat-model-provider-xai", Codicon.xai, localize("chatModelProviderXAIIcon", "Icon for xAI models."));
const genericModelProviderIcon = registerIcon("chat-model-provider-generic", Codicon.sparkle, localize("chatModelProviderGenericIcon", "Icon for other model providers."));
function getModelProviderIcon(model) {
  const identity = `${model.metadata.vendor} ${model.metadata.family} ${model.metadata.id} ${model.metadata.name}`.toLowerCase();
  if (identity.includes("grok") || identity.includes("xai")) {
    return xAIModelProviderIcon;
  }
  if (model.metadata.isBYOK) {
    return genericModelProviderIcon;
  }
  if (isAutoLanguageModel(model)) {
    return copilotModelProviderIcon;
  }
  if (identity.includes("claude") || identity.includes("anthropic")) {
    return claudeModelProviderIcon;
  }
  if (identity.includes("gemini") || identity.includes("google")) {
    return geminiModelProviderIcon;
  }
  if (identity.includes("kimi") || identity.includes("moonshot")) {
    return kimiModelProviderIcon;
  }
  if (identity.includes("microsoft") || /\bmai\b/.test(identity)) {
    return microsoftModelProviderIcon;
  }
  if (identity.includes("openai") || identity.includes("gpt") || identity.includes("codex") || /\bo[134]\b/.test(identity)) {
    return openAIModelProviderIcon;
  }
  const modelIdentity = `${model.metadata.id} ${model.metadata.name}`.toLowerCase();
  if (modelIdentity.includes("copilot")) {
    return copilotModelProviderIcon;
  }
  return genericModelProviderIcon;
}
function getModelPickerIcon(model) {
  return model.metadata.statusIcon ?? getModelProviderIcon(model);
}
export {
  getModelPickerIcon,
  getModelProviderIcon
};
