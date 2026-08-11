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
import { localize } from "../../../../nls.js";
import { IActionWidgetService } from "../../../../platform/actionWidget/browser/actionWidget.js";
import { ActionListItemKind } from "../../../../platform/actionWidget/browser/actionList.js";
import { IMenuService } from "../../../../platform/actions/common/actions.js";
import { IRemoteAgentHostService } from "../../../../platform/agentHost/common/remoteAgentHostService.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IWorkbenchLayoutService } from "../../../../workbench/services/layout/browser/layoutService.js";
import { ISessionsProvidersService } from "../../../services/sessions/browser/sessionsProvidersService.js";
import { ISessionsRecentWorkspacesService, isWorktreeWorkspaceUri } from "../../../services/sessions/browser/sessionsRecentWorkspacesService.js";
import { IAgentHostFilterService } from "../../../services/agentHostFilter/common/agentHostFilter.js";
import { WorkspacePicker } from "./sessionWorkspacePicker.js";
import { showMobileWorkspacePickerSheet, shouldUseMobileWorkspacePickerSheet } from "./mobile/mobileWorkspacePickerSheet.js";
let WebWorkspacePicker = class extends WorkspacePicker {
  constructor(options, actionWidgetService, uriIdentityService, sessionsProvidersService, recentWorkspacesService, remoteAgentHostService, configurationService, commandService, menuService, contextKeyService, instantiationService, fileDialogService, telemetryService, notificationService, _agentHostFilterService, _layoutService) {
    super(
      options,
      actionWidgetService,
      uriIdentityService,
      sessionsProvidersService,
      recentWorkspacesService,
      remoteAgentHostService,
      configurationService,
      commandService,
      menuService,
      contextKeyService,
      instantiationService,
      fileDialogService,
      telemetryService,
      notificationService
    );
    this._agentHostFilterService = _agentHostFilterService;
    this._layoutService = _layoutService;
    this._register(this._agentHostFilterService.onDidChange(() => this._onScopedHostChanged()));
  }
  _showTabs() {
    return false;
  }
  showPicker() {
    if (!this._triggerElement) {
      return;
    }
    if (!shouldUseMobileWorkspacePickerSheet(this._layoutService)) {
      super.showPicker();
      return;
    }
    const items = this._buildItems();
    showMobileWorkspacePickerSheet(
      this._layoutService,
      this._triggerElement,
      items,
      (item) => this._dispatchPickerItem(item),
      this._getAllBrowseActions()
    );
  }
  _onScopedHostChanged() {
    const scopedProviderId = this._agentHostFilterService.selectedProviderId;
    const currentResolved = this.selectedResolved;
    if (currentResolved && scopedProviderId !== void 0 && currentResolved.providerId === scopedProviderId) {
      this._onDidChangeSelection.fire();
      return;
    }
    const firstRecent = scopedProviderId !== void 0 ? this._getRecentWorkspaces().find((w) => {
      const folderUri = w.workspace.folders[0]?.root;
      return w.providerId === scopedProviderId && !!folderUri && !isWorktreeWorkspaceUri(folderUri);
    }) : void 0;
    if (firstRecent) {
      const folderUri = firstRecent.workspace.folders[0]?.root;
      if (folderUri) {
        this.setSelectedWorkspace(folderUri);
        return;
      }
    }
    this.clearSelection();
    this._onDidSelectWorkspace.fire(void 0);
  }
  _buildItems() {
    const items = [];
    const scopedProviderId = this._agentHostFilterService.selectedProviderId;
    if (scopedProviderId === void 0) {
      return [];
    }
    const provider = this.sessionsProvidersService.getProvider(scopedProviderId);
    if (!provider) {
      return items;
    }
    const recents = this._getRecentWorkspaces().filter((w) => w.providerId === scopedProviderId);
    for (const { workspace, providerId } of recents) {
      const folderUri = workspace.folders[0]?.root;
      if (!folderUri) {
        continue;
      }
      const checked = this._isSelectedFolder(folderUri);
      items.push({
        kind: ActionListItemKind.Action,
        label: workspace.label,
        description: workspace.description,
        group: { title: "", icon: workspace.icon },
        item: { folderUri, providerId, checked: checked || void 0 },
        onRemove: () => this._removeRecentWorkspace(folderUri)
      });
    }
    const allBrowseActions = this._getAllBrowseActions();
    const browseIndex = allBrowseActions.findIndex((a) => a.providerId === scopedProviderId);
    if (browseIndex >= 0 && !this._isProviderUnavailable(scopedProviderId)) {
      if (items.length > 0) {
        items.push({ kind: ActionListItemKind.Separator, label: "" });
      }
      items.push({
        kind: ActionListItemKind.Action,
        label: localize("scopedWorkspacePicker.selectFolder", "Select Folder..."),
        group: { title: "", icon: Codicon.folderOpened },
        item: { browseActionIndex: browseIndex }
      });
    }
    return items;
  }
};
WebWorkspacePicker = __decorateClass([
  __decorateParam(1, IActionWidgetService),
  __decorateParam(2, IUriIdentityService),
  __decorateParam(3, ISessionsProvidersService),
  __decorateParam(4, ISessionsRecentWorkspacesService),
  __decorateParam(5, IRemoteAgentHostService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, ICommandService),
  __decorateParam(8, IMenuService),
  __decorateParam(9, IContextKeyService),
  __decorateParam(10, IInstantiationService),
  __decorateParam(11, IFileDialogService),
  __decorateParam(12, ITelemetryService),
  __decorateParam(13, INotificationService),
  __decorateParam(14, IAgentHostFilterService),
  __decorateParam(15, IWorkbenchLayoutService)
], WebWorkspacePicker);
export {
  WebWorkspacePicker
};
