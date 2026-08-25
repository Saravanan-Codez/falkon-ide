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
import { dispose } from "../../../../base/common/lifecycle.js";
import { EditOperation } from "../../../../editor/common/core/editOperation.js";
import { Range } from "../../../../editor/common/core/range.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { IEditorWorkerService } from "../../../../editor/common/services/editorWorker.js";
import { IUndoRedoService } from "../../../../platform/undoRedo/common/undoRedo.js";
import { SingleModelEditStackElement, MultiModelEditStackElement } from "../../../../editor/common/model/editStack.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ResourceTextEdit } from "../../../../editor/browser/services/bulkEditService.js";
import { SnippetController2 } from "../../../../editor/contrib/snippet/browser/snippetController2.js";
import { SnippetParser } from "../../../../editor/contrib/snippet/browser/snippetParser.js";
class ModelEditTask {
  constructor(_modelReference) {
    this._modelReference = _modelReference;
    this.model = this._modelReference.object.textEditorModel;
    this._edits = [];
  }
  dispose() {
    this._modelReference.dispose();
  }
  isNoOp() {
    if (this._edits.length > 0) {
      return false;
    }
    if (this._newEol !== void 0 && this._newEol !== this.model.getEndOfLineSequence()) {
      return false;
    }
    return true;
  }
  addEdit(resourceEdit) {
    this._expectedModelVersionId = resourceEdit.versionId;
    const { textEdit } = resourceEdit;
    if (typeof textEdit.eol === "number") {
      this._newEol = textEdit.eol;
    }
    if (!textEdit.range && !textEdit.text) {
      return;
    }
    if (Range.isEmpty(textEdit.range) && !textEdit.text) {
      return;
    }
    let range;
    if (!textEdit.range) {
      range = this.model.getFullModelRange();
    } else {
      range = Range.lift(textEdit.range);
    }
    this._edits.push({ ...EditOperation.replaceMove(range, textEdit.text), insertAsSnippet: textEdit.insertAsSnippet, keepWhitespace: textEdit.keepWhitespace });
  }
  validate() {
    if (typeof this._expectedModelVersionId === "undefined" || this.model.getVersionId() === this._expectedModelVersionId) {
      return { canApply: true };
    }
    return { canApply: false, reason: this.model.uri };
  }
  getBeforeCursorState() {
    return null;
  }
  apply(reason) {
    if (this._edits.length > 0) {
      this._edits = this._edits.map(this._transformSnippetStringToInsertText, this).sort((a, b) => Range.compareRangesUsingStarts(a.range, b.range));
      this.model.pushEditOperations(null, this._edits, () => null, void 0, reason);
    }
    if (this._newEol !== void 0) {
      this.model.pushEOL(this._newEol);
    }
  }
  _transformSnippetStringToInsertText(edit) {
    if (!edit.insertAsSnippet) {
      return edit;
    }
    if (!edit.text) {
      return edit;
    }
    const text = SnippetParser.asInsertText(edit.text);
    return { ...edit, insertAsSnippet: false, text };
  }
}
class EditorEditTask extends ModelEditTask {
  constructor(modelReference, editor) {
    super(modelReference);
    this._editor = editor;
  }
  getBeforeCursorState() {
    return this._canUseEditor() ? this._editor.getSelections() : null;
  }
  apply(reason) {
    if (!this._canUseEditor()) {
      super.apply();
      return;
    }
    if (this._edits.length > 0) {
      const snippetCtrl = SnippetController2.get(this._editor);
      if (snippetCtrl && this._edits.some((edit) => edit.insertAsSnippet)) {
        const snippetEdits = [];
        for (const edit of this._edits) {
          if (edit.range && edit.text !== null) {
            snippetEdits.push({
              range: Range.lift(edit.range),
              template: edit.insertAsSnippet ? edit.text : SnippetParser.escape(edit.text),
              keepWhitespace: edit.keepWhitespace
            });
          }
        }
        snippetCtrl.apply(snippetEdits, { undoStopBefore: false, undoStopAfter: false });
      } else {
        this._edits = this._edits.map(this._transformSnippetStringToInsertText, this).sort((a, b) => Range.compareRangesUsingStarts(a.range, b.range));
        this._editor.executeEdits(reason, this._edits);
      }
    }
    if (this._newEol !== void 0) {
      if (this._editor.hasModel()) {
        this._editor.getModel().pushEOL(this._newEol);
      }
    }
  }
  _canUseEditor() {
    return this._editor?.getModel()?.uri.toString() === this.model.uri.toString();
  }
}
let BulkTextEdits = class {
  constructor(_label, _code, _editor, _undoRedoGroup, _undoRedoSource, _progress, _token, edits, _editorWorker, _modelService, _textModelResolverService, _undoRedoService) {
    this._label = _label;
    this._code = _code;
    this._editor = _editor;
    this._undoRedoGroup = _undoRedoGroup;
    this._undoRedoSource = _undoRedoSource;
    this._progress = _progress;
    this._token = _token;
    this._editorWorker = _editorWorker;
    this._modelService = _modelService;
    this._textModelResolverService = _textModelResolverService;
    this._undoRedoService = _undoRedoService;
    this._edits = new ResourceMap();
    for (const edit of edits) {
      let array = this._edits.get(edit.resource);
      if (!array) {
        array = [];
        this._edits.set(edit.resource, array);
      }
      array.push(edit);
    }
  }
  _validateBeforePrepare() {
    for (const array of this._edits.values()) {
      for (const edit of array) {
        if (typeof edit.versionId === "number") {
          const model = this._modelService.getModel(edit.resource);
          if (model && model.getVersionId() !== edit.versionId) {
            throw new Error(`${model.uri.toString()} has changed in the meantime`);
          }
        }
      }
    }
  }
  async _createEditsTasks() {
    const tasks = [];
    const promises = [];
    for (const [key, edits] of this._edits) {
      const promise = this._textModelResolverService.createModelReference(key).then(async (ref) => {
        let task;
        let makeMinimal = false;
        if (this._editor?.getModel()?.uri.toString() === ref.object.textEditorModel.uri.toString()) {
          task = new EditorEditTask(ref, this._editor);
          makeMinimal = true;
        } else {
          task = new ModelEditTask(ref);
        }
        tasks.push(task);
        if (!makeMinimal) {
          edits.forEach(task.addEdit, task);
          return;
        }
        const makeGroupMoreMinimal = async (start2, end) => {
          const oldEdits = edits.slice(start2, end);
          const newEdits = await this._editorWorker.computeMoreMinimalEdits(ref.object.textEditorModel.uri, oldEdits.map((e) => e.textEdit), false);
          if (!newEdits) {
            oldEdits.forEach(task.addEdit, task);
          } else {
            const versionId = oldEdits[0]?.versionId;
            newEdits.forEach((edit) => task.addEdit(new ResourceTextEdit(ref.object.textEditorModel.uri, edit, versionId, void 0)));
          }
        };
        let start = 0;
        let i = 0;
        for (; i < edits.length; i++) {
          if (edits[i].textEdit.insertAsSnippet || edits[i].metadata) {
            await makeGroupMoreMinimal(start, i);
            task.addEdit(edits[i]);
            start = i + 1;
          }
        }
        await makeGroupMoreMinimal(start, i);
      });
      promises.push(promise);
    }
    await Promise.all(promises);
    return tasks;
  }
  _validateTasks(tasks) {
    for (const task of tasks) {
      const result = task.validate();
      if (!result.canApply) {
        return result;
      }
    }
    return { canApply: true };
  }
  async apply(reason) {
    this._validateBeforePrepare();
    const tasks = await this._createEditsTasks();
    try {
      if (this._token.isCancellationRequested) {
        return [];
      }
      const resources = [];
      const validation = this._validateTasks(tasks);
      if (!validation.canApply) {
        throw new Error(`${validation.reason.toString()} has changed in the meantime`);
      }
      if (tasks.length === 1) {
        const task = tasks[0];
        if (!task.isNoOp()) {
          const singleModelEditStackElement = new SingleModelEditStackElement(this._label, this._code, task.model, task.getBeforeCursorState());
          this._undoRedoService.pushElement(singleModelEditStackElement, this._undoRedoGroup, this._undoRedoSource);
          task.apply(reason);
          singleModelEditStackElement.close();
          resources.push(task.model.uri);
        }
        this._progress.report(void 0);
      } else {
        const multiModelEditStackElement = new MultiModelEditStackElement(
          this._label,
          this._code,
          tasks.map((t) => new SingleModelEditStackElement(this._label, this._code, t.model, t.getBeforeCursorState()))
        );
        this._undoRedoService.pushElement(multiModelEditStackElement, this._undoRedoGroup, this._undoRedoSource);
        for (const task of tasks) {
          task.apply();
          this._progress.report(void 0);
          resources.push(task.model.uri);
        }
        multiModelEditStackElement.close();
      }
      return resources;
    } finally {
      dispose(tasks);
    }
  }
};
BulkTextEdits = __decorateClass([
  __decorateParam(8, IEditorWorkerService),
  __decorateParam(9, IModelService),
  __decorateParam(10, ITextModelService),
  __decorateParam(11, IUndoRedoService)
], BulkTextEdits);
export {
  BulkTextEdits
};
