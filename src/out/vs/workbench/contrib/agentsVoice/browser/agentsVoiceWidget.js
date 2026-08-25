import * as dom from "../../../../base/browser/dom.js";
import { observableValue, derived, autorun } from "../../../../base/common/observable.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { getWindow } from "../../../../base/browser/dom.js";
import { AGENTS_VOICE_WINDOW_DEFAULT_WIDTH, AGENTS_VOICE_WINDOW_DEFAULT_HEIGHT } from "../common/agentsVoice.js";
import { createHeader } from "./components/headerComponent.js";
import { createStatusRows } from "./components/statusRowsComponent.js";
import { createTranscript } from "./components/transcriptComponent.js";
import { createSessionList } from "./components/sessionListComponent.js";
import { createFeedbackDialog } from "./components/feedbackDialog.js";
import { createOnboarding } from "./components/onboardingComponent.js";
import { createVoiceBar } from "./components/voiceBarComponent.js";
import { FONT_SIZE, addKeyboardActivation, isSecondaryPointerGesture } from "./components/tokens.js";
import { computeVoiceMicGlowBoxShadow, voiceGlowStateColor } from "../../chat/browser/voiceClient/voiceGlow.js";
import { createVoiceGlowController } from "../../chat/browser/voiceClient/voiceGlowController.js";
const DEFAULT_OPTIONS = {
  width: AGENTS_VOICE_WINDOW_DEFAULT_WIDTH,
  draggable: true,
  showClose: true,
  showExpandChevron: true,
  showStatusText: false,
  showStatusCounters: true,
  showCopilotIcon: false,
  centerConnectButton: false,
  title: "",
  subtitle: "",
  focusable: false,
  showOnboarding: false,
  reshowOnboardingOnDisconnect: false,
  defaultExpanded: false,
  inputBoxLayout: false
};
class AgentsVoiceWidget extends Disposable {
  constructor(container, callbacks, options = {}) {
    super();
    this.container = container;
    this.callbacks = callbacks;
    // --- Reactive state ---
    this._isConnected = observableValue(this, false);
    this._isConnecting = observableValue(this, false);
    this._isReconnecting = observableValue(this, false);
    this._voiceState = observableValue(this, "idle");
    this._expanded = observableValue(this, false);
    this._workingCount = observableValue(this, 0);
    this._needsInputCount = observableValue(this, 0);
    this._doneCount = observableValue(this, 0);
    this._pendingToolConfirmations = observableValue(this, []);
    this._speakingSession = observableValue(this, void 0);
    this._speakingSessionLabel = observableValue(this, void 0);
    this._sessions = observableValue(this, []);
    this._sessionGroups = observableValue(this, void 0);
    this._selectedTargetSession = observableValue(this, void 0);
    this._transcriptTurns = observableValue(this, []);
    this._pttKeyLabel = observableValue(this, void 0);
    this._statusText = observableValue(this, "");
    this._popoutAvailable = observableValue(this, true);
    this._feedbackDialogState = observableValue(this, null);
    this._showOnboarding = observableValue(this, false);
    this._onboardingPendingConnect = observableValue(this, false);
    // --- Derived state ---
    this._shouldShowExpanded = derived(this, (reader) => this._expanded.read(reader));
    // --- DOM components ---
    this._headerComponent = createHeader();
    this._onboardingComponent = createOnboarding();
    this._feedbackDialogComponent = createFeedbackDialog();
    this._voiceBarComponent = createVoiceBar();
    this._transcriptComponent = this._register(createTranscript());
    this._inputBoxTranscriptComponent = this._register(createTranscript());
    this._statusRowsComponent = createStatusRows();
    this._sessionListComponent = createSessionList();
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._showOnboarding.set(this._options.showOnboarding, void 0);
    this._expanded.set(this._options.defaultExpanded, void 0);
    const opts = this._options;
    const widthStyle = opts.width === "auto" ? "width:100%;position:relative;" : `position:absolute;top:0;left:0;width:${opts.width}px;${opts.inputBoxLayout ? "" : `min-height:${AGENTS_VOICE_WINDOW_DEFAULT_HEIGHT}px;`}`;
    this._rootDiv = dom.$("div");
    this._rootDiv.style.cssText = `${widthStyle}display:flex;flex-direction:column;user-select:none;font-family:inherit;font-size:${FONT_SIZE.base};color:var(--vscode-foreground);box-sizing:border-box;margin:0;${opts.inputBoxLayout && opts.draggable ? "-webkit-app-region:drag;" : ""}`;
    this._glowDiv = dom.$("div");
    this._glowDiv.style.cssText = "position:absolute;top:0;left:0;right:0;height:50px;pointer-events:none;z-index:0;";
    this._titleRow = dom.$("div");
    this._titleRow.style.cssText = "display:flex;align-items:baseline;gap:6px;padding:8px 14px 0;overflow:hidden;white-space:nowrap;position:relative;z-index:1;";
    if (opts.title) {
      const titleSpan = dom.$("span");
      titleSpan.style.cssText = `font-size:${FONT_SIZE.micro};font-weight:700;color:var(--vscode-sideBarSectionHeader-foreground, var(--vscode-foreground));text-transform:uppercase;letter-spacing:0.5px;flex-shrink:0;user-select:none;`;
      titleSpan.textContent = opts.title;
      this._titleRow.append(titleSpan);
      if (opts.subtitle) {
        const subtitleSpan = dom.$("span");
        subtitleSpan.style.cssText = `font-size:${FONT_SIZE.micro};font-weight:400;color:var(--vscode-descriptionForeground);overflow:hidden;text-overflow:ellipsis;`;
        subtitleSpan.textContent = opts.subtitle;
        this._titleRow.append(subtitleSpan);
      }
    }
    this._contentDiv = dom.$("div");
    this._contentDiv.style.cssText = "display:flex;flex-direction:column;flex:1;padding:8px 14px 2px;position:relative;z-index:1;";
    this._statusTextDiv = dom.$("div");
    this._statusTextDiv.style.cssText = `text-align:center;font-size:${FONT_SIZE.body};font-weight:500;color:var(--vscode-foreground);padding:2px 0;`;
    this._sessionListWrapper = dom.$("div");
    this._sessionListWrapper.style.cssText = "display:flex;flex-direction:column;-webkit-app-region:no-drag;overflow:hidden;";
    this._sessionListWrapper.append(this._sessionListComponent.element);
    this._expandSpacer = dom.$("div");
    this._expandSpacer.style.cssText = "flex:1;";
    this._chevronWrapper = dom.$("div");
    this._chevronWrapper.role = "button";
    this._chevronWrapper.tabIndex = 0;
    this._chevronWrapper.style.cssText = "display:flex;justify-content:center;cursor:pointer;-webkit-app-region:no-drag;";
    this._chevronIcon = dom.$("span.codicon");
    this._chevronIcon.style.cssText = `font-size:${FONT_SIZE.iconSm};color:var(--vscode-descriptionForeground);`;
    this._register(dom.addDisposableListener(this._chevronIcon, "mouseenter", () => {
      this._chevronIcon.style.color = "var(--vscode-foreground)";
    }));
    this._register(dom.addDisposableListener(this._chevronIcon, "mouseleave", () => {
      this._chevronIcon.style.color = "var(--vscode-descriptionForeground)";
    }));
    this._chevronWrapper.append(this._chevronIcon);
    this._register(dom.addDisposableListener(this._chevronWrapper, "click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.callbacks.showSessionsPicker) {
        this.callbacks.showSessionsPicker();
      } else {
        this._expanded.set(!this._expanded.get(), void 0);
      }
    }));
    this._register(dom.addDisposableListener(this._chevronWrapper, "keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this._chevronWrapper.click();
      }
    }));
    if (opts.inputBoxLayout) {
      const styleEl = dom.$("style");
      styleEl.textContent = `
				@property --voice-processing-angle { syntax: '<angle>'; inherits: false; initial-value: 135deg; }
				@keyframes voice-processing-spin { from { --voice-processing-angle: 135deg; } to { --voice-processing-angle: 495deg; } }
				@keyframes agents-voice-input-icon-pulse {
					0%, 100% { box-shadow: 0 0 4px rgba(var(--agents-voice-input-icon-rgb, 88,166,255), 0.45); }
					50% { box-shadow: 0 0 10px rgba(var(--agents-voice-input-icon-rgb, 88,166,255), 0.75); }
				}
				.monaco-workbench.monaco-enable-motion .agents-voice-mode-button.agents-voice-mode-active {
					animation: agents-voice-input-icon-pulse 1.4s ease-in-out infinite;
				}
				.processing { overflow: visible !important; }
				.processing::before {
					content: ''; position: absolute; inset: -1px; border-radius: inherit; padding: 1px;
					background: conic-gradient(from var(--voice-processing-angle),
						transparent 0deg, rgba(88,166,255,0.9) 20deg, rgba(88,166,255,1) 30deg,
						rgba(88,166,255,0.6) 50deg, transparent 90deg, transparent 360deg);
					-webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
					mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
					-webkit-mask-composite: xor; mask-composite: exclude;
					animation: voice-processing-spin 3s linear infinite;
					pointer-events: none; z-index: 2;
				}
				.processing::after {
					content: ''; position: absolute; inset: -1px; border-radius: inherit; padding: 2px;
					background: conic-gradient(from var(--voice-processing-angle),
						transparent 0deg, rgba(88,166,255,0.5) 25deg, rgba(88,166,255,0.3) 50deg, transparent 90deg, transparent 360deg);
					-webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
					mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
					-webkit-mask-composite: xor; mask-composite: exclude;
					filter: blur(1.5px); animation: voice-processing-spin 3s linear infinite;
					pointer-events: none; z-index: 1;
				}
			`;
      getWindow(this.container).document.head.append(styleEl);
      this._inputBoxContainer = dom.$("div");
      this._inputBoxContainer.style.cssText = "box-sizing:border-box;background-color:var(--vscode-input-background);border:1px solid var(--vscode-input-border, transparent);border-radius:var(--vscode-cornerRadius-large, 8px);padding:10px 12px;width:100%;position:relative;min-height:32px;display:flex;align-items:center;-webkit-app-region:no-drag;";
      this._inputBoxPlaceholder = dom.$("span");
      this._inputBoxPlaceholder.style.cssText = `font-size:${FONT_SIZE.body};color:var(--vscode-input-placeholderForeground, var(--vscode-descriptionForeground));user-select:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;`;
      this._inputBoxTranscriptComponent.element.style.width = "100%";
      this._inputBoxTranscriptComponent.element.style.display = "none";
      this._inputBoxContainer.append(this._inputBoxPlaceholder, this._inputBoxTranscriptComponent.element);
      this._glowController = this._register(createVoiceGlowController(
        this._inputBoxContainer,
        () => this.callbacks.getGlowTheme(),
        () => this.callbacks.getGlowColors()
      ));
      this._register(this.callbacks.onDidChangeGlowTheme(() => this._glowController?.refreshTheme()));
      this._inputBoxToolbar = dom.$("div");
      this._inputBoxToolbar.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 4px 2px;-webkit-app-region:no-drag;";
      const toolbarBtn = (className, ariaLabel, title) => {
        const el = dom.$(`span.codicon.${className}`);
        el.role = "button";
        el.tabIndex = 0;
        el.ariaLabel = ariaLabel;
        el.title = title;
        el.style.cssText = `font-size:${FONT_SIZE.iconSm};color:var(--vscode-descriptionForeground);cursor:pointer;-webkit-app-region:no-drag;padding:2px;`;
        this._register(dom.addDisposableListener(el, "mouseenter", () => {
          el.style.color = "var(--vscode-foreground)";
        }));
        this._register(dom.addDisposableListener(el, "mouseleave", () => {
          el.style.color = "var(--vscode-descriptionForeground)";
        }));
        addKeyboardActivation(el);
        return el;
      };
      this._inputBoxMicBtn = dom.$("span.codicon.codicon-voice-mode.agents-voice-mode-button");
      this._inputBoxMicBtn.role = "button";
      this._inputBoxMicBtn.tabIndex = 0;
      this._inputBoxMicBtn.ariaLabel = localize("agentsVoice.pushToTalkSpace", "Push to talk (Space)");
      this._inputBoxMicBtn.title = localize("agentsVoice.pushToTalkSpace", "Push to talk (Space)");
      this._inputBoxMicBtn.style.cssText = `font-size:${FONT_SIZE.iconMd};cursor:pointer;-webkit-app-region:no-drag;border-radius:4px;padding:2px;`;
      this._register(dom.addDisposableListener(this._inputBoxMicBtn, "contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.callbacks.showVoiceContextMenu(e);
      }));
      this._inputBoxConnIndicator = toolbarBtn(
        "codicon-debug-connected",
        localize("agentsVoice.disconnect", "Disconnect"),
        localize("agentsVoice.disconnect", "Disconnect")
      );
      this._inputBoxFeedbackBtn = toolbarBtn(
        "codicon-feedback",
        localize("agentsVoice.sendFeedback", "Send feedback"),
        localize("agentsVoice.sendFeedback", "Send feedback")
      );
      this._inputBoxSessionsBtn = toolbarBtn(
        "codicon-list-tree",
        localize("agentsVoice.sessions", "Sessions"),
        localize("agentsVoice.sessions", "Sessions")
      );
      this._register(dom.addDisposableListener(this._inputBoxSessionsBtn, "click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._expanded.set(!this._expanded.get(), void 0);
      }));
      this._inputBoxCloseBtn = toolbarBtn(
        "codicon-chrome-minimize",
        localize("agentsVoice.minimize", "Minimize"),
        localize("agentsVoice.minimize", "Minimize")
      );
      const toolbarSpacer = dom.$("span");
      toolbarSpacer.style.flex = "1";
      this._inputBoxToolbar.append(
        this._inputBoxMicBtn,
        this._inputBoxConnIndicator,
        toolbarSpacer,
        this._inputBoxFeedbackBtn,
        this._inputBoxSessionsBtn,
        this._inputBoxCloseBtn
      );
    }
    if (opts.inputBoxLayout) {
      this._contentDiv.append(
        this._onboardingComponent.element,
        this._feedbackDialogComponent.element,
        this._inputBoxToolbar,
        this._transcriptComponent.element,
        this._sessionListWrapper,
        this._statusRowsComponent.element,
        this._inputBoxContainer
      );
    } else {
      this._contentDiv.append(
        this._onboardingComponent.element,
        this._headerComponent.element,
        this._voiceBarComponent.element,
        this._feedbackDialogComponent.element,
        this._statusTextDiv,
        this._transcriptComponent.element,
        this._statusRowsComponent.element,
        this._sessionListWrapper,
        this._expandSpacer,
        this._chevronWrapper
      );
    }
    this._rootDiv.append(this._glowDiv, this._titleRow, this._contentDiv);
    this.container.append(this._rootDiv);
    if (this._options.focusable) {
      this.container.tabIndex = 0;
      const win = getWindow(this.container);
      let pttKeyCode;
      let heldKeyCode;
      let releasedBeforeListening = false;
      const onDocKeydown = (e) => {
        heldKeyCode = e.code;
        releasedBeforeListening = false;
      };
      const onDocKeyup = (e) => {
        if (e.code === heldKeyCode) {
          heldKeyCode = void 0;
          if (pttKeyCode === void 0) {
            releasedBeforeListening = true;
          }
        }
      };
      win.document.addEventListener("keydown", onDocKeydown, true);
      win.document.addEventListener("keyup", onDocKeyup, true);
      this._register(toDisposable(() => {
        win.document.removeEventListener("keydown", onDocKeydown, true);
        win.document.removeEventListener("keyup", onDocKeyup, true);
      }));
      this._register(dom.addDisposableListener(this.container, "keydown", (e) => {
        if (!_isTextInput(e.target) && pttKeyCode && e.code === pttKeyCode) {
          e.preventDefault();
        }
      }));
      this._register(dom.addDisposableListener(this.container, "keyup", (e) => {
        if (!_isTextInput(e.target) && pttKeyCode && e.code === pttKeyCode) {
          e.preventDefault();
          pttKeyCode = void 0;
          this.callbacks.pttUp();
        }
      }));
      let wasListening = false;
      this._register(autorun((reader) => {
        const listening = this._voiceState.read(reader) === "listening";
        if (listening && !wasListening && pttKeyCode === void 0) {
          if (heldKeyCode !== void 0) {
            pttKeyCode = heldKeyCode;
          } else if (releasedBeforeListening) {
            releasedBeforeListening = false;
            this.callbacks.pttUp();
          }
        }
        if (!listening) {
          releasedBeforeListening = false;
        }
        wasListening = listening;
      }));
      const onDocPointerUp = () => this.callbacks.pttUp();
      win.document.addEventListener("pointerup", onDocPointerUp);
      this._register(toDisposable(() => win.document.removeEventListener("pointerup", onDocPointerUp)));
    }
    const pttChannel = new BroadcastChannel("vscode-ptt");
    pttChannel.onmessage = (e) => {
      if (e.data === "down") {
        this.callbacks.pttDown();
      }
      if (e.data === "up") {
        this.callbacks.pttUp();
      }
    };
    this._register(toDisposable(() => pttChannel.close()));
    const renderDisposable = autorun((reader) => {
      this._updateDOM(reader);
      getWindow(this.container).requestAnimationFrame(() => {
        this.callbacks.onResize();
      });
    });
    this._register(renderDisposable);
    this._register(toDisposable(() => dom.clearNode(this.container)));
    let sawConnecting = false;
    let failureCheckPending = false;
    let disposed = false;
    const onboardingConnectDisposable = autorun((reader) => {
      if (!this._onboardingPendingConnect.read(reader)) {
        sawConnecting = false;
        return;
      }
      if (this._isConnected.read(reader)) {
        this._onboardingPendingConnect.set(false, void 0);
        sawConnecting = false;
        this._showOnboarding.set(false, void 0);
        this.callbacks.onOnboardingCompleted?.();
        return;
      }
      if (this._isConnecting.read(reader)) {
        sawConnecting = true;
        return;
      }
      if (sawConnecting && !failureCheckPending) {
        failureCheckPending = true;
        queueMicrotask(() => {
          failureCheckPending = false;
          if (disposed) {
            return;
          }
          if (this._onboardingPendingConnect.read(void 0) && !this._isConnected.read(void 0) && !this._isConnecting.read(void 0)) {
            this._onboardingPendingConnect.set(false, void 0);
            sawConnecting = false;
          }
        });
      }
    });
    this._register(toDisposable(() => {
      disposed = true;
    }));
    this._register(onboardingConnectDisposable);
    if (this._options.reshowOnboardingOnDisconnect) {
      const reshowDisposable = autorun((reader) => {
        const connected = this._isConnected.read(reader);
        const connecting = this._isConnecting.read(reader);
        const reconnecting = this._isReconnecting.read(reader);
        const pendingConnect = this._onboardingPendingConnect.read(reader);
        if (!connected && !connecting && !reconnecting && !pendingConnect) {
          if (!this._showOnboarding.read(reader)) {
            this._showOnboarding.set(true, void 0);
          }
        }
      });
      this._register(reshowDisposable);
    }
    this._register(autorun((reader) => {
      const onboarding = this._showOnboarding.read(reader);
      const voiceState = this._voiceState.read(reader);
      if (onboarding || voiceState === "listening" || voiceState === "speaking") {
        this._startWaveformAnimation();
      } else {
        this._stopWaveformAnimation();
      }
    }));
    this._register(toDisposable(() => this._stopWaveformAnimation()));
  }
  _updateDOM(reader) {
    if (this._options.inputBoxLayout) {
      this._updateDOMInputBoxLayout(reader);
    } else {
      this._updateDOMClassicLayout(reader);
    }
  }
  _updateDOMInputBoxLayout(reader) {
    const onboarding = this._showOnboarding.read(reader);
    const voiceState = this._voiceState.read(reader);
    const isConnected = this._isConnected.read(reader);
    const isConnecting = this._isConnecting.read(reader);
    const isReconnecting = this._isReconnecting.read(reader);
    const showConnected = isConnected || isReconnecting;
    const opts = this._options;
    const showExpanded = this._shouldShowExpanded.read(reader) && opts.showExpandChevron;
    const baseWidth = typeof opts.width === "number" ? opts.width : AGENTS_VOICE_WINDOW_DEFAULT_WIDTH;
    this._rootDiv.style.width = `${baseWidth}px`;
    this._titleRow.style.display = onboarding || !opts.title ? "none" : "flex";
    if (onboarding) {
      this._onboardingComponent.element.style.display = "";
      this._feedbackDialogComponent.element.style.display = "none";
      this._inputBoxContainer.style.display = "none";
      this._transcriptComponent.element.style.display = "none";
      this._statusRowsComponent.element.style.display = "none";
      this._sessionListWrapper.style.display = "none";
      this._inputBoxToolbar.style.display = "none";
      this._onboardingComponent.update({
        pttKeyLabel: this._pttKeyLabel.read(reader),
        isConnecting: this._onboardingPendingConnect.read(reader) || isConnecting,
        onGetStarted: (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._dismissOnboarding(true);
        },
        onOpenPttKeySettings: (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.callbacks.openPttKeySettings();
        },
        onOpenPopout: this.callbacks.openPopout ? (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.callbacks.openPopout?.();
        } : void 0
      });
      return;
    }
    this._onboardingComponent.element.style.display = "none";
    const feedbackState = this._feedbackDialogState.read(reader);
    if (feedbackState) {
      this._feedbackDialogComponent.element.style.display = "";
      this._feedbackDialogComponent.update({
        onSubmit: (text) => this._submitFeedback(text),
        onCancel: () => {
          this._feedbackDialogState.set(null, void 0);
        }
      }, feedbackState);
      this._inputBoxContainer.style.display = "none";
      this._transcriptComponent.element.style.display = "none";
      this._statusRowsComponent.element.style.display = "none";
      this._sessionListWrapper.style.display = "none";
      this._inputBoxToolbar.style.display = "none";
      return;
    }
    this._feedbackDialogComponent.element.style.display = "none";
    this._inputBoxContainer.style.display = "flex";
    const transcriptTurns = this._transcriptTurns.read(reader);
    const hasTranscript = transcriptTurns.some((t) => t.text.length > 0 || t.speaker === "user" && t.isPartial);
    const shouldShowInputGlow = showConnected && (voiceState === "listening" || voiceState === "speaking");
    if (!shouldShowInputGlow) {
      this._glowController?.clear();
    }
    this._inputBoxContainer.classList.toggle("processing", voiceState === "processing");
    if (hasTranscript) {
      if (showExpanded) {
        this._transcriptComponent.element.style.display = "";
        this._transcriptComponent.element.style.padding = "8px 12px";
        this._transcriptComponent.element.style.borderBottom = "1px solid var(--vscode-widget-border, var(--vscode-input-border, transparent))";
        this._transcriptComponent.update({ turns: transcriptTurns, chatStyle: true });
        this._inputBoxPlaceholder.style.display = "none";
        this._inputBoxTranscriptComponent.element.style.display = "none";
      } else {
        this._inputBoxPlaceholder.style.display = "none";
        this._transcriptComponent.element.style.display = "none";
        this._transcriptComponent.element.style.padding = "";
        this._transcriptComponent.element.style.borderBottom = "";
        this._inputBoxTranscriptComponent.element.style.display = "";
        this._inputBoxTranscriptComponent.update({ turns: transcriptTurns, chatStyle: true, scrollToTop: true });
      }
    } else {
      this._inputBoxPlaceholder.style.display = "";
      this._inputBoxTranscriptComponent.element.style.display = "none";
      this._transcriptComponent.element.style.display = "none";
      const keyLabel2 = this._pttKeyLabel.read(reader);
      if (isReconnecting) {
        this._inputBoxPlaceholder.textContent = localize("agentsVoice.reconnecting", "Reconnecting...");
      } else if (isConnecting) {
        this._inputBoxPlaceholder.textContent = localize("agentsVoice.connecting", "Connecting...");
      } else if (isConnected && voiceState === "listening") {
        this._inputBoxPlaceholder.textContent = localize("agentsVoice.listening", "Listening");
      } else if (isConnected && voiceState === "speaking") {
        this._inputBoxPlaceholder.textContent = keyLabel2 ? localize("agentsVoice.pressToBargeIn", "Speak or use {0}", keyLabel2) : localize("agentsVoice.speakToBargeIn", "Speak to barge in");
      } else if (isConnected) {
        this._inputBoxPlaceholder.textContent = keyLabel2 ? localize("agentsVoice.holdToTalkOrBargeIn", "Hold {0} to talk or barge in", keyLabel2) : localize("agentsVoice.holdMicToTalkOrBargeIn", "Hold the mic to talk or barge in");
      } else if (keyLabel2) {
        this._inputBoxPlaceholder.textContent = localize("agentsVoice.holdToTalk", "Hold {0} to talk", keyLabel2);
      } else {
        this._inputBoxPlaceholder.textContent = localize("agentsVoice.clickMicToTalk", "Click voice mode to talk");
      }
    }
    if (!showExpanded) {
      this._statusRowsComponent.element.style.display = "none";
      this._sessionListWrapper.style.display = "none";
    } else {
      this._statusRowsComponent.element.style.display = "none";
      this._sessionListWrapper.style.display = "";
      this._sessionListWrapper.style.maxHeight = "200px";
      this._sessionListWrapper.style.overflowY = "auto";
      this._sessionListWrapper.style.scrollbarWidth = "none";
      this._sessionListComponent.update({
        sessions: this._sessions.read(reader),
        groups: this._sessionGroups.read(reader),
        selectedTarget: this._selectedTargetSession.read(reader),
        onOpenSession: (r) => this.callbacks.openSession(r),
        onStopSession: (r) => this.callbacks.stopSession(r),
        onCancelSession: (r) => this.callbacks.cancelSession(r),
        onSelectTarget: (r) => {
          this._selectedTargetSession.set(r, void 0);
          this.callbacks.selectTargetSession(r);
        },
        onNewSession: () => this.callbacks.newSessionAsTarget()
      });
    }
    this._inputBoxToolbar.style.display = "flex";
    this._inputBoxMicBtn.style.display = "";
    const keyLabel = this._pttKeyLabel.read(reader);
    const micTooltip = keyLabel ? localize("agentsVoice.pushToTalkKey", "Push to talk ({0})", keyLabel) : localize("agentsVoice.pushToTalk", "Push to talk");
    this._inputBoxMicBtn.title = micTooltip;
    this._inputBoxMicBtn.ariaLabel = micTooltip;
    const micColor = voiceState === "error" ? "var(--vscode-editorError-foreground)" : voiceState === "listening" ? "var(--vscode-editorInfo-foreground)" : voiceState === "speaking" ? "var(--vscode-agentsVoice-speakingForeground)" : "var(--vscode-descriptionForeground)";
    this._inputBoxMicBtn.style.color = micColor;
    const micIsActive = voiceState === "listening" || voiceState === "speaking";
    this._inputBoxMicBtn.classList.toggle("agents-voice-mode-active", micIsActive);
    this._inputBoxMicBtn.style.setProperty("--agents-voice-input-icon-rgb", voiceState === "speaking" ? "163,113,247" : "88,166,255");
    this._inputBoxMicBtn.style.borderRadius = "50%";
    if (!micIsActive) {
      this._inputBoxMicBtn.style.boxShadow = "none";
    }
    this._inputBoxMicBtn.onmousedown = (e) => {
      if (isSecondaryPointerGesture(e)) {
        return;
      }
      e.preventDefault();
      this.callbacks.pttDown();
    };
    this._inputBoxMicBtn.onmouseup = (e) => {
      if (isSecondaryPointerGesture(e)) {
        return;
      }
      this.callbacks.pttUp();
    };
    this._inputBoxConnIndicator.style.display = showConnected ? "" : "none";
    this._inputBoxConnIndicator.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.callbacks.disconnect();
    };
    this._inputBoxFeedbackBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._toggleFeedbackDialog();
    };
    this._inputBoxSessionsBtn.style.display = "";
    this._inputBoxSessionsBtn.className = `codicon codicon-${showExpanded ? "chevron-up" : "list-tree"}`;
    this._inputBoxSessionsBtn.title = showExpanded ? localize("agentsVoice.collapseSessions", "Collapse sessions") : localize("agentsVoice.sessions", "Sessions");
    this._inputBoxCloseBtn.style.display = opts.showClose ? "" : "none";
    this._inputBoxCloseBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.callbacks.closeWindow();
    };
  }
  _updateDOMClassicLayout(reader) {
    const onboarding = this._showOnboarding.read(reader);
    const voiceState = this._voiceState.read(reader);
    const opts = this._options;
    const showExpanded = this._shouldShowExpanded.read(reader) && opts.showExpandChevron;
    this._titleRow.style.display = onboarding || !opts.title ? "none" : "flex";
    if (onboarding) {
      this._onboardingComponent.element.style.display = "";
      this._headerComponent.element.style.display = "none";
      this._voiceBarComponent.element.style.display = "none";
      this._feedbackDialogComponent.element.style.display = "none";
      this._statusTextDiv.style.display = "none";
      this._transcriptComponent.element.style.display = "none";
      this._statusRowsComponent.element.style.display = "none";
      this._sessionListWrapper.style.display = "none";
      this._expandSpacer.style.display = "none";
      this._chevronWrapper.style.display = "none";
      this._onboardingComponent.update({
        pttKeyLabel: this._pttKeyLabel.read(reader),
        isConnecting: this._onboardingPendingConnect.read(reader) || this._isConnecting.read(reader),
        onGetStarted: (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._dismissOnboarding(true);
        },
        onOpenPttKeySettings: (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.callbacks.openPttKeySettings();
        },
        onOpenPopout: this.callbacks.openPopout ? (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.callbacks.openPopout?.();
        } : void 0
      });
    } else {
      this._onboardingComponent.element.style.display = "none";
      this._headerComponent.element.style.display = "";
      const feedbackState = this._feedbackDialogState.read(reader);
      this._headerComponent.update({
        copilotIconSrc: this.callbacks.copilotIconSrc,
        showCopilotIcon: opts.showCopilotIcon,
        isConnected: this._isConnected.read(reader),
        isConnecting: this._isConnecting.read(reader),
        isReconnecting: this._isReconnecting.read(reader),
        voiceState,
        draggable: opts.draggable,
        showClose: opts.showClose,
        showPopout: !!this.callbacks.openPopout && this._popoutAvailable.read(reader),
        hideDisconnect: this.callbacks.hideDisconnect,
        centerConnectButton: opts.centerConnectButton,
        onMicDown: (e) => {
          e.preventDefault();
          this.callbacks.pttDown();
        },
        onMicUp: () => {
          this.callbacks.pttUp();
        },
        onConnectClick: (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (this._isConnecting.get()) {
            return;
          }
          if (this._isConnected.get()) {
            this.callbacks.disconnect();
          } else {
            this.callbacks.connect();
          }
        },
        onDisconnectClick: (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.callbacks.disconnect();
        },
        onCloseClick: (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.callbacks.closeWindow();
        },
        onToggleClick: (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._expanded.set(!this._expanded.get(), void 0);
        },
        onMicContextMenu: (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.callbacks.showVoiceContextMenu(e);
        },
        onPopoutClick: (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.callbacks.openPopout?.();
        },
        onFeedbackClick: (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._toggleFeedbackDialog();
        },
        pttKeyLabel: this._pttKeyLabel.read(reader),
        expanded: showExpanded
      });
      if (feedbackState) {
        this._voiceBarComponent.element.style.display = "none";
        this._feedbackDialogComponent.element.style.display = "";
        this._feedbackDialogComponent.update({
          onSubmit: (text) => this._submitFeedback(text),
          onCancel: () => {
            this._feedbackDialogState.set(null, void 0);
          }
        }, feedbackState);
        this._statusTextDiv.style.display = "none";
        this._transcriptComponent.element.style.display = "none";
        this._statusRowsComponent.element.style.display = "none";
        this._sessionListWrapper.style.display = "none";
        this._expandSpacer.style.display = "none";
        this._chevronWrapper.style.display = "none";
      } else {
        this._feedbackDialogComponent.element.style.display = "none";
        this._voiceBarComponent.update({
          voiceState,
          speakingSessionLabel: this._speakingSessionLabel.read(reader),
          speakingSession: this._speakingSession.read(reader),
          onStopSpeech: () => this.callbacks.stopPlayback()
        });
        const statusText = this._statusText.read(reader);
        const isError = voiceState === "error";
        if ((opts.showStatusText || isError) && statusText) {
          this._statusTextDiv.style.display = "";
          this._statusTextDiv.textContent = statusText;
          this._statusTextDiv.style.color = isError ? "var(--vscode-editorError-foreground)" : "var(--vscode-foreground)";
        } else {
          this._statusTextDiv.style.display = "none";
        }
        this._transcriptComponent.update({ turns: this._transcriptTurns.read(reader) });
        if (!showExpanded) {
          this._statusRowsComponent.element.style.display = "";
          this._statusRowsComponent.update({
            workingCount: this._workingCount.read(reader),
            needsInputCount: this._needsInputCount.read(reader),
            doneCount: this._doneCount.read(reader),
            showCounters: opts.showStatusCounters,
            speakingSessionLabel: this._speakingSessionLabel.read(reader),
            speakingSessionResource: this._speakingSession.read(reader),
            pendingToolConfirmations: this._pendingToolConfirmations.read(reader),
            onOpenSession: (r) => this.callbacks.openSession(r)
          });
          this._sessionListWrapper.style.display = "none";
        } else {
          this._statusRowsComponent.element.style.display = "none";
          this._sessionListWrapper.style.display = "";
          this._sessionListComponent.update({
            sessions: this._sessions.read(reader),
            groups: this._sessionGroups.read(reader),
            selectedTarget: this._selectedTargetSession.read(reader),
            onOpenSession: (r) => this.callbacks.openSession(r),
            onStopSession: (r) => this.callbacks.stopSession(r),
            onCancelSession: (r) => this.callbacks.cancelSession(r),
            onSelectTarget: (r) => {
              this._selectedTargetSession.set(r, void 0);
              this.callbacks.selectTargetSession(r);
            },
            onNewSession: () => this.callbacks.newSessionAsTarget()
          });
        }
        this._expandSpacer.style.display = "";
        this._chevronWrapper.style.display = opts.showExpandChevron ? "flex" : "none";
        this._chevronWrapper.title = showExpanded ? "Collapse sessions" : "Expand sessions";
        this._chevronIcon.className = `codicon codicon-${showExpanded ? "chevron-up" : "chevron-down"}`;
      }
    }
  }
  // --- Public state setters (called by the service) ---
  setConnected(connected) {
    this._isConnected.set(connected, void 0);
  }
  setConnecting(connecting) {
    this._isConnecting.set(connecting, void 0);
  }
  setReconnecting(reconnecting) {
    this._isReconnecting.set(reconnecting, void 0);
  }
  setVoiceState(state) {
    this._voiceState.set(state, void 0);
  }
  setStatusCounts(working, needsInput, done) {
    this._workingCount.set(working, void 0);
    this._needsInputCount.set(needsInput, void 0);
    this._doneCount.set(done, void 0);
  }
  setPendingToolConfirmations(confirmations) {
    this._pendingToolConfirmations.set(confirmations, void 0);
  }
  setSpeakingSession(session, label) {
    this._speakingSession.set(session, void 0);
    this._speakingSessionLabel.set(label, void 0);
  }
  setSessions(sessions) {
    this._sessions.set(sessions, void 0);
  }
  setSelectedTargetSession(resource) {
    this._selectedTargetSession.set(resource, void 0);
  }
  setSessionGroups(groups) {
    this._sessionGroups.set(groups, void 0);
  }
  setPttKeyLabel(label) {
    this._pttKeyLabel.set(label, void 0);
  }
  setTranscriptTurns(turns) {
    this._transcriptTurns.set(turns, void 0);
  }
  setStatusText(text) {
    this._statusText.set(text, void 0);
  }
  setPopoutAvailable(available) {
    this._popoutAvailable.set(available, void 0);
  }
  // --- Feedback dialog ---
  _toggleFeedbackDialog() {
    if (this._feedbackDialogState.get()) {
      this._feedbackDialogState.set(null, void 0);
    } else {
      this._showOnboarding.set(false, void 0);
      this._feedbackDialogState.set({ isSubmitting: false, submitted: false }, void 0);
    }
  }
  // --- Onboarding ---
  _dismissOnboarding(connect = false) {
    if (connect) {
      if (this._isConnected.get()) {
        this._showOnboarding.set(false, void 0);
        this.callbacks.onOnboardingCompleted?.();
        return;
      }
      if (!this._isConnecting.get() && !this._onboardingPendingConnect.get()) {
        this._onboardingPendingConnect.set(true, void 0);
        this.callbacks.connect();
      }
    } else {
      this._showOnboarding.set(false, void 0);
      this.callbacks.onOnboardingCompleted?.();
    }
  }
  /**
   * Externally trigger onboarding dismissal (e.g. when the user connects
   * from the floating mini-view, the main panel should drop the onboarding).
   * Also clears any in-flight pending-connect state so a later success
   * doesn't re-trigger the completion callback.
   */
  dismissOnboarding() {
    this._onboardingPendingConnect.set(false, void 0);
    if (this._showOnboarding.get()) {
      this._showOnboarding.set(false, void 0);
    }
  }
  _submitFeedback(text) {
    this._feedbackDialogState.set({ isSubmitting: true, submitted: false }, void 0);
    this.callbacks.submitFeedback(text).then((result) => {
      if (result.ok) {
        this._feedbackDialogState.set({ isSubmitting: false, submitted: true }, void 0);
        setTimeout(() => {
          this._feedbackDialogState.set(null, void 0);
        }, 3e3);
      } else {
        this._feedbackDialogState.set({ isSubmitting: false, submitted: false, error: result.error ?? localize("agentsVoice.feedbackError", "Failed to submit") }, void 0);
      }
    });
  }
  _startWaveformAnimation() {
    if (this._animationFrameId !== void 0) {
      return;
    }
    const animate = () => {
      this._animationFrameId = getWindow(this.container).requestAnimationFrame(animate);
      const onboarding = this._showOnboarding.get();
      const voiceState = this._voiceState.get();
      if (!(onboarding || voiceState === "listening" || voiceState === "speaking")) {
        return;
      }
      const analyser = this.callbacks.getAnalyserNode();
      let intensity;
      if (onboarding) {
        intensity = 0.6;
      } else if (!analyser) {
        intensity = 0.3;
      } else {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        intensity = Math.min(1, sum / dataArray.length / 80);
      }
      if (this._glowController && (voiceState === "listening" || voiceState === "speaking")) {
        this._glowController.render(voiceState, intensity, this.callbacks.isMotionReduced());
      }
      const colors = this.callbacks.getGlowColors();
      if (this._inputBoxMicBtn) {
        const iconGlowActive = voiceState === "listening" || voiceState === "speaking";
        this._inputBoxMicBtn.style.boxShadow = iconGlowActive ? computeVoiceMicGlowBoxShadow(voiceState, intensity, colors) : "none";
      }
      this._glowDiv.style.display = "";
      const baseOpacity = 0.15 + intensity * 0.4;
      const { r, g, b } = voiceGlowStateColor(onboarding ? "speaking" : voiceState, colors).rgba;
      const rgb = `${r},${g},${b}`;
      this._glowDiv.style.background = `radial-gradient(ellipse 40% 70% at 50% 0%, rgba(${rgb},${baseOpacity}) 0%, transparent 100%), radial-gradient(ellipse 70% 100% at 50% 0%, rgba(${rgb},${baseOpacity * 0.4}) 0%, transparent 100%)`;
    };
    this._animationFrameId = getWindow(this.container).requestAnimationFrame(animate);
  }
  _stopWaveformAnimation() {
    if (this._animationFrameId !== void 0) {
      getWindow(this.container).cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = void 0;
    }
    this._glowDiv.style.display = "none";
    this._glowController?.clear();
    if (this._inputBoxMicBtn) {
      this._inputBoxMicBtn.style.boxShadow = "none";
    }
  }
}
function _isTextInput(target) {
  if (!target || typeof target.tagName !== "string") {
    return false;
  }
  const el = target;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "INPUT") {
    return true;
  }
  return el.isContentEditable === true;
}
export {
  AgentsVoiceWidget
};
