import { Color, HSLA } from "../../../../../base/common/color.js";
import { chartsOrange } from "../../../../../platform/theme/common/colors/chartsColors.js";
import { inputBackground } from "../../../../../platform/theme/common/colors/inputColors.js";
import { chatVoiceGlowBaseColor, chatVoiceListeningGlow, chatVoiceSpeakingGlow } from "../../common/widget/chatColors.js";
function isGlowingVoiceState(voiceState) {
  return voiceState === "listening" || voiceState === "speaking" || voiceState === "confirmation";
}
function readVoiceGlowIntensity(analyser, dataArray) {
  if (!analyser) {
    return 0.3;
  }
  if (!dataArray.value || dataArray.value.length !== analyser.frequencyBinCount) {
    dataArray.value = new Uint8Array(analyser.frequencyBinCount);
  }
  analyser.getByteFrequencyData(dataArray.value);
  let sum = 0;
  for (let i = 0; i < dataArray.value.length; i++) {
    sum += dataArray.value[i];
  }
  return Math.min(1, sum / dataArray.value.length / 80);
}
const VOICE_GLOW_SPEAKING_HUE_SHIFT = 80;
const VOICE_GLOW_FALLBACK = Color.fromHex("#58A6FF");
const VOICE_GLOW_CONFIRMATION_FALLBACK = Color.fromHex("#F0883E");
function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
function shiftHue(base, degrees, saturationMul = 1, lightnessAdd = 0) {
  const hsla = base.hsla;
  return new Color(new HSLA((hsla.h + degrees + 360) % 360, clamp01(hsla.s * saturationMul), clamp01(hsla.l + lightnessAdd), 1));
}
const DEFAULT_VOICE_GLOW_COLORS = {
  listening: VOICE_GLOW_FALLBACK,
  speaking: shiftHue(VOICE_GLOW_FALLBACK, VOICE_GLOW_SPEAKING_HUE_SHIFT),
  confirmation: VOICE_GLOW_CONFIRMATION_FALLBACK,
  background: Color.fromHex("#3C3C3C")
};
function resolveVoiceGlowColors(theme) {
  const base = theme.getColor(chatVoiceGlowBaseColor) ?? VOICE_GLOW_FALLBACK;
  return {
    listening: theme.getColor(chatVoiceListeningGlow) ?? base,
    speaking: theme.getColor(chatVoiceSpeakingGlow) ?? shiftHue(base, VOICE_GLOW_SPEAKING_HUE_SHIFT),
    confirmation: theme.getColor(chartsOrange) ?? VOICE_GLOW_CONFIRMATION_FALLBACK,
    background: theme.getColor(inputBackground) ?? DEFAULT_VOICE_GLOW_COLORS.background
  };
}
function voiceGlowStateColor(voiceState, colors) {
  return voiceState === "confirmation" ? colors.confirmation : voiceState === "speaking" ? colors.speaking : colors.listening;
}
const RIM_SAT_MIN = 70;
const RIM_SAT_MAX = 96;
const RIM_LIGHTNESS = {
  dark: { cool: 56, warm: 72, warning: 62 },
  light: { cool: 72, warm: 72, warning: 52 }
};
const RIM_HUE_SHIFT = { cool: -10, warm: 7, warning: 0 };
function resolveVoiceRimAccent(accent, mood, theme, background) {
  const { h, s } = accent.hsla;
  const tuned = new Color(new HSLA(
    (h + RIM_HUE_SHIFT[mood] + 360) % 360,
    Math.min(RIM_SAT_MAX, Math.max(RIM_SAT_MIN, s * 100)) / 100,
    RIM_LIGHTNESS[theme][mood] / 100,
    1
  ));
  const contrasted = (background ?? (theme === "light" ? Color.white : DEFAULT_VOICE_GLOW_COLORS.background)).ensureConstrast(tuned, 3);
  return {
    hue: contrasted.hsla.h,
    saturation: Math.round(contrasted.hsla.s * 100),
    lightness: Math.round(contrasted.hsla.l * 100)
  };
}
function computeVoiceMicGlowBoxShadow(voiceState, intensity, colors = DEFAULT_VOICE_GLOW_COLORS) {
  const { r, g, b } = voiceGlowStateColor(voiceState, colors).rgba;
  const shadowSpread = 3 + intensity * 8;
  const shadowAlpha = 0.2 + intensity * 0.45;
  return `0 0 ${shadowSpread}px rgba(${r},${g},${b},${shadowAlpha})`;
}
export {
  DEFAULT_VOICE_GLOW_COLORS,
  VOICE_GLOW_SPEAKING_HUE_SHIFT,
  computeVoiceMicGlowBoxShadow,
  isGlowingVoiceState,
  readVoiceGlowIntensity,
  resolveVoiceGlowColors,
  resolveVoiceRimAccent,
  voiceGlowStateColor
};
