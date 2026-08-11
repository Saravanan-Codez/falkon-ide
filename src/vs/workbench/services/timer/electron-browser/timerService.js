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
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { INativeWorkbenchEnvironmentService } from "../../environment/electron-browser/environmentService.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IExtensionService } from "../../extensions/common/extensions.js";
import { IUpdateService } from "../../../../platform/update/common/update.js";
import { ILifecycleService } from "../../lifecycle/common/lifecycle.js";
import { IEditorService } from "../../editor/common/editorService.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { AbstractTimerService, ITimerService } from "../browser/timerService.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { process } from "../../../../base/parts/sandbox/electron-browser/globals.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IWorkbenchLayoutService } from "../../layout/browser/layoutService.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IPaneCompositePartService } from "../../panecomposite/browser/panecomposite.js";
let TimerService = class extends AbstractTimerService {
  constructor(_nativeHostService, _environmentService, lifecycleService, contextService, extensionService, updateService, paneCompositeService, editorService, accessibilityService, telemetryService, layoutService, _productService, _storageService) {
    super(lifecycleService, contextService, extensionService, updateService, paneCompositeService, editorService, accessibilityService, telemetryService, layoutService);
    this._nativeHostService = _nativeHostService;
    this._environmentService = _environmentService;
    this._productService = _productService;
    this._storageService = _storageService;
    this.setPerformanceMarks("main", _environmentService.window.perfMarks);
  }
  _isInitialStartup() {
    return Boolean(this._environmentService.window.isInitialStartup);
  }
  _didUseCachedData() {
    return didUseCachedData(this._productService, this._storageService, this._environmentService);
  }
  _getWindowCount() {
    return this._nativeHostService.getWindowCount();
  }
  async _extendStartupInfo(info) {
    try {
      const [osProperties, osStatistics, virtualMachineHint, isARM64Emulated] = await Promise.all([
        this._nativeHostService.getOSProperties(),
        this._nativeHostService.getOSStatistics(),
        this._nativeHostService.getOSVirtualMachineHint(),
        this._nativeHostService.isRunningUnderARM64Translation()
      ]);
      info.totalmem = osStatistics.totalmem;
      info.freemem = osStatistics.freemem;
      info.platform = osProperties.platform;
      info.release = osProperties.release;
      info.arch = osProperties.arch;
      info.loadavg = osStatistics.loadavg;
      info.isARM64Emulated = isARM64Emulated;
      const processMemoryInfo = await process.getProcessMemoryInfo();
      info.meminfo = {
        workingSetSize: processMemoryInfo.residentSet,
        privateBytes: processMemoryInfo.private,
        sharedBytes: processMemoryInfo.shared
      };
      info.isVMLikelyhood = Math.round(virtualMachineHint * 100);
      const rawCpus = osProperties.cpus;
      if (rawCpus && rawCpus.length > 0) {
        info.cpus = { count: rawCpus.length, speed: rawCpus[0].speed, model: rawCpus[0].model };
      }
    } catch (error) {
    }
  }
  _shouldReportPerfMarks() {
    return super._shouldReportPerfMarks() || Boolean(this._environmentService.args["prof-append-timers"]);
  }
};
TimerService = __decorateClass([
  __decorateParam(0, INativeHostService),
  __decorateParam(1, INativeWorkbenchEnvironmentService),
  __decorateParam(2, ILifecycleService),
  __decorateParam(3, IWorkspaceContextService),
  __decorateParam(4, IExtensionService),
  __decorateParam(5, IUpdateService),
  __decorateParam(6, IPaneCompositePartService),
  __decorateParam(7, IEditorService),
  __decorateParam(8, IAccessibilityService),
  __decorateParam(9, ITelemetryService),
  __decorateParam(10, IWorkbenchLayoutService),
  __decorateParam(11, IProductService),
  __decorateParam(12, IStorageService)
], TimerService);
registerSingleton(ITimerService, TimerService, InstantiationType.Delayed);
const lastRunningCommitStorageKey = "perf/lastRunningCommit";
let _didUseCachedData = void 0;
function didUseCachedData(productService, storageService, environmentService) {
  if (typeof _didUseCachedData !== "boolean") {
    if (!environmentService.window.isCodeCaching || !productService.commit) {
      _didUseCachedData = false;
    } else if (storageService.get(lastRunningCommitStorageKey, StorageScope.APPLICATION) === productService.commit) {
      _didUseCachedData = true;
    } else {
      storageService.store(lastRunningCommitStorageKey, productService.commit, StorageScope.APPLICATION, StorageTarget.MACHINE);
      _didUseCachedData = false;
    }
  }
  return _didUseCachedData;
}
export {
  TimerService,
  didUseCachedData
};
