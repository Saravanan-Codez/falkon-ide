import { Codicon } from "../../../../base/common/codicons.js";
import { themeColorFromId } from "../../../../base/common/themables.js";
var GitHubPullRequestState = /* @__PURE__ */ ((GitHubPullRequestState2) => {
  GitHubPullRequestState2["Open"] = "open";
  GitHubPullRequestState2["Closed"] = "closed";
  GitHubPullRequestState2["Merged"] = "merged";
  return GitHubPullRequestState2;
})(GitHubPullRequestState || {});
var MergeBlockerKind = /* @__PURE__ */ ((MergeBlockerKind2) => {
  MergeBlockerKind2["ChangesRequested"] = "changesRequested";
  MergeBlockerKind2["CIFailed"] = "ciFailed";
  MergeBlockerKind2["ApprovalNeeded"] = "approvalNeeded";
  MergeBlockerKind2["Conflicts"] = "conflicts";
  MergeBlockerKind2["Draft"] = "draft";
  MergeBlockerKind2["Unknown"] = "unknown";
  return MergeBlockerKind2;
})(MergeBlockerKind || {});
function computePullRequestIcon(state, status) {
  switch (state) {
    case "merged" /* Merged */:
      return { ...Codicon.gitPullRequestDone, color: themeColorFromId("charts.purple") };
    case "closed" /* Closed */:
      return { ...Codicon.gitPullRequestClosed, color: themeColorFromId("charts.red") };
    case "draft":
      return { ...Codicon.gitPullRequestDraft, color: themeColorFromId("descriptionForeground") };
    case "open" /* Open */:
      if (status?.hasFailingChecks) {
        return { ...Codicon.gitPullRequestError, color: themeColorFromId("charts.orange") };
      }
      if (status?.hasUnresolvedComments) {
        return { ...Codicon.gitPullRequestComment, color: themeColorFromId("charts.green") };
      }
      return { ...Codicon.gitPullRequest, color: themeColorFromId("charts.green") };
  }
}
var GitHubIssueState = /* @__PURE__ */ ((GitHubIssueState2) => {
  GitHubIssueState2["Open"] = "open";
  GitHubIssueState2["Closed"] = "closed";
  return GitHubIssueState2;
})(GitHubIssueState || {});
var GitHubIssueStateReason = /* @__PURE__ */ ((GitHubIssueStateReason2) => {
  GitHubIssueStateReason2["Completed"] = "completed";
  GitHubIssueStateReason2["NotPlanned"] = "not_planned";
  GitHubIssueStateReason2["Duplicate"] = "duplicate";
  GitHubIssueStateReason2["Reopened"] = "reopened";
  return GitHubIssueStateReason2;
})(GitHubIssueStateReason || {});
function computeIssueIcon(state, stateReason) {
  if (state === "open" /* Open */) {
    return { ...Codicon.issueOpened, color: themeColorFromId("charts.green") };
  }
  if (stateReason === "not_planned" /* NotPlanned */ || stateReason === "duplicate" /* Duplicate */) {
    return { ...Codicon.issueClosed, color: themeColorFromId("descriptionForeground") };
  }
  return { ...Codicon.issueClosed, color: themeColorFromId("charts.purple") };
}
function computeAggregateIssueIcon(issues) {
  if (issues.length === 0 || issues.some((issue) => !issue || issue.state === "open" /* Open */)) {
    return computeIssueIcon("open" /* Open */, void 0);
  }
  const allDiscarded = issues.every((issue) => issue.stateReason === "not_planned" /* NotPlanned */ || issue.stateReason === "duplicate" /* Duplicate */);
  return computeIssueIcon("closed" /* Closed */, allDiscarded ? "not_planned" /* NotPlanned */ : "completed" /* Completed */);
}
var GitHubCheckStatus = /* @__PURE__ */ ((GitHubCheckStatus2) => {
  GitHubCheckStatus2["Queued"] = "queued";
  GitHubCheckStatus2["InProgress"] = "in_progress";
  GitHubCheckStatus2["Completed"] = "completed";
  return GitHubCheckStatus2;
})(GitHubCheckStatus || {});
var GitHubCheckConclusion = /* @__PURE__ */ ((GitHubCheckConclusion2) => {
  GitHubCheckConclusion2["Success"] = "success";
  GitHubCheckConclusion2["Failure"] = "failure";
  GitHubCheckConclusion2["Neutral"] = "neutral";
  GitHubCheckConclusion2["Cancelled"] = "cancelled";
  GitHubCheckConclusion2["Skipped"] = "skipped";
  GitHubCheckConclusion2["TimedOut"] = "timed_out";
  GitHubCheckConclusion2["ActionRequired"] = "action_required";
  GitHubCheckConclusion2["Stale"] = "stale";
  return GitHubCheckConclusion2;
})(GitHubCheckConclusion || {});
var GitHubCIOverallStatus = /* @__PURE__ */ ((GitHubCIOverallStatus2) => {
  GitHubCIOverallStatus2["Pending"] = "pending";
  GitHubCIOverallStatus2["Success"] = "success";
  GitHubCIOverallStatus2["Failure"] = "failure";
  GitHubCIOverallStatus2["Neutral"] = "neutral";
  return GitHubCIOverallStatus2;
})(GitHubCIOverallStatus || {});
export {
  GitHubCIOverallStatus,
  GitHubCheckConclusion,
  GitHubCheckStatus,
  GitHubIssueState,
  GitHubIssueStateReason,
  GitHubPullRequestState,
  MergeBlockerKind,
  computeAggregateIssueIcon,
  computeIssueIcon,
  computePullRequestIcon
};
