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
import { localize } from "../../../../../../nls.js";
import * as DOM from "../../../../../../base/browser/dom.js";
import { ToolBar } from "../../../../../../base/browser/ui/toolbar/toolbar.js";
import { IconLabel } from "../../../../../../base/browser/ui/iconLabel/iconLabel.js";
import { Emitter } from "../../../../../../base/common/event.js";
import { createMatches } from "../../../../../../base/common/filters.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { getIconClassesForLanguageId } from "../../../../../../editor/common/services/getIconClasses.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { Extensions as ConfigurationExtensions } from "../../../../../../platform/configuration/common/configurationRegistry.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { MarkerSeverity } from "../../../../../../platform/markers/common/markers.js";
import { Registry } from "../../../../../../platform/registry/common/platform.js";
import { listErrorForeground, listWarningForeground } from "../../../../../../platform/theme/common/colorRegistry.js";
import { IThemeService } from "../../../../../../platform/theme/common/themeService.js";
import { Extensions as WorkbenchExtensions } from "../../../../../common/contributions.js";
import { CellFoldingState, CellRevealType } from "../../notebookBrowser.js";
import { NotebookEditor } from "../../notebookEditor.js";
import { CellKind, NotebookCellsChangeType, NotebookSetting } from "../../../common/notebookCommon.js";
import { IEditorService, SIDE_GROUP } from "../../../../../services/editor/common/editorService.js";
import { LifecyclePhase } from "../../../../../services/lifecycle/common/lifecycle.js";
import { IOutlineService, OutlineConfigCollapseItemsValues, OutlineConfigKeys, OutlineTarget } from "../../../../../services/outline/browser/outline.js";
import { CancellationToken } from "../../../../../../base/common/cancellation.js";
import { Range } from "../../../../../../editor/common/core/range.js";
import { IContextMenuService } from "../../../../../../platform/contextview/browser/contextView.js";
import { Action2, IMenuService, MenuId, MenuItemAction, MenuRegistry, registerAction2 } from "../../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../../../platform/contextkey/common/contextkey.js";
import { MenuEntryActionViewItem, getActionBarActions } from "../../../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { Delayer, disposableTimeout } from "../../../../../../base/common/async.js";
import { IOutlinePane } from "../../../../outline/browser/outline.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { NOTEBOOK_IS_ACTIVE_EDITOR } from "../../../common/notebookContextKeys.js";
import { NotebookOutlineConstants } from "../../viewModel/notebookOutlineEntryFactory.js";
import { INotebookCellOutlineDataSourceFactory } from "../../viewModel/notebookOutlineDataSourceFactory.js";
import { INotebookExecutionStateService, NotebookExecutionType } from "../../../common/notebookExecutionStateService.js";
import { ILanguageFeaturesService } from "../../../../../../editor/common/services/languageFeatures.js";
import { safeIntl } from "../../../../../../base/common/date.js";
class NotebookOutlineTemplate {
  constructor(container, iconClass, iconLabel, decoration, actionMenu, elementDisposables) {
    this.container = container;
    this.iconClass = iconClass;
    this.iconLabel = iconLabel;
    this.decoration = decoration;
    this.actionMenu = actionMenu;
    this.elementDisposables = elementDisposables;
  }
  static {
    this.templateId = "NotebookOutlineRenderer";
  }
}
let NotebookOutlineRenderer = class {
  constructor(_editor, _target, _themeService, _configurationService, _contextMenuService, _contextKeyService, _menuService, _instantiationService) {
    this._editor = _editor;
    this._target = _target;
    this._themeService = _themeService;
    this._configurationService = _configurationService;
    this._contextMenuService = _contextMenuService;
    this._contextKeyService = _contextKeyService;
    this._menuService = _menuService;
    this._instantiationService = _instantiationService;
    this.templateId = NotebookOutlineTemplate.templateId;
  }
  renderTemplate(container) {
    const elementDisposables = new DisposableStore();
    container.classList.add("notebook-outline-element", "show-file-icons");
    const iconClass = document.createElement("div");
    container.append(iconClass);
    const iconLabel = new IconLabel(container, { supportHighlights: true });
    const decoration = document.createElement("div");
    decoration.className = "element-decoration";
    container.append(decoration);
    const actionMenu = document.createElement("div");
    actionMenu.className = "action-menu";
    container.append(actionMenu);
    return new NotebookOutlineTemplate(container, iconClass, iconLabel, decoration, actionMenu, elementDisposables);
  }
  renderElement(node, _index, template) {
    const extraClasses = [];
    const options = {
      matches: createMatches(node.filterData),
      labelEscapeNewLines: true,
      extraClasses
    };
    const isCodeCell = node.element.cell.cellKind === CellKind.Code;
    if (node.element.level >= 8) {
      template.iconClass.className = "element-icon " + ThemeIcon.asClassNameArray(node.element.icon).join(" ");
    } else if (isCodeCell && this._themeService.getFileIconTheme().hasFileIcons && !node.element.isExecuting) {
      template.iconClass.className = "";
      extraClasses.push(...getIconClassesForLanguageId(node.element.cell.language ?? ""));
    } else {
      template.iconClass.className = "element-icon " + ThemeIcon.asClassNameArray(node.element.icon).join(" ");
    }
    template.iconLabel.setLabel(" " + node.element.label, void 0, options);
    const { markerInfo } = node.element;
    template.container.style.removeProperty("--outline-element-color");
    template.decoration.innerText = "";
    if (markerInfo) {
      const problem = this._configurationService.getValue("problems.visibility");
      const useBadges = this._configurationService.getValue(OutlineConfigKeys.problemsBadges);
      if (!useBadges || !problem) {
        template.decoration.classList.remove("bubble");
        template.decoration.innerText = "";
      } else if (markerInfo.count === 0) {
        template.decoration.classList.add("bubble");
        template.decoration.innerText = "\uEA71";
      } else {
        template.decoration.classList.remove("bubble");
        template.decoration.innerText = markerInfo.count > 9 ? "9+" : String(markerInfo.count);
      }
      const color = this._themeService.getColorTheme().getColor(markerInfo.topSev === MarkerSeverity.Error ? listErrorForeground : listWarningForeground);
      if (problem === void 0) {
        return;
      }
      const useColors = this._configurationService.getValue(OutlineConfigKeys.problemsColors);
      if (!useColors || !problem) {
        template.container.style.removeProperty("--outline-element-color");
        template.decoration.style.setProperty("--outline-element-color", color?.toString() ?? "inherit");
      } else {
        template.container.style.setProperty("--outline-element-color", color?.toString() ?? "inherit");
      }
    }
    if (this._target === OutlineTarget.OutlinePane) {
      if (!this._editor) {
        return;
      }
      const nbCell = node.element.cell;
      const nbViewModel = this._editor.getViewModel();
      if (!nbViewModel) {
        return;
      }
      const idx = nbViewModel.getCellIndex(nbCell);
      const length = isCodeCell ? 0 : nbViewModel.getFoldedLength(idx);
      const scopedContextKeyService = template.elementDisposables.add(this._contextKeyService.createScoped(template.container));
      NotebookOutlineContext.CellKind.bindTo(scopedContextKeyService).set(isCodeCell ? CellKind.Code : CellKind.Markup);
      NotebookOutlineContext.CellHasChildren.bindTo(scopedContextKeyService).set(length > 0);
      NotebookOutlineContext.CellHasHeader.bindTo(scopedContextKeyService).set(node.element.level !== NotebookOutlineConstants.NonHeaderOutlineLevel);
      NotebookOutlineContext.OutlineElementTarget.bindTo(scopedContextKeyService).set(this._target);
      this.setupFolding(isCodeCell, nbViewModel, scopedContextKeyService, template, nbCell);
      const outlineEntryToolbar = template.elementDisposables.add(new ToolBar(template.actionMenu, this._contextMenuService, {
        actionViewItemProvider: (action) => {
          if (action instanceof MenuItemAction) {
            return this._instantiationService.createInstance(MenuEntryActionViewItem, action, void 0);
          }
          return void 0;
        }
      }));
      const menu = template.elementDisposables.add(this._menuService.createMenu(MenuId.NotebookOutlineActionMenu, scopedContextKeyService));
      const actions = getOutlineToolbarActions(menu, { notebookEditor: this._editor, outlineEntry: node.element });
      outlineEntryToolbar.setActions(actions.primary, actions.secondary);
      this.setupToolbarListeners(this._editor, outlineEntryToolbar, menu, actions, node.element, template);
      template.actionMenu.style.padding = "0 0.8em 0 0.4em";
    }
  }
  disposeTemplate(templateData) {
    templateData.iconLabel.dispose();
    templateData.elementDisposables.dispose();
  }
  disposeElement(element, index, templateData) {
    templateData.elementDisposables.clear();
    DOM.clearNode(templateData.actionMenu);
  }
  setupFolding(isCodeCell, nbViewModel, scopedContextKeyService, template, nbCell) {
    const foldingState = isCodeCell ? CellFoldingState.None : nbCell.foldingState;
    const foldingStateCtx = NotebookOutlineContext.CellFoldingState.bindTo(scopedContextKeyService);
    foldingStateCtx.set(foldingState);
    if (!isCodeCell) {
      template.elementDisposables.add(nbViewModel.onDidFoldingStateChanged(() => {
        const foldingState2 = nbCell.foldingState;
        NotebookOutlineContext.CellFoldingState.bindTo(scopedContextKeyService).set(foldingState2);
        foldingStateCtx.set(foldingState2);
      }));
    }
  }
  setupToolbarListeners(editor, toolbar, menu, initActions, entry, templateData) {
    let dropdownIsVisible = false;
    let deferredUpdate;
    toolbar.setActions(initActions.primary, initActions.secondary);
    templateData.elementDisposables.add(menu.onDidChange(() => {
      if (dropdownIsVisible) {
        const actions2 = getOutlineToolbarActions(menu, { notebookEditor: editor, outlineEntry: entry });
        deferredUpdate = () => toolbar.setActions(actions2.primary, actions2.secondary);
        return;
      }
      const actions = getOutlineToolbarActions(menu, { notebookEditor: editor, outlineEntry: entry });
      toolbar.setActions(actions.primary, actions.secondary);
    }));
    templateData.container.classList.remove("notebook-outline-toolbar-dropdown-active");
    templateData.elementDisposables.add(toolbar.onDidChangeDropdownVisibility((visible) => {
      dropdownIsVisible = visible;
      if (visible) {
        templateData.container.classList.add("notebook-outline-toolbar-dropdown-active");
      } else {
        templateData.container.classList.remove("notebook-outline-toolbar-dropdown-active");
      }
      if (deferredUpdate && !visible) {
        disposableTimeout(() => {
          deferredUpdate?.();
        }, 0, templateData.elementDisposables);
        deferredUpdate = void 0;
      }
    }));
  }
};
NotebookOutlineRenderer = __decorateClass([
  __decorateParam(2, IThemeService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IMenuService),
  __decorateParam(7, IInstantiationService)
], NotebookOutlineRenderer);
function getOutlineToolbarActions(menu, args) {
  return getActionBarActions(menu.getActions({ shouldForwardArgs: true, arg: args }), (g) => /^inline/.test(g));
}
class NotebookOutlineAccessibility {
  getAriaLabel(element) {
    return element.label;
  }
  getWidgetAriaLabel() {
    return "";
  }
}
class NotebookNavigationLabelProvider {
  getKeyboardNavigationLabel(element) {
    return element.label;
  }
}
class NotebookOutlineVirtualDelegate {
  getHeight(_element) {
    return 22;
  }
  getTemplateId(_element) {
    return NotebookOutlineTemplate.templateId;
  }
}
let NotebookQuickPickProvider = class {
  constructor(notebookCellOutlineDataSourceRef, _configurationService, _themeService) {
    this.notebookCellOutlineDataSourceRef = notebookCellOutlineDataSourceRef;
    this._configurationService = _configurationService;
    this._themeService = _themeService;
    this._disposables = new DisposableStore();
    this.gotoShowCodeCellSymbols = this._configurationService.getValue(NotebookSetting.gotoSymbolsAllSymbols);
    this._disposables.add(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(NotebookSetting.gotoSymbolsAllSymbols)) {
        this.gotoShowCodeCellSymbols = this._configurationService.getValue(NotebookSetting.gotoSymbolsAllSymbols);
      }
    }));
  }
  getQuickPickElements() {
    const bucket = [];
    for (const entry of this.notebookCellOutlineDataSourceRef?.object?.entries ?? []) {
      entry.asFlatList(bucket);
    }
    const result = [];
    const { hasFileIcons } = this._themeService.getFileIconTheme();
    const isSymbol = (element) => !!element.symbolKind;
    const isCodeCell = (element) => element.cell.cellKind === CellKind.Code && element.level === NotebookOutlineConstants.NonHeaderOutlineLevel;
    for (let i = 0; i < bucket.length; i++) {
      const element = bucket[i];
      const nextElement = bucket[i + 1];
      if (!this.gotoShowCodeCellSymbols && isSymbol(element)) {
        continue;
      }
      if (this.gotoShowCodeCellSymbols && isCodeCell(element) && nextElement && isSymbol(nextElement)) {
        continue;
      }
      const useFileIcon = hasFileIcons && !element.symbolKind;
      result.push({
        element,
        label: useFileIcon ? element.label : `$(${element.icon.id}) ${element.label}`,
        ariaLabel: element.label,
        iconClasses: useFileIcon ? getIconClassesForLanguageId(element.cell.language ?? "") : void 0
      });
    }
    return result;
  }
  dispose() {
    this._disposables.dispose();
  }
};
NotebookQuickPickProvider = __decorateClass([
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IThemeService)
], NotebookQuickPickProvider);
function filterEntry(entry, showMarkdownHeadersOnly, showCodeCells, showCodeCellSymbols) {
  if (showMarkdownHeadersOnly && entry.cell.cellKind === CellKind.Markup && entry.level === NotebookOutlineConstants.NonHeaderOutlineLevel || // show headers only   + cell is mkdn + is level 7 (not header)
  !showCodeCells && entry.cell.cellKind === CellKind.Code || // show code cells off + cell is code
  !showCodeCellSymbols && entry.cell.cellKind === CellKind.Code && entry.level > NotebookOutlineConstants.NonHeaderOutlineLevel) {
    return true;
  }
  return false;
}
let NotebookOutlinePaneProvider = class {
  constructor(outlineDataSourceRef, _configurationService) {
    this.outlineDataSourceRef = outlineDataSourceRef;
    this._configurationService = _configurationService;
    this._disposables = new DisposableStore();
    this.showCodeCells = this._configurationService.getValue(NotebookSetting.outlineShowCodeCells);
    this.showCodeCellSymbols = this._configurationService.getValue(NotebookSetting.outlineShowCodeCellSymbols);
    this.showMarkdownHeadersOnly = this._configurationService.getValue(NotebookSetting.outlineShowMarkdownHeadersOnly);
    this._disposables.add(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(NotebookSetting.outlineShowCodeCells)) {
        this.showCodeCells = this._configurationService.getValue(NotebookSetting.outlineShowCodeCells);
      }
      if (e.affectsConfiguration(NotebookSetting.outlineShowCodeCellSymbols)) {
        this.showCodeCellSymbols = this._configurationService.getValue(NotebookSetting.outlineShowCodeCellSymbols);
      }
      if (e.affectsConfiguration(NotebookSetting.outlineShowMarkdownHeadersOnly)) {
        this.showMarkdownHeadersOnly = this._configurationService.getValue(NotebookSetting.outlineShowMarkdownHeadersOnly);
      }
    }));
  }
  getActiveEntry() {
    const newActive = this.outlineDataSourceRef?.object?.activeElement;
    if (!newActive) {
      return void 0;
    }
    if (!filterEntry(newActive, this.showMarkdownHeadersOnly, this.showCodeCells, this.showCodeCellSymbols)) {
      return newActive;
    }
    let parent = newActive.parent;
    while (parent) {
      if (filterEntry(parent, this.showMarkdownHeadersOnly, this.showCodeCells, this.showCodeCellSymbols)) {
        parent = parent.parent;
      } else {
        return parent;
      }
    }
    return void 0;
  }
  *getChildren(element) {
    const isOutline = element instanceof NotebookCellOutline;
    const entries = isOutline ? this.outlineDataSourceRef?.object?.entries ?? [] : element.children;
    for (const entry of entries) {
      if (entry.cell.cellKind === CellKind.Markup) {
        if (!this.showMarkdownHeadersOnly) {
          yield entry;
        } else if (entry.level < NotebookOutlineConstants.NonHeaderOutlineLevel) {
          yield entry;
        }
      } else if (this.showCodeCells && entry.cell.cellKind === CellKind.Code) {
        if (this.showCodeCellSymbols) {
          yield entry;
        } else if (entry.level === NotebookOutlineConstants.NonHeaderOutlineLevel) {
          yield entry;
        }
      }
    }
  }
  dispose() {
    this._disposables.dispose();
  }
};
NotebookOutlinePaneProvider = __decorateClass([
  __decorateParam(1, IConfigurationService)
], NotebookOutlinePaneProvider);
let NotebookBreadcrumbsProvider = class {
  constructor(outlineDataSourceRef, _configurationService) {
    this.outlineDataSourceRef = outlineDataSourceRef;
    this._configurationService = _configurationService;
    this._disposables = new DisposableStore();
    this.showCodeCells = this._configurationService.getValue(NotebookSetting.breadcrumbsShowCodeCells);
    this._disposables.add(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(NotebookSetting.breadcrumbsShowCodeCells)) {
        this.showCodeCells = this._configurationService.getValue(NotebookSetting.breadcrumbsShowCodeCells);
      }
    }));
  }
  getBreadcrumbElements() {
    const result = [];
    let candidate = this.outlineDataSourceRef?.object?.activeElement;
    while (candidate) {
      if (this.showCodeCells || candidate.cell.cellKind !== CellKind.Code) {
        result.unshift({ element: candidate, label: candidate.label });
      }
      candidate = candidate.parent;
    }
    return result;
  }
  dispose() {
    this._disposables.dispose();
  }
};
NotebookBreadcrumbsProvider = __decorateClass([
  __decorateParam(1, IConfigurationService)
], NotebookBreadcrumbsProvider);
class NotebookComparator {
  constructor() {
    this._collator = safeIntl.Collator(void 0, { numeric: true });
  }
  compareByPosition(a, b) {
    return a.index - b.index;
  }
  compareByType(a, b) {
    return a.cell.cellKind - b.cell.cellKind || this._collator.value.compare(a.label, b.label);
  }
  compareByName(a, b) {
    return this._collator.value.compare(a.label, b.label);
  }
}
let NotebookCellOutline = class {
  constructor(_editor, _target, _themeService, _editorService, _instantiationService, _configurationService, _languageFeaturesService, _notebookExecutionStateService) {
    this._editor = _editor;
    this._target = _target;
    this._themeService = _themeService;
    this._editorService = _editorService;
    this._instantiationService = _instantiationService;
    this._configurationService = _configurationService;
    this._languageFeaturesService = _languageFeaturesService;
    this._notebookExecutionStateService = _notebookExecutionStateService;
    this.outlineKind = "notebookCells";
    this._disposables = new DisposableStore();
    this._modelDisposables = new DisposableStore();
    this._dataSourceDisposables = new DisposableStore();
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
    this.delayerRecomputeState = this._disposables.add(new Delayer(300));
    this.delayerRecomputeActive = this._disposables.add(new Delayer(200));
    // this can be long, because it will force a recompute at the end, so ideally we only do this once all nb language features are registered
    this.delayerRecomputeSymbols = this._disposables.add(new Delayer(2e3));
    this.outlineShowCodeCells = this._configurationService.getValue(NotebookSetting.outlineShowCodeCells);
    this.outlineShowCodeCellSymbols = this._configurationService.getValue(NotebookSetting.outlineShowCodeCellSymbols);
    this.outlineShowMarkdownHeadersOnly = this._configurationService.getValue(NotebookSetting.outlineShowMarkdownHeadersOnly);
    this.initializeOutline();
    const delegate = new NotebookOutlineVirtualDelegate();
    const renderers = [this._instantiationService.createInstance(NotebookOutlineRenderer, this._editor.getControl(), this._target)];
    const comparator = new NotebookComparator();
    const options = {
      collapseByDefault: this._target === OutlineTarget.Breadcrumbs || this._target === OutlineTarget.OutlinePane && this._configurationService.getValue(OutlineConfigKeys.collapseItems) === OutlineConfigCollapseItemsValues.Collapsed,
      expandOnlyOnTwistieClick: true,
      multipleSelectionSupport: false,
      accessibilityProvider: new NotebookOutlineAccessibility(),
      identityProvider: { getId: (element) => element.cell.uri.toString() },
      keyboardNavigationLabelProvider: new NotebookNavigationLabelProvider()
    };
    this.config = {
      treeDataSource: this._treeDataSource,
      quickPickDataSource: this._quickPickDataSource,
      breadcrumbsDataSource: this._breadcrumbsDataSource,
      delegate,
      renderers,
      comparator,
      options
    };
  }
  // getters
  get activeElement() {
    this.checkDelayer();
    if (this._target === OutlineTarget.OutlinePane) {
      return this.config.treeDataSource.getActiveEntry();
    } else {
      console.error("activeElement should not be called outside of the OutlinePane");
      return void 0;
    }
  }
  get entries() {
    this.checkDelayer();
    return this._outlineDataSourceReference?.object?.entries ?? [];
  }
  get uri() {
    return this._outlineDataSourceReference?.object?.uri;
  }
  get isEmpty() {
    if (!this._outlineDataSourceReference?.object?.entries) {
      return true;
    }
    return !this._outlineDataSourceReference.object.entries.some((entry) => {
      return !filterEntry(entry, this.outlineShowMarkdownHeadersOnly, this.outlineShowCodeCells, this.outlineShowCodeCellSymbols);
    });
  }
  checkDelayer() {
    if (this.delayerRecomputeState.isTriggered()) {
      this.delayerRecomputeState.cancel();
      this.recomputeState();
    }
  }
  initializeOutline() {
    this.setDataSources();
    this.setModelListeners();
    this._disposables.add(this._editor.onDidChangeModel(() => {
      this.setDataSources();
      this.setModelListeners();
      this.computeSymbols();
    }));
    this._disposables.add(this._languageFeaturesService.documentSymbolProvider.onDidChange(() => {
      this.delayedComputeSymbols();
    }));
    this._disposables.add(this._editor.onDidChangeSelection(() => {
      this.delayedRecomputeActive();
    }));
    this._disposables.add(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(NotebookSetting.outlineShowMarkdownHeadersOnly) || e.affectsConfiguration(NotebookSetting.outlineShowCodeCells) || e.affectsConfiguration(NotebookSetting.outlineShowCodeCellSymbols) || e.affectsConfiguration(NotebookSetting.breadcrumbsShowCodeCells)) {
        this.outlineShowCodeCells = this._configurationService.getValue(NotebookSetting.outlineShowCodeCells);
        this.outlineShowCodeCellSymbols = this._configurationService.getValue(NotebookSetting.outlineShowCodeCellSymbols);
        this.outlineShowMarkdownHeadersOnly = this._configurationService.getValue(NotebookSetting.outlineShowMarkdownHeadersOnly);
        this.delayedRecomputeState();
      }
    }));
    this._disposables.add(this._notebookExecutionStateService.onDidChangeExecution((e) => {
      if (e.type === NotebookExecutionType.cell && !!this._editor.textModel && e.affectsNotebook(this._editor.textModel?.uri)) {
        this.delayedRecomputeState();
      }
    }));
    this._disposables.add(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(NotebookSetting.outlineShowCodeCellSymbols)) {
        this.outlineShowCodeCellSymbols = this._configurationService.getValue(NotebookSetting.outlineShowCodeCellSymbols);
        this.computeSymbols();
      }
    }));
    this._disposables.add(this._themeService.onDidFileIconThemeChange(() => {
      this._onDidChange.fire({});
    }));
    this.recomputeState();
  }
  /**
   * set up the primary data source + three viewing sources for the various outline views
   */
  setDataSources() {
    const notebookEditor = this._editor.getControl();
    this._outlineDataSourceReference?.dispose();
    this._dataSourceDisposables.clear();
    if (!notebookEditor?.hasModel()) {
      this._outlineDataSourceReference = void 0;
    } else {
      this._outlineDataSourceReference = this._dataSourceDisposables.add(this._instantiationService.invokeFunction((accessor) => accessor.get(INotebookCellOutlineDataSourceFactory).getOrCreate(notebookEditor)));
      this._dataSourceDisposables.add(this._outlineDataSourceReference.object.onDidChange(() => {
        this._onDidChange.fire({});
      }));
    }
    this._treeDataSource = this._dataSourceDisposables.add(this._instantiationService.createInstance(NotebookOutlinePaneProvider, this._outlineDataSourceReference));
    this._quickPickDataSource = this._dataSourceDisposables.add(this._instantiationService.createInstance(NotebookQuickPickProvider, this._outlineDataSourceReference));
    this._breadcrumbsDataSource = this._dataSourceDisposables.add(this._instantiationService.createInstance(NotebookBreadcrumbsProvider, this._outlineDataSourceReference));
  }
  /**
   * set up the listeners for the outline content, these respond to model changes in the notebook
   */
  setModelListeners() {
    this._modelDisposables.clear();
    if (!this._editor.textModel) {
      return;
    }
    if (!this.entries.length) {
      this.computeSymbols();
    }
    this._modelDisposables.add(this._editor.textModel.onDidChangeContent((contentChanges) => {
      if (contentChanges.rawEvents.some((c) => c.kind === NotebookCellsChangeType.ChangeCellContent || c.kind === NotebookCellsChangeType.ChangeCellInternalMetadata || c.kind === NotebookCellsChangeType.Move || c.kind === NotebookCellsChangeType.ModelChange)) {
        this.delayedRecomputeState();
      }
    }));
  }
  async computeSymbols(cancelToken = CancellationToken.None) {
    if (this._target === OutlineTarget.OutlinePane && this.outlineShowCodeCellSymbols) {
      void this.doComputeSymbols(cancelToken);
    }
  }
  async doComputeSymbols(cancelToken) {
    await this._outlineDataSourceReference?.object?.computeFullSymbols(cancelToken);
  }
  async delayedComputeSymbols() {
    this.delayerRecomputeState.cancel();
    this.delayerRecomputeActive.cancel();
    this.delayerRecomputeSymbols.trigger(() => {
      this.computeSymbols();
    });
  }
  recomputeState() {
    this._outlineDataSourceReference?.object?.recomputeState();
  }
  delayedRecomputeState() {
    this.delayerRecomputeActive.cancel();
    this.delayerRecomputeState.trigger(() => {
      this.recomputeState();
    });
  }
  recomputeActive() {
    this._outlineDataSourceReference?.object?.recomputeActive();
  }
  delayedRecomputeActive() {
    this.delayerRecomputeActive.trigger(() => {
      this.recomputeActive();
    });
  }
  async reveal(entry, options, sideBySide) {
    const notebookEditorOptions = {
      ...options,
      override: this._editor.input?.editorId,
      cellRevealType: CellRevealType.Top,
      selection: entry.position,
      viewState: void 0
    };
    await this._editorService.openEditor({
      resource: entry.cell.uri,
      options: notebookEditorOptions
    }, sideBySide ? SIDE_GROUP : void 0);
  }
  preview(entry) {
    const widget = this._editor.getControl();
    if (!widget) {
      return Disposable.None;
    }
    if (entry.range) {
      const range = Range.lift(entry.range);
      widget.revealRangeInCenterIfOutsideViewportAsync(entry.cell, range);
    } else {
      widget.revealInCenterIfOutsideViewport(entry.cell);
    }
    const ids = widget.deltaCellDecorations([], [{
      handle: entry.cell.handle,
      options: { className: "nb-symbolHighlight", outputClassName: "nb-symbolHighlight" }
    }]);
    let editorDecorations;
    widget.changeModelDecorations((accessor) => {
      if (entry.range) {
        const decorations = [
          {
            range: entry.range,
            options: {
              description: "document-symbols-outline-range-highlight",
              className: "rangeHighlight",
              isWholeLine: true
            }
          }
        ];
        const deltaDecoration = {
          ownerId: entry.cell.handle,
          decorations
        };
        editorDecorations = accessor.deltaDecorations([], [deltaDecoration]);
      }
    });
    return toDisposable(() => {
      widget.deltaCellDecorations(ids, []);
      if (editorDecorations?.length) {
        widget.changeModelDecorations((accessor) => {
          accessor.deltaDecorations(editorDecorations, []);
        });
      }
    });
  }
  captureViewState() {
    const widget = this._editor.getControl();
    const viewState = widget?.getEditorViewState();
    return toDisposable(() => {
      if (viewState) {
        widget?.restoreListViewState(viewState);
      }
    });
  }
  dispose() {
    this._onDidChange.dispose();
    this._disposables.dispose();
    this._modelDisposables.dispose();
    this._dataSourceDisposables.dispose();
    this._outlineDataSourceReference?.dispose();
  }
};
NotebookCellOutline = __decorateClass([
  __decorateParam(2, IThemeService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, ILanguageFeaturesService),
  __decorateParam(7, INotebookExecutionStateService)
], NotebookCellOutline);
let NotebookOutlineCreator = class {
  constructor(outlineService, _instantiationService) {
    this._instantiationService = _instantiationService;
    const reg = outlineService.registerOutlineCreator(this);
    this.dispose = () => reg.dispose();
  }
  matches(candidate) {
    return candidate.getId() === NotebookEditor.ID;
  }
  async createOutline(editor, target, cancelToken) {
    const outline = this._instantiationService.createInstance(NotebookCellOutline, editor, target);
    if (target === OutlineTarget.QuickPick) {
      await outline.doComputeSymbols(cancelToken);
    }
    return outline;
  }
};
NotebookOutlineCreator = __decorateClass([
  __decorateParam(0, IOutlineService),
  __decorateParam(1, IInstantiationService)
], NotebookOutlineCreator);
const NotebookOutlineContext = {
  CellKind: new RawContextKey("notebookCellKind", void 0),
  CellHasChildren: new RawContextKey("notebookCellHasChildren", false),
  CellHasHeader: new RawContextKey("notebookCellHasHeader", false),
  CellFoldingState: new RawContextKey("notebookCellFoldingState", CellFoldingState.None),
  OutlineElementTarget: new RawContextKey("notebookOutlineElementTarget", void 0)
};
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(NotebookOutlineCreator, LifecyclePhase.Eventually);
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  id: "notebook",
  order: 100,
  type: "object",
  "properties": {
    [NotebookSetting.outlineShowMarkdownHeadersOnly]: {
      type: "boolean",
      default: true,
      markdownDescription: localize("outline.showMarkdownHeadersOnly", "When enabled, notebook outline will show only markdown cells containing a header.")
    },
    [NotebookSetting.outlineShowCodeCells]: {
      type: "boolean",
      default: false,
      markdownDescription: localize("outline.showCodeCells", "When enabled, notebook outline shows code cells.")
    },
    [NotebookSetting.outlineShowCodeCellSymbols]: {
      type: "boolean",
      default: true,
      markdownDescription: localize("outline.showCodeCellSymbols", "When enabled, notebook outline shows code cell symbols. Relies on `#notebook.outline.showCodeCells#` being enabled.")
    },
    [NotebookSetting.breadcrumbsShowCodeCells]: {
      type: "boolean",
      default: true,
      markdownDescription: localize("breadcrumbs.showCodeCells", "When enabled, notebook breadcrumbs contain code cells.")
    },
    [NotebookSetting.gotoSymbolsAllSymbols]: {
      type: "boolean",
      default: true,
      markdownDescription: localize("notebook.gotoSymbols.showAllSymbols", "When enabled, the Go to Symbol Quick Pick will display full code symbols from the notebook, as well as Markdown headers.")
    }
  }
});
MenuRegistry.appendMenuItem(MenuId.ViewTitle, {
  submenu: MenuId.NotebookOutlineFilter,
  title: localize("filter", "Filter Entries"),
  icon: Codicon.filter,
  group: "navigation",
  order: -1,
  when: ContextKeyExpr.and(ContextKeyExpr.equals("view", IOutlinePane.Id), NOTEBOOK_IS_ACTIVE_EDITOR)
});
registerAction2(class ToggleShowMarkdownHeadersOnly extends Action2 {
  constructor() {
    super({
      id: "notebook.outline.toggleShowMarkdownHeadersOnly",
      title: localize("toggleShowMarkdownHeadersOnly", "Markdown Headers Only"),
      f1: false,
      toggled: {
        condition: ContextKeyExpr.equals("config.notebook.outline.showMarkdownHeadersOnly", true)
      },
      menu: {
        id: MenuId.NotebookOutlineFilter,
        group: "0_markdown_cells"
      }
    });
  }
  run(accessor, ...args) {
    const configurationService = accessor.get(IConfigurationService);
    const showMarkdownHeadersOnly = configurationService.getValue(NotebookSetting.outlineShowMarkdownHeadersOnly);
    configurationService.updateValue(NotebookSetting.outlineShowMarkdownHeadersOnly, !showMarkdownHeadersOnly);
  }
});
registerAction2(class ToggleCodeCellEntries extends Action2 {
  constructor() {
    super({
      id: "notebook.outline.toggleCodeCells",
      title: localize("toggleCodeCells", "Code Cells"),
      f1: false,
      toggled: {
        condition: ContextKeyExpr.equals("config.notebook.outline.showCodeCells", true)
      },
      menu: {
        id: MenuId.NotebookOutlineFilter,
        order: 1,
        group: "1_code_cells"
      }
    });
  }
  run(accessor, ...args) {
    const configurationService = accessor.get(IConfigurationService);
    const showCodeCells = configurationService.getValue(NotebookSetting.outlineShowCodeCells);
    configurationService.updateValue(NotebookSetting.outlineShowCodeCells, !showCodeCells);
  }
});
registerAction2(class ToggleCodeCellSymbolEntries extends Action2 {
  constructor() {
    super({
      id: "notebook.outline.toggleCodeCellSymbols",
      title: localize("toggleCodeCellSymbols", "Code Cell Symbols"),
      f1: false,
      toggled: {
        condition: ContextKeyExpr.equals("config.notebook.outline.showCodeCellSymbols", true)
      },
      menu: {
        id: MenuId.NotebookOutlineFilter,
        order: 2,
        group: "1_code_cells"
      }
    });
  }
  run(accessor, ...args) {
    const configurationService = accessor.get(IConfigurationService);
    const showCodeCellSymbols = configurationService.getValue(NotebookSetting.outlineShowCodeCellSymbols);
    configurationService.updateValue(NotebookSetting.outlineShowCodeCellSymbols, !showCodeCellSymbols);
  }
});
export {
  NotebookBreadcrumbsProvider,
  NotebookCellOutline,
  NotebookOutlineContext,
  NotebookOutlineCreator,
  NotebookOutlinePaneProvider,
  NotebookQuickPickProvider
};
