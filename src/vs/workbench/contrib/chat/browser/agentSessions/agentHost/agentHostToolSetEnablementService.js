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
import { Disposable, DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { derived, observableValue } from "../../../../../../base/common/observable.js";
import { InstantiationType, registerSingleton } from "../../../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../../platform/storage/common/storage.js";
const IAgentHostToolSetEnablementService = createDecorator("agentHostToolSetEnablementService");
const AGENT_HOST_COPILOT_CLI_SESSION_TYPE = "agent-host-copilotcli";
function isToolEnabledInSet(state, toolSetId, toolId) {
  return state.tools.get(toolId) ?? state.toolSets.get(toolSetId) ?? true;
}
function getToolSetTriState(state, toolSetId, toolIds) {
  let anyOn = false;
  let anyOff = false;
  for (const toolId of toolIds) {
    if (isToolEnabledInSet(state, toolSetId, toolId)) {
      anyOn = true;
    } else {
      anyOff = true;
    }
    if (anyOn && anyOff) {
      return "mixed";
    }
  }
  return anyOn;
}
function countEnabledCustomizationTools(toolSets, state, reader) {
  const enabled = /* @__PURE__ */ new Set();
  for (const ts of toolSets) {
    if (ts.deprecated) {
      continue;
    }
    for (const tool of ts.getTools(reader)) {
      if (isToolEnabledInSet(state, ts.id, tool.id)) {
        enabled.add(tool.id);
      }
    }
  }
  return enabled.size;
}
const STORAGE_KEY = "chat.agentHost.toolSetEnablement";
const EMPTY_STATE = { toolSets: /* @__PURE__ */ new Map(), tools: /* @__PURE__ */ new Map() };
let AgentHostToolSetEnablementService = class extends Disposable {
  constructor(_storageService) {
    super();
    this._storageService = _storageService;
    this._state = observableValue("agentHostToolSetEnablement", this._load());
    const storeForListener = this._register(new DisposableStore());
    this._register(this._storageService.onDidChangeValue(StorageScope.PROFILE, STORAGE_KEY, storeForListener)(() => {
      this._state.set(this._load(), void 0);
    }));
  }
  observe(sessionType) {
    return derived((reader) => this._state.read(reader).get(sessionType) ?? EMPTY_STATE);
  }
  getState(sessionType) {
    return this._state.get().get(sessionType) ?? EMPTY_STATE;
  }
  setToolSetEnabled(sessionType, toolSetId, toolIds, enabled) {
    const state = this.getState(sessionType);
    const toolSets = new Map(state.toolSets);
    const tools = new Map(state.tools);
    if (enabled) {
      toolSets.delete(toolSetId);
    } else {
      toolSets.set(toolSetId, false);
    }
    for (const toolId of toolIds) {
      tools.delete(toolId);
    }
    this._setState(sessionType, { toolSets, tools });
  }
  setToolEnabled(sessionType, toolSetId, toolId, enabled) {
    const state = this.getState(sessionType);
    const tools = new Map(state.tools);
    const setDefault = state.toolSets.get(toolSetId) ?? true;
    if (enabled === setDefault) {
      tools.delete(toolId);
    } else {
      tools.set(toolId, enabled);
    }
    this._setState(sessionType, { toolSets: state.toolSets, tools });
  }
  _setState(sessionType, next) {
    const current = new Map(this._state.get());
    if (next.toolSets.size === 0 && next.tools.size === 0) {
      current.delete(sessionType);
    } else {
      current.set(sessionType, { toolSets: new Map(next.toolSets), tools: new Map(next.tools) });
    }
    this._state.set(current, void 0);
    this._save(current);
  }
  _load() {
    const raw = this._storageService.get(STORAGE_KEY, StorageScope.PROFILE);
    if (!raw) {
      return /* @__PURE__ */ new Map();
    }
    try {
      const parsed = JSON.parse(raw);
      const out = /* @__PURE__ */ new Map();
      for (const [sessionType, entry] of Object.entries(parsed)) {
        const toolSets = /* @__PURE__ */ new Map();
        const tools = /* @__PURE__ */ new Map();
        for (const [id, value] of Object.entries(entry.toolSets ?? {})) {
          toolSets.set(id, value);
        }
        for (const [id, value] of Object.entries(entry.tools ?? {})) {
          tools.set(id, value);
        }
        if (toolSets.size > 0 || tools.size > 0) {
          out.set(sessionType, { toolSets, tools });
        }
      }
      return out;
    } catch {
      return /* @__PURE__ */ new Map();
    }
  }
  _save(state) {
    if (state.size === 0) {
      this._storageService.remove(STORAGE_KEY, StorageScope.PROFILE);
      return;
    }
    const out = {};
    for (const [sessionType, entry] of state) {
      out[sessionType] = {
        toolSets: Object.fromEntries(entry.toolSets),
        tools: Object.fromEntries(entry.tools)
      };
    }
    this._storageService.store(STORAGE_KEY, JSON.stringify(out), StorageScope.PROFILE, StorageTarget.MACHINE);
  }
};
AgentHostToolSetEnablementService = __decorateClass([
  __decorateParam(0, IStorageService)
], AgentHostToolSetEnablementService);
registerSingleton(IAgentHostToolSetEnablementService, AgentHostToolSetEnablementService, InstantiationType.Delayed);
export {
  AGENT_HOST_COPILOT_CLI_SESSION_TYPE,
  AgentHostToolSetEnablementService,
  IAgentHostToolSetEnablementService,
  countEnabledCustomizationTools,
  getToolSetTriState,
  isToolEnabledInSet
};
