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
import { Emitter } from "../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../base/common/lifecycle.js";
import { FileAccess, Schemas } from "../../../base/common/network.js";
import { Client } from "../../../base/parts/ipc/node/ipc.cp.js";
import { AiAgentEnvValue, AiAgentEnvVar } from "../../chat/common/aiAgentEnv.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { IEnvironmentService } from "../../environment/common/environment.js";
import { parseAgentHostDebugPort } from "../../environment/node/environmentService.js";
import { ILogService } from "../../log/common/log.js";
import { getResolvedShellEnv } from "../../shell/node/shellEnv.js";
import { AgentHostLaunchKind, AgentHostLaunchKindEnvVar } from "../common/agentHostTelemetry.js";
import { AgentHostByokModelsEnabledSettingId, AgentHostClaudeAgentEnabledSettingId, AgentHostCodexAgentBinaryArgsSettingId, AgentHostCodexAgentEnabledSettingId, AgentHostCodexAgentSdkRootSettingId, AgentHostCodexAgentCodexHomeSettingId, AgentHostOTelCaptureContentSettingId, AgentHostOTelDbSpanExporterEnabledSettingId, AgentHostOTelEnabledSettingId, AgentHostOTelExporterTypeSettingId, AgentHostOTelOtlpEndpointSettingId, AgentHostOTelOtlpProtocolSettingId, AgentHostOTelOutfileSettingId, AgentHostOTelResourceAttributesSettingId, AgentHostOTelServiceNameSettingId, buildAgentHostOTelEnv, buildAgentSdkEnv } from "../common/agentService.js";
import "../common/agentHostStarter.config.contribution.js";
let NodeAgentHostStarter = class extends Disposable {
  constructor(_configurationService, _environmentService, _logService) {
    super();
    this._configurationService = _configurationService;
    this._environmentService = _environmentService;
    this._logService = _logService;
    this._onRequestConnection = this._register(new Emitter());
    this.onRequestConnection = this._onRequestConnection.event;
  }
  /**
   * Configures the child process to also start a WebSocket server.
   * Must be called before {@link start}. Triggers eager process start
   * via {@link onRequestConnection}.
   */
  setWebSocketConfig(config) {
    this._wsConfig = config;
    this._onRequestConnection.fire();
  }
  async start() {
    const shellEnv = await this._resolveShellEnv();
    const env = {
      ...shellEnv,
      // Announce that everything spawned below this process is driven by
      // VS Code's agent, so `gh` inherits it. Set after the inherited
      // env so it wins.
      [AiAgentEnvVar]: AiAgentEnvValue,
      VSCODE_ESM_ENTRYPOINT: "vs/platform/agentHost/node/agentHostMain",
      VSCODE_PIPE_LOGGING: "true",
      VSCODE_VERBOSE_LOGGING: "true",
      [AgentHostLaunchKindEnvVar]: AgentHostLaunchKind.VSCodeCLI
    };
    const sdkEnv = buildAgentSdkEnv({
      codexSdkRoot: this._configurationService.getValue(AgentHostCodexAgentSdkRootSettingId),
      codexHome: this._configurationService.getValue(AgentHostCodexAgentCodexHomeSettingId),
      codexBinaryArgs: this._configurationService.getValue(AgentHostCodexAgentBinaryArgsSettingId),
      claudeAgentEnabled: this._configurationService.getValue(AgentHostClaudeAgentEnabledSettingId),
      codexAgentEnabled: this._configurationService.getValue(AgentHostCodexAgentEnabledSettingId),
      byokModelsEnabled: this._configurationService.getValue(AgentHostByokModelsEnabledSettingId)
    }, process.env);
    Object.assign(env, sdkEnv);
    const policyValue = (key) => this._configurationService.inspect(key).policyValue;
    const otelEnv = buildAgentHostOTelEnv({
      enabled: this._configurationService.getValue(AgentHostOTelEnabledSettingId),
      exporterType: this._configurationService.getValue(AgentHostOTelExporterTypeSettingId),
      otlpEndpoint: this._configurationService.getValue(AgentHostOTelOtlpEndpointSettingId),
      captureContent: this._configurationService.getValue(AgentHostOTelCaptureContentSettingId),
      outfile: this._configurationService.getValue(AgentHostOTelOutfileSettingId),
      dbSpanExporterEnabled: this._configurationService.getValue(AgentHostOTelDbSpanExporterEnabledSettingId)
    }, process.env, {
      enabled: policyValue(AgentHostOTelEnabledSettingId),
      exporterType: policyValue(AgentHostOTelExporterTypeSettingId),
      otlpProtocol: policyValue(AgentHostOTelOtlpProtocolSettingId),
      otlpEndpoint: policyValue(AgentHostOTelOtlpEndpointSettingId),
      captureContent: policyValue(AgentHostOTelCaptureContentSettingId),
      outfile: policyValue(AgentHostOTelOutfileSettingId),
      serviceName: policyValue(AgentHostOTelServiceNameSettingId),
      resourceAttributes: policyValue(AgentHostOTelResourceAttributesSettingId)
    });
    Object.assign(env, otelEnv);
    if (this._wsConfig) {
      if (this._wsConfig.port) {
        env["VSCODE_AGENT_HOST_PORT"] = this._wsConfig.port;
      }
      if (this._wsConfig.socketPath) {
        env["VSCODE_AGENT_HOST_SOCKET_PATH"] = this._wsConfig.socketPath;
      }
      if (this._wsConfig.host) {
        env["VSCODE_AGENT_HOST_HOST"] = this._wsConfig.host;
      }
      if (this._wsConfig.connectionToken) {
        env["VSCODE_AGENT_HOST_CONNECTION_TOKEN"] = this._wsConfig.connectionToken;
      }
    }
    const args = [
      "--type=agentHost",
      "--logsPath",
      this._environmentService.logsHome.with({ scheme: Schemas.file }).fsPath,
      "--user-data-dir",
      this._environmentService.userDataPath
    ];
    if (this._environmentService.disableTelemetry) {
      args.push("--disable-telemetry");
    }
    const opts = {
      serverName: "Agent Host",
      args,
      env
    };
    const agentHostDebug = parseAgentHostDebugPort(this._environmentService.args, this._environmentService.isBuilt);
    if (agentHostDebug) {
      if (agentHostDebug.break && agentHostDebug.port) {
        opts.debugBrk = agentHostDebug.port;
      } else if (!agentHostDebug.break && agentHostDebug.port) {
        opts.debug = agentHostDebug.port;
      }
    }
    await this._removeStaleSocket();
    const client = new Client(FileAccess.asFileUri("bootstrap-fork").fsPath, opts);
    const store = new DisposableStore();
    store.add(client);
    return {
      client,
      store,
      onDidProcessExit: client.onDidProcessExit
    };
  }
  /**
   * Unix domain sockets outlive the process that bound them, so an agent host
   * that crashed leaves its socket file behind and the replacement's `listen`
   * fails with `EADDRINUSE` — which would burn the whole crash-restart budget
   * without ever recovering. Windows named pipes are refcounted by the OS and
   * disappear with the process, so they need no cleanup.
   */
  async _removeStaleSocket() {
    const socketPath = this._wsConfig?.socketPath;
    if (!socketPath || process.platform === "win32") {
      return;
    }
    try {
      await fs.promises.unlink(socketPath);
    } catch (error) {
      if (error?.code !== "ENOENT") {
        this._logService.warn(`AgentHostStarter could not remove stale socket at ${socketPath}`, error);
      }
    }
  }
  async _resolveShellEnv() {
    try {
      return await getResolvedShellEnv(this._configurationService, this._logService, this._environmentService.args, process.env);
    } catch (error) {
      this._logService.error("AgentHostStarter was unable to resolve shell environment", error);
      return {};
    }
  }
};
NodeAgentHostStarter = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IEnvironmentService),
  __decorateParam(2, ILogService)
], NodeAgentHostStarter);
export {
  NodeAgentHostStarter
};
