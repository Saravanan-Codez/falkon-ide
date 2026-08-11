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
import { localize } from "../../../../nls.js";
import {
  TUNNEL_HOST_CHANNEL,
  TUNNEL_HOST_LOG_ID
} from "../../../../platform/agentHost/common/tunnelAgentHost.js";
import { IAgentHostService } from "../../../../platform/agentHost/common/agentService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { ISharedProcessService } from "../../../../platform/ipc/electron-browser/services.js";
import { ILoggerService } from "../../../../platform/log/common/log.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { ProxyChannel } from "../../../../base/parts/ipc/common/ipc.js";
import { joinPath } from "../../../../base/common/resources.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IAuthenticationService } from "../../../services/authentication/common/authentication.js";
const CONFIGURATION_KEY_MICROSOFT_AUTH = "remote.tunnels.access.enableMicrosoftAuth";
const SHOW_TUNNEL_HOST_OUTPUT_ID = "sessions.tunnelHost.showOutput";
const RENAME_TUNNEL_ID = "sessions.tunnelHost.renameTunnel";
let TunnelHostService = class extends Disposable {
  constructor(sharedProcessService, _authenticationService, _productService, _agentHostService, _configurationService, loggerService, environmentService) {
    super();
    this._authenticationService = _authenticationService;
    this._productService = _productService;
    this._agentHostService = _agentHostService;
    this._configurationService = _configurationService;
    this._onDidChangeStatus = this._register(new Emitter());
    this.onDidChangeStatus = this._onDidChangeStatus.event;
    this._isSharing = false;
    this._isConnecting = false;
    this._logger = this._register(loggerService.createLogger(
      joinPath(environmentService.logsHome, `${TUNNEL_HOST_LOG_ID}.log`),
      { id: TUNNEL_HOST_LOG_ID, name: localize("tunnelHost.outputChannel", "Remote Connections") }
    ));
    this._mainService = ProxyChannel.toService(
      sharedProcessService.getChannel(TUNNEL_HOST_CHANNEL)
    );
    this._register(this._mainService.onDidChangeStatus((status) => {
      this._isSharing = status.active;
      this._sharingInfo = status.active ? status.info : void 0;
      this._onDidChangeStatus.fire();
    }));
    this._mainService.getStatus().then((status) => {
      this._isSharing = status.active;
      this._sharingInfo = status.active ? status.info : void 0;
      if (status.active) {
        this._onDidChangeStatus.fire();
      }
    });
  }
  get isSharing() {
    return this._isSharing;
  }
  get isConnecting() {
    return this._isConnecting;
  }
  get sharingInfo() {
    return this._sharingInfo;
  }
  async startSharing() {
    this._isConnecting = true;
    this._onDidChangeStatus.fire();
    try {
      const auth = await this._getToken(false);
      if (!auth) {
        this._logger.warn("No auth token available for tunnel hosting");
        throw new Error(localize("tunnelHost.noAuth", "No authentication token available. Please sign in and try again."));
      }
      this._logger.info("Starting tunnel hosting...");
      const socketInfo = await this._agentHostService.startWebSocketServer();
      const info = await this._mainService.startHosting(auth.token, auth.provider, socketInfo);
      this._isSharing = true;
      this._sharingInfo = info;
    } finally {
      this._isConnecting = false;
      this._onDidChangeStatus.fire();
    }
  }
  async stopSharing() {
    this._logger.info("Stopping tunnel hosting...");
    await this._mainService.stopHosting();
    this._isSharing = false;
    this._sharingInfo = void 0;
    this._onDidChangeStatus.fire();
  }
  _getEnabledProviders() {
    const microsoftEnabled = this._configurationService.getValue(CONFIGURATION_KEY_MICROSOFT_AUTH);
    return microsoftEnabled ? ["microsoft", "github"] : ["github"];
  }
  async _getToken(silent) {
    const enabledProviders = this._getEnabledProviders();
    if (this._lastAuthProvider && enabledProviders.includes(this._lastAuthProvider)) {
      const result = await this._getTokenForProvider(this._lastAuthProvider, silent);
      if (result) {
        return result;
      }
    }
    for (const provider of enabledProviders) {
      if (provider === this._lastAuthProvider) {
        continue;
      }
      const result = await this._getTokenForProvider(provider, true);
      if (result) {
        return result;
      }
    }
    if (!silent) {
      for (const provider of enabledProviders) {
        const result = await this._getTokenForProvider(provider, false);
        if (result) {
          return result;
        }
      }
    }
    return void 0;
  }
  _getScopesForProvider(provider) {
    const config = this._productService.tunnelApplicationConfig?.authenticationProviders;
    return config?.[provider]?.scopes ?? [];
  }
  async _getTokenForProvider(provider, silent) {
    const scopes = this._getScopesForProvider(provider);
    if (scopes.length === 0) {
      return void 0;
    }
    try {
      let sessions = await this._authenticationService.getSessions(provider, scopes, {}, true);
      if (sessions.length === 0) {
        const allSessions = await this._authenticationService.getSessions(provider, void 0, {}, true);
        const requestedSet = new Set(scopes);
        let bestSession;
        let bestExtra = Infinity;
        for (const session of allSessions) {
          const sessionScopes = new Set(session.scopes);
          let isSuperset = true;
          for (const scope of requestedSet) {
            if (!sessionScopes.has(scope)) {
              isSuperset = false;
              break;
            }
          }
          if (isSuperset) {
            const extra = sessionScopes.size - requestedSet.size;
            if (extra < bestExtra) {
              bestExtra = extra;
              bestSession = session;
            }
          }
        }
        if (bestSession) {
          sessions = [bestSession];
        }
      }
      if (sessions.length === 0 && !silent) {
        const session = await this._authenticationService.createSession(provider, scopes, { activateImmediate: true });
        sessions = [session];
      }
      if (sessions.length > 0) {
        const token = sessions[0].accessToken;
        if (token) {
          this._lastAuthProvider = provider;
          return { token, provider };
        }
      }
    } catch (err) {
      this._logger.debug(`Failed to get ${provider} token: ${err}`);
    }
    return void 0;
  }
};
TunnelHostService = __decorateClass([
  __decorateParam(0, ISharedProcessService),
  __decorateParam(1, IAuthenticationService),
  __decorateParam(2, IProductService),
  __decorateParam(3, IAgentHostService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, ILoggerService),
  __decorateParam(6, IEnvironmentService)
], TunnelHostService);
export {
  CONFIGURATION_KEY_MICROSOFT_AUTH,
  RENAME_TUNNEL_ID,
  SHOW_TUNNEL_HOST_OUTPUT_ID,
  TunnelHostService
};
