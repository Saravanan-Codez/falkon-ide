import { VSBuffer } from "../../../../base/common/buffer.js";
import * as glob from "../../../../base/common/glob.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { Mimes } from "../../../../base/common/mime.js";
import { Schemas } from "../../../../base/common/network.js";
import { basename } from "../../../../base/common/path.js";
import { isWindows } from "../../../../base/common/platform.js";
import { RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { generateMetadataUri, generate as generateUri, extractCellOutputDetails, parseMetadataUri, parse as parseUri } from "../../../services/notebook/common/notebookDocumentService.js";
const NOTEBOOK_EDITOR_ID = "workbench.editor.notebook";
const NOTEBOOK_DIFF_EDITOR_ID = "workbench.editor.notebookTextDiffEditor";
const NOTEBOOK_MULTI_DIFF_EDITOR_ID = "workbench.editor.notebookMultiTextDiffEditor";
const INTERACTIVE_WINDOW_EDITOR_ID = "workbench.editor.interactive";
const REPL_EDITOR_ID = "workbench.editor.repl";
const NOTEBOOK_OUTPUT_EDITOR_ID = "workbench.editor.notebookOutputEditor";
const EXECUTE_REPL_COMMAND_ID = "replNotebook.input.execute";
var CellKind = /* @__PURE__ */ ((CellKind2) => {
  CellKind2[CellKind2["Markup"] = 1] = "Markup";
  CellKind2[CellKind2["Code"] = 2] = "Code";
  return CellKind2;
})(CellKind || {});
const NOTEBOOK_DISPLAY_ORDER = [
  "application/json",
  "application/javascript",
  "text/html",
  "image/svg+xml",
  Mimes.latex,
  Mimes.markdown,
  "image/png",
  "image/jpeg",
  Mimes.text
];
const ACCESSIBLE_NOTEBOOK_DISPLAY_ORDER = [
  Mimes.latex,
  Mimes.markdown,
  "application/json",
  "text/html",
  "image/svg+xml",
  "image/png",
  "image/jpeg",
  Mimes.text
];
const RENDERER_EQUIVALENT_EXTENSIONS = /* @__PURE__ */ new Map([
  ["ms-toolsai.jupyter", /* @__PURE__ */ new Set(["jupyter-notebook", "interactive"])],
  ["ms-toolsai.jupyter-renderers", /* @__PURE__ */ new Set(["jupyter-notebook", "interactive"])]
]);
const RENDERER_NOT_AVAILABLE = "_notAvailable";
var NotebookRunState = /* @__PURE__ */ ((NotebookRunState2) => {
  NotebookRunState2[NotebookRunState2["Running"] = 1] = "Running";
  NotebookRunState2[NotebookRunState2["Idle"] = 2] = "Idle";
  return NotebookRunState2;
})(NotebookRunState || {});
var NotebookCellExecutionState = /* @__PURE__ */ ((NotebookCellExecutionState2) => {
  NotebookCellExecutionState2[NotebookCellExecutionState2["Unconfirmed"] = 1] = "Unconfirmed";
  NotebookCellExecutionState2[NotebookCellExecutionState2["Pending"] = 2] = "Pending";
  NotebookCellExecutionState2[NotebookCellExecutionState2["Executing"] = 3] = "Executing";
  return NotebookCellExecutionState2;
})(NotebookCellExecutionState || {});
var NotebookExecutionState = /* @__PURE__ */ ((NotebookExecutionState2) => {
  NotebookExecutionState2[NotebookExecutionState2["Unconfirmed"] = 1] = "Unconfirmed";
  NotebookExecutionState2[NotebookExecutionState2["Pending"] = 2] = "Pending";
  NotebookExecutionState2[NotebookExecutionState2["Executing"] = 3] = "Executing";
  return NotebookExecutionState2;
})(NotebookExecutionState || {});
var NotebookRendererMatch = /* @__PURE__ */ ((NotebookRendererMatch2) => {
  NotebookRendererMatch2[NotebookRendererMatch2["WithHardKernelDependency"] = 0] = "WithHardKernelDependency";
  NotebookRendererMatch2[NotebookRendererMatch2["WithOptionalKernelDependency"] = 1] = "WithOptionalKernelDependency";
  NotebookRendererMatch2[NotebookRendererMatch2["Pure"] = 2] = "Pure";
  NotebookRendererMatch2[NotebookRendererMatch2["Never"] = 3] = "Never";
  return NotebookRendererMatch2;
})(NotebookRendererMatch || {});
var RendererMessagingSpec = /* @__PURE__ */ ((RendererMessagingSpec2) => {
  RendererMessagingSpec2["Always"] = "always";
  RendererMessagingSpec2["Never"] = "never";
  RendererMessagingSpec2["Optional"] = "optional";
  return RendererMessagingSpec2;
})(RendererMessagingSpec || {});
var NotebookCellsChangeType = /* @__PURE__ */ ((NotebookCellsChangeType2) => {
  NotebookCellsChangeType2[NotebookCellsChangeType2["ModelChange"] = 1] = "ModelChange";
  NotebookCellsChangeType2[NotebookCellsChangeType2["Move"] = 2] = "Move";
  NotebookCellsChangeType2[NotebookCellsChangeType2["ChangeCellLanguage"] = 5] = "ChangeCellLanguage";
  NotebookCellsChangeType2[NotebookCellsChangeType2["Initialize"] = 6] = "Initialize";
  NotebookCellsChangeType2[NotebookCellsChangeType2["ChangeCellMetadata"] = 7] = "ChangeCellMetadata";
  NotebookCellsChangeType2[NotebookCellsChangeType2["Output"] = 8] = "Output";
  NotebookCellsChangeType2[NotebookCellsChangeType2["OutputItem"] = 9] = "OutputItem";
  NotebookCellsChangeType2[NotebookCellsChangeType2["ChangeCellContent"] = 10] = "ChangeCellContent";
  NotebookCellsChangeType2[NotebookCellsChangeType2["ChangeDocumentMetadata"] = 11] = "ChangeDocumentMetadata";
  NotebookCellsChangeType2[NotebookCellsChangeType2["ChangeCellInternalMetadata"] = 12] = "ChangeCellInternalMetadata";
  NotebookCellsChangeType2[NotebookCellsChangeType2["ChangeCellMime"] = 13] = "ChangeCellMime";
  NotebookCellsChangeType2[NotebookCellsChangeType2["Unknown"] = 100] = "Unknown";
  return NotebookCellsChangeType2;
})(NotebookCellsChangeType || {});
var SelectionStateType = /* @__PURE__ */ ((SelectionStateType2) => {
  SelectionStateType2[SelectionStateType2["Handle"] = 0] = "Handle";
  SelectionStateType2[SelectionStateType2["Index"] = 1] = "Index";
  return SelectionStateType2;
})(SelectionStateType || {});
var CellEditType = /* @__PURE__ */ ((CellEditType2) => {
  CellEditType2[CellEditType2["Replace"] = 1] = "Replace";
  CellEditType2[CellEditType2["Output"] = 2] = "Output";
  CellEditType2[CellEditType2["Metadata"] = 3] = "Metadata";
  CellEditType2[CellEditType2["CellLanguage"] = 4] = "CellLanguage";
  CellEditType2[CellEditType2["DocumentMetadata"] = 5] = "DocumentMetadata";
  CellEditType2[CellEditType2["Move"] = 6] = "Move";
  CellEditType2[CellEditType2["OutputItems"] = 7] = "OutputItems";
  CellEditType2[CellEditType2["PartialMetadata"] = 8] = "PartialMetadata";
  CellEditType2[CellEditType2["PartialInternalMetadata"] = 9] = "PartialInternalMetadata";
  return CellEditType2;
})(CellEditType || {});
var NotebookMetadataUri;
((NotebookMetadataUri2) => {
  NotebookMetadataUri2.scheme = Schemas.vscodeNotebookMetadata;
  function generate(notebook) {
    return generateMetadataUri(notebook);
  }
  NotebookMetadataUri2.generate = generate;
  function parse(metadata) {
    return parseMetadataUri(metadata);
  }
  NotebookMetadataUri2.parse = parse;
})(NotebookMetadataUri || (NotebookMetadataUri = {}));
var CellUri;
((CellUri2) => {
  CellUri2.scheme = Schemas.vscodeNotebookCell;
  function generate(notebook, handle) {
    return generateUri(notebook, handle);
  }
  CellUri2.generate = generate;
  function parse(cell) {
    return parseUri(cell);
  }
  CellUri2.parse = parse;
  function generateCellOutputUriWithId(notebook, outputId) {
    return notebook.with({
      scheme: Schemas.vscodeNotebookCellOutput,
      query: new URLSearchParams({
        openIn: "editor",
        outputId: outputId ?? "",
        notebookScheme: notebook.scheme !== Schemas.file ? notebook.scheme : ""
      }).toString()
    });
  }
  CellUri2.generateCellOutputUriWithId = generateCellOutputUriWithId;
  function generateCellOutputUriWithIndex(notebook, cellUri, outputIndex) {
    return notebook.with({
      scheme: Schemas.vscodeNotebookCellOutput,
      fragment: cellUri.fragment,
      query: new URLSearchParams({
        openIn: "notebook",
        outputIndex: String(outputIndex)
      }).toString()
    });
  }
  CellUri2.generateCellOutputUriWithIndex = generateCellOutputUriWithIndex;
  function generateOutputEditorUri(notebook, cellId, cellIndex, outputId, outputIndex) {
    return notebook.with({
      scheme: Schemas.vscodeNotebookCellOutput,
      query: new URLSearchParams({
        openIn: "notebookOutputEditor",
        notebook: notebook.toString(),
        cellIndex: String(cellIndex),
        outputId,
        outputIndex: String(outputIndex)
      }).toString()
    });
  }
  CellUri2.generateOutputEditorUri = generateOutputEditorUri;
  function parseCellOutputUri(uri) {
    return extractCellOutputDetails(uri);
  }
  CellUri2.parseCellOutputUri = parseCellOutputUri;
  function generateCellPropertyUri(notebook, handle, scheme2) {
    return CellUri2.generate(notebook, handle).with({ scheme: scheme2 });
  }
  CellUri2.generateCellPropertyUri = generateCellPropertyUri;
  function parseCellPropertyUri(uri, propertyScheme) {
    if (uri.scheme !== propertyScheme) {
      return void 0;
    }
    return CellUri2.parse(uri.with({ scheme: CellUri2.scheme }));
  }
  CellUri2.parseCellPropertyUri = parseCellPropertyUri;
})(CellUri || (CellUri = {}));
const normalizeSlashes = (str) => isWindows ? str.replace(/\//g, "\\") : str;
class MimeTypeDisplayOrder {
  constructor(initialValue = [], defaultOrder = NOTEBOOK_DISPLAY_ORDER) {
    this.defaultOrder = defaultOrder;
    this.order = [...new Set(initialValue)].map((pattern) => ({
      pattern,
      matches: glob.parse(normalizeSlashes(pattern), { ignoreCase: true })
    }));
  }
  /**
   * Returns a sorted array of the input mimeTypes.
   */
  sort(mimeTypes) {
    const remaining = new Map(Iterable.map(mimeTypes, (m) => [m, normalizeSlashes(m)]));
    let sorted = [];
    for (const { matches } of this.order) {
      for (const [original, normalized] of remaining) {
        if (matches(normalized)) {
          sorted.push(original);
          remaining.delete(original);
          break;
        }
      }
    }
    if (remaining.size) {
      sorted = sorted.concat([...remaining.keys()].sort(
        (a, b) => this.defaultOrder.indexOf(a) - this.defaultOrder.indexOf(b)
      ));
    }
    return sorted;
  }
  /**
   * Records that the user selected the given mimetype over the other
   * possible mimeTypes, prioritizing it for future reference.
   */
  prioritize(chosenMimetype, otherMimeTypes) {
    const chosenIndex = this.findIndex(chosenMimetype);
    if (chosenIndex === -1) {
      this.order.unshift({ pattern: chosenMimetype, matches: glob.parse(normalizeSlashes(chosenMimetype), { ignoreCase: true }) });
      return;
    }
    const uniqueIndices = new Set(otherMimeTypes.map((m) => this.findIndex(m, chosenIndex)));
    uniqueIndices.delete(-1);
    const otherIndices = Array.from(uniqueIndices).sort((a, b) => a - b);
    this.order.splice(chosenIndex + 1, 0, ...otherIndices.map((i) => this.order[i]));
    for (let oi = otherIndices.length - 1; oi >= 0; oi--) {
      this.order.splice(otherIndices[oi], 1);
    }
  }
  /**
   * Gets an array of in-order mimetype preferences.
   */
  toArray() {
    return this.order.map((o) => o.pattern);
  }
  findIndex(mimeType, maxIndex = this.order.length) {
    const normalized = normalizeSlashes(mimeType);
    for (let i = 0; i < maxIndex; i++) {
      if (this.order[i].matches(normalized)) {
        return i;
      }
    }
    return -1;
  }
}
function diff(before, after, contains, equal = (a, b) => a === b) {
  const result = [];
  function pushSplice(start, deleteCount, toInsert) {
    if (deleteCount === 0 && toInsert.length === 0) {
      return;
    }
    const latest = result[result.length - 1];
    if (latest && latest.start + latest.deleteCount === start) {
      latest.deleteCount += deleteCount;
      latest.toInsert.push(...toInsert);
    } else {
      result.push({ start, deleteCount, toInsert });
    }
  }
  let beforeIdx = 0;
  let afterIdx = 0;
  while (true) {
    if (beforeIdx === before.length) {
      pushSplice(beforeIdx, 0, after.slice(afterIdx));
      break;
    }
    if (afterIdx === after.length) {
      pushSplice(beforeIdx, before.length - beforeIdx, []);
      break;
    }
    const beforeElement = before[beforeIdx];
    const afterElement = after[afterIdx];
    if (equal(beforeElement, afterElement)) {
      beforeIdx += 1;
      afterIdx += 1;
      continue;
    }
    if (contains(afterElement)) {
      pushSplice(beforeIdx, 1, []);
      beforeIdx += 1;
    } else {
      pushSplice(beforeIdx, 0, [afterElement]);
      afterIdx += 1;
    }
  }
  return result;
}
const NOTEBOOK_EDITOR_CURSOR_BOUNDARY = new RawContextKey("notebookEditorCursorAtBoundary", "none");
const NOTEBOOK_EDITOR_CURSOR_LINE_BOUNDARY = new RawContextKey("notebookEditorCursorAtLineBoundary", "none");
var NotebookEditorPriority = /* @__PURE__ */ ((NotebookEditorPriority2) => {
  NotebookEditorPriority2["default"] = "default";
  NotebookEditorPriority2["option"] = "option";
  return NotebookEditorPriority2;
})(NotebookEditorPriority || {});
var NotebookFindScopeType = /* @__PURE__ */ ((NotebookFindScopeType2) => {
  NotebookFindScopeType2["Cells"] = "cells";
  NotebookFindScopeType2["Text"] = "text";
  NotebookFindScopeType2["None"] = "none";
  return NotebookFindScopeType2;
})(NotebookFindScopeType || {});
function isDocumentExcludePattern(filenamePattern) {
  const arg = filenamePattern;
  if ((typeof arg.include === "string" || glob.isRelativePattern(arg.include)) && (typeof arg.exclude === "string" || glob.isRelativePattern(arg.exclude))) {
    return true;
  }
  return false;
}
function notebookDocumentFilterMatch(filter, viewType, resource) {
  if (Array.isArray(filter.viewType) && filter.viewType.indexOf(viewType) >= 0) {
    return true;
  }
  if (filter.viewType === viewType) {
    return true;
  }
  if (filter.filenamePattern) {
    const filenamePattern = isDocumentExcludePattern(filter.filenamePattern) ? filter.filenamePattern.include : filter.filenamePattern;
    const excludeFilenamePattern = isDocumentExcludePattern(filter.filenamePattern) ? filter.filenamePattern.exclude : void 0;
    if (glob.match(filenamePattern, basename(resource.fsPath), { ignoreCase: true })) {
      if (excludeFilenamePattern) {
        if (glob.match(excludeFilenamePattern, basename(resource.fsPath), { ignoreCase: true })) {
          return false;
        }
      }
      return true;
    }
  }
  return false;
}
const NotebookSetting = {
  displayOrder: "notebook.displayOrder",
  cellToolbarLocation: "notebook.cellToolbarLocation",
  cellToolbarVisibility: "notebook.cellToolbarVisibility",
  showCellStatusBar: "notebook.showCellStatusBar",
  cellExecutionTimeVerbosity: "notebook.cellExecutionTimeVerbosity",
  textDiffEditorPreview: "notebook.diff.enablePreview",
  diffOverviewRuler: "notebook.diff.overviewRuler",
  experimentalInsertToolbarAlignment: "notebook.experimental.insertToolbarAlignment",
  compactView: "notebook.compactView",
  focusIndicator: "notebook.cellFocusIndicator",
  insertToolbarLocation: "notebook.insertToolbarLocation",
  globalToolbar: "notebook.globalToolbar",
  stickyScrollEnabled: "notebook.stickyScroll.enabled",
  stickyScrollMode: "notebook.stickyScroll.mode",
  undoRedoPerCell: "notebook.undoRedoPerCell",
  consolidatedOutputButton: "notebook.consolidatedOutputButton",
  openOutputInPreviewEditor: "notebook.output.openInPreviewEditor.enabled",
  showFoldingControls: "notebook.showFoldingControls",
  dragAndDropEnabled: "notebook.dragAndDropEnabled",
  cellEditorOptionsCustomizations: "notebook.editorOptionsCustomizations",
  consolidatedRunButton: "notebook.consolidatedRunButton",
  openGettingStarted: "notebook.experimental.openGettingStarted",
  globalToolbarShowLabel: "notebook.globalToolbarShowLabel",
  markupFontSize: "notebook.markup.fontSize",
  markdownLineHeight: "notebook.markdown.lineHeight",
  interactiveWindowCollapseCodeCells: "interactiveWindow.collapseCellInputCode",
  outputScrolling: "notebook.output.scrolling",
  textOutputLineLimit: "notebook.output.textLineLimit",
  LinkifyOutputFilePaths: "notebook.output.linkifyFilePaths",
  minimalErrorRendering: "notebook.output.minimalErrorRendering",
  formatOnSave: "notebook.formatOnSave.enabled",
  insertFinalNewline: "notebook.insertFinalNewline",
  defaultFormatter: "notebook.defaultFormatter",
  formatOnCellExecution: "notebook.formatOnCellExecution",
  codeActionsOnSave: "notebook.codeActionsOnSave",
  outputWordWrap: "notebook.output.wordWrap",
  outputLineHeight: "notebook.output.lineHeight",
  outputFontSize: "notebook.output.fontSize",
  outputFontFamily: "notebook.output.fontFamily",
  findFilters: "notebook.find.filters",
  logging: "notebook.logging",
  confirmDeleteRunningCell: "notebook.confirmDeleteRunningCell",
  remoteSaving: "notebook.experimental.remoteSave",
  gotoSymbolsAllSymbols: "notebook.gotoSymbols.showAllSymbols",
  outlineShowMarkdownHeadersOnly: "notebook.outline.showMarkdownHeadersOnly",
  outlineShowCodeCells: "notebook.outline.showCodeCells",
  outlineShowCodeCellSymbols: "notebook.outline.showCodeCellSymbols",
  breadcrumbsShowCodeCells: "notebook.breadcrumbs.showCodeCells",
  scrollToRevealCell: "notebook.scrolling.revealNextCellOnExecute",
  cellChat: "notebook.experimental.cellChat",
  cellGenerate: "notebook.experimental.generate",
  notebookVariablesView: "notebook.variablesView",
  notebookInlineValues: "notebook.inlineValues",
  InteractiveWindowPromptToSave: "interactiveWindow.promptToSaveOnClose",
  cellFailureDiagnostics: "notebook.cellFailureDiagnostics",
  outputBackupSizeLimit: "notebook.backup.sizeLimit",
  multiCursor: "notebook.multiCursor.enabled",
  markupFontFamily: "notebook.markup.fontFamily"
};
var CellStatusbarAlignment = /* @__PURE__ */ ((CellStatusbarAlignment2) => {
  CellStatusbarAlignment2[CellStatusbarAlignment2["Left"] = 1] = "Left";
  CellStatusbarAlignment2[CellStatusbarAlignment2["Right"] = 2] = "Right";
  return CellStatusbarAlignment2;
})(CellStatusbarAlignment || {});
class NotebookWorkingCopyTypeIdentifier {
  static {
    this._prefix = "notebook/";
  }
  static create(notebookType, viewType) {
    return `${NotebookWorkingCopyTypeIdentifier._prefix}${notebookType}/${viewType ?? notebookType}`;
  }
  static parse(candidate) {
    if (candidate.startsWith(NotebookWorkingCopyTypeIdentifier._prefix)) {
      const split = candidate.substring(NotebookWorkingCopyTypeIdentifier._prefix.length).split("/");
      if (split.length === 2) {
        return { notebookType: split[0], viewType: split[1] };
      }
    }
    return void 0;
  }
}
const textDecoder = new TextDecoder();
function compressOutputItemStreams(outputs) {
  const buffers = [];
  let startAppending = false;
  for (const output of outputs) {
    if (buffers.length === 0 || startAppending) {
      buffers.push(output);
      startAppending = true;
    }
  }
  let didCompression = compressStreamBuffer(buffers);
  const concatenated = VSBuffer.concat(buffers.map((buffer) => VSBuffer.wrap(buffer)));
  const data = formatStreamText(concatenated);
  didCompression = didCompression || data.byteLength !== concatenated.byteLength;
  return { data, didCompression };
}
const MOVE_CURSOR_1_LINE_COMMAND = `${String.fromCharCode(27)}[A`;
const MOVE_CURSOR_1_LINE_COMMAND_BYTES = MOVE_CURSOR_1_LINE_COMMAND.split("").map((c) => c.charCodeAt(0));
const LINE_FEED = 10;
function compressStreamBuffer(streams) {
  let didCompress = false;
  streams.forEach((stream, index) => {
    if (index === 0 || stream.length < MOVE_CURSOR_1_LINE_COMMAND.length) {
      return;
    }
    const previousStream = streams[index - 1];
    const command = stream.subarray(0, MOVE_CURSOR_1_LINE_COMMAND.length);
    if (command[0] === MOVE_CURSOR_1_LINE_COMMAND_BYTES[0] && command[1] === MOVE_CURSOR_1_LINE_COMMAND_BYTES[1] && command[2] === MOVE_CURSOR_1_LINE_COMMAND_BYTES[2]) {
      const lastIndexOfLineFeed = previousStream.lastIndexOf(LINE_FEED);
      if (lastIndexOfLineFeed === -1) {
        return;
      }
      didCompress = true;
      streams[index - 1] = previousStream.subarray(0, lastIndexOfLineFeed);
      streams[index] = stream.subarray(MOVE_CURSOR_1_LINE_COMMAND.length);
    }
  });
  return didCompress;
}
function fixBackspace(txt) {
  let tmp = txt;
  do {
    txt = tmp;
    tmp = txt.replace(/[^\n]\x08/gm, "");
  } while (tmp.length < txt.length);
  return txt;
}
function fixCarriageReturn(txt) {
  txt = txt.replace(/\r+\n/gm, "\n");
  while (txt.search(/\r[^$]/g) > -1) {
    const base = txt.match(/^(.*)\r+/m)[1];
    let insert = txt.match(/\r+(.*)$/m)[1];
    insert = insert + base.slice(insert.length, base.length);
    txt = txt.replace(/\r+.*$/m, "\r").replace(/^.*\r/m, insert);
  }
  return txt;
}
const BACKSPACE_CHARACTER = "\b".charCodeAt(0);
const CARRIAGE_RETURN_CHARACTER = "\r".charCodeAt(0);
function formatStreamText(buffer) {
  if (!buffer.buffer.includes(BACKSPACE_CHARACTER) && !buffer.buffer.includes(CARRIAGE_RETURN_CHARACTER)) {
    return buffer;
  }
  return VSBuffer.fromString(fixCarriageReturn(fixBackspace(textDecoder.decode(buffer.buffer))));
}
export {
  ACCESSIBLE_NOTEBOOK_DISPLAY_ORDER,
  CellEditType,
  CellKind,
  CellStatusbarAlignment,
  CellUri,
  EXECUTE_REPL_COMMAND_ID,
  INTERACTIVE_WINDOW_EDITOR_ID,
  MOVE_CURSOR_1_LINE_COMMAND,
  MimeTypeDisplayOrder,
  NOTEBOOK_DIFF_EDITOR_ID,
  NOTEBOOK_DISPLAY_ORDER,
  NOTEBOOK_EDITOR_CURSOR_BOUNDARY,
  NOTEBOOK_EDITOR_CURSOR_LINE_BOUNDARY,
  NOTEBOOK_EDITOR_ID,
  NOTEBOOK_MULTI_DIFF_EDITOR_ID,
  NOTEBOOK_OUTPUT_EDITOR_ID,
  NotebookCellExecutionState,
  NotebookCellsChangeType,
  NotebookEditorPriority,
  NotebookExecutionState,
  NotebookFindScopeType,
  NotebookMetadataUri,
  NotebookRendererMatch,
  NotebookRunState,
  NotebookSetting,
  NotebookWorkingCopyTypeIdentifier,
  RENDERER_EQUIVALENT_EXTENSIONS,
  RENDERER_NOT_AVAILABLE,
  REPL_EDITOR_ID,
  RendererMessagingSpec,
  SelectionStateType,
  compressOutputItemStreams,
  diff,
  isDocumentExcludePattern,
  notebookDocumentFilterMatch
};
