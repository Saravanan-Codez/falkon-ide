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
import { CONFIGURATION_KEY_HOST_NAME, CONFIGURATION_KEY_PREVENT_SLEEP, LOGGER_NAME, LOG_ID, normalizeTunnelName, tunnelNameFromHostname, TunnelStates, INACTIVE_TUNNEL_MODE } from "../common/remoteTunnel.js";
import { Emitter } from "../../../base/common/event.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { INativeEnvironmentService } from "../../environment/common/environment.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { ILoggerService, LogLevelToString } from "../../log/common/log.js";
import { dirname, join } from "../../../base/common/path.js";
import { spawn } from "child_process";
import { IProductService } from "../../product/common/productService.js";
import { isMacintosh, isWindows } from "../../../base/common/platform.js";
import { createCancelablePromise, Delayer } from "../../../base/common/async.js";
import { ISharedProcessLifecycleService } from "../../lifecycle/node/sharedProcessLifecycleService.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { localize } from "../../../nls.js";
import { hostname, homedir } from "os";
import { IStorageService, StorageScope, StorageTarget } from "../../storage/common/storage.js";
import { isString } from "../../../base/common/types.js";
import { StreamSplitter } from "../../../base/node/nodeStreams.js";
import { joinPath } from "../../../base/common/resources.js";
const restartTunnelOnConfigurationChanges = [
  CONFIGURATION_KEY_HOST_NAME,
  CONFIGURATION_KEY_PREVENT_SLEEP
];
const TUNNEL_ACCESS_SESSION = "remoteTunnelSession";
const TUNNEL_ACCESS_IS_SERVICE = "remoteTunnelIsService";
let RemoteTunnelService = class extends Disposable {
  constructor(telemetryService, productService, environmentService, loggerService, sharedProcessLifecycleService, configurationService, storageService) {
    super();
    this.telemetryService = telemetryService;
    this.productService = productService;
    this.environmentService = environmentService;
    this.configurationService = configurationService;
    this.storageService = storageService;
    this._onDidTokenFailedEmitter = this._register(new Emitter());
    this.onDidTokenFailed = this._onDidTokenFailedEmitter.event;
    this._onDidChangeTunnelStatusEmitter = this._register(new Emitter());
    this.onDidChangeTunnelStatus = this._onDidChangeTunnelStatusEmitter.event;
    this._onDidChangeModeEmitter = this._register(new Emitter());
    this.onDidChangeMode = this._onDidChangeModeEmitter.event;
    /**
     * "Mode" in the terminal state we want to get to -- started, stopped, and
     * the attributes associated with each.
     *
     * At any given time, work may be ongoing to get `_tunnelStatus` into a
     * state that reflects the desired `mode`.
     */
    this._mode = INACTIVE_TUNNEL_MODE;
    this._initialized = false;
    this.defaultOnOutput = (a, isErr) => {
      if (isErr) {
        this._logger.error(a);
      } else {
        this._logger.info(a);
      }
    };
    this._logger = this._register(loggerService.createLogger(joinPath(environmentService.logsHome, `${LOG_ID}.log`), { id: LOG_ID, name: LOGGER_NAME }));
    this._startTunnelProcessDelayer = this._register(new Delayer(100));
    this._register(this._logger.onDidChangeLogLevel((l) => this._logger.info("Log level changed to " + LogLevelToString(l))));
    this._register(sharedProcessLifecycleService.onWillShutdown(() => {
      this._tunnelProcess?.cancel();
      this._tunnelProcess = void 0;
      this.dispose();
    }));
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (restartTunnelOnConfigurationChanges.some((c) => e.affectsConfiguration(c))) {
        this._startTunnelProcessDelayer.trigger(() => this.updateTunnelProcess());
      }
    }));
    this._mode = this._restoreMode();
    this._tunnelStatus = TunnelStates.uninitialized;
  }
  async getTunnelStatus() {
    return this._tunnelStatus;
  }
  setTunnelStatus(tunnelStatus) {
    this._tunnelStatus = tunnelStatus;
    this._onDidChangeTunnelStatusEmitter.fire(tunnelStatus);
  }
  setMode(mode) {
    if (isSameMode(this._mode, mode)) {
      return;
    }
    this._mode = mode;
    this._storeMode(mode);
    this._onDidChangeModeEmitter.fire(this._mode);
    if (mode.active) {
      this._logger.info(`Session updated: ${mode.session.accountLabel} (${mode.session.providerId}) (service=${mode.asService})`);
      if (mode.session.token) {
        this._logger.info(`Session token updated: ${mode.session.accountLabel} (${mode.session.providerId})`);
      }
    } else {
      this._logger.info(`Session reset`);
    }
  }
  getMode() {
    return Promise.resolve(this._mode);
  }
  async initialize(mode) {
    if (this._initialized) {
      return this._tunnelStatus;
    }
    this._initialized = true;
    this.setMode(mode);
    try {
      await this._startTunnelProcessDelayer.trigger(() => this.updateTunnelProcess());
    } catch (e) {
      this._logger.error(e);
    }
    return this._tunnelStatus;
  }
  getTunnelCommandLocation() {
    if (!this._tunnelCommand) {
      let binParentLocation;
      if (isMacintosh) {
        binParentLocation = this.environmentService.appRoot;
      } else if (isWindows) {
        if (this.productService.win32VersionedUpdate) {
          binParentLocation = dirname(dirname(dirname(this.environmentService.appRoot)));
        } else {
          binParentLocation = dirname(dirname(this.environmentService.appRoot));
        }
      } else {
        binParentLocation = dirname(dirname(this.environmentService.appRoot));
      }
      this._tunnelCommand = join(binParentLocation, "bin", `${this.productService.tunnelApplicationName}${isWindows ? ".exe" : ""}`);
    }
    return this._tunnelCommand;
  }
  async startTunnel(mode) {
    if (isSameMode(this._mode, mode) && this._tunnelStatus.type !== "disconnected") {
      return this._tunnelStatus;
    }
    this.setMode(mode);
    try {
      await this._startTunnelProcessDelayer.trigger(() => this.updateTunnelProcess());
    } catch (e) {
      this._logger.error(e);
    }
    return this._tunnelStatus;
  }
  async stopTunnel() {
    if (this._tunnelProcess) {
      this._tunnelProcess.cancel();
      this._tunnelProcess = void 0;
    }
    if (this._mode.active) {
      const needsServiceUninstall = this._mode.asService;
      this.setMode(INACTIVE_TUNNEL_MODE);
      try {
        if (needsServiceUninstall) {
          this.runCodeTunnelCommand("uninstallService", ["service", "uninstall"]);
        }
      } catch (e) {
        this._logger.error(e);
      }
    }
    try {
      await this.runCodeTunnelCommand("stop", ["kill"]);
    } catch (e) {
      this._logger.error(e);
    }
    this.setTunnelStatus(TunnelStates.disconnected());
  }
  async updateTunnelProcess() {
    const tunnelName = this._getTunnelName();
    this.telemetryService.publicLog2("remoteTunnel.enablement", {
      enabled: this._mode.active,
      service: this._mode.active && this._mode.asService,
      tunnelName
    });
    if (this._tunnelProcess) {
      this._tunnelProcess.cancel();
      this._tunnelProcess = void 0;
    }
    let output = "";
    let isServiceInstalled = false;
    const onOutput = (a, isErr) => {
      if (isErr) {
        this._logger.error(a);
      } else {
        output += a;
      }
      if (!this.environmentService.isBuilt && a.startsWith("   Compiling")) {
        this.setTunnelStatus(TunnelStates.connecting(localize("remoteTunnelService.building", "Building CLI from sources")));
      }
    };
    const statusProcess = this.runCodeTunnelCommand("status", ["status"], onOutput);
    this._tunnelProcess = statusProcess;
    try {
      await statusProcess;
      if (this._tunnelProcess !== statusProcess) {
        return;
      }
      let status;
      try {
        status = JSON.parse(output.trim().split("\n").find((l) => l.startsWith("{")));
      } catch (e) {
        this._logger.error(`Could not parse status output: ${JSON.stringify(output.trim())}`);
        this.setTunnelStatus(TunnelStates.disconnected());
        return;
      }
      isServiceInstalled = status.service_installed;
      this._logger.info(status.tunnel ? "Other tunnel running, attaching..." : "No other tunnel running");
      if (!status.tunnel && !this._mode.active) {
        this.setTunnelStatus(TunnelStates.disconnected());
        return;
      }
    } catch (e) {
      this._logger.error(e);
      this.setTunnelStatus(TunnelStates.disconnected());
      return;
    } finally {
      if (this._tunnelProcess === statusProcess) {
        this._tunnelProcess = void 0;
      }
    }
    const session = this._mode.active ? this._mode.session : void 0;
    if (session && session.token) {
      const token = session.token;
      this.setTunnelStatus(TunnelStates.connecting(localize({ key: "remoteTunnelService.authorizing", comment: ["{0} is a user account name, {1} a provider name (e.g. Github)"] }, "Connecting as {0} ({1})", session.accountLabel, session.providerId)));
      const onLoginOutput = (a, isErr) => {
        a = a.replaceAll(token, "*".repeat(4));
        onOutput(a, isErr);
      };
      const loginProcess = this.runCodeTunnelCommand("login", ["user", "login", "--provider", session.providerId, "--log", LogLevelToString(this._logger.getLevel())], onLoginOutput, { VSCODE_CLI_ACCESS_TOKEN: token });
      this._tunnelProcess = loginProcess;
      try {
        await loginProcess;
        if (this._tunnelProcess !== loginProcess) {
          return;
        }
      } catch (e) {
        this._logger.error(e);
        this._tunnelProcess = void 0;
        this._onDidTokenFailedEmitter.fire(session);
        this.setTunnelStatus(TunnelStates.disconnected(session));
        return;
      }
    }
    const hostName = this._getTunnelName();
    if (hostName) {
      this.setTunnelStatus(TunnelStates.connecting(localize({ key: "remoteTunnelService.openTunnelWithName", comment: ["{0} is a tunnel name"] }, "Opening tunnel {0}", hostName)));
    } else {
      this.setTunnelStatus(TunnelStates.connecting(localize("remoteTunnelService.openTunnel", "Opening tunnel")));
    }
    const args = ["--accept-server-license-terms", "--log", LogLevelToString(this._logger.getLevel())];
    if (hostName) {
      args.push("--name", hostName);
    } else {
      args.push("--random-name");
    }
    let serviceInstallFailed = false;
    if (this._mode.active && this._mode.asService && !isServiceInstalled) {
      serviceInstallFailed = await this.installTunnelService(args) === false;
    }
    return this.serverOrAttachTunnel(session, args, serviceInstallFailed);
  }
  async installTunnelService(args) {
    let status;
    try {
      status = await this.runCodeTunnelCommand("serviceInstall", ["service", "install", ...args]);
    } catch (e) {
      this._logger.error(e);
      status = 1;
    }
    if (status !== 0) {
      const msg = localize("remoteTunnelService.serviceInstallFailed", "Failed to install tunnel as a service, starting in session...");
      this._logger.warn(msg);
      this.setTunnelStatus(TunnelStates.connecting(msg));
      return false;
    }
    return true;
  }
  async serverOrAttachTunnel(session, args, serviceInstallFailed) {
    args.push("--parent-process-id", String(process.pid));
    if (this._preventSleep()) {
      args.push("--no-sleep");
    }
    let isAttached = false;
    const serveCommand = this.runCodeTunnelCommand("tunnel", args, (message, isErr) => {
      if (isErr) {
        this._logger.error(message);
      } else {
        this._logger.info(message);
      }
      if (message.includes("Connected to an existing tunnel process")) {
        isAttached = true;
      }
      const m = message.match(/Open this link in your browser (https:\/\/([^\/\s]+)\/([^\/\s]+)\/([^\/\s]+))/);
      if (m) {
        const info = { link: m[1], domain: m[2], tunnelName: m[4], isAttached };
        this.telemetryService.publicLog2("remoteTunnel.connected", {
          tunnelName: info.tunnelName,
          isAttached: info.isAttached
        });
        this.setTunnelStatus(TunnelStates.connected(info, serviceInstallFailed));
      } else if (message.match(/error refreshing token/)) {
        serveCommand.cancel();
        this._onDidTokenFailedEmitter.fire(session);
        this.setTunnelStatus(TunnelStates.disconnected(session));
      }
    });
    this._tunnelProcess = serveCommand;
    serveCommand.finally(() => {
      if (serveCommand === this._tunnelProcess) {
        this._logger.info(`tunnel process terminated`);
        this._tunnelProcess = void 0;
        this._mode = INACTIVE_TUNNEL_MODE;
        this.setTunnelStatus(TunnelStates.disconnected());
      }
    });
  }
  runCodeTunnelCommand(logLabel, commandArgs, onOutput = this.defaultOnOutput, env) {
    return createCancelablePromise((token) => {
      return new Promise((resolve, reject) => {
        if (token.isCancellationRequested) {
          resolve(-1);
        }
        let tunnelProcess;
        const stdio = ["ignore", "pipe", "pipe"];
        token.onCancellationRequested(() => {
          if (tunnelProcess) {
            this._logger.info(`${logLabel} terminating(${tunnelProcess.pid})`);
            tunnelProcess.kill();
          }
        });
        if (!this.environmentService.isBuilt) {
          onOutput("Building tunnel CLI from sources and run\n", false);
          onOutput(`${logLabel} Spawning: cargo run -- tunnel ${commandArgs.join(" ")}
`, false);
          tunnelProcess = spawn("cargo", ["run", "--", "tunnel", ...commandArgs], { cwd: join(this.environmentService.appRoot, "cli"), stdio, env: { ...process.env, RUST_BACKTRACE: "1", ...env } });
        } else {
          onOutput("Running tunnel CLI\n", false);
          const tunnelCommand = this.getTunnelCommandLocation();
          onOutput(`${logLabel} Spawning: ${tunnelCommand} tunnel ${commandArgs.join(" ")}
`, false);
          tunnelProcess = spawn(tunnelCommand, ["tunnel", ...commandArgs], { cwd: homedir(), stdio, env: { ...process.env, ...env } });
        }
        tunnelProcess.stdout.pipe(new StreamSplitter("\n")).on("data", (data) => {
          if (tunnelProcess) {
            const message = data.toString();
            onOutput(message, false);
          }
        });
        tunnelProcess.stderr.pipe(new StreamSplitter("\n")).on("data", (data) => {
          if (tunnelProcess) {
            const message = data.toString();
            onOutput(message, true);
          }
        });
        tunnelProcess.on("exit", (e) => {
          if (tunnelProcess) {
            onOutput(`${logLabel} exit(${tunnelProcess.pid}): + ${e} `, false);
            tunnelProcess = void 0;
            resolve(e || 0);
          }
        });
        tunnelProcess.on("error", (e) => {
          if (tunnelProcess) {
            onOutput(`${logLabel} error(${tunnelProcess.pid}): + ${e} `, true);
            tunnelProcess = void 0;
            reject();
          }
        });
      });
    });
  }
  async getTunnelName() {
    return this._getTunnelName();
  }
  _preventSleep() {
    return !!this.configurationService.getValue(CONFIGURATION_KEY_PREVENT_SLEEP);
  }
  _getTunnelName() {
    const configured = this.configurationService.getValue(CONFIGURATION_KEY_HOST_NAME);
    return (configured ? normalizeTunnelName(configured) : tunnelNameFromHostname(hostname())) || void 0;
  }
  _restoreMode() {
    try {
      const tunnelAccessSession = this.storageService.get(TUNNEL_ACCESS_SESSION, StorageScope.APPLICATION);
      const asService = this.storageService.getBoolean(TUNNEL_ACCESS_IS_SERVICE, StorageScope.APPLICATION, false);
      if (tunnelAccessSession) {
        const session = JSON.parse(tunnelAccessSession);
        if (session && isString(session.accountLabel) && isString(session.sessionId) && isString(session.providerId)) {
          return { active: true, session, asService };
        }
        this._logger.error("Problems restoring session from storage, invalid format", session);
      }
    } catch (e) {
      this._logger.error("Problems restoring session from storage", e);
    }
    return INACTIVE_TUNNEL_MODE;
  }
  _storeMode(mode) {
    if (mode.active) {
      const sessionWithoutToken = {
        providerId: mode.session.providerId,
        sessionId: mode.session.sessionId,
        accountLabel: mode.session.accountLabel
      };
      this.storageService.store(TUNNEL_ACCESS_SESSION, JSON.stringify(sessionWithoutToken), StorageScope.APPLICATION, StorageTarget.MACHINE);
      this.storageService.store(TUNNEL_ACCESS_IS_SERVICE, mode.asService, StorageScope.APPLICATION, StorageTarget.MACHINE);
    } else {
      this.storageService.remove(TUNNEL_ACCESS_SESSION, StorageScope.APPLICATION);
      this.storageService.remove(TUNNEL_ACCESS_IS_SERVICE, StorageScope.APPLICATION);
    }
  }
};
RemoteTunnelService = __decorateClass([
  __decorateParam(0, ITelemetryService),
  __decorateParam(1, IProductService),
  __decorateParam(2, INativeEnvironmentService),
  __decorateParam(3, ILoggerService),
  __decorateParam(4, ISharedProcessLifecycleService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IStorageService)
], RemoteTunnelService);
function isSameSession(a1, a2) {
  if (a1 && a2) {
    return a1.sessionId === a2.sessionId && a1.providerId === a2.providerId && a1.token === a2.token;
  }
  return a1 === a2;
}
const isSameMode = (a, b) => {
  if (a.active !== b.active) {
    return false;
  } else if (a.active && b.active) {
    return a.asService === b.asService && isSameSession(a.session, b.session);
  } else {
    return true;
  }
};
export {
  RemoteTunnelService
};
