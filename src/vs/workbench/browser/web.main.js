import { mark } from "../../base/common/performance.js";
import { domContentLoaded, detectFullscreen, getCookieValue, getWindow } from "../../base/browser/dom.js";
import { ServiceCollection } from "../../platform/instantiation/common/serviceCollection.js";
import { ILogService, ConsoleLogger, getLogLevel, ILoggerService } from "../../platform/log/common/log.js";
import { ConsoleLogInAutomationLogger } from "../../platform/log/browser/log.js";
import { Disposable, DisposableStore, toDisposable } from "../../base/common/lifecycle.js";
import { BrowserWorkbenchEnvironmentService, IBrowserWorkbenchEnvironmentService } from "../services/environment/browser/environmentService.js";
import { Workbench } from "./workbench.js";
import { RemoteFileSystemProviderClient } from "../services/remote/common/remoteFileSystemProviderClient.js";
import { IProductService } from "../../platform/product/common/productService.js";
import product from "../../platform/product/common/product.js";
import { RemoteAgentService } from "../services/remote/browser/remoteAgentService.js";
import { RemoteAuthorityResolverService } from "../../platform/remote/browser/remoteAuthorityResolverService.js";
import { IRemoteAuthorityResolverService, RemoteConnectionType } from "../../platform/remote/common/remoteAuthorityResolver.js";
import { IRemoteAgentService } from "../services/remote/common/remoteAgentService.js";
import { IFileService } from "../../platform/files/common/files.js";
import { FileService } from "../../platform/files/common/fileService.js";
import { Schemas, connectionTokenCookieName } from "../../base/common/network.js";
import { IWorkspaceContextService, UNKNOWN_EMPTY_WINDOW_WORKSPACE, isTemporaryWorkspace, isWorkspaceIdentifier } from "../../platform/workspace/common/workspace.js";
import { IWorkbenchConfigurationService } from "../services/configuration/common/configuration.js";
import { onUnexpectedError, ErrorNoTelemetry } from "../../base/common/errors.js";
import { setFullscreen } from "../../base/browser/browser.js";
import { URI } from "../../base/common/uri.js";
import { WorkspaceService } from "../services/configuration/browser/configurationService.js";
import { ConfigurationCache } from "../services/configuration/common/configurationCache.js";
import { ISignService } from "../../platform/sign/common/sign.js";
import { SignService } from "../../platform/sign/browser/signService.js";
import { BrowserStorageService } from "../services/storage/browser/storageService.js";
import { IStorageService } from "../../platform/storage/common/storage.js";
import { toLocalISOString } from "../../base/common/date.js";
import { isWorkspaceToOpen, isFolderToOpen } from "../../platform/window/common/window.js";
import { getSingleFolderWorkspaceIdentifier, getWorkspaceIdentifier } from "../../platform/workspaces/common/workspaceIdentifier.js";
import { InMemoryFileSystemProvider } from "../../platform/files/common/inMemoryFilesystemProvider.js";
import { ICommandService } from "../../platform/commands/common/commands.js";
import { IndexedDBFileSystemProvider } from "../../platform/files/browser/indexedDBFileSystemProvider.js";
import { BrowserRequestService } from "../services/request/browser/requestService.js";
import { IRequestService } from "../../platform/request/common/request.js";
import { IUserDataInitializationService, UserDataInitializationService } from "../services/userData/browser/userDataInit.js";
import { UserDataSyncStoreManagementService } from "../../platform/userDataSync/common/userDataSyncStoreService.js";
import { IUserDataSyncStoreManagementService } from "../../platform/userDataSync/common/userDataSync.js";
import { ILifecycleService } from "../services/lifecycle/common/lifecycle.js";
import { Action2, MenuId, registerAction2 } from "../../platform/actions/common/actions.js";
import { IInstantiationService } from "../../platform/instantiation/common/instantiation.js";
import { localize, localize2 } from "../../nls.js";
import { Categories } from "../../platform/action/common/actionCommonCategories.js";
import { IDialogService } from "../../platform/dialogs/common/dialogs.js";
import { IHostService } from "../services/host/browser/host.js";
import { IUriIdentityService } from "../../platform/uriIdentity/common/uriIdentity.js";
import { UriIdentityService } from "../../platform/uriIdentity/common/uriIdentityService.js";
import { BrowserWindow } from "./window.js";
import { ITimerService } from "../services/timer/browser/timerService.js";
import { WorkspaceTrustEnablementService, WorkspaceTrustManagementService } from "../services/workspaces/common/workspaceTrust.js";
import { IWorkspaceTrustEnablementService, IWorkspaceTrustManagementService } from "../../platform/workspace/common/workspaceTrust.js";
import { HTMLFileSystemProvider } from "../../platform/files/browser/htmlFileSystemProvider.js";
import { TauriFileSystemProvider } from "../../platform/files/browser/tauriFileSystemProvider.js";
import { IOpenerService } from "../../platform/opener/common/opener.js";
import { mixin, safeStringify } from "../../base/common/objects.js";
import { IndexedDB } from "../../base/browser/indexedDB.js";
import { WebFileSystemAccess } from "../../platform/files/browser/webFileSystemAccess.js";
import { IProgressService } from "../../platform/progress/common/progress.js";
import { DelayedLogChannel } from "../services/output/common/delayedLogChannel.js";
import { dirname, joinPath } from "../../base/common/resources.js";
import { IUserDataProfilesService } from "../../platform/userDataProfile/common/userDataProfile.js";
import { IPolicyService } from "../../platform/policy/common/policy.js";
import { INativeManagedSettingsService, NullNativeManagedSettingsService } from "../../platform/policy/common/copilotManagedSettings.js";
import { IRemoteExplorerService } from "../services/remote/common/remoteExplorerService.js";
import { DisposableTunnel, TunnelProtocol } from "../../platform/tunnel/common/tunnel.js";
import { ILabelService } from "../../platform/label/common/label.js";
import { UserDataProfileService } from "../services/userDataProfile/common/userDataProfileService.js";
import { IUserDataProfileService } from "../services/userDataProfile/common/userDataProfile.js";
import { BrowserUserDataProfilesService } from "../../platform/userDataProfile/browser/userDataProfile.js";
import { DeferredPromise, timeout } from "../../base/common/async.js";
import { windowLogGroup, windowLogId } from "../services/log/common/logConstants.js";
import { LogService } from "../../platform/log/common/logService.js";
import { IRemoteSocketFactoryService, RemoteSocketFactoryService } from "../../platform/remote/common/remoteSocketFactoryService.js";
import { BrowserSocketFactory } from "../../platform/remote/browser/browserSocketFactory.js";
import { VSBuffer } from "../../base/common/buffer.js";
import { UserDataProfileInitializer } from "../services/userDataProfile/browser/userDataProfileInit.js";
import { UserDataSyncInitializer } from "../services/userDataSync/browser/userDataSyncInit.js";
import { BrowserRemoteResourceLoader } from "../services/remote/browser/browserRemoteResourceHandler.js";
import { BufferLogger } from "../../platform/log/common/bufferLog.js";
import { FileLoggerService } from "../../platform/log/common/fileLog.js";
import { IEmbedderTerminalService } from "../services/terminal/common/embedderTerminalService.js";
import { BrowserSecretStorageService } from "../services/secrets/browser/secretStorageService.js";
import { EncryptionService } from "../services/encryption/browser/encryptionService.js";
import { IEncryptionService } from "../../platform/encryption/common/encryptionService.js";
import { ISecretStorageService } from "../../platform/secrets/common/secrets.js";
import { TunnelSource } from "../services/remote/common/tunnelModel.js";
import { mainWindow } from "../../base/browser/window.js";
import { INotificationService, Severity } from "../../platform/notification/common/notification.js";
import { IDefaultAccountService } from "../../platform/defaultAccount/common/defaultAccount.js";
import { DefaultAccountService } from "../services/accounts/browser/defaultAccount.js";
import { AccountPolicyService, IAccountPolicyGateService } from "../services/policies/common/accountPolicyService.js";
class BrowserMain extends Disposable {
  constructor(domElement, configuration) {
    super();
    this.domElement = domElement;
    this.configuration = configuration;
    this.onWillShutdownDisposables = this._register(new DisposableStore());
    this.indexedDBFileSystemProviders = [];
    this.init();
  }
  init() {
    setFullscreen(!!detectFullscreen(mainWindow), mainWindow);
  }
  async open() {
    const [services] = await Promise.all([this.initServices(), domContentLoaded(getWindow(this.domElement))]);
    const workbench = this.createWorkbench(this.domElement, services.serviceCollection, services.logService);
    this.registerListeners(workbench);
    const instantiationService = workbench.startup();
    this._register(instantiationService.createInstance(BrowserWindow));
    services.logService.trace("workbench#open with configuration", safeStringify(this.configuration));
    return instantiationService.invokeFunction((accessor) => {
      const commandService = accessor.get(ICommandService);
      const lifecycleService = accessor.get(ILifecycleService);
      const timerService = accessor.get(ITimerService);
      const openerService = accessor.get(IOpenerService);
      const productService = accessor.get(IProductService);
      const progressService = accessor.get(IProgressService);
      const environmentService = accessor.get(IBrowserWorkbenchEnvironmentService);
      const instantiationService2 = accessor.get(IInstantiationService);
      const remoteExplorerService = accessor.get(IRemoteExplorerService);
      const labelService = accessor.get(ILabelService);
      const embedderTerminalService = accessor.get(IEmbedderTerminalService);
      const remoteAuthorityResolverService = accessor.get(IRemoteAuthorityResolverService);
      const notificationService = accessor.get(INotificationService);
      async function showMessage(severity, message, ...items) {
        const choice = new DeferredPromise();
        const handle = notificationService.prompt(severity, message, items.map((item) => ({
          label: item,
          run: () => choice.complete(item)
        })));
        const disposable = handle.onDidClose(() => {
          choice.complete(void 0);
          disposable.dispose();
        });
        const result = await choice.p;
        handle.close();
        return result;
      }
      let logger = void 0;
      return {
        commands: {
          executeCommand: (command, ...args) => commandService.executeCommand(command, ...args)
        },
        env: {
          async getUriScheme() {
            return productService.urlProtocol;
          },
          async retrievePerformanceMarks() {
            await timerService.whenReady();
            return timerService.getPerformanceMarks();
          },
          async openUri(uri) {
            return openerService.open(URI.isUri(uri) ? uri : URI.from(uri), {});
          }
        },
        logger: {
          log: (level, message) => {
            if (!logger) {
              logger = instantiationService2.createInstance(DelayedLogChannel, "webEmbedder", productService.embedderIdentifier || productService.nameShort, joinPath(dirname(environmentService.logFile), "webEmbedder.log"));
            }
            logger.log(level, message);
          }
        },
        window: {
          withProgress: (options, task) => progressService.withProgress(options, task),
          createTerminal: async (options) => embedderTerminalService.createTerminal(options),
          showInformationMessage: (message, ...items) => showMessage(Severity.Info, message, ...items)
        },
        workspace: {
          didResolveRemoteAuthority: async () => {
            if (!this.configuration.remoteAuthority) {
              return;
            }
            await remoteAuthorityResolverService.resolveAuthority(this.configuration.remoteAuthority);
          },
          openTunnel: async (tunnelOptions) => {
            const tunnel = await remoteExplorerService.forward({
              remote: tunnelOptions.remoteAddress,
              local: tunnelOptions.localAddressPort,
              name: tunnelOptions.label,
              source: {
                source: TunnelSource.Extension,
                description: labelService.getHostLabel(Schemas.vscodeRemote, this.configuration.remoteAuthority)
              },
              elevateIfNeeded: false,
              privacy: tunnelOptions.privacy
            }, {
              label: tunnelOptions.label,
              elevateIfNeeded: void 0,
              onAutoForward: void 0,
              requireLocalPort: void 0,
              protocol: tunnelOptions.protocol === TunnelProtocol.Https ? tunnelOptions.protocol : TunnelProtocol.Http
            });
            if (tunnel === void 0) {
              throw new ErrorNoTelemetry(`Could not open tunnel to ${tunnelOptions.remoteAddress.host}:${tunnelOptions.remoteAddress.port}.`);
            }
            if (typeof tunnel === "string") {
              throw new Error(tunnel);
            }
            return new class extends DisposableTunnel {
            }({
              port: tunnel.tunnelRemotePort,
              host: tunnel.tunnelRemoteHost
            }, tunnel.localAddress, () => tunnel.dispose());
          }
        },
        shutdown: () => lifecycleService.shutdown()
      };
    });
  }
  createWorkbench(domElement, serviceCollection, logService) {
    return new Workbench(domElement, void 0, serviceCollection, logService);
  }
  registerListeners(workbench) {
    this._register(workbench.onWillShutdown(() => this.onWillShutdownDisposables.clear()));
    this._register(workbench.onDidShutdown(() => this.dispose()));
  }
  async initServices() {
    const serviceCollection = new ServiceCollection();
    const workspace = this.resolveWorkspace();
    const productService = mixin({ _serviceBrand: void 0, ...product }, this.configuration.productConfiguration);
    serviceCollection.set(IProductService, productService);
    const logsPath = URI.file(toLocalISOString(/* @__PURE__ */ new Date()).replace(/-|:|\.\d+Z$/g, "")).with({ scheme: "vscode-log" });
    const environmentService = new BrowserWorkbenchEnvironmentService(workspace.id, logsPath, this.configuration, productService);
    serviceCollection.set(IBrowserWorkbenchEnvironmentService, environmentService);
    const fileLogger = new BufferLogger();
    const fileService = this._register(new FileService(fileLogger));
    serviceCollection.set(IFileService, fileService);
    const loggerService = new FileLoggerService(getLogLevel(environmentService), logsPath, fileService);
    serviceCollection.set(ILoggerService, loggerService);
    const otherLoggers = [new ConsoleLogger(loggerService.getLogLevel())];
    if (environmentService.isExtensionDevelopment && !!environmentService.extensionTestsLocationURI) {
      otherLoggers.push(new ConsoleLogInAutomationLogger(loggerService.getLogLevel()));
    }
    const logger = loggerService.createLogger(environmentService.logFile, { id: windowLogId, name: windowLogGroup.name, group: windowLogGroup });
    const logService = new LogService(logger, otherLoggers);
    serviceCollection.set(ILogService, logService);
    fileLogger.logger = logService;
    await this.registerIndexedDBFileSystemProviders(environmentService, fileService, logService, loggerService, logsPath);
    const connectionToken = environmentService.options.connectionToken || getCookieValue(connectionTokenCookieName);
    const remoteResourceLoader = this.configuration.remoteResourceProvider ? new BrowserRemoteResourceLoader(fileService, this.configuration.remoteResourceProvider) : void 0;
    const resourceUriProvider = this.configuration.resourceUriProvider ?? remoteResourceLoader?.getResourceUriProvider();
    const remoteAuthorityResolverService = new RemoteAuthorityResolverService(!environmentService.expectsResolverExtension, connectionToken, resourceUriProvider, this.configuration.serverBasePath, productService, logService);
    serviceCollection.set(IRemoteAuthorityResolverService, remoteAuthorityResolverService);
    const signService = new SignService(productService);
    serviceCollection.set(ISignService, signService);
    const uriIdentityService = new UriIdentityService(fileService);
    serviceCollection.set(IUriIdentityService, uriIdentityService);
    const userDataProfilesService = new BrowserUserDataProfilesService(environmentService, fileService, uriIdentityService, logService);
    serviceCollection.set(IUserDataProfilesService, userDataProfilesService);
    const currentProfile = await this.getCurrentProfile(workspace, userDataProfilesService, environmentService);
    await userDataProfilesService.setProfileForWorkspace(workspace, currentProfile);
    const userDataProfileService = new UserDataProfileService(currentProfile);
    serviceCollection.set(IUserDataProfileService, userDataProfileService);
    const remoteSocketFactoryService = new RemoteSocketFactoryService();
    remoteSocketFactoryService.register(RemoteConnectionType.WebSocket, new BrowserSocketFactory(this.configuration.webSocketFactory));
    serviceCollection.set(IRemoteSocketFactoryService, remoteSocketFactoryService);
    const remoteAgentService = this._register(new RemoteAgentService(remoteSocketFactoryService, userDataProfileService, environmentService, productService, remoteAuthorityResolverService, signService, logService));
    serviceCollection.set(IRemoteAgentService, remoteAgentService);
    this._register(RemoteFileSystemProviderClient.register(remoteAgentService, fileService, logService));
    const defaultAccountService = this._register(new DefaultAccountService(productService));
    serviceCollection.set(IDefaultAccountService, defaultAccountService);
    serviceCollection.set(INativeManagedSettingsService, new NullNativeManagedSettingsService());
    const policyService = new AccountPolicyService(logService, defaultAccountService);
    serviceCollection.set(IPolicyService, policyService);
    serviceCollection.set(IAccountPolicyGateService, policyService);
    const configurationService = await this.createWorkspaceAndDependentServices(serviceCollection, workspace, environmentService, userDataProfileService, userDataProfilesService, fileService, remoteAgentService, uriIdentityService, policyService, logService, loggerService, remoteAuthorityResolverService, productService);
    return { serviceCollection, configurationService, logService };
  }
  async createWorkspaceAndDependentServices(serviceCollection, workspace, environmentService, userDataProfileService, userDataProfilesService, fileService, remoteAgentService, uriIdentityService, policyService, logService, loggerService, remoteAuthorityResolverService, productService) {
    const { configurationService, storageService } = await this.createWorkspaceConfigAndStorageServices(serviceCollection, workspace, environmentService, userDataProfileService, userDataProfilesService, fileService, remoteAgentService, uriIdentityService, policyService, logService, remoteAuthorityResolverService);
    const requestService = new BrowserRequestService(remoteAgentService, configurationService, loggerService);
    serviceCollection.set(IRequestService, requestService);
    const userDataSyncStoreManagementService = new UserDataSyncStoreManagementService(productService, configurationService, storageService);
    serviceCollection.set(IUserDataSyncStoreManagementService, userDataSyncStoreManagementService);
    const encryptionService = new EncryptionService();
    serviceCollection.set(IEncryptionService, encryptionService);
    const secretStorageService = new BrowserSecretStorageService(storageService, encryptionService, environmentService, logService);
    serviceCollection.set(ISecretStorageService, secretStorageService);
    const userDataInitializers = [];
    userDataInitializers.push(new UserDataSyncInitializer(environmentService, secretStorageService, userDataSyncStoreManagementService, fileService, userDataProfilesService, storageService, productService, requestService, logService, uriIdentityService));
    if (environmentService.options?.profile) {
      userDataInitializers.push(new UserDataProfileInitializer(environmentService, fileService, userDataProfileService, storageService, logService, uriIdentityService, requestService));
    }
    const userDataInitializationService = new UserDataInitializationService(userDataInitializers);
    serviceCollection.set(IUserDataInitializationService, userDataInitializationService);
    try {
      await Promise.race(
        [
          // Do not block more than 5s
          timeout(5e3),
          this.initializeUserData(userDataInitializationService, configurationService)
        ]
      );
    } catch (error) {
      logService.error(error);
    }
    return configurationService;
  }
  /**
   * Creates and registers the workspace context, configuration, storage,
   * and workspace trust services. Override this to provide different
   * workspace/configuration implementations (e.g., sessions in-memory
   * workspace). Overrides must also register workspace trust services.
   */
  async createWorkspaceConfigAndStorageServices(serviceCollection, workspace, environmentService, userDataProfileService, userDataProfilesService, fileService, remoteAgentService, uriIdentityService, policyService, logService, remoteAuthorityResolverService) {
    const [configurationService, storageService] = await Promise.all([
      this.createWorkspaceService(workspace, environmentService, userDataProfileService, userDataProfilesService, fileService, remoteAgentService, uriIdentityService, policyService, logService).then((service) => {
        serviceCollection.set(IWorkspaceContextService, service);
        serviceCollection.set(IWorkbenchConfigurationService, service);
        return service;
      }),
      this.createStorageService(workspace, logService, userDataProfileService).then((service) => {
        serviceCollection.set(IStorageService, service);
        return service;
      })
    ]);
    const workspaceTrustEnablementService = new WorkspaceTrustEnablementService(configurationService, environmentService);
    serviceCollection.set(IWorkspaceTrustEnablementService, workspaceTrustEnablementService);
    const workspaceTrustManagementService = new WorkspaceTrustManagementService(configurationService, remoteAuthorityResolverService, storageService, uriIdentityService, environmentService, configurationService, workspaceTrustEnablementService, fileService);
    serviceCollection.set(IWorkspaceTrustManagementService, workspaceTrustManagementService);
    configurationService.updateWorkspaceTrust(workspaceTrustManagementService.isWorkspaceTrusted());
    this._register(workspaceTrustManagementService.onDidChangeTrust(() => configurationService.updateWorkspaceTrust(workspaceTrustManagementService.isWorkspaceTrusted())));
    return { configurationService, storageService };
  }
  async initializeUserData(userDataInitializationService, configurationService) {
    if (await userDataInitializationService.requiresInitialization()) {
      mark("code/willInitRequiredUserData");
      await userDataInitializationService.initializeRequiredResources();
      if (configurationService instanceof WorkspaceService) {
        await configurationService.reloadLocalUserConfiguration();
      }
      mark("code/didInitRequiredUserData");
    }
  }
  async registerIndexedDBFileSystemProviders(environmentService, fileService, logService, loggerService, logsPath) {
    let indexedDB;
    const userDataStore = "vscode-userdata-store";
    const logsStore = "vscode-logs-store";
    const handlesStore = "vscode-filehandles-store";
    try {
      indexedDB = await IndexedDB.create("vscode-web-db", 3, [userDataStore, logsStore, handlesStore]);
      this.onWillShutdownDisposables.add(toDisposable(() => indexedDB?.close()));
    } catch (error) {
      logService.error("Error while creating IndexedDB", error);
    }
    if (indexedDB) {
      const logFileSystemProvider = new IndexedDBFileSystemProvider(logsPath.scheme, indexedDB, logsStore, false);
      this.indexedDBFileSystemProviders.push(logFileSystemProvider);
      fileService.registerProvider(logsPath.scheme, logFileSystemProvider);
    } else {
      fileService.registerProvider(logsPath.scheme, new InMemoryFileSystemProvider());
    }
    let userDataProvider;
    if (indexedDB) {
      userDataProvider = new IndexedDBFileSystemProvider(Schemas.vscodeUserData, indexedDB, userDataStore, true);
      this.indexedDBFileSystemProviders.push(userDataProvider);
      this.registerDeveloperActions(userDataProvider);
    } else {
      logService.info("Using in-memory user data provider");
      userDataProvider = new InMemoryFileSystemProvider();
    }
    fileService.registerProvider(Schemas.vscodeUserData, userDataProvider);
    if (globalThis.__tauri_fs__ || mainWindow.__tauri_fs__) {
      fileService.registerProvider(Schemas.file, new TauriFileSystemProvider(logService));
    } else if (WebFileSystemAccess.supported(mainWindow)) {
      fileService.registerProvider(Schemas.file, new HTMLFileSystemProvider(indexedDB, handlesStore, logService));
    }
    fileService.registerProvider(Schemas.tmp, new InMemoryFileSystemProvider());
  }
  registerDeveloperActions(provider) {
    this._register(registerAction2(class ResetUserDataAction extends Action2 {
      constructor() {
        super({
          id: "workbench.action.resetUserData",
          title: localize2("reset", "Reset User Data"),
          category: Categories.Developer,
          menu: {
            id: MenuId.CommandPalette
          }
        });
      }
      async run(accessor) {
        const dialogService = accessor.get(IDialogService);
        const hostService = accessor.get(IHostService);
        const storageService = accessor.get(IStorageService);
        const logService = accessor.get(ILogService);
        const result = await dialogService.confirm({
          message: localize("reset user data message", "Would you like to reset your data (settings, keybindings, extensions, snippets and UI State) and reload?")
        });
        if (result.confirmed) {
          try {
            await provider?.reset();
            if (storageService instanceof BrowserStorageService) {
              await storageService.clear();
            }
          } catch (error) {
            logService.error(error);
            throw error;
          }
        }
        hostService.reload();
      }
    }));
  }
  async createStorageService(workspace, logService, userDataProfileService) {
    const storageService = new BrowserStorageService(workspace, userDataProfileService, logService);
    try {
      await storageService.initialize();
      this.onWillShutdownDisposables.add(toDisposable(() => storageService.close()));
      return storageService;
    } catch (error) {
      onUnexpectedError(error);
      logService.error(error);
      return storageService;
    }
  }
  async createWorkspaceService(workspace, environmentService, userDataProfileService, userDataProfilesService, fileService, remoteAgentService, uriIdentityService, policyService, logService) {
    if (isWorkspaceIdentifier(workspace) && isTemporaryWorkspace(workspace.configPath)) {
      try {
        const emptyWorkspace = { folders: [] };
        await fileService.createFile(workspace.configPath, VSBuffer.fromString(JSON.stringify(emptyWorkspace, null, "	")), { overwrite: false });
      } catch (error) {
      }
    }
    const configurationCache = new ConfigurationCache([Schemas.file, Schemas.vscodeUserData, Schemas.tmp], environmentService, fileService);
    const workspaceService = new WorkspaceService({ remoteAuthority: this.configuration.remoteAuthority, configurationCache }, environmentService, userDataProfileService, userDataProfilesService, fileService, remoteAgentService, uriIdentityService, logService, policyService);
    try {
      await workspaceService.initialize(workspace);
      return workspaceService;
    } catch (error) {
      onUnexpectedError(error);
      logService.error(error);
      return workspaceService;
    }
  }
  async getCurrentProfile(workspace, userDataProfilesService, environmentService) {
    const profileName = environmentService.options?.profile?.name ?? environmentService.profile;
    if (profileName) {
      const profile = userDataProfilesService.profiles.find((p) => p.name === profileName);
      if (profile) {
        return profile;
      }
      return userDataProfilesService.createNamedProfile(profileName, void 0, workspace);
    }
    return userDataProfilesService.getProfileForWorkspace(workspace) ?? userDataProfilesService.defaultProfile;
  }
  resolveWorkspace() {
    let workspace = void 0;
    if (this.configuration.workspaceProvider) {
      workspace = this.configuration.workspaceProvider.workspace;
    }
    if (workspace && isWorkspaceToOpen(workspace)) {
      return getWorkspaceIdentifier(workspace.workspaceUri);
    }
    if (workspace && isFolderToOpen(workspace)) {
      return getSingleFolderWorkspaceIdentifier(workspace.folderUri);
    }
    return UNKNOWN_EMPTY_WINDOW_WORKSPACE;
  }
}
export {
  BrowserMain
};
