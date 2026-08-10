import { registerAction2 } from "../../platform/actions/common/actions.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../workbench/common/contributions.js";
import { OpenSessionInVSCodeAction, OpenInVSCodeWidgetContribution, OpenVSCodeWindowAction, ReturnToVSCodeEditorAction, ShouldShowReturnToVSCodeEditorAction } from "./actions/vscodeActions.js";
(function registerActions() {
  registerAction2(OpenSessionInVSCodeAction);
  registerAction2(OpenVSCodeWindowAction);
  registerAction2(ReturnToVSCodeEditorAction);
  registerAction2(ShouldShowReturnToVSCodeEditorAction);
})();
(function registerWorkbenchContributions() {
  registerWorkbenchContribution2(OpenInVSCodeWidgetContribution.ID, OpenInVSCodeWidgetContribution, WorkbenchPhase.BlockRestore);
})();
