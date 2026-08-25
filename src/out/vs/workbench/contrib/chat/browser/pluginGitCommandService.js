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
import { CancellationError } from "../../../../base/common/errors.js";
import { getComparisonKey } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { localize } from "../../../../nls.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IRequestService } from "../../../../platform/request/common/request.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IAuthenticationService } from "../../../services/authentication/common/authentication.js";
import {
  GitHubAuthRequiredError,
  GitHubRateLimitError,
  fetchAndExtractGitHubRepo,
  parseGitHubCloneUrl,
  resolveGitHubRefToSha
} from "./githubRepoFetcher.js";
const BROWSER_CACHE_STORAGE_KEY = "chat.plugins.browserCache.v1";
let BrowserPluginGitCommandService = class {
  constructor(_fileService, _logService, _requestService, _storageService, _authenticationService) {
    this._fileService = _fileService;
    this._logService = _logService;
    this._requestService = _requestService;
    this._storageService = _storageService;
    this._authenticationService = _authenticationService;
  }
  async cloneRepository(cloneUrl, targetDir, ref, token) {
    const repo = this._parseOrThrow(cloneUrl);
    const cancel = token ?? CancellationToken.None;
    const cloneWithToken = async (authToken) => {
      const sha = await resolveGitHubRefToSha(this._requestService, repo, ref, authToken, cancel);
      await fetchAndExtractGitHubRepo(this._requestService, this._fileService, this._logService, repo, sha, targetDir, authToken, cancel);
      this._setCacheEntry(targetDir, { owner: repo.owner, repo: repo.repo, ref, sha, fetchedAt: Date.now() });
    };
    const initialAuthToken = await this._lookupGitHubToken();
    const attempts = [
      async () => initialAuthToken
    ];
    if (initialAuthToken) {
      attempts.push(async () => void 0);
    }
    attempts.push(() => this._requestGitHubToken(repo));
    let lastErr;
    for (const getToken of attempts) {
      if (cancel.isCancellationRequested) {
        throw new CancellationError();
      }
      try {
        await cloneWithToken(await getToken());
        return;
      } catch (err) {
        lastErr = err;
        this._maybeLogTransientError(err, repo);
        if (!(err instanceof GitHubAuthRequiredError)) {
          throw err;
        }
      }
    }
    if (lastErr instanceof GitHubAuthRequiredError) {
      throw new Error(localize(
        "pluginsBrowserGitHubAccessRequired",
        "GitHub authentication is required to install '{0}'. Sign in with an account that has access to this repository, then try again.",
        `${repo.owner}/${repo.repo}`
      ));
    }
    throw lastErr;
  }
  async pull(repoDir, token) {
    const entry = this._getCacheEntry(repoDir);
    if (!entry) {
      throw new Error(`Cannot pull plugin: no cached metadata for ${repoDir.toString()}`);
    }
    const cancel = token ?? CancellationToken.None;
    const authToken = await this._lookupGitHubToken();
    const repo = { owner: entry.owner, repo: entry.repo };
    try {
      const newSha = await resolveGitHubRefToSha(this._requestService, repo, entry.ref, authToken, cancel);
      if (newSha === entry.sha) {
        return false;
      }
      await fetchAndExtractGitHubRepo(this._requestService, this._fileService, this._logService, repo, newSha, repoDir, authToken, cancel);
      this._setCacheEntry(repoDir, { ...entry, sha: newSha, fetchedAt: Date.now() });
      return true;
    } catch (err) {
      this._maybeLogTransientError(err, repo);
      throw err;
    }
  }
  async checkout(repoDir, treeish, _detached, token) {
    const entry = this._getCacheEntry(repoDir);
    if (!entry) {
      throw new Error(`Cannot checkout plugin: no cached metadata for ${repoDir.toString()}`);
    }
    const cancel = token ?? CancellationToken.None;
    const authToken = await this._lookupGitHubToken();
    const repo = { owner: entry.owner, repo: entry.repo };
    const requestedRef = treeish.trim();
    const isFullSha = /^[0-9a-f]{40}$/i.test(requestedRef);
    const requestedSha = isFullSha ? requestedRef.toLowerCase() : await resolveGitHubRefToSha(this._requestService, repo, requestedRef, authToken, cancel);
    if (requestedSha === entry.sha.toLowerCase()) {
      return;
    }
    try {
      await fetchAndExtractGitHubRepo(this._requestService, this._fileService, this._logService, repo, requestedSha, repoDir, authToken, cancel);
      this._setCacheEntry(repoDir, {
        ...entry,
        ref: isFullSha ? entry.ref : requestedRef,
        sha: requestedSha,
        fetchedAt: Date.now()
      });
    } catch (err) {
      this._maybeLogTransientError(err, repo);
      throw err;
    }
  }
  async revParse(repoDir, ref) {
    const entry = this._getCacheEntry(repoDir);
    if (!entry) {
      throw new Error(`Cannot resolve ref: no cached metadata for ${repoDir.toString()}`);
    }
    const trimmed = ref.trim();
    const isFullSha = /^[0-9a-f]{40}$/i.test(trimmed);
    if (isFullSha && trimmed.toLowerCase() !== entry.sha.toLowerCase()) {
      throw new Error(`Cannot resolve ref '${ref}' in tree-cached plugin: only HEAD/${entry.sha} is materialised`);
    }
    return entry.sha;
  }
  async fetch(_repoDir, _token) {
  }
  async fetchRepository(_repoDir, _token) {
  }
  async revListCount(_repoDir, _fromRef, _toRef) {
    return 0;
  }
  // -- helpers --------------------------------------------------------------
  _parseOrThrow(cloneUrl) {
    const parsed = parseGitHubCloneUrl(cloneUrl);
    if (!parsed) {
      throw new Error(localize(
        "pluginsBrowserUnsupportedHost",
        "Agent plugins in the browser can only be installed from GitHub HTTPS URLs. To install '{0}', use the desktop application or connect to a remote agent host.",
        cloneUrl
      ));
    }
    return parsed;
  }
  _maybeLogTransientError(err, repo) {
    if (err instanceof GitHubAuthRequiredError) {
      this._logService.warn(`[BrowserPluginGitCommandService] GitHub auth required for ${repo.owner}/${repo.repo}: ${err.message}`);
    } else if (err instanceof GitHubRateLimitError) {
      const wait = err.retryAfterSeconds !== void 0 ? ` (retry after ${err.retryAfterSeconds}s)` : "";
      this._logService.warn(`[BrowserPluginGitCommandService] GitHub rate limit hit for ${repo.owner}/${repo.repo}${wait}: ${err.message}`);
    } else if (err instanceof Error) {
      const cause = err.cause instanceof Error ? ` (cause: ${err.cause.name}: ${err.cause.message})` : "";
      this._logService.error(`[BrowserPluginGitCommandService] Clone failed for ${repo.owner}/${repo.repo}: ${err.message}${cause}`);
    }
  }
  /**
   * Best-effort silent lookup of an existing GitHub session token. Returns
   * `undefined` when no session is available; callers fall back to anonymous,
   * which still works for public repos. Prefers a `repo`-scoped session when
   * multiple are present (e.g. EMU + personal).
   */
  async _lookupGitHubToken() {
    try {
      const sessions = await this._authenticationService.getSessions("github", [], { silent: true });
      if (sessions.length === 0) {
        return void 0;
      }
      const repoScopeSession = sessions.find((session) => session.scopes.includes("repo"));
      return repoScopeSession?.accessToken ?? sessions[0].accessToken;
    } catch (err) {
      this._logService.trace("[BrowserPluginGitCommandService] Silent GitHub session lookup failed:", err);
      return void 0;
    }
  }
  async _requestGitHubToken(repo) {
    try {
      const session = await this._authenticationService.createSession("github", ["repo"], { activateImmediate: true });
      return session.accessToken;
    } catch (err) {
      this._logService.trace("[BrowserPluginGitCommandService] GitHub session request failed:", err);
      throw new Error(localize(
        "pluginsBrowserGitHubSignInRequired",
        "Sign in to GitHub with an account that has access to '{0}' to install this plugin.",
        `${repo.owner}/${repo.repo}`
      ));
    }
  }
  // -- metadata cache (IStorageService) -------------------------------------
  _cacheKey(targetDir) {
    return getComparisonKey(targetDir, true);
  }
  async _pruneStaleEntries(cache, knownDirs) {
    const removed = [];
    await Promise.all(Array.from(knownDirs, async ([key, uri]) => {
      try {
        if (!await this._fileService.exists(uri)) {
          removed.push(key);
        }
      } catch {
      }
    }));
    if (removed.length === 0) {
      return;
    }
    for (const key of removed) {
      cache.delete(key);
    }
    this._logService.trace(`[BrowserPluginGitCommandService] Pruned ${removed.length} stale cache entries`);
    this._persistCache();
  }
  _ensureCacheLoaded() {
    if (this._cache) {
      return this._cache;
    }
    const cache = /* @__PURE__ */ new Map();
    const stored = this._storageService.getObject(BROWSER_CACHE_STORAGE_KEY, StorageScope.APPLICATION);
    const knownDirs = /* @__PURE__ */ new Map();
    if (stored) {
      for (const [key, entry] of Object.entries(stored)) {
        if (entry && typeof entry.sha === "string" && typeof entry.owner === "string" && typeof entry.repo === "string") {
          cache.set(key, {
            owner: entry.owner,
            repo: entry.repo,
            ref: typeof entry.ref === "string" ? entry.ref : void 0,
            sha: entry.sha,
            fetchedAt: typeof entry.fetchedAt === "number" ? entry.fetchedAt : 0
          });
          try {
            knownDirs.set(key, URI.parse(key));
          } catch {
            cache.delete(key);
          }
        }
      }
    }
    this._cache = cache;
    if (knownDirs.size > 0) {
      this._pruneStaleEntries(cache, knownDirs).catch((err) => {
        this._logService.trace("[BrowserPluginGitCommandService] Cache prune failed:", err);
      });
    }
    return cache;
  }
  _getCacheEntry(targetDir) {
    return this._ensureCacheLoaded().get(this._cacheKey(targetDir));
  }
  _setCacheEntry(targetDir, entry) {
    const cache = this._ensureCacheLoaded();
    cache.set(this._cacheKey(targetDir), entry);
    this._persistCache();
  }
  _persistCache() {
    if (!this._cache) {
      return;
    }
    const serialized = {};
    for (const [key, entry] of this._cache) {
      serialized[key] = entry;
    }
    if (Object.keys(serialized).length === 0) {
      this._storageService.remove(BROWSER_CACHE_STORAGE_KEY, StorageScope.APPLICATION);
      return;
    }
    this._storageService.store(BROWSER_CACHE_STORAGE_KEY, JSON.stringify(serialized), StorageScope.APPLICATION, StorageTarget.MACHINE);
  }
};
BrowserPluginGitCommandService = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, ILogService),
  __decorateParam(2, IRequestService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IAuthenticationService)
], BrowserPluginGitCommandService);
export {
  BrowserPluginGitCommandService
};
