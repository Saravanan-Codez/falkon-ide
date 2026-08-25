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
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { autorun } from "../../../../base/common/observable.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IPluginInstallService } from "../common/plugins/pluginInstallService.js";
import { IPluginMarketplaceService } from "../common/plugins/pluginMarketplaceService.js";
let PluginAutoUpdate = class extends Disposable {
  constructor(_pluginMarketplaceService, _pluginInstallService, _logService) {
    super();
    this._pluginMarketplaceService = _pluginMarketplaceService;
    this._pluginInstallService = _pluginInstallService;
    this._logService = _logService;
    this._updateInFlight = false;
    this._register(autorun((reader) => {
      const marketplaceIds = this._pluginMarketplaceService.marketplacesWithUpdates.read(reader);
      if (marketplaceIds.size === 0) {
        return;
      }
      void this._triggerAutoUpdate(marketplaceIds);
    }));
  }
  static {
    this.ID = "workbench.contrib.pluginAutoUpdate";
  }
  async _triggerAutoUpdate(marketplaceIds) {
    if (this._updateInFlight) {
      return;
    }
    this._updateInFlight = true;
    try {
      await this._pluginInstallService.updateAllPlugins({ silent: true, automatic: true, marketplaceIds }, CancellationToken.None);
    } catch (err) {
      this._logService.error("[PluginAutoUpdate] Failed to auto-update plugins:", err);
    } finally {
      this._updateInFlight = false;
      this._pluginMarketplaceService.clearUpdatesAvailable(marketplaceIds);
    }
  }
};
PluginAutoUpdate = __decorateClass([
  __decorateParam(0, IPluginMarketplaceService),
  __decorateParam(1, IPluginInstallService),
  __decorateParam(2, ILogService)
], PluginAutoUpdate);
export {
  PluginAutoUpdate
};
