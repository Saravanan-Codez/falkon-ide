import { registerMainProcessRemoteService } from "../../../../platform/ipc/electron-browser/services.js";
import { IExtensionHostStarter, ipcExtensionHostStarterChannelName } from "../../../../platform/extensions/common/extensionHostStarter.js";
registerMainProcessRemoteService(IExtensionHostStarter, ipcExtensionHostStarterChannelName);
