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
import { RunOnceScheduler } from "../../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { isNumber } from "../../../../../base/common/types.js";
import { localize } from "../../../../../nls.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { SpeechTimeoutDefault } from "../../../accessibility/browser/accessibilityConfiguration.js";
import { ISpeechService, AccessibilityVoiceSettingId, SpeechToTextStatus } from "../../../speech/common/speechService.js";
import { ChatSpeechToTextState, IChatSpeechToTextService } from "../../../chat/browser/speechToText/chatSpeechToTextService.js";
import { getDictationPreparingLabel } from "../../../chat/browser/speechToText/dictationDownloadRing.js";
import { alert } from "../../../../../base/browser/ui/aria/aria.js";
import { addDisposableListener, EventType, getActiveWindow } from "../../../../../base/browser/dom.js";
import { getDefaultHoverDelegate } from "../../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { ITerminalService } from "../../../terminal/browser/terminal.js";
import { TerminalCommandId } from "../../../terminal/common/terminal.js";
import { TerminalContextKeys } from "../../../terminal/common/terminalContextKey.js";
import { TerminalInitialHintContribution } from "../../inlineHint/browser/terminal.initialHint.contribution.js";
const symbolMap = [
  ["dollar sign", "$"],
  ["double quote", '"'],
  ["open paren", "("],
  ["close paren", ")"],
  ["open parenthesis", "("],
  ["close parenthesis", ")"],
  ["open bracket", "["],
  ["close bracket", "]"],
  ["open brace", "{"],
  ["close brace", "}"],
  ["open angle bracket", "<"],
  ["close angle bracket", ">"],
  ["greater than", ">"],
  ["less than", "<"],
  ["ampersand", "&"],
  ["dollar", "$"],
  ["percent", "%"],
  ["asterisk", "*"],
  ["star", "*"],
  ["plus", "+"],
  ["equals", "="],
  ["exclamation", "!"],
  ["forward slash", "/"],
  ["slash", "/"],
  ["backslash", "\\"],
  ["pipe", "|"],
  ["tilde", "~"],
  ["caret", "^"],
  ["at sign", "@"],
  ["hashtag", "#"],
  ["pound", "#"],
  ["hash", "#"],
  ["colon", ":"],
  ["semicolon", ";"],
  ["underscore", "_"],
  ["hyphen", "-"],
  ["dash", "-"],
  ["dot", "."],
  ["period", "."],
  ["quote", "'"]
];
function postProcessTerminalDictation(text) {
  let input = text.replaceAll(/[.,?;!]/g, "");
  for (const [spoken, symbol] of symbolMap) {
    input = input.replace(new RegExp("\\b" + spoken + "\\b", "gi"), symbol);
  }
  input = input.replace(/^(\s*)([A-Z])/, (_, leading, letter) => leading + letter.toLowerCase());
  return input;
}
let TerminalVoiceSession = class extends Disposable {
  constructor(_speechService, _chatSpeechToTextService, _terminalService, _configurationService, contextKeyService, _hoverService, _keybindingService) {
    super();
    this._speechService = _speechService;
    this._chatSpeechToTextService = _chatSpeechToTextService;
    this._terminalService = _terminalService;
    this._configurationService = _configurationService;
    this._hoverService = _hoverService;
    this._keybindingService = _keybindingService;
    this._input = "";
    /** True while the current session is driven by the built-in on-device engine. */
    this._usingBuiltin = false;
    /** True while awaiting the built-in engine's final transcript during accept. */
    this._builtinFinalizing = false;
    this._sessionTerminalDisposed = false;
    this._disposables = this._register(new DisposableStore());
    this._decorationDisposables = this._register(new DisposableStore());
    this._terminalDictationInProgress = TerminalContextKeys.terminalDictationInProgress.bindTo(contextKeyService);
  }
  static {
    this._instance = void 0;
  }
  static getInstance(instantiationService) {
    if (!TerminalVoiceSession._instance) {
      TerminalVoiceSession._instance = instantiationService.createInstance(TerminalVoiceSession);
    }
    return TerminalVoiceSession._instance;
  }
  async start() {
    this.stop();
    const activeInstance = this._terminalService.activeInstance;
    this._sessionTerminalInstanceId = activeInstance?.instanceId;
    this._sessionTerminalDisposed = false;
    this._disposables.add(this._terminalService.onDidChangeActiveInstance((instance) => {
      if (instance?.instanceId !== this._sessionTerminalInstanceId) {
        this.stop();
      }
    }));
    this._disposables.add(this._terminalService.onDidDisposeInstance((instance) => {
      if (instance.instanceId === this._sessionTerminalInstanceId) {
        this._sessionTerminalDisposed = true;
        this.stop();
      }
    }));
    if (activeInstance) {
      TerminalInitialHintContribution.get(activeInstance)?.dispose();
    }
    let voiceTimeout = this._configurationService.getValue(AccessibilityVoiceSettingId.SpeechTimeout);
    if (!isNumber(voiceTimeout) || voiceTimeout < 0) {
      voiceTimeout = SpeechTimeoutDefault;
    }
    this._acceptTranscriptionScheduler = this._disposables.add(new RunOnceScheduler(() => {
      if (this._usingBuiltin) {
        this.stop(true);
        return;
      }
      this._sendText();
      this.stop();
    }, voiceTimeout));
    this._cancellationTokenSource = new CancellationTokenSource();
    this._register(toDisposable(() => this._cancellationTokenSource?.dispose(true)));
    if (this._chatSpeechToTextService.isConfigured) {
      return this._startBuiltin(voiceTimeout);
    }
    const session = await this._speechService.createSpeechToTextSession(this._cancellationTokenSource?.token, "terminal");
    this._disposables.add(session.onDidChange((e) => {
      if (this._cancellationTokenSource?.token.isCancellationRequested) {
        return;
      }
      switch (e.status) {
        case SpeechToTextStatus.Started:
          this._terminalDictationInProgress.set(true);
          if (!this._decoration) {
            this._createDecoration();
          }
          break;
        case SpeechToTextStatus.Recognizing: {
          this._updateInput(e);
          this._renderGhostText(e);
          this._updateDecoration();
          if (voiceTimeout > 0) {
            this._acceptTranscriptionScheduler.cancel();
          }
          break;
        }
        case SpeechToTextStatus.Recognized:
          this._updateInput(e);
          this._sendText();
          this._ghostText?.dispose();
          this._ghostText = void 0;
          this._ghostTextMarker?.dispose();
          this._ghostTextMarker = void 0;
          this._updateDecoration();
          this._input = "";
          break;
        case SpeechToTextStatus.Stopped:
          this.stop();
          break;
      }
    }));
  }
  /**
   * Drive terminal dictation from the built-in on-device engine. Unlike the
   * extension provider (which emits discrete `Recognizing`/`Recognized` events
   * per utterance), the built-in engine streams a single growing cumulative
   * transcript. We render it live as ghost text and keep it staged in
   * `_input`, then send it once the silence timeout elapses or the user stops.
   */
  async _startBuiltin(voiceTimeout) {
    const service = this._chatSpeechToTextService;
    if (service.isBusy) {
      await service.cancel();
    }
    if (service.state !== ChatSpeechToTextState.Idle) {
      this.stop();
      return;
    }
    this._usingBuiltin = true;
    this._terminalDictationInProgress.set(true);
    if (!this._decoration) {
      this._createDecoration();
    }
    const renderPreparing = () => {
      if (this._cancellationTokenSource?.token.isCancellationRequested || this._builtinFinalizing) {
        return;
      }
      if (service.isPreparingModel) {
        this._renderPreparingText(getDictationPreparingLabel(service));
      }
    };
    renderPreparing();
    this._disposables.add(service.onDidChangePreparingModel(() => renderPreparing()));
    this._disposables.add(service.onDidChangeModelDownloadProgress(() => renderPreparing()));
    this._disposables.add(service.onDidUpdateTranscript((update) => {
      if (this._cancellationTokenSource?.token.isCancellationRequested || this._builtinFinalizing) {
        return;
      }
      const event = { status: SpeechToTextStatus.Recognizing, text: update.text };
      this._updateInput(event);
      this._renderGhostText(event);
      this._updateDecoration();
      if (voiceTimeout > 0) {
        this._acceptTranscriptionScheduler.cancel();
        this._acceptTranscriptionScheduler.schedule();
      }
    }));
    this._disposables.add(service.onDidChangeState((state) => {
      if (state === ChatSpeechToTextState.Idle && !this._builtinFinalizing && !this._cancellationTokenSource?.token.isCancellationRequested) {
        this.stop();
      }
    }));
    try {
      await service.start(getActiveWindow(), "terminal");
    } catch {
      this.stop();
    }
  }
  /**
   * Accept the built-in dictation: fetch the engine's final transcript (the
   * last utterance is only returned by `stopAndTranscribe`, not the interim
   * stream), stage it, then tear down and send it. Used by the silence timeout
   * and the Stop Dictation action; abort/error teardown uses `cancel()` instead.
   */
  async _finalizeBuiltinThenStop() {
    let finalText;
    try {
      finalText = await this._chatSpeechToTextService.stopAndTranscribe();
    } catch {
    }
    if (!this._usingBuiltin || this._cancellationTokenSource?.token.isCancellationRequested) {
      return;
    }
    if (finalText !== void 0) {
      this._updateInput({ status: SpeechToTextStatus.Recognized, text: finalText });
    }
    this.stop(true);
  }
  stop(send) {
    if (this._usingBuiltin && send && !this._builtinFinalizing) {
      this._builtinFinalizing = true;
      this._acceptTranscriptionScheduler?.cancel();
      this._finalizeBuiltinThenStop();
      return;
    }
    if (this._builtinFinalizing && !send && !this._sessionTerminalDisposed && this._terminalService.activeInstance?.instanceId === this._sessionTerminalInstanceId) {
      return;
    }
    this._setInactive();
    if (send) {
      this._acceptTranscriptionScheduler.cancel();
      this._sendText();
    }
    this._ghostText = void 0;
    this._decoration?.dispose();
    this._decoration = void 0;
    this._marker?.dispose();
    this._marker = void 0;
    this._ghostTextMarker = void 0;
    this._cancellationTokenSource?.cancel();
    if (this._usingBuiltin) {
      void this._chatSpeechToTextService.cancel();
    }
    this._disposables.clear();
    this._input = "";
    this._terminalDictationInProgress.reset();
    this._usingBuiltin = false;
    this._builtinFinalizing = false;
    this._sessionTerminalInstanceId = void 0;
    this._sessionTerminalDisposed = false;
  }
  _sendText() {
    this._terminalService.activeInstance?.sendText(this._input, false);
    alert(localize("terminalVoiceTextInserted", "{0} inserted", this._input));
  }
  _updateInput(e) {
    if (e.text) {
      this._input = " " + postProcessTerminalDictation(e.text);
    }
  }
  _createDecoration() {
    const activeInstance = this._terminalService.activeInstance;
    const xterm = activeInstance?.xterm?.raw;
    if (!xterm) {
      return;
    }
    const onFirstLine = xterm.buffer.active.cursorY === 0;
    const inputLength = this._input.length;
    const xPosition = xterm.buffer.active.cursorX + inputLength;
    this._marker = activeInstance.registerMarker(onFirstLine ? 0 : -1);
    if (!this._marker) {
      return;
    }
    this._decoration = xterm.registerDecoration({
      marker: this._marker,
      layer: "top",
      x: xPosition
    });
    if (!this._decoration) {
      this._marker.dispose();
      this._marker = void 0;
      return;
    }
    this._decoration.onRender((e) => {
      e.classList.add(...ThemeIcon.asClassNameArray(Codicon.micFilled), "terminal-voice", "recording");
      e.style.transform = onFirstLine ? "translate(10px, -2px)" : "translate(-6px, -5px)";
      this._registerMicInteractions(e);
    });
  }
  /**
   * Make the recording mic icon a discoverable Stop affordance: clicking it
   * stops (and accepts) the dictation, mirroring the animated mic button in the
   * editor and chat input, and a hover surfaces the Escape keybinding so the
   * stop gesture is not hidden.
   */
  _registerMicInteractions(element) {
    if (element.dataset.terminalVoiceInteractive) {
      return;
    }
    element.dataset.terminalVoiceInteractive = "true";
    element.style.cursor = "pointer";
    this._decorationDisposables.add(addDisposableListener(element, EventType.CLICK, (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!this._builtinFinalizing) {
        this.stop(true);
      }
    }));
    const keybindingLabel = this._keybindingService.lookupKeybinding(TerminalCommandId.StopVoice)?.getLabel();
    const title = keybindingLabel ? localize("terminalVoice.stopDictationHover", "Stop Dictation ({0})", keybindingLabel) : localize("terminalVoice.stopDictationHoverNoKeybinding", "Stop Dictation");
    this._decorationDisposables.add(this._hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), element, title));
  }
  _updateDecoration() {
    this._decorationDisposables.clear();
    this._decoration?.dispose();
    this._marker?.dispose();
    this._decoration = void 0;
    this._marker = void 0;
    this._createDecoration();
  }
  _setInactive() {
    this._decoration?.element?.classList.remove("recording");
  }
  _renderGhostText(e) {
    this._renderGhostTextContent(e.text, "terminal-voice-progress-text");
  }
  /**
   * Render a non-transcript hint (e.g. "Preparing…/Downloading… X%") in the
   * ghost-text slot while the on-device model is still preparing on first use.
   * Styled distinctly from the live transcript so it does not read as speech.
   */
  _renderPreparingText(label) {
    this._renderGhostTextContent(label, "terminal-voice-preparing-text");
  }
  _renderGhostTextContent(text, className) {
    this._ghostText?.dispose();
    if (!text) {
      return;
    }
    const activeInstance = this._terminalService.activeInstance;
    const xterm = activeInstance?.xterm?.raw;
    if (!xterm) {
      return;
    }
    this._ghostTextMarker = activeInstance.registerMarker();
    if (!this._ghostTextMarker) {
      return;
    }
    this._disposables.add(this._ghostTextMarker);
    const onFirstLine = xterm.buffer.active.cursorY === 0;
    this._ghostText = xterm.registerDecoration({
      marker: this._ghostTextMarker,
      layer: "top",
      x: onFirstLine ? xterm.buffer.active.cursorX + 4 : xterm.buffer.active.cursorX + 1
    });
    if (this._ghostText) {
      this._disposables.add(this._ghostText);
    }
    this._ghostText?.onRender((e) => {
      e.classList.add(className);
      e.textContent = text;
      e.style.width = (xterm.cols - xterm.buffer.active.cursorX) / xterm.cols * 100 + "%";
    });
  }
};
TerminalVoiceSession = __decorateClass([
  __decorateParam(0, ISpeechService),
  __decorateParam(1, IChatSpeechToTextService),
  __decorateParam(2, ITerminalService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IHoverService),
  __decorateParam(6, IKeybindingService)
], TerminalVoiceSession);
export {
  TerminalVoiceSession,
  postProcessTerminalDictation
};
