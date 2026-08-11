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
import { validatedIpcMain } from "../../../base/parts/ipc/electron-main/ipcMain.js";
import { Barrier, DeferredPromise } from "../../../base/common/async.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { IEnvironmentMainService } from "../../environment/electron-main/environmentMainService.js";
import { ILifecycleMainService } from "../../lifecycle/electron-main/lifecycleMainService.js";
import { ILogService } from "../../log/common/log.js";
import { IUserDataProfilesService } from "../../userDataProfile/common/userDataProfile.js";
import { IPolicyService } from "../../policy/common/policy.js";
import { ILoggerMainService } from "../../log/electron-main/loggerService.js";
import { UtilityProcess } from "../../utilityProcess/electron-main/utilityProcess.js";
import { NullTelemetryService } from "../../telemetry/common/telemetryUtils.js";
import { parseSharedProcessDebugPort } from "../../environment/node/environmentService.js";
import { assertReturnsDefined } from "../../../base/common/types.js";
import { SharedProcessChannelConnection, SharedProcessRawConnection, SharedProcessLifecycle } from "../common/sharedProcess.js";
import { Emitter } from "../../../base/common/event.js";
let SharedProcess = class extends Disposable {
  constructor(machineId, sqmId, devDeviceId, environmentMainService, userDataProfilesService, lifecycleMainService, logService, loggerMainService, policyService) {
    super();
    this.machineId = machineId;
    this.sqmId = sqmId;
    this.devDeviceId = devDeviceId;
    this.environmentMainService = environmentMainService;
    this.userDataProfilesService = userDataProfilesService;
    this.lifecycleMainService = lifecycleMainService;
    this.logService = logService;
    this.loggerMainService = loggerMainService;
    this.policyService = policyService;
    this.firstWindowConnectionBarrier = new Barrier();
    this.utilityProcess = void 0;
    this.utilityProcessLogListener = void 0;
    this._onDidCrash = this._register(new Emitter());
    this.onDidCrash = this._onDidCrash.event;
    this._whenReady = void 0;
    this._whenIpcReady = void 0;
    this.registerListeners();
  }
  registerListeners() {
    validatedIpcMain.on(SharedProcessChannelConnection.request, (e, nonce) => this.onWindowConnection(e, nonce, SharedProcessChannelConnection.response));
    validatedIpcMain.on(SharedProcessRawConnection.request, (e, nonce) => this.onWindowConnection(e, nonce, SharedProcessRawConnection.response));
    this._register(this.lifecycleMainService.onWillShutdown(() => this.onWillShutdown()));
  }
  async onWindowConnection(e, nonce, responseChannel) {
    this.logService.trace(`[SharedProcess] onWindowConnection for: ${responseChannel}`);
    if (!this.firstWindowConnectionBarrier.isOpen()) {
      this.firstWindowConnectionBarrier.open();
    }
    await this.whenReady();
    const port = await this.connect(responseChannel);
    if (e.sender.isDestroyed()) {
      return port.close();
    }
    e.sender.postMessage(responseChannel, nonce, [port]);
  }
  onWillShutdown() {
    this.logService.trace("[SharedProcess] onWillShutdown");
    this.utilityProcess?.postMessage(SharedProcessLifecycle.exit);
    this.utilityProcess = void 0;
  }
  whenReady() {
    if (!this._whenReady) {
      this._whenReady = (async () => {
        await this.whenIpcReady;
        const whenReady = new DeferredPromise();
        this.utilityProcess?.once(SharedProcessLifecycle.initDone, () => whenReady.complete());
        await whenReady.p;
        this.utilityProcessLogListener?.dispose();
        this.logService.trace("[SharedProcess] Overall ready");
      })();
    }
    return this._whenReady;
  }
  get whenIpcReady() {
    if (!this._whenIpcReady) {
      this._whenIpcReady = (async () => {
        await this.firstWindowConnectionBarrier.wait();
        this.createUtilityProcess();
        const sharedProcessIpcReady = new DeferredPromise();
        this.utilityProcess?.once(SharedProcessLifecycle.ipcReady, () => sharedProcessIpcReady.complete());
        await sharedProcessIpcReady.p;
        this.logService.trace("[SharedProcess] IPC ready");
      })();
    }
    return this._whenIpcReady;
  }
  createUtilityProcess() {
    this.utilityProcess = this._register(new UtilityProcess(this.logService, NullTelemetryService, this.lifecycleMainService));
    this.utilityProcessLogListener = this.utilityProcess.onMessage((e) => {
      const logValue = e;
      if (typeof logValue.warning === "string") {
        this.logService.warn(logValue.warning);
      } else if (typeof logValue.error === "string") {
        this.logService.error(logValue.error);
      }
    });
    const inspectParams = parseSharedProcessDebugPort(this.environmentMainService.args, this.environmentMainService.isBuilt);
    let execArgv = void 0;
    if (inspectParams.port) {
      execArgv = ["--nolazy", "--experimental-network-inspection"];
      if (inspectParams.break) {
        execArgv.push(`--inspect-brk=${inspectParams.port}`);
      } else {
        execArgv.push(`--inspect=${inspectParams.port}`);
      }
    }
    this.utilityProcess.start({
      type: "shared-process",
      name: "shared-process",
      entryPoint: "vs/code/electron-utility/sharedProcess/sharedProcessMain",
      payload: this.createSharedProcessConfiguration(),
      respondToAuthRequestsFromMainProcess: true,
      execArgv
    });
    this._register(this.utilityProcess.onCrash(() => this._onDidCrash.fire()));
  }
  createSharedProcessConfiguration() {
    return {
      machineId: this.machineId,
      sqmId: this.sqmId,
      devDeviceId: this.devDeviceId,
      codeCachePath: this.environmentMainService.codeCachePath,
      profiles: {
        home: this.userDataProfilesService.profilesHome,
        all: this.userDataProfilesService.profiles
      },
      args: this.environmentMainService.args,
      logLevel: this.loggerMainService.getLogLevel(),
      loggers: this.loggerMainService.getGlobalLoggers(),
      policiesData: this.policyService.serialize()
    };
  }
  async connect(payload) {
    await this.whenIpcReady;
    const utilityProcess = assertReturnsDefined(this.utilityProcess);
    return utilityProcess.connect(payload);
  }
};
SharedProcess = __decorateClass([
  __decorateParam(3, IEnvironmentMainService),
  __decorateParam(4, IUserDataProfilesService),
  __decorateParam(5, ILifecycleMainService),
  __decorateParam(6, ILogService),
  __decorateParam(7, ILoggerMainService),
  __decorateParam(8, IPolicyService)
], SharedProcess);
export {
  SharedProcess
};
