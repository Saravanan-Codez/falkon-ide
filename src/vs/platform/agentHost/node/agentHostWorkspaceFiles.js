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
import { Limiter } from "../../../base/common/async.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
import { CancellationError } from "../../../base/common/errors.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { Schemas } from "../../../base/common/network.js";
import { URI } from "../../../base/common/uri.js";
import { ILogService } from "../../log/common/log.js";
import { rgDiskPath } from "../../../base/node/ripgrep.js";
const MAX_FILES = 5e4;
const CACHE_TTL_MS = 3e4;
const MAX_CONCURRENT_ENUMERATIONS = 4;
const enumerationLimiter = new Limiter(MAX_CONCURRENT_ENUMERATIONS);
let AgentHostWorkspaceFiles = class extends Disposable {
  constructor(_logService) {
    super();
    this._logService = _logService;
    this._cache = /* @__PURE__ */ new Map();
    /** Active ripgrep child processes, killed on dispose. */
    this._activeChildren = /* @__PURE__ */ new Set();
    this._isDisposed = false;
  }
  dispose() {
    this._isDisposed = true;
    for (const child of this._activeChildren) {
      try {
        child.kill();
      } catch {
      }
    }
    this._activeChildren.clear();
    this._cache.clear();
    super.dispose();
  }
  /**
   * Return the list of files under `workingDirectory`. Concurrent calls
   * with the same working directory share an in-flight enumeration.
   *
   * Only `file://` URIs are supported. Other schemes return an empty list.
   */
  async getFiles(workingDirectory, token) {
    if (workingDirectory.scheme !== Schemas.file) {
      return { files: [], isTruncated: false };
    }
    const key = workingDirectory.toString();
    const now = Date.now();
    const existing = this._cache.get(key);
    let shared;
    if (existing && (existing.expiresAt === void 0 || existing.expiresAt > now)) {
      shared = existing.promise;
    } else {
      shared = enumerationLimiter.queue(() => this._isDisposed ? Promise.resolve({ files: [], isTruncated: false }) : this._enumerate(workingDirectory));
      const entry = { promise: shared };
      this._cache.set(key, entry);
      shared.then(() => {
        if (this._cache.get(key) === entry) {
          entry.expiresAt = Date.now() + CACHE_TTL_MS;
        }
      }, () => {
        if (this._cache.get(key) === entry) {
          this._cache.delete(key);
        }
      });
    }
    if (token.isCancellationRequested) {
      throw new CancellationError();
    }
    if (token === CancellationToken.None) {
      return shared;
    }
    return new Promise((resolve, reject) => {
      const cancelListener = token.onCancellationRequested(() => {
        cancelListener.dispose();
        reject(new CancellationError());
      });
      shared.then((value) => {
        cancelListener.dispose();
        resolve(value);
      }, (err) => {
        cancelListener.dispose();
        reject(err);
      });
    });
  }
  async _enumerate(workingDirectory) {
    const resolvedRgDiskPath = await rgDiskPath();
    return new Promise((resolve, reject) => {
      const cwd = workingDirectory.fsPath;
      const args = ["--files", "--hidden", "--no-require-git", "--follow", "--no-config", "--glob", "!.git"];
      let child;
      try {
        child = cp.spawn(resolvedRgDiskPath, args, { cwd });
      } catch (err) {
        this._logService.warn(`[AgentHostWorkspaceFiles] Failed to spawn ripgrep: ${err}`);
        reject(err);
        return;
      }
      this._activeChildren.add(child);
      const results = [];
      let buffer = "";
      let limitHit = false;
      let settled = false;
      const finish = (files, error) => {
        if (settled) {
          return;
        }
        settled = true;
        this._activeChildren.delete(child);
        if (error) {
          reject(error);
        } else {
          resolve({ files, isTruncated: limitHit });
        }
      };
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        if (limitHit) {
          return;
        }
        buffer += chunk;
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
          buffer = buffer.slice(newlineIndex + 1);
          if (!line) {
            continue;
          }
          results.push(URI.joinPath(workingDirectory, line));
          if (results.length >= MAX_FILES) {
            limitHit = true;
            this._logService.trace(`[AgentHostWorkspaceFiles] File limit reached while enumerating ${workingDirectory.toString()}`);
            try {
              child.kill();
            } catch {
            }
            break;
          }
        }
      });
      child.stderr.setEncoding("utf8");
      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.on("error", (err) => {
        if (this._isDisposed) {
          finish([]);
          return;
        }
        this._logService.warn(`[AgentHostWorkspaceFiles] ripgrep error: ${err}`);
        finish([], err);
      });
      child.on("close", (code) => {
        if (this._isDisposed) {
          finish([]);
          return;
        }
        if (!limitHit && buffer.length > 0) {
          const line = buffer.replace(/\r$/, "");
          if (line) {
            results.push(URI.joinPath(workingDirectory, line));
          }
          buffer = "";
        }
        if (stderr) {
          this._logService.trace(`[AgentHostWorkspaceFiles] ripgrep stderr: ${stderr}`);
        }
        if (!limitHit && code !== 0 && code !== 1) {
          const error = new Error(`ripgrep exited with code ${code ?? "unknown"} while enumerating ${workingDirectory.toString()}`);
          this._logService.warn(`[AgentHostWorkspaceFiles] ${error.message}`);
          finish([], error);
          return;
        }
        finish(results);
      });
    });
  }
};
AgentHostWorkspaceFiles = __decorateClass([
  __decorateParam(0, ILogService)
], AgentHostWorkspaceFiles);
export {
  AgentHostWorkspaceFiles
};
