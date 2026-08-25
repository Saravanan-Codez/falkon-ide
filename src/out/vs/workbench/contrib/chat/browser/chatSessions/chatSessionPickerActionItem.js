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
import "./media/chatSessionPickerActionItem.css";
import * as dom from "../../../../../base/browser/dom.js";
import { getActiveWindow } from "../../../../../base/browser/dom.js";
import { IActionWidgetService } from "../../../../../platform/actionWidget/browser/actionWidget.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { ActionWidgetDropdownActionViewItem } from "../../../../../platform/actions/browser/actionWidgetDropdownActionViewItem.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { renderIcon } from "../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { localize } from "../../../../../nls.js";
import { withChatInputPickerMotion } from "../widget/input/chatInputPickerActionItem.js";
import { autorun } from "../../../../../base/common/observable.js";
import { IChatEntitlementService } from "../../../../services/chat/common/chatEntitlementService.js";
import { getModelHoverContent } from "../widget/input/modelPicker/modelPickerHover.js";
import { ExtensionIdentifier } from "../../../../../platform/extensions/common/extensions.js";
let ChatSessionPickerActionItem = class extends ActionWidgetDropdownActionViewItem {
  constructor(action, initialState, delegate, _pickerOptions, actionWidgetService, contextKeyService, keybindingService, commandService, telemetryService, chatEntitlementService, openerService) {
    const { group, item } = initialState;
    const actionWithLabel = {
      ...action,
      label: item?.name || group.name,
      tooltip: item?.description ?? group.description ?? group.name,
      run: () => {
      }
    };
    const sessionPickerActionWidgetOptions = {
      actionProvider: {
        getActions: () => this.getDropdownActions()
      },
      actionBarActionProvider: void 0,
      reporter: { id: group.id, name: `ChatSession:${group.name}`, includeOptions: false },
      getAnchor: () => this._getAnchorElement(),
      listOptions: withChatInputPickerMotion(void 0)
    };
    super(actionWithLabel, sessionPickerActionWidgetOptions, actionWidgetService, keybindingService, contextKeyService, telemetryService);
    this.delegate = delegate;
    this._pickerOptions = _pickerOptions;
    this.commandService = commandService;
    this.chatEntitlementService = chatEntitlementService;
    this.openerService = openerService;
    this.currentOption = item;
    this._register(this.delegate.onDidChangeOption((newOption) => {
      this.currentOption = newOption;
      if (this.element) {
        this.renderLabel(this.element);
      }
      this.updateEnabled();
    }));
    const pickerOptions = this._pickerOptions;
    if (pickerOptions) {
      this._register(autorun((reader) => {
        pickerOptions.compact.read(reader);
        if (this.element) {
          this.renderLabel(this.element);
        }
      }));
    }
  }
  /**
   * Returns the actions to show in the dropdown. Can be overridden by subclasses.
   */
  getDropdownActions() {
    const currentOption = this.delegate.getCurrentOption();
    if (currentOption?.locked) {
      return [this.createLockedOptionAction(currentOption)];
    }
    const group = this.delegate.getOptionGroup();
    if (!group) {
      return [];
    }
    const actions = group.items.map((optionItem) => {
      const isCurrent = optionItem.id === currentOption?.id;
      return {
        id: optionItem.id,
        enabled: !optionItem.locked,
        icon: optionItem.icon,
        checked: isCurrent,
        class: void 0,
        description: optionItem.description,
        tooltip: optionItem.description ?? optionItem.name,
        label: optionItem.name,
        hover: this._buildOptionHover(optionItem),
        run: () => {
          this.delegate.setOption(optionItem);
        }
      };
    });
    if (group.commands?.length) {
      const addSeparator = actions.length > 0;
      for (const command of group.commands) {
        const args = command.arguments ? [...command.arguments] : [];
        const sessionResource = this.delegate.getSessionResource();
        if (sessionResource) {
          args.unshift(sessionResource);
        }
        actions.push({
          id: command.command,
          enabled: true,
          checked: false,
          class: void 0,
          description: void 0,
          tooltip: command.tooltip ?? command.title,
          label: command.title,
          // Use category to create a separator before commands (only if there are options)
          category: addSeparator ? { label: "", order: Number.MAX_SAFE_INTEGER } : void 0,
          run: () => {
            this.commandService.executeCommand(command.command, ...args);
          }
        });
      }
    }
    return actions;
  }
  _buildOptionHover(optionItem) {
    if (optionItem.modelMetadata) {
      const isUBB = !!this.chatEntitlementService.quotas.usageBasedBilling;
      const syntheticModel = {
        identifier: optionItem.id,
        metadata: {
          extension: new ExtensionIdentifier(""),
          name: optionItem.modelMetadata.name,
          id: optionItem.modelMetadata.id,
          vendor: optionItem.modelMetadata.vendor ?? "",
          version: optionItem.modelMetadata.version ?? "",
          family: optionItem.modelMetadata.family ?? "",
          tooltip: optionItem.modelMetadata.tooltip,
          pricing: optionItem.modelMetadata.pricing,
          multiplierNumeric: optionItem.modelMetadata.multiplierNumeric,
          inputCost: optionItem.modelMetadata.inputCost,
          outputCost: optionItem.modelMetadata.outputCost,
          cacheCost: optionItem.modelMetadata.cacheCost,
          cacheWriteCost: optionItem.modelMetadata.cacheWriteCost,
          longContextInputCost: optionItem.modelMetadata.longContextInputCost,
          longContextOutputCost: optionItem.modelMetadata.longContextOutputCost,
          longContextCacheCost: optionItem.modelMetadata.longContextCacheCost,
          longContextCacheWriteCost: optionItem.modelMetadata.longContextCacheWriteCost,
          priceCategory: optionItem.modelMetadata.priceCategory,
          promo: optionItem.modelMetadata.promo,
          maxInputTokens: optionItem.modelMetadata.maxInputTokens ?? 0,
          maxOutputTokens: optionItem.modelMetadata.maxOutputTokens ?? 0,
          capabilities: optionItem.modelMetadata.capabilities ? {
            vision: optionItem.modelMetadata.capabilities.vision,
            toolCalling: optionItem.modelMetadata.capabilities.toolCalling
          } : void 0,
          isDefaultForLocation: {}
        }
      };
      const hover = getModelHoverContent(syntheticModel, isUBB, void 0, this.openerService);
      if (hover) {
        return { content: hover.element, disposable: hover.disposable };
      }
    }
    if (optionItem.tooltip) {
      return { content: optionItem.tooltip };
    }
    return void 0;
  }
  /**
   * Creates a disabled action for a locked option.
   */
  createLockedOptionAction(option) {
    return {
      id: option.id,
      enabled: false,
      icon: option.icon,
      checked: true,
      class: void 0,
      description: option.description,
      tooltip: option.description ?? option.name,
      label: option.name,
      run: () => {
      }
    };
  }
  /**
   * Returns the anchor element for the dropdown.
   * Falls back to the overflow anchor if this element is not in the DOM.
   */
  _getAnchorElement() {
    if (this.element && getActiveWindow().document.contains(this.element)) {
      return this.element;
    }
    return this._pickerOptions?.getOverflowAnchor?.() ?? this.element;
  }
  renderLabel(element) {
    const domChildren = [];
    element.classList.add("chat-session-option-picker");
    const group = this.delegate.getOptionGroup();
    const isDefaultWithIcon = this.currentOption?.default && this.currentOption?.icon;
    if (this.currentOption?.icon) {
      domChildren.push(renderIcon(this.currentOption.icon));
    }
    if (!isDefaultWithIcon) {
      domChildren.push(dom.$("span.chat-session-option-label", void 0, this.currentOption?.name ?? group?.description ?? localize("chat.sessionPicker.label", "Pick Option")));
    }
    dom.reset(element, ...domChildren);
    this.setAriaLabelAttributes(element);
    return null;
  }
  render(container) {
    this.container = container;
    super.render(container);
    container.classList.add(this.getContainerClass());
    if (this.currentOption?.locked) {
      container.classList.add("locked");
    }
  }
  /**
   * Returns the CSS class to add to the container. Can be overridden by subclasses.
   */
  getContainerClass() {
    return "chat-sessionPicker-item";
  }
  updateEnabled() {
    const originalEnabled = this.action.enabled;
    if (this.currentOption?.locked) {
      this.action.enabled = false;
    }
    super.updateEnabled();
    this.action.enabled = originalEnabled;
    if (this.container) {
      this.container.classList.toggle("locked", !!this.currentOption?.locked);
    }
  }
};
ChatSessionPickerActionItem = __decorateClass([
  __decorateParam(4, IActionWidgetService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IKeybindingService),
  __decorateParam(7, ICommandService),
  __decorateParam(8, ITelemetryService),
  __decorateParam(9, IChatEntitlementService),
  __decorateParam(10, IOpenerService)
], ChatSessionPickerActionItem);
export {
  ChatSessionPickerActionItem
};
