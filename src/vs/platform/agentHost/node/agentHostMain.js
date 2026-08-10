import { DeferredPromise } from "../../../base/common/async.js";
import { ProxyChannel } from "../../../base/parts/ipc/common/ipc.js";
import { Server as ChildProcessServer } from "../../../base/parts/ipc/node/ipc.cp.js";
import { Server as UtilityProcessServer } from "../../../base/parts/ipc/node/ipc.mp.js";
import { isUtilityProcess } from "../../../base/parts/sandbox/node/electronTypes.js";
import { Emitter } from "../../../base/common/event.js";
import { DisposableStore, MutableDisposable, toDisposable } from "../../../base/common/lifecycle.js";
import { joinPath } from "../../../base/common/resources.js";
import { isWindows } from "../../../base/common/platform.js";
import { URI } from "../../../base/common/uri.js";
import { generateUuid } from "../../../base/common/uuid.js";
import * as os from "os";
import * as inspector from "inspector";
import { AgentHostByokModelsEnabledEnvVar, AgentHostClaudeAgentEnabledEnvVar, AgentHostCodexAgentEnabledEnvVar, AgentHostIpcChannels, IAgentService, isAgentEnabled } from "../common/agentService.js";
import { AgentHostCodexEnabledConfigKey, platformRootSchema } from "../common/agentHostSchema.js";
import { AgentModelRefreshScheduler, MODEL_REFRESH_INTERVAL_MS } from "./agentModelRefreshScheduler.js";
import { AgentService } from "./agentService.js";
import { IAgentHostStateManager } from "./agentHostStateManager.js";
import { IAgentConfigurationService } from "./agentConfigurationService.js";
import { IAgentHostGitHubEndpointService } from "./agentHostGitHubEndpointService.js";
import { IAgentHostCompletions } from "./agentHostCompletions.js";
import { IAgentHostTerminalManager } from "./agentHostTerminalManager.js";
import { CopilotAgent } from "./copilot/copilotAgent.js";
import { WorktreeIsolation } from "./shared/worktreeIsolation.js";
import { CopilotApiService, ICopilotApiService } from "./shared/copilotApiService.js";
import { ClaudeAgent } from "./claude/claudeAgent.js";
import { ClaudeAgentSdkService, ClaudeSdkPackage, IClaudeAgentSdkService } from "./claude/claudeAgentSdkService.js";
import { ClaudeProxyService, IClaudeProxyService } from "./claude/claudeProxyService.js";
import { CodexAgent, CodexSdkPackage } from "./codex/codexAgent.js";
import { createCodexProviderConfiguration } from "./codex/codexProviderConfiguration.js";
import { CodexProxyService, ICodexProxyService } from "./codex/codexProxyService.js";
import { ByokLmProxyService, IByokLmProxyService } from "./copilot/byokLmProxyService.js";
import { ByokLmBridgeRegistry, IByokLmBridgeRegistry } from "./byokLmBridgeRegistry.js";
import { INetworkDiagnosticsService, NetworkDiagnosticsService } from "./networkDiagnosticsService.js";
import { AgentSdkDownloader, IAgentSdkDownloader } from "./agentSdkDownloader.js";
import { IAgentHostOTelService } from "../common/otel/agentHostOTelService.js";
import { AgentHostOTelService } from "./otel/agentHostOTelService.js";
import { ProtocolServerHandler } from "./protocolServerHandler.js";
import { AgentHostClientConnectionTelemetryTracker } from "./agentHostClientConnectionTelemetry.js";
import { WebSocketProtocolServer } from "./webSocketTransport.js";
import { MessagePortProtocolServer } from "./messagePortProtocolServer.js";
import { cleanupLocalAgentHostEndpointMetadataSync, cleanupLocalAgentHostEndpointSocketSync, createLocalAgentHostEndpointMetadata, prepareLocalAgentHostEndpointMetadataDirectory, prepareLocalAgentHostEndpointSocketDirectory, publishLocalAgentHostEndpointMetadata } from "./localAgentHostMetadata.js";
import { AgentHostManagementService } from "./agentHostManagementService.js";
import { INativeEnvironmentService } from "../../environment/common/environment.js";
import { NativeEnvironmentService } from "../../environment/node/environmentService.js";
import { parseArgs, OPTIONS } from "../../environment/node/argv.js";
import { getLogLevel, ILogService, isDevConsoleLogForwardingEnabled, registerDevConsoleLogForwarder } from "../../log/common/log.js";
import { LogService } from "../../log/common/logService.js";
import { LoggerService } from "../../log/node/loggerService.js";
import { LoggerChannel } from "../../log/common/logIpc.js";
import { OtlpEmitterLogger, OtlpLogEmitter } from "../common/otlp/otlpLogEmitter.js";
import { DefaultURITransformer } from "../../../base/common/uriIpc.js";
import product from "../../product/common/product.js";
import { IProductService } from "../../product/common/productService.js";
import { localize } from "../../../nls.js";
import { FileService } from "../../files/common/fileService.js";
import { IFileService } from "../../files/common/files.js";
import { DiskFileSystemProvider } from "../../files/node/diskFileSystemProvider.js";
import { Schemas } from "../../../base/common/network.js";
import { InstantiationService } from "../../instantiation/common/instantiationService.js";
import { ServiceCollection } from "../../instantiation/common/serviceCollection.js";
import { registerAgentHostNetworkServices } from "./agentHostBootstrap.js";
import { BANG_COMMAND_PREFIX } from "./agentHostBangCommand.js";
import { SessionDataService } from "./sessionDataService.js";
import { ISessionDataService } from "../common/sessionDataService.js";
import { IWindowsMxcTerminalSandboxRuntime, WindowsMxcTerminalSandboxRuntime } from "../../sandbox/common/terminalSandboxMxcRuntime.js";
import { ISandboxHelperService } from "../../sandbox/common/sandboxHelperService.js";
import { SandboxHelperService } from "../../sandbox/node/sandboxHelper.js";
import { IDiffComputeService } from "../common/diffComputeService.js";
import { IAgentEditAttributionService } from "../common/fileEditAttribution.js";
import { NodeWorkerDiffComputeService } from "./diffComputeService.js";
import { AgentEditAttributionService } from "./shared/agentEditAttributionService.js";
import { IEditSurvivalReporterFactory, EditSurvivalReporterFactory } from "./shared/editSurvivalReporter.js";
import { EditArcReporterService, IEditArcReporterService } from "./shared/editArcReporter.js";
import { AgentHostClientFileSystemProvider } from "../common/agentHostClientFileSystemProvider.js";
import { AGENT_CLIENT_SCHEME } from "../common/agentClientUri.js";
import { AGENT_HOST_CLIENT_BYOK_LM_CHANNEL, createAgentHostClientByokLmConnection } from "../common/agentHostClientByokLmChannel.js";
import { AGENT_HOST_CLIENT_PROXY_CHANNEL, createAgentHostClientProxyConnection } from "../common/agentHostClientProxyChannel.js";
import { IAgentPluginManager } from "../common/agentPluginManager.js";
import { AgentPluginManager } from "./agentPluginManager.js";
import { AgentHostGitService } from "./agentHostGitService.js";
import { IAgentHostGitService } from "../common/agentHostGitService.js";
import { IAgentHostCheckpointService } from "../common/agentHostCheckpointService.js";
import { AgentHostFileMonitorService, IAgentHostFileMonitorService } from "./agentHostFileMonitorService.js";
import { registerPendingEditContentProvider } from "./copilot/pendingEditContentStore.js";
import { join } from "../../../base/common/path.js";
import { createAgentHostTelemetryService } from "./agentHostTelemetryService.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import ErrorTelemetry from "../../telemetry/node/errorTelemetry.js";
import { AgentHostLaunchKindEnvVar, readAgentHostLaunchKind } from "../common/agentHostTelemetry.js";
void startAgentHost().catch((err) => {
  console.error(err);
  process.exit(1);
});
async function startAgentHost() {
  let server;
  if (isUtilityProcess(process)) {
    server = new UtilityProcessServer();
  } else {
    server = new ChildProcessServer(AgentHostIpcChannels.AgentHost);
  }
  const disposables = new DisposableStore();
  const errorTelemetry = disposables.add(new MutableDisposable());
  const productService = { _serviceBrand: void 0, ...product };
  const environmentService = new NativeEnvironmentService(parseArgs(process.argv, OPTIONS), productService);
  const loggerService = new LoggerService(getLogLevel(environmentService), environmentService.logsHome);
  server.registerChannel(AgentHostIpcChannels.Logger, new LoggerChannel(loggerService, () => DefaultURITransformer));
  const logger = loggerService.createLogger("agenthost", { name: localize("agentHost", "Agent Host") });
  const otlpLogEmitter = disposables.add(new OtlpLogEmitter());
  const otlpLogger = disposables.add(new OtlpEmitterLogger(otlpLogEmitter));
  const logService = new LogService(logger, [otlpLogger]);
  if (!environmentService.isBuilt && isDevConsoleLogForwardingEnabled) {
    disposables.add(registerDevConsoleLogForwarder(logService));
  }
  logService.info("Agent Host process started successfully");
  const fileService = disposables.add(new FileService(logService));
  disposables.add(fileService.registerProvider(Schemas.file, disposables.add(new DiskFileSystemProvider(logService))));
  disposables.add(registerPendingEditContentProvider(fileService));
  const sessionDataService = new SessionDataService(URI.file(environmentService.userDataPath), fileService, logService);
  const rootConfigResource = joinPath(environmentService.appSettingsHome, "globalStorage", "agent-host-config.json");
  let agentService;
  let instantiationService;
  let sdkDownloadProgress;
  let byokLmBridgeRegistry;
  let proxyResolver;
  const byokLmEnabled = isAgentEnabled(process.env[AgentHostByokModelsEnabledEnvVar], true);
  const hostLaunchKind = readAgentHostLaunchKind(process.env[AgentHostLaunchKindEnvVar]);
  const connectionTelemetryTracker = disposables.add(new AgentHostClientConnectionTelemetryTracker());
  try {
    const diServices = new ServiceCollection();
    diServices.set(INativeEnvironmentService, environmentService);
    diServices.set(ILogService, logService);
    diServices.set(IFileService, fileService);
    diServices.set(ISessionDataService, sessionDataService);
    diServices.set(IProductService, productService);
    const networkServices = await registerAgentHostNetworkServices(diServices, fileService, environmentService, logService, disposables);
    proxyResolver = networkServices.proxyResolver;
    const fetchFn = proxyResolver.fetch.bind(proxyResolver);
    const telemetryService = await createAgentHostTelemetryService({ environmentService, productService, fileService, loggerService, logService, disposables, fetchFn, requestService: networkServices.requestService });
    errorTelemetry.value = new ErrorTelemetry(telemetryService);
    diServices.set(ITelemetryService, telemetryService);
    instantiationService = new InstantiationService(diServices);
    const fileMonitorService = disposables.add(instantiationService.createInstance(AgentHostFileMonitorService));
    diServices.set(IAgentHostFileMonitorService, fileMonitorService);
    diServices.set(IWindowsMxcTerminalSandboxRuntime, instantiationService.createInstance(WindowsMxcTerminalSandboxRuntime));
    diServices.set(ISandboxHelperService, new SandboxHelperService());
    const gitService = instantiationService.createInstance(AgentHostGitService);
    diServices.set(IAgentHostGitService, gitService);
    const agentSdkDownloader = disposables.add(instantiationService.createInstance(AgentSdkDownloader));
    diServices.set(IAgentSdkDownloader, agentSdkDownloader);
    sdkDownloadProgress = agentSdkDownloader.onDidDownloadProgress;
    const claudeAgentSdkService = instantiationService.createInstance(ClaudeAgentSdkService);
    diServices.set(IClaudeAgentSdkService, claudeAgentSdkService);
    byokLmBridgeRegistry = new ByokLmBridgeRegistry();
    diServices.set(IByokLmBridgeRegistry, byokLmBridgeRegistry);
    const byokLmProxyService = disposables.add(instantiationService.createInstance(ByokLmProxyService));
    diServices.set(IByokLmProxyService, byokLmProxyService);
    const agentHostOTelService = disposables.add(instantiationService.createInstance(AgentHostOTelService, fetchFn));
    diServices.set(IAgentHostOTelService, agentHostOTelService);
    agentService = new AgentService(logService, fileService, sessionDataService, productService, gitService, rootConfigResource, telemetryService, fileMonitorService, void 0, fetchFn, [createCodexProviderConfiguration(environmentService.userHome)], hostLaunchKind);
    const networkDiagnosticsService = instantiationService.createInstance(NetworkDiagnosticsService);
    diServices.set(INetworkDiagnosticsService, networkDiagnosticsService);
    agentService.setNetworkDiagnosticsService(networkDiagnosticsService);
    diServices.set(IAgentService, agentService);
    diServices.set(IAgentHostStateManager, agentService.stateManager);
    const pluginManager = new AgentPluginManager(URI.file(environmentService.userDataPath), fileService, logService);
    diServices.set(IAgentPluginManager, pluginManager);
    const diffComputeService = disposables.add(new NodeWorkerDiffComputeService(logService));
    diServices.set(IDiffComputeService, diffComputeService);
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
    const copilotApiService = instantiationService.createInstance(CopilotApiService, fetchFn);
    diServices.set(ICopilotApiService, copilotApiService);
    agentService.setWorktreeIsolation(disposables.add(instantiationService.createInstance(WorktreeIsolation, void 0)));
    const claudeProxyService = disposables.add(instantiationService.createInstance(ClaudeProxyService));
    diServices.set(IClaudeProxyService, claudeProxyService);
    const codexProxyService = disposables.add(instantiationService.createInstance(CodexProxyService));
    diServices.set(ICodexProxyService, codexProxyService);
    agentService.registerProvider(instantiationService.createInstance(CopilotAgent));
    if (isAgentEnabled(process.env[AgentHostClaudeAgentEnabledEnvVar], true) && (!environmentService.isBuilt || agentSdkDownloader.isAvailable(ClaudeSdkPackage))) {
      agentService.registerProvider(instantiationService.createInstance(ClaudeAgent));
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
          agentService.registerProvider(instantiationService.createInstance(CodexAgent));
        }
      };
      registerCodexIfEnabled();
      disposables.add(agentConfigurationService.onDidRootConfigChange(() => registerCodexIfEnabled()));
    }
  } catch (err) {
    logService.error("Failed to create AgentService", err);
    throw err;
  }
  disposables.add(instantiationService.createInstance(AgentModelRefreshScheduler, agentService.agents, agentService.onDidStartTurn, MODEL_REFRESH_INTERVAL_MS));
  if (sdkDownloadProgress) {
    disposables.add(sdkDownloadProgress((p) => agentService.emitDownloadProgress(
      p.packageId,
      p.displayName,
      p.receivedBytes,
      p.totalBytes,
      p.phase === "completed" || p.phase === "failed"
    )));
  }
  if (!(server instanceof UtilityProcessServer)) {
    const agentChannel = ProxyChannel.fromService(agentService, disposables);
    server.registerChannel(AgentHostIpcChannels.AgentHost, agentChannel);
  }
  const clientFileSystemProvider = disposables.add(new AgentHostClientFileSystemProvider());
  disposables.add(fileService.registerProvider(AGENT_CLIENT_SCHEME, clientFileSystemProvider));
  if (server instanceof UtilityProcessServer) {
    const localDataPlaneDisposables = disposables.add(new DisposableStore());
    const messagePortProtocolServer = new MessagePortProtocolServer();
    const localProtocolHandlerConfig = {
      hostLaunchKind,
      connectionTelemetryTracker,
      defaultDirectory: URI.file(os.homedir()).toString(),
      completionTriggerCharacters: agentService.completionTriggerCharacters,
      terminalCommandPrefix: BANG_COMMAND_PREFIX,
      otlpLogEmitter,
      allowExtensionMethods: false
    };
    try {
      localDataPlaneDisposables.add(instantiationService.createInstance(
        ProtocolServerHandler,
        agentService,
        agentService.stateManager,
        messagePortProtocolServer,
        localProtocolHandlerConfig,
        clientFileSystemProvider
      ));
      const authorityRegistrations = /* @__PURE__ */ new Map();
      const registerConnection = (connection) => {
        if (authorityRegistrations.has(connection)) {
          return;
        }
        const clientId = connection.ctx;
        if (typeof clientId !== "string" || !clientId) {
          return;
        }
        const connectionStore = new DisposableStore();
        const getChannel = (channelName) => server.getChannel(channelName, (c) => c.ctx === clientId);
        const proxyConnection = createAgentHostClientProxyConnection(getChannel(AGENT_HOST_CLIENT_PROXY_CHANNEL));
        connectionStore.add(proxyResolver.register(clientId, proxyConnection));
        if (byokLmEnabled && byokLmBridgeRegistry) {
          const byokLmConnection = createAgentHostClientByokLmConnection(getChannel(AGENT_HOST_CLIENT_BYOK_LM_CHANNEL));
          connectionStore.add(byokLmBridgeRegistry.register(clientId, byokLmConnection));
        }
        authorityRegistrations.set(connection, connectionStore);
      };
      localDataPlaneDisposables.add(server.onDidAddConnection(registerConnection));
      localDataPlaneDisposables.add(server.onDidRemoveConnection((connection) => {
        if (typeof connection.ctx === "string") {
          messagePortProtocolServer.closeClient(connection.ctx);
        }
        const reg = authorityRegistrations.get(connection);
        if (reg) {
          reg.dispose();
          authorityRegistrations.delete(connection);
        }
      }));
      localDataPlaneDisposables.add(toDisposable(() => {
        for (const registration of authorityRegistrations.values()) {
          registration.dispose();
        }
        authorityRegistrations.clear();
      }));
      for (const connection of server.connections) {
        registerConnection(connection);
      }
      server.registerChannel(AgentHostIpcChannels.Protocol, messagePortProtocolServer);
      const localEndpoint = await startLocalAgentHostEndpoint(
        environmentService.userDataPath,
        logService,
        instantiationService,
        environmentService.logsHome
      );
      if (localEndpoint) {
        const endpointMetadata = localEndpoint.metadata;
        localDataPlaneDisposables.add(localEndpoint.server);
        localDataPlaneDisposables.add(instantiationService.createInstance(
          ProtocolServerHandler,
          agentService,
          agentService.stateManager,
          localEndpoint.server,
          localProtocolHandlerConfig,
          clientFileSystemProvider
        ));
        try {
          await publishLocalAgentHostEndpointMetadata(environmentService.userDataPath, endpointMetadata, logService);
          localDataPlaneDisposables.add(toDisposable(() => {
            cleanupLocalAgentHostEndpoint(environmentService.userDataPath, endpointMetadata, logService);
          }));
        } catch (error) {
          logService.error("[AgentHost] Failed to publish local protocol endpoint; continuing with MessagePort only", error);
          localEndpoint.server.dispose();
          cleanupLocalAgentHostEndpoint(environmentService.userDataPath, endpointMetadata, logService);
        }
      }
    } catch (error) {
      localDataPlaneDisposables.dispose();
      throw error;
    }
  }
  const connectionCountEmitter = disposables.add(new Emitter());
  let dynamicSocketInfo;
  const configuredWebSocketServer = new DeferredPromise();
  const connectionTrackerService = {
    onDidChangeConnectionCount: connectionCountEmitter.event,
    waitForConfiguredWebSocketServer: () => configuredWebSocketServer.p,
    async startWebSocketServer() {
      if (dynamicSocketInfo) {
        return dynamicSocketInfo;
      }
      const socketPath = isWindows ? `\\\\.\\pipe\\vscode-agent-host-${generateUuid().replace(/-/g, "")}` : join(os.tmpdir(), `vscode-agent-host-${generateUuid().replace(/-/g, "")}.sock`);
      const wsServer = disposables.add(await WebSocketProtocolServer.create(
        { socketPath },
        logService,
        { instantiationService, logsHome: environmentService.logsHome }
      ));
      const protocolHandler = disposables.add(instantiationService.createInstance(
        ProtocolServerHandler,
        agentService,
        agentService.stateManager,
        wsServer,
        {
          hostLaunchKind,
          connectionTelemetryTracker,
          defaultDirectory: URI.file(os.homedir()).toString(),
          completionTriggerCharacters: agentService.completionTriggerCharacters,
          terminalCommandPrefix: BANG_COMMAND_PREFIX,
          otlpLogEmitter
        },
        clientFileSystemProvider
      ));
      disposables.add(protocolHandler.onDidChangeConnectionCount((count) => connectionCountEmitter.fire(count)));
      logService.info(`[AgentHost] Dynamic WebSocket server listening on ${socketPath}`);
      dynamicSocketInfo = { socketPath };
      return dynamicSocketInfo;
    },
    async getInspectInfo(tryEnable) {
      let url = inspector.url();
      if (!url && tryEnable) {
        try {
          inspector.open(0, "127.0.0.1", false);
        } catch (err) {
          logService.error("[AgentHost] Failed to open inspector", err);
          return void 0;
        }
        url = inspector.url();
      }
      if (!url) {
        return void 0;
      }
      try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== "ws:") {
          logService.warn(`[AgentHost] Unexpected inspector URL: ${url}`);
          return void 0;
        }
        const port = Number(parsedUrl.port);
        const auth = parsedUrl.pathname.replace(/^\/+/, "");
        if (!Number.isInteger(port) || !auth) {
          logService.warn(`[AgentHost] Unexpected inspector URL: ${url}`);
          return void 0;
        }
        const host = parsedUrl.hostname === "0.0.0.0" ? "127.0.0.1" : parsedUrl.hostname === "::" ? "::1" : parsedUrl.hostname;
        const devtoolsHost = host.includes(":") ? `[${host}]` : host;
        return {
          host,
          port,
          devtoolsUrl: `devtools://devtools/bundled/js_app.html?v8only=true&ws=${devtoolsHost}:${parsedUrl.port}/${auth}`
        };
      } catch {
        logService.warn(`[AgentHost] Unexpected inspector URL: ${url}`);
        return void 0;
      }
    }
  };
  if (server instanceof UtilityProcessServer) {
    server.registerChannel(AgentHostIpcChannels.Management, ProxyChannel.fromService(new AgentHostManagementService(agentService, connectionTrackerService), disposables));
  } else {
    server.registerChannel(AgentHostIpcChannels.ConnectionTracker, ProxyChannel.fromService(connectionTrackerService, disposables));
  }
  const configuredWebSocketServerStart = startWebSocketServer(
    agentService,
    clientFileSystemProvider,
    instantiationService,
    environmentService.logsHome,
    logService,
    otlpLogEmitter,
    disposables,
    hostLaunchKind,
    connectionTelemetryTracker,
    (count) => connectionCountEmitter.fire(count)
  );
  configuredWebSocketServer.settleWith(configuredWebSocketServerStart);
  void configuredWebSocketServerStart.catch((err) => {
    logService.error("Failed to start WebSocket server", err);
  });
  process.once("exit", () => {
    agentService.dispose();
    logService.dispose();
    disposables.dispose();
  });
}
async function startLocalAgentHostEndpoint(userDataPath, logService, instantiationService, logsHome) {
  let metadata;
  let server;
  try {
    const endpointMetadata = createLocalAgentHostEndpointMetadata(userDataPath);
    metadata = endpointMetadata;
    await prepareLocalAgentHostEndpointMetadataDirectory(userDataPath);
    if (!isWindows) {
      await prepareLocalAgentHostEndpointSocketDirectory(userDataPath);
    }
    server = await WebSocketProtocolServer.create(
      {
        socketPath: endpointMetadata.endpoint.path,
        connectionTokenValidate: (token) => token === endpointMetadata.connectionToken
      },
      logService,
      { instantiationService, logsHome }
    );
    await server.whenListening;
    return { metadata: endpointMetadata, server };
  } catch (error) {
    try {
      server?.dispose();
    } catch (disposeError) {
      logService.error("[AgentHost] Failed to dispose local protocol endpoint", disposeError);
    }
    if (metadata) {
      cleanupLocalAgentHostEndpoint(userDataPath, metadata, logService);
    }
    logService.error("[AgentHost] Failed to start local protocol endpoint; continuing with MessagePort only", error);
    return void 0;
  }
}
function cleanupLocalAgentHostEndpoint(userDataPath, metadata, logService) {
  try {
    cleanupLocalAgentHostEndpointMetadataSync(userDataPath, metadata, logService);
  } catch (error) {
    logService.error("[AgentHost] Failed to clean up local protocol metadata", error);
  }
  try {
    cleanupLocalAgentHostEndpointSocketSync(metadata.endpoint.path);
  } catch (error) {
    logService.error("[AgentHost] Failed to clean up local protocol socket", error);
  }
}
async function startWebSocketServer(agentService, clientFileSystemProvider, instantiationService, logsHome, logService, otlpLogEmitter, disposables, hostLaunchKind, connectionTelemetryTracker, onConnectionCountChanged) {
  const port = process.env["VSCODE_AGENT_HOST_PORT"];
  const socketPath = process.env["VSCODE_AGENT_HOST_SOCKET_PATH"];
  if (!port && !socketPath) {
    return;
  }
  const connectionToken = process.env["VSCODE_AGENT_HOST_CONNECTION_TOKEN"];
  const host = process.env["VSCODE_AGENT_HOST_HOST"] || "localhost";
  const wsServer = disposables.add(await WebSocketProtocolServer.create(
    socketPath ? {
      socketPath,
      connectionTokenValidate: connectionToken ? (token) => token === connectionToken : void 0
    } : {
      port: parseInt(port, 10),
      host,
      connectionTokenValidate: connectionToken ? (token) => token === connectionToken : void 0
    },
    logService,
    { instantiationService, logsHome }
  ));
  const protocolHandler = disposables.add(instantiationService.createInstance(
    ProtocolServerHandler,
    agentService,
    agentService.stateManager,
    wsServer,
    {
      hostLaunchKind,
      connectionTelemetryTracker,
      defaultDirectory: URI.file(os.homedir()).toString(),
      completionTriggerCharacters: agentService.completionTriggerCharacters,
      terminalCommandPrefix: BANG_COMMAND_PREFIX,
      otlpLogEmitter
    },
    clientFileSystemProvider
  ));
  disposables.add(protocolHandler.onDidChangeConnectionCount(onConnectionCountChanged));
  await wsServer.whenListening;
  const listenTarget = socketPath ?? `${host}:${wsServer.boundPort ?? port}`;
  logService.info(`[AgentHost] WebSocket server listening on ${listenTarget}`);
  console.log(`Agent host server listening on ${listenTarget}`);
}
