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
import { DeferredPromise } from "../../../base/common/async.js";
import { CancellationTokenSource } from "../../../base/common/cancellation.js";
import { Event } from "../../../base/common/event.js";
import { Disposable, DisposableStore, isDisposable, toDisposable } from "../../../base/common/lifecycle.js";
import { IContextKeyService } from "../../contextkey/common/contextkey.js";
import { IInstantiationService } from "../../instantiation/common/instantiation.js";
import { DefaultQuickAccessFilterValue, Extensions } from "../common/quickAccess.js";
import { IQuickInputService, ItemActivation } from "../common/quickInput.js";
import { Registry } from "../../registry/common/platform.js";
let QuickAccessController = class extends Disposable {
  constructor(quickInputService, instantiationService, contextKeyService) {
    super();
    this.quickInputService = quickInputService;
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.registry = Registry.as(Extensions.Quickaccess);
    this.mapProviderToDescriptor = /* @__PURE__ */ new Map();
    this.lastAcceptedPickerValues = /* @__PURE__ */ new Map();
    this.visibleQuickAccess = void 0;
    this._register(toDisposable(() => {
      for (const provider of this.mapProviderToDescriptor.values()) {
        if (isDisposable(provider)) {
          provider.dispose();
        }
      }
      this.visibleQuickAccess?.picker.dispose();
    }));
  }
  pick(value = "", options) {
    return this.doShowOrPick(value, true, options);
  }
  show(value = "", options) {
    this.doShowOrPick(value, false, options);
  }
  doShowOrPick(value, pick, options) {
    const [provider, descriptor] = this.getOrInstantiateProvider(value, options?.enabledProviderPrefixes);
    const visibleQuickAccess = this.visibleQuickAccess;
    const visibleDescriptor = visibleQuickAccess?.descriptor;
    if (visibleQuickAccess && descriptor && visibleDescriptor === descriptor) {
      if (value !== descriptor.prefix && !options?.preserveValue) {
        visibleQuickAccess.picker.value = value;
      }
      this.adjustValueSelection(visibleQuickAccess.picker, descriptor, options);
      return;
    }
    if (descriptor && !options?.preserveValue) {
      let newValue = void 0;
      if (visibleQuickAccess && visibleDescriptor && visibleDescriptor !== descriptor) {
        const newValueCandidateWithoutPrefix = visibleQuickAccess.value.substr(visibleDescriptor.prefix.length);
        if (newValueCandidateWithoutPrefix) {
          newValue = `${descriptor.prefix}${newValueCandidateWithoutPrefix}`;
        }
      }
      if (!newValue) {
        const defaultFilterValue = provider?.defaultFilterValue;
        if (defaultFilterValue === DefaultQuickAccessFilterValue.LAST) {
          newValue = this.lastAcceptedPickerValues.get(descriptor);
        } else if (typeof defaultFilterValue === "string") {
          newValue = `${descriptor.prefix}${defaultFilterValue}`;
        }
      }
      if (typeof newValue === "string") {
        value = newValue;
      }
    }
    const visibleSelection = visibleQuickAccess?.picker?.valueSelection;
    const visibleValue = visibleQuickAccess?.picker?.value;
    const disposables = new DisposableStore();
    const picker = disposables.add(this.quickInputService.createQuickPick({ useSeparators: true }));
    picker.value = value;
    this.adjustValueSelection(picker, descriptor, options);
    picker.placeholder = options?.placeholder ?? descriptor?.placeholder;
    picker.quickNavigate = options?.quickNavigateConfiguration;
    picker.hideInput = !!picker.quickNavigate && !visibleQuickAccess;
    if (typeof options?.itemActivation === "number" || options?.quickNavigateConfiguration) {
      picker.itemActivation = options?.itemActivation ?? ItemActivation.SECOND;
    }
    picker.contextKey = descriptor?.contextKey;
    picker.filterValue = (value2) => value2.substring(descriptor ? descriptor.prefix.length : 0);
    let pickPromise = void 0;
    if (pick) {
      pickPromise = new DeferredPromise();
      disposables.add(Event.once(picker.onWillAccept)((e) => {
        e.veto();
        picker.hide();
      }));
    }
    disposables.add(this.registerPickerListeners(picker, provider, descriptor, value, options));
    const cts = disposables.add(new CancellationTokenSource());
    if (provider) {
      disposables.add(provider.provide(picker, cts.token, options?.providerOptions));
    }
    Event.once(picker.onDidHide)(() => {
      if (picker.selectedItems.length === 0) {
        cts.cancel();
      }
      disposables.dispose();
      pickPromise?.complete(picker.selectedItems.slice(0));
    });
    picker.show();
    if (visibleSelection && visibleValue === value) {
      picker.valueSelection = visibleSelection;
    }
    if (pick) {
      return pickPromise?.p;
    }
  }
  adjustValueSelection(picker, descriptor, options) {
    let valueSelection;
    if (options?.preserveValue) {
      valueSelection = [picker.value.length, picker.value.length];
    } else {
      valueSelection = [descriptor?.prefix.length ?? 0, picker.value.length];
    }
    picker.valueSelection = valueSelection;
  }
  registerPickerListeners(picker, provider, descriptor, value, options) {
    const disposables = new DisposableStore();
    const visibleQuickAccess = this.visibleQuickAccess = { picker, descriptor, value };
    disposables.add(toDisposable(() => {
      if (visibleQuickAccess === this.visibleQuickAccess) {
        this.visibleQuickAccess = void 0;
      }
    }));
    disposables.add(picker.onDidChangeValue((value2) => {
      const [providerForValue] = this.getOrInstantiateProvider(value2, options?.enabledProviderPrefixes);
      if (providerForValue !== provider) {
        this.show(value2, {
          enabledProviderPrefixes: options?.enabledProviderPrefixes,
          // do not rewrite value from user typing!
          preserveValue: true,
          // persist the value of the providerOptions from the original showing
          providerOptions: options?.providerOptions
        });
      } else {
        visibleQuickAccess.value = value2;
      }
    }));
    if (descriptor) {
      disposables.add(picker.onDidAccept(() => {
        this.lastAcceptedPickerValues.set(descriptor, picker.value);
      }));
    }
    return disposables;
  }
  getOrInstantiateProvider(value, enabledProviderPrefixes) {
    const providerDescriptor = this.registry.getQuickAccessProvider(value, this.contextKeyService);
    if (!providerDescriptor || enabledProviderPrefixes && !enabledProviderPrefixes?.includes(providerDescriptor.prefix)) {
      return [void 0, void 0];
    }
    let provider = this.mapProviderToDescriptor.get(providerDescriptor);
    if (!provider) {
      provider = this.instantiationService.createInstance(providerDescriptor.ctor);
      this.mapProviderToDescriptor.set(providerDescriptor, provider);
    }
    return [provider, providerDescriptor];
  }
};
QuickAccessController = __decorateClass([
  __decorateParam(0, IQuickInputService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IContextKeyService)
], QuickAccessController);
export {
  QuickAccessController
};
