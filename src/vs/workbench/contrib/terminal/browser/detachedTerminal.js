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
import * as dom from "../../../../base/browser/dom.js";
import { Delayer } from "../../../../base/common/async.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { MicrotaskDelay } from "../../../../base/common/symbols.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { TerminalCapabilityStore } from "../../../../platform/terminal/common/capabilities/terminalCapabilityStore.js";
import { TerminalExtensionsRegistry } from "./terminalExtensions.js";
import { TerminalWidgetManager } from "./widgets/widgetManager.js";
import { ProcessState } from "../common/terminal.js";
let DetachedTerminal = class extends Disposable {
  constructor(_xterm, options, instantiationService) {
    super();
    this._xterm = _xterm;
    this._widgets = this._register(new TerminalWidgetManager());
    this._contributions = /* @__PURE__ */ new Map();
    this._attachDisposables = this._register(new MutableDisposable());
    this.onData = this._xterm.raw.onData;
    const capabilities = options.capabilities ?? new TerminalCapabilityStore();
    this._register(capabilities);
    this.capabilities = capabilities;
    this._register(_xterm);
    const contributionDescs = TerminalExtensionsRegistry.getTerminalContributions();
    for (const desc of contributionDescs) {
      if (this._contributions.has(desc.id)) {
        onUnexpectedError(new Error(`Cannot have two terminal contributions with the same id ${desc.id}`));
        continue;
      }
      if (desc.canRunInDetachedTerminals === false) {
        continue;
      }
      let contribution;
      try {
        contribution = instantiationService.createInstance(desc.ctor, {
          instance: this,
          processManager: options.processInfo,
          widgetManager: this._widgets
        });
        this._contributions.set(desc.id, contribution);
        this._register(contribution);
      } catch (err) {
        onUnexpectedError(err);
      }
    }
    this._register(new Delayer(MicrotaskDelay)).trigger(() => {
      for (const contr of this._contributions.values()) {
        contr.xtermReady?.(this._xterm);
      }
    });
  }
  get xterm() {
    return this._xterm;
  }
  get selection() {
    return this._xterm && this.hasSelection() ? this._xterm.raw.getSelection() : void 0;
  }
  hasSelection() {
    return this._xterm.hasSelection();
  }
  clearSelection() {
    this._xterm.clearSelection();
  }
  focus(force) {
    if (force || !dom.getActiveWindow().getSelection()?.toString()) {
      this.xterm.focus();
    }
  }
  attachToElement(container, options) {
    this.domElement = container;
    const screenElement = this._xterm.attachToElement(container, options);
    this._widgets.attachToElement(screenElement);
    const attachStore = new DisposableStore();
    const scheduleFocus = () => {
      setTimeout(() => this.focus(true), 0);
    };
    attachStore.add(dom.addDisposableListener(container, dom.EventType.MOUSE_DOWN, scheduleFocus));
    this._attachDisposables.value = attachStore;
  }
  forceScrollbarVisibility() {
    this.domElement?.classList.add("force-scrollbar");
  }
  resetScrollbarVisibility() {
    this.domElement?.classList.remove("force-scrollbar");
  }
  getContribution(id) {
    return this._contributions.get(id);
  }
};
DetachedTerminal = __decorateClass([
  __decorateParam(2, IInstantiationService)
], DetachedTerminal);
class DetachedProcessInfo extends Disposable {
  constructor(initialValues) {
    super();
    this.processState = ProcessState.Running;
    this.ptyProcessReady = Promise.resolve();
    this.initialCwd = "";
    this.shouldPersist = false;
    this.hasWrittenData = false;
    this.hasChildProcesses = false;
    this.shellIntegrationNonce = "";
    Object.assign(this, initialValues);
    this.capabilities = this._register(new TerminalCapabilityStore());
  }
}
export {
  DetachedProcessInfo,
  DetachedTerminal
};
