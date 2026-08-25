import "./emptyFileEditor.contribution.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { localize2 } from "../../../../nls.js";
import { Action2 } from "../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IBrowserViewWorkbenchService } from "../../../../workbench/contrib/browserView/common/browserView.js";
import { openNewSearchEditor } from "../../../../workbench/contrib/searchEditor/browser/searchEditorActions.js";
import { IEditorGroupsService } from "../../../../workbench/services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../../../workbench/services/editor/common/editorService.js";
import { EditorTabsVisibleContext, IsAuxiliaryWindowContext, IsSessionsWindowContext, IsTopRightEditorGroupContext, MainEditorAreaVisibleContext } from "../../../../workbench/common/contextkeys.js";
import { SinglePaneChangesTabAvailableContext, SinglePaneChangesTabMissingContext, SinglePaneFilesTabAvailableContext, SinglePaneFilesTabMissingContext } from "../../../common/contextkeys.js";
import { SessionsCategories } from "../../../common/categories.js";
import { ISessionChangesService } from "../../changes/browser/sessionChangesService.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { EmptyFileEditorInput } from "./emptyFileEditorInput.js";
import { Menus } from "../../../browser/menus.js";
const NEW_FILE_TAB_COMMAND_ID = "workbench.action.agentSessions.newFileTab";
const NEW_BROWSER_TAB_COMMAND_ID = "workbench.action.agentSessions.newBrowserTab";
const NEW_SEARCH_TAB_COMMAND_ID = "workbench.action.agentSessions.newSearchTab";
const NEW_CHANGES_TAB_COMMAND_ID = "workbench.action.agentSessions.newChangesTab";
const addTabActionWhen = ContextKeyExpr.and(
  IsSessionsWindowContext,
  IsAuxiliaryWindowContext.toNegated()
);
const addTabLayoutWhen = ContextKeyExpr.and(
  addTabActionWhen,
  IsTopRightEditorGroupContext,
  MainEditorAreaVisibleContext
);
const singleEditorTitleWhen = EditorTabsVisibleContext.negate();
class NewFileTabAction extends Action2 {
  constructor() {
    super({
      id: NEW_FILE_TAB_COMMAND_ID,
      title: localize2("newFileTab", "Files"),
      category: SessionsCategories.Sessions,
      icon: Codicon.newFile,
      f1: true,
      precondition: addTabActionWhen,
      keybinding: {
        weight: KeybindingWeight.SessionsContrib,
        when: addTabActionWhen,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyE
      },
      menu: {
        id: Menus.SessionsEditorTabsBarAddTab,
        group: "navigation",
        order: 1,
        // Only offer when the Files tab is not already shown.
        when: ContextKeyExpr.and(
          addTabLayoutWhen,
          SinglePaneFilesTabAvailableContext,
          ContextKeyExpr.or(singleEditorTitleWhen, SinglePaneFilesTabMissingContext)
        )
      }
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const editorGroupsService = accessor.get(IEditorGroupsService);
    const instantiationService = accessor.get(IInstantiationService);
    const sessionsService = accessor.get(ISessionsService);
    const group = editorGroupsService.mainPart.activeGroup;
    const workspace = sessionsService.activeSession.get()?.workspace.get();
    await editorService.openEditor(instantiationService.createInstance(EmptyFileEditorInput, workspace), { pinned: true, index: group.count }, group);
  }
}
class NewBrowserTabAction extends Action2 {
  constructor() {
    super({
      id: NEW_BROWSER_TAB_COMMAND_ID,
      title: localize2("newBrowserTab", "Browser"),
      category: SessionsCategories.Sessions,
      icon: Codicon.globe,
      f1: true,
      precondition: addTabActionWhen,
      keybinding: {
        weight: KeybindingWeight.SessionsContrib,
        when: addTabActionWhen,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyB
      },
      menu: {
        id: Menus.SessionsEditorTabsBarAddTab,
        group: "navigation",
        order: 2,
        when: addTabLayoutWhen
      }
    });
  }
  async run(accessor) {
    const browserViewWorkbenchService = accessor.get(IBrowserViewWorkbenchService);
    const editorService = accessor.get(IEditorService);
    const browserInput = browserViewWorkbenchService.getOrCreateLazy(generateUuid(), {});
    await editorService.openEditor(browserInput);
  }
}
class NewSearchTabAction extends Action2 {
  constructor() {
    super({
      id: NEW_SEARCH_TAB_COMMAND_ID,
      title: localize2("newSearchTab", "Search"),
      category: SessionsCategories.Sessions,
      icon: Codicon.search,
      f1: true,
      precondition: addTabActionWhen,
      keybinding: {
        weight: KeybindingWeight.SessionsContrib,
        when: addTabActionWhen,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyF
      },
      menu: {
        id: Menus.SessionsEditorTabsBarAddTab,
        group: "navigation",
        order: 3,
        when: addTabLayoutWhen
      }
    });
  }
  async run(accessor) {
    const instantiationService = accessor.get(IInstantiationService);
    await instantiationService.invokeFunction(openNewSearchEditor, { location: "new" });
  }
}
class NewChangesTabAction extends Action2 {
  constructor() {
    super({
      id: NEW_CHANGES_TAB_COMMAND_ID,
      title: localize2("newChangesTab", "Changes"),
      category: SessionsCategories.Sessions,
      icon: Codicon.gitCompare,
      f1: false,
      precondition: addTabActionWhen,
      keybinding: {
        weight: KeybindingWeight.SessionsContrib,
        when: addTabActionWhen,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyG,
        mac: { primary: KeyMod.WinCtrl | KeyMod.Shift | KeyCode.KeyG }
      },
      menu: {
        id: Menus.SessionsEditorTabsBarAddTab,
        group: "navigation",
        order: 0,
        // Only offer when the session has a Changes editor but its tab is closed.
        when: ContextKeyExpr.and(
          addTabLayoutWhen,
          SinglePaneChangesTabAvailableContext,
          ContextKeyExpr.or(singleEditorTitleWhen, SinglePaneChangesTabMissingContext)
        )
      }
    });
  }
  async run(accessor) {
    const editorGroupsService = accessor.get(IEditorGroupsService);
    const sessionsService = accessor.get(ISessionsService);
    const sessionChangesService = accessor.get(ISessionChangesService);
    const sessionResource = sessionsService.activeSession.get()?.resource;
    if (sessionResource) {
      const group = editorGroupsService.mainPart.activeGroup;
      await sessionChangesService.openChangesEditor(sessionResource, { index: group.count }, group);
    }
  }
}
export {
  NEW_BROWSER_TAB_COMMAND_ID,
  NEW_CHANGES_TAB_COMMAND_ID,
  NEW_FILE_TAB_COMMAND_ID,
  NEW_SEARCH_TAB_COMMAND_ID,
  NewBrowserTabAction,
  NewChangesTabAction,
  NewFileTabAction,
  NewSearchTabAction
};
