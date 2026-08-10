import * as dom from "../../../../../base/browser/dom.js";
import { DomScrollableElement } from "../../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../base/common/observable.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { ScrollbarVisibility } from "../../../../../base/common/scrollable.js";
import { localize } from "../../../../../nls.js";
import { isDark } from "../../../../../platform/theme/common/theme.js";
import { isGlowingVoiceState, readVoiceGlowIntensity, resolveVoiceGlowColors } from "./voiceGlow.js";
import { createVoiceGlowController } from "./voiceGlowController.js";
import "./media/voiceInputDecorations.css";
function setupVoiceInputDecorations(services, options) {
  const { voiceSessionController, ttsPlaybackService, micCaptureService, configurationService, keybindingService, themeService, accessibilityService } = services;
  const { inputContainer: inputContainerEl, isActive } = options;
  const glowContainerEl = options.glowContainer ?? inputContainerEl;
  const isSurfaceOwner = (reader) => {
    if (options.isOwner) {
      return options.isOwner.read(reader);
    }
    const owner = options.currentVoiceInputResource?.read(reader);
    const current = options.getCurrentResource?.();
    return !!current && !!owner && isEqual(current, owner);
  };
  const store = new DisposableStore();
  const getPushToTalkKeybindingLabel = () => (keybindingService.lookupKeybinding("workbench.action.chat.voiceInputMode.holdToTalk") ?? keybindingService.lookupKeybinding("agentsVoice.pushToTalk"))?.getLabel();
  inputContainerEl.style.position = "relative";
  const transcriptOverlay = dom.$(".voice-transcript-overlay");
  const transcriptScrollable = store.add(new DomScrollableElement(transcriptOverlay, {
    horizontal: ScrollbarVisibility.Hidden,
    vertical: ScrollbarVisibility.Auto
  }));
  const transcriptOverlayNode = transcriptScrollable.getDomNode();
  transcriptOverlayNode.classList.add("voice-transcript-overlay-scrollable");
  transcriptOverlayNode.style.display = "none";
  inputContainerEl.append(transcriptOverlayNode);
  const win = dom.getWindow(glowContainerEl);
  let animFrameId;
  const glowDataArrayRef = { value: void 0 };
  let glowController;
  try {
    glowController = store.add(createVoiceGlowController(
      glowContainerEl,
      () => isDark(themeService.getColorTheme().type) ? "dark" : "light",
      () => resolveVoiceGlowColors(themeService.getColorTheme())
    ));
  } catch (error) {
    store.dispose();
    throw error;
  }
  store.add(themeService.onDidColorThemeChange(() => glowController.refreshTheme()));
  const startGlowAnimation = () => {
    if (animFrameId !== void 0) {
      return;
    }
    const animate = () => {
      animFrameId = win.requestAnimationFrame(animate);
      const voiceState = voiceSessionController.voiceState.get();
      const effectiveState = options.confirmationPending?.get() ? "confirmation" : voiceState;
      const analyser = ttsPlaybackService.analyserNode ?? (effectiveState === "listening" ? micCaptureService.analyserNode : null) ?? null;
      const intensity = readVoiceGlowIntensity(analyser, glowDataArrayRef);
      glowController.render(effectiveState, intensity, accessibilityService.isMotionReduced());
    };
    animFrameId = win.requestAnimationFrame(animate);
  };
  const stopGlowAnimation = () => {
    if (animFrameId !== void 0) {
      win.cancelAnimationFrame(animFrameId);
      animFrameId = void 0;
    }
    glowController.clear();
  };
  store.add(autorun((reader) => {
    const connected = voiceSessionController.isConnected.read(reader);
    const voiceState = voiceSessionController.voiceState.read(reader);
    const active = isActive.read(reader);
    const ownsVoice = isSurfaceOwner(reader);
    const confirmationPending = options.confirmationPending?.read(reader) ?? false;
    if (confirmationPending || connected && active && ownsVoice && isGlowingVoiceState(voiceState)) {
      startGlowAnimation();
    } else {
      stopGlowAnimation();
    }
  }));
  store.add({ dispose: () => stopGlowAnimation() });
  store.add(autorun((reader) => {
    const turns = voiceSessionController.transcriptTurns.read(reader);
    const connected = voiceSessionController.isConnected.read(reader);
    const voiceState = voiceSessionController.voiceState.read(reader);
    const active = isActive.read(reader);
    const showTranscript = configurationService.getValue("agents.voice.showTranscript") !== false;
    const visible = turns.filter((t) => t.text.length > 0 || t.speaker === "user" && t.isPartial);
    if (!connected || !active || !isSurfaceOwner(reader)) {
      transcriptOverlayNode.style.display = "none";
      transcriptOverlayNode.classList.remove("has-transcript");
      return;
    }
    if (visible.length === 0 || !showTranscript) {
      const handsFree = configurationService.getValue("agents.voice.handsFree") === true;
      if (!showTranscript && voiceState === "listening") {
        transcriptOverlayNode.style.display = "";
        transcriptOverlayNode.classList.remove("has-transcript");
        transcriptOverlay.replaceChildren();
        const listening = dom.$("span.listening");
        listening.textContent = localize("voiceMode.listening", "Listening...");
        transcriptOverlay.append(listening);
        transcriptScrollable.scanDomNode();
      } else if (!showTranscript && voiceState === "speaking") {
        transcriptOverlayNode.style.display = "";
        transcriptOverlayNode.classList.remove("has-transcript");
        transcriptOverlay.replaceChildren();
        const hint = dom.$("span.partial");
        const kbLabel = getPushToTalkKeybindingLabel();
        hint.textContent = kbLabel ? localize("voiceMode.bargeInHint", "Speak or use {0}", kbLabel) : localize("voiceMode.bargeInHintNoKb", "Speak to barge in");
        transcriptOverlay.append(hint);
        transcriptScrollable.scanDomNode();
      } else if (voiceState === "idle" && visible.length === 0 && showTranscript && !handsFree) {
        transcriptOverlayNode.style.display = "";
        transcriptOverlayNode.classList.remove("has-transcript");
        transcriptOverlay.replaceChildren();
        const hint = dom.$("span.partial");
        const kbLabel = getPushToTalkKeybindingLabel();
        hint.textContent = kbLabel ? localize("voiceMode.pttOrBargeInHint", "Press {0} to talk or barge in", kbLabel) : localize("voiceMode.clickMicOrBargeInHint", "Click voice mode to talk or barge in");
        transcriptOverlay.append(hint);
        transcriptScrollable.scanDomNode();
      } else {
        transcriptOverlayNode.style.display = "none";
        transcriptOverlayNode.classList.remove("has-transcript");
      }
      return;
    }
    transcriptOverlayNode.style.display = "";
    transcriptOverlayNode.classList.add("has-transcript");
    const lastTurn = visible[visible.length - 1];
    const contentElements = [];
    if (lastTurn.speaker === "user") {
      const span = dom.$("span");
      if (lastTurn.isPartial) {
        const committedPart = lastTurn.committed || "";
        const unsurePart = lastTurn.text.slice(committedPart.length);
        if (committedPart) {
          const c = dom.$("span.committed");
          c.textContent = committedPart;
          span.append(c);
        }
        const u = dom.$("span.partial");
        u.textContent = unsurePart + "\u2589";
        span.append(u);
      } else {
        span.className = "committed";
        span.textContent = lastTurn.text;
      }
      contentElements.push(span);
    } else {
      const div = dom.$("div.assistant-text");
      div.textContent = lastTurn.text;
      contentElements.push(div);
    }
    transcriptOverlay.replaceChildren(...contentElements);
    transcriptScrollable.scanDomNode();
    transcriptScrollable.setScrollPosition({ scrollTop: 0 });
  }));
  return store;
}
export {
  setupVoiceInputDecorations
};
