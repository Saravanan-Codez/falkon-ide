import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../common/contributions.js";
import { TerminalTelemetryContribution } from "./terminalTelemetry.js";
registerWorkbenchContribution2(TerminalTelemetryContribution.ID, TerminalTelemetryContribution, WorkbenchPhase.AfterRestored);
