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
import { app, BrowserWindow, desktopCapturer, globalShortcut, powerMonitor, protocol, screen as electronScreen, session, systemPreferences } from "electron";
import { addUNCHostToAllowlist, disableUNCAccessRestrictions } from "../../base/node/unc.js";
import { validatedIpcMain } from "../../base/parts/ipc/electron-main/ipcMain.js";
import { hostname, release } from "os";
import { initWindowsVersionInfo } from "../../base/node/windowsVersion.js";
import { VSBuffer } from "../../base/common/buffer.js";
import { toErrorMessage } from "../../base/common/errorMessage.js";
import { Event } from "../../base/common/event.js";
import { parse } from "../../base/common/jsonc.js";
import { getPathLabel } from "../../base/common/labels.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../base/common/lifecycle.js";
import { Schemas, VSCODE_AUTHORITY } from "../../base/common/network.js";
import { join, posix } from "../../base/common/path.js";
import { isLinux, isLinuxSnap, isMacintosh, isWindows, OS } from "../../base/common/platform.js";
import { assertType } from "../../base/common/types.js";
import { URI } from "../../base/common/uri.js";
import { generateUuid } from "../../base/common/uuid.js";
import { registerContextMenuListener } from "../../base/parts/contextmenu/electron-main/contextmenu.js";
import { getDelayedChannel, ProxyChannel, StaticRouter } from "../../base/parts/ipc/common/ipc.js";
import { Server as ElectronIPCServer } from "../../base/parts/ipc/electron-main/ipc.electron.js";
import { Client as MessagePortClient } from "../../base/parts/ipc/electron-main/ipc.mp.js";
import { IProxyAuthService, ProxyAuthService } from "../../platform/native/electron-main/auth.js";
import { localize } from "../../nls.js";
import { IBackupMainService } from "../../platform/backup/electron-main/backup.js";
import { BackupMainService } from "../../platform/backup/electron-main/backupMainService.js";
import { IConfigurationService } from "../../platform/configuration/common/configuration.js";
import { ElectronExtensionHostDebugBroadcastChannel } from "../../platform/debug/electron-main/extensionHostDebugIpc.js";
import { IDiagnosticsService } from "../../platform/diagnostics/common/diagnostics.js";
import { DiagnosticsMainService, IDiagnosticsMainService } from "../../platform/diagnostics/electron-main/diagnosticsMainService.js";
import { DialogMainService, IDialogMainService } from "../../platform/dialogs/electron-main/dialogMainService.js";
import { IEncryptionMainService } from "../../platform/encryption/common/encryptionService.js";
import { EncryptionMainService } from "../../platform/encryption/electron-main/encryptionMainService.js";
import { ipcBrowserViewChannelName } from "../../platform/browserView/common/browserView.js";
import { ipcBrowserViewGroupChannelName } from "../../platform/browserView/common/browserViewGroup.js";
import { BrowserViewMainService, IBrowserViewMainService } from "../../platform/browserView/electron-main/browserViewMainService.js";
import { BrowserViewGroupMainService, IBrowserViewGroupMainService } from "../../platform/browserView/electron-main/browserViewGroupMainService.js";
import { IEnvironmentMainService } from "../../platform/environment/electron-main/environmentMainService.js";
import { isLaunchedFromCli } from "../../platform/environment/node/argvHelper.js";
import { getResolvedShellEnv } from "../../platform/shell/node/shellEnv.js";
import { IExtensionHostStarter, ipcExtensionHostStarterChannelName } from "../../platform/extensions/common/extensionHostStarter.js";
import { ExtensionHostStarter } from "../../platform/extensions/electron-main/extensionHostStarter.js";
import { IExternalTerminalMainService } from "../../platform/externalTerminal/electron-main/externalTerminal.js";
import { LinuxExternalTerminalService, MacExternalTerminalService, WindowsExternalTerminalService } from "../../platform/externalTerminal/node/externalTerminalService.js";
import { ISandboxHelperMainService } from "../../platform/sandbox/electron-main/sandboxHelperService.js";
import { SandboxHelperService } from "../../platform/sandbox/node/sandboxHelper.js";
import { LOCAL_FILE_SYSTEM_CHANNEL_NAME } from "../../platform/files/common/diskFileSystemProviderClient.js";
import { IFileService } from "../../platform/files/common/files.js";
import { DiskFileSystemProviderChannel } from "../../platform/files/electron-main/diskFileSystemProviderServer.js";
import { DiskFileSystemProvider } from "../../platform/files/node/diskFileSystemProvider.js";
import { SyncDescriptor } from "../../platform/instantiation/common/descriptors.js";
import { IInstantiationService } from "../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../platform/instantiation/common/serviceCollection.js";
import { ProcessMainService } from "../../platform/process/electron-main/processMainService.js";
import { IKeyboardLayoutMainService, KeyboardLayoutMainService } from "../../platform/keyboardLayout/electron-main/keyboardLayoutMainService.js";
import { ILaunchMainService, LaunchMainService } from "../../platform/launch/electron-main/launchMainService.js";
import { ILifecycleMainService, LifecycleMainPhase, ShutdownReason } from "../../platform/lifecycle/electron-main/lifecycleMainService.js";
import { ILoggerService, ILogService } from "../../platform/log/common/log.js";
import { IMenubarMainService, MenubarMainService } from "../../platform/menubar/electron-main/menubarMainService.js";
import { INativeHostMainService, NativeHostMainService } from "../../platform/native/electron-main/nativeHostMainService.js";
import { GlobalKeybindingsMainService, IGlobalKeybindingsMainService } from "../../platform/globalKeybindings/electron-main/globalKeybindingsMainService.js";
import { IMeteredConnectionService } from "../../platform/meteredConnection/common/meteredConnection.js";
import { METERED_CONNECTION_CHANNEL } from "../../platform/meteredConnection/common/meteredConnectionIpc.js";
import { MeteredConnectionChannel } from "../../platform/meteredConnection/electron-main/meteredConnectionChannel.js";
import { MeteredConnectionMainService } from "../../platform/meteredConnection/electron-main/meteredConnectionMainService.js";
import { IProductService } from "../../platform/product/common/productService.js";
import { getRemoteAuthority } from "../../platform/remote/common/remoteHosts.js";
import { SharedProcess } from "../../platform/sharedProcess/electron-main/sharedProcess.js";
import { ISignService } from "../../platform/sign/common/sign.js";
import { IStateService } from "../../platform/state/node/state.js";
import { StorageDatabaseChannel } from "../../platform/storage/electron-main/storageIpc.js";
import { ApplicationStorageMainService, IApplicationStorageMainService, IStorageMainService, StorageMainService } from "../../platform/storage/electron-main/storageMainService.js";
import { resolveCommonProperties } from "../../platform/telemetry/common/commonProperties.js";
import { ITelemetryService, TelemetryLevel } from "../../platform/telemetry/common/telemetry.js";
import { TelemetryAppenderClient } from "../../platform/telemetry/common/telemetryIpc.js";
import { TelemetryService } from "../../platform/telemetry/common/telemetryService.js";
import { getPiiPathsFromEnvironment, getTelemetryLevel, isInternalTelemetry, NullTelemetryService, supportsTelemetry } from "../../platform/telemetry/common/telemetryUtils.js";
import { IUpdateService } from "../../platform/update/common/update.js";
import { UpdateChannel } from "../../platform/update/common/updateIpc.js";
import { NotAvailableUpdateDialog } from "../../platform/update/electron-main/notAvailableUpdateDialog.js";
import { DarwinUpdateService } from "../../platform/update/electron-main/updateService.darwin.js";
import { LinuxUpdateService } from "../../platform/update/electron-main/updateService.linux.js";
import { SnapUpdateService } from "../../platform/update/electron-main/updateService.snap.js";
import { Win32UpdateService } from "../../platform/update/electron-main/updateService.win32.js";
import { isInnoSetupInstall } from "../../platform/update/electron-main/win32UpdateType.js";
import { IURLService } from "../../platform/url/common/url.js";
import { URLHandlerChannelClient, URLHandlerRouter } from "../../platform/url/common/urlIpc.js";
import { NativeURLService } from "../../platform/url/common/urlService.js";
import { ElectronURLListener } from "../../platform/url/electron-main/electronUrlListener.js";
import { IWebviewManagerService } from "../../platform/webview/common/webviewManagerService.js";
import { WebviewMainService } from "../../platform/webview/electron-main/webviewMainService.js";
import { isFolderToOpen, isWorkspaceToOpen } from "../../platform/window/common/window.js";
import { getAllWindowsExcludingOffscreen, IWindowsMainService, OpenContext } from "../../platform/windows/electron-main/windows.js";
import { WindowsMainService } from "../../platform/windows/electron-main/windowsMainService.js";
import { ActiveWindowManager } from "../../platform/windows/node/windowTracker.js";
import { hasWorkspaceFileExtension } from "../../platform/workspace/common/workspace.js";
import { IWorkspacesService } from "../../platform/workspaces/common/workspaces.js";
import { IWorkspacesHistoryMainService, WorkspacesHistoryMainService } from "../../platform/workspaces/electron-main/workspacesHistoryMainService.js";
import { WorkspacesMainService } from "../../platform/workspaces/electron-main/workspacesMainService.js";
import { IWorkspacesManagementMainService, WorkspacesManagementMainService } from "../../platform/workspaces/electron-main/workspacesManagementMainService.js";
import { IPolicyService } from "../../platform/policy/common/policy.js";
import { INativeManagedSettingsService, IFileManagedSettingsService } from "../../platform/policy/common/copilotManagedSettings.js";
import { NativeManagedSettingsChannel } from "../../platform/policy/common/nativeManagedSettingsIpc.js";
import { FileManagedSettingsChannel } from "../../platform/policy/common/fileManagedSettingsIpc.js";
import { PolicyChannel } from "../../platform/policy/common/policyIpc.js";
import { IUserDataProfilesMainService } from "../../platform/userDataProfile/electron-main/userDataProfile.js";
import { IExtensionsProfileScannerService } from "../../platform/extensionManagement/common/extensionsProfileScannerService.js";
import { IExtensionsScannerService } from "../../platform/extensionManagement/common/extensionsScannerService.js";
import { ExtensionsScannerService } from "../../platform/extensionManagement/node/extensionsScannerService.js";
import { UserDataProfilesHandler } from "../../platform/userDataProfile/electron-main/userDataProfilesHandler.js";
import { ProfileStorageChangesListenerChannel } from "../../platform/userDataProfile/electron-main/userDataProfileStorageIpc.js";
import { Promises, RunOnceScheduler, runWhenGlobalIdle } from "../../base/common/async.js";
import { CancellationToken } from "../../base/common/cancellation.js";
import { resolveMachineId, resolveSqmId, resolveDevDeviceId, validateDevDeviceId } from "../../platform/telemetry/electron-main/telemetryUtils.js";
import { ExtensionsProfileScannerService } from "../../platform/extensionManagement/node/extensionsProfileScannerService.js";
import { LoggerChannel } from "../../platform/log/electron-main/logIpc.js";
import { ILoggerMainService } from "../../platform/log/electron-main/loggerService.js";
import { IUtilityProcessWorkerMainService, UtilityProcessWorkerMainService } from "../../platform/utilityProcess/electron-main/utilityProcessWorkerMainService.js";
import { ipcUtilityProcessWorkerChannelName } from "../../platform/utilityProcess/common/utilityProcessWorkerService.js";
import { ILocalPtyService, LocalReconnectConstants, TerminalIpcChannels, TerminalSettingId } from "../../platform/terminal/common/terminal.js";
import { ElectronPtyHostStarter } from "../../platform/terminal/electron-main/electronPtyHostStarter.js";
import { PtyHostService } from "../../platform/terminal/node/ptyHostService.js";
import { ElectronAgentHostStarter } from "../../platform/agentHost/electron-main/electronAgentHostStarter.js";
import { AgentHostProcessManager } from "../../platform/agentHost/node/agentHostService.js";
import { NODE_REMOTE_RESOURCE_CHANNEL_NAME, NODE_REMOTE_RESOURCE_IPC_METHOD_NAME, NodeRemoteResourceRouter } from "../../platform/remote/common/electronRemoteResources.js";
import { Lazy } from "../../base/common/lazy.js";
import { IAuxiliaryWindowsMainService } from "../../platform/auxiliaryWindow/electron-main/auxiliaryWindows.js";
import { AuxiliaryWindowsMainService } from "../../platform/auxiliaryWindow/electron-main/auxiliaryWindowsMainService.js";
import { normalizeNFC } from "../../base/common/normalization.js";
import { ICSSDevelopmentService, CSSDevelopmentService } from "../../platform/cssDev/node/cssDevService.js";
import { INativeMcpDiscoveryHelperService, NativeMcpDiscoveryHelperChannelName } from "../../platform/mcp/common/nativeMcpDiscoveryHelper.js";
import { NativeMcpDiscoveryHelperService } from "../../platform/mcp/node/nativeMcpDiscoveryHelperService.js";
import { IMcpGatewayService, McpGatewayChannelName } from "../../platform/mcp/common/mcpGateway.js";
import { McpGatewayService } from "../../platform/mcp/node/mcpGatewayService.js";
import { McpGatewayChannel } from "../../platform/mcp/node/mcpGatewayChannel.js";
import { IWebContentExtractorService } from "../../platform/webContentExtractor/common/webContentExtractor.js";
import { NativeWebContentExtractorService } from "../../platform/webContentExtractor/electron-main/webContentExtractorService.js";
import { AgentNetworkFilterService, IAgentNetworkFilterService } from "../../platform/networkFilter/common/networkFilterService.js";
import { ITerminalSandboxService, NullTerminalSandboxService } from "../../platform/sandbox/common/terminalSandboxService.js";
import ErrorTelemetry from "../../platform/telemetry/electron-main/errorTelemetry.js";
let CodeApplication = class extends Disposable {
  constructor(mainProcessNodeIpcServer, userEnv, mainInstantiationService, logService, loggerService, environmentMainService, lifecycleMainService, configurationService, stateService, fileService, productService, userDataProfilesMainService) {
    super();
    this.mainProcessNodeIpcServer = mainProcessNodeIpcServer;
    this.userEnv = userEnv;
    this.mainInstantiationService = mainInstantiationService;
    this.logService = logService;
    this.loggerService = loggerService;
    this.environmentMainService = environmentMainService;
    this.lifecycleMainService = lifecycleMainService;
    this.configurationService = configurationService;
    this.stateService = stateService;
    this.fileService = fileService;
    this.productService = productService;
    this.userDataProfilesMainService = userDataProfilesMainService;
    this.configureSession();
    this.registerListeners();
  }
  static {
    this.SECURITY_PROTOCOL_HANDLING_CONFIRMATION_SETTING_KEY = {
      [Schemas.file]: "security.promptForLocalFileProtocolHandling",
      [Schemas.vscodeRemote]: "security.promptForRemoteFileProtocolHandling"
    };
  }
  configureSession() {
    const isUrlFromWindow = (requestingUrl) => requestingUrl?.startsWith(`${Schemas.vscodeFileResource}://${VSCODE_AUTHORITY}`);
    const isUrlFromWebview = (requestingUrl) => requestingUrl?.startsWith(`${Schemas.vscodeWebview}://`);
    const isUrlFromAuxiliaryWindow = (webContents, requestingUrl, isMainFrame) => isMainFrame && requestingUrl === "about:blank" && !!(webContents && this.auxiliaryWindowsMainService?.getWindowByWebContents(webContents));
    const isRequestFromWindow = (webContents, requestingUrl, isMainFrame) => isUrlFromWindow(requestingUrl) || isUrlFromAuxiliaryWindow(webContents, requestingUrl, isMainFrame);
    const alwaysAllowedPermissions = /* @__PURE__ */ new Set(["pointerLock", "notifications"]);
    const allowedPermissionsInWebview = /* @__PURE__ */ new Set([
      ...alwaysAllowedPermissions,
      "clipboard-read",
      "clipboard-sanitized-write",
      // TODO(deepak1556): Should be removed once migration is complete
      // https://github.com/microsoft/vscode/issues/239228
      "deprecated-sync-clipboard-read"
    ]);
    const allowedPermissionsInCore = /* @__PURE__ */ new Set([
      ...alwaysAllowedPermissions,
      "media",
      "local-fonts",
      // TODO(deepak1556): Should be removed once migration is complete
      // https://github.com/microsoft/vscode/issues/239228
      "deprecated-sync-clipboard-read"
    ]);
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
      if (isUrlFromWebview(details.requestingUrl)) {
        return callback(allowedPermissionsInWebview.has(permission));
      }
      if (isRequestFromWindow(webContents, details.requestingUrl, details.isMainFrame)) {
        return callback(allowedPermissionsInCore.has(permission));
      }
      return callback(false);
    });
    session.defaultSession.setPermissionCheckHandler((webContents, permission, _origin, details) => {
      if (isUrlFromWebview(details.requestingUrl)) {
        return allowedPermissionsInWebview.has(permission);
      }
      if (isRequestFromWindow(webContents, details.requestingUrl, details.isMainFrame)) {
        return allowedPermissionsInCore.has(permission);
      }
      return false;
    });
    let cachedScreenSources;
    const invalidateScreenSourceCache = () => {
      cachedScreenSources = void 0;
    };
    electronScreen.on("display-added", invalidateScreenSourceCache);
    electronScreen.on("display-removed", invalidateScreenSourceCache);
    electronScreen.on("display-metrics-changed", invalidateScreenSourceCache);
    this._register(toDisposable(() => {
      electronScreen.off("display-added", invalidateScreenSourceCache);
      electronScreen.off("display-removed", invalidateScreenSourceCache);
      electronScreen.off("display-metrics-changed", invalidateScreenSourceCache);
    }));
    session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
      try {
        const frame = request.frame;
        const win = frame ? BrowserWindow.getAllWindows().find((w) => w.webContents.mainFrame === frame) : void 0;
        const displays = electronScreen.getAllDisplays();
        let targetDisplay = displays[0];
        if (win) {
          const winBounds = win.getBounds();
          targetDisplay = electronScreen.getDisplayNearestPoint({
            x: winBounds.x + winBounds.width / 2,
            y: winBounds.y + winBounds.height / 2
          });
        }
        if (!cachedScreenSources) {
          cachedScreenSources = await desktopCapturer.getSources({
            types: ["screen"],
            thumbnailSize: { width: 0, height: 0 }
          });
        }
        let match = cachedScreenSources.find((s) => s.display_id === String(targetDisplay.id));
        if (!match) {
          cachedScreenSources = await desktopCapturer.getSources({
            types: ["screen"],
            thumbnailSize: { width: 0, height: 0 }
          });
          match = cachedScreenSources.find((s) => s.display_id === String(targetDisplay.id));
        }
        const chosen = match ?? cachedScreenSources[0];
        if (!chosen) {
          callback({});
          return;
        }
        callback({ video: chosen });
      } catch {
        callback({});
      }
    });
    const supportedSvgSchemes = /* @__PURE__ */ new Set([Schemas.file, Schemas.vscodeFileResource, Schemas.vscodeRemoteResource, Schemas.vscodeManagedRemoteResource, "devtools"]);
    const isSafeFrame = (requestFrame) => {
      for (let frame = requestFrame; frame; frame = frame.parent) {
        if (frame.isDestroyed()) {
          return false;
        }
        if (frame.url.startsWith(`${Schemas.vscodeWebview}://`)) {
          return true;
        }
      }
      return false;
    };
    const isSvgRequestFromSafeContext = (details) => {
      return details.resourceType === "xhr" || isSafeFrame(details.frame);
    };
    const isAllowedVsCodeFileRequest = (details) => {
      const frame = details.frame;
      if (!frame || frame.isDestroyed() || !this.windowsMainService) {
        return false;
      }
      const windows = getAllWindowsExcludingOffscreen();
      for (const window of windows) {
        if (frame.processId === window.webContents.mainFrame.processId) {
          return true;
        }
      }
      return false;
    };
    const isAllowedWebviewRequest = (uri, details) => {
      if (uri.path !== "/index.html") {
        return true;
      }
      const frame = details.frame;
      if (!frame || frame.isDestroyed() || !this.windowsMainService) {
        return false;
      }
      for (const window of this.windowsMainService.getWindows()) {
        if (window.win) {
          if (frame.processId === window.win.webContents.mainFrame.processId) {
            return true;
          }
        }
      }
      return false;
    };
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      const uri = URI.parse(details.url);
      if (uri.scheme === Schemas.vscodeWebview) {
        if (!isAllowedWebviewRequest(uri, details)) {
          this.logService.error("Blocked vscode-webview request", details.url);
          return callback({ cancel: true });
        }
      }
      if (uri.scheme === Schemas.vscodeFileResource) {
        if (!isAllowedVsCodeFileRequest(details)) {
          this.logService.error("Blocked vscode-file request", details.url);
          return callback({ cancel: true });
        }
      }
      if (uri.path.endsWith(".svg")) {
        const isSafeResourceUrl = supportedSvgSchemes.has(uri.scheme);
        if (!isSafeResourceUrl) {
          return callback({ cancel: !isSvgRequestFromSafeContext(details) });
        }
      }
      return callback({ cancel: false });
    });
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const responseHeaders = details.responseHeaders;
      const contentTypes = responseHeaders["content-type"] || responseHeaders["Content-Type"];
      if (contentTypes && Array.isArray(contentTypes)) {
        const uri = URI.parse(details.url);
        if (uri.path.endsWith(".svg")) {
          if (supportedSvgSchemes.has(uri.scheme)) {
            responseHeaders["Content-Type"] = ["image/svg+xml"];
            return callback({ cancel: false, responseHeaders });
          }
        }
        if (!uri.path.endsWith(Schemas.vscodeRemoteResource) && contentTypes.some((contentType) => contentType.toLowerCase().includes("image/svg"))) {
          return callback({ cancel: !isSvgRequestFromSafeContext(details) });
        }
      }
      return callback({ cancel: false });
    });
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      if (details.url.startsWith("https://vscode.download.prss.microsoft.com/")) {
        const responseHeaders = details.responseHeaders ?? /* @__PURE__ */ Object.create(null);
        if (responseHeaders["Access-Control-Allow-Origin"] === void 0) {
          responseHeaders["Access-Control-Allow-Origin"] = ["*"];
          return callback({ cancel: false, responseHeaders });
        }
      }
      return callback({ cancel: false });
    });
    const defaultSession = session.defaultSession;
    if (typeof defaultSession.setCodeCachePath === "function" && this.environmentMainService.codeCachePath) {
      defaultSession.setCodeCachePath(join(this.environmentMainService.codeCachePath, "chrome"));
    }
    if (isWindows) {
      if (this.configurationService.getValue("security.restrictUNCAccess") === false) {
        disableUNCAccessRestrictions();
      } else {
        addUNCHostToAllowlist(this.configurationService.getValue("security.allowedUNCHosts"));
      }
    }
  }
  registerListeners() {
    Event.once(this.lifecycleMainService.onWillShutdown)(() => this.dispose());
    registerContextMenuListener();
    app.on("accessibility-support-changed", (event, accessibilitySupportEnabled) => {
      this.windowsMainService?.sendToAll("vscode:accessibilitySupportChanged", accessibilitySupportEnabled);
    });
    app.on("activate", async (event, hasVisibleWindows) => {
      this.logService.trace("app#activate");
      if (!hasVisibleWindows) {
        await this.windowsMainService?.openEmptyWindow({ context: OpenContext.DOCK });
      }
    });
    app.on("web-contents-created", (event, contents) => {
      if (contents?.opener?.url.startsWith(`${Schemas.vscodeFileResource}://${VSCODE_AUTHORITY}/`)) {
        this.logService.trace('[aux window]  app.on("web-contents-created"): Registering auxiliary window');
        this.auxiliaryWindowsMainService?.registerWindow(contents);
      }
      contents.on("will-navigate", (event2) => {
        if (BrowserViewMainService.isBrowserViewWebContents(contents)) {
          return;
        }
        this.logService.error("webContents#will-navigate: Prevented webcontent navigation");
        event2.preventDefault();
      });
      contents.setWindowOpenHandler((details) => {
        if (details.url === "about:blank") {
          this.logService.trace("[aux window] webContents#setWindowOpenHandler: Allowing auxiliary window to open on about:blank");
          return {
            action: "allow",
            overrideBrowserWindowOptions: this.auxiliaryWindowsMainService?.createWindow(details)
          };
        } else {
          this.logService.trace(`webContents#setWindowOpenHandler: Prevented opening window with URL ${details.url}}`);
          this.nativeHostMainService?.openExternal(void 0, details.url);
          return { action: "deny" };
        }
      });
    });
    let macOpenFileURIs = [];
    let runningTimeout = void 0;
    app.on("open-file", (event, path) => {
      path = normalizeNFC(path);
      this.logService.trace("app#open-file: ", path);
      event.preventDefault();
      macOpenFileURIs.push(hasWorkspaceFileExtension(path) ? { workspaceUri: URI.file(path) } : { fileUri: URI.file(path) });
      if (runningTimeout !== void 0) {
        clearTimeout(runningTimeout);
        runningTimeout = void 0;
      }
      runningTimeout = setTimeout(async () => {
        await this.windowsMainService?.open({
          context: OpenContext.DOCK,
          cli: this.environmentMainService.args,
          urisToOpen: macOpenFileURIs,
          gotoLineMode: false,
          preferNewWindow: true
          /* dropping on the dock or opening from finder prefers to open in a new window */
        });
        macOpenFileURIs = [];
        runningTimeout = void 0;
      }, 100);
    });
    app.on("new-window-for-tab", async () => {
      await this.windowsMainService?.openEmptyWindow({ context: OpenContext.DESKTOP });
    });
    validatedIpcMain.handle("vscode:fetchShellEnv", (event) => {
      const window = this.windowsMainService?.getWindowByWebContents(event.sender);
      let args;
      let env;
      if (window?.config) {
        args = window.config;
        env = { ...process.env, ...window.config.userEnv };
      } else {
        args = this.environmentMainService.args;
        env = process.env;
      }
      return this.resolveShellEnvironment(args, env, false);
    });
    validatedIpcMain.on("vscode:toggleDevTools", (event) => event.sender.toggleDevTools());
    validatedIpcMain.on("vscode:openDevTools", (event) => event.sender.openDevTools());
    validatedIpcMain.on("vscode:reloadWindow", (event) => event.sender.reload());
    validatedIpcMain.handle("vscode:notifyZoomLevel", async (event, zoomLevel) => {
      const window = this.windowsMainService?.getWindowByWebContents(event.sender);
      if (window) {
        window.notifyZoomLevel(zoomLevel);
      }
    });
  }
  async startup() {
    this.logService.debug("Starting VS Code");
    this.logService.debug(`from: ${this.environmentMainService.appRoot}`);
    this.logService.debug("args:", this.environmentMainService.args);
    const win32AppUserModelId = this.productService.win32AppUserModelId;
    if (isWindows && win32AppUserModelId) {
      app.setAppUserModelId(win32AppUserModelId);
    }
    try {
      if (isMacintosh && this.configurationService.getValue("window.nativeTabs") === true && !systemPreferences.getUserDefault("NSUseImprovedLayoutPass", "boolean")) {
        systemPreferences.setUserDefault("NSUseImprovedLayoutPass", "boolean", true);
      }
    } catch (error) {
      this.logService.error(error);
    }
    const mainProcessElectronServer = new ElectronIPCServer();
    Event.once(this.lifecycleMainService.onWillShutdown)((e) => {
      if (e.reason === ShutdownReason.KILL) {
        mainProcessElectronServer.dispose();
      }
    });
    const [machineId, sqmId, devDeviceId] = await Promise.all([
      resolveMachineId(this.stateService, this.logService),
      resolveSqmId(this.stateService, this.logService),
      resolveDevDeviceId(this.stateService, this.logService)
    ]);
    const { sharedProcessReady, sharedProcessClient } = this.setupSharedProcess(machineId, sqmId, devDeviceId);
    const appInstantiationService = await this.initServices(machineId, sqmId, devDeviceId, sharedProcessReady);
    appInstantiationService.invokeFunction((accessor) => this._register(new ErrorTelemetry(accessor.get(ILogService), accessor.get(ITelemetryService))));
    const agentHostStarter = new ElectronAgentHostStarter({ machineId, sqmId, devDeviceId }, this.configurationService, this.environmentMainService, this.lifecycleMainService, this.logService);
    this._register(appInstantiationService.createInstance(AgentHostProcessManager, agentHostStarter, process.platform));
    appInstantiationService.invokeFunction((accessor) => {
      accessor.get(IMeteredConnectionService).setTelemetryService(accessor.get(ITelemetryService));
    });
    appInstantiationService.invokeFunction((accessor) => accessor.get(IProxyAuthService));
    this._register(appInstantiationService.createInstance(UserDataProfilesHandler));
    appInstantiationService.invokeFunction((accessor) => this.initChannels(accessor, mainProcessElectronServer, sharedProcessClient));
    const initialProtocolUrls = await appInstantiationService.invokeFunction((accessor) => this.setupProtocolUrlHandlers(accessor, mainProcessElectronServer));
    this.setupManagedRemoteResourceUrlHandler(mainProcessElectronServer);
    this.lifecycleMainService.phase = LifecycleMainPhase.Ready;
    await appInstantiationService.invokeFunction((accessor) => this.openFirstWindow(accessor, initialProtocolUrls));
    this.lifecycleMainService.phase = LifecycleMainPhase.AfterWindowOpen;
    this.afterWindowOpen(appInstantiationService);
    const eventuallyPhaseScheduler = this._register(new RunOnceScheduler(() => {
      this._register(runWhenGlobalIdle(() => {
        this.lifecycleMainService.phase = LifecycleMainPhase.Eventually;
        this.eventuallyAfterWindowOpen(appInstantiationService);
      }, 2500));
    }, 2500));
    eventuallyPhaseScheduler.schedule();
  }
  async setupProtocolUrlHandlers(accessor, mainProcessElectronServer) {
    const windowsMainService = this.windowsMainService = accessor.get(IWindowsMainService);
    const urlService = accessor.get(IURLService);
    const nativeHostMainService = this.nativeHostMainService = accessor.get(INativeHostMainService);
    const dialogMainService = accessor.get(IDialogMainService);
    const app2 = this;
    urlService.registerHandler({
      async handleURL(uri, options) {
        return app2.handleProtocolUrl(windowsMainService, dialogMainService, urlService, uri, options);
      }
    });
    const activeWindowManager = this._register(new ActiveWindowManager({
      onDidOpenMainWindow: nativeHostMainService.onDidOpenMainWindow,
      onDidFocusMainWindow: nativeHostMainService.onDidFocusMainWindow,
      getActiveWindowId: () => nativeHostMainService.getActiveWindowId(-1)
    }));
    const activeWindowRouter = new StaticRouter((ctx) => activeWindowManager.getActiveClientId().then((id) => ctx === id));
    const urlHandlerRouter = new URLHandlerRouter(activeWindowRouter, this.logService);
    const urlHandlerChannel = mainProcessElectronServer.getChannel("urlHandler", urlHandlerRouter);
    urlService.registerHandler(new URLHandlerChannelClient(urlHandlerChannel));
    const initialProtocolUrls = await this.resolveInitialProtocolUrls(windowsMainService, dialogMainService);
    this._register(new ElectronURLListener(initialProtocolUrls?.urls, urlService, windowsMainService, this.environmentMainService, this.productService, this.logService));
    return initialProtocolUrls;
  }
  setupManagedRemoteResourceUrlHandler(mainProcessElectronServer) {
    const notFound = () => ({ statusCode: 404, data: "Not found" });
    const remoteResourceChannel = new Lazy(() => mainProcessElectronServer.getChannel(
      NODE_REMOTE_RESOURCE_CHANNEL_NAME,
      new NodeRemoteResourceRouter()
    ));
    protocol.registerBufferProtocol(Schemas.vscodeManagedRemoteResource, (request, callback) => {
      const url = URI.parse(request.url);
      if (!url.authority.startsWith("window:")) {
        return callback(notFound());
      }
      remoteResourceChannel.value.call(NODE_REMOTE_RESOURCE_IPC_METHOD_NAME, [url]).then(
        (r) => callback({ ...r, data: Buffer.from(r.body, "base64") }),
        (err) => {
          this.logService.warn("error dispatching remote resource call", err);
          callback({ statusCode: 500, data: String(err) });
        }
      );
    });
  }
  async resolveInitialProtocolUrls(windowsMainService, dialogMainService) {
    const protocolUrlsFromCommandLine = this.environmentMainService.args["open-url"] ? this.environmentMainService.args._urls || [] : [];
    if (protocolUrlsFromCommandLine.length > 0) {
      this.logService.trace("app#resolveInitialProtocolUrls() protocol urls from command line:", protocolUrlsFromCommandLine);
    }
    const protocolUrlsFromEvent = global.getOpenUrls?.() || [];
    if (protocolUrlsFromEvent.length > 0) {
      this.logService.trace(`app#resolveInitialProtocolUrls() protocol urls from macOS 'open-url' event:`, protocolUrlsFromEvent);
    }
    if (protocolUrlsFromCommandLine.length + protocolUrlsFromEvent.length === 0) {
      return void 0;
    }
    const protocolUrls = [
      ...protocolUrlsFromCommandLine,
      ...protocolUrlsFromEvent
    ].map((url) => {
      try {
        return { uri: URI.parse(url), originalUrl: url };
      } catch {
        this.logService.trace("app#resolveInitialProtocolUrls() protocol url failed to parse:", url);
        return void 0;
      }
    });
    const openables = [];
    const urls = [];
    for (const protocolUrl of protocolUrls) {
      if (!protocolUrl) {
        continue;
      }
      const windowOpenable = this.getWindowOpenableFromProtocolUrl(protocolUrl.uri);
      if (windowOpenable) {
        if (await this.shouldBlockOpenable(windowOpenable, windowsMainService, dialogMainService)) {
          this.logService.trace("app#resolveInitialProtocolUrls() protocol url was blocked:", protocolUrl.uri.toString(true));
          continue;
        } else {
          this.logService.trace("app#resolveInitialProtocolUrls() protocol url will be handled as window to open:", protocolUrl.uri.toString(true), windowOpenable);
          openables.push(windowOpenable);
        }
      } else {
        this.logService.trace("app#resolveInitialProtocolUrls() protocol url will be passed to active window for handling:", protocolUrl.uri.toString(true));
        urls.push(protocolUrl);
      }
    }
    return { urls, openables };
  }
  async shouldBlockOpenable(openable, windowsMainService, dialogMainService) {
    let openableUri;
    let message;
    if (isWorkspaceToOpen(openable)) {
      openableUri = openable.workspaceUri;
      message = localize("confirmOpenMessageWorkspace", "An external application wants to open '{0}' in {1}. Do you want to open this workspace file?", openableUri.scheme === Schemas.file ? getPathLabel(openableUri, { os: OS, tildify: this.environmentMainService }) : openableUri.toString(true), this.productService.nameShort);
    } else if (isFolderToOpen(openable)) {
      openableUri = openable.folderUri;
      message = localize("confirmOpenMessageFolder", "An external application wants to open '{0}' in {1}. Do you want to open this folder?", openableUri.scheme === Schemas.file ? getPathLabel(openableUri, { os: OS, tildify: this.environmentMainService }) : openableUri.toString(true), this.productService.nameShort);
    } else {
      openableUri = openable.fileUri;
      message = localize("confirmOpenMessageFileOrFolder", "An external application wants to open '{0}' in {1}. Do you want to open this file or folder?", openableUri.scheme === Schemas.file ? getPathLabel(openableUri, { os: OS, tildify: this.environmentMainService }) : openableUri.toString(true), this.productService.nameShort);
    }
    if (openableUri.scheme !== Schemas.file && openableUri.scheme !== Schemas.vscodeRemote) {
      return false;
    }
    const askForConfirmation = this.configurationService.getValue(CodeApplication.SECURITY_PROTOCOL_HANDLING_CONFIRMATION_SETTING_KEY[openableUri.scheme]);
    if (askForConfirmation === false) {
      return false;
    }
    const { response, checkboxChecked } = await dialogMainService.showMessageBox({
      type: "warning",
      buttons: [
        localize({ key: "open", comment: ["&& denotes a mnemonic"] }, "&&Yes"),
        localize({ key: "cancel", comment: ["&& denotes a mnemonic"] }, "&&No")
      ],
      message,
      detail: localize("confirmOpenDetail", "If you did not initiate this request, it may represent an attempted attack on your system. Unless you took an explicit action to initiate this request, you should press 'No'"),
      checkboxLabel: openableUri.scheme === Schemas.file ? localize("doNotAskAgainLocal", "Allow opening local paths without asking") : localize("doNotAskAgainRemote", "Allow opening remote paths without asking"),
      cancelId: 1
    });
    if (response !== 0) {
      return true;
    }
    if (checkboxChecked) {
      const request = { channel: "vscode:disablePromptForProtocolHandling", args: openableUri.scheme === Schemas.file ? "local" : "remote" };
      windowsMainService.sendToFocused(request.channel, request.args);
      windowsMainService.sendToOpeningWindow(request.channel, request.args);
    }
    return false;
  }
  getWindowOpenableFromProtocolUrl(uri) {
    if (!uri.path) {
      return void 0;
    }
    if (uri.authority === Schemas.file) {
      const fileUri = URI.file(uri.fsPath);
      if (hasWorkspaceFileExtension(fileUri)) {
        return { workspaceUri: fileUri };
      }
      return { fileUri };
    } else if (uri.authority === Schemas.vscodeRemote) {
      const secondSlash = uri.path.indexOf(
        posix.sep,
        1
        /* skip over the leading slash */
      );
      let authority;
      let path;
      if (secondSlash !== -1) {
        authority = uri.path.substring(1, secondSlash);
        path = uri.path.substring(secondSlash);
      } else {
        authority = uri.path.substring(1);
        path = "/";
      }
      let query = uri.query;
      const params = new URLSearchParams(uri.query);
      if (params.get("windowId") === "_blank") {
        params.delete("windowId");
        query = params.toString();
      }
      const remoteUri = URI.from({ scheme: Schemas.vscodeRemote, authority, path, query, fragment: uri.fragment });
      if (hasWorkspaceFileExtension(path)) {
        return { workspaceUri: remoteUri };
      }
      if (/:[\d]+$/.test(path)) {
        return { fileUri: remoteUri };
      }
      return { folderUri: remoteUri };
    }
    return void 0;
  }
  async handleProtocolUrl(windowsMainService, dialogMainService, urlService, uri, options) {
    this.logService.trace("app#handleProtocolUrl():", uri.toString(true), options);
    if (uri.scheme === this.productService.urlProtocol && uri.path === "workspace") {
      uri = uri.with({
        authority: Schemas.file,
        path: URI.parse(uri.query).path,
        query: ""
      });
    }
    let shouldOpenInNewWindow = false;
    const params = new URLSearchParams(uri.query);
    if (params.get("windowId") === "_blank") {
      this.logService.trace(`app#handleProtocolUrl() found 'windowId=_blank' as parameter, setting shouldOpenInNewWindow=true:`, uri.toString(true));
      params.delete("windowId");
      uri = uri.with({ query: params.toString() });
      shouldOpenInNewWindow = true;
    } else if (isMacintosh && windowsMainService.getWindowCount() === 0) {
      this.logService.trace(`app#handleProtocolUrl() running on macOS with no window open, setting shouldOpenInNewWindow=true:`, uri.toString(true));
      shouldOpenInNewWindow = true;
    }
    const continueOn = params.get("continueOn");
    if (continueOn !== null) {
      this.logService.trace(`app#handleProtocolUrl() found 'continueOn' as parameter:`, uri.toString(true));
      params.delete("continueOn");
      uri = uri.with({ query: params.toString() });
      this.environmentMainService.continueOn = continueOn ?? void 0;
    }
    const session2 = params.get("session");
    if (session2 !== null) {
      this.logService.trace(`app#handleProtocolUrl() found 'session' as parameter:`, uri.toString(true));
      params.delete("session");
      uri = uri.with({ query: params.toString() });
    }
    const windowOpenableFromProtocolUrl = this.getWindowOpenableFromProtocolUrl(uri);
    if (windowOpenableFromProtocolUrl) {
      if (await this.shouldBlockOpenable(windowOpenableFromProtocolUrl, windowsMainService, dialogMainService)) {
        this.logService.trace("app#handleProtocolUrl() protocol url was blocked:", uri.toString(true));
        return true;
      } else {
        this.logService.trace("app#handleProtocolUrl() opening protocol url as window:", windowOpenableFromProtocolUrl, uri.toString(true));
        const window = (await windowsMainService.open({
          context: OpenContext.LINK,
          cli: { ...this.environmentMainService.args },
          urisToOpen: [windowOpenableFromProtocolUrl],
          forceNewWindow: shouldOpenInNewWindow,
          gotoLineMode: true
          // remoteAuthority: will be determined based on windowOpenableFromProtocolUrl
        })).at(0);
        window?.focus();
        if (window && session2) {
          window.sendWhenReady("vscode:openChatSession", CancellationToken.None, session2);
        }
        return true;
      }
    }
    if (shouldOpenInNewWindow) {
      this.logService.trace("app#handleProtocolUrl() opening empty window and passing in protocol url:", uri.toString(true));
      const window = (await windowsMainService.open({
        context: OpenContext.LINK,
        cli: { ...this.environmentMainService.args },
        forceNewWindow: true,
        forceEmpty: true,
        gotoLineMode: true,
        remoteAuthority: getRemoteAuthority(uri)
      })).at(0);
      await window?.ready();
      return urlService.open(uri, options);
    }
    this.logService.trace("app#handleProtocolUrl(): not handled", uri.toString(true), options);
    return false;
  }
  setupSharedProcess(machineId, sqmId, devDeviceId) {
    const sharedProcess = this._register(this.mainInstantiationService.createInstance(SharedProcess, machineId, sqmId, devDeviceId));
    this._register(sharedProcess.onDidCrash(() => this.windowsMainService?.sendToFocused("vscode:reportSharedProcessCrash")));
    const sharedProcessClient = (async () => {
      this.logService.trace("Main->SharedProcess#connect");
      const port = await sharedProcess.connect();
      this.logService.trace("Main->SharedProcess#connect: connection established");
      return new MessagePortClient(port, "main");
    })();
    const sharedProcessReady = (async () => {
      await sharedProcess.whenReady();
      return sharedProcessClient;
    })();
    return { sharedProcessReady, sharedProcessClient };
  }
  async initServices(machineId, sqmId, devDeviceId, sharedProcessReady) {
    const services = new ServiceCollection();
    switch (process.platform) {
      case "win32":
        services.set(IUpdateService, new SyncDescriptor(Win32UpdateService));
        break;
      case "linux":
        if (isLinuxSnap) {
          services.set(IUpdateService, new SyncDescriptor(SnapUpdateService, [process.env["SNAP"], process.env["SNAP_REVISION"]]));
        } else {
          services.set(IUpdateService, new SyncDescriptor(LinuxUpdateService));
        }
        break;
      case "darwin":
        services.set(IUpdateService, new SyncDescriptor(DarwinUpdateService));
        break;
    }
    services.set(IWindowsMainService, new SyncDescriptor(WindowsMainService, [machineId, sqmId, devDeviceId, this.userEnv], false));
    services.set(IAuxiliaryWindowsMainService, new SyncDescriptor(AuxiliaryWindowsMainService, void 0, false));
    const dialogMainService = new DialogMainService(this.logService, this.productService);
    services.set(IDialogMainService, dialogMainService);
    services.set(ILaunchMainService, new SyncDescriptor(
      LaunchMainService,
      void 0,
      false
      /* proxied to other processes */
    ));
    services.set(IDiagnosticsMainService, new SyncDescriptor(
      DiagnosticsMainService,
      void 0,
      false
      /* proxied to other processes */
    ));
    services.set(IDiagnosticsService, ProxyChannel.toService(getDelayedChannel(sharedProcessReady.then((client) => client.getChannel("diagnostics")))));
    services.set(IEncryptionMainService, new SyncDescriptor(EncryptionMainService));
    services.set(IBrowserViewMainService, new SyncDescriptor(
      BrowserViewMainService,
      void 0,
      false
      /* proxied to other processes */
    ));
    services.set(IBrowserViewGroupMainService, new SyncDescriptor(
      BrowserViewGroupMainService,
      void 0,
      false
      /* proxied to other processes */
    ));
    services.set(IKeyboardLayoutMainService, new SyncDescriptor(KeyboardLayoutMainService));
    services.set(INativeHostMainService, new SyncDescriptor(
      NativeHostMainService,
      void 0,
      false
      /* proxied to other processes */
    ));
    services.set(IGlobalKeybindingsMainService, new SyncDescriptor(GlobalKeybindingsMainService, [globalShortcut]));
    const meteredConnectionService = new MeteredConnectionMainService(this.configurationService);
    services.set(IMeteredConnectionService, meteredConnectionService);
    services.set(ITerminalSandboxService, new SyncDescriptor(NullTerminalSandboxService));
    services.set(IAgentNetworkFilterService, new SyncDescriptor(AgentNetworkFilterService, void 0, true));
    services.set(IWebContentExtractorService, new SyncDescriptor(
      NativeWebContentExtractorService,
      void 0,
      false
      /* proxied to other processes */
    ));
    services.set(IWebviewManagerService, new SyncDescriptor(WebviewMainService));
    services.set(IMenubarMainService, new SyncDescriptor(MenubarMainService));
    services.set(IExtensionHostStarter, new SyncDescriptor(ExtensionHostStarter));
    services.set(IStorageMainService, new SyncDescriptor(StorageMainService));
    services.set(IApplicationStorageMainService, new SyncDescriptor(ApplicationStorageMainService));
    const ptyHostStarter = new ElectronPtyHostStarter({
      graceTime: LocalReconnectConstants.GraceTime,
      shortGraceTime: LocalReconnectConstants.ShortGraceTime,
      scrollback: this.configurationService.getValue(TerminalSettingId.PersistentSessionScrollback) ?? 100
    }, this.configurationService, this.environmentMainService, this.lifecycleMainService, this.logService);
    const ptyHostService = new PtyHostService(
      ptyHostStarter,
      this.configurationService,
      this.logService,
      this.loggerService
    );
    services.set(ILocalPtyService, ptyHostService);
    if (isWindows) {
      services.set(IExternalTerminalMainService, new SyncDescriptor(WindowsExternalTerminalService));
    } else if (isMacintosh) {
      services.set(IExternalTerminalMainService, new SyncDescriptor(MacExternalTerminalService));
    } else if (isLinux) {
      services.set(IExternalTerminalMainService, new SyncDescriptor(LinuxExternalTerminalService));
    }
    services.set(ISandboxHelperMainService, new SyncDescriptor(SandboxHelperService));
    const backupMainService = new BackupMainService(this.environmentMainService, this.configurationService, this.logService, this.stateService);
    services.set(IBackupMainService, backupMainService);
    const workspacesManagementMainService = new WorkspacesManagementMainService(this.environmentMainService, this.logService, this.userDataProfilesMainService, backupMainService, dialogMainService);
    services.set(IWorkspacesManagementMainService, workspacesManagementMainService);
    services.set(IWorkspacesService, new SyncDescriptor(
      WorkspacesMainService,
      void 0,
      false
      /* proxied to other processes */
    ));
    services.set(IWorkspacesHistoryMainService, new SyncDescriptor(WorkspacesHistoryMainService, void 0, false));
    services.set(IURLService, new SyncDescriptor(
      NativeURLService,
      void 0,
      false
      /* proxied to other processes */
    ));
    if (supportsTelemetry(this.productService, this.environmentMainService)) {
      const isInternal = isInternalTelemetry(this.productService, this.configurationService);
      const channel = getDelayedChannel(sharedProcessReady.then((client) => client.getChannel("telemetryAppender")));
      const appender = new TelemetryAppenderClient(channel);
      const commonProperties = resolveCommonProperties(release(), hostname(), process.arch, this.productService.commit, this.productService.version, machineId, sqmId, devDeviceId, isInternal, this.productService.date);
      const piiPaths = getPiiPathsFromEnvironment(this.environmentMainService);
      const config = { appenders: [appender], commonProperties, piiPaths, sendErrorTelemetry: true };
      services.set(ITelemetryService, new SyncDescriptor(TelemetryService, [config], false));
    } else {
      services.set(ITelemetryService, NullTelemetryService);
    }
    services.set(IExtensionsProfileScannerService, new SyncDescriptor(ExtensionsProfileScannerService, void 0, true));
    services.set(IExtensionsScannerService, new SyncDescriptor(ExtensionsScannerService, void 0, true));
    services.set(IUtilityProcessWorkerMainService, new SyncDescriptor(UtilityProcessWorkerMainService, void 0, true));
    services.set(IProxyAuthService, new SyncDescriptor(ProxyAuthService));
    services.set(INativeMcpDiscoveryHelperService, new SyncDescriptor(NativeMcpDiscoveryHelperService));
    services.set(IMcpGatewayService, new SyncDescriptor(McpGatewayService));
    services.set(ICSSDevelopmentService, new SyncDescriptor(CSSDevelopmentService, void 0, true));
    await Promises.settled([
      backupMainService.initialize(),
      workspacesManagementMainService.initialize()
    ]);
    return this.mainInstantiationService.createChild(services);
  }
  initChannels(accessor, mainProcessElectronServer, sharedProcessClient) {
    const disposables = this._register(new DisposableStore());
    const launchChannel = ProxyChannel.fromService(accessor.get(ILaunchMainService), disposables, { disableMarshalling: true });
    this.mainProcessNodeIpcServer.registerChannel("launch", launchChannel);
    const diagnosticsChannel = ProxyChannel.fromService(accessor.get(IDiagnosticsMainService), disposables, { disableMarshalling: true });
    this.mainProcessNodeIpcServer.registerChannel("diagnostics", diagnosticsChannel);
    const policyChannel = disposables.add(new PolicyChannel(accessor.get(IPolicyService)));
    mainProcessElectronServer.registerChannel("policy", policyChannel);
    sharedProcessClient.then((client) => client.registerChannel("policy", policyChannel));
    const nativeManagedSettingsChannel = disposables.add(new NativeManagedSettingsChannel(accessor.get(INativeManagedSettingsService)));
    mainProcessElectronServer.registerChannel("nativeManagedSettings", nativeManagedSettingsChannel);
    const fileManagedSettingsChannel = disposables.add(new FileManagedSettingsChannel(accessor.get(IFileManagedSettingsService)));
    mainProcessElectronServer.registerChannel("fileManagedSettings", fileManagedSettingsChannel);
    const diskFileSystemProvider = this.fileService.getProvider(Schemas.file);
    assertType(diskFileSystemProvider instanceof DiskFileSystemProvider);
    const fileSystemProviderChannel = disposables.add(new DiskFileSystemProviderChannel(diskFileSystemProvider, this.logService, this.environmentMainService));
    mainProcessElectronServer.registerChannel(LOCAL_FILE_SYSTEM_CHANNEL_NAME, fileSystemProviderChannel);
    sharedProcessClient.then((client) => client.registerChannel(LOCAL_FILE_SYSTEM_CHANNEL_NAME, fileSystemProviderChannel));
    const userDataProfilesService = ProxyChannel.fromService(accessor.get(IUserDataProfilesMainService), disposables);
    mainProcessElectronServer.registerChannel("userDataProfiles", userDataProfilesService);
    sharedProcessClient.then((client) => client.registerChannel("userDataProfiles", userDataProfilesService));
    const updateService = accessor.get(IUpdateService);
    const updateChannel = new UpdateChannel(updateService);
    mainProcessElectronServer.registerChannel("update", updateChannel);
    this._register(new NotAvailableUpdateDialog(updateService, accessor.get(IDialogMainService), accessor.get(IWindowsMainService)));
    const meteredConnectionChannel = new MeteredConnectionChannel(accessor.get(IMeteredConnectionService));
    mainProcessElectronServer.registerChannel(METERED_CONNECTION_CHANNEL, meteredConnectionChannel);
    sharedProcessClient.then((client) => client.registerChannel(METERED_CONNECTION_CHANNEL, meteredConnectionChannel));
    const processChannel = ProxyChannel.fromService(new ProcessMainService(this.logService, accessor.get(IDiagnosticsService), accessor.get(IDiagnosticsMainService)), disposables);
    mainProcessElectronServer.registerChannel("process", processChannel);
    const encryptionChannel = ProxyChannel.fromService(accessor.get(IEncryptionMainService), disposables);
    mainProcessElectronServer.registerChannel("encryption", encryptionChannel);
    const browserViewChannel = ProxyChannel.fromService(accessor.get(IBrowserViewMainService), disposables);
    mainProcessElectronServer.registerChannel(ipcBrowserViewChannelName, browserViewChannel);
    sharedProcessClient.then((client) => client.registerChannel(ipcBrowserViewChannelName, browserViewChannel));
    const browserViewGroupChannel = ProxyChannel.fromService(accessor.get(IBrowserViewGroupMainService), disposables);
    mainProcessElectronServer.registerChannel(ipcBrowserViewGroupChannelName, browserViewGroupChannel);
    sharedProcessClient.then((client) => client.registerChannel(ipcBrowserViewGroupChannelName, browserViewGroupChannel));
    const signChannel = ProxyChannel.fromService(accessor.get(ISignService), disposables);
    mainProcessElectronServer.registerChannel("sign", signChannel);
    const keyboardLayoutChannel = ProxyChannel.fromService(accessor.get(IKeyboardLayoutMainService), disposables);
    mainProcessElectronServer.registerChannel("keyboardLayout", keyboardLayoutChannel);
    this.nativeHostMainService = accessor.get(INativeHostMainService);
    const nativeHostChannel = ProxyChannel.fromService(this.nativeHostMainService, disposables, {
      // This event has main-process consumers but no IPC consumer, so its buffer would never drain.
      unbufferedEvents: ["onDidBlurMainWindow"]
    });
    mainProcessElectronServer.registerChannel("nativeHost", nativeHostChannel);
    sharedProcessClient.then((client) => client.registerChannel("nativeHost", nativeHostChannel));
    const webContentExtractorChannel = ProxyChannel.fromService(accessor.get(IWebContentExtractorService), disposables);
    mainProcessElectronServer.registerChannel("webContentExtractor", webContentExtractorChannel);
    const workspacesChannel = ProxyChannel.fromService(accessor.get(IWorkspacesService), disposables);
    mainProcessElectronServer.registerChannel("workspaces", workspacesChannel);
    const menubarChannel = ProxyChannel.fromService(accessor.get(IMenubarMainService), disposables);
    mainProcessElectronServer.registerChannel("menubar", menubarChannel);
    const urlChannel = ProxyChannel.fromService(accessor.get(IURLService), disposables);
    mainProcessElectronServer.registerChannel("url", urlChannel);
    const webviewChannel = ProxyChannel.fromService(accessor.get(IWebviewManagerService), disposables);
    mainProcessElectronServer.registerChannel("webview", webviewChannel);
    const storageChannel = disposables.add(new StorageDatabaseChannel(this.logService, accessor.get(IStorageMainService)));
    mainProcessElectronServer.registerChannel("storage", storageChannel);
    sharedProcessClient.then((client) => client.registerChannel("storage", storageChannel));
    const profileStorageListener = disposables.add(new ProfileStorageChangesListenerChannel(accessor.get(IStorageMainService), accessor.get(IUserDataProfilesMainService), this.logService));
    sharedProcessClient.then((client) => client.registerChannel("profileStorageListener", profileStorageListener));
    const ptyHostChannel = ProxyChannel.fromService(accessor.get(ILocalPtyService), disposables);
    mainProcessElectronServer.registerChannel(TerminalIpcChannels.LocalPty, ptyHostChannel);
    const externalTerminalChannel = ProxyChannel.fromService(accessor.get(IExternalTerminalMainService), disposables);
    mainProcessElectronServer.registerChannel("externalTerminal", externalTerminalChannel);
    const sandboxHelperChannel = ProxyChannel.fromService(accessor.get(ISandboxHelperMainService), disposables);
    mainProcessElectronServer.registerChannel("sandboxHelper", sandboxHelperChannel);
    const mcpDiscoveryChannel = ProxyChannel.fromService(accessor.get(INativeMcpDiscoveryHelperService), disposables);
    mainProcessElectronServer.registerChannel(NativeMcpDiscoveryHelperChannelName, mcpDiscoveryChannel);
    const mcpGatewayChannel = this._register(new McpGatewayChannel(mainProcessElectronServer, accessor.get(IMcpGatewayService), accessor.get(ILoggerMainService)));
    mainProcessElectronServer.registerChannel(McpGatewayChannelName, mcpGatewayChannel);
    const loggerChannel = this._register(new LoggerChannel(accessor.get(ILoggerMainService)));
    mainProcessElectronServer.registerChannel("logger", loggerChannel);
    sharedProcessClient.then((client) => client.registerChannel("logger", loggerChannel));
    const electronExtensionHostDebugBroadcastChannel = new ElectronExtensionHostDebugBroadcastChannel(accessor.get(IWindowsMainService));
    mainProcessElectronServer.registerChannel("extensionhostdebugservice", electronExtensionHostDebugBroadcastChannel);
    const extensionHostStarterChannel = ProxyChannel.fromService(accessor.get(IExtensionHostStarter), disposables);
    mainProcessElectronServer.registerChannel(ipcExtensionHostStarterChannelName, extensionHostStarterChannel);
    const utilityProcessWorkerChannel = ProxyChannel.fromService(accessor.get(IUtilityProcessWorkerMainService), disposables);
    mainProcessElectronServer.registerChannel(ipcUtilityProcessWorkerChannelName, utilityProcessWorkerChannel);
  }
  async openFirstWindow(accessor, initialProtocolUrls) {
    const windowsMainService = this.windowsMainService = accessor.get(IWindowsMainService);
    this.auxiliaryWindowsMainService = accessor.get(IAuxiliaryWindowsMainService);
    const context = isLaunchedFromCli(process.env) ? OpenContext.CLI : OpenContext.DESKTOP;
    const args = this.environmentMainService.args;
    if (args["agents"]) {
      return windowsMainService.openAgentsWindow({
        context,
        cli: args,
        initialStartup: true
      });
    }
    if (initialProtocolUrls) {
      if (initialProtocolUrls.openables.length > 0) {
        return windowsMainService.open({
          context,
          cli: args,
          urisToOpen: initialProtocolUrls.openables,
          gotoLineMode: true,
          initialStartup: true
          // remoteAuthority: will be determined based on openables
        });
      }
      if (initialProtocolUrls.urls.length > 0) {
        for (const protocolUrl of initialProtocolUrls.urls) {
          const params = new URLSearchParams(protocolUrl.uri.query);
          if (params.get("windowId") === "_blank") {
            params.delete("windowId");
            protocolUrl.originalUrl = protocolUrl.uri.toString(true);
            protocolUrl.uri = protocolUrl.uri.with({ query: params.toString() });
            return windowsMainService.open({
              context,
              cli: args,
              forceNewWindow: true,
              forceEmpty: true,
              gotoLineMode: true,
              initialStartup: true
              // remoteAuthority: will be determined based on openables
            });
          }
        }
      }
    }
    const macOpenFiles = global.macOpenFiles ?? [];
    const hasCliArgs = args._.length;
    const hasFolderURIs = !!args["folder-uri"];
    const hasFileURIs = !!args["file-uri"];
    const noRecentEntry = args["skip-add-to-recently-opened"] === true;
    const waitMarkerFileURI = args.wait && args.waitMarkerFilePath ? URI.file(args.waitMarkerFilePath) : void 0;
    const remoteAuthority = args.remote || void 0;
    const forceProfile = args.profile;
    const forceTempProfile = args["profile-temp"];
    if (!hasCliArgs && !hasFolderURIs && !hasFileURIs) {
      if (args["new-window"] || forceProfile || forceTempProfile) {
        return windowsMainService.open({
          context,
          cli: args,
          forceNewWindow: true,
          forceEmpty: true,
          noRecentEntry,
          waitMarkerFileURI,
          initialStartup: true,
          remoteAuthority,
          forceProfile,
          forceTempProfile
        });
      }
      if (macOpenFiles.length) {
        return windowsMainService.open({
          context: OpenContext.DOCK,
          cli: args,
          urisToOpen: macOpenFiles.map((path) => {
            path = normalizeNFC(path);
            return hasWorkspaceFileExtension(path) ? { workspaceUri: URI.file(path) } : { fileUri: URI.file(path) };
          }),
          noRecentEntry,
          waitMarkerFileURI,
          initialStartup: true
          // remoteAuthority: will be determined based on macOpenFiles
        });
      }
    }
    return windowsMainService.open({
      context,
      cli: args,
      forceNewWindow: args["new-window"],
      diffMode: args.diff,
      mergeMode: args.merge,
      noRecentEntry,
      waitMarkerFileURI,
      gotoLineMode: args.goto,
      initialStartup: true,
      remoteAuthority,
      forceProfile,
      forceTempProfile
    });
  }
  afterWindowOpen(instantiationService) {
    if (isWindows) {
      initWindowsVersionInfo();
    }
    this.installMutex();
    protocol.registerHttpProtocol(Schemas.vscodeRemoteResource, (request, callback) => {
      callback({
        url: request.url.replace(/^vscode-remote-resource:/, "http:"),
        method: request.method
      });
    });
    this.resolveShellEnvironment(this.environmentMainService.args, process.env, true);
    this.updateCrashReporterEnablement();
    if (isMacintosh && app.runningUnderARM64Translation) {
      this.windowsMainService?.sendToFocused("vscode:showTranslatedBuildWarning");
    }
    instantiationService.invokeFunction((accessor) => {
      const telemetryService = accessor.get(ITelemetryService);
      const getPowerEventData = () => ({
        idleState: powerMonitor.getSystemIdleState(60),
        idleTime: powerMonitor.getSystemIdleTime(),
        thermalState: powerMonitor.getCurrentThermalState(),
        onBattery: powerMonitor.isOnBatteryPower()
      });
      this._register(Event.fromNodeEventEmitter(powerMonitor, "suspend")(() => {
        telemetryService.publicLog2("power.suspend", getPowerEventData());
      }));
      this._register(Event.fromNodeEventEmitter(powerMonitor, "resume")(() => {
        telemetryService.publicLog2("power.resume", getPowerEventData());
      }));
    });
    if (isMacintosh) {
      instantiationService.invokeFunction((accessor) => {
        const telemetryService = accessor.get(ITelemetryService);
        const initialGpuFeatureStatus = app.getGPUFeatureStatus();
        const skiaGraphiteEnabled = initialGpuFeatureStatus["skia_graphite"];
        if (skiaGraphiteEnabled === "enabled") {
          const gpuInfoUpdate = Event.fromNodeEventEmitter(app, "gpu-info-update");
          const pendingGpuInfoListener = this._register(new MutableDisposable());
          this._register(Event.fromNodeEventEmitter(app, "child-process-gone", (event, details) => ({ event, details }))(({ details }) => {
            if (details.type === "GPU" && details.reason === "crashed") {
              pendingGpuInfoListener.value = Event.once(gpuInfoUpdate)(() => {
                const currentGpuFeatureStatus = app.getGPUFeatureStatus();
                const currentRasterizationStatus = currentGpuFeatureStatus["rasterization"];
                if (currentRasterizationStatus !== "enabled") {
                  let gpuLogMessages = [];
                  const customApp = app;
                  if (typeof customApp.getGPULogMessages === "function") {
                    gpuLogMessages = customApp.getGPULogMessages().slice(-10).map((log) => log.message);
                  }
                  telemetryService.publicLog2("gpu.crash.fallback", {
                    gpuFeatureStatus: JSON.stringify(currentGpuFeatureStatus),
                    gpuLogMessages: JSON.stringify(gpuLogMessages)
                  });
                }
              });
            }
          }));
        }
      });
    }
    {
      const customApp = app;
      instantiationService.invokeFunction((accessor) => {
        const telemetryService = accessor.get(ITelemetryService);
        this._register(Event.fromNodeEventEmitter(customApp, "network-process-launched", (_event, details) => details)((details) => {
          this.logService.info(`[network process] launched with pid ${details.pid}`);
          telemetryService.publicLog2("networkProcess.launched", {});
        }));
        this._register(Event.fromNodeEventEmitter(customApp, "network-process-gone", (_event, details) => details)((details) => {
          this.logService.info(`[network process] gone - pid: ${details.pid}, exitCode: ${details.exitCode}, crashed: ${details.crashed}, crashedPreIPC: ${details.crashedPreIPC}`);
          telemetryService.publicLog2("networkProcess.gone", {
            exitCode: details.exitCode,
            crashed: details.crashed,
            crashedPreIPC: details.crashedPreIPC
          });
        }));
      });
    }
  }
  async installMutex() {
    const win32MutexName = this.productService.win32MutexName;
    if (isWindows && win32MutexName && isInnoSetupInstall()) {
      try {
        const WindowsMutex = await import("@vscode/windows-mutex");
        const mutex = new WindowsMutex.Mutex(win32MutexName);
        Event.once(this.lifecycleMainService.onWillShutdown)(() => mutex.release());
      } catch (error) {
        this.logService.error(error);
      }
    }
  }
  async resolveShellEnvironment(args, env, notifyOnError) {
    try {
      return await getResolvedShellEnv(this.configurationService, this.logService, args, env);
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      if (notifyOnError) {
        this.windowsMainService?.sendToFocused("vscode:showResolveShellEnvError", errorMessage);
      } else {
        this.logService.error(errorMessage);
      }
    }
    return {};
  }
  async updateCrashReporterEnablement() {
    try {
      const argvContent = await this.fileService.readFile(this.environmentMainService.argvResource);
      const argvString = argvContent.value.toString();
      const argvJSON = parse(argvString);
      const telemetryLevel = getTelemetryLevel(this.configurationService);
      const enableCrashReporter = telemetryLevel >= TelemetryLevel.CRASH;
      if (argvJSON["enable-crash-reporter"] === void 0) {
        const additionalArgvContent = [
          "",
          "	// Allows to disable crash reporting.",
          "	// Should restart the app if the value is changed.",
          `	"enable-crash-reporter": ${enableCrashReporter},`,
          "",
          "	// Unique id used for correlating crash reports sent from this instance.",
          "	// Do not edit this value.",
          `	"crash-reporter-id": "${generateUuid()}"`,
          "}"
        ];
        const newArgvString = argvString.substring(0, argvString.length - 2).concat(",\n", additionalArgvContent.join("\n"));
        await this.fileService.writeFile(this.environmentMainService.argvResource, VSBuffer.fromString(newArgvString));
      } else {
        const newArgvString = argvString.replace(/"enable-crash-reporter": .*,/, `"enable-crash-reporter": ${enableCrashReporter},`);
        if (newArgvString !== argvString) {
          await this.fileService.writeFile(this.environmentMainService.argvResource, VSBuffer.fromString(newArgvString));
        }
      }
    } catch (error) {
      this.logService.error(error);
      this.windowsMainService?.sendToFocused("vscode:showArgvParseWarning");
    }
  }
  eventuallyAfterWindowOpen(instantiationService) {
    validateDevDeviceId(this.stateService, this.logService);
    instantiationService.invokeFunction((accessor) => {
      const telemetryService = accessor.get(ITelemetryService);
      if (telemetryService.telemetryLevel < TelemetryLevel.USAGE) {
        return;
      }
      const nativeHostMainService = accessor.get(INativeHostMainService);
      void this.logOSProxyConfigTelemetry(nativeHostMainService, telemetryService);
    });
  }
  async logOSProxyConfigTelemetry(nativeHostMainService, telemetryService) {
    const startTime = Date.now();
    try {
      const config = await nativeHostMainService.readProxyConfigWithPackage(void 0);
      const durationMs = Date.now() - startTime;
      const pacScriptStats = config.pac ? getPACScriptStats(config.pac.content) : void 0;
      telemetryService.publicLog2("osProxyConfig", {
        success: true,
        durationMs,
        platformKind: config.platform?.kind ?? "none",
        autoDetect: config.autoDetect,
        httpProxyEnvironmentState: getOSProxyEnvironmentState(config.environment.httpProxy),
        httpsProxyEnvironmentState: getOSProxyEnvironmentState(config.environment.httpsProxy),
        allProxyEnvironmentState: getOSProxyEnvironmentState(config.environment.allProxy),
        noProxyEnvironmentState: getOSProxyEnvironmentState(config.environment.noProxy),
        wpadDhcpState: config.wpadDhcp.state,
        wpadDnsState: config.wpadDns.state,
        configuredPacState: config.configuredPac.state,
        hasConfiguredPac: !!config.pacUrl,
        hasLoadedPac: !!config.pac,
        pacSource: config.pac?.source ?? "none",
        pacScriptCharacterCount: pacScriptStats?.characterCount,
        pacScriptLineCount: pacScriptStats?.lineCount,
        pacScriptReturnCount: pacScriptStats?.returnCount,
        hasHttpProxy: !!config.staticRules?.http,
        hasHttpsProxy: !!config.staticRules?.https,
        hasSocksProxy: !!config.staticRules?.socks,
        hasBypassRules: hasOSProxyBypassRules(config),
        excludeSimpleHostnames: config.platform?.kind === "macos" ? config.platform.excludeSimpleHostnames : void 0
      });
    } catch {
      telemetryService.publicLog2("osProxyConfig", {
        success: false,
        durationMs: Date.now() - startTime
      });
    }
  }
};
CodeApplication = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, ILogService),
  __decorateParam(4, ILoggerService),
  __decorateParam(5, IEnvironmentMainService),
  __decorateParam(6, ILifecycleMainService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IStateService),
  __decorateParam(9, IFileService),
  __decorateParam(10, IProductService),
  __decorateParam(11, IUserDataProfilesMainService)
], CodeApplication);
function hasOSProxyBypassRules(config) {
  switch (config.platform?.kind) {
    case "windows":
      return !!config.platform.proxyBypass;
    case "macos":
      return config.platform.excludeSimpleHostnames || config.platform.exceptions.length > 0;
    case "linux":
      return config.platform.ignoreHosts.length > 0;
    default:
      return false;
  }
}
function getOSProxyEnvironmentState(status) {
  return status ? status.error ? "invalid" : "configured" : "unset";
}
function getPACScriptStats(content) {
  return {
    characterCount: content.length,
    lineCount: content.length === 0 ? 0 : content.split(/\r\n|\r|\n/).length,
    returnCount: content.match(/\breturn\b/g)?.length ?? 0
  };
}
export {
  CodeApplication
};
