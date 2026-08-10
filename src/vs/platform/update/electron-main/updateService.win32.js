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
import { spawn } from "child_process";
import { app } from "electron";
import { unlinkSync } from "fs";
import { mkdir, readFile, unlink } from "fs/promises";
import { release, tmpdir } from "os";
import { Delayer, ProcessTimeRunOnceScheduler, timeout } from "../../../base/common/async.js";
import { VSBuffer } from "../../../base/common/buffer.js";
import { CancellationTokenSource } from "../../../base/common/cancellation.js";
import { memoize } from "../../../base/common/decorators.js";
import { isCancellationError } from "../../../base/common/errors.js";
import { hash } from "../../../base/common/hash.js";
import * as path from "../../../base/common/path.js";
import { basename } from "../../../base/common/path.js";
import { transform } from "../../../base/common/stream.js";
import { URI } from "../../../base/common/uri.js";
import { checksum } from "../../../base/node/crypto.js";
import * as pfs from "../../../base/node/pfs.js";
import { killTree } from "../../../base/node/processes.js";
import { getWindowsRelease } from "../../../base/node/windowsVersion.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { IEnvironmentMainService } from "../../environment/electron-main/environmentMainService.js";
import { IFileService } from "../../files/common/files.js";
import { ILifecycleMainService } from "../../lifecycle/electron-main/lifecycleMainService.js";
import { ILogService } from "../../log/common/log.js";
import { IMeteredConnectionService } from "../../meteredConnection/common/meteredConnection.js";
import { INativeHostMainService } from "../../native/electron-main/nativeHostMainService.js";
import { IProductService } from "../../product/common/productService.js";
import { asJson, IRequestService } from "../../request/common/request.js";
import { IApplicationStorageMainService } from "../../storage/electron-main/storageMainService.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { DisablementReason, State, StateType, UpdateType } from "../common/update.js";
import { AbstractUpdateService, createUpdateURL, getUpdateRequestHeaders } from "./abstractUpdateService.js";
import { getWin32UpdateType } from "./win32UpdateType.js";
let _updateType = void 0;
function getUpdateType() {
  if (typeof _updateType === "undefined") {
    _updateType = getWin32UpdateType();
  }
  return _updateType;
}
let Win32UpdateService = class extends AbstractUpdateService {
  constructor(lifecycleMainService, configurationService, telemetryService, environmentMainService, requestService, logService, fileService, nativeHostMainService, productService, applicationStorageMainService, meteredConnectionService) {
    super(lifecycleMainService, configurationService, environmentMainService, requestService, logService, productService, telemetryService, applicationStorageMainService, meteredConnectionService, true);
    this.fileService = fileService;
    this.nativeHostMainService = nativeHostMainService;
    this.readyMutexName = `${productService.win32MutexName}-ready`;
    this.updatingMutexName = `${productService.win32MutexName}-updating`;
    this.setupMutexName = `${productService.win32MutexName}setup`;
    lifecycleMainService.setRelaunchHandler(this);
  }
  get cachePath() {
    const result = path.join(tmpdir(), `vscode-${this.productService.quality}-${this.productService.target}-${process.arch}`);
    return mkdir(result, { recursive: true }).then(() => result);
  }
  get mutex() {
    return import("@vscode/windows-mutex");
  }
  handleRelaunch(options) {
    if (options?.addArgs || options?.removeArgs) {
      return false;
    }
    if (this.state.type !== StateType.Ready || !this.availableUpdate) {
      return false;
    }
    this.logService.trace("update#handleRelaunch(): running raw#quitAndInstall()");
    this.doQuitAndInstall();
    return true;
  }
  async initialize() {
    if (this.productService.win32VersionedUpdate) {
      const cachePath = await this.cachePath;
      app.setPath("appUpdate", cachePath);
      await this.unlink(path.join(cachePath, "session-ending.flag"));
    }
    const osRelease = await getWindowsRelease();
    const osNodeRelease = release();
    this.telemetryService.publicLog2("windowsUpdateInit", { osRelease, osNodeRelease });
    if (this.productService.target === "user" && await this.nativeHostMainService.isAdmin(void 0)) {
      this.setState(State.Disabled(DisablementReason.RunningAsAdmin));
      this.logService.info("update#ctor - updates are disabled due to running as Admin in user setup");
      return;
    }
    await super.initialize();
  }
  async postInitialize() {
    if (!this.productService.win32VersionedUpdate) {
      return;
    }
    const exePath = app.getPath("exe");
    const exeDir = path.dirname(exePath);
    const updatingVersionPath = path.join(exeDir, "updating_version");
    if (await pfs.Promises.exists(updatingVersionPath)) {
      try {
        const updatingVersion = (await readFile(updatingVersionPath, "utf8")).trim();
        this.logService.info(`update#doCheckForUpdates - application was updating to version ${updatingVersion}`);
        const updatePackagePath = await this.getUpdatePackagePath(updatingVersion);
        if (await pfs.Promises.exists(updatePackagePath)) {
          await this._applySpecificUpdate(updatePackagePath, updatingVersion);
          this.logService.info(`update#doCheckForUpdates - successfully applied update to version ${updatingVersion}`);
        }
      } catch (e) {
        this.logService.error(`update#doCheckForUpdates - could not read ${updatingVersionPath}`, e);
      } finally {
      }
    } else {
      await this.collectGarbage();
    }
  }
  async collectGarbage() {
    if (!this.productService.win32VersionedUpdate) {
      return;
    }
    const fastUpdatesEnabled = this.configurationService.getValue("update.enableWindowsBackgroundUpdates");
    if (!fastUpdatesEnabled || this.productService.target !== "user" || !this.productService.commit) {
      return;
    }
    const exePath = app.getPath("exe");
    const exeDir = path.dirname(exePath);
    const versionedResourcesFolder = this.productService.commit.substring(0, 10);
    const innoUpdater = path.join(exeDir, versionedResourcesFolder, "tools", "inno_updater.exe");
    const exeName = basename(exePath);
    await new Promise((resolve) => {
      const child = spawn(innoUpdater, ["--gc", exePath, versionedResourcesFolder, exeName], {
        stdio: ["ignore", "ignore", "ignore"],
        windowsHide: true,
        timeout: 2 * 60 * 1e3
      });
      child.once("error", (err) => {
        this.logService.error("update#collectGarbage - failed to spawn inno_updater", err);
        resolve();
      });
      child.once("exit", () => resolve());
    });
  }
  buildUpdateFeedUrl(quality, commit, options) {
    let platform = `win32-${process.arch}`;
    if (getUpdateType() === UpdateType.Archive) {
      platform += "-archive";
    } else if (this.productService.target === "user") {
      platform += "-user";
    }
    return createUpdateURL(this.productService.updateUrl, platform, quality, commit, options);
  }
  doCheckForUpdates(explicit, pendingCommit) {
    if (!this.quality) {
      return;
    }
    const internalOrg = this.getInternalOrg();
    const background = !explicit && !internalOrg;
    const url = this.buildUpdateFeedUrl(this.quality, pendingCommit ?? this.productService.commit, { background, internalOrg });
    if (this.state.type !== StateType.Overwriting) {
      this.setState(State.CheckingForUpdates(explicit));
    }
    this.checkCancellationTokenSource?.dispose(true);
    const cts = this.checkCancellationTokenSource = new CancellationTokenSource();
    const token = cts.token;
    const headers = getUpdateRequestHeaders(this.productService.version);
    const promise = this.requestService.request({ url, headers, callSite: "updateService.win32.checkForUpdates" }, token).then(asJson).then((update) => {
      const updateType = getUpdateType();
      if (token.isCancellationRequested) {
        return Promise.resolve(null);
      }
      if (!update || !update.url || !update.version || !update.productVersion) {
        if (this.state.type === StateType.Overwriting) {
          this._overwrite = false;
          this.setState(State.Ready(this.state.update, this.state.explicit, false));
        } else {
          this.setState(State.Idle(updateType, void 0, explicit || void 0));
        }
        return Promise.resolve(null);
      }
      if (updateType === UpdateType.Archive) {
        this.setState(State.AvailableForDownload(update));
        return Promise.resolve(null);
      }
      if (!explicit && this.meteredConnectionService.isConnectionMetered) {
        this.logService.info("update#doCheckForUpdates - update available but skipping download because connection is metered");
        this.setState(State.AvailableForDownload(update));
        return Promise.resolve(null);
      }
      const startTime = Date.now();
      this.setState(State.Downloading(update, explicit, this._overwrite, 0, void 0, startTime));
      return this.cleanup(update.version).then(() => {
        return this.getUpdatePackagePath(update.version).then((updatePackagePath) => {
          return pfs.Promises.exists(updatePackagePath).then((exists) => {
            if (exists) {
              return Promise.resolve(updatePackagePath);
            }
            const downloadPath = `${updatePackagePath}.tmp`;
            return this.requestService.request({ url: update.url, callSite: "updateService.win32.downloadUpdate" }, token).then((context) => {
              const contentLengthHeader = context.res.headers["content-length"];
              const contentLength = typeof contentLengthHeader === "string" ? contentLengthHeader : void 0;
              const totalBytes = contentLength ? parseInt(contentLength, 10) : void 0;
              let downloadedBytes = 0;
              const progressDelayer = new Delayer(500);
              const progressStream = transform(
                context.stream,
                {
                  data: (data) => {
                    downloadedBytes += data.byteLength;
                    progressDelayer.trigger(() => {
                      this.setState(State.Downloading(update, explicit, this._overwrite, downloadedBytes, totalBytes, startTime));
                    });
                    return data;
                  }
                },
                (chunks) => VSBuffer.concat(chunks)
              );
              return this.fileService.writeFile(URI.file(downloadPath), progressStream).finally(() => progressDelayer.dispose());
            }).then(update.sha256hash ? () => checksum(downloadPath, update.sha256hash) : () => void 0).then(() => pfs.Promises.rename(
              downloadPath,
              updatePackagePath,
              false
              /* no retry */
            )).then(() => updatePackagePath);
          });
        }).then((packagePath) => {
          if (token.isCancellationRequested) {
            return;
          }
          this.availableUpdate = { packagePath };
          this.saveUpdateMetadata(update);
          this.setState(State.Downloaded(update, explicit, this._overwrite));
          const fastUpdatesEnabled = this.configurationService.getValue("update.enableWindowsBackgroundUpdates");
          if (fastUpdatesEnabled && this.productService.target === "user") {
            this.doApplyUpdate();
          } else {
            this.setState(State.Ready(update, explicit, this._overwrite));
          }
        });
      });
    }).then(void 0, (err) => {
      if (token.isCancellationRequested || isCancellationError(err)) {
        return;
      }
      this.telemetryService.publicLog2("update:error", { messageHash: String(hash(String(err))) });
      this.logService.error(err);
      const message = explicit ? err.message || err : void 0;
      if (this.state.type === StateType.Overwriting) {
        this._overwrite = false;
        this.setState(State.Ready(this.state.update, this.state.explicit, false));
      } else {
        this.setState(State.Idle(getUpdateType(), message));
      }
    });
    this.checkPromise = promise;
    promise.finally(() => {
      if (this.checkCancellationTokenSource === cts) {
        this.checkCancellationTokenSource = void 0;
      }
      if (this.checkPromise === promise) {
        this.checkPromise = void 0;
      }
      cts.dispose();
    });
  }
  async doDownloadUpdate(state) {
    if (state.update.url) {
      this.nativeHostMainService.openExternal(void 0, state.update.url);
    }
    this.setState(State.Idle(getUpdateType()));
  }
  async getUpdatePackagePath(version) {
    const cachePath = await this.cachePath;
    return path.join(cachePath, `CodeSetup-${this.productService.quality}-${version}.exe`);
  }
  async cleanup(exceptVersion = null) {
    const filter = exceptVersion ? (one) => !new RegExp(`${this.productService.quality}-${exceptVersion}\\.exe$`).test(one) : () => true;
    const cachePath = await this.cachePath;
    const versions = await pfs.Promises.readdir(cachePath);
    const promises = versions.filter(filter).map((one) => this.unlink(path.join(cachePath, one)));
    await Promise.all(promises);
  }
  async doApplyUpdate() {
    if (this.state.type !== StateType.Downloaded) {
      return Promise.resolve(void 0);
    }
    if (!this.availableUpdate) {
      return Promise.resolve(void 0);
    }
    const update = this.state.update;
    const explicit = this.state.explicit;
    this.setState(State.Updating(update, explicit));
    const cachePath = await this.cachePath;
    const sessionEndFlagPath = path.join(cachePath, "session-ending.flag");
    const cancelFilePath = path.join(cachePath, `cancel.flag`);
    const progressFilePath = path.join(cachePath, `update-progress`);
    this.availableUpdate.updateFilePath = path.join(cachePath, `CodeSetup-${this.productService.quality}-${update.version}.flag`);
    this.availableUpdate.cancelFilePath = cancelFilePath;
    const mutex = await this.mutex;
    const skippedSpawn = this.isInstallerActive(mutex);
    if (skippedSpawn) {
      this.logService.info("update#doApplyUpdate: another instance is already running setup, waiting for it to finish");
    } else {
      await this.unlink(cancelFilePath);
      await this.unlink(progressFilePath);
      await pfs.Promises.writeFile(this.availableUpdate.updateFilePath, "flag");
      const child = spawn(
        this.availableUpdate.packagePath,
        [
          "/verysilent",
          "/log",
          `/update="${this.availableUpdate.updateFilePath}"`,
          `/progress="${progressFilePath}"`,
          `/sessionend="${sessionEndFlagPath}"`,
          `/cancel="${cancelFilePath}"`,
          "/nocloseapplications",
          "/mergetasks=runcode,!desktopicon,!quicklaunchicon"
        ],
        {
          detached: true,
          stdio: ["ignore", "ignore", "ignore"],
          windowsVerbatimArguments: true,
          env: { ...process.env, __COMPAT_LAYER: "RunAsInvoker" }
        }
      );
      this.availableUpdate.updateProcess = child;
      child.once("exit", () => {
        this.availableUpdate = void 0;
        this.setState(State.Idle(getUpdateType()));
      });
    }
    this.updateCancellationTokenSource?.dispose(true);
    const cts = this.updateCancellationTokenSource = new CancellationTokenSource();
    const token = cts.token;
    const poll = async () => {
      let seenRunning = skippedSpawn;
      while (this.state.type === StateType.Updating && !token.isCancellationRequested) {
        if (mutex.isActive(this.readyMutexName)) {
          this.setState(State.Ready(update, explicit, this._overwrite));
          return;
        }
        if (this.isInstallerActive(mutex)) {
          seenRunning = true;
        } else if (seenRunning) {
          if (!this.availableUpdate?.updateProcess) {
            this.availableUpdate = void 0;
            this.setState(State.Idle(getUpdateType()));
          }
          return;
        }
        try {
          const progressContent = await readFile(progressFilePath, "utf8");
          if (!token.isCancellationRequested) {
            const [currentStr, maxStr] = progressContent.split(",");
            const currentProgress = parseInt(currentStr, 10);
            const maxProgress = parseInt(maxStr, 10);
            if (!isNaN(currentProgress) && !isNaN(maxProgress) && this.state.type === StateType.Updating) {
              if (this.state.currentProgress !== currentProgress || this.state.maxProgress !== maxProgress) {
                this.setState(State.Updating(update, explicit, currentProgress, maxProgress));
              }
            }
          }
        } catch {
        }
        await timeout(500);
      }
    };
    const cancelTimeout = new ProcessTimeRunOnceScheduler(() => {
      this.logService.warn("update#doApplyUpdate: polling timed out waiting for update to be ready");
      this.setState(State.Idle(getUpdateType(), "Update did not complete within expected time"));
    }, 60 * 60 * 1e3);
    cancelTimeout.schedule();
    poll().finally(() => {
      cancelTimeout.dispose();
      if (this.updateCancellationTokenSource === cts) {
        this.updateCancellationTokenSource = void 0;
      }
      cts.dispose();
    });
  }
  async cancelUpdate() {
    const hadInFlightCheck = !!this.checkCancellationTokenSource;
    const hadPendingUpdate = !!this.availableUpdate;
    this.checkCancellationTokenSource?.dispose(true);
    this.checkCancellationTokenSource = void 0;
    if (hadInFlightCheck) {
      try {
        await this.checkPromise;
      } catch {
      }
      await this.cleanupTempFiles();
    }
    await this.cancelPendingUpdate();
    if (hadInFlightCheck || hadPendingUpdate) {
      this.collectGarbage().catch((err) => this.logService.error("update#collectGarbage - failed to collect garbage", err));
    }
  }
  async cleanupTempFiles() {
    try {
      const cachePath = await this.cachePath;
      const files = await pfs.Promises.readdir(cachePath);
      await Promise.all(files.filter((file) => file.endsWith(".tmp")).map((file) => this.unlink(path.join(cachePath, file))));
    } catch (err) {
      this.logService.warn("update#cleanupTempFiles: failed to remove temporary download files", err);
    }
  }
  async cancelPendingUpdate() {
    if (!this.availableUpdate) {
      return;
    }
    const { updateProcess, updateFilePath, cancelFilePath } = this.availableUpdate;
    if (!updateProcess && this.isInstallerActive(await this.mutex)) {
      throw new Error("Cannot cancel pending update: another instance is still running setup");
    }
    this.updateCancellationTokenSource?.dispose(true);
    this.updateCancellationTokenSource = void 0;
    if (updateProcess && updateProcess.exitCode === null) {
      this.logService.trace("update#cancelPendingUpdate: cancelling pending update");
      updateProcess.removeAllListeners();
      const exitPromise = new Promise((resolve) => updateProcess.once("exit", () => resolve(true)));
      if (cancelFilePath) {
        try {
          await pfs.Promises.writeFile(cancelFilePath, "cancel");
        } catch (err) {
          this.logService.warn("update#cancelPendingUpdate: failed to write cancel file", err);
        }
      }
      const pid = updateProcess.pid;
      const exited = await Promise.race([exitPromise, timeout(30 * 1e3).then(() => false)]);
      if (pid && !exited) {
        this.logService.trace("update#cancelPendingUpdate: process did not exit gracefully, killing process tree");
        await killTree(pid, true);
      }
    }
    await this.unlink(updateFilePath);
    await this.unlink(cancelFilePath);
    this.availableUpdate = void 0;
  }
  doQuitAndInstall() {
    if (this.state.type !== StateType.Ready && this.state.type !== StateType.Restarting || !this.availableUpdate) {
      return;
    }
    this.logService.trace("update#quitAndInstall(): running raw#quitAndInstall()");
    if (this.availableUpdate.updateFilePath) {
      try {
        unlinkSync(this.availableUpdate.updateFilePath);
      } catch {
      }
    } else {
      spawn(this.availableUpdate.packagePath, ["/silent", "/log", "/mergetasks=runcode,!desktopicon,!quicklaunchicon"], {
        detached: true,
        stdio: ["ignore", "ignore", "ignore"],
        env: { ...process.env, __COMPAT_LAYER: "RunAsInvoker" }
      });
    }
  }
  async saveUpdateMetadata(update) {
    try {
      const cachePath = await this.cachePath;
      const metadataPath = path.join(cachePath, "update-metadata.json");
      await pfs.Promises.writeFile(metadataPath, JSON.stringify(update));
    } catch (e) {
      this.logService.error("update#saveUpdateMetadata: failed to save", e);
    }
  }
  async loadUpdateMetadata() {
    try {
      const cachePath = await this.cachePath;
      const metadataPath = path.join(cachePath, "update-metadata.json");
      if (await pfs.Promises.exists(metadataPath)) {
        const content = await readFile(metadataPath, "utf8");
        return JSON.parse(content);
      }
    } catch (e) {
      this.logService.error("update#loadUpdateMetadata: failed to load", e);
    }
    return void 0;
  }
  getUpdateType() {
    return getUpdateType();
  }
  async _applySpecificUpdate(packagePath, commit) {
    if (this.state.type !== StateType.Idle) {
      return;
    }
    const fastUpdatesEnabled = this.configurationService.getValue("update.enableWindowsBackgroundUpdates");
    const update = await this.loadUpdateMetadata() ?? { version: commit ?? "unknown", productVersion: "unknown" };
    this.setState(State.Downloading(update, true, false));
    this.availableUpdate = { packagePath };
    this.setState(State.Downloaded(update, true, false));
    if (fastUpdatesEnabled && this.productService.target === "user") {
      this.doApplyUpdate();
    } else {
      this.setState(State.Ready(update, true, false));
    }
  }
  isInstallerActive(mutex) {
    return mutex.isActive(this.updatingMutexName) || mutex.isActive(this.setupMutexName);
  }
  async unlink(path2) {
    if (path2) {
      try {
        await unlink(path2);
      } catch (err) {
        const error = err;
        if (error && error.code === "ENOENT") {
          return;
        } else {
          this.logService.warn(`update#unlink: failed to unlink ${basename(path2)}`, err);
        }
      }
    }
  }
};
__decorateClass([
  memoize
], Win32UpdateService.prototype, "cachePath", 1);
__decorateClass([
  memoize
], Win32UpdateService.prototype, "mutex", 1);
Win32UpdateService = __decorateClass([
  __decorateParam(0, ILifecycleMainService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, ITelemetryService),
  __decorateParam(3, IEnvironmentMainService),
  __decorateParam(4, IRequestService),
  __decorateParam(5, ILogService),
  __decorateParam(6, IFileService),
  __decorateParam(7, INativeHostMainService),
  __decorateParam(8, IProductService),
  __decorateParam(9, IApplicationStorageMainService),
  __decorateParam(10, IMeteredConnectionService)
], Win32UpdateService);
export {
  Win32UpdateService
};
