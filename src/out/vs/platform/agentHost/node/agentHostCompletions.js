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
import { CancellationToken } from "../../../base/common/cancellation.js";
import { Disposable, toDisposable } from "../../../base/common/lifecycle.js";
import { ILogService } from "../../log/common/log.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
const IAgentHostCompletions = createDecorator("agentHostCompletions");
var CompletionTriggerCharacter = /* @__PURE__ */ ((CompletionTriggerCharacter2) => {
  CompletionTriggerCharacter2["File"] = "@";
  CompletionTriggerCharacter2["Hash"] = "#";
  CompletionTriggerCharacter2["Slash"] = "/";
  return CompletionTriggerCharacter2;
})(CompletionTriggerCharacter || {});
let AgentHostCompletions = class extends Disposable {
  constructor(_logService) {
    super();
    this._logService = _logService;
    this._providers = /* @__PURE__ */ new Set();
  }
  get triggerCharacters() {
    const seen = /* @__PURE__ */ new Set();
    for (const provider of this._providers) {
      if (provider.triggerCharacters) {
        for (const ch of provider.triggerCharacters) {
          seen.add(ch);
        }
      }
    }
    return [...seen];
  }
  registerProvider(provider) {
    this._providers.add(provider);
    return toDisposable(() => this._providers.delete(provider));
  }
  async completions(params, token = CancellationToken.None) {
    const matching = [...this._providers].filter((p) => p.kinds.has(params.kind));
    if (matching.length === 0) {
      return { items: [] };
    }
    const settled = await Promise.allSettled(
      matching.map((p) => p.provideCompletionItems(params, token))
    );
    const items = [];
    for (let i = 0; i < settled.length; i++) {
      const result = settled[i];
      if (result.status === "fulfilled") {
        items.push(...result.value);
      } else {
        this._logService.error(result.reason, `[AgentHostCompletions] Provider failed for kind=${params.kind}`);
      }
    }
    return { items };
  }
};
AgentHostCompletions = __decorateClass([
  __decorateParam(0, ILogService)
], AgentHostCompletions);
export {
  AgentHostCompletions,
  CompletionTriggerCharacter,
  IAgentHostCompletions
};
