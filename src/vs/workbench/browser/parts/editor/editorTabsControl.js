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
import "./media/editortabscontrol.css";
import { localize } from "../../../../nls.js";
import { DataTransfers } from "../../../../base/browser/dnd.js";
import { $, getActiveWindow, getWindow, isMouseEvent, setVisibility } from "../../../../base/browser/dom.js";
import { StandardMouseEvent } from "../../../../base/browser/mouseEvent.js";
import { ActionsOrientation, prepareActions } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { ActionRunner, toAction } from "../../../../base/common/actions.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { createActionViewItem, getFlatActionBarActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IMenuService, MenuId } from "../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IThemeService, Themable } from "../../../../platform/theme/common/themeService.js";
import { DraggedEditorGroupIdentifier, fillEditorsDragData, isWindowDraggedOver } from "../../dnd.js";
import { EditorPane } from "./editorPane.js";
import { EditorResourceAccessor, SideBySideEditor, EditorsOrder, EditorInputCapabilities, Verbosity } from "../../../common/editor.js";
import { ResourceContextKey, ActiveEditorPinnedContext, ActiveEditorStickyContext, ActiveEditorDirtyContext, ActiveEditorGroupLockedContext, ActiveEditorCanSplitInGroupContext, SideBySideEditorActiveContext, ActiveEditorFirstInGroupContext, ActiveEditorAvailableEditorIdsContext, applyAvailableEditorIds, ActiveEditorLastInGroupContext, ActiveEditorCannotCloseContext } from "../../../common/contextkeys.js";
import { AnchorAlignment } from "../../../../base/browser/ui/contextview/contextview.js";
import { assertReturnsDefined } from "../../../../base/common/types.js";
import { isFirefox } from "../../../../base/browser/browser.js";
import { isCancellationError } from "../../../../base/common/errors.js";
import { SideBySideEditorInput } from "../../../common/editor/sideBySideEditorInput.js";
import { WorkbenchToolBar, HiddenItemStrategy } from "../../../../platform/actions/browser/toolbar.js";
import { LocalSelectionTransfer } from "../../../../platform/dnd/browser/dnd.js";
import { IEditorResolverService } from "../../../services/editor/common/editorResolverService.js";
import { EDITOR_CORE_NAVIGATION_COMMANDS } from "./editorCommands.js";
import { MergeGroupMode } from "../../../services/editor/common/editorGroupsService.js";
import { isMacintosh } from "../../../../base/common/platform.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { applyDragImage } from "../../../../base/browser/ui/dnd/dnd.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { DropdownMenuActionViewItem } from "../../../../base/browser/ui/dropdown/dropdownActionViewItem.js";
class EditorCommandsContextActionRunner extends ActionRunner {
  constructor(context) {
    super();
    this.context = context;
  }
  run(action, context) {
    let mergedContext = this.context;
    if (context?.preserveFocus) {
      mergedContext = {
        ...this.context,
        preserveFocus: true
      };
    }
    return super.run(action, mergedContext);
  }
}
let EditorTabsControl = class extends Themable {
  constructor(parent, editorPartsView, groupsView, groupView, tabsModel, menuIds, breadcrumbsInHeader, contextMenuService, instantiationService, contextKeyService, keybindingService, notificationService, quickInputService, themeService, editorResolverService, hostService, menuService) {
    super(themeService);
    this.parent = parent;
    this.editorPartsView = editorPartsView;
    this.groupsView = groupsView;
    this.groupView = groupView;
    this.tabsModel = tabsModel;
    this.menuIds = menuIds;
    this.breadcrumbsInHeader = breadcrumbsInHeader;
    this.contextMenuService = contextMenuService;
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.keybindingService = keybindingService;
    this.notificationService = notificationService;
    this.quickInputService = quickInputService;
    this.editorResolverService = editorResolverService;
    this.hostService = hostService;
    this.menuService = menuService;
    this.editorTransfer = LocalSelectionTransfer.getInstance();
    this.groupTransfer = LocalSelectionTransfer.getInstance();
    this.treeItemsTransfer = LocalSelectionTransfer.getInstance();
    this.editorActionsToolbarDisposables = this._register(new DisposableStore());
    this.editorActionsDisposables = this._register(new DisposableStore());
    /** Whether the editor-actions toolbar currently has any actions (drives the layout-actions separator). */
    this.editorActionsToolbarHasActions = false;
    this.addTabControlHasActions = false;
    this.addTabControlHasTrailingSeparator = false;
    this.editorLayoutActionsToolbarDisposables = this._register(new DisposableStore());
    this.editorLayoutActionsDisposables = this._register(new DisposableStore());
    this.renderDropdownAsChildElement = false;
    const container = this.create(parent);
    this.contextMenuContextKeyService = this._register(this.contextKeyService.createScoped(container));
    const scopedInstantiationService = this._register(this.instantiationService.createChild(new ServiceCollection(
      [IContextKeyService, this.contextMenuContextKeyService]
    )));
    this.resourceContext = this._register(scopedInstantiationService.createInstance(ResourceContextKey));
    this.editorPinnedContext = ActiveEditorPinnedContext.bindTo(this.contextMenuContextKeyService);
    this.editorIsFirstContext = ActiveEditorFirstInGroupContext.bindTo(this.contextMenuContextKeyService);
    this.editorIsLastContext = ActiveEditorLastInGroupContext.bindTo(this.contextMenuContextKeyService);
    this.editorStickyContext = ActiveEditorStickyContext.bindTo(this.contextMenuContextKeyService);
    this.editorDirtyContext = ActiveEditorDirtyContext.bindTo(this.contextMenuContextKeyService);
    this.editorAvailableEditorIds = ActiveEditorAvailableEditorIdsContext.bindTo(this.contextMenuContextKeyService);
    this.editorCannotCloseContext = ActiveEditorCannotCloseContext.bindTo(this.contextMenuContextKeyService);
    this.editorCanSplitInGroupContext = ActiveEditorCanSplitInGroupContext.bindTo(this.contextMenuContextKeyService);
    this.sideBySideEditorContext = SideBySideEditorActiveContext.bindTo(this.contextMenuContextKeyService);
    this.groupLockedContext = ActiveEditorGroupLockedContext.bindTo(this.contextMenuContextKeyService);
  }
  static {
    this.EDITOR_TAB_HEIGHT = {
      normal: 35,
      compact: 22,
      // Modern UI multi-tab mode adds 4px top + 4px bottom padding to
      // the tabs-and-actions-container (tabs.css), so the total title-bar height is the
      // --editor-group-tab-height CSS value (24px / 20px) plus that 8px padding.
      modernUI: 32,
      // 24px tab  + 4px top + 4px bottom padding
      modernUICompact: 28
      // 20px tab  + 4px top + 4px bottom padding (20px = minimum to fit 16px icon + 2px padding)
    };
  }
  create(parent) {
    this.updateTabHeight();
    return parent;
  }
  get editorActionsEnabled() {
    return this.groupsView.partOptions.editorActionsLocation === "default" && this.groupsView.partOptions.showTabs !== "none";
  }
  createEditorActionsToolBar(parent, classes) {
    this.editorActionsToolbarContainer = $("div");
    this.editorActionsToolbarContainer.classList.add(...classes);
    parent.appendChild(this.editorActionsToolbarContainer);
    this.handleEditorActionToolBarVisibility(this.editorActionsToolbarContainer);
    this.editorLayoutActionsSeparator = $("div.editor-actions-separator");
    parent.appendChild(this.editorLayoutActionsSeparator);
    this.editorLayoutActionsToolbarContainer = $("div.editor-layout-actions");
    parent.appendChild(this.editorLayoutActionsToolbarContainer);
    this.handleEditorLayoutActionsToolBarVisibility(this.editorLayoutActionsToolbarContainer);
  }
  createAddTabControl(parent, menuId, before, trailingSeparator = false) {
    const container = $(".tabs-bar-add-tab");
    parent.insertBefore(container, before ?? null);
    this.addTabControlHasTrailingSeparator = trailingSeparator;
    const menu = this._register(this.menuService.createMenu(menuId, this.contextKeyService));
    const getActions = () => getFlatActionBarActions(menu.getActions({ shouldForwardArgs: true }));
    const addTabAction = toAction({
      id: "editor.tabs.addTab",
      label: localize("addTab", "Add Tab"),
      class: ThemeIcon.asClassName(Codicon.add),
      run: () => {
      }
    });
    const dropdown = this._register(new DropdownMenuActionViewItem(addTabAction, { getActions }, this.contextMenuService, {
      classNames: ThemeIcon.asClassNameArray(Codicon.add),
      keybindingProvider: (action) => this.getKeybinding(action)
    }));
    const toolbar = this._register(this.instantiationService.createInstance(WorkbenchToolBar, container, {
      ariaLabel: localize("ariaLabelAddTab", "Add Tab"),
      trailingSeparator,
      actionViewItemProvider: (action) => action === addTabAction ? dropdown : void 0
    }));
    toolbar.setActions([addTabAction]);
    const updateVisibility = () => {
      this.addTabControlHasActions = getActions().length > 0;
      container.classList.toggle("hidden", !this.addTabControlHasActions);
      this.updateEditorLayoutActionsSeparator();
    };
    updateVisibility();
    this._register(menu.onDidChange(updateVisibility));
    return container;
  }
  updateEditorLayoutActionsSeparator() {
    const hasLayoutActions = (this.editorLayoutActionsToolbar?.getItemsLength() ?? 0) > 0;
    if (this.editorLayoutActionsSeparator) {
      setVisibility(hasLayoutActions && !this.addTabControlHasTrailingSeparator && (this.editorActionsToolbarHasActions || this.addTabControlHasActions), this.editorLayoutActionsSeparator);
    }
  }
  handleEditorActionToolBarVisibility(container) {
    const editorActionsEnabled = this.editorActionsEnabled;
    const editorActionsVisible = !!this.editorActionsToolbar;
    if (editorActionsEnabled && !editorActionsVisible) {
      this.doCreateEditorActionsToolBar(container);
    } else if (!editorActionsEnabled && editorActionsVisible) {
      this.editorActionsToolbar?.getElement().remove();
      this.editorActionsToolbar = void 0;
      this.editorActionsToolbarDisposables.clear();
      this.editorActionsDisposables.clear();
    }
    container.classList.toggle("hidden", !editorActionsEnabled);
  }
  handleEditorLayoutActionsToolBarVisibility(container) {
    const editorActionsEnabled = this.editorActionsEnabled;
    const editorActionsVisible = !!this.editorLayoutActionsToolbar;
    if (editorActionsEnabled && !editorActionsVisible) {
      this.doCreateEditorLayoutActionsToolBar(container);
    } else if (!editorActionsEnabled && editorActionsVisible) {
      this.editorLayoutActionsToolbar?.getElement().remove();
      this.editorLayoutActionsToolbar = void 0;
      this.editorLayoutActionsToolbarDisposables.clear();
      this.editorLayoutActionsDisposables.clear();
    }
    container.classList.toggle("hidden", !editorActionsEnabled);
    if (this.editorLayoutActionsSeparator && !editorActionsEnabled) {
      setVisibility(false, this.editorLayoutActionsSeparator);
    }
  }
  doCreateEditorActionsToolBar(container) {
    const context = { groupId: this.groupView.id };
    const editorActionsMenuId = this.menuIds?.editorActions ?? MenuId.EditorTitle;
    this.editorActionsToolbar = this.editorActionsToolbarDisposables.add(this.instantiationService.createInstance(WorkbenchToolBar, container, {
      actionViewItemProvider: (action, options) => this.actionViewItemProvider(action, options),
      orientation: ActionsOrientation.HORIZONTAL,
      ariaLabel: localize("ariaLabelEditorActions", "Editor actions"),
      getKeyBinding: (action) => this.getKeybinding(action),
      actionRunner: this.editorActionsToolbarDisposables.add(new EditorCommandsContextActionRunner(context)),
      anchorAlignmentProvider: () => AnchorAlignment.RIGHT,
      renderDropdownAsChildElement: this.renderDropdownAsChildElement,
      telemetrySource: "editorPart",
      resetMenu: editorActionsMenuId,
      overflowBehavior: { maxItems: 9, exempted: EDITOR_CORE_NAVIGATION_COMMANDS },
      highlightToggledItems: true
    }));
    this.editorActionsToolbar.context = context;
    this.editorActionsToolbarDisposables.add(this.editorActionsToolbar.actionRunner.onDidRun((e) => {
      if (e.error && !isCancellationError(e.error)) {
        this.notificationService.error(e.error);
      }
    }));
  }
  doCreateEditorLayoutActionsToolBar(container) {
    const context = { groupId: this.groupView.id };
    this.editorLayoutActionsToolbar = this.editorLayoutActionsToolbarDisposables.add(this.instantiationService.createInstance(WorkbenchToolBar, container, {
      actionViewItemProvider: (action, options) => this.actionViewItemProvider(action, options),
      orientation: ActionsOrientation.HORIZONTAL,
      ariaLabel: localize("ariaLabelEditorActionsLayout", "Editor layout actions"),
      getKeyBinding: (action) => this.getKeybinding(action),
      actionRunner: this.editorLayoutActionsToolbarDisposables.add(new EditorCommandsContextActionRunner(context)),
      anchorAlignmentProvider: () => AnchorAlignment.RIGHT,
      renderDropdownAsChildElement: this.renderDropdownAsChildElement,
      telemetrySource: "editorPartTrailing",
      resetMenu: MenuId.EditorTitleLayout,
      hiddenItemStrategy: HiddenItemStrategy.NoHide,
      highlightToggledItems: true
    }));
    this.editorLayoutActionsToolbar.context = context;
    this.editorLayoutActionsToolbarDisposables.add(this.editorLayoutActionsToolbar.actionRunner.onDidRun((e) => {
      if (e.error && !isCancellationError(e.error)) {
        this.notificationService.error(e.error);
      }
    }));
  }
  actionViewItemProvider(action, options) {
    const activeEditorPane = this.groupView.activeEditorPane;
    if (activeEditorPane instanceof EditorPane) {
      const result = activeEditorPane.getActionViewItem(action, options);
      if (result) {
        return result;
      }
    }
    return createActionViewItem(this.instantiationService, action, { ...options, menuAsChild: this.renderDropdownAsChildElement });
  }
  updateEditorActionsToolbar() {
    if (!this.editorActionsEnabled) {
      return;
    }
    this.editorActionsDisposables.clear();
    const editorActions = this.groupView.createEditorActions(this.editorActionsDisposables, this.menuIds?.editorActions ?? MenuId.EditorTitle);
    this.editorActionsDisposables.add(editorActions.onDidChange(() => this.updateEditorActionsToolbar()));
    const editorActionsToolbar = assertReturnsDefined(this.editorActionsToolbar);
    const { primary, secondary } = this.prepareEditorActions(editorActions.actions);
    editorActionsToolbar.setActions(prepareActions(primary), prepareActions(secondary));
    this.editorActionsToolbarHasActions = primary.length > 0 || secondary.length > 0;
    this.updateEditorLayoutActionsToolbar();
  }
  updateEditorLayoutActionsToolbar() {
    if (!this.editorActionsEnabled || !this.editorLayoutActionsToolbarContainer || !this.editorLayoutActionsToolbar) {
      return;
    }
    this.editorLayoutActionsDisposables.clear();
    const editorActions = this.groupView.createEditorActions(this.editorLayoutActionsDisposables, MenuId.EditorTitleLayout);
    this.editorLayoutActionsDisposables.add(editorActions.onDidChange(() => this.updateEditorLayoutActionsToolbar()));
    const { primary, secondary } = this.prepareEditorLayoutActions(editorActions.actions);
    this.editorLayoutActionsToolbar.setActions(prepareActions(primary), prepareActions(secondary));
    const hasLayoutActions = primary.length > 0 || secondary.length > 0;
    this.updateEditorLayoutActionsSeparator();
    setVisibility(hasLayoutActions, this.editorLayoutActionsToolbarContainer);
  }
  getEditorPaneAwareContextKeyService() {
    return this.groupView.activeEditorPane?.scopedContextKeyService ?? this.contextKeyService;
  }
  clearEditorActionsToolbar() {
    if (!this.editorActionsEnabled) {
      return;
    }
    const editorActionsToolbar = assertReturnsDefined(this.editorActionsToolbar);
    editorActionsToolbar.setActions([], []);
    this.editorActionsToolbarHasActions = false;
    this.editorLayoutActionsToolbar?.setActions([], []);
    if (this.editorLayoutActionsSeparator) {
      setVisibility(false, this.editorLayoutActionsSeparator);
    }
    if (this.editorLayoutActionsToolbarContainer) {
      setVisibility(false, this.editorLayoutActionsToolbarContainer);
    }
  }
  onGroupDragStart(e, element) {
    if (e.target !== element) {
      return false;
    }
    const isNewWindowOperation = this.isNewWindowOperation(e);
    this.groupTransfer.setData([new DraggedEditorGroupIdentifier(this.groupView.id)], DraggedEditorGroupIdentifier.prototype);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "copyMove";
    }
    let hasDataTransfer = false;
    if (this.groupsView.partOptions.showTabs === "multiple") {
      hasDataTransfer = this.doFillResourceDataTransfers(this.groupView.getEditors(EditorsOrder.SEQUENTIAL), e, isNewWindowOperation);
    } else {
      if (this.groupView.activeEditor) {
        hasDataTransfer = this.doFillResourceDataTransfers([this.groupView.activeEditor], e, isNewWindowOperation);
      }
    }
    if (!hasDataTransfer && isFirefox) {
      e.dataTransfer?.setData(DataTransfers.TEXT, String(this.groupView.label));
    }
    if (this.groupView.activeEditor) {
      let label = this.groupView.activeEditor.getName();
      if (this.groupsView.partOptions.showTabs === "multiple" && this.groupView.count > 1) {
        label = localize("draggedEditorGroup", "{0} (+{1})", label, this.groupView.count - 1);
      }
      applyDragImage(e, element, label);
    }
    return isNewWindowOperation;
  }
  async onGroupDragEnd(e, previousDragEvent, element, isNewWindowOperation) {
    this.groupTransfer.clearData(DraggedEditorGroupIdentifier.prototype);
    if (e.target !== element || !isNewWindowOperation || isWindowDraggedOver()) {
      return;
    }
    const auxiliaryEditorPart = await this.maybeCreateAuxiliaryEditorPartAt(e, element);
    if (!auxiliaryEditorPart) {
      return;
    }
    const targetGroup = auxiliaryEditorPart.activeGroup;
    this.groupsView.mergeGroup(this.groupView, targetGroup.id, {
      mode: this.isMoveOperation(previousDragEvent ?? e, targetGroup.id) ? MergeGroupMode.MOVE_EDITORS : MergeGroupMode.COPY_EDITORS
    });
    targetGroup.focus();
  }
  async maybeCreateAuxiliaryEditorPartAt(e, offsetElement) {
    const { point, display } = await this.hostService.getCursorScreenPoint() ?? { point: { x: e.screenX, y: e.screenY } };
    const window = getActiveWindow();
    if (window.document.visibilityState === "visible" && window.document.hasFocus()) {
      if (point.x >= window.screenX && point.x <= window.screenX + window.outerWidth && point.y >= window.screenY && point.y <= window.screenY + window.outerHeight) {
        return;
      }
    }
    const offsetX = offsetElement.offsetWidth / 2;
    const offsetY = 30 + offsetElement.offsetHeight / 2;
    const bounds = {
      x: point.x - offsetX,
      y: point.y - offsetY
    };
    if (display) {
      if (bounds.x < display.x) {
        bounds.x = display.x;
      }
      if (bounds.y < display.y) {
        bounds.y = display.y;
      }
    }
    return this.editorPartsView.createAuxiliaryEditorPart({ bounds });
  }
  isNewWindowOperation(e) {
    if (this.groupsView.partOptions.dragToOpenWindow) {
      return !e.altKey;
    }
    return e.altKey;
  }
  isMoveOperation(e, sourceGroup, sourceEditor) {
    if (sourceEditor?.hasCapability(EditorInputCapabilities.Singleton)) {
      return true;
    }
    const isCopy = e.ctrlKey && !isMacintosh || e.altKey && isMacintosh;
    return !isCopy || sourceGroup === this.groupView.id;
  }
  doFillResourceDataTransfers(editors, e, disableStandardTransfer) {
    if (editors.length) {
      this.instantiationService.invokeFunction(fillEditorsDragData, editors.map((editor) => ({ editor, groupId: this.groupView.id })), e, { disableStandardTransfer });
      return true;
    }
    return false;
  }
  onTabContextMenu(editor, e, node) {
    this.resourceContext.set(EditorResourceAccessor.getOriginalUri(editor, { supportSideBySide: SideBySideEditor.PRIMARY }));
    this.editorPinnedContext.set(this.tabsModel.isPinned(editor));
    this.editorIsFirstContext.set(this.tabsModel.isFirst(editor));
    this.editorIsLastContext.set(this.tabsModel.isLast(editor));
    this.editorStickyContext.set(this.tabsModel.isSticky(editor));
    this.editorDirtyContext.set(editor.isDirty() && !editor.isSaving());
    this.editorCannotCloseContext.set(editor.hasCapability(EditorInputCapabilities.CannotClose));
    this.groupLockedContext.set(this.tabsModel.isLocked);
    this.editorCanSplitInGroupContext.set(editor.hasCapability(EditorInputCapabilities.CanSplitInGroup));
    this.sideBySideEditorContext.set(editor.typeId === SideBySideEditorInput.ID);
    applyAvailableEditorIds(this.editorAvailableEditorIds, editor, this.editorResolverService);
    let anchor = node;
    if (isMouseEvent(e)) {
      anchor = new StandardMouseEvent(getWindow(node), e);
    }
    this.contextMenuService.showContextMenu({
      getAnchor: () => anchor,
      menuId: MenuId.EditorTitleContext,
      menuActionOptions: { shouldForwardArgs: true, arg: this.resourceContext.get() },
      contextKeyService: this.contextMenuContextKeyService,
      getActionsContext: () => ({ groupId: this.groupView.id, editorIndex: this.groupView.getIndexOfEditor(editor) }),
      getKeyBinding: (action) => this.keybindingService.lookupKeybinding(action.id, this.contextMenuContextKeyService),
      onHide: () => this.groupsView.activeGroup.focus()
      // restore focus to active group
    });
  }
  getKeybinding(action) {
    return this.keybindingService.lookupKeybinding(action.id, this.getEditorPaneAwareContextKeyService());
  }
  getKeybindingLabel(action) {
    const keybinding = this.getKeybinding(action);
    return keybinding ? keybinding.getLabel() ?? void 0 : void 0;
  }
  get tabHeight() {
    const isCompact = this.groupsView.partOptions.tabHeight === "compact";
    if (this.parent.classList.contains("tabs") && this.parent.closest(".modern-ui-tabs")) {
      return isCompact ? EditorTabsControl.EDITOR_TAB_HEIGHT.modernUICompact : EditorTabsControl.EDITOR_TAB_HEIGHT.modernUI;
    }
    return isCompact ? EditorTabsControl.EDITOR_TAB_HEIGHT.compact : EditorTabsControl.EDITOR_TAB_HEIGHT.normal;
  }
  getHoverTitle(editor) {
    const title = editor.getTitle(Verbosity.LONG);
    if (!this.tabsModel.isPinned(editor)) {
      return {
        markdown: new MarkdownString("", { supportThemeIcons: true, isTrusted: true }).appendText(title).appendMarkdown(' (_preview_ [$(gear)](command:workbench.action.openSettings?%5B%22workbench.editor.enablePreview%22%5D "Configure Preview Mode"))'),
        markdownNotSupportedFallback: title + " (preview)"
      };
    }
    return title;
  }
  updateTabHeight() {
    this.parent.style.setProperty("--editor-group-tab-height", `${this.tabHeight}px`);
    this.parent.classList.toggle("compact-height", this.groupsView.partOptions.tabHeight === "compact");
  }
  updateOptions(oldOptions, newOptions) {
    if (oldOptions.tabHeight !== newOptions.tabHeight) {
      this.updateTabHeight();
    }
    if (oldOptions.editorActionsLocation !== newOptions.editorActionsLocation || oldOptions.showTabs !== newOptions.showTabs) {
      if (this.editorActionsToolbarContainer) {
        this.handleEditorActionToolBarVisibility(this.editorActionsToolbarContainer);
        this.updateEditorActionsToolbar();
      }
      if (this.editorLayoutActionsToolbarContainer) {
        this.handleEditorLayoutActionsToolBarVisibility(this.editorLayoutActionsToolbarContainer);
        this.updateEditorLayoutActionsToolbar();
      }
    }
  }
};
EditorTabsControl = __decorateClass([
  __decorateParam(7, IContextMenuService),
  __decorateParam(8, IInstantiationService),
  __decorateParam(9, IContextKeyService),
  __decorateParam(10, IKeybindingService),
  __decorateParam(11, INotificationService),
  __decorateParam(12, IQuickInputService),
  __decorateParam(13, IThemeService),
  __decorateParam(14, IEditorResolverService),
  __decorateParam(15, IHostService),
  __decorateParam(16, IMenuService)
], EditorTabsControl);
export {
  EditorCommandsContextActionRunner,
  EditorTabsControl
};
