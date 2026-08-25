var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Event } from "../../../../base/common/event.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { ChatContextKeys } from "../../chat/common/actions/chatContextKeys.js";
const IRemoteCodingAgentsService = createDecorator("remoteCodingAgentsService");
let RemoteCodingAgentsService = class extends Disposable {
  constructor(contextKeyService) {
    super();
    this.contextKeyService = contextKeyService;
    this.agents = [];
    this.contextKeys = /* @__PURE__ */ new Set();
    this._ctxHasRemoteCodingAgent = ChatContextKeys.hasRemoteCodingAgent.bindTo(this.contextKeyService);
    this._register(Event.filter(contextKeyService.onDidChangeContext, (e) => e.affectsSome(this.contextKeys))(() => {
      this.updateContextKeys();
    }));
  }
  getRegisteredAgents() {
    return [...this.agents];
  }
  getAvailableAgents() {
    return this.agents.filter((agent) => this.isAgentAvailable(agent));
  }
  registerAgent(agent) {
    const existingIndex = this.agents.findIndex((a) => a.id === agent.id);
    if (existingIndex >= 0) {
      this.agents[existingIndex] = agent;
    } else {
      this.agents.push(agent);
    }
    if (agent.when) {
      const whenExpr = ContextKeyExpr.deserialize(agent.when);
      if (whenExpr) {
        for (const key of whenExpr.keys()) {
          this.contextKeys.add(key);
        }
      }
    }
    this.updateContextKeys();
  }
  isAgentAvailable(agent) {
    if (!agent.when) {
      return true;
    }
    const whenExpr = ContextKeyExpr.deserialize(agent.when);
    return !whenExpr || this.contextKeyService.contextMatchesRules(whenExpr);
  }
  updateContextKeys() {
    const hasAvailableAgent = this.getAvailableAgents().length > 0;
    this._ctxHasRemoteCodingAgent.set(hasAvailableAgent);
  }
};
RemoteCodingAgentsService = __decorateClass([
  __decorateParam(0, IContextKeyService)
], RemoteCodingAgentsService);
registerSingleton(IRemoteCodingAgentsService, RemoteCodingAgentsService, InstantiationType.Delayed);
export {
  IRemoteCodingAgentsService,
  RemoteCodingAgentsService
};
