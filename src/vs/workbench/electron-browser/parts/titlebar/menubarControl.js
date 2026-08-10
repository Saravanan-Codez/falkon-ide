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
import { Separator } from "../../../../base/common/actions.js";
import { IMenuService, SubmenuItemAction, MenuItemAction } from "../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IWorkspacesService } from "../../../../platform/workspaces/common/workspaces.js";
import { isMacintosh } from "../../../../base/common/platform.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { INativeWorkbenchEnvironmentService } from "../../../services/environment/electron-browser/environmentService.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { IUpdateService } from "../../../../platform/update/common/update.js";
import { MenubarControl } from "../../../browser/parts/titlebar/menubarControl.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { IMenubarService } from "../../../../platform/menubar/electron-browser/menubar.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { IPreferencesService } from "../../../services/preferences/common/preferences.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { OpenRecentAction } from "../../../browser/actions/windowActions.js";
import { isICommandActionToggleInfo } from "../../../../platform/action/common/action.js";
import { getFlatContextMenuActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
let NativeMenubarControl = class extends MenubarControl {
  constructor(menuService, workspacesService, contextKeyService, keybindingService, configurationService, labelService, updateService, storageService, notificationService, preferencesService, environmentService, accessibilityService, menubarService, hostService, nativeHostService, commandService) {
    super(menuService, workspacesService, contextKeyService, keybindingService, configurationService, labelService, updateService, storageService, notificationService, preferencesService, environmentService, accessibilityService, hostService, commandService);
    this.menubarService = menubarService;
    this.nativeHostService = nativeHostService;
    (async () => {
      this.recentlyOpened = await this.workspacesService.getRecentlyOpened();
      this.doUpdateMenubar();
    })();
    this.registerListeners();
  }
  setupMainMenu() {
    super.setupMainMenu();
    for (const topLevelMenuName of Object.keys(this.topLevelTitles)) {
      const menu = this.menus[topLevelMenuName];
      if (menu) {
        this.mainMenuDisposables.add(menu.onDidChange(() => this.updateMenubar()));
      }
    }
  }
  doUpdateMenubar() {
    if (!this.hostService.hasFocus) {
      return;
    }
    const menubarData = { menus: {}, keybindings: {} };
    if (this.getMenubarMenus(menubarData)) {
      this.menubarService.updateMenubar(this.nativeHostService.windowId, menubarData);
    }
  }
  getMenubarMenus(menubarData) {
    if (!menubarData) {
      return false;
    }
    menubarData.keybindings = this.getAdditionalKeybindings();
    for (const topLevelMenuName of Object.keys(this.topLevelTitles)) {
      const menu = this.menus[topLevelMenuName];
      if (menu) {
        const menubarMenu = { items: [] };
        const menuActions = getFlatContextMenuActions(menu.getActions({ shouldForwardArgs: true }));
        this.populateMenuItems(menuActions, menubarMenu, menubarData.keybindings);
        if (menubarMenu.items.length === 0) {
          return false;
        }
        menubarData.menus[topLevelMenuName] = menubarMenu;
      }
    }
    return true;
  }
  populateMenuItems(menuActions, menuToPopulate, keybindings) {
    for (const menuItem of menuActions) {
      if (menuItem instanceof Separator) {
        menuToPopulate.items.push({ id: "vscode.menubar.separator" });
      } else if (menuItem instanceof MenuItemAction || menuItem instanceof SubmenuItemAction) {
        const title = typeof menuItem.item.title === "string" ? menuItem.item.title : menuItem.item.title.mnemonicTitle ?? menuItem.item.title.value;
        if (menuItem instanceof SubmenuItemAction) {
          const submenu = { items: [] };
          this.populateMenuItems(menuItem.actions, submenu, keybindings);
          if (submenu.items.length > 0) {
            const menubarSubmenuItem = {
              id: menuItem.id,
              label: title,
              submenu
            };
            menuToPopulate.items.push(menubarSubmenuItem);
          }
        } else {
          if (menuItem.id === OpenRecentAction.ID) {
            const actions = this.getOpenRecentActions().map(this.transformOpenRecentAction);
            menuToPopulate.items.push(...actions);
          }
          const menubarMenuItem = {
            id: menuItem.id,
            label: title
          };
          if (isICommandActionToggleInfo(menuItem.item.toggled)) {
            menubarMenuItem.label = menuItem.item.toggled.mnemonicTitle ?? menuItem.item.toggled.title ?? title;
          }
          if (menuItem.checked) {
            menubarMenuItem.checked = true;
          }
          if (!menuItem.enabled) {
            menubarMenuItem.enabled = false;
          }
          keybindings[menuItem.id] = this.getMenubarKeybinding(menuItem.id);
          menuToPopulate.items.push(menubarMenuItem);
        }
      }
    }
  }
  transformOpenRecentAction(action) {
    if (action instanceof Separator) {
      return { id: "vscode.menubar.separator" };
    }
    return {
      id: action.id,
      uri: action.uri,
      remoteAuthority: action.remoteAuthority,
      enabled: action.enabled,
      label: action.label
    };
  }
  getAdditionalKeybindings() {
    const keybindings = {};
    if (isMacintosh) {
      const keybinding = this.getMenubarKeybinding("workbench.action.quit");
      if (keybinding) {
        keybindings["workbench.action.quit"] = keybinding;
      }
    }
    return keybindings;
  }
  getMenubarKeybinding(id) {
    const binding = this.keybindingService.lookupKeybinding(id);
    if (!binding) {
      return void 0;
    }
    const electronAccelerator = binding.getElectronAccelerator();
    if (electronAccelerator) {
      return { label: electronAccelerator, userSettingsLabel: binding.getUserSettingsLabel() ?? void 0 };
    }
    const acceleratorLabel = binding.getLabel();
    if (acceleratorLabel) {
      return { label: acceleratorLabel, isNative: false, userSettingsLabel: binding.getUserSettingsLabel() ?? void 0 };
    }
    return void 0;
  }
};
NativeMenubarControl = __decorateClass([
  __decorateParam(0, IMenuService),
  __decorateParam(1, IWorkspacesService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, ILabelService),
  __decorateParam(6, IUpdateService),
  __decorateParam(7, IStorageService),
  __decorateParam(8, INotificationService),
  __decorateParam(9, IPreferencesService),
  __decorateParam(10, INativeWorkbenchEnvironmentService),
  __decorateParam(11, IAccessibilityService),
  __decorateParam(12, IMenubarService),
  __decorateParam(13, IHostService),
  __decorateParam(14, INativeHostService),
  __decorateParam(15, ICommandService)
], NativeMenubarControl);
export {
  NativeMenubarControl
};
