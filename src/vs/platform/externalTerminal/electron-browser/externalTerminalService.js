import { createDecorator } from "../../instantiation/common/instantiation.js";
import { registerMainProcessRemoteService } from "../../ipc/electron-browser/services.js";
const IExternalTerminalService = createDecorator("externalTerminal");
registerMainProcessRemoteService(IExternalTerminalService, "externalTerminal");
export {
  IExternalTerminalService
};
