import { registerMainProcessRemoteService } from "../../../../platform/ipc/electron-browser/services.js";
import { IEncryptionService } from "../../../../platform/encryption/common/encryptionService.js";
registerMainProcessRemoteService(IEncryptionService, "encryption");
