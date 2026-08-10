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
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { Event } from "../../../../../base/common/event.js";
import { autorun, observableFromEvent, observableValue, transaction } from "../../../../../base/common/observable.js";
import { localize } from "../../../../../nls.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService, RawContextKey } from "../../../../../platform/contextkey/common/contextkey.js";
import { InstantiationType, registerSingleton } from "../../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { AgentsVoiceSettingId, AGENTS_VOICE_ENTITLED } from "../../../agentsVoice/common/agentsVoice.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
import { DictationSettingId, IChatSpeechToTextService } from "../speechToText/chatSpeechToTextService.js";
const CHAT_VOICE_INPUT_MODE = new RawContextKey("chatVoiceInputMode", "voice", { type: "string", description: localize("chatVoiceInputMode", "The currently selected voice input mode in the chat input (dictation or voice).") });
const STORAGE_KEY = "chat.voiceInputMode.selected";
const IVoiceInputModeService = createDecorator("voiceInputModeService");
let VoiceInputModeService = class extends Disposable {
  constructor(storageService, configurationService, contextKeyService, chatSpeechToTextService) {
    super();
    this.storageService = storageService;
    this._simulatedVoiceState = observableValue(this, void 0);
    this.simulatedVoiceState = this._simulatedVoiceState;
    this._simulatedHandsFree = observableValue(this, void 0);
    this.simulatedHandsFree = this._simulatedHandsFree;
    this._simulatedVersion = observableValue(this, void 0);
    this.simulatedVersion = this._simulatedVersion;
    this._simulatedHover = observableValue(this, false);
    this.simulatedHover = this._simulatedHover;
    this._walkIndex = 0;
    const stored = this.storageService.get(STORAGE_KEY, StorageScope.PROFILE);
    const initial = stored === "dictation" ? "dictation" : "voice";
    this._selectedMode = observableValue(this, initial);
    this.selectedMode = this._selectedMode;
    this.voiceAvailable = observableFromEvent(
      this,
      Event.any(configurationService.onDidChangeConfiguration, contextKeyService.onDidChangeContext),
      () => configurationService.getValue("agents.voice.enabled") === true && ChatContextKeys.enabled.getValue(contextKeyService) === true && AGENTS_VOICE_ENTITLED.evaluate({ getValue: (key) => contextKeyService.getContextKeyValue(key) }) && configurationService.getValue(AgentsVoiceSettingId.ShowButton) !== false
    );
    this.dictationAvailable = observableFromEvent(
      this,
      Event.any(configurationService.onDidChangeConfiguration, contextKeyService.onDidChangeContext),
      () => chatSpeechToTextService.isConfigured && configurationService.getValue(DictationSettingId.ShowButton) !== false
    );
    this.handsFree = observableFromEvent(
      this,
      configurationService.onDidChangeConfiguration,
      () => configurationService.getValue("agents.voice.handsFree") !== false
    );
    this._contextKey = CHAT_VOICE_INPUT_MODE.bindTo(contextKeyService);
    this._register(autorun((reader) => {
      this._contextKey.set(this._selectedMode.read(reader));
    }));
  }
  setSelectedMode(mode) {
    if (this._selectedMode.get() === mode) {
      return;
    }
    this._selectedMode.set(mode, void 0);
    this.storageService.store(STORAGE_KEY, mode, StorageScope.PROFILE, StorageTarget.USER);
  }
  setSimulatedVoiceState(state) {
    this._simulatedVoiceState.set(state, void 0);
  }
  static {
    // Per-version walkthrough sequences. Each exercises the full lifecycle for one
    // push-to-talk design so the bars, colors, hover previews and input-box glow can be
    // watched exactly as a user would experience them. Sequences loop until cleared.
    this.WALKTHROUGHS = {
      // Hands-free: connects, then auto-listens and replies; a quick listening flash
      // during a reply represents barge-in.
      handsFree: {
        handsFree: true,
        steps: [
          { state: "off", ms: 1600 },
          { state: "connecting", ms: 1400 },
          { state: "idle", ms: 1400 },
          { state: "listening", ms: 2800 },
          { state: "speaking", ms: 2800 },
          { state: "listening", ms: 1600 },
          // barge-in
          { state: "speaking", ms: 2400 },
          { state: "idle", ms: 1600 },
          { state: "off", ms: 1600 }
        ]
      },
      // Keyboard hold-to-talk (walkie-talkie): hold the keybinding to talk; the button
      // only connects/disconnects.
      keyboardHold: {
        handsFree: false,
        steps: [
          { state: "off", ms: 1600 },
          { state: "connecting", ms: 1400 },
          { state: "idle", ms: 2400 },
          // "Hold ⌘⇧Space to talk"
          { state: "listening", ms: 2800 },
          // key held
          { state: "speaking", ms: 2800 },
          // reply
          { state: "idle", ms: 1800 },
          { state: "listening", ms: 2600 },
          { state: "speaking", ms: 2400 },
          { state: "idle", ms: 1600 },
          { state: "off", ms: 1600 }
        ]
      },
      // Button hold-to-talk: hold the voice button to talk; a quick tap disconnects. The
      // idle+hover step previews the tap-to-disconnect affordance.
      buttonHold: {
        handsFree: false,
        steps: [
          { state: "off", ms: 1600 },
          { state: "connecting", ms: 1400 },
          { state: "idle", ms: 2200 },
          { state: "idle", hover: true, ms: 1800 },
          // tap-to-disconnect preview
          { state: "listening", ms: 2800 },
          // button held
          { state: "speaking", ms: 2800 },
          { state: "idle", ms: 1800 },
          { state: "listening", ms: 2600 },
          { state: "speaking", ms: 2400 },
          { state: "idle", ms: 1600 },
          { state: "off", ms: 1600 }
        ]
      },
      // Click-to-toggle listening: tap to start listening, tap again to stop.
      clickToggle: {
        handsFree: false,
        steps: [
          { state: "off", ms: 1600 },
          { state: "connecting", ms: 1400 },
          { state: "idle", ms: 2e3 },
          { state: "listening", ms: 2800 },
          // tapped on
          { state: "idle", ms: 1800 },
          // tapped off
          { state: "listening", ms: 2600 },
          { state: "speaking", ms: 2800 },
          // reply
          { state: "listening", ms: 1800 },
          { state: "idle", ms: 1600 },
          { state: "off", ms: 1600 }
        ]
      }
    };
  }
  static {
    this.WALK_STEP_MS = 2400;
  }
  startVoiceStateWalkthrough(version) {
    this.clearSimulation();
    const walkthrough = VoiceInputModeService.WALKTHROUGHS[version];
    this._walkVersion = version;
    this._simulatedHandsFree.set(walkthrough.handsFree, void 0);
    this._simulatedVersion.set(version, void 0);
    this._walkIndex = 0;
    const advance = () => {
      const steps = walkthrough.steps;
      const step = steps[this._walkIndex % steps.length];
      transaction((tx) => {
        this._simulatedVoiceState.set(step.state, tx);
        this._simulatedHover.set(step.hover ?? false, tx);
      });
      this._walkIndex++;
      this._walkTimer = setTimeout(advance, step.ms ?? VoiceInputModeService.WALK_STEP_MS);
    };
    advance();
  }
  stepVoiceStateWalkthrough() {
    this._stopWalkTimer();
    const version = this._walkVersion ?? "keyboardHold";
    const steps = VoiceInputModeService.WALKTHROUGHS[version].steps;
    this._walkIndex = this._walkIndex % steps.length;
    const step = steps[this._walkIndex];
    transaction((tx) => {
      this._simulatedVersion.set(version, tx);
      this._simulatedHandsFree.set(VoiceInputModeService.WALKTHROUGHS[version].handsFree, tx);
      this._simulatedVoiceState.set(step.state, tx);
      this._simulatedHover.set(step.hover ?? false, tx);
    });
    this._walkIndex++;
  }
  clearSimulation() {
    this._stopWalkTimer();
    this._walkIndex = 0;
    this._walkVersion = void 0;
    transaction((tx) => {
      this._simulatedVoiceState.set(void 0, tx);
      this._simulatedHandsFree.set(void 0, tx);
      this._simulatedVersion.set(void 0, tx);
      this._simulatedHover.set(false, tx);
    });
  }
  _stopWalkTimer() {
    if (this._walkTimer !== void 0) {
      clearTimeout(this._walkTimer);
      this._walkTimer = void 0;
    }
  }
  dispose() {
    this._stopWalkTimer();
    super.dispose();
  }
};
VoiceInputModeService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IChatSpeechToTextService)
], VoiceInputModeService);
registerSingleton(IVoiceInputModeService, VoiceInputModeService, InstantiationType.Delayed);
export {
  CHAT_VOICE_INPUT_MODE,
  IVoiceInputModeService,
  VoiceInputModeService
};
