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
import { Disposable, DisposableMap } from "../../../../../base/common/lifecycle.js";
import { derived, observableFromEvent, observableSignalFromEvent, observableValueOpts } from "../../../../../base/common/observable.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { createDecorator } from "../../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { Memento } from "../../../../common/memento.js";
import { extractArtifactsFromResponse } from "../chatArtifactExtraction.js";
import { IChatToolInvocation, IChatService } from "../chatService/chatService.js";
import { ChatConfiguration } from "../constants.js";
import { chatSessionResourceToId } from "../model/chatUri.js";
const IChatArtifactsService = createDecorator("chatArtifactsService");
let ChatArtifactsStorage = class {
  constructor(storageService) {
    this._memento = new Memento("chat-artifacts", storageService);
  }
  get(key) {
    const storage = this._memento.getMemento(StorageScope.WORKSPACE, StorageTarget.MACHINE);
    return storage[key] || [];
  }
  set(key, artifacts) {
    const storage = this._memento.getMemento(StorageScope.WORKSPACE, StorageTarget.MACHINE);
    storage[key] = artifacts;
    this._memento.saveMemento();
  }
  delete(key) {
    const storage = this._memento.getMemento(StorageScope.WORKSPACE, StorageTarget.MACHINE);
    delete storage[key];
    this._memento.saveMemento();
  }
};
ChatArtifactsStorage = __decorateClass([
  __decorateParam(0, IStorageService)
], ChatArtifactsStorage);
class UnifiedChatArtifacts extends Disposable {
  constructor(sessionResource, _storageKey, _storage, chatService, configurationService) {
    super();
    this._storageKey = _storageKey;
    this._storage = _storage;
    this._responseCache = /* @__PURE__ */ new Map();
    this._ruleOverrides = observableValueOpts(
      { owner: this, equalsFn: () => false },
      void 0
    );
    this._agentArtifacts = observableValueOpts(
      { owner: this, equalsFn: () => false },
      []
    );
    this._subagentArtifacts = observableValueOpts(
      { owner: this, equalsFn: () => false },
      /* @__PURE__ */ new Map()
    );
    /** Sequence counter for ordering sources by first-set time. */
    this._nextSequence = 1;
    // 0 is reserved for rules
    this._sourceSequences = /* @__PURE__ */ new Map();
    const restored = this._storage.get(this._storageKey);
    this._agentArtifacts.set(restored, void 0);
    this._sourceSequences.set("rules", 0);
    if (restored.length > 0) {
      this._sourceSequences.set("agent", this._nextSequence++);
    }
    const configByMimeType = observableFromEvent(
      this,
      configurationService.onDidChangeConfiguration,
      () => configurationService.getValue(ChatConfiguration.ArtifactsRulesByMimeType) ?? {}
    );
    const configByFilePath = observableFromEvent(
      this,
      configurationService.onDidChangeConfiguration,
      () => configurationService.getValue(ChatConfiguration.ArtifactsRulesByFilePath) ?? {}
    );
    const configByMemoryFilePath = observableFromEvent(
      this,
      configurationService.onDidChangeConfiguration,
      () => configurationService.getValue(ChatConfiguration.ArtifactsRulesByMemoryFilePath) ?? {}
    );
    const modelSignal = observableFromEvent(
      this,
      chatService.onDidCreateModel,
      () => chatService.getSession(sessionResource)
    );
    const rulesArtifacts = derived((reader) => {
      const overrides = this._ruleOverrides.read(reader);
      const byMimeType = overrides?.byMimeType ?? configByMimeType.read(reader);
      const byFilePath = overrides?.byFilePath ?? configByFilePath.read(reader);
      const byMemoryFilePath = overrides?.byMemoryFilePath ?? configByMemoryFilePath.read(reader);
      const model = modelSignal.read(reader);
      if (!model) {
        return [];
      }
      const requestsSignal = observableSignalFromEvent(this, model.onDidChange);
      requestsSignal.read(reader);
      const requests = model.getRequests();
      const allArtifacts = [];
      const activeResponseIds = /* @__PURE__ */ new Set();
      const seenKeys = /* @__PURE__ */ new Set();
      for (const request of requests) {
        const response = request.response;
        if (!response) {
          continue;
        }
        activeResponseIds.add(response.id);
        const responseValue = response.response;
        const partsLength = responseValue.value.length;
        let completedToolCount = 0;
        for (const part of responseValue.value) {
          if ((part.kind === "toolInvocation" || part.kind === "toolInvocationSerialized") && IChatToolInvocation.resultDetails(part) !== void 0) {
            completedToolCount++;
          }
        }
        const cached = this._responseCache.get(response.id);
        let extracted;
        if (cached && cached.partsLength === partsLength && cached.completedToolCount === completedToolCount && cached.byMimeType === byMimeType && cached.byFilePath === byFilePath && cached.byMemoryFilePath === byMemoryFilePath) {
          extracted = cached.artifacts;
        } else {
          extracted = extractArtifactsFromResponse(responseValue, sessionResource, byMimeType, byFilePath, byMemoryFilePath);
          this._responseCache.set(response.id, { partsLength, completedToolCount, byMimeType, byFilePath, byMemoryFilePath, artifacts: extracted });
        }
        for (const artifact of extracted) {
          const key = artifact.toolCallId ? `${artifact.toolCallId}:${artifact.dataPartIndex}` : artifact.uri;
          if (seenKeys.has(key)) {
            const idx = allArtifacts.findIndex(
              (a) => a.toolCallId ? `${a.toolCallId}:${a.dataPartIndex}` === key : a.uri === key
            );
            if (idx !== -1) {
              allArtifacts.splice(idx, 1);
            }
          }
          seenKeys.add(key);
          allArtifacts.push(artifact);
        }
      }
      for (const key of this._responseCache.keys()) {
        if (!activeResponseIds.has(key)) {
          this._responseCache.delete(key);
        }
      }
      return allArtifacts;
    });
    this.artifactGroups = derived((reader) => {
      const entries = [];
      const rules = rulesArtifacts.read(reader);
      if (rules.length > 0) {
        entries.push({ key: "rules", seq: this._sourceSequences.get("rules") ?? 0, group: { source: { kind: "rules" }, artifacts: rules } });
      }
      const agent = this._agentArtifacts.read(reader);
      if (agent.length > 0) {
        entries.push({ key: "agent", seq: this._sourceSequences.get("agent") ?? Infinity, group: { source: { kind: "agent" }, artifacts: agent } });
      }
      const subagents = this._subagentArtifacts.read(reader);
      for (const [invocationId, entry] of subagents) {
        if (entry.artifacts.length > 0) {
          const key = `subagent:${invocationId}`;
          entries.push({
            key,
            seq: this._sourceSequences.get(key) ?? Infinity,
            group: { source: { kind: "subagent", invocationId, name: entry.name }, artifacts: entry.artifacts }
          });
        }
      }
      entries.sort((a, b) => a.seq - b.seq);
      const seenKeys = /* @__PURE__ */ new Set();
      const groups = [];
      for (const entry of entries) {
        const filtered = entry.group.artifacts.filter((a) => {
          const k = a.toolCallId ? `${a.toolCallId}:${a.dataPartIndex}` : a.uri;
          if (!k) {
            return false;
          }
          const normalized = k.toLowerCase();
          if (seenKeys.has(normalized)) {
            return false;
          }
          seenKeys.add(normalized);
          return true;
        });
        if (filtered.length > 0) {
          groups.push({ source: entry.group.source, artifacts: filtered });
        }
      }
      return groups;
    });
  }
  setAgentArtifacts(artifacts) {
    if (!this._sourceSequences.has("agent")) {
      this._sourceSequences.set("agent", this._nextSequence++);
    }
    this._agentArtifacts.set(artifacts, void 0);
    this._storage.set(this._storageKey, artifacts);
  }
  setSubagentArtifacts(invocationId, name, artifacts) {
    const key = `subagent:${invocationId}`;
    if (!this._sourceSequences.has(key)) {
      this._sourceSequences.set(key, this._nextSequence++);
    }
    const map = new Map(this._subagentArtifacts.get());
    if (artifacts.length === 0) {
      map.delete(invocationId);
    } else {
      map.set(invocationId, { name, artifacts });
    }
    this._subagentArtifacts.set(map, void 0);
  }
  setRuleOverrides(rules) {
    this._ruleOverrides.set(rules, void 0);
  }
  clearAgentArtifacts() {
    this._agentArtifacts.set([], void 0);
    this._storage.set(this._storageKey, []);
  }
  clearSubagentArtifacts(invocationId) {
    const map = new Map(this._subagentArtifacts.get());
    map.delete(invocationId);
    this._subagentArtifacts.set(map, void 0);
  }
  migrate(target) {
    const current = this._agentArtifacts.get();
    if (current.length > 0) {
      target.setAgentArtifacts([...current]);
    }
    this._agentArtifacts.set([], void 0);
    this._storage.delete(this._storageKey);
  }
}
let ChatArtifactsService = class extends Disposable {
  constructor(storageService, _chatService, _configurationService) {
    super();
    this._chatService = _chatService;
    this._configurationService = _configurationService;
    this._instances = this._register(new DisposableMap());
    this._storage = new ChatArtifactsStorage(storageService);
  }
  getArtifacts(sessionResource) {
    const key = chatSessionResourceToId(sessionResource);
    let instance = this._instances.get(key);
    if (!instance) {
      instance = new UnifiedChatArtifacts(sessionResource, key, this._storage, this._chatService, this._configurationService);
      this._instances.set(key, instance);
    }
    return instance;
  }
};
ChatArtifactsService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, IChatService),
  __decorateParam(2, IConfigurationService)
], ChatArtifactsService);
export {
  ChatArtifactsService,
  IChatArtifactsService
};
