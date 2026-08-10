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
import { isPatternInWord } from "../../../../base/common/filters.js";
import { Schemas } from "../../../../base/common/network.js";
import { ResourceSet } from "../../../../base/common/map.js";
import { basename, isEqualOrParent } from "../../../../base/common/resources.js";
import { Range } from "../../../../editor/common/core/range.js";
import { getWordAtText } from "../../../../editor/common/core/wordHelper.js";
import { CompletionItemKind } from "../../../../editor/common/languages.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { FileKind, IFileService } from "../../../../platform/files/common/files.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { ISearchService } from "../../../../workbench/services/search/common/search.js";
import { searchFilesAndFolders } from "../../../../workbench/contrib/search/browser/searchChatContext.js";
import { IHistoryService } from "../../../../workbench/services/history/common/history.js";
import { isDiffEditorInput } from "../../../../workbench/common/editor.js";
import { isSupportedChatFileScheme } from "../../../../workbench/contrib/chat/common/constants.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
const VARIABLE_LEADER = "#";
const ADD_REFERENCE_COMMAND = "sessions.chat.addVariableReference";
CommandsRegistry.registerCommand(ADD_REFERENCE_COMMAND, (_accessor, arg) => {
  arg.attachments.addAttachments({
    id: arg.entry.id,
    name: arg.entry.name,
    value: arg.entry.value,
    kind: arg.entry.kind
  });
});
function computeRange(model, position, reg) {
  const varWord = getWordAtText(position.column, reg, model.getLineContent(position.lineNumber), 0);
  if (!varWord && model.getWordUntilPosition(position).word) {
    return;
  }
  if (!varWord && position.column > 1) {
    const textBefore = model.getValueInRange(new Range(position.lineNumber, position.column - 1, position.lineNumber, position.column));
    if (textBefore !== " ") {
      return;
    }
  }
  if (varWord) {
    const wordBefore = model.getWordUntilPosition({ lineNumber: position.lineNumber, column: varWord.startColumn });
    if (wordBefore.word) {
      return;
    }
  }
  let insert;
  let replace;
  if (!varWord) {
    insert = replace = Range.fromPositions(position);
  } else {
    insert = new Range(position.lineNumber, varWord.startColumn, position.lineNumber, position.column);
    replace = new Range(position.lineNumber, varWord.startColumn, position.lineNumber, varWord.endColumn);
  }
  return { insert, replace, varWord };
}
let VariableCompletionHandler = class extends Disposable {
  constructor(_editor, _contextAttachments, _getWorkspaceUri, languageFeaturesService, searchService, labelService, configurationService, fileService, historyService, instantiationService) {
    super();
    this._editor = _editor;
    this._contextAttachments = _contextAttachments;
    this._getWorkspaceUri = _getWorkspaceUri;
    this.languageFeaturesService = languageFeaturesService;
    this.searchService = searchService;
    this.labelService = labelService;
    this.configurationService = configurationService;
    this.fileService = fileService;
    this.historyService = historyService;
    this.instantiationService = instantiationService;
    this._decorations = this._editor.createDecorationsCollection();
    this._registerFileCompletions();
    this._registerDecorations();
  }
  static {
    this._wordPattern = /#[^\s]*/g;
  }
  static {
    // MUST use g-flag
    this._className = "sessions-variable-reference";
  }
  // --- File & Folder completions ---
  _registerFileCompletions() {
    const uri = this._editor.getModel()?.uri;
    if (!uri) {
      return;
    }
    this._register(this.languageFeaturesService.completionProvider.register({ scheme: uri.scheme, hasAccessToAllModels: true }, {
      _debugDisplayName: "sessionsVariableFileAndFolder",
      triggerCharacters: [VARIABLE_LEADER],
      provideCompletionItems: async (model, position, _context, token) => {
        if (/^\s*\/troubleshoot\b/.test(model.getValue())) {
          return null;
        }
        const workspaceUri = this._getWorkspaceUri();
        if (!workspaceUri) {
          return null;
        }
        const range = computeRange(model, position, VariableCompletionHandler._wordPattern);
        if (!range) {
          return null;
        }
        const result = { suggestions: [], incomplete: true };
        await this._addFileAndFolderEntries(workspaceUri, result, range, token);
        return result;
      }
    }));
  }
  async _addFileAndFolderEntries(workspaceUri, result, info, token) {
    const makeItem = (resource, kind, description, boostPriority) => {
      const nameLabel = this.labelService.getUriBasenameLabel(resource);
      const text = `${VARIABLE_LEADER}file:${nameLabel}`;
      const uriLabel = this.labelService.getUriLabel(resource, { relative: true });
      const labelDescription = description ? localize("fileEntryDescription", "{0} ({1})", uriLabel, description) : uriLabel;
      const sortText = boostPriority ? " " : "!";
      return {
        label: { label: nameLabel, description: labelDescription },
        filterText: `${nameLabel} ${VARIABLE_LEADER}${nameLabel} ${uriLabel}`,
        insertText: info.varWord?.endColumn === info.replace.endColumn ? `${text} ` : text,
        range: info,
        kind: kind === FileKind.FILE ? CompletionItemKind.File : CompletionItemKind.Folder,
        sortText,
        command: {
          id: ADD_REFERENCE_COMMAND,
          title: "",
          arguments: [{
            attachments: this._contextAttachments,
            entry: {
              id: resource.toString(),
              name: nameLabel,
              value: resource,
              kind: kind === FileKind.FILE ? "file" : "directory"
            }
          }]
        }
      };
    };
    let pattern;
    if (info.varWord?.word && info.varWord.word.startsWith(VARIABLE_LEADER)) {
      pattern = info.varWord.word.toLowerCase().slice(1);
    }
    const seen = new ResourceSet();
    let historyCount = 0;
    for (const [i, item] of this.historyService.getHistory().entries()) {
      const resource = isDiffEditorInput(item) ? item.modified.resource : item.resource;
      if (!resource || seen.has(resource) || !this.instantiationService.invokeFunction((accessor) => isSupportedChatFileScheme(accessor, resource.scheme))) {
        continue;
      }
      if (!isEqualOrParent(resource, workspaceUri)) {
        continue;
      }
      if (pattern) {
        const uriLabel = this.labelService.getUriLabel(resource, { relative: true }).toLowerCase();
        const baseName = this.labelService.getUriBasenameLabel(resource).toLowerCase();
        const combined = `${baseName} ${uriLabel}`;
        if (!isPatternInWord(pattern, 0, pattern.length, combined, 0, combined.length)) {
          continue;
        }
      }
      seen.add(resource);
      result.suggestions.push(makeItem(resource, FileKind.FILE, i === 0 ? localize("activeFile", "Active file") : void 0, i === 0));
      if (++historyCount >= 5) {
        break;
      }
    }
    if (workspaceUri.scheme === Schemas.file || workspaceUri.scheme === Schemas.vscodeRemote) {
      await this._addEntriesViaSearch(workspaceUri, pattern, seen, makeItem, result, token);
    } else {
      await this._addEntriesViaFileService(workspaceUri, pattern, seen, makeItem, result, token);
    }
  }
  /**
   * Uses the search service to find files/folders — works for `file://` and `vscodeRemote` schemes.
   */
  async _addEntriesViaSearch(workspaceUri, pattern, seen, makeItem, result, token) {
    try {
      const { files, folders } = await searchFilesAndFolders(workspaceUri, pattern || "", true, token, void 0, this.configurationService, this.searchService);
      for (const file of files) {
        if (!seen.has(file)) {
          seen.add(file);
          result.suggestions.push(makeItem(file, FileKind.FILE));
        }
      }
      for (const folder of folders) {
        if (!seen.has(folder)) {
          seen.add(folder);
          result.suggestions.push(makeItem(folder, FileKind.FOLDER));
        }
      }
    } catch {
    }
  }
  /**
   * Walks the file tree via IFileService — used for virtual filesystems
   * (e.g. `github-remote-file://`) that don't support the search service.
   */
  async _addEntriesViaFileService(workspaceUri, pattern, seen, makeItem, result, token) {
    const maxResults = 100;
    const maxDepth = 10;
    const patternLower = pattern?.toLowerCase();
    const collect = async (uri, depth) => {
      if (result.suggestions.length >= maxResults || depth > maxDepth || token.isCancellationRequested) {
        return;
      }
      try {
        const stat = await this.fileService.resolve(uri);
        if (!stat.children) {
          return;
        }
        for (const child of stat.children) {
          if (result.suggestions.length >= maxResults || token.isCancellationRequested) {
            break;
          }
          if (child.isDirectory) {
            if (!seen.has(child.resource)) {
              const folderName = basename(child.resource).toLowerCase();
              if (!patternLower || folderName.includes(patternLower)) {
                seen.add(child.resource);
                result.suggestions.push(makeItem(child.resource, FileKind.FOLDER));
              }
            }
            await collect(child.resource, depth + 1);
          } else {
            if (!seen.has(child.resource)) {
              const fileName = child.name.toLowerCase();
              if (!patternLower || fileName.includes(patternLower)) {
                seen.add(child.resource);
                result.suggestions.push(makeItem(child.resource, FileKind.FILE));
              }
            }
          }
        }
      } catch {
      }
    };
    await collect(workspaceUri, 0);
  }
  // --- Decorations ---
  _registerDecorations() {
    this._register(this._editor.onDidChangeModelContent(() => this._updateDecorations()));
    this._updateDecorations();
  }
  _updateDecorations() {
    const model = this._editor.getModel();
    const value = model?.getValue() ?? "";
    const decos = [];
    const regex = /#file:\S+/g;
    let match;
    while ((match = regex.exec(value)) !== null) {
      const startOffset = match.index;
      const endOffset = startOffset + match[0].length;
      const startPos = model.getPositionAt(startOffset);
      const endPos = model.getPositionAt(endOffset);
      decos.push({
        range: {
          startLineNumber: startPos.lineNumber,
          startColumn: startPos.column,
          endLineNumber: endPos.lineNumber,
          endColumn: endPos.column
        },
        options: { description: "sessions-variable-reference", inlineClassName: VariableCompletionHandler._className }
      });
    }
    this._decorations.set(decos);
  }
};
VariableCompletionHandler = __decorateClass([
  __decorateParam(3, ILanguageFeaturesService),
  __decorateParam(4, ISearchService),
  __decorateParam(5, ILabelService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IFileService),
  __decorateParam(8, IHistoryService),
  __decorateParam(9, IInstantiationService)
], VariableCompletionHandler);
export {
  VariableCompletionHandler
};
