class GitHubChangesFetcher {
  constructor(_apiClient) {
    this._apiClient = _apiClient;
  }
  async getChangedFiles(owner, repo, base, head) {
    const response = await this._apiClient.request(
      "GET",
      `/repos/${e(owner)}/${e(repo)}/compare/${e(base)}...${e(head)}`,
      "githubApi.getChangedFiles"
    );
    return response.data?.files.map((file) => ({
      filename: file.filename,
      previous_filename: file.previous_filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions
    })) ?? [];
  }
}
const e = encodeURIComponent;
export {
  GitHubChangesFetcher
};
