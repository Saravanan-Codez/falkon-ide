class GitHubRepositoryFetcher {
  constructor(_apiClient) {
    this._apiClient = _apiClient;
  }
  async getRepository(owner, repo, etag) {
    const response = await this._apiClient.request(
      "GET",
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      "githubApi.getRepository",
      { etag }
    );
    return {
      ...response,
      data: response.data ? {
        owner: response.data.owner.login,
        name: response.data.name,
        fullName: response.data.full_name,
        defaultBranch: response.data.default_branch,
        isPrivate: response.data.private,
        description: response.data.description ?? ""
      } : void 0
    };
  }
}
export {
  GitHubRepositoryFetcher
};
