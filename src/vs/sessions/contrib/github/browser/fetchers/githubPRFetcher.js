import {
  GitHubPullRequestState,
  MergeBlockerKind
} from "../../common/types.js";
const GET_REVIEW_THREADS_QUERY = [
  "query GetReviewThreads($owner: String!, $repo: String!, $prNumber: Int!) {",
  "  repository(owner: $owner, name: $repo) {",
  "    pullRequest(number: $prNumber) {",
  "      reviewThreads(first: 100) {",
  "        nodes {",
  "          id",
  "          isResolved",
  "          path",
  "          line",
  "          comments(first: 100) {",
  "            nodes {",
  "              databaseId",
  "              body",
  "              createdAt",
  "              updatedAt",
  "              path",
  "              line",
  "              originalLine",
  "              replyTo {",
  "                databaseId",
  "              }",
  "              author {",
  "                login",
  "                avatarUrl",
  "              }",
  "            }",
  "          }",
  "        }",
  "      }",
  "    }",
  "  }",
  "}"
].join("\n");
const RESOLVE_REVIEW_THREAD_MUTATION = [
  "mutation ResolveReviewThread($threadId: ID!) {",
  "  resolveReviewThread(input: { threadId: $threadId }) {",
  "    thread {",
  "      isResolved",
  "    }",
  "  }",
  "}"
].join("\n");
class GitHubPRFetcher {
  constructor(_apiClient) {
    this._apiClient = _apiClient;
  }
  async getPullRequest(owner, repo, prNumber, etag) {
    const response = await this._apiClient.request(
      "GET",
      `/repos/${e(owner)}/${e(repo)}/pulls/${prNumber}`,
      "githubApi.getPullRequest",
      { etag }
    );
    return {
      ...response,
      data: response.data ? mapPullRequest(response.data) : void 0
    };
  }
  async getReviews(owner, repo, prNumber, etag) {
    const response = await this._apiClient.request(
      "GET",
      `/repos/${e(owner)}/${e(repo)}/pulls/${prNumber}/reviews`,
      "githubApi.getReviews",
      { etag }
    );
    return {
      ...response,
      data: response.data ? response.data.map(mapReview) : void 0
    };
  }
  async getReviewThreads(owner, repo, prNumber) {
    const data = await this._apiClient.graphql(
      GET_REVIEW_THREADS_QUERY,
      "githubApi.getReviewThreads",
      { owner, repo, prNumber }
    );
    const reviewThreads = data.repository?.pullRequest?.reviewThreads.nodes;
    if (!reviewThreads) {
      throw new Error(`Pull request not found: ${owner}/${repo}#${prNumber}`);
    }
    return reviewThreads.map(mapReviewThread);
  }
  async postReviewComment(owner, repo, prNumber, body, inReplyTo) {
    const response = await this._apiClient.request(
      "POST",
      `/repos/${e(owner)}/${e(repo)}/pulls/${prNumber}/comments`,
      "githubApi.postReviewComment",
      { data: { body, in_reply_to: inReplyTo } }
    );
    if (!response.data) {
      throw new Error(`Failed to post review comment to ${owner}/${repo}#${prNumber}`);
    }
    return mapReviewComment(response.data);
  }
  async postIssueComment(owner, repo, prNumber, body) {
    const response = await this._apiClient.request(
      "POST",
      `/repos/${e(owner)}/${e(repo)}/issues/${prNumber}/comments`,
      "githubApi.postIssueComment",
      { data: { body } }
    );
    const data = response.data;
    if (!data) {
      throw new Error(`Failed to post issue comment to ${owner}/${repo}#${prNumber}`);
    }
    return {
      id: data.id,
      body: data.body ?? "",
      author: mapUser(data.user),
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      path: void 0,
      line: void 0,
      threadId: String(data.id),
      inReplyToId: void 0
    };
  }
  async resolveThread(_owner, _repo, threadId) {
    const data = await this._apiClient.graphql(
      RESOLVE_REVIEW_THREAD_MUTATION,
      "githubApi.resolveThread",
      { threadId }
    );
    if (!data.resolveReviewThread?.thread?.isResolved) {
      throw new Error(`Failed to resolve review thread ${threadId}`);
    }
  }
}
function computeMergeability(pr, reviews) {
  const blockers = [];
  if (pr.isDraft) {
    blockers.push({ kind: MergeBlockerKind.Draft, description: "Pull request is a draft" });
  }
  if (pr.mergeable === false) {
    blockers.push({ kind: MergeBlockerKind.Conflicts, description: "Pull request has merge conflicts" });
  }
  const latestReviewByUser = /* @__PURE__ */ new Map();
  for (const review of reviews) {
    if (review.state === "APPROVED" || review.state === "CHANGES_REQUESTED" || review.state === "DISMISSED") {
      latestReviewByUser.set(review.author.login, review.state);
    }
  }
  const hasChangesRequested = [...latestReviewByUser.values()].some((s) => s === "CHANGES_REQUESTED");
  if (hasChangesRequested) {
    blockers.push({ kind: MergeBlockerKind.ChangesRequested, description: "Changes have been requested" });
  }
  if (pr.mergeableState === "blocked") {
    const hasApproval = [...latestReviewByUser.values()].some((s) => s === "APPROVED");
    if (!hasApproval) {
      blockers.push({ kind: MergeBlockerKind.ApprovalNeeded, description: "Approval is required" });
    }
  }
  if (pr.mergeableState === "unstable") {
    blockers.push({ kind: MergeBlockerKind.CIFailed, description: "CI checks have failed" });
  }
  return {
    canMerge: blockers.length === 0 && pr.mergeable !== false && pr.state === GitHubPullRequestState.Open,
    blockers
  };
}
function e(value) {
  return encodeURIComponent(value);
}
function mapUser(user) {
  return { login: user.login, avatarUrl: user.avatar_url };
}
function mapPullRequest(data) {
  let state;
  if (data.merged) {
    state = GitHubPullRequestState.Merged;
  } else if (data.state === "closed") {
    state = GitHubPullRequestState.Closed;
  } else {
    state = GitHubPullRequestState.Open;
  }
  return {
    number: data.number,
    title: data.title,
    body: data.body ?? "",
    state,
    author: mapUser(data.user),
    headRef: data.head.ref,
    headSha: data.head.sha,
    baseRef: data.base.ref,
    isDraft: data.draft,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    mergedAt: data.merged_at ?? void 0,
    mergeable: data.mergeable ?? void 0,
    mergeableState: data.mergeable_state
  };
}
function mapReview(data) {
  return {
    id: data.id,
    author: mapUser(data.user),
    state: data.state,
    submittedAt: data.submitted_at
  };
}
function mapReviewComment(data) {
  return {
    id: data.id,
    body: data.body,
    author: mapUser(data.user),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    path: data.path,
    line: data.line ?? data.original_line ?? void 0,
    threadId: String(data.in_reply_to_id ?? data.id),
    inReplyToId: data.in_reply_to_id
  };
}
function mapReviewThread(thread) {
  return {
    id: thread.id,
    isResolved: thread.isResolved,
    path: thread.path,
    line: thread.line ?? void 0,
    comments: thread.comments.nodes.flatMap((comment) => mapGraphQLReviewComment(comment, thread))
  };
}
function mapGraphQLReviewComment(comment, thread) {
  if (comment.databaseId === null || comment.author === null) {
    return [];
  }
  return [{
    id: comment.databaseId,
    body: comment.body,
    author: { login: comment.author.login, avatarUrl: comment.author.avatarUrl },
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    path: comment.path ?? thread.path,
    line: comment.line ?? comment.originalLine ?? thread.line ?? void 0,
    threadId: thread.id,
    inReplyToId: comment.replyTo?.databaseId ?? void 0
  }];
}
export {
  GitHubPRFetcher,
  computeMergeability
};
