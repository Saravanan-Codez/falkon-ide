import { registerSharedProcessRemoteService } from "../../ipc/electron-browser/services.js";
import { IV8InspectProfilingService } from "../common/profiling.js";
registerSharedProcessRemoteService(IV8InspectProfilingService, "v8InspectProfiling");
