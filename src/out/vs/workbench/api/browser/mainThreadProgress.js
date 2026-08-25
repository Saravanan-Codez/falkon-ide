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
import { IProgressService, ProgressLocation } from "../../../platform/progress/common/progress.js";
import { MainContext, ExtHostContext } from "../common/extHost.protocol.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { ICommandService } from "../../../platform/commands/common/commands.js";
import { localize } from "../../../nls.js";
import { onUnexpectedExternalError } from "../../../base/common/errors.js";
import { toAction } from "../../../base/common/actions.js";
import { NotificationPriority } from "../../../platform/notification/common/notification.js";
let MainThreadProgress = class {
  constructor(extHostContext, progressService, _commandService) {
    this._commandService = _commandService;
    this._progress = /* @__PURE__ */ new Map();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostProgress);
    this._progressService = progressService;
  }
  dispose() {
    this._progress.forEach((handle) => handle.resolve());
    this._progress.clear();
  }
  async $startProgress(handle, options, extensionId) {
    const task = this._createTask(handle);
    if (options.location === ProgressLocation.Notification && extensionId) {
      const sourceIsUrgent = MainThreadProgress.URGENT_PROGRESS_SOURCES.includes(extensionId);
      const notificationOptions = {
        ...options,
        priority: sourceIsUrgent ? NotificationPriority.URGENT : NotificationPriority.DEFAULT,
        location: ProgressLocation.Notification,
        secondaryActions: [toAction({
          id: extensionId,
          label: localize("manageExtension", "Manage Extension"),
          run: () => this._commandService.executeCommand("_extensions.manage", extensionId)
        })]
      };
      options = notificationOptions;
    }
    try {
      this._progressService.withProgress(options, task, () => this._proxy.$acceptProgressCanceled(handle));
    } catch (err) {
      onUnexpectedExternalError(err);
    }
  }
  $progressReport(handle, message) {
    const entry = this._progress.get(handle);
    entry?.progress.report(message);
  }
  $progressEnd(handle) {
    const entry = this._progress.get(handle);
    if (entry) {
      entry.resolve();
      this._progress.delete(handle);
    }
  }
  _createTask(handle) {
    return (progress) => {
      return new Promise((resolve) => {
        this._progress.set(handle, { resolve, progress });
      });
    };
  }
};
MainThreadProgress.URGENT_PROGRESS_SOURCES = [
  "vscode.github-authentication",
  "vscode.microsoft-authentication"
];
MainThreadProgress = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadProgress),
  __decorateParam(1, IProgressService),
  __decorateParam(2, ICommandService)
], MainThreadProgress);
export {
  MainThreadProgress
};
