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
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { ITerminalLogService } from "../../../../../platform/terminal/common/terminal.js";
import { registerTerminalContribution } from "../../../terminal/browser/terminalExtensions.js";
import { TerminalOscNotificationsSettingId } from "../common/terminalNotificationConfiguration.js";
import { TerminalNotificationHandler } from "./terminalNotificationHandler.js";
let TerminalOscNotificationsContribution = class extends Disposable {
  constructor(_ctx, _configurationService, _notificationService, _logService) {
    super();
    this._ctx = _ctx;
    this._configurationService = _configurationService;
    this._notificationService = _notificationService;
    this._logService = _logService;
    this._handler = this._register(new TerminalNotificationHandler({
      isEnabled: () => this._configurationService.getValue(TerminalOscNotificationsSettingId.EnableNotifications) === true,
      isWindowFocused: () => dom.getActiveWindow().document.hasFocus(),
      isTerminalVisible: () => this._ctx.instance.isVisible,
      focusTerminal: () => this._ctx.instance.focus(true),
      notify: (notification) => this._notificationService.notify(notification),
      updateEnableNotifications: (value) => this._configurationService.updateValue(TerminalOscNotificationsSettingId.EnableNotifications, value),
      logWarn: (message) => this._logService.warn(message),
      writeToProcess: (data) => {
        void this._ctx.instance.sendText(data, false);
      }
    }));
  }
  static {
    this.ID = "terminal.oscNotifications";
  }
  xtermReady(xterm) {
    this._register(xterm.raw.parser.registerOscHandler(99, (data) => this._handler.handleSequence(data)));
  }
};
TerminalOscNotificationsContribution = __decorateClass([
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, INotificationService),
  __decorateParam(3, ITerminalLogService)
], TerminalOscNotificationsContribution);
registerTerminalContribution(TerminalOscNotificationsContribution.ID, TerminalOscNotificationsContribution);
function getTerminalOscNotifications(instance) {
  return instance.getContribution(TerminalOscNotificationsContribution.ID);
}
export {
  getTerminalOscNotifications
};
