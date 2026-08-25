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
import { Codicon } from "../../../../base/common/codicons.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { localize, localize2 } from "../../../../nls.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { ViewPaneContainer } from "../../../../workbench/browser/parts/views/viewPaneContainer.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../workbench/common/contributions.js";
import { ViewContainerLocation, Extensions as ViewContainerExtensions, WindowEnablement } from "../../../../workbench/common/views.js";
const COPILOT_CHAT_VIEW_CONTAINER_ID = "workbench.view.extension.copilot-chat";
const COPILOT_CHAT_VIEW_ID = "copilot-chat";
const SESSIONS_CHAT_DEBUG_CONTAINER_ID = "workbench.sessions.panel.chatDebugContainer";
const chatDebugViewIcon = registerIcon("sessions-chat-debug-view-icon", Codicon.debug, localize("sessionsChatDebugViewIcon", "View icon of the chat debug view in the sessions window."));
let RegisterChatDebugViewContribution = class extends Disposable {
  static {
    this.ID = "sessions.registerChatDebugView";
  }
  constructor(productService) {
    super();
    if (productService.quality === "stable") {
      return;
    }
    const viewContainerRegistry = Registry.as(ViewContainerExtensions.ViewContainersRegistry);
    const viewsRegistry = Registry.as(ViewContainerExtensions.ViewsRegistry);
    if (!this.tryMoveView(viewContainerRegistry, viewsRegistry)) {
      const listener = viewsRegistry.onViewsRegistered((e) => {
        for (const { views } of e) {
          if (views.some((v) => v.id === COPILOT_CHAT_VIEW_ID)) {
            if (this.tryMoveView(viewContainerRegistry, viewsRegistry)) {
              listener.dispose();
            }
            break;
          }
        }
      });
      this._register(listener);
    }
  }
  tryMoveView(viewContainerRegistry, viewsRegistry) {
    const viewContainer = viewContainerRegistry.get(COPILOT_CHAT_VIEW_CONTAINER_ID);
    if (!viewContainer) {
      return false;
    }
    const view = viewsRegistry.getView(COPILOT_CHAT_VIEW_ID);
    if (!view) {
      return false;
    }
    viewsRegistry.deregisterViews([view], viewContainer);
    viewContainerRegistry.deregisterViewContainer(viewContainer);
    const chatDebugViewContainer = viewContainerRegistry.registerViewContainer({
      id: SESSIONS_CHAT_DEBUG_CONTAINER_ID,
      title: localize2("chatDebug", "Chat Debug"),
      icon: chatDebugViewIcon,
      order: 3,
      ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [SESSIONS_CHAT_DEBUG_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: true }]),
      storageId: SESSIONS_CHAT_DEBUG_CONTAINER_ID,
      hideIfEmpty: true,
      windowEnablement: WindowEnablement.Sessions
    }, ViewContainerLocation.Panel, { doNotRegisterOpenCommand: true });
    const sessionsView = {
      ...view,
      canMoveView: false,
      windowEnablement: WindowEnablement.Sessions
    };
    viewsRegistry.registerViews([sessionsView], chatDebugViewContainer);
    return true;
  }
};
RegisterChatDebugViewContribution = __decorateClass([
  __decorateParam(0, IProductService)
], RegisterChatDebugViewContribution);
registerWorkbenchContribution2(RegisterChatDebugViewContribution.ID, RegisterChatDebugViewContribution, WorkbenchPhase.BlockRestore);
