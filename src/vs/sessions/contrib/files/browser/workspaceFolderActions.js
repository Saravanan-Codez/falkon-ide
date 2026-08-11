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
import { $ } from "../../../../base/browser/dom.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { structuralEquals } from "../../../../base/common/equals.js";
import { Emitter } from "../../../../base/common/event.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { autorun, derivedOpts } from "../../../../base/common/observable.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { localize, localize2 } from "../../../../nls.js";
import { IActionViewItemService } from "../../../../platform/actions/browser/actionViewItemService.js";
import { Action2, MenuItemAction, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../workbench/common/contributions.js";
import { IViewsService } from "../../../../workbench/services/views/common/viewsService.js";
import { Menus } from "../../../browser/menus.js";
import { SessionHeaderMetaActionViewItem } from "../../../browser/parts/sessionHeaderMetaActionViewItem.js";
import { SessionHasWorkspaceContext, IsQuickChatSessionContext } from "../../../common/contextkeys.js";
import { ISessionContext } from "../../../services/sessions/browser/sessionContext.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { getSessionWorkspaceKind, SessionWorkspaceKind } from "../../../services/sessions/common/session.js";
import { SESSIONS_FILES_VIEW_ID } from "./filesView.js";
class OpenFilesViewAction extends Action2 {
  static {
    this.ID = "workbench.agentSessions.action.openFilesView";
  }
  constructor() {
    super({
      id: OpenFilesViewAction.ID,
      title: localize2("agentSessions.files", "Files"),
      icon: Codicon.folder,
      f1: false,
      // Workspace folder pill shown in the session header meta row
      // (vs/sessions/browser/parts/sessionHeader.ts), rendered with a custom
      // action view item. Ordered before the changes pill (order 0).
      menu: {
        id: Menus.SessionHeaderMeta,
        group: "navigation",
        order: -10,
        when: ContextKeyExpr.and(SessionHasWorkspaceContext, IsQuickChatSessionContext.negate())
      }
    });
  }
  async run(accessor, session) {
    const sessionsService = accessor.get(ISessionsService);
    const viewsService = accessor.get(IViewsService);
    const targetSession = session ?? sessionsService.activeSession.get();
    if (!targetSession) {
      return;
    }
    await viewsService.openView(SESSIONS_FILES_VIEW_ID, false);
  }
}
registerAction2(OpenFilesViewAction);
let OpenFilesViewActionViewItem = class extends SessionHeaderMetaActionViewItem {
  constructor(action, options, sessionContext) {
    super(void 0, action, options);
    this._workspaceObs = derivedOpts({ owner: this, equalsFn: structuralEquals }, (reader) => {
      const session = sessionContext.session.read(reader);
      const workspace = session?.workspace.read(reader);
      if (!workspace?.label) {
        return void 0;
      }
      const worktreePending = session?.worktreePending?.read(reader) ?? false;
      const kind = getSessionWorkspaceKind(workspace, worktreePending);
      const icon = kind === SessionWorkspaceKind.Virtual ? Codicon.cloudCompact : kind === SessionWorkspaceKind.Folder ? Codicon.folderCompact : Codicon.worktreeCompact;
      const folder = workspace.folders[0];
      const branch = worktreePending ? void 0 : folder?.gitRepository?.branchName?.trim() || void 0;
      const workingDirectoryPath = worktreePending ? void 0 : folder?.workingDirectory.fsPath;
      return { label: workspace.label, icon, workingDirectoryPath, branch, worktreePending };
    });
    this._register(autorun((reader) => {
      this._workspaceObs.read(reader);
      this.updateLabel();
      this.updateTooltip();
      this.updateAriaLabel();
    }));
  }
  render(container) {
    super.render(container);
    this.element?.classList.add("chat-composite-bar-meta-workspace-item");
    this.button?.element.classList.add("chat-composite-bar-meta-workspace-button");
  }
  getIconElement() {
    const icon = this._workspaceObs.get()?.icon ?? Codicon.folder;
    return $(`span.chat-composite-bar-meta-item-icon${ThemeIcon.asCSSSelector(icon)}`);
  }
  getLabelText() {
    return this._workspaceObs.get()?.label ?? "";
  }
  getTooltip() {
    return localize("agentSessions.openFilesView.tooltip", "Open Files");
  }
  getAriaLabel() {
    const workspace = this._workspaceObs.get();
    if (!workspace?.label) {
      return this.getTooltip();
    }
    return workspace.worktreePending ? localize("agentSessions.openFilesView.worktreePendingAriaLabel", "Open Files: {0}, creating worktree", workspace.label) : localize("agentSessions.openFilesView.ariaLabel", "Open Files: {0}", workspace.label);
  }
  getHoverContents() {
    const workspace = this._workspaceObs.get();
    if (workspace?.worktreePending) {
      const message = localize("agentSessions.openFilesView.worktreePending", "Creating worktree\u2026 Its folder and branch are shown once ready.");
      const md2 = new MarkdownString("", { supportThemeIcons: true });
      md2.appendMarkdown(`$(${Codicon.worktree.id}) `);
      md2.appendText(message);
      return { markdown: md2, markdownNotSupportedFallback: message };
    }
    if (!workspace?.workingDirectoryPath) {
      return this.getTooltip();
    }
    const md = new MarkdownString("", { supportThemeIcons: true });
    const fallbackLines = [];
    md.appendMarkdown(`$(${Codicon.folder.id}) `);
    md.appendText(workspace.workingDirectoryPath);
    fallbackLines.push(workspace.workingDirectoryPath);
    if (workspace.branch) {
      md.appendMarkdown(`

$(${Codicon.gitBranch.id}) `);
      md.appendText(workspace.branch);
      fallbackLines.push(workspace.branch);
    }
    return { markdown: md, markdownNotSupportedFallback: fallbackLines.join("\n") };
  }
};
OpenFilesViewActionViewItem = __decorateClass([
  __decorateParam(2, ISessionContext)
], OpenFilesViewActionViewItem);
let OpenFilesViewActionViewItemContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.openFilesViewActionViewItem";
  }
  constructor(actionViewItemService) {
    super();
    const onDidRegister = this._register(new Emitter());
    this._register(actionViewItemService.register(Menus.SessionHeaderMeta, OpenFilesViewAction.ID, (action, options, instantiationService) => {
      if (!(action instanceof MenuItemAction)) {
        return void 0;
      }
      return instantiationService.createInstance(OpenFilesViewActionViewItem, action, options);
    }, onDidRegister.event));
    onDidRegister.fire();
  }
};
OpenFilesViewActionViewItemContribution = __decorateClass([
  __decorateParam(0, IActionViewItemService)
], OpenFilesViewActionViewItemContribution);
registerWorkbenchContribution2(OpenFilesViewActionViewItemContribution.ID, OpenFilesViewActionViewItemContribution, WorkbenchPhase.AfterRestored);
export {
  OpenFilesViewActionViewItem
};
