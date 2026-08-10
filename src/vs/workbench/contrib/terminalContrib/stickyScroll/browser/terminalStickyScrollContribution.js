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
import { Disposable, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { TerminalCapability } from "../../../../../platform/terminal/common/capabilities/capabilities.js";
import { TerminalInstance, TerminalInstanceColorProvider } from "../../../terminal/browser/terminalInstance.js";
import { TerminalStickyScrollSettingId } from "../common/terminalStickyScrollConfiguration.js";
import "./media/stickyScroll.css";
import { TerminalStickyScrollOverlay } from "./terminalStickyScrollOverlay.js";
let TerminalStickyScrollContribution = class extends Disposable {
  constructor(_ctx, _configurationService, _contextKeyService, _instantiationService, _keybindingService) {
    super();
    this._ctx = _ctx;
    this._configurationService = _configurationService;
    this._contextKeyService = _contextKeyService;
    this._instantiationService = _instantiationService;
    this._keybindingService = _keybindingService;
    this._overlay = this._register(new MutableDisposable());
    this._enableListeners = this._register(new MutableDisposable());
    this._disableListeners = this._register(new MutableDisposable());
    this._richCommandDetectionListeners = this._register(new MutableDisposable());
    this._register(Event.runAndSubscribe(this._configurationService.onDidChangeConfiguration, (e) => {
      if (!e || e.affectsConfiguration(TerminalStickyScrollSettingId.Enabled)) {
        this._refreshState();
      }
    }));
  }
  static {
    this.ID = "terminal.stickyScroll";
  }
  static get(instance) {
    return instance.getContribution(TerminalStickyScrollContribution.ID);
  }
  xtermReady(xterm) {
    this._xterm = xterm;
    this._refreshState();
  }
  xtermOpen(xterm) {
    this._refreshState();
  }
  hideLock() {
    this._overlay.value?.lockHide();
  }
  hideUnlock() {
    this._overlay.value?.unlockHide();
  }
  _refreshState() {
    if (this._overlay.value) {
      this._tryDisable();
    } else {
      this._tryEnable();
    }
    if (this._overlay.value) {
      this._enableListeners.clear();
      if (!this._disableListeners.value) {
        this._disableListeners.value = this._ctx.instance.capabilities.onDidRemoveCapability((e) => {
          if (e.id === TerminalCapability.CommandDetection) {
            this._refreshState();
          }
        });
      }
    } else {
      this._disableListeners.clear();
      if (!this._enableListeners.value) {
        this._enableListeners.value = this._ctx.instance.capabilities.onDidAddCapability((e) => {
          if (e.id === TerminalCapability.CommandDetection) {
            this._refreshState();
          }
        });
      }
    }
  }
  _tryEnable() {
    const capability = this._ctx.instance.capabilities.get(TerminalCapability.CommandDetection);
    if (this._shouldBeEnabled()) {
      const xtermCtorEventually = TerminalInstance.getXtermConstructor(this._keybindingService, this._contextKeyService);
      this._overlay.value = this._instantiationService.createInstance(
        TerminalStickyScrollOverlay,
        this._ctx.instance,
        this._xterm,
        this._instantiationService.createInstance(TerminalInstanceColorProvider, this._ctx.instance.targetRef),
        capability,
        xtermCtorEventually
      );
      this._richCommandDetectionListeners.clear();
    } else if (capability && !capability.hasRichCommandDetection) {
      this._richCommandDetectionListeners.value = capability.onSetRichCommandDetection(() => {
        this._refreshState();
      });
    } else {
      this._richCommandDetectionListeners.clear();
    }
  }
  _tryDisable() {
    if (!this._shouldBeEnabled()) {
      this._overlay.clear();
      this._richCommandDetectionListeners.clear();
    }
  }
  _shouldBeEnabled() {
    const capability = this._ctx.instance.capabilities.get(TerminalCapability.CommandDetection);
    const result = !!(this._configurationService.getValue(TerminalStickyScrollSettingId.Enabled) && capability && capability.hasRichCommandDetection && this._xterm?.raw?.element);
    return result;
  }
};
TerminalStickyScrollContribution = __decorateClass([
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IKeybindingService)
], TerminalStickyScrollContribution);
export {
  TerminalStickyScrollContribution
};
