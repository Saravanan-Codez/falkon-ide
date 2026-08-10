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
import { app, BrowserWindow, Menu, MenuItem } from "electron";
import { RunOnceScheduler } from "../../../base/common/async.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
import { mnemonicMenuLabel } from "../../../base/common/labels.js";
import { isMacintosh, language } from "../../../base/common/platform.js";
import { URI } from "../../../base/common/uri.js";
import * as nls from "../../../nls.js";
import { IAuxiliaryWindowsMainService } from "../../auxiliaryWindow/electron-main/auxiliaryWindows.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { IEnvironmentMainService } from "../../environment/electron-main/environmentMainService.js";
import { ILifecycleMainService } from "../../lifecycle/electron-main/lifecycleMainService.js";
import { ILogService } from "../../log/common/log.js";
import { isMenubarMenuItemAction, isMenubarMenuItemRecentAction, isMenubarMenuItemSeparator, isMenubarMenuItemSubmenu } from "../common/menubar.js";
import { INativeHostMainService } from "../../native/electron-main/nativeHostMainService.js";
import { IProductService } from "../../product/common/productService.js";
import { IStateService } from "../../state/node/state.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { IUpdateService, StateType } from "../../update/common/update.js";
import { hasNativeMenu } from "../../window/common/window.js";
import { IWindowsMainService, OpenContext } from "../../windows/electron-main/windows.js";
import { IWorkspacesHistoryMainService } from "../../workspaces/electron-main/workspacesHistoryMainService.js";
import { Disposable } from "../../../base/common/lifecycle.js";
const telemetryFrom = "menu";
let Menubar = class extends Disposable {
  constructor(updateService, configurationService, windowsMainService, environmentMainService, telemetryService, workspacesHistoryMainService, stateService, lifecycleMainService, logService, nativeHostMainService, productService, auxiliaryWindowsMainService) {
    super();
    this.updateService = updateService;
    this.configurationService = configurationService;
    this.windowsMainService = windowsMainService;
    this.environmentMainService = environmentMainService;
    this.telemetryService = telemetryService;
    this.workspacesHistoryMainService = workspacesHistoryMainService;
    this.stateService = stateService;
    this.lifecycleMainService = lifecycleMainService;
    this.logService = logService;
    this.nativeHostMainService = nativeHostMainService;
    this.productService = productService;
    this.auxiliaryWindowsMainService = auxiliaryWindowsMainService;
    this.fallbackMenuHandlers = /* @__PURE__ */ Object.create(null);
    this.menuUpdater = this._register(new RunOnceScheduler(() => this.doUpdateMenu(), 0));
    this.menuGC = this._register(new RunOnceScheduler(() => {
      this.oldMenus = [];
    }, 1e4));
    this.menubarMenus = /* @__PURE__ */ Object.create(null);
    this.keybindings = /* @__PURE__ */ Object.create(null);
    this.showNativeMenu = hasNativeMenu(configurationService);
    if (isMacintosh || this.showNativeMenu) {
      this.restoreCachedMenubarData();
    }
    this.addFallbackHandlers();
    this.closedLastWindow = false;
    this.noActiveMainWindow = false;
    this.oldMenus = [];
    this.install();
    this.registerListeners();
  }
  static {
    this.lastKnownMenubarStorageKey = "lastKnownMenubarData";
  }
  restoreCachedMenubarData() {
    const menubarData = this.stateService.getItem(Menubar.lastKnownMenubarStorageKey);
    if (menubarData) {
      if (menubarData.menus) {
        this.menubarMenus = menubarData.menus;
      }
      if (menubarData.keybindings) {
        this.keybindings = menubarData.keybindings;
      }
    }
  }
  addFallbackHandlers() {
    this.fallbackMenuHandlers["workbench.action.files.newUntitledFile"] = (menuItem, win, event) => {
      if (!this.runActionInRenderer({ type: "commandId", commandId: "workbench.action.files.newUntitledFile" })) {
        this.windowsMainService.openEmptyWindow({ context: OpenContext.MENU, contextWindowId: win?.id });
      }
    };
    this.fallbackMenuHandlers["workbench.action.newWindow"] = (menuItem, win, event) => this.windowsMainService.openEmptyWindow({ context: OpenContext.MENU, contextWindowId: win?.id });
    this.fallbackMenuHandlers["workbench.action.files.openFileFolder"] = (menuItem, win, event) => this.nativeHostMainService.pickFileFolderAndOpen(void 0, { forceNewWindow: this.isOptionClick(event), telemetryExtraData: { from: telemetryFrom } });
    this.fallbackMenuHandlers["workbench.action.files.openFolder"] = (menuItem, win, event) => this.nativeHostMainService.pickFolderAndOpen(void 0, { forceNewWindow: this.isOptionClick(event), telemetryExtraData: { from: telemetryFrom } });
    this.fallbackMenuHandlers["workbench.action.openWorkspace"] = (menuItem, win, event) => this.nativeHostMainService.pickWorkspaceAndOpen(void 0, { forceNewWindow: this.isOptionClick(event), telemetryExtraData: { from: telemetryFrom } });
    this.fallbackMenuHandlers["workbench.action.clearRecentFiles"] = () => this.workspacesHistoryMainService.clearRecentlyOpened({
      confirm: true
      /* ask for confirmation */
    });
    const youTubeUrl = this.productService.youTubeUrl;
    if (youTubeUrl) {
      this.fallbackMenuHandlers["workbench.action.openYouTubeUrl"] = () => this.openUrl(youTubeUrl, "openYouTubeUrl");
    }
    const requestFeatureUrl = this.productService.requestFeatureUrl;
    if (requestFeatureUrl) {
      this.fallbackMenuHandlers["workbench.action.openRequestFeatureUrl"] = () => this.openUrl(requestFeatureUrl, "openUserVoiceUrl");
    }
    const reportIssueUrl = this.productService.reportIssueUrl;
    if (reportIssueUrl) {
      this.fallbackMenuHandlers["workbench.action.openIssueReporter"] = () => this.openUrl(reportIssueUrl, "openReportIssues");
    }
    const licenseUrl = this.productService.licenseUrl;
    if (licenseUrl) {
      this.fallbackMenuHandlers["workbench.action.openLicenseUrl"] = () => {
        if (language) {
          const queryArgChar = licenseUrl.indexOf("?") > 0 ? "&" : "?";
          this.openUrl(`${licenseUrl}${queryArgChar}lang=${language}`, "openLicenseUrl");
        } else {
          this.openUrl(licenseUrl, "openLicenseUrl");
        }
      };
    }
    const privacyStatementUrl = this.productService.privacyStatementUrl;
    if (privacyStatementUrl && licenseUrl) {
      this.fallbackMenuHandlers["workbench.action.openPrivacyStatementUrl"] = () => {
        this.openUrl(privacyStatementUrl, "openPrivacyStatement");
      };
    }
  }
  registerListeners() {
    this._register(this.lifecycleMainService.onWillShutdown(() => this.willShutdown = true));
    this._register(this.windowsMainService.onDidChangeWindowsCount((e) => this.onDidChangeWindowsCount(e)));
    this._register(this.nativeHostMainService.onDidBlurMainWindow(() => this.onDidChangeWindowFocus()));
    this._register(this.nativeHostMainService.onDidFocusMainWindow(() => this.onDidChangeWindowFocus()));
    this._register(this.updateService.onStateChange(() => this.scheduleUpdateMenu()));
  }
  get currentEnableMenuBarMnemonics() {
    const enableMenuBarMnemonics = this.configurationService.getValue("window.enableMenuBarMnemonics");
    if (typeof enableMenuBarMnemonics !== "boolean") {
      return true;
    }
    return enableMenuBarMnemonics;
  }
  get currentEnableNativeTabs() {
    if (!isMacintosh) {
      return false;
    }
    const enableNativeTabs = this.configurationService.getValue("window.nativeTabs");
    if (typeof enableNativeTabs !== "boolean") {
      return false;
    }
    return enableNativeTabs;
  }
  updateMenu(menubarData, windowId) {
    this.menubarMenus = menubarData.menus;
    this.keybindings = menubarData.keybindings;
    this.stateService.setItem(Menubar.lastKnownMenubarStorageKey, menubarData);
    this.scheduleUpdateMenu();
  }
  scheduleUpdateMenu() {
    this.menuUpdater.schedule();
  }
  doUpdateMenu() {
    if (!this.willShutdown) {
      setTimeout(
        () => {
          if (!this.willShutdown) {
            this.install();
          }
        },
        10
        /* delay this because there is an issue with updating a menu when it is open */
      );
    }
  }
  onDidChangeWindowsCount(e) {
    if (!isMacintosh) {
      return;
    }
    if (e.oldCount === 0 && e.newCount > 0 || e.oldCount > 0 && e.newCount === 0) {
      this.closedLastWindow = e.newCount === 0;
      this.scheduleUpdateMenu();
    }
  }
  onDidChangeWindowFocus() {
    if (!isMacintosh) {
      return;
    }
    const focusedWindow = BrowserWindow.getFocusedWindow();
    this.noActiveMainWindow = !focusedWindow || !!this.auxiliaryWindowsMainService.getWindowByWebContents(focusedWindow.webContents);
    this.scheduleUpdateMenu();
  }
  install() {
    const oldMenu = Menu.getApplicationMenu();
    if (oldMenu) {
      this.oldMenus.push(oldMenu);
    }
    if (Object.keys(this.menubarMenus).length === 0) {
      this.doSetApplicationMenu(isMacintosh ? new Menu() : null);
      return;
    }
    const menubar = new Menu();
    let macApplicationMenuItem;
    if (isMacintosh) {
      const applicationMenu = new Menu();
      macApplicationMenuItem = new MenuItem({ label: this.productService.nameShort, submenu: applicationMenu });
      this.setMacApplicationMenu(applicationMenu);
      menubar.append(macApplicationMenuItem);
    }
    if (isMacintosh && !this.appMenuInstalled) {
      this.appMenuInstalled = true;
      const dockMenu = new Menu();
      dockMenu.append(new MenuItem({ label: this.mnemonicLabel(nls.localize({ key: "miNewWindow", comment: ["&& denotes a mnemonic"] }, "New &&Window")), click: () => this.windowsMainService.openEmptyWindow({ context: OpenContext.DOCK }) }));
      app.dock.setMenu(dockMenu);
    }
    if (this.shouldDrawMenu("File")) {
      const fileMenu = new Menu();
      const fileMenuItem = new MenuItem({ label: this.mnemonicLabel(nls.localize({ key: "mFile", comment: ["&& denotes a mnemonic"] }, "&&File")), submenu: fileMenu });
      this.setMenuById(fileMenu, "File");
      menubar.append(fileMenuItem);
    }
    if (this.shouldDrawMenu("Edit")) {
      const editMenu = new Menu();
      const editMenuItem = new MenuItem({ label: this.mnemonicLabel(nls.localize({ key: "mEdit", comment: ["&& denotes a mnemonic"] }, "&&Edit")), submenu: editMenu });
      this.setMenuById(editMenu, "Edit");
      menubar.append(editMenuItem);
    }
    if (this.shouldDrawMenu("Selection")) {
      const selectionMenu = new Menu();
      const selectionMenuItem = new MenuItem({ label: this.mnemonicLabel(nls.localize({ key: "mSelection", comment: ["&& denotes a mnemonic"] }, "&&Selection")), submenu: selectionMenu });
      this.setMenuById(selectionMenu, "Selection");
      menubar.append(selectionMenuItem);
    }
    if (this.shouldDrawMenu("View")) {
      const viewMenu = new Menu();
      const viewMenuItem = new MenuItem({ label: this.mnemonicLabel(nls.localize({ key: "mView", comment: ["&& denotes a mnemonic"] }, "&&View")), submenu: viewMenu });
      this.setMenuById(viewMenu, "View");
      menubar.append(viewMenuItem);
    }
    if (this.shouldDrawMenu("Go")) {
      const gotoMenu = new Menu();
      const gotoMenuItem = new MenuItem({ label: this.mnemonicLabel(nls.localize({ key: "mGoto", comment: ["&& denotes a mnemonic"] }, "&&Go")), submenu: gotoMenu });
      this.setMenuById(gotoMenu, "Go");
      menubar.append(gotoMenuItem);
    }
    if (this.shouldDrawMenu("Run")) {
      const debugMenu = new Menu();
      const debugMenuItem = new MenuItem({ label: this.mnemonicLabel(nls.localize({ key: "mRun", comment: ["&& denotes a mnemonic"] }, "&&Run")), submenu: debugMenu });
      this.setMenuById(debugMenu, "Run");
      menubar.append(debugMenuItem);
    }
    if (this.shouldDrawMenu("Terminal")) {
      const terminalMenu = new Menu();
      const terminalMenuItem = new MenuItem({ label: this.mnemonicLabel(nls.localize({ key: "mTerminal", comment: ["&& denotes a mnemonic"] }, "&&Terminal")), submenu: terminalMenu });
      this.setMenuById(terminalMenu, "Terminal");
      menubar.append(terminalMenuItem);
    }
    let macWindowMenuItem;
    if (this.shouldDrawMenu("Window")) {
      const windowMenu = new Menu();
      macWindowMenuItem = new MenuItem({ label: this.mnemonicLabel(nls.localize("mWindow", "Window")), submenu: windowMenu, role: "window" });
      this.setMacWindowMenu(windowMenu);
    }
    if (macWindowMenuItem) {
      menubar.append(macWindowMenuItem);
    }
    if (this.shouldDrawMenu("Help")) {
      const helpMenu = new Menu();
      const helpMenuItem = new MenuItem({ label: this.mnemonicLabel(nls.localize({ key: "mHelp", comment: ["&& denotes a mnemonic"] }, "&&Help")), submenu: helpMenu, role: "help" });
      this.setMenuById(helpMenu, "Help");
      menubar.append(helpMenuItem);
    }
    if (menubar.items && menubar.items.length > 0) {
      this.doSetApplicationMenu(menubar);
    } else {
      this.doSetApplicationMenu(null);
    }
    this.menuGC.schedule();
  }
  doSetApplicationMenu(menu) {
    Menu.setApplicationMenu(menu);
    if (menu) {
      for (const window of this.auxiliaryWindowsMainService.getWindows()) {
        window.win?.setMenu(null);
      }
    }
  }
  setMacApplicationMenu(macApplicationMenu) {
    const about = this.createMenuItem(nls.localize("mAbout", "About {0}", this.productService.nameLong), "workbench.action.showAboutDialog");
    const checkForUpdates = this.getUpdateMenuItems();
    let preferences;
    if (this.shouldDrawMenu("Preferences")) {
      const preferencesMenu = new Menu();
      this.setMenuById(preferencesMenu, "Preferences");
      preferences = new MenuItem({ label: this.mnemonicLabel(nls.localize({ key: "miPreferences", comment: ["&& denotes a mnemonic"] }, "&&Preferences")), submenu: preferencesMenu });
    }
    const servicesMenu = new Menu();
    const services = new MenuItem({ label: nls.localize("mServices", "Services"), role: "services", submenu: servicesMenu });
    const hide = new MenuItem({ label: nls.localize("mHide", "Hide {0}", this.productService.nameLong), role: "hide", accelerator: "Command+H" });
    const hideOthers = new MenuItem({ label: nls.localize("mHideOthers", "Hide Others"), role: "hideOthers", accelerator: "Command+Alt+H" });
    const showAll = new MenuItem({ label: nls.localize("mShowAll", "Show All"), role: "unhide" });
    const quit = new MenuItem(this.likeAction("workbench.action.quit", {
      label: nls.localize("miQuit", "Quit {0}", this.productService.nameLong),
      click: async (item, window, event) => {
        const lastActiveWindow = this.windowsMainService.getLastActiveWindow();
        if (this.windowsMainService.getWindowCount() === 0 || // allow to quit when no more windows are open
        !!BrowserWindow.getFocusedWindow() || // allow to quit when window has focus (fix for https://github.com/microsoft/vscode/issues/39191)
        lastActiveWindow?.win?.isMinimized()) {
          const confirmed = await this.confirmBeforeQuit(event);
          if (confirmed) {
            this.nativeHostMainService.quit(void 0);
          }
        }
      }
    }));
    const actions = [about];
    actions.push(...checkForUpdates);
    if (preferences) {
      actions.push(...[
        __separator__(),
        preferences
      ]);
    }
    actions.push(...[
      __separator__(),
      services,
      __separator__(),
      hide,
      hideOthers,
      showAll,
      __separator__(),
      quit
    ]);
    actions.forEach((i) => macApplicationMenu.append(i));
  }
  async confirmBeforeQuit(event) {
    if (this.windowsMainService.getWindowCount() === 0) {
      return true;
    }
    const confirmBeforeClose = this.configurationService.getValue("window.confirmBeforeClose");
    if (confirmBeforeClose === "always" || confirmBeforeClose === "keyboardOnly" && this.isKeyboardEvent(event)) {
      const { response } = await this.nativeHostMainService.showMessageBox(this.windowsMainService.getFocusedWindow()?.id, {
        type: "question",
        buttons: [
          isMacintosh ? nls.localize({ key: "quit", comment: ["&& denotes a mnemonic"] }, "&&Quit") : nls.localize({ key: "exit", comment: ["&& denotes a mnemonic"] }, "&&Exit"),
          nls.localize("cancel", "Cancel")
        ],
        message: isMacintosh ? nls.localize("quitMessageMac", "Are you sure you want to quit?") : nls.localize("quitMessage", "Are you sure you want to exit?")
      });
      return response === 0;
    }
    return true;
  }
  shouldDrawMenu(menuId) {
    if (!isMacintosh && !this.showNativeMenu) {
      return false;
    }
    switch (menuId) {
      case "File":
      case "Help":
        if (isMacintosh) {
          return this.windowsMainService.getWindowCount() === 0 && this.closedLastWindow || this.windowsMainService.getWindowCount() > 0 && this.noActiveMainWindow || !!this.menubarMenus && !!this.menubarMenus[menuId];
        }
      case "Window":
        if (isMacintosh) {
          return this.windowsMainService.getWindowCount() === 0 && this.closedLastWindow || this.windowsMainService.getWindowCount() > 0 && this.noActiveMainWindow || !!this.menubarMenus;
        }
      default:
        return this.windowsMainService.getWindowCount() > 0 && (!!this.menubarMenus && !!this.menubarMenus[menuId]);
    }
  }
  setMenu(menu, items) {
    items.forEach((item) => {
      if (isMenubarMenuItemSeparator(item)) {
        menu.append(__separator__());
      } else if (isMenubarMenuItemSubmenu(item)) {
        const submenu = new Menu();
        const submenuItem = new MenuItem({ label: this.mnemonicLabel(item.label), submenu });
        this.setMenu(submenu, item.submenu.items);
        menu.append(submenuItem);
      } else if (isMenubarMenuItemRecentAction(item)) {
        menu.append(this.createOpenRecentMenuItem(item));
      } else if (isMenubarMenuItemAction(item)) {
        if (item.id === "workbench.action.showAboutDialog") {
          this.insertCheckForUpdatesItems(menu);
        }
        if (isMacintosh) {
          if (this.windowsMainService.getWindowCount() === 0 && this.closedLastWindow || this.windowsMainService.getWindowCount() > 0 && this.noActiveMainWindow) {
            if (this.fallbackMenuHandlers[item.id]) {
              menu.append(new MenuItem(this.likeAction(item.id, { label: this.mnemonicLabel(item.label), click: this.fallbackMenuHandlers[item.id] })));
            } else {
              menu.append(this.createMenuItem(item.label, item.id, false, item.checked));
            }
          } else {
            menu.append(this.createMenuItem(item.label, item.id, item.enabled !== false, !!item.checked));
          }
        } else {
          menu.append(this.createMenuItem(item.label, item.id, item.enabled !== false, !!item.checked));
        }
      }
    });
  }
  setMenuById(menu, menuId) {
    if (this.menubarMenus?.[menuId]) {
      this.setMenu(menu, this.menubarMenus[menuId].items);
    }
  }
  insertCheckForUpdatesItems(menu) {
    const updateItems = this.getUpdateMenuItems();
    if (updateItems.length) {
      updateItems.forEach((i) => menu.append(i));
      menu.append(__separator__());
    }
  }
  createOpenRecentMenuItem(item) {
    const revivedUri = URI.revive(item.uri);
    const commandId = item.id;
    const openable = commandId === "openRecentFile" ? { fileUri: revivedUri } : commandId === "openRecentWorkspace" ? { workspaceUri: revivedUri } : { folderUri: revivedUri };
    return new MenuItem(this.likeAction(commandId, {
      label: item.label,
      click: async (menuItem, win, event) => {
        const openInNewWindow = this.isOptionClick(event);
        const success = (await this.windowsMainService.open({
          context: OpenContext.MENU,
          cli: this.environmentMainService.args,
          urisToOpen: [openable],
          forceNewWindow: openInNewWindow,
          gotoLineMode: false,
          remoteAuthority: item.remoteAuthority
        })).length > 0;
        if (!success) {
          await this.workspacesHistoryMainService.removeRecentlyOpened([revivedUri]);
        }
      }
    }, false));
  }
  isOptionClick(event) {
    return !!(event && (!isMacintosh && (event.ctrlKey || event.shiftKey) || isMacintosh && (event.metaKey || event.altKey)));
  }
  isKeyboardEvent(event) {
    return !!(event.triggeredByAccelerator || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey);
  }
  createRoleMenuItem(label, commandId, role) {
    const options = {
      label: this.mnemonicLabel(label),
      role,
      enabled: true
    };
    return new MenuItem(this.withKeybinding(commandId, options));
  }
  setMacWindowMenu(macWindowMenu) {
    const minimize = new MenuItem({ label: nls.localize("mMinimize", "Minimize"), role: "minimize", accelerator: "Command+M", enabled: this.windowsMainService.getWindowCount() > 0 });
    const zoom = new MenuItem({ label: nls.localize("mZoom", "Zoom"), role: "zoom", enabled: this.windowsMainService.getWindowCount() > 0 });
    const bringAllToFront = new MenuItem({ label: nls.localize("mBringToFront", "Bring All to Front"), role: "front", enabled: this.windowsMainService.getWindowCount() > 0 });
    const switchWindow = this.createMenuItem(nls.localize({ key: "miSwitchWindow", comment: ["&& denotes a mnemonic"] }, "Switch &&Window..."), "workbench.action.switchWindow");
    const nativeTabMenuItems = [];
    if (this.currentEnableNativeTabs) {
      nativeTabMenuItems.push(__separator__());
      nativeTabMenuItems.push(this.createMenuItem(nls.localize("mNewTab", "New Tab"), "workbench.action.newWindowTab"));
      nativeTabMenuItems.push(this.createRoleMenuItem(nls.localize("mShowPreviousTab", "Show Previous Tab"), "workbench.action.showPreviousWindowTab", "selectPreviousTab"));
      nativeTabMenuItems.push(this.createRoleMenuItem(nls.localize("mShowNextTab", "Show Next Tab"), "workbench.action.showNextWindowTab", "selectNextTab"));
      nativeTabMenuItems.push(this.createRoleMenuItem(nls.localize("mMoveTabToNewWindow", "Move Tab to New Window"), "workbench.action.moveWindowTabToNewWindow", "moveTabToNewWindow"));
      nativeTabMenuItems.push(this.createRoleMenuItem(nls.localize("mMergeAllWindows", "Merge All Windows"), "workbench.action.mergeAllWindowTabs", "mergeAllWindows"));
    }
    [
      minimize,
      zoom,
      __separator__(),
      switchWindow,
      ...nativeTabMenuItems,
      __separator__(),
      bringAllToFront
    ].forEach((item) => macWindowMenu.append(item));
  }
  getUpdateMenuItems() {
    const state = this.updateService.state;
    switch (state.type) {
      case StateType.Idle:
        return [new MenuItem({
          label: this.mnemonicLabel(nls.localize("miCheckForUpdates", "Check for &&Updates...")),
          click: () => setTimeout(() => {
            this.reportMenuActionTelemetry("CheckForUpdate");
            this.updateService.checkForUpdates(true);
          }, 0)
        })];
      case StateType.CheckingForUpdates:
        return [new MenuItem({ label: nls.localize("miCheckingForUpdates", "Checking for Updates..."), enabled: false })];
      case StateType.AvailableForDownload:
        return [new MenuItem({
          label: this.mnemonicLabel(nls.localize("miDownloadUpdate", "D&&ownload Available Update")),
          click: () => {
            this.updateService.downloadUpdate(true);
          }
        })];
      case StateType.Downloading:
      case StateType.Overwriting:
        return [new MenuItem({ label: nls.localize("miDownloadingUpdate", "Downloading Update..."), enabled: false })];
      case StateType.Downloaded:
        return isMacintosh ? [] : [new MenuItem({
          label: this.mnemonicLabel(nls.localize("miInstallUpdate", "Install &&Update...")),
          click: () => {
            this.reportMenuActionTelemetry("InstallUpdate");
            this.updateService.applyUpdate();
          }
        })];
      case StateType.Updating:
        return [new MenuItem({ label: nls.localize("miInstallingUpdate", "Installing Update..."), enabled: false })];
      case StateType.Cancelling:
        return [new MenuItem({ label: nls.localize("miCancellingUpdate", "Cancelling Update..."), enabled: false })];
      case StateType.Ready:
        return [new MenuItem({
          label: this.mnemonicLabel(nls.localize("miRestartToUpdate", "Restart to &&Update")),
          click: () => {
            this.reportMenuActionTelemetry("RestartToUpdate");
            this.updateService.quitAndInstall();
          }
        })];
      default:
        return [];
    }
  }
  createMenuItem(labelOpt, commandId, enabledOpt, checkedOpt) {
    const label = this.mnemonicLabel(labelOpt);
    const click = (menuItem, window, event) => {
      const userSettingsLabel = menuItem ? menuItem.userSettingsLabel : null;
      if (userSettingsLabel && event.triggeredByAccelerator) {
        this.runActionInRenderer({ type: "keybinding", userSettingsLabel });
      } else {
        this.runActionInRenderer({ type: "commandId", commandId });
      }
    };
    const enabled = typeof enabledOpt === "boolean" ? enabledOpt : this.windowsMainService.getWindowCount() > 0;
    const checked = typeof checkedOpt === "boolean" ? checkedOpt : false;
    const options = {
      label,
      click,
      enabled
    };
    if (checked) {
      options.type = "checkbox";
      options.checked = checked;
    }
    if (isMacintosh) {
      if (commandId === "editor.action.clipboardCutAction") {
        options.role = "cut";
      } else if (commandId === "editor.action.clipboardCopyAction") {
        options.role = "copy";
      } else if (commandId === "editor.action.clipboardPasteAction") {
        options.role = "paste";
      }
      if (commandId === "undo") {
        options.click = this.makeContextAwareClickHandler(click, {
          inDevTools: (devTools) => devTools.undo(),
          inNoWindow: () => Menu.sendActionToFirstResponder("undo:")
        });
      } else if (commandId === "redo") {
        options.click = this.makeContextAwareClickHandler(click, {
          inDevTools: (devTools) => devTools.redo(),
          inNoWindow: () => Menu.sendActionToFirstResponder("redo:")
        });
      } else if (commandId === "editor.action.selectAll") {
        options.click = this.makeContextAwareClickHandler(click, {
          inDevTools: (devTools) => devTools.selectAll(),
          inNoWindow: () => Menu.sendActionToFirstResponder("selectAll:")
        });
      }
    }
    return new MenuItem(this.withKeybinding(commandId, options));
  }
  makeContextAwareClickHandler(click, contextSpecificHandlers) {
    return (menuItem, win, event) => {
      const activeWindow = BrowserWindow.getFocusedWindow();
      if (!activeWindow) {
        return contextSpecificHandlers.inNoWindow();
      }
      if (activeWindow.webContents.isDevToolsFocused() && activeWindow.webContents.devToolsWebContents) {
        return contextSpecificHandlers.inDevTools(activeWindow.webContents.devToolsWebContents);
      }
      if (!activeWindow.webContents.isFocused()) {
        return contextSpecificHandlers.inNoWindow();
      }
      click(menuItem, win || activeWindow, event);
    };
  }
  runActionInRenderer(invocation) {
    let activeBrowserWindow = BrowserWindow.getFocusedWindow();
    if (activeBrowserWindow) {
      const auxiliaryWindowCandidate = this.auxiliaryWindowsMainService.getWindowByWebContents(activeBrowserWindow.webContents);
      if (auxiliaryWindowCandidate) {
        activeBrowserWindow = this.windowsMainService.getWindowById(auxiliaryWindowCandidate.parentId)?.win ?? null;
      }
    }
    if (!activeBrowserWindow) {
      const lastActiveWindow = this.windowsMainService.getLastActiveWindow();
      if (lastActiveWindow?.win?.isMinimized()) {
        activeBrowserWindow = lastActiveWindow.win;
      }
    }
    const activeWindow = activeBrowserWindow ? this.windowsMainService.getWindowById(activeBrowserWindow.id) : void 0;
    if (activeWindow) {
      this.logService.trace("menubar#runActionInRenderer", invocation);
      if (isMacintosh && !this.environmentMainService.isBuilt && !activeWindow.isReady) {
        if (invocation.type === "commandId" && invocation.commandId === "workbench.action.toggleDevTools" || invocation.type !== "commandId" && invocation.userSettingsLabel === "alt+cmd+i") {
          return false;
        }
      }
      if (invocation.type === "commandId") {
        const runActionPayload = { id: invocation.commandId, from: "menu" };
        activeWindow.sendWhenReady("vscode:runAction", CancellationToken.None, runActionPayload);
      } else {
        const runKeybindingPayload = { userSettingsLabel: invocation.userSettingsLabel };
        activeWindow.sendWhenReady("vscode:runKeybinding", CancellationToken.None, runKeybindingPayload);
      }
      return true;
    } else {
      this.logService.trace("menubar#runActionInRenderer: no active window found", invocation);
      return false;
    }
  }
  withKeybinding(commandId, options) {
    const binding = typeof commandId === "string" ? this.keybindings[commandId] : void 0;
    if (binding?.label) {
      if (binding.isNative !== false) {
        options.accelerator = binding.label;
        options.userSettingsLabel = binding.userSettingsLabel;
      } else if (typeof options.label === "string") {
        const bindingIndex = options.label.indexOf("[");
        if (bindingIndex >= 0) {
          options.label = `${options.label.substr(0, bindingIndex)} [${binding.label}]`;
        } else {
          options.label = `${options.label} [${binding.label}]`;
        }
      }
    } else {
      options.accelerator = void 0;
    }
    return options;
  }
  likeAction(commandId, options, setAccelerator = !options.accelerator) {
    if (setAccelerator) {
      options = this.withKeybinding(commandId, options);
    }
    const originalClick = options.click;
    options.click = (item, window, event) => {
      this.reportMenuActionTelemetry(commandId);
      originalClick?.(item, window, event);
    };
    return options;
  }
  openUrl(url, id) {
    this.nativeHostMainService.openExternal(void 0, url);
    this.reportMenuActionTelemetry(id);
  }
  reportMenuActionTelemetry(id) {
    this.telemetryService.publicLog2("workbenchActionExecuted", { id, from: telemetryFrom });
  }
  mnemonicLabel(label) {
    return mnemonicMenuLabel(label, !this.currentEnableMenuBarMnemonics);
  }
};
Menubar = __decorateClass([
  __decorateParam(0, IUpdateService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IWindowsMainService),
  __decorateParam(3, IEnvironmentMainService),
  __decorateParam(4, ITelemetryService),
  __decorateParam(5, IWorkspacesHistoryMainService),
  __decorateParam(6, IStateService),
  __decorateParam(7, ILifecycleMainService),
  __decorateParam(8, ILogService),
  __decorateParam(9, INativeHostMainService),
  __decorateParam(10, IProductService),
  __decorateParam(11, IAuxiliaryWindowsMainService)
], Menubar);
function __separator__() {
  return new MenuItem({ type: "separator" });
}
export {
  Menubar
};
