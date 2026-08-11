import { registerAction2 } from "../../platform/actions/common/actions.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../workbench/common/contributions.js";
import { OpenInVSCodeAction, OpenInVSCodeWidgetContribution } from "./actions/vscodeActions.js";
(function registerActions() {
  registerAction2(OpenInVSCodeAction);
})();
(function registerWorkbenchContributions() {
  registerWorkbenchContribution2(OpenInVSCodeWidgetContribution.ID, OpenInVSCodeWidgetContribution, WorkbenchPhase.BlockRestore);
})();
