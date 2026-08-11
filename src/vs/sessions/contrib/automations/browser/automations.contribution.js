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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ConfigurationScope, Extensions as ConfigurationExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import product from "../../../../platform/product/common/product.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../workbench/common/contributions.js";
import { IAutomationDialogService } from "../../../../workbench/contrib/chat/common/automations/automationDialogService.js";
import { IAutomationRunner } from "../../../../workbench/contrib/chat/common/automations/automationRunner.js";
import { IAutomationService } from "../../../../workbench/contrib/chat/common/automations/automationService.js";
import { ChatAutomationsEnabledContext, CHAT_AUTOMATIONS_ENABLED_SETTING, CHAT_AUTOMATIONS_RUN_TIMEOUT_MINUTES_SETTING, DEFAULT_AUTOMATIONS_RUN_TIMEOUT_MINUTES } from "../../../../workbench/contrib/chat/common/automations/automationsEnabled.js";
import { AutomationDialogService } from "./automationDialogService.js";
import { AutomationRunner } from "./automationRunner.js";
import { AutomationScheduler } from "./automationScheduler.js";
import { AutomationService } from "./automationService.js";
import { BrowserAutomationStorageService } from "./automationStorageService.js";
import { AutomationToolsContribution } from "./automationTools.js";
import { IAutomationStorageService } from "../common/automationStorageService.js";
registerSingleton(IAutomationStorageService, BrowserAutomationStorageService, InstantiationType.Delayed);
registerSingleton(IAutomationService, AutomationService, InstantiationType.Delayed);
registerSingleton(IAutomationRunner, AutomationRunner, InstantiationType.Delayed);
registerSingleton(IAutomationDialogService, AutomationDialogService, InstantiationType.Delayed);
registerWorkbenchContribution2(AutomationScheduler.ID, AutomationScheduler, WorkbenchPhase.Eventually);
registerWorkbenchContribution2(AutomationToolsContribution.ID, AutomationToolsContribution, WorkbenchPhase.Eventually);
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  id: "chat",
  properties: {
    [CHAT_AUTOMATIONS_ENABLED_SETTING]: {
      type: "boolean",
      default: false,
      scope: ConfigurationScope.MACHINE,
      tags: ["experimental", "advanced"],
      description: localize("chat.automations.enabled", "Enables the Automations feature: scheduling agent sessions to run on a cadence. When disabled, the Automations entry in the Customizations sidebar, the Automations section in the Customizations editor, and the Automation option in the new-session composer are hidden, and scheduled automations are not dispatched."),
      included: product.quality !== "stable",
      experiment: { mode: "auto" }
    },
    [CHAT_AUTOMATIONS_RUN_TIMEOUT_MINUTES_SETTING]: {
      type: "number",
      default: DEFAULT_AUTOMATIONS_RUN_TIMEOUT_MINUTES,
      minimum: 1,
      scope: ConfigurationScope.MACHINE,
      tags: ["experimental", "advanced"],
      description: localize("chat.automations.runTimeoutMinutes", "Maximum number of minutes a scheduled automation run is allowed to take before the scheduler cancels it and marks it failed. Prevents a single hung run from permanently blocking subsequent scheduled runs."),
      included: product.quality !== "stable"
    }
  }
});
let ChatAutomationsEnabledContextContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.chatAutomationsEnabledContext";
  }
  constructor(configurationService, contextKeyService) {
    super();
    const key = ChatAutomationsEnabledContext.bindTo(contextKeyService);
    const update = () => key.set(configurationService.getValue(CHAT_AUTOMATIONS_ENABLED_SETTING) === true);
    update();
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(CHAT_AUTOMATIONS_ENABLED_SETTING)) {
        update();
      }
    }));
  }
};
ChatAutomationsEnabledContextContribution = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IContextKeyService)
], ChatAutomationsEnabledContextContribution);
registerWorkbenchContribution2(ChatAutomationsEnabledContextContribution.ID, ChatAutomationsEnabledContextContribution, WorkbenchPhase.BlockStartup);
