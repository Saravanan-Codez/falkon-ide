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
import { IFileService } from "../../../../platform/files/common/files.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { Emitter } from "../../../../base/common/event.js";
import { ResourceFileEdit, ResourceTextEdit } from "../../../../editor/browser/services/bulkEditService.js";
import { ResourceNotebookCellEdit } from "./bulkCellEdits.js";
import { ILogService } from "../../../../platform/log/common/log.js";
let ConflictDetector = class {
  constructor(edits, fileService, modelService, logService) {
    this._conflicts = new ResourceMap();
    this._disposables = new DisposableStore();
    this._onDidConflict = new Emitter();
    this.onDidConflict = this._onDidConflict.event;
    const _workspaceEditResources = new ResourceMap();
    for (const edit of edits) {
      if (edit instanceof ResourceTextEdit) {
        _workspaceEditResources.set(edit.resource, true);
        if (typeof edit.versionId === "number") {
          const model = modelService.getModel(edit.resource);
          if (model && model.getVersionId() !== edit.versionId) {
            this._conflicts.set(edit.resource, true);
            this._onDidConflict.fire(this);
          }
        }
      } else if (edit instanceof ResourceFileEdit) {
        if (edit.newResource) {
          _workspaceEditResources.set(edit.newResource, true);
        } else if (edit.oldResource) {
          _workspaceEditResources.set(edit.oldResource, true);
        }
      } else if (edit instanceof ResourceNotebookCellEdit) {
        _workspaceEditResources.set(edit.resource, true);
      } else {
        logService.warn("UNKNOWN edit type", edit);
      }
    }
    this._disposables.add(fileService.onDidFilesChange((e) => {
      for (const uri of _workspaceEditResources.keys()) {
        if (!modelService.getModel(uri) && e.contains(uri)) {
          this._conflicts.set(uri, true);
          this._onDidConflict.fire(this);
          break;
        }
      }
    }));
    const onDidChangeModel = (model) => {
      if (_workspaceEditResources.has(model.uri)) {
        this._conflicts.set(model.uri, true);
        this._onDidConflict.fire(this);
      }
    };
    for (const model of modelService.getModels()) {
      this._disposables.add(model.onDidChangeContent(() => onDidChangeModel(model)));
    }
  }
  dispose() {
    this._disposables.dispose();
    this._onDidConflict.dispose();
  }
  list() {
    return [...this._conflicts.keys()];
  }
  hasConflicts() {
    return this._conflicts.size > 0;
  }
};
ConflictDetector = __decorateClass([
  __decorateParam(1, IFileService),
  __decorateParam(2, IModelService),
  __decorateParam(3, ILogService)
], ConflictDetector);
export {
  ConflictDetector
};
