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
import "./media/chatWidget.css";
import * as dom from "../../../../base/browser/dom.js";
import { StandardMouseEvent } from "../../../../base/browser/mouseEvent.js";
import { Action } from "../../../../base/common/actions.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Event } from "../../../../base/common/event.js";
import { Disposable, DisposableMap, DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { constObservable, derived, derivedObservableWithCache, autorun, observableSignalFromEvent } from "../../../../base/common/observable.js";
import { isWeb } from "../../../../base/common/platform.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IDefaultAccountService } from "../../../../platform/defaultAccount/common/defaultAccount.js";
import { localize } from "../../../../nls.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { SessionTypeAuthRequirement } from "../../../services/sessions/common/session.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { isAllowSignedOutWhenUsableEnabled } from "../../../browser/sessionsAuthGate.js";
import { IAquariumService } from "../../aquarium/browser/aquariumOverlay.js";
import { WorkspacePicker } from "./sessionWorkspacePicker.js";
import { WebWorkspacePicker } from "./webWorkspacePicker.js";
import { NewChatInputWidget } from "./newChatInput.js";
import { NoAgentHostEmptyState } from "./noAgentHostEmptyState.js";
import { IAgentHostFilterService } from "../../../services/agentHostFilter/common/agentHostFilter.js";
import { SessionWorkspacePickerVisibleContext } from "../../../common/contextkeys.js";
import { AGENT_FEEDBACK_NEW_SESSION_RESOURCE, AgentFeedbackState, IAgentFeedbackService } from "../../agentFeedback/browser/agentFeedbackService.js";
import { buildNewSessionPrompt } from "../../agentFeedback/browser/agentFeedbackAttachmentEntry.js";
import { SessionInputBannerWidget } from "../../sessionInputBanners/browser/sessionInputBannerWidget.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { ChatTipContentPart } from "../../../../workbench/contrib/chat/browser/widget/chatContentParts/chatTipContentPart.js";
import { ChatContentMarkdownRenderer } from "../../../../workbench/contrib/chat/browser/widget/chatContentMarkdownRenderer.js";
import { IChatPetService } from "../../../../workbench/contrib/chat/browser/chatPetService.js";
import { IChatTipService } from "../../../../workbench/contrib/chat/browser/chatTipService.js";
import { ChatContextKeys } from "../../../../workbench/contrib/chat/common/actions/chatContextKeys.js";
import { ChatModeKind } from "../../../../workbench/contrib/chat/common/constants.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IStorageService, StorageScope } from "../../../../platform/storage/common/storage.js";
import { TOTAL_SESSIONS_KEY } from "../../sessions/browser/sessionsLifecycleTracker.js";
import { INewSessionComposerService } from "./newSessionComposerService.js";
const MIN_SESSIONS_FOR_TIPS = 2;
let NewChatWidget = class extends Disposable {
  constructor(options, instantiationService, contextKeyService, contextMenuService, configurationService, logService, sessionsManagementService, sessionsService, aquariumService, agentHostFilterService, uriIdentityService, agentFeedbackService, chatPetService, chatTipService, openerService, defaultAccountService, storageService, newSessionComposerService) {
    super();
    this.options = options;
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.contextMenuService = contextMenuService;
    this.configurationService = configurationService;
    this.logService = logService;
    this.sessionsManagementService = sessionsManagementService;
    this.sessionsService = sessionsService;
    this.aquariumService = aquariumService;
    this.agentHostFilterService = agentHostFilterService;
    this.uriIdentityService = uriIdentityService;
    this.agentFeedbackService = agentFeedbackService;
    this.chatPetService = chatPetService;
    this.chatTipService = chatTipService;
    this.openerService = openerService;
    this.defaultAccountService = defaultAccountService;
    this.storageService = storageService;
    this._chatTipPart = this._register(new MutableDisposable());
    this._isChatTipSessionInitialized = false;
    this._isInputOnboardingVisible = false;
    this._isInputNotificationVisible = false;
    /** Recreates the draft once a better/late-registering provider can serve the folder (see {@link _createNewSession}). */
    this._pendingPreferredUpgrade = new MutableDisposable();
    this._newSessionCreation = new MutableDisposable();
    /** In-flight background sends awaiting confirmation before their comments are cleared. */
    this._pendingBackgroundSends = this._register(new DisposableMap());
    this._workspacePickerVisibleKey = SessionWorkspacePickerVisibleContext.bindTo(contextKeyService);
    this._register(toDisposable(() => this._workspacePickerVisibleKey.reset()));
    this._renderHarnessPickerInControls = this.options.renderSessionTypePickerInControls.get();
    const PickerCtor = isWeb ? WebWorkspacePicker : WorkspacePicker;
    this._workspacePicker = this._register(this.instantiationService.createInstance(PickerCtor, {}));
    this._register(this._pendingPreferredUpgrade);
    this._register(this._newSessionCreation);
    this._session = derivedObservableWithCache(this, (reader, prev) => {
      const activeSession = this.sessionsService.activeSession.read(reader);
      if (activeSession && activeSession.isCreated.read(reader)) {
        return prev;
      }
      return activeSession;
    });
    this._isQuickChatComposer = derived(this, (reader) => {
      const session = this._session.read(reader);
      return session?.isQuickChat?.read(reader) ?? false;
    });
    const feedbackChanged = observableSignalFromEvent(this, this.agentFeedbackService.onDidChangeFeedback);
    this._feedbackItems = derived(this, (reader) => {
      feedbackChanged.read(reader);
      return this.agentFeedbackService.getFeedback(AGENT_FEEDBACK_NEW_SESSION_RESOURCE).filter((item) => item.state === AgentFeedbackState.Accepted);
    });
    const canSendRequest = derived((reader) => {
      const session = this._session.read(reader);
      if (!session) {
        return false;
      }
      if (session.loading.read(reader)) {
        return false;
      }
      return true;
    });
    const loading = derived((reader) => {
      const session = this._session.read(reader);
      return session?.loading.read(reader) ?? false;
    });
    const hasFeedback = derived(this, (reader) => this._feedbackItems.read(reader).length > 0);
    const canSubmitWithoutSession = derived(this, (reader) => !this._session.read(reader) && hasFeedback.read(reader));
    const newChatInput = this.instantiationService.createInstance(NewChatInputWidget, {
      session: this._session,
      getContextFolderUri: () => this._getContextFolderUri(),
      sendRequest: async ({ query, attachments, background }) => this._send(query, attachments, background),
      canSendRequest,
      canSubmitWithoutSession,
      hasAdditionalSendContent: hasFeedback,
      loading,
      historyKey: constObservable(void 0),
      // no persisted history for the new-session view
      renderSessionTypePickerInControls: this._renderHarnessPickerInControls,
      supportsBackground: true,
      getInputOnboardingTipContainer: () => this._chatTipContainer,
      onDidChangeInputOnboardingVisible: (visible) => this.setInputOnboardingVisible(visible),
      onDidChangeInputNotificationVisible: (visible) => this.setInputNotificationVisible(visible)
    });
    this._register(toDisposable(() => newChatInput.saveState()));
    this._newChatInput = this._register(newChatInput);
    this._register(newSessionComposerService.registerComposer(this._newChatInput));
    const chatModeKindKey = ChatContextKeys.chatModeKind.bindTo(contextKeyService);
    chatModeKindKey.set(ChatModeKind.Agent);
    this._register(toDisposable(() => chatModeKindKey.reset()));
    this._register(this.openerService.registerOpener({
      open: async (resource) => {
        if (!this._chatTipPart.value) {
          return false;
        }
        const link = typeof resource === "string" ? resource : resource.toString();
        if (link === "command:workbench.action.chat.openModelPicker") {
          this._newChatInput.openModelPicker();
          return true;
        }
        if (link === "command:workbench.action.chat.openPlan") {
          return true;
        }
        return false;
      }
    }));
    this._register(this._workspacePicker.onDidSelectWorkspace(async (folderUri) => {
      await this._onWorkspaceSelected(folderUri);
      this._newChatInput.focus();
    }));
    this._register(this._newChatInput.sessionTypePicker.onDidSelectSessionType(async (pick) => {
      if (this._isQuickChatComposer.get()) {
        this.sessionsService.openQuickChat(pick ? { providerId: pick.providerId, sessionTypeId: pick.sessionTypeId } : void 0);
        this._newChatInput.focus();
        return;
      }
      await this._onWorkspaceSelected(this._workspacePicker.selectedFolderUri);
      this._newChatInput.focus();
    }));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration("chat.tips.enabled")) {
        return;
      }
      if (this.configurationService.getValue("chat.tips.enabled")) {
        this._renderChatTip();
      } else {
        this._clearChatTip();
      }
    }));
    this._register(this.storageService.onDidChangeValue(StorageScope.APPLICATION, TOTAL_SESSIONS_KEY, this._store)(() => this.updateChatTipVisibility()));
    const foregroundSessionCountContextKeys = /* @__PURE__ */ new Set([ChatContextKeys.foregroundSessionCount.key]);
    this._register(this.contextKeyService.onDidChangeContext((e) => {
      if (e.affectsSome(foregroundSessionCountContextKeys)) {
        this._renderChatTip();
      }
    }));
    let previousModelId;
    this._register(autorun((reader) => {
      const modelId = this._newChatInput.selectedModelState.read(reader).currentModel?.identifier;
      if (previousModelId !== void 0 && previousModelId !== modelId) {
        this._renderChatTip();
      }
      previousModelId = modelId;
    }));
    let previousFolderUri = this._session.get()?.workspace.get()?.folders[0]?.root;
    this._register(autorun((reader) => {
      const session = this._session.read(reader);
      const folderUri = session?.workspace.read(reader)?.folders[0]?.root;
      this._handlePromptOptionsWorkspaceChange(previousFolderUri, folderUri);
      previousFolderUri = folderUri;
      if (folderUri && !this.uriIdentityService.extUri.isEqual(folderUri, this._workspacePicker.selectedFolderUri)) {
        this._workspacePicker.setSelectedWorkspace(folderUri, { fireEvent: false });
      }
    }));
  }
  _handlePromptOptionsWorkspaceChange(previousFolderUri, folderUri) {
    const workspaceChanged = previousFolderUri ? !folderUri || !this.uriIdentityService.extUri.isEqual(previousFolderUri, folderUri) : !!folderUri;
    if (!workspaceChanged) {
      return;
    }
    if (folderUri) {
      void this._refreshPromptOptions();
    } else {
      this._newChatInput.clearPromptOptions();
    }
  }
  // --- Rendering ---
  render(parent) {
    const element = dom.append(parent, dom.$(".sessions-chat-widget"));
    const chatWidgetContainer = dom.append(element, dom.$(".new-chat-widget-container"));
    const chatWidgetContent = dom.append(chatWidgetContainer, dom.$(".new-chat-widget-content"));
    this._aquariumToggle = this._register(this.aquariumService.mountToggle(element));
    const aquariumAction = this._register(new Action(
      "sessions.aquarium.showAction",
      localize("aquariumAction", "Aquarium"),
      void 0,
      true,
      () => this.aquariumService.toggleActionVisibility()
    ));
    const petAction = this._register(new Action(
      "sessions.chatPet.toggle",
      localize("petAction", "Pet (/vscode-pet)"),
      void 0,
      true,
      () => this.chatPetService.toggle()
    ));
    this._register(dom.addDisposableListener(element, dom.EventType.CONTEXT_MENU, (e) => {
      const target = e.target;
      if (target && chatWidgetContent.contains(target)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      aquariumAction.checked = this.aquariumService.actionVisible.get();
      petAction.checked = this.chatPetService.enabled.get();
      const anchor = new StandardMouseEvent(dom.getWindow(element), e);
      this.contextMenuService.showContextMenu({
        getAnchor: () => anchor,
        getActions: () => [aquariumAction, petAction],
        getCheckedActionsRepresentation: () => "checkbox"
      });
    }));
    const workspacePickerContainer = dom.append(chatWidgetContent, dom.$(".new-session-workspace-picker-container"));
    this._register(isWeb ? this._renderEmptyStateGate(workspacePickerContainer, chatWidgetContent) : this._renderWorkspacePicker(workspacePickerContainer));
    if (!isWeb && !this._renderHarnessPickerInControls) {
      const quickChatHeaderRow = dom.append(chatWidgetContent, dom.$(".new-session-quick-chat-header.session-workspace-picker"));
      const quickChatHeaderLabel = dom.append(quickChatHeaderRow, dom.$(".session-workspace-picker-label"));
      quickChatHeaderLabel.textContent = localize("newChatHeader", "New Chat");
      const quickChatWithLabel = dom.append(quickChatHeaderRow, dom.$(".session-workspace-picker-label.session-workspace-picker-with-label"));
      quickChatWithLabel.textContent = localize("newSessionWith", "with");
      this._quickChatHeaderPickerHost = dom.append(quickChatHeaderRow, dom.$(".new-chat-quick-chat-header-picker-host"));
    }
    this._renderFeedbackBanner(chatWidgetContent);
    this._chatTipContainer = dom.append(chatWidgetContent, dom.$(".chat-getting-started-tip-container"));
    this._renderChatTip();
    this._newChatInput.render(chatWidgetContent, parent);
    this._register(autorun((reader) => {
      const isQuickChat = this._isQuickChatComposer.read(reader);
      chatWidgetContent.classList.toggle("quick-chat", isQuickChat);
      if (!isWeb) {
        this._workspacePickerVisibleKey.set(!isQuickChat);
      }
    }));
    if (!isWeb && !this._renderHarnessPickerInControls) {
      this._register(autorun((reader) => {
        const isQuickChat = this._isQuickChatComposer.read(reader);
        const target = isQuickChat ? this._quickChatHeaderPickerHost : this._workspacePickerRow;
        if (target) {
          this._newChatInput.sessionTypePicker.render(target, { className: "sessions-chat-session-type-picker" });
        }
      }));
    }
    this._seedWorkspaceDraft();
    if (!isWeb) {
      let wasQuickChat = this._isQuickChatComposer.get();
      this._register(autorun((reader) => {
        const isQuickChat = this._isQuickChatComposer.read(reader);
        if (wasQuickChat && !isQuickChat && !this._session.read(reader)) {
          this._seedWorkspaceDraft();
        }
        wasQuickChat = isQuickChat;
      }));
    }
    chatWidgetContainer.classList.add("revealed");
  }
  _renderChatTip() {
    if (!this._chatTipContainer) {
      return;
    }
    if (this.isChatTipSuppressed()) {
      this._clearChatTip();
      return;
    }
    if (this._chatTipContainer.parentElement?.classList.contains("no-agent-host")) {
      return;
    }
    if (this.contextKeyService.getContextKeyValue(ChatContextKeys.foregroundSessionCount.key) !== 0) {
      this._isChatTipSessionInitialized = false;
      this._clearChatTip();
      return;
    }
    if (!this._isChatTipSessionInitialized) {
      this._isChatTipSessionInitialized = true;
      this.chatTipService.resetSession();
    }
    const tip = this.chatTipService.getWelcomeTip(this.contextKeyService);
    if (!tip) {
      this._clearChatTip();
      return;
    }
    if (this._chatTipPart.value) {
      dom.setVisibility(true, this._chatTipContainer);
      return;
    }
    const store = new DisposableStore();
    const renderer = this.instantiationService.createInstance(ChatContentMarkdownRenderer);
    const tipPart = store.add(this.instantiationService.createInstance(ChatTipContentPart, tip, renderer));
    store.add(tipPart.onDidHide(() => {
      this._clearChatTip();
      this.focusInput();
    }));
    this._chatTipPart.value = store;
    dom.clearNode(this._chatTipContainer);
    this._chatTipContainer.appendChild(tipPart.domNode);
    dom.setVisibility(true, this._chatTipContainer);
  }
  _clearChatTip() {
    this._chatTipPart.clear();
    if (this._chatTipContainer) {
      dom.clearNode(this._chatTipContainer);
      dom.setVisibility(false, this._chatTipContainer);
    }
  }
  isInputOnboardingVisible() {
    return this._isInputOnboardingVisible;
  }
  setInputOnboardingVisible(visible) {
    this._isInputOnboardingVisible = visible;
    this.updateChatTipVisibility();
  }
  setInputNotificationVisible(visible) {
    this._isInputNotificationVisible = visible;
    this.updateChatTipVisibility();
  }
  isChatTipSuppressed() {
    const sessionCount = this.storageService.getNumber(TOTAL_SESSIONS_KEY, StorageScope.APPLICATION, 0);
    return sessionCount < MIN_SESSIONS_FOR_TIPS || this.isInputOnboardingVisible() || this._isInputNotificationVisible;
  }
  updateChatTipVisibility() {
    if (this.isChatTipSuppressed()) {
      this._clearChatTip();
    } else {
      this._renderChatTip();
    }
  }
  /**
   * Seed the new-session draft from the workspace picker's restored folder,
   * unless an active session already exists (then just sync the picker to it).
   */
  _seedWorkspaceDraft() {
    const restoredFolderUri = this._workspacePicker.selectedFolderUri;
    if (!this._syncWorkspacePickerFromActiveSession() && restoredFolderUri) {
      void this._createNewSession(restoredFolderUri);
    }
  }
  /**
   * If a new-session draft was restored by {@link openNewSession}, sync
   * the workspace picker to match the session's workspace. The picker may
   * have restored a workspace from a different provider (e.g. remote vs
   * local), so overwrite it with the session's actual workspace without
   * firing the event (which would trigger {@link _onWorkspaceSelected} and
   * create a new session).
   *
   * @returns `true` if an active session was found and the picker was synced.
   */
  _syncWorkspacePickerFromActiveSession() {
    const activeSession = this._session.get();
    if (!activeSession) {
      return false;
    }
    const sessionWorkspace = activeSession.workspace.get();
    const folderUri = sessionWorkspace?.folders[0]?.root;
    if (folderUri) {
      this._workspacePicker.setSelectedWorkspace(folderUri, { fireEvent: false });
      this._replaceDraftOnUnservableHarness(folderUri, activeSession);
    }
    return true;
  }
  /**
   * Replaces a restored draft whose harness the folder can no longer serve.
   * A draft outlives navigation, so it can name a session type that has since
   * stopped being advertised. Keeping it would leave the composer showing, and
   * sending to, an agent the harness picker doesn't list. An empty type list
   * means the folder's providers haven't reported yet (a late-connecting agent
   * host), so the draft is left alone.
   */
  _replaceDraftOnUnservableHarness(folderUri, draft) {
    if (draft.isCreated.get()) {
      return;
    }
    const pick = { providerId: draft.providerId, sessionTypeId: draft.sessionType };
    if (this.sessionsManagementService.getSessionTypesForFolder(folderUri).length === 0 || this._isPreferredServable(folderUri, pick)) {
      return;
    }
    void this._createNewSession(folderUri);
  }
  _isPreferredServable(folderUri, pick) {
    return this.sessionsManagementService.getSessionTypesForFolder(folderUri).some((t) => (pick.providerId === void 0 || t.providerId === pick.providerId) && t.sessionType.id === pick.sessionTypeId);
  }
  async _createNewSession(folderUri) {
    this._pendingPreferredUpgrade.clear();
    const creationCts = new CancellationTokenSource();
    const creationLifecycle = toDisposable(() => creationCts.dispose(true));
    this._newSessionCreation.value = creationLifecycle;
    const userPick = this._newChatInput.sessionTypePicker.getUserPickedSessionType();
    const pendingChange = new DisposableStore();
    let changedWhilePending = false;
    pendingChange.add(this.sessionsManagementService.onDidChangeSessionTypes(() => changedWhilePending = true));
    let result;
    try {
      result = await this._createSessionNow(folderUri, userPick, creationCts.token);
    } finally {
      pendingChange.dispose();
    }
    const isCurrentCreation = this._newSessionCreation.value === creationLifecycle;
    if (isCurrentCreation) {
      this._newSessionCreation.clear();
    } else {
      return result;
    }
    if (result.trustDeclined) {
      this._pendingPreferredUpgrade.clear();
      return result;
    }
    if (!result.session || !userPick || !this._isPreferredServable(folderUri, userPick)) {
      this._scheduleRecreateOnProviderChange(folderUri, userPick, result.session, changedWhilePending);
    }
    return result;
  }
  async _createSessionNow(folderUri, userPick, token) {
    const preferredPick = userPick && this._isPreferredServable(folderUri, userPick) ? userPick : this._newChatInput.sessionTypePicker.getPreferredSessionType(folderUri);
    const effectivePick = this._preferUsableSessionTypeWhenSignedOut(folderUri, preferredPick);
    const fallbackProviderId = this._workspacePicker.selectedResolved?.providerId;
    try {
      return await this.sessionsService.openNewSession({
        folderUri,
        ...effectivePick ? { providerId: effectivePick.providerId, sessionTypeId: effectivePick.sessionTypeId } : fallbackProviderId ? { providerId: fallbackProviderId } : void 0
      }, token);
    } catch (e) {
      this.logService.error("Failed to create new session:", e);
      return { session: void 0, trustDeclined: false };
    }
  }
  /**
   * While the user is signed out and the conditional-auth opt-in is on, replace
   * a pick that requires GitHub with the first offered session type usable
   * without it. A no-op when signed in, when the opt-in is off (today's
   * behavior), or when no offered type is usable — in which case the caller's
   * existing fallbacks still apply.
   */
  _preferUsableSessionTypeWhenSignedOut(folderUri, pick) {
    if (this.defaultAccountService.currentDefaultAccount !== null || !isAllowSignedOutWhenUsableEnabled(this.configurationService)) {
      return pick;
    }
    const usable = this.sessionsManagementService.getSessionTypesForFolder(folderUri).filter((type) => type.sessionType.authRequirement === SessionTypeAuthRequirement.None);
    const pickIsUsable = usable.some((type) => type.sessionType.id === pick?.sessionTypeId && (pick?.providerId === void 0 || type.providerId === pick.providerId));
    if (usable.length === 0 || pickIsUsable) {
      return pick;
    }
    return { providerId: usable[0].providerId, sessionTypeId: usable[0].sessionType.id };
  }
  _scheduleRecreateOnProviderChange(folderUri, userPick, created, replayMissedChange) {
    const store = new DisposableStore();
    store.add(this.sessionsManagementService.onDidChangeSessionTypes(() => this._recreateOnProviderChange(folderUri, userPick, created)));
    this._pendingPreferredUpgrade.value = store;
    if (replayMissedChange) {
      this._recreateOnProviderChange(folderUri, userPick, created);
    }
  }
  _recreateOnProviderChange(folderUri, userPick, created) {
    if (created) {
      const active = this._session.get();
      if (active?.sessionId !== created.sessionId || active.isCreated.get()) {
        return;
      }
      if (userPick) {
        if (!this._isPreferredServable(folderUri, userPick)) {
          return;
        }
      } else {
        const preferred = this._newChatInput.sessionTypePicker.getPreferredSessionType(folderUri);
        if (!preferred || preferred.providerId === active.providerId && preferred.sessionTypeId === active.sessionType) {
          return;
        }
      }
    }
    void this._createNewSession(folderUri);
  }
  /**
   * Returns the workspace URI for the context picker based on the current workspace selection.
   */
  _getContextFolderUri() {
    return this._workspacePicker.selectedFolderUri;
  }
  _renderWorkspacePicker(container) {
    this._workspacePickerVisibleKey.set(true);
    const pickersRow = dom.append(container, dom.$(".session-workspace-picker"));
    const pickersLabel = dom.append(pickersRow, dom.$(".session-workspace-picker-label"));
    pickersLabel.textContent = this._workspacePicker.selectedFolderUri ? localize("newSessionIn", "New session in") : localize("newSessionChooseWorkspace", "Start by picking a");
    this._workspacePicker.render(pickersRow);
    if (!this._renderHarnessPickerInControls) {
      const withLabel = dom.append(pickersRow, dom.$(".session-workspace-picker-label.session-workspace-picker-with-label"));
      withLabel.textContent = localize("newSessionWith", "with");
      this._workspacePickerRow = pickersRow;
      if (isWeb) {
        this._newChatInput.sessionTypePicker.render(pickersRow, { className: "sessions-chat-session-type-picker" });
      }
    }
    return this._workspacePicker.onDidSelectWorkspace(() => {
      const folderUri = this._workspacePicker.selectedFolderUri;
      pickersLabel.textContent = folderUri ? localize("newSessionIn", "New session in") : localize("newSessionChooseWorkspace", "Start by picking a");
    });
  }
  _renderEmptyState(container) {
    this._workspacePickerVisibleKey.set(false);
    const emptyState = this.instantiationService.createInstance(NoAgentHostEmptyState);
    emptyState.render(container);
    this._activeEmptyState = emptyState;
    return {
      dispose: () => {
        if (this._activeEmptyState === emptyState) {
          this._activeEmptyState = void 0;
        }
        emptyState.dispose();
      }
    };
  }
  /**
   * Web-only: hosts the workspace picker, but swaps it out for the
   * no-agent-host empty state once we are *sure* there are no hosts —
   * i.e. after a discovery cycle has completed. Rendering the empty
   * state before discovery has run would briefly flash it at users who
   * actually have hosts that just haven't been discovered yet (e.g.
   * cached tunnels resolved on startup). Until then we keep the regular
   * workspace picker, which has its own loading affordance.
   */
  _renderEmptyStateGate(container, chatWidgetContent) {
    const store = new DisposableStore();
    const pickerSlot = dom.append(container, dom.$(".session-workspace-picker-slot"));
    const stateDisposables = store.add(new MutableDisposable());
    const showPicker = () => {
      chatWidgetContent.classList.remove("no-agent-host");
      dom.clearNode(pickerSlot);
      stateDisposables.value = this._renderWorkspacePicker(pickerSlot);
      this._renderChatTip();
    };
    const showEmptyState = () => {
      chatWidgetContent.classList.add("no-agent-host");
      dom.clearNode(pickerSlot);
      stateDisposables.value = this._renderEmptyState(pickerSlot);
      this._clearChatTip();
    };
    const filter = this.agentHostFilterService;
    let hasCompletedDiscovery = filter.hosts.length > 0;
    if (!hasCompletedDiscovery && !filter.isDiscovering) {
      filter.rediscover();
    }
    const update = () => {
      if (hasCompletedDiscovery && !filter.isDiscovering && filter.hosts.length === 0) {
        showEmptyState();
      } else {
        showPicker();
      }
    };
    update();
    store.add(filter.onDidChange(() => {
      if (filter.hosts.length > 0) {
        hasCompletedDiscovery = true;
      }
      update();
    }));
    store.add(filter.onDidChangeDiscovering(() => {
      if (!filter.isDiscovering) {
        hasCompletedDiscovery = true;
      }
      update();
    }));
    return store;
  }
  // --- Send ---
  async _send(query, attachedContext, background) {
    const session = this._session.get();
    if (!session) {
      this._workspacePicker.showPicker();
      return false;
    }
    const feedbackItems = [...this._feedbackItems.get()];
    const workspaceRoots = session.workspace.get()?.folders.map((folder) => folder.root) ?? (this._workspacePicker.selectedFolderUri ? [this._workspacePicker.selectedFolderUri] : []);
    const request = buildNewSessionPrompt(query, feedbackItems, workspaceRoots);
    const wasQuickChat = this._isQuickChatComposer.get();
    const reseedFolderUri = background && !wasQuickChat ? this._workspacePicker.selectedFolderUri : void 0;
    const sendOptions = { query: request, attachedContext, background };
    const clearFeedback = () => {
      for (const item of feedbackItems) {
        this.agentFeedbackService.removeFeedback(AGENT_FEEDBACK_NEW_SESSION_RESOURCE, item.id);
      }
    };
    if (background) {
      this._pendingBackgroundSends.set(sendOptions, Event.once(
        Event.filter(this.sessionsManagementService.onDidSendRequest, (event) => event.options === sendOptions)
      )(() => {
        clearFeedback();
        this._pendingBackgroundSends.deleteAndDispose(sendOptions);
      }));
    }
    try {
      await this.sessionsManagementService.sendNewChatRequest(session, sendOptions);
    } catch (e) {
      this._pendingBackgroundSends.deleteAndDispose(sendOptions);
      this.logService.error("Failed to send request:", e);
      return false;
    }
    if (!background) {
      clearFeedback();
    }
    if (background) {
      if (wasQuickChat) {
        this.sessionsService.openQuickChat();
      } else if (reseedFolderUri) {
        await this._createNewSession(reseedFolderUri);
      }
    }
    return true;
  }
  _renderFeedbackBanner(container) {
    const host = dom.append(container, dom.$(".session-input-banners.new-session-feedback-banners"));
    const content = this._register(new MutableDisposable());
    this._register(autorun((reader) => {
      const feedbackItems = this._feedbackItems.read(reader);
      content.clear();
      dom.clearNode(host);
      if (!feedbackItems.length) {
        return;
      }
      const count = feedbackItems.length;
      const text = count === 1 ? localize("newSessionFeedback.one", "1 comment") : localize("newSessionFeedback.many", "{0} comments", count);
      const store = new DisposableStore();
      content.value = store;
      const banner = store.add(this.instantiationService.createInstance(SessionInputBannerWidget, {
        icon: Codicon.commentDiscussion,
        accent: false,
        text,
        ariaLabel: text,
        actions: [{
          label: localize("newSessionFeedback.reveal", "Reveal"),
          run: () => this.agentFeedbackService.revealFeedback(AGENT_FEEDBACK_NEW_SESSION_RESOURCE, feedbackItems[0].id)
        }]
      }));
      host.appendChild(banner.domNode);
    }));
  }
  saveState() {
    this._newChatInput.saveState();
  }
  layout(_height, _width) {
    this._newChatInput.layout(_height, _width);
  }
  focusInput() {
    if (this._activeEmptyState) {
      this._activeEmptyState.focus();
      return;
    }
    this._newChatInput.focus();
  }
  /**
   * Handles a workspace selection from the workspace picker and creates a
   * new session for it. Workspace trust (when required) is requested by
   * {@link ISessionsService.openNewSession} itself — a single gate shared
   * by every path that creates a concrete session for a folder.
   */
  async _onWorkspaceSelected(folderUri) {
    this._pendingPreferredUpgrade.clear();
    const currentFolderUri = this._session.get()?.workspace.get()?.folders[0]?.root;
    const refreshingPromptOptions = !!currentFolderUri && (!folderUri || !this.uriIdentityService.extUri.isEqual(currentFolderUri, folderUri)) && this._newChatInput.preparePromptOptionsRefresh();
    if (!folderUri) {
      this.sessionsService.unsetNewSession();
      return;
    }
    if (this._store.isDisposed) {
      return;
    }
    const result = await this._createNewSession(folderUri);
    if (refreshingPromptOptions && !result.session) {
      this._newChatInput.showPromptOptions(void 0);
    }
    if (result.trustDeclined) {
      this._workspacePicker.removeFromRecents(folderUri);
    }
  }
  async _refreshPromptOptions() {
    try {
      await this._newChatInput.refreshPromptOptions();
    } catch (error) {
      this.logService.error("Failed to refresh new-session prompt options:", error);
      this._newChatInput.showPromptOptions(void 0);
    }
  }
  prefillInput(text) {
    this._newChatInput.prefillInput(text);
  }
  setHostVisible(visible) {
    this._aquariumToggle?.setHostVisible(visible);
  }
  sendQuery(text) {
    this._newChatInput.sendQuery(text);
  }
  submitInput() {
    if (!this._session.get()) {
      this._workspacePicker.showPicker();
      return Promise.resolve(false);
    }
    return this._newChatInput.submit();
  }
  attach(uris) {
    this._newChatInput.attach(uris);
  }
  selectWorkspace(folderUri, providerId) {
    this._workspacePicker.setSelectedWorkspace(folderUri, { providerId });
  }
};
NewChatWidget = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, ILogService),
  __decorateParam(6, ISessionsManagementService),
  __decorateParam(7, ISessionsService),
  __decorateParam(8, IAquariumService),
  __decorateParam(9, IAgentHostFilterService),
  __decorateParam(10, IUriIdentityService),
  __decorateParam(11, IAgentFeedbackService),
  __decorateParam(12, IChatPetService),
  __decorateParam(13, IChatTipService),
  __decorateParam(14, IOpenerService),
  __decorateParam(15, IDefaultAccountService),
  __decorateParam(16, IStorageService),
  __decorateParam(17, INewSessionComposerService)
], NewChatWidget);
export {
  NewChatWidget
};
