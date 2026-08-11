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
import "./media/agentHostChatInputPicker.css";
import * as dom from "../../../../../../base/browser/dom.js";
import { Gesture, EventType as TouchEventType } from "../../../../../../base/browser/touch.js";
import { renderIcon } from "../../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { BaseActionViewItem } from "../../../../../../base/browser/ui/actionbar/actionViewItems.js";
import { Delayer } from "../../../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../../../base/common/cancellation.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../../../base/common/lifecycle.js";
import { URI } from "../../../../../../base/common/uri.js";
import { localize } from "../../../../../../nls.js";
import { ActionListItemKind } from "../../../../../../platform/actionWidget/browser/actionList.js";
import { IActionWidgetService } from "../../../../../../platform/actionWidget/browser/actionWidget.js";
import { getCodexApprovalsPickerListOptions } from "../../../../../../platform/agentHost/browser/codexApprovalsPicker.js";
import { IAgentHostService } from "../../../../../../platform/agentHost/common/agentService.js";
import { KNOWN_AUTO_APPROVE_VALUES, SessionConfigKey } from "../../../../../../platform/agentHost/common/sessionConfigKeys.js";
import { ClaudeSessionConfigKey } from "../../../../../../platform/agentHost/common/claudeSessionConfigKeys.js";
import { CodexSessionConfigKey } from "../../../../../../platform/agentHost/common/codexSessionConfigKeys.js";
import { ActionType } from "../../../../../../platform/agentHost/common/state/protocol/actions.js";
import { StateComponents } from "../../../../../../platform/agentHost/common/state/sessionState.js";
import { IHoverService } from "../../../../../../platform/hover/browser/hover.js";
import { IOpenerService } from "../../../../../../platform/opener/common/opener.js";
import { IDialogService } from "../../../../../../platform/dialogs/common/dialogs.js";
import { IStorageService } from "../../../../../../platform/storage/common/storage.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IWorkspaceContextService } from "../../../../../../platform/workspace/common/workspace.js";
import { ChatConfiguration, ChatPermissionLevel, isChatPermissionLevel } from "../../../common/constants.js";
import { isAssistedPermissionsEnabled, isAutoApprovePolicyRestricted, isAutoApproveValuePolicyRestricted, isPermissionLevelVisible, normalizeSessionConfigValue } from "../../../common/agentHostConfigPolicy.js";
import { maybeConfirmElevatedPermissionLevel } from "../../../common/chatPermissionWarnings.js";
import { isUntitledChatSession } from "../../../common/model/chatUri.js";
import { withChatInputPickerMotion } from "../../widget/input/chatInputPickerActionItem.js";
import { IAgentHostSessionWorkingDirectoryResolver } from "./agentHostSessionWorkingDirectoryResolver.js";
import { IAgentHostNewSessionFolderService } from "./agentHostNewSessionFolderService.js";
import { IAgentHostUntitledProvisionalSessionService } from "./agentHostUntitledProvisionalSessionService.js";
import { toAgentHostBackendSessionUri } from "./agentHostSessionUri.js";
const FILTER_THRESHOLD = 10;
const LEARN_MORE_VALUE = "__agentHostChatInputPicker.learnMore__";
const PERMISSIONS_LEARN_MORE_URL = "https://aka.ms/vscode/docs/permissions";
const CODEX_APPROVALS_LEARN_MORE_URL = "https://developers.openai.com/codex/concepts/sandboxing#how-you-control-it";
function getConfigIcon(property, value) {
  if (property === SessionConfigKey.Mode) {
    switch (value) {
      case "plan":
        return Codicon.checklist;
      case "autopilot":
        return Codicon.rocket;
      case "interactive":
        return Codicon.comment;
    }
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
  if (property === ClaudeSessionConfigKey.PermissionMode && typeof value === "string") {
    switch (value) {
      case "default":
        return Codicon.shield;
      case "acceptEdits":
        return Codicon.edit;
      case "plan":
        return Codicon.lightbulb;
      case "auto":
        return Codicon.sparkle;
      case "bypassPermissions":
        return Codicon.warning;
    }
  }
  if (property === CodexSessionConfigKey.PermissionsPreset && typeof value === "string") {
    switch (value) {
      case "default":
        return Codicon.shield;
      case "auto-review":
        return Codicon.sparkle;
      case "full-access":
        return Codicon.warning;
    }
  }
  return void 0;
}
function toActionItems(property, items, currentValue, policyRestricted = false) {
  return items.map((item) => {
    const disabled = property === SessionConfigKey.AutoApprove && isAutoApproveValuePolicyRestricted(item.value, policyRestricted);
    const hover = getConfigPickerItemHover(property, item, disabled);
    return {
      kind: ActionListItemKind.Action,
      label: item.label,
      detail: disabled ? hover : item.description,
      group: { title: "", icon: getConfigIcon(property, item.value) },
      disabled,
      ...hover ? { hover: { content: hover } } : {},
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
function getAutoApproveHover(value, fallback) {
  switch (value) {
    case ChatPermissionLevel.Default:
      return localize("agentHostChatInputPicker.defaultApprovalsHover", "Copilot asks before running tools unless your configured settings allow the tool.");
    case ChatPermissionLevel.Assisted:
      return localize("agentHostChatInputPicker.assistedApprovalsHover", "An LLM judge evaluates each tool call. Tools it doesn't approve require your approval.");
    case ChatPermissionLevel.AutoApprove:
      return localize("agentHostChatInputPicker.autoApproveHover", "Copilot runs all tools without asking for approval.");
    case ChatPermissionLevel.Autopilot:
      return localize("agentHostChatInputPicker.autopilotApprovalsHover", "Copilot runs tools without asking for approval and continues until the task is done.");
  }
  return fallback ?? localize("agentHostChatInputPicker.approvalsHover", "Controls whether the agent asks before running tools in this session.");
}
function getEnumValueDescription(schema, value) {
  if (typeof value !== "string") {
    return void 0;
  }
  const index = schema.enum?.indexOf(value) ?? -1;
  return index >= 0 ? schema.enumDescriptions?.[index] : void 0;
}
function getConfigPickerTriggerHover(property, schema, value, isReadOnly) {
  if (property === CodexSessionConfigKey.PermissionsPreset) {
    return getEnumValueDescription(schema, value) ?? schema.description ?? schema.title;
  }
  if (property !== SessionConfigKey.AutoApprove) {
    return schema.description ?? schema.title;
  }
  const hover = getAutoApproveHover(value, getEnumValueDescription(schema, value));
  if (isReadOnly) {
    return localize("agentHostChatInputPicker.approvalsLevelHoverReadOnly", "{0} Read-only.", hover);
  }
  return hover;
}
function getConfigPickerItemHover(property, item, disabled) {
  if (disabled) {
    return localize("agentHostChatInputPicker.policyDisabledHover", "Disabled by your organization. Contact your administrator.");
  }
  if (property === SessionConfigKey.AutoApprove) {
    return getAutoApproveHover(item.value, item.description);
  }
  return void 0;
}
function getPermissionsLearnMoreUrl(property) {
  if (property === CodexSessionConfigKey.PermissionsPreset) {
    return CODEX_APPROVALS_LEARN_MORE_URL;
  }
  if (property === ClaudeSessionConfigKey.PermissionMode || property === SessionConfigKey.AutoApprove) {
    return PERMISSIONS_LEARN_MORE_URL;
  }
  return void 0;
}
function getConfigPickerListOptions(property) {
  switch (property) {
    case SessionConfigKey.Mode:
      return { minWidth: 260 };
    case SessionConfigKey.AutoApprove:
      return { minWidth: 255 };
    case CodexSessionConfigKey.PermissionsPreset:
      return getCodexApprovalsPickerListOptions();
    default:
      return void 0;
  }
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
function isWellKnownAutoApproveSchema(schema) {
  if (schema.type !== "string" || !Array.isArray(schema.enum) || schema.enum.length === 0) {
    return false;
  }
  if (!schema.enum.includes("default")) {
    return false;
  }
  return schema.enum.every((value) => typeof value === "string" && KNOWN_AUTO_APPROVE_VALUES.has(value));
}
const WELL_KNOWN_PICKER_PROPERTIES = /* @__PURE__ */ new Set([
  SessionConfigKey.Mode,
  SessionConfigKey.AutoApprove,
  SessionConfigKey.Isolation,
  SessionConfigKey.Branch,
  SessionConfigKey.Permissions,
  SessionConfigKey.WorktreeBranchPrefix,
  SessionConfigKey.WorktreeBranchTrack,
  SessionConfigKey.WorktreeIncludeFiles,
  ClaudeSessionConfigKey.PermissionMode,
  CodexSessionConfigKey.PermissionsPreset
]);
function isClaimedByDedicatedPicker(property, schema) {
  if (property === SessionConfigKey.AutoApprove) {
    return isWellKnownAutoApproveSchema(schema);
  }
  return WELL_KNOWN_PICKER_PROPERTIES.has(property);
}
function resolveConfigChipValue(isUntitled, serverValue, overlayValue, schemaDefault) {
  const preferred = isUntitled ? overlayValue ?? serverValue : serverValue ?? overlayValue;
  return preferred ?? schemaDefault;
}
let AgentHostChatInputPicker = class extends Disposable {
  constructor(_widget, _property, _agentHostService, _actionWidgetService, _hoverService, _openerService, _workingDirectoryResolver, _workspaceContextService, _provisional, _configurationService, _newSessionFolderService, _dialogService, _storageService) {
    super();
    this._widget = _widget;
    this._property = _property;
    this._agentHostService = _agentHostService;
    this._actionWidgetService = _actionWidgetService;
    this._hoverService = _hoverService;
    this._openerService = _openerService;
    this._workingDirectoryResolver = _workingDirectoryResolver;
    this._workspaceContextService = _workspaceContextService;
    this._provisional = _provisional;
    this._configurationService = _configurationService;
    this._newSessionFolderService = _newSessionFolderService;
    this._dialogService = _dialogService;
    this._storageService = _storageService;
    this._initialResolveCts = this._registerInitialResolveCts();
    this._renderDisposables = this._register(new DisposableStore());
    this._filterDelayer = this._register(new Delayer(200));
    this._subRef = this._register(new MutableDisposable());
    this._register(this._widget.onDidChangeViewModel(() => {
      this._reattach();
    }));
    this._register(this._provisional.onDidChange((sessionResource) => {
      const current = this._widget.viewModel?.sessionResource;
      if (current && current.toString() === sessionResource.toString()) {
        this._reattach();
      }
    }));
    this._reattach();
  }
  _registerInitialResolveCts() {
    const cts = new MutableDisposable();
    this._register(toDisposable(() => {
      this._container = void 0;
      this._cancelInitialResolve();
    }));
    return this._register(cts);
  }
  render(container) {
    this._container = container;
    container.classList.add("agent-host-chat-input-picker-host");
    container.classList.add(`agent-host-chat-input-picker-host-${this._property}`);
    this._renderChip();
  }
  _reattach() {
    const sessionResource = this._widget.viewModel?.sessionResource;
    const provisionalBackend = sessionResource ? this._provisional.get(sessionResource) : void 0;
    const backendSession = provisionalBackend ?? (sessionResource ? toAgentHostBackendSessionUri(sessionResource) : void 0);
    if (!sessionResource || !backendSession) {
      this._subRef.clear();
      this._initialResolved = void 0;
      this._cancelInitialResolve();
      this._renderChip();
      return;
    }
    if (isUntitledChatSession(sessionResource) && !provisionalBackend) {
      this._subRef.clear();
      if (!this._initialResolved || this._initialResolved.sessionResource.toString() !== sessionResource.toString()) {
        this._initialResolved = void 0;
        void this._refreshInitialResolved(sessionResource, backendSession);
      }
      void this._provisional.getOrCreate(
        sessionResource,
        backendSession.scheme,
        this._readWorkingDirectory()
      );
      this._renderChip();
      return;
    }
    this._initialResolved = void 0;
    this._cancelInitialResolve();
    const ref = this._agentHostService.getSubscription(StateComponents.Session, backendSession, "AgentHostChatInputPicker");
    const sub = ref.object;
    const listener = sub.onDidChange(() => this._renderChip());
    this._subRef.value = {
      sub,
      backendSession,
      dispose: () => {
        listener.dispose();
        ref.dispose();
      }
    };
    this._renderChip();
  }
  _cancelInitialResolve() {
    this._initialResolveCts.value?.cancel();
    this._initialResolveCts.clear();
  }
  async _refreshInitialResolved(sessionResource, backendSession) {
    this._initialResolveCts.value?.cancel();
    const cts = new CancellationTokenSource();
    this._initialResolveCts.value = cts;
    try {
      const result = await this._agentHostService.resolveSessionConfig({
        provider: backendSession.scheme,
        workingDirectory: this._readWorkingDirectory()
      });
      if (cts.token.isCancellationRequested || this._widget.viewModel?.sessionResource?.toString() !== sessionResource.toString()) {
        return;
      }
      this._initialResolved = { sessionResource, result };
      this._renderChip();
    } catch {
    }
  }
  _renderChip() {
    if (!this._container || this._renderDisposables.isDisposed) {
      return;
    }
    this._renderDisposables.clear();
    dom.clearNode(this._container);
    const ctx = this._readContext();
    const sessionResource = this._widget.viewModel?.sessionResource;
    const isStartedSession = !!sessionResource && !isUntitledChatSession(sessionResource);
    if (!ctx || isStartedSession && ctx.schema.sessionMutable === false) {
      this._container.style.display = "none";
      this._container.classList.add("agent-host-chat-input-picker-host-hidden");
      return;
    }
    if (this._property === SessionConfigKey.AutoApprove && !isWellKnownAutoApproveSchema(ctx.schema)) {
      this._container.style.display = "none";
      this._container.classList.add("agent-host-chat-input-picker-host-hidden");
      return;
    }
    this._container.style.display = "";
    this._container.classList.remove("agent-host-chat-input-picker-host-hidden");
    const slot = dom.append(this._container, dom.$(".agent-host-chat-input-picker-slot"));
    this._renderDisposables.add({ dispose: () => slot.remove() });
    const isReadOnly = !!ctx.schema.readOnly || isStartedSession && ctx.schema.sessionMutable === false;
    const trigger = renderPickerTrigger(slot, isReadOnly, this._renderDisposables, () => this._showPicker(trigger));
    const tooltip = getConfigPickerTriggerHover(this._property, ctx.schema, ctx.value, isReadOnly);
    if (tooltip) {
      this._renderDisposables.add(this._hoverService.setupDelayedHover(trigger, { content: tooltip }));
    }
    this._renderTrigger(trigger, ctx.schema, ctx.value, isReadOnly);
  }
  _renderTrigger(trigger, schema, value, isReadOnly) {
    dom.clearNode(trigger);
    const icon = getConfigIcon(this._property, value);
    if (icon) {
      dom.append(trigger, renderIcon(icon));
    }
    if (this._property === SessionConfigKey.AutoApprove) {
      trigger.classList.toggle("warning", value === "autopilot" || value === "assisted");
      trigger.classList.toggle("info", value === "autoApprove");
    }
    const label = this._labelFor(schema, value);
    const labelSpan = dom.append(trigger, dom.$("span.agent-host-chat-input-picker-label"));
    labelSpan.textContent = label;
    trigger.setAttribute("aria-label", isReadOnly ? localize("agentHostChatInputPicker.triggerAriaReadOnly", "{0}: {1}, Read-Only", schema.title, label) : localize("agentHostChatInputPicker.triggerAria", "{0}: {1}", schema.title, label));
  }
  _labelFor(schema, value) {
    if (schema.type === "boolean") {
      return value === true ? localize("agentHostChatInputPicker.boolean.onLabel", "On") : localize("agentHostChatInputPicker.boolean.offLabel", "Off");
    }
    if (typeof value === "string") {
      const index = schema.enum?.indexOf(value) ?? -1;
      return index >= 0 ? schema.enumLabels?.[index] ?? value : value;
    }
    return schema.title;
  }
  _readContext() {
    const sessionResource = this._widget.viewModel?.sessionResource;
    if (!sessionResource) {
      return void 0;
    }
    if (this._subRef.value) {
      const state = this._subRef.value.sub.value;
      if (!state || state instanceof Error) {
        return void 0;
      }
      const overlay = this._provisional.getResolvedConfig(sessionResource);
      const schemaSource = overlay?.schema ?? state.config?.schema;
      const schema = schemaSource?.properties[this._property];
      if (!schema) {
        return void 0;
      }
      const serverValue = state.config?.values?.[this._property];
      const overlayValue = overlay?.values?.[this._property];
      const value = resolveConfigChipValue(isUntitledChatSession(sessionResource), serverValue, overlayValue, schema.default);
      return { backendSession: this._subRef.value.backendSession, schema, value };
    }
    if (this._initialResolved && this._initialResolved.sessionResource.toString() === sessionResource.toString()) {
      const schema = this._initialResolved.result.schema.properties[this._property];
      if (!schema) {
        return void 0;
      }
      const backendSession = toAgentHostBackendSessionUri(sessionResource);
      if (!backendSession) {
        return void 0;
      }
      const value = this._initialResolved.result.values?.[this._property] ?? schema.default;
      return { backendSession, schema, value };
    }
    return void 0;
  }
  async _showPicker(trigger) {
    if (this._actionWidgetService.isVisible) {
      return;
    }
    const ctx = this._readContext();
    if (!ctx || ctx.schema.readOnly) {
      return;
    }
    const items = await this._getItems(ctx.schema);
    if (items.length === 0) {
      return;
    }
    const currentValue = ctx.value;
    const policyRestricted = isAutoApprovePolicyRestricted(this._configurationService);
    const actionItems = toActionItems(this._property, items, currentValue, policyRestricted);
    const permissionsLearnMoreUrl = getPermissionsLearnMoreUrl(this._property);
    if (permissionsLearnMoreUrl) {
      const learnMoreLabel = localize("agentHostChatInputPicker.learnMorePermissions", "Learn more about permissions");
      actionItems.push({
        kind: ActionListItemKind.Separator,
        label: ""
      });
      actionItems.push({
        kind: ActionListItemKind.Action,
        label: learnMoreLabel,
        group: { title: "", icon: Codicon.blank },
        item: { value: LEARN_MORE_VALUE, label: learnMoreLabel }
      });
    }
    const delegate = {
      onSelect: (item) => {
        this._actionWidgetService.hide();
        if (item.value === LEARN_MORE_VALUE) {
          if (permissionsLearnMoreUrl) {
            void this._openerService.open(URI.parse(permissionsLearnMoreUrl));
          }
          return;
        }
        void this._confirmAndSetValue(ctx.backendSession, item);
      },
      onFilter: ctx.schema.enumDynamic ? (query) => this._filterDelayer.trigger(async () => {
        const refreshed = this._readContext();
        if (!refreshed) {
          return [];
        }
        return toActionItems(this._property, await this._getItems(refreshed.schema, query), refreshed.value, isAutoApprovePolicyRestricted(this._configurationService));
      }) : void 0,
      onHide: () => trigger.focus()
    };
    this._actionWidgetService.show(
      `agentHostChatInputPicker.${this._property}`,
      false,
      actionItems,
      delegate,
      trigger,
      void 0,
      [],
      {
        getAriaLabel: (item) => item.label ?? "",
        getWidgetAriaLabel: () => localize("agentHostChatInputPicker.ariaLabel", "{0} Picker", ctx.schema.title)
      },
      withChatInputPickerMotion({
        ...getConfigPickerListOptions(this._property),
        ...actionItems.length > FILTER_THRESHOLD || ctx.schema.enumDynamic ? { showFilter: true, filterPlaceholder: localize("agentHostChatInputPicker.filter", "Filter...") } : {}
      })
    );
  }
  async _getItems(schema, query) {
    if (schema.type === "boolean") {
      return [
        { value: "true", label: localize("agentHostChatInputPicker.boolean.true", "On") },
        { value: "false", label: localize("agentHostChatInputPicker.boolean.false", "Off") }
      ];
    }
    const sessionResource = this._widget.viewModel?.sessionResource;
    const backendSession = this._subRef.value?.backendSession ?? (sessionResource ? toAgentHostBackendSessionUri(sessionResource) : void 0);
    if (schema.enumDynamic && backendSession) {
      try {
        const result = await this._agentHostService.sessionConfigCompletions({
          provider: backendSession.scheme,
          property: this._property,
          query,
          workingDirectory: this._readWorkingDirectory(),
          config: this._readCurrentValues()
        });
        return this._filterAutoApproveItems(result.items.map((item) => this._fromCompletion(item)));
      } catch {
      }
    }
    return this._filterAutoApproveItems((schema.enum ?? []).map((value, index) => ({
      value: String(value),
      label: schema.enumLabels?.[index] ?? String(value),
      description: schema.enumDescriptions?.[index]
    })));
  }
  _filterAutoApproveItems(items) {
    if (this._property !== SessionConfigKey.AutoApprove) {
      return items;
    }
    const assistedPermissionsEnabled = isAssistedPermissionsEnabled(this._configurationService);
    return items.filter((item) => isPermissionLevelVisible(item.value, assistedPermissionsEnabled));
  }
  _fromCompletion(item) {
    return { value: item.value, label: item.label, description: item.description };
  }
  _readWorkingDirectory() {
    const state = this._subRef.value?.sub.value;
    if (state && !(state instanceof Error)) {
      const cwd = state.workingDirectories?.[0];
      return typeof cwd === "string" ? URI.parse(cwd) : cwd;
    }
    const sessionResource = this._widget.viewModel?.sessionResource;
    return (sessionResource && this._newSessionFolderService.getFolder(sessionResource)) ?? (sessionResource && this._workingDirectoryResolver.resolve(sessionResource)) ?? this._newSessionFolderService.getDefaultFolder() ?? this._workspaceContextService.getWorkspace().folders[0]?.uri;
  }
  _readCurrentValues() {
    const sessionResource = this._widget.viewModel?.sessionResource;
    const overlay = sessionResource ? this._provisional.getResolvedConfig(sessionResource) : void 0;
    const state = this._subRef.value?.sub.value;
    if (state && !(state instanceof Error)) {
      return { ...state.config?.values ?? {}, ...overlay?.values ?? {} };
    }
    return overlay?.values ?? this._initialResolved?.result.values;
  }
  /**
   * Surfaces the shared elevated-level warning before applying an approval
   * pick. Unknown non-default values fall back to the Bypass warning.
   */
  async _confirmAndSetValue(backendSession, item) {
    const value = item.value;
    if (this._property === SessionConfigKey.AutoApprove && !isPermissionLevelVisible(value, isAssistedPermissionsEnabled(this._configurationService))) {
      return;
    }
    if (this._property === SessionConfigKey.AutoApprove) {
      const levelToConfirm = isChatPermissionLevel(value) ? value : value !== ChatPermissionLevel.Default ? ChatPermissionLevel.AutoApprove : void 0;
      if (levelToConfirm) {
        const confirmed = await maybeConfirmElevatedPermissionLevel(levelToConfirm, this._dialogService, this._storageService, {
          defaultSettingKey: ChatConfiguration.DefaultConfiguration,
          levelLabel: item.label
        });
        if (!confirmed) {
          return;
        }
      }
    }
    await this._setValue(backendSession, value);
  }
  async _setValue(backendSession, value) {
    const sessionResource = this._widget.viewModel?.sessionResource;
    if (!sessionResource) {
      return;
    }
    const ctx = this._readContext();
    const normalizedValue = ctx?.schema.type === "boolean" ? value === "true" : normalizeSessionConfigValue(this._property, value, isAutoApprovePolicyRestricted(this._configurationService));
    const partial = { [this._property]: normalizedValue };
    const nextConfig = { ...this._readCurrentValues() ?? {}, ...partial };
    if (isUntitledChatSession(sessionResource)) {
      const provider = backendSession.scheme;
      const created = await this._provisional.applyConfigChange(
        sessionResource,
        provider,
        this._readWorkingDirectory(),
        partial
      );
      if (!created) {
        return;
      }
      if (!this._subRef.value || this._subRef.value.backendSession.toString() !== created.toString()) {
        this._reattach();
      }
      return;
    }
    this._agentHostService.dispatch(backendSession.toString(), {
      type: ActionType.SessionConfigChanged,
      config: partial
    });
    void this._provisional.refreshResolvedConfig(
      sessionResource,
      backendSession.scheme,
      this._readWorkingDirectory(),
      nextConfig
    );
  }
};
AgentHostChatInputPicker = __decorateClass([
  __decorateParam(2, IAgentHostService),
  __decorateParam(3, IActionWidgetService),
  __decorateParam(4, IHoverService),
  __decorateParam(5, IOpenerService),
  __decorateParam(6, IAgentHostSessionWorkingDirectoryResolver),
  __decorateParam(7, IWorkspaceContextService),
  __decorateParam(8, IAgentHostUntitledProvisionalSessionService),
  __decorateParam(9, IConfigurationService),
  __decorateParam(10, IAgentHostNewSessionFolderService),
  __decorateParam(11, IDialogService),
  __decorateParam(12, IStorageService)
], AgentHostChatInputPicker);
class AgentHostChatInputPickerActionViewItem extends BaseActionViewItem {
  constructor(action, _picker) {
    super(void 0, action);
    this._picker = _picker;
    this._register(this._picker);
  }
  render(container) {
    this._picker.render(container);
  }
}
export {
  AgentHostChatInputPicker,
  AgentHostChatInputPickerActionViewItem,
  WELL_KNOWN_PICKER_PROPERTIES,
  getConfigPickerItemHover,
  getConfigPickerListOptions,
  getConfigPickerTriggerHover,
  isClaimedByDedicatedPicker,
  isWellKnownAutoApproveSchema,
  resolveConfigChipValue
};
