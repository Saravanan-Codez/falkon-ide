import { localize } from "../../../../../nls.js";
import { ContextKeyExpr, RawContextKey } from "../../../../../platform/contextkey/common/contextkey.js";
import { IsWebContext } from "../../../../../platform/contextkey/common/contextkeys.js";
import { RemoteNameContext } from "../../../../common/contextkeys.js";
import { ChatEntitlementContextKeys } from "../../../../services/chat/common/chatEntitlementService.js";
import { ChatAccountPolicyGateActiveContext } from "../../../../services/policies/common/accountPolicyService.js";
import { ChatModeKind, ChatPermissionLevel } from "../constants.js";
var ChatContextKeys;
((ChatContextKeys2) => {
  ChatContextKeys2.responseVote = new RawContextKey("chatSessionResponseVote", "", { type: "string", description: localize("interactiveSessionResponseVote", "When the response has been voted up, is set to 'up'. When voted down, is set to 'down'. Otherwise an empty string.") });
  ChatContextKeys2.responseDetectedAgentCommand = new RawContextKey("chatSessionResponseDetectedAgentOrCommand", false, { type: "boolean", description: localize("chatSessionResponseDetectedAgentOrCommand", "When the agent or command was automatically detected") });
  ChatContextKeys2.responseSupportsIssueReporting = new RawContextKey("chatResponseSupportsIssueReporting", false, { type: "boolean", description: localize("chatResponseSupportsIssueReporting", "True when the current chat response supports issue reporting.") });
  ChatContextKeys2.responseIsFiltered = new RawContextKey("chatSessionResponseFiltered", false, { type: "boolean", description: localize("chatResponseFiltered", "True when the chat response was filtered out by the server.") });
  ChatContextKeys2.responseHasError = new RawContextKey("chatSessionResponseError", false, { type: "boolean", description: localize("chatResponseErrored", "True when the chat response resulted in an error.") });
  ChatContextKeys2.requestInProgress = new RawContextKey("chatSessionRequestInProgress", false, { type: "boolean", description: localize("interactiveSessionRequestInProgress", "True when the current request is still in progress.") });
  ChatContextKeys2.hasActiveRequest = new RawContextKey("chatSessionHasActiveRequest", false, { type: "boolean", description: localize("chatSessionHasActiveRequest", "True when the current chat response has not completed, regardless of intermediate states like tool calls or elicitations.") });
  ChatContextKeys2.currentlyEditing = new RawContextKey("chatSessionCurrentlyEditing", false, { type: "boolean", description: localize("interactiveSessionCurrentlyEditing", "True when the current request is being edited.") });
  ChatContextKeys2.currentlyEditingInput = new RawContextKey("chatSessionCurrentlyEditingInput", false, { type: "boolean", description: localize("interactiveSessionCurrentlyEditingInput", "True when the current request input at the bottom is being edited.") });
  let EditingRequestType;
  ((EditingRequestType2) => {
    EditingRequestType2["Sent"] = "s";
    EditingRequestType2["Queue"] = "q";
    EditingRequestType2["Steer"] = "st";
  })(EditingRequestType = ChatContextKeys2.EditingRequestType || (ChatContextKeys2.EditingRequestType = {}));
  ChatContextKeys2.editingRequestType = new RawContextKey("chatEditingSentRequest", void 0, { type: "string", description: localize("chatEditingSentRequest", "The type of the current editing request.") });
  ChatContextKeys2.isResponse = new RawContextKey("chatResponse", false, { type: "boolean", description: localize("chatResponse", "The chat item is a response.") });
  ChatContextKeys2.isRequest = new RawContextKey("chatRequest", false, { type: "boolean", description: localize("chatRequest", "The chat item is a request") });
  ChatContextKeys2.isFirstRequest = new RawContextKey("chatFirstRequest", false, { type: "boolean", description: localize("chatFirstRequest", "The chat item is the first request in the session.") });
  ChatContextKeys2.isPendingRequest = new RawContextKey("chatRequestIsPending", false, { type: "boolean", description: localize("chatRequestIsPending", "True when the chat request item is pending in the queue.") });
  ChatContextKeys2.itemId = new RawContextKey("chatItemId", "", { type: "string", description: localize("chatItemId", "The id of the chat item.") });
  ChatContextKeys2.lastItemId = new RawContextKey("chatLastItemId", [], { type: "string", description: localize("chatLastItemId", "The id of the last chat item.") });
  ChatContextKeys2.editApplied = new RawContextKey("chatEditApplied", false, { type: "boolean", description: localize("chatEditApplied", "True when the chat text edits have been applied.") });
  ChatContextKeys2.inputHasText = new RawContextKey("chatInputHasText", false, { type: "boolean", description: localize("interactiveInputHasText", "True when the chat input has text.") });
  ChatContextKeys2.inputHasSendableContent = new RawContextKey("chatInputHasSendableContent", false, { type: "boolean", description: localize("interactiveInputHasSendableContent", "True when the chat input has text or file attachments that can be sent.") });
  ChatContextKeys2.inputSubmitPending = new RawContextKey("chatInputSubmitPending", false, { type: "boolean", description: localize("chatInputSubmitPending", "True when a submitted request is being routed or dispatched (e.g. omni-chat routing) and cannot be re-sent yet.") });
  ChatContextKeys2.inputRouting = new RawContextKey("chatInputRouting", false, { type: "boolean", description: localize("chatInputRouting", "True while the destination for a submitted chat request is being resolved.") });
  ChatContextKeys2.inputHasFocus = new RawContextKey("chatInputHasFocus", false, { type: "boolean", description: localize("interactiveInputHasFocus", "True when the chat input has focus.") });
  ChatContextKeys2.inChatInput = new RawContextKey("inChatInput", false, { type: "boolean", description: localize("inInteractiveInput", "True when focus is in the chat input, false otherwise.") });
  ChatContextKeys2.inChatSession = new RawContextKey("inChat", false, { type: "boolean", description: localize("inChat", "True when focus is in the chat widget, false otherwise.") });
  ChatContextKeys2.inChatQuestionCarousel = new RawContextKey("inChatQuestionCarousel", false, { type: "boolean", description: localize("inChatQuestionCarousel", "True when focus is in the chat question carousel.") });
  ChatContextKeys2.chatQuestionCarouselHasTerminal = new RawContextKey("chatQuestionCarouselHasTerminal", false, { type: "boolean", description: localize("chatQuestionCarouselHasTerminal", "True when the chat question carousel was triggered by a terminal and has a terminal to focus.") });
  ChatContextKeys2.inChatEditor = new RawContextKey("inChatEditor", false, { type: "boolean", description: localize("inChatEditor", "Whether focus is in a chat editor.") });
  ChatContextKeys2.inChatTodoList = new RawContextKey("inChatTodoList", false, { type: "boolean", description: localize("inChatTodoList", "True when focus is in the chat todo list.") });
  ChatContextKeys2.inChatTip = new RawContextKey("inChatTip", false, { type: "boolean", description: localize("inChatTip", "True when focus is in a chat tip.") });
  ChatContextKeys2.multipleChatTips = new RawContextKey("multipleChatTips", false, { type: "boolean", description: localize("multipleChatTips", "True when there are multiple chat tips available.") });
  ChatContextKeys2.inChatTerminalToolOutput = new RawContextKey("inChatTerminalToolOutput", false, { type: "boolean", description: localize("inChatTerminalToolOutput", "True when focus is in the chat terminal output region.") });
  ChatContextKeys2.chatModeKind = new RawContextKey("chatAgentKind", ChatModeKind.Ask, { type: "string", description: localize("agentKind", "The 'kind' of the current agent.") });
  ChatContextKeys2.chatPermissionLevel = new RawContextKey("chatPermissionLevel", ChatPermissionLevel.Default, { type: "string", description: localize("chatPermissionLevel", "The current permission level for tool auto-approval.") });
  ChatContextKeys2.chatModeName = new RawContextKey("chatModeName", "", { type: "string", description: localize("chatModeName", "The name of the current chat mode (e.g. 'Plan' for custom modes).") });
  ChatContextKeys2.chatModelId = new RawContextKey("chatModelId", "", { type: "string", description: localize("chatModelId", "The short id of the currently selected chat model (for example 'gpt-4.1').") });
  ChatContextKeys2.speechToTextRecording = new RawContextKey("chatSpeechToTextRecording", false, { type: "boolean", description: localize("chatSpeechToTextRecording", "True while the chat input is recording audio for speech-to-text transcription.") });
  ChatContextKeys2.speechToTextConfigured = new RawContextKey("chatSpeechToTextConfigured", false, { type: "boolean", description: localize("chatSpeechToTextConfigured", "True when on-device speech-to-text is available for dictating into the chat input.") });
  ChatContextKeys2.speechToTextPreparing = new RawContextKey("chatSpeechToTextPreparing", false, { type: "boolean", description: localize("chatSpeechToTextPreparing", "True while the selected speech-to-text backend is preparing.") });
  ChatContextKeys2.supported = ContextKeyExpr.or(IsWebContext.negate(), RemoteNameContext.notEqualsTo(""), ContextKeyExpr.has("config.chat.experimental.serverlessWebEnabled"));
  ChatContextKeys2.enabled = new RawContextKey("chatIsEnabled", false, { type: "boolean", description: localize("chatIsEnabled", "True when chat is enabled because a default chat participant is activated with an implementation.") });
  ChatContextKeys2.accountPolicyGateActive = ChatAccountPolicyGateActiveContext;
  ChatContextKeys2.lockedToCodingAgent = new RawContextKey("lockedToCodingAgent", false, { type: "boolean", description: localize("lockedToCodingAgent", "True when the chat widget is locked to the coding agent session.") });
  ChatContextKeys2.lockedCodingAgentId = new RawContextKey("lockedCodingAgentId", "", { type: "string", description: localize("lockedCodingAgentId", "The agent ID when the chat widget is locked to a coding agent session.") });
  ChatContextKeys2.readOnly = new RawContextKey("chatIsReadonly", false, { type: "boolean", description: localize("chatIsReadonly", "True when the chat shown in the widget is read-only (non-interactive).") });
  ChatContextKeys2.chatIsAgentHostSession = new RawContextKey("chatIsAgentHostSession", false, { type: "boolean", description: localize("chatIsAgentHostSession", "True when the chat widget is locked to an Agent Host session.") });
  ChatContextKeys2.chatAgentHostProviderId = new RawContextKey("chatAgentHostProviderId", "", { type: "string", description: localize("chatAgentHostProviderId", "The Agent Host provider ID when the chat widget is locked to an Agent Host session.") });
  ChatContextKeys2.chatSessionHasCustomAgentTarget = new RawContextKey("chatSessionHasCustomAgentTarget", false, { type: "boolean", description: localize("chatSessionHasCustomAgentTarget", "True when the chat session has a customAgentTarget defined to filter modes.") });
  ChatContextKeys2.chatSessionHasTargetedModels = new RawContextKey("chatSessionHasTargetedModels", false, { type: "boolean", description: localize("chatSessionHasTargetedModels", "True when the chat session has language models that target it via targetChatSessionType.") });
  ChatContextKeys2.agentSupportsAttachments = new RawContextKey("agentSupportsAttachments", false, { type: "boolean", description: localize("agentSupportsAttachments", "True when the chat agent supports attachments.") });
  ChatContextKeys2.withinEditSessionDiff = new RawContextKey("withinEditSessionDiff", false, { type: "boolean", description: localize("withinEditSessionDiff", "True when the chat widget dispatches to the edit session chat.") });
  ChatContextKeys2.filePartOfEditSession = new RawContextKey("filePartOfEditSession", false, { type: "boolean", description: localize("filePartOfEditSession", "True when the chat widget is within a file with an edit session.") });
  ChatContextKeys2.extensionParticipantRegistered = new RawContextKey("chatPanelExtensionParticipantRegistered", false, { type: "boolean", description: localize("chatPanelExtensionParticipantRegistered", "True when a default chat participant is registered for the panel from an extension.") });
  ChatContextKeys2.panelParticipantRegistered = new RawContextKey("chatPanelParticipantRegistered", false, { type: "boolean", description: localize("chatParticipantRegistered", "True when a default chat participant is registered for the panel.") });
  ChatContextKeys2.chatEditingCanUndo = new RawContextKey("chatEditingCanUndo", false, { type: "boolean", description: localize("chatEditingCanUndo", "True when it is possible to undo an interaction in the editing panel.") });
  ChatContextKeys2.chatEditingCanRedo = new RawContextKey("chatEditingCanRedo", false, { type: "boolean", description: localize("chatEditingCanRedo", "True when it is possible to redo an interaction in the editing panel.") });
  ChatContextKeys2.languageModelsAreUserSelectable = new RawContextKey("chatModelsAreUserSelectable", false, { type: "boolean", description: localize("chatModelsAreUserSelectable", "True when the chat model can be selected manually by the user.") });
  ChatContextKeys2.nonCopilotLanguageModelsAreUserSelectable = new RawContextKey("chatNonCopilotModelsAreUserSelectable", false, { type: "boolean", description: localize("chatNonCopilotModelsAreUserSelectable", "True when a user-selectable chat model from a non-Copilot vendor is available.") });
  ChatContextKeys2.chatSessionHasModels = new RawContextKey("chatSessionHasModels", false, { type: "boolean", description: localize("chatSessionHasModels", "True when the chat is in a contributed chat session that has available 'models' to display.") });
  ChatContextKeys2.chatSessionOptionsValid = new RawContextKey("chatSessionOptionsValid", true, { type: "boolean", description: localize("chatSessionOptionsValid", "True when all selected session options exist in their respective option group items.") });
  ChatContextKeys2.extensionInvalid = new RawContextKey("chatExtensionInvalid", false, { type: "boolean", description: localize("chatExtensionInvalid", "True when the installed chat extension is invalid and needs to be updated.") });
  ChatContextKeys2.inputCursorAtTop = new RawContextKey("chatCursorAtTop", false);
  ChatContextKeys2.inputHasAgent = new RawContextKey("chatInputHasAgent", false);
  ChatContextKeys2.location = new RawContextKey("chatLocation", void 0);
  ChatContextKeys2.inQuickChat = new RawContextKey("quickChatHasFocus", false, { type: "boolean", description: localize("inQuickChat", "True when the quick chat UI has focus, false otherwise.") });
  ChatContextKeys2.inChatInputWindow = new RawContextKey("inChatInputWindow", false, { type: "boolean", description: localize("inChatInputWindow", "True when focus is in the floating chat input window, false otherwise.") });
  ChatContextKeys2.inAgentSessionsWelcome = new RawContextKey("inAgentSessionsWelcome", false, { type: "boolean", description: localize("inAgentSessionsWelcome", "True when the chat input is within the agent sessions welcome page.") });
  ChatContextKeys2.inAutomationsDialog = new RawContextKey("inAutomationsDialog", false, { type: "boolean", description: localize("inAutomationsDialog", "True when the chat input is within the automations dialog.") });
  ChatContextKeys2.chatSessionType = new RawContextKey("chatSessionType", "", { type: "string", description: localize("chatSessionType", "The type of the current chat session.") });
  ChatContextKeys2.hasFileAttachments = new RawContextKey("chatHasFileAttachments", false, { type: "boolean", description: localize("chatHasFileAttachments", "True when the chat has file attachments.") });
  ChatContextKeys2.chatSessionIsEmpty = new RawContextKey("chatSessionIsEmpty", true, { type: "boolean", description: localize("chatSessionIsEmpty", "True when the current chat session has no requests.") });
  ChatContextKeys2.hasPendingRequests = new RawContextKey("chatHasPendingRequests", false, { type: "boolean", description: localize("chatHasPendingRequests", "True when there are pending requests in the queue.") });
  ChatContextKeys2.chatSessionHasDebugData = new RawContextKey("chatSessionHasDebugData", false, { type: "boolean", description: localize("chatSessionHasDebugData", "True when the current chat session has debug log data.") });
  ChatContextKeys2.chatSessionHasDebugTools = new RawContextKey("chatSessionHasDebugTools", false, { type: "boolean", description: localize("chatSessionHasDebugTools", "True when debug tools are enabled in the current chat session.") });
  ChatContextKeys2.remoteJobCreating = new RawContextKey("chatRemoteJobCreating", false, { type: "boolean", description: localize("chatRemoteJobCreating", "True when a remote coding agent job is being created.") });
  ChatContextKeys2.hasRemoteCodingAgent = new RawContextKey("hasRemoteCodingAgent", false, localize("hasRemoteCodingAgent", "Whether any remote coding agent is available"));
  ChatContextKeys2.hasCanDelegateProviders = new RawContextKey("chatHasCanDelegateProviders", false, { type: "boolean", description: localize("chatHasCanDelegateProviders", "True when there are chat session providers with delegation support available.") });
  ChatContextKeys2.enableRemoteCodingAgentPromptFileOverlay = new RawContextKey("enableRemoteCodingAgentPromptFileOverlay", false, localize("enableRemoteCodingAgentPromptFileOverlay", "Whether the remote coding agent prompt file overlay feature is enabled"));
  ChatContextKeys2.skipChatRequestInProgressMessage = new RawContextKey("chatSkipRequestInProgressMessage", false, { type: "boolean", description: localize("chatSkipRequestInProgressMessage", "True when the chat request in progress message should be skipped.") });
  ChatContextKeys2.Setup = ChatEntitlementContextKeys.Setup;
  ChatContextKeys2.Entitlement = ChatEntitlementContextKeys.Entitlement;
  ChatContextKeys2.chatQuotaExceeded = ChatEntitlementContextKeys.chatQuotaExceeded;
  ChatContextKeys2.completionsQuotaExceeded = ChatEntitlementContextKeys.completionsQuotaExceeded;
  ChatContextKeys2.Editing = {
    hasToolConfirmation: new RawContextKey("chatHasToolConfirmation", false, { type: "boolean", description: localize("chatEditingHasToolConfirmation", "True when a tool confirmation is present.") }),
    hasElicitationRequest: new RawContextKey("chatHasElicitationRequest", false, { type: "boolean", description: localize("chatEditingHasElicitationRequest", "True when a chat elicitation request is pending.") }),
    hasQuestionCarousel: new RawContextKey("chatHasQuestionCarousel", false, { type: "boolean", description: localize("chatEditingHasQuestionCarousel", "True when a question carousel is rendered in the chat input.") })
  };
  ChatContextKeys2.Tools = {
    toolsCount: new RawContextKey("toolsCount", 0, { type: "number", description: localize("toolsCount", "The count of tools available in the chat.") })
  };
  ChatContextKeys2.foregroundSessionCount = new RawContextKey("chatForegroundSessionCount", 0, { type: "number", description: localize("chatForegroundSessionCount", "The number of foreground chat sessions visible across chat surfaces.") });
  ChatContextKeys2.Modes = {
    hasCustomChatModes: new RawContextKey("chatHasCustomAgents", false, { type: "boolean", description: localize("chatHasAgents", "True when the chat has custom agents available.") }),
    agentModeDisabledByPolicy: new RawContextKey("chatAgentModeDisabledByPolicy", false, { type: "boolean", description: localize("chatAgentModeDisabledByPolicy", "True when agent mode is disabled by organization policy.") })
  };
  ChatContextKeys2.panelLocation = new RawContextKey("chatPanelLocation", void 0, { type: "number", description: localize("chatPanelLocation", "The location of the chat panel.") });
  ChatContextKeys2.agentSessionsViewerFocused = new RawContextKey("agentSessionsViewerFocused", true, { type: "boolean", description: localize("agentSessionsViewerFocused", "If the agent sessions view in the chat view is focused.") });
  ChatContextKeys2.agentSessionsViewerOrientation = new RawContextKey("agentSessionsViewerOrientation", void 0, { type: "number", description: localize("agentSessionsViewerOrientation", "Orientation of the agent sessions view in the chat view.") });
  ChatContextKeys2.agentSessionsViewerPosition = new RawContextKey("agentSessionsViewerPosition", void 0, { type: "number", description: localize("agentSessionsViewerPosition", "Position of the agent sessions view in the chat view.") });
  ChatContextKeys2.agentSessionsViewerVisible = new RawContextKey("agentSessionsViewerVisible", void 0, { type: "boolean", description: localize("agentSessionsViewerVisible", "Visibility of the agent sessions view in the chat view.") });
  ChatContextKeys2.agentSessionType = new RawContextKey("chatSessionType", "", { type: "string", description: localize("agentSessionType", "The type of the current agent session item.") });
  ChatContextKeys2.agentSessionPullRequest = new RawContextKey("chatSessionPullRequest", "", { type: "string", description: localize("agentSessionPullRequest", "Whether the current agent session item has an associated pull request: 'available' or 'none'. Unset when the pull request state is unknown.") });
  ChatContextKeys2.chatSessionSupportsDelegation = new RawContextKey("chatSessionSupportsDelegation", true, { type: "boolean", description: localize("chatSessionSupportsDelegation", "True when the current session type supports delegation.") });
  ChatContextKeys2.hasPendingDelegationTarget = new RawContextKey("chatHasPendingDelegationTarget", false, { type: "boolean", description: localize("chatHasPendingDelegationTarget", "True when a delegation (continue in) target is selected but the request has not been submitted yet.") });
  ChatContextKeys2.chatSessionSupportsFork = new RawContextKey("chatSessionSupportsFork", false, { type: "boolean", description: localize("chatSessionSupportsFork", "True when the current chat session provider supports forking conversations.") });
  ChatContextKeys2.agentSessionSection = new RawContextKey("agentSessionSection", "", { type: "string", description: localize("agentSessionSection", "The section of the current agent session section item.") });
  ChatContextKeys2.isArchivedAgentSession = new RawContextKey("agentSessionIsArchived", false, { type: "boolean", description: localize("agentSessionIsArchived", "True when the agent session item is archived.") });
  ChatContextKeys2.isPinnedAgentSession = new RawContextKey("agentSessionIsPinned", false, { type: "boolean", description: localize("agentSessionIsPinned", "True when the agent session item is pinned.") });
  ChatContextKeys2.isReadAgentSession = new RawContextKey("agentSessionIsRead", false, { type: "boolean", description: localize("agentSessionIsRead", "True when the agent session item is read.") });
  ChatContextKeys2.hasMultipleAgentSessionsSelected = new RawContextKey("agentSessionHasMultipleSelected", false, { type: "boolean", description: localize("agentSessionHasMultipleSelected", "True when multiple agent sessions are selected.") });
  ChatContextKeys2.hasAgentSessionChanges = new RawContextKey("agentSessionHasChanges", false, { type: "boolean", description: localize("agentSessionHasChanges", "True when the current agent session item has changes.") });
  ChatContextKeys2.isKatexMathElement = new RawContextKey("chatIsKatexMathElement", false, { type: "boolean", description: localize("chatIsKatexMathElement", "True when focusing a KaTeX math element.") });
  ChatContextKeys2.hasUsedCreateSlashCommands = new RawContextKey("chatHasUsedCreateSlashCommands", false, { type: "boolean", description: localize("chatHasUsedCreateSlashCommands", "True when the user has used any of the /create-* slash commands.") });
  ChatContextKeys2.contextUsageHasBeenOpened = new RawContextKey("chatContextUsageHasBeenOpened", false, { type: "boolean", description: localize("chatContextUsageHasBeenOpened", "True when the user has opened the context window usage details.") });
  ChatContextKeys2.newChatButtonExperimentIcon = new RawContextKey("chatNewChatButtonExperimentIcon", "", { type: "string", description: localize("chatNewChatButtonExperimentIcon", "The icon variant for the new chat button, controlled by experiment. Values: 'copilot', 'new-session', 'comment', or empty for default.") });
})(ChatContextKeys || (ChatContextKeys = {}));
var ChatContextKeyExprs;
((ChatContextKeyExprs2) => {
  ChatContextKeyExprs2.inEditingMode = ContextKeyExpr.or(
    ChatContextKeys.chatModeKind.isEqualTo(ChatModeKind.Edit),
    ChatContextKeys.chatModeKind.isEqualTo(ChatModeKind.Agent)
  );
  ChatContextKeyExprs2.isAgentHostSession = ChatContextKeys.chatIsAgentHostSession.isEqualTo(true);
  ChatContextKeyExprs2.isAgentHostSessionItem = ContextKeyExpr.or(
    ContextKeyExpr.regex(ChatContextKeys.agentSessionType.key, /^agent-host-/),
    ContextKeyExpr.regex(ChatContextKeys.agentSessionType.key, /^remote-/)
  );
})(ChatContextKeyExprs || (ChatContextKeyExprs = {}));
export {
  ChatContextKeyExprs,
  ChatContextKeys
};
