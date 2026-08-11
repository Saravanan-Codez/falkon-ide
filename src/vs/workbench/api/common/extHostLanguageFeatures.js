import { asArray, coalesce, isFalsyOrEmpty, isNonEmptyArray } from "../../../base/common/arrays.js";
import { raceCancellationError } from "../../../base/common/async.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
import { NotImplementedError, isCancellationError } from "../../../base/common/errors.js";
import { IdGenerator } from "../../../base/common/idGenerator.js";
import { DisposableStore, Disposable as CoreDisposable } from "../../../base/common/lifecycle.js";
import { equals, mixin } from "../../../base/common/objects.js";
import { StopWatch } from "../../../base/common/stopwatch.js";
import { regExpLeadsToEndlessLoop } from "../../../base/common/strings.js";
import { assertType, isObject } from "../../../base/common/types.js";
import { URI } from "../../../base/common/uri.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { Range as EditorRange } from "../../../editor/common/core/range.js";
import { Selection } from "../../../editor/common/core/selection.js";
import * as languages from "../../../editor/common/languages.js";
import { encodeSemanticTokensDto } from "../../../editor/common/services/semanticTokensDto.js";
import { localize } from "../../../nls.js";
import { ExtensionIdentifier } from "../../../platform/extensions/common/extensions.js";
import { isProposedApiEnabled } from "../../services/extensions/common/extensions.js";
import { Cache } from "./cache.js";
import * as extHostProtocol from "./extHost.protocol.js";
import * as typeConvert from "./extHostTypeConverters.js";
import { CodeAction, CodeActionKind, CompletionList, DataTransfer, Disposable, DocumentDropOrPasteEditKind, DocumentSymbol, InlineCompletionsDisposeReasonKind, InlineCompletionTriggerKind, InternalDataTransferItem, Location, NewSymbolNameTriggerKind, Range, SemanticTokens, SemanticTokensEdit, SemanticTokensEdits, SnippetString, SyntaxTokenType } from "./extHostTypes.js";
import { Emitter } from "../../../base/common/event.js";
class DocumentSymbolAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
  }
  async provideDocumentSymbols(resource, token) {
    const doc = this._documents.getDocument(resource);
    const value = await this._provider.provideDocumentSymbols(doc, token);
    if (isFalsyOrEmpty(value)) {
      return void 0;
    } else if (value[0] instanceof DocumentSymbol) {
      return value.map(typeConvert.DocumentSymbol.from);
    } else {
      return DocumentSymbolAdapter._asDocumentSymbolTree(value);
    }
  }
  static _asDocumentSymbolTree(infos) {
    infos = infos.slice(0).sort((a, b) => {
      let res2 = a.location.range.start.compareTo(b.location.range.start);
      if (res2 === 0) {
        res2 = b.location.range.end.compareTo(a.location.range.end);
      }
      return res2;
    });
    const res = [];
    const parentStack = [];
    for (const info of infos) {
      const element = {
        name: info.name || "!!MISSING: name!!",
        kind: typeConvert.SymbolKind.from(info.kind),
        tags: info.tags?.map(typeConvert.SymbolTag.from) || [],
        detail: "",
        containerName: info.containerName,
        range: typeConvert.Range.from(info.location.range),
        selectionRange: typeConvert.Range.from(info.location.range),
        children: []
      };
      while (true) {
        if (parentStack.length === 0) {
          parentStack.push(element);
          res.push(element);
          break;
        }
        const parent = parentStack[parentStack.length - 1];
        if (EditorRange.containsRange(parent.range, element.range) && !EditorRange.equalsRange(parent.range, element.range)) {
          parent.children?.push(element);
          parentStack.push(element);
          break;
        }
        parentStack.pop();
      }
    }
    return res;
  }
}
class CodeLensAdapter {
  constructor(_documents, _commands, _provider, _extension, _extTelemetry, _logService) {
    this._documents = _documents;
    this._commands = _commands;
    this._provider = _provider;
    this._extension = _extension;
    this._extTelemetry = _extTelemetry;
    this._logService = _logService;
    this._cache = new Cache("CodeLens");
    this._disposables = /* @__PURE__ */ new Map();
  }
  async provideCodeLenses(resource, token) {
    const doc = this._documents.getDocument(resource);
    const lenses = await this._provider.provideCodeLenses(doc, token);
    if (!lenses || token.isCancellationRequested) {
      return void 0;
    }
    const cacheId = this._cache.add(lenses);
    const disposables = new DisposableStore();
    this._disposables.set(cacheId, disposables);
    const result = {
      cacheId,
      lenses: []
    };
    for (let i = 0; i < lenses.length; i++) {
      if (!Range.isRange(lenses[i].range)) {
        console.warn("INVALID code lens, range is not defined", this._extension.identifier.value);
        continue;
      }
      result.lenses.push({
        cacheId: [cacheId, i],
        range: typeConvert.Range.from(lenses[i].range),
        command: this._commands.toInternal(lenses[i].command, disposables)
      });
    }
    return result;
  }
  async resolveCodeLens(symbol, token) {
    const lens = symbol.cacheId && this._cache.get(...symbol.cacheId);
    if (!lens) {
      return void 0;
    }
    let resolvedLens;
    if (typeof this._provider.resolveCodeLens !== "function" || lens.isResolved) {
      resolvedLens = lens;
    } else {
      resolvedLens = await this._provider.resolveCodeLens(lens, token);
    }
    if (!resolvedLens) {
      resolvedLens = lens;
    }
    if (token.isCancellationRequested) {
      return void 0;
    }
    const disposables = symbol.cacheId && this._disposables.get(symbol.cacheId[0]);
    if (!disposables) {
      return void 0;
    }
    if (!resolvedLens.command) {
      const error = new Error("INVALID code lens resolved, lacks command: " + this._extension.identifier.value);
      this._extTelemetry.onExtensionError(this._extension.identifier, error);
      this._logService.error(error);
      return void 0;
    }
    symbol.command = this._commands.toInternal(resolvedLens.command, disposables);
    return symbol;
  }
  releaseCodeLenses(cachedId) {
    this._disposables.get(cachedId)?.dispose();
    this._disposables.delete(cachedId);
    this._cache.delete(cachedId);
  }
}
function convertToLocationLinks(value) {
  if (Array.isArray(value)) {
    return value.map(typeConvert.DefinitionLink.from);
  } else if (value) {
    return [typeConvert.DefinitionLink.from(value)];
  }
  return [];
}
class DefinitionAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
  }
  async provideDefinition(resource, position, token) {
    const doc = this._documents.getDocument(resource);
    const pos = typeConvert.Position.to(position);
    const value = await this._provider.provideDefinition(doc, pos, token);
    return convertToLocationLinks(value);
  }
}
class DeclarationAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
  }
  async provideDeclaration(resource, position, token) {
    const doc = this._documents.getDocument(resource);
    const pos = typeConvert.Position.to(position);
    const value = await this._provider.provideDeclaration(doc, pos, token);
    return convertToLocationLinks(value);
  }
}
class ImplementationAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
  }
  async provideImplementation(resource, position, token) {
    const doc = this._documents.getDocument(resource);
    const pos = typeConvert.Position.to(position);
    const value = await this._provider.provideImplementation(doc, pos, token);
    return convertToLocationLinks(value);
  }
}
class TypeDefinitionAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
  }
  async provideTypeDefinition(resource, position, token) {
    const doc = this._documents.getDocument(resource);
    const pos = typeConvert.Position.to(position);
    const value = await this._provider.provideTypeDefinition(doc, pos, token);
    return convertToLocationLinks(value);
  }
}
class HoverAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
    this._hoverCounter = 0;
    this._hoverMap = /* @__PURE__ */ new Map();
  }
  static {
    this.HOVER_MAP_MAX_SIZE = 10;
  }
  async provideHover(resource, position, context, token) {
    const doc = this._documents.getDocument(resource);
    const pos = typeConvert.Position.to(position);
    let value;
    if (context && context.verbosityRequest) {
      const previousHoverId = context.verbosityRequest.previousHover.id;
      const previousHover = this._hoverMap.get(previousHoverId);
      if (!previousHover) {
        throw new Error(`Hover with id ${previousHoverId} not found`);
      }
      const hoverContext = { verbosityDelta: context.verbosityRequest.verbosityDelta, previousHover };
      value = await this._provider.provideHover(doc, pos, token, hoverContext);
    } else {
      value = await this._provider.provideHover(doc, pos, token);
    }
    if (!value || isFalsyOrEmpty(value.contents)) {
      return void 0;
    }
    if (!value.range) {
      value.range = doc.getWordRangeAtPosition(pos);
    }
    if (!value.range) {
      value.range = new Range(pos, pos);
    }
    const convertedHover = typeConvert.Hover.from(value);
    const id = this._hoverCounter;
    if (this._hoverMap.size === HoverAdapter.HOVER_MAP_MAX_SIZE) {
      const minimumId = Math.min(...this._hoverMap.keys());
      this._hoverMap.delete(minimumId);
    }
    this._hoverMap.set(id, value);
    this._hoverCounter += 1;
    const hover = {
      ...convertedHover,
      id
    };
    return hover;
  }
  releaseHover(id) {
    this._hoverMap.delete(id);
  }
}
class EvaluatableExpressionAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
  }
  async provideEvaluatableExpression(resource, position, token) {
    const doc = this._documents.getDocument(resource);
    const pos = typeConvert.Position.to(position);
    const value = await this._provider.provideEvaluatableExpression(doc, pos, token);
    if (value) {
      return typeConvert.EvaluatableExpression.from(value);
    }
    return void 0;
  }
}
class InlineValuesAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
  }
  async provideInlineValues(resource, viewPort, context, token) {
    const doc = this._documents.getDocument(resource);
    const value = await this._provider.provideInlineValues(doc, typeConvert.Range.to(viewPort), typeConvert.InlineValueContext.to(context), token);
    if (Array.isArray(value)) {
      return value.map((iv) => typeConvert.InlineValue.from(iv));
    }
    return void 0;
  }
}
class DocumentHighlightAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
  }
  async provideDocumentHighlights(resource, position, token) {
    const doc = this._documents.getDocument(resource);
    const pos = typeConvert.Position.to(position);
    const value = await this._provider.provideDocumentHighlights(doc, pos, token);
    if (Array.isArray(value)) {
      return value.map(typeConvert.DocumentHighlight.from);
    }
    return void 0;
  }
}
class MultiDocumentHighlightAdapter {
  constructor(_documents, _provider, _logService) {
    this._documents = _documents;
    this._provider = _provider;
    this._logService = _logService;
  }
  async provideMultiDocumentHighlights(resource, position, otherResources, token) {
    const doc = this._documents.getDocument(resource);
    const otherDocuments = otherResources.map((r) => {
      try {
        return this._documents.getDocument(r);
      } catch (err) {
        this._logService.error("Error: Unable to retrieve document from URI: " + r + ". Error message: " + err);
        return void 0;
      }
    }).filter((doc2) => doc2 !== void 0);
    const pos = typeConvert.Position.to(position);
    const value = await this._provider.provideMultiDocumentHighlights(doc, pos, otherDocuments, token);
    if (Array.isArray(value)) {
      return value.map(typeConvert.MultiDocumentHighlight.from);
    }
    return void 0;
  }
}
class LinkedEditingRangeAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
  }
  async provideLinkedEditingRanges(resource, position, token) {
    const doc = this._documents.getDocument(resource);
    const pos = typeConvert.Position.to(position);
    const value = await this._provider.provideLinkedEditingRanges(doc, pos, token);
    if (value && Array.isArray(value.ranges)) {
      return {
        ranges: coalesce(value.ranges.map(typeConvert.Range.from)),
        wordPattern: value.wordPattern
      };
    }
    return void 0;
  }
}
class ReferenceAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
  }
  async provideReferences(resource, position, context, token) {
    const doc = this._documents.getDocument(resource);
    const pos = typeConvert.Position.to(position);
    const value = await this._provider.provideReferences(doc, pos, context, token);
    if (Array.isArray(value)) {
      return value.map(typeConvert.location.from);
    }
    return void 0;
  }
}
class CodeActionAdapter {
  constructor(_documents, _commands, _diagnostics, _provider, _logService, _extension, _apiDeprecation) {
    this._documents = _documents;
    this._commands = _commands;
    this._diagnostics = _diagnostics;
    this._provider = _provider;
    this._logService = _logService;
    this._extension = _extension;
    this._apiDeprecation = _apiDeprecation;
    this._cache = new Cache("CodeAction");
    this._disposables = /* @__PURE__ */ new Map();
  }
  static {
    this._maxCodeActionsPerFile = 1e3;
  }
  async provideCodeActions(resource, rangeOrSelection, context, token) {
    const doc = this._documents.getDocument(resource);
    const ran = Selection.isISelection(rangeOrSelection) ? typeConvert.Selection.to(rangeOrSelection) : typeConvert.Range.to(rangeOrSelection);
    const allDiagnostics = [];
    for (const diagnostic of this._diagnostics.getDiagnostics(resource)) {
      if (ran.intersection(diagnostic.range)) {
        const newLen = allDiagnostics.push(diagnostic);
        if (newLen > CodeActionAdapter._maxCodeActionsPerFile) {
          break;
        }
      }
    }
    const codeActionContext = {
      diagnostics: allDiagnostics,
      only: context.only ? new CodeActionKind(context.only) : void 0,
      triggerKind: typeConvert.CodeActionTriggerKind.to(context.trigger)
    };
    const commandsOrActions = await this._provider.provideCodeActions(doc, ran, codeActionContext, token);
    if (!isNonEmptyArray(commandsOrActions) || token.isCancellationRequested) {
      return void 0;
    }
    const cacheId = this._cache.add(commandsOrActions);
    const disposables = new DisposableStore();
    this._disposables.set(cacheId, disposables);
    const actions = [];
    for (let i = 0; i < commandsOrActions.length; i++) {
      const candidate = commandsOrActions[i];
      if (!candidate) {
        continue;
      }
      if (CodeActionAdapter._isCommand(candidate) && !(candidate instanceof CodeAction)) {
        this._apiDeprecation.report(
          "CodeActionProvider.provideCodeActions - return commands",
          this._extension,
          `Return 'CodeAction' instances instead.`
        );
        actions.push({
          _isSynthetic: true,
          title: candidate.title,
          command: this._commands.toInternal(candidate, disposables)
        });
      } else {
        const toConvert = candidate;
        if (codeActionContext.only) {
          if (!toConvert.kind) {
            this._logService.warn(`${this._extension.identifier.value} - Code actions of kind '${codeActionContext.only.value}' requested but returned code action does not have a 'kind'. Code action will be dropped. Please set 'CodeAction.kind'.`);
          } else if (!codeActionContext.only.contains(toConvert.kind)) {
            this._logService.warn(`${this._extension.identifier.value} - Code actions of kind '${codeActionContext.only.value}' requested but returned code action is of kind '${toConvert.kind.value}'. Code action will be dropped. Please check 'CodeActionContext.only' to only return requested code actions.`);
          }
        }
        const range = toConvert.ranges ?? [];
        actions.push({
          cacheId: [cacheId, i],
          title: toConvert.title,
          command: toConvert.command && this._commands.toInternal(toConvert.command, disposables),
          diagnostics: toConvert.diagnostics && toConvert.diagnostics.map(typeConvert.Diagnostic.from),
          edit: toConvert.edit && typeConvert.WorkspaceEdit.from(toConvert.edit, void 0),
          kind: toConvert.kind && toConvert.kind.value,
          isPreferred: toConvert.isPreferred,
          isAI: isProposedApiEnabled(this._extension, "codeActionAI") ? toConvert.isAI : false,
          ranges: isProposedApiEnabled(this._extension, "codeActionRanges") ? coalesce(range.map(typeConvert.Range.from)) : void 0,
          disabled: toConvert.disabled?.reason
        });
      }
    }
    return { cacheId, actions };
  }
  async resolveCodeAction(id, token) {
    const [sessionId, itemId] = id;
    const item = this._cache.get(sessionId, itemId);
    if (!item || CodeActionAdapter._isCommand(item)) {
      return {};
    }
    if (!this._provider.resolveCodeAction) {
      return {};
    }
    const resolvedItem = await this._provider.resolveCodeAction(item, token) ?? item;
    let resolvedEdit;
    if (resolvedItem.edit) {
      resolvedEdit = typeConvert.WorkspaceEdit.from(resolvedItem.edit, void 0);
    }
    let resolvedCommand;
    if (resolvedItem.command) {
      const disposables = this._disposables.get(sessionId);
      if (disposables) {
        resolvedCommand = this._commands.toInternal(resolvedItem.command, disposables);
      }
    }
    return { edit: resolvedEdit, command: resolvedCommand };
  }
  releaseCodeActions(cachedId) {
    this._disposables.get(cachedId)?.dispose();
    this._disposables.delete(cachedId);
    this._cache.delete(cachedId);
  }
  static _isCommand(thing) {
    return typeof thing.command === "string" && typeof thing.title === "string";
  }
}
class DocumentPasteEditProvider {
  constructor(_proxy, _documents, _provider, _handle, _extension) {
    this._proxy = _proxy;
    this._documents = _documents;
    this._provider = _provider;
    this._handle = _handle;
    this._extension = _extension;
    this._editsCache = new Cache("DocumentPasteEdit.edits");
  }
  async prepareDocumentPaste(resource, ranges, dataTransferDto, token) {
    if (!this._provider.prepareDocumentPaste) {
      return;
    }
    this._cachedPrepare = void 0;
    const doc = this._documents.getDocument(resource);
    const vscodeRanges = ranges.map((range) => typeConvert.Range.to(range));
    const dataTransfer = typeConvert.DataTransfer.toDataTransfer(dataTransferDto, () => {
      throw new NotImplementedError();
    });
    await this._provider.prepareDocumentPaste(doc, vscodeRanges, dataTransfer, token);
    if (token.isCancellationRequested) {
      return;
    }
    const newEntries = Array.from(dataTransfer).filter(([, value]) => !(value instanceof InternalDataTransferItem));
    const newCache = /* @__PURE__ */ new Map();
    const items = await Promise.all(Array.from(newEntries, async ([mime, value]) => {
      const id = generateUuid();
      newCache.set(id, value);
      return [mime, await typeConvert.DataTransferItem.from(mime, value, id)];
    }));
    this._cachedPrepare = newCache;
    return { items };
  }
  async providePasteEdits(requestId, resource, ranges, dataTransferDto, context, token) {
    if (!this._provider.provideDocumentPasteEdits) {
      return [];
    }
    const doc = this._documents.getDocument(resource);
    const vscodeRanges = ranges.map((range) => typeConvert.Range.to(range));
    const items = dataTransferDto.items.map(([mime, value]) => {
      const cached = this._cachedPrepare?.get(value.id);
      if (cached) {
        return [mime, cached];
      }
      return [
        mime,
        typeConvert.DataTransferItem.to(mime, value, async (id) => {
          return (await this._proxy.$resolvePasteFileData(this._handle, requestId, id)).buffer;
        })
      ];
    });
    const dataTransfer = new DataTransfer(items);
    const edits = await this._provider.provideDocumentPasteEdits(doc, vscodeRanges, dataTransfer, {
      only: context.only ? new DocumentDropOrPasteEditKind(context.only) : void 0,
      triggerKind: context.triggerKind
    }, token);
    if (!edits || token.isCancellationRequested) {
      return [];
    }
    const cacheId = this._editsCache.add(edits);
    return edits.map((edit, i) => ({
      _cacheId: [cacheId, i],
      title: edit.title ?? localize("defaultPasteLabel", "Paste using '{0}' extension", this._extension.displayName || this._extension.name),
      kind: edit.kind,
      yieldTo: edit.yieldTo?.map((x) => x.value),
      insertText: typeof edit.insertText === "string" ? edit.insertText : { snippet: edit.insertText.value },
      additionalEdit: edit.additionalEdit ? typeConvert.WorkspaceEdit.from(edit.additionalEdit, void 0) : void 0
    }));
  }
  async resolvePasteEdit(id, token) {
    const [sessionId, itemId] = id;
    const item = this._editsCache.get(sessionId, itemId);
    if (!item || !this._provider.resolveDocumentPasteEdit) {
      return {};
    }
    const resolvedItem = await this._provider.resolveDocumentPasteEdit(item, token) ?? item;
    return {
      insertText: resolvedItem.insertText,
      additionalEdit: resolvedItem.additionalEdit ? typeConvert.WorkspaceEdit.from(resolvedItem.additionalEdit, void 0) : void 0
    };
  }
  releasePasteEdits(id) {
    this._editsCache.delete(id);
  }
}
class DocumentFormattingAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
  }
  async provideDocumentFormattingEdits(resource, options, token) {
    const document = this._documents.getDocument(resource);
    const value = await this._provider.provideDocumentFormattingEdits(document, options, token);
    if (Array.isArray(value)) {
      return value.map(typeConvert.TextEdit.from);
    }
    return void 0;
  }
}
class RangeFormattingAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
  }
  async provideDocumentRangeFormattingEdits(resource, range, options, token) {
    const document = this._documents.getDocument(resource);
    const ran = typeConvert.Range.to(range);
    const value = await this._provider.provideDocumentRangeFormattingEdits(document, ran, options, token);
    if (Array.isArray(value)) {
      return value.map(typeConvert.TextEdit.from);
    }
    return void 0;
  }
  async provideDocumentRangesFormattingEdits(resource, ranges, options, token) {
    assertType(typeof this._provider.provideDocumentRangesFormattingEdits === "function", "INVALID invocation of `provideDocumentRangesFormattingEdits`");
    const document = this._documents.getDocument(resource);
    const _ranges = ranges.map(typeConvert.Range.to);
    const value = await this._provider.provideDocumentRangesFormattingEdits(document, _ranges, options, token);
    if (Array.isArray(value)) {
      return value.map(typeConvert.TextEdit.from);
    }
    return void 0;
  }
}
class OnTypeFormattingAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
    this.autoFormatTriggerCharacters = [];
  }
  // not here
  async provideOnTypeFormattingEdits(resource, position, ch, options, token) {
    const document = this._documents.getDocument(resource);
    const pos = typeConvert.Position.to(position);
    const value = await this._provider.provideOnTypeFormattingEdits(document, pos, ch, options, token);
    if (Array.isArray(value)) {
      return value.map(typeConvert.TextEdit.from);
    }
    return void 0;
  }
}
class NavigateTypeAdapter {
  constructor(_provider, _logService) {
    this._provider = _provider;
    this._logService = _logService;
    this._cache = new Cache("WorkspaceSymbols");
  }
  async provideWorkspaceSymbols(search, token) {
    const value = await this._provider.provideWorkspaceSymbols(search, token);
    if (!isNonEmptyArray(value)) {
      return { symbols: [] };
    }
    const sid = this._cache.add(value);
    const result = {
      cacheId: sid,
      symbols: []
    };
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      if (!item || !item.name) {
        this._logService.warn("INVALID SymbolInformation", item);
        continue;
      }
      result.symbols.push({
        ...typeConvert.WorkspaceSymbol.from(item),
        cacheId: [sid, i]
      });
    }
    return result;
  }
  async resolveWorkspaceSymbol(symbol, token) {
    if (typeof this._provider.resolveWorkspaceSymbol !== "function") {
      return symbol;
    }
    if (!symbol.cacheId) {
      return symbol;
    }
    const item = this._cache.get(...symbol.cacheId);
    if (item) {
      const value = await this._provider.resolveWorkspaceSymbol(item, token);
      return value && mixin(symbol, typeConvert.WorkspaceSymbol.from(value), true);
    }
    return void 0;
  }
  releaseWorkspaceSymbols(id) {
    this._cache.delete(id);
  }
}
class RenameAdapter {
  constructor(_documents, _provider, _logService) {
    this._documents = _documents;
    this._provider = _provider;
    this._logService = _logService;
  }
  static supportsResolving(provider) {
    return typeof provider.prepareRename === "function";
  }
  async provideRenameEdits(resource, position, newName, token) {
    const doc = this._documents.getDocument(resource);
    const pos = typeConvert.Position.to(position);
    try {
      const value = await this._provider.provideRenameEdits(doc, pos, newName, token);
      if (!value) {
        return void 0;
      }
      return typeConvert.WorkspaceEdit.from(value);
    } catch (err) {
      const rejectReason = RenameAdapter._asMessage(err);
      if (rejectReason) {
        return { rejectReason, edits: void 0 };
      } else {
        return Promise.reject(err);
      }
    }
  }
  async resolveRenameLocation(resource, position, token) {
    if (typeof this._provider.prepareRename !== "function") {
      return Promise.resolve(void 0);
    }
    const doc = this._documents.getDocument(resource);
    const pos = typeConvert.Position.to(position);
    try {
      const rangeOrLocation = await this._provider.prepareRename(doc, pos, token);
      let range;
      let text;
      if (Range.isRange(rangeOrLocation)) {
        range = rangeOrLocation;
        text = doc.getText(rangeOrLocation);
      } else if (isObject(rangeOrLocation)) {
        range = rangeOrLocation.range;
        text = rangeOrLocation.placeholder;
      }
      if (!range || !text) {
        return void 0;
      }
      if (range.start.line > pos.line || range.end.line < pos.line) {
        this._logService.warn("INVALID rename location: position line must be within range start/end lines");
        return void 0;
      }
      return { range: typeConvert.Range.from(range), text };
    } catch (err) {
      const rejectReason = RenameAdapter._asMessage(err);
      if (rejectReason) {
        return { rejectReason, range: void 0, text: void 0 };
      } else {
        return Promise.reject(err);
      }
    }
  }
  static _asMessage(err) {
    if (typeof err === "string") {
      return err;
    } else if (err instanceof Error && typeof err.message === "string") {
      return err.message;
    } else {
      return void 0;
    }
  }
}
class NewSymbolNamesAdapter {
  constructor(_documents, _provider, _logService) {
    this._documents = _documents;
    this._provider = _provider;
    this._logService = _logService;
  }
  static {
    this.languageTriggerKindToVSCodeTriggerKind = {
      [languages.NewSymbolNameTriggerKind.Invoke]: NewSymbolNameTriggerKind.Invoke,
      [languages.NewSymbolNameTriggerKind.Automatic]: NewSymbolNameTriggerKind.Automatic
    };
  }
  async supportsAutomaticNewSymbolNamesTriggerKind() {
    return this._provider.supportsAutomaticTriggerKind;
  }
  async provideNewSymbolNames(resource, range, triggerKind, token) {
    const doc = this._documents.getDocument(resource);
    const pos = typeConvert.Range.to(range);
    try {
      const kind = NewSymbolNamesAdapter.languageTriggerKindToVSCodeTriggerKind[triggerKind];
      const value = await this._provider.provideNewSymbolNames(doc, pos, kind, token);
      if (!value) {
        return void 0;
      }
      return value.map(
        (v) => typeof v === "string" ? { newSymbolName: v } : { newSymbolName: v.newSymbolName, tags: v.tags }
      );
    } catch (err) {
      this._logService.error(
        NewSymbolNamesAdapter._asMessage(err) ?? JSON.stringify(err, null, "	")
        /* @ulugbekna: assuming `err` doesn't have circular references that could result in an exception when converting to JSON */
      );
      return void 0;
    }
  }
  // @ulugbekna: this method is also defined in RenameAdapter but seems OK to be duplicated
  static _asMessage(err) {
    if (typeof err === "string") {
      return err;
    } else if (err instanceof Error && typeof err.message === "string") {
      return err.message;
    } else {
      return void 0;
    }
  }
}
class SemanticTokensPreviousResult {
  constructor(resultId, tokens) {
    this.resultId = resultId;
    this.tokens = tokens;
  }
}
class DocumentSemanticTokensAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
    this._nextResultId = 1;
    this._previousResults = /* @__PURE__ */ new Map();
  }
  async provideDocumentSemanticTokens(resource, previousResultId, token) {
    const doc = this._documents.getDocument(resource);
    const previousResult = previousResultId !== 0 ? this._previousResults.get(previousResultId) : null;
    let value = typeof previousResult?.resultId === "string" && typeof this._provider.provideDocumentSemanticTokensEdits === "function" ? await this._provider.provideDocumentSemanticTokensEdits(doc, previousResult.resultId, token) : await this._provider.provideDocumentSemanticTokens(doc, token);
    if (previousResult) {
      this._previousResults.delete(previousResultId);
    }
    if (!value) {
      return null;
    }
    value = DocumentSemanticTokensAdapter._fixProvidedSemanticTokens(value);
    return this._send(DocumentSemanticTokensAdapter._convertToEdits(previousResult, value), value);
  }
  async releaseDocumentSemanticColoring(semanticColoringResultId) {
    this._previousResults.delete(semanticColoringResultId);
  }
  static _fixProvidedSemanticTokens(v) {
    if (DocumentSemanticTokensAdapter._isSemanticTokens(v)) {
      if (DocumentSemanticTokensAdapter._isCorrectSemanticTokens(v)) {
        return v;
      }
      return new SemanticTokens(new Uint32Array(v.data), v.resultId);
    } else if (DocumentSemanticTokensAdapter._isSemanticTokensEdits(v)) {
      if (DocumentSemanticTokensAdapter._isCorrectSemanticTokensEdits(v)) {
        return v;
      }
      return new SemanticTokensEdits(v.edits.map((edit) => new SemanticTokensEdit(edit.start, edit.deleteCount, edit.data ? new Uint32Array(edit.data) : edit.data)), v.resultId);
    }
    return v;
  }
  static _isSemanticTokens(v) {
    return v && !!v.data;
  }
  static _isCorrectSemanticTokens(v) {
    return v.data instanceof Uint32Array;
  }
  static _isSemanticTokensEdits(v) {
    return v && Array.isArray(v.edits);
  }
  static _isCorrectSemanticTokensEdits(v) {
    for (const edit of v.edits) {
      if (!(edit.data instanceof Uint32Array)) {
        return false;
      }
    }
    return true;
  }
  static _convertToEdits(previousResult, newResult) {
    if (!DocumentSemanticTokensAdapter._isSemanticTokens(newResult)) {
      return newResult;
    }
    if (!previousResult || !previousResult.tokens) {
      return newResult;
    }
    const oldData = previousResult.tokens;
    const oldLength = oldData.length;
    const newData = newResult.data;
    const newLength = newData.length;
    let commonPrefixLength = 0;
    const maxCommonPrefixLength = Math.min(oldLength, newLength);
    while (commonPrefixLength < maxCommonPrefixLength && oldData[commonPrefixLength] === newData[commonPrefixLength]) {
      commonPrefixLength++;
    }
    if (commonPrefixLength === oldLength && commonPrefixLength === newLength) {
      return new SemanticTokensEdits([], newResult.resultId);
    }
    let commonSuffixLength = 0;
    const maxCommonSuffixLength = maxCommonPrefixLength - commonPrefixLength;
    while (commonSuffixLength < maxCommonSuffixLength && oldData[oldLength - commonSuffixLength - 1] === newData[newLength - commonSuffixLength - 1]) {
      commonSuffixLength++;
    }
    return new SemanticTokensEdits([{
      start: commonPrefixLength,
      deleteCount: oldLength - commonPrefixLength - commonSuffixLength,
      data: newData.subarray(commonPrefixLength, newLength - commonSuffixLength)
    }], newResult.resultId);
  }
  _send(value, original) {
    if (DocumentSemanticTokensAdapter._isSemanticTokens(value)) {
      const myId = this._nextResultId++;
      this._previousResults.set(myId, new SemanticTokensPreviousResult(value.resultId, value.data));
      return encodeSemanticTokensDto({
        id: myId,
        type: "full",
        data: value.data
      });
    }
    if (DocumentSemanticTokensAdapter._isSemanticTokensEdits(value)) {
      const myId = this._nextResultId++;
      if (DocumentSemanticTokensAdapter._isSemanticTokens(original)) {
        this._previousResults.set(myId, new SemanticTokensPreviousResult(original.resultId, original.data));
      } else {
        this._previousResults.set(myId, new SemanticTokensPreviousResult(value.resultId));
      }
      return encodeSemanticTokensDto({
        id: myId,
        type: "delta",
        deltas: (value.edits || []).map((edit) => ({ start: edit.start, deleteCount: edit.deleteCount, data: edit.data }))
      });
    }
    return null;
  }
}
class DocumentRangeSemanticTokensAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
  }
  async provideDocumentRangeSemanticTokens(resource, range, token) {
    const doc = this._documents.getDocument(resource);
    const value = await this._provider.provideDocumentRangeSemanticTokens(doc, typeConvert.Range.to(range), token);
    if (!value) {
      return null;
    }
    return this._send(value);
  }
  _send(value) {
    return encodeSemanticTokensDto({
      id: 0,
      type: "full",
      data: value.data
    });
  }
}
class CompletionsAdapter {
  constructor(_documents, _commands, _provider, _apiDeprecation, _extension) {
    this._documents = _documents;
    this._commands = _commands;
    this._provider = _provider;
    this._apiDeprecation = _apiDeprecation;
    this._extension = _extension;
    this._cache = new Cache("CompletionItem");
    this._disposables = /* @__PURE__ */ new Map();
  }
  static supportsResolving(provider) {
    return typeof provider.resolveCompletionItem === "function";
  }
  async provideCompletionItems(resource, position, context, token) {
    const doc = this._documents.getDocument(resource);
    const pos = typeConvert.Position.to(position);
    const replaceRange = doc.getWordRangeAtPosition(pos) || new Range(pos, pos);
    const insertRange = replaceRange.with({ end: pos });
    const sw = new StopWatch();
    const itemsOrList = await this._provider.provideCompletionItems(doc, pos, token, typeConvert.CompletionContext.to(context));
    if (!itemsOrList) {
      return void 0;
    }
    if (token.isCancellationRequested) {
      return void 0;
    }
    const list = Array.isArray(itemsOrList) ? new CompletionList(itemsOrList) : itemsOrList;
    const pid = CompletionsAdapter.supportsResolving(this._provider) ? this._cache.add(list.items) : this._cache.add([]);
    const disposables = new DisposableStore();
    this._disposables.set(pid, disposables);
    const completions = [];
    const result = {
      x: pid,
      [extHostProtocol.ISuggestResultDtoField.completions]: completions,
      [extHostProtocol.ISuggestResultDtoField.defaultRanges]: { replace: typeConvert.Range.from(replaceRange), insert: typeConvert.Range.from(insertRange) },
      [extHostProtocol.ISuggestResultDtoField.isIncomplete]: list.isIncomplete || void 0,
      [extHostProtocol.ISuggestResultDtoField.duration]: sw.elapsed()
    };
    for (let i = 0; i < list.items.length; i++) {
      const item = list.items[i];
      const dto = this._convertCompletionItem(item, [pid, i], insertRange, replaceRange);
      completions.push(dto);
    }
    return result;
  }
  async resolveCompletionItem(id, token) {
    if (typeof this._provider.resolveCompletionItem !== "function") {
      return void 0;
    }
    const item = this._cache.get(...id);
    if (!item) {
      return void 0;
    }
    const dto1 = this._convertCompletionItem(item, id);
    const resolvedItem = await this._provider.resolveCompletionItem(item, token);
    if (!resolvedItem) {
      return void 0;
    }
    const dto2 = this._convertCompletionItem(resolvedItem, id);
    if (dto1[extHostProtocol.ISuggestDataDtoField.insertText] !== dto2[extHostProtocol.ISuggestDataDtoField.insertText] || dto1[extHostProtocol.ISuggestDataDtoField.insertTextRules] !== dto2[extHostProtocol.ISuggestDataDtoField.insertTextRules]) {
      this._apiDeprecation.report("CompletionItem.insertText", this._extension, "extension MAY NOT change 'insertText' of a CompletionItem during resolve");
    }
    if (dto1[extHostProtocol.ISuggestDataDtoField.commandIdent] !== dto2[extHostProtocol.ISuggestDataDtoField.commandIdent] || dto1[extHostProtocol.ISuggestDataDtoField.commandId] !== dto2[extHostProtocol.ISuggestDataDtoField.commandId] || !equals(dto1[extHostProtocol.ISuggestDataDtoField.commandArguments], dto2[extHostProtocol.ISuggestDataDtoField.commandArguments])) {
      this._apiDeprecation.report("CompletionItem.command", this._extension, "extension MAY NOT change 'command' of a CompletionItem during resolve");
    }
    return {
      ...dto1,
      [extHostProtocol.ISuggestDataDtoField.documentation]: dto2[extHostProtocol.ISuggestDataDtoField.documentation],
      [extHostProtocol.ISuggestDataDtoField.detail]: dto2[extHostProtocol.ISuggestDataDtoField.detail],
      [extHostProtocol.ISuggestDataDtoField.additionalTextEdits]: dto2[extHostProtocol.ISuggestDataDtoField.additionalTextEdits],
      // (fishy) async insertText
      [extHostProtocol.ISuggestDataDtoField.insertText]: dto2[extHostProtocol.ISuggestDataDtoField.insertText],
      [extHostProtocol.ISuggestDataDtoField.insertTextRules]: dto2[extHostProtocol.ISuggestDataDtoField.insertTextRules],
      // (fishy) async command
      [extHostProtocol.ISuggestDataDtoField.commandIdent]: dto2[extHostProtocol.ISuggestDataDtoField.commandIdent],
      [extHostProtocol.ISuggestDataDtoField.commandId]: dto2[extHostProtocol.ISuggestDataDtoField.commandId],
      [extHostProtocol.ISuggestDataDtoField.commandArguments]: dto2[extHostProtocol.ISuggestDataDtoField.commandArguments]
    };
  }
  releaseCompletionItems(id) {
    this._disposables.get(id)?.dispose();
    this._disposables.delete(id);
    this._cache.delete(id);
  }
  _convertCompletionItem(item, id, defaultInsertRange, defaultReplaceRange) {
    const disposables = this._disposables.get(id[0]);
    if (!disposables) {
      throw Error("DisposableStore is missing...");
    }
    const command = this._commands.toInternal(item.command, disposables);
    const result = {
      //
      x: id,
      //
      [extHostProtocol.ISuggestDataDtoField.label]: item.label,
      [extHostProtocol.ISuggestDataDtoField.kind]: item.kind !== void 0 ? typeConvert.CompletionItemKind.from(item.kind) : void 0,
      [extHostProtocol.ISuggestDataDtoField.kindModifier]: item.tags && item.tags.map(typeConvert.CompletionItemTag.from),
      [extHostProtocol.ISuggestDataDtoField.detail]: item.detail,
      [extHostProtocol.ISuggestDataDtoField.documentation]: typeof item.documentation === "undefined" ? void 0 : typeConvert.MarkdownString.fromStrict(item.documentation),
      [extHostProtocol.ISuggestDataDtoField.sortText]: item.sortText !== item.label ? item.sortText : void 0,
      [extHostProtocol.ISuggestDataDtoField.filterText]: item.filterText !== item.label ? item.filterText : void 0,
      [extHostProtocol.ISuggestDataDtoField.preselect]: item.preselect || void 0,
      [extHostProtocol.ISuggestDataDtoField.insertTextRules]: item.keepWhitespace ? languages.CompletionItemInsertTextRule.KeepWhitespace : languages.CompletionItemInsertTextRule.None,
      [extHostProtocol.ISuggestDataDtoField.commitCharacters]: item.commitCharacters?.join(""),
      [extHostProtocol.ISuggestDataDtoField.additionalTextEdits]: item.additionalTextEdits && item.additionalTextEdits.map(typeConvert.TextEdit.from),
      [extHostProtocol.ISuggestDataDtoField.commandIdent]: command?.$ident,
      [extHostProtocol.ISuggestDataDtoField.commandId]: command?.id,
      [extHostProtocol.ISuggestDataDtoField.commandArguments]: command?.$ident ? void 0 : command?.arguments
      // filled in on main side from $ident
    };
    if (item.textEdit) {
      this._apiDeprecation.report("CompletionItem.textEdit", this._extension, `Use 'CompletionItem.insertText' and 'CompletionItem.range' instead.`);
      result[extHostProtocol.ISuggestDataDtoField.insertText] = item.textEdit.newText;
    } else if (typeof item.insertText === "string") {
      result[extHostProtocol.ISuggestDataDtoField.insertText] = item.insertText;
    } else if (item.insertText instanceof SnippetString) {
      result[extHostProtocol.ISuggestDataDtoField.insertText] = item.insertText.value;
      result[extHostProtocol.ISuggestDataDtoField.insertTextRules] |= languages.CompletionItemInsertTextRule.InsertAsSnippet;
    }
    let range;
    if (item.textEdit) {
      range = item.textEdit.range;
    } else if (item.range) {
      range = item.range;
    }
    if (Range.isRange(range)) {
      result[extHostProtocol.ISuggestDataDtoField.range] = typeConvert.Range.from(range);
    } else if (range && (!defaultInsertRange?.isEqual(range.inserting) || !defaultReplaceRange?.isEqual(range.replacing))) {
      result[extHostProtocol.ISuggestDataDtoField.range] = {
        insert: typeConvert.Range.from(range.inserting),
        replace: typeConvert.Range.from(range.replacing)
      };
    }
    return result;
  }
}
class InlineCompletionAdapter {
  constructor(_extension, _documents, _provider, _commands) {
    this._extension = _extension;
    this._documents = _documents;
    this._provider = _provider;
    this._commands = _commands;
    this._references = new ReferenceMap();
    this.languageTriggerKindToVSCodeTriggerKind = {
      [languages.InlineCompletionTriggerKind.Automatic]: InlineCompletionTriggerKind.Automatic,
      [languages.InlineCompletionTriggerKind.Explicit]: InlineCompletionTriggerKind.Invoke
    };
    this._isAdditionsProposedApiEnabled = isProposedApiEnabled(this._extension, "inlineCompletionsAdditions");
  }
  get supportsHandleEvents() {
    return isProposedApiEnabled(this._extension, "inlineCompletionsAdditions") && (typeof this._provider.handleDidShowCompletionItem === "function" || typeof this._provider.handleDidPartiallyAcceptCompletionItem === "function" || typeof this._provider.handleDidRejectCompletionItem === "function" || typeof this._provider.handleEndOfLifetime === "function");
  }
  get supportsSetModelId() {
    return isProposedApiEnabled(this._extension, "inlineCompletionsAdditions") && typeof this._provider.setCurrentModelId === "function";
  }
  get supportsSetProviderOption() {
    return isProposedApiEnabled(this._extension, "inlineCompletionsAdditions") && typeof this._provider.setProviderOptionValue === "function";
  }
  get modelInfo() {
    if (!this._isAdditionsProposedApiEnabled) {
      return void 0;
    }
    return this._provider.modelInfo ? {
      models: this._provider.modelInfo.models,
      currentModelId: this._provider.modelInfo.currentModelId
    } : void 0;
  }
  setCurrentModelId(modelId) {
    if (!this._isAdditionsProposedApiEnabled) {
      return;
    }
    this._provider.setCurrentModelId?.(modelId);
  }
  get providerOptions() {
    if (!this._isAdditionsProposedApiEnabled) {
      return void 0;
    }
    return this._provider.providerOptions?.map((o) => ({
      id: o.id,
      label: o.label,
      values: o.values.map((v) => ({ id: v.id, label: v.label })),
      currentValueId: o.currentValueId
    }));
  }
  setProviderOption(optionId, valueId) {
    if (!this._isAdditionsProposedApiEnabled) {
      return;
    }
    this._provider.setProviderOptionValue?.(optionId, valueId);
  }
  async provideInlineCompletions(resource, position, context, token) {
    const doc = this._documents.getDocument(resource);
    const pos = typeConvert.Position.to(position);
    const result = await this._provider.provideInlineCompletionItems(doc, pos, {
      selectedCompletionInfo: context.selectedSuggestionInfo ? {
        range: typeConvert.Range.to(context.selectedSuggestionInfo.range),
        text: context.selectedSuggestionInfo.text
      } : void 0,
      triggerKind: this.languageTriggerKindToVSCodeTriggerKind[context.triggerKind],
      requestUuid: context.requestUuid,
      requestIssuedDateTime: context.requestIssuedDateTime,
      earliestShownDateTime: context.earliestShownDateTime,
      changeHint: context.changeHint
    }, token);
    if (!result) {
      return void 0;
    }
    const { resultItems, list } = Array.isArray(result) ? { resultItems: result, list: void 0 } : { resultItems: result.items, list: result };
    const commands = this._isAdditionsProposedApiEnabled ? Array.isArray(result) ? [] : result.commands || [] : [];
    const enableForwardStability = this._isAdditionsProposedApiEnabled && !Array.isArray(result) ? result.enableForwardStability : void 0;
    let disposableStore = void 0;
    const pid = this._references.createReferenceId({
      dispose() {
        disposableStore?.dispose();
      },
      items: resultItems,
      list
    });
    const items = {
      pid,
      languageId: doc.languageId,
      items: resultItems.map((item, idx) => {
        let command = void 0;
        if (item.command) {
          if (!disposableStore) {
            disposableStore = new DisposableStore();
          }
          command = this._commands.toInternal(item.command, disposableStore);
        }
        let action = void 0;
        if (item.action) {
          if (!disposableStore) {
            disposableStore = new DisposableStore();
          }
          action = this._commands.toInternal(item.action, disposableStore);
        }
        const insertText = item.insertText;
        return {
          insertText: insertText === void 0 ? void 0 : typeof insertText === "string" ? insertText : { snippet: insertText.value },
          range: item.range ? typeConvert.Range.from(item.range) : void 0,
          showRange: this._isAdditionsProposedApiEnabled && item.showRange ? typeConvert.Range.from(item.showRange) : void 0,
          command,
          gutterMenuLinkAction: action,
          pid,
          idx,
          completeBracketPairs: this._isAdditionsProposedApiEnabled ? item.completeBracketPairs : false,
          isInlineEdit: this._isAdditionsProposedApiEnabled ? item.isInlineEdit : false,
          showInlineEditMenu: this._isAdditionsProposedApiEnabled ? item.showInlineEditMenu : false,
          hint: item.displayLocation && this._isAdditionsProposedApiEnabled ? {
            range: typeConvert.Range.from(item.displayLocation.range),
            content: item.displayLocation.label,
            style: item.displayLocation.kind ? typeConvert.InlineCompletionHintStyle.from(item.displayLocation.kind) : languages.InlineCompletionHintStyle.Code
          } : void 0,
          warning: item.warning && this._isAdditionsProposedApiEnabled ? {
            message: typeConvert.MarkdownString.from(item.warning.message),
            icon: item.warning.icon ? typeConvert.IconPath.fromThemeIcon(item.warning.icon) : void 0
          } : void 0,
          correlationId: this._isAdditionsProposedApiEnabled ? item.correlationId : void 0,
          suggestionId: void 0,
          uri: this._isAdditionsProposedApiEnabled && item.uri ? item.uri : void 0,
          supportsRename: this._isAdditionsProposedApiEnabled ? item.supportsRename : false,
          jumpToPosition: this._isAdditionsProposedApiEnabled && item.jumpToPosition ? typeConvert.Position.from(item.jumpToPosition) : void 0
        };
      }),
      commands: commands.map((c) => {
        if (!disposableStore) {
          disposableStore = new DisposableStore();
        }
        return typeConvert.CompletionCommand.from(c, this._commands, disposableStore);
      }),
      suppressSuggestions: false,
      enableForwardStability
    };
    return items;
  }
  disposeCompletions(pid, reason) {
    const completionList = this._references.get(pid);
    if (this._provider.handleListEndOfLifetime && this._isAdditionsProposedApiEnabled && completionList?.list) {
      let translateReason = function(reason2) {
        switch (reason2.kind) {
          case "lostRace":
            return { kind: InlineCompletionsDisposeReasonKind.LostRace };
          case "tokenCancellation":
            return { kind: InlineCompletionsDisposeReasonKind.TokenCancellation };
          case "other":
            return { kind: InlineCompletionsDisposeReasonKind.Other };
          case "empty":
            return { kind: InlineCompletionsDisposeReasonKind.Empty };
          case "notTaken":
            return { kind: InlineCompletionsDisposeReasonKind.NotTaken };
          default:
            return { kind: InlineCompletionsDisposeReasonKind.Other };
        }
      };
      this._provider.handleListEndOfLifetime(completionList.list, translateReason(reason));
    }
    const data = this._references.disposeReferenceId(pid);
    data?.dispose();
  }
  handleDidShowCompletionItem(pid, idx, updatedInsertText) {
    const completionItem = this._references.get(pid)?.items[idx];
    if (completionItem) {
      if (this._provider.handleDidShowCompletionItem && this._isAdditionsProposedApiEnabled) {
        this._provider.handleDidShowCompletionItem(completionItem, updatedInsertText);
      }
    }
  }
  handlePartialAccept(pid, idx, acceptedCharacters, info) {
    const completionItem = this._references.get(pid)?.items[idx];
    if (completionItem) {
      if (this._provider.handleDidPartiallyAcceptCompletionItem && this._isAdditionsProposedApiEnabled) {
        this._provider.handleDidPartiallyAcceptCompletionItem(completionItem, acceptedCharacters);
        this._provider.handleDidPartiallyAcceptCompletionItem(completionItem, typeConvert.PartialAcceptInfo.to(info));
      }
    }
  }
  handleEndOfLifetime(pid, idx, reason) {
    const completionItem = this._references.get(pid)?.items[idx];
    if (completionItem) {
      if (this._provider.handleEndOfLifetime && this._isAdditionsProposedApiEnabled) {
        const r = typeConvert.InlineCompletionEndOfLifeReason.to(reason, (ref) => this._references.get(ref.pid)?.items[ref.idx]);
        this._provider.handleEndOfLifetime(completionItem, r);
      }
    }
  }
  handleRejection(pid, idx) {
    const completionItem = this._references.get(pid)?.items[idx];
    if (completionItem) {
      if (this._provider.handleDidRejectCompletionItem && this._isAdditionsProposedApiEnabled) {
        this._provider.handleDidRejectCompletionItem(completionItem);
      }
    }
  }
}
class ReferenceMap {
  constructor() {
    this._references = /* @__PURE__ */ new Map();
    this._idPool = 1;
  }
  createReferenceId(value) {
    const id = this._idPool++;
    this._references.set(id, value);
    return id;
  }
  disposeReferenceId(referenceId) {
    const value = this._references.get(referenceId);
    this._references.delete(referenceId);
    return value;
  }
  get(referenceId) {
    return this._references.get(referenceId);
  }
}
class SignatureHelpAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
    this._cache = new Cache("SignatureHelp");
  }
  async provideSignatureHelp(resource, position, context, token) {
    const doc = this._documents.getDocument(resource);
    const pos = typeConvert.Position.to(position);
    const vscodeContext = this.reviveContext(context);
    const value = await this._provider.provideSignatureHelp(doc, pos, token, vscodeContext);
    if (value) {
      const id = this._cache.add([value]);
      return { ...typeConvert.SignatureHelp.from(value), id };
    }
    return void 0;
  }
  reviveContext(context) {
    let activeSignatureHelp = void 0;
    if (context.activeSignatureHelp) {
      const revivedSignatureHelp = typeConvert.SignatureHelp.to(context.activeSignatureHelp);
      const saved = this._cache.get(context.activeSignatureHelp.id, 0);
      if (saved) {
        activeSignatureHelp = saved;
        activeSignatureHelp.activeSignature = revivedSignatureHelp.activeSignature;
        activeSignatureHelp.activeParameter = revivedSignatureHelp.activeParameter;
      } else {
        activeSignatureHelp = revivedSignatureHelp;
      }
    }
    return { ...context, activeSignatureHelp };
  }
  releaseSignatureHelp(id) {
    this._cache.delete(id);
  }
}
class InlayHintsAdapter {
  constructor(_documents, _commands, _provider, _logService, _extension) {
    this._documents = _documents;
    this._commands = _commands;
    this._provider = _provider;
    this._logService = _logService;
    this._extension = _extension;
    this._cache = new Cache("InlayHints");
    this._disposables = /* @__PURE__ */ new Map();
  }
  async provideInlayHints(resource, ran, token) {
    const doc = this._documents.getDocument(resource);
    const range = typeConvert.Range.to(ran);
    const hints = await this._provider.provideInlayHints(doc, range, token);
    if (!Array.isArray(hints) || hints.length === 0) {
      this._logService.trace(`[InlayHints] NO inlay hints from '${this._extension.identifier.value}' for range ${JSON.stringify(ran)}`);
      return void 0;
    }
    if (token.isCancellationRequested) {
      return void 0;
    }
    const pid = this._cache.add(hints);
    this._disposables.set(pid, new DisposableStore());
    const result = { hints: [], cacheId: pid };
    for (let i = 0; i < hints.length; i++) {
      if (this._isValidInlayHint(hints[i], range)) {
        result.hints.push(this._convertInlayHint(hints[i], [pid, i]));
      }
    }
    this._logService.trace(`[InlayHints] ${result.hints.length} inlay hints from '${this._extension.identifier.value}' for range ${JSON.stringify(ran)}`);
    return result;
  }
  async resolveInlayHint(id, token) {
    if (typeof this._provider.resolveInlayHint !== "function") {
      return void 0;
    }
    const item = this._cache.get(...id);
    if (!item) {
      return void 0;
    }
    const hint = await this._provider.resolveInlayHint(item, token);
    if (!hint) {
      return void 0;
    }
    if (!this._isValidInlayHint(hint)) {
      return void 0;
    }
    return this._convertInlayHint(hint, id);
  }
  releaseHints(id) {
    this._disposables.get(id)?.dispose();
    this._disposables.delete(id);
    this._cache.delete(id);
  }
  _isValidInlayHint(hint, range) {
    if (hint.label.length === 0 || Array.isArray(hint.label) && hint.label.every((part) => part.value.length === 0)) {
      console.log("INVALID inlay hint, empty label", hint);
      return false;
    }
    if (range && !range.contains(hint.position)) {
      return false;
    }
    return true;
  }
  _convertInlayHint(hint, id) {
    const disposables = this._disposables.get(id[0]);
    if (!disposables) {
      throw Error("DisposableStore is missing...");
    }
    const result = {
      label: "",
      // fill-in below
      cacheId: id,
      tooltip: typeConvert.MarkdownString.fromStrict(hint.tooltip),
      position: typeConvert.Position.from(hint.position),
      textEdits: hint.textEdits && hint.textEdits.map(typeConvert.TextEdit.from),
      kind: hint.kind && typeConvert.InlayHintKind.from(hint.kind),
      paddingLeft: hint.paddingLeft,
      paddingRight: hint.paddingRight
    };
    if (typeof hint.label === "string") {
      result.label = hint.label;
    } else {
      const parts = [];
      result.label = parts;
      for (const part of hint.label) {
        if (!part.value) {
          console.warn("INVALID inlay hint, empty label part", this._extension.identifier.value);
          continue;
        }
        const part2 = {
          label: part.value,
          tooltip: typeConvert.MarkdownString.fromStrict(part.tooltip)
        };
        if (Location.isLocation(part.location)) {
          part2.location = typeConvert.location.from(part.location);
        }
        if (part.command) {
          part2.command = this._commands.toInternal(part.command, disposables);
        }
        parts.push(part2);
      }
    }
    return result;
  }
}
class LinkProviderAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
    this._cache = new Cache("DocumentLink");
  }
  async provideLinks(resource, token) {
    const doc = this._documents.getDocument(resource);
    const links = await this._provider.provideDocumentLinks(doc, token);
    if (!Array.isArray(links) || links.length === 0) {
      return void 0;
    }
    if (token.isCancellationRequested) {
      return void 0;
    }
    if (typeof this._provider.resolveDocumentLink !== "function") {
      return { links: links.filter(LinkProviderAdapter._validateLink).map(typeConvert.DocumentLink.from) };
    } else {
      const pid = this._cache.add(links);
      const result = { links: [], cacheId: pid };
      for (let i = 0; i < links.length; i++) {
        if (!LinkProviderAdapter._validateLink(links[i])) {
          continue;
        }
        const dto = typeConvert.DocumentLink.from(links[i]);
        dto.cacheId = [pid, i];
        result.links.push(dto);
      }
      return result;
    }
  }
  static _validateLink(link) {
    if (link.target && link.target.path.length > 5e4) {
      console.warn("DROPPING link because it is too long");
      return false;
    }
    return true;
  }
  async resolveLink(id, token) {
    if (typeof this._provider.resolveDocumentLink !== "function") {
      return void 0;
    }
    const item = this._cache.get(...id);
    if (!item) {
      return void 0;
    }
    const link = await this._provider.resolveDocumentLink(item, token);
    if (!link || !LinkProviderAdapter._validateLink(link)) {
      return void 0;
    }
    return typeConvert.DocumentLink.from(link);
  }
  releaseLinks(id) {
    this._cache.delete(id);
  }
}
class ColorProviderAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
  }
  async provideColors(resource, token) {
    const doc = this._documents.getDocument(resource);
    const colors = await this._provider.provideDocumentColors(doc, token);
    if (!Array.isArray(colors)) {
      return [];
    }
    const colorInfos = colors.map((ci) => {
      return {
        color: typeConvert.Color.from(ci.color),
        range: typeConvert.Range.from(ci.range)
      };
    });
    return colorInfos;
  }
  async provideColorPresentations(resource, raw, token) {
    const document = this._documents.getDocument(resource);
    const range = typeConvert.Range.to(raw.range);
    const color = typeConvert.Color.to(raw.color);
    const value = await this._provider.provideColorPresentations(color, { document, range }, token);
    if (!Array.isArray(value)) {
      return void 0;
    }
    return value.map(typeConvert.ColorPresentation.from);
  }
}
class FoldingProviderAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
  }
  async provideFoldingRanges(resource, context, token) {
    const doc = this._documents.getDocument(resource);
    const ranges = await this._provider.provideFoldingRanges(doc, context, token);
    if (!Array.isArray(ranges)) {
      return void 0;
    }
    return ranges.map(typeConvert.FoldingRange.from);
  }
}
class SelectionRangeAdapter {
  constructor(_documents, _provider, _logService) {
    this._documents = _documents;
    this._provider = _provider;
    this._logService = _logService;
  }
  async provideSelectionRanges(resource, pos, token) {
    const document = this._documents.getDocument(resource);
    const positions = pos.map(typeConvert.Position.to);
    const allProviderRanges = await this._provider.provideSelectionRanges(document, positions, token);
    if (!isNonEmptyArray(allProviderRanges)) {
      return [];
    }
    if (allProviderRanges.length !== positions.length) {
      this._logService.warn("BAD selection ranges, provider must return ranges for each position");
      return [];
    }
    const allResults = [];
    for (let i = 0; i < positions.length; i++) {
      const oneResult = [];
      allResults.push(oneResult);
      let last = positions[i];
      let selectionRange = allProviderRanges[i];
      while (true) {
        if (!selectionRange.range.contains(last)) {
          throw new Error("INVALID selection range, must contain the previous range");
        }
        oneResult.push(typeConvert.SelectionRange.from(selectionRange));
        if (!selectionRange.parent) {
          break;
        }
        last = selectionRange.range;
        selectionRange = selectionRange.parent;
      }
    }
    return allResults;
  }
}
class CallHierarchyAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
    this._idPool = new IdGenerator("");
    this._cache = /* @__PURE__ */ new Map();
  }
  async prepareSession(uri, position, token) {
    const doc = this._documents.getDocument(uri);
    const pos = typeConvert.Position.to(position);
    const items = await this._provider.prepareCallHierarchy(doc, pos, token);
    if (!items) {
      return void 0;
    }
    const sessionId = this._idPool.nextId();
    this._cache.set(sessionId, /* @__PURE__ */ new Map());
    if (Array.isArray(items)) {
      return items.map((item) => this._cacheAndConvertItem(sessionId, item));
    } else {
      return [this._cacheAndConvertItem(sessionId, items)];
    }
  }
  async provideCallsTo(sessionId, itemId, token) {
    const item = this._itemFromCache(sessionId, itemId);
    if (!item) {
      throw new Error("missing call hierarchy item");
    }
    const calls = await this._provider.provideCallHierarchyIncomingCalls(item, token);
    if (!calls) {
      return void 0;
    }
    return calls.map((call) => {
      return {
        from: this._cacheAndConvertItem(sessionId, call.from),
        fromRanges: call.fromRanges.map((r) => typeConvert.Range.from(r))
      };
    });
  }
  async provideCallsFrom(sessionId, itemId, token) {
    const item = this._itemFromCache(sessionId, itemId);
    if (!item) {
      throw new Error("missing call hierarchy item");
    }
    const calls = await this._provider.provideCallHierarchyOutgoingCalls(item, token);
    if (!calls) {
      return void 0;
    }
    return calls.map((call) => {
      return {
        to: this._cacheAndConvertItem(sessionId, call.to),
        fromRanges: call.fromRanges.map((r) => typeConvert.Range.from(r))
      };
    });
  }
  releaseSession(sessionId) {
    this._cache.delete(sessionId);
  }
  _cacheAndConvertItem(sessionId, item) {
    const map = this._cache.get(sessionId);
    const dto = typeConvert.CallHierarchyItem.from(item, sessionId, map.size.toString(36));
    map.set(dto._itemId, item);
    return dto;
  }
  _itemFromCache(sessionId, itemId) {
    const map = this._cache.get(sessionId);
    return map?.get(itemId);
  }
}
class TypeHierarchyAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
    this._idPool = new IdGenerator("");
    this._cache = /* @__PURE__ */ new Map();
  }
  async prepareSession(uri, position, token) {
    const doc = this._documents.getDocument(uri);
    const pos = typeConvert.Position.to(position);
    const items = await this._provider.prepareTypeHierarchy(doc, pos, token);
    if (!items) {
      return void 0;
    }
    const sessionId = this._idPool.nextId();
    this._cache.set(sessionId, /* @__PURE__ */ new Map());
    if (Array.isArray(items)) {
      return items.map((item) => this._cacheAndConvertItem(sessionId, item));
    } else {
      return [this._cacheAndConvertItem(sessionId, items)];
    }
  }
  async provideSupertypes(sessionId, itemId, token) {
    const item = this._itemFromCache(sessionId, itemId);
    if (!item) {
      throw new Error("missing type hierarchy item");
    }
    const supertypes = await this._provider.provideTypeHierarchySupertypes(item, token);
    if (!supertypes) {
      return void 0;
    }
    return supertypes.map((supertype) => {
      return this._cacheAndConvertItem(sessionId, supertype);
    });
  }
  async provideSubtypes(sessionId, itemId, token) {
    const item = this._itemFromCache(sessionId, itemId);
    if (!item) {
      throw new Error("missing type hierarchy item");
    }
    const subtypes = await this._provider.provideTypeHierarchySubtypes(item, token);
    if (!subtypes) {
      return void 0;
    }
    return subtypes.map((subtype) => {
      return this._cacheAndConvertItem(sessionId, subtype);
    });
  }
  releaseSession(sessionId) {
    this._cache.delete(sessionId);
  }
  _cacheAndConvertItem(sessionId, item) {
    const map = this._cache.get(sessionId);
    const dto = typeConvert.TypeHierarchyItem.from(item, sessionId, map.size.toString(36));
    map.set(dto._itemId, item);
    return dto;
  }
  _itemFromCache(sessionId, itemId) {
    const map = this._cache.get(sessionId);
    return map?.get(itemId);
  }
}
class DocumentDropEditAdapter {
  constructor(_proxy, _documents, _provider, _handle, _extension) {
    this._proxy = _proxy;
    this._documents = _documents;
    this._provider = _provider;
    this._handle = _handle;
    this._extension = _extension;
    this._cache = new Cache("DocumentDropEdit");
  }
  async provideDocumentOnDropEdits(requestId, uri, position, dataTransferDto, token) {
    const doc = this._documents.getDocument(uri);
    const pos = typeConvert.Position.to(position);
    const dataTransfer = typeConvert.DataTransfer.toDataTransfer(dataTransferDto, async (id) => {
      return (await this._proxy.$resolveDocumentOnDropFileData(this._handle, requestId, id)).buffer;
    });
    const edits = await this._provider.provideDocumentDropEdits(doc, pos, dataTransfer, token);
    if (!edits) {
      return void 0;
    }
    const editsArray = asArray(edits);
    const cacheId = this._cache.add(editsArray);
    return editsArray.map((edit, i) => ({
      _cacheId: [cacheId, i],
      title: edit.title ?? localize("defaultDropLabel", "Drop using '{0}' extension", this._extension.displayName || this._extension.name),
      kind: edit.kind?.value,
      yieldTo: edit.yieldTo?.map((x) => x.value),
      insertText: typeof edit.insertText === "string" ? edit.insertText : { snippet: edit.insertText.value },
      additionalEdit: edit.additionalEdit ? typeConvert.WorkspaceEdit.from(edit.additionalEdit, void 0) : void 0
    }));
  }
  async resolveDropEdit(id, token) {
    const [sessionId, itemId] = id;
    const item = this._cache.get(sessionId, itemId);
    if (!item || !this._provider.resolveDocumentDropEdit) {
      return {};
    }
    const resolvedItem = await this._provider.resolveDocumentDropEdit(item, token) ?? item;
    const additionalEdit = resolvedItem.additionalEdit ? typeConvert.WorkspaceEdit.from(resolvedItem.additionalEdit, void 0) : void 0;
    return { additionalEdit };
  }
  releaseDropEdits(id) {
    this._cache.delete(id);
  }
}
class AdapterData {
  constructor(adapter, extension) {
    this.adapter = adapter;
    this.extension = extension;
  }
}
class ExtHostLanguageFeatures extends CoreDisposable {
  constructor(mainContext, _uriTransformer, _documents, _commands, _diagnostics, _logService, _apiDeprecation, _extensionTelemetry) {
    super();
    this._uriTransformer = _uriTransformer;
    this._documents = _documents;
    this._commands = _commands;
    this._diagnostics = _diagnostics;
    this._logService = _logService;
    this._apiDeprecation = _apiDeprecation;
    this._extensionTelemetry = _extensionTelemetry;
    this._adapter = /* @__PURE__ */ new Map();
    this._onDidChangeInlineCompletionsUnificationState = this._register(new Emitter());
    this.onDidChangeInlineCompletionsUnificationState = this._onDidChangeInlineCompletionsUnificationState.event;
    this._proxy = mainContext.getProxy(extHostProtocol.MainContext.MainThreadLanguageFeatures);
    this._inlineCompletionsUnificationState = {
      codeUnification: false,
      modelUnification: false,
      extensionUnification: false,
      expAssignments: []
    };
  }
  static {
    this._handlePool = 0;
  }
  get inlineCompletionsUnificationState() {
    return this._inlineCompletionsUnificationState;
  }
  _transformDocumentSelector(selector, extension) {
    return typeConvert.DocumentSelector.from(selector, this._uriTransformer, extension);
  }
  _createDisposable(handle) {
    return new Disposable(() => {
      this._adapter.delete(handle);
      this._proxy.$unregister(handle);
    });
  }
  _nextHandle() {
    return ExtHostLanguageFeatures._handlePool++;
  }
  async _withAdapter(handle, ctor, callback, fallbackValue, tokenToRaceAgainst, doNotLog = false) {
    const data = this._adapter.get(handle);
    if (!data || !(data.adapter instanceof ctor)) {
      return fallbackValue;
    }
    const t1 = Date.now();
    if (!doNotLog) {
      this._logService.trace(`[${data.extension.identifier.value}] INVOKE provider '${callback.toString().replace(/[\r\n]/g, "")}'`);
    }
    const result = callback(data.adapter, data.extension);
    Promise.resolve(result).catch((err) => {
      if (!isCancellationError(err)) {
        this._logService.error(`[${data.extension.identifier.value}] provider FAILED`);
        this._logService.error(err);
        this._extensionTelemetry.onExtensionError(data.extension.identifier, err);
      }
    }).finally(() => {
      if (!doNotLog) {
        this._logService.trace(`[${data.extension.identifier.value}] provider DONE after ${Date.now() - t1}ms`);
      }
    });
    if (CancellationToken.isCancellationToken(tokenToRaceAgainst)) {
      return raceCancellationError(result, tokenToRaceAgainst);
    }
    return result;
  }
  _addNewAdapter(adapter, extension) {
    const handle = this._nextHandle();
    this._adapter.set(handle, new AdapterData(adapter, extension));
    return handle;
  }
  static _extLabel(ext) {
    return ext.displayName || ext.name;
  }
  static _extId(ext) {
    return ext.identifier.value;
  }
  // --- outline
  registerDocumentSymbolProvider(extension, selector, provider, metadata) {
    const handle = this._addNewAdapter(new DocumentSymbolAdapter(this._documents, provider), extension);
    const displayName = metadata && metadata.label || ExtHostLanguageFeatures._extLabel(extension);
    this._proxy.$registerDocumentSymbolProvider(handle, this._transformDocumentSelector(selector, extension), displayName);
    return this._createDisposable(handle);
  }
  $provideDocumentSymbols(handle, resource, token) {
    return this._withAdapter(handle, DocumentSymbolAdapter, (adapter) => adapter.provideDocumentSymbols(URI.revive(resource), token), void 0, token);
  }
  // --- code lens
  registerCodeLensProvider(extension, selector, provider) {
    const handle = this._nextHandle();
    const eventHandle = typeof provider.onDidChangeCodeLenses === "function" ? this._nextHandle() : void 0;
    this._adapter.set(handle, new AdapterData(new CodeLensAdapter(this._documents, this._commands.converter, provider, extension, this._extensionTelemetry, this._logService), extension));
    this._proxy.$registerCodeLensSupport(handle, this._transformDocumentSelector(selector, extension), eventHandle);
    let result = this._createDisposable(handle);
    if (eventHandle !== void 0) {
      const subscription = provider.onDidChangeCodeLenses((_) => this._proxy.$emitCodeLensEvent(eventHandle));
      result = Disposable.from(result, subscription);
    }
    return result;
  }
  $provideCodeLenses(handle, resource, token) {
    return this._withAdapter(handle, CodeLensAdapter, (adapter) => adapter.provideCodeLenses(URI.revive(resource), token), void 0, token, resource.scheme === "output");
  }
  $resolveCodeLens(handle, symbol, token) {
    return this._withAdapter(handle, CodeLensAdapter, (adapter) => adapter.resolveCodeLens(symbol, token), void 0, void 0, true);
  }
  $releaseCodeLenses(handle, cacheId) {
    this._withAdapter(handle, CodeLensAdapter, (adapter) => Promise.resolve(adapter.releaseCodeLenses(cacheId)), void 0, void 0, true);
  }
  // --- declaration
  registerDefinitionProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new DefinitionAdapter(this._documents, provider), extension);
    this._proxy.$registerDefinitionSupport(handle, this._transformDocumentSelector(selector, extension));
    return this._createDisposable(handle);
  }
  $provideDefinition(handle, resource, position, token) {
    return this._withAdapter(handle, DefinitionAdapter, (adapter) => adapter.provideDefinition(URI.revive(resource), position, token), [], token);
  }
  registerDeclarationProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new DeclarationAdapter(this._documents, provider), extension);
    this._proxy.$registerDeclarationSupport(handle, this._transformDocumentSelector(selector, extension));
    return this._createDisposable(handle);
  }
  $provideDeclaration(handle, resource, position, token) {
    return this._withAdapter(handle, DeclarationAdapter, (adapter) => adapter.provideDeclaration(URI.revive(resource), position, token), [], token);
  }
  registerImplementationProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new ImplementationAdapter(this._documents, provider), extension);
    this._proxy.$registerImplementationSupport(handle, this._transformDocumentSelector(selector, extension));
    return this._createDisposable(handle);
  }
  $provideImplementation(handle, resource, position, token) {
    return this._withAdapter(handle, ImplementationAdapter, (adapter) => adapter.provideImplementation(URI.revive(resource), position, token), [], token);
  }
  registerTypeDefinitionProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new TypeDefinitionAdapter(this._documents, provider), extension);
    this._proxy.$registerTypeDefinitionSupport(handle, this._transformDocumentSelector(selector, extension));
    return this._createDisposable(handle);
  }
  $provideTypeDefinition(handle, resource, position, token) {
    return this._withAdapter(handle, TypeDefinitionAdapter, (adapter) => adapter.provideTypeDefinition(URI.revive(resource), position, token), [], token);
  }
  // --- extra info
  registerHoverProvider(extension, selector, provider, extensionId) {
    const handle = this._addNewAdapter(new HoverAdapter(this._documents, provider), extension);
    this._proxy.$registerHoverProvider(handle, this._transformDocumentSelector(selector, extension));
    return this._createDisposable(handle);
  }
  $provideHover(handle, resource, position, context, token) {
    return this._withAdapter(handle, HoverAdapter, (adapter) => adapter.provideHover(URI.revive(resource), position, context, token), void 0, token);
  }
  $releaseHover(handle, id) {
    this._withAdapter(handle, HoverAdapter, (adapter) => Promise.resolve(adapter.releaseHover(id)), void 0, void 0);
  }
  // --- debug hover
  registerEvaluatableExpressionProvider(extension, selector, provider, extensionId) {
    const handle = this._addNewAdapter(new EvaluatableExpressionAdapter(this._documents, provider), extension);
    this._proxy.$registerEvaluatableExpressionProvider(handle, this._transformDocumentSelector(selector, extension));
    return this._createDisposable(handle);
  }
  $provideEvaluatableExpression(handle, resource, position, token) {
    return this._withAdapter(handle, EvaluatableExpressionAdapter, (adapter) => adapter.provideEvaluatableExpression(URI.revive(resource), position, token), void 0, token);
  }
  // --- debug inline values
  registerInlineValuesProvider(extension, selector, provider, extensionId) {
    const eventHandle = typeof provider.onDidChangeInlineValues === "function" ? this._nextHandle() : void 0;
    const handle = this._addNewAdapter(new InlineValuesAdapter(this._documents, provider), extension);
    this._proxy.$registerInlineValuesProvider(handle, this._transformDocumentSelector(selector, extension), eventHandle);
    let result = this._createDisposable(handle);
    if (eventHandle !== void 0) {
      const subscription = provider.onDidChangeInlineValues((_) => this._proxy.$emitInlineValuesEvent(eventHandle));
      result = Disposable.from(result, subscription);
    }
    return result;
  }
  $provideInlineValues(handle, resource, range, context, token) {
    return this._withAdapter(handle, InlineValuesAdapter, (adapter) => adapter.provideInlineValues(URI.revive(resource), range, context, token), void 0, token);
  }
  // --- occurrences
  registerDocumentHighlightProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new DocumentHighlightAdapter(this._documents, provider), extension);
    this._proxy.$registerDocumentHighlightProvider(handle, this._transformDocumentSelector(selector, extension));
    return this._createDisposable(handle);
  }
  registerMultiDocumentHighlightProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new MultiDocumentHighlightAdapter(this._documents, provider, this._logService), extension);
    this._proxy.$registerMultiDocumentHighlightProvider(handle, this._transformDocumentSelector(selector, extension));
    return this._createDisposable(handle);
  }
  $provideDocumentHighlights(handle, resource, position, token) {
    return this._withAdapter(handle, DocumentHighlightAdapter, (adapter) => adapter.provideDocumentHighlights(URI.revive(resource), position, token), void 0, token);
  }
  $provideMultiDocumentHighlights(handle, resource, position, otherModels, token) {
    return this._withAdapter(handle, MultiDocumentHighlightAdapter, (adapter) => adapter.provideMultiDocumentHighlights(URI.revive(resource), position, otherModels.map((model) => URI.revive(model)), token), void 0, token);
  }
  // --- linked editing
  registerLinkedEditingRangeProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new LinkedEditingRangeAdapter(this._documents, provider), extension);
    this._proxy.$registerLinkedEditingRangeProvider(handle, this._transformDocumentSelector(selector, extension));
    return this._createDisposable(handle);
  }
  $provideLinkedEditingRanges(handle, resource, position, token) {
    return this._withAdapter(handle, LinkedEditingRangeAdapter, async (adapter) => {
      const res = await adapter.provideLinkedEditingRanges(URI.revive(resource), position, token);
      if (res) {
        return {
          ranges: res.ranges,
          wordPattern: res.wordPattern ? ExtHostLanguageFeatures._serializeRegExp(res.wordPattern) : void 0
        };
      }
      return void 0;
    }, void 0, token);
  }
  // --- references
  registerReferenceProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new ReferenceAdapter(this._documents, provider), extension);
    this._proxy.$registerReferenceSupport(handle, this._transformDocumentSelector(selector, extension));
    return this._createDisposable(handle);
  }
  $provideReferences(handle, resource, position, context, token) {
    return this._withAdapter(handle, ReferenceAdapter, (adapter) => adapter.provideReferences(URI.revive(resource), position, context, token), void 0, token);
  }
  // --- code actions
  registerCodeActionProvider(extension, selector, provider, metadata) {
    const store = new DisposableStore();
    const handle = this._addNewAdapter(new CodeActionAdapter(this._documents, this._commands.converter, this._diagnostics, provider, this._logService, extension, this._apiDeprecation), extension);
    this._proxy.$registerCodeActionSupport(handle, this._transformDocumentSelector(selector, extension), {
      providedKinds: metadata?.providedCodeActionKinds?.map((kind) => kind.value),
      documentation: metadata?.documentation?.map((x) => ({
        kind: x.kind.value,
        command: this._commands.converter.toInternal(x.command, store)
      }))
    }, ExtHostLanguageFeatures._extLabel(extension), ExtHostLanguageFeatures._extId(extension), Boolean(provider.resolveCodeAction));
    store.add(this._createDisposable(handle));
    return store;
  }
  $provideCodeActions(handle, resource, rangeOrSelection, context, token) {
    return this._withAdapter(handle, CodeActionAdapter, (adapter) => adapter.provideCodeActions(URI.revive(resource), rangeOrSelection, context, token), void 0, token);
  }
  $resolveCodeAction(handle, id, token) {
    return this._withAdapter(handle, CodeActionAdapter, (adapter) => adapter.resolveCodeAction(id, token), {}, void 0);
  }
  $releaseCodeActions(handle, cacheId) {
    this._withAdapter(handle, CodeActionAdapter, (adapter) => Promise.resolve(adapter.releaseCodeActions(cacheId)), void 0, void 0);
  }
  // --- formatting
  registerDocumentFormattingEditProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new DocumentFormattingAdapter(this._documents, provider), extension);
    this._proxy.$registerDocumentFormattingSupport(handle, this._transformDocumentSelector(selector, extension), extension.identifier, extension.displayName || extension.name);
    return this._createDisposable(handle);
  }
  $provideDocumentFormattingEdits(handle, resource, options, token) {
    return this._withAdapter(handle, DocumentFormattingAdapter, (adapter) => adapter.provideDocumentFormattingEdits(URI.revive(resource), options, token), void 0, token);
  }
  registerDocumentRangeFormattingEditProvider(extension, selector, provider) {
    const canFormatMultipleRanges = typeof provider.provideDocumentRangesFormattingEdits === "function";
    const handle = this._addNewAdapter(new RangeFormattingAdapter(this._documents, provider), extension);
    this._proxy.$registerRangeFormattingSupport(handle, this._transformDocumentSelector(selector, extension), extension.identifier, extension.displayName || extension.name, canFormatMultipleRanges);
    return this._createDisposable(handle);
  }
  $provideDocumentRangeFormattingEdits(handle, resource, range, options, token) {
    return this._withAdapter(handle, RangeFormattingAdapter, (adapter) => adapter.provideDocumentRangeFormattingEdits(URI.revive(resource), range, options, token), void 0, token);
  }
  $provideDocumentRangesFormattingEdits(handle, resource, ranges, options, token) {
    return this._withAdapter(handle, RangeFormattingAdapter, (adapter) => adapter.provideDocumentRangesFormattingEdits(URI.revive(resource), ranges, options, token), void 0, token);
  }
  registerOnTypeFormattingEditProvider(extension, selector, provider, triggerCharacters) {
    const handle = this._addNewAdapter(new OnTypeFormattingAdapter(this._documents, provider), extension);
    this._proxy.$registerOnTypeFormattingSupport(handle, this._transformDocumentSelector(selector, extension), triggerCharacters, extension.identifier);
    return this._createDisposable(handle);
  }
  $provideOnTypeFormattingEdits(handle, resource, position, ch, options, token) {
    return this._withAdapter(handle, OnTypeFormattingAdapter, (adapter) => adapter.provideOnTypeFormattingEdits(URI.revive(resource), position, ch, options, token), void 0, token);
  }
  // --- navigate types
  registerWorkspaceSymbolProvider(extension, provider) {
    const handle = this._addNewAdapter(new NavigateTypeAdapter(provider, this._logService), extension);
    this._proxy.$registerNavigateTypeSupport(handle, typeof provider.resolveWorkspaceSymbol === "function");
    return this._createDisposable(handle);
  }
  $provideWorkspaceSymbols(handle, search, token) {
    return this._withAdapter(handle, NavigateTypeAdapter, (adapter) => adapter.provideWorkspaceSymbols(search, token), { symbols: [] }, token);
  }
  $resolveWorkspaceSymbol(handle, symbol, token) {
    return this._withAdapter(handle, NavigateTypeAdapter, (adapter) => adapter.resolveWorkspaceSymbol(symbol, token), void 0, void 0);
  }
  $releaseWorkspaceSymbols(handle, id) {
    this._withAdapter(handle, NavigateTypeAdapter, (adapter) => adapter.releaseWorkspaceSymbols(id), void 0, void 0);
  }
  // --- rename
  registerRenameProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new RenameAdapter(this._documents, provider, this._logService), extension);
    this._proxy.$registerRenameSupport(handle, this._transformDocumentSelector(selector, extension), RenameAdapter.supportsResolving(provider));
    return this._createDisposable(handle);
  }
  $provideRenameEdits(handle, resource, position, newName, token) {
    return this._withAdapter(handle, RenameAdapter, (adapter) => adapter.provideRenameEdits(URI.revive(resource), position, newName, token), void 0, token);
  }
  $resolveRenameLocation(handle, resource, position, token) {
    return this._withAdapter(handle, RenameAdapter, (adapter) => adapter.resolveRenameLocation(URI.revive(resource), position, token), void 0, token);
  }
  registerNewSymbolNamesProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new NewSymbolNamesAdapter(this._documents, provider, this._logService), extension);
    this._proxy.$registerNewSymbolNamesProvider(handle, this._transformDocumentSelector(selector, extension));
    return this._createDisposable(handle);
  }
  $supportsAutomaticNewSymbolNamesTriggerKind(handle) {
    return this._withAdapter(
      handle,
      NewSymbolNamesAdapter,
      (adapter) => adapter.supportsAutomaticNewSymbolNamesTriggerKind(),
      false,
      void 0
    );
  }
  $provideNewSymbolNames(handle, resource, range, triggerKind, token) {
    return this._withAdapter(handle, NewSymbolNamesAdapter, (adapter) => adapter.provideNewSymbolNames(URI.revive(resource), range, triggerKind, token), void 0, token);
  }
  //#region semantic coloring
  registerDocumentSemanticTokensProvider(extension, selector, provider, legend) {
    const handle = this._addNewAdapter(new DocumentSemanticTokensAdapter(this._documents, provider), extension);
    const eventHandle = typeof provider.onDidChangeSemanticTokens === "function" ? this._nextHandle() : void 0;
    this._proxy.$registerDocumentSemanticTokensProvider(handle, this._transformDocumentSelector(selector, extension), legend, eventHandle);
    let result = this._createDisposable(handle);
    if (eventHandle) {
      const subscription = provider.onDidChangeSemanticTokens((_) => this._proxy.$emitDocumentSemanticTokensEvent(eventHandle));
      result = Disposable.from(result, subscription);
    }
    return result;
  }
  $provideDocumentSemanticTokens(handle, resource, previousResultId, token) {
    return this._withAdapter(handle, DocumentSemanticTokensAdapter, (adapter) => adapter.provideDocumentSemanticTokens(URI.revive(resource), previousResultId, token), null, token);
  }
  $releaseDocumentSemanticTokens(handle, semanticColoringResultId) {
    this._withAdapter(handle, DocumentSemanticTokensAdapter, (adapter) => adapter.releaseDocumentSemanticColoring(semanticColoringResultId), void 0, void 0);
  }
  registerDocumentRangeSemanticTokensProvider(extension, selector, provider, legend) {
    const handle = this._addNewAdapter(new DocumentRangeSemanticTokensAdapter(this._documents, provider), extension);
    const eventHandle = typeof provider.onDidChangeSemanticTokens === "function" ? this._nextHandle() : void 0;
    this._proxy.$registerDocumentRangeSemanticTokensProvider(handle, this._transformDocumentSelector(selector, extension), legend, eventHandle);
    let result = this._createDisposable(handle);
    if (eventHandle) {
      const subscription = provider.onDidChangeSemanticTokens((_) => this._proxy.$emitDocumentRangeSemanticTokensEvent(eventHandle));
      result = Disposable.from(result, subscription);
    }
    return result;
  }
  $provideDocumentRangeSemanticTokens(handle, resource, range, token) {
    return this._withAdapter(handle, DocumentRangeSemanticTokensAdapter, (adapter) => adapter.provideDocumentRangeSemanticTokens(URI.revive(resource), range, token), null, token);
  }
  //#endregion
  // --- suggestion
  registerCompletionItemProvider(extension, selector, provider, triggerCharacters) {
    const handle = this._addNewAdapter(new CompletionsAdapter(this._documents, this._commands.converter, provider, this._apiDeprecation, extension), extension);
    this._proxy.$registerCompletionsProvider(handle, this._transformDocumentSelector(selector, extension), triggerCharacters, CompletionsAdapter.supportsResolving(provider), extension.identifier);
    return this._createDisposable(handle);
  }
  $provideCompletionItems(handle, resource, position, context, token) {
    return this._withAdapter(handle, CompletionsAdapter, (adapter) => adapter.provideCompletionItems(URI.revive(resource), position, context, token), void 0, token);
  }
  $resolveCompletionItem(handle, id, token) {
    return this._withAdapter(handle, CompletionsAdapter, (adapter) => adapter.resolveCompletionItem(id, token), void 0, token);
  }
  $releaseCompletionItems(handle, id) {
    this._withAdapter(handle, CompletionsAdapter, (adapter) => adapter.releaseCompletionItems(id), void 0, void 0);
  }
  // --- ghost text
  registerInlineCompletionsProvider(extension, selector, provider, metadata) {
    const adapter = new InlineCompletionAdapter(extension, this._documents, provider, this._commands.converter);
    const handle = this._addNewAdapter(adapter, extension);
    let result = this._createDisposable(handle);
    const supportsOnDidChange = isProposedApiEnabled(extension, "inlineCompletionsAdditions") && typeof provider.onDidChange === "function";
    if (supportsOnDidChange) {
      const subscription = provider.onDidChange((e) => this._proxy.$emitInlineCompletionsChange(handle, e ? { data: e.data } : void 0));
      result = Disposable.from(result, subscription);
    }
    const supportsOnDidChangeModelInfo = isProposedApiEnabled(extension, "inlineCompletionsAdditions") && typeof provider.onDidChangeModelInfo === "function";
    if (supportsOnDidChangeModelInfo) {
      const subscription = provider.onDidChangeModelInfo((_) => this._proxy.$emitInlineCompletionModelInfoChange(handle, adapter.modelInfo));
      result = Disposable.from(result, subscription);
    }
    const supportsOnDidChangeProviderOptions = isProposedApiEnabled(extension, "inlineCompletionsAdditions") && typeof provider.onDidChangeProviderOptions === "function";
    if (supportsOnDidChangeProviderOptions) {
      const subscription = provider.onDidChangeProviderOptions((_) => this._proxy.$emitInlineCompletionProviderOptionsChange(handle, adapter.providerOptions));
      result = Disposable.from(result, subscription);
    }
    this._proxy.$registerInlineCompletionsSupport(
      handle,
      this._transformDocumentSelector(selector, extension),
      adapter.supportsHandleEvents,
      ExtensionIdentifier.toKey(extension.identifier.value),
      extension.version,
      metadata?.groupId ? ExtensionIdentifier.toKey(metadata.groupId) : void 0,
      metadata?.yieldTo?.map((extId) => ExtensionIdentifier.toKey(extId)) || [],
      metadata?.displayName,
      metadata?.debounceDelayMs,
      metadata?.excludes?.map((extId) => ExtensionIdentifier.toKey(extId)) || [],
      supportsOnDidChange,
      adapter.supportsSetModelId,
      adapter.modelInfo,
      supportsOnDidChangeModelInfo,
      adapter.supportsSetProviderOption,
      adapter.providerOptions,
      supportsOnDidChangeProviderOptions
    );
    return result;
  }
  $provideInlineCompletions(handle, resource, position, context, token) {
    return this._withAdapter(handle, InlineCompletionAdapter, (adapter) => adapter.provideInlineCompletions(URI.revive(resource), position, context, token), void 0, void 0);
  }
  $handleInlineCompletionDidShow(handle, pid, idx, updatedInsertText) {
    this._withAdapter(handle, InlineCompletionAdapter, async (adapter) => {
      adapter.handleDidShowCompletionItem(pid, idx, updatedInsertText);
    }, void 0, void 0);
  }
  $handleInlineCompletionPartialAccept(handle, pid, idx, acceptedCharacters, info) {
    this._withAdapter(handle, InlineCompletionAdapter, async (adapter) => {
      adapter.handlePartialAccept(pid, idx, acceptedCharacters, info);
    }, void 0, void 0);
  }
  $handleInlineCompletionEndOfLifetime(handle, pid, idx, reason) {
    this._withAdapter(handle, InlineCompletionAdapter, async (adapter) => {
      adapter.handleEndOfLifetime(pid, idx, reason);
    }, void 0, void 0);
  }
  $handleInlineCompletionRejection(handle, pid, idx) {
    this._withAdapter(handle, InlineCompletionAdapter, async (adapter) => {
      adapter.handleRejection(pid, idx);
    }, void 0, void 0);
  }
  $freeInlineCompletionsList(handle, pid, reason) {
    this._withAdapter(handle, InlineCompletionAdapter, async (adapter) => {
      adapter.disposeCompletions(pid, reason);
    }, void 0, void 0);
  }
  $acceptInlineCompletionsUnificationState(state) {
    this._inlineCompletionsUnificationState = state;
    this._onDidChangeInlineCompletionsUnificationState.fire();
  }
  $handleInlineCompletionSetCurrentModelId(handle, modelId) {
    this._withAdapter(handle, InlineCompletionAdapter, async (adapter) => {
      adapter.setCurrentModelId(modelId);
    }, void 0, void 0);
  }
  $handleInlineCompletionSetProviderOption(handle, optionId, valueId) {
    this._withAdapter(handle, InlineCompletionAdapter, async (adapter) => {
      adapter.setProviderOption(optionId, valueId);
    }, void 0, void 0);
  }
  // --- parameter hints
  registerSignatureHelpProvider(extension, selector, provider, metadataOrTriggerChars) {
    const metadata = Array.isArray(metadataOrTriggerChars) ? { triggerCharacters: metadataOrTriggerChars, retriggerCharacters: [] } : metadataOrTriggerChars;
    const handle = this._addNewAdapter(new SignatureHelpAdapter(this._documents, provider), extension);
    this._proxy.$registerSignatureHelpProvider(handle, this._transformDocumentSelector(selector, extension), metadata);
    return this._createDisposable(handle);
  }
  $provideSignatureHelp(handle, resource, position, context, token) {
    return this._withAdapter(handle, SignatureHelpAdapter, (adapter) => adapter.provideSignatureHelp(URI.revive(resource), position, context, token), void 0, token);
  }
  $releaseSignatureHelp(handle, id) {
    this._withAdapter(handle, SignatureHelpAdapter, (adapter) => adapter.releaseSignatureHelp(id), void 0, void 0);
  }
  // --- inline hints
  registerInlayHintsProvider(extension, selector, provider) {
    const eventHandle = typeof provider.onDidChangeInlayHints === "function" ? this._nextHandle() : void 0;
    const handle = this._addNewAdapter(new InlayHintsAdapter(this._documents, this._commands.converter, provider, this._logService, extension), extension);
    this._proxy.$registerInlayHintsProvider(handle, this._transformDocumentSelector(selector, extension), typeof provider.resolveInlayHint === "function", eventHandle, ExtHostLanguageFeatures._extLabel(extension));
    let result = this._createDisposable(handle);
    if (eventHandle !== void 0) {
      const subscription = provider.onDidChangeInlayHints((uri) => this._proxy.$emitInlayHintsEvent(eventHandle));
      result = Disposable.from(result, subscription);
    }
    return result;
  }
  $provideInlayHints(handle, resource, range, token) {
    return this._withAdapter(handle, InlayHintsAdapter, (adapter) => adapter.provideInlayHints(URI.revive(resource), range, token), void 0, token);
  }
  $resolveInlayHint(handle, id, token) {
    return this._withAdapter(handle, InlayHintsAdapter, (adapter) => adapter.resolveInlayHint(id, token), void 0, token);
  }
  $releaseInlayHints(handle, id) {
    this._withAdapter(handle, InlayHintsAdapter, (adapter) => adapter.releaseHints(id), void 0, void 0);
  }
  // --- links
  registerDocumentLinkProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new LinkProviderAdapter(this._documents, provider), extension);
    this._proxy.$registerDocumentLinkProvider(handle, this._transformDocumentSelector(selector, extension), typeof provider.resolveDocumentLink === "function");
    return this._createDisposable(handle);
  }
  $provideDocumentLinks(handle, resource, token) {
    return this._withAdapter(handle, LinkProviderAdapter, (adapter) => adapter.provideLinks(URI.revive(resource), token), void 0, token, resource.scheme === "output");
  }
  $resolveDocumentLink(handle, id, token) {
    return this._withAdapter(handle, LinkProviderAdapter, (adapter) => adapter.resolveLink(id, token), void 0, void 0, true);
  }
  $releaseDocumentLinks(handle, id) {
    this._withAdapter(handle, LinkProviderAdapter, (adapter) => adapter.releaseLinks(id), void 0, void 0, true);
  }
  registerColorProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new ColorProviderAdapter(this._documents, provider), extension);
    this._proxy.$registerDocumentColorProvider(handle, this._transformDocumentSelector(selector, extension));
    return this._createDisposable(handle);
  }
  $provideDocumentColors(handle, resource, token) {
    return this._withAdapter(handle, ColorProviderAdapter, (adapter) => adapter.provideColors(URI.revive(resource), token), [], token);
  }
  $provideColorPresentations(handle, resource, colorInfo, token) {
    return this._withAdapter(handle, ColorProviderAdapter, (adapter) => adapter.provideColorPresentations(URI.revive(resource), colorInfo, token), void 0, token);
  }
  registerFoldingRangeProvider(extension, selector, provider) {
    const handle = this._nextHandle();
    const eventHandle = typeof provider.onDidChangeFoldingRanges === "function" ? this._nextHandle() : void 0;
    this._adapter.set(handle, new AdapterData(new FoldingProviderAdapter(this._documents, provider), extension));
    this._proxy.$registerFoldingRangeProvider(handle, this._transformDocumentSelector(selector, extension), extension.identifier, eventHandle);
    let result = this._createDisposable(handle);
    if (eventHandle !== void 0) {
      const subscription = provider.onDidChangeFoldingRanges(() => this._proxy.$emitFoldingRangeEvent(eventHandle));
      result = Disposable.from(result, subscription);
    }
    return result;
  }
  $provideFoldingRanges(handle, resource, context, token) {
    return this._withAdapter(
      handle,
      FoldingProviderAdapter,
      (adapter) => adapter.provideFoldingRanges(URI.revive(resource), context, token),
      void 0,
      token
    );
  }
  // --- smart select
  registerSelectionRangeProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new SelectionRangeAdapter(this._documents, provider, this._logService), extension);
    this._proxy.$registerSelectionRangeProvider(handle, this._transformDocumentSelector(selector, extension));
    return this._createDisposable(handle);
  }
  $provideSelectionRanges(handle, resource, positions, token) {
    return this._withAdapter(handle, SelectionRangeAdapter, (adapter) => adapter.provideSelectionRanges(URI.revive(resource), positions, token), [], token);
  }
  // --- call hierarchy
  registerCallHierarchyProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new CallHierarchyAdapter(this._documents, provider), extension);
    this._proxy.$registerCallHierarchyProvider(handle, this._transformDocumentSelector(selector, extension));
    return this._createDisposable(handle);
  }
  $prepareCallHierarchy(handle, resource, position, token) {
    return this._withAdapter(handle, CallHierarchyAdapter, (adapter) => Promise.resolve(adapter.prepareSession(URI.revive(resource), position, token)), void 0, token);
  }
  $provideCallHierarchyIncomingCalls(handle, sessionId, itemId, token) {
    return this._withAdapter(handle, CallHierarchyAdapter, (adapter) => adapter.provideCallsTo(sessionId, itemId, token), void 0, token);
  }
  $provideCallHierarchyOutgoingCalls(handle, sessionId, itemId, token) {
    return this._withAdapter(handle, CallHierarchyAdapter, (adapter) => adapter.provideCallsFrom(sessionId, itemId, token), void 0, token);
  }
  $releaseCallHierarchy(handle, sessionId) {
    this._withAdapter(handle, CallHierarchyAdapter, (adapter) => Promise.resolve(adapter.releaseSession(sessionId)), void 0, void 0);
  }
  // --- type hierarchy
  registerTypeHierarchyProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new TypeHierarchyAdapter(this._documents, provider), extension);
    this._proxy.$registerTypeHierarchyProvider(handle, this._transformDocumentSelector(selector, extension));
    return this._createDisposable(handle);
  }
  $prepareTypeHierarchy(handle, resource, position, token) {
    return this._withAdapter(handle, TypeHierarchyAdapter, (adapter) => Promise.resolve(adapter.prepareSession(URI.revive(resource), position, token)), void 0, token);
  }
  $provideTypeHierarchySupertypes(handle, sessionId, itemId, token) {
    return this._withAdapter(handle, TypeHierarchyAdapter, (adapter) => adapter.provideSupertypes(sessionId, itemId, token), void 0, token);
  }
  $provideTypeHierarchySubtypes(handle, sessionId, itemId, token) {
    return this._withAdapter(handle, TypeHierarchyAdapter, (adapter) => adapter.provideSubtypes(sessionId, itemId, token), void 0, token);
  }
  $releaseTypeHierarchy(handle, sessionId) {
    this._withAdapter(handle, TypeHierarchyAdapter, (adapter) => Promise.resolve(adapter.releaseSession(sessionId)), void 0, void 0);
  }
  // --- Document on drop
  registerDocumentOnDropEditProvider(extension, selector, provider, metadata) {
    const handle = this._nextHandle();
    this._adapter.set(handle, new AdapterData(new DocumentDropEditAdapter(this._proxy, this._documents, provider, handle, extension), extension));
    this._proxy.$registerDocumentOnDropEditProvider(handle, this._transformDocumentSelector(selector, extension), metadata ? {
      supportsResolve: !!provider.resolveDocumentDropEdit,
      dropMimeTypes: metadata.dropMimeTypes,
      providedDropKinds: metadata.providedDropEditKinds?.map((x) => x.value)
    } : void 0);
    return this._createDisposable(handle);
  }
  $provideDocumentOnDropEdits(handle, requestId, resource, position, dataTransferDto, token) {
    return this._withAdapter(handle, DocumentDropEditAdapter, (adapter) => Promise.resolve(adapter.provideDocumentOnDropEdits(requestId, URI.revive(resource), position, dataTransferDto, token)), void 0, void 0);
  }
  $resolveDropEdit(handle, id, token) {
    return this._withAdapter(handle, DocumentDropEditAdapter, (adapter) => adapter.resolveDropEdit(id, token), {}, void 0);
  }
  $releaseDocumentOnDropEdits(handle, cacheId) {
    this._withAdapter(handle, DocumentDropEditAdapter, (adapter) => Promise.resolve(adapter.releaseDropEdits(cacheId)), void 0, void 0);
  }
  // --- copy/paste actions
  registerDocumentPasteEditProvider(extension, selector, provider, metadata) {
    const handle = this._nextHandle();
    this._adapter.set(handle, new AdapterData(new DocumentPasteEditProvider(this._proxy, this._documents, provider, handle, extension), extension));
    this._proxy.$registerPasteEditProvider(handle, this._transformDocumentSelector(selector, extension), {
      supportsCopy: !!provider.prepareDocumentPaste,
      supportsPaste: !!provider.provideDocumentPasteEdits,
      supportsResolve: !!provider.resolveDocumentPasteEdit,
      providedPasteEditKinds: metadata.providedPasteEditKinds?.map((x) => x.value),
      copyMimeTypes: metadata.copyMimeTypes,
      pasteMimeTypes: metadata.pasteMimeTypes
    });
    return this._createDisposable(handle);
  }
  $prepareDocumentPaste(handle, resource, ranges, dataTransfer, token) {
    return this._withAdapter(handle, DocumentPasteEditProvider, (adapter) => adapter.prepareDocumentPaste(URI.revive(resource), ranges, dataTransfer, token), void 0, token);
  }
  $providePasteEdits(handle, requestId, resource, ranges, dataTransferDto, context, token) {
    return this._withAdapter(handle, DocumentPasteEditProvider, (adapter) => adapter.providePasteEdits(requestId, URI.revive(resource), ranges, dataTransferDto, context, token), void 0, token);
  }
  $resolvePasteEdit(handle, id, token) {
    return this._withAdapter(handle, DocumentPasteEditProvider, (adapter) => adapter.resolvePasteEdit(id, token), {}, void 0);
  }
  $releasePasteEdits(handle, cacheId) {
    this._withAdapter(handle, DocumentPasteEditProvider, (adapter) => Promise.resolve(adapter.releasePasteEdits(cacheId)), void 0, void 0);
  }
  // --- configuration
  static _serializeRegExp(regExp) {
    return {
      pattern: regExp.source,
      flags: regExp.flags
    };
  }
  static _serializeIndentationRule(indentationRule) {
    return {
      decreaseIndentPattern: ExtHostLanguageFeatures._serializeRegExp(indentationRule.decreaseIndentPattern),
      increaseIndentPattern: ExtHostLanguageFeatures._serializeRegExp(indentationRule.increaseIndentPattern),
      indentNextLinePattern: indentationRule.indentNextLinePattern ? ExtHostLanguageFeatures._serializeRegExp(indentationRule.indentNextLinePattern) : void 0,
      unIndentedLinePattern: indentationRule.unIndentedLinePattern ? ExtHostLanguageFeatures._serializeRegExp(indentationRule.unIndentedLinePattern) : void 0
    };
  }
  static _serializeOnEnterRule(onEnterRule) {
    return {
      beforeText: ExtHostLanguageFeatures._serializeRegExp(onEnterRule.beforeText),
      afterText: onEnterRule.afterText ? ExtHostLanguageFeatures._serializeRegExp(onEnterRule.afterText) : void 0,
      previousLineText: onEnterRule.previousLineText ? ExtHostLanguageFeatures._serializeRegExp(onEnterRule.previousLineText) : void 0,
      action: onEnterRule.action
    };
  }
  static _serializeOnEnterRules(onEnterRules) {
    return onEnterRules.map(ExtHostLanguageFeatures._serializeOnEnterRule);
  }
  static _serializeAutoClosingPair(autoClosingPair) {
    return {
      open: autoClosingPair.open,
      close: autoClosingPair.close,
      notIn: autoClosingPair.notIn ? autoClosingPair.notIn.map((v) => SyntaxTokenType.toString(v)) : void 0
    };
  }
  static _serializeAutoClosingPairs(autoClosingPairs) {
    return autoClosingPairs.map(ExtHostLanguageFeatures._serializeAutoClosingPair);
  }
  setLanguageConfiguration(extension, languageId, configuration) {
    const { wordPattern } = configuration;
    if (wordPattern && regExpLeadsToEndlessLoop(wordPattern)) {
      throw new Error(`Invalid language configuration: wordPattern '${wordPattern}' is not allowed to match the empty string.`);
    }
    if (wordPattern) {
      this._documents.setWordDefinitionFor(languageId, wordPattern);
    } else {
      this._documents.setWordDefinitionFor(languageId, void 0);
    }
    if (configuration.__electricCharacterSupport) {
      this._apiDeprecation.report(
        "LanguageConfiguration.__electricCharacterSupport",
        extension,
        `Do not use.`
      );
    }
    if (configuration.__characterPairSupport) {
      this._apiDeprecation.report(
        "LanguageConfiguration.__characterPairSupport",
        extension,
        `Do not use.`
      );
    }
    const handle = this._nextHandle();
    const serializedConfiguration = {
      comments: configuration.comments,
      brackets: configuration.brackets,
      wordPattern: configuration.wordPattern ? ExtHostLanguageFeatures._serializeRegExp(configuration.wordPattern) : void 0,
      indentationRules: configuration.indentationRules ? ExtHostLanguageFeatures._serializeIndentationRule(configuration.indentationRules) : void 0,
      onEnterRules: configuration.onEnterRules ? ExtHostLanguageFeatures._serializeOnEnterRules(configuration.onEnterRules) : void 0,
      __electricCharacterSupport: configuration.__electricCharacterSupport,
      __characterPairSupport: configuration.__characterPairSupport,
      autoClosingPairs: configuration.autoClosingPairs ? ExtHostLanguageFeatures._serializeAutoClosingPairs(configuration.autoClosingPairs) : void 0
    };
    this._proxy.$setLanguageConfiguration(handle, languageId, serializedConfiguration);
    return this._createDisposable(handle);
  }
  $setWordDefinitions(wordDefinitions) {
    for (const wordDefinition of wordDefinitions) {
      this._documents.setWordDefinitionFor(wordDefinition.languageId, new RegExp(wordDefinition.regexSource, wordDefinition.regexFlags));
    }
  }
}
export {
  ExtHostLanguageFeatures
};
