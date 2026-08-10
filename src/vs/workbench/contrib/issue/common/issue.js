import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
var IssueType = /* @__PURE__ */ ((IssueType2) => {
  IssueType2[IssueType2["Bug"] = 0] = "Bug";
  IssueType2[IssueType2["PerformanceIssue"] = 1] = "PerformanceIssue";
  IssueType2[IssueType2["FeatureRequest"] = 2] = "FeatureRequest";
  return IssueType2;
})(IssueType || {});
var IssueSource = /* @__PURE__ */ ((IssueSource2) => {
  IssueSource2["VSCode"] = "vscode";
  IssueSource2["AgentsWindow"] = "agentsWindow";
  IssueSource2["Extension"] = "extension";
  IssueSource2["Marketplace"] = "marketplace";
  IssueSource2["Unknown"] = "unknown";
  return IssueSource2;
})(IssueSource || {});
const IIssueFormService = createDecorator("issueFormService");
const IWorkbenchIssueService = createDecorator("workbenchIssueService");
export {
  IIssueFormService,
  IWorkbenchIssueService,
  IssueSource,
  IssueType
};
