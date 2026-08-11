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
import { Disposable, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { registerTerminalContribution } from "../../../terminal/browser/terminalExtensions.js";
import { timeout } from "../../../../../base/common/async.js";
import { TerminalResizeDimensionsOverlay } from "./terminalResizeDimensionsOverlay.js";
import { TerminalResizeDimensionsOverlaySettingId } from "../common/terminalResizeDimensionsOverlayConfiguration.js";
let TerminalResizeDimensionsOverlayContribution = class extends Disposable {
  constructor(_ctx, _configurationService) {
    super();
    this._ctx = _ctx;
    this._configurationService = _configurationService;
    this._overlay = this._register(new MutableDisposable());
  }
  static {
    this.ID = "terminal.resizeDimensionsOverlay";
  }
  xtermOpen(xterm) {
    this._ctx.processManager.ptyProcessReady.then(() => {
      timeout(1e3).then(() => {
        if (this._store.isDisposed) {
          return;
        }
        this._updateOverlay(xterm);
        this._register(this._configurationService.onDidChangeConfiguration((e) => {
          if (e.affectsConfiguration(TerminalResizeDimensionsOverlaySettingId.Enabled)) {
            this._updateOverlay(xterm);
          }
        }));
      });
    });
  }
  _updateOverlay(xterm) {
    const enabled = this._configurationService.getValue(TerminalResizeDimensionsOverlaySettingId.Enabled) !== false;
    if (enabled) {
      if (!this._overlay.value) {
        this._overlay.value = new TerminalResizeDimensionsOverlay(this._ctx.instance.domElement, xterm);
      }
    } else {
      this._overlay.clear();
    }
  }
};
TerminalResizeDimensionsOverlayContribution = __decorateClass([
  __decorateParam(1, IConfigurationService)
], TerminalResizeDimensionsOverlayContribution);
registerTerminalContribution(TerminalResizeDimensionsOverlayContribution.ID, TerminalResizeDimensionsOverlayContribution);
