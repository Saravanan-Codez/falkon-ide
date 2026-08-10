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
import { runWhenWindowIdle } from "../../../../base/browser/dom.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { Schemas } from "../../../../base/common/network.js";
import * as performance from "../../../../base/common/performance.js";
import { isCI } from "../../../../base/common/platform.js";
import * as nls from "../../../../nls.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IExtensionGalleryService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { INotificationService, NotificationPriority, Severity } from "../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { PersistentConnectionEventType } from "../../../../platform/remote/common/remoteAgentConnection.js";
import { IRemoteAuthorityResolverService, RemoteAuthorityResolverError, RemoteAuthorityResolverErrorCode, RemoteConnectionType, getRemoteAuthorityPrefix } from "../../../../platform/remote/common/remoteAuthorityResolver.js";
import { IRemoteExtensionsScannerService } from "../../../../platform/remote/common/remoteExtensionsScanner.js";
import { getRemoteName, isLoopbackHost, parseAuthorityWithPort } from "../../../../platform/remote/common/remoteHosts.js";
import { updateProxyConfigurationsScope } from "../../../../platform/request/common/request.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IWorkspaceTrustManagementService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { EnablementState, IWorkbenchExtensionEnablementService, IWorkbenchExtensionManagementService } from "../../extensionManagement/common/extensionManagement.js";
import { WebWorkerExtensionHost } from "../browser/webWorkerExtensionHost.js";
import { AbstractExtensionService, ExtensionHostCrashTracker, LocalExtensions, RemoteExtensions, ResolverExtensions, checkEnabledAndProposedAPI, extensionIsEnabled, isResolverExtension } from "../common/abstractExtensionService.js";
import { parseExtensionDevOptions } from "../common/extensionDevOptions.js";
import { ExtensionHostKind, ExtensionRunningPreference, extensionHostKindToString, extensionRunningPreferenceToString } from "../common/extensionHostKind.js";
import { ExtensionHostExitCode } from "../common/extensionHostProtocol.js";
import { IExtensionManifestPropertiesService } from "../common/extensionManifestPropertiesService.js";
import { filterExtensionDescriptions } from "../common/extensionRunningLocationTracker.js";
import { ExtensionHostExtensions, ExtensionHostStartup, IExtensionService, toExtension, webWorkerExtHostConfig } from "../common/extensions.js";
import { ExtensionsProposedApi } from "../common/extensionsProposedApi.js";
import { RemoteExtensionHost } from "../common/remoteExtensionHost.js";
import { CachedExtensionScanner } from "./cachedExtensionScanner.js";
import { NativeLocalProcessExtensionHost } from "./localProcessExtensionHost.js";
import { IHostService } from "../../host/browser/host.js";
import { ILifecycleService, LifecyclePhase } from "../../lifecycle/common/lifecycle.js";
import { IRemoteAgentService } from "../../remote/common/remoteAgentService.js";
import { IRemoteExplorerService } from "../../remote/common/remoteExplorerService.js";
import { AsyncIterableProducer } from "../../../../base/common/async.js";
let NativeExtensionService = class extends AbstractExtensionService {
  constructor(instantiationService, notificationService, environmentService, telemetryService, extensionEnablementService, fileService, productService, extensionManagementService, contextService, configurationService, extensionManifestPropertiesService, logService, remoteAgentService, remoteExtensionsScannerService, lifecycleService, remoteAuthorityResolverService, _nativeHostService, _hostService, _remoteExplorerService, _extensionGalleryService, _workspaceTrustManagementService, dialogService) {
    const extensionsProposedApi = instantiationService.createInstance(ExtensionsProposedApi);
    const extensionScanner = instantiationService.createInstance(CachedExtensionScanner);
    const extensionHostFactory = new NativeExtensionHostFactory(
      extensionsProposedApi,
      extensionScanner,
      () => this._getExtensionRegistrySnapshotWhenReady(),
      instantiationService,
      environmentService,
      extensionEnablementService,
      configurationService,
      remoteAgentService,
      remoteAuthorityResolverService,
      logService
    );
    super(
      { hasLocalProcess: true, allowRemoteExtensionsInLocalWebWorker: false },
      extensionsProposedApi,
      extensionHostFactory,
      new NativeExtensionHostKindPicker(environmentService, configurationService, logService),
      instantiationService,
      notificationService,
      environmentService,
      telemetryService,
      extensionEnablementService,
      fileService,
      productService,
      extensionManagementService,
      contextService,
      configurationService,
      extensionManifestPropertiesService,
      logService,
      remoteAgentService,
      remoteExtensionsScannerService,
      lifecycleService,
      remoteAuthorityResolverService,
      dialogService
    );
    this._nativeHostService = _nativeHostService;
    this._hostService = _hostService;
    this._remoteExplorerService = _remoteExplorerService;
    this._extensionGalleryService = _extensionGalleryService;
    this._workspaceTrustManagementService = _workspaceTrustManagementService;
    this._localCrashTracker = new ExtensionHostCrashTracker();
    this._extensionScanner = extensionScanner;
    lifecycleService.when(LifecyclePhase.Ready).then(() => {
      runWhenWindowIdle(
        mainWindow,
        () => {
          this._initializeIfNeeded();
        },
        50
        /*max delay*/
      );
    });
  }
  async _scanAllLocalExtensions() {
    return this._extensionScanner.scannedExtensions;
  }
  _onExtensionHostCrashed(extensionHost, code, signal) {
    const activatedExtensions = [];
    const extensionsStatus = this.getExtensionsStatus();
    for (const key of Object.keys(extensionsStatus)) {
      const extensionStatus = extensionsStatus[key];
      if (extensionStatus.activationStarted && extensionHost.containsExtension(extensionStatus.id)) {
        activatedExtensions.push(extensionStatus.id);
      }
    }
    super._onExtensionHostCrashed(extensionHost, code, signal);
    if (extensionHost.kind === ExtensionHostKind.LocalProcess) {
      if (code === ExtensionHostExitCode.VersionMismatch) {
        this._notificationService.prompt(
          Severity.Error,
          nls.localize("extensionService.versionMismatchCrash", "Extension host cannot start: version mismatch."),
          [{
            label: nls.localize("relaunch", "Relaunch VS Code"),
            run: () => {
              this._instantiationService.invokeFunction((accessor) => {
                const hostService = accessor.get(IHostService);
                hostService.restart();
              });
            }
          }]
        );
        return;
      }
      this._logExtensionHostCrash(extensionHost);
      this._sendExtensionHostCrashTelemetry(code, signal, activatedExtensions);
      this._localCrashTracker.registerCrash();
      if (this._localCrashTracker.shouldAutomaticallyRestart()) {
        this._logService.info(`Automatically restarting the extension host.`);
        this._notificationService.status(nls.localize("extensionService.autoRestart", "The extension host terminated unexpectedly. Restarting..."), { hideAfter: 5e3 });
        this.startExtensionHosts();
      } else {
        const choices = [];
        if (this._environmentService.isBuilt) {
          choices.push({
            label: nls.localize("startBisect", "Start Extension Bisect"),
            run: () => {
              this._instantiationService.invokeFunction((accessor) => {
                const commandService = accessor.get(ICommandService);
                commandService.executeCommand("extension.bisect.start");
              });
            }
          });
        } else {
          choices.push({
            label: nls.localize("devTools", "Open Developer Tools"),
            run: () => this._nativeHostService.openDevTools()
          });
        }
        choices.push({
          label: nls.localize("restart", "Restart Extension Host"),
          run: () => this.startExtensionHosts()
        });
        if (this._environmentService.isBuilt) {
          choices.push({
            label: nls.localize("learnMore", "Learn More"),
            run: () => {
              this._instantiationService.invokeFunction((accessor) => {
                const openerService = accessor.get(IOpenerService);
                openerService.open("https://aka.ms/vscode-extension-bisect");
              });
            }
          });
        }
        this._notificationService.prompt(Severity.Error, nls.localize("extensionService.crash", "Extension host terminated unexpectedly 3 times within the last 5 minutes."), choices);
      }
    }
  }
  _sendExtensionHostCrashTelemetry(code, signal, activatedExtensions) {
    this._telemetryService.publicLog2("extensionHostCrash", {
      code,
      signal,
      extensionIds: activatedExtensions.map((e) => e.value)
    });
    for (const extensionId of activatedExtensions) {
      this._telemetryService.publicLog2("extensionHostCrashExtension", {
        code,
        signal,
        extensionId: extensionId.value
      });
    }
  }
  // --- impl
  async _resolveAuthority(remoteAuthority) {
    const authorityPlusIndex = remoteAuthority.indexOf("+");
    if (authorityPlusIndex === -1) {
      const { host, port } = parseAuthorityWithPort(remoteAuthority);
      if (!isLoopbackHost(host)) {
        await this._confirmDirectRemoteConnection(host, port);
      }
      return {
        authority: {
          authority: remoteAuthority,
          connectTo: {
            type: RemoteConnectionType.WebSocket,
            host,
            port
          },
          connectionToken: void 0
        }
      };
    }
    return this._resolveAuthorityOnExtensionHosts(ExtensionHostKind.LocalProcess, remoteAuthority);
  }
  async _confirmDirectRemoteConnection(host, port) {
    const { confirmed } = await this._dialogService.confirm({
      type: Severity.Warning,
      message: nls.localize("remoteConnectionConfirm", "Allow connecting to the remote server '{0}:{1}'?", host, port),
      detail: nls.localize("remoteConnectionConfirmDetail", "Code is about to connect to '{0}:{1}' to host a remote extension host. Only continue if you trust this server, as it will be able to run code and access files on your behalf.", host, port),
      primaryButton: nls.localize("remoteConnectionConfirmButton", "Connect")
    });
    if (!confirmed) {
      throw new RemoteAuthorityResolverError(
        nls.localize("remoteConnectionRejected", "Connection to '{0}:{1}' was not allowed.", host, port),
        RemoteAuthorityResolverErrorCode.NotAvailable
      );
    }
  }
  async _getCanonicalURI(remoteAuthority, uri) {
    const authorityPlusIndex = remoteAuthority.indexOf("+");
    if (authorityPlusIndex === -1) {
      return uri;
    }
    const localProcessExtensionHosts = this._getExtensionHostManagers(ExtensionHostKind.LocalProcess);
    if (localProcessExtensionHosts.length === 0) {
      throw new Error(`Cannot resolve canonical URI`);
    }
    const results = await Promise.all(localProcessExtensionHosts.map((extHost) => extHost.getCanonicalURI(remoteAuthority, uri)));
    for (const result of results) {
      if (result) {
        return result;
      }
    }
    throw new Error(`Cannot get canonical URI because no extension is installed to resolve ${getRemoteAuthorityPrefix(remoteAuthority)}`);
  }
  _resolveExtensions() {
    return new AsyncIterableProducer((emitter) => this._doResolveExtensions(emitter));
  }
  async _doResolveExtensions(emitter) {
    this._extensionScanner.startScanningExtensions();
    const remoteAuthority = this._environmentService.remoteAuthority;
    let remoteEnv = null;
    let remoteExtensions = [];
    if (remoteAuthority) {
      this._remoteAuthorityResolverService._setCanonicalURIProvider(async (uri) => {
        if (uri.scheme !== Schemas.vscodeRemote || uri.authority !== remoteAuthority) {
          return uri;
        }
        performance.mark(`code/willGetCanonicalURI/${getRemoteAuthorityPrefix(remoteAuthority)}`);
        if (isCI) {
          this._logService.info(`Invoking getCanonicalURI for authority ${getRemoteAuthorityPrefix(remoteAuthority)}...`);
        }
        try {
          return this._getCanonicalURI(remoteAuthority, uri);
        } finally {
          performance.mark(`code/didGetCanonicalURI/${getRemoteAuthorityPrefix(remoteAuthority)}`);
          if (isCI) {
            this._logService.info(`getCanonicalURI returned for authority ${getRemoteAuthorityPrefix(remoteAuthority)}.`);
          }
        }
      });
      if (isCI) {
        this._logService.info(`Starting to wait on IWorkspaceTrustManagementService.workspaceResolved...`);
      }
      await this._workspaceTrustManagementService.workspaceResolved;
      if (isCI) {
        this._logService.info(`Finished waiting on IWorkspaceTrustManagementService.workspaceResolved.`);
      }
      const localExtensions = await this._scanAllLocalExtensions();
      const resolverExtensions = localExtensions.filter((extension) => isResolverExtension(extension));
      if (resolverExtensions.length) {
        emitter.emitOne(new ResolverExtensions(resolverExtensions));
      }
      let resolverResult;
      try {
        resolverResult = await this._resolveAuthorityInitial(remoteAuthority);
      } catch (err) {
        if (RemoteAuthorityResolverError.isNoResolverFound(err)) {
          err.isHandled = await this._handleNoResolverFound(remoteAuthority);
        } else {
          if (RemoteAuthorityResolverError.isHandled(err)) {
            console.log(`Error handled: Not showing a notification for the error`);
          }
        }
        this._remoteAuthorityResolverService._setResolvedAuthorityError(remoteAuthority, err);
        return this._startLocalExtensionHost(emitter);
      }
      this._remoteAuthorityResolverService._setResolvedAuthority(resolverResult.authority, resolverResult.options);
      this._remoteExplorerService.setTunnelInformation(resolverResult.tunnelInformation);
      const connection = this._remoteAgentService.getConnection();
      if (connection) {
        this._register(connection.onDidStateChange(async (e) => {
          if (e.type === PersistentConnectionEventType.ConnectionLost) {
            this._remoteAuthorityResolverService._clearResolvedAuthority(remoteAuthority);
          }
        }));
        this._register(connection.onReconnecting(() => this._resolveAuthorityAgain()));
      }
      [remoteEnv, remoteExtensions] = await Promise.all([
        this._remoteAgentService.getEnvironment(),
        this._remoteExtensionsScannerService.scanExtensions()
      ]);
      if (!remoteEnv) {
        this._notificationService.notify({ severity: Severity.Error, message: nls.localize("getEnvironmentFailure", "Could not fetch remote environment") });
        return this._startLocalExtensionHost(emitter);
      }
      const useHostProxyDefault = remoteEnv.useHostProxy;
      this._register(this._configurationService.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("http.useLocalProxyConfiguration")) {
          updateProxyConfigurationsScope(this._configurationService.getValue("http.useLocalProxyConfiguration"), useHostProxyDefault);
        }
      }));
      updateProxyConfigurationsScope(this._configurationService.getValue("http.useLocalProxyConfiguration"), useHostProxyDefault);
    } else {
      this._remoteAuthorityResolverService._setCanonicalURIProvider(async (uri) => uri);
    }
    return this._startLocalExtensionHost(emitter, remoteExtensions);
  }
  async _startLocalExtensionHost(emitter, remoteExtensions = []) {
    await this._workspaceTrustManagementService.workspaceTrustInitialized;
    if (remoteExtensions.length) {
      emitter.emitOne(new RemoteExtensions(remoteExtensions));
    }
    emitter.emitOne(new LocalExtensions(await this._scanAllLocalExtensions()));
  }
  async _onExtensionHostExit(code) {
    await this._doStopExtensionHosts();
    const connection = this._remoteAgentService.getConnection();
    connection?.dispose();
    if (parseExtensionDevOptions(this._environmentService).isExtensionDevTestFromCli) {
      if (isCI) {
        this._logService.info(`Asking native host service to exit with code ${code}.`);
      }
      this._nativeHostService.exit(code);
    } else {
      this._nativeHostService.closeWindow();
    }
  }
  async _handleNoResolverFound(remoteAuthority) {
    const remoteName = getRemoteName(remoteAuthority);
    const recommendation = this._productService.remoteExtensionTips?.[remoteName];
    if (!recommendation) {
      return false;
    }
    const resolverExtensionId = recommendation.extensionId;
    const allExtensions = await this._scanAllLocalExtensions();
    const extension = allExtensions.filter((e) => e.identifier.value === resolverExtensionId)[0];
    if (extension) {
      if (!extensionIsEnabled(this._logService, this._extensionEnablementService, extension, false)) {
        const message = nls.localize("enableResolver", "Extension '{0}' is required to open the remote window.\nOK to enable?", recommendation.friendlyName);
        this._notificationService.prompt(
          Severity.Info,
          message,
          [{
            label: nls.localize("enable", "Enable and Reload"),
            run: async () => {
              await this._extensionEnablementService.setEnablement([toExtension(extension)], EnablementState.EnabledGlobally);
              await this._hostService.reload();
            }
          }],
          {
            sticky: true,
            priority: NotificationPriority.URGENT
          }
        );
      }
    } else {
      const message = nls.localize("installResolver", "Extension '{0}' is required to open the remote window.\nDo you want to install the extension?", recommendation.friendlyName);
      this._notificationService.prompt(
        Severity.Info,
        message,
        [{
          label: nls.localize("install", "Install and Reload"),
          run: async () => {
            const [galleryExtension] = await this._extensionGalleryService.getExtensions([{ id: resolverExtensionId }], CancellationToken.None);
            if (galleryExtension) {
              await this._extensionManagementService.installFromGallery(galleryExtension);
              await this._hostService.reload();
            } else {
              this._notificationService.error(nls.localize("resolverExtensionNotFound", "`{0}` not found on marketplace"));
            }
          }
        }],
        {
          sticky: true,
          priority: NotificationPriority.URGENT
        }
      );
    }
    return true;
  }
};
NativeExtensionService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, INotificationService),
  __decorateParam(2, IWorkbenchEnvironmentService),
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, IWorkbenchExtensionEnablementService),
  __decorateParam(5, IFileService),
  __decorateParam(6, IProductService),
  __decorateParam(7, IWorkbenchExtensionManagementService),
  __decorateParam(8, IWorkspaceContextService),
  __decorateParam(9, IConfigurationService),
  __decorateParam(10, IExtensionManifestPropertiesService),
  __decorateParam(11, ILogService),
  __decorateParam(12, IRemoteAgentService),
  __decorateParam(13, IRemoteExtensionsScannerService),
  __decorateParam(14, ILifecycleService),
  __decorateParam(15, IRemoteAuthorityResolverService),
  __decorateParam(16, INativeHostService),
  __decorateParam(17, IHostService),
  __decorateParam(18, IRemoteExplorerService),
  __decorateParam(19, IExtensionGalleryService),
  __decorateParam(20, IWorkspaceTrustManagementService),
  __decorateParam(21, IDialogService)
], NativeExtensionService);
let NativeExtensionHostFactory = class {
  constructor(_extensionsProposedApi, _extensionScanner, _getExtensionRegistrySnapshotWhenReady, _instantiationService, environmentService, _extensionEnablementService, configurationService, _remoteAgentService, _remoteAuthorityResolverService, _logService) {
    this._extensionsProposedApi = _extensionsProposedApi;
    this._extensionScanner = _extensionScanner;
    this._getExtensionRegistrySnapshotWhenReady = _getExtensionRegistrySnapshotWhenReady;
    this._instantiationService = _instantiationService;
    this._extensionEnablementService = _extensionEnablementService;
    this._remoteAgentService = _remoteAgentService;
    this._remoteAuthorityResolverService = _remoteAuthorityResolverService;
    this._logService = _logService;
    this._webWorkerExtHostEnablement = determineLocalWebWorkerExtHostEnablement(environmentService, configurationService);
  }
  createExtensionHost(runningLocations, runningLocation, isInitialStart) {
    switch (runningLocation.kind) {
      case ExtensionHostKind.LocalProcess: {
        const startup = isInitialStart ? ExtensionHostStartup.EagerManualStart : ExtensionHostStartup.EagerAutoStart;
        return this._instantiationService.createInstance(NativeLocalProcessExtensionHost, runningLocation, startup, this._createLocalProcessExtensionHostDataProvider(runningLocations, isInitialStart, runningLocation));
      }
      case ExtensionHostKind.LocalWebWorker: {
        if (this._webWorkerExtHostEnablement !== 0 /* Disabled */) {
          const startup = this._webWorkerExtHostEnablement === 2 /* Lazy */ ? ExtensionHostStartup.LazyAutoStart : ExtensionHostStartup.EagerManualStart;
          return this._instantiationService.createInstance(WebWorkerExtensionHost, runningLocation, startup, this._createWebWorkerExtensionHostDataProvider(runningLocations, runningLocation));
        }
        return null;
      }
      case ExtensionHostKind.Remote: {
        const remoteAgentConnection = this._remoteAgentService.getConnection();
        if (remoteAgentConnection) {
          return this._instantiationService.createInstance(RemoteExtensionHost, runningLocation, this._createRemoteExtensionHostDataProvider(runningLocations, remoteAgentConnection.remoteAuthority));
        }
        return null;
      }
    }
  }
  _createLocalProcessExtensionHostDataProvider(runningLocations, isInitialStart, desiredRunningLocation) {
    return {
      getInitData: async () => {
        if (isInitialStart) {
          const scannedExtensions = await this._extensionScanner.scannedExtensions;
          if (isCI) {
            this._logService.info(`NativeExtensionHostFactory._createLocalProcessExtensionHostDataProvider.scannedExtensions: ${scannedExtensions.map((ext) => ext.identifier.value).join(",")}`);
          }
          const localExtensions = checkEnabledAndProposedAPI(
            this._logService,
            this._extensionEnablementService,
            this._extensionsProposedApi,
            scannedExtensions,
            /* ignore workspace trust */
            true
          );
          if (isCI) {
            this._logService.info(`NativeExtensionHostFactory._createLocalProcessExtensionHostDataProvider.localExtensions: ${localExtensions.map((ext) => ext.identifier.value).join(",")}`);
          }
          const runningLocation = runningLocations.computeRunningLocation(localExtensions, [], false);
          const myExtensions = filterExtensionDescriptions(localExtensions, runningLocation, (extRunningLocation) => desiredRunningLocation.equals(extRunningLocation));
          const extensions = new ExtensionHostExtensions(0, localExtensions, myExtensions.map((extension) => extension.identifier));
          if (isCI) {
            this._logService.info(`NativeExtensionHostFactory._createLocalProcessExtensionHostDataProvider.myExtensions: ${myExtensions.map((ext) => ext.identifier.value).join(",")}`);
          }
          return { extensions };
        } else {
          const snapshot = await this._getExtensionRegistrySnapshotWhenReady();
          const myExtensions = runningLocations.filterByRunningLocation(snapshot.extensions, desiredRunningLocation);
          const extensions = new ExtensionHostExtensions(snapshot.versionId, snapshot.extensions, myExtensions.map((extension) => extension.identifier));
          return { extensions };
        }
      }
    };
  }
  _createWebWorkerExtensionHostDataProvider(runningLocations, desiredRunningLocation) {
    return {
      getInitData: async () => {
        const snapshot = await this._getExtensionRegistrySnapshotWhenReady();
        const myExtensions = runningLocations.filterByRunningLocation(snapshot.extensions, desiredRunningLocation);
        const extensions = new ExtensionHostExtensions(snapshot.versionId, snapshot.extensions, myExtensions.map((extension) => extension.identifier));
        return { extensions };
      }
    };
  }
  _createRemoteExtensionHostDataProvider(runningLocations, remoteAuthority) {
    return {
      remoteAuthority,
      getInitData: async () => {
        const snapshot = await this._getExtensionRegistrySnapshotWhenReady();
        const remoteEnv = await this._remoteAgentService.getEnvironment();
        if (!remoteEnv) {
          throw new Error("Cannot provide init data for remote extension host!");
        }
        const myExtensions = runningLocations.filterByExtensionHostKind(snapshot.extensions, ExtensionHostKind.Remote);
        const extensions = new ExtensionHostExtensions(snapshot.versionId, snapshot.extensions, myExtensions.map((extension) => extension.identifier));
        return {
          connectionData: this._remoteAuthorityResolverService.getConnectionData(remoteAuthority),
          pid: remoteEnv.pid,
          appRoot: remoteEnv.appRoot,
          extensionHostLogsPath: remoteEnv.extensionHostLogsPath,
          globalStorageHome: remoteEnv.globalStorageHome,
          workspaceStorageHome: remoteEnv.workspaceStorageHome,
          extensions
        };
      }
    };
  }
};
NativeExtensionHostFactory = __decorateClass([
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IWorkbenchEnvironmentService),
  __decorateParam(5, IWorkbenchExtensionEnablementService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IRemoteAgentService),
  __decorateParam(8, IRemoteAuthorityResolverService),
  __decorateParam(9, ILogService)
], NativeExtensionHostFactory);
function determineLocalWebWorkerExtHostEnablement(environmentService, configurationService) {
  if (environmentService.isExtensionDevelopment && environmentService.extensionDevelopmentKind?.some((k) => k === "web")) {
    return 1 /* Eager */;
  } else {
    const config = configurationService.getValue(webWorkerExtHostConfig);
    if (config === true) {
      return 1 /* Eager */;
    } else if (config === "auto") {
      return 2 /* Lazy */;
    } else {
      return 0 /* Disabled */;
    }
  }
}
var LocalWebWorkerExtHostEnablement = /* @__PURE__ */ ((LocalWebWorkerExtHostEnablement2) => {
  LocalWebWorkerExtHostEnablement2[LocalWebWorkerExtHostEnablement2["Disabled"] = 0] = "Disabled";
  LocalWebWorkerExtHostEnablement2[LocalWebWorkerExtHostEnablement2["Eager"] = 1] = "Eager";
  LocalWebWorkerExtHostEnablement2[LocalWebWorkerExtHostEnablement2["Lazy"] = 2] = "Lazy";
  return LocalWebWorkerExtHostEnablement2;
})(LocalWebWorkerExtHostEnablement || {});
let NativeExtensionHostKindPicker = class {
  constructor(environmentService, configurationService, _logService) {
    this._logService = _logService;
    this._hasRemoteExtHost = Boolean(environmentService.remoteAuthority);
    const webWorkerExtHostEnablement = determineLocalWebWorkerExtHostEnablement(environmentService, configurationService);
    this._hasWebWorkerExtHost = webWorkerExtHostEnablement !== 0 /* Disabled */;
  }
  pickExtensionHostKind(extensionId, extensionKinds, isInstalledLocally, isInstalledRemotely, preference) {
    const result = NativeExtensionHostKindPicker.pickExtensionHostKind(extensionKinds, isInstalledLocally, isInstalledRemotely, preference, this._hasRemoteExtHost, this._hasWebWorkerExtHost);
    this._logService.trace(`pickRunningLocation for ${extensionId.value}, extension kinds: [${extensionKinds.join(", ")}], isInstalledLocally: ${isInstalledLocally}, isInstalledRemotely: ${isInstalledRemotely}, preference: ${extensionRunningPreferenceToString(preference)} => ${extensionHostKindToString(result)}`);
    return result;
  }
  static pickExtensionHostKind(extensionKinds, isInstalledLocally, isInstalledRemotely, preference, hasRemoteExtHost, hasWebWorkerExtHost) {
    const result = [];
    for (const extensionKind of extensionKinds) {
      if (extensionKind === "ui" && isInstalledLocally) {
        if (preference === ExtensionRunningPreference.None || preference === ExtensionRunningPreference.Local) {
          return ExtensionHostKind.LocalProcess;
        } else {
          result.push(ExtensionHostKind.LocalProcess);
        }
      }
      if (extensionKind === "workspace" && isInstalledRemotely) {
        if (preference === ExtensionRunningPreference.None || preference === ExtensionRunningPreference.Remote) {
          return ExtensionHostKind.Remote;
        } else {
          result.push(ExtensionHostKind.Remote);
        }
      }
      if (extensionKind === "workspace" && !hasRemoteExtHost) {
        if (preference === ExtensionRunningPreference.None || preference === ExtensionRunningPreference.Local) {
          return ExtensionHostKind.LocalProcess;
        } else {
          result.push(ExtensionHostKind.LocalProcess);
        }
      }
      if (extensionKind === "web" && isInstalledLocally && hasWebWorkerExtHost) {
        if (preference === ExtensionRunningPreference.None || preference === ExtensionRunningPreference.Local) {
          return ExtensionHostKind.LocalWebWorker;
        } else {
          result.push(ExtensionHostKind.LocalWebWorker);
        }
      }
    }
    return result.length > 0 ? result[0] : null;
  }
};
NativeExtensionHostKindPicker = __decorateClass([
  __decorateParam(0, IWorkbenchEnvironmentService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, ILogService)
], NativeExtensionHostKindPicker);
class RestartExtensionHostAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.restartExtensionHost",
      title: nls.localize2("restartExtensionHost", "Restart Extension Host"),
      category: Categories.Developer,
      f1: true
    });
  }
  async run(accessor) {
    const extensionService = accessor.get(IExtensionService);
    const stopped = await extensionService.stopExtensionHosts(nls.localize("restartExtensionHost.reason", "An explicit request"));
    if (stopped) {
      extensionService.startExtensionHosts();
    }
  }
}
registerAction2(RestartExtensionHostAction);
registerSingleton(IExtensionService, NativeExtensionService, InstantiationType.Eager);
export {
  NativeExtensionHostKindPicker,
  NativeExtensionService
};
