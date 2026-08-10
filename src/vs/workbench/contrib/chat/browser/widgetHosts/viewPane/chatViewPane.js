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
import "./media/chatViewPane.css";
import { $, addDisposableListener, append, EventHelper, EventType, getWindow, setVisibility } from "../../../../../../base/browser/dom.js";
import { StandardMouseEvent } from "../../../../../../base/browser/mouseEvent.js";
import { Button } from "../../../../../../base/browser/ui/button/button.js";
import { Orientation, Sash } from "../../../../../../base/browser/ui/sash/sash.js";
import { DomScrollableElement } from "../../../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { CancellationToken, CancellationTokenSource } from "../../../../../../base/common/cancellation.js";
import { isCancellationError } from "../../../../../../base/common/errors.js";
import { Event } from "../../../../../../base/common/event.js";
import { MutableDisposable, toDisposable, DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { LRUCache } from "../../../../../../base/common/map.js";
import { MarshalledId } from "../../../../../../base/common/marshallingIds.js";
import { autorun, observableFromEvent, observableValue } from "../../../../../../base/common/observable.js";
import { basename, getComparisonKey, isEqual } from "../../../../../../base/common/resources.js";
import { ScrollbarVisibility } from "../../../../../../base/common/scrollable.js";
import { URI } from "../../../../../../base/common/uri.js";
import { localize } from "../../../../../../nls.js";
import { MenuWorkbenchToolBar } from "../../../../../../platform/actions/browser/toolbar.js";
import { MenuId } from "../../../../../../platform/actions/common/actions.js";
import { CommandsRegistry, ICommandService } from "../../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../../../platform/contextview/browser/contextView.js";
import { IHoverService } from "../../../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../../../platform/instantiation/common/serviceCollection.js";
import { IKeybindingService } from "../../../../../../platform/keybinding/common/keybinding.js";
import { ILogService } from "../../../../../../platform/log/common/log.js";
import { INotificationService } from "../../../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../../../platform/opener/common/opener.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../../../platform/telemetry/common/telemetry.js";
import { IWorkspaceContextService } from "../../../../../../platform/workspace/common/workspace.js";
import { defaultButtonStyles } from "../../../../../../platform/theme/browser/defaultStyles.js";
import { editorBackground } from "../../../../../../platform/theme/common/colorRegistry.js";
import { ChatViewTitleControl } from "./chatViewTitleControl.js";
import { IThemeService } from "../../../../../../platform/theme/common/themeService.js";
import { isDark } from "../../../../../../platform/theme/common/theme.js";
import { IAccessibilityService } from "../../../../../../platform/accessibility/common/accessibility.js";
import { ViewPane } from "../../../../../browser/parts/views/viewPane.js";
import { Memento } from "../../../../../common/memento.js";
import { SIDE_BAR_FOREGROUND } from "../../../../../common/theme.js";
import { IViewDescriptorService, ViewContainerLocation } from "../../../../../common/views.js";
import { ILifecycleService, StartupKind } from "../../../../../services/lifecycle/common/lifecycle.js";
import { IChatAgentService } from "../../../common/participants/chatAgents.js";
import { ChatContextKeys } from "../../../common/actions/chatContextKeys.js";
import { CHAT_PROVIDER_ID } from "../../../common/participants/chatParticipantContribTypes.js";
import { IChatService } from "../../../common/chatService/chatService.js";
import { IChatSessionsService, localChatSessionType } from "../../../common/chatSessionsService.js";
import { LocalChatSessionUri, getChatSessionType, isUntitledChatSession } from "../../../common/model/chatUri.js";
import { ChatAgentLocation, ChatConfiguration, ChatModeKind, getDefaultNewChatSessionResource, getDefaultNewChatSessionType } from "../../../common/constants.js";
import { AgentSessionsControl } from "../../agentSessions/agentSessionsControl.js";
import { ACTION_ID_NEW_CHAT } from "../../actions/chatActions.js";
import { ChatWidget, layoutChatWidgetForInputHeight } from "../../widget/chatWidget.js";
import { ChatViewWelcomeController } from "../../viewsWelcome/chatViewWelcomeController.js";
import { IWorkbenchLayoutService, LayoutSettings, Position } from "../../../../../services/layout/browser/layoutService.js";
import { AgentSessionsViewerOrientation, AgentSessionsViewerPosition } from "../../agentSessions/agentSessions.js";
import { IProgressService } from "../../../../../../platform/progress/common/progress.js";
import { CHAT_WIDGET_VIEW_STATE_CACHE_LIMIT, ChatViewId, IChatWidgetService, setModelPreservingInputTypedWhileLoading } from "../../chat.js";
import { IActivityService, ProgressBadge } from "../../../../../services/activity/common/activity.js";
import { disposableTimeout } from "../../../../../../base/common/async.js";
import { AgentSessionsFilter, AgentSessionsGrouping } from "../../agentSessions/agentSessionsFilter.js";
import { IAgentSessionsService } from "../../agentSessions/agentSessionsService.js";
import { IAgentHostEnablementService } from "../../../../../../platform/agentHost/common/agentHostEnablementService.js";
import { HoverPosition } from "../../../../../../base/browser/ui/hover/hoverWidget.js";
import { ChatEntitlementContextKeys, IChatEntitlementService } from "../../../../../services/chat/common/chatEntitlementService.js";
import { toErrorMessage } from "../../../../../../base/common/errorMessage.js";
import { IHostService } from "../../../../../services/host/browser/host.js";
import { IMicCaptureService } from "../../voiceClient/micCaptureService.js";
import { ITtsPlaybackService } from "../../voiceClient/ttsPlaybackService.js";
import { IVoiceSessionController } from "../../voiceClient/voiceSessionController.js";
import { IVoiceInputModeService } from "../../voiceInputMode/voiceInputMode.js";
import { isGlowingVoiceState, readVoiceGlowIntensity, resolveVoiceGlowColors } from "../../voiceClient/voiceGlow.js";
import { createVoiceGlowController } from "../../voiceClient/voiceGlowController.js";
import { combineVoiceInput } from "../../voiceClient/voiceInputUtils.js";
import { resolveVoiceModel } from "../../voiceClient/voiceToolDispatchService.js";
import { IAgentTitleBarStatusService } from "../../agentSessions/experiments/agentTitleBarStatusService.js";
import { IVoicePlaybackService } from "../../../common/voicePlaybackService.js";
import { VOICE_AGENT_PROGRESS_SETTING } from "../../../common/voiceClient/voiceClientService.js";
import { IWorkbenchEnvironmentService } from "../../../../../services/environment/common/environmentService.js";
let ChatViewPane = class extends ViewPane {
  constructor(options, keybindingService2, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService, storageService, chatService, chatAgentService, logService, notificationService, layoutService, chatSessionsService, telemetryService, lifecycleService, progressService, agentSessionsService, chatEntitlementService, commandService, activityService, hostService, micCaptureService, ttsPlaybackService, voiceSessionController, voiceInputModeService, chatWidgetService, _agentTitleBarStatusService, _voicePlaybackService, _workbenchEnvironmentService, workspaceContextService, agentHostEnablementService, accessibilityService) {
    super(options, keybindingService2, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.storageService = storageService;
    this.chatService = chatService;
    this.chatAgentService = chatAgentService;
    this.logService = logService;
    this.notificationService = notificationService;
    this.layoutService = layoutService;
    this.chatSessionsService = chatSessionsService;
    this.telemetryService = telemetryService;
    this.progressService = progressService;
    this.agentSessionsService = agentSessionsService;
    this.chatEntitlementService = chatEntitlementService;
    this.commandService = commandService;
    this.activityService = activityService;
    this.hostService = hostService;
    this.micCaptureService = micCaptureService;
    this.ttsPlaybackService = ttsPlaybackService;
    this.voiceSessionController = voiceSessionController;
    this.voiceInputModeService = voiceInputModeService;
    this.chatWidgetService = chatWidgetService;
    this.workspaceContextService = workspaceContextService;
    this.agentHostEnablementService = agentHostEnablementService;
    this.accessibilityService = accessibilityService;
    this.lastDimensionsPerOrientation = /* @__PURE__ */ new Map();
    this.loadSessionCts = this._register(new MutableDisposable());
    this._applyModelCts = this._register(new MutableDisposable());
    /** While > 0 the sessions list is suppressed so a session transition's transiently-empty widget does not reveal it (see {@link beginSessionsListSuppression}). */
    this._sessionsListSuppressionCount = 0;
    this.modelRef = this._register(new MutableDisposable());
    this.widgetViewStates = new LRUCache(CHAT_WIDGET_VIEW_STATE_CACHE_LIMIT);
    this.activityBadge = this._register(new MutableDisposable());
    this._currentSessionResource = observableValue(this, void 0);
    this._voiceBarDisposables = this._register(new DisposableStore());
    this.sessionsViewerOrientation = AgentSessionsViewerOrientation.Stacked;
    this.sessionsViewerOrientationConfiguration = "sideBySide";
    this.sessionsViewerSashDisposables = this._register(new MutableDisposable());
    //#region Layout
    this.layoutingBody = false;
    this.element.classList.add("chat-viewpane-container");
    this.memento = new Memento(`interactive-session-view-${CHAT_PROVIDER_ID}`, this.storageService);
    this.viewState = this.memento.getMemento(StorageScope.WORKSPACE, StorageTarget.MACHINE);
    if (lifecycleService.startupKind !== StartupKind.ReloadedWindow && this.configurationService.getValue(ChatConfiguration.RestoreLastPanelSession) === false) {
      this.viewState.sessionId = void 0;
      this.viewState.sessionResource = void 0;
    }
    this.sessionsViewerVisible = false;
    this.sessionsViewerSidebarWidth = Math.max(ChatViewPane.SESSIONS_SIDEBAR_MIN_WIDTH, this.viewState.sessionsSidebarWidth ?? ChatViewPane.SESSIONS_SIDEBAR_DEFAULT_WIDTH);
    this.chatViewLocationContext = ChatContextKeys.panelLocation.bindTo(contextKeyService);
    this.sessionsViewerOrientationContext = ChatContextKeys.agentSessionsViewerOrientation.bindTo(contextKeyService);
    this.sessionsViewerPositionContext = ChatContextKeys.agentSessionsViewerPosition.bindTo(contextKeyService);
    this.sessionsViewerVisibilityContext = ChatContextKeys.agentSessionsViewerVisible.bindTo(contextKeyService);
    this.updateContextKeys();
    this._focusedSessionResource = observableFromEvent(
      this,
      this.chatWidgetService.onDidChangeFocusedSession,
      () => this.chatWidgetService.lastFocusedWidget?.viewModel?.sessionResource
    );
    this.registerListeners();
  }
  updateContextKeys() {
    const { position, location } = this.getViewPositionAndLocation();
    this.chatViewLocationContext.set(location ?? ViewContainerLocation.AuxiliaryBar);
    this.sessionsViewerOrientationContext.set(this.sessionsViewerOrientation);
    this.sessionsViewerPositionContext.set(position === Position.RIGHT ? AgentSessionsViewerPosition.Right : AgentSessionsViewerPosition.Left);
  }
  getViewPositionAndLocation() {
    const viewLocation = this.viewDescriptorService.getViewLocationById(this.id);
    const sideBarPosition = this.layoutService.getSideBarPosition();
    const panelPosition = this.layoutService.getPanelPosition();
    let sideSessionsOnRightPosition;
    switch (viewLocation) {
      case ViewContainerLocation.Sidebar:
        sideSessionsOnRightPosition = sideBarPosition === Position.RIGHT;
        break;
      case ViewContainerLocation.Panel:
        sideSessionsOnRightPosition = panelPosition !== Position.LEFT;
        break;
      default:
        sideSessionsOnRightPosition = sideBarPosition === Position.LEFT;
        break;
    }
    return {
      position: sideSessionsOnRightPosition ? Position.RIGHT : Position.LEFT,
      location: viewLocation ?? ViewContainerLocation.AuxiliaryBar
    };
  }
  getSessionHoverPosition() {
    const viewLocation = this.viewDescriptorService.getViewLocationById(this.id);
    const sideBarPosition = this.layoutService.getSideBarPosition();
    if (this.sessionsViewerOrientation === AgentSessionsViewerOrientation.SideBySide) {
      return viewLocation === ViewContainerLocation.Sidebar && sideBarPosition === Position.RIGHT ? HoverPosition.LEFT : HoverPosition.RIGHT;
    }
    return {
      [Position.LEFT]: HoverPosition.RIGHT,
      [Position.RIGHT]: HoverPosition.LEFT,
      [Position.TOP]: HoverPosition.BELOW,
      [Position.BOTTOM]: HoverPosition.ABOVE
    }[viewLocation === ViewContainerLocation.Panel ? this.layoutService.getPanelPosition() : sideBarPosition];
  }
  updateViewPaneClasses(fromEvent) {
    const activityBarLocationDefault = this.configurationService.getValue(LayoutSettings.ACTIVITY_BAR_LOCATION) === "default";
    this.viewPaneContainer?.classList.toggle("activity-bar-location-default", activityBarLocationDefault);
    this.viewPaneContainer?.classList.toggle("activity-bar-location-other", !activityBarLocationDefault);
    const { position, location } = this.getViewPositionAndLocation();
    this.viewPaneContainer?.classList.toggle("chat-view-location-auxiliarybar", location === ViewContainerLocation.AuxiliaryBar);
    this.viewPaneContainer?.classList.toggle("chat-view-location-sidebar", location === ViewContainerLocation.Sidebar);
    this.viewPaneContainer?.classList.toggle("chat-view-location-panel", location === ViewContainerLocation.Panel);
    this.viewPaneContainer?.classList.toggle("chat-view-position-left", position === Position.LEFT);
    this.viewPaneContainer?.classList.toggle("chat-view-position-right", position === Position.RIGHT);
    if (fromEvent) {
      this.relayout();
    }
  }
  registerListeners() {
    this._register(this.chatAgentService.onDidChangeAgents(() => this.onDidChangeAgents()));
    this._register(this.chatSessionsService.onDidCommitSession(async (e) => {
      if (!this.modelRef.value) {
        return;
      }
      if (!isEqual(e.original, this.modelRef.value.object.sessionResource)) {
        return;
      }
      const modelRef = await this.chatService.acquireOrLoadSession(e.committed, ChatAgentLocation.Chat, CancellationToken.None, "ChatViewPane#onDidCommitSession");
      await this.showModel(CancellationToken.None, modelRef);
    }));
    this._register(Event.any(
      Event.filter(this.configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration("workbench.sideBar.location")),
      this.layoutService.onDidChangePanelPosition,
      Event.filter(this.viewDescriptorService.onDidChangeContainerLocation, (e) => e.viewContainer === this.viewDescriptorService.getViewContainerByViewId(this.id))
    )(() => {
      this.updateContextKeys();
      this.updateViewPaneClasses(
        true
        /* layout here */
      );
    }));
    this._register(Event.filter(this.configurationService.onDidChangeConfiguration, (e) => {
      return e.affectsConfiguration(LayoutSettings.ACTIVITY_BAR_LOCATION);
    })(() => this.updateViewPaneClasses(true)));
  }
  onDidChangeAgents() {
    if (this.chatAgentService.getDefaultAgent(ChatAgentLocation.Chat)) {
      if (!this._widget?.viewModel && !this.restoringSession) {
        this.restoringSession = this.acquireTransferredOrPersistedSession(CancellationToken.None, "ChatViewPane#onDidChangeAgents").then(async (modelRef) => {
          if (!this._widget) {
            return;
          }
          const wasVisible = this._widget.visible;
          try {
            this._widget.setVisible(false);
            await this.showModel(CancellationToken.None, modelRef, true, !modelRef);
          } finally {
            this._widget.setVisible(wasVisible);
          }
        });
        this.restoringSession.finally(() => this.restoringSession = void 0);
      }
    }
    this._onDidChangeViewWelcomeState.fire();
  }
  getTransferredOrPersistedSessionInfo() {
    if (this.chatService.transferredSessionResource) {
      return this.chatService.transferredSessionResource;
    }
    if (this.viewState.sessionResource) {
      return this.viewState.sessionResource;
    }
    return this.viewState.sessionId ? LocalChatSessionUri.forSession(this.viewState.sessionId) : void 0;
  }
  renderBody(parent) {
    super.renderBody(parent);
    this.telemetryService.publicLog2("chatViewPaneOpened");
    this.viewPaneContainer = parent;
    this.viewPaneContainer.classList.add("chat-viewpane");
    this.updateViewPaneClasses(false);
    const controlsWrapper = append(parent, $(".voice-agent-controls-wrapper"));
    this.createControls(controlsWrapper);
    this._voiceBarContainer = $(".voice-agent-bar-host");
    this._voiceBarContainer.style.display = "none";
    this._updateVoiceBar(this._voiceBarContainer);
    const inputContainerEl = this._widget.inputPart.inputContainerElement;
    if (inputContainerEl) {
      this._setupVoiceTranscriptOverlay(inputContainerEl);
    }
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("agents.voice.enabled")) {
        this._updateVoiceBar(this._voiceBarContainer);
      }
    }));
    this.setupContextMenu(parent);
    this.applyModel();
  }
  createControls(parent) {
    const sessionsControl = this.createSessionsControl(parent);
    const welcomeController = this.welcomeController = this._register(this.instantiationService.createInstance(ChatViewWelcomeController, parent, this, ChatAgentLocation.Chat));
    const chatWidget = this.createChatControl(parent);
    this.registerControlsListeners(sessionsControl, chatWidget, welcomeController);
    this.updateSessionsControlVisibility();
  }
  _updateVoiceBar(container) {
    this._voiceBarDisposables.clear();
    container.replaceChildren();
    container.style.display = "none";
    if (this.configurationService.getValue("agents.voice.enabled")) {
      this._voiceBarDisposables.add(CommandsRegistry.registerCommand("_chat.voice.acceptInput", (accessor, text) => {
        const chatWidgetService = accessor.get(IChatWidgetService);
        const focusedWidget = chatWidgetService.lastFocusedWidget;
        const widget = focusedWidget?.hasInputFocus() ? focusedWidget : this._widget;
        if (text && widget?.viewModel) {
          if (widget.viewModel.editing) {
            widget.input.setValue(text, false);
          } else {
            return widget.acceptInput(combineVoiceInput(widget.getInput(), text), {
              preserveFocus: true,
              isVoiceModeInput: this.configurationService.getValue(VOICE_AGENT_PROGRESS_SETTING) === true
            });
          }
        }
        return void 0;
      }));
      this._voiceBarDisposables.add(CommandsRegistry.registerCommand("_chat.voice.switchToSession", async (_accessor, resourceStr) => {
        if (!resourceStr) {
          return false;
        }
        try {
          const resource = URI.parse(resourceStr);
          this.viewState.sessionResource = resource;
          this.applyModel();
          await this.restoringSession;
          const restoredResource = this._widget?.viewModel?.sessionResource;
          return !!restoredResource && isEqual(restoredResource, resource);
        } catch {
          return false;
        }
      }));
      this._voiceBarDisposables.add(CommandsRegistry.registerCommand("_chat.voice.getCurrentSession", (_accessor) => {
        return this._widget?.viewModel?.sessionResource?.toString();
      }));
      this._voiceBarDisposables.add(CommandsRegistry.registerCommand("_chat.voice.selectModel", (_accessor, requestedModel) => {
        const widget = this._getVoiceActionWidget();
        if (!widget) {
          return { ok: false, reason: "no_input" };
        }
        const resolved = resolveVoiceModel(widget.inputPart.availableLanguageModels, requestedModel);
        if (!resolved.ok || !resolved.identifier) {
          return resolved;
        }
        return widget.inputPart.switchModelByIdentifier(resolved.identifier, true, true) ? resolved : { ok: false, reason: "selection_failed", available_models: resolved.available_models };
      }));
      this._voiceBarDisposables.add(CommandsRegistry.registerCommand("_chat.voice.attachFiles", async (_accessor, resourceStrings) => {
        const widget = this._getVoiceActionWidget();
        if (!widget) {
          return { ok: false, reason: "no_input" };
        }
        try {
          const resources = resourceStrings.map((resource) => URI.parse(resource));
          await Promise.all(resources.map((resource) => widget.attachmentModel.addFile(resource)));
          return { ok: true, attached: resources.map((resource) => basename(resource)) };
        } catch {
          return { ok: false, reason: "attachment_failed" };
        }
      }));
    }
  }
  _getVoiceActionWidget() {
    const target = this._currentVoiceInputResource();
    return target ? this.chatWidgetService.getWidgetBySessionResource(target) : this._widget;
  }
  /**
   * The single chat input voice mode is currently bound to. Mirrors the routing
   * used by `_chat.voice.acceptInput`: an explicit target session (set by the
   * floating aux window) wins, otherwise the last-focused chat widget's session,
   * falling back to this pane's own session. The glow / transcript render only on
   * the pane whose session matches this, so with several chat inputs open (e.g.
   * this pane plus a chat editor) exactly one lights up.
   */
  _currentVoiceInputResource(reader) {
    const omniInputActive = reader ? this.voiceSessionController.omniInputActive.read(reader) : this.voiceSessionController.omniInputActive.get();
    if (omniInputActive) {
      return void 0;
    }
    const target = reader ? this.voiceSessionController.targetSession.read(reader) : this.voiceSessionController.targetSession.get();
    if (target) {
      return target;
    }
    const focused = reader ? this._focusedSessionResource.read(reader) : this._focusedSessionResource.get();
    return focused ?? this._widget?.viewModel?.sessionResource;
  }
  _setupVoiceTranscriptOverlay(inputContainerEl) {
    inputContainerEl.style.position = "relative";
    const showTranscriptSetting = observableFromEvent(
      this,
      Event.filter(this.configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration("agents.voice.showTranscript")),
      () => this.configurationService.getValue("agents.voice.showTranscript") !== false
    );
    const showLiveTranscriptSetting = observableFromEvent(
      this,
      Event.filter(this.configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration("agents.voice.liveTranscript")),
      () => this.configurationService.getValue("agents.voice.liveTranscript") !== false
    );
    const transcriptOverlay = $(".voice-transcript-overlay");
    const transcriptScrollable = this._register(new DomScrollableElement(transcriptOverlay, {
      horizontal: ScrollbarVisibility.Hidden,
      vertical: ScrollbarVisibility.Auto
    }));
    const transcriptOverlayNode = transcriptScrollable.getDomNode();
    transcriptOverlayNode.classList.add("voice-transcript-overlay-scrollable");
    transcriptOverlayNode.style.display = "none";
    inputContainerEl.append(transcriptOverlayNode);
    let animFrameId;
    const glowDataArrayRef = { value: void 0 };
    const win = getWindow(inputContainerEl);
    const glowController = this._register(createVoiceGlowController(
      inputContainerEl,
      () => isDark(this.themeService.getColorTheme().type) ? "dark" : "light",
      () => resolveVoiceGlowColors(this.themeService.getColorTheme())
    ));
    this._register(this.themeService.onDidColorThemeChange(() => glowController.refreshTheme()));
    const getEffectiveVoice = () => {
      const sim = this.voiceInputModeService.simulatedVoiceState.get();
      if (sim === "idle" || sim === "listening" || sim === "speaking") {
        return { connected: true, voiceState: sim, simulating: true };
      }
      if (sim === "off" || sim === "connecting" || sim === "dictating") {
        return { connected: false, voiceState: "idle", simulating: true };
      }
      return {
        connected: this.voiceSessionController.isConnected.get(),
        voiceState: this.voiceSessionController.voiceState.get(),
        simulating: false
      };
    };
    const startGlowAnimation = () => {
      if (animFrameId !== void 0) {
        return;
      }
      const animate = () => {
        animFrameId = win.requestAnimationFrame(animate);
        const { connected, voiceState, simulating } = getEffectiveVoice();
        const confirmationPending = isConfirmationPending();
        const effectiveState = confirmationPending ? "confirmation" : voiceState;
        const currentSession = this._currentSessionResource.get();
        const boundResource = this._currentVoiceInputResource();
        const isOwner = !!currentSession && !!boundResource && isEqual(currentSession, boundResource);
        const glowActive = confirmationPending || connected && isGlowingVoiceState(voiceState) && (simulating || isOwner);
        if (!glowActive) {
          glowController.clear();
          return;
        }
        const analyser = this.ttsPlaybackService.analyserNode ?? (effectiveState === "listening" ? this.micCaptureService.analyserNode : null) ?? null;
        let intensity;
        if (!analyser && simulating) {
          const t = Date.now() / 1e3;
          intensity = Math.min(1, 0.28 + 0.34 * Math.abs(Math.sin(t * 6.1)) + 0.22 * Math.abs(Math.sin(t * 11.3 + 1)));
        } else {
          intensity = readVoiceGlowIntensity(analyser, glowDataArrayRef);
        }
        glowController.render(effectiveState, intensity, this.accessibilityService.isMotionReduced());
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
    const isConfirmationPending = () => {
      const currentSession = this._currentSessionResource.get();
      return !!currentSession && this.voiceSessionController.pendingToolConfirmations.get().some((confirmation) => isEqual(confirmation.sessionResource, currentSession));
    };
    this._register(autorun((reader) => {
      const connected = this.voiceSessionController.isConnected.read(reader);
      const voiceState = this.voiceSessionController.voiceState.read(reader);
      const currentSession = this._currentSessionResource.read(reader);
      const confirmationPending = !!currentSession && this.voiceSessionController.pendingToolConfirmations.read(reader).some((confirmation) => isEqual(confirmation.sessionResource, currentSession));
      const sim = this.voiceInputModeService.simulatedVoiceState.read(reader);
      const simGlow = sim === "listening" || sim === "speaking";
      if (confirmationPending || simGlow || connected && isGlowingVoiceState(voiceState)) {
        startGlowAnimation();
      } else {
        stopGlowAnimation();
      }
    }));
    this._register({ dispose: () => stopGlowAnimation() });
    let listeningSession;
    let ownerSession;
    this._register(autorun((reader) => {
      const simState = this.voiceInputModeService.simulatedVoiceState.read(reader);
      const simVersion = this.voiceInputModeService.simulatedVersion.read(reader);
      if (simState !== void 0) {
        if (simState === "idle" && simVersion) {
          transcriptOverlayNode.style.display = "";
          transcriptOverlayNode.classList.remove("has-transcript");
          transcriptOverlay.replaceChildren();
          const hint = $("span.partial");
          switch (simVersion) {
            case "handsFree":
              hint.textContent = localize("voiceMode.simHint.handsFree", "Hands-free \u2014 just start talking");
              break;
            case "keyboardHold": {
              const kbLabel = this.keybindingService.lookupKeybinding("workbench.action.chat.voiceInputMode.holdToTalk")?.getLabel();
              hint.textContent = kbLabel ? localize("voiceMode.pttHint", "Hold {0} to talk", kbLabel) : localize("voiceMode.simHint.keyboardHold", "Hold Space to talk");
              break;
            }
            case "buttonHold":
              hint.textContent = localize("voiceMode.simHint.buttonHold", "Hold the button to talk, tap to turn off");
              break;
            case "clickToggle":
              hint.textContent = localize("voiceMode.simHint.clickToggle", "Tap the button to start listening");
              break;
          }
          transcriptOverlay.append(hint);
          transcriptScrollable.scanDomNode();
        } else {
          transcriptOverlayNode.style.display = "none";
          transcriptOverlayNode.classList.remove("has-transcript");
        }
        return;
      }
      const turns = this.voiceSessionController.transcriptTurns.read(reader);
      const connected = this.voiceSessionController.isConnected.read(reader);
      const voiceState = this.voiceSessionController.voiceState.read(reader);
      const omniInputActive = this.voiceSessionController.omniInputActive.read(reader);
      const targetSession = this.voiceSessionController.targetSession.read(reader);
      const currentSession = this._currentSessionResource.read(reader);
      const showTranscript = showTranscriptSetting.read(reader);
      const showLiveTranscript = showLiveTranscriptSetting.read(reader);
      const visible = turns.filter((t) => t.text.length > 0 || t.speaker === "user" && t.isPartial);
      const showListeningPlaceholder = voiceState === "listening" && (!showTranscript || !showLiveTranscript);
      if (!connected || omniInputActive) {
        listeningSession = void 0;
        ownerSession = void 0;
        transcriptOverlayNode.style.display = "none";
        transcriptOverlayNode.classList.remove("has-transcript");
        return;
      }
      if (voiceState === "listening") {
        if (!listeningSession) {
          listeningSession = targetSession ?? currentSession;
          ownerSession = listeningSession;
        } else if (!targetSession && currentSession && !isEqual(currentSession, listeningSession)) {
          const dictationSession = listeningSession;
          const activelyDictating = turns.some((t) => t.speaker === "user" && t.isPartial && t.text.trim().length > 0);
          if (activelyDictating) {
            this.voiceSessionController.finishListeningAndSubmitTo(dictationSession);
            listeningSession = void 0;
          } else if (isUntitledChatSession(currentSession)) {
            listeningSession = currentSession;
            ownerSession = currentSession;
          } else {
            this.voiceSessionController.discardListening();
            listeningSession = void 0;
          }
        }
      } else {
        listeningSession = void 0;
      }
      const boundResource = this._currentVoiceInputResource(reader);
      if (boundResource && currentSession && !isEqual(boundResource, currentSession)) {
        transcriptOverlayNode.style.display = "none";
        transcriptOverlayNode.classList.remove("has-transcript");
        return;
      }
      const effectiveOwner = targetSession ?? ownerSession;
      if (effectiveOwner && currentSession && !isEqual(effectiveOwner, currentSession)) {
        transcriptOverlayNode.style.display = "none";
        transcriptOverlayNode.classList.remove("has-transcript");
        return;
      }
      if (visible.length === 0 || !showTranscript || showListeningPlaceholder) {
        const handsFree = this.configurationService.getValue("agents.voice.handsFree") === true;
        if (showListeningPlaceholder) {
          transcriptOverlayNode.style.display = "";
          transcriptOverlayNode.classList.remove("has-transcript");
          transcriptOverlay.replaceChildren();
          const listening = $("span.listening");
          listening.textContent = localize("voiceMode.listening", "Listening...");
          transcriptOverlay.append(listening);
          transcriptScrollable.scanDomNode();
        } else if (!showTranscript && voiceState === "speaking") {
          transcriptOverlayNode.style.display = "";
          transcriptOverlayNode.classList.remove("has-transcript");
          transcriptOverlay.replaceChildren();
          const hint = $("span.partial");
          const kb = this.keybindingService.lookupKeybinding("workbench.action.chat.voiceInputMode.holdToTalk") ?? this.keybindingService.lookupKeybinding("agentsVoice.pushToTalk");
          const kbLabel = kb?.getLabel();
          hint.textContent = kbLabel ? localize("voiceMode.bargeInHint", "Speak or use {0}", kbLabel) : localize("voiceMode.bargeInHintNoKb", "Speak to barge in");
          transcriptOverlay.append(hint);
          transcriptScrollable.scanDomNode();
        } else if (voiceState === "idle" && visible.length === 0 && showTranscript && !handsFree) {
          transcriptOverlayNode.style.display = "";
          transcriptOverlayNode.classList.remove("has-transcript");
          transcriptOverlay.replaceChildren();
          const hint = $("span.partial");
          const kb = this.keybindingService.lookupKeybinding("agentsVoice.pushToTalk");
          const kbLabel = kb?.getLabel();
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
        const span = $("span");
        if (lastTurn.isPartial) {
          const committedPart = lastTurn.committed || "";
          const unsurePart = lastTurn.text.slice(committedPart.length);
          if (committedPart) {
            const c = $("span.committed");
            c.textContent = committedPart;
            span.append(c);
          }
          const u = $("span.partial");
          u.textContent = unsurePart + "\u2589";
          span.append(u);
        } else {
          span.className = "committed";
          span.textContent = lastTurn.text;
        }
        contentElements.push(span);
      } else {
        const div = $("div.assistant-text");
        div.textContent = lastTurn.text;
        contentElements.push(div);
      }
      transcriptOverlay.replaceChildren(...contentElements);
      transcriptScrollable.scanDomNode();
      transcriptScrollable.setScrollPosition({ scrollTop: 0 });
    }));
  }
  static {
    //#endregion
    //#region Sessions Control
    this.SESSIONS_SIDEBAR_MIN_WIDTH = 200;
  }
  static {
    this.SESSIONS_SIDEBAR_SNAP_THRESHOLD = this.SESSIONS_SIDEBAR_MIN_WIDTH / 2;
  }
  static {
    // snap to hide when dragged below half of minimum width
    this.SESSIONS_SIDEBAR_DEFAULT_WIDTH = 300;
  }
  static {
    this.SESSIONS_SIDEBAR_BORDER_WIDTH = 1;
  }
  static {
    this.CHAT_WIDGET_DEFAULT_WIDTH = 300;
  }
  static {
    this.SESSIONS_SIDEBAR_VIEW_MIN_WIDTH = this.CHAT_WIDGET_DEFAULT_WIDTH + this.SESSIONS_SIDEBAR_DEFAULT_WIDTH;
  }
  get agentSessionsControl() {
    return this.sessionsControl;
  }
  createSessionsControl(parent) {
    const sessionsContainer = this.sessionsContainer = parent.appendChild($(".agent-sessions-container"));
    const sessionsTitleContainer = this.sessionsTitleContainer = append(sessionsContainer, $(".agent-sessions-title-container"));
    const sessionsTitle = this.sessionsTitle = append(sessionsTitleContainer, $("span.agent-sessions-title"));
    sessionsTitle.textContent = localize("sessions", "Sessions");
    this._register(addDisposableListener(sessionsTitle, EventType.CLICK, () => {
      this.sessionsControl?.scrollToTop();
      this.sessionsControl?.focus();
    }));
    const sessionsToolbarContainer = append(sessionsTitleContainer, $(".agent-sessions-toolbar"));
    const sessionsToolbar = this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, sessionsToolbarContainer, MenuId.AgentSessionsToolbar, {
      menuOptions: { shouldForwardArgs: true }
    }));
    const sessionsFilter = this._register(this.instantiationService.createInstance(AgentSessionsFilter, {
      filterMenuId: MenuId.AgentSessionsViewerFilterSubMenu,
      groupResults: () => this.sessionsViewerOrientation === AgentSessionsViewerOrientation.Stacked ? AgentSessionsGrouping.Capped : AgentSessionsGrouping.Date
    }));
    this._register(Event.runAndSubscribe(sessionsFilter.onDidChange, () => {
      sessionsToolbarContainer.classList.toggle("filtered", !sessionsFilter.isDefault());
    }));
    const newSessionButtonContainer = this.sessionsNewButtonContainer = append(sessionsContainer, $(".agent-sessions-new-button-container"));
    const newSessionButton = this._register(new Button(newSessionButtonContainer, { ...defaultButtonStyles, secondary: true }));
    newSessionButton.label = localize("newSession", "New Session");
    this._register(newSessionButton.onDidClick(() => this.commandService.executeCommand(ACTION_ID_NEW_CHAT, this.getActionsContext())));
    this.sessionsControlContainer = append(sessionsContainer, $(".agent-sessions-control-container"));
    const sessionsControl = this.sessionsControl = this._register(this.instantiationService.createInstance(AgentSessionsControl, this.sessionsControlContainer, {
      source: "chatViewPane",
      filter: sessionsFilter,
      overrideStyles: this.getLocationBasedColors().listOverrideStyles,
      getHoverPosition: () => this.getSessionHoverPosition(),
      trackActiveEditorSession: () => {
        return !this._widget || this._widget.isEmpty();
      },
      overrideSessionOpenOptions: (openEvent) => {
        if (this.sessionsViewerOrientation === AgentSessionsViewerOrientation.Stacked && !openEvent.sideBySide) {
          return { ...openEvent, editorOptions: {
            ...openEvent.editorOptions,
            preserveFocus: false
            /* focus the chat widget when opening from stacked sessions viewer since this closes the stacked viewer */
          } };
        }
        return openEvent;
      }
    }));
    this._register(this.onDidChangeBodyVisibility((visible) => sessionsControl.setVisible(visible)));
    sessionsToolbar.context = sessionsControl;
    this._register(this.hostService.onDidChangeFocus((hasFocus) => {
      if (hasFocus) {
        sessionsControl.refresh();
      }
    }));
    this._register(Event.runAndSubscribe(Event.filter(this.configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration(ChatConfiguration.ChatViewSessionsOrientation)), (e) => {
      const newSessionsViewerOrientationConfiguration = this.configurationService.getValue(ChatConfiguration.ChatViewSessionsOrientation);
      this.doUpdateConfiguredSessionsViewerOrientation(newSessionsViewerOrientationConfiguration, { updateConfiguration: false, layout: !!e });
    }));
    return sessionsControl;
  }
  getSessionsViewerOrientation() {
    return this.sessionsViewerOrientation;
  }
  updateConfiguredSessionsViewerOrientation(orientation) {
    return this.doUpdateConfiguredSessionsViewerOrientation(orientation, { updateConfiguration: true, layout: true });
  }
  doUpdateConfiguredSessionsViewerOrientation(orientation, options) {
    const oldSessionsViewerOrientationConfiguration = this.sessionsViewerOrientationConfiguration;
    let validatedOrientation;
    if (orientation === "stacked" || orientation === "sideBySide") {
      validatedOrientation = orientation;
    } else {
      validatedOrientation = "sideBySide";
    }
    this.sessionsViewerOrientationConfiguration = validatedOrientation;
    if (oldSessionsViewerOrientationConfiguration === this.sessionsViewerOrientationConfiguration) {
      return;
    }
    if (options.updateConfiguration) {
      this.configurationService.updateValue(ChatConfiguration.ChatViewSessionsOrientation, validatedOrientation);
    }
    if (options.layout) {
      this.relayout();
    }
  }
  updateSessionsControlVisibility() {
    if (!this.sessionsContainer || !this.viewPaneContainer) {
      return { changed: false, visible: false };
    }
    let newSessionsContainerVisible;
    if (!this.configurationService.getValue(ChatConfiguration.ChatViewSessionsEnabled)) {
      newSessionsContainerVisible = false;
    } else {
      if (this.sessionsViewerOrientation === AgentSessionsViewerOrientation.Stacked) {
        newSessionsContainerVisible = (!!this.chatEntitlementService.sentiment.completed || this.chatEntitlementService.hasByokModels) && // chat is setup (otherwise make room for terms and welcome)
        (!this._widget || this._widget.isEmpty() && !!this._widget.viewModel && !this._widget.viewModel.model.title) && // chat widget empty (but not when model is loading or has a title)
        this._sessionsListSuppressionCount === 0 && // not mid-transition (a slow session transiently shows an empty widget)
        !this.welcomeController?.isShowingWelcome.get();
      } else {
        newSessionsContainerVisible = !this.welcomeController?.isShowingWelcome.get() && // welcome not showing
        !!this.lastDimensions && this.lastDimensions.width >= ChatViewPane.SESSIONS_SIDEBAR_VIEW_MIN_WIDTH;
      }
    }
    this.viewPaneContainer.classList.toggle("has-sessions-control", newSessionsContainerVisible);
    const sessionsContainerVisible = this.sessionsContainer.style.display !== "none";
    setVisibility(newSessionsContainerVisible, this.sessionsContainer);
    this.sessionsViewerVisible = newSessionsContainerVisible;
    this.sessionsViewerVisibilityContext.set(newSessionsContainerVisible);
    return {
      changed: sessionsContainerVisible !== newSessionsContainerVisible,
      visible: newSessionsContainerVisible
    };
  }
  refreshSessionsControlVisibility() {
    const { changed } = this.updateSessionsControlVisibility();
    if (changed) {
      this.relayout();
    }
  }
  /**
   * Suppresses the sessions list until the returned disposable is disposed.
   * Used to span a whole session transition (e.g. a "Continue in…" migration:
   * load → materializing send → rebind) so the transiently-empty widget never
   * falls back to the list.
   */
  beginSessionsListSuppression() {
    this._sessionsListSuppressionCount++;
    this.refreshSessionsControlVisibility();
    return toDisposable(() => {
      this._sessionsListSuppressionCount--;
      this.refreshSessionsControlVisibility();
    });
  }
  getFocusedSessions() {
    return this.sessionsControl?.getFocus() ?? [];
  }
  static {
    //#endregion
    //#region Chat Control
    this.MIN_CHAT_WIDGET_HEIGHT = 116;
  }
  get widget() {
    return this._widget;
  }
  createChatControl(parent) {
    const chatControlsContainer = append(parent, $(".chat-controls-container"));
    const locationBasedColors = this.getLocationBasedColors();
    const editorOverflowWidgetsDomNode = this.layoutService.getContainer(getWindow(chatControlsContainer)).appendChild($(".chat-editor-overflow.monaco-editor"));
    this._register(toDisposable(() => editorOverflowWidgetsDomNode.remove()));
    this.createChatTitleControl(chatControlsContainer);
    const scopedInstantiationService = this._register(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, this.scopedContextKeyService])));
    this._widget = this._register(scopedInstantiationService.createInstance(
      ChatWidget,
      ChatAgentLocation.Chat,
      { viewId: this.id },
      {
        autoScroll: (mode) => mode !== ChatModeKind.Ask,
        renderFollowups: true,
        supportsFileReferences: true,
        clear: () => this.clear(),
        rendererOptions: {
          renderTextEditsAsSummary: (uri) => {
            return true;
          },
          referencesExpandedWhenEmptyResponse: false,
          progressMessageAtBottomOfResponse: (mode) => mode !== ChatModeKind.Ask
        },
        editorOverflowWidgetsDomNode,
        enableImplicitContext: true,
        enableWorkingSet: "explicit",
        supportsChangingModes: true,
        dndContainer: parent
      },
      {
        listForeground: SIDE_BAR_FOREGROUND,
        listBackground: locationBasedColors.background,
        overlayBackground: locationBasedColors.overlayBackground,
        inputEditorBackground: locationBasedColors.background,
        resultEditorBackground: editorBackground
      }
    ));
    this._widget.render(chatControlsContainer, parent);
    const updateWidgetVisibility = (reader) => this._widget.setVisible(this.isBodyVisible() && !this.welcomeController?.isShowingWelcome.read(reader));
    this._register(this.onDidChangeBodyVisibility(() => updateWidgetVisibility()));
    this._register(autorun((reader) => updateWidgetVisibility(reader)));
    return this._widget;
  }
  createChatTitleControl(parent) {
    this.titleControl = this._register(this.instantiationService.createInstance(
      ChatViewTitleControl,
      parent,
      {
        focusChat: () => this._widget.focusInput()
      }
    ));
    this._register(this.titleControl.onDidChangeHeight(() => {
      this.relayout();
    }));
  }
  //#endregion
  registerControlsListeners(sessionsControl, chatWidget, welcomeController) {
    const hasByokModelsContextKeys = /* @__PURE__ */ new Set([ChatEntitlementContextKeys.hasByokModels.key]);
    this._register(Event.any(
      chatWidget.onDidChangeEmptyState,
      Event.fromObservable(welcomeController.isShowingWelcome),
      Event.filter(this.configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration(ChatConfiguration.ChatViewSessionsEnabled)),
      Event.filter(this.contextKeyService.onDidChangeContext, (e) => e.affectsSome(hasByokModelsContextKeys))
    )(() => {
      if (this.sessionsViewerOrientation === AgentSessionsViewerOrientation.Stacked) {
        sessionsControl.clearFocus();
      }
      const { changed: visibilityChanged } = this.updateSessionsControlVisibility();
      if (visibilityChanged) {
        this.relayout();
      }
    }));
    this._register(chatWidget.onDidChangeViewModel(() => {
      const model = chatWidget.viewModel?.model;
      this.titleControl?.update(model);
      this._currentSessionResource.set(chatWidget.viewModel?.sessionResource, void 0);
      if (this.sessionsViewerOrientation === AgentSessionsViewerOrientation.Stacked) {
        return;
      }
      const sessionResource = chatWidget.viewModel?.sessionResource;
      if (sessionResource) {
        const revealed = sessionsControl.reveal(sessionResource);
        if (!revealed) {
          sessionsControl.clearFocus();
        }
      }
    }));
    this._register(this.agentSessionsService.model.onDidChangeSessions(() => {
      if (this.sessionsViewerOrientation === AgentSessionsViewerOrientation.Stacked) {
        return;
      }
      if (sessionsControl.hasFocusOrSelection()) {
        return;
      }
      const sessionResource = chatWidget.viewModel?.sessionResource;
      if (sessionResource) {
        sessionsControl.reveal(sessionResource);
      }
    }));
    this._register(this.agentSessionsService.model.onDidChangeSessionArchivedState((e) => {
      if (e.isArchived()) {
        const currentSessionResource = chatWidget.viewModel?.sessionResource;
        if (currentSessionResource && isEqual(currentSessionResource, e.resource)) {
          this.clear();
        }
      }
    }));
    this._register(autorun((reader) => {
      chatWidget.inputPart.height.read(reader);
      if (this.sessionsViewerVisible && this.sessionsViewerOrientation === AgentSessionsViewerOrientation.Stacked) {
        this.relayoutForInputHeight();
      }
    }));
    const progressBadgeDisposables = this._register(new MutableDisposable());
    const updateProgressBadge = () => {
      progressBadgeDisposables.value = new DisposableStore();
      if (!this.configurationService.getValue(ChatConfiguration.ChatViewProgressBadgeEnabled)) {
        this.activityBadge.clear();
        return;
      }
      const model = chatWidget.viewModel?.model;
      if (model) {
        progressBadgeDisposables.value.add(autorun((reader) => {
          if (model.requestInProgress.read(reader)) {
            this.activityBadge.value = this.activityService.showViewActivity(this.id, {
              badge: new ProgressBadge(() => localize("sessionInProgress", "Agent Session in Progress"))
            });
          } else {
            this.activityBadge.clear();
          }
        }));
      } else {
        this.activityBadge.clear();
      }
    };
    this._register(chatWidget.onDidChangeViewModel(() => updateProgressBadge()));
    this._register(Event.filter(this.configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration(ChatConfiguration.ChatViewProgressBadgeEnabled))(() => updateProgressBadge()));
    updateProgressBadge();
  }
  setupContextMenu(parent) {
    this._register(addDisposableListener(parent, EventType.CONTEXT_MENU, (e) => {
      EventHelper.stop(e, true);
      this.contextMenuService.showContextMenu({
        menuId: MenuId.ChatWelcomeContext,
        contextKeyService: this.contextKeyService,
        getAnchor: () => new StandardMouseEvent(getWindow(parent), e)
      });
    }));
  }
  //#region Model Management
  applyModel() {
    this._applyModelCts.value?.cancel();
    const cts = this._applyModelCts.value = new CancellationTokenSource();
    this.restoringSession = this._applyModel(cts.token).catch((err) => {
      if (!isCancellationError(err)) {
        this.logService.error("ChatViewPane#applyModel failed", err);
      }
    });
    this.restoringSession.finally(() => this.restoringSession = void 0);
  }
  async _applyModel(token) {
    const modelRef = await this.acquireTransferredOrPersistedSession(token, "ChatViewPane#applyModel");
    await this.showModel(token, modelRef, true, !modelRef);
  }
  /**
   * Force-start a new local chat session in the view, bypassing the
   * default-provider override applied by `showModel()`. Used by the
   * picker when the user explicitly selects "Local", and by New Local Chat.
   */
  async startNewLocalSession() {
    this._applyModelCts.value?.cancel();
    const ref = this.chatService.startNewLocalSession(ChatAgentLocation.Chat, { debugOwner: "ChatViewPane#startNewLocalSession" });
    return this.showModel(CancellationToken.None, ref);
  }
  /**
   * When the remembered or computed default session type is a non-local
   * provider (for example when the agent host is enabled), return a new session
   * reference for it instead of the built-in local provider. Returns
   * `undefined` to fall back to `startNewLocalSession`.
   */
  async acquireDefaultNewSession(token) {
    const workspace = this.workspaceContextService.getWorkspace();
    const defaultType = getDefaultNewChatSessionType(this.configurationService, this.chatSessionsService, this.storageService, workspace, this.agentHostEnablementService.enabled.get());
    if (defaultType === localChatSessionType) {
      return void 0;
    }
    const resource = getDefaultNewChatSessionResource(this.configurationService, this.chatSessionsService, this.storageService, workspace, this.agentHostEnablementService.enabled.get());
    try {
      return await this.chatService.acquireOrLoadSession(resource, ChatAgentLocation.Chat, token, "ChatViewPane#acquireDefaultNewSession");
    } catch (error) {
      if (isCancellationError(error)) {
        throw error;
      }
      this.logService.warn(`[ChatViewPane] Failed to acquire default agent-host session, falling back to local`, error);
      return void 0;
    }
  }
  async acquireTransferredOrPersistedSession(token, debugOwner) {
    const sessionResource = this.getTransferredOrPersistedSessionInfo();
    if (!sessionResource) {
      return void 0;
    }
    const modelRef = await this.chatService.acquireOrLoadSession(sessionResource, ChatAgentLocation.Chat, token, debugOwner);
    if (!modelRef) {
      return void 0;
    }
    if (this.shouldSkipRestoredLocalSession(sessionResource, modelRef.object)) {
      modelRef.dispose();
      return void 0;
    }
    return modelRef;
  }
  shouldSkipRestoredLocalSession(sessionResource, model) {
    const workspace = this.workspaceContextService.getWorkspace();
    const defaultType = getDefaultNewChatSessionType(this.configurationService, this.chatSessionsService, this.storageService, workspace, this.agentHostEnablementService.enabled.get());
    return defaultType !== localChatSessionType && getChatSessionType(sessionResource) === localChatSessionType && !model.hasRequests;
  }
  async showModel(token, modelRef, startNewSession = true, ignoreTransferredSession = false, inputBeforeLoad) {
    const oldModelResource = this._widget.viewModel?.sessionResource;
    if (oldModelResource) {
      this.widgetViewStates.set(getComparisonKey(oldModelResource), this._widget.getViewState());
    }
    this.modelRef.value = void 0;
    const baselineInput = inputBeforeLoad ?? this._widget?.getInput() ?? "";
    let ref;
    if (startNewSession) {
      if (modelRef) {
        ref = modelRef;
      } else if (!ignoreTransferredSession && this.chatService.transferredSessionResource) {
        ref = await this.chatService.acquireOrLoadSession(this.chatService.transferredSessionResource, ChatAgentLocation.Chat, token, "ChatViewPane#showModel");
      } else {
        ref = await this.acquireDefaultNewSession(token) ?? this.chatService.startNewLocalSession(ChatAgentLocation.Chat, { debugOwner: "ChatViewPane#showModel" });
      }
      if (!ref) {
        throw new Error("Could not start chat session");
      }
    }
    if (token.isCancellationRequested) {
      ref?.dispose();
      return void 0;
    }
    this.modelRef.value = ref;
    const model = ref?.object;
    if (model) {
      await this.updateWidgetLockState(getChatSessionType(model.sessionResource));
      if (token.isCancellationRequested) {
        this.modelRef.value = void 0;
        return void 0;
      }
      this.viewState.sessionResource = model.sessionResource;
    }
    if (model) {
      setModelPreservingInputTypedWhileLoading(this._widget, baselineInput, () => this._widget.setModel(model));
      const widgetViewState = this.widgetViewStates.get(getComparisonKey(model.sessionResource));
      if (widgetViewState) {
        this._widget.restoreViewState(widgetViewState);
      }
    } else {
      this._widget.setModel(model);
    }
    this.titleControl?.update(model);
    this.updateActions();
    if (oldModelResource) {
      const capturedOldResource = oldModelResource;
      this._register(disposableTimeout(() => {
        const oldSession = this.agentSessionsService.model.getSession(capturedOldResource);
        if (oldSession && !oldSession.isMarkedUnread()) {
          oldSession.setRead(true);
        }
      }, 0));
    }
    return model;
  }
  async updateWidgetLockState(sessionType) {
    if (sessionType === localChatSessionType) {
      this._widget.unlockFromCodingAgent();
      return;
    }
    let canResolve = false;
    try {
      canResolve = await this.chatSessionsService.canResolveChatSession(sessionType);
    } catch (error) {
      this.logService.warn(`Failed to resolve chat session type '${sessionType}' for locking`, error);
    }
    if (!canResolve) {
      this._widget.unlockFromCodingAgent();
      return;
    }
    const contribution = this.chatSessionsService.getChatSessionContribution(sessionType);
    if (contribution) {
      this._widget.lockToCodingAgent(contribution.name, contribution.displayName, sessionType, contribution.agentHostProviderId);
    } else {
      this._widget.unlockFromCodingAgent();
    }
  }
  async clear() {
    this.loadSessionCts.value?.cancel();
    this.updateViewState();
    await this.showModel(CancellationToken.None);
    this.updateActions();
  }
  async loadSession(sessionResource) {
    const t0 = Date.now();
    this.logService.trace(`[ChatViewPane] loadSession start uri=${sessionResource.toString()}`);
    const inputBeforeLoad = this._widget?.getInput() ?? "";
    this.loadSessionCts.value?.cancel();
    const cts = this.loadSessionCts.value = new CancellationTokenSource();
    const token = cts.token;
    if (this.restoringSession) {
      await this.restoringSession;
    }
    if (token.isCancellationRequested) {
      this.logService.trace(`[ChatViewPane] loadSession done total=${Date.now() - t0}ms uri=${sessionResource.toString()} cancelled=true phase=preAcquire`);
      return void 0;
    }
    return this.progressService.withProgress({ location: ChatViewId, delay: 200 }, async () => {
      let queue = Promise.resolve();
      const clearWidget = disposableTimeout(() => {
        if (token.isCancellationRequested || this.loadSessionCts.value !== cts) {
          return;
        }
        queue = this.showModel(token, void 0, false).then(() => {
        });
      }, 100);
      const clearWidgetCancellationListener = token.onCancellationRequested(() => clearWidget.dispose());
      try {
        const newModelRef = await this.chatService.acquireOrLoadSession(sessionResource, ChatAgentLocation.Chat, token, "ChatViewPane#loadSession");
        clearWidget.dispose();
        await queue;
        if (token.isCancellationRequested) {
          newModelRef?.dispose();
          this.logService.trace(`[ChatViewPane] loadSession done total=${Date.now() - t0}ms uri=${sessionResource.toString()} cancelled=true phase=postAcquire`);
          return void 0;
        }
        const result = await this.showModel(token, newModelRef, true, false, inputBeforeLoad);
        this.logService.trace(`[ChatViewPane] loadSession done total=${Date.now() - t0}ms uri=${sessionResource.toString()}`);
        return result;
      } catch (err) {
        clearWidget.dispose();
        await queue;
        if (token.isCancellationRequested) {
          this.logService.trace(`[ChatViewPane] loadSession done total=${Date.now() - t0}ms uri=${sessionResource.toString()} cancelled=true phase=error`);
          return void 0;
        }
        this.logService.error(`Failed to load chat session '${sessionResource.toString()}'`, err);
        this.notificationService.error(localize("chat.loadSessionFailed", "Failed to open chat session: {0}", toErrorMessage(err)));
        const result = await this.showModel(token, void 0, true, false, inputBeforeLoad);
        this.logService.trace(`[ChatViewPane] loadSession done total=${Date.now() - t0}ms uri=${sessionResource.toString()} error=true`);
        return result;
      } finally {
        clearWidgetCancellationListener.dispose();
      }
    });
  }
  //#endregion
  focus() {
    super.focus();
    this.focusInput();
  }
  focusInput() {
    this._widget.focusInput();
  }
  focusSessions() {
    if (this.sessionsContainer?.style.display === "none") {
      return false;
    }
    this.sessionsControl?.focus();
    return true;
  }
  relayout() {
    if (!this._widget?.visible) {
      return;
    }
    if (this.lastDimensions) {
      this.layoutBody(this.lastDimensions.height, this.lastDimensions.width);
    }
  }
  relayoutForInputHeight() {
    if (this.layoutingBody || !this._widget?.visible || !this.lastDimensions) {
      return;
    }
    this.layoutChatAndSessions(this.lastDimensions.height, this.lastDimensions.width, false);
  }
  layoutBody(height, width) {
    if (this.layoutingBody) {
      return;
    }
    this.layoutingBody = true;
    try {
      this.doLayoutBody(height, width);
    } finally {
      this.layoutingBody = false;
    }
  }
  doLayoutBody(height, width) {
    super.layoutBody(height, width);
    this.lastDimensions = { height, width };
    this.layoutChatAndSessions(height, width, true);
  }
  layoutChatAndSessions(height, width, layoutInput) {
    let remainingHeight = height;
    const remainingWidth = width;
    const titleHeight = this.titleControl?.getHeight() ?? 0;
    remainingHeight -= titleHeight;
    const { heightReduction, widthReduction } = this.layoutSessionsControl(remainingHeight, remainingWidth);
    const inputMaxHeight = this.sessionsViewerOrientation === AgentSessionsViewerOrientation.Stacked ? remainingHeight : void 0;
    if (layoutInput) {
      this._widget.setInputPartMaxHeightOverride(inputMaxHeight);
      this._widget.layout(remainingHeight - heightReduction, remainingWidth - widthReduction);
    } else {
      layoutChatWidgetForInputHeight(this._widget, inputMaxHeight, remainingHeight - heightReduction, remainingWidth - widthReduction);
    }
    this.lastDimensionsPerOrientation.set(this.sessionsViewerOrientation, { height, width });
  }
  layoutSessionsControl(height, width) {
    let heightReduction = 0;
    let widthReduction = 0;
    if (!this.sessionsContainer || !this.sessionsControlContainer || !this.sessionsControl || !this.viewPaneContainer || !this.sessionsTitleContainer || !this.sessionsTitle) {
      return { heightReduction, widthReduction };
    }
    const oldSessionsViewerOrientation = this.sessionsViewerOrientation;
    let newSessionsViewerOrientation;
    switch (this.sessionsViewerOrientationConfiguration) {
      // Stacked
      case "stacked":
        newSessionsViewerOrientation = AgentSessionsViewerOrientation.Stacked;
        break;
      // Update orientation based on available width
      default:
        newSessionsViewerOrientation = width >= ChatViewPane.SESSIONS_SIDEBAR_VIEW_MIN_WIDTH ? AgentSessionsViewerOrientation.SideBySide : AgentSessionsViewerOrientation.Stacked;
    }
    this.sessionsViewerOrientation = newSessionsViewerOrientation;
    if (newSessionsViewerOrientation === AgentSessionsViewerOrientation.SideBySide) {
      this.viewPaneContainer.classList.toggle("sessions-control-orientation-sidebyside", true);
      this.viewPaneContainer.classList.toggle("sessions-control-orientation-stacked", false);
      this.sessionsViewerOrientationContext.set(AgentSessionsViewerOrientation.SideBySide);
    } else {
      this.viewPaneContainer.classList.toggle("sessions-control-orientation-sidebyside", false);
      this.viewPaneContainer.classList.toggle("sessions-control-orientation-stacked", true);
      this.sessionsViewerOrientationContext.set(AgentSessionsViewerOrientation.Stacked);
    }
    if (oldSessionsViewerOrientation !== this.sessionsViewerOrientation) {
      const updatePromise = this.sessionsControl.update();
      if (this.sessionsViewerOrientation === AgentSessionsViewerOrientation.SideBySide) {
        updatePromise.then((didUpdate) => {
          if (!didUpdate) {
            return;
          }
          const sessionResource = this._widget?.viewModel?.sessionResource;
          if (sessionResource) {
            this.sessionsControl?.reveal(sessionResource);
          }
        });
      }
    }
    const { visible: sessionsContainerVisible } = this.updateSessionsControlVisibility();
    if (!sessionsContainerVisible || this.sessionsViewerOrientation === AgentSessionsViewerOrientation.Stacked) {
      this.sessionsViewerSashDisposables.clear();
      this.sessionsViewerSash = void 0;
    } else if (this.sessionsViewerOrientation === AgentSessionsViewerOrientation.SideBySide) {
      if (!this.sessionsViewerSashDisposables.value && this.viewPaneContainer) {
        this.createSessionsViewerSash(this.viewPaneContainer, height, width);
      }
    }
    if (!sessionsContainerVisible) {
      return { heightReduction: 0, widthReduction: 0 };
    }
    const sessionsTitleHeight = this.sessionsTitleContainer.offsetHeight;
    let availableSessionsHeight = height - sessionsTitleHeight;
    let reservedChatWidgetHeight = 0;
    if (this.sessionsViewerOrientation === AgentSessionsViewerOrientation.Stacked) {
      reservedChatWidgetHeight = Math.max(ChatViewPane.MIN_CHAT_WIDGET_HEIGHT, this._widget?.input?.height.get() ?? 0);
      availableSessionsHeight -= reservedChatWidgetHeight;
    } else {
      availableSessionsHeight -= this.sessionsNewButtonContainer?.offsetHeight ?? 0;
    }
    availableSessionsHeight = Math.max(0, availableSessionsHeight);
    if (this.sessionsViewerOrientation === AgentSessionsViewerOrientation.SideBySide) {
      const sessionsViewerSidebarWidth = this.computeEffectiveSideBySideSessionsSidebarWidth(width);
      this.sessionsControlContainer.style.height = `${availableSessionsHeight}px`;
      this.sessionsControlContainer.style.width = `${sessionsViewerSidebarWidth}px`;
      this.sessionsControl.layout(availableSessionsHeight, sessionsViewerSidebarWidth);
      this.sessionsViewerSash?.layout();
      heightReduction = 0;
      widthReduction = sessionsViewerSidebarWidth + ChatViewPane.SESSIONS_SIDEBAR_BORDER_WIDTH;
    } else {
      this.sessionsControlContainer.style.height = `${availableSessionsHeight}px`;
      this.sessionsControlContainer.style.width = ``;
      this.sessionsControl.layout(availableSessionsHeight, width);
      heightReduction = sessionsTitleHeight + availableSessionsHeight;
      widthReduction = 0;
    }
    return { heightReduction, widthReduction };
  }
  computeEffectiveSideBySideSessionsSidebarWidth(width, sessionsViewerSidebarWidth = this.sessionsViewerSidebarWidth) {
    return Math.max(
      ChatViewPane.SESSIONS_SIDEBAR_MIN_WIDTH,
      // never smaller than min width for side by side sessions
      Math.min(
        sessionsViewerSidebarWidth,
        width - ChatViewPane.CHAT_WIDGET_DEFAULT_WIDTH
        // never so wide that chat widget is smaller than default width
      )
    );
  }
  getLastDimensions(orientation) {
    return this.lastDimensionsPerOrientation.get(orientation);
  }
  createSessionsViewerSash(container, height, width) {
    const disposables = this.sessionsViewerSashDisposables.value = new DisposableStore();
    const sash = this.sessionsViewerSash = disposables.add(new Sash(container, {
      getVerticalSashLeft: () => {
        const sessionsViewerSidebarWidth = this.computeEffectiveSideBySideSessionsSidebarWidth(this.lastDimensions?.width ?? width);
        const { position } = this.getViewPositionAndLocation();
        if (position === Position.RIGHT) {
          return (this.lastDimensions?.width ?? width) - sessionsViewerSidebarWidth;
        }
        return sessionsViewerSidebarWidth;
      }
    }, { orientation: Orientation.VERTICAL }));
    let sashStartWidth;
    disposables.add(sash.onDidStart(() => sashStartWidth = this.sessionsViewerSidebarWidth));
    disposables.add(sash.onDidEnd(() => sashStartWidth = void 0));
    disposables.add(sash.onDidChange((e) => {
      if (sashStartWidth === void 0 || !this.lastDimensions) {
        return;
      }
      const { position } = this.getViewPositionAndLocation();
      const delta = e.currentX - e.startX;
      const newWidth = position === Position.RIGHT ? sashStartWidth - delta : sashStartWidth + delta;
      if (newWidth < ChatViewPane.SESSIONS_SIDEBAR_SNAP_THRESHOLD) {
        this.updateConfiguredSessionsViewerOrientation("stacked");
        return;
      }
      this.sessionsViewerSidebarWidth = this.computeEffectiveSideBySideSessionsSidebarWidth(this.lastDimensions.width, newWidth);
      this.viewState.sessionsSidebarWidth = this.sessionsViewerSidebarWidth;
      this.layoutBody(this.lastDimensions.height, this.lastDimensions.width);
    }));
    disposables.add(sash.onDidReset(() => {
      this.sessionsViewerSidebarWidth = ChatViewPane.SESSIONS_SIDEBAR_DEFAULT_WIDTH;
      this.viewState.sessionsSidebarWidth = this.sessionsViewerSidebarWidth;
      this.relayout();
    }));
  }
  //#endregion
  saveState() {
    if (this._widget?.viewModel) {
      this._widget.saveState();
      this.updateViewState();
      this.memento.saveMemento();
    }
    super.saveState();
  }
  updateViewState(viewState) {
    const newViewState = viewState ?? this._widget.getInputState();
    if (newViewState) {
      for (const [key, value] of Object.entries(newViewState)) {
        this.viewState[key] = value;
      }
    }
  }
  shouldShowWelcome() {
    const noPersistedSessions = !this.chatService.hasSessions();
    const hasCoreAgent = this.chatAgentService.getAgents().some((agent) => agent.isCore && agent.locations.includes(ChatAgentLocation.Chat));
    const hasDefaultAgent = this.chatAgentService.getDefaultAgent(ChatAgentLocation.Chat) !== void 0;
    const shouldShow = !hasCoreAgent && (!hasDefaultAgent || !this._widget?.viewModel && noPersistedSessions);
    this.logService.trace(`ChatViewPane#shouldShowWelcome() = ${shouldShow}: hasCoreAgent=${hasCoreAgent} hasDefaultAgent=${hasDefaultAgent} || noViewModel=${!this._widget?.viewModel} && noPersistedSessions=${noPersistedSessions}`);
    return !!shouldShow;
  }
  getMatchingWelcomeView() {
    return this.welcomeController?.getMatchingWelcomeView();
  }
  getActionsContext() {
    return this._widget?.viewModel ? {
      sessionResource: this._widget.viewModel.sessionResource,
      $mid: MarshalledId.ChatViewContext
    } : void 0;
  }
};
ChatViewPane = __decorateClass([
  __decorateParam(1, IKeybindingService),
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IViewDescriptorService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, IHoverService),
  __decorateParam(10, IStorageService),
  __decorateParam(11, IChatService),
  __decorateParam(12, IChatAgentService),
  __decorateParam(13, ILogService),
  __decorateParam(14, INotificationService),
  __decorateParam(15, IWorkbenchLayoutService),
  __decorateParam(16, IChatSessionsService),
  __decorateParam(17, ITelemetryService),
  __decorateParam(18, ILifecycleService),
  __decorateParam(19, IProgressService),
  __decorateParam(20, IAgentSessionsService),
  __decorateParam(21, IChatEntitlementService),
  __decorateParam(22, ICommandService),
  __decorateParam(23, IActivityService),
  __decorateParam(24, IHostService),
  __decorateParam(25, IMicCaptureService),
  __decorateParam(26, ITtsPlaybackService),
  __decorateParam(27, IVoiceSessionController),
  __decorateParam(28, IVoiceInputModeService),
  __decorateParam(29, IChatWidgetService),
  __decorateParam(30, IAgentTitleBarStatusService),
  __decorateParam(31, IVoicePlaybackService),
  __decorateParam(32, IWorkbenchEnvironmentService),
  __decorateParam(33, IWorkspaceContextService),
  __decorateParam(34, IAgentHostEnablementService),
  __decorateParam(35, IAccessibilityService)
], ChatViewPane);
export {
  ChatViewPane
};
