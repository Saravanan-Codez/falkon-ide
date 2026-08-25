import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../workbench/common/contributions.js";
import { WorkspaceFolderManagementContribution } from "./workspaceFolderManagement.js";
registerWorkbenchContribution2(WorkspaceFolderManagementContribution.ID, WorkspaceFolderManagementContribution, WorkbenchPhase.AfterRestored);
