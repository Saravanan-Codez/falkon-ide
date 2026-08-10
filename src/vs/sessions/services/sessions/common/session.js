import { arrayEquals } from "../../../../base/common/equals.js";
import { isEqual } from "../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { localize } from "../../../../nls.js";
import { isIChatSessionFileChange2 } from "../../../../workbench/contrib/chat/common/chatSessionsService.js";
var SessionTypeAuthRequirement = /* @__PURE__ */ ((SessionTypeAuthRequirement2) => {
  SessionTypeAuthRequirement2["None"] = "none";
  SessionTypeAuthRequirement2["GitHub"] = "github";
  SessionTypeAuthRequirement2["Unusable"] = "unusable";
  return SessionTypeAuthRequirement2;
})(SessionTypeAuthRequirement || {});
const GITHUB_REMOTE_FILE_SCHEME = "github-remote-file";
var SessionStatus = /* @__PURE__ */ ((SessionStatus2) => {
  SessionStatus2[SessionStatus2["Untitled"] = 0] = "Untitled";
  SessionStatus2[SessionStatus2["InProgress"] = 1] = "InProgress";
  SessionStatus2[SessionStatus2["NeedsInput"] = 2] = "NeedsInput";
  SessionStatus2[SessionStatus2["Completed"] = 3] = "Completed";
  SessionStatus2[SessionStatus2["Error"] = 4] = "Error";
  return SessionStatus2;
})(SessionStatus || {});
function isActiveSessionStatus(status) {
  return status === 1 /* InProgress */ || status === 2 /* NeedsInput */;
}
var ChatInteractivity = /* @__PURE__ */ ((ChatInteractivity2) => {
  ChatInteractivity2["Full"] = "full";
  ChatInteractivity2["ReadOnly"] = "read-only";
  ChatInteractivity2["Hidden"] = "hidden";
  return ChatInteractivity2;
})(ChatInteractivity || {});
function effectiveChatInteractivity(isArchived, interactivity) {
  if (interactivity === "hidden" /* Hidden */) {
    return "hidden" /* Hidden */;
  }
  return isArchived ? "read-only" /* ReadOnly */ : interactivity;
}
var SessionWorkspaceKind = /* @__PURE__ */ ((SessionWorkspaceKind2) => {
  SessionWorkspaceKind2["Virtual"] = "virtual";
  SessionWorkspaceKind2["Folder"] = "folder";
  SessionWorkspaceKind2["Worktree"] = "worktree";
  return SessionWorkspaceKind2;
})(SessionWorkspaceKind || {});
function getSessionWorkspaceKind(workspace, worktreePending = false) {
  if (workspace?.isVirtualWorkspace) {
    return "virtual" /* Virtual */;
  }
  if (!worktreePending && workspace && workspace.folders.length > 0 && workspace.folders[0]?.gitRepository?.workTreeUri === void 0) {
    return "folder" /* Folder */;
  }
  return "worktree" /* Worktree */;
}
var SessionFileOperation = /* @__PURE__ */ ((SessionFileOperation2) => {
  SessionFileOperation2["Created"] = "created";
  SessionFileOperation2["Modified"] = "modified";
  SessionFileOperation2["Deleted"] = "deleted";
  return SessionFileOperation2;
})(SessionFileOperation || {});
const BRANCH_CHANGES_CHANGESET_ID = "branchChanges";
const TURN_CHANGES_CHANGESET_ID = "turn";
var SessionChangesetOperationScope = /* @__PURE__ */ ((SessionChangesetOperationScope2) => {
  SessionChangesetOperationScope2["Changeset"] = "changeset";
  SessionChangesetOperationScope2["Resource"] = "resource";
  SessionChangesetOperationScope2["Range"] = "range";
  return SessionChangesetOperationScope2;
})(SessionChangesetOperationScope || {});
var SessionChangesetOperationStatus = /* @__PURE__ */ ((SessionChangesetOperationStatus2) => {
  SessionChangesetOperationStatus2["Idle"] = "idle";
  SessionChangesetOperationStatus2["Running"] = "running";
  SessionChangesetOperationStatus2["Error"] = "error";
  SessionChangesetOperationStatus2["Disabled"] = "disabled";
  return SessionChangesetOperationStatus2;
})(SessionChangesetOperationStatus || {});
var ChatOriginKind = /* @__PURE__ */ ((ChatOriginKind2) => {
  ChatOriginKind2["Tool"] = "tool";
  ChatOriginKind2["User"] = "user";
  ChatOriginKind2["Fork"] = "fork";
  ChatOriginKind2["SideChat"] = "sideChat";
  return ChatOriginKind2;
})(ChatOriginKind || {});
const DEFAULT_CHAT_CAPABILITIES = { canRename: true, canDelete: true };
function getChatCapabilities(chat, session, reader) {
  const own = chat.capabilities?.read(reader) ?? DEFAULT_CHAT_CAPABILITIES;
  if (session && isEqual(chat.resource, session.mainChat.read(reader).resource)) {
    return own.canDelete ? { ...own, canDelete: false } : own;
  }
  return own;
}
function sessionHasChanges(session, reader) {
  if (session.chats.read(reader).some((chat) => chat.changes.read(reader).length > 0)) {
    return true;
  }
  const changesSummary = session.changesSummary?.read(reader);
  if (changesSummary !== void 0) {
    return changesSummary.files > 0;
  }
  return session.changes.read(reader).length > 0;
}
function toSessionId(providerId, resource) {
  return `${providerId}:${resource.toString()}`;
}
const SESSION_WORKSPACE_GROUP_LOCAL = localize("sessionWorkspaceGroup.local", "Local");
const SESSION_WORKSPACE_GROUP_REMOTE = localize("sessionWorkspaceGroup.remote", "Remote");
function getUntitledSessionTitle(isQuickChat) {
  return isQuickChat ? localize("agentSessions.newChat", "New Chat") : localize("agentSessions.newSession", "New Session");
}
function sessionFileChangesEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (x === y) {
      continue;
    }
    if (x.insertions !== y.insertions || x.deletions !== y.deletions) {
      return false;
    }
    const xIsIChatSessionFileChange2 = isIChatSessionFileChange2(x);
    const yIsIChatSessionFileChange2 = isIChatSessionFileChange2(y);
    if (xIsIChatSessionFileChange2 !== yIsIChatSessionFileChange2) {
      return false;
    }
    const xUri = xIsIChatSessionFileChange2 ? x.uri : x.modifiedUri;
    const yUri = yIsIChatSessionFileChange2 ? y.uri : y.modifiedUri;
    if (!isEqual(xUri, yUri)) {
      return false;
    }
    const xModified = xIsIChatSessionFileChange2 ? x.modifiedUri : void 0;
    const yModified = yIsIChatSessionFileChange2 ? y.modifiedUri : void 0;
    if (!isEqual(xModified, yModified)) {
      return false;
    }
    if (!isEqual(x.originalUri, y.originalUri)) {
      return false;
    }
    if (x.reviewed !== y.reviewed) {
      return false;
    }
  }
  return true;
}
function sessionTurnFileChangesEqual(a, b) {
  return sessionFileChangesEqual(a, b) && a.every((change, index) => change.isOutsideWorkspace === b[index].isOutsideWorkspace);
}
function gitHubInfoEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (a === void 0 || b === void 0) {
    return false;
  }
  const aIcon = a.pullRequest?.icon;
  const bIcon = b.pullRequest?.icon;
  return a.owner === b.owner && a.repo === b.repo && arrayEquals(a.pullRequests ?? [], b.pullRequests ?? [], (x, y) => x.owner === y.owner && x.repo === y.repo && x.number === y.number && isEqual(x.uri, y.uri) && (x.icon === y.icon || !!x.icon && !!y.icon && ThemeIcon.isEqual(x.icon, y.icon))) && a.pullRequest?.number === b.pullRequest?.number && isEqual(a.pullRequest?.uri, b.pullRequest?.uri) && (aIcon === bIcon || !!aIcon && !!bIcon && ThemeIcon.isEqual(aIcon, bIcon)) && a.pullRequest?.baseRefOid === b.pullRequest?.baseRefOid && a.pullRequest?.headRefOid === b.pullRequest?.headRefOid;
}
function sessionWorkspaceEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (!a || !b || !isEqual(a.uri, b.uri) || a.label !== b.label || a.description !== b.description || a.group !== b.group || !ThemeIcon.isEqual(a.icon, b.icon) || a.requiresWorkspaceTrust !== b.requiresWorkspaceTrust || a.isVirtualWorkspace !== b.isVirtualWorkspace || a.folders.length !== b.folders.length) {
    return false;
  }
  for (let i = 0; i < a.folders.length; i++) {
    if (!sessionFolderEqual(a.folders[i], b.folders[i])) {
      return false;
    }
  }
  return true;
}
function sessionFolderEqual(a, b) {
  return isEqual(a.root, b.root) && isEqual(a.workingDirectory, b.workingDirectory) && a.name === b.name && a.description === b.description && sessionGitRepositoryEqual(a.gitRepository, b.gitRepository);
}
function sessionGitRepositoryEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return isEqual(a.uri, b.uri) && isEqual(a.workTreeUri, b.workTreeUri) && a.branchName === b.branchName && a.baseBranchName === b.baseBranchName && a.baseBranchProtected === b.baseBranchProtected && a.hasGitHubRemote === b.hasGitHubRemote && a.upstreamBranchName === b.upstreamBranchName && a.incomingChanges === b.incomingChanges && a.outgoingChanges === b.outgoingChanges && a.uncommittedChanges === b.uncommittedChanges && a.hasGitOperationInProgress === b.hasGitOperationInProgress && gitHubInfoEqual(a.gitHubInfo.get(), b.gitHubInfo.get());
}
export {
  BRANCH_CHANGES_CHANGESET_ID,
  ChatInteractivity,
  ChatOriginKind,
  DEFAULT_CHAT_CAPABILITIES,
  GITHUB_REMOTE_FILE_SCHEME,
  SESSION_WORKSPACE_GROUP_LOCAL,
  SESSION_WORKSPACE_GROUP_REMOTE,
  SessionChangesetOperationScope,
  SessionChangesetOperationStatus,
  SessionFileOperation,
  SessionStatus,
  SessionTypeAuthRequirement,
  SessionWorkspaceKind,
  TURN_CHANGES_CHANGESET_ID,
  effectiveChatInteractivity,
  getChatCapabilities,
  getSessionWorkspaceKind,
  getUntitledSessionTitle,
  gitHubInfoEqual,
  isActiveSessionStatus,
  sessionFileChangesEqual,
  sessionFolderEqual,
  sessionGitRepositoryEqual,
  sessionHasChanges,
  sessionTurnFileChangesEqual,
  sessionWorkspaceEqual,
  toSessionId
};
