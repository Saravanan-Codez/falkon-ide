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
import { isCodeEditor } from "../../../../editor/browser/editorBrowser.js";
import { ILifecycleService, StartupKind, StartupKindToString } from "../../../services/lifecycle/common/lifecycle.js";
import { IUpdateService } from "../../../../platform/update/common/update.js";
import * as files from "../../files/common/files.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IWorkspaceTrustManagementService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { IPaneCompositePartService } from "../../../services/panecomposite/browser/panecomposite.js";
import { ViewContainerLocation } from "../../../common/views.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IBrowserWorkbenchEnvironmentService } from "../../../services/environment/browser/environmentService.js";
import { ITimerService } from "../../../services/timer/browser/timerService.js";
import { posix } from "../../../../base/common/path.js";
import { hash } from "../../../../base/common/hash.js";
let StartupTimings = class {
  constructor(_editorService, _paneCompositeService, _lifecycleService, _updateService, _workspaceTrustService) {
    this._editorService = _editorService;
    this._paneCompositeService = _paneCompositeService;
    this._lifecycleService = _lifecycleService;
    this._updateService = _updateService;
    this._workspaceTrustService = _workspaceTrustService;
  }
  async _isStandardStartup() {
    if (this._lifecycleService.startupKind !== StartupKind.NewWindow) {
      return StartupKindToString(this._lifecycleService.startupKind);
    }
    if (!this._workspaceTrustService.isWorkspaceTrusted()) {
      return "Workspace not trusted";
    }
    const activeViewlet = this._paneCompositeService.getActivePaneComposite(ViewContainerLocation.Sidebar);
    if (!activeViewlet || activeViewlet.getId() !== files.VIEWLET_ID) {
      return "Explorer viewlet not visible";
    }
    const visibleEditorPanes = this._editorService.visibleEditorPanes;
    if (visibleEditorPanes.length !== 1) {
      return `Expected text editor count : 1, Actual : ${visibleEditorPanes.length}`;
    }
    if (!isCodeEditor(visibleEditorPanes[0].getControl())) {
      return "Active editor is not a text editor";
    }
    const activePanel = this._paneCompositeService.getActivePaneComposite(ViewContainerLocation.Panel);
    if (activePanel) {
      return `Current active panel : ${this._paneCompositeService.getPaneComposite(activePanel.getId(), ViewContainerLocation.Panel)?.name}`;
    }
    const isLatestVersion = await this._updateService.isLatestVersion();
    if (isLatestVersion === false) {
      return "Not on latest version, updates available";
    }
    return void 0;
  }
};
StartupTimings = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IPaneCompositePartService),
  __decorateParam(2, ILifecycleService),
  __decorateParam(3, IUpdateService),
  __decorateParam(4, IWorkspaceTrustManagementService)
], StartupTimings);
let BrowserStartupTimings = class extends StartupTimings {
  constructor(editorService, paneCompositeService, lifecycleService, updateService, workspaceTrustService, timerService, logService, environmentService, telemetryService, productService) {
    super(editorService, paneCompositeService, lifecycleService, updateService, workspaceTrustService);
    this.timerService = timerService;
    this.logService = logService;
    this.environmentService = environmentService;
    this.telemetryService = telemetryService;
    this.productService = productService;
    this.logPerfMarks();
  }
  async logPerfMarks() {
    if (!this.environmentService.profDurationMarkers) {
      return;
    }
    await this.timerService.whenReady();
    const standardStartupError = await this._isStandardStartup();
    const perfBaseline = await this.timerService.perfBaseline;
    const [from, to] = this.environmentService.profDurationMarkers;
    const content = `${this.timerService.getDuration(from, to)}	${this.productService.nameShort}	${(this.productService.commit || "").slice(0, 10) || "0000000000"}	${this.telemetryService.sessionId}	${standardStartupError === void 0 ? "standard_start" : "NO_standard_start : " + standardStartupError}	${String(perfBaseline).padStart(4, "0")}ms
`;
    this.logService.info(`[prof-timers] ${content}`);
  }
};
BrowserStartupTimings = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IPaneCompositePartService),
  __decorateParam(2, ILifecycleService),
  __decorateParam(3, IUpdateService),
  __decorateParam(4, IWorkspaceTrustManagementService),
  __decorateParam(5, ITimerService),
  __decorateParam(6, ILogService),
  __decorateParam(7, IBrowserWorkbenchEnvironmentService),
  __decorateParam(8, ITelemetryService),
  __decorateParam(9, IProductService)
], BrowserStartupTimings);
let BrowserResourcePerformanceMarks = class {
  constructor(telemetryService) {
    for (const item of performance.getEntriesByType("resource")) {
      try {
        const url = new URL(item.name);
        const name = posix.basename(url.pathname);
        telemetryService.publicLog2("startup.resource.perf", {
          hosthash: `H${hash(url.host).toString(16)}`,
          name,
          duration: item.duration
        });
      } catch {
      }
    }
  }
};
BrowserResourcePerformanceMarks = __decorateClass([
  __decorateParam(0, ITelemetryService)
], BrowserResourcePerformanceMarks);
export {
  BrowserResourcePerformanceMarks,
  BrowserStartupTimings,
  StartupTimings
};
