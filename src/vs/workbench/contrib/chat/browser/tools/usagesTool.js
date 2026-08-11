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
import { Codicon } from "../../../../../base/common/codicons.js";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { escapeRegExpCharacters } from "../../../../../base/common/strings.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { ResourceSet } from "../../../../../base/common/map.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { isEqual, relativePath } from "../../../../../base/common/resources.js";
import { Position } from "../../../../../editor/common/core/position.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { ILanguageFeaturesService } from "../../../../../editor/common/services/languageFeatures.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { getDefinitionsAtPosition, getImplementationsAtPosition, getReferencesAtPosition } from "../../../../../editor/contrib/gotoSymbol/browser/goToSymbol.js";
import { localize } from "../../../../../nls.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { ISearchService, QueryType, resultIsMatch } from "../../../../services/search/common/search.js";
import { ILanguageModelToolsService, ToolDataSource } from "../../common/tools/languageModelToolsService.js";
import { createToolSimpleTextResult } from "../../common/tools/builtinTools/toolHelpers.js";
import { errorResult, findLineNumber, findSymbolColumn, resolveSymbolToolFileUri } from "./toolHelpers.js";
const UsagesToolId = "vscode_listCodeUsages";
const BaseModelDescription = `Find all usages (references, definitions, and implementations) of a code symbol across the workspace. This tool locates where a symbol is referenced, defined, or implemented.

Input:
- "symbol": The exact name of the symbol to search for (function, class, method, variable, type, etc.).
- "uri": A full URI (e.g. "file:///path/to/file.ts") of a file where the symbol appears. Provide either "uri" or "filePath".
- "filePath": A workspace-relative file path (e.g. "src/utils/helpers.ts") of a file where the symbol appears. Provide either "uri" or "filePath".
- "lineContent": A substring of the line of code where the symbol appears. This is used to locate the exact position in the file. Must be the actual text from the file - do NOT fabricate it.

IMPORTANT: The file and line do NOT need to be the definition of the symbol. Any occurrence works - a usage, an import, a call site, etc. You can pick whichever occurrence is most convenient.

If the tool returns an error, retry with corrected input - ensure the file path is correct, the line content matches the actual file content, and the symbol name appears in that line.`;
const StaticModelDescription = BaseModelDescription + `

If the file's language has no reference provider registered, the tool returns an error.`;
let UsagesTool = class extends Disposable {
  constructor(_languageFeaturesService, _modelService, _searchService, _textModelService, _workspaceContextService) {
    super();
    this._languageFeaturesService = _languageFeaturesService;
    this._modelService = _modelService;
    this._searchService = _searchService;
    this._textModelService = _textModelService;
    this._workspaceContextService = _workspaceContextService;
  }
  getToolData() {
    return this._buildToolData(
      StaticModelDescription,
      localize("tool.usages.userDescription", "Find references, definitions, and implementations of a symbol")
    );
  }
  _buildToolData(modelDescription, userDescription) {
    return {
      id: UsagesToolId,
      toolReferenceName: "usages",
      canBeReferencedInPrompt: false,
      icon: ThemeIcon.fromId(Codicon.references.id),
      displayName: localize("tool.usages.displayName", "List Code Usages"),
      userDescription,
      modelDescription,
      source: ToolDataSource.Internal,
      inputSchema: {
        type: "object",
        properties: {
          symbol: {
            type: "string",
            description: "The exact name of the symbol (function, class, method, variable, type, etc.) to find usages of."
          },
          uri: {
            type: "string",
            description: 'A full URI of a file where the symbol appears (e.g. "file:///path/to/file.ts"). Provide either "uri" or "filePath".'
          },
          filePath: {
            type: "string",
            description: 'A workspace-relative file path where the symbol appears (e.g. "src/utils/helpers.ts"). Provide either "uri" or "filePath".'
          },
          lineContent: {
            type: "string",
            description: "A substring of the line of code where the symbol appears. Used to locate the exact position. Must be actual text from the file."
          }
        },
        required: ["symbol", "lineContent"]
      }
    };
  }
  async prepareToolInvocation(context, _token) {
    const input = context.parameters;
    return {
      invocationMessage: localize("tool.usages.invocationMessage", "Analyzing usages of `{0}`", input.symbol)
    };
  }
  async invoke(invocation, _countTokens, _progress, token) {
    const input = invocation.parameters;
    const uri = resolveSymbolToolFileUri(input, this._workspaceContextService, invocation.context?.workingDirectory);
    if (!uri) {
      return errorResult('Provide either "uri" (a full URI) or "filePath" (a workspace-relative path) to identify the file.');
    }
    const ref = await this._textModelService.createModelReference(uri);
    try {
      const model = ref.object.textEditorModel;
      if (!this._languageFeaturesService.referenceProvider.has(model)) {
        return errorResult(`No reference provider available for this file's language. The usages tool may not support this language.`);
      }
      const lineNumber = findLineNumber(model, input.lineContent);
      if (lineNumber === void 0) {
        return errorResult(`Could not find line content "${input.lineContent}" in ${uri.toString()}. Provide the exact text from the line where the symbol appears.`);
      }
      const lineText = model.getLineContent(lineNumber);
      const column = findSymbolColumn(lineText, input.symbol);
      if (column === void 0) {
        return errorResult(`Could not find symbol "${input.symbol}" in the matched line. Ensure the symbol name is correct and appears in the provided line content.`);
      }
      const position = new Position(lineNumber, column);
      const [definitions, references, implementations] = await Promise.all([
        getDefinitionsAtPosition(this._languageFeaturesService.definitionProvider, model, position, false, token),
        getReferencesAtPosition(this._languageFeaturesService.referenceProvider, model, position, false, false, token),
        getImplementationsAtPosition(this._languageFeaturesService.implementationProvider, model, position, false, token)
      ]);
      if (references.length === 0) {
        const result2 = createToolSimpleTextResult(`No usages found for \`${input.symbol}\`.`);
        result2.toolResultMessage = new MarkdownString(localize("tool.usages.noResults", "Analyzed usages of `{0}`, no results", input.symbol));
        return result2;
      }
      const previews = await this._getLinePreviews(input.symbol, references, token);
      const lines = [];
      lines.push(`${references.length} usages of \`${input.symbol}\`:
`);
      for (let i = 0; i < references.length; i++) {
        const ref2 = references[i];
        const kind = this._classifyReference(ref2, definitions, implementations);
        const startLine = Range.lift(ref2.range).startLineNumber;
        const preview = previews[i];
        if (preview) {
          lines.push(`<usage type="${kind}" uri="${ref2.uri.toString()}" line="${startLine}">`);
          lines.push(`	${preview}`);
          lines.push(`</usage>`);
        } else {
          lines.push(`<usage type="${kind}" uri="${ref2.uri.toString()}" line="${startLine}" />`);
        }
      }
      const text = lines.join("\n");
      const result = createToolSimpleTextResult(text);
      result.toolResultMessage = references.length === 1 ? new MarkdownString(localize("tool.usages.oneResult", "Analyzed usages of `{0}`, 1 result", input.symbol)) : new MarkdownString(localize("tool.usages.results", "Analyzed usages of `{0}`, {1} results", input.symbol, references.length));
      result.toolResultDetails = references.map((r) => ({ uri: r.uri, range: r.range }));
      return result;
    } finally {
      ref.dispose();
    }
  }
  async _getLinePreviews(symbol, references, token) {
    const previews = new Array(references.length);
    const lookup = /* @__PURE__ */ new Map();
    const needSearch = new ResourceSet();
    for (let i = 0; i < references.length; i++) {
      const ref = references[i];
      const lineNumber = Range.lift(ref.range).startLineNumber;
      const existingModel = this._modelService.getModel(ref.uri);
      if (existingModel) {
        previews[i] = existingModel.getLineContent(lineNumber).trim();
      } else {
        lookup.set(`${ref.uri.toString()}:${lineNumber}`, i);
        needSearch.add(ref.uri);
      }
    }
    if (needSearch.size === 0 || token.isCancellationRequested) {
      return previews;
    }
    try {
      const folders = this._workspaceContextService.getWorkspace().folders;
      const relativePaths = [];
      for (const uri of needSearch) {
        const folder = this._workspaceContextService.getWorkspaceFolder(uri);
        if (folder) {
          const rel = relativePath(folder.uri, uri);
          if (rel) {
            relativePaths.push(rel);
          }
        }
      }
      if (relativePaths.length > 0) {
        const includePattern = {};
        if (relativePaths.length === 1) {
          includePattern[relativePaths[0]] = true;
        } else {
          includePattern[`{${relativePaths.join(",")}}`] = true;
        }
        const searchResult = await this._searchService.textSearch(
          {
            type: QueryType.Text,
            contentPattern: { pattern: escapeRegExpCharacters(symbol), isRegExp: true, isWordMatch: true },
            folderQueries: folders.map((f) => ({ folder: f.uri })),
            includePattern
          },
          token
        );
        for (const fileMatch of searchResult.results) {
          if (!fileMatch.results) {
            continue;
          }
          for (const textMatch of fileMatch.results) {
            if (!resultIsMatch(textMatch)) {
              continue;
            }
            for (const range of textMatch.rangeLocations) {
              const lineNumber = range.source.startLineNumber + 1;
              const key = `${fileMatch.resource.toString()}:${lineNumber}`;
              const idx = lookup.get(key);
              if (idx !== void 0) {
                previews[idx] = textMatch.previewText.trim();
                lookup.delete(key);
              }
            }
          }
        }
      }
    } catch {
    }
    return previews;
  }
  _classifyReference(ref, definitions, implementations) {
    if (definitions.some((d) => this._overlaps(ref, d))) {
      return "definition";
    }
    if (implementations.some((d) => this._overlaps(ref, d))) {
      return "implementation";
    }
    return "reference";
  }
  _overlaps(a, b) {
    if (!isEqual(a.uri, b.uri)) {
      return false;
    }
    return Range.areIntersectingOrTouching(a.range, b.range);
  }
};
UsagesTool = __decorateClass([
  __decorateParam(0, ILanguageFeaturesService),
  __decorateParam(1, IModelService),
  __decorateParam(2, ISearchService),
  __decorateParam(3, ITextModelService),
  __decorateParam(4, IWorkspaceContextService)
], UsagesTool);
let UsagesToolContribution = class extends Disposable {
  static {
    this.ID = "chat.usagesTool";
  }
  constructor(toolsService, instantiationService) {
    super();
    const usagesTool = this._store.add(instantiationService.createInstance(UsagesTool));
    this._store.add(toolsService.registerTool(usagesTool.getToolData(), usagesTool));
  }
};
UsagesToolContribution = __decorateClass([
  __decorateParam(0, ILanguageModelToolsService),
  __decorateParam(1, IInstantiationService)
], UsagesToolContribution);
export {
  UsagesTool,
  UsagesToolContribution,
  UsagesToolId
};
