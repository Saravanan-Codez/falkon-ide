import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../workbench/common/contributions.js";
import { SessionBrowserViewController } from "./sessionBrowserView.js";
registerWorkbenchContribution2(SessionBrowserViewController.ID, SessionBrowserViewController, WorkbenchPhase.AfterRestored);
