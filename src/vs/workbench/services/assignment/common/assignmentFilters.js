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
import { getInternalOrg } from "../../../../platform/assignment/common/assignment.js";
import { IDefaultAccountService } from "../../../../platform/defaultAccount/common/defaultAccount.js";
import { ExtensionIdentifier } from "../../../../platform/extensions/common/extensions.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IChatEntitlementService } from "../../chat/common/chatEntitlementService.js";
import { IExtensionService } from "../../extensions/common/extensions.js";
var ExtensionsFilter = /* @__PURE__ */ ((ExtensionsFilter2) => {
  ExtensionsFilter2["CopilotExtensionVersion"] = "X-Copilot-RelatedPluginVersion-githubcopilot";
  ExtensionsFilter2["CopilotChatExtensionVersion"] = "X-Copilot-RelatedPluginVersion-githubcopilotchat";
  ExtensionsFilter2["CompletionsVersionInCopilotChat"] = "X-VSCode-CompletionsInChatExtensionVersion";
  ExtensionsFilter2["CopilotSku"] = "X-GitHub-Copilot-SKU";
  ExtensionsFilter2["MicrosoftInternalOrg"] = "X-Microsoft-Internal-Org";
  ExtensionsFilter2["CopilotTrackingId"] = "X-Copilot-CopilotTrackingId";
  ExtensionsFilter2["CopilotIsSn"] = "X-GitHub-Copilot-IsSn";
  ExtensionsFilter2["CopilotIsFcv1"] = "X-GitHub-Copilot-IsFcv1";
  return ExtensionsFilter2;
})(ExtensionsFilter || {});
var StorageVersionKeys = /* @__PURE__ */ ((StorageVersionKeys2) => {
  StorageVersionKeys2["CopilotExtensionVersion"] = "extensionsAssignmentFilterProvider.copilotExtensionVersion";
  StorageVersionKeys2["CopilotChatExtensionVersion"] = "extensionsAssignmentFilterProvider.copilotChatExtensionVersion";
  StorageVersionKeys2["CompletionsVersion"] = "extensionsAssignmentFilterProvider.copilotCompletionsVersion";
  StorageVersionKeys2["CopilotSku"] = "extensionsAssignmentFilterProvider.copilotSku";
  StorageVersionKeys2["CopilotInternalOrg"] = "extensionsAssignmentFilterProvider.copilotInternalOrg";
  StorageVersionKeys2["CopilotTrackingId"] = "extensionsAssignmentFilterProvider.copilotTrackingId";
  StorageVersionKeys2["CopilotIsSn"] = "extensionsAssignmentFilterProvider.copilotIsSn";
  StorageVersionKeys2["CopilotIsFcv1"] = "extensionsAssignmentFilterProvider.copilotIsFcv1";
  return StorageVersionKeys2;
})(StorageVersionKeys || {});
let CopilotAssignmentFilterProvider = class extends Disposable {
  constructor(_extensionService, _logService, _storageService, _chatEntitlementService, _defaultAccountService) {
    super();
    this._extensionService = _extensionService;
    this._logService = _logService;
    this._storageService = _storageService;
    this._chatEntitlementService = _chatEntitlementService;
    this._defaultAccountService = _defaultAccountService;
    this._onDidChangeFilters = this._register(new Emitter());
    this.onDidChangeFilters = this._onDidChangeFilters.event;
    this.copilotExtensionVersion = this._storageService.get("extensionsAssignmentFilterProvider.copilotExtensionVersion" /* CopilotExtensionVersion */, StorageScope.PROFILE);
    this.copilotChatExtensionVersion = this._storageService.get("extensionsAssignmentFilterProvider.copilotChatExtensionVersion" /* CopilotChatExtensionVersion */, StorageScope.PROFILE);
    this.copilotCompletionsVersion = this._storageService.get("extensionsAssignmentFilterProvider.copilotCompletionsVersion" /* CompletionsVersion */, StorageScope.PROFILE);
    this.copilotSku = this._storageService.get("extensionsAssignmentFilterProvider.copilotSku" /* CopilotSku */, StorageScope.PROFILE);
    this.copilotInternalOrg = this._storageService.get("extensionsAssignmentFilterProvider.copilotInternalOrg" /* CopilotInternalOrg */, StorageScope.PROFILE);
    this.copilotTrackingId = this._storageService.get("extensionsAssignmentFilterProvider.copilotTrackingId" /* CopilotTrackingId */, StorageScope.PROFILE);
    this.copilotIsSn = this._storageService.get("extensionsAssignmentFilterProvider.copilotIsSn" /* CopilotIsSn */, StorageScope.PROFILE);
    this.copilotIsFcv1 = this._storageService.get("extensionsAssignmentFilterProvider.copilotIsFcv1" /* CopilotIsFcv1 */, StorageScope.PROFILE);
    this.updateExtensionVersions();
    this.updateCopilotEntitlementInfo();
    this.updateCopilotTokenInfo();
    this._register(this._extensionService.onDidChangeExtensionsStatus((extensionIdentifiers) => {
      if (extensionIdentifiers.some((identifier) => ExtensionIdentifier.equals(identifier, "github.copilot") || ExtensionIdentifier.equals(identifier, "github.copilot-chat"))) {
        this.updateExtensionVersions();
      }
    }));
    this._register(this._chatEntitlementService.onDidChangeEntitlement(() => {
      this.updateCopilotEntitlementInfo();
    }));
    this._register(this._defaultAccountService.onDidChangeCopilotTokenInfo(() => {
      this.updateCopilotTokenInfo();
    }));
  }
  async updateExtensionVersions() {
    let copilotExtensionVersion;
    let copilotChatExtensionVersion;
    let copilotCompletionsVersion;
    try {
      const [copilotExtension, copilotChatExtension] = await Promise.all([
        this._extensionService.getExtension("github.copilot"),
        this._extensionService.getExtension("github.copilot-chat")
      ]);
      copilotExtensionVersion = copilotExtension?.version;
      copilotChatExtensionVersion = copilotChatExtension?.version;
      copilotCompletionsVersion = copilotChatExtension?.completionsCoreVersion;
    } catch (error) {
      this._logService.error("Failed to update extension version assignments", error);
    }
    if (this.copilotCompletionsVersion === copilotCompletionsVersion && this.copilotExtensionVersion === copilotExtensionVersion && this.copilotChatExtensionVersion === copilotChatExtensionVersion) {
      return;
    }
    this.copilotExtensionVersion = copilotExtensionVersion;
    this.copilotChatExtensionVersion = copilotChatExtensionVersion;
    this.copilotCompletionsVersion = copilotCompletionsVersion;
    this._storageService.store("extensionsAssignmentFilterProvider.copilotExtensionVersion" /* CopilotExtensionVersion */, this.copilotExtensionVersion, StorageScope.PROFILE, StorageTarget.MACHINE);
    this._storageService.store("extensionsAssignmentFilterProvider.copilotChatExtensionVersion" /* CopilotChatExtensionVersion */, this.copilotChatExtensionVersion, StorageScope.PROFILE, StorageTarget.MACHINE);
    this._storageService.store("extensionsAssignmentFilterProvider.copilotCompletionsVersion" /* CompletionsVersion */, this.copilotCompletionsVersion, StorageScope.PROFILE, StorageTarget.MACHINE);
    this._onDidChangeFilters.fire();
  }
  updateCopilotEntitlementInfo() {
    const newSku = this._chatEntitlementService.sku;
    const newTrackingId = this._chatEntitlementService.copilotTrackingId;
    const newInternalOrg = getInternalOrg(this._chatEntitlementService.organisations);
    if (this.copilotSku === newSku && this.copilotInternalOrg === newInternalOrg && this.copilotTrackingId === newTrackingId) {
      return;
    }
    this.copilotSku = newSku;
    this.copilotInternalOrg = newInternalOrg;
    this.copilotTrackingId = newTrackingId;
    this._storageService.store("extensionsAssignmentFilterProvider.copilotSku" /* CopilotSku */, this.copilotSku, StorageScope.PROFILE, StorageTarget.MACHINE);
    this._storageService.store("extensionsAssignmentFilterProvider.copilotInternalOrg" /* CopilotInternalOrg */, this.copilotInternalOrg, StorageScope.PROFILE, StorageTarget.MACHINE);
    this._storageService.store("extensionsAssignmentFilterProvider.copilotTrackingId" /* CopilotTrackingId */, this.copilotTrackingId, StorageScope.PROFILE, StorageTarget.MACHINE);
    this._onDidChangeFilters.fire();
  }
  updateCopilotTokenInfo() {
    const tokenInfo = this._defaultAccountService.copilotTokenInfo;
    const newIsSn = tokenInfo?.sn === "1" ? "1" : "0";
    const newIsFcv1 = tokenInfo?.fcv1 === "1" ? "1" : "0";
    if (this.copilotIsSn === newIsSn && this.copilotIsFcv1 === newIsFcv1) {
      return;
    }
    this.copilotIsSn = newIsSn;
    this.copilotIsFcv1 = newIsFcv1;
    this._storageService.store("extensionsAssignmentFilterProvider.copilotIsSn" /* CopilotIsSn */, this.copilotIsSn, StorageScope.PROFILE, StorageTarget.MACHINE);
    this._storageService.store("extensionsAssignmentFilterProvider.copilotIsFcv1" /* CopilotIsFcv1 */, this.copilotIsFcv1, StorageScope.PROFILE, StorageTarget.MACHINE);
    this._onDidChangeFilters.fire();
  }
  /**
   * Returns a version string that can be parsed by the TAS client.
   * The tas client cannot handle suffixes lke "-insider"
   * Ref: https://github.com/microsoft/tas-client/blob/30340d5e1da37c2789049fcf45928b954680606f/vscode-tas-client/src/vscode-tas-client/VSCodeFilterProvider.ts#L35
   *
   * @param version Version string to be trimmed.
  */
  static trimVersionSuffix(version) {
    const regex = /\-[a-zA-Z0-9]+$/;
    const result = version.split(regex);
    return result[0];
  }
  getFilterValue(filter) {
    switch (filter) {
      case "X-Copilot-RelatedPluginVersion-githubcopilot" /* CopilotExtensionVersion */:
        return this.copilotExtensionVersion ? CopilotAssignmentFilterProvider.trimVersionSuffix(this.copilotExtensionVersion) : null;
      case "X-VSCode-CompletionsInChatExtensionVersion" /* CompletionsVersionInCopilotChat */:
        return this.copilotCompletionsVersion ? CopilotAssignmentFilterProvider.trimVersionSuffix(this.copilotCompletionsVersion) : null;
      case "X-Copilot-RelatedPluginVersion-githubcopilotchat" /* CopilotChatExtensionVersion */:
        return this.copilotChatExtensionVersion ? CopilotAssignmentFilterProvider.trimVersionSuffix(this.copilotChatExtensionVersion) : null;
      case "X-GitHub-Copilot-SKU" /* CopilotSku */:
        return this.copilotSku ?? null;
      case "X-Microsoft-Internal-Org" /* MicrosoftInternalOrg */:
        return this.copilotInternalOrg ?? null;
      case "X-Copilot-CopilotTrackingId" /* CopilotTrackingId */:
        return this.copilotTrackingId ?? null;
      case "X-GitHub-Copilot-IsSn" /* CopilotIsSn */:
        return this.copilotIsSn ?? null;
      case "X-GitHub-Copilot-IsFcv1" /* CopilotIsFcv1 */:
        return this.copilotIsFcv1 ?? null;
      default:
        return null;
    }
  }
  getFilters() {
    const filters = /* @__PURE__ */ new Map();
    const filterValues = Object.values(ExtensionsFilter);
    for (const value of filterValues) {
      filters.set(value, this.getFilterValue(value));
    }
    return filters;
  }
};
CopilotAssignmentFilterProvider = __decorateClass([
  __decorateParam(0, IExtensionService),
  __decorateParam(1, ILogService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, IChatEntitlementService),
  __decorateParam(4, IDefaultAccountService)
], CopilotAssignmentFilterProvider);
var GitHubAssignmentsFilter = /* @__PURE__ */ ((GitHubAssignmentsFilter2) => {
  GitHubAssignmentsFilter2["CopilotTrackingId"] = "copilottrackingid";
  GitHubAssignmentsFilter2["IsGhOrMsftStaff"] = "github_core_isghormsftstaff";
  GitHubAssignmentsFilter2["GhMsftOrExternal"] = "github_core_ghmsftorexternal";
  return GitHubAssignmentsFilter2;
})(GitHubAssignmentsFilter || {});
let GitHubCoreAssignmentsFilterProvider = class extends Disposable {
  constructor(_chatEntitlementService) {
    super();
    this._chatEntitlementService = _chatEntitlementService;
    this._onDidChangeFilters = this._register(new Emitter());
    this.onDidChangeFilters = this._onDidChangeFilters.event;
    this._register(this._chatEntitlementService.onDidChangeEntitlement(() => this.update()));
    this.update();
  }
  update() {
    const newTrackingId = this._chatEntitlementService.copilotTrackingId ?? this.copilotTrackingId;
    const newInternalOrg = getInternalOrg(this._chatEntitlementService.organisations);
    if (this.copilotTrackingId === newTrackingId && this.internalOrg === newInternalOrg) {
      return;
    }
    this.copilotTrackingId = newTrackingId;
    this.internalOrg = newInternalOrg;
    this._onDidChangeFilters.fire();
  }
  getFilterValue(filter) {
    const liveTrackingId = this._chatEntitlementService.copilotTrackingId;
    if (liveTrackingId) {
      this.copilotTrackingId = liveTrackingId;
    }
    const copilotTrackingId = liveTrackingId ?? this.copilotTrackingId;
    const internalOrg = getInternalOrg(this._chatEntitlementService.organisations) ?? this.internalOrg;
    switch (filter) {
      case "copilottrackingid" /* CopilotTrackingId */:
        return copilotTrackingId ?? null;
      case "github_core_isghormsftstaff" /* IsGhOrMsftStaff */:
        return internalOrg ? "1" : "0";
      case "github_core_ghmsftorexternal" /* GhMsftOrExternal */:
        return internalOrg === "github" ? "github" : internalOrg === "microsoft" || internalOrg === "vscode" ? "microsoft" : "external";
      default:
        return null;
    }
  }
  getFilters() {
    const filters = /* @__PURE__ */ new Map();
    for (const value of Object.values(GitHubAssignmentsFilter)) {
      filters.set(value, this.getFilterValue(value));
    }
    return filters;
  }
};
GitHubCoreAssignmentsFilterProvider = __decorateClass([
  __decorateParam(0, IChatEntitlementService)
], GitHubCoreAssignmentsFilterProvider);
export {
  CopilotAssignmentFilterProvider,
  ExtensionsFilter,
  GitHubAssignmentsFilter,
  GitHubCoreAssignmentsFilterProvider
};
