import { registerMainProcessRemoteService } from "../../../../platform/ipc/electron-browser/services.js";
import { IProcessService } from "../../../../platform/process/common/process.js";
registerMainProcessRemoteService(IProcessService, "process");
