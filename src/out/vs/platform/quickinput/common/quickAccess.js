import { coalesce } from "../../../base/common/arrays.js";
import { toDisposable } from "../../../base/common/lifecycle.js";
import { Registry } from "../../registry/common/platform.js";
var DefaultQuickAccessFilterValue = /* @__PURE__ */ ((DefaultQuickAccessFilterValue2) => {
  DefaultQuickAccessFilterValue2[DefaultQuickAccessFilterValue2["PRESERVE"] = 0] = "PRESERVE";
  DefaultQuickAccessFilterValue2[DefaultQuickAccessFilterValue2["LAST"] = 1] = "LAST";
  return DefaultQuickAccessFilterValue2;
})(DefaultQuickAccessFilterValue || {});
const Extensions = {
  Quickaccess: "workbench.contributions.quickaccess"
};
class QuickAccessRegistry {
  constructor() {
    this.providers = [];
    this.defaultProvider = void 0;
  }
  registerQuickAccessProvider(provider) {
    if (provider.prefix.length === 0) {
      this.defaultProvider = provider;
    } else {
      this.providers.push(provider);
    }
    this.providers.sort((providerA, providerB) => providerB.prefix.length - providerA.prefix.length);
    return toDisposable(() => {
      this.providers.splice(this.providers.indexOf(provider), 1);
      if (this.defaultProvider === provider) {
        this.defaultProvider = void 0;
      }
    });
  }
  getQuickAccessProviders(contextKeyService) {
    return coalesce([this.defaultProvider, ...this.providers]).filter((provider) => !provider.when || contextKeyService.contextMatchesRules(provider.when));
  }
  getQuickAccessProvider(prefix, contextKeyService) {
    const result = prefix ? this.providers.find((provider) => prefix.startsWith(provider.prefix) && (!provider.when || contextKeyService.contextMatchesRules(provider.when))) : void 0;
    return result || this.defaultProvider;
  }
  clear() {
    const providers = [...this.providers];
    const defaultProvider = this.defaultProvider;
    this.providers = [];
    this.defaultProvider = void 0;
    return () => {
      this.providers = providers;
      this.defaultProvider = defaultProvider;
    };
  }
}
Registry.add(Extensions.Quickaccess, new QuickAccessRegistry());
export {
  DefaultQuickAccessFilterValue,
  Extensions,
  QuickAccessRegistry
};
