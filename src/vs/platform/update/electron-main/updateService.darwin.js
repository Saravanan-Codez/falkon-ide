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
import * as electron from "electron";
import { CancellationToken } from "../../../base/common/cancellation.js";
import { memoize } from "../../../base/common/decorators.js";
import { Event } from "../../../base/common/event.js";
import { hash } from "../../../base/common/hash.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { IEnvironmentMainService } from "../../environment/electron-main/environmentMainService.js";
import { ILifecycleMainService } from "../../lifecycle/electron-main/lifecycleMainService.js";
import { ILogService } from "../../log/common/log.js";
import { IProductService } from "../../product/common/productService.js";
import { asJson, IRequestService } from "../../request/common/request.js";
import { IApplicationStorageMainService } from "../../storage/electron-main/storageMainService.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { State, StateType, UpdateType } from "../common/update.js";
import { IMeteredConnectionService } from "../../meteredConnection/common/meteredConnection.js";
import { AbstractUpdateService, createUpdateURL, getUpdateRequestHeaders } from "./abstractUpdateService.js";
let DarwinUpdateService = class extends AbstractUpdateService {
  get onRawError() {
    return Event.fromNodeEventEmitter(electron.autoUpdater, "error", (_, message) => message);
  }
  get onRawCheckingForUpdate() {
    return Event.fromNodeEventEmitter(electron.autoUpdater, "checking-for-update");
  }
  get onRawUpdateNotAvailable() {
    return Event.fromNodeEventEmitter(electron.autoUpdater, "update-not-available");
  }
  get onRawUpdateAvailable() {
    return Event.fromNodeEventEmitter(electron.autoUpdater, "update-available");
  }
  get onRawUpdateDownloaded() {
    return Event.fromNodeEventEmitter(electron.autoUpdater, "update-downloaded", (_, version, productVersion, releaseDate) => ({
      version,
      productVersion,
      timestamp: releaseDate instanceof Date ? releaseDate.getTime() || void 0 : releaseDate
    }));
  }
  constructor(lifecycleMainService, configurationService, telemetryService, environmentMainService, requestService, logService, productService, applicationStorageMainService, meteredConnectionService) {
    super(lifecycleMainService, configurationService, environmentMainService, requestService, logService, productService, telemetryService, applicationStorageMainService, meteredConnectionService, true);
    lifecycleMainService.setRelaunchHandler(this);
  }
  handleRelaunch(options) {
    if (options?.addArgs || options?.removeArgs) {
      return false;
    }
    if (this.state.type !== StateType.Ready) {
      return false;
    }
    this.logService.trace("update#handleRelaunch(): running raw#quitAndInstall()");
    this.doQuitAndInstall();
    return true;
  }
  async initialize() {
    await super.initialize();
    this.onRawError(this.onError, this, this._store);
    this.onRawCheckingForUpdate(this.onCheckingForUpdate, this, this._store);
    this.onRawUpdateAvailable(this.onUpdateAvailable, this, this._store);
    this.onRawUpdateDownloaded(this.onUpdateDownloaded, this, this._store);
    this.onRawUpdateNotAvailable(this.onUpdateNotAvailable, this, this._store);
  }
  onCheckingForUpdate() {
    this.logService.trace("update#onCheckingForUpdate - Electron autoUpdater is checking for updates");
  }
  onError(err) {
    this.telemetryService.publicLog2("update:error", { messageHash: String(hash(String(err))) });
    this.logService.error("UpdateService error:", err);
    if (this.state.type !== StateType.CheckingForUpdates && this.state.type !== StateType.Downloading && this.state.type !== StateType.Overwriting) {
      return;
    }
    const message = this.state.type === StateType.CheckingForUpdates && this.state.explicit ? err : void 0;
    this.setState(State.Idle(UpdateType.Archive, message));
  }
  buildUpdateFeedUrl(quality, commit, options) {
    const assetID = this.productService.darwinUniversalAssetId ?? (process.arch === "x64" ? "darwin" : "darwin-arm64");
    const url = createUpdateURL(this.productService.updateUrl, assetID, quality, commit, options);
    const headers = getUpdateRequestHeaders(this.productService.version);
    try {
      this.logService.trace("update#buildUpdateFeedUrl - setting feed URL for Electron autoUpdater", { url, assetID, quality, commit, headers });
      electron.autoUpdater.setFeedURL({ url, headers });
    } catch (e) {
      this.logService.error("Failed to set update feed URL", e);
      return void 0;
    }
    return url;
  }
  doCheckForUpdates(explicit, pendingCommit) {
    if (!this.quality) {
      return;
    }
    this.setState(State.CheckingForUpdates(explicit));
    const internalOrg = this.getInternalOrg();
    const background = !explicit && !internalOrg;
    const url = this.buildUpdateFeedUrl(this.quality, pendingCommit ?? this.productService.commit, { background, internalOrg });
    if (!url) {
      this.setState(State.Idle(UpdateType.Archive));
      return;
    }
    if (!explicit && this.meteredConnectionService.isConnectionMetered) {
      this.logService.info("update#doCheckForUpdates - checking for update without auto-download because connection is metered");
      this.checkForUpdateNoDownload(url);
      return;
    }
    this.logService.trace("update#doCheckForUpdates - using Electron autoUpdater", { url, explicit, background });
    electron.autoUpdater.checkForUpdates();
  }
  /**
   * Manually check the update feed URL without triggering Electron's auto-download.
   * Used when connection is metered or in the embedded app.
   * @param canInstall When false, signals that the update cannot be installed from this app.
   */
  async checkForUpdateNoDownload(url, canInstall) {
    const headers = getUpdateRequestHeaders(this.productService.version);
    this.logService.trace("update#checkForUpdateNoDownload - checking update server", { url, headers });
    try {
      const context = await this.requestService.request({ url, headers, callSite: "updateService.darwin.checkForUpdates" }, CancellationToken.None);
      const statusCode = context.res.statusCode;
      this.logService.trace("update#checkForUpdateNoDownload - response", { statusCode });
      const update = await asJson(context);
      if (!update || !update.url || !update.version || !update.productVersion) {
        this.logService.trace("update#checkForUpdateNoDownload - no update available");
        const notAvailable = this.state.type === StateType.CheckingForUpdates && this.state.explicit;
        this.setState(State.Idle(UpdateType.Archive, void 0, notAvailable || void 0));
      } else {
        this.logService.trace("update#checkForUpdateNoDownload - update available", { version: update.version, productVersion: update.productVersion });
        this.setState(State.AvailableForDownload(update, canInstall));
      }
    } catch (err) {
      this.logService.error("update#checkForUpdateNoDownload - failed to check for update", err);
      this.setState(State.Idle(UpdateType.Archive));
    }
  }
  onUpdateAvailable() {
    this.logService.trace("update#onUpdateAvailable - Electron autoUpdater reported update available");
    if (this.state.type !== StateType.CheckingForUpdates && this.state.type !== StateType.Overwriting) {
      return;
    }
    this.setState(State.Downloading(this.state.type === StateType.Overwriting ? this.state.update : void 0, this.state.explicit, this._overwrite));
  }
  onUpdateDownloaded(update) {
    if (this.state.type !== StateType.Downloading) {
      return;
    }
    this.setState(State.Downloaded(update, this.state.explicit, this._overwrite));
    this.logService.info(`Update downloaded: ${JSON.stringify(update)}`);
    this.setState(State.Ready(update, this.state.explicit, this._overwrite));
  }
  onUpdateNotAvailable() {
    this.logService.trace("update#onUpdateNotAvailable - Electron autoUpdater reported no update available");
    if (this.state.type !== StateType.CheckingForUpdates) {
      return;
    }
    const notAvailable = this.state.explicit;
    this.setState(State.Idle(UpdateType.Archive, void 0, notAvailable || void 0));
  }
  async doDownloadUpdate(state) {
    this.buildUpdateFeedUrl(this.quality, state.update.version, { internalOrg: this.getInternalOrg() });
    this.setState(State.CheckingForUpdates(true));
    electron.autoUpdater.checkForUpdates();
  }
  doQuitAndInstall() {
    this.logService.trace("update#quitAndInstall(): running raw#quitAndInstall()");
    electron.autoUpdater.quitAndInstall();
  }
};
__decorateClass([
  memoize
], DarwinUpdateService.prototype, "onRawError", 1);
__decorateClass([
  memoize
], DarwinUpdateService.prototype, "onRawCheckingForUpdate", 1);
__decorateClass([
  memoize
], DarwinUpdateService.prototype, "onRawUpdateNotAvailable", 1);
__decorateClass([
  memoize
], DarwinUpdateService.prototype, "onRawUpdateAvailable", 1);
__decorateClass([
  memoize
], DarwinUpdateService.prototype, "onRawUpdateDownloaded", 1);
DarwinUpdateService = __decorateClass([
  __decorateParam(0, ILifecycleMainService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, ITelemetryService),
  __decorateParam(3, IEnvironmentMainService),
  __decorateParam(4, IRequestService),
  __decorateParam(5, ILogService),
  __decorateParam(6, IProductService),
  __decorateParam(7, IApplicationStorageMainService),
  __decorateParam(8, IMeteredConnectionService)
], DarwinUpdateService);
export {
  DarwinUpdateService
};
