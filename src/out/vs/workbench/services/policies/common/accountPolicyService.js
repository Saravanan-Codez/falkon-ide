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
import { localize } from "../../../../nls.js";
import { RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { collectManagedSettingsDefinitions, hasManagedSettingsDefinitions, projectManagedSettings, pickManagedSettings } from "../../../../platform/policy/common/copilotManagedSettings.js";
import { AbstractPolicyService, getRestrictedPolicyValue, PolicyValueSource } from "../../../../platform/policy/common/policy.js";
import { IDefaultAccountService } from "../../../../platform/defaultAccount/common/defaultAccount.js";
const APPROVED_ACCOUNT_ORGANIZATIONS_POLICY_NAME = "ChatApprovedAccountOrganizations";
var AccountPolicyGateState = /* @__PURE__ */ ((AccountPolicyGateState2) => {
  AccountPolicyGateState2["Inactive"] = "inactive";
  AccountPolicyGateState2["Satisfied"] = "satisfied";
  AccountPolicyGateState2["Restricted"] = "restricted";
  return AccountPolicyGateState2;
})(AccountPolicyGateState || {});
var AccountPolicyGateUnsatisfiedReason = /* @__PURE__ */ ((AccountPolicyGateUnsatisfiedReason2) => {
  AccountPolicyGateUnsatisfiedReason2["NoAccount"] = "noAccount";
  AccountPolicyGateUnsatisfiedReason2["WrongProvider"] = "wrongProvider";
  AccountPolicyGateUnsatisfiedReason2["OrgNotApproved"] = "orgNotApproved";
  AccountPolicyGateUnsatisfiedReason2["PolicyNotResolved"] = "policyNotResolved";
  return AccountPolicyGateUnsatisfiedReason2;
})(AccountPolicyGateUnsatisfiedReason || {});
const ChatAccountPolicyGateActiveContext = new RawContextKey(
  "chatAccountPolicyGateActive",
  false,
  { type: "boolean", description: localize("chatAccountPolicyGateActive", "True when the 'Require Approved Account' policy is in effect and the user is not yet signed into an approved GitHub organization, so all AI features are disabled until they sign in.") }
);
const IAccountPolicyGateService = createDecorator("accountPolicyGateService");
let AccountPolicyService = class extends AbstractPolicyService {
  constructor(logService, defaultAccountService, managedPolicyService, nativeManagedSettingsService, fileManagedSettingsService) {
    super();
    this.logService = logService;
    this.defaultAccountService = defaultAccountService;
    this._gateInfo = { state: "inactive" /* Inactive */ };
    this._onDidChangeGateInfo = this._register(new Emitter());
    this.onDidChangeGateInfo = this._onDidChangeGateInfo.event;
    this.managedPolicyReader = managedPolicyService;
    this.nativeManagedSettingsService = nativeManagedSettingsService;
    this.fileManagedSettingsService = fileManagedSettingsService;
    this._updatePolicyDefinitions(this.policyDefinitions);
    this._register(this.defaultAccountService.onDidChangePolicyData(() => {
      this._updatePolicyDefinitions(this.policyDefinitions);
    }));
    this._register(this.defaultAccountService.onDidChangeDefaultAccount(() => {
      this._updatePolicyDefinitions(this.policyDefinitions);
    }));
    if (this.managedPolicyReader) {
      this._register(this.managedPolicyReader.onDidChange((names) => {
        if (names.includes(APPROVED_ACCOUNT_ORGANIZATIONS_POLICY_NAME)) {
          this._updatePolicyDefinitions(this.policyDefinitions);
        }
      }));
    }
    if (this.nativeManagedSettingsService) {
      this._register(this.nativeManagedSettingsService.onDidChangeManagedSettings(() => {
        this._updatePolicyDefinitions(this.policyDefinitions);
      }));
    }
    if (this.fileManagedSettingsService) {
      this._register(this.fileManagedSettingsService.onDidChangeManagedSettings(() => {
        this._updatePolicyDefinitions(this.policyDefinitions);
      }));
    }
    this.defaultAccountService.getDefaultAccount().then(() => {
      this._updatePolicyDefinitions(this.policyDefinitions);
    });
  }
  get gateInfo() {
    return this._gateInfo;
  }
  async _updatePolicyDefinitions(policyDefinitions) {
    this.logService.trace(`AccountPolicyService#_updatePolicyDefinitions: Got ${Object.keys(policyDefinitions).length} policy definitions`);
    const managedSettings = await this.updateCopilotManagedSettingDefinitions(policyDefinitions);
    const updated = [];
    const resolvedPolicyData = this.getPolicyData(managedSettings);
    const previousInfo = this._gateInfo;
    this._gateInfo = this.computeGateInfo();
    const previousApprovedOrgs = previousInfo.approvedOrganizations?.join("\n") ?? "";
    const currentApprovedOrgs = this._gateInfo.approvedOrganizations?.join("\n") ?? "";
    const gateInfoChanged = previousInfo.state !== this._gateInfo.state || previousInfo.reason !== this._gateInfo.reason || previousApprovedOrgs !== currentApprovedOrgs;
    const gateRestricted = this._gateInfo.state === "restricted" /* Restricted */ && this._gateInfo.reason !== "policyNotResolved" /* PolicyNotResolved */;
    for (const key in policyDefinitions) {
      const resolvedPolicy = this.resolvePolicyValue(policyDefinitions[key], resolvedPolicyData, gateRestricted);
      if (this.updatePolicyValue(key, resolvedPolicy?.value, resolvedPolicy?.source)) {
        updated.push(key);
      }
    }
    if (updated.length) {
      this._onDidChange.fire(updated);
    }
    if (gateInfoChanged) {
      this._onDidChangeGateInfo.fire(this._gateInfo);
    }
  }
  resolvePolicyValue(policy, resolvedPolicyData, gateRestricted) {
    if (gateRestricted && (policy.value !== void 0 || policy.restrictedValue !== void 0)) {
      return { value: getRestrictedPolicyValue(policy), source: PolicyValueSource.AccountGate };
    }
    const valueProvider = policy.value;
    if (!resolvedPolicyData || !valueProvider) {
      return void 0;
    }
    const { policyData, managedSettingResolutions } = resolvedPolicyData;
    const value = valueProvider(policyData);
    if (value === void 0) {
      return void 0;
    }
    let source = PolicyValueSource.Account;
    if (policy.managedSettings) {
      const managedSettings = policyData.managedSettings ?? {};
      const appliedKeys = Object.keys(policy.managedSettings).filter((key) => Object.hasOwn(managedSettings, key));
      if (appliedKeys.length > 0) {
        const withoutManagedSettingKeys = (keys) => ({
          ...policyData,
          managedSettings: Object.fromEntries(Object.entries(managedSettings).filter(([key]) => !keys.has(key)))
        });
        const allAppliedKeys = new Set(appliedKeys);
        if (valueProvider(withoutManagedSettingKeys(allAppliedKeys)) !== value) {
          const contributingChannels = /* @__PURE__ */ new Set();
          for (const key of appliedKeys) {
            const channel = managedSettingResolutions.get(key)?.source;
            if (channel) {
              contributingChannels.add(channel);
            }
          }
          const causalChannels = /* @__PURE__ */ new Set();
          for (const channel of contributingChannels) {
            const channelKeys = new Set(appliedKeys.filter((key) => managedSettingResolutions.get(key)?.source === channel));
            if (valueProvider(withoutManagedSettingKeys(channelKeys)) !== value) {
              causalChannels.add(channel);
            }
          }
          const channels = causalChannels.size > 0 ? causalChannels : contributingChannels;
          source = channels.size === 1 ? policyValueSourceForManagedSettingsChannel(Array.from(channels)[0]) : PolicyValueSource.MixedManagedSettings;
        }
      }
    }
    return { value, source };
  }
  async updateCopilotManagedSettingDefinitions(policyDefinitions) {
    if (!this.nativeManagedSettingsService || !hasManagedSettingsDefinitions(policyDefinitions)) {
      return this.nativeManagedSettingsService?.managedSettings;
    }
    return this.nativeManagedSettingsService.updatePolicyDefinitions(policyDefinitions);
  }
  getPolicyData(mdmManagedSettings) {
    const accountPolicyData = this.defaultAccountService.policyData ?? void 0;
    const nativeManagedSettings = mdmManagedSettings ?? this.nativeManagedSettingsService?.managedSettings;
    const fileManagedSettings = this.fileManagedSettingsService?.managedSettings;
    const pick = pickManagedSettings(nativeManagedSettings, accountPolicyData?.managedSettings, fileManagedSettings);
    if (!accountPolicyData && pick.activeSources.length === 0) {
      return void 0;
    }
    const declaredManagedSettings = collectManagedSettingsDefinitions(this.policyDefinitions);
    const managedSettingsData = projectManagedSettings(
      pick.values,
      declaredManagedSettings,
      (msg) => this.logService.warn(`[AccountPolicy] ${msg}`)
    );
    return {
      policyData: {
        ...accountPolicyData,
        managedSettings: managedSettingsData
      },
      managedSettingResolutions: pick.resolutions
    };
  }
  computeGateInfo() {
    if (!this.managedPolicyReader) {
      return { state: "inactive" /* Inactive */ };
    }
    const approvedRaw = this.managedPolicyReader.getPolicyValue(APPROVED_ACCOUNT_ORGANIZATIONS_POLICY_NAME);
    const approvedOrgs = parseApprovedOrganizations(approvedRaw);
    if (approvedOrgs.length === 0) {
      return { state: "inactive" /* Inactive */ };
    }
    const account = this.defaultAccountService.currentDefaultAccount;
    if (!account) {
      return { state: "restricted" /* Restricted */, reason: "noAccount" /* NoAccount */, approvedOrganizations: approvedOrgs };
    }
    const configuredProvider = this.defaultAccountService.getDefaultAccountAuthenticationProvider();
    if (account.authenticationProvider.id !== configuredProvider.id) {
      return { state: "restricted" /* Restricted */, reason: "wrongProvider" /* WrongProvider */, approvedOrganizations: approvedOrgs };
    }
    if (!approvedOrgs.includes("*")) {
      const accountOrgs = (account.entitlementsData?.organization_login_list ?? []).map((o) => o.toLowerCase());
      const intersects = accountOrgs.some((org) => approvedOrgs.includes(org));
      if (!intersects) {
        return { state: "restricted" /* Restricted */, reason: "orgNotApproved" /* OrgNotApproved */, approvedOrganizations: approvedOrgs };
      }
    }
    if (this.defaultAccountService.policyData === null) {
      return { state: "restricted" /* Restricted */, reason: "policyNotResolved" /* PolicyNotResolved */, approvedOrganizations: approvedOrgs };
    }
    return { state: "satisfied" /* Satisfied */, approvedOrganizations: approvedOrgs };
  }
};
AccountPolicyService = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, IDefaultAccountService)
], AccountPolicyService);
function policyValueSourceForManagedSettingsChannel(channel) {
  switch (channel) {
    case "nativeMdm":
      return PolicyValueSource.NativeMdm;
    case "server":
      return PolicyValueSource.ServerManagedSettings;
    case "file":
      return PolicyValueSource.FileManagedSettings;
  }
}
function parseApprovedOrganizations(raw) {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
    }
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((v) => typeof v === "string").map((s) => s.trim().toLowerCase()).filter((s) => s.length > 0);
}
export {
  APPROVED_ACCOUNT_ORGANIZATIONS_POLICY_NAME,
  AccountPolicyGateState,
  AccountPolicyGateUnsatisfiedReason,
  AccountPolicyService,
  ChatAccountPolicyGateActiveContext,
  IAccountPolicyGateService
};
