import "./localHistoryCommands.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { LocalHistoryTimeline } from "./localHistoryTimeline.js";
registerWorkbenchContribution2(
  LocalHistoryTimeline.ID,
  LocalHistoryTimeline,
  WorkbenchPhase.BlockRestore
  /* registrations only */
);
