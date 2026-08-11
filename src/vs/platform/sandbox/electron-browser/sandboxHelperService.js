import { registerMainProcessRemoteService } from "../../ipc/electron-browser/services.js";
import { ISandboxHelperService } from "../common/sandboxHelperService.js";
registerMainProcessRemoteService(ISandboxHelperService, "sandboxHelper");
