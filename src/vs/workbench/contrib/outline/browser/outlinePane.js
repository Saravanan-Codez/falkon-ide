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
import "./outlinePane.css";
import * as dom from "../../../../base/browser/dom.js";
import { ProgressBar } from "../../../../base/browser/ui/progressbar/progressbar.js";
import { TimeoutTimer, timeout } from "../../../../base/common/async.js";
import { toDisposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { LRUCache } from "../../../../base/common/map.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { WorkbenchDataTree } from "../../../../platform/list/browser/listService.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ViewPane } from "../../../browser/parts/views/viewPane.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { basename } from "../../../../base/common/resources.js";
import { IViewDescriptorService } from "../../../common/views.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { OutlineViewState } from "./outlineViewState.js";
import { IOutlineService, OutlineTarget } from "../../../services/outline/browser/outline.js";
import { EditorResourceAccessor } from "../../../common/editor.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Event } from "../../../../base/common/event.js";
import { AbstractTreeViewState, TreeFindMode } from "../../../../base/browser/ui/tree/abstractTree.js";
import { ctxAllCollapsed, ctxFilterOnType, ctxFocused, ctxFollowsCursor, ctxSortMode, OutlineSortOrder } from "./outline.js";
import { defaultProgressBarStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
class OutlineTreeSorter {
  constructor(_comparator, order) {
    this._comparator = _comparator;
    this.order = order;
  }
  compare(a, b) {
    if (this.order === OutlineSortOrder.ByKind) {
      return this._comparator.compareByType(a, b);
    } else if (this.order === OutlineSortOrder.ByName) {
      return this._comparator.compareByName(a, b);
    } else {
      return this._comparator.compareByPosition(a, b);
    }
  }
}
let OutlinePane = class extends ViewPane {
  constructor(options, _outlineService, _instantiationService, viewDescriptorService, _storageService, _editorService, configurationService, keybindingService, contextKeyService, contextMenuService, openerService, themeService, hoverService) {
    super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, _instantiationService, openerService, themeService, hoverService);
    this._outlineService = _outlineService;
    this._instantiationService = _instantiationService;
    this._storageService = _storageService;
    this._editorService = _editorService;
    this._disposables = new DisposableStore();
    this._editorControlDisposables = new DisposableStore();
    this._editorPaneDisposables = new DisposableStore();
    this._outlineViewState = new OutlineViewState();
    this._editorListener = new MutableDisposable();
    this._treeStates = new LRUCache(10);
    this._editorControlChangePromise = Promise.resolve();
    this._outlineViewState.restore(this._storageService);
    this._disposables.add(this._outlineViewState);
    contextKeyService.bufferChangeEvents(() => {
      this._ctxFollowsCursor = ctxFollowsCursor.bindTo(contextKeyService);
      this._ctxFilterOnType = ctxFilterOnType.bindTo(contextKeyService);
      this._ctxSortMode = ctxSortMode.bindTo(contextKeyService);
      this._ctxAllCollapsed = ctxAllCollapsed.bindTo(contextKeyService);
    });
    const updateContext = () => {
      this._ctxFollowsCursor.set(this._outlineViewState.followCursor);
      this._ctxFilterOnType.set(this._outlineViewState.filterOnType);
      this._ctxSortMode.set(this._outlineViewState.sortBy);
    };
    updateContext();
    this._disposables.add(this._outlineViewState.onDidChange(updateContext));
  }
  static {
    this.Id = "outline";
  }
  dispose() {
    this._disposables.dispose();
    this._editorPaneDisposables.dispose();
    this._editorControlDisposables.dispose();
    this._editorListener.dispose();
    super.dispose();
  }
  focus() {
    this._editorControlChangePromise.then(() => {
      super.focus();
      this._tree?.domFocus();
    });
  }
  renderBody(container) {
    super.renderBody(container);
    this._domNode = container;
    container.classList.add("outline-pane");
    const progressContainer = dom.$(".outline-progress");
    this._message = dom.$(".outline-message");
    this._progressBar = new ProgressBar(progressContainer, defaultProgressBarStyles);
    this._treeContainer = dom.$(".outline-tree");
    dom.append(container, progressContainer, this._message, this._treeContainer);
    this._disposables.add(this.onDidChangeBodyVisibility((visible) => {
      if (!visible) {
        this._editorListener.clear();
        this._editorPaneDisposables.clear();
        this._editorControlDisposables.clear();
      } else if (!this._editorListener.value) {
        const event = Event.any(this._editorService.onDidActiveEditorChange, this._outlineService.onDidChange);
        this._editorListener.value = event(() => this._handleEditorChanged(this._editorService.activeEditorPane));
        this._handleEditorChanged(this._editorService.activeEditorPane);
      }
    }));
  }
  layoutBody(height, width) {
    super.layoutBody(height, width);
    this._tree?.layout(height, width);
    this._treeDimensions = new dom.Dimension(width, height);
  }
  collapseAll() {
    this._tree?.collapseAll();
  }
  expandAll() {
    this._tree?.expandAll();
  }
  get outlineViewState() {
    return this._outlineViewState;
  }
  _showMessage(message) {
    this._domNode.classList.add("message");
    this._progressBar.stop().hide();
    this._message.textContent = message;
  }
  _captureViewState(uri) {
    if (this._tree) {
      const oldOutline = this._tree.getInput();
      if (!uri) {
        uri = oldOutline?.uri;
      }
      if (oldOutline && uri) {
        this._treeStates.set(`${oldOutline.outlineKind}/${uri}`, this._tree.getViewState());
        return true;
      }
    }
    return false;
  }
  _handleEditorChanged(pane) {
    this._editorPaneDisposables.clear();
    if (pane) {
      this._editorPaneDisposables.add(pane.onDidChangeControl(() => {
        this._editorControlChangePromise = this._handleEditorControlChanged(pane);
      }));
    }
    this._editorControlChangePromise = this._handleEditorControlChanged(pane);
  }
  async _handleEditorControlChanged(pane) {
    const resource = EditorResourceAccessor.getOriginalUri(pane?.input);
    const didCapture = this._captureViewState();
    this._editorControlDisposables.clear();
    if (!pane || !this._outlineService.canCreateOutline(pane) || !resource) {
      return this._showMessage(localize("no-editor", "The active editor cannot provide outline information."));
    }
    let loadingMessage;
    if (!didCapture) {
      loadingMessage = new TimeoutTimer(() => {
        this._showMessage(localize("loading", "Loading document symbols for '{0}'...", basename(resource)));
      }, 100);
    }
    this._progressBar.infinite().show(500);
    const cts = new CancellationTokenSource();
    this._editorControlDisposables.add(toDisposable(() => cts.dispose(true)));
    const newOutline = await this._outlineService.createOutline(pane, OutlineTarget.OutlinePane, cts.token);
    loadingMessage?.dispose();
    if (!newOutline) {
      return;
    }
    if (cts.token.isCancellationRequested) {
      newOutline?.dispose();
      return;
    }
    this._editorControlDisposables.add(newOutline);
    this._progressBar.stop().hide();
    const sorter = new OutlineTreeSorter(newOutline.config.comparator, this._outlineViewState.sortBy);
    const tree = this._instantiationService.createInstance(
      WorkbenchDataTree,
      "OutlinePane",
      this._treeContainer,
      newOutline.config.delegate,
      newOutline.config.renderers,
      newOutline.config.treeDataSource,
      {
        ...newOutline.config.options,
        sorter,
        expandOnDoubleClick: false,
        expandOnlyOnTwistieClick: true,
        multipleSelectionSupport: false,
        hideTwistiesOfChildlessElements: true,
        defaultFindMode: this._outlineViewState.filterOnType ? TreeFindMode.Filter : TreeFindMode.Highlight,
        overrideStyles: this.getLocationBasedColors().listOverrideStyles
      }
    );
    ctxFocused.bindTo(tree.contextKeyService);
    const updateTree = () => {
      if (newOutline.isEmpty) {
        this._showMessage(localize("no-symbols", "No symbols found in document '{0}'", basename(resource)));
        this._captureViewState(resource);
        tree.setInput(void 0);
      } else if (!tree.getInput()) {
        this._domNode.classList.remove("message");
        const state = this._treeStates.get(`${newOutline.outlineKind}/${newOutline.uri}`);
        tree.setInput(newOutline, state && AbstractTreeViewState.lift(state));
      } else {
        this._domNode.classList.remove("message");
        tree.updateChildren();
      }
    };
    updateTree();
    this._editorControlDisposables.add(newOutline.onDidChange(updateTree));
    this._editorControlDisposables.add(this.viewDescriptorService.onDidChangeLocation(({ views }) => {
      if (views.some((v) => v.id === this.id)) {
        tree.updateOptions({ overrideStyles: this.getLocationBasedColors().listOverrideStyles });
      }
    }));
    this._editorControlDisposables.add(tree.onDidChangeFindMode((mode) => this._outlineViewState.filterOnType = mode === TreeFindMode.Filter));
    let idPool = 0;
    this._editorControlDisposables.add(tree.onDidOpen(async (e) => {
      const myId = ++idPool;
      const isDoubleClick = e.browserEvent?.type === "dblclick";
      if (!isDoubleClick) {
        await timeout(150);
        if (myId !== idPool) {
          return;
        }
      }
      await newOutline.reveal(e.element, e.editorOptions, e.sideBySide, isDoubleClick);
    }));
    const revealActiveElement = () => {
      if (!this._outlineViewState.followCursor || !newOutline.activeElement) {
        return;
      }
      let item = newOutline.activeElement;
      while (item) {
        const top = tree.getRelativeTop(item);
        if (top === null) {
          tree.reveal(item, 0.5);
        }
        if (tree.getRelativeTop(item) !== null) {
          tree.setFocus([item]);
          tree.setSelection([item]);
          break;
        }
        item = tree.getParentElement(item);
      }
    };
    revealActiveElement();
    this._editorControlDisposables.add(newOutline.onDidChange(revealActiveElement));
    this._editorControlDisposables.add(this._outlineViewState.onDidChange((e) => {
      this._outlineViewState.persist(this._storageService);
      if (e.filterOnType) {
        tree.findMode = this._outlineViewState.filterOnType ? TreeFindMode.Filter : TreeFindMode.Highlight;
      }
      if (e.followCursor) {
        revealActiveElement();
      }
      if (e.sortBy) {
        sorter.order = this._outlineViewState.sortBy;
        tree.resort();
      }
    }));
    let viewState;
    this._editorControlDisposables.add(tree.onDidChangeFindPattern((pattern) => {
      if (tree.findMode === TreeFindMode.Highlight) {
        return;
      }
      if (!viewState && pattern) {
        viewState = tree.getViewState();
        tree.expandAll();
      } else if (!pattern && viewState) {
        tree.setInput(tree.getInput(), viewState);
        viewState = void 0;
      }
    }));
    const updateAllCollapsedCtx = () => {
      this._ctxAllCollapsed.set(tree.getNode(null).children.every((node) => !node.collapsible || node.collapsed));
    };
    this._editorControlDisposables.add(tree.onDidChangeCollapseState(updateAllCollapsedCtx));
    this._editorControlDisposables.add(tree.onDidChangeModel(updateAllCollapsedCtx));
    updateAllCollapsedCtx();
    tree.layout(this._treeDimensions?.height, this._treeDimensions?.width);
    this._tree = tree;
    this._editorControlDisposables.add(toDisposable(() => {
      tree.dispose();
      this._tree = void 0;
    }));
  }
};
OutlinePane = __decorateClass([
  __decorateParam(1, IOutlineService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IViewDescriptorService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, IEditorService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IKeybindingService),
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, IContextMenuService),
  __decorateParam(10, IOpenerService),
  __decorateParam(11, IThemeService),
  __decorateParam(12, IHoverService)
], OutlinePane);
export {
  OutlinePane
};
