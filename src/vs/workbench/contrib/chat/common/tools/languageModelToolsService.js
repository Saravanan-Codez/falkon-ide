import { Iterable } from "../../../../../base/common/iterator.js";
import { Disposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../base/common/network.js";
import { derived, ObservableSet } from "../../../../../base/common/observable.js";
import { URI } from "../../../../../base/common/uri.js";
import { localize } from "../../../../../nls.js";
import { ByteSize } from "../../../../../platform/files/common/files.js";
import { createDecorator } from "../../../../../platform/instantiation/common/instantiation.js";
import { stringifyPromptElementJSON } from "./promptTsxTypes.js";
function toolMatchesModel(toolData, model) {
  if (!toolData.models || toolData.models.length === 0) {
    return true;
  }
  if (!model) {
    return true;
  }
  return toolData.models.some(
    (selector) => (!selector.id || selector.id === model.id) && (!selector.vendor || selector.vendor === model.vendor) && (!selector.family || selector.family === model.family) && (!selector.version || selector.version === model.version)
  );
}
var ToolDataSource;
((ToolDataSource2) => {
  ToolDataSource2.Internal = { type: "internal", label: "Built-In" };
  ToolDataSource2.External = { type: "external", label: "External" };
  function toKey(source) {
    switch (source.type) {
      case "extension":
        return `extension:${source.extensionId.value}`;
      case "mcp":
        return `mcp:${source.collectionId}:${source.definitionId}`;
      case "user":
        return `user:${source.file.toString()}`;
      case "internal":
        return "internal";
      case "external":
        return "external";
    }
  }
  ToolDataSource2.toKey = toKey;
  function equals(a, b) {
    return toKey(a) === toKey(b);
  }
  ToolDataSource2.equals = equals;
  function classify(source) {
    if (source.type === "internal") {
      return { ordinal: 1, label: localize("builtin", "Built-In") };
    } else if (source.type === "mcp") {
      return { ordinal: 2, label: source.serverLabel || source.label };
    } else if (source.type === "user") {
      return { ordinal: 0, label: localize("user", "User Defined") };
    } else {
      return { ordinal: 3, label: source.label };
    }
  }
  ToolDataSource2.classify = classify;
})(ToolDataSource || (ToolDataSource = {}));
function isToolInvocationContext(obj) {
  return obj !== null && typeof obj === "object" && URI.isUri(obj.sessionResource);
}
function isToolResultInputOutputDetails(obj) {
  return typeof obj === "object" && typeof obj?.input === "string" && (typeof obj?.output === "string" || Array.isArray(obj?.output));
}
function isToolResultOutputDetails(obj) {
  return typeof obj === "object" && typeof obj?.output === "object" && typeof obj?.output?.mimeType === "string" && obj?.output?.type === "data";
}
function toolContentToA11yString(part) {
  return part.map((p) => {
    switch (p.kind) {
      case "promptTsx":
        return stringifyPromptTsxPart(p);
      case "text":
        return p.value;
      case "data":
        return localize("toolResultDataPartA11y", "{0} of {1} binary data", ByteSize.formatSize(p.value.data.byteLength), p.value.mimeType || "unknown");
    }
  }).join(", ");
}
function toolResultHasBuffers(result) {
  return result.content.some((part) => part.kind === "data");
}
function stringifyPromptTsxPart(part) {
  return stringifyPromptElementJSON(part.value);
}
var ToolInvocationPresentation = /* @__PURE__ */ ((ToolInvocationPresentation2) => {
  ToolInvocationPresentation2["Hidden"] = "hidden";
  ToolInvocationPresentation2["HiddenAfterComplete"] = "hiddenAfterComplete";
  return ToolInvocationPresentation2;
})(ToolInvocationPresentation || {});
class ToolAndToolSetEnablementMap {
  constructor(_map) {
    this._map = _map;
  }
  static fromEntries(entries) {
    return new ToolAndToolSetEnablementMap(new Map(entries));
  }
  static fromMap(map) {
    return new ToolAndToolSetEnablementMap(new Map(map));
  }
  [Symbol.iterator]() {
    return this._map[Symbol.iterator]();
  }
  get(toolOrToolSet) {
    return this._map.get(toolOrToolSet);
  }
  has(toolOrToolSet) {
    return this._map.has(toolOrToolSet);
  }
  get size() {
    return this._map.size;
  }
  entries() {
    return this._map.entries();
  }
}
function isToolSet(obj) {
  return !!obj && obj.getTools !== void 0;
}
class ToolSet {
  constructor(id, referenceName, icon, source, description, detail, legacyFullNames, deprecated, hiddenInToolsPicker, _contextKeyService) {
    this.id = id;
    this.referenceName = referenceName;
    this.icon = icon;
    this.source = source;
    this.description = description;
    this.detail = detail;
    this.legacyFullNames = legacyFullNames;
    this.deprecated = deprecated;
    this.hiddenInToolsPicker = hiddenInToolsPicker;
    this._contextKeyService = _contextKeyService;
    this._tools = new ObservableSet();
    this._toolSets = new ObservableSet();
    this.isHomogenous = derived((r) => {
      return !Iterable.some(this._tools.observable.read(r), (tool) => !ToolDataSource.equals(tool.source, this.source)) && !Iterable.some(this._toolSets.observable.read(r), (toolSet) => !ToolDataSource.equals(toolSet.source, this.source));
    });
  }
  addTool(data, tx) {
    this._tools.add(data, tx);
    return toDisposable(() => {
      this._tools.delete(data);
    });
  }
  addToolSet(toolSet, tx) {
    if (toolSet === this) {
      return Disposable.None;
    }
    this._toolSets.add(toolSet, tx);
    return toDisposable(() => {
      this._toolSets.delete(toolSet);
    });
  }
  getTools(r) {
    return Iterable.concat(
      Iterable.filter(this._tools.observable.read(r), (toolData) => this._contextKeyService.contextMatchesRules(toolData.when)),
      ...Iterable.map(this._toolSets.observable.read(r), (toolSet) => toolSet.getTools(r))
    );
  }
}
class ToolSetForModel {
  constructor(_toolSet, model, toolFilter) {
    this._toolSet = _toolSet;
    this.model = model;
    this.toolFilter = toolFilter;
  }
  get id() {
    return this._toolSet.id;
  }
  get referenceName() {
    return this._toolSet.referenceName;
  }
  get icon() {
    return this._toolSet.icon;
  }
  get source() {
    return this._toolSet.source;
  }
  get description() {
    return this._toolSet.description;
  }
  get detail() {
    return this._toolSet.detail;
  }
  get legacyFullNames() {
    return this._toolSet.legacyFullNames;
  }
  get deprecated() {
    return this._toolSet.deprecated;
  }
  get hiddenInToolsPicker() {
    return this._toolSet.hiddenInToolsPicker;
  }
  getTools(r) {
    return Iterable.filter(this._toolSet.getTools(r), (toolData) => toolMatchesModel(toolData, this.model) && (!this.toolFilter || this.toolFilter(toolData)));
  }
}
const ILanguageModelToolsService = createDecorator("ILanguageModelToolsService");
function createToolInputUri(toolCallId) {
  return URI.from({ scheme: Schemas.inMemory, path: `/lm/tool/${toolCallId}/tool_input.json` });
}
function createToolSchemaUri(toolOrId) {
  if (typeof toolOrId !== "string") {
    toolOrId = toolOrId.id;
  }
  return URI.from({ scheme: Schemas.vscode, authority: "schemas", path: `/lm/tool/${toolOrId}` });
}
var SpecedToolAliases;
((SpecedToolAliases2) => {
  SpecedToolAliases2.execute = "execute";
  SpecedToolAliases2.edit = "edit";
  SpecedToolAliases2.search = "search";
  SpecedToolAliases2.agent = "agent";
  SpecedToolAliases2.read = "read";
  SpecedToolAliases2.web = "web";
  SpecedToolAliases2.todo = "todo";
})(SpecedToolAliases || (SpecedToolAliases = {}));
var VSCodeToolReference;
((VSCodeToolReference2) => {
  VSCodeToolReference2.runSubagent = "runSubagent";
  VSCodeToolReference2.vscode = "vscode";
})(VSCodeToolReference || (VSCodeToolReference = {}));
export {
  ILanguageModelToolsService,
  SpecedToolAliases,
  ToolAndToolSetEnablementMap,
  ToolDataSource,
  ToolInvocationPresentation,
  ToolSet,
  ToolSetForModel,
  VSCodeToolReference,
  createToolInputUri,
  createToolSchemaUri,
  isToolInvocationContext,
  isToolResultInputOutputDetails,
  isToolResultOutputDetails,
  isToolSet,
  stringifyPromptTsxPart,
  toolContentToA11yString,
  toolMatchesModel,
  toolResultHasBuffers
};
