import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions } from "../../../common/contributions.js";
import { StartupProfiler } from "./startupProfiler.js";
import { NativeStartupTimings } from "./startupTimings.js";
import { RendererProfiling } from "./rendererAutoProfiler.js";
import { Extensions as ConfigExt } from "../../../../platform/configuration/common/configurationRegistry.js";
import { localize } from "../../../../nls.js";
import { applicationConfigurationNodeBase } from "../../../common/configuration.js";
Registry.as(Extensions.Workbench).registerWorkbenchContribution(
  RendererProfiling,
  LifecyclePhase.Eventually
);
Registry.as(Extensions.Workbench).registerWorkbenchContribution(
  StartupProfiler,
  LifecyclePhase.Restored
);
Registry.as(Extensions.Workbench).registerWorkbenchContribution(
  NativeStartupTimings,
  LifecyclePhase.Eventually
);
Registry.as(ConfigExt.Configuration).registerConfiguration({
  ...applicationConfigurationNodeBase,
  "properties": {
    "application.experimental.rendererProfiling": {
      type: "boolean",
      default: false,
      tags: ["experimental"],
      markdownDescription: localize("experimental.rendererProfiling", "When enabled, slow renderers are automatically profiled."),
      experiment: {
        mode: "startup"
      }
    }
  }
});
