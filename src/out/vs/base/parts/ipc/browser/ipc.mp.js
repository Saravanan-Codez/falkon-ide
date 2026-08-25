import { Client as MessagePortClient } from "../common/ipc.mp.js";
class Client extends MessagePortClient {
  /**
   * @param clientId a way to uniquely identify this client among
   * other clients. this is important for routing because every
   * client can also be a server
   */
  constructor(port, clientId) {
    super(port, clientId);
  }
}
export {
  Client
};
