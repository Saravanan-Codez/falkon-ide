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
import { LRUCache } from "../../../../base/common/map.js";
import { createDecorator } from "../../../instantiation/common/instantiation.js";
import { ILogService } from "../../../log/common/log.js";
import { IAgentHostGitHubEndpointService } from "../agentHostGitHubEndpointService.js";
function toCreatedPullRequest(item) {
  const html_url = item?.html_url;
  const number = item?.number;
  const node_id = item?.node_id;
  return typeof html_url === "string" && typeof number === "number" ? { number, url: html_url, nodeId: typeof node_id === "string" ? node_id : void 0 } : void 0;
}
const IAgentHostOctoKitService = createDecorator("agentHostOctoKitService");
const GITHUB_API_VERSION = "2022-11-28";
const MAX_ERROR_RESPONSE_BODY_LENGTH = 500;
const MAX_COMMIT_PULL_REQUESTS = 100;
const ENABLE_AUTO_MERGE_MUTATION = `mutation EnableAutoMerge($pullRequestId: ID!, $mergeMethod: PullRequestMergeMethod!) {
	enablePullRequestAutoMerge(input: { pullRequestId: $pullRequestId, mergeMethod: $mergeMethod }) {
		pullRequest { id }
	}
}`;
let AgentHostOctoKitService = class {
  constructor(fetchFn, _logService, _endpoint) {
    this._logService = _logService;
    this._endpoint = _endpoint;
    /**
     * Cached pull request listings keyed by route, with the ETag that validated
     * them. The items are kept alongside the ETag because a `304` response
     * carries no body: without them a revalidated route would look empty.
     */
    this.pullRequestSearchCache = new LRUCache(100);
    this._fetch = fetchFn ?? globalThis.fetch;
  }
  async createPullRequest(owner, repo, title, body, head, base, draft, token, signal) {
    const response = await this._makeGHAPIRequest(
      `repos/${owner}/${repo}/pulls`,
      "POST",
      token,
      signal,
      { title, body, head, base, draft }
    );
    const number = response.data?.number;
    const html_url = response.data?.html_url;
    if (typeof html_url !== "string" || typeof number !== "number") {
      throw new Error(`Failed to create pull request for ${owner}/${repo}`);
    }
    const node_id = response.data?.node_id;
    return { url: html_url, number, nodeId: typeof node_id === "string" ? node_id : void 0 };
  }
  async findPullRequestByHeadBranch(owner, repo, branch, token, signal, headOwner = owner) {
    const routeSlug = `repos/${owner}/${repo}/pulls?head=${encodeURIComponent(`${headOwner}:${branch}`)}&state=all&sort=updated&direction=desc&per_page=1`;
    const items = await this._searchPullRequests(routeSlug, token, signal);
    return toCreatedPullRequest(items[0]);
  }
  async findPullRequestByHeadSha(owner, repo, sha, token, signal) {
    const routeSlug = `repos/${owner}/${repo}/commits/${encodeURIComponent(sha)}/pulls?per_page=${MAX_COMMIT_PULL_REQUESTS}`;
    const items = await this._searchPullRequests(routeSlug, token, signal);
    if (items.length >= MAX_COMMIT_PULL_REQUESTS) {
      this._logService.warn(`[AgentHostOctoKitService] Not resolving a pull request for ${sha}: more than ${MAX_COMMIT_PULL_REQUESTS} are associated with it`);
      return void 0;
    }
    const atHead = items.filter((item) => item?.head?.sha === sha);
    const open = atHead.filter((item) => item.state === "open");
    const candidates = open.length > 0 ? open : atHead;
    return candidates.length === 1 ? toCreatedPullRequest(candidates[0]) : void 0;
  }
  /**
   * Issues a conditional GET for a pull request listing route, serving the
   * previously cached listing when the ETag still validates.
   */
  async _searchPullRequests(routeSlug, token, signal) {
    const cacheKey = `${this._endpoint.getApiBaseUri()}/${routeSlug}`;
    const cached = this.pullRequestSearchCache.get(cacheKey);
    const response = await this._makeGHAPIRequest(routeSlug, "GET", token, signal, void 0, cached?.etag);
    if (response.statusCode === 304) {
      return cached?.items ?? [];
    }
    const items = Array.isArray(response.data) ? response.data : [];
    if (response.etag) {
      this.pullRequestSearchCache.set(cacheKey, { etag: response.etag, items });
    }
    return items;
  }
  async getIssueOrPullRequest(owner, repo, number, token, signal) {
    const response = await this._makeGHAPIRequest(
      `repos/${owner}/${repo}/issues/${number}`,
      "GET",
      token,
      signal
    );
    const title = response.data?.title;
    const body = response.data?.body;
    if (typeof title !== "string" || typeof body !== "string" && body !== null) {
      throw new Error(`Failed to fetch issue or pull request ${owner}/${repo}#${number}`);
    }
    return { title, body: body ?? "" };
  }
  async enablePullRequestAutoMerge(pullRequestId, mergeMethod, token, signal) {
    await this._makeGraphQLRequest(ENABLE_AUTO_MERGE_MUTATION, { pullRequestId, mergeMethod }, token, signal);
  }
  async _makeGHAPIRequest(routeSlug, method, token, signal, body, etag) {
    const url = `${this._endpoint.getApiBaseUri()}/${routeSlug}`;
    const headers = {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "X-GitHub-Api-Version": GITHUB_API_VERSION
    };
    if (etag) {
      headers["If-None-Match"] = etag;
    }
    if (body) {
      headers["Content-Type"] = "application/json";
    }
    let response;
    try {
      response = await this._fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : void 0,
        signal
      });
    } catch (err) {
      if (signal.aborted) {
        throw err;
      }
      this._logService.error(`[AgentHostOctoKit] ${method} ${url} - Network error`, err);
      throw err;
    }
    const rateLimitHeader = response.headers.get("x-ratelimit-remaining");
    if (rateLimitHeader) {
      const rateLimitRemaining = parseRateLimitHeader(rateLimitHeader);
      if (rateLimitRemaining !== void 0 && rateLimitRemaining < 100) {
        this._logService.warn(`[AgentHostOctoKitService] ${method} ${url} - GitHub API rate limit low: ${rateLimitRemaining} remaining`);
      }
    }
    const statusCode = response.status ?? 0;
    const responseETag = response.headers.get("etag") ?? void 0;
    if (statusCode === 204 || statusCode === 304) {
      return { data: void 0, statusCode, etag: responseETag };
    }
    if (!response.ok) {
      const errorText = await response.text().catch(() => void 0);
      const errorDetail = this._formatErrorResponseBody(errorText);
      this._logService.error(`[AgentHostOctoKit] ${method} ${url} - Status: ${response.status}${errorDetail ? ` - ${errorDetail}` : ""}`);
      throw new Error(`GitHub API request failed: ${method} ${routeSlug} - ${response.status} ${response.statusText}${errorDetail ? ` - ${errorDetail}` : ""}`);
    }
    try {
      const data = await response.json();
      return { data, statusCode, etag: responseETag };
    } catch (err) {
      this._logService.error(`[AgentHostOctoKit] ${method} ${url} - Failed to parse JSON`, err);
      throw err;
    }
  }
  async _makeGraphQLRequest(query, variables, token, signal) {
    const url = this._endpoint.getGraphQlUri();
    const headers = {
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": GITHUB_API_VERSION
    };
    let response;
    try {
      response = await this._fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ query, variables }),
        signal
      });
    } catch (err) {
      if (signal.aborted) {
        throw err;
      }
      this._logService.error(`[AgentHostOctoKit] POST ${url} - Network error`, err);
      throw err;
    }
    if (!response.ok) {
      const errorText = await response.text().catch(() => void 0);
      const errorDetail = this._formatErrorResponseBody(errorText);
      this._logService.error(`[AgentHostOctoKit] POST ${url} - Status: ${response.status}${errorDetail ? ` - ${errorDetail}` : ""}`);
      throw new Error(`GitHub GraphQL request failed: ${response.status} ${response.statusText}${errorDetail ? ` - ${errorDetail}` : ""}`);
    }
    let json;
    try {
      json = await response.json();
    } catch (err) {
      this._logService.error(`[AgentHostOctoKit] POST ${url} - Failed to parse JSON`, err);
      throw err;
    }
    if (Array.isArray(json.errors) && json.errors.length > 0) {
      const message = json.errors.map((error) => {
        return typeof error?.message === "string" ? error.message : JSON.stringify(error);
      }).join("; ");
      this._logService.error(`[AgentHostOctoKit] POST ${url} - GraphQL error: ${message}`);
      throw new Error(`GitHub GraphQL request failed: ${message}`);
    }
    return json.data;
  }
  _formatErrorResponseBody(errorText) {
    const normalized = errorText?.replace(/\s+/g, " ").trim();
    if (!normalized) {
      return void 0;
    }
    return normalized.length > MAX_ERROR_RESPONSE_BODY_LENGTH ? `${normalized.substring(0, MAX_ERROR_RESPONSE_BODY_LENGTH)}...` : normalized;
  }
};
AgentHostOctoKitService = __decorateClass([
  __decorateParam(1, ILogService),
  __decorateParam(2, IAgentHostGitHubEndpointService)
], AgentHostOctoKitService);
function parseRateLimitHeader(value) {
  if (value === void 0) {
    return void 0;
  }
  const str = Array.isArray(value) ? value[0] : value;
  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? void 0 : parsed;
}
export {
  AgentHostOctoKitService,
  IAgentHostOctoKitService
};
