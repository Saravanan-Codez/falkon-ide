import { IMenubarService } from "../../../../platform/menubar/electron-browser/menubar.js";
import { registerMainProcessRemoteService } from "../../../../platform/ipc/electron-browser/services.js";
registerMainProcessRemoteService(IMenubarService, "menubar");
