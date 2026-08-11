import { BaseLocalizationWorkbenchContribution } from "../common/localization.contribution.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
class WebLocalizationWorkbenchContribution extends BaseLocalizationWorkbenchContribution {
}
const workbenchRegistry = Registry.as(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(WebLocalizationWorkbenchContribution, LifecyclePhase.Eventually);
export {
  WebLocalizationWorkbenchContribution
};
