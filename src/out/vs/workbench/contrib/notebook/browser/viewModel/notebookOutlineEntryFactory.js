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
import { renderAsPlaintext } from "../../../../../base/browser/markdownRenderer.js";
import { IOutlineModelService } from "../../../../../editor/contrib/documentSymbols/browser/outlineModel.js";
import { localize } from "../../../../../nls.js";
import { getMarkdownHeadersInCell } from "./foldingModel.js";
import { OutlineEntry } from "./OutlineEntry.js";
import { CellKind } from "../../common/notebookCommon.js";
import { INotebookExecutionStateService } from "../../common/notebookExecutionStateService.js";
import { createDecorator } from "../../../../../platform/instantiation/common/instantiation.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
var NotebookOutlineConstants = /* @__PURE__ */ ((NotebookOutlineConstants2) => {
  NotebookOutlineConstants2[NotebookOutlineConstants2["NonHeaderOutlineLevel"] = 7] = "NonHeaderOutlineLevel";
  return NotebookOutlineConstants2;
})(NotebookOutlineConstants || {});
function getMarkdownHeadersInCellFallbackToHtmlTags(fullContent) {
  const headers = Array.from(getMarkdownHeadersInCell(fullContent));
  if (headers.length) {
    return headers;
  }
  const match = fullContent.match(/<h([1-6]).*>(.*)<\/h\1>/i);
  if (match) {
    const level = parseInt(match[1]);
    const text = match[2].trim();
    headers.push({ depth: level, text });
  }
  return headers;
}
const INotebookOutlineEntryFactory = createDecorator("INotebookOutlineEntryFactory");
let NotebookOutlineEntryFactory = class {
  constructor(executionStateService, outlineModelService, textModelService) {
    this.executionStateService = executionStateService;
    this.outlineModelService = outlineModelService;
    this.textModelService = textModelService;
    this.cellOutlineEntryCache = {};
    this.cachedMarkdownOutlineEntries = /* @__PURE__ */ new WeakMap();
  }
  getOutlineEntries(cell, index) {
    const entries = [];
    const isMarkdown = cell.cellKind === CellKind.Markup;
    let content = getCellFirstNonEmptyLine(cell);
    let hasHeader = false;
    if (isMarkdown) {
      const fullContent = cell.getText().substring(0, 1e4);
      const cache = this.cachedMarkdownOutlineEntries.get(cell);
      const headers = cache?.alternativeId === cell.getAlternativeId() ? cache.headers : Array.from(getMarkdownHeadersInCellFallbackToHtmlTags(fullContent));
      this.cachedMarkdownOutlineEntries.set(cell, { alternativeId: cell.getAlternativeId(), headers });
      for (const { depth, text } of headers) {
        hasHeader = true;
        entries.push(new OutlineEntry(index++, depth, cell, text, false, false));
      }
      if (!hasHeader) {
        content = renderAsPlaintext({ value: content });
      }
    }
    if (!hasHeader) {
      const exeState = !isMarkdown && this.executionStateService.getCellExecution(cell.uri);
      let preview = content.trim();
      if (!isMarkdown) {
        const cached = this.cellOutlineEntryCache[cell.id];
        if (cached) {
          entries.push(new OutlineEntry(index++, 7 /* NonHeaderOutlineLevel */, cell, preview, !!exeState, exeState ? exeState.isPaused : false));
          cached.forEach((entry) => {
            entries.push(new OutlineEntry(index++, entry.level, cell, entry.name, false, false, entry.range, entry.kind));
          });
        }
      }
      if (entries.length === 0) {
        if (preview.length === 0) {
          preview = localize("empty", "empty cell");
        }
        entries.push(new OutlineEntry(index++, 7 /* NonHeaderOutlineLevel */, cell, preview, !!exeState, exeState ? exeState.isPaused : false));
      }
    }
    return entries;
  }
  async cacheSymbols(cell, cancelToken) {
    if (cell.cellKind === CellKind.Markup) {
      return;
    }
    const ref = await this.textModelService.createModelReference(cell.uri);
    try {
      const textModel = ref.object.textEditorModel;
      const outlineModel = await this.outlineModelService.getOrCreate(textModel, cancelToken);
      const entries = createOutlineEntries(outlineModel.getTopLevelSymbols(), 8);
      this.cellOutlineEntryCache[cell.id] = entries;
    } finally {
      ref.dispose();
    }
  }
};
NotebookOutlineEntryFactory = __decorateClass([
  __decorateParam(0, INotebookExecutionStateService),
  __decorateParam(1, IOutlineModelService),
  __decorateParam(2, ITextModelService)
], NotebookOutlineEntryFactory);
function createOutlineEntries(symbols, level) {
  const entries = [];
  symbols.forEach((symbol) => {
    entries.push({ name: symbol.name, range: symbol.range, level, kind: symbol.kind });
    if (symbol.children) {
      entries.push(...createOutlineEntries(symbol.children, level + 1));
    }
  });
  return entries;
}
function getCellFirstNonEmptyLine(cell) {
  const textBuffer = cell.textBuffer;
  for (let i = 0; i < textBuffer.getLineCount(); i++) {
    const firstNonWhitespace = textBuffer.getLineFirstNonWhitespaceColumn(i + 1);
    const lineLength = textBuffer.getLineLength(i + 1);
    if (firstNonWhitespace < lineLength) {
      return textBuffer.getLineContent(i + 1);
    }
  }
  return cell.getText().substring(0, 100);
}
export {
  INotebookOutlineEntryFactory,
  NotebookOutlineConstants,
  NotebookOutlineEntryFactory
};
