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
import { CancellationError } from "../../../base/common/errors.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { ILogService } from "../../log/common/log.js";
let LocalGitService = class {
  constructor(_logService, _execFile = cp.execFile) {
    this._logService = _logService;
    this._execFile = _execFile;
    this._runningProcesses = /* @__PURE__ */ new Map();
  }
  _exec(operationId, args, cwd) {
    return new Promise((resolve, reject) => {
      this._logService.trace(`[LocalGitService] git ${args.join(" ")}${cwd ? ` (cwd: ${cwd})` : ""}`);
      const proc = this._execFile("git", args, { cwd, encoding: "utf8" }, (err, stdout, stderr) => {
        if (!this._runningProcesses.delete(operationId)) {
          reject(new CancellationError());
          return;
        }
        if (err) {
          this._logService.error(`[LocalGitService] git ${args[0]} failed:`, err.message, stderr);
          reject(err);
          return;
        }
        resolve(stdout);
      });
      this._runningProcesses.set(operationId, proc);
    });
  }
  async clone(operationId, cloneUrl, targetPath, ref) {
    const args = ["clone"];
    if (ref) {
      args.push("--branch", ref);
    }
    args.push("--", cloneUrl, targetPath);
    await this._exec(operationId, args);
  }
  async pull(operationId, repoPath, options) {
    const before = (await this._exec(operationId, ["rev-parse", "HEAD"], repoPath)).trim();
    try {
      await this._exec(operationId, ["pull", "--ff-only"], repoPath);
    } catch (err) {
      if (!this._isFastForwardPullFailure(err)) {
        throw err;
      }
      const error = err;
      this._logService.warn(`[LocalGitService] Fast-forward pull failed for ${repoPath}: ${error?.message ?? String(err)}. Retrying after fetch.`);
      await this._exec(operationId, ["fetch", "--prune"], repoPath);
      try {
        await this._exec(operationId, ["pull", "--ff-only"], repoPath);
      } catch (retryErr) {
        if (!this._isFastForwardPullFailure(retryErr)) {
          throw retryErr;
        }
        if (!options?.allowHardResetOnDivergence) {
          throw retryErr;
        }
        const upstream = await this._getSafeHardResetTarget(operationId, repoPath);
        if (!upstream) {
          throw retryErr;
        }
        this._logService.warn(`[LocalGitService] Pull retries exhausted for ${repoPath}. Performing hard reset to ${upstream}.`);
        await this._exec(operationId, ["reset", "--hard", upstream], repoPath);
      }
    }
    const after = (await this._exec(operationId, ["rev-parse", "HEAD"], repoPath)).trim();
    return before !== after;
  }
  _isFastForwardPullFailure(err) {
    const error = err;
    if (error?.code !== 128) {
      return false;
    }
    const details = `${error.stderr ?? ""}
${error.message ?? ""}`;
    return /not possible to fast-forward|non-fast-forward/i.test(details);
  }
  async _getSafeHardResetTarget(operationId, repoPath) {
    const status = (await this._exec(operationId, ["status", "--porcelain"], repoPath)).trim();
    if (status.length > 0) {
      return void 0;
    }
    let upstream;
    try {
      upstream = (await this._exec(operationId, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], repoPath)).trim();
    } catch {
      return void 0;
    }
    const behind = await this._revListCount(operationId, repoPath, "HEAD", "@{u}");
    const ahead = await this._revListCount(operationId, repoPath, "@{u}", "HEAD");
    if (ahead === void 0 || behind === void 0 || ahead <= 0 || behind <= 0) {
      return void 0;
    }
    return upstream;
  }
  async _revListCount(operationId, repoPath, fromRef, toRef) {
    const result = await this._exec(operationId, ["rev-list", "--count", `${fromRef}..${toRef}`], repoPath);
    const parsed = Number(result.trim());
    if (!Number.isFinite(parsed)) {
      this._logService.warn(`[LocalGitService] Failed to parse rev-list count for ${fromRef}..${toRef} in ${repoPath}: ${result}`);
      return void 0;
    }
    return parsed;
  }
  async checkout(operationId, repoPath, treeish, detached) {
    const args = detached ? ["checkout", "--detach", treeish] : ["checkout", treeish];
    await this._exec(operationId, args, repoPath);
  }
  async revParse(repoPath, ref) {
    return (await this._exec(generateUuid(), ["rev-parse", ref], repoPath)).trim();
  }
  async fetch(operationId, repoPath) {
    await this._exec(operationId, ["fetch"], repoPath);
  }
  async revListCount(repoPath, fromRef, toRef) {
    const result = await this._exec(generateUuid(), ["rev-list", "--count", `${fromRef}..${toRef}`], repoPath);
    return Number(result.trim()) || 0;
  }
  async cancel(operationId) {
    const proc = this._runningProcesses.get(operationId);
    if (proc) {
      this._runningProcesses.delete(operationId);
      proc.kill();
    }
  }
};
LocalGitService = __decorateClass([
  __decorateParam(0, ILogService)
], LocalGitService);
export {
  LocalGitService
};
