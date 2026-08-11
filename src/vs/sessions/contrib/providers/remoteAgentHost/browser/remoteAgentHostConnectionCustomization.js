import { toDisposable } from "../../../../../base/common/lifecycle.js";
import { createDecorator } from "../../../../../platform/instantiation/common/instantiation.js";
const IRemoteAgentHostConnectionCustomizationService = createDecorator("remoteAgentHostConnectionCustomizationService");
class RemoteAgentHostConnectionCustomizationService {
  constructor() {
    this._entries = /* @__PURE__ */ new Set();
  }
  register(match, factory) {
    const entry = { match, factory };
    this._entries.add(entry);
    return toDisposable(() => this._entries.delete(entry));
  }
  get(address) {
    for (const entry of this._entries) {
      if (entry.match(address)) {
        return entry.factory(address);
      }
    }
    return void 0;
  }
}
export {
  IRemoteAgentHostConnectionCustomizationService,
  RemoteAgentHostConnectionCustomizationService
};
