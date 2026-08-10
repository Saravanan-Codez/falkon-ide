import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
class CompositeProtocolServer extends Disposable {
  constructor(servers) {
    super();
    this._onConnection = this._register(new Emitter());
    this.onConnection = this._onConnection.event;
    this.address = void 0;
    for (const server of servers) {
      this._register(server);
      this._register(server.onConnection((transport) => this._onConnection.fire(transport)));
    }
  }
}
export {
  CompositeProtocolServer
};
