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
import * as nls from "../../../../../nls.js";
import * as perf from "../../../../../base/common/performance.js";
import { memoize } from "../../../../../base/common/decorators.js";
import { ExplorerFolderContext, FilesExplorerFocusedContext, ExplorerFocusedContext, ExplorerRootContext, ExplorerResourceReadonlyContext, ExplorerResourceCut, ExplorerResourceMoveableToTrash, ExplorerCompressedFocusContext, ExplorerCompressedFirstFocusContext, ExplorerCompressedLastFocusContext, ExplorerResourceAvailableEditorIdsContext, VIEW_ID, ExplorerResourceWritableContext, ViewHasSomeCollapsibleRootItemContext, FoldersViewVisibleContext, ExplorerResourceParentReadOnlyContext, ExplorerFindProviderActive } from "../../common/files.js";
import { FileCopiedContext, NEW_FILE_COMMAND_ID, NEW_FOLDER_COMMAND_ID } from "../fileActions.js";
import * as DOM from "../../../../../base/browser/dom.js";
import { IWorkbenchLayoutService } from "../../../../services/layout/browser/layoutService.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../../platform/workspace/common/workspace.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IProgressService, ProgressLocation } from "../../../../../platform/progress/common/progress.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { IContextKeyService, ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { ResourceContextKey } from "../../../../common/contextkeys.js";
import { WorkbenchCompressibleAsyncDataTree } from "../../../../../platform/list/browser/listService.js";
import { DelayedDragHandler } from "../../../../../base/browser/dnd.js";
import { IEditorService, SIDE_GROUP, ACTIVE_GROUP } from "../../../../services/editor/common/editorService.js";
import { ViewPane } from "../../../../browser/parts/views/viewPane.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { ExplorerDelegate, ExplorerDataSource, FilesRenderer, FilesFilter, FileSorter, FileDragAndDrop, ExplorerCompressionDelegate, isCompressedFolderName, ExplorerFindProvider } from "./explorerViewer.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { TreeVisibility } from "../../../../../base/browser/ui/tree/tree.js";
import { MenuId, Action2, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { ExplorerItem, NewExplorerItem } from "../../common/explorerModel.js";
import { ResourceLabels } from "../../../../browser/labels.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { IClipboardService } from "../../../../../platform/clipboard/common/clipboardService.js";
import { IFileService, FileSystemProviderCapabilities } from "../../../../../platform/files/common/files.js";
import { Event } from "../../../../../base/common/event.js";
import { IViewDescriptorService } from "../../../../common/views.js";
import { IViewsService } from "../../../../services/views/common/viewsService.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { IUriIdentityService } from "../../../../../platform/uriIdentity/common/uriIdentity.js";
import { EditorResourceAccessor, SideBySideEditor } from "../../../../common/editor.js";
import { IExplorerService } from "../files.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IEditorResolverService } from "../../../../services/editor/common/editorResolverService.js";
import { EditorOpenSource } from "../../../../../platform/editor/common/editor.js";
import { ResourceMap } from "../../../../../base/common/map.js";
import { AbstractTreePart } from "../../../../../base/browser/ui/tree/abstractTree.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { IAccessibilityService } from "../../../../../platform/accessibility/common/accessibility.js";
function hasExpandedRootChild(tree, treeInput) {
  for (const folder of treeInput) {
    if (tree.hasNode(folder) && !tree.isCollapsed(folder)) {
      for (const [, child] of folder.children.entries()) {
        if (tree.hasNode(child) && tree.isCollapsible(child) && !tree.isCollapsed(child)) {
          return true;
        }
      }
    }
  }
  return false;
}
function hasExpandedNode(tree, treeInput) {
  for (const folder of treeInput) {
    if (tree.hasNode(folder) && !tree.isCollapsed(folder)) {
      return true;
    }
  }
  return false;
}
const identityProvider = {
  getId: (stat) => {
    if (stat instanceof NewExplorerItem) {
      return `new:${stat.getId()}`;
    }
    return stat.getId();
  }
};
function getContext(focus, selection, respectMultiSelection, compressedNavigationControllerProvider) {
  let focusedStat;
  focusedStat = focus.length ? focus[0] : void 0;
  if (respectMultiSelection && selection.length > 1) {
    focusedStat = void 0;
  }
  const compressedNavigationControllers = focusedStat && compressedNavigationControllerProvider.getCompressedNavigationController(focusedStat);
  const compressedNavigationController = compressedNavigationControllers?.length ? compressedNavigationControllers[0] : void 0;
  focusedStat = compressedNavigationController ? compressedNavigationController.current : focusedStat;
  const selectedStats = [];
  for (const stat of selection) {
    const controllers = compressedNavigationControllerProvider.getCompressedNavigationController(stat);
    const controller = controllers?.at(0);
    if (controller && focusedStat && controller === compressedNavigationController) {
      if (stat === focusedStat) {
        selectedStats.push(stat);
      }
      continue;
    }
    if (controller) {
      selectedStats.push(...controller.items);
    } else {
      selectedStats.push(stat);
    }
  }
  if (!focusedStat) {
    if (respectMultiSelection) {
      return selectedStats;
    } else {
      return [];
    }
  }
  if (respectMultiSelection && selectedStats.indexOf(focusedStat) >= 0) {
    return selectedStats;
  }
  return [focusedStat];
}
let ExplorerView = class extends ViewPane {
  constructor(options, contextMenuService, viewDescriptorService, instantiationService, contextService, progressService, editorService, editorResolverService, layoutService, keybindingService, contextKeyService, configurationService, labelService, themeService, telemetryService, hoverService, explorerService, storageService, clipboardService, fileService, uriIdentityService, commandService, openerService, accessibilityService) {
    super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.contextService = contextService;
    this.progressService = progressService;
    this.editorService = editorService;
    this.editorResolverService = editorResolverService;
    this.layoutService = layoutService;
    this.labelService = labelService;
    this.telemetryService = telemetryService;
    this.explorerService = explorerService;
    this.storageService = storageService;
    this.clipboardService = clipboardService;
    this.fileService = fileService;
    this.uriIdentityService = uriIdentityService;
    this.commandService = commandService;
    this.accessibilityService = accessibilityService;
    this._autoReveal = false;
    this.delegate = options.delegate;
    this.resourceContext = instantiationService.createInstance(ResourceContextKey);
    this._register(this.resourceContext);
    this.parentReadonlyContext = ExplorerResourceParentReadOnlyContext.bindTo(contextKeyService);
    this.folderContext = ExplorerFolderContext.bindTo(contextKeyService);
    this.readonlyContext = ExplorerResourceReadonlyContext.bindTo(contextKeyService);
    this.availableEditorIdsContext = ExplorerResourceAvailableEditorIdsContext.bindTo(contextKeyService);
    this.rootContext = ExplorerRootContext.bindTo(contextKeyService);
    this.resourceMoveableToTrash = ExplorerResourceMoveableToTrash.bindTo(contextKeyService);
    this.compressedFocusContext = ExplorerCompressedFocusContext.bindTo(contextKeyService);
    this.compressedFocusFirstContext = ExplorerCompressedFirstFocusContext.bindTo(contextKeyService);
    this.compressedFocusLastContext = ExplorerCompressedLastFocusContext.bindTo(contextKeyService);
    this.viewHasSomeCollapsibleRootItem = ViewHasSomeCollapsibleRootItemContext.bindTo(contextKeyService);
    this.viewVisibleContextKey = FoldersViewVisibleContext.bindTo(contextKeyService);
    this.explorerService.registerView(this);
  }
  static {
    this.TREE_VIEW_STATE_STORAGE_KEY = "workbench.explorer.treeViewState";
  }
  get singleViewPaneContainerTitle() {
    return this.name;
  }
  get autoReveal() {
    return this._autoReveal;
  }
  set autoReveal(autoReveal) {
    this._autoReveal = autoReveal;
  }
  get name() {
    return this.labelService.getWorkspaceLabel(this.contextService.getWorkspace());
  }
  get title() {
    return this.name;
  }
  set title(_) {
  }
  setVisible(visible) {
    this.viewVisibleContextKey.set(visible);
    super.setVisible(visible);
  }
  get fileCopiedContextKey() {
    return FileCopiedContext.bindTo(this.contextKeyService);
  }
  get resourceCutContextKey() {
    return ExplorerResourceCut.bindTo(this.contextKeyService);
  }
  // Split view methods
  renderHeader(container) {
    super.renderHeader(container);
    this.dragHandler = new DelayedDragHandler(container, () => this.setExpanded(true));
    const titleElement = container.querySelector(".title");
    const setHeader = () => {
      titleElement.textContent = this.name;
      this.updateTitle(this.name);
      this.ariaHeaderLabel = nls.localize("explorerSection", "Explorer Section: {0}", this.name);
      titleElement.setAttribute("aria-label", this.ariaHeaderLabel);
    };
    this._register(this.contextService.onDidChangeWorkspaceName(setHeader));
    this._register(this.labelService.onDidChangeFormatters(setHeader));
    setHeader();
  }
  layoutBody(height, width) {
    super.layoutBody(height, width);
    this.tree.layout(height, width);
  }
  renderBody(container) {
    super.renderBody(container);
    this.container = container;
    this.treeContainer = DOM.append(container, DOM.$(".explorer-folders-view"));
    this.createTree(this.treeContainer);
    this._register(this.labelService.onDidChangeFormatters(() => {
      this._onDidChangeTitleArea.fire();
    }));
    this.onConfigurationUpdated(void 0);
    this._register(this.editorService.onDidActiveEditorChange(() => {
      this.selectActiveFile();
    }));
    this._register(this.configurationService.onDidChangeConfiguration((e) => this.onConfigurationUpdated(e)));
    this._register(this.onDidChangeBodyVisibility(async (visible) => {
      if (visible) {
        await this.setTreeInput();
        this.updateAnyCollapsedContext();
        this.selectActiveFile(true);
      }
    }));
    this._register(DOM.addDisposableListener(DOM.getWindow(this.container), DOM.EventType.PASTE, async (event) => {
      if (!this.hasFocus() || this.readonlyContext.get()) {
        return;
      }
      if (event.clipboardData?.files?.length) {
        await this.commandService.executeCommand("filesExplorer.paste", event.clipboardData?.files);
      }
    }));
  }
  focus() {
    super.focus();
    this.tree.domFocus();
    if (this.tree.getFocusedPart() === AbstractTreePart.Tree) {
      const focused = this.tree.getFocus();
      if (focused.length === 1 && this._autoReveal) {
        this.tree.reveal(focused[0], 0.5);
      }
    }
  }
  hasFocus() {
    return DOM.isAncestorOfActiveElement(this.container);
  }
  getFocus() {
    return this.tree.getFocus();
  }
  focusNext() {
    this.tree.focusNext();
  }
  focusLast() {
    this.tree.focusLast();
  }
  getContext(respectMultiSelection) {
    const focusedItems = this.tree.getFocusedPart() === AbstractTreePart.StickyScroll ? this.tree.getStickyScrollFocus() : this.tree.getFocus();
    return getContext(focusedItems, this.tree.getSelection(), respectMultiSelection, this.renderer);
  }
  isItemVisible(item) {
    if (!this.filter) {
      return false;
    }
    return this.filter.filter(item, TreeVisibility.Visible);
  }
  isItemCollapsed(item) {
    return this.tree.isCollapsed(item);
  }
  async setEditable(stat, isEditing) {
    if (isEditing) {
      this.horizontalScrolling = this.tree.options.horizontalScrolling;
      if (this.horizontalScrolling) {
        this.tree.updateOptions({ horizontalScrolling: false });
      }
      await this.tree.expand(stat.parent);
    } else {
      if (this.horizontalScrolling !== void 0) {
        this.tree.updateOptions({ horizontalScrolling: this.horizontalScrolling });
      }
      this.horizontalScrolling = void 0;
      this.treeContainer.classList.remove("highlight");
    }
    await this.refresh(false, stat.parent, false);
    if (isEditing) {
      this.treeContainer.classList.add("highlight");
      this.tree.reveal(stat);
    } else {
      this.tree.domFocus();
    }
  }
  async selectActiveFile(reveal = this._autoReveal) {
    if (this._autoReveal) {
      const activeFile = EditorResourceAccessor.getCanonicalUri(this.editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
      if (activeFile) {
        const focus = this.tree.getFocus();
        const selection = this.tree.getSelection();
        if (focus.length === 1 && this.uriIdentityService.extUri.isEqual(focus[0].resource, activeFile) && selection.length === 1 && this.uriIdentityService.extUri.isEqual(selection[0].resource, activeFile)) {
          return;
        }
        return this.explorerService.select(activeFile, reveal);
      }
    }
  }
  createTree(container) {
    this.filter = this.instantiationService.createInstance(FilesFilter);
    this._register(this.filter);
    this._register(this.filter.onDidChange(() => this.refresh(true)));
    const explorerLabels = this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this.onDidChangeBodyVisibility });
    this._register(explorerLabels);
    this.findProvider = this.instantiationService.createInstance(ExplorerFindProvider, this.filter, () => this.tree);
    const updateWidth = (stat) => this.tree.updateWidth(stat);
    this.renderer = this.instantiationService.createInstance(FilesRenderer, container, explorerLabels, this.findProvider.highlightTree, updateWidth);
    this._register(this.renderer);
    this._register(createFileIconThemableTreeContainerScope(container, this.themeService));
    const isCompressionEnabled = () => {
      const configValue = this.configurationService.getValue("explorer.compactFolders");
      if (this.accessibilityService.isScreenReaderOptimized()) {
        return false;
      }
      return configValue;
    };
    const getFileNestingSettings = (item) => this.configurationService.getValue({ resource: item?.root.resource }).explorer.fileNesting;
    this.tree = this.instantiationService.createInstance(
      WorkbenchCompressibleAsyncDataTree,
      "FileExplorer",
      container,
      new ExplorerDelegate(),
      new ExplorerCompressionDelegate(),
      [this.renderer],
      this.instantiationService.createInstance(ExplorerDataSource, this.filter, this.findProvider),
      {
        compressionEnabled: isCompressionEnabled(),
        accessibilityProvider: this.renderer,
        identityProvider,
        keyboardNavigationLabelProvider: {
          getKeyboardNavigationLabel: (stat) => {
            if (this.explorerService.isEditable(stat)) {
              return void 0;
            }
            return stat.name;
          },
          getCompressedNodeKeyboardNavigationLabel: (stats) => {
            if (stats.some((stat) => this.explorerService.isEditable(stat))) {
              return void 0;
            }
            return stats.map((stat) => stat.name).join("/");
          }
        },
        multipleSelectionSupport: true,
        filter: this.filter,
        sorter: this.instantiationService.createInstance(FileSorter),
        dnd: this.instantiationService.createInstance(FileDragAndDrop, (item) => this.isItemCollapsed(item)),
        collapseByDefault: (e) => {
          if (e instanceof ExplorerItem) {
            if (e.hasNests && getFileNestingSettings(e).expand) {
              return false;
            }
            if (this.findProvider.isShowingFilterResults()) {
              return false;
            }
          }
          return true;
        },
        autoExpandSingleChildren: true,
        expandOnlyOnTwistieClick: (e) => {
          if (e instanceof ExplorerItem) {
            if (e.hasNests) {
              return true;
            } else if (this.configurationService.getValue("workbench.tree.expandMode") === "doubleClick") {
              return true;
            }
          }
          return false;
        },
        paddingBottom: ExplorerDelegate.ITEM_HEIGHT,
        overrideStyles: this.getLocationBasedColors().listOverrideStyles,
        findProvider: this.findProvider
      }
    );
    this._register(this.tree);
    this._register(this.themeService.onDidColorThemeChange(() => this.tree.rerender()));
    const onDidChangeCompressionConfiguration = Event.filter(this.configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration("explorer.compactFolders"));
    this._register(onDidChangeCompressionConfiguration((_) => this.tree.updateOptions({ compressionEnabled: isCompressionEnabled() })));
    this._register(this.accessibilityService.onDidChangeScreenReaderOptimized(() => {
      this.tree.updateOptions({ compressionEnabled: isCompressionEnabled() });
    }));
    FilesExplorerFocusedContext.bindTo(this.tree.contextKeyService);
    ExplorerFocusedContext.bindTo(this.tree.contextKeyService);
    this._register(this.tree.onDidChangeFocus((e) => this.onFocusChanged(e.elements)));
    this.onFocusChanged([]);
    this._register(this.tree.onDidOpen(async (e) => {
      const element = e.element;
      if (!element) {
        return;
      }
      const shiftDown = DOM.isKeyboardEvent(e.browserEvent) && e.browserEvent.shiftKey;
      if (!shiftDown) {
        if (element.isDirectory || this.explorerService.isEditable(void 0)) {
          return;
        }
        this.telemetryService.publicLog2("workbenchActionExecuted", { id: "workbench.files.openFile", from: "explorer" });
        try {
          this.delegate?.willOpenElement(e.browserEvent);
          await this.editorService.openEditor({ resource: element.resource, options: { preserveFocus: e.editorOptions.preserveFocus, pinned: e.editorOptions.pinned, source: EditorOpenSource.USER } }, e.sideBySide ? SIDE_GROUP : ACTIVE_GROUP);
        } finally {
          this.delegate?.didOpenElement();
        }
      }
    }));
    this._register(this.tree.onContextMenu((e) => this.onContextMenu(e)));
    this._register(this.tree.onDidScroll(async (e) => {
      const editable = this.explorerService.getEditable();
      if (e.scrollTopChanged && editable && this.tryGetRelativeTop(editable.stat) === null) {
        await editable.data.onFinish("", false);
      }
    }));
    this._register(this.tree.onDidChangeCollapseState((e) => {
      const element = e.node.element?.element;
      if (element) {
        const navigationControllers = this.renderer.getCompressedNavigationController(Array.isArray(element) ? element[0] : element);
        navigationControllers?.forEach((controller) => controller.updateCollapsed(e.node.collapsed));
      }
      this.updateAnyCollapsedContext();
    }));
    this.updateAnyCollapsedContext();
    this._register(this.tree.onMouseDblClick((e) => {
      const scrollingByPage = this.configurationService.getValue("workbench.list.scrollByPage");
      if (e.element === null && !scrollingByPage) {
        this.commandService.executeCommand(NEW_FILE_COMMAND_ID);
      }
    }));
    this._register(this.storageService.onWillSaveState(() => {
      this.storeTreeViewState();
    }));
  }
  // React on events
  onConfigurationUpdated(event) {
    if (!event || event.affectsConfiguration("explorer.autoReveal")) {
      const configuration = this.configurationService.getValue();
      this._autoReveal = configuration?.explorer?.autoReveal;
    }
    if (event && (event.affectsConfiguration("explorer.decorations.colors") || event.affectsConfiguration("explorer.decorations.badges"))) {
      this.refresh(true);
    }
  }
  storeTreeViewState() {
    this.storageService.store(ExplorerView.TREE_VIEW_STATE_STORAGE_KEY, JSON.stringify(this.tree.getViewState()), StorageScope.WORKSPACE, StorageTarget.MACHINE);
  }
  setContextKeys(stat) {
    const folders = this.contextService.getWorkspace().folders;
    const resource = stat ? stat.resource : folders[folders.length - 1].uri;
    stat = stat || this.explorerService.findClosest(resource);
    this.resourceContext.set(resource);
    this.folderContext.set(!!stat && stat.isDirectory);
    this.readonlyContext.set(!!stat && !!stat.isReadonly);
    this.parentReadonlyContext.set(Boolean(stat?.parent?.isReadonly));
    this.rootContext.set(!!stat && stat.isRoot);
    if (resource) {
      const overrides = resource ? this.editorResolverService.getEditors(resource).map((editor) => editor.id) : [];
      this.availableEditorIdsContext.set(overrides.join(","));
    } else {
      this.availableEditorIdsContext.reset();
    }
  }
  async onContextMenu(e) {
    if (DOM.isEditableElement(e.browserEvent.target)) {
      return;
    }
    const stat = e.element;
    let anchor = e.anchor;
    if (DOM.isHTMLElement(anchor)) {
      if (stat) {
        const controllers = this.renderer.getCompressedNavigationController(stat);
        if (controllers && controllers.length > 0) {
          if (DOM.isKeyboardEvent(e.browserEvent) || isCompressedFolderName(e.browserEvent.target)) {
            anchor = controllers[0].labels[controllers[0].index];
          } else {
            controllers.forEach((controller) => controller.last());
          }
        }
      }
    }
    this.fileCopiedContextKey.set(await this.clipboardService.hasResources());
    this.setContextKeys(stat);
    const selection = this.tree.getSelection();
    const roots = this.explorerService.roots;
    let arg;
    if (stat instanceof ExplorerItem) {
      const compressedControllers = this.renderer.getCompressedNavigationController(stat);
      arg = compressedControllers?.length ? compressedControllers[0].current.resource : stat.resource;
    } else {
      arg = roots.length === 1 ? roots[0].resource : {};
    }
    this.contextMenuService.showContextMenu({
      menuId: MenuId.ExplorerContext,
      menuActionOptions: { arg, shouldForwardArgs: true },
      contextKeyService: this.tree.contextKeyService,
      getAnchor: () => anchor,
      onHide: (wasCancelled) => {
        if (wasCancelled) {
          this.tree.domFocus();
        }
      },
      getActionsContext: () => stat && selection && selection.indexOf(stat) >= 0 ? selection.map((fs) => fs.resource) : stat instanceof ExplorerItem ? [stat.resource] : []
    });
  }
  onFocusChanged(elements) {
    const stat = elements.at(0);
    this.setContextKeys(stat);
    if (stat) {
      const enableTrash = Boolean(this.configurationService.getValue().files?.enableTrash);
      const hasCapability = this.fileService.hasCapability(stat.resource, FileSystemProviderCapabilities.Trash);
      this.resourceMoveableToTrash.set(enableTrash && hasCapability);
    } else {
      this.resourceMoveableToTrash.reset();
    }
    const compressedNavigationControllers = stat && this.renderer.getCompressedNavigationController(stat);
    if (!compressedNavigationControllers) {
      this.compressedFocusContext.set(false);
      return;
    }
    this.compressedFocusContext.set(true);
    compressedNavigationControllers.forEach((controller) => {
      this.updateCompressedNavigationContextKeys(controller);
    });
  }
  // General methods
  /**
   * Safely queries the file explorer tree for the relative top of an element.
   *
   * `hasNode()` and `getRelativeTop()` consult different internal maps in the
   * compressible async data tree. During an async refresh (e.g. when the
   * underlying file system provider changes, or file nesting settings update)
   * there is a microtask gap where one map has been updated but the other has
   * not. In that window `getRelativeTop()` can throw
   * `TreeError [FileExplorer] Tree element not found` (issue #188365) even
   * though the caller reasonably believed the element was still present.
   *
   * Treat such a failure as "not currently visible" so that callers fall back
   * to their not-visible branch (e.g. finishing editable state, or calling
   * `reveal()`), which is safe when the element is still in the data source
   * even if the view has not caught up yet.
   */
  tryGetRelativeTop(element) {
    if (!this.tree) {
      return null;
    }
    try {
      return this.tree.getRelativeTop(element);
    } catch {
      return null;
    }
  }
  /**
   * Refresh the contents of the explorer to get up to date data from the disk about the file structure.
   * If the item is passed we refresh only that level of the tree, otherwise we do a full refresh.
   */
  refresh(recursive, item, cancelEditing = true) {
    if (!this.tree || !this.isBodyVisible() || item && !this.tree.hasNode(item) || this.findProvider?.isShowingFilterResults() && recursive) {
      return Promise.resolve(void 0);
    }
    if (cancelEditing && this.explorerService.isEditable(void 0)) {
      this.tree.domFocus();
    }
    const toRefresh = item || this.tree.getInput();
    return this.tree.updateChildren(toRefresh, recursive, !!item);
  }
  getOptimalWidth() {
    const parentNode = this.tree.getHTMLElement();
    const childNodes = [].slice.call(parentNode.querySelectorAll(".explorer-item .label-name"));
    return DOM.getLargestChildWidth(parentNode, childNodes);
  }
  async setTreeInput() {
    if (!this.isBodyVisible()) {
      return Promise.resolve(void 0);
    }
    if (this.setTreeInputPromise) {
      await this.setTreeInputPromise;
    }
    const initialInputSetup = !this.tree.getInput();
    if (initialInputSetup) {
      perf.mark("code/willResolveExplorer");
    }
    const roots = this.explorerService.roots;
    let input = roots[0];
    if (this.contextService.getWorkbenchState() !== WorkbenchState.FOLDER || roots[0].error) {
      input = roots;
    }
    let viewState;
    if (this.tree?.getInput()) {
      viewState = this.tree.getViewState();
    } else {
      const rawViewState = this.storageService.get(ExplorerView.TREE_VIEW_STATE_STORAGE_KEY, StorageScope.WORKSPACE);
      if (rawViewState) {
        viewState = JSON.parse(rawViewState);
      }
    }
    const previousInput = this.tree.getInput();
    const promise = this.setTreeInputPromise = this.tree.setInput(input, viewState).then(async () => {
      if (Array.isArray(input)) {
        if (!viewState || previousInput instanceof ExplorerItem) {
          for (let i = 0; i < Math.min(input.length, 5); i++) {
            try {
              await this.tree.expand(input[i]);
            } catch (e) {
            }
          }
        }
        if (!previousInput && input.length === 1 && this.configurationService.getValue().explorer.expandSingleFolderWorkspaces) {
          await this.tree.expand(input[0]).catch(() => {
          });
        }
        if (Array.isArray(previousInput)) {
          const previousRoots = new ResourceMap();
          previousInput.forEach((previousRoot) => previousRoots.set(previousRoot.resource, true));
          await Promise.all(input.map(async (item) => {
            if (!previousRoots.has(item.resource)) {
              try {
                await this.tree.expand(item);
              } catch (e) {
              }
            }
          }));
        }
      }
      if (initialInputSetup) {
        perf.mark("code/didResolveExplorer");
      }
    });
    this.progressService.withProgress({
      location: ProgressLocation.Explorer,
      delay: this.layoutService.isRestored() ? 800 : 1500
      // reduce progress visibility when still restoring
    }, (_progress) => promise);
    await promise;
  }
  async selectResource(resource, reveal = this._autoReveal, retry = 0) {
    if (retry === 2) {
      return;
    }
    if (!resource || !this.isBodyVisible()) {
      return;
    }
    if (this.setTreeInputPromise) {
      await this.setTreeInputPromise;
    }
    let item = this.explorerService.findClosestRoot(resource);
    while (item && item.resource.toString() !== resource.toString()) {
      try {
        await this.tree.expand(item);
      } catch (e) {
        return this.selectResource(resource, reveal, retry + 1);
      }
      if (!item.children.size) {
        item = null;
      } else {
        for (const child of item.children.values()) {
          if (this.uriIdentityService.extUri.isEqualOrParent(resource, child.resource)) {
            item = child;
            break;
          }
          item = null;
        }
      }
    }
    if (item) {
      if (item === this.tree.getInput()) {
        this.tree.setFocus([]);
        this.tree.setSelection([]);
        return;
      }
      try {
        if (item.nestedParent) {
          await this.tree.expand(item.nestedParent);
        }
        if ((reveal === true || reveal === "force") && this.tree.getRelativeTop(item) === null) {
          this.tree.reveal(item, 0.5);
        }
        this.tree.setFocus([item]);
        this.tree.setSelection([item]);
      } catch (e) {
        return this.selectResource(resource, reveal, retry + 1);
      }
    }
  }
  itemsCopied(stats, cut, previousCut) {
    this.fileCopiedContextKey.set(stats.length > 0);
    this.resourceCutContextKey.set(cut && stats.length > 0);
    previousCut?.forEach((item) => this.tree.rerender(item));
    if (cut) {
      stats.forEach((s) => this.tree.rerender(s));
    }
  }
  expandAll() {
    if (this.explorerService.isEditable(void 0)) {
      this.tree.domFocus();
    }
    this.tree.expandAll();
  }
  collapseAll() {
    if (this.explorerService.isEditable(void 0)) {
      this.tree.domFocus();
    }
    const treeInput = this.tree.getInput();
    if (Array.isArray(treeInput)) {
      if (hasExpandedRootChild(this.tree, treeInput)) {
        treeInput.forEach((folder) => {
          folder.children.forEach((child) => this.tree.hasNode(child) && this.tree.collapse(child, true));
        });
        return;
      }
    }
    this.tree.collapseAll();
  }
  previousCompressedStat() {
    const focused = this.tree.getFocus();
    if (!focused.length) {
      return;
    }
    const compressedNavigationControllers = this.renderer.getCompressedNavigationController(focused[0]);
    compressedNavigationControllers.forEach((controller) => {
      controller.previous();
      this.updateCompressedNavigationContextKeys(controller);
    });
  }
  nextCompressedStat() {
    const focused = this.tree.getFocus();
    if (!focused.length) {
      return;
    }
    const compressedNavigationControllers = this.renderer.getCompressedNavigationController(focused[0]);
    compressedNavigationControllers.forEach((controller) => {
      controller.next();
      this.updateCompressedNavigationContextKeys(controller);
    });
  }
  firstCompressedStat() {
    const focused = this.tree.getFocus();
    if (!focused.length) {
      return;
    }
    const compressedNavigationControllers = this.renderer.getCompressedNavigationController(focused[0]);
    compressedNavigationControllers.forEach((controller) => {
      controller.first();
      this.updateCompressedNavigationContextKeys(controller);
    });
  }
  lastCompressedStat() {
    const focused = this.tree.getFocus();
    if (!focused.length) {
      return;
    }
    const compressedNavigationControllers = this.renderer.getCompressedNavigationController(focused[0]);
    compressedNavigationControllers.forEach((controller) => {
      controller.last();
      this.updateCompressedNavigationContextKeys(controller);
    });
  }
  updateCompressedNavigationContextKeys(controller) {
    this.compressedFocusFirstContext.set(controller.index === 0);
    this.compressedFocusLastContext.set(controller.index === controller.count - 1);
  }
  updateAnyCollapsedContext() {
    const treeInput = this.tree.getInput();
    if (treeInput === void 0) {
      return;
    }
    const treeInputArray = Array.isArray(treeInput) ? treeInput : Array.from(treeInput.children.values());
    this.viewHasSomeCollapsibleRootItem.set(hasExpandedNode(this.tree, treeInputArray));
    this.storeTreeViewState();
  }
  hasPhantomElements() {
    return !!this.findProvider?.isShowingFilterResults();
  }
  dispose() {
    this.dragHandler?.dispose();
    super.dispose();
  }
};
__decorateClass([
  memoize
], ExplorerView.prototype, "fileCopiedContextKey", 1);
__decorateClass([
  memoize
], ExplorerView.prototype, "resourceCutContextKey", 1);
ExplorerView = __decorateClass([
  __decorateParam(1, IContextMenuService),
  __decorateParam(2, IViewDescriptorService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IWorkspaceContextService),
  __decorateParam(5, IProgressService),
  __decorateParam(6, IEditorService),
  __decorateParam(7, IEditorResolverService),
  __decorateParam(8, IWorkbenchLayoutService),
  __decorateParam(9, IKeybindingService),
  __decorateParam(10, IContextKeyService),
  __decorateParam(11, IConfigurationService),
  __decorateParam(12, ILabelService),
  __decorateParam(13, IThemeService),
  __decorateParam(14, ITelemetryService),
  __decorateParam(15, IHoverService),
  __decorateParam(16, IExplorerService),
  __decorateParam(17, IStorageService),
  __decorateParam(18, IClipboardService),
  __decorateParam(19, IFileService),
  __decorateParam(20, IUriIdentityService),
  __decorateParam(21, ICommandService),
  __decorateParam(22, IOpenerService),
  __decorateParam(23, IAccessibilityService)
], ExplorerView);
function createFileIconThemableTreeContainerScope(container, themeService) {
  container.classList.add("file-icon-themable-tree");
  container.classList.add("show-file-icons");
  const onDidChangeFileIconTheme = (theme) => {
    container.classList.toggle("align-icons-and-twisties", theme.hasFileIcons && !theme.hasFolderIcons);
    container.classList.toggle("hide-arrows", theme.hidesExplorerArrows === true);
  };
  onDidChangeFileIconTheme(themeService.getFileIconTheme());
  return themeService.onDidFileIconThemeChange(onDidChangeFileIconTheme);
}
const CanCreateContext = ContextKeyExpr.or(
  // Folder: can create unless readonly
  ContextKeyExpr.and(ExplorerFolderContext, ExplorerResourceWritableContext),
  // File: can create unless parent is readonly
  ContextKeyExpr.and(ExplorerFolderContext.toNegated(), ExplorerResourceParentReadOnlyContext.toNegated())
);
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.files.action.createFileFromExplorer",
      title: nls.localize("createNewFile", "New File..."),
      f1: false,
      icon: Codicon.newFile,
      precondition: CanCreateContext,
      menu: {
        id: MenuId.ViewTitle,
        group: "navigation",
        when: ContextKeyExpr.equals("view", VIEW_ID),
        order: 10
      }
    });
  }
  run(accessor) {
    const commandService = accessor.get(ICommandService);
    commandService.executeCommand(NEW_FILE_COMMAND_ID);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.files.action.createFolderFromExplorer",
      title: nls.localize("createNewFolder", "New Folder..."),
      f1: false,
      icon: Codicon.newFolder,
      precondition: CanCreateContext,
      menu: {
        id: MenuId.ViewTitle,
        group: "navigation",
        when: ContextKeyExpr.equals("view", VIEW_ID),
        order: 20
      }
    });
  }
  run(accessor) {
    const commandService = accessor.get(ICommandService);
    commandService.executeCommand(NEW_FOLDER_COMMAND_ID);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.files.action.refreshFilesExplorer",
      title: nls.localize2("refreshExplorer", "Refresh Explorer"),
      f1: true,
      icon: Codicon.refresh,
      menu: {
        id: MenuId.ViewTitle,
        group: "navigation",
        when: ContextKeyExpr.equals("view", VIEW_ID),
        order: 30
      },
      metadata: {
        description: nls.localize2("refreshExplorerMetadata", "Forces a refresh of the Explorer.")
      },
      precondition: ExplorerFindProviderActive.negate()
    });
  }
  async run(accessor) {
    const viewsService = accessor.get(IViewsService);
    const explorerService = accessor.get(IExplorerService);
    await viewsService.openView(VIEW_ID);
    await explorerService.refresh();
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.files.action.collapseExplorerFolders",
      title: nls.localize2("collapseExplorerFolders", "Collapse Folders in Explorer"),
      f1: true,
      icon: Codicon.collapseAll,
      menu: {
        id: MenuId.ViewTitle,
        group: "navigation",
        when: ContextKeyExpr.equals("view", VIEW_ID),
        order: 40
      },
      metadata: {
        description: nls.localize2("collapseExplorerFoldersMetadata", "Folds all folders in the Explorer.")
      }
    });
  }
  run(accessor) {
    const viewsService = accessor.get(IViewsService);
    const view = viewsService.getViewWithId(VIEW_ID);
    if (view !== null) {
      const explorerView = view;
      explorerView.collapseAll();
    }
  }
});
export {
  ExplorerView,
  createFileIconThemableTreeContainerScope,
  getContext
};
