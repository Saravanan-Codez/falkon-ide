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
import { coalesceInPlace } from "../../../../base/common/arrays.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { CellEditType } from "../../../contrib/notebook/common/notebookCommon.js";
import { NotebookEdit } from "./notebooks.js";
import { SnippetTextEdit } from "./snippetTextEdit.js";
import { es5ClassCompat } from "./es5ClassCompat.js";
import { Range } from "./range.js";
import { TextEdit } from "./textEdit.js";
var FileEditType = /* @__PURE__ */ ((FileEditType2) => {
  FileEditType2[FileEditType2["File"] = 1] = "File";
  FileEditType2[FileEditType2["Text"] = 2] = "Text";
  FileEditType2[FileEditType2["Cell"] = 3] = "Cell";
  FileEditType2[FileEditType2["CellReplace"] = 5] = "CellReplace";
  FileEditType2[FileEditType2["Snippet"] = 6] = "Snippet";
  return FileEditType2;
})(FileEditType || {});
let WorkspaceEdit = class {
  constructor() {
    this._edits = [];
  }
  _allEntries() {
    return this._edits;
  }
  // --- file
  renameFile(from, to, options, metadata) {
    this._edits.push({ _type: 1 /* File */, from, to, options, metadata });
  }
  createFile(uri, options, metadata) {
    this._edits.push({ _type: 1 /* File */, from: void 0, to: uri, options, metadata });
  }
  deleteFile(uri, options, metadata) {
    this._edits.push({ _type: 1 /* File */, from: uri, to: void 0, options, metadata });
  }
  // --- notebook
  replaceNotebookMetadata(uri, value, metadata) {
    this._edits.push({ _type: 3 /* Cell */, metadata, uri, edit: { editType: CellEditType.DocumentMetadata, metadata: value } });
  }
  replaceNotebookCells(uri, startOrRange, cellData, metadata) {
    const start = startOrRange.start;
    const end = startOrRange.end;
    if (start !== end || cellData.length > 0) {
      this._edits.push({ _type: 5 /* CellReplace */, uri, index: start, count: end - start, cells: cellData, metadata });
    }
  }
  replaceNotebookCellMetadata(uri, index, cellMetadata, metadata) {
    this._edits.push({ _type: 3 /* Cell */, metadata, uri, edit: { editType: CellEditType.Metadata, index, metadata: cellMetadata } });
  }
  // --- text
  replace(uri, range, newText, metadata) {
    this._edits.push({ _type: 2 /* Text */, uri, edit: new TextEdit(range, newText), metadata });
  }
  insert(resource, position, newText, metadata) {
    this.replace(resource, new Range(position, position), newText, metadata);
  }
  delete(resource, range, metadata) {
    this.replace(resource, range, "", metadata);
  }
  // --- text (Maplike)
  has(uri) {
    return this._edits.some((edit) => edit._type === 2 /* Text */ && edit.uri.toString() === uri.toString());
  }
  set(uri, edits) {
    if (!edits) {
      for (let i = 0; i < this._edits.length; i++) {
        const element = this._edits[i];
        switch (element._type) {
          case 2 /* Text */:
          case 6 /* Snippet */:
          case 3 /* Cell */:
          case 5 /* CellReplace */:
            if (element.uri.toString() === uri.toString()) {
              this._edits[i] = void 0;
            }
            break;
        }
      }
      coalesceInPlace(this._edits);
    } else {
      for (const editOrTuple of edits) {
        if (!editOrTuple) {
          continue;
        }
        let edit;
        let metadata;
        if (Array.isArray(editOrTuple)) {
          edit = editOrTuple[0];
          metadata = editOrTuple[1];
        } else {
          edit = editOrTuple;
        }
        if (NotebookEdit.isNotebookCellEdit(edit)) {
          if (edit.newCellMetadata) {
            this.replaceNotebookCellMetadata(uri, edit.range.start, edit.newCellMetadata, metadata);
          } else if (edit.newNotebookMetadata) {
            this.replaceNotebookMetadata(uri, edit.newNotebookMetadata, metadata);
          } else {
            this.replaceNotebookCells(uri, edit.range, edit.newCells, metadata);
          }
        } else if (SnippetTextEdit.isSnippetTextEdit(edit)) {
          this._edits.push({ _type: 6 /* Snippet */, uri, range: edit.range, edit: edit.snippet, metadata, keepWhitespace: edit.keepWhitespace });
        } else {
          this._edits.push({ _type: 2 /* Text */, uri, edit, metadata });
        }
      }
    }
  }
  get(uri) {
    const res = [];
    for (const candidate of this._edits) {
      if (candidate._type === 2 /* Text */ && candidate.uri.toString() === uri.toString()) {
        res.push(candidate.edit);
      }
    }
    return res;
  }
  entries() {
    const textEdits = new ResourceMap();
    for (const candidate of this._edits) {
      if (candidate._type === 2 /* Text */) {
        let textEdit = textEdits.get(candidate.uri);
        if (!textEdit) {
          textEdit = [candidate.uri, []];
          textEdits.set(candidate.uri, textEdit);
        }
        textEdit[1].push(candidate.edit);
      }
    }
    return [...textEdits.values()];
  }
  get size() {
    return this.entries().length;
  }
  toJSON() {
    return this.entries();
  }
};
WorkspaceEdit = __decorateClass([
  es5ClassCompat
], WorkspaceEdit);
export {
  FileEditType,
  WorkspaceEdit
};
