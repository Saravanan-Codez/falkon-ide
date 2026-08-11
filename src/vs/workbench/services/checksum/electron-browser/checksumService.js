import { IChecksumService } from "../../../../platform/checksum/common/checksumService.js";
import { registerSharedProcessRemoteService } from "../../../../platform/ipc/electron-browser/services.js";
registerSharedProcessRemoteService(IChecksumService, "checksum");
