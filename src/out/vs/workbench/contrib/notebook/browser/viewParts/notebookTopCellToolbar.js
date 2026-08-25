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
import * as DOM from "../../../../../base/browser/dom.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { HiddenItemStrategy, MenuWorkbenchToolBar } from "../../../../../platform/actions/browser/toolbar.js";
import { IMenuService, MenuItemAction } from "../../../../../platform/actions/common/actions.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { CodiconActionViewItem } from "../view/cellParts/cellActionView.js";
let ListTopCellToolbar = class extends Disposable {
  constructor(notebookEditor, notebookOptions, instantiationService, contextMenuService, menuService) {
    super();
    this.notebookEditor = notebookEditor;
    this.notebookOptions = notebookOptions;
    this.instantiationService = instantiationService;
    this.contextMenuService = contextMenuService;
    this.menuService = menuService;
    this.viewZone = this._register(new MutableDisposable());
    this._modelDisposables = this._register(new DisposableStore());
    this.topCellToolbarContainer = DOM.$("div");
    this.topCellToolbar = DOM.$(".cell-list-top-cell-toolbar-container");
    this.topCellToolbarContainer.appendChild(this.topCellToolbar);
    this._register(this.notebookEditor.onDidAttachViewModel(() => {
      this.updateTopToolbar();
    }));
    this._register(this.notebookOptions.onDidChangeOptions((e) => {
      if (e.insertToolbarAlignment || e.insertToolbarPosition || e.cellToolbarLocation) {
        this.updateTopToolbar();
      }
    }));
  }
  updateTopToolbar() {
    const layoutInfo = this.notebookOptions.getLayoutConfiguration();
    this.viewZone.value = new DisposableStore();
    if (layoutInfo.insertToolbarPosition === "hidden" || layoutInfo.insertToolbarPosition === "notebookToolbar") {
      const height = this.notebookOptions.computeTopInsertToolbarHeight(this.notebookEditor.textModel?.viewType);
      if (height !== 0) {
        this.notebookEditor.changeViewZones((accessor) => {
          const id = accessor.addZone({
            afterModelPosition: 0,
            heightInPx: height,
            domNode: DOM.$("div")
          });
          accessor.layoutZone(id);
          this.viewZone.value?.add({
            dispose: () => {
              if (!this.notebookEditor.isDisposed) {
                this.notebookEditor.changeViewZones((accessor2) => {
                  accessor2.removeZone(id);
                });
              }
            }
          });
        });
      }
      return;
    }
    this.notebookEditor.changeViewZones((accessor) => {
      const height = this.notebookOptions.computeTopInsertToolbarHeight(this.notebookEditor.textModel?.viewType);
      const id = accessor.addZone({
        afterModelPosition: 0,
        heightInPx: height,
        domNode: this.topCellToolbarContainer
      });
      accessor.layoutZone(id);
      this.viewZone.value?.add({
        dispose: () => {
          if (!this.notebookEditor.isDisposed) {
            this.notebookEditor.changeViewZones((accessor2) => {
              accessor2.removeZone(id);
            });
          }
        }
      });
      DOM.clearNode(this.topCellToolbar);
      const toolbar = this.instantiationService.createInstance(MenuWorkbenchToolBar, this.topCellToolbar, this.notebookEditor.creationOptions.menuIds.cellTopInsertToolbar, {
        actionViewItemProvider: (action, options) => {
          if (action instanceof MenuItemAction) {
            const item = this.instantiationService.createInstance(CodiconActionViewItem, action, { hoverDelegate: options.hoverDelegate });
            return item;
          }
          return void 0;
        },
        menuOptions: {
          shouldForwardArgs: true
        },
        toolbarOptions: {
          primaryGroup: (g) => /^inline/.test(g)
        },
        hiddenItemStrategy: HiddenItemStrategy.Ignore
      });
      if (this.notebookEditor.hasModel()) {
        toolbar.context = {
          notebookEditor: this.notebookEditor
        };
      }
      this.viewZone.value?.add(toolbar);
      this.viewZone.value?.add(this.notebookEditor.onDidChangeModel(() => {
        this._modelDisposables.clear();
        if (this.notebookEditor.hasModel()) {
          this._modelDisposables.add(this.notebookEditor.onDidChangeViewCells(() => {
            this.updateClass();
          }));
          this.updateClass();
        }
      }));
      this.updateClass();
    });
  }
  updateClass() {
    if (this.notebookEditor.hasModel() && this.notebookEditor.getLength() === 0) {
      this.topCellToolbar.classList.add("emptyNotebook");
    } else {
      this.topCellToolbar.classList.remove("emptyNotebook");
    }
  }
};
ListTopCellToolbar = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, IMenuService)
], ListTopCellToolbar);
export {
  ListTopCellToolbar
};
