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
import "./media/openeditors.css";
import * as nls from "../../../../../nls.js";
import { RunOnceScheduler } from "../../../../../base/common/async.js";
import { ActionRunner } from "../../../../../base/common/actions.js";
import * as dom from "../../../../../base/browser/dom.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IEditorGroupsService, GroupsOrder, GroupOrientation } from "../../../../services/editor/common/editorGroupsService.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { Verbosity, EditorResourceAccessor, SideBySideEditor, GroupModelChangeKind, preventEditorClose, EditorCloseMethod } from "../../../../common/editor.js";
import { SaveAllInGroupAction, CloseGroupAction } from "../fileActions.js";
import { OpenEditorsFocusedContext, ExplorerFocusedContext, OpenEditor } from "../../common/files.js";
import { CloseAllEditorsAction, CloseEditorAction, UnpinEditorAction } from "../../../../browser/parts/editor/editorActions.js";
import { IContextKeyService, ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { asCssVariable, badgeBackground, badgeForeground, contrastBorder } from "../../../../../platform/theme/common/colorRegistry.js";
import { WorkbenchList } from "../../../../../platform/list/browser/listService.js";
import { ListDragOverEffectPosition, ListDragOverEffectType } from "../../../../../base/browser/ui/list/list.js";
import { ResourceLabels } from "../../../../browser/labels.js";
import { ActionBar } from "../../../../../base/browser/ui/actionbar/actionbar.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { DisposableMap, dispose } from "../../../../../base/common/lifecycle.js";
import { MenuId, Action2, registerAction2, MenuRegistry } from "../../../../../platform/actions/common/actions.js";
import { OpenEditorsDirtyEditorContext, OpenEditorsGroupContext, OpenEditorsReadonlyEditorContext, SAVE_ALL_LABEL, SAVE_ALL_COMMAND_ID, NEW_UNTITLED_FILE_COMMAND_ID, OpenEditorsSelectedFileOrUntitledContext } from "../fileConstants.js";
import { ResourceContextKey, MultipleEditorGroupsContext } from "../../../../common/contextkeys.js";
import { CodeDataTransfers, containsDragType } from "../../../../../platform/dnd/browser/dnd.js";
import { ResourcesDropHandler, fillEditorsDragData } from "../../../../browser/dnd.js";
import { ViewPane } from "../../../../browser/parts/views/viewPane.js";
import { DataTransfers } from "../../../../../base/browser/dnd.js";
import { memoize } from "../../../../../base/common/decorators.js";
import { ElementsDragAndDropData, ListViewTargetSector, NativeDragAndDropData } from "../../../../../base/browser/ui/list/listView.js";
import { IWorkingCopyService } from "../../../../services/workingCopy/common/workingCopyService.js";
import { WorkingCopyCapabilities } from "../../../../services/workingCopy/common/workingCopy.js";
import { IFilesConfigurationService } from "../../../../services/filesConfiguration/common/filesConfigurationService.js";
import { IViewDescriptorService } from "../../../../common/views.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { Orientation } from "../../../../../base/browser/ui/splitview/splitview.js";
import { compareFileNamesDefault } from "../../../../../base/common/comparers.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { Schemas } from "../../../../../base/common/network.js";
import { extUriIgnorePathCase } from "../../../../../base/common/resources.js";
import { mainWindow } from "../../../../../base/browser/window.js";
import { EditorGroupView } from "../../../../browser/parts/editor/editorGroupView.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
const $ = dom.$;
let OpenEditorsView = class extends ViewPane {
  constructor(options, instantiationService, viewDescriptorService, contextMenuService, editorGroupService, configurationService, keybindingService, contextKeyService, themeService, telemetryService, hoverService, workingCopyService, filesConfigurationService, openerService, fileService) {
    super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.editorGroupService = editorGroupService;
    this.telemetryService = telemetryService;
    this.workingCopyService = workingCopyService;
    this.filesConfigurationService = filesConfigurationService;
    this.fileService = fileService;
    this.needsRefresh = false;
    this.elements = [];
    this.blockFocusActiveEditorTracking = false;
    this.preserveSelectionOnRefresh = false;
    this.editorIds = /* @__PURE__ */ new WeakMap();
    this.editorIdPool = 0;
    this.structuralRefreshDelay = 0;
    this.sortOrder = configurationService.getValue("explorer.openEditors.sortOrder");
    this.registerUpdateEvents();
    this._register(this.configurationService.onDidChangeConfiguration((e) => this.onConfigurationChange(e)));
    this._register(this.workingCopyService.onDidChangeDirty((workingCopy) => this.updateDirtyIndicator(workingCopy)));
  }
  static {
    this.DEFAULT_VISIBLE_OPEN_EDITORS = 9;
  }
  static {
    this.DEFAULT_MIN_VISIBLE_OPEN_EDITORS = 0;
  }
  static {
    this.ID = "workbench.explorer.openEditorsView";
  }
  static {
    this.NAME = nls.localize2({ key: "openEditors", comment: ["Open is an adjective"] }, "Open Editors");
  }
  registerUpdateEvents() {
    const updateWholeList = () => {
      if (!this.isBodyVisible() || !this.list) {
        this.needsRefresh = true;
        return;
      }
      this.scheduleListRefresh(false, this.structuralRefreshDelay);
    };
    const groupDisposables = this._register(new DisposableMap());
    const addGroupListener = (group) => {
      const groupModelChangeListener = group.onDidModelChange((e) => {
        if (this.listRefreshScheduler?.isScheduled()) {
          switch (e.kind) {
            case GroupModelChangeKind.EDITOR_ACTIVE:
            case GroupModelChangeKind.EDITOR_OPEN:
            case GroupModelChangeKind.EDITOR_MOVE:
            case GroupModelChangeKind.EDITOR_CLOSE:
              this.preserveSelectionOnRefresh = false;
          }
          return;
        }
        if (!this.isBodyVisible() || !this.list) {
          this.needsRefresh = true;
          return;
        }
        const index = this.getIndex(group, e.editor);
        switch (e.kind) {
          case GroupModelChangeKind.EDITOR_ACTIVE:
            this.focusActiveEditor();
            break;
          case GroupModelChangeKind.GROUP_INDEX:
          case GroupModelChangeKind.GROUP_LABEL:
            if (index >= 0) {
              this.list.splice(index, 1, [group]);
            }
            break;
          case GroupModelChangeKind.EDITOR_DIRTY:
          case GroupModelChangeKind.EDITOR_STICKY:
          case GroupModelChangeKind.EDITOR_CAPABILITIES:
          case GroupModelChangeKind.EDITOR_PIN:
          case GroupModelChangeKind.EDITOR_LABEL:
            this.list.splice(index, 1, [new OpenEditor(e.editor, group)]);
            this.focusActiveEditor(true);
            break;
          case GroupModelChangeKind.EDITOR_OPEN:
          case GroupModelChangeKind.EDITOR_MOVE:
          case GroupModelChangeKind.EDITOR_CLOSE:
            updateWholeList();
            break;
        }
      });
      groupDisposables.set(group.id, groupModelChangeListener);
    };
    this.editorGroupService.groups.forEach((g) => addGroupListener(g));
    this._register(this.editorGroupService.onDidAddGroup((group) => {
      addGroupListener(group);
      updateWholeList();
    }));
    this._register(this.editorGroupService.onDidMoveGroup(() => updateWholeList()));
    this._register(this.editorGroupService.onDidChangeActiveGroup(() => this.focusActiveEditor()));
    this._register(this.editorGroupService.onDidRemoveGroup((group) => {
      groupDisposables.deleteAndDispose(group.id);
      updateWholeList();
    }));
  }
  renderHeaderTitle(container) {
    super.renderHeaderTitle(container, this.title);
    const count = dom.append(container, $(".open-editors-dirty-count-container"));
    this.dirtyCountElement = dom.append(count, $(".dirty-count.monaco-count-badge.long"));
    this.dirtyCountElement.style.backgroundColor = asCssVariable(badgeBackground);
    this.dirtyCountElement.style.color = asCssVariable(badgeForeground);
    this.dirtyCountElement.style.border = `1px solid ${asCssVariable(contrastBorder)}`;
    this.updateDirtyIndicator();
  }
  renderBody(container) {
    super.renderBody(container);
    container.classList.add("open-editors");
    container.classList.add("show-file-icons");
    const delegate = new OpenEditorsDelegate();
    if (this.list) {
      this.list.dispose();
    }
    if (this.listLabels) {
      this.listLabels.clear();
    }
    this.dnd = new OpenEditorsDragAndDrop(this.sortOrder, this.instantiationService, this.editorGroupService);
    this.listLabels = this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this.onDidChangeBodyVisibility });
    this.list = this.instantiationService.createInstance(WorkbenchList, "OpenEditors", container, delegate, [
      new EditorGroupRenderer(this.keybindingService, this.instantiationService),
      new OpenEditorRenderer(this.listLabels, this.instantiationService, this.keybindingService, this.configurationService)
    ], {
      identityProvider: { getId: (element) => this.getElementId(element) },
      dnd: this.dnd,
      overrideStyles: this.getLocationBasedColors().listOverrideStyles,
      accessibilityProvider: new OpenEditorsAccessibilityProvider(),
      openOnSingleClick: true
    });
    this._register(this.list);
    this._register(this.listLabels);
    let labelChangeListeners = [];
    this.listRefreshScheduler = this._register(new RunOnceScheduler(() => {
      const preserveSelection = this.preserveSelectionOnRefresh;
      this.preserveSelectionOnRefresh = false;
      if (!this.list) {
        return;
      }
      labelChangeListeners = dispose(labelChangeListeners);
      const previousLength = this.list.length;
      const elements = this.getElements();
      this.list.splice(0, this.list.length, elements);
      this.focusActiveEditor(preserveSelection);
      if (previousLength !== this.list.length) {
        this.updateSize();
      }
      this.needsRefresh = false;
      if (this.sortOrder === "alphabetical" || this.sortOrder === "fullPath") {
        elements.forEach((e) => {
          if (e instanceof OpenEditor) {
            labelChangeListeners.push(e.editor.onDidChangeLabel(() => this.scheduleListRefresh(true)));
          }
        });
      }
    }, this.structuralRefreshDelay));
    this.updateSize();
    this.handleContextKeys();
    this._register(this.list.onContextMenu((e) => this.onListContextMenu(e)));
    this._register(this.list.onMouseMiddleClick((e) => {
      if (e && e.element instanceof OpenEditor) {
        if (preventEditorClose(e.element.group, e.element.editor, EditorCloseMethod.MOUSE, this.editorGroupService.partOptions)) {
          return;
        }
        e.element.group.closeEditor(e.element.editor, { preserveFocus: true });
      }
    }));
    this._register(this.list.onDidOpen((e) => {
      const element = e.element;
      if (!element) {
        return;
      } else if (element instanceof OpenEditor) {
        if (dom.isMouseEvent(e.browserEvent) && e.browserEvent.button === 1) {
          return;
        }
        this.withActiveEditorFocusTrackingDisabled(() => {
          this.openEditor(element, { preserveFocus: e.editorOptions.preserveFocus, pinned: e.editorOptions.pinned, sideBySide: e.sideBySide });
        });
      } else {
        this.withActiveEditorFocusTrackingDisabled(() => {
          this.editorGroupService.activateGroup(element);
          if (!e.editorOptions.preserveFocus) {
            element.focus();
          }
        });
      }
    }));
    this.scheduleListRefresh(false, 0);
    this._register(this.onDidChangeBodyVisibility((visible) => {
      if (visible && this.needsRefresh) {
        this.scheduleListRefresh(false, 0);
      }
    }));
    const containerModel = this.viewDescriptorService.getViewContainerModel(this.viewDescriptorService.getViewContainerByViewId(this.id));
    this._register(containerModel.onDidChangeAllViewDescriptors(() => {
      this.updateSize();
    }));
  }
  handleContextKeys() {
    if (!this.list) {
      return;
    }
    OpenEditorsFocusedContext.bindTo(this.list.contextKeyService);
    ExplorerFocusedContext.bindTo(this.list.contextKeyService);
    const groupFocusedContext = OpenEditorsGroupContext.bindTo(this.contextKeyService);
    const dirtyEditorFocusedContext = OpenEditorsDirtyEditorContext.bindTo(this.contextKeyService);
    const readonlyEditorFocusedContext = OpenEditorsReadonlyEditorContext.bindTo(this.contextKeyService);
    const openEditorsSelectedFileOrUntitledContext = OpenEditorsSelectedFileOrUntitledContext.bindTo(this.contextKeyService);
    const resourceContext = this.instantiationService.createInstance(ResourceContextKey);
    this._register(resourceContext);
    this._register(this.list.onDidChangeFocus((e) => {
      resourceContext.reset();
      groupFocusedContext.reset();
      dirtyEditorFocusedContext.reset();
      readonlyEditorFocusedContext.reset();
      const element = e.elements.length ? e.elements[0] : void 0;
      if (element instanceof OpenEditor) {
        const resource = element.getResource();
        dirtyEditorFocusedContext.set(element.editor.isDirty() && !element.editor.isSaving());
        readonlyEditorFocusedContext.set(!!element.editor.isReadonly());
        resourceContext.set(resource ?? null);
      } else if (element) {
        groupFocusedContext.set(true);
      }
    }));
    this._register(this.list.onDidChangeSelection((e) => {
      const selectedAreFileOrUntitled = e.elements.every((e2) => {
        if (e2 instanceof OpenEditor) {
          const resource = e2.getResource();
          return resource && (resource.scheme === Schemas.untitled || this.fileService.hasProvider(resource));
        }
        return false;
      });
      openEditorsSelectedFileOrUntitledContext.set(selectedAreFileOrUntitled);
    }));
  }
  focus() {
    super.focus();
    this.list?.domFocus();
  }
  layoutBody(height, width) {
    super.layoutBody(height, width);
    this.list?.layout(height, width);
  }
  get showGroups() {
    return this.editorGroupService.groups.length > 1;
  }
  getElements() {
    this.elements = [];
    this.editorGroupService.getGroups(GroupsOrder.GRID_APPEARANCE).forEach((g) => {
      if (this.showGroups) {
        this.elements.push(g);
      }
      let editors = g.editors.map((ei) => new OpenEditor(ei, g));
      if (this.sortOrder === "alphabetical") {
        editors = editors.sort((first, second) => compareFileNamesDefault(first.editor.getName(), second.editor.getName()));
      } else if (this.sortOrder === "fullPath") {
        editors = editors.sort((first, second) => {
          const firstResource = first.editor.resource;
          const secondResource = second.editor.resource;
          if (firstResource === void 0 && secondResource === void 0) {
            return compareFileNamesDefault(first.editor.getName(), second.editor.getName());
          } else if (firstResource === void 0) {
            return -1;
          } else if (secondResource === void 0) {
            return 1;
          } else {
            const firstScheme = firstResource.scheme;
            const secondScheme = secondResource.scheme;
            if (firstScheme !== Schemas.file && secondScheme !== Schemas.file) {
              return extUriIgnorePathCase.compare(firstResource, secondResource);
            } else if (firstScheme !== Schemas.file) {
              return -1;
            } else if (secondScheme !== Schemas.file) {
              return 1;
            } else {
              return extUriIgnorePathCase.compare(firstResource, secondResource);
            }
          }
        });
      }
      this.elements.push(...editors);
    });
    return this.elements;
  }
  getIndex(group, editor) {
    if (!editor) {
      return this.elements.findIndex((e) => !(e instanceof OpenEditor) && e.id === group.id);
    }
    return this.elements.findIndex((e) => e instanceof OpenEditor && e.editor === editor && e.group.id === group.id);
  }
  openEditor(element, options) {
    if (element) {
      this.telemetryService.publicLog2("workbenchActionExecuted", { id: "workbench.files.openFile", from: "openEditors" });
      const preserveActivateGroup = options.sideBySide && options.preserveFocus;
      if (!preserveActivateGroup) {
        this.editorGroupService.activateGroup(element.group);
      }
      const targetGroup = options.sideBySide ? this.editorGroupService.sideGroup : element.group;
      targetGroup.openEditor(element.editor, options);
    }
  }
  onListContextMenu(e) {
    if (!e.element) {
      return;
    }
    const element = e.element;
    this.contextMenuService.showContextMenu({
      menuId: MenuId.OpenEditorsContext,
      menuActionOptions: { shouldForwardArgs: true, arg: element instanceof OpenEditor ? EditorResourceAccessor.getOriginalUri(element.editor) : {} },
      contextKeyService: this.list?.contextKeyService,
      getAnchor: () => e.anchor,
      getActionsContext: () => element instanceof OpenEditor ? { groupId: element.groupId, editorIndex: element.group.getIndexOfEditor(element.editor) } : { groupId: element.id }
    });
  }
  withActiveEditorFocusTrackingDisabled(fn) {
    this.blockFocusActiveEditorTracking = true;
    try {
      fn();
    } finally {
      this.blockFocusActiveEditorTracking = false;
    }
  }
  scheduleListRefresh(preserveSelection, delay) {
    if (!this.listRefreshScheduler) {
      return;
    }
    if (!preserveSelection || !this.listRefreshScheduler.isScheduled()) {
      this.preserveSelectionOnRefresh = preserveSelection;
    }
    this.listRefreshScheduler.schedule(delay);
  }
  getElementId(element) {
    if (!(element instanceof OpenEditor)) {
      return element.id.toString();
    }
    let editorId = this.editorIds.get(element.editor);
    if (editorId === void 0) {
      editorId = this.editorIdPool++;
      this.editorIds.set(element.editor, editorId);
    }
    return `openeditor:${element.groupId}:${editorId}`;
  }
  focusActiveEditor(preserveSelection = false) {
    if (!this.list || this.blockFocusActiveEditorTracking) {
      return;
    }
    if (this.list.length && this.editorGroupService.activeGroup) {
      const index = this.getIndex(this.editorGroupService.activeGroup, this.editorGroupService.activeGroup.activeEditor);
      if (index >= 0) {
        try {
          this.list.setFocus([index]);
          if (!preserveSelection) {
            this.list.setSelection([index]);
          }
          this.list.reveal(index);
        } catch (e) {
        }
        return;
      }
    }
    this.list.setFocus([]);
    if (!preserveSelection) {
      this.list.setSelection([]);
    }
  }
  onConfigurationChange(event) {
    if (event.affectsConfiguration("explorer.openEditors")) {
      this.updateSize();
    }
    if (event.affectsConfiguration("explorer.decorations") || event.affectsConfiguration("explorer.openEditors.sortOrder")) {
      this.sortOrder = this.configurationService.getValue("explorer.openEditors.sortOrder");
      if (this.dnd) {
        this.dnd.sortOrder = this.sortOrder;
      }
      this.scheduleListRefresh(false);
    }
  }
  updateSize() {
    this.minimumBodySize = this.orientation === Orientation.VERTICAL ? this.getMinExpandedBodySize() : 170;
    this.maximumBodySize = this.orientation === Orientation.VERTICAL ? this.getMaxExpandedBodySize() : Number.POSITIVE_INFINITY;
  }
  updateDirtyIndicator(workingCopy) {
    if (workingCopy) {
      const gotDirty = workingCopy.isDirty();
      if (gotDirty && !(workingCopy.capabilities & WorkingCopyCapabilities.Untitled) && this.filesConfigurationService.hasShortAutoSaveDelay(workingCopy.resource)) {
        return;
      }
    }
    const dirty = this.workingCopyService.dirtyCount;
    if (dirty === 0) {
      this.dirtyCountElement.classList.add("hidden");
    } else {
      this.dirtyCountElement.textContent = nls.localize("dirtyCounter", "{0} unsaved", dirty);
      this.dirtyCountElement.classList.remove("hidden");
    }
  }
  get elementCount() {
    return this.editorGroupService.groups.map((g) => g.count).reduce((first, second) => first + second, this.showGroups ? this.editorGroupService.groups.length : 0);
  }
  getMaxExpandedBodySize() {
    let minVisibleOpenEditors = this.configurationService.getValue("explorer.openEditors.minVisible");
    if (typeof minVisibleOpenEditors !== "number") {
      minVisibleOpenEditors = OpenEditorsView.DEFAULT_MIN_VISIBLE_OPEN_EDITORS;
    }
    const containerModel = this.viewDescriptorService.getViewContainerModel(this.viewDescriptorService.getViewContainerByViewId(this.id));
    if (containerModel.visibleViewDescriptors.length <= 1) {
      return Number.POSITIVE_INFINITY;
    }
    return Math.max(this.elementCount, minVisibleOpenEditors) * OpenEditorsDelegate.ITEM_HEIGHT;
  }
  getMinExpandedBodySize() {
    let visibleOpenEditors = this.configurationService.getValue("explorer.openEditors.visible");
    if (typeof visibleOpenEditors !== "number") {
      visibleOpenEditors = OpenEditorsView.DEFAULT_VISIBLE_OPEN_EDITORS;
    }
    return this.computeMinExpandedBodySize(visibleOpenEditors);
  }
  computeMinExpandedBodySize(visibleOpenEditors = OpenEditorsView.DEFAULT_VISIBLE_OPEN_EDITORS) {
    const itemsToShow = Math.min(Math.max(visibleOpenEditors, 1), this.elementCount);
    return itemsToShow * OpenEditorsDelegate.ITEM_HEIGHT;
  }
  setStructuralRefreshDelay(delay) {
    this.structuralRefreshDelay = delay;
  }
  getOptimalWidth() {
    if (!this.list) {
      return super.getOptimalWidth();
    }
    const parentNode = this.list.getHTMLElement();
    const childNodes = [].slice.call(parentNode.querySelectorAll(".open-editor > a"));
    return dom.getLargestChildWidth(parentNode, childNodes);
  }
};
OpenEditorsView = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IViewDescriptorService),
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, IEditorGroupsService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IKeybindingService),
  __decorateParam(7, IContextKeyService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, ITelemetryService),
  __decorateParam(10, IHoverService),
  __decorateParam(11, IWorkingCopyService),
  __decorateParam(12, IFilesConfigurationService),
  __decorateParam(13, IOpenerService),
  __decorateParam(14, IFileService)
], OpenEditorsView);
class OpenEditorActionRunner extends ActionRunner {
  async run(action) {
    if (!this.editor) {
      return;
    }
    return super.run(action, { groupId: this.editor.groupId, editorIndex: this.editor.group.getIndexOfEditor(this.editor.editor) });
  }
}
class OpenEditorsDelegate {
  static {
    this.ITEM_HEIGHT = 22;
  }
  getHeight(_element) {
    return OpenEditorsDelegate.ITEM_HEIGHT;
  }
  getTemplateId(element) {
    if (element instanceof OpenEditor) {
      return OpenEditorRenderer.ID;
    }
    return EditorGroupRenderer.ID;
  }
}
class EditorGroupRenderer {
  constructor(keybindingService, instantiationService) {
    this.keybindingService = keybindingService;
    this.instantiationService = instantiationService;
  }
  static {
    this.ID = "editorgroup";
  }
  get templateId() {
    return EditorGroupRenderer.ID;
  }
  renderTemplate(container) {
    const editorGroupTemplate = /* @__PURE__ */ Object.create(null);
    editorGroupTemplate.root = dom.append(container, $(".editor-group"));
    editorGroupTemplate.name = dom.append(editorGroupTemplate.root, $("span.name"));
    editorGroupTemplate.actionBar = new ActionBar(container);
    const saveAllInGroupAction = this.instantiationService.createInstance(SaveAllInGroupAction, SaveAllInGroupAction.ID, SaveAllInGroupAction.LABEL);
    const saveAllInGroupKey = this.keybindingService.lookupKeybinding(saveAllInGroupAction.id);
    editorGroupTemplate.actionBar.push(saveAllInGroupAction, { icon: true, label: false, keybinding: saveAllInGroupKey ? saveAllInGroupKey.getLabel() : void 0 });
    const closeGroupAction = this.instantiationService.createInstance(CloseGroupAction, CloseGroupAction.ID, CloseGroupAction.LABEL);
    const closeGroupActionKey = this.keybindingService.lookupKeybinding(closeGroupAction.id);
    editorGroupTemplate.actionBar.push(closeGroupAction, { icon: true, label: false, keybinding: closeGroupActionKey ? closeGroupActionKey.getLabel() : void 0 });
    return editorGroupTemplate;
  }
  renderElement(editorGroup, _index, templateData) {
    templateData.editorGroup = editorGroup;
    templateData.name.textContent = editorGroup.label;
    templateData.actionBar.context = { groupId: editorGroup.id };
  }
  disposeTemplate(templateData) {
    templateData.actionBar.dispose();
  }
}
class OpenEditorRenderer {
  constructor(labels, instantiationService, keybindingService, configurationService) {
    this.labels = labels;
    this.instantiationService = instantiationService;
    this.keybindingService = keybindingService;
    this.configurationService = configurationService;
    this.closeEditorAction = this.instantiationService.createInstance(CloseEditorAction, CloseEditorAction.ID, CloseEditorAction.LABEL);
    this.unpinEditorAction = this.instantiationService.createInstance(UnpinEditorAction, UnpinEditorAction.ID, UnpinEditorAction.LABEL);
  }
  static {
    this.ID = "openeditor";
  }
  get templateId() {
    return OpenEditorRenderer.ID;
  }
  renderTemplate(container) {
    const editorTemplate = /* @__PURE__ */ Object.create(null);
    editorTemplate.container = container;
    editorTemplate.actionRunner = new OpenEditorActionRunner();
    editorTemplate.actionBar = new ActionBar(container, { actionRunner: editorTemplate.actionRunner });
    editorTemplate.root = this.labels.create(container);
    return editorTemplate;
  }
  renderElement(openedEditor, _index, templateData) {
    const editor = openedEditor.editor;
    templateData.actionRunner.editor = openedEditor;
    templateData.container.classList.toggle("dirty", editor.isDirty() && !editor.isSaving());
    templateData.container.classList.toggle("sticky", openedEditor.isSticky());
    templateData.root.setResource({
      resource: EditorResourceAccessor.getOriginalUri(editor, { supportSideBySide: SideBySideEditor.BOTH }),
      name: editor.getName(),
      description: editor.getDescription(Verbosity.MEDIUM)
    }, {
      italic: openedEditor.isPreview(),
      extraClasses: ["open-editor"].concat(openedEditor.editor.getLabelExtraClasses()),
      fileDecorations: this.configurationService.getValue().explorer.decorations,
      title: editor.getTitle(Verbosity.LONG),
      icon: editor.getIcon()
    });
    const editorAction = openedEditor.isSticky() ? this.unpinEditorAction : this.closeEditorAction;
    if (!templateData.actionBar.hasAction(editorAction)) {
      if (!templateData.actionBar.isEmpty()) {
        templateData.actionBar.clear();
      }
      templateData.actionBar.push(editorAction, { icon: true, label: false, keybinding: this.keybindingService.lookupKeybinding(editorAction.id)?.getLabel() });
    }
  }
  disposeTemplate(templateData) {
    templateData.actionBar.dispose();
    templateData.root.dispose();
    templateData.actionRunner.dispose();
  }
}
class OpenEditorsDragAndDrop {
  constructor(sortOrder, instantiationService, editorGroupService) {
    this.instantiationService = instantiationService;
    this.editorGroupService = editorGroupService;
    this._sortOrder = sortOrder;
  }
  set sortOrder(value) {
    this._sortOrder = value;
  }
  get dropHandler() {
    return this.instantiationService.createInstance(ResourcesDropHandler, { allowWorkspaceOpen: false });
  }
  getDragURI(element) {
    if (element instanceof OpenEditor) {
      const resource = element.getResource();
      if (resource) {
        return resource.toString();
      }
    }
    return null;
  }
  getDragLabel(elements) {
    if (elements.length > 1) {
      return String(elements.length);
    }
    const element = elements[0];
    return element instanceof OpenEditor ? element.editor.getName() : element.label;
  }
  onDragStart(data, originalEvent) {
    const items = data.elements;
    const editors = [];
    if (items) {
      for (const item of items) {
        if (item instanceof OpenEditor) {
          editors.push(item);
        }
      }
    }
    if (editors.length) {
      this.instantiationService.invokeFunction(fillEditorsDragData, editors, originalEvent);
    }
  }
  onDragOver(data, _targetElement, _targetIndex, targetSector, originalEvent) {
    if (data instanceof NativeDragAndDropData) {
      if (!containsDragType(originalEvent, DataTransfers.FILES, CodeDataTransfers.FILES)) {
        return false;
      }
    }
    if (this._sortOrder !== "editorOrder") {
      if (data instanceof ElementsDragAndDropData) {
        return false;
      } else {
        return { accept: true, effect: { type: ListDragOverEffectType.Move }, feedback: [-1] };
      }
    }
    let dropEffectPosition = void 0;
    switch (targetSector) {
      case ListViewTargetSector.TOP:
      case ListViewTargetSector.CENTER_TOP:
        dropEffectPosition = _targetIndex === 0 && _targetElement instanceof EditorGroupView ? ListDragOverEffectPosition.After : ListDragOverEffectPosition.Before;
        break;
      case ListViewTargetSector.CENTER_BOTTOM:
      case ListViewTargetSector.BOTTOM:
        dropEffectPosition = ListDragOverEffectPosition.After;
        break;
    }
    return { accept: true, effect: { type: ListDragOverEffectType.Move, position: dropEffectPosition }, feedback: [_targetIndex] };
  }
  drop(data, targetElement, _targetIndex, targetSector, originalEvent) {
    let group = targetElement instanceof OpenEditor ? targetElement.group : targetElement || this.editorGroupService.groups[this.editorGroupService.count - 1];
    let targetEditorIndex = targetElement instanceof OpenEditor ? targetElement.group.getIndexOfEditor(targetElement.editor) : 0;
    switch (targetSector) {
      case ListViewTargetSector.TOP:
      case ListViewTargetSector.CENTER_TOP:
        if (targetElement instanceof EditorGroupView && group.index !== 0) {
          group = this.editorGroupService.groups[group.index - 1];
          targetEditorIndex = group.count;
        }
        break;
      case ListViewTargetSector.BOTTOM:
      case ListViewTargetSector.CENTER_BOTTOM:
        if (targetElement instanceof OpenEditor) {
          targetEditorIndex++;
        }
        break;
    }
    if (data instanceof ElementsDragAndDropData) {
      for (const oe of data.elements) {
        const sourceEditorIndex = oe.group.getIndexOfEditor(oe.editor);
        if (oe.group === group && sourceEditorIndex < targetEditorIndex) {
          targetEditorIndex--;
        }
        oe.group.moveEditor(oe.editor, group, { index: targetEditorIndex, preserveFocus: true });
        targetEditorIndex++;
      }
      this.editorGroupService.activateGroup(group);
    } else {
      this.dropHandler.handleDrop(originalEvent, mainWindow, () => group, () => group.focus(), { index: targetEditorIndex });
    }
  }
  dispose() {
  }
}
__decorateClass([
  memoize
], OpenEditorsDragAndDrop.prototype, "dropHandler", 1);
class OpenEditorsAccessibilityProvider {
  getWidgetAriaLabel() {
    return nls.localize("openEditors", "Open Editors");
  }
  getAriaLabel(element) {
    if (element instanceof OpenEditor) {
      return `${element.editor.getName()}, ${element.editor.getDescription()}`;
    }
    return element.ariaLabel;
  }
}
const toggleEditorGroupLayoutId = "workbench.action.toggleEditorGroupLayout";
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.toggleEditorGroupLayout",
      title: nls.localize2("flipLayout", "Toggle Vertical/Horizontal Editor Layout"),
      f1: true,
      keybinding: {
        primary: KeyMod.Shift | KeyMod.Alt | KeyCode.Digit0,
        mac: { primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.Digit0 },
        weight: KeybindingWeight.WorkbenchContrib
      },
      icon: Codicon.editorLayout,
      menu: {
        id: MenuId.ViewTitle,
        group: "navigation",
        when: ContextKeyExpr.and(ContextKeyExpr.equals("view", OpenEditorsView.ID), MultipleEditorGroupsContext),
        order: 10
      }
    });
  }
  async run(accessor) {
    const editorGroupService = accessor.get(IEditorGroupsService);
    const newOrientation = editorGroupService.orientation === GroupOrientation.VERTICAL ? GroupOrientation.HORIZONTAL : GroupOrientation.VERTICAL;
    editorGroupService.setGroupOrientation(newOrientation);
    editorGroupService.activeGroup.focus();
  }
});
MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
  group: "5_flip",
  command: {
    id: toggleEditorGroupLayoutId,
    title: {
      ...nls.localize2("miToggleEditorLayoutWithoutMnemonic", "Flip Layout"),
      mnemonicTitle: nls.localize({ key: "miToggleEditorLayout", comment: ["&& denotes a mnemonic"] }, "Flip &&Layout")
    }
  },
  order: 1
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.files.saveAll",
      title: SAVE_ALL_LABEL,
      f1: true,
      icon: Codicon.saveAll,
      menu: {
        id: MenuId.ViewTitle,
        group: "navigation",
        when: ContextKeyExpr.equals("view", OpenEditorsView.ID),
        order: 20
      }
    });
  }
  async run(accessor) {
    const commandService = accessor.get(ICommandService);
    await commandService.executeCommand(SAVE_ALL_COMMAND_ID);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "openEditors.closeAll",
      title: CloseAllEditorsAction.LABEL,
      f1: false,
      icon: Codicon.closeAll,
      menu: {
        id: MenuId.ViewTitle,
        group: "navigation",
        when: ContextKeyExpr.equals("view", OpenEditorsView.ID),
        order: 30
      }
    });
  }
  async run(accessor) {
    const instantiationService = accessor.get(IInstantiationService);
    const closeAll = new CloseAllEditorsAction();
    await instantiationService.invokeFunction((accessor2) => closeAll.run(accessor2));
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "openEditors.newUntitledFile",
      title: nls.localize2("newUntitledFile", "New Untitled Text File"),
      f1: false,
      icon: Codicon.newFile,
      menu: {
        id: MenuId.ViewTitle,
        group: "navigation",
        when: ContextKeyExpr.equals("view", OpenEditorsView.ID),
        order: 5
      }
    });
  }
  async run(accessor) {
    const commandService = accessor.get(ICommandService);
    await commandService.executeCommand(NEW_UNTITLED_FILE_COMMAND_ID);
  }
});
export {
  OpenEditorsView
};
