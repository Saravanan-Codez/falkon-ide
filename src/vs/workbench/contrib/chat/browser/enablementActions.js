import { Action } from "../../../../base/common/actions.js";
import { localize } from "../../../../nls.js";
import { WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { ContributionEnablementState, isContributionDisabled } from "../common/enablement.js";
function createEnablementActions(key, enablementModel, idPrefix) {
  return [
    new Action(
      `${idPrefix}.enable`,
      localize("enable", "Enable"),
      void 0,
      true,
      () => {
        enablementModel.setEnabled(key, ContributionEnablementState.EnabledProfile);
        return Promise.resolve();
      }
    ),
    new Action(
      `${idPrefix}.enableForWorkspace`,
      localize("enableForWorkspace", "Enable (Workspace)"),
      void 0,
      true,
      () => {
        enablementModel.setEnabled(key, ContributionEnablementState.EnabledWorkspace);
        return Promise.resolve();
      }
    ),
    new Action(
      `${idPrefix}.disable`,
      localize("disable", "Disable"),
      void 0,
      true,
      () => {
        enablementModel.setEnabled(key, ContributionEnablementState.DisabledProfile);
        return Promise.resolve();
      }
    ),
    new Action(
      `${idPrefix}.disableForWorkspace`,
      localize("disableForWorkspace", "Disable (Workspace)"),
      void 0,
      true,
      () => {
        enablementModel.setEnabled(key, ContributionEnablementState.DisabledWorkspace);
        return Promise.resolve();
      }
    )
  ];
}
function buildEnablementContextMenuGroup(enablementState, key, enablementModel, workspaceContextService, idPrefix) {
  const hasWorkspace = workspaceContextService.getWorkbenchState() !== WorkbenchState.EMPTY;
  const [enable, enableWorkspace, disable, disableWorkspace] = createEnablementActions(key, enablementModel, idPrefix);
  const actions = [];
  if (isContributionDisabled(enablementState)) {
    actions.push(enable);
    if (hasWorkspace) {
      actions.push(enableWorkspace);
    }
  } else {
    actions.push(disable);
    if (hasWorkspace) {
      actions.push(disableWorkspace);
    }
  }
  return actions;
}
export {
  buildEnablementContextMenuGroup,
  createEnablementActions
};
