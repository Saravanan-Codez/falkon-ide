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
import "./media/chatInput.css";
import "./media/chatInputMobile.css";
import * as dom from "../../../../base/browser/dom.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { Gesture, EventType as TouchEventType } from "../../../../base/browser/touch.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Emitter } from "../../../../base/common/event.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { MenuEntryActionViewItem } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { CodeEditorWidget } from "../../../../editor/browser/widget/codeEditor/codeEditorWidget.js";
import { EditorExtensionsRegistry } from "../../../../editor/browser/editorExtensions.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { EDITOR_FONT_DEFAULTS } from "../../../../editor/common/config/fontInfo.js";
import { SuggestController } from "../../../../editor/contrib/suggest/browser/suggestController.js";
import { SnippetController2 } from "../../../../editor/contrib/snippet/browser/snippetController2.js";
import { PlaceholderTextContribution } from "../../../../editor/contrib/placeholderText/browser/placeholderTextContribution.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { AccessibilityVerbositySettingId } from "../../../../workbench/contrib/accessibility/browser/accessibilityConfiguration.js";
import { AccessibilityCommandId } from "../../../../workbench/contrib/accessibility/common/accessibilityCommands.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { HoverPosition } from "../../../../base/browser/ui/hover/hoverWidget.js";
import { renderIcon } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { localize } from "../../../../nls.js";
import * as aria from "../../../../base/browser/ui/aria/aria.js";
import { ContextMenuController } from "../../../../editor/contrib/contextmenu/browser/contextmenu.js";
import { getSimpleEditorOptions } from "../../../../workbench/contrib/codeEditor/browser/simpleEditorOptions.js";
import { NewChatContextAttachments } from "./newChatContextAttachments.js";
import { INewChatVoiceTargetService, isNewChatVoiceSessionActive, NEW_CHAT_VOICE_SENTINEL, NewChatVoiceController } from "./newChatVoice.js";
import { MobileSessionTypePicker } from "./mobile/mobileSessionTypePicker.js";
import { installMobileChipLaneScroll } from "../../../browser/parts/mobile/mobileChipLaneScroll.js";
import { IWorkbenchLayoutService } from "../../../../workbench/services/layout/browser/layoutService.js";
import { Menus } from "../../../browser/menus.js";
import { HiddenItemStrategy, MenuWorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { MenuId, MenuItemAction } from "../../../../platform/actions/common/actions.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { defaultButtonStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { getDictationHoverMarkdown } from "../../../../workbench/contrib/chat/browser/speechToText/micButtonHovers.js";
import { addMicButtonContextMenuListener, getDictationContextMenuActions } from "../../../../workbench/contrib/chat/browser/speechToText/micButtonMenuActions.js";
import { SlashCommandHandler } from "./slashCommands.js";
import { VariableCompletionHandler } from "./variableCompletions.js";
import { SessionReferenceCompletionHandler } from "./sessionReferenceCompletions.js";
import { AgentHostInputCompletionHandler } from "./agentHostInputCompletions.js";
import { IChatRequestVariableEntry, isExplicitFileOrImageVariableEntry, toFileVariableEntry } from "../../../../workbench/contrib/chat/common/attachments/chatVariableEntries.js";
import { IChatSessionsService } from "../../../../workbench/contrib/chat/common/chatSessionsService.js";
import { ChatAgentLocation, ChatModeKind } from "../../../../workbench/contrib/chat/common/constants.js";
import { ChatHistoryNavigator } from "../../../../workbench/contrib/chat/common/widget/chatWidgetHistoryService.js";
import { registerAndCreateHistoryNavigationContext } from "../../../../platform/history/browser/contextScopedHistoryWidget.js";
import { autorun, constObservable, derived, observableFromEvent, observableValue } from "../../../../base/common/observable.js";
import { isEqual } from "../../../../base/common/resources.js";
import { ChatInputNotificationWidget } from "../../../../workbench/contrib/chat/browser/widget/input/chatInputNotificationWidget.js";
import { IChatSubmitRequestHandlerService } from "../../../../workbench/contrib/chat/browser/chatSubmitRequestHandlerService.js";
import { INewChatModelPickerService, NewChatModelPickerService } from "./newChatModelPicker.js";
import { ModelPicker, ModelPickerActionViewItem } from "./modelPicker.js";
import { ISessionModelSelectionModel, SessionModelSelectionModel } from "./sessionModelSelectionModel.js";
import { ISessionContext, SessionContext } from "../../../services/sessions/browser/sessionContext.js";
import { AGENT_SESSIONS_SCOPED_INPUT_HISTORY_SETTING } from "./sessionsChatHistory.js";
import { IChatStatusItemService } from "../../../../workbench/contrib/chat/browser/chatStatus/chatStatusItemService.js";
import { handleTerminalCommandPaste, isTerminalCommandInput } from "../../../../workbench/contrib/chat/browser/chatTerminalCommandPaste.js";
import { getChatSessionType } from "../../../../workbench/contrib/chat/common/model/chatUri.js";
import { ChatSpeechToTextState, DictationSettingId, IChatSpeechToTextService, isDictationActiveOnSurface } from "../../../../workbench/contrib/chat/browser/speechToText/chatSpeechToTextService.js";
import { setupDictationMicGlow } from "../../../../workbench/contrib/chat/browser/speechToText/dictationMicGlow.js";
import { IDictationOnboardingService } from "../../../../workbench/contrib/chat/browser/speechToText/dictationOnboarding.js";
import { ChatVoiceInputModeAction, VoiceInputModeActionViewItem } from "../../../../workbench/contrib/chat/browser/voiceInputMode/voiceInputModeActionViewItem.js";
import { IVoiceInputModeService } from "../../../../workbench/contrib/chat/browser/voiceInputMode/voiceInputMode.js";
import { toAction } from "../../../../base/common/actions.js";
import { runDictationShortcut } from "../../../../workbench/contrib/chat/browser/actions/chatSpeechToTextActions.js";
import { notifyDictationSubmitted } from "../../../../workbench/contrib/chat/browser/speechToText/dictationSession.js";
import { combineVoiceInput } from "../../../../workbench/contrib/chat/browser/voiceClient/voiceInputUtils.js";
import { ChatContextKeys } from "../../../../workbench/contrib/chat/common/actions/chatContextKeys.js";
import { DictationDownloadRing, getDictationDownloadHoverMarkdown, getDictationPreparingLabel } from "../../../../workbench/contrib/chat/browser/speechToText/dictationDownloadRing.js";
import { IVoiceSessionController } from "../../../../workbench/contrib/chat/browser/voiceClient/voiceSessionController.js";
import { ChatPetWidget } from "../../../../workbench/contrib/chat/browser/widget/chatPetWidget.js";
import { IVoiceModeOnboardingService } from "../../../../workbench/contrib/agentsVoice/browser/voiceModeOnboarding.js";
import { AGENTS_VOICE_ENABLED } from "../../../../workbench/contrib/agentsVoice/common/agentsVoice.js";
import { animatePromptTyping } from "./promptTypingAnimation.js";
import { PromptTemplatePlaceholderController } from "./promptTemplatePlaceholder.js";
import { NEW_SESSION_PROMPT_TYPING_DURATION_MS } from "./newSessionComposerService.js";
import { NewSessionPromptOptionsWidget } from "./newSessionPromptOptions.js";
const OPEN_OTEL_SETTINGS_COMMAND = "github.copilot.chat.otel.openSettings";
const OTEL_STATUS_COMMAND = "github.copilot.chat.otel.statusActive";
const OTEL_STATUS_ENTRY_ID = "copilot.otelStatus";
const OTEL_DOCS_URL = "https://code.visualstudio.com/docs/agents/guides/monitoring-agents";
const STORAGE_KEY_DRAFT_STATE = "sessions.draftState";
const MIN_EDITOR_HEIGHT = 50;
const MAX_EDITOR_HEIGHT = 200;
const NEW_CHAT_INPUT_FONT_FAMILY = "system-ui, -apple-system, sans-serif";
const SessionsChatInputHasDictationFocus = new RawContextKey("sessionsChatInputHasDictationFocus", false, localize("sessionsChatInputHasDictationFocus", "True when focus is in an Agents window chat composer that supports dictation."));
const TOGGLE_DICTATION_COMMAND_ID = "sessions.action.chat.toggleDictation";
let activeDictationComposer;
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: TOGGLE_DICTATION_COMMAND_ID,
  weight: KeybindingWeight.WorkbenchContrib + 1,
  when: ContextKeyExpr.and(
    SessionsChatInputHasDictationFocus,
    ContextKeyExpr.has(ChatContextKeys.speechToTextConfigured.key)
  ),
  primary: KeyMod.CtrlCmd | KeyCode.KeyI,
  handler: () => activeDictationComposer?.toggleDictation()
});
KeybindingsRegistry.registerKeybindingRule({
  id: "agentsVoice.startVoiceInChat",
  weight: KeybindingWeight.WorkbenchContrib + 1,
  when: ContextKeyExpr.and(
    SessionsChatInputHasDictationFocus,
    AGENTS_VOICE_ENABLED
  ),
  primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Space
});
let NewChatInputStatusActionViewItem = class extends MenuEntryActionViewItem {
  constructor(action, options, keybindingService, notificationService, contextKeyService, themeService, contextMenuService, accessibilityService, chatStatusItemService, hoverService, commandService) {
    super(action, options, keybindingService, notificationService, contextKeyService, themeService, contextMenuService, accessibilityService);
    this.chatStatusItemService = chatStatusItemService;
    this.hoverService = hoverService;
    this.commandService = commandService;
    this.hoverContentDisposables = this._register(new MutableDisposable());
  }
  render(container) {
    super.render(container);
    if (this._commandAction.id !== OTEL_STATUS_COMMAND) {
      return;
    }
    this._register(this.chatStatusItemService.onDidChange((e) => {
      if (e.entry.id === OTEL_STATUS_ENTRY_ID) {
        this.updateTooltip();
      }
    }));
  }
  async onClick(event) {
    if (this._commandAction.id === OTEL_STATUS_COMMAND && this.element) {
      event.preventDefault();
      event.stopPropagation();
      this.hoverService.showManagedHover(this.element);
      return;
    }
    await super.onClick(event);
  }
  getHoverContents() {
    if (this._commandAction.id === OTEL_STATUS_COMMAND) {
      return { element: () => this._renderStatusHover() };
    }
    return super.getHoverContents();
  }
  getTooltip() {
    if (this._commandAction.id === OTEL_STATUS_COMMAND) {
      const tooltip = this._getStatusEntryTooltip();
      if (tooltip) {
        return tooltip;
      }
    }
    return super.getTooltip();
  }
  _getStatusEntryTooltip() {
    for (const entry of this.chatStatusItemService.getEntries()) {
      if (entry.id === OTEL_STATUS_ENTRY_ID) {
        return entry.tooltip;
      }
    }
    return void 0;
  }
  _renderStatusHover() {
    const store = new DisposableStore();
    this.hoverContentDisposables.value = store;
    const root = dom.$(".new-chat-input-status-hover");
    root.appendChild(dom.$(".new-chat-input-status-hover-title", void 0, localize("newChatInput.status.otel.title", "Monitoring with OpenTelemetry enabled")));
    root.appendChild(dom.$(".new-chat-input-status-hover-detail", void 0, this._getStatusEntryTooltip() ?? super.getTooltip()));
    const actions = root.appendChild(dom.$(".new-chat-input-status-hover-actions"));
    const learnMoreButton = store.add(new Button(actions, { ...defaultButtonStyles, secondary: true }));
    learnMoreButton.label = localize("newChatInput.status.otel.learnMore", "Learn More");
    store.add(learnMoreButton.onDidClick(() => {
      void this.commandService.executeCommand("vscode.open", URI.parse(OTEL_DOCS_URL));
      this.hoverService.hideHover(true);
    }));
    const manageButton = store.add(new Button(actions, { ...defaultButtonStyles, secondary: true }));
    manageButton.label = localize("newChatInput.status.otel.manage", "Manage");
    store.add(manageButton.onDidClick(() => {
      void this.commandService.executeCommand(OPEN_OTEL_SETTINGS_COMMAND);
      this.hoverService.hideHover(true);
    }));
    return root;
  }
};
NewChatInputStatusActionViewItem = __decorateClass([
  __decorateParam(2, IKeybindingService),
  __decorateParam(3, INotificationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IThemeService),
  __decorateParam(6, IContextMenuService),
  __decorateParam(7, IAccessibilityService),
  __decorateParam(8, IChatStatusItemService),
  __decorateParam(9, IHoverService),
  __decorateParam(10, ICommandService)
], NewChatInputStatusActionViewItem);
const RANDOM_PLACEHOLDERS = [
  localize("sessionsChatInput.placeholder.whatAreYouBuilding", "What are you building?"),
  localize("sessionsChatInput.placeholder.whatWillYouShipToday", "What will you ship today?"),
  localize("sessionsChatInput.placeholder.describeWhatYouWantToBuild", "Describe what you want to build"),
  localize("sessionsChatInput.placeholder.whatsYourNextMilestone", "What's your next milestone?"),
  localize("sessionsChatInput.placeholder.whatAreYouTryingToAchieve", "What are you trying to achieve?"),
  localize("sessionsChatInput.placeholder.pitchYourIdea", "Pitch your idea"),
  localize("sessionsChatInput.placeholder.whatsTheGoal", "What's the goal?"),
  localize("sessionsChatInput.placeholder.whatWillYouCreate", "What will you create?"),
  localize("sessionsChatInput.placeholder.whatFeatureAreYouDreamingUp", "What feature are you dreaming up?"),
  localize("sessionsChatInput.placeholder.describeTheOutcome", "Describe the outcome you want"),
  localize("sessionsChatInput.placeholder.whatProblemAreYouSolving", "What problem are you solving?"),
  localize("sessionsChatInput.placeholder.whatsNextOnYourRoadmap", "What's next on your roadmap?"),
  localize("sessionsChatInput.placeholder.whatWouldYouLikeToAutomate", "What would you like to automate?"),
  localize("sessionsChatInput.placeholder.whatWillYouLaunch", "What will you launch?"),
  localize("sessionsChatInput.placeholder.describeYourMission", "Describe your mission")
];
let lastPlaceholderIndex = -1;
function getRandomChatInputPlaceholder() {
  let index = Math.floor(Math.random() * RANDOM_PLACEHOLDERS.length);
  if (index === lastPlaceholderIndex) {
    index = (index + 1) % RANDOM_PLACEHOLDERS.length;
  }
  lastPlaceholderIndex = index;
  return RANDOM_PLACEHOLDERS[index];
}
let NewChatInputWidget = class extends Disposable {
  constructor(options, instantiationService, modelService, configurationService, contextKeyService, logService, hoverService, storageService, dialogService, keybindingService, layoutService, chatSessionsService, chatSpeechToTextService, dictationOnboardingService, chatSubmitRequestHandlerService, contextMenuService, commandService, voiceSessionController, voiceInputModeService, accessibilityService, voiceModeOnboardingService, newChatVoiceTargetService, themeService) {
    super();
    this.options = options;
    this.instantiationService = instantiationService;
    this.modelService = modelService;
    this.configurationService = configurationService;
    this.contextKeyService = contextKeyService;
    this.logService = logService;
    this.hoverService = hoverService;
    this.storageService = storageService;
    this.dialogService = dialogService;
    this.keybindingService = keybindingService;
    this.layoutService = layoutService;
    this.chatSessionsService = chatSessionsService;
    this.chatSpeechToTextService = chatSpeechToTextService;
    this.dictationOnboardingService = dictationOnboardingService;
    this.chatSubmitRequestHandlerService = chatSubmitRequestHandlerService;
    this.contextMenuService = contextMenuService;
    this.commandService = commandService;
    this.voiceSessionController = voiceSessionController;
    this.voiceInputModeService = voiceInputModeService;
    this.accessibilityService = accessibilityService;
    this.voiceModeOnboardingService = voiceModeOnboardingService;
    this.newChatVoiceTargetService = newChatVoiceTargetService;
    this.themeService = themeService;
    // IHistoryNavigationWidget
    this._onDidFocus = this._register(new Emitter());
    this.onDidFocus = this._onDidFocus.event;
    this._onDidBlur = this._register(new Emitter());
    this.onDidBlur = this._onDidBlur.event;
    this._promptTemplatePlaceholder = this._register(new MutableDisposable());
    this._promptOptionsWidget = this._register(new MutableDisposable());
    this._promptOptionsRefresh = this._register(new MutableDisposable());
    this._sending = false;
    this._loadingDelayDisposable = this._register(new MutableDisposable());
    this._promptTypingAnimation = this._register(new MutableDisposable());
    this._newChatModelPickerService = new NewChatModelPickerService();
    this._compactModelPicker = observableValue(this, false);
    // Input state
    this._draftState = {
      inputText: "",
      attachments: []
    };
    this._sessionModelSelectionModel = this._register(this.instantiationService.createInstance(SessionModelSelectionModel, this.options.session));
    this._canSendRequest = derived(this, (reader) => {
      if (this.options.canSubmitWithoutSession?.read(reader)) {
        return true;
      }
      const modelSelection = this._sessionModelSelectionModel.state.read(reader);
      return this.options.canSendRequest.read(reader) && modelSelection.hasSelectableModel && !modelSelection.pendingSelection;
    });
    this._scopedInstantiationService = this._register(this.instantiationService.createChild(new ServiceCollection(
      [INewChatModelPickerService, this._newChatModelPickerService],
      [ISessionContext, new SessionContext(this.options.session)],
      [ISessionModelSelectionModel, this._sessionModelSelectionModel]
    )));
    this._history = this._register(this.instantiationService.createInstance(ChatHistoryNavigator, ChatAgentLocation.Chat));
    if (this.options.historyKey) {
      this._register(autorun((reader) => this._setHistoryKey(this.options.historyKey?.read(reader))));
      this._register(this.configurationService.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(AGENT_SESSIONS_SCOPED_INPUT_HISTORY_SETTING)) {
          this._setHistoryKey(this.options.historyKey?.get());
        }
      }));
    }
    this._contextAttachments = this._register(this.instantiationService.createInstance(NewChatContextAttachments));
    this.sessionTypePicker = this._register(this.instantiationService.createInstance(MobileSessionTypePicker, this.options.session, this.options.sessionTypePickerOptions));
    this._register(this._contextAttachments.onDidChangeContext(() => {
      this._updateDraftState();
      this._updateSendButtonState();
      this.focus();
    }));
    this._register(autorun((reader) => {
      this._canSendRequest.read(reader);
      this.options.hasAdditionalSendContent?.read(reader);
      const isLoading = this.options.loading.read(reader);
      this._loadingSpinner?.classList.toggle("visible", isLoading);
      this._updateSendButtonState();
    }));
  }
  static {
    this.compactModelPickerWidth = 280;
  }
  get element() {
    return this._editorContainer;
  }
  /** The underlying input editor. Exposed for component fixtures. */
  get inputEditor() {
    return this._editor;
  }
  /** The current model-selection state. Exposed so host widgets can react to model changes. */
  get selectedModelState() {
    return this._sessionModelSelectionModel.state;
  }
  /** Opens the model picker dropdown. */
  openModelPicker() {
    this._newChatModelPickerService.openModelPicker();
  }
  /** Moves the provider-contributed session controls into the given container. */
  renderSessionControls(container) {
    if (!this._sessionControlsContainer) {
      throw new Error("NewChatInputWidget must be rendered before its session controls.");
    }
    container.appendChild(this._sessionControlsContainer);
  }
  _setHistoryKey(historyKey) {
    this._history.setHistoryKey(this.configurationService.getValue(AGENT_SESSIONS_SCOPED_INPUT_HISTORY_SETTING) !== false ? historyKey : void 0);
  }
  // --- Rendering ---
  render(parent, root) {
    const chatInputContainer = dom.append(parent, dom.$(".new-chat-input-container"));
    const editorOverflowWidgetsDomNode = dom.append(root, dom.$(".sessions-chat-editor-overflow.monaco-editor"));
    editorOverflowWidgetsDomNode.classList.add("hideSuggestTextIcons");
    this._register({ dispose: () => editorOverflowWidgetsDomNode.remove() });
    const notificationContainer = dom.append(chatInputContainer, dom.$(".chat-input-notification-container"));
    const notificationWidget = this._register(this.instantiationService.createInstance(
      ChatInputNotificationWidget,
      {
        modelTargetChatSessionType: this.sessionTypePicker.modelTargetChatSessionType,
        openModelPicker: () => this._newChatModelPickerService.openModelPicker(),
        switchToModel: (modelIdentifier) => this._newChatModelPickerService.switchToModel(modelIdentifier),
        onDidChangeVisibility: (visible) => this.options.onDidChangeInputNotificationVisible?.(visible)
      }
    ));
    notificationContainer.appendChild(notificationWidget.domNode);
    const voiceOnboardingContainer = dom.append(chatInputContainer, dom.$(".voice-mode-onboarding-container"));
    const onDidChangeInputOnboardingVisible = () => this.options.onDidChangeInputOnboardingVisible?.(
      this.voiceModeOnboardingService.isVisible || this.dictationOnboardingService.isVisible
    );
    const tipContainer = this.options.getInputOnboardingTipContainer?.();
    this._register(this.voiceModeOnboardingService.registerHost(voiceOnboardingContainer, chatInputContainer, () => this.focus(), tipContainer, onDidChangeInputOnboardingVisible));
    const dictationOnboardingContainer = dom.append(chatInputContainer, dom.$(".dictation-onboarding-container"));
    this._register(this.dictationOnboardingService.registerHost(dictationOnboardingContainer, chatInputContainer, tipContainer, onDidChangeInputOnboardingVisible));
    this._promptOptionsWidget.value = this.instantiationService.createInstance(NewSessionPromptOptionsWidget, chatInputContainer, async (option, expectedInput, animate) => {
      this.focus();
      const inserted = animate ? await this.animatePrompt(option.prompt, NEW_SESSION_PROMPT_TYPING_DURATION_MS, option.placeholder, CancellationToken.None, expectedInput) : this._replacePrompt(option.prompt, option.placeholder, expectedInput);
      const generatedValue = option.placeholder ? option.prompt.replace(option.placeholder, "") : option.prompt;
      if (inserted && (this._editor.getValue() === option.prompt || this._editor.getValue() === generatedValue)) {
        aria.status(localize("newSessionPromptOptions.inserted", "Inserted prompt: {0}", option.title));
      }
      return inserted;
    });
    this._promptOptionsWidget.value.setState(this._promptOptionsState);
    const inputAreaWrapper = dom.append(chatInputContainer, dom.$(".new-chat-input-area-wrapper"));
    const inputArea = dom.append(inputAreaWrapper, dom.$(".new-chat-input-area"));
    const attachRow = dom.append(inputArea, dom.$(".sessions-chat-attach-row"));
    const attachedContextContainer = dom.append(attachRow, dom.$(".sessions-chat-attached-context"));
    this._contextAttachments.renderAttachedContext(attachedContextContainer);
    this._contextAttachments.registerDropTarget(root);
    this._contextAttachments.registerPasteHandler(inputArea);
    this._createEditor(inputArea, editorOverflowWidgetsDomNode);
    const inputHasContent = observableFromEvent(this, this._editor.onDidChangeModelContent, () => this._editor.getValue().length > 0);
    this._register(this.instantiationService.createInstance(ChatPetWidget, chatInputContainer, inputArea, root, constObservable(void 0), inputHasContent, constObservable(true), this._editor.onDidChangeModelContent));
    this._createInputToolbar(inputArea);
    const newChatBottomContainer = dom.append(parent, dom.$(".new-chat-bottom-container"));
    const newChatControlsContainer = dom.append(newChatBottomContainer, dom.$(".new-chat-controls-container"));
    if (this.options.renderSessionTypePickerInControls !== false) {
      const sessionTypePickerHost = dom.append(newChatControlsContainer, dom.$(".new-chat-session-type-picker-host"));
      this.sessionTypePicker.render(sessionTypePickerHost);
    }
    const sessionControlsContainer = this._sessionControlsContainer = dom.append(newChatControlsContainer, dom.$(".new-chat-session-controls"));
    this._register(this._scopedInstantiationService.createInstance(MenuWorkbenchToolBar, sessionControlsContainer, Menus.NewSessionControl, {
      hiddenItemStrategy: HiddenItemStrategy.NoHide
    }));
    this._register({ dispose: () => sessionControlsContainer.remove() });
    const repoConfigContainer = dom.append(newChatBottomContainer, dom.$(".new-chat-repo-config-container"));
    this._register(this._scopedInstantiationService.createInstance(MenuWorkbenchToolBar, repoConfigContainer, Menus.NewSessionRepositoryConfig, {
      hiddenItemStrategy: HiddenItemStrategy.NoHide
    }));
    this._register(installMobileChipLaneScroll(newChatBottomContainer, this.layoutService));
    const statusContainer = dom.append(repoConfigContainer, dom.$(".new-chat-status-toolbar"));
    this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, statusContainer, MenuId.ChatInputStatus, {
      hiddenItemStrategy: HiddenItemStrategy.NoHide,
      toolbarOptions: { primaryGroup: () => true },
      actionViewItemProvider: (action, options) => {
        if (action.id === OTEL_STATUS_COMMAND && action instanceof MenuItemAction) {
          return this.instantiationService.createInstance(NewChatInputStatusActionViewItem, action, options);
        }
        return void 0;
      }
    }));
    this._restoreState();
    this._register(dom.addDisposableListener(chatInputContainer, "animationend", () => {
      this._editor?.layout();
    }, { once: true }));
  }
  _updateInputLoadingState() {
    const loading = this._sending;
    if (loading) {
      if (!this._loadingDelayDisposable.value) {
        const timer = setTimeout(() => {
          this._loadingDelayDisposable.clear();
          if (this._sending) {
            this._loadingSpinner?.classList.add("visible");
          }
        }, 500);
        this._loadingDelayDisposable.value = toDisposable(() => clearTimeout(timer));
      }
    } else {
      this._loadingDelayDisposable.clear();
      this._loadingSpinner?.classList.remove("visible");
    }
  }
  // --- Editor ---
  _getAriaLabel() {
    const verbose = this.configurationService.getValue(AccessibilityVerbositySettingId.SessionsChat);
    if (verbose) {
      const kbLabel = this.keybindingService.lookupKeybinding(AccessibilityCommandId.OpenAccessibilityHelp)?.getLabel();
      return kbLabel ? localize("chatInput.accessibilityHelp", "Chat input. Press Enter to send out the request. Use {0} for Chat Accessibility Help.", kbLabel) : localize("chatInput.accessibilityHelpNoKb", "Chat input. Press Enter to send out the request. Use the Chat Accessibility Help command for more information.");
    }
    return localize("chatInput", "Chat input");
  }
  _getTerminalCommandPrefix() {
    const session = this.options.session.get();
    return session ? this.chatSessionsService.getCapabilitiesForSessionType(getChatSessionType(session.resource))?.terminalCommandPrefix : void 0;
  }
  _handleTerminalCommandPaste(e) {
    handleTerminalCommandPaste(e, this._editor, this._getTerminalCommandPrefix(), this.dialogService, this.storageService);
  }
  _createEditor(container, overflowWidgetsDomNode) {
    const editorContainer = this._editorContainer = dom.append(container, dom.$(".sessions-chat-editor"));
    const minHeight = this.options.minEditorHeight ?? MIN_EDITOR_HEIGHT;
    editorContainer.style.height = `${minHeight}px`;
    const inputScopedContextKeyService = this._register(this.contextKeyService.createScoped(container));
    const { historyNavigationBackwardsEnablement, historyNavigationForwardsEnablement } = this._register(registerAndCreateHistoryNavigationContext(inputScopedContextKeyService, this));
    this._historyNavigationBackwardsEnablement = historyNavigationBackwardsEnablement;
    this._historyNavigationForwardsEnablement = historyNavigationForwardsEnablement;
    const scopedInstantiationService = this._register(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, inputScopedContextKeyService])));
    const uri = URI.from({ scheme: "sessions-chat", path: `input-${Date.now()}` });
    const textModel = this._register(this.modelService.createModel("", null, uri, true));
    const editorOptions = {
      ...getSimpleEditorOptions(this.configurationService),
      readOnly: false,
      ariaLabel: this._getAriaLabel(),
      placeholder: this.options.placeholder ?? getRandomChatInputPlaceholder(),
      fontFamily: NEW_CHAT_INPUT_FONT_FAMILY,
      fontSize: 13,
      lineHeight: 20,
      cursorWidth: 1,
      padding: { top: 8, bottom: 2 },
      wrappingStrategy: "advanced",
      stickyScroll: { enabled: false },
      renderWhitespace: "none",
      scrollbar: {
        horizontal: "hidden",
        alwaysConsumeMouseWheel: false,
        vertical: "auto",
        verticalScrollbarSize: 7
      },
      overflowWidgetsDomNode,
      suggest: {
        showIcons: true,
        showSnippets: false,
        showWords: true,
        showStatusBar: false,
        insertMode: "insert",
        fitWidthToDetails: true
      }
    };
    const widgetOptions = {
      isSimpleWidget: true,
      contributions: EditorExtensionsRegistry.getSomeEditorContributions([
        ContextMenuController.ID,
        SuggestController.ID,
        SnippetController2.ID,
        PlaceholderTextContribution.ID
      ])
    };
    this._editor = this._register(scopedInstantiationService.createInstance(
      CodeEditorWidget,
      editorContainer,
      editorOptions,
      widgetOptions
    ));
    this._editor.setModel(textModel);
    this._promptTemplatePlaceholder.value = new PromptTemplatePlaceholderController(this._editor, () => this._promptTypingAnimation.value?.complete());
    this._register(autorun((reader) => {
      this.options.session.read(reader);
      this._updateEditorFontFamily();
    }));
    this._register(dom.addDisposableListener(this._editorContainer, dom.EventType.PASTE, (e) => this._handleTerminalCommandPaste(e), true));
    SuggestController.get(this._editor)?.forceRenderingAbove();
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(AccessibilityVerbositySettingId.SessionsChat)) {
        this._editor.updateOptions({ ariaLabel: this._getAriaLabel() });
      }
    }));
    const dictationFocusKey = SessionsChatInputHasDictationFocus.bindTo(inputScopedContextKeyService);
    this._register(this._editor.onDidFocusEditorWidget(() => {
      dictationFocusKey.set(true);
      activeDictationComposer = this;
      this._onDidFocus.fire();
    }));
    this._register(this._editor.onDidBlurEditorWidget(() => {
      dictationFocusKey.set(false);
      if (activeDictationComposer === this) {
        activeDictationComposer = void 0;
      }
      this._onDidBlur.fire();
    }));
    this._register(toDisposable(() => {
      if (activeDictationComposer === this) {
        activeDictationComposer = void 0;
      }
    }));
    this._register(this._editor.onKeyDown((e) => {
      if (e.browserEvent.defaultPrevented) {
        return;
      }
      if (e.keyCode === KeyCode.Enter && !e.shiftKey && !e.ctrlKey && !e.altKey && this._promptTemplatePlaceholder.value?.replaceAtCursor()) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.keyCode === KeyCode.Enter && !e.shiftKey && !e.ctrlKey && !e.altKey) {
        if (this._editor.contextKeyService.getContextKeyValue("suggestWidgetVisible")) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        this._send();
      }
      if (this.options.supportsBackground && e.keyCode === KeyCode.Enter && !e.shiftKey && !e.ctrlKey && e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        this._send(true);
      }
      if (e.equals(KeyMod.CtrlCmd | KeyCode.Slash)) {
        e.preventDefault();
        e.stopPropagation();
        this._contextAttachments.showPicker(this.options.getContextFolderUri());
      }
    }));
    const updateHistoryNavigationEnablement = () => {
      const model = this._editor.getModel();
      const position = this._editor.getPosition();
      if (!model || !position) {
        return;
      }
      this._historyNavigationBackwardsEnablement.set(position.lineNumber === 1 && position.column === 1);
      this._historyNavigationForwardsEnablement.set(position.lineNumber === model.getLineCount() && position.column === model.getLineMaxColumn(position.lineNumber));
    };
    this._register(this._editor.onDidChangeCursorPosition(() => updateHistoryNavigationEnablement()));
    updateHistoryNavigationEnablement();
    let previousHeight = -1;
    this._register(this._editor.onDidContentSizeChange((e) => {
      if (!e.contentHeightChanged) {
        return;
      }
      const contentHeight = this._editor.getContentHeight();
      const clampedHeight = Math.min(MAX_EDITOR_HEIGHT, Math.max(this.options.minEditorHeight ?? MIN_EDITOR_HEIGHT, contentHeight));
      if (clampedHeight === previousHeight) {
        return;
      }
      previousHeight = clampedHeight;
      this._editorContainer.style.height = `${clampedHeight}px`;
      this._editor.layout();
    }));
    this._register(this._scopedInstantiationService.createInstance(SlashCommandHandler, this._editor));
    this._register(this.instantiationService.createInstance(
      VariableCompletionHandler,
      this._editor,
      this._contextAttachments,
      () => this.options.getContextFolderUri()
    ));
    this._register(this.instantiationService.createInstance(
      SessionReferenceCompletionHandler,
      this._editor,
      this._contextAttachments
    ));
    this._agentHostInputCompletionHandler = this._register(this._scopedInstantiationService.createInstance(
      AgentHostInputCompletionHandler,
      this._editor,
      this._contextAttachments
    ));
    this._register(this._editor.onDidChangeModelContent(() => {
      this._updateDraftState();
      this._updateSendButtonState();
      this._updateEditorFontFamily();
      this._promptOptionsWidget.value?.setInputValue(this._editor.getValue());
    }));
  }
  /**
   * The input is monospace only while a terminal command is being composed:
   * the attached session advertises a prefix AND the current input begins with
   * it. Otherwise it uses the normal new-chat input font.
   */
  _updateEditorFontFamily() {
    const isCommand = isTerminalCommandInput(this._editor.getModel()?.getLineContent(1) || "", this._getTerminalCommandPrefix());
    this._editor.updateOptions({ fontFamily: isCommand ? EDITOR_FONT_DEFAULTS.fontFamily : NEW_CHAT_INPUT_FONT_FAMILY });
  }
  _createAttachButton(container) {
    const attachButton = dom.append(container, dom.$(".sessions-chat-attach-button"));
    const attachButtonLabel = localize("addContext", "Add Context...");
    attachButton.tabIndex = 0;
    attachButton.role = "button";
    attachButton.ariaLabel = attachButtonLabel;
    this._register(this.hoverService.setupDelayedHover(attachButton, {
      content: attachButtonLabel,
      position: { hoverPosition: HoverPosition.BELOW },
      appearance: { showPointer: true }
    }));
    dom.append(attachButton, renderIcon(Codicon.addCompact));
    this._register(dom.addDisposableListener(attachButton, dom.EventType.CLICK, () => {
      this._contextAttachments.showPicker(this.options.getContextFolderUri());
    }));
  }
  _createInputToolbar(container) {
    const toolbar = dom.append(container, dom.$(".sessions-chat-toolbar"));
    let dictationActionVisible = false;
    let voiceActionCount = 0;
    const updateVoiceInputActionBorder = () => {
      toolbar.classList.toggle("sessions-chat-voice-input-actions-multiple", Number(dictationActionVisible) + voiceActionCount > 1);
    };
    this._createAttachButton(toolbar);
    const configContainer = dom.append(toolbar, dom.$(".sessions-chat-config-toolbar"));
    this._register(this._scopedInstantiationService.createInstance(MenuWorkbenchToolBar, configContainer, Menus.NewSessionConfig, {
      hiddenItemStrategy: HiddenItemStrategy.NoHide,
      actionViewItemProvider: (action) => {
        if (action.id === "sessions.modelPicker") {
          const picker = this._scopedInstantiationService.createInstance(ModelPicker, this._compactModelPicker);
          return new ModelPickerActionViewItem(picker);
        }
        return void 0;
      }
    }));
    dom.append(toolbar, dom.$(".sessions-chat-toolbar-spacer"));
    try {
      this._createSpeechToTextButton(toolbar, (visible) => {
        dictationActionVisible = visible;
        updateVoiceInputActionBorder();
      });
    } catch (error) {
      this.logService.error("Failed to create new-session dictation control:", error);
    }
    const voiceContainer = dom.append(toolbar, dom.$(".sessions-chat-voice-toolbar"));
    try {
      this._register(this.instantiationService.createInstance(NewChatVoiceController, {
        toolbarContainer: voiceContainer,
        inputContainer: container,
        composer: this,
        onDidChangeActions: (actionCount) => {
          voiceActionCount = actionCount;
          updateVoiceInputActionBorder();
        }
      }));
    } catch (error) {
      this.logService.error("Failed to create new-session voice controls:", error);
    }
    try {
      this._createVoiceInputModePill(toolbar, container);
    } catch (error) {
      this.logService.error("Failed to create new-session voice input mode pill:", error);
    }
    this._loadingSpinner = dom.append(toolbar, dom.$(".sessions-chat-loading-spinner"));
    const loadingIcon = dom.append(this._loadingSpinner, renderIcon(ThemeIcon.modify(Codicon.loading, "spin")));
    loadingIcon.setAttribute("aria-hidden", "true");
    this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), this._loadingSpinner, localize("loading", "Loading...")));
    this._loadingSpinner.classList.toggle("visible", this.options.loading.get());
    if (this.options.renderSendButton !== false) {
      const sendButtonContainer = dom.append(toolbar, dom.$(".sessions-chat-send-button"));
      const sendButton = this._sendButton = this._register(new Button(sendButtonContainer, {
        secondary: true,
        title: this.options.supportsBackground ? localize("sendWithBackgroundHint", "Send (Alt-click to start in the background)") : localize("send", "Send"),
        ariaLabel: localize("send", "Send")
      }));
      sendButton.icon = Codicon.arrowUpCompact;
      this._register(sendButton.onDidClick((e) => this._send(!!this.options.supportsBackground && !!e?.altKey)));
    }
    updateVoiceInputActionBorder();
  }
  _createVoiceInputModePill(toolbar, inputContainer) {
    const pillContainer = dom.append(toolbar, dom.$(".sessions-chat-voice-input-mode"));
    const isVoiceInputActive = derived(this, (reader) => isEqual(this.newChatVoiceTargetService.currentVoiceInputResource.read(reader), NEW_CHAT_VOICE_SENTINEL));
    const isVoiceSessionActive = derived(this, (reader) => isNewChatVoiceSessionActive(
      this.voiceSessionController.isConnected.read(reader),
      this.voiceSessionController.isConnecting.read(reader),
      this.voiceSessionController.targetSession.read(reader),
      this.voiceSessionController.hasDraftTarget.read(reader)
    ));
    const action = toAction({
      id: ChatVoiceInputModeAction.ID,
      label: localize("voiceInputMode", "Voice Input Mode"),
      run: () => {
      }
    });
    const pill = this._register(this._scopedInstantiationService.createInstance(VoiceInputModeActionViewItem, action, {
      // Dictation must target this composer's editor, not the last focused
      // chat widget (this composer isn't an `IChatWidget`).
      toggleDictation: () => {
        void this.toggleDictation();
      },
      isActive: isVoiceInputActive,
      isVoiceActive: isVoiceSessionActive
    }));
    pill.render(pillContainer);
    this._register(autorun((reader) => {
      const dict = this.voiceInputModeService.dictationAvailable.read(reader);
      const voice = this.voiceInputModeService.voiceAvailable.read(reader);
      const handsFree = this.voiceInputModeService.handsFree.read(reader);
      const connected = isVoiceSessionActive.read(reader) && this.voiceSessionController.isConnected.read(reader);
      const pillActive = dict && voice || voice && !dict && !handsFree && connected;
      pillContainer.classList.toggle("hidden", !pillActive);
      inputContainer.classList.toggle("voice-input-mode-pill", pillActive);
    }));
  }
  _createSpeechToTextButton(container, onDidChangeVisibility) {
    const sttService = this.chatSpeechToTextService;
    const button = dom.append(container, dom.$(".sessions-chat-stt-button"));
    button.tabIndex = 0;
    button.role = "button";
    const micLabel = localize("sessionsStt.dictate", "Dictate (Speech to Text)");
    const stopLabel = localize("sessionsStt.stop", "Stop Dictation");
    this._register(this.hoverService.setupDelayedHover(button, () => ({
      // While the model prepares, surface the download/connecting hover
      // (which invites the user to click to cancel) so this composer matches
      // the main chat toolbar affordance. Idle gets the richer description
      // naming the configured dictation model.
      content: sttService.currentSurface === "chat" && sttService.isPreparingModel ? getDictationDownloadHoverMarkdown(sttService) : isDictationActiveOnSurface(sttService, "chat") ? stopLabel : getDictationHoverMarkdown(micLabel, this.configurationService),
      position: { hoverPosition: HoverPosition.BELOW },
      appearance: { showPointer: true }
    })));
    const downloadRing = this._register(new MutableDisposable());
    const renderState = () => {
      const active = isDictationActiveOnSurface(sttService, "chat");
      const preparing = active && sttService.isPreparingModel;
      const recording = active && sttService.state === ChatSpeechToTextState.Recording;
      dom.clearNode(button);
      downloadRing.clear();
      if (preparing) {
        if (sttService.isDownloadingModel) {
          dom.append(button, renderIcon(Codicon.micDownloadCompact));
          downloadRing.value = new DictationDownloadRing(button, sttService);
        } else {
          dom.append(button, renderIcon(ThemeIcon.modify(Codicon.loadingCompact, "spin")));
        }
      } else {
        dom.append(button, renderIcon(recording ? Codicon.micFilled : Codicon.mic));
      }
      button.classList.toggle("recording", recording && !preparing);
      button.classList.toggle("preparing", preparing);
      button.ariaLabel = preparing ? localize("sessionsStt.cancelPreparing", "Cancel Dictation. {0}", getDictationPreparingLabel(sttService)) : active ? stopLabel : micLabel;
    };
    renderState();
    this._register(sttService.onDidChangeState(renderState));
    this._register(sttService.onDidChangePreparingModel(renderState));
    this._register(sttService.onDidChangeDownloadingModel(renderState));
    this._register(setupDictationMicGlow(button, sttService, this.accessibilityService, void 0, this.themeService));
    const updateVisibility = () => {
      const voiceActive = isNewChatVoiceSessionActive(
        this.voiceSessionController.isConnected.get(),
        this.voiceSessionController.isConnecting.get(),
        this.voiceSessionController.targetSession.get(),
        this.voiceSessionController.hasDraftTarget.get()
      );
      const dict = this.voiceInputModeService.dictationAvailable.get();
      const voice = this.voiceInputModeService.voiceAvailable.get();
      const handsFree = this.voiceInputModeService.handsFree.get();
      const sessionActive = this.voiceSessionController.isConnected.get();
      const pillActive = dict && voice || voice && !dict && !handsFree && sessionActive;
      const buttonShown = this.configurationService.getValue(DictationSettingId.ShowButton) !== false;
      const visible = sttService.isConfigured && !voiceActive && !pillActive && buttonShown;
      button.classList.toggle("hidden", !visible);
      onDidChangeVisibility(visible);
    };
    updateVisibility();
    this._register(autorun((reader) => {
      this.voiceSessionController.isConnected.read(reader);
      this.voiceSessionController.isConnecting.read(reader);
      this.voiceSessionController.targetSession.read(reader);
      this.voiceSessionController.hasDraftTarget.read(reader);
      this.voiceInputModeService.dictationAvailable.read(reader);
      this.voiceInputModeService.voiceAvailable.read(reader);
      this.voiceInputModeService.handsFree.read(reader);
      updateVisibility();
    }));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("dictation.enabled") || e.affectsConfiguration("dictation.model") || e.affectsConfiguration(DictationSettingId.ShowButton)) {
        updateVisibility();
      }
    }));
    const toggle = () => this.toggleDictation();
    this._register(Gesture.addTarget(button));
    [dom.EventType.CLICK, TouchEventType.Tap].forEach((eventType) => {
      this._register(dom.addDisposableListener(button, eventType, (e) => {
        dom.EventHelper.stop(e);
        void toggle();
      }));
    });
    this._register(dom.addDisposableListener(button, dom.EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space)) {
        dom.EventHelper.stop(event, true);
        void toggle();
      }
    }));
    this._register(addMicButtonContextMenuListener(
      button,
      () => getDictationContextMenuActions(this.commandService, this.configurationService, this.keybindingService, TOGGLE_DICTATION_COMMAND_ID),
      this.contextMenuService
    ));
  }
  /**
   * Toggle dictation into this composer's editor. Shared by the mic button and
   * the Cmd/Ctrl+I chord ({@link TOGGLE_DICTATION_COMMAND_ID}); the shared
   * Dictate action can't target this composer since it isn't an `IChatWidget`.
   */
  async toggleDictation() {
    if (!this._editor) {
      return;
    }
    await runDictationShortcut({
      speechService: this.chatSpeechToTextService,
      keybindingService: this.keybindingService,
      logService: this.logService,
      onboardingService: this.dictationOnboardingService
    }, TOGGLE_DICTATION_COMMAND_ID, this._editor);
  }
  // --- Input History (IHistoryNavigationWidget) ---
  showPreviousValue() {
    if (this._history.isAtStart()) {
      return;
    }
    if (this._draftState?.inputText || this._draftState?.attachments.length) {
      this._history.overlay(this._toHistoryEntry(this._draftState));
    }
    this._navigateHistory(true);
  }
  showNextValue() {
    if (this._history.isAtEnd()) {
      return;
    }
    if (this._draftState?.inputText || this._draftState?.attachments.length) {
      this._history.overlay(this._toHistoryEntry(this._draftState));
    }
    this._navigateHistory(false);
  }
  _updateDraftState() {
    this._draftState = {
      inputText: this._editor?.getModel()?.getValue() ?? "",
      attachments: [...this._contextAttachments.attachments]
    };
  }
  _toHistoryEntry(draft) {
    return {
      ...draft,
      mode: { id: ChatModeKind.Agent, kind: ChatModeKind.Agent },
      selectedModel: void 0,
      selections: [],
      contrib: {}
    };
  }
  _navigateHistory(previous) {
    const entry = previous ? this._history.previous() : this._history.next();
    const inputText = entry?.inputText ?? "";
    if (entry) {
      this._editor?.getModel()?.setValue(inputText);
      this._contextAttachments.setAttachments(entry.attachments);
    }
    aria.status(inputText);
    if (previous) {
      this._editor.setPosition({ lineNumber: 1, column: 1 });
    } else {
      const model = this._editor.getModel();
      if (model) {
        const lastLine = model.getLineCount();
        this._editor.setPosition({ lineNumber: lastLine, column: model.getLineMaxColumn(lastLine) });
      }
    }
  }
  // --- Send ---
  async submit(background = false) {
    return this._send(background);
  }
  async _send(background = false) {
    const rawQuery = this._editor.getModel()?.getValue() ?? "";
    const query = rawQuery.trim();
    const queryOffset = rawQuery.length - rawQuery.trimStart().length;
    const hasSendableAttachment = this._contextAttachments.attachments.some(isExplicitFileOrImageVariableEntry);
    const hasAdditionalSendContent = this.options.hasAdditionalSendContent?.get() ?? false;
    if (!query && !hasSendableAttachment && !hasAdditionalSendContent || this._sending) {
      return false;
    }
    if (!this._canSendRequest.get()) {
      return false;
    }
    notifyDictationSubmitted(this._editor);
    const session = this.options.session.get();
    if (!hasAdditionalSendContent && session && await this.chatSubmitRequestHandlerService.tryHandle({
      sessionResource: session.resource,
      providerId: session.providerId,
      sessionId: session.sessionId,
      input: query
    })) {
      this._editor.getModel()?.setValue("");
      return true;
    }
    const attachments = this._agentHostInputCompletionHandler?.getAttachmentsForSend(query, queryOffset) ?? [...this._contextAttachments.attachments];
    const attachedContext = attachments.length > 0 ? attachments : void 0;
    const request = query;
    if (this._draftState) {
      this._history.append(this._toHistoryEntry(this._draftState));
    }
    this._clearDraftState();
    this._sending = true;
    this._editor.updateOptions({ readOnly: true });
    this._updateSendButtonState();
    this._updateInputLoadingState();
    let sent = false;
    try {
      sent = await this.options.sendRequest({ query: request, attachments: attachedContext, background });
      if (!sent) {
        return false;
      }
      this._contextAttachments.clear();
      this._editor.getModel()?.setValue("");
    } catch (e) {
      this.logService.error("Failed to send request:", e);
      return false;
    } finally {
      this._sending = false;
      this._editor.updateOptions({ readOnly: false });
      this._updateDraftState();
      this._updateSendButtonState();
      this._updateInputLoadingState();
    }
    return sent;
  }
  _updateSendButtonState() {
    if (!this._sendButton) {
      return;
    }
    const hasText = !!this._editor?.getModel()?.getValue().trim();
    const hasSendableAttachment = this._contextAttachments.attachments.some(isExplicitFileOrImageVariableEntry);
    const hasAdditionalSendContent = this.options.hasAdditionalSendContent?.get() ?? false;
    this._sendButton.enabled = !this._sending && (hasText || hasSendableAttachment || hasAdditionalSendContent) && this._canSendRequest.get();
  }
  _restoreState() {
    const draft = this._getDraftState();
    if (draft) {
      this._editor?.getModel()?.setValue(draft.inputText);
      if (draft.attachments?.length) {
        this._contextAttachments.setAttachments(draft.attachments.map(IChatRequestVariableEntry.fromExport));
      }
    }
  }
  _getDraftState() {
    const raw = this.storageService.get(STORAGE_KEY_DRAFT_STATE, StorageScope.WORKSPACE);
    if (!raw) {
      return void 0;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return void 0;
    }
  }
  _clearDraftState() {
    this._draftState = { inputText: "", attachments: [] };
    this.storageService.store(STORAGE_KEY_DRAFT_STATE, JSON.stringify(this._draftState), StorageScope.WORKSPACE, StorageTarget.MACHINE);
  }
  saveState() {
    if (this._draftState) {
      const state = {
        ...this._draftState,
        attachments: this._draftState.attachments.map(IChatRequestVariableEntry.toExport)
      };
      this.storageService.store(STORAGE_KEY_DRAFT_STATE, JSON.stringify(state), StorageScope.WORKSPACE, StorageTarget.MACHINE);
    }
  }
  layout(_height, width) {
    this._compactModelPicker.set(width < NewChatInputWidget.compactModelPickerWidth, void 0);
    this._editor?.layout();
  }
  focus() {
    this._editor?.focus();
  }
  async animatePrompt(text, durationMs, placeholder, token, expectedValue = "") {
    const editor = this._editor;
    const model = editor?.getModel();
    if (!editor || !model || !text || model.getValue() !== expectedValue || token.isCancellationRequested) {
      return false;
    }
    this._promptTypingAnimation.clear();
    if (expectedValue) {
      model.setValue("");
    }
    this._promptTemplatePlaceholder.value?.setPlaceholder(placeholder);
    const targetWindow = dom.getWindow(this._editorContainer);
    const effectiveDuration = this.accessibilityService.isMotionReduced() || this.accessibilityService.isScreenReaderOptimized() ? 0 : durationMs;
    const animation = animatePromptTyping({
      getValue: () => model.getValue(),
      setValue: (value) => {
        model.setValue(value);
        const lastLine = model.getLineCount();
        editor.setPosition({ lineNumber: lastLine, column: model.getLineMaxColumn(lastLine) });
      },
      onDidChange: (listener) => model.onDidChangeContent(() => listener())
    }, text, effectiveDuration, {
      now: () => targetWindow.performance.now(),
      schedule: (callback) => dom.scheduleAtNextAnimationFrame(targetWindow, callback)
    });
    this._promptTypingAnimation.value = animation;
    const cancellationListener = token.onCancellationRequested(() => {
      if (this._promptTypingAnimation.value === animation) {
        this._promptTypingAnimation.clear();
      } else {
        animation.dispose();
      }
    });
    try {
      return (await animation.result).didWrite;
    } finally {
      cancellationListener.dispose();
      if (this._promptTypingAnimation.value === animation) {
        this._promptTypingAnimation.clear();
      }
    }
  }
  _replacePrompt(text, placeholder, expectedValue) {
    const model = this._editor.getModel();
    if (!model || model.getValue() !== expectedValue) {
      return false;
    }
    this._promptTypingAnimation.clear();
    this._promptTemplatePlaceholder.value?.setPlaceholder(placeholder);
    this._editor.pushUndoStop();
    const edited = this._editor.executeEdits("sessions.promptOption", [{ range: model.getFullModelRange(), text }]);
    if (!edited) {
      return false;
    }
    this._editor.pushUndoStop();
    const lastLine = model.getLineCount();
    this._editor.setPosition({ lineNumber: lastLine, column: model.getLineMaxColumn(lastLine) });
    return true;
  }
  showPromptOptions(state) {
    this._promptOptionsState = state;
    const widget = this._promptOptionsWidget.value;
    if (!widget) {
      return false;
    }
    widget.setState(state);
    widget.setInputValue(this._editor.getValue());
    return true;
  }
  setPromptOptionsResolver(resolver) {
    this._promptOptionsResolver = resolver;
  }
  preparePromptOptionsRefresh() {
    if (!this._promptOptionsResolver) {
      return false;
    }
    this._cancelPromptOptionsRefresh();
    this.showPromptOptions({ kind: "loading" });
    return true;
  }
  clearPromptOptions() {
    this._cancelPromptOptionsRefresh();
    this.showPromptOptions(void 0);
  }
  _cancelPromptOptionsRefresh() {
    const shouldClearInput = this._promptOptionsWidget.value?.shouldClearInputForRefresh() ?? false;
    this._promptTypingAnimation.clear();
    this._promptOptionsRefresh.value?.cancel();
    this._promptOptionsRefresh.clear();
    if (shouldClearInput) {
      this._promptTemplatePlaceholder.value?.setPlaceholder(void 0);
      this._editor.getModel()?.setValue("");
    }
  }
  async refreshPromptOptions(token = CancellationToken.None) {
    const resolver = this._promptOptionsResolver;
    if (!resolver) {
      return false;
    }
    this.preparePromptOptionsRefresh();
    const cts = new CancellationTokenSource(token);
    this._promptOptionsRefresh.value = cts;
    let state;
    try {
      state = await resolver(cts.token);
    } catch (error) {
      if (this._promptOptionsRefresh.value === cts) {
        this._promptOptionsRefresh.clear();
        if (cts.token.isCancellationRequested) {
          this.showPromptOptions(void 0);
          return false;
        }
      }
      throw error;
    }
    if (this._promptOptionsRefresh.value !== cts) {
      return false;
    }
    if (cts.token.isCancellationRequested) {
      this._promptOptionsRefresh.clear();
      this.showPromptOptions(void 0);
      return false;
    }
    this._promptOptionsRefresh.clear();
    return this.showPromptOptions(state);
  }
  dispose() {
    this._cancelPromptOptionsRefresh();
    super.dispose();
  }
  /** See {@link INewChatVoiceComposer.routesWhileSessionActive}. */
  get routesWhileSessionActive() {
    return this.options.voiceRoutesWhileSessionActive === true;
  }
  prefillInput(text) {
    const editor = this._editor;
    const model = editor?.getModel();
    if (editor && model) {
      model.setValue(text);
      const lastLine = model.getLineCount();
      const maxColumn = model.getLineMaxColumn(lastLine);
      editor.setPosition({ lineNumber: lastLine, column: maxColumn });
      editor.focus();
    }
  }
  sendQuery(text) {
    if (this._sending) {
      return;
    }
    const model = this._editor?.getModel();
    if (model) {
      const combined = combineVoiceInput(model.getValue(), text);
      model.setValue(combined);
      this._send();
    }
  }
  attach(uris) {
    this._contextAttachments.addAttachments(...uris.map((uri) => toFileVariableEntry(uri)));
  }
  getVoiceModels() {
    return this._sessionModelSelectionModel.state.get().models;
  }
  selectVoiceModel(identifier) {
    return this._sessionModelSelectionModel.selectModel(identifier);
  }
};
NewChatInputWidget = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IModelService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, ILogService),
  __decorateParam(6, IHoverService),
  __decorateParam(7, IStorageService),
  __decorateParam(8, IDialogService),
  __decorateParam(9, IKeybindingService),
  __decorateParam(10, IWorkbenchLayoutService),
  __decorateParam(11, IChatSessionsService),
  __decorateParam(12, IChatSpeechToTextService),
  __decorateParam(13, IDictationOnboardingService),
  __decorateParam(14, IChatSubmitRequestHandlerService),
  __decorateParam(15, IContextMenuService),
  __decorateParam(16, ICommandService),
  __decorateParam(17, IVoiceSessionController),
  __decorateParam(18, IVoiceInputModeService),
  __decorateParam(19, IAccessibilityService),
  __decorateParam(20, IVoiceModeOnboardingService),
  __decorateParam(21, INewChatVoiceTargetService),
  __decorateParam(22, IThemeService)
], NewChatInputWidget);
export {
  NewChatInputWidget
};
