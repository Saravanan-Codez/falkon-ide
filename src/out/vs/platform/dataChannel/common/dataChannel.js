import { Event } from "../../../base/common/event.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
const IDataChannelService = createDecorator("dataChannelService");
class NullDataChannelService {
  get onDidSendData() {
    return Event.None;
  }
  getDataChannel(_channelId) {
    return {
      sendData: () => {
      }
    };
  }
}
export {
  IDataChannelService,
  NullDataChannelService
};
