import { toDisposable } from "../../../../../../base/common/lifecycle.js";
import { createDecorator } from "../../../../../../platform/instantiation/common/instantiation.js";
import { InstantiationType, registerSingleton } from "../../../../../../platform/instantiation/common/extensions.js";
const IAgentHostSessionWorkingDirectoryResolver = createDecorator("agentHostSessionWorkingDirectoryResolver");
class AgentHostSessionWorkingDirectoryResolver {
  constructor() {
    this._resolvers = /* @__PURE__ */ new Map();
  }
  registerResolver(sessionType, resolver, isNewSession) {
    const entry = { resolve: resolver, isNewSession };
    this._resolvers.set(sessionType, entry);
    return toDisposable(() => {
      if (this._resolvers.get(sessionType) === entry) {
        this._resolvers.delete(sessionType);
      }
    });
  }
  resolve(sessionResource) {
    return this._resolvers.get(sessionResource.scheme)?.resolve(sessionResource);
  }
  isNewSession(sessionResource) {
    return this._resolvers.get(sessionResource.scheme)?.isNewSession?.(sessionResource) ?? false;
  }
}
registerSingleton(IAgentHostSessionWorkingDirectoryResolver, AgentHostSessionWorkingDirectoryResolver, InstantiationType.Delayed);
export {
  IAgentHostSessionWorkingDirectoryResolver
};
