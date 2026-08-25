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
import { isMobile, isWeb } from "../../../../base/common/platform.js";
import { localize } from "../../../../nls.js";
import { Extensions as ConfigurationExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import product from "../../../../platform/product/common/product.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../workbench/common/contributions.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { LayoutController, RESPONSIVE_SIDEBAR_SETTING } from "./desktopSessionLayoutController.js";
import { MobileLayoutController } from "./mobileSessionLayoutController.js";
import { DOCK_DETAIL_PANEL_SETTING } from "../../../common/sessionConfig.js";
import { IAgentWorkbenchLayoutService } from "../../../browser/workbench.js";
import { SinglePaneLayoutController } from "./singlePaneLayoutController.js";
let SessionsLayoutContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.sessionsLayoutContribution";
  }
  constructor(instantiationService, layoutService) {
    super();
    if (layoutService.isSinglePaneLayoutEnabled) {
      this._register(instantiationService.createInstance(SinglePaneLayoutController));
      return;
    }
    if (isWeb && isMobile) {
      this._register(instantiationService.createInstance(MobileLayoutController));
      return;
    }
    this._register(instantiationService.createInstance(LayoutController));
  }
};
SessionsLayoutContribution = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IAgentWorkbenchLayoutService)
], SessionsLayoutContribution);
registerWorkbenchContribution2(SessionsLayoutContribution.ID, SessionsLayoutContribution, WorkbenchPhase.BlockRestore);
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  id: "sessions",
  properties: {
    [RESPONSIVE_SIDEBAR_SETTING]: {
      type: "boolean",
      markdownDescription: localize("sessions.layout.autoCollapseSessionsSidebar", "Controls whether the sessions sidebar is automatically collapsed in a narrow Agents window while both the editor and the side panel are open, and shown again once either of them closes."),
      default: product.quality !== "stable",
      tags: ["experimental"],
      experiment: { mode: "auto" }
    },
    [DOCK_DETAIL_PANEL_SETTING]: {
      type: "boolean",
      markdownDescription: localize("sessions.layout.singlePaneDetailPanel", "Controls whether the Agents window docks the detail panel inside the editor so a single editor tab bar spans across the editor and the detail panel. Requires a window reload to take effect."),
      default: false,
      tags: ["experimental"],
      experiment: { mode: "startup" }
    }
  }
});
