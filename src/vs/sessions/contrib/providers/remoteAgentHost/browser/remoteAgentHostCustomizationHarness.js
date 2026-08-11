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
import { Codicon } from "../../../../../base/common/codicons.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { basename } from "../../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { localize } from "../../../../../nls.js";
import { AgentHostConfigKey, getAgentHostConfiguredCustomizations } from "../../../../../platform/agentHost/common/agentHostCustomizationConfig.js";
import { agentHostUri } from "../../../../../platform/agentHost/common/agentHostFileSystemProvider.js";
import { AGENT_HOST_SCHEME, fromAgentHostUri } from "../../../../../platform/agentHost/common/agentHostUri.js";
import { ActionType } from "../../../../../platform/agentHost/common/state/sessionActions.js";
import { ROOT_STATE_URI, customizationId } from "../../../../../platform/agentHost/common/state/sessionState.js";
import { IFileDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { AICustomizationManagementSection, IAICustomizationWorkspaceService } from "../../../../../workbench/contrib/chat/common/aiCustomizationWorkspaceService.js";
import { CustomizationType } from "../../../../../platform/agentHost/common/state/protocol/state.js";
function customizationKey(customization) {
  return customization.uri;
}
let RemoteAgentPluginController = class extends Disposable {
  constructor(_hostLabel, _connectionAuthority, _connection, _fileDialogService, _notificationService, _workspaceService) {
    super();
    this._hostLabel = _hostLabel;
    this._connectionAuthority = _connectionAuthority;
    this._connection = _connection;
    this._fileDialogService = _fileDialogService;
    this._notificationService = _notificationService;
    this.pluginActions = [
      {
        id: "remoteAgentHost.addPlugin",
        label: localize("remoteAgentHost.addPlugin", "Add Remote Plugin"),
        tooltip: localize("remoteAgentHost.addPluginTooltip", "Add a plugin folder that already exists on this remote agent host."),
        icon: Codicon.remote,
        run: () => this.addConfiguredPlugin()
      }
    ];
  }
  async removeConfiguredPlugin(customizationToRemove) {
    const updated = this.getConfiguredCustomizations().filter((customization) => customizationKey(customization) !== customizationKey(customizationToRemove));
    this.dispatchCustomizations(updated);
  }
  getConfiguredCustomizations() {
    const rootState = this._connection.rootState.value;
    if (!rootState || rootState instanceof Error) {
      return [];
    }
    return getAgentHostConfiguredCustomizations(rootState.config?.values);
  }
  dispatchCustomizations(customizations) {
    this._connection.dispatch(ROOT_STATE_URI, {
      type: ActionType.RootConfigChanged,
      config: {
        [AgentHostConfigKey.Customizations]: customizations.map((c) => ({
          uri: c.uri,
          displayName: c.name
        }))
      }
    });
  }
  async pickRemotePluginFolder(title) {
    try {
      const selected = await this._fileDialogService.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        title,
        availableFileSystems: [AGENT_HOST_SCHEME],
        defaultUri: agentHostUri(this._connectionAuthority, "/")
      });
      return selected?.[0];
    } catch {
      return void 0;
    }
  }
  async addConfiguredPlugin() {
    const selected = await this.pickRemotePluginFolder(localize("remoteAgentHost.selectPluginFolder", "Select Plugin Folder on {0}", this._hostLabel));
    if (!selected) {
      return;
    }
    const original = fromAgentHostUri(selected);
    const uriString = original.toString();
    const newCustomization = {
      type: CustomizationType.Plugin,
      id: customizationId(uriString),
      uri: uriString,
      name: basename(original) || original.path,
      enabled: true
    };
    const current = this.getConfiguredCustomizations();
    const nextKey = customizationKey(newCustomization);
    if (current.some((customization) => customizationKey(customization) === nextKey)) {
      this._notificationService.info(localize(
        "remoteAgentHost.pluginAlreadyConfigured",
        "'{0}' is already configured on {1}.",
        newCustomization.name,
        this._hostLabel
      ));
      return;
    }
    this.dispatchCustomizations([...current, newCustomization]);
  }
};
RemoteAgentPluginController = __decorateClass([
  __decorateParam(3, IFileDialogService),
  __decorateParam(4, INotificationService),
  __decorateParam(5, IAICustomizationWorkspaceService)
], RemoteAgentPluginController);
function createRemoteAgentHarnessDescriptor(harnessId, displayName, controller, itemProvider, syncProvider) {
  return {
    id: harnessId,
    label: displayName,
    icon: ThemeIcon.fromId(Codicon.remote.id),
    hiddenSections: [
      AICustomizationManagementSection.Models,
      AICustomizationManagementSection.McpServers
    ],
    hideGenerateButton: true,
    itemProvider,
    syncProvider,
    pluginActions: controller.pluginActions
  };
}
export {
  RemoteAgentPluginController,
  createRemoteAgentHarnessDescriptor
};
