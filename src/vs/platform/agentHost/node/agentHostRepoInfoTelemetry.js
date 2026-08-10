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
import { Limiter } from "../../../base/common/async.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { joinPath, relativePath } from "../../../base/common/resources.js";
import { URI } from "../../../base/common/uri.js";
import { ILogService } from "../../log/common/log.js";
import { IAgentHostGitService } from "../common/agentHostGitService.js";
import { IAgentHostGitHubEndpointService } from "./agentHostGitHubEndpointService.js";
const MAX_DIFFS_JSON_BYTES = 900 * 1024;
const MAX_DIFFS_JSON_CHARS = 50 * 8192;
const MAX_CHANGES = 100;
const MAX_MERGE_BASE_AGE_MS = 30 * 24 * 60 * 60 * 1e3;
const MAX_DIFF_COMMITS = 30;
const DIFF_PATCH_CONCURRENCY = 4;
const MAX_DIFF_SIZE = 1e5;
function resolveRepoInfoRemote(remoteUrl, enterpriseHost) {
  const scpMatch = remoteUrl.includes("://") ? void 0 : /^(?:[^@\s]+@)?(?<host>[^:\s]+):(?<path>.+)$/.exec(remoteUrl);
  let host;
  let path;
  let normalizedRemoteUrl;
  if (scpMatch?.groups) {
    host = scpMatch.groups["host"];
    path = scpMatch.groups["path"];
    normalizedRemoteUrl = `https://${host}/${path}`;
  } else {
    let parsed;
    try {
      parsed = new URL(remoteUrl);
    } catch {
      return void 0;
    }
    host = parsed.host;
    path = parsed.pathname;
    normalizedRemoteUrl = `https://${host}${path}`;
  }
  const normalizedHost = host.toLowerCase();
  const normalizedHostname = normalizedHost.replace(/:\d+$/, "");
  const normalizedPath = path.replace(/^\/+|\/+$/g, "");
  if (normalizedHostname === "github.com" || normalizedHost === enterpriseHost?.toLowerCase() || normalizedHostname === "ghe.com" || normalizedHostname.endsWith(".ghe.com")) {
    const match = /^(?<owner>[^/]+)\/(?<repo>[^/]+?)(?:\.git)?$/i.exec(normalizedPath);
    if (!match?.groups) {
      return void 0;
    }
    return {
      remoteUrl: normalizedRemoteUrl,
      repoId: `${match.groups["owner"]}/${match.groups["repo"]}`.toLowerCase(),
      repoType: "github"
    };
  }
  let adoMatch = null;
  if (normalizedHostname === "dev.azure.com") {
    adoMatch = /^(?<org>[^/]+)\/(?<project>[^/]+)\/_git\/(?:_(?:optimized|full)\/)?(?<repo>[^/]+?)(?:\.git)?$/i.exec(normalizedPath);
  } else if (normalizedHostname === "ssh.dev.azure.com") {
    adoMatch = /^v3\/(?<org>[^/]+)\/(?<project>[^/]+)\/(?:_(?:optimized|full)\/)?(?<repo>[^/]+?)(?:\.git)?$/i.exec(normalizedPath);
  } else if (normalizedHostname.endsWith(".visualstudio.com")) {
    adoMatch = /^v3\/(?<org>[^/]+)\/(?<project>[^/]+)\/(?:_(?:optimized|full)\/)?(?<repo>[^/]+?)(?:\.git)?$/i.exec(normalizedPath) ?? /^(?:[^/]+\/)?(?<project>[^/]+)\/_git\/(?:_(?:optimized|full)\/)?(?<repo>[^/]+?)(?:\.git)?$/i.exec(normalizedPath);
    if (adoMatch?.groups && !adoMatch.groups["org"]) {
      adoMatch.groups["org"] = normalizedHostname.substring(0, normalizedHostname.length - ".visualstudio.com".length);
    }
  }
  if (!adoMatch?.groups?.["org"] || !adoMatch.groups["project"] || !adoMatch.groups["repo"]) {
    return void 0;
  }
  return {
    remoteUrl: normalizedRemoteUrl,
    repoId: `${adoMatch.groups["org"]}/${adoMatch.groups["project"]}/${adoMatch.groups["repo"]}`.toLowerCase(),
    repoType: "ado"
  };
}
function measureRepoInfoDiffsJSON(diffsJSON) {
  const diffSizeBytes = Buffer.byteLength(diffsJSON, "utf8");
  return {
    diffSizeBytes,
    tooLarge: diffSizeBytes > MAX_DIFFS_JSON_BYTES || diffsJSON.length > MAX_DIFFS_JSON_CHARS
  };
}
let AgentHostRepoInfoTelemetry = class extends Disposable {
  constructor(_reporter, _gitService, _gitHubEndpointService, _logService) {
    super();
    this._reporter = _reporter;
    this._gitService = _gitService;
    this._gitHubEndpointService = _gitHubEndpointService;
    this._logService = _logService;
    this._beginResults = /* @__PURE__ */ new Map();
    this._isDisposed = false;
  }
  async reportBegin(context, sessionUri, telemetryMessageId, clientType, workingDirectory, baseBranch, isContextCurrent, checkContentExclusion) {
    let begin = this._beginResults.get(telemetryMessageId);
    if (!begin) {
      begin = {
        clientType,
        result: this._captureSafely(context, sessionUri, telemetryMessageId, clientType, "begin", workingDirectory, baseBranch, isContextCurrent, checkContentExclusion)
      };
      this._beginResults.set(telemetryMessageId, begin);
    }
    await begin.result;
  }
  async reportEnd(context, sessionUri, telemetryMessageId, workingDirectory, baseBranch, isContextCurrent, checkContentExclusion) {
    const begin = this._beginResults.get(telemetryMessageId);
    if (!begin) {
      return;
    }
    try {
      const beginResult = await begin.result;
      if (beginResult === "success" || beginResult === "noChanges") {
        await this._captureSafely(context, sessionUri, telemetryMessageId, begin.clientType, "end", workingDirectory, baseBranch, isContextCurrent, checkContentExclusion);
      }
    } finally {
      this._beginResults.delete(telemetryMessageId);
    }
  }
  clearTurn(telemetryMessageId) {
    this._beginResults.delete(telemetryMessageId);
  }
  dispose() {
    this._isDisposed = true;
    this._beginResults.clear();
    super.dispose();
  }
  async _captureSafely(context, sessionUri, telemetryMessageId, clientType, location, workingDirectory, baseBranch, isContextCurrent, checkContentExclusion) {
    try {
      return await this._capture(context, sessionUri, telemetryMessageId, clientType, location, workingDirectory, baseBranch, isContextCurrent, checkContentExclusion);
    } catch (error) {
      this._logService.warn(`[AgentHostRepoInfoTelemetry] Failed to capture ${location} repo info: ${error instanceof Error ? error.message : String(error)}`);
      return void 0;
    }
  }
  async _capture(telemetryContext, sessionUri, telemetryMessageId, clientType, location, workingDirectory, persistedBaseBranch, isContextCurrent, checkContentExclusion) {
    if (!workingDirectory || !isContextCurrent() || !telemetryContext.restrictedTelemetryEnabled && !telemetryContext.isInternal) {
      return void 0;
    }
    const [gitState, untrackedPaths] = await Promise.all([
      this._gitService.getSessionGitState(workingDirectory),
      this._gitService.getUntrackedPaths(workingDirectory)
    ]);
    const upstreamRemote = gitState?.upstreamBranchName?.split("/")[0];
    const fetchRemoteUrls = await this._gitService.getFetchRemoteUrls(workingDirectory, upstreamRemote);
    const remote = fetchRemoteUrls?.map((url) => resolveRepoInfoRemote(url, this._gitHubEndpointService.getEnterpriseHost())).find((candidate) => candidate !== void 0);
    if (!remote) {
      return void 0;
    }
    const baseBranch = persistedBaseBranch ?? gitState?.upstreamBranchName ?? gitState?.baseBranchName ?? (await this._gitService.getDefaultBranch(workingDirectory))?.name;
    const [headBranchName, headCommitHash] = await Promise.all([
      gitState?.branchName ? Promise.resolve(gitState.branchName) : this._gitService.getCurrentBranch(workingDirectory),
      this._gitService.resolveBranchBaselineCommit(workingDirectory, baseBranch)
    ]);
    if (!headCommitHash) {
      return void 0;
    }
    const repoInfo = { ...remote, headCommitHash, headBranchName };
    const safety = await this._gitService.getBranchDiffSafetyInfo(workingDirectory, headCommitHash);
    if (!safety) {
      return void 0;
    }
    if (safety.hasVirtualFileSystem) {
      return this._report(telemetryContext, isContextCurrent, telemetryMessageId, clientType, location, repoInfo, "virtualFileSystem", 0, 0, 0);
    }
    if (safety.baselineCommitTimestamp === void 0 || Date.now() - safety.baselineCommitTimestamp > MAX_MERGE_BASE_AGE_MS) {
      return this._report(telemetryContext, isContextCurrent, telemetryMessageId, clientType, location, repoInfo, "mergeBaseTooOld", 0, 0, 0);
    }
    if (safety.commitCount === void 0 || safety.commitCount >= MAX_DIFF_COMMITS) {
      return this._report(telemetryContext, isContextCurrent, telemetryMessageId, clientType, location, repoInfo, "tooManyCommits", 0, 0, 0);
    }
    const tree = await this._gitService.captureWorkingTreeAsTree(workingDirectory);
    if (!tree) {
      return void 0;
    }
    const fileDiffs = await this._gitService.computeFileDiffsBetweenRefs(workingDirectory, {
      sessionUri,
      fromRef: headCommitHash,
      toRef: tree
    });
    if (!fileDiffs) {
      return void 0;
    }
    if (fileDiffs.length === 0) {
      return await this._reportIfTreeUnchanged(telemetryContext, isContextCurrent, telemetryMessageId, clientType, location, repoInfo, workingDirectory, tree, "noChanges", safety.workspaceFileCount, 0, 0);
    }
    if (fileDiffs.length > MAX_CHANGES) {
      return this._report(telemetryContext, isContextCurrent, telemetryMessageId, clientType, location, repoInfo, "tooManyChanges", safety.workspaceFileCount, fileDiffs.length, 0);
    }
    const repositoryRoot = await this._gitService.getRepositoryRoot(workingDirectory);
    if (!repositoryRoot) {
      return void 0;
    }
    const untracked = new Set(untrackedPaths ?? []);
    const descriptors = fileDiffs.map((diff) => this._describeFileDiff(repositoryRoot, diff, untracked));
    if (descriptors.some((descriptor) => descriptor === void 0)) {
      return void 0;
    }
    const resolvedDescriptors = descriptors;
    let allowedDescriptors = resolvedDescriptors;
    if (telemetryContext.copilotIgnoreEnabled !== false) {
      allowedDescriptors = await this._filterContentExclusionAllowedDescriptors(repositoryRoot, resolvedDescriptors, checkContentExclusion);
    }
    const fileRelativePaths = JSON.stringify([...new Set(allowedDescriptors.map((descriptor) => descriptor.newPath ?? descriptor.oldPath).filter((path) => path !== void 0))]);
    let patchTooLarge = false;
    const limiter = new Limiter(DIFF_PATCH_CONCURRENCY);
    const diffs = await Promise.all(allowedDescriptors.map((descriptor) => limiter.queue(async () => {
      const paths = [...new Set([descriptor.oldPath, descriptor.newPath].filter((path) => path !== void 0))];
      const result = await this._gitService.getDiffPatchBetweenRefs(workingDirectory, { fromRef: headCommitHash, toRef: tree, paths, maxBuffer: MAX_DIFFS_JSON_BYTES });
      if (!result) {
        throw new Error(`Failed to compute diff for ${paths.join(", ")}`);
      }
      if (result.tooLarge) {
        patchTooLarge = true;
      }
      return {
        uri: descriptor.uri,
        originalUri: descriptor.originalUri,
        renameUri: descriptor.renameUri,
        status: descriptor.status,
        diff: truncateRepoInfoDiff(result.patch ?? "", descriptor.uri)
      };
    })));
    if (patchTooLarge) {
      return await this._reportIfTreeUnchanged(telemetryContext, isContextCurrent, telemetryMessageId, clientType, location, repoInfo, workingDirectory, tree, "diffTooLarge", safety.workspaceFileCount, fileDiffs.length, MAX_DIFFS_JSON_BYTES + 1, fileRelativePaths);
    }
    const diffsJSON = diffs.length > 0 ? JSON.stringify(diffs) : void 0;
    if (!diffsJSON) {
      return await this._reportIfTreeUnchanged(telemetryContext, isContextCurrent, telemetryMessageId, clientType, location, repoInfo, workingDirectory, tree, "success", safety.workspaceFileCount, fileDiffs.length, 0, fileRelativePaths);
    }
    const measurement = measureRepoInfoDiffsJSON(diffsJSON);
    if (measurement.tooLarge) {
      return await this._reportIfTreeUnchanged(telemetryContext, isContextCurrent, telemetryMessageId, clientType, location, repoInfo, workingDirectory, tree, "diffTooLarge", safety.workspaceFileCount, fileDiffs.length, measurement.diffSizeBytes, fileRelativePaths);
    }
    return await this._reportIfTreeUnchanged(telemetryContext, isContextCurrent, telemetryMessageId, clientType, location, repoInfo, workingDirectory, tree, "success", safety.workspaceFileCount, fileDiffs.length, measurement.diffSizeBytes, fileRelativePaths, diffsJSON);
  }
  async _filterContentExclusionAllowedDescriptors(repositoryRoot, descriptors, checkContentExclusion) {
    if (!checkContentExclusion) {
      return [];
    }
    const paths = [...new Set(descriptors.flatMap((descriptor) => [descriptor.oldPath, descriptor.newPath].filter((path) => path !== void 0).map((path) => joinPath(repositoryRoot, path).fsPath)))];
    if (paths.length === 0) {
      return [];
    }
    let result;
    try {
      result = await checkContentExclusion(paths);
    } catch {
      return [];
    }
    if (result.available !== true || !Array.isArray(result.checks) || result.checks.length !== paths.length) {
      return [];
    }
    const allowedPaths = /* @__PURE__ */ new Set();
    for (let index = 0; index < paths.length; index++) {
      const check = result.checks[index];
      if (!check || typeof check.path !== "string" || check.path !== paths[index] || typeof check.excluded !== "boolean") {
        return [];
      }
      if (check.excluded === false) {
        allowedPaths.add(check.path);
      }
    }
    return descriptors.filter((descriptor) => [descriptor.oldPath, descriptor.newPath].filter((path) => path !== void 0).every((path) => allowedPaths.has(joinPath(repositoryRoot, path).fsPath)));
  }
  async _reportIfTreeUnchanged(telemetryContext, isContextCurrent, telemetryMessageId, clientType, location, repoInfo, workingDirectory, capturedTree, stableResult, workspaceFileCount, changedFileCount, diffSizeBytes, fileRelativePaths, diffsJSON) {
    const currentTree = await this._gitService.captureWorkingTreeAsTree(workingDirectory);
    if (!currentTree || currentTree !== capturedTree) {
      return this._report(telemetryContext, isContextCurrent, telemetryMessageId, clientType, location, repoInfo, "filesChanged", workspaceFileCount, changedFileCount, 0);
    }
    return this._report(telemetryContext, isContextCurrent, telemetryMessageId, clientType, location, repoInfo, stableResult, workspaceFileCount, changedFileCount, diffSizeBytes, fileRelativePaths, diffsJSON);
  }
  _describeFileDiff(repositoryRoot, diff, untrackedPaths) {
    const beforeUri = diff.before?.uri;
    const afterUri = diff.after?.uri;
    const oldPath = beforeUri ? relativePath(repositoryRoot, URI.parse(beforeUri)) : void 0;
    const newPath = afterUri ? relativePath(repositoryRoot, URI.parse(afterUri)) : void 0;
    if (!oldPath && !newPath || !beforeUri && !afterUri) {
      return void 0;
    }
    const uri = afterUri ?? beforeUri;
    let status;
    if (!beforeUri) {
      status = newPath && untrackedPaths.has(newPath) ? "UNTRACKED" : "INDEX_ADDED";
    } else if (!afterUri) {
      status = "DELETED";
    } else if (beforeUri !== afterUri) {
      status = "INDEX_RENAMED";
    } else {
      status = "MODIFIED";
    }
    return {
      uri,
      originalUri: beforeUri ?? uri,
      renameUri: status === "INDEX_RENAMED" ? afterUri : void 0,
      status,
      oldPath,
      newPath
    };
  }
  _report(telemetryContext, isContextCurrent, telemetryMessageId, clientType, location, repoInfo, result, workspaceFileCount, changedFileCount, diffSizeBytes, fileRelativePaths, diffsJSON) {
    if (this._isDisposed || !isContextCurrent()) {
      return result;
    }
    void this._reporter.reportRepoInfo(telemetryContext, {
      telemetryMessageId,
      clientType,
      location,
      remoteUrl: repoInfo.remoteUrl,
      repoId: repoInfo.repoId,
      repoType: repoInfo.repoType,
      headCommitHash: repoInfo.headCommitHash,
      headBranchName: repoInfo.headBranchName,
      fileRelativePaths,
      diffsJSON,
      result,
      isActiveRepository: "true",
      workspaceFileCount,
      changedFileCount,
      diffSizeBytes
    }).catch((err) => this._logService.trace(`[AgentHostRepoInfoTelemetry] Failed to report repo info: ${err instanceof Error ? err.message : String(err)}`));
    return result;
  }
};
AgentHostRepoInfoTelemetry = __decorateClass([
  __decorateParam(1, IAgentHostGitService),
  __decorateParam(2, IAgentHostGitHubEndpointService),
  __decorateParam(3, ILogService)
], AgentHostRepoInfoTelemetry);
function truncateRepoInfoDiff(diff, uri) {
  if (diff.length <= MAX_DIFF_SIZE) {
    return diff;
  }
  return `${diff.substring(0, MAX_DIFF_SIZE)}
... Diff truncated (exceeded ${MAX_DIFF_SIZE} characters) for ${uri}`;
}
export {
  AgentHostRepoInfoTelemetry,
  measureRepoInfoDiffsJSON,
  resolveRepoInfoRemote
};
