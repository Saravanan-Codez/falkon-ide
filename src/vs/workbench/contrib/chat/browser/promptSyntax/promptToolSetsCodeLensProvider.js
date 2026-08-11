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
import { findNodeAtLocation, parseTree } from "../../../../../base/common/json.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { getLeadingWhitespace } from "../../../../../base/common/strings.js";
import { isString } from "../../../../../base/common/types.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { EditOperation } from "../../../../../editor/common/core/editOperation.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { registerEditorFeature } from "../../../../../editor/common/editorFeatures.js";
import { isITextModel } from "../../../../../editor/common/model.js";
import { ILanguageFeaturesService } from "../../../../../editor/common/services/languageFeatures.js";
import { localize } from "../../../../../nls.js";
import { CommandsRegistry } from "../../../../../platform/commands/common/commands.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILanguageModelToolsService } from "../../common/tools/languageModelToolsService.js";
import { showToolsPicker } from "../actions/chatToolPicker.js";
let ToolSetsCodeLensProvider = class extends Disposable {
  constructor(languageFeaturesService, languageModelToolsService, instantiationService) {
    super();
    this.languageFeaturesService = languageFeaturesService;
    this.languageModelToolsService = languageModelToolsService;
    this.instantiationService = instantiationService;
    // `_`-prefix marks this as private command
    this.cmdId = `_configureToolSetTools/${generateUuid()}`;
    this._register(this.languageFeaturesService.codeLensProvider.register({ language: "jsonc" }, this));
    this._register(CommandsRegistry.registerCommand(this.cmdId, (_accessor, ...args) => {
      const modelArg = args[0];
      const rangeArg = args[1];
      const toolsArg = args[2];
      if (isITextModel(modelArg) && Range.isIRange(rangeArg) && Array.isArray(toolsArg) && toolsArg.every(isString)) {
        return this.updateTools(modelArg, Range.lift(rangeArg), toolsArg);
      }
      return void 0;
    }));
  }
  provideCodeLenses(model, _token) {
    if (!model.uri.path.endsWith(".toolsets.jsonc")) {
      return void 0;
    }
    const root = parseTree(model.getValue());
    if (!root || root.type !== "object" || !root.children) {
      return void 0;
    }
    const lenses = [];
    for (const property of root.children) {
      if (property.type !== "property" || !property.children || property.children.length !== 2) {
        continue;
      }
      const [keyNode, valueNode] = property.children;
      if (valueNode.type !== "object") {
        continue;
      }
      const toolsNode = findNodeAtLocation(valueNode, ["tools"]);
      if (!toolsNode || toolsNode.type !== "array") {
        continue;
      }
      const selectedTools = (toolsNode.children ?? []).filter((item) => item.type === "string" && isString(item.value)).map((item) => item.value);
      const keyStart = model.getPositionAt(keyNode.offset);
      const valueRange = this.rangeFromNode(model, toolsNode);
      lenses.push({
        range: Range.fromPositions(keyStart),
        command: {
          title: localize("configure-tools.capitalized.ellipsis", "Configure Tools..."),
          id: this.cmdId,
          arguments: [model, valueRange, selectedTools]
        }
      });
    }
    return { lenses };
  }
  rangeFromNode(model, node) {
    const start = model.getPositionAt(node.offset);
    const end = model.getPositionAt(node.offset + node.length);
    return Range.fromPositions(start, end);
  }
  async updateTools(model, range, selectedTools) {
    const getToolsEntries = () => this.languageModelToolsService.toToolAndToolSetEnablementMap(selectedTools, void 0);
    const newSelected = await this.instantiationService.invokeFunction(showToolsPicker, localize("placeholder", "Select tools"), "toolSetCodeLens", void 0, getToolsEntries);
    if (!newSelected) {
      return;
    }
    const newNames = this.languageModelToolsService.toFullReferenceNames(newSelected);
    const newValue = this.formatToolsArray(model, range, newNames);
    model.pushStackElement();
    model.pushEditOperations(null, [EditOperation.replaceMove(range, newValue)], () => null);
    model.pushStackElement();
  }
  formatToolsArray(model, range, toolNames) {
    if (toolNames.length === 0) {
      return "[]";
    }
    const { insertSpaces, indentSize } = model.getOptions();
    const oneIndent = insertSpaces ? " ".repeat(indentSize) : "	";
    const baseIndent = getLeadingWhitespace(model.getLineContent(range.startLineNumber));
    const itemIndent = baseIndent + oneIndent;
    const items = toolNames.map((name) => `${itemIndent}${JSON.stringify(name)}`).join(",\n");
    return `[
${items}
${baseIndent}]`;
  }
};
ToolSetsCodeLensProvider = __decorateClass([
  __decorateParam(0, ILanguageFeaturesService),
  __decorateParam(1, ILanguageModelToolsService),
  __decorateParam(2, IInstantiationService)
], ToolSetsCodeLensProvider);
registerEditorFeature(ToolSetsCodeLensProvider);
