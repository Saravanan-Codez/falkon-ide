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
import { debounce } from "../../../../../base/common/decorators.js";
import { Event } from "../../../../../base/common/event.js";
import { Disposable, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { IAccessibilityService } from "../../../../../platform/accessibility/common/accessibility.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { TerminalCapability } from "../../../../../platform/terminal/common/capabilities/capabilities.js";
import { ITerminalLogService, TerminalSettingId } from "../../../../../platform/terminal/common/terminal.js";
let TextAreaSyncAddon = class extends Disposable {
  constructor(_capabilities, _accessibilityService, _configurationService, _logService) {
    super();
    this._capabilities = _capabilities;
    this._accessibilityService = _accessibilityService;
    this._configurationService = _configurationService;
    this._logService = _logService;
    this._listeners = this._register(new MutableDisposable());
    this._register(Event.runAndSubscribe(Event.any(
      this._capabilities.onDidChangeCapabilities,
      this._accessibilityService.onDidChangeScreenReaderOptimized
    ), () => {
      this._refreshListeners();
    }));
  }
  activate(terminal) {
    this._terminal = terminal;
    this._refreshListeners();
  }
  _refreshListeners() {
    const commandDetection = this._capabilities.get(TerminalCapability.CommandDetection);
    if (this._shouldBeActive() && commandDetection) {
      if (!this._listeners.value) {
        const textarea = this._terminal?.textarea;
        if (textarea) {
          this._listeners.value = Event.runAndSubscribe(commandDetection.promptInputModel.onDidChangeInput, () => this._sync(textarea));
        }
      }
    } else {
      this._listeners.clear();
    }
  }
  _shouldBeActive() {
    return this._accessibilityService.isScreenReaderOptimized() || this._configurationService.getValue(TerminalSettingId.DevMode);
  }
  _sync(textArea) {
    const commandCapability = this._capabilities.get(TerminalCapability.CommandDetection);
    if (!commandCapability) {
      return;
    }
    textArea.value = commandCapability.promptInputModel.value;
    textArea.selectionStart = commandCapability.promptInputModel.cursorIndex;
    textArea.selectionEnd = commandCapability.promptInputModel.cursorIndex;
    this._logService.debug(`TextAreaSyncAddon#sync: text changed to "${textArea.value}"`);
  }
};
__decorateClass([
  debounce(50)
], TextAreaSyncAddon.prototype, "_sync", 1);
TextAreaSyncAddon = __decorateClass([
  __decorateParam(1, IAccessibilityService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, ITerminalLogService)
], TextAreaSyncAddon);
export {
  TextAreaSyncAddon
};
