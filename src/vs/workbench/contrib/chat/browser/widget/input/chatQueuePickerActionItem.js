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
import { $, addDisposableListener, append, EventType, ModifierKeyEmitter } from "../../../../../../base/browser/dom.js";
import { StandardKeyboardEvent } from "../../../../../../base/browser/keyboardEvent.js";
import { ActionViewItem, BaseActionViewItem } from "../../../../../../base/browser/ui/actionbar/actionViewItems.js";
import { Action } from "../../../../../../base/common/actions.js";
import { coalesce } from "../../../../../../base/common/arrays.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { KeyCode } from "../../../../../../base/common/keyCodes.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { localize } from "../../../../../../nls.js";
import { IActionViewItemService } from "../../../../../../platform/actions/browser/actionViewItemService.js";
import { ActionWidgetDropdownActionViewItem } from "../../../../../../platform/actions/browser/actionWidgetDropdownActionViewItem.js";
import { MenuId, SubmenuItemAction } from "../../../../../../platform/actions/common/actions.js";
import { IActionWidgetService } from "../../../../../../platform/actionWidget/browser/actionWidget.js";
import { ICommandService } from "../../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IKeybindingService } from "../../../../../../platform/keybinding/common/keybinding.js";
import { ITelemetryService } from "../../../../../../platform/telemetry/common/telemetry.js";
import { ChatContextKeys } from "../../../common/actions/chatContextKeys.js";
import { IChatSideChatService } from "../../../common/chatSideChatService.js";
import { ChatConfiguration } from "../../../common/constants.js";
import { IChatWidgetService } from "../../chat.js";
import { ChatSubmitAction } from "../../actions/chatExecuteActions.js";
import { ChatAskInSideChatAction, ChatQueueMessageAction, ChatSteerWithMessageAction } from "../../actions/chatQueueActions.js";
let ChatQueuePickerActionItem = class extends BaseActionViewItem {
  constructor(action, _options, commandService, configurationService, actionWidgetService, keybindingService, contextKeyService, telemetryService, chatWidgetService, chatSideChatService) {
    super(void 0, action);
    this.commandService = commandService;
    this.configurationService = configurationService;
    this.keybindingService = keybindingService;
    this.contextKeyService = contextKeyService;
    this.chatWidgetService = chatWidgetService;
    this.chatSideChatService = chatSideChatService;
    this._altKeyPressed = false;
    const isSteerDefault = this._isSteerDefault();
    this._primaryActionAction = this._register(new Action(
      "chat.queuePickerPrimary",
      isSteerDefault ? localize("chat.steerWithMessage", "Steer with Message") : localize("chat.queueMessage", "Add to Queue"),
      ThemeIcon.asClassName(isSteerDefault ? Codicon.newLine : Codicon.add),
      !!this.contextKeyService.getContextKeyValue(ChatContextKeys.inputHasText.key),
      () => this._runDefaultAction()
    ));
    this._primaryAction = this._register(new ActionViewItem(void 0, this._primaryActionAction, { icon: true, label: false }));
    this._register(this.contextKeyService.onDidChangeContext((e) => {
      this._primaryActionAction.enabled = !!this.contextKeyService.getContextKeyValue(ChatContextKeys.inputHasText.key);
    }));
    const dropdownAction = this._register(new Action("chat.queuePickerDropdown", localize("chat.queuePicker.moreActions", "More Actions...")));
    this._dropdown = this._register(new ChevronActionWidgetDropdown(
      dropdownAction,
      {
        actionProvider: { getActions: () => this._getDropdownActions() },
        showItemKeybindings: true
      },
      actionWidgetService,
      this.keybindingService,
      this.contextKeyService,
      telemetryService
    ));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(ChatConfiguration.RequestQueueingDefaultAction)) {
        this._updatePrimaryAction();
      }
    }));
    this._register(ModifierKeyEmitter.getInstance().event((status) => {
      if (this._altKeyPressed !== status.altKey) {
        this._altKeyPressed = status.altKey;
        this._updatePrimaryAction();
      }
    }));
  }
  _isSteerDefault() {
    return this.configurationService.getValue(ChatConfiguration.RequestQueueingDefaultAction) === "steer";
  }
  _isEffectiveSteer() {
    const isSteerDefault = this._isSteerDefault();
    return this._altKeyPressed ? !isSteerDefault : isSteerDefault;
  }
  _updatePrimaryAction() {
    const isSteer = this._isEffectiveSteer();
    this._primaryActionAction.label = isSteer ? localize("chat.steerWithMessage", "Steer with Message") : localize("chat.queueMessage", "Add to Queue");
    this._primaryActionAction.class = ThemeIcon.asClassName(isSteer ? Codicon.newLine : Codicon.add);
  }
  _runDefaultAction() {
    const actionId = this._isEffectiveSteer() ? ChatSteerWithMessageAction.ID : ChatQueueMessageAction.ID;
    this.commandService.executeCommand(actionId);
  }
  render(container) {
    super.render(container);
    container.classList.add("monaco-dropdown-with-default");
    const primaryContainer = $(".action-container");
    this._primaryAction.render(append(container, primaryContainer));
    this._register(addDisposableListener(primaryContainer, EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.RightArrow)) {
        this._primaryAction.blur();
        this._dropdown.focus();
        event.stopPropagation();
      }
    }));
    const dropdownContainer = $(".dropdown-action-container");
    this._dropdown.render(append(container, dropdownContainer));
    this._register(addDisposableListener(dropdownContainer, EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.LeftArrow)) {
        this._dropdown.setFocusable(false);
        this._primaryAction.focus();
        event.stopPropagation();
      }
    }));
  }
  focus(fromRight) {
    if (fromRight) {
      this._dropdown.focus();
    } else {
      this._primaryAction.focus();
    }
  }
  blur() {
    this._primaryAction.blur();
    this._dropdown.blur();
  }
  setFocusable(focusable) {
    this._primaryAction.setFocusable(focusable);
    this._dropdown.setFocusable(focusable);
  }
  _getDropdownActions() {
    const isSteerDefault = this._isSteerDefault();
    const lookupContext = this.contextKeyService.createOverlay([
      [ChatContextKeys.inputHasText.key, true],
      [ChatContextKeys.inChatInput.key, true],
      [ChatContextKeys.requestInProgress.key, true]
    ]);
    const queueKeybinding = this.keybindingService.lookupKeybinding(ChatQueueMessageAction.ID, lookupContext, true);
    const steerKeybinding = this.keybindingService.lookupKeybinding(ChatSteerWithMessageAction.ID, lookupContext, true);
    const queueAction = {
      id: ChatQueueMessageAction.ID,
      label: localize("chat.queueMessage", "Add to Queue"),
      tooltip: "",
      enabled: true,
      checked: !isSteerDefault,
      icon: Codicon.add,
      class: void 0,
      keybinding: queueKeybinding,
      hover: {
        content: localize("chat.queueMessage.hover", "Queue this message to send after the current request completes. The current response will finish uninterrupted before the queued message is sent.")
      },
      run: () => {
        this.commandService.executeCommand(ChatQueueMessageAction.ID);
      }
    };
    const steerAction = {
      id: ChatSteerWithMessageAction.ID,
      label: localize("chat.steerWithMessage", "Steer with Message"),
      tooltip: "",
      enabled: true,
      checked: isSteerDefault,
      icon: Codicon.newLine,
      class: void 0,
      keybinding: steerKeybinding,
      hover: {
        content: localize("chat.steerWithMessage.hover", "Send this message at the next opportunity, signaling the current request to yield. The current response will stop and the new message will be sent immediately.")
      },
      run: () => {
        this.commandService.executeCommand(ChatSteerWithMessageAction.ID);
      }
    };
    const sendAction = {
      id: "_" + ChatSubmitAction.ID,
      // _ to avoid showing a keybinding which is not valid in this context
      label: localize("chat.sendImmediately", "Stop and Send"),
      tooltip: "",
      enabled: true,
      icon: Codicon.arrowRight,
      class: void 0,
      hover: {
        content: localize("chat.sendImmediately.hover", "Cancel the current request and send this message immediately.")
      },
      run: () => {
        this.commandService.executeCommand(ChatSubmitAction.ID, { acceptInputOptions: { cancelCurrentRequest: true } });
      }
    };
    const askInSideChatAction = this._canAskInSideChat() ? {
      id: ChatAskInSideChatAction.ID,
      label: localize("chat.askInSideChat", "Ask in Side Chat"),
      tooltip: "",
      enabled: true,
      icon: Codicon.commentDiscussion,
      class: void 0,
      hover: {
        content: localize("chat.askInSideChat.hover", "Ask this question in a side chat. The current response continues uninterrupted and the question is answered alongside it, without being added to this conversation.")
      },
      run: () => {
        this.commandService.executeCommand(ChatAskInSideChatAction.ID);
      }
    } : void 0;
    return coalesce([sendAction, queueAction, steerAction, askInSideChatAction]);
  }
  /**
   * Side chats are provided by the layer hosting the conversation (today the
   * Agents window), so the entry is offered only once a provider reports the
   * current conversation can branch one.
   */
  _canAskInSideChat() {
    const sessionResource = this.chatWidgetService.lastFocusedWidget?.viewModel?.model.sessionResource;
    return !!sessionResource && this.chatSideChatService.canAskInSideChat(sessionResource);
  }
};
ChatQueuePickerActionItem = __decorateClass([
  __decorateParam(2, ICommandService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IActionWidgetService),
  __decorateParam(5, IKeybindingService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, ITelemetryService),
  __decorateParam(8, IChatWidgetService),
  __decorateParam(9, IChatSideChatService)
], ChatQueuePickerActionItem);
class ChevronActionWidgetDropdown extends ActionWidgetDropdownActionViewItem {
  renderLabel(element) {
    element.classList.add("codicon", "codicon-chevron-down");
    return null;
  }
}
let ChatQueuePickerRendering = class extends Disposable {
  static {
    this.ID = "chat.queuePickerRendering";
  }
  constructor(actionViewItemService) {
    super();
    this._register(actionViewItemService.register(MenuId.ChatExecute, MenuId.ChatExecuteQueue, (action, options, instantiationService) => {
      if (!(action instanceof SubmenuItemAction)) {
        return void 0;
      }
      return instantiationService.createInstance(ChatQueuePickerActionItem, action, options);
    }));
  }
};
ChatQueuePickerRendering = __decorateClass([
  __decorateParam(0, IActionViewItemService)
], ChatQueuePickerRendering);
export {
  ChatQueuePickerActionItem,
  ChatQueuePickerRendering
};
