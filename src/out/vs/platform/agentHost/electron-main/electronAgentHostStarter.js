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
import { Disposable, DisposableMap, DisposableStore, toDisposable } from "../../../base/common/lifecycle.js";
import { DeferredPromise } from "../../../base/common/async.js";
import { Emitter } from "../../../base/common/event.js";
import { validatedIpcMain } from "../../../base/parts/ipc/electron-main/ipcMain.js";
import { Client as MessagePortClient } from "../../../base/parts/ipc/electron-main/ipc.mp.js";
import { AiAgentEnvValue, AiAgentEnvVar } from "../../chat/common/aiAgentEnv.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { IEnvironmentMainService } from "../../environment/electron-main/environmentMainService.js";
import { parseAgentHostDebugPort } from "../../environment/node/environmentService.js";
import { ILifecycleMainService } from "../../lifecycle/electron-main/lifecycleMainService.js";
import { ILogService } from "../../log/common/log.js";
import { Schemas } from "../../../base/common/network.js";
import { getResolvedShellEnv } from "../../shell/node/shellEnv.js";
import { NullTelemetryService } from "../../telemetry/common/telemetryUtils.js";
import { UtilityProcess } from "../../utilityProcess/electron-main/utilityProcess.js";
import { buildAgentHostTelemetryIdEnv } from "../common/agentHostTelemetryEnv.js";
import { AgentHostLaunchKind, AgentHostLaunchKindEnvVar } from "../common/agentHostTelemetry.js";
import { AgentHostByokModelsEnabledSettingId, AgentHostClaudeAgentEnabledSettingId, AgentHostCodexAgentBinaryArgsSettingId, AgentHostCodexAgentEnabledSettingId, AgentHostCodexAgentSdkRootSettingId, AgentHostCodexAgentCodexHomeSettingId, AgentHostOTelCaptureContentSettingId, AgentHostOTelDbSpanExporterEnabledSettingId, AgentHostOTelEnabledSettingId, AgentHostOTelExporterTypeSettingId, AgentHostOTelOtlpEndpointSettingId, AgentHostOTelOtlpProtocolSettingId, AgentHostOTelOutfileSettingId, AgentHostOTelResourceAttributesSettingId, AgentHostOTelServiceNameSettingId, AgentHostOTelPolicyIpcChannel, AgentHostRestartIpcChannel, AgentHostWillRestartIpcChannel, buildAgentHostOTelEnv, buildAgentSdkEnv, sanitizeAgentHostOTelPolicySettings } from "../common/agentService.js";
import { deepClone } from "../../../base/common/objects.js";
import "../common/agentHostStarter.config.contribution.js";
let ElectronAgentHostStarter = class extends Disposable {
  constructor(_telemetryIds, _configurationService, _environmentMainService, _lifecycleMainService, _logService) {
    super();
    this._telemetryIds = _telemetryIds;
    this._configurationService = _configurationService;
    this._environmentMainService = _environmentMainService;
    this._lifecycleMainService = _lifecycleMainService;
    this._logService = _logService;
    this.utilityProcess = void 0;
    this.utilityProcessStarted = void 0;
    this._windowSenders = /* @__PURE__ */ new Map();
    this._windowSenderCleanup = this._register(new DisposableMap());
    this._onRequestConnection = this._register(new Emitter());
    this.onRequestConnection = this._onRequestConnection.event;
    this._onRequestRestart = this._register(new Emitter());
    this.onRequestRestart = this._onRequestRestart.event;
    this._onWillShutdown = this._register(new Emitter());
    this.onWillShutdown = this._onWillShutdown.event;
    /**
     * Enterprise OTel policy forwarded by the renderer (see `AgentHostOTelPolicyIpcChannel`).
     * The main-process config service lacks the managed-settings (`AccountPolicyService`) policy
     * layer, so the renderer — which has it — sends the resolved values here before requesting
     * the connection that lazily spawns the host. Used as the `policySettings` of
     * `buildAgentHostOTelEnv` in `start()`, falling back to main-process policy when absent.
     */
    this._otelPolicyFromRenderer = void 0;
    this._register(this._lifecycleMainService.onWillShutdown(() => this._onWillShutdown.fire()));
    const onOTelPolicy = (_e, policy) => {
      this._otelPolicyFromRenderer = sanitizeAgentHostOTelPolicySettings(policy);
    };
    validatedIpcMain.on(AgentHostOTelPolicyIpcChannel, onOTelPolicy);
    this._register(toDisposable(() => {
      validatedIpcMain.removeListener(AgentHostOTelPolicyIpcChannel, onOTelPolicy);
    }));
    const onWindowConnection = (e, nonce) => this._onWindowConnection(e, nonce);
    validatedIpcMain.on("vscode:createAgentHostMessageChannel", onWindowConnection);
    this._register(toDisposable(() => {
      validatedIpcMain.removeListener("vscode:createAgentHostMessageChannel", onWindowConnection);
    }));
    const onRestart = () => {
      for (const sender of this._windowSenders.values()) {
        if (!sender.isDestroyed()) {
          sender.send(AgentHostWillRestartIpcChannel);
        }
      }
      this._onRequestRestart.fire();
    };
    validatedIpcMain.on(AgentHostRestartIpcChannel, onRestart);
    this._register(toDisposable(() => {
      validatedIpcMain.removeListener(AgentHostRestartIpcChannel, onRestart);
    }));
  }
  async start() {
    this.utilityProcess = new UtilityProcess(this._logService, NullTelemetryService, this._lifecycleMainService);
    this.utilityProcessStarted = new DeferredPromise();
    const inspectParams = parseAgentHostDebugPort(this._environmentMainService.args, this._environmentMainService.isBuilt);
    const execArgv = inspectParams.port ? [
      "--nolazy",
      `--inspect${inspectParams.break ? "-brk" : ""}=${inspectParams.port}`
    ] : void 0;
    const shellEnv = await this._resolveShellEnv();
    const sdkEnv = buildAgentSdkEnv({
      codexSdkRoot: this._configurationService.getValue(AgentHostCodexAgentSdkRootSettingId),
      codexHome: this._configurationService.getValue(AgentHostCodexAgentCodexHomeSettingId),
      codexBinaryArgs: this._configurationService.getValue(AgentHostCodexAgentBinaryArgsSettingId),
      claudeAgentEnabled: this._configurationService.getValue(AgentHostClaudeAgentEnabledSettingId),
      codexAgentEnabled: this._configurationService.getValue(AgentHostCodexAgentEnabledSettingId),
      byokModelsEnabled: this._configurationService.getValue(AgentHostByokModelsEnabledSettingId)
    }, process.env);
    const policyValue = (key) => this._configurationService.inspect(key).policyValue;
    const policySettings = this._otelPolicyFromRenderer ?? {
      enabled: policyValue(AgentHostOTelEnabledSettingId),
      exporterType: policyValue(AgentHostOTelExporterTypeSettingId),
      otlpProtocol: policyValue(AgentHostOTelOtlpProtocolSettingId),
      otlpEndpoint: policyValue(AgentHostOTelOtlpEndpointSettingId),
      captureContent: policyValue(AgentHostOTelCaptureContentSettingId),
      outfile: policyValue(AgentHostOTelOutfileSettingId),
      serviceName: policyValue(AgentHostOTelServiceNameSettingId),
      resourceAttributes: policyValue(AgentHostOTelResourceAttributesSettingId)
    };
    const otelEnv = buildAgentHostOTelEnv({
      enabled: this._configurationService.getValue(AgentHostOTelEnabledSettingId),
      exporterType: this._configurationService.getValue(AgentHostOTelExporterTypeSettingId),
      otlpEndpoint: this._configurationService.getValue(AgentHostOTelOtlpEndpointSettingId),
      captureContent: this._configurationService.getValue(AgentHostOTelCaptureContentSettingId),
      outfile: this._configurationService.getValue(AgentHostOTelOutfileSettingId),
      dbSpanExporterEnabled: this._configurationService.getValue(AgentHostOTelDbSpanExporterEnabledSettingId)
    }, process.env, policySettings);
    const args = [
      "--logsPath",
      this._environmentMainService.logsHome.with({ scheme: Schemas.file }).fsPath,
      "--user-data-dir",
      this._environmentMainService.userDataPath
    ];
    if (this._environmentMainService.disableTelemetry) {
      args.push("--disable-telemetry");
    }
    const telemetryIdEnv = buildAgentHostTelemetryIdEnv(this._telemetryIds);
    this.utilityProcess.start({
      type: "agentHost",
      name: "agent-host",
      entryPoint: "vs/platform/agentHost/node/agentHostMain",
      execArgv,
      args,
      env: {
        ...deepClone(process.env),
        ...shellEnv,
        // Announce that everything spawned below this process is driven by
        // VS Code's agent, so `gh` inherits it. Set after the inherited
        // env so it wins.
        [AiAgentEnvVar]: AiAgentEnvValue,
        VSCODE_ESM_ENTRYPOINT: "vs/platform/agentHost/node/agentHostMain",
        VSCODE_PIPE_LOGGING: "true",
        VSCODE_VERBOSE_LOGGING: "true",
        [AgentHostLaunchKindEnvVar]: AgentHostLaunchKind.VSCodeMainProcess,
        ...sdkEnv,
        ...otelEnv,
        ...telemetryIdEnv
      }
    });
    this.utilityProcessStarted.complete();
    const port = this.utilityProcess.connect();
    const client = new MessagePortClient(port, "agentHost");
    const store = new DisposableStore();
    store.add(client);
    store.add(this.utilityProcess.onStderr((data) => {
      if (this._isExpectedStderr(data)) {
        return;
      }
      this._logService.error(`[AgentHost:stderr] ${data}`);
    }));
    store.add(toDisposable(() => {
      this.utilityProcess?.kill();
      this.utilityProcess?.dispose();
      this.utilityProcess = void 0;
      this.utilityProcessStarted = void 0;
    }));
    return {
      client,
      store,
      onDidProcessExit: this.utilityProcess.onExit
    };
  }
  async _resolveShellEnv() {
    try {
      return await getResolvedShellEnv(this._configurationService, this._logService, this._environmentMainService.args, process.env);
    } catch (error) {
      this._logService.error("AgentHostStarter was unable to resolve shell environment", error);
      return {};
    }
  }
  async _onWindowConnection(e, nonce) {
    this._trackWindowSender(e.sender);
    this._onRequestConnection.fire();
    await this.utilityProcessStarted?.p;
    if (!this.utilityProcess) {
      this._logService.error("AgentHostStarter: cannot create window connection, agent host process is not running");
      return;
    }
    const port = this.utilityProcess.connect();
    if (e.sender.isDestroyed()) {
      port.close();
      return;
    }
    e.sender.postMessage("vscode:createAgentHostMessageChannelResult", nonce, [port]);
  }
  _trackWindowSender(sender) {
    if (this._windowSenders.has(sender.id)) {
      return;
    }
    this._windowSenders.set(sender.id, sender);
    const onDestroyed = () => this._windowSenderCleanup.deleteAndDispose(sender.id);
    sender.once("destroyed", onDestroyed);
    this._windowSenderCleanup.set(sender.id, toDisposable(() => {
      sender.removeListener("destroyed", onDestroyed);
      this._windowSenders.delete(sender.id);
    }));
  }
  static {
    this._expectedStderrPatterns = [
      "Most NODE_OPTIONs are not supported in packaged apps",
      "Debugger listening on ws://",
      "For help, see: https://nodejs.org/en/docs/inspector",
      "ExperimentalWarning: SQLite is an experimental feature"
    ];
  }
  _isExpectedStderr(data) {
    return ElectronAgentHostStarter._expectedStderrPatterns.some((pattern) => data.includes(pattern));
  }
};
ElectronAgentHostStarter = __decorateClass([
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IEnvironmentMainService),
  __decorateParam(3, ILifecycleMainService),
  __decorateParam(4, ILogService)
], ElectronAgentHostStarter);
export {
  ElectronAgentHostStarter
};
