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
import { diffMaps, diffSets } from "../../../base/common/collections.js";
import { combinedDisposable, DisposableStore, DisposableMap } from "../../../base/common/lifecycle.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { MainThreadNotebookDocuments } from "./mainThreadNotebookDocuments.js";
import { NotebookDto } from "./mainThreadNotebookDto.js";
import { MainThreadNotebookEditors } from "./mainThreadNotebookEditors.js";
import { extHostCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { editorGroupToColumn } from "../../services/editor/common/editorGroupColumn.js";
import { getNotebookEditorFromEditorPane } from "../../contrib/notebook/browser/notebookBrowser.js";
import { INotebookEditorService } from "../../contrib/notebook/browser/services/notebookEditorService.js";
import { INotebookService } from "../../contrib/notebook/common/notebookService.js";
import { IEditorGroupsService } from "../../services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../services/editor/common/editorService.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { SerializableObjectWithBuffers } from "../../services/extensions/common/proxyIdentifier.js";
class NotebookAndEditorState {
  constructor(documents, textEditors, activeEditor, visibleEditors) {
    this.documents = documents;
    this.textEditors = textEditors;
    this.activeEditor = activeEditor;
    this.visibleEditors = visibleEditors;
  }
  static delta(before, after) {
    if (!before) {
      return {
        addedDocuments: [...after.documents],
        removedDocuments: [],
        addedEditors: [...after.textEditors.values()],
        removedEditors: [],
        visibleEditors: [...after.visibleEditors].map((editor) => editor[0])
      };
    }
    const documentDelta = diffSets(before.documents, after.documents);
    const editorDelta = diffMaps(before.textEditors, after.textEditors);
    const newActiveEditor = before.activeEditor !== after.activeEditor ? after.activeEditor : void 0;
    const visibleEditorDelta = diffMaps(before.visibleEditors, after.visibleEditors);
    return {
      addedDocuments: documentDelta.added,
      removedDocuments: documentDelta.removed.map((e) => e.uri),
      addedEditors: editorDelta.added,
      removedEditors: editorDelta.removed.map((removed) => removed.getId()),
      newActiveEditor,
      visibleEditors: visibleEditorDelta.added.length === 0 && visibleEditorDelta.removed.length === 0 ? void 0 : [...after.visibleEditors].map((editor) => editor[0])
    };
  }
}
let MainThreadNotebooksAndEditors = class {
  constructor(extHostContext, instantiationService, _notebookService, _notebookEditorService, _editorService, _editorGroupService, _logService) {
    this._notebookService = _notebookService;
    this._notebookEditorService = _notebookEditorService;
    this._editorService = _editorService;
    this._editorGroupService = _editorGroupService;
    this._logService = _logService;
    this._disposables = new DisposableStore();
    this._editorListeners = new DisposableMap();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostNotebook);
    this._mainThreadNotebooks = instantiationService.createInstance(MainThreadNotebookDocuments, extHostContext);
    this._mainThreadEditors = instantiationService.createInstance(MainThreadNotebookEditors, extHostContext);
    extHostContext.set(MainContext.MainThreadNotebookDocuments, this._mainThreadNotebooks);
    extHostContext.set(MainContext.MainThreadNotebookEditors, this._mainThreadEditors);
    this._notebookService.onWillAddNotebookDocument(() => this._updateState(), this, this._disposables);
    this._notebookService.onDidRemoveNotebookDocument(() => this._updateState(), this, this._disposables);
    this._editorService.onDidActiveEditorChange(() => this._updateState(), this, this._disposables);
    this._editorService.onDidVisibleEditorsChange(() => this._updateState(), this, this._disposables);
    this._notebookEditorService.onDidAddNotebookEditor(this._handleEditorAdd, this, this._disposables);
    this._notebookEditorService.onDidRemoveNotebookEditor(this._handleEditorRemove, this, this._disposables);
    this._updateState();
  }
  dispose() {
    this._mainThreadNotebooks.dispose();
    this._mainThreadEditors.dispose();
    this._disposables.dispose();
    this._editorListeners.dispose();
  }
  _handleEditorAdd(editor) {
    this._editorListeners.set(editor.getId(), combinedDisposable(
      editor.onDidChangeModel(() => this._updateState()),
      editor.onDidFocusWidget(() => this._updateState(editor))
    ));
    this._updateState();
  }
  _handleEditorRemove(editor) {
    this._editorListeners.deleteAndDispose(editor.getId());
    this._updateState();
  }
  _updateState(focusedEditor) {
    const editors = /* @__PURE__ */ new Map();
    const visibleEditorsMap = /* @__PURE__ */ new Map();
    for (const editor of this._notebookEditorService.listNotebookEditors()) {
      if (editor.hasModel()) {
        editors.set(editor.getId(), editor);
      }
    }
    const activeNotebookEditor = getNotebookEditorFromEditorPane(this._editorService.activeEditorPane);
    let activeEditor = null;
    if (activeNotebookEditor) {
      activeEditor = activeNotebookEditor.getId();
    } else if (focusedEditor?.textModel) {
      activeEditor = focusedEditor.getId();
    }
    if (activeEditor && !editors.has(activeEditor)) {
      this._logService.trace("MainThreadNotebooksAndEditors#_updateState: active editor is not in editors list", activeEditor, editors.keys());
      activeEditor = null;
    }
    for (const editorPane of this._editorService.visibleEditorPanes) {
      const notebookEditor = getNotebookEditorFromEditorPane(editorPane);
      if (notebookEditor?.hasModel() && editors.has(notebookEditor.getId())) {
        visibleEditorsMap.set(notebookEditor.getId(), notebookEditor);
      }
    }
    const newState = new NotebookAndEditorState(new Set(this._notebookService.listNotebookDocuments()), editors, activeEditor, visibleEditorsMap);
    this._onDelta(NotebookAndEditorState.delta(this._currentState, newState));
    this._currentState = newState;
  }
  _onDelta(delta) {
    if (MainThreadNotebooksAndEditors._isDeltaEmpty(delta)) {
      return;
    }
    const dto = {
      removedDocuments: delta.removedDocuments,
      removedEditors: delta.removedEditors,
      newActiveEditor: delta.newActiveEditor,
      visibleEditors: delta.visibleEditors,
      addedDocuments: delta.addedDocuments.map(MainThreadNotebooksAndEditors._asModelAddData),
      addedEditors: delta.addedEditors.map(this._asEditorAddData, this)
    };
    this._proxy.$acceptDocumentAndEditorsDelta(new SerializableObjectWithBuffers(dto));
    this._mainThreadEditors.handleEditorsRemoved(delta.removedEditors);
    this._mainThreadNotebooks.handleNotebooksRemoved(delta.removedDocuments);
    this._mainThreadNotebooks.handleNotebooksAdded(delta.addedDocuments);
    this._mainThreadEditors.handleEditorsAdded(delta.addedEditors);
  }
  static _isDeltaEmpty(delta) {
    if (delta.addedDocuments !== void 0 && delta.addedDocuments.length > 0) {
      return false;
    }
    if (delta.removedDocuments !== void 0 && delta.removedDocuments.length > 0) {
      return false;
    }
    if (delta.addedEditors !== void 0 && delta.addedEditors.length > 0) {
      return false;
    }
    if (delta.removedEditors !== void 0 && delta.removedEditors.length > 0) {
      return false;
    }
    if (delta.visibleEditors !== void 0 && delta.visibleEditors.length > 0) {
      return false;
    }
    if (delta.newActiveEditor !== void 0) {
      return false;
    }
    return true;
  }
  static _asModelAddData(e) {
    return {
      viewType: e.viewType,
      uri: e.uri,
      metadata: e.metadata,
      versionId: e.versionId,
      cells: e.cells.map(NotebookDto.toNotebookCellDto)
    };
  }
  _asEditorAddData(add) {
    const pane = this._editorService.visibleEditorPanes.find((pane2) => getNotebookEditorFromEditorPane(pane2) === add);
    return {
      id: add.getId(),
      documentUri: add.textModel.uri,
      selections: add.getSelections(),
      visibleRanges: add.visibleRanges,
      viewColumn: pane && editorGroupToColumn(this._editorGroupService, pane.group),
      viewType: add.getViewModel().viewType
    };
  }
};
MainThreadNotebooksAndEditors = __decorateClass([
  extHostCustomer,
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, INotebookService),
  __decorateParam(3, INotebookEditorService),
  __decorateParam(4, IEditorService),
  __decorateParam(5, IEditorGroupsService),
  __decorateParam(6, ILogService)
], MainThreadNotebooksAndEditors);
export {
  MainThreadNotebooksAndEditors
};
