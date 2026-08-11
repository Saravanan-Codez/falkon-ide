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
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { autorun } from "../../../../base/common/observable.js";
import { isWeb } from "../../../../base/common/platform.js";
import { IRemoteAgentHostService } from "../../../../platform/agentHost/common/remoteAgentHostService.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { isAgentHostProvider } from "../../../common/agentHostSessionsProvider.js";
import { ISessionsProvidersService } from "../../sessions/browser/sessionsProvidersService.js";
import { AgentHostFilterConnectionStatus, IAgentHostFilterService } from "../common/agentHostFilter.js";
const STORAGE_KEY = "sessions.agentHostFilter.selectedProviderId";
function mapStatus(s) {
  switch (s.kind) {
    case "connected":
      return AgentHostFilterConnectionStatus.Connected;
    case "connecting":
      return AgentHostFilterConnectionStatus.Connecting;
    case "disconnected":
    case "incompatible":
    default:
      return AgentHostFilterConnectionStatus.Disconnected;
  }
}
function isRemoteAgentHostProvider(provider) {
  if (!provider || typeof provider !== "object" || !("id" in provider)) {
    return false;
  }
  const p = provider;
  return isAgentHostProvider(p) && p.connectionStatus !== void 0 && typeof p.remoteAddress === "string";
}
let AgentHostFilterService = class extends Disposable {
  constructor(_sessionsProvidersService, _remoteAgentHostService, _storageService) {
    super();
    this._sessionsProvidersService = _sessionsProvidersService;
    this._remoteAgentHostService = _remoteAgentHostService;
    this._storageService = _storageService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._onDidChangeDiscovering = this._register(new Emitter());
    this.onDidChangeDiscovering = this._onDidChangeDiscovering.event;
    this._hosts = [];
    /**
     * Discovery handlers contributed by host providers (e.g. dev tunnels).
     * {@link rediscover} fans out to every handler and waits for them to
     * settle.
     */
    this._discoveryHandlers = /* @__PURE__ */ new Set();
    /**
     * Number of in-flight {@link rediscover} calls. {@link isDiscovering}
     * is `true` while this is non-zero. Tracked as a counter so concurrent
     * calls don't race a flag back to `false`.
     */
    this._discoveringCount = 0;
    /**
     * Subscriptions to the `connectionStatus` observable of every currently
     * registered remote provider. Rebuilt whenever the set of providers
     * changes so we always observe the live set.
     */
    this._providerWatchers = this._register(new DisposableStore());
    this._selectedProviderId = this._storageService.get(STORAGE_KEY, StorageScope.PROFILE, void 0);
    this._rewatchProviders();
    this._register(this._sessionsProvidersService.onDidChangeProviders(() => this._rewatchProviders()));
  }
  get selectedProviderId() {
    return this._selectedProviderId;
  }
  get hosts() {
    return this._hosts;
  }
  get isDiscovering() {
    return this._discoveringCount > 0;
  }
  async rediscover() {
    if (this._discoveryHandlers.size === 0) {
      return;
    }
    this._discoveringCount++;
    if (this._discoveringCount === 1) {
      this._onDidChangeDiscovering.fire();
    }
    try {
      await Promise.allSettled(
        [...this._discoveryHandlers].map((h) => h().catch(() => {
        }))
      );
    } finally {
      this._discoveringCount--;
      if (this._discoveringCount === 0) {
        this._onDidChangeDiscovering.fire();
      }
    }
  }
  registerDiscoveryHandler(handler) {
    this._discoveryHandlers.add(handler);
    return toDisposable(() => this._discoveryHandlers.delete(handler));
  }
  setSelectedProviderId(providerId) {
    if (!this._hosts.some((h) => h.providerId === providerId)) {
      return;
    }
    if (providerId === this._selectedProviderId) {
      return;
    }
    this._selectedProviderId = providerId;
    this._persist();
    this._onDidChange.fire();
  }
  reconnect(providerId) {
    const provider = this._sessionsProvidersService.getProvider(providerId);
    if (provider && isAgentHostProvider(provider) && provider.connect) {
      provider.connect().catch(() => {
      });
      return;
    }
    const host = this._hosts.find((h) => h.providerId === providerId);
    if (!host) {
      return;
    }
    this._remoteAgentHostService.reconnect(host.address);
  }
  disconnect(providerId) {
    const provider = this._sessionsProvidersService.getProvider(providerId);
    if (provider && isAgentHostProvider(provider) && provider.disconnect) {
      provider.disconnect().catch(() => {
      });
    }
  }
  _validate(providerId) {
    if (providerId !== void 0 && this._hosts.some((h) => h.providerId === providerId)) {
      return providerId;
    }
    return this._hosts.length > 0 ? this._hosts[0].providerId : void 0;
  }
  /**
   * Subscribe to the current set of remote providers so that host list
   * updates (registration/unregistration and status changes) are surfaced
   * via {@link onDidChange}. One `autorun` reads every provider's
   * `connectionStatus` observable and recomputes the host list.
   */
  _rewatchProviders() {
    this._providerWatchers.clear();
    const providers = this._sessionsProvidersService.getProviders().filter(isRemoteAgentHostProvider);
    this._providerWatchers.add(autorun((reader) => {
      const hosts = providers.map((provider) => ({
        providerId: provider.id,
        label: provider.label,
        address: provider.remoteAddress,
        status: mapStatus(provider.connectionStatus.read(reader))
      })).sort((a, b) => a.label.localeCompare(b.label));
      this._applyHosts(hosts);
    }));
  }
  _applyHosts(hosts) {
    const changed = hosts.length !== this._hosts.length || hosts.some((h, i) => h.providerId !== this._hosts[i].providerId || h.label !== this._hosts[i].label || h.address !== this._hosts[i].address || h.status !== this._hosts[i].status);
    this._hosts = hosts;
    const validated = isWeb ? this._validate(this._selectedProviderId) : void 0;
    const selectionChanged = validated !== this._selectedProviderId;
    if (selectionChanged) {
      this._selectedProviderId = validated;
      this._persist();
    }
    if (changed || selectionChanged) {
      this._onDidChange.fire();
    }
  }
  _persist() {
    if (this._selectedProviderId === void 0) {
      this._storageService.remove(STORAGE_KEY, StorageScope.PROFILE);
    } else {
      this._storageService.store(STORAGE_KEY, this._selectedProviderId, StorageScope.PROFILE, StorageTarget.USER);
    }
  }
};
AgentHostFilterService = __decorateClass([
  __decorateParam(0, ISessionsProvidersService),
  __decorateParam(1, IRemoteAgentHostService),
  __decorateParam(2, IStorageService)
], AgentHostFilterService);
registerSingleton(IAgentHostFilterService, AgentHostFilterService, InstantiationType.Delayed);
export {
  AgentHostFilterService
};
