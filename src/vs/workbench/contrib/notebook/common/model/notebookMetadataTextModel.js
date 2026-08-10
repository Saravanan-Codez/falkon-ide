import { toFormattedString } from "../../../../../base/common/jsonFormatter.js";
import { NotebookCellsChangeType, NotebookMetadataUri } from "../notebookCommon.js";
import { StringSHA1 } from "../../../../../base/common/hash.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { DefaultEndOfLine, EndOfLinePreference } from "../../../../../editor/common/model.js";
import { Emitter } from "../../../../../base/common/event.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { createTextBuffer } from "../../../../../editor/common/model/textModel.js";
function getFormattedNotebookMetadataJSON(transientMetadata, metadata) {
  let filteredMetadata = {};
  if (transientMetadata) {
    const keys = /* @__PURE__ */ new Set([...Object.keys(metadata)]);
    for (const key of keys) {
      if (!transientMetadata[key]) {
        filteredMetadata[key] = metadata[key];
      }
    }
  } else {
    filteredMetadata = metadata;
  }
  const metadataSource = toFormattedString(filteredMetadata, {});
  return metadataSource;
}
class NotebookDocumentMetadataTextModel extends Disposable {
  constructor(notebookModel) {
    super();
    this.notebookModel = notebookModel;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._textBufferHash = null;
    this.uri = NotebookMetadataUri.generate(this.notebookModel.uri);
    this._register(this.notebookModel.onDidChangeContent((e) => {
      if (e.rawEvents.some((event) => event.kind === NotebookCellsChangeType.ChangeDocumentMetadata || event.kind === NotebookCellsChangeType.ModelChange)) {
        this._textBuffer?.dispose();
        this._textBuffer = void 0;
        this._textBufferHash = null;
        this._onDidChange.fire();
      }
    }));
  }
  get metadata() {
    return this.notebookModel.metadata;
  }
  get textBuffer() {
    if (this._textBuffer) {
      return this._textBuffer;
    }
    const source = getFormattedNotebookMetadataJSON(this.notebookModel.transientOptions.transientDocumentMetadata, this.metadata);
    this._textBuffer = this._register(createTextBuffer(source, DefaultEndOfLine.LF).textBuffer);
    this._register(this._textBuffer.onDidChangeContent(() => {
      this._onDidChange.fire();
    }));
    return this._textBuffer;
  }
  getHash() {
    if (this._textBufferHash !== null) {
      return this._textBufferHash;
    }
    const shaComputer = new StringSHA1();
    const snapshot = this.textBuffer.createSnapshot(false);
    let text;
    while (text = snapshot.read()) {
      shaComputer.update(text);
    }
    this._textBufferHash = shaComputer.digest();
    return this._textBufferHash;
  }
  getValue() {
    const fullRange = this.getFullModelRange();
    const eol = this.textBuffer.getEOL();
    if (eol === "\n") {
      return this.textBuffer.getValueInRange(fullRange, EndOfLinePreference.LF);
    } else {
      return this.textBuffer.getValueInRange(fullRange, EndOfLinePreference.CRLF);
    }
  }
  getFullModelRange() {
    const lineCount = this.textBuffer.getLineCount();
    return new Range(1, 1, lineCount, this.textBuffer.getLineLength(lineCount) + 1);
  }
}
export {
  NotebookDocumentMetadataTextModel,
  getFormattedNotebookMetadataJSON
};
