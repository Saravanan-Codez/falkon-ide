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
import * as fs from "fs";
import * as tar from "tar";
import { VSBuffer } from "../../../base/common/buffer.js";
import { CancellationError } from "../../../base/common/errors.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import * as path from "../../../base/common/path.js";
import { format2 } from "../../../base/common/strings.js";
import { URI } from "../../../base/common/uri.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { detectLibcSync } from "../../../base/node/libc.js";
import { INativeEnvironmentService } from "../../environment/common/environment.js";
import { FileOperationError, FileOperationResult, IFileService, toFileOperationResult } from "../../files/common/files.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { ILogService } from "../../log/common/log.js";
import { IProductService } from "../../product/common/productService.js";
import { IRequestService } from "../../request/common/request.js";
const SUPPORTED_PLATFORMS = /* @__PURE__ */ new Set(["linux", "darwin", "win32"]);
const SUPPORTED_ARCHES = /* @__PURE__ */ new Set(["x64", "arm64"]);
function resolveSdkTarget(pkg, host = { platform: process.platform, arch: process.arch, libc: detectLibcSync() }) {
  if (!SUPPORTED_PLATFORMS.has(host.platform) || !SUPPORTED_ARCHES.has(host.arch)) {
    return void 0;
  }
  if (host.platform === "linux" && pkg.hasSeparateMuslLinuxPackage && host.libc === "musl") {
    return `linux-${host.arch}-musl`;
  }
  return `${host.platform}-${host.arch}`;
}
const IAgentSdkDownloader = createDecorator("agentSdkDownloader");
const LOAD_FAILURE_NEGATIVE_CACHE_MS = 3e4;
const PROGRESS_EMIT_THROTTLE_MS = 250;
function parseContentLength(header) {
  if (typeof header !== "string" || !/^\d+$/.test(header)) {
    return void 0;
  }
  const parsed = parseInt(header, 10);
  return parsed > 0 ? parsed : void 0;
}
let AgentSdkDownloader = class extends Disposable {
  constructor(_environmentService, _productService, _requestService, _fileService, _logService) {
    super();
    this._environmentService = _environmentService;
    this._productService = _productService;
    this._requestService = _requestService;
    this._fileService = _fileService;
    this._logService = _logService;
    this._onDidDownloadProgress = this._register(new Emitter());
    this.onDidDownloadProgress = this._onDidDownloadProgress.event;
    /**
     * In-flight downloads keyed by the destination `cacheDir` (which
     * already encodes `<pkg>/<sdkVersion>/<sdkTarget>`). Concurrent
     * `loadSdkRoot` calls in the same process share the same promise so
     * we never download the same tarball twice. Universal launches that
     * resolve to different targets get distinct entries because their
     * cacheDirs differ.
     */
    this._pendingDownloads = /* @__PURE__ */ new Map();
    /**
     * Negative cache: most recent failure per package id, with an expiry.
     * While within the window, `loadSdkRoot` re-throws the cached error
     * immediately instead of re-attempting the download. Without this, a
     * broken CDN causes every SDK method call (poll-driven UIs hit this
     * hard) to fire a fresh request.
     *
     * Keyed by `pkg.id` (not the finer cacheDir): CDN failures are
     * effectively global per SDK (DNS, proxy auth, 5xx) and per-target
     * latching wouldn't protect against the actual failure modes — the
     * broader latch is intentional.
     */
    this._failureLatch = /* @__PURE__ */ new Map();
  }
  isAvailable(pkg) {
    if (process.env[pkg.devOverrideEnvVar]) {
      return true;
    }
    return !!this._productService.agentSdks?.[pkg.id] && resolveSdkTarget(pkg) !== void 0;
  }
  async isSdkResolvableWithoutDownload(pkg) {
    if (process.env[pkg.devOverrideEnvVar]) {
      return true;
    }
    const config = this._productService.agentSdks?.[pkg.id];
    if (!config) {
      return false;
    }
    const sdkTarget = resolveSdkTarget(pkg);
    if (!sdkTarget) {
      return false;
    }
    const sentinel = URI.joinPath(URI.file(this._cacheDir(pkg.id, config.version, sdkTarget)), ".complete");
    return this._fileService.exists(sentinel);
  }
  async loadSdkRoot(pkg, token) {
    const override = process.env[pkg.devOverrideEnvVar];
    if (override) {
      this._logService.info(`[AgentSdkDownloader] ${pkg.id}: using dev override at ${override}`);
      return override;
    }
    const latched = this._failureLatch.get(pkg.id);
    if (latched && latched.expiresAt > Date.now()) {
      throw latched.error;
    }
    try {
      const root = await this._resolveOrDownload(pkg, token);
      this._failureLatch.delete(pkg.id);
      return root;
    } catch (err) {
      if (token.isCancellationRequested) {
        throw err;
      }
      const error = err instanceof Error ? err : new Error(String(err));
      this._failureLatch.set(pkg.id, {
        error,
        expiresAt: Date.now() + LOAD_FAILURE_NEGATIVE_CACHE_MS
      });
      throw error;
    }
  }
  async _resolveOrDownload(pkg, token) {
    const config = this._productService.agentSdks?.[pkg.id];
    if (!config) {
      throw new Error(
        `Cannot load ${pkg.id} SDK: no \`product.agentSdks.${pkg.id}\` configured and no ${pkg.devOverrideEnvVar} dev override set.`
      );
    }
    const sdkTarget = resolveSdkTarget(pkg);
    if (!sdkTarget) {
      throw new Error(
        `Cannot load ${pkg.id} SDK: no SDK target for this host (${process.platform}/${process.arch}). Set ${pkg.devOverrideEnvVar} to a local SDK root to bypass.`
      );
    }
    const url = format2(config.urlTemplate, { sdkTarget });
    const stray = /{[^}]+}/.exec(url);
    if (stray) {
      throw new Error(
        `Cannot load ${pkg.id} SDK: \`product.agentSdks.${pkg.id}.urlTemplate\` contains an unknown placeholder ${stray[0]} \u2014 only {sdkTarget} is substituted. Template: ${config.urlTemplate}`
      );
    }
    const cacheDir = this._cacheDir(pkg.id, config.version, sdkTarget);
    const sentinel = URI.joinPath(URI.file(cacheDir), ".complete");
    if (await this._fileService.exists(sentinel)) {
      return cacheDir;
    }
    let pending = this._pendingDownloads.get(cacheDir);
    if (!pending) {
      pending = this._download(pkg, url, cacheDir, sentinel, token).finally(() => {
        this._pendingDownloads.delete(cacheDir);
      });
      this._pendingDownloads.set(cacheDir, pending);
    }
    return pending;
  }
  _cacheDir(packageId, sdkVersion, sdkTarget) {
    return path.join(
      this._environmentService.userDataPath,
      "agent-host",
      "sdk-cache",
      packageId,
      sdkVersion,
      sdkTarget
    );
  }
  async _download(pkg, url, cacheDir, sentinel, token) {
    this._logService.info(`[AgentSdkDownloader] ${pkg.id}: downloading from ${url}`);
    const start = Date.now();
    const parent = path.dirname(cacheDir);
    await this._fileService.createFolder(URI.file(parent));
    const tmpDir = `${cacheDir}.tmp.${process.pid}`;
    const tmpDirUri = URI.file(tmpDir);
    await this._delIgnoringMissing(tmpDirUri);
    await this._fileService.createFolder(tmpDirUri);
    const downloadId = generateUuid();
    let lastReceived = 0;
    let lastTotal;
    this._fireProgress(pkg, downloadId, "started", 0, void 0);
    try {
      const tarballPath = path.join(tmpDir, "sdk.tgz");
      await this._fetch(url, tarballPath, token, (receivedBytes, totalBytes) => {
        lastReceived = receivedBytes;
        lastTotal = totalBytes;
        this._fireProgress(pkg, downloadId, "progress", receivedBytes, totalBytes);
      });
      await this._extractTarGz(tarballPath, tmpDir);
      await this._fileService.del(URI.file(tarballPath));
      await this._fileService.writeFile(
        URI.joinPath(tmpDirUri, ".complete"),
        VSBuffer.fromString("")
      );
      try {
        await this._fileService.move(tmpDirUri, URI.file(cacheDir));
      } catch (err) {
        if (await this._handleRenameLoser(err, sentinel, tmpDirUri)) {
          this._logService.info(`[AgentSdkDownloader] ${pkg.id}: lost rename race, using existing cache`);
          this._fireProgress(pkg, downloadId, "completed", lastReceived, lastTotal);
          return cacheDir;
        }
        throw err;
      }
      const elapsed = Math.round((Date.now() - start) / 1e3);
      this._logService.info(`[AgentSdkDownloader] ${pkg.id}: downloaded in ${elapsed}s`);
      this._fireProgress(pkg, downloadId, "completed", lastTotal ?? lastReceived, lastTotal);
      return cacheDir;
    } catch (err) {
      await this._delIgnoringMissing(tmpDirUri);
      if (token.isCancellationRequested) {
        this._fireProgress(pkg, downloadId, "failed", lastReceived, lastTotal, "cancelled");
        throw new CancellationError();
      }
      const message = err instanceof Error ? err.message : String(err);
      this._fireProgress(pkg, downloadId, "failed", lastReceived, lastTotal, message);
      throw new Error(
        `Failed to download ${pkg.id} SDK from ${url} (cache target: ${cacheDir}). Set ${pkg.devOverrideEnvVar} to a local SDK root to bypass. Cause: ${message}`
      );
    }
  }
  _fireProgress(pkg, downloadId, phase, receivedBytes, totalBytes, error) {
    this._onDidDownloadProgress.fire({
      downloadId,
      packageId: pkg.id,
      displayName: pkg.displayName,
      phase,
      receivedBytes,
      totalBytes,
      ...error !== void 0 ? { error } : {}
    });
  }
  async _handleRenameLoser(err, sentinel, tmpDirUri) {
    if (!(err instanceof FileOperationError) || err.fileOperationResult !== FileOperationResult.FILE_MOVE_CONFLICT) {
      return false;
    }
    if (!await this._fileService.exists(sentinel)) {
      return false;
    }
    await this._delIgnoringMissing(tmpDirUri);
    return true;
  }
  async _fetch(url, dest, token, onBytes) {
    if (token.isCancellationRequested) {
      throw new CancellationError();
    }
    const context = await this._requestService.request({
      url,
      type: "GET",
      callSite: "agentSdkDownloader"
    }, token);
    if (token.isCancellationRequested) {
      context.stream.destroy();
      throw new CancellationError();
    }
    const statusCode = context.res.statusCode ?? 0;
    if (statusCode < 200 || statusCode >= 300) {
      context.stream.destroy();
      throw new Error(`HTTP ${statusCode} fetching ${url}`);
    }
    const totalBytes = parseContentLength(context.res.headers["content-length"]);
    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(dest);
      let settled = false;
      let receivedBytes = 0;
      let lastEmitTime = 0;
      const emitBytes = (force) => {
        if (!onBytes) {
          return;
        }
        const now = Date.now();
        if (!force && now - lastEmitTime < PROGRESS_EMIT_THROTTLE_MS) {
          return;
        }
        lastEmitTime = now;
        onBytes(receivedBytes, totalBytes);
      };
      const settleResolve = () => {
        if (settled) {
          return;
        }
        settled = true;
        cancelSub.dispose();
        resolve();
      };
      const settleReject = (err) => {
        if (settled) {
          return;
        }
        settled = true;
        cancelSub.dispose();
        context.stream.destroy();
        out.destroy();
        reject(err);
      };
      const cancelSub = token.onCancellationRequested(() => settleReject(new CancellationError()));
      out.on("error", settleReject);
      out.on("finish", settleResolve);
      out.on("drain", () => context.stream.resume());
      context.stream.on("data", (chunk) => {
        receivedBytes += chunk.byteLength;
        emitBytes(false);
        if (!out.write(chunk.buffer)) {
          context.stream.pause();
        }
      });
      context.stream.on("end", () => {
        emitBytes(true);
        out.end();
      });
      context.stream.on("error", settleReject);
    });
  }
  async _extractTarGz(tarball, dest) {
    await tar.x({ file: tarball, cwd: dest });
  }
  async _delIgnoringMissing(uri) {
    try {
      await this._fileService.del(uri, { recursive: true });
    } catch (err) {
      if (toFileOperationResult(err) !== FileOperationResult.FILE_NOT_FOUND) {
        throw err;
      }
    }
  }
};
AgentSdkDownloader = __decorateClass([
  __decorateParam(0, INativeEnvironmentService),
  __decorateParam(1, IProductService),
  __decorateParam(2, IRequestService),
  __decorateParam(3, IFileService),
  __decorateParam(4, ILogService)
], AgentSdkDownloader);
export {
  AgentSdkDownloader,
  IAgentSdkDownloader,
  resolveSdkTarget
};
