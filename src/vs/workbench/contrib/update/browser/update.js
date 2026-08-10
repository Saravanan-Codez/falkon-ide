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
import * as nls from "../../../../nls.js";
import severity from "../../../../base/common/severity.js";
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { IActivityService, NumberBadge, ProgressBadge } from "../../../services/activity/common/activity.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IUpdateService, StateType } from "../../../../platform/update/common/update.js";
import { INotificationService, NotificationPriority, Severity } from "../../../../platform/notification/common/notification.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IBrowserWorkbenchEnvironmentService } from "../../../services/environment/browser/environmentService.js";
import { ReleaseNotesManager } from "./releaseNotesEditor.js";
import { isWeb } from "../../../../base/common/platform.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { RawContextKey, IContextKeyService, ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { MenuRegistry, MenuId, registerAction2, Action2 } from "../../../../platform/actions/common/actions.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IUserDataSyncEnablementService, IUserDataSyncService, IUserDataSyncStoreManagementService, SyncStatus } from "../../../../platform/userDataSync/common/userDataSync.js";
import { IsWebContext } from "../../../../platform/contextkey/common/contextkeys.js";
import { Promises, Throttler } from "../../../../base/common/async.js";
import { IUserDataSyncWorkbenchService } from "../../../services/userDataSync/common/userDataSync.js";
import { Event } from "../../../../base/common/event.js";
import { IDefaultAccountService } from "../../../../platform/defaultAccount/common/defaultAccount.js";
import { getInternalOrg } from "../../../../platform/assignment/common/assignment.js";
import { tryParseVersion } from "../common/updateUtils.js";
const CONTEXT_UPDATE_STATE = new RawContextKey("updateState", StateType.Uninitialized);
const MAJOR_MINOR_UPDATE_AVAILABLE = new RawContextKey("majorMinorUpdateAvailable", false);
let releaseNotesManager = void 0;
function showReleaseNotesInEditor(instantiationService, version, useCurrentFile) {
  if (!releaseNotesManager) {
    releaseNotesManager = instantiationService.createInstance(ReleaseNotesManager);
  }
  return releaseNotesManager.show(version, useCurrentFile);
}
async function openLatestReleaseNotesInBrowser(accessor) {
  const openerService = accessor.get(IOpenerService);
  const productService = accessor.get(IProductService);
  if (productService.releaseNotesUrl) {
    const uri = URI.parse(productService.releaseNotesUrl);
    await openerService.open(uri);
  } else {
    throw new Error(nls.localize("update.noReleaseNotesOnline", "This version of {0} does not have release notes online", productService.nameLong));
  }
}
async function showReleaseNotes(accessor, version) {
  const instantiationService = accessor.get(IInstantiationService);
  try {
    await showReleaseNotesInEditor(instantiationService, version, false);
  } catch (err) {
    try {
      await instantiationService.invokeFunction(openLatestReleaseNotesInBrowser);
    } catch (err2) {
      throw new Error(`${err.message} and ${err2.message}`);
    }
  }
}
function appendUpdateMenuItems(menuId, group) {
  MenuRegistry.appendMenuItem(menuId, {
    group,
    command: {
      id: "update.check",
      title: nls.localize("checkForUpdates", "Check for Updates...")
    },
    when: CONTEXT_UPDATE_STATE.isEqualTo(StateType.Idle)
  });
  MenuRegistry.appendMenuItem(menuId, {
    group,
    command: {
      id: "update.checking",
      title: nls.localize("checkingForUpdates2", "Checking for Updates..."),
      precondition: ContextKeyExpr.false()
    },
    when: CONTEXT_UPDATE_STATE.isEqualTo(StateType.CheckingForUpdates)
  });
  MenuRegistry.appendMenuItem(menuId, {
    group,
    command: {
      id: "update.downloadNow",
      title: nls.localize("download update_1", "Download Update (1)")
    },
    when: CONTEXT_UPDATE_STATE.isEqualTo(StateType.AvailableForDownload)
  });
  MenuRegistry.appendMenuItem(menuId, {
    group,
    command: {
      id: "update.downloading",
      title: nls.localize("DownloadingUpdate", "Downloading Update..."),
      precondition: ContextKeyExpr.false()
    },
    when: CONTEXT_UPDATE_STATE.isEqualTo(StateType.Downloading)
  });
  MenuRegistry.appendMenuItem(menuId, {
    group,
    command: {
      id: "update.install",
      title: nls.localize("installUpdate...", "Install Update... (1)")
    },
    when: CONTEXT_UPDATE_STATE.isEqualTo(StateType.Downloaded)
  });
  MenuRegistry.appendMenuItem(menuId, {
    group,
    command: {
      id: "update.updating",
      title: nls.localize("installingUpdate", "Installing Update..."),
      precondition: ContextKeyExpr.false()
    },
    when: CONTEXT_UPDATE_STATE.isEqualTo(StateType.Updating)
  });
  MenuRegistry.appendMenuItem(menuId, {
    group,
    command: {
      id: "update.cancelling",
      title: nls.localize("cancellingUpdateMenuEntry", "Cancelling Update..."),
      precondition: ContextKeyExpr.false()
    },
    when: CONTEXT_UPDATE_STATE.isEqualTo(StateType.Cancelling)
  });
  MenuRegistry.appendMenuItem(menuId, {
    group,
    order: 2,
    command: {
      id: "update.restart",
      title: nls.localize("restartToUpdate", "Restart to Update (1)")
    },
    when: CONTEXT_UPDATE_STATE.isEqualTo(StateType.Ready)
  });
}
function isMajorMinorUpdate(before, after) {
  return before.major < after.major || before.minor < after.minor;
}
let ProductContribution = class {
  static {
    this.KEY = "releaseNotes/lastVersion";
  }
  constructor(storageService, instantiationService, notificationService, environmentService, openerService, configurationService, hostService, productService) {
    if (isWeb) {
      return;
    }
    hostService.hadLastFocus().then(async (hadLastFocus) => {
      if (!hadLastFocus) {
        return;
      }
      const lastVersion = tryParseVersion(storageService.get(ProductContribution.KEY, StorageScope.APPLICATION, ""));
      const currentVersion = tryParseVersion(productService.version);
      const shouldShowReleaseNotes = configurationService.getValue("update.showReleaseNotes");
      const shouldShowPostInstallInfo = configurationService.getValue("update.showPostInstallInfo");
      const releaseNotesUrl = productService.releaseNotesUrl;
      if (shouldShowReleaseNotes && !shouldShowPostInstallInfo && !environmentService.skipReleaseNotes && releaseNotesUrl && lastVersion && currentVersion && isMajorMinorUpdate(lastVersion, currentVersion)) {
        showReleaseNotesInEditor(instantiationService, productService.version, false).then(void 0, () => {
          notificationService.prompt(
            severity.Info,
            nls.localize("read the release notes", "Welcome to {0} v{1}! Would you like to read the Release Notes?", productService.nameLong, productService.version),
            [{
              label: nls.localize("releaseNotes", "Release Notes"),
              run: () => {
                const uri = URI.parse(releaseNotesUrl);
                openerService.open(uri);
              }
            }],
            { priority: NotificationPriority.OPTIONAL }
          );
        });
      }
      storageService.store(ProductContribution.KEY, productService.version, StorageScope.APPLICATION, StorageTarget.MACHINE);
    });
  }
};
ProductContribution = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, INotificationService),
  __decorateParam(3, IBrowserWorkbenchEnvironmentService),
  __decorateParam(4, IOpenerService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IHostService),
  __decorateParam(7, IProductService)
], ProductContribution);
let UpdateContribution = class extends Disposable {
  constructor(storageService, instantiationService, dialogService, updateService, activityService, contextKeyService, productService, hostService) {
    super();
    this.instantiationService = instantiationService;
    this.dialogService = dialogService;
    this.updateService = updateService;
    this.activityService = activityService;
    this.productService = productService;
    this.hostService = hostService;
    this.badgeDisposable = this._register(new MutableDisposable());
    this.state = updateService.state;
    this.updateStateContextKey = CONTEXT_UPDATE_STATE.bindTo(contextKeyService);
    this.majorMinorUpdateAvailableContextKey = MAJOR_MINOR_UPDATE_AVAILABLE.bindTo(contextKeyService);
    this._register(updateService.onStateChange(this.onUpdateStateChange, this));
    this.onUpdateStateChange(this.updateService.state);
    const currentVersion = this.productService.commit;
    const lastKnownVersion = storageService.get("update/lastKnownVersion", StorageScope.APPLICATION);
    if (currentVersion !== lastKnownVersion) {
      storageService.remove("update/lastKnownVersion", StorageScope.APPLICATION);
      storageService.remove("update/updateNotificationTime", StorageScope.APPLICATION);
    }
    this.registerGlobalActivityActions();
  }
  async onUpdateStateChange(state) {
    this.updateStateContextKey.set(state.type);
    switch (state.type) {
      case StateType.Idle:
        if (state.notAvailable && !state.error && await this.hostService.hadLastFocus()) {
          this.dialogService.info(nls.localize("noUpdatesAvailable", "There are currently no updates available."));
        }
        break;
      case StateType.Ready: {
        const productVersion = state.update.productVersion;
        if (productVersion) {
          const currentVersion = tryParseVersion(this.productService.version);
          const nextVersion = tryParseVersion(productVersion);
          this.majorMinorUpdateAvailableContextKey.set(Boolean(currentVersion && nextVersion && isMajorMinorUpdate(currentVersion, nextVersion)));
        }
        break;
      }
    }
    let badge = void 0;
    if (state.type === StateType.AvailableForDownload || state.type === StateType.Downloaded || state.type === StateType.Ready) {
      badge = new NumberBadge(1, () => nls.localize("updateIsReady", "New {0} update available.", this.productService.nameShort));
    } else if (state.type === StateType.CheckingForUpdates) {
      badge = new ProgressBadge(() => nls.localize("checkingForUpdates", "Checking for {0} updates...", this.productService.nameShort));
    } else if (state.type === StateType.Downloading || state.type === StateType.Overwriting) {
      badge = new ProgressBadge(() => nls.localize("downloading", "Downloading {0} update...", this.productService.nameShort));
    } else if (state.type === StateType.Updating) {
      badge = new ProgressBadge(() => nls.localize("updating", "Updating {0}...", this.productService.nameShort));
    } else if (state.type === StateType.Cancelling) {
      badge = new ProgressBadge(() => nls.localize("cancellingUpdate", "Cancelling {0} update...", this.productService.nameShort));
    }
    this.badgeDisposable.clear();
    if (badge) {
      this.badgeDisposable.value = this.activityService.showGlobalActivity({ badge });
    }
    this.state = state;
  }
  registerGlobalActivityActions() {
    CommandsRegistry.registerCommand("update.check", () => this.updateService.checkForUpdates(true));
    CommandsRegistry.registerCommand("update.checking", () => {
    });
    CommandsRegistry.registerCommand("update.downloadNow", () => this.updateService.downloadUpdate(true));
    CommandsRegistry.registerCommand("update.downloading", () => {
    });
    CommandsRegistry.registerCommand("update.install", () => this.updateService.applyUpdate());
    CommandsRegistry.registerCommand("update.updating", () => {
    });
    CommandsRegistry.registerCommand("update.cancelling", () => {
    });
    CommandsRegistry.registerCommand("update.restart", () => this.updateService.quitAndInstall());
    CommandsRegistry.registerCommand("_update.state", () => {
      return this.state;
    });
    appendUpdateMenuItems(MenuId.GlobalActivity, "7_update");
    if (this.productService.quality === "stable") {
      CommandsRegistry.registerCommand("update.showUpdateReleaseNotes", () => {
        if (this.updateService.state.type !== StateType.Ready) {
          return;
        }
        const productVersion = this.updateService.state.update.productVersion;
        if (productVersion) {
          this.instantiationService.invokeFunction((accessor) => showReleaseNotes(accessor, productVersion));
        }
      });
      MenuRegistry.appendMenuItem(MenuId.GlobalActivity, {
        group: "7_update",
        order: 1,
        command: {
          id: "update.showUpdateReleaseNotes",
          title: nls.localize("showUpdateReleaseNotes", "Show Update Release Notes")
        },
        when: ContextKeyExpr.and(CONTEXT_UPDATE_STATE.isEqualTo(StateType.Ready), MAJOR_MINOR_UPDATE_AVAILABLE)
      });
    }
  }
};
UpdateContribution = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IDialogService),
  __decorateParam(3, IUpdateService),
  __decorateParam(4, IActivityService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IProductService),
  __decorateParam(7, IHostService)
], UpdateContribution);
let SwitchProductQualityContribution = class extends Disposable {
  constructor(productService, environmentService) {
    super();
    this.productService = productService;
    this.environmentService = environmentService;
    this.registerGlobalActivityActions();
  }
  registerGlobalActivityActions() {
    const quality = this.productService.quality;
    const productQualityChangeHandler = this.environmentService.options?.productQualityChangeHandler;
    if (productQualityChangeHandler && (quality === "stable" || quality === "insider")) {
      const newQuality = quality === "stable" ? "insider" : "stable";
      const commandId = `update.switchQuality.${newQuality}`;
      const isSwitchingToInsiders = newQuality === "insider";
      this._register(registerAction2(class SwitchQuality extends Action2 {
        constructor() {
          super({
            id: commandId,
            title: isSwitchingToInsiders ? nls.localize("switchToInsiders", "Switch to Insiders Version...") : nls.localize("switchToStable", "Switch to Stable Version..."),
            precondition: IsWebContext,
            menu: {
              id: MenuId.GlobalActivity,
              when: IsWebContext,
              group: "7_update"
            }
          });
        }
        async run(accessor) {
          const dialogService = accessor.get(IDialogService);
          const userDataSyncEnablementService = accessor.get(IUserDataSyncEnablementService);
          const userDataSyncStoreManagementService = accessor.get(IUserDataSyncStoreManagementService);
          const storageService = accessor.get(IStorageService);
          const userDataSyncWorkbenchService = accessor.get(IUserDataSyncWorkbenchService);
          const userDataSyncService = accessor.get(IUserDataSyncService);
          const notificationService = accessor.get(INotificationService);
          try {
            const selectSettingsSyncServiceDialogShownKey = "switchQuality.selectSettingsSyncServiceDialogShown";
            const userDataSyncStore = userDataSyncStoreManagementService.userDataSyncStore;
            let userDataSyncStoreType;
            if (userDataSyncStore && isSwitchingToInsiders && userDataSyncEnablementService.isEnabled() && !storageService.getBoolean(selectSettingsSyncServiceDialogShownKey, StorageScope.APPLICATION, false)) {
              userDataSyncStoreType = await this.selectSettingsSyncService(dialogService);
              if (!userDataSyncStoreType) {
                return;
              }
              storageService.store(selectSettingsSyncServiceDialogShownKey, true, StorageScope.APPLICATION, StorageTarget.USER);
              if (userDataSyncStoreType === "stable") {
                await userDataSyncStoreManagementService.switch(userDataSyncStoreType);
              }
            }
            const res = await dialogService.confirm({
              type: "info",
              message: nls.localize("relaunchMessage", "Changing the version requires a reload to take effect"),
              detail: newQuality === "insider" ? nls.localize("relaunchDetailInsiders", "Press the reload button to switch to the Insiders version of VS Code.") : nls.localize("relaunchDetailStable", "Press the reload button to switch to the Stable version of VS Code."),
              primaryButton: nls.localize({ key: "reload", comment: ["&& denotes a mnemonic"] }, "&&Reload")
            });
            if (res.confirmed) {
              const promises = [];
              if (userDataSyncService.status === SyncStatus.Syncing) {
                promises.push(Event.toPromise(Event.filter(userDataSyncService.onDidChangeStatus, (status) => status !== SyncStatus.Syncing)));
              }
              if (isSwitchingToInsiders && userDataSyncStoreType) {
                promises.push(userDataSyncWorkbenchService.synchroniseUserDataSyncStoreType());
              }
              await Promises.settled(promises);
              productQualityChangeHandler(newQuality);
            } else {
              if (userDataSyncStoreType) {
                storageService.remove(selectSettingsSyncServiceDialogShownKey, StorageScope.APPLICATION);
              }
            }
          } catch (error) {
            notificationService.error(error);
          }
        }
        async selectSettingsSyncService(dialogService) {
          const { result } = await dialogService.prompt({
            type: Severity.Info,
            message: nls.localize("selectSyncService.message", "Choose the settings sync service to use after changing the version"),
            detail: nls.localize("selectSyncService.detail", "The Insiders version of VS Code will synchronize your settings, keybindings, extensions, snippets and UI State using separate insiders settings sync service by default."),
            buttons: [
              {
                label: nls.localize({ key: "use insiders", comment: ["&& denotes a mnemonic"] }, "&&Insiders"),
                run: () => "insiders"
              },
              {
                label: nls.localize({ key: "use stable", comment: ["&& denotes a mnemonic"] }, "&&Stable (current)"),
                run: () => "stable"
              }
            ],
            cancelButton: true
          });
          return result;
        }
      }));
    }
  }
};
SwitchProductQualityContribution = __decorateClass([
  __decorateParam(0, IProductService),
  __decorateParam(1, IBrowserWorkbenchEnvironmentService)
], SwitchProductQualityContribution);
let DefaultAccountUpdateContribution = class extends Disposable {
  constructor(updateService, defaultAccountService, storageService) {
    super();
    this.updateService = updateService;
    this.defaultAccountService = defaultAccountService;
    this.storageService = storageService;
    this.#internalOrg = void 0;
    this.throttler = this._register(new Throttler());
    if (isWeb) {
      return;
    }
    this.#internalOrg = this.storageService.get(DefaultAccountUpdateContribution.STORAGE_KEY, StorageScope.APPLICATION, void 0);
    this.throttler.queue(() => this.updateService.setInternalOrg(this.#internalOrg));
    this.refresh();
    this._register(this.defaultAccountService.onDidChangeDefaultAccount(() => this.refresh()));
  }
  static {
    this.STORAGE_KEY = "update/internalOrg";
  }
  #internalOrg;
  refresh() {
    this.throttler.queue(() => this.doRefresh());
  }
  async doRefresh() {
    try {
      const defaultAccount = await this.defaultAccountService.getDefaultAccount();
      const internalOrg = getInternalOrg(defaultAccount?.entitlementsData?.organization_login_list);
      if (internalOrg === this.#internalOrg) {
        return;
      }
      this.#internalOrg = internalOrg;
      await this.updateService.setInternalOrg(this.#internalOrg);
      if (this.#internalOrg) {
        this.storageService.store(DefaultAccountUpdateContribution.STORAGE_KEY, internalOrg, StorageScope.APPLICATION, StorageTarget.MACHINE);
      } else {
        this.storageService.remove(DefaultAccountUpdateContribution.STORAGE_KEY, StorageScope.APPLICATION);
      }
    } catch (error) {
    }
  }
};
DefaultAccountUpdateContribution = __decorateClass([
  __decorateParam(0, IUpdateService),
  __decorateParam(1, IDefaultAccountService),
  __decorateParam(2, IStorageService)
], DefaultAccountUpdateContribution);
export {
  CONTEXT_UPDATE_STATE,
  DefaultAccountUpdateContribution,
  MAJOR_MINOR_UPDATE_AVAILABLE,
  ProductContribution,
  SwitchProductQualityContribution,
  UpdateContribution,
  appendUpdateMenuItems,
  showReleaseNotesInEditor
};
