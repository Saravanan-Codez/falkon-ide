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
import { ActionViewItem } from "../../../../../base/browser/ui/actionbar/actionViewItems.js";
import { Action } from "../../../../../base/common/actions.js";
import { localize, localize2 } from "../../../../../nls.js";
import { Action2, MenuId, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { ExtensionIdentifier } from "../../../../../platform/extensions/common/extensions.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { NOTEBOOK_ACTIONS_CATEGORY, SELECT_KERNEL_ID } from "../controller/coreActions.js";
import { getNotebookEditorFromEditorPane } from "../notebookBrowser.js";
import { selectKernelIcon } from "../notebookIcons.js";
import { KernelPickerMRUStrategy } from "./notebookKernelQuickPickStrategy.js";
import { NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_KERNEL_COUNT } from "../../common/notebookContextKeys.js";
import { INotebookKernelHistoryService, INotebookKernelService } from "../../common/notebookKernelService.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
function getEditorFromContext(editorService, context) {
  let editor;
  if (context !== void 0 && "notebookEditorId" in context) {
    const editorId = context.notebookEditorId;
    const matchingEditor = editorService.visibleEditorPanes.find((editorPane) => {
      const notebookEditor = getNotebookEditorFromEditorPane(editorPane);
      return notebookEditor?.getId() === editorId;
    });
    editor = getNotebookEditorFromEditorPane(matchingEditor);
  } else if (context !== void 0 && "notebookEditor" in context) {
    editor = context?.notebookEditor;
  } else {
    editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
  }
  return editor;
}
function shouldSkip(selected, controllerId, extensionId, context) {
  return !!(selected && (context && "skipIfAlreadySelected" in context && context.skipIfAlreadySelected || // target kernel is already selected
  controllerId && selected.id === controllerId && ExtensionIdentifier.equals(selected.extension, extensionId)));
}
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: SELECT_KERNEL_ID,
      category: NOTEBOOK_ACTIONS_CATEGORY,
      title: localize2("notebookActions.selectKernel", "Select Notebook Kernel"),
      icon: selectKernelIcon,
      f1: true,
      precondition: NOTEBOOK_IS_ACTIVE_EDITOR,
      menu: [{
        id: MenuId.EditorTitle,
        when: ContextKeyExpr.and(
          NOTEBOOK_IS_ACTIVE_EDITOR,
          ContextKeyExpr.notEquals("config.notebook.globalToolbar", true)
        ),
        group: "navigation",
        order: -10
      }, {
        id: MenuId.NotebookToolbar,
        when: ContextKeyExpr.equals("config.notebook.globalToolbar", true),
        group: "status",
        order: -10
      }, {
        id: MenuId.InteractiveToolbar,
        when: NOTEBOOK_KERNEL_COUNT.notEqualsTo(0),
        group: "status",
        order: -10
      }],
      metadata: {
        description: localize("notebookActions.selectKernel.args", "Notebook Kernel Args"),
        args: [
          {
            name: "kernelInfo",
            description: "The kernel info",
            schema: {
              "type": "object",
              "required": ["id", "extension"],
              "properties": {
                "id": {
                  "type": "string"
                },
                "extension": {
                  "type": "string"
                },
                "notebookEditorId": {
                  "type": "string"
                }
              }
            }
          }
        ]
      }
    });
  }
  async run(accessor, context) {
    const instantiationService = accessor.get(IInstantiationService);
    const editorService = accessor.get(IEditorService);
    const editor = getEditorFromContext(editorService, context);
    if (!editor || !editor.hasModel()) {
      return false;
    }
    let controllerId = context && "id" in context ? context.id : void 0;
    let extensionId = context && "extension" in context ? context.extension : void 0;
    if (controllerId && (typeof controllerId !== "string" || typeof extensionId !== "string")) {
      controllerId = void 0;
      extensionId = void 0;
    }
    const notebook = editor.textModel;
    const notebookKernelService = accessor.get(INotebookKernelService);
    const { selected } = notebookKernelService.getMatchingKernel(notebook);
    if (shouldSkip(selected, controllerId, extensionId, context)) {
      return true;
    }
    const wantedKernelId = controllerId ? `${extensionId}/${controllerId}` : void 0;
    const strategy = instantiationService.createInstance(KernelPickerMRUStrategy);
    return strategy.showQuickPick(editor, wantedKernelId);
  }
});
let NotebooKernelActionViewItem = class extends ActionViewItem {
  constructor(actualAction, _editor, options, _notebookKernelService, _notebookKernelHistoryService) {
    const action = new Action("fakeAction", void 0, ThemeIcon.asClassName(selectKernelIcon), true, (event) => actualAction.run(event));
    super(
      void 0,
      action,
      { ...options, label: false, icon: true }
    );
    this._editor = _editor;
    this._notebookKernelService = _notebookKernelService;
    this._notebookKernelHistoryService = _notebookKernelHistoryService;
    this._register(action);
    this._register(_editor.onDidChangeModel(this._update, this));
    this._register(_notebookKernelService.onDidAddKernel(this._update, this));
    this._register(_notebookKernelService.onDidRemoveKernel(this._update, this));
    this._register(_notebookKernelService.onDidChangeNotebookAffinity(this._update, this));
    this._register(_notebookKernelService.onDidChangeSelectedNotebooks(this._update, this));
    this._register(_notebookKernelService.onDidChangeSourceActions(this._update, this));
    this._register(_notebookKernelService.onDidChangeKernelDetectionTasks(this._update, this));
  }
  render(container) {
    this._update();
    super.render(container);
    container.classList.add("kernel-action-view-item");
    this._kernelLabel = document.createElement("a");
    container.appendChild(this._kernelLabel);
    this.updateLabel();
  }
  updateLabel() {
    if (this._kernelLabel) {
      this._kernelLabel.classList.add("kernel-label");
      this._kernelLabel.innerText = this._action.label;
    }
  }
  _update() {
    const notebook = this._editor.textModel;
    if (!notebook) {
      this._resetAction();
      return;
    }
    KernelPickerMRUStrategy.updateKernelStatusAction(notebook, this._action, this._notebookKernelService, this._notebookKernelHistoryService);
    this.updateClass();
  }
  _resetAction() {
    this._action.enabled = false;
    this._action.label = "";
    this._action.class = "";
  }
};
NotebooKernelActionViewItem = __decorateClass([
  __decorateParam(3, INotebookKernelService),
  __decorateParam(4, INotebookKernelHistoryService)
], NotebooKernelActionViewItem);
export {
  NotebooKernelActionViewItem
};
