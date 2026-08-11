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
import { illegalArgument } from "../../../base/common/errors.js";
import { dispose, DisposableStore } from "../../../base/common/lifecycle.js";
import { equals as objectEquals } from "../../../base/common/objects.js";
import { URI } from "../../../base/common/uri.js";
import { ICodeEditorService } from "../../../editor/browser/services/codeEditorService.js";
import { CommandsRegistry } from "../../../platform/commands/common/commands.js";
import { EditorActivation, EditorResolution, isTextEditorDiffInformationEqual } from "../../../platform/editor/common/editor.js";
import { ExtHostContext } from "../common/extHost.protocol.js";
import { editorGroupToColumn, columnToEditorGroup } from "../../services/editor/common/editorGroupColumn.js";
import { IEditorService } from "../../services/editor/common/editorService.js";
import { IEditorGroupsService } from "../../services/editor/common/editorGroupsService.js";
import { IEnvironmentService } from "../../../platform/environment/common/environment.js";
import { IWorkingCopyService } from "../../services/workingCopy/common/workingCopyService.js";
import { getCodeEditor } from "../../../editor/browser/editorBrowser.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { IQuickDiffModelService } from "../../contrib/scm/browser/quickDiffModel.js";
import { autorun, constObservable, derived, derivedOpts, observableFromEvent } from "../../../base/common/observable.js";
import { IUriIdentityService } from "../../../platform/uriIdentity/common/uriIdentity.js";
import { isITextModel } from "../../../editor/common/model.js";
import { equals } from "../../../base/common/arrays.js";
import { Event } from "../../../base/common/event.js";
let MainThreadTextEditors = class {
  constructor(_editorLocator, extHostContext, _codeEditorService, _editorService, _editorGroupService, _configurationService, _quickDiffModelService, _uriIdentityService) {
    this._editorLocator = _editorLocator;
    this._codeEditorService = _codeEditorService;
    this._editorService = _editorService;
    this._editorGroupService = _editorGroupService;
    this._configurationService = _configurationService;
    this._quickDiffModelService = _quickDiffModelService;
    this._uriIdentityService = _uriIdentityService;
    this._toDispose = new DisposableStore();
    this._instanceId = String(++MainThreadTextEditors.INSTANCE_COUNT);
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostEditors);
    this._textEditorsListenersMap = /* @__PURE__ */ Object.create(null);
    this._editorPositionData = null;
    this._toDispose.add(this._editorService.onDidVisibleEditorsChange(() => this._updateActiveAndVisibleTextEditors()));
    this._toDispose.add(this._editorGroupService.onDidRemoveGroup(() => this._updateActiveAndVisibleTextEditors()));
    this._toDispose.add(this._editorGroupService.onDidMoveGroup(() => this._updateActiveAndVisibleTextEditors()));
    this._registeredDecorationTypes = /* @__PURE__ */ Object.create(null);
  }
  static {
    this.INSTANCE_COUNT = 0;
  }
  dispose() {
    Object.keys(this._textEditorsListenersMap).forEach((editorId) => {
      dispose(this._textEditorsListenersMap[editorId]);
    });
    this._textEditorsListenersMap = /* @__PURE__ */ Object.create(null);
    this._toDispose.dispose();
    for (const decorationType in this._registeredDecorationTypes) {
      this._codeEditorService.removeDecorationType(decorationType);
    }
    this._registeredDecorationTypes = /* @__PURE__ */ Object.create(null);
  }
  handleTextEditorAdded(textEditor) {
    const id = textEditor.getId();
    const toDispose = [];
    toDispose.push(textEditor.onPropertiesChanged((data) => {
      this._proxy.$acceptEditorPropertiesChanged(id, data);
    }));
    const diffInformationObs = this._getTextEditorDiffInformation(textEditor, toDispose);
    toDispose.push(autorun((reader) => {
      const diffInformation = diffInformationObs.read(reader);
      this._proxy.$acceptEditorDiffInformation(id, diffInformation);
    }));
    this._textEditorsListenersMap[id] = toDispose;
  }
  handleTextEditorRemoved(id) {
    dispose(this._textEditorsListenersMap[id]);
    delete this._textEditorsListenersMap[id];
  }
  _updateActiveAndVisibleTextEditors() {
    const editorPositionData = this._getTextEditorPositionData();
    if (!objectEquals(this._editorPositionData, editorPositionData)) {
      this._editorPositionData = editorPositionData;
      this._proxy.$acceptEditorPositionData(this._editorPositionData);
    }
  }
  _getTextEditorPositionData() {
    const result = /* @__PURE__ */ Object.create(null);
    for (const editorPane of this._editorService.visibleEditorPanes) {
      const id = this._editorLocator.findTextEditorIdFor(editorPane);
      if (id) {
        result[id] = editorGroupToColumn(this._editorGroupService, editorPane.group);
      }
    }
    return result;
  }
  _getTextEditorDiffInformation(textEditor, toDispose) {
    const codeEditor = textEditor.getCodeEditor();
    if (!codeEditor) {
      return constObservable(void 0);
    }
    const [diffEditor] = this._codeEditorService.listDiffEditors().filter((d) => d.getOriginalEditor().getId() === codeEditor.getId() || d.getModifiedEditor().getId() === codeEditor.getId());
    const editorModelObs = diffEditor ? observableFromEvent(this, diffEditor.onDidChangeModel, () => diffEditor.getModel()) : observableFromEvent(this, codeEditor.onDidChangeModel, () => codeEditor.getModel());
    const editorChangesObs = derived((reader) => {
      const editorModel = editorModelObs.read(reader);
      if (!editorModel) {
        return constObservable(void 0);
      }
      if (isITextModel(editorModel)) {
        const quickDiffModelRef2 = this._quickDiffModelService.createQuickDiffModelReference(editorModel.uri);
        if (!quickDiffModelRef2) {
          return constObservable(void 0);
        }
        toDispose.push(quickDiffModelRef2);
        return observableFromEvent(this, quickDiffModelRef2.object.onDidChange, () => {
          return quickDiffModelRef2.object.getQuickDiffResults().map((result) => ({
            original: result.original,
            modified: result.modified,
            changes: result.changes2
          }));
        });
      }
      const diffAlgorithm = this._configurationService.getValue("diffEditor.diffAlgorithm");
      const quickDiffModelRef = this._quickDiffModelService.createQuickDiffModelReference(editorModel.modified.uri, { algorithm: diffAlgorithm });
      if (!quickDiffModelRef) {
        return constObservable(void 0);
      }
      toDispose.push(quickDiffModelRef);
      return observableFromEvent(Event.any(quickDiffModelRef.object.onDidChange, diffEditor.onDidUpdateDiff), () => {
        const diffChanges = diffEditor.getDiffComputationResult()?.changes2 ?? [];
        const diffInformation = [{
          original: editorModel.original.uri,
          modified: editorModel.modified.uri,
          changes: diffChanges.map((change) => change)
        }];
        const quickDiffInformation = quickDiffModelRef.object.getQuickDiffResults().filter((result) => result.providerKind !== "primary").map((result) => ({
          original: result.original,
          modified: result.modified,
          changes: result.changes2
        }));
        return diffInformation.concat(quickDiffInformation);
      });
    });
    return derivedOpts({
      owner: this,
      equalsFn: (diff1, diff2) => equals(diff1, diff2, (a, b) => isTextEditorDiffInformationEqual(this._uriIdentityService, a, b))
    }, (reader) => {
      const editorModel = editorModelObs.read(reader);
      const editorChanges = editorChangesObs.read(reader).read(reader);
      if (!editorModel || !editorChanges) {
        return void 0;
      }
      const documentVersion = isITextModel(editorModel) ? editorModel.getVersionId() : editorModel.modified.getVersionId();
      return editorChanges.map((change) => {
        const changes = change.changes.map((change2) => [
          change2.original.startLineNumber,
          change2.original.endLineNumberExclusive,
          change2.modified.startLineNumber,
          change2.modified.endLineNumberExclusive
        ]);
        return {
          documentVersion,
          original: change.original,
          modified: change.modified,
          changes
        };
      });
    });
  }
  // --- from extension host process
  async $tryShowTextDocument(resource, options) {
    const uri = URI.revive(resource);
    const editorOptions = {
      preserveFocus: options.preserveFocus,
      pinned: options.pinned,
      selection: options.selection,
      // preserve pre 1.38 behaviour to not make group active when preserveFocus: true
      // but make sure to restore the editor to fix https://github.com/microsoft/vscode/issues/79633
      activation: options.preserveFocus ? EditorActivation.RESTORE : void 0,
      override: EditorResolution.EXCLUSIVE_ONLY
    };
    const input = {
      resource: uri,
      options: editorOptions
    };
    const editor = await this._editorService.openEditor(input, columnToEditorGroup(this._editorGroupService, this._configurationService, options.position));
    if (!editor) {
      return void 0;
    }
    const editorControl = editor.getControl();
    const codeEditor = getCodeEditor(editorControl);
    return codeEditor ? this._editorLocator.getIdOfCodeEditor(codeEditor) : void 0;
  }
  async $tryShowEditor(id, position) {
    const mainThreadEditor = this._editorLocator.getEditor(id);
    if (mainThreadEditor) {
      const model = mainThreadEditor.getModel();
      await this._editorService.openEditor({
        resource: model.uri,
        options: { preserveFocus: false }
      }, columnToEditorGroup(this._editorGroupService, this._configurationService, position));
      return;
    }
  }
  async $tryHideEditor(id) {
    const mainThreadEditor = this._editorLocator.getEditor(id);
    if (mainThreadEditor) {
      const editorPanes = this._editorService.visibleEditorPanes;
      for (const editorPane of editorPanes) {
        if (mainThreadEditor.matches(editorPane)) {
          await editorPane.group.closeEditor(editorPane.input);
          return;
        }
      }
    }
  }
  $trySetSelections(id, selections) {
    const editor = this._editorLocator.getEditor(id);
    if (!editor) {
      return Promise.reject(illegalArgument(`TextEditor(${id})`));
    }
    editor.setSelections(selections);
    return Promise.resolve(void 0);
  }
  $trySetDecorations(id, key, ranges) {
    key = `${this._instanceId}-${key}`;
    const editor = this._editorLocator.getEditor(id);
    if (!editor) {
      return Promise.reject(illegalArgument(`TextEditor(${id})`));
    }
    editor.setDecorations(key, ranges);
    return Promise.resolve(void 0);
  }
  $trySetDecorationsFast(id, key, ranges) {
    key = `${this._instanceId}-${key}`;
    const editor = this._editorLocator.getEditor(id);
    if (!editor) {
      return Promise.reject(illegalArgument(`TextEditor(${id})`));
    }
    editor.setDecorationsFast(key, ranges);
    return Promise.resolve(void 0);
  }
  $tryRevealRange(id, range, revealType) {
    const editor = this._editorLocator.getEditor(id);
    if (!editor) {
      return Promise.reject(illegalArgument(`TextEditor(${id})`));
    }
    editor.revealRange(range, revealType);
    return Promise.resolve();
  }
  $trySetOptions(id, options) {
    const editor = this._editorLocator.getEditor(id);
    if (!editor) {
      return Promise.reject(illegalArgument(`TextEditor(${id})`));
    }
    editor.setConfiguration(options);
    return Promise.resolve(void 0);
  }
  $tryApplyEdits(id, modelVersionId, edits, opts) {
    const editor = this._editorLocator.getEditor(id);
    if (!editor) {
      return Promise.reject(illegalArgument(`TextEditor(${id})`));
    }
    return Promise.resolve(editor.applyEdits(modelVersionId, edits, opts));
  }
  $tryInsertSnippet(id, modelVersionId, template, ranges, opts) {
    const editor = this._editorLocator.getEditor(id);
    if (!editor) {
      return Promise.reject(illegalArgument(`TextEditor(${id})`));
    }
    return Promise.resolve(editor.insertSnippet(modelVersionId, template, ranges, opts));
  }
  $registerTextEditorDecorationType(extensionId, key, options) {
    key = `${this._instanceId}-${key}`;
    this._registeredDecorationTypes[key] = true;
    this._codeEditorService.registerDecorationType(`exthost-api-${extensionId}`, key, options);
  }
  $removeTextEditorDecorationType(key) {
    key = `${this._instanceId}-${key}`;
    delete this._registeredDecorationTypes[key];
    this._codeEditorService.removeDecorationType(key);
  }
  $getDiffInformation(id) {
    const editor = this._editorLocator.getEditor(id);
    if (!editor) {
      return Promise.reject(new Error("No such TextEditor"));
    }
    const codeEditor = editor.getCodeEditor();
    if (!codeEditor) {
      return Promise.reject(new Error("No such CodeEditor"));
    }
    const codeEditorId = codeEditor.getId();
    const diffEditors = this._codeEditorService.listDiffEditors();
    const [diffEditor] = diffEditors.filter((d) => d.getOriginalEditor().getId() === codeEditorId || d.getModifiedEditor().getId() === codeEditorId);
    if (diffEditor) {
      return Promise.resolve(diffEditor.getLineChanges() || []);
    }
    if (!codeEditor.hasModel()) {
      return Promise.resolve([]);
    }
    const quickDiffModelRef = this._quickDiffModelService.createQuickDiffModelReference(codeEditor.getModel().uri);
    if (!quickDiffModelRef) {
      return Promise.resolve([]);
    }
    try {
      const primaryQuickDiff = quickDiffModelRef.object.quickDiffs.find((quickDiff) => quickDiff.kind === "primary");
      const primaryQuickDiffChanges = quickDiffModelRef.object.changes.filter((change) => change.providerId === primaryQuickDiff?.id);
      return Promise.resolve(primaryQuickDiffChanges.map((change) => change.change) ?? []);
    } finally {
      quickDiffModelRef.dispose();
    }
  }
};
MainThreadTextEditors = __decorateClass([
  __decorateParam(2, ICodeEditorService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IEditorGroupsService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IQuickDiffModelService),
  __decorateParam(7, IUriIdentityService)
], MainThreadTextEditors);
CommandsRegistry.registerCommand("_workbench.revertAllDirty", async function(accessor) {
  const environmentService = accessor.get(IEnvironmentService);
  if (!environmentService.extensionTestsLocationURI) {
    throw new Error("Command is only available when running extension tests.");
  }
  const workingCopyService = accessor.get(IWorkingCopyService);
  for (const workingCopy of workingCopyService.dirtyWorkingCopies) {
    await workingCopy.revert({ soft: true });
  }
});
export {
  MainThreadTextEditors
};
