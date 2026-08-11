import { RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
const CHANGES_VIEW_ID = "workbench.view.agentSessions.changes";
const CHANGES_VIEW_CONTAINER_ID = "workbench.view.agentSessions.changesContainer";
const VIEW_SESSION_CHANGES_COMMAND_ID = "workbench.agentSessions.action.viewChanges";
const SESSIONS_CHANGES_OPEN_SINGLE_FILE_DIFF_SETTING = "sessions.changes.openSingleFileDiff";
var ChangesViewMode = /* @__PURE__ */ ((ChangesViewMode2) => {
  ChangesViewMode2["List"] = "list";
  ChangesViewMode2["Tree"] = "tree";
  return ChangesViewMode2;
})(ChangesViewMode || {});
var IsolationMode = /* @__PURE__ */ ((IsolationMode2) => {
  IsolationMode2["Workspace"] = "workspace";
  IsolationMode2["Worktree"] = "worktree";
  return IsolationMode2;
})(IsolationMode || {});
const ChangesContextKeys = {
  ChangeKind: new RawContextKey("sessions.changeKind", "file"),
  VersionMode: new RawContextKey("sessions.changesVersionMode", ""),
  ViewMode: new RawContextKey("sessions.changesViewMode", "list" /* List */)
};
const ActiveSessionContextKeys = {
  IsolationMode: new RawContextKey("sessions.isolationMode", "workspace" /* Workspace */),
  HasChanges: new RawContextKey("sessions.hasChanges", false),
  HasGitRepository: new RawContextKey("sessions.hasGitRepository", true),
  HasUpstream: new RawContextKey("sessions.hasUpstream", false),
  HasIncomingChanges: new RawContextKey("sessions.hasIncomingChanges", false),
  HasOutgoingChanges: new RawContextKey("sessions.hasOutgoingChanges", false),
  HasUncommittedChanges: new RawContextKey("sessions.hasUncommittedChanges", true),
  HasBranchChanges: new RawContextKey("sessions.hasBranchChanges", false),
  IsMergeBaseBranchProtected: new RawContextKey("sessions.isMergeBaseBranchProtected", false),
  HasGitHubRemote: new RawContextKey("sessions.hasGitHubRemote", false),
  HasPullRequest: new RawContextKey("sessions.hasPullRequest", false),
  HasGitOperationInProgress: new RawContextKey("sessions.hasGitOperationInProgress", false),
  HasOpenPullRequest: new RawContextKey("sessions.hasOpenPullRequest", false)
};
export {
  ActiveSessionContextKeys,
  CHANGES_VIEW_CONTAINER_ID,
  CHANGES_VIEW_ID,
  ChangesContextKeys,
  ChangesViewMode,
  IsolationMode,
  SESSIONS_CHANGES_OPEN_SINGLE_FILE_DIFF_SETTING,
  VIEW_SESSION_CHANGES_COMMAND_ID
};
