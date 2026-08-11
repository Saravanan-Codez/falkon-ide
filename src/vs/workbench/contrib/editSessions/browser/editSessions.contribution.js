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
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { ILifecycleService, LifecyclePhase, ShutdownReason } from "../../../services/lifecycle/common/lifecycle.js";
import { Action2, MenuId, MenuRegistry, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { localize, localize2 } from "../../../../nls.js";
import { IEditSessionsStorageService, ChangeType, FileType, EDIT_SESSION_SYNC_CATEGORY, EDIT_SESSIONS_CONTAINER_ID, EditSessionSchemaVersion, IEditSessionsLogService, EDIT_SESSIONS_VIEW_ICON, EDIT_SESSIONS_TITLE, EDIT_SESSIONS_SHOW_VIEW, EDIT_SESSIONS_DATA_VIEW_ID, decodeEditSessionFileContent, hashedEditSessionId, editSessionsLogId, EDIT_SESSIONS_PENDING } from "../common/editSessions.js";
import { ISCMService } from "../../scm/common/scm.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { URI } from "../../../../base/common/uri.js";
import { basename, joinPath, relativePath } from "../../../../base/common/resources.js";
import { encodeBase64 } from "../../../../base/common/buffer.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { EditSessionsWorkbenchService } from "./editSessionsStorageService.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { UserDataSyncErrorCode, UserDataSyncStoreError } from "../../../../platform/userDataSync/common/userDataSync.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { getFileNamesMessage, IDialogService, IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { workbenchConfigurationNodeBase } from "../../../common/configuration.js";
import { Extensions as ConfigurationExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { ExtensionsRegistry } from "../../../services/extensions/common/extensionsRegistry.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { getVirtualWorkspaceLocation } from "../../../../platform/workspace/common/virtualWorkspace.js";
import { Schemas } from "../../../../base/common/network.js";
import { IsWebContext } from "../../../../platform/contextkey/common/contextkeys.js";
import { IExtensionService, isProposedApiEnabled } from "../../../services/extensions/common/extensions.js";
import { EditSessionsLogService } from "../common/editSessionsLogService.js";
import { Extensions as ViewExtensions, ViewContainerLocation } from "../../../common/views.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { ViewPaneContainer } from "../../../browser/parts/views/viewPaneContainer.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { EditSessionsDataViews } from "./editSessionsViews.js";
import { EditSessionsFileSystemProvider } from "./editSessionsFileSystemProvider.js";
import { isNative, isWeb } from "../../../../base/common/platform.js";
import { VirtualWorkspaceContext, WorkspaceFolderCountContext } from "../../../common/contextkeys.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { equals } from "../../../../base/common/objects.js";
import { EditSessionIdentityMatch, IEditSessionIdentityService } from "../../../../platform/workspace/common/editSessions.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { IOutputService } from "../../../services/output/common/output.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IActivityService, NumberBadge } from "../../../services/activity/common/activity.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { CancellationError } from "../../../../base/common/errors.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
import { IExtensionsWorkbenchService } from "../../extensions/common/extensions.js";
import { WorkspaceStateSynchroniser } from "../common/workspaceStateSync.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { IRequestService } from "../../../../platform/request/common/request.js";
import { EditSessionsStoreClient } from "../common/editSessionsStorageClient.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IWorkspaceIdentityService } from "../../../services/workspaces/common/workspaceIdentityService.js";
import { hashAsync } from "../../../../base/common/hash.js";
import { ResourceSet } from "../../../../base/common/map.js";
registerSingleton(IEditSessionsLogService, EditSessionsLogService, InstantiationType.Delayed);
registerSingleton(IEditSessionsStorageService, EditSessionsWorkbenchService, InstantiationType.Delayed);
const continueWorkingOnCommand = {
  id: "_workbench.editSessions.actions.continueEditSession",
  title: localize2("continue working on", "Continue Working On..."),
  precondition: WorkspaceFolderCountContext.notEqualsTo("0"),
  f1: true
};
const openLocalFolderCommand = {
  id: "_workbench.editSessions.actions.continueEditSession.openLocalFolder",
  title: localize2("continue edit session in local folder", "Open In Local Folder"),
  category: EDIT_SESSION_SYNC_CATEGORY,
  precondition: ContextKeyExpr.and(IsWebContext.toNegated(), VirtualWorkspaceContext)
};
const showOutputChannelCommand = {
  id: "workbench.editSessions.actions.showOutputChannel",
  title: localize2("show log", "Show Log"),
  category: EDIT_SESSION_SYNC_CATEGORY
};
const installAdditionalContinueOnOptionsCommand = {
  id: "workbench.action.continueOn.extensions",
  title: localize("continueOn.installAdditional", "Install additional development environment options")
};
registerAction2(class extends Action2 {
  constructor() {
    super({ ...installAdditionalContinueOnOptionsCommand, f1: false });
  }
  async run(accessor) {
    return accessor.get(IExtensionsWorkbenchService).openSearch("@tag:continueOn");
  }
});
const resumeProgressOptionsTitle = `[${localize("resuming working changes window", "Resuming working changes...")}](command:${showOutputChannelCommand.id})`;
const resumeProgressOptions = {
  location: ProgressLocation.Window,
  type: "syncing"
};
const queryParamName = "editSessionId";
const useEditSessionsWithContinueOn = "workbench.editSessions.continueOn";
let EditSessionsContribution = class extends Disposable {
  constructor(editSessionsStorageService, fileService, progressService, openerService, telemetryService, scmService, notificationService, dialogService, logService, environmentService, instantiationService, productService, configurationService, contextService, editSessionIdentityService, quickInputService, commandService, contextKeyService, fileDialogService, lifecycleService, storageService, activityService, editorService, remoteAgentService, extensionService, requestService, userDataProfilesService, uriIdentityService, workspaceIdentityService) {
    super();
    this.editSessionsStorageService = editSessionsStorageService;
    this.fileService = fileService;
    this.progressService = progressService;
    this.openerService = openerService;
    this.telemetryService = telemetryService;
    this.scmService = scmService;
    this.notificationService = notificationService;
    this.dialogService = dialogService;
    this.logService = logService;
    this.environmentService = environmentService;
    this.instantiationService = instantiationService;
    this.productService = productService;
    this.configurationService = configurationService;
    this.contextService = contextService;
    this.editSessionIdentityService = editSessionIdentityService;
    this.quickInputService = quickInputService;
    this.commandService = commandService;
    this.contextKeyService = contextKeyService;
    this.fileDialogService = fileDialogService;
    this.lifecycleService = lifecycleService;
    this.storageService = storageService;
    this.activityService = activityService;
    this.editorService = editorService;
    this.remoteAgentService = remoteAgentService;
    this.extensionService = extensionService;
    this.requestService = requestService;
    this.userDataProfilesService = userDataProfilesService;
    this.uriIdentityService = uriIdentityService;
    this.workspaceIdentityService = workspaceIdentityService;
    this.continueEditSessionOptions = [];
    this.accountsMenuBadgeDisposable = this._register(new MutableDisposable());
    this.registeredCommands = /* @__PURE__ */ new Set();
    this.shouldShowViewsContext = EDIT_SESSIONS_SHOW_VIEW.bindTo(this.contextKeyService);
    this.pendingEditSessionsContext = EDIT_SESSIONS_PENDING.bindTo(this.contextKeyService);
    this.pendingEditSessionsContext.set(false);
    if (!this.productService["editSessions.store"]?.url) {
      return;
    }
    this.editSessionsStorageClient = new EditSessionsStoreClient(URI.parse(this.productService["editSessions.store"].url), this.productService, this.requestService, this.logService, this.environmentService, this.fileService, this.storageService);
    this.editSessionsStorageService.storeClient = this.editSessionsStorageClient;
    this.workspaceStateSynchronizer = new WorkspaceStateSynchroniser(this.userDataProfilesService.defaultProfile, void 0, this.editSessionsStorageClient, this.logService, this.fileService, this.environmentService, this.telemetryService, this.configurationService, this.storageService, this.uriIdentityService, this.workspaceIdentityService, this.editSessionsStorageService);
    this.autoResumeEditSession();
    this.registerActions();
    this.registerViews();
    this.registerContributedEditSessionOptions();
    this._register(this.fileService.registerProvider(EditSessionsFileSystemProvider.SCHEMA, new EditSessionsFileSystemProvider(this.editSessionsStorageService)));
    this._register(this.lifecycleService.onWillShutdown((e) => {
      if (e.reason !== ShutdownReason.RELOAD && this.editSessionsStorageService.isSignedIn && this.configurationService.getValue("workbench.experimental.cloudChanges.autoStore") === "onShutdown" && !isWeb) {
        e.join(this.autoStoreEditSession(), { id: "autoStoreWorkingChanges", label: localize("autoStoreWorkingChanges", "Storing current working changes...") });
      }
    }));
    this._register(this.editSessionsStorageService.onDidSignIn(() => this.updateAccountsMenuBadge()));
    this._register(this.editSessionsStorageService.onDidSignOut(() => this.updateAccountsMenuBadge()));
  }
  static {
    this.APPLICATION_LAUNCHED_VIA_CONTINUE_ON_STORAGE_KEY = "applicationLaunchedViaContinueOn";
  }
  async autoResumeEditSession() {
    const shouldAutoResumeOnReload = this.configurationService.getValue("workbench.cloudChanges.autoResume") === "onReload";
    if (this.environmentService.editSessionId !== void 0) {
      this.logService.info(`Resuming cloud changes, reason: found editSessionId ${this.environmentService.editSessionId} in environment service...`);
      await this.progressService.withProgress(resumeProgressOptions, async (progress) => await this.resumeEditSession(this.environmentService.editSessionId, void 0, void 0, void 0, progress).finally(() => this.environmentService.editSessionId = void 0));
    } else if (shouldAutoResumeOnReload && this.editSessionsStorageService.isSignedIn) {
      this.logService.info("Resuming cloud changes, reason: cloud changes enabled...");
      await this.progressService.withProgress(resumeProgressOptions, async (progress) => await this.resumeEditSession(void 0, true, void 0, void 0, progress));
    } else if (shouldAutoResumeOnReload) {
      const hasApplicationLaunchedFromContinueOnFlow = this.storageService.getBoolean(EditSessionsContribution.APPLICATION_LAUNCHED_VIA_CONTINUE_ON_STORAGE_KEY, StorageScope.APPLICATION, false);
      this.logService.info(`Prompting to enable cloud changes, has application previously launched from Continue On flow: ${hasApplicationLaunchedFromContinueOnFlow}`);
      const handlePendingEditSessions = () => {
        this.logService.info("Showing badge to enable cloud changes in accounts menu...");
        this.updateAccountsMenuBadge();
        this.pendingEditSessionsContext.set(true);
        const disposable = this.editSessionsStorageService.onDidSignIn(async () => {
          disposable.dispose();
          this.logService.info("Showing badge to enable cloud changes in accounts menu succeeded, resuming cloud changes...");
          await this.progressService.withProgress(resumeProgressOptions, async (progress) => await this.resumeEditSession(void 0, true, void 0, void 0, progress));
          this.storageService.remove(EditSessionsContribution.APPLICATION_LAUNCHED_VIA_CONTINUE_ON_STORAGE_KEY, StorageScope.APPLICATION);
          this.environmentService.continueOn = void 0;
        });
      };
      if (this.environmentService.continueOn !== void 0 && !this.editSessionsStorageService.isSignedIn && // and user has not yet been prompted to sign in on this machine
      hasApplicationLaunchedFromContinueOnFlow === false) {
        this.storageService.store(EditSessionsContribution.APPLICATION_LAUNCHED_VIA_CONTINUE_ON_STORAGE_KEY, true, StorageScope.APPLICATION, StorageTarget.MACHINE);
        this.logService.info("Prompting to enable cloud changes...");
        await this.editSessionsStorageService.initialize("read");
        if (this.editSessionsStorageService.isSignedIn) {
          this.logService.info("Prompting to enable cloud changes succeeded, resuming cloud changes...");
          await this.progressService.withProgress(resumeProgressOptions, async (progress) => await this.resumeEditSession(void 0, true, void 0, void 0, progress));
        } else {
          handlePendingEditSessions();
        }
      } else if (!this.editSessionsStorageService.isSignedIn && // and user has been prompted to sign in on this machine
      hasApplicationLaunchedFromContinueOnFlow === true) {
        handlePendingEditSessions();
      }
    } else {
      this.logService.debug("Auto resuming cloud changes disabled.");
    }
  }
  updateAccountsMenuBadge() {
    if (this.editSessionsStorageService.isSignedIn) {
      return this.accountsMenuBadgeDisposable.clear();
    }
    const badge = new NumberBadge(1, () => localize("check for pending cloud changes", "Check for pending cloud changes"));
    this.accountsMenuBadgeDisposable.value = this.activityService.showAccountsActivity({ badge });
  }
  async autoStoreEditSession() {
    const cancellationTokenSource = new CancellationTokenSource();
    await this.progressService.withProgress({
      location: ProgressLocation.Window,
      type: "syncing",
      title: localize("store working changes", "Storing working changes...")
    }, async () => this.storeEditSession(false, cancellationTokenSource.token), () => {
      cancellationTokenSource.cancel();
      cancellationTokenSource.dispose();
    });
  }
  registerViews() {
    const container = Registry.as(ViewExtensions.ViewContainersRegistry).registerViewContainer(
      {
        id: EDIT_SESSIONS_CONTAINER_ID,
        title: EDIT_SESSIONS_TITLE,
        ctorDescriptor: new SyncDescriptor(
          ViewPaneContainer,
          [EDIT_SESSIONS_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: true }]
        ),
        icon: EDIT_SESSIONS_VIEW_ICON,
        hideIfEmpty: true
      },
      ViewContainerLocation.Sidebar,
      { doNotRegisterOpenCommand: true }
    );
    this._register(this.instantiationService.createInstance(EditSessionsDataViews, container));
  }
  registerActions() {
    this.registerContinueEditSessionAction();
    this.registerResumeLatestEditSessionAction();
    this.registerStoreLatestEditSessionAction();
    this.registerContinueInLocalFolderAction();
    this.registerShowEditSessionViewAction();
    this.registerShowEditSessionOutputChannelAction();
  }
  registerShowEditSessionOutputChannelAction() {
    this._register(registerAction2(class ShowEditSessionOutput extends Action2 {
      constructor() {
        super(showOutputChannelCommand);
      }
      run(accessor, ...args) {
        const outputChannel = accessor.get(IOutputService);
        void outputChannel.showChannel(editSessionsLogId);
      }
    }));
  }
  registerShowEditSessionViewAction() {
    const that = this;
    this._register(registerAction2(class ShowEditSessionView extends Action2 {
      constructor() {
        super({
          id: "workbench.editSessions.actions.showEditSessions",
          title: localize2("show cloud changes", "Show Cloud Changes"),
          category: EDIT_SESSION_SYNC_CATEGORY,
          f1: true
        });
      }
      async run(accessor) {
        that.shouldShowViewsContext.set(true);
        const viewsService = accessor.get(IViewsService);
        await viewsService.openView(EDIT_SESSIONS_DATA_VIEW_ID);
      }
    }));
  }
  registerContinueEditSessionAction() {
    const that = this;
    this._register(registerAction2(class ContinueEditSessionAction extends Action2 {
      constructor() {
        super(continueWorkingOnCommand);
      }
      async run(accessor, workspaceUri, destination) {
        let uri = workspaceUri;
        if (!destination && !uri) {
          destination = await that.pickContinueEditSessionDestination();
          if (!destination) {
            that.telemetryService.publicLog2("continueOn.editSessions.pick.outcome", { outcome: "noSelection" });
            return;
          }
        }
        const shouldStoreEditSession = await that.shouldContinueOnWithEditSession();
        let ref;
        if (shouldStoreEditSession) {
          that.telemetryService.publicLog2("continueOn.editSessions.store");
          const cancellationTokenSource = new CancellationTokenSource();
          try {
            ref = await that.progressService.withProgress({
              location: ProgressLocation.Notification,
              cancellable: true,
              type: "syncing",
              title: localize("store your working changes", "Storing your working changes...")
            }, async () => {
              const ref2 = await that.storeEditSession(false, cancellationTokenSource.token);
              if (ref2 !== void 0) {
                that.telemetryService.publicLog2("continueOn.editSessions.store.outcome", { outcome: "storeSucceeded", hashedId: hashedEditSessionId(ref2) });
              } else {
                that.telemetryService.publicLog2("continueOn.editSessions.store.outcome", { outcome: "storeSkipped" });
              }
              return ref2;
            }, () => {
              cancellationTokenSource.cancel();
              cancellationTokenSource.dispose();
              that.telemetryService.publicLog2("continueOn.editSessions.store.outcome", { outcome: "storeCancelledByUser" });
            });
          } catch (ex) {
            that.telemetryService.publicLog2("continueOn.editSessions.store.outcome", { outcome: "storeFailed" });
            throw ex;
          }
        }
        uri = destination ? await that.resolveDestination(destination) : uri;
        if (uri === void 0) {
          return;
        }
        if (ref !== void 0 && uri !== "noDestinationUri") {
          const encodedRef = encodeURIComponent(ref);
          uri = uri.with({
            query: uri.query.length > 0 ? uri.query + `&${queryParamName}=${encodedRef}&continueOn=1` : `${queryParamName}=${encodedRef}&continueOn=1`
          });
          that.logService.info(`Opening ${uri.toString()}`);
          await that.openerService.open(uri, { openExternal: true });
        } else if ((!shouldStoreEditSession || ref === void 0) && uri !== "noDestinationUri") {
          that.logService.info(`Opening ${uri.toString()}`);
          await that.openerService.open(uri, { openExternal: true });
        } else if (ref === void 0 && shouldStoreEditSession) {
          that.logService.warn(`Failed to store working changes when invoking ${continueWorkingOnCommand.id}.`);
        }
      }
    }));
  }
  registerResumeLatestEditSessionAction() {
    const that = this;
    this._register(registerAction2(class ResumeLatestEditSessionAction extends Action2 {
      constructor() {
        super({
          id: "workbench.editSessions.actions.resumeLatest",
          title: localize2("resume latest cloud changes", "Resume Latest Changes from Cloud"),
          category: EDIT_SESSION_SYNC_CATEGORY,
          f1: true
        });
      }
      async run(accessor, editSessionId, forceApplyUnrelatedChange) {
        await that.progressService.withProgress({ ...resumeProgressOptions, title: resumeProgressOptionsTitle }, async () => await that.resumeEditSession(editSessionId, void 0, forceApplyUnrelatedChange));
      }
    }));
    this._register(registerAction2(class ResumeLatestEditSessionAction extends Action2 {
      constructor() {
        super({
          id: "workbench.editSessions.actions.resumeFromSerializedPayload",
          title: localize2("resume cloud changes", "Resume Changes from Serialized Data"),
          category: "Developer",
          f1: true
        });
      }
      async run(accessor, editSessionId) {
        const data = await that.quickInputService.input({ prompt: "Enter serialized data" });
        if (data) {
          that.editSessionsStorageService.lastReadResources.set("editSessions", { content: data, ref: "" });
        }
        await that.progressService.withProgress({ ...resumeProgressOptions, title: resumeProgressOptionsTitle }, async () => await that.resumeEditSession(editSessionId, void 0, void 0, void 0, void 0, data));
      }
    }));
  }
  registerStoreLatestEditSessionAction() {
    const that = this;
    this._register(registerAction2(class StoreLatestEditSessionAction extends Action2 {
      constructor() {
        super({
          id: "workbench.editSessions.actions.storeCurrent",
          title: localize2("store working changes in cloud", "Store Working Changes in Cloud"),
          category: EDIT_SESSION_SYNC_CATEGORY,
          f1: true
        });
      }
      async run(accessor) {
        const cancellationTokenSource = new CancellationTokenSource();
        await that.progressService.withProgress({
          location: ProgressLocation.Notification,
          title: localize("storing working changes", "Storing working changes...")
        }, async () => {
          that.telemetryService.publicLog2("editSessions.store");
          await that.storeEditSession(true, cancellationTokenSource.token);
        }, () => {
          cancellationTokenSource.cancel();
          cancellationTokenSource.dispose();
        });
      }
    }));
  }
  async resumeEditSession(ref, silent, forceApplyUnrelatedChange, applyPartialMatch, progress, serializedData) {
    await this.remoteAgentService.getEnvironment();
    if (this.contextService.getWorkbenchState() === WorkbenchState.EMPTY) {
      return;
    }
    this.logService.info(ref !== void 0 ? `Resuming changes from cloud with ref ${ref}...` : "Checking for pending cloud changes...");
    if (silent && !await this.editSessionsStorageService.initialize("read", true)) {
      return;
    }
    this.telemetryService.publicLog2("editSessions.resume");
    performance.mark("code/willResumeEditSessionFromIdentifier");
    progress?.report({ message: localize("checkingForWorkingChanges", "Checking for pending cloud changes...") });
    const data = serializedData ? { content: serializedData, ref: "" } : await this.editSessionsStorageService.read("editSessions", ref);
    if (!data) {
      if (ref === void 0 && !silent) {
        this.notificationService.info(localize("no cloud changes", "There are no changes to resume from the cloud."));
      } else if (ref !== void 0) {
        this.notificationService.warn(localize("no cloud changes for ref", "Could not resume changes from the cloud for ID {0}.", ref));
      }
      this.logService.info(ref !== void 0 ? `Aborting resuming changes from cloud as no edit session content is available to be applied from ref ${ref}.` : `Aborting resuming edit session as no edit session content is available to be applied`);
      return;
    }
    progress?.report({ message: resumeProgressOptionsTitle });
    const editSession = JSON.parse(data.content);
    ref = data.ref;
    if (editSession.version > EditSessionSchemaVersion) {
      this.notificationService.error(localize("client too old", "Please upgrade to a newer version of {0} to resume your working changes from the cloud.", this.productService.nameLong));
      this.telemetryService.publicLog2("editSessions.resume.outcome", { hashedId: hashedEditSessionId(ref), outcome: "clientUpdateNeeded" });
      return;
    }
    try {
      const { changes, conflictingChanges } = await this.generateChanges(editSession, ref, forceApplyUnrelatedChange, applyPartialMatch);
      if (changes.length === 0) {
        return;
      }
      if (conflictingChanges.length > 0) {
        const { confirmed } = await this.dialogService.confirm({
          type: Severity.Warning,
          message: conflictingChanges.length > 1 ? localize("resume edit session warning many", "Resuming your working changes from the cloud will overwrite the following {0} files. Do you want to proceed?", conflictingChanges.length) : localize("resume edit session warning 1", "Resuming your working changes from the cloud will overwrite {0}. Do you want to proceed?", basename(conflictingChanges[0].uri)),
          detail: conflictingChanges.length > 1 ? getFileNamesMessage(conflictingChanges.map((c) => c.uri)) : void 0
        });
        if (!confirmed) {
          return;
        }
      }
      for (const { uri, type, contents } of changes) {
        if (type === ChangeType.Addition) {
          await this.fileService.writeFile(uri, decodeEditSessionFileContent(editSession.version, contents));
        } else if (type === ChangeType.Deletion && await this.fileService.exists(uri)) {
          await this.fileService.del(uri);
        }
      }
      await this.workspaceStateSynchronizer?.apply();
      this.logService.info(`Deleting edit session with ref ${ref} after successfully applying it to current workspace...`);
      await this.editSessionsStorageService.delete("editSessions", ref);
      this.logService.info(`Deleted edit session with ref ${ref}.`);
      this.telemetryService.publicLog2("editSessions.resume.outcome", { hashedId: hashedEditSessionId(ref), outcome: "resumeSucceeded" });
    } catch (ex) {
      this.logService.error("Failed to resume edit session, reason: ", ex.toString());
      this.notificationService.error(localize("resume failed", "Failed to resume your working changes from the cloud."));
    }
    performance.mark("code/didResumeEditSessionFromIdentifier");
  }
  async generateChanges(editSession, ref, forceApplyUnrelatedChange = false, applyPartialMatch = false) {
    const changes = [];
    const conflictingChanges = [];
    const workspaceFolders = this.contextService.getWorkspace().folders;
    const cancellationTokenSource = new CancellationTokenSource();
    for (const folder of editSession.folders) {
      let folderRoot;
      if (folder.canonicalIdentity) {
        for (const f of workspaceFolders) {
          const identity = await this.editSessionIdentityService.getEditSessionIdentifier(f, cancellationTokenSource.token);
          this.logService.info(`Matching identity ${identity} against edit session folder identity ${folder.canonicalIdentity}...`);
          if (equals(identity, folder.canonicalIdentity) || forceApplyUnrelatedChange) {
            folderRoot = f;
            break;
          }
          if (identity !== void 0) {
            const match = await this.editSessionIdentityService.provideEditSessionIdentityMatch(f, identity, folder.canonicalIdentity, cancellationTokenSource.token);
            if (match === EditSessionIdentityMatch.Complete) {
              folderRoot = f;
              break;
            } else if (match === EditSessionIdentityMatch.Partial && this.configurationService.getValue("workbench.experimental.cloudChanges.partialMatches.enabled") === true) {
              if (!applyPartialMatch) {
                this.notificationService.prompt(
                  Severity.Info,
                  localize("editSessionPartialMatch", "You have pending working changes in the cloud for this workspace. Would you like to resume them?"),
                  [{ label: localize("resume", "Resume"), run: () => this.resumeEditSession(ref, false, void 0, true) }]
                );
              } else {
                folderRoot = f;
                break;
              }
            }
          }
        }
      } else {
        folderRoot = workspaceFolders.find((f) => f.name === folder.name);
      }
      if (!folderRoot) {
        this.logService.info(`Skipping applying ${folder.workingChanges.length} changes from edit session with ref ${ref} as no matching workspace folder was found.`);
        return { changes: [], conflictingChanges: [], contributedStateHandlers: [] };
      }
      const localChanges = /* @__PURE__ */ new Set();
      for (const repository of this.scmService.repositories) {
        if (repository.provider.rootUri !== void 0 && this.contextService.getWorkspaceFolder(repository.provider.rootUri)?.name === folder.name) {
          const repositoryChanges = this.getChangedResources(repository);
          repositoryChanges.forEach((change) => localChanges.add(change.toString()));
        }
      }
      for (const change of folder.workingChanges) {
        const uri = joinPath(folderRoot.uri, change.relativeFilePath);
        if (!this.uriIdentityService.extUri.isEqualOrParent(uri, folderRoot.uri) || this.uriIdentityService.extUri.isEqual(uri, folderRoot.uri)) {
          this.logService.warn(`Skipping change outside workspace folder: ${change.relativeFilePath}`);
          continue;
        }
        changes.push({ uri, type: change.type, contents: change.contents });
        if (await this.willChangeLocalContents(localChanges, uri, change)) {
          conflictingChanges.push({ uri, type: change.type, contents: change.contents });
        }
      }
    }
    return { changes, conflictingChanges };
  }
  async willChangeLocalContents(localChanges, uriWithIncomingChanges, incomingChange) {
    if (!localChanges.has(uriWithIncomingChanges.toString())) {
      return false;
    }
    const { contents, type } = incomingChange;
    switch (type) {
      case ChangeType.Addition: {
        const [originalContents, incomingContents] = await Promise.all([
          hashAsync(contents),
          hashAsync(encodeBase64((await this.fileService.readFile(uriWithIncomingChanges)).value))
        ]);
        return originalContents !== incomingContents;
      }
      case ChangeType.Deletion: {
        return await this.fileService.exists(uriWithIncomingChanges);
      }
      default:
        throw new Error("Unhandled change type.");
    }
  }
  async storeEditSession(fromStoreCommand, cancellationToken) {
    const folders = [];
    let editSessionSize = 0;
    let hasEdits = false;
    await this.editorService.saveAll();
    const createdEditSessionIdentities = new ResourceSet();
    for (const repository of this.scmService.repositories) {
      const changedResources = this.getChangedResources(repository);
      if (!changedResources.size) {
        continue;
      }
      for (const uri of changedResources) {
        const workspaceFolder = this.contextService.getWorkspaceFolder(uri);
        if (!workspaceFolder || createdEditSessionIdentities.has(uri)) {
          continue;
        }
        createdEditSessionIdentities.add(uri);
        await this.editSessionIdentityService.onWillCreateEditSessionIdentity(workspaceFolder, cancellationToken);
      }
    }
    for (const repository of this.scmService.repositories) {
      const trackedUris = this.getChangedResources(repository);
      const workingChanges = [];
      const { rootUri } = repository.provider;
      const workspaceFolder = rootUri ? this.contextService.getWorkspaceFolder(rootUri) : void 0;
      let name = workspaceFolder?.name;
      for (const uri of trackedUris) {
        const workspaceFolder2 = this.contextService.getWorkspaceFolder(uri);
        if (!workspaceFolder2) {
          this.logService.info(`Skipping working change ${uri.toString()} as no associated workspace folder was found.`);
          continue;
        }
        name = name ?? workspaceFolder2.name;
        const relativeFilePath = relativePath(workspaceFolder2.uri, uri) ?? uri.path;
        try {
          if (!(await this.fileService.stat(uri)).isFile) {
            continue;
          }
        } catch {
        }
        hasEdits = true;
        if (await this.fileService.exists(uri)) {
          const contents = encodeBase64((await this.fileService.readFile(uri)).value);
          editSessionSize += contents.length;
          if (editSessionSize > this.editSessionsStorageService.SIZE_LIMIT) {
            this.notificationService.error(localize("payload too large", "Your working changes exceed the size limit and cannot be stored."));
            return void 0;
          }
          workingChanges.push({ type: ChangeType.Addition, fileType: FileType.File, contents, relativeFilePath });
        } else {
          workingChanges.push({ type: ChangeType.Deletion, fileType: FileType.File, contents: void 0, relativeFilePath });
        }
      }
      let canonicalIdentity = void 0;
      if (workspaceFolder !== null && workspaceFolder !== void 0) {
        canonicalIdentity = await this.editSessionIdentityService.getEditSessionIdentifier(workspaceFolder, cancellationToken);
      }
      folders.push({ workingChanges, name: name ?? "", canonicalIdentity: canonicalIdentity ?? void 0, absoluteUri: workspaceFolder?.uri.toString() });
    }
    await this.workspaceStateSynchronizer?.sync();
    if (!hasEdits) {
      this.logService.info("Skipped storing working changes in the cloud as there are no edits to store.");
      if (fromStoreCommand) {
        this.notificationService.info(localize("no working changes to store", "Skipped storing working changes in the cloud as there are no edits to store."));
      }
      return void 0;
    }
    const data = { folders, version: 2, workspaceStateId: this.editSessionsStorageService.lastWrittenResources.get("workspaceState")?.ref };
    try {
      this.logService.info(`Storing edit session...`);
      const ref = await this.editSessionsStorageService.write("editSessions", data);
      this.logService.info(`Stored edit session with ref ${ref}.`);
      return ref;
    } catch (ex) {
      this.logService.error(`Failed to store edit session, reason: `, ex.toString());
      if (ex instanceof UserDataSyncStoreError) {
        switch (ex.code) {
          case UserDataSyncErrorCode.TooLarge:
            this.telemetryService.publicLog2("editSessions.upload.failed", { reason: "TooLarge" });
            this.notificationService.error(localize("payload too large", "Your working changes exceed the size limit and cannot be stored."));
            break;
          default:
            this.telemetryService.publicLog2("editSessions.upload.failed", { reason: "unknown" });
            this.notificationService.error(localize("payload failed", "Your working changes cannot be stored."));
            break;
        }
      }
    }
    return void 0;
  }
  getChangedResources(repository) {
    return repository.provider.groups.reduce((resources, resourceGroups) => {
      resourceGroups.resources.forEach((resource) => resources.add(resource.sourceUri));
      return resources;
    }, /* @__PURE__ */ new Set());
  }
  hasEditSession() {
    for (const repository of this.scmService.repositories) {
      if (this.getChangedResources(repository).size > 0) {
        return true;
      }
    }
    return false;
  }
  async shouldContinueOnWithEditSession() {
    if (this.editSessionsStorageService.isSignedIn) {
      return this.hasEditSession();
    }
    if (this.configurationService.getValue(useEditSessionsWithContinueOn) === "off") {
      this.telemetryService.publicLog2("continueOn.editSessions.canStore.outcome", { outcome: "disabledEditSessionsViaSetting" });
      return false;
    }
    if (this.hasEditSession()) {
      const disposables = new DisposableStore();
      const quickpick = disposables.add(this.quickInputService.createQuickPick());
      quickpick.placeholder = localize("continue with cloud changes", "Select whether to bring your working changes with you");
      quickpick.ok = false;
      quickpick.ignoreFocusOut = true;
      const withCloudChanges = { label: localize("with cloud changes", "Yes, continue with my working changes") };
      const withoutCloudChanges = { label: localize("without cloud changes", "No, continue without my working changes") };
      quickpick.items = [withCloudChanges, withoutCloudChanges];
      const continueWithCloudChanges = await new Promise((resolve, reject) => {
        disposables.add(quickpick.onDidAccept(() => {
          resolve(quickpick.selectedItems[0] === withCloudChanges);
          disposables.dispose();
        }));
        disposables.add(quickpick.onDidHide(() => {
          reject(new CancellationError());
          disposables.dispose();
        }));
        quickpick.show();
      });
      if (!continueWithCloudChanges) {
        this.telemetryService.publicLog2("continueOn.editSessions.canStore.outcome", { outcome: "didNotEnableEditSessionsWhenPrompted" });
        return continueWithCloudChanges;
      }
      const initialized = await this.editSessionsStorageService.initialize("write");
      if (!initialized) {
        this.telemetryService.publicLog2("continueOn.editSessions.canStore.outcome", { outcome: "didNotEnableEditSessionsWhenPrompted" });
      }
      return initialized;
    }
    return false;
  }
  //#region Continue Edit Session extension contribution point
  registerContributedEditSessionOptions() {
    continueEditSessionExtPoint.setHandler((extensions) => {
      const continueEditSessionOptions = [];
      for (const extension of extensions) {
        if (!isProposedApiEnabled(extension.description, "contribEditSessions")) {
          continue;
        }
        if (!Array.isArray(extension.value)) {
          continue;
        }
        for (const contribution of extension.value) {
          const command = MenuRegistry.getCommand(contribution.command);
          if (!command) {
            return;
          }
          const icon = command.icon;
          const title = typeof command.title === "string" ? command.title : command.title.value;
          const when = ContextKeyExpr.deserialize(contribution.when);
          continueEditSessionOptions.push(new ContinueEditSessionItem(
            ThemeIcon.isThemeIcon(icon) ? `$(${icon.id}) ${title}` : title,
            command.id,
            command.source?.title,
            when,
            contribution.documentation
          ));
          if (contribution.qualifiedName) {
            this.generateStandaloneOptionCommand(command.id, contribution.qualifiedName, contribution.category ?? command.category, when, contribution.remoteGroup);
          }
        }
      }
      this.continueEditSessionOptions = continueEditSessionOptions;
    });
  }
  generateStandaloneOptionCommand(commandId, qualifiedName, category, when, remoteGroup) {
    const command = {
      id: `${continueWorkingOnCommand.id}.${commandId}`,
      title: { original: qualifiedName, value: qualifiedName },
      category: typeof category === "string" ? { original: category, value: category } : category,
      precondition: when,
      f1: true
    };
    if (!this.registeredCommands.has(command.id)) {
      this.registeredCommands.add(command.id);
      this._register(registerAction2(class StandaloneContinueOnOption extends Action2 {
        constructor() {
          super(command);
        }
        async run(accessor) {
          return accessor.get(ICommandService).executeCommand(continueWorkingOnCommand.id, void 0, commandId);
        }
      }));
      if (remoteGroup !== void 0) {
        MenuRegistry.appendMenuItem(MenuId.StatusBarRemoteIndicatorMenu, {
          group: remoteGroup,
          command,
          when: command.precondition
        });
      }
    }
  }
  registerContinueInLocalFolderAction() {
    const that = this;
    this._register(registerAction2(class ContinueInLocalFolderAction extends Action2 {
      constructor() {
        super(openLocalFolderCommand);
      }
      async run(accessor) {
        const selection = await that.fileDialogService.showOpenDialog({
          title: localize("continueEditSession.openLocalFolder.title.v2", "Select a local folder to continue working in"),
          canSelectFolders: true,
          canSelectMany: false,
          canSelectFiles: false,
          availableFileSystems: [Schemas.file]
        });
        return selection?.length !== 1 ? void 0 : URI.from({
          scheme: that.productService.urlProtocol,
          authority: Schemas.file,
          path: selection[0].path
        });
      }
    }));
    if (getVirtualWorkspaceLocation(this.contextService.getWorkspace()) !== void 0 && isNative) {
      this.generateStandaloneOptionCommand(openLocalFolderCommand.id, localize("continueWorkingOn.existingLocalFolder", "Continue Working in Existing Local Folder"), void 0, openLocalFolderCommand.precondition, void 0);
    }
  }
  async pickContinueEditSessionDestination() {
    const disposables = new DisposableStore();
    const quickPick = disposables.add(this.quickInputService.createQuickPick({ useSeparators: true }));
    const workspaceContext = this.contextService.getWorkbenchState() === WorkbenchState.FOLDER ? this.contextService.getWorkspace().folders[0].name : this.contextService.getWorkspace().folders.map((folder) => folder.name).join(", ");
    quickPick.placeholder = localize("continueEditSessionPick.title.v2", "Select a development environment to continue working on {0} in", `'${workspaceContext}'`);
    quickPick.items = this.createPickItems();
    disposables.add(this.extensionService.onDidChangeExtensions(() => {
      quickPick.items = this.createPickItems();
    }));
    const command = await new Promise((resolve, reject) => {
      disposables.add(quickPick.onDidHide(() => {
        disposables.dispose();
        resolve(void 0);
      }));
      disposables.add(quickPick.onDidAccept((e) => {
        const selection = quickPick.activeItems[0].command;
        if (selection === installAdditionalContinueOnOptionsCommand.id) {
          void this.commandService.executeCommand(installAdditionalContinueOnOptionsCommand.id);
        } else {
          resolve(selection);
          quickPick.hide();
        }
      }));
      quickPick.show();
      disposables.add(quickPick.onDidTriggerItemButton(async (e) => {
        if (e.item.documentation !== void 0) {
          const uri = URI.isUri(e.item.documentation) ? URI.parse(e.item.documentation) : await this.commandService.executeCommand(e.item.documentation);
          if (uri) {
            void this.openerService.open(uri, { openExternal: true });
          }
        }
      }));
    });
    quickPick.dispose();
    return command;
  }
  async resolveDestination(command) {
    try {
      const uri = await this.commandService.executeCommand(command);
      if (uri === void 0) {
        this.telemetryService.publicLog2("continueOn.openDestination.outcome", { selection: command, outcome: "noDestinationUri" });
        return "noDestinationUri";
      }
      if (URI.isUri(uri)) {
        this.telemetryService.publicLog2("continueOn.openDestination.outcome", { selection: command, outcome: "resolvedUri" });
        return uri;
      }
      this.telemetryService.publicLog2("continueOn.openDestination.outcome", { selection: command, outcome: "invalidDestination" });
      return void 0;
    } catch (ex) {
      if (ex instanceof CancellationError) {
        this.telemetryService.publicLog2("continueOn.openDestination.outcome", { selection: command, outcome: "cancelled" });
      } else {
        this.telemetryService.publicLog2("continueOn.openDestination.outcome", { selection: command, outcome: "unknownError" });
      }
      return void 0;
    }
  }
  createPickItems() {
    const items = [...this.continueEditSessionOptions].filter((option) => option.when === void 0 || this.contextKeyService.contextMatchesRules(option.when));
    if (getVirtualWorkspaceLocation(this.contextService.getWorkspace()) !== void 0 && isNative) {
      items.push(new ContinueEditSessionItem(
        "$(folder) " + localize("continueEditSessionItem.openInLocalFolder.v2", "Open in Local Folder"),
        openLocalFolderCommand.id,
        localize("continueEditSessionItem.builtin", "Built-in")
      ));
    }
    const sortedItems = items.sort((item1, item2) => item1.label.localeCompare(item2.label));
    return sortedItems.concat({ type: "separator" }, new ContinueEditSessionItem(installAdditionalContinueOnOptionsCommand.title, installAdditionalContinueOnOptionsCommand.id));
  }
};
EditSessionsContribution = __decorateClass([
  __decorateParam(0, IEditSessionsStorageService),
  __decorateParam(1, IFileService),
  __decorateParam(2, IProgressService),
  __decorateParam(3, IOpenerService),
  __decorateParam(4, ITelemetryService),
  __decorateParam(5, ISCMService),
  __decorateParam(6, INotificationService),
  __decorateParam(7, IDialogService),
  __decorateParam(8, IEditSessionsLogService),
  __decorateParam(9, IEnvironmentService),
  __decorateParam(10, IInstantiationService),
  __decorateParam(11, IProductService),
  __decorateParam(12, IConfigurationService),
  __decorateParam(13, IWorkspaceContextService),
  __decorateParam(14, IEditSessionIdentityService),
  __decorateParam(15, IQuickInputService),
  __decorateParam(16, ICommandService),
  __decorateParam(17, IContextKeyService),
  __decorateParam(18, IFileDialogService),
  __decorateParam(19, ILifecycleService),
  __decorateParam(20, IStorageService),
  __decorateParam(21, IActivityService),
  __decorateParam(22, IEditorService),
  __decorateParam(23, IRemoteAgentService),
  __decorateParam(24, IExtensionService),
  __decorateParam(25, IRequestService),
  __decorateParam(26, IUserDataProfilesService),
  __decorateParam(27, IUriIdentityService),
  __decorateParam(28, IWorkspaceIdentityService)
], EditSessionsContribution);
const infoButtonClass = ThemeIcon.asClassName(Codicon.info);
class ContinueEditSessionItem {
  constructor(label, command, description, when, documentation) {
    this.label = label;
    this.command = command;
    this.description = description;
    this.when = when;
    this.documentation = documentation;
    if (documentation !== void 0) {
      this.buttons = [{
        iconClass: infoButtonClass,
        tooltip: localize("learnMoreTooltip", "Learn More")
      }];
    }
  }
}
const continueEditSessionExtPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "continueEditSession",
  jsonSchema: {
    description: localize("continueEditSessionExtPoint", "Contributes options for continuing the current edit session in a different environment"),
    type: "array",
    items: {
      type: "object",
      properties: {
        command: {
          description: localize("continueEditSessionExtPoint.command", "Identifier of the command to execute. The command must be declared in the 'commands'-section and return a URI representing a different environment where the current edit session can be continued."),
          type: "string"
        },
        group: {
          description: localize("continueEditSessionExtPoint.group", "Group into which this item belongs."),
          type: "string"
        },
        qualifiedName: {
          description: localize("continueEditSessionExtPoint.qualifiedName", "A fully qualified name for this item which is used for display in menus."),
          type: "string"
        },
        description: {
          description: localize("continueEditSessionExtPoint.description", "The url, or a command that returns the url, to the option's documentation page."),
          type: "string"
        },
        remoteGroup: {
          description: localize("continueEditSessionExtPoint.remoteGroup", "Group into which this item belongs in the remote indicator."),
          type: "string"
        },
        when: {
          description: localize("continueEditSessionExtPoint.when", "Condition which must be true to show this item."),
          type: "string"
        }
      },
      required: ["command"]
    }
  }
});
const workbenchRegistry = Registry.as(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(EditSessionsContribution, LifecyclePhase.Restored);
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  ...workbenchConfigurationNodeBase,
  "properties": {
    "workbench.experimental.cloudChanges.autoStore": {
      enum: ["onShutdown", "off"],
      enumDescriptions: [
        localize("autoStoreWorkingChanges.onShutdown", "Automatically store current working changes in the cloud on window close."),
        localize("autoStoreWorkingChanges.off", "Never attempt to automatically store working changes in the cloud.")
      ],
      "type": "string",
      "tags": ["experimental", "usesOnlineServices"],
      "default": "off",
      "markdownDescription": localize("autoStoreWorkingChangesDescription", "Controls whether to automatically store available working changes in the cloud for the current workspace. This setting has no effect in the web.")
    },
    "workbench.cloudChanges.autoResume": {
      enum: ["onReload", "off"],
      enumDescriptions: [
        localize("autoResumeWorkingChanges.onReload", "Automatically resume available working changes from the cloud on window reload."),
        localize("autoResumeWorkingChanges.off", "Never attempt to resume working changes from the cloud.")
      ],
      "type": "string",
      "tags": ["usesOnlineServices"],
      "default": "onReload",
      "markdownDescription": localize("autoResumeWorkingChanges", "Controls whether to automatically resume available working changes stored in the cloud for the current workspace.")
    },
    "workbench.cloudChanges.continueOn": {
      enum: ["prompt", "off"],
      enumDescriptions: [
        localize("continueOnCloudChanges.promptForAuth", "Prompt the user to sign in to store working changes in the cloud with Continue Working On."),
        localize("continueOnCloudChanges.off", "Do not store working changes in the cloud with Continue Working On unless the user has already turned on Cloud Changes.")
      ],
      type: "string",
      tags: ["usesOnlineServices"],
      default: "prompt",
      markdownDescription: localize("continueOnCloudChanges", "Controls whether to prompt the user to store working changes in the cloud when using Continue Working On.")
    },
    "workbench.experimental.cloudChanges.partialMatches.enabled": {
      "type": "boolean",
      "tags": ["experimental", "usesOnlineServices"],
      "default": false,
      "markdownDescription": localize("cloudChangesPartialMatchesEnabled", "Controls whether to surface cloud changes which partially match the current session.")
    }
  }
});
export {
  EditSessionsContribution
};
