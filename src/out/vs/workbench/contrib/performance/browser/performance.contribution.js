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
import { EventProfiling } from "../../../../base/common/event.js";
import { GCBasedDisposableTracker, setDisposableTracker } from "../../../../base/common/lifecycle.js";
import { env } from "../../../../base/common/process.js";
import { localize, localize2 } from "../../../../nls.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { Extensions as ConfigExt } from "../../../../platform/configuration/common/configurationRegistry.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { InstantiationService, Trace } from "../../../../platform/instantiation/common/instantiationService.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions, registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import { EditorExtensions } from "../../../common/editor.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { InputLatencyContrib } from "./inputLatencyContrib.js";
import { PerfviewContrib, PerfviewInput } from "./perfviewEditor.js";
registerWorkbenchContribution2(
  PerfviewContrib.ID,
  PerfviewContrib,
  { lazy: true }
);
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(
  PerfviewInput.Id,
  class {
    canSerialize() {
      return true;
    }
    serialize() {
      return "";
    }
    deserialize(instantiationService) {
      return instantiationService.createInstance(PerfviewInput);
    }
  }
);
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "perfview.show",
      title: localize2("show.label", "Startup Performance"),
      category: Categories.Developer,
      f1: true
    });
  }
  run(accessor) {
    const editorService = accessor.get(IEditorService);
    const contrib = PerfviewContrib.get();
    return editorService.openEditor(contrib.getEditorInput(), { pinned: true });
  }
});
registerAction2(class PrintServiceCycles extends Action2 {
  constructor() {
    super({
      id: "perf.insta.printAsyncCycles",
      title: localize2("cycles", "Print Service Cycles"),
      category: Categories.Developer,
      f1: true
    });
  }
  run(accessor) {
    const instaService = accessor.get(IInstantiationService);
    if (instaService instanceof InstantiationService) {
      const cycle = instaService._globalGraph?.findCycleSlow();
      if (cycle) {
        console.warn(`CYCLE`, cycle);
      } else {
        console.warn(`YEAH, no more cycles`);
      }
    }
  }
});
registerAction2(class PrintServiceTraces extends Action2 {
  constructor() {
    super({
      id: "perf.insta.printTraces",
      title: localize2("insta.trace", "Print Service Traces"),
      category: Categories.Developer,
      f1: true
    });
  }
  run() {
    if (Trace.all.size === 0) {
      console.log("Enable via `instantiationService.ts#_enableAllTracing`");
      return;
    }
    for (const item of Trace.all) {
      console.log(item);
    }
  }
});
registerAction2(class PrintEventProfiling extends Action2 {
  constructor() {
    super({
      id: "perf.event.profiling",
      title: localize2("emitter", "Print Emitter Profiles"),
      category: Categories.Developer,
      f1: true
    });
  }
  run() {
    if (EventProfiling.all.size === 0) {
      console.log("USE `EmitterOptions._profName` to enable profiling");
      return;
    }
    for (const item of EventProfiling.all) {
      console.log(`${item.name}: ${item.invocationCount} invocations COST ${item.elapsedOverall}ms, ${item.listenerCount} listeners, avg cost is ${item.durations.reduce((a, b) => a + b, 0) / item.durations.length}ms`);
    }
  }
});
Registry.as(Extensions.Workbench).registerWorkbenchContribution(
  InputLatencyContrib,
  LifecyclePhase.Eventually
);
Registry.as(ConfigExt.Configuration).registerConfiguration({
  id: "performance",
  order: 101,
  title: localize("performanceConfigurationTitle", "Performance"),
  type: "object",
  properties: {
    "telemetry.performance.inputLatencySamplingProbability": {
      type: "number",
      default: 0,
      minimum: 0,
      maximum: 1,
      tags: ["experimental"],
      markdownDescription: localize("telemetry.performance.inputLatencySamplingProbability", "Probability (0 to 1) that input latency telemetry is reported for this session. Set to 0 to disable, 1 to always report."),
      experiment: {
        mode: "auto"
      }
    }
  }
});
let DisposableTracking = class {
  static {
    this.Id = "perf.disposableTracking";
  }
  constructor(envService) {
    if (!envService.isBuilt && !envService.extensionTestsLocationURI && !env["VSCODE_DEV_DISABLE_DISPOSABLE_TRACKING"]) {
      setDisposableTracker(new GCBasedDisposableTracker());
    }
  }
};
DisposableTracking = __decorateClass([
  __decorateParam(0, IEnvironmentService)
], DisposableTracking);
registerWorkbenchContribution2(DisposableTracking.Id, DisposableTracking, WorkbenchPhase.Eventually);
