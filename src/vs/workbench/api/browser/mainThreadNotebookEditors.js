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
import { DisposableStore, dispose } from "../../../base/common/lifecycle.js";
import { equals } from "../../../base/common/objects.js";
import { URI } from "../../../base/common/uri.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { EditorActivation } from "../../../platform/editor/common/editor.js";
import { getNotebookEditorFromEditorPane } from "../../contrib/notebook/browser/notebookBrowser.js";
import { INotebookEditorService } from "../../contrib/notebook/browser/services/notebookEditorService.js";
import { columnToEditorGroup, editorGroupToColumn } from "../../services/editor/common/editorGroupColumn.js";
import { IEditorGroupsService } from "../../services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../services/editor/common/editorService.js";
import { ExtHostContext, NotebookEditorRevealType } from "../common/extHost.protocol.js";
class MainThreadNotebook {
  constructor(editor, disposables) {
    this.editor = editor;
    this.disposables = disposables;
  }
  dispose() {
    this.disposables.dispose();
  }
}
let MainThreadNotebookEditors = class {
  constructor(extHostContext, _editorService, _notebookEditorService, _editorGroupService, _configurationService) {
    this._editorService = _editorService;
    this._notebookEditorService = _notebookEditorService;
    this._editorGroupService = _editorGroupService;
    this._configurationService = _configurationService;
    this._disposables = new DisposableStore();
    this._mainThreadEditors = /* @__PURE__ */ new Map();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostNotebookEditors);
    this._editorService.onDidActiveEditorChange(() => this._updateEditorViewColumns(), this, this._disposables);
    this._editorGroupService.onDidRemoveGroup(() => this._updateEditorViewColumns(), this, this._disposables);
    this._editorGroupService.onDidMoveGroup(() => this._updateEditorViewColumns(), this, this._disposables);
  }
  dispose() {
    this._disposables.dispose();
    dispose(this._mainThreadEditors.values());
  }
  handleEditorsAdded(editors) {
    for (const editor of editors) {
      const editorDisposables = new DisposableStore();
      editorDisposables.add(editor.onDidChangeVisibleRanges(() => {
        this._proxy.$acceptEditorPropertiesChanged(editor.getId(), { visibleRanges: { ranges: editor.visibleRanges } });
      }));
      editorDisposables.add(editor.onDidChangeSelection(() => {
        this._proxy.$acceptEditorPropertiesChanged(editor.getId(), { selections: { selections: editor.getSelections() } });
      }));
      const wrapper = new MainThreadNotebook(editor, editorDisposables);
      this._mainThreadEditors.set(editor.getId(), wrapper);
    }
  }
  handleEditorsRemoved(editorIds) {
    for (const id of editorIds) {
      this._mainThreadEditors.get(id)?.dispose();
      this._mainThreadEditors.delete(id);
    }
  }
  _updateEditorViewColumns() {
    const result = /* @__PURE__ */ Object.create(null);
    for (const editorPane of this._editorService.visibleEditorPanes) {
      const candidate = getNotebookEditorFromEditorPane(editorPane);
      if (candidate && this._mainThreadEditors.has(candidate.getId())) {
        result[candidate.getId()] = editorGroupToColumn(this._editorGroupService, editorPane.group);
      }
    }
    if (!equals(result, this._currentViewColumnInfo)) {
      this._currentViewColumnInfo = result;
      this._proxy.$acceptEditorViewColumns(result);
    }
  }
  async $tryShowNotebookDocument(resource, viewType, options) {
    const editorOptions = {
      cellSelections: options.selections,
      preserveFocus: options.preserveFocus,
      pinned: options.pinned,
      // selection: options.selection,
      // preserve pre 1.38 behaviour to not make group active when preserveFocus: true
      // but make sure to restore the editor to fix https://github.com/microsoft/vscode/issues/79633
      activation: options.preserveFocus ? EditorActivation.RESTORE : void 0,
      label: options.label,
      override: viewType
    };
    const editorPane = await this._editorService.openEditor({ resource: URI.revive(resource), options: editorOptions }, columnToEditorGroup(this._editorGroupService, this._configurationService, options.position));
    const notebookEditor = getNotebookEditorFromEditorPane(editorPane);
    if (notebookEditor) {
      return notebookEditor.getId();
    } else {
      throw new Error(`Notebook Editor creation failure for document ${JSON.stringify(resource)}`);
    }
  }
  async $tryRevealRange(id, range, revealType) {
    const editor = this._notebookEditorService.getNotebookEditor(id);
    if (!editor) {
      return;
    }
    const notebookEditor = editor;
    if (!notebookEditor.hasModel()) {
      return;
    }
    if (range.start >= notebookEditor.getLength()) {
      return;
    }
    const cell = notebookEditor.cellAt(range.start);
    switch (revealType) {
      case NotebookEditorRevealType.Default:
        return notebookEditor.revealCellRangeInView(range);
      case NotebookEditorRevealType.InCenter:
        return notebookEditor.revealInCenter(cell);
      case NotebookEditorRevealType.InCenterIfOutsideViewport:
        return notebookEditor.revealInCenterIfOutsideViewport(cell);
      case NotebookEditorRevealType.AtTop:
        return notebookEditor.revealInViewAtTop(cell);
    }
  }
  $trySetSelections(id, ranges) {
    const editor = this._notebookEditorService.getNotebookEditor(id);
    if (!editor) {
      return;
    }
    editor.setSelections(ranges);
    if (ranges.length) {
      editor.setFocus({ start: ranges[0].start, end: ranges[0].start + 1 });
    }
  }
};
MainThreadNotebookEditors = __decorateClass([
  __decorateParam(1, IEditorService),
  __decorateParam(2, INotebookEditorService),
  __decorateParam(3, IEditorGroupsService),
  __decorateParam(4, IConfigurationService)
], MainThreadNotebookEditors);
export {
  MainThreadNotebookEditors
};
