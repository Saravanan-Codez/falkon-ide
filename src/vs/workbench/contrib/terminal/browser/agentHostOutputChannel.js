import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { StateComponents } from "../../../../platform/agentHost/common/state/sessionState.js";
class AgentHostOutputChannel extends Disposable {
  constructor(connection, terminalUri) {
    super();
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._output = "";
    const subscriptionRef = this._register(connection.getSubscription(StateComponents.Terminal, terminalUri, "AgentHostOutputChannel"));
    const subscription = subscriptionRef.object;
    if (subscription.value && !(subscription.value instanceof Error)) {
      this._acceptState(subscription.value);
    }
    this._register(subscription.onDidChange((state) => this._acceptState(state)));
  }
  get output() {
    return this._output;
  }
  get exitCode() {
    return this._exitCode;
  }
  _acceptState(state) {
    this._output = state.content.map((part) => part.type === "command" ? part.output : part.value).join("").replace(/\r?\n/g, "\r\n");
    this._exitCode = state.exitCode;
    this._onDidChange.fire();
  }
}
export {
  AgentHostOutputChannel
};
