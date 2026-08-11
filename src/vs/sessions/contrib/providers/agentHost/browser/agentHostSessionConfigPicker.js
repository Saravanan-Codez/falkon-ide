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
import "./media/agentHostSessionConfigPicker.css";
import * as dom from "../../../../../base/browser/dom.js";
import { Gesture, EventType as TouchEventType } from "../../../../../base/browser/touch.js";
import { renderIcon } from "../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { ActionListItemKind } from "../../../../../platform/actionWidget/browser/actionList.js";
import { IActionWidgetService } from "../../../../../platform/actionWidget/browser/actionWidget.js";
import { BaseActionViewItem } from "../../../../../base/browser/ui/actionbar/actionViewItems.js";
import { Checkbox } from "../../../../../base/browser/ui/toggle/toggle.js";
import { Delayer } from "../../../../../base/common/async.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Disposable, DisposableMap, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { autorun, constObservable } from "../../../../../base/common/observable.js";
import { localize, localize2 } from "../../../../../nls.js";
import { IActionViewItemService } from "../../../../../platform/actions/browser/actionViewItemService.js";
import { Action2, MenuId, MenuItemAction, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { IStorageService } from "../../../../../platform/storage/common/storage.js";
import { defaultCheckboxStyles } from "../../../../../platform/theme/browser/defaultStyles.js";
import { ChatConfiguration, isChatPermissionLevel } from "../../../../../workbench/contrib/chat/common/constants.js";
import { maybeConfirmElevatedPermissionLevel } from "../../../../../workbench/contrib/chat/common/chatPermissionWarnings.js";
import { ChatContextKeyExprs, ChatContextKeys } from "../../../../../workbench/contrib/chat/common/actions/chatContextKeys.js";
import { markOnboardingTarget } from "../../../../../workbench/contrib/onboarding/browser/spotlight/onboardingTarget.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../../workbench/common/contributions.js";
import { Menus } from "../../../../browser/menus.js";
import { SessionProviderIdContext, IsPhoneLayoutContext, IsQuickChatSessionContext } from "../../../../common/contextkeys.js";
import { IWorkbenchLayoutService } from "../../../../../workbench/services/layout/browser/layoutService.js";
import { reportNewChatPickerClosed } from "../../../chat/browser/newChatPickerTelemetry.js";
import { ISessionsProvidersService } from "../../../../services/sessions/browser/sessionsProvidersService.js";
import { ISessionContext } from "../../../../services/sessions/browser/sessionContext.js";
import { ISessionsService } from "../../../../services/sessions/browser/sessionsService.js";
import { isAgentHostProvider, LOCAL_AGENT_HOST_PROVIDER_ID, REMOTE_AGENT_HOST_PROVIDER_RE } from "../../../../common/agentHostSessionsProvider.js";
import { MobilePermissionPicker } from "../../copilotChatSessions/browser/mobilePermissionPicker.js";
import { isPhoneLayout } from "../../../../browser/parts/mobile/mobileLayout.js";
import { showMobilePickerSheet } from "../../../../browser/parts/mobile/mobilePickerSheet.js";
import { AgentHostModePicker } from "./agentHostModePicker.js";
import { MobileAgentHostModePicker } from "./mobile/mobileAgentHostModePicker.js";
import { AgentHostPermissionPickerActionItem } from "./agentHostPermissionPickerActionItem.js";
import { AgentHostPermissionPickerDelegate, isWellKnownAutoApproveSchema, isWellKnownClaudePermissionModeSchema, isWellKnownCodexApprovalsSchema, isWellKnownModeSchema } from "./agentHostPermissionPickerDelegate.js";
import { SessionConfigKey } from "../../../../../platform/agentHost/common/sessionConfigKeys.js";
import { AgentHostClaudePermissionModePicker } from "./agentHostClaudePermissionModePicker.js";
import { ClaudeSessionConfigKey } from "../../../../../platform/agentHost/common/claudeSessionConfigKeys.js";
import { AgentHostCodexApprovalsPicker } from "./agentHostCodexApprovalsPicker.js";
import { isAutoApproveValuePolicyRestricted } from "../../../../../workbench/contrib/chat/common/agentHostConfigPolicy.js";
import { CodexSessionConfigKey } from "../../../../../platform/agentHost/common/codexSessionConfigKeys.js";
const IsActiveSessionRemoteAgentHost = ContextKeyExpr.regex(SessionProviderIdContext.key, REMOTE_AGENT_HOST_PROVIDER_RE);
const IsActiveSessionLocalAgentHost = ContextKeyExpr.equals(SessionProviderIdContext.key, LOCAL_AGENT_HOST_PROVIDER_ID);
function showActiveSessionModePicker(accessor) {
  const activeElement = dom.getActiveElement();
  const anchor = dom.isHTMLElement(activeElement) ? activeElement : dom.getActiveDocument().body;
  const picker = accessor.get(IInstantiationService).createInstance(
    isPhoneLayout(accessor.get(IWorkbenchLayoutService)) ? MobileAgentHostModePicker : AgentHostModePicker,
    accessor.get(ISessionsService).activeSession
  );
  if (!picker.showPicker(anchor, () => picker.dispose())) {
    picker.dispose();
  }
}
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "sessions.agentHost.sessionConfigPicker",
      title: localize2("agentHostSessionConfigPicker", "Session Configuration"),
      f1: false,
      menu: [{
        id: Menus.NewSessionRepositoryConfig,
        group: "navigation",
        order: 3,
        when: ContextKeyExpr.and(
          ContextKeyExpr.or(IsActiveSessionLocalAgentHost, IsActiveSessionRemoteAgentHost),
          IsQuickChatSessionContext.negate()
        )
      }]
    });
  }
  async run() {
  }
});
function getConfigIcon(property, value) {
  if (property === SessionConfigKey.Isolation) {
    if (value === "folder") {
      return Codicon.folder;
    }
    if (value === "worktree") {
      return Codicon.worktree;
    }
  }
  if (property === SessionConfigKey.Branch) {
    return Codicon.gitBranch;
  }
  if (property === SessionConfigKey.AutoApprove) {
    if (value === "autopilot") {
      return Codicon.rocket;
    }
    if (value === "autoApprove") {
      return Codicon.warning;
    }
    if (value === "assisted") {
      return Codicon.sparkle;
    }
    return Codicon.shield;
  }
  return void 0;
}
function toActionItems(property, items, currentValue, policyRestricted) {
  return items.map((item) => {
    const disabled = property === SessionConfigKey.AutoApprove && isAutoApproveValuePolicyRestricted(item.value, policyRestricted === true);
    return {
      kind: ActionListItemKind.Action,
      label: item.label,
      detail: disabled ? localize("agentHostSessionConfig.policyDisabled", "Disabled by your organization. Contact your administrator.") : item.description,
      group: { title: "", icon: getConfigIcon(property, item.value) },
      disabled,
      item: { ...item, checked: isSelectedValue(currentValue, item.value) }
    };
  });
}
function isSelectedValue(currentValue, itemValue) {
  if (typeof currentValue === "boolean") {
    return currentValue === (itemValue === "true");
  }
  return itemValue === currentValue;
}
function renderPickerTrigger(slot, disabled, disposables, onOpen) {
  const trigger = dom.append(slot, disabled ? dom.$("span.action-label") : dom.$("a.action-label"));
  if (disabled) {
    trigger.setAttribute("aria-readonly", "true");
  } else {
    trigger.role = "button";
    trigger.tabIndex = 0;
    trigger.setAttribute("aria-haspopup", "listbox");
    disposables.add(Gesture.addTarget(trigger));
    for (const eventType of [dom.EventType.CLICK, TouchEventType.Tap]) {
      disposables.add(dom.addDisposableListener(trigger, eventType, (e) => {
        dom.EventHelper.stop(e, true);
        onOpen();
      }));
    }
    disposables.add(dom.addDisposableListener(trigger, dom.EventType.KEY_DOWN, (e) => {
      if (e.key === "Enter" || e.key === " ") {
        dom.EventHelper.stop(e, true);
        onOpen();
      }
    }));
  }
  slot.classList.toggle("disabled", disabled);
  return trigger;
}
function applyAutoApproveFiltering(items, property, configurationService) {
  if (property !== SessionConfigKey.AutoApprove) {
    return { items, policyRestricted: false };
  }
  const policyRestricted = configurationService.inspect(ChatConfiguration.GlobalAutoApprove).policyValue === false;
  return { items, policyRestricted };
}
async function confirmAutoApproveLevel(value, label, dialogService, storageService) {
  if (!isChatPermissionLevel(value)) {
    return true;
  }
  return maybeConfirmElevatedPermissionLevel(value, dialogService, storageService, { defaultSettingKey: ChatConfiguration.DefaultConfiguration, levelLabel: label });
}
function applyAutoApproveTriggerStyles(trigger, property, value) {
  if (property === SessionConfigKey.AutoApprove) {
    trigger.classList.toggle("warning", value === "autopilot" || value === "assisted");
    trigger.classList.toggle("info", value === "autoApprove");
  }
}
class IsolationCheckboxControl extends Disposable {
  constructor(sessionId, label, _hoverService, onToggle) {
    super();
    this.sessionId = sessionId;
    this._hoverService = _hoverService;
    this.slot = dom.$(".sessions-chat-picker-slot.sessions-chat-isolation-checkbox");
    this._hover = this._register(new MutableDisposable());
    this._enabled = true;
    this._row = dom.append(this.slot, dom.$(".action-label"));
    this.checkbox = this._register(new Checkbox(label, false, { ...defaultCheckboxStyles, size: 14 }));
    dom.append(this._row, this.checkbox.domNode);
    const labelSpan = dom.append(this._row, dom.$("span.sessions-chat-dropdown-label"));
    labelSpan.textContent = label;
    this._register(markOnboardingTarget(this.slot, "sessions.newSession.isolation"));
    this._register(this.checkbox.onChange(() => onToggle(this.checkbox.checked)));
    this._register(Gesture.addTarget(this._row));
    for (const eventType of [dom.EventType.CLICK, TouchEventType.Tap]) {
      this._register(dom.addDisposableListener(this._row, eventType, (e) => {
        dom.EventHelper.stop(e, true);
        if (!this._enabled) {
          return;
        }
        this.checkbox.checked = !this.checkbox.checked;
        onToggle(this.checkbox.checked);
      }));
    }
  }
  update(checked, readOnly, resolving, tooltip) {
    this._enabled = !readOnly && !resolving;
    this.checkbox.checked = checked;
    if (readOnly) {
      this.checkbox.disable();
    } else {
      this.checkbox.enable();
      this.checkbox.domNode.setAttribute("aria-disabled", resolving ? "true" : "false");
    }
    this.slot.classList.toggle("disabled", readOnly);
    this.slot.classList.toggle("resolving", !readOnly && resolving);
    if (this._tooltip !== tooltip) {
      this._tooltip = tooltip;
      this._hover.value = tooltip ? this._hoverService.setupDelayedHover(this._row, { content: tooltip }) : void 0;
    }
  }
  dispose() {
    this.slot.remove();
    super.dispose();
  }
}
let AgentHostSessionConfigPicker = class extends Disposable {
  constructor(_session, _actionWidgetService, _configurationService, _contextKeyService, _dialogService, _hoverService, _sessionsProvidersService, _telemetryService, _layoutService, _storageService) {
    super();
    this._session = _session;
    this._actionWidgetService = _actionWidgetService;
    this._configurationService = _configurationService;
    this._contextKeyService = _contextKeyService;
    this._dialogService = _dialogService;
    this._hoverService = _hoverService;
    this._sessionsProvidersService = _sessionsProvidersService;
    this._telemetryService = _telemetryService;
    this._layoutService = _layoutService;
    this._storageService = _storageService;
    this._renderDisposables = this._register(new DisposableStore());
    this._providerListeners = this._register(new DisposableMap());
    this._isolationCheckbox = this._register(new MutableDisposable());
    this._filterDelayer = this._register(new Delayer(200));
    /**
     * Session/property-scoped value→label cache for `enumDynamic`
     * properties (e.g. branch), populated whenever `_getItems` fetches
     * completions. `enumDynamic` completions are transient protocol
     * data — only `value` is persisted via `setSessionConfigValue`/
     * `resolveSessionConfig` — so this is the only place a completion's
     * `label` for a previously-picked value can be recovered once the
     * dropdown/sheet closes. Static `enum` properties don't need this:
     * their label is always derivable from `schema.enum`/`enumLabels`.
     *
     * Keyed by session so entries don't leak across sessions: this picker
     * is only ever created for the new-session composer (`Menus.NewSession-
     * RepositoryConfig`), and that composer's `_session` tracks the
     * globally active session — so the *same* picker instance can observe
     * a sequence of different (not-yet-created) draft sessions as the user
     * switches between them. `_renderConfigPickers` evicts entries for any
     * session other than the current one on every render, so the map never
     * grows beyond the properties of the currently active session.
     */
    this._dynamicValueLabels = /* @__PURE__ */ new Map();
    this._register(autorun((reader) => {
      this._session.read(reader);
      this._renderConfigPickers();
    }));
    this._register(this._sessionsProvidersService.onDidChangeProviders((e) => {
      for (const provider of e.removed) {
        this._providerListeners.deleteAndDispose(provider.id);
      }
      this._watchProviders(e.added);
      this._renderConfigPickers();
    }));
    this._watchProviders(this._sessionsProvidersService.getProviders());
    this._register(this._contextKeyService.onDidChangeContext((e) => {
      if (e.affectsSome(/* @__PURE__ */ new Set([IsPhoneLayoutContext.key]))) {
        this._renderConfigPickers();
      }
    }));
  }
  _watchProviders(providers) {
    for (const provider of providers) {
      if (!isAgentHostProvider(provider) || this._providerListeners.has(provider.id)) {
        continue;
      }
      this._providerListeners.set(provider.id, provider.onDidChangeSessionConfig(() => this._renderConfigPickers()));
    }
  }
  render(container) {
    this._isolationCheckbox.clear();
    this._container = dom.append(container, dom.$(".sessions-chat-agent-host-config"));
    this._renderConfigPickers();
  }
  _renderConfigPickers() {
    if (!this._container) {
      return;
    }
    this._renderDisposables.clear();
    const isolationSlot = this._isolationCheckbox.value?.slot;
    for (const child of Array.from(this._container.children)) {
      if (child !== isolationSlot) {
        child.remove();
      }
    }
    const session = this._session.get();
    this._evictDynamicValueLabelsForOtherSessions(session?.sessionId);
    const provider = session ? this._getProvider(session.providerId) : void 0;
    const resolvedConfig = session && provider?.getSessionConfig(session.sessionId);
    if (!session || !provider || !resolvedConfig) {
      this._isolationCheckbox.clear();
      return;
    }
    const isNewSession = provider.getCreateSessionConfig(session.sessionId) !== void 0;
    const isLoading = provider.isSessionConfigResolving(session.sessionId).get();
    const properties = this._orderProperties(Object.entries(resolvedConfig.schema.properties));
    let renderedIsolationCheckbox = false;
    for (const [property, schema] of properties) {
      if (!this._isPickable(schema)) {
        continue;
      }
      if (property === SessionConfigKey.WorktreeBranchTrack) {
        continue;
      }
      if (property === SessionConfigKey.Isolation && !schema.enum?.includes("worktree")) {
        continue;
      }
      if (!this._shouldRenderProperty(property, schema, isNewSession)) {
        continue;
      }
      if (property === SessionConfigKey.AutoApprove && isWellKnownAutoApproveSchema(schema)) {
        continue;
      }
      if (property === SessionConfigKey.Mode && isWellKnownModeSchema(schema)) {
        continue;
      }
      if (property === ClaudeSessionConfigKey.PermissionMode && isWellKnownClaudePermissionModeSchema(schema)) {
        continue;
      }
      if (property === CodexSessionConfigKey.PermissionsPreset && isWellKnownCodexApprovalsSchema(schema)) {
        continue;
      }
      const value = resolvedConfig.values[property] ?? schema.default;
      const isReadOnly = this._isReadOnlyChip(property, schema, isNewSession);
      if (property === SessionConfigKey.Isolation && this._shouldRenderIsolationAsCheckbox(schema)) {
        this._renderIsolationCheckbox(session.sessionId, schema, value, isReadOnly, !isReadOnly && isLoading);
        renderedIsolationCheckbox = true;
        continue;
      }
      const slot = dom.append(this._container, dom.$(".sessions-chat-picker-slot"));
      if (property === SessionConfigKey.Isolation) {
        this._renderDisposables.add(markOnboardingTarget(slot, "sessions.newSession.isolation"));
      }
      const trigger = renderPickerTrigger(slot, isReadOnly, this._renderDisposables, () => this._showPicker(provider, session.sessionId, property, schema, trigger));
      const tooltip = property === SessionConfigKey.Branch && isReadOnly ? void 0 : schema.description ?? schema.title;
      if (tooltip) {
        this._renderDisposables.add(this._hoverService.setupDelayedHover(trigger, { content: tooltip }));
      }
      if (!isReadOnly && isLoading) {
        slot.classList.add("resolving");
        trigger.setAttribute("aria-disabled", "true");
      }
      this._renderTrigger(trigger, session.sessionId, property, schema, value, isReadOnly);
    }
    if (!renderedIsolationCheckbox) {
      this._isolationCheckbox.clear();
    }
  }
  _isPickable(schema) {
    if (schema.type === "boolean") {
      return true;
    }
    if (schema.type !== "string") {
      return false;
    }
    return !!schema.enumDynamic || Array.isArray(schema.enum) && schema.enum.length > 0;
  }
  /**
   * Order the schema properties for rendering. The base implementation
   * enforces a stable visual sequence for well-known properties:
   * Isolation (worktree/folder) first, then Branch. Any other properties
   * keep their original schema order after these two. Subclasses can
   * override to impose a different deterministic visual sequence
   * (e.g. the mobile chip row groups Approvals | Branch | Worktree).
   */
  _orderProperties(properties) {
    const order = /* @__PURE__ */ new Map([
      [SessionConfigKey.Isolation, 0],
      [SessionConfigKey.Branch, 1]
    ]);
    return properties.map(([key, schema], index) => ({ key, schema, index })).sort((a, b) => {
      const aRank = order.get(a.key) ?? Number.MAX_SAFE_INTEGER;
      const bRank = order.get(b.key) ?? Number.MAX_SAFE_INTEGER;
      return aRank - bRank || a.index - b.index;
    }).map(({ key, schema }) => [key, schema]);
  }
  /**
   * Decide whether a property's chip should be rendered for the current
   * session. The base implementation hides non-mutable properties in
   * running sessions (they would render as dead pills). Subclasses can
   * override to keep specific properties visible as readonly chips —
   * see {@link _isReadOnlyChip}.
   */
  _shouldRenderProperty(property, schema, isNewSession) {
    return isNewSession || !!schema.sessionMutable;
  }
  /**
   * Decide whether a property's trigger should render as readonly
   * (no chevron, no popup). The base implementation defers to the
   * schema's `readOnly` flag. Subclasses that opt in to rendering
   * non-mutable chips via {@link _shouldRenderProperty} should
   * override this to also mark them readonly at runtime.
   */
  _isReadOnlyChip(property, schema, isNewSession) {
    return !!schema.readOnly;
  }
  _renderTrigger(trigger, sessionId, property, schema, value, isReadOnly) {
    dom.clearNode(trigger);
    const icon = getConfigIcon(property, value);
    if (icon) {
      dom.append(trigger, renderIcon(icon));
    }
    const labelSpan = dom.append(trigger, dom.$("span.sessions-chat-dropdown-label"));
    const label = this._getLabel(sessionId, property, schema, value);
    labelSpan.textContent = label;
    trigger.setAttribute("aria-label", isReadOnly ? localize("agentHostSessionConfig.triggerAriaReadOnly", "{0}: {1}, Read-Only", schema.title, label) : localize("agentHostSessionConfig.triggerAria", "{0}: {1}", schema.title, label));
    applyAutoApproveTriggerStyles(trigger, property, value);
  }
  /**
   * Whether the isolation property should render as a checkbox
   * (Worktree on/off) rather than a dropdown. Only on non-phone
   * layouts and only when the schema offers both folder and worktree.
   */
  _shouldRenderIsolationAsCheckbox(schema) {
    return !isPhoneLayout(this._layoutService) && Array.isArray(schema.enum) && schema.enum.includes("worktree") && schema.enum.includes("folder");
  }
  _renderIsolationCheckbox(sessionId, schema, value, isReadOnly, isLoading) {
    const label = localize("agentHostSessionConfig.isolation.worktree", "New Worktree");
    const worktreeIndex = schema.enum?.indexOf("worktree") ?? -1;
    const tooltip = (worktreeIndex >= 0 ? schema.enumDescriptions?.[worktreeIndex] : void 0) ?? schema.description ?? schema.title;
    let control = this._isolationCheckbox.value;
    if (!control || control.sessionId !== sessionId) {
      control = new IsolationCheckboxControl(sessionId, label, this._hoverService, (checked) => this._applyIsolationValue(sessionId, checked));
      this._isolationCheckbox.value = control;
      this._container?.prepend(control.slot);
    }
    control.update(value === "worktree", isReadOnly, isLoading, tooltip);
  }
  _applyIsolationValue(sessionId, checked) {
    const session = this._session.get();
    if (!session || session.sessionId !== sessionId) {
      return;
    }
    const provider = this._getProvider(session.providerId);
    const resolvedConfig = provider?.getSessionConfig(sessionId);
    const schema = resolvedConfig?.schema.properties[SessionConfigKey.Isolation];
    if (!provider || !schema) {
      return;
    }
    const before = resolvedConfig.values[SessionConfigKey.Isolation] ?? schema.default;
    const nextValue = checked ? "worktree" : "folder";
    reportNewChatPickerClosed(this._telemetryService, {
      id: "NewChatAgentHostSessionConfigPicker",
      name: `NewChatAgentHostSessionConfigPicker.${SessionConfigKey.Isolation}`,
      optionIdBefore: typeof before === "string" ? before : void 0,
      optionIdAfter: nextValue,
      optionLabelBefore: typeof before === "string" ? this._getLabel(sessionId, SessionConfigKey.Isolation, schema, before) : void 0,
      optionLabelAfter: this._getLabel(sessionId, SessionConfigKey.Isolation, schema, nextValue),
      isPII: false
    });
    provider.setSessionConfigValue(sessionId, SessionConfigKey.Isolation, nextValue).catch(() => {
    });
  }
  async _showPicker(provider, sessionId, property, schema, trigger) {
    if (schema.readOnly || this._actionWidgetService.isVisible) {
      return;
    }
    if (provider.isSessionConfigResolving(sessionId).get()) {
      return;
    }
    const rawItems = await this._getItems(provider, sessionId, property, schema);
    const { items, policyRestricted } = applyAutoApproveFiltering(rawItems, property, this._configurationService);
    if (items.length === 0) {
      return;
    }
    const isAutoApproveProperty = property === SessionConfigKey.AutoApprove;
    const currentValue = provider.getSessionConfig(sessionId)?.values[property] ?? schema.default;
    const currentItem = items.find((i) => isSelectedValue(currentValue, i.value));
    const actionItems = toActionItems(property, items, currentValue, policyRestricted);
    const delegate = {
      onSelect: async (item) => {
        this._actionWidgetService.hide();
        reportNewChatPickerClosed(this._telemetryService, {
          id: "NewChatAgentHostSessionConfigPicker",
          name: `NewChatAgentHostSessionConfigPicker.${property}`,
          optionIdBefore: typeof currentValue === "string" ? currentValue : void 0,
          optionIdAfter: item.value,
          optionLabelBefore: currentItem?.label,
          optionLabelAfter: item.label,
          isPII: !!schema.enumDynamic
        });
        if (isAutoApproveProperty && item.value !== "default") {
          const confirmed = await confirmAutoApproveLevel(item.value, item.label, this._dialogService, this._storageService);
          if (!confirmed) {
            return;
          }
        }
        const nextValue = schema.type === "boolean" ? item.value === "true" : item.value;
        provider.setSessionConfigValue(sessionId, property, nextValue).catch(() => {
        });
      },
      onFilter: schema.enumDynamic ? (query) => this._filterDelayer.trigger(async () => {
        const filteredRawItems = await this._getItems(provider, sessionId, property, schema, query);
        const { items: filteredItems, policyRestricted: filteredPolicyRestricted } = applyAutoApproveFiltering(filteredRawItems, property, this._configurationService);
        return toActionItems(property, filteredItems, provider.getSessionConfig(sessionId)?.values[property] ?? schema.default, filteredPolicyRestricted);
      }) : void 0,
      onHide: () => trigger.focus()
    };
    this._actionWidgetService.show(
      `agentHostSessionConfig.${property}`,
      false,
      actionItems,
      delegate,
      trigger,
      void 0,
      [],
      {
        getAriaLabel: (item) => item.label ?? "",
        getWidgetAriaLabel: () => localize("agentHostSessionConfig.ariaLabel", "{0} Picker", schema.title)
      },
      actionItems.length > 10 ? { showFilter: true, filterPlaceholder: localize("agentHostSessionConfig.filter", "Filter options..."), minWidth: 255 } : { minWidth: 255 }
    );
  }
  async _getItems(provider, sessionId, property, schema, query) {
    if (schema.type === "boolean") {
      return [
        { value: "true", label: localize("agentHostSessionConfig.boolean.true", "On") },
        { value: "false", label: localize("agentHostSessionConfig.boolean.false", "Off") }
      ];
    }
    const dynamicItems = schema.enumDynamic ? await provider.getSessionConfigCompletions(sessionId, property, query) : void 0;
    if (dynamicItems?.length) {
      const items = dynamicItems.map((item) => this._fromCompletionItem(item));
      this._cacheDynamicValueLabels(sessionId, property, items);
      return items;
    }
    return (schema.enum ?? []).map((value, index) => ({
      value: String(value),
      label: schema.enumLabels?.[index] ?? String(value),
      description: schema.enumDescriptions?.[index]
    }));
  }
  _fromCompletionItem(item) {
    return {
      value: item.value,
      label: item.label,
      description: item.description
    };
  }
  _dynamicValueLabelsKey(sessionId, property) {
    return `${sessionId}\0${property}`;
  }
  _cacheDynamicValueLabels(sessionId, property, items) {
    const key = this._dynamicValueLabelsKey(sessionId, property);
    let labels = this._dynamicValueLabels.get(key);
    if (!labels) {
      labels = /* @__PURE__ */ new Map();
      this._dynamicValueLabels.set(key, labels);
    }
    for (const item of items) {
      labels.set(item.value, item.label);
    }
  }
  /**
   * Drops cached labels for any session other than `sessionId`. Called on
   * every render so the cache tracks whichever session the picker is
   * currently bound to, instead of accumulating entries for every draft
   * session this (potentially long-lived) picker instance has ever shown.
   */
  _evictDynamicValueLabelsForOtherSessions(sessionId) {
    if (!sessionId) {
      return;
    }
    const prefix = `${sessionId}\0`;
    for (const key of this._dynamicValueLabels.keys()) {
      if (!key.startsWith(prefix)) {
        this._dynamicValueLabels.delete(key);
      }
    }
  }
  _getLabel(sessionId, property, schema, value) {
    if (schema.type === "boolean") {
      return value === true ? localize("agentHostSessionConfig.boolean.onLabel", "On") : localize("agentHostSessionConfig.boolean.offLabel", "Off");
    }
    if (typeof value === "string") {
      if (schema.enumDynamic) {
        const key = this._dynamicValueLabelsKey(sessionId, property);
        const dynamicLabel = this._dynamicValueLabels.get(key)?.get(value);
        if (dynamicLabel) {
          return dynamicLabel;
        }
      }
      const index = schema.enum?.indexOf(value) ?? -1;
      return index >= 0 ? schema.enumLabels?.[index] ?? value : value;
    }
    return schema.title;
  }
  _getProvider(providerId) {
    const provider = this._sessionsProvidersService.getProvider(providerId);
    return provider && isAgentHostProvider(provider) ? provider : void 0;
  }
};
AgentHostSessionConfigPicker = __decorateClass([
  __decorateParam(1, IActionWidgetService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IDialogService),
  __decorateParam(5, IHoverService),
  __decorateParam(6, ISessionsProvidersService),
  __decorateParam(7, ITelemetryService),
  __decorateParam(8, IWorkbenchLayoutService),
  __decorateParam(9, IStorageService)
], AgentHostSessionConfigPicker);
class MobileAgentHostSessionConfigPicker extends AgentHostSessionConfigPicker {
  /**
   * On phone the chip lane has a fixed visual sequence — Default
   * Approvals (rendered by a separate left-side picker), then Branch,
   * then Worktree. Sort the known repo-config properties to that
   * order; unknown properties fall through to schema-declared order
   * after the known ones.
   *
   * On desktop viewports this subclass is also instantiated (see the
   * factory in `AgentHostSessionConfigPickersContribution` — it always
   * picks the mobile-aware subclass so `_showPicker` can route to the
   * bottom sheet on phones), so we must defer to the base ordering
   * (Isolation first, Branch second) when not on a phone layout.
   */
  _orderProperties(properties) {
    if (!isPhoneLayout(this._layoutService)) {
      return super._orderProperties(properties);
    }
    const order = /* @__PURE__ */ new Map([
      [SessionConfigKey.Branch, 0],
      [SessionConfigKey.Isolation, 1]
    ]);
    return properties.slice().sort(([aKey], [bKey]) => {
      const a = order.get(aKey) ?? Number.MAX_SAFE_INTEGER;
      const b = order.get(bKey) ?? Number.MAX_SAFE_INTEGER;
      return a - b;
    });
  }
  /**
   * Keep Branch and Isolation visible in running sessions even when
   * the schema marks them non-mutable. Their value is informational
   * — the user wants to see what the running session is using —
   * and the chip renders as readonly via {@link _isReadOnlyChip}.
   * All other properties defer to the base behavior (hide if
   * non-mutable in a running session).
   */
  _shouldRenderProperty(property, schema, isNewSession) {
    const isUnifiedRepoProperty = property === SessionConfigKey.Isolation || property === SessionConfigKey.Branch;
    return isUnifiedRepoProperty || super._shouldRenderProperty(property, schema, isNewSession);
  }
  /**
   * Mark non-mutable properties as readonly chips in running sessions
   * so taps don't try to open a picker (which would no-op at the
   * provider boundary). The schema's own `readOnly` flag still wins.
   */
  _isReadOnlyChip(property, schema, isNewSession) {
    return super._isReadOnlyChip(property, schema, isNewSession) || !isNewSession && !schema.sessionMutable;
  }
  async _showPicker(provider, sessionId, property, schema, trigger) {
    if (!isPhoneLayout(this._layoutService)) {
      return super._showPicker(provider, sessionId, property, schema, trigger);
    }
    if (provider.isSessionConfigResolving(sessionId).get()) {
      return;
    }
    if (property === SessionConfigKey.Isolation || property === SessionConfigKey.Branch) {
      await this._showUnifiedRepoSheet(provider, sessionId, trigger);
      return;
    }
    return super._showPicker(provider, sessionId, property, schema, trigger);
  }
  async _showUnifiedRepoSheet(provider, sessionId, trigger) {
    const config = provider.getSessionConfig(sessionId);
    if (!config) {
      return;
    }
    const isolationSchema = config.schema.properties[SessionConfigKey.Isolation];
    const branchSchema = config.schema.properties[SessionConfigKey.Branch];
    const [isolationItems, branchItems] = await Promise.all([
      isolationSchema && !isolationSchema.readOnly ? this._getItems(provider, sessionId, SessionConfigKey.Isolation, isolationSchema) : Promise.resolve([]),
      branchSchema && !branchSchema.readOnly ? this._getItems(provider, sessionId, SessionConfigKey.Branch, branchSchema) : Promise.resolve([])
    ]);
    const isolationValue = config.values[SessionConfigKey.Isolation];
    const branchValue = config.values[SessionConfigKey.Branch];
    const sheetItems = [];
    const idToConfig = /* @__PURE__ */ new Map();
    const registerId = (property, value, label, isPII) => {
      const id = `repo-row-${idToConfig.size}`;
      idToConfig.set(id, { property, value, label, isPII });
      return id;
    };
    isolationItems.forEach((item, index) => {
      sheetItems.push({
        id: registerId(SessionConfigKey.Isolation, item.value, item.label, !!isolationSchema?.enumDynamic),
        label: item.label,
        description: item.description,
        icon: getConfigIcon(SessionConfigKey.Isolation, item.value),
        checked: item.value === isolationValue,
        sectionTitle: index === 0 ? isolationSchema?.title ?? localize("mobileAgentHostSessionConfig.repoSheet.isolationSection", "Isolation") : void 0
      });
    });
    const branchSectionTitle = branchSchema?.title ?? localize("mobileAgentHostSessionConfig.repoSheet.branchSection", "Base Branch");
    if (!branchSchema?.enumDynamic) {
      branchItems.forEach((item, index) => {
        sheetItems.push({
          id: registerId(SessionConfigKey.Branch, item.value, item.label, !!branchSchema?.enumDynamic),
          label: item.label,
          description: item.description,
          icon: getConfigIcon(SessionConfigKey.Branch, item.value),
          checked: item.value === branchValue,
          sectionTitle: index === 0 ? branchSectionTitle : void 0
        });
      });
    }
    if (sheetItems.length === 0 && !branchSchema?.enumDynamic) {
      return;
    }
    let search;
    if (branchSchema?.enumDynamic && !branchSchema.readOnly) {
      search = {
        placeholder: localize("mobileAgentHostSessionConfig.repoSheet.branchSearchPlaceholder", "Search branches"),
        ariaLabel: localize("mobileAgentHostSessionConfig.repoSheet.branchSearchAria", "Search base branches"),
        resultsSectionTitle: branchSectionTitle,
        emptyMessage: localize("mobileAgentHostSessionConfig.repoSheet.branchSearchEmpty", "No matching branches."),
        loadItems: async (query, token) => {
          const items = query ? await this._getItems(provider, sessionId, SessionConfigKey.Branch, branchSchema, query) : branchItems;
          if (token.isCancellationRequested) {
            return [];
          }
          return items.map((item) => ({
            id: registerId(SessionConfigKey.Branch, item.value, item.label, !!branchSchema.enumDynamic),
            label: item.label,
            description: item.description,
            icon: getConfigIcon(SessionConfigKey.Branch, item.value),
            checked: item.value === branchValue
          }));
        }
      };
    }
    trigger.setAttribute("aria-expanded", "true");
    await showMobilePickerSheet(
      this._layoutService.mainContainer,
      localize("mobileAgentHostSessionConfig.repoSheet.title", "Worktree"),
      sheetItems,
      {
        search,
        // Keep the sheet open on row taps so the user can adjust
        // both isolation mode and branch without reopening. Each
        // tap writes through immediately; Done just dismisses.
        stayOpenOnSelect: true,
        onDidSelect: (id) => {
          const selection = idToConfig.get(id);
          if (selection) {
            const beforeValue = provider.getSessionConfig(sessionId)?.values[selection.property];
            reportNewChatPickerClosed(this._telemetryService, {
              id: "NewChatAgentHostSessionConfigPicker",
              name: `NewChatAgentHostSessionConfigPicker.${selection.property}`,
              optionIdBefore: typeof beforeValue === "string" ? beforeValue : void 0,
              optionIdAfter: selection.value,
              optionLabelBefore: void 0,
              optionLabelAfter: selection.label,
              isPII: selection.isPII
            });
            provider.setSessionConfigValue(sessionId, selection.property, selection.value).catch(() => {
            });
          }
        }
      }
    );
    trigger.setAttribute("aria-expanded", "false");
    trigger.focus();
  }
}
class PickerActionViewItem extends BaseActionViewItem {
  constructor(_picker, disposable) {
    super(void 0, { id: "", label: "", enabled: true, class: void 0, tooltip: "", run: () => {
    } });
    this._picker = _picker;
    if (disposable) {
      this._register(disposable);
    }
  }
  render(container) {
    this._picker.render(container);
  }
  dispose() {
    this._picker.dispose();
    super.dispose();
  }
}
let AgentHostSessionConfigPickerContribution = class extends Disposable {
  constructor(actionViewItemService, _layoutService) {
    super();
    this._layoutService = _layoutService;
    this._register(actionViewItemService.register(
      Menus.NewSessionRepositoryConfig,
      "sessions.agentHost.sessionConfigPicker",
      (_action, _options, scopedInstantiationService) => {
        const { session } = scopedInstantiationService.invokeFunction((accessor) => accessor.get(ISessionContext));
        return new PickerActionViewItem(scopedInstantiationService.createInstance(MobileAgentHostSessionConfigPicker, session));
      }
    ));
    this._register(actionViewItemService.register(
      Menus.NewSessionControl,
      NEW_SESSION_MODE_PICKER_ID,
      (_action, _options, scopedInstantiationService) => {
        const { session } = scopedInstantiationService.invokeFunction((accessor) => accessor.get(ISessionContext));
        return new PickerActionViewItem(scopedInstantiationService.createInstance(
          isPhoneLayout(this._layoutService) ? MobileAgentHostModePicker : AgentHostModePicker,
          session
        ));
      }
    ));
    this._register(actionViewItemService.register(
      MenuId.ChatInputSecondary,
      RUNNING_SESSION_MODE_PICKER_ID,
      (_action, _options, scopedInstantiationService) => {
        const { session } = scopedInstantiationService.invokeFunction((accessor) => accessor.get(ISessionContext));
        return new PickerActionViewItem(scopedInstantiationService.createInstance(
          isPhoneLayout(this._layoutService) ? MobileAgentHostModePicker : AgentHostModePicker,
          session
        ));
      }
    ));
    this._register(actionViewItemService.register(
      Menus.NewSessionControl,
      NEW_SESSION_APPROVE_PICKER_ID,
      (_action, _options, scopedInstantiationService) => this._createNewSessionPermissionPicker(scopedInstantiationService)
    ));
    this._register(actionViewItemService.register(
      Menus.NewSessionControl,
      NEW_SESSION_PERMISSION_MODE_PICKER_ID,
      (_action, _options, scopedInstantiationService) => {
        const { session } = scopedInstantiationService.invokeFunction((accessor) => accessor.get(ISessionContext));
        return new PickerActionViewItem(scopedInstantiationService.createInstance(AgentHostClaudePermissionModePicker, session));
      }
    ));
    this._register(actionViewItemService.register(
      Menus.NewSessionControl,
      NEW_SESSION_CODEX_APPROVALS_PICKER_ID,
      (_action, _options, scopedInstantiationService) => {
        const { session } = scopedInstantiationService.invokeFunction((accessor) => accessor.get(ISessionContext));
        return new PickerActionViewItem(scopedInstantiationService.createInstance(AgentHostCodexApprovalsPicker, session));
      }
    ));
    this._register(actionViewItemService.register(
      MenuId.ChatInputSecondary,
      RUNNING_SESSION_CONFIG_PICKER_ID,
      this._createRunningSessionPermissionPickerFactory()
    ));
    this._register(actionViewItemService.register(
      MenuId.ChatInputSecondary,
      RUNNING_SESSION_PERMISSION_MODE_PICKER_ID,
      (_action, _options, scopedInstantiationService) => {
        const { session } = scopedInstantiationService.invokeFunction((accessor) => accessor.get(ISessionContext));
        return new PickerActionViewItem(scopedInstantiationService.createInstance(AgentHostClaudePermissionModePicker, session));
      }
    ));
    this._register(actionViewItemService.register(
      MenuId.ChatInputSecondary,
      RUNNING_SESSION_CODEX_APPROVALS_PICKER_ID,
      (_action, _options, scopedInstantiationService) => {
        const { session } = scopedInstantiationService.invokeFunction((accessor) => accessor.get(ISessionContext));
        return new PickerActionViewItem(scopedInstantiationService.createInstance(AgentHostCodexApprovalsPicker, session));
      }
    ));
  }
  static {
    this.ID = "sessions.contrib.agentHostSessionConfigPicker";
  }
  /**
   * On the new-chat page (left of the toolbar), use the sessions
   * {@link PermissionPicker} so the styling matches the surrounding sessions
   * pickers (font size, padding, icon size).
   */
  _createNewSessionPermissionPicker(instantiationService) {
    const { session } = instantiationService.invokeFunction((accessor) => accessor.get(ISessionContext));
    const delegate = instantiationService.createInstance(AgentHostPermissionPickerDelegate, session);
    const picker = instantiationService.createInstance(MobilePermissionPicker, delegate);
    return new PickerActionViewItem(picker, delegate);
  }
  /**
   * Inside a running chat widget (`ChatInputSecondary`), use the workbench
   * {@link PermissionPickerActionItem} so it matches the rest of the
   * chat-input secondary toolbar (which is what the extension-host CLI
   * already uses).
   */
  _createRunningSessionPermissionPickerFactory() {
    return (action, _options, instantiationService) => {
      if (!(action instanceof MenuItemAction)) {
        return void 0;
      }
      const { session } = instantiationService.invokeFunction((accessor) => accessor.get(ISessionContext));
      const pickerOptions = {
        compact: constObservable(true),
        listOptions: { minWidth: 255 }
      };
      return instantiationService.createInstance(
        AgentHostPermissionPickerActionItem,
        action,
        pickerOptions,
        session
      );
    };
  }
};
AgentHostSessionConfigPickerContribution = __decorateClass([
  __decorateParam(0, IActionViewItemService),
  __decorateParam(1, IWorkbenchLayoutService)
], AgentHostSessionConfigPickerContribution);
const NEW_SESSION_APPROVE_PICKER_ID = "sessions.agentHost.newSessionApprovePicker";
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: NEW_SESSION_APPROVE_PICKER_ID,
      title: localize2("agentHostNewSessionApprovePicker", "Session Approvals"),
      f1: false,
      menu: [{
        id: Menus.NewSessionControl,
        group: "navigation",
        order: 1,
        when: ContextKeyExpr.or(IsActiveSessionLocalAgentHost, IsActiveSessionRemoteAgentHost)
      }]
    });
  }
  async run() {
  }
});
const NEW_SESSION_PERMISSION_MODE_PICKER_ID = "sessions.agentHost.newSessionPermissionModePicker";
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: NEW_SESSION_PERMISSION_MODE_PICKER_ID,
      title: localize2("agentHostNewSessionPermissionModePicker", "Approvals"),
      f1: false,
      menu: [{
        id: Menus.NewSessionControl,
        group: "navigation",
        order: 2,
        when: ContextKeyExpr.or(IsActiveSessionLocalAgentHost, IsActiveSessionRemoteAgentHost)
      }]
    });
  }
  async run() {
  }
});
const NEW_SESSION_CODEX_APPROVALS_PICKER_ID = "sessions.agentHost.newSessionCodexApprovalsPicker";
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: NEW_SESSION_CODEX_APPROVALS_PICKER_ID,
      title: localize2("agentHostNewSessionCodexApprovalsPicker", "Approvals"),
      f1: false,
      menu: [{
        id: Menus.NewSessionControl,
        group: "navigation",
        order: 3,
        when: ContextKeyExpr.or(IsActiveSessionLocalAgentHost, IsActiveSessionRemoteAgentHost)
      }]
    });
  }
  async run() {
  }
});
const NEW_SESSION_MODE_PICKER_ID = "sessions.agentHost.newSessionModePicker";
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: NEW_SESSION_MODE_PICKER_ID,
      title: localize2("agentHostNewSessionModePicker", "Agent Mode"),
      f1: false,
      menu: [{
        id: Menus.NewSessionControl,
        group: "navigation",
        order: 0,
        // On phone the {@link MobileChatInputConfigPicker} replaces
        // this picker with a unified mode + model bottom sheet, so
        // gate this desktop-only Action out of phone layouts.
        when: ContextKeyExpr.and(
          ContextKeyExpr.or(IsActiveSessionLocalAgentHost, IsActiveSessionRemoteAgentHost),
          IsPhoneLayoutContext.negate()
        )
      }]
    });
  }
  async run() {
  }
});
const RUNNING_SESSION_CONFIG_PICKER_ID = "sessions.agentHost.runningSessionConfigPicker";
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: RUNNING_SESSION_CONFIG_PICKER_ID,
      title: localize2("agentHostRunningSessionConfigPicker", "Session Approvals"),
      f1: false,
      menu: [{
        id: MenuId.ChatInputSecondary,
        group: "navigation",
        order: 10,
        when: ChatContextKeyExprs.isAgentHostSession
      }]
    });
  }
  async run() {
  }
});
const RUNNING_SESSION_PERMISSION_MODE_PICKER_ID = "sessions.agentHost.runningSessionPermissionModePicker";
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: RUNNING_SESSION_PERMISSION_MODE_PICKER_ID,
      title: localize2("agentHostRunningSessionPermissionModePicker", "Approvals"),
      f1: false,
      menu: [{
        id: MenuId.ChatInputSecondary,
        group: "navigation",
        order: 11,
        when: ChatContextKeyExprs.isAgentHostSession
      }]
    });
  }
  async run() {
  }
});
const RUNNING_SESSION_CODEX_APPROVALS_PICKER_ID = "sessions.agentHost.runningSessionCodexApprovalsPicker";
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: RUNNING_SESSION_CODEX_APPROVALS_PICKER_ID,
      title: localize2("agentHostRunningSessionCodexApprovalsPicker", "Approvals"),
      f1: false,
      menu: [{
        id: MenuId.ChatInputSecondary,
        group: "navigation",
        order: 12,
        when: ChatContextKeyExprs.isAgentHostSession
      }]
    });
  }
  async run() {
  }
});
const RUNNING_SESSION_MODE_PICKER_ID = "sessions.agentHost.runningSessionModePicker";
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: RUNNING_SESSION_MODE_PICKER_ID,
      title: localize2("agentHostRunningSessionModePicker", "Agent Mode"),
      f1: false,
      menu: [{
        id: MenuId.ChatInputSecondary,
        group: "navigation",
        order: 9,
        // Hide the agent mode picker while a delegation (continue in) target is pending.
        when: ContextKeyExpr.and(ChatContextKeyExprs.isAgentHostSession, ChatContextKeys.hasPendingDelegationTarget.negate())
      }]
    });
  }
  async run(accessor) {
    showActiveSessionModePicker(accessor);
  }
});
registerWorkbenchContribution2(AgentHostSessionConfigPickerContribution.ID, AgentHostSessionConfigPickerContribution, WorkbenchPhase.AfterRestored);
export {
  AgentHostSessionConfigPicker,
  PickerActionViewItem,
  getConfigIcon
};
