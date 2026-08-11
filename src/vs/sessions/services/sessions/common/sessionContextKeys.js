import { isEqual } from "../../../../base/common/resources.js";
import {
  SessionHasChangesContext,
  SessionHasPullRequestContext,
  SessionHasIssuesContext,
  SessionHasWorkspaceContext,
  IsQuickChatSessionContext,
  SessionIsArchivedContext,
  SessionIsCreatedContext,
  SessionIsReadContext,
  SessionIsStickyContext,
  SessionProviderIdContext,
  SessionSupportsDeleteContext,
  SessionSupportsMultipleChatsContext,
  SessionSupportsForkContext,
  SessionSupportsSideChatContext,
  SessionSupportsRenameContext,
  SessionTypeContext,
  SessionWorkspaceIsVirtualContext,
  SessionIdContext,
  SessionHasMultipleCommittedChatsContext,
  SessionShouldShowChatTabsContext,
  SessionHasMultipleOpenChatsContext,
  SessionActiveChatIsClosableContext,
  SessionActiveChatIsDeletableContext,
  SessionActiveChatHasSubagentsContext,
  SessionHasGitRepositoryContext
} from "../../../common/contextkeys.js";
import { ChatOriginKind, getChatCapabilities, SessionStatus } from "./session.js";
const boundKeysByService = /* @__PURE__ */ new WeakMap();
function getBoundKeys(contextKeyService) {
  let keys = boundKeysByService.get(contextKeyService);
  if (!keys) {
    keys = {
      sessionId: SessionIdContext.bindTo(contextKeyService),
      providerId: SessionProviderIdContext.bindTo(contextKeyService),
      type: SessionTypeContext.bindTo(contextKeyService),
      isArchived: SessionIsArchivedContext.bindTo(contextKeyService),
      isRead: SessionIsReadContext.bindTo(contextKeyService),
      supportsMultipleChats: SessionSupportsMultipleChatsContext.bindTo(contextKeyService),
      supportsFork: SessionSupportsForkContext.bindTo(contextKeyService),
      supportsSideChat: SessionSupportsSideChatContext.bindTo(contextKeyService),
      supportsRename: SessionSupportsRenameContext.bindTo(contextKeyService),
      supportsDelete: SessionSupportsDeleteContext.bindTo(contextKeyService),
      workspaceIsVirtual: SessionWorkspaceIsVirtualContext.bindTo(contextKeyService),
      hasGitRepository: SessionHasGitRepositoryContext.bindTo(contextKeyService),
      hasChanges: SessionHasChangesContext.bindTo(contextKeyService),
      hasPullRequest: SessionHasPullRequestContext.bindTo(contextKeyService),
      hasIssues: SessionHasIssuesContext.bindTo(contextKeyService),
      hasWorkspace: SessionHasWorkspaceContext.bindTo(contextKeyService),
      isQuickChat: IsQuickChatSessionContext.bindTo(contextKeyService),
      isCreated: SessionIsCreatedContext.bindTo(contextKeyService),
      sticky: SessionIsStickyContext.bindTo(contextKeyService),
      hasMultipleCommittedChats: SessionHasMultipleCommittedChatsContext.bindTo(contextKeyService),
      shouldShowChatTabs: SessionShouldShowChatTabsContext.bindTo(contextKeyService),
      hasMultipleOpenChats: SessionHasMultipleOpenChatsContext.bindTo(contextKeyService),
      activeChatIsClosable: SessionActiveChatIsClosableContext.bindTo(contextKeyService),
      activeChatIsDeletable: SessionActiveChatIsDeletableContext.bindTo(contextKeyService),
      activeChatHasSubagents: SessionActiveChatHasSubagentsContext.bindTo(contextKeyService)
    };
    boundKeysByService.set(contextKeyService, keys);
  }
  return keys;
}
function setSessionContextKeys(session, contextKeyService, reader) {
  const keys = getBoundKeys(contextKeyService);
  keys.sessionId.set(session?.sessionId ?? "");
  keys.providerId.set(session?.providerId ?? "");
  keys.type.set(session?.sessionType ?? "");
  keys.isArchived.set(session?.isArchived.read(reader) ?? false);
  keys.isRead.set(session?.isRead.read(reader) ?? true);
  const capabilities = session?.capabilities.read(reader);
  keys.supportsMultipleChats.set(capabilities?.supportsMultipleChats ?? false);
  keys.supportsFork.set(capabilities?.supportsFork ?? false);
  keys.supportsSideChat.set(capabilities?.supportsSideChat ?? false);
  keys.supportsRename.set(capabilities?.supportsRename ?? false);
  keys.supportsDelete.set(capabilities?.supportsDelete ?? false);
  const workspace = session?.workspace.read(reader);
  keys.workspaceIsVirtual.set(workspace?.isVirtualWorkspace ?? true);
  keys.hasGitRepository.set(session?.hasGitRepository?.read(reader) ?? workspace?.folders.some((folder) => folder.gitRepository !== void 0) ?? false);
  const worktreePending = session?.worktreePending?.read(reader) ?? false;
  const defaultChangeset = session?.changesets.read(reader)?.find((c) => c.isDefault.read(reader));
  let insertions = 0;
  let deletions = 0;
  for (const change of defaultChangeset?.changes.read(reader) ?? session?.changes.read(reader) ?? []) {
    insertions += change.insertions;
    deletions += change.deletions;
  }
  keys.hasChanges.set(!worktreePending && (insertions > 0 || deletions > 0));
  const pullRequest = session?.workspace.read(reader)?.folders[0]?.gitRepository?.gitHubInfo.read(reader)?.pullRequest;
  keys.hasPullRequest.set(!!pullRequest);
  const issues = session?.workspace.read(reader)?.folders[0]?.gitRepository?.gitHubInfo.read(reader)?.issues;
  keys.hasIssues.set(!!issues?.length);
  keys.hasWorkspace.set(!!session?.workspace.read(reader)?.label);
  keys.isQuickChat.set(!!session && (session.isQuickChat?.read(reader) ?? false));
}
function setActiveSessionContextKeys(session, contextKeyService, reader) {
  setSessionContextKeys(session, contextKeyService, reader);
  const keys = getBoundKeys(contextKeyService);
  keys.isCreated.set(session?.isCreated.read(reader) ?? false);
  keys.sticky.set(session?.sticky.read(reader) ?? false);
  const committedChatCount = session?.chats.read(reader).reduce((count, chat) => chat.status.read(reader) === SessionStatus.Untitled || chat.origin?.kind === ChatOriginKind.Tool ? count : count + 1, 0) ?? 0;
  keys.hasMultipleCommittedChats.set(committedChatCount > 1);
  keys.shouldShowChatTabs.set(session?.shouldShowChatTabs.read(reader) ?? false);
  keys.hasMultipleOpenChats.set((session?.visibleChatTabs.read(reader).length ?? 0) > 1);
  const activeChat = session?.activeChat.read(reader);
  const mainResource = session?.mainChat.read(reader).resource;
  const isNonMainChat = !!activeChat && !!mainResource && !isEqual(activeChat.resource, mainResource);
  keys.activeChatIsClosable.set(isNonMainChat);
  keys.activeChatIsDeletable.set(!!activeChat && getChatCapabilities(activeChat, session, reader).canDelete);
  const allChats = session?.chats.read(reader) ?? [];
  keys.activeChatHasSubagents.set(!!activeChat && allChats.some((chat) => chat.origin?.kind === ChatOriginKind.Tool && !!chat.origin.parentChat && isEqual(chat.origin.parentChat, activeChat.resource)));
}
export {
  setActiveSessionContextKeys,
  setSessionContextKeys
};
