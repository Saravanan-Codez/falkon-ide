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
import "./media/window.css";
import { localize } from "../../nls.js";
import { URI } from "../../base/common/uri.js";
import { equals } from "../../base/common/objects.js";
import { EventType, EventHelper, addDisposableListener, ModifierKeyEmitter, getActiveElement, hasWindow, getWindowById, getWindows, $ } from "../../base/browser/dom.js";
import { Action, Separator } from "../../base/common/actions.js";
import { IFileService } from "../../platform/files/common/files.js";
import { EditorResourceAccessor, SideBySideEditor, pathsToEditors, isResourceEditorInput } from "../common/editor.js";
import { IEditorService } from "../services/editor/common/editorService.js";
import { ITelemetryService } from "../../platform/telemetry/common/telemetry.js";
import { WindowMinimumSize, hasNativeTitlebar } from "../../platform/window/common/window.js";
import { ITitleService } from "../services/title/browser/titleService.js";
import { IWorkbenchThemeService } from "../services/themes/common/workbenchThemeService.js";
import { ApplyZoomTarget, applyZoom } from "../../platform/window/electron-browser/window.js";
import { setFullscreen, getZoomLevel, onDidChangeZoomLevel, getZoomFactor } from "../../base/browser/browser.js";
import { ICommandService, CommandsRegistry } from "../../platform/commands/common/commands.js";
import { ipcRenderer, process } from "../../base/parts/sandbox/electron-browser/globals.js";
import { IWorkspaceEditingService } from "../services/workspaces/common/workspaceEditing.js";
import { IMenuService, MenuId, MenuItemAction, MenuRegistry } from "../../platform/actions/common/actions.js";
import { getFlatActionBarActions } from "../../platform/actions/browser/menuEntryActionViewItem.js";
import { RunOnceScheduler } from "../../base/common/async.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../base/common/lifecycle.js";
import { LifecyclePhase, ILifecycleService, ShutdownReason } from "../services/lifecycle/common/lifecycle.js";
import { IIntegrityService } from "../services/integrity/common/integrity.js";
import { isWindows, isMacintosh } from "../../base/common/platform.js";
import { IProductService } from "../../platform/product/common/productService.js";
import { INotificationService, NeverShowAgainScope, NotificationPriority, Severity } from "../../platform/notification/common/notification.js";
import { IKeybindingService } from "../../platform/keybinding/common/keybinding.js";
import { INativeWorkbenchEnvironmentService } from "../services/environment/electron-browser/environmentService.js";
import { IAccessibilityService, AccessibilitySupport } from "../../platform/accessibility/common/accessibility.js";
import { WorkbenchState, IWorkspaceContextService } from "../../platform/workspace/common/workspace.js";
import { coalesce } from "../../base/common/arrays.js";
import { ConfigurationTarget, IConfigurationService } from "../../platform/configuration/common/configuration.js";
import { IStorageService, StorageScope, StorageTarget } from "../../platform/storage/common/storage.js";
import { IOpenerService } from "../../platform/opener/common/opener.js";
import { Schemas } from "../../base/common/network.js";
import { INativeHostService } from "../../platform/native/common/native.js";
import { posix } from "../../base/common/path.js";
import { ITunnelService, extractLocalHostUriMetaDataForPortMapping, extractQueryLocalHostUriMetaDataForPortMapping } from "../../platform/tunnel/common/tunnel.js";
import { IWorkbenchLayoutService, positionFromString, Position } from "../services/layout/browser/layoutService.js";
import { IWorkingCopyService } from "../services/workingCopy/common/workingCopyService.js";
import { WorkingCopyCapabilities } from "../services/workingCopy/common/workingCopy.js";
import { IFilesConfigurationService } from "../services/filesConfiguration/common/filesConfigurationService.js";
import { Event } from "../../base/common/event.js";
import { IRemoteAuthorityResolverService } from "../../platform/remote/common/remoteAuthorityResolver.js";
import { IEditorGroupsService } from "../services/editor/common/editorGroupsService.js";
import { IDialogService } from "../../platform/dialogs/common/dialogs.js";
import { ILogService } from "../../platform/log/common/log.js";
import { IInstantiationService } from "../../platform/instantiation/common/instantiation.js";
import { whenEditorClosed } from "../browser/editor.js";
import { ISharedProcessService } from "../../platform/ipc/electron-browser/services.js";
import { IProgressService, ProgressLocation } from "../../platform/progress/common/progress.js";
import { toErrorMessage } from "../../base/common/errorMessage.js";
import { ILabelService } from "../../platform/label/common/label.js";
import { dirname } from "../../base/common/resources.js";
import { IBannerService } from "../services/banner/browser/bannerService.js";
import { Codicon } from "../../base/common/codicons.js";
import { IUriIdentityService } from "../../platform/uriIdentity/common/uriIdentity.js";
import { IPreferencesService } from "../services/preferences/common/preferences.js";
import { IUtilityProcessWorkerWorkbenchService } from "../services/utilityProcess/electron-browser/utilityProcessWorkerWorkbenchService.js";
import { registerWindowDriver } from "../services/driver/browser/driver.js";
import { mainWindow } from "../../base/browser/window.js";
import { BaseWindow } from "../browser/window.js";
import { IHostService } from "../services/host/browser/host.js";
import { IStatusbarService, ShowTooltipCommand, StatusbarAlignment } from "../services/statusbar/browser/statusbar.js";
import { ActionBar } from "../../base/browser/ui/actionbar/actionbar.js";
import { ThemeIcon } from "../../base/common/themables.js";
import { getWorkbenchContribution } from "../common/contributions.js";
import { DynamicWorkbenchSecurityConfiguration } from "../common/configuration.js";
import { nativeHoverDelegate } from "../../platform/hover/browser/hover.js";
import { WINDOW_ACTIVE_BORDER, WINDOW_INACTIVE_BORDER } from "../common/theme.js";
import { IContextMenuService } from "../../platform/contextview/browser/contextView.js";
let NativeWindow = class extends BaseWindow {
  constructor(editorService, editorGroupService, configurationService, titleService, themeService, notificationService, commandService, keybindingService, telemetryService, workspaceEditingService, fileService, menuService, lifecycleService, integrityService, nativeEnvironmentService, accessibilityService, contextService, openerService, nativeHostService, tunnelService, layoutService, workingCopyService, filesConfigurationService, productService, remoteAuthorityResolverService, dialogService, storageService, logService, instantiationService, sharedProcessService, progressService, labelService, bannerService, uriIdentityService, preferencesService, utilityProcessWorkerWorkbenchService, hostService, contextMenuService) {
    super(mainWindow, void 0, hostService, nativeEnvironmentService, contextMenuService, layoutService);
    this.editorService = editorService;
    this.editorGroupService = editorGroupService;
    this.configurationService = configurationService;
    this.titleService = titleService;
    this.themeService = themeService;
    this.notificationService = notificationService;
    this.commandService = commandService;
    this.keybindingService = keybindingService;
    this.telemetryService = telemetryService;
    this.workspaceEditingService = workspaceEditingService;
    this.fileService = fileService;
    this.menuService = menuService;
    this.lifecycleService = lifecycleService;
    this.integrityService = integrityService;
    this.nativeEnvironmentService = nativeEnvironmentService;
    this.accessibilityService = accessibilityService;
    this.contextService = contextService;
    this.openerService = openerService;
    this.nativeHostService = nativeHostService;
    this.tunnelService = tunnelService;
    this.workingCopyService = workingCopyService;
    this.filesConfigurationService = filesConfigurationService;
    this.productService = productService;
    this.remoteAuthorityResolverService = remoteAuthorityResolverService;
    this.dialogService = dialogService;
    this.storageService = storageService;
    this.logService = logService;
    this.instantiationService = instantiationService;
    this.sharedProcessService = sharedProcessService;
    this.progressService = progressService;
    this.labelService = labelService;
    this.bannerService = bannerService;
    this.uriIdentityService = uriIdentityService;
    this.preferencesService = preferencesService;
    this.utilityProcessWorkerWorkbenchService = utilityProcessWorkerWorkbenchService;
    this.customTitleContextMenuDisposable = this._register(new DisposableStore());
    this.addRemoveFoldersScheduler = this._register(new RunOnceScheduler(() => this.doAddRemoveFolders(), 100));
    this.pendingFoldersToAdd = [];
    this.pendingFoldersToRemove = [];
    this.isDocumentedEdited = false;
    this.touchBarDisposables = this._register(new DisposableStore());
    //#region Window Zoom
    this.mapWindowIdToZoomStatusEntry = /* @__PURE__ */ new Map();
    this.configuredWindowZoomLevel = this.resolveConfiguredWindowZoomLevel();
    this.registerListeners();
    this.create();
  }
  registerListeners() {
    this._register(addDisposableListener(mainWindow, EventType.RESIZE, () => this.layoutService.layout()));
    this._register(this.editorService.onDidActiveEditorChange(() => this.updateTouchbarMenu()));
    for (const event of [EventType.DRAG_OVER, EventType.DROP]) {
      this._register(addDisposableListener(mainWindow.document.body, event, (e) => {
        EventHelper.stop(e);
      }));
    }
    ipcRenderer.on("vscode:runAction", async (event, ...argsRaw) => {
      const request = argsRaw[0];
      const args = request.args || [];
      if (request.from === "touchbar") {
        const activeEditor = this.editorService.activeEditor;
        if (activeEditor) {
          const resource = EditorResourceAccessor.getOriginalUri(activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
          if (resource) {
            args.push(resource);
          }
        }
      } else if (request.from === "systemWideKeybinding") {
      } else {
        args.push({ from: request.from });
      }
      try {
        await this.commandService.executeCommand(request.id, ...args);
        this.telemetryService.publicLog2("workbenchActionExecuted", { id: request.id, from: request.from });
      } catch (error) {
        this.notificationService.error(error);
      }
    });
    ipcRenderer.on("vscode:runKeybinding", (event, ...argsRaw) => {
      const request = argsRaw[0];
      const activeElement = getActiveElement();
      if (activeElement) {
        this.keybindingService.dispatchByUserSettingsLabel(request.userSettingsLabel, activeElement);
      }
    });
    ipcRenderer.on("vscode:reportSharedProcessCrash", (event, ...argsRaw) => {
      this.notificationService.prompt(
        Severity.Error,
        localize("sharedProcessCrash", "A shared background process terminated unexpectedly. Please restart the application to recover."),
        [{
          label: localize("restart", "Restart"),
          run: () => this.nativeHostService.relaunch()
        }],
        {
          priority: NotificationPriority.URGENT
        }
      );
    });
    ipcRenderer.on("vscode:openFiles", (event, ...argsRaw) => {
      this.onOpenFiles(argsRaw[0]);
    });
    ipcRenderer.on("vscode:addRemoveFolders", (event, ...argsRaw) => this.onAddRemoveFoldersRequest(argsRaw[0]));
    ipcRenderer.on("vscode:showInfoMessage", (event, ...argsRaw) => this.notificationService.info(argsRaw[0]));
    ipcRenderer.on("vscode:showResolveShellEnvError", (event, ...argsRaw) => {
      const message = argsRaw[0];
      this.notificationService.prompt(
        Severity.Error,
        message,
        [
          {
            label: localize("restart", "Restart"),
            run: () => this.nativeHostService.relaunch()
          },
          {
            label: localize("configure", "Configure"),
            run: () => this.preferencesService.openUserSettings({ query: "application.shellEnvironmentResolutionTimeout" })
          },
          {
            label: localize("learnMore", "Learn More"),
            run: () => this.openerService.open("https://go.microsoft.com/fwlink/?linkid=2149667")
          }
        ]
      );
    });
    ipcRenderer.on("vscode:showCredentialsError", (event, ...argsRaw) => {
      const message = argsRaw[0];
      this.notificationService.prompt(
        Severity.Error,
        localize("keychainWriteError", "Writing login information to the keychain failed with error '{0}'.", message),
        [{
          label: localize("troubleshooting", "Troubleshooting Guide"),
          run: () => this.openerService.open("https://go.microsoft.com/fwlink/?linkid=2190713")
        }]
      );
    });
    ipcRenderer.on("vscode:showTranslatedBuildWarning", () => {
      this.notificationService.prompt(
        Severity.Warning,
        localize("runningTranslated", "You are running an emulated version of {0}. For better performance download the native arm64 version of {0} build for your machine.", this.productService.nameLong),
        [{
          label: localize("downloadArmBuild", "Download"),
          run: () => {
            const quality = this.productService.quality;
            const stableURL = "https://code.visualstudio.com/docs/?dv=osx";
            const insidersURL = "https://code.visualstudio.com/docs/?dv=osx&build=insiders";
            this.openerService.open(quality === "stable" ? stableURL : insidersURL);
          }
        }],
        {
          priority: NotificationPriority.URGENT
        }
      );
    });
    ipcRenderer.on("vscode:showArgvParseWarning", () => {
      this.notificationService.prompt(
        Severity.Warning,
        localize("showArgvParseWarning", "The runtime arguments file 'argv.json' contains errors. Please correct them and restart."),
        [{
          label: localize("showArgvParseWarningAction", "Open File"),
          run: () => this.editorService.openEditor({ resource: this.nativeEnvironmentService.argvResource })
        }],
        {
          priority: NotificationPriority.URGENT
        }
      );
    });
    ipcRenderer.on("vscode:enterFullScreen", () => setFullscreen(true, mainWindow));
    ipcRenderer.on("vscode:leaveFullScreen", () => setFullscreen(false, mainWindow));
    ipcRenderer.on("vscode:openProxyAuthenticationDialog", async (event, ...argsRaw) => {
      const payload = argsRaw[0];
      const rememberCredentialsKey = "window.rememberProxyCredentials";
      const rememberCredentials = this.storageService.getBoolean(rememberCredentialsKey, StorageScope.APPLICATION);
      const result = await this.dialogService.input({
        type: "warning",
        message: localize("proxyAuthRequired", "Proxy Authentication Required"),
        primaryButton: localize({ key: "loginButton", comment: ["&& denotes a mnemonic"] }, "&&Log In"),
        inputs: [
          { placeholder: localize("username", "Username"), value: payload.username },
          { placeholder: localize("password", "Password"), type: "password", value: payload.password }
        ],
        detail: localize("proxyDetail", "The proxy {0} requires a username and password.", `${payload.authInfo.host}:${payload.authInfo.port}`),
        checkbox: {
          label: localize("rememberCredentials", "Remember my credentials"),
          checked: rememberCredentials
        }
      });
      if (!result.confirmed || !result.values) {
        ipcRenderer.send(payload.replyChannel);
      } else {
        if (result.checkboxChecked) {
          this.storageService.store(rememberCredentialsKey, true, StorageScope.APPLICATION, StorageTarget.MACHINE);
        } else {
          this.storageService.remove(rememberCredentialsKey, StorageScope.APPLICATION);
        }
        const [username, password] = result.values;
        ipcRenderer.send(payload.replyChannel, { username, password, remember: !!result.checkboxChecked });
      }
    });
    ipcRenderer.on("vscode:accessibilitySupportChanged", (event, ...argsRaw) => {
      const accessibilitySupportEnabled = argsRaw[0];
      this.accessibilityService.setAccessibilitySupport(accessibilitySupportEnabled ? AccessibilitySupport.Enabled : AccessibilitySupport.Disabled);
    });
    ipcRenderer.on("vscode:configureAllowedUNCHost", async (event, ...argsRaw) => {
      const host = argsRaw[0];
      if (!isWindows) {
        return;
      }
      const allowedUncHosts = /* @__PURE__ */ new Set();
      const configuredAllowedUncHosts = this.configurationService.getValue("security.allowedUNCHosts") ?? [];
      if (Array.isArray(configuredAllowedUncHosts)) {
        for (const configuredAllowedUncHost of configuredAllowedUncHosts) {
          if (typeof configuredAllowedUncHost === "string") {
            allowedUncHosts.add(configuredAllowedUncHost);
          }
        }
      }
      if (!allowedUncHosts.has(host)) {
        allowedUncHosts.add(host);
        await getWorkbenchContribution(DynamicWorkbenchSecurityConfiguration.ID).ready;
        this.configurationService.updateValue("security.allowedUNCHosts", [...allowedUncHosts.values()], ConfigurationTarget.USER);
      }
    });
    ipcRenderer.on("vscode:disablePromptForProtocolHandling", (event, ...argsRaw) => {
      const kind = argsRaw[0];
      const setting = kind === "local" ? "security.promptForLocalFileProtocolHandling" : "security.promptForRemoteFileProtocolHandling";
      this.configurationService.updateValue(setting, false);
    });
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("window.zoomLevel") || e.affectsConfiguration("window.zoomPerWindow") && this.configurationService.getValue("window.zoomPerWindow") === false) {
        this.onDidChangeConfiguredWindowZoomLevel();
      } else if (e.affectsConfiguration("keyboard.touchbar.enabled") || e.affectsConfiguration("keyboard.touchbar.ignored")) {
        this.updateTouchbarMenu();
      } else if (e.affectsConfiguration("window.border")) {
        this.updateWindowBorder();
      }
    }));
    this._register(onDidChangeZoomLevel((targetWindowId) => this.handleOnDidChangeZoomLevel(targetWindowId)));
    for (const part of this.editorGroupService.parts) {
      this.createWindowZoomStatusEntry(part);
    }
    this._register(this.editorGroupService.onDidCreateAuxiliaryEditorPart((part) => this.createWindowZoomStatusEntry(part)));
    this._register(Event.debounce(this.editorService.onDidVisibleEditorsChange, () => void 0, 0, void 0, void 0, void 0, this._store)(() => this.maybeCloseWindow()));
    const filesToWait = this.nativeEnvironmentService.filesToWait;
    if (filesToWait) {
      this.trackClosedWaitFiles(filesToWait.waitMarkerFileUri, coalesce(filesToWait.paths.map((path) => path.fileUri)));
    }
    if (isMacintosh) {
      for (const part of this.editorGroupService.parts) {
        this.handleRepresentedFilename(part);
      }
      this._register(this.editorGroupService.onDidCreateAuxiliaryEditorPart((part) => this.handleRepresentedFilename(part)));
    }
    this._register(this.workingCopyService.onDidChangeDirty((workingCopy) => {
      const gotDirty = workingCopy.isDirty();
      if (gotDirty && !(workingCopy.capabilities & WorkingCopyCapabilities.Untitled) && this.filesConfigurationService.hasShortAutoSaveDelay(workingCopy.resource)) {
        return;
      }
      this.updateDocumentEdited(gotDirty ? true : void 0);
    }));
    this.updateDocumentEdited(void 0);
    this._register(Event.any(
      Event.map(Event.filter(this.nativeHostService.onDidMaximizeWindow, (windowId) => !!hasWindow(windowId)), (windowId) => ({ maximized: true, windowId })),
      Event.map(Event.filter(this.nativeHostService.onDidUnmaximizeWindow, (windowId) => !!hasWindow(windowId)), (windowId) => ({ maximized: false, windowId }))
    )((e) => this.layoutService.updateWindowMaximizedState(getWindowById(e.windowId).window, e.maximized)));
    this.layoutService.updateWindowMaximizedState(mainWindow, this.nativeEnvironmentService.window.maximized ?? false);
    this._register(this.layoutService.onDidChangePanelPosition((pos) => this.onDidChangePanelPosition(positionFromString(pos))));
    this.onDidChangePanelPosition(this.layoutService.getPanelPosition());
    this._register(this.themeService.onDidColorThemeChange(() => this.updateWindowBorder()));
    this._register(this.hostService.onDidChangeActiveWindow(() => this.updateWindowBorder()));
    this._register(this.hostService.onDidChangeFocus(() => this.updateWindowBorder()));
    this._register(this.lifecycleService.onBeforeShutdown((e) => this.onBeforeShutdown(e)));
    this._register(this.lifecycleService.onBeforeShutdownError((e) => this.onBeforeShutdownError(e)));
    this._register(this.lifecycleService.onWillShutdown((e) => this.onWillShutdown(e)));
  }
  handleRepresentedFilename(part) {
    const disposables = new DisposableStore();
    Event.once(part.onWillDispose)(() => disposables.dispose());
    this.editorGroupService.getScopedInstantiationService(part).invokeFunction((accessor) => {
      const editorService = accessor.get(IEditorService);
      disposables.add(editorService.onDidActiveEditorChange(() => this.updateRepresentedFilename(editorService, part.windowId)));
    });
  }
  updateRepresentedFilename(editorService, targetWindowId) {
    const file = EditorResourceAccessor.getOriginalUri(editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY, filterByScheme: Schemas.file });
    this.nativeHostService.setRepresentedFilename(file?.fsPath ?? "", { targetWindowId });
    if (targetWindowId === mainWindow.vscodeWindowId) {
      this.provideCustomTitleContextMenu(file?.fsPath);
    }
  }
  //#region Window Lifecycle
  onBeforeShutdown({ veto, reason }) {
    if (reason === ShutdownReason.CLOSE) {
      const confirmBeforeCloseSetting = this.configurationService.getValue("window.confirmBeforeClose");
      const confirmBeforeClose = confirmBeforeCloseSetting === "always" || confirmBeforeCloseSetting === "keyboardOnly" && ModifierKeyEmitter.getInstance().isModifierPressed;
      if (confirmBeforeClose) {
        return veto((async () => {
          let actualReason = reason;
          if (reason === ShutdownReason.CLOSE && !isMacintosh) {
            const windowCount = await this.nativeHostService.getWindowCount();
            if (windowCount === 1) {
              actualReason = ShutdownReason.QUIT;
            }
          }
          let confirmed = true;
          if (confirmBeforeClose) {
            confirmed = await this.instantiationService.invokeFunction((accessor) => NativeWindow.confirmOnShutdown(accessor, actualReason));
          }
          if (confirmed) {
            this.progressOnBeforeShutdown(reason);
          }
          return !confirmed;
        })(), "veto.confirmBeforeClose");
      }
    }
    this.progressOnBeforeShutdown(reason);
  }
  progressOnBeforeShutdown(reason) {
    this.progressService.withProgress({
      location: ProgressLocation.Window,
      // use window progress to not be too annoying about this operation
      delay: 800,
      // delay so that it only appears when operation takes a long time
      title: this.toShutdownLabel(reason, false)
    }, () => {
      return Event.toPromise(Event.any(
        this.lifecycleService.onWillShutdown,
        // dismiss this dialog when we shutdown
        this.lifecycleService.onShutdownVeto,
        // or when shutdown was vetoed
        this.dialogService.onWillShowDialog
        // or when a dialog asks for input
      ));
    });
  }
  onBeforeShutdownError({ error, reason }) {
    this.dialogService.error(this.toShutdownLabel(reason, true), localize("shutdownErrorDetail", "Error: {0}", toErrorMessage(error)));
  }
  onWillShutdown({ reason, force, joiners }) {
    const shutdownDialogScheduler = new RunOnceScheduler(() => {
      const pendingJoiners = joiners();
      this.progressService.withProgress({
        location: ProgressLocation.Dialog,
        // use a dialog to prevent the user from making any more interactions now
        buttons: [this.toForceShutdownLabel(reason)],
        // allow to force shutdown anyway
        cancellable: false,
        // do not allow to cancel
        sticky: true,
        // do not allow to dismiss
        title: this.toShutdownLabel(reason, false),
        detail: pendingJoiners.length > 0 ? localize("willShutdownDetail", "The following operations are still running: \n{0}", pendingJoiners.map((joiner) => `- ${joiner.label}`).join("\n")) : void 0
      }, () => {
        return Event.toPromise(this.lifecycleService.onDidShutdown);
      }, () => {
        force();
      });
    }, 1200);
    shutdownDialogScheduler.schedule();
    Event.once(this.lifecycleService.onDidShutdown)(() => shutdownDialogScheduler.dispose());
  }
  toShutdownLabel(reason, isError) {
    if (isError) {
      switch (reason) {
        case ShutdownReason.CLOSE:
          return localize("shutdownErrorClose", "An unexpected error prevented the window to close");
        case ShutdownReason.QUIT:
          return localize("shutdownErrorQuit", "An unexpected error prevented the application to quit");
        case ShutdownReason.RELOAD:
          return localize("shutdownErrorReload", "An unexpected error prevented the window to reload");
        case ShutdownReason.LOAD:
          return localize("shutdownErrorLoad", "An unexpected error prevented to change the workspace");
      }
    }
    switch (reason) {
      case ShutdownReason.CLOSE:
        return localize("shutdownTitleClose", "Closing the window is taking a bit longer...");
      case ShutdownReason.QUIT:
        return localize("shutdownTitleQuit", "Quitting the application is taking a bit longer...");
      case ShutdownReason.RELOAD:
        return localize("shutdownTitleReload", "Reloading the window is taking a bit longer...");
      case ShutdownReason.LOAD:
        return localize("shutdownTitleLoad", "Changing the workspace is taking a bit longer...");
    }
  }
  toForceShutdownLabel(reason) {
    switch (reason) {
      case ShutdownReason.CLOSE:
        return localize("shutdownForceClose", "Close Anyway");
      case ShutdownReason.QUIT:
        return localize("shutdownForceQuit", "Quit Anyway");
      case ShutdownReason.RELOAD:
        return localize("shutdownForceReload", "Reload Anyway");
      case ShutdownReason.LOAD:
        return localize("shutdownForceLoad", "Change Anyway");
    }
  }
  //#endregion
  updateDocumentEdited(documentEdited) {
    let setDocumentEdited;
    if (typeof documentEdited === "boolean") {
      setDocumentEdited = documentEdited;
    } else {
      setDocumentEdited = this.workingCopyService.hasDirty;
    }
    if (!this.isDocumentedEdited && setDocumentEdited || this.isDocumentedEdited && !setDocumentEdited) {
      this.isDocumentedEdited = setDocumentEdited;
      this.nativeHostService.setDocumentEdited(setDocumentEdited);
    }
  }
  getWindowMinimumWidth(panelPosition = this.layoutService.getPanelPosition()) {
    const panelOnSide = panelPosition === Position.LEFT || panelPosition === Position.RIGHT;
    if (panelOnSide) {
      return WindowMinimumSize.WIDTH_WITH_VERTICAL_PANEL;
    }
    return WindowMinimumSize.WIDTH;
  }
  onDidChangePanelPosition(pos) {
    const minWidth = this.getWindowMinimumWidth(pos);
    this.nativeHostService.setMinimumSize(minWidth, void 0);
  }
  maybeCloseWindow() {
    const closeWhenEmpty = this.configurationService.getValue("window.closeWhenEmpty") || this.nativeEnvironmentService.args.wait;
    if (!closeWhenEmpty) {
      return;
    }
    for (const editorPart of this.editorGroupService.parts) {
      if (editorPart.groups.some((group) => !group.isEmpty)) {
        continue;
      }
      if (editorPart === this.editorGroupService.mainPart && (this.contextService.getWorkbenchState() !== WorkbenchState.EMPTY || // only for empty windows
      this.environmentService.isExtensionDevelopment || // not when developing an extension
      this.editorService.visibleEditors.length > 0)) {
        continue;
      }
      if (editorPart === this.editorGroupService.mainPart) {
        this.nativeHostService.closeWindow();
      } else {
        editorPart.removeGroup(editorPart.activeGroup);
      }
    }
  }
  provideCustomTitleContextMenu(filePath) {
    this.customTitleContextMenuDisposable.clear();
    if (!filePath || hasNativeTitlebar(this.configurationService)) {
      return;
    }
    const segments = filePath.split(posix.sep);
    for (let i = segments.length; i > 0; i--) {
      const isFile = i === segments.length;
      let pathOffset = i;
      if (!isFile) {
        pathOffset++;
      }
      const path = URI.file(segments.slice(0, pathOffset).join(posix.sep));
      let label;
      if (!isFile) {
        label = this.labelService.getUriBasenameLabel(dirname(path));
      } else {
        label = this.labelService.getUriBasenameLabel(path);
      }
      const commandId = `workbench.action.revealPathInFinder${i}`;
      this.customTitleContextMenuDisposable.add(CommandsRegistry.registerCommand(commandId, () => this.nativeHostService.showItemInFolder(path.fsPath)));
      this.customTitleContextMenuDisposable.add(MenuRegistry.appendMenuItem(MenuId.TitleBarTitleContext, { command: { id: commandId, title: label || posix.sep }, order: -i, group: "1_file" }));
    }
  }
  create() {
    this.setupOpenHandlers();
    this.lifecycleService.when(LifecyclePhase.Ready).then(() => this.nativeHostService.notifyReady());
    this.lifecycleService.when(LifecyclePhase.Restored).then(() => {
      this.sharedProcessService.notifyRestored();
      this.utilityProcessWorkerWorkbenchService.notifyRestored();
    });
    this.handleWarnings();
    this.updateTouchbarMenu();
    this.updateWindowBorder();
    if (this.environmentService.enableSmokeTestDriver) {
      registerWindowDriver(this.instantiationService);
    }
  }
  async handleWarnings() {
    await this.lifecycleService.when(LifecyclePhase.Restored);
    (async () => {
      const isAdmin = await this.nativeHostService.isAdmin();
      const { isPure } = await this.integrityService.isPure();
      this.titleService.updateProperties({ isPure, isAdmin });
      if (isAdmin && !isWindows) {
        this.notificationService.warn(localize("runningAsRoot", "It is not recommended to run {0} as root user.", this.productService.nameShort));
      }
    })();
    if (this.environmentService.isBuilt && !this.environmentService.extensionDevelopmentLocationURI?.length) {
      let installLocationUri;
      if (isMacintosh) {
        installLocationUri = dirname(dirname(dirname(URI.file(this.nativeEnvironmentService.appRoot))));
      } else {
        installLocationUri = dirname(dirname(URI.file(this.nativeEnvironmentService.appRoot)));
      }
      for (const folder of this.contextService.getWorkspace().folders) {
        if (this.uriIdentityService.extUri.isEqualOrParent(folder.uri, installLocationUri)) {
          this.bannerService.show({
            id: "appRootWarning.banner",
            message: localize("appRootWarning.banner", "Files you store within the installation folder ('{0}') may be OVERWRITTEN or DELETED IRREVERSIBLY without warning at update time.", this.labelService.getUriLabel(installLocationUri)),
            icon: Codicon.warning
          });
          break;
        }
      }
    }
    if (isMacintosh) {
      const majorVersion = this.nativeEnvironmentService.os.release.split(".")[0];
      const eolReleases = /* @__PURE__ */ new Map([
        ["20", "macOS Big Sur"]
      ]);
      if (eolReleases.has(majorVersion)) {
        const message = localize("macoseolmessage", "{0} on {1} will soon stop receiving updates. Consider upgrading your macOS version.", this.productService.nameLong, eolReleases.get(majorVersion));
        this.notificationService.prompt(
          Severity.Warning,
          message,
          [{
            label: localize("learnMore", "Learn More"),
            run: () => this.openerService.open(URI.parse("https://aka.ms/vscode-faq-old-macOS"))
          }],
          {
            neverShowAgain: { id: "macoseol", isSecondary: true, scope: NeverShowAgainScope.APPLICATION },
            priority: NotificationPriority.URGENT,
            sticky: true
          }
        );
      }
    }
    const shellEnv = process.shellEnv();
    this.progressService.withProgress({
      title: localize("resolveShellEnvironment", "Resolving shell environment..."),
      location: ProgressLocation.Window,
      delay: 1600,
      buttons: [localize("learnMore", "Learn More")]
    }, () => shellEnv, () => this.openerService.open("https://go.microsoft.com/fwlink/?linkid=2149667"));
  }
  async resolveExternalUri(uri, options) {
    let queryTunnel;
    if (options?.allowTunneling) {
      const portMappingRequest = extractLocalHostUriMetaDataForPortMapping(uri);
      const queryPortMapping = extractQueryLocalHostUriMetaDataForPortMapping(uri);
      if (queryPortMapping) {
        queryTunnel = await this.openTunnel(queryPortMapping.address, queryPortMapping.port);
        if (queryTunnel && typeof queryTunnel !== "string") {
          if (queryTunnel.tunnelRemotePort !== queryPortMapping.port) {
            queryTunnel.dispose();
            queryTunnel = void 0;
          } else {
            if (!portMappingRequest) {
              const tunnel = queryTunnel;
              return {
                resolved: uri,
                dispose: () => tunnel.dispose()
              };
            }
          }
        }
      }
      if (portMappingRequest) {
        const tunnel = await this.openTunnel(portMappingRequest.address, portMappingRequest.port);
        if (tunnel && typeof tunnel !== "string") {
          const addressAsUri = URI.parse(tunnel.localAddress).with({ path: uri.path });
          const resolved = addressAsUri.scheme.startsWith(uri.scheme) ? addressAsUri : uri.with({ authority: tunnel.localAddress });
          return {
            resolved,
            dispose() {
              tunnel.dispose();
              if (queryTunnel && typeof queryTunnel !== "string") {
                queryTunnel.dispose();
              }
            }
          };
        }
      }
    }
    if (!options?.openExternal) {
      const canHandleResource = await this.fileService.canHandleResource(uri);
      if (canHandleResource) {
        return {
          resolved: URI.from({
            scheme: this.productService.urlProtocol,
            path: "workspace",
            query: uri.toString()
          }),
          dispose() {
          }
        };
      }
    }
    return void 0;
  }
  async openTunnel(address, port) {
    const remoteAuthority = this.environmentService.remoteAuthority;
    const addressProvider = remoteAuthority ? {
      getAddress: async () => {
        return (await this.remoteAuthorityResolverService.resolveAuthority(remoteAuthority)).authority;
      }
    } : void 0;
    const tunnel = await this.tunnelService.getExistingTunnel(address, port);
    if (!tunnel || typeof tunnel === "string") {
      return this.tunnelService.openTunnel(addressProvider, address, port);
    }
    return tunnel;
  }
  setupOpenHandlers() {
    this.openerService.setDefaultExternalOpener({
      openExternal: async (href) => {
        const success = await this.nativeHostService.openExternal(href, this.configurationService.getValue("workbench.externalBrowser"));
        if (!success) {
          const fileCandidate = URI.parse(href);
          if (fileCandidate.scheme === Schemas.file) {
            await this.nativeHostService.showItemInFolder(fileCandidate.fsPath);
          }
        }
        return true;
      }
    });
    this.openerService.registerExternalUriResolver({
      resolveExternalUri: async (uri, options) => {
        return this.resolveExternalUri(uri, options);
      }
    });
  }
  updateTouchbarMenu() {
    if (!isMacintosh) {
      return;
    }
    this.touchBarDisposables.clear();
    this.touchBarMenu = void 0;
    const scheduler = this.touchBarDisposables.add(new RunOnceScheduler(() => this.doUpdateTouchbarMenu(scheduler), 300));
    scheduler.schedule();
  }
  doUpdateTouchbarMenu(scheduler) {
    if (!this.touchBarMenu) {
      const scopedContextKeyService = this.editorService.activeEditorPane?.scopedContextKeyService || this.editorGroupService.activeGroup.scopedContextKeyService;
      this.touchBarMenu = this.menuService.createMenu(MenuId.TouchBarContext, scopedContextKeyService);
      this.touchBarDisposables.add(this.touchBarMenu);
      this.touchBarDisposables.add(this.touchBarMenu.onDidChange(() => scheduler.schedule()));
    }
    const disabled = this.configurationService.getValue("keyboard.touchbar.enabled") === false;
    const touchbarIgnored = this.configurationService.getValue("keyboard.touchbar.ignored");
    const ignoredItems = Array.isArray(touchbarIgnored) ? touchbarIgnored : [];
    const actions = getFlatActionBarActions(this.touchBarMenu.getActions());
    const items = [];
    let group = [];
    if (!disabled) {
      for (const action of actions) {
        if (action instanceof MenuItemAction) {
          if (ignoredItems.indexOf(action.item.id) >= 0) {
            continue;
          }
          group.push(action.item);
        } else if (action instanceof Separator) {
          if (group.length) {
            items.push(group);
          }
          group = [];
        }
      }
      if (group.length) {
        items.push(group);
      }
    }
    if (!equals(this.lastInstalledTouchedBar, items)) {
      this.lastInstalledTouchedBar = items;
      this.nativeHostService.updateTouchBar(items);
    }
  }
  //#endregion
  //#region Window Border
  updateWindowBorder() {
    if (!isWindows) {
      return;
    }
    const theme = this.themeService.getColorTheme();
    let activeBorder = theme.getColor(WINDOW_ACTIVE_BORDER)?.toString();
    let inactiveBorder = theme.getColor(WINDOW_INACTIVE_BORDER)?.toString();
    const borderSetting = this.configurationService.getValue("window.border");
    if (borderSetting === "off") {
      activeBorder = "off";
      inactiveBorder = void 0;
    } else if (borderSetting === "default") {
      activeBorder = activeBorder ?? "default";
    } else if (borderSetting === "system") {
      activeBorder = "default";
      inactiveBorder = void 0;
    } else {
      activeBorder = borderSetting;
      inactiveBorder = void 0;
    }
    this.nativeHostService.updateWindowAccentColor(activeBorder, inactiveBorder);
  }
  //#endregion
  onAddRemoveFoldersRequest(request) {
    this.pendingFoldersToAdd.push(...request.foldersToAdd.map((folder) => URI.revive(folder)));
    this.pendingFoldersToRemove.push(...request.foldersToRemove.map((folder) => URI.revive(folder)));
    if (!this.addRemoveFoldersScheduler.isScheduled()) {
      this.addRemoveFoldersScheduler.schedule();
    }
  }
  async doAddRemoveFolders() {
    const foldersToAdd = this.pendingFoldersToAdd.map((folder) => ({ uri: folder }));
    const foldersToRemove = this.pendingFoldersToRemove.slice(0);
    this.pendingFoldersToAdd = [];
    this.pendingFoldersToRemove = [];
    if (foldersToAdd.length) {
      await this.workspaceEditingService.addFolders(foldersToAdd);
    }
    if (foldersToRemove.length) {
      await this.workspaceEditingService.removeFolders(foldersToRemove);
    }
  }
  async onOpenFiles(request) {
    const diffMode = !!(request.filesToDiff && request.filesToDiff.length === 2);
    const mergeMode = !!(request.filesToMerge && request.filesToMerge.length === 4);
    const inputs = coalesce(await pathsToEditors(mergeMode ? request.filesToMerge : diffMode ? request.filesToDiff : request.filesToOpenOrCreate, this.fileService, this.logService));
    if (inputs.length) {
      const openedEditorPanes = await this.openResources(inputs, diffMode, mergeMode);
      if (request.filesToWait) {
        if (openedEditorPanes.length) {
          return this.trackClosedWaitFiles(URI.revive(request.filesToWait.waitMarkerFileUri), coalesce(request.filesToWait.paths.map((path) => URI.revive(path.fileUri))));
        } else {
          return this.fileService.del(URI.revive(request.filesToWait.waitMarkerFileUri));
        }
      }
    }
  }
  async trackClosedWaitFiles(waitMarkerFile, resourcesToWaitFor) {
    await this.instantiationService.invokeFunction((accessor) => whenEditorClosed(accessor, resourcesToWaitFor));
    await this.fileService.del(waitMarkerFile);
  }
  async openResources(resources, diffMode, mergeMode) {
    const editors = [];
    if (mergeMode && isResourceEditorInput(resources[0]) && isResourceEditorInput(resources[1]) && isResourceEditorInput(resources[2]) && isResourceEditorInput(resources[3])) {
      const mergeEditor = {
        input1: { resource: resources[0].resource },
        input2: { resource: resources[1].resource },
        base: { resource: resources[2].resource },
        result: { resource: resources[3].resource },
        options: { pinned: true }
      };
      editors.push(mergeEditor);
    } else if (diffMode && isResourceEditorInput(resources[0]) && isResourceEditorInput(resources[1])) {
      const diffEditor = {
        original: { resource: resources[0].resource },
        modified: { resource: resources[1].resource },
        options: { pinned: true }
      };
      editors.push(diffEditor);
    } else {
      editors.push(...resources);
    }
    return this.editorService.openEditors(editors, void 0, { validateTrust: true });
  }
  resolveConfiguredWindowZoomLevel() {
    const windowZoomLevel = this.configurationService.getValue("window.zoomLevel");
    return typeof windowZoomLevel === "number" ? windowZoomLevel : 0;
  }
  handleOnDidChangeZoomLevel(targetWindowId) {
    this.updateWindowZoomStatusEntry(targetWindowId);
    if (targetWindowId === mainWindow.vscodeWindowId) {
      const currentWindowZoomLevel = getZoomLevel(mainWindow);
      let notifyZoomLevel = void 0;
      if (this.configuredWindowZoomLevel !== currentWindowZoomLevel) {
        notifyZoomLevel = currentWindowZoomLevel;
      }
      ipcRenderer.invoke("vscode:notifyZoomLevel", notifyZoomLevel);
    }
  }
  createWindowZoomStatusEntry(part) {
    const disposables = new DisposableStore();
    Event.once(part.onWillDispose)(() => disposables.dispose());
    const scopedInstantiationService = this.editorGroupService.getScopedInstantiationService(part);
    this.mapWindowIdToZoomStatusEntry.set(part.windowId, disposables.add(scopedInstantiationService.createInstance(ZoomStatusEntry)));
    disposables.add(toDisposable(() => this.mapWindowIdToZoomStatusEntry.delete(part.windowId)));
    this.updateWindowZoomStatusEntry(part.windowId);
  }
  updateWindowZoomStatusEntry(targetWindowId) {
    const targetWindow = getWindowById(targetWindowId);
    const entry = this.mapWindowIdToZoomStatusEntry.get(targetWindowId);
    if (entry && targetWindow) {
      const currentZoomLevel = getZoomLevel(targetWindow.window);
      let text = void 0;
      if (currentZoomLevel < this.configuredWindowZoomLevel) {
        text = "$(zoom-out)";
      } else if (currentZoomLevel > this.configuredWindowZoomLevel) {
        text = "$(zoom-in)";
      }
      entry.updateZoomEntry(text ?? false, targetWindowId);
    }
  }
  onDidChangeConfiguredWindowZoomLevel() {
    this.configuredWindowZoomLevel = this.resolveConfiguredWindowZoomLevel();
    let applyZoomLevel = false;
    for (const { window } of getWindows()) {
      if (getZoomLevel(window) !== this.configuredWindowZoomLevel) {
        applyZoomLevel = true;
        break;
      }
    }
    if (applyZoomLevel) {
      applyZoom(this.configuredWindowZoomLevel, ApplyZoomTarget.ALL_WINDOWS);
    }
    for (const [windowId] of this.mapWindowIdToZoomStatusEntry) {
      this.updateWindowZoomStatusEntry(windowId);
    }
  }
  //#endregion
  dispose() {
    super.dispose();
    for (const [, entry] of this.mapWindowIdToZoomStatusEntry) {
      entry.dispose();
    }
  }
};
NativeWindow = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IEditorGroupsService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, ITitleService),
  __decorateParam(4, IWorkbenchThemeService),
  __decorateParam(5, INotificationService),
  __decorateParam(6, ICommandService),
  __decorateParam(7, IKeybindingService),
  __decorateParam(8, ITelemetryService),
  __decorateParam(9, IWorkspaceEditingService),
  __decorateParam(10, IFileService),
  __decorateParam(11, IMenuService),
  __decorateParam(12, ILifecycleService),
  __decorateParam(13, IIntegrityService),
  __decorateParam(14, INativeWorkbenchEnvironmentService),
  __decorateParam(15, IAccessibilityService),
  __decorateParam(16, IWorkspaceContextService),
  __decorateParam(17, IOpenerService),
  __decorateParam(18, INativeHostService),
  __decorateParam(19, ITunnelService),
  __decorateParam(20, IWorkbenchLayoutService),
  __decorateParam(21, IWorkingCopyService),
  __decorateParam(22, IFilesConfigurationService),
  __decorateParam(23, IProductService),
  __decorateParam(24, IRemoteAuthorityResolverService),
  __decorateParam(25, IDialogService),
  __decorateParam(26, IStorageService),
  __decorateParam(27, ILogService),
  __decorateParam(28, IInstantiationService),
  __decorateParam(29, ISharedProcessService),
  __decorateParam(30, IProgressService),
  __decorateParam(31, ILabelService),
  __decorateParam(32, IBannerService),
  __decorateParam(33, IUriIdentityService),
  __decorateParam(34, IPreferencesService),
  __decorateParam(35, IUtilityProcessWorkerWorkbenchService),
  __decorateParam(36, IHostService),
  __decorateParam(37, IContextMenuService)
], NativeWindow);
let ZoomStatusEntry = class extends Disposable {
  constructor(statusbarService, commandService, keybindingService) {
    super();
    this.statusbarService = statusbarService;
    this.commandService = commandService;
    this.keybindingService = keybindingService;
    this.disposable = this._register(new MutableDisposable());
    this.zoomLevelLabel = void 0;
  }
  updateZoomEntry(visibleOrText, targetWindowId) {
    if (typeof visibleOrText === "string") {
      if (!this.disposable.value) {
        this.createZoomEntry(visibleOrText);
      }
      this.updateZoomLevelLabel(targetWindowId);
    } else {
      this.disposable.clear();
    }
  }
  createZoomEntry(visibleOrText) {
    const disposables = new DisposableStore();
    this.disposable.value = disposables;
    const container = $(".zoom-status");
    const left = $(".zoom-status-left");
    container.appendChild(left);
    const zoomOutAction = disposables.add(new Action("workbench.action.zoomOut", localize("zoomOut", "Zoom Out"), ThemeIcon.asClassName(Codicon.remove), true, () => this.commandService.executeCommand(zoomOutAction.id)));
    const zoomInAction = disposables.add(new Action("workbench.action.zoomIn", localize("zoomIn", "Zoom In"), ThemeIcon.asClassName(Codicon.plus), true, () => this.commandService.executeCommand(zoomInAction.id)));
    const zoomResetAction = disposables.add(new Action("workbench.action.zoomReset", localize("zoomReset", "Reset"), void 0, true, () => this.commandService.executeCommand(zoomResetAction.id)));
    zoomResetAction.tooltip = this.keybindingService.appendKeybinding(zoomResetAction.label, zoomResetAction.id);
    const zoomSettingsAction = disposables.add(new Action("workbench.action.openSettings", localize("zoomSettings", "Settings"), ThemeIcon.asClassName(Codicon.settingsGear), true, () => this.commandService.executeCommand(zoomSettingsAction.id, "window.zoom")));
    const zoomLevelLabel = disposables.add(new Action("zoomLabel", void 0, void 0, false));
    this.zoomLevelLabel = zoomLevelLabel;
    disposables.add(toDisposable(() => this.zoomLevelLabel = void 0));
    const actionBarLeft = disposables.add(new ActionBar(left, { hoverDelegate: nativeHoverDelegate }));
    actionBarLeft.push(zoomOutAction, { icon: true, label: false, keybinding: this.keybindingService.lookupKeybinding(zoomOutAction.id)?.getLabel() });
    actionBarLeft.push(this.zoomLevelLabel, { icon: false, label: true });
    actionBarLeft.push(zoomInAction, { icon: true, label: false, keybinding: this.keybindingService.lookupKeybinding(zoomInAction.id)?.getLabel() });
    const right = $(".zoom-status-right");
    container.appendChild(right);
    const actionBarRight = disposables.add(new ActionBar(right, { hoverDelegate: nativeHoverDelegate }));
    actionBarRight.push(zoomResetAction, { icon: false, label: true });
    actionBarRight.push(zoomSettingsAction, { icon: true, label: false, keybinding: this.keybindingService.lookupKeybinding(zoomSettingsAction.id)?.getLabel() });
    const name = localize("status.windowZoom", "Window Zoom");
    disposables.add(this.statusbarService.addEntry({
      name,
      text: visibleOrText,
      tooltip: container,
      ariaLabel: name,
      command: ShowTooltipCommand,
      kind: "prominent"
    }, "status.windowZoom", StatusbarAlignment.RIGHT, 102));
  }
  updateZoomLevelLabel(targetWindowId) {
    if (this.zoomLevelLabel) {
      const targetWindow = getWindowById(targetWindowId, true).window;
      const zoomFactor = Math.round(getZoomFactor(targetWindow) * 100);
      const zoomLevel = getZoomLevel(targetWindow);
      this.zoomLevelLabel.label = `${zoomLevel}`;
      this.zoomLevelLabel.tooltip = localize("zoomNumber", "Zoom Level: {0} ({1}%)", zoomLevel, zoomFactor);
    }
  }
};
ZoomStatusEntry = __decorateClass([
  __decorateParam(0, IStatusbarService),
  __decorateParam(1, ICommandService),
  __decorateParam(2, IKeybindingService)
], ZoomStatusEntry);
export {
  NativeWindow
};
