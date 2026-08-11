import { Codicon } from "../../../../base/common/codicons.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { localize } from "../../../../nls.js";
import { asCssVariable } from "../../../../platform/theme/common/colorUtils.js";
import { chatLinesAddedForeground, chatLinesRemovedForeground } from "../../../../workbench/contrib/chat/common/widget/chatColors.js";
import { getSessionWorkspaceKind, getUntitledSessionTitle, SessionWorkspaceKind } from "../../../services/sessions/common/session.js";
function getSessionDiffStats(session) {
  const changes = session.changes.get();
  if (changes.length === 0) {
    return void 0;
  }
  let insertions = 0;
  let deletions = 0;
  for (const change of changes) {
    insertions += change.insertions;
    deletions += change.deletions;
  }
  if (insertions === 0 && deletions === 0) {
    return void 0;
  }
  return { files: changes.length, insertions, deletions };
}
function buildSessionHoverContent(session, sessionsProvidersService) {
  const md = new MarkdownString("", { supportThemeIcons: true, supportHtml: true });
  const title = session.title.get() || getUntitledSessionTitle(session.isQuickChat?.get() ?? false);
  if (session.icon) {
    md.appendMarkdown(`$(${session.icon.id}) `);
  }
  md.appendMarkdown(`**`);
  md.appendText(title);
  md.appendMarkdown(`**`);
  md.appendText("\n");
  const workspace = session.workspace.get();
  const folder = workspace?.folders[0];
  const worktreePending = session.worktreePending?.get() ?? false;
  const branch = worktreePending ? void 0 : folder?.gitRepository?.branchName?.trim();
  let appendedDetails = false;
  if (folder && workspace) {
    const kind = getSessionWorkspaceKind(workspace, worktreePending);
    const folderIcon = kind === SessionWorkspaceKind.Virtual ? Codicon.cloud : kind === SessionWorkspaceKind.Folder ? Codicon.folder : Codicon.worktree;
    md.appendMarkdown(`$(${folderIcon.id}) `);
    md.appendText(worktreePending ? localize("agentSessions.worktreePending", "Creating worktree\u2026") : folder.root.fsPath);
    appendedDetails = true;
  }
  if (branch) {
    if (appendedDetails) {
      md.appendMarkdown(" \xB7 ");
    }
    md.appendMarkdown("$(git-branch) ");
    md.appendText(branch);
    appendedDetails = true;
  }
  if (appendedDetails) {
    md.appendText("\n");
  }
  const diffStats = worktreePending ? void 0 : getSessionDiffStats(session);
  if (diffStats) {
    const fileText = diffStats.files === 1 ? localize("agentSessions.fileChanged", "1 file changed") : localize("agentSessions.filesChanged", "{0} files changed", diffStats.files);
    md.appendMarkdown(`${fileText} \xB7 <span style="color:${asCssVariable(chatLinesAddedForeground)};">+${diffStats.insertions}</span> <span style="color:${asCssVariable(chatLinesRemovedForeground)};">-${diffStats.deletions}</span>`);
    md.appendText("\n");
  }
  const provider = sessionsProvidersService.getProvider(session.providerId);
  if (provider) {
    md.appendText(provider.label);
  }
  return md;
}
export {
  buildSessionHoverContent,
  getSessionDiffStats
};
