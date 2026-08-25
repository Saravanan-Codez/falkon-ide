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
import * as DOM from "../../../../../../base/browser/dom.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { EditorExtensionsRegistry } from "../../../../../../editor/browser/editorExtensions.js";
import { MenuId } from "../../../../../../platform/actions/common/actions.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { NotebookInlineDiffDecorationContribution } from "./notebookInlineDiff.js";
import { NotebookEditorExtensionsRegistry } from "../../notebookEditorExtensions.js";
import { INotebookEditorService } from "../../services/notebookEditorService.js";
let NotebookInlineDiffWidget = class extends Disposable {
  constructor(rootElement, groupId, window, options, dimension, instantiationService, widgetService) {
    super();
    this.rootElement = rootElement;
    this.groupId = groupId;
    this.window = window;
    this.options = options;
    this.dimension = dimension;
    this.instantiationService = instantiationService;
    this.widgetService = widgetService;
    this.widget = { value: void 0 };
  }
  get editorWidget() {
    return this.widget.value;
  }
  async show(input, model, previousModel, options) {
    if (!this.widget.value) {
      this.createNotebookWidget(input, this.groupId, this.rootElement);
    }
    if (this.dimension) {
      this.widget.value?.layout(this.dimension, this.rootElement, this.position);
    }
    if (model) {
      await this.widget.value?.setOptions({ ...options });
      this.widget.value?.notebookOptions.previousModelToCompare.set(previousModel, void 0);
      await this.widget.value.setModel(model, options?.viewState);
    }
  }
  hide() {
    if (this.widget.value) {
      this.widget.value.notebookOptions.previousModelToCompare.set(void 0, void 0);
      this.widget.value.onWillHide();
    }
  }
  setLayout(dimension, position) {
    this.dimension = dimension;
    this.position = position;
  }
  createNotebookWidget(input, groupId, rootElement) {
    const contributions = NotebookEditorExtensionsRegistry.getSomeEditorContributions([NotebookInlineDiffDecorationContribution.ID]);
    const menuIds = {
      notebookToolbar: MenuId.NotebookToolbar,
      cellTitleToolbar: MenuId.NotebookCellTitle,
      cellDeleteToolbar: MenuId.NotebookCellDelete,
      cellInsertToolbar: MenuId.NotebookCellBetween,
      cellTopInsertToolbar: MenuId.NotebookCellListTop,
      cellExecuteToolbar: MenuId.NotebookCellExecute,
      cellExecutePrimary: void 0
    };
    const skipContributions = [
      "editor.contrib.review",
      "editor.contrib.floatingClickMenu",
      "editor.contrib.dirtydiff",
      "editor.contrib.testingOutputPeek",
      "editor.contrib.testingDecorations",
      "store.contrib.stickyScrollController",
      "editor.contrib.findController",
      "editor.contrib.emptyTextEditorHint"
    ];
    const cellEditorContributions = EditorExtensionsRegistry.getEditorContributions().filter((c) => skipContributions.indexOf(c.id) === -1);
    this.widget = this.instantiationService.invokeFunction(
      this.widgetService.retrieveWidget,
      groupId,
      input,
      { contributions, menuIds, cellEditorContributions, options: this.options },
      this.dimension,
      this.window
    );
    if (this.rootElement && this.widget.value.getDomNode()) {
      this.rootElement.setAttribute("aria-flowto", this.widget.value.getDomNode().id || "");
      DOM.setParentFlowTo(this.widget.value.getDomNode(), this.rootElement);
    }
  }
  dispose() {
    super.dispose();
    if (this.widget.value) {
      this.widget.value.dispose();
    }
  }
};
NotebookInlineDiffWidget = __decorateClass([
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, INotebookEditorService)
], NotebookInlineDiffWidget);
export {
  NotebookInlineDiffWidget
};
