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
import { dirname, extUri } from "../../../../../../base/common/resources.js";
import { getPromptsTypeForLanguageId, PromptsType } from "../promptTypes.js";
import { IFileService } from "../../../../../../platform/files/common/files.js";
import { CompletionItemKind } from "../../../../../../editor/common/languages.js";
import { Range } from "../../../../../../editor/common/core/range.js";
import { CharCode } from "../../../../../../base/common/charCode.js";
import { getWordAtText } from "../../../../../../editor/common/core/wordHelper.js";
import { chatVariableLeader } from "../../requestParser/chatParserTypes.js";
import { ILanguageModelToolsService } from "../../tools/languageModelToolsService.js";
let PromptBodyAutocompletion = class {
  constructor(fileService, languageModelToolsService) {
    this.fileService = fileService;
    this.languageModelToolsService = languageModelToolsService;
    /**
     * Debug display name for this provider.
     */
    this._debugDisplayName = "PromptBodyAutocompletion";
    /**
     * List of trigger characters handled by this provider.
     */
    this.triggerCharacters = [":", ".", "/", "\\"];
  }
  /**
   * The main function of this provider that calculates
   * completion items based on the provided arguments.
   */
  async provideCompletionItems(model, position, context, token) {
    const promptsType = getPromptsTypeForLanguageId(model.getLanguageId());
    if (!promptsType) {
      return void 0;
    }
    const reference = await this.findVariableReference(model, position, token);
    if (!reference) {
      return void 0;
    }
    const suggestions = [];
    switch (reference.type) {
      case "file":
        if (reference.contentRange.containsPosition(position)) {
          await this.collectFilePathCompletions(model, position, reference.contentRange, suggestions);
        } else {
          await this.collectDefaultCompletions(model, reference.range, promptsType, suggestions);
        }
        break;
      case "tool":
        if (reference.contentRange.containsPosition(position)) {
          if (promptsType === PromptsType.agent || promptsType === PromptsType.prompt) {
            await this.collectToolCompletions(model, position, reference.contentRange, suggestions);
          }
        } else {
          await this.collectDefaultCompletions(model, reference.range, promptsType, suggestions);
        }
        break;
      default:
        await this.collectDefaultCompletions(model, reference.range, promptsType, suggestions);
    }
    return { suggestions };
  }
  async collectToolCompletions(model, position, toolRange, suggestions) {
    for (const toolName of this.languageModelToolsService.getFullReferenceNames()) {
      suggestions.push({
        label: toolName,
        kind: CompletionItemKind.Value,
        filterText: toolName,
        insertText: toolName,
        range: toolRange
      });
    }
  }
  async collectFilePathCompletions(model, position, pathRange, suggestions) {
    const pathUntilPosition = model.getValueInRange(pathRange.setEndPosition(position.lineNumber, position.column));
    const pathSeparator = pathUntilPosition.includes("/") || !pathUntilPosition.includes("\\") ? "/" : "\\";
    let parentFolderPath;
    if (pathUntilPosition.match(/[^\/]\.\.$/i)) {
      parentFolderPath = pathUntilPosition + pathSeparator;
    } else {
      let i = pathUntilPosition.length - 1;
      while (i >= 0 && ![CharCode.Slash, CharCode.Backslash].includes(pathUntilPosition.charCodeAt(i))) {
        i--;
      }
      parentFolderPath = pathUntilPosition.substring(0, i + 1);
    }
    const retriggerCommand = { id: "editor.action.triggerSuggest", title: "Suggest" };
    try {
      const currentFolder = extUri.resolvePath(dirname(model.uri), parentFolderPath);
      const { children } = await this.fileService.resolve(currentFolder);
      if (children) {
        for (const child of children) {
          const insertText = (parentFolderPath || "." + pathSeparator) + child.name;
          suggestions.push({
            label: child.name + (child.isDirectory ? pathSeparator : ""),
            kind: child.isDirectory ? CompletionItemKind.Folder : CompletionItemKind.File,
            range: pathRange,
            insertText: insertText + (child.isDirectory ? pathSeparator : ""),
            filterText: insertText,
            command: child.isDirectory ? retriggerCommand : void 0
          });
        }
      }
    } catch (e) {
    }
    suggestions.push({
      label: "..",
      kind: CompletionItemKind.Folder,
      insertText: parentFolderPath + ".." + pathSeparator,
      range: pathRange,
      filterText: parentFolderPath + "..",
      command: retriggerCommand
    });
  }
  /**
   * Finds a file reference that suites the provided `position`.
   */
  async findVariableReference(model, position, token) {
    if (model.getLineContent(1).trimEnd() === "---") {
      let i = 2;
      while (i <= model.getLineCount() && model.getLineContent(i).trimEnd() !== "---") {
        i++;
      }
      if (i >= position.lineNumber) {
        return void 0;
      }
    }
    const reg = new RegExp(`${chatVariableLeader}[^\\s#]*`, "g");
    const varWord = getWordAtText(position.column, reg, model.getLineContent(position.lineNumber), 0);
    if (!varWord) {
      return void 0;
    }
    const range = new Range(position.lineNumber, varWord.startColumn + 1, position.lineNumber, varWord.endColumn);
    const nameMatch = varWord.word.match(/^#(\w+:)?/);
    if (nameMatch) {
      const contentCol = varWord.startColumn + nameMatch[0].length;
      if (nameMatch[1] === "file:") {
        return { type: "file", contentRange: new Range(position.lineNumber, contentCol, position.lineNumber, varWord.endColumn), range };
      } else if (nameMatch[1] === "tool:") {
        return { type: "tool", contentRange: new Range(position.lineNumber, contentCol, position.lineNumber, varWord.endColumn), range };
      }
    }
    return { type: "", contentRange: range, range };
  }
  async collectDefaultCompletions(model, range, promptFileType, suggestions) {
    const labels = promptFileType === PromptsType.instructions ? ["file"] : ["file", "tool"];
    labels.forEach((label) => {
      suggestions.push({
        label: `${label}:`,
        kind: CompletionItemKind.Keyword,
        insertText: `${label}:`,
        range,
        command: { id: "editor.action.triggerSuggest", title: "Suggest" }
      });
    });
  }
};
PromptBodyAutocompletion = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, ILanguageModelToolsService)
], PromptBodyAutocompletion);
export {
  PromptBodyAutocompletion
};
