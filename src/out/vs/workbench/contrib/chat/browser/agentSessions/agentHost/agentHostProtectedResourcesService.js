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
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { Emitter } from "../../../../../../base/common/event.js";
import { InstantiationType, registerSingleton } from "../../../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../../../platform/instantiation/common/instantiation.js";
import { IAgentHostService } from "../../../../../../platform/agentHost/common/agentService.js";
const IAgentHostProtectedResourcesService = createDecorator("agentHostProtectedResourcesService");
let AgentHostProtectedResourcesService = class extends Disposable {
  constructor(_agentHostService) {
    super();
    this._agentHostService = _agentHostService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    /**
     * Signature of the protected resources last seen per provider, so a change is
     * emitted only when the advertised set actually changes (e.g. Claude switching
     * between native and proxy) rather than on every root state update.
     */
    this._lastSignature = /* @__PURE__ */ new Map();
    this._register(this._agentHostService.rootState.onDidChange((rootState) => this._sync(rootState)));
    const initial = this._agentHostService.rootState.value;
    if (initial && !(initial instanceof Error)) {
      this._sync(initial);
    }
  }
  getProtectedResources(providerId) {
    const rootState = this._agentHostService.rootState.value;
    if (!rootState || rootState instanceof Error) {
      return void 0;
    }
    const agent = rootState.agents.find((a) => a.provider === providerId);
    return agent ? agent.protectedResources ?? [] : void 0;
  }
  _sync(rootState) {
    const incoming = new Set(rootState.agents.map((a) => a.provider));
    const changed = [];
    for (const provider of [...this._lastSignature.keys()]) {
      if (!incoming.has(provider)) {
        this._lastSignature.delete(provider);
        changed.push(provider);
      }
    }
    for (const agent of rootState.agents) {
      const signature = JSON.stringify(
        (agent.protectedResources ?? []).map((resource) => [resource.resource, resource.required !== false])
      );
      if (this._lastSignature.get(agent.provider) !== signature) {
        this._lastSignature.set(agent.provider, signature);
        changed.push(agent.provider);
      }
    }
    for (const provider of changed) {
      this._onDidChange.fire(provider);
    }
  }
};
AgentHostProtectedResourcesService = __decorateClass([
  __decorateParam(0, IAgentHostService)
], AgentHostProtectedResourcesService);
registerSingleton(IAgentHostProtectedResourcesService, AgentHostProtectedResourcesService, InstantiationType.Delayed);
export {
  AgentHostProtectedResourcesService,
  IAgentHostProtectedResourcesService
};
