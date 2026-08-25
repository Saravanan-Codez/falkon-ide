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
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IPolicyService, PolicyValueSource } from "../../../../platform/policy/common/policy.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
var PolicyNames = /* @__PURE__ */ ((PolicyNames2) => {
  PolicyNames2["DefaultModel"] = "ChatDefaultModel";
  PolicyNames2["ToolsAutoApprove"] = "ChatToolsAutoApprove";
  PolicyNames2["EnabledPlugins"] = "ChatEnabledPlugins";
  PolicyNames2["ExtraMarketplaces"] = "ChatExtraMarketplaces";
  PolicyNames2["StrictMarketplaces"] = "ChatStrictMarketplaces";
  PolicyNames2["ApprovedOrgs"] = "ChatApprovedAccountOrganizations";
  PolicyNames2["OtelEnabled"] = "CopilotOtelEnabled";
  PolicyNames2["TelemetryLevel"] = "TelemetryLevel";
  PolicyNames2["EnableFeedback"] = "EnableFeedback";
  return PolicyNames2;
})(PolicyNames || {});
let PolicyTelemetryContribution = class extends Disposable {
  constructor(policyService, telemetryService) {
    super();
    this.policyService = policyService;
    this.telemetryService = telemetryService;
    this.scheduler = this._register(new RunOnceScheduler(() => this.report(), 500));
    this.scheduler.schedule();
    this._register(this.policyService.onDidChange(() => this.scheduler.schedule()));
  }
  static {
    this.ID = "workbench.contrib.policyTelemetry";
  }
  report() {
    const event = this.buildEvent();
    const signature = JSON.stringify(event);
    if (signature === this.lastSignature) {
      return;
    }
    this.lastSignature = signature;
    this.telemetryService.publicLog2("policy.applied", event);
  }
  buildEvent() {
    const value = (name) => this.policyService.getPolicyValue(name);
    let devicePolicyCount = 0;
    let nativeMdmPolicyCount = 0;
    let serverManagedSettingsPolicyCount = 0;
    let fileManagedSettingsPolicyCount = 0;
    let mixedManagedSettingsPolicyCount = 0;
    let accountPolicyCount = 0;
    let accountGatePolicyCount = 0;
    for (const name in this.policyService.policyDefinitions) {
      if (value(name) !== void 0) {
        switch (this.policyService.getPolicyValueSource(name) ?? PolicyValueSource.Device) {
          case PolicyValueSource.Device:
            devicePolicyCount++;
            break;
          case PolicyValueSource.NativeMdm:
            nativeMdmPolicyCount++;
            break;
          case PolicyValueSource.ServerManagedSettings:
            serverManagedSettingsPolicyCount++;
            break;
          case PolicyValueSource.FileManagedSettings:
            fileManagedSettingsPolicyCount++;
            break;
          case PolicyValueSource.MixedManagedSettings:
            mixedManagedSettingsPolicyCount++;
            break;
          case PolicyValueSource.Account:
            accountPolicyCount++;
            break;
          case PolicyValueSource.AccountGate:
            accountGatePolicyCount++;
            break;
        }
      }
    }
    const defaultModel = value("ChatDefaultModel" /* DefaultModel */);
    const toolsAutoApprove = value("ChatToolsAutoApprove" /* ToolsAutoApprove */);
    const strictMarketplaces = value("ChatStrictMarketplaces" /* StrictMarketplaces */);
    const otel = value("CopilotOtelEnabled" /* OtelEnabled */);
    const telemetryLevel = value("TelemetryLevel" /* TelemetryLevel */);
    return {
      devicePolicyCount,
      nativeMdmPolicyCount,
      serverManagedSettingsPolicyCount,
      fileManagedSettingsPolicyCount,
      mixedManagedSettingsPolicyCount,
      accountPolicyCount,
      accountGatePolicyCount,
      defaultModelSet: defaultModel !== void 0,
      toolsAutoApproveSet: toolsAutoApprove !== void 0,
      enabledPluginsSet: value("ChatEnabledPlugins" /* EnabledPlugins */) !== void 0,
      extraMarketplacesSet: value("ChatExtraMarketplaces" /* ExtraMarketplaces */) !== void 0,
      strictMarketplacesSet: strictMarketplaces !== void 0,
      approvedOrgsSet: value("ChatApprovedAccountOrganizations" /* ApprovedOrgs */) !== void 0,
      otelSet: otel !== void 0,
      telemetryLevelSet: telemetryLevel !== void 0,
      enableFeedbackSet: value("EnableFeedback" /* EnableFeedback */) !== void 0,
      defaultModelForcedToAuto: defaultModel === "auto",
      toolsAutoApproveForcedOff: toolsAutoApprove === false,
      strictMarketplacesLockdown: isEmptyMarketplaceAllowlist(strictMarketplaces),
      otelForcedEnabled: otel === true,
      telemetryLevel: telemetryLevelBucket(telemetryLevel)
    };
  }
};
PolicyTelemetryContribution = __decorateClass([
  __decorateParam(0, IPolicyService),
  __decorateParam(1, ITelemetryService)
], PolicyTelemetryContribution);
function isEmptyMarketplaceAllowlist(rawValue) {
  if (typeof rawValue !== "string") {
    return false;
  }
  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) && parsed.length === 0;
  } catch {
    return false;
  }
}
const KNOWN_TELEMETRY_LEVELS = /* @__PURE__ */ new Set(["off", "crash", "error", "all"]);
function telemetryLevelBucket(rawValue) {
  if (rawValue === void 0) {
    return void 0;
  }
  return typeof rawValue === "string" && KNOWN_TELEMETRY_LEVELS.has(rawValue) ? rawValue : "unknown";
}
registerWorkbenchContribution2(PolicyTelemetryContribution.ID, PolicyTelemetryContribution, WorkbenchPhase.AfterRestored);
export {
  PolicyTelemetryContribution
};
