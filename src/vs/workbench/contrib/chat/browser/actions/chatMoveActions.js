import { Codicon } from "../../../../../base/common/codicons.js";
import { localize, localize2 } from "../../../../../nls.js";
import { Action2, MenuId, MenuRegistry, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { ActiveEditorContext } from "../../../../common/contextkeys.js";
import { ViewContainerLocation } from "../../../../common/views.js";
import { IEditorGroupsService } from "../../../../services/editor/common/editorGroupsService.js";
import { ACTIVE_GROUP, AUX_WINDOW_GROUP, IEditorService } from "../../../../services/editor/common/editorService.js";
import { IViewsService } from "../../../../services/views/common/viewsService.js";
import { isChatViewTitleActionContext } from "../../common/actions/chatActions.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
import { ChatAgentLocation } from "../../common/constants.js";
import { ChatViewId, IChatWidgetService } from "../chat.js";
import { ChatEditor } from "../widgetHosts/editor/chatEditor.js";
import { ChatEditorInput } from "../widgetHosts/editor/chatEditorInput.js";
import { CHAT_CATEGORY } from "./chatActions.js";
var MoveToNewLocation = /* @__PURE__ */ ((MoveToNewLocation2) => {
  MoveToNewLocation2["Editor"] = "Editor";
  MoveToNewLocation2["Window"] = "Window";
  return MoveToNewLocation2;
})(MoveToNewLocation || {});
function registerMoveActions() {
  registerAction2(class GlobalMoveToEditorAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chat.openInEditor",
        title: localize2("chat.openInEditor.label", "Move Chat into Editor Area"),
        category: CHAT_CATEGORY,
        precondition: ChatContextKeys.enabled,
        f1: true,
        menu: {
          id: MenuId.ViewTitle,
          when: ContextKeyExpr.equals("view", ChatViewId),
          order: 0,
          group: "1_open"
        }
      });
    }
    async run(accessor, ...args) {
      const context = args[0];
      executeMoveToAction(accessor, "Editor" /* Editor */, isChatViewTitleActionContext(context) ? context.sessionResource : void 0);
    }
  });
  registerAction2(class GlobalMoveToNewWindowAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chat.openInNewWindow",
        title: localize2("chat.openInNewWindow.label", "Move Chat into New Window"),
        category: CHAT_CATEGORY,
        precondition: ChatContextKeys.enabled,
        f1: true,
        menu: {
          id: MenuId.ViewTitle,
          when: ContextKeyExpr.equals("view", ChatViewId),
          order: 0,
          group: "1_open"
        }
      });
    }
    async run(accessor, ...args) {
      const context = args[0];
      executeMoveToAction(accessor, "Window" /* Window */, isChatViewTitleActionContext(context) ? context.sessionResource : void 0);
    }
  });
  registerAction2(class GlobalMoveToSidebarAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chat.openInSidebar",
        title: localize2("interactiveSession.openInSidebar.label", "Move Chat into Side Bar"),
        category: CHAT_CATEGORY,
        precondition: ChatContextKeys.enabled,
        f1: true
      });
    }
    async run(accessor, ...args) {
      return moveToSidebar(accessor);
    }
  });
  function appendOpenChatInViewMenuItem(menuId, title, icon, locationContextKey) {
    MenuRegistry.appendMenuItem(menuId, {
      command: { id: "workbench.action.chat.openInSidebar", title, icon },
      when: ContextKeyExpr.and(
        ActiveEditorContext.isEqualTo(ChatEditorInput.EditorID),
        locationContextKey
      ),
      group: menuId === MenuId.CompactWindowEditorTitle ? "navigation" : void 0,
      order: 0
    });
  }
  [MenuId.EditorTitle, MenuId.CompactWindowEditorTitle].forEach((id) => {
    appendOpenChatInViewMenuItem(id, localize("interactiveSession.openInSecondarySidebar.label", "Move Chat into Secondary Side Bar"), Codicon.layoutSidebarRightDock, ChatContextKeys.panelLocation.isEqualTo(ViewContainerLocation.AuxiliaryBar));
    appendOpenChatInViewMenuItem(id, localize("interactiveSession.openInPrimarySidebar.label", "Move Chat into Primary Side Bar"), Codicon.layoutSidebarLeftDock, ChatContextKeys.panelLocation.isEqualTo(ViewContainerLocation.Sidebar));
    appendOpenChatInViewMenuItem(id, localize("interactiveSession.openInPanel.label", "Move Chat into Panel"), Codicon.layoutPanelDock, ChatContextKeys.panelLocation.isEqualTo(ViewContainerLocation.Panel));
  });
}
async function executeMoveToAction(accessor, moveTo, sessionResource) {
  const widgetService = accessor.get(IChatWidgetService);
  const auxiliary = { compact: true, bounds: { width: 800, height: 640 } };
  const widget = (sessionResource ? widgetService.getWidgetBySessionResource(sessionResource) : void 0) ?? widgetService.lastFocusedWidget;
  if (!widget || !widget.viewModel || widget.location !== ChatAgentLocation.Chat) {
    await widgetService.openSession(ChatEditorInput.getNewEditorUri(), moveTo === "Window" /* Window */ ? AUX_WINDOW_GROUP : ACTIVE_GROUP, { pinned: true, auxiliary });
    return;
  }
  const existingWidget = widgetService.getWidgetBySessionResource(widget.viewModel.sessionResource);
  if (!existingWidget) {
    await widgetService.openSession(ChatEditorInput.getNewEditorUri(), moveTo === "Window" /* Window */ ? AUX_WINDOW_GROUP : ACTIVE_GROUP, { pinned: true, auxiliary });
    return;
  }
  const resourceToOpen = widget.viewModel.sessionResource;
  const modelInputState = existingWidget.getInputState();
  await widget.clear();
  const options = { pinned: true, modelInputState, auxiliary };
  await widgetService.openSession(resourceToOpen, moveTo === "Window" /* Window */ ? AUX_WINDOW_GROUP : ACTIVE_GROUP, options);
}
async function moveToSidebar(accessor) {
  const viewsService = accessor.get(IViewsService);
  const editorService = accessor.get(IEditorService);
  const editorGroupService = accessor.get(IEditorGroupsService);
  const chatEditor = editorService.activeEditorPane;
  const chatEditorInput = chatEditor?.input;
  let view;
  if (chatEditor instanceof ChatEditor && chatEditorInput instanceof ChatEditorInput && chatEditorInput.sessionResource) {
    const previousInputState = chatEditor.widget.getInputState();
    await editorService.closeEditor({ editor: chatEditor.input, groupId: editorGroupService.activeGroup.id });
    view = await viewsService.openView(ChatViewId);
    const newModel = await view.loadSession(chatEditorInput.sessionResource);
    if (previousInputState && newModel && !newModel.inputModel.state.get()) {
      newModel.inputModel.setState(previousInputState);
    }
  } else {
    view = await viewsService.openView(ChatViewId);
  }
  view.focus();
}
export {
  registerMoveActions
};
