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
import { timeout } from "../../../../base/common/async.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { joinPath } from "../../../../base/common/resources.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { IProfileAnalysisWorkerService, ProfilingOutput } from "../../../../platform/profiling/electron-browser/profileAnalysisWorkerService.js";
import { INativeWorkbenchEnvironmentService } from "../../../services/environment/electron-browser/environmentService.js";
import { parseExtensionDevOptions } from "../../../services/extensions/common/extensionDevOptions.js";
import { ITimerService } from "../../../services/timer/browser/timerService.js";
let RendererProfiling = class {
  constructor(_environmentService, _fileService, _logService, nativeHostService, timerService, configService, profileAnalysisService) {
    this._environmentService = _environmentService;
    this._fileService = _fileService;
    this._logService = _logService;
    const devOpts = parseExtensionDevOptions(_environmentService);
    if (devOpts.isExtensionDevTestFromCli) {
      return;
    }
    timerService.perfBaseline.then((perfBaseline) => {
      (_environmentService.isBuilt ? _logService.info : _logService.trace).apply(_logService, [`[perf] Render performance baseline is ${perfBaseline}ms`]);
      if (perfBaseline < 0) {
        return;
      }
      const slowThreshold = perfBaseline * 10;
      const obs = new PerformanceObserver(async (list) => {
        obs.takeRecords();
        const maxDuration = list.getEntries().map((e) => e.duration).reduce((p, c) => Math.max(p, c), 0);
        if (maxDuration < slowThreshold) {
          return;
        }
        if (!configService.getValue("application.experimental.rendererProfiling")) {
          _logService.debug(`[perf] SLOW task detected (${maxDuration}ms) but renderer profiling is disabled via 'application.experimental.rendererProfiling'`);
          return;
        }
        const sessionId = generateUuid();
        _logService.warn(`[perf] Renderer reported VERY LONG TASK (${maxDuration}ms), starting profiling session '${sessionId}'`);
        obs.disconnect();
        for (let i = 0; i < 3; i++) {
          try {
            const profile = await nativeHostService.profileRenderer(sessionId, 5e3);
            const output = await profileAnalysisService.analyseBottomUp(profile, (_url) => "<<renderer>>", perfBaseline, true);
            if (output === ProfilingOutput.Interesting) {
              this._store(profile, sessionId);
              break;
            }
            timeout(15e3);
          } catch (err) {
            _logService.error(err);
            break;
          }
        }
        obs.observe({ entryTypes: ["longtask"] });
      });
      obs.observe({ entryTypes: ["longtask"] });
      this._observer = obs;
    });
  }
  dispose() {
    this._observer?.disconnect();
  }
  async _store(profile, sessionId) {
    const path = joinPath(this._environmentService.tmpDir, `renderer-${Math.random().toString(16).slice(2, 8)}.cpuprofile.json`);
    await this._fileService.writeFile(path, VSBuffer.fromString(JSON.stringify(profile)));
    this._logService.info(`[perf] stored profile to DISK '${path}'`, sessionId);
  }
};
RendererProfiling = __decorateClass([
  __decorateParam(0, INativeWorkbenchEnvironmentService),
  __decorateParam(1, IFileService),
  __decorateParam(2, ILogService),
  __decorateParam(3, INativeHostService),
  __decorateParam(4, ITimerService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IProfileAnalysisWorkerService)
], RendererProfiling);
export {
  RendererProfiling
};
