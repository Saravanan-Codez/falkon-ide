import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { ContextKeyExpr, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { ChatContextKeys } from "../../chat/common/actions/chatContextKeys.js";
import "./agentsVoiceColors.js";
const AGENTS_VOICE_CONNECTED = new RawContextKey("agentsVoiceConnected", false);
const AGENTS_VOICE_CONNECTING = new RawContextKey("agentsVoiceConnecting", false);
const AGENTS_VOICE_LISTENING = new RawContextKey("agentsVoiceListening", false);
const AGENTS_VOICE_ENTITLED = new RawContextKey("agentsVoiceEntitled", false);
const AGENTS_VOICE_ENABLED = ContextKeyExpr.and(
  ChatContextKeys.enabled,
  ContextKeyExpr.equals("config.agents.voice.enabled", true),
  AGENTS_VOICE_ENTITLED
);
var AgentsVoiceSettingId = /* @__PURE__ */ ((AgentsVoiceSettingId2) => {
  AgentsVoiceSettingId2["ShowButton"] = "agents.voice.showButton";
  return AgentsVoiceSettingId2;
})(AgentsVoiceSettingId || {});
const AGENTS_VOICE_WINDOW_DEFAULT_WIDTH = 400;
const AGENTS_VOICE_WINDOW_DEFAULT_HEIGHT = 70;
var AgentsVoiceStorageKeys = /* @__PURE__ */ ((AgentsVoiceStorageKeys2) => {
  AgentsVoiceStorageKeys2["WindowOpen"] = "agentsVoice.windowOpen";
  AgentsVoiceStorageKeys2["WindowBounds"] = "agentsVoice.windowBounds";
  AgentsVoiceStorageKeys2["TranscriptIndex"] = "agentsVoice.transcriptIndex";
  AgentsVoiceStorageKeys2["OnboardingCompleted"] = "agentsVoice.onboardingCompleted";
  AgentsVoiceStorageKeys2["IntroBannerShown"] = "agentsVoice.introBannerShown";
  AgentsVoiceStorageKeys2["MicrophoneDevice"] = "agentsVoice.microphoneDevice";
  return AgentsVoiceStorageKeys2;
})(AgentsVoiceStorageKeys || {});
const IAgentsVoiceWindowService = createDecorator("agentsVoiceWindowService");
export {
  AGENTS_VOICE_CONNECTED,
  AGENTS_VOICE_CONNECTING,
  AGENTS_VOICE_ENABLED,
  AGENTS_VOICE_ENTITLED,
  AGENTS_VOICE_LISTENING,
  AGENTS_VOICE_WINDOW_DEFAULT_HEIGHT,
  AGENTS_VOICE_WINDOW_DEFAULT_WIDTH,
  AgentsVoiceSettingId,
  AgentsVoiceStorageKeys,
  IAgentsVoiceWindowService
};
