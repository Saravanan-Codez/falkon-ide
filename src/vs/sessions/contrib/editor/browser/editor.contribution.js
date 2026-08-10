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
import "../../../../workbench/contrib/styleOverrides/browser/media/tabs.css";
import "./media/editorBreadcrumbs.css";
import "./media/editorHeader.css";
import "./diffEditor.sessions.contribution.js";
import { NewBrowserTabAction, NewChangesTabAction, NewFileTabAction, NewSearchTabAction } from "./addTabActions.js";
import { localize2 } from "../../../../nls.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { Action2, isIMenuItem, MenuId, MenuRegistry, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ActiveEditorContext, EditorPartModalContext, IsAuxiliaryWindowContext, IsSessionsWindowContext, IsTopRightEditorGroupContext, MainEditorAreaVisibleContext } from "../../../../workbench/common/contextkeys.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../workbench/common/contributions.js";
import { Menus } from "../../../browser/menus.js";
import { IAgentWorkbenchLayoutService } from "../../../browser/workbench.js";
import { CustomViewVisibleContext, EditorMaximizedContext, SinglePaneLayoutEnabledContext } from "../../../common/contextkeys.js";
import { IViewsService } from "../../../../workbench/services/views/common/viewsService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IEditorGroupsService } from "../../../../workbench/services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../../../workbench/services/editor/common/editorService.js";
import { IListService } from "../../../../platform/list/browser/listService.js";
import { EditorResourceAccessor, SideBySideEditor } from "../../../../workbench/common/editor.js";
import { resolveCommandsContext } from "../../../../workbench/browser/parts/editor/editorCommandsContext.js";
import { MultiDiffEditorInput } from "../../../../workbench/contrib/multiDiffEditor/browser/multiDiffEditorInput.js";
import { CHANGES_VIEW_ID } from "../../changes/common/changes.js";
import { prepareMoveCopyEditors } from "../../../../workbench/browser/parts/editor/editor.js";
import { Parts } from "../../../../workbench/services/layout/browser/layoutService.js";
import { MOVE_MODAL_EDITOR_TO_MAIN_COMMAND_ID } from "../../../../workbench/browser/parts/editor/editorCommands.js";
import { TERMINAL_VIEW_ID } from "../../../../workbench/contrib/terminal/common/terminal.js";
import { TEXT_FILE_EDITOR_ID } from "../../../../workbench/contrib/files/common/files.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { ISessionsPartService } from "../../../services/sessions/browser/sessionsPartService.js";
import { SessionsCategories } from "../../../common/categories.js";
import { IChangesViewService } from "../../changes/common/changesViewService.js";
const terminalPanelHiddenForMaximizedEditor = /* @__PURE__ */ new WeakSet();
const singlePaneDetailPanel = SinglePaneLayoutEnabledContext;
const notSinglePaneDetailPanel = singlePaneDetailPanel.negate();
const editorTitleActionsWhen = ContextKeyExpr.and(
  IsSessionsWindowContext,
  IsAuxiliaryWindowContext.toNegated(),
  IsTopRightEditorGroupContext
);
const singlePaneLayoutMaximizeOrder = 10;
const singlePaneLayoutHideEditorOrder = 20;
const singlePaneMaximizeKeybindingWhen = ContextKeyExpr.and(
  IsSessionsWindowContext,
  IsAuxiliaryWindowContext.toNegated(),
  singlePaneDetailPanel,
  MainEditorAreaVisibleContext
);
let SinglePaneAddTabContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.sessions.singlePaneAddTab";
  }
  constructor(layoutService) {
    super();
    if (!layoutService.isSinglePaneLayoutEnabled) {
      return;
    }
    this._register(registerAction2(NewFileTabAction));
    this._register(registerAction2(NewBrowserTabAction));
    this._register(registerAction2(NewSearchTabAction));
    this._register(registerAction2(NewChangesTabAction));
  }
};
SinglePaneAddTabContribution = __decorateClass([
  __decorateParam(0, IAgentWorkbenchLayoutService)
], SinglePaneAddTabContribution);
registerWorkbenchContribution2(SinglePaneAddTabContribution.ID, SinglePaneAddTabContribution, WorkbenchPhase.BlockStartup);
class MaximizeMainEditorPartAction extends Action2 {
  static {
    this.ID = "workbench.action.agentSessions.maximizeMainEditorPart";
  }
  constructor() {
    super({
      id: MaximizeMainEditorPartAction.ID,
      title: localize2("maximizeMainEditorPart", "Maximize Editor Area"),
      icon: Codicon.screenFull,
      f1: false,
      keybinding: {
        weight: KeybindingWeight.SessionsContrib,
        primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyE,
        when: ContextKeyExpr.and(singlePaneMaximizeKeybindingWhen, EditorMaximizedContext.negate())
      },
      menu: [
        {
          id: MenuId.EditorTitleLayout,
          group: "navigation",
          order: singlePaneLayoutMaximizeOrder,
          when: ContextKeyExpr.and(editorTitleActionsWhen, EditorMaximizedContext.negate(), singlePaneDetailPanel, MainEditorAreaVisibleContext)
        },
        {
          id: MenuId.EditorTitleLayout,
          group: "navigation",
          order: 99,
          when: ContextKeyExpr.and(editorTitleActionsWhen, EditorMaximizedContext.negate(), notSinglePaneDetailPanel)
        }
      ]
    });
  }
  async run(accessor) {
    const layoutService = accessor.get(IAgentWorkbenchLayoutService);
    const viewsService = accessor.get(IViewsService);
    let hidTerminalPanel = false;
    if (layoutService.isVisible(Parts.PANEL_PART) && viewsService.isViewVisible(TERMINAL_VIEW_ID)) {
      layoutService.setPartHidden(true, Parts.PANEL_PART);
      hidTerminalPanel = true;
    }
    if (hidTerminalPanel) {
      terminalPanelHiddenForMaximizedEditor.add(layoutService);
    } else {
      terminalPanelHiddenForMaximizedEditor.delete(layoutService);
    }
    layoutService.setEditorMaximized(true);
  }
}
registerAction2(MaximizeMainEditorPartAction);
class RestoreMainEditorPartAction extends Action2 {
  static {
    this.ID = "workbench.action.agentSessions.restoreMainEditorPart";
  }
  constructor() {
    super({
      id: RestoreMainEditorPartAction.ID,
      title: localize2("restoreMainEditorPart", "Restore Editor Area"),
      icon: Codicon.screenNormal,
      f1: false,
      toggled: EditorMaximizedContext,
      keybinding: {
        weight: KeybindingWeight.SessionsContrib,
        primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyE,
        when: ContextKeyExpr.and(singlePaneMaximizeKeybindingWhen, EditorMaximizedContext)
      },
      menu: [
        {
          id: MenuId.EditorTitleLayout,
          group: "navigation",
          order: singlePaneLayoutMaximizeOrder,
          when: ContextKeyExpr.and(editorTitleActionsWhen, EditorMaximizedContext, singlePaneDetailPanel, MainEditorAreaVisibleContext)
        },
        {
          id: MenuId.EditorTitleLayout,
          group: "navigation",
          order: 99,
          when: ContextKeyExpr.and(editorTitleActionsWhen, EditorMaximizedContext, notSinglePaneDetailPanel)
        }
      ]
    });
  }
  async run(accessor) {
    const layoutService = accessor.get(IAgentWorkbenchLayoutService);
    const shouldRestoreTerminalPanel = terminalPanelHiddenForMaximizedEditor.has(layoutService);
    layoutService.setEditorMaximized(false);
    if (shouldRestoreTerminalPanel && !layoutService.isVisible(Parts.PANEL_PART)) {
      layoutService.setPartHidden(false, Parts.PANEL_PART);
    }
    terminalPanelHiddenForMaximizedEditor.delete(layoutService);
  }
}
registerAction2(RestoreMainEditorPartAction);
class HideMainEditorPartAction extends Action2 {
  static {
    this.ID = "workbench.action.agentSessions.hideMainEditorPart";
  }
  constructor() {
    super({
      id: HideMainEditorPartAction.ID,
      title: localize2("hideMainEditorPart", "Hide Editor"),
      icon: Codicon.rightPanelHide,
      f1: false,
      menu: {
        id: MenuId.EditorTitleLayout,
        group: "navigation",
        order: singlePaneLayoutHideEditorOrder,
        when: ContextKeyExpr.and(
          editorTitleActionsWhen,
          singlePaneDetailPanel,
          MainEditorAreaVisibleContext
        )
      }
    });
  }
  run(accessor) {
    const layoutService = accessor.get(IAgentWorkbenchLayoutService);
    layoutService.setPartHidden(false, Parts.AUXILIARYBAR_PART);
    layoutService.setPartHidden(true, Parts.EDITOR_PART);
    layoutService.setPartHidden(false, Parts.SIDEBAR_PART);
  }
}
registerAction2(HideMainEditorPartAction);
class ShowMainEditorPartAction extends Action2 {
  static {
    this.ID = "workbench.action.agentSessions.showMainEditorPart";
  }
  constructor() {
    super({
      id: ShowMainEditorPartAction.ID,
      title: localize2("showMainEditorPart", "Show Editor"),
      icon: Codicon.rightPanelShow,
      f1: false,
      menu: {
        id: MenuId.EditorTitleLayout,
        group: "navigation",
        order: singlePaneLayoutHideEditorOrder,
        when: ContextKeyExpr.and(
          editorTitleActionsWhen,
          singlePaneDetailPanel,
          MainEditorAreaVisibleContext.toNegated()
        )
      }
    });
  }
  run(accessor) {
    const layoutService = accessor.get(IAgentWorkbenchLayoutService);
    const editorGroupsService = accessor.get(IEditorGroupsService);
    layoutService.revealEditorPartExplicitly();
    editorGroupsService.activeGroup.focus();
  }
}
registerAction2(ShowMainEditorPartAction);
class CloseMainEditorPartAction extends Action2 {
  static {
    this.ID = "workbench.action.agentSessions.closeMainEditorPart";
  }
  constructor() {
    super({
      id: CloseMainEditorPartAction.ID,
      title: localize2("closeMainEditorPart", "Close Editor Area"),
      icon: Codicon.close,
      f1: false,
      menu: {
        id: MenuId.EditorTitleLayout,
        group: "navigation",
        order: 100,
        when: ContextKeyExpr.and(
          IsSessionsWindowContext,
          IsAuxiliaryWindowContext.toNegated(),
          IsTopRightEditorGroupContext,
          notSinglePaneDetailPanel
        )
      }
    });
  }
  async run(accessor) {
    const commandService = accessor.get(ICommandService);
    await commandService.executeCommand("workbench.action.closeAllGroups");
  }
}
registerAction2(CloseMainEditorPartAction);
class OpenEditorInModalEditorAction extends Action2 {
  static {
    this.ID = "workbench.action.agentSessions.openEditorInModal";
  }
  constructor() {
    super({
      id: OpenEditorInModalEditorAction.ID,
      title: localize2("openEditorInModal", "Open in Modal Editor"),
      icon: Codicon.openInWindow,
      f1: false,
      menu: {
        id: MenuId.EditorTitleLayout,
        group: "navigation",
        order: 1,
        when: ContextKeyExpr.and(
          IsSessionsWindowContext,
          IsAuxiliaryWindowContext.toNegated(),
          notSinglePaneDetailPanel
        )
      }
    });
  }
  async run(accessor) {
    const viewsService = accessor.get(IViewsService);
    const layoutService = accessor.get(IAgentWorkbenchLayoutService);
    const configurationService = accessor.get(IConfigurationService);
    const editorGroupsService = accessor.get(IEditorGroupsService);
    const isMaximized = layoutService.isEditorMaximized();
    await configurationService.updateValue("workbench.editor.useModal", "all");
    const activeGroup = editorGroupsService.mainPart.activeGroup;
    const multiFileDiffEditor = activeGroup.editors.find((editor) => editor instanceof MultiDiffEditorInput);
    if (multiFileDiffEditor) {
      const view = viewsService.getViewWithId(CHANGES_VIEW_ID);
      await view?.openChanges();
      await activeGroup.closeEditor(multiFileDiffEditor);
    }
    const modalPart = await editorGroupsService.createModalEditorPart();
    const editorsToMove = prepareMoveCopyEditors(activeGroup, activeGroup.editors.slice(), true);
    activeGroup.moveEditors(editorsToMove, modalPart.activeGroup);
    if (isMaximized && !modalPart.maximized) {
      modalPart.toggleMaximized();
    }
    modalPart.activeGroup.focus();
  }
}
registerAction2(OpenEditorInModalEditorAction);
class OpenModalEditorInEditorAction extends Action2 {
  static {
    this.ID = "workbench.action.agentSessions.openModalEditorInEditor";
  }
  constructor() {
    super({
      id: OpenModalEditorInEditorAction.ID,
      title: localize2("openModalEditorInEditor", "Open in Editor Area"),
      icon: Codicon.openInWindow,
      f1: false,
      // The editor area is not rendered while a custom view replaces the sessions grid.
      precondition: CustomViewVisibleContext.negate(),
      menu: {
        id: MenuId.ModalEditorTitle,
        group: "navigation",
        order: 98,
        when: ContextKeyExpr.and(
          IsSessionsWindowContext,
          EditorPartModalContext
        )
      }
    });
  }
  async run(accessor) {
    const viewsService = accessor.get(IViewsService);
    const commandService = accessor.get(ICommandService);
    const configurationService = accessor.get(IConfigurationService);
    const editorGroupsService = accessor.get(IEditorGroupsService);
    const layoutService = accessor.get(IAgentWorkbenchLayoutService);
    const changesViewService = accessor.get(IChangesViewService);
    const activeEditorPart = editorGroupsService.activeModalEditorPart;
    const activeGroup = activeEditorPart?.activeGroup;
    if (!activeEditorPart || !activeGroup) {
      return;
    }
    const isMaximized = activeEditorPart.maximized;
    await configurationService.updateValue("workbench.editor.useModal", "some");
    layoutService.setPartHidden(false, Parts.EDITOR_PART);
    const navigation = activeGroup.activeEditorPane?.options?.modal?.navigation;
    if (navigation) {
      const view = viewsService.getViewWithId(CHANGES_VIEW_ID);
      const changes = changesViewService.activeSessionChangesObs.get();
      if (changes && navigation.current < changes.length) {
        await view?.openChanges(changes[navigation.current].modifiedUri ?? changes[navigation.current].originalUri);
        await activeGroup.closeEditor(activeGroup.editors[0]);
      }
    }
    await commandService.executeCommand(MOVE_MODAL_EDITOR_TO_MAIN_COMMAND_ID);
    if (isMaximized) {
      layoutService.setEditorMaximized(true);
    }
    editorGroupsService.activeGroup.focus();
  }
}
registerAction2(OpenModalEditorInEditorAction);
class AddFileAsContextAction extends Action2 {
  static {
    this.ID = "workbench.action.agentSessions.addFileAsContext";
  }
  constructor() {
    const precondition = ContextKeyExpr.and(
      IsSessionsWindowContext,
      IsAuxiliaryWindowContext.toNegated(),
      ActiveEditorContext.isEqualTo(TEXT_FILE_EDITOR_ID)
    );
    super({
      id: AddFileAsContextAction.ID,
      title: localize2("addFileAsContext", "Add File as Context"),
      category: SessionsCategories.Sessions,
      icon: Codicon.attach,
      f1: true,
      precondition,
      menu: [{
        id: Menus.SessionsEditorHeaderSecondary,
        group: "navigation",
        order: 1e5,
        when: ContextKeyExpr.and(precondition, singlePaneDetailPanel)
      }, {
        id: MenuId.EditorTitle,
        group: "navigation",
        order: 1e5,
        // towards the far right, mirroring Split Editor Right in the regular window
        when: ContextKeyExpr.and(precondition, notSinglePaneDetailPanel)
      }]
    });
  }
  run(accessor, ...args) {
    const editorService = accessor.get(IEditorService);
    const sessionsService = accessor.get(ISessionsService);
    const sessionsPartService = accessor.get(ISessionsPartService);
    const resolvedContext = resolveCommandsContext(args, editorService, accessor.get(IEditorGroupsService), accessor.get(IListService));
    const resources = resolvedContext.groupedEditors.flatMap((groupedEditor) => groupedEditor.editors).map((editor) => EditorResourceAccessor.getCanonicalUri(editor, { supportSideBySide: SideBySideEditor.PRIMARY })).filter((uri) => uri !== void 0 && [Schemas.file, Schemas.vscodeRemote, Schemas.untitled].includes(uri.scheme));
    if (resources.length === 0) {
      return;
    }
    const sessionId = sessionsService.activeSession.get()?.sessionId;
    sessionsPartService.getSessionView(sessionId)?.attach(resources);
  }
}
registerAction2(AddFileAsContextAction);
let EditorTitleMenuBridgeContribution = class extends Disposable {
  constructor(layoutService) {
    super();
    this._mirrored = this._register(new DisposableStore());
    if (!layoutService.isSinglePaneLayoutEnabled) {
      return;
    }
    this._sync();
    this._register(MenuRegistry.onDidChangeMenu((e) => {
      if (e.has(MenuId.EditorTitle)) {
        this._sync();
      }
    }));
  }
  static {
    this.ID = "workbench.contrib.sessions.editorTitleMenuBridge";
  }
  static {
    // Extension submenus are registered with a `MenuId.for('api:<id>')` id (see the
    // `submenus` extension point), which distinguishes them from core submenus.
    this._extensionSubmenuPrefix = "api:";
  }
  _sync() {
    this._mirrored.clear();
    for (const item of MenuRegistry.getMenuItems(MenuId.EditorTitle)) {
      const isExtensionItem = isIMenuItem(item) ? !!item.command.source : item.submenu.id.startsWith(EditorTitleMenuBridgeContribution._extensionSubmenuPrefix);
      if (isExtensionItem) {
        const group = item.group === "navigation" ? "extension/navigation" : `secondary/extension/${item.group ?? "other"}`;
        this._mirrored.add(MenuRegistry.appendMenuItem(Menus.SessionsEditorHeaderSecondary, { ...item, group }));
      }
    }
  }
};
EditorTitleMenuBridgeContribution = __decorateClass([
  __decorateParam(0, IAgentWorkbenchLayoutService)
], EditorTitleMenuBridgeContribution);
registerWorkbenchContribution2(EditorTitleMenuBridgeContribution.ID, EditorTitleMenuBridgeContribution, WorkbenchPhase.BlockStartup);
export {
  EditorTitleMenuBridgeContribution
};
