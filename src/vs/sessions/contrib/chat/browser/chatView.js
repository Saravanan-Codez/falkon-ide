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
import "./media/chatView.css";
import "./media/voiceChatView.css";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { MutableDisposable } from "../../../../base/common/lifecycle.js";
import { autorun, derived, observableValue } from "../../../../base/common/observable.js";
import { isEqual } from "../../../../base/common/resources.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IMicCaptureService } from "../../../../workbench/contrib/chat/browser/voiceClient/micCaptureService.js";
import { ITtsPlaybackService } from "../../../../workbench/contrib/chat/browser/voiceClient/ttsPlaybackService.js";
import { IVoiceSessionController } from "../../../../workbench/contrib/chat/browser/voiceClient/voiceSessionController.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { EDITOR_DRAG_AND_DROP_BACKGROUND } from "../../../../workbench/common/theme.js";
import { ChatWidget } from "../../../../workbench/contrib/chat/browser/widget/chatWidget.js";
import { setModelPreservingInputTypedWhileLoading } from "../../../../workbench/contrib/chat/browser/chat.js";
import { IChatService } from "../../../../workbench/contrib/chat/common/chatService/chatService.js";
import { ChatAgentLocation, ChatModeKind } from "../../../../workbench/contrib/chat/common/constants.js";
import { getChatSessionType } from "../../../../workbench/contrib/chat/common/model/chatUri.js";
import { IChatSessionsService, localChatSessionType } from "../../../../workbench/contrib/chat/common/chatSessionsService.js";
import { AbstractChatView } from "../../../browser/parts/chatView.js";
import { ChatInteractivity } from "../../../services/sessions/common/session.js";
import { NewChatWidget } from "./newChatWidget.js";
import { NewChatInSessionWidget } from "./newChatInSessionWidget.js";
import { SessionInputBanners } from "../../sessionInputBanners/browser/sessionInputBanners.js";
import { SessionChatInputToolbar } from "./sessionChatInputToolbar.js";
import { ResponseSelectionSideChatController } from "./responseSelectionSideChatController.js";
import { ISessionChatPillsDebugService } from "./sessionChatInputToolbarDebug.js";
import { AGENT_SESSIONS_SCOPED_INPUT_HISTORY_SETTING } from "./sessionsChatHistory.js";
import { activeSessionViewBackground, activeSessionViewForeground, agentsPanelBackground, inactiveSessionViewBackground, inactiveSessionViewForeground } from "../../../common/theme.js";
import { setupVoiceInputDecorations } from "./voiceInputDecorations.js";
import { INewChatVoiceTargetService } from "./newChatVoice.js";
import { ISessionsChatViewStateService } from "./chatViewStateService.js";
let NewChatView = class extends AbstractChatView {
  static {
    this.TYPE = "sessions.newSession";
  }
  constructor(isNewChatInSession, options, instantiationService) {
    super();
    this.element.classList.add("chat-view-new");
    this.kind = isNewChatInSession ? "newChatInSession" : "newSession";
    this._widget = this._register(isNewChatInSession ? instantiationService.createInstance(NewChatInSessionWidget, options) : instantiationService.createInstance(NewChatWidget, options));
    this._widget.render(this.element);
  }
  toJSON() {
    return { type: NewChatView.TYPE };
  }
  doLayout(width, height, _top, _left) {
    this._widget.layout(height, width);
  }
  focus() {
    this._widget.focusInput();
  }
  selectWorkspace(folderUri, providerId) {
    if (this._widget instanceof NewChatWidget) {
      this._widget.selectWorkspace(folderUri, providerId);
    }
  }
  prefillInput(text) {
    if (this._widget instanceof NewChatWidget) {
      this._widget.prefillInput(text);
    }
  }
  sendQuery(text) {
    if (this._widget instanceof NewChatWidget) {
      this._widget.sendQuery(text);
    }
  }
  submitInput() {
    return this._widget instanceof NewChatWidget ? this._widget.submitInput() : Promise.resolve(false);
  }
  attach(uris) {
    this._widget.attach(uris);
  }
  setVisible(visible) {
    if (this._widget instanceof NewChatWidget) {
      this._widget.setHostVisible(visible);
    }
  }
};
NewChatView = __decorateClass([
  __decorateParam(2, IInstantiationService)
], NewChatView);
let ChatView = class extends AbstractChatView {
  constructor(instantiationService, contextKeyService, chatService, chatSessionsService, configurationService, logService, keybindingService, themeService, accessibilityService, voiceSessionController, micCaptureService, ttsPlaybackService, chatPillsDebugService, newChatVoiceTargetService, viewStateService) {
    super();
    this.chatService = chatService;
    this.chatSessionsService = chatSessionsService;
    this.configurationService = configurationService;
    this.logService = logService;
    this.keybindingService = keybindingService;
    this.themeService = themeService;
    this.accessibilityService = accessibilityService;
    this.voiceSessionController = voiceSessionController;
    this.micCaptureService = micCaptureService;
    this.ttsPlaybackService = ttsPlaybackService;
    this.chatPillsDebugService = chatPillsDebugService;
    this.newChatVoiceTargetService = newChatVoiceTargetService;
    this.viewStateService = viewStateService;
    this.kind = "chat";
    /** Reference to the loaded chat model; disposing releases the model. */
    this._modelRef = this._register(new MutableDisposable());
    /** Cancels any in-flight model load when a new session is set or the view disposes. */
    this._loadCts = this._register(new MutableDisposable());
    /** Tracks the current chat's interactivity and hides the input for read-only chats. */
    this._interactiveDisposable = this._register(new MutableDisposable());
    this._currentChatResourceObs = observableValue(this, void 0);
    /** Whether this view currently represents the active session. */
    this._isActive = true;
    /** Observable mirror of {@link _isActive} so the voice overlay can react. */
    this._isActiveObs = observableValue(this, true);
    this.element.classList.add("chat-view-chat");
    const scopedContextKeyService = this._register(contextKeyService.createScoped(this.element));
    const scopedInstantiationService = this._register(instantiationService.createChild(
      new ServiceCollection([IContextKeyService, scopedContextKeyService])
    ));
    this._voiceInitiatedHereKey = scopedContextKeyService.createKey("agentsVoiceInitiatedHere", false);
    this._widget = this._register(scopedInstantiationService.createInstance(
      ChatWidget,
      ChatAgentLocation.Chat,
      void 0,
      {
        autoScroll: (mode) => mode !== ChatModeKind.Ask,
        renderFollowups: true,
        supportsFileReferences: true,
        rendererOptions: {
          referencesExpandedWhenEmptyResponse: false,
          progressMessageAtBottomOfResponse: (mode) => mode !== ChatModeKind.Ask
        },
        enableImplicitContext: true,
        enableWorkingSet: "implicit",
        supportsChangingModes: true,
        inputEditorMinLines: 2,
        isSessionsWindow: true
      },
      this._buildStyles(this._isActive)
    ));
    this._widget.render(this.element);
    this._selectionSideChatController = this._register(scopedInstantiationService.createInstance(ResponseSelectionSideChatController, this._widget));
    this._banners = this._register(instantiationService.createInstance(SessionInputBanners));
    this._banners.setActive(this._isActive);
    this._chatPills = this._register(instantiationService.createInstance(SessionChatInputToolbar));
    this._register(chatPillsDebugService.register(this._chatPills, this._banners, this._isActiveObs));
    this._ensureBannersMounted();
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(AGENT_SESSIONS_SCOPED_INPUT_HISTORY_SETTING)) {
        this._applyHistoryKey();
      }
    }));
    this._setupVoiceOverlay();
    this._register(autorun((reader) => {
      const active = this._isActiveObs.read(reader);
      const voiceActive = this.voiceSessionController.isConnected.read(reader) || this.voiceSessionController.isConnecting.read(reader);
      const target = this.voiceSessionController.targetSession.read(reader);
      const hasDraftTarget = this.voiceSessionController.hasDraftTarget.read(reader);
      const current = this._currentChatResourceObs.read(reader);
      const ownsVoice = !hasDraftTarget && (!target || !!current && isEqual(target, current));
      this._voiceInitiatedHereKey.set(active && voiceActive && ownsVoice);
    }));
  }
  static {
    this.TYPE = "sessions.session";
  }
  dispose() {
    this._saveCurrentViewState();
    this._loadCts.value?.cancel();
    super.dispose();
  }
  _buildStyles(active) {
    return {
      listForeground: active ? activeSessionViewForeground : inactiveSessionViewForeground,
      listBackground: active ? activeSessionViewBackground : inactiveSessionViewBackground,
      overlayBackground: EDITOR_DRAG_AND_DROP_BACKGROUND,
      inputEditorBackground: inactiveSessionViewBackground,
      resultEditorBackground: agentsPanelBackground
    };
  }
  /** The underlying chat widget. */
  get widget() {
    return this._widget;
  }
  setChat(chat, historyKey) {
    this.chatPillsDebugService.clear(this._chatPills);
    const resource = chat.resource;
    const previousChatResource = this._currentChatResource;
    const chatChanged = !isEqual(previousChatResource, resource);
    if (chatChanged) {
      this._saveCurrentViewState();
    }
    this._historyKey = historyKey;
    this._applyHistoryKey();
    this._chatPills.setChat(chat);
    this._selectionSideChatController.setChat(chat);
    this._banners.setDebugData(void 0);
    this._interactiveDisposable.value = autorun((reader) => {
      this._widget.setReadOnly(chat.interactivity.read(reader) !== ChatInteractivity.Full);
    });
    if (!chatChanged) {
      return;
    }
    this._currentChatResource = resource;
    this._currentChatResourceObs.set(resource, void 0);
    this._loadCts.value?.cancel();
    if (previousChatResource) {
      this._clearCurrentChat();
    }
    const cts = new CancellationTokenSource();
    this._loadCts.value = cts;
    const token = cts.token;
    const inputBeforeLoad = this._widget.getInput();
    const loadPromise = this.chatService.acquireOrLoadSession(resource, ChatAgentLocation.Chat, token, "ChatView").then((ref) => {
      if (token.isCancellationRequested || !ref || !isEqual(this._currentChatResource, resource)) {
        ref?.dispose();
        return;
      }
      this._modelRef.value = ref;
      this._updateWidgetLockState(getChatSessionType(ref.object.sessionResource));
      setModelPreservingInputTypedWhileLoading(this._widget, inputBeforeLoad, () => this._widget.setModel(ref.object));
      const widgetViewState = this.viewStateService.get(resource);
      if (widgetViewState) {
        this._widget.restoreViewState(widgetViewState);
      }
      this.element.dataset.boundChatResource = resource.toString();
    }, (err) => {
      if (!token.isCancellationRequested) {
        this.logService.error("[ChatView] Failed to load chat model for chat", err);
      }
      if (isEqual(this._currentChatResource, resource)) {
        this._currentChatResource = void 0;
        this._currentChatResourceObs.set(void 0, void 0);
      }
    });
    this.showProgressWhile(loadPromise, 800);
  }
  _saveCurrentViewState() {
    const resource = this._widget.viewModel?.sessionResource;
    if (resource) {
      this.viewStateService.set(resource, this._widget.getViewState());
    }
  }
  _clearCurrentChat() {
    this._widget.clear().catch((err) => this.logService.error("[ChatView] Failed to clear chat widget", err));
    this._widget.setModel(void 0);
    this._modelRef.clear();
    delete this.element.dataset.boundChatResource;
  }
  _applyHistoryKey() {
    const scopedHistory = this.configurationService.getValue(AGENT_SESSIONS_SCOPED_INPUT_HISTORY_SETTING) !== false;
    this._widget.inputPart.setHistoryKey(scopedHistory ? this._historyKey : void 0);
  }
  _updateWidgetLockState(sessionType) {
    if (sessionType === localChatSessionType) {
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
  toJSON() {
    return { type: ChatView.TYPE };
  }
  doLayout(width, height, _top, _left) {
    this._ensureBannersMounted();
    this._widget.layout(height, width);
  }
  /**
   * Mounts the status pills and session banners above the chat input.
   */
  _ensureBannersMounted() {
    const inputPartElement = this._widget.inputPart.element;
    const persistentContentContainer = this._widget.inputPart.persistentContentContainerElement;
    const pillsNode = this._chatPills.element;
    const bannersNode = this._banners.domNode;
    if (persistentContentContainer.firstChild !== pillsNode) {
      persistentContentContainer.insertBefore(pillsNode, persistentContentContainer.firstChild);
    }
    if (persistentContentContainer.nextSibling !== bannersNode) {
      inputPartElement.insertBefore(bannersNode, persistentContentContainer.nextSibling);
    }
  }
  //#region Voice overlay
  /**
   * Sets up this view's transcript overlay and input glow, mirroring `ChatViewPane`.
   * Shows only while voice is connected and targeting this active session.
   */
  _setupVoiceOverlay() {
    const inputContainerEl = this._widget.inputPart.inputContainerElement;
    if (!inputContainerEl) {
      return;
    }
    const confirmationPending = derived(this, (reader) => {
      const current = this._currentChatResourceObs.read(reader);
      return !!current && this.voiceSessionController.pendingToolConfirmations.read(reader).some((confirmation) => isEqual(confirmation.sessionResource, current));
    });
    this._register(setupVoiceInputDecorations({
      voiceSessionController: this.voiceSessionController,
      ttsPlaybackService: this.ttsPlaybackService,
      micCaptureService: this.micCaptureService,
      configurationService: this.configurationService,
      keybindingService: this.keybindingService,
      themeService: this.themeService,
      accessibilityService: this.accessibilityService
    }, {
      inputContainer: inputContainerEl,
      isActive: this._isActiveObs,
      confirmationPending,
      getCurrentResource: () => this._currentChatResource,
      currentVoiceInputResource: this.newChatVoiceTargetService.currentVoiceInputResource
    }));
  }
  //#endregion
  focus() {
    this._widget.focusInput();
  }
  attach(uris) {
    for (const uri of uris) {
      this._widget.attachmentModel.addFile(uri).catch((err) => this.logService.error("[ChatView] Failed to attach file as context", err));
    }
  }
  setActive(active) {
    if (this._isActive === active) {
      return;
    }
    this._isActive = active;
    this._isActiveObs.set(active, void 0);
    this._banners.setActive(active);
    this._widget.setStyles(this._buildStyles(active));
  }
  setVisible(visible) {
    if (this._isVisible === visible) {
      return;
    }
    this._isVisible = visible;
    this._widget.setVisible(visible);
  }
};
ChatView = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IChatService),
  __decorateParam(3, IChatSessionsService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, ILogService),
  __decorateParam(6, IKeybindingService),
  __decorateParam(7, IThemeService),
  __decorateParam(8, IAccessibilityService),
  __decorateParam(9, IVoiceSessionController),
  __decorateParam(10, IMicCaptureService),
  __decorateParam(11, ITtsPlaybackService),
  __decorateParam(12, ISessionChatPillsDebugService),
  __decorateParam(13, INewChatVoiceTargetService),
  __decorateParam(14, ISessionsChatViewStateService)
], ChatView);
let ChatViewFactory = class {
  constructor(instantiationService) {
    this.instantiationService = instantiationService;
  }
  createNewChatView(isNewChatInSession, options) {
    return this.instantiationService.createInstance(NewChatView, isNewChatInSession, options);
  }
  createChatView() {
    return this.instantiationService.createInstance(ChatView);
  }
};
ChatViewFactory = __decorateClass([
  __decorateParam(0, IInstantiationService)
], ChatViewFactory);
export {
  ChatView,
  ChatViewFactory,
  NewChatView
};
