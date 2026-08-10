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
import { toAction } from "../../../../base/common/actions.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { autorun } from "../../../../base/common/observable.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { localize, localize2 } from "../../../../nls.js";
import { Action2, MenuId, MenuRegistry, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../workbench/common/contributions.js";
import { IsSessionsWindowContext } from "../../../../workbench/common/contextkeys.js";
import { CHAT_CATEGORY } from "../../../../workbench/contrib/chat/browser/actions/chatActions.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { URI } from "../../../../base/common/uri.js";
import { SessionIsArchivedContext } from "../../../common/contextkeys.js";
const hasWorktreeAndRepositoryContextKey = new RawContextKey("agentSessionHasWorktreeAndRepository", false, {
  type: "boolean",
  description: localize("agentSessionHasWorktreeAndRepository", "True when the active agent session has both a worktree and a parent repository.")
});
let ApplyChangesToParentRepoContribution = class extends Disposable {
  static {
    this.ID = "sessions.contrib.applyChangesToParentRepo";
  }
  constructor(contextKeyService, sessionsService) {
    super();
    const worktreeAndRepoKey = hasWorktreeAndRepositoryContextKey.bindTo(contextKeyService);
    this._register(autorun((reader) => {
      const activeSession = sessionsService.activeSession.read(reader);
      const folder = activeSession?.workspace.read(reader)?.folders[0];
      const hasWorktreeAndRepo = !!folder?.gitRepository?.workTreeUri;
      worktreeAndRepoKey.set(hasWorktreeAndRepo);
    }));
  }
};
ApplyChangesToParentRepoContribution = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, ISessionsService)
], ApplyChangesToParentRepoContribution);
class ApplyChangesToParentRepoAction extends Action2 {
  static {
    this.ID = "chatEditing.applyChangesToParentRepo";
  }
  constructor() {
    super({
      id: ApplyChangesToParentRepoAction.ID,
      title: localize2("applyChangesToParentRepo", "Apply Changes to Parent Repository"),
      icon: Codicon.desktopDownload,
      category: CHAT_CATEGORY,
      precondition: ContextKeyExpr.and(
        IsSessionsWindowContext,
        hasWorktreeAndRepositoryContextKey
      ),
      menu: [
        {
          id: MenuId.AgentsChangesPrimaryActionSubMenu,
          group: "navigation",
          order: 2,
          when: ContextKeyExpr.and(
            ContextKeyExpr.false(),
            IsSessionsWindowContext,
            hasWorktreeAndRepositoryContextKey
          )
        }
      ]
    });
  }
  async run(accessor) {
    const sessionsService = accessor.get(ISessionsService);
    const commandService = accessor.get(ICommandService);
    const notificationService = accessor.get(INotificationService);
    const logService = accessor.get(ILogService);
    const openerService = accessor.get(IOpenerService);
    const productService = accessor.get(IProductService);
    const activeSession = sessionsService.activeSession.get();
    const folder = activeSession?.workspace.get()?.folders[0];
    if (!activeSession || !folder?.gitRepository?.workTreeUri) {
      return;
    }
    const worktreeRoot = folder.gitRepository.workTreeUri;
    const repoRoot = folder.root;
    const openFolderAction = toAction({
      id: "applyChangesToParentRepo.openFolder",
      label: localize("openInVSCode", "Open in VS Code"),
      run: () => {
        const scheme = productService.quality === "stable" ? "vscode" : productService.quality === "exploration" ? "vscode-exploration" : "vscode-insiders";
        const params = new URLSearchParams();
        params.set("windowId", "_blank");
        params.set("session", activeSession.resource.toString());
        openerService.open(URI.from({
          scheme,
          authority: Schemas.file,
          path: repoRoot.path,
          query: params.toString()
        }), { openExternal: true });
      }
    });
    try {
      const worktreeBranch = await commandService.executeCommand(
        "_git.revParseAbbrevRef",
        worktreeRoot.fsPath
      );
      if (!worktreeBranch) {
        notificationService.notify({
          severity: Severity.Warning,
          message: localize("applyChangesNoBranch", "Could not determine worktree branch name.")
        });
        return;
      }
      const result = await commandService.executeCommand("_git.mergeBranch", repoRoot.fsPath, worktreeBranch);
      if (!result) {
        logService.warn("[ApplyChangesToParentRepo] No result from merge command");
      } else {
        notificationService.notify({
          severity: Severity.Info,
          message: typeof result === "string" && result.startsWith("Already up to date") ? localize("alreadyUpToDate", "Parent repository is up to date with worktree.") : localize("applyChangesSuccess", "Applied changes to parent repository."),
          actions: { primary: [openFolderAction] }
        });
      }
    } catch (err) {
      logService.error("[ApplyChangesToParentRepo] Failed to apply changes", err);
      notificationService.notify({
        severity: Severity.Warning,
        message: localize("applyChangesConflict", "Failed to apply changes to parent repo. The parent repo may have diverged \u2014 resolve conflicts manually."),
        actions: { primary: [openFolderAction] }
      });
    }
  }
}
registerAction2(ApplyChangesToParentRepoAction);
registerWorkbenchContribution2(ApplyChangesToParentRepoContribution.ID, ApplyChangesToParentRepoContribution, WorkbenchPhase.AfterRestored);
MenuRegistry.appendMenuItem(MenuId.AgentsChangesToolbar, {
  submenu: MenuId.AgentsChangesPrimaryActionSubMenu,
  title: localize2("applyActions", "Apply Actions"),
  group: "navigation",
  order: 1,
  when: ContextKeyExpr.and(
    IsSessionsWindowContext,
    SessionIsArchivedContext.isEqualTo(false)
  )
});
