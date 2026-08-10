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
import { distinct } from "../../../../base/common/arrays.js";
import { Barrier, RunOnceScheduler, ThrottledDelayer, timeout } from "../../../../base/common/async.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { getErrorMessage } from "../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { equals } from "../../../../base/common/objects.js";
import { isWeb } from "../../../../base/common/platform.js";
import { isString, isUndefined } from "../../../../base/common/types.js";
import { localize2 } from "../../../../nls.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IDefaultAccountService } from "../../../../platform/defaultAccount/common/defaultAccount.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { asJson, IRequestService, isClientError, isSuccess, readHeader, retryAfterFromHeaders } from "../../../../platform/request/common/request.js";
import { INativeManagedSettingsService, shouldForceRemoteSettingsRefresh } from "../../../../platform/policy/common/copilotManagedSettings.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import { IAuthenticationExtensionsService, IAuthenticationService } from "../../authentication/common/authentication.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { IExtensionService } from "../../extensions/common/extensions.js";
import { IHostService } from "../../host/browser/host.js";
import { adaptManagedSettings } from "./managedSettings.js";
const DEFAULT_ACCOUNT_SIGN_IN_COMMAND = "workbench.actions.accounts.signIn";
var DefaultAccountStatus = /* @__PURE__ */ ((DefaultAccountStatus2) => {
  DefaultAccountStatus2["Uninitialized"] = "uninitialized";
  DefaultAccountStatus2["Unavailable"] = "unavailable";
  DefaultAccountStatus2["Available"] = "available";
  return DefaultAccountStatus2;
})(DefaultAccountStatus || {});
const CONTEXT_DEFAULT_ACCOUNT_STATE = new RawContextKey("defaultAccountStatus", "uninitialized" /* Uninitialized */);
const CACHED_POLICY_DATA_KEY = "defaultAccount.cachedPolicyData";
const ACCOUNT_DATA_POLL_INTERVAL_MS = 60 * 60 * 1e3;
const MANAGED_SETTINGS_REQUEST_TIMEOUT_MS = 5e3;
function toDefaultAccountConfig(defaultChatAgent) {
  return {
    preferredExtensions: [
      defaultChatAgent.chatExtensionId,
      defaultChatAgent.extensionId
    ],
    authenticationProvider: {
      default: {
        id: defaultChatAgent.provider.default.id,
        name: defaultChatAgent.provider.default.name
      },
      enterprise: {
        id: defaultChatAgent.provider.enterprise.id,
        name: defaultChatAgent.provider.enterprise.name
      },
      enterpriseProviderConfig: `${defaultChatAgent.completionsAdvancedSetting}.authProvider`,
      enterpriseProviderUriSetting: defaultChatAgent.providerUriSetting,
      scopes: defaultChatAgent.providerScopes
    },
    entitlementUrl: defaultChatAgent.entitlementUrl,
    tokenEntitlementUrl: defaultChatAgent.tokenEntitlementUrl,
    mcpRegistryDataUrl: defaultChatAgent.mcpRegistryDataUrl,
    managedSettingsUrl: defaultChatAgent.managedSettingsUrl
  };
}
let DefaultAccountService = class extends Disposable {
  constructor(productService) {
    super();
    this.defaultAccount = null;
    this.initBarrier = new Barrier();
    this._onDidChangeDefaultAccount = this._register(new Emitter());
    this.onDidChangeDefaultAccount = this._onDidChangeDefaultAccount.event;
    this._onDidChangePolicyData = this._register(new Emitter());
    this.onDidChangePolicyData = this._onDidChangePolicyData.event;
    this._onDidChangeCopilotTokenInfo = this._register(new Emitter());
    this.onDidChangeCopilotTokenInfo = this._onDidChangeCopilotTokenInfo.event;
    this.defaultAccountProvider = null;
    this.defaultAccountConfig = toDefaultAccountConfig(productService.defaultChatAgent);
  }
  get currentDefaultAccount() {
    return this.defaultAccount;
  }
  get policyData() {
    return this.defaultAccountProvider?.policyData ?? null;
  }
  get copilotTokenInfo() {
    return this.defaultAccountProvider?.copilotTokenInfo ?? null;
  }
  get managedSettingsFetchStatus() {
    return this.defaultAccountProvider?.managedSettingsFetchStatus ?? null;
  }
  get managedSettingsFetchedAt() {
    return this.defaultAccountProvider?.managedSettingsFetchedAt ?? null;
  }
  get managedSettingsRawResponse() {
    return this.defaultAccountProvider?.managedSettingsRawResponse ?? null;
  }
  async getDefaultAccount() {
    await this.initBarrier.wait();
    return this.defaultAccount;
  }
  getDefaultAccountAuthenticationProvider() {
    if (this.defaultAccountProvider) {
      return this.defaultAccountProvider.getDefaultAccountAuthenticationProvider();
    }
    return {
      ...this.defaultAccountConfig.authenticationProvider.default,
      enterprise: false
    };
  }
  setDefaultAccountProvider(provider) {
    if (this.defaultAccountProvider) {
      throw new Error("Default account provider is already set");
    }
    this.defaultAccountProvider = provider;
    if (this.defaultAccountProvider.policyData) {
      this._onDidChangePolicyData.fire(this.defaultAccountProvider.policyData);
    }
    provider.refresh().then((account) => {
      this.defaultAccount = account;
    }).finally(() => {
      this.initBarrier.open();
      this._register(provider.onDidChangeDefaultAccount((account) => this.setDefaultAccount(account)));
      this._register(provider.onDidChangePolicyData((policyData) => this._onDidChangePolicyData.fire(policyData)));
      this._register(provider.onDidChangeCopilotTokenInfo((tokenInfo) => this._onDidChangeCopilotTokenInfo.fire(tokenInfo)));
    });
  }
  async refresh(options) {
    await this.initBarrier.wait();
    const account = await this.defaultAccountProvider?.refresh(options);
    this.setDefaultAccount(account ?? null);
    return this.defaultAccount;
  }
  async signIn(options) {
    await this.initBarrier.wait();
    return this.defaultAccountProvider?.signIn(options) ?? null;
  }
  async signOut() {
    await this.initBarrier.wait();
    await this.defaultAccountProvider?.signOut();
  }
  resolveGitHubUrl(path) {
    if (this.defaultAccountProvider) {
      return this.defaultAccountProvider.resolveGitHubUrl(path);
    }
    return `https://github.com/${path}`;
  }
  setDefaultAccount(account) {
    if (equals(this.defaultAccount, account)) {
      return;
    }
    this.defaultAccount = account;
    this._onDidChangeDefaultAccount.fire(this.defaultAccount);
  }
};
DefaultAccountService = __decorateClass([
  __decorateParam(0, IProductService)
], DefaultAccountService);
let DefaultAccountProvider = class extends Disposable {
  constructor(defaultAccountConfig, configurationService, authenticationService, authenticationExtensionsService, telemetryService, extensionService, requestService, logService, environmentService, contextKeyService, storageService, hostService, commandService, nativeManagedSettingsService) {
    super();
    this.defaultAccountConfig = defaultAccountConfig;
    this.configurationService = configurationService;
    this.authenticationService = authenticationService;
    this.authenticationExtensionsService = authenticationExtensionsService;
    this.telemetryService = telemetryService;
    this.extensionService = extensionService;
    this.requestService = requestService;
    this.logService = logService;
    this.environmentService = environmentService;
    this.storageService = storageService;
    this.hostService = hostService;
    this.commandService = commandService;
    this.nativeManagedSettingsService = nativeManagedSettingsService;
    this._defaultAccount = null;
    this._policyData = null;
    this._copilotTokenInfo = null;
    this._managedSettingsFetchStatus = null;
    this._managedSettingsRawResponse = null;
    this._onDidChangeDefaultAccount = this._register(new Emitter());
    this.onDidChangeDefaultAccount = this._onDidChangeDefaultAccount.event;
    this._onDidChangePolicyData = this._register(new Emitter());
    this.onDidChangePolicyData = this._onDidChangePolicyData.event;
    this._onDidChangeCopilotTokenInfo = this._register(new Emitter());
    this.onDidChangeCopilotTokenInfo = this._onDidChangeCopilotTokenInfo.event;
    this.initialized = false;
    this.updateThrottler = this._register(new ThrottledDelayer(100));
    this.accountDataPollScheduler = this._register(new RunOnceScheduler(() => this.refetchDefaultAccount(), ACCOUNT_DATA_POLL_INTERVAL_MS));
    this.managedSettingsFetchAttemptedAccounts = /* @__PURE__ */ new Set();
    this._rateLimitBackoffUntil = 0;
    this.accountStatusContext = CONTEXT_DEFAULT_ACCOUNT_STATE.bindTo(contextKeyService);
    const cachedAccountData = this.getCachedAccountData();
    this._policyData = cachedAccountData?.accountPolicyData ?? null;
    this._copilotTokenInfo = cachedAccountData?.copilotTokenInfo ?? null;
    this.initPromise = this.init().finally(() => {
      this.telemetryService.publicLog2("defaultaccount:status", { status: this.defaultAccount ? "available" : "unavailable", initial: true });
      this.initialized = true;
    });
  }
  get defaultAccount() {
    return this._defaultAccount?.defaultAccount ?? null;
  }
  get policyData() {
    return this._policyData?.policyData ?? null;
  }
  get copilotTokenInfo() {
    return this._copilotTokenInfo;
  }
  get managedSettingsFetchStatus() {
    return this._managedSettingsFetchStatus;
  }
  get managedSettingsFetchedAt() {
    return this._policyData?.managedSettingsFetchedAt ?? null;
  }
  get managedSettingsRawResponse() {
    return this._managedSettingsRawResponse;
  }
  getCachedAccountData() {
    const cached = this.storageService.get(CACHED_POLICY_DATA_KEY, StorageScope.APPLICATION);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const { accountId, policyData, tokenEntitlementsFetchedAt, mcpRegistryDataFetchedAt, copilotTokenInfo } = parsed;
        if (accountId && policyData) {
          this.logService.debug("[DefaultAccount] Initializing with cached policy data (migrating old format)");
          const result = { accountPolicyData: { accountId, policyData, tokenEntitlementsFetchedAt, mcpRegistryDataFetchedAt }, copilotTokenInfo };
          this.storageService.store(CACHED_POLICY_DATA_KEY, JSON.stringify(result), StorageScope.APPLICATION, StorageTarget.MACHINE);
          return result;
        }
        const { accountPolicyData, copilotTokenInfo: wrappedCopilotTokenInfo } = parsed;
        if (accountPolicyData?.accountId && accountPolicyData?.policyData) {
          this.logService.debug("[DefaultAccount] Initializing with cached policy data");
          return { accountPolicyData, copilotTokenInfo: wrappedCopilotTokenInfo };
        }
      } catch (error) {
        this.logService.error("[DefaultAccount] Failed to parse cached policy data", getErrorMessage(error));
      }
    }
    return null;
  }
  async init() {
    if (isWeb && !this.environmentService.remoteAuthority && !this.environmentService.isSessionsWindow) {
      this.logService.debug("[DefaultAccount] Running in web without remote, skipping initialization");
      return;
    }
    await this.whenDefaultAccountAuthenticationProviderAvailable();
    this.logService.debug("[DefaultAccount] Starting initialization");
    await this.doUpdateDefaultAccount();
    this.logService.debug("[DefaultAccount] Initialization complete");
    this._register(this.onDidChangeDefaultAccount((account) => {
      this.telemetryService.publicLog2("defaultaccount:status", { status: account ? "available" : "unavailable", initial: false });
    }));
    this._register(this.authenticationService.onDidChangeSessions((e) => {
      const defaultAccountProvider = this.getDefaultAccountAuthenticationProvider();
      if (e.providerId !== defaultAccountProvider.id) {
        return;
      }
      if (this.defaultAccount && e.event.removed?.some((session) => session.id === this.defaultAccount?.sessionId)) {
        this.setDefaultAccount(null);
      } else {
        this.logService.debug("[DefaultAccount] Sessions changed for default account provider, updating default account");
        this.updateDefaultAccount();
      }
    }));
    this._register(this.authenticationExtensionsService.onDidChangeAccountPreference(async (e) => {
      const defaultAccountProvider = this.getDefaultAccountAuthenticationProvider();
      if (e.providerId !== defaultAccountProvider.id) {
        return;
      }
      this.logService.debug("[DefaultAccount] Account preference changed for default account provider, updating default account");
      this.updateDefaultAccount();
    }));
    this._register(this.authenticationService.onDidRegisterAuthenticationProvider((e) => {
      const defaultAccountProvider = this.getDefaultAccountAuthenticationProvider();
      if (e.id !== defaultAccountProvider.id) {
        return;
      }
      this.logService.debug("[DefaultAccount] Default account provider registered, updating default account");
      this.updateDefaultAccount();
    }));
    this._register(this.authenticationService.onDidUnregisterAuthenticationProvider((e) => {
      const defaultAccountProvider = this.getDefaultAccountAuthenticationProvider();
      if (e.id !== defaultAccountProvider.id) {
        return;
      }
      this.logService.debug("[DefaultAccount] Default account provider unregistered, updating default account");
      this.updateDefaultAccount();
    }));
    this._register(this.hostService.onDidChangeFocus((focused) => {
      if (focused) {
        this.refetchDefaultAccount();
      }
    }));
  }
  async whenDefaultAccountAuthenticationProviderAvailable() {
    const provider = this.getDefaultAccountAuthenticationProvider();
    this.logService.debug("[DefaultAccount] Waiting for default account authentication provider to be available.");
    const disposables = new DisposableStore();
    try {
      await new Promise((resolve) => {
        if (this.isAccountProviderAvailable(provider)) {
          this.logService.debug("[DefaultAccount] Default account authentication provider is now available.");
          resolve();
          return;
        }
        disposables.add(Event.any(this.authenticationService.onDidChangeDeclaredProviders, this.authenticationService.onDidRegisterAuthenticationProvider)(() => {
          if (this.isAccountProviderAvailable(provider)) {
            this.logService.debug("[DefaultAccount] Default account authentication provider is now available.");
            resolve();
          }
        }));
        if (this.environmentService.remoteAuthority) {
          void this.authenticationService.getSessions(provider.id, void 0, {}, true);
        }
        this.extensionService.whenInstalledExtensionsRegistered().then(() => {
          disposables.dispose();
          this.logService.debug("[DefaultAccount] Installed extensions registered.");
          resolve();
        }, (error) => {
          this.logService.error("[DefaultAccount] Error while waiting for installed extensions to be registered", getErrorMessage(error));
          resolve();
        });
      });
    } finally {
      disposables.dispose();
    }
  }
  async refresh(options) {
    if (!this.initialized) {
      await this.initPromise;
      return this.defaultAccount;
    }
    this.logService.debug("[DefaultAccount] Refreshing default account");
    await this.updateDefaultAccount(options);
    return this.defaultAccount;
  }
  async refetchDefaultAccount() {
    if (this.accountDataPollScheduler.isScheduled()) {
      this.accountDataPollScheduler.cancel();
    }
    if (!this.hostService.hasFocus || !this._defaultAccount) {
      this.scheduleAccountDataPoll();
      this.logService.debug("[DefaultAccount] Skipping refetching default account. Host is not focused or default account is not set");
      return;
    }
    this.logService.debug("[DefaultAccount] Refetching default account");
    await this.updateDefaultAccount();
  }
  async updateDefaultAccount(options) {
    await this.updateThrottler.trigger(() => this.doUpdateDefaultAccount(options));
  }
  async doUpdateDefaultAccount(options) {
    try {
      const defaultAccount = await this.fetchDefaultAccount(options);
      this.setDefaultAccount(defaultAccount);
      this.scheduleAccountDataPoll();
    } catch (error) {
      this.logService.error("[DefaultAccount] Error while updating default account", getErrorMessage(error));
    }
  }
  async fetchDefaultAccount(options) {
    const defaultAccountProvider = this.getDefaultAccountAuthenticationProvider();
    this.logService.debug("[DefaultAccount] Default account provider ID:", defaultAccountProvider.id);
    if (!this.isAccountProviderAvailable(defaultAccountProvider)) {
      this.logService.info(`[DefaultAccount] Authentication provider is not available.`, defaultAccountProvider);
      return null;
    }
    return await this.getDefaultAccountForAuthenticationProvider(defaultAccountProvider, options);
  }
  isAccountProviderAvailable(accountProvider) {
    return this.authenticationService.declaredProviders.some((p) => p.id === accountProvider.id) || this.authenticationService.isAuthenticationProviderRegistered(accountProvider.id);
  }
  setDefaultAccount(account) {
    if (equals(this._defaultAccount, account)) {
      return;
    }
    this.logService.trace("[DefaultAccount] Updating default account:", account);
    if (account) {
      this._defaultAccount = account;
      this.setCopilotTokenInfo(account.copilotTokenInfo);
      this.setPolicyData(account.policyData);
      this._onDidChangeDefaultAccount.fire(this._defaultAccount.defaultAccount);
      this.accountStatusContext.set("available" /* Available */);
      this.logService.debug("[DefaultAccount] Account status set to Available");
    } else {
      this._defaultAccount = null;
      this.setPolicyData(null);
      this.setCopilotTokenInfo(null);
      this._onDidChangeDefaultAccount.fire(null);
      this.accountDataPollScheduler.cancel();
      this.accountStatusContext.set("unavailable" /* Unavailable */);
      this.logService.debug("[DefaultAccount] Account status set to Unavailable");
    }
  }
  setPolicyData(accountPolicyData) {
    if (equals(this._policyData, accountPolicyData)) {
      return;
    }
    this._policyData = accountPolicyData;
    this.cachePolicyData(accountPolicyData);
    this._onDidChangePolicyData.fire(this._policyData?.policyData ?? null);
  }
  setCopilotTokenInfo(copilotTokenInfo) {
    if (equals(this._copilotTokenInfo, copilotTokenInfo)) {
      return;
    }
    this._copilotTokenInfo = copilotTokenInfo;
    this._onDidChangeCopilotTokenInfo.fire(this._copilotTokenInfo);
  }
  cachePolicyData(accountPolicyData) {
    if (accountPolicyData) {
      this.logService.debug("[DefaultAccount] Caching policy data for account:", accountPolicyData.accountId);
      const cachedAccountData = {
        accountPolicyData,
        copilotTokenInfo: this._copilotTokenInfo ?? void 0
      };
      this.storageService.store(CACHED_POLICY_DATA_KEY, JSON.stringify(cachedAccountData), StorageScope.APPLICATION, StorageTarget.MACHINE);
    } else {
      this.logService.debug("[DefaultAccount] Removing cached policy data");
      this.storageService.remove(CACHED_POLICY_DATA_KEY, StorageScope.APPLICATION);
    }
  }
  scheduleAccountDataPoll() {
    if (!this._defaultAccount) {
      return;
    }
    this.accountDataPollScheduler.schedule(ACCOUNT_DATA_POLL_INTERVAL_MS);
  }
  extractFromToken(token) {
    const result = /* @__PURE__ */ new Map();
    const firstPart = token?.split(":")[0];
    const fields = firstPart?.split(";");
    for (const field of fields) {
      const [key, value] = field.split("=");
      result.set(key, value);
    }
    this.logService.debug(`[DefaultAccount] extractFromToken: ${JSON.stringify(Object.fromEntries(result))}`);
    return result;
  }
  async getDefaultAccountForAuthenticationProvider(authenticationProvider, options) {
    try {
      this.logService.debug("[DefaultAccount] Getting Default Account from authenticated sessions for provider:", authenticationProvider.id);
      const sessions = await this.findMatchingProviderSession(authenticationProvider.id, this.defaultAccountConfig.authenticationProvider.scopes);
      if (!sessions?.length) {
        this.logService.debug("[DefaultAccount] No matching session found for provider:", authenticationProvider.id);
        return null;
      }
      return this.getDefaultAccountFromAuthenticatedSessions(authenticationProvider, sessions, options);
    } catch (error) {
      this.logService.error("[DefaultAccount] Failed to get default account for provider:", authenticationProvider.id, getErrorMessage(error));
      return null;
    }
  }
  async getDefaultAccountFromAuthenticatedSessions(authenticationProvider, sessions, options) {
    try {
      const accountId = sessions[0].account.id;
      const accountPolicyData = this._policyData?.accountId === accountId ? this._policyData : void 0;
      const entitlementsResult = await this.getEntitlements(sessions, accountPolicyData, options);
      const entitlementsData = entitlementsResult?.data;
      const entitlementsFetchedAt = entitlementsResult?.fetchedAt;
      const [tokenEntitlementsResult, managedSettingsResult] = entitlementsData?.chat_enabled ? await Promise.all([
        this.getTokenEntitlements(sessions, accountPolicyData, options),
        this.getManagedSettings(sessions, accountPolicyData, options)
      ]) : [void 0, void 0];
      const tokenEntitlementsFetchedAt = tokenEntitlementsResult?.fetchedAt;
      const managedSettingsFetchedAt = managedSettingsResult?.fetchedAt;
      let mcpRegistryDataFetchedAt;
      let policyData = accountPolicyData?.policyData ? { ...accountPolicyData.policyData } : void 0;
      if (entitlementsData) {
        policyData = policyData ?? {};
        policyData.cloud_session_storage_enabled = entitlementsData.cloud_session_storage_enabled;
      }
      if (tokenEntitlementsResult?.data) {
        const tokenEntitlementsData = tokenEntitlementsResult.data;
        policyData = policyData ?? {};
        policyData.chat_agent_enabled = tokenEntitlementsData.policyData.chat_agent_enabled;
        policyData.chat_preview_features_enabled = tokenEntitlementsData.policyData.chat_preview_features_enabled;
        policyData.mcp = tokenEntitlementsData.policyData.mcp;
        if (policyData.mcp) {
          const mcpRegistryResult = await this.getMcpRegistryProvider(sessions, accountPolicyData, options);
          mcpRegistryDataFetchedAt = mcpRegistryResult?.fetchedAt;
          policyData.mcpRegistryUrl = mcpRegistryResult?.data?.url;
          policyData.mcpAccess = mcpRegistryResult?.data?.registry_access;
        } else {
          policyData.mcpRegistryUrl = void 0;
          policyData.mcpAccess = void 0;
        }
      }
      if (managedSettingsResult?.data) {
        policyData = { ...policyData ?? {}, ...managedSettingsResult.data };
      }
      const defaultAccount = {
        authenticationProvider,
        accountName: sessions[0].account.label,
        sessionId: sessions[0].id,
        enterprise: authenticationProvider.enterprise || sessions[0].account.label.includes("_"),
        entitlementsData
      };
      this.logService.debug("[DefaultAccount] Successfully created default account for provider:", authenticationProvider.id);
      const accountPolicyResult = policyData || entitlementsFetchedAt ? { accountId, policyData: policyData ?? {}, entitlementsFetchedAt, tokenEntitlementsFetchedAt, mcpRegistryDataFetchedAt, managedSettingsFetchedAt } : null;
      return {
        defaultAccount,
        accountId,
        policyData: accountPolicyResult,
        copilotTokenInfo: tokenEntitlementsResult?.data?.copilotTokenInfo ?? null
      };
    } catch (error) {
      this.logService.error("[DefaultAccount] Failed to create default account for provider:", authenticationProvider.id, getErrorMessage(error));
      return null;
    }
  }
  async findMatchingProviderSession(authProviderId, allScopes) {
    const sessions = await this.getSessions(authProviderId);
    const matchingSessions = [];
    for (const session of sessions) {
      this.logService.debug("[DefaultAccount] Checking session with scopes", session.scopes);
      for (const scopes of allScopes) {
        if (this.scopesMatch(session.scopes, scopes)) {
          matchingSessions.push(session);
        }
      }
    }
    return matchingSessions.length > 0 ? matchingSessions : void 0;
  }
  async getSessions(authProviderId) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        let preferredAccount;
        let preferredAccountName;
        for (const preferredExtension of this.defaultAccountConfig.preferredExtensions) {
          preferredAccountName = this.authenticationExtensionsService.getAccountPreference(preferredExtension, authProviderId);
          if (preferredAccountName) {
            break;
          }
        }
        for (const account of await this.authenticationService.getAccounts(authProviderId)) {
          if (account.label === preferredAccountName) {
            preferredAccount = account;
            break;
          }
        }
        return await this.authenticationService.getSessions(authProviderId, void 0, { account: preferredAccount }, true);
      } catch (error) {
        this.logService.warn(`[DefaultAccount] Attempt ${attempt} to get sessions failed:`, getErrorMessage(error));
        if (attempt === 3) {
          throw error;
        }
        await timeout(500);
      }
    }
    throw new Error("Unable to get sessions after multiple attempts");
  }
  scopesMatch(scopes, expectedScopes) {
    return expectedScopes.every((scope) => scopes.includes(scope));
  }
  async getTokenEntitlements(sessions, accountPolicyData, options) {
    if (!options?.forceRefresh && accountPolicyData?.tokenEntitlementsFetchedAt && !this.isDataStale(accountPolicyData.tokenEntitlementsFetchedAt)) {
      this.logService.debug("[DefaultAccount] Using last fetched token entitlements data");
      return { data: { policyData: accountPolicyData.policyData, copilotTokenInfo: this._copilotTokenInfo ?? {} }, fetchedAt: accountPolicyData.tokenEntitlementsFetchedAt };
    }
    const data = await this.requestTokenEntitlements(sessions);
    return { data, fetchedAt: Date.now() };
  }
  async requestTokenEntitlements(sessions) {
    const tokenEntitlementsUrl = this.getTokenEntitlementUrl();
    if (!tokenEntitlementsUrl) {
      this.logService.debug("[DefaultAccount] No token entitlements URL found");
      return void 0;
    }
    this.logService.debug("[DefaultAccount] Fetching token entitlements from:", tokenEntitlementsUrl);
    const response = await this.request(tokenEntitlementsUrl, "GET", void 0, sessions, CancellationToken.None, "defaultAccount.tokenEntitlements");
    if (!response) {
      return void 0;
    }
    if (response.res.statusCode && response.res.statusCode !== 200) {
      this.logService.trace(`[DefaultAccount] unexpected status code ${response.res.statusCode} while fetching token entitlements`);
      return void 0;
    }
    try {
      const chatData = await asJson(response);
      if (chatData) {
        const tokenMap = this.extractFromToken(chatData.token);
        return {
          policyData: {
            // Editor preview features are disabled if the flag is present and set to 0
            chat_preview_features_enabled: tokenMap.get("editor_preview_features") !== "0",
            chat_agent_enabled: tokenMap.get("agent_mode") !== "0",
            // MCP is only enabled if the flag is explicitly present and set to 1
            mcp: tokenMap.get("mcp") === "1"
          },
          copilotTokenInfo: {
            sn: tokenMap.get("sn"),
            fcv1: tokenMap.get("fcv1")
          }
        };
      }
      this.logService.error("Failed to fetch token entitlements", "No data returned");
    } catch (error) {
      this.logService.error("Failed to fetch token entitlements", getErrorMessage(error));
    }
    return void 0;
  }
  async getEntitlements(sessions, accountPolicyData, options) {
    const accountId = sessions[0].account.id;
    const existingData = this._defaultAccount?.accountId === accountId ? this._defaultAccount?.defaultAccount.entitlementsData : void 0;
    if (!options?.forceRefresh && existingData && accountPolicyData?.entitlementsFetchedAt && !this.isDataStale(accountPolicyData.entitlementsFetchedAt)) {
      this.logService.debug("[DefaultAccount] Using last fetched entitlements data");
      return { data: existingData, fetchedAt: accountPolicyData.entitlementsFetchedAt };
    }
    const entitlementUrl = this.getEntitlementUrl();
    if (!entitlementUrl) {
      this.logService.debug("[DefaultAccount] No chat entitlements URL found");
      return { data: void 0, fetchedAt: void 0 };
    }
    this.logService.debug("[DefaultAccount] Fetching entitlements from:", entitlementUrl);
    const response = await this.request(entitlementUrl, "GET", void 0, sessions, CancellationToken.None, "defaultAccount.entitlements");
    if (!response) {
      return { data: void 0, fetchedAt: Date.now() };
    }
    if (response.res.statusCode && response.res.statusCode !== 200) {
      this.logService.trace(`[DefaultAccount] unexpected status code ${response.res.statusCode} while fetching entitlements`);
      const data = response.res.statusCode === 401 || // oauth token being unavailable (expired/revoked)
      response.res.statusCode === 404 ? null : void 0;
      return { data, fetchedAt: Date.now() };
    }
    try {
      const data = await asJson(response);
      if (data) {
        return { data, fetchedAt: Date.now() };
      }
      this.logService.error("[DefaultAccount] Failed to fetch entitlements", "No data returned");
    } catch (error) {
      this.logService.error("[DefaultAccount] Failed to fetch entitlements", getErrorMessage(error));
    }
    return { data: void 0, fetchedAt: Date.now() };
  }
  async getMcpRegistryProvider(sessions, accountPolicyData, options) {
    if (!options?.forceRefresh && accountPolicyData?.mcpRegistryDataFetchedAt && !this.isDataStale(accountPolicyData.mcpRegistryDataFetchedAt)) {
      this.logService.debug("[DefaultAccount] Using last fetched MCP registry data");
      const data2 = accountPolicyData.policyData.mcpRegistryUrl && accountPolicyData.policyData.mcpAccess ? { url: accountPolicyData.policyData.mcpRegistryUrl, registry_access: accountPolicyData.policyData.mcpAccess } : null;
      return { data: data2, fetchedAt: accountPolicyData.mcpRegistryDataFetchedAt };
    }
    const data = await this.requestMcpRegistryProvider(sessions);
    return !isUndefined(data) ? { data, fetchedAt: Date.now() } : void 0;
  }
  async requestMcpRegistryProvider(sessions) {
    const mcpRegistryDataUrl = this.getMcpRegistryDataUrl();
    if (!mcpRegistryDataUrl) {
      this.logService.debug("[DefaultAccount] No MCP registry data URL found");
      return null;
    }
    this.logService.debug("[DefaultAccount] Fetching MCP registry data from:", mcpRegistryDataUrl);
    const response = await this.request(mcpRegistryDataUrl, "GET", void 0, sessions, CancellationToken.None, "defaultAccount.mcpRegistryProvider");
    if (!response) {
      return void 0;
    }
    if (!isSuccess(response)) {
      if (isClientError(response)) {
        this.logService.debug(`[DefaultAccount] Received ${response.res.statusCode} for MCP registry data, treating as no registry available.`);
        return null;
      }
      this.logService.debug(`[DefaultAccount] unexpected status code ${response.res.statusCode} while fetching MCP registry data`);
      return void 0;
    }
    try {
      const data = await asJson(response);
      if (data) {
        this.logService.debug("Fetched MCP registry providers", data.mcp_registries);
        return data.mcp_registries[0] ?? null;
      }
      this.logService.debug("No MCP registry providers content found in response");
      return null;
    } catch (error) {
      this.logService.error("Failed to fetch MCP registry providers", getErrorMessage(error));
      return void 0;
    }
  }
  async getManagedSettings(sessions, accountPolicyData, options) {
    const accountId = sessions[0].account.id;
    const cachedManagedSettings = accountPolicyData?.managedSettingsFetchedAt !== void 0 && !this.isDataStale(accountPolicyData.managedSettingsFetchedAt) ? {
      data: {
        managedSettings: accountPolicyData.policyData.managedSettings
      },
      fetchedAt: accountPolicyData.managedSettingsFetchedAt
    } : void 0;
    let forceRemoteSettingsRefresh = false;
    if (!options?.forceRefresh && cachedManagedSettings && !this.managedSettingsFetchAttemptedAccounts.has(accountId)) {
      let nativeManagedSettings = this.nativeManagedSettingsService.managedSettings;
      try {
        nativeManagedSettings = await this.nativeManagedSettingsService.initialize();
      } catch (error) {
        this.logService.warn("[DefaultAccount] Failed to initialize native managed settings before resolving forceRemoteSettingsRefresh; using available values", getErrorMessage(error));
        nativeManagedSettings = this.nativeManagedSettingsService.managedSettings;
      }
      forceRemoteSettingsRefresh = shouldForceRemoteSettingsRefresh(nativeManagedSettings, accountPolicyData?.policyData.managedSettings);
    }
    if (!options?.forceRefresh && cachedManagedSettings && !forceRemoteSettingsRefresh) {
      this.logService.debug("[DefaultAccount] Using last fetched managed settings data");
      this._managedSettingsFetchStatus = "ok";
      return cachedManagedSettings;
    }
    if (forceRemoteSettingsRefresh) {
      this.logService.info("[DefaultAccount] forceRemoteSettingsRefresh is set; fetching fresh managed settings instead of using the cached response");
    }
    this.managedSettingsFetchAttemptedAccounts.add(accountId);
    const data = await this.requestManagedSettings(sessions);
    return { data: data ?? cachedManagedSettings?.data, fetchedAt: Date.now() };
  }
  async requestManagedSettings(sessions) {
    const managedSettingsUrl = this.getManagedSettingsUrl();
    if (!managedSettingsUrl) {
      this.logService.debug("[DefaultAccount] No managed settings URL configured; skipping enterprise policy fetch");
      this._managedSettingsFetchStatus = "no-url";
      return void 0;
    }
    this.logService.debug("[DefaultAccount] Fetching managed settings from:", managedSettingsUrl);
    const rateLimitBackoffActive = Date.now() < this._rateLimitBackoffUntil;
    const response = await this.request(managedSettingsUrl, "GET", void 0, sessions, CancellationToken.None, "defaultAccount.managedSettings", MANAGED_SETTINGS_REQUEST_TIMEOUT_MS);
    if (!response) {
      this.logService.debug("[DefaultAccount] Managed settings fetch returned no response (network error, all sessions rejected, or active rate-limit backoff); falling back to local-only policy");
      this.reportManagedSettingsOutcome("no-response", rateLimitBackoffActive);
      return void 0;
    }
    if (!isSuccess(response)) {
      const status = response.res.statusCode ?? 0;
      this.logService.warn(`[DefaultAccount] Managed settings fetch returned non-success status ${status}; falling back to local-only policy`);
      this.reportManagedSettingsOutcome(status, rateLimitBackoffActive);
      return void 0;
    }
    try {
      const data = await asJson(response);
      this.logService.trace("[DefaultAccount] Managed settings raw response:", JSON.stringify(data ?? null));
      this._managedSettingsRawResponse = data ?? null;
      const adapted = adaptManagedSettings(data ?? {}, (msg) => this.logService.warn(msg));
      const managedSettingsCount = adapted.managedSettings ? Object.keys(adapted.managedSettings).length : 0;
      if (managedSettingsCount === 0) {
        this.logService.debug("[DefaultAccount] Managed settings fetched (empty response \u2014 no enterprise policy file present)");
      } else {
        this.logService.info("[DefaultAccount] Managed settings applied");
        this.logService.trace("[DefaultAccount] Managed settings payload:", JSON.stringify(adapted));
      }
      this.reportManagedSettingsOutcome("ok", rateLimitBackoffActive);
      return adapted;
    } catch (error) {
      this.logService.error("[DefaultAccount] Failed to parse managed settings response", getErrorMessage(error));
      this.reportManagedSettingsOutcome("parse-error", rateLimitBackoffActive);
      return void 0;
    }
  }
  reportManagedSettingsOutcome(status, rateLimitBackoffActive) {
    this._managedSettingsFetchStatus = status;
    this.telemetryService.publicLog2("defaultaccount:managedSettings:fetch", {
      outcome: typeof status === "number" ? `status:${status}` : status,
      rateLimitBackoffActive
    });
  }
  /**
   * Detects a rate-limited GitHub response. Mirrors the public-API check in
   * `githubRepoFetcher.ts`:
   * - Canonical `429 Too Many Requests`.
   * - Primary quota exhaustion: `403` with `X-RateLimit-Remaining: 0`.
   * - Secondary throttling: GitHub omits `X-RateLimit-Remaining` but sets
   *   `Retry-After` (on a non-2xx response). We treat any non-success status
   *   that carries `Retry-After` as a back-off signal.
   */
  isRateLimited(response) {
    const status = response.res.statusCode;
    if (status === 429) {
      return true;
    }
    if (status === 403 && readHeader(response.res.headers, "x-ratelimit-remaining") === "0") {
      return true;
    }
    if (!isSuccess(response) && readHeader(response.res.headers, "retry-after") !== void 0) {
      return true;
    }
    return false;
  }
  async request(url, type, body, sessions, token, callSite, requestTimeoutMs) {
    if (Date.now() < this._rateLimitBackoffUntil) {
      const remainingSec = Math.ceil((this._rateLimitBackoffUntil - Date.now()) / 1e3);
      this.logService.debug(`[DefaultAccount] Skipping request to ${url} \u2014 rate-limit backoff active for ${remainingSec}s more`);
      return void 0;
    }
    let lastResponse;
    for (const session of sessions) {
      if (token.isCancellationRequested) {
        return lastResponse;
      }
      try {
        const response = await this.requestService.request({
          type,
          url,
          data: type === "POST" ? JSON.stringify(body) : void 0,
          disableCache: true,
          timeout: requestTimeoutMs,
          headers: {
            "Authorization": `Bearer ${session.accessToken}`
          },
          callSite
        }, token);
        const status = response.res.statusCode;
        if (this.isRateLimited(response)) {
          const retryAfterSec = retryAfterFromHeaders(response.res.headers) ?? 60;
          this._rateLimitBackoffUntil = Date.now() + retryAfterSec * 1e3;
          this.logService.warn(`[DefaultAccount] Rate limited by ${url} (status ${status}); backing off for ${retryAfterSec}s`);
          return response;
        }
        if (status === 401 || status === 404) {
          this.logService.debug(`[DefaultAccount] Received ${status} for URL ${url} with session ${session.id}, likely due to expired/revoked token or insufficient permissions.`, "Trying next session if available.");
          lastResponse = response;
          continue;
        }
        return response;
      } catch (error) {
        if (!token.isCancellationRequested) {
          this.logService.error(`[DefaultAccount] request: error ${error}`, url);
        }
      }
    }
    if (!lastResponse) {
      this.logService.trace("[DefaultAccount]: No response received for request", url);
      return void 0;
    }
    return lastResponse;
  }
  isDataStale(fetchedAt) {
    return Date.now() - fetchedAt >= ACCOUNT_DATA_POLL_INTERVAL_MS;
  }
  getEntitlementUrl() {
    if (this.getDefaultAccountAuthenticationProvider().enterprise) {
      try {
        const enterpriseUrl = this.getEnterpriseUrl();
        if (!enterpriseUrl) {
          return void 0;
        }
        return `${enterpriseUrl.protocol}//api.${enterpriseUrl.hostname}${enterpriseUrl.port ? ":" + enterpriseUrl.port : ""}/copilot_internal/user`;
      } catch (error) {
        this.logService.error(error);
      }
    }
    return this.defaultAccountConfig.entitlementUrl;
  }
  getTokenEntitlementUrl() {
    if (this.getDefaultAccountAuthenticationProvider().enterprise) {
      try {
        const enterpriseUrl = this.getEnterpriseUrl();
        if (!enterpriseUrl) {
          return void 0;
        }
        return `${enterpriseUrl.protocol}//api.${enterpriseUrl.hostname}${enterpriseUrl.port ? ":" + enterpriseUrl.port : ""}/copilot_internal/v2/token`;
      } catch (error) {
        this.logService.error(error);
      }
    }
    return this.defaultAccountConfig.tokenEntitlementUrl;
  }
  getMcpRegistryDataUrl() {
    if (this.getDefaultAccountAuthenticationProvider().enterprise) {
      try {
        const enterpriseUrl = this.getEnterpriseUrl();
        if (!enterpriseUrl) {
          return void 0;
        }
        return `${enterpriseUrl.protocol}//api.${enterpriseUrl.hostname}${enterpriseUrl.port ? ":" + enterpriseUrl.port : ""}/copilot/mcp_registry`;
      } catch (error) {
        this.logService.error(error);
      }
    }
    return this.defaultAccountConfig.mcpRegistryDataUrl;
  }
  getManagedSettingsUrl() {
    if (this.getDefaultAccountAuthenticationProvider().enterprise) {
      try {
        const enterpriseUrl = this.getEnterpriseUrl();
        if (!enterpriseUrl) {
          return void 0;
        }
        return `${enterpriseUrl.protocol}//api.${enterpriseUrl.hostname}${enterpriseUrl.port ? ":" + enterpriseUrl.port : ""}/copilot_internal/managed_settings`;
      } catch (error) {
        this.logService.error(error);
      }
    }
    return this.defaultAccountConfig.managedSettingsUrl;
  }
  getDefaultAccountAuthenticationProvider() {
    if (this.configurationService.getValue(this.defaultAccountConfig.authenticationProvider.enterpriseProviderConfig) === this.defaultAccountConfig.authenticationProvider.enterprise.id) {
      return {
        ...this.defaultAccountConfig.authenticationProvider.enterprise,
        enterprise: true
      };
    }
    return {
      ...this.defaultAccountConfig.authenticationProvider.default,
      enterprise: false
    };
  }
  resolveGitHubUrl(path) {
    if (this.getDefaultAccountAuthenticationProvider().enterprise) {
      try {
        const enterpriseUrl = this.getEnterpriseUrl();
        if (enterpriseUrl) {
          return `${enterpriseUrl.protocol}//${enterpriseUrl.host}/${path}`;
        }
      } catch {
      }
    }
    return `https://github.com/${path}`;
  }
  getEnterpriseUrl() {
    const value = this.configurationService.getValue(this.defaultAccountConfig.authenticationProvider.enterpriseProviderUriSetting);
    if (!isString(value)) {
      return void 0;
    }
    return new URL(value);
  }
  async signIn(options) {
    const authProvider = this.getDefaultAccountAuthenticationProvider();
    if (!authProvider) {
      throw new Error("No default account provider configured");
    }
    const { additionalScopes, ...sessionOptions } = options ?? {};
    const defaultAccountScopes = this.defaultAccountConfig.authenticationProvider.scopes[0];
    const scopes = additionalScopes ? distinct([...defaultAccountScopes, ...additionalScopes]) : defaultAccountScopes;
    const session = await this.authenticationService.createSession(authProvider.id, scopes, sessionOptions);
    for (const preferredExtension of this.defaultAccountConfig.preferredExtensions) {
      this.authenticationExtensionsService.updateAccountPreference(preferredExtension, authProvider.id, session.account);
    }
    await this.updateDefaultAccount();
    return this.defaultAccount;
  }
  async signOut() {
    if (!this.defaultAccount) {
      return;
    }
    await this.commandService.executeCommand("_signOutOfAccount", { providerId: this.defaultAccount.authenticationProvider.id, accountLabel: this.defaultAccount.accountName });
  }
};
DefaultAccountProvider = __decorateClass([
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IAuthenticationService),
  __decorateParam(3, IAuthenticationExtensionsService),
  __decorateParam(4, ITelemetryService),
  __decorateParam(5, IExtensionService),
  __decorateParam(6, IRequestService),
  __decorateParam(7, ILogService),
  __decorateParam(8, IWorkbenchEnvironmentService),
  __decorateParam(9, IContextKeyService),
  __decorateParam(10, IStorageService),
  __decorateParam(11, IHostService),
  __decorateParam(12, ICommandService),
  __decorateParam(13, INativeManagedSettingsService)
], DefaultAccountProvider);
let DefaultAccountProviderContribution = class extends Disposable {
  static {
    this.ID = "workbench.contributions.defaultAccountProvider";
  }
  constructor(productService, instantiationService, defaultAccountService) {
    super();
    const defaultAccountProvider = this._register(instantiationService.createInstance(DefaultAccountProvider, toDefaultAccountConfig(productService.defaultChatAgent)));
    defaultAccountService.setDefaultAccountProvider(defaultAccountProvider);
  }
};
DefaultAccountProviderContribution = __decorateClass([
  __decorateParam(0, IProductService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IDefaultAccountService)
], DefaultAccountProviderContribution);
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: DEFAULT_ACCOUNT_SIGN_IN_COMMAND,
      title: localize2("signIn", "Sign In")
    });
  }
  async run(accessor) {
    const defaultAccountService = accessor.get(IDefaultAccountService);
    await defaultAccountService.signIn();
  }
});
registerWorkbenchContribution2(DefaultAccountProviderContribution.ID, DefaultAccountProviderContribution, WorkbenchPhase.BlockStartup);
export {
  CONTEXT_DEFAULT_ACCOUNT_STATE,
  DEFAULT_ACCOUNT_SIGN_IN_COMMAND,
  DefaultAccountProvider,
  DefaultAccountService,
  DefaultAccountStatus
};
