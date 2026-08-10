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
import { IMenuService } from "../../../../platform/actions/common/actions.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import product from "../../../../platform/product/common/product.js";
import { MutableDisposable } from "../../../../base/common/lifecycle.js";
import { IAuxiliaryWindowService } from "../../../services/auxiliaryWindow/browser/auxiliaryWindowService.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { IssueFormService } from "../browser/issueFormService.js";
import { IGitHubUploadService } from "../browser/githubUploadService.js";
import { IssueReporterEditorInput } from "../browser/issueReporterEditorInput.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IssueReporter } from "./issueReporterService.js";
let NativeIssueFormService = class extends IssueFormService {
  constructor(instantiationService, auxiliaryWindowService, logService, dialogService, menuService, contextKeyService, hostService, openerService, fileService, environmentService, githubUploadService, configurationService, editorService, clipboardService, nativeHostService, editorGroupService) {
    super(instantiationService, auxiliaryWindowService, menuService, contextKeyService, logService, dialogService, hostService, openerService, fileService, githubUploadService, editorService, clipboardService);
    this.environmentService = environmentService;
    this.configurationService = configurationService;
    this.nativeHostService = nativeHostService;
    this.editorGroupService = editorGroupService;
    /**
     * Holds the currently-rendered legacy IssueReporter so its listeners on long-lived services
     * (e.g. authentication onDidChangeSessions) are released when the aux window closes or a new
     * reporter is opened.
     */
    this.legacyReporter = this._register(new MutableDisposable());
  }
  async openReporter(data) {
    if (this.hasToReload(data)) {
      return;
    }
    const useWizard = this.configurationService.getValue("issueReporter.wizard.enabled");
    if (!useWizard) {
      const { arch, release, type } = await this.nativeHostService.getOSProperties();
      this.arch = arch;
      this.release = release;
      this.type = type;
      return this.openAuxIssueReporterLegacy(data);
    }
    const input = this.instantiationService.createInstance(IssueReporterEditorInput, data);
    const preferredGroup = data.isSessionsWindow ? this.editorGroupService.mainPart.activeGroup : void 0;
    await this.editorService.openEditor(input, { pinned: true }, preferredGroup);
  }
  /**
   * Desktop legacy path uses the native `IssueReporter` (so it can populate
   * system/performance info via `IProcessService`) and centers the auxiliary
   * window on the active window via `getActiveWindowPosition()`.
   */
  async openAuxIssueReporterLegacy(data) {
    const bounds = await this.nativeHostService.getActiveWindowPosition();
    await this.openAuxIssueReporter(data, bounds);
    if (this.issueReporterWindow) {
      const issueReporter = this.instantiationService.createInstance(
        IssueReporter,
        !!this.environmentService.disableExtensions,
        data,
        { type: this.type, arch: this.arch, release: this.release },
        product,
        this.issueReporterWindow
      );
      this.legacyReporter.value = issueReporter;
      this.issueReporterWindow.addEventListener("beforeunload", () => this.legacyReporter.clear(), { once: true });
      issueReporter.render();
    }
  }
};
NativeIssueFormService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IAuxiliaryWindowService),
  __decorateParam(2, ILogService),
  __decorateParam(3, IDialogService),
  __decorateParam(4, IMenuService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IHostService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, IFileService),
  __decorateParam(9, IEnvironmentService),
  __decorateParam(10, IGitHubUploadService),
  __decorateParam(11, IConfigurationService),
  __decorateParam(12, IEditorService),
  __decorateParam(13, IClipboardService),
  __decorateParam(14, INativeHostService),
  __decorateParam(15, IEditorGroupsService)
], NativeIssueFormService);
export {
  NativeIssueFormService
};
