import { escapeMarkdownSyntaxTokens, MarkdownString } from "../../../../../base/common/htmlContent.js";
import { localize } from "../../../../../nls.js";
import { DEFAULT_LOCAL_TRANSCRIPTION_MODEL } from "../../../../../platform/localTranscription/common/localTranscription.js";
import { DICTATION_MAI_MODEL_ID, DICTATION_MODEL_SETTING } from "./chatSpeechToTextService.js";
function createMicButtonHover(title, description) {
  const markdown = new MarkdownString("", { supportThemeIcons: true });
  markdown.appendMarkdown(`**${escapeMarkdownSyntaxTokens(title)}**`);
  markdown.appendMarkdown("\n\n");
  markdown.appendMarkdown(escapeMarkdownSyntaxTokens(description));
  return markdown;
}
function asHoverContent(title, description) {
  return { markdown: createMicButtonHover(title, description), markdownNotSupportedFallback: `${title}
${description}` };
}
function getDictationDescription(configurationService) {
  const modelId = configurationService.getValue(DICTATION_MODEL_SETTING)?.trim();
  if (modelId === DICTATION_MAI_MODEL_ID) {
    return localize("dictation.hover.cloud", "Types what you say into the input. Transcribes in the cloud with the MAI speech model.");
  }
  if (!modelId || modelId === DEFAULT_LOCAL_TRANSCRIPTION_MODEL) {
    return localize("dictation.hover.nemotronMultilingual", "Types what you say into the input. Transcribes on-device with the Nemotron 3.5 ASR multilingual model.");
  }
  return localize("dictation.hover.onDevice", "Types what you say into the input. Transcribes on-device with {0}.", modelId);
}
function getVoiceModeDescription() {
  return localize("voiceMode.hover", "Talk with the agent and hear it reply. Uses the online real-time voice model.");
}
function getDictationHoverMarkdown(title, configurationService) {
  return createMicButtonHover(title, getDictationDescription(configurationService));
}
function getDictationHoverContent(title, configurationService) {
  return asHoverContent(title, getDictationDescription(configurationService));
}
function getVoiceModeHoverContent(title) {
  return asHoverContent(title, getVoiceModeDescription());
}
export {
  getDictationHoverContent,
  getDictationHoverMarkdown,
  getVoiceModeHoverContent
};
