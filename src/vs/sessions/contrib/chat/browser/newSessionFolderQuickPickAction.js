import { Codicon } from "../../../../base/common/codicons.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { localize, localize2 } from "../../../../nls.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IsSessionsWindowContext } from "../../../../workbench/common/contextkeys.js";
import { CHAT_CATEGORY } from "../../../../workbench/contrib/chat/browser/actions/chatActions.js";
import { ISessionsRecentWorkspacesService } from "../../../services/sessions/browser/sessionsRecentWorkspacesService.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
function buildFolderQuickPickItems(recentWorkspacesService, labelService) {
  const recents = recentWorkspacesService.getRecentWorkspaces();
  const items = [];
  if (recents.length > 0) {
    items.push({ type: "separator", label: localize("sessions.newSession.pickFolderQuickPick.recent", "Recent") });
    for (const { workspace, providerId } of recents) {
      const folderUri = workspace.folders[0]?.root;
      if (!folderUri) {
        continue;
      }
      items.push({
        folderUri,
        providerId,
        label: `$(${workspace.icon.id}) ${workspace.label}`,
        description: labelService.getUriLabel(folderUri, { relative: false })
      });
    }
    items.push({ type: "separator", label: "" });
  }
  items.push({
    label: `$(${Codicon.folderOpened.id}) ${localize("sessions.newSession.pickFolderQuickPick.browse", "Browse...")}`,
    browse: true
  });
  return items;
}
class NewSessionPickFolderQuickPickAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.sessions.newSession.pickFolderQuickPick",
      title: localize2("sessions.newSession.pickFolderQuickPick.label", "New Session in Folder..."),
      category: CHAT_CATEGORY,
      f1: true,
      keybinding: {
        // Wins over the desktop Open File/Folder actions' Cmd+O when both match.
        weight: KeybindingWeight.SessionsContrib,
        when: IsSessionsWindowContext,
        primary: KeyMod.CtrlCmd | KeyCode.KeyO
      }
    });
  }
  async run(accessor) {
    const quickInputService = accessor.get(IQuickInputService);
    const sessionsService = accessor.get(ISessionsService);
    const recentWorkspacesService = accessor.get(ISessionsRecentWorkspacesService);
    const labelService = accessor.get(ILabelService);
    const fileDialogService = accessor.get(IFileDialogService);
    const items = buildFolderQuickPickItems(recentWorkspacesService, labelService);
    const picked = await quickInputService.pick(items, {
      placeHolder: localize("sessions.newSession.pickFolderQuickPick.placeholder", "Select a folder to start a new session in"),
      matchOnDescription: true
    });
    if (!picked) {
      return;
    }
    let folderUri = picked.folderUri;
    let providerId = picked.providerId;
    if (picked.browse) {
      const result = await fileDialogService.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false
      });
      folderUri = result?.[0];
      providerId = void 0;
    }
    if (!folderUri) {
      return;
    }
    await sessionsService.openNewSession({ folderUri, providerId });
  }
}
registerAction2(NewSessionPickFolderQuickPickAction);
export {
  buildFolderQuickPickItems
};
