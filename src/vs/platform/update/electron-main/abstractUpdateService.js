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
import * as os from "os";
import { IntervalTimer, Throttler, timeout } from "../../../base/common/async.js";
import { CancellationToken, CancellationTokenSource } from "../../../base/common/cancellation.js";
import { isCancellationError } from "../../../base/common/errors.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable, MutableDisposable, toDisposable } from "../../../base/common/lifecycle.js";
import { isMacintosh, isWindows } from "../../../base/common/platform.js";
import { getWindowsReleaseSync } from "../../../base/node/windowsVersion.js";
import { IMeteredConnectionService } from "../../meteredConnection/common/meteredConnection.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { IEnvironmentMainService } from "../../environment/electron-main/environmentMainService.js";
import { ILifecycleMainService, LifecycleMainPhase } from "../../lifecycle/electron-main/lifecycleMainService.js";
import { ILogService } from "../../log/common/log.js";
import { IProductService } from "../../product/common/productService.js";
import { IRequestService } from "../../request/common/request.js";
import { StorageScope, StorageTarget } from "../../storage/common/storage.js";
import { IApplicationStorageMainService } from "../../storage/electron-main/storageMainService.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { DisablementReason, State, StateType, UpdateType } from "../common/update.js";
const LAST_KNOWN_VERSION_STORAGE_KEY = "abstractUpdateService/lastKnownVersion";
function createUpdateURL(baseUpdateUrl, platform, quality, commit, options) {
  const url = new URL(`${baseUpdateUrl}/api/update/${platform}/${quality}/${commit}`);
  if (options?.background) {
    url.searchParams.set("bg", "true");
  }
  url.searchParams.set("u", options?.internalOrg ?? "none");
  return url.toString();
}
function getUpdateRequestHeaders(productVersion) {
  if (isMacintosh) {
    const darwinVersion = os.release();
    return {
      "User-Agent": `Code/${productVersion} Darwin/${darwinVersion}`
    };
  }
  if (isWindows) {
    const match = getWindowsReleaseSync().match(/^(\d+\.\d+)/);
    if (match) {
      return {
        "User-Agent": `Code/${productVersion} Electron/${process.versions.electron} Windows NT ${match[1]}`
      };
    }
  }
  return void 0;
}
function isCancellableState(type) {
  switch (type) {
    case StateType.CheckingForUpdates:
    case StateType.AvailableForDownload:
    case StateType.Downloading:
    case StateType.Downloaded:
    case StateType.Updating:
    case StateType.Ready:
    case StateType.Overwriting:
      return true;
    default:
      return false;
  }
}
let AbstractUpdateService = class extends Disposable {
  constructor(lifecycleMainService, configurationService, environmentMainService, requestService, logService, productService, telemetryService, applicationStorageMainService, meteredConnectionService, supportsUpdateOverwrite) {
    super();
    this.lifecycleMainService = lifecycleMainService;
    this.configurationService = configurationService;
    this.environmentMainService = environmentMainService;
    this.requestService = requestService;
    this.logService = logService;
    this.productService = productService;
    this.telemetryService = telemetryService;
    this.applicationStorageMainService = applicationStorageMainService;
    this.meteredConnectionService = meteredConnectionService;
    this.supportsUpdateOverwrite = supportsUpdateOverwrite;
    this._state = State.Uninitialized;
    this._overwrite = false;
    this._hasCheckedForOverwriteOnQuit = false;
    this.overwriteUpdatesCheckInterval = this._register(new IntervalTimer());
    this._internalOrg = void 0;
    /** Disabled for a non-reversible reason (e.g. not built, missing config); ignores `update.mode` changes. */
    this._disabledPermanently = false;
    /** Whether one-time platform init (e.g. background update GC, pending update resume) has run. */
    this._postInitialized = false;
    /** Cancels the pending scheduled update check, if any. */
    this.scheduler = this._register(new MutableDisposable());
    /** Serializes reconfiguration so overlapping `update.mode` changes settle on the latest value. */
    this.reconfigureThrottler = this._register(new Throttler());
    this._onStateChange = this._register(new Emitter());
    this.onStateChange = this._onStateChange.event;
    lifecycleMainService.when(LifecycleMainPhase.AfterWindowOpen).finally(() => this.initialize());
  }
  get state() {
    return this._state;
  }
  setState(state) {
    if (state.type === StateType.Updating) {
      this.logService.trace("update#setState", state.type);
    } else {
      this.logService.info("update#setState", state.type);
    }
    this._state = state;
    this._onStateChange.fire(state);
    if (state.type === StateType.Idle && (state.error || state.notAvailable)) {
      this._state = State.Idle(state.updateType);
    }
    if (this.supportsUpdateOverwrite) {
      if (state.type === StateType.Ready) {
        this.overwriteUpdatesCheckInterval.cancelAndSet(() => this.checkForOverwriteUpdates(), 5 * 60 * 1e3);
      } else {
        this.overwriteUpdatesCheckInterval.cancel();
      }
    }
  }
  /**
   * This must be called before any other call. This is a performance
   * optimization, to avoid using extra CPU cycles before first window open.
   * https://github.com/microsoft/vscode/issues/89784
   */
  async initialize() {
    if (!this.environmentMainService.isBuilt) {
      this.setDisabledPermanently(DisablementReason.NotBuilt);
      return;
    }
    await this.trackVersionChange();
    if (this.environmentMainService.disableUpdates) {
      this.setDisabledPermanently(DisablementReason.DisabledByEnvironment);
      this.logService.info("update#ctor - updates are disabled by the environment");
      return;
    }
    if (!this.productService.updateUrl || !this.productService.commit) {
      this.setDisabledPermanently(DisablementReason.MissingConfiguration);
      this.logService.info("update#ctor - updates are disabled as there is no update URL");
      return;
    }
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("update.mode")) {
        this.reconfigure().catch((err) => this.logService.error("update#reconfigure - failed to apply update mode change", err));
      }
    }));
    await this.reconfigure();
  }
  /**
   * Evaluates the current `update.mode` setting (and its policy) and brings the service into the matching state.
   * Runs on startup and on every change, enabling or disabling updates without a restart.
   */
  reconfigure() {
    return this.reconfigureThrottler.queue(() => this.doReconfigure());
  }
  async doReconfigure() {
    if (this._disabledPermanently) {
      return;
    }
    const updateMode = this.configurationService.getValue("update.mode");
    const updateModeInspection = this.configurationService.inspect("update.mode");
    const policyDisablesUpdates = updateModeInspection.policyValue !== void 0 && !this.getProductQuality(updateModeInspection.policyValue);
    const quality = this.getProductQuality(updateMode);
    if (!quality) {
      const reason = policyDisablesUpdates ? DisablementReason.Policy : DisablementReason.ManuallyDisabled;
      if (this._state.type === StateType.Disabled && this._state.reason === reason) {
        return;
      }
      await this.disable(reason);
      return;
    }
    if (!this.buildUpdateFeedUrl(quality, this.productService.commit)) {
      this.setDisabledPermanently(DisablementReason.InvalidConfiguration);
      this.logService.info("update#ctor - updates are disabled as the update URL is badly formed");
      return;
    }
    this.quality = quality;
    if (this._state.type === StateType.Disabled || this._state.type === StateType.Uninitialized) {
      this.setState(State.Idle(this.getUpdateType()));
    }
    if (!this._postInitialized) {
      this._postInitialized = true;
      await this.postInitialize();
    }
    this.scheduleAccordingToMode(updateMode);
  }
  /**
   * Disables updates for a reversible reason (user preference or policy), cancelling the scheduled check loop
   * and any in-flight or pending update before moving to Disabled.
   */
  async disable(reason) {
    this.scheduler.clear();
    if (isCancellableState(this._state.type)) {
      this.setState(State.Cancelling);
    }
    try {
      await this.cancelUpdate();
    } catch (err) {
      this.logService.warn("update#disable - failed to cancel pending update", err);
    }
    this.quality = void 0;
    if (reason === DisablementReason.Policy) {
      this.logService.info("update#disable - updates are disabled by policy");
    } else {
      this.logService.info("update#disable - updates are disabled by user preference");
    }
    this.setState(State.Disabled(reason));
  }
  /** Disables updates for a non-reversible reason; subsequent `update.mode` changes are ignored. */
  setDisabledPermanently(reason) {
    this._disabledPermanently = true;
    this.scheduler.clear();
    this.setState(State.Disabled(reason));
  }
  scheduleAccordingToMode(updateMode) {
    this.scheduler.clear();
    if (updateMode === "manual") {
      this.logService.info("update#ctor - manual checks only; automatic updates are disabled by user preference");
      return;
    }
    if (updateMode === "start") {
      this.logService.info("update#ctor - startup checks only; automatic updates are disabled by user preference");
      this.scheduleCheckForUpdates(30 * 1e3, false);
    } else {
      this.scheduleCheckForUpdates(30 * 1e3, true);
    }
  }
  async trackVersionChange() {
    await this.applicationStorageMainService.whenReady;
    let from;
    const raw = this.applicationStorageMainService.get(LAST_KNOWN_VERSION_STORAGE_KEY, StorageScope.APPLICATION);
    if (typeof raw === "string") {
      try {
        from = JSON.parse(raw);
      } catch (error) {
      }
    }
    const to = {
      version: this.productService.version,
      commit: this.productService.commit,
      timestamp: Date.now()
    };
    if (from?.commit === to.commit) {
      return;
    }
    this.applicationStorageMainService.store(LAST_KNOWN_VERSION_STORAGE_KEY, JSON.stringify(to), StorageScope.APPLICATION, StorageTarget.MACHINE);
    if (!from) {
      return;
    }
    this.telemetryService.publicLog2("update:versionChanged", {
      fromVersion: from.version,
      fromCommit: from.commit,
      fromVersionTime: from.timestamp,
      toVersion: to.version,
      toCommit: to.commit,
      timeToUpdateMs: to.timestamp - from.timestamp,
      updateMode: this.configurationService.getValue("update.mode")
    });
  }
  getProductQuality(updateMode) {
    return updateMode === "none" ? void 0 : this.productService.quality;
  }
  scheduleCheckForUpdates(delay = 60 * 60 * 1e3, repeat = true) {
    const promise = timeout(delay);
    this.scheduler.value = toDisposable(() => promise.cancel());
    promise.then(() => this.checkForUpdates(false)).then(() => {
      if (repeat) {
        this.scheduleCheckForUpdates(60 * 60 * 1e3, true);
      }
    }).catch((err) => {
      if (!isCancellationError(err)) {
        this.logService.error(err);
      }
    });
  }
  async checkForUpdates(explicit) {
    this.logService.trace("update#checkForUpdates, state = ", this.state.type);
    if (this.state.type !== StateType.Idle) {
      return;
    }
    this.doCheckForUpdates(explicit);
  }
  async downloadUpdate(explicit) {
    this.logService.trace("update#downloadUpdate, state = ", this.state.type);
    if (this.state.type !== StateType.AvailableForDownload) {
      return;
    }
    if (!explicit && this.meteredConnectionService.isConnectionMetered) {
      this.logService.info("update#downloadUpdate - skipping download because connection is metered");
      return;
    }
    await this.doDownloadUpdate(this.state);
  }
  async doDownloadUpdate(state) {
  }
  async applyUpdate() {
    this.logService.trace("update#applyUpdate, state = ", this.state.type);
    if (this.state.type !== StateType.Downloaded) {
      return;
    }
    await this.doApplyUpdate();
  }
  async doApplyUpdate() {
  }
  async quitAndInstall() {
    this.logService.trace("update#quitAndInstall, state = ", this.state.type);
    if (this.state.type !== StateType.Ready) {
      return void 0;
    }
    if (this.supportsUpdateOverwrite && !this._hasCheckedForOverwriteOnQuit) {
      this._hasCheckedForOverwriteOnQuit = true;
      const didOverwrite = await this.checkForOverwriteUpdates(true);
      if (didOverwrite) {
        this.logService.info("update#quitAndInstall(): overwrite update detected, postponing quitAndInstall");
        return;
      }
    }
    const readyState = this.state;
    this.setState(State.Restarting(this.state.update));
    this.logService.trace("update#quitAndInstall(): before lifecycle quit()");
    this.lifecycleMainService.quit(
      true
      /* will restart */
    ).then((vetod) => {
      this.logService.trace(`update#quitAndInstall(): after lifecycle quit() with veto: ${vetod}`);
      if (vetod) {
        this.logService.info("update#quitAndInstall(): quit was vetoed, restoring Ready state");
        this.setState(readyState);
        return;
      }
      this.logService.trace("update#quitAndInstall(): running raw#quitAndInstall()");
      this.doQuitAndInstall();
    });
    return Promise.resolve(void 0);
  }
  async checkForOverwriteUpdates(explicit = false) {
    if (this._state.type !== StateType.Ready) {
      return false;
    }
    const pendingUpdateCommit = this._state.update.version;
    if (!pendingUpdateCommit || pendingUpdateCommit === "unknown") {
      return false;
    }
    let isLatest;
    try {
      const cts = new CancellationTokenSource();
      const timeoutPromise = timeout(2e3).then(() => {
        cts.cancel();
        return void 0;
      });
      isLatest = await Promise.race([this.isLatestVersion(pendingUpdateCommit, cts.token), timeoutPromise]);
      cts.dispose();
    } catch (error) {
      this.logService.warn("update#checkForOverwriteUpdates(): failed to check for updates, proceeding with restart");
      this.logService.warn(error);
      return false;
    }
    if (isLatest === false && this._state.type === StateType.Ready) {
      this.logService.info("update#readyStateCheck: newer update available, restarting update machinery");
      try {
        await this.cancelPendingUpdate();
      } catch (error) {
        this.logService.error("update#checkForOverwriteUpdates(): failed to cancel pending update, aborting overwrite");
        this.logService.error(error);
        return false;
      }
      this._overwrite = true;
      this.setState(State.Overwriting(this._state.update, explicit));
      this.doCheckForUpdates(explicit, pendingUpdateCommit);
      return true;
    }
    return false;
  }
  async isLatestVersion(commit, token = CancellationToken.None) {
    if (!this.quality) {
      return void 0;
    }
    const mode = this.configurationService.getValue("update.mode");
    if (mode === "none") {
      return void 0;
    }
    const url = this.buildUpdateFeedUrl(this.quality, commit ?? this.productService.commit, { internalOrg: this.getInternalOrg() });
    if (!url) {
      return void 0;
    }
    const headers = getUpdateRequestHeaders(this.productService.version);
    this.logService.trace("update#isLatestVersion() - checking update server", { url, headers });
    try {
      const context = await this.requestService.request({ url, headers, callSite: "updateService.isLatestVersion" }, token);
      const statusCode = context.res.statusCode;
      this.logService.trace("update#isLatestVersion() - response", { statusCode });
      return statusCode === 204;
    } catch (error) {
      this.logService.error("update#isLatestVersion(): failed to check for updates");
      this.logService.error(error);
      return void 0;
    }
  }
  async _applySpecificUpdate(packagePath) {
  }
  async setInternalOrg(internalOrg) {
    if (this._internalOrg === internalOrg) {
      return;
    }
    this.logService.info("update#setInternalOrg", internalOrg);
    this._internalOrg = internalOrg;
  }
  getInternalOrg() {
    return this._internalOrg;
  }
  getUpdateType() {
    return UpdateType.Archive;
  }
  doQuitAndInstall() {
  }
  async postInitialize() {
  }
  async cancelPendingUpdate() {
  }
  /**
   * Aborts in-flight or pending update work when updates are being disabled at runtime. The default cancels a
   * pending update; platform services override this to also abort in-flight checks/downloads.
   */
  async cancelUpdate() {
    await this.cancelPendingUpdate();
  }
};
AbstractUpdateService = __decorateClass([
  __decorateParam(0, ILifecycleMainService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IEnvironmentMainService),
  __decorateParam(3, IRequestService),
  __decorateParam(4, ILogService),
  __decorateParam(5, IProductService),
  __decorateParam(6, ITelemetryService),
  __decorateParam(7, IApplicationStorageMainService),
  __decorateParam(8, IMeteredConnectionService)
], AbstractUpdateService);
export {
  AbstractUpdateService,
  createUpdateURL,
  getUpdateRequestHeaders
};
