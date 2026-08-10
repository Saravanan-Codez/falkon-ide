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
import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { FileSystemProviderCapabilities, FileSystemProviderErrorCode, FileType, createFileSystemProviderError } from "../../../../platform/files/common/files.js";
import { IRequestService, asJson } from "../../../../platform/request/common/request.js";
import { IAuthenticationService } from "../../../../workbench/services/authentication/common/authentication.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { GITHUB_REMOTE_FILE_SCHEME } from "../../../services/sessions/common/session.js";
function getGitHubRemoteFileDisplayName(uri) {
  if (uri.scheme !== GITHUB_REMOTE_FILE_SCHEME) {
    return void 0;
  }
  const parts = uri.path.split("/").filter(Boolean);
  if (parts.length >= 3) {
    const [, repo, ref] = parts;
    const decodedRepo = decodeURIComponent(repo);
    const decodedRef = decodeURIComponent(ref);
    if (decodedRef === "HEAD") {
      return decodedRepo;
    }
    return `${decodedRepo} (${decodedRef})`;
  }
  return void 0;
}
let GitHubFileSystemProvider = class extends Disposable {
  constructor(requestService, authenticationService, logService) {
    super();
    this.requestService = requestService;
    this.authenticationService = authenticationService;
    this.logService = logService;
    this._onDidChangeCapabilities = this._register(new Emitter());
    this.onDidChangeCapabilities = this._onDidChangeCapabilities.event;
    this.capabilities = FileSystemProviderCapabilities.Readonly | FileSystemProviderCapabilities.FileReadWrite | FileSystemProviderCapabilities.PathCaseSensitive;
    this._onDidChangeFile = this._register(new Emitter());
    this.onDidChangeFile = this._onDidChangeFile.event;
    /** Cache keyed by "owner/repo/ref" */
    this.treeCache = /* @__PURE__ */ new Map();
    /** Negative cache for refs that returned 404, keyed by "owner/repo/ref" */
    this.notFoundCache = /* @__PURE__ */ new Map();
    /** In-flight fetch promises keyed by "owner/repo/ref" to deduplicate concurrent requests */
    this.pendingFetches = /* @__PURE__ */ new Map();
  }
  static {
    /** Cache TTL - 5 minutes */
    this.CACHE_TTL_MS = 5 * 60 * 1e3;
  }
  static {
    /** Negative cache TTL - 1 minute */
    this.NOT_FOUND_CACHE_TTL_MS = 60 * 1e3;
  }
  // --- URI parsing
  /**
   * Parse a github-remote-file URI into its components.
   * Format: github-remote-file://github/{owner}/{repo}/{ref}/{path...}
   */
  parseUri(resource) {
    const parts = resource.path.split("/").filter(Boolean);
    if (parts.length < 3) {
      throw createFileSystemProviderError("Invalid github-remote-file URI: expected /{owner}/{repo}/{ref}/...", FileSystemProviderErrorCode.FileNotFound);
    }
    const owner = decodeURIComponent(parts[0]);
    const repo = decodeURIComponent(parts[1]);
    const ref = decodeURIComponent(parts[2]);
    const path = parts.slice(3).map(decodeURIComponent).join("/");
    return { owner, repo, ref, path };
  }
  getCacheKey(owner, repo, ref) {
    return `${owner}/${repo}/${ref}`;
  }
  // --- GitHub API
  async getAuthToken() {
    let sessions = await this.authenticationService.getSessions("github", [], { silent: true });
    if (!sessions || sessions.length === 0) {
      sessions = await this.authenticationService.getSessions("github", [], { createIfNone: true });
    }
    if (!sessions || sessions.length === 0) {
      throw createFileSystemProviderError("No GitHub authentication sessions available", FileSystemProviderErrorCode.Unavailable);
    }
    return sessions[0].accessToken ?? "";
  }
  fetchTree(owner, repo, ref) {
    const cacheKey = this.getCacheKey(owner, repo, ref);
    const cached = this.treeCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < GitHubFileSystemProvider.CACHE_TTL_MS) {
      return Promise.resolve(cached);
    }
    const notFoundAt = this.notFoundCache.get(cacheKey);
    if (notFoundAt !== void 0 && Date.now() - notFoundAt < GitHubFileSystemProvider.NOT_FOUND_CACHE_TTL_MS) {
      return Promise.reject(createFileSystemProviderError(`Tree not found for ${owner}/${repo}@${ref}`, FileSystemProviderErrorCode.FileNotFound));
    }
    const pending = this.pendingFetches.get(cacheKey);
    if (pending) {
      return pending;
    }
    const promise = this.doFetchTree(owner, repo, ref, cacheKey).finally(() => {
      this.pendingFetches.delete(cacheKey);
    });
    this.pendingFetches.set(cacheKey, promise);
    return promise;
  }
  async doFetchTree(owner, repo, ref, cacheKey) {
    this.logService.info(`[SessionRepoFS] Fetching tree for ${owner}/${repo}@${ref}`);
    const token = await this.getAuthToken();
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
    const response = await this.requestService.request({
      type: "GET",
      url,
      headers: {
        "Authorization": `token ${token}`,
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "VSCode-SessionRepoFS"
      },
      callSite: "githubFileSystemProvider.fetchTree"
    }, CancellationToken.None);
    if (response.res.statusCode === 404) {
      this.notFoundCache.set(cacheKey, Date.now());
      throw createFileSystemProviderError(`Tree not found for ${owner}/${repo}@${ref}`, FileSystemProviderErrorCode.FileNotFound);
    }
    const data = await asJson(response);
    if (!data) {
      throw createFileSystemProviderError(`Failed to fetch tree for ${owner}/${repo}@${ref}`, FileSystemProviderErrorCode.Unavailable);
    }
    const entries = /* @__PURE__ */ new Map();
    entries.set("", { type: FileType.Directory, size: 0, sha: data.sha });
    const dirs = /* @__PURE__ */ new Set();
    for (const entry of data.tree) {
      const fileType = entry.type === "tree" ? FileType.Directory : FileType.File;
      entries.set(entry.path, { type: fileType, size: entry.size ?? 0, sha: entry.sha });
      if (fileType === FileType.Directory) {
        dirs.add(entry.path);
      }
      const pathParts = entry.path.split("/");
      for (let i = 1; i < pathParts.length; i++) {
        const parentPath = pathParts.slice(0, i).join("/");
        if (!dirs.has(parentPath)) {
          dirs.add(parentPath);
          if (!entries.has(parentPath)) {
            entries.set(parentPath, { type: FileType.Directory, size: 0, sha: "" });
          }
        }
      }
    }
    const cacheEntry = { entries, fetchedAt: Date.now() };
    this.treeCache.set(cacheKey, cacheEntry);
    return cacheEntry;
  }
  // --- IFileSystemProvider
  async stat(resource) {
    const { owner, repo, ref, path } = this.parseUri(resource);
    const tree = await this.fetchTree(owner, repo, ref);
    const entry = tree.entries.get(path);
    if (!entry) {
      throw createFileSystemProviderError("File not found", FileSystemProviderErrorCode.FileNotFound);
    }
    return {
      type: entry.type,
      ctime: 0,
      mtime: 0,
      size: entry.size
    };
  }
  async readdir(resource) {
    const { owner, repo, ref, path } = this.parseUri(resource);
    const tree = await this.fetchTree(owner, repo, ref);
    const prefix = path ? path + "/" : "";
    const result = [];
    for (const [entryPath, entry] of tree.entries) {
      if (!entryPath.startsWith(prefix)) {
        continue;
      }
      const relativePath = entryPath.slice(prefix.length);
      if (relativePath && !relativePath.includes("/")) {
        result.push([relativePath, entry.type]);
      }
    }
    return result;
  }
  async readFile(resource) {
    const { owner, repo, ref, path } = this.parseUri(resource);
    const tree = await this.fetchTree(owner, repo, ref);
    const entry = tree.entries.get(path);
    if (!entry || entry.type === FileType.Directory) {
      throw createFileSystemProviderError("File not found", FileSystemProviderErrorCode.FileNotFound);
    }
    const token = await this.getAuthToken();
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs/${encodeURIComponent(entry.sha)}`;
    const response = await this.requestService.request({
      type: "GET",
      url,
      headers: {
        "Authorization": `token ${token}`,
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "VSCode-SessionRepoFS"
      },
      callSite: "githubFileSystemProvider.readFile"
    }, CancellationToken.None);
    const data = await asJson(response);
    if (!data) {
      throw createFileSystemProviderError(`Failed to read file ${path}`, FileSystemProviderErrorCode.Unavailable);
    }
    if (data.encoding === "base64") {
      const binaryString = atob(data.content.replace(/\n/g, ""));
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }
    return new TextEncoder().encode(data.content);
  }
  // --- Readonly stubs
  watch() {
    return Disposable.None;
  }
  async writeFile(_resource, _content, _opts) {
    throw createFileSystemProviderError("Operation not supported", FileSystemProviderErrorCode.NoPermissions);
  }
  async mkdir(_resource) {
    throw createFileSystemProviderError("Operation not supported", FileSystemProviderErrorCode.NoPermissions);
  }
  async delete(_resource, _opts) {
    throw createFileSystemProviderError("Operation not supported", FileSystemProviderErrorCode.NoPermissions);
  }
  async rename(_from, _to, _opts) {
    throw createFileSystemProviderError("Operation not supported", FileSystemProviderErrorCode.NoPermissions);
  }
  // --- Cache management
  invalidateCache(owner, repo, ref) {
    const cacheKey = this.getCacheKey(owner, repo, ref);
    this.treeCache.delete(cacheKey);
    this.notFoundCache.delete(cacheKey);
  }
  dispose() {
    this.treeCache.clear();
    this.notFoundCache.clear();
    this.pendingFetches.clear();
    super.dispose();
  }
};
GitHubFileSystemProvider = __decorateClass([
  __decorateParam(0, IRequestService),
  __decorateParam(1, IAuthenticationService),
  __decorateParam(2, ILogService)
], GitHubFileSystemProvider);
export {
  GitHubFileSystemProvider,
  getGitHubRemoteFileDisplayName
};
