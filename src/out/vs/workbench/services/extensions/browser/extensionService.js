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
import { mainWindow } from "../../../../base/browser/window.js";
import { Schemas } from "../../../../base/common/network.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { getLogs } from "../../../../platform/log/browser/log.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { PersistentConnectionEventType } from "../../../../platform/remote/common/remoteAgentConnection.js";
import { IRemoteAuthorityResolverService, RemoteAuthorityResolverError } from "../../../../platform/remote/common/remoteAuthorityResolver.js";
import { IRemoteExtensionsScannerService } from "../../../../platform/remote/common/remoteExtensionsScanner.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IWorkspaceTrustManagementService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { IBrowserWorkbenchEnvironmentService } from "../../environment/browser/environmentService.js";
import { IWebExtensionsScannerService, IWorkbenchExtensionEnablementService, IWorkbenchExtensionManagementService } from "../../extensionManagement/common/extensionManagement.js";
import { WebWorkerExtensionHost } from "./webWorkerExtensionHost.js";
import { FetchFileSystemProvider } from "./webWorkerFileSystemProvider.js";
import { AbstractExtensionService, LocalExtensions, RemoteExtensions, ResolverExtensions, checkEnabledAndProposedAPI, isResolverExtension } from "../common/abstractExtensionService.js";
import { ExtensionHostKind, ExtensionRunningPreference, extensionHostKindToString, extensionRunningPreferenceToString } from "../common/extensionHostKind.js";
import { IExtensionManifestPropertiesService } from "../common/extensionManifestPropertiesService.js";
import { filterExtensionDescriptions } from "../common/extensionRunningLocationTracker.js";
import { ExtensionHostExtensions, ExtensionHostStartup, IExtensionService, toExtensionDescription } from "../common/extensions.js";
import { ExtensionsProposedApi } from "../common/extensionsProposedApi.js";
import { dedupExtensions } from "../common/extensionsUtil.js";
import { RemoteExtensionHost } from "../common/remoteExtensionHost.js";
import { ILifecycleService, LifecyclePhase } from "../../lifecycle/common/lifecycle.js";
import { IRemoteAgentService } from "../../remote/common/remoteAgentService.js";
import { IRemoteExplorerService } from "../../remote/common/remoteExplorerService.js";
import { IUserDataInitializationService } from "../../userData/browser/userDataInit.js";
import { IUserDataProfileService } from "../../userDataProfile/common/userDataProfile.js";
import { AsyncIterableProducer } from "../../../../base/common/async.js";
let ExtensionService = class extends AbstractExtensionService {
  constructor(instantiationService, notificationService, _browserEnvironmentService, telemetryService, extensionEnablementService, fileService, productService, extensionManagementService, contextService, configurationService, extensionManifestPropertiesService, _webExtensionsScannerService, logService, remoteAgentService, remoteExtensionsScannerService, lifecycleService, remoteAuthorityResolverService, _userDataInitializationService, _userDataProfileService, _workspaceTrustManagementService, _remoteExplorerService, dialogService) {
    const extensionsProposedApi = instantiationService.createInstance(ExtensionsProposedApi);
    const extensionHostFactory = new BrowserExtensionHostFactory(
      extensionsProposedApi,
      () => this._scanWebExtensions(),
      () => this._getExtensionRegistrySnapshotWhenReady(),
      instantiationService,
      remoteAgentService,
      remoteAuthorityResolverService,
      extensionEnablementService,
      logService
    );
    super(
      { hasLocalProcess: false, allowRemoteExtensionsInLocalWebWorker: true },
      extensionsProposedApi,
      extensionHostFactory,
      new BrowserExtensionHostKindPicker(logService),
      instantiationService,
      notificationService,
      _browserEnvironmentService,
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
    this._browserEnvironmentService = _browserEnvironmentService;
    this._webExtensionsScannerService = _webExtensionsScannerService;
    this._userDataInitializationService = _userDataInitializationService;
    this._userDataProfileService = _userDataProfileService;
    this._workspaceTrustManagementService = _workspaceTrustManagementService;
    this._remoteExplorerService = _remoteExplorerService;
    lifecycleService.when(LifecyclePhase.Ready).then(async () => {
      await this._initializeIfNeeded();
    });
    this._initFetchFileSystem();
  }
  _initFetchFileSystem() {
    const provider = new FetchFileSystemProvider();
    this._register(this._fileService.registerProvider(Schemas.http, provider));
    this._register(this._fileService.registerProvider(Schemas.https, provider));
  }
  async _initialize() {
    await this._userDataInitializationService.initializeInstalledExtensions(this._instantiationService);
    await super._initialize();
  }
  async _scanWebExtensions() {
    if (!this._scanWebExtensionsPromise) {
      this._scanWebExtensionsPromise = (async () => {
        const system = [], user = [], development = [];
        try {
          await Promise.all([
            this._webExtensionsScannerService.scanSystemExtensions().then((extensions) => system.push(...extensions.map((e) => toExtensionDescription(e)))),
            this._webExtensionsScannerService.scanUserExtensions(this._userDataProfileService.currentProfile.extensionsResource, { skipInvalidExtensions: true }).then((extensions) => user.push(...extensions.map((e) => toExtensionDescription(e)))),
            this._webExtensionsScannerService.scanExtensionsUnderDevelopment().then((extensions) => development.push(...extensions.map((e) => toExtensionDescription(e, true))))
          ]);
        } catch (error) {
          this._logService.error(error);
        }
        return dedupExtensions(system, user, [], development, this._logService);
      })();
    }
    return this._scanWebExtensionsPromise;
  }
  async _resolveExtensionsDefault(emitter) {
    const [localExtensions, remoteExtensions] = await Promise.all([
      this._scanWebExtensions(),
      this._remoteExtensionsScannerService.scanExtensions()
    ]);
    if (remoteExtensions.length) {
      emitter.emitOne(new RemoteExtensions(remoteExtensions));
    }
    emitter.emitOne(new LocalExtensions(localExtensions));
  }
  _resolveExtensions() {
    return new AsyncIterableProducer((emitter) => this._doResolveExtensions(emitter));
  }
  async _doResolveExtensions(emitter) {
    if (!this._browserEnvironmentService.expectsResolverExtension) {
      return this._resolveExtensionsDefault(emitter);
    }
    const remoteAuthority = this._environmentService.remoteAuthority;
    await this._workspaceTrustManagementService.workspaceResolved;
    const localExtensions = await this._scanWebExtensions();
    const resolverExtensions = localExtensions.filter((extension) => isResolverExtension(extension));
    if (resolverExtensions.length) {
      emitter.emitOne(new ResolverExtensions(resolverExtensions));
    }
    let resolverResult;
    try {
      resolverResult = await this._resolveAuthorityInitial(remoteAuthority);
    } catch (err) {
      if (RemoteAuthorityResolverError.isHandled(err)) {
        console.log(`Error handled: Not showing a notification for the error`);
      }
      this._remoteAuthorityResolverService._setResolvedAuthorityError(remoteAuthority, err);
      return this._resolveExtensionsDefault(emitter);
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
    return this._resolveExtensionsDefault(emitter);
  }
  async _onExtensionHostExit(code) {
    await this._doStopExtensionHosts();
    const automatedWindow = mainWindow;
    if (typeof automatedWindow.codeAutomationExit === "function") {
      automatedWindow.codeAutomationExit(code, await getLogs(this._fileService, this._environmentService));
    }
  }
  async _resolveAuthority(remoteAuthority) {
    return this._resolveAuthorityOnExtensionHosts(ExtensionHostKind.LocalWebWorker, remoteAuthority);
  }
};
ExtensionService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, INotificationService),
  __decorateParam(2, IBrowserWorkbenchEnvironmentService),
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, IWorkbenchExtensionEnablementService),
  __decorateParam(5, IFileService),
  __decorateParam(6, IProductService),
  __decorateParam(7, IWorkbenchExtensionManagementService),
  __decorateParam(8, IWorkspaceContextService),
  __decorateParam(9, IConfigurationService),
  __decorateParam(10, IExtensionManifestPropertiesService),
  __decorateParam(11, IWebExtensionsScannerService),
  __decorateParam(12, ILogService),
  __decorateParam(13, IRemoteAgentService),
  __decorateParam(14, IRemoteExtensionsScannerService),
  __decorateParam(15, ILifecycleService),
  __decorateParam(16, IRemoteAuthorityResolverService),
  __decorateParam(17, IUserDataInitializationService),
  __decorateParam(18, IUserDataProfileService),
  __decorateParam(19, IWorkspaceTrustManagementService),
  __decorateParam(20, IRemoteExplorerService),
  __decorateParam(21, IDialogService)
], ExtensionService);
let BrowserExtensionHostFactory = class {
  constructor(_extensionsProposedApi, _scanWebExtensions, _getExtensionRegistrySnapshotWhenReady, _instantiationService, _remoteAgentService, _remoteAuthorityResolverService, _extensionEnablementService, _logService) {
    this._extensionsProposedApi = _extensionsProposedApi;
    this._scanWebExtensions = _scanWebExtensions;
    this._getExtensionRegistrySnapshotWhenReady = _getExtensionRegistrySnapshotWhenReady;
    this._instantiationService = _instantiationService;
    this._remoteAgentService = _remoteAgentService;
    this._remoteAuthorityResolverService = _remoteAuthorityResolverService;
    this._extensionEnablementService = _extensionEnablementService;
    this._logService = _logService;
  }
  createExtensionHost(runningLocations, runningLocation, isInitialStart) {
    switch (runningLocation.kind) {
      case ExtensionHostKind.LocalProcess: {
        return null;
      }
      case ExtensionHostKind.LocalWebWorker: {
        const startup = isInitialStart ? ExtensionHostStartup.EagerManualStart : ExtensionHostStartup.EagerAutoStart;
        return this._instantiationService.createInstance(WebWorkerExtensionHost, runningLocation, startup, this._createLocalExtensionHostDataProvider(runningLocations, runningLocation, isInitialStart));
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
  _createLocalExtensionHostDataProvider(runningLocations, desiredRunningLocation, isInitialStart) {
    return {
      getInitData: async () => {
        if (isInitialStart) {
          const localExtensions = checkEnabledAndProposedAPI(
            this._logService,
            this._extensionEnablementService,
            this._extensionsProposedApi,
            await this._scanWebExtensions(),
            /* ignore workspace trust */
            true
          );
          const runningLocation = runningLocations.computeRunningLocation(localExtensions, [], false);
          const myExtensions = filterExtensionDescriptions(localExtensions, runningLocation, (extRunningLocation) => desiredRunningLocation.equals(extRunningLocation));
          const extensions = new ExtensionHostExtensions(0, localExtensions, myExtensions.map((extension) => extension.identifier));
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
BrowserExtensionHostFactory = __decorateClass([
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IRemoteAgentService),
  __decorateParam(5, IRemoteAuthorityResolverService),
  __decorateParam(6, IWorkbenchExtensionEnablementService),
  __decorateParam(7, ILogService)
], BrowserExtensionHostFactory);
let BrowserExtensionHostKindPicker = class {
  constructor(_logService) {
    this._logService = _logService;
  }
  pickExtensionHostKind(extensionId, extensionKinds, isInstalledLocally, isInstalledRemotely, preference) {
    const result = BrowserExtensionHostKindPicker.pickRunningLocation(extensionKinds, isInstalledLocally, isInstalledRemotely, preference);
    this._logService.trace(`pickRunningLocation for ${extensionId.value}, extension kinds: [${extensionKinds.join(", ")}], isInstalledLocally: ${isInstalledLocally}, isInstalledRemotely: ${isInstalledRemotely}, preference: ${extensionRunningPreferenceToString(preference)} => ${extensionHostKindToString(result)}`);
    return result;
  }
  static pickRunningLocation(extensionKinds, isInstalledLocally, isInstalledRemotely, preference) {
    const result = [];
    let canRunRemotely = false;
    for (const extensionKind of extensionKinds) {
      if (extensionKind === "ui" && isInstalledRemotely) {
        if (preference === ExtensionRunningPreference.Remote) {
          return ExtensionHostKind.Remote;
        } else {
          canRunRemotely = true;
        }
      }
      if (extensionKind === "workspace" && isInstalledRemotely) {
        if (preference === ExtensionRunningPreference.None || preference === ExtensionRunningPreference.Remote) {
          return ExtensionHostKind.Remote;
        } else {
          result.push(ExtensionHostKind.Remote);
        }
      }
      if (extensionKind === "web" && (isInstalledLocally || isInstalledRemotely)) {
        if (preference === ExtensionRunningPreference.None || preference === ExtensionRunningPreference.Local) {
          return ExtensionHostKind.LocalWebWorker;
        } else {
          result.push(ExtensionHostKind.LocalWebWorker);
        }
      }
    }
    if (canRunRemotely) {
      result.push(ExtensionHostKind.Remote);
    }
    return result.length > 0 ? result[0] : null;
  }
};
BrowserExtensionHostKindPicker = __decorateClass([
  __decorateParam(0, ILogService)
], BrowserExtensionHostKindPicker);
registerSingleton(IExtensionService, ExtensionService, InstantiationType.Eager);
export {
  BrowserExtensionHostKindPicker,
  ExtensionService
};
