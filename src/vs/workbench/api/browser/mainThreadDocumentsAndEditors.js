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
import { Event } from "../../../base/common/event.js";
import { combinedDisposable, DisposableStore, DisposableMap } from "../../../base/common/lifecycle.js";
import { isCodeEditor, isDiffEditor } from "../../../editor/browser/editorBrowser.js";
import { ICodeEditorService } from "../../../editor/browser/services/codeEditorService.js";
import { shouldSynchronizeModel } from "../../../editor/common/model.js";
import { IModelService } from "../../../editor/common/services/model.js";
import { ITextModelService } from "../../../editor/common/services/resolverService.js";
import { IFileService } from "../../../platform/files/common/files.js";
import { extHostCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { MainThreadDocuments } from "./mainThreadDocuments.js";
import { MainThreadTextEditor } from "./mainThreadEditor.js";
import { MainThreadTextEditors } from "./mainThreadEditors.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { AbstractTextEditor } from "../../browser/parts/editor/textEditor.js";
import { editorGroupToColumn } from "../../services/editor/common/editorGroupColumn.js";
import { IEditorService } from "../../services/editor/common/editorService.js";
import { IEditorGroupsService } from "../../services/editor/common/editorGroupsService.js";
import { ITextFileService } from "../../services/textfile/common/textfiles.js";
import { IWorkbenchEnvironmentService } from "../../services/environment/common/environmentService.js";
import { IWorkingCopyFileService } from "../../services/workingCopy/common/workingCopyFileService.js";
import { IUriIdentityService } from "../../../platform/uriIdentity/common/uriIdentity.js";
import { IClipboardService } from "../../../platform/clipboard/common/clipboardService.js";
import { IPathService } from "../../services/path/common/pathService.js";
import { diffSets, diffMaps } from "../../../base/common/collections.js";
import { IPaneCompositePartService } from "../../services/panecomposite/browser/panecomposite.js";
import { ViewContainerLocation } from "../../common/views.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { IQuickDiffModelService } from "../../contrib/scm/browser/quickDiffModel.js";
class TextEditorSnapshot {
  constructor(editor) {
    this.editor = editor;
    this.id = `${editor.getId()},${editor.getModel().id}`;
  }
}
class DocumentAndEditorStateDelta {
  constructor(removedDocuments, addedDocuments, removedEditors, addedEditors, oldActiveEditor, newActiveEditor) {
    this.removedDocuments = removedDocuments;
    this.addedDocuments = addedDocuments;
    this.removedEditors = removedEditors;
    this.addedEditors = addedEditors;
    this.oldActiveEditor = oldActiveEditor;
    this.newActiveEditor = newActiveEditor;
    this.isEmpty = this.removedDocuments.length === 0 && this.addedDocuments.length === 0 && this.removedEditors.length === 0 && this.addedEditors.length === 0 && oldActiveEditor === newActiveEditor;
  }
  toString() {
    let ret = "DocumentAndEditorStateDelta\n";
    ret += `	Removed Documents: [${this.removedDocuments.map((d) => d.uri.toString(true)).join(", ")}]
`;
    ret += `	Added Documents: [${this.addedDocuments.map((d) => d.uri.toString(true)).join(", ")}]
`;
    ret += `	Removed Editors: [${this.removedEditors.map((e) => e.id).join(", ")}]
`;
    ret += `	Added Editors: [${this.addedEditors.map((e) => e.id).join(", ")}]
`;
    ret += `	New Active Editor: ${this.newActiveEditor}
`;
    return ret;
  }
}
class DocumentAndEditorState {
  constructor(documents, textEditors, activeEditor) {
    this.documents = documents;
    this.textEditors = textEditors;
    this.activeEditor = activeEditor;
  }
  static compute(before, after) {
    if (!before) {
      return new DocumentAndEditorStateDelta(
        [],
        [...after.documents.values()],
        [],
        [...after.textEditors.values()],
        void 0,
        after.activeEditor
      );
    }
    const documentDelta = diffSets(before.documents, after.documents);
    const editorDelta = diffMaps(before.textEditors, after.textEditors);
    const oldActiveEditor = before.activeEditor !== after.activeEditor ? before.activeEditor : void 0;
    const newActiveEditor = before.activeEditor !== after.activeEditor ? after.activeEditor : void 0;
    return new DocumentAndEditorStateDelta(
      documentDelta.removed,
      documentDelta.added,
      editorDelta.removed,
      editorDelta.added,
      oldActiveEditor,
      newActiveEditor
    );
  }
}
var ActiveEditorOrder = /* @__PURE__ */ ((ActiveEditorOrder2) => {
  ActiveEditorOrder2[ActiveEditorOrder2["Editor"] = 0] = "Editor";
  ActiveEditorOrder2[ActiveEditorOrder2["Panel"] = 1] = "Panel";
  return ActiveEditorOrder2;
})(ActiveEditorOrder || {});
let MainThreadDocumentAndEditorStateComputer = class {
  constructor(_onDidChangeState, _modelService, _codeEditorService, _editorService, _paneCompositeService) {
    this._onDidChangeState = _onDidChangeState;
    this._modelService = _modelService;
    this._codeEditorService = _codeEditorService;
    this._editorService = _editorService;
    this._paneCompositeService = _paneCompositeService;
    this._toDispose = new DisposableStore();
    this._toDisposeOnEditorRemove = new DisposableMap();
    this._activeEditorOrder = 0 /* Editor */;
    this._modelService.onModelAdded(this._updateStateOnModelAdd, this, this._toDispose);
    this._modelService.onModelRemoved((_) => this._updateState(), this, this._toDispose);
    this._editorService.onDidActiveEditorChange((_) => this._updateState(), this, this._toDispose);
    this._codeEditorService.onCodeEditorAdd(this._onDidAddEditor, this, this._toDispose);
    this._codeEditorService.onCodeEditorRemove(this._onDidRemoveEditor, this, this._toDispose);
    this._codeEditorService.listCodeEditors().forEach(this._onDidAddEditor, this);
    Event.filter(this._paneCompositeService.onDidPaneCompositeOpen, (event) => event.viewContainerLocation === ViewContainerLocation.Panel)((_) => this._activeEditorOrder = 1 /* Panel */, void 0, this._toDispose);
    Event.filter(this._paneCompositeService.onDidPaneCompositeClose, (event) => event.viewContainerLocation === ViewContainerLocation.Panel)((_) => this._activeEditorOrder = 0 /* Editor */, void 0, this._toDispose);
    this._editorService.onDidVisibleEditorsChange((_) => this._activeEditorOrder = 0 /* Editor */, void 0, this._toDispose);
    this._updateState();
  }
  dispose() {
    this._toDispose.dispose();
    this._toDisposeOnEditorRemove.dispose();
  }
  _onDidAddEditor(e) {
    this._toDisposeOnEditorRemove.set(e.getId(), combinedDisposable(
      e.onDidChangeModel(() => this._updateState()),
      e.onDidFocusEditorText(() => this._updateState()),
      e.onDidFocusEditorWidget(() => this._updateState(e))
    ));
    this._updateState();
  }
  _onDidRemoveEditor(e) {
    const id = e.getId();
    if (this._toDisposeOnEditorRemove.has(id)) {
      this._toDisposeOnEditorRemove.deleteAndDispose(id);
      this._updateState();
    }
  }
  _updateStateOnModelAdd(model) {
    if (!shouldSynchronizeModel(model)) {
      return;
    }
    if (!this._currentState) {
      this._updateState();
      return;
    }
    this._currentState = new DocumentAndEditorState(
      this._currentState.documents.add(model),
      this._currentState.textEditors,
      this._currentState.activeEditor
    );
    this._onDidChangeState(new DocumentAndEditorStateDelta(
      [],
      [model],
      [],
      [],
      void 0,
      void 0
    ));
  }
  _updateState(widgetFocusCandidate) {
    const models = /* @__PURE__ */ new Set();
    for (const model of this._modelService.getModels()) {
      if (shouldSynchronizeModel(model)) {
        models.add(model);
      }
    }
    const editors = /* @__PURE__ */ new Map();
    let activeEditor = null;
    for (const editor of this._codeEditorService.listCodeEditors()) {
      if (editor.isSimpleWidget) {
        continue;
      }
      const model = editor.getModel();
      if (editor.hasModel() && model && shouldSynchronizeModel(model) && !model.isDisposed() && Boolean(this._modelService.getModel(model.uri))) {
        const apiEditor = new TextEditorSnapshot(editor);
        editors.set(apiEditor.id, apiEditor);
        if (editor.hasTextFocus() || widgetFocusCandidate === editor && editor.hasWidgetFocus()) {
          activeEditor = apiEditor.id;
        }
      }
    }
    if (!activeEditor) {
      let candidate;
      if (this._activeEditorOrder === 0 /* Editor */) {
        candidate = this._getActiveEditorFromEditorPart() || this._getActiveEditorFromPanel();
      } else {
        candidate = this._getActiveEditorFromPanel() || this._getActiveEditorFromEditorPart();
      }
      if (candidate) {
        for (const snapshot of editors.values()) {
          if (candidate === snapshot.editor) {
            activeEditor = snapshot.id;
          }
        }
      }
    }
    const newState = new DocumentAndEditorState(models, editors, activeEditor);
    const delta = DocumentAndEditorState.compute(this._currentState, newState);
    if (!delta.isEmpty) {
      this._currentState = newState;
      this._onDidChangeState(delta);
    }
  }
  _getActiveEditorFromPanel() {
    const panel = this._paneCompositeService.getActivePaneComposite(ViewContainerLocation.Panel);
    if (panel instanceof AbstractTextEditor) {
      const control = panel.getControl();
      if (isCodeEditor(control)) {
        return control;
      }
    }
    return void 0;
  }
  _getActiveEditorFromEditorPart() {
    let activeTextEditorControl = this._editorService.activeTextEditorControl;
    if (isDiffEditor(activeTextEditorControl)) {
      activeTextEditorControl = activeTextEditorControl.getModifiedEditor();
    }
    return activeTextEditorControl;
  }
};
MainThreadDocumentAndEditorStateComputer = __decorateClass([
  __decorateParam(1, IModelService),
  __decorateParam(2, ICodeEditorService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IPaneCompositePartService)
], MainThreadDocumentAndEditorStateComputer);
let MainThreadDocumentsAndEditors = class {
  constructor(extHostContext, _modelService, _textFileService, _editorService, codeEditorService, fileService, textModelResolverService, _editorGroupService, paneCompositeService, environmentService, workingCopyFileService, uriIdentityService, _clipboardService, pathService, configurationService, quickDiffModelService) {
    this._modelService = _modelService;
    this._textFileService = _textFileService;
    this._editorService = _editorService;
    this._editorGroupService = _editorGroupService;
    this._clipboardService = _clipboardService;
    this._toDispose = new DisposableStore();
    this._textEditors = /* @__PURE__ */ new Map();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostDocumentsAndEditors);
    this._mainThreadDocuments = this._toDispose.add(new MainThreadDocuments(extHostContext, this._modelService, this._textFileService, fileService, textModelResolverService, environmentService, uriIdentityService, workingCopyFileService, pathService));
    extHostContext.set(MainContext.MainThreadDocuments, this._mainThreadDocuments);
    this._mainThreadEditors = this._toDispose.add(new MainThreadTextEditors(this, extHostContext, codeEditorService, this._editorService, this._editorGroupService, configurationService, quickDiffModelService, uriIdentityService));
    extHostContext.set(MainContext.MainThreadTextEditors, this._mainThreadEditors);
    this._toDispose.add(new MainThreadDocumentAndEditorStateComputer((delta) => this._onDelta(delta), _modelService, codeEditorService, this._editorService, paneCompositeService));
  }
  dispose() {
    this._toDispose.dispose();
  }
  _onDelta(delta) {
    const removedEditors = [];
    const addedEditors = [];
    const removedDocuments = delta.removedDocuments.map((m) => m.uri);
    for (const apiEditor of delta.addedEditors) {
      const mainThreadEditor = new MainThreadTextEditor(
        apiEditor.id,
        apiEditor.editor.getModel(),
        apiEditor.editor,
        { onGainedFocus() {
        }, onLostFocus() {
        } },
        this._mainThreadDocuments,
        this._modelService,
        this._clipboardService
      );
      this._textEditors.set(apiEditor.id, mainThreadEditor);
      addedEditors.push(mainThreadEditor);
    }
    for (const { id } of delta.removedEditors) {
      const mainThreadEditor = this._textEditors.get(id);
      if (mainThreadEditor) {
        mainThreadEditor.dispose();
        this._textEditors.delete(id);
        removedEditors.push(id);
      }
    }
    const extHostDelta = /* @__PURE__ */ Object.create(null);
    let empty = true;
    if (delta.newActiveEditor !== void 0) {
      empty = false;
      extHostDelta.newActiveEditor = delta.newActiveEditor;
    }
    if (removedDocuments.length > 0) {
      empty = false;
      extHostDelta.removedDocuments = removedDocuments;
    }
    if (removedEditors.length > 0) {
      empty = false;
      extHostDelta.removedEditors = removedEditors;
    }
    if (delta.addedDocuments.length > 0) {
      empty = false;
      extHostDelta.addedDocuments = delta.addedDocuments.map((m) => this._toModelAddData(m));
    }
    if (delta.addedEditors.length > 0) {
      empty = false;
      extHostDelta.addedEditors = addedEditors.map((e) => this._toTextEditorAddData(e));
    }
    if (!empty) {
      this._proxy.$acceptDocumentsAndEditorsDelta(extHostDelta);
      removedDocuments.forEach(this._mainThreadDocuments.handleModelRemoved, this._mainThreadDocuments);
      delta.addedDocuments.forEach(this._mainThreadDocuments.handleModelAdded, this._mainThreadDocuments);
      removedEditors.forEach(this._mainThreadEditors.handleTextEditorRemoved, this._mainThreadEditors);
      addedEditors.forEach(this._mainThreadEditors.handleTextEditorAdded, this._mainThreadEditors);
    }
  }
  _toModelAddData(model) {
    return {
      uri: model.uri,
      versionId: model.getVersionId(),
      lines: model.getLinesContent(),
      EOL: model.getEOL(),
      languageId: model.getLanguageId(),
      isDirty: this._textFileService.isDirty(model.uri),
      encoding: this._textFileService.getEncoding(model.uri)
    };
  }
  _toTextEditorAddData(textEditor) {
    const props = textEditor.getProperties();
    return {
      id: textEditor.getId(),
      documentUri: textEditor.getModel().uri,
      options: props.options,
      selections: props.selections,
      visibleRanges: props.visibleRanges,
      editorPosition: this._findEditorPosition(textEditor)
    };
  }
  _findEditorPosition(editor) {
    for (const editorPane of this._editorService.visibleEditorPanes) {
      if (editor.matches(editorPane)) {
        return editorGroupToColumn(this._editorGroupService, editorPane.group);
      }
    }
    return void 0;
  }
  findTextEditorIdFor(editorPane) {
    for (const [id, editor] of this._textEditors) {
      if (editor.matches(editorPane)) {
        return id;
      }
    }
    return void 0;
  }
  getIdOfCodeEditor(codeEditor) {
    for (const [id, editor] of this._textEditors) {
      if (editor.getCodeEditor() === codeEditor) {
        return id;
      }
    }
    return void 0;
  }
  getEditor(id) {
    return this._textEditors.get(id);
  }
};
MainThreadDocumentsAndEditors = __decorateClass([
  extHostCustomer,
  __decorateParam(1, IModelService),
  __decorateParam(2, ITextFileService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, ICodeEditorService),
  __decorateParam(5, IFileService),
  __decorateParam(6, ITextModelService),
  __decorateParam(7, IEditorGroupsService),
  __decorateParam(8, IPaneCompositePartService),
  __decorateParam(9, IWorkbenchEnvironmentService),
  __decorateParam(10, IWorkingCopyFileService),
  __decorateParam(11, IUriIdentityService),
  __decorateParam(12, IClipboardService),
  __decorateParam(13, IPathService),
  __decorateParam(14, IConfigurationService),
  __decorateParam(15, IQuickDiffModelService)
], MainThreadDocumentsAndEditors);
export {
  MainThreadDocumentsAndEditors
};
