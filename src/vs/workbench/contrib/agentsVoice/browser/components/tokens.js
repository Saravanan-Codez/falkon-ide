import { isMacintosh } from "../../../../../base/common/platform.js";
const FONT_SIZE = {
  micro: "10px",
  // group headers, PTT key chip
  body: "12px",
  // primary text: status counts, session labels, transcripts, confirmations
  base: "13px",
  // widget root cascade
  iconSm: "14px",
  // small codicons (chevrons, close, row actions)
  iconMd: "16px"
  // mic icon
};
const FONT_WEIGHT = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700"
};
const COLOR = {
  // Match the waveform/glow colors from agentsVoiceWidget._view()
  userTranscript: "rgb(88,166,255)",
  // listening / user voice
  assistantTranscript: "rgb(163,113,247)"
  // speaking / assistant voice
};
function addKeyboardActivation(el) {
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      el.click();
    }
  });
}
function isSecondaryPointerGesture(e) {
  return e.button !== 0 || isMacintosh && e.ctrlKey;
}
export {
  COLOR,
  FONT_SIZE,
  FONT_WEIGHT,
  addKeyboardActivation,
  isSecondaryPointerGesture
};
