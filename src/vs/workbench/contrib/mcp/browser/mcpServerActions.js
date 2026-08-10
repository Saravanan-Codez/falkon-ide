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
import { ActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { alert } from "../../../../base/browser/ui/aria/aria.js";
import { Action, Separator } from "../../../../base/common/actions.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { disposeIfDisposable } from "../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { URI } from "../../../../base/common/uri.js";
import { localize } from "../../../../nls.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IAuthenticationService } from "../../../services/authentication/common/authentication.js";
import { IAuthenticationQueryService } from "../../../services/authentication/common/authenticationQuery.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { errorIcon, infoIcon, manageExtensionIcon, trustIcon, warningIcon } from "../../extensions/browser/extensionsIcons.js";
import { McpCommandIds } from "../common/mcpCommandIds.js";
import { IMcpRegistry } from "../common/mcpRegistryTypes.js";
import { IMcpSamplingService, IMcpService, IMcpWorkbenchService, McpCapability, McpConnectionState, McpServerEditorTab, McpServerInstallState } from "../common/mcpTypes.js";
import { startServerByFilter } from "../common/mcpTypesUtils.js";
import { ConfigurationTarget } from "../../../../platform/configuration/common/configuration.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { Schemas } from "../../../../base/common/network.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { LocalMcpServerScope } from "../../../services/mcp/common/mcpWorkbenchManagementService.js";
import { ActionWithDropdownActionViewItem } from "../../../../base/browser/ui/dropdown/dropdownActionViewItem.js";
import Severity from "../../../../base/common/severity.js";
import { ContributionEnablementState, isContributionDisabled, isContributionEnabled } from "../../chat/common/enablement.js";
import { getWorkbenchMenuMotionContextMenuOptions } from "../../../browser/actions/menuMotion.js";
class McpServerAction extends Action {
  constructor() {
    super(...arguments);
    this._onDidChange = this._register(new Emitter());
    this._hidden = false;
    this.hideOnDisabled = true;
    this._mcpServer = null;
  }
  get onDidChange() {
    return this._onDidChange.event;
  }
  static {
    this.EXTENSION_ACTION_CLASS = "extension-action";
  }
  static {
    this.TEXT_ACTION_CLASS = `${McpServerAction.EXTENSION_ACTION_CLASS} text`;
  }
  static {
    this.LABEL_ACTION_CLASS = `${McpServerAction.EXTENSION_ACTION_CLASS} label`;
  }
  static {
    this.PROMINENT_LABEL_ACTION_CLASS = `${McpServerAction.LABEL_ACTION_CLASS} prominent`;
  }
  static {
    this.ICON_ACTION_CLASS = `${McpServerAction.EXTENSION_ACTION_CLASS} icon`;
  }
  get hidden() {
    return this._hidden;
  }
  set hidden(hidden) {
    if (this._hidden !== hidden) {
      this._hidden = hidden;
      this._onDidChange.fire({ hidden });
    }
  }
  _setEnabled(value) {
    super._setEnabled(value);
    if (this.hideOnDisabled) {
      this.hidden = !value;
    }
  }
  get mcpServer() {
    return this._mcpServer;
  }
  set mcpServer(mcpServer) {
    this._mcpServer = mcpServer;
    this.update();
  }
}
class ButtonWithDropDownExtensionAction extends McpServerAction {
  constructor(id, clazz, actionsGroups) {
    clazz = `${clazz} action-dropdown`;
    super(id, void 0, clazz);
    this.actionsGroups = actionsGroups;
    this.menuActionClassNames = [];
    this._menuActions = [];
    this.menuActionClassNames = clazz.split(" ");
    this.hideOnDisabled = false;
    this.actions = actionsGroups.flat();
    this.update();
    this._register(Event.any(...this.actions.map((a) => a.onDidChange))(() => this.update(true)));
    this.actions.forEach((a) => this._register(a));
  }
  get menuActions() {
    return [...this._menuActions];
  }
  get mcpServer() {
    return super.mcpServer;
  }
  set mcpServer(mcpServer) {
    this.actions.forEach((a) => a.mcpServer = mcpServer);
    super.mcpServer = mcpServer;
  }
  update(donotUpdateActions) {
    if (!donotUpdateActions) {
      this.actions.forEach((a) => a.update());
    }
    const actionsGroups = this.actionsGroups.map((actionsGroup) => actionsGroup.filter((a) => !a.hidden));
    let actions = [];
    for (const visibleActions of actionsGroups) {
      if (visibleActions.length) {
        actions = [...actions, ...visibleActions, new Separator()];
      }
    }
    actions = actions.length ? actions.slice(0, actions.length - 1) : actions;
    this.primaryAction = actions[0];
    this._menuActions = actions.length > 1 ? actions : [];
    this._onDidChange.fire({ menuActions: this._menuActions });
    if (this.primaryAction) {
      this.hidden = false;
      this.enabled = this.primaryAction.enabled;
      this.label = this.getLabel(this.primaryAction);
      this.tooltip = this.primaryAction.tooltip;
    } else {
      this.hidden = true;
      this.enabled = false;
    }
  }
  async run() {
    if (this.enabled) {
      await this.primaryAction?.run();
    }
  }
  getLabel(action) {
    return action.label;
  }
}
class ButtonWithDropdownExtensionActionViewItem extends ActionWithDropdownActionViewItem {
  constructor(action, options, contextMenuProvider) {
    super(null, action, options, contextMenuProvider);
    this._register(action.onDidChange((e) => {
      if (e.hidden !== void 0 || e.menuActions !== void 0) {
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
      this.element.classList.toggle("hide", this._action.hidden);
      const isMenuEmpty = this._action.menuActions.length === 0;
      this.element.classList.toggle("empty", isMenuEmpty);
      this.dropdownMenuActionViewItem.element.classList.toggle("hide", isMenuEmpty);
    }
  }
}
let DropDownAction = class extends McpServerAction {
  constructor(id, label, cssClass, enabled, instantiationService) {
    super(id, label, cssClass, enabled);
    this.instantiationService = instantiationService;
    this._actionViewItem = null;
  }
  createActionViewItem(options) {
    this._actionViewItem = this.instantiationService.createInstance(DropDownExtensionActionViewItem, this, options);
    return this._actionViewItem;
  }
  run(actionGroups) {
    this._actionViewItem?.showMenu(actionGroups);
    return Promise.resolve();
  }
};
DropDownAction = __decorateClass([
  __decorateParam(4, IInstantiationService)
], DropDownAction);
let DropDownExtensionActionViewItem = class extends ActionViewItem {
  constructor(action, options, contextMenuService) {
    super(null, action, { ...options, icon: true, label: true });
    this.contextMenuService = contextMenuService;
  }
  showMenu(menuActionGroups) {
    if (this.element) {
      const actions = this.getActions(menuActionGroups);
      this.contextMenuService.showContextMenu({
        ...getWorkbenchMenuMotionContextMenuOptions(this.element),
        getActions: () => actions,
        actionRunner: this.actionRunner,
        onHide: () => disposeIfDisposable(actions)
      });
    }
  }
  getActions(menuActionGroups) {
    let actions = [];
    for (const menuActions of menuActionGroups) {
      actions = [...actions, ...menuActions, new Separator()];
    }
    return actions.length ? actions.slice(0, actions.length - 1) : actions;
  }
};
DropDownExtensionActionViewItem = __decorateClass([
  __decorateParam(2, IContextMenuService)
], DropDownExtensionActionViewItem);
let InstallAction = class extends McpServerAction {
  constructor(open, mcpWorkbenchService, telemetryService, mcpService) {
    super("extensions.install", localize("install", "Install"), InstallAction.CLASS, false);
    this.open = open;
    this.mcpWorkbenchService = mcpWorkbenchService;
    this.telemetryService = telemetryService;
    this.mcpService = mcpService;
    this.update();
  }
  static {
    this.CLASS = `${this.LABEL_ACTION_CLASS} prominent install`;
  }
  static {
    this.HIDE = `${this.CLASS} hide`;
  }
  update() {
    this.enabled = false;
    this.class = InstallAction.HIDE;
    if (!this.mcpServer?.gallery && !this.mcpServer?.installable) {
      return;
    }
    if (this.mcpServer.installState !== McpServerInstallState.Uninstalled) {
      return;
    }
    this.class = InstallAction.CLASS;
    this.enabled = this.mcpWorkbenchService.canInstall(this.mcpServer) === true;
  }
  async run() {
    if (!this.mcpServer) {
      return;
    }
    if (this.open) {
      this.mcpWorkbenchService.open(this.mcpServer);
      alert(localize("mcpServerInstallation", "Installing MCP Server {0} started. An editor is now open with more details on this MCP Server", this.mcpServer.label));
    }
    this.telemetryService.publicLog2("mcp:action:install", { name: this.mcpServer.gallery?.name });
    const installed = await this.mcpWorkbenchService.install(this.mcpServer);
    await startServerByFilter(this.mcpService, (s) => {
      return s.definition.label === installed.name;
    });
  }
};
InstallAction = __decorateClass([
  __decorateParam(1, IMcpWorkbenchService),
  __decorateParam(2, ITelemetryService),
  __decorateParam(3, IMcpService)
], InstallAction);
let InstallInWorkspaceAction = class extends McpServerAction {
  constructor(open, mcpWorkbenchService, workspaceService, quickInputService, telemetryService, mcpService) {
    super("extensions.installWorkspace", localize("installInWorkspace", "Install in Workspace"), InstallAction.CLASS, false);
    this.open = open;
    this.mcpWorkbenchService = mcpWorkbenchService;
    this.workspaceService = workspaceService;
    this.quickInputService = quickInputService;
    this.telemetryService = telemetryService;
    this.mcpService = mcpService;
    this.update();
  }
  static {
    this.CLASS = `${this.LABEL_ACTION_CLASS} prominent install`;
  }
  static {
    this.HIDE = `${this.CLASS} hide`;
  }
  update() {
    this.enabled = false;
    this.class = InstallInWorkspaceAction.HIDE;
    if (this.workspaceService.getWorkbenchState() === WorkbenchState.EMPTY) {
      return;
    }
    if (!this.mcpServer?.gallery && !this.mcpServer?.installable) {
      return;
    }
    if (this.mcpServer.installState !== McpServerInstallState.Uninstalled && this.mcpServer.local?.scope === LocalMcpServerScope.Workspace) {
      return;
    }
    this.class = InstallAction.CLASS;
    this.enabled = this.mcpWorkbenchService.canInstall(this.mcpServer) === true;
  }
  async run() {
    if (!this.mcpServer) {
      return;
    }
    if (this.open) {
      this.mcpWorkbenchService.open(this.mcpServer, { preserveFocus: true });
      alert(localize("mcpServerInstallation", "Installing MCP Server {0} started. An editor is now open with more details on this MCP Server", this.mcpServer.label));
    }
    const target = await this.getConfigurationTarget();
    if (!target) {
      return;
    }
    this.telemetryService.publicLog2("mcp:action:install:workspace", { name: this.mcpServer.gallery?.name });
    const installed = await this.mcpWorkbenchService.install(this.mcpServer, { target });
    await startServerByFilter(this.mcpService, (s) => {
      return s.definition.label === installed.name;
    });
  }
  async getConfigurationTarget() {
    const options = [];
    for (const folder of this.workspaceService.getWorkspace().folders) {
      options.push({ target: folder, label: folder.name, description: localize("install in workspace folder", "Workspace Folder") });
    }
    if (this.workspaceService.getWorkbenchState() === WorkbenchState.WORKSPACE) {
      if (options.length > 0) {
        options.push({ type: "separator" });
      }
      options.push({ target: ConfigurationTarget.WORKSPACE, label: localize("mcp.target.workspace", "Workspace") });
    }
    if (options.length === 1) {
      return options[0].target;
    }
    const targetPick = await this.quickInputService.pick(options, {
      title: localize("mcp.target.title", "Choose where to install the MCP server")
    });
    return targetPick?.target;
  }
};
InstallInWorkspaceAction = __decorateClass([
  __decorateParam(1, IMcpWorkbenchService),
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, IQuickInputService),
  __decorateParam(4, ITelemetryService),
  __decorateParam(5, IMcpService)
], InstallInWorkspaceAction);
let InstallInRemoteAction = class extends McpServerAction {
  constructor(open, mcpWorkbenchService, environmentService, telemetryService, labelService, mcpService) {
    super("extensions.installRemote", localize("installInRemote", "Install (Remote)"), InstallAction.CLASS, false);
    this.open = open;
    this.mcpWorkbenchService = mcpWorkbenchService;
    this.environmentService = environmentService;
    this.telemetryService = telemetryService;
    this.labelService = labelService;
    this.mcpService = mcpService;
    const remoteLabel = this.labelService.getHostLabel(Schemas.vscodeRemote, this.environmentService.remoteAuthority);
    this.label = localize("installInRemoteLabel", "Install in {0}", remoteLabel);
    this.update();
  }
  static {
    this.CLASS = `${this.LABEL_ACTION_CLASS} prominent install`;
  }
  static {
    this.HIDE = `${this.CLASS} hide`;
  }
  update() {
    this.enabled = false;
    this.class = InstallInRemoteAction.HIDE;
    if (!this.environmentService.remoteAuthority) {
      return;
    }
    if (!this.mcpServer?.gallery && !this.mcpServer?.installable) {
      return;
    }
    if (this.mcpServer.installState !== McpServerInstallState.Uninstalled) {
      if (this.mcpServer.local?.scope === LocalMcpServerScope.RemoteUser) {
        return;
      }
      if (this.mcpWorkbenchService.local.find((mcpServer) => mcpServer.name === this.mcpServer?.name && mcpServer.local?.scope === LocalMcpServerScope.RemoteUser)) {
        return;
      }
    }
    this.class = InstallAction.CLASS;
    this.enabled = this.mcpWorkbenchService.canInstall(this.mcpServer) === true;
  }
  async run() {
    if (!this.mcpServer) {
      return;
    }
    if (this.open) {
      this.mcpWorkbenchService.open(this.mcpServer);
      alert(localize("mcpServerInstallation", "Installing MCP Server {0} started. An editor is now open with more details on this MCP Server", this.mcpServer.label));
    }
    this.telemetryService.publicLog2("mcp:action:install:remote", { name: this.mcpServer.gallery?.name });
    const installed = await this.mcpWorkbenchService.install(this.mcpServer, { target: ConfigurationTarget.USER_REMOTE });
    await startServerByFilter(this.mcpService, (s) => {
      return s.definition.label === installed.name;
    });
  }
};
InstallInRemoteAction = __decorateClass([
  __decorateParam(1, IMcpWorkbenchService),
  __decorateParam(2, IWorkbenchEnvironmentService),
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, ILabelService),
  __decorateParam(5, IMcpService)
], InstallInRemoteAction);
class InstallingLabelAction extends McpServerAction {
  static {
    this.LABEL = localize("installing", "Installing");
  }
  static {
    this.CLASS = `${McpServerAction.LABEL_ACTION_CLASS} install installing`;
  }
  constructor() {
    super("extension.installing", InstallingLabelAction.LABEL, InstallingLabelAction.CLASS, false);
  }
  update() {
    this.class = `${InstallingLabelAction.CLASS}${this.mcpServer && this.mcpServer.installState === McpServerInstallState.Installing ? "" : " hide"}`;
  }
}
let UninstallAction = class extends McpServerAction {
  constructor(mcpWorkbenchService) {
    super("extensions.uninstall", localize("uninstall", "Uninstall"), UninstallAction.CLASS, false);
    this.mcpWorkbenchService = mcpWorkbenchService;
    this.update();
  }
  static {
    this.CLASS = `${this.LABEL_ACTION_CLASS} prominent uninstall`;
  }
  static {
    this.HIDE = `${this.CLASS} hide`;
  }
  update() {
    this.enabled = false;
    this.class = UninstallAction.HIDE;
    if (!this.mcpServer) {
      return;
    }
    if (!this.mcpServer.local) {
      return;
    }
    if (this.mcpServer.installState !== McpServerInstallState.Installed) {
      this.enabled = false;
      return;
    }
    this.class = UninstallAction.CLASS;
    this.enabled = true;
    this.label = localize("uninstall", "Uninstall");
  }
  async run() {
    if (!this.mcpServer) {
      return;
    }
    await this.mcpWorkbenchService.uninstall(this.mcpServer);
  }
};
UninstallAction = __decorateClass([
  __decorateParam(0, IMcpWorkbenchService)
], UninstallAction);
let EnableMcpServerGloballyAction = class extends McpServerAction {
  constructor(mcpService) {
    super(EnableMcpServerGloballyAction.ID, localize("enableGlobally", "Enable"), McpServerAction.LABEL_ACTION_CLASS);
    this.mcpService = mcpService;
    this.tooltip = localize("enableGloballyTooltip", "Enable this MCP server");
    this.update();
  }
  static {
    this.ID = "mcpServer.enableGlobally";
  }
  update() {
    this.enabled = false;
    if (!this.mcpServer?.local) {
      return;
    }
    const server = this.mcpService.servers.get().find((s) => s.definition.id === this.mcpServer?.id);
    if (!server) {
      return;
    }
    const enablement = server.enablement.get();
    this.enabled = isContributionDisabled(enablement);
  }
  async run() {
    if (!this.mcpServer) {
      return;
    }
    this.mcpService.enablementModel.setEnabled(this.mcpServer.id, ContributionEnablementState.EnabledProfile);
  }
};
EnableMcpServerGloballyAction = __decorateClass([
  __decorateParam(0, IMcpService)
], EnableMcpServerGloballyAction);
let EnableMcpServerForWorkspaceAction = class extends McpServerAction {
  constructor(mcpService, workspaceService) {
    super(EnableMcpServerForWorkspaceAction.ID, localize("enableForWorkspace", "Enable (Workspace)"), McpServerAction.LABEL_ACTION_CLASS);
    this.mcpService = mcpService;
    this.workspaceService = workspaceService;
    this.tooltip = localize("enableForWorkspaceTooltip", "Enable this MCP server only in this workspace");
    this.update();
  }
  static {
    this.ID = "mcpServer.enableForWorkspace";
  }
  update() {
    this.enabled = false;
    if (!this.mcpServer?.local) {
      return;
    }
    if (this.workspaceService.getWorkbenchState() === WorkbenchState.EMPTY) {
      return;
    }
    const server = this.mcpService.servers.get().find((s) => s.definition.id === this.mcpServer?.id);
    if (!server) {
      return;
    }
    const enablement = server.enablement.get();
    this.enabled = isContributionDisabled(enablement);
  }
  async run() {
    if (!this.mcpServer) {
      return;
    }
    this.mcpService.enablementModel.setEnabled(this.mcpServer.id, ContributionEnablementState.EnabledWorkspace);
  }
};
EnableMcpServerForWorkspaceAction = __decorateClass([
  __decorateParam(0, IMcpService),
  __decorateParam(1, IWorkspaceContextService)
], EnableMcpServerForWorkspaceAction);
let DisableMcpServerGloballyAction = class extends McpServerAction {
  constructor(mcpService) {
    super(DisableMcpServerGloballyAction.ID, localize("disableGlobally", "Disable"), McpServerAction.LABEL_ACTION_CLASS);
    this.mcpService = mcpService;
    this.tooltip = localize("disableGloballyTooltip", "Disable this MCP server");
    this.update();
  }
  static {
    this.ID = "mcpServer.disableGlobally";
  }
  update() {
    this.enabled = false;
    if (!this.mcpServer?.local) {
      return;
    }
    const server = this.mcpService.servers.get().find((s) => s.definition.id === this.mcpServer?.id);
    if (!server) {
      return;
    }
    const enablement = server.enablement.get();
    this.enabled = isContributionEnabled(enablement);
  }
  async run() {
    if (!this.mcpServer) {
      return;
    }
    this.mcpService.enablementModel.setEnabled(this.mcpServer.id, ContributionEnablementState.DisabledProfile);
  }
};
DisableMcpServerGloballyAction = __decorateClass([
  __decorateParam(0, IMcpService)
], DisableMcpServerGloballyAction);
let DisableMcpServerForWorkspaceAction = class extends McpServerAction {
  constructor(mcpService, workspaceService) {
    super(DisableMcpServerForWorkspaceAction.ID, localize("disableForWorkspace", "Disable (Workspace)"), McpServerAction.LABEL_ACTION_CLASS);
    this.mcpService = mcpService;
    this.workspaceService = workspaceService;
    this.tooltip = localize("disableForWorkspaceTooltip", "Disable this MCP server only in this workspace");
    this.update();
  }
  static {
    this.ID = "mcpServer.disableForWorkspace";
  }
  update() {
    this.enabled = false;
    if (!this.mcpServer?.local) {
      return;
    }
    if (this.workspaceService.getWorkbenchState() === WorkbenchState.EMPTY) {
      return;
    }
    const server = this.mcpService.servers.get().find((s) => s.definition.id === this.mcpServer?.id);
    if (!server) {
      return;
    }
    const enablement = server.enablement.get();
    this.enabled = isContributionEnabled(enablement);
  }
  async run() {
    if (!this.mcpServer) {
      return;
    }
    this.mcpService.enablementModel.setEnabled(this.mcpServer.id, ContributionEnablementState.DisabledWorkspace);
  }
};
DisableMcpServerForWorkspaceAction = __decorateClass([
  __decorateParam(0, IMcpService),
  __decorateParam(1, IWorkspaceContextService)
], DisableMcpServerForWorkspaceAction);
let EnableMcpDropDownAction = class extends ButtonWithDropDownExtensionAction {
  constructor(instantiationService) {
    super("mcpServer.enable", McpServerAction.LABEL_ACTION_CLASS, [
      [
        instantiationService.createInstance(EnableMcpServerGloballyAction),
        instantiationService.createInstance(EnableMcpServerForWorkspaceAction)
      ]
    ]);
  }
};
EnableMcpDropDownAction = __decorateClass([
  __decorateParam(0, IInstantiationService)
], EnableMcpDropDownAction);
let DisableMcpDropDownAction = class extends ButtonWithDropDownExtensionAction {
  constructor(instantiationService) {
    super("mcpServer.disable", McpServerAction.LABEL_ACTION_CLASS, [
      [
        instantiationService.createInstance(DisableMcpServerGloballyAction),
        instantiationService.createInstance(DisableMcpServerForWorkspaceAction)
      ]
    ]);
  }
};
DisableMcpDropDownAction = __decorateClass([
  __decorateParam(0, IInstantiationService)
], DisableMcpDropDownAction);
function getContextMenuActions(mcpServer, isEditorAction, instantiationService) {
  return instantiationService.invokeFunction((accessor) => {
    const workspaceService = accessor.get(IWorkspaceContextService);
    const environmentService = accessor.get(IWorkbenchEnvironmentService);
    const groups = [];
    const isInstalled = mcpServer.installState === McpServerInstallState.Installed;
    if (isInstalled) {
      groups.push([
        instantiationService.createInstance(StartServerAction)
      ]);
      groups.push([
        instantiationService.createInstance(StopServerAction),
        instantiationService.createInstance(RestartServerAction)
      ]);
      groups.push([
        instantiationService.createInstance(EnableMcpServerGloballyAction),
        instantiationService.createInstance(EnableMcpServerForWorkspaceAction),
        instantiationService.createInstance(DisableMcpServerGloballyAction),
        instantiationService.createInstance(DisableMcpServerForWorkspaceAction)
      ]);
      groups.push([
        instantiationService.createInstance(AuthServerAction)
      ]);
      groups.push([
        instantiationService.createInstance(ShowServerOutputAction),
        instantiationService.createInstance(ShowServerConfigurationAction),
        instantiationService.createInstance(ShowServerJsonConfigurationAction)
      ]);
      groups.push([
        instantiationService.createInstance(ConfigureModelAccessAction),
        instantiationService.createInstance(ShowSamplingRequestsAction)
      ]);
      groups.push([
        instantiationService.createInstance(BrowseResourcesAction)
      ]);
      if (!isEditorAction) {
        const installGroup = [instantiationService.createInstance(UninstallAction)];
        if (workspaceService.getWorkbenchState() !== WorkbenchState.EMPTY) {
          installGroup.push(instantiationService.createInstance(InstallInWorkspaceAction, false));
        }
        if (environmentService.remoteAuthority && mcpServer.local?.scope !== LocalMcpServerScope.RemoteUser) {
          installGroup.push(instantiationService.createInstance(InstallInRemoteAction, false));
        }
        groups.push(installGroup);
      }
    } else {
      const installGroup = [];
      if (workspaceService.getWorkbenchState() !== WorkbenchState.EMPTY) {
        installGroup.push(instantiationService.createInstance(InstallInWorkspaceAction, !isEditorAction));
      }
      if (environmentService.remoteAuthority) {
        installGroup.push(instantiationService.createInstance(InstallInRemoteAction, !isEditorAction));
      }
      groups.push(installGroup);
    }
    groups.forEach((group) => group.forEach((extensionAction) => extensionAction.mcpServer = mcpServer));
    return groups;
  });
}
let ManageMcpServerAction = class extends DropDownAction {
  constructor(isEditorAction, instantiationService) {
    super(ManageMcpServerAction.ID, "", "", true, instantiationService);
    this.isEditorAction = isEditorAction;
    this.tooltip = localize("manage", "Manage");
    this.update();
  }
  static {
    this.ID = "mcpServer.manage";
  }
  static {
    this.Class = `${McpServerAction.ICON_ACTION_CLASS} manage ` + ThemeIcon.asClassName(manageExtensionIcon);
  }
  static {
    this.HideManageExtensionClass = `${this.Class} hide`;
  }
  async run() {
    return super.run(this.mcpServer ? getContextMenuActions(this.mcpServer, this.isEditorAction, this.instantiationService) : []);
  }
  update() {
    this.class = ManageMcpServerAction.HideManageExtensionClass;
    this.enabled = false;
    if (!this.mcpServer) {
      return;
    }
    if (this.isEditorAction) {
      this.enabled = true;
      this.class = ManageMcpServerAction.Class;
    } else {
      this.enabled = !!this.mcpServer.local;
      this.class = this.enabled ? ManageMcpServerAction.Class : ManageMcpServerAction.HideManageExtensionClass;
    }
  }
};
ManageMcpServerAction = __decorateClass([
  __decorateParam(1, IInstantiationService)
], ManageMcpServerAction);
let StartServerAction = class extends McpServerAction {
  constructor(mcpService) {
    super("extensions.start", localize("start", "Start Server"), StartServerAction.CLASS, false);
    this.mcpService = mcpService;
    this.update();
  }
  static {
    this.CLASS = `${this.LABEL_ACTION_CLASS} prominent start`;
  }
  static {
    this.HIDE = `${this.CLASS} hide`;
  }
  update() {
    this.enabled = false;
    this.class = StartServerAction.HIDE;
    const server = this.getServer();
    if (!server) {
      return;
    }
    const serverState = server.connectionState.get();
    if (!McpConnectionState.canBeStarted(serverState.state)) {
      return;
    }
    this.class = StartServerAction.CLASS;
    this.enabled = true;
    this.label = localize("start", "Start Server");
  }
  async run() {
    const server = this.getServer();
    if (!server) {
      return;
    }
    await server.start({ promptType: "all-untrusted" });
    server.showOutput();
  }
  getServer() {
    if (!this.mcpServer) {
      return;
    }
    if (!this.mcpServer.local) {
      return;
    }
    return this.mcpService.servers.get().find((s) => s.definition.id === this.mcpServer?.id);
  }
};
StartServerAction = __decorateClass([
  __decorateParam(0, IMcpService)
], StartServerAction);
let StopServerAction = class extends McpServerAction {
  constructor(mcpService) {
    super("extensions.stop", localize("stop", "Stop Server"), StopServerAction.CLASS, false);
    this.mcpService = mcpService;
    this.update();
  }
  static {
    this.CLASS = `${this.LABEL_ACTION_CLASS} prominent stop`;
  }
  static {
    this.HIDE = `${this.CLASS} hide`;
  }
  update() {
    this.enabled = false;
    this.class = StopServerAction.HIDE;
    const server = this.getServer();
    if (!server) {
      return;
    }
    const serverState = server.connectionState.get();
    if (McpConnectionState.canBeStarted(serverState.state)) {
      return;
    }
    this.class = StopServerAction.CLASS;
    this.enabled = true;
    this.label = localize("stop", "Stop Server");
  }
  async run() {
    const server = this.getServer();
    if (!server) {
      return;
    }
    await server.stop();
  }
  getServer() {
    if (!this.mcpServer) {
      return;
    }
    if (!this.mcpServer.local) {
      return;
    }
    return this.mcpService.servers.get().find((s) => s.definition.id === this.mcpServer?.id);
  }
};
StopServerAction = __decorateClass([
  __decorateParam(0, IMcpService)
], StopServerAction);
let RestartServerAction = class extends McpServerAction {
  constructor(mcpService) {
    super("extensions.restart", localize("restart", "Restart Server"), RestartServerAction.CLASS, false);
    this.mcpService = mcpService;
    this.update();
  }
  static {
    this.CLASS = `${this.LABEL_ACTION_CLASS} prominent restart`;
  }
  static {
    this.HIDE = `${this.CLASS} hide`;
  }
  update() {
    this.enabled = false;
    this.class = RestartServerAction.HIDE;
    const server = this.getServer();
    if (!server) {
      return;
    }
    const serverState = server.connectionState.get();
    if (McpConnectionState.canBeStarted(serverState.state)) {
      return;
    }
    this.class = RestartServerAction.CLASS;
    this.enabled = true;
    this.label = localize("restart", "Restart Server");
  }
  async run() {
    const server = this.getServer();
    if (!server) {
      return;
    }
    await server.stop();
    await server.start({ promptType: "all-untrusted" });
    server.showOutput();
  }
  getServer() {
    if (!this.mcpServer) {
      return;
    }
    if (!this.mcpServer.local) {
      return;
    }
    return this.mcpService.servers.get().find((s) => s.definition.id === this.mcpServer?.id);
  }
};
RestartServerAction = __decorateClass([
  __decorateParam(0, IMcpService)
], RestartServerAction);
let AuthServerAction = class extends McpServerAction {
  constructor(mcpService, _authenticationQueryService, _authenticationService) {
    super("extensions.restart", localize("restart", "Restart Server"), RestartServerAction.CLASS, false);
    this.mcpService = mcpService;
    this._authenticationQueryService = _authenticationQueryService;
    this._authenticationService = _authenticationService;
    this.update();
  }
  static {
    this.CLASS = `${this.LABEL_ACTION_CLASS} prominent account`;
  }
  static {
    this.HIDE = `${this.CLASS} hide`;
  }
  static {
    this.SIGN_OUT = localize("mcp.signOut", "Sign Out");
  }
  static {
    this.DISCONNECT = localize("mcp.disconnect", "Disconnect Account");
  }
  update() {
    this.enabled = false;
    this.class = AuthServerAction.HIDE;
    const server = this.getServer();
    if (!server) {
      return;
    }
    const accountQuery = this.getAccountQuery();
    if (!accountQuery) {
      return;
    }
    this._accountQuery = accountQuery;
    this.class = AuthServerAction.CLASS;
    this.enabled = true;
    let label = accountQuery.entities().getEntityCount().total > 1 ? AuthServerAction.DISCONNECT : AuthServerAction.SIGN_OUT;
    label += ` (${accountQuery.accountName})`;
    this.label = label;
  }
  async run() {
    const server = this.getServer();
    if (!server) {
      return;
    }
    const accountQuery = this.getAccountQuery();
    if (!accountQuery) {
      return;
    }
    await server.stop();
    const { providerId, accountName } = accountQuery;
    accountQuery.mcpServer(server.definition.id).setAccessAllowed(false, server.definition.label);
    if (this.label === AuthServerAction.SIGN_OUT) {
      const accounts = await this._authenticationService.getAccounts(providerId);
      const account = accounts.find((a) => a.label === accountName);
      if (account) {
        const sessions = await this._authenticationService.getSessions(providerId, void 0, { account });
        for (const session of sessions) {
          await this._authenticationService.removeSession(providerId, session.id);
        }
      }
    }
  }
  getServer() {
    if (!this.mcpServer) {
      return;
    }
    if (!this.mcpServer.local) {
      return;
    }
    return this.mcpService.servers.get().find((s) => s.definition.id === this.mcpServer?.id);
  }
  getAccountQuery() {
    const server = this.getServer();
    if (!server) {
      return void 0;
    }
    if (this._accountQuery) {
      return this._accountQuery;
    }
    const serverId = server.definition.id;
    const preferences = this._authenticationQueryService.mcpServer(serverId).getAllAccountPreferences();
    if (!preferences.size) {
      return void 0;
    }
    for (const [providerId, accountName] of preferences) {
      const accountQuery = this._authenticationQueryService.provider(providerId).account(accountName);
      if (!accountQuery.mcpServer(serverId).isAccessAllowed()) {
        continue;
      }
      return accountQuery;
    }
    return void 0;
  }
};
AuthServerAction = __decorateClass([
  __decorateParam(0, IMcpService),
  __decorateParam(1, IAuthenticationQueryService),
  __decorateParam(2, IAuthenticationService)
], AuthServerAction);
let ShowServerOutputAction = class extends McpServerAction {
  constructor(mcpService) {
    super("extensions.output", localize("output", "Show Output"), ShowServerOutputAction.CLASS, false);
    this.mcpService = mcpService;
    this.update();
  }
  static {
    this.CLASS = `${this.LABEL_ACTION_CLASS} prominent output`;
  }
  static {
    this.HIDE = `${this.CLASS} hide`;
  }
  update() {
    this.enabled = false;
    this.class = ShowServerOutputAction.HIDE;
    const server = this.getServer();
    if (!server) {
      return;
    }
    this.class = ShowServerOutputAction.CLASS;
    this.enabled = true;
    this.label = localize("output", "Show Output");
  }
  async run() {
    const server = this.getServer();
    if (!server) {
      return;
    }
    server.showOutput();
  }
  getServer() {
    if (!this.mcpServer) {
      return;
    }
    if (!this.mcpServer.local) {
      return;
    }
    return this.mcpService.servers.get().find((s) => s.definition.id === this.mcpServer?.id);
  }
};
ShowServerOutputAction = __decorateClass([
  __decorateParam(0, IMcpService)
], ShowServerOutputAction);
let ShowServerConfigurationAction = class extends McpServerAction {
  constructor(mcpWorkbenchService) {
    super("extensions.config", localize("config", "Show Configuration"), ShowServerConfigurationAction.CLASS, false);
    this.mcpWorkbenchService = mcpWorkbenchService;
    this.update();
  }
  static {
    this.CLASS = `${this.LABEL_ACTION_CLASS} prominent config`;
  }
  static {
    this.HIDE = `${this.CLASS} hide`;
  }
  update() {
    this.enabled = false;
    this.class = ShowServerConfigurationAction.HIDE;
    if (!this.mcpServer?.local) {
      return;
    }
    this.class = ShowServerConfigurationAction.CLASS;
    this.enabled = true;
  }
  async run() {
    if (!this.mcpServer?.local) {
      return;
    }
    this.mcpWorkbenchService.open(this.mcpServer, { tab: McpServerEditorTab.Configuration });
  }
};
ShowServerConfigurationAction = __decorateClass([
  __decorateParam(0, IMcpWorkbenchService)
], ShowServerConfigurationAction);
let ShowServerJsonConfigurationAction = class extends McpServerAction {
  constructor(mcpService, mcpRegistry, editorService) {
    super("extensions.jsonConfig", localize("configJson", "Show Configuration (JSON)"), ShowServerJsonConfigurationAction.CLASS, false);
    this.mcpService = mcpService;
    this.mcpRegistry = mcpRegistry;
    this.editorService = editorService;
    this.update();
  }
  static {
    this.CLASS = `${this.LABEL_ACTION_CLASS} prominent config`;
  }
  static {
    this.HIDE = `${this.CLASS} hide`;
  }
  update() {
    this.enabled = false;
    this.class = ShowServerJsonConfigurationAction.HIDE;
    const configurationTarget = this.getConfigurationTarget();
    if (!configurationTarget) {
      return;
    }
    this.class = ShowServerConfigurationAction.CLASS;
    this.enabled = true;
  }
  async run() {
    const configurationTarget = this.getConfigurationTarget();
    if (!configurationTarget) {
      return;
    }
    this.editorService.openEditor({
      resource: URI.isUri(configurationTarget) ? configurationTarget : configurationTarget.uri,
      options: { selection: URI.isUri(configurationTarget) ? void 0 : configurationTarget.range }
    });
  }
  getConfigurationTarget() {
    if (!this.mcpServer) {
      return;
    }
    if (!this.mcpServer.local) {
      return;
    }
    const server = this.mcpService.servers.get().find((s) => s.definition.label === this.mcpServer?.name);
    if (!server) {
      return;
    }
    const collection = this.mcpRegistry.collections.get().find((c) => c.id === server.collection.id);
    const serverDefinition = collection?.serverDefinitions.get().find((s) => s.id === server.definition.id);
    return serverDefinition?.presentation?.origin || collection?.presentation?.origin;
  }
};
ShowServerJsonConfigurationAction = __decorateClass([
  __decorateParam(0, IMcpService),
  __decorateParam(1, IMcpRegistry),
  __decorateParam(2, IEditorService)
], ShowServerJsonConfigurationAction);
let ConfigureModelAccessAction = class extends McpServerAction {
  constructor(mcpService, commandService) {
    super("extensions.config", localize("mcp.configAccess", "Configure Model Access"), ConfigureModelAccessAction.CLASS, false);
    this.mcpService = mcpService;
    this.commandService = commandService;
    this.update();
  }
  static {
    this.CLASS = `${this.LABEL_ACTION_CLASS} prominent config`;
  }
  static {
    this.HIDE = `${this.CLASS} hide`;
  }
  update() {
    this.enabled = false;
    this.class = ConfigureModelAccessAction.HIDE;
    const server = this.getServer();
    if (!server) {
      return;
    }
    this.class = ConfigureModelAccessAction.CLASS;
    this.enabled = true;
    this.label = localize("mcp.configAccess", "Configure Model Access");
  }
  async run() {
    const server = this.getServer();
    if (!server) {
      return;
    }
    this.commandService.executeCommand(McpCommandIds.ConfigureSamplingModels, server);
  }
  getServer() {
    if (!this.mcpServer) {
      return;
    }
    if (!this.mcpServer.local) {
      return;
    }
    return this.mcpService.servers.get().find((s) => s.definition.id === this.mcpServer?.id);
  }
};
ConfigureModelAccessAction = __decorateClass([
  __decorateParam(0, IMcpService),
  __decorateParam(1, ICommandService)
], ConfigureModelAccessAction);
let ShowSamplingRequestsAction = class extends McpServerAction {
  constructor(mcpService, samplingService, editorService) {
    super("extensions.config", localize("mcp.samplingLog", "Show Sampling Requests"), ShowSamplingRequestsAction.CLASS, false);
    this.mcpService = mcpService;
    this.samplingService = samplingService;
    this.editorService = editorService;
    this.update();
  }
  static {
    this.CLASS = `${this.LABEL_ACTION_CLASS} prominent config`;
  }
  static {
    this.HIDE = `${this.CLASS} hide`;
  }
  update() {
    this.enabled = false;
    this.class = ShowSamplingRequestsAction.HIDE;
    const server = this.getServer();
    if (!server) {
      return;
    }
    if (!this.samplingService.hasLogs(server)) {
      return;
    }
    this.class = ShowSamplingRequestsAction.CLASS;
    this.enabled = true;
  }
  async run() {
    const server = this.getServer();
    if (!server) {
      return;
    }
    if (!this.samplingService.hasLogs(server)) {
      return;
    }
    this.editorService.openEditor({
      resource: void 0,
      contents: this.samplingService.getLogText(server),
      label: localize("mcp.samplingLog.title", "MCP Sampling: {0}", server.definition.label)
    });
  }
  getServer() {
    if (!this.mcpServer) {
      return;
    }
    if (!this.mcpServer.local) {
      return;
    }
    return this.mcpService.servers.get().find((s) => s.definition.id === this.mcpServer?.id);
  }
};
ShowSamplingRequestsAction = __decorateClass([
  __decorateParam(0, IMcpService),
  __decorateParam(1, IMcpSamplingService),
  __decorateParam(2, IEditorService)
], ShowSamplingRequestsAction);
let BrowseResourcesAction = class extends McpServerAction {
  constructor(mcpService, commandService) {
    super("extensions.config", localize("mcp.resources", "Browse Resources"), BrowseResourcesAction.CLASS, false);
    this.mcpService = mcpService;
    this.commandService = commandService;
    this.update();
  }
  static {
    this.CLASS = `${this.LABEL_ACTION_CLASS} prominent config`;
  }
  static {
    this.HIDE = `${this.CLASS} hide`;
  }
  update() {
    this.enabled = false;
    this.class = BrowseResourcesAction.HIDE;
    const server = this.getServer();
    if (!server) {
      return;
    }
    const capabilities = server.capabilities.get();
    if (capabilities !== void 0 && !(capabilities & McpCapability.Resources)) {
      return;
    }
    this.class = BrowseResourcesAction.CLASS;
    this.enabled = true;
  }
  async run() {
    const server = this.getServer();
    if (!server) {
      return;
    }
    const capabilities = server.capabilities.get();
    if (capabilities !== void 0 && !(capabilities & McpCapability.Resources)) {
      return;
    }
    return this.commandService.executeCommand(McpCommandIds.BrowseResources, server);
  }
  getServer() {
    if (!this.mcpServer) {
      return;
    }
    if (!this.mcpServer.local) {
      return;
    }
    return this.mcpService.servers.get().find((s) => s.definition.id === this.mcpServer?.id);
  }
};
BrowseResourcesAction = __decorateClass([
  __decorateParam(0, IMcpService),
  __decorateParam(1, ICommandService)
], BrowseResourcesAction);
let McpServerStatusAction = class extends McpServerAction {
  constructor(mcpWorkbenchService, commandService) {
    super("extensions.status", "", `${McpServerStatusAction.CLASS} hide`, false);
    this.mcpWorkbenchService = mcpWorkbenchService;
    this.commandService = commandService;
    this._status = [];
    this._onDidChangeStatus = this._register(new Emitter());
    this.onDidChangeStatus = this._onDidChangeStatus.event;
    this.update();
  }
  static {
    this.CLASS = `${McpServerAction.ICON_ACTION_CLASS} extension-status`;
  }
  get status() {
    return this._status;
  }
  update() {
    this.computeAndUpdateStatus();
  }
  computeAndUpdateStatus() {
    this.updateStatus(void 0, true);
    this.enabled = false;
    if (!this.mcpServer) {
      return;
    }
    if ((this.mcpServer.gallery || this.mcpServer.installable) && this.mcpServer.installState === McpServerInstallState.Uninstalled) {
      const result = this.mcpWorkbenchService.canInstall(this.mcpServer);
      if (result !== true) {
        this.updateStatus({ icon: warningIcon, message: result }, true);
        return;
      }
    }
    const runtimeState = this.mcpServer.runtimeStatus;
    if (runtimeState?.message) {
      this.updateStatus({ icon: runtimeState.message.severity === Severity.Warning ? warningIcon : runtimeState.message.severity === Severity.Error ? errorIcon : infoIcon, message: runtimeState.message.text }, true);
    }
  }
  updateStatus(status, updateClass) {
    if (status) {
      if (this._status.some((s) => s.message.value === status.message.value && s.icon?.id === status.icon?.id)) {
        return;
      }
    } else {
      if (this._status.length === 0) {
        return;
      }
      this._status = [];
    }
    if (status) {
      this._status.push(status);
      this._status.sort(
        (a, b) => b.icon === trustIcon ? -1 : a.icon === trustIcon ? 1 : b.icon === errorIcon ? -1 : a.icon === errorIcon ? 1 : b.icon === warningIcon ? -1 : a.icon === warningIcon ? 1 : b.icon === infoIcon ? -1 : a.icon === infoIcon ? 1 : 0
      );
    }
    if (updateClass) {
      if (status?.icon === errorIcon) {
        this.class = `${McpServerStatusAction.CLASS} extension-status-error ${ThemeIcon.asClassName(errorIcon)}`;
      } else if (status?.icon === warningIcon) {
        this.class = `${McpServerStatusAction.CLASS} extension-status-warning ${ThemeIcon.asClassName(warningIcon)}`;
      } else if (status?.icon === infoIcon) {
        this.class = `${McpServerStatusAction.CLASS} extension-status-info ${ThemeIcon.asClassName(infoIcon)}`;
      } else if (status?.icon === trustIcon) {
        this.class = `${McpServerStatusAction.CLASS} ${ThemeIcon.asClassName(trustIcon)}`;
      } else {
        this.class = `${McpServerStatusAction.CLASS} hide`;
      }
    }
    this._onDidChangeStatus.fire();
  }
  async run() {
    if (this._status[0]?.icon === trustIcon) {
      return this.commandService.executeCommand("workbench.trust.manage");
    }
  }
};
McpServerStatusAction = __decorateClass([
  __decorateParam(0, IMcpWorkbenchService),
  __decorateParam(1, ICommandService)
], McpServerStatusAction);
export {
  AuthServerAction,
  BrowseResourcesAction,
  ButtonWithDropDownExtensionAction,
  ButtonWithDropdownExtensionActionViewItem,
  ConfigureModelAccessAction,
  DisableMcpDropDownAction,
  DisableMcpServerForWorkspaceAction,
  DisableMcpServerGloballyAction,
  DropDownAction,
  DropDownExtensionActionViewItem,
  EnableMcpDropDownAction,
  EnableMcpServerForWorkspaceAction,
  EnableMcpServerGloballyAction,
  InstallAction,
  InstallInRemoteAction,
  InstallInWorkspaceAction,
  InstallingLabelAction,
  ManageMcpServerAction,
  McpServerAction,
  McpServerStatusAction,
  RestartServerAction,
  ShowSamplingRequestsAction,
  ShowServerConfigurationAction,
  ShowServerJsonConfigurationAction,
  ShowServerOutputAction,
  StartServerAction,
  StopServerAction,
  UninstallAction,
  getContextMenuActions
};
