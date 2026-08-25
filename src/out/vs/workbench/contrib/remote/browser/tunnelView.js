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
import "./media/tunnelView.css";
import * as nls from "../../../../nls.js";
import * as dom from "../../../../base/browser/dom.js";
import { IViewDescriptorService } from "../../../common/views.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IContextMenuService, IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { IContextKeyService, RawContextKey, ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { ICommandService, CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { Event } from "../../../../base/common/event.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { toDisposable, dispose, DisposableStore } from "../../../../base/common/lifecycle.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { IconLabel } from "../../../../base/browser/ui/iconLabel/iconLabel.js";
import { ActionRunner } from "../../../../base/common/actions.js";
import { IMenuService, MenuId, MenuRegistry } from "../../../../platform/actions/common/actions.js";
import { createActionViewItem, getFlatActionBarActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IRemoteExplorerService, TunnelType, TUNNEL_VIEW_ID, TunnelEditId } from "../../../services/remote/common/remoteExplorerService.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { InputBox, MessageType } from "../../../../base/browser/ui/inputbox/inputBox.js";
import { createSingleCallFunction } from "../../../../base/common/functional.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { ViewPane } from "../../../browser/parts/views/viewPane.js";
import { URI } from "../../../../base/common/uri.js";
import { isAllInterfaces, isLocalhost, isRemoteTunnel, ITunnelService, TunnelPrivacyId, TunnelProtocol } from "../../../../platform/tunnel/common/tunnel.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { copyAddressIcon, forwardedPortWithoutProcessIcon, forwardedPortWithProcessIcon, forwardPortIcon, labelPortIcon, openBrowserIcon, openPreviewIcon, portsViewIcon, privatePortIcon, stopForwardIcon } from "./remoteIcons.js";
import { IExternalUriOpenerService } from "../../externalUriOpener/common/externalUriOpenerService.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { isMacintosh } from "../../../../base/common/platform.js";
import { WorkbenchTable } from "../../../../platform/list/browser/listService.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { registerColor } from "../../../../platform/theme/common/colorRegistry.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { STATUS_BAR_REMOTE_ITEM_BACKGROUND } from "../../../common/theme.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { defaultButtonStyles, defaultInputBoxStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { TunnelCloseReason, TunnelSource, forwardedPortsViewEnabled, makeAddress, mapHasAddressLocalhostOrAllInterfaces, parseAddress } from "../../../services/remote/common/tunnelModel.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
const openPreviewEnabledContext = new RawContextKey("openPreviewEnabled", false);
class TunnelTreeVirtualDelegate {
  constructor(remoteExplorerService) {
    this.remoteExplorerService = remoteExplorerService;
    this.headerRowHeight = 22;
  }
  getHeight(row) {
    return row.tunnelType === TunnelType.Add && !this.remoteExplorerService.getEditableData(void 0) ? 30 : 22;
  }
}
let TunnelViewModel = class {
  constructor(remoteExplorerService, tunnelService) {
    this.remoteExplorerService = remoteExplorerService;
    this.tunnelService = tunnelService;
    this._candidates = /* @__PURE__ */ new Map();
    this.input = {
      label: nls.localize("remote.tunnelsView.addPort", "Add Port"),
      icon: void 0,
      tunnelType: TunnelType.Add,
      hasRunningProcess: false,
      remoteHost: "",
      remotePort: 0,
      processDescription: "",
      tooltipPostfix: "",
      iconTooltip: "",
      portTooltip: "",
      processTooltip: "",
      originTooltip: "",
      privacyTooltip: "",
      source: { source: TunnelSource.User, description: "" },
      protocol: TunnelProtocol.Http,
      privacy: {
        id: TunnelPrivacyId.Private,
        themeIcon: privatePortIcon.id,
        label: nls.localize("tunnelPrivacy.private", "Private")
      },
      strip: () => void 0
    };
    this.model = remoteExplorerService.tunnelModel;
    this.onForwardedPortsChanged = Event.any(this.model.onForwardPort, this.model.onClosePort, this.model.onPortName, this.model.onCandidatesChanged);
  }
  get all() {
    const result = [];
    this._candidates = /* @__PURE__ */ new Map();
    this.model.candidates.forEach((candidate) => {
      this._candidates.set(makeAddress(candidate.host, candidate.port), candidate);
    });
    if (this.model.forwarded.size > 0 || this.remoteExplorerService.getEditableData(void 0)) {
      result.push(...this.forwarded);
    }
    if (this.model.detected.size > 0) {
      result.push(...this.detected);
    }
    result.push(this.input);
    return result;
  }
  addProcessInfoFromCandidate(tunnelItem) {
    const key = makeAddress(tunnelItem.remoteHost, tunnelItem.remotePort);
    if (this._candidates.has(key)) {
      tunnelItem.processDescription = this._candidates.get(key).detail;
    }
  }
  get forwarded() {
    const forwarded = Array.from(this.model.forwarded.values()).map((tunnel) => {
      const tunnelItem = TunnelItem.createFromTunnel(this.remoteExplorerService, this.tunnelService, tunnel);
      this.addProcessInfoFromCandidate(tunnelItem);
      return tunnelItem;
    }).sort((a, b) => {
      if (a.remotePort === b.remotePort) {
        return a.remoteHost < b.remoteHost ? -1 : 1;
      } else {
        return a.remotePort < b.remotePort ? -1 : 1;
      }
    });
    return forwarded;
  }
  get detected() {
    return Array.from(this.model.detected.values()).map((tunnel) => {
      const tunnelItem = TunnelItem.createFromTunnel(this.remoteExplorerService, this.tunnelService, tunnel, TunnelType.Detected, false);
      this.addProcessInfoFromCandidate(tunnelItem);
      return tunnelItem;
    });
  }
  isEmpty() {
    return this.detected.length === 0 && (this.forwarded.length === 0 || this.forwarded.length === 1 && this.forwarded[0].tunnelType === TunnelType.Add && !this.remoteExplorerService.getEditableData(void 0));
  }
};
TunnelViewModel = __decorateClass([
  __decorateParam(0, IRemoteExplorerService),
  __decorateParam(1, ITunnelService)
], TunnelViewModel);
function emptyCell(item) {
  return { label: "", tunnel: item, editId: TunnelEditId.None, tooltip: "" };
}
class IconColumn {
  constructor() {
    this.label = "";
    this.tooltip = "";
    this.weight = 1;
    this.minimumWidth = 40;
    this.maximumWidth = 40;
    this.templateId = "actionbar";
  }
  project(row) {
    if (row.tunnelType === TunnelType.Add) {
      return emptyCell(row);
    }
    const icon = row.processDescription ? forwardedPortWithProcessIcon : forwardedPortWithoutProcessIcon;
    let tooltip = "";
    if (row instanceof TunnelItem) {
      tooltip = `${row.iconTooltip} ${row.tooltipPostfix}`;
    }
    return {
      label: "",
      icon,
      tunnel: row,
      editId: TunnelEditId.None,
      tooltip
    };
  }
}
class PortColumn {
  constructor() {
    this.label = nls.localize("tunnel.portColumn.label", "Port");
    this.tooltip = nls.localize("tunnel.portColumn.tooltip", "The label and remote port number of the forwarded port.");
    this.weight = 1;
    this.templateId = "actionbar";
  }
  project(row) {
    const isAdd = row.tunnelType === TunnelType.Add;
    const label = row.label;
    let tooltip = "";
    if (row instanceof TunnelItem && !isAdd) {
      tooltip = `${row.portTooltip} ${row.tooltipPostfix}`;
    } else {
      tooltip = label;
    }
    return {
      label,
      tunnel: row,
      menuId: MenuId.TunnelPortInline,
      editId: row.tunnelType === TunnelType.Add ? TunnelEditId.New : TunnelEditId.Label,
      tooltip
    };
  }
}
class LocalAddressColumn {
  constructor() {
    this.label = nls.localize("tunnel.addressColumn.label", "Forwarded Address");
    this.tooltip = nls.localize("tunnel.addressColumn.tooltip", "The address that the forwarded port is available at.");
    this.weight = 1;
    this.templateId = "actionbar";
  }
  project(row) {
    if (row.tunnelType === TunnelType.Add) {
      return emptyCell(row);
    }
    const label = row.localAddress ?? "";
    let tooltip = label;
    if (row instanceof TunnelItem) {
      tooltip = row.tooltipPostfix;
    }
    return {
      label,
      menuId: MenuId.TunnelLocalAddressInline,
      tunnel: row,
      editId: TunnelEditId.LocalPort,
      tooltip,
      markdownTooltip: label ? LocalAddressColumn.getHoverText(label) : void 0
    };
  }
  static getHoverText(localAddress) {
    return function(configurationService) {
      const editorConf = configurationService.getValue("editor");
      let clickLabel = "";
      if (editorConf.multiCursorModifier === "ctrlCmd") {
        if (isMacintosh) {
          clickLabel = nls.localize("portsLink.followLinkAlt.mac", "option + click");
        } else {
          clickLabel = nls.localize("portsLink.followLinkAlt", "alt + click");
        }
      } else {
        if (isMacintosh) {
          clickLabel = nls.localize("portsLink.followLinkCmd", "cmd + click");
        } else {
          clickLabel = nls.localize("portsLink.followLinkCtrl", "ctrl + click");
        }
      }
      const markdown = new MarkdownString("", true);
      const uri = localAddress.startsWith("http") ? localAddress : `http://${localAddress}`;
      return markdown.appendLink(uri, "Follow link").appendMarkdown(` (${clickLabel})`);
    };
  }
}
class RunningProcessColumn {
  constructor() {
    this.label = nls.localize("tunnel.processColumn.label", "Running Process");
    this.tooltip = nls.localize("tunnel.processColumn.tooltip", "The command line of the process that is using the port.");
    this.weight = 2;
    this.templateId = "actionbar";
  }
  project(row) {
    if (row.tunnelType === TunnelType.Add) {
      return emptyCell(row);
    }
    const label = row.processDescription ?? "";
    return { label, tunnel: row, editId: TunnelEditId.None, tooltip: row instanceof TunnelItem ? row.processTooltip : "" };
  }
}
class OriginColumn {
  constructor() {
    this.label = nls.localize("tunnel.originColumn.label", "Origin");
    this.tooltip = nls.localize("tunnel.originColumn.tooltip", "The source that a forwarded port originates from. Can be an extension, user forwarded, statically forwarded, or automatically forwarded.");
    this.weight = 1;
    this.templateId = "actionbar";
  }
  project(row) {
    if (row.tunnelType === TunnelType.Add) {
      return emptyCell(row);
    }
    const label = row.source.description;
    const tooltip = `${row instanceof TunnelItem ? row.originTooltip : ""}. ${row instanceof TunnelItem ? row.tooltipPostfix : ""}`;
    return { label, menuId: MenuId.TunnelOriginInline, tunnel: row, editId: TunnelEditId.None, tooltip };
  }
}
class PrivacyColumn {
  constructor() {
    this.label = nls.localize("tunnel.privacyColumn.label", "Visibility");
    this.tooltip = nls.localize("tunnel.privacyColumn.tooltip", "The availability of the forwarded port.");
    this.weight = 1;
    this.templateId = "actionbar";
  }
  project(row) {
    if (row.tunnelType === TunnelType.Add) {
      return emptyCell(row);
    }
    const label = row.privacy?.label;
    let tooltip = "";
    if (row instanceof TunnelItem) {
      tooltip = `${row.privacy.label} ${row.tooltipPostfix}`;
    }
    return { label, tunnel: row, icon: { id: row.privacy.themeIcon }, editId: TunnelEditId.None, tooltip };
  }
}
let ActionBarRenderer = class {
  constructor(instantiationService, contextKeyService, menuService, contextViewService, remoteExplorerService, commandService, configurationService) {
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.menuService = menuService;
    this.contextViewService = contextViewService;
    this.remoteExplorerService = remoteExplorerService;
    this.commandService = commandService;
    this.configurationService = configurationService;
    this.templateId = "actionbar";
    this._hoverDelegate = getDefaultHoverDelegate("mouse");
  }
  set actionRunner(actionRunner) {
    this._actionRunner = actionRunner;
  }
  renderTemplate(container) {
    const cell = dom.append(container, dom.$(".ports-view-actionbar-cell"));
    const icon = dom.append(cell, dom.$(".ports-view-actionbar-cell-icon"));
    const templateDisposables = new DisposableStore();
    const elementDisposables = new DisposableStore();
    templateDisposables.add(elementDisposables);
    const label = templateDisposables.add(new IconLabel(
      cell,
      {
        supportHighlights: true,
        hoverDelegate: this._hoverDelegate
      }
    ));
    const actionsContainer = dom.append(cell, dom.$(".actions"));
    const actionBar = templateDisposables.add(new ActionBar(actionsContainer, {
      actionViewItemProvider: createActionViewItem.bind(void 0, this.instantiationService),
      hoverDelegate: this._hoverDelegate
    }));
    return { label, icon, actionBar, container: cell, templateDisposables, elementDisposables };
  }
  renderElement(element, index, templateData) {
    templateData.actionBar.clear();
    templateData.icon.className = "ports-view-actionbar-cell-icon";
    templateData.icon.style.display = "none";
    templateData.label.setLabel("");
    templateData.label.element.style.display = "none";
    templateData.container.style.height = "22px";
    if (templateData.button) {
      templateData.button.element.style.display = "none";
    }
    templateData.container.style.paddingLeft = "0px";
    templateData.elementDisposables.clear();
    let editableData;
    if (element.editId === TunnelEditId.New && (editableData = this.remoteExplorerService.getEditableData(void 0))) {
      this.renderInputBox(templateData, editableData);
    } else {
      editableData = this.remoteExplorerService.getEditableData(element.tunnel, element.editId);
      if (editableData) {
        this.renderInputBox(templateData, editableData);
      } else if (element.tunnel.tunnelType === TunnelType.Add && element.menuId === MenuId.TunnelPortInline) {
        this.renderButton(element, templateData);
      } else {
        this.renderActionBarItem(element, templateData);
      }
    }
  }
  renderButton(element, templateData) {
    templateData.container.style.paddingLeft = "7px";
    templateData.container.style.height = "28px";
    templateData.button = templateData.elementDisposables.add(new Button(templateData.container, defaultButtonStyles));
    templateData.button.label = element.label;
    templateData.button.element.title = element.tooltip;
    templateData.elementDisposables.add(templateData.button.onDidClick(() => {
      this.commandService.executeCommand(ForwardPortAction.INLINE_ID);
    }));
  }
  tunnelContext(tunnel) {
    let context;
    if (tunnel instanceof TunnelItem) {
      context = tunnel.strip();
    }
    if (!context) {
      context = {
        tunnelType: tunnel.tunnelType,
        remoteHost: tunnel.remoteHost,
        remotePort: tunnel.remotePort,
        localAddress: tunnel.localAddress,
        protocol: tunnel.protocol,
        localUri: tunnel.localUri,
        localPort: tunnel.localPort,
        name: tunnel.name,
        closeable: tunnel.closeable,
        source: tunnel.source,
        privacy: tunnel.privacy,
        processDescription: tunnel.processDescription,
        label: tunnel.label
      };
    }
    return context;
  }
  renderActionBarItem(element, templateData) {
    templateData.label.element.style.display = "flex";
    templateData.label.setLabel(
      element.label,
      void 0,
      {
        title: element.markdownTooltip ? { markdown: element.markdownTooltip(this.configurationService), markdownNotSupportedFallback: element.tooltip } : element.tooltip,
        extraClasses: element.menuId === MenuId.TunnelLocalAddressInline ? ["ports-view-actionbar-cell-localaddress"] : void 0
      }
    );
    templateData.actionBar.context = this.tunnelContext(element.tunnel);
    templateData.container.style.paddingLeft = "10px";
    const context = [
      ["view", TUNNEL_VIEW_ID],
      [TunnelTypeContextKey.key, element.tunnel.tunnelType],
      [TunnelCloseableContextKey.key, element.tunnel.closeable],
      [TunnelPrivacyContextKey.key, element.tunnel.privacy.id],
      [TunnelProtocolContextKey.key, element.tunnel.protocol]
    ];
    const contextKeyService = this.contextKeyService.createOverlay(context);
    if (element.menuId) {
      const menu = templateData.elementDisposables.add(this.menuService.createMenu(element.menuId, contextKeyService));
      let actions = getFlatActionBarActions(menu.getActions({ shouldForwardArgs: true }));
      if (actions) {
        const labelActions = actions.filter((action) => action.id.toLowerCase().indexOf("label") >= 0);
        if (labelActions.length > 1) {
          labelActions.sort((a, b) => a.label.length - b.label.length);
          labelActions.pop();
          actions = actions.filter((action) => labelActions.indexOf(action) < 0);
        }
        templateData.actionBar.push(actions, { icon: true, label: false });
        if (this._actionRunner) {
          templateData.actionBar.actionRunner = this._actionRunner;
        }
      }
    }
    if (element.icon) {
      templateData.icon.className = `ports-view-actionbar-cell-icon ${ThemeIcon.asClassName(element.icon)}`;
      templateData.icon.title = element.tooltip;
      templateData.icon.style.display = "inline";
    }
  }
  renderInputBox(templateData, editableData) {
    if (this.inputDone) {
      this.inputDone(false, false);
      this.inputDone = void 0;
    }
    const { container } = templateData;
    container.style.paddingLeft = "5px";
    const value = editableData.startingValue || "";
    const inputBox = new InputBox(container, this.contextViewService, {
      ariaLabel: nls.localize("remote.tunnelsView.input", "Press Enter to confirm or Escape to cancel."),
      validationOptions: {
        validation: (value2) => {
          const message = editableData.validationMessage(value2);
          if (!message) {
            return null;
          }
          return {
            content: message.content,
            formatContent: true,
            type: message.severity === Severity.Error ? MessageType.ERROR : MessageType.INFO
          };
        }
      },
      placeholder: editableData.placeholder || "",
      inputBoxStyles: defaultInputBoxStyles
    });
    inputBox.value = value;
    inputBox.focus();
    inputBox.select({ start: 0, end: editableData.startingValue ? editableData.startingValue.length : 0 });
    const done = createSingleCallFunction(async (success, finishEditing) => {
      dispose(toDispose);
      if (this.inputDone) {
        this.inputDone = void 0;
      }
      inputBox.element.style.display = "none";
      const inputValue = inputBox.value;
      if (finishEditing) {
        return editableData.onFinish(inputValue, success);
      }
    });
    this.inputDone = done;
    const toDispose = [
      inputBox,
      dom.addStandardDisposableListener(inputBox.inputElement, dom.EventType.KEY_DOWN, async (e) => {
        if (e.equals(KeyCode.Enter)) {
          e.stopPropagation();
          if (inputBox.validate() !== MessageType.ERROR) {
            return done(true, true);
          } else {
            return done(false, true);
          }
        } else if (e.equals(KeyCode.Escape)) {
          e.preventDefault();
          e.stopPropagation();
          return done(false, true);
        }
      }),
      dom.addDisposableListener(inputBox.inputElement, dom.EventType.BLUR, () => {
        return done(inputBox.validate() !== MessageType.ERROR, true);
      })
    ];
    templateData.elementDisposables.add(toDisposable(() => {
      done(false, false);
    }));
  }
  disposeElement(element, index, templateData) {
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
};
ActionBarRenderer = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IMenuService),
  __decorateParam(3, IContextViewService),
  __decorateParam(4, IRemoteExplorerService),
  __decorateParam(5, ICommandService),
  __decorateParam(6, IConfigurationService)
], ActionBarRenderer);
class TunnelItem {
  constructor(tunnelType, remoteHost, remotePort, source, hasRunningProcess, protocol, localUri, localAddress, localPort, closeable, name, runningProcess, pid, _privacy, remoteExplorerService, tunnelService) {
    this.tunnelType = tunnelType;
    this.remoteHost = remoteHost;
    this.remotePort = remotePort;
    this.source = source;
    this.hasRunningProcess = hasRunningProcess;
    this.protocol = protocol;
    this.localUri = localUri;
    this.localAddress = localAddress;
    this.localPort = localPort;
    this.closeable = closeable;
    this.name = name;
    this.runningProcess = runningProcess;
    this.pid = pid;
    this._privacy = _privacy;
    this.remoteExplorerService = remoteExplorerService;
    this.tunnelService = tunnelService;
  }
  static createFromTunnel(remoteExplorerService, tunnelService, tunnel, type = TunnelType.Forwarded, closeable) {
    return new TunnelItem(
      type,
      tunnel.remoteHost,
      tunnel.remotePort,
      tunnel.source,
      !!tunnel.hasRunningProcess,
      tunnel.protocol,
      tunnel.localUri,
      tunnel.localAddress,
      tunnel.localPort,
      closeable === void 0 ? tunnel.closeable : closeable,
      tunnel.name,
      tunnel.runningProcess,
      tunnel.pid,
      tunnel.privacy,
      remoteExplorerService,
      tunnelService
    );
  }
  /**
   * Removes all non-serializable properties from the tunnel
   * @returns A new TunnelItem without any services
   */
  strip() {
    return new TunnelItem(
      this.tunnelType,
      this.remoteHost,
      this.remotePort,
      this.source,
      this.hasRunningProcess,
      this.protocol,
      this.localUri,
      this.localAddress,
      this.localPort,
      this.closeable,
      this.name,
      this.runningProcess,
      this.pid,
      this._privacy
    );
  }
  get label() {
    if (this.tunnelType === TunnelType.Add && this.name) {
      return this.name;
    }
    const portNumberLabel = isLocalhost(this.remoteHost) || isAllInterfaces(this.remoteHost) ? `${this.remotePort}` : `${this.remoteHost}:${this.remotePort}`;
    if (this.name) {
      return `${this.name} (${portNumberLabel})`;
    } else {
      return portNumberLabel;
    }
  }
  set processDescription(description) {
    this.runningProcess = description;
  }
  get processDescription() {
    let description = "";
    if (this.runningProcess) {
      if (this.pid && this.remoteExplorerService?.namedProcesses.has(this.pid)) {
        description = this.remoteExplorerService.namedProcesses.get(this.pid);
      } else {
        description = this.runningProcess.replace(/\0/g, " ").trim();
      }
      if (this.pid) {
        description += ` (${this.pid})`;
      }
    } else if (this.hasRunningProcess) {
      description = nls.localize("tunnelView.runningProcess.inacessable", "Process information unavailable");
    }
    return description;
  }
  get tooltipPostfix() {
    let information;
    if (this.localAddress) {
      information = nls.localize("remote.tunnel.tooltipForwarded", "Remote port {0}:{1} forwarded to local address {2}. ", this.remoteHost, this.remotePort, this.localAddress);
    } else {
      information = nls.localize("remote.tunnel.tooltipCandidate", "Remote port {0}:{1} not forwarded. ", this.remoteHost, this.remotePort);
    }
    return information;
  }
  get iconTooltip() {
    const isAdd = this.tunnelType === TunnelType.Add;
    if (!isAdd) {
      return `${this.processDescription ? nls.localize("tunnel.iconColumn.running", "Port has running process.") : nls.localize("tunnel.iconColumn.notRunning", "No running process.")}`;
    } else {
      return this.label;
    }
  }
  get portTooltip() {
    const isAdd = this.tunnelType === TunnelType.Add;
    if (!isAdd) {
      return `${this.name ? nls.localize("remote.tunnel.tooltipName", "Port labeled {0}. ", this.name) : ""}`;
    } else {
      return "";
    }
  }
  get processTooltip() {
    return this.processDescription ?? "";
  }
  get originTooltip() {
    return this.source.description;
  }
  get privacy() {
    if (this.tunnelService?.privacyOptions) {
      return this.tunnelService?.privacyOptions.find((element) => element.id === this._privacy) ?? {
        id: "",
        themeIcon: Codicon.question.id,
        label: nls.localize("tunnelPrivacy.unknown", "Unknown")
      };
    } else {
      return {
        id: TunnelPrivacyId.Private,
        themeIcon: privatePortIcon.id,
        label: nls.localize("tunnelPrivacy.private", "Private")
      };
    }
  }
}
const TunnelTypeContextKey = new RawContextKey("tunnelType", TunnelType.Add, true);
const TunnelCloseableContextKey = new RawContextKey("tunnelCloseable", false, true);
const TunnelPrivacyContextKey = new RawContextKey("tunnelPrivacy", void 0, true);
const TunnelPrivacyEnabledContextKey = new RawContextKey("tunnelPrivacyEnabled", false, true);
const TunnelProtocolContextKey = new RawContextKey("tunnelProtocol", TunnelProtocol.Http, true);
const TunnelViewFocusContextKey = new RawContextKey("tunnelViewFocus", false, nls.localize("tunnel.focusContext", "Whether the Ports view has focus."));
const TunnelViewSelectionKeyName = "tunnelViewSelection";
const TunnelViewSelectionContextKey = new RawContextKey(TunnelViewSelectionKeyName, void 0, true);
const TunnelViewMultiSelectionKeyName = "tunnelViewMultiSelection";
const TunnelViewMultiSelectionContextKey = new RawContextKey(TunnelViewMultiSelectionKeyName, void 0, true);
const PortChangableContextKey = new RawContextKey("portChangable", false, true);
const ProtocolChangeableContextKey = new RawContextKey("protocolChangable", true, true);
let TunnelPanel = class extends ViewPane {
  constructor(viewModel, options, keybindingService, contextMenuService, contextKeyService, configurationService, instantiationService, viewDescriptorService, openerService, quickInputService, commandService, menuService, themeService, remoteExplorerService, hoverService, tunnelService, contextViewService) {
    super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.viewModel = viewModel;
    this.quickInputService = quickInputService;
    this.commandService = commandService;
    this.menuService = menuService;
    this.remoteExplorerService = remoteExplorerService;
    this.tunnelService = tunnelService;
    this.contextViewService = contextViewService;
    this.tableDisposables = this._register(new DisposableStore());
    this.isEditing = false;
    // TODO: Should this be removed?
    //@ts-expect-error
    this.titleActions = [];
    this.lastFocus = [];
    this.height = 0;
    this.width = 0;
    this.tunnelTypeContext = TunnelTypeContextKey.bindTo(contextKeyService);
    this.tunnelCloseableContext = TunnelCloseableContextKey.bindTo(contextKeyService);
    this.tunnelPrivacyContext = TunnelPrivacyContextKey.bindTo(contextKeyService);
    this.tunnelPrivacyEnabledContext = TunnelPrivacyEnabledContextKey.bindTo(contextKeyService);
    this.tunnelPrivacyEnabledContext.set(tunnelService.canChangePrivacy);
    this.protocolChangableContextKey = ProtocolChangeableContextKey.bindTo(contextKeyService);
    this.protocolChangableContextKey.set(tunnelService.canChangeProtocol);
    this.tunnelProtocolContext = TunnelProtocolContextKey.bindTo(contextKeyService);
    this.tunnelViewFocusContext = TunnelViewFocusContextKey.bindTo(contextKeyService);
    this.tunnelViewSelectionContext = TunnelViewSelectionContextKey.bindTo(contextKeyService);
    this.tunnelViewMultiSelectionContext = TunnelViewMultiSelectionContextKey.bindTo(contextKeyService);
    this.portChangableContextKey = PortChangableContextKey.bindTo(contextKeyService);
    const overlayContextKeyService = this.contextKeyService.createOverlay([["view", TunnelPanel.ID]]);
    const titleMenu = this._register(this.menuService.createMenu(MenuId.TunnelTitle, overlayContextKeyService));
    const updateActions = () => {
      this.titleActions = getFlatActionBarActions(titleMenu.getActions());
      this.updateActions();
    };
    this._register(titleMenu.onDidChange(updateActions));
    updateActions();
    this._register(toDisposable(() => {
      this.titleActions = [];
    }));
    this.registerPrivacyActions();
    this._register(Event.once(this.tunnelService.onAddedTunnelProvider)(() => {
      let updated = false;
      if (this.tunnelPrivacyEnabledContext.get() === false) {
        this.tunnelPrivacyEnabledContext.set(tunnelService.canChangePrivacy);
        updated = true;
      }
      if (this.protocolChangableContextKey.get() === true) {
        this.protocolChangableContextKey.set(tunnelService.canChangeProtocol);
        updated = true;
      }
      if (updated) {
        updateActions();
        this.registerPrivacyActions();
        this.createTable();
        this.table?.layout(this.height, this.width);
      }
    }));
  }
  static {
    this.ID = TUNNEL_VIEW_ID;
  }
  static {
    this.TITLE = nls.localize2("remote.tunnel", "Ports");
  }
  registerPrivacyActions() {
    for (const privacyOption of this.tunnelService.privacyOptions) {
      const optionId = `remote.tunnel.privacy${privacyOption.id}`;
      CommandsRegistry.registerCommand(optionId, ChangeTunnelPrivacyAction.handler(privacyOption.id));
      MenuRegistry.appendMenuItem(MenuId.TunnelPrivacy, {
        order: 0,
        command: {
          id: optionId,
          title: privacyOption.label,
          toggled: TunnelPrivacyContextKey.isEqualTo(privacyOption.id)
        }
      });
    }
  }
  get portCount() {
    return this.remoteExplorerService.tunnelModel.forwarded.size + this.remoteExplorerService.tunnelModel.detected.size;
  }
  createTable() {
    if (!this.panelContainer) {
      return;
    }
    this.tableDisposables.clear();
    dom.clearNode(this.panelContainer);
    const widgetContainer = dom.append(this.panelContainer, dom.$(".customview-tree"));
    widgetContainer.classList.add("ports-view");
    widgetContainer.classList.add("file-icon-themable-tree", "show-file-icons");
    const actionBarRenderer = new ActionBarRenderer(
      this.instantiationService,
      this.contextKeyService,
      this.menuService,
      this.contextViewService,
      this.remoteExplorerService,
      this.commandService,
      this.configurationService
    );
    const columns = [new IconColumn(), new PortColumn(), new LocalAddressColumn(), new RunningProcessColumn()];
    if (this.tunnelService.canChangePrivacy) {
      columns.push(new PrivacyColumn());
    }
    columns.push(new OriginColumn());
    this.table = this.instantiationService.createInstance(
      WorkbenchTable,
      "RemoteTunnels",
      widgetContainer,
      new TunnelTreeVirtualDelegate(this.remoteExplorerService),
      columns,
      [actionBarRenderer],
      {
        keyboardNavigationLabelProvider: {
          getKeyboardNavigationLabel: (item) => {
            return item.label;
          }
        },
        multipleSelectionSupport: true,
        accessibilityProvider: {
          getAriaLabel: (item) => {
            if (item instanceof TunnelItem) {
              return `${item.tooltipPostfix} ${item.portTooltip} ${item.iconTooltip} ${item.processTooltip} ${item.originTooltip} ${this.tunnelService.canChangePrivacy ? item.privacy.label : ""}`;
            } else {
              return item.label;
            }
          },
          getWidgetAriaLabel: () => nls.localize("tunnelView", "Tunnel View")
        },
        openOnSingleClick: true
      }
    );
    const actionRunner = this.tableDisposables.add(new ActionRunner());
    actionBarRenderer.actionRunner = actionRunner;
    this.tableDisposables.add(this.table);
    this.tableDisposables.add(this.table.onContextMenu((e) => this.onContextMenu(e, actionRunner)));
    this.tableDisposables.add(this.table.onMouseDblClick((e) => this.onMouseDblClick(e)));
    this.tableDisposables.add(this.table.onDidChangeFocus((e) => this.onFocusChanged(e)));
    this.tableDisposables.add(this.table.onDidChangeSelection((e) => this.onSelectionChanged(e)));
    this.tableDisposables.add(this.table.onDidFocus(() => this.tunnelViewFocusContext.set(true)));
    this.tableDisposables.add(this.table.onDidBlur(() => this.tunnelViewFocusContext.set(false)));
    const rerender = () => this.table?.splice(0, Number.POSITIVE_INFINITY, this.viewModel.all);
    rerender();
    let lastPortCount = this.portCount;
    this.tableDisposables.add(Event.debounce(this.viewModel.onForwardedPortsChanged, (_last, e) => e, 50)(() => {
      const newPortCount = this.portCount;
      if ((lastPortCount === 0 || newPortCount === 0) && lastPortCount !== newPortCount) {
        this._onDidChangeViewWelcomeState.fire();
      }
      lastPortCount = newPortCount;
      rerender();
    }));
    this.tableDisposables.add(this.table.onMouseClick((e) => {
      if (this.hasOpenLinkModifier(e.browserEvent) && this.table) {
        const selection = this.table.getSelectedElements();
        if (selection.length === 0 || selection.length === 1 && selection[0] === e.element) {
          this.commandService.executeCommand(OpenPortInBrowserAction.ID, e.element);
        }
      }
    }));
    this.tableDisposables.add(this.table.onDidOpen((e) => {
      if (!e.element || e.element.tunnelType !== TunnelType.Forwarded) {
        return;
      }
      if (e.browserEvent?.type === "dblclick") {
        this.commandService.executeCommand(LabelTunnelAction.ID);
      }
    }));
    this.tableDisposables.add(this.remoteExplorerService.onDidChangeEditable((e) => {
      this.isEditing = !!this.remoteExplorerService.getEditableData(e?.tunnel, e?.editId);
      this._onDidChangeViewWelcomeState.fire();
      if (!this.isEditing) {
        widgetContainer.classList.remove("highlight");
      }
      rerender();
      if (this.isEditing) {
        widgetContainer.classList.add("highlight");
        if (!e) {
          this.table?.reveal(this.table.indexOf(this.viewModel.input));
        }
      } else {
        if (e && e.tunnel.tunnelType !== TunnelType.Add) {
          this.table?.setFocus(this.lastFocus);
        }
        this.focus();
      }
    }));
  }
  renderBody(container) {
    super.renderBody(container);
    this.panelContainer = dom.append(container, dom.$(".tree-explorer-viewlet-tree-view"));
    this.createTable();
  }
  shouldShowWelcome() {
    return this.viewModel.isEmpty() && !this.isEditing;
  }
  focus() {
    super.focus();
    this.table?.domFocus();
  }
  onFocusChanged(event) {
    if (event.indexes.length > 0 && event.elements.length > 0) {
      this.lastFocus = [...event.indexes];
    }
    const elements = event.elements;
    const item = elements && elements.length ? elements[0] : void 0;
    if (item) {
      this.tunnelViewSelectionContext.set(makeAddress(item.remoteHost, item.remotePort));
      this.tunnelTypeContext.set(item.tunnelType);
      this.tunnelCloseableContext.set(!!item.closeable);
      this.tunnelPrivacyContext.set(item.privacy.id);
      this.tunnelProtocolContext.set(item.protocol === TunnelProtocol.Https ? TunnelProtocol.Https : TunnelProtocol.Http);
      this.portChangableContextKey.set(!!item.localPort);
    } else {
      this.tunnelTypeContext.reset();
      this.tunnelViewSelectionContext.reset();
      this.tunnelCloseableContext.reset();
      this.tunnelPrivacyContext.reset();
      this.tunnelProtocolContext.reset();
      this.portChangableContextKey.reset();
    }
  }
  hasOpenLinkModifier(e) {
    const editorConf = this.configurationService.getValue("editor");
    let modifierKey = false;
    if (editorConf.multiCursorModifier === "ctrlCmd") {
      modifierKey = e.altKey;
    } else {
      if (isMacintosh) {
        modifierKey = e.metaKey;
      } else {
        modifierKey = e.ctrlKey;
      }
    }
    return modifierKey;
  }
  onSelectionChanged(event) {
    const elements = event.elements;
    if (elements.length > 1) {
      this.tunnelViewMultiSelectionContext.set(elements.map((element) => makeAddress(element.remoteHost, element.remotePort)));
    } else {
      this.tunnelViewMultiSelectionContext.set(void 0);
    }
  }
  onContextMenu(event, actionRunner) {
    if (event.element !== void 0 && !(event.element instanceof TunnelItem)) {
      return;
    }
    event.browserEvent.preventDefault();
    event.browserEvent.stopPropagation();
    const node = event.element;
    if (node) {
      this.table?.setFocus([this.table.indexOf(node)]);
      this.tunnelTypeContext.set(node.tunnelType);
      this.tunnelCloseableContext.set(!!node.closeable);
      this.tunnelPrivacyContext.set(node.privacy.id);
      this.tunnelProtocolContext.set(node.protocol);
      this.portChangableContextKey.set(!!node.localPort);
    } else {
      this.tunnelTypeContext.set(TunnelType.Add);
      this.tunnelCloseableContext.set(false);
      this.tunnelPrivacyContext.set(void 0);
      this.tunnelProtocolContext.set(void 0);
      this.portChangableContextKey.set(false);
    }
    this.contextMenuService.showContextMenu({
      menuId: MenuId.TunnelContext,
      menuActionOptions: { shouldForwardArgs: true },
      contextKeyService: this.table?.contextKeyService,
      getAnchor: () => event.anchor,
      getActionViewItem: (action) => {
        const keybinding = this.keybindingService.lookupKeybinding(action.id);
        if (keybinding) {
          return new ActionViewItem(action, action, { label: true, keybinding: keybinding.getLabel() });
        }
        return void 0;
      },
      onHide: (wasCancelled) => {
        if (wasCancelled) {
          this.table?.domFocus();
        }
      },
      getActionsContext: () => node?.strip(),
      actionRunner
    });
  }
  onMouseDblClick(e) {
    if (!e.element) {
      this.commandService.executeCommand(ForwardPortAction.INLINE_ID);
    }
  }
  layoutBody(height, width) {
    this.height = height;
    this.width = width;
    super.layoutBody(height, width);
    this.table?.layout(height, width);
  }
};
TunnelPanel = __decorateClass([
  __decorateParam(2, IKeybindingService),
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IViewDescriptorService),
  __decorateParam(8, IOpenerService),
  __decorateParam(9, IQuickInputService),
  __decorateParam(10, ICommandService),
  __decorateParam(11, IMenuService),
  __decorateParam(12, IThemeService),
  __decorateParam(13, IRemoteExplorerService),
  __decorateParam(14, IHoverService),
  __decorateParam(15, ITunnelService),
  __decorateParam(16, IContextViewService)
], TunnelPanel);
class TunnelPanelDescriptor {
  constructor(viewModel, environmentService) {
    this.id = TunnelPanel.ID;
    this.name = TunnelPanel.TITLE;
    this.canToggleVisibility = true;
    this.hideByDefault = false;
    // group is not actually used for views that are not extension contributed. Use order instead.
    this.group = "details@0";
    // -500 comes from the remote explorer viewOrderDelegate
    this.order = -500;
    this.canMoveView = true;
    this.containerIcon = portsViewIcon;
    this.ctorDescriptor = new SyncDescriptor(TunnelPanel, [viewModel]);
    this.remoteAuthority = environmentService.remoteAuthority ? environmentService.remoteAuthority.split("+")[0] : void 0;
  }
}
function isITunnelItem(item) {
  return item && item.tunnelType && item.remoteHost && item.source;
}
var LabelTunnelAction;
((LabelTunnelAction2) => {
  LabelTunnelAction2.ID = "remote.tunnel.label";
  LabelTunnelAction2.LABEL = nls.localize("remote.tunnel.label", "Set Port Label");
  LabelTunnelAction2.COMMAND_ID_KEYWORD = "label";
  function handler() {
    return async (accessor, arg) => {
      const remoteExplorerService = accessor.get(IRemoteExplorerService);
      let tunnelContext;
      if (isITunnelItem(arg)) {
        tunnelContext = arg;
      } else {
        const context = accessor.get(IContextKeyService).getContextKeyValue(TunnelViewSelectionKeyName);
        const tunnel = context ? remoteExplorerService.tunnelModel.forwarded.get(context) : void 0;
        if (tunnel) {
          const tunnelService = accessor.get(ITunnelService);
          tunnelContext = TunnelItem.createFromTunnel(remoteExplorerService, tunnelService, tunnel);
        }
      }
      if (tunnelContext) {
        const tunnelItem = tunnelContext;
        return new Promise((resolve) => {
          const startingValue = tunnelItem.name ? tunnelItem.name : `${tunnelItem.remotePort}`;
          remoteExplorerService.setEditable(tunnelItem, TunnelEditId.Label, {
            onFinish: async (value, success) => {
              value = value.trim();
              remoteExplorerService.setEditable(tunnelItem, TunnelEditId.Label, null);
              const changed = success && value !== startingValue;
              if (changed) {
                await remoteExplorerService.tunnelModel.name(tunnelItem.remoteHost, tunnelItem.remotePort, value);
              }
              resolve(changed ? { port: tunnelItem.remotePort, label: value } : void 0);
            },
            validationMessage: () => null,
            placeholder: nls.localize("remote.tunnelsView.labelPlaceholder", "Port label"),
            startingValue
          });
        });
      }
      return void 0;
    };
  }
  LabelTunnelAction2.handler = handler;
})(LabelTunnelAction || (LabelTunnelAction = {}));
const invalidPortString = nls.localize("remote.tunnelsView.portNumberValid", "Forwarded port should be a number or a host:port.");
const maxPortNumber = 65536;
const invalidPortNumberString = nls.localize("remote.tunnelsView.portNumberToHigh", "Port number must be \u2265 0 and < {0}.", maxPortNumber);
const requiresSudoString = nls.localize("remote.tunnelView.inlineElevationMessage", "May Require Sudo");
const alreadyForwarded = nls.localize("remote.tunnelView.alreadyForwarded", "Port is already forwarded");
var ForwardPortAction;
((ForwardPortAction2) => {
  ForwardPortAction2.INLINE_ID = "remote.tunnel.forwardInline";
  ForwardPortAction2.COMMANDPALETTE_ID = "remote.tunnel.forwardCommandPalette";
  ForwardPortAction2.LABEL = nls.localize2("remote.tunnel.forward", "Forward a Port");
  ForwardPortAction2.TREEITEM_LABEL = nls.localize("remote.tunnel.forwardItem", "Forward Port");
  const forwardPrompt = nls.localize("remote.tunnel.forwardPrompt", "Port number or address (eg. 3000 or 10.10.10.10:2000).");
  function validateInput(remoteExplorerService, tunnelService, value, canElevate) {
    const parsed = parseAddress(value);
    if (!parsed) {
      return { content: invalidPortString, severity: Severity.Error };
    } else if (parsed.port >= maxPortNumber) {
      return { content: invalidPortNumberString, severity: Severity.Error };
    } else if (canElevate && tunnelService.isPortPrivileged(parsed.port)) {
      return { content: requiresSudoString, severity: Severity.Info };
    } else if (mapHasAddressLocalhostOrAllInterfaces(remoteExplorerService.tunnelModel.forwarded, parsed.host, parsed.port)) {
      return { content: alreadyForwarded, severity: Severity.Error };
    }
    return null;
  }
  function error(notificationService, tunnelOrError, host, port) {
    if (!tunnelOrError) {
      notificationService.warn(nls.localize("remote.tunnel.forwardError", "Unable to forward {0}:{1}. The host may not be available or that remote port may already be forwarded", host, port));
    } else if (typeof tunnelOrError === "string") {
      notificationService.warn(nls.localize("remote.tunnel.forwardErrorProvided", "Unable to forward {0}:{1}. {2}", host, port, tunnelOrError));
    }
  }
  function inlineHandler() {
    return async (accessor, arg) => {
      const remoteExplorerService = accessor.get(IRemoteExplorerService);
      const notificationService = accessor.get(INotificationService);
      const tunnelService = accessor.get(ITunnelService);
      remoteExplorerService.setEditable(void 0, TunnelEditId.New, {
        onFinish: async (value, success) => {
          remoteExplorerService.setEditable(void 0, TunnelEditId.New, null);
          let parsed;
          if (success && (parsed = parseAddress(value))) {
            remoteExplorerService.forward({
              remote: { host: parsed.host, port: parsed.port },
              elevateIfNeeded: true
            }).then((tunnelOrError) => error(notificationService, tunnelOrError, parsed.host, parsed.port));
          }
        },
        validationMessage: (value) => validateInput(remoteExplorerService, tunnelService, value, tunnelService.canElevate),
        placeholder: forwardPrompt
      });
    };
  }
  ForwardPortAction2.inlineHandler = inlineHandler;
  function commandPaletteHandler() {
    return async (accessor, arg) => {
      const remoteExplorerService = accessor.get(IRemoteExplorerService);
      const notificationService = accessor.get(INotificationService);
      const viewsService = accessor.get(IViewsService);
      const quickInputService = accessor.get(IQuickInputService);
      const tunnelService = accessor.get(ITunnelService);
      await viewsService.openView(TunnelPanel.ID, true);
      const value = await quickInputService.input({
        prompt: forwardPrompt,
        validateInput: (value2) => Promise.resolve(validateInput(remoteExplorerService, tunnelService, value2, tunnelService.canElevate))
      });
      let parsed;
      if (value && (parsed = parseAddress(value))) {
        remoteExplorerService.forward({
          remote: { host: parsed.host, port: parsed.port },
          elevateIfNeeded: true
        }).then((tunnel) => error(notificationService, tunnel, parsed.host, parsed.port));
      }
    };
  }
  ForwardPortAction2.commandPaletteHandler = commandPaletteHandler;
})(ForwardPortAction || (ForwardPortAction = {}));
function makeTunnelPicks(tunnels, remoteExplorerService, tunnelService) {
  const picks = tunnels.map((forwarded) => {
    const item = TunnelItem.createFromTunnel(remoteExplorerService, tunnelService, forwarded);
    return {
      label: item.label,
      description: item.processDescription,
      tunnel: item
    };
  });
  if (picks.length === 0) {
    picks.push({
      label: nls.localize("remote.tunnel.closeNoPorts", "No ports currently forwarded. Try running the {0} command", ForwardPortAction.LABEL.value)
    });
  }
  return picks;
}
var ClosePortAction;
((ClosePortAction2) => {
  ClosePortAction2.INLINE_ID = "remote.tunnel.closeInline";
  ClosePortAction2.COMMANDPALETTE_ID = "remote.tunnel.closeCommandPalette";
  ClosePortAction2.LABEL = nls.localize2("remote.tunnel.close", "Stop Forwarding Port");
  function inlineHandler() {
    return async (accessor, arg) => {
      const contextKeyService = accessor.get(IContextKeyService);
      const remoteExplorerService = accessor.get(IRemoteExplorerService);
      let ports = [];
      const multiSelectContext = contextKeyService.getContextKeyValue(TunnelViewMultiSelectionKeyName);
      if (multiSelectContext) {
        multiSelectContext.forEach((context) => {
          const tunnel = remoteExplorerService.tunnelModel.forwarded.get(context);
          if (tunnel) {
            ports?.push(tunnel);
          }
        });
      } else if (isITunnelItem(arg)) {
        ports = [arg];
      } else {
        const context = contextKeyService.getContextKeyValue(TunnelViewSelectionKeyName);
        const tunnel = context ? remoteExplorerService.tunnelModel.forwarded.get(context) : void 0;
        if (tunnel) {
          ports = [tunnel];
        }
      }
      if (!ports || ports.length === 0) {
        return;
      }
      return Promise.all(ports.map((port) => remoteExplorerService.close({ host: port.remoteHost, port: port.remotePort }, TunnelCloseReason.User)));
    };
  }
  ClosePortAction2.inlineHandler = inlineHandler;
  function commandPaletteHandler() {
    return async (accessor) => {
      const quickInputService = accessor.get(IQuickInputService);
      const remoteExplorerService = accessor.get(IRemoteExplorerService);
      const tunnelService = accessor.get(ITunnelService);
      const commandService = accessor.get(ICommandService);
      const picks = makeTunnelPicks(Array.from(remoteExplorerService.tunnelModel.forwarded.values()).filter((tunnel) => tunnel.closeable), remoteExplorerService, tunnelService);
      const result = await quickInputService.pick(picks, { placeHolder: nls.localize("remote.tunnel.closePlaceholder", "Choose a port to stop forwarding") });
      if (result && result.tunnel) {
        await remoteExplorerService.close({ host: result.tunnel.remoteHost, port: result.tunnel.remotePort }, TunnelCloseReason.User);
      } else if (result) {
        await commandService.executeCommand(ForwardPortAction.COMMANDPALETTE_ID);
      }
    };
  }
  ClosePortAction2.commandPaletteHandler = commandPaletteHandler;
})(ClosePortAction || (ClosePortAction = {}));
var OpenPortInBrowserAction;
((OpenPortInBrowserAction2) => {
  OpenPortInBrowserAction2.ID = "remote.tunnel.open";
  OpenPortInBrowserAction2.LABEL = nls.localize("remote.tunnel.open", "Open in Browser");
  function handler() {
    return async (accessor, arg) => {
      let key;
      if (isITunnelItem(arg)) {
        key = makeAddress(arg.remoteHost, arg.remotePort);
      } else if (isRemoteTunnel(arg)) {
        key = makeAddress(arg.tunnelRemoteHost, arg.tunnelRemotePort);
      }
      if (key) {
        const model = accessor.get(IRemoteExplorerService).tunnelModel;
        const openerService = accessor.get(IOpenerService);
        return run(model, openerService, key);
      }
    };
  }
  OpenPortInBrowserAction2.handler = handler;
  function run(model, openerService, key) {
    const tunnel = model.forwarded.get(key) || model.detected.get(key);
    if (tunnel) {
      return openerService.open(tunnel.localUri, { allowContributedOpeners: false });
    }
    return Promise.resolve();
  }
  OpenPortInBrowserAction2.run = run;
})(OpenPortInBrowserAction || (OpenPortInBrowserAction = {}));
var OpenPortInPreviewAction;
((OpenPortInPreviewAction2) => {
  OpenPortInPreviewAction2.ID = "remote.tunnel.openPreview";
  OpenPortInPreviewAction2.LABEL = nls.localize("remote.tunnel.openPreview", "Preview in Editor");
  function handler() {
    return async (accessor, arg) => {
      let key;
      if (isITunnelItem(arg)) {
        key = makeAddress(arg.remoteHost, arg.remotePort);
      } else if (isRemoteTunnel(arg)) {
        key = makeAddress(arg.tunnelRemoteHost, arg.tunnelRemotePort);
      }
      if (key) {
        const model = accessor.get(IRemoteExplorerService).tunnelModel;
        const openerService = accessor.get(IOpenerService);
        const externalOpenerService = accessor.get(IExternalUriOpenerService);
        return run(model, openerService, externalOpenerService, key);
      }
    };
  }
  OpenPortInPreviewAction2.handler = handler;
  async function run(model, openerService, externalOpenerService, key) {
    const tunnel = model.forwarded.get(key) || model.detected.get(key);
    if (tunnel) {
      const remoteHost = tunnel.remoteHost.includes(":") ? `[${tunnel.remoteHost}]` : tunnel.remoteHost;
      const sourceUri = URI.parse(`http://${remoteHost}:${tunnel.remotePort}`);
      const opener = await externalOpenerService.getOpener(tunnel.localUri, { sourceUri }, CancellationToken.None);
      if (opener) {
        return opener.openExternalUri(tunnel.localUri, { sourceUri }, CancellationToken.None);
      }
      return openerService.open(tunnel.localUri);
    }
    return Promise.resolve();
  }
  OpenPortInPreviewAction2.run = run;
})(OpenPortInPreviewAction || (OpenPortInPreviewAction = {}));
var OpenPortInBrowserCommandPaletteAction;
((OpenPortInBrowserCommandPaletteAction2) => {
  OpenPortInBrowserCommandPaletteAction2.ID = "remote.tunnel.openCommandPalette";
  OpenPortInBrowserCommandPaletteAction2.LABEL = nls.localize("remote.tunnel.openCommandPalette", "Open Port in Browser");
  function handler() {
    return async (accessor, arg) => {
      const remoteExplorerService = accessor.get(IRemoteExplorerService);
      const tunnelService = accessor.get(ITunnelService);
      const model = remoteExplorerService.tunnelModel;
      const quickPickService = accessor.get(IQuickInputService);
      const openerService = accessor.get(IOpenerService);
      const commandService = accessor.get(ICommandService);
      const options = [...model.forwarded, ...model.detected].map((value) => {
        const tunnelItem = TunnelItem.createFromTunnel(remoteExplorerService, tunnelService, value[1]);
        return {
          label: tunnelItem.label,
          description: tunnelItem.processDescription,
          tunnel: tunnelItem
        };
      });
      if (options.length === 0) {
        options.push({
          label: nls.localize("remote.tunnel.openCommandPaletteNone", "No ports currently forwarded. Open the Ports view to get started.")
        });
      } else {
        options.push({
          label: nls.localize("remote.tunnel.openCommandPaletteView", "Open the Ports view...")
        });
      }
      const picked = await quickPickService.pick(options, { placeHolder: nls.localize("remote.tunnel.openCommandPalettePick", "Choose the port to open") });
      if (picked && picked.tunnel) {
        return OpenPortInBrowserAction.run(model, openerService, makeAddress(picked.tunnel.remoteHost, picked.tunnel.remotePort));
      } else if (picked) {
        return commandService.executeCommand(`${TUNNEL_VIEW_ID}.focus`);
      }
    };
  }
  OpenPortInBrowserCommandPaletteAction2.handler = handler;
})(OpenPortInBrowserCommandPaletteAction || (OpenPortInBrowserCommandPaletteAction = {}));
var CopyAddressAction;
((CopyAddressAction2) => {
  CopyAddressAction2.INLINE_ID = "remote.tunnel.copyAddressInline";
  CopyAddressAction2.COMMANDPALETTE_ID = "remote.tunnel.copyAddressCommandPalette";
  CopyAddressAction2.INLINE_LABEL = nls.localize("remote.tunnel.copyAddressInline", "Copy Local Address");
  CopyAddressAction2.COMMANDPALETTE_LABEL = nls.localize("remote.tunnel.copyAddressCommandPalette", "Copy Forwarded Port Address");
  async function copyAddress(remoteExplorerService, clipboardService, tunnelItem) {
    const address = remoteExplorerService.tunnelModel.address(tunnelItem.remoteHost, tunnelItem.remotePort);
    if (address) {
      await clipboardService.writeText(address.toString());
    }
  }
  function inlineHandler() {
    return async (accessor, arg) => {
      const remoteExplorerService = accessor.get(IRemoteExplorerService);
      let tunnelItem;
      if (isITunnelItem(arg)) {
        tunnelItem = arg;
      } else {
        const context = accessor.get(IContextKeyService).getContextKeyValue(TunnelViewSelectionKeyName);
        tunnelItem = context ? remoteExplorerService.tunnelModel.forwarded.get(context) : void 0;
      }
      if (tunnelItem) {
        return copyAddress(remoteExplorerService, accessor.get(IClipboardService), tunnelItem);
      }
    };
  }
  CopyAddressAction2.inlineHandler = inlineHandler;
  function commandPaletteHandler() {
    return async (accessor, arg) => {
      const quickInputService = accessor.get(IQuickInputService);
      const remoteExplorerService = accessor.get(IRemoteExplorerService);
      const tunnelService = accessor.get(ITunnelService);
      const commandService = accessor.get(ICommandService);
      const clipboardService = accessor.get(IClipboardService);
      const tunnels = Array.from(remoteExplorerService.tunnelModel.forwarded.values()).concat(Array.from(remoteExplorerService.tunnelModel.detected.values()));
      const result = await quickInputService.pick(makeTunnelPicks(tunnels, remoteExplorerService, tunnelService), { placeHolder: nls.localize("remote.tunnel.copyAddressPlaceholdter", "Choose a forwarded port") });
      if (result && result.tunnel) {
        await copyAddress(remoteExplorerService, clipboardService, result.tunnel);
      } else if (result) {
        await commandService.executeCommand(ForwardPortAction.COMMANDPALETTE_ID);
      }
    };
  }
  CopyAddressAction2.commandPaletteHandler = commandPaletteHandler;
})(CopyAddressAction || (CopyAddressAction = {}));
var ChangeLocalPortAction;
((ChangeLocalPortAction2) => {
  ChangeLocalPortAction2.ID = "remote.tunnel.changeLocalPort";
  ChangeLocalPortAction2.LABEL = nls.localize("remote.tunnel.changeLocalPort", "Change Local Address Port");
  function validateInput(tunnelService, value, canElevate) {
    if (!value.match(/^[0-9]+$/)) {
      return { content: nls.localize("remote.tunnelsView.portShouldBeNumber", "Local port should be a number."), severity: Severity.Error };
    } else if (Number(value) >= maxPortNumber) {
      return { content: invalidPortNumberString, severity: Severity.Error };
    } else if (canElevate && tunnelService.isPortPrivileged(Number(value))) {
      return { content: requiresSudoString, severity: Severity.Info };
    }
    return null;
  }
  function handler() {
    return async (accessor, arg) => {
      const remoteExplorerService = accessor.get(IRemoteExplorerService);
      const notificationService = accessor.get(INotificationService);
      const tunnelService = accessor.get(ITunnelService);
      let tunnelContext;
      if (isITunnelItem(arg)) {
        tunnelContext = arg;
      } else {
        const context = accessor.get(IContextKeyService).getContextKeyValue(TunnelViewSelectionKeyName);
        const tunnel = context ? remoteExplorerService.tunnelModel.forwarded.get(context) : void 0;
        if (tunnel) {
          const tunnelService2 = accessor.get(ITunnelService);
          tunnelContext = TunnelItem.createFromTunnel(remoteExplorerService, tunnelService2, tunnel);
        }
      }
      if (tunnelContext) {
        const tunnelItem = tunnelContext;
        remoteExplorerService.setEditable(tunnelItem, TunnelEditId.LocalPort, {
          onFinish: async (value, success) => {
            remoteExplorerService.setEditable(tunnelItem, TunnelEditId.LocalPort, null);
            if (success) {
              await remoteExplorerService.close({ host: tunnelItem.remoteHost, port: tunnelItem.remotePort }, TunnelCloseReason.Other);
              const numberValue = Number(value);
              const newForward = await remoteExplorerService.forward({
                remote: { host: tunnelItem.remoteHost, port: tunnelItem.remotePort },
                local: numberValue,
                name: tunnelItem.name,
                elevateIfNeeded: true,
                source: tunnelItem.source
              });
              if (newForward && typeof newForward !== "string" && newForward.tunnelLocalPort !== numberValue) {
                notificationService.warn(nls.localize("remote.tunnel.changeLocalPortNumber", "The local port {0} is not available. Port number {1} has been used instead", value, newForward.tunnelLocalPort ?? newForward.localAddress));
              }
            }
          },
          validationMessage: (value) => validateInput(tunnelService, value, tunnelService.canElevate),
          placeholder: nls.localize("remote.tunnelsView.changePort", "New local port")
        });
      }
    };
  }
  ChangeLocalPortAction2.handler = handler;
})(ChangeLocalPortAction || (ChangeLocalPortAction = {}));
var ChangeTunnelPrivacyAction;
((ChangeTunnelPrivacyAction2) => {
  function handler(privacyId) {
    return async (accessor, arg) => {
      if (isITunnelItem(arg)) {
        const remoteExplorerService = accessor.get(IRemoteExplorerService);
        await remoteExplorerService.close({ host: arg.remoteHost, port: arg.remotePort }, TunnelCloseReason.Other);
        return remoteExplorerService.forward({
          remote: { host: arg.remoteHost, port: arg.remotePort },
          local: arg.localPort,
          name: arg.name,
          elevateIfNeeded: true,
          privacy: privacyId,
          source: arg.source
        });
      }
      return void 0;
    };
  }
  ChangeTunnelPrivacyAction2.handler = handler;
})(ChangeTunnelPrivacyAction || (ChangeTunnelPrivacyAction = {}));
var SetTunnelProtocolAction;
((SetTunnelProtocolAction2) => {
  SetTunnelProtocolAction2.ID_HTTP = "remote.tunnel.setProtocolHttp";
  SetTunnelProtocolAction2.ID_HTTPS = "remote.tunnel.setProtocolHttps";
  SetTunnelProtocolAction2.LABEL_HTTP = nls.localize("remote.tunnel.protocolHttp", "HTTP");
  SetTunnelProtocolAction2.LABEL_HTTPS = nls.localize("remote.tunnel.protocolHttps", "HTTPS");
  async function handler(arg, protocol, remoteExplorerService, environmentService) {
    if (isITunnelItem(arg)) {
      const attributes = {
        protocol
      };
      const target = environmentService.remoteAuthority ? ConfigurationTarget.USER_REMOTE : ConfigurationTarget.USER_LOCAL;
      return remoteExplorerService.tunnelModel.configPortsAttributes.addAttributes(arg.remotePort, attributes, target);
    }
  }
  function handlerHttp() {
    return async (accessor, arg) => {
      return handler(arg, TunnelProtocol.Http, accessor.get(IRemoteExplorerService), accessor.get(IWorkbenchEnvironmentService));
    };
  }
  SetTunnelProtocolAction2.handlerHttp = handlerHttp;
  function handlerHttps() {
    return async (accessor, arg) => {
      return handler(arg, TunnelProtocol.Https, accessor.get(IRemoteExplorerService), accessor.get(IWorkbenchEnvironmentService));
    };
  }
  SetTunnelProtocolAction2.handlerHttps = handlerHttps;
})(SetTunnelProtocolAction || (SetTunnelProtocolAction = {}));
const tunnelViewCommandsWeightBonus = 10;
const isForwardedExpr = TunnelTypeContextKey.isEqualTo(TunnelType.Forwarded);
const isForwardedOrDetectedExpr = ContextKeyExpr.or(isForwardedExpr, TunnelTypeContextKey.isEqualTo(TunnelType.Detected));
const isNotMultiSelectionExpr = TunnelViewMultiSelectionContextKey.isEqualTo(void 0);
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: LabelTunnelAction.ID,
  weight: KeybindingWeight.WorkbenchContrib + tunnelViewCommandsWeightBonus,
  when: ContextKeyExpr.and(TunnelViewFocusContextKey, isForwardedExpr, isNotMultiSelectionExpr),
  primary: KeyCode.F2,
  mac: {
    primary: KeyCode.Enter
  },
  handler: LabelTunnelAction.handler()
});
CommandsRegistry.registerCommand(ForwardPortAction.INLINE_ID, ForwardPortAction.inlineHandler());
CommandsRegistry.registerCommand(ForwardPortAction.COMMANDPALETTE_ID, ForwardPortAction.commandPaletteHandler());
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: ClosePortAction.INLINE_ID,
  weight: KeybindingWeight.WorkbenchContrib + tunnelViewCommandsWeightBonus,
  when: ContextKeyExpr.and(TunnelCloseableContextKey, TunnelViewFocusContextKey),
  primary: KeyCode.Delete,
  mac: {
    primary: KeyMod.CtrlCmd | KeyCode.Backspace,
    secondary: [KeyCode.Delete]
  },
  handler: ClosePortAction.inlineHandler()
});
CommandsRegistry.registerCommand(ClosePortAction.COMMANDPALETTE_ID, ClosePortAction.commandPaletteHandler());
CommandsRegistry.registerCommand(OpenPortInBrowserAction.ID, OpenPortInBrowserAction.handler());
CommandsRegistry.registerCommand(OpenPortInPreviewAction.ID, OpenPortInPreviewAction.handler());
CommandsRegistry.registerCommand(OpenPortInBrowserCommandPaletteAction.ID, OpenPortInBrowserCommandPaletteAction.handler());
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: CopyAddressAction.INLINE_ID,
  weight: KeybindingWeight.WorkbenchContrib + tunnelViewCommandsWeightBonus,
  when: ContextKeyExpr.and(TunnelViewFocusContextKey, isForwardedOrDetectedExpr, isNotMultiSelectionExpr),
  primary: KeyMod.CtrlCmd | KeyCode.KeyC,
  handler: CopyAddressAction.inlineHandler()
});
CommandsRegistry.registerCommand(CopyAddressAction.COMMANDPALETTE_ID, CopyAddressAction.commandPaletteHandler());
CommandsRegistry.registerCommand(ChangeLocalPortAction.ID, ChangeLocalPortAction.handler());
CommandsRegistry.registerCommand(SetTunnelProtocolAction.ID_HTTP, SetTunnelProtocolAction.handlerHttp());
CommandsRegistry.registerCommand(SetTunnelProtocolAction.ID_HTTPS, SetTunnelProtocolAction.handlerHttps());
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
  command: {
    id: ClosePortAction.COMMANDPALETTE_ID,
    title: ClosePortAction.LABEL
  },
  when: forwardedPortsViewEnabled
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
  command: {
    id: ForwardPortAction.COMMANDPALETTE_ID,
    title: ForwardPortAction.LABEL
  },
  when: forwardedPortsViewEnabled
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
  command: {
    id: CopyAddressAction.COMMANDPALETTE_ID,
    title: CopyAddressAction.COMMANDPALETTE_LABEL
  },
  when: forwardedPortsViewEnabled
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
  command: {
    id: OpenPortInBrowserCommandPaletteAction.ID,
    title: OpenPortInBrowserCommandPaletteAction.LABEL
  },
  when: forwardedPortsViewEnabled
});
MenuRegistry.appendMenuItem(MenuId.TunnelContext, {
  group: "._open",
  order: 0,
  command: {
    id: OpenPortInBrowserAction.ID,
    title: OpenPortInBrowserAction.LABEL
  },
  when: ContextKeyExpr.and(isForwardedOrDetectedExpr, isNotMultiSelectionExpr)
});
MenuRegistry.appendMenuItem(MenuId.TunnelContext, {
  group: "._open",
  order: 1,
  command: {
    id: OpenPortInPreviewAction.ID,
    title: OpenPortInPreviewAction.LABEL
  },
  when: ContextKeyExpr.and(
    isForwardedOrDetectedExpr,
    isNotMultiSelectionExpr
  )
});
MenuRegistry.appendMenuItem(MenuId.TunnelContext, {
  group: "0_manage",
  order: 1,
  command: {
    id: LabelTunnelAction.ID,
    title: LabelTunnelAction.LABEL,
    icon: labelPortIcon
  },
  when: ContextKeyExpr.and(isForwardedExpr, isNotMultiSelectionExpr)
});
MenuRegistry.appendMenuItem(MenuId.TunnelContext, {
  group: "2_localaddress",
  order: 0,
  command: {
    id: CopyAddressAction.INLINE_ID,
    title: CopyAddressAction.INLINE_LABEL
  },
  when: ContextKeyExpr.and(isForwardedOrDetectedExpr, isNotMultiSelectionExpr)
});
MenuRegistry.appendMenuItem(MenuId.TunnelContext, {
  group: "2_localaddress",
  order: 1,
  command: {
    id: ChangeLocalPortAction.ID,
    title: ChangeLocalPortAction.LABEL
  },
  when: ContextKeyExpr.and(isForwardedExpr, PortChangableContextKey, isNotMultiSelectionExpr)
});
MenuRegistry.appendMenuItem(MenuId.TunnelContext, {
  group: "2_localaddress",
  order: 2,
  submenu: MenuId.TunnelPrivacy,
  title: nls.localize("tunnelContext.privacyMenu", "Port Visibility"),
  when: ContextKeyExpr.and(isForwardedExpr, TunnelPrivacyEnabledContextKey)
});
MenuRegistry.appendMenuItem(MenuId.TunnelContext, {
  group: "2_localaddress",
  order: 3,
  submenu: MenuId.TunnelProtocol,
  title: nls.localize("tunnelContext.protocolMenu", "Change Port Protocol"),
  when: ContextKeyExpr.and(isForwardedExpr, isNotMultiSelectionExpr, ProtocolChangeableContextKey)
});
MenuRegistry.appendMenuItem(MenuId.TunnelContext, {
  group: "3_forward",
  order: 0,
  command: {
    id: ClosePortAction.INLINE_ID,
    title: ClosePortAction.LABEL
  },
  when: TunnelCloseableContextKey
});
MenuRegistry.appendMenuItem(MenuId.TunnelContext, {
  group: "3_forward",
  order: 1,
  command: {
    id: ForwardPortAction.INLINE_ID,
    title: ForwardPortAction.LABEL
  }
});
MenuRegistry.appendMenuItem(MenuId.TunnelProtocol, {
  order: 0,
  command: {
    id: SetTunnelProtocolAction.ID_HTTP,
    title: SetTunnelProtocolAction.LABEL_HTTP,
    toggled: TunnelProtocolContextKey.isEqualTo(TunnelProtocol.Http)
  }
});
MenuRegistry.appendMenuItem(MenuId.TunnelProtocol, {
  order: 1,
  command: {
    id: SetTunnelProtocolAction.ID_HTTPS,
    title: SetTunnelProtocolAction.LABEL_HTTPS,
    toggled: TunnelProtocolContextKey.isEqualTo(TunnelProtocol.Https)
  }
});
MenuRegistry.appendMenuItem(MenuId.TunnelPortInline, {
  group: "0_manage",
  order: 0,
  command: {
    id: ForwardPortAction.INLINE_ID,
    title: ForwardPortAction.TREEITEM_LABEL,
    icon: forwardPortIcon
  },
  when: TunnelTypeContextKey.isEqualTo(TunnelType.Candidate)
});
MenuRegistry.appendMenuItem(MenuId.TunnelPortInline, {
  group: "0_manage",
  order: 4,
  command: {
    id: LabelTunnelAction.ID,
    title: LabelTunnelAction.LABEL,
    icon: labelPortIcon
  },
  when: isForwardedExpr
});
MenuRegistry.appendMenuItem(MenuId.TunnelPortInline, {
  group: "0_manage",
  order: 5,
  command: {
    id: ClosePortAction.INLINE_ID,
    title: ClosePortAction.LABEL,
    icon: stopForwardIcon
  },
  when: TunnelCloseableContextKey
});
MenuRegistry.appendMenuItem(MenuId.TunnelLocalAddressInline, {
  order: -1,
  command: {
    id: CopyAddressAction.INLINE_ID,
    title: CopyAddressAction.INLINE_LABEL,
    icon: copyAddressIcon
  },
  when: isForwardedOrDetectedExpr
});
MenuRegistry.appendMenuItem(MenuId.TunnelLocalAddressInline, {
  order: 0,
  command: {
    id: OpenPortInBrowserAction.ID,
    title: OpenPortInBrowserAction.LABEL,
    icon: openBrowserIcon
  },
  when: isForwardedOrDetectedExpr
});
MenuRegistry.appendMenuItem(MenuId.TunnelLocalAddressInline, {
  order: 1,
  command: {
    id: OpenPortInPreviewAction.ID,
    title: OpenPortInPreviewAction.LABEL,
    icon: openPreviewIcon
  },
  when: isForwardedOrDetectedExpr
});
registerColor("ports.iconRunningProcessForeground", STATUS_BAR_REMOTE_ITEM_BACKGROUND, nls.localize("portWithRunningProcess.foreground", "The color of the icon for a port that has an associated running process."));
export {
  ForwardPortAction,
  OpenPortInBrowserAction,
  OpenPortInPreviewAction,
  TunnelPanel,
  TunnelPanelDescriptor,
  TunnelViewModel,
  openPreviewEnabledContext
};
