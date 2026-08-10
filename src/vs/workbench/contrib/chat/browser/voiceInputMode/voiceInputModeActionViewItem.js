var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import * as dom from "../../../../../base/browser/dom.js";
import "../../../../../base/browser/ui/segmentedIconToggle/segmentedIconToggle.css";
import "./media/voiceInputMode.css";
import { getActiveWindow, getWindow } from "../../../../../base/browser/dom.js";
import { getDefaultHoverDelegate } from "../../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { BaseActionViewItem } from "../../../../../base/browser/ui/actionbar/actionViewItems.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { autorun, observableFromEvent } from "../../../../../base/common/observable.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { URI } from "../../../../../base/common/uri.js";
import { localize, localize2 } from "../../../../../nls.js";
import { Action2, MenuId, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { IsDevelopmentContext } from "../../../../../platform/contextkey/common/contextkeys.js";
import { IAccessibilityService } from "../../../../../platform/accessibility/common/accessibility.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { resolveVoiceGlowColors } from "../voiceClient/voiceGlow.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { ChatAgentLocation } from "../../common/constants.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
import { IVoiceSessionController } from "../voiceClient/voiceSessionController.js";
import { IMicCaptureService } from "../voiceClient/micCaptureService.js";
import { ITtsPlaybackService } from "../voiceClient/ttsPlaybackService.js";
import { ChatSpeechToTextState, IChatSpeechToTextService, isDictationActiveOnSurface } from "../speechToText/chatSpeechToTextService.js";
import { setupDictationMicGlow } from "../speechToText/dictationMicGlow.js";
import { DictationDownloadRing, getDictationPreparingLabel } from "../speechToText/dictationDownloadRing.js";
import { getDictationHoverContent, getVoiceModeHoverContent } from "../speechToText/micButtonHovers.js";
import { addMicButtonContextMenuListener, getDictationContextMenuActions, getVoiceModeContextMenuActions } from "../speechToText/micButtonMenuActions.js";
import { IVoiceInputModeService } from "./voiceInputMode.js";
import { SegmentedVoiceInputModePillActive } from "./voiceInputModeContextKeys.js";
import { AGENTS_VOICE_ENABLED } from "../../../agentsVoice/common/agentsVoice.js";
const DICTATION_TOGGLE_COMMAND_ID = "workbench.action.chat.toggleSpeechToText";
const VOICE_START_COMMAND_ID = "agentsVoice.startVoiceInChat";
async function retargetVoiceToCurrentSession(commandService, controller, window) {
  const currentSession = await commandService.executeCommand("_chat.voice.getCurrentSession");
  if (!currentSession) {
    return false;
  }
  try {
    const resource = URI.parse(currentSession);
    if (resource.scheme === "sessions-voice") {
      controller.takeDraftInputOwnership(window);
    } else {
      controller.takeSessionInputOwnership(resource, window);
    }
    return true;
  } catch {
    return false;
  }
}
const WAVEFORM_BAR_COUNT = 5;
const WAVEFORM_BAR_MIN_HEIGHT = 2;
const WAVEFORM_BAR_MAX_HEIGHT = 10;
class ChatVoiceInputModeAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.voiceInputMode";
  }
  constructor() {
    super({
      id: ChatVoiceInputModeAction.ID,
      title: localize2("voiceInputMode", "Voice Input Mode"),
      icon: Codicon.mic,
      precondition: SegmentedVoiceInputModePillActive,
      menu: {
        id: MenuId.ChatExecute,
        when: ContextKeyExpr.and(
          SegmentedVoiceInputModePillActive,
          ChatContextKeys.location.isEqualTo(ChatAgentLocation.Chat),
          ChatContextKeys.currentlyEditing.negate()
        ),
        group: "navigation",
        order: -11
      }
    });
  }
  run(_accessor) {
  }
}
class ChatVoiceInputModeToggleListenAction extends Action2 {
  constructor() {
    super({
      id: ChatVoiceInputModeToggleListenAction.ID,
      title: localize2("voiceInputMode.holdToTalk", "Voice Mode: Hold to Talk"),
      // A hold-only action cannot be invoked safely from the Command Palette: a
      // mouse click produces no key-up (leaving the turn pending) and a keyboard
      // invocation creates an immediate empty turn. Keep it keybinding-only.
      f1: false,
      precondition: AGENTS_VOICE_ENABLED,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Space,
        when: ContextKeyExpr.and(
          AGENTS_VOICE_ENABLED,
          ChatContextKeys.inChatInput
        )
      }
    });
    this._holdActive = false;
  }
  static {
    this.ID = "workbench.action.chat.voiceInputMode.holdToTalk";
  }
  async run(accessor) {
    if (this._holdActive) {
      return;
    }
    const controller = accessor.get(IVoiceSessionController);
    const keybindingService = accessor.get(IKeybindingService);
    const speechToText = accessor.get(IChatSpeechToTextService);
    if (speechToText.state !== ChatSpeechToTextState.Idle) {
      speechToText.cancel();
    }
    const holdMode = keybindingService.enableKeybindingHoldMode(ChatVoiceInputModeToggleListenAction.ID);
    const win = getActiveWindow();
    let keyReleased = false;
    const releaseListener = dom.addDisposableListener(win, dom.EventType.KEY_UP, () => {
      keyReleased = true;
    });
    this._holdActive = true;
    try {
      if (!controller.retainOmniInputOwnershipForBargeIn(win)) {
        await retargetVoiceToCurrentSession(accessor.get(ICommandService), controller, win);
      }
      if (!controller.isConnected.get() && !controller.isConnecting.get()) {
        await controller.connect(win);
      }
      if (keyReleased) {
        return;
      }
      if (controller.isConnected.get()) {
        controller.pttDown("explicit", true);
        if (holdMode) {
          await holdMode;
        } else if (!keyReleased) {
          await new Promise((resolve) => {
            const l = dom.addDisposableListener(win, dom.EventType.KEY_UP, () => {
              l.dispose();
              resolve();
            });
          });
        }
        controller.pttUp("explicit", true);
      }
    } finally {
      releaseListener.dispose();
      this._holdActive = false;
    }
  }
}
const SIMULATE_STATES = [
  { id: "off", label: "Off (Disconnected)", state: "off" },
  { id: "connecting", label: "Connecting", state: "connecting" },
  { id: "idle", label: "Connected (Idle)", state: "idle" },
  { id: "listening", label: "Listening", state: "listening" },
  { id: "speaking", label: "Speaking", state: "speaking" },
  { id: "dictating", label: "Dictating", state: "dictating" }
];
function registerVoiceInputModeSimulateActions() {
  const VERSIONS = [
    { version: "handsFree", label: "v4 \u2014 Hands-Free (Auto-Listen)" },
    { version: "keyboardHold", label: "v1 \u2014 Keyboard Hold-to-Talk (Walkie-Talkie)" },
    { version: "buttonHold", label: "v2 \u2014 Button Hold-to-Talk" },
    { version: "clickToggle", label: "v3 \u2014 Button Click-to-Toggle Listening" }
  ];
  for (const { version, label } of VERSIONS) {
    registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `workbench.action.chat.voiceInputMode.simulate.walkthrough.${version}`,
          title: { value: `Voice Input Mode: Prototype Walkthrough \u2014 ${label}`, original: `Voice Input Mode: Prototype Walkthrough \u2014 ${label}` },
          category: { value: "Developer", original: "Developer" },
          precondition: IsDevelopmentContext,
          f1: true
        });
      }
      run(accessor) {
        accessor.get(IVoiceInputModeService).startVoiceStateWalkthrough(version);
      }
    });
  }
  registerAction2(class extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chat.voiceInputMode.simulate.step",
        title: { value: "Voice Input Mode: Prototype Step (Next State)", original: "Voice Input Mode: Prototype Step (Next State)" },
        category: { value: "Developer", original: "Developer" },
        precondition: IsDevelopmentContext,
        f1: true
      });
    }
    run(accessor) {
      accessor.get(IVoiceInputModeService).stepVoiceStateWalkthrough();
    }
  });
  registerAction2(class extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chat.voiceInputMode.simulate.clear",
        title: { value: "Voice Input Mode: Simulate \u2014 Clear", original: "Voice Input Mode: Simulate \u2014 Clear" },
        category: { value: "Developer", original: "Developer" },
        precondition: IsDevelopmentContext,
        f1: true
      });
    }
    run(accessor) {
      accessor.get(IVoiceInputModeService).clearSimulation();
    }
  });
  for (const { id, label, state } of SIMULATE_STATES) {
    registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `workbench.action.chat.voiceInputMode.simulate.${id}`,
          // Dev-only utility — not localized.
          title: { value: `Voice Input Mode: Simulate \u2014 ${label}`, original: `Voice Input Mode: Simulate \u2014 ${label}` },
          category: { value: "Developer", original: "Developer" },
          precondition: IsDevelopmentContext,
          f1: true
        });
      }
      run(accessor) {
        accessor.get(IVoiceInputModeService).setSimulatedVoiceState(state);
      }
    });
  }
}
let VoiceInputModeActionViewItem = class extends BaseActionViewItem {
  constructor(action, _options, voiceInputModeService, voiceSessionController, commandService, configurationService, keybindingService, contextMenuService, hoverService, micCaptureService, ttsPlaybackService, chatSpeechToTextService, accessibilityService, themeService) {
    super(void 0, action);
    this._options = _options;
    this.voiceInputModeService = voiceInputModeService;
    this.voiceSessionController = voiceSessionController;
    this.commandService = commandService;
    this.configurationService = configurationService;
    this.keybindingService = keybindingService;
    this.contextMenuService = contextMenuService;
    this.hoverService = hoverService;
    this.micCaptureService = micCaptureService;
    this.ttsPlaybackService = ttsPlaybackService;
    this.chatSpeechToTextService = chatSpeechToTextService;
    this.accessibilityService = accessibilityService;
    this.themeService = themeService;
    this._voiceBarEls = [];
    this._voiceHovering = false;
    this._voiceLive = false;
    this._listenHoldListening = false;
    this._listenHoldGesture = false;
    this._listenSuppressClick = false;
    this._listenPointerUp = this._register(new MutableDisposable());
    // Progress ring shown over the dictation glyph during an actual on-disk
    // model download (cache miss), mirroring the standalone toolbar button.
    this._dictationRing = this._register(new MutableDisposable());
  }
  _getLabelWithKeybinding(label, commandId) {
    return this.keybindingService.appendKeybinding(label, commandId);
  }
  _updateAriaLabels() {
    this._dictationCell?.setAttribute("aria-label", this._dictationCell.classList.contains("preparing") ? localize("voiceInputMode.dictationPreparing", "Preparing Speech to Text Model\u2026") : this._getLabelWithKeybinding(localize("voiceInputMode.dictation", "Dictation"), DICTATION_TOGGLE_COMMAND_ID));
    this._voiceCell?.setAttribute("aria-label", this._voiceCell.classList.contains("on") ? localize("voiceInputMode.disconnect", "Turn Off Voice Mode") : this._getLabelWithKeybinding(localize("voiceInputMode.voice", "Voice Mode"), VOICE_START_COMMAND_ID));
    this._listenCell?.setAttribute("aria-label", this._listenCell.classList.contains("active") ? this._getLabelWithKeybinding(localize("voiceInputMode.stopListening", "Stop Listening"), ChatVoiceInputModeToggleListenAction.ID) : this._getLabelWithKeybinding(localize("voiceInputMode.startListening", "Start Listening"), ChatVoiceInputModeToggleListenAction.ID));
  }
  /** Set the per-state pill/waveform colors from the theme-derived voice accent. */
  _updateVoiceStateColors(container) {
    const colors = resolveVoiceGlowColors(this.themeService.getColorTheme());
    container.style.setProperty("--voice-color-listening", colors.listening.toString());
    container.style.setProperty("--voice-color-speaking", colors.speaking.toString());
  }
  render(container) {
    super.render(container);
    container.classList.add("monaco-segmented-icon-toggle-container", "chat-voice-input-mode-item");
    this._updateVoiceStateColors(container);
    this._register(this.themeService.onDidColorThemeChange(() => this._updateVoiceStateColors(container)));
    const pill = dom.append(container, dom.$(".monaco-segmented-icon-toggle.chat-voice-input-mode"));
    this._reel = dom.append(pill, dom.$(".monaco-segmented-icon-toggle-reel.chat-voice-input-mode-reel"));
    this._dictationCell = dom.append(this._reel, dom.$("button.monaco-segmented-icon-toggle-cell.chat-voice-input-mode-cell.dictation"));
    this._dictationCell.setAttribute("type", "button");
    this._dictationCell.setAttribute("role", "button");
    this._dictationIcon = dom.append(this._dictationCell, dom.$("span.chat-voice-input-mode-icon"));
    this._register(this.hoverService.setupManagedHover(
      getDefaultHoverDelegate("element"),
      this._dictationCell,
      () => getDictationHoverContent(this._getLabelWithKeybinding(localize("voiceInputMode.dictation", "Dictation"), DICTATION_TOGGLE_COMMAND_ID), this.configurationService)
    ));
    this._register(dom.addDisposableListener(this._dictationCell, dom.EventType.CLICK, (e) => {
      dom.EventHelper.stop(e, true);
      this._onClickDictation();
    }));
    this._registerActivationKeys(this._dictationCell, () => this._onClickDictation());
    this._register(addMicButtonContextMenuListener(
      this._dictationCell,
      () => getDictationContextMenuActions(this.commandService, this.configurationService, this.keybindingService, DICTATION_TOGGLE_COMMAND_ID),
      this.contextMenuService
    ));
    this._register(setupDictationMicGlow(this._dictationCell, this.chatSpeechToTextService, this.accessibilityService, this._options?.isActive, this.themeService));
    this._voiceCell = dom.append(this._reel, dom.$("button.monaco-segmented-icon-toggle-cell.chat-voice-input-mode-cell.voice"));
    this._voiceCell.setAttribute("type", "button");
    this._voiceCell.setAttribute("role", "button");
    this._voiceBars = dom.append(this._voiceCell, dom.$("span.chat-voice-input-mode-bars"));
    for (let i = 0; i < WAVEFORM_BAR_COUNT; i++) {
      this._voiceBarEls.push(dom.append(this._voiceBars, dom.$("span.chat-voice-input-mode-bar")));
    }
    this._register(this.hoverService.setupManagedHover(
      getDefaultHoverDelegate("element"),
      this._voiceCell,
      () => {
        const ownsVoice = this._options?.isVoiceActive?.get() ?? this._options?.isActive?.get() ?? true;
        const connectedish = ownsVoice && (this.voiceSessionController.isConnected.get() || this.voiceSessionController.isConnecting.get()) || this.voiceInputModeService.simulatedVoiceState.get() === "idle" || this.voiceInputModeService.simulatedVoiceState.get() === "listening" || this.voiceInputModeService.simulatedVoiceState.get() === "speaking";
        return getVoiceModeHoverContent(connectedish ? localize("voiceInputMode.disconnect", "Turn Off Voice Mode") : this._getLabelWithKeybinding(localize("voiceInputMode.voice", "Voice Mode"), VOICE_START_COMMAND_ID));
      }
    ));
    this._register(dom.addDisposableListener(this._voiceCell, dom.EventType.CLICK, (e) => {
      dom.EventHelper.stop(e, true);
      void this._onClickVoicePowerToggle();
    }));
    this._registerActivationKeys(this._voiceCell, () => this._onClickVoicePowerToggle());
    this._register(addMicButtonContextMenuListener(
      this._voiceCell,
      () => getVoiceModeContextMenuActions(this.commandService, this.configurationService, this.keybindingService, VOICE_START_COMMAND_ID),
      this.contextMenuService
    ));
    this._register(dom.addDisposableListener(this._voiceCell, dom.EventType.MOUSE_ENTER, () => {
      this._voiceHovering = true;
      this._stopBarAnimation();
    }));
    this._register(dom.addDisposableListener(this._voiceCell, dom.EventType.MOUSE_LEAVE, () => {
      this._voiceHovering = false;
      this._syncBarAnimation();
    }));
    this._listenCell = dom.append(this._reel, dom.$("button.monaco-segmented-icon-toggle-cell.chat-voice-input-mode-cell.listen"));
    this._listenCell.setAttribute("type", "button");
    this._listenCell.setAttribute("role", "button");
    this._listenIcon = dom.append(this._listenCell, dom.$("span.chat-voice-input-mode-icon"));
    this._updateAriaLabels();
    this._register(this.keybindingService.onDidUpdateKeybindings(() => this._updateAriaLabels()));
    this._register(addMicButtonContextMenuListener(
      this._listenCell,
      () => getVoiceModeContextMenuActions(this.commandService, this.configurationService, this.keybindingService, VOICE_START_COMMAND_ID),
      this.contextMenuService
    ));
    this._register(this.hoverService.setupManagedHover(
      getDefaultHoverDelegate("element"),
      this._listenCell,
      () => this.voiceSessionController.voiceState.get() === "listening" ? this._getLabelWithKeybinding(localize("voiceInputMode.stopListening", "Stop Listening"), ChatVoiceInputModeToggleListenAction.ID) : this._getLabelWithKeybinding(localize("voiceInputMode.startOrHoldListening", "Tap to start, or hold to talk"), ChatVoiceInputModeToggleListenAction.ID)
    ));
    this._register(dom.addDisposableGenericMouseDownListener(this._listenCell, (e) => {
      if (e.button !== 0) {
        return;
      }
      this._onListenPointerDown();
    }));
    this._register(dom.addDisposableListener(this._listenCell, dom.EventType.CLICK, (e) => {
      dom.EventHelper.stop(e, true);
      if (this._listenSuppressClick) {
        this._listenSuppressClick = false;
        return;
      }
      this._onClickListen();
    }));
    this._registerActivationKeys(this._listenCell, () => this._onClickListen());
    const dictationActive = observableFromEvent(
      this,
      this.chatSpeechToTextService.onDidChangeState,
      () => isDictationActiveOnSurface(this.chatSpeechToTextService, "chat") && this.chatSpeechToTextService.state !== ChatSpeechToTextState.Idle
    );
    const dictationPreparing = observableFromEvent(
      this,
      this.chatSpeechToTextService.onDidChangePreparingModel,
      () => this.chatSpeechToTextService.currentSurface === "chat" && this.chatSpeechToTextService.isPreparingModel
    );
    const dictationDownloading = observableFromEvent(
      this,
      this.chatSpeechToTextService.onDidChangeDownloadingModel,
      () => this.chatSpeechToTextService.isDownloadingModel
    );
    this._register(autorun((reader) => {
      const dictationAvailable = this.voiceInputModeService.dictationAvailable.read(reader);
      const voiceAvailable = this.voiceInputModeService.voiceAvailable.read(reader);
      const simHandsFree = this.voiceInputModeService.simulatedHandsFree.read(reader);
      const handsFree = simHandsFree ?? this.voiceInputModeService.handsFree.read(reader);
      const sim = this.voiceInputModeService.simulatedVoiceState.read(reader);
      const isActive = sim !== void 0 || (this._options?.isActive?.read(reader) ?? true);
      const isVoiceActive = sim !== void 0 || (this._options?.isVoiceActive?.read(reader) ?? isActive);
      let isDictating;
      let connected;
      let connecting;
      let listening;
      let speaking;
      if (sim !== void 0) {
        isDictating = sim === "dictating";
        connecting = sim === "connecting";
        connected = sim === "idle" || sim === "listening" || sim === "speaking";
        listening = sim === "listening";
        speaking = sim === "speaking";
      } else {
        isDictating = isActive && dictationActive.read(reader);
        connected = isVoiceActive && this.voiceSessionController.isConnected.read(reader);
        connecting = isVoiceActive && this.voiceSessionController.isConnecting.read(reader);
        const voiceState = this.voiceSessionController.voiceState.read(reader);
        listening = connected && voiceState === "listening";
        speaking = connected && voiceState === "speaking";
      }
      const voiceLive = listening || speaking;
      const voiceOn = connected || connecting;
      this._voiceLive = voiceLive;
      const dictationBusy = sim === void 0 && isActive && dictationPreparing.read(reader);
      const showListen = voiceOn && !handsFree;
      const dictationPresent = dictationAvailable && !voiceOn;
      const voicePresent = voiceAvailable && !isDictating && !dictationBusy;
      const listenPresent = showListen;
      const presentCount = (dictationPresent ? 1 : 0) + (voicePresent ? 1 : 0) + (listenPresent ? 1 : 0);
      container.classList.toggle("connected", voiceOn);
      container.classList.toggle("single", presentCount === 1);
      this._dictationCell.classList.toggle("collapsed", !dictationPresent);
      this._dictationCell.classList.toggle("active", isDictating || dictationBusy);
      this._dictationCell.classList.toggle("preparing", dictationBusy);
      this._dictationCell.setAttribute("aria-pressed", String(isDictating));
      this._dictationCell.setAttribute("aria-label", dictationBusy ? localize("voiceInputMode.dictationPreparingCancelable", "Cancel Dictation. {0}", getDictationPreparingLabel(this.chatSpeechToTextService)) : localize("voiceInputMode.dictation", "Dictation"));
      const dictationIcon = dictationBusy ? dictationDownloading.read(reader) ? Codicon.micDownloadCompact : Codicon.loadingCompact : isDictating ? Codicon.micFilled : Codicon.mic;
      this._dictationIcon.className = `chat-voice-input-mode-icon ${ThemeIcon.asClassName(dictationIcon)}`;
      if (dictationBusy && dictationDownloading.read(reader)) {
        if (!this._dictationRing.value) {
          this._dictationRing.value = new DictationDownloadRing(this._dictationCell, this.chatSpeechToTextService);
        }
      } else {
        this._dictationRing.clear();
      }
      this._voiceCell.classList.toggle("collapsed", !voicePresent);
      this._voiceCell.classList.toggle("on", voiceOn);
      this._voiceCell.classList.toggle("idle-on", voiceOn && !voiceLive);
      this._voiceCell.classList.toggle("listening", listening);
      this._voiceCell.classList.toggle("speaking", speaking);
      this._voiceCell.setAttribute("aria-pressed", String(voiceOn));
      this._voiceCell.classList.toggle("sim-hover", this.voiceInputModeService.simulatedHover.read(reader));
      this._listenCell.classList.toggle("collapsed", !listenPresent);
      this._listenCell.classList.toggle("active", listening);
      this._listenCell.classList.toggle("muted", !listening);
      this._listenCell.setAttribute("aria-pressed", String(listening));
      this._listenIcon.className = `chat-voice-input-mode-icon ${ThemeIcon.asClassName(listening ? Codicon.personVoiceFilledCompact : Codicon.personVoiceCompact)}`;
      this._updateAriaLabels();
      this._syncBarAnimation();
    }));
    this._register({ dispose: () => this._stopBarAnimation() });
    this._register(this.accessibilityService.onDidChangeReducedMotion(() => {
      this._stopBarAnimation();
      this._syncBarAnimation();
    }));
  }
  /** Start or stop the audio-reactive bar loop based on live + hover state. */
  _syncBarAnimation() {
    if (this._voiceLive && !this._voiceHovering) {
      this._startBarAnimation();
    } else {
      this._stopBarAnimation();
    }
  }
  /**
   * Animate the waveform bars from live audio. Uses the mic analyser while listening
   * and the TTS analyser while the assistant speaks. When no analyser is available
   * (e.g. reduced motion or pre-capture), the CSS keyframe fallback drives the bars.
   */
  _startBarAnimation() {
    if (this._barAnimationFrame !== void 0) {
      return;
    }
    if (this.accessibilityService.isMotionReduced()) {
      for (const bar of this._voiceBarEls) {
        bar.style.animation = "none";
        bar.style.height = `${WAVEFORM_BAR_MIN_HEIGHT}px`;
      }
      return;
    }
    const win = getWindow(this._voiceCell);
    const tick = () => {
      this._barAnimationFrame = win.requestAnimationFrame(tick);
      const analyser = this.voiceSessionController.voiceState.get() === "speaking" ? this.ttsPlaybackService.analyserNode : this.micCaptureService.analyserNode;
      if (!analyser) {
        for (const bar of this._voiceBarEls) {
          bar.style.removeProperty("height");
          bar.style.removeProperty("animation");
        }
        return;
      }
      if (!this._barData || this._barData.length !== analyser.frequencyBinCount) {
        this._barData = new Uint8Array(analyser.frequencyBinCount);
      }
      analyser.getByteFrequencyData(this._barData);
      const bins = this._barData.length;
      const step = Math.max(1, Math.floor(bins / this._voiceBarEls.length));
      for (let i = 0; i < this._voiceBarEls.length; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += this._barData[Math.min(bins - 1, i * step + j)];
        }
        const intensity = Math.min(1, sum / step / 180);
        const heightPx = WAVEFORM_BAR_MIN_HEIGHT + intensity * (WAVEFORM_BAR_MAX_HEIGHT - WAVEFORM_BAR_MIN_HEIGHT);
        this._voiceBarEls[i].style.animation = "none";
        this._voiceBarEls[i].style.height = `${heightPx}px`;
      }
    };
    this._barAnimationFrame = win.requestAnimationFrame(tick);
  }
  _stopBarAnimation() {
    if (this._barAnimationFrame !== void 0 && this._voiceCell) {
      getWindow(this._voiceCell).cancelAnimationFrame(this._barAnimationFrame);
    }
    this._barAnimationFrame = void 0;
    for (const bar of this._voiceBarEls) {
      bar.style.removeProperty("height");
      bar.style.removeProperty("animation");
    }
  }
  /**
   * Toggle built-in on-device dictation. By default this runs the shared
   * {@link DICTATION_TOGGLE_COMMAND_ID} command (which targets the last focused
   * chat widget); a host that isn't an `IChatWidget` (e.g. the agents-window
   * composer) can inject its own toggle via {@link IVoiceInputModePillOptions}.
   */
  _toggleDictation() {
    if (this._options?.toggleDictation) {
      this._options.toggleDictation();
    } else {
      this.commandService.executeCommand(DICTATION_TOGGLE_COMMAND_ID);
    }
  }
  /**
   * Activate a segmented cell from the keyboard. The cells live inside a toolbar's
   * `ActionBar`, whose key handler runs the (no-op) placeholder action on Enter/Space
   * and calls `preventDefault`/`stopPropagation`, which would otherwise swallow the
   * native button activation. Handle Enter/Space here and stop the event before it
   * bubbles to the ActionBar so the focused cell's own gesture runs.
   */
  _registerActivationKeys(cell, handler) {
    this._register(dom.addStandardDisposableListener(cell, dom.EventType.KEY_DOWN, (e) => {
      if (e.equals(KeyCode.Enter) || e.equals(KeyCode.Space)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }));
    this._register(dom.addStandardDisposableListener(cell, dom.EventType.KEY_UP, (e) => {
      if (e.equals(KeyCode.Enter) || e.equals(KeyCode.Space)) {
        e.preventDefault();
        e.stopPropagation();
        handler();
      }
    }));
  }
  _onClickDictation() {
    this.voiceInputModeService.setSelectedMode("dictation");
    if (this.voiceSessionController.isConnected.get() || this.voiceSessionController.isConnecting.get()) {
      this.voiceSessionController.disconnect();
    }
    this._toggleDictation();
  }
  /** The voice button connects or disconnects; hands-free mode starts listening after connect. */
  async _onClickVoicePowerToggle() {
    this.voiceInputModeService.setSelectedMode("voice");
    if (this.chatSpeechToTextService.state !== ChatSpeechToTextState.Idle) {
      this._toggleDictation();
    }
    const controller = this.voiceSessionController;
    const targetWindow = getWindow(this._voiceCell);
    if (controller.isConnected.get() || controller.isConnecting.get()) {
      if (this._options?.isVoiceActive?.get() === false) {
        if (this._options.activateVoiceMode) {
          await this._options.activateVoiceMode();
        } else {
          await retargetVoiceToCurrentSession(this.commandService, controller, targetWindow);
        }
        return;
      }
      controller.disconnect();
    } else {
      if (this._options?.activateVoiceMode) {
        await this._options.activateVoiceMode();
      } else {
        await retargetVoiceToCurrentSession(this.commandService, controller, targetWindow);
      }
      controller.connect(targetWindow).catch(() => {
      });
    }
  }
  /** Tap the listen cell to toggle listening on and off. */
  _onClickListen() {
    const controller = this.voiceSessionController;
    if (!controller.isConnected.get()) {
      return;
    }
    if (controller.voiceState.get() === "listening") {
      controller.stopListening();
    } else {
      controller.pttDown();
      controller.pttUp();
    }
  }
  static {
    /** Threshold (ms) separating a quick tap (toggle) from a press-and-hold (talk). */
    this.HOLD_THRESHOLD_MS = 180;
  }
  _onListenPointerDown() {
    const controller = this.voiceSessionController;
    if (!controller.isConnected.get() || controller.voiceState.get() === "listening") {
      return;
    }
    this._listenHoldGesture = true;
    this._listenHoldListening = false;
    this._listenSuppressClick = false;
    const win = getWindow(this._listenCell);
    this._listenHoldTimer = win.setTimeout(() => {
      this._listenHoldTimer = void 0;
      if (controller.isConnected.get()) {
        this._listenHoldListening = true;
        controller.pttDown("explicit", true);
      }
    }, VoiceInputModeActionViewItem.HOLD_THRESHOLD_MS);
    this._listenPointerUp.value = dom.addDisposableGenericMouseUpListener(win, (e) => this._endListenPointerHold(e));
  }
  _endListenPointerHold(e) {
    if (!this._listenHoldGesture) {
      return;
    }
    this._listenHoldGesture = false;
    this._listenPointerUp.clear();
    if (this._listenHoldTimer !== void 0) {
      getWindow(this._listenCell).clearTimeout(this._listenHoldTimer);
      this._listenHoldTimer = void 0;
      this._listenSuppressClick = false;
    } else if (this._listenHoldListening) {
      this._listenHoldListening = false;
      const releasedOnCell = !!e?.target && this._listenCell.contains(e.target);
      this._listenSuppressClick = releasedOnCell;
      this.voiceSessionController.pttUp("explicit", true);
    }
  }
  dispose() {
    if (this._listenHoldGesture || this._listenHoldTimer !== void 0) {
      this._endListenPointerHold();
    }
    super.dispose();
  }
};
VoiceInputModeActionViewItem = __decorateClass([
  __decorateParam(2, IVoiceInputModeService),
  __decorateParam(3, IVoiceSessionController),
  __decorateParam(4, ICommandService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IKeybindingService),
  __decorateParam(7, IContextMenuService),
  __decorateParam(8, IHoverService),
  __decorateParam(9, IMicCaptureService),
  __decorateParam(10, ITtsPlaybackService),
  __decorateParam(11, IChatSpeechToTextService),
  __decorateParam(12, IAccessibilityService),
  __decorateParam(13, IThemeService)
], VoiceInputModeActionViewItem);
function isVoiceInputModeAvailable(voiceInputModeService) {
  const dictation = voiceInputModeService.dictationAvailable.get();
  const voice = voiceInputModeService.voiceAvailable.get();
  if (dictation && voice) {
    return "both";
  }
  if (dictation) {
    return "dictation";
  }
  if (voice) {
    return "voice";
  }
  return void 0;
}
export {
  ChatVoiceInputModeAction,
  ChatVoiceInputModeToggleListenAction,
  VoiceInputModeActionViewItem,
  isVoiceInputModeAvailable,
  registerVoiceInputModeSimulateActions
};
