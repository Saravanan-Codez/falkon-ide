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
import "./media/hostFilter.css";
import * as dom from "../../../../../base/browser/dom.js";
import { Gesture, EventType as TouchEventType } from "../../../../../base/browser/touch.js";
import { renderLabelWithIcons } from "../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { BaseActionViewItem } from "../../../../../base/browser/ui/actionbar/actionViewItems.js";
import { Button } from "../../../../../base/browser/ui/button/button.js";
import { getDefaultHoverDelegate } from "../../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { StandardMouseEvent } from "../../../../../base/browser/mouseEvent.js";
import { StandardKeyboardEvent } from "../../../../../base/browser/keyboardEvent.js";
import { Action } from "../../../../../base/common/actions.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { KeyCode } from "../../../../../base/common/keyCodes.js";
import { MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../nls.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { defaultButtonStyles } from "../../../../../platform/theme/browser/defaultStyles.js";
import { AgentHostFilterConnectionStatus, IAgentHostFilterService } from "../../../../services/agentHostFilter/common/agentHostFilter.js";
let HostFilterActionViewItem = class extends BaseActionViewItem {
  constructor(action, _appearance = "titlebar", _filterService, _contextMenuService, _hoverService) {
    super(void 0, action);
    this._appearance = _appearance;
    this._filterService = _filterService;
    this._contextMenuService = _contextMenuService;
    this._hoverService = _hoverService;
    this._dropdownHover = this._register(new MutableDisposable());
    this._connectHover = this._register(new MutableDisposable());
    this._register(this._filterService.onDidChange(() => this._update()));
    this._register(this._filterService.onDidChangeDiscovering(() => this._update()));
  }
  render(container) {
    super.render(container);
    if (!this.element) {
      return;
    }
    this.element.classList.add("agent-host-filter-combo");
    if (this._appearance === "sidebar") {
      this.element.classList.add("sidebar");
      this._renderSidebar();
    } else {
      this._renderTitlebar();
    }
    this._update();
  }
  /**
   * Original compact pill rendered in the desktop titlebar's left toolbar.
   * Custom DOM driven directly by click handlers + context menu service.
   */
  _renderTitlebar() {
    if (!this.element) {
      return;
    }
    this._dropdownElement = dom.append(this.element, dom.$("div.agent-host-filter-dropdown"));
    const iconEl = dom.append(this._dropdownElement, dom.$("span.agent-host-filter-icon"));
    iconEl.append(...renderLabelWithIcons(`$(${Codicon.remote.id})`));
    this._labelElement = dom.append(this._dropdownElement, dom.$("span.agent-host-filter-label"));
    this._chevronElement = dom.append(this._dropdownElement, dom.$("span.agent-host-filter-chevron"));
    this._chevronElement.append(...renderLabelWithIcons(`$(${Codicon.chevronDown.id})`));
    this._register(Gesture.addTarget(this._dropdownElement));
    for (const eventType of [dom.EventType.CLICK, TouchEventType.Tap]) {
      this._register(dom.addDisposableListener(this._dropdownElement, eventType, (e) => {
        if (!this._isInteractive()) {
          return;
        }
        dom.EventHelper.stop(e, true);
        this._showMenu(e);
      }));
    }
    this._register(dom.addDisposableListener(this._dropdownElement, dom.EventType.KEY_DOWN, (e) => {
      if (!this._isInteractive()) {
        return;
      }
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space)) {
        dom.EventHelper.stop(e, true);
        this._showMenu(e);
      }
    }));
    this._connectElement = dom.append(this.element, dom.$("div.agent-host-filter-connect"));
    this._wireConnectButton(this._connectElement);
  }
  /**
   * Sidebar appearance — full-width row matching the Customizations links
   * (`CustomizationLinkViewItem`). Same Monaco `Button` shell, same
   * `.sidebar-action-button` styling, same `supportIcons` label rendering.
   * The trailing connect indicator is rendered alongside the picker
   * button as a sibling control, so the row visually mirrors the
   * Customizations rows in the toolbar above without making the
   * indicator part of the picker label.
   */
  _renderSidebar() {
    if (!this.element) {
      return;
    }
    this.element.classList.add("sidebar-action");
    const buttonContainer = dom.append(this.element, dom.$(".customization-link-button-container"));
    this._sidebarButton = this._register(new Button(buttonContainer, {
      ...defaultButtonStyles,
      secondary: true,
      title: false,
      supportIcons: true,
      buttonSecondaryBackground: "transparent",
      buttonSecondaryHoverBackground: void 0,
      buttonSecondaryForeground: void 0,
      buttonSecondaryBorder: void 0
    }));
    this._sidebarButton.element.classList.add("customization-link-button", "sidebar-action-button", "agent-host-filter-button", "monaco-text-button");
    this._dropdownElement = this._sidebarButton.element;
    this._sidebarLeadingIcon = dom.append(this._sidebarButton.element, dom.$("span.agent-host-filter-leading-icon"));
    this._sidebarLeadingIcon.classList.add("codicon", `codicon-${Codicon.remote.id}`);
    this._labelElement = dom.append(this._sidebarButton.element, dom.$("span.agent-host-filter-label"));
    this._sidebarTrailingIcon = dom.$("span.agent-host-filter-trailing-icon.codicon");
    this._sidebarTrailingIcon.classList.add(`codicon-${Codicon.chevronDown.id}`);
    this._register(this._sidebarButton.onDidClick((e) => {
      if (!this._isInteractive()) {
        return;
      }
      this._showMenu(e);
    }));
    this._connectElement = dom.append(this.element, dom.$("div.agent-host-filter-connect"));
    this._wireConnectButton(this._connectElement);
  }
  _wireConnectButton(connectElement) {
    this._register(Gesture.addTarget(connectElement));
    for (const eventType of [dom.EventType.CLICK, TouchEventType.Tap]) {
      this._register(dom.addDisposableListener(connectElement, eventType, (e) => {
        dom.EventHelper.stop(e, true);
        this._onConnectClick();
      }));
    }
    this._register(dom.addDisposableListener(connectElement, dom.EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space)) {
        dom.EventHelper.stop(e, true);
        this._onConnectClick();
      }
    }));
  }
  _renderSidebarButtonAffordances(interactive, canRetry) {
    if (!this._sidebarButton || !this._sidebarTrailingIcon) {
      return;
    }
    const showChevron = interactive && !canRetry;
    if (showChevron) {
      if (!this._sidebarTrailingIcon.isConnected) {
        this._sidebarButton.element.appendChild(this._sidebarTrailingIcon);
      }
    } else {
      this._sidebarTrailingIcon.remove();
    }
  }
  _isInteractive() {
    const hosts = this._filterService.hosts;
    return hosts.length === 0 || hosts.length > 1;
  }
  _update() {
    if (!this.element || !this._dropdownElement || !this._labelElement || !this._connectElement) {
      return;
    }
    if (!this._sidebarButton && !this._chevronElement) {
      return;
    }
    const hosts = this._filterService.hosts;
    const selectedId = this._filterService.selectedProviderId;
    const selected = selectedId === void 0 ? void 0 : hosts.find((h) => h.providerId === selectedId);
    const hasMenu = hosts.length > 1;
    const canRetry = hosts.length === 0;
    const interactive = hasMenu || canRetry;
    const discovering = this._filterService.isDiscovering;
    const text = selected ? selected.label : discovering ? localize("agentHostFilter.searching", "Searching\u2026") : localize("agentHostFilter.none", "No Host");
    if (this._sidebarButton) {
      this._labelElement.textContent = text;
      this._renderSidebarButtonAffordances(interactive, canRetry);
    } else {
      this._labelElement.textContent = text;
    }
    this.element.classList.toggle("single-host", !interactive);
    this._dropdownElement.classList.toggle("discovering", discovering);
    this._dropdownElement.classList.toggle("no-hosts", canRetry);
    if (this._chevronElement) {
      dom.clearNode(this._chevronElement);
      const chevronIconId = canRetry ? Codicon.refresh.id : Codicon.chevronDown.id;
      this._chevronElement.append(...renderLabelWithIcons(`$(${chevronIconId})`));
    }
    if (interactive) {
      if (!this._sidebarButton) {
        this._dropdownElement.tabIndex = 0;
        this._dropdownElement.role = "button";
        if (hasMenu) {
          this._dropdownElement.setAttribute("aria-haspopup", "menu");
        } else {
          this._dropdownElement.removeAttribute("aria-haspopup");
        }
      } else if (hasMenu) {
        this._dropdownElement.setAttribute("aria-haspopup", "menu");
      } else {
        this._dropdownElement.removeAttribute("aria-haspopup");
      }
      const ariaLabel = selected ? localize("agentHostFilter.aria.selected", "Sessions scoped to host {0}. Click to change host.", selected.label) : canRetry ? localize("agentHostFilter.aria.retry", "No hosts found. Click to re-discover hosts.") : localize("agentHostFilter.aria.none", "No agent host selected.");
      this._dropdownElement.setAttribute("aria-label", ariaLabel);
      const hoverText = canRetry ? discovering ? localize("agentHostFilter.hover.searching", "Searching for hosts\u2026") : localize("agentHostFilter.hover.retry", "Re-discover hosts") : localize("agentHostFilter.hover", "Change the host the sessions list is scoped to");
      this._dropdownHover.value = this._hoverService.setupManagedHover(
        getDefaultHoverDelegate("element"),
        this._dropdownElement,
        () => hoverText
      );
    } else {
      if (!this._sidebarButton) {
        this._dropdownElement.removeAttribute("tabindex");
        this._dropdownElement.removeAttribute("role");
      }
      this._dropdownElement.removeAttribute("aria-haspopup");
      this._dropdownElement.setAttribute("aria-label", selected ? localize("agentHostFilter.aria.singleSelected", "Sessions scoped to host {0}", selected.label) : localize("agentHostFilter.aria.none", "No agent host selected."));
      this._dropdownHover.clear();
    }
    this._updateConnectButton(selected, canRetry, discovering);
  }
  _updateConnectButton(selected, canRetry, discovering) {
    if (!this._connectElement) {
      return;
    }
    dom.clearNode(this._connectElement);
    this._connectElement.classList.remove("connected", "connecting", "disconnected", "rediscover", "hidden");
    this._connectHover.clear();
    if (!selected && this._sidebarButton && canRetry) {
      this._connectElement.setAttribute("role", "button");
      this._connectElement.tabIndex = 0;
      this._connectElement.classList.add("rediscover");
      this._connectElement.append(...renderLabelWithIcons(`$(${Codicon.refresh.id})`));
      const hoverText2 = discovering ? localize("agentHostFilter.hover.searching", "Searching for hosts\u2026") : localize("agentHostFilter.hover.retry", "Re-discover hosts");
      this._connectElement.setAttribute("aria-label", hoverText2);
      this._connectHover.value = this._hoverService.setupManagedHover(
        getDefaultHoverDelegate("element"),
        this._connectElement,
        () => hoverText2
      );
      return;
    }
    if (!selected) {
      this._connectElement.classList.add("hidden");
      this._connectElement.removeAttribute("role");
      this._connectElement.removeAttribute("tabindex");
      return;
    }
    this._connectElement.setAttribute("role", "button");
    this._connectElement.tabIndex = 0;
    let iconId;
    let hoverText;
    switch (selected.status) {
      case AgentHostFilterConnectionStatus.Connected:
        iconId = Codicon.debugConnected.id;
        this._connectElement.classList.add("connected");
        hoverText = localize("agentHostFilter.status.connected", "Connected to {0}. Click to disconnect.", selected.label);
        break;
      case AgentHostFilterConnectionStatus.Connecting:
        iconId = Codicon.debugConnected.id;
        this._connectElement.classList.add("connecting");
        hoverText = localize("agentHostFilter.status.connecting", "Connecting to {0}\u2026 Click to cancel.", selected.label);
        break;
      case AgentHostFilterConnectionStatus.Disconnected:
      default:
        iconId = Codicon.debugDisconnect.id;
        this._connectElement.classList.add("disconnected");
        hoverText = localize("agentHostFilter.status.disconnected", "Disconnected from {0}. Click to connect.", selected.label);
        break;
    }
    this._connectElement.append(...renderLabelWithIcons(`$(${iconId})`));
    this._connectElement.setAttribute("aria-label", hoverText);
    const connectHoverDelegate = getDefaultHoverDelegate("element");
    this._connectHover.value = this._hoverService.setupManagedHover(
      connectHoverDelegate,
      this._connectElement,
      () => hoverText
    );
  }
  _onConnectClick() {
    if (this._connectElement?.classList.contains("rediscover")) {
      if (!this._filterService.isDiscovering) {
        this._filterService.rediscover();
      }
      return;
    }
    const selectedId = this._filterService.selectedProviderId;
    if (selectedId === void 0) {
      return;
    }
    const selected = this._filterService.hosts.find((h) => h.providerId === selectedId);
    if (!selected) {
      return;
    }
    if (selected.status === AgentHostFilterConnectionStatus.Disconnected) {
      this._filterService.reconnect(selectedId);
    } else {
      this._filterService.disconnect(selectedId);
    }
  }
  _showMenu(e) {
    if (!this._dropdownElement) {
      return;
    }
    const hosts = this._filterService.hosts;
    if (hosts.length === 0) {
      if (!this._filterService.isDiscovering) {
        this._filterService.rediscover();
      }
      return;
    }
    if (hosts.length === 1) {
      return;
    }
    const selectedId = this._filterService.selectedProviderId;
    const actions = [];
    for (const host of hosts) {
      const label = host.status === AgentHostFilterConnectionStatus.Connected ? host.label : host.status === AgentHostFilterConnectionStatus.Connecting ? localize("agentHostFilter.hostConnecting", "{0} (connecting\u2026)", host.label) : localize("agentHostFilter.hostDisconnected", "{0} (disconnected)", host.label);
      actions.push(new Action(
        `agentHostFilter.host.${host.providerId}`,
        label,
        selectedId === host.providerId ? "codicon codicon-check" : void 0,
        true,
        async () => this._filterService.setSelectedProviderId(host.providerId)
      ));
    }
    const anchor = dom.isMouseEvent(e) ? new StandardMouseEvent(dom.getWindow(this._dropdownElement), e) : this._dropdownElement;
    this._contextMenuService.showContextMenu({
      getAnchor: () => anchor,
      getActions: () => actions,
      domForShadowRoot: this._dropdownElement
    });
  }
};
HostFilterActionViewItem = __decorateClass([
  __decorateParam(2, IAgentHostFilterService),
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, IHoverService)
], HostFilterActionViewItem);
export {
  HostFilterActionViewItem
};
