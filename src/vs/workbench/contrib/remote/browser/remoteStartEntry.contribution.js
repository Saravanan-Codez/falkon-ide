import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { RemoteStartEntry } from "./remoteStartEntry.js";
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(RemoteStartEntry, LifecyclePhase.Restored);
