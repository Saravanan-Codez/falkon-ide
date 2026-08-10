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
import { isObject } from "../../../../base/common/types.js";
import { ResourceEdit } from "../../../../editor/browser/services/bulkEditService.js";
import { IUndoRedoService, UndoRedoElementType } from "../../../../platform/undoRedo/common/undoRedo.js";
class ResourceAttachmentEdit extends ResourceEdit {
  constructor(resource, undo, redo, metadata) {
    super(metadata);
    this.resource = resource;
    this.undo = undo;
    this.redo = redo;
  }
  static is(candidate) {
    if (candidate instanceof ResourceAttachmentEdit) {
      return true;
    } else {
      return isObject(candidate) && Boolean(candidate.undo && candidate.redo);
    }
  }
  static lift(edit) {
    if (edit instanceof ResourceAttachmentEdit) {
      return edit;
    } else {
      return new ResourceAttachmentEdit(edit.resource, edit.undo, edit.redo, edit.metadata);
    }
  }
}
let OpaqueEdits = class {
  constructor(_undoRedoGroup, _undoRedoSource, _progress, _token, _edits, _undoRedoService) {
    this._undoRedoGroup = _undoRedoGroup;
    this._undoRedoSource = _undoRedoSource;
    this._progress = _progress;
    this._token = _token;
    this._edits = _edits;
    this._undoRedoService = _undoRedoService;
  }
  async apply() {
    const resources = [];
    for (const edit of this._edits) {
      if (this._token.isCancellationRequested) {
        break;
      }
      await edit.redo();
      this._undoRedoService.pushElement({
        type: UndoRedoElementType.Resource,
        resource: edit.resource,
        label: edit.metadata?.label || "Custom Edit",
        code: "paste",
        undo: edit.undo,
        redo: edit.redo
      }, this._undoRedoGroup, this._undoRedoSource);
      this._progress.report(void 0);
      resources.push(edit.resource);
    }
    return resources;
  }
};
OpaqueEdits = __decorateClass([
  __decorateParam(5, IUndoRedoService)
], OpaqueEdits);
export {
  OpaqueEdits,
  ResourceAttachmentEdit
};
