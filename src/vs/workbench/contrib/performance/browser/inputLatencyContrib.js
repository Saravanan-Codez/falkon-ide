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
import { inputLatency } from "../../../../base/browser/performance.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { autorun, derived, throttledObservable } from "../../../../base/common/observable.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { observableConfigValue } from "../../../../platform/observable/common/platformObservableUtils.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
let InputLatencyContrib = class extends Disposable {
  constructor(_configurationService, _telemetryService) {
    super();
    this._configurationService = _configurationService;
    this._telemetryService = _telemetryService;
    const probability = observableConfigValue("telemetry.performance.inputLatencySamplingProbability", 0, this._configurationService);
    const sessionRandom = Math.random();
    const shouldReport = derived((reader) => sessionRandom < probability.read(reader));
    const throttled = throttledObservable(
      derived((reader) => ({ sampleCount: inputLatency.sampleCount.read(reader), shouldReport: shouldReport.read(reader) })),
      6e4
    );
    this._register(autorun((reader) => {
      const { shouldReport: shouldReport2 } = throttled.read(reader);
      const measurements = inputLatency.getAndClearMeasurements();
      if (!measurements) {
        return;
      }
      if (shouldReport2) {
        this._logSamples(measurements);
      }
    }));
  }
  _logSamples(measurements) {
    const memory = performance.memory;
    const usedJSHeapSize = memory?.usedJSHeapSize ?? -1;
    const jsHeapSizeLimit = memory?.jsHeapSizeLimit ?? -1;
    const jsHeapUsagePercentage = usedJSHeapSize >= 0 && jsHeapSizeLimit > 0 ? Math.round(usedJSHeapSize / jsHeapSizeLimit * 100) : -1;
    this._telemetryService.publicLog2("performance.inputLatency", {
      keydown: measurements.keydown,
      input: measurements.input,
      render: measurements.render,
      total: measurements.total,
      sampleCount: measurements.sampleCount,
      gpuAcceleration: this._configurationService.getValue("editor.experimentalGpuAcceleration") === "on",
      usedJSHeapSize,
      jsHeapSizeLimit,
      jsHeapUsagePercentage
    });
  }
};
InputLatencyContrib = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, ITelemetryService)
], InputLatencyContrib);
export {
  InputLatencyContrib
};
