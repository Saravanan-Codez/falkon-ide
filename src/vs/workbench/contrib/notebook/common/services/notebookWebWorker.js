import { LcsDiff } from "../../../../../base/common/diff/diff.js";
import { doHash, hash, numberHash } from "../../../../../base/common/hash.js";
import { URI } from "../../../../../base/common/uri.js";
import { PieceTreeTextBufferBuilder } from "../../../../../editor/common/model/pieceTreeTextBuffer/pieceTreeTextBufferBuilder.js";
import { CellKind, NotebookCellsChangeType } from "../notebookCommon.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { SearchParams } from "../../../../../editor/common/model/textModelSearch.js";
import { MirrorModel } from "../../../../../editor/common/services/textModelSync/textModelSync.impl.js";
import { DefaultEndOfLine } from "../../../../../editor/common/model.js";
import { filter } from "../../../../../base/common/objects.js";
import { matchCellBasedOnSimilarties } from "./notebookCellMatching.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { DiffChange } from "../../../../../base/common/diff/diffChange.js";
import { computeDiff } from "../notebookDiff.js";
const PREFIX_FOR_UNMATCHED_ORIGINAL_CELLS = `unmatchedOriginalCell`;
class MirrorCell {
  constructor(handle, uri, source, _eol, versionId, language, cellKind, outputs, metadata, internalMetadata) {
    this.handle = handle;
    this._eol = _eol;
    this.language = language;
    this.cellKind = cellKind;
    this.outputs = outputs;
    this.metadata = metadata;
    this.internalMetadata = internalMetadata;
    this.textModel = new MirrorModel(uri, source, _eol, versionId);
  }
  get eol() {
    return this._eol === "\r\n" ? DefaultEndOfLine.CRLF : DefaultEndOfLine.LF;
  }
  onEvents(e) {
    this.textModel.onEvents(e);
    this._hash = void 0;
  }
  getValue() {
    return this.textModel.getValue();
  }
  getLinesContent() {
    return this.textModel.getLinesContent();
  }
  getComparisonValue() {
    return this._hash ??= this._getHash();
  }
  _getHash() {
    let hashValue = numberHash(104579, 0);
    hashValue = doHash(this.language, hashValue);
    hashValue = doHash(this.getValue(), hashValue);
    hashValue = doHash(this.metadata, hashValue);
    hashValue = doHash(this.internalMetadata?.internalId || "", hashValue);
    for (const op of this.outputs) {
      hashValue = doHash(op.metadata, hashValue);
      for (const output of op.outputs) {
        hashValue = doHash(output.mime, hashValue);
      }
    }
    const digests = this.outputs.flatMap(
      (op) => op.outputs.map((o) => hash(Array.from(o.data.buffer)))
    );
    for (const digest of digests) {
      hashValue = numberHash(digest, hashValue);
    }
    return hashValue;
  }
}
class MirrorNotebookDocument {
  constructor(uri, cells, metadata, transientDocumentMetadata) {
    this.uri = uri;
    this.cells = cells;
    this.metadata = metadata;
    this.transientDocumentMetadata = transientDocumentMetadata;
  }
  acceptModelChanged(event) {
    event.rawEvents.forEach((e) => {
      if (e.kind === NotebookCellsChangeType.ModelChange) {
        this._spliceNotebookCells(e.changes);
      } else if (e.kind === NotebookCellsChangeType.Move) {
        const cells = this.cells.splice(e.index, 1);
        this.cells.splice(e.newIdx, 0, ...cells);
      } else if (e.kind === NotebookCellsChangeType.Output) {
        const cell = this.cells[e.index];
        cell.outputs = e.outputs;
      } else if (e.kind === NotebookCellsChangeType.ChangeCellLanguage) {
        this._assertIndex(e.index);
        const cell = this.cells[e.index];
        cell.language = e.language;
      } else if (e.kind === NotebookCellsChangeType.ChangeCellMetadata) {
        this._assertIndex(e.index);
        const cell = this.cells[e.index];
        cell.metadata = e.metadata;
      } else if (e.kind === NotebookCellsChangeType.ChangeCellInternalMetadata) {
        this._assertIndex(e.index);
        const cell = this.cells[e.index];
        cell.internalMetadata = e.internalMetadata;
      } else if (e.kind === NotebookCellsChangeType.ChangeDocumentMetadata) {
        this.metadata = e.metadata;
      }
    });
  }
  _assertIndex(index) {
    if (index < 0 || index >= this.cells.length) {
      throw new Error(`Illegal index ${index}. Cells length: ${this.cells.length}`);
    }
  }
  _spliceNotebookCells(splices) {
    splices.reverse().forEach((splice) => {
      const cellDtos = splice[2];
      const newCells = cellDtos.map((cell) => {
        return new MirrorCell(
          cell.handle,
          URI.parse(cell.url),
          cell.source,
          cell.eol,
          cell.versionId,
          cell.language,
          cell.cellKind,
          cell.outputs,
          cell.metadata
        );
      });
      this.cells.splice(splice[0], splice[1], ...newCells);
    });
  }
}
class CellSequence {
  constructor(hashValue) {
    this.hashValue = hashValue;
  }
  static create(textModel) {
    const hashValue = textModel.cells.map((c) => c.getComparisonValue());
    return new CellSequence(hashValue);
  }
  static createWithCellId(cells, includeCellContents) {
    const hashValue = cells.map((c) => {
      if (includeCellContents) {
        return `${doHash(c.internalMetadata?.internalId, numberHash(104579, 0))}#${c.getComparisonValue()}`;
      } else {
        return `${doHash(c.internalMetadata?.internalId, numberHash(104579, 0))}}`;
      }
    });
    return new CellSequence(hashValue);
  }
  getElements() {
    return this.hashValue;
  }
}
class NotebookWorker {
  constructor() {
    this._requestHandlerBrand = void 0;
    this._models = /* @__PURE__ */ Object.create(null);
  }
  dispose() {
  }
  $acceptNewModel(uri, metadata, transientDocumentMetadata, cells) {
    this._models[uri] = new MirrorNotebookDocument(URI.parse(uri), cells.map((dto) => new MirrorCell(
      dto.handle,
      URI.parse(dto.url),
      dto.source,
      dto.eol,
      dto.versionId,
      dto.language,
      dto.cellKind,
      dto.outputs,
      dto.metadata,
      dto.internalMetadata
    )), metadata, transientDocumentMetadata);
  }
  $acceptModelChanged(strURL, event) {
    const model = this._models[strURL];
    model?.acceptModelChanged(event);
  }
  $acceptCellModelChanged(strURL, handle, event) {
    const model = this._models[strURL];
    model.cells.find((cell) => cell.handle === handle)?.onEvents(event);
  }
  $acceptRemovedModel(strURL) {
    if (!this._models[strURL]) {
      return;
    }
    delete this._models[strURL];
  }
  async $computeDiff(originalUrl, modifiedUrl) {
    const original = this._getModel(originalUrl);
    const modified = this._getModel(modifiedUrl);
    const originalModel = new NotebookTextModelFacade(original);
    const modifiedModel = new NotebookTextModelFacade(modified);
    const originalMetadata = filter(original.metadata, (key) => !original.transientDocumentMetadata[key]);
    const modifiedMetadata = filter(modified.metadata, (key) => !modified.transientDocumentMetadata[key]);
    const metadataChanged = JSON.stringify(originalMetadata) !== JSON.stringify(modifiedMetadata);
    const originalDiff = new LcsDiff(CellSequence.create(original), CellSequence.create(modified)).ComputeDiff(false);
    if (originalDiff.changes.length === 0) {
      return {
        metadataChanged,
        cellsDiff: originalDiff
      };
    }
    const cellMapping = computeDiff(originalModel, modifiedModel, { cellsDiff: { changes: originalDiff.changes, quitEarly: false }, metadataChanged: false }).cellDiffInfo;
    if (cellMapping.every((c) => c.type === "modified" || c.type === "unchanged")) {
      return {
        metadataChanged,
        cellsDiff: originalDiff
      };
    }
    let diffUsingCellIds = this.canComputeDiffWithCellIds(original, modified);
    if (!diffUsingCellIds) {
      const result = matchCellBasedOnSimilarties(modified.cells, original.cells);
      if (result.some((c) => c.original !== -1)) {
        this.updateCellIdsBasedOnMappings(result, original.cells, modified.cells);
        diffUsingCellIds = true;
      }
    }
    if (!diffUsingCellIds) {
      return {
        metadataChanged,
        cellsDiff: originalDiff
      };
    }
    const cellsInsertedOrDeletedDiff = new LcsDiff(CellSequence.createWithCellId(original.cells), CellSequence.createWithCellId(modified.cells)).ComputeDiff(false);
    const cellDiffInfo = computeDiff(originalModel, modifiedModel, { cellsDiff: { changes: cellsInsertedOrDeletedDiff.changes, quitEarly: false }, metadataChanged: false }).cellDiffInfo;
    let processedIndex = 0;
    const changes = [];
    cellsInsertedOrDeletedDiff.changes.forEach((change) => {
      if (!change.originalLength && change.modifiedLength) {
        const changeIndex = cellDiffInfo.findIndex((c) => c.type === "insert" && c.modifiedCellIndex === change.modifiedStart);
        cellDiffInfo.slice(processedIndex, changeIndex).forEach((c) => {
          if (c.type === "unchanged" || c.type === "modified") {
            const originalCell = original.cells[c.originalCellIndex];
            const modifiedCell = modified.cells[c.modifiedCellIndex];
            const changed = c.type === "modified" || originalCell.getComparisonValue() !== modifiedCell.getComparisonValue();
            if (changed) {
              changes.push(new DiffChange(c.originalCellIndex, 1, c.modifiedCellIndex, 1));
            }
          }
        });
        changes.push(change);
        processedIndex = changeIndex + 1;
      } else if (change.originalLength && !change.modifiedLength) {
        const changeIndex = cellDiffInfo.findIndex((c) => c.type === "delete" && c.originalCellIndex === change.originalStart);
        cellDiffInfo.slice(processedIndex, changeIndex).forEach((c) => {
          if (c.type === "unchanged" || c.type === "modified") {
            const originalCell = original.cells[c.originalCellIndex];
            const modifiedCell = modified.cells[c.modifiedCellIndex];
            const changed = c.type === "modified" || originalCell.getComparisonValue() !== modifiedCell.getComparisonValue();
            if (changed) {
              changes.push(new DiffChange(c.originalCellIndex, 1, c.modifiedCellIndex, 1));
            }
          }
        });
        changes.push(change);
        processedIndex = changeIndex + 1;
      } else {
        const changeIndex = cellDiffInfo.findIndex((c) => c.type === "delete" && c.originalCellIndex === change.originalStart || c.type === "insert" && c.modifiedCellIndex === change.modifiedStart);
        cellDiffInfo.slice(processedIndex, changeIndex).forEach((c) => {
          if (c.type === "unchanged" || c.type === "modified") {
            const originalCell = original.cells[c.originalCellIndex];
            const modifiedCell = modified.cells[c.modifiedCellIndex];
            const changed = c.type === "modified" || originalCell.getComparisonValue() !== modifiedCell.getComparisonValue();
            if (changed) {
              changes.push(new DiffChange(c.originalCellIndex, 1, c.modifiedCellIndex, 1));
            }
          }
        });
        changes.push(change);
        processedIndex = changeIndex + 1;
      }
    });
    cellDiffInfo.slice(processedIndex).forEach((c) => {
      if (c.type === "unchanged" || c.type === "modified") {
        const originalCell = original.cells[c.originalCellIndex];
        const modifiedCell = modified.cells[c.modifiedCellIndex];
        const changed = c.type === "modified" || originalCell.getComparisonValue() !== modifiedCell.getComparisonValue();
        if (changed) {
          changes.push(new DiffChange(c.originalCellIndex, 1, c.modifiedCellIndex, 1));
        }
      }
    });
    return {
      metadataChanged,
      cellsDiff: {
        changes,
        quitEarly: false
      }
    };
  }
  canComputeDiffWithCellIds(original, modified) {
    return this.canComputeDiffWithCellInternalIds(original, modified) || this.canComputeDiffWithCellMetadataIds(original, modified);
  }
  canComputeDiffWithCellInternalIds(original, modified) {
    const originalCellIndexIds = original.cells.map((cell, index) => ({ index, id: cell.internalMetadata?.internalId || "" }));
    const modifiedCellIndexIds = modified.cells.map((cell, index) => ({ index, id: cell.internalMetadata?.internalId || "" }));
    if (originalCellIndexIds.some((c) => !c.id) || modifiedCellIndexIds.some((c) => !c.id)) {
      return false;
    }
    return originalCellIndexIds.some((c) => modifiedCellIndexIds.find((m) => m.id === c.id));
  }
  canComputeDiffWithCellMetadataIds(original, modified) {
    const originalCellIndexIds = original.cells.map((cell, index) => ({ index, id: cell.metadata?.id || "" }));
    const modifiedCellIndexIds = modified.cells.map((cell, index) => ({ index, id: cell.metadata?.id || "" }));
    if (originalCellIndexIds.some((c) => !c.id) || modifiedCellIndexIds.some((c) => !c.id)) {
      return false;
    }
    if (originalCellIndexIds.every((c) => !modifiedCellIndexIds.find((m) => m.id === c.id))) {
      return false;
    }
    original.cells.map((cell, index) => {
      cell.internalMetadata = cell.internalMetadata || {};
      cell.internalMetadata.internalId = cell.metadata?.id || "";
    });
    modified.cells.map((cell, index) => {
      cell.internalMetadata = cell.internalMetadata || {};
      cell.internalMetadata.internalId = cell.metadata?.id || "";
    });
    return true;
  }
  isOriginalCellMatchedWithModifiedCell(originalCell) {
    return (originalCell.internalMetadata?.internalId || "").startsWith(PREFIX_FOR_UNMATCHED_ORIGINAL_CELLS);
  }
  updateCellIdsBasedOnMappings(mappings, originalCells, modifiedCells) {
    const uuids = /* @__PURE__ */ new Map();
    originalCells.map((cell, index) => {
      cell.internalMetadata = cell.internalMetadata || { internalId: "" };
      cell.internalMetadata.internalId = `${PREFIX_FOR_UNMATCHED_ORIGINAL_CELLS}${generateUuid()}`;
      const found = mappings.find((r) => r.original === index);
      if (found) {
        cell.internalMetadata.internalId = generateUuid();
        uuids.set(found.modified, cell.internalMetadata.internalId);
      }
    });
    modifiedCells.map((cell, index) => {
      cell.internalMetadata = cell.internalMetadata || { internalId: "" };
      cell.internalMetadata.internalId = uuids.get(index) ?? generateUuid();
    });
    return true;
  }
  $canPromptRecommendation(modelUrl) {
    const model = this._getModel(modelUrl);
    const cells = model.cells;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (cell.cellKind === CellKind.Markup) {
        continue;
      }
      if (cell.language !== "python") {
        continue;
      }
      const searchParams = new SearchParams("import\\s*pandas|from\\s*pandas", true, false, null);
      const searchData = searchParams.parseSearchRequest();
      if (!searchData) {
        continue;
      }
      const builder = new PieceTreeTextBufferBuilder();
      builder.acceptChunk(cell.getValue());
      const bufferFactory = builder.finish(true);
      const textBuffer = bufferFactory.create(cell.eol).textBuffer;
      const lineCount = textBuffer.getLineCount();
      const maxLineCount = Math.min(lineCount, 20);
      const range = new Range(1, 1, maxLineCount, textBuffer.getLineLength(maxLineCount) + 1);
      const cellMatches = textBuffer.findMatchesLineByLine(range, searchData, true, 1);
      if (cellMatches.length > 0) {
        return true;
      }
    }
    return false;
  }
  _getModel(uri) {
    return this._models[uri];
  }
}
function create() {
  return new NotebookWorker();
}
class NotebookTextModelFacade {
  constructor(notebook) {
    this.notebook = notebook;
    this.cells = notebook.cells.map((cell) => new NotebookCellTextModelFacade(cell));
  }
}
class NotebookCellTextModelFacade {
  constructor(cell) {
    this.cell = cell;
  }
  get cellKind() {
    return this.cell.cellKind;
  }
  getHashValue() {
    return this.cell.getComparisonValue();
  }
  equal(cell) {
    if (cell.cellKind !== this.cellKind) {
      return false;
    }
    return this.getHashValue() === cell.getHashValue();
  }
}
export {
  NotebookWorker,
  create
};
