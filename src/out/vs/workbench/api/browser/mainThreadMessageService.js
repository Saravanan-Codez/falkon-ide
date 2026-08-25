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
import * as nls from "../../../nls.js";
import { toAction } from "../../../base/common/actions.js";
import { MainContext } from "../common/extHost.protocol.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { IDialogService } from "../../../platform/dialogs/common/dialogs.js";
import { INotificationService, NotificationPriority } from "../../../platform/notification/common/notification.js";
import { Event } from "../../../base/common/event.js";
import { ICommandService } from "../../../platform/commands/common/commands.js";
import { IExtensionService } from "../../services/extensions/common/extensions.js";
let MainThreadMessageService = class {
  constructor(extHostContext, _notificationService, _commandService, _dialogService, extensionService) {
    this._notificationService = _notificationService;
    this._commandService = _commandService;
    this._dialogService = _dialogService;
    this.extensionsListener = extensionService.onDidChangeExtensions((e) => {
      for (const extension of e.removed) {
        this._notificationService.removeFilter(extension.identifier.value);
      }
    });
  }
  dispose() {
    this.extensionsListener.dispose();
  }
  $showMessage(severity, message, options, commands) {
    if (options.modal) {
      return this._showModalMessage(severity, message, options.detail, commands, options.useCustom);
    } else {
      return this._showMessage(severity, message, commands, options);
    }
  }
  _showMessage(severity, message, commands, options) {
    return new Promise((resolve) => {
      const primaryActions = commands.map((command) => toAction({
        id: `_extension_message_handle_${command.handle}`,
        label: command.title,
        enabled: true,
        run: () => {
          resolve(command.handle);
          return Promise.resolve();
        }
      }));
      let source;
      let sourceIsUrgent = false;
      if (options.source) {
        source = {
          label: options.source.label,
          id: options.source.identifier.value
        };
        sourceIsUrgent = MainThreadMessageService.URGENT_NOTIFICATION_SOURCES.includes(source.id);
      }
      if (!source) {
        source = nls.localize("defaultSource", "Extension");
      }
      const secondaryActions = [];
      if (options.source) {
        secondaryActions.push(toAction({
          id: options.source.identifier.value,
          label: nls.localize("manageExtension", "Manage Extension"),
          run: () => {
            return this._commandService.executeCommand("_extensions.manage", options.source.identifier.value);
          }
        }));
      }
      const messageHandle = this._notificationService.notify({
        severity,
        message,
        actions: { primary: primaryActions, secondary: secondaryActions },
        source,
        priority: sourceIsUrgent ? NotificationPriority.URGENT : NotificationPriority.DEFAULT,
        sticky: sourceIsUrgent
      });
      Event.once(messageHandle.onDidClose)(() => {
        resolve(void 0);
      });
    });
  }
  async _showModalMessage(severity, message, detail, commands, useCustom) {
    const buttons = [];
    let cancelButton = void 0;
    for (const command of commands) {
      const button = {
        label: command.title,
        run: () => command.handle
      };
      if (command.isCloseAffordance) {
        cancelButton = button;
      } else {
        buttons.push(button);
      }
    }
    if (!cancelButton) {
      if (buttons.length > 0) {
        cancelButton = {
          label: nls.localize("cancel", "Cancel"),
          run: () => void 0
        };
      } else {
        cancelButton = {
          label: nls.localize({ key: "ok", comment: ["&& denotes a mnemonic"] }, "&&OK"),
          run: () => void 0
        };
      }
    }
    const { result } = await this._dialogService.prompt({
      type: severity,
      message,
      detail,
      buttons,
      cancelButton,
      custom: useCustom
    });
    return result;
  }
};
MainThreadMessageService.URGENT_NOTIFICATION_SOURCES = [
  "vscode.github-authentication",
  "vscode.microsoft-authentication"
];
MainThreadMessageService = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadMessageService),
  __decorateParam(1, INotificationService),
  __decorateParam(2, ICommandService),
  __decorateParam(3, IDialogService),
  __decorateParam(4, IExtensionService)
], MainThreadMessageService);
export {
  MainThreadMessageService
};
