import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { AGENTS_VOICE_CONNECTED, AGENTS_VOICE_ENABLED } from "../../../agentsVoice/common/agentsVoice.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
const VoiceModeButtonShown = ContextKeyExpr.notEquals("config.agents.voice.showButton", false);
const DictationConfigured = ContextKeyExpr.and(ChatContextKeys.enabled, ContextKeyExpr.has(ChatContextKeys.speechToTextConfigured.key));
const DictationButtonShown = ContextKeyExpr.notEquals("config.dictation.showButton", false);
const HandsFreeDisabled = ContextKeyExpr.equals("config.agents.voice.handsFree", false);
const VisibleVoiceMode = ContextKeyExpr.and(AGENTS_VOICE_ENABLED, VoiceModeButtonShown);
const VisibleDictation = ContextKeyExpr.and(DictationConfigured, DictationButtonShown);
const SegmentedVoiceInputModePillActive = ContextKeyExpr.and(
  VisibleVoiceMode,
  ContextKeyExpr.or(
    VisibleDictation,
    ContextKeyExpr.and(HandsFreeDisabled, AGENTS_VOICE_CONNECTED)
  )
);
const SegmentedVoiceInputModePillInactive = SegmentedVoiceInputModePillActive.negate();
export {
  SegmentedVoiceInputModePillActive,
  SegmentedVoiceInputModePillInactive
};
