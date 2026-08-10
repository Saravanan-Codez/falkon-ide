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
import { IDebugService } from "./debug.js";
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { Expression } from "./debugModel.js";
let DebugWatchAccessibilityAnnouncer = class extends Disposable {
  constructor(_debugService, _logService, _accessibilityService, _configurationService) {
    super();
    this._debugService = _debugService;
    this._logService = _logService;
    this._accessibilityService = _accessibilityService;
    this._configurationService = _configurationService;
    this._listener = this._register(new MutableDisposable());
    this._setListener();
    this._register(_configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("accessibility.debugWatchVariableAnnouncements")) {
        this._setListener();
      }
    }));
  }
  static {
    this.ID = "workbench.contrib.debugWatchAccessibilityAnnouncer";
  }
  _setListener() {
    const value = this._configurationService.getValue("accessibility.debugWatchVariableAnnouncements");
    if (value && !this._listener.value) {
      this._listener.value = this._debugService.getModel().onDidChangeWatchExpressionValue((e) => {
        if (!e || e.value === Expression.DEFAULT_VALUE) {
          return;
        }
        this._accessibilityService.alert(`${e.name} = ${e.value}`);
        this._logService.trace(`debugAccessibilityAnnouncerValueChanged ${e.name} ${e.value}`);
      });
    } else {
      this._listener.clear();
    }
  }
};
DebugWatchAccessibilityAnnouncer = __decorateClass([
  __decorateParam(0, IDebugService),
  __decorateParam(1, ILogService),
  __decorateParam(2, IAccessibilityService),
  __decorateParam(3, IConfigurationService)
], DebugWatchAccessibilityAnnouncer);
export {
  DebugWatchAccessibilityAnnouncer
};
