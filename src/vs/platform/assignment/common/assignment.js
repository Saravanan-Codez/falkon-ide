import * as platform from "../../../base/common/platform.js";
const ASSIGNMENT_STORAGE_KEY = "VSCode.ABExp.FeatureData";
const ASSIGNMENT_REFETCH_INTERVAL = 60 * 60 * 1e3;
var TargetPopulation = /* @__PURE__ */ ((TargetPopulation2) => {
  TargetPopulation2["Insiders"] = "insider";
  TargetPopulation2["Public"] = "public";
  TargetPopulation2["Exploration"] = "exploration";
  return TargetPopulation2;
})(TargetPopulation || {});
var Filters = /* @__PURE__ */ ((Filters2) => {
  Filters2["Market"] = "X-MSEdge-Market";
  Filters2["CorpNet"] = "X-FD-Corpnet";
  Filters2["ApplicationVersion"] = "X-VSCode-AppVersion";
  Filters2["Build"] = "X-VSCode-Build";
  Filters2["ClientId"] = "X-MSEdge-ClientId";
  Filters2["DeveloperDeviceId"] = "X-VSCode-DevDeviceId";
  Filters2["ExtensionName"] = "X-VSCode-ExtensionName";
  Filters2["ExtensionVersion"] = "X-VSCode-ExtensionVersion";
  Filters2["Language"] = "X-VSCode-Language";
  Filters2["TargetPopulation"] = "X-VSCode-TargetPopulation";
  Filters2["Platform"] = "X-VSCode-Platform";
  Filters2["ReleaseDate"] = "X-VSCode-ReleaseDate";
  Filters2["WindowKind"] = "X-VSCode-WindowKind";
  return Filters2;
})(Filters || {});
var WindowKind = /* @__PURE__ */ ((WindowKind2) => {
  WindowKind2["Editor"] = "editor";
  WindowKind2["Agents"] = "agents";
  return WindowKind2;
})(WindowKind || {});
class AssignmentFilterProvider {
  constructor(version, appName, machineId, devDeviceId, targetPopulation, releaseDate, windowKind) {
    this.version = version;
    this.appName = appName;
    this.machineId = machineId;
    this.devDeviceId = devDeviceId;
    this.targetPopulation = targetPopulation;
    this.releaseDate = releaseDate;
    this.windowKind = windowKind;
  }
  getFilterValue(filter) {
    switch (filter) {
      case "X-VSCode-AppVersion" /* ApplicationVersion */:
        return trimVersionSuffix(this.version);
      // productService.version
      case "X-VSCode-Build" /* Build */:
        return this.appName;
      // productService.nameLong
      case "X-MSEdge-ClientId" /* ClientId */:
        return this.machineId;
      case "X-VSCode-DevDeviceId" /* DeveloperDeviceId */:
        return this.devDeviceId;
      case "X-VSCode-Language" /* Language */:
        return platform.language;
      case "X-VSCode-ExtensionName" /* ExtensionName */:
        return "vscode-core";
      // always return vscode-core for exp service
      case "X-VSCode-ExtensionVersion" /* ExtensionVersion */:
        return "999999.0";
      // always return a very large number for cross-extension experimentation
      case "X-VSCode-TargetPopulation" /* TargetPopulation */:
        return this.targetPopulation;
      case "X-VSCode-Platform" /* Platform */:
        return platform.PlatformToString(platform.platform);
      case "X-VSCode-ReleaseDate" /* ReleaseDate */:
        return formatReleaseDate(this.releaseDate);
      case "X-VSCode-WindowKind" /* WindowKind */:
        return this.windowKind;
      default:
        return "";
    }
  }
  getFilters() {
    const filters = /* @__PURE__ */ new Map();
    const filterValues = Object.values(Filters);
    for (const value of filterValues) {
      filters.set(value, this.getFilterValue(value));
    }
    return filters;
  }
}
function trimVersionSuffix(version) {
  return version.split(/\-[a-zA-Z0-9]+$/)[0];
}
function formatReleaseDate(iso) {
  if (!iso) {
    return "";
  }
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2})/.exec(iso);
  if (!match) {
    return "";
  }
  return match.slice(1, 5).join("");
}
var AssignmentsFilters = /* @__PURE__ */ ((AssignmentsFilters2) => {
  AssignmentsFilters2["ApplicationVersion"] = "vscode_core_appversion";
  AssignmentsFilters2["Build"] = "vscode_core_build";
  AssignmentsFilters2["DeveloperDeviceId"] = "devdeviceid";
  AssignmentsFilters2["ExtensionName"] = "vscode_core_extensionname";
  AssignmentsFilters2["ExtensionNameShort"] = "extensionname";
  AssignmentsFilters2["TargetPopulation"] = "vscode_core_targetpopulation";
  AssignmentsFilters2["Platform"] = "vscode_core_platform";
  AssignmentsFilters2["ReleaseDate"] = "vscode_core_releasedate";
  AssignmentsFilters2["WindowKind"] = "vscode_core_windowkind";
  return AssignmentsFilters2;
})(AssignmentsFilters || {});
class VSCodeCoreAssignmentsFilterProvider {
  constructor(version, appName, devDeviceId, targetPopulation, releaseDate, windowKind) {
    this.version = version;
    this.appName = appName;
    this.devDeviceId = devDeviceId;
    this.targetPopulation = targetPopulation;
    this.releaseDate = releaseDate;
    this.windowKind = windowKind;
  }
  getFilterValue(filter) {
    switch (filter) {
      case "vscode_core_appversion" /* ApplicationVersion */:
        return trimVersionSuffix(this.version);
      case "vscode_core_build" /* Build */:
        return this.appName;
      case "devdeviceid" /* DeveloperDeviceId */:
        return this.devDeviceId;
      case "vscode_core_extensionname" /* ExtensionName */:
      case "extensionname" /* ExtensionNameShort */:
        return "vscode-core";
      case "vscode_core_targetpopulation" /* TargetPopulation */:
        return this.targetPopulation;
      case "vscode_core_platform" /* Platform */:
        return platform.PlatformToString(platform.platform);
      case "vscode_core_releasedate" /* ReleaseDate */:
        return formatReleaseDate(this.releaseDate);
      case "vscode_core_windowkind" /* WindowKind */:
        return this.windowKind;
      default:
        return null;
    }
  }
  getFilters() {
    const filters = /* @__PURE__ */ new Map();
    for (const value of Object.values(AssignmentsFilters)) {
      filters.set(value, this.getFilterValue(value));
    }
    return filters;
  }
}
function getInternalOrg(organisations) {
  const isVSCodeInternal = organisations?.includes("Visual-Studio-Code");
  const isGitHubInternal = organisations?.includes("github");
  const isMicrosoftInternal = organisations?.includes("microsoft") || organisations?.includes("ms-copilot") || organisations?.includes("MicrosoftCopilot");
  return isVSCodeInternal ? "vscode" : isGitHubInternal ? "github" : isMicrosoftInternal ? "microsoft" : void 0;
}
export {
  ASSIGNMENT_REFETCH_INTERVAL,
  ASSIGNMENT_STORAGE_KEY,
  AssignmentFilterProvider,
  AssignmentsFilters,
  Filters,
  TargetPopulation,
  VSCodeCoreAssignmentsFilterProvider,
  WindowKind,
  getInternalOrg
};
