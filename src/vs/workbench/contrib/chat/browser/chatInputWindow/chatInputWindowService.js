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
import "./media/chatInputWindow.css";
import * as dom from "../../../../../base/browser/dom.js";
import { renderAsPlaintext } from "../../../../../base/browser/markdownRenderer.js";
import { Button } from "../../../../../base/browser/ui/button/button.js";
import { renderIcon } from "../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { Disposable, DisposableMap, DisposableStore, MutableDisposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { AnchorPosition } from "../../../../../base/common/layout.js";
import { KeyCode } from "../../../../../base/common/keyCodes.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { mainWindow } from "../../../../../base/browser/window.js";
import { InstantiationType, registerSingleton } from "../../../../../platform/instantiation/common/extensions.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { IAuxiliaryWindowService } from "../../../../services/auxiliaryWindow/browser/auxiliaryWindowService.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { defaultButtonStyles } from "../../../../../platform/theme/browser/defaultStyles.js";
import { editorBackground } from "../../../../../platform/theme/common/colorRegistry.js";
import { inputBackground, inputBorder } from "../../../../../platform/theme/common/colors/inputColors.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { IHostService } from "../../../../services/host/browser/host.js";
import { localize } from "../../../../../nls.js";
import { ChatAgentLocation } from "../../common/constants.js";
import { ChatMode } from "../../common/chatModes.js";
import { IChatService, IChatToolInvocation, ToolConfirmKind } from "../../common/chatService/chatService.js";
import { isResponseVM } from "../../common/model/chatViewModel.js";
import { ChatWidget } from "../widget/chatWidget.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
import { ChatSessionRoutingController } from "../sessionRouter/chatSessionRoutingController.js";
import { combineVoiceInput } from "../voiceClient/voiceInputUtils.js";
import { IChatInputWindowService, ChatInputWindowStorageKeys, CHAT_INPUT_WINDOW_DEFAULT_HEIGHT, CHAT_INPUT_WINDOW_SET_VOICE_TARGET_COMMAND_ID } from "../../common/chatInputWindow.js";
import { autorun, observableValue } from "../../../../../base/common/observable.js";
import { AgentSessionStatus } from "../agentSessions/agentSessionsModel.js";
import { IAgentSessionsService } from "../agentSessions/agentSessionsService.js";
import { IVoiceSessionController } from "../voiceClient/voiceSessionController.js";
import { IMicCaptureService } from "../voiceClient/micCaptureService.js";
import { ITtsPlaybackService } from "../voiceClient/ttsPlaybackService.js";
import { setupVoiceInputDecorations } from "../voiceClient/voiceInputDecorations.js";
import { IAccessibilityService } from "../../../../../platform/accessibility/common/accessibility.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { IChatEntitlementService } from "../../../../services/chat/common/chatEntitlementService.js";
import { OmniChatEnabledSettingId } from "../../common/sessionRouter.js";
import { AgentSessionProviders } from "../agentSessions/agentSessions.js";
import { derivePendingId, getVoiceToolApprovalCommand, isPendingIdResolved, markPendingIdResolved } from "../../common/voiceClient/voiceClientService.js";
import { ConfirmationOptionKind } from "../../../../../platform/agentHost/common/state/protocol/state.js";
const CHAT_INPUT_WINDOW_MODEL_PICKER_HEIGHT = 420;
const CHAT_INPUT_WINDOW_INITIAL_SURFACE_HEIGHT = 44;
const CHAT_INPUT_WINDOW_MAX_WIDTH = 600;
const CHAT_INPUT_WINDOW_MAX_PENDING_HEIGHT = 360;
const CHAT_INPUT_WINDOW_MIN_CONFIRMATION_HEIGHT = 112;
function getDescendantElements(parent, className) {
  const result = [];
  const visit = (element) => {
    for (const child of element.children) {
      if (!dom.isHTMLElement(child)) {
        continue;
      }
      if (!className || child.classList.contains(className)) {
        result.push(child);
      }
      visit(child);
    }
  };
  visit(parent);
  return result;
}
let ChatInputWindowService = class extends Disposable {
  constructor(auxiliaryWindowService, storageService, themeService, workspaceContextService, instantiationService, contextKeyService, chatService, commandService, agentSessionsService, logService, voiceSessionController, micCaptureService, ttsPlaybackService, accessibilityService, configurationService, keybindingService, chatEntitlementService, hostService) {
    super();
    this.auxiliaryWindowService = auxiliaryWindowService;
    this.storageService = storageService;
    this.themeService = themeService;
    this.workspaceContextService = workspaceContextService;
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.chatService = chatService;
    this.commandService = commandService;
    this.agentSessionsService = agentSessionsService;
    this.logService = logService;
    this.voiceSessionController = voiceSessionController;
    this.micCaptureService = micCaptureService;
    this.ttsPlaybackService = ttsPlaybackService;
    this.accessibilityService = accessibilityService;
    this.configurationService = configurationService;
    this.keybindingService = keybindingService;
    this.chatEntitlementService = chatEntitlementService;
    this.hostService = hostService;
    this._onDidChangeOpen = this._register(new Emitter());
    this.onDidChangeOpen = this._onDidChangeOpen.event;
    this._auxiliaryWindowRef = this._register(new MutableDisposable());
    this._windowDisposables = this._register(new DisposableStore());
    this._pendingPromptIndex = 0;
    this._voiceConfirmationPending = observableValue(this, false);
    this._fitWindowToContent = () => {
    };
    this._desiredOpen = false;
    this._ownershipId = mainWindow.crypto.randomUUID();
    this._actionWidgetWindow = this._register(new MutableDisposable());
    this._actionWidgetLayoutGeneration = 0;
    this._actionWidgetVisibilityCount = 0;
    this._actionWidgetWindowAnchorY = 0;
    /** Immutable bounds of the window that invoked omni, captured before service resolution. */
    this._invokingWindowBounds = this._windowBounds(mainWindow);
    const ownershipChannel = new BroadcastChannel("chat-input-window-ownership");
    ownershipChannel.onmessage = (e) => {
      const incoming = e.data;
      if (incoming?.type !== "claim" || typeof incoming.timestamp !== "number" || typeof incoming.id !== "string") {
        return;
      }
      const current = this._ownershipClaim;
      const incomingWins = !current || incoming.timestamp > current.timestamp || incoming.timestamp === current.timestamp && incoming.id > current.id;
      if (incomingWins) {
        this.closeWindow();
      }
    };
    this._register({ dispose: () => ownershipChannel.close() });
    this._ownershipChannel = ownershipChannel;
    this._register(dom.addDisposableListener(mainWindow, "beforeunload", () => {
      if (this._window) {
        this.closeWindow();
      }
    }));
    const wasOpen = this.storageService.getBoolean(ChatInputWindowStorageKeys.WindowOpen, StorageScope.WORKSPACE, false);
    if (wasOpen) {
      this.storageService.store(ChatInputWindowStorageKeys.WindowOpen, false, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    }
    const closeWhenDisabled = () => {
      if (!this._isEnabled()) {
        this.closeWindow();
      }
    };
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(OmniChatEnabledSettingId)) {
        closeWhenDisabled();
      }
    }));
    this._register(this.chatEntitlementService.onDidChangeSentiment(closeWhenDisabled));
  }
  get isOpen() {
    return !!this._window;
  }
  get hasFocus() {
    return this._window?.window.document.hasFocus() ?? false;
  }
  async openWindow(invokingWindowBounds) {
    if (!this._isEnabled()) {
      return;
    }
    this._desiredOpen = true;
    if (this._window) {
      return;
    }
    if (this._openOperation) {
      return this._openOperation;
    }
    this._invokingWindowBounds = this._isUsableWindowBounds(invokingWindowBounds) ? invokingWindowBounds : this._windowBounds(dom.getActiveWindow());
    this._openOperation = this._doOpenWindow();
    try {
      await this._openOperation;
    } catch (error) {
      this._desiredOpen = false;
      this._disposeWidget();
      this._window = void 0;
      this._windowDisposables.clear();
      this._auxiliaryWindowRef.clear();
      this.storageService.store(ChatInputWindowStorageKeys.WindowOpen, false, StorageScope.WORKSPACE, StorageTarget.MACHINE);
      throw error;
    } finally {
      this._openOperation = void 0;
    }
  }
  async _doOpenWindow() {
    const bounds = this._defaultBounds();
    const auxiliaryWindow = await this.auxiliaryWindowService.open({
      bounds,
      alwaysOnTop: true,
      frameless: true,
      transparent: true,
      disableFullscreen: true,
      nativeTitlebar: false,
      noBackgroundThrottling: true,
      backgroundColor: "#00000000"
    });
    if (!this._desiredOpen || !this._isEnabled()) {
      auxiliaryWindow.dispose();
      return;
    }
    this._window = auxiliaryWindow;
    this._auxiliaryWindowRef.value = auxiliaryWindow;
    this.voiceSessionController.setOmniInputOpen(true);
    const workspace = this.workspaceContextService.getWorkspace();
    const projectName = workspace.folders.length > 0 ? workspace.folders[0].name : "";
    auxiliaryWindow.window.document.title = projectName ? localize("chatInputWindow.titleWithProject", "Chat Input \u2014 {0}", projectName) : localize("chatInputWindow.title", "Chat Input");
    auxiliaryWindow.container.style.overflow = "hidden";
    auxiliaryWindow.container.classList.add("chat-input-window");
    auxiliaryWindow.window.document.body.classList.add("chat-input-window-body");
    auxiliaryWindow.window.document.body.style.setProperty("margin", "0", "important");
    this._windowDisposables.clear();
    const applyThemeColors = () => {
      const theme = this.themeService.getColorTheme();
      const surface = theme.getColor(inputBackground)?.toString() ?? "#3c3c3c";
      const border = theme.getColor(inputBorder)?.toString() ?? "transparent";
      auxiliaryWindow.window.document.body.style.setProperty("background-color", "transparent", "important");
      auxiliaryWindow.container.style.backgroundColor = surface;
      auxiliaryWindow.container.style.border = `1px solid ${border}`;
    };
    auxiliaryWindow.container.style.display = "flex";
    auxiliaryWindow.container.style.flexDirection = "column";
    const row = dom.append(auxiliaryWindow.container, dom.$(".chat-input-window-row"));
    this._row = row;
    const lead = dom.append(row, dom.$(".chat-input-window-lead", {
      "aria-hidden": "true",
      title: localize("chatInputWindow.drag", "Drag to move")
    }));
    this._lead = lead;
    lead.style.setProperty("-webkit-app-region", "drag");
    lead.appendChild(renderIcon(Codicon.grabber));
    applyThemeColors();
    this._windowDisposables.add(this.themeService.onDidColorThemeChange(() => applyThemeColors()));
    this._renderChatWidget(auxiliaryWindow, row, bounds);
    const pendingActiveWindowSync = this._windowDisposables.add(new MutableDisposable());
    this._windowDisposables.add(autorun((reader) => {
      const ownsVoice = this.voiceSessionController.omniInputActive.read(reader);
      if (ownsVoice || auxiliaryWindow.window.document.hasFocus()) {
        return;
      }
      pendingActiveWindowSync.value = dom.scheduleAtNextAnimationFrame(auxiliaryWindow.window, () => {
        const activeWindow = dom.getActiveWindow();
        if (activeWindow !== auxiliaryWindow.window) {
          this.voiceSessionController.setActiveWindow(activeWindow);
        }
      });
    }));
    const trail = dom.append(row, dom.$(".chat-input-window-trail"));
    this._trail = trail;
    const close = dom.append(trail, dom.$("a.chat-input-window-close", {
      role: "button",
      tabindex: "0",
      "aria-label": localize("chatInputWindow.close.label", "Close")
    }));
    close.appendChild(renderIcon(Codicon.close));
    this._windowDisposables.add(dom.addDisposableListener(close, dom.EventType.CLICK, () => this.closeWindow()));
    this._windowDisposables.add(dom.addStandardDisposableListener(close, dom.EventType.KEY_DOWN, (event) => {
      if (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space)) {
        event.preventDefault();
        this.closeWindow();
      }
    }));
    this._renderPendingPrompts(auxiliaryWindow);
    Event.once(auxiliaryWindow.onUnload)(() => {
      if (this._window !== auxiliaryWindow) {
        return;
      }
      this._storeWindowPosition(auxiliaryWindow);
      this._disposeWidget();
      this._desiredOpen = false;
      this._ownershipClaim = void 0;
      this._window = void 0;
      this._windowDisposables.clear();
      this._auxiliaryWindowRef.value = void 0;
      this.storageService.store(ChatInputWindowStorageKeys.WindowOpen, false, StorageScope.WORKSPACE, StorageTarget.MACHINE);
      this._onDidChangeOpen.fire(false);
    });
    this.storageService.store(ChatInputWindowStorageKeys.WindowOpen, true, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    this._onDidChangeOpen.fire(true);
  }
  closeWindow() {
    this._desiredOpen = false;
    this._ownershipClaim = void 0;
    if (!this._window) {
      return;
    }
    this._storeWindowPosition(this._window);
    this.storageService.store(ChatInputWindowStorageKeys.WindowOpen, false, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    this._routingController?.cancelPending();
    this._disposeWidget();
    this._window = void 0;
    this._windowDisposables.clear();
    this._auxiliaryWindowRef.value = void 0;
    this._onDidChangeOpen.fire(false);
  }
  async toggleWindow(invokingWindowBounds) {
    if (this._desiredOpen || this.isOpen) {
      this.closeWindow();
    } else {
      const claim = { timestamp: Date.now(), id: this._ownershipId };
      this._ownershipClaim = claim;
      this._ownershipChannel.postMessage({ type: "claim", ...claim });
      await this.openWindow(invokingWindowBounds);
    }
  }
  async acceptVoiceInput(text) {
    const window = this._window?.window;
    const widget = this._widget;
    if (!window?.document.hasFocus() && !this.voiceSessionController.omniInputActive.get() || !widget || !this._routingController) {
      return false;
    }
    await widget.acceptInput(combineVoiceInput(widget.getInput(), text), {
      preserveFocus: true,
      isVoiceModeInput: true
    });
    return true;
  }
  _renderChatWidget(auxiliaryWindow, row, openingBounds) {
    const parent = dom.append(row, dom.$(".interactive-session"));
    parent.style.flex = "1 1 auto";
    parent.style.minWidth = "0";
    const scopedContextKeyService = this._windowDisposables.add(this.contextKeyService.createScoped(parent));
    ChatContextKeys.inChatInputWindow.bindTo(scopedContextKeyService).set(true);
    const scopedInstantiationService = this._windowDisposables.add(this.instantiationService.createChild(
      new ServiceCollection([
        IContextKeyService,
        scopedContextKeyService
      ])
    ));
    const widget = this._windowDisposables.add(scopedInstantiationService.createInstance(
      ChatWidget,
      ChatAgentLocation.Chat,
      { isQuickChat: true },
      {
        autoScroll: true,
        renderInputOnTop: true,
        renderStyle: "compact",
        renderGettingStartedTip: false,
        // Show only the input box — drop every response list item.
        filter: () => false,
        enableImplicitContext: false,
        defaultMode: ChatMode.Agent,
        menus: { telemetrySource: "chatInputWindow" },
        // Routing seam: intercept submission before local execution and
        // route it to the best-matching existing session (or a new one),
        // forwarding any explicit attachments on the input.
        submitHandler: (query, mode, attachedContext, isVoiceModeInput) => this._routingController?.handleSubmit(query, mode, attachedContext, isVoiceModeInput) ?? Promise.resolve(false),
        onDidChangeModelPickerVisibility: (visible) => this._setModelPickerVisible(auxiliaryWindow, visible),
        inputPickerPosition: AnchorPosition.BELOW,
        inputPickerContainer: () => this._actionWidgetWindow.value?.container,
        inputPickerAnchor: (anchor) => this._getModelPickerAnchor(anchor),
        inputPickerOpenOnMouseUp: true
      },
      {
        inputEditorBackground: inputBackground,
        resultEditorBackground: editorBackground,
        listBackground: editorBackground,
        listForeground: editorBackground,
        overlayBackground: editorBackground
      }
    ));
    this._widget = widget;
    widget.render(parent);
    widget.setVisible(true);
    const inputContainer = widget.input.inputContainerElement;
    if (inputContainer) {
      try {
        this._windowDisposables.add(setupVoiceInputDecorations({
          voiceSessionController: this.voiceSessionController,
          ttsPlaybackService: this.ttsPlaybackService,
          micCaptureService: this.micCaptureService,
          configurationService: this.configurationService,
          keybindingService: this.keybindingService,
          themeService: this.themeService,
          accessibilityService: this.accessibilityService
        }, {
          inputContainer,
          glowContainer: auxiliaryWindow.container,
          isActive: this.voiceSessionController.omniInputActive,
          isOwner: this.voiceSessionController.omniInputActive,
          confirmationPending: this._voiceConfirmationPending
        }));
      } catch (error) {
        this.logService.error("[chatInputWindow] Failed to initialize voice decorations", error);
      }
    }
    const modelRef = this.chatService.startNewLocalSession(ChatAgentLocation.Chat, { disableBackgroundKeepAlive: true, debugOwner: "ChatInputWindow" });
    this._modelRef = modelRef;
    widget.setModel(modelRef.object);
    let fitWindowToInput = () => {
    };
    const host = {
      widget,
      getOwnSessionResource: () => this._modelRef?.object.sessionResource,
      getPendingReplySessionResource: () => this._activePendingSessionResource,
      getNewSessionTarget: () => AgentSessionProviders.AgentHostCopilot,
      onWillRoute: () => this.voiceSessionController.prepareForRoutingRequest(),
      onWillDispatchRoute: (resource) => this.voiceSessionController.markRoutedRequestPending(resource),
      onDidRejectRoute: (resource) => this.voiceSessionController.clearRoutedRequest(resource),
      onDidResolveRoute: (resource, kind, _isVoiceModeInput, requestId) => {
        if (resource) {
          this.voiceSessionController.markRoutedRequestPending(resource, requestId);
        }
        this.commandService.executeCommand(CHAT_INPUT_WINDOW_SET_VOICE_TARGET_COMMAND_ID, resource?.toString(), kind).catch(() => {
        });
      },
      placeBadge: (badge) => {
        const container = this._window?.container;
        const row2 = this._row;
        if (!container || !row2) {
          return;
        }
        row2.after(badge);
        fitWindowToInput();
        const observerDisposables = this._windowDisposables.add(new DisposableStore());
        const resizeObserver = new auxiliaryWindow.window.ResizeObserver(() => fitWindowToInput());
        observerDisposables.add(toDisposable(() => resizeObserver.disconnect()));
        resizeObserver.observe(badge);
        const observer = new auxiliaryWindow.window.MutationObserver(() => {
          if (!badge.isConnected) {
            observerDisposables.dispose();
            fitWindowToInput();
          }
        });
        observerDisposables.add(toDisposable(() => observer.disconnect()));
        observer.observe(container, { childList: true });
      }
    };
    this._routingController = this._windowDisposables.add(this.instantiationService.createInstance(ChatSessionRoutingController, host, "chatInputWindow"));
    let lastContentHeight;
    let didInitialPosition = false;
    let currentPosition = { x: openingBounds.x, y: openingBounds.y };
    let pendingBounds;
    let applyingBounds = false;
    const applyPendingBounds = async () => {
      if (applyingBounds) {
        return;
      }
      applyingBounds = true;
      try {
        while (pendingBounds && this._window === auxiliaryWindow) {
          const bounds = pendingBounds;
          pendingBounds = void 0;
          currentPosition = { x: bounds.x, y: bounds.y };
          await auxiliaryWindow.setBounds(bounds);
        }
      } finally {
        applyingBounds = false;
      }
    };
    fitWindowToInput = () => {
      const win = this._window?.window;
      if (!win || win !== auxiliaryWindow.window) {
        return;
      }
      const width = Math.max(this._defaultWidth(), win.outerWidth);
      const rowHeight = Math.max(CHAT_INPUT_WINDOW_INITIAL_SURFACE_HEIGHT, Math.ceil(widget.contentHeight));
      const extraHeight = Array.from(auxiliaryWindow.container.children).filter((child) => child !== this._row).reduce((height, child) => {
        const element = child;
        const position = auxiliaryWindow.window.getComputedStyle(element).position;
        return position === "absolute" || position === "fixed" ? height : height + element.offsetHeight;
      }, 0);
      const contentHeight = rowHeight + extraHeight + 2;
      if (contentHeight === lastContentHeight) {
        return;
      }
      lastContentHeight = contentHeight;
      if (!didInitialPosition) {
        didInitialPosition = true;
        const initialBounds = this._positionedBounds(width, contentHeight);
        currentPosition = { x: initialBounds.x, y: initialBounds.y };
      } else if (!applyingBounds) {
        currentPosition = { x: win.screenX, y: win.screenY };
      }
      pendingBounds = { ...currentPosition, width, height: contentHeight };
      void applyPendingBounds();
    };
    this._fitWindowToContent = fitWindowToInput;
    let layingOut = false;
    const layout = () => {
      if (layingOut) {
        return;
      }
      layingOut = true;
      try {
        const chrome = (this._lead?.offsetWidth ?? 0) + (this._trail?.offsetWidth ?? 0);
        const rowStyle = auxiliaryWindow.window.getComputedStyle(row);
        const horizontalPadding = Number.parseFloat(rowStyle.paddingLeft) + Number.parseFloat(rowStyle.paddingRight);
        const available = Math.max(0, row.clientWidth - chrome - horizontalPadding);
        parent.style.width = `${available}px`;
        widget.input.layout(available);
        widget.layoutForInputHeight(Math.max(CHAT_INPUT_WINDOW_INITIAL_SURFACE_HEIGHT, widget.contentHeight), available);
        const spill = parent.scrollWidth - parent.clientWidth;
        if (spill > 0) {
          const compensatedWidth = Math.max(0, available - spill);
          widget.input.layout(compensatedWidth);
          widget.layoutForInputHeight(Math.max(CHAT_INPUT_WINDOW_INITIAL_SURFACE_HEIGHT, widget.contentHeight), compensatedWidth);
        }
        fitWindowToInput();
      } finally {
        layingOut = false;
      }
    };
    layout();
    this._windowDisposables.add(widget.onDidChangeContentHeight(() => fitWindowToInput()));
    const scheduledInputLayout = this._windowDisposables.add(new MutableDisposable());
    this._windowDisposables.add(widget.inputEditor.onDidChangeModelContent(() => {
      scheduledInputLayout.value = dom.scheduleAtNextAnimationFrame(auxiliaryWindow.window, () => layout());
    }));
    this._windowDisposables.add(dom.scheduleAtNextAnimationFrame(auxiliaryWindow.window, () => {
      layout();
      this._windowDisposables.add(dom.scheduleAtNextAnimationFrame(auxiliaryWindow.window, () => {
        widget.focusInput();
      }));
    }));
    this._windowDisposables.add(dom.addDisposableListener(auxiliaryWindow.window, "focus", () => {
      widget.focusInput();
      if (this.voiceSessionController.omniInputActive.get()) {
        this.voiceSessionController.setOmniInputActive(true);
        this.voiceSessionController.setActiveWindow(auxiliaryWindow.window);
      }
    }));
    this._windowDisposables.add(dom.addDisposableListener(auxiliaryWindow.window, "resize", layout));
  }
  _renderPendingPrompts(auxiliaryWindow) {
    const panel = dom.append(auxiliaryWindow.container, dom.$(".chat-input-window-pending-panel"));
    const header = dom.append(panel, dom.$(".chat-input-window-pending-header", { "aria-live": "polite" }));
    const marker = dom.append(header, dom.$("span.chat-input-window-pending-marker", { "aria-hidden": "true" }));
    marker.appendChild(renderIcon(Codicon.gripper));
    const label = dom.append(header, dom.$("span.chat-input-window-pending-label"));
    const navigation = dom.append(header, dom.$(".chat-input-window-pending-navigation"));
    const previous = this._appendPendingNavigationButton(navigation, Codicon.chevronLeft, localize("chatInputWindow.pending.previous", "Previous Request"));
    const next = this._appendPendingNavigationButton(navigation, Codicon.chevronRight, localize("chatInputWindow.pending.next", "Next Request"));
    const approvalFallback = dom.append(panel, dom.$(".chat-input-window-pending-approval-fallback"));
    const approvalTitle = dom.append(approvalFallback, dom.$(".chat-input-window-pending-approval-title"));
    const approvalMessage = dom.append(approvalFallback, dom.$(".chat-input-window-pending-approval-message"));
    const approvalCommand = dom.append(approvalFallback, dom.$("code.chat-input-window-pending-approval-command"));
    const approvalDisclaimer = dom.append(approvalFallback, dom.$(".chat-input-window-pending-approval-disclaimer"));
    const approvalActions = dom.append(approvalFallback, dom.$(".chat-input-window-pending-approval-actions"));
    const approvalActionDisposables = this._windowDisposables.add(new MutableDisposable());
    let lastActivatedApproval;
    let displayedApproval;
    const renderApprovalFallback = (approval) => {
      approvalActionDisposables.value = new DisposableStore();
      approvalActions.replaceChildren();
      if (!approval) {
        return;
      }
      const state = approval.invocation.state.get();
      if (state.type !== IChatToolInvocation.StateKind.WaitingForConfirmation && state.type !== IChatToolInvocation.StateKind.WaitingForPostApproval) {
        return;
      }
      const messages = state.confirmationMessages;
      approvalTitle.textContent = renderAsPlaintext(messages?.title ?? approval.invocation.invocationMessage);
      approvalMessage.textContent = renderAsPlaintext(messages?.message ?? "");
      approvalMessage.classList.toggle("hidden", !approvalMessage.textContent);
      approvalCommand.textContent = getVoiceToolApprovalCommand(approval.invocation) ?? "";
      approvalCommand.classList.toggle("hidden", !approvalCommand.textContent);
      const approvalReason = messages?.approvalReason?.status === "complete" ? renderAsPlaintext(messages.approvalReason.explanation) : "";
      approvalDisclaimer.textContent = [renderAsPlaintext(messages?.disclaimer ?? ""), approvalReason].filter(Boolean).join("\n");
      approvalDisclaimer.classList.toggle("hidden", !approvalDisclaimer.textContent);
      const confirm = (reason) => {
        markPendingIdResolved(approval.occurrence);
        IChatToolInvocation.confirmWith(approval.invocation, reason);
      };
      const options = messages?.customOptions;
      if (options?.length) {
        for (const option of options) {
          const button = approvalActionDisposables.value.add(new Button(approvalActions, {
            ...defaultButtonStyles,
            small: true,
            secondary: option.kind === ConfirmationOptionKind.Deny
          }));
          button.label = option.label;
          approvalActionDisposables.value.add(button.onDidClick(() => confirm({
            type: ToolConfirmKind.UserAction,
            selectedButton: option.id,
            selectedButtonKind: option.kind
          })));
        }
      } else {
        const allowButton = approvalActionDisposables.value.add(new Button(approvalActions, {
          ...defaultButtonStyles,
          small: true
        }));
        allowButton.label = messages?.confirmResults ? localize("chatInputWindow.pending.allowAndReview", "Allow and Review Once") : localize("chatInputWindow.pending.allow", "Allow Once");
        approvalActionDisposables.value.add(allowButton.onDidClick(() => confirm({ type: ToolConfirmKind.UserAction })));
        const skipButton = approvalActionDisposables.value.add(new Button(approvalActions, {
          ...defaultButtonStyles,
          small: true,
          secondary: true
        }));
        skipButton.label = localize("chatInputWindow.pending.skip", "Skip");
        approvalActionDisposables.value.add(skipButton.onDidClick(() => confirm({ type: ToolConfirmKind.Skipped })));
      }
    };
    const parent = dom.append(panel, dom.$(".chat-input-window-pending-widget.interactive-session"));
    this._windowDisposables.add(dom.addDisposableListener(parent, dom.EventType.CLICK, (event) => {
      const approval = displayedApproval;
      const target = event.target;
      if (!approval || !(target instanceof auxiliaryWindow.window.Element) || !target.closest(".chat-confirmation-widget-buttons")) {
        return;
      }
      const state = approval.invocation.state.get();
      if (state.type === IChatToolInvocation.StateKind.WaitingForConfirmation || state.type === IChatToolInvocation.StateKind.WaitingForPostApproval) {
        markPendingIdResolved(approval.occurrence);
      }
    }, { capture: true }));
    const scopedContextKeyService = this._windowDisposables.add(this.contextKeyService.createScoped(parent));
    ChatContextKeys.inChatInputWindow.bindTo(scopedContextKeyService).set(true);
    const scopedInstantiationService = this._windowDisposables.add(this.instantiationService.createChild(
      new ServiceCollection([
        IContextKeyService,
        scopedContextKeyService
      ])
    ));
    const widget = this._windowDisposables.add(scopedInstantiationService.createInstance(
      ChatWidget,
      ChatAgentLocation.Chat,
      { isQuickChat: true },
      {
        autoScroll: true,
        renderInputOnTop: true,
        renderStyle: "compact",
        renderGettingStartedTip: false,
        filter: (item) => isResponseVM(item) && !!item.model.isPendingConfirmation.get(),
        enableImplicitContext: false,
        defaultMode: ChatMode.Ask,
        menus: { telemetrySource: "chatInputWindowPending" }
      },
      {
        inputEditorBackground: inputBackground,
        resultEditorBackground: editorBackground,
        listBackground: editorBackground,
        listForeground: editorBackground,
        overlayBackground: editorBackground
      }
    ));
    widget.render(parent);
    widget.setInputVisible(true);
    widget.setVisible(true);
    const list = widget.transcriptDomNode;
    let pendingModels = [];
    let layingOut = false;
    let lastPendingHeight;
    let lastPendingWidth;
    let confirmationWidgetLayoutHeight = 0;
    let displayedResource;
    const layout = () => {
      if (layingOut || !panel.classList.contains("shown")) {
        return;
      }
      layingOut = true;
      try {
        for (const row of getDescendantElements(list, "monaco-list-row")) {
          const confirmations = getDescendantElements(row, "chat-confirmation-widget-container");
          const hasConfirmation = confirmations.length > 0;
          row.classList.toggle("chat-input-window-confirmation-row", hasConfirmation);
          for (const confirmation of confirmations) {
            confirmation.classList.toggle(
              "chat-input-window-modified-files-confirmation",
              getDescendantElements(confirmation, "chat-modified-files-confirmation").length > 0
            );
          }
          for (const value of getDescendantElements(row, "value")) {
            value.classList.toggle("chat-input-window-confirmation-value", hasConfirmation);
          }
        }
        panel.classList.toggle("tool-approval-fallback", !!displayedApproval && !panel.classList.contains("question"));
        const width = Math.max(0, panel.clientWidth);
        if (lastPendingHeight === void 0 || lastPendingWidth !== width) {
          if (lastPendingWidth !== width) {
            confirmationWidgetLayoutHeight = 0;
          }
          lastPendingWidth = width;
          widget.layout(lastPendingHeight ?? CHAT_INPUT_WINDOW_MAX_PENDING_HEIGHT, width);
        }
        const listBounds = list.getBoundingClientRect();
        const renderedRows = getDescendantElements(list, "interactive-item-container");
        const renderedContentHeight = renderedRows.reduce((height2, row) => {
          const rowBounds = row.getBoundingClientRect();
          const confirmation = getDescendantElements(row, "chat-confirmation-widget-container")[0];
          const confirmationBounds = confirmation?.getBoundingClientRect();
          const paddingBottom = parseFloat(dom.getWindow(row).getComputedStyle(row).paddingBottom);
          const renderedDescendantBottom = confirmation ? getDescendantElements(confirmation).reduce(
            (bottom2, element) => Math.max(bottom2, element.getBoundingClientRect().bottom),
            confirmationBounds?.bottom ?? 0
          ) : 0;
          const confirmationBottom = confirmationBounds ? Math.max(confirmationBounds.top + (confirmation?.scrollHeight ?? 0), renderedDescendantBottom) : 0;
          const bottom = Math.max(rowBounds.bottom, confirmationBottom + paddingBottom);
          return Math.max(height2, bottom - listBounds.top);
        }, 0);
        const isQuestion = panel.classList.contains("question");
        const questionContainer = isQuestion ? getDescendantElements(parent, "chat-question-carousel-widget-container").find((element) => element.childElementCount > 0) : void 0;
        const questionContentHeight = questionContainer ? questionContainer.getBoundingClientRect().bottom - parent.getBoundingClientRect().top : 0;
        const contentHeight = isQuestion ? Math.max(widget.contentHeight, questionContentHeight) : renderedContentHeight || widget.contentHeight;
        const minimumHeight = isQuestion ? 1 : CHAT_INPUT_WINDOW_MIN_CONFIRMATION_HEIGHT;
        const measuredHeight = Math.min(CHAT_INPUT_WINDOW_MAX_PENDING_HEIGHT, Math.max(minimumHeight, Math.ceil(contentHeight)));
        const height = isQuestion ? measuredHeight : Math.max(lastPendingHeight ?? 0, measuredHeight);
        const heightChanged = height !== lastPendingHeight;
        if (heightChanged) {
          lastPendingHeight = height;
          parent.style.height = `${height}px`;
          this._fitWindowToContent();
        }
        if (isQuestion && heightChanged) {
          widget.layout(height, width);
        } else if (!panel.classList.contains("question") && height > confirmationWidgetLayoutHeight) {
          confirmationWidgetLayoutHeight = height;
          widget.layout(height, width);
          scheduleLayout();
        }
      } finally {
        layingOut = false;
      }
    };
    const scheduledLayout = this._windowDisposables.add(new MutableDisposable());
    const scheduleLayout = () => {
      scheduledLayout.value = dom.scheduleAtNextAnimationFrame(auxiliaryWindow.window, layout);
    };
    const showPendingModel = (index) => {
      if (pendingModels.length === 0) {
        this._pendingPromptIndex = 0;
        lastPendingHeight = void 0;
        lastPendingWidth = void 0;
        confirmationWidgetLayoutHeight = 0;
        displayedResource = void 0;
        displayedApproval = void 0;
        renderApprovalFallback(void 0);
        lastActivatedApproval = void 0;
        this._activePendingSessionResource = void 0;
        this._voiceConfirmationPending.set(false, void 0);
        panel.classList.remove("shown", "question", "tool-approval-fallback");
        widget.setModel(void 0);
        this._fitWindowToContent();
        return;
      }
      this._pendingPromptIndex = (index + pendingModels.length) % pendingModels.length;
      const model = pendingModels[this._pendingPromptIndex];
      this._activePendingSessionResource = model.sessionResource;
      const resource = model.sessionResource.toString();
      if (displayedResource !== resource) {
        displayedResource = resource;
        lastPendingHeight = void 0;
        confirmationWidgetLayoutHeight = 0;
      }
      this._voiceConfirmationPending.set(true, void 0);
      panel.classList.add("shown");
      const hasPendingQuestion = this._hasPendingQuestion(model);
      const pendingApproval = this._getPendingToolApproval(model);
      displayedApproval = pendingApproval;
      renderApprovalFallback(pendingApproval);
      const omniVoiceActive = this.voiceSessionController.omniInputActive.get();
      if (!omniVoiceActive) {
        lastActivatedApproval = void 0;
      }
      panel.classList.toggle("question", hasPendingQuestion);
      panel.classList.toggle("tool-approval-fallback", !hasPendingQuestion && !!pendingApproval);
      const hasMultiple = pendingModels.length > 1;
      const title = model.title || localize("chatInputWindow.pending.untitledSource", "Chat");
      label.textContent = hasMultiple ? localize(
        "chatInputWindow.pending.sourceAndCount",
        "{0} \u2014 {1} of {2} waiting on you",
        title,
        this._pendingPromptIndex + 1,
        pendingModels.length
      ) : localize("chatInputWindow.pending.source", "{0} waiting on you", title);
      navigation.classList.toggle("hidden", !hasMultiple);
      for (const button of [previous, next]) {
        button.classList.toggle("disabled", !hasMultiple);
        button.setAttribute("aria-disabled", String(!hasMultiple));
        button.tabIndex = hasMultiple ? 0 : -1;
      }
      widget.setModel(model);
      if (pendingApproval && omniVoiceActive && pendingApproval.occurrence !== lastActivatedApproval) {
        lastActivatedApproval = pendingApproval.occurrence;
        this.voiceSessionController.activateSession(model.sessionResource);
      }
      scheduleLayout();
    };
    this._windowDisposables.add(dom.addDisposableListener(previous, dom.EventType.CLICK, () => showPendingModel(this._pendingPromptIndex - 1)));
    this._windowDisposables.add(dom.addDisposableListener(next, dom.EventType.CLICK, () => showPendingModel(this._pendingPromptIndex + 1)));
    this._windowDisposables.add(widget.onDidChangeContentHeight(scheduleLayout));
    const pendingMutationObserver = new auxiliaryWindow.window.MutationObserver(scheduleLayout);
    pendingMutationObserver.observe(widget.domNode, { childList: true, subtree: true, attributes: true });
    this._windowDisposables.add(toDisposable(() => pendingMutationObserver.disconnect()));
    this._windowDisposables.add(dom.addDisposableListener(auxiliaryWindow.window, "resize", scheduleLayout));
    this._loadPendingSessionModels();
    this._windowDisposables.add(autorun((reader) => {
      this.voiceSessionController.omniInputActive.read(reader);
      const currentResource = pendingModels[this._pendingPromptIndex]?.sessionResource.toString();
      const activeTarget = this.voiceSessionController.targetSession.read(reader)?.toString();
      pendingModels = [...this.chatService.chatModels.read(reader)].filter((model) => !!model.requestNeedsInput.read(reader) && !this._hasOnlyResolvedPendingTools(model, reader)).sort((a, b) => Number(b.sessionResource.toString() === activeTarget) - Number(a.sessionResource.toString() === activeTarget) || Number(this._hasPendingQuestion(b)) - Number(this._hasPendingQuestion(a)) || b.lastMessageDate - a.lastMessageDate);
      const preservedIndex = currentResource ? pendingModels.findIndex((model) => model.sessionResource.toString() === currentResource) : -1;
      showPendingModel(preservedIndex >= 0 ? preservedIndex : Math.min(this._pendingPromptIndex, pendingModels.length - 1));
    }));
  }
  _loadPendingSessionModels() {
    const refs = this._windowDisposables.add(new DisposableMap());
    const loads = /* @__PURE__ */ new Set();
    const cts = new CancellationTokenSource();
    this._windowDisposables.add(toDisposable(() => cts.dispose(true)));
    const update = async () => {
      const pendingSessions = this.agentSessionsService.model.sessions.filter((session) => !session.isArchived() && session.status === AgentSessionStatus.NeedsInput);
      const pendingKeys = new Set(pendingSessions.map((session) => session.resource.toString()));
      for (const key of refs.keys()) {
        if (!pendingKeys.has(key)) {
          refs.deleteAndDispose(key);
        }
      }
      await Promise.all(pendingSessions.map(async (session) => {
        const key = session.resource.toString();
        if (this.chatService.getSession(session.resource) || refs.has(key) || loads.has(key)) {
          return;
        }
        loads.add(key);
        try {
          const ref = await this.chatService.acquireOrLoadSession(session.resource, ChatAgentLocation.Chat, cts.token, "ChatInputWindow-pending");
          if (!ref) {
            return;
          }
          if (cts.token.isCancellationRequested || !this.agentSessionsService.model.sessions.some((candidate) => candidate.resource.toString() === key && candidate.status === AgentSessionStatus.NeedsInput && !candidate.isArchived())) {
            ref.dispose();
            return;
          }
          refs.set(key, ref);
        } catch (error) {
          if (!cts.token.isCancellationRequested) {
            this.logService.warn(`[chatInputWindow] Failed to load pending session ${key}:`, error);
          }
        } finally {
          loads.delete(key);
        }
      }));
    };
    this._windowDisposables.add(this.agentSessionsService.model.onDidChangeSessions(() => void update()));
    void update();
  }
  _appendPendingNavigationButton(container, icon, ariaLabel) {
    const button = dom.append(container, dom.$("a.chat-input-window-pending-navigation-button", {
      role: "button",
      tabindex: "0",
      "aria-label": ariaLabel
    }));
    button.appendChild(renderIcon(icon));
    this._windowDisposables.add(dom.addStandardDisposableListener(button, dom.EventType.KEY_DOWN, (event) => {
      if (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space)) {
        event.preventDefault();
        button.click();
      }
    }));
    return button;
  }
  _hasPendingQuestion(model) {
    return model.lastRequest?.response?.response.value.some((part) => part.kind === "questionCarousel" && !part.isUsed) ?? false;
  }
  _hasOnlyResolvedPendingTools(model, reader) {
    const request = model.lastRequest;
    const parts = request?.response?.response.value;
    if (!request || !parts) {
      return false;
    }
    let sawResolvedTool = false;
    for (const part of parts) {
      if (part.kind === "questionCarousel" && !part.isUsed && !part.answeredExternally) {
        return false;
      }
      if (part.kind === "elicitation2" && part.state.get() === "pending") {
        return false;
      }
      if ((part.kind === "planReview" || part.kind === "confirmation") && !part.isUsed) {
        return false;
      }
      if (part.kind !== "toolInvocation") {
        continue;
      }
      const state = part.state.get();
      if (state.type !== IChatToolInvocation.StateKind.WaitingForConfirmation && state.type !== IChatToolInvocation.StateKind.WaitingForPostApproval && state.type !== IChatToolInvocation.StateKind.WaitingForAuthentication) {
        continue;
      }
      const occurrence = derivePendingId(request.id, part, this._windowDisposables);
      if (!isPendingIdResolved(occurrence, reader)) {
        return false;
      }
      sawResolvedTool = true;
    }
    return sawResolvedTool;
  }
  _getPendingToolApproval(model) {
    const request = model.lastRequest;
    const parts = request?.response?.response.value;
    if (!request || !parts) {
      return void 0;
    }
    for (const part of parts) {
      if (part.kind !== "toolInvocation") {
        continue;
      }
      const state = part.state.get();
      if (state.type !== IChatToolInvocation.StateKind.WaitingForConfirmation && state.type !== IChatToolInvocation.StateKind.WaitingForPostApproval && state.type !== IChatToolInvocation.StateKind.WaitingForAuthentication) {
        continue;
      }
      const occurrence = derivePendingId(request.id, part, this._windowDisposables);
      if (!isPendingIdResolved(occurrence)) {
        return { invocation: part, occurrence };
      }
    }
    return void 0;
  }
  _setModelPickerVisible(auxiliaryWindow, visible) {
    if (!visible) {
      if (this._actionWidgetOwner !== auxiliaryWindow) {
        return Promise.resolve();
      }
      this._actionWidgetVisibilityCount = Math.max(0, this._actionWidgetVisibilityCount - 1);
      if (this._actionWidgetVisibilityCount === 0) {
        this._actionWidgetLayoutGeneration++;
        this._actionWidgetOwner = void 0;
        this._actionWidgetWindow.clear();
      }
      return Promise.resolve();
    }
    if (this._actionWidgetOwner !== auxiliaryWindow) {
      this._actionWidgetLayoutGeneration++;
      this._actionWidgetVisibilityCount = 0;
      this._actionWidgetOwner = auxiliaryWindow;
      this._actionWidgetWindow.clear();
      this._actionWidgetOpenOperation = void 0;
    }
    this._actionWidgetVisibilityCount++;
    if (this._actionWidgetWindow.value) {
      return Promise.resolve();
    }
    if (this._actionWidgetOpenOperation) {
      return this._actionWidgetOpenOperation;
    }
    const generation = ++this._actionWidgetLayoutGeneration;
    const operation = this._openModelPickerWindow(auxiliaryWindow, generation);
    this._actionWidgetOpenOperation = operation;
    return operation.finally(() => {
      if (this._actionWidgetOpenOperation === operation) {
        this._actionWidgetOpenOperation = void 0;
      }
    });
  }
  async _openModelPickerWindow(auxiliaryWindow, generation) {
    const sourceWindow = auxiliaryWindow.window;
    const screen = sourceWindow.screen;
    const display = (await this.hostService.getCursorScreenPoint())?.display ?? {
      x: sourceWindow.screenX,
      y: sourceWindow.screenY,
      width: screen.availWidth,
      height: screen.availHeight
    };
    const height = Math.min(CHAT_INPUT_WINDOW_MODEL_PICKER_HEIGHT, display.height);
    const sourceBottom = sourceWindow.screenY + sourceWindow.outerHeight;
    const displayBottom = display.y + display.height;
    const displayRight = display.x + display.width;
    const placeBelow = sourceBottom + height <= displayBottom;
    const preferredY = placeBelow ? sourceBottom : sourceWindow.screenY - height;
    const y = Math.min(Math.max(display.y, preferredY), displayBottom - height);
    const width = Math.min(sourceWindow.outerWidth, display.width);
    const x = Math.min(Math.max(display.x, sourceWindow.screenX), displayRight - width);
    const actionWidgetWindow = await this.auxiliaryWindowService.open({
      bounds: { x, y, width, height },
      alwaysOnTop: true,
      frameless: true,
      transparent: true,
      notResizable: true,
      disableFullscreen: true,
      nativeTitlebar: false,
      noBackgroundThrottling: true,
      backgroundColor: "#00000000"
    });
    await actionWidgetWindow.whenStylesHaveLoaded;
    if (generation !== this._actionWidgetLayoutGeneration || this._window !== auxiliaryWindow) {
      actionWidgetWindow.dispose();
      return;
    }
    actionWidgetWindow.window.document.body.style.setProperty("background-color", "transparent", "important");
    actionWidgetWindow.window.document.body.style.setProperty("margin", "0", "important");
    actionWidgetWindow.container.style.backgroundColor = "transparent";
    actionWidgetWindow.container.style.overflow = "hidden";
    this._actionWidgetWindowAnchorY = placeBelow ? 0 : height;
    this._actionWidgetWindow.value = actionWidgetWindow;
  }
  _getModelPickerAnchor(anchor) {
    const bounds = anchor.getBoundingClientRect();
    return {
      x: bounds.left,
      y: this._actionWidgetWindowAnchorY,
      width: bounds.width,
      height: 1
    };
  }
  _disposeWidget() {
    this.voiceSessionController.setOmniInputOpen(false);
    this.voiceSessionController.setOmniInputActive(false);
    this._routingController = void 0;
    this._widget = void 0;
    this._fitWindowToContent = () => {
    };
    this._row = void 0;
    this._lead = void 0;
    this._trail = void 0;
    this._activePendingSessionResource = void 0;
    this._voiceConfirmationPending.set(false, void 0);
    this._actionWidgetVisibilityCount = 0;
    this._actionWidgetOwner = void 0;
    this._actionWidgetOpenOperation = void 0;
    this._actionWidgetWindow.clear();
    this._actionWidgetLayoutGeneration++;
    this._modelRef?.dispose();
    this._modelRef = void 0;
  }
  _defaultBounds() {
    const width = this._defaultWidth();
    return this._positionedBounds(width, CHAT_INPUT_WINDOW_DEFAULT_HEIGHT);
  }
  _positionedBounds(width, height) {
    const invoking = this._invokingWindowBounds;
    const stored = this.storageService.getObject(
      ChatInputWindowStorageKeys.WindowPosition,
      StorageScope.WORKSPACE
    );
    const centeredX = invoking.x + (invoking.width - width) / 2;
    const centeredY = invoking.y + (invoking.height - height) / 2;
    const maxX = invoking.x + Math.max(0, invoking.width - width);
    const maxY = invoking.y + Math.max(0, invoking.height - height);
    const hasStoredPosition = stored && Number.isFinite(stored.offsetX) && Number.isFinite(stored.offsetY);
    const desiredX = hasStoredPosition ? invoking.x + stored.offsetX : centeredX;
    const desiredY = hasStoredPosition ? invoking.y + stored.offsetY : centeredY;
    return {
      x: Math.round(Math.min(Math.max(desiredX, invoking.x), maxX)),
      y: Math.round(Math.min(Math.max(desiredY, invoking.y), maxY)),
      width,
      height
    };
  }
  _storeWindowPosition(auxiliaryWindow) {
    const bounds = auxiliaryWindow.createState().bounds;
    if (bounds?.x === void 0 || bounds.y === void 0) {
      return;
    }
    this.storageService.store(
      ChatInputWindowStorageKeys.WindowPosition,
      JSON.stringify({
        offsetX: bounds.x - this._invokingWindowBounds.x,
        offsetY: bounds.y - this._invokingWindowBounds.y
      }),
      StorageScope.WORKSPACE,
      StorageTarget.MACHINE
    );
  }
  _defaultWidth() {
    const invokingWindowWidth = this._invokingWindowBounds.width > 0 ? this._invokingWindowBounds.width : mainWindow.outerWidth;
    const availableWidth = invokingWindowWidth > 0 ? invokingWindowWidth : CHAT_INPUT_WINDOW_MAX_WIDTH / 0.62;
    return Math.round(Math.min(availableWidth * 0.62, CHAT_INPUT_WINDOW_MAX_WIDTH));
  }
  _windowBounds(window) {
    return {
      x: window.screenX,
      y: window.screenY,
      width: window.outerWidth,
      height: window.outerHeight
    };
  }
  _isUsableWindowBounds(bounds) {
    return !!bounds && Number.isFinite(bounds.x) && Number.isFinite(bounds.y) && Number.isFinite(bounds.width) && Number.isFinite(bounds.height) && bounds.width > 0 && bounds.height > 0;
  }
  _isEnabled() {
    return this.configurationService.getValue(OmniChatEnabledSettingId) === true && !this.chatEntitlementService.sentiment.hidden;
  }
};
ChatInputWindowService = __decorateClass([
  __decorateParam(0, IAuxiliaryWindowService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IWorkspaceContextService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IChatService),
  __decorateParam(7, ICommandService),
  __decorateParam(8, IAgentSessionsService),
  __decorateParam(9, ILogService),
  __decorateParam(10, IVoiceSessionController),
  __decorateParam(11, IMicCaptureService),
  __decorateParam(12, ITtsPlaybackService),
  __decorateParam(13, IAccessibilityService),
  __decorateParam(14, IConfigurationService),
  __decorateParam(15, IKeybindingService),
  __decorateParam(16, IChatEntitlementService),
  __decorateParam(17, IHostService)
], ChatInputWindowService);
registerSingleton(IChatInputWindowService, ChatInputWindowService, InstantiationType.Delayed);
export {
  ChatInputWindowService
};
