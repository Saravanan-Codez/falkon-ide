import { fileURLToPath } from "url";
globalThis._VSCODE_FILE_ROOT = fileURLToPath(new URL("../../../..", import.meta.url));
import * as fs from "fs";
import * as os from "os";
import { DisposableStore, MutableDisposable } from "../../../base/common/lifecycle.js";
import { raceTimeout } from "../../../base/common/async.js";
import { joinPath } from "../../../base/common/resources.js";
import { URI } from "../../../base/common/uri.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { localize } from "../../../nls.js";
import { NativeEnvironmentService } from "../../environment/node/environmentService.js";
import { INativeEnvironmentService } from "../../environment/common/environment.js";
import { parseArgs, OPTIONS } from "../../environment/node/argv.js";
import { getLogLevel, ILogService } from "../../log/common/log.js";
import { LogService } from "../../log/common/logService.js";
import { LoggerService } from "../../log/node/loggerService.js";
import { OtlpEmitterLogger, OtlpLogEmitter } from "../common/otlp/otlpLogEmitter.js";
import product from "../../product/common/product.js";
import { IProductService } from "../../product/common/productService.js";
import { InstantiationService } from "../../instantiation/common/instantiationService.js";
import { ServiceCollection } from "../../instantiation/common/serviceCollection.js";
import { registerAgentHostNetworkServices } from "./agentHostBootstrap.js";
import { BANG_COMMAND_PREFIX } from "./agentHostBangCommand.js";
import { CopilotAgent } from "./copilot/copilotAgent.js";
import { INetworkDiagnosticsService, NetworkDiagnosticsService } from "./networkDiagnosticsService.js";
import { IByokLmBridgeRegistry, NullByokLmBridgeRegistry } from "./byokLmBridgeRegistry.js";
import { IByokLmProxyService, NullByokLmProxyService } from "./copilot/byokLmProxyService.js";
import { WorktreeIsolation } from "./shared/worktreeIsolation.js";
import { CopilotApiService, ICopilotApiService } from "./shared/copilotApiService.js";
import { ClaudeAgent } from "./claude/claudeAgent.js";
import { ClaudeAgentSdkService, ClaudeSdkPackage, IClaudeAgentSdkService } from "./claude/claudeAgentSdkService.js";
import { ClaudeProxyService, IClaudeProxyService } from "./claude/claudeProxyService.js";
import { CodexAgent, CodexSdkPackage } from "./codex/codexAgent.js";
import { createCodexProviderConfiguration } from "./codex/codexProviderConfiguration.js";
import { CodexProxyService, ICodexProxyService } from "./codex/codexProxyService.js";
import { AgentSdkDownloader, IAgentSdkDownloader } from "./agentSdkDownloader.js";
import { IAgentHostOTelService } from "../common/otel/agentHostOTelService.js";
import { AgentHostOTelService } from "./otel/agentHostOTelService.js";
import { AgentHostCodexEnabledConfigKey, platformRootSchema } from "../common/agentHostSchema.js";
import { AgentModelRefreshScheduler, MODEL_REFRESH_INTERVAL_MS } from "./agentModelRefreshScheduler.js";
import { AgentService } from "./agentService.js";
import { IAgentHostStateManager } from "./agentHostStateManager.js";
import { AgentHostClaudeAgentEnabledEnvVar, AgentHostClaudeSdkRootEnvVar, AgentHostCodexAgentEnabledEnvVar, IAgentService, AgentHostCodexAgentSdkRootEnvVar, isAgentEnabled } from "../common/agentService.js";
import { IAgentConfigurationService } from "./agentConfigurationService.js";
import { IAgentHostGitHubEndpointService } from "./agentHostGitHubEndpointService.js";
import { IAgentHostCompletions } from "./agentHostCompletions.js";
import { IAgentHostTerminalManager } from "./agentHostTerminalManager.js";
import { WebSocketProtocolServer } from "./webSocketTransport.js";
import { ProtocolServerHandler } from "./protocolServerHandler.js";
import { AgentHostClientConnectionTelemetryTracker } from "./agentHostClientConnectionTelemetry.js";
import { FileService } from "../../files/common/fileService.js";
import { IFileService } from "../../files/common/files.js";
import { DiskFileSystemProvider } from "../../files/node/diskFileSystemProvider.js";
import { Schemas } from "../../../base/common/network.js";
import { ISessionDataService } from "../common/sessionDataService.js";
import { IDiffComputeService } from "../common/diffComputeService.js";
import { IAgentEditAttributionService } from "../common/fileEditAttribution.js";
import { NodeWorkerDiffComputeService } from "./diffComputeService.js";
import { AgentEditAttributionService } from "./shared/agentEditAttributionService.js";
import { IEditSurvivalReporterFactory, EditSurvivalReporterFactory } from "./shared/editSurvivalReporter.js";
import { EditArcReporterService, IEditArcReporterService } from "./shared/editArcReporter.js";
import { SessionDataService } from "./sessionDataService.js";
import { IWindowsMxcTerminalSandboxRuntime, WindowsMxcTerminalSandboxRuntime } from "../../sandbox/common/terminalSandboxMxcRuntime.js";
import { ISandboxHelperService } from "../../sandbox/common/sandboxHelperService.js";
import { SandboxHelperService } from "../../sandbox/node/sandboxHelper.js";
import { AgentHostClientFileSystemProvider } from "../common/agentHostClientFileSystemProvider.js";
import { AGENT_CLIENT_SCHEME } from "../common/agentClientUri.js";
import { resolveServerUrls } from "./serverUrls.js";
import { AgentPluginManager } from "./agentPluginManager.js";
import { IAgentPluginManager } from "../common/agentPluginManager.js";
import { registerPendingEditContentProvider } from "./copilot/pendingEditContentStore.js";
import { AgentHostGitService } from "./agentHostGitService.js";
import { IAgentHostGitService } from "../common/agentHostGitService.js";
import { IAgentHostCheckpointService } from "../common/agentHostCheckpointService.js";
import { AgentHostFileMonitorService, IAgentHostFileMonitorService } from "./agentHostFileMonitorService.js";
import { createAgentHostTelemetryService } from "./agentHostTelemetryService.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import ErrorTelemetry from "../../telemetry/node/errorTelemetry.js";
import { AgentHostLaunchKind } from "../common/agentHostTelemetry.js";
function log(msg) {
  process.stderr.write(`[AgentHostServer] ${msg}
`);
}
const connectionTokenRegex = /^[0-9A-Za-z_-]+$/;
function parseServerOptions() {
  const argv = process.argv.slice(2);
  const envPort = parseInt(process.env["VSCODE_AGENT_HOST_PORT"] ?? "8081", 10);
  const portIdx = argv.indexOf("--port");
  const port = portIdx >= 0 ? parseInt(argv[portIdx + 1], 10) : envPort;
  const hostIdx = argv.indexOf("--host");
  const host = hostIdx >= 0 ? argv[hostIdx + 1] : void 0;
  const enableMockAgent = argv.includes("--enable-mock-agent");
  const claudeSdkRootIdx = argv.indexOf("--claude-sdk-root");
  const claudeSdkRoot = (claudeSdkRootIdx >= 0 ? argv[claudeSdkRootIdx + 1] : process.env[AgentHostClaudeSdkRootEnvVar]) ?? "";
  const codexSdkRootIdx = argv.indexOf("--codex-sdk-root");
  const codexSdkRoot = (codexSdkRootIdx >= 0 ? argv[codexSdkRootIdx + 1] : process.env[AgentHostCodexAgentSdkRootEnvVar]) ?? "";
  const quiet = argv.includes("--quiet");
  const withoutConnectionToken = argv.includes("--without-connection-token");
  const connectionTokenIdx = argv.indexOf("--connection-token");
  const connectionTokenFileIdx = argv.indexOf("--connection-token-file");
  const rawToken = connectionTokenIdx >= 0 ? argv[connectionTokenIdx + 1] : void 0;
  const tokenFilePath = connectionTokenFileIdx >= 0 ? argv[connectionTokenFileIdx + 1] : void 0;
  let connectionToken;
  if (withoutConnectionToken) {
    if (rawToken !== void 0 || tokenFilePath !== void 0) {
      log("Error: --without-connection-token cannot be used with --connection-token or --connection-token-file");
      process.exit(1);
    }
    connectionToken = void 0;
  } else if (tokenFilePath !== void 0) {
    if (rawToken !== void 0) {
      log("Error: --connection-token cannot be used with --connection-token-file");
      process.exit(1);
    }
    try {
      connectionToken = fs.readFileSync(tokenFilePath).toString().replace(/\r?\n$/, "");
    } catch {
      log(`Error: Unable to read connection token file at '${tokenFilePath}'`);
      process.exit(1);
    }
    if (!connectionTokenRegex.test(connectionToken)) {
      log(`Error: The connection token in '${tokenFilePath}' does not adhere to the characters 0-9, a-z, A-Z, _, or -.`);
      process.exit(1);
    }
  } else if (rawToken !== void 0) {
    if (!connectionTokenRegex.test(rawToken)) {
      log(`Error: The connection token '${rawToken}' does not adhere to the characters 0-9, a-z, A-Z, _, or -.`);
      process.exit(1);
    }
    connectionToken = rawToken;
  } else {
    connectionToken = generateUuid();
  }
  return { port, host, enableMockAgent, claudeSdkRoot, codexSdkRoot, quiet, connectionToken };
}
async function main() {
  const options = parseServerOptions();
  const disposables = new DisposableStore();
  const errorTelemetry = disposables.add(new MutableDisposable());
  const productService = { _serviceBrand: void 0, ...product };
  const args = parseArgs(process.argv.slice(2), OPTIONS);
  const environmentService = new NativeEnvironmentService(args, productService);
  let logService;
  let loggerService;
  const otlpLogEmitter = disposables.add(new OtlpLogEmitter());
  const otlpLogger = disposables.add(new OtlpEmitterLogger(otlpLogEmitter));
  if (options.quiet) {
    logService = disposables.add(new LogService(otlpLogger));
  } else {
    const services = new ServiceCollection();
    services.set(IProductService, productService);
    services.set(INativeEnvironmentService, environmentService);
    loggerService = new LoggerService(getLogLevel(environmentService), environmentService.logsHome);
    const logger = loggerService.createLogger("agenthost-server", { name: localize("agentHostServer", "Agent Host Server") });
    logService = disposables.add(new LogService(logger, [otlpLogger]));
    services.set(ILogService, logService);
    log("Starting standalone agent host server");
  }
  logService.info("[AgentHostServer] Starting standalone agent host server");
  const fileService = disposables.add(new FileService(logService));
  disposables.add(fileService.registerProvider(Schemas.file, disposables.add(new DiskFileSystemProvider(logService))));
  disposables.add(registerPendingEditContentProvider(fileService));
  const sessionDataService = new SessionDataService(URI.file(environmentService.userDataPath), fileService, logService);
  const rootConfigResource = joinPath(environmentService.appSettingsHome, "globalStorage", "agent-host-config.json");
  const diServices = new ServiceCollection();
  diServices.set(IProductService, productService);
  diServices.set(INativeEnvironmentService, environmentService);
  diServices.set(ILogService, logService);
  diServices.set(IFileService, fileService);
  diServices.set(ISessionDataService, sessionDataService);
  const networkServices = await registerAgentHostNetworkServices(diServices, fileService, environmentService, logService, disposables);
  const proxyResolver = networkServices.proxyResolver;
  const fetchFn = proxyResolver.fetch.bind(proxyResolver);
  const telemetryService = await createAgentHostTelemetryService({ environmentService, productService, fileService, loggerService, logService, disposables, disableTelemetry: options.quiet, fetchFn, requestService: networkServices.requestService });
  errorTelemetry.value = new ErrorTelemetry(telemetryService);
  diServices.set(ITelemetryService, telemetryService);
  const instantiationService = new InstantiationService(diServices);
  const fileMonitorService = disposables.add(instantiationService.createInstance(AgentHostFileMonitorService));
  diServices.set(IAgentHostFileMonitorService, fileMonitorService);
  diServices.set(IWindowsMxcTerminalSandboxRuntime, instantiationService.createInstance(WindowsMxcTerminalSandboxRuntime));
  diServices.set(ISandboxHelperService, new SandboxHelperService());
  const gitService = instantiationService.createInstance(AgentHostGitService);
  diServices.set(IAgentHostGitService, gitService);
  const agentService = new AgentService(logService, fileService, sessionDataService, productService, gitService, rootConfigResource, telemetryService, fileMonitorService, void 0, fetchFn, [createCodexProviderConfiguration(environmentService.userHome)], AgentHostLaunchKind.VSCodeCLI);
  disposables.add(agentService);
  diServices.set(IAgentService, agentService);
  diServices.set(IAgentHostStateManager, agentService.stateManager);
  const networkDiagnosticsService = instantiationService.createInstance(NetworkDiagnosticsService);
  diServices.set(INetworkDiagnosticsService, networkDiagnosticsService);
  agentService.setNetworkDiagnosticsService(networkDiagnosticsService);
  let sdkDownloadProgress;
  if (!options.quiet) {
    const pluginManager = new AgentPluginManager(URI.file(environmentService.userDataPath), fileService, logService);
    diServices.set(IAgentPluginManager, pluginManager);
    diServices.set(IDiffComputeService, disposables.add(new NodeWorkerDiffComputeService(logService)));
    const editAttributionService = disposables.add(instantiationService.createInstance(AgentEditAttributionService, void 0, void 0));
    diServices.set(IAgentEditAttributionService, editAttributionService);
    agentService.setEditAttributionService(editAttributionService);
    diServices.set(IEditSurvivalReporterFactory, instantiationService.createInstance(EditSurvivalReporterFactory));
    diServices.set(IAgentHostTerminalManager, agentService.terminalManager);
    diServices.set(IAgentConfigurationService, agentService.configurationService);
    const editArcReporterService = disposables.add(instantiationService.createInstance(EditArcReporterService, void 0));
    diServices.set(IEditArcReporterService, editArcReporterService);
    diServices.set(IAgentHostGitHubEndpointService, agentService.gitHubEndpointService);
    diServices.set(IAgentHostCompletions, agentService.completionsService);
    diServices.set(IAgentHostCheckpointService, agentService.checkpointService);
    diServices.set(IAgentHostGitService, gitService);
    const copilotApiService = instantiationService.createInstance(CopilotApiService, fetchFn);
    diServices.set(ICopilotApiService, copilotApiService);
    agentService.setWorktreeIsolation(disposables.add(instantiationService.createInstance(WorktreeIsolation, void 0)));
    if (options.claudeSdkRoot) {
      process.env[AgentHostClaudeSdkRootEnvVar] = options.claudeSdkRoot;
    }
    if (options.codexSdkRoot) {
      process.env[AgentHostCodexAgentSdkRootEnvVar] = options.codexSdkRoot;
    }
    const agentSdkDownloader = disposables.add(instantiationService.createInstance(AgentSdkDownloader));
    diServices.set(IAgentSdkDownloader, agentSdkDownloader);
    sdkDownloadProgress = agentSdkDownloader.onDidDownloadProgress;
    const claudeProxyService = disposables.add(instantiationService.createInstance(ClaudeProxyService));
    diServices.set(IClaudeProxyService, claudeProxyService);
    const claudeAgentSdkService = instantiationService.createInstance(ClaudeAgentSdkService);
    diServices.set(IClaudeAgentSdkService, claudeAgentSdkService);
    const codexProxyService = disposables.add(instantiationService.createInstance(CodexProxyService));
    diServices.set(ICodexProxyService, codexProxyService);
    const agentHostOTelService = disposables.add(instantiationService.createInstance(AgentHostOTelService, fetchFn));
    diServices.set(IAgentHostOTelService, agentHostOTelService);
    diServices.set(IByokLmBridgeRegistry, new NullByokLmBridgeRegistry());
    diServices.set(IByokLmProxyService, new NullByokLmProxyService());
    const copilotAgent = disposables.add(instantiationService.createInstance(CopilotAgent));
    agentService.registerProvider(copilotAgent);
    log("CopilotAgent registered");
    if (isAgentEnabled(process.env[AgentHostClaudeAgentEnabledEnvVar], true) && (!environmentService.isBuilt || agentSdkDownloader.isAvailable(ClaudeSdkPackage))) {
      const claudeAgent = disposables.add(instantiationService.createInstance(ClaudeAgent));
      agentService.registerProvider(claudeAgent);
      log("ClaudeAgent registered");
    }
    if (!environmentService.isBuilt || agentSdkDownloader.isAvailable(CodexSdkPackage)) {
      const agentConfigurationService = agentService.configurationService;
      let codexRegistered = false;
      const registerCodexIfEnabled = () => {
        if (codexRegistered) {
          return;
        }
        const enabledByEnv = isAgentEnabled(process.env[AgentHostCodexAgentEnabledEnvVar], false);
        const enabledByRootConfig = agentConfigurationService.getRootValue(platformRootSchema, AgentHostCodexEnabledConfigKey) === true;
        if (enabledByEnv || enabledByRootConfig) {
          codexRegistered = true;
          const codexAgent = disposables.add(instantiationService.createInstance(CodexAgent));
          agentService.registerProvider(codexAgent);
          log("CodexAgent registered");
        }
      };
      registerCodexIfEnabled();
      disposables.add(agentConfigurationService.onDidRootConfigChange(() => registerCodexIfEnabled()));
    }
  }
  if (sdkDownloadProgress) {
    disposables.add(sdkDownloadProgress((p) => agentService.emitDownloadProgress(
      p.packageId,
      p.displayName,
      p.receivedBytes,
      p.totalBytes,
      p.phase === "completed" || p.phase === "failed"
    )));
  }
  if (options.enableMockAgent) {
    import("../test/node/mockAgent.js").then(({ ScriptedMockAgent }) => {
      const mockAgent = disposables.add(new ScriptedMockAgent());
      agentService.registerProvider(mockAgent);
    }).catch((err) => {
      logService.error("[AgentHostServer] Failed to load mock agent", err);
    });
  }
  disposables.add(instantiationService.createInstance(AgentModelRefreshScheduler, agentService.agents, agentService.onDidStartTurn, MODEL_REFRESH_INTERVAL_MS));
  const wsServer = disposables.add(await WebSocketProtocolServer.create({
    port: options.port,
    host: options.host,
    connectionTokenValidate: options.connectionToken ? (token) => token === options.connectionToken : void 0
  }, logService, { instantiationService, logsHome: environmentService.logsHome }));
  const clientFileSystemProvider = disposables.add(new AgentHostClientFileSystemProvider());
  disposables.add(fileService.registerProvider(AGENT_CLIENT_SCHEME, clientFileSystemProvider));
  const connectionTelemetryTracker = disposables.add(new AgentHostClientConnectionTelemetryTracker());
  disposables.add(instantiationService.createInstance(
    ProtocolServerHandler,
    agentService,
    agentService.stateManager,
    wsServer,
    {
      hostLaunchKind: AgentHostLaunchKind.VSCodeCLI,
      connectionTelemetryTracker,
      defaultDirectory: URI.file(os.homedir()).toString(),
      completionTriggerCharacters: agentService.completionTriggerCharacters,
      terminalCommandPrefix: BANG_COMMAND_PREFIX,
      otlpLogEmitter
    },
    clientFileSystemProvider
  ));
  function reportReady(addr) {
    const listeningPort = Number(addr.split(":").pop());
    process.stdout.write(`READY:${listeningPort}
`);
    const urls = resolveServerUrls(options.host, listeningPort);
    for (const url of urls.local) {
      log(`  Local:   ${url}`);
      logService.info(`[AgentHostServer] Local:   ${url}`);
    }
    for (const url of urls.network) {
      log(`  Network: ${url}`);
      logService.info(`[AgentHostServer] Network: ${url}`);
    }
    if (urls.network.length === 0 && options.host === void 0) {
      log("  Network: use --host to expose");
      logService.info("[AgentHostServer] Network: use --host to expose");
    }
  }
  const address = wsServer.address;
  if (address) {
    reportReady(address);
  } else {
    const interval = setInterval(() => {
      const addr = wsServer.address;
      if (addr) {
        clearInterval(interval);
        reportReady(addr);
      }
    }, 10);
  }
  process.stdin.resume();
  process.stdin.on("end", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
  process.on("SIGINT", () => {
    void shutdown();
  });
  let shuttingDown = false;
  async function shutdown() {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logService.info("[AgentHostServer] Shutting down...");
    wsServer.dispose();
    await raceTimeout(sessionDataService.whenIdle(), 3e3, () => {
      logService.warn("[AgentHostServer] Timed out waiting for session database writes to flush; exiting anyway.");
    });
    disposables.dispose();
    loggerService?.dispose();
    process.exit(0);
  }
}
main();
