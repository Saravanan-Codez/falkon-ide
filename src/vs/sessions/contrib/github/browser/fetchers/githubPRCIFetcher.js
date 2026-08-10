import { GitHubCheckConclusion, GitHubCheckStatus, GitHubCIOverallStatus } from "../../common/types.js";
class GitHubPRCIFetcher {
  constructor(_apiClient) {
    this._apiClient = _apiClient;
  }
  async getCheckRuns(owner, repo, ref, etag) {
    const response = await this._apiClient.request(
      "GET",
      `/repos/${e(owner)}/${e(repo)}/commits/${e(ref)}/check-runs`,
      "githubApi.getCheckRuns",
      { etag }
    );
    return {
      ...response,
      data: response.data ? response.data.check_runs.map(mapCheckRun) : void 0
    };
  }
  /**
   * Rerun failed jobs in a GitHub Actions workflow run.
   */
  async rerunFailedJobs(owner, repo, runId) {
    await this._apiClient.request(
      "POST",
      `/repos/${e(owner)}/${e(repo)}/actions/runs/${runId}/rerun-failed-jobs`,
      "githubApi.rerunFailedJobs"
    );
  }
  /**
   * Get logs/output for a specific check run.
   *
   * Tries multiple sources in order:
   * 1. The check run's own output fields (title, summary, text) — set by the
   *    check run creator via the Checks API.
   * 2. Annotations attached to the check run.
   * 3. GitHub Actions job logs (only works for GitHub Actions workflows).
   */
  async getCheckRunAnnotations(owner, repo, checkRunId) {
    const sections = [];
    try {
      const detailResponse = await this._apiClient.request(
        "GET",
        `/repos/${e(owner)}/${e(repo)}/check-runs/${checkRunId}`,
        "githubApi.getCheckRunAnnotations"
      );
      const output = detailResponse.data?.output;
      if (output?.title) {
        sections.push(`# ${output.title}`);
      }
      if (output?.summary) {
        sections.push(output.summary);
      }
      if (output?.text) {
        sections.push(output.text);
      }
    } catch {
    }
    try {
      const annotationsResponse = await this._apiClient.request(
        "GET",
        `/repos/${e(owner)}/${e(repo)}/check-runs/${checkRunId}/annotations`,
        "githubApi.getCheckRunAnnotations.annotations"
      );
      const annotations = annotationsResponse.data;
      if (annotations && annotations.length > 0) {
        sections.push(
          annotations.map(
            (a) => `[${a.annotation_level}] ${a.path}:${a.start_line}${a.end_line !== a.start_line ? `-${a.end_line}` : ""} ${a.title ? `(${a.title}) ` : ""}${a.message}`
          ).join("\n")
        );
      }
    } catch {
    }
    if (sections.length > 0) {
      return sections.join("\n\n");
    }
    return "No output available for this check run.";
  }
}
function e(value) {
  return encodeURIComponent(value);
}
function mapCheckRun(data) {
  return {
    id: data.id,
    name: data.name,
    status: mapCheckStatus(data.status),
    conclusion: data.conclusion ? mapCheckConclusion(data.conclusion) : void 0,
    startedAt: data.started_at ?? void 0,
    completedAt: data.completed_at ?? void 0,
    detailsUrl: data.details_url ?? void 0
  };
}
function mapCheckStatus(status) {
  switch (status) {
    case "queued":
      return GitHubCheckStatus.Queued;
    case "in_progress":
      return GitHubCheckStatus.InProgress;
    case "completed":
      return GitHubCheckStatus.Completed;
    default:
      return GitHubCheckStatus.Queued;
  }
}
function mapCheckConclusion(conclusion) {
  switch (conclusion) {
    case "success":
      return GitHubCheckConclusion.Success;
    case "failure":
      return GitHubCheckConclusion.Failure;
    case "neutral":
      return GitHubCheckConclusion.Neutral;
    case "cancelled":
      return GitHubCheckConclusion.Cancelled;
    case "skipped":
      return GitHubCheckConclusion.Skipped;
    case "timed_out":
      return GitHubCheckConclusion.TimedOut;
    case "action_required":
      return GitHubCheckConclusion.ActionRequired;
    case "stale":
      return GitHubCheckConclusion.Stale;
    default:
      return GitHubCheckConclusion.Neutral;
  }
}
function computeOverallCIStatus(checks) {
  if (checks.length === 0) {
    return GitHubCIOverallStatus.Neutral;
  }
  let hasFailure = false;
  let hasPending = false;
  for (const check of checks) {
    if (check.status !== GitHubCheckStatus.Completed) {
      hasPending = true;
      continue;
    }
    if (check.conclusion === GitHubCheckConclusion.Failure || check.conclusion === GitHubCheckConclusion.TimedOut || check.conclusion === GitHubCheckConclusion.ActionRequired) {
      hasFailure = true;
    }
  }
  if (hasFailure) {
    return GitHubCIOverallStatus.Failure;
  }
  if (hasPending) {
    return GitHubCIOverallStatus.Pending;
  }
  return GitHubCIOverallStatus.Success;
}
export {
  GitHubPRCIFetcher,
  computeOverallCIStatus
};
