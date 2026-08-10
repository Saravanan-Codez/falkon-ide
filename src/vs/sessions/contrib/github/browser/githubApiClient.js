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
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IRequestService, asJson } from "../../../../platform/request/common/request.js";
import { IAuthenticationService } from "../../../../workbench/services/authentication/common/authentication.js";
const LOG_PREFIX = "[GitHubApiClient]";
const TRACE_PREFIX = "[PR-ICON-TRACE]";
const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_GRAPHQL_ENDPOINT = `${GITHUB_API_BASE}/graphql`;
class GitHubApiError extends Error {
  constructor(message, statusCode, rateLimitRemaining) {
    super(message);
    this.statusCode = statusCode;
    this.rateLimitRemaining = rateLimitRemaining;
    this.name = "GitHubApiError";
  }
}
class GitHubAuthenticationError extends Error {
  constructor() {
    super("No GitHub authentication sessions available");
    this.name = "GitHubAuthenticationError";
  }
}
let GitHubApiClient = class extends Disposable {
  constructor(_requestService, _authenticationService, _logService) {
    super();
    this._requestService = _requestService;
    this._authenticationService = _authenticationService;
    this._logService = _logService;
  }
  async request(method, path, callSite, options) {
    return this._request(method, `${GITHUB_API_BASE}${path}`, path, "application/vnd.github.v3+json", callSite, options);
  }
  async graphql(query, callSite, variables, options) {
    const response = await this._request(
      "POST",
      GITHUB_GRAPHQL_ENDPOINT,
      "/graphql",
      "application/vnd.github+json",
      callSite,
      { ...options, data: { query, variables } }
    );
    if (response.data?.errors?.length) {
      throw new GitHubApiError(
        response.data.errors.map((error) => error.message).join("; "),
        200,
        void 0
      );
    }
    if (!response.data?.data) {
      throw new GitHubApiError("GitHub GraphQL response did not include data", 200, void 0);
    }
    return response.data.data;
  }
  async _request(method, url, pathForLogging, accept, callSite, options) {
    const token = await this._getAuthToken(options?.createAuthenticationSession !== false);
    this._logService.trace(`${LOG_PREFIX} ${method} ${pathForLogging}`);
    this._logService.trace(`${TRACE_PREFIX} [GitHubApiClient] -> ${method} ${pathForLogging} (callSite ${callSite}${options?.etag !== void 0 ? `, ifNoneMatch ${options.etag}` : ""})`);
    const response = await this._requestService.request({
      type: method,
      url,
      headers: {
        "Authorization": `token ${token}`,
        "Accept": accept,
        "User-Agent": "VSCode-Sessions-GitHub",
        ...options?.etag !== void 0 ? { "If-None-Match": options.etag } : {},
        ...options?.data !== void 0 ? { "Content-Type": "application/json" } : {}
      },
      data: options?.data !== void 0 ? JSON.stringify(options.data) : void 0,
      // Bypass the renderer HTTP cache so conditional polling reaches GitHub (see PR_ICON_POLLING.md).
      disableCache: true,
      callSite
    }, options?.token ?? CancellationToken.None);
    const rateLimitRemaining = parseRateLimitHeader(response.res.headers?.["x-ratelimit-remaining"]);
    if (rateLimitRemaining !== void 0 && rateLimitRemaining < 100) {
      this._logService.warn(`${LOG_PREFIX} GitHub API rate limit low: ${rateLimitRemaining} remaining`);
    }
    const statusCode = response.res.statusCode ?? 0;
    const responseETag = response.res.headers?.["etag"];
    this._logService.trace(`${TRACE_PREFIX} [GitHubApiClient] <- ${method} ${pathForLogging} status ${statusCode}${responseETag ? `, etag ${responseETag}` : ""}${rateLimitRemaining !== void 0 ? `, rateLimitRemaining ${rateLimitRemaining}` : ""} (callSite ${callSite})`);
    if (statusCode === 204 || statusCode === 304) {
      return { data: void 0, statusCode, etag: responseETag };
    }
    if (statusCode < 200 || statusCode >= 300) {
      const errorBody = await asJson(response).catch(() => void 0);
      throw new GitHubApiError(
        errorBody?.message ?? `GitHub API request failed: ${method} ${pathForLogging} (${statusCode})`,
        statusCode,
        rateLimitRemaining
      );
    }
    const data = await asJson(response);
    if (!data) {
      throw new GitHubApiError(
        `Failed to parse response for ${method} ${pathForLogging}`,
        statusCode,
        rateLimitRemaining
      );
    }
    return { data, statusCode, etag: responseETag };
  }
  async _getAuthToken(createIfNone) {
    let sessions = await this._authenticationService.getSessions("github", [], { silent: true });
    if ((!sessions || sessions.length === 0) && createIfNone) {
      sessions = await this._authenticationService.getSessions("github", [], { createIfNone: true });
    }
    if (!sessions || sessions.length === 0) {
      throw new GitHubAuthenticationError();
    }
    const repoScopeSession = sessions.find((session) => session.scopes.includes("repo"));
    return repoScopeSession?.accessToken ?? sessions[0].accessToken ?? "";
  }
};
GitHubApiClient = __decorateClass([
  __decorateParam(0, IRequestService),
  __decorateParam(1, IAuthenticationService),
  __decorateParam(2, ILogService)
], GitHubApiClient);
function parseRateLimitHeader(value) {
  if (value === void 0) {
    return void 0;
  }
  const str = Array.isArray(value) ? value[0] : value;
  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? void 0 : parsed;
}
export {
  GitHubApiClient,
  GitHubApiError,
  GitHubAuthenticationError
};
