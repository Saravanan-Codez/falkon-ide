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
import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { LRUCache } from "../../../base/common/map.js";
import { localize } from "../../../nls.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { extractDomainFromUri, isDomainAllowed } from "./domainMatcher.js";
import { AgentNetworkDomainSettingId } from "./settings.js";
const IAgentNetworkFilterService = createDecorator("agentNetworkFilterService");
let AgentNetworkFilterService = class extends Disposable {
  constructor(configurationService) {
    super();
    this.configurationService = configurationService;
    this.networkFilterEnabled = false;
    this.allowedPatterns = [];
    this.deniedPatterns = [];
    this.domainCache = new LRUCache(100);
    this.onDidChangeEmitter = this._register(new Emitter());
    this.onDidChange = this.onDidChangeEmitter.event;
    this.readConfiguration();
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(AgentNetworkDomainSettingId.NetworkFilter) || e.affectsConfiguration(AgentNetworkDomainSettingId.AllowedNetworkDomains) || e.affectsConfiguration(AgentNetworkDomainSettingId.DeniedNetworkDomains)) {
        this.readConfiguration();
        this.onDidChangeEmitter.fire();
      }
    }));
  }
  readConfiguration() {
    const networkFilterEnabled = this.configurationService.getValue(AgentNetworkDomainSettingId.NetworkFilter) ?? false;
    this.networkFilterEnabled = networkFilterEnabled;
    this.allowedPatterns = this.configurationService.getValue(AgentNetworkDomainSettingId.AllowedNetworkDomains) ?? [];
    this.deniedPatterns = this.configurationService.getValue(AgentNetworkDomainSettingId.DeniedNetworkDomains) ?? [];
    this.domainCache.clear();
  }
  isUriAllowed(uri) {
    if (!this.shouldFilter()) {
      return true;
    }
    if (uri.scheme === "file" || !uri.authority) {
      return true;
    }
    const domain = extractDomainFromUri(uri);
    if (!domain) {
      return true;
    }
    let result = this.domainCache.get(domain);
    if (result === void 0) {
      result = isDomainAllowed(domain, this.allowedPatterns, this.deniedPatterns);
      this.domainCache.set(domain, result);
    }
    return result;
  }
  // Determines whether network filtering should be applied for a given request
  // based on the global network filter setting.
  shouldFilter() {
    return this.networkFilterEnabled;
  }
  formatError(uri) {
    const domain = extractDomainFromUri(uri);
    return localize(
      "networkFilter.blockedByPolicy",
      "Access to {0} is blocked by network domain policy (see `{1}` and `{2}` settings).",
      domain ?? uri.authority,
      AgentNetworkDomainSettingId.AllowedNetworkDomains,
      AgentNetworkDomainSettingId.DeniedNetworkDomains
    );
  }
};
AgentNetworkFilterService = __decorateClass([
  __decorateParam(0, IConfigurationService)
], AgentNetworkFilterService);
export {
  AgentNetworkFilterService,
  IAgentNetworkFilterService
};
