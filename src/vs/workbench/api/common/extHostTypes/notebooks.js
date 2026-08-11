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
import { es5ClassCompat } from "./es5ClassCompat.js";
import { illegalArgument } from "../../../../base/common/errors.js";
import { Mimes, normalizeMimeType, isTextStreamMime } from "../../../../base/common/mime.js";
import { generateUuid } from "../../../../base/common/uuid.js";
var NotebookCellKind = /* @__PURE__ */ ((NotebookCellKind2) => {
  NotebookCellKind2[NotebookCellKind2["Markup"] = 1] = "Markup";
  NotebookCellKind2[NotebookCellKind2["Code"] = 2] = "Code";
  return NotebookCellKind2;
})(NotebookCellKind || {});
class NotebookRange {
  static isNotebookRange(thing) {
    if (thing instanceof NotebookRange) {
      return true;
    }
    if (!thing) {
      return false;
    }
    return typeof thing.start === "number" && typeof thing.end === "number";
  }
  get start() {
    return this._start;
  }
  get end() {
    return this._end;
  }
  get isEmpty() {
    return this._start === this._end;
  }
  constructor(start, end) {
    if (start < 0) {
      throw illegalArgument("start must be positive");
    }
    if (end < 0) {
      throw illegalArgument("end must be positive");
    }
    if (start <= end) {
      this._start = start;
      this._end = end;
    } else {
      this._start = end;
      this._end = start;
    }
  }
  with(change) {
    let start = this._start;
    let end = this._end;
    if (change.start !== void 0) {
      start = change.start;
    }
    if (change.end !== void 0) {
      end = change.end;
    }
    if (start === this._start && end === this._end) {
      return this;
    }
    return new NotebookRange(start, end);
  }
}
class NotebookCellData {
  static validate(data) {
    if (typeof data.kind !== "number") {
      throw new Error("NotebookCellData MUST have 'kind' property");
    }
    if (typeof data.value !== "string") {
      throw new Error("NotebookCellData MUST have 'value' property");
    }
    if (typeof data.languageId !== "string") {
      throw new Error("NotebookCellData MUST have 'languageId' property");
    }
  }
  static isNotebookCellDataArray(value) {
    return Array.isArray(value) && value.every((elem) => NotebookCellData.isNotebookCellData(elem));
  }
  static isNotebookCellData(value) {
    return true;
  }
  constructor(kind, value, languageId, mime, outputs, metadata, executionSummary) {
    this.kind = kind;
    this.value = value;
    this.languageId = languageId;
    this.mime = mime;
    this.outputs = outputs ?? [];
    this.metadata = metadata;
    this.executionSummary = executionSummary;
    NotebookCellData.validate(this);
  }
}
class NotebookData {
  constructor(cells) {
    this.cells = cells;
  }
}
let NotebookEdit = class {
  static isNotebookCellEdit(thing) {
    if (thing instanceof NotebookEdit) {
      return true;
    }
    if (!thing) {
      return false;
    }
    return NotebookRange.isNotebookRange(thing) && Array.isArray(thing.newCells);
  }
  static replaceCells(range, newCells) {
    return new NotebookEdit(range, newCells);
  }
  static insertCells(index, newCells) {
    return new NotebookEdit(new NotebookRange(index, index), newCells);
  }
  static deleteCells(range) {
    return new NotebookEdit(range, []);
  }
  static updateCellMetadata(index, newMetadata) {
    const edit = new NotebookEdit(new NotebookRange(index, index), []);
    edit.newCellMetadata = newMetadata;
    return edit;
  }
  static updateNotebookMetadata(newMetadata) {
    const edit = new NotebookEdit(new NotebookRange(0, 0), []);
    edit.newNotebookMetadata = newMetadata;
    return edit;
  }
  constructor(range, newCells) {
    this.range = range;
    this.newCells = newCells;
  }
};
NotebookEdit = __decorateClass([
  es5ClassCompat
], NotebookEdit);
class NotebookCellOutputItem {
  constructor(data, mime) {
    this.data = data;
    this.mime = mime;
    const mimeNormalized = normalizeMimeType(mime, true);
    if (!mimeNormalized) {
      throw new Error(`INVALID mime type: ${mime}. Must be in the format "type/subtype[;optionalparameter]"`);
    }
    this.mime = mimeNormalized;
  }
  static isNotebookCellOutputItem(obj) {
    if (obj instanceof NotebookCellOutputItem) {
      return true;
    }
    if (!obj) {
      return false;
    }
    return typeof obj.mime === "string" && obj.data instanceof Uint8Array;
  }
  static error(err) {
    const obj = {
      name: err.name,
      message: err.message,
      stack: err.stack
    };
    return NotebookCellOutputItem.json(obj, "application/vnd.code.notebook.error");
  }
  static stdout(value) {
    return NotebookCellOutputItem.text(value, "application/vnd.code.notebook.stdout");
  }
  static stderr(value) {
    return NotebookCellOutputItem.text(value, "application/vnd.code.notebook.stderr");
  }
  static bytes(value, mime = "application/octet-stream") {
    return new NotebookCellOutputItem(value, mime);
  }
  static #encoder = new TextEncoder();
  static text(value, mime = Mimes.text) {
    const bytes = NotebookCellOutputItem.#encoder.encode(String(value));
    return new NotebookCellOutputItem(bytes, mime);
  }
  static json(value, mime = "text/x-json") {
    const rawStr = JSON.stringify(value, void 0, "	");
    return NotebookCellOutputItem.text(rawStr, mime);
  }
}
class NotebookCellOutput {
  static isNotebookCellOutput(candidate) {
    if (candidate instanceof NotebookCellOutput) {
      return true;
    }
    if (!candidate || typeof candidate !== "object") {
      return false;
    }
    return typeof candidate.id === "string" && Array.isArray(candidate.items);
  }
  static ensureUniqueMimeTypes(items, warn = false) {
    const seen = /* @__PURE__ */ new Set();
    const removeIdx = /* @__PURE__ */ new Set();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const normalMime = normalizeMimeType(item.mime);
      if (!seen.has(normalMime) || isTextStreamMime(normalMime)) {
        seen.add(normalMime);
        continue;
      }
      removeIdx.add(i);
      if (warn) {
        console.warn(`DUPLICATED mime type '${item.mime}' will be dropped`);
      }
    }
    if (removeIdx.size === 0) {
      return items;
    }
    return items.filter((_item, index) => !removeIdx.has(index));
  }
  constructor(items, idOrMetadata, metadata) {
    this.items = NotebookCellOutput.ensureUniqueMimeTypes(items, true);
    if (typeof idOrMetadata === "string") {
      this.id = idOrMetadata;
      this.metadata = metadata;
    } else {
      this.id = generateUuid();
      this.metadata = idOrMetadata ?? metadata;
    }
  }
}
export {
  NotebookCellData,
  NotebookCellKind,
  NotebookCellOutput,
  NotebookCellOutputItem,
  NotebookData,
  NotebookEdit,
  NotebookRange
};
