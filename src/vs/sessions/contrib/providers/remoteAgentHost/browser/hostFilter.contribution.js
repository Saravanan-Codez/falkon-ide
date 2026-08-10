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
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { localize2 } from "../../../../../nls.js";
import { IActionViewItemService } from "../../../../../platform/actions/browser/actionViewItemService.js";
import { Action2, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { IsWebContext } from "../../../../../platform/contextkey/common/contextkeys.js";
import { IsAuxiliaryWindowContext } from "../../../../../workbench/common/contextkeys.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../../workbench/common/contributions.js";
import { IsNewChatSessionContext, IsPhoneLayoutContext } from "../../../../common/contextkeys.js";
import { Menus } from "../../../../browser/menus.js";
import { IAgentHostFilterService } from "../../../../services/agentHostFilter/common/agentHostFilter.js";
import { HostFilterActionViewItem } from "./hostFilterActionViewItem.js";
import { MobileHostFilterActionViewItem } from "./mobileHostFilterActionViewItem.js";
const PICK_HOST_FILTER_ID = "sessions.agentHostFilter.pick";
registerAction2(class PickAgentHostFilterAction extends Action2 {
  constructor() {
    super({
      id: PICK_HOST_FILTER_ID,
      title: localize2("agentHostFilter.pick", "Select Agent Host"),
      f1: false,
      menu: [{
        id: Menus.SidebarAgentHost,
        group: "navigation",
        order: 1,
        // Always shown on web desktop (regardless of host count):
        // when no hosts are known the pill renders a re-discover
        // affordance (refresh icon + click triggers `rediscover()`);
        // when one or more are known it is the host picker.
        when: ContextKeyExpr.and(
          IsWebContext,
          IsAuxiliaryWindowContext.toNegated(),
          IsPhoneLayoutContext.negate()
        )
      }, {
        // On phone/mobile layouts the desktop titlebar is replaced
        // by the MobileTitlebarPart. Surface the host picker in its
        // center slot while a new (empty) chat session is active,
        // so users can still switch hosts and connect from the
        // home screen.
        //
        // Unlike the desktop pill, the mobile entry is shown even
        // when no hosts are known: tapping it opens a bottom sheet
        // with a "Re-discover hosts" action so the user always has
        // a way to retry discovery from the home screen.
        id: Menus.MobileTitleBarCenter,
        group: "navigation",
        order: 0,
        when: ContextKeyExpr.and(
          IsWebContext,
          IsAuxiliaryWindowContext.toNegated(),
          IsNewChatSessionContext
        )
      }]
    });
  }
  async run(_accessor) {
  }
});
let AgentHostFilterContribution = class extends Disposable {
  static {
    this.ID = "sessions.contrib.agentHostFilter";
  }
  constructor(filterService, actionViewItemService) {
    super();
    const registered = this._register(new Emitter());
    const refreshSignal = Event.any(filterService.onDidChange, filterService.onDidChangeDiscovering, registered.event);
    this._register(actionViewItemService.register(
      Menus.SidebarAgentHost,
      PICK_HOST_FILTER_ID,
      (action, _options, instaService) => instaService.createInstance(HostFilterActionViewItem, action, "sidebar"),
      refreshSignal
    ));
    this._register(actionViewItemService.register(
      Menus.MobileTitleBarCenter,
      PICK_HOST_FILTER_ID,
      (action, _options, instaService) => instaService.createInstance(MobileHostFilterActionViewItem, action),
      refreshSignal
    ));
    queueMicrotask(() => registered.fire());
  }
};
AgentHostFilterContribution = __decorateClass([
  __decorateParam(0, IAgentHostFilterService),
  __decorateParam(1, IActionViewItemService)
], AgentHostFilterContribution);
registerWorkbenchContribution2(
  AgentHostFilterContribution.ID,
  AgentHostFilterContribution,
  WorkbenchPhase.AfterRestored
);
