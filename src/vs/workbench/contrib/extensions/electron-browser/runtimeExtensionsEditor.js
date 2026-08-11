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
import { VSBuffer } from "../../../../base/common/buffer.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Schemas } from "../../../../base/common/network.js";
import { joinPath } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import * as nls from "../../../../nls.js";
import { Action2, IMenuService, MenuId } from "../../../../platform/actions/common/actions.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService, createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { Utils } from "../../../../platform/profiling/common/profiling.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ActiveEditorContext } from "../../../common/contextkeys.js";
import { IEditorService, SIDE_GROUP } from "../../../services/editor/common/editorService.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { IExtensionFeaturesManagementService } from "../../../services/extensionManagement/common/extensionFeatures.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { AbstractRuntimeExtensionsEditor } from "../browser/abstractRuntimeExtensionsEditor.js";
import { IExtensionsWorkbenchService } from "../common/extensions.js";
import { ReportExtensionIssueAction } from "../common/reportExtensionIssueAction.js";
import { SlowExtensionAction } from "./extensionsSlowActions.js";
const IExtensionHostProfileService = createDecorator("extensionHostProfileService");
const CONTEXT_PROFILE_SESSION_STATE = new RawContextKey("profileSessionState", "none");
const CONTEXT_EXTENSION_HOST_PROFILE_RECORDED = new RawContextKey("extensionHostProfileRecorded", false);
var ProfileSessionState = /* @__PURE__ */ ((ProfileSessionState2) => {
  ProfileSessionState2[ProfileSessionState2["None"] = 0] = "None";
  ProfileSessionState2[ProfileSessionState2["Starting"] = 1] = "Starting";
  ProfileSessionState2[ProfileSessionState2["Running"] = 2] = "Running";
  ProfileSessionState2[ProfileSessionState2["Stopping"] = 3] = "Stopping";
  return ProfileSessionState2;
})(ProfileSessionState || {});
let RuntimeExtensionsEditor = class extends AbstractRuntimeExtensionsEditor {
  constructor(group, telemetryService, themeService, contextKeyService, extensionsWorkbenchService, extensionService, notificationService, contextMenuService, instantiationService, storageService, labelService, environmentService, clipboardService, _extensionHostProfileService, extensionFeaturesManagementService, hoverService, menuService) {
    super(group, telemetryService, themeService, contextKeyService, extensionsWorkbenchService, extensionService, notificationService, contextMenuService, instantiationService, storageService, labelService, environmentService, clipboardService, extensionFeaturesManagementService, hoverService, menuService);
    this._extensionHostProfileService = _extensionHostProfileService;
    this._profileInfo = this._extensionHostProfileService.lastProfile;
    this._extensionsHostRecorded = CONTEXT_EXTENSION_HOST_PROFILE_RECORDED.bindTo(contextKeyService);
    this._profileSessionState = CONTEXT_PROFILE_SESSION_STATE.bindTo(contextKeyService);
    this._register(this._extensionHostProfileService.onDidChangeLastProfile(() => {
      this._profileInfo = this._extensionHostProfileService.lastProfile;
      this._extensionsHostRecorded.set(!!this._profileInfo);
      this._updateExtensions();
    }));
    this._register(this._extensionHostProfileService.onDidChangeState(() => {
      const state = this._extensionHostProfileService.state;
      this._profileSessionState.set(ProfileSessionState[state].toLowerCase());
    }));
  }
  _getProfileInfo() {
    return this._profileInfo;
  }
  _getUnresponsiveProfile(extensionId) {
    return this._extensionHostProfileService.getUnresponsiveProfile(extensionId);
  }
  _createSlowExtensionAction(element) {
    if (element.unresponsiveProfile) {
      return this._instantiationService.createInstance(SlowExtensionAction, element.description, element.unresponsiveProfile);
    }
    return null;
  }
  _createReportExtensionIssueAction(element) {
    if (element.marketplaceInfo) {
      return this._instantiationService.createInstance(ReportExtensionIssueAction, element.description);
    }
    return null;
  }
};
RuntimeExtensionsEditor = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IExtensionsWorkbenchService),
  __decorateParam(5, IExtensionService),
  __decorateParam(6, INotificationService),
  __decorateParam(7, IContextMenuService),
  __decorateParam(8, IInstantiationService),
  __decorateParam(9, IStorageService),
  __decorateParam(10, ILabelService),
  __decorateParam(11, IWorkbenchEnvironmentService),
  __decorateParam(12, IClipboardService),
  __decorateParam(13, IExtensionHostProfileService),
  __decorateParam(14, IExtensionFeaturesManagementService),
  __decorateParam(15, IHoverService),
  __decorateParam(16, IMenuService)
], RuntimeExtensionsEditor);
class StartExtensionHostProfileAction extends Action2 {
  static {
    this.ID = "workbench.extensions.action.extensionHostProfile";
  }
  static {
    this.LABEL = nls.localize("extensionHostProfileStart", "Start Extension Host Profile");
  }
  constructor() {
    super({
      id: StartExtensionHostProfileAction.ID,
      title: { value: StartExtensionHostProfileAction.LABEL, original: "Start Extension Host Profile" },
      precondition: CONTEXT_PROFILE_SESSION_STATE.isEqualTo("none"),
      icon: Codicon.circleFilled,
      menu: [{
        id: MenuId.EditorTitle,
        when: ContextKeyExpr.and(ActiveEditorContext.isEqualTo(RuntimeExtensionsEditor.ID), CONTEXT_PROFILE_SESSION_STATE.notEqualsTo("running")),
        group: "navigation"
      }, {
        id: MenuId.ExtensionEditorContextMenu,
        when: CONTEXT_PROFILE_SESSION_STATE.notEqualsTo("running"),
        group: "profiling"
      }]
    });
  }
  run(accessor) {
    const extensionHostProfileService = accessor.get(IExtensionHostProfileService);
    extensionHostProfileService.startProfiling();
    return Promise.resolve();
  }
}
class StopExtensionHostProfileAction extends Action2 {
  static {
    this.ID = "workbench.extensions.action.stopExtensionHostProfile";
  }
  static {
    this.LABEL = nls.localize("stopExtensionHostProfileStart", "Stop Extension Host Profile");
  }
  constructor() {
    super({
      id: StopExtensionHostProfileAction.ID,
      title: { value: StopExtensionHostProfileAction.LABEL, original: "Stop Extension Host Profile" },
      icon: Codicon.debugStop,
      menu: [{
        id: MenuId.EditorTitle,
        when: ContextKeyExpr.and(ActiveEditorContext.isEqualTo(RuntimeExtensionsEditor.ID), CONTEXT_PROFILE_SESSION_STATE.isEqualTo("running")),
        group: "navigation"
      }, {
        id: MenuId.ExtensionEditorContextMenu,
        when: CONTEXT_PROFILE_SESSION_STATE.isEqualTo("running"),
        group: "profiling"
      }]
    });
  }
  run(accessor) {
    const extensionHostProfileService = accessor.get(IExtensionHostProfileService);
    extensionHostProfileService.stopProfiling();
    return Promise.resolve();
  }
}
class OpenExtensionHostProfileACtion extends Action2 {
  static {
    this.LABEL = nls.localize("openExtensionHostProfile", "Open Extension Host Profile");
  }
  static {
    this.ID = "workbench.extensions.action.openExtensionHostProfile";
  }
  constructor() {
    super({
      id: OpenExtensionHostProfileACtion.ID,
      title: { value: OpenExtensionHostProfileACtion.LABEL, original: "Open Extension Host Profile" },
      precondition: CONTEXT_EXTENSION_HOST_PROFILE_RECORDED,
      icon: Codicon.graph,
      menu: [{
        id: MenuId.EditorTitle,
        when: ContextKeyExpr.and(ActiveEditorContext.isEqualTo(RuntimeExtensionsEditor.ID)),
        group: "navigation"
      }, {
        id: MenuId.ExtensionEditorContextMenu,
        when: CONTEXT_EXTENSION_HOST_PROFILE_RECORDED,
        group: "profiling"
      }]
    });
  }
  async run(accessor) {
    const extensionHostProfileService = accessor.get(IExtensionHostProfileService);
    const commandService = accessor.get(ICommandService);
    const editorService = accessor.get(IEditorService);
    if (!extensionHostProfileService.lastProfileSavedTo) {
      await commandService.executeCommand(SaveExtensionHostProfileAction.ID);
    }
    if (!extensionHostProfileService.lastProfileSavedTo) {
      return;
    }
    await editorService.openEditor({
      resource: extensionHostProfileService.lastProfileSavedTo,
      options: {
        revealIfOpened: true,
        override: "jsProfileVisualizer.cpuprofile.table"
      }
    }, SIDE_GROUP);
  }
}
class SaveExtensionHostProfileAction extends Action2 {
  static {
    this.LABEL = nls.localize("saveExtensionHostProfile", "Save Extension Host Profile");
  }
  static {
    this.ID = "workbench.extensions.action.saveExtensionHostProfile";
  }
  constructor() {
    super({
      id: SaveExtensionHostProfileAction.ID,
      title: { value: SaveExtensionHostProfileAction.LABEL, original: "Save Extension Host Profile" },
      precondition: CONTEXT_EXTENSION_HOST_PROFILE_RECORDED,
      icon: Codicon.saveAll,
      menu: [{
        id: MenuId.EditorTitle,
        when: ContextKeyExpr.and(ActiveEditorContext.isEqualTo(RuntimeExtensionsEditor.ID)),
        group: "navigation"
      }, {
        id: MenuId.ExtensionEditorContextMenu,
        when: CONTEXT_EXTENSION_HOST_PROFILE_RECORDED,
        group: "profiling"
      }]
    });
  }
  run(accessor) {
    const environmentService = accessor.get(IWorkbenchEnvironmentService);
    const extensionHostProfileService = accessor.get(IExtensionHostProfileService);
    const fileService = accessor.get(IFileService);
    const fileDialogService = accessor.get(IFileDialogService);
    return this._asyncRun(environmentService, extensionHostProfileService, fileService, fileDialogService);
  }
  async _asyncRun(environmentService, extensionHostProfileService, fileService, fileDialogService) {
    const picked = await fileDialogService.showSaveDialog({
      title: nls.localize("saveprofile.dialogTitle", "Save Extension Host Profile"),
      availableFileSystems: [Schemas.file],
      defaultUri: joinPath(await fileDialogService.defaultFilePath(), `CPU-${(/* @__PURE__ */ new Date()).toISOString().replace(/[\-:]/g, "")}.cpuprofile`),
      filters: [{
        name: "CPU Profiles",
        extensions: ["cpuprofile", "txt"]
      }]
    });
    if (!picked) {
      return;
    }
    const profileInfo = extensionHostProfileService.lastProfile;
    let dataToWrite = profileInfo ? profileInfo.data : {};
    let savePath = picked.fsPath;
    if (environmentService.isBuilt) {
      dataToWrite = Utils.rewriteAbsolutePaths(dataToWrite, "piiRemoved");
      savePath = savePath + ".txt";
    }
    const saveURI = URI.file(savePath);
    extensionHostProfileService.lastProfileSavedTo = saveURI;
    return fileService.writeFile(saveURI, VSBuffer.fromString(JSON.stringify(profileInfo ? profileInfo.data : {}, null, "	")));
  }
}
export {
  CONTEXT_EXTENSION_HOST_PROFILE_RECORDED,
  CONTEXT_PROFILE_SESSION_STATE,
  IExtensionHostProfileService,
  OpenExtensionHostProfileACtion,
  ProfileSessionState,
  RuntimeExtensionsEditor,
  SaveExtensionHostProfileAction,
  StartExtensionHostProfileAction,
  StopExtensionHostProfileAction
};
