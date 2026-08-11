import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import { AccountPolicyGateContribution } from "./accountPolicyGateContribution.js";
registerWorkbenchContribution2(AccountPolicyGateContribution.ID, AccountPolicyGateContribution, WorkbenchPhase.AfterRestored);
