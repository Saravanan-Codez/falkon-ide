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
import { PickerQuickAccessProvider, TriggerAction } from "../../../../platform/quickinput/browser/pickerQuickAccess.js";
import { localize } from "../../../../nls.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IDebugService } from "../common/debug.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { matchesFuzzy } from "../../../../base/common/filters.js";
import { ADD_CONFIGURATION_ID, DEBUG_QUICK_ACCESS_PREFIX } from "./debugCommands.js";
import { debugConfigure, debugRemoveConfig } from "./debugIcons.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
let StartDebugQuickAccessProvider = class extends PickerQuickAccessProvider {
  constructor(debugService, contextService, commandService, notificationService) {
    super(DEBUG_QUICK_ACCESS_PREFIX, {
      noResultsPick: {
        label: localize("noDebugResults", "No matching launch configurations")
      }
    });
    this.debugService = debugService;
    this.contextService = contextService;
    this.commandService = commandService;
    this.notificationService = notificationService;
  }
  async _getPicks(filter) {
    const picks = [];
    if (!this.debugService.getAdapterManager().hasEnabledDebuggers()) {
      return [];
    }
    picks.push({ type: "separator", label: "launch.json" });
    const configManager = this.debugService.getConfigurationManager();
    const selectedConfiguration = configManager.selectedConfiguration;
    let lastGroup;
    for (const config of configManager.getAllConfigurations()) {
      const highlights = matchesFuzzy(filter, config.name, true);
      if (highlights) {
        const pick = {
          label: config.name,
          description: this.contextService.getWorkbenchState() === WorkbenchState.WORKSPACE ? config.launch.name : "",
          highlights: { label: highlights },
          buttons: [{
            iconClass: ThemeIcon.asClassName(debugConfigure),
            tooltip: localize("customizeLaunchConfig", "Configure Launch Configuration")
          }],
          trigger: () => {
            config.launch.openConfigFile({ preserveFocus: false });
            return TriggerAction.CLOSE_PICKER;
          },
          accept: async () => {
            await configManager.selectConfiguration(config.launch, config.name);
            try {
              await this.debugService.startDebugging(config.launch, void 0, { startedByUser: true });
            } catch (error) {
              this.notificationService.error(error);
            }
          }
        };
        if (selectedConfiguration.name === config.name && selectedConfiguration.launch === config.launch) {
          const separator = { type: "separator", label: localize("mostRecent", "Most Recent") };
          picks.unshift(separator, pick);
          continue;
        }
        if (lastGroup !== config.presentation?.group) {
          picks.push({ type: "separator" });
          lastGroup = config.presentation?.group;
        }
        picks.push(pick);
      }
    }
    const dynamicProviders = await configManager.getDynamicProviders();
    if (dynamicProviders.length > 0) {
      picks.push({
        type: "separator",
        label: localize({
          key: "contributed",
          comment: ["contributed is lower case because it looks better like that in UI. Nothing preceeds it. It is a name of the grouping of debug configurations."]
        }, "contributed")
      });
    }
    configManager.getRecentDynamicConfigurations().forEach(({ name, type }) => {
      const highlights = matchesFuzzy(filter, name, true);
      if (highlights) {
        picks.push({
          label: name,
          highlights: { label: highlights },
          buttons: [{
            iconClass: ThemeIcon.asClassName(debugRemoveConfig),
            tooltip: localize("removeLaunchConfig", "Remove Launch Configuration")
          }],
          trigger: () => {
            configManager.removeRecentDynamicConfigurations(name, type);
            return TriggerAction.CLOSE_PICKER;
          },
          accept: async () => {
            await configManager.selectConfiguration(void 0, name, void 0, { type });
            try {
              const { launch, getConfig } = configManager.selectedConfiguration;
              const config = await getConfig();
              await this.debugService.startDebugging(launch, config, { startedByUser: true });
            } catch (error) {
              this.notificationService.error(error);
            }
          }
        });
      }
    });
    dynamicProviders.forEach((provider) => {
      picks.push({
        label: `$(folder) ${provider.label}...`,
        ariaLabel: localize({ key: "providerAriaLabel", comment: ['Placeholder stands for the provider label. For example "NodeJS".'] }, "{0} contributed configurations", provider.label),
        accept: async () => {
          const pick = await provider.pick();
          if (pick) {
            await configManager.selectConfiguration(pick.launch, pick.config.name, pick.config, { type: provider.type });
            this.debugService.startDebugging(pick.launch, pick.config, { startedByUser: true });
          }
        }
      });
    });
    const visibleLaunches = configManager.getLaunches().filter((launch) => !launch.hidden);
    if (visibleLaunches.length > 0) {
      picks.push({ type: "separator", label: localize("configure", "configure") });
    }
    for (const launch of visibleLaunches) {
      const label = this.contextService.getWorkbenchState() === WorkbenchState.WORKSPACE ? localize("addConfigTo", "Add Config ({0})...", launch.name) : localize("addConfiguration", "Add Configuration...");
      picks.push({
        label,
        description: this.contextService.getWorkbenchState() === WorkbenchState.WORKSPACE ? launch.name : "",
        highlights: { label: matchesFuzzy(filter, label, true) ?? void 0 },
        accept: () => this.commandService.executeCommand(ADD_CONFIGURATION_ID, launch.uri.toString())
      });
    }
    return picks;
  }
};
StartDebugQuickAccessProvider = __decorateClass([
  __decorateParam(0, IDebugService),
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, ICommandService),
  __decorateParam(3, INotificationService)
], StartDebugQuickAccessProvider);
export {
  StartDebugQuickAccessProvider
};
