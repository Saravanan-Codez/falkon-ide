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
import { Codicon } from "../../../../../base/common/codicons.js";
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../nls.js";
import { IActionWidgetService } from "../../../../../platform/actionWidget/browser/actionWidget.js";
import { ActionListItemKind } from "../../../../../platform/actionWidget/browser/actionList.js";
import { renderIcon } from "../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { ChatMode, IChatModeService } from "../../../../../workbench/contrib/chat/common/chatModes.js";
import { reportChatModeChange } from "../../../../../workbench/contrib/chat/common/chatModeTelemetry.js";
import { IChatService } from "../../../../../workbench/contrib/chat/common/chatService/chatService.js";
import { IChatSessionsService } from "../../../../../workbench/contrib/chat/common/chatSessionsService.js";
import { getChatSessionType } from "../../../../../workbench/contrib/chat/common/model/chatUri.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { Target } from "../../../../../workbench/contrib/chat/common/promptSyntax/promptTypes.js";
import { AICustomizationManagementCommands } from "../../../../../workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagement.js";
import { AICustomizationManagementSection } from "../../../../../workbench/contrib/chat/common/aiCustomizationWorkspaceService.js";
import { reportNewChatPickerClosed } from "../../../chat/browser/newChatPickerTelemetry.js";
import { CopilotCLISessionType } from "../../agentHost/browser/baseAgentHostSessionsProvider.js";
let ModePickerModel = class extends Disposable {
  constructor(chatSessionsService, chatModeService) {
    super();
    this.chatSessionsService = chatSessionsService;
    this.chatModeService = chatModeService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._modeChangeListener = this._register(new MutableDisposable());
    this._chatModesDisposable = this._register(new MutableDisposable());
    this._selectedModeId = void 0;
  }
  get selectedMode() {
    if (!this._selectedModeId) {
      return ChatMode.Agent;
    }
    return this._findModeById(this._selectedModeId) ?? ChatMode.Agent;
  }
  get selectedModeId() {
    return this._selectedModeId;
  }
  reset() {
    this._selectedModeId = void 0;
    this._onDidChange.fire();
  }
  setSelectedMode(mode) {
    this._selectedModeId = mode.id;
    this._onDidChange.fire();
  }
  setSession(session, selectedModeId) {
    if (!session) {
      if (!this._sessionResource) {
        return;
      }
      this._sessionResource = void 0;
      this._chatModesDisposable.value = void 0;
      this._chatModes = void 0;
      this._selectedModeId = void 0;
      this._onDidChange.fire();
      return;
    }
    this._setSession(session, selectedModeId);
  }
  getAvailableModes() {
    const sessionType = this._sessionResource ? getChatSessionType(this._sessionResource) : CopilotCLISessionType.id;
    const customAgentTarget = this.chatSessionsService.getCustomAgentTargetForSessionType(sessionType);
    const effectiveTarget = customAgentTarget && customAgentTarget !== Target.Undefined ? customAgentTarget : Target.GitHubCopilot;
    const result = [ChatMode.Agent];
    for (const mode of this._chatModes?.custom ?? []) {
      const target = mode.target.get();
      if (target === effectiveTarget || target === Target.Undefined) {
        const visibility = mode.visibility?.get();
        if (visibility && !visibility.userInvocable) {
          continue;
        }
        result.push(mode);
      }
    }
    return result;
  }
  _setSession(session, selectedModeId) {
    const sessionResource = session.resource;
    if (this._sessionResource?.toString() === sessionResource.toString()) {
      if (this._selectedModeId !== selectedModeId) {
        this._selectedModeId = selectedModeId;
        this._onDidChange.fire();
      }
      return;
    }
    this._sessionResource = sessionResource;
    const modes = this.chatModeService.createModes(sessionResource);
    this._chatModesDisposable.value = modes;
    this._chatModes = modes;
    this._modeChangeListener.value = modes.onDidChange(() => {
      this._onDidChange.fire();
    });
    this._selectedModeId = selectedModeId;
    this._onDidChange.fire();
  }
  _findModeById(id) {
    const mode = this._chatModes?.findModeById(id);
    if (mode) {
      return mode;
    }
    return void 0;
  }
};
ModePickerModel = __decorateClass([
  __decorateParam(0, IChatSessionsService),
  __decorateParam(1, IChatModeService)
], ModePickerModel);
let ModePicker = class extends Disposable {
  constructor(modePickerModel, session, actionWidgetService, commandService, telemetryService, chatService) {
    super();
    this.session = session;
    this.actionWidgetService = actionWidgetService;
    this.commandService = commandService;
    this.telemetryService = telemetryService;
    this.chatService = chatService;
    this._onDidSelect = this._register(new Emitter());
    this.onDidSelect = this._onDidSelect.event;
    this._renderDisposables = this._register(new DisposableStore());
    this._modePickerModel = modePickerModel;
    this._register(this._modePickerModel.onDidChange(() => {
      if (this._triggerElement) {
        this._updateTriggerLabel();
      }
    }));
  }
  /**
   * Resets the selected mode back to the default Agent mode.
   */
  reset() {
    this._modePickerModel.reset();
    this._updateTriggerLabel();
  }
  /**
   * Renders the mode picker trigger button into the given container.
   */
  render(container) {
    this._renderDisposables.clear();
    const slot = dom.append(container, dom.$(".sessions-chat-picker-slot"));
    this._renderDisposables.add({ dispose: () => slot.remove() });
    const trigger = dom.append(slot, dom.$("a.action-label"));
    trigger.tabIndex = 0;
    trigger.role = "button";
    this._triggerElement = trigger;
    this._updateTriggerLabel();
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
    return slot;
  }
  _showPicker() {
    if (!this._triggerElement || this.actionWidgetService.isVisible) {
      return;
    }
    const modes = this._modePickerModel.getAvailableModes();
    const items = this._buildItems(modes);
    const triggerElement = this._triggerElement;
    const delegate = {
      onSelect: (item) => {
        this.actionWidgetService.hide();
        if (item.kind === "mode") {
          const activeChat = this.session.get()?.activeChat.get();
          const previousModeId = activeChat?.mode.get()?.id;
          const previousMode = modes.find((mode) => mode.id === previousModeId) ?? ChatMode.Agent;
          reportNewChatPickerClosed(this.telemetryService, {
            id: "NewChatModePicker",
            optionIdBefore: previousMode.id,
            optionIdAfter: item.mode.id,
            optionLabelBefore: previousMode.label.get(),
            optionLabelAfter: item.mode.label.get(),
            isPII: true
          });
          const requestCount = activeChat ? this.chatService.getSession(activeChat.resource)?.getRequests().length ?? 0 : 0;
          reportChatModeChange(this.telemetryService, previousMode, item.mode, requestCount);
          this._selectMode(item.mode);
        } else {
          this.commandService.executeCommand(AICustomizationManagementCommands.OpenEditor, AICustomizationManagementSection.Agents);
        }
      },
      onHide: () => {
        triggerElement.focus();
      }
    };
    this.actionWidgetService.show(
      "localModePicker",
      false,
      items,
      delegate,
      this._triggerElement,
      void 0,
      [],
      {
        getAriaLabel: (item) => item.label ?? "",
        getWidgetAriaLabel: () => localize("modePicker.ariaLabel", "Mode Picker")
      }
    );
  }
  _buildItems(modes) {
    const items = [];
    const selectedModeId = this._modePickerModel.selectedMode.id;
    const agentMode = modes[0];
    items.push({
      kind: ActionListItemKind.Action,
      label: agentMode.label.get(),
      group: { title: "", icon: selectedModeId === agentMode.id ? Codicon.check : Codicon.blank },
      item: { kind: "mode", mode: agentMode }
    });
    const customModes = modes.slice(1);
    if (customModes.length > 0) {
      items.push({ kind: ActionListItemKind.Separator, label: "" });
      for (const mode of customModes) {
        items.push({
          kind: ActionListItemKind.Action,
          label: mode.label.get(),
          group: { title: "", icon: selectedModeId === mode.id ? Codicon.check : Codicon.blank },
          item: { kind: "mode", mode }
        });
      }
    }
    items.push({ kind: ActionListItemKind.Separator, label: "" });
    items.push({
      kind: ActionListItemKind.Action,
      label: localize("configureCustomAgents", "Configure Custom Agents..."),
      group: { title: "", icon: Codicon.blank },
      item: { kind: "configure" }
    });
    return items;
  }
  _selectMode(mode) {
    this._modePickerModel.setSelectedMode(mode);
    this._updateTriggerLabel();
    this._onDidSelect.fire(mode);
  }
  _updateTriggerLabel() {
    if (!this._triggerElement) {
      return;
    }
    dom.clearNode(this._triggerElement);
    const selectedMode = this._modePickerModel.selectedMode;
    const icon = selectedMode.icon.get();
    if (icon) {
      dom.append(this._triggerElement, renderIcon(icon));
    }
    const labelSpan = dom.append(this._triggerElement, dom.$("span.sessions-chat-dropdown-label"));
    labelSpan.textContent = selectedMode.label.get();
    this._triggerElement.ariaLabel = localize("modePicker.triggerAriaLabel", "Pick Mode, {0}", selectedMode.label.get());
  }
};
ModePicker = __decorateClass([
  __decorateParam(2, IActionWidgetService),
  __decorateParam(3, ICommandService),
  __decorateParam(4, ITelemetryService),
  __decorateParam(5, IChatService)
], ModePicker);
export {
  ModePicker,
  ModePickerModel
};
