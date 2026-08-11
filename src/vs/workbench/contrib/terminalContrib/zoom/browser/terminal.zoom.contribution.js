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
import { Event } from "../../../../../base/common/event.js";
import { MouseWheelClassifier } from "../../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { Disposable, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { isMacintosh } from "../../../../../base/common/platform.js";
import { TerminalSettingId } from "../../../../../platform/terminal/common/terminal.js";
import { registerTerminalContribution } from "../../../terminal/browser/terminalExtensions.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { registerTerminalAction } from "../../../terminal/browser/terminalActions.js";
import { localize2 } from "../../../../../nls.js";
import { isNumber } from "../../../../../base/common/types.js";
import { defaultTerminalFontSize } from "../../../terminal/common/terminalConfiguration.js";
import { TerminalZoomCommandId, TerminalZoomSettingId } from "../common/terminal.zoom.js";
import * as dom from "../../../../../base/browser/dom.js";
let TerminalMouseWheelZoomContribution = class extends Disposable {
  constructor(_ctx, _configurationService) {
    super();
    this._configurationService = _configurationService;
    this._listener = this._register(new MutableDisposable());
  }
  static {
    this.ID = "terminal.mouseWheelZoom";
  }
  static get(instance) {
    return instance.getContribution(TerminalMouseWheelZoomContribution.ID);
  }
  xtermOpen(xterm) {
    this._register(Event.runAndSubscribe(this._configurationService.onDidChangeConfiguration, (e) => {
      if (!e || e.affectsConfiguration(TerminalZoomSettingId.MouseWheelZoom)) {
        if (!!this._configurationService.getValue(TerminalZoomSettingId.MouseWheelZoom)) {
          this._setupMouseWheelZoomListener(xterm.raw);
        } else {
          this._listener.clear();
        }
      }
    }));
  }
  _getConfigFontSize() {
    return this._configurationService.getValue(TerminalSettingId.FontSize);
  }
  _clampFontSize(fontSize) {
    return clampTerminalFontSize(fontSize);
  }
  _setupMouseWheelZoomListener(raw) {
    const classifier = MouseWheelClassifier.INSTANCE;
    let prevMouseWheelTime = 0;
    let gestureStartFontSize = this._getConfigFontSize();
    let gestureHasZoomModifiers = false;
    let gestureAccumulatedDelta = 0;
    const wheelListener = (browserEvent) => {
      if (classifier.isPhysicalMouseWheel()) {
        if (this._hasMouseWheelZoomModifiers(browserEvent)) {
          const delta = browserEvent.deltaY > 0 ? -1 : 1;
          const newFontSize = this._clampFontSize(this._getConfigFontSize() + delta);
          this._configurationService.updateValue(TerminalSettingId.FontSize, newFontSize);
          browserEvent.preventDefault();
          browserEvent.stopPropagation();
        }
      } else {
        if (Date.now() - prevMouseWheelTime > 50) {
          gestureStartFontSize = this._getConfigFontSize();
          gestureHasZoomModifiers = this._hasMouseWheelZoomModifiers(browserEvent);
          gestureAccumulatedDelta = 0;
        }
        prevMouseWheelTime = Date.now();
        gestureAccumulatedDelta += browserEvent.deltaY;
        if (gestureHasZoomModifiers) {
          const deltaAbs = Math.ceil(Math.abs(gestureAccumulatedDelta / 5));
          const deltaDirection = gestureAccumulatedDelta > 0 ? -1 : 1;
          const delta = deltaAbs * deltaDirection;
          const newFontSize = this._clampFontSize(gestureStartFontSize + delta);
          this._configurationService.updateValue(TerminalSettingId.FontSize, newFontSize);
          gestureAccumulatedDelta += browserEvent.deltaY;
          browserEvent.preventDefault();
          browserEvent.stopPropagation();
        }
      }
    };
    this._listener.value = dom.addDisposableListener(raw.element, dom.EventType.MOUSE_WHEEL, wheelListener, { capture: true, passive: false });
  }
  _hasMouseWheelZoomModifiers(browserEvent) {
    return isMacintosh ? (browserEvent.metaKey || browserEvent.ctrlKey) && !browserEvent.shiftKey && !browserEvent.altKey : browserEvent.ctrlKey && !browserEvent.metaKey && !browserEvent.shiftKey && !browserEvent.altKey;
  }
};
TerminalMouseWheelZoomContribution = __decorateClass([
  __decorateParam(1, IConfigurationService)
], TerminalMouseWheelZoomContribution);
registerTerminalContribution(TerminalMouseWheelZoomContribution.ID, TerminalMouseWheelZoomContribution, true);
registerTerminalAction({
  id: TerminalZoomCommandId.FontZoomIn,
  title: localize2("fontZoomIn", "Increase Font Size"),
  run: async (c, accessor) => {
    const configurationService = accessor.get(IConfigurationService);
    const value = configurationService.getValue(TerminalSettingId.FontSize);
    if (isNumber(value)) {
      const newFontSize = clampTerminalFontSize(value + 1);
      await configurationService.updateValue(TerminalSettingId.FontSize, newFontSize);
    }
  }
});
registerTerminalAction({
  id: TerminalZoomCommandId.FontZoomOut,
  title: localize2("fontZoomOut", "Decrease Font Size"),
  run: async (c, accessor) => {
    const configurationService = accessor.get(IConfigurationService);
    const value = configurationService.getValue(TerminalSettingId.FontSize);
    if (isNumber(value)) {
      const newFontSize = clampTerminalFontSize(value - 1);
      await configurationService.updateValue(TerminalSettingId.FontSize, newFontSize);
    }
  }
});
registerTerminalAction({
  id: TerminalZoomCommandId.FontZoomReset,
  title: localize2("fontZoomReset", "Reset Font Size"),
  run: async (c, accessor) => {
    const configurationService = accessor.get(IConfigurationService);
    await configurationService.updateValue(TerminalSettingId.FontSize, defaultTerminalFontSize);
  }
});
function clampTerminalFontSize(fontSize) {
  return Math.max(6, Math.min(100, fontSize));
}
export {
  clampTerminalFontSize
};
