import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import { McpServersViewsContribution } from "./mcpServersView.js";
registerWorkbenchContribution2(McpServersViewsContribution.ID, McpServersViewsContribution, WorkbenchPhase.AfterRestored);
