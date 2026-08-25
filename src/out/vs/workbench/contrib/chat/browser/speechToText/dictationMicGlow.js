import "./media/dictationMicGlow.css";
import { getWindow } from "../../../../../base/browser/dom.js";
import { Event } from "../../../../../base/common/event.js";
import { DisposableStore, MutableDisposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../base/common/observable.js";
import { isDark } from "../../../../../platform/theme/common/theme.js";
import { inputBackground } from "../../../../../platform/theme/common/colors/inputColors.js";
import { chatDictationActiveMicGlow } from "../../common/widget/chatColors.js";
import { readVoiceGlowIntensity } from "../voiceClient/voiceGlow.js";
import { createVoiceRimLight } from "../voiceClient/voiceGlowController.js";
import { ChatSpeechToTextState, isDictationActiveOnSurface } from "./chatSpeechToTextService.js";
function getDictationMicGlowPhase(state, isPreparingModel) {
  if (isPreparingModel || state === ChatSpeechToTextState.Idle) {
    return "off";
  }
  return state === ChatSpeechToTextState.Recording ? "live" : "settling";
}
function easeDictationMicLevel(current, target) {
  return current + (target - current) * (target > current ? 0.1 : 0.035);
}
function shapeDictationMicLevel(level) {
  return Math.min(1, Math.pow(Math.min(1, Math.max(0, level)), 0.7) * 1.15);
}
const RESTING_LEVEL = 0.12;
const REDUCED_MOTION_LEVEL = 0.45;
function resolveDictationMicAccent(theme) {
  return theme.getColor(chatDictationActiveMicGlow);
}
function setupDictationMicGlow(target, service, accessibilityService, isActive, themeService) {
  const store = new DisposableStore();
  const window = getWindow(target);
  const dataArray = { value: void 0 };
  const rim = store.add(new MutableDisposable());
  let animationFrame;
  let level = 0;
  const setLevel = (value, animate2) => {
    level = value;
    target.style.setProperty("--dictation-mic-level", value.toFixed(3));
    if (animate2) {
      rim.value?.drive(value);
    } else {
      rim.value?.driveStatic(value);
    }
  };
  const stopAnimation = () => {
    if (animationFrame !== void 0) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = void 0;
    }
  };
  const animate = () => {
    animationFrame = window.requestAnimationFrame(animate);
    const measured = service.state === ChatSpeechToTextState.Recording && service.analyserNode ? readVoiceGlowIntensity(service.analyserNode, dataArray) : RESTING_LEVEL;
    setLevel(easeDictationMicLevel(level, shapeDictationMicLevel(measured)), true);
  };
  const syncRim = (lit) => {
    if (!themeService) {
      return;
    }
    if (!lit) {
      rim.clear();
      return;
    }
    const theme = themeService.getColorTheme();
    const accent = resolveDictationMicAccent(theme);
    if (!accent) {
      rim.clear();
      return;
    }
    const kind = isDark(theme.type) ? "dark" : "light";
    const background = theme.getColor(inputBackground);
    if (rim.value) {
      rim.value.refresh(accent, kind, background);
    } else {
      rim.value = createVoiceRimLight(target, accent, kind, "cool", background);
    }
  };
  const update = (active = isActive?.get() !== false) => {
    active = active && isDictationActiveOnSurface(service, "chat");
    const phase = active ? getDictationMicGlowPhase(service.state, service.isPreparingModel) : "off";
    target.classList.toggle("dictation-mic-active", phase !== "off");
    target.classList.toggle("dictation-mic-settling", phase === "settling");
    syncRim(phase !== "off");
    if (phase === "off" || accessibilityService.isMotionReduced()) {
      stopAnimation();
      setLevel(phase === "off" ? 0 : REDUCED_MOTION_LEVEL, false);
      return;
    }
    if (animationFrame === void 0) {
      animationFrame = window.requestAnimationFrame(animate);
    }
  };
  store.add(Event.any(service.onDidChangeState, service.onDidChangePreparingModel)(() => update()));
  store.add(accessibilityService.onDidChangeReducedMotion(() => update()));
  if (themeService) {
    store.add(themeService.onDidColorThemeChange(() => update()));
  }
  if (isActive) {
    store.add(autorun((reader) => {
      update(isActive.read(reader));
    }));
  }
  store.add(toDisposable(() => {
    stopAnimation();
    target.classList.remove("dictation-mic-active", "dictation-mic-settling");
    target.style.removeProperty("--dictation-mic-level");
  }));
  update();
  return store;
}
export {
  easeDictationMicLevel,
  getDictationMicGlowPhase,
  resolveDictationMicAccent,
  setupDictationMicGlow,
  shapeDictationMicLevel
};
