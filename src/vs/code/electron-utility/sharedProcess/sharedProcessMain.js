import { hostname, release } from "os";
import { toErrorMessage } from "../../../base/common/errorMessage.js";
import { onUnexpectedError, setUnexpectedErrorHandler } from "../../../base/common/errors.js";
import { combinedDisposable, Disposable, toDisposable } from "../../../base/common/lifecycle.js";
import { Schemas } from "../../../base/common/network.js";
import { URI } from "../../../base/common/uri.js";
import { Emitter } from "../../../base/common/event.js";
import { ProxyChannel, StaticRouter } from "../../../base/parts/ipc/common/ipc.js";
import { Server as UtilityProcessMessagePortServer, once } from "../../../base/parts/ipc/node/ipc.mp.js";
import { CodeCacheCleaner } from "./contrib/codeCacheCleaner.js";
import { LanguagePackCachedDataCleaner } from "./contrib/languagePackCachedDataCleaner.js";
import { LocalizationsUpdater } from "./contrib/localizationsUpdater.js";
import { LogsDataCleaner } from "./contrib/logsDataCleaner.js";
import { UnusedWorkspaceStorageDataCleaner } from "./contrib/storageDataCleaner.js";
import { IChecksumService } from "../../../platform/checksum/common/checksumService.js";
import { ChecksumService } from "../../../platform/checksum/node/checksumService.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { ConfigurationService } from "../../../platform/configuration/common/configurationService.js";
import { IDiagnosticsService } from "../../../platform/diagnostics/common/diagnostics.js";
import { DiagnosticsService } from "../../../platform/diagnostics/node/diagnosticsService.js";
import { IDownloadService } from "../../../platform/download/common/download.js";
import { DownloadService } from "../../../platform/download/common/downloadService.js";
import { INativeEnvironmentService } from "../../../platform/environment/common/environment.js";
import { GlobalExtensionEnablementService } from "../../../platform/extensionManagement/common/extensionEnablementService.js";
import { ExtensionGalleryService } from "../../../platform/extensionManagement/common/extensionGalleryService.js";
import { IAllowedExtensionsService, IExtensionGalleryService, IExtensionManagementService, IExtensionTipsService, IGlobalExtensionEnablementService } from "../../../platform/extensionManagement/common/extensionManagement.js";
import { ExtensionSignatureVerificationService, IExtensionSignatureVerificationService } from "../../../platform/extensionManagement/node/extensionSignatureVerificationService.js";
import { ExtensionManagementChannel, ExtensionTipsChannel } from "../../../platform/extensionManagement/common/extensionManagementIpc.js";
import { ExtensionManagementService, INativeServerExtensionManagementService } from "../../../platform/extensionManagement/node/extensionManagementService.js";
import { IExtensionRecommendationNotificationService } from "../../../platform/extensionRecommendations/common/extensionRecommendations.js";
import { IFileService } from "../../../platform/files/common/files.js";
import { FileService } from "../../../platform/files/common/fileService.js";
import { DiskFileSystemProvider } from "../../../platform/files/node/diskFileSystemProvider.js";
import { SyncDescriptor } from "../../../platform/instantiation/common/descriptors.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { InstantiationService } from "../../../platform/instantiation/common/instantiationService.js";
import { ServiceCollection } from "../../../platform/instantiation/common/serviceCollection.js";
import { ILanguagePackService } from "../../../platform/languagePacks/common/languagePacks.js";
import { NativeLanguagePackService } from "../../../platform/languagePacks/node/languagePacks.js";
import { ConsoleLogger, ILoggerService, ILogService, isDevConsoleLogForwardingEnabled, registerDevConsoleLogForwarder } from "../../../platform/log/common/log.js";
import { LoggerChannelClient } from "../../../platform/log/common/logIpc.js";
import product from "../../../platform/product/common/product.js";
import { IProductService } from "../../../platform/product/common/productService.js";
import { IRequestService } from "../../../platform/request/common/request.js";
import { IStorageService } from "../../../platform/storage/common/storage.js";
import { resolveCommonProperties } from "../../../platform/telemetry/common/commonProperties.js";
import { ICustomEndpointTelemetryService, ITelemetryService } from "../../../platform/telemetry/common/telemetry.js";
import { TelemetryAppenderChannel } from "../../../platform/telemetry/common/telemetryIpc.js";
import { TelemetryLogAppender } from "../../../platform/telemetry/common/telemetryLogAppender.js";
import { TelemetryService } from "../../../platform/telemetry/common/telemetryService.js";
import { supportsTelemetry, NullAppender, NullTelemetryService, getPiiPathsFromEnvironment, isInternalTelemetry, isLoggingOnly } from "../../../platform/telemetry/common/telemetryUtils.js";
import { CustomEndpointTelemetryService } from "../../../platform/telemetry/node/customEndpointTelemetryService.js";
import { ExtensionStorageService, IExtensionStorageService } from "../../../platform/extensionManagement/common/extensionStorage.js";
import { IgnoredExtensionsManagementService, IIgnoredExtensionsManagementService } from "../../../platform/userDataSync/common/ignoredExtensions.js";
import { IUserDataSyncLocalStoreService, IUserDataSyncLogService, IUserDataSyncEnablementService, IUserDataSyncService, IUserDataSyncStoreManagementService, IUserDataSyncStoreService, IUserDataSyncUtilService, registerConfiguration as registerUserDataSyncConfiguration, IUserDataSyncResourceProviderService } from "../../../platform/userDataSync/common/userDataSync.js";
import { IUserDataSyncAccountService, UserDataSyncAccountService } from "../../../platform/userDataSync/common/userDataSyncAccount.js";
import { UserDataSyncLocalStoreService } from "../../../platform/userDataSync/common/userDataSyncLocalStoreService.js";
import { UserDataSyncAccountServiceChannel, UserDataSyncStoreManagementServiceChannel } from "../../../platform/userDataSync/common/userDataSyncIpc.js";
import { UserDataSyncLogService } from "../../../platform/userDataSync/common/userDataSyncLog.js";
import { IUserDataSyncMachinesService, UserDataSyncMachinesService } from "../../../platform/userDataSync/common/userDataSyncMachines.js";
import { UserDataSyncEnablementService } from "../../../platform/userDataSync/common/userDataSyncEnablementService.js";
import { UserDataSyncService } from "../../../platform/userDataSync/common/userDataSyncService.js";
import { UserDataSyncServiceChannel } from "../../../platform/userDataSync/common/userDataSyncServiceIpc.js";
import { UserDataSyncStoreManagementService, UserDataSyncStoreService } from "../../../platform/userDataSync/common/userDataSyncStoreService.js";
import { IUserDataProfileStorageService } from "../../../platform/userDataProfile/common/userDataProfileStorageService.js";
import { SharedProcessUserDataProfileStorageService } from "../../../platform/userDataProfile/node/userDataProfileStorageService.js";
import { ActiveWindowManager } from "../../../platform/windows/node/windowTracker.js";
import { ISignService } from "../../../platform/sign/common/sign.js";
import { SignService } from "../../../platform/sign/node/signService.js";
import { ISharedTunnelsService } from "../../../platform/tunnel/common/tunnel.js";
import { SharedTunnelsService } from "../../../platform/tunnel/node/tunnelService.js";
import { ipcSharedProcessTunnelChannelName, ISharedProcessTunnelService } from "../../../platform/remote/common/sharedProcessTunnelService.js";
import { SharedProcessTunnelService } from "../../../platform/tunnel/node/sharedProcessTunnelService.js";
import { IUriIdentityService } from "../../../platform/uriIdentity/common/uriIdentity.js";
import { UriIdentityService } from "../../../platform/uriIdentity/common/uriIdentityService.js";
import { isLinux } from "../../../base/common/platform.js";
import { FileUserDataProvider } from "../../../platform/userData/common/fileUserDataProvider.js";
import { DiskFileSystemProviderClient, LOCAL_FILE_SYSTEM_CHANNEL_NAME } from "../../../platform/files/common/diskFileSystemProviderClient.js";
import { InspectProfilingService as V8InspectProfilingService } from "../../../platform/profiling/node/profilingService.js";
import { IV8InspectProfilingService } from "../../../platform/profiling/common/profiling.js";
import { IExtensionsScannerService } from "../../../platform/extensionManagement/common/extensionsScannerService.js";
import { ExtensionsScannerService } from "../../../platform/extensionManagement/node/extensionsScannerService.js";
import { ISSHRemoteAgentHostMainService, SSH_REMOTE_AGENT_HOST_CHANNEL } from "../../../platform/agentHost/common/sshRemoteAgentHost.js";
import { SSHRemoteAgentHostMainService } from "../../../platform/agentHost/node/sshRemoteAgentHostService.js";
import { IWSLRemoteAgentHostMainService, WSL_REMOTE_AGENT_HOST_CHANNEL } from "../../../platform/agentHost/common/wslRemoteAgentHost.js";
import { WSLRemoteAgentHostMainService } from "../../../platform/agentHost/node/wslRemoteAgentHostService.js";
import { ITunnelAgentHostMainService, ITunnelAgentHostHostingService, TUNNEL_AGENT_HOST_CHANNEL, TUNNEL_HOST_CHANNEL } from "../../../platform/agentHost/common/tunnelAgentHost.js";
import { TunnelAgentHostMainService } from "../../../platform/agentHost/node/tunnelAgentHostService.js";
import { TunnelHostMainService } from "../../../platform/agentHost/node/tunnelHostMainService.js";
import { IUserDataProfilesService } from "../../../platform/userDataProfile/common/userDataProfile.js";
import { IExtensionsProfileScannerService } from "../../../platform/extensionManagement/common/extensionsProfileScannerService.js";
import { PolicyChannelClient } from "../../../platform/policy/common/policyIpc.js";
import { IPolicyService, NullPolicyService } from "../../../platform/policy/common/policy.js";
import { UserDataProfilesService } from "../../../platform/userDataProfile/common/userDataProfileIpc.js";
import { OneDataSystemAppender } from "../../../platform/telemetry/node/1dsAppender.js";
import { UserDataProfilesCleaner } from "./contrib/userDataProfilesCleaner.js";
import { IRemoteTunnelService } from "../../../platform/remoteTunnel/common/remoteTunnel.js";
import { UserDataSyncResourceProviderService } from "../../../platform/userDataSync/common/userDataSyncResourceProvider.js";
import { ExtensionsContributions } from "./contrib/extensions.js";
import { localize } from "../../../nls.js";
import { LogService } from "../../../platform/log/common/logService.js";
import { ISharedProcessLifecycleService, SharedProcessLifecycleService } from "../../../platform/lifecycle/node/sharedProcessLifecycleService.js";
import { RemoteTunnelService } from "../../../platform/remoteTunnel/node/remoteTunnelService.js";
import { ExtensionsProfileScannerService } from "../../../platform/extensionManagement/node/extensionsProfileScannerService.js";
import { ExtensionRecommendationNotificationServiceChannelClient } from "../../../platform/extensionRecommendations/common/extensionRecommendationsIpc.js";
import { INativeHostService } from "../../../platform/native/common/native.js";
import { NativeHostService } from "../../../platform/native/common/nativeHostService.js";
import { UserDataAutoSyncService } from "../../../platform/userDataSync/node/userDataAutoSyncService.js";
import { ExtensionTipsService } from "../../../platform/extensionManagement/node/extensionTipsService.js";
import { IMainProcessService, MainProcessService } from "../../../platform/ipc/common/mainProcessService.js";
import { RemoteStorageService } from "../../../platform/storage/common/storageService.js";
import { IRemoteSocketFactoryService, RemoteSocketFactoryService } from "../../../platform/remote/common/remoteSocketFactoryService.js";
import { RemoteConnectionType } from "../../../platform/remote/common/remoteAuthorityResolver.js";
import { nodeSocketFactory } from "../../../platform/remote/node/nodeSocketFactory.js";
import { NativeEnvironmentService } from "../../../platform/environment/node/environmentService.js";
import { SharedProcessRawConnection, SharedProcessLifecycle } from "../../../platform/sharedProcess/common/sharedProcess.js";
import { getOSReleaseInfo } from "../../../base/node/osReleaseInfo.js";
import { getDesktopEnvironment } from "../../../base/common/desktopEnvironmentInfo.js";
import { getCodeDisplayProtocol, getDisplayProtocol } from "../../../base/node/osDisplayProtocolInfo.js";
import { RequestService } from "../../../platform/request/electron-utility/requestService.js";
import { DefaultExtensionsInitializer } from "./contrib/defaultExtensionsInitializer.js";
import { AllowedExtensionsService } from "../../../platform/extensionManagement/common/allowedExtensionsService.js";
import { IExtensionGalleryManifestService } from "../../../platform/extensionManagement/common/extensionGalleryManifest.js";
import { ExtensionGalleryManifestIPCService } from "../../../platform/extensionManagement/common/extensionGalleryManifestServiceIpc.js";
import { ISharedWebContentExtractorService } from "../../../platform/webContentExtractor/common/webContentExtractor.js";
import { SharedWebContentExtractorService } from "../../../platform/webContentExtractor/node/sharedWebContentExtractorService.js";
import { McpManagementService } from "../../../platform/mcp/node/mcpManagementService.js";
import { IAllowedMcpServersService, IMcpGalleryService, IMcpManagementService } from "../../../platform/mcp/common/mcpManagement.js";
import { IMcpResourceScannerService, McpResourceScannerService } from "../../../platform/mcp/common/mcpResourceScannerService.js";
import { McpGalleryService } from "../../../platform/mcp/common/mcpGalleryService.js";
import { McpManagementChannel } from "../../../platform/mcp/common/mcpManagementIpc.js";
import { AllowedMcpServersService } from "../../../platform/mcp/common/allowedMcpServersService.js";
import { IMcpGalleryManifestService } from "../../../platform/mcp/common/mcpGalleryManifest.js";
import { McpGalleryManifestIPCService } from "../../../platform/mcp/common/mcpGalleryManifestServiceIpc.js";
import { IMeteredConnectionService } from "../../../platform/meteredConnection/common/meteredConnection.js";
import { MeteredConnectionChannelClient, METERED_CONNECTION_CHANNEL } from "../../../platform/meteredConnection/common/meteredConnectionIpc.js";
import { PlaywrightChannel } from "../../../platform/browserView/node/playwrightChannel.js";
import { AgentNetworkFilterService } from "../../../platform/networkFilter/common/networkFilterService.js";
import { ILocalGitService } from "../../../platform/git/common/localGitService.js";
import { LocalGitService } from "../../../platform/git/node/localGitService.js";
class SharedProcessMain extends Disposable {
  constructor(configuration) {
    super();
    this.configuration = configuration;
    this.server = this._register(new UtilityProcessMessagePortServer(this));
    this.lifecycleService = void 0;
    this.onDidWindowConnectRaw = this._register(new Emitter());
    this.registerListeners();
  }
  registerListeners() {
    let didExit = false;
    const onExit = () => {
      if (!didExit) {
        didExit = true;
        this.lifecycleService?.fireOnWillShutdown();
        this.dispose();
      }
    };
    process.once("exit", onExit);
    once(process.parentPort, SharedProcessLifecycle.exit, onExit);
  }
  async init() {
    const instantiationService = await this.initServices();
    registerUserDataSyncConfiguration();
    instantiationService.invokeFunction((accessor) => {
      const logService = accessor.get(ILogService);
      const telemetryService = accessor.get(ITelemetryService);
      logService.trace("sharedProcess configuration", JSON.stringify(this.configuration));
      this.initChannels(accessor);
      this.registerErrorHandler(logService);
      this.reportClientOSInfo(telemetryService, logService);
    });
    this._register(combinedDisposable(
      instantiationService.createInstance(CodeCacheCleaner, this.configuration.codeCachePath),
      instantiationService.createInstance(LanguagePackCachedDataCleaner),
      instantiationService.createInstance(UnusedWorkspaceStorageDataCleaner),
      instantiationService.createInstance(LogsDataCleaner),
      instantiationService.createInstance(LocalizationsUpdater),
      instantiationService.createInstance(ExtensionsContributions),
      instantiationService.createInstance(UserDataProfilesCleaner),
      instantiationService.createInstance(DefaultExtensionsInitializer)
    ));
  }
  async initServices() {
    const services = new ServiceCollection();
    const productService = { _serviceBrand: void 0, ...product };
    services.set(IProductService, productService);
    const mainRouter = new StaticRouter((ctx) => ctx === "main");
    const mainProcessService = new MainProcessService(this.server, mainRouter);
    services.set(IMainProcessService, mainProcessService);
    const policyService = this.configuration.policiesData ? new PolicyChannelClient(this.configuration.policiesData, mainProcessService.getChannel("policy")) : new NullPolicyService();
    services.set(IPolicyService, policyService);
    const environmentService = new NativeEnvironmentService(this.configuration.args, productService);
    services.set(INativeEnvironmentService, environmentService);
    const loggerService = new LoggerChannelClient(void 0, this.configuration.logLevel, environmentService.logsHome, this.configuration.loggers.map((loggerResource) => ({ ...loggerResource, resource: URI.revive(loggerResource.resource) })), mainProcessService.getChannel("logger"));
    services.set(ILoggerService, loggerService);
    const sharedLogGroup = { id: "shared", name: localize("sharedLog", "Shared") };
    const logger = this._register(loggerService.createLogger("sharedprocess", { name: localize("sharedLog", "Shared"), group: sharedLogGroup }));
    const consoleLogger = this._register(new ConsoleLogger(logger.getLevel()));
    const logService = this._register(new LogService(logger, [consoleLogger]));
    if (!environmentService.isBuilt && isDevConsoleLogForwardingEnabled) {
      this._register(registerDevConsoleLogForwarder(logService));
    }
    services.set(ILogService, logService);
    this.lifecycleService = this._register(new SharedProcessLifecycleService(logService));
    services.set(ISharedProcessLifecycleService, this.lifecycleService);
    const fileService = this._register(new FileService(logService));
    services.set(IFileService, fileService);
    const diskFileSystemProvider = this._register(new DiskFileSystemProvider(logService));
    fileService.registerProvider(Schemas.file, diskFileSystemProvider);
    const uriIdentityService = new UriIdentityService(fileService);
    services.set(IUriIdentityService, uriIdentityService);
    const userDataProfilesService = this._register(new UserDataProfilesService(this.configuration.profiles.all, URI.revive(this.configuration.profiles.home).with({ scheme: environmentService.userRoamingDataHome.scheme }), mainProcessService.getChannel("userDataProfiles")));
    services.set(IUserDataProfilesService, userDataProfilesService);
    const userDataFileSystemProvider = this._register(new FileUserDataProvider(
      Schemas.file,
      // Specifically for user data, use the disk file system provider
      // from the main process to enable atomic read/write operations.
      // Since user data can change very frequently across multiple
      // processes, we want a single process handling these operations.
      this._register(new DiskFileSystemProviderClient(mainProcessService.getChannel(LOCAL_FILE_SYSTEM_CHANNEL_NAME), { pathCaseSensitive: isLinux })),
      Schemas.vscodeUserData,
      userDataProfilesService,
      uriIdentityService,
      logService
    ));
    fileService.registerProvider(Schemas.vscodeUserData, userDataFileSystemProvider);
    const configurationService = this._register(new ConfigurationService(userDataProfilesService.defaultProfile.settingsResource, fileService, policyService, logService));
    services.set(IConfigurationService, configurationService);
    const storageService = new RemoteStorageService(void 0, { defaultProfile: userDataProfilesService.defaultProfile, currentProfile: userDataProfilesService.defaultProfile }, mainProcessService, environmentService);
    services.set(IStorageService, storageService);
    this._register(toDisposable(() => storageService.flush()));
    await Promise.all([
      configurationService.initialize(),
      storageService.initialize()
    ]);
    const networkLogger = this._register(loggerService.createLogger(`network-shared`, { name: localize("networkk", "Network"), group: sharedLogGroup }));
    const requestService = new RequestService(configurationService, environmentService, this._register(new LogService(networkLogger)));
    services.set(IRequestService, requestService);
    services.set(IChecksumService, new SyncDescriptor(
      ChecksumService,
      void 0,
      false
      /* proxied to other processes */
    ));
    services.set(IV8InspectProfilingService, new SyncDescriptor(
      V8InspectProfilingService,
      void 0,
      false
      /* proxied to other processes */
    ));
    const nativeHostService = new NativeHostService(-1, mainProcessService);
    services.set(INativeHostService, nativeHostService);
    const meteredConnectionService = this._register(new MeteredConnectionChannelClient(mainProcessService.getChannel(METERED_CONNECTION_CHANNEL)));
    services.set(IMeteredConnectionService, meteredConnectionService);
    services.set(IDownloadService, new SyncDescriptor(DownloadService, void 0, true));
    const activeWindowManager = this._register(new ActiveWindowManager(nativeHostService));
    const activeWindowRouter = new StaticRouter((ctx) => activeWindowManager.getActiveClientId().then((id) => ctx === id));
    services.set(IExtensionRecommendationNotificationService, new ExtensionRecommendationNotificationServiceChannelClient(this.server.getChannel("extensionRecommendationNotification", activeWindowRouter)));
    let telemetryService;
    const appenders = [];
    const internalTelemetry = isInternalTelemetry(productService, configurationService);
    if (supportsTelemetry(productService, environmentService)) {
      const logAppender = new TelemetryLogAppender("", false, loggerService, environmentService, productService);
      appenders.push(logAppender);
      if (!isLoggingOnly(productService, environmentService) && productService.aiConfig?.ariaKey) {
        const collectorAppender = new OneDataSystemAppender(requestService, internalTelemetry, "monacoworkbench", null, productService.aiConfig.ariaKey);
        this._register(toDisposable(() => collectorAppender.flush()));
        appenders.push(collectorAppender);
      }
      telemetryService = new TelemetryService({
        appenders,
        commonProperties: resolveCommonProperties(release(), hostname(), process.arch, productService.commit, productService.version, this.configuration.machineId, this.configuration.sqmId, this.configuration.devDeviceId, internalTelemetry, productService.date),
        sendErrorTelemetry: true,
        piiPaths: getPiiPathsFromEnvironment(environmentService),
        meteredConnectionService
      }, configurationService, productService);
    } else {
      telemetryService = NullTelemetryService;
      const nullAppender = NullAppender;
      appenders.push(nullAppender);
    }
    this.server.registerChannel("telemetryAppender", new TelemetryAppenderChannel(appenders));
    services.set(ITelemetryService, telemetryService);
    const customEndpointTelemetryService = new CustomEndpointTelemetryService(configurationService, telemetryService, loggerService, environmentService, productService);
    services.set(ICustomEndpointTelemetryService, customEndpointTelemetryService);
    services.set(IExtensionsProfileScannerService, new SyncDescriptor(ExtensionsProfileScannerService, void 0, true));
    services.set(IExtensionsScannerService, new SyncDescriptor(ExtensionsScannerService, void 0, true));
    services.set(IExtensionSignatureVerificationService, new SyncDescriptor(ExtensionSignatureVerificationService, void 0, true));
    services.set(IAllowedExtensionsService, new SyncDescriptor(AllowedExtensionsService, void 0, true));
    services.set(INativeServerExtensionManagementService, new SyncDescriptor(ExtensionManagementService, void 0, true));
    services.set(IAllowedMcpServersService, new SyncDescriptor(AllowedMcpServersService, void 0, true));
    services.set(IMcpGalleryManifestService, new McpGalleryManifestIPCService(this.server));
    services.set(IMcpGalleryService, new SyncDescriptor(McpGalleryService, void 0, true));
    services.set(IMcpResourceScannerService, new SyncDescriptor(McpResourceScannerService, void 0, true));
    services.set(IMcpManagementService, new SyncDescriptor(McpManagementService, void 0, true));
    services.set(IExtensionGalleryManifestService, new ExtensionGalleryManifestIPCService(this.server, logService, productService));
    services.set(IExtensionGalleryService, new SyncDescriptor(ExtensionGalleryService, void 0, true));
    services.set(IExtensionTipsService, new SyncDescriptor(
      ExtensionTipsService,
      void 0,
      false
      /* Eagerly scans and computes exe based recommendations */
    ));
    services.set(ILanguagePackService, new SyncDescriptor(
      NativeLanguagePackService,
      void 0,
      false
      /* proxied to other processes */
    ));
    services.set(IDiagnosticsService, new SyncDescriptor(
      DiagnosticsService,
      void 0,
      false
      /* proxied to other processes */
    ));
    services.set(IUserDataSyncAccountService, new SyncDescriptor(UserDataSyncAccountService, void 0, true));
    services.set(IUserDataSyncLogService, new SyncDescriptor(UserDataSyncLogService, void 0, true));
    services.set(IUserDataSyncUtilService, ProxyChannel.toService(this.server.getChannel("userDataSyncUtil", (client) => client.ctx !== "main")));
    services.set(IGlobalExtensionEnablementService, new SyncDescriptor(
      GlobalExtensionEnablementService,
      void 0,
      false
      /* Eagerly resets installed extensions */
    ));
    services.set(IIgnoredExtensionsManagementService, new SyncDescriptor(IgnoredExtensionsManagementService, void 0, true));
    services.set(IExtensionStorageService, new SyncDescriptor(ExtensionStorageService));
    services.set(IUserDataSyncStoreManagementService, new SyncDescriptor(UserDataSyncStoreManagementService, void 0, true));
    services.set(IUserDataSyncStoreService, new SyncDescriptor(UserDataSyncStoreService, void 0, true));
    services.set(IUserDataSyncMachinesService, new SyncDescriptor(UserDataSyncMachinesService, void 0, true));
    services.set(IUserDataSyncLocalStoreService, new SyncDescriptor(
      UserDataSyncLocalStoreService,
      void 0,
      false
      /* Eagerly cleans up old backups */
    ));
    services.set(IUserDataSyncEnablementService, new SyncDescriptor(UserDataSyncEnablementService, void 0, true));
    services.set(IUserDataSyncService, new SyncDescriptor(
      UserDataSyncService,
      void 0,
      false
      /* Initializes the Sync State */
    ));
    services.set(IUserDataProfileStorageService, new SyncDescriptor(SharedProcessUserDataProfileStorageService, void 0, true));
    services.set(IUserDataSyncResourceProviderService, new SyncDescriptor(UserDataSyncResourceProviderService, void 0, true));
    services.set(ISignService, new SyncDescriptor(
      SignService,
      void 0,
      false
      /* proxied to other processes */
    ));
    const remoteSocketFactoryService = new RemoteSocketFactoryService();
    services.set(IRemoteSocketFactoryService, remoteSocketFactoryService);
    remoteSocketFactoryService.register(RemoteConnectionType.WebSocket, nodeSocketFactory);
    services.set(ISharedTunnelsService, new SyncDescriptor(SharedTunnelsService));
    services.set(ISharedProcessTunnelService, new SyncDescriptor(SharedProcessTunnelService));
    services.set(IRemoteTunnelService, new SyncDescriptor(RemoteTunnelService));
    services.set(ISharedWebContentExtractorService, new SyncDescriptor(SharedWebContentExtractorService));
    services.set(ILocalGitService, new SyncDescriptor(
      LocalGitService,
      void 0,
      false
      /* proxied to other processes */
    ));
    services.set(ISSHRemoteAgentHostMainService, new SyncDescriptor(SSHRemoteAgentHostMainService, void 0, true));
    services.set(IWSLRemoteAgentHostMainService, new SyncDescriptor(WSLRemoteAgentHostMainService, void 0, true));
    services.set(ITunnelAgentHostMainService, new SyncDescriptor(TunnelAgentHostMainService, void 0, true));
    services.set(ITunnelAgentHostHostingService, new SyncDescriptor(TunnelHostMainService, void 0, true));
    return new InstantiationService(services);
  }
  initChannels(accessor) {
    const channel = new ExtensionManagementChannel(accessor.get(IExtensionManagementService), () => null);
    this.server.registerChannel("extensions", channel);
    const mcpManagementChannel = new McpManagementChannel(accessor.get(IMcpManagementService), () => null);
    this.server.registerChannel("mcpManagement", mcpManagementChannel);
    const languagePacksChannel = ProxyChannel.fromService(accessor.get(ILanguagePackService), this._store);
    this.server.registerChannel("languagePacks", languagePacksChannel);
    const diagnosticsChannel = ProxyChannel.fromService(accessor.get(IDiagnosticsService), this._store);
    this.server.registerChannel("diagnostics", diagnosticsChannel);
    const extensionTipsChannel = new ExtensionTipsChannel(accessor.get(IExtensionTipsService));
    this.server.registerChannel("extensionTipsService", extensionTipsChannel);
    const checksumChannel = ProxyChannel.fromService(accessor.get(IChecksumService), this._store);
    this.server.registerChannel("checksum", checksumChannel);
    const profilingChannel = ProxyChannel.fromService(accessor.get(IV8InspectProfilingService), this._store);
    this.server.registerChannel("v8InspectProfiling", profilingChannel);
    const userDataSyncMachineChannel = ProxyChannel.fromService(accessor.get(IUserDataSyncMachinesService), this._store);
    this.server.registerChannel("userDataSyncMachines", userDataSyncMachineChannel);
    const customEndpointTelemetryChannel = ProxyChannel.fromService(accessor.get(ICustomEndpointTelemetryService), this._store);
    this.server.registerChannel("customEndpointTelemetry", customEndpointTelemetryChannel);
    const userDataSyncAccountChannel = new UserDataSyncAccountServiceChannel(accessor.get(IUserDataSyncAccountService));
    this.server.registerChannel("userDataSyncAccount", userDataSyncAccountChannel);
    const userDataSyncStoreManagementChannel = new UserDataSyncStoreManagementServiceChannel(accessor.get(IUserDataSyncStoreManagementService));
    this.server.registerChannel("userDataSyncStoreManagement", userDataSyncStoreManagementChannel);
    const userDataSyncChannel = new UserDataSyncServiceChannel(accessor.get(IUserDataSyncService), accessor.get(IUserDataProfilesService), accessor.get(ILogService));
    this.server.registerChannel("userDataSync", userDataSyncChannel);
    const userDataAutoSync = this._register(accessor.get(IInstantiationService).createInstance(UserDataAutoSyncService));
    this.server.registerChannel("userDataAutoSync", ProxyChannel.fromService(userDataAutoSync, this._store));
    this.server.registerChannel("IUserDataSyncResourceProviderService", ProxyChannel.fromService(accessor.get(IUserDataSyncResourceProviderService), this._store));
    const sharedProcessTunnelChannel = ProxyChannel.fromService(accessor.get(ISharedProcessTunnelService), this._store);
    this.server.registerChannel(ipcSharedProcessTunnelChannelName, sharedProcessTunnelChannel);
    const remoteTunnelChannel = ProxyChannel.fromService(accessor.get(IRemoteTunnelService), this._store);
    this.server.registerChannel("remoteTunnel", remoteTunnelChannel);
    const webContentExtractorChannel = ProxyChannel.fromService(accessor.get(ISharedWebContentExtractorService), this._store);
    this.server.registerChannel("sharedWebContentExtractor", webContentExtractorChannel);
    const agentNetworkFilterService = this._register(new AgentNetworkFilterService(accessor.get(IConfigurationService)));
    const playwrightChannel = this._register(new PlaywrightChannel(this.server, accessor.get(IMainProcessService), accessor.get(ILogService), agentNetworkFilterService, accessor.get(ITelemetryService)));
    this.server.registerChannel("playwright", playwrightChannel);
    const localGitChannel = ProxyChannel.fromService(accessor.get(ILocalGitService), this._store);
    this.server.registerChannel("localGit", localGitChannel);
    const sshRemoteAgentHostChannel = ProxyChannel.fromService(accessor.get(ISSHRemoteAgentHostMainService), this._store);
    this.server.registerChannel(SSH_REMOTE_AGENT_HOST_CHANNEL, sshRemoteAgentHostChannel);
    const wslRemoteAgentHostChannel = ProxyChannel.fromService(accessor.get(IWSLRemoteAgentHostMainService), this._store);
    this.server.registerChannel(WSL_REMOTE_AGENT_HOST_CHANNEL, wslRemoteAgentHostChannel);
    const tunnelAgentHostChannel = ProxyChannel.fromService(accessor.get(ITunnelAgentHostMainService), this._store);
    this.server.registerChannel(TUNNEL_AGENT_HOST_CHANNEL, tunnelAgentHostChannel);
    const tunnelHostChannel = ProxyChannel.fromService(accessor.get(ITunnelAgentHostHostingService), this._store);
    this.server.registerChannel(TUNNEL_HOST_CHANNEL, tunnelHostChannel);
  }
  registerErrorHandler(logService) {
    process.on("uncaughtException", (error) => onUnexpectedError(error));
    process.on("unhandledRejection", (reason) => onUnexpectedError(reason));
    setUnexpectedErrorHandler((error) => {
      const message = toErrorMessage(error, true);
      if (!message) {
        return;
      }
      logService.error(`[uncaught exception in sharedProcess]: ${message}`);
    });
  }
  async reportClientOSInfo(telemetryService, logService) {
    if (isLinux) {
      const [releaseInfo, displayProtocol] = await Promise.all([
        getOSReleaseInfo(logService.error.bind(logService)),
        getDisplayProtocol(logService.error.bind(logService))
      ]);
      const desktopEnvironment = getDesktopEnvironment();
      const codeSessionType = getCodeDisplayProtocol(displayProtocol, this.configuration.args["ozone-platform"]);
      if (releaseInfo) {
        telemetryService.publicLog2("clientPlatformInfo", {
          platformId: releaseInfo.id,
          platformVersionId: releaseInfo.version_id,
          platformIdLike: releaseInfo.id_like,
          desktopEnvironment,
          displayProtocol,
          codeDisplayProtocol: codeSessionType
        });
      }
    }
  }
  handledClientConnection(e) {
    if (e.data !== SharedProcessRawConnection.response) {
      return false;
    }
    const port = e.ports.at(0);
    if (port) {
      this.onDidWindowConnectRaw.fire(port);
      return true;
    }
    return false;
  }
}
async function main(configuration) {
  try {
    const sharedProcess = new SharedProcessMain(configuration);
    process.parentPort.postMessage(SharedProcessLifecycle.ipcReady);
    await sharedProcess.init();
    process.parentPort.postMessage(SharedProcessLifecycle.initDone);
  } catch (error) {
    process.parentPort.postMessage({ error: error.toString() });
  }
}
const handle = setTimeout(() => {
  process.parentPort.postMessage({ warning: "[SharedProcess] did not receive configuration within 30s..." });
}, 3e4);
process.parentPort.once("message", (e) => {
  clearTimeout(handle);
  main(e.data);
});
export {
  main
};
