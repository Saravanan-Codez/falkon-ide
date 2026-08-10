import { ILanguagePackService } from "../../../../platform/languagePacks/common/languagePacks.js";
import { registerSharedProcessRemoteService } from "../../../../platform/ipc/electron-browser/services.js";
registerSharedProcessRemoteService(ILanguagePackService, "languagePacks");
