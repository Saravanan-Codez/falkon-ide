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
import { ActionViewItem } from "../../../../../../base/browser/ui/actionbar/actionViewItems.js";
import { Disposable, DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { MenuWorkbenchToolBar, HiddenItemStrategy } from "../../../../../../platform/actions/browser/toolbar.js";
import { MenuId } from "../../../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../../../platform/instantiation/common/serviceCollection.js";
import { CellEditState } from "../../../../notebook/browser/notebookBrowser.js";
import { CellKind } from "../../../../notebook/common/notebookCommon.js";
let OverlayToolbarDecorator = class extends Disposable {
  constructor(notebookEditor, notebookModel, instantiationService, accessibilitySignalService) {
    super();
    this.notebookEditor = notebookEditor;
    this.notebookModel = notebookModel;
    this.instantiationService = instantiationService;
    this.accessibilitySignalService = accessibilitySignalService;
    this._timeout = void 0;
    this.overlayDisposables = this._register(new DisposableStore());
  }
  decorate(changes) {
    if (this._timeout !== void 0) {
      clearTimeout(this._timeout);
    }
    this._timeout = setTimeout(() => {
      this._timeout = void 0;
      this.createMarkdownPreviewToolbars(changes);
    }, 100);
  }
  createMarkdownPreviewToolbars(changes) {
    this.overlayDisposables.clear();
    const accessibilitySignalService = this.accessibilitySignalService;
    const editor = this.notebookEditor;
    for (const change of changes) {
      const cellViewModel = this.getCellViewModel(change);
      if (!cellViewModel || cellViewModel.cellKind !== CellKind.Markup) {
        continue;
      }
      const toolbarContainer = document.createElement("div");
      let overlayId = void 0;
      editor.changeCellOverlays((accessor) => {
        toolbarContainer.style.right = "44px";
        overlayId = accessor.addOverlay({
          cell: cellViewModel,
          domNode: toolbarContainer
        });
      });
      const removeOverlay = () => {
        editor.changeCellOverlays((accessor) => {
          if (overlayId) {
            accessor.removeOverlay(overlayId);
          }
        });
      };
      this.overlayDisposables.add({ dispose: removeOverlay });
      const toolbar = document.createElement("div");
      toolbarContainer.appendChild(toolbar);
      toolbar.className = "chat-diff-change-content-widget";
      toolbar.classList.add("hover");
      toolbar.style.position = "relative";
      toolbar.style.top = "18px";
      toolbar.style.zIndex = "10";
      toolbar.style.display = cellViewModel.getEditState() === CellEditState.Editing ? "none" : "block";
      this.overlayDisposables.add(cellViewModel.onDidChangeState((e) => {
        if (e.editStateChanged) {
          if (cellViewModel.getEditState() === CellEditState.Editing) {
            toolbar.style.display = "none";
          } else {
            toolbar.style.display = "block";
          }
        }
      }));
      const scopedInstaService = this._register(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, this.notebookEditor.scopedContextKeyService])));
      const toolbarWidget = scopedInstaService.createInstance(MenuWorkbenchToolBar, toolbar, MenuId.ChatEditingEditorHunk, {
        telemetrySource: "chatEditingNotebookHunk",
        hiddenItemStrategy: HiddenItemStrategy.NoHide,
        toolbarOptions: { primaryGroup: () => true },
        menuOptions: {
          renderShortTitle: true,
          arg: {
            async accept() {
              accessibilitySignalService.playSignal(AccessibilitySignal.editsKept, { allowManyInParallel: true });
              removeOverlay();
              toolbarWidget.dispose();
              for (const singleChange of change.diff.get().changes) {
                await change.keep(singleChange);
              }
              return true;
            },
            async reject() {
              accessibilitySignalService.playSignal(AccessibilitySignal.editsUndone, { allowManyInParallel: true });
              removeOverlay();
              toolbarWidget.dispose();
              for (const singleChange of change.diff.get().changes) {
                await change.undo(singleChange);
              }
              return true;
            }
          }
        },
        actionViewItemProvider: (action, options) => {
          if (!action.class) {
            return new class extends ActionViewItem {
              constructor() {
                super(void 0, action, { ...options, keybindingNotRenderedWithLabel: true, icon: false, label: true });
              }
            }();
          }
          return void 0;
        }
      });
      this.overlayDisposables.add(toolbarWidget);
    }
  }
  getCellViewModel(change) {
    if (change.type === "delete" || change.modifiedCellIndex === void 0) {
      return void 0;
    }
    const cell = this.notebookModel.cells[change.modifiedCellIndex];
    const cellViewModel = this.notebookEditor.getViewModel()?.viewCells.find((c) => c.handle === cell.handle);
    return cellViewModel;
  }
  dispose() {
    super.dispose();
    if (this._timeout !== void 0) {
      clearTimeout(this._timeout);
    }
  }
};
OverlayToolbarDecorator = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IAccessibilitySignalService)
], OverlayToolbarDecorator);
export {
  OverlayToolbarDecorator
};
