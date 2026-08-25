import { registerMainProcessRemoteService, registerSharedProcessRemoteService } from "../../ipc/electron-browser/services.js";
import { ISharedWebContentExtractorService, IWebContentExtractorService } from "../common/webContentExtractor.js";
registerMainProcessRemoteService(IWebContentExtractorService, "webContentExtractor");
registerSharedProcessRemoteService(ISharedWebContentExtractorService, "sharedWebContentExtractor");
