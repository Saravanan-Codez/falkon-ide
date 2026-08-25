import { registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ExportAgentHostDebugLogsAction } from "./actions/exportAgentHostDebugLogsAction.js";
import { ForkConversationAction } from "./actions/chatForkActions.js";
registerAction2(ForkConversationAction);
registerAction2(ExportAgentHostDebugLogsAction);
