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
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { disposableWindowInterval, getWindow } from "../../../../base/browser/dom.js";
import { FileAccess } from "../../../../base/common/network.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IAuxiliaryWindowService } from "../../../services/auxiliaryWindow/browser/auxiliaryWindowService.js";
import { IAgentsVoiceWindowService, AgentsVoiceStorageKeys, AGENTS_VOICE_WINDOW_DEFAULT_WIDTH, AGENTS_VOICE_WINDOW_DEFAULT_HEIGHT } from "../common/agentsVoice.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { IAgentSessionsService } from "../../chat/browser/agentSessions/agentSessionsService.js";
import { IAgentTitleBarStatusService } from "../../chat/browser/agentSessions/experiments/agentTitleBarStatusService.js";
import { IMicCaptureService } from "../../chat/browser/voiceClient/micCaptureService.js";
import { ITtsPlaybackService } from "../../chat/browser/voiceClient/ttsPlaybackService.js";
import { IVoiceSessionController } from "../../chat/browser/voiceClient/voiceSessionController.js";
import { IVoicePlaybackService } from "../../chat/common/voicePlaybackService.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IChatService } from "../../chat/common/chatService/chatService.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { isDark } from "../../../../platform/theme/common/theme.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { resolveVoiceGlowColors } from "../../chat/browser/voiceClient/voiceGlow.js";
import { editorBackground } from "../../../../platform/theme/common/colorRegistry.js";
import { inputBackground, inputBorder } from "../../../../platform/theme/common/colors/inputColors.js";
import { AgentsVoiceWidget } from "./agentsVoiceWidget.js";
import { bindWidgetToController } from "./agentsVoiceWidgetBinding.js";
import { AgentsVoiceSessionsPicker } from "./agentsVoiceSessionsPicker.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { StandardMouseEvent } from "../../../../base/browser/mouseEvent.js";
import { getVoiceModeContextMenuActions } from "../../chat/browser/speechToText/micButtonMenuActions.js";
let AgentsVoiceWindowService = class extends Disposable {
  /**
   * Calls setWindowAlwaysOnTop via a registered command (Electron only).
   * Avoids importing INativeHostService in the browser layer.
   */
  constructor(auxiliaryWindowService, storageService, configurationService, hostService, agentSessionsService, agentTitleBarStatusService, micCaptureService, ttsPlaybackService, voiceSessionController, voicePlaybackService, commandService, chatService, workspaceContextService, environmentService, themeService, accessibilityService, keybindingService, instantiationService, contextMenuService) {
    super();
    this.auxiliaryWindowService = auxiliaryWindowService;
    this.storageService = storageService;
    this.configurationService = configurationService;
    this.hostService = hostService;
    this.agentSessionsService = agentSessionsService;
    this.agentTitleBarStatusService = agentTitleBarStatusService;
    this.micCaptureService = micCaptureService;
    this.ttsPlaybackService = ttsPlaybackService;
    this.voiceSessionController = voiceSessionController;
    this.voicePlaybackService = voicePlaybackService;
    this.commandService = commandService;
    this.chatService = chatService;
    this.workspaceContextService = workspaceContextService;
    this.environmentService = environmentService;
    this.themeService = themeService;
    this.accessibilityService = accessibilityService;
    this.keybindingService = keybindingService;
    this.instantiationService = instantiationService;
    this.contextMenuService = contextMenuService;
    this._onDidChangeOpen = this._register(new Emitter());
    this.onDidChangeOpen = this._onDidChangeOpen.event;
    this._auxiliaryWindowRef = this._register(new MutableDisposable());
    this._windowDisposables = this._register(new DisposableStore());
    const ownershipChannel = new BroadcastChannel("agents-voice-ownership");
    ownershipChannel.onmessage = (e) => {
      if (e.data?.type === "claim" && this._window) {
        this.closeWindow();
      }
    };
    this._register({ dispose: () => ownershipChannel.close() });
    this._ownershipChannel = ownershipChannel;
    const onBeforeUnload = () => {
      if (this._window) {
        this.closeWindow();
      }
    };
    mainWindow.addEventListener("beforeunload", onBeforeUnload);
    this._register({ dispose: () => mainWindow.removeEventListener("beforeunload", onBeforeUnload) });
    const wasOpen = this.storageService.getBoolean(AgentsVoiceStorageKeys.WindowOpen, StorageScope.WORKSPACE, false);
    if (wasOpen) {
      this.storageService.store(AgentsVoiceStorageKeys.WindowOpen, false, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    }
  }
  get isOpen() {
    return !!this._window;
  }
  async openWindow() {
    if (this._window) {
      return;
    }
    const bounds = this.loadBounds();
    const auxiliaryWindow = await this.auxiliaryWindowService.open({
      bounds,
      alwaysOnTop: true,
      frameless: true,
      transparent: false,
      disableFullscreen: true,
      nativeTitlebar: false,
      noBackgroundThrottling: true,
      backgroundColor: this.themeService.getColorTheme().getColor(editorBackground)?.toString() ?? "#1e1e1e"
    });
    this._window = auxiliaryWindow;
    this._auxiliaryWindowRef.value = auxiliaryWindow;
    const workspace = this.workspaceContextService.getWorkspace();
    const projectName = workspace.folders.length > 0 ? workspace.folders[0].name : "";
    auxiliaryWindow.window.document.title = projectName ? `Agents Voice \u2014 ${projectName}` : "Agents Voice";
    auxiliaryWindow.container.style.overflow = "hidden";
    auxiliaryWindow.window.document.body.style.setProperty("margin", "0", "important");
    const theme = this.themeService.getColorTheme();
    const bgColor = theme.getColor(editorBackground)?.toString() ?? "#1e1e1e";
    const inputBg = theme.getColor(inputBackground)?.toString() ?? "#3C3C3C";
    const inputBd = theme.getColor(inputBorder)?.toString() ?? "transparent";
    auxiliaryWindow.container.style.setProperty("--vscode-agents-background", bgColor);
    auxiliaryWindow.container.style.backgroundColor = inputBg;
    auxiliaryWindow.container.style.border = `1px solid ${inputBd}`;
    auxiliaryWindow.container.style.boxSizing = "border-box";
    auxiliaryWindow.window.document.body.style.setProperty("background-color", inputBg, "important");
    this._windowDisposables.clear();
    const widget = new AgentsVoiceWidget(auxiliaryWindow.container, {
      copilotIconSrc: FileAccess.asBrowserUri("vs/sessions/browser/media/sessions-icon.svg").toString(true),
      hideDisconnect: this.configurationService.getValue("agents.voice.handsFree") === true,
      connect: () => {
        this.storageService.store(AgentsVoiceStorageKeys.OnboardingCompleted, true, StorageScope.PROFILE, StorageTarget.USER);
        this.voiceSessionController.connect(mainWindow);
      },
      disconnect: () => this.voiceSessionController.disconnect("explicit"),
      pttDown: () => {
        if (!this.voiceSessionController.isConnected.get() && !this.voiceSessionController.isConnecting.get()) {
          this.voiceSessionController.connect(mainWindow).then(() => {
            if (this.voiceSessionController.isConnected.get()) {
              this.voiceSessionController.pttDown();
            }
          });
          return;
        }
        this.voiceSessionController.pttDown();
      },
      pttUp: () => this.voiceSessionController.pttUp(),
      closeWindow: () => this.closeWindow(),
      stopPlayback: () => this.ttsPlaybackService.stopPlayback(),
      openSession: (resource) => {
        this.commandService.executeCommand("_chat.voice.switchToSession", resource.toString());
        this.hostService.focus(mainWindow);
      },
      stopSession: (resource) => {
        const model = this.chatService.getSession(resource);
        if (model) {
          const lastReq = model.getRequests().at(-1);
          if (lastReq) {
            this.voiceSessionController.markUserCancelled(resource.toString());
            this.chatService.cancelCurrentRequestForSession(resource);
          }
        }
      },
      cancelSession: (resource) => {
        this.voiceSessionController.markUserCancelled(resource.toString());
        this.chatService.cancelCurrentRequestForSession(resource);
      },
      selectTargetSession: (resource) => {
        this.voiceSessionController.setTargetSession(resource);
        if (resource) {
          this.commandService.executeCommand("_chat.voice.switchToSession", resource.toString()).catch(() => {
          });
        }
      },
      newSessionAsTarget: () => {
        this.voiceSessionController.newSessionAsTarget();
      },
      getAnalyserNode: () => {
        const state = this.voiceSessionController.voiceState.get();
        return this.ttsPlaybackService.analyserNode ?? (state === "listening" ? this.micCaptureService.analyserNode : null) ?? null;
      },
      onResize: () => this._resizeWindow(auxiliaryWindow),
      getGlowTheme: () => isDark(this.themeService.getColorTheme().type) ? "dark" : "light",
      getGlowColors: () => resolveVoiceGlowColors(this.themeService.getColorTheme()),
      isMotionReduced: () => this.accessibilityService.isMotionReduced(),
      onDidChangeGlowTheme: Event.map(this.themeService.onDidColorThemeChange, () => void 0),
      openPttKeySettings: () => this.commandService.executeCommand("workbench.action.openGlobalKeybindings", "agentsVoice.pushToTalk"),
      showVoiceContextMenu: (e) => {
        const anchor = new StandardMouseEvent(getWindow(e.target ?? auxiliaryWindow.container), e);
        this.contextMenuService.showContextMenu({
          getAnchor: () => anchor,
          getActions: () => getVoiceModeContextMenuActions(this.commandService, this.configurationService, this.keybindingService, "agentsVoice.pushToTalk")
        });
      },
      submitFeedback: (text) => this.voiceSessionController.submitFeedback(text),
      showSessionsPicker: () => {
        const picker = this.instantiationService.createInstance(
          AgentsVoiceSessionsPicker,
          (resource) => this.voiceSessionController.setTargetSession(resource)
        );
        picker.show();
      }
    }, {
      defaultExpanded: false,
      inputBoxLayout: true,
      // Make the aux-window container focusable so keyboard Push-to-Talk
      // (the `agentsVoice.pushToTalk` keybinding) can be received and its
      // key-release tracking is registered. Without this the keyboard-PTT
      // handlers are never wired and a held key never stops recording.
      focusable: true
    });
    this._windowDisposables.add(widget);
    const getPttLabel = () => this.keybindingService.lookupKeybinding("agentsVoice.pushToTalk")?.getLabel() ?? void 0;
    widget.setPttKeyLabel(getPttLabel());
    this._windowDisposables.add(this.keybindingService.onDidUpdateKeybindings(() => {
      widget.setPttKeyLabel(getPttLabel());
    }));
    this._windowDisposables.add(bindWidgetToController(widget, {
      voiceSessionController: this.voiceSessionController,
      agentSessionsService: this.agentSessionsService,
      agentTitleBarStatusService: this.agentTitleBarStatusService,
      voicePlaybackService: this.voicePlaybackService,
      environmentService: this.environmentService,
      chatService: this.chatService,
      configurationService: this.configurationService
    }));
    this.agentSessionsService.model.resolve(void 0);
    this._windowDisposables.add(disposableWindowInterval(auxiliaryWindow.window, () => {
      this.agentSessionsService.model.resolve(void 0);
    }, 3e3));
    Event.once(auxiliaryWindow.onUnload)(() => {
      this.voiceSessionController.setTargetSession(void 0);
      this.voiceSessionController.disconnect();
      this._window = void 0;
      this._windowDisposables.clear();
      this._auxiliaryWindowRef.value = void 0;
      this.storageService.store(AgentsVoiceStorageKeys.WindowOpen, false, StorageScope.WORKSPACE, StorageTarget.MACHINE);
      this._onDidChangeOpen.fire(false);
    });
    this.storageService.store(AgentsVoiceStorageKeys.WindowOpen, true, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    this._onDidChangeOpen.fire(true);
  }
  closeWindow() {
    if (!this._window) {
      return;
    }
    this.saveBounds(this._window);
    this.voiceSessionController.setTargetSession(void 0);
    this.storageService.store(AgentsVoiceStorageKeys.WindowOpen, false, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    this._window = void 0;
    this._windowDisposables.clear();
    this._auxiliaryWindowRef.value = void 0;
    this._onDidChangeOpen.fire(false);
  }
  async toggleWindow() {
    if (this.isOpen) {
      this.closeWindow();
    } else {
      this._ownershipChannel.postMessage({ type: "claim" });
      await this.openWindow();
    }
  }
  // --- Window sizing ---
  _resizeWindow(auxiliaryWindow) {
    if (this._resizeTimeout) {
      clearTimeout(this._resizeTimeout);
    }
    this._resizeTimeout = setTimeout(() => {
      this._resizeTimeout = void 0;
      this._doResizeWindow(auxiliaryWindow);
    }, 100);
  }
  _doResizeWindow(auxiliaryWindow) {
    const pill = auxiliaryWindow.container.querySelector("div");
    if (!pill) {
      return;
    }
    void pill.offsetWidth;
    const pillWidth = pill.offsetWidth;
    const pillHeight = pill.offsetHeight;
    if (pillWidth <= 0 || pillHeight <= 0) {
      return;
    }
    const currentWidth = auxiliaryWindow.window.outerWidth;
    const currentHeight = auxiliaryWindow.window.outerHeight;
    if (pillWidth !== currentWidth || pillHeight !== currentHeight) {
      try {
        const screenBottom = auxiliaryWindow.window.screen.availHeight;
        const maxHeight = screenBottom - auxiliaryWindow.window.screenY;
        const clampedHeight = Math.min(pillHeight, Math.max(maxHeight, AGENTS_VOICE_WINDOW_DEFAULT_HEIGHT));
        auxiliaryWindow.window.resizeTo(pillWidth, clampedHeight);
      } catch {
      }
    }
  }
  // --- Bounds persistence ---
  _defaultBounds() {
    const x = Math.round(mainWindow.screenX + (mainWindow.outerWidth - AGENTS_VOICE_WINDOW_DEFAULT_WIDTH) / 2);
    const y = mainWindow.screenY + mainWindow.outerHeight - AGENTS_VOICE_WINDOW_DEFAULT_HEIGHT - 100;
    return {
      x,
      y,
      width: AGENTS_VOICE_WINDOW_DEFAULT_WIDTH,
      height: AGENTS_VOICE_WINDOW_DEFAULT_HEIGHT
    };
  }
  loadBounds() {
    return this._defaultBounds();
  }
  saveBounds(_window) {
  }
};
AgentsVoiceWindowService = __decorateClass([
  __decorateParam(0, IAuxiliaryWindowService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IHostService),
  __decorateParam(4, IAgentSessionsService),
  __decorateParam(5, IAgentTitleBarStatusService),
  __decorateParam(6, IMicCaptureService),
  __decorateParam(7, ITtsPlaybackService),
  __decorateParam(8, IVoiceSessionController),
  __decorateParam(9, IVoicePlaybackService),
  __decorateParam(10, ICommandService),
  __decorateParam(11, IChatService),
  __decorateParam(12, IWorkspaceContextService),
  __decorateParam(13, IWorkbenchEnvironmentService),
  __decorateParam(14, IThemeService),
  __decorateParam(15, IAccessibilityService),
  __decorateParam(16, IKeybindingService),
  __decorateParam(17, IInstantiationService),
  __decorateParam(18, IContextMenuService)
], AgentsVoiceWindowService);
registerSingleton(IAgentsVoiceWindowService, AgentsVoiceWindowService, InstantiationType.Delayed);
export {
  AgentsVoiceWindowService
};
