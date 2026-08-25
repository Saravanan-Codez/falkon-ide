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
import { CancellationToken } from "../../../../../../base/common/cancellation.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { derived, ObservableMap } from "../../../../../../base/common/observable.js";
import { isObject } from "../../../../../../base/common/types.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { observableMemento } from "../../../../../../platform/observable/common/observableMemento.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../../platform/storage/common/storage.js";
import { ChatModeKind } from "../../../common/constants.js";
import { PromptsStorage } from "../../../common/promptSyntax/service/promptsService.js";
import { ILanguageModelToolsService, isToolSet, ToolAndToolSetEnablementMap } from "../../../common/tools/languageModelToolsService.js";
import { PromptFileRewriter } from "../../promptSyntax/promptFileRewriter.js";
var ToolEnablementStates;
((ToolEnablementStates2) => {
  function fromMap(map) {
    const toolSets = /* @__PURE__ */ new Map(), tools = /* @__PURE__ */ new Map();
    for (const [entry, enabled] of map) {
      if (isToolSet(entry)) {
        toolSets.set(entry.id, enabled);
      } else {
        tools.set(entry.id, enabled);
      }
    }
    return { toolSets, tools };
  }
  ToolEnablementStates2.fromMap = fromMap;
  function isStoredDataV1(data) {
    return isObject(data) && data.version === void 0 && (data.disabledTools === void 0 || Array.isArray(data.disabledTools)) && (data.disabledToolSets === void 0 || Array.isArray(data.disabledToolSets));
  }
  function isStoredDataV2(data) {
    return isObject(data) && data.version === 2 && Array.isArray(data.toolSetEntries) && Array.isArray(data.toolEntries);
  }
  function fromStorage(storage) {
    try {
      const parsed = JSON.parse(storage);
      if (isStoredDataV2(parsed)) {
        return { toolSets: new Map(parsed.toolSetEntries), tools: new Map(parsed.toolEntries) };
      } else if (isStoredDataV1(parsed)) {
        const toolSetEntries = parsed.disabledToolSets?.map((id) => [id, false]);
        const toolEntries = parsed.disabledTools?.map((id) => [id, false]);
        return { toolSets: new Map(toolSetEntries), tools: new Map(toolEntries) };
      }
    } catch {
    }
    return { toolSets: /* @__PURE__ */ new Map(), tools: /* @__PURE__ */ new Map() };
  }
  ToolEnablementStates2.fromStorage = fromStorage;
  function toStorage(state) {
    const storageData = {
      version: 2,
      toolSetEntries: Array.from(state.toolSets.entries()),
      toolEntries: Array.from(state.tools.entries())
    };
    return JSON.stringify(storageData);
  }
  ToolEnablementStates2.toStorage = toStorage;
})(ToolEnablementStates || (ToolEnablementStates = {}));
var ToolsScope = /* @__PURE__ */ ((ToolsScope2) => {
  ToolsScope2[ToolsScope2["Global"] = 0] = "Global";
  ToolsScope2[ToolsScope2["Session"] = 1] = "Session";
  ToolsScope2[ToolsScope2["Agent"] = 2] = "Agent";
  ToolsScope2[ToolsScope2["Agent_ReadOnly"] = 3] = "Agent_ReadOnly";
  return ToolsScope2;
})(ToolsScope || {});
let ChatSelectedTools = class extends Disposable {
  constructor(_mode, languageModel, _toolsService, _storageService, _instantiationService) {
    super();
    this._mode = _mode;
    this.languageModel = languageModel;
    this._toolsService = _toolsService;
    this._instantiationService = _instantiationService;
    this._sessionStates = new ObservableMap();
    /**
     * All tools and tool sets with their enabled state.
     * Tools are filtered based on the current model context.
     */
    this.entriesMap = derived((r) => {
      const map = /* @__PURE__ */ new Map();
      const lm = this.languageModel.read(r)?.metadata;
      const currentMode = this._mode.read(r);
      let currentMap = this._sessionStates.observable.read(r).get(currentMode.id);
      if (!currentMap && currentMode.kind === ChatModeKind.Agent) {
        const modeTools = currentMode.customTools?.read(r);
        if (modeTools) {
          currentMap = ToolEnablementStates.fromMap(this._toolsService.toToolAndToolSetEnablementMap(modeTools, lm));
        }
      }
      if (!currentMap) {
        currentMap = this._globalState.read(r);
      }
      for (const tool of this._currentTools.read(r)) {
        if (tool.canBeReferencedInPrompt) {
          map.set(tool, currentMap.tools.get(tool.id) !== false);
        }
      }
      for (const toolSet of this._toolsService.getToolSetsForModel(lm, r)) {
        if (toolSet.hiddenInToolsPicker) {
          continue;
        }
        const toolSetEnabled = currentMap.toolSets.get(toolSet.id) !== false;
        map.set(toolSet, toolSetEnabled);
        for (const tool of toolSet.getTools(r)) {
          map.set(tool, toolSetEnabled || currentMap.tools.get(tool.id) === true);
        }
      }
      return ToolAndToolSetEnablementMap.fromMap(map);
    });
    this.userSelectedTools = derived((r) => {
      const result = {};
      const map = this.entriesMap.read(r);
      for (const [item, enabled] of map) {
        if (!isToolSet(item)) {
          result[item.id] = enabled;
        }
      }
      return result;
    });
    const globalStateMemento = observableMemento({
      key: "chat/selectedTools",
      defaultValue: { toolSets: /* @__PURE__ */ new Map(), tools: /* @__PURE__ */ new Map() },
      fromStorage: ToolEnablementStates.fromStorage,
      toStorage: ToolEnablementStates.toStorage
    });
    this._globalState = this._store.add(globalStateMemento(StorageScope.PROFILE, StorageTarget.MACHINE, _storageService));
    this._currentTools = languageModel.map((lm) => _toolsService.observeTools(lm?.metadata)).map((o, r) => o.read(r));
  }
  get entriesScope() {
    const mode = this._mode.get();
    if (this._sessionStates.has(mode.id)) {
      return 1 /* Session */;
    }
    if (mode.kind === ChatModeKind.Agent && mode.customTools?.get() && mode.uri) {
      return mode.source?.storage !== PromptsStorage.extension ? 2 /* Agent */ : 3 /* Agent_ReadOnly */;
    }
    return 0 /* Global */;
  }
  get currentMode() {
    return this._mode.get();
  }
  resetSessionEnablementState() {
    const mode = this._mode.get();
    this._sessionStates.delete(mode.id);
  }
  set(enablementMap, sessionOnly) {
    const mode = this._mode.get();
    if (sessionOnly || this._sessionStates.has(mode.id)) {
      this._sessionStates.set(mode.id, ToolEnablementStates.fromMap(enablementMap));
      return;
    }
    if (mode.kind === ChatModeKind.Agent && mode.customTools?.get() && mode.uri) {
      if (mode.source?.storage !== PromptsStorage.extension) {
        this.updateCustomModeTools(mode.uri.get(), enablementMap);
        return;
      } else {
        this._sessionStates.set(mode.id, ToolEnablementStates.fromMap(enablementMap));
        return;
      }
    }
    this._globalState.set(ToolEnablementStates.fromMap(enablementMap), void 0);
  }
  async updateCustomModeTools(uri, enablementMap) {
    await this._instantiationService.createInstance(PromptFileRewriter).openAndRewriteTools(uri, enablementMap, CancellationToken.None);
  }
};
ChatSelectedTools = __decorateClass([
  __decorateParam(2, ILanguageModelToolsService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IInstantiationService)
], ChatSelectedTools);
export {
  ChatSelectedTools,
  ToolsScope
};
