import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions } from "../../../common/contributions.js";
import { BrowserResourcePerformanceMarks, BrowserStartupTimings } from "./startupTimings.js";
Registry.as(Extensions.Workbench).registerWorkbenchContribution(
  BrowserResourcePerformanceMarks,
  LifecyclePhase.Eventually
);
Registry.as(Extensions.Workbench).registerWorkbenchContribution(
  BrowserStartupTimings,
  LifecyclePhase.Eventually
);
