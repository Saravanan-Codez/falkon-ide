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
import "./media/aiCustomizationManagement.css";
import * as DOM from "../../../../../base/browser/dom.js";
import { Disposable, DisposableStore, isDisposable, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { Emitter } from "../../../../../base/common/event.js";
import { localize } from "../../../../../nls.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { WorkbenchList } from "../../../../../platform/list/browser/listService.js";
import { NotSelectableGroupId } from "../../../../../base/browser/ui/list/list.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Button } from "../../../../../base/browser/ui/button/button.js";
import { defaultButtonStyles, defaultInputBoxStyles } from "../../../../../platform/theme/browser/defaultStyles.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { mcpAccessConfig, McpAccessValue } from "../../../../../platform/mcp/common/mcpManagement.js";
import { IMcpWorkbenchService, McpConnectionState, McpServerInstallState, IMcpService } from "../../../../contrib/mcp/common/mcpTypes.js";
import { IMcpRegistry } from "../../../mcp/common/mcpRegistryTypes.js";
import { MCP_PLUGIN_COLLECTION_ID_PREFIX } from "../../../mcp/common/discovery/pluginMcpDiscovery.js";
import { ExtensionIdentifier } from "../../../../../platform/extensions/common/extensions.js";
import { ContributionEnablementState, isContributionDisabled } from "../../common/enablement.js";
import { McpCommandIds } from "../../../../contrib/mcp/common/mcpCommandIds.js";
import { autorun } from "../../../../../base/common/observable.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { URI } from "../../../../../base/common/uri.js";
import { InputBox } from "../../../../../base/browser/ui/inputbox/inputBox.js";
import { IContextMenuService, IContextViewService } from "../../../../../platform/contextview/browser/contextView.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { Delayer } from "../../../../../base/common/async.js";
import { Action, Separator } from "../../../../../base/common/actions.js";
import { ConfigureModelAccessAction, DisableMcpServerForWorkspaceAction, DisableMcpServerGloballyAction, EnableMcpServerForWorkspaceAction, EnableMcpServerGloballyAction, getContextMenuActions, RestartServerAction, ShowSamplingRequestsAction, StartServerAction, StopServerAction } from "../../../../contrib/mcp/browser/mcpServerActions.js";
import { LocalMcpServerScope } from "../../../../services/mcp/common/mcpWorkbenchManagementService.js";
import { IAgentPluginService } from "../../common/plugins/agentPluginService.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { workspaceIcon, userIcon, mcpServerIcon, builtinIcon, pluginIcon, extensionIcon } from "./aiCustomizationIcons.js";
import { formatDisplayName, truncateToFirstLine } from "./aiCustomizationListWidget.js";
import { getDefaultHoverDelegate } from "../../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { IAICustomizationWorkspaceService } from "../../common/aiCustomizationWorkspaceService.js";
import { CustomizationGroupHeaderRenderer, CUSTOMIZATION_GROUP_HEADER_HEIGHT, CUSTOMIZATION_GROUP_HEADER_HEIGHT_WITH_SEPARATOR } from "./customizationGroupHeaderRenderer.js";
import { AgentPluginItemKind } from "../agentPluginEditor/agentPluginItems.js";
import { ICustomizationHarnessService } from "../../common/customizationHarnessService.js";
import { IAgentHostCustomizationService } from "../agentSessions/agentHost/agentHostCustomizationService.js";
import { McpServerStatus } from "../../../../../platform/agentHost/common/state/protocol/state.js";
import { GalleryItemInstallState, GalleryItemRenderer } from "./galleryItemRenderer.js";
import { IOutputService } from "../../../../services/output/common/output.js";
const $ = DOM.$;
const MCP_ITEM_HEIGHT = 36;
const MCP_ITEM_WITH_DESCRIPTION_HEIGHT = 44;
const PLUGIN_COLLECTION_PREFIX = MCP_PLUGIN_COLLECTION_ID_PREFIX;
const COPILOT_EXTENSION_IDS = ["github.copilot", "github.copilot-chat"];
function isCopilotExtension(id) {
  return COPILOT_EXTENSION_IDS.some((copilotId) => ExtensionIdentifier.equals(id, copilotId));
}
function getPluginUriFromCollectionId(collectionId) {
  return collectionId?.startsWith(PLUGIN_COLLECTION_PREFIX) ? collectionId.slice(PLUGIN_COLLECTION_PREFIX.length) : void 0;
}
function createBuiltinActiveSessionMcpEntries(servers) {
  return servers.map((server) => ({ type: "session-server-item", server }));
}
class McpServerItemDelegate {
  getHeight(element) {
    if (element.type === "group-header") {
      return element.isFirst ? CUSTOMIZATION_GROUP_HEADER_HEIGHT : CUSTOMIZATION_GROUP_HEADER_HEIGHT_WITH_SEPARATOR;
    }
    if (element.type === "server-item" && element.server.gallery && (element.marketplace || !element.server.local)) {
      return 62;
    }
    if (element.type === "server-item" && element.server.description?.trim()) {
      return MCP_ITEM_WITH_DESCRIPTION_HEIGHT;
    }
    if (element.type === "builtin-item" && element.description) {
      return MCP_ITEM_WITH_DESCRIPTION_HEIGHT;
    }
    return MCP_ITEM_HEIGHT;
  }
  getTemplateId(element) {
    if (element.type === "group-header") {
      return "mcpGroupHeader";
    }
    if (element.type === "builtin-item") {
      return "mcpServerItem";
    }
    if (element.type === "session-server-item") {
      return "mcpServerItem";
    }
    const server = element.server;
    return server.gallery && (element.marketplace || !server.local) ? MCP_GALLERY_ITEM_TEMPLATE_ID : "mcpServerItem";
  }
}
let McpServerItemRenderer = class {
  constructor(_afterShowOutput, workspaceService, agentPluginService, hoverService, agentHostCustomizationService, customizationHarnessService, outputService) {
    this._afterShowOutput = _afterShowOutput;
    this.workspaceService = workspaceService;
    this.agentPluginService = agentPluginService;
    this.hoverService = hoverService;
    this.agentHostCustomizationService = agentHostCustomizationService;
    this.customizationHarnessService = customizationHarnessService;
    this.outputService = outputService;
    this.templateId = "mcpServerItem";
  }
  renderTemplate(container) {
    container.classList.add("mcp-server-item");
    const typeIcon = DOM.append(container, $(".mcp-server-icon"));
    typeIcon.classList.add(...ThemeIcon.asClassNameArray(mcpServerIcon));
    const details = DOM.append(container, $(".mcp-server-details"));
    const nameRow = DOM.append(details, $(".mcp-server-name-row"));
    const name = DOM.append(nameRow, $(".mcp-server-name"));
    const description = DOM.append(details, $(".mcp-server-description"));
    const actions = DOM.append(container, $(".mcp-server-actions"));
    return {
      container,
      typeIcon,
      name,
      description,
      actions,
      elementDisposables: new DisposableStore(),
      actionDisposables: new DisposableStore()
    };
  }
  renderElement(element, index, templateData) {
    templateData.elementDisposables.clear();
    templateData.actionDisposables.clear();
    if (element.type === "builtin-item") {
      templateData.container.classList.add("builtin");
      templateData.container.classList.toggle("has-detail", false);
      templateData.name.textContent = formatDisplayName(element.label);
      if (element.description) {
        templateData.description.textContent = truncateToFirstLine(element.description);
        templateData.description.style.display = "";
      } else {
        templateData.description.textContent = "";
        templateData.description.style.display = "none";
      }
      this.updateKnownServerStatus(templateData, element);
      const pluginUriStr = getPluginUriFromCollectionId(element.collectionId);
      if (pluginUriStr) {
        templateData.elementDisposables.add(this.hoverService.setupDelayedHover(templateData.container, () => {
          const plugin = this.agentPluginService.plugins.get().find((p) => p.uri.toString() === pluginUriStr);
          if (plugin) {
            return {
              content: `${element.label}
${localize("fromPlugin", "Plugin: {0}", plugin.label)}`,
              appearance: { compact: true, skipFadeInAnimation: true }
            };
          }
          return { content: element.label, appearance: { compact: true, skipFadeInAnimation: true } };
        }));
      }
      return;
    }
    if (element.type === "session-server-item") {
      templateData.container.classList.remove("builtin");
      templateData.container.classList.toggle("has-detail", false);
      templateData.name.textContent = formatDisplayName(element.server.name);
      templateData.description.textContent = "";
      templateData.description.style.display = "none";
      this.updateActiveSessionStatus(templateData, element);
      return;
    }
    templateData.container.classList.remove("builtin");
    templateData.name.textContent = formatDisplayName(element.server.label);
    const description = element.server.description?.trim();
    const isGallery = !element.server.local;
    const hasDetail = !!description || isGallery;
    templateData.container.classList.toggle("has-detail", hasDetail);
    if (description) {
      templateData.description.textContent = truncateToFirstLine(description);
      templateData.description.style.display = "";
    } else {
      templateData.description.textContent = "";
      templateData.description.style.display = "none";
    }
    if (element.activeSessionServer) {
      this.updateKnownServerStatus(templateData, element);
    } else if (this.workspaceService.isSessionsWindow) {
      this.updateKnownServerStatus(templateData, element);
    } else {
      templateData.elementDisposables.add(autorun((reader) => {
        const disabled = element.localServer ? isContributionDisabled(element.localServer.enablement.read(reader)) : false;
        const connectionState = element.localServer?.connectionState.read(reader);
        templateData.container.classList.toggle("disabled", disabled);
        this.updateStatus(templateData, element, disabled ? "disabled" : connectionState?.state);
      }));
    }
  }
  updateKnownServerStatus(templateData, element) {
    templateData.elementDisposables.add(autorun((reader) => {
      const localDisabled = element.localServer ? isContributionDisabled(element.localServer.enablement.read(reader)) : false;
      const activeSessionServer = element.activeSessionServer;
      templateData.container.classList.toggle("disabled", localDisabled || activeSessionServer?.enabled === false);
      this.updateStatus(templateData, element, localDisabled ? "disabled" : activeSessionServer ? activeSessionServer.enabled ? activeSessionServer.status : "disabled" : void 0);
    }));
  }
  updateActiveSessionStatus(templateData, element) {
    const disabled = element.server.enabled === false;
    templateData.container.classList.toggle("disabled", disabled);
    this.updateStatus(templateData, element, disabled ? "disabled" : element.server.status);
  }
  updateStatus(templateData, element, state) {
    templateData.actionDisposables.clear();
    DOM.clearNode(templateData.actions);
    const presentation = getMcpStatusPresentation(state);
    if (!presentation) {
      return;
    }
    const activeSessionServer = getActiveSessionServer(element);
    const label = getMcpEntryLabel(element);
    const activeSessionResource = this.customizationHarnessService.activeSessionResource.get();
    const showActiveSessionOutput = activeSessionServer ? (beforeShow) => this.agentHostCustomizationService.showMcpServerLog(activeSessionResource, activeSessionServer.id, beforeShow) : void 0;
    if (state === McpServerStatus.AuthRequired && activeSessionServer) {
      const signInLabel = localize("signInToMcpServer", "Sign in to {0}", label);
      const signInButton = templateData.actionDisposables.add(new Button(templateData.actions, {
        ...defaultButtonStyles,
        secondary: true,
        small: true,
        title: signInLabel,
        ariaLabel: signInLabel
      }));
      signInButton.label = localize("signIn", "Sign In");
      signInButton.element.classList.add("mcp-server-sign-in");
      registerMcpInlineButtonAction(templateData.actionDisposables, signInButton, async () => {
        signInButton.enabled = false;
        try {
          await authenticateMcpServer(this.agentHostCustomizationService, this.customizationHarnessService.activeSessionResource.get(), activeSessionServer.id);
        } finally {
          signInButton.enabled = true;
        }
      });
    }
    if (!presentation.icon) {
      return;
    }
    const showOutput = state === McpServerStatus.Error || state === McpConnectionState.Kind.Error ? getMcpServerOutputHandler(this.outputService, element.type === "session-server-item" ? void 0 : element.localServer, activeSessionServer, this._afterShowOutput, showActiveSessionOutput) : void 0;
    if (showOutput) {
      const showOutputLabel = localize("showMcpServerOutput", "Show output for {0}", label);
      const statusButton = templateData.actionDisposables.add(new Button(templateData.actions, {
        title: showOutputLabel,
        ariaLabel: showOutputLabel
      }));
      statusButton.icon = presentation.icon;
      statusButton.element.classList.add("mcp-server-status", "mcp-server-status-action", presentation.className);
      registerMcpInlineButtonAction(templateData.actionDisposables, statusButton, showOutput);
      return;
    }
    const statusElement = DOM.append(templateData.actions, $(".mcp-server-status"));
    statusElement.classList.add(presentation.className, ...ThemeIcon.asClassNameArray(presentation.icon));
    statusElement.setAttribute("aria-hidden", "true");
    templateData.actionDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), statusElement, presentation.label));
  }
  disposeTemplate(templateData) {
    templateData.elementDisposables.dispose();
    templateData.actionDisposables.dispose();
  }
};
McpServerItemRenderer = __decorateClass([
  __decorateParam(1, IAICustomizationWorkspaceService),
  __decorateParam(2, IAgentPluginService),
  __decorateParam(3, IHoverService),
  __decorateParam(4, IAgentHostCustomizationService),
  __decorateParam(5, ICustomizationHarnessService),
  __decorateParam(6, IOutputService)
], McpServerItemRenderer);
function registerMcpInlineButtonAction(store, button, action) {
  store.add(DOM.addDisposableGenericMouseDownListener(button.element, (event) => DOM.EventHelper.stop(event, true)));
  store.add(button.onDidClick((event) => {
    DOM.EventHelper.stop(event, true);
    void action();
  }));
}
function authenticateMcpServer(agentHostCustomizationService, sessionResource, serverId) {
  return agentHostCustomizationService.authenticateMcpServer(sessionResource, serverId);
}
function getMcpServerOutputHandler(outputService, localServer, activeSessionServer, closeCustomizationEditor, showActiveSessionOutput) {
  const outputChannelId = activeSessionServer?.logOutputChannelId;
  if (showActiveSessionOutput) {
    return () => showActiveSessionOutput(closeCustomizationEditor);
  }
  if (outputChannelId) {
    return async () => {
      await closeCustomizationEditor?.();
      await outputService.showChannel(outputChannelId);
    };
  }
  if (localServer) {
    return async () => {
      await closeCustomizationEditor?.();
      await localServer.showOutput();
    };
  }
  return void 0;
}
function getMcpStatusPresentation(state) {
  if (state === void 0) {
    return void 0;
  }
  if (state === "disabled") {
    return { label: localize("disabled", "Disabled"), className: "disabled", icon: Codicon.circleSlash };
  }
  switch (state) {
    case McpConnectionState.Kind.Running:
    case McpServerStatus.Ready:
      return { label: localize("running", "Running"), className: "running", icon: Codicon.check };
    case McpConnectionState.Kind.Starting:
    case McpServerStatus.Starting:
      return { label: localize("starting", "Starting"), className: "starting", icon: ThemeIcon.modify(Codicon.loading, "spin") };
    case McpServerStatus.AuthRequired:
      return { label: localize("authRequired", "Authentication required"), className: "auth-required", icon: Codicon.account };
    case McpConnectionState.Kind.Error:
    case McpServerStatus.Error:
      return { label: localize("error", "Error"), className: "error", icon: Codicon.error };
    case McpConnectionState.Kind.Stopped:
    case McpServerStatus.Stopped:
    default:
      return { label: localize("stopped", "Stopped"), className: "stopped" };
  }
}
function getActiveSessionServer(entry) {
  return entry.type === "session-server-item" ? entry.server : entry.activeSessionServer;
}
function getMcpEntryLabel(element) {
  return element.type === "session-server-item" ? element.server.name : element.type === "builtin-item" ? element.label : element.server.label;
}
function getMcpStatusKind(entry, isSessionsWindow) {
  if (entry.type === "session-server-item") {
    return entry.server.enabled ? entry.server.status : "disabled";
  }
  if (entry.localServer && isContributionDisabled(entry.localServer.enablement.get())) {
    return "disabled";
  }
  if (entry.activeSessionServer) {
    return entry.activeSessionServer.enabled ? entry.activeSessionServer.status : "disabled";
  }
  if (entry.type === "server-item" && !isSessionsWindow) {
    return entry.localServer?.connectionState.get().state;
  }
  return void 0;
}
function getMcpEntryAriaLabel(element, isSessionsWindow) {
  if (element.type === "group-header") {
    return localize("mcpGroupAriaLabel", "{0}, {1} items, {2}", element.label, element.count, element.collapsed ? localize("collapsed", "collapsed") : localize("expanded", "expanded"));
  }
  const label = getMcpEntryLabel(element);
  const status = getMcpStatusPresentation(getMcpStatusKind(element, isSessionsWindow));
  return status ? localize("mcpServerAriaLabelWithStatus", "{0}, {1}", label, status.label) : label;
}
function normalizeMcpMatchKey(value) {
  return value || void 0;
}
function getUniqueMcpMatchKeys(values) {
  const keys = /* @__PURE__ */ new Set();
  for (const value of values) {
    const key = normalizeMcpMatchKey(value);
    if (key) {
      keys.add(key);
    }
  }
  return [...keys];
}
class ActiveSessionMcpServerMatcher {
  constructor(servers) {
    this.servers = servers;
    this.byKey = /* @__PURE__ */ new Map();
    this.matchedIds = /* @__PURE__ */ new Set();
    for (const server of servers) {
      const separator = server.id.indexOf("/");
      const rawId = separator >= 0 ? server.id.slice(separator + 1) : server.id;
      for (const key of getUniqueMcpMatchKeys([rawId, server.name])) {
        let bucket = this.byKey.get(key);
        if (!bucket) {
          bucket = [];
          this.byKey.set(key, bucket);
        }
        bucket.push(server);
      }
    }
  }
  take(keys) {
    for (const key of getUniqueMcpMatchKeys(keys)) {
      const matches = this.byKey.get(key)?.filter((server) => !this.matchedIds.has(server.id));
      if (matches?.length === 1) {
        this.matchedIds.add(matches[0].id);
        return matches[0];
      }
    }
    return void 0;
  }
  unmatched(query) {
    return this.servers.filter((server) => !this.matchedIds.has(server.id) && matchesActiveSessionServerQuery(server, query));
  }
}
class LocalMcpServerMatcher {
  constructor(servers) {
    this.byKey = /* @__PURE__ */ new Map();
    for (const server of servers) {
      for (const key of getRuntimeServerMatchKeys(server)) {
        let matches = this.byKey.get(key);
        if (!matches) {
          matches = [];
          this.byKey.set(key, matches);
        }
        matches.push(server);
      }
    }
  }
  find(keys) {
    for (const key of getUniqueMcpMatchKeys(keys)) {
      const matches = this.byKey.get(key);
      if (matches?.length === 1) {
        return matches[0];
      }
    }
    return void 0;
  }
}
function matchesActiveSessionServerQuery(server, query) {
  if (!query) {
    return true;
  }
  return server.name.toLowerCase().includes(query);
}
function getWorkbenchServerMatchKeys(server) {
  return getUniqueMcpMatchKeys([server.id, server.name, server.label]);
}
function getRuntimeServerMatchKeys(server) {
  return getUniqueMcpMatchKeys([server.definition.id, server.definition.label]);
}
function getActiveSessionServerLifecycleAction(server) {
  if (!server.enabled) {
    return void 0;
  }
  return server.status === McpServerStatus.Stopped || server.status === McpServerStatus.Error ? new Action(
    "mcpServer.activeSession.start",
    localize("activeSessionMcpServerStart", "Start Server"),
    void 0,
    true,
    () => server.start()
  ) : new Action(
    "mcpServer.activeSession.stop",
    localize("activeSessionMcpServerStop", "Stop Server"),
    void 0,
    true,
    () => server.stop()
  );
}
function getSessionEnablementAction(server) {
  return new Action(
    server.enabled ? "mcpServer.session.disable" : "mcpServer.session.enable",
    server.enabled ? localize("sessionMcpServerDisable", "Disable (Session)") : localize("sessionMcpServerEnable", "Enable (Session)"),
    void 0,
    true,
    () => {
      server.setEnabled(!server.enabled);
      return Promise.resolve();
    }
  );
}
function getAgentHostMcpServerEnablementActions(agentHostCustomizations, sessionResource, server, isEmptyWorkbench) {
  const disabled = isContributionDisabled(agentHostCustomizations.getMcpServerEnablement(sessionResource, server.name));
  const actions = [];
  if (disabled) {
    actions.push(new Action("mcpServer.agentHost.enable", localize("agentHostMcpServerEnable", "Enable"), void 0, true, () => {
      agentHostCustomizations.setMcpServerEnablement(sessionResource, server.name, ContributionEnablementState.EnabledProfile);
    }));
    if (!isEmptyWorkbench) {
      actions.push(new Action("mcpServer.agentHost.enableWorkspace", localize("agentHostMcpServerEnableForWorkspace", "Enable (Workspace)"), void 0, true, () => {
        agentHostCustomizations.setMcpServerEnablement(sessionResource, server.name, ContributionEnablementState.EnabledWorkspace);
      }));
    }
  } else {
    actions.push(new Action("mcpServer.agentHost.disable", localize("agentHostMcpServerDisable", "Disable"), void 0, true, () => {
      agentHostCustomizations.setMcpServerEnablement(sessionResource, server.name, ContributionEnablementState.DisabledProfile);
    }));
    if (!isEmptyWorkbench) {
      actions.push(new Action("mcpServer.agentHost.disableWorkspace", localize("agentHostMcpServerDisableForWorkspace", "Disable (Workspace)"), void 0, true, () => {
        agentHostCustomizations.setMcpServerEnablement(sessionResource, server.name, ContributionEnablementState.DisabledWorkspace);
      }));
    }
  }
  return actions;
}
function getLocalMcpServerEnablementActions(mcpService, serverId, isEmptyWorkbench) {
  const disabled = isContributionDisabled(mcpService.enablementModel.readEnabled(serverId));
  const actions = [];
  if (disabled) {
    actions.push(new Action("mcpServer.builtin.enable", localize("builtinMcpServerEnable", "Enable"), void 0, true, () => {
      mcpService.enablementModel.setEnabled(serverId, ContributionEnablementState.EnabledProfile);
    }));
    if (!isEmptyWorkbench) {
      actions.push(new Action("mcpServer.builtin.enableWorkspace", localize("builtinMcpServerEnableForWorkspace", "Enable (Workspace)"), void 0, true, () => {
        mcpService.enablementModel.setEnabled(serverId, ContributionEnablementState.EnabledWorkspace);
      }));
    }
  } else {
    actions.push(new Action("mcpServer.builtin.disable", localize("builtinMcpServerDisable", "Disable"), void 0, true, () => {
      mcpService.enablementModel.setEnabled(serverId, ContributionEnablementState.DisabledProfile);
    }));
    if (!isEmptyWorkbench) {
      actions.push(new Action("mcpServer.builtin.disableWorkspace", localize("builtinMcpServerDisableForWorkspace", "Disable (Workspace)"), void 0, true, () => {
        mcpService.enablementModel.setEnabled(serverId, ContributionEnablementState.DisabledWorkspace);
      }));
    }
  }
  return actions;
}
function getActiveSessionServerOptionsActions(commandService, agentHostCustomizations, isEmptyWorkbench, sessionResource, server) {
  const actions = [];
  const lifecycleAction = getActiveSessionServerLifecycleAction(server);
  if (lifecycleAction) {
    actions.push(lifecycleAction);
  }
  const durableActions = getAgentHostMcpServerEnablementActions(agentHostCustomizations, sessionResource, server, isEmptyWorkbench);
  if (durableActions.length > 0) {
    if (actions.length > 0) {
      actions.push(new Separator());
    }
    actions.push(...durableActions);
  }
  actions.push(getSessionEnablementAction(server));
  actions.push(new Separator());
  actions.push(new Action(
    "mcpServer.activeSession.options",
    localize("activeSessionMcpServerOptions", "Server Options"),
    void 0,
    true,
    async () => {
      await commandService.executeCommand(McpCommandIds.AgentHostServerOptions, sessionResource, server.id);
    }
  ));
  return actions;
}
function shouldHideLocalActionForActiveSessionServer(action) {
  return action instanceof StartServerAction || action instanceof StopServerAction || action instanceof RestartServerAction || action instanceof ConfigureModelAccessAction || action instanceof ShowSamplingRequestsAction;
}
function isLocalMcpServerEnablementAction(action) {
  return action instanceof EnableMcpServerGloballyAction || action instanceof EnableMcpServerForWorkspaceAction || action instanceof DisableMcpServerGloballyAction || action instanceof DisableMcpServerForWorkspaceAction;
}
function createBuiltinEntry(server, activeSessionServer) {
  return {
    type: "builtin-item",
    id: `builtin-${server.definition.id}`,
    label: server.definition.label,
    description: "",
    collectionId: server.collection.id,
    activeSessionServer,
    localServer: server
  };
}
const MCP_GALLERY_ITEM_TEMPLATE_ID = "mcpGalleryItem";
class McpGalleryItemProvider {
  constructor(mcpWorkbenchService) {
    this.mcpWorkbenchService = mcpWorkbenchService;
  }
  getLabel(element) {
    return element.server.label;
  }
  getPublisherDisplayName(element) {
    return element.server.publisherDisplayName;
  }
  getDescription(element) {
    return element.server.description;
  }
  getInstallState(element) {
    switch (element.server.installState) {
      case McpServerInstallState.Installed:
        return GalleryItemInstallState.Installed;
      case McpServerInstallState.Installing:
        return GalleryItemInstallState.Installing;
      default:
        return GalleryItemInstallState.Uninstalled;
    }
  }
  canInstall(element) {
    return this.mcpWorkbenchService.canInstall(element.server) === true;
  }
  async install(element) {
    await this.mcpWorkbenchService.install(element.server);
  }
  onDidChangeInstallState(element, listener) {
    return this.mcpWorkbenchService.onChange((changed) => {
      if (!changed || changed.id === element.server.id) {
        listener();
      }
    });
  }
}
let McpListWidget = class extends Disposable {
  constructor(instantiationService, mcpWorkbenchService, mcpService, mcpRegistry, commandService, openerService, contextViewService, contextMenuService, hoverService, agentPluginService, dialogService, configurationService, customizationHarnessService, agentHostCustomizationService, workspaceService) {
    super();
    this.instantiationService = instantiationService;
    this.mcpWorkbenchService = mcpWorkbenchService;
    this.mcpService = mcpService;
    this.mcpRegistry = mcpRegistry;
    this.commandService = commandService;
    this.openerService = openerService;
    this.contextViewService = contextViewService;
    this.contextMenuService = contextMenuService;
    this.hoverService = hoverService;
    this.agentPluginService = agentPluginService;
    this.dialogService = dialogService;
    this.configurationService = configurationService;
    this.customizationHarnessService = customizationHarnessService;
    this.agentHostCustomizationService = agentHostCustomizationService;
    this.workspaceService = workspaceService;
    this._onDidSelectServer = this._register(new Emitter());
    this.onDidSelectServer = this._onDidSelectServer.event;
    this._onDidChangeItemCount = this._register(new Emitter());
    this.onDidChangeItemCount = this._onDidChangeItemCount.event;
    this._onDidRequestShowPlugin = this._register(new Emitter());
    this.onDidRequestShowPlugin = this._onDidRequestShowPlugin.event;
    this.disabledLinkListener = this._register(new MutableDisposable());
    this.filteredServers = [];
    this.filteredBuiltinCount = 0;
    this.filteredActiveSessionCount = 0;
    this.displayEntries = [];
    this.galleryServers = [];
    this.searchQuery = "";
    this.browseMode = false;
    this.lastHeight = 0;
    this.lastWidth = 0;
    this.lastHeaderHeight = 0;
    this._layoutDeferred = false;
    this.collapsedGroups = /* @__PURE__ */ new Set();
    this.delayedFilter = new Delayer(200);
    this.delayedGallerySearch = new Delayer(400);
    this._closeCustomizationEditor = () => Promise.resolve();
    this.element = $(".mcp-list-widget");
    this.create();
    this.updateAccessState();
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(mcpAccessConfig)) {
        this.updateAccessState();
      }
    }));
    this._register({
      dispose: () => {
        this.galleryCts?.dispose();
      }
    });
  }
  setCloseCustomizationEditor(closeCustomizationEditor) {
    this._closeCustomizationEditor = closeCustomizationEditor;
  }
  create() {
    this.sectionTitleHeader = DOM.append(this.element, $(".section-title-header"));
    const titleRow = DOM.append(this.sectionTitleHeader, $(".section-title-row"));
    const sectionTitle = DOM.append(titleRow, $("h2.section-title"));
    sectionTitle.textContent = localize("mcpServers", "MCP Servers");
    const sectionTitleDescription = DOM.append(this.sectionTitleHeader, $("p.section-title-description"));
    const sectionTitleDescriptionText = DOM.append(sectionTitleDescription, $("span.section-title-description-text"));
    sectionTitleDescriptionText.textContent = localize("mcpServersDescription", "An open standard that lets AI use external tools and services. MCP servers provide tools for file operations, databases, APIs, and more.");
    sectionTitleDescription.appendChild(document.createTextNode(" "));
    this.sectionLink = DOM.append(sectionTitleDescription, $("a.section-title-link"));
    this.sectionLink.textContent = localize("learnMoreMcp", "Learn more about MCP servers");
    this.sectionLink.href = "https://code.visualstudio.com/docs/agent-customization/mcp-servers?referrer=in-product";
    this._register(DOM.addDisposableListener(this.sectionLink, "click", (e) => {
      e.preventDefault();
      const href = this.sectionLink.href;
      if (href) {
        this.openerService.open(URI.parse(href));
      }
    }));
    const targetWindow = DOM.getWindow(this.element);
    const headerObserver = this._register(new DOM.DisposableResizeObserver(
      "McpListWidget.sectionTitleHeader",
      () => {
        if (this.lastWidth <= 0 || this.lastHeight <= 0) {
          return;
        }
        const headerHeight = this.sectionTitleHeader.offsetHeight;
        if (headerHeight === this.lastHeaderHeight) {
          return;
        }
        this.layout(this.lastHeight, this.lastWidth);
      },
      targetWindow
    ));
    this._register(headerObserver.observe(this.sectionTitleHeader));
    this.searchAndButtonContainer = DOM.append(this.element, $(".list-search-and-button-container"));
    const searchContainer = DOM.append(this.searchAndButtonContainer, $(".list-search-container"));
    this.searchInput = this._register(new InputBox(searchContainer, this.contextViewService, {
      placeholder: localize("searchMcpPlaceholder", "Type to search..."),
      inputBoxStyles: defaultInputBoxStyles
    }));
    this._register(this.searchInput.onDidChange(() => {
      this.searchQuery = this.searchInput.value;
      if (this.browseMode) {
        this.delayedGallerySearch.trigger(() => this.queryGallery());
      } else {
        this.delayedFilter.trigger(() => this.filterServers());
      }
    }));
    const buttonContainer = DOM.append(this.searchAndButtonContainer, $(".list-button-group"));
    const backButtonContainer = DOM.append(buttonContainer, $(".list-add-button-container"));
    this.backButton = this._register(new Button(backButtonContainer, {
      ...defaultButtonStyles,
      secondary: true,
      supportIcons: true,
      title: localize("backToInstalled", "Back to installed servers"),
      ariaLabel: localize("backToInstalled", "Back to installed servers")
    }));
    this.backButton.label = `$(${Codicon.arrowLeft.id}) ${localize("mcpBrowseBack", "Back")}`;
    this.backButton.element.classList.add("list-add-button");
    backButtonContainer.style.display = "none";
    this._register(this.backButton.onDidClick(() => {
      this.toggleBrowseMode(false);
    }));
    const browseButtonContainer = DOM.append(buttonContainer, $(".list-add-button-container"));
    this.browseButton = this._register(new Button(browseButtonContainer, { ...defaultButtonStyles, secondary: true, supportIcons: true }));
    this.browseButton.label = `$(${Codicon.library.id}) ${localize("browseMarketplace", "Browse Marketplace")}`;
    this.browseButton.element.classList.add("list-add-button");
    this._register(this.browseButton.onDidClick(() => {
      this.toggleBrowseMode(!this.browseMode);
    }));
    this.addButton = this._register(new Button(buttonContainer, {
      ...defaultButtonStyles,
      secondary: true,
      supportIcons: true,
      title: localize("addServer", "Add Server"),
      ariaLabel: localize("addServer", "Add Server")
    }));
    this.addButton.label = `$(${Codicon.add.id})`;
    this.addButton.element.classList.add("list-icon-button");
    this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), this.addButton.element, localize("addServerTooltip", "Add Server")));
    this._register(this.addButton.onDidClick(() => {
      this.commandService.executeCommand(McpCommandIds.AddConfiguration);
    }));
    this.emptyContainer = DOM.append(this.element, $(".mcp-empty-state"));
    const emptyHeader = DOM.append(this.emptyContainer, $(".empty-state-header"));
    this.emptyText = DOM.append(emptyHeader, $(".empty-text"));
    this.emptySubtext = DOM.append(this.emptyContainer, $(".empty-subtext"));
    this.disabledContainer = DOM.append(this.element, $(".mcp-disabled-state"));
    const disabledHeader = DOM.append(this.disabledContainer, $(".empty-state-header"));
    this.disabledIcon = DOM.append(disabledHeader, $(".empty-icon"));
    const disabledText = DOM.append(disabledHeader, $(".empty-text"));
    disabledText.textContent = localize("mcpAccessDisabledTitle", "MCP servers are disabled");
    this.disabledMessage = DOM.append(this.disabledContainer, $(".empty-subtext"));
    this.listContainer = DOM.append(this.element, $(".mcp-list-container"));
    const delegate = new McpServerItemDelegate();
    const groupHeaderRenderer = new CustomizationGroupHeaderRenderer("mcpGroupHeader", this.hoverService);
    const localRenderer = this.instantiationService.createInstance(McpServerItemRenderer, () => this._closeCustomizationEditor());
    const galleryRenderer = new GalleryItemRenderer(MCP_GALLERY_ITEM_TEMPLATE_ID, new McpGalleryItemProvider(this.mcpWorkbenchService));
    this.list = this._register(this.instantiationService.createInstance(
      WorkbenchList,
      "McpManagementList",
      this.listContainer,
      delegate,
      [groupHeaderRenderer, localRenderer, galleryRenderer],
      {
        multipleSelectionSupport: false,
        setRowLineHeight: false,
        horizontalScrolling: false,
        accessibilityProvider: {
          getAriaLabel: (element) => {
            return getMcpEntryAriaLabel(element, this.workspaceService.isSessionsWindow);
          },
          getWidgetAriaLabel() {
            return localize("mcpServersListAriaLabel", "MCP Servers");
          }
        },
        openOnSingleClick: true,
        identityProvider: {
          getId(element) {
            if (element.type === "group-header") {
              return element.id;
            }
            if (element.type === "builtin-item") {
              return element.id;
            }
            return element.server.id;
          },
          getGroupId(element) {
            return element.type === "group-header" ? NotSelectableGroupId : 0;
          }
        }
      }
    ));
    this._register(this.list.onDidOpen((e) => {
      if (e.element) {
        if (e.element.type === "group-header") {
          this.toggleGroup(e.element);
        } else if (e.element.type === "server-item") {
          const server = e.element.server;
          const isGallery = e.element.marketplace || !server.local;
          if (isGallery || server.description) {
            this._onDidSelectServer.fire(server);
          }
        } else if (e.element.type === "session-server-item") {
          this.openActiveSessionServerOptions(e.element.server);
        }
      }
    }));
    this._register(this.list.onContextMenu((e) => this.onContextMenu(e)));
    this._register(this.mcpWorkbenchService.onChange(() => {
      if (!this.browseMode) {
        this.refresh();
      }
    }));
    this._register(autorun((reader) => {
      this.mcpService.servers.read(reader);
      if (!this.browseMode) {
        this.refresh();
      }
    }));
    this._register(autorun((reader) => {
      this.customizationHarnessService.activeSessionResource.read(reader);
      if (!this.browseMode) {
        this.refresh();
      }
    }));
    this._register(this.agentHostCustomizationService.onDidChangeCustomizations(() => {
      if (!this.browseMode) {
        this.refresh();
      }
    }));
    void this.refresh();
  }
  async refresh() {
    if (this.browseMode) {
      await this.queryGallery();
    } else {
      this.filterServers();
    }
  }
  updateAccessState() {
    const inspect = this.configurationService.inspect(mcpAccessConfig);
    const value = inspect.value ?? inspect.defaultValue;
    const disabled = value === McpAccessValue.None;
    const policyLocked = inspect.policyValue === McpAccessValue.None;
    this.element.classList.toggle("access-disabled", disabled);
    if (disabled) {
      this.disabledIcon.className = "empty-icon";
      this.disabledIcon.classList.add(...ThemeIcon.asClassNameArray(policyLocked ? Codicon.shield : mcpServerIcon));
      DOM.clearNode(this.disabledMessage);
      this.disabledLinkListener.clear();
      if (policyLocked) {
        this.disabledMessage.textContent = localize("mcpAccessDisabledByPolicy", "Access to MCP servers is disabled by your organization. Contact your organization administrator for more information.");
      } else {
        this.disabledMessage.appendChild(document.createTextNode(localize("mcpAccessDisabledBySettingPrefix", "MCP servers are disabled in settings. ")));
        const link = DOM.append(this.disabledMessage, $("a.mcp-disabled-settings-link"));
        link.textContent = localize("mcpAccessDisabledSettingLink", "Configure in settings.");
        link.href = "#";
        link.setAttribute("role", "button");
        this.disabledLinkListener.value = DOM.addDisposableListener(link, "click", (e) => {
          e.preventDefault();
          this.commandService.executeCommand("workbench.action.openSettings", `@id:${mcpAccessConfig}`);
        });
      }
    }
  }
  showBrowseMarketplace() {
    if (!this.browseMode) {
      this.toggleBrowseMode(true);
    }
  }
  toggleBrowseMode(browse) {
    this.browseMode = browse;
    this.searchInput.value = "";
    this.searchQuery = "";
    this.addButton.element.style.display = browse ? "none" : "";
    this.browseButton.element.parentElement.style.display = browse ? "none" : "";
    this.backButton.element.parentElement.style.display = browse ? "" : "none";
    this.searchInput.setPlaceHolder(
      browse ? localize("searchGalleryPlaceholder", "Search MCP marketplace...") : localize("searchMcpPlaceholder", "Type to search...")
    );
    if (browse) {
      void this.queryGallery();
    } else {
      this.galleryCts?.dispose(true);
      this.galleryServers = [];
      this.filterServers();
    }
    if (this.lastHeight > 0) {
      this.layout(this.lastHeight, this.lastWidth);
    }
  }
  async queryGallery() {
    this.galleryCts?.dispose(true);
    const cts = this.galleryCts = new CancellationTokenSource();
    this.emptyContainer.style.display = "flex";
    this.listContainer.style.display = "none";
    this.emptyText.textContent = localize("loadingGallery", "Loading marketplace...");
    this.emptySubtext.textContent = "";
    try {
      const pager = await this.mcpWorkbenchService.queryGallery(
        { text: this.searchQuery.trim() || void 0 },
        cts.token
      );
      if (cts.token.isCancellationRequested) {
        return;
      }
      this.galleryServers = pager.firstPage.items;
      this.updateGalleryList();
    } catch {
      if (!cts.token.isCancellationRequested) {
        this.galleryServers = [];
        this.emptyContainer.style.display = "flex";
        this.listContainer.style.display = "none";
        this.emptyText.textContent = localize("galleryError", "Unable to load marketplace");
        this.emptySubtext.textContent = localize("tryAgainLater", "Check your connection and try again");
      }
    }
  }
  updateGalleryList() {
    if (this.galleryServers.length === 0) {
      this.emptyContainer.style.display = "flex";
      this.listContainer.style.display = "none";
      if (this.searchQuery.trim()) {
        this.emptyText.textContent = localize("noGalleryResults", "No servers match '{0}'", this.searchQuery);
        this.emptySubtext.textContent = localize("tryDifferentSearch", "Try a different search term");
      } else {
        this.emptyText.textContent = localize("emptyGallery", "No MCP servers available");
        this.emptySubtext.textContent = "";
      }
    } else {
      this.emptyContainer.style.display = "none";
      this.listContainer.style.display = "";
    }
    const entries = this.galleryServers.map((server) => ({ type: "server-item", server, marketplace: true }));
    this.list.splice(0, this.list.length, entries);
  }
  filterServers() {
    const query = this.searchQuery.toLowerCase().trim();
    const activeSessionResource = this.customizationHarnessService.activeSessionResource.get();
    const activeSessionMatcher = new ActiveSessionMcpServerMatcher(this.agentHostCustomizationService.getMcpServers(activeSessionResource));
    const localServerMatcher = new LocalMcpServerMatcher(this.mcpService.servers.get());
    if (query) {
      this.filteredServers = this.mcpWorkbenchService.local.filter(
        (server) => server.label.toLowerCase().includes(query) || server.description?.toLowerCase().includes(query)
      );
    } else {
      this.filteredServers = [...this.mcpWorkbenchService.local];
    }
    const localIds = new Set(this.filteredServers.map((s) => s.id));
    const builtinServers = this.mcpService.servers.get().filter((s) => !localIds.has(s.definition.id)).filter((s) => !query || s.definition.label.toLowerCase().includes(query));
    const groups = [
      { scope: LocalMcpServerScope.Workspace, label: localize("workspaceGroup", "Workspace"), icon: workspaceIcon, description: localize("workspaceGroupDescription", "MCP servers configured in your workspace or reported by the active session."), entries: [] },
      { scope: LocalMcpServerScope.User, label: localize("userGroup", "User"), icon: userIcon, description: localize("userGroupDescription", "MCP servers configured in your user settings. Private to you and available across all projects."), entries: [] }
    ];
    for (const server of this.filteredServers) {
      const entry = {
        type: "server-item",
        server,
        activeSessionServer: activeSessionMatcher.take(getWorkbenchServerMatchKeys(server)),
        localServer: localServerMatcher.find(getWorkbenchServerMatchKeys(server))
      };
      const scope = server.local?.scope;
      if (scope === LocalMcpServerScope.Workspace) {
        groups[0].entries.push(entry);
      } else {
        groups[1].entries.push(entry);
      }
    }
    const collectionSources = new Map(this.mcpRegistry.collections.get().map((c) => [c.id, c.source]));
    const pluginServers = [];
    const extensionServers = [];
    const otherBuiltinServers = [];
    for (const server of builtinServers) {
      const entry = { server, activeSessionServer: activeSessionMatcher.take(getRuntimeServerMatchKeys(server)) };
      const source = collectionSources.get(server.collection.id);
      if (server.collection.id.startsWith(PLUGIN_COLLECTION_PREFIX)) {
        pluginServers.push(entry);
      } else if (source instanceof ExtensionIdentifier && !isCopilotExtension(source)) {
        extensionServers.push(entry);
      } else {
        otherBuiltinServers.push(entry);
      }
    }
    const activeSessionOnlyServers = activeSessionMatcher.unmatched(query);
    const activeSessionBuiltinEntries = createBuiltinActiveSessionMcpEntries(activeSessionOnlyServers);
    if (this.filteredServers.length === 0 && builtinServers.length === 0 && activeSessionOnlyServers.length === 0) {
      this.emptyContainer.style.display = "flex";
      this.listContainer.style.display = "none";
      if (this.searchQuery.trim()) {
        this.emptyText.textContent = localize("noMatchingServers", "No servers match '{0}'", this.searchQuery);
        this.emptySubtext.textContent = localize("tryDifferentSearch", "Try a different search term");
      } else {
        this.emptyText.textContent = localize("noMcpServers", "No MCP servers configured");
        this.emptySubtext.textContent = localize("addMcpServer", "Add an MCP server configuration to get started");
      }
    } else {
      this.emptyContainer.style.display = "none";
      this.listContainer.style.display = "";
    }
    const entries = [];
    let isFirst = true;
    for (const group of groups) {
      if (group.entries.length === 0) {
        continue;
      }
      const collapsed = this.collapsedGroups.has(group.scope);
      entries.push({
        type: "group-header",
        id: `mcp-group-${group.scope}`,
        scope: group.scope,
        label: group.label,
        icon: group.icon,
        count: group.entries.length,
        isFirst,
        description: group.description,
        collapsed
      });
      if (!collapsed) {
        entries.push(...group.entries);
      }
      isFirst = false;
    }
    if (pluginServers.length > 0) {
      const collapsed = this.collapsedGroups.has("plugin");
      entries.push({
        type: "group-header",
        id: "mcp-group-plugin",
        scope: "plugin",
        label: localize("pluginGroup", "Plugins"),
        icon: pluginIcon,
        count: pluginServers.length,
        isFirst,
        description: localize("pluginGroupDescription", "MCP servers provided by installed plugins."),
        collapsed
      });
      if (!collapsed) {
        for (const { server, activeSessionServer } of pluginServers) {
          entries.push(createBuiltinEntry(server, activeSessionServer));
        }
      }
      isFirst = false;
    }
    if (extensionServers.length > 0) {
      const collapsed = this.collapsedGroups.has("extension");
      entries.push({
        type: "group-header",
        id: "mcp-group-extension",
        scope: "extension",
        label: localize("extensionGroup", "Extensions"),
        icon: extensionIcon,
        count: extensionServers.length,
        isFirst,
        description: localize("extensionGroupDescription", "MCP servers contributed by installed VS Code extensions."),
        collapsed
      });
      if (!collapsed) {
        for (const { server, activeSessionServer } of extensionServers) {
          entries.push(createBuiltinEntry(server, activeSessionServer));
        }
      }
      isFirst = false;
    }
    if (otherBuiltinServers.length > 0 || activeSessionBuiltinEntries.length > 0) {
      const collapsed = this.collapsedGroups.has("builtin");
      entries.push({
        type: "group-header",
        id: "mcp-group-builtin",
        scope: "builtin",
        label: localize("builtInGroup", "Built-in"),
        icon: builtinIcon,
        count: otherBuiltinServers.length + activeSessionBuiltinEntries.length,
        isFirst,
        description: localize("builtInGroupDescription", "MCP servers built into VS Code. These are available automatically."),
        collapsed
      });
      if (!collapsed) {
        for (const { server, activeSessionServer } of otherBuiltinServers) {
          entries.push(createBuiltinEntry(server, activeSessionServer));
        }
        entries.push(...activeSessionBuiltinEntries);
      }
      isFirst = false;
    }
    this.displayEntries = entries;
    this.list.splice(0, this.list.length, this.displayEntries);
    this.filteredBuiltinCount = builtinServers.length;
    this.filteredActiveSessionCount = activeSessionOnlyServers.length;
    this._onDidChangeItemCount.fire(this.itemCount);
  }
  /**
   * Gets the total item count from the underlying data arrays
   * (the same source used to build group headers).
   */
  get itemCount() {
    return this.filteredServers.length + this.filteredBuiltinCount + this.filteredActiveSessionCount;
  }
  /**
   * Re-fires the current item count. Call after subscribing to onDidChangeItemCount
   * to ensure the subscriber receives the latest count.
   */
  fireItemCount() {
    this._onDidChangeItemCount.fire(this.itemCount);
  }
  /**
   * Toggles the collapsed state of a group.
   */
  toggleGroup(entry) {
    if (this.collapsedGroups.has(entry.scope)) {
      this.collapsedGroups.delete(entry.scope);
    } else {
      this.collapsedGroups.add(entry.scope);
    }
    this.filterServers();
  }
  /**
   * Whether the widget is currently in marketplace browse mode.
   */
  isInBrowseMode() {
    return this.browseMode;
  }
  /**
   * Exits marketplace browse mode and returns to the installed servers list.
   */
  exitBrowseMode() {
    if (this.browseMode) {
      this.toggleBrowseMode(false);
    }
  }
  /**
   * Layouts the widget.
   */
  layout(height, width) {
    this.lastHeight = height;
    this.lastWidth = width;
    this.element.style.height = "";
    const availableHeight = this.element.clientHeight || height;
    const availableWidth = this.element.clientWidth || width;
    const searchBarHeight = this.searchAndButtonContainer.offsetHeight;
    if (searchBarHeight === 0 && !this._layoutDeferred) {
      this._layoutDeferred = true;
      DOM.getWindow(this.element).requestAnimationFrame(() => {
        try {
          this.layout(this.lastHeight, this.lastWidth);
        } finally {
          this._layoutDeferred = false;
        }
      });
      return;
    }
    const headerHeight = this.sectionTitleHeader.offsetHeight;
    this.lastHeaderHeight = headerHeight;
    const listHeight = Math.max(0, availableHeight - searchBarHeight - headerHeight);
    this.listContainer.style.height = `${listHeight}px`;
    this.list.layout(listHeight, availableWidth);
  }
  /**
   * Focuses the search input.
   */
  focusSearch() {
    this.searchInput.focus();
  }
  /**
   * Scrolls the list so the last item is visible.
   */
  revealLastItem() {
    if (this.list.length > 0) {
      this.list.reveal(this.list.length - 1);
    }
  }
  /**
   * Focuses the list.
   */
  focus() {
    this.list.domFocus();
    const servers = this.list.length;
    if (servers > 0) {
      this.list.setFocus([0]);
    }
  }
  openActiveSessionServerOptions(server) {
    void this.commandService.executeCommand(McpCommandIds.AgentHostServerOptions, this.customizationHarnessService.activeSessionResource.get(), server.id);
  }
  /**
   * Handles context menu for MCP server items.
   */
  onContextMenu(e) {
    if (!e.element) {
      return;
    }
    if (e.element.type === "session-server-item") {
      const disposables2 = new DisposableStore();
      const isEmptyWorkbench = this.workspaceService.getActiveProjectRoot() === void 0;
      const activeSessionActions = getActiveSessionServerOptionsActions(this.commandService, this.agentHostCustomizationService, isEmptyWorkbench, this.customizationHarnessService.activeSessionResource.get(), e.element.server);
      activeSessionActions.forEach((action) => isDisposable(action) && disposables2.add(action));
      this.contextMenuService.showContextMenu({
        getAnchor: () => e.anchor,
        getActions: () => activeSessionActions,
        onHide: () => disposables2.dispose()
      });
      return;
    }
    if (e.element.type === "builtin-item") {
      const collectionId = e.element.collectionId;
      const pluginUriStr = getPluginUriFromCollectionId(collectionId);
      const plugin = pluginUriStr ? this.agentPluginService.plugins.get().find((p) => p.uri.toString() === pluginUriStr) : void 0;
      const disposables2 = new DisposableStore();
      const actions2 = [];
      const lifecycleAction = e.element.activeSessionServer ? getActiveSessionServerLifecycleAction(e.element.activeSessionServer) : void 0;
      if (lifecycleAction) {
        actions2.push(disposables2.add(lifecycleAction));
      }
      if (e.element.localServer) {
        const isEmptyWorkbench = this.workspaceService.getActiveProjectRoot() === void 0;
        const enablementActions = getLocalMcpServerEnablementActions(this.mcpService, e.element.localServer.definition.id, isEmptyWorkbench);
        if (enablementActions.length > 0) {
          if (actions2.length > 0) {
            actions2.push(new Separator());
          }
          for (const enablementAction of enablementActions) {
            if (isDisposable(enablementAction)) {
              disposables2.add(enablementAction);
            }
            actions2.push(enablementAction);
          }
        }
      }
      if (e.element.activeSessionServer) {
        const sessionAction = getSessionEnablementAction(e.element.activeSessionServer);
        if (isDisposable(sessionAction)) {
          disposables2.add(sessionAction);
        }
        actions2.push(sessionAction);
      }
      if (plugin) {
        if (actions2.length > 0) {
          actions2.push(new Separator());
        }
        actions2.push(disposables2.add(new Action(
          "mcpServer.showPlugin",
          localize("showPlugin", "Show Plugin"),
          void 0,
          true,
          async () => {
            const item = {
              kind: AgentPluginItemKind.Installed,
              name: plugin.label,
              description: plugin.fromMarketplace?.description ?? "",
              marketplace: plugin.fromMarketplace?.marketplace,
              plugin
            };
            this._onDidRequestShowPlugin.fire(item);
          }
        )));
        actions2.push(disposables2.add(new Action(
          "mcpServer.uninstallPlugin",
          localize("uninstallPlugin", "Uninstall Plugin"),
          void 0,
          true,
          async () => {
            const result = await this.dialogService.confirm({
              message: localize("confirmUninstallPluginMcp", "This MCP server is provided by the plugin '{0}'", plugin.label),
              detail: localize("confirmUninstallPluginMcpDetail", "Individual MCP servers from a plugin cannot be removed separately. Would you like to uninstall the entire plugin?"),
              primaryButton: localize("uninstallPluginBtn", "Uninstall Plugin"),
              type: "question"
            });
            if (result.confirmed) {
              plugin.remove?.();
            }
          }
        )));
      }
      if (actions2.length === 0) {
        disposables2.dispose();
        return;
      }
      this.contextMenuService.showContextMenu({
        getAnchor: () => e.anchor,
        getActions: () => actions2,
        onHide: () => disposables2.dispose()
      });
      return;
    }
    if (e.element.type !== "server-item") {
      return;
    }
    const serverEntry = e.element;
    const disposables = new DisposableStore();
    const mcpServer = this.mcpWorkbenchService.local.find((local) => local.id === serverEntry.server.id) || serverEntry.server;
    const groups = getContextMenuActions(mcpServer, false, this.instantiationService);
    const actions = [];
    const activeSessionLifecycleAction = serverEntry.activeSessionServer ? getActiveSessionServerLifecycleAction(serverEntry.activeSessionServer) : void 0;
    const activeSessionEnablementAction = serverEntry.activeSessionServer ? getSessionEnablementAction(serverEntry.activeSessionServer) : void 0;
    let sessionEnablementAdded = false;
    if (activeSessionLifecycleAction) {
      actions.push(disposables.add(activeSessionLifecycleAction));
      actions.push(new Separator());
    }
    if (activeSessionEnablementAction && isDisposable(activeSessionEnablementAction)) {
      disposables.add(activeSessionEnablementAction);
    }
    for (const menuActions of groups) {
      for (const menuAction of menuActions) {
        if (isDisposable(menuAction)) {
          disposables.add(menuAction);
        }
      }
      const visibleMenuActions = serverEntry.activeSessionServer ? menuActions.filter((action) => !shouldHideLocalActionForActiveSessionServer(action)) : menuActions;
      for (const menuAction of visibleMenuActions) {
        actions.push(menuAction);
      }
      if (activeSessionEnablementAction && menuActions.some(isLocalMcpServerEnablementAction)) {
        actions.push(activeSessionEnablementAction);
        sessionEnablementAdded = true;
      }
      if (visibleMenuActions.length > 0) {
        actions.push(new Separator());
      }
    }
    if (activeSessionEnablementAction && !sessionEnablementAdded) {
      actions.push(activeSessionEnablementAction);
    }
    if (actions.length > 0 && actions[actions.length - 1] instanceof Separator) {
      actions.pop();
    }
    this.contextMenuService.showContextMenu({
      getAnchor: () => e.anchor,
      getActions: () => actions,
      onHide: () => disposables.dispose()
    });
  }
};
McpListWidget = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IMcpWorkbenchService),
  __decorateParam(2, IMcpService),
  __decorateParam(3, IMcpRegistry),
  __decorateParam(4, ICommandService),
  __decorateParam(5, IOpenerService),
  __decorateParam(6, IContextViewService),
  __decorateParam(7, IContextMenuService),
  __decorateParam(8, IHoverService),
  __decorateParam(9, IAgentPluginService),
  __decorateParam(10, IDialogService),
  __decorateParam(11, IConfigurationService),
  __decorateParam(12, ICustomizationHarnessService),
  __decorateParam(13, IAgentHostCustomizationService),
  __decorateParam(14, IAICustomizationWorkspaceService)
], McpListWidget);
export {
  McpListWidget,
  authenticateMcpServer,
  createBuiltinActiveSessionMcpEntries,
  getActiveSessionServerOptionsActions,
  getAgentHostMcpServerEnablementActions,
  getLocalMcpServerEnablementActions,
  getMcpServerOutputHandler,
  getSessionEnablementAction,
  registerMcpInlineButtonAction
};
