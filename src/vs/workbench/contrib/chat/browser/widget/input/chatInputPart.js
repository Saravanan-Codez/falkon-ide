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
import * as dom from "../../../../../../base/browser/dom.js";
import { addDisposableListener } from "../../../../../../base/browser/dom.js";
import { DEFAULT_FONT_FAMILY } from "../../../../../../base/browser/fonts.js";
import { hasModifierKeys } from "../../../../../../base/browser/keyboardEvent.js";
import { ActionViewItem, BaseActionViewItem } from "../../../../../../base/browser/ui/actionbar/actionViewItems.js";
import * as aria from "../../../../../../base/browser/ui/aria/aria.js";
import { ButtonWithIcon } from "../../../../../../base/browser/ui/button/button.js";
import { createInstantHoverDelegate } from "../../../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { equals as arraysEqual } from "../../../../../../base/common/arrays.js";
import { DeferredPromise, RunOnceScheduler } from "../../../../../../base/common/async.js";
import { isDefined } from "../../../../../../base/common/types.js";
import { CancellationToken } from "../../../../../../base/common/cancellation.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { Emitter, Event } from "../../../../../../base/common/event.js";
import { onUnexpectedError } from "../../../../../../base/common/errors.js";
import { Iterable } from "../../../../../../base/common/iterator.js";
import { KeyCode } from "../../../../../../base/common/keyCodes.js";
import { Lazy } from "../../../../../../base/common/lazy.js";
import { Disposable, DisposableMap, DisposableStore, MutableDisposable, toDisposable } from "../../../../../../base/common/lifecycle.js";
import { ResourceSet } from "../../../../../../base/common/map.js";
import { MarshalledId } from "../../../../../../base/common/marshallingIds.js";
import { Schemas } from "../../../../../../base/common/network.js";
import { mixin } from "../../../../../../base/common/objects.js";
import { autorun, constObservable, derived, derivedOpts, observableFromEvent, observableValue, transaction } from "../../../../../../base/common/observable.js";
import { isMacintosh } from "../../../../../../base/common/platform.js";
import { isEqual } from "../../../../../../base/common/resources.js";
import { ScrollbarVisibility } from "../../../../../../base/common/scrollable.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { URI } from "../../../../../../base/common/uri.js";
import { EditorExtensionsRegistry } from "../../../../../../editor/browser/editorExtensions.js";
import { CodeEditorWidget } from "../../../../../../editor/browser/widget/codeEditor/codeEditorWidget.js";
import { EditorOptions } from "../../../../../../editor/common/config/editorOptions.js";
import { EDITOR_FONT_DEFAULTS } from "../../../../../../editor/common/config/fontInfo.js";
import { Range } from "../../../../../../editor/common/core/range.js";
import { isLocation } from "../../../../../../editor/common/languages.js";
import { IModelService } from "../../../../../../editor/common/services/model.js";
import { ITextModelService } from "../../../../../../editor/common/services/resolverService.js";
import { CopyPasteController } from "../../../../../../editor/contrib/dropOrPasteInto/browser/copyPasteController.js";
import { DropIntoEditorController } from "../../../../../../editor/contrib/dropOrPasteInto/browser/dropIntoEditorController.js";
import { ContentHoverController } from "../../../../../../editor/contrib/hover/browser/contentHoverController.js";
import { GlyphHoverController } from "../../../../../../editor/contrib/hover/browser/glyphHoverController.js";
import { LinkDetector } from "../../../../../../editor/contrib/links/browser/links.js";
import { SuggestController } from "../../../../../../editor/contrib/suggest/browser/suggestController.js";
import { localize } from "../../../../../../nls.js";
import { IAccessibilityService } from "../../../../../../platform/accessibility/common/accessibility.js";
import { MenuWorkbenchButtonBar } from "../../../../../../platform/actions/browser/buttonbar.js";
import { MenuEntryActionViewItem } from "../../../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { HiddenItemStrategy, MenuWorkbenchToolBar } from "../../../../../../platform/actions/browser/toolbar.js";
import { MenuId, MenuItemAction } from "../../../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IDialogService } from "../../../../../../platform/dialogs/common/dialogs.js";
import { IFileService } from "../../../../../../platform/files/common/files.js";
import { registerAndCreateHistoryNavigationContext } from "../../../../../../platform/history/browser/contextScopedHistoryWidget.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../../../platform/instantiation/common/serviceCollection.js";
import { IKeybindingService } from "../../../../../../platform/keybinding/common/keybinding.js";
import { canLog, ILogService, LogLevel } from "../../../../../../platform/log/common/log.js";
import { observableMemento } from "../../../../../../platform/observable/common/observableMemento.js";
import { bindContextKey } from "../../../../../../platform/observable/common/platformObservableUtils.js";
import { IProductService } from "../../../../../../platform/product/common/productService.js";
import { IVoiceModeOnboardingService } from "../../../../agentsVoice/browser/voiceModeOnboarding.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../../platform/storage/common/storage.js";
import { IThemeService } from "../../../../../../platform/theme/common/themeService.js";
import { ISharedWebContentExtractorService } from "../../../../../../platform/webContentExtractor/common/webContentExtractor.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../../../platform/workspace/common/workspace.js";
import { ISCMService } from "../../../../scm/common/scm.js";
import { IWorkbenchLayoutService, Position } from "../../../../../services/layout/browser/layoutService.js";
import { IViewDescriptorService, ViewContainerLocation } from "../../../../../common/views.js";
import { ResourceLabels } from "../../../../../browser/labels.js";
import { IChatEntitlementService } from "../../../../../services/chat/common/chatEntitlementService.js";
import { ACTIVE_GROUP, IEditorService, SIDE_GROUP } from "../../../../../services/editor/common/editorService.js";
import { AccessibilityVerbositySettingId } from "../../../../accessibility/browser/accessibilityConfiguration.js";
import { AccessibilityCommandId } from "../../../../accessibility/common/accessibilityCommands.js";
import { getSimpleCodeEditorWidgetOptions, getSimpleEditorOptions, setupSimpleEditorSelectionStyling } from "../../../../codeEditor/browser/simpleEditorOptions.js";
import { ChatContextKeys } from "../../../common/actions/chatContextKeys.js";
import { ChatRequestVariableSet, getImageAttachmentLimit, isAgentHostCompletionVariableEntry, isBrowserViewVariableEntry, isElementVariableEntry, isExplicitFileOrImageVariableEntry, isImageVariableEntry, isNotebookOutputVariableEntry, isPasteVariableEntry, isPromptFileVariableEntry, isPromptTextVariableEntry, isSCMHistoryItemChangeRangeVariableEntry, isSCMHistoryItemChangeVariableEntry, isSCMHistoryItemVariableEntry, isStringVariableEntry, OmittedState } from "../../../common/attachments/chatVariableEntries.js";
import { ChatMode, getModeNameForTelemetry, IChatModeService } from "../../../common/chatModes.js";
import { IChatSessionsService, isAgentHostTarget, isIChatSessionFileChange2, localChatSessionType, SessionType } from "../../../common/chatSessionsService.js";
import { getSelectedModelStorageKey, getStoredSelectedModel, storeSelectedModel } from "../../../common/chatSelectedModel.js";
import { ChatAgentLocation, ChatConfiguration, ChatModeKind, ChatPermissionLevel, isChatPermissionLevel } from "../../../common/constants.js";
import { isAutoApprovePolicyRestricted, isAutoApproveValuePolicyRestricted } from "../../../common/agentHostConfigPolicy.js";
import { ModifiedFileEntryState } from "../../../common/editing/chatEditingService.js";
import { ILanguageModelChatMetadata, ILanguageModelsService } from "../../../common/languageModels.js";
import { ChatInputModelSelectionController } from "./chatInputModelSelectionController.js";
import { ChatModelConfigurationStore } from "./chatModelConfigurationStore.js";
import { ChatModelSelectionDiagnostics } from "./chatModelSelectionDiagnostics.js";
import { deserializeUntitledInputAttachments, deserializeUntitledInputState, serializeUntitledInputAttachments, serializeUntitledInputState } from "./chatInputStatePersistence.js";
import { ChatInputStateOrigin, logChangesToStateModel } from "../../../common/model/chatModel.js";
import { filterModelsForSession, hasModelsTargetingSession, isModelHiddenInPicker, isNewConversation, mergeModelsWithCache, shouldResetOnModelListChange } from "./chatInputModelUtils.js";
import { getChatSessionType, LocalChatSessionUri } from "../../../common/model/chatUri.js";
import { isResponseVM } from "../../../common/model/chatViewModel.js";
import { IChatAgentService } from "../../../common/participants/chatAgents.js";
import { ILanguageModelToolsService } from "../../../common/tools/languageModelToolsService.js";
import { ChatHistoryNavigator } from "../../../common/widget/chatWidgetHistoryService.js";
import { ChatEditingSessionSubmitAction, ChatSessionPrimaryPickerAction, ChatSubmitAction, OpenDelegationPickerAction, OpenModelPickerAction, OpenModePickerAction, OpenPermissionPickerAction, OpenSessionTargetPickerAction, OpenWorkspacePickerAction } from "../../actions/chatExecuteActions.js";
import { ChatVoiceInputModeAction, VoiceInputModeActionViewItem } from "../../voiceInputMode/voiceInputModeActionViewItem.js";
import { ChatSpeechToTextConnectingAction, ChatSpeechToTextPreparingAction, ToggleChatSpeechToTextAction } from "../../actions/chatSpeechToTextActions.js";
import { DictationActionViewItem } from "../../speechToText/dictationActionViewItem.js";
import { DictationDownloadActionViewItem } from "../../speechToText/dictationDownloadActionViewItem.js";
import { IDictationOnboardingService } from "../../speechToText/dictationOnboarding.js";
import { notifyDictationSubmitted } from "../../speechToText/dictationSession.js";
import { VoiceModeActionViewItem } from "../../voiceClient/voiceModeActionViewItem.js";
import { IVoiceSessionController } from "../../voiceClient/voiceSessionController.js";
import { AgentSessionProviders, getAgentSessionProvider } from "../../agentSessions/agentSessions.js";
import { getAgentSessionPullRequestContextValue } from "../../agentSessions/agentSessionsModel.js";
import { IAgentSessionsService } from "../../agentSessions/agentSessionsService.js";
import { ChatAttachmentModel } from "../../attachments/chatAttachmentModel.js";
import { IChatAttachmentWidgetRegistry } from "../../attachments/chatAttachmentWidgetRegistry.js";
import { DefaultChatAttachmentWidget, ElementChatAttachmentWidget, FileAttachmentWidget, ImageAttachmentWidget, BrowserViewAttachmentWidget, NotebookCellOutputChatAttachmentWidget, PasteAttachmentWidget, PromptFileAttachmentWidget, PromptTextAttachmentWidget, SCMHistoryItemAttachmentWidget, SCMHistoryItemChangeAttachmentWidget, SCMHistoryItemChangeRangeAttachmentWidget, TerminalCommandAttachmentWidget, ToolSetOrToolItemAttachmentWidget } from "../../attachments/chatAttachmentWidgets.js";
import { ChatImplicitContexts } from "../../attachments/chatImplicitContext.js";
import { ImplicitContextAttachmentWidget } from "../../attachments/implicitContextAttachment.js";
import { IChatWidgetService, isIChatResourceViewContext, isIChatViewViewContext } from "../../chat.js";
import { ChatEditingShowChangesAction, ViewPreviousEditsAction } from "../../chatEditing/chatEditingActions.js";
import { resizeImage } from "../../chatImageUtils.js";
import { ChatSessionPickerActionItem } from "../../chatSessions/chatSessionPickerActionItem.js";
import { AgentHostChatInputPicker, AgentHostChatInputPickerActionViewItem } from "../../agentSessions/agentHost/agentHostChatInputPicker.js";
import { getAgentHostPickerProperty, OpenAgentHostAutoApprovePickerAction, OpenAgentHostCodexApprovalsPickerAction, OpenAgentHostModePickerAction, OpenAgentHostPermissionModePickerAction, OpenAgentHostFolderPickerAction } from "../../agentSessions/agentHost/agentHostChatInputPicker.contribution.js";
import { AgentHostGenericConfigChips } from "../../agentSessions/agentHost/agentHostGenericConfigChips.js";
import { AgentHostFolderPickerActionItem } from "../../agentSessions/agentHost/agentHostFolderPickerActionItem.js";
import { IChatPhoneInputPresenter, MobileChatInputCombinedPickerActionItem } from "./chatPhoneInputPresenter.js";
import { IChatContextService } from "../../contextContrib/chatContextService.js";
import { ChatPlanReviewPart } from "../chatContentParts/chatPlanReviewPart.js";
import { ChatQuestionCarouselPart } from "../chatContentParts/chatQuestionCarouselPart.js";
import { ChatToolConfirmationCarouselPart } from "../chatContentParts/toolInvocationParts/chatToolConfirmationCarouselPart.js";
import { CollapsibleListPool } from "../chatContentParts/chatReferencesContentPart.js";
import { ChatTodoListWidget } from "../chatContentParts/chatTodoListWidget.js";
import { ChatArtifactsWidget } from "../chatArtifactsWidget.js";
import { handleTerminalCommandPaste, isTerminalCommandInput } from "../../chatTerminalCommandPaste.js";
import { ChatDragAndDrop } from "../chatDragAndDrop.js";
import { ChatFollowups } from "./chatFollowups.js";
import { IChatInputNotificationService } from "./chatInputNotificationService.js";
import { ChatGoalBannerWidget } from "./chatGoalBannerWidget.js";
import { ChatInputNotificationWidget } from "./chatInputNotificationWidget.js";
import { ChatSelectedTools } from "./chatSelectedTools.js";
import { DelegationSessionPickerActionItem } from "./delegationSessionPickerActionItem.js";
import { ModelPickerActionItem } from "./modelPicker/modelPickerActionItem.js";
import { isModeConsideredBuiltIn, ModePickerActionItem } from "./modePickerActionItem.js";
import { PermissionPickerActionItem } from "./permissionPickerActionItem.js";
import { SessionTypePickerActionItem } from "./sessionTargetPickerActionItem.js";
import { WorkspacePickerActionItem } from "./workspacePickerActionItem.js";
import { ChatContextUsageWidget } from "../../widgetHosts/viewPane/chatContextUsageWidget.js";
import { Target } from "../../../common/promptSyntax/promptTypes.js";
import { findLast } from "../../../../../../base/common/arraysFind.js";
import { ConfigureToolsAction } from "../../actions/chatToolActions.js";
import { InlineCompletionsController } from "../../../../../../editor/contrib/inlineCompletions/browser/controller/inlineCompletionsController.js";
import { PlaceholderTextContribution } from "../../../../../../editor/contrib/placeholderText/browser/placeholderTextContribution.js";
const $ = dom.$;
const INPUT_EDITOR_MAX_HEIGHT = 250;
const INPUT_EDITOR_LINE_HEIGHT = 20;
const INPUT_EDITOR_PADDING = { compact: { top: 2, bottom: 2 }, default: { top: 12, bottom: 12 } };
const CachedLanguageModelsKey = "chat.cachedLanguageModels.v2";
const CHAT_INPUT_PICKER_COLLAPSE_WIDTH = 280;
const PERMISSION_LEVEL_OPTION_ID = "permissionLevel";
var ChatWidgetLocation = /* @__PURE__ */ ((ChatWidgetLocation2) => {
  ChatWidgetLocation2["SidebarLeft"] = "sidebarLeft";
  ChatWidgetLocation2["SidebarRight"] = "sidebarRight";
  ChatWidgetLocation2["Panel"] = "panel";
  ChatWidgetLocation2["Editor"] = "editor";
  return ChatWidgetLocation2;
})(ChatWidgetLocation || {});
const LEGACY_SHARED_INPUT_STATE_TAGS = /* @__PURE__ */ new Set(["view", "editor", "quick"]);
function getInputStateStorageKey(widgetViewKindTag) {
  if (LEGACY_SHARED_INPUT_STATE_TAGS.has(widgetViewKindTag)) {
    return "chat.untitledInputState";
  }
  return `chat.untitledInputState.${widgetViewKindTag}`;
}
function createEmptyInputStateMemento(widgetViewKindTag) {
  return observableMemento({
    defaultValue: void 0,
    key: getInputStateStorageKey(widgetViewKindTag),
    toStorage: serializeUntitledInputState,
    fromStorage(value) {
      const obj = deserializeUntitledInputState(value);
      if (obj.selectedModel && !obj.selectedModel.metadata.isDefaultForLocation) {
        const oldIsDefault = obj.selectedModel.metadata.isDefault;
        const isDefaultForLocation = { [ChatAgentLocation.Chat]: Boolean(oldIsDefault) };
        mixin(obj.selectedModel.metadata, { isDefaultForLocation });
        delete obj.selectedModel.metadata.isDefault;
      }
      return obj;
    }
  });
}
const emptyInputAttachments = observableMemento({
  defaultValue: [],
  key: "chat.untitledInputAttachments",
  toStorage: serializeUntitledInputAttachments,
  fromStorage: deserializeUntitledInputAttachments
});
let ChatInputPart = class extends Disposable {
  constructor(location, options, styles, inline, modelService, instantiationService, contextKeyService, configurationService, keybindingService, accessibilityService, languageModelsService, logService, fileService, editorService, themeService, textModelResolverService, storageService, dialogService, agentService, sharedWebExtracterService, entitlementService, chatModeService, toolService, chatSessionsService, chatContextService, agentSessionsService, dictationOnboardingService, workspaceContextService, scmService, layoutService, viewDescriptorService, _chatAttachmentWidgetRegistry, chatInputNotificationService, chatPhoneInputPresenter, productService, voiceModeOnboardingService, chatWidgetService, voiceSessionController) {
    super();
    this.location = location;
    this.options = options;
    this.inline = inline;
    this.modelService = modelService;
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.configurationService = configurationService;
    this.keybindingService = keybindingService;
    this.accessibilityService = accessibilityService;
    this.languageModelsService = languageModelsService;
    this.logService = logService;
    this.fileService = fileService;
    this.editorService = editorService;
    this.themeService = themeService;
    this.textModelResolverService = textModelResolverService;
    this.storageService = storageService;
    this.dialogService = dialogService;
    this.agentService = agentService;
    this.sharedWebExtracterService = sharedWebExtracterService;
    this.entitlementService = entitlementService;
    this.chatModeService = chatModeService;
    this.toolService = toolService;
    this.chatSessionsService = chatSessionsService;
    this.chatContextService = chatContextService;
    this.agentSessionsService = agentSessionsService;
    this.dictationOnboardingService = dictationOnboardingService;
    this.workspaceContextService = workspaceContextService;
    this.scmService = scmService;
    this.layoutService = layoutService;
    this.viewDescriptorService = viewDescriptorService;
    this._chatAttachmentWidgetRegistry = _chatAttachmentWidgetRegistry;
    this.chatInputNotificationService = chatInputNotificationService;
    this.chatPhoneInputPresenter = chatPhoneInputPresenter;
    this.productService = productService;
    this.voiceModeOnboardingService = voiceModeOnboardingService;
    this.chatWidgetService = chatWidgetService;
    this.voiceSessionController = voiceSessionController;
    this._workingSetCollapsed = observableValue("chatInputPart.workingSetCollapsed", true);
    this._stableInputPartWidth = observableValue("chatInputPart.stableInputPartWidth", 0);
    this._chatInputTodoListWidget = this._register(new MutableDisposable());
    this._chatArtifactsWidget = this._register(new MutableDisposable());
    this._chatQuestionCarouselWidgets = this._register(new DisposableMap());
    this._questionCarouselResponseIds = /* @__PURE__ */ new Map();
    this._questionCarouselSessionResources = /* @__PURE__ */ new Map();
    this._chatPlanReviewWidgets = this._register(new DisposableMap());
    this._planReviewResponseIds = /* @__PURE__ */ new Map();
    this._planReviewSessionResources = /* @__PURE__ */ new Map();
    this._chatToolConfirmationCarousels = this._register(new DisposableMap());
    this._onDidChangeActiveConfirmationSubagent = this._register(new Emitter());
    this.onDidChangeActiveConfirmationSubagent = this._onDidChangeActiveConfirmationSubagent.event;
    this._chatEditingTodosDisposables = this._register(new DisposableStore());
    this._onDidLoadInputState = this._register(new Emitter());
    this.onDidLoadInputState = this._onDidLoadInputState.event;
    this._toolbarRelayoutScheduler = this._register(new RunOnceScheduler(() => {
      if (typeof this.cachedWidth === "number") {
        this.layout(this.cachedWidth);
      }
    }, 0));
    this._onDidFocus = this._register(new Emitter());
    this.onDidFocus = this._onDidFocus.event;
    this._onDidBlur = this._register(new Emitter());
    this.onDidBlur = this._onDidBlur.event;
    this._onDidChangeContext = this._register(new Emitter());
    this.onDidChangeContext = this._onDidChangeContext.event;
    this._onDidAcceptFollowup = this._register(new Emitter());
    this.onDidAcceptFollowup = this._onDidAcceptFollowup.event;
    this._onDidClickOverlay = this._register(new Emitter());
    this.onDidClickOverlay = this._onDidClickOverlay.event;
    this._indexOfLastAttachedContextDeletedWithKeyboard = -1;
    this._indexOfLastOpenedContext = -1;
    this._onDidChangeVisibility = this._register(new Emitter());
    this.inputEditorHeight = 0;
    this.followupsDisposables = this._register(new DisposableStore());
    this.overlayClickListener = this._register(new MutableDisposable());
    this.attachedContextDisposables = this._register(new MutableDisposable());
    this._notificationWidget = this._register(new MutableDisposable());
    this._goalBannerWidget = this._register(new MutableDisposable());
    this._onDidDismissGoalBanner = this._register(new Emitter());
    /** Fired when the user dismisses the autopilot goal banner. */
    this.onDidDismissGoalBanner = this._onDidDismissGoalBanner.event;
    this._contextUsageDisposables = this._register(new MutableDisposable());
    this.height = observableValue(this, 0);
    this._forceVisibleScrollbarUntilAccept = false;
    // Disposables for model observation
    this._modelSyncDisposables = this._register(new DisposableStore());
    this._currentChatModes = this._register(new MutableDisposable());
    // Flag to prevent circular updates between view and model
    this._isSyncingToOrFromInputModel = false;
    this.permissionWidgetDisposeListener = this._register(new MutableDisposable());
    this.chatSessionPickerWidgets = this._register(new DisposableMap());
    this._chatSessionOptionEmitters = this._register(new DisposableMap());
    /**
     * Map of option group ID to its context key.
     * Keys follow the pattern `chatSessionOption.<groupId>` and hold the currently selected option item ID.
     */
    this._optionContextKeys = /* @__PURE__ */ new Map();
    this._onDidChangeCurrentChatMode = this._register(new Emitter());
    this.onDidChangeCurrentChatMode = this._onDidChangeCurrentChatMode.event;
    this.inputUri = URI.parse(`${Schemas.vscodeChatInput}:input-${ChatInputPart._counter++}`);
    this._workingSetLinesAddedSpan = new Lazy(() => dom.$(".working-set-lines-added"));
    this._workingSetLinesRemovedSpan = new Lazy(() => dom.$(".working-set-lines-removed"));
    this._chatEditsActionsDisposables = this._register(new DisposableStore());
    this._chatEditsDisposables = this._register(new DisposableStore());
    this._renderingChatEdits = this._register(new MutableDisposable());
    this._attemptedWorkingSetEntriesCount = 0;
    this._chatSessionIsEmpty = false;
    this._pendingDelegationTargetObservable = observableValue(this, void 0);
    this._currentSessionTypeObservable = observableValue(this, void 0);
    this._currentSessionResourceObservable = observableValue(this, void 0);
    this._notificationModelTargetChatSessionType = derived(
      this,
      (reader) => this._pendingDelegationTargetObservable.read(reader) ?? this._currentSessionTypeObservable.read(reader) ?? this.getCurrentSessionType()
    );
    this._modelSelectionDiagnostics = new ChatModelSelectionDiagnostics(this.logService, this.storageService, () => ({
      surface: "workbench",
      location: this.location,
      modelTarget: this.getSelectedModelTarget(),
      sessionKey: this.getCurrentSessionType(),
      conversationKey: this._inputModelSessionResource?.toString(),
      metadata: { widgetViewKind: this.options.widgetViewKindTag }
    }));
    this._modelSelectionRuntime = {
      location: this.location,
      getCurrentModeKind: () => this.currentModeKind,
      getCurrentSessionType: () => this._currentSessionType ?? this.getCurrentSessionType(),
      isEmpty: () => !this._inputModel || this._chatSessionIsEmpty,
      getModels: (sessionType) => this.getModelsForSessionType(sessionType),
      getAllModels: () => this.getAllMergedModels(),
      requiresCustomModels: (sessionType) => this.chatSessionsService.requiresCustomModelsForSessionType(sessionType),
      getConfiguredModelValue: () => this.getConfiguredModelValue(),
      subscribeToModelChanges: (listener) => this.languageModelsService.onDidChangeLanguageModels(listener),
      getBoundConversationKey: () => this._inputModelSessionResource?.toString(),
      getVisibleConversationKey: () => this._widget?.viewModel?.model.sessionResource.toString(),
      restoreModelConfiguration: (modelId, configuration) => this.restoreModelConfiguration(modelId, configuration),
      applyModel: () => {
        if (this.cachedWidth) {
          this.layout(this.cachedWidth);
        }
        this._syncInputStateToModel();
      }
    };
    this._modelSelectionController = this._register(new ChatInputModelSelectionController(this._modelSelectionRuntime, this._modelSelectionDiagnostics));
    this._currentLanguageModel = this._modelSelectionController.currentModel;
    this._register(this.storageService.onDidChangeValue(StorageScope.PROFILE, void 0, this._store)((event) => {
      this._modelSelectionDiagnostics.logStorageChange(event, this._currentLanguageModel.get()?.identifier);
    }));
    this._modelConfigStore = this._register(new ChatModelConfigurationStore(
      () => this.getModelConfigurationStorageKey(),
      this.languageModelsService,
      this.storageService
    ));
    this._syncTextDebounced = this._register(new RunOnceScheduler(() => {
      logChangesToStateModel(this._inputModel, `[DEBOUNCE] _syncTextDebounced fired -> _syncInputStateToModel in ${this._currentSessionKey}`, void 0, this._inputModel?.state.get(), this.logService);
      this._syncInputStateToModel();
    }, 150));
    this._emptyInputState = this._register(createEmptyInputStateMemento(this.options.widgetViewKindTag)(StorageScope.WORKSPACE, StorageTarget.USER, this.storageService));
    this._emptyInputAttachments = this._register(emptyInputAttachments(StorageScope.WORKSPACE, StorageTarget.USER, this.storageService));
    this._contextResourceLabels = this._register(this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this._onDidChangeVisibility.event }));
    this._currentModeObservable = observableValue("currentMode", this.options.defaultMode ?? ChatMode.Agent);
    const localModes = this.chatModeService.createModes(LocalChatSessionUri.getNewSessionUri());
    this._currentChatModes.value = localModes;
    this._currentChatModesObservable = observableValue("currentChatModes", localModes);
    this._currentPermissionLevel = observableValue("permissionLevel", this.getDefaultPermissionLevel());
    this._register(this.editorService.onDidActiveEditorChange(() => {
      this._indexOfLastOpenedContext = -1;
      this.refreshChatSessionPickers();
    }));
    this._register(this.chatSessionsService.onDidChangeSessionOptions((e) => {
      const sessionResource = this._widget?.viewModel?.model.sessionResource;
      if (sessionResource && isEqual(sessionResource, e.sessionResource)) {
        this.refreshChatSessionPickers();
      }
    }));
    this._register(this.chatSessionsService.onDidChangeOptionGroups((chatSessionType) => {
      const sessionResource = this._widget?.viewModel?.model.sessionResource;
      if (sessionResource) {
        const delegateSessionType = this.options.sessionTypePickerDelegate?.getActiveSessionProvider?.();
        if (getChatSessionType(sessionResource) === chatSessionType || delegateSessionType === chatSessionType) {
          this.refreshChatSessionPickers();
        }
      }
    }));
    if (this.options.sessionTypePickerDelegate?.onDidChangeActiveSessionProvider) {
      this._register(this.options.sessionTypePickerDelegate.onDidChangeActiveSessionProvider(async (newSessionType) => {
        this._currentSessionType = newSessionType;
        this.getVisibleOptionGroupsModeAndUpdateContextKeys(this.getCurrentSessionResource());
        this.agentSessionTypeKey.set(newSessionType);
        this.chatSessionSupportsDelegationKey.set(this.chatSessionsService.supportsDelegationForSessionType(newSessionType));
        this.updateWidgetLockStateFromSessionType(newSessionType);
        this.checkModeInSessionPool(newSessionType);
        this.revalidateModelForSessionType();
        this.refreshChatSessionPickers();
      }));
    }
    this._attachmentModel = this._register(this.instantiationService.createInstance(ChatAttachmentModel));
    this._register(this._attachmentModel.onDidChange(() => {
      if (this._chatSessionIsEmpty) {
        this._emptyInputAttachments.set(this._attachmentModel.attachments, void 0);
      }
      this._syncInputStateToModel();
    }));
    this._register(this._modelConfigStore.onDidChange(() => this._syncInputStateToModel()));
    this.selectedToolsModel = this._register(this.instantiationService.createInstance(ChatSelectedTools, this.currentModeObs, this._currentLanguageModel));
    this.dnd = this._register(this.instantiationService.createInstance(ChatDragAndDrop, () => this._widget, this._attachmentModel, styles));
    this.inputEditorMaxHeight = this.options.renderStyle === "compact" ? INPUT_EDITOR_MAX_HEIGHT / 3 : INPUT_EDITOR_MAX_HEIGHT;
    const padding = this.options.renderStyle === "compact" ? INPUT_EDITOR_PADDING.compact : INPUT_EDITOR_PADDING.default;
    this.singleLineInputEditorHeight = INPUT_EDITOR_LINE_HEIGHT + padding.top + padding.bottom;
    this.inputEditorMinHeight = this.options.inputEditorMinLines ? this.options.inputEditorMinLines * INPUT_EDITOR_LINE_HEIGHT + padding.top + padding.bottom : void 0;
    this.inputEditorHasText = ChatContextKeys.inputHasText.bindTo(contextKeyService);
    this.inputEditorHasSendableContent = ChatContextKeys.inputHasSendableContent.bindTo(contextKeyService);
    this.inputSubmitPending = ChatContextKeys.inputSubmitPending.bindTo(contextKeyService);
    this.inputRouting = ChatContextKeys.inputRouting.bindTo(contextKeyService);
    this.chatCursorAtTop = ChatContextKeys.inputCursorAtTop.bindTo(contextKeyService);
    this.inputEditorHasFocus = ChatContextKeys.inputHasFocus.bindTo(contextKeyService);
    this._hasQuestionCarouselContextKey = ChatContextKeys.Editing.hasQuestionCarousel.bindTo(contextKeyService);
    this.chatModeKindKey = ChatContextKeys.chatModeKind.bindTo(contextKeyService);
    this.chatModeNameKey = ChatContextKeys.chatModeName.bindTo(contextKeyService);
    this.chatModelIdKey = ChatContextKeys.chatModelId.bindTo(contextKeyService);
    this.permissionLevelKey = ChatContextKeys.chatPermissionLevel.bindTo(contextKeyService);
    this.permissionLevelKey.set(this._currentPermissionLevel.get());
    this.withinEditSessionKey = ChatContextKeys.withinEditSessionDiff.bindTo(contextKeyService);
    this.filePartOfEditSessionKey = ChatContextKeys.filePartOfEditSession.bindTo(contextKeyService);
    this.chatSessionHasOptions = ChatContextKeys.chatSessionHasModels.bindTo(contextKeyService);
    this.chatSessionOptionsValid = ChatContextKeys.chatSessionOptionsValid.bindTo(contextKeyService);
    this.agentSessionTypeKey = ChatContextKeys.agentSessionType.bindTo(contextKeyService);
    this.chatSessionSupportsDelegationKey = ChatContextKeys.chatSessionSupportsDelegation.bindTo(contextKeyService);
    this.chatHasPendingDelegationTargetKey = ChatContextKeys.hasPendingDelegationTarget.bindTo(contextKeyService);
    if (this.options.sessionTypePickerDelegate?.getActiveSessionProvider) {
      const initialSessionType = this.options.sessionTypePickerDelegate.getActiveSessionProvider();
      if (initialSessionType) {
        this.agentSessionTypeKey.set(initialSessionType);
        this.chatSessionSupportsDelegationKey.set(this.chatSessionsService.supportsDelegationForSessionType(initialSessionType));
      }
    }
    this.chatSessionHasCustomAgentTarget = ChatContextKeys.chatSessionHasCustomAgentTarget.bindTo(contextKeyService);
    this.chatSessionHasTargetedModels = ChatContextKeys.chatSessionHasTargetedModels.bindTo(contextKeyService);
    this.history = this._register(this.instantiationService.createInstance(ChatHistoryNavigator, this.location));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      const newOptions = {};
      if (e.affectsConfiguration(ChatConfiguration.GlobalAutoApprove)) {
        this.setPermissionLevel(this._currentPermissionLevel.get());
      }
      if (e.affectsConfiguration(ChatConfiguration.DefaultPermissionLevel)) {
        if (this._chatSessionIsEmpty) {
          this.setPermissionLevel(this.getDefaultPermissionLevel());
        }
      }
      if (e.affectsConfiguration(ChatConfiguration.DefaultModel)) {
        this._modelSelectionController.applyConfiguredDefault();
      }
      if (e.affectsConfiguration(AccessibilityVerbositySettingId.Chat)) {
        newOptions.ariaLabel = this._getAriaLabel();
      }
      if (e.affectsConfiguration("editor.wordSegmenterLocales")) {
        newOptions.wordSegmenterLocales = this.configurationService.getValue("editor.wordSegmenterLocales");
      }
      if (e.affectsConfiguration("editor.autoClosingBrackets")) {
        newOptions.autoClosingBrackets = this.configurationService.getValue("editor.autoClosingBrackets");
      }
      if (e.affectsConfiguration("editor.autoClosingQuotes")) {
        newOptions.autoClosingQuotes = this.configurationService.getValue("editor.autoClosingQuotes");
      }
      if (e.affectsConfiguration("editor.autoSurround")) {
        newOptions.autoSurround = this.configurationService.getValue("editor.autoSurround");
      }
      this.inputEditor.updateOptions(newOptions);
    }));
    this._chatEditsListPool = this._register(this.instantiationService.createInstance(CollapsibleListPool, this._onDidChangeVisibility.event, MenuId.ChatEditingWidgetModifiedFilesToolbar, { verticalScrollMode: ScrollbarVisibility.Visible }));
    this._hasFileAttachmentContextKey = ChatContextKeys.hasFileAttachments.bindTo(contextKeyService);
    this.initSelectedModel();
    this._register(this._onDidChangeCurrentChatMode.event(() => {
      this.checkModelSupported();
    }));
    const updateAfterModelListChange = (reconcileSelection) => {
      const modelIdentifier = this._currentLanguageModel.get()?.identifier;
      const models = this.getModels();
      if (canLog(this.logService.getLevel(), LogLevel.Debug)) {
        const mergedModels = this.getAllMergedModels();
        const filteredModels = filterModelsForSession(models, this.getCurrentSessionType(), this.currentModeKind, this.location);
        const messageparts = [
          `resetting current language model due to model list change from ${modelIdentifier}`,
          `this._widget?.viewModel?.model.sessionResource = ${this._widget?.viewModel?.model.sessionResource?.toString()}`,
          `this.currentModeKind = ${this.currentModeKind}`,
          `this.getCurrentSessionType = ${this.getCurrentSessionType()}`,
          `this._currentSessionType = ${this._currentSessionType}`,
          `shouldResetOnModelListChange(modelIdentifier, models) = ${shouldResetOnModelListChange(modelIdentifier, models)}`,
          `vendors: ${this.languageModelsService.getVendors().map((v) => v.vendor).join(", ")}`,
          `hiddenModelIds: ${this.languageModelsService.getHiddenModelIds().join(", ")}`,
          `model identifiers: ${models.map((m) => m.identifier).join(", ")}`,
          `model target Session Types: ${models.map((m) => m.metadata.targetChatSessionType || "").join(", ")}`,
          `model metadataid: ${models.map((m) => m.metadata.id).join(", ")}`,
          `merged.model identifiers: ${mergedModels.map((m) => m.identifier).join(", ")}`,
          `merged.model target Session Types: ${mergedModels.map((m) => m.metadata.targetChatSessionType || "").join(", ")}`,
          `merged.model metadataid: ${mergedModels.map((m) => m.metadata.id).join(", ")}`,
          `filtered.model identifiers: ${filteredModels.map((m) => m.identifier).join(", ")}`,
          `filtered.model target Session Types: ${filteredModels.map((m) => m.metadata.targetChatSessionType || "").join(", ")}`,
          `filtered.model metadataid: ${filteredModels.map((m) => m.metadata.id).join(", ")}`
        ];
        if (this.getCurrentSessionType() !== SessionType.CopilotCLI) {
          const delegateSessionType = this.options.sessionTypePickerDelegate?.getActiveSessionProvider?.();
          if (delegateSessionType) {
            messageparts.push(`delegateSessionType = ${delegateSessionType}`);
          }
          const sessionResource = this._widget?.viewModel?.model.sessionResource;
          messageparts.push(`current session resource = ${sessionResource}`);
        }
        logChangesToStateModel(this._inputModel, messageparts.join(", "), void 0, void 0, this.logService);
      }
      if (reconcileSelection) {
        this._modelSelectionController.reconcileModelListChange(models);
      }
      this._updateInputContentContextKeys();
    };
    this._register(this.languageModelsService.onDidChangeLanguageModels(() => updateAfterModelListChange(false)));
    this._register(this.languageModelsService.onDidChangeModelVisibility(() => updateAfterModelListChange(true)));
    this._register(this.onDidChangeCurrentChatMode(() => {
      this.accessibilityService.alert(this._currentModeObservable.get().label.get());
      if (this._inputEditor) {
        this._inputEditor.updateOptions({ ariaLabel: this._getAriaLabel() });
      }
      this.setImplicitContextEnablement();
    }));
    this._register(autorun((reader) => {
      const lm = this._currentLanguageModel.read(reader);
      this.chatModelIdKey.set(lm?.metadata.id.toLowerCase() ?? "");
      this.contextUsageWidget?.setSelectedModel(lm?.identifier);
      if (lm?.metadata.name) {
        this.accessibilityService.alert(lm.metadata.name);
      }
      this._inputEditor?.updateOptions({ ariaLabel: this._getAriaLabel() });
    }));
    this._register(autorun((reader) => {
      const modes = this._currentChatModesObservable.read(reader);
      reader.store.add(modes.onDidChange(() => {
        this.validateCurrentChatMode();
        this._restorePersistedCustomModeIfAvailable();
      }));
    }));
    this._register(autorun((r) => {
      const mode = this._currentModeObservable.read(r);
      this.chatModeKindKey.set(mode.kind);
      this.chatModeNameKey.set(mode.name.read(r));
      if (this.options.suppressModePreferredModel) {
        return;
      }
      const models = mode.model?.read(r);
      if (models) {
        this.switchModelByQualifiedName(models);
      }
    }));
    this.validateCurrentChatMode();
  }
  static {
    this._counter = 0;
  }
  get attachmentModel() {
    return this._attachmentModel;
  }
  getAttachedContext() {
    const contextArr = new ChatRequestVariableSet();
    contextArr.add(...this.attachmentModel.attachments, ...this.chatContextService.getWorkspaceContextItems());
    return contextArr;
  }
  getAttachedAndImplicitContext() {
    const contextArr = this.getAttachedContext();
    if (this.implicitContext) {
      const implicitChatVariables = this.implicitContext.enabledBaseEntries(this.configurationService.getValue("chat.implicitContext.suggestedContext"));
      contextArr.add(...implicitChatVariables);
    }
    return contextArr;
  }
  get implicitContext() {
    return this._implicitContext;
  }
  get inputContainerElement() {
    return this.inputContainer;
  }
  get persistentContentContainerElement() {
    return this.persistentContentContainer;
  }
  get gettingStartedTipContainerElement() {
    return this.chatGettingStartedTipContainer;
  }
  getChatPetPlatformTop() {
    const inputTop = this.inputContainer.getBoundingClientRect().top;
    let container = this.container;
    let previousElement = this.persistentContentContainer;
    while (true) {
      const children = Array.from(container.children);
      const startIndex = previousElement ? children.indexOf(previousElement) + 1 : 0;
      let nestedContainer;
      for (let index = startIndex; index < children.length; index++) {
        const child = children[index];
        if (!dom.isHTMLElement(child)) {
          continue;
        }
        if (child === this.inputContainer) {
          return inputTop;
        }
        if (child.contains(this.inputContainer)) {
          nestedContainer = child;
          break;
        }
        const bounds = child.getBoundingClientRect();
        if (bounds.height > 0 && bounds.top <= inputTop) {
          return bounds.top;
        }
      }
      if (!nestedContainer) {
        return inputTop;
      }
      container = nestedContainer;
      previousElement = void 0;
    }
  }
  get inputEditor() {
    return this._inputEditor;
  }
  setHistoryKey(historyKey) {
    this.history.setHistoryKey(historyKey);
  }
  get currentLanguageModel() {
    return this._currentLanguageModel.get()?.identifier;
  }
  get selectedLanguageModel() {
    return this._currentLanguageModel;
  }
  /** Models the current input can select, for frontend-owned voice actions. */
  get availableLanguageModels() {
    return this.getModels();
  }
  get currentModeKind() {
    const mode = this._currentModeObservable.get();
    return mode.kind === ChatModeKind.Agent && !this.agentService.hasToolsAgent ? ChatModeKind.Edit : mode.kind;
  }
  get currentModeObs() {
    return this._currentModeObservable;
  }
  get currentChatModesObs() {
    return this._currentChatModesObservable;
  }
  get currentPermissionLevelObs() {
    return this._currentPermissionLevel;
  }
  get currentModeInfo() {
    const mode = this._currentModeObservable.get();
    const modeId = mode.isBuiltin ? this.currentModeKind : "custom";
    const modeInstructions = mode.modeInstructions?.get();
    return {
      kind: this.currentModeKind,
      isBuiltin: mode.isBuiltin,
      modeInstructions: modeInstructions ? {
        uri: mode.uri?.get(),
        name: mode.name.get(),
        content: modeInstructions.content,
        toolReferences: this.toolService.toToolReferences(modeInstructions.toolReferences),
        allowedSubagents: mode.agents?.get(),
        metadata: modeInstructions.metadata,
        isBuiltin: mode.isBuiltin
      } : void 0,
      telemetryModeId: modeId,
      telemetryModeName: getModeNameForTelemetry(mode),
      applyCodeBlockSuggestionId: void 0,
      permissionLevel: this._currentPermissionLevel.get()
    };
  }
  get selectedElements() {
    const edits = [];
    const editsList = this._chatEditList?.object;
    const selectedElements = editsList?.getSelectedElements() ?? [];
    for (const element of selectedElements) {
      if (element.kind === "reference" && URI.isUri(element.reference)) {
        edits.push(element.reference);
      }
    }
    return edits;
  }
  /**
   * The number of working set entries that the user actually wanted to attach.
   * This is less than or equal to {@link ChatInputPart.chatEditWorkingSetFiles}.
   */
  get attemptedWorkingSetEntriesCount() {
    return this._attemptedWorkingSetEntriesCount;
  }
  /**
   * Gets the pending delegation target if one is set.
   * This is used when the user changes the session target picker to a different provider
   * but hasn't submitted yet, so the delegation will happen on submit.
   */
  get pendingDelegationTarget() {
    return this._pendingDelegationTarget;
  }
  get _pendingDelegationTarget() {
    return this._pendingDelegationTargetObservable.get();
  }
  set _pendingDelegationTarget(value) {
    this._pendingDelegationTargetObservable.set(value, void 0);
  }
  get _currentSessionType() {
    return this._currentSessionTypeObservable.get();
  }
  set _currentSessionType(value) {
    this._currentSessionTypeObservable.set(value, void 0);
  }
  setImplicitContextEnablement() {
    if (this.implicitContext && this.configurationService.getValue("chat.implicitContext.suggestedContext")) {
      this.implicitContext.setEnabled(this._currentModeObservable.get().name.get().toLowerCase() === "ask");
    }
  }
  setIsWithinEditSession(inInsideDiff, isFilePartOfEditSession) {
    this.withinEditSessionKey.set(inInsideDiff);
    this.filePartOfEditSessionKey.set(isFilePartOfEditSession);
  }
  getSelectedModelStorageKey() {
    return getSelectedModelStorageKey(this.location, this.getSelectedModelTarget());
  }
  getSelectedModelTarget() {
    const sessionType = this._currentSessionType;
    return sessionType && this.sessionTypeHasOwnModelPool(sessionType) ? sessionType : void 0;
  }
  /**
   * True when the session type owns its own model pool (either declared via `requiresCustomModels`,
   * or some registered model already targets it). Keeps storage keys stable before targeted models are published.
   */
  sessionTypeHasOwnModelPool(sessionType) {
    return this.chatSessionsService.requiresCustomModelsForSessionType(sessionType) || hasModelsTargetingSession(this.getAllMergedModels(), sessionType);
  }
  initSelectedModel() {
    this._modelConfigStore.clear();
    const selectedModelStorageKey = this.getSelectedModelStorageKey();
    const storedSelection = getStoredSelectedModel(this.storageService, this.location, this.getSelectedModelTarget());
    logChangesToStateModel(this._inputModel, `[INIT-SELECTED-MODEL] storageKey=${selectedModelStorageKey}, persistedSelection=${storedSelection}, currentSessionType=${this._currentSessionType}, getCurrentSessionType=${this.getCurrentSessionType()}, widgetSession=${this._currentSessionKey}, boundInputModelSession=${this._inputModelSessionResource?.toString()}, currentLanguageModel=${this._currentLanguageModel.get()?.identifier}`, this._inputModel?.state.get(), void 0, this.logService);
    this._modelSelectionController.initialize(
      storedSelection,
      (selection) => logChangesToStateModel(this._inputModel, `[INIT-SELECTED-MODEL] restore decision persistedSelection=${storedSelection}, selection=${selection.kind}, resultModel=${selection.kind === "apply" ? selection.model.identifier : void 0}, storageKey=${selectedModelStorageKey}, currentSessionType=${this._currentSessionType}, getCurrentSessionType=${this.getCurrentSessionType()}`, this._inputModel?.state.get(), void 0, this.logService)
    );
  }
  setEditing(enabled, editingSentRequest) {
    this.currentlyEditingInputKey?.set(enabled);
    this.editingSentRequestKey?.set(editingSentRequest);
  }
  switchModel(modelMetadata) {
    const models = this.getModels();
    const model = models.find((m) => m.metadata.vendor === modelMetadata.vendor && m.metadata.id === modelMetadata.id && m.metadata.family === modelMetadata.family);
    if (model) {
      this.setCurrentLanguageModel(model, true);
    }
  }
  /**
   * Switch to a model by its identifier. Returns true if a matching model
   * was found and applied.
   *
   * The remembered profile preference is updated only when both
   * `isUserAction` and `storeSelection` are true.
   */
  switchModelByIdentifier(identifier, storeSelection = false, isUserAction = false) {
    const models = this.getModels();
    const model = models.find((m) => m.identifier === identifier);
    if (model) {
      if (isUserAction) {
        this.setCurrentLanguageModel(model, true, storeSelection);
      } else {
        this._applyProgrammaticLanguageModel(model);
      }
      return true;
    }
    return false;
  }
  switchModelByQualifiedName(qualifiedModelNames) {
    const models = this.getModels();
    for (const qualifiedModelName of qualifiedModelNames) {
      const model = models.find((m) => ILanguageModelChatMetadata.matchesQualifiedName(qualifiedModelName, m.metadata));
      if (model) {
        this._applyProgrammaticLanguageModel(model);
        return true;
      }
    }
    this.logService.warn(`[chat] Node of the models "${qualifiedModelNames.join(", ")}" not found. Use format "<name> (<vendor>)", e.g. "GPT-4o (copilot)".`);
    return false;
  }
  requestModelByIdentifier(identifier) {
    return this._requestProgrammaticLanguageModel(() => this.getModels().find((model) => model.identifier === identifier));
  }
  requestModelByQualifiedName(qualifiedModelNames) {
    return this._requestProgrammaticLanguageModel(() => {
      const models = this.getModels();
      return qualifiedModelNames.map((name) => models.find((model) => ILanguageModelChatMetadata.matchesQualifiedName(name, model.metadata))).find(isDefined);
    });
  }
  get hasPendingProgrammaticModelSelection() {
    return this._modelSelectionController.hasPendingProgrammaticSelection();
  }
  switchToNextModel() {
    const models = this.getModels();
    if (models.length > 0) {
      const currentIndex = models.findIndex((model) => model.identifier === this._currentLanguageModel.get()?.identifier);
      const nextIndex = (currentIndex + 1) % models.length;
      this.setCurrentLanguageModel(models[nextIndex], true);
    }
  }
  switchToNextPinnedModel() {
    const models = this.getModels();
    if (models.length === 0) {
      return;
    }
    const modelMap = new Map(models.map((model) => [model.identifier, model]));
    const pinnedModels = this.languageModelsService.getPinnedModelIds().map((modelId) => modelMap.get(modelId)).filter(isDefined);
    if (pinnedModels.length === 0) {
      return;
    }
    const currentIndex = pinnedModels.findIndex((model) => model.identifier === this._currentLanguageModel.get()?.identifier);
    const nextIndex = (currentIndex + 1) % pinnedModels.length;
    this.setCurrentLanguageModel(pinnedModels[nextIndex], true);
  }
  openModelPicker() {
    if (this.chatPhoneInputPresenter.enabled.get()) {
      this._showCombinedPhonePickerSheet();
      return;
    }
    this.modelWidget?.show();
  }
  openModePicker() {
    if (this.chatPhoneInputPresenter.enabled.get()) {
      this._showCombinedPhonePickerSheet();
      return;
    }
    this.modeWidget?.show();
  }
  _showCombinedPhonePickerSheet() {
    const target = this.inputActionsToolbar.getElement();
    this.chatPhoneInputPresenter.showCombinedModeAndModelSheet(target, {
      kind: "delegates",
      modeDelegate: this._createModePickerDelegate(),
      modelDelegate: this._createModelPickerDelegate()
    }).catch((err) => this.logService.error("[ChatInputPart] phone picker sheet failed", err));
  }
  _createModelPickerDelegate() {
    const inputPickerContainer = this.options.inputPickerContainer;
    return {
      currentModel: this._currentLanguageModel,
      setModel: (model) => {
        this.setCurrentLanguageModel(model, true, !this.options.suppressModelPersistence);
        this.renderAttachedContext();
      },
      getModels: () => this.getModels(),
      isCacheWarm: () => (this._widget?.viewModel?.model.getRequests().length ?? 0) > 0,
      getPresentationOptions: () => this._getModelPickerPresentationOptions(),
      modelConfiguration: this._modelConfigStore,
      onDidChangeVisibility: this.options.onDidChangeModelPickerVisibility,
      anchorPosition: this.options.inputPickerPosition,
      get actionWidgetContainer() {
        return typeof inputPickerContainer === "function" ? inputPickerContainer() : inputPickerContainer;
      },
      getActionWidgetAnchor: this.options.inputPickerAnchor,
      openOnMouseUp: this.options.inputPickerOpenOnMouseUp
    };
  }
  _getModelPickerPresentationOptions() {
    const sessionType = this.getCurrentSessionType();
    const useRichPicker = !sessionType || sessionType === localChatSessionType || isAgentHostTarget(sessionType);
    return {
      useGroupedModelPicker: useRichPicker,
      showManageModelsAction: useRichPicker,
      showUnavailableFeatured: useRichPicker,
      showFeatured: useRichPicker,
      showAutoModel: this._showAutoModel(),
      showModelIcon: this.options.isSessionsWindow || !this._usesHarnessProviderIcon()
    };
  }
  _usesHarnessProviderIcon() {
    const sessionType = this.getCurrentSessionType();
    return sessionType === SessionType.Codex || sessionType === SessionType.AgentHostClaude || sessionType === SessionType.AgentHostCodex;
  }
  /**
   * Returns this editor's snapshot of the given model's configuration (e.g.
   * context size, thinking effort), scoped to this editor rather than the
   * profile-global value. Delegates to {@link ChatModelConfigurationStore}.
   * See issue #320393.
   */
  getModelConfiguration(modelId) {
    return this._modelConfigStore.getModelConfiguration(modelId);
  }
  /**
   * Restores a model's configuration captured in a session's persisted input
   * state. Called when the selected model is restored from session history so
   * the configuration follows the model through the same resolution hierarchy.
   * No-op for sessions that pre-date configuration capture (no value stored).
   */
  restoreModelConfiguration(modelId, modelConfiguration) {
    if (modelConfiguration) {
      this._modelConfigStore.restoreModelConfiguration(modelId, modelConfiguration);
    }
  }
  getModelConfigurationStorageKey() {
    const sessionType = this._currentSessionType;
    if (sessionType && this.sessionTypeHasOwnModelPool(sessionType)) {
      return `chat.modelConfiguration.${this.location}.${sessionType}`;
    }
    return `chat.modelConfiguration.${this.location}`;
  }
  _createModePickerDelegate() {
    const productService = this.productService;
    const currentChatModes = this.options.hideCustomChatModes ? derived((reader) => {
      const inner = this._currentChatModesObservable.read(reader);
      const filteredCustom = inner.custom.filter((m) => isModeConsideredBuiltIn(m, productService));
      const wrapped = {
        onDidChange: inner.onDidChange,
        builtin: inner.builtin,
        custom: filteredCustom,
        findModeById: (id) => inner.builtin.find((m) => m.id === id) ?? filteredCustom.find((m) => m.id === id),
        findModeByName: (name) => inner.builtin.find((m) => m.name.read(void 0) === name) ?? filteredCustom.find((m) => m.name.read(void 0) === name),
        waitForPendingUpdates: () => inner.waitForPendingUpdates()
      };
      return wrapped;
    }) : this._currentChatModesObservable;
    return {
      currentMode: this._currentModeObservable,
      currentChatModes,
      sessionResource: () => this._widget?.viewModel?.sessionResource,
      // Direct setter for hosts that embed `ChatInputPart` without
      // registering an `IChatWidget` (e.g. the automations dialog).
      // The picker only calls this when `sessionResource()` is
      // `undefined`; real chat widgets keep the command path.
      setMode: (mode) => this.setChatMode2(mode, true),
      customAgentTarget: () => {
        const sessionResource = this._widget?.viewModel?.model.sessionResource;
        return (sessionResource && this.chatSessionsService.getCustomAgentTargetForSessionType(getChatSessionType(sessionResource))) ?? Target.Undefined;
      }
    };
  }
  openPermissionPicker() {
    this.permissionWidget?.show();
  }
  setPermissionLevel(level) {
    level = this.getPermittedPermissionLevel(level);
    this._currentPermissionLevel.set(level, void 0);
    this.permissionLevelKey.set(level);
    this.permissionWidget?.refresh();
    const sessionResource = this.getCurrentSessionResource();
    if (sessionResource) {
      this.chatSessionsService.setSessionOption(sessionResource, PERMISSION_LEVEL_OPTION_ID, level);
    }
    logChangesToStateModel(this._inputModel, `setPermissionLevel -> _syncInputStateToModel (level=${level}, currentLanguageModel=${this._currentLanguageModel.get()?.identifier}) in ${this._currentSessionKey}`, void 0, void 0, this.logService);
    this._syncInputStateToModel();
  }
  getDefaultPermissionLevel() {
    const level = this.configurationService.getValue(ChatConfiguration.DefaultPermissionLevel);
    return isChatPermissionLevel(level) ? level : ChatPermissionLevel.Default;
  }
  getPermittedPermissionLevel(level) {
    if (isAutoApproveValuePolicyRestricted(level, isAutoApprovePolicyRestricted(this.configurationService))) {
      return ChatPermissionLevel.Default;
    }
    return level;
  }
  openSessionTargetPicker() {
    this.sessionTargetWidget?.show();
  }
  openDelegationPicker() {
    this.delegationWidget?.show();
  }
  openChatSessionPicker() {
    const firstWidget = this.chatSessionPickerWidgets?.values()?.next().value;
    firstWidget?.show();
  }
  /**
   * Create picker widgets for all option groups available for the current session type.
   */
  createChatSessionPickerWidgets(action, pickerOptions) {
    this._lastSessionPickerAction = action;
    this._lastSessionPickerOptions = pickerOptions;
    const sessionResource = this.getCurrentSessionResource();
    const visibleOptionGroups = this.getVisibleOptionGroupsModeAndUpdateContextKeys(sessionResource);
    if (!visibleOptionGroups.length) {
      return [];
    }
    const effectiveSessionType = this.getEffectiveSessionType(sessionResource);
    if (!effectiveSessionType) {
      return [];
    }
    this.chatSessionPickerWidgets.clearAndDisposeAll();
    const widgets = [];
    for (const optionGroup of visibleOptionGroups) {
      const initialItem = this.getCurrentOptionForGroup(optionGroup.id);
      const initialState = { group: optionGroup, item: initialItem };
      const itemDelegate = {
        getCurrentOption: () => this.getCurrentOptionForGroup(optionGroup.id),
        onDidChangeOption: this.getOrCreateOptionEmitter(optionGroup.id).event,
        setOption: (option) => {
          this.updateOptionContextKey(optionGroup.id, option.id);
          this.getOrCreateOptionEmitter(optionGroup.id).fire(option);
          const sessionResource2 = this._widget?.viewModel?.model.sessionResource;
          if (sessionResource2) {
            this.chatSessionsService.setSessionOption(sessionResource2, optionGroup.id, option);
          }
          this.refreshChatSessionPickers();
        },
        getOptionGroup: () => {
          const groups = this.chatSessionsService.getOptionGroupsForSessionType(effectiveSessionType);
          return groups?.find((g) => g.id === optionGroup.id);
        },
        getSessionResource: () => {
          return this._widget?.viewModel?.model.sessionResource;
        }
      };
      const widget = this.instantiationService.createInstance(ChatSessionPickerActionItem, action, initialState, itemDelegate, pickerOptions);
      this.chatSessionPickerWidgets.set(optionGroup.id, widget);
      widgets.push(widget);
    }
    return widgets;
  }
  /**
   * Set the input model reference for syncing input state
   *
   * Note: We have a cyclic ref between ChatInputPart and ChatWidget,
   * When we invoke setInputModel, the property _widget is not set. Hence we don't have the SessionResource.
   * As a result, in this method when syncFromModel is called, the model state is not applied to the UI.
   * Instead, the defaults are computed and the model is updated with default values. Thereby blowing away model information.
   * Setting Widget and then calling this doesn't work either because the widget also relies on ChatInputPart (hence cyclic ref).
   * Solution is to pass the SessionResource as an argument to this method.
  */
  setInputModel(model, chatSessionIsEmpty, forSessionResource) {
    logChangesToStateModel(this._inputModel, `setInputModel for ${forSessionResource.toString()} (chatSessionIsEmpty=${chatSessionIsEmpty}, outgoing._inputModel=${this._inputModel ? "present" : "undefined"})`, model.state.get(), this._inputModel?.state.get(), this.logService);
    if (this._inputModel) {
      logChangesToStateModel(this._inputModel, `[FLUSH-PRE] setInputModel pre-flush boundInputModelSession=${this._inputModelSessionResource?.toString()} widgetSession=${this._currentSessionKey} incoming=${forSessionResource.toString()}`, void 0, this._inputModel.state.get(), this.logService);
      this._syncInputStateToModel();
    }
    this._currentSessionType = getChatSessionType(forSessionResource);
    this._inputModel = model;
    this._inputModelSessionResource = forSessionResource;
    this._modelSyncDisposables.clear();
    const chatModes = this.chatModeService.createModes(forSessionResource);
    this._currentChatModes.value = chatModes;
    this._currentChatModesObservable.set(chatModes, void 0);
    this.selectedToolsModel.resetSessionEnablementState();
    this._chatSessionIsEmpty = isNewConversation(forSessionResource, chatSessionIsEmpty);
    const ownsPool = !!this._currentSessionType && this.sessionTypeHasOwnModelPool(this._currentSessionType);
    const hadIncomingModel = !!model.state.get()?.selectedModel;
    this._modelSelectionController.beginSessionSwitch(this._chatSessionIsEmpty, ownsPool, hadIncomingModel);
    if (this._chatSessionIsEmpty) {
      const persistedState = model.state.get() ? void 0 : this._getPersistedEmptyInputState();
      if (persistedState) {
        model.setState(persistedState);
        this._syncFromModel(persistedState, forSessionResource);
      }
      logChangesToStateModel(this._inputModel, `(1) setting empty model state for ${forSessionResource.toString()}`, void 0, void 0, this.logService);
      this._setEmptyModelState();
      this._modelSyncDisposables.add(this.configurationService.onDidChangeConfiguration((e) => {
        if (this._chatSessionIsEmpty && e.affectsConfiguration(ChatConfiguration.DefaultNewSessionMode)) {
          logChangesToStateModel(this._inputModel, `(2) setting empty model state for ${forSessionResource.toString()}`, void 0, void 0, this.logService);
          this._setEmptyModelState();
        }
      }));
      this._modelSyncDisposables.add(this._currentChatModesObservable.get().onDidChange(() => {
        if (this._chatSessionIsEmpty) {
          logChangesToStateModel(this._inputModel, `(3) setting empty model state for ${forSessionResource.toString()}`, void 0, void 0, this.logService);
          this._setEmptyModelState();
        }
      }));
    }
    const widgetViewModelSession = this._widget?.viewModel?.model.sessionResource;
    const isStaleAtRegistration = !!widgetViewModelSession && !isEqual(widgetViewModelSession, forSessionResource);
    logChangesToStateModel(this._inputModel, `[AUTORUN-REG] registering model->view autorun for ${forSessionResource.toString()}, widgetSession=${this._currentSessionKey}, widgetViewModelSession=${widgetViewModelSession?.toString()}, isStaleAtRegistration=${isStaleAtRegistration}, model.state.selectedModel=${model.state.get()?.selectedModel?.identifier}, _currentLanguageModel=${this._currentLanguageModel.get()?.identifier}`, void 0, void 0, this.logService);
    this._modelSyncDisposables.add(autorun((reader) => {
      let state = model.state.read(reader);
      let message = `syncing from model for ${forSessionResource.toString()} in ${this._currentSessionKey}`;
      if (!state && this._chatSessionIsEmpty) {
        state = this._getPersistedEmptyInputState();
        message = `syncing from empty input state for ${forSessionResource.toString()}`;
        if (state) {
          const resolved = this._modelSelectionController.resolveDraftModel(state.selectedModel, this._currentSessionType, false);
          if (resolved.changed) {
            state = { ...state, selectedModel: resolved.model, modelConfiguration: void 0 };
          }
        }
      }
      const widgetSessionResource = this._widget?.viewModel?.model.sessionResource;
      const isStaleSession = !!this._inputModelSessionResource && !isEqual(this._inputModelSessionResource, forSessionResource);
      if (isStaleSession) {
        message = `[STALE-SESSION-AUTORUN] ${message} (widget now on ${widgetSessionResource?.toString()}, ${this._inputModelSessionResource?.toString()}, ${forSessionResource.toString()} is old)`;
      }
      const prevState = this._inputModel?.state.read(void 0);
      logChangesToStateModel(this._inputModel, message, state, prevState, this.logService);
      if (isStaleSession) {
        return;
      }
      this._syncFromModel(state, forSessionResource);
    }));
  }
  _getPersistedEmptyInputState() {
    let state = this._emptyInputState.read(void 0);
    if (!state) {
      return void 0;
    }
    const persistedAttachments = this._emptyInputAttachments.read(void 0);
    state = {
      ...state,
      attachments: persistedAttachments.length > 0 ? persistedAttachments : state.attachments
    };
    const resolved = this._modelSelectionController.resolveDraftModel(state.selectedModel, this._currentSessionType, true);
    if (resolved.changed) {
      state = { ...state, selectedModel: resolved.model, modelConfiguration: void 0 };
    }
    return state;
  }
  _setEmptyModelState() {
    logChangesToStateModel(this._inputModel, `setting empty model state for ${this._widget?.viewModel?.sessionResource.toString()} in ${this._currentSessionKey}`, void 0, void 0, this.logService);
    const currentLevel = this._inputModel?.state?.get()?.permissionLevel;
    if (currentLevel === void 0 || !isChatPermissionLevel(currentLevel)) {
      this.setPermissionLevel(this.getDefaultPermissionLevel());
    }
    if (this.entitlementService.anonymous) {
      this.setChatMode(ChatModeKind.Agent, false);
      this.checkModelSupported();
      return;
    }
    const rawDefaultMode = this.configurationService.getValue(ChatConfiguration.DefaultNewSessionMode);
    if (typeof rawDefaultMode === "string") {
      const defaultMode = rawDefaultMode.trim();
      if (defaultMode) {
        const defaultModeLower = defaultMode.toLowerCase();
        const modes = this._currentChatModesObservable.get();
        const resolved = modes.findModeById(defaultMode) ?? modes.findModeByName(defaultMode) ?? modes.custom.find((m) => m.name.get().toLowerCase() === defaultModeLower);
        if (resolved) {
          this.logService.trace(`[ChatInputPart] Applying default mode from setting: ${defaultMode} -> ${resolved.id}`);
          this.setChatMode(resolved.id, false);
          this.checkModelSupported();
        }
      }
    }
  }
  /**
   * Sync from model to view (when model state changes)
   */
  _syncFromModel(state, forSessionResource) {
    if (this._isSyncingToOrFromInputModel) {
      return;
    }
    try {
      this._isSyncingToOrFromInputModel = true;
      if (state) {
        const currentMode = this._currentModeObservable.get();
        if (currentMode.id !== state.mode.id) {
          this.setChatMode(state.mode.id, false);
        }
      }
      if (state?.selectedModel) {
        const sessionType = getChatSessionType(forSessionResource);
        this._modelSelectionController.syncFromConversationState(state.selectedModel, state.modelConfiguration, sessionType, forSessionResource.toString(), state.origin === ChatInputStateOrigin.Remote);
      } else if (state) {
        logChangesToStateModel(this._inputModel, `_syncFromModel: state has no selectedModel (no-op for model picker) for ${forSessionResource.toString()} in ${this._currentSessionKey} (current=${this._currentLanguageModel.get()?.identifier})`, state, void 0, this.logService);
      }
      const currentAttachments = this._attachmentModel.attachments;
      if (!state) {
        this._attachmentModel.clear();
      } else if (!arraysEqual(currentAttachments, state.attachments)) {
        this._attachmentModel.clearAndSetContext(...state.attachments);
      }
      if (this._inputEditor) {
        this._inputEditor.setValue(state?.inputText || "");
        if (state?.selections.length) {
          this._inputEditor.setSelections(state.selections);
        }
      }
      if (!this.configurationService.getValue(ChatConfiguration.GlobalAutoApprove)) {
        const targetLevel = this.getPermittedPermissionLevel(state?.permissionLevel ?? ChatPermissionLevel.Default);
        if (this._currentPermissionLevel.get() !== targetLevel) {
          this._currentPermissionLevel.set(targetLevel, void 0);
          this.permissionLevelKey.set(targetLevel);
          this.permissionWidget?.refresh();
        }
      }
      if (state) {
        this._widget?.contribs.forEach((contrib) => {
          contrib.setInputState?.(state.contrib);
        });
      }
    } finally {
      this._isSyncingToOrFromInputModel = false;
      this._syncTextDebounced.cancel();
    }
  }
  /**
   * Sync current input state to the input model
   */
  _syncInputStateToModel() {
    if (this._isSyncingToOrFromInputModel) {
      return;
    }
    this._isSyncingToOrFromInputModel = true;
    const state = this.getCurrentInputState();
    if (this._chatSessionIsEmpty) {
      this._emptyInputState.set(state, void 0);
    }
    const prevState = this._inputModel?.state.get();
    logChangesToStateModel(this._inputModel, `_syncInputStateToModel boundInputModelSession=${this._inputModelSessionResource?.toString()} widgetSession=${this._currentSessionKey} mismatch=${this._inputModelSessionResource?.toString() !== this._currentSessionKey}`, state, prevState, this.logService);
    this._inputModel?.setState(state);
    this._isSyncingToOrFromInputModel = false;
    queueMicrotask(() => this.inputActionsToolbar?.relayout());
  }
  /**
   * Flush the current input state to the bound input model. Use this before
   * the host releases its model reference (e.g. on session switch) to ensure
   * an unsent draft is captured by `willDisposeModel` persistence.
   */
  flushInputStateToModel() {
    if (this._inputModel) {
      this._syncInputStateToModel();
    }
  }
  setCurrentLanguageModel(model, isUserAction = false, storeSelection = isUserAction) {
    const persistSelection = isUserAction && storeSelection;
    const modelDetails = this.getModels().map((m) => `${m.identifier} (${m.metadata.id})`).join(", ");
    const selectedModelStorageKey = this.getSelectedModelStorageKey();
    logChangesToStateModel(this._inputModel, `setCurrentLanguageModel to ${model.identifier} in ${this._currentSessionKey}, storageKey=${selectedModelStorageKey}, currentSessionType=${this._currentSessionType}, getCurrentSessionType=${this.getCurrentSessionType()}, boundInputModelSession=${this._inputModelSessionResource?.toString()}, modelDetails=${modelDetails}, persistSelection=${persistSelection}`, void 0, void 0, this.logService);
    const apply = () => {
      if (this.cachedWidth) {
        this.layout(this.cachedWidth);
      }
      if (persistSelection) {
        storeSelectedModel(this.storageService, this.location, this.getSelectedModelTarget(), model.identifier);
      }
      this._syncInputStateToModel();
    };
    if (isUserAction) {
      this._modelSelectionController.applyExplicitSelection(model, apply, false);
    } else {
      this._modelSelectionController.applyAutomaticSelection(model, apply);
    }
  }
  _applyProgrammaticLanguageModel(model) {
    this._modelSelectionController.applyProgrammaticSelection(model);
  }
  _requestProgrammaticLanguageModel(resolveModel) {
    const result = this._modelSelectionController.requestProgrammaticSelection(
      resolveModel,
      this._inputModelSessionResource?.toString()
    );
    this._updateInputContentContextKeys();
    void result.finally(() => this._updateInputContentContextKeys());
    return result;
  }
  checkModelSupported() {
    this._modelSelectionController.ensureCurrentModelSupported();
  }
  /**
   * By ID- prefer this method
   */
  setChatMode(mode, storeSelection = true, isUserInitiated = false) {
    if (!this.options.supportsChangingModes) {
      return;
    }
    const modes = this._currentChatModesObservable.get();
    const mode2 = modes.findModeById(mode) ?? modes.findModeByName(mode) ?? modes.findModeById(ChatModeKind.Agent) ?? ChatMode.Ask;
    this.setChatMode2(mode2, storeSelection, isUserInitiated);
  }
  setChatMode2(mode, storeSelection = true, isUserInitiated = false) {
    if (!this.options.supportsChangingModes) {
      return;
    }
    this._currentModeObservable.set(mode, void 0);
    this._onDidChangeCurrentChatMode.fire({ isUserInitiated });
    if (storeSelection) {
      logChangesToStateModel(this._inputModel, `setChatMode2 -> _syncInputStateToModel (mode=${mode.id}, storeSelection=${storeSelection}, isUserInitiated=${isUserInitiated}, currentLanguageModel=${this._currentLanguageModel.get()?.identifier}) in ${this._currentSessionKey}`, void 0, void 0, this.logService);
      this._syncInputStateToModel();
    }
  }
  /**
   * Get all models merged from live and cache, without session/mode filtering.
   * This is the canonical source for the full model pool, including cached models
   * that bridge startup races when live models haven't loaded yet.
   */
  getAllMergedModels() {
    const cachedModels = this.storageService.getObject(CachedLanguageModelsKey, StorageScope.APPLICATION, []);
    const liveModels = this.languageModelsService.getLanguageModelIds().map((modelId) => ({ identifier: modelId, metadata: this.languageModelsService.lookupLanguageModel(modelId) }));
    const contributedVendors = new Set(this.languageModelsService.getVendors().map((v) => v.vendor));
    const resolvedVendors = /* @__PURE__ */ new Set();
    for (const v of contributedVendors) {
      if (this.languageModelsService.hasResolvedVendor(v)) {
        resolvedVendors.add(v);
      }
    }
    const models = mergeModelsWithCache(liveModels, cachedModels, contributedVendors, resolvedVendors);
    if (liveModels.length > 0 || resolvedVendors.size > 0) {
      this.storageService.store(CachedLanguageModelsKey, models, StorageScope.APPLICATION, StorageTarget.MACHINE);
    }
    return models;
  }
  getModels() {
    return this.getModelsForSessionType(this.getCurrentSessionType());
  }
  /**
   * True when the current session type can fall back to the synthetic "Auto"
   * model. Defaults to `true` when no session type is set. See
   * {@link hasNoAvailableModel} for the "nothing to send with" state, which
   * additionally requires an empty model list.
   */
  _showAutoModel() {
    const sessionType = this.getCurrentSessionType();
    return !sessionType || this.chatSessionsService.supportsAutoModelForSessionType(sessionType);
  }
  /**
   * True when the current session type cannot fall back to the Auto model
   * and no models are available to it — e.g. the Claude agent host for a
   * Copilot Free / Student user. In this state there is no model to send a
   * request with, so sending is blocked.
   */
  hasNoAvailableModel() {
    return !this._showAutoModel() && this.getModels().length === 0;
  }
  getModelsForSessionType(sessionType) {
    const allModels = this.getAllMergedModels();
    if (sessionType && this.chatSessionsService.requiresCustomModelsForSessionType(sessionType) && !hasModelsTargetingSession(allModels, sessionType)) {
      return [];
    }
    allModels.sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));
    const sessionFiltered = filterModelsForSession(allModels, sessionType, this.currentModeKind, this.location);
    return sessionFiltered.filter((m) => !isModelHiddenInPicker(m, (id) => this.languageModelsService.isModelHidden(id)));
  }
  /**
   * Get the chat session type for the current session, if any.
   *
   * Once a real session exists, the session resource is the authoritative
   * source for which models are valid. The picker delegate only describes the
   * welcome/new-session selection, which may not match the session that was
   * ultimately created (e.g. an agent-host pick that fell back to an
   * in-process `local` session). Preferring the delegate in that case lets an
   * agent-host model leak into a local session's pool, so we only consult the
   * delegate when there is no session yet (the welcome view has no view model).
   */
  getCurrentSessionType() {
    const sessionResource = this._widget?.viewModel?.model.sessionResource;
    if (sessionResource) {
      return getChatSessionType(sessionResource);
    }
    return this.options.sessionTypePickerDelegate?.getActiveSessionProvider?.();
  }
  /**
   * Validate that the current model belongs to the current session's pool.
   * Called when switching sessions to prevent cross-contamination.
   */
  checkModelInSessionPool() {
    this._modelSelectionController.ensureCurrentModelInSessionPool();
  }
  /**
   * If the current model is absent from the destination session's filtered pool,
   * re-initialize from storage to restore the user's previous selection for this
   * pool, then validate. Uses the filtered pool (same as `revalidateForSessionType`)
   * so models that are catalogued but not valid for the destination are caught even
   * before targeted models load.
   */
  reinitializeIfModelInvalidForPool() {
    const currentModel = this._currentLanguageModel.get();
    if (!currentModel) {
      return;
    }
    const pool = this.getModelsForSessionType(this.getCurrentSessionType());
    if (!pool.some((m) => m.identifier === currentModel.identifier)) {
      this.initSelectedModel();
      this.checkModelInSessionPool();
    }
  }
  /**
   * Reconcile the current model after an explicit session-type pick: restore persisted → best-match previous → default.
   */
  revalidateModelForSessionType() {
    this._modelSelectionController.revalidateForSessionType(() => this.initSelectedModel());
  }
  /**
   * Reset the current mode when it is not valid for the current session type.
   */
  checkModeInSessionPool(sessionType) {
    if (!sessionType) {
      const sessionResource = this._widget?.viewModel?.model.sessionResource;
      if (!sessionResource) {
        return;
      }
      sessionType = getChatSessionType(sessionResource);
    }
    const customAgentTarget = this.chatSessionsService.getCustomAgentTargetForSessionType(sessionType);
    if (!customAgentTarget || customAgentTarget === Target.Undefined) {
      return;
    }
    const currentMode = this._currentModeObservable.get();
    if (currentMode.id === ChatMode.Agent.id) {
      return;
    }
    if (currentMode.isBuiltin) {
      this.setChatMode(ChatModeKind.Agent, false);
      return;
    }
    const modeTarget = currentMode.target.get();
    if (modeTarget !== customAgentTarget && modeTarget !== Target.Undefined) {
      this.setChatMode(ChatModeKind.Agent, false);
    }
  }
  /**
   * Pre-select the model in the model picker based on the `modelId` from the
   * last request in the current session's history. This ensures that when a
   * contributed chat session is reopened, the model picker shows the model
   * that was last used - providing continuity.
   */
  preselectModelFromSessionHistory() {
    this._modelSelectionController.clearHistoryIntent();
    const sessionModel = this._widget?.viewModel?.model;
    const sessionResource = sessionModel?.sessionResource;
    const requests = sessionModel?.getRequests();
    if (!sessionResource) {
      return;
    }
    if (!requests || requests.length === 0 || getChatSessionType(sessionResource) !== SessionType.CopilotCLI) {
      return;
    }
    const modeInfo = findLast(requests, (req) => !!req.modeInfo)?.modeInfo;
    if (modeInfo && modeInfo.modeInstructions?.uri) {
      this.setChatMode(modeInfo.modeInstructions.uri.toString());
    }
    const lastModelId = findLast(requests, (req) => !!req.modelId)?.modelId;
    if (!lastModelId) {
      return;
    }
    this._modelSelectionController.preselectFromHistory(lastModelId, sessionResource.toString());
  }
  setCurrentLanguageModelToDefault(forSessionType) {
    this._modelSelectionController.selectDefault(forSessionType ?? this.getCurrentSessionType());
  }
  /**
   * The raw configured default-model value from the
   * {@link ChatConfiguration.DefaultModel} setting (which may
   * be forced by enterprise policy). Returns `undefined` when nothing is
   * configured.
   */
  getConfiguredModelValue() {
    const model = this.configurationService.getValue(ChatConfiguration.DefaultModel)?.trim();
    return model ? model : void 0;
  }
  /** Resets the language model to the location default and cancels any pending model-selection intent. */
  resetLanguageModelToDefault() {
    this._modelSelectionController.clearIntent();
    this.setCurrentLanguageModelToDefault();
  }
  /**
   * Get the current input state for history
   */
  getCurrentInputState() {
    const mode = this._currentModeObservable.get();
    const selectedModel = this._currentLanguageModel.get();
    const state = {
      inputText: this._inputEditor?.getValue() ?? "",
      attachments: this._attachmentModel.attachments,
      mode: {
        id: mode.id,
        kind: mode.kind
      },
      selectedModel,
      modelConfiguration: selectedModel ? this._modelConfigStore.getModelConfiguration(selectedModel.identifier) : void 0,
      selections: this._inputEditor?.getSelections() || [],
      permissionLevel: this._currentPermissionLevel.get(),
      contrib: {}
    };
    for (const contrib of this._widget?.contribs || Iterable.empty()) {
      contrib.getInputState?.(state.contrib);
    }
    return state;
  }
  _getAriaLabel() {
    const verbose = this.configurationService.getValue(AccessibilityVerbositySettingId.Chat);
    let kbLabel;
    if (verbose) {
      kbLabel = this.keybindingService.lookupKeybinding(AccessibilityCommandId.OpenAccessibilityHelp)?.getLabel();
    }
    const mode = this._currentModeObservable.get();
    const modelName = this._currentLanguageModel.get()?.metadata.name;
    const modelInfo = modelName ? localize("chatInput.model", ", {0}. ", modelName) : "";
    let modeLabel = "";
    if (!mode.isBuiltin) {
      const mode2 = this.currentModeObs.get();
      modeLabel = localize("chatInput.mode.custom", "({0}), {1}", mode2.label.get(), mode2.description.get());
    } else {
      switch (this.currentModeKind) {
        case ChatModeKind.Agent:
          modeLabel = localize("chatInput.mode.agent", "(Agent), edit files in your workspace.");
          break;
        case ChatModeKind.Edit:
          modeLabel = localize("chatInput.mode.edit", "(Edit), edit files in your workspace.");
          break;
        case ChatModeKind.Ask:
        default:
          modeLabel = localize("chatInput.mode.ask", "(Ask), ask questions or type / for topics.");
          break;
      }
    }
    if (verbose) {
      return kbLabel ? localize("actions.chat.accessibiltyHelp", "Chat Input {0}{1} Press Enter to send out the request. Use {2} for Chat Accessibility Help.", modeLabel, modelInfo, kbLabel) : localize("chatInput.accessibilityHelpNoKb", "Chat Input {0}{1} Press Enter to send out the request. Use the Chat Accessibility Help command for more information.", modeLabel, modelInfo);
    } else {
      return localize("chatInput.accessibilityHelp", "Chat Input {0}{1}.", modeLabel, modelInfo);
    }
  }
  validateCurrentChatMode() {
    const currentMode = this._currentModeObservable.get();
    const validMode = this._currentChatModesObservable.get().findModeById(currentMode.id);
    const isAgentModeEnabled = this.configurationService.getValue(ChatConfiguration.AgentEnabled);
    if (!validMode) {
      this.setChatMode(isAgentModeEnabled ? ChatModeKind.Agent : ChatModeKind.Ask);
      return;
    }
    if (currentMode.kind === ChatModeKind.Agent && !isAgentModeEnabled) {
      this.setChatMode(ChatModeKind.Ask);
      return;
    }
  }
  /**
   * Re-apply the session's own persisted custom agent once its mode becomes available.
   *
   * A restored agent-host session persists its selected custom agent in `mode`, but the agent
   * host's custom modes only register after the backend connects. Until then `setChatMode` falls
   * back to the builtin Agent, so when the custom modes arrive (`modes.onDidChange`) re-apply the
   * persisted custom agent. Builtin/default modes are handled by {@link validateCurrentChatMode}.
   */
  _restorePersistedCustomModeIfAvailable() {
    const persistedMode = this._inputModel?.state.get()?.mode;
    if (!persistedMode) {
      return;
    }
    const modes = this._currentChatModesObservable.get();
    const found = modes.findModeById(persistedMode.id) ?? modes.findModeByName(persistedMode.id);
    if (found && !found.isBuiltin && this._currentModeObservable.get().id !== found.id) {
      this.setChatMode(found.id, false);
    }
  }
  logInputHistory() {
    const historyStr = this.history.values.map((entry) => JSON.stringify(entry)).join("\n");
    this.logService.info(`[${this.location}] Chat input history:`, historyStr);
  }
  setVisible(visible) {
    this._onDidChangeVisibility.fire(visible);
  }
  /** If consumers are busy generating the chat input, returns the promise resolved when they finish */
  get generating() {
    return this._generating?.defer.p;
  }
  /** Disables the input submissions buttons until the disposable is disposed. */
  startGenerating() {
    this.logService.trace("ChatWidget#startGenerating");
    if (this._generating) {
      this._generating.rc++;
    } else {
      this._generating = { rc: 1, defer: new DeferredPromise() };
    }
    return toDisposable(() => {
      this.logService.trace("ChatWidget#doneGenerating");
      if (this._generating && !--this._generating.rc) {
        this._generating.defer.complete();
        this._generating = void 0;
      }
    });
  }
  get element() {
    return this.container;
  }
  async showPreviousValue() {
    if (this.history.isAtStart()) {
      return;
    }
    const state = this.getCurrentInputState();
    if (state.inputText || state.attachments.length) {
      this.history.overlay(state);
    }
    this.navigateHistory(true);
  }
  async showNextValue() {
    if (this.history.isAtEnd()) {
      return;
    }
    const state = this.getCurrentInputState();
    if (state.inputText || state.attachments.length) {
      this.history.overlay(state);
    }
    this.navigateHistory(false);
  }
  /**
   * Restores attachments to the input, re-fetching image binary data as needed.
   */
  async restoreAttachments(attachments) {
    let restored = [...attachments];
    if (restored.length > 0) {
      restored = (await Promise.all(restored.map(async (attachment) => {
        if (isImageVariableEntry(attachment) && !attachment.value && attachment.references?.length && URI.isUri(attachment.references[0].reference)) {
          const currReference = attachment.references[0].reference;
          try {
            const imageBinary = currReference.toString(true).startsWith("http") ? await this.sharedWebExtracterService.readImage(currReference, CancellationToken.None) : (await this.fileService.readFile(currReference)).value;
            if (!imageBinary) {
              return void 0;
            }
            const newAttachment = { ...attachment };
            newAttachment.value = isImageVariableEntry(attachment) && attachment.isPasted ? imageBinary.buffer : await resizeImage(imageBinary.buffer);
            return newAttachment;
          } catch (err) {
            this.logService.error("Failed to fetch and reference.", err);
            return void 0;
          }
        }
        return attachment;
      }))).filter(isDefined);
    }
    this._attachmentModel.clearAndSetContext(...restored);
  }
  async navigateHistory(previous) {
    const historyEntry = previous ? this.history.previous() : this.history.next();
    await this.restoreAttachments(historyEntry?.attachments ?? []);
    const inputText = historyEntry?.inputText ?? "";
    const contribData = historyEntry?.contrib ?? {};
    aria.status(inputText);
    this.setValue(inputText, true);
    this._widget?.contribs.forEach((contrib) => {
      contrib.setInputState?.(contribData);
    });
    this._onDidLoadInputState.fire();
    const model = this._inputEditor.getModel();
    if (!model) {
      return;
    }
    if (previous) {
      this._inputEditor.setPosition({ lineNumber: 1, column: 1 });
    } else {
      this._inputEditor.setPosition(getLastPosition(model));
    }
  }
  setValue(value, transient) {
    this.inputEditor.setValue(value);
    const model = this.inputEditor.getModel();
    if (model) {
      this.inputEditor.setPosition(getLastPosition(model));
    }
  }
  focus() {
    this._inputEditor.focus();
  }
  hasFocus() {
    return this._inputEditor.hasWidgetFocus();
  }
  focusTodoList() {
    return this._chatInputTodoListWidget.value?.focus() ?? false;
  }
  isTodoListFocused() {
    return this._chatInputTodoListWidget.value?.hasFocus() ?? false;
  }
  hasVisibleTodos() {
    return this._chatInputTodoListWidget.value?.hasTodos() ?? false;
  }
  /**
   * Reset the input and update history.
   * @param userQuery If provided, this will be added to the history. Followups and programmatic queries should not be passed.
   */
  async acceptInput(isUserQuery, preserveFocus, preserveInput) {
    if (isUserQuery) {
      const userQuery = this.getCurrentInputState();
      this.history.append(this._getFilteredEntry(userQuery));
    }
    this.resetScrollbarVisibilityAfterAccept();
    this.chatInputNotificationService.handleMessageSent({
      sessionType: this._notificationModelTargetChatSessionType.get(),
      sessionResource: this._currentSessionResourceObservable.get()
    });
    if (this._chatSessionIsEmpty) {
      this._chatSessionIsEmpty = false;
      this._emptyInputState.set(void 0, void 0);
      this._emptyInputAttachments.set([], void 0);
    }
    if (preserveInput) {
      if (!preserveFocus) {
        this._inputEditor.focus();
      }
      return;
    }
    notifyDictationSubmitted(this._inputEditor);
    logChangesToStateModel(this._inputModel, `[ACCEPT] acceptInput -> attachmentModel.clear() in ${this._currentSessionKey}`, void 0, this._inputModel?.state.get(), this.logService);
    this.attachmentModel.clear();
    this._onDidLoadInputState.fire();
    if (this.accessibilityService.isScreenReaderOptimized() && isMacintosh) {
      this._acceptInputForVoiceover();
    } else if (preserveFocus) {
      this._inputEditor.setValue("");
    } else {
      this._inputEditor.focus();
      this._inputEditor.setValue("");
    }
  }
  validateAgentMode() {
    if (!this.agentService.hasToolsAgent && this._currentModeObservable.get().kind === ChatModeKind.Agent) {
      this.setChatMode(ChatModeKind.Edit);
    }
  }
  // A function that filters out specifically the `value` property of the attachment.
  _getFilteredEntry(inputState) {
    const attachmentsWithoutImageValues = inputState.attachments.map((attachment) => {
      if (isImageVariableEntry(attachment) && attachment.references?.length && attachment.value) {
        const newAttachment = { ...attachment };
        newAttachment.value = void 0;
        return newAttachment;
      }
      return attachment;
    });
    return { ...inputState, attachments: attachmentsWithoutImageValues };
  }
  _acceptInputForVoiceover() {
    const domNode = this._inputEditor.getDomNode();
    if (!domNode) {
      return;
    }
    domNode.remove();
    this._inputEditor.setValue("");
    this._inputEditorElement.appendChild(domNode);
    this._inputEditor.focus();
  }
  _handleAttachedContextChange() {
    this._hasFileAttachmentContextKey.set(Boolean(this._attachmentModel.attachments.find((a) => a.kind === "file")));
    this._updateInputContentContextKeys();
    this.renderAttachedContext();
  }
  /**
   * Toggle the "submit pending" state. While pending, the input reflects that a
   * submitted request is still being routed/dispatched (e.g. omni-chat routing,
   * where submission is intercepted and handled off-model) so the send button is
   * disabled until the submission resolves or the draft changes. Any input content
   * change clears this automatically.
   */
  setSubmitPending(pending, routing = pending) {
    this.inputSubmitPending.set(pending);
    this.inputRouting.set(routing);
  }
  _updateInputContentContextKeys() {
    const inputHasText = !!this._inputEditor?.getModel()?.getValue().trim();
    this.inputEditorHasText.set(inputHasText);
    const hasSendableContent = inputHasText || this._attachmentModel.attachments.some(isExplicitFileOrImageVariableEntry);
    this.inputEditorHasSendableContent.set(hasSendableContent && !this.hasNoAvailableModel() && !this.hasPendingProgrammaticModelSelection);
  }
  getOrCreateOptionEmitter(optionGroupId) {
    let emitter = this._chatSessionOptionEmitters.get(optionGroupId);
    if (!emitter) {
      emitter = new Emitter();
      this._chatSessionOptionEmitters.set(optionGroupId, emitter);
    }
    return emitter;
  }
  /**
   * Get or create a context key for an option group.
   * Context keys follow the pattern `chatSessionOption.<groupId>`.
   */
  getOrCreateOptionContextKey(optionGroupId) {
    if (!this._scopedContextKeyService) {
      return void 0;
    }
    let contextKey = this._optionContextKeys.get(optionGroupId);
    if (!contextKey) {
      const rawKey = new RawContextKey(`chatSessionOption.${optionGroupId}`, "");
      contextKey = rawKey.bindTo(this._scopedContextKeyService);
      this._optionContextKeys.set(optionGroupId, contextKey);
    }
    return contextKey;
  }
  /**
   * Update the context key for an option group with the current selection.
   * This enables `when` expressions on other option groups to react to changes.
   */
  updateOptionContextKey(optionGroupId, optionItemId) {
    const normalizedOptionId = optionItemId.trim();
    const contextKey = this.getOrCreateOptionContextKey(optionGroupId);
    if (contextKey) {
      contextKey.set(normalizedOptionId);
    }
  }
  /**
   * Evaluate whether an option group should be visible based on its `when` expression.
   * Returns true if the option group should be visible, false otherwise.
   */
  evaluateOptionGroupVisibility(optionGroup) {
    if (!optionGroup.when) {
      return true;
    }
    if (!this._scopedContextKeyService) {
      return true;
    }
    const expr = ContextKeyExpr.deserialize(optionGroup.when);
    if (!expr) {
      return true;
    }
    return this._scopedContextKeyService.contextMatchesRules(expr);
  }
  /**
   * Computes which option groups should be visible for the current session.
   *
   * A picker should show if and only if:
   * 1. We can determine a session type (from session context OR delegate)
   * 2. That session type has option groups registered
   * 3. At least one option group has items AND passes its `when` clause
   *
   * This method also updates the `chatSessionHasOptions` context key, which controls
   * whether the picker action is shown in the toolbar via its `when` clause.
   */
  getVisibleOptionGroupsModeAndUpdateContextKeys(sessionResource) {
    const customAgentTarget = sessionResource && this.chatSessionsService.getCustomAgentTargetForSessionType(getChatSessionType(sessionResource));
    this.chatSessionHasCustomAgentTarget.set(customAgentTarget !== Target.Undefined);
    const requiresCustomModels = sessionResource && this.chatSessionsService.requiresCustomModelsForSessionType(getChatSessionType(sessionResource));
    this.chatSessionHasTargetedModels.set(!!requiresCustomModels);
    const visibleOptionGroups = this.getVisibleOptionGroups(sessionResource);
    this.permissionWidget?.refresh();
    if (!visibleOptionGroups.length) {
      this.chatSessionHasOptions.set(false);
      this.chatSessionOptionsValid.set(true);
      this._updateInputContentContextKeys();
      return [];
    }
    const allOptionsValid = sessionResource ? this.areAllOptionsValid(sessionResource, visibleOptionGroups) : true;
    this.chatSessionHasOptions.set(true);
    this.chatSessionOptionsValid.set(allOptionsValid);
    this._updateInputContentContextKeys();
    return visibleOptionGroups;
  }
  getCurrentSessionResource() {
    return this._widget?.viewModel?.model.sessionResource;
  }
  getTerminalCommandPrefix() {
    const sessionResource = this.getCurrentSessionResource();
    return sessionResource ? this.chatSessionsService.getCapabilitiesForSessionType(getChatSessionType(sessionResource))?.terminalCommandPrefix : void 0;
  }
  updateInputEditorFontFamily() {
    if (!this._inputEditor) {
      return;
    }
    const isCommand = isTerminalCommandInput(this._inputEditor.getModel()?.getLineContent(1) || "", this.getTerminalCommandPrefix());
    this._inputEditor.updateOptions({ fontFamily: isCommand ? EDITOR_FONT_DEFAULTS.fontFamily : DEFAULT_FONT_FAMILY });
  }
  handleTerminalCommandPaste(e) {
    handleTerminalCommandPaste(e, this._inputEditor, this.getTerminalCommandPrefix(), this.dialogService, this.storageService);
  }
  areAllOptionsValid(sessionResource, visibleOptionGroups) {
    for (const optionGroup of visibleOptionGroups) {
      const currentOption = this.chatSessionsService.getSessionOption(sessionResource, optionGroup.id);
      if (currentOption) {
        const currentOptionId = typeof currentOption === "string" ? currentOption : currentOption.id;
        if (!optionGroup.items.some((item) => item.id === currentOptionId) && typeof currentOption === "string") {
          return false;
        }
      }
    }
    return true;
  }
  getAllOptionsGroups(sessionResource) {
    const delegateSessionType = this.options.sessionTypePickerDelegate?.getActiveSessionProvider?.();
    const effectiveSessionType = delegateSessionType ?? (sessionResource ? getChatSessionType(sessionResource) : void 0);
    if (!effectiveSessionType) {
      return [];
    }
    const allOptionGroups = this.chatSessionsService.getOptionGroupsForSessionType(effectiveSessionType);
    return allOptionGroups ?? [];
  }
  getVisibleOptionGroups(sessionResource) {
    const allOptionGroups = this.getAllOptionsGroups(sessionResource);
    if (!allOptionGroups.length) {
      return [];
    }
    if (sessionResource) {
      for (const optionGroup of allOptionGroups) {
        const currentOption = this.chatSessionsService.getSessionOption(sessionResource, optionGroup.id);
        if (currentOption) {
          const optionId = typeof currentOption === "string" ? currentOption : currentOption.id;
          this.updateOptionContextKey(optionGroup.id, optionId);
        }
      }
    }
    const visibleGroups = /* @__PURE__ */ new Map();
    for (const optionGroup of allOptionGroups) {
      if (optionGroup.kind === "permissions") {
        continue;
      }
      const hasItems = optionGroup.items.length > 0 || (optionGroup.commands || []).length > 0;
      const passesWhenClause = this.evaluateOptionGroupVisibility(optionGroup);
      const sessionHasOption = !sessionResource || this.chatSessionsService.getSessionOption(sessionResource, optionGroup.id) !== void 0;
      if (hasItems && passesWhenClause && sessionHasOption) {
        visibleGroups.set(optionGroup.id, optionGroup);
      }
    }
    return Array.from(visibleGroups.values());
  }
  /**
   * Returns the permissions-kind option group contributed by the active session provider, if any.
   * Items from this group are surfaced inside the chat permission picker, replacing the
   * built-in `ChatPermissionLevel` items. Honors the same visibility predicates as
   * {@link getVisibleOptionGroups} so that `when` clauses are respected.
   *
   * If the provider declares more than one permissions-kind group (which the API forbids),
   * the first one wins.
   */
  getActiveExtensionPermissionGroup(sessionResource) {
    const allOptionGroups = this.getAllOptionsGroups(sessionResource);
    return allOptionGroups.find(
      (g) => g.kind === "permissions" && g.items.length > 0 && this.evaluateOptionGroupVisibility(g)
    );
  }
  /**
   * Refresh all registered option groups for the current chat session.
   * Fires events for each option group with their current selection.
   */
  refreshChatSessionPickers() {
    const sessionResource = this.getCurrentSessionResource();
    const allOptionsGroups = this.getAllOptionsGroups(sessionResource);
    const visibleOptionGroups = this.getVisibleOptionGroupsModeAndUpdateContextKeys(sessionResource);
    if (!allOptionsGroups.length || !visibleOptionGroups.length) {
      this.hideAllSessionPickerWidgets();
      return;
    }
    const currentWidgetGroupIds = new Set(this.chatSessionPickerWidgets.keys());
    const needsRecreation = currentWidgetGroupIds.size !== visibleOptionGroups.length || !visibleOptionGroups.every((group) => currentWidgetGroupIds.has(group.id));
    if (needsRecreation && this._lastSessionPickerAction && this.chatSessionPickerContainer) {
      const widgets = this.createChatSessionPickerWidgets(this._lastSessionPickerAction, this._lastSessionPickerOptions);
      dom.clearNode(this.chatSessionPickerContainer);
      for (const widget of widgets) {
        const container = dom.$(".action-item.chat-sessionPicker-item");
        widget.render(container);
        this.chatSessionPickerContainer.appendChild(container);
      }
    }
    if (this.chatSessionPickerContainer) {
      this.chatSessionPickerContainer.style.display = "";
    }
    if (sessionResource) {
      for (const [optionGroupId] of this.chatSessionPickerWidgets) {
        const currentOption = this.chatSessionsService.getSessionOption(sessionResource, optionGroupId);
        if (currentOption) {
          const optionGroup = allOptionsGroups.find((g) => g.id === optionGroupId);
          if (optionGroup) {
            const currentOptionId = typeof currentOption === "string" ? currentOption : currentOption.id;
            const item = optionGroup.items.find((m) => m.id === currentOptionId);
            if (item && typeof currentOption === "string") {
              this.getOrCreateOptionEmitter(optionGroupId).fire(item);
            } else if (typeof currentOption !== "string") {
              this.getOrCreateOptionEmitter(optionGroupId).fire(currentOption);
            }
          }
        }
      }
    }
  }
  hideAllSessionPickerWidgets() {
    if (this.chatSessionPickerContainer) {
      this.chatSessionPickerContainer.style.display = "none";
    }
  }
  /**
   * Get the current option for a specific option group.
   * Returns undefined if the session doesn't have this option configured.
   */
  getCurrentOptionForGroup(optionGroupId) {
    const sessionResource = this._widget?.viewModel?.model.sessionResource;
    if (!sessionResource) {
      return;
    }
    if (this.chatSessionsService.getSessionOption(sessionResource, optionGroupId) === void 0) {
      return;
    }
    const effectiveSessionType = this.getEffectiveSessionType(sessionResource);
    const optionGroups = effectiveSessionType ? this.chatSessionsService.getOptionGroupsForSessionType(effectiveSessionType) : void 0;
    const optionGroup = optionGroups?.find((g) => g.id === optionGroupId);
    if (!optionGroup || optionGroup.items.length === 0) {
      return;
    }
    const currentOptionValue = this.chatSessionsService.getSessionOption(sessionResource, optionGroupId);
    if (!currentOptionValue) {
      const defaultItem = optionGroup.items.find((item) => item.default);
      return defaultItem;
    }
    if (typeof currentOptionValue === "string") {
      const normalizedOptionId = currentOptionValue.trim();
      return optionGroup.items.find((m) => m.id === normalizedOptionId);
    } else {
      return currentOptionValue;
    }
  }
  hasWorkspaceScmRepository() {
    const folders = this.workspaceContextService.getWorkspace().folders;
    if (folders.length === 0) {
      return false;
    }
    for (const repo of this.scmService.repositories) {
      if (repo.provider.rootUri && this.workspaceContextService.getWorkspaceFolder(repo.provider.rootUri)) {
        return true;
      }
    }
    return false;
  }
  getEffectiveSessionType(sessionResource) {
    return this.options.sessionTypePickerDelegate?.getActiveSessionProvider?.() ?? (sessionResource ? getChatSessionType(sessionResource) : void 0);
  }
  /**
   * Updates the agentSessionType context key based on delegate or actual session.
   */
  updateAgentSessionTypeContextKey() {
    const sessionResource = this._widget?.viewModel?.model.sessionResource;
    const delegate = this.options.sessionTypePickerDelegate;
    const delegateSessionType = delegate?.setActiveSessionProvider && delegate?.getActiveSessionProvider?.();
    const sessionType = delegateSessionType || (sessionResource ? getChatSessionType(sessionResource) : "");
    this.agentSessionTypeKey.set(sessionType);
    this.chatSessionSupportsDelegationKey.set(this.chatSessionsService.supportsDelegationForSessionType(sessionType));
  }
  /**
   * Updates the widget lock state based on a session type.
   * Local sessions unlock from coding agent mode, while remote/cloud sessions lock to coding agent mode.
   */
  updateWidgetLockStateFromSessionType(sessionType) {
    if (sessionType === localChatSessionType) {
      this._widget?.unlockFromCodingAgent();
      return;
    }
    const contribution = this.chatSessionsService.getChatSessionContribution(sessionType);
    if (contribution) {
      this._widget?.lockToCodingAgent(contribution.name, contribution.displayName, contribution.type, contribution.agentHostProviderId);
    } else {
      this._widget?.unlockFromCodingAgent();
    }
  }
  /**
   * Resolves the session type of the active chat session for the delegation picker.
   */
  getActiveSessionTypeForDelegation() {
    const sessionResource = this._widget?.viewModel?.sessionResource;
    return sessionResource ? getAgentSessionProvider(sessionResource) ?? getChatSessionType(sessionResource) : void 0;
  }
  /**
   * Selects (or clears) the pending delegation target. While a target is pending, the widget
   * locks to the target agent and the `hasPendingDelegationTarget` context key hides the
   * agent and model pickers. Re-selecting the active session clears the pending target and
   * restores the pickers.
   */
  continueInSession(provider) {
    this.setPendingDelegationTarget(provider);
    this.focus();
  }
  setPendingDelegationTarget(provider) {
    const isActive = this.getActiveSessionTypeForDelegation() === provider;
    this._pendingDelegationTarget = isActive ? void 0 : provider;
    this.chatHasPendingDelegationTargetKey.set(!!this._pendingDelegationTarget);
    this.updateWidgetLockStateFromSessionType(provider);
    this.updateAgentSessionTypeContextKey();
    this.refreshChatSessionPickers();
  }
  /**
   * Ensures the notification widget is instantiated and appended to the notification container.
   */
  ensureNotificationWidget() {
    if (!this._notificationWidget.value) {
      this._notificationWidget.value = this.instantiationService.createInstance(ChatInputNotificationWidget, {
        modelTargetChatSessionType: this._notificationModelTargetChatSessionType,
        sessionResource: this._currentSessionResourceObservable,
        openModelPicker: () => this.openModelPicker(),
        switchToModel: (modelIdentifier) => this.switchModelByIdentifier(
          modelIdentifier,
          /* storeSelection */
          true,
          /* isUserAction */
          true
        ),
        onDidChangeVisibility: (visible) => this.options.onDidChangeInputNotificationVisible?.(visible)
      });
      this.chatInputNotificationContainer.appendChild(this._notificationWidget.value.domNode);
    }
  }
  /**
   * Lazy-instantiate the goal banner widget on first use.
   */
  ensureGoalBannerWidget() {
    if (!this._goalBannerWidget.value) {
      const widget = new ChatGoalBannerWidget();
      this._register(widget.onDismiss(() => this._onDidDismissGoalBanner.fire()));
      this._goalBannerWidget.value = widget;
      this.chatGoalBannerContainer.appendChild(widget.domNode);
    }
    return this._goalBannerWidget.value;
  }
  /** Shows the autopilot goal banner with a loading state. */
  showGoalBannerLoading() {
    this.ensureGoalBannerWidget().setLoading();
  }
  /** Updates the goal banner with the given summary text. */
  setGoalBanner(summary) {
    this.ensureGoalBannerWidget().setGoal(summary);
  }
  /** Hides the goal banner. */
  clearGoalBanner() {
    this._goalBannerWidget.value?.clear();
  }
  /**
   * Shows the context usage details popup and focuses it.
   * @returns Whether the details were successfully shown.
   */
  showContextUsageDetails() {
    return this.contextUsageWidget?.showDetails() ?? false;
  }
  /**
   * Updates the context usage widget based on the current model.
   */
  updateContextUsageWidget() {
    this._contextUsageDisposables.clear();
    const model = this._widget?.viewModel?.model;
    if (!model || !this.contextUsageWidget) {
      return;
    }
    const store = new DisposableStore();
    this._contextUsageDisposables.value = store;
    let lastRequest = model.lastRequest;
    const observePreviousResponse = (request) => {
      if (request?.response) {
        store.add(request.response.onDidChange(() => this.contextUsageWidget?.updateSessionCost(model.sessionCost)));
      }
    };
    for (const request of model.getRequests().slice(0, -1)) {
      observePreviousResponse(request);
    }
    store.add(model.onDidChange((e) => {
      if (e.kind === "addRequest") {
        observePreviousResponse(lastRequest);
        lastRequest = e.request;
        this.contextUsageWidget?.update(model.lastRequest);
      } else if (e.kind === "completedRequest") {
        this.contextUsageWidget?.update(model.lastRequest);
      }
    }));
    store.add(this.languageModelsService.onDidChangeLanguageModels(() => {
      const lastRequest2 = model.lastRequest;
      if (lastRequest2?.modelId) {
        this.contextUsageWidget?.update(lastRequest2);
      }
    }));
    this.contextUsageWidget.update(model.lastRequest);
  }
  handleViewModelChange(e) {
    transaction((observableTransaction) => {
      try {
        this.updateInputEditorFontFamily();
        this.resetPendingDelegationForViewModelChange(observableTransaction);
        this.refreshViewModelScopedState();
        this.clearQuestionCarouselIfSessionChanged(e);
        this.clearPlanReviewIfSessionChanged(e);
        this._syncToolConfirmationCarouselForSession();
        this.reconcileSessionTypeForViewModelChange(e, observableTransaction);
        this.preselectModelFromSessionHistory();
      } finally {
        this._modelSelectionController.endSessionSwitch();
      }
    });
    this._modelSelectionController.applyConfiguredDefault();
  }
  resetPendingDelegationForViewModelChange(transaction2) {
    this._pendingDelegationTargetObservable.set(void 0, transaction2);
    this.chatHasPendingDelegationTargetKey.set(false);
  }
  refreshViewModelScopedState() {
    this.updateAgentSessionTypeContextKey();
    this.refreshChatSessionPickers();
    this.ensureNotificationWidget();
    this.updateContextUsageWidget();
  }
  clearQuestionCarouselIfSessionChanged(e) {
    let hasMatchingResource = false;
    if (e.currentSessionResource) {
      for (const r of this._questionCarouselSessionResources.values()) {
        if (isEqual(r, e.currentSessionResource)) {
          hasMatchingResource = true;
          break;
        }
      }
    }
    if (this._questionCarouselSessionResources.size > 0 && (!e.currentSessionResource || !hasMatchingResource)) {
      this.clearQuestionCarousel();
    }
  }
  clearPlanReviewIfSessionChanged(e) {
    let hasMatchingPlanReviewResource = false;
    if (e.currentSessionResource) {
      for (const r of this._planReviewSessionResources.values()) {
        if (isEqual(r, e.currentSessionResource)) {
          hasMatchingPlanReviewResource = true;
          break;
        }
      }
    }
    if (this._planReviewSessionResources.size > 0 && (!e.currentSessionResource || !hasMatchingPlanReviewResource)) {
      this.clearPlanReview();
    }
  }
  reconcileSessionTypeForViewModelChange(e, transaction2) {
    this._currentSessionResourceObservable.set(e.currentSessionResource, transaction2);
    const newSessionType = this.getCurrentSessionType();
    if (e.currentSessionResource && this._currentSessionType && newSessionType !== this._currentSessionType) {
      logChangesToStateModel(this._inputModel, `[CVVM].1 onDidChangeViewModel -> session change: ${this._currentSessionType} -> ${newSessionType} in ${this._currentSessionKey}, ${e.currentSessionResource.toString()}`, void 0, this._inputModel?.state.get(), this.logService);
      this._currentSessionTypeObservable.set(newSessionType, transaction2);
      this.initSelectedModel();
      this.checkModelInSessionPool();
      this.checkModeInSessionPool();
    } else if (e.currentSessionResource) {
      logChangesToStateModel(this._inputModel, `[CVVM].2 onDidChangeViewModel -> session change: ${this._currentSessionType} -> ${newSessionType} in ${this._currentSessionKey}, ${e.currentSessionResource.toString()}`, void 0, this._inputModel?.state.get(), this.logService);
      this._currentSessionTypeObservable.set(newSessionType, transaction2);
      this.restorePerTypeModelAfterViewModelAssignment();
      this.reinitializeIfModelInvalidForPool();
    }
  }
  restorePerTypeModelAfterViewModelAssignment() {
    if (this._modelSelectionController.restorePerTypeModel) {
      this.initSelectedModel();
      if (!this._modelSelectionController.hasPendingIntent() && !this._modelSelectionController.isAwaitingRememberedModel()) {
        this.checkModelInSessionPool();
      }
    }
  }
  render(container, initialValue, widget) {
    this._widget = widget;
    this._currentSessionResourceObservable.set(widget.viewModel?.sessionResource, void 0);
    this.getVisibleOptionGroupsModeAndUpdateContextKeys(this.getCurrentSessionResource());
    const delegate = this.options.sessionTypePickerDelegate;
    if (delegate?.setActiveSessionProvider && delegate?.getActiveSessionProvider) {
      const initialSessionType = delegate.getActiveSessionProvider();
      if (initialSessionType) {
        this.updateWidgetLockStateFromSessionType(initialSessionType);
      }
    }
    this._register(widget.onDidChangeViewModel((e) => this.handleViewModelChange(e)));
    let elements;
    if (this.options.renderStyle === "compact") {
      elements = dom.h(".interactive-input-part", [
        dom.h(".chat-input-persistent-content@persistentContentContainer"),
        dom.h(".interactive-input-and-edit-session", [
          dom.h(".chat-plan-review-widget-container@chatPlanReviewContainer"),
          dom.h(".chat-question-carousel-widget-container@chatQuestionCarouselContainer"),
          dom.h(".chat-tool-confirmation-carousel-container@chatToolConfirmationCarouselContainer"),
          dom.h(".chat-input-notification-container@chatInputNotificationContainer"),
          dom.h(".voice-mode-onboarding-container@voiceModeOnboardingContainer"),
          dom.h(".dictation-onboarding-container@dictationOnboardingContainer"),
          dom.h(".chat-goal-banner-container@chatGoalBannerContainer"),
          dom.h(".chat-todo-list-widget-container@chatInputTodoListWidgetContainer"),
          dom.h(".chat-artifacts-widget-container@chatArtifactsWidgetContainer"),
          dom.h(".chat-editing-session@chatEditingSessionWidgetContainer"),
          dom.h(".chat-getting-started-tip-container@chatGettingStartedTipContainer"),
          dom.h(".interactive-input-and-side-toolbar@inputAndSideToolbar", [
            dom.h(".chat-input-container@inputContainer", [
              dom.h(".chat-editor-container@editorContainer"),
              dom.h(".chat-input-toolbars@inputToolbars")
            ])
          ]),
          dom.h(".chat-secondary-toolbar@secondaryToolbar", [
            dom.h(".chat-context-usage-container@contextUsageWidgetContainer"),
            dom.h(".chat-input-status-container@statusToolbarContainer")
          ]),
          dom.h(".chat-attachments-container@attachmentsContainer", [
            dom.h(".chat-attached-context@attachedContextContainer")
          ]),
          dom.h(".interactive-input-followups@followupsContainer")
        ])
      ]);
    } else {
      elements = dom.h(".interactive-input-part", [
        dom.h(".chat-input-persistent-content@persistentContentContainer"),
        dom.h(".chat-plan-review-widget-container@chatPlanReviewContainer"),
        dom.h(".chat-question-carousel-widget-container@chatQuestionCarouselContainer"),
        dom.h(".chat-tool-confirmation-carousel-container@chatToolConfirmationCarouselContainer"),
        dom.h(".interactive-input-followups@followupsContainer"),
        dom.h(".chat-input-notification-container@chatInputNotificationContainer"),
        dom.h(".voice-mode-onboarding-container@voiceModeOnboardingContainer"),
        dom.h(".dictation-onboarding-container@dictationOnboardingContainer"),
        dom.h(".chat-goal-banner-container@chatGoalBannerContainer"),
        dom.h(".chat-todo-list-widget-container@chatInputTodoListWidgetContainer"),
        dom.h(".chat-artifacts-widget-container@chatArtifactsWidgetContainer"),
        dom.h(".chat-editing-session@chatEditingSessionWidgetContainer"),
        dom.h(".chat-getting-started-tip-container@chatGettingStartedTipContainer"),
        dom.h(".interactive-input-and-side-toolbar@inputAndSideToolbar", [
          dom.h(".chat-input-container@inputContainer", [
            dom.h(".chat-attachments-container@attachmentsContainer", [
              dom.h(".chat-attached-context@attachedContextContainer")
            ]),
            dom.h(".chat-editor-container@editorContainer"),
            dom.h(".chat-input-toolbars@inputToolbars")
          ])
        ]),
        dom.h(".chat-secondary-toolbar@secondaryToolbar", [
          dom.h(".chat-context-usage-container@contextUsageWidgetContainer"),
          dom.h(".chat-input-status-container@statusToolbarContainer")
        ])
      ]);
    }
    this.container = elements.root;
    this.persistentContentContainer = elements.persistentContentContainer;
    this.chatInputOverlay = dom.$(".chat-input-overlay");
    container.append(this.container);
    this.container.append(this.chatInputOverlay);
    this.container.classList.toggle("compact", this.options.renderStyle === "compact");
    this._scopedContextKeyService = this._register(this.contextKeyService.createScoped(this.container));
    this.followupsContainer = elements.followupsContainer;
    const inputAndSideToolbar = elements.inputAndSideToolbar;
    const inputContainer = elements.inputContainer;
    this.inputContainer = inputContainer;
    const editorContainer = elements.editorContainer;
    this.attachmentsContainer = elements.attachmentsContainer;
    this.attachedContextContainer = elements.attachedContextContainer;
    const toolbarsContainer = elements.inputToolbars;
    this.secondaryToolbarContainer = elements.secondaryToolbar;
    if (this.options.renderStyle === "compact") {
      this.secondaryToolbarContainer.style.display = "none";
    }
    this.chatEditingSessionWidgetContainer = elements.chatEditingSessionWidgetContainer;
    this.chatInputTodoListWidgetContainer = elements.chatInputTodoListWidgetContainer;
    this.chatArtifactsWidgetContainer = elements.chatArtifactsWidgetContainer;
    this.chatGettingStartedTipContainer = elements.chatGettingStartedTipContainer;
    this.chatGettingStartedTipContainer.style.display = "none";
    this.chatQuestionCarouselContainer = elements.chatQuestionCarouselContainer;
    this.chatPlanReviewContainer = elements.chatPlanReviewContainer;
    this.chatToolConfirmationCarouselContainer = elements.chatToolConfirmationCarouselContainer;
    dom.hide(this.chatToolConfirmationCarouselContainer);
    this.chatInputNotificationContainer = elements.chatInputNotificationContainer;
    const onDidChangeInputOnboardingVisible = () => this.options.onDidChangeInputOnboardingVisible?.(
      this.voiceModeOnboardingService.isVisible || this.dictationOnboardingService.isVisible
    );
    this._register(this.voiceModeOnboardingService.registerHost(elements.voiceModeOnboardingContainer, this.container, () => this.focus(), elements.chatGettingStartedTipContainer, onDidChangeInputOnboardingVisible));
    this._register(this.dictationOnboardingService.registerHost(elements.dictationOnboardingContainer, this.container, elements.chatGettingStartedTipContainer, onDidChangeInputOnboardingVisible));
    this.chatGoalBannerContainer = elements.chatGoalBannerContainer;
    this.contextUsageWidgetContainer = elements.contextUsageWidgetContainer;
    this.statusToolbarContainer = elements.statusToolbarContainer;
    if (this.options.renderStyle === "compact") {
      toolbarsContainer.prepend(this.contextUsageWidgetContainer);
    }
    this.contextUsageWidget = this._register(this.instantiationService.createInstance(ChatContextUsageWidget));
    this.contextUsageWidget.setChatWidget(widget);
    this.contextUsageWidget.setSelectedModel(this._currentLanguageModel.get()?.identifier);
    this.contextUsageWidget.setModelConfigurationResolver(
      (modelId) => this.getModelConfiguration(modelId),
      this._modelConfigStore.onDidChange
    );
    this.contextUsageWidgetContainer.appendChild(this.contextUsageWidget.domNode);
    if (this.options.enableImplicitContext && !this._implicitContext) {
      this._implicitContext = this._register(
        this.instantiationService.createInstance(ChatImplicitContexts)
      );
      this.setImplicitContextEnablement();
      this._register(this._implicitContext.onDidChangeValue(() => {
        this._indexOfLastAttachedContextDeletedWithKeyboard = -1;
        this._handleAttachedContextChange();
      }));
    } else if (!this.options.enableImplicitContext && this._implicitContext) {
      this._implicitContext?.dispose();
      this._implicitContext = void 0;
    }
    this.ensureNotificationWidget();
    this._register(this._attachmentModel.onDidChange((e) => {
      if (e.added.length > 0) {
        this._indexOfLastAttachedContextDeletedWithKeyboard = -1;
      }
      this._handleAttachedContextChange();
    }));
    this.renderChatEditingSessionState(null);
    this.dnd.addOverlay(this.options.dndContainer ?? container, this.options.dndContainer ?? container);
    const inputScopedContextKeyService = this._register(this.contextKeyService.createScoped(inputContainer));
    ChatContextKeys.inChatInput.bindTo(inputScopedContextKeyService).set(true);
    this.currentlyEditingInputKey = ChatContextKeys.currentlyEditingInput.bindTo(inputScopedContextKeyService);
    this.editingSentRequestKey = ChatContextKeys.editingRequestType.bindTo(this.contextKeyService);
    const scopedInstantiationService = this._register(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, inputScopedContextKeyService])));
    const { historyNavigationBackwardsEnablement, historyNavigationForwardsEnablement } = this._register(registerAndCreateHistoryNavigationContext(inputScopedContextKeyService, this));
    this.historyNavigationBackwardsEnablement = historyNavigationBackwardsEnablement;
    this.historyNavigationForewardsEnablement = historyNavigationForwardsEnablement;
    const options = getSimpleEditorOptions(this.configurationService);
    options.overflowWidgetsDomNode = this.options.editorOverflowWidgetsDomNode;
    options.pasteAs = EditorOptions.pasteAs.defaultValue;
    options.readOnly = false;
    options.ariaLabel = this._getAriaLabel();
    options.fontFamily = DEFAULT_FONT_FAMILY;
    options.fontSize = 13;
    options.lineHeight = INPUT_EDITOR_LINE_HEIGHT;
    options.padding = this.options.renderStyle === "compact" ? INPUT_EDITOR_PADDING.compact : INPUT_EDITOR_PADDING.default;
    options.cursorWidth = 1;
    options.wrappingStrategy = "advanced";
    options.bracketPairColorization = { enabled: false };
    options.autoClosingBrackets = this.configurationService.getValue("editor.autoClosingBrackets");
    options.autoClosingQuotes = this.configurationService.getValue("editor.autoClosingQuotes");
    options.autoSurround = this.configurationService.getValue("editor.autoSurround");
    options.quickSuggestions = false;
    options.suggest = {
      showIcons: true,
      showSnippets: false,
      showWords: true,
      showStatusBar: false,
      insertMode: "insert",
      fitWidthToDetails: true
    };
    options.scrollbar = this.options.renderStyle === "compact" ? { ...options.scrollbar ?? {}, vertical: "hidden" } : {
      ...options.scrollbar ?? {},
      vertical: "auto",
      verticalScrollbarSize: 7
    };
    options.stickyScroll = { enabled: false };
    this._inputEditorElement = dom.append(editorContainer, $(chatInputEditorContainerSelector));
    const editorOptions = getSimpleCodeEditorWidgetOptions();
    editorOptions.contributions?.push(...EditorExtensionsRegistry.getSomeEditorContributions([ContentHoverController.ID, GlyphHoverController.ID, DropIntoEditorController.ID, CopyPasteController.ID, LinkDetector.ID, InlineCompletionsController.ID, PlaceholderTextContribution.ID]));
    this._inputEditor = this._register(scopedInstantiationService.createInstance(CodeEditorWidget, this._inputEditorElement, options, editorOptions));
    this.updateInputEditorFontFamily();
    this._register(addDisposableListener(this._inputEditorElement, dom.EventType.PASTE, (e) => this.handleTerminalCommandPaste(e), true));
    SuggestController.get(this._inputEditor)?.forceRenderingAbove();
    options.overflowWidgetsDomNode?.classList.add("hideSuggestTextIcons");
    this._inputEditorElement.classList.add("hideSuggestTextIcons");
    this._register(this._inputEditor.onKeyDown((e) => {
      if (e.keyCode === KeyCode.Enter && !hasModifierKeys(e)) {
        for (const keybinding of this.keybindingService.lookupKeybindings(ChatSubmitAction.ID)) {
          const chords = keybinding.getDispatchChords();
          const isPlainEnter = chords.length === 1 && chords[0] === "[Enter]";
          if (isPlainEnter) {
            e.preventDefault();
            break;
          }
        }
      }
    }));
    this._register(this._inputEditor.onDidChangeModelContent(() => {
      const currentHeight = Math.min(this._inputEditor.getContentHeight(), this._effectiveInputEditorMaxHeight);
      if (currentHeight !== this.inputEditorHeight) {
        this.inputEditorHeight = currentHeight;
        if (this.cachedWidth) {
          this._layout(this.cachedWidth);
        }
      }
      this._updateInputContentContextKeys();
      this.inputSubmitPending.set(false);
      this.inputRouting.set(false);
      this.updateInputEditorFontFamily();
      this._syncTextDebounced.schedule();
    }));
    this._register(this._inputEditor.onDidContentSizeChange((e) => {
      if (e.contentHeightChanged) {
        this.inputEditorHeight = !this.inline ? e.contentHeight : this.inputEditorHeight;
        if (this.cachedWidth) {
          this._layout(this.cachedWidth);
        }
      }
    }));
    this._register(this._inputEditor.onDidFocusEditorText(() => {
      this.inputEditorHasFocus.set(true);
      this._onDidFocus.fire();
      inputContainer.classList.toggle("focused", true);
    }));
    this._register(this._inputEditor.onDidBlurEditorText(() => {
      this.inputEditorHasFocus.set(false);
      inputContainer.classList.toggle("focused", false);
      this._onDidBlur.fire();
    }));
    this._register(this._inputEditor.onDidBlurEditorWidget(() => {
      CopyPasteController.get(this._inputEditor)?.clearWidgets();
      DropIntoEditorController.get(this._inputEditor)?.clearWidgets();
    }));
    const hoverDelegate = this._register(createInstantHoverDelegate());
    const { location } = this.getWidgetLocationInfo(widget);
    const focusedWidget = observableFromEvent(this, this.chatWidgetService.onDidChangeFocusedSession, () => this.chatWidgetService.lastFocusedWidget);
    const isVoiceInputActive = derived(this, (reader) => focusedWidget.read(reader) === widget);
    const isOmniInput = this.contextKeyService.getContextKeyValue(ChatContextKeys.inChatInputWindow.key) === true;
    const isVoiceSessionActive = derived(this, (reader) => {
      const omniInputActive = this.voiceSessionController.omniInputActive.read(reader);
      if (omniInputActive) {
        return isOmniInput;
      }
      if (!isVoiceInputActive.read(reader)) {
        return false;
      }
      const target = this.voiceSessionController.targetSession.read(reader);
      const hasDraftTarget = this.voiceSessionController.hasDraftTarget.read(reader);
      const resource = widget.viewModel?.sessionResource;
      return !hasDraftTarget && (!target || !!resource && isEqual(target, resource));
    });
    const pickerOptions = {
      getOverflowAnchor: () => this.inputActionsToolbar.getElement(),
      actionContext: { widget },
      compact: derived((reader) => this._stableInputPartWidth.read(reader) < CHAT_INPUT_PICKER_COLLAPSE_WIDTH),
      listOptions: this.options.inputPickerPosition === void 0 ? void 0 : { anchorPosition: this.options.inputPickerPosition }
    };
    const primarySessionPickerOptions = {
      ...pickerOptions,
      compact: constObservable(true)
    };
    const secondaryPickerOptions = {
      ...pickerOptions,
      getOverflowAnchor: () => this.secondaryToolbar.getElement(),
      compact: constObservable(true)
    };
    this._register(dom.addStandardDisposableListener(toolbarsContainer, dom.EventType.CLICK, (e) => this.inputEditor.focus()));
    this._register(dom.addStandardDisposableListener(this.attachmentsContainer, dom.EventType.CLICK, (e) => this.inputEditor.focus()));
    const shorterChatInputActionIds = /* @__PURE__ */ new Set([
      OpenModePickerAction.ID,
      ConfigureToolsAction.ID
    ]);
    this.inputActionsToolbar = this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, this.options.renderInputToolbarBelowInput ? this.attachmentsContainer : toolbarsContainer, MenuId.ChatInput, {
      telemetrySource: this.options.menus.telemetrySource,
      menuOptions: { shouldForwardArgs: true },
      hiddenItemStrategy: HiddenItemStrategy.NoHide,
      hoverDelegate,
      responsiveBehavior: {
        enabled: true,
        kind: "last",
        minItems: 1,
        actionMinWidth: 48,
        getActionMinWidth: (action) => shorterChatInputActionIds.has(action.id) ? 22 : void 0
      },
      actionViewItemProvider: (action, options2) => {
        if (this.chatPhoneInputPresenter.enabled.get()) {
          if (action.id === OpenModelPickerAction.ID && action instanceof MenuItemAction) {
            if (!this._currentLanguageModel.get()) {
              logChangesToStateModel(this._inputModel, `actionViewItemProvider[phone]: _currentLanguageModel is undefined at toolbar build, forcing default for ${this._currentSessionKey}`, void 0, void 0, this.logService);
              this.setCurrentLanguageModelToDefault();
            }
            const modelDelegate = this._createModelPickerDelegate();
            const modeDelegate = this._createModePickerDelegate();
            return this.instantiationService.createInstance(MobileChatInputCombinedPickerActionItem, action, modeDelegate, modelDelegate);
          } else if (action.id === OpenModePickerAction.ID && action instanceof MenuItemAction) {
            return new HiddenActionViewItem(action);
          }
        }
        if (action.id === OpenModelPickerAction.ID && action instanceof MenuItemAction) {
          if (!this._currentLanguageModel.get()) {
            logChangesToStateModel(this._inputModel, `actionViewItemProvider[desktop]: _currentLanguageModel is undefined at toolbar build, forcing default for ${this._currentSessionKey}`, void 0, void 0, this.logService);
            this.setCurrentLanguageModelToDefault();
          }
          const itemDelegate = this._createModelPickerDelegate();
          return this.modelWidget = this.instantiationService.createInstance(ModelPickerActionItem, action, itemDelegate, pickerOptions);
        } else if (action.id === OpenModePickerAction.ID && action instanceof MenuItemAction) {
          const delegate2 = this._createModePickerDelegate();
          return this.modeWidget = this.instantiationService.createInstance(ModePickerActionItem, action, delegate2, pickerOptions);
        } else if ((action.id === OpenSessionTargetPickerAction.ID || action.id === OpenDelegationPickerAction.ID) && action instanceof MenuItemAction) {
          const delegate2 = this.options.sessionTypePickerDelegate ?? {
            getActiveSessionProvider: () => {
              return this.getActiveSessionTypeForDelegation();
            },
            getPendingDelegationTarget: () => {
              return this._pendingDelegationTarget;
            },
            setPendingDelegationTarget: (provider) => {
              this.setPendingDelegationTarget(provider);
            },
            hasGitRepository: () => this.hasWorkspaceScmRepository()
          };
          const isWelcomeViewMode = !!this.options.sessionTypePickerDelegate?.setActiveSessionProvider;
          const Picker = action.id === OpenSessionTargetPickerAction.ID || isWelcomeViewMode ? SessionTypePickerActionItem : DelegationSessionPickerActionItem;
          return this.sessionTargetWidget = this.instantiationService.createInstance(Picker, action, location === "editor" /* Editor */ ? "editor" : "sidebar", delegate2, pickerOptions);
        } else if (action.id === ChatSessionPrimaryPickerAction.ID && action instanceof MenuItemAction) {
          const widgets = this.createChatSessionPickerWidgets(action, primarySessionPickerOptions);
          if (widgets.length === 0) {
            return new HiddenActionViewItem(action);
          }
          return this.instantiationService.createInstance(ChatSessionPickersContainerActionItem, action, widgets);
        }
        return void 0;
      }
    }));
    this.inputActionsToolbar.getElement().classList.add("chat-input-toolbar");
    this.inputActionsToolbar.context = { widget };
    this._register(this.inputActionsToolbar.onDidChangeMenuItems(() => {
      const toolbarElement = this.inputActionsToolbar.getElement();
      const primaryPickerContainer = toolbarElement.querySelector(".chat-sessionPicker-container");
      if (primaryPickerContainer) {
        this.chatSessionPickerContainer = primaryPickerContainer;
      }
      if (this.cachedWidth && typeof this.cachedInputToolbarWidth === "number" && this.cachedInputToolbarWidth !== this.inputActionsToolbar.getItemsWidth()) {
        this._toolbarRelayoutScheduler.schedule();
      }
    }));
    this._register(autorun((reader) => {
      pickerOptions.compact.read(reader);
      queueMicrotask(() => this.inputActionsToolbar.relayout());
    }));
    let lastPhoneEnabled = this.chatPhoneInputPresenter.enabled.get();
    this._register(autorun((reader) => {
      const enabled = this.chatPhoneInputPresenter.enabled.read(reader);
      if (enabled !== lastPhoneEnabled) {
        lastPhoneEnabled = enabled;
        this.inputActionsToolbar.refresh();
      }
    }));
    this.executeToolbar = this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, toolbarsContainer, this.options.menus.executeToolbar, {
      telemetrySource: this.options.menus.telemetrySource,
      menuOptions: {
        shouldForwardArgs: true
      },
      hoverDelegate,
      hiddenItemStrategy: HiddenItemStrategy.NoHide,
      actionViewItemProvider: (action, options2) => {
        if (action.id === ChatVoiceInputModeAction.ID) {
          return this.instantiationService.createInstance(VoiceInputModeActionViewItem, action, {
            isActive: isVoiceInputActive,
            isVoiceActive: isVoiceSessionActive,
            activateVoiceMode: isOmniInput ? () => {
              this.voiceSessionController.takeOmniInputOwnership(dom.getWindow(toolbarsContainer));
            } : void 0
          });
        }
        if ((action.id === ChatSubmitAction.ID || action.id === ChatEditingSessionSubmitAction.ID) && action instanceof MenuItemAction) {
          return this.instantiationService.createInstance(class extends MenuEntryActionViewItem {
            render(container2) {
              super.render(container2);
              container2.classList.add("chat-submit-button");
            }
          }, action, options2);
        }
        if ((action.id === ChatSpeechToTextPreparingAction.ID || action.id === ChatSpeechToTextConnectingAction.ID) && action instanceof MenuItemAction) {
          return this.instantiationService.createInstance(DictationDownloadActionViewItem, action, options2);
        }
        if (action.id === ToggleChatSpeechToTextAction.ID && action instanceof MenuItemAction) {
          return this.instantiationService.createInstance(DictationActionViewItem, action, options2);
        }
        if ((action.id === "agentsVoice.startVoiceInChat" || action.id === "agentsVoice.pttStopInChat") && action instanceof MenuItemAction) {
          return this.instantiationService.createInstance(VoiceModeActionViewItem, action, options2);
        }
        return void 0;
      }
    }));
    this.executeToolbar.getElement().classList.add("chat-execute-toolbar");
    this.executeToolbar.context = { widget };
    const voiceInputActionIconClasses = new Set([
      Codicon.mic,
      Codicon.micFilled,
      Codicon.micDownloadCompact,
      Codicon.voiceModeCompact,
      Codicon.loadingCompact,
      Codicon.debugDisconnectCompact
    ].map((icon) => ThemeIcon.asClassName(icon)));
    const updateVoiceInputActionBorder = () => {
      let voiceInputActionCount = 0;
      for (let i = 0; ; i++) {
        const action = this.executeToolbar.getItemAction(i);
        if (!action) {
          break;
        }
        if (action.class && voiceInputActionIconClasses.has(action.class)) {
          voiceInputActionCount++;
        }
      }
      this.executeToolbar.getElement().classList.toggle("chat-voice-input-actions-multiple", voiceInputActionCount > 1);
    };
    updateVoiceInputActionBorder();
    this._register(this.executeToolbar.onDidChangeMenuItems(() => {
      updateVoiceInputActionBorder();
      if (this.cachedWidth && typeof this.cachedExecuteToolbarWidth === "number" && this.cachedExecuteToolbarWidth !== this.executeToolbar.getItemsWidth()) {
        this._toolbarRelayoutScheduler.schedule();
      }
    }));
    if (this.options.menus.inputSideToolbar) {
      const toolbarSide = this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, inputAndSideToolbar, this.options.menus.inputSideToolbar, {
        telemetrySource: this.options.menus.telemetrySource,
        menuOptions: {
          shouldForwardArgs: true
        },
        hoverDelegate
      }));
      this.inputSideToolbarContainer = toolbarSide.getElement();
      toolbarSide.getElement().classList.add("chat-side-toolbar");
      toolbarSide.context = { widget };
    }
    const agentHostShortPickerMinWidths = /* @__PURE__ */ new Map([
      [OpenAgentHostModePickerAction.ID, 22],
      ["sessions.agentHost.runningSessionModePicker", 22],
      [OpenAgentHostAutoApprovePickerAction.ID, 22],
      [OpenAgentHostPermissionModePickerAction.ID, 22],
      [OpenAgentHostCodexApprovalsPickerAction.ID, 22],
      [OpenAgentHostFolderPickerAction.ID, 22],
      ["sessions.tunnelHost.toggleSharing", 16]
    ]);
    const genericChipsContainer = dom.$(".chat-secondary-generic-chips");
    const genericChipsLane = this._register(this.instantiationService.createInstance(
      AgentHostGenericConfigChips,
      widget
    ));
    genericChipsLane.render(genericChipsContainer);
    this.secondaryToolbar = this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, this.secondaryToolbarContainer, MenuId.ChatInputSecondary, {
      telemetrySource: this.options.menus.telemetrySource,
      menuOptions: { shouldForwardArgs: true },
      hiddenItemStrategy: HiddenItemStrategy.NoHide,
      hoverDelegate,
      responsiveBehavior: {
        enabled: true,
        kind: "all",
        minItems: 1,
        actionMinWidth: 48,
        // Agent-host pickers collapse to an icon-only label via a CSS
        // container query in `AgentHostChatInputPicker` when narrow.
        // Report a smaller min-width for them so the responsive layout
        // keeps them visible instead of overflowing into the menu.
        getActionMinWidth: (action) => agentHostShortPickerMinWidths.get(action.id)
      },
      actionViewItemProvider: (action, options2) => {
        const agentHostPickerProperty = getAgentHostPickerProperty(action.id);
        const customSecondaryItem = this.options.secondaryToolbarActionViewItemProvider?.(action, options2);
        if (customSecondaryItem) {
          return customSecondaryItem;
        }
        if ((action.id === OpenSessionTargetPickerAction.ID || action.id === OpenDelegationPickerAction.ID) && action instanceof MenuItemAction) {
          const delegate2 = this.options.sessionTypePickerDelegate ?? {
            getActiveSessionProvider: () => {
              return this.getActiveSessionTypeForDelegation();
            },
            getPendingDelegationTarget: () => {
              return this._pendingDelegationTarget;
            },
            setPendingDelegationTarget: (provider) => {
              this.setPendingDelegationTarget(provider);
            },
            hasGitRepository: () => this.hasWorkspaceScmRepository()
          };
          const isWelcomeViewMode = !!this.options.sessionTypePickerDelegate?.setActiveSessionProvider;
          const Picker = action.id === OpenSessionTargetPickerAction.ID || isWelcomeViewMode ? SessionTypePickerActionItem : DelegationSessionPickerActionItem;
          return this.sessionTargetWidget = this.instantiationService.createInstance(Picker, action, location === "editor" /* Editor */ ? "editor" : "sidebar", delegate2, secondaryPickerOptions);
        } else if (action.id === OpenWorkspacePickerAction.ID && action instanceof MenuItemAction) {
          if (this.workspaceContextService.getWorkbenchState() === WorkbenchState.EMPTY && this.options.workspacePickerDelegate) {
            return this.instantiationService.createInstance(WorkspacePickerActionItem, action, this.options.workspacePickerDelegate, secondaryPickerOptions);
          } else {
            return new HiddenActionViewItem(action);
          }
        } else if (action.id === OpenPermissionPickerAction.ID && action instanceof MenuItemAction) {
          const delegate2 = {
            currentPermissionLevel: this._currentPermissionLevel,
            setPermissionLevel: (level) => {
              this.setPermissionLevel(level);
            },
            getExtensionPermissions: () => {
              const sessionResource = this.getCurrentSessionResource();
              const group = this.getActiveExtensionPermissionGroup(sessionResource);
              if (!group) {
                return void 0;
              }
              const current = sessionResource ? this.chatSessionsService.getSessionOption(sessionResource, group.id) : void 0;
              const defaultId = group.selected?.id ?? group.items.find((i) => i.default)?.id;
              const rawSelectedId = current === void 0 ? defaultId : typeof current === "string" ? current : current.id;
              const selectedId = rawSelectedId !== void 0 && group.items.some((i) => i.id === rawSelectedId) ? rawSelectedId : defaultId;
              const sessionType = sessionResource ? getChatSessionType(sessionResource) : this.options.sessionTypePickerDelegate?.getActiveSessionProvider?.() ?? "";
              return { sessionType, groupId: group.id, items: group.items, selectedId };
            },
            setExtensionPermission: (groupId, item) => {
              this.updateOptionContextKey(groupId, item.id);
              this.getOrCreateOptionEmitter(groupId).fire(item);
              const sessionResource = this.getCurrentSessionResource();
              if (sessionResource) {
                this.chatSessionsService.setSessionOption(sessionResource, groupId, item);
              }
              this.permissionWidget?.refresh();
            },
            isSandboxToggleApplicable: () => this.getEffectiveSessionType(this.getCurrentSessionResource()) === SessionType.Local
          };
          const widget2 = this.instantiationService.createInstance(PermissionPickerActionItem, action, delegate2, secondaryPickerOptions);
          this.permissionWidget = widget2;
          this.permissionWidgetDisposeListener.value = widget2.onDidDispose(() => {
            if (this.permissionWidget === widget2) {
              this.permissionWidget = void 0;
            }
            this.permissionWidgetDisposeListener.clear();
          });
          return widget2;
        } else if (agentHostPickerProperty && action instanceof MenuItemAction) {
          if (this.options.isSessionsWindow) {
            return new HiddenActionViewItem(action);
          }
          const picker = this.instantiationService.createInstance(AgentHostChatInputPicker, widget, agentHostPickerProperty);
          return new AgentHostChatInputPickerActionViewItem(action, picker);
        } else if (action.id === OpenAgentHostFolderPickerAction.ID && action instanceof MenuItemAction) {
          if (this.options.isSessionsWindow) {
            return new HiddenActionViewItem(action);
          }
          return this.instantiationService.createInstance(AgentHostFolderPickerActionItem, action, widget, secondaryPickerOptions);
        } else if (action.id === ChatSessionPrimaryPickerAction.ID && action instanceof MenuItemAction) {
          const widgets = this.createChatSessionPickerWidgets(action, secondaryPickerOptions);
          if (widgets.length === 0) {
            return new HiddenActionViewItem(action);
          }
          return this.instantiationService.createInstance(ChatSessionPickersContainerActionItem, action, widgets);
        }
        return void 0;
      }
    }));
    this.secondaryToolbar.getElement().classList.add("chat-secondary-input-toolbar");
    this.secondaryToolbar.context = { widget };
    dom.append(this.secondaryToolbarContainer, genericChipsContainer);
    this._register(this.secondaryToolbar.onDidChangeMenuItems(() => {
      const toolbarElement = this.secondaryToolbar.getElement();
      const container2 = toolbarElement.querySelector(".chat-sessionPicker-container");
      if (dom.isHTMLElement(container2)) {
        this.chatSessionPickerContainer = container2;
      }
    }));
    this.statusToolbar = this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, this.statusToolbarContainer, MenuId.ChatInputStatus, {
      telemetrySource: this.options.menus.telemetrySource,
      menuOptions: { shouldForwardArgs: true },
      hiddenItemStrategy: HiddenItemStrategy.NoHide,
      hoverDelegate
    }));
    this.statusToolbar.getElement().classList.add("chat-input-status-toolbar");
    this.statusToolbar.context = { widget };
    let inputModel = this.modelService.getModel(this.inputUri);
    let createdInputModel;
    if (!inputModel) {
      inputModel = createdInputModel = this.modelService.createModel("", null, this.inputUri, false);
    }
    const inputModelReference = this.textModelResolverService.createModelReference(this.inputUri);
    if (createdInputModel) {
      const model = createdInputModel;
      this._register(toDisposable(() => {
        void inputModelReference.then(
          () => model.dispose(),
          () => model.dispose()
        );
      }));
    }
    inputModelReference.then((ref) => {
      if (this._store.isDisposed) {
        ref.dispose();
        return;
      }
      this._register(ref);
    }, (error) => {
      if (!this._store.isDisposed) {
        onUnexpectedError(error);
      }
    });
    this.inputModel = inputModel;
    this.inputModel.updateOptions({ bracketColorizationOptions: { enabled: false, independentColorPoolPerBracketType: false } });
    this._inputEditor.setModel(this.inputModel);
    if (initialValue) {
      this.inputModel.setValue(initialValue);
      const lineNumber = this.inputModel.getLineCount();
      this._inputEditor.setPosition({ lineNumber, column: this.inputModel.getLineMaxColumn(lineNumber) });
    }
    const onDidChangeCursorPosition = () => {
      const model = this._inputEditor.getModel();
      if (!model) {
        return;
      }
      const position = this._inputEditor.getPosition();
      if (!position) {
        return;
      }
      const atTop = position.lineNumber === 1 && position.column === 1;
      this.chatCursorAtTop.set(atTop);
      this.historyNavigationBackwardsEnablement.set(atTop);
      this.historyNavigationForewardsEnablement.set(position.equals(getLastPosition(model)));
      this._syncInputStateToModel();
    };
    this._register(this._inputEditor.onDidChangeCursorPosition((e) => onDidChangeCursorPosition()));
    onDidChangeCursorPosition();
    this._register(this.themeService.onDidFileIconThemeChange(() => {
      this.renderAttachedContext();
    }));
    this.renderAttachedContext();
    const updateCarouselMaxHeightScheduler = this._register(new dom.AnimationFrameScheduler(this.container, () => this.updateToolConfirmationCarouselMaxHeight()));
    const inputResizeObserver = this._register(new dom.DisposableResizeObserver("ChatInputPart.containerHeight", () => {
      updateCarouselMaxHeightScheduler.schedule();
      const newHeight = this.container.offsetHeight;
      this.height.set(newHeight, void 0);
    }));
    this._register(inputResizeObserver.observe(this.container));
    if (this.options.renderStyle === "compact") {
      const toolbarsResizeObserver = this._register(new dom.DisposableResizeObserver("ChatInputPart.compactToolbars", () => {
        if (this.cachedWidth) {
          this.layout(this.cachedWidth);
        }
      }));
      this._register(toolbarsResizeObserver.observe(toolbarsContainer));
    }
  }
  toggleChatInputOverlay(editing) {
    this.chatInputOverlay.classList.toggle("disabled", editing);
    if (editing) {
      this.overlayClickListener.value = dom.addStandardDisposableListener(this.chatInputOverlay, dom.EventType.CLICK, (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._onDidClickOverlay.fire();
      });
    } else {
      this.overlayClickListener.clear();
    }
  }
  renderAttachedContext() {
    const container = this.attachedContextContainer;
    const store = new DisposableStore();
    this.attachedContextDisposables.value = store;
    dom.clearNode(container);
    store.add(dom.addStandardDisposableListener(this.attachmentsContainer, dom.EventType.KEY_DOWN, (e) => {
      this.handleAttachmentNavigation(e);
    }));
    const attachments = this.getRenderableAttachments().map((attachment, index) => [index, attachment]);
    const hasAttachments = Boolean(attachments.length);
    let hasImplicitContext = false;
    const isSuggestedEnabled = this.configurationService.getValue("chat.implicitContext.suggestedContext");
    const hasVisibleImplicitContext = isSuggestedEnabled ? this._implicitContext?.hasValue ?? false : this._implicitContext?.values.some((v) => v.enabled || v.isSelection) ?? false;
    if (this._implicitContext && hasVisibleImplicitContext) {
      const isAttachmentAlreadyAttached = (targetUri, targetRange, targetHandle) => {
        return this._attachmentModel.attachments.some((a) => {
          const aUri = URI.isUri(a.value) ? a.value : isLocation(a.value) ? a.value.uri : void 0;
          const aRange = isLocation(a.value) ? a.value.range : void 0;
          if (targetHandle !== void 0 && isStringVariableEntry(a) && a.handle === targetHandle) {
            return true;
          }
          if (targetUri && aUri && isEqual(targetUri, aUri)) {
            if (targetRange && aRange) {
              return Range.equalsRange(targetRange, aRange);
            }
            return !targetRange && !aRange;
          }
          return false;
        });
      };
      const implicitContextWidget = this.instantiationService.createInstance(
        ImplicitContextAttachmentWidget,
        () => this._widget,
        isAttachmentAlreadyAttached,
        this._implicitContext,
        this._contextResourceLabels,
        this._attachmentModel,
        container
      );
      store.add(implicitContextWidget);
      hasImplicitContext = implicitContextWidget.hasRenderedContexts;
    }
    dom.setVisibility(Boolean(this.options.renderInputToolbarBelowInput || hasAttachments || hasImplicitContext), this.attachmentsContainer);
    dom.setVisibility(hasAttachments || hasImplicitContext, this.attachedContextContainer);
    if (!attachments.length) {
      this._indexOfLastAttachedContextDeletedWithKeyboard = -1;
      this._indexOfLastOpenedContext = -1;
    }
    const maxImagesPerRequest = getImageAttachmentLimit(this._currentLanguageModel.get()?.metadata);
    const imageAttachments = attachments.filter(([, a]) => isImageVariableEntry(a));
    if (maxImagesPerRequest !== void 0 && imageAttachments.length > maxImagesPerRequest) {
      const excessCount = imageAttachments.length - maxImagesPerRequest;
      for (let i = 0; i < excessCount; i++) {
        const attachment = imageAttachments[i][1];
        if (attachment.omittedState === OmittedState.NotOmitted || attachment.omittedState === OmittedState.ImageLimitExceeded) {
          attachment.omittedState = OmittedState.ImageLimitExceeded;
        }
      }
      for (let i = excessCount; i < imageAttachments.length; i++) {
        if (imageAttachments[i][1].omittedState === OmittedState.ImageLimitExceeded) {
          imageAttachments[i][1].omittedState = OmittedState.NotOmitted;
        }
      }
    } else {
      for (const [, a] of imageAttachments) {
        if (a.omittedState === OmittedState.ImageLimitExceeded) {
          a.omittedState = OmittedState.NotOmitted;
        }
      }
    }
    for (const [index, attachment] of attachments) {
      const resource = URI.isUri(attachment.value) ? attachment.value : isLocation(attachment.value) ? attachment.value.uri : void 0;
      const range = isLocation(attachment.value) ? attachment.value.range : void 0;
      const shouldFocusClearButton = index === Math.min(this._indexOfLastAttachedContextDeletedWithKeyboard, attachments.length - 1) && this._indexOfLastAttachedContextDeletedWithKeyboard > -1;
      let attachmentWidget;
      const options = { shouldFocusClearButton, supportsDeletion: true, isCurrentInput: true };
      const lm = this._currentLanguageModel.get();
      if (attachment.kind === "tool" || attachment.kind === "toolset") {
        attachmentWidget = this.instantiationService.createInstance(ToolSetOrToolItemAttachmentWidget, attachment, lm, options, container, this._contextResourceLabels);
      } else if (resource && isNotebookOutputVariableEntry(attachment)) {
        attachmentWidget = this.instantiationService.createInstance(NotebookCellOutputChatAttachmentWidget, resource, attachment, lm, options, container, this._contextResourceLabels);
      } else if (isPromptFileVariableEntry(attachment)) {
        attachmentWidget = this.instantiationService.createInstance(PromptFileAttachmentWidget, attachment, lm, options, container, this._contextResourceLabels);
      } else if (isPromptTextVariableEntry(attachment)) {
        attachmentWidget = this.instantiationService.createInstance(PromptTextAttachmentWidget, attachment, void 0, options, container, this._contextResourceLabels);
      } else if (resource && (attachment.kind === "file" || attachment.kind === "directory")) {
        attachmentWidget = this.instantiationService.createInstance(FileAttachmentWidget, resource, range, attachment, void 0, lm, options, container, this._contextResourceLabels);
      } else if (attachment.kind === "terminalCommand") {
        attachmentWidget = this.instantiationService.createInstance(TerminalCommandAttachmentWidget, attachment, lm, options, container, this._contextResourceLabels);
      } else if (isImageVariableEntry(attachment)) {
        attachmentWidget = this.instantiationService.createInstance(ImageAttachmentWidget, resource, attachment, lm, options, container, this._contextResourceLabels);
      } else if (isElementVariableEntry(attachment)) {
        attachmentWidget = this.instantiationService.createInstance(ElementChatAttachmentWidget, attachment, lm, options, container, this._contextResourceLabels);
      } else if (isPasteVariableEntry(attachment)) {
        attachmentWidget = this.instantiationService.createInstance(PasteAttachmentWidget, attachment, lm, options, container, this._contextResourceLabels);
      } else if (isSCMHistoryItemVariableEntry(attachment)) {
        attachmentWidget = this.instantiationService.createInstance(SCMHistoryItemAttachmentWidget, attachment, lm, options, container, this._contextResourceLabels);
      } else if (isSCMHistoryItemChangeVariableEntry(attachment)) {
        attachmentWidget = this.instantiationService.createInstance(SCMHistoryItemChangeAttachmentWidget, attachment, lm, options, container, this._contextResourceLabels);
      } else if (isSCMHistoryItemChangeRangeVariableEntry(attachment)) {
        attachmentWidget = this.instantiationService.createInstance(SCMHistoryItemChangeRangeAttachmentWidget, attachment, lm, options, container, this._contextResourceLabels);
      } else if (isBrowserViewVariableEntry(attachment)) {
        attachmentWidget = this.instantiationService.createInstance(BrowserViewAttachmentWidget, attachment, lm, options, container, this._contextResourceLabels);
      } else {
        attachmentWidget = this._chatAttachmentWidgetRegistry.createWidget(attachment, options, container) ?? this.instantiationService.createInstance(DefaultChatAttachmentWidget, resource, range, attachment, void 0, lm, options, container, this._contextResourceLabels);
      }
      if (shouldFocusClearButton) {
        attachmentWidget.element.focus();
      }
      if (index === Math.min(this._indexOfLastOpenedContext, attachments.length - 1)) {
        attachmentWidget.element.focus();
      }
      store.add(attachmentWidget);
      store.add(attachmentWidget.onDidDelete((e) => {
        this.handleAttachmentDeletion(e, index, attachment);
      }));
      store.add(attachmentWidget.onDidOpen((e) => {
        this.handleAttachmentOpen(index, attachment);
      }));
    }
    this._indexOfLastOpenedContext = -1;
  }
  handleAttachmentDeletion(e, index, attachment) {
    if (dom.isKeyboardEvent(e)) {
      this._indexOfLastAttachedContextDeletedWithKeyboard = index;
    }
    this._attachmentModel.delete(attachment.id);
    if (this.configurationService.getValue("chat.implicitContext.enableImplicitContext")) {
      for (const implicitContext of this._implicitContext?.values || []) {
        const implicitValue = URI.isUri(implicitContext?.value) && URI.isUri(attachment.value) && isEqual(implicitContext.value, attachment.value);
        if (implicitContext?.isFile && implicitValue) {
          implicitContext.enabled = false;
        }
      }
    }
    if (this.getRenderableAttachments().length === 0) {
      this.focus();
    }
    this._onDidChangeContext.fire({ removed: [attachment] });
    this.renderAttachedContext();
  }
  /**
   * The attachments that are rendered as pills in the input. Agent-host
   * completion entries (skills/commands) live in the model so their `_meta`
   * reaches the outgoing message, but they are shown as inline decorations
   * rather than pills, so they are excluded here.
   */
  getRenderableAttachments() {
    return this.attachmentModel.attachments.filter((attachment) => !isAgentHostCompletionVariableEntry(attachment));
  }
  handleAttachmentOpen(index, attachment) {
    this._indexOfLastOpenedContext = index;
    this._indexOfLastAttachedContextDeletedWithKeyboard = -1;
    if (this.getRenderableAttachments().length === 0) {
      this.focus();
    }
  }
  handleAttachmentNavigation(e) {
    if (!e.equals(KeyCode.LeftArrow) && !e.equals(KeyCode.RightArrow)) {
      return;
    }
    const attachments = Array.from(this.attachedContextContainer.querySelectorAll(".chat-attached-context-attachment"));
    if (!attachments.length) {
      return;
    }
    const activeElement = dom.getWindow(this.attachmentsContainer).document.activeElement;
    const currentIndex = attachments.findIndex((attachment) => attachment === activeElement);
    let newIndex = currentIndex;
    if (e.equals(KeyCode.LeftArrow)) {
      newIndex = currentIndex > 0 ? currentIndex - 1 : attachments.length - 1;
    } else if (e.equals(KeyCode.RightArrow)) {
      newIndex = currentIndex < attachments.length - 1 ? currentIndex + 1 : 0;
    }
    if (newIndex !== -1) {
      const nextElement = attachments[newIndex];
      nextElement.focus();
      e.preventDefault();
      e.stopPropagation();
    }
  }
  async renderChatTodoListWidget(chatSessionResource) {
    const isTodoWidgetEnabled = this.configurationService.getValue(ChatConfiguration.TodosShowWidget) !== false;
    if (!isTodoWidgetEnabled) {
      return;
    }
    if (!this._chatInputTodoListWidget.value) {
      const widget = this._chatEditingTodosDisposables.add(this.instantiationService.createInstance(ChatTodoListWidget));
      this._chatInputTodoListWidget.value = widget;
      dom.clearNode(this.chatInputTodoListWidgetContainer);
      dom.append(this.chatInputTodoListWidgetContainer, widget.domNode);
    }
    this._chatInputTodoListWidget.value.render(chatSessionResource);
  }
  clearTodoListWidget(sessionResource, force) {
    this._chatInputTodoListWidget.value?.clear(sessionResource, force);
  }
  renderArtifactsWidget(chatSessionResource) {
    if (!this.configurationService.getValue(ChatConfiguration.ArtifactsEnabled)) {
      return;
    }
    if (!this._chatArtifactsWidget.value) {
      const widget = this._register(this.instantiationService.createInstance(ChatArtifactsWidget));
      this._chatArtifactsWidget.value = widget;
      dom.clearNode(this.chatArtifactsWidgetContainer);
      dom.append(this.chatArtifactsWidgetContainer, widget.domNode);
    }
    this._chatArtifactsWidget.value.setSessionResource(chatSessionResource);
  }
  clearArtifactsWidget() {
    this._chatArtifactsWidget.value?.setSessionResource(void 0);
  }
  renderQuestionCarousel(carousel, context, options) {
    const carouselKey = carousel.resolveId ?? `${isResponseVM(context.element) ? context.element.requestId : ""}_${context.contentIndex}`;
    const existing = this._chatQuestionCarouselWidgets.get(carouselKey);
    if (existing) {
      return existing;
    }
    if (isResponseVM(context.element)) {
      this._questionCarouselResponseIds.set(carouselKey, context.element.requestId);
      this._questionCarouselSessionResources.set(carouselKey, context.element.sessionResource);
    }
    const part = this.instantiationService.createInstance(ChatQuestionCarouselPart, carousel, context, options);
    this._chatQuestionCarouselWidgets.set(carouselKey, part);
    this._hasQuestionCarouselContextKey?.set(true);
    dom.append(this.chatQuestionCarouselContainer, part.domNode);
    return part;
  }
  clearQuestionCarousel(responseId, resolveId) {
    if (resolveId !== void 0) {
      const part = this._chatQuestionCarouselWidgets.get(resolveId);
      if (part) {
        part.domNode.remove();
        this._chatQuestionCarouselWidgets.deleteAndDispose(resolveId);
      }
      this._questionCarouselResponseIds.delete(resolveId);
      this._questionCarouselSessionResources.delete(resolveId);
    } else if (responseId !== void 0) {
      for (const [key, rid] of this._questionCarouselResponseIds) {
        if (rid === responseId) {
          const part = this._chatQuestionCarouselWidgets.get(key);
          if (part) {
            part.domNode.remove();
            this._chatQuestionCarouselWidgets.deleteAndDispose(key);
          }
          this._questionCarouselResponseIds.delete(key);
          this._questionCarouselSessionResources.delete(key);
        }
      }
    } else {
      this._chatQuestionCarouselWidgets.clearAndDisposeAll();
      this._questionCarouselResponseIds.clear();
      this._questionCarouselSessionResources.clear();
      dom.clearNode(this.chatQuestionCarouselContainer);
    }
    this._hasQuestionCarouselContextKey?.set(this._chatQuestionCarouselWidgets.size > 0);
  }
  get questionCarousel() {
    for (const part of this._chatQuestionCarouselWidgets.values()) {
      if (part.hasFocus()) {
        return part;
      }
    }
    return this._chatQuestionCarouselWidgets.size > 0 ? this._chatQuestionCarouselWidgets.values().next().value : void 0;
  }
  focusQuestionCarousel() {
    const carousel = this.questionCarousel;
    if (carousel) {
      carousel.focus();
      return true;
    }
    return false;
  }
  isQuestionCarouselFocused() {
    for (const part of this._chatQuestionCarouselWidgets.values()) {
      if (part.hasFocus()) {
        return true;
      }
    }
    return false;
  }
  navigateToPreviousQuestion() {
    const carousel = this.questionCarousel;
    return carousel?.navigateToPreviousQuestion() ?? false;
  }
  navigateToNextQuestion() {
    const carousel = this.questionCarousel;
    return carousel?.navigateToNextQuestion() ?? false;
  }
  focusQuestionCarouselTerminal() {
    const carousel = this.questionCarousel;
    return carousel?.focusTerminal() ?? false;
  }
  // --- Plan Review ---
  renderPlanReview(review, context, options) {
    const key = review.resolveId ?? `${isResponseVM(context.element) ? context.element.requestId : ""}_${context.contentIndex}`;
    const existing = this._chatPlanReviewWidgets.get(key);
    if (existing) {
      return existing;
    }
    if (isResponseVM(context.element)) {
      this._planReviewResponseIds.set(key, context.element.requestId);
      this._planReviewSessionResources.set(key, context.element.sessionResource);
    }
    const part = this.instantiationService.createInstance(ChatPlanReviewPart, review, context, options);
    this._chatPlanReviewWidgets.set(key, part);
    dom.append(this.chatPlanReviewContainer, part.domNode);
    return part;
  }
  clearPlanReview(responseId, resolveId) {
    if (resolveId !== void 0) {
      const part = this._chatPlanReviewWidgets.get(resolveId);
      if (part) {
        part.domNode.remove();
        this._chatPlanReviewWidgets.deleteAndDispose(resolveId);
      }
      this._planReviewResponseIds.delete(resolveId);
      this._planReviewSessionResources.delete(resolveId);
    } else if (responseId !== void 0) {
      for (const [key, rid] of this._planReviewResponseIds) {
        if (rid === responseId) {
          const part = this._chatPlanReviewWidgets.get(key);
          if (part) {
            part.domNode.remove();
            this._chatPlanReviewWidgets.deleteAndDispose(key);
          }
          this._planReviewResponseIds.delete(key);
          this._planReviewSessionResources.delete(key);
        }
      }
    } else {
      this._chatPlanReviewWidgets.clearAndDisposeAll();
      this._planReviewResponseIds.clear();
      this._planReviewSessionResources.clear();
      dom.clearNode(this.chatPlanReviewContainer);
    }
  }
  get planReview() {
    return this._chatPlanReviewWidgets.size > 0 ? this._chatPlanReviewWidgets.values().next().value : void 0;
  }
  // --- Tool Confirmation Carousel ---
  get _currentSessionKey() {
    return this._widget?.viewModel?.model.sessionResource.toString();
  }
  get _currentToolConfirmationCarousel() {
    const key = this._currentSessionKey;
    return key ? this._chatToolConfirmationCarousels.get(key) : void 0;
  }
  renderToolConfirmationCarousel(tool, factory, subAgentInvocationId, agentName, revealSubagent, revealSubagentLabel, toolPart) {
    const existing = this._currentToolConfirmationCarousel;
    if (existing) {
      existing.addToolInvocation(tool, subAgentInvocationId, agentName, revealSubagent, revealSubagentLabel, toolPart);
      this.updateToolConfirmationCarouselMaxHeight();
      return existing;
    }
    const key = this._currentSessionKey;
    if (!key) {
      throw new Error("Cannot render tool confirmation carousel without an active session");
    }
    const part = new ChatToolConfirmationCarouselPart(factory, [], revealSubagent, revealSubagentLabel, subAgentInvocationId, agentName);
    part.addToolInvocation(tool, subAgentInvocationId, agentName, revealSubagent, revealSubagentLabel, toolPart);
    this._chatToolConfirmationCarousels.set(key, part);
    const capturedKey = key;
    this._register(part.onDidChangeActiveSubagent((id) => {
      if (this._currentSessionKey === capturedKey) {
        this._onDidChangeActiveConfirmationSubagent.fire(id);
      }
    }));
    if (this._currentSessionKey === capturedKey) {
      this._onDidChangeActiveConfirmationSubagent.fire(part.activeSubAgentInvocationId);
    }
    dom.append(this.chatToolConfirmationCarouselContainer, part.domNode);
    dom.show(this.chatToolConfirmationCarouselContainer);
    this.updateToolConfirmationCarouselMaxHeight();
    this._register(Event.once(part.onDidEmpty)(() => {
      this._chatToolConfirmationCarousels.deleteAndDispose(capturedKey);
      if (this._currentSessionKey === capturedKey) {
        this._onDidChangeActiveConfirmationSubagent.fire(void 0);
        dom.clearNode(this.chatToolConfirmationCarouselContainer);
        dom.hide(this.chatToolConfirmationCarouselContainer);
      }
    }));
    return part;
  }
  addToolToConfirmationCarousel(tool, factory, subAgentInvocationId, agentName, revealSubagent, revealSubagentLabel, toolPart) {
    const existing = this._currentToolConfirmationCarousel;
    if (existing) {
      existing.addToolInvocation(tool, subAgentInvocationId, agentName, revealSubagent, revealSubagentLabel, toolPart);
      this.updateToolConfirmationCarouselMaxHeight();
    } else {
      this.renderToolConfirmationCarousel(tool, factory, subAgentInvocationId, agentName, revealSubagent, revealSubagentLabel, toolPart);
    }
  }
  get activeConfirmationSubagentId() {
    return this._currentToolConfirmationCarousel?.activeSubAgentInvocationId;
  }
  /**
   * Navigates the carousel to the first pending tool from the given subagent.
   */
  activateCarouselForSubagent(subAgentInvocationId) {
    this._currentToolConfirmationCarousel?.activateFirstToolForSubagent(subAgentInvocationId);
  }
  hasToolInConfirmationCarousel(toolCallId) {
    return this._currentToolConfirmationCarousel?.hasToolInvocation(toolCallId) ?? false;
  }
  get hasActiveToolConfirmationCarousel() {
    const carousel = this._currentToolConfirmationCarousel;
    return !!carousel && carousel.pendingCount > 0;
  }
  clearToolConfirmationCarousel() {
    const key = this._currentSessionKey;
    if (key) {
      this._chatToolConfirmationCarousels.deleteAndDispose(key);
    }
    this._onDidChangeActiveConfirmationSubagent.fire(void 0);
    dom.clearNode(this.chatToolConfirmationCarouselContainer);
    dom.hide(this.chatToolConfirmationCarouselContainer);
  }
  /**
   * Swaps the visible tool confirmation carousel when switching sessions.
   */
  _syncToolConfirmationCarouselForSession() {
    dom.clearNode(this.chatToolConfirmationCarouselContainer);
    const carousel = this._currentToolConfirmationCarousel;
    if (carousel && carousel.pendingCount > 0) {
      dom.append(this.chatToolConfirmationCarouselContainer, carousel.domNode);
      dom.show(this.chatToolConfirmationCarouselContainer);
      this.updateToolConfirmationCarouselMaxHeight();
    } else {
      dom.hide(this.chatToolConfirmationCarouselContainer);
    }
    this._onDidChangeActiveConfirmationSubagent.fire(carousel?.activeSubAgentInvocationId);
  }
  setWorkingSetCollapsed(collapsed) {
    this._workingSetCollapsed.set(collapsed, void 0);
  }
  renderChatEditingSessionState(chatEditingSession) {
    dom.setVisibility(Boolean(chatEditingSession), this.chatEditingSessionWidgetContainer);
    if (chatEditingSession) {
      if (!isEqual(chatEditingSession.chatSessionResource, this._lastEditingSessionResource)) {
        this._workingSetCollapsed.set(true, void 0);
      }
      this._lastEditingSessionResource = chatEditingSession.chatSessionResource;
    }
    const modifiedEntries = derivedOpts({ equalsFn: arraysEqual }, (r) => {
      const sessionResource = chatEditingSession?.chatSessionResource ?? this._widget?.viewModel?.model.sessionResource;
      if (sessionResource && getChatSessionType(sessionResource) === AgentSessionProviders.Background) {
        return [];
      }
      return chatEditingSession?.entries.read(r).filter((entry) => entry.state.read(r) === ModifiedFileEntryState.Modified) || [];
    });
    const editSessionEntries = derived((reader) => {
      const seenEntries = new ResourceSet();
      const entries = [];
      for (const entry of modifiedEntries.read(reader)) {
        if (entry.state.read(reader) !== ModifiedFileEntryState.Modified) {
          continue;
        }
        if (!seenEntries.has(entry.modifiedURI)) {
          seenEntries.add(entry.modifiedURI);
          const linesAdded = entry.linesAdded?.read(reader);
          const linesRemoved = entry.linesRemoved?.read(reader);
          entries.push({
            reference: entry.modifiedURI,
            state: ModifiedFileEntryState.Modified,
            kind: "reference",
            options: {
              status: void 0,
              diffMeta: { added: linesAdded ?? 0, removed: linesRemoved ?? 0 },
              isDeletion: !!entry.isDeletion,
              originalUri: entry.isDeletion ? entry.originalURI : void 0
            }
          });
        }
      }
      entries.sort((a, b) => {
        if (a.kind === "reference" && b.kind === "reference") {
          if (a.state === b.state || a.state === void 0 || b.state === void 0) {
            return a.reference.toString().localeCompare(b.reference.toString());
          }
          return a.state - b.state;
        }
        return 0;
      });
      return entries;
    });
    const sessionFileChanges = observableFromEvent(
      this,
      this.agentSessionsService.model.onDidChangeSessions,
      () => {
        const sessionResource = this._widget?.viewModel?.model?.sessionResource;
        if (!sessionResource) {
          return Iterable.empty();
        }
        const model = this.agentSessionsService.getSession(sessionResource);
        return model?.changes instanceof Array ? model.changes : Iterable.empty();
      }
    );
    const sessionFiles = derived(
      (reader) => sessionFileChanges.read(reader).map((entry) => ({
        reference: isIChatSessionFileChange2(entry) ? entry.modifiedUri ?? entry.uri : entry.modifiedUri,
        state: ModifiedFileEntryState.Accepted,
        kind: "reference",
        options: {
          diffMeta: { added: entry.insertions, removed: entry.deletions },
          isDeletion: entry.modifiedUri === void 0,
          originalUri: entry.originalUri,
          status: void 0
        }
      }))
    );
    const shouldRender = derived((reader) => editSessionEntries.read(reader).length > 0 || sessionFiles.read(reader).length > 0);
    this._renderingChatEdits.value = autorun((reader) => {
      if (this.options.renderWorkingSet && shouldRender.read(reader)) {
        this.renderChatEditingSessionWithEntries(
          reader.store,
          chatEditingSession,
          editSessionEntries,
          sessionFiles
        );
      } else {
        dom.clearNode(this.chatEditingSessionWidgetContainer);
        this._chatEditsDisposables.clear();
        this._chatEditList = void 0;
      }
    });
  }
  renderChatEditingSessionWithEntries(store, chatEditingSession, editSessionEntriesObs, sessionEntriesObs) {
    const innerContainer = this.chatEditingSessionWidgetContainer.querySelector(".chat-editing-session-container.show-file-icons") ?? dom.append(this.chatEditingSessionWidgetContainer, $(".chat-editing-session-container.show-file-icons"));
    const overviewRegion = innerContainer.querySelector(".chat-editing-session-overview") ?? dom.append(innerContainer, $(".chat-editing-session-overview"));
    const overviewTitle = overviewRegion.querySelector(".working-set-title") ?? dom.append(overviewRegion, $(".working-set-title"));
    this._chatEditsActionsDisposables.clear();
    const actionsContainer = overviewRegion.querySelector(".chat-editing-session-actions") ?? dom.append(overviewRegion, $(".chat-editing-session-actions"));
    const sessionResource = chatEditingSession?.chatSessionResource || this._widget?.viewModel?.model.sessionResource;
    const scopedContextKeyService = this._chatEditsActionsDisposables.add(this.contextKeyService.createScoped(actionsContainer));
    if (sessionResource) {
      scopedContextKeyService.createKey(ChatContextKeys.agentSessionType.key, getChatSessionType(sessionResource));
      const sessionPullRequest = observableFromEvent(
        this,
        this.agentSessionsService.model.onDidChangeSessions,
        () => {
          const session = this.agentSessionsService.getSession(sessionResource);
          return session ? getAgentSessionPullRequestContextValue(session) : "";
        }
      );
      this._chatEditsActionsDisposables.add(bindContextKey(ChatContextKeys.agentSessionPullRequest, scopedContextKeyService, (r) => sessionPullRequest.read(r)));
    }
    this._chatEditsActionsDisposables.add(bindContextKey(ChatContextKeys.hasAgentSessionChanges, scopedContextKeyService, (r) => !!sessionEntriesObs.read(r)?.length));
    const scopedInstantiationService = this._chatEditsActionsDisposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, scopedContextKeyService])));
    const workingSetContainer = innerContainer.querySelector(".chat-editing-session-list") ?? dom.append(innerContainer, $(".chat-editing-session-list"));
    const button = this._chatEditsActionsDisposables.add(new ButtonWithIcon(overviewTitle, {
      supportIcons: true,
      secondary: true,
      ariaLabel: localize("chatEditingSession.toggleWorkingSet", "Toggle changed files.")
    }));
    const topLevelStats = derived((reader) => {
      const entries = editSessionEntriesObs.read(reader);
      const sessionEntries = sessionEntriesObs.read(reader);
      let added = 0, removed = 0;
      if (entries.length > 0) {
        for (const entry of entries) {
          if (entry.kind === "reference" && entry.options?.diffMeta) {
            added += entry.options.diffMeta.added;
            removed += entry.options.diffMeta.removed;
          }
        }
      } else {
        for (const entry of sessionEntries) {
          if (entry.kind === "reference" && entry.options?.diffMeta) {
            added += entry.options.diffMeta.added;
            removed += entry.options.diffMeta.removed;
          }
        }
      }
      const files = entries.length > 0 ? entries.length : sessionEntries.length;
      const topLevelIsSessionMenu2 = entries.length === 0 && sessionEntries.length > 0;
      const shouldShowEditingSession = entries.length > 0 || sessionEntries.length > 0;
      return { files, added, removed, shouldShowEditingSession, topLevelIsSessionMenu: topLevelIsSessionMenu2 };
    });
    const topLevelIsSessionMenu = topLevelStats.map((t) => t.topLevelIsSessionMenu);
    store.add(autorun((reader) => {
      const isSessionMenu = topLevelIsSessionMenu.read(reader);
      reader.store.add(scopedInstantiationService.createInstance(MenuWorkbenchButtonBar, actionsContainer, isSessionMenu ? MenuId.ChatEditingSessionChangesToolbar : MenuId.ChatEditingWidgetToolbar, {
        telemetrySource: this.options.menus.telemetrySource,
        small: true,
        menuOptions: sessionResource ? isSessionMenu ? {
          args: [sessionResource, this.agentSessionsService.getSession(sessionResource)?.metadata]
        } : {
          arg: {
            $mid: MarshalledId.ChatViewContext,
            sessionResource
          }
        } : void 0,
        disableWhileRunning: isSessionMenu,
        buttonConfigProvider: (action) => {
          if (action.id === ChatEditingShowChangesAction.ID || action.id === ViewPreviousEditsAction.Id) {
            return { showIcon: true, showLabel: false, isSecondary: true };
          }
          if (action.id === "github.copilot.chat.cloudSessions.openPullRequestForTask") {
            return { showIcon: true, showLabel: false };
          }
          return void 0;
        }
      }));
    }));
    store.add(autorun((reader) => {
      const { files, added, removed, shouldShowEditingSession } = topLevelStats.read(reader);
      const buttonLabel = files === 1 ? localize("chatEditingSession.oneFile", "1 file changed") : localize("chatEditingSession.manyFiles", "{0} files changed", files);
      button.label = buttonLabel;
      button.element.setAttribute("aria-label", localize("chatEditingSession.ariaLabelWithCounts", "{0}, {1} lines added, {2} lines removed", buttonLabel, added, removed));
      this._workingSetLinesAddedSpan.value.textContent = `+${added}`;
      this._workingSetLinesRemovedSpan.value.textContent = `-${removed}`;
      dom.setVisibility(shouldShowEditingSession, this.chatEditingSessionWidgetContainer);
    }));
    const countsContainer = dom.$(".working-set-line-counts");
    button.element.appendChild(countsContainer);
    countsContainer.appendChild(this._workingSetLinesAddedSpan.value);
    countsContainer.appendChild(this._workingSetLinesRemovedSpan.value);
    const toggleWorkingSet = () => {
      this._workingSetCollapsed.set(!this._workingSetCollapsed.get(), void 0);
    };
    this._chatEditsActionsDisposables.add(button.onDidClick(toggleWorkingSet));
    this._chatEditsActionsDisposables.add(addDisposableListener(overviewRegion, "click", (e) => {
      if (e.defaultPrevented) {
        return;
      }
      const target = e.target;
      if (target.closest(".monaco-button")) {
        return;
      }
      toggleWorkingSet();
    }));
    this._chatEditsActionsDisposables.add(autorun((reader) => {
      const collapsed = this._workingSetCollapsed.read(reader);
      button.icon = collapsed ? Codicon.chevronRight : Codicon.chevronDown;
      workingSetContainer.classList.toggle("collapsed", collapsed);
    }));
    if (!this._chatEditList) {
      this._chatEditList = this._chatEditsListPool.get();
      const list = this._chatEditList.object;
      this._chatEditsDisposables.add(this._chatEditList);
      this._chatEditsDisposables.add(list.onDidFocus(() => {
        this._onDidFocus.fire();
      }));
      this._chatEditsDisposables.add(list.onDidOpen(async (e) => {
        if (e.element?.kind === "reference" && URI.isUri(e.element.reference)) {
          const modifiedFileUri = e.element.reference;
          const originalUri = e.element.options?.originalUri;
          if (e.element.options?.isDeletion && originalUri) {
            await this.editorService.openEditor({
              resource: originalUri,
              // instead of modified, because modified will not exist
              options: e.editorOptions
            }, e.sideBySide ? SIDE_GROUP : ACTIVE_GROUP);
            return;
          }
          if (originalUri) {
            await this.editorService.openEditor({
              original: { resource: originalUri },
              modified: { resource: modifiedFileUri },
              options: e.editorOptions
            }, e.sideBySide ? SIDE_GROUP : ACTIVE_GROUP);
            return;
          }
          const entry = chatEditingSession?.getEntry(modifiedFileUri);
          const pane = await this.editorService.openEditor({
            resource: modifiedFileUri,
            options: e.editorOptions
          }, e.sideBySide ? SIDE_GROUP : ACTIVE_GROUP);
          if (pane) {
            entry?.getEditorIntegration(pane).reveal(true, e.editorOptions.preserveFocus);
          }
        }
      }));
      this._chatEditsDisposables.add(addDisposableListener(list.getHTMLElement(), "click", (e) => {
        if (!this.hasFocus()) {
          this._onDidFocus.fire();
        }
      }, true));
      dom.append(workingSetContainer, list.getHTMLElement());
      dom.append(innerContainer, workingSetContainer);
    }
    store.add(autorun((reader) => {
      const editEntries = editSessionEntriesObs.read(reader);
      const sessionFileEntries = sessionEntriesObs.read(reader);
      const allEntries = editEntries.concat(sessionFileEntries);
      const maxItemsShown = 6;
      const itemsShown = Math.min(allEntries.length, maxItemsShown);
      const height = itemsShown * 22;
      const list = this._chatEditList.object;
      list.layout(height);
      list.getHTMLElement().style.height = `${height}px`;
      list.splice(0, list.length, allEntries);
      workingSetContainer.classList.toggle("overflowing", allEntries.length > maxItemsShown);
    }));
  }
  async renderFollowups(items, response) {
    if (!this.options.renderFollowups) {
      return;
    }
    this.followupsDisposables.clear();
    dom.clearNode(this.followupsContainer);
    if (items && items.length > 0) {
      this.followupsDisposables.add(this.instantiationService.createInstance(ChatFollowups, this.followupsContainer, items, this.location, void 0, (followup) => this._onDidAcceptFollowup.fire({ followup, response })));
    }
  }
  /**
   * Sets the maximum height budget for the input part. The editor height will be
   * clamped so it does not grow beyond what this budget allows after accounting
   * for non-editor chrome such as attachments, toolbars, and widgets.
   */
  setMaxHeight(maxHeight) {
    this._maxHeight = maxHeight;
    this.updateToolConfirmationCarouselMaxHeight();
  }
  updateToolConfirmationCarouselMaxHeight() {
    const carousel = this._currentToolConfirmationCarousel;
    if (!carousel) {
      return;
    }
    if (this._maxHeight === void 0) {
      carousel.setMaxHeight(void 0);
      return;
    }
    const carouselHeight = this.chatToolConfirmationCarouselContainer.offsetHeight;
    const otherInputHeight = Math.max(0, this.container.offsetHeight - carouselHeight);
    carousel.setMaxHeight(this._maxHeight - otherInputHeight);
  }
  /**
   * Layout the input part with the given width. Height is intrinsic - determined by content
   * and detected via ResizeObserver, which updates `inputPartHeight` for the parent to observe.
   */
  layout(width) {
    this.cachedWidth = width;
    this._stableInputPartWidth.set(width, void 0);
    this._updateWorkingProgressAnimationDuration(width);
    return this._layout(width);
  }
  _updateWorkingProgressAnimationDuration(width) {
    if (!this.inputContainer) {
      return;
    }
    const MIN_DURATION_S = 1.4;
    const MAX_DURATION_S = 2.5;
    const safeWidth = Math.max(50, width);
    const raw = 0.55 + 0.075 * Math.sqrt(safeWidth);
    const duration = Math.min(MAX_DURATION_S, Math.max(MIN_DURATION_S, raw));
    if (this._lastAnimDurationS !== void 0 && Math.abs(this._lastAnimDurationS - duration) < 0.05) {
      return;
    }
    this._lastAnimDurationS = duration;
    this.inputContainer.style.setProperty("--chat-input-anim-duration", `${duration.toFixed(2)}s`);
    if (this.inputContainer.classList.contains("working")) {
      const inputContainer = this.inputContainer;
      inputContainer.classList.add("chat-input-anim-restart");
      dom.scheduleAtNextAnimationFrame(dom.getWindow(inputContainer), () => {
        inputContainer.classList.remove("chat-input-anim-restart");
      });
    }
  }
  get _effectiveInputEditorMaxHeight() {
    if (this._maxHeight === void 0) {
      return this.inputEditorMaxHeight;
    }
    const currentEditorHeight = this.previousInputEditorDimension?.height ?? 0;
    const nonEditorHeight = Math.max(0, this.height.get() - currentEditorHeight);
    const budgetForEditor = this._maxHeight - nonEditorHeight;
    const minEditorHeight = this.inputEditorMinHeight ?? this.singleLineInputEditorHeight;
    return Math.max(minEditorHeight, Math.min(this.inputEditorMaxHeight, Math.max(0, budgetForEditor)));
  }
  _layout(width, allowRecurse = true) {
    const data = this.getLayoutData();
    const followupsWidth = width - data.inputPartHorizontalPadding;
    this.followupsContainer.style.width = `${followupsWidth}px`;
    const initialEditorScrollWidth = this._inputEditor.getScrollWidth();
    const newEditorWidth = width - data.inputPartHorizontalPadding - data.editorBorder - data.inputPartHorizontalPaddingInside - data.toolbarsWidth - data.sideToolbarWidth;
    const effectiveMaxHeight = this._effectiveInputEditorMaxHeight;
    const clampedContentHeight = Math.min(this._inputEditor.getContentHeight(), effectiveMaxHeight);
    const inputEditorHeight = this.inputEditorMinHeight ? Math.min(Math.max(this.inputEditorMinHeight, clampedContentHeight), effectiveMaxHeight) : clampedContentHeight;
    const newDimension = { width: newEditorWidth, height: inputEditorHeight };
    if (!this.previousInputEditorDimension || (this.previousInputEditorDimension.width !== newDimension.width || this.previousInputEditorDimension.height !== newDimension.height)) {
      this._inputEditor.layout(newDimension);
      this.previousInputEditorDimension = newDimension;
    }
    if (allowRecurse && initialEditorScrollWidth < 10) {
      return this._layout(width, false);
    }
  }
  getLayoutData() {
    const inputSideToolbarWidth = this.inputSideToolbarContainer ? dom.getTotalWidth(this.inputSideToolbarContainer) : 0;
    const getToolbarsWidthCompact = () => {
      const toolbarItemGap = 4;
      const executeToolbarWidth = this.cachedExecuteToolbarWidth = this.executeToolbar.getItemsWidth();
      const inputToolbarWidth = this.cachedInputToolbarWidth = this.inputActionsToolbar.getItemsWidth();
      const executeToolbarPadding = (this.executeToolbar.getItemsLength() - 1) * toolbarItemGap;
      const inputToolbarPadding = this.inputActionsToolbar.getItemsLength() ? (this.inputActionsToolbar.getItemsLength() - 1) * toolbarItemGap : 0;
      const contextUsageWidth = dom.getTotalWidth(this.contextUsageWidgetContainer);
      const inputToolbarsPadding = 12;
      return executeToolbarWidth + executeToolbarPadding + contextUsageWidth + (this.options.renderInputToolbarBelowInput ? 0 : inputToolbarWidth + inputToolbarPadding + inputToolbarsPadding);
    };
    return {
      editorBorder: 2,
      // The sessions window pads `.interactive-input-part` by 32px on each side
      // (vs the default 12px margin) so the input box aligns with the chat
      // content cards. The editor width is computed here, so it must account
      // for the same 64px total horizontal gutter or the editor overflows its
      // container and renders wider than the message content above it.
      inputPartHorizontalPadding: this.options.inputPartHorizontalPadding ?? (this.options.renderStyle === "compact" ? 16 : this.options.isSessionsWindow ? 64 : 24),
      inputPartHorizontalPaddingInside: this.options.renderStyle === "compact" ? 12 : 10,
      toolbarsWidth: this.options.renderStyle === "compact" ? getToolbarsWidthCompact() : 0,
      sideToolbarWidth: inputSideToolbarWidth > 0 ? inputSideToolbarWidth + 4 : 0
    };
  }
  /**
   * Gets the location of the chat widget and whether that location is maximized.
   */
  getWidgetLocationInfo(widget) {
    if (isIChatResourceViewContext(widget.viewContext)) {
      return { location: "editor" /* Editor */, isMaximized: false };
    }
    if (isIChatViewViewContext(widget.viewContext)) {
      const viewLocation = this.viewDescriptorService.getViewLocationById(widget.viewContext.viewId);
      const sideBarPosition = this.layoutService.getSideBarPosition();
      switch (viewLocation) {
        case ViewContainerLocation.Panel:
          return {
            location: "panel" /* Panel */,
            isMaximized: this.layoutService.isPanelMaximized()
          };
        case ViewContainerLocation.AuxiliaryBar:
          return {
            location: sideBarPosition === Position.LEFT ? "sidebarRight" /* SidebarRight */ : "sidebarLeft" /* SidebarLeft */,
            isMaximized: this.layoutService.isAuxiliaryBarMaximized()
          };
        case ViewContainerLocation.Sidebar:
        default:
          return {
            location: sideBarPosition === Position.LEFT ? "sidebarLeft" /* SidebarLeft */ : "sidebarRight" /* SidebarRight */,
            isMaximized: false
          };
      }
    }
    return { location: "editor" /* Editor */, isMaximized: false };
  }
  getDefaultScrollbarOptions() {
    const scrollbar = this._inputEditor.getRawOptions().scrollbar ?? {};
    return this.options.renderStyle === "compact" ? { ...scrollbar, vertical: "hidden" } : { ...scrollbar, vertical: "auto", verticalScrollbarSize: 7 };
  }
  getVisibleScrollbarOptions() {
    const scrollbar = this._inputEditor.getRawOptions().scrollbar ?? {};
    return this.options.renderStyle === "compact" ? { ...scrollbar, vertical: "hidden" } : { ...scrollbar, vertical: "visible", verticalScrollbarSize: 7 };
  }
  updateInputEditorScrollbarOptions() {
    this._inputEditor.updateOptions({
      scrollbar: this._forceVisibleScrollbarUntilAccept ? this.getVisibleScrollbarOptions() : this.getDefaultScrollbarOptions()
    });
  }
  showScrollbarUntilAccept() {
    this._forceVisibleScrollbarUntilAccept = true;
    this.updateInputEditorScrollbarOptions();
  }
  resetScrollbarVisibilityAfterAccept() {
    if (!this._forceVisibleScrollbarUntilAccept) {
      return;
    }
    this._forceVisibleScrollbarUntilAccept = false;
    this.updateInputEditorScrollbarOptions();
  }
};
ChatInputPart = __decorateClass([
  __decorateParam(4, IModelService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IKeybindingService),
  __decorateParam(9, IAccessibilityService),
  __decorateParam(10, ILanguageModelsService),
  __decorateParam(11, ILogService),
  __decorateParam(12, IFileService),
  __decorateParam(13, IEditorService),
  __decorateParam(14, IThemeService),
  __decorateParam(15, ITextModelService),
  __decorateParam(16, IStorageService),
  __decorateParam(17, IDialogService),
  __decorateParam(18, IChatAgentService),
  __decorateParam(19, ISharedWebContentExtractorService),
  __decorateParam(20, IChatEntitlementService),
  __decorateParam(21, IChatModeService),
  __decorateParam(22, ILanguageModelToolsService),
  __decorateParam(23, IChatSessionsService),
  __decorateParam(24, IChatContextService),
  __decorateParam(25, IAgentSessionsService),
  __decorateParam(26, IDictationOnboardingService),
  __decorateParam(27, IWorkspaceContextService),
  __decorateParam(28, ISCMService),
  __decorateParam(29, IWorkbenchLayoutService),
  __decorateParam(30, IViewDescriptorService),
  __decorateParam(31, IChatAttachmentWidgetRegistry),
  __decorateParam(32, IChatInputNotificationService),
  __decorateParam(33, IChatPhoneInputPresenter),
  __decorateParam(34, IProductService),
  __decorateParam(35, IVoiceModeOnboardingService),
  __decorateParam(36, IChatWidgetService),
  __decorateParam(37, IVoiceSessionController)
], ChatInputPart);
function getLastPosition(model) {
  return { lineNumber: model.getLineCount(), column: model.getLineLength(model.getLineCount()) + 1 };
}
const chatInputEditorContainerSelector = ".interactive-input-editor";
setupSimpleEditorSelectionStyling(chatInputEditorContainerSelector);
class ChatSessionPickersContainerActionItem extends ActionViewItem {
  constructor(action, widgets, options) {
    super(null, action, options ?? {});
    this.widgets = widgets;
  }
  render(container) {
    container.classList.add("chat-sessionPicker-container");
    for (const widget of this.widgets) {
      const itemContainer = dom.$(".action-item.chat-sessionPicker-item");
      widget.render(itemContainer);
      container.appendChild(itemContainer);
    }
  }
  dispose() {
    for (const widget of this.widgets) {
      widget.dispose();
    }
    super.dispose();
  }
}
class HiddenActionViewItem extends BaseActionViewItem {
  constructor(action) {
    super(void 0, action);
  }
  render(container) {
    super.render(container);
    container.style.display = "none";
  }
}
export {
  ChatInputPart,
  ChatWidgetLocation
};
