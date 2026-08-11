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
import * as dom from "../../../../base/browser/dom.js";
import { renderFormattedText } from "../../../../base/browser/formattedTextRenderer.js";
import { status } from "../../../../base/browser/ui/aria/aria.js";
import { SelectBox } from "../../../../base/browser/ui/selectBox/selectBox.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Emitter } from "../../../../base/common/event.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { FileAccess } from "../../../../base/common/network.js";
import { localize } from "../../../../nls.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator, IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { ChatInputOnboarding, ChatInputOnboardingCard } from "../../chat/browser/widget/input/chatInputOnboarding.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { defaultSelectBoxStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { asCssVariable, asCssVariableWithDefault, selectBackground, selectListBackground } from "../../../../platform/theme/common/colorRegistry.js";
import { AgentsVoiceStorageKeys } from "../common/agentsVoice.js";
import { buildMicrophoneOptions, indexOfMicrophone } from "../../chat/browser/speechToText/dictationOnboarding.js";
import "./media/voiceModeOnboarding.css";
const VOICE_SETTING = "agents.voice.voice";
const VOICE_LANGUAGE_SETTING = "agents.voice.language";
const VOICE_SETTINGS_COMMAND = "agentsVoice.openSettings";
const VOICES = [
  {
    id: "birch_neutral",
    sampleId: "maya_neutral",
    label: localize("voiceMode.onboarding.voice.birch", "Birch (Default)"),
    // Flowing mid-range: even spread, gentle drift.
    signature: [
      { frequency: 1, amplitude: 0.42, speed: 0.42, phase: 0 },
      { frequency: 1.7, amplitude: 0.26, speed: -0.31, phase: 1.1 },
      { frequency: 2.6, amplitude: 0.19, speed: 0.24, phase: 2.4 },
      { frequency: 4.1, amplitude: 0.13, speed: -0.18, phase: 0.7 }
    ]
  },
  {
    id: "harper_neutral",
    sampleId: "victoria_neutral",
    label: localize("voiceMode.onboarding.voice.harper", "Harper"),
    // Bright and quick: higher frequencies, tighter ripple.
    signature: [
      { frequency: 1.4, amplitude: 0.38, speed: 0.52, phase: 0 },
      { frequency: 2.3, amplitude: 0.27, speed: -0.38, phase: 1.1 },
      { frequency: 3.6, amplitude: 0.21, speed: 0.3, phase: 2.4 },
      { frequency: 5.2, amplitude: 0.14, speed: -0.22, phase: 0.7 }
    ]
  },
  {
    id: "oak_neutral",
    sampleId: "kevin_neutral",
    label: localize("voiceMode.onboarding.voice.oak", "Oak"),
    // Low and broad: long swells with little high-frequency detail.
    signature: [
      { frequency: 0.7, amplitude: 0.48, speed: 0.3, phase: 0.4 },
      { frequency: 1.2, amplitude: 0.28, speed: -0.22, phase: 1.7 },
      { frequency: 2, amplitude: 0.16, speed: 0.18, phase: 0.9 },
      { frequency: 3.1, amplitude: 0.09, speed: -0.14, phase: 2.2 }
    ]
  },
  {
    id: "junho_neutral",
    sampleId: "daniel_neutral",
    label: localize("voiceMode.onboarding.voice.junho", "Junho"),
    // Steady and measured: slow drift, calm regular crests.
    signature: [
      { frequency: 0.9, amplitude: 0.44, speed: 0.24, phase: 1.3 },
      { frequency: 1.5, amplitude: 0.3, speed: -0.18, phase: 0.2 },
      { frequency: 2.4, amplitude: 0.14, speed: 0.15, phase: 2 },
      { frequency: 3.4, amplitude: 0.1, speed: -0.12, phase: 1.5 }
    ]
  }
];
const LOCALIZED_VOICES = {
  de: { id: "de_marc_neutral", label: localize("voiceMode.onboarding.voice.marc", "Marc") },
  es: { id: "es-ES_maria_neutral", label: localize("voiceMode.onboarding.voice.maria", "Maria") },
  fr: { id: "fr_david_neutral", label: localize("voiceMode.onboarding.voice.david", "David") },
  it: { id: "it_eva_neutral", label: localize("voiceMode.onboarding.voice.eva", "Eva") },
  ja: { id: "ja_aruha_neutral", label: localize("voiceMode.onboarding.voice.aruha", "Aruha") },
  ko: { id: "ko_jiyon_neutral", label: localize("voiceMode.onboarding.voice.jiyon", "Jiyon") },
  pt: { id: "pt-BR_gil_neutral", label: localize("voiceMode.onboarding.voice.gil", "Gil") },
  zh: { id: "zh_wuzhi_neutral", label: localize("voiceMode.onboarding.voice.wuzhi", "Wuzhi") }
};
function localizedVoiceForLanguage(language) {
  try {
    const canonical = Intl.getCanonicalLocales(language.trim())[0];
    const base = canonical?.split("-")[0].toLowerCase();
    return base ? LOCALIZED_VOICES[base] : void 0;
  } catch {
    return void 0;
  }
}
const RESTING_SIGNATURE = VOICES[0].signature.map((_, index) => {
  const components = VOICES.map((voice) => voice.signature[index]);
  const mean = (pick) => components.reduce((sum, wave) => sum + pick(wave), 0) / components.length;
  return {
    frequency: mean((wave) => wave.frequency),
    amplitude: mean((wave) => wave.amplitude),
    speed: mean((wave) => wave.speed),
    phase: mean((wave) => wave.phase)
  };
});
const IDLE_CYCLE_SECONDS = 2.6;
const WAVE_TEMPO = 2 * Math.PI / IDLE_CYCLE_SECONDS / Math.abs(RESTING_SIGNATURE[0].speed);
const IDLE_GAIN = 0.5;
const SPEAKING_GAIN = 0.45;
const IDLE_MOTION = 0.2;
const SPEAKING_MOTION = 0.8;
const LEVEL_EASING = 0.08;
const SIGNATURE_EASING = 0.06;
const REFERENCE_FRAME_SECONDS = 1 / 60;
const BAR_WIDTH = 1;
const BAR_GAP = 2;
const BAR_MIN = 1;
function cloneSignature(signature) {
  return signature.map((wave) => ({ ...wave, oscillation: 0 }));
}
function easingFactor(perFrameEasing, dt) {
  return 1 - Math.pow(1 - perFrameEasing, dt / REFERENCE_FRAME_SECONDS);
}
function easeSignature(current, target, factor) {
  for (let i = 0; i < current.length && i < target.length; i++) {
    current[i].frequency += (target[i].frequency - current[i].frequency) * factor;
    current[i].amplitude += (target[i].amplitude - current[i].amplitude) * factor;
    current[i].speed += (target[i].speed - current[i].speed) * factor;
    current[i].phase += (target[i].phase - current[i].phase) * factor;
  }
}
function advanceOscillation(waves, dt) {
  const tau = 2 * Math.PI;
  for (const wave of waves) {
    wave.oscillation = (wave.oscillation + wave.speed * WAVE_TEMPO * dt) % tau;
  }
}
function drawBars(context, width, height, waves, gain) {
  const pitch = BAR_WIDTH + BAR_GAP;
  const count = Math.max(1, Math.floor(width / pitch));
  const inset = (width - (count * pitch - BAR_GAP)) / 2;
  const centerY = height / 2;
  const maxHalf = height / 2;
  for (let index = 0; index < count; index++) {
    const position = count > 1 ? index / (count - 1) : 0;
    const amount = bandFraction(position, waves) * gain;
    const half = Math.max(BAR_MIN / 2, Math.min(maxHalf, amount * maxHalf));
    context.beginPath();
    context.roundRect(inset + index * pitch, centerY - half, BAR_WIDTH, half * 2, BAR_WIDTH / 2);
    context.fill();
  }
}
function bandFraction(position, waves) {
  let amplitude = 0;
  let total = 0;
  for (const wave of waves) {
    const phase = position * wave.frequency * Math.PI * 2 + wave.oscillation + wave.phase;
    amplitude += (0.5 + 0.5 * Math.sin(phase)) * wave.amplitude;
    total += wave.amplitude;
  }
  if (total === 0) {
    return 0;
  }
  const taper = Math.sin(Math.PI * Math.min(1, Math.max(0, position)));
  return amplitude / total * (0.35 + 0.65 * taper);
}
let VoiceModeOnboardingAnimator = class extends Disposable {
  constructor(canvas, container, source, themeService, accessibilityService) {
    super();
    this.canvas = canvas;
    this.container = container;
    this.source = source;
    this.themeService = themeService;
    this.accessibilityService = accessibilityService;
    this.animationFrame = this._register(new MutableDisposable());
    this.width = 0;
    this.height = 0;
    this.running = false;
    this.level = 0;
    /**
     * The stroke colour, taken from the canvas's own computed `color` so CSS
     * owns the tier and theme overrides work for free - the same `currentColor`
     * arrangement the toolbar waveform uses. Cached rather than read per frame:
     * `getComputedStyle` inside the animation loop forces a style recalculation
     * on every tick.
     */
    this.stroke = "";
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to create the Voice Mode onboarding canvas context");
    }
    this.context = context;
    this.waves = cloneSignature(this.source.getSignature());
    const targetWindow = dom.getWindow(container);
    const observer = new targetWindow.ResizeObserver(() => this.resize());
    observer.observe(container);
    this._register(toDisposable(() => observer.disconnect()));
    this._register(this.themeService.onDidColorThemeChange(() => {
      this.readStroke();
      this.draw(targetWindow.performance.now());
    }));
    this._register(this.accessibilityService.onDidChangeReducedMotion(() => this.updateMotion()));
    this._register(toDisposable(() => this.stop()));
    this.readStroke();
    this.resize();
    this.updateMotion();
  }
  readStroke() {
    this.stroke = dom.getWindow(this.canvas).getComputedStyle(this.canvas).color;
  }
  updateMotion() {
    if (this.accessibilityService.isMotionReduced()) {
      this.stop();
      this.draw(dom.getWindow(this.container).performance.now());
    } else {
      this.start();
    }
  }
  start() {
    if (this.running) {
      return;
    }
    this.running = true;
    const targetWindow = dom.getWindow(this.container);
    const tick = (time) => {
      if (!this.running) {
        return;
      }
      this.draw(time);
      this.animationFrame.value = dom.scheduleAtNextAnimationFrame(targetWindow, () => tick(targetWindow.performance.now()));
    };
    this.animationFrame.value = dom.scheduleAtNextAnimationFrame(targetWindow, () => tick(targetWindow.performance.now()));
  }
  stop() {
    this.running = false;
    this.animationFrame.clear();
  }
  resize() {
    const targetWindow = dom.getWindow(this.container);
    const devicePixelRatio = targetWindow.devicePixelRatio || 1;
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;
    if (!this.width || !this.height) {
      return;
    }
    this.canvas.width = this.width * devicePixelRatio;
    this.canvas.height = this.height * devicePixelRatio;
    this.context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    this.draw(targetWindow.performance.now());
  }
  draw(timestamp) {
    if (!this.width || !this.height) {
      return;
    }
    const dt = this.lastTimestamp === void 0 ? 0 : Math.max(0, (timestamp - this.lastTimestamp) * 1e-3);
    this.lastTimestamp = timestamp;
    this.level += (this.source.getLevel() - this.level) * easingFactor(LEVEL_EASING, dt);
    easeSignature(this.waves, this.source.getSignature(), easingFactor(SIGNATURE_EASING, dt));
    advanceOscillation(this.waves, dt * (IDLE_MOTION + this.level * SPEAKING_MOTION));
    const gain = IDLE_GAIN + this.level * SPEAKING_GAIN;
    this.context.clearRect(0, 0, this.width, this.height);
    this.context.fillStyle = this.stroke;
    drawBars(this.context, this.width, this.height, this.waves, gain);
  }
};
VoiceModeOnboardingAnimator = __decorateClass([
  __decorateParam(3, IThemeService),
  __decorateParam(4, IAccessibilityService)
], VoiceModeOnboardingAnimator);
let VoiceSamplePlayer = class extends Disposable {
  constructor(element, audioFactory, logService) {
    super();
    this.element = element;
    this.audioFactory = audioFactory;
    this.logService = logService;
    this.playback = this._register(new MutableDisposable());
    this._onDidChangePlayingVoice = this._register(new Emitter());
    /** Fires with the voice currently being heard, or `undefined` once it stops. */
    this.onDidChangePlayingVoice = this._onDidChangePlayingVoice.event;
    this._register(toDisposable(() => this.stop()));
  }
  get playingVoice() {
    return this._playingVoice;
  }
  /**
   * Current loudness of the sample being played, `0` when silent. The waveform
   * reads this so it moves to the voice the user is actually hearing.
   */
  getLevel() {
    if (!this.analyser || !this.levels || !this._playingVoice) {
      return 0;
    }
    this.analyser.getByteTimeDomainData(this.levels);
    let sum = 0;
    for (const sample of this.levels) {
      const centered = (sample - 128) / 128;
      sum += centered * centered;
    }
    return Math.min(1, Math.sqrt(sum / this.levels.length) * 3.2);
  }
  play(sampleId, playingVoice = sampleId) {
    this.stop();
    try {
      const audio = this.ensureAudio();
      audio.src = FileAccess.asBrowserUri(`vs/workbench/contrib/agentsVoice/browser/media/${sampleId}.mp3`).toString(true);
      const store = new DisposableStore();
      store.add(dom.addDisposableListener(audio, "ended", () => this.stop()));
      store.add(dom.addDisposableListener(audio, "error", () => this.stop()));
      store.add(toDisposable(() => audio.pause()));
      this.playback.value = store;
      this.setPlayingVoice(playingVoice);
      audio.play().catch((error) => {
        this.logService.trace(`[voice] Voice Mode onboarding preview failed: ${error}`);
        this.stop();
      });
    } catch (error) {
      this.logService.trace(`[voice] Voice Mode onboarding preview unavailable: ${error}`);
      this.stop();
    }
  }
  /**
   * Build the audio element and, best-effort, the analyser graph feeding the
   * waveform. Analysis is a nicety: if the Web Audio graph cannot be created
   * the sample still plays, the waveform just keeps its idle motion.
   */
  ensureAudio() {
    if (this.audio) {
      return this.audio;
    }
    const targetWindow = dom.getWindow(this.element);
    const audio = this.audioFactory?.() ?? new targetWindow.Audio();
    this.audio = audio;
    this._register(toDisposable(() => {
      audio.pause();
      audio.src = "";
    }));
    try {
      const context = new targetWindow.AudioContext();
      this._register(toDisposable(() => void context.close().catch(() => {
      })));
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaElementSource(audio).connect(analyser);
      analyser.connect(context.destination);
      this.analyser = analyser;
      this.levels = new Uint8Array(analyser.fftSize);
    } catch (error) {
      this.logService.trace(`[voice] Voice Mode onboarding analyser unavailable: ${error}`);
    }
    return audio;
  }
  stop() {
    this.playback.clear();
    this.setPlayingVoice(void 0);
  }
  setPlayingVoice(voiceId) {
    if (this._playingVoice === voiceId) {
      return;
    }
    this._playingVoice = voiceId;
    this._onDidChangePlayingVoice.fire(voiceId);
  }
};
VoiceSamplePlayer = __decorateClass([
  __decorateParam(2, ILogService)
], VoiceSamplePlayer);
let VoiceModeOnboardingBanner = class extends Disposable {
  constructor(options, commandService, configurationService, contextViewService, instantiationService, logService, storageService, telemetryService) {
    super();
    this.commandService = commandService;
    this.configurationService = configurationService;
    this.contextViewService = contextViewService;
    this.logService = logService;
    this.storageService = storageService;
    this.telemetryService = telemetryService;
    this.microphonePicker = this._register(new MutableDisposable());
    this.microphoneOptions = [];
    this.voiceElements = /* @__PURE__ */ new Map();
    /** Listeners for the current set of voice chips, cleared when they re-render. */
    this.voicesDisposables = this._register(new DisposableStore());
    this.options = options;
    this.card = this._register(new ChatInputOnboardingCard({
      container: options.container,
      className: "voice-mode-onboarding-banner",
      ariaLabel: localize("voiceMode.onboarding.region", "Voice Mode introduction"),
      ariaDescription: localize("voiceMode.onboarding.regionDescription", "Choose how your agent speaks to you. Adjust settings anytime."),
      onEscape: () => {
        this.logAction("escape");
        this.options.onDismiss();
      }
    }));
    this.domNode = this.card.domNode;
    this.localizedVoice = localizedVoiceForLanguage(this.resolveSpokenLanguage());
    this.player = this._register(instantiationService.createInstance(VoiceSamplePlayer, this.domNode, options.audioFactory));
    this._register(this.player.onDidChangePlayingVoice((voiceId) => this.updatePlaying(voiceId)));
    const copy = dom.append(this.domNode, dom.$(".voice-mode-onboarding-copy"));
    const title = dom.append(copy, dom.$(".voice-mode-onboarding-title"));
    title.textContent = localize("voiceMode.onboarding.title", "Welcome to Voice Mode");
    this.renderDescription(copy);
    this.renderSharedWaveform(instantiationService);
    this.renderMicrophonePicker();
    const actions = dom.append(this.domNode, dom.$(".voice-mode-onboarding-actions"));
    this.voicesContainer = actions;
    this.renderVoices();
    this.renderClose();
    this.logAction("shown");
    this._register(this.configurationService.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(VOICE_LANGUAGE_SETTING)) {
        this.updateForLanguage();
      }
    }));
  }
  /**
   * The signature the shared trace should be showing: the selected voice's, or
   * {@link RESTING_SIGNATURE} before anything has been chosen.
   */
  currentSignature() {
    return this.selectedVoice?.signature ?? RESTING_SIGNATURE;
  }
  /** The single full-width trace the whole card shares. */
  renderSharedWaveform(instantiationService) {
    const wave = dom.append(this.domNode, dom.$(".voice-mode-onboarding-wave"));
    const canvas = dom.append(wave, dom.$("canvas.voice-mode-onboarding-canvas"));
    canvas.setAttribute("aria-hidden", "true");
    this._register(instantiationService.createInstance(VoiceModeOnboardingAnimator, canvas, wave, {
      getLevel: () => this.player.getLevel(),
      getSignature: () => this.currentSignature()
    }));
  }
  renderMicrophonePicker() {
    this.microphonePickerContainer = dom.append(this.domNode, dom.$(".voice-mode-onboarding-microphone-picker"));
    this.microphoneOptions = [{
      deviceId: "",
      label: localize("voiceMode.onboarding.systemDefault", "System default")
    }];
    this.updateMicrophonePicker();
    const mediaDevices = dom.getWindow(this.domNode).navigator.mediaDevices;
    if (mediaDevices) {
      this._register(dom.addDisposableListener(mediaDevices, "devicechange", () => void this.refreshMicrophones()));
      void this.refreshMicrophones();
    }
  }
  async refreshMicrophones() {
    const mediaDevices = dom.getWindow(this.domNode).navigator.mediaDevices;
    if (!mediaDevices?.enumerateDevices) {
      return;
    }
    let devices;
    try {
      devices = await mediaDevices.enumerateDevices();
    } catch (error) {
      this.logService.trace(`[voice] could not enumerate microphones: ${error}`);
      return;
    }
    if (this._store.isDisposed) {
      return;
    }
    const options = buildMicrophoneOptions(devices);
    if (options.length > 1 && !devices.some((device) => device.kind === "audioinput" && device.label)) {
      return;
    }
    this.microphoneOptions = options;
    this.updateMicrophonePicker();
  }
  updateMicrophonePicker() {
    if (!this.microphonePickerContainer) {
      return;
    }
    this.microphonePicker.clear();
    dom.clearNode(this.microphonePickerContainer);
    this.microphonePickerContainer.hidden = this.microphoneOptions.length <= 1;
    if (this.microphonePickerContainer.hidden) {
      return;
    }
    dom.append(this.microphonePickerContainer, dom.$(`span.codicon.codicon-${Codicon.mic.id}.voice-mode-onboarding-microphone-icon`)).setAttribute("aria-hidden", "true");
    const selected = indexOfMicrophone(this.microphoneOptions, this.currentMicrophoneId());
    const store = new DisposableStore();
    const selectBox = store.add(new SelectBox(
      this.microphoneOptions.map((option) => ({ text: option.label })),
      selected,
      this.contextViewService,
      {
        ...defaultSelectBoxStyles,
        selectBackground: void 0,
        selectBorder: void 0,
        selectForeground: void 0,
        selectListBackground: asCssVariableWithDefault(selectListBackground, asCssVariable(selectBackground))
      },
      { ariaLabel: localize("voiceMode.onboarding.microphone", "Microphone"), useCustomDrawn: true }
    ));
    selectBox.render(this.microphonePickerContainer);
    store.add(selectBox.onDidSelect((event) => this.selectMicrophone(event.index)));
    this.microphonePicker.value = store;
  }
  currentMicrophoneId() {
    return this.storageService.get(AgentsVoiceStorageKeys.MicrophoneDevice, StorageScope.APPLICATION, "");
  }
  selectMicrophone(index) {
    const option = this.microphoneOptions[index];
    if (!option) {
      return;
    }
    this.logAction("selectMicrophone");
    if (option.deviceId) {
      this.storageService.store(AgentsVoiceStorageKeys.MicrophoneDevice, option.deviceId, StorageScope.APPLICATION, StorageTarget.MACHINE);
    } else {
      this.storageService.remove(AgentsVoiceStorageKeys.MicrophoneDevice, StorageScope.APPLICATION);
    }
    status(localize("voiceMode.onboarding.microphoneSelected", "{0} selected.", option.label));
  }
  /**
   * The voices as real buttons - border, hover lift, pressed feedback -
   * because bare text gave no sign it could be clicked at all. In a language
   * Voice Mode speaks natively there is only one voice, so the card previews
   * that voice instead of offering the English chooser.
   *
   * Re-entrant: clears any previously rendered chips so the card can rebuild
   * them when the spoken language changes.
   */
  renderVoices() {
    const container = this.voicesContainer;
    if (!container) {
      return;
    }
    this.voicesDisposables.clear();
    this.voiceElements.clear();
    dom.clearNode(container);
    const labelText = localize("voiceMode.onboarding.voices", "Agent Voice:");
    const label = dom.append(container, dom.$(".voice-mode-onboarding-voices-label"));
    label.textContent = labelText;
    if (this.localizedVoice) {
      this.renderLocalizedVoice(container, labelText, this.localizedVoice);
      return;
    }
    const group = dom.append(container, dom.$(".voice-mode-onboarding-voices"));
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", labelText);
    for (const voice of VOICES) {
      const option = dom.append(group, dom.$(".voice-mode-onboarding-voice"));
      option.setAttribute("role", "radio");
      const restingAria = localize("voiceMode.onboarding.voice.ariaLabel", "{0}. Hear this voice and use it for every conversation.", voice.label);
      option.setAttribute("aria-label", restingAria);
      this.appendVoiceIcon(option);
      const label2 = dom.append(option, dom.$("span.voice-mode-onboarding-voice-label"));
      label2.textContent = voice.label;
      this.voiceElements.set(voice.id, { element: option, label: voice.label, restingAria });
      this.voicesDisposables.add(dom.addDisposableListener(option, dom.EventType.CLICK, () => this.selectVoice(voice)));
      this.voicesDisposables.add(dom.addDisposableListener(option, dom.EventType.KEY_DOWN, (event) => this.handleOptionKey(event, voice)));
    }
    this.updateSelection();
  }
  /**
   * The spoken language changed, so swap the chips: the four English voices
   * for a native language's single voice, or back again. Nothing is carried
   * over - a voice chosen for the old language means nothing for the new one.
   */
  updateForLanguage() {
    const localizedVoice = localizedVoiceForLanguage(this.resolveSpokenLanguage());
    if (localizedVoice?.id === this.localizedVoice?.id) {
      return;
    }
    const hadVoiceFocus = this.voicesContainer ? dom.isAncestorOfActiveElement(this.voicesContainer) : false;
    this.player.stop();
    this.localizedVoice = localizedVoice;
    this.selectedVoice = void 0;
    this.renderVoices();
    if (hadVoiceFocus) {
      this.voiceElements.values().next().value?.element.focus();
    }
  }
  /**
   * The single native voice for the spoken language, as a preview button:
   * there is nothing to choose, so it only ever plays and stops.
   */
  renderLocalizedVoice(container, ariaLabel, voice) {
    const group = dom.append(container, dom.$(".voice-mode-onboarding-voices"));
    group.setAttribute("aria-label", ariaLabel);
    const option = dom.append(group, dom.$(".voice-mode-onboarding-voice"));
    option.setAttribute("role", "button");
    option.tabIndex = 0;
    const restingAria = localize("voiceMode.onboarding.voice.previewAriaLabel", "{0}. Hear how your agent will sound.", voice.label);
    option.setAttribute("aria-label", restingAria);
    this.appendVoiceIcon(option);
    const label = dom.append(option, dom.$("span.voice-mode-onboarding-voice-label"));
    label.textContent = voice.label;
    this.voiceElements.set(voice.id, { element: option, label: voice.label, restingAria });
    this.voicesDisposables.add(dom.addDisposableListener(option, dom.EventType.CLICK, () => this.previewLocalizedVoice(voice)));
    this.voicesDisposables.add(dom.addDisposableListener(option, dom.EventType.KEY_DOWN, (event) => {
      const keyboardEvent = new StandardKeyboardEvent(event);
      if (keyboardEvent.equals(KeyCode.Enter) || keyboardEvent.equals(KeyCode.Space)) {
        keyboardEvent.preventDefault();
        this.previewLocalizedVoice(voice);
      }
    }));
  }
  /**
   * The icon is the affordance: it says "this will speak" before the click,
   * animating bars while it speaks, then a check once a voice is chosen.
   */
  appendVoiceIcon(option) {
    const icon = dom.append(option, dom.$("span.voice-mode-onboarding-voice-icon"));
    dom.append(icon, dom.$(`span.codicon.codicon-${Codicon.play.id}.voice-mode-onboarding-voice-idle`)).setAttribute("aria-hidden", "true");
    dom.append(icon, dom.$(`span.codicon.codicon-${Codicon.checkCompact.id}.voice-mode-onboarding-voice-chosen`)).setAttribute("aria-hidden", "true");
    const bars = dom.append(icon, dom.$("span.voice-mode-onboarding-voice-bars"));
    bars.setAttribute("aria-hidden", "true");
    for (let bar = 0; bar < 3; bar++) {
      dom.append(bars, dom.$("span.voice-mode-onboarding-voice-bar"));
    }
  }
  // --- Shared behaviour ---
  handleOptionKey(event, voice) {
    const keyboardEvent = new StandardKeyboardEvent(event);
    if (keyboardEvent.equals(KeyCode.Enter) || keyboardEvent.equals(KeyCode.Space)) {
      keyboardEvent.preventDefault();
      this.selectVoice(voice);
      return;
    }
    const forward = keyboardEvent.equals(KeyCode.RightArrow) || keyboardEvent.equals(KeyCode.DownArrow);
    const backward = keyboardEvent.equals(KeyCode.LeftArrow) || keyboardEvent.equals(KeyCode.UpArrow);
    if (forward || backward) {
      keyboardEvent.preventDefault();
      const index = VOICES.indexOf(voice);
      const next = VOICES[(index + (forward ? 1 : VOICES.length - 1)) % VOICES.length];
      this.selectVoice(next);
      this.voiceElements.get(next.id)?.element.focus();
    }
  }
  /**
   * One short paragraph: what Voice Mode does, and where to change its
   * settings.
   *
   * `[[...]]` marks each clause that becomes a link, so translators can place
   * it naturally in the sentence instead of receiving a fixed phrase
   * concatenated onto the end.
   */
  renderDescription(container) {
    const description = dom.append(container, dom.$(".voice-mode-onboarding-description"));
    const text = localize({
      key: "voiceMode.onboarding.description",
      comment: [
        "Preserve the double square brackets: they mark the text that becomes a link.",
        "The link opens Voice Mode settings."
      ]
    }, "Choose how your agent speaks to you. Adjust [[settings]] anytime.");
    dom.append(description, renderFormattedText(text, {
      actionHandler: {
        callback: () => {
          this.logAction("openSettings");
          this.commandService.executeCommand(VOICE_SETTINGS_COMMAND).catch((error) => this.logService.error(`[voice] Failed to run ${VOICE_SETTINGS_COMMAND}: ${error}`));
        },
        disposables: this._store
      }
    }, dom.$("span")));
    for (const link of description.querySelectorAll("a")) {
      link.tabIndex = 0;
      link.setAttribute("role", "button");
      this._register(dom.addDisposableListener(link, dom.EventType.KEY_DOWN, (event) => {
        const keyboardEvent = new StandardKeyboardEvent(event);
        if (keyboardEvent.equals(KeyCode.Enter) || keyboardEvent.equals(KeyCode.Space)) {
          keyboardEvent.preventDefault();
          link.click();
        }
      }));
    }
  }
  /**
   * Dismissal is always available and never gated: a disabled close would trap
   * someone in the card. Choosing a voice already commits it, so this is only
   * ever "I am done here" - and closing is what hands the session back.
   */
  renderClose() {
    this.card.addAction({
      className: "voice-mode-onboarding-close",
      ariaLabel: localize("voiceMode.onboarding.close", "Close the introduction"),
      icon: Codicon.closeCompact,
      onActivate: () => this.finish()
    });
  }
  announce() {
    this.card.announce();
  }
  selectVoice(voice) {
    if (this.player.playingVoice === voice.id) {
      this.player.stop();
      status(localize("voiceMode.onboarding.voice.previewStopped", "{0} preview stopped.", voice.label));
      return;
    }
    this.logAction("selectVoice");
    this.selectedVoice = voice;
    this.updateSelection();
    this.player.play(voice.sampleId, voice.id);
    status(localize("voiceMode.onboarding.voice.selected", "{0} selected.", voice.label));
    this.configurationService.updateValue(VOICE_SETTING, voice.id, ConfigurationTarget.USER).catch((error) => this.logService.error(`[voice] Failed to persist the Voice Mode voice: ${error}`));
  }
  /**
   * The localized voice is not a choice - it is the only voice for the
   * language - so previewing it just plays and stops, and never persists.
   */
  previewLocalizedVoice(voice) {
    if (this.player.playingVoice === voice.id) {
      this.player.stop();
      status(localize("voiceMode.onboarding.voice.localizedStopped", "{0} preview stopped.", voice.label));
      return;
    }
    this.logAction("previewVoice");
    this.player.play(voice.id);
    status(localize("voiceMode.onboarding.voice.localizedPlaying", "Playing {0} preview.", voice.label));
  }
  /**
   * The spoken language, mirroring the resolution the voice client uses: an
   * explicit test override, then the configured language (unless `auto`), then
   * the window's language.
   */
  resolveSpokenLanguage() {
    if (this.options.voiceLanguage) {
      return this.options.voiceLanguage;
    }
    const configuredLanguage = this.configurationService.getValue(VOICE_LANGUAGE_SETTING)?.trim();
    if (configuredLanguage && configuredLanguage.toLowerCase() !== "auto") {
      return configuredLanguage;
    }
    return dom.getWindow(this.domNode).navigator.language;
  }
  updateSelection() {
    for (const [id, entry] of this.voiceElements) {
      const selected = id === this.selectedVoice?.id;
      entry.element.classList.toggle("selected", selected);
      entry.element.setAttribute("aria-checked", String(selected));
    }
    this.updateTabStop();
  }
  /**
   * Keeps a single tab stop on the group: the chosen voice, or the first one
   * when nothing has been chosen yet.
   */
  updateTabStop() {
    let first = true;
    for (const [id, entry] of this.voiceElements) {
      const isTabStop = this.selectedVoice === void 0 ? first : id === this.selectedVoice.id;
      entry.element.tabIndex = isTabStop ? 0 : -1;
      first = false;
    }
  }
  updatePlaying(playingVoice) {
    for (const [id, entry] of this.voiceElements) {
      const playing = id === playingVoice;
      entry.element.classList.toggle("playing", playing);
      entry.element.setAttribute("aria-label", playing ? localize("voiceMode.onboarding.voice.stopPreview", "Stop {0} preview.", entry.label) : entry.restingAria);
    }
    this.domNode.classList.toggle("playing", playingVoice !== void 0);
  }
  finish() {
    this.player.stop();
    this.logAction("close");
    this.options.onDismiss();
  }
  logAction(action) {
    this.telemetryService.publicLog2(
      "voiceModeOnboarding.action",
      { action, source: this.options.source }
    );
  }
};
VoiceModeOnboardingBanner = __decorateClass([
  __decorateParam(1, ICommandService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IContextViewService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, ILogService),
  __decorateParam(6, IStorageService),
  __decorateParam(7, ITelemetryService)
], VoiceModeOnboardingBanner);
const IVoiceModeOnboardingService = createDecorator("voiceModeOnboardingService");
let VoiceModeOnboardingService = class extends Disposable {
  constructor(instantiationService) {
    super();
    this.instantiationService = instantiationService;
    this.onboarding = this._register(this.instantiationService.createInstance(ChatInputOnboarding, {
      storageKey: AgentsVoiceStorageKeys.IntroBannerShown,
      hostClass: "has-voice-mode-onboarding"
    }));
  }
  get isVisible() {
    return this.onboarding.isVisible;
  }
  registerHost(container, focusRoot, focus, tipContainer, onDidChangeVisible) {
    return this.onboarding.registerHost(container, focusRoot, focus, tipContainer, onDidChangeVisible);
  }
  showIfNeeded() {
    this.onboarding.showIfNeeded((context) => this.createBanner(context, "automatic"));
  }
  show() {
    return this.onboarding.show((context) => this.createBanner(context, "manual"));
  }
  createBanner(context, source) {
    return this.instantiationService.createInstance(VoiceModeOnboardingBanner, {
      container: context.container,
      onDismiss: () => context.dismiss(dom.isAncestorOfActiveElement(context.container)),
      source
    });
  }
};
VoiceModeOnboardingService = __decorateClass([
  __decorateParam(0, IInstantiationService)
], VoiceModeOnboardingService);
registerSingleton(IVoiceModeOnboardingService, VoiceModeOnboardingService, InstantiationType.Delayed);
export {
  IVoiceModeOnboardingService,
  VoiceModeOnboardingBanner,
  VoiceModeOnboardingService
};
