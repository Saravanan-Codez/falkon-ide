import { createDecorator } from "../../instantiation/common/instantiation.js";
const IMainProcessService = createDecorator("mainProcessService");
class MainProcessService {
  constructor(server, router) {
    this.server = server;
    this.router = router;
  }
  getChannel(channelName) {
    return this.server.getChannel(channelName, this.router);
  }
  registerChannel(channelName, channel) {
    this.server.registerChannel(channelName, channel);
  }
}
export {
  IMainProcessService,
  MainProcessService
};
