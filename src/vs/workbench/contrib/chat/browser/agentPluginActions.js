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
import { Action } from "../../../../base/common/actions.js";
import { Emitter } from "../../../../base/common/event.js";
import { ActionWithDropdownActionViewItem } from "../../../../base/browser/ui/dropdown/dropdownActionViewItem.js";
import { localize } from "../../../../nls.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { dirname, joinPath } from "../../../../base/common/resources.js";
import { ContributionEnablementState, isContributionDisabled, isContributionEnabled } from "../common/enablement.js";
import { IAgentPluginService } from "../common/plugins/agentPluginService.js";
import { IPluginInstallService } from "../common/plugins/pluginInstallService.js";
import { buildEnablementContextMenuGroup } from "./enablementActions.js";
import { hasKey } from "../../../../base/common/types.js";
let InstallPluginAction = class extends Action {
  constructor(item, pluginInstallService) {
    super(
      "agentPlugin.install",
      localize("install", "Install"),
      "extension-action label prominent install",
      true,
      () => pluginInstallService.installPlugin({
        name: item.name,
        description: item.description,
        version: "",
        source: item.source,
        sourceDescriptor: item.sourceDescriptor,
        marketplace: item.marketplace,
        marketplaceReference: item.marketplaceReference,
        marketplaceType: item.marketplaceType,
        readmeUri: item.readmeUri
      })
    );
  }
};
InstallPluginAction = __decorateClass([
  __decorateParam(1, IPluginInstallService)
], InstallPluginAction);
class UninstallPluginAction extends Action {
  constructor(plugin) {
    super(
      "agentPlugin.uninstall",
      localize("uninstall", "Uninstall"),
      "extension-action label uninstall",
      true,
      () => {
        plugin.remove();
        return Promise.resolve();
      }
    );
  }
}
function isRemovableAgentPlugin(plugin) {
  return plugin.remove !== void 0;
}
function createUninstallPluginAction(plugin) {
  return isRemovableAgentPlugin(plugin) ? new UninstallPluginAction(plugin) : void 0;
}
let OpenPluginFolderAction = class extends Action {
  constructor(plugin, commandService, openerService) {
    super(
      "agentPlugin.openFolder",
      localize("openPluginFolder", "Open Plugin Folder"),
      void 0,
      true,
      async () => {
        try {
          await commandService.executeCommand("revealFileInOS", plugin.uri);
        } catch {
          await openerService.open(dirname(plugin.uri));
        }
      }
    );
  }
};
OpenPluginFolderAction = __decorateClass([
  __decorateParam(1, ICommandService),
  __decorateParam(2, IOpenerService)
], OpenPluginFolderAction);
let OpenPluginReadmeAction = class extends Action {
  constructor(readmeUri, openerService) {
    super(
      "agentPlugin.openReadme",
      localize("openReadme", "Open README"),
      void 0,
      true,
      () => openerService.open(readmeUri)
    );
  }
};
OpenPluginReadmeAction = __decorateClass([
  __decorateParam(1, IOpenerService)
], OpenPluginReadmeAction);
function isPluginPolicyBlocked(plugin) {
  return plugin.policyBlocked?.get() === true;
}
function notifyPluginPolicyBlocked(notificationService, pluginName) {
  notificationService.warn(localize("pluginPolicyBlocked", 'The plugin "{0}" has been disabled by your organization and cannot be enabled.', pluginName));
}
function createPolicyBlockedEnableAction(plugin, notificationService) {
  return new Action(
    "agentPlugin.enableBlocked",
    localize("enable", "Enable"),
    void 0,
    true,
    () => {
      notifyPluginPolicyBlocked(notificationService, plugin.label);
      return Promise.resolve();
    }
  );
}
function getInstalledPluginContextMenuActions(plugin, instantiationService) {
  return instantiationService.invokeFunction((accessor) => {
    const agentPluginService = accessor.get(IAgentPluginService);
    const workspaceService = accessor.get(IWorkspaceContextService);
    const groups = [];
    if (isPluginPolicyBlocked(plugin)) {
      groups.push([createPolicyBlockedEnableAction(plugin, accessor.get(INotificationService))]);
    } else {
      groups.push(buildEnablementContextMenuGroup(
        plugin.enablement.get(),
        plugin.uri.toString(),
        agentPluginService.enablementModel,
        workspaceService,
        "agentPlugin"
      ));
    }
    groups.push([
      instantiationService.createInstance(OpenPluginFolderAction, plugin),
      instantiationService.createInstance(OpenPluginReadmeAction, joinPath(plugin.uri, "README.md"))
    ]);
    const uninstallAction = createUninstallPluginAction(plugin);
    if (uninstallAction) {
      groups.push([uninstallAction]);
    }
    return groups;
  });
}
class EnablementSubAction extends Action {
  get hidden() {
    return this._hidden;
  }
  set hidden(v) {
    this._hidden = v;
  }
  constructor(id, label, cssClass, enabled, actionCallback) {
    super(id, label, cssClass, enabled, actionCallback);
    this._hidden = !enabled;
  }
  _setEnabled(value) {
    super._setEnabled(value);
    this.hidden = !value;
  }
}
class EnablementDropDownAction extends Action {
  constructor(id, subActions) {
    super(id, void 0, "extension-action label action-dropdown");
    this.menuActionClassNames = ["extension-action", "label", "action-dropdown"];
    this._menuActions = [];
    this._isHidden = false;
    this._onDidChange = new Emitter();
    this.subActions = subActions;
    for (const a of subActions) {
      a.onDidChange(() => this._updateDropdown());
    }
    this._updateDropdown();
  }
  get menuActions() {
    return [...this._menuActions];
  }
  get isHidden() {
    return this._isHidden;
  }
  get onDidChange() {
    return this._onDidChange.event;
  }
  _updateDropdown() {
    const visible = this.subActions.filter((a) => !a.hidden);
    const primary = visible[0];
    this._menuActions = visible.length > 1 ? [...visible] : [];
    if (primary) {
      this._isHidden = false;
      this.enabled = true;
      this.label = primary.label;
      this.tooltip = primary.tooltip;
    } else {
      this._isHidden = true;
      this.enabled = false;
    }
    this._onDidChange.fire({ menuActions: this._menuActions });
  }
  async run() {
    const primary = this.subActions.find((a) => !a.hidden);
    await primary?.run();
  }
  dispose() {
    for (const a of this.subActions) {
      a.dispose();
    }
    super.dispose();
  }
}
class EnablementDropdownActionViewItem extends ActionWithDropdownActionViewItem {
  constructor(action, options, contextMenuProvider) {
    super(null, action, options, contextMenuProvider);
    this._register(action.onDidChange((e) => {
      if (hasKey(e, { menuActions: true })) {
        this.updateClass();
      }
    }));
  }
  render(container) {
    super.render(container);
    this.updateClass();
  }
  updateClass() {
    super.updateClass();
    if (this.element && this.dropdownMenuActionViewItem?.element) {
      const action = this._action;
      this.element.classList.toggle("hide", action.isHidden);
      const isMenuEmpty = action.menuActions.length === 0;
      this.element.classList.toggle("empty", isMenuEmpty);
      this.dropdownMenuActionViewItem.element.classList.toggle("hide", isMenuEmpty);
    }
  }
}
function createEnablePluginDropDown(plugin, enablementModel, workspaceContextService) {
  const key = plugin.uri.toString();
  const hasWorkspace = workspaceContextService.getWorkbenchState() !== WorkbenchState.EMPTY;
  const enable = new EnablementSubAction(
    "agentPlugin.enable",
    localize("enable", "Enable"),
    "extension-action label prominent",
    isContributionDisabled(plugin.enablement.get()),
    () => {
      enablementModel.setEnabled(key, ContributionEnablementState.EnabledProfile);
      return Promise.resolve();
    }
  );
  const enableWorkspace = new EnablementSubAction(
    "agentPlugin.enableForWorkspace",
    localize("enableForWorkspace", "Enable (Workspace)"),
    "extension-action label",
    isContributionDisabled(plugin.enablement.get()) && hasWorkspace,
    () => {
      enablementModel.setEnabled(key, ContributionEnablementState.EnabledWorkspace);
      return Promise.resolve();
    }
  );
  return new EnablementDropDownAction("agentPlugin.enableDropdown", [enable, enableWorkspace]);
}
function createDisablePluginDropDown(plugin, enablementModel, workspaceContextService) {
  const key = plugin.uri.toString();
  const hasWorkspace = workspaceContextService.getWorkbenchState() !== WorkbenchState.EMPTY;
  const disable = new EnablementSubAction(
    "agentPlugin.disable",
    localize("disable", "Disable"),
    "extension-action label disable",
    isContributionEnabled(plugin.enablement.get()),
    () => {
      enablementModel.setEnabled(key, ContributionEnablementState.DisabledProfile);
      return Promise.resolve();
    }
  );
  const disableWorkspace = new EnablementSubAction(
    "agentPlugin.disableForWorkspace",
    localize("disableForWorkspace", "Disable (Workspace)"),
    "extension-action label disable",
    isContributionEnabled(plugin.enablement.get()) && hasWorkspace,
    () => {
      enablementModel.setEnabled(key, ContributionEnablementState.DisabledWorkspace);
      return Promise.resolve();
    }
  );
  return new EnablementDropDownAction("agentPlugin.disableDropdown", [disable, disableWorkspace]);
}
export {
  EnablementDropDownAction,
  EnablementDropdownActionViewItem,
  InstallPluginAction,
  OpenPluginFolderAction,
  OpenPluginReadmeAction,
  UninstallPluginAction,
  createDisablePluginDropDown,
  createEnablePluginDropDown,
  createPolicyBlockedEnableAction,
  createUninstallPluginAction,
  getInstalledPluginContextMenuActions,
  isPluginPolicyBlocked,
  notifyPluginPolicyBlocked
};
