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
import { renderIcon } from "../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Gesture, EventType as TouchEventType } from "../../../../../base/browser/touch.js";
import { Disposable, DisposableMap, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../base/common/observable.js";
import { localize } from "../../../../../nls.js";
import { ActionListItemKind } from "../../../../../platform/actionWidget/browser/actionList.js";
import { IActionWidgetService } from "../../../../../platform/actionWidget/browser/actionWidget.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { SessionConfigKey } from "../../../../../platform/agentHost/common/sessionConfigKeys.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { isAgentHostProvider } from "../../../../common/agentHostSessionsProvider.js";
import { ISessionsProvidersService } from "../../../../services/sessions/browser/sessionsProvidersService.js";
import { reportNewChatPickerClosed } from "../../../chat/browser/newChatPickerTelemetry.js";
import { getAgentHostModeIcon } from "./agentHostModeIcon.js";
import { isWellKnownModeSchema } from "./agentHostPermissionPickerDelegate.js";
let AgentHostSessionEnumPicker = class extends Disposable {
  constructor(_session, _actionWidgetService, _sessionsProvidersService, _telemetryService, _hoverService) {
    super();
    this._session = _session;
    this._actionWidgetService = _actionWidgetService;
    this._sessionsProvidersService = _sessionsProvidersService;
    this._telemetryService = _telemetryService;
    this._hoverService = _hoverService;
    this._renderDisposables = this._register(new DisposableStore());
    this._providerListeners = this._register(new DisposableMap());
    this._register(autorun((reader) => {
      this._session.read(reader);
      this._updateTrigger();
    }));
    this._register(this._sessionsProvidersService.onDidChangeProviders((e) => {
      for (const provider of e.removed) {
        this._providerListeners.deleteAndDispose(provider.id);
      }
      this._watchProviders(e.added);
      this._updateTrigger();
    }));
    this._watchProviders(this._sessionsProvidersService.getProviders());
  }
  render(container) {
    this._renderDisposables.clear();
    this._containerElement = container;
    const slot = dom.append(container, dom.$(".sessions-chat-picker-slot"));
    this._renderDisposables.add({ dispose: () => slot.remove() });
    this._slotElement = slot;
    const trigger = dom.append(slot, dom.$("a.action-label"));
    trigger.tabIndex = 0;
    trigger.role = "button";
    this._triggerElement = trigger;
    this._renderDisposables.add(this._hoverService.setupDelayedHover(trigger, () => ({ content: this._getActiveContext()?.tooltip ?? "" })));
    this._renderDisposables.add(Gesture.addTarget(trigger));
    for (const eventType of [dom.EventType.CLICK, TouchEventType.Tap]) {
      this._renderDisposables.add(dom.addDisposableListener(trigger, eventType, (e) => {
        dom.EventHelper.stop(e, true);
        this._showPicker();
      }));
    }
    this._renderDisposables.add(dom.addDisposableListener(trigger, dom.EventType.KEY_DOWN, (e) => {
      if (e.key === "Enter" || e.key === " ") {
        dom.EventHelper.stop(e, true);
        this._showPicker();
      }
    }));
    this._updateTrigger();
  }
  _watchProviders(providers) {
    for (const provider of providers) {
      if (!isAgentHostProvider(provider) || this._providerListeners.has(provider.id)) {
        continue;
      }
      this._providerListeners.set(provider.id, provider.onDidChangeSessionConfig(() => this._updateTrigger()));
    }
  }
  _getFooterActionItems() {
    return [];
  }
  _handleFooterActionItem(_item) {
    return false;
  }
  /**
   * Optional list-widget options for the picker popup. Subclasses whose
   * option descriptions are long (e.g. the Codex approvals presets) return a
   * bounded `maxWidth` plus a `className`/`detailItemHeight` so the detail text
   * wraps within a compact box instead of stretching the popup horizontally.
   */
  _getListOptions() {
    return void 0;
  }
  /**
   * `true` while the active session's provider is resolving its config.
   * Subclasses gate picker-open paths on this; the desktop chip is
   * rendered visually disabled in {@link _updateTrigger}.
   */
  _isCurrentlyResolvingConfig() {
    const session = this._session.get();
    if (!session) {
      return false;
    }
    const provider = this._sessionsProvidersService.getProvider(session.providerId);
    if (!provider || !isAgentHostProvider(provider)) {
      return false;
    }
    return provider.isSessionConfigResolving(session.sessionId).get();
  }
  showPicker(anchor, onHide) {
    return this._showPicker(anchor, onHide);
  }
  _getActiveContext() {
    const session = this._session.get();
    if (!session) {
      return void 0;
    }
    const rawProvider = this._sessionsProvidersService.getProvider(session.providerId);
    if (!rawProvider || !isAgentHostProvider(rawProvider)) {
      return void 0;
    }
    const config = rawProvider.getSessionConfig(session.sessionId);
    const schema = config?.schema.properties[this._property];
    if (!schema || !this._isWellKnownSchema(schema)) {
      return void 0;
    }
    const enumValues = (schema.enum ?? []).map((value) => String(value));
    const enumLabels = schema.enumLabels ?? [];
    const enumDescriptions = schema.enumDescriptions ?? [];
    const items = enumValues.map((value, index) => ({
      value,
      label: enumLabels[index] ?? value,
      description: enumDescriptions[index]
    }));
    const rawCurrent = config?.values[this._property] ?? schema.default;
    const currentValue = typeof rawCurrent === "string" && enumValues.includes(rawCurrent) ? rawCurrent : enumValues[0] ?? "";
    return { provider: rawProvider, sessionId: session.sessionId, currentValue, items, tooltip: schema.description ?? schema.title ?? "" };
  }
  _updateTrigger() {
    if (!this._triggerElement || !this._slotElement || !this._containerElement) {
      return;
    }
    const ctx = this._getActiveContext();
    if (!ctx) {
      this._slotElement.style.display = "none";
      this._containerElement.style.display = "none";
      return;
    }
    this._slotElement.style.display = "";
    this._containerElement.style.display = "";
    dom.clearNode(this._triggerElement);
    const item = ctx.items.find((i) => i.value === ctx.currentValue);
    const label = item?.label ?? ctx.currentValue;
    const icon = this._getTriggerIcon(ctx.currentValue);
    if (icon) {
      dom.append(this._triggerElement, renderIcon(icon));
    }
    const labelSpan = dom.append(this._triggerElement, dom.$("span.sessions-chat-dropdown-label"));
    labelSpan.textContent = label;
    this._triggerElement.ariaLabel = this._getTriggerAriaLabel(label);
    const isResolving = ctx.provider.isSessionConfigResolving(ctx.sessionId).get();
    this._slotElement.classList.toggle("resolving", isResolving);
    this._triggerElement.setAttribute("aria-disabled", isResolving ? "true" : "false");
  }
  _showPicker(anchor = this._triggerElement, onHide) {
    if (!anchor || this._actionWidgetService.isVisible) {
      return false;
    }
    const ctx = this._getActiveContext();
    if (!ctx) {
      return false;
    }
    if (this._isCurrentlyResolvingConfig()) {
      return false;
    }
    const actionItems = ctx.items.map((item) => ({
      kind: ActionListItemKind.Action,
      label: item.label,
      detail: item.description,
      group: { title: "", icon: this._getActionItemIcon(item, ctx.currentValue) },
      item: { ...item, checked: item.value === ctx.currentValue }
    }));
    actionItems.push(...this._getFooterActionItems());
    const delegate = {
      onSelect: (item) => {
        this._actionWidgetService.hide();
        if (this._handleFooterActionItem(item)) {
          return;
        }
        if (!ctx.items.some((candidate) => candidate.value === item.value)) {
          return;
        }
        const previousItem = ctx.items.find((i) => i.value === ctx.currentValue);
        reportNewChatPickerClosed(this._telemetryService, {
          id: this._telemetryId,
          optionIdBefore: ctx.currentValue,
          optionIdAfter: item.value,
          optionLabelBefore: previousItem?.label ?? ctx.currentValue,
          optionLabelAfter: item.label,
          isPII: false
        });
        ctx.provider.setSessionConfigValue(ctx.sessionId, this._property, item.value).catch(() => {
        });
      },
      onHide: () => {
        anchor.focus();
        onHide?.();
      }
    };
    this._actionWidgetService.show(
      this._pickerId,
      false,
      actionItems,
      delegate,
      anchor,
      void 0,
      [],
      {
        getAriaLabel: (i) => i.label ?? "",
        getWidgetAriaLabel: () => this._getWidgetAriaLabel()
      },
      this._getListOptions()
    );
    return true;
  }
};
AgentHostSessionEnumPicker = __decorateClass([
  __decorateParam(1, IActionWidgetService),
  __decorateParam(2, ISessionsProvidersService),
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, IHoverService)
], AgentHostSessionEnumPicker);
class AgentHostModePicker extends AgentHostSessionEnumPicker {
  constructor() {
    super(...arguments);
    this._property = SessionConfigKey.Mode;
    this._pickerId = "agentHostModePicker";
    this._telemetryId = "NewChatAgentHostModePicker";
  }
  _getListOptions() {
    return { minWidth: 260 };
  }
  _isWellKnownSchema(schema) {
    return isWellKnownModeSchema(schema);
  }
  _getTriggerIcon(value) {
    return getAgentHostModeIcon(value);
  }
  _getActionItemIcon(item) {
    return getAgentHostModeIcon(item.value);
  }
  _getTriggerAriaLabel(label) {
    return localize("agentHostModePicker.triggerAriaLabel", "Pick Agent Mode, {0}", label);
  }
  _getWidgetAriaLabel() {
    return localize("agentHostModePicker.ariaLabel", "Agent Mode Picker");
  }
}
export {
  AgentHostModePicker,
  AgentHostSessionEnumPicker
};
