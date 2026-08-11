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
import { ToolBar } from "../../../../../../base/browser/ui/toolbar/toolbar.js";
import { Action } from "../../../../../../base/common/actions.js";
import { DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { MarshalledId } from "../../../../../../base/common/marshallingIds.js";
import { EditorContextKeys } from "../../../../../../editor/common/editorContextKeys.js";
import { localize } from "../../../../../../nls.js";
import { DropdownWithPrimaryActionViewItem } from "../../../../../../platform/actions/browser/dropdownWithPrimaryActionViewItem.js";
import { getActionBarActions } from "../../../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IMenuService, MenuItemAction } from "../../../../../../platform/actions/common/actions.js";
import { InputFocusedContext } from "../../../../../../platform/contextkey/common/contextkeys.js";
import { IContextMenuService } from "../../../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../../platform/keybinding/common/keybinding.js";
import { CellContentPart } from "../cellPart.js";
import { registerCellToolbarStickyScroll } from "./cellToolbarStickyScroll.js";
import { NOTEBOOK_CELL_EXECUTION_STATE, NOTEBOOK_CELL_LIST_FOCUSED, NOTEBOOK_CELL_TYPE, NOTEBOOK_EDITOR_FOCUSED } from "../../../common/notebookContextKeys.js";
let RunToolbar = class extends CellContentPart {
  constructor(notebookEditor, contextKeyService, cellContainer, runButtonContainer, primaryMenuId, secondaryMenuId, menuService, keybindingService, contextMenuService, instantiationService) {
    super();
    this.notebookEditor = notebookEditor;
    this.contextKeyService = contextKeyService;
    this.cellContainer = cellContainer;
    this.runButtonContainer = runButtonContainer;
    this.keybindingService = keybindingService;
    this.contextMenuService = contextMenuService;
    this.instantiationService = instantiationService;
    this.primaryMenu = this._register(menuService.createMenu(primaryMenuId, contextKeyService));
    this.secondaryMenu = this._register(menuService.createMenu(secondaryMenuId, contextKeyService));
    this.createRunCellToolbar(runButtonContainer, cellContainer, contextKeyService);
    const updateActions = () => {
      const actions = this.getCellToolbarActions(this.primaryMenu);
      const primary = actions.primary[0];
      this.toolbar.setActions(primary ? [primary] : []);
    };
    updateActions();
    this._register(this.primaryMenu.onDidChange(updateActions));
    this._register(this.secondaryMenu.onDidChange(updateActions));
    this._register(this.notebookEditor.notebookOptions.onDidChangeOptions(updateActions));
  }
  didRenderCell(element) {
    this.cellDisposables.add(registerCellToolbarStickyScroll(this.notebookEditor, element, this.runButtonContainer));
    if (this.notebookEditor.hasModel()) {
      const context = {
        ui: true,
        cell: element,
        notebookEditor: this.notebookEditor,
        $mid: MarshalledId.NotebookCellActionContext
      };
      this.toolbar.context = context;
    }
  }
  getCellToolbarActions(menu) {
    return getActionBarActions(menu.getActions({ shouldForwardArgs: true }), (g) => /^inline/.test(g));
  }
  createRunCellToolbar(container, cellContainer, contextKeyService) {
    const actionViewItemDisposables = this._register(new DisposableStore());
    const dropdownAction = this._register(new Action("notebook.moreRunActions", localize("notebook.moreRunActionsLabel", "More..."), "codicon-chevron-down", true));
    const keybindingProvider = (action) => this.keybindingService.lookupKeybinding(action.id, executionContextKeyService);
    const executionContextKeyService = this._register(getCodeCellExecutionContextKeyService(contextKeyService));
    this.toolbar = this._register(new ToolBar(container, this.contextMenuService, {
      getKeyBinding: keybindingProvider,
      actionViewItemProvider: (_action, _options) => {
        actionViewItemDisposables.clear();
        const primary = this.getCellToolbarActions(this.primaryMenu).primary[0];
        if (!(primary instanceof MenuItemAction)) {
          return void 0;
        }
        const secondary = this.getCellToolbarActions(this.secondaryMenu).secondary;
        if (!secondary.length) {
          return void 0;
        }
        const item = this.instantiationService.createInstance(
          DropdownWithPrimaryActionViewItem,
          primary,
          dropdownAction,
          secondary,
          "notebook-cell-run-toolbar",
          {
            ..._options,
            getKeyBinding: keybindingProvider
          }
        );
        actionViewItemDisposables.add(item.onDidChangeDropdownVisibility((visible) => {
          cellContainer.classList.toggle("cell-run-toolbar-dropdown-active", visible);
        }));
        return item;
      },
      renderDropdownAsChildElement: true
    }));
  }
};
RunToolbar = __decorateClass([
  __decorateParam(6, IMenuService),
  __decorateParam(7, IKeybindingService),
  __decorateParam(8, IContextMenuService),
  __decorateParam(9, IInstantiationService)
], RunToolbar);
function getCodeCellExecutionContextKeyService(contextKeyService) {
  const executionContextKeyService = contextKeyService.createScoped(document.createElement("div"));
  InputFocusedContext.bindTo(executionContextKeyService).set(true);
  EditorContextKeys.editorTextFocus.bindTo(executionContextKeyService).set(true);
  EditorContextKeys.focus.bindTo(executionContextKeyService).set(true);
  EditorContextKeys.textInputFocus.bindTo(executionContextKeyService).set(true);
  NOTEBOOK_CELL_EXECUTION_STATE.bindTo(executionContextKeyService).set("idle");
  NOTEBOOK_CELL_LIST_FOCUSED.bindTo(executionContextKeyService).set(true);
  NOTEBOOK_EDITOR_FOCUSED.bindTo(executionContextKeyService).set(true);
  NOTEBOOK_CELL_TYPE.bindTo(executionContextKeyService).set("code");
  return executionContextKeyService;
}
export {
  RunToolbar,
  getCodeCellExecutionContextKeyService
};
