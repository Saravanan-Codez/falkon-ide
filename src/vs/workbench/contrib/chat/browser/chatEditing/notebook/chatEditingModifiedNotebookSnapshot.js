import { decodeBase64, encodeBase64, VSBuffer } from "../../../../../../base/common/buffer.js";
import { filter } from "../../../../../../base/common/objects.js";
import { URI } from "../../../../../../base/common/uri.js";
import { SnapshotContext } from "../../../../../services/workingCopy/common/fileWorkingCopy.js";
import { NotebookCellTextModel } from "../../../../notebook/common/model/notebookCellTextModel.js";
import { CellEditType, NotebookSetting } from "../../../../notebook/common/notebookCommon.js";
const BufferMarker = "ArrayBuffer-4f56482b-5a03-49ba-8356-210d3b0c1c3d";
const ChatEditingNotebookSnapshotScheme = "chat-editing-notebook-snapshot-model";
function getNotebookSnapshotFileURI(chatSessionResource, requestId, undoStop, path, viewType) {
  return URI.from({
    scheme: ChatEditingNotebookSnapshotScheme,
    path,
    query: JSON.stringify({ session: chatSessionResource, requestId: requestId ?? "", undoStop: undoStop ?? "", viewType })
  });
}
function parseNotebookSnapshotFileURI(resource) {
  const data = JSON.parse(resource.query);
  return { session: data.session, requestId: data.requestId ?? "", undoStop: data.undoStop ?? "", viewType: data.viewType };
}
function createSnapshot(notebook, transientOptions, outputSizeConfig) {
  const outputSizeLimit = (typeof outputSizeConfig === "number" ? outputSizeConfig : outputSizeConfig.getValue(NotebookSetting.outputBackupSizeLimit)) * 1024;
  return serializeSnapshot(notebook.createSnapshot({ context: SnapshotContext.Backup, outputSizeLimit, transientOptions }), transientOptions);
}
function restoreSnapshot(notebook, snapshot) {
  try {
    const { transientOptions, data } = deserializeSnapshot(snapshot);
    notebook.restoreSnapshot(data, transientOptions);
    const edits = [];
    data.cells.forEach((cell, index) => {
      const internalId = cell.internalMetadata?.internalId;
      if (internalId) {
        edits.push({ editType: CellEditType.PartialInternalMetadata, index, internalMetadata: { internalId } });
      }
    });
    notebook.applyEdits(edits, true, void 0, () => void 0, void 0, false);
  } catch (ex) {
    console.error("Error restoring Notebook snapshot", ex);
  }
}
class SnapshotComparer {
  constructor(initialCotent) {
    const { transientOptions, data } = deserializeSnapshot(initialCotent);
    this.transientOptions = transientOptions;
    this.data = data;
  }
  isEqual(notebook) {
    if (notebook.cells.length !== this.data.cells.length) {
      return false;
    }
    const transientDocumentMetadata = this.transientOptions?.transientDocumentMetadata || {};
    const notebookMetadata = filter(notebook.metadata || {}, (key) => !transientDocumentMetadata[key]);
    const comparerMetadata = filter(this.data.metadata || {}, (key) => !transientDocumentMetadata[key]);
    if (JSON.stringify(notebookMetadata) !== JSON.stringify(comparerMetadata)) {
      return false;
    }
    const transientCellMetadata = this.transientOptions?.transientCellMetadata || {};
    for (let i = 0; i < notebook.cells.length; i++) {
      const notebookCell = notebook.cells[i];
      const comparerCell = this.data.cells[i];
      if (notebookCell instanceof NotebookCellTextModel) {
        if (!notebookCell.fastEqual(comparerCell, true)) {
          return false;
        }
      } else {
        if (notebookCell.cellKind !== comparerCell.cellKind) {
          return false;
        }
        if (notebookCell.language !== comparerCell.language) {
          return false;
        }
        if (notebookCell.mime !== comparerCell.mime) {
          return false;
        }
        if (notebookCell.source !== comparerCell.source) {
          return false;
        }
        if (!this.transientOptions?.transientOutputs && notebookCell.outputs.length !== comparerCell.outputs.length) {
          return false;
        }
        const cellMetadata = filter(notebookCell.metadata || {}, (key) => !transientCellMetadata[key]);
        const comparerCellMetadata = filter(comparerCell.metadata || {}, (key) => !transientCellMetadata[key]);
        if (JSON.stringify(cellMetadata) !== JSON.stringify(comparerCellMetadata)) {
          return false;
        }
        if (JSON.stringify(sanitizeCellDto2(notebookCell, true, this.transientOptions)) !== JSON.stringify(sanitizeCellDto2(comparerCell, true, this.transientOptions))) {
          return false;
        }
      }
    }
    return true;
  }
}
function sanitizeCellDto2(cell, ignoreInternalMetadata, transientOptions) {
  const transientCellMetadata = transientOptions?.transientCellMetadata || {};
  const outputs = transientOptions?.transientOutputs ? [] : cell.outputs.map((output) => {
    return {
      outputId: output.outputId,
      metadata: output.metadata,
      outputs: output.outputs.map((item) => {
        return {
          data: item.data,
          mime: item.mime
        };
      })
    };
  });
  return {
    cellKind: cell.cellKind,
    language: cell.language,
    metadata: cell.metadata ? filter(cell.metadata, (key) => !transientCellMetadata[key]) : cell.metadata,
    outputs,
    mime: cell.mime,
    source: cell.source,
    collapseState: cell.collapseState,
    internalMetadata: ignoreInternalMetadata ? void 0 : cell.internalMetadata
  };
}
function serializeSnapshot(data, transientOptions) {
  const dataDto = {
    // Never pass transient options, as we're after a backup here.
    // Else we end up stripping outputs from backups.
    // Whether its persisted or not is up to the serializer.
    // However when reloading/restoring we need to preserve outputs.
    cells: data.cells.map((cell) => sanitizeCellDto2(cell)),
    metadata: data.metadata
  };
  return JSON.stringify([
    JSON.stringify(transientOptions),
    JSON.stringify(dataDto, (_key, value) => {
      if (value instanceof VSBuffer) {
        return {
          type: BufferMarker,
          data: encodeBase64(value)
        };
      }
      return value;
    })
  ]);
}
function deserializeSnapshot(snapshot) {
  const [transientOptionsStr, dataStr] = JSON.parse(snapshot);
  const transientOptions = transientOptionsStr ? JSON.parse(transientOptionsStr) : void 0;
  const data = JSON.parse(dataStr, (_key, value) => {
    if (value && value.type === BufferMarker) {
      return decodeBase64(value.data);
    }
    return value;
  });
  return { transientOptions, data };
}
export {
  ChatEditingNotebookSnapshotScheme,
  SnapshotComparer,
  createSnapshot,
  deserializeSnapshot,
  getNotebookSnapshotFileURI,
  parseNotebookSnapshotFileURI,
  restoreSnapshot
};
