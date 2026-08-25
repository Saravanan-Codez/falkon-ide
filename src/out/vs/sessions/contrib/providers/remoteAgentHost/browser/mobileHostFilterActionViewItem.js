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
import * as dom from "../../../../../base/browser/dom.js";
import { Gesture, EventType as TouchEventType } from "../../../../../base/browser/touch.js";
import { renderLabelWithIcons } from "../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { StandardKeyboardEvent } from "../../../../../base/browser/keyboardEvent.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { KeyCode } from "../../../../../base/common/keyCodes.js";
import { DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../nls.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { AgentHostFilterConnectionStatus, IAgentHostFilterService } from "../../../../services/agentHostFilter/common/agentHostFilter.js";
import { HostFilterActionViewItem } from "./hostFilterActionViewItem.js";
import "./media/hostPickerSheet.css";
const $ = dom.$;
let MobileHostFilterActionViewItem = class extends HostFilterActionViewItem {
  constructor(action, filterService, contextMenuService, hoverService) {
    super(action, "titlebar", filterService, contextMenuService, hoverService);
    this._sheet = this._register(new MutableDisposable());
  }
  /**
   * Always interactive on mobile — even with zero hosts the sheet
   * shows an empty state and the always-visible "Re-discover hosts"
   * action. This is the primary entry point for retrying discovery
   * when no hosts have been found yet.
   */
  _isInteractive() {
    return true;
  }
  _showMenu(_e) {
    if (!this.element) {
      return;
    }
    this._showSheet();
  }
  _showSheet() {
    this._sheet.clear();
    const disposables = new DisposableStore();
    this._sheet.value = disposables;
    const targetWindow = dom.getWindow(this.element);
    const targetDocument = targetWindow.document;
    const workbenchContainer = dom.findParentWithClass(this.element, "monaco-workbench") ?? targetDocument.body;
    const overlay = dom.append(workbenchContainer, $("div.host-picker-sheet-overlay"));
    const backdrop = dom.append(overlay, $("div.host-picker-sheet-backdrop"));
    const sheet = dom.append(overlay, $("div.host-picker-sheet"));
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-label", localize("agentHostFilter.sheet.aria", "Hosts"));
    let dismissing = false;
    const finish = () => {
      if (dismissing) {
        return;
      }
      dismissing = true;
      sheet.classList.add("closing");
      backdrop.classList.add("closing");
      const close = () => {
        if (this._sheet.value === disposables) {
          this._sheet.clear();
        }
      };
      sheet.addEventListener("animationend", close, { once: true });
      const fallback = setTimeout(close, 220);
      disposables.add({ dispose: () => clearTimeout(fallback) });
    };
    disposables.add({ dispose: () => overlay.remove() });
    dom.append(sheet, $("div.host-picker-sheet-handle"));
    const header = dom.append(sheet, $("div.host-picker-sheet-header"));
    dom.append(header, $("div.host-picker-sheet-title")).textContent = localize("agentHostFilter.sheet.title", "Hosts");
    const closeBtn = dom.append(header, $("button.host-picker-sheet-close", { type: "button" }));
    closeBtn.setAttribute("aria-label", localize("agentHostFilter.sheet.close", "Close"));
    dom.append(closeBtn, $("span.codicon.codicon-close"));
    disposables.add(Gesture.addTarget(closeBtn));
    for (const eventType of [dom.EventType.CLICK, TouchEventType.Tap]) {
      disposables.add(dom.addDisposableListener(closeBtn, eventType, (e) => {
        dom.EventHelper.stop(e, true);
        finish();
      }));
    }
    dom.append(sheet, $("div.host-picker-sheet-subtitle")).textContent = localize(
      "agentHostFilter.sheet.subtitle",
      "Sessions are scoped to a host. Switching hosts shows that machine's sessions and runs new sessions there."
    );
    const body = dom.append(sheet, $("div.host-picker-sheet-body"));
    const bodyDisposables = disposables.add(new DisposableStore());
    const focusRefs = {};
    const renderBody = () => {
      bodyDisposables.clear();
      dom.clearNode(body);
      focusRefs.firstHost = void 0;
      focusRefs.firstCheckedHost = void 0;
      this._renderHostList(bodyDisposables, body, finish, focusRefs);
    };
    renderBody();
    disposables.add(this._filterService.onDidChange(renderBody));
    disposables.add(this._filterService.onDidChangeDiscovering(renderBody));
    const footer = dom.append(sheet, $("div.host-picker-sheet-footer"));
    focusRefs.rediscover = this._renderRediscoverAction(disposables, footer);
    disposables.add(dom.addDisposableListener(sheet, dom.EventType.CLICK, (e) => e.stopPropagation()));
    disposables.add(Gesture.addTarget(sheet));
    disposables.add(dom.addDisposableListener(sheet, TouchEventType.Tap, (e) => dom.EventHelper.stop(e, true)));
    disposables.add(Gesture.addTarget(backdrop));
    for (const eventType of [dom.EventType.CLICK, TouchEventType.Tap]) {
      disposables.add(dom.addDisposableListener(backdrop, eventType, (e) => {
        dom.EventHelper.stop(e, true);
        finish();
      }));
    }
    disposables.add(dom.addDisposableListener(targetDocument, dom.EventType.KEY_DOWN, (e) => {
      if (new StandardKeyboardEvent(e).equals(KeyCode.Escape)) {
        dom.EventHelper.stop(e, true);
        finish();
      }
    }));
    focusRefs.firstCheckedHost?.focus();
  }
  _renderHostList(disposables, body, finish, focusRefs) {
    const hosts = this._filterService.hosts;
    const selectedId = this._filterService.selectedProviderId;
    if (hosts.length === 0) {
      const empty = dom.append(body, $("div.host-picker-sheet-empty"));
      empty.textContent = this._filterService.isDiscovering ? localize("agentHostFilter.sheet.searching", "Searching for hosts\u2026") : localize("agentHostFilter.sheet.empty", "No hosts found yet.");
      return;
    }
    dom.append(body, $("div.host-picker-sheet-section-title")).textContent = localize("agentHostFilter.sheet.available", "Available");
    for (const host of hosts) {
      const row = this._renderHostItem(disposables, body, host, selectedId === host.providerId, finish);
      focusRefs.firstHost ??= row;
      if (selectedId === host.providerId) {
        focusRefs.firstCheckedHost ??= row;
      }
    }
  }
  _renderHostItem(disposables, body, host, checked, finish) {
    const row = dom.append(body, $("button.host-picker-sheet-item", { type: "button" }));
    row.setAttribute("role", "menuitemradio");
    row.setAttribute("aria-checked", String(checked));
    if (checked) {
      row.classList.add("checked");
    }
    const iconWrap = dom.append(row, $("span.host-picker-sheet-item-icon"));
    iconWrap.append(...renderLabelWithIcons(`$(${Codicon.remote.id})`));
    const status = dom.append(iconWrap, $("span.host-picker-sheet-item-status"));
    switch (host.status) {
      case AgentHostFilterConnectionStatus.Connected:
        status.classList.add("connected");
        break;
      case AgentHostFilterConnectionStatus.Connecting:
        status.classList.add("connecting");
        break;
    }
    const text = dom.append(row, $("span.host-picker-sheet-item-text"));
    dom.append(text, $("span.host-picker-sheet-item-name")).textContent = host.label;
    dom.append(text, $("span.host-picker-sheet-item-sub")).textContent = this._statusLabel(host.status);
    if (checked) {
      const check = dom.append(row, $("span.host-picker-sheet-item-check"));
      check.append(...renderLabelWithIcons(`$(${Codicon.check.id})`));
    }
    const select = (e) => {
      if (e) {
        dom.EventHelper.stop(e, true);
      }
      this._filterService.setSelectedProviderId(host.providerId);
      finish();
    };
    disposables.add(Gesture.addTarget(row));
    disposables.add(dom.addDisposableListener(row, dom.EventType.CLICK, (e) => select(e)));
    disposables.add(dom.addDisposableListener(row, TouchEventType.Tap, (e) => select(e)));
    return row;
  }
  _statusLabel(status) {
    switch (status) {
      case AgentHostFilterConnectionStatus.Connected:
        return localize("agentHostFilter.sheet.status.connected", "Connected");
      case AgentHostFilterConnectionStatus.Connecting:
        return localize("agentHostFilter.sheet.status.connecting", "Connecting\u2026");
      case AgentHostFilterConnectionStatus.Disconnected:
      default:
        return localize("agentHostFilter.sheet.status.disconnected", "Disconnected");
    }
  }
  _renderRediscoverAction(disposables, footer) {
    const action = dom.append(footer, $("button.host-picker-sheet-action", { type: "button" }));
    action.setAttribute("role", "menuitem");
    action.setAttribute("aria-label", localize("agentHostFilter.sheet.rediscover.aria", "Re-discover hosts"));
    const iconSpan = dom.append(action, $("span.host-picker-sheet-action-icon"));
    iconSpan.append(...renderLabelWithIcons(`$(${Codicon.refresh.id})`));
    const labelSpan = dom.append(action, $("span"));
    const update = () => {
      const discovering = this._filterService.isDiscovering;
      action.classList.toggle("discovering", discovering);
      action.setAttribute("aria-disabled", String(discovering));
      labelSpan.textContent = discovering ? localize("agentHostFilter.sheet.rediscovering", "Searching\u2026") : localize("agentHostFilter.sheet.rediscover", "Re-discover hosts");
    };
    update();
    disposables.add(this._filterService.onDidChangeDiscovering(update));
    const trigger = (e) => {
      if (e) {
        dom.EventHelper.stop(e, true);
      }
      if (this._filterService.isDiscovering) {
        return;
      }
      this._filterService.rediscover();
    };
    disposables.add(Gesture.addTarget(action));
    disposables.add(dom.addDisposableListener(action, dom.EventType.CLICK, (e) => trigger(e)));
    disposables.add(dom.addDisposableListener(action, TouchEventType.Tap, (e) => trigger(e)));
    return action;
  }
};
MobileHostFilterActionViewItem = __decorateClass([
  __decorateParam(1, IAgentHostFilterService),
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IHoverService)
], MobileHostFilterActionViewItem);
export {
  MobileHostFilterActionViewItem
};
