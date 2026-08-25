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
import { renderFormattedText } from "../../../../../base/browser/formattedTextRenderer.js";
import { StandardKeyboardEvent } from "../../../../../base/browser/keyboardEvent.js";
import { status } from "../../../../../base/browser/ui/aria/aria.js";
import { SelectBox } from "../../../../../base/browser/ui/selectBox/selectBox.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Emitter } from "../../../../../base/common/event.js";
import { KeyCode } from "../../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../nls.js";
import { IAccessibilityService } from "../../../../../platform/accessibility/common/accessibility.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IContextViewService } from "../../../../../platform/contextview/browser/contextView.js";
import { InstantiationType, registerSingleton } from "../../../../../platform/instantiation/common/extensions.js";
import { createDecorator, IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { defaultSelectBoxStyles } from "../../../../../platform/theme/browser/defaultStyles.js";
import { AgentsVoiceStorageKeys } from "../../../agentsVoice/common/agentsVoice.js";
import { CONFIGURE_DICTATION_INSTRUCTIONS_ACTION_ID } from "../actions/configureVoiceInstructionsAction.js";
import { ChatInputOnboarding, ChatInputOnboardingCard } from "../widget/input/chatInputOnboarding.js";
import "./media/dictationOnboarding.css";
const DICTATION_INTRO_SHOWN_KEY = "chat.dictation.introShown";
const SHOW_DICTATION_ONBOARDING_COMMAND = "workbench.action.chat.showSpeechToTextIntroduction";
const RESET_DICTATION_ONBOARDING_COMMAND = "workbench.action.chat.resetSpeechToTextIntroduction";
const OPEN_SETTINGS_COMMAND = "workbench.action.openSettings";
const DICTATION_SETTINGS_QUERY = "dictation";
const SYSTEM_DEFAULT_DEVICE_ID = "";
const BAR_WIDTH = 1;
const BAR_GAP = 2;
const IDLE_GAIN = 0.55;
const SPEAKING_GAIN = 0.45;
const LEVEL_EASING = 0.12;
const RESTING_OPACITY = 0.35;
const SPEAKING_OPACITY = 0.5;
const UNAVAILABLE_OPACITY = 0.2;
const REDUCED_MOTION_PAINT_INTERVAL_MS = 100;
function readMicrophoneLevel(analyser, waveform) {
  if (!analyser || !waveform) {
    return 0;
  }
  analyser.getByteTimeDomainData(waveform);
  let sum = 0;
  for (const sample of waveform) {
    const centered = (sample - 128) / 128;
    sum += centered * centered;
  }
  return Math.min(1, Math.sqrt(sum / waveform.length) * 4);
}
const WAVES = [
  { frequency: 1, amplitude: 0.42, speed: 0.42, phase: 0 },
  { frequency: 1.7, amplitude: 0.26, speed: -0.31, phase: 1.1 },
  { frequency: 2.6, amplitude: 0.19, speed: 0.24, phase: 2.4 },
  { frequency: 4.1, amplitude: 0.13, speed: -0.18, phase: 0.7 }
];
function bandFraction(position, time) {
  let amplitude = 0;
  let total = 0;
  for (const wave of WAVES) {
    const phase = position * wave.frequency * Math.PI * 2 + time * wave.speed + wave.phase;
    amplitude += (0.5 + 0.5 * Math.sin(phase)) * wave.amplitude;
    total += wave.amplitude;
  }
  if (total === 0) {
    return 0;
  }
  const taper = Math.sin(Math.PI * Math.min(1, Math.max(0, position)));
  return amplitude / total * (0.35 + 0.65 * taper);
}
var MicrophonePreviewError = /* @__PURE__ */ ((MicrophonePreviewError2) => {
  MicrophonePreviewError2["Denied"] = "denied";
  MicrophonePreviewError2["NoDevice"] = "noDevice";
  MicrophonePreviewError2["Unavailable"] = "unavailable";
  return MicrophonePreviewError2;
})(MicrophonePreviewError || {});
let MicrophonePreview = class extends Disposable {
  constructor(element, mediaDevices, logService) {
    super();
    this.element = element;
    this.mediaDevices = mediaDevices;
    this.logService = logService;
    this.session = this._register(new MutableDisposable());
    this._onDidChangeError = this._register(new Emitter());
    /** Fires with the reason no level is available, or `undefined` once one is. */
    this.onDidChangeError = this._onDidChangeError.event;
  }
  get error() {
    return this._error;
  }
  /**
   * Current loudness, `0..1`, or `0` when nothing is being heard. Read every
   * frame, so it stays allocation-free.
   */
  getLevel() {
    return readMicrophoneLevel(this.analyser, this.waveform);
  }
  /**
   * Listen to `deviceId` (empty means the system default). Replaces any stream
   * already running, so switching devices never leaves two microphones open.
   */
  async listen(deviceId) {
    if (this._store.isDisposed) {
      return;
    }
    this.releaseMicrophone();
    const targetWindow = dom.getWindow(this.element);
    if (!this.mediaDevices?.getUserMedia) {
      this.setError("unavailable" /* Unavailable */);
      return;
    }
    const constraints = { channelCount: 1, echoCancellation: true, noiseSuppression: true };
    if (deviceId) {
      constraints.deviceId = { exact: deviceId };
    }
    let stream;
    try {
      stream = await this.mediaDevices.getUserMedia({ audio: constraints });
    } catch (error) {
      this.setError(toPreviewError(error));
      this.logService.trace(`[chat-stt] microphone preview unavailable: ${error}`);
      return;
    }
    const store = new DisposableStore();
    store.add(toDisposable(() => stream.getTracks().forEach((track) => track.stop())));
    let analyser;
    try {
      const context = new targetWindow.AudioContext();
      store.add(toDisposable(() => void context.close().catch(() => {
      })));
      if (context.state === "suspended") {
        await context.resume();
      }
      analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(stream).connect(analyser);
    } catch (error) {
      store.dispose();
      this.setError("unavailable" /* Unavailable */);
      this.logService.trace(`[chat-stt] microphone preview analyser unavailable: ${error}`);
      return;
    }
    if (this._store.isDisposed) {
      store.dispose();
      return;
    }
    this.session.value = store;
    this.analyser = analyser;
    this.waveform = new Uint8Array(analyser.fftSize);
    this.setError(void 0);
  }
  /**
   * Hand the microphone back. Called before dictation acquires its own stream:
   * two captures of one device is what makes the audio service drop the
   * capture, so the preview always lets go first.
   */
  releaseMicrophone() {
    this.analyser = void 0;
    this.waveform = void 0;
    this.session.clear();
  }
  setError(error) {
    if (this._error === error) {
      return;
    }
    this._error = error;
    this._onDidChangeError.fire(error);
  }
};
MicrophonePreview = __decorateClass([
  __decorateParam(2, ILogService)
], MicrophonePreview);
function toPreviewError(error) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "denied" /* Denied */;
    }
    if (error.name === "NotFoundError" || error.name === "OverconstrainedError") {
      return "noDevice" /* NoDevice */;
    }
  }
  return "unavailable" /* Unavailable */;
}
let MicrophoneWaveform = class extends Disposable {
  constructor(container, source, observerCtor, accessibilityService) {
    super();
    this.container = container;
    this.source = source;
    this.accessibilityService = accessibilityService;
    this.bars = [];
    this.animationFrame = this._register(new MutableDisposable());
    this.running = false;
    this.lastPaint = 0;
    this.level = 0;
    container.setAttribute("aria-hidden", "true");
    const observer = new (observerCtor ?? dom.getWindow(container).ResizeObserver)(() => this.layout());
    observer.observe(container);
    this._register(toDisposable(() => observer.disconnect()));
    this.layout();
    this._register(toDisposable(() => this.stop()));
  }
  /** Rebuild the row for the current width, if the count actually changed. */
  layout() {
    const width = this.container.clientWidth;
    if (!width) {
      return;
    }
    const count = Math.max(1, Math.floor((width + BAR_GAP) / (BAR_WIDTH + BAR_GAP)));
    if (count === this.bars.length) {
      return;
    }
    dom.clearNode(this.container);
    this.bars = [];
    for (let i = 0; i < count; i++) {
      this.bars.push(dom.append(this.container, dom.$("span.dictation-onboarding-bar")));
    }
  }
  start() {
    if (this.running) {
      return;
    }
    this.running = true;
    const targetWindow = dom.getWindow(this.container);
    const tick = () => {
      if (!this.running) {
        return;
      }
      this.update(targetWindow.performance.now());
      this.animationFrame.value = dom.scheduleAtNextAnimationFrame(targetWindow, tick);
    };
    this.animationFrame.value = dom.scheduleAtNextAnimationFrame(targetWindow, tick);
  }
  stop() {
    this.running = false;
    this.animationFrame.clear();
  }
  update(timestamp) {
    const interval = this.accessibilityService.isMotionReduced() ? REDUCED_MOTION_PAINT_INTERVAL_MS : 0;
    if (timestamp - this.lastPaint < interval) {
      return;
    }
    this.lastPaint = timestamp;
    this.level += (this.source.getLevel() - this.level) * LEVEL_EASING;
    const gain = IDLE_GAIN + this.level * SPEAKING_GAIN;
    const time = timestamp * 1e-3;
    this.container.style.opacity = (this.source.isAvailable() ? RESTING_OPACITY + this.level * SPEAKING_OPACITY : UNAVAILABLE_OPACITY).toFixed(3);
    const count = this.bars.length;
    for (let i = 0; i < count; i++) {
      const position = count > 1 ? i / (count - 1) : 0;
      const amount = Math.max(0.08, Math.min(1, bandFraction(position, time) * gain));
      this.bars[i].style.transform = `scaleY(${amount.toFixed(3)})`;
    }
  }
};
MicrophoneWaveform = __decorateClass([
  __decorateParam(3, IAccessibilityService)
], MicrophoneWaveform);
function buildMicrophoneOptions(devices) {
  const seen = /* @__PURE__ */ new Set();
  const microphones = [];
  for (const device of devices) {
    if (device.kind !== "audioinput" || device.deviceId === "default" || device.deviceId === "communications") {
      continue;
    }
    if (seen.has(device.deviceId)) {
      continue;
    }
    seen.add(device.deviceId);
    microphones.push(device);
  }
  if (microphones.length === 0) {
    return [{
      deviceId: SYSTEM_DEFAULT_DEVICE_ID,
      label: localize("dictation.onboarding.systemDefault", "System default")
    }];
  }
  const defaultDevice = devices.find((device) => device.kind === "audioinput" && device.deviceId === "default");
  const defaultLabel = defaultDevice?.label.replace(/^(?:default|system default)\s*-\s*/i, "").trim();
  const defaultMicrophone = defaultDevice ? microphones.find(
    (device) => defaultDevice.groupId && device.groupId === defaultDevice.groupId || defaultLabel && device.label === defaultLabel
  ) ?? microphones[0] : void 0;
  const options = [];
  if (defaultDevice) {
    const label = defaultMicrophone?.label || defaultLabel;
    options.push({
      deviceId: SYSTEM_DEFAULT_DEVICE_ID,
      label: label ? localize("dictation.onboarding.defaultDevice", "{0} (System default)", label) : localize("dictation.onboarding.systemDefault", "System default")
    });
  }
  for (const device of microphones) {
    if (device === defaultMicrophone) {
      continue;
    }
    options.push({
      deviceId: device.deviceId,
      // Labels are empty until microphone permission has been granted at
      // least once; a truncated id is still better than a blank row.
      label: device.label || localize("dictation.onboarding.unknownDevice", "Unknown device ({0})", device.deviceId.slice(0, 8))
    });
  }
  return options;
}
function indexOfMicrophone(options, deviceId) {
  const index = options.findIndex((option) => option.deviceId === deviceId);
  return index === -1 ? 0 : index;
}
let DictationOnboardingBanner = class extends Disposable {
  constructor(bannerOptions, mediaDevices, commandService, contextViewService, instantiationService, logService, storageService, telemetryService) {
    super();
    this.bannerOptions = bannerOptions;
    this.mediaDevices = mediaDevices;
    this.commandService = commandService;
    this.contextViewService = contextViewService;
    this.logService = logService;
    this.storageService = storageService;
    this.telemetryService = telemetryService;
    this.picker = this._register(new MutableDisposable());
    this.options = [];
    this.card = this._register(new ChatInputOnboardingCard({
      container: bannerOptions.container,
      className: "dictation-onboarding-banner",
      ariaLabel: localize("dictation.onboarding.region", "Dictation introduction"),
      ariaDescription: bannerOptions.previewMicrophone ? localize("dictation.onboarding.regionDescription.preview", "Say anything to check your microphone.") : localize("dictation.onboarding.regionDescription", "Speak and it becomes text."),
      onEscape: () => this.dismiss("escape")
    }));
    this.domNode = this.card.domNode;
    const header = dom.append(this.domNode, dom.$(".dictation-onboarding-header"));
    const title = dom.append(header, dom.$(".dictation-onboarding-title"));
    title.textContent = localize("dictation.onboarding.title", "Dictation");
    this.renderDescription(header);
    this.renderClose();
    const device = dom.append(this.domNode, dom.$(".dictation-onboarding-device"));
    this.pickerContainer = dom.append(device, dom.$(".dictation-onboarding-picker"));
    this.options = [{
      deviceId: SYSTEM_DEFAULT_DEVICE_ID,
      label: localize("dictation.onboarding.systemDefault", "System default")
    }];
    this.renderPicker();
    if (this.mediaDevices) {
      this._register(dom.addDisposableListener(this.mediaDevices, "devicechange", () => void this.refreshMicrophones()));
    }
    const waveformContainer = dom.append(device, dom.$(".dictation-onboarding-waveform"));
    if (this.bannerOptions.previewMicrophone) {
      const preview = this.preview = this._register(instantiationService.createInstance(MicrophonePreview, this.domNode, this.mediaDevices));
      this.waveform = this._register(instantiationService.createInstance(MicrophoneWaveform, waveformContainer, {
        getLevel: () => preview.getLevel(),
        isAvailable: () => preview.error === void 0
      }, void 0));
      this._register(preview.onDidChangeError(() => this.updateHint()));
      this.hint = dom.append(this.domNode, dom.$(".dictation-onboarding-hint"));
      this.hint.setAttribute("aria-live", "polite");
      this.updateHint();
      void this.startPreview();
    } else {
      this.waveform = this._register(instantiationService.createInstance(MicrophoneWaveform, waveformContainer, {
        getLevel: () => readMicrophoneLevel(this.dictationAnalyser, this.dictationWaveform),
        isAvailable: () => this.dictationAnalyser !== void 0
      }, void 0));
      void this.refreshMicrophones();
    }
    this.waveform.start();
    this.logAction("shown");
  }
  announce() {
    this.card.announce();
  }
  /**
   * What dictation is, and that none of it is fixed. The card is shown once, so
   * the two things a user might want to change afterwards - whether dictation
   * runs at all, and how it writes what they say - have to be reachable from
   * here rather than left to a command nobody knows to look for.
   *
   * `[[...]]` marks the clauses that become links, so translators can keep the
   * sentence natural instead of having fixed phrases concatenated on.
   */
  renderDescription(container) {
    const description = dom.append(container, dom.$(".dictation-onboarding-description"));
    const text = localize({
      key: "dictation.onboarding.description",
      comment: ["Preserve the double square brackets: they mark the text that becomes a link. Keep both links, in this order - the first opens settings, the second opens the customization file."]
    }, "Speak and it becomes text. Adjust [[settings]] or [[how it's written]] any time.");
    dom.append(description, renderFormattedText(text, {
      actionHandler: {
        // The handler is given the link's index, so the two are told apart
        // by position - hence the ordering note to translators above.
        callback: (index) => {
          const [commandId, ...args] = index === "0" ? [OPEN_SETTINGS_COMMAND, { query: DICTATION_SETTINGS_QUERY }] : [CONFIGURE_DICTATION_INSTRUCTIONS_ACTION_ID];
          this.logAction(index === "0" ? "openSettings" : "openInstructions");
          this.commandService.executeCommand(commandId, ...args).catch((error) => this.logService.error(`[chat-stt] failed to open dictation customization: ${error}`));
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
   * Bring the card to life. The device list and the microphone are started
   * together rather than in sequence: `getUserMedia` can take a second or more
   * to return, and waiting for it would leave the picker empty for that whole
   * time. Enumeration is repeated once the microphone is live, because device
   * labels stay blank until permission has been granted at least once.
   */
  async startPreview() {
    if (!this.preview) {
      return;
    }
    const listening = this.preview.listen(this.currentDeviceId());
    await Promise.all([listening, this.refreshMicrophones()]);
    await this.refreshMicrophones();
  }
  currentDeviceId() {
    return this.storageService.get(AgentsVoiceStorageKeys.MicrophoneDevice, StorageScope.APPLICATION, SYSTEM_DEFAULT_DEVICE_ID);
  }
  async refreshMicrophones(analyserNode, switchMicrophone) {
    if (this._store.isDisposed) {
      return;
    }
    this.switchMicrophone = switchMicrophone ?? this.switchMicrophone;
    if (!this.preview && analyserNode) {
      this.dictationAnalyser = analyserNode;
      this.dictationWaveform = new Uint8Array(analyserNode.fftSize);
    }
    if (!this.preview && !this.dictationAnalyser) {
      return;
    }
    if (!this.mediaDevices?.enumerateDevices) {
      return;
    }
    let devices;
    try {
      devices = await this.mediaDevices.enumerateDevices();
    } catch (error) {
      this.logService.trace(`[chat-stt] could not enumerate microphones: ${error}`);
      return;
    }
    if (this._store.isDisposed) {
      return;
    }
    const options = buildMicrophoneOptions(devices);
    if (options.length > 1 && !devices.some((device) => device.kind === "audioinput" && device.label)) {
      return;
    }
    this.options = options;
    this.renderPicker();
  }
  /** A picker with one entry is not a choice, so only show this row for multiple microphones. */
  renderPicker() {
    if (!this.pickerContainer) {
      return;
    }
    this.picker.clear();
    dom.clearNode(this.pickerContainer);
    this.pickerContainer.hidden = this.options.length <= 1;
    if (this.pickerContainer.hidden) {
      return;
    }
    dom.append(this.pickerContainer, dom.$(`span.codicon.codicon-${Codicon.mic.id}.dictation-onboarding-picker-icon`)).setAttribute("aria-hidden", "true");
    const selected = indexOfMicrophone(this.options, this.currentDeviceId());
    const store = new DisposableStore();
    const selectBox = store.add(new SelectBox(
      this.options.map((option) => ({ text: option.label })),
      selected,
      this.contextViewService,
      { ...defaultSelectBoxStyles, selectBackground: void 0, selectBorder: void 0, selectForeground: void 0 },
      { ariaLabel: localize("dictation.onboarding.microphone", "Microphone"), useCustomDrawn: true }
    ));
    selectBox.render(this.pickerContainer);
    store.add(selectBox.onDidSelect((event) => this.selectMicrophone(event.index)));
    this.picker.value = store;
  }
  selectMicrophone(index) {
    const option = this.options[index];
    if (!option) {
      return;
    }
    this.logAction("selectMicrophone");
    if (option.deviceId) {
      this.storageService.store(AgentsVoiceStorageKeys.MicrophoneDevice, option.deviceId, StorageScope.APPLICATION, StorageTarget.MACHINE);
    } else {
      this.storageService.remove(AgentsVoiceStorageKeys.MicrophoneDevice, StorageScope.APPLICATION);
    }
    status(localize("dictation.onboarding.microphoneSelected", "{0} selected.", option.label));
    if (this.preview) {
      void this.preview.listen(option.deviceId).then(() => this.updateHint());
    } else if (this.switchMicrophone) {
      void this.switchMicrophone(option.deviceId).then((analyser) => this.refreshMicrophones(analyser)).catch((error) => this.logService.error(`[chat-stt] failed to switch dictation microphone: ${error}`));
    }
  }
  /**
   * The hint only speaks when the microphone cannot be read. At rest the
   * moving waveform is the instruction - a line of text telling you to talk is
   * one the card can do without.
   */
  updateHint() {
    if (!this.preview || !this.hint) {
      return;
    }
    const error = this.preview.error;
    this.domNode.classList.toggle("has-error", error !== void 0);
    this.hint.textContent = error === void 0 ? "" : hintForError(error);
  }
  renderClose() {
    this.card.addAction({
      className: "dictation-onboarding-close",
      ariaLabel: localize("dictation.onboarding.close", "Close the introduction"),
      icon: Codicon.close,
      onActivate: () => this.dismiss("close")
    });
  }
  dismiss(action) {
    this.logAction(action);
    this.waveform.stop();
    this.preview?.releaseMicrophone();
    this.bannerOptions.onDismiss();
  }
  logAction(action) {
    this.telemetryService.publicLog2(
      "dictationOnboarding.action",
      { action, source: this.bannerOptions.source }
    );
  }
};
DictationOnboardingBanner = __decorateClass([
  __decorateParam(2, ICommandService),
  __decorateParam(3, IContextViewService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, ILogService),
  __decorateParam(6, IStorageService),
  __decorateParam(7, ITelemetryService)
], DictationOnboardingBanner);
function hintForError(error) {
  switch (error) {
    case "denied" /* Denied */:
      return localize("dictation.onboarding.denied", "No microphone access. Check your system privacy settings.");
    case "noDevice" /* NoDevice */:
      return localize("dictation.onboarding.noDevice", "No microphone found.");
    default:
      return localize("dictation.onboarding.unavailable", "Can't read the microphone level.");
  }
}
const IDictationOnboardingService = createDecorator("dictationOnboardingService");
let DictationOnboardingService = class extends Disposable {
  constructor(instantiationService, storageService) {
    super();
    this.instantiationService = instantiationService;
    this.storageService = storageService;
    this.onboarding = this._register(this.instantiationService.createInstance(ChatInputOnboarding, {
      storageKey: DICTATION_INTRO_SHOWN_KEY,
      hostClass: "has-dictation-onboarding"
    }));
  }
  get isVisible() {
    return this.onboarding.isVisible;
  }
  registerHost(container, focusRoot, tipContainer, onDidChangeVisible) {
    return this.onboarding.registerHost(container, focusRoot, void 0, tipContainer, onDidChangeVisible);
  }
  showIfNeeded() {
    return this.onboarding.showIfNeeded((context) => this.createBanner(context.container, context.dismiss, "automatic", false));
  }
  show() {
    return this.onboarding.show((context) => this.createBanner(context.container, context.dismiss, "manual", true));
  }
  refreshMicrophones(analyserNode, switchMicrophone) {
    if (this.onboarding.isVisible) {
      void this.currentBanner?.refreshMicrophones(analyserNode, switchMicrophone);
    }
  }
  reset() {
    this.storageService.remove(DICTATION_INTRO_SHOWN_KEY, StorageScope.APPLICATION);
  }
  createBanner(container, dismiss, source, previewMicrophone) {
    const banner = this.instantiationService.createInstance(DictationOnboardingBanner, {
      container,
      onDismiss: dismiss,
      previewMicrophone,
      source
    }, dom.getWindow(container).navigator.mediaDevices);
    this.currentBanner = banner;
    return banner;
  }
};
DictationOnboardingService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IStorageService)
], DictationOnboardingService);
registerSingleton(IDictationOnboardingService, DictationOnboardingService, InstantiationType.Delayed);
export {
  DictationOnboardingBanner,
  DictationOnboardingService,
  IDictationOnboardingService,
  RESET_DICTATION_ONBOARDING_COMMAND,
  SHOW_DICTATION_ONBOARDING_COMMAND,
  buildMicrophoneOptions,
  indexOfMicrophone
};
