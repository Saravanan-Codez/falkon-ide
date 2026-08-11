import { computePullRequestIcon, GitHubCIOverallStatus, GitHubPullRequestState } from "../common/types.js";
function computePullRequestIconStatus(reader, gitHubService, owner, repo, livePR) {
  if (livePR.isDraft || livePR.state !== GitHubPullRequestState.Open) {
    return {};
  }
  const ciRef = reader.store.add(gitHubService.createPullRequestCIModelReference(owner, repo, livePR.number, livePR.headSha));
  const hasFailingChecks = ciRef.object.overallStatus.read(reader) === GitHubCIOverallStatus.Failure;
  const reviewThreadsRef = reader.store.add(gitHubService.createPullRequestReviewThreadsModelReference(owner, repo, livePR.number));
  const hasUnresolvedComments = reviewThreadsRef.object.reviewThreads.read(reader).some((thread) => !thread.isResolved);
  return { hasFailingChecks, hasUnresolvedComments };
}
function computeLivePullRequestIcon(reader, gitHubService, owner, repo, livePR) {
  const status = computePullRequestIconStatus(reader, gitHubService, owner, repo, livePR);
  return computePullRequestIcon(livePR.isDraft ? "draft" : livePR.state, status);
}
function computeSessionPullRequestIcon(reader, gitHubService, iconCache, gitHubInfo) {
  const pullRequest = gitHubInfo.pullRequest;
  if (!pullRequest) {
    return void 0;
  }
  const prLink = pullRequest.uri.toString();
  const prModelRef = reader.store.add(gitHubService.createPullRequestModelReference(gitHubInfo.owner, gitHubInfo.repo, pullRequest.number));
  const livePullRequest = prModelRef.object.pullRequest.read(reader);
  if (!livePullRequest) {
    return iconCache.get(prLink) ?? pullRequest.icon ?? computePullRequestIcon(GitHubPullRequestState.Open);
  }
  const icon = computeLivePullRequestIcon(reader, gitHubService, gitHubInfo.owner, gitHubInfo.repo, livePullRequest);
  iconCache.set(prLink, icon);
  return icon;
}
export {
  computeLivePullRequestIcon,
  computePullRequestIconStatus,
  computeSessionPullRequestIcon
};
