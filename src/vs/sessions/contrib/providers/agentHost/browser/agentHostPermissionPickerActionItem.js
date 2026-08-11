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
import { autorun } from "../../../../../base/common/observable.js";
import { IActionWidgetService } from "../../../../../platform/actionWidget/browser/actionWidget.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { IStorageService } from "../../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { PermissionPickerActionItem } from "../../../../../workbench/contrib/chat/browser/widget/input/permissionPickerActionItem.js";
import { AgentHostPermissionPickerDelegate } from "./agentHostPermissionPickerDelegate.js";
let AgentHostPermissionPickerActionItem = class extends PermissionPickerActionItem {
  constructor(action, pickerOptions, session, instantiationService, actionWidgetService, keybindingService, contextKeyService, telemetryService, configurationService, dialogService, openerService, storageService, hoverService) {
    const delegate = instantiationService.createInstance(AgentHostPermissionPickerDelegate, session);
    super(
      action,
      delegate,
      pickerOptions,
      actionWidgetService,
      keybindingService,
      contextKeyService,
      telemetryService,
      configurationService,
      dialogService,
      openerService,
      storageService,
      hoverService
    );
    this._delegate = this._register(delegate);
    this._register(autorun((reader) => {
      delegate.currentPermissionLevel.read(reader);
      this.refresh();
    }));
  }
  render(container) {
    super.render(container);
    this._register(autorun((reader) => {
      const visible = this._delegate.isApplicable.read(reader);
      container.style.display = visible ? "" : "none";
    }));
    this._register(autorun((reader) => {
      const isResolving = this._delegate.isResolving.read(reader);
      const element = this.element;
      if (!element) {
        return;
      }
      element.classList.toggle("sessions-chat-config-resolving", isResolving);
      this.setDropdownEnabled(!isResolving);
      if (isResolving) {
        element.setAttribute("aria-disabled", "true");
      } else {
        element.removeAttribute("aria-disabled");
      }
    }));
  }
  updateEnabled() {
    super.updateEnabled();
    this.setDropdownEnabled(!this._delegate.isResolving.get());
  }
};
AgentHostPermissionPickerActionItem = __decorateClass([
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IActionWidgetService),
  __decorateParam(5, IKeybindingService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, ITelemetryService),
  __decorateParam(8, IConfigurationService),
  __decorateParam(9, IDialogService),
  __decorateParam(10, IOpenerService),
  __decorateParam(11, IStorageService),
  __decorateParam(12, IHoverService)
], AgentHostPermissionPickerActionItem);
export {
  AgentHostPermissionPickerActionItem
};
