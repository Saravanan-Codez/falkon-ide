import { createDecorator } from "../../instantiation/common/instantiation.js";
const IUndoRedoService = createDecorator("undoRedoService");
var UndoRedoElementType = /* @__PURE__ */ ((UndoRedoElementType2) => {
  UndoRedoElementType2[UndoRedoElementType2["Resource"] = 0] = "Resource";
  UndoRedoElementType2[UndoRedoElementType2["Workspace"] = 1] = "Workspace";
  return UndoRedoElementType2;
})(UndoRedoElementType || {});
class ResourceEditStackSnapshot {
  constructor(resource, elements) {
    this.resource = resource;
    this.elements = elements;
  }
}
class UndoRedoGroup {
  static {
    this._ID = 0;
  }
  constructor() {
    this.id = UndoRedoGroup._ID++;
    this.order = 1;
  }
  nextOrder() {
    if (this.id === 0) {
      return 0;
    }
    return this.order++;
  }
  static {
    this.None = new UndoRedoGroup();
  }
}
class UndoRedoSource {
  static {
    this._ID = 0;
  }
  constructor() {
    this.id = UndoRedoSource._ID++;
    this.order = 1;
  }
  nextOrder() {
    if (this.id === 0) {
      return 0;
    }
    return this.order++;
  }
  static {
    this.None = new UndoRedoSource();
  }
}
export {
  IUndoRedoService,
  ResourceEditStackSnapshot,
  UndoRedoElementType,
  UndoRedoGroup,
  UndoRedoSource
};
