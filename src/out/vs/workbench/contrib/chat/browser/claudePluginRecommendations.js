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
import { localize } from "../../../../nls.js";
import { INotificationService, NeverShowAgainScope, Severity } from "../../../../platform/notification/common/notification.js";
import { IExtensionsWorkbenchService } from "../../extensions/common/extensions.js";
import { IChatService } from "../common/chatService/chatService.js";
import { IPluginMarketplaceService } from "../common/plugins/pluginMarketplaceService.js";
let AgentPluginRecommendations = class extends Disposable {
  constructor(_chatService, _pluginMarketplaceService, _notificationService, _extensionsWorkbenchService) {
    super();
    this._chatService = _chatService;
    this._pluginMarketplaceService = _pluginMarketplaceService;
    this._notificationService = _notificationService;
    this._extensionsWorkbenchService = _extensionsWorkbenchService;
    this._hasNotified = false;
    this._register(this._chatService.onDidSubmitRequest(() => {
      if (!this._hasNotified) {
        this._hasNotified = true;
        this._checkForRecommendedPlugins();
      }
    }));
  }
  static {
    this.ID = "workbench.contrib.agentPluginRecommendations";
  }
  async _checkForRecommendedPlugins() {
    const recommended = this._pluginMarketplaceService.recommendedPlugins.get();
    if (recommended.size === 0) {
      return;
    }
    const installedKeys = /* @__PURE__ */ new Set();
    for (const entry of this._pluginMarketplaceService.installedPlugins.get()) {
      const key = `${entry.plugin.name}@${entry.plugin.marketplace}`;
      installedKeys.add(key);
    }
    let fetched = this._pluginMarketplaceService.lastFetchedPlugins.get();
    if (fetched.length === 0) {
      try {
        fetched = await this._pluginMarketplaceService.fetchMarketplacePlugins(CancellationToken.None);
      } catch {
        return;
      }
    }
    const knownKeys = /* @__PURE__ */ new Set();
    for (const plugin of fetched) {
      knownKeys.add(`${plugin.name}@${plugin.marketplace}`);
    }
    let uninstalledCount = 0;
    for (const key of recommended) {
      if (!installedKeys.has(key) && knownKeys.has(key)) {
        uninstalledCount++;
      }
    }
    if (uninstalledCount === 0) {
      return;
    }
    this._notificationService.prompt(
      Severity.Info,
      uninstalledCount === 1 ? localize("agentPluginRecommendation.one", "This workspace recommends 1 agent plugin.") : localize("agentPluginRecommendation.many", "This workspace recommends {0} agent plugins.", uninstalledCount),
      [{
        label: localize("showPlugins", "Show Plugins"),
        run: () => {
          this._extensionsWorkbenchService.openSearch("@agentPlugins @recommended");
        }
      }],
      {
        neverShowAgain: {
          id: "agentPluginRecommendations.dismissed",
          scope: NeverShowAgainScope.WORKSPACE,
          isSecondary: true
        }
      }
    );
  }
};
AgentPluginRecommendations = __decorateClass([
  __decorateParam(0, IChatService),
  __decorateParam(1, IPluginMarketplaceService),
  __decorateParam(2, INotificationService),
  __decorateParam(3, IExtensionsWorkbenchService)
], AgentPluginRecommendations);
export {
  AgentPluginRecommendations
};
