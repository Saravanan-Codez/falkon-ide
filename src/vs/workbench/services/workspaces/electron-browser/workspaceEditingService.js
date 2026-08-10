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
import { localize } from "../../../../nls.js";
import { IWorkspaceEditingService } from "../common/workspaceEditing.js";
import { URI } from "../../../../base/common/uri.js";
import { hasWorkspaceFileExtension, isUntitledWorkspace, isWorkspaceIdentifier, IWorkspaceContextService, toWorkspaceIdentifier } from "../../../../platform/workspace/common/workspace.js";
import { IJSONEditingService } from "../../configuration/common/jsonEditing.js";
import { IWorkspacesService } from "../../../../platform/workspaces/common/workspaces.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { IExtensionService } from "../../extensions/common/extensions.js";
import { IWorkingCopyBackupService } from "../../workingCopy/common/workingCopyBackup.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { basename } from "../../../../base/common/resources.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { INativeWorkbenchEnvironmentService } from "../../environment/electron-browser/environmentService.js";
import { ILifecycleService, ShutdownReason } from "../../lifecycle/common/lifecycle.js";
import { IFileDialogService, IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ILabelService, Verbosity } from "../../../../platform/label/common/label.js";
import { ITextFileService } from "../../textfile/common/textfiles.js";
import { IHostService } from "../../host/browser/host.js";
import { AbstractWorkspaceEditingService } from "../browser/abstractWorkspaceEditingService.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { isMacintosh } from "../../../../base/common/platform.js";
import { WorkingCopyBackupService } from "../../workingCopy/common/workingCopyBackupService.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IWorkspaceTrustManagementService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { IWorkbenchConfigurationService } from "../../configuration/common/configuration.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { IUserDataProfileService } from "../../userDataProfile/common/userDataProfile.js";
import { ConfigurationTarget } from "../../../../platform/configuration/common/configuration.js";
import { ILogService } from "../../../../platform/log/common/log.js";
let NativeWorkspaceEditingService = class extends AbstractWorkspaceEditingService {
  constructor(jsonEditingService, contextService, nativeHostService, configurationService, storageService, extensionService, workingCopyBackupService, notificationService, commandService, fileService, textFileService, workspacesService, environmentService, fileDialogService, dialogService, lifecycleService, labelService, hostService, uriIdentityService, workspaceTrustManagementService, userDataProfilesService, userDataProfileService, logService) {
    super(jsonEditingService, contextService, configurationService, notificationService, commandService, fileService, textFileService, workspacesService, environmentService, fileDialogService, dialogService, hostService, uriIdentityService, workspaceTrustManagementService, userDataProfilesService, userDataProfileService, logService);
    this.nativeHostService = nativeHostService;
    this.storageService = storageService;
    this.extensionService = extensionService;
    this.workingCopyBackupService = workingCopyBackupService;
    this.lifecycleService = lifecycleService;
    this.labelService = labelService;
    this.registerListeners();
  }
  registerListeners() {
    this._register(this.lifecycleService.onBeforeShutdown((e) => {
      const saveOperation = this.saveUntitledBeforeShutdown(e.reason);
      e.veto(saveOperation, "veto.untitledWorkspace");
    }));
  }
  async saveUntitledBeforeShutdown(reason) {
    if (reason !== ShutdownReason.LOAD && reason !== ShutdownReason.CLOSE) {
      return false;
    }
    const workspaceIdentifier = this.getCurrentWorkspaceIdentifier();
    if (!workspaceIdentifier || !isUntitledWorkspace(workspaceIdentifier.configPath, this.environmentService)) {
      return false;
    }
    const windowCount = await this.nativeHostService.getWindowCount();
    if (reason === ShutdownReason.CLOSE && !isMacintosh && windowCount === 1) {
      return false;
    }
    const confirmSaveUntitledWorkspace = this.configurationService.getValue("window.confirmSaveUntitledWorkspace") !== false;
    if (!confirmSaveUntitledWorkspace) {
      await this.workspacesService.deleteUntitledWorkspace(workspaceIdentifier);
      return false;
    }
    let canceled = false;
    const { result, checkboxChecked } = await this.dialogService.prompt({
      type: Severity.Warning,
      message: localize("saveWorkspaceMessage", "Do you want to save your workspace configuration as a file?"),
      detail: localize("saveWorkspaceDetail", "Save your workspace if you plan to open it again."),
      buttons: [
        {
          label: localize({ key: "save", comment: ["&& denotes a mnemonic"] }, "&&Save"),
          run: async () => {
            const newWorkspacePath = await this.pickNewWorkspacePath();
            if (!newWorkspacePath || !hasWorkspaceFileExtension(newWorkspacePath)) {
              return true;
            }
            try {
              await this.saveWorkspaceAs(workspaceIdentifier, newWorkspacePath);
              const newWorkspaceIdentifier = await this.workspacesService.getWorkspaceIdentifier(newWorkspacePath);
              await this.workspacesService.addRecentlyOpened([{
                label: this.labelService.getWorkspaceLabel(newWorkspaceIdentifier, { verbose: Verbosity.LONG }),
                workspace: newWorkspaceIdentifier,
                remoteAuthority: this.environmentService.remoteAuthority
                // remember whether this was a remote window
              }]);
              await this.workspacesService.deleteUntitledWorkspace(workspaceIdentifier);
            } catch (error) {
            }
            return false;
          }
        },
        {
          label: localize({ key: "doNotSave", comment: ["&& denotes a mnemonic"] }, "Do&&n't Save"),
          run: async () => {
            await this.workspacesService.deleteUntitledWorkspace(workspaceIdentifier);
            return false;
          }
        }
      ],
      cancelButton: {
        run: () => {
          canceled = true;
          return true;
        }
      },
      checkbox: {
        label: localize("doNotAskAgain", "Always discard untitled workspaces without asking")
      }
    });
    if (!canceled && checkboxChecked) {
      await this.configurationService.updateValue("window.confirmSaveUntitledWorkspace", false, ConfigurationTarget.USER);
    }
    return result;
  }
  async isValidTargetWorkspacePath(workspaceUri) {
    const windows = await this.nativeHostService.getWindows({ includeAuxiliaryWindows: false });
    if (windows.some((window) => isWorkspaceIdentifier(window.workspace) && this.uriIdentityService.extUri.isEqual(window.workspace.configPath, workspaceUri))) {
      await this.dialogService.info(
        localize("workspaceOpenedMessage", "Unable to save workspace '{0}'", basename(workspaceUri)),
        localize("workspaceOpenedDetail", "The workspace is already opened in another window. Please close that window first and then try again.")
      );
      return false;
    }
    return true;
  }
  async enterWorkspace(workspaceUri) {
    const stopped = await this.extensionService.stopExtensionHosts(localize("restartExtensionHost.reason", "Opening a multi-root workspace"));
    if (!stopped) {
      return;
    }
    const oldWorkspace = toWorkspaceIdentifier(this.contextService.getWorkspace());
    const result = await this.doEnterWorkspace(workspaceUri);
    if (result) {
      await this.storageService.switch(
        result.workspace,
        true
        /* preserve data */
      );
      if (this.workingCopyBackupService instanceof WorkingCopyBackupService) {
        const newBackupWorkspaceHome = result.backupPath ? URI.file(result.backupPath).with({ scheme: this.environmentService.userRoamingDataHome.scheme }) : void 0;
        this.workingCopyBackupService.reinitialize(newBackupWorkspaceHome);
      }
      await this.fireDidEnterWorkspace(oldWorkspace, result.workspace);
    }
    if (this.environmentService.remoteAuthority) {
      this.hostService.reload();
    } else {
      this.extensionService.startExtensionHosts();
    }
  }
};
NativeWorkspaceEditingService = __decorateClass([
  __decorateParam(0, IJSONEditingService),
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, INativeHostService),
  __decorateParam(3, IWorkbenchConfigurationService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, IExtensionService),
  __decorateParam(6, IWorkingCopyBackupService),
  __decorateParam(7, INotificationService),
  __decorateParam(8, ICommandService),
  __decorateParam(9, IFileService),
  __decorateParam(10, ITextFileService),
  __decorateParam(11, IWorkspacesService),
  __decorateParam(12, INativeWorkbenchEnvironmentService),
  __decorateParam(13, IFileDialogService),
  __decorateParam(14, IDialogService),
  __decorateParam(15, ILifecycleService),
  __decorateParam(16, ILabelService),
  __decorateParam(17, IHostService),
  __decorateParam(18, IUriIdentityService),
  __decorateParam(19, IWorkspaceTrustManagementService),
  __decorateParam(20, IUserDataProfilesService),
  __decorateParam(21, IUserDataProfileService),
  __decorateParam(22, ILogService)
], NativeWorkspaceEditingService);
registerSingleton(IWorkspaceEditingService, NativeWorkspaceEditingService, InstantiationType.Delayed);
export {
  NativeWorkspaceEditingService
};
