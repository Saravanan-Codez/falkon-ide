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
import * as dom from "../../../../../../base/browser/dom.js";
import { renderLabelWithIcons } from "../../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { Emitter } from "../../../../../../base/common/event.js";
import { MutableDisposable } from "../../../../../../base/common/lifecycle.js";
import { isWindows } from "../../../../../../base/common/platform.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { localize } from "../../../../../../nls.js";
import { IActionWidgetService } from "../../../../../../platform/actionWidget/browser/actionWidget.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IKeybindingService } from "../../../../../../platform/keybinding/common/keybinding.js";
import { ITelemetryService } from "../../../../../../platform/telemetry/common/telemetry.js";
import { ChatConfiguration, ChatPermissionLevel } from "../../../common/constants.js";
import { SessionType } from "../../../common/chatSessionsService.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IDialogService } from "../../../../../../platform/dialogs/common/dialogs.js";
import { IHoverService } from "../../../../../../platform/hover/browser/hover.js";
import { ChatInputPickerActionViewItem } from "./chatInputPickerActionItem.js";
import { IOpenerService } from "../../../../../../platform/opener/common/opener.js";
import { URI } from "../../../../../../base/common/uri.js";
import { IStorageService } from "../../../../../../platform/storage/common/storage.js";
import { maybeConfirmElevatedPermissionLevel } from "../../../common/chatPermissionWarnings.js";
import { AgentSandboxEnabledValue, AgentSandboxSettingId, isAgentSandboxEnabledValue } from "../../../../../../platform/sandbox/common/settings.js";
const DEFAULT_PERMISSION_LEVELS = [
  ChatPermissionLevel.Default,
  ChatPermissionLevel.AutoApprove,
  ChatPermissionLevel.Autopilot
];
function getPermissionLevelMeta(level) {
  switch (level) {
    case ChatPermissionLevel.Assisted:
      return {
        id: "chat.permissions.assisted",
        label: localize("permissions.assisted", "Assisted permissions"),
        shortLabel: localize("permissions.assisted.label", "Assisted permissions"),
        detail: localize("permissions.assisted.subtext", "Evaluates risk before running tools"),
        icon: ThemeIcon.fromId(Codicon.sparkle.id),
        description: localize("permissions.assisted.description", "An LLM judge evaluates each tool call. Tools it doesn't approve require your approval."),
        elevated: true
      };
    case ChatPermissionLevel.AutoApprove:
      return {
        id: "chat.permissions.autoApprove",
        label: localize("permissions.autoApprove", "Allow all"),
        shortLabel: localize("permissions.autoApprove.label", "Allow all"),
        detail: localize("permissions.autoApprove.subtext", "Runs tool calls without asking"),
        icon: ThemeIcon.fromId(Codicon.warning.id),
        description: localize("permissions.autoApprove.description", "Auto-approve all tool calls and retry on errors"),
        elevated: true
      };
    case ChatPermissionLevel.Autopilot:
      return {
        id: "chat.permissions.autopilot",
        label: localize("permissions.autopilot", "Autopilot (Preview)"),
        shortLabel: localize("permissions.autopilot.label", "Autopilot (Preview)"),
        detail: localize("permissions.autopilot.subtext", "Works autonomously within permissions"),
        icon: ThemeIcon.fromId(Codicon.rocket.id),
        description: localize("permissions.autopilot.description", "Auto-approve all tool calls and continue until the task is done. Autopilot may increase costs."),
        elevated: true
      };
    case ChatPermissionLevel.Default:
    default:
      return {
        id: "chat.permissions.default",
        label: localize("permissions.default", "Default permissions"),
        shortLabel: localize("permissions.default.label", "Default permissions"),
        detail: localize("permissions.default.subtext", "Asks when approval settings don't apply"),
        icon: ThemeIcon.fromId(Codicon.shield.id),
        description: localize("permissions.default.description", "Use configured approval settings"),
        elevated: false
      };
  }
}
function sanitizeIdSegment(value) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}
function getSandboxEnabledSettingId() {
  return isWindows ? AgentSandboxSettingId.AgentSandboxWindowsEnabled : AgentSandboxSettingId.AgentSandboxEnabled;
}
let PermissionPickerActionItem = class extends ChatInputPickerActionViewItem {
  constructor(action, delegate, pickerOptions, actionWidgetService, keybindingService, contextKeyService, telemetryService, configurationService, dialogService, openerService, storageService, hoverService) {
    const isAutoApprovePolicyRestricted = () => configurationService.inspect(ChatConfiguration.GlobalAutoApprove).policyValue === false;
    const actionProvider = {
      getActions: () => {
        const ext = delegate.getExtensionPermissions?.();
        if (ext && ext.items.length > 0) {
          const sessionTypeSeg = sanitizeIdSegment(ext.sessionType);
          const groupSeg = sanitizeIdSegment(ext.groupId);
          return ext.items.map((item) => ({
            ...action,
            id: `chat.permissions.ext.${sessionTypeSeg}.${groupSeg}.${sanitizeIdSegment(item.id)}`,
            label: item.name,
            detail: item.description,
            icon: item.icon,
            checked: ext.selectedId === item.id,
            enabled: !item.locked,
            tooltip: item.locked ? localize("permissions.ext.locked", "This option is locked") : "",
            hover: item.description ? { content: item.description } : void 0,
            run: async () => {
              delegate.setExtensionPermission?.(ext.groupId, item);
              if (this.element) {
                this.renderLabel(this.element);
              }
            }
          }));
        }
        const currentLevel = delegate.currentPermissionLevel.get();
        const policyRestricted = isAutoApprovePolicyRestricted();
        const sandboxToggleEnabled = this.isSandboxToggleAvailable();
        const setSandboxEnabled = async (enableSandbox) => {
          const target = enableSandbox ? AgentSandboxEnabledValue.On : AgentSandboxEnabledValue.Off;
          if (this.isSandboxingEnabled() !== enableSandbox) {
            await configurationService.updateValue(getSandboxEnabledSettingId(), target);
          }
        };
        const levels = delegate.availableLevels ?? DEFAULT_PERMISSION_LEVELS;
        const actions = levels.map((level) => {
          const meta = getPermissionLevelMeta(level);
          const disabledByPolicy = meta.elevated && policyRestricted;
          const hover = disabledByPolicy ? localize("permissions.policyDescription", "Disabled by enterprise policy") : delegate.getPermissionLevelHover?.(level, meta) ?? meta.description;
          const inlineToggle = sandboxToggleEnabled && level === ChatPermissionLevel.Default ? {
            label: localize("permissions.default.sandbox.toggle", "Sandboxing for terminal"),
            title: localize("permissions.default.sandbox.toggle.title", "Run terminal commands inside a sandbox that restricts file system and network access"),
            checked: this.isSandboxingEnabled(),
            onChange: (checked) => {
              void setSandboxEnabled(checked);
            }
          } : void 0;
          return {
            ...action,
            id: meta.id,
            label: meta.label,
            detail: meta.detail,
            icon: meta.icon,
            checked: currentLevel === level,
            enabled: !disabledByPolicy,
            inlineToggle,
            tooltip: disabledByPolicy ? localize("permissions.policyDisabled", "Disabled by enterprise policy") : "",
            hover: {
              content: hover
            },
            run: async () => {
              if (meta.elevated && !await maybeConfirmElevatedPermissionLevel(level, this.dialogService, storageService, {
                defaultSettingKey: delegate.defaultSettingKey,
                levelLabel: meta.label
              })) {
                return;
              }
              delegate.setPermissionLevel(level);
              if (this.element) {
                this.renderLabel(this.element);
              }
            }
          };
        });
        return actions;
      }
    };
    super(action, {
      actionProvider,
      actionBarActions: [{
        id: "chat.permissions.learnMore",
        label: localize("permissions.learnMore", "Learn more about permissions"),
        tooltip: localize("permissions.learnMore", "Learn more about permissions"),
        class: void 0,
        enabled: true,
        run: async () => {
          const ext = delegate.getExtensionPermissions?.();
          const url = ext?.sessionType === SessionType.AgentHostClaude ? "https://code.claude.com/docs/en/permission-modes#available-modes" : "https://aka.ms/vscode/docs/permissions";
          await openerService.open(URI.parse(url));
        }
      }],
      reporter: { id: "ChatPermissionPicker", name: "ChatPermissionPicker", includeOptions: true },
      listOptions: { minWidth: 255, detailItemHeight: 44, ...pickerOptions.listOptions }
    }, pickerOptions, actionWidgetService, keybindingService, contextKeyService, telemetryService);
    this.delegate = delegate;
    this.configurationService = configurationService;
    this.dialogService = dialogService;
    this.hoverService = hoverService;
    this._onDidDispose = this._register(new Emitter());
    this.onDidDispose = this._onDidDispose.event;
    this._currentTooltip = "";
    this._hover = this._register(new MutableDisposable());
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if ((e.affectsConfiguration(getSandboxEnabledSettingId()) || e.affectsConfiguration(ChatConfiguration.PermissionsSandboxToggleEnabled)) && this.element) {
        this.renderLabel(this.element);
      }
    }));
  }
  isSandboxingEnabled() {
    const value = this.configurationService.getValue(getSandboxEnabledSettingId());
    return isAgentSandboxEnabledValue(value);
  }
  isSandboxToggleSettingEnabled() {
    return this.configurationService.getValue(ChatConfiguration.PermissionsSandboxToggleEnabled) === true;
  }
  /**
   * Whether the sandbox toggle should surface for the current harness: the
   * experimental setting must be on and the delegate must opt in (only the
   * local harness does).
   */
  isSandboxToggleAvailable() {
    return this.isSandboxToggleSettingEnabled() && this.delegate.isSandboxToggleApplicable?.() === true;
  }
  renderLabel(element) {
    this.setAriaLabelAttributes(element);
    const ext = this.delegate.getExtensionPermissions?.();
    let icon;
    let label;
    let tooltip;
    const level = this.delegate.currentPermissionLevel.get();
    if (ext && ext.items.length > 0) {
      const selected = ext.items.find((i) => i.id === ext.selectedId) ?? ext.items.find((i) => i.default) ?? ext.items[0];
      icon = selected.icon ?? Codicon.lock;
      label = selected.name;
      tooltip = selected.description ?? selected.name;
    } else {
      const meta = getPermissionLevelMeta(level);
      icon = meta.icon;
      label = meta.shortLabel;
      tooltip = this.delegate.getPermissionLevelHover?.(level, meta) ?? meta.description;
      if (level === ChatPermissionLevel.Default && this.isSandboxToggleAvailable() && this.isSandboxingEnabled()) {
        label = localize("permissions.defaultSandboxed.label", "Default permissions (sandboxed)");
      }
    }
    const labelElements = [];
    labelElements.push(...renderLabelWithIcons(`$(${icon.id})`));
    labelElements.push(dom.$("span.chat-input-picker-label", void 0, label));
    dom.reset(element, ...labelElements);
    element.classList.toggle("warning", !ext && (level === ChatPermissionLevel.Autopilot || level === ChatPermissionLevel.Assisted));
    element.classList.toggle("info", !ext && level === ChatPermissionLevel.AutoApprove);
    this._currentTooltip = tooltip;
    element.setAttribute("aria-label", !ext && this.delegate.getPermissionLevelHover ? localize("permissions.ariaLabelWithDescription", "Permission picker, {0}, {1}", label, tooltip) : localize("permissions.ariaLabel", "Permission picker, {0}", label));
    if (this._hoverElement !== element) {
      this._hoverElement = element;
      this._hover.value = this.hoverService.setupDelayedHover(element, () => ({ content: this._currentTooltip }));
    }
    return null;
  }
  refresh() {
    if (this.element) {
      this.renderLabel(this.element);
    }
  }
  dispose() {
    if (this._store.isDisposed) {
      return;
    }
    this._onDidDispose.fire();
    super.dispose();
  }
};
PermissionPickerActionItem = __decorateClass([
  __decorateParam(3, IActionWidgetService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, ITelemetryService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IDialogService),
  __decorateParam(9, IOpenerService),
  __decorateParam(10, IStorageService),
  __decorateParam(11, IHoverService)
], PermissionPickerActionItem);
export {
  PermissionPickerActionItem
};
