import { IUpdateService } from "../../../../platform/update/common/update.js";
import { registerMainProcessRemoteService } from "../../../../platform/ipc/electron-browser/services.js";
import { UpdateChannelClient } from "../../../../platform/update/common/updateIpc.js";
registerMainProcessRemoteService(IUpdateService, "update", { channelClientCtor: UpdateChannelClient });
