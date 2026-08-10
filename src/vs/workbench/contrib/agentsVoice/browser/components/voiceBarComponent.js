import * as dom from "../../../../../base/browser/dom.js";
import { localize } from "../../../../../nls.js";
import { FONT_SIZE, addKeyboardActivation } from "./tokens.js";
function createVoiceBar() {
  const container = dom.$("div");
  container.style.cssText = "display:flex;align-items:center;gap:6px;height:24px;padding:4px 2px;border-bottom:1px solid var(--vscode-panel-border);flex-shrink:0;";
  const dot = dom.$("span");
  dot.style.cssText = "width:7px;height:7px;border-radius:50%;flex-shrink:0;";
  const label = dom.$("span");
  label.style.cssText = `font-size:${FONT_SIZE.body};color:var(--vscode-foreground);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`;
  const waveform = dom.$("div");
  waveform.style.cssText = "display:flex;align-items:center;gap:2px;height:16px;flex:0 0 auto;";
  for (let i = 0; i < 6; i++) {
    const bar = dom.$("div");
    bar.style.cssText = "width:2px;height:3px;border-radius:1px;background:var(--vscode-editorWidget-background);transition:height 0.05s ease;";
    waveform.append(bar);
  }
  const stopBtn = dom.$("span.codicon.codicon-debug-stop");
  stopBtn.role = "button";
  stopBtn.tabIndex = 0;
  stopBtn.ariaLabel = localize("agentsVoice.stopSpeech", "Stop speech");
  stopBtn.style.cssText = `font-size:${FONT_SIZE.body};color:var(--vscode-editorError-foreground);cursor:pointer;-webkit-app-region:no-drag;padding:2px;`;
  addKeyboardActivation(stopBtn);
  container.append(dot, label, waveform, stopBtn);
  let currentStopHandler;
  return {
    element: container,
    update(props) {
      const isSpeaking = props.voiceState === "speaking";
      const isListening = props.voiceState === "listening";
      if (isSpeaking && props.speakingSession || !isSpeaking && !isListening) {
        container.style.display = "none";
        if (currentStopHandler) {
          stopBtn.removeEventListener("click", currentStopHandler);
          currentStopHandler = void 0;
        }
        return;
      }
      container.style.display = "flex";
      dot.style.background = isSpeaking ? "var(--vscode-charts-green)" : "var(--vscode-editorInfo-foreground)";
      label.textContent = isSpeaking ? props.speakingSessionLabel || localize("agentsVoice.speaking", "Speaking...") : localize("agentsVoice.listening", "Listening");
      stopBtn.style.display = isSpeaking ? "" : "none";
      if (isSpeaking) {
        if (currentStopHandler) {
          stopBtn.removeEventListener("click", currentStopHandler);
        }
        currentStopHandler = (e) => {
          e.preventDefault();
          e.stopPropagation();
          props.onStopSpeech();
        };
        stopBtn.addEventListener("click", currentStopHandler);
      } else if (currentStopHandler) {
        stopBtn.removeEventListener("click", currentStopHandler);
        currentStopHandler = void 0;
      }
    }
  };
}
export {
  createVoiceBar
};
