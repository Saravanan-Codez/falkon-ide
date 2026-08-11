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
import "./media/scm.css";
import { $, append, h, reset } from "../../../../base/browser/dom.js";
import { HoverStyle } from "../../../../base/browser/ui/hover/hover.js";
import { IconLabel } from "../../../../base/browser/ui/iconLabel/iconLabel.js";
import { createMatches } from "../../../../base/common/filters.js";
import { combinedDisposable, Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { autorun, derived, observableValue, waitForState, constObservable, latestChangedValue, observableFromEvent, runOnChange, observableSignal } from "../../../../base/common/observable.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { WorkbenchCompressibleAsyncDataTree } from "../../../../platform/list/browser/listService.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { asCssVariable, foreground } from "../../../../platform/theme/common/colorRegistry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ViewAction, ViewPane, ViewPaneShowActions } from "../../../browser/parts/views/viewPane.js";
import { IViewDescriptorService, ViewContainerLocation } from "../../../common/views.js";
import { renderSCMHistoryItemGraph, toISCMHistoryItemViewModelArray, SWIMLANE_WIDTH, renderSCMHistoryGraphPlaceholder, historyItemHoverLabelForeground, historyItemHoverDefaultLabelBackground, getHistoryItemIndex, toHistoryItemHoverContent } from "./scmHistory.js";
import { getHistoryItemEditorTitle, getProviderKey, isSCMHistoryItemChangeNode, isSCMHistoryItemChangeViewModelTreeElement, isSCMHistoryItemLoadMoreTreeElement, isSCMHistoryItemViewModelTreeElement, isSCMRepository } from "./util.js";
import { SCMIncomingHistoryItemId, SCMOutgoingHistoryItemId } from "../common/history.js";
import { HISTORY_VIEW_PANE_ID, ISCMService, ISCMViewService, ViewMode } from "../common/scm.js";
import { stripIcons } from "../../../../base/common/iconLabels.js";
import { HoverPosition } from "../../../../base/browser/ui/hover/hoverWidget.js";
import { Action2, IMenuService, isIMenuItem, MenuId, MenuRegistry, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { Sequencer, Throttler } from "../../../../base/common/async.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { ActionRunner } from "../../../../base/common/actions.js";
import { delta, groupBy } from "../../../../base/common/arrays.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { IProgressService } from "../../../../platform/progress/common/progress.js";
import { ContextKeys } from "./scmViewPane.js";
import { ActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { Event } from "../../../../base/common/event.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { clamp } from "../../../../base/common/numbers.js";
import { observableConfigValue } from "../../../../platform/observable/common/platformObservableUtils.js";
import { compare } from "../../../../base/common/strings.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { groupBy as groupBy2 } from "../../../../base/common/collections.js";
import { getActionBarActions, getFlatContextMenuActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { ResourceLabels } from "../../../browser/labels.js";
import { FileKind } from "../../../../platform/files/common/files.js";
import { WorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { basename } from "../../../../base/common/path.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { ScmHistoryItemResolver } from "../../multiDiffEditor/browser/scmMultiDiffSourceResolver.js";
import { ResourceTree } from "../../../../base/common/resourceTree.js";
import { URI } from "../../../../base/common/uri.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { CodeDataTransfers } from "../../../../platform/dnd/browser/dnd.js";
import { IMarkdownRendererService } from "../../../../platform/markdown/browser/markdownRenderer.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
const PICK_REPOSITORY_ACTION_ID = "workbench.scm.action.graph.pickRepository";
const PICK_HISTORY_ITEM_REFS_ACTION_ID = "workbench.scm.action.graph.pickHistoryItemRefs";
class SCMRepositoryActionViewItem extends ActionViewItem {
  constructor(_repository, action, options) {
    super(null, action, { ...options, icon: false, label: true });
    this._repository = _repository;
  }
  updateLabel() {
    if (this.options.label && this.label) {
      this.label.classList.add("scm-graph-repository-picker");
      const icon = $(".icon");
      const iconClassNameArray = ThemeIcon.isThemeIcon(this._repository.provider.iconPath) ? ThemeIcon.asClassNameArray(this._repository.provider.iconPath) : ThemeIcon.asClassNameArray(Codicon.repo);
      icon.classList.add(...iconClassNameArray);
      const name = $(".name");
      name.textContent = this._repository.provider.name;
      reset(this.label, icon, name);
    }
  }
  getTooltip() {
    return this._repository.provider.name;
  }
}
class SCMHistoryItemRefsActionViewItem extends ActionViewItem {
  constructor(_repository, _historyItemsFilter, action, options) {
    super(null, action, { ...options, icon: false, label: true });
    this._repository = _repository;
    this._historyItemsFilter = _historyItemsFilter;
  }
  updateLabel() {
    if (this.options.label && this.label) {
      this.label.classList.add("scm-graph-history-item-picker");
      const icon = $(".icon");
      icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.gitBranch));
      const name = $(".name");
      if (this._historyItemsFilter === "all") {
        name.textContent = localize("all", "All");
      } else if (this._historyItemsFilter === "auto") {
        name.textContent = localize("auto", "Auto");
      } else if (this._historyItemsFilter.length === 1) {
        name.textContent = this._historyItemsFilter[0].name;
      } else {
        name.textContent = localize("items", "{0} Items", this._historyItemsFilter.length);
      }
      reset(this.label, icon, name);
    }
  }
  getTooltip() {
    if (this._historyItemsFilter === "all") {
      return localize("allHistoryItemRefs", "All history item references");
    } else if (this._historyItemsFilter === "auto") {
      const historyProvider = this._repository.provider.historyProvider.get();
      return [
        historyProvider?.historyItemRef.get()?.name,
        historyProvider?.historyItemRemoteRef.get()?.name,
        historyProvider?.historyItemBaseRef.get()?.name
      ].filter((ref) => !!ref).join(", ");
    } else if (this._historyItemsFilter.length === 1) {
      return this._historyItemsFilter[0].name;
    } else {
      return this._historyItemsFilter.map((ref) => ref.name).join(", ");
    }
  }
}
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: PICK_REPOSITORY_ACTION_ID,
      title: localize("repositoryPicker", "Repository Picker"),
      viewId: HISTORY_VIEW_PANE_ID,
      f1: false,
      menu: {
        id: MenuId.SCMHistoryTitle,
        when: ContextKeyExpr.and(
          ContextKeyExpr.has("scm.providerCount"),
          ContextKeyExpr.greater("scm.providerCount", 1),
          ContextKeyExpr.equals("config.scm.repositories.selectionMode", "multiple")
        ),
        group: "navigation",
        order: 0
      }
    });
  }
  async runInView(_, view) {
    view.pickRepository();
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: PICK_HISTORY_ITEM_REFS_ACTION_ID,
      title: localize("referencePicker", "History Item Reference Picker"),
      icon: Codicon.gitBranch,
      viewId: HISTORY_VIEW_PANE_ID,
      precondition: ContextKeys.SCMHistoryItemCount.notEqualsTo(0),
      f1: false,
      menu: {
        id: MenuId.SCMHistoryTitle,
        group: "navigation",
        order: 1
      }
    });
  }
  async runInView(_, view) {
    view.pickHistoryItemRef();
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: "workbench.scm.action.graph.revealCurrentHistoryItem",
      title: localize("goToCurrentHistoryItem", "Go to Current History Item"),
      icon: Codicon.target,
      viewId: HISTORY_VIEW_PANE_ID,
      precondition: ContextKeyExpr.and(
        ContextKeys.SCMHistoryItemCount.notEqualsTo(0),
        ContextKeys.SCMCurrentHistoryItemRefInFilter.isEqualTo(true)
      ),
      f1: false,
      menu: {
        id: MenuId.SCMHistoryTitle,
        group: "navigation",
        order: 2
      }
    });
  }
  async runInView(_, view) {
    view.revealCurrentHistoryItem();
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: "workbench.scm.action.graph.refresh",
      title: localize("refreshGraph", "Refresh"),
      viewId: HISTORY_VIEW_PANE_ID,
      f1: false,
      icon: Codicon.refresh,
      menu: {
        id: MenuId.SCMHistoryTitle,
        group: "navigation",
        order: 1e3
      }
    });
  }
  async runInView(_, view) {
    view.refresh();
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: "workbench.scm.action.graph.setListViewMode",
      title: localize("setListViewMode", "View as List"),
      viewId: HISTORY_VIEW_PANE_ID,
      toggled: ContextKeys.SCMHistoryViewMode.isEqualTo(ViewMode.List),
      menu: { id: MenuId.SCMHistoryTitle, group: "9_viewmode", order: 1 },
      f1: false
    });
  }
  async runInView(_, view) {
    view.setViewMode(ViewMode.List);
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: "workbench.scm.action.graph.setTreeViewMode",
      title: localize("setTreeViewMode", "View as Tree"),
      viewId: HISTORY_VIEW_PANE_ID,
      toggled: ContextKeys.SCMHistoryViewMode.isEqualTo(ViewMode.Tree),
      menu: { id: MenuId.SCMHistoryTitle, group: "9_viewmode", order: 2 },
      f1: false
    });
  }
  async runInView(_, view) {
    view.setViewMode(ViewMode.Tree);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.scm.action.graph.viewChanges",
      title: localize("openChanges", "Open Changes"),
      icon: Codicon.diffMultiple,
      f1: false,
      menu: [
        {
          id: MenuId.SCMHistoryItemContext,
          group: "inline",
          order: 1
        },
        {
          id: MenuId.SCMHistoryItemContext,
          group: "0_view",
          order: 1
        }
      ]
    });
  }
  async run(accessor, provider, ...historyItems) {
    const commandService = accessor.get(ICommandService);
    const historyProvider = provider.historyProvider.get();
    const historyItemRef = historyProvider?.historyItemRef.get();
    const historyItemRemoteRef = historyProvider?.historyItemRemoteRef.get();
    if (!provider || !historyProvider || !historyItemRef || historyItems.length === 0) {
      return;
    }
    const historyItem = historyItems[0];
    let title, historyItemId, historyItemParentId;
    if (historyItemRemoteRef && (historyItem.id === SCMIncomingHistoryItemId || historyItem.id === SCMOutgoingHistoryItemId)) {
      const mergeBase = await historyProvider.resolveHistoryItemRefsCommonAncestor([
        historyItemRef.name,
        historyItemRemoteRef.name
      ]);
      if (mergeBase && historyItem.id === SCMIncomingHistoryItemId) {
        title = `${historyItem.subject} - ${historyItemRef.name} \u2194 ${historyItemRemoteRef.name}`;
        historyItemId = historyItemRemoteRef.id;
        historyItemParentId = mergeBase;
      } else if (mergeBase && historyItem.id === SCMOutgoingHistoryItemId) {
        title = `${historyItem.subject} - ${historyItemRemoteRef.name} \u2194 ${historyItemRef.name}`;
        historyItemId = historyItemRef.id;
        historyItemParentId = mergeBase;
      }
    } else {
      title = getHistoryItemEditorTitle(historyItem);
      historyItemId = historyItem.id;
      if (historyItem.parentIds.length > 0) {
        if (historyItem.parentIds[0] === SCMIncomingHistoryItemId && historyItemRemoteRef) {
          historyItemParentId = await historyProvider.resolveHistoryItemRefsCommonAncestor([
            historyItemRef.name,
            historyItemRemoteRef.name
          ]);
        } else {
          historyItemParentId = historyItem.parentIds[0];
        }
      }
    }
    if (!title || !historyItemId || !historyItemParentId) {
      return;
    }
    const multiDiffSourceUri = ScmHistoryItemResolver.getMultiDiffSourceUri(provider, historyItemId, historyItemParentId, "");
    commandService.executeCommand("_workbench.openMultiDiffEditor", { title, multiDiffSourceUri });
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.scm.action.graph.openFile",
      title: localize("openFile", "Open File"),
      icon: Codicon.goToFile,
      f1: false,
      menu: [
        {
          id: MenuId.SCMHistoryItemChangeContext,
          group: "inline",
          order: 1
        },
        {
          id: MenuId.SCMHistoryItemChangeContext,
          group: "0_view",
          order: 1
        }
      ]
    });
  }
  async run(accessor, historyItem, historyItemChange) {
    const editorService = accessor.get(IEditorService);
    if (!historyItem || !historyItemChange.modifiedUri) {
      return;
    }
    let version;
    if (historyItem.id === SCMIncomingHistoryItemId) {
      version = localize("incomingChanges", "Incoming Changes");
    } else if (historyItem.id === SCMOutgoingHistoryItemId) {
      version = localize("outgoingChanges", "Outgoing Changes");
    } else {
      version = historyItem.displayId ?? historyItem.id;
    }
    const name = basename(historyItemChange.modifiedUri.fsPath);
    await editorService.openEditor({ resource: historyItemChange.modifiedUri, label: `${name} (${version})` });
  }
});
class ListDelegate {
  getHeight() {
    return 22;
  }
  getTemplateId(element) {
    if (isSCMHistoryItemViewModelTreeElement(element)) {
      return HistoryItemRenderer.TEMPLATE_ID;
    } else if (isSCMHistoryItemChangeViewModelTreeElement(element) || isSCMHistoryItemChangeNode(element)) {
      return HistoryItemChangeRenderer.TEMPLATE_ID;
    } else if (isSCMHistoryItemLoadMoreTreeElement(element)) {
      return HistoryItemLoadMoreRenderer.TEMPLATE_ID;
    } else {
      throw new Error("Unknown element");
    }
  }
}
let HistoryItemRenderer = class {
  constructor(_viewContainerLocation, _commandService, _configurationService, _contextKeyService, _contextMenuService, _hoverService, _keybindingService, _markdownRendererService, _menuService, _telemetryService) {
    this._viewContainerLocation = _viewContainerLocation;
    this._commandService = _commandService;
    this._configurationService = _configurationService;
    this._contextKeyService = _contextKeyService;
    this._contextMenuService = _contextMenuService;
    this._hoverService = _hoverService;
    this._keybindingService = _keybindingService;
    this._markdownRendererService = _markdownRendererService;
    this._menuService = _menuService;
    this._telemetryService = _telemetryService;
    this._badgesConfig = observableConfigValue("scm.graph.badges", "filter", this._configurationService);
  }
  static {
    this.TEMPLATE_ID = "history-item";
  }
  get templateId() {
    return HistoryItemRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    const element = append(container, $(".history-item"));
    const graphContainer = append(element, $(".graph-container"));
    const iconLabel = new IconLabel(element, {
      supportIcons: true,
      supportHighlights: true,
      supportDescriptionHighlights: true
    });
    const labelContainer = append(element, $(".label-container"));
    const actionsContainer = append(element, $(".actions"));
    const actionBar = new WorkbenchToolBar(actionsContainer, void 0, this._menuService, this._contextKeyService, this._contextMenuService, this._keybindingService, this._commandService, this._telemetryService);
    return { element, graphContainer, label: iconLabel, labelContainer, actionBar, elementDisposables: new DisposableStore(), disposables: combinedDisposable(iconLabel, actionBar) };
  }
  renderElement(node, index, templateData) {
    const provider = node.element.repository.provider;
    const historyItemViewModel = node.element.historyItemViewModel;
    const historyItem = historyItemViewModel.historyItem;
    const { content, disposables } = toHistoryItemHoverContent(this._markdownRendererService, historyItem, true);
    const { hoverOptions, hoverLifecycleOptions } = this._getHoverOptions();
    const historyItemHover = this._hoverService.setupDelayedHover(templateData.element, { ...hoverOptions, content }, hoverLifecycleOptions);
    templateData.elementDisposables.add(historyItemHover);
    templateData.elementDisposables.add(disposables);
    templateData.graphContainer.textContent = "";
    templateData.graphContainer.classList.toggle("current", historyItemViewModel.kind === "HEAD");
    templateData.graphContainer.classList.toggle("incoming-changes", historyItemViewModel.kind === "incoming-changes");
    templateData.graphContainer.classList.toggle("outgoing-changes", historyItemViewModel.kind === "outgoing-changes");
    templateData.graphContainer.appendChild(renderSCMHistoryItemGraph(historyItemViewModel));
    const historyItemRef = provider.historyProvider.get()?.historyItemRef?.get();
    const extraClasses = historyItemRef?.revision === historyItem.id ? ["history-item-current"] : [];
    const [matches, descriptionMatches] = this._processMatches(historyItemViewModel, node.filterData);
    templateData.label.setLabel(historyItem.subject, historyItem.author, { matches, descriptionMatches, extraClasses });
    this._renderBadges(historyItem, templateData);
    const actions = this._menuService.getMenuActions(
      MenuId.SCMHistoryItemContext,
      this._contextKeyService,
      { arg: provider, shouldForwardArgs: true }
    );
    templateData.actionBar.context = historyItem;
    templateData.actionBar.setActions(getActionBarActions(actions, "inline").primary);
  }
  renderCompressedElements(node, index, templateData) {
    throw new Error("Should never happen since node is incompressible");
  }
  _renderBadges(historyItem, templateData) {
    templateData.elementDisposables.add(autorun((reader) => {
      const labelConfig = this._badgesConfig.read(reader);
      templateData.labelContainer.replaceChildren();
      const references = historyItem.references ? historyItem.references.slice(0) : [];
      if (references.length > 0 && references[0].color) {
        this._renderBadge([references[0]], true, templateData);
        references.splice(0, 1);
      }
      const historyItemRefsByColor = groupBy2(references, (ref) => ref.color ? ref.color : "");
      for (const [key, historyItemRefs] of Object.entries(historyItemRefsByColor)) {
        if (key === "" && labelConfig !== "all") {
          continue;
        }
        if (!historyItemRefs) {
          continue;
        }
        const historyItemRefByIconId = groupBy2(historyItemRefs, (ref) => ThemeIcon.isThemeIcon(ref.icon) ? ref.icon.id : "");
        for (const [key2, historyItemRefs2] of Object.entries(historyItemRefByIconId)) {
          if (key2 === "" || !historyItemRefs2) {
            continue;
          }
          this._renderBadge(historyItemRefs2, false, templateData);
        }
      }
    }));
  }
  _renderBadge(historyItemRefs, showDescription, templateData) {
    if (historyItemRefs.length === 0 || !ThemeIcon.isThemeIcon(historyItemRefs[0].icon)) {
      return;
    }
    const elements = h("div.label", {
      style: {
        color: historyItemRefs[0].color ? asCssVariable(historyItemHoverLabelForeground) : asCssVariable(foreground),
        backgroundColor: historyItemRefs[0].color ? asCssVariable(historyItemRefs[0].color) : asCssVariable(historyItemHoverDefaultLabelBackground)
      }
    }, [
      h("div.count@count", {
        style: {
          display: historyItemRefs.length > 1 ? "" : "none"
        }
      }),
      h("div.icon@icon"),
      h("div.description@description", {
        style: {
          display: showDescription ? "" : "none"
        }
      })
    ]);
    elements.count.textContent = historyItemRefs.length > 1 ? historyItemRefs.length.toString() : "";
    elements.icon.classList.add(...ThemeIcon.asClassNameArray(historyItemRefs[0].icon));
    elements.description.textContent = showDescription ? historyItemRefs[0].name : "";
    append(templateData.labelContainer, elements.root);
  }
  _getHoverOptions() {
    if (this._viewContainerLocation === ViewContainerLocation.Panel) {
      return {
        hoverOptions: {
          additionalClasses: ["history-item-hover"],
          appearance: {
            compact: true
          },
          position: {
            hoverPosition: HoverPosition.RIGHT
          },
          style: HoverStyle.Mouse
        },
        hoverLifecycleOptions: void 0
      };
    }
    return {
      hoverOptions: {
        additionalClasses: ["history-item-hover"],
        appearance: {
          compact: true,
          showPointer: true
        },
        position: {
          hoverPosition: HoverPosition.RIGHT
        },
        style: HoverStyle.Pointer
      },
      hoverLifecycleOptions: {
        groupId: "scm-history-item"
      }
    };
  }
  _processMatches(historyItemViewModel, filterData) {
    if (!filterData) {
      return [void 0, void 0];
    }
    return [
      historyItemViewModel.historyItem.message === filterData.label ? createMatches(filterData.score) : void 0,
      historyItemViewModel.historyItem.author === filterData.label ? createMatches(filterData.score) : void 0
    ];
  }
  disposeElement(element, index, templateData) {
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.elementDisposables.dispose();
    templateData.disposables.dispose();
  }
};
HistoryItemRenderer = __decorateClass([
  __decorateParam(1, ICommandService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, IHoverService),
  __decorateParam(6, IKeybindingService),
  __decorateParam(7, IMarkdownRendererService),
  __decorateParam(8, IMenuService),
  __decorateParam(9, ITelemetryService)
], HistoryItemRenderer);
let HistoryItemChangeRenderer = class {
  constructor(viewMode, resourceLabels, _commandService, _contextKeyService, _contextMenuService, _keybindingService, _labelService, _menuService, _telemetryService) {
    this.viewMode = viewMode;
    this.resourceLabels = resourceLabels;
    this._commandService = _commandService;
    this._contextKeyService = _contextKeyService;
    this._contextMenuService = _contextMenuService;
    this._keybindingService = _keybindingService;
    this._labelService = _labelService;
    this._menuService = _menuService;
    this._telemetryService = _telemetryService;
  }
  static {
    this.TEMPLATE_ID = "history-item-change";
  }
  get templateId() {
    return HistoryItemChangeRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    const rowElement = container.parentElement;
    const element = append(container, $(".history-item-change"));
    const graphPlaceholder = append(element, $(".graph-placeholder"));
    const labelContainer = append(element, $(".label-container"));
    const resourceLabel = this.resourceLabels.create(labelContainer, {
      supportDescriptionHighlights: true,
      supportHighlights: true
    });
    const disposables = new DisposableStore();
    const actionsContainer = append(resourceLabel.element, $(".actions"));
    const actionBar = new WorkbenchToolBar(actionsContainer, void 0, this._menuService, this._contextKeyService, this._contextMenuService, this._keybindingService, this._commandService, this._telemetryService);
    disposables.add(actionBar);
    return { rowElement, element, graphPlaceholder, resourceLabel, actionBar, disposables };
  }
  renderElement(elementOrNode, index, templateData, details) {
    const historyItemViewModel = isSCMHistoryItemChangeViewModelTreeElement(elementOrNode.element) ? elementOrNode.element.historyItemViewModel : elementOrNode.element.context.historyItemViewModel;
    const historyItemChange = isSCMHistoryItemChangeViewModelTreeElement(elementOrNode.element) ? elementOrNode.element.historyItemChange : elementOrNode.element;
    const graphColumns = isSCMHistoryItemChangeViewModelTreeElement(elementOrNode.element) ? elementOrNode.element.graphColumns : elementOrNode.element.context.historyItemViewModel.outputSwimlanes;
    this._renderGraphPlaceholder(templateData, historyItemViewModel, graphColumns);
    const hidePath = this.viewMode() === ViewMode.Tree;
    const fileKind = isSCMHistoryItemChangeViewModelTreeElement(elementOrNode.element) ? FileKind.FILE : FileKind.FOLDER;
    templateData.resourceLabel.setFile(historyItemChange.uri, { fileDecorations: { colors: false, badges: true }, fileKind, hidePath });
    if (fileKind === FileKind.FILE) {
      const actions = this._menuService.getMenuActions(
        MenuId.SCMHistoryItemChangeContext,
        this._contextKeyService,
        { arg: historyItemViewModel.historyItem, shouldForwardArgs: true }
      );
      templateData.actionBar.context = historyItemChange;
      templateData.actionBar.setActions(getActionBarActions(actions, "inline").primary);
    } else {
      templateData.actionBar.context = void 0;
      templateData.actionBar.setActions([]);
    }
  }
  renderCompressedElements(node, index, templateData, details) {
    const compressed = node.element;
    const historyItemViewModel = compressed.elements[0].context.historyItemViewModel;
    const graphColumns = compressed.elements[0].context.historyItemViewModel.outputSwimlanes;
    this._renderGraphPlaceholder(templateData, historyItemViewModel, graphColumns);
    const label = compressed.elements.map((e) => e.name);
    const folder = compressed.elements[compressed.elements.length - 1];
    templateData.resourceLabel.setResource({ resource: folder.uri, name: label }, {
      fileDecorations: { colors: false, badges: true },
      fileKind: FileKind.FOLDER,
      separator: this._labelService.getSeparator(folder.uri.scheme)
    });
    templateData.actionBar.context = void 0;
    templateData.actionBar.setActions([]);
  }
  _renderGraphPlaceholder(templateData, historyItemViewModel, graphColumns) {
    const graphPlaceholderSvgWidth = SWIMLANE_WIDTH * (graphColumns.length + 1);
    const marginLeft = graphPlaceholderSvgWidth - 16;
    templateData.rowElement.style.marginLeft = `${marginLeft}px`;
    templateData.graphPlaceholder.textContent = "";
    templateData.graphPlaceholder.style.left = `${-1 * marginLeft}px`;
    templateData.graphPlaceholder.style.width = `${graphPlaceholderSvgWidth}px`;
    templateData.graphPlaceholder.appendChild(renderSCMHistoryGraphPlaceholder(graphColumns, getHistoryItemIndex(historyItemViewModel)));
  }
  disposeTemplate(templateData) {
    templateData.disposables.dispose();
  }
};
HistoryItemChangeRenderer = __decorateClass([
  __decorateParam(2, ICommandService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, IKeybindingService),
  __decorateParam(6, ILabelService),
  __decorateParam(7, IMenuService),
  __decorateParam(8, ITelemetryService)
], HistoryItemChangeRenderer);
let HistoryItemLoadMoreRenderer = class {
  constructor(_isLoadingMore, _loadMoreCallback, _configurationService) {
    this._isLoadingMore = _isLoadingMore;
    this._loadMoreCallback = _loadMoreCallback;
    this._configurationService = _configurationService;
  }
  static {
    this.TEMPLATE_ID = "historyItemLoadMore";
  }
  get templateId() {
    return HistoryItemLoadMoreRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    const element = append(container, $(".history-item-load-more"));
    const graphPlaceholder = append(element, $(".graph-placeholder"));
    const historyItemPlaceholderContainer = append(element, $(".history-item-placeholder"));
    const historyItemPlaceholderLabel = new IconLabel(historyItemPlaceholderContainer, { supportIcons: true });
    return { element, graphPlaceholder, historyItemPlaceholderContainer, historyItemPlaceholderLabel, elementDisposables: new DisposableStore(), disposables: historyItemPlaceholderLabel };
  }
  renderElement(element, index, templateData) {
    templateData.graphPlaceholder.textContent = "";
    templateData.graphPlaceholder.style.width = `${SWIMLANE_WIDTH * (element.element.graphColumns.length + 1)}px`;
    templateData.graphPlaceholder.appendChild(renderSCMHistoryGraphPlaceholder(element.element.graphColumns));
    const pageOnScroll = this._configurationService.getValue("scm.graph.pageOnScroll") === true;
    templateData.historyItemPlaceholderContainer.classList.toggle("shimmer", pageOnScroll);
    if (pageOnScroll) {
      templateData.historyItemPlaceholderLabel.setLabel("");
      this._loadMoreCallback();
    } else {
      templateData.elementDisposables.add(autorun((reader) => {
        const isLoadingMore = this._isLoadingMore.read(reader);
        const icon = `$(${isLoadingMore ? "loading~spin" : "fold-down"})`;
        templateData.historyItemPlaceholderLabel.setLabel(localize("loadMore", "{0} Load More...", icon));
      }));
    }
  }
  renderCompressedElements(node, index, templateData) {
    throw new Error("Should never happen since node is incompressible");
  }
  disposeElement(element, index, templateData) {
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.elementDisposables.dispose();
    templateData.disposables.dispose();
  }
};
HistoryItemLoadMoreRenderer = __decorateClass([
  __decorateParam(2, IConfigurationService)
], HistoryItemLoadMoreRenderer);
let SCMHistoryViewPaneActionRunner = class extends ActionRunner {
  constructor(_progressService) {
    super();
    this._progressService = _progressService;
  }
  runAction(action, context) {
    return this._progressService.withProgress(
      { location: HISTORY_VIEW_PANE_ID },
      async () => await super.runAction(action, context)
    );
  }
};
SCMHistoryViewPaneActionRunner = __decorateClass([
  __decorateParam(0, IProgressService)
], SCMHistoryViewPaneActionRunner);
class SCMHistoryTreeAccessibilityProvider {
  getWidgetAriaLabel() {
    return localize("scm history", "Source Control History");
  }
  getAriaLabel(element) {
    if (isSCMRepository(element)) {
      return `${element.provider.name} ${element.provider.label}`;
    } else if (isSCMHistoryItemViewModelTreeElement(element)) {
      const historyItem = element.historyItemViewModel.historyItem;
      return `${stripIcons(historyItem.message).trim()}${historyItem.author ? `, ${historyItem.author}` : ""}`;
    } else {
      return "";
    }
  }
}
class SCMHistoryTreeIdentityProvider {
  getId(element) {
    if (isSCMRepository(element)) {
      const provider = element.provider;
      return `repo:${provider.id}`;
    } else if (isSCMHistoryItemViewModelTreeElement(element)) {
      const provider = element.repository.provider;
      const historyItem = element.historyItemViewModel.historyItem;
      return `historyItem:${provider.id}/${historyItem.id}/${historyItem.parentIds.join(",")}`;
    } else if (isSCMHistoryItemChangeViewModelTreeElement(element)) {
      const provider = element.repository.provider;
      const historyItem = element.historyItemViewModel.historyItem;
      return `historyItemChange:${provider.id}/${historyItem.id}/${historyItem.parentIds.join(",")}/${element.historyItemChange.uri.fsPath}`;
    } else if (isSCMHistoryItemChangeNode(element)) {
      const provider = element.context.repository.provider;
      const historyItem = element.context.historyItemViewModel.historyItem;
      return `historyItemChangeFolder:${provider.id}/${historyItem.id}/${historyItem.parentIds.join(",")}/${element.uri.fsPath}`;
    } else if (isSCMHistoryItemLoadMoreTreeElement(element)) {
      const provider = element.repository.provider;
      return `historyItemLoadMore:${provider.id}`;
    } else {
      throw new Error("Invalid tree element");
    }
  }
}
class SCMHistoryTreeKeyboardNavigationLabelProvider {
  getKeyboardNavigationLabel(element) {
    if (isSCMRepository(element)) {
      return void 0;
    } else if (isSCMHistoryItemViewModelTreeElement(element)) {
      return [element.historyItemViewModel.historyItem.message, element.historyItemViewModel.historyItem.author];
    } else if (isSCMHistoryItemLoadMoreTreeElement(element)) {
      return "";
    } else {
      throw new Error("Invalid tree element");
    }
  }
  getCompressedNodeKeyboardNavigationLabel(elements) {
    const folders = elements;
    return folders.map((e) => e.name).join("/");
  }
}
class SCMHistoryTreeCompressionDelegate {
  isIncompressible(element) {
    if (ResourceTree.isResourceNode(element)) {
      return element.childrenCount === 0 || !element.parent || !element.parent.parent;
    }
    return true;
  }
}
class SCMHistoryTreeDataSource extends Disposable {
  constructor(viewMode) {
    super();
    this.viewMode = viewMode;
  }
  async getChildren(inputOrElement) {
    const children = [];
    if (inputOrElement instanceof SCMHistoryViewModel) {
      const historyItems = await inputOrElement.getHistoryItems();
      children.push(...historyItems);
      const repository = inputOrElement.repository.get();
      const lastHistoryItem = historyItems.at(-1);
      if (repository && lastHistoryItem && lastHistoryItem.historyItemViewModel.outputSwimlanes.length > 0) {
        children.push({
          repository,
          graphColumns: lastHistoryItem.historyItemViewModel.outputSwimlanes,
          type: "historyItemLoadMore"
        });
      }
    } else if (isSCMHistoryItemViewModelTreeElement(inputOrElement)) {
      const historyProvider = inputOrElement.repository.provider.historyProvider.get();
      const historyItemViewModel = inputOrElement.historyItemViewModel;
      const historyItem = historyItemViewModel.historyItem;
      let historyItemId, historyItemParentId;
      if (historyItemViewModel.kind === "incoming-changes" || historyItemViewModel.kind === "outgoing-changes") {
        const historyItemRef = historyProvider?.historyItemRef.get();
        const historyItemRemoteRef = historyProvider?.historyItemRemoteRef.get();
        if (!historyProvider || !historyItemRef || !historyItemRemoteRef) {
          return [];
        }
        historyItemId = historyItemViewModel.kind === "incoming-changes" ? historyItemRemoteRef.id : historyItemRef.id;
        historyItemParentId = await historyProvider.resolveHistoryItemRefsCommonAncestor([
          historyItemRef.name,
          historyItemRemoteRef.name
        ]);
      } else {
        historyItemId = historyItem.id;
        if (historyItem.parentIds.length > 0) {
          if (historyItem.parentIds[0] === SCMIncomingHistoryItemId) {
            const historyItemRef = historyProvider?.historyItemRef.get();
            const historyItemRemoteRef = historyProvider?.historyItemRemoteRef.get();
            if (!historyProvider || !historyItemRef || !historyItemRemoteRef) {
              return [];
            }
            historyItemParentId = await historyProvider.resolveHistoryItemRefsCommonAncestor([
              historyItemRef.name,
              historyItemRemoteRef.name
            ]);
          } else {
            historyItemParentId = historyItem.parentIds[0];
          }
        }
      }
      const historyItemChanges = await historyProvider?.provideHistoryItemChanges(historyItemId, historyItemParentId) ?? [];
      if (this.viewMode() === ViewMode.List) {
        children.push(...historyItemChanges.map((change) => ({
          repository: inputOrElement.repository,
          historyItemViewModel: inputOrElement.historyItemViewModel,
          historyItemChange: change,
          graphColumns: inputOrElement.historyItemViewModel.outputSwimlanes,
          type: "historyItemChangeViewModel"
        })));
      } else if (this.viewMode() === ViewMode.Tree) {
        const rootUri = inputOrElement.repository.provider.rootUri ?? URI.file("/");
        const historyItemChangesTree = new ResourceTree(inputOrElement, rootUri);
        for (const change of historyItemChanges) {
          historyItemChangesTree.add(change.uri, {
            repository: inputOrElement.repository,
            historyItemViewModel: inputOrElement.historyItemViewModel,
            historyItemChange: change,
            graphColumns: inputOrElement.historyItemViewModel.outputSwimlanes,
            type: "historyItemChangeViewModel"
          });
        }
        for (const node of historyItemChangesTree.root.children) {
          children.push(node.element ?? node);
        }
      }
    } else if (ResourceTree.isResourceNode(inputOrElement) && isSCMHistoryItemChangeNode(inputOrElement)) {
      for (const node of inputOrElement.children) {
        children.push(node.element && node.childrenCount === 0 ? node.element : node);
      }
    }
    return children;
  }
  hasChildren(inputOrElement) {
    return inputOrElement instanceof SCMHistoryViewModel || isSCMHistoryItemViewModelTreeElement(inputOrElement) || isSCMHistoryItemChangeNode(inputOrElement) && inputOrElement.childrenCount > 0;
  }
}
class SCMHistoryTreeDragAndDrop {
  getDragURI(element) {
    const uri = this._getTreeElementUri(element);
    return uri ? uri.toString() : null;
  }
  onDragStart(data, originalEvent) {
    if (!originalEvent.dataTransfer) {
      return;
    }
    const historyItems = this._getDragAndDropData(data);
    if (historyItems.length === 0) {
      return;
    }
    originalEvent.dataTransfer.setData(CodeDataTransfers.SCM_HISTORY_ITEM, JSON.stringify(historyItems));
  }
  getDragLabel(elements, originalEvent) {
    if (elements.length === 1) {
      const element = elements[0];
      return this._getTreeElementLabel(element);
    }
    return String(elements.length);
  }
  onDragOver(data, targetElement, targetIndex, targetSector, originalEvent) {
    return false;
  }
  drop(data, targetElement, targetIndex, targetSector, originalEvent) {
  }
  _getDragAndDropData(data) {
    const historyItems = [];
    for (const element of [...data.context ?? [], ...data.elements]) {
      if (!isSCMHistoryItemViewModelTreeElement(element)) {
        continue;
      }
      const provider = element.repository.provider;
      const historyItem = element.historyItemViewModel.historyItem;
      const attachmentName = `$(${Codicon.repo.id})\xA0${provider.name}\xA0$(${Codicon.gitCommit.id})\xA0${historyItem.displayId ?? historyItem.id}`;
      const historyItemParentId = historyItem.parentIds.length > 0 ? historyItem.parentIds[0] : void 0;
      historyItems.push({
        name: attachmentName,
        resource: ScmHistoryItemResolver.getMultiDiffSourceUri(provider, historyItem.id, historyItemParentId, historyItem.displayId),
        historyItem
      });
    }
    return historyItems;
  }
  _getTreeElementLabel(element) {
    if (isSCMHistoryItemViewModelTreeElement(element)) {
      const historyItem = element.historyItemViewModel.historyItem;
      return historyItem.displayId ?? historyItem.id;
    }
    return void 0;
  }
  _getTreeElementUri(element) {
    if (isSCMHistoryItemViewModelTreeElement(element)) {
      const provider = element.repository.provider;
      const historyItem = element.historyItemViewModel.historyItem;
      const historyItemParentId = historyItem.parentIds.length > 0 ? historyItem.parentIds[0] : void 0;
      return ScmHistoryItemResolver.getMultiDiffSourceUri(provider, historyItem.id, historyItemParentId, historyItem.displayId);
    }
    return void 0;
  }
  dispose() {
  }
}
let SCMHistoryViewModel = class extends Disposable {
  constructor(_configurationService, _contextKeyService, _extensionService, _scmService, _scmViewService, _storageService) {
    super();
    this._configurationService = _configurationService;
    this._contextKeyService = _contextKeyService;
    this._extensionService = _extensionService;
    this._scmService = _scmService;
    this._scmViewService = _scmViewService;
    this._storageService = _storageService;
    this._selectedRepository = observableValue(this, "auto");
    this.onDidChangeHistoryItemsFilter = observableSignal(this);
    this.isViewModelEmpty = observableValue(this, false);
    this._repositoryState = /* @__PURE__ */ new Map();
    this._repositoryFilterState = /* @__PURE__ */ new Map();
    this._repositoryFilterState = this._loadHistoryItemsFilterState();
    this.viewMode = observableValue(this, this._getViewMode());
    this._extensionService.onWillStop(this._saveHistoryItemsFilterState, this, this._store);
    this._storageService.onWillSaveState(this._saveHistoryItemsFilterState, this, this._store);
    this._scmHistoryItemCountCtx = ContextKeys.SCMHistoryItemCount.bindTo(this._contextKeyService);
    this._scmHistoryViewModeCtx = ContextKeys.SCMHistoryViewMode.bindTo(this._contextKeyService);
    this._scmHistoryViewModeCtx.set(this.viewMode.get());
    const firstRepository = this._scmService.repositoryCount > 0 ? constObservable(Iterable.first(this._scmService.repositories)) : observableFromEvent(
      this,
      Event.once(this._scmService.onDidAddRepository),
      (repository) => repository
    );
    const graphRepository = derived((reader) => {
      const selectedRepository = this._selectedRepository.read(reader);
      if (selectedRepository !== "auto") {
        return selectedRepository;
      }
      return this._scmViewService.activeRepository.read(reader)?.repository;
    });
    this.repository = latestChangedValue(this, [firstRepository, graphRepository]);
    const closedRepository = observableFromEvent(
      this,
      this._scmService.onDidRemoveRepository,
      (repository) => repository
    );
    this._register(autorun((reader) => {
      const repository = closedRepository.read(reader);
      if (!repository) {
        return;
      }
      if (this.repository.read(void 0) === repository) {
        this._selectedRepository.set(Iterable.first(this._scmService.repositories) ?? "auto", void 0);
      }
      this._repositoryState.delete(repository);
    }));
  }
  clearRepositoryState() {
    const repository = this.repository.get();
    if (!repository) {
      return;
    }
    this._repositoryState.delete(repository);
  }
  getHistoryItemsFilter() {
    const repository = this.repository.get();
    if (!repository) {
      return;
    }
    const filterState = this._repositoryFilterState.get(getProviderKey(repository.provider)) ?? "auto";
    if (filterState === "all" || filterState === "auto") {
      return filterState;
    }
    const repositoryState = this._repositoryState.get(repository);
    return repositoryState?.historyItemsFilter;
  }
  getCurrentHistoryItemTreeElement() {
    const repository = this.repository.get();
    if (!repository) {
      return void 0;
    }
    const state = this._repositoryState.get(repository);
    if (!state) {
      return void 0;
    }
    const historyProvider = repository?.provider.historyProvider.get();
    const historyItemRef = historyProvider?.historyItemRef.get();
    return state.viewModels.find((viewModel) => viewModel.historyItemViewModel.historyItem.id === historyItemRef?.revision);
  }
  loadMore(cursor) {
    const repository = this.repository.get();
    if (!repository) {
      return;
    }
    const state = this._repositoryState.get(repository);
    if (!state) {
      return;
    }
    this._repositoryState.set(repository, { ...state, loadMore: cursor ?? true });
  }
  async getHistoryItems() {
    const repository = this.repository.get();
    const historyProvider = repository?.provider.historyProvider.get();
    const historyItemRef = historyProvider?.historyItemRef.get();
    const historyItemRemoteRef = historyProvider?.historyItemRemoteRef.get();
    if (!repository || !historyProvider) {
      this._scmHistoryItemCountCtx.set(0);
      this.isViewModelEmpty.set(true, void 0);
      return [];
    }
    let state = this._repositoryState.get(repository);
    if (!state || state.loadMore !== false) {
      const historyItems = state?.viewModels.filter((vm) => vm.historyItemViewModel.kind !== "incoming-changes" && vm.historyItemViewModel.kind !== "outgoing-changes").map((vm) => vm.historyItemViewModel.historyItem) ?? [];
      const historyItemRefs = state?.historyItemsFilter ?? await this._resolveHistoryItemFilter(repository, historyProvider);
      const limit = clamp(this._configurationService.getValue("scm.graph.pageSize"), 1, 1e3);
      const historyItemRefIds = historyItemRefs.map((ref) => ref.revision ?? ref.id);
      do {
        historyItems.push(...await historyProvider.provideHistoryItems({
          historyItemRefs: historyItemRefIds,
          limit,
          skip: historyItems.length
        }) ?? []);
      } while (typeof state?.loadMore === "string" && !historyItems.find((item) => item.id === state?.loadMore));
      const mergeBase = historyItemRef && historyItemRemoteRef && state?.mergeBase === void 0 ? await historyProvider.resolveHistoryItemRefsCommonAncestor([
        historyItemRef.name,
        historyItemRemoteRef.name
      ]) : state?.mergeBase;
      const colorMap = this._getGraphColorMap(historyItemRefs);
      const addIncomingChangesNode = this._scmViewService.graphShowIncomingChangesConfig.get() && historyItemRefs.some((ref) => ref.id === historyItemRemoteRef?.id);
      const addOutgoingChangesNode = this._scmViewService.graphShowOutgoingChangesConfig.get() && historyItemRefs.some((ref) => ref.id === historyItemRef?.id);
      const viewModels = toISCMHistoryItemViewModelArray(
        historyItems,
        colorMap,
        historyProvider.historyItemRef.get(),
        historyProvider.historyItemRemoteRef.get(),
        historyProvider.historyItemBaseRef.get(),
        addIncomingChangesNode,
        addOutgoingChangesNode,
        mergeBase
      ).map((historyItemViewModel) => ({
        repository,
        historyItemViewModel,
        type: "historyItemViewModel"
      }));
      state = { historyItemsFilter: historyItemRefs, viewModels, mergeBase, loadMore: false };
      this._repositoryState.set(repository, state);
      this._scmHistoryItemCountCtx.set(viewModels.length);
      this.isViewModelEmpty.set(viewModels.length === 0, void 0);
    }
    return state.viewModels;
  }
  setRepository(repository) {
    this._selectedRepository.set(repository, void 0);
  }
  setHistoryItemsFilter(filter) {
    const repository = this.repository.get();
    if (!repository) {
      return;
    }
    if (filter !== "auto") {
      this._repositoryFilterState.set(getProviderKey(repository.provider), filter);
    } else {
      this._repositoryFilterState.delete(getProviderKey(repository.provider));
    }
    this._saveHistoryItemsFilterState();
    this.onDidChangeHistoryItemsFilter.trigger(void 0);
  }
  setViewMode(viewMode) {
    if (viewMode === this.viewMode.get()) {
      return;
    }
    this.viewMode.set(viewMode, void 0);
    this._scmHistoryViewModeCtx.set(viewMode);
    this._storageService.store("scm.graphView.viewMode", viewMode, StorageScope.WORKSPACE, StorageTarget.USER);
  }
  _getViewMode() {
    let mode = this._configurationService.getValue("scm.defaultViewMode") === "list" ? ViewMode.List : ViewMode.Tree;
    const storageMode = this._storageService.get("scm.graphView.viewMode", StorageScope.WORKSPACE);
    if (typeof storageMode === "string") {
      mode = storageMode;
    }
    return mode;
  }
  _getGraphColorMap(historyItemRefs) {
    const repository = this.repository.get();
    const historyProvider = repository?.provider.historyProvider.get();
    const historyItemRef = historyProvider?.historyItemRef.get();
    const historyItemRemoteRef = historyProvider?.historyItemRemoteRef.get();
    const historyItemBaseRef = historyProvider?.historyItemBaseRef.get();
    const colorMap = /* @__PURE__ */ new Map();
    if (historyItemRef) {
      colorMap.set(historyItemRef.id, historyItemRef.color);
      if (historyItemRemoteRef) {
        colorMap.set(historyItemRemoteRef.id, historyItemRemoteRef.color);
      }
      if (historyItemBaseRef) {
        colorMap.set(historyItemBaseRef.id, historyItemBaseRef.color);
      }
    }
    for (const ref of historyItemRefs) {
      if (!colorMap.has(ref.id)) {
        colorMap.set(ref.id, void 0);
      }
    }
    return colorMap;
  }
  async _resolveHistoryItemFilter(repository, historyProvider) {
    const historyItemRefs = [];
    const historyItemsFilter = this._repositoryFilterState.get(getProviderKey(repository.provider)) ?? "auto";
    switch (historyItemsFilter) {
      case "all":
        historyItemRefs.push(...await historyProvider.provideHistoryItemRefs() ?? []);
        break;
      case "auto":
        historyItemRefs.push(...[
          historyProvider.historyItemRef.get(),
          historyProvider.historyItemRemoteRef.get(),
          historyProvider.historyItemBaseRef.get()
        ].filter((ref) => !!ref));
        break;
      default: {
        const refs = (await historyProvider.provideHistoryItemRefs(historyItemsFilter) ?? []).filter((ref) => historyItemsFilter.some((filter) => filter === ref.id));
        if (refs.length === 0) {
          historyItemRefs.push(...[
            historyProvider.historyItemRef.get(),
            historyProvider.historyItemRemoteRef.get(),
            historyProvider.historyItemBaseRef.get()
          ].filter((ref) => !!ref));
          this._repositoryFilterState.delete(getProviderKey(repository.provider));
        } else {
          historyItemRefs.push(...refs);
          this._repositoryFilterState.set(getProviderKey(repository.provider), refs.map((ref) => ref.id));
        }
        this._saveHistoryItemsFilterState();
        break;
      }
    }
    return historyItemRefs;
  }
  _loadHistoryItemsFilterState() {
    try {
      const filterData = this._storageService.get("scm.graphView.referencesFilter", StorageScope.WORKSPACE);
      if (filterData) {
        return new Map(JSON.parse(filterData));
      }
    } catch {
    }
    return /* @__PURE__ */ new Map();
  }
  _saveHistoryItemsFilterState() {
    const filter = Array.from(this._repositoryFilterState.entries());
    this._storageService.store("scm.graphView.referencesFilter", JSON.stringify(filter), StorageScope.WORKSPACE, StorageTarget.USER);
  }
  dispose() {
    this._repositoryState.clear();
    super.dispose();
  }
};
SCMHistoryViewModel = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IExtensionService),
  __decorateParam(3, ISCMService),
  __decorateParam(4, ISCMViewService),
  __decorateParam(5, IStorageService)
], SCMHistoryViewModel);
let RepositoryPicker = class {
  constructor(_quickInputService, _scmViewService) {
    this._quickInputService = _quickInputService;
    this._scmViewService = _scmViewService;
    this._autoQuickPickItem = {
      label: localize("auto", "Auto"),
      description: localize("activeRepository", "Show the source control graph for the active repository"),
      repository: "auto"
    };
  }
  async pickRepository() {
    const picks = [
      this._autoQuickPickItem,
      { type: "separator" }
    ];
    picks.push(...this._scmViewService.repositories.map((r) => ({
      label: r.provider.name,
      description: r.provider.rootUri?.fsPath,
      iconClass: ThemeIcon.isThemeIcon(r.provider.iconPath) ? ThemeIcon.asClassName(r.provider.iconPath) : ThemeIcon.asClassName(Codicon.repo),
      repository: r
    })));
    return this._quickInputService.pick(picks, {
      placeHolder: localize("scmGraphRepository", "Select the repository to view, type to filter all repositories")
    });
  }
};
RepositoryPicker = __decorateClass([
  __decorateParam(0, IQuickInputService),
  __decorateParam(1, ISCMViewService)
], RepositoryPicker);
let HistoryItemRefPicker = class extends Disposable {
  constructor(_historyProvider, _historyItemsFilter, _quickInputService) {
    super();
    this._historyProvider = _historyProvider;
    this._historyItemsFilter = _historyItemsFilter;
    this._quickInputService = _quickInputService;
    this._allQuickPickItem = {
      id: "all",
      label: localize("all", "All"),
      description: localize("allHistoryItemRefs", "All history item references"),
      historyItemRef: "all"
    };
    this._autoQuickPickItem = {
      id: "auto",
      label: localize("auto", "Auto"),
      description: localize("currentHistoryItemRef", "Current history item reference(s)"),
      historyItemRef: "auto"
    };
  }
  async pickHistoryItemRef() {
    const quickPick = this._quickInputService.createQuickPick({ useSeparators: true });
    this._store.add(quickPick);
    quickPick.placeholder = localize("scmGraphHistoryItemRef", "Select one/more history item references to view, type to filter");
    quickPick.canSelectMany = true;
    quickPick.hideCheckAll = true;
    quickPick.busy = true;
    quickPick.show();
    const items = await this._createQuickPickItems();
    let selectedItems = [];
    if (this._historyItemsFilter === "all") {
      selectedItems.push(this._allQuickPickItem);
    } else if (this._historyItemsFilter === "auto") {
      selectedItems.push(this._autoQuickPickItem);
    } else {
      let index = 0;
      while (index < items.length) {
        if (items[index].type === "separator") {
          index++;
          continue;
        }
        if (this._historyItemsFilter.some((ref) => ref.id === items[index].id)) {
          const item = items.splice(index, 1);
          selectedItems.push(...item);
        } else {
          index++;
        }
      }
      items.splice(2, 0, { type: "separator" }, ...selectedItems);
    }
    quickPick.items = items;
    quickPick.selectedItems = selectedItems;
    quickPick.busy = false;
    return new Promise((resolve) => {
      this._store.add(quickPick.onDidChangeSelection((items2) => {
        const { added } = delta(selectedItems, items2, (a, b) => compare(a.id ?? "", b.id ?? ""));
        if (added.length > 0) {
          if (added[0].historyItemRef === "all" || added[0].historyItemRef === "auto") {
            quickPick.selectedItems = [added[0]];
          } else {
            quickPick.selectedItems = [...quickPick.selectedItems.filter((i) => i.historyItemRef !== "all" && i.historyItemRef !== "auto")];
          }
        }
        selectedItems = [...quickPick.selectedItems];
      }));
      this._store.add(quickPick.onDidAccept(() => {
        if (selectedItems.length === 0) {
          resolve(void 0);
        } else if (selectedItems.length === 1 && selectedItems[0].historyItemRef === "all") {
          resolve("all");
        } else if (selectedItems.length === 1 && selectedItems[0].historyItemRef === "auto") {
          resolve("auto");
        } else {
          resolve(selectedItems.map((item) => item.historyItemRef.id));
        }
        quickPick.hide();
      }));
      this._store.add(quickPick.onDidHide(() => {
        resolve(void 0);
        this.dispose();
      }));
    });
  }
  async _createQuickPickItems() {
    const picks = [
      this._allQuickPickItem,
      this._autoQuickPickItem
    ];
    const historyItemRefs = await this._historyProvider.provideHistoryItemRefs() ?? [];
    const historyItemRefsByCategory = groupBy(historyItemRefs, (a, b) => compare(a.category ?? "", b.category ?? ""));
    for (const refs of historyItemRefsByCategory) {
      if (refs.length === 0) {
        continue;
      }
      picks.push({ type: "separator", label: refs[0].category });
      picks.push(...refs.map((ref) => {
        return {
          id: ref.id,
          label: ref.name,
          description: ref.description,
          iconClass: ThemeIcon.isThemeIcon(ref.icon) ? ThemeIcon.asClassName(ref.icon) : void 0,
          historyItemRef: ref
        };
      }));
    }
    return picks;
  }
};
HistoryItemRefPicker = __decorateClass([
  __decorateParam(2, IQuickInputService)
], HistoryItemRefPicker);
let SCMHistoryViewPane = class extends ViewPane {
  constructor(options, _editorService, _instantiationService, _menuService, _progressService, _scmViewService, configurationService, contextMenuService, keybindingService, instantiationService, viewDescriptorService, contextKeyService, openerService, themeService, hoverService) {
    super({
      ...options,
      titleMenuId: MenuId.SCMHistoryTitle,
      showActions: ViewPaneShowActions.WhenExpanded
    }, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this._editorService = _editorService;
    this._instantiationService = _instantiationService;
    this._menuService = _menuService;
    this._progressService = _progressService;
    this._scmViewService = _scmViewService;
    this._repositoryIsLoadingMore = observableValue(this, false);
    this._repositoryOutdated = observableValue(this, false);
    this._visibilityDisposables = new DisposableStore();
    this._treeOperationSequencer = new Sequencer();
    this._treeLoadMoreSequencer = new Sequencer();
    this._refreshThrottler = new Throttler();
    this._updateChildrenThrottler = new Throttler();
    this._contextMenuDisposables = new MutableDisposable();
    this._scmProviderCtx = ContextKeys.SCMProvider.bindTo(this.scopedContextKeyService);
    this._scmCurrentHistoryItemRefHasRemote = ContextKeys.SCMCurrentHistoryItemRefHasRemote.bindTo(this.scopedContextKeyService);
    this._scmCurrentHistoryItemRefHasBase = ContextKeys.SCMCurrentHistoryItemRefHasBase.bindTo(this.scopedContextKeyService);
    this._scmCurrentHistoryItemRefInFilter = ContextKeys.SCMCurrentHistoryItemRefInFilter.bindTo(this.scopedContextKeyService);
    this._actionRunner = this.instantiationService.createInstance(SCMHistoryViewPaneActionRunner);
    this._register(this._actionRunner);
    this._register(this._refreshThrottler);
    this._register(this._updateChildrenThrottler);
  }
  renderHeaderTitle(container) {
    super.renderHeaderTitle(container, this.title);
    const element = h("div.scm-graph-view-badge-container", [
      h("div.scm-graph-view-badge.monaco-count-badge.long@badge")
    ]);
    element.badge.textContent = "Outdated";
    container.appendChild(element.root);
    this._register(autorun((reader) => {
      const outdated = this._repositoryOutdated.read(reader);
      element.root.style.display = outdated ? "" : "none";
      if (outdated) {
        reader.store.add(this.hoverService.setupDelayedHover(element.root, {
          appearance: {
            compact: true,
            showPointer: true
          },
          content: new MarkdownString(localize("scmGraphViewOutdated", "Please refresh the graph using the refresh action ({0}).", "$(refresh)"), { supportThemeIcons: true }),
          position: {
            hoverPosition: HoverPosition.BELOW
          }
        }));
      }
    }));
  }
  renderBody(container) {
    super.renderBody(container);
    this._treeContainer = append(container, $(".scm-view.scm-history-view.show-file-icons"));
    this._treeContainer.classList.add("file-icon-themable-tree");
    this._createTree(this._treeContainer);
    this.onDidChangeBodyVisibility(async (visible) => {
      if (!visible) {
        this._visibilityDisposables.clear();
        return;
      }
      this._treeViewModel = this.instantiationService.createInstance(SCMHistoryViewModel);
      this._visibilityDisposables.add(this._treeViewModel);
      const firstRepositoryInitialized = derived(this, (reader) => {
        const repository = this._treeViewModel.repository.read(reader);
        const historyProvider = repository?.provider.historyProvider.read(reader);
        const historyItemRef = historyProvider?.historyItemRef.read(reader);
        return historyItemRef !== void 0 ? true : void 0;
      });
      await waitForState(firstRepositoryInitialized);
      await this._progressService.withProgress({ location: this.id }, async () => {
        await this._treeOperationSequencer.queue(async () => {
          await this._tree.setInput(this._treeViewModel);
          this._tree.scrollTop = 0;
        });
      });
      this._visibilityDisposables.add(autorun((reader) => {
        this._treeViewModel.isViewModelEmpty.read(reader);
        this._onDidChangeViewWelcomeState.fire();
      }));
      this._visibilityDisposables.add(runOnChange(this._scmViewService.graphShowIncomingChangesConfig, async () => {
        await this.refresh();
      }));
      this._visibilityDisposables.add(runOnChange(this._scmViewService.graphShowOutgoingChangesConfig, async () => {
        await this.refresh();
      }));
      let isFirstRun = true;
      this._visibilityDisposables.add(autorun((reader) => {
        const repository = this._treeViewModel.repository.read(reader);
        const historyProvider = repository?.provider.historyProvider.read(reader);
        if (!repository || !historyProvider) {
          return;
        }
        const historyItemRefId = derived((reader2) => {
          return historyProvider.historyItemRef.read(reader2)?.id;
        });
        reader.store.add(runOnChange(historyItemRefId, async (historyItemRefIdValue) => {
          await this.refresh();
          this._scmCurrentHistoryItemRefInFilter.set(this._isCurrentHistoryItemInFilter(historyItemRefIdValue));
        }));
        reader.store.add(runOnChange(historyProvider.historyItemRefChanges, (changes) => {
          if (changes.silent) {
            if (this._tree.scrollTop === 0) {
              this.refresh();
              return;
            }
            this._repositoryOutdated.set(true, void 0);
            return;
          }
          this.refresh();
        }));
        reader.store.add(runOnChange(this._treeViewModel.onDidChangeHistoryItemsFilter, async () => {
          await this.refresh();
          this._scmCurrentHistoryItemRefInFilter.set(this._isCurrentHistoryItemInFilter(historyItemRefId.read(void 0)));
        }));
        reader.store.add(autorun((reader2) => {
          this._scmCurrentHistoryItemRefHasRemote.set(!!historyProvider.historyItemRemoteRef.read(reader2));
        }));
        reader.store.add(autorun((reader2) => {
          this._scmCurrentHistoryItemRefHasBase.set(!!historyProvider.historyItemBaseRef.read(reader2));
        }));
        reader.store.add(runOnChange(this._treeViewModel.viewMode, async () => {
          await this._updateChildren();
        }));
        this._scmProviderCtx.set(repository.provider.providerId);
        this._scmCurrentHistoryItemRefInFilter.set(this._isCurrentHistoryItemInFilter(historyItemRefId.read(void 0)));
        if (!isFirstRun) {
          this.refresh();
        }
        isFirstRun = false;
      }));
      const fileIconThemeObs = observableFromEvent(
        this.themeService.onDidFileIconThemeChange,
        () => this.themeService.getFileIconTheme()
      );
      this._visibilityDisposables.add(autorun((reader) => {
        const fileIconTheme = fileIconThemeObs.read(reader);
        const viewMode = this._treeViewModel.viewMode.read(reader);
        this._updateIndentStyles(fileIconTheme, viewMode);
      }));
    }, this, this._store);
  }
  layoutBody(height, width) {
    super.layoutBody(height, width);
    this._tree.layout(height, width);
  }
  getActionRunner() {
    return this._actionRunner;
  }
  getActionsContext() {
    return this._treeViewModel?.repository.get()?.provider;
  }
  createActionViewItem(action, options) {
    if (action.id === PICK_REPOSITORY_ACTION_ID) {
      const repository = this._treeViewModel?.repository.get();
      if (repository) {
        return new SCMRepositoryActionViewItem(repository, action, options);
      }
    } else if (action.id === PICK_HISTORY_ITEM_REFS_ACTION_ID) {
      const repository = this._treeViewModel?.repository.get();
      const historyItemsFilter = this._treeViewModel?.getHistoryItemsFilter();
      if (repository && historyItemsFilter) {
        return new SCMHistoryItemRefsActionViewItem(repository, historyItemsFilter, action, options);
      }
    }
    return super.createActionViewItem(action, options);
  }
  focus() {
    super.focus();
    const fakeKeyboardEvent = new KeyboardEvent("keydown");
    this._tree.focusFirst(fakeKeyboardEvent);
    this._tree.domFocus();
  }
  shouldShowWelcome() {
    return this._treeViewModel?.isViewModelEmpty.get() === true;
  }
  async refresh() {
    return this._refreshThrottler.queue((token) => this._refresh(token));
  }
  async _refresh(token) {
    if (token.isCancellationRequested) {
      return;
    }
    this._treeViewModel.clearRepositoryState();
    await this._updateChildren();
    if (token.isCancellationRequested) {
      return;
    }
    this.updateActions();
    this._repositoryOutdated.set(false, void 0);
    this._tree.scrollTop = 0;
  }
  async pickRepository() {
    const picker = this._instantiationService.createInstance(RepositoryPicker);
    const result = await picker.pickRepository();
    if (result) {
      this._treeViewModel.setRepository(result.repository);
    }
  }
  async pickHistoryItemRef() {
    const repository = this._treeViewModel.repository.get();
    const historyProvider = repository?.provider.historyProvider.get();
    const historyItemsFilter = this._treeViewModel.getHistoryItemsFilter();
    if (!historyProvider || !historyItemsFilter) {
      return;
    }
    const picker = this._instantiationService.createInstance(HistoryItemRefPicker, historyProvider, historyItemsFilter);
    const result = await picker.pickHistoryItemRef();
    if (result) {
      this._treeViewModel.setHistoryItemsFilter(result);
    }
  }
  async revealCurrentHistoryItem() {
    const repository = this._treeViewModel.repository.get();
    const historyProvider = repository?.provider.historyProvider.get();
    const historyItemRef = historyProvider?.historyItemRef.get();
    if (!repository || !historyItemRef?.id || !historyItemRef?.revision) {
      return;
    }
    if (!this._isCurrentHistoryItemInFilter(historyItemRef.id)) {
      return;
    }
    const revealTreeNode = () => {
      const historyItemTreeElement = this._treeViewModel.getCurrentHistoryItemTreeElement();
      if (historyItemTreeElement && this._tree.hasNode(historyItemTreeElement)) {
        this._tree.reveal(historyItemTreeElement, 0.5);
        this._tree.setSelection([historyItemTreeElement]);
        this._tree.setFocus([historyItemTreeElement]);
        return true;
      }
      return false;
    };
    if (revealTreeNode()) {
      return;
    }
    await this._loadMore(historyItemRef.revision);
    revealTreeNode();
  }
  setViewMode(viewMode) {
    this._treeViewModel.setViewMode(viewMode);
  }
  _createTree(container) {
    this._treeIdentityProvider = new SCMHistoryTreeIdentityProvider();
    const resourceLabels = this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this.onDidChangeBodyVisibility });
    this._register(resourceLabels);
    this._treeDataSource = this.instantiationService.createInstance(SCMHistoryTreeDataSource, () => this._treeViewModel.viewMode.get());
    this._register(this._treeDataSource);
    const compressionEnabled = observableConfigValue("scm.compactFolders", true, this.configurationService);
    this._tree = this.instantiationService.createInstance(
      WorkbenchCompressibleAsyncDataTree,
      "SCM History Tree",
      container,
      new ListDelegate(),
      new SCMHistoryTreeCompressionDelegate(),
      [
        this.instantiationService.createInstance(HistoryItemRenderer, this.viewDescriptorService.getViewLocationById(this.id)),
        this.instantiationService.createInstance(HistoryItemChangeRenderer, () => this._treeViewModel.viewMode.get(), resourceLabels),
        this.instantiationService.createInstance(HistoryItemLoadMoreRenderer, this._repositoryIsLoadingMore, () => this._loadMore())
      ],
      this._treeDataSource,
      {
        accessibilityProvider: new SCMHistoryTreeAccessibilityProvider(),
        identityProvider: this._treeIdentityProvider,
        collapseByDefault: (e) => !isSCMHistoryItemChangeNode(e),
        compressionEnabled: compressionEnabled.get(),
        dnd: new SCMHistoryTreeDragAndDrop(),
        keyboardNavigationLabelProvider: new SCMHistoryTreeKeyboardNavigationLabelProvider(),
        horizontalScrolling: false,
        multipleSelectionSupport: false,
        twistieAdditionalCssClass: (e) => {
          return isSCMHistoryItemViewModelTreeElement(e) || isSCMHistoryItemLoadMoreTreeElement(e) ? "force-no-twistie" : void 0;
        }
      }
    );
    this._register(this._tree);
    this._tree.onDidOpen(this._onDidOpen, this, this._store);
    this._tree.onContextMenu(this._onContextMenu, this, this._store);
  }
  _isCurrentHistoryItemInFilter(historyItemRefId) {
    if (!historyItemRefId) {
      return false;
    }
    const historyItemFilter = this._treeViewModel.getHistoryItemsFilter();
    if (historyItemFilter === "all" || historyItemFilter === "auto") {
      return true;
    }
    return Array.isArray(historyItemFilter) && !!historyItemFilter.find((ref) => ref.id === historyItemRefId);
  }
  async _onDidOpen(e) {
    if (!e.element) {
      return;
    } else if (isSCMHistoryItemChangeViewModelTreeElement(e.element)) {
      const historyItemChange = e.element.historyItemChange;
      const historyItem = e.element.historyItemViewModel.historyItem;
      const historyItemDisplayId = historyItem.id === SCMIncomingHistoryItemId ? localize("incomingChanges", "Incoming Changes") : historyItem.id === SCMOutgoingHistoryItemId ? localize("outgoingChanges", "Outgoing Changes") : historyItem.displayId ?? historyItem.id;
      const historyItemParentId = historyItem.parentIds.length > 0 ? historyItem.parentIds[0] : void 0;
      const historyItemParentDisplayId = historyItemParentId && historyItem.displayId ? historyItemParentId.substring(0, historyItem.displayId.length) : historyItemParentId;
      if (historyItemChange.originalUri && historyItemChange.modifiedUri) {
        const originalUriTitle = `${basename(historyItemChange.originalUri.fsPath)} (${historyItemParentDisplayId})`;
        const modifiedUriTitle = `${basename(historyItemChange.modifiedUri.fsPath)} (${historyItemDisplayId})`;
        const title = `${originalUriTitle} \u2194 ${modifiedUriTitle}`;
        await this._editorService.openEditor({
          label: title,
          original: { resource: historyItemChange.originalUri },
          modified: { resource: historyItemChange.modifiedUri },
          options: e.editorOptions
        });
      } else if (historyItemChange.modifiedUri) {
        await this._editorService.openEditor({
          label: `${basename(historyItemChange.modifiedUri.fsPath)} (${historyItemDisplayId})`,
          resource: historyItemChange.modifiedUri,
          options: e.editorOptions
        });
      } else if (historyItemChange.originalUri) {
        await this._editorService.openEditor({
          label: `${basename(historyItemChange.originalUri.fsPath)} (${historyItemParentDisplayId})`,
          resource: historyItemChange.originalUri,
          options: e.editorOptions
        });
      }
    } else if (isSCMHistoryItemLoadMoreTreeElement(e.element)) {
      const pageOnScroll = this.configurationService.getValue("scm.graph.pageOnScroll") === true;
      if (!pageOnScroll) {
        this._loadMore();
        this._tree.setSelection([]);
      }
    }
  }
  _onContextMenu(e) {
    const element = e.element;
    if (isSCMHistoryItemViewModelTreeElement(element)) {
      if (element.historyItemViewModel.kind === "incoming-changes" || element.historyItemViewModel.kind === "outgoing-changes") {
        return;
      }
      this._contextMenuDisposables.value = new DisposableStore();
      const historyProvider = element.repository.provider.historyProvider.get();
      const historyItemRef = historyProvider?.historyItemRef.get();
      const historyItem = element.historyItemViewModel.historyItem;
      const historyItemRefMenuItems = MenuRegistry.getMenuItems(MenuId.SCMHistoryItemRefContext).filter((item) => isIMenuItem(item));
      if (historyItemRefMenuItems.length > 0 && element.historyItemViewModel.historyItem.references?.length) {
        const historyItemRefActions = /* @__PURE__ */ new Map();
        for (const ref of element.historyItemViewModel.historyItem.references) {
          const contextKeyService2 = this.scopedContextKeyService.createOverlay([
            ["scmHistoryItemRef", ref.id]
          ]);
          const menuActions2 = this._menuService.getMenuActions(
            MenuId.SCMHistoryItemRefContext,
            contextKeyService2
          );
          for (const action of menuActions2.flatMap((a) => a[1])) {
            if (!historyItemRefActions.has(action.id)) {
              historyItemRefActions.set(action.id, []);
            }
            historyItemRefActions.get(action.id).push(ref);
          }
        }
        for (const historyItemRefMenuItem of historyItemRefMenuItems) {
          const actionId = historyItemRefMenuItem.command.id;
          if (!historyItemRefActions.has(actionId)) {
            continue;
          }
          this._contextMenuDisposables.value.add(MenuRegistry.appendMenuItem(MenuId.SCMHistoryItemContext, {
            title: historyItemRefMenuItem.command.title,
            submenu: MenuId.for(actionId),
            group: historyItemRefMenuItem?.group,
            order: historyItemRefMenuItem?.order
          }));
          for (const historyItemRef2 of historyItemRefActions.get(actionId) ?? []) {
            this._contextMenuDisposables.value.add(registerAction2(class extends Action2 {
              constructor() {
                super({
                  id: `${actionId}.${historyItemRef2.id}`,
                  title: historyItemRef2.name,
                  menu: {
                    id: MenuId.for(actionId),
                    group: historyItemRef2.category
                  }
                });
              }
              run(accessor, ...args) {
                const commandService = accessor.get(ICommandService);
                commandService.executeCommand(actionId, ...args, historyItemRef2.id);
              }
            }));
          }
        }
      }
      const contextKeyService = this.scopedContextKeyService.createOverlay([
        ["scmHistoryItemHasCurrentHistoryItemRef", historyItem.references?.find((ref) => ref.id === historyItemRef?.id) !== void 0]
      ]);
      const menuActions = this._menuService.getMenuActions(
        MenuId.SCMHistoryItemContext,
        contextKeyService,
        {
          arg: element.repository.provider,
          shouldForwardArgs: true
        }
      ).filter((group) => group[0] !== "inline");
      this.contextMenuService.showContextMenu({
        contextKeyService: this.scopedContextKeyService,
        getAnchor: () => e.anchor,
        getActions: () => getFlatContextMenuActions(menuActions),
        getActionsContext: () => element.historyItemViewModel.historyItem
      });
    } else if (isSCMHistoryItemChangeViewModelTreeElement(element)) {
      const menuActions = this._menuService.getMenuActions(
        MenuId.SCMHistoryItemChangeContext,
        this.scopedContextKeyService,
        {
          arg: element.historyItemViewModel.historyItem,
          shouldForwardArgs: true
        }
      ).filter((group) => group[0] !== "inline");
      this.contextMenuService.showContextMenu({
        contextKeyService: this.scopedContextKeyService,
        getAnchor: () => e.anchor,
        getActions: () => getFlatContextMenuActions(menuActions),
        getActionsContext: () => element.historyItemChange
      });
    }
  }
  async _loadMore(cursor) {
    return this._treeLoadMoreSequencer.queue(async () => {
      if (this._repositoryIsLoadingMore.get()) {
        return;
      }
      this._repositoryIsLoadingMore.set(true, void 0);
      this._treeViewModel.loadMore(cursor);
      await this._updateChildren();
      this._repositoryIsLoadingMore.set(false, void 0);
    });
  }
  _updateChildren() {
    return this._updateChildrenThrottler.queue(
      () => this._treeOperationSequencer.queue(
        async () => {
          await this._progressService.withProgress(
            { location: this.id, delay: 100 },
            async () => {
              await this._tree.updateChildren(void 0, void 0, void 0, {
                // diffIdentityProvider: this._treeIdentityProvider
              });
            }
          );
        }
      )
    );
  }
  _updateIndentStyles(theme, viewMode) {
    this._treeContainer.classList.toggle("list-view-mode", viewMode === ViewMode.List);
    this._treeContainer.classList.toggle("tree-view-mode", viewMode === ViewMode.Tree);
    this._treeContainer.classList.toggle("align-icons-and-twisties", viewMode === ViewMode.List && theme.hasFileIcons || theme.hasFileIcons && !theme.hasFolderIcons);
    this._treeContainer.classList.toggle("hide-arrows", viewMode === ViewMode.Tree && theme.hidesExplorerArrows === true);
  }
  dispose() {
    this._contextMenuDisposables.dispose();
    this._visibilityDisposables.dispose();
    super.dispose();
  }
};
SCMHistoryViewPane = __decorateClass([
  __decorateParam(1, IEditorService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IMenuService),
  __decorateParam(4, IProgressService),
  __decorateParam(5, ISCMViewService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IContextMenuService),
  __decorateParam(8, IKeybindingService),
  __decorateParam(9, IInstantiationService),
  __decorateParam(10, IViewDescriptorService),
  __decorateParam(11, IContextKeyService),
  __decorateParam(12, IOpenerService),
  __decorateParam(13, IThemeService),
  __decorateParam(14, IHoverService)
], SCMHistoryViewPane);
export {
  SCMHistoryViewPane
};
