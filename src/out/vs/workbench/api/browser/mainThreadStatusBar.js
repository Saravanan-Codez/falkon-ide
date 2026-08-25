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
import { MainContext, ExtHostContext } from "../common/extHost.protocol.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { DisposableMap, toDisposable, Disposable } from "../../../base/common/lifecycle.js";
import { IExtensionStatusBarItemService, StatusBarUpdateKind } from "./statusBarExtensionPoint.js";
import { StatusbarAlignment } from "../../services/statusbar/browser/statusbar.js";
let MainThreadStatusBar = class extends Disposable {
  constructor(extHostContext, statusbarService) {
    super();
    this.statusbarService = statusbarService;
    this._entryDisposables = this._register(new DisposableMap());
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostStatusBar);
    const entries = [];
    for (const [entryId, item] of statusbarService.getEntries()) {
      entries.push(asDto(entryId, item));
    }
    this._proxy.$acceptStaticEntries(entries);
    this._register(statusbarService.onDidChange((e) => {
      if (e.added) {
        this._proxy.$acceptStaticEntries([asDto(e.added[0], e.added[1])]);
      }
    }));
    function asDto(entryId, item) {
      return {
        entryId,
        name: item.entry.name,
        text: item.entry.text,
        tooltip: item.entry.tooltip,
        command: typeof item.entry.command === "string" ? item.entry.command : typeof item.entry.command === "object" ? item.entry.command.id : void 0,
        priority: item.priority,
        alignLeft: item.alignment === StatusbarAlignment.LEFT,
        accessibilityInformation: item.entry.ariaLabel ? { label: item.entry.ariaLabel, role: item.entry.role } : void 0
      };
    }
  }
  $setEntry(entryId, id, extensionId, name, text, tooltip, hasTooltipProvider, command, color, backgroundColor, alignLeft, priority, accessibilityInformation) {
    const tooltipOrTooltipProvider = hasTooltipProvider ? {
      markdown: (cancellation) => {
        return this._proxy.$provideTooltip(entryId, cancellation);
      },
      markdownNotSupportedFallback: void 0
    } : tooltip;
    const kind = this.statusbarService.setOrUpdateEntry(entryId, id, extensionId, name, text, tooltipOrTooltipProvider, command, color, backgroundColor, alignLeft, priority, accessibilityInformation);
    if (kind === StatusBarUpdateKind.DidDefine) {
      const disposable = toDisposable(() => this.statusbarService.unsetEntry(entryId));
      this._entryDisposables.set(entryId, disposable);
    }
  }
  $disposeEntry(entryId) {
    this._entryDisposables.deleteAndDispose(entryId);
  }
};
MainThreadStatusBar = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadStatusBar),
  __decorateParam(1, IExtensionStatusBarItemService)
], MainThreadStatusBar);
export {
  MainThreadStatusBar
};
