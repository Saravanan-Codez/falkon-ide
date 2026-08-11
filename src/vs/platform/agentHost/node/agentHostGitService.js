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
import * as cp from "child_process";
import * as fsPromises from "fs/promises";
import { cp as copyFile } from "@vscode/fs-copyfile";
import * as path from "../../../base/common/path.js";
import { URI } from "../../../base/common/uri.js";
import { VSBuffer } from "../../../base/common/buffer.js";
import { parse } from "../../../base/common/glob.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { INativeEnvironmentService } from "../../environment/common/environment.js";
import { IFileService } from "../../files/common/files.js";
import { ILogService } from "../../log/common/log.js";
import { FileEditKind } from "../common/state/sessionState.js";
import { buildGitBlobUri } from "./gitDiffContent.js";
import { EMPTY_TREE_OBJECT, GitRefType } from "../common/agentHostGitService.js";
import { LRUCache } from "../../../base/common/map.js";
import { Limiter, SequencerByKey } from "../../../base/common/async.js";
let AgentHostGitService = class {
  constructor(_fileService, _environmentService, _logService) {
    this._fileService = _fileService;
    this._environmentService = _environmentService;
    this._logService = _logService;
    /**
     * A cache of repository roots that have already been discovered.
     */
    this._repositoryRoots = new LRUCache(100);
    this._repositoryRootSequencer = new SequencerByKey();
  }
  async getCurrentBranch(workingDirectory) {
    return (await this._runGit(workingDirectory, ["branch", "--show-current"]))?.trim() || (await this._runGit(workingDirectory, ["rev-parse", "--short", "HEAD"]))?.trim() || void 0;
  }
  async getCurrentBranchName(workingDirectory) {
    return (await this._runGit(workingDirectory, ["branch", "--show-current"]))?.trim() || void 0;
  }
  async getDefaultBranch(workingDirectory) {
    const remoteRef = (await this._runGit(workingDirectory, ["symbolic-ref", "refs/remotes/origin/HEAD"]))?.trim();
    if (remoteRef) {
      if (!remoteRef.startsWith("refs/remotes/origin/")) {
        return { name: remoteRef, startPoint: remoteRef };
      }
      const branch = remoteRef.substring("refs/remotes/origin/".length);
      const hasRemoteRef = await this._runGit(workingDirectory, ["show-ref", "--verify", "--quiet", `refs/remotes/origin/${branch}`]) !== void 0;
      if (hasRemoteRef) {
        return { name: branch, startPoint: `origin/${branch}` };
      }
      const hasLocalBranch = await this._runGit(workingDirectory, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]) !== void 0;
      return hasLocalBranch ? { name: branch, startPoint: branch } : void 0;
    }
    return void 0;
  }
  async getRefs(workingDirectory, query) {
    const args = ["for-each-ref", "--format=%(refname)%00%(upstream)"];
    if (query?.sort && query.sort !== "alphabetically") {
      args.push("--sort", `-${query.sort}`);
    }
    if (query?.count) {
      args.push(`--count=${query.count}`);
    }
    if (query?.pattern) {
      const patterns = Array.isArray(query.pattern) ? query.pattern : [query.pattern];
      for (const pattern of patterns) {
        args.push(pattern.startsWith("refs/") ? pattern : `refs/${pattern}`);
      }
    }
    const output = await this._runGit(workingDirectory, args);
    return parseGitRefs(output);
  }
  async getBranches(workingDirectory, query) {
    const refs = await this.getRefs(workingDirectory, query);
    return refs.filter((r) => r.kind === GitRefType.Head || r.kind === GitRefType.RemoteHead);
  }
  async getBranch(workingDirectory, name) {
    const refs = await this.getBranches(workingDirectory, { pattern: name });
    return refs.length > 0 ? refs[0] : void 0;
  }
  async getRepositoryRoot(workingDirectory) {
    const workingDirectoryKey = workingDirectory.toString();
    return this._repositoryRootSequencer.queue(workingDirectoryKey, async () => {
      let repositoryRoot = this._repositoryRoots.get(workingDirectoryKey);
      if (repositoryRoot) {
        return repositoryRoot;
      }
      try {
        const repositoryRootPath = (await this._runGit(workingDirectory, ["rev-parse", "--show-toplevel"]))?.trim();
        if (repositoryRootPath) {
          repositoryRoot = URI.file(repositoryRootPath);
          this._repositoryRoots.set(workingDirectoryKey, repositoryRoot);
        }
        return repositoryRoot;
      } catch (error) {
      }
      return void 0;
    });
  }
  async getWorktreeRoots(workingDirectory) {
    const output = await this._runGit(workingDirectory, ["worktree", "list", "--porcelain"]);
    if (!output) {
      return [];
    }
    return output.split(/\r?\n/g).filter((line) => line.startsWith("worktree ")).map((line) => URI.file(line.substring("worktree ".length)));
  }
  async addWorktree(repositoryRoot, worktree, branchName, startPoint, track = false, onProgress) {
    const resolvedStartPoint = await this._resolveRemoteTrackingBranch(repositoryRoot, startPoint) ?? startPoint;
    const args = ["-c", "checkout.workers=0", "worktree", "add"];
    if (!track) {
      args.push("--no-track");
    }
    args.push("-b", branchName, worktree.fsPath, resolvedStartPoint);
    const progressParser = onProgress ? new GitCheckoutProgressParser(onProgress) : void 0;
    await this._runGit(repositoryRoot, args, {
      timeout: 18e4,
      throwOnError: true,
      ...progressParser ? { env: { GIT_PROGRESS_DELAY: "0" }, onStderr: (chunk) => progressParser.push(chunk) } : {}
    });
  }
  async copyWorktreeIncludeFiles(repositoryRoot, worktree, globs, onProgress) {
    try {
      const worktreeIncludePaths = await this._getWorktreeIncludePaths(repositoryRoot, worktree, globs);
      if (worktreeIncludePaths.length === 0) {
        return;
      }
      const startTime = performance.now();
      const limiter = new Limiter(15);
      const filesTotal = worktreeIncludePaths.reduce((total, entry) => total + entry.fileCount, 0);
      let filesDone = 0;
      const results = await Promise.allSettled(worktreeIncludePaths.map((entry) => limiter.queue(async () => {
        const targetPath = path.join(worktree.fsPath, path.relative(repositoryRoot.fsPath, entry.sourcePath));
        await fsPromises.mkdir(path.dirname(targetPath), { recursive: true });
        await copyFile(entry.sourcePath, targetPath, { force: true, recursive: true, verbatimSymlinks: true });
        filesDone += entry.fileCount;
        onProgress?.({ filesDone, filesTotal });
      })));
      const failedOperations = results.filter((result) => result.status === "rejected");
      this._logService.info(`[AgentHostGitService][copyWorktreeIncludeFiles] Copied ${worktreeIncludePaths.length - failedOperations.length}/${worktreeIncludePaths.length} folder(s)/file(s) to worktree ${worktree.fsPath}. [${(performance.now() - startTime).toFixed(2)}ms]`);
      if (failedOperations.length > 0) {
        this._logService.warn(`[AgentHostGitService][copyWorktreeIncludeFiles] Failed to copy ${failedOperations.length} folder(s)/file(s) to worktree ${worktree.fsPath}.`);
        for (const error of failedOperations) {
          this._logService.warn(`[AgentHostGitService][copyWorktreeIncludeFiles] ${error.reason}`);
        }
      }
    } catch (error) {
      this._logService.warn(`[AgentHostGitService][copyWorktreeIncludeFiles] Failed to copy folder(s)/file(s) to worktree ${worktree.fsPath}: ${error}`);
    }
  }
  async addExistingWorktree(repositoryRoot, worktree, branchName) {
    await this._runGit(repositoryRoot, ["-c", "checkout.workers=0", "worktree", "add", "-f", worktree.fsPath, branchName], { timeout: 18e4, throwOnError: true });
  }
  async removeWorktree(repositoryRoot, worktree, options) {
    const args = ["worktree", "remove"];
    if (options?.force) {
      args.push("--force");
    }
    args.push(worktree.fsPath);
    await this._runGit(repositoryRoot, args, { timeout: 6e4, throwOnError: true });
  }
  async branchExists(repositoryRoot, branchName) {
    const output = await this._runGit(repositoryRoot, ["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`]);
    return output !== void 0;
  }
  async hasUncommittedChanges(workingDirectory) {
    const output = await this._runGit(workingDirectory, ["status", "--porcelain"]);
    return !!output && output.trim().length > 0;
  }
  async commitAll(workingDirectory, message) {
    await this._runGit(workingDirectory, ["add", "-A", "--", ":/"], { throwOnError: true });
    await this._runGit(workingDirectory, ["commit", "--no-verify", "-m", message], { timeout: 6e4, throwOnError: true });
  }
  async restore(workingDirectory, paths, options) {
    const args = ["restore"];
    if (options?.staged) {
      args.push("--staged");
    }
    if (options?.ref) {
      args.push("--source", options.ref);
    }
    if (paths.length === 0) {
      paths = ["."];
    }
    await this._runGit(workingDirectory, [...args, "--", ...paths], { throwOnError: true });
  }
  async hasUpstream(workingDirectory, branchName) {
    const output = await this._runGit(workingDirectory, ["rev-parse", "--abbrev-ref", `${branchName}@{upstream}`]);
    return output !== void 0 && output.trim().length > 0;
  }
  async pull(workingDirectory, options) {
    const args = ["pull"];
    if (options?.rebase) {
      args.push("-r");
    }
    if (options?.remote || options?.ref) {
      args.push(options.remote ?? "origin");
      if (options.ref) {
        args.push(options.ref);
      }
    }
    await this._runGit(workingDirectory, args, { timeout: 18e4, throwOnError: true });
  }
  async push(workingDirectory, options) {
    const args = ["push"];
    if (options?.setUpstream) {
      args.push("--set-upstream");
    }
    if (options?.remote || options?.ref) {
      args.push(options.remote ?? "origin");
      if (options.ref) {
        args.push(options.ref);
      }
    }
    await this._runGit(workingDirectory, args, { timeout: 18e4, throwOnError: true });
  }
  async computeSessionFileDiffs(workingDirectory, options) {
    const repositoryRoot = await this.getRepositoryRoot(workingDirectory);
    if (!repositoryRoot) {
      return void 0;
    }
    const mergeBaseCommit = await this._resolveBranchMergeBaseCommit(repositoryRoot, options.baseBranch);
    const statusOut = await this._runGit(repositoryRoot, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
    if (statusOut === void 0) {
      return void 0;
    }
    const hasUntracked = parseUntrackedPaths(statusOut).length > 0;
    let rawDiffOutput;
    if (!hasUntracked) {
      rawDiffOutput = await this._runGit(repositoryRoot, ["diff", "--raw", "--numstat", "--diff-filter=ADMR", "-z", mergeBaseCommit, "--"]);
    } else {
      const changedPaths = parseChangedPaths(statusOut);
      rawDiffOutput = await this._runWithTempIndex(repositoryRoot, mergeBaseCommit, changedPaths);
    }
    if (rawDiffOutput === void 0) {
      return void 0;
    }
    return parseGitDiffRawNumstat(rawDiffOutput, repositoryRoot, options.sessionUri, mergeBaseCommit);
  }
  async resolveBranchBaselineCommit(workingDirectory, baseBranch) {
    const repositoryRoot = await this.getRepositoryRoot(workingDirectory);
    if (!repositoryRoot) {
      return void 0;
    }
    return this._resolveBranchMergeBaseCommit(repositoryRoot, baseBranch);
  }
  /**
   * Resolves the merge-base commit-ish the Branch Changes baseline is anchored
   * on. With a base branch, prefers the corresponding `origin/<base>`
   * remote-tracking ref when it exists so branch changes match a PR-style
   * comparison even if the local base branch is stale. Without a usable base,
   * falls back to `HEAD` (surfaces uncommitted work but no committed-on-branch
   * work). For empty repos with no `HEAD`, falls back to the empty-tree object.
   * Always resolves to a commit-ish (never `undefined`) once the repository
   * root is known.
   */
  async _resolveBranchMergeBaseCommit(repositoryRoot, baseBranch) {
    let mergeBaseCommit;
    if (baseBranch) {
      const resolvedBase = await this._resolveRemoteTrackingBranch(repositoryRoot, baseBranch) ?? baseBranch;
      mergeBaseCommit = (await this._runGit(repositoryRoot, ["merge-base", "HEAD", resolvedBase]))?.trim();
    }
    if (!mergeBaseCommit) {
      mergeBaseCommit = (await this._runGit(repositoryRoot, ["rev-parse", "HEAD"]))?.trim();
    }
    return mergeBaseCommit ?? EMPTY_TREE_OBJECT;
  }
  async _runWithTempIndex(repositoryRoot, mergeBaseCommit, changedPaths) {
    const tempDir = URI.joinPath(this._environmentService.tmpDir, `agent-host-git-diff-${generateUuid()}`);
    await this._fileService.createFolder(tempDir);
    const indexFile = URI.joinPath(tempDir, "index").fsPath;
    const env = { GIT_INDEX_FILE: indexFile };
    env.COMMAND_HOOK_LOCK = "1";
    try {
      const seeded = await this._runGit(repositoryRoot, ["read-tree", "HEAD"], { env });
      if (seeded === void 0) {
        await this._runGit(repositoryRoot, ["read-tree", EMPTY_TREE_OBJECT], { env });
      }
      if (!await this._stageChangedPaths(repositoryRoot, tempDir, changedPaths, env)) {
        return void 0;
      }
      return await this._runGit(repositoryRoot, ["diff", "--cached", "--raw", "--numstat", "--diff-filter=ADMR", "-z", mergeBaseCommit, "--"], { env });
    } finally {
      try {
        await this._fileService.del(tempDir, { recursive: true, useTrash: false });
      } catch {
      }
    }
  }
  async _stageChangedPaths(repositoryRoot, tempDir, changedPaths, env) {
    if (changedPaths.length === 0) {
      return true;
    }
    const pathspecFile = URI.joinPath(tempDir, "pathspec");
    await this._fileService.writeFile(pathspecFile, VSBuffer.fromString(changedPaths.join("\0") + "\0"));
    this._logService.debug(`[agentHostGitService] Staging ${changedPaths.length} changed path(s) into temp index`);
    return await this._runGit(repositoryRoot, ["add", "-A", `--pathspec-from-file=${pathspecFile.fsPath}`, "--pathspec-file-nul"], {
      env: { ...env, GIT_LITERAL_PATHSPECS: "1" }
    }) !== void 0;
  }
  async _resolveRemoteTrackingBranch(repositoryRoot, branch) {
    const remoteBranch = `origin/${branch}`;
    const output = await this._runGit(repositoryRoot, ["show-ref", "--verify", "--quiet", `refs/remotes/${remoteBranch}`]);
    return output !== void 0 ? remoteBranch : void 0;
  }
  /**
   * Resolves the git-ignored paths to copy into a worktree.
   */
  async _getWorktreeIncludePaths(repositoryRoot, worktreeRoot, globs) {
    if (globs.length === 0) {
      return [];
    }
    const baseArgs = ["ls-files", "--others", "--ignored", "--exclude-standard", "-z"];
    const [filesOutput, directoryOutput, worktreeOutput] = await Promise.all([
      this._runGit(repositoryRoot, baseArgs, { timeout: 6e4 }),
      this._runGit(repositoryRoot, [...baseArgs, "--directory", "--no-empty-directory"], { timeout: 6e4 }),
      this._runGit(worktreeRoot, ["ls-files", "-z"], { timeout: 6e4 })
    ]);
    if (!filesOutput) {
      return [];
    }
    const ignoredFiles = filesOutput.split("\0").filter((entry) => entry.length > 0);
    if (ignoredFiles.length === 0) {
      return [];
    }
    const matchers = globs.map((pattern) => parse(pattern));
    const wholeDirectories = new Set((directoryOutput ?? "").split("\0").filter((entry) => entry.endsWith("/")));
    const worktreeFiles = new Set((worktreeOutput ?? "").split("\0").filter((entry) => entry.length > 0));
    const worktreeDirectories = /* @__PURE__ */ new Set();
    for (const file of worktreeFiles) {
      let index = file.indexOf("/");
      while (index !== -1) {
        worktreeDirectories.add(file.slice(0, index + 1));
        index = file.indexOf("/", index + 1);
      }
    }
    const matchedFiles = [];
    const nonCollapsibleDirectories = /* @__PURE__ */ new Set();
    for (const file of ignoredFiles) {
      if (matchers.some((matcher) => matcher(file)) && !hasWorktreePathCollision(file, worktreeFiles, worktreeDirectories)) {
        matchedFiles.push(file);
      } else if (wholeDirectories.size > 0) {
        const containingDirectory = findContainingDirectory(file, wholeDirectories);
        if (containingDirectory !== void 0) {
          nonCollapsibleDirectories.add(containingDirectory);
        }
      }
    }
    if (matchedFiles.length === 0) {
      return [];
    }
    const collapsedDirectories = /* @__PURE__ */ new Set();
    for (const dir of wholeDirectories) {
      if (!nonCollapsibleDirectories.has(dir)) {
        collapsedDirectories.add(dir);
      }
    }
    return toWorktreeIncludeEntries(repositoryRoot, matchedFiles, collapsedDirectories);
  }
  async showBlob(workingDirectory, ref, repoRelativePath) {
    const repositoryRoot = await this.getRepositoryRoot(workingDirectory);
    if (!repositoryRoot) {
      return void 0;
    }
    return new Promise((resolve) => {
      cp.execFile("git", ["show", `${ref}:${repoRelativePath}`], { cwd: workingDirectory.fsPath, timeout: 5e3, encoding: "buffer", maxBuffer: 32 * 1024 * 1024 }, (error, stdout) => {
        if (error) {
          resolve(void 0);
          return;
        }
        resolve(VSBuffer.wrap(stdout));
      });
    });
  }
  async getSessionGitState(workingDirectory) {
    return this._computeSessionGitState(workingDirectory);
  }
  async getFetchRemoteUrls(workingDirectory, preferredRemote) {
    const repositoryRoot = await this.getRepositoryRoot(workingDirectory);
    if (!repositoryRoot) {
      return void 0;
    }
    return parseFetchRemoteUrls(await this._runGit(repositoryRoot, ["remote", "-v"]), preferredRemote);
  }
  async getUntrackedPaths(workingDirectory) {
    const repositoryRoot = await this.getRepositoryRoot(workingDirectory);
    if (!repositoryRoot) {
      return void 0;
    }
    const status = await this._runGit(repositoryRoot, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
    return status === void 0 ? void 0 : parseUntrackedPaths(status);
  }
  async captureWorkingTreeAsTree(workingDirectory) {
    const repositoryRoot = await this.getRepositoryRoot(workingDirectory);
    if (!repositoryRoot) {
      return void 0;
    }
    const statusOut = await this._runGit(repositoryRoot, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
    if (statusOut === void 0) {
      return void 0;
    }
    const changedPaths = parseChangedPaths(statusOut);
    const tempDir = URI.joinPath(this._environmentService.tmpDir, `agent-host-checkpoint-${generateUuid()}`);
    await this._fileService.createFolder(tempDir);
    const indexFile = URI.joinPath(tempDir, "index").fsPath;
    const env = { GIT_INDEX_FILE: indexFile, COMMAND_HOOK_LOCK: "1" };
    try {
      const seeded = await this._runGit(repositoryRoot, ["read-tree", "HEAD"], { env });
      if (seeded === void 0) {
        await this._runGit(repositoryRoot, ["read-tree", EMPTY_TREE_OBJECT], { env });
      }
      if (!await this._stageChangedPaths(repositoryRoot, tempDir, changedPaths, env)) {
        return void 0;
      }
      const tree = (await this._runGit(repositoryRoot, ["write-tree"], { env }))?.trim();
      return tree || void 0;
    } finally {
      try {
        await this._fileService.del(tempDir, { recursive: true, useTrash: false });
      } catch {
      }
    }
  }
  async commitTree(repositoryRoot, treeOid, parentOid, message) {
    const args = ["commit-tree", treeOid];
    if (parentOid) {
      args.push("-p", parentOid);
    }
    args.push("-m", message);
    const out = await this._runGit(repositoryRoot, args, { throwOnError: true });
    return out?.trim() || void 0;
  }
  async updateRef(repositoryRoot, ref, newOid) {
    await this._runGit(repositoryRoot, ["update-ref", ref, newOid], { throwOnError: true });
  }
  async deleteRefs(repositoryRoot, refs) {
    if (refs.length === 0) {
      return;
    }
    const stdin = refs.map((ref) => `delete ${ref}\0\0`).join("");
    await new Promise((resolve) => {
      const proc = cp.execFile("git", ["update-ref", "--stdin", "-z"], { cwd: repositoryRoot.fsPath, timeout: 1e4 }, () => {
        resolve();
      });
      proc.stdin?.end(stdin);
    });
  }
  async revParse(repositoryRoot, expression) {
    const out = await this._runGit(repositoryRoot, ["rev-parse", "--verify", "--quiet", expression]);
    return out?.trim() || void 0;
  }
  async listRefNamesWithOids(repositoryRoot, pattern) {
    const out = await this._runGit(repositoryRoot, ["for-each-ref", "--format=%(refname)%00%(objectname)", pattern]);
    if (!out) {
      return [];
    }
    const result = [];
    for (const line of out.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      const [ref, oid] = trimmed.split("\0");
      if (ref && oid) {
        result.push({ ref, oid });
      }
    }
    return result;
  }
  async overlayPathIntoTree(repositoryRoot, baseTreeOid, path2, sourceTreeOid) {
    const tempDir = URI.joinPath(this._environmentService.tmpDir, `agent-host-review-overlay-${generateUuid()}`);
    await this._fileService.createFolder(tempDir);
    const indexFile = URI.joinPath(tempDir, "index").fsPath;
    const env = { GIT_INDEX_FILE: indexFile, COMMAND_HOOK_LOCK: "1" };
    try {
      const readTreeOut = await this._runGit(repositoryRoot, ["read-tree", baseTreeOid], { env, throwOnError: false });
      if (readTreeOut === void 0) {
        return void 0;
      }
      const lsTreeOut = await this._runGit(repositoryRoot, ["ls-tree", "-z", sourceTreeOid, "--", path2], { env });
      const entry = parseSingleLsTreeEntry(lsTreeOut);
      if (entry) {
        const updateIndexOut = await this._runGit(repositoryRoot, ["update-index", "--add", "--cacheinfo", `${entry.mode},${entry.oid},${path2}`], { env, throwOnError: false });
        if (updateIndexOut === void 0) {
          return void 0;
        }
      } else {
        const updateIndexOut = await this._runGit(repositoryRoot, ["update-index", "--force-remove", "--", path2], { env, throwOnError: false });
        if (updateIndexOut === void 0) {
          return void 0;
        }
      }
      const writeTreeOut = await this._runGit(repositoryRoot, ["write-tree"], { env });
      return writeTreeOut?.trim();
    } finally {
      try {
        await this._fileService.del(tempDir, { recursive: true, useTrash: false });
      } catch {
      }
    }
  }
  async diffTreePaths(repositoryRoot, fromTreeish, toTreeish) {
    const out = await this._runGit(repositoryRoot, ["diff", "--name-only", "--no-renames", "-z", fromTreeish, toTreeish, "--"]);
    if (out === void 0) {
      return void 0;
    }
    return out.split("\0").filter(Boolean);
  }
  async computeFileDiffsBetweenRefs(workingDirectory, options) {
    const repositoryRoot = await this.getRepositoryRoot(workingDirectory);
    if (!repositoryRoot) {
      return void 0;
    }
    try {
      const raw = await this._runGit(repositoryRoot, ["diff", "--raw", "--numstat", "--diff-filter=ADMR", "-z", options.fromRef, options.toRef, "--"]);
      if (raw === void 0) {
        return void 0;
      }
      return parseGitDiffRawNumstat(raw, repositoryRoot, options.sessionUri, options.fromRef, options.toRef);
    } catch (err) {
      this._logService.warn(`[AgentHostGitService][computeFileDiffsBetweenRefs] Failed to compute file diffs ${repositoryRoot.toString()}, ${options.fromRef}, ${options.toRef}: ${err}`);
      return void 0;
    }
  }
  async getBranchDiffSafetyInfo(workingDirectory, baselineCommit) {
    const repositoryRoot = await this.getRepositoryRoot(workingDirectory);
    if (!repositoryRoot) {
      return void 0;
    }
    const [virtualFileSystem, sparseCheckout, timestamp, commitCount, workspaceFiles] = await Promise.all([
      this._runGit(repositoryRoot, ["config", "--get", "core.virtualfilesystem"]),
      this._runGit(repositoryRoot, ["config", "--get", "core.sparsecheckout"]),
      this._runGit(repositoryRoot, ["show", "-s", "--format=%ct", baselineCommit]),
      this._runGit(repositoryRoot, ["rev-list", "--count", `${baselineCommit}..HEAD`]),
      this._runGit(repositoryRoot, ["ls-files", "--cached", "--others", "--exclude-standard", "-z"])
    ]);
    const sparseCheckoutEnabled = (/* @__PURE__ */ new Set(["true", "yes", "on", "1"])).has(sparseCheckout?.trim().toLowerCase() ?? "");
    const timestampSeconds = Number(timestamp?.trim());
    const parsedCommitCount = Number(commitCount?.trim());
    return {
      hasVirtualFileSystem: Boolean(virtualFileSystem?.trim()) || sparseCheckoutEnabled,
      baselineCommitTimestamp: Number.isFinite(timestampSeconds) ? timestampSeconds * 1e3 : void 0,
      commitCount: Number.isFinite(parsedCommitCount) ? parsedCommitCount : void 0,
      workspaceFileCount: workspaceFiles?.split("\0").filter(Boolean).length ?? 0
    };
  }
  async getDiffPatchBetweenRefs(workingDirectory, options) {
    const repositoryRoot = await this.getRepositoryRoot(workingDirectory);
    if (!repositoryRoot) {
      return void 0;
    }
    const paths = [...new Set(options.paths)];
    if (paths.length === 0) {
      return { patch: "", tooLarge: false };
    }
    try {
      const patch = await this._runGit(repositoryRoot, ["diff", "--patch", "--no-ext-diff", "--find-renames", "--diff-filter=ADMR", options.fromRef, options.toRef, "--", ...paths], { maxBuffer: options.maxBuffer, throwOnError: true });
      return patch === void 0 ? void 0 : { patch, tooLarge: false };
    } catch (error) {
      if (isMaxBufferError(error)) {
        return { patch: void 0, tooLarge: true };
      }
      throw error;
    }
  }
  async _computeSessionGitState(workingDirectory) {
    const repositoryRoot = await this.getRepositoryRoot(workingDirectory);
    if (!repositoryRoot) {
      return void 0;
    }
    const [
      statusOutput,
      remotesOutput,
      defaultBranchRef
    ] = await Promise.all([
      this._runGit(repositoryRoot, ["status", "-b", "--porcelain=v2"]),
      this._runGit(repositoryRoot, ["remote", "-v"]),
      this._runGit(repositoryRoot, ["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"])
    ]);
    const status = parseGitStatusV2(statusOutput);
    const hasGitHubRemote = parseHasGitHubRemote(remotesOutput);
    const baseBranchName = parseDefaultBranchRef(defaultBranchRef);
    const githubRepo = parseGitHubRepoFromRemote(remotesOutput);
    const upstreamRemote = status.upstreamBranchName?.split("/")[0];
    const githubHeadRepo = upstreamRemote ? parseGitHubRepoFromRemote(remotesOutput, upstreamRemote) : void 0;
    let outgoingChanges = status.outgoingChanges;
    if (outgoingChanges === void 0 && baseBranchName && status.branchName && status.branchName !== baseBranchName) {
      const ahead = await this._runGit(repositoryRoot, ["rev-list", "--count", `${baseBranchName}..HEAD`]);
      const parsed = ahead === void 0 ? NaN : Number(ahead.trim());
      if (Number.isFinite(parsed)) {
        outgoingChanges = parsed;
      }
    }
    const result = {
      hasGitHubRemote,
      branchName: status.branchName,
      baseBranchName,
      upstreamBranchName: status.upstreamBranchName,
      incomingChanges: status.incomingChanges,
      outgoingChanges,
      uncommittedChanges: status.uncommittedChanges,
      githubOwner: githubRepo?.owner,
      githubHeadOwner: githubHeadRepo?.owner,
      githubRepo: githubRepo?.repo
    };
    return stripUndefined(result);
  }
  _runGit(workingDirectory, args, options) {
    this._logService.trace(`[agentHostGitService] > git ${args.join(" ")}`);
    return new Promise((resolve, reject) => {
      const env = options?.env ? { ...process.env, ...options.env } : void 0;
      const timeoutMs = options?.timeout ?? 5e3;
      let didTimeOut = false;
      const child = cp.execFile("git", [...args], { cwd: workingDirectory.fsPath, env, maxBuffer: options?.maxBuffer ?? 32 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          if (stderr) {
            this._logService.warn(`[agentHostGitService] > git ${args.join(" ")} failed; full stderr:
${stderr}`);
          }
          if (options?.throwOnError) {
            reject(new Error(formatGitError(args, timeoutMs, didTimeOut, error, stderr), { cause: error }));
            return;
          }
          resolve(void 0);
          return;
        }
        resolve(stdout);
      });
      const onStderr = options?.onStderr;
      if (onStderr) {
        child.stderr?.on("data", (chunk) => onStderr(chunk.toString()));
      }
      const timer = setTimeout(() => {
        didTimeOut = true;
        child.kill();
      }, timeoutMs);
      child.on("exit", () => clearTimeout(timer));
    });
  }
};
AgentHostGitService = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, INativeEnvironmentService),
  __decorateParam(2, ILogService)
], AgentHostGitService);
class GitCheckoutProgressParser {
  constructor(_onProgress) {
    this._onProgress = _onProgress;
    this._pending = "";
  }
  static {
    this._pattern = /Updating files:\s+\d+% \((?<done>\d+)\/(?<total>\d+)\)/g;
  }
  push(chunk) {
    const buffer = this._pending + chunk;
    const lastBreak = Math.max(buffer.lastIndexOf("\r"), buffer.lastIndexOf("\n"));
    if (lastBreak === -1) {
      this._pending = buffer;
      return;
    }
    this._pending = buffer.substring(lastBreak + 1);
    const complete = buffer.substring(0, lastBreak);
    GitCheckoutProgressParser._pattern.lastIndex = 0;
    let match;
    while (match = GitCheckoutProgressParser._pattern.exec(complete)) {
      const filesTotal = Number(match.groups.total);
      if (filesTotal > 0) {
        this._onProgress({ filesDone: Number(match.groups.done), filesTotal });
      }
    }
  }
}
function toWorktreeIncludeEntries(repositoryRoot, matchedFiles, collapsedDirectories) {
  const toEntry = (relativePath, fileCount) => ({
    sourcePath: path.join(repositoryRoot.fsPath, relativePath),
    fileCount
  });
  const directoryFileCounts = /* @__PURE__ */ new Map();
  for (const dir of collapsedDirectories) {
    directoryFileCounts.set(dir, 0);
  }
  const fileEntries = [];
  for (const file of matchedFiles) {
    const containingDirectory = collapsedDirectories.size > 0 ? findContainingDirectory(file, collapsedDirectories) : void 0;
    if (containingDirectory === void 0) {
      fileEntries.push(toEntry(file, 1));
    } else {
      directoryFileCounts.set(containingDirectory, directoryFileCounts.get(containingDirectory) + 1);
    }
  }
  return [
    ...[...directoryFileCounts].map(([dir, fileCount]) => toEntry(dir, fileCount)),
    ...fileEntries
  ];
}
function findContainingDirectory(file, directories) {
  let index = file.indexOf("/");
  while (index !== -1) {
    const prefix = file.slice(0, index + 1);
    if (directories.has(prefix)) {
      return prefix;
    }
    index = file.indexOf("/", index + 1);
  }
  return void 0;
}
function hasWorktreePathCollision(file, worktreeFiles, worktreeDirectories) {
  if (worktreeFiles.has(file) || worktreeDirectories.has(`${file}/`)) {
    return true;
  }
  let index = file.indexOf("/");
  while (index !== -1) {
    if (worktreeFiles.has(file.slice(0, index))) {
      return true;
    }
    index = file.indexOf("/", index + 1);
  }
  return false;
}
function formatGitError(args, timeoutMs, didTimeOut, error, stderr) {
  const subcommand = args[0] ?? "(unknown)";
  let reason;
  if (didTimeOut) {
    reason = `git ${subcommand} timed out after ${timeoutMs}ms`;
  } else if (error.killed && error.signal) {
    reason = `git ${subcommand} killed by ${error.signal}`;
  } else if (typeof error.code === "number") {
    reason = `git ${subcommand} exited with code ${error.code}`;
  } else {
    reason = error.message;
  }
  const detail = summarizeStderrForError(stderr);
  return detail ? `${reason}: ${detail}` : reason;
}
function summarizeStderrForError(stderr) {
  if (!stderr) {
    return "";
  }
  const lines = stderr.split(/[\r\n]+/g).map((line) => line.trim()).filter((line) => line.length > 0);
  if (lines.length === 0) {
    return "";
  }
  const MAX = 200;
  const gitLfsMissing = lines.find(
    (line) => /\bgit-lfs\b/i.test(line) && /(command not found|not recognized|no such file)/i.test(line)
  );
  const summary = gitLfsMissing ?? lines[lines.length - 1];
  return summary.length > MAX ? `${summary.slice(0, MAX - 1)}\u2026` : summary;
}
function parseUntrackedPaths(output) {
  return parseChangedPaths(output, (status) => status === "??");
}
function parseChangedPaths(output, includeStatus = () => true) {
  if (!output) {
    return [];
  }
  const result = [];
  const seen = /* @__PURE__ */ new Set();
  const addPath = (path2) => {
    if (path2 && !seen.has(path2)) {
      seen.add(path2);
      result.push(path2);
    }
  };
  const segments = output.split("\0");
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg) {
      continue;
    }
    const status = seg.substring(0, 2);
    const path2 = seg.substring(3);
    const isRenameOrCopy = status[0] === "R" || status[1] === "R" || status[0] === "C" || status[1] === "C";
    if (includeStatus(status)) {
      addPath(path2);
      if (isRenameOrCopy) {
        const sourcePath = segments[++i];
        if (sourcePath) {
          addPath(sourcePath);
        }
      }
    } else if (isRenameOrCopy) {
      i++;
    }
  }
  return result;
}
function parseSingleLsTreeEntry(output) {
  if (!output) {
    return void 0;
  }
  const entry = output.split("\0")[0];
  if (!entry) {
    return void 0;
  }
  const tabIndex = entry.indexOf("	");
  const meta = (tabIndex === -1 ? entry : entry.substring(0, tabIndex)).split(" ");
  if (meta.length < 3) {
    return void 0;
  }
  return { mode: meta[0], oid: meta[2] };
}
function parseGitDiffRawNumstat(output, repositoryRoot, sessionUri, beforeRef, afterRef) {
  const segments = output.split("\0");
  const changes = [];
  const numStats = /* @__PURE__ */ new Map();
  let i = 0;
  while (i < segments.length) {
    const segment = segments[i++];
    if (!segment) {
      continue;
    }
    if (segment.startsWith(":")) {
      const fields = segment.split(" ");
      const status = fields[4] ?? "";
      const path1 = segments[i++];
      if (!path1) {
        continue;
      }
      switch (status[0]) {
        case "A":
          changes.push({ kind: FileEditKind.Create, newPath: path1 });
          break;
        case "M":
          changes.push({ kind: FileEditKind.Edit, oldPath: path1, newPath: path1 });
          break;
        case "D":
          changes.push({ kind: FileEditKind.Delete, oldPath: path1 });
          break;
        case "R": {
          const path2 = segments[i++];
          if (!path2) {
            continue;
          }
          changes.push({ kind: FileEditKind.Rename, oldPath: path1, newPath: path2 });
          break;
        }
        default:
          break;
      }
    } else {
      const [addedStr, removedStr, filePath] = segment.split("	");
      let key;
      if (filePath === "" || filePath === void 0) {
        const oldPath = segments[i++];
        const newPath = segments[i++];
        key = newPath ?? oldPath ?? "";
      } else {
        key = filePath;
      }
      if (!key) {
        continue;
      }
      numStats.set(key, {
        added: addedStr === "-" ? 0 : Number(addedStr) || 0,
        removed: removedStr === "-" ? 0 : Number(removedStr) || 0
      });
    }
  }
  return changes.map((change) => {
    const stats = numStats.get(change.newPath ?? change.oldPath ?? "");
    const beforeFileUri = change.oldPath ? URI.joinPath(repositoryRoot, change.oldPath) : void 0;
    const afterFileUri = change.newPath ? URI.joinPath(repositoryRoot, change.newPath) : void 0;
    const before = change.kind !== FileEditKind.Create && change.oldPath && beforeFileUri ? {
      uri: beforeFileUri.toString(),
      content: { uri: buildGitBlobUri(sessionUri, beforeRef, change.oldPath, beforeFileUri.path) }
    } : void 0;
    const after = change.kind !== FileEditKind.Delete && change.newPath && afterFileUri ? {
      uri: afterFileUri.toString(),
      content: afterRef !== void 0 ? { uri: buildGitBlobUri(sessionUri, afterRef, change.newPath, afterFileUri.path) } : { uri: afterFileUri.toString() }
    } : void 0;
    const diff = {
      added: stats?.added ?? 0,
      removed: stats?.removed ?? 0
    };
    return {
      ...before ? { before } : {},
      ...after ? { after } : {},
      diff
    };
  });
}
function parseGitStatusV2(output) {
  if (!output) {
    return {};
  }
  let branchName;
  let upstreamBranchName;
  let outgoingChanges;
  let incomingChanges;
  let uncommittedChanges = 0;
  for (const rawLine of output.split(/\r?\n/g)) {
    const line = rawLine.trimEnd();
    if (!line) {
      continue;
    }
    if (line.startsWith("# branch.head ")) {
      const head = line.substring("# branch.head ".length).trim();
      branchName = head === "(detached)" ? void 0 : head;
    } else if (line.startsWith("# branch.upstream ")) {
      upstreamBranchName = line.substring("# branch.upstream ".length).trim();
    } else if (line.startsWith("# branch.ab ")) {
      const m = /^# branch\.ab \+(\d+) -(\d+)$/.exec(line);
      if (m) {
        outgoingChanges = Number(m[1]);
        incomingChanges = Number(m[2]);
      }
    } else if (!line.startsWith("#")) {
      uncommittedChanges++;
    }
  }
  return { branchName, upstreamBranchName, outgoingChanges, incomingChanges, uncommittedChanges };
}
function parseHasGitHubRemote(remotesOutput) {
  if (remotesOutput === void 0) {
    return void 0;
  }
  if (!remotesOutput.trim()) {
    return false;
  }
  return /github\.com[:\/]/i.test(remotesOutput);
}
function parseFetchRemoteUrls(remotesOutput, preferredRemote) {
  const candidates = parseFetchRemotes(remotesOutput);
  if (!candidates) {
    return void 0;
  }
  const preferredNames = new Set([preferredRemote, "origin"].filter((name) => Boolean(name)));
  const ordered = [
    ...candidates.filter((candidate) => candidate.name === preferredRemote),
    ...candidates.filter((candidate) => candidate.name === "origin" && candidate.name !== preferredRemote),
    ...candidates.filter((candidate) => !preferredNames.has(candidate.name))
  ];
  return [...new Set(ordered.map((candidate) => candidate.url))];
}
function parseFetchRemotes(remotesOutput) {
  if (remotesOutput === void 0) {
    return void 0;
  }
  const candidates = [];
  for (const rawLine of remotesOutput.split(/\r?\n/)) {
    const match = /^(\S+)\s+(\S+)\s+\(fetch\)$/.exec(rawLine.trim());
    if (match) {
      candidates.push({ name: match[1], url: match[2] });
    }
  }
  return candidates;
}
function parseGitHubRepoFromRemote(remotesOutput, remoteName) {
  const candidates = remoteName === void 0 ? parseFetchRemoteUrls(remotesOutput) : parseFetchRemotes(remotesOutput)?.filter((candidate) => candidate.name === remoteName).map((candidate) => candidate.url);
  if (!candidates) {
    return void 0;
  }
  for (const url of candidates) {
    const parsed = parseGitHubOwnerRepoFromUrl(url);
    if (parsed) {
      return parsed;
    }
  }
  return void 0;
}
function parseGitHubOwnerRepoFromUrl(url) {
  let m = /^[^@\s]+@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i.exec(url);
  if (m) {
    return { owner: m[1], repo: m[2] };
  }
  m = /^[a-z+]+:\/\/(?:[^@\/\s]+@)?github\.com(?::\d+)?\/([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i.exec(url);
  if (m) {
    return { owner: m[1], repo: m[2] };
  }
  return void 0;
}
function parseDefaultBranchRef(symbolicRefOutput) {
  const ref = symbolicRefOutput?.trim();
  if (!ref) {
    return void 0;
  }
  const prefix = "refs/remotes/origin/";
  return ref.startsWith(prefix) ? ref.substring(prefix.length) : ref;
}
function parseRemoteBranchRef(ref) {
  if (!ref.startsWith("refs/remotes/")) {
    return void 0;
  }
  const name = ref.substring(13);
  const remote = name.split("/")[0];
  return { ref, name, remote };
}
function parseGitRefs(output) {
  if (!output) {
    return [];
  }
  const refs = [];
  for (const line of output.split(/\r?\n/g)) {
    const [ref, upstream] = line.trim().split("\0");
    if (ref.startsWith("refs/heads/")) {
      refs.push({
        ref,
        name: ref.substring(11),
        upstream: upstream ? parseRemoteBranchRef(upstream) : void 0,
        kind: GitRefType.Head
      });
    } else if (ref.startsWith("refs/remotes/") && !/^refs\/remotes\/[^/]+\/HEAD$/.test(ref)) {
      const parsedRemoteBranch = parseRemoteBranchRef(ref);
      if (parsedRemoteBranch) {
        refs.push({
          ...parsedRemoteBranch,
          kind: GitRefType.RemoteHead
        });
      }
    } else if (ref.startsWith("refs/tags/")) {
      refs.push({
        ref,
        name: ref.substring(10),
        kind: GitRefType.Tag
      });
    }
  }
  return refs;
}
function stripUndefined(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== void 0) {
      out[k] = v;
    }
  }
  return out;
}
function isMaxBufferError(error) {
  const cause = error instanceof Error ? error.cause : void 0;
  return cause instanceof Error && cause.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER";
}
export {
  AgentHostGitService,
  GitCheckoutProgressParser,
  formatGitError,
  parseChangedPaths,
  parseDefaultBranchRef,
  parseFetchRemoteUrls,
  parseGitDiffRawNumstat,
  parseGitHubRepoFromRemote,
  parseGitRefs,
  parseGitStatusV2,
  parseHasGitHubRemote,
  parseRemoteBranchRef,
  parseSingleLsTreeEntry,
  parseUntrackedPaths,
  summarizeStderrForError
};
