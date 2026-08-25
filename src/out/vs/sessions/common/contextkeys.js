import { localize } from "../../nls.js";
import { RawContextKey } from "../../platform/contextkey/common/contextkey.js";
const IsNewChatSessionContext = new RawContextKey("isNewChatSession", true);
const SessionIdContext = new RawContextKey("sessionId", "", localize("sessionId", "The identifier of the session in scope (the active session globally, or a specific session within an isolated component such as the session view or a context menu overlay)"));
const SessionProviderIdContext = new RawContextKey("sessionProviderId", "", localize("sessionProviderId", "The provider ID of the session in scope (the active session globally, or a specific session within an isolated component such as the session view or a context menu overlay)"));
const SessionTypeContext = new RawContextKey("sessionType", "", localize("sessionType", "The session type of the session in scope (the active session globally, or a specific session within an isolated component such as the session view or a context menu overlay)"));
const SessionWorkspaceIsVirtualContext = new RawContextKey("sessionWorkspaceIsVirtual", true, localize("sessionWorkspaceIsVirtual", "Whether the session's workspace is virtual"));
const SessionHasGitRepositoryContext = new RawContextKey("sessionHasGitRepository", false, localize("sessionHasGitRepository", "Whether the session has a usable git repository"));
const SessionHasGitSyncActionRunningContext = new RawContextKey("sessionHasGitSyncActionRunning", false, localize("sessionHasGitSyncActionRunning", "Whether the session has a git sync action currently running"));
const SessionUsesCombinedConfigPickerContext = new RawContextKey("sessionUsesCombinedConfigPicker", false, localize("sessionUsesCombinedConfigPicker", "Whether the session's provider offers a combined mode and model configuration picker (used on phone layouts in place of the standalone pickers)"));
const SessionSupportsRenameContext = new RawContextKey("sessionSupportsRename", false, localize("sessionSupportsRename", "Whether the session can be renamed"));
const SessionSupportsDeleteContext = new RawContextKey("sessionSupportsDelete", false, localize("sessionSupportsDelete", "Whether the session can be deleted"));
const SessionIsCreatedContext = new RawContextKey("sessionIsCreated", false, localize("sessionIsCreated", "Whether the session view's session has been created (chat view shown, not new-session view)"));
const SessionIsStickyContext = new RawContextKey("sessionIsSticky", false, localize("sessionIsSticky", "Whether the session view's session is sticky in the grid"));
const SessionIsMaximizedContext = new RawContextKey("sessionIsMaximized", false, localize("sessionIsMaximized", "Whether the session view is currently maximized in the sessions part's grid"));
const SessionSupportsMultipleChatsContext = new RawContextKey("sessionSupportsMultipleChats", false, localize("sessionSupportsMultipleChats", "Whether the session view's session supports multiple chats"));
const SessionSupportsForkContext = new RawContextKey("sessionSupportsFork", false, localize("sessionSupportsFork", "Whether the session view's session supports forking a chat from a turn into a new peer chat"));
const SessionSupportsSideChatContext = new RawContextKey("sessionSupportsSideChat", false, localize("sessionSupportsSideChat", "Whether the session view's session supports creating a side chat from a turn (via /btw)"));
const SessionHasMultipleCommittedChatsContext = new RawContextKey("sessionHasMultipleCommittedChats", false, localize("sessionHasMultipleCommittedChats", "Whether the session view's session has more than one committed (non-draft) chat, which drives the Conversations menu visibility"));
const SessionActiveChatHasSubagentsContext = new RawContextKey("sessionActiveChatHasSubagents", false, localize("sessionActiveChatHasSubagents", "Whether the session view's currently-active chat has spawned subagent (tool-origin) chats, which are listed as a separate group in the Conversations menu"));
const SessionShouldShowChatTabsContext = new RawContextKey("sessionShouldShowChatTabs", false, localize("sessionShouldShowChatTabs", "Whether the session view's chat tab strip is shown, i.e. the session has more than one chat actually showing as a tab. A single visible tab always hides the strip. Used to hide the header New Chat button, which the tab strip then offers instead"));
const SessionHasMultipleOpenChatsContext = new RawContextKey("sessionHasMultipleOpenChats", false, localize("sessionHasMultipleOpenChats", "Whether the session view's session has more than one open chat (the tabs shown in the strip, including in-composer drafts). Used to scope chat-to-chat navigation (next/previous chat, the Ctrl+Tab chat switcher)"));
const SessionActiveChatIsClosableContext = new RawContextKey("sessionActiveChatIsClosable", false, localize("sessionActiveChatIsClosable", "Whether the session's active chat can be closed (hidden) from the tab strip, i.e. it is not the main chat. Includes read-only subagent chats. Used to scope the close-chat keybinding so it closes the tab instead of the session"));
const SessionActiveChatIsDeletableContext = new RawContextKey("sessionActiveChatIsDeletable", false, localize("sessionActiveChatIsDeletable", "Whether the session's active chat can be permanently deleted from the tab strip, i.e. it is a real, user-created non-main chat (not the main chat and not a tool-spawned subagent chat, which are transient children). Used to scope the delete-chat keybinding"));
const SessionIsReadContext = new RawContextKey("sessionIsRead", true, localize("sessionIsRead", "Whether the session has been marked as read"));
const SessionIsArchivedContext = new RawContextKey("sessionIsArchived", false, localize("sessionIsArchived", "Whether the session in scope is archived/marked as done (the active session globally, or a specific session within an isolated component such as the session view or a context menu overlay)"));
const SessionHasChangesContext = new RawContextKey("sessionHasChanges", false, localize("sessionHasChanges", "Whether the session view's session has pending changes (insertions or deletions)"));
const SessionHasPullRequestContext = new RawContextKey("sessionHasPullRequest", false, localize("sessionHasPullRequest", "Whether the session view's session is associated with a GitHub pull request"));
const SessionHasIssuesContext = new RawContextKey("sessionHasIssues", false, localize("sessionHasIssues", "Whether the session view's session references at least one GitHub issue"));
const SessionHasWorkspaceContext = new RawContextKey("sessionHasWorkspace", false, localize("sessionHasWorkspace", "Whether the session view's session has an associated workspace folder"));
const IsQuickChatSessionContext = new RawContextKey("isQuickChatSession", false, localize("isQuickChatSession", "Whether the session in scope is a workspace-less quick chat"));
const ActiveSessionsContext = new RawContextKey("activeSessions", "", localize("activeSessions", "The identifier of the active sessions panel"));
const SessionsFocusContext = new RawContextKey("sessionsFocus", false, localize("sessionsFocus", "Whether the sessions part has keyboard focus"));
const SessionsVisibleContext = new RawContextKey("sessionsVisible", false, localize("sessionsVisible", "Whether the sessions part is visible"));
const MultipleSessionsVisibleContext = new RawContextKey("multipleSessionsVisible", false, localize("multipleSessionsVisible", "Whether more than one session is visible in the sessions part's grid"));
const CustomViewVisibleContext = new RawContextKey("customViewVisible", false, localize("customViewVisible", "Whether a custom view is shown in place of the sessions grid. The side panel and the panel are hidden while it is."));
const AutomationsCustomViewFocusContext = new RawContextKey("automationsCustomViewFocus", false, localize("automationsCustomViewFocus", "Whether the Automations custom view has keyboard focus"));
const AutomationsHasItemsContext = new RawContextKey("automationsHasItems", false, localize("automationsHasItems", "Whether there is at least one automation"));
const SessionsWelcomeVisibleContext = new RawContextKey("sessionsWelcomeVisible", false, localize("sessionsWelcomeVisible", "Whether the sessions welcome overlay is visible"));
const SessionsTitleBarNewSessionEnabledContext = new RawContextKey("sessionsTitleBarNewSessionEnabled", false, localize("sessionsTitleBarNewSessionEnabled", "Whether the new-session button is shown in the titlebar when the sessions list is hidden (A/B experiment)"));
const SessionWorkspacePickerGroupContext = new RawContextKey("sessionWorkspacePickerGroup", "", localize("sessionWorkspacePickerGroup", "The currently active group tab in the session workspace picker"));
const SessionWorkspacePickerVisibleContext = new RawContextKey("sessionWorkspacePickerVisible", false, localize("sessionWorkspacePickerVisible", "Whether the new-session view's workspace picker is rendered (as opposed to being replaced by the no-agent-host empty state)"));
const SessionHarnessPickerVisibleContext = new RawContextKey("sessionHarnessPickerVisible", false, localize("sessionHarnessPickerVisible", "Whether the new-session view's harness (session type) picker is visible \u2014 it is hidden when at most one harness can serve the selected workspace"));
const SessionIsolationPickerVisibleContext = new RawContextKey("sessionIsolationPickerVisible", false, localize("sessionIsolationPickerVisible", "Whether the new-session view's isolation picker is visible \u2014 it is shown only when the isolation option is enabled and the workspace has a git repository"));
const AgentHostSessionTypesAvailableContext = new RawContextKey("agentHostSessionTypesAvailable", false, localize("agentHostSessionTypesAvailable", "Whether at least one connected agent-host provider has advertised session types"));
const SessionsPickerVisibleContext = new RawContextKey("sessionsPickerVisible", false, localize("sessionsPickerVisible", "Whether the sessions picker is visible"));
const SessionChatsPickerVisibleContext = new RawContextKey("sessionChatsPickerVisible", false, localize("sessionChatsPickerVisible", "Whether the chats picker (chats within the active session) is visible"));
const SessionsBlockedSessionsVisibleContext = new RawContextKey("sessionsBlockedSessionsVisible", false, localize("sessionsBlockedSessionsVisible", "Whether the blocked-sessions dropdown (surfacing sessions that require input) is open in the sessions titlebar"));
const SessionsAquariumActiveContext = new RawContextKey("sessionsAquariumActive", false, localize("sessionsAquariumActive", "Whether the sessions aquarium overlay is active"));
const CanGoBackContext = new RawContextKey("sessionsCanGoBack", false, localize("sessionsCanGoBack", "Whether there is a previous session in the navigation history"));
const CanGoForwardContext = new RawContextKey("sessionsCanGoForward", false, localize("sessionsCanGoForward", "Whether there is a next session in the navigation history"));
const EditorMaximizedContext = new RawContextKey("editorMaximized", false, localize("editorMaximized", "Whether the editor area is maximized"));
const SinglePaneLayoutEnabledContext = new RawContextKey("agentSessionsSinglePaneLayoutEnabled", false, localize("agentSessionsSinglePaneLayoutEnabled", "Whether the Agents window is using the single-pane (docked detail panel) layout. Single source of truth for gating single-pane behaviour \u2014 set once by the workbench from the layout it was constructed with; features must read this instead of the underlying setting"));
const HasDockedDetailsContext = new RawContextKey("agentSessionsHasDockedDetails", false, localize("agentSessionsHasDockedDetails", "Whether the single-pane active editor has a docked detail panel (a managed Changes/Files tab or a text file editor)"));
const SinglePaneDiffEditorInputActiveContext = new RawContextKey("agentSessionsSinglePaneDiffEditorInputActive", false, localize("agentSessionsSinglePaneDiffEditorInputActive", "Whether the active single-pane editor input is a diff, independent of the editor used to render it"));
const SinglePaneChangesTabMissingContext = new RawContextKey("agentSessionsSinglePaneChangesTabMissing", false, localize("agentSessionsSinglePaneChangesTabMissing", "Whether the single-pane session supports a Changes editor but its tab is not currently open"));
const SinglePaneFilesTabMissingContext = new RawContextKey("agentSessionsSinglePaneFilesTabMissing", false, localize("agentSessionsSinglePaneFilesTabMissing", "Whether the single-pane session supports a Files tab but its tab is not currently open"));
const SinglePaneChangesTabAvailableContext = new RawContextKey("agentSessionsSinglePaneChangesTabAvailable", false, localize("agentSessionsSinglePaneChangesTabAvailable", "Whether the single-pane session supports a Changes editor"));
const SinglePaneFilesTabAvailableContext = new RawContextKey("agentSessionsSinglePaneFilesTabAvailable", false, localize("agentSessionsSinglePaneFilesTabAvailable", "Whether the single-pane session supports a Files editor"));
const IsPhoneLayoutContext = new RawContextKey("sessionsIsPhoneLayout", false, localize("sessionsIsPhoneLayout", "Whether the current layout is the phone layout"));
const KeyboardVisibleContext = new RawContextKey("sessionsKeyboardVisible", false, localize("sessionsKeyboardVisible", "Whether the virtual keyboard is visible"));
export {
  ActiveSessionsContext,
  AgentHostSessionTypesAvailableContext,
  AutomationsCustomViewFocusContext,
  AutomationsHasItemsContext,
  CanGoBackContext,
  CanGoForwardContext,
  CustomViewVisibleContext,
  EditorMaximizedContext,
  HasDockedDetailsContext,
  IsNewChatSessionContext,
  IsPhoneLayoutContext,
  IsQuickChatSessionContext,
  KeyboardVisibleContext,
  MultipleSessionsVisibleContext,
  SessionActiveChatHasSubagentsContext,
  SessionActiveChatIsClosableContext,
  SessionActiveChatIsDeletableContext,
  SessionChatsPickerVisibleContext,
  SessionHarnessPickerVisibleContext,
  SessionHasChangesContext,
  SessionHasGitRepositoryContext,
  SessionHasGitSyncActionRunningContext,
  SessionHasIssuesContext,
  SessionHasMultipleCommittedChatsContext,
  SessionHasMultipleOpenChatsContext,
  SessionHasPullRequestContext,
  SessionHasWorkspaceContext,
  SessionIdContext,
  SessionIsArchivedContext,
  SessionIsCreatedContext,
  SessionIsMaximizedContext,
  SessionIsReadContext,
  SessionIsStickyContext,
  SessionIsolationPickerVisibleContext,
  SessionProviderIdContext,
  SessionShouldShowChatTabsContext,
  SessionSupportsDeleteContext,
  SessionSupportsForkContext,
  SessionSupportsMultipleChatsContext,
  SessionSupportsRenameContext,
  SessionSupportsSideChatContext,
  SessionTypeContext,
  SessionUsesCombinedConfigPickerContext,
  SessionWorkspaceIsVirtualContext,
  SessionWorkspacePickerGroupContext,
  SessionWorkspacePickerVisibleContext,
  SessionsAquariumActiveContext,
  SessionsBlockedSessionsVisibleContext,
  SessionsFocusContext,
  SessionsPickerVisibleContext,
  SessionsTitleBarNewSessionEnabledContext,
  SessionsVisibleContext,
  SessionsWelcomeVisibleContext,
  SinglePaneChangesTabAvailableContext,
  SinglePaneChangesTabMissingContext,
  SinglePaneDiffEditorInputActiveContext,
  SinglePaneFilesTabAvailableContext,
  SinglePaneFilesTabMissingContext,
  SinglePaneLayoutEnabledContext
};
