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
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { autorun } from "../../../../base/common/observable.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { mcpAccessConfig, McpAccessValue } from "../../../../platform/mcp/common/mcpManagement.js";
import { observableConfigValue } from "../../../../platform/observable/common/platformObservableUtils.js";
import { mcpDiscoveryRegistry } from "../common/discovery/mcpDiscovery.js";
let McpDiscovery = class extends Disposable {
  static {
    this.ID = "workbench.contrib.mcp.discovery";
  }
  constructor(instantiationService, configurationService) {
    super();
    const mcpAccessValue = observableConfigValue(mcpAccessConfig, McpAccessValue.All, configurationService);
    const store = this._register(new DisposableStore());
    this._register(autorun((reader) => {
      store.clear();
      const value = mcpAccessValue.read(reader);
      if (value === McpAccessValue.None) {
        return;
      }
      for (const descriptor of mcpDiscoveryRegistry.getAll()) {
        const mcpDiscovery = instantiationService.createInstance(descriptor);
        if (value === McpAccessValue.Registry && !mcpDiscovery.fromGallery) {
          mcpDiscovery.dispose();
          continue;
        }
        store.add(mcpDiscovery);
        mcpDiscovery.start();
      }
    }));
  }
};
McpDiscovery = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IConfigurationService)
], McpDiscovery);
export {
  McpDiscovery
};
