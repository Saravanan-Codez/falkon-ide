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
import { Emitter, Event } from "../../../../base/common/event.js";
import { Disposable, dispose, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { isMacintosh, isWindows, OperatingSystem, OS } from "../../../../base/common/platform.js";
import { localize } from "../../../../nls.js";
import { formatMessageForTerminal } from "../../../../platform/terminal/common/terminalStrings.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { getRemoteAuthority } from "../../../../platform/remote/common/remoteHosts.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { TerminalCapability } from "../../../../platform/terminal/common/capabilities/capabilities.js";
import { NaiveCwdDetectionCapability } from "../../../../platform/terminal/common/capabilities/naiveCwdDetectionCapability.js";
import { TerminalCapabilityStore } from "../../../../platform/terminal/common/capabilities/terminalCapabilityStore.js";
import { FlowControlConstants, ITerminalLogService, ProcessPropertyType, TerminalSettingId } from "../../../../platform/terminal/common/terminal.js";
import { TerminalRecorder } from "../../../../platform/terminal/common/terminalRecorder.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { EnvironmentVariableInfoChangesActive, EnvironmentVariableInfoStale } from "./environmentVariableInfo.js";
import { ITerminalConfigurationService, ITerminalInstanceService, ITerminalService } from "./terminal.js";
import { IEnvironmentVariableService } from "../common/environmentVariable.js";
import { MergedEnvironmentVariableCollection } from "../../../../platform/terminal/common/environmentVariableCollection.js";
import { serializeEnvironmentVariableCollections } from "../../../../platform/terminal/common/environmentVariableShared.js";
import { ITerminalProfileResolverService, ProcessState } from "../common/terminal.js";
import * as terminalEnvironment from "../common/terminalEnvironment.js";
import { IConfigurationResolverService } from "../../../services/configurationResolver/common/configurationResolver.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { IHistoryService } from "../../../services/history/common/history.js";
import { IPathService } from "../../../services/path/common/pathService.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
import { TaskSettingId } from "../../tasks/common/tasks.js";
import Severity from "../../../../base/common/severity.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { getActiveWindow, runWhenWindowIdle } from "../../../../base/browser/dom.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { shouldUseEnvironmentVariableCollection } from "../../../../platform/terminal/common/terminalEnvironment.js";
import { TerminalContribSettingId } from "../terminalContribExports.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { BugIndicatingError } from "../../../../base/common/errors.js";
import { isString } from "../../../../base/common/types.js";
var ProcessConstants = /* @__PURE__ */ ((ProcessConstants2) => {
  ProcessConstants2[ProcessConstants2["ErrorLaunchThresholdDuration"] = 500] = "ErrorLaunchThresholdDuration";
  ProcessConstants2[ProcessConstants2["LatencyMeasuringInterval"] = 1e3] = "LatencyMeasuringInterval";
  return ProcessConstants2;
})(ProcessConstants || {});
var ProcessType = /* @__PURE__ */ ((ProcessType2) => {
  ProcessType2[ProcessType2["Process"] = 0] = "Process";
  ProcessType2[ProcessType2["PsuedoTerminal"] = 1] = "PsuedoTerminal";
  return ProcessType2;
})(ProcessType || {});
let TerminalProcessManager = class extends Disposable {
  constructor(_instanceId, cwd, environmentVariableCollections, shellIntegrationNonce, _historyService, _instantiationService, _logService, _workspaceContextService, _configurationResolverService, _workbenchEnvironmentService, _productService, _remoteAgentService, _pathService, _environmentVariableService, _terminalConfigurationService, _terminalProfileResolverService, _configurationService, _terminalInstanceService, _telemetryService, _notificationService, _accessibilityService, _terminalService) {
    super();
    this._instanceId = _instanceId;
    this._historyService = _historyService;
    this._instantiationService = _instantiationService;
    this._logService = _logService;
    this._workspaceContextService = _workspaceContextService;
    this._configurationResolverService = _configurationResolverService;
    this._workbenchEnvironmentService = _workbenchEnvironmentService;
    this._productService = _productService;
    this._remoteAgentService = _remoteAgentService;
    this._pathService = _pathService;
    this._environmentVariableService = _environmentVariableService;
    this._terminalConfigurationService = _terminalConfigurationService;
    this._terminalProfileResolverService = _terminalProfileResolverService;
    this._configurationService = _configurationService;
    this._terminalInstanceService = _terminalInstanceService;
    this._telemetryService = _telemetryService;
    this._notificationService = _notificationService;
    this._accessibilityService = _accessibilityService;
    this._terminalService = _terminalService;
    this.processState = ProcessState.Uninitialized;
    this.capabilities = this._register(new TerminalCapabilityStore());
    this.processReadyTimestamp = 0;
    this._isDisposed = false;
    this._process = null;
    this._processType = 0 /* Process */;
    this._preLaunchInputQueue = [];
    this._environmentVariableCollectionListener = this._register(new MutableDisposable());
    this._hasWrittenData = false;
    this._hasChildProcesses = false;
    this._ptyListenersAttached = false;
    this._isDisconnected = false;
    this._dimensions = { cols: 0, rows: 0 };
    this._onPtyDisconnect = this._register(new Emitter());
    this.onPtyDisconnect = this._onPtyDisconnect.event;
    this._onPtyReconnect = this._register(new Emitter());
    this.onPtyReconnect = this._onPtyReconnect.event;
    this._onProcessReady = this._register(new Emitter());
    this.onProcessReady = this._onProcessReady.event;
    this._onProcessStateChange = this._register(new Emitter());
    this.onProcessStateChange = this._onProcessStateChange.event;
    this._onBeforeProcessData = this._register(new Emitter());
    this.onBeforeProcessData = this._onBeforeProcessData.event;
    this._onProcessData = this._register(new Emitter());
    this.onProcessData = this._onProcessData.event;
    this._onProcessReplayComplete = this._register(new Emitter());
    this.onProcessReplayComplete = this._onProcessReplayComplete.event;
    this._onDidChangeProperty = this._register(new Emitter());
    this.onDidChangeProperty = this._onDidChangeProperty.event;
    this._onEnvironmentVariableInfoChange = this._register(new Emitter());
    this.onEnvironmentVariableInfoChanged = this._onEnvironmentVariableInfoChange.event;
    this._onProcessExit = this._register(new Emitter());
    this.onProcessExit = this._onProcessExit.event;
    this._onRestoreCommands = this._register(new Emitter());
    this.onRestoreCommands = this._onRestoreCommands.event;
    this._cwdWorkspaceFolder = terminalEnvironment.getWorkspaceForTerminal(cwd, this._workspaceContextService, this._historyService);
    this.ptyProcessReady = this._createPtyProcessReadyPromise();
    this._ackDataBufferer = new AckDataBufferer((e) => this._process?.acknowledgeDataEvent(e));
    this._dataFilter = this._register(this._instantiationService.createInstance(SeamlessRelaunchDataFilter));
    this._register(this._dataFilter.onProcessData((ev) => {
      const data = isString(ev) ? ev : ev.data;
      const beforeProcessDataEvent = { data };
      this._onBeforeProcessData.fire(beforeProcessDataEvent);
      if (beforeProcessDataEvent.data && beforeProcessDataEvent.data.length > 0) {
        if (!isString(ev)) {
          ev.data = beforeProcessDataEvent.data;
        }
        this._onProcessData.fire(!isString(ev) ? ev : { data: beforeProcessDataEvent.data, trackCommit: false });
      }
    }));
    if (cwd && typeof cwd === "object") {
      this.remoteAuthority = getRemoteAuthority(cwd);
    } else {
      this.remoteAuthority = this._workbenchEnvironmentService.remoteAuthority;
    }
    if (environmentVariableCollections) {
      this._extEnvironmentVariableCollection = new MergedEnvironmentVariableCollection(environmentVariableCollections);
      this._environmentVariableCollectionListener.value = this._environmentVariableService.onDidChangeCollections((newCollection) => this._onEnvironmentVariableCollectionChange(newCollection));
      this.environmentVariableInfo = this._instantiationService.createInstance(EnvironmentVariableInfoChangesActive, this._extEnvironmentVariableCollection);
      this._onEnvironmentVariableInfoChange.fire(this.environmentVariableInfo);
    }
    this.shellIntegrationNonce = shellIntegrationNonce ?? generateUuid();
  }
  get persistentProcessId() {
    return this._process?.id;
  }
  get shouldPersist() {
    return !!this.reconnectionProperties || (this._process ? this._process.shouldPersist : false);
  }
  get hasWrittenData() {
    return this._hasWrittenData;
  }
  get hasChildProcesses() {
    return this._hasChildProcesses;
  }
  get reconnectionProperties() {
    return this._shellLaunchConfig?.attachPersistentProcess?.reconnectionProperties || this._shellLaunchConfig?.reconnectionProperties || void 0;
  }
  get extEnvironmentVariableCollection() {
    return this._extEnvironmentVariableCollection;
  }
  get processTraits() {
    return this._processTraits;
  }
  async freePortKillProcess(port) {
    try {
      if (this._process?.freePortKillProcess) {
        await this._process?.freePortKillProcess(port);
      }
    } catch (e) {
      this._notificationService.notify({ message: localize("killportfailure", "Could not kill process listening on port {0}, command exited with error {1}", port, e), severity: Severity.Warning });
    }
  }
  dispose(immediate = false) {
    this._isDisposed = true;
    if (this._process) {
      this._setProcessState(ProcessState.KilledByUser);
      this._process.shutdown(immediate);
      this._process = null;
    }
    if (this._processListeners) {
      dispose(this._processListeners);
      this._processListeners = void 0;
    }
    super.dispose();
  }
  _createPtyProcessReadyPromise() {
    return new Promise((c) => {
      const listener = Event.once(this.onProcessReady)(() => {
        this._logService.debug(`Terminal process ready (shellProcessId: ${this.shellProcessId})`);
        this._store.delete(listener);
        c(void 0);
      });
      this._store.add(listener);
    });
  }
  async detachFromProcess(forcePersist) {
    await this._process?.detach?.(forcePersist);
    this._process = null;
  }
  async createProcess(shellLaunchConfig, cols, rows, reset = true) {
    this._shellLaunchConfig = shellLaunchConfig;
    this._dimensions.cols = cols;
    this._dimensions.rows = rows;
    let newProcess;
    if (shellLaunchConfig.customPtyImplementation) {
      this._processType = 1 /* PsuedoTerminal */;
      newProcess = shellLaunchConfig.customPtyImplementation(this._instanceId, cols, rows);
    } else {
      const backend = await this._terminalInstanceService.getBackend(this.remoteAuthority);
      if (!backend) {
        throw new Error(`No terminal backend registered for remote authority '${this.remoteAuthority}'`);
      }
      this.backend = backend;
      const envForResolver = { ...await this._terminalProfileResolverService.getEnvironment(this.remoteAuthority) };
      terminalEnvironment.mergeEnvironments(envForResolver, await backend.getShellEnvironment());
      const variableResolver = terminalEnvironment.createVariableResolver(this._cwdWorkspaceFolder, envForResolver, this._configurationResolverService);
      this.userHome = this._pathService.resolvedUserHome?.fsPath;
      this.os = OS;
      if (!!this.remoteAuthority) {
        const userHomeUri = await this._pathService.userHome();
        this.userHome = userHomeUri.path;
        const remoteEnv = await this._remoteAgentService.getEnvironment();
        if (!remoteEnv) {
          throw new Error(`Failed to get remote environment for remote authority "${this.remoteAuthority}"`);
        }
        this.userHome = remoteEnv.userHome.path;
        this.os = remoteEnv.os;
        const env = await this._resolveEnvironment(backend, variableResolver, shellLaunchConfig);
        const shouldPersist = (this._configurationService.getValue(TaskSettingId.Reconnection) && shellLaunchConfig.reconnectionProperties || !shellLaunchConfig.isFeatureTerminal) && this._terminalConfigurationService.config.enablePersistentSessions && !shellLaunchConfig.isTransient;
        if (shellLaunchConfig.attachPersistentProcess) {
          const result2 = await backend.attachToProcess(shellLaunchConfig.attachPersistentProcess.id);
          if (result2) {
            newProcess = result2;
          } else {
            this._logService.warn(`Attach to process failed for terminal`, shellLaunchConfig.attachPersistentProcess);
            shellLaunchConfig.attachPersistentProcess = void 0;
          }
        }
        if (!newProcess) {
          await this._terminalProfileResolverService.resolveShellLaunchConfig(shellLaunchConfig, {
            remoteAuthority: this.remoteAuthority,
            os: this.os
          });
          const options = {
            shellIntegration: {
              enabled: this._configurationService.getValue(TerminalSettingId.ShellIntegrationEnabled),
              suggestEnabled: this._configurationService.getValue(TerminalContribSettingId.SuggestEnabled),
              nonce: this.shellIntegrationNonce
            },
            windowsUseConptyDll: this._terminalConfigurationService.config.windowsUseConptyDll ?? false,
            environmentVariableCollections: this._extEnvironmentVariableCollection?.collections ? serializeEnvironmentVariableCollections(this._extEnvironmentVariableCollection.collections) : void 0,
            workspaceFolder: this._cwdWorkspaceFolder,
            isScreenReaderOptimized: this._accessibilityService.isScreenReaderOptimized()
          };
          try {
            newProcess = await backend.createProcess(
              shellLaunchConfig,
              "",
              // TODO: Fix cwd
              cols,
              rows,
              this._terminalConfigurationService.config.unicodeVersion,
              env,
              // TODO:
              options,
              shouldPersist
            );
          } catch (e) {
            if (e?.message === "Could not fetch remote environment") {
              this._logService.trace(`Could not fetch remote environment, silently failing`);
              return void 0;
            }
            throw e;
          }
        }
        if (!this._isDisposed) {
          this._setupPtyHostListeners(backend);
        }
      } else {
        if (shellLaunchConfig.attachPersistentProcess) {
          const result2 = shellLaunchConfig.attachPersistentProcess.findRevivedId ? await backend.attachToRevivedProcess(shellLaunchConfig.attachPersistentProcess.id) : await backend.attachToProcess(shellLaunchConfig.attachPersistentProcess.id);
          if (result2) {
            newProcess = result2;
          } else {
            this._logService.warn(`Attach to process failed for terminal`, shellLaunchConfig.attachPersistentProcess);
            shellLaunchConfig.attachPersistentProcess = void 0;
          }
        }
        if (!newProcess) {
          newProcess = await this._launchLocalProcess(backend, shellLaunchConfig, cols, rows, this.userHome, variableResolver);
        }
        if (!this._isDisposed) {
          this._setupPtyHostListeners(backend);
        }
      }
    }
    if (this._isDisposed) {
      newProcess.shutdown(false);
      return void 0;
    }
    this._process = newProcess;
    this._setProcessState(ProcessState.Launching);
    if (this.os === OperatingSystem.Linux || this.os === OperatingSystem.Macintosh) {
      this.capabilities.add(TerminalCapability.NaiveCwdDetection, new NaiveCwdDetectionCapability(this._process));
    }
    this._dataFilter.newProcess(this._process, reset);
    if (this._processListeners) {
      dispose(this._processListeners);
    }
    this._processListeners = [
      newProcess.onProcessReady((e) => {
        this._logService.debug("onProcessReady", e);
        this._processTraits = e;
        this.shellProcessId = e.pid;
        this._initialCwd = e.cwd;
        this.processReadyTimestamp = Date.now();
        this._onDidChangeProperty.fire({ type: ProcessPropertyType.InitialCwd, value: this._initialCwd });
        this._onProcessReady.fire(e);
        if (this._preLaunchInputQueue.length > 0 && this._process) {
          this._logService.debug("sending prelaunch input queue", this._preLaunchInputQueue);
          newProcess.input(this._preLaunchInputQueue.join(""));
          this._preLaunchInputQueue.length = 0;
        }
      }),
      newProcess.onProcessExit((exitCode) => this._onExit(exitCode)),
      newProcess.onDidChangeProperty(({ type, value }) => {
        switch (type) {
          case ProcessPropertyType.HasChildProcesses:
            this._hasChildProcesses = value;
            break;
          case ProcessPropertyType.FailedShellIntegrationActivation:
            this._telemetryService?.publicLog2("terminal/shellIntegrationActivationFailureCustomArgs");
            break;
        }
        this._onDidChangeProperty.fire({ type, value });
      })
    ];
    if (newProcess.onProcessReplayComplete) {
      this._processListeners.push(newProcess.onProcessReplayComplete(() => this._onProcessReplayComplete.fire()));
    }
    if (newProcess.onRestoreCommands) {
      this._processListeners.push(newProcess.onRestoreCommands((e) => this._onRestoreCommands.fire(e)));
    }
    setTimeout(() => {
      if (this.processState === ProcessState.Launching) {
        this._setProcessState(ProcessState.Running);
      }
    }, 500 /* ErrorLaunchThresholdDuration */);
    const result = await newProcess.start();
    if (result) {
      return result;
    }
    runWhenWindowIdle(getActiveWindow(), () => {
      this.backend?.getLatency().then((measurements) => {
        this._logService.info(`Latency measurements for ${this.remoteAuthority ?? "local"} backend
${measurements.map((e) => `${e.label}: ${e.latency.toFixed(2)}ms`).join("\n")}`);
      });
    });
    return void 0;
  }
  async relaunch(shellLaunchConfig, cols, rows, reset) {
    this.ptyProcessReady = this._createPtyProcessReadyPromise();
    this._logService.trace(`Relaunching terminal instance ${this._instanceId}`);
    if (this._isDisconnected) {
      this._isDisconnected = false;
      this._onPtyReconnect.fire();
    }
    this._hasWrittenData = false;
    return this.createProcess(shellLaunchConfig, cols, rows, reset);
  }
  // Fetch any extension environment additions and apply them
  async _resolveEnvironment(backend, variableResolver, shellLaunchConfig) {
    const workspaceFolder = terminalEnvironment.getWorkspaceForTerminal(shellLaunchConfig.cwd, this._workspaceContextService, this._historyService);
    const platformKey = isWindows ? "windows" : isMacintosh ? "osx" : "linux";
    const envFromConfigValue = this._configurationService.getValue(`terminal.integrated.env.${platformKey}`);
    this._logService.debug(`Resolving environment (useShellEnvironment=${shellLaunchConfig.useShellEnvironment}, platformKey=${platformKey}, envFromConfig=${envFromConfigValue ? Object.keys(envFromConfigValue).join(",") : "none"})`);
    let baseEnv;
    if (shellLaunchConfig.useShellEnvironment) {
      const shellEnv = await backend.getShellEnvironment();
      if (!shellEnv) {
        throw new BugIndicatingError("Cannot fetch shell environment to use");
      }
      this._logService.debug(`Shell environment resolved with ${Object.keys(shellEnv).length} variables: ${Object.keys(shellEnv).sort().join(", ")}`);
      baseEnv = shellEnv;
    } else {
      baseEnv = await this._terminalProfileResolverService.getEnvironment(this.remoteAuthority);
      this._logService.debug(`Profile environment resolved with ${Object.keys(baseEnv).length} variables`);
    }
    const env = await terminalEnvironment.createTerminalEnvironment(shellLaunchConfig, envFromConfigValue, variableResolver, this._productService.version, this._terminalConfigurationService.config.detectLocale, baseEnv);
    this._logService.debug(`Terminal environment created with ${Object.keys(env).length} variables: ${Object.keys(env).sort().join(", ")}`);
    this._environmentVariableCollectionListener.clear();
    if (!this._isDisposed && shouldUseEnvironmentVariableCollection(shellLaunchConfig)) {
      this._extEnvironmentVariableCollection = this._environmentVariableService.mergedCollection;
      this._environmentVariableCollectionListener.value = this._environmentVariableService.onDidChangeCollections((newCollection) => this._onEnvironmentVariableCollectionChange(newCollection));
      await this._extEnvironmentVariableCollection.applyToProcessEnvironment(env, { workspaceFolder }, variableResolver);
      if (this._extEnvironmentVariableCollection.getVariableMap({ workspaceFolder }).size) {
        this.environmentVariableInfo = this._instantiationService.createInstance(EnvironmentVariableInfoChangesActive, this._extEnvironmentVariableCollection);
        this._onEnvironmentVariableInfoChange.fire(this.environmentVariableInfo);
      }
    }
    return env;
  }
  async _launchLocalProcess(backend, shellLaunchConfig, cols, rows, userHome, variableResolver) {
    await this._terminalProfileResolverService.resolveShellLaunchConfig(shellLaunchConfig, {
      remoteAuthority: void 0,
      os: OS
    });
    const activeWorkspaceRootUri = this._historyService.getLastActiveWorkspaceRoot(Schemas.file);
    const initialCwd = await terminalEnvironment.getCwd(
      shellLaunchConfig,
      userHome,
      variableResolver,
      activeWorkspaceRootUri,
      this._terminalConfigurationService.config.cwd,
      this._logService
    );
    const env = await this._resolveEnvironment(backend, variableResolver, shellLaunchConfig);
    const options = {
      shellIntegration: {
        enabled: this._configurationService.getValue(TerminalSettingId.ShellIntegrationEnabled),
        suggestEnabled: this._configurationService.getValue(TerminalContribSettingId.SuggestEnabled),
        nonce: this.shellIntegrationNonce
      },
      windowsUseConptyDll: this._terminalConfigurationService.config.windowsUseConptyDll ?? false,
      environmentVariableCollections: this._extEnvironmentVariableCollection ? serializeEnvironmentVariableCollections(this._extEnvironmentVariableCollection.collections) : void 0,
      workspaceFolder: this._cwdWorkspaceFolder,
      isScreenReaderOptimized: this._accessibilityService.isScreenReaderOptimized()
    };
    const shouldPersist = (this._configurationService.getValue(TaskSettingId.Reconnection) && shellLaunchConfig.reconnectionProperties || !shellLaunchConfig.isFeatureTerminal) && this._terminalConfigurationService.config.enablePersistentSessions && !shellLaunchConfig.isTransient;
    return await backend.createProcess(shellLaunchConfig, initialCwd, cols, rows, this._terminalConfigurationService.config.unicodeVersion, env, options, shouldPersist);
  }
  _setupPtyHostListeners(backend) {
    if (this._ptyListenersAttached) {
      return;
    }
    this._ptyListenersAttached = true;
    this._register(backend.onPtyHostUnresponsive(() => {
      this._isDisconnected = true;
      this._onPtyDisconnect.fire();
    }));
    this._ptyResponsiveListener = backend.onPtyHostResponsive(() => {
      this._isDisconnected = false;
      this._onPtyReconnect.fire();
    });
    this._register(toDisposable(() => this._ptyResponsiveListener?.dispose()));
    this._register(backend.onPtyHostRestart(async () => {
      if (!this._isDisconnected) {
        this._isDisconnected = true;
        this._onPtyDisconnect.fire();
      }
      this._ptyResponsiveListener?.dispose();
      this._ptyResponsiveListener = void 0;
      if (this._shellLaunchConfig) {
        if (this._shellLaunchConfig.isFeatureTerminal && !this.reconnectionProperties) {
          this._onExit(-1);
        } else {
          const message = localize("ptyHostRelaunch", "Restarting the terminal because the connection to the shell process was lost...");
          let postRestartMessage = "";
          if (this.os === OperatingSystem.Windows && this._dimensions.rows > 0) {
            postRestartMessage = "\r\n".repeat(this._dimensions.rows - 1) + `\x1B[H`;
          }
          this._onProcessData.fire({ data: formatMessageForTerminal(message, { loudFormatting: true }) + postRestartMessage, trackCommit: false });
          await this.relaunch(this._shellLaunchConfig, this._dimensions.cols, this._dimensions.rows, false);
        }
      }
    }));
    this._register(toDisposable(() => {
      this.ptyProcessReady = void 0;
    }));
  }
  async getBackendOS() {
    let os = OS;
    if (!!this.remoteAuthority) {
      const remoteEnv = await this._remoteAgentService.getEnvironment();
      if (!remoteEnv) {
        throw new Error(`Failed to get remote environment for remote authority "${this.remoteAuthority}"`);
      }
      os = remoteEnv.os;
    }
    return os;
  }
  setDimensions(cols, rows, sync, pixelWidth, pixelHeight) {
    if (sync) {
      this._resize(cols, rows, pixelWidth, pixelHeight);
      return;
    }
    if (this._store.isDisposed) {
      return Promise.resolve();
    }
    if (!this.ptyProcessReady) {
      throw new Error("TerminalProcessManager.setDimensions called before initialization");
    }
    return this.ptyProcessReady.then(() => this._resize(cols, rows, pixelWidth, pixelHeight));
  }
  async setUnicodeVersion(version) {
    return this._process?.setUnicodeVersion(version);
  }
  async setNextCommandId(commandLine, commandId) {
    await this.ptyProcessReady;
    const process = this._process;
    if (!process?.id) {
      return;
    }
    await this._terminalService.setNextCommandId(process.id, commandLine, commandId);
  }
  _resize(cols, rows, pixelWidth, pixelHeight) {
    if (!this._process) {
      return;
    }
    try {
      this._process.resize(cols, rows, pixelWidth, pixelHeight);
    } catch (error) {
      if (error.code !== "EPIPE" && error.code !== "ERR_IPC_CHANNEL_CLOSED") {
        throw error;
      }
    }
    this._dimensions.cols = cols;
    this._dimensions.rows = rows;
  }
  async write(data) {
    await this.ptyProcessReady;
    this._dataFilter.disableSeamlessRelaunch();
    this._hasWrittenData = true;
    if (this.shellProcessId || this._processType === 1 /* PsuedoTerminal */) {
      if (this._process) {
        this._process.input(data);
      }
    } else {
      this._logService.debug("queueing data in prelaunch input queue", data);
      this._preLaunchInputQueue.push(data);
    }
  }
  async sendSignal(signal) {
    await this.ptyProcessReady;
    if (this._process) {
      this._process.sendSignal(signal);
    }
  }
  async processBinary(data) {
    await this.ptyProcessReady;
    this._dataFilter.disableSeamlessRelaunch();
    this._hasWrittenData = true;
    this._process?.processBinary(data);
  }
  get initialCwd() {
    return this._initialCwd ?? "";
  }
  async refreshProperty(type) {
    if (!this._process) {
      throw new Error("Cannot refresh property when process is not set");
    }
    return this._process.refreshProperty(type);
  }
  async updateProperty(type, value) {
    return this._process?.updateProperty(type, value);
  }
  acknowledgeDataEvent(charCount) {
    this._ackDataBufferer.ack(charCount);
  }
  _onExit(exitCode) {
    this._process = null;
    if (this.processState === ProcessState.Launching) {
      this._setProcessState(ProcessState.KilledDuringLaunch);
    }
    if (this.processState === ProcessState.Running) {
      this._setProcessState(ProcessState.KilledByProcess);
    }
    this._onProcessExit.fire(exitCode);
  }
  _setProcessState(state) {
    this.processState = state;
    this._onProcessStateChange.fire();
  }
  _onEnvironmentVariableCollectionChange(newCollection) {
    const diff = this._extEnvironmentVariableCollection.diff(newCollection, { workspaceFolder: this._cwdWorkspaceFolder });
    if (diff === void 0) {
      if (this.environmentVariableInfo instanceof EnvironmentVariableInfoStale) {
        this.environmentVariableInfo = this._instantiationService.createInstance(EnvironmentVariableInfoChangesActive, this._extEnvironmentVariableCollection);
        this._onEnvironmentVariableInfoChange.fire(this.environmentVariableInfo);
      }
      return;
    }
    this.environmentVariableInfo = this._instantiationService.createInstance(EnvironmentVariableInfoStale, diff, this._instanceId, newCollection);
    this._onEnvironmentVariableInfoChange.fire(this.environmentVariableInfo);
  }
  async clearBuffer() {
    this._process?.clearBuffer?.();
  }
};
TerminalProcessManager = __decorateClass([
  __decorateParam(4, IHistoryService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, ITerminalLogService),
  __decorateParam(7, IWorkspaceContextService),
  __decorateParam(8, IConfigurationResolverService),
  __decorateParam(9, IWorkbenchEnvironmentService),
  __decorateParam(10, IProductService),
  __decorateParam(11, IRemoteAgentService),
  __decorateParam(12, IPathService),
  __decorateParam(13, IEnvironmentVariableService),
  __decorateParam(14, ITerminalConfigurationService),
  __decorateParam(15, ITerminalProfileResolverService),
  __decorateParam(16, IConfigurationService),
  __decorateParam(17, ITerminalInstanceService),
  __decorateParam(18, ITelemetryService),
  __decorateParam(19, INotificationService),
  __decorateParam(20, IAccessibilityService),
  __decorateParam(21, ITerminalService)
], TerminalProcessManager);
class AckDataBufferer {
  constructor(_callback) {
    this._callback = _callback;
    this._unsentCharCount = 0;
  }
  ack(charCount) {
    this._unsentCharCount += charCount;
    while (this._unsentCharCount > FlowControlConstants.CharCountAckSize) {
      this._unsentCharCount -= FlowControlConstants.CharCountAckSize;
      this._callback(FlowControlConstants.CharCountAckSize);
    }
  }
}
var SeamlessRelaunchConstants = /* @__PURE__ */ ((SeamlessRelaunchConstants2) => {
  SeamlessRelaunchConstants2[SeamlessRelaunchConstants2["RecordTerminalDuration"] = 1e4] = "RecordTerminalDuration";
  SeamlessRelaunchConstants2[SeamlessRelaunchConstants2["SwapWaitMaximumDuration"] = 3e3] = "SwapWaitMaximumDuration";
  return SeamlessRelaunchConstants2;
})(SeamlessRelaunchConstants || {});
let SeamlessRelaunchDataFilter = class extends Disposable {
  constructor(_logService) {
    super();
    this._logService = _logService;
    this._firstDisposable = this._register(new MutableDisposable());
    this._secondDisposable = this._register(new MutableDisposable());
    this._dataListener = this._register(new MutableDisposable());
    this._disableSeamlessRelaunch = false;
    this._onProcessData = this._register(new Emitter());
  }
  get onProcessData() {
    return this._onProcessData.event;
  }
  newProcess(process, reset) {
    this._dataListener.clear();
    this._activeProcess?.shutdown(false);
    this._activeProcess = process;
    if (!this._firstRecorder || !reset || this._disableSeamlessRelaunch) {
      [this._firstRecorder, this._firstDisposable.value] = this._createRecorder(process);
      if (this._disableSeamlessRelaunch && reset) {
        this._onProcessData.fire("\x1Bc");
      }
      this._dataListener.value = process.onProcessData((e) => this._onProcessData.fire(e));
      this._disableSeamlessRelaunch = false;
      return;
    }
    if (this._secondRecorder) {
      this.triggerSwap();
    }
    this._swapTimeout = mainWindow.setTimeout(() => this.triggerSwap(), 3e3 /* SwapWaitMaximumDuration */);
    this._dataListener.clear();
    this._firstDisposable.clear();
    const recorder = this._createRecorder(process);
    [this._secondRecorder, this._secondDisposable.value] = recorder;
  }
  /**
   * Disables seamless relaunch for the active process
   */
  disableSeamlessRelaunch() {
    this._disableSeamlessRelaunch = true;
    this._stopRecording();
    this.triggerSwap();
  }
  /**
   * Trigger the swap of the processes if needed (eg. timeout, input)
   */
  triggerSwap() {
    if (this._swapTimeout) {
      mainWindow.clearTimeout(this._swapTimeout);
      this._swapTimeout = void 0;
    }
    if (!this._firstRecorder) {
      return;
    }
    if (!this._secondRecorder) {
      this._firstRecorder = void 0;
      this._firstDisposable.clear();
      return;
    }
    const firstData = this._getDataFromRecorder(this._firstRecorder);
    const secondData = this._getDataFromRecorder(this._secondRecorder);
    if (firstData === secondData) {
      this._logService.trace(`Seamless terminal relaunch - identical content`);
    } else {
      this._logService.trace(`Seamless terminal relaunch - resetting content`);
      this._onProcessData.fire({ data: `\x1Bc${secondData}`, trackCommit: false });
    }
    this._dataListener.value = this._activeProcess.onProcessData((e) => this._onProcessData.fire(e));
    this._firstRecorder = this._secondRecorder;
    this._firstDisposable.value = this._secondDisposable.value;
    this._secondRecorder = void 0;
  }
  _stopRecording() {
    if (this._swapTimeout) {
      return;
    }
    this._firstRecorder = void 0;
    this._firstDisposable.clear();
    this._secondRecorder = void 0;
    this._secondDisposable.clear();
  }
  _createRecorder(process) {
    const recorder = new TerminalRecorder(0, 0);
    const disposable = process.onProcessData((e) => recorder.handleData(isString(e) ? e : e.data));
    return [recorder, disposable];
  }
  _getDataFromRecorder(recorder) {
    return recorder.generateReplayEventSync().events.filter((e) => !!e.data).map((e) => e.data).join("");
  }
};
SeamlessRelaunchDataFilter = __decorateClass([
  __decorateParam(0, ITerminalLogService)
], SeamlessRelaunchDataFilter);
export {
  TerminalProcessManager
};
