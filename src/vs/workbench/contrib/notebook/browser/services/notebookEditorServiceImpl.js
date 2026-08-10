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
import { ResourceMap } from "../../../../../base/common/map.js";
import { getDefaultNotebookCreationOptions, NotebookEditorWidget } from "../notebookEditorWidget.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { IEditorGroupsService } from "../../../../services/editor/common/editorGroupsService.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { isCompositeNotebookEditorInput, isNotebookEditorInput, NotebookEditorInput } from "../../common/notebookEditorInput.js";
import { Emitter } from "../../../../../base/common/event.js";
import { GroupModelChangeKind } from "../../../../common/editor.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { InteractiveWindowOpen, MOST_RECENT_REPL_EDITOR } from "../../common/notebookContextKeys.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { IEditorProgressService } from "../../../../../platform/progress/common/progress.js";
import { NotebookDiffEditorInput } from "../../common/notebookDiffEditorInput.js";
let NotebookEditorWidgetService = class {
  constructor(editorGroupService, editorService, contextKeyService, instantiationService) {
    this.editorGroupService = editorGroupService;
    this.instantiationService = instantiationService;
    this._tokenPool = 1;
    this._disposables = new DisposableStore();
    this._notebookEditors = /* @__PURE__ */ new Map();
    this.groupListener = /* @__PURE__ */ new Map();
    this._onNotebookEditorAdd = new Emitter();
    this._onNotebookEditorsRemove = new Emitter();
    this.onDidAddNotebookEditor = this._onNotebookEditorAdd.event;
    this.onDidRemoveNotebookEditor = this._onNotebookEditorsRemove.event;
    this._borrowableEditors = /* @__PURE__ */ new Map();
    const onNewGroup = (group) => {
      const { id } = group;
      const listeners = [];
      listeners.push(group.onDidCloseEditor((e) => {
        const widgetMap = this._borrowableEditors.get(group.id);
        if (!widgetMap) {
          return;
        }
        const inputs = e.editor instanceof NotebookEditorInput || e.editor instanceof NotebookDiffEditorInput ? [e.editor] : isCompositeNotebookEditorInput(e.editor) ? e.editor.editorInputs : [];
        inputs.forEach((input) => {
          const widgets = widgetMap.get(input.resource);
          const index = widgets?.findIndex((widget) => widget.editorType === input.typeId);
          if (!widgets || index === void 0 || index === -1) {
            return;
          }
          const value = widgets.splice(index, 1)[0];
          value.token = void 0;
          this._disposeWidget(value.widget);
          value.disposableStore.dispose();
          value.widget = void 0;
        });
      }));
      listeners.push(group.onWillMoveEditor((e) => {
        if (isNotebookEditorInput(e.editor)) {
          this._allowWidgetMove(e.editor, e.groupId, e.target);
        }
        if (isCompositeNotebookEditorInput(e.editor)) {
          e.editor.editorInputs.forEach((input) => {
            this._allowWidgetMove(input, e.groupId, e.target);
          });
        }
      }));
      this.groupListener.set(id, listeners);
    };
    this._disposables.add(editorGroupService.onDidAddGroup(onNewGroup));
    editorGroupService.whenReady.then(() => editorGroupService.groups.forEach(onNewGroup));
    this._disposables.add(editorGroupService.onDidRemoveGroup((group) => {
      const listeners = this.groupListener.get(group.id);
      if (listeners) {
        listeners.forEach((listener) => listener.dispose());
        this.groupListener.delete(group.id);
      }
      const widgets = this._borrowableEditors.get(group.id);
      this._borrowableEditors.delete(group.id);
      if (widgets) {
        for (const values of widgets.values()) {
          for (const value of values) {
            value.token = void 0;
            this._disposeWidget(value.widget);
            value.disposableStore.dispose();
          }
        }
      }
    }));
    this._mostRecentRepl = MOST_RECENT_REPL_EDITOR.bindTo(contextKeyService);
    const interactiveWindowOpen = InteractiveWindowOpen.bindTo(contextKeyService);
    this._disposables.add(editorService.onDidEditorsChange((e) => {
      if (e.event.kind === GroupModelChangeKind.EDITOR_OPEN && !interactiveWindowOpen.get()) {
        if (editorService.editors.find((editor) => isCompositeNotebookEditorInput(editor))) {
          interactiveWindowOpen.set(true);
        }
      } else if (e.event.kind === GroupModelChangeKind.EDITOR_CLOSE && interactiveWindowOpen.get()) {
        if (!editorService.editors.find((editor) => isCompositeNotebookEditorInput(editor))) {
          interactiveWindowOpen.set(false);
        }
      }
    }));
  }
  dispose() {
    this._disposables.dispose();
    this._onNotebookEditorAdd.dispose();
    this._onNotebookEditorsRemove.dispose();
    this.groupListener.forEach((listeners) => {
      listeners.forEach((listener) => listener.dispose());
    });
    this.groupListener.clear();
    this._borrowableEditors.forEach((widgetMap) => {
      widgetMap.forEach((widgets) => {
        widgets.forEach((widget) => widget.disposableStore.dispose());
      });
    });
  }
  // --- group-based editor borrowing...
  _disposeWidget(widget) {
    widget.onWillHide();
    const domNode = widget.getDomNode();
    widget.dispose();
    domNode.remove();
  }
  _allowWidgetMove(input, sourceID, targetID) {
    const sourcePart = this.editorGroupService.getPart(sourceID);
    const targetPart = this.editorGroupService.getPart(targetID);
    if (sourcePart.windowId !== targetPart.windowId) {
      return;
    }
    const target = this._borrowableEditors.get(targetID)?.get(input.resource)?.findIndex((widget2) => widget2.editorType === input.typeId);
    if (target !== void 0 && target !== -1) {
      return;
    }
    const widget = this._borrowableEditors.get(sourceID)?.get(input.resource)?.find((widget2) => widget2.editorType === input.typeId);
    if (!widget) {
      throw new Error("no widget at source group");
    }
    const sourceWidgets = this._borrowableEditors.get(sourceID)?.get(input.resource);
    if (sourceWidgets) {
      const indexToRemove = sourceWidgets.findIndex((widget2) => widget2.editorType === input.typeId);
      if (indexToRemove !== -1) {
        sourceWidgets.splice(indexToRemove, 1);
      }
    }
    let targetMap = this._borrowableEditors.get(targetID);
    if (!targetMap) {
      targetMap = new ResourceMap();
      this._borrowableEditors.set(targetID, targetMap);
    }
    const widgetsAtTarget = targetMap.get(input.resource) ?? [];
    widgetsAtTarget?.push(widget);
    targetMap.set(input.resource, widgetsAtTarget);
  }
  retrieveExistingWidgetFromURI(resource) {
    for (const widgetInfo of this._borrowableEditors.values()) {
      const widgets = widgetInfo.get(resource);
      if (widgets && widgets.length > 0) {
        return this._createBorrowValue(widgets[0].token, widgets[0]);
      }
    }
    return void 0;
  }
  retrieveAllExistingWidgets() {
    const ret = [];
    for (const widgetInfo of this._borrowableEditors.values()) {
      for (const widgets of widgetInfo.values()) {
        for (const widget of widgets) {
          ret.push(this._createBorrowValue(widget.token, widget));
        }
      }
    }
    return ret;
  }
  retrieveWidget(accessor, groupId, input, creationOptions, initialDimension, codeWindow) {
    let value = this._borrowableEditors.get(groupId)?.get(input.resource)?.find((widget) => widget.editorType === input.typeId);
    if (!value) {
      const editorGroupContextKeyService = accessor.get(IContextKeyService);
      const editorGroupEditorProgressService = accessor.get(IEditorProgressService);
      const widgetDisposeStore = new DisposableStore();
      const widget = this.createWidget(editorGroupContextKeyService, widgetDisposeStore, editorGroupEditorProgressService, creationOptions, codeWindow, initialDimension);
      const token = this._tokenPool++;
      value = { widget, editorType: input.typeId, token, disposableStore: widgetDisposeStore };
      let map = this._borrowableEditors.get(groupId);
      if (!map) {
        map = new ResourceMap();
        this._borrowableEditors.set(groupId, map);
      }
      const values = map.get(input.resource) ?? [];
      values.push(value);
      map.set(input.resource, values);
    } else {
      value.token = this._tokenPool++;
    }
    return this._createBorrowValue(value.token, value);
  }
  // protected for unit testing overrides
  createWidget(editorGroupContextKeyService, widgetDisposeStore, editorGroupEditorProgressService, creationOptions, codeWindow, initialDimension) {
    const notebookInstantiationService = widgetDisposeStore.add(this.instantiationService.createChild(new ServiceCollection(
      [IContextKeyService, editorGroupContextKeyService],
      [IEditorProgressService, editorGroupEditorProgressService]
    )));
    const ctorOptions = creationOptions ?? getDefaultNotebookCreationOptions();
    const widget = notebookInstantiationService.createInstance(NotebookEditorWidget, {
      ...ctorOptions,
      codeWindow: codeWindow ?? ctorOptions.codeWindow
    }, initialDimension);
    return widget;
  }
  _createBorrowValue(myToken, widget) {
    return {
      get value() {
        return widget.token === myToken ? widget.widget : void 0;
      }
    };
  }
  // --- editor management
  addNotebookEditor(editor) {
    this._notebookEditors.set(editor.getId(), editor);
    this._onNotebookEditorAdd.fire(editor);
  }
  removeNotebookEditor(editor) {
    const notebookUri = editor.getViewModel()?.notebookDocument.uri;
    if (this._notebookEditors.delete(editor.getId())) {
      this._onNotebookEditorsRemove.fire(editor);
    }
    if (this._mostRecentRepl.get() === notebookUri?.toString()) {
      this._mostRecentRepl.reset();
    }
  }
  getNotebookEditor(editorId) {
    return this._notebookEditors.get(editorId);
  }
  listNotebookEditors() {
    return [...this._notebookEditors].map((e) => e[1]);
  }
  getNotebookForPossibleCell(candidate) {
    for (const editor of this._notebookEditors.values()) {
      for (const [, codeEditor] of editor.codeEditors) {
        if (codeEditor === candidate) {
          return editor;
        }
      }
    }
    return void 0;
  }
  updateReplContextKey(uri) {
    this._mostRecentRepl.set(uri);
  }
};
NotebookEditorWidgetService = __decorateClass([
  __decorateParam(0, IEditorGroupsService),
  __decorateParam(1, IEditorService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IInstantiationService)
], NotebookEditorWidgetService);
export {
  NotebookEditorWidgetService
};
