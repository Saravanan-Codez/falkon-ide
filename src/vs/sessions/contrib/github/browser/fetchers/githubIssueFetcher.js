import { GitHubIssueState, GitHubIssueStateReason } from "../../common/types.js";
class GitHubIssueFetcher {
  constructor(_apiClient) {
    this._apiClient = _apiClient;
  }
  async getIssue(owner, repo, issueNumber, etag) {
    const response = await this._apiClient.request(
      "GET",
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}`,
      "githubApi.getIssue",
      { etag }
    );
    return {
      ...response,
      data: response.data ? mapIssue(response.data) : void 0
    };
  }
}
function mapIssue(data) {
  return {
    number: data.number,
    title: data.title,
    body: data.body ?? "",
    state: data.state === "closed" ? GitHubIssueState.Closed : GitHubIssueState.Open,
    stateReason: mapStateReason(data.state_reason),
    author: { login: data.user.login, avatarUrl: data.user.avatar_url },
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    closedAt: data.closed_at ?? void 0
  };
}
function mapStateReason(value) {
  switch (value) {
    case "completed":
      return GitHubIssueStateReason.Completed;
    case "not_planned":
      return GitHubIssueStateReason.NotPlanned;
    case "duplicate":
      return GitHubIssueStateReason.Duplicate;
    case "reopened":
      return GitHubIssueStateReason.Reopened;
    default:
      return void 0;
  }
}
export {
  GitHubIssueFetcher
};
