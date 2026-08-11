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
import { renderIcon } from "../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { autorun, derived } from "../../../../../base/common/observable.js";
import { URI } from "../../../../../base/common/uri.js";
import { localize } from "../../../../../nls.js";
import { ActionListItemKind } from "../../../../../platform/actionWidget/browser/actionList.js";
import { IActionWidgetService } from "../../../../../platform/actionWidget/browser/actionWidget.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { IStorageService } from "../../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { maybeConfirmElevatedPermissionLevel } from "../../../../../workbench/contrib/chat/common/chatPermissionWarnings.js";
import { IChatSessionsService } from "../../../../../workbench/contrib/chat/common/chatSessionsService.js";
import { ChatConfiguration, ChatPermissionLevel, isChatPermissionLevel } from "../../../../../workbench/contrib/chat/common/constants.js";
import { reportNewChatPickerClosed } from "../../../chat/browser/newChatPickerTelemetry.js";
import { ISessionsProvidersService } from "../../../../services/sessions/browser/sessionsProvidersService.js";
import { CopilotChatSessionsProvider } from "./copilotChatSessionsProvider.js";
const PERMISSION_LEVEL_OPTION_ID = "permissionLevel";
const DEFAULT_PERMISSION_LEVELS = [
  ChatPermissionLevel.Default,
  ChatPermissionLevel.AutoApprove,
  ChatPermissionLevel.Autopilot
];
function getPermissionLevelMeta(level) {
  switch (level) {
    case ChatPermissionLevel.Assisted:
      return {
        label: localize("permissions.assisted", "Assisted permissions"),
        detail: localize("permissions.assisted.subtext", "Evaluates risk before running tools"),
        icon: Codicon.sparkle,
        hover: localize("permissions.assisted.description", "An LLM judge evaluates each tool call. Tools it doesn't approve require your approval.")
      };
    case ChatPermissionLevel.AutoApprove:
      return {
        label: localize("permissions.autoApprove", "Allow all"),
        detail: localize("permissions.autoApprove.subtext", "Runs tool calls without asking"),
        icon: Codicon.warning
      };
    case ChatPermissionLevel.Autopilot:
      return {
        label: localize("permissions.autopilot", "Autopilot (Preview)"),
        detail: localize("permissions.autopilot.subtext", "Works autonomously within permissions"),
        icon: Codicon.rocket,
        hover: localize("permissions.autopilot.description", "Auto-approve all tool calls and continue until the task is done. Autopilot may increase costs.")
      };
    case ChatPermissionLevel.Default:
    default:
      return {
        label: localize("permissions.default", "Default permissions"),
        detail: localize("permissions.default.subtext", "Asks when approval settings don't apply"),
        icon: Codicon.shield
      };
  }
}
let PermissionPicker = class extends Disposable {
  constructor(_delegate, actionWidgetService, configurationService, dialogService, openerService, storageService, telemetryService, hoverService) {
    super();
    this._delegate = _delegate;
    this.actionWidgetService = actionWidgetService;
    this.configurationService = configurationService;
    this.dialogService = dialogService;
    this.openerService = openerService;
    this.storageService = storageService;
    this.telemetryService = telemetryService;
    this.hoverService = hoverService;
    this._currentLevel = ChatPermissionLevel.Default;
    this._renderDisposables = this._register(new DisposableStore());
  }
  render(container) {
    this._renderDisposables.clear();
    const policyRestricted = this.configurationService.inspect(ChatConfiguration.GlobalAutoApprove).policyValue === false;
    const configuredDefault = this.configurationService.getValue(ChatConfiguration.DefaultPermissionLevel);
    const initialLevel = isChatPermissionLevel(configuredDefault) ? configuredDefault : ChatPermissionLevel.Default;
    this._currentLevel = policyRestricted ? ChatPermissionLevel.Default : initialLevel;
    const slot = dom.append(container, dom.$(".sessions-chat-picker-slot.sessions-chat-permission-picker"));
    this._renderDisposables.add({ dispose: () => slot.remove() });
    const trigger = dom.append(slot, dom.$("a.action-label"));
    trigger.tabIndex = 0;
    trigger.role = "button";
    this._triggerElement = trigger;
    this._updateTriggerLabel(trigger);
    if (this._delegate.getPermissionLevelHover) {
      this._renderDisposables.add(this.hoverService.setupDelayedHover(trigger, () => {
        const meta = this._getPermissionLevelMeta(this._currentLevel);
        return { content: this._getPermissionLevelHover(this._currentLevel, meta) ?? "" };
      }));
    }
    this._renderDisposables.add(Gesture.addTarget(trigger));
    for (const eventType of [dom.EventType.CLICK, TouchEventType.Tap]) {
      this._renderDisposables.add(dom.addDisposableListener(trigger, eventType, (e) => {
        dom.EventHelper.stop(e, true);
        this.showPicker();
      }));
    }
    this._renderDisposables.add(dom.addDisposableListener(trigger, dom.EventType.KEY_DOWN, (e) => {
      if (e.key === "Enter" || e.key === " ") {
        dom.EventHelper.stop(e, true);
        this.showPicker();
      }
    }));
    const currentPermissionLevel = this._delegate.currentPermissionLevel;
    if (currentPermissionLevel) {
      this._renderDisposables.add(autorun((reader) => {
        const level = currentPermissionLevel.read(reader);
        if (level === void 0) {
          return;
        }
        this._currentLevel = level;
        this._updateTriggerLabel(trigger);
      }));
    }
    const isApplicable = this._delegate.isApplicable;
    if (isApplicable) {
      this._renderDisposables.add(autorun((reader) => {
        const visible = isApplicable.read(reader);
        slot.style.display = visible ? "" : "none";
        container.style.display = visible ? "" : "none";
      }));
    }
    const isResolving = this._delegate.isResolving;
    if (isResolving) {
      this._renderDisposables.add(autorun((reader) => {
        const resolving = isResolving.read(reader);
        slot.classList.toggle("resolving", resolving);
        trigger.setAttribute("aria-disabled", resolving ? "true" : "false");
      }));
    }
    return slot;
  }
  showPicker() {
    if (!this._triggerElement || this.actionWidgetService.isVisible || this._isResolving()) {
      return;
    }
    const policyRestricted = this.configurationService.inspect(ChatConfiguration.GlobalAutoApprove).policyValue === false;
    const levels = this._delegate.availableLevels ?? DEFAULT_PERMISSION_LEVELS;
    const items = levels.map((level) => {
      const meta = this._getPermissionLevelMeta(level);
      const disabled = level !== ChatPermissionLevel.Default && policyRestricted;
      const hover = this._delegate.getPermissionLevelHover ? disabled ? localize("permissions.policyDescription", "Disabled by enterprise policy") : this._getPermissionLevelHover(level, meta) : meta.hover;
      return {
        kind: ActionListItemKind.Action,
        group: { kind: ActionListItemKind.Header, title: "", icon: meta.icon },
        item: {
          level,
          label: meta.label,
          icon: meta.icon,
          checked: this._currentLevel === level
        },
        label: meta.label,
        detail: meta.detail,
        ...hover ? { hover: { content: hover } } : {},
        disabled
      };
    });
    items.push({
      kind: ActionListItemKind.Separator,
      label: "",
      disabled: false
    });
    items.push({
      kind: ActionListItemKind.Action,
      group: { kind: ActionListItemKind.Header, title: "", icon: Codicon.blank },
      item: {
        label: localize("permissions.learnMore", "Learn more about permissions"),
        icon: Codicon.blank,
        checked: false
      },
      label: localize("permissions.learnMore", "Learn more about permissions"),
      hideIcon: false,
      disabled: false
    });
    const triggerElement = this._triggerElement;
    const delegate = {
      onSelect: async (item) => {
        this.actionWidgetService.hide();
        if (item.level) {
          await this._selectLevel(item.level);
        } else {
          await this.openerService.open(URI.parse("https://aka.ms/vscode/docs/permissions"));
        }
      },
      onHide: () => {
        triggerElement.focus();
      }
    };
    const listOptions = { minWidth: 255 };
    this.actionWidgetService.show(
      "permissionPicker",
      false,
      items,
      delegate,
      this._triggerElement,
      void 0,
      [],
      {
        getWidgetAriaLabel: () => localize("permissionPicker.ariaLabel", "Permission Picker")
      },
      listOptions
    );
  }
  _isResolving() {
    return this._delegate.isResolving?.get() ?? false;
  }
  async _selectLevel(level) {
    if (!await maybeConfirmElevatedPermissionLevel(level, this.dialogService, this.storageService, {
      defaultSettingKey: this._delegate.defaultSettingKey,
      levelLabel: this._getPermissionLevelMeta(level).label
    })) {
      reportNewChatPickerClosed(this.telemetryService, {
        id: "NewChatPermissionPicker",
        name: "NewChatPermissionPicker",
        optionIdBefore: this._currentLevel,
        optionIdAfter: this._currentLevel,
        optionLabelBefore: void 0,
        optionLabelAfter: void 0,
        isPII: false
      });
      return;
    }
    reportNewChatPickerClosed(this.telemetryService, {
      id: "NewChatPermissionPicker",
      name: "NewChatPermissionPicker",
      optionIdBefore: this._currentLevel,
      optionIdAfter: level,
      optionLabelBefore: void 0,
      optionLabelAfter: void 0,
      isPII: false
    });
    this._currentLevel = level;
    this._updateTriggerLabel(this._triggerElement);
    this._delegate.setPermissionLevel(level);
  }
  _updateTriggerLabel(trigger) {
    if (!trigger) {
      return;
    }
    dom.clearNode(trigger);
    const meta = this._getPermissionLevelMeta(this._currentLevel);
    dom.append(trigger, renderIcon(meta.icon));
    const labelSpan = dom.append(trigger, dom.$("span.sessions-chat-dropdown-label"));
    labelSpan.textContent = meta.label;
    const hover = this._getPermissionLevelHover(this._currentLevel, meta);
    trigger.ariaLabel = hover ? localize("permissionPicker.triggerAriaLabelWithDescription", "Pick Permission Level, {0}, {1}", meta.label, hover) : localize("permissionPicker.triggerAriaLabel", "Pick Permission Level, {0}", meta.label);
    trigger.classList.toggle("warning", this._currentLevel === ChatPermissionLevel.Autopilot || this._currentLevel === ChatPermissionLevel.Assisted);
    trigger.classList.toggle("info", this._currentLevel === ChatPermissionLevel.AutoApprove);
  }
  _getPermissionLevelHover(level, meta) {
    return this._delegate.getPermissionLevelHover?.(level, meta) ?? meta.hover;
  }
  _getPermissionLevelMeta(level) {
    const meta = getPermissionLevelMeta(level);
    return this._delegate.getPermissionLevelMeta(level, meta);
  }
};
PermissionPicker = __decorateClass([
  __decorateParam(1, IActionWidgetService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IDialogService),
  __decorateParam(4, IOpenerService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, ITelemetryService),
  __decorateParam(7, IHoverService)
], PermissionPicker);
let CopilotPermissionPickerDelegate = class extends Disposable {
  constructor(_session, _sessionsProvidersService, _chatSessionsService) {
    super();
    this._session = _session;
    this._sessionsProvidersService = _sessionsProvidersService;
    this._chatSessionsService = _chatSessionsService;
    this.currentPermissionLevel = derived(this, (reader) => {
      const session = this._session.read(reader);
      if (!session) {
        return void 0;
      }
      const provider = this._sessionsProvidersService.getProvider(session.providerId);
      if (!(provider instanceof CopilotChatSessionsProvider)) {
        return void 0;
      }
      return provider.getSession(session.sessionId)?.permissionLevel.read(reader);
    });
  }
  getPermissionLevelMeta(_level, meta) {
    return meta;
  }
  setPermissionLevel(level) {
    const session = this._session.get();
    if (!session) {
      return;
    }
    const provider = this._sessionsProvidersService.getProvider(session.providerId);
    if (provider instanceof CopilotChatSessionsProvider) {
      const chatSession = provider.getSession(session.sessionId);
      if (!chatSession) {
        return;
      }
      if (chatSession.setOption) {
        chatSession.setPermissionLevel(level);
        chatSession.setOption(PERMISSION_LEVEL_OPTION_ID, level);
      } else {
        this._chatSessionsService.setSessionOption(chatSession.resource, PERMISSION_LEVEL_OPTION_ID, level);
      }
    }
  }
};
CopilotPermissionPickerDelegate = __decorateClass([
  __decorateParam(1, ISessionsProvidersService),
  __decorateParam(2, IChatSessionsService)
], CopilotPermissionPickerDelegate);
export {
  CopilotPermissionPickerDelegate,
  DEFAULT_PERMISSION_LEVELS,
  PermissionPicker,
  getPermissionLevelMeta
};
