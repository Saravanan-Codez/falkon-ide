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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IAuthenticationService, IAuthenticationExtensionsService, INTERNAL_AUTH_PROVIDER_PREFIX } from "../common/authentication.js";
import {
  IAuthenticationQueryService
} from "../common/authenticationQuery.js";
import { IAuthenticationUsageService } from "./authenticationUsageService.js";
import { IAuthenticationMcpUsageService } from "./authenticationMcpUsageService.js";
import { IAuthenticationAccessService } from "./authenticationAccessService.js";
import { IAuthenticationMcpAccessService } from "./authenticationMcpAccessService.js";
import { IAuthenticationMcpService } from "./authenticationMcpService.js";
import { ExtensionIdentifier } from "../../../../platform/extensions/common/extensions.js";
class BaseQuery {
  constructor(providerId, queryService) {
    this.providerId = providerId;
    this.queryService = queryService;
  }
}
class AccountExtensionQuery extends BaseQuery {
  constructor(providerId, accountName, extensionId, queryService) {
    super(providerId, queryService);
    this.accountName = accountName;
    this.extensionId = extensionId;
  }
  isAccessAllowed() {
    return this.queryService.authenticationAccessService.isAccessAllowed(this.providerId, this.accountName, this.extensionId);
  }
  setAccessAllowed(allowed, extensionName) {
    this.queryService.authenticationAccessService.updateAllowedExtensions(
      this.providerId,
      this.accountName,
      [{ id: this.extensionId, name: extensionName || this.extensionId, allowed }]
    );
  }
  addUsage(scopes, extensionName) {
    this.queryService.authenticationUsageService.addAccountUsage(
      this.providerId,
      this.accountName,
      scopes,
      this.extensionId,
      extensionName
    );
  }
  getUsage() {
    const allUsages = this.queryService.authenticationUsageService.readAccountUsages(this.providerId, this.accountName);
    return allUsages.filter((usage) => usage.extensionId === ExtensionIdentifier.toKey(this.extensionId)).map((usage) => ({
      extensionId: usage.extensionId,
      extensionName: usage.extensionName,
      scopes: usage.scopes || [],
      lastUsed: usage.lastUsed
    }));
  }
  removeUsage() {
    const allUsages = this.queryService.authenticationUsageService.readAccountUsages(this.providerId, this.accountName);
    const filteredUsages = allUsages.filter((usage) => usage.extensionId !== this.extensionId);
    this.queryService.authenticationUsageService.removeAccountUsage(this.providerId, this.accountName);
    for (const usage of filteredUsages) {
      this.queryService.authenticationUsageService.addAccountUsage(
        this.providerId,
        this.accountName,
        usage.scopes || [],
        usage.extensionId,
        usage.extensionName
      );
    }
  }
  setAsPreferred() {
    this.queryService.authenticationExtensionsService.updateAccountPreference(
      this.extensionId,
      this.providerId,
      { label: this.accountName, id: this.accountName }
    );
  }
  isPreferred() {
    const preferredAccount = this.queryService.authenticationExtensionsService.getAccountPreference(this.extensionId, this.providerId);
    return preferredAccount === this.accountName;
  }
  isTrusted() {
    const allowedExtensions = this.queryService.authenticationAccessService.readAllowedExtensions(this.providerId, this.accountName);
    const extension = allowedExtensions.find((ext) => ext.id === this.extensionId);
    return extension?.trusted === true;
  }
}
class AccountMcpServerQuery extends BaseQuery {
  constructor(providerId, accountName, mcpServerId, queryService) {
    super(providerId, queryService);
    this.accountName = accountName;
    this.mcpServerId = mcpServerId;
  }
  isAccessAllowed() {
    return this.queryService.authenticationMcpAccessService.isAccessAllowed(this.providerId, this.accountName, this.mcpServerId);
  }
  setAccessAllowed(allowed, mcpServerName) {
    this.queryService.authenticationMcpAccessService.updateAllowedMcpServers(
      this.providerId,
      this.accountName,
      [{ id: this.mcpServerId, name: mcpServerName || this.mcpServerId, allowed }]
    );
  }
  addUsage(scopes, mcpServerName) {
    this.queryService.authenticationMcpUsageService.addAccountUsage(
      this.providerId,
      this.accountName,
      scopes,
      this.mcpServerId,
      mcpServerName
    );
  }
  getUsage() {
    const allUsages = this.queryService.authenticationMcpUsageService.readAccountUsages(this.providerId, this.accountName);
    return allUsages.filter((usage) => usage.mcpServerId === this.mcpServerId).map((usage) => ({
      mcpServerId: usage.mcpServerId,
      mcpServerName: usage.mcpServerName,
      scopes: usage.scopes || [],
      lastUsed: usage.lastUsed
    }));
  }
  removeUsage() {
    const allUsages = this.queryService.authenticationMcpUsageService.readAccountUsages(this.providerId, this.accountName);
    const filteredUsages = allUsages.filter((usage) => usage.mcpServerId !== this.mcpServerId);
    this.queryService.authenticationMcpUsageService.removeAccountUsage(this.providerId, this.accountName);
    for (const usage of filteredUsages) {
      this.queryService.authenticationMcpUsageService.addAccountUsage(
        this.providerId,
        this.accountName,
        usage.scopes || [],
        usage.mcpServerId,
        usage.mcpServerName
      );
    }
  }
  setAsPreferred() {
    this.queryService.authenticationMcpService.updateAccountPreference(
      this.mcpServerId,
      this.providerId,
      { label: this.accountName, id: this.accountName }
    );
  }
  isPreferred() {
    const preferredAccount = this.queryService.authenticationMcpService.getAccountPreference(this.mcpServerId, this.providerId);
    return preferredAccount === this.accountName;
  }
  isTrusted() {
    const allowedMcpServers = this.queryService.authenticationMcpAccessService.readAllowedMcpServers(this.providerId, this.accountName);
    const mcpServer = allowedMcpServers.find((server) => server.id === this.mcpServerId);
    return mcpServer?.trusted === true;
  }
}
class AccountExtensionsQuery extends BaseQuery {
  constructor(providerId, accountName, queryService) {
    super(providerId, queryService);
    this.accountName = accountName;
  }
  getAllowedExtensions() {
    const allowedExtensions = this.queryService.authenticationAccessService.readAllowedExtensions(this.providerId, this.accountName);
    const usages = this.queryService.authenticationUsageService.readAccountUsages(this.providerId, this.accountName);
    return allowedExtensions.filter((ext) => ext.allowed !== false).map((ext) => {
      const extensionUsages = usages.filter((usage) => usage.extensionId === ext.id);
      const lastUsed = extensionUsages.length > 0 ? Math.max(...extensionUsages.map((u) => u.lastUsed)) : void 0;
      const extensionQuery = new AccountExtensionQuery(this.providerId, this.accountName, ext.id, this.queryService);
      const trusted = extensionQuery.isTrusted();
      return {
        id: ext.id,
        name: ext.name,
        allowed: ext.allowed,
        lastUsed,
        trusted
      };
    });
  }
  allowAccess(extensionIds) {
    const extensionsToAllow = extensionIds.map((id) => ({ id, name: id, allowed: true }));
    this.queryService.authenticationAccessService.updateAllowedExtensions(this.providerId, this.accountName, extensionsToAllow);
  }
  removeAccess(extensionIds) {
    const extensionsToRemove = extensionIds.map((id) => ({ id, name: id, allowed: false }));
    this.queryService.authenticationAccessService.updateAllowedExtensions(this.providerId, this.accountName, extensionsToRemove);
  }
  forEach(callback) {
    const usages = this.queryService.authenticationUsageService.readAccountUsages(this.providerId, this.accountName);
    const allowedExtensions = this.queryService.authenticationAccessService.readAllowedExtensions(this.providerId, this.accountName);
    const extensionIds = /* @__PURE__ */ new Set();
    usages.forEach((usage) => extensionIds.add(usage.extensionId));
    allowedExtensions.forEach((ext) => extensionIds.add(ext.id));
    for (const extensionId of extensionIds) {
      const extensionQuery = new AccountExtensionQuery(this.providerId, this.accountName, extensionId, this.queryService);
      callback(extensionQuery);
    }
  }
}
class AccountMcpServersQuery extends BaseQuery {
  constructor(providerId, accountName, queryService) {
    super(providerId, queryService);
    this.accountName = accountName;
  }
  getAllowedMcpServers() {
    return this.queryService.authenticationMcpAccessService.readAllowedMcpServers(this.providerId, this.accountName).filter((server) => server.allowed !== false);
  }
  allowAccess(mcpServerIds) {
    const mcpServersToAllow = mcpServerIds.map((id) => ({ id, name: id, allowed: true }));
    this.queryService.authenticationMcpAccessService.updateAllowedMcpServers(this.providerId, this.accountName, mcpServersToAllow);
  }
  removeAccess(mcpServerIds) {
    const mcpServersToRemove = mcpServerIds.map((id) => ({ id, name: id, allowed: false }));
    this.queryService.authenticationMcpAccessService.updateAllowedMcpServers(this.providerId, this.accountName, mcpServersToRemove);
  }
  forEach(callback) {
    const usages = this.queryService.authenticationMcpUsageService.readAccountUsages(this.providerId, this.accountName);
    const allowedMcpServers = this.queryService.authenticationMcpAccessService.readAllowedMcpServers(this.providerId, this.accountName);
    const mcpServerIds = /* @__PURE__ */ new Set();
    usages.forEach((usage) => mcpServerIds.add(usage.mcpServerId));
    allowedMcpServers.forEach((server) => mcpServerIds.add(server.id));
    for (const mcpServerId of mcpServerIds) {
      const mcpServerQuery = new AccountMcpServerQuery(this.providerId, this.accountName, mcpServerId, this.queryService);
      callback(mcpServerQuery);
    }
  }
}
class AccountEntitiesQuery extends BaseQuery {
  constructor(providerId, accountName, queryService) {
    super(providerId, queryService);
    this.accountName = accountName;
  }
  hasAnyUsage() {
    const extensionUsages = this.queryService.authenticationUsageService.readAccountUsages(this.providerId, this.accountName);
    if (extensionUsages.length > 0) {
      return true;
    }
    const mcpUsages = this.queryService.authenticationMcpUsageService.readAccountUsages(this.providerId, this.accountName);
    if (mcpUsages.length > 0) {
      return true;
    }
    const allowedExtensions = this.queryService.authenticationAccessService.readAllowedExtensions(this.providerId, this.accountName);
    if (allowedExtensions.some((ext) => ext.allowed !== false)) {
      return true;
    }
    const allowedMcpServers = this.queryService.authenticationMcpAccessService.readAllowedMcpServers(this.providerId, this.accountName);
    if (allowedMcpServers.some((server) => server.allowed !== false)) {
      return true;
    }
    return false;
  }
  getEntityCount() {
    const extensionUsages = this.queryService.authenticationUsageService.readAccountUsages(this.providerId, this.accountName);
    const allowedExtensions = this.queryService.authenticationAccessService.readAllowedExtensions(this.providerId, this.accountName).filter((ext) => ext.allowed);
    const extensionIds = /* @__PURE__ */ new Set();
    extensionUsages.forEach((usage) => extensionIds.add(usage.extensionId));
    allowedExtensions.forEach((ext) => extensionIds.add(ext.id));
    const mcpUsages = this.queryService.authenticationMcpUsageService.readAccountUsages(this.providerId, this.accountName);
    const allowedMcpServers = this.queryService.authenticationMcpAccessService.readAllowedMcpServers(this.providerId, this.accountName).filter((server) => server.allowed);
    const mcpServerIds = /* @__PURE__ */ new Set();
    mcpUsages.forEach((usage) => mcpServerIds.add(usage.mcpServerId));
    allowedMcpServers.forEach((server) => mcpServerIds.add(server.id));
    const extensionCount = extensionIds.size;
    const mcpServerCount = mcpServerIds.size;
    return {
      extensions: extensionCount,
      mcpServers: mcpServerCount,
      total: extensionCount + mcpServerCount
    };
  }
  removeAllAccess() {
    const extensionsQuery = new AccountExtensionsQuery(this.providerId, this.accountName, this.queryService);
    const extensions = extensionsQuery.getAllowedExtensions();
    const extensionIds = extensions.map((ext) => ext.id);
    if (extensionIds.length > 0) {
      extensionsQuery.removeAccess(extensionIds);
    }
    const mcpServersQuery = new AccountMcpServersQuery(this.providerId, this.accountName, this.queryService);
    const mcpServers = mcpServersQuery.getAllowedMcpServers();
    const mcpServerIds = mcpServers.map((server) => server.id);
    if (mcpServerIds.length > 0) {
      mcpServersQuery.removeAccess(mcpServerIds);
    }
  }
  forEach(callback) {
    const extensionsQuery = new AccountExtensionsQuery(this.providerId, this.accountName, this.queryService);
    extensionsQuery.forEach((extensionQuery) => {
      callback(extensionQuery.extensionId, "extension");
    });
    const mcpServersQuery = new AccountMcpServersQuery(this.providerId, this.accountName, this.queryService);
    mcpServersQuery.forEach((mcpServerQuery) => {
      callback(mcpServerQuery.mcpServerId, "mcpServer");
    });
  }
}
class AccountQuery extends BaseQuery {
  constructor(providerId, accountName, queryService) {
    super(providerId, queryService);
    this.accountName = accountName;
  }
  extension(extensionId) {
    return new AccountExtensionQuery(this.providerId, this.accountName, extensionId, this.queryService);
  }
  mcpServer(mcpServerId) {
    return new AccountMcpServerQuery(this.providerId, this.accountName, mcpServerId, this.queryService);
  }
  extensions() {
    return new AccountExtensionsQuery(this.providerId, this.accountName, this.queryService);
  }
  mcpServers() {
    return new AccountMcpServersQuery(this.providerId, this.accountName, this.queryService);
  }
  entities() {
    return new AccountEntitiesQuery(this.providerId, this.accountName, this.queryService);
  }
  remove() {
    this.queryService.authenticationAccessService.removeAllowedExtensions(this.providerId, this.accountName);
    this.queryService.authenticationUsageService.removeAccountUsage(this.providerId, this.accountName);
    this.queryService.authenticationMcpAccessService.removeAllowedMcpServers(this.providerId, this.accountName);
    this.queryService.authenticationMcpUsageService.removeAccountUsage(this.providerId, this.accountName);
  }
}
class ProviderExtensionQuery extends BaseQuery {
  constructor(providerId, extensionId, queryService) {
    super(providerId, queryService);
    this.extensionId = extensionId;
  }
  getPreferredAccount() {
    return this.queryService.authenticationExtensionsService.getAccountPreference(this.extensionId, this.providerId);
  }
  setPreferredAccount(account) {
    this.queryService.authenticationExtensionsService.updateAccountPreference(this.extensionId, this.providerId, account);
  }
  removeAccountPreference() {
    this.queryService.authenticationExtensionsService.removeAccountPreference(this.extensionId, this.providerId);
  }
}
class ProviderMcpServerQuery extends BaseQuery {
  constructor(providerId, mcpServerId, queryService) {
    super(providerId, queryService);
    this.mcpServerId = mcpServerId;
  }
  async getLastUsedAccount() {
    try {
      const accounts = await this.queryService.authenticationService.getAccounts(this.providerId);
      let lastUsedAccount;
      let lastUsedTime = 0;
      for (const account of accounts) {
        const usages = this.queryService.authenticationMcpUsageService.readAccountUsages(this.providerId, account.label);
        const mcpServerUsages = usages.filter((usage) => usage.mcpServerId === this.mcpServerId);
        for (const usage of mcpServerUsages) {
          if (usage.lastUsed > lastUsedTime) {
            lastUsedTime = usage.lastUsed;
            lastUsedAccount = account.label;
          }
        }
      }
      return lastUsedAccount;
    } catch {
      return void 0;
    }
  }
  getPreferredAccount() {
    return this.queryService.authenticationMcpService.getAccountPreference(this.mcpServerId, this.providerId);
  }
  setPreferredAccount(account) {
    this.queryService.authenticationMcpService.updateAccountPreference(this.mcpServerId, this.providerId, account);
  }
  removeAccountPreference() {
    this.queryService.authenticationMcpService.removeAccountPreference(this.mcpServerId, this.providerId);
  }
  async getUsedAccounts() {
    try {
      const accounts = await this.queryService.authenticationService.getAccounts(this.providerId);
      const usedAccounts = [];
      for (const account of accounts) {
        const usages = this.queryService.authenticationMcpUsageService.readAccountUsages(this.providerId, account.label);
        if (usages.some((usage) => usage.mcpServerId === this.mcpServerId)) {
          usedAccounts.push(account.label);
        }
      }
      return usedAccounts;
    } catch {
      return [];
    }
  }
}
class ProviderQuery extends BaseQuery {
  constructor(providerId, queryService) {
    super(providerId, queryService);
  }
  account(accountName) {
    return new AccountQuery(this.providerId, accountName, this.queryService);
  }
  extension(extensionId) {
    return new ProviderExtensionQuery(this.providerId, extensionId, this.queryService);
  }
  mcpServer(mcpServerId) {
    return new ProviderMcpServerQuery(this.providerId, mcpServerId, this.queryService);
  }
  async getActiveEntities() {
    const extensions = [];
    const mcpServers = [];
    try {
      const accounts = await this.queryService.authenticationService.getAccounts(this.providerId);
      for (const account of accounts) {
        const extensionUsages = this.queryService.authenticationUsageService.readAccountUsages(this.providerId, account.label);
        for (const usage of extensionUsages) {
          if (!extensions.includes(usage.extensionId)) {
            extensions.push(usage.extensionId);
          }
        }
        const mcpUsages = this.queryService.authenticationMcpUsageService.readAccountUsages(this.providerId, account.label);
        for (const usage of mcpUsages) {
          if (!mcpServers.includes(usage.mcpServerId)) {
            mcpServers.push(usage.mcpServerId);
          }
        }
      }
    } catch {
    }
    return { extensions, mcpServers };
  }
  async getAccountNames() {
    try {
      const accounts = await this.queryService.authenticationService.getAccounts(this.providerId);
      return accounts.map((account) => account.label);
    } catch {
      return [];
    }
  }
  async getUsageStats() {
    const recentActivity = [];
    let totalSessions = 0;
    let totalAccounts = 0;
    try {
      const accounts = await this.queryService.authenticationService.getAccounts(this.providerId);
      totalAccounts = accounts.length;
      for (const account of accounts) {
        const extensionUsages = this.queryService.authenticationUsageService.readAccountUsages(this.providerId, account.label);
        const mcpUsages = this.queryService.authenticationMcpUsageService.readAccountUsages(this.providerId, account.label);
        const allUsages = [...extensionUsages, ...mcpUsages];
        const usageCount = allUsages.length;
        const lastUsed = Math.max(...allUsages.map((u) => u.lastUsed), 0);
        if (usageCount > 0) {
          recentActivity.push({ accountName: account.label, lastUsed, usageCount });
        }
      }
      recentActivity.sort((a, b) => b.lastUsed - a.lastUsed);
      totalSessions = recentActivity.reduce((sum, activity) => sum + activity.usageCount, 0);
    } catch {
    }
    return { totalSessions, totalAccounts, recentActivity };
  }
  async forEachAccount(callback) {
    try {
      const accounts = await this.queryService.authenticationService.getAccounts(this.providerId);
      for (const account of accounts) {
        const accountQuery = new AccountQuery(this.providerId, account.label, this.queryService);
        callback(accountQuery);
      }
    } catch {
    }
  }
}
class ExtensionQuery {
  constructor(extensionId, queryService) {
    this.extensionId = extensionId;
    this.queryService = queryService;
  }
  async getProvidersWithAccess(includeInternal) {
    const providersWithAccess = [];
    const providerIds = this.queryService.authenticationService.getProviderIds();
    for (const providerId of providerIds) {
      if (!includeInternal && providerId.startsWith(INTERNAL_AUTH_PROVIDER_PREFIX)) {
        continue;
      }
      try {
        const accounts = await this.queryService.authenticationService.getAccounts(providerId);
        const hasAccess = accounts.some((account) => {
          const accessAllowed = this.queryService.authenticationAccessService.isAccessAllowed(providerId, account.label, this.extensionId);
          return accessAllowed === true;
        });
        if (hasAccess) {
          providersWithAccess.push(providerId);
        }
      } catch {
      }
    }
    return providersWithAccess;
  }
  getAllAccountPreferences(includeInternal) {
    const preferences = /* @__PURE__ */ new Map();
    const providerIds = this.queryService.authenticationService.getProviderIds();
    for (const providerId of providerIds) {
      if (!includeInternal && providerId.startsWith(INTERNAL_AUTH_PROVIDER_PREFIX)) {
        continue;
      }
      const preferredAccount = this.queryService.authenticationExtensionsService.getAccountPreference(this.extensionId, providerId);
      if (preferredAccount) {
        preferences.set(providerId, preferredAccount);
      }
    }
    return preferences;
  }
  provider(providerId) {
    return new ProviderExtensionQuery(providerId, this.extensionId, this.queryService);
  }
}
class McpServerQuery {
  constructor(mcpServerId, queryService) {
    this.mcpServerId = mcpServerId;
    this.queryService = queryService;
  }
  async getProvidersWithAccess(includeInternal) {
    const providersWithAccess = [];
    const providerIds = this.queryService.authenticationService.getProviderIds();
    for (const providerId of providerIds) {
      if (!includeInternal && providerId.startsWith(INTERNAL_AUTH_PROVIDER_PREFIX)) {
        continue;
      }
      try {
        const accounts = await this.queryService.authenticationService.getAccounts(providerId);
        const hasAccess = accounts.some((account) => {
          const accessAllowed = this.queryService.authenticationMcpAccessService.isAccessAllowed(providerId, account.label, this.mcpServerId);
          return accessAllowed === true;
        });
        if (hasAccess) {
          providersWithAccess.push(providerId);
        }
      } catch {
      }
    }
    return providersWithAccess;
  }
  getAllAccountPreferences(includeInternal) {
    const preferences = /* @__PURE__ */ new Map();
    const providerIds = this.queryService.authenticationService.getProviderIds();
    for (const providerId of providerIds) {
      if (!includeInternal && providerId.startsWith(INTERNAL_AUTH_PROVIDER_PREFIX)) {
        continue;
      }
      const preferredAccount = this.queryService.authenticationMcpService.getAccountPreference(this.mcpServerId, providerId);
      if (preferredAccount) {
        preferences.set(providerId, preferredAccount);
      }
    }
    return preferences;
  }
  provider(providerId) {
    return new ProviderMcpServerQuery(providerId, this.mcpServerId, this.queryService);
  }
}
let AuthenticationQueryService = class extends Disposable {
  constructor(authenticationService, authenticationUsageService, authenticationMcpUsageService, authenticationAccessService, authenticationMcpAccessService, authenticationExtensionsService, authenticationMcpService, logService) {
    super();
    this.authenticationService = authenticationService;
    this.authenticationUsageService = authenticationUsageService;
    this.authenticationMcpUsageService = authenticationMcpUsageService;
    this.authenticationAccessService = authenticationAccessService;
    this.authenticationMcpAccessService = authenticationMcpAccessService;
    this.authenticationExtensionsService = authenticationExtensionsService;
    this.authenticationMcpService = authenticationMcpService;
    this.logService = logService;
    this._onDidChangePreferences = this._register(new Emitter());
    this.onDidChangePreferences = this._onDidChangePreferences.event;
    this._onDidChangeAccess = this._register(new Emitter());
    this.onDidChangeAccess = this._onDidChangeAccess.event;
    this._register(this.authenticationExtensionsService.onDidChangeAccountPreference((e) => {
      this._onDidChangePreferences.fire({
        providerId: e.providerId,
        entityType: "extension",
        entityIds: e.extensionIds
      });
    }));
    this._register(this.authenticationMcpService.onDidChangeAccountPreference((e) => {
      this._onDidChangePreferences.fire({
        providerId: e.providerId,
        entityType: "mcpServer",
        entityIds: e.mcpServerIds
      });
    }));
    this._register(this.authenticationAccessService.onDidChangeExtensionSessionAccess((e) => {
      this._onDidChangeAccess.fire({
        providerId: e.providerId,
        accountName: e.accountName
      });
    }));
    this._register(this.authenticationMcpAccessService.onDidChangeMcpSessionAccess((e) => {
      this._onDidChangeAccess.fire({
        providerId: e.providerId,
        accountName: e.accountName
      });
    }));
  }
  provider(providerId) {
    return new ProviderQuery(providerId, this);
  }
  extension(extensionId) {
    return new ExtensionQuery(extensionId, this);
  }
  mcpServer(mcpServerId) {
    return new McpServerQuery(mcpServerId, this);
  }
  getProviderIds(includeInternal) {
    return this.authenticationService.getProviderIds().filter((providerId) => {
      return includeInternal || !providerId.startsWith(INTERNAL_AUTH_PROVIDER_PREFIX);
    });
  }
  async clearAllData(confirmation, includeInternal = true) {
    if (confirmation !== "CLEAR_ALL_AUTH_DATA") {
      throw new Error("Must provide confirmation string to clear all authentication data");
    }
    const providerIds = this.getProviderIds(includeInternal);
    for (const providerId of providerIds) {
      try {
        const accounts = await this.authenticationService.getAccounts(providerId);
        for (const account of accounts) {
          this.authenticationAccessService.removeAllowedExtensions(providerId, account.label);
          this.authenticationUsageService.removeAccountUsage(providerId, account.label);
          this.authenticationMcpAccessService.removeAllowedMcpServers(providerId, account.label);
          this.authenticationMcpUsageService.removeAccountUsage(providerId, account.label);
        }
      } catch (error) {
        this.logService.error(`Error clearing data for provider ${providerId}:`, error);
      }
    }
    this.logService.info("All authentication data cleared");
  }
};
AuthenticationQueryService = __decorateClass([
  __decorateParam(0, IAuthenticationService),
  __decorateParam(1, IAuthenticationUsageService),
  __decorateParam(2, IAuthenticationMcpUsageService),
  __decorateParam(3, IAuthenticationAccessService),
  __decorateParam(4, IAuthenticationMcpAccessService),
  __decorateParam(5, IAuthenticationExtensionsService),
  __decorateParam(6, IAuthenticationMcpService),
  __decorateParam(7, ILogService)
], AuthenticationQueryService);
registerSingleton(IAuthenticationQueryService, AuthenticationQueryService, InstantiationType.Delayed);
export {
  AuthenticationQueryService
};
