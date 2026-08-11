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
import { DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { registerTerminalContribution } from "../../../terminal/browser/terminalExtensions.js";
import { TERMINAL_CONFIG_SECTION } from "../../../terminal/common/terminal.js";
import { TerminalTypeAheadSettingId } from "../common/terminalTypeAheadConfiguration.js";
import { TypeAheadAddon } from "./terminalTypeAheadAddon.js";
let TerminalTypeAheadContribution = class extends DisposableStore {
  constructor(_ctx, _configurationService, _instantiationService) {
    super();
    this._ctx = _ctx;
    this._configurationService = _configurationService;
    this._instantiationService = _instantiationService;
    this.add(toDisposable(() => this._addon?.dispose()));
  }
  static {
    this.ID = "terminal.typeAhead";
  }
  static get(instance) {
    return instance.getContribution(TerminalTypeAheadContribution.ID);
  }
  xtermReady(xterm) {
    this._loadTypeAheadAddon(xterm.raw);
    this.add(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(TerminalTypeAheadSettingId.LocalEchoEnabled)) {
        this._loadTypeAheadAddon(xterm.raw);
      }
    }));
    this.add(this._ctx.processManager.onProcessReady(() => {
      this._addon?.reset();
    }));
  }
  _loadTypeAheadAddon(xterm) {
    const enabled = this._configurationService.getValue(TERMINAL_CONFIG_SECTION).localEchoEnabled;
    const isRemote = !!this._ctx.processManager.remoteAuthority;
    if (enabled === "off" || enabled === "auto" && !isRemote) {
      this._addon?.dispose();
      this._addon = void 0;
      return;
    }
    if (this._addon) {
      return;
    }
    if (enabled === "on" || enabled === "auto" && isRemote) {
      this._addon = this._instantiationService.createInstance(TypeAheadAddon, this._ctx.processManager);
      xterm.loadAddon(this._addon);
    }
  }
};
TerminalTypeAheadContribution = __decorateClass([
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IInstantiationService)
], TerminalTypeAheadContribution);
registerTerminalContribution(TerminalTypeAheadContribution.ID, TerminalTypeAheadContribution);
