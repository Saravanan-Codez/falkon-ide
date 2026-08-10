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
import { realpath, watch } from "fs";
import { timeout } from "../../../base/common/async.js";
import { Emitter, Event } from "../../../base/common/event.js";
import * as path from "../../../base/common/path.js";
import { IEnvironmentMainService } from "../../environment/electron-main/environmentMainService.js";
import { ILifecycleMainService } from "../../lifecycle/electron-main/lifecycleMainService.js";
import { ILogService } from "../../log/common/log.js";
import { State, StateType, UpdateType } from "../common/update.js";
import { IMeteredConnectionService } from "../../meteredConnection/common/meteredConnection.js";
let AbstractUpdateService = class {
  constructor(lifecycleMainService, environmentMainService, logService, meteredConnectionService) {
    this.lifecycleMainService = lifecycleMainService;
    this.logService = logService;
    this.meteredConnectionService = meteredConnectionService;
    this._state = State.Uninitialized;
    this._onStateChange = new Emitter();
    this.onStateChange = this._onStateChange.event;
    if (environmentMainService.disableUpdates) {
      this.logService.info("update#ctor - updates are disabled");
      return;
    }
    this.setState(State.Idle(this.getUpdateType()));
    this.scheduleCheckForUpdates(30 * 1e3).then(void 0, (err) => this.logService.error(err));
  }
  get state() {
    return this._state;
  }
  setState(state) {
    this.logService.info("update#setState", state.type);
    this._state = state;
    this._onStateChange.fire(state);
    if (state.type === StateType.Idle && (state.error || state.notAvailable)) {
      this._state = State.Idle(state.updateType);
    }
  }
  scheduleCheckForUpdates(delay = 60 * 60 * 1e3) {
    return timeout(delay).then(() => this.checkForUpdates(false)).then(() => {
      return this.scheduleCheckForUpdates(60 * 60 * 1e3);
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
  doDownloadUpdate(state) {
    return Promise.resolve(void 0);
  }
  async applyUpdate() {
    this.logService.trace("update#applyUpdate, state = ", this.state.type);
    if (this.state.type !== StateType.Downloaded) {
      return;
    }
    await this.doApplyUpdate();
  }
  doApplyUpdate() {
    return Promise.resolve(void 0);
  }
  quitAndInstall() {
    this.logService.trace("update#quitAndInstall, state = ", this.state.type);
    if (this.state.type !== StateType.Ready) {
      return Promise.resolve(void 0);
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
  getUpdateType() {
    return UpdateType.Snap;
  }
  doQuitAndInstall() {
  }
  async setInternalOrg(_internalOrg) {
  }
  async _applySpecificUpdate(packagePath) {
  }
};
AbstractUpdateService = __decorateClass([
  __decorateParam(0, ILifecycleMainService),
  __decorateParam(1, IEnvironmentMainService),
  __decorateParam(2, ILogService),
  __decorateParam(3, IMeteredConnectionService)
], AbstractUpdateService);
let SnapUpdateService = class extends AbstractUpdateService {
  constructor(snap, snapRevision, lifecycleMainService, environmentMainService, logService, meteredConnectionService) {
    super(lifecycleMainService, environmentMainService, logService, meteredConnectionService);
    this.snap = snap;
    this.snapRevision = snapRevision;
    const watcher = watch(path.dirname(this.snap));
    const onChange = Event.fromNodeEventEmitter(watcher, "change", (_, fileName) => fileName);
    const onCurrentChange = Event.filter(onChange, (n) => n === "current");
    const onDebouncedCurrentChange = Event.debounce(onCurrentChange, (_, e) => e, 2e3);
    const listener = onDebouncedCurrentChange(() => this.checkForUpdates(false));
    Event.once(lifecycleMainService.onWillShutdown)(() => {
      listener.dispose();
      watcher.close();
    });
  }
  doCheckForUpdates() {
    this.setState(State.CheckingForUpdates(false));
    this.isUpdateAvailable().then((result) => {
      if (result) {
        this.setState(State.Ready({ version: "something" }, false, false));
      } else {
        this.setState(State.Idle(UpdateType.Snap, void 0, void 0));
      }
    }, (err) => {
      this.logService.error(err);
      this.setState(State.Idle(UpdateType.Snap, err.message || err));
    });
  }
  doQuitAndInstall() {
    this.logService.trace("update#quitAndInstall(): running raw#quitAndInstall()");
    spawn("sleep 3 && " + path.basename(process.argv[0]), {
      shell: true,
      detached: true,
      stdio: "ignore"
    });
  }
  async isUpdateAvailable() {
    const resolvedCurrentSnapPath = await new Promise((c, e) => realpath(`${path.dirname(this.snap)}/current`, (err, r) => err ? e(err) : c(r)));
    const currentRevision = path.basename(resolvedCurrentSnapPath);
    return this.snapRevision !== currentRevision;
  }
  isLatestVersion() {
    return this.isUpdateAvailable().then(void 0, (err) => {
      this.logService.error("update#checkForSnapUpdate(): Could not get realpath of application.");
      return void 0;
    });
  }
};
SnapUpdateService = __decorateClass([
  __decorateParam(2, ILifecycleMainService),
  __decorateParam(3, IEnvironmentMainService),
  __decorateParam(4, ILogService),
  __decorateParam(5, IMeteredConnectionService)
], SnapUpdateService);
export {
  SnapUpdateService
};
