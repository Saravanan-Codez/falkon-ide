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
import { localize, localize2 } from "../../../../nls.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { hasWorkspaceFileExtension, IWorkspaceContextService, WorkbenchState, WORKSPACE_SUFFIX } from "../../../../platform/workspace/common/workspace.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { INotificationService, NeverShowAgainScope, NotificationPriority, Severity } from "../../../../platform/notification/common/notification.js";
import { isEqual, joinPath } from "../../../../base/common/resources.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IStorageService, StorageScope } from "../../../../platform/storage/common/storage.js";
import { isVirtualWorkspace } from "../../../../platform/workspace/common/virtualWorkspace.js";
import { Action2, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ActiveEditorContext, IsSessionsWindowContext, ResourceContextKey, TemporaryWorkspaceContext } from "../../../common/contextkeys.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { TEXT_FILE_EDITOR_ID } from "../../files/common/files.js";
import "./recentRemoteFolderPruner.js";
let WorkspacesFinderContribution = class extends Disposable {
  constructor(contextService, notificationService, fileService, quickInputService, hostService, storageService) {
    super();
    this.contextService = contextService;
    this.notificationService = notificationService;
    this.fileService = fileService;
    this.quickInputService = quickInputService;
    this.hostService = hostService;
    this.storageService = storageService;
    this.findWorkspaces();
  }
  async findWorkspaces() {
    const folder = this.contextService.getWorkspace().folders[0];
    if (!folder || this.contextService.getWorkbenchState() !== WorkbenchState.FOLDER || isVirtualWorkspace(this.contextService.getWorkspace())) {
      return;
    }
    const rootFileNames = (await this.fileService.resolve(folder.uri)).children?.map((child) => child.name);
    if (Array.isArray(rootFileNames)) {
      const workspaceFiles = rootFileNames.filter(hasWorkspaceFileExtension);
      if (workspaceFiles.length > 0) {
        this.doHandleWorkspaceFiles(folder.uri, workspaceFiles);
      }
    }
  }
  doHandleWorkspaceFiles(folder, workspaces) {
    const neverShowAgain = { id: "workspaces.dontPromptToOpen", scope: NeverShowAgainScope.WORKSPACE, isSecondary: true };
    if (workspaces.length === 1) {
      const workspaceFile = workspaces[0];
      this.notificationService.prompt(Severity.Info, localize(
        {
          key: "foundWorkspace",
          comment: ['{Locked="]({1})"}']
        },
        "This folder contains a workspace file '{0}'. Do you want to open it? [Learn more]({1}) about workspace files.",
        workspaceFile,
        "https://go.microsoft.com/fwlink/?linkid=2025315"
      ), [{
        label: localize("openWorkspace", "Open Workspace"),
        run: () => this.hostService.openWindow([{ workspaceUri: joinPath(folder, workspaceFile) }])
      }], {
        neverShowAgain,
        priority: !this.storageService.isNew(StorageScope.WORKSPACE) ? NotificationPriority.SILENT : NotificationPriority.OPTIONAL
        // https://github.com/microsoft/vscode/issues/125315
      });
    } else if (workspaces.length > 1) {
      this.notificationService.prompt(Severity.Info, localize({
        key: "foundWorkspaces",
        comment: ['{Locked="]({0})"}']
      }, "This folder contains multiple workspace files. Do you want to open one? [Learn more]({0}) about workspace files.", "https://go.microsoft.com/fwlink/?linkid=2025315"), [{
        label: localize("selectWorkspace", "Select Workspace"),
        run: () => {
          this.quickInputService.pick(
            workspaces.map((workspace) => ({ label: workspace })),
            { placeHolder: localize("selectToOpen", "Select a workspace to open") }
          ).then((pick) => {
            if (pick) {
              this.hostService.openWindow([{ workspaceUri: joinPath(folder, pick.label) }]);
            }
          });
        }
      }], {
        neverShowAgain,
        priority: !this.storageService.isNew(StorageScope.WORKSPACE) ? NotificationPriority.SILENT : NotificationPriority.OPTIONAL
        // https://github.com/microsoft/vscode/issues/125315
      });
    }
  }
};
WorkspacesFinderContribution = __decorateClass([
  __decorateParam(0, IWorkspaceContextService),
  __decorateParam(1, INotificationService),
  __decorateParam(2, IFileService),
  __decorateParam(3, IQuickInputService),
  __decorateParam(4, IHostService),
  __decorateParam(5, IStorageService)
], WorkspacesFinderContribution);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(WorkspacesFinderContribution, LifecyclePhase.Eventually);
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.openWorkspaceFromEditor",
      title: localize2("openWorkspace", "Open Workspace"),
      f1: false,
      menu: {
        id: MenuId.EditorContent,
        when: ContextKeyExpr.and(
          ResourceContextKey.Extension.isEqualTo(WORKSPACE_SUFFIX),
          ActiveEditorContext.isEqualTo(TEXT_FILE_EDITOR_ID),
          TemporaryWorkspaceContext.toNegated(),
          IsSessionsWindowContext.toNegated()
        )
      }
    });
  }
  async run(accessor, uri) {
    const hostService = accessor.get(IHostService);
    const contextService = accessor.get(IWorkspaceContextService);
    const notificationService = accessor.get(INotificationService);
    if (contextService.getWorkbenchState() === WorkbenchState.WORKSPACE) {
      const workspaceConfiguration = contextService.getWorkspace().configuration;
      if (workspaceConfiguration && isEqual(workspaceConfiguration, uri)) {
        notificationService.info(localize("alreadyOpen", "This workspace is already open."));
        return;
      }
    }
    return hostService.openWindow([{ workspaceUri: uri }]);
  }
});
export {
  WorkspacesFinderContribution
};
