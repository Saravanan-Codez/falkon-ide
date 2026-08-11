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
import "./media/editordroptarget.css";
import { DataTransfers } from "../../../../base/browser/dnd.js";
import { $, addDisposableListener, DragAndDropObserver, EventHelper, EventType, getWindow, isAncestor } from "../../../../base/browser/dom.js";
import { renderFormattedText } from "../../../../base/browser/formattedTextRenderer.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { toDisposable } from "../../../../base/common/lifecycle.js";
import { isMacintosh, isWeb } from "../../../../base/common/platform.js";
import { assertReturnsAllDefined, assertReturnsDefined } from "../../../../base/common/types.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { activeContrastBorder } from "../../../../platform/theme/common/colorRegistry.js";
import { IThemeService, Themable } from "../../../../platform/theme/common/themeService.js";
import { isTemporaryWorkspace, IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { CodeDataTransfers, containsDragType, Extensions as DragAndDropExtensions, LocalSelectionTransfer } from "../../../../platform/dnd/browser/dnd.js";
import { DraggedEditorGroupIdentifier, DraggedEditorIdentifier, extractTreeDropData, ResourcesDropHandler } from "../../dnd.js";
import { prepareMoveCopyEditors } from "./editor.js";
import { EditorInputCapabilities } from "../../../common/editor.js";
import { EDITOR_DRAG_AND_DROP_BACKGROUND, EDITOR_DROP_INTO_PROMPT_BACKGROUND, EDITOR_DROP_INTO_PROMPT_BORDER, EDITOR_DROP_INTO_PROMPT_FOREGROUND } from "../../../common/theme.js";
import { GroupDirection, IEditorGroupsService, MergeGroupMode } from "../../../services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { ITreeViewsDnDService } from "../../../../editor/common/services/treeViewsDndService.js";
import { DraggedTreeItemsIdentifier } from "../../../../editor/common/services/treeViewsDnd.js";
function isDropIntoEditorEnabledGlobally(configurationService) {
  return configurationService.getValue("editor.dropIntoEditor.enabled");
}
function isDragIntoEditorEvent(e) {
  return e.shiftKey;
}
let DropOverlay = class extends Themable {
  constructor(groupView, themeService, configurationService, instantiationService, editorService, editorGroupService, treeViewsDragAndDropService, contextService) {
    super(themeService);
    this.groupView = groupView;
    this.configurationService = configurationService;
    this.instantiationService = instantiationService;
    this.editorService = editorService;
    this.editorGroupService = editorGroupService;
    this.treeViewsDragAndDropService = treeViewsDragAndDropService;
    this.contextService = contextService;
    this.editorTransfer = LocalSelectionTransfer.getInstance();
    this.groupTransfer = LocalSelectionTransfer.getInstance();
    this.treeItemsTransfer = LocalSelectionTransfer.getInstance();
    this.cleanupOverlayScheduler = this._register(new RunOnceScheduler(() => this.dispose(), 300));
    this.enableDropIntoEditor = isDropIntoEditorEnabledGlobally(this.configurationService) && this.isDropIntoActiveEditorEnabled();
    this.create();
  }
  static {
    this.OVERLAY_ID = "monaco-workbench-editor-drop-overlay";
  }
  get disposed() {
    return !!this._disposed;
  }
  create() {
    const overlayOffsetHeight = this.getOverlayOffsetHeight();
    const container = this.container = $("div", { id: DropOverlay.OVERLAY_ID });
    container.style.top = `${overlayOffsetHeight}px`;
    this.groupView.element.appendChild(container);
    this.groupView.element.classList.add("dragged-over");
    this._register(toDisposable(() => {
      container.remove();
      this.groupView.element.classList.remove("dragged-over");
    }));
    this.overlay = $(".editor-group-overlay-indicator");
    container.appendChild(this.overlay);
    if (this.enableDropIntoEditor) {
      this.dropIntoPromptElement = renderFormattedText(localize("dropIntoEditorPrompt", "Hold __{0}__ to drop into editor", isMacintosh ? "\u21E7" : "Shift"), {});
      this.dropIntoPromptElement.classList.add("editor-group-overlay-drop-into-prompt");
      this.overlay.appendChild(this.dropIntoPromptElement);
    }
    this.registerListeners(container);
    this.updateStyles();
  }
  updateStyles() {
    const overlay = assertReturnsDefined(this.overlay);
    overlay.style.backgroundColor = this.getColor(EDITOR_DRAG_AND_DROP_BACKGROUND) || "";
    const activeContrastBorderColor = this.getColor(activeContrastBorder);
    overlay.style.outlineColor = activeContrastBorderColor || "";
    overlay.style.outlineOffset = activeContrastBorderColor ? "-2px" : "";
    overlay.style.outlineStyle = activeContrastBorderColor ? "dashed" : "";
    overlay.style.outlineWidth = activeContrastBorderColor ? "2px" : "";
    if (this.dropIntoPromptElement) {
      this.dropIntoPromptElement.style.backgroundColor = this.getColor(EDITOR_DROP_INTO_PROMPT_BACKGROUND) ?? "";
      this.dropIntoPromptElement.style.color = this.getColor(EDITOR_DROP_INTO_PROMPT_FOREGROUND) ?? "";
      const borderColor = this.getColor(EDITOR_DROP_INTO_PROMPT_BORDER);
      if (borderColor) {
        this.dropIntoPromptElement.style.borderWidth = "1px";
        this.dropIntoPromptElement.style.borderStyle = "solid";
        this.dropIntoPromptElement.style.borderColor = borderColor;
      } else {
        this.dropIntoPromptElement.style.borderWidth = "0";
      }
    }
  }
  registerListeners(container) {
    this._register(new DragAndDropObserver(container, {
      onDragOver: (e) => {
        if (this.enableDropIntoEditor && isDragIntoEditorEvent(e)) {
          this.dispose();
          return;
        }
        const isDraggingGroup = this.groupTransfer.hasData(DraggedEditorGroupIdentifier.prototype);
        const isDraggingEditor = this.editorTransfer.hasData(DraggedEditorIdentifier.prototype);
        if (!isDraggingEditor && !isDraggingGroup && e.dataTransfer) {
          e.dataTransfer.dropEffect = "copy";
        }
        let isCopy = true;
        if (isDraggingGroup) {
          isCopy = this.isCopyOperation(e);
        } else if (isDraggingEditor) {
          const data = this.editorTransfer.getData(DraggedEditorIdentifier.prototype);
          if (Array.isArray(data) && data.length > 0) {
            isCopy = this.isCopyOperation(e, data[0].identifier);
          }
        }
        if (!isCopy) {
          const sourceGroupView = this.findSourceGroupView();
          if (sourceGroupView === this.groupView) {
            if (isDraggingGroup || isDraggingEditor && sourceGroupView.count < 2) {
              this.hideOverlay();
              return;
            }
          }
        }
        let splitOnDragAndDrop = !!this.groupView.groupsView.partOptions.splitOnDragAndDrop;
        if (this.isToggleSplitOperation(e)) {
          splitOnDragAndDrop = !splitOnDragAndDrop;
        }
        this.positionOverlay(e.offsetX, e.offsetY, isDraggingGroup, splitOnDragAndDrop);
        if (this.cleanupOverlayScheduler.isScheduled()) {
          this.cleanupOverlayScheduler.cancel();
        }
      },
      onDragLeave: (e) => this.dispose(),
      onDragEnd: (e) => this.dispose(),
      onDrop: (e) => {
        EventHelper.stop(e, true);
        this.dispose();
        if (this.currentDropOperation) {
          this.handleDrop(e, this.currentDropOperation.splitDirection);
        }
      }
    }));
    this._register(addDisposableListener(container, EventType.MOUSE_OVER, () => {
      if (!this.cleanupOverlayScheduler.isScheduled()) {
        this.cleanupOverlayScheduler.schedule();
      }
    }));
  }
  isDropIntoActiveEditorEnabled() {
    return !!this.groupView.activeEditor?.hasCapability(EditorInputCapabilities.CanDropIntoEditor);
  }
  findSourceGroupView() {
    if (this.groupTransfer.hasData(DraggedEditorGroupIdentifier.prototype)) {
      const data = this.groupTransfer.getData(DraggedEditorGroupIdentifier.prototype);
      if (Array.isArray(data) && data.length > 0) {
        return this.editorGroupService.getGroup(data[0].identifier);
      }
    } else if (this.editorTransfer.hasData(DraggedEditorIdentifier.prototype)) {
      const data = this.editorTransfer.getData(DraggedEditorIdentifier.prototype);
      if (Array.isArray(data) && data.length > 0) {
        return this.editorGroupService.getGroup(data[0].identifier.groupId);
      }
    }
    return void 0;
  }
  async handleDrop(event, splitDirection) {
    const ensureTargetGroup = () => {
      let targetGroup;
      if (typeof splitDirection === "number") {
        targetGroup = this.editorGroupService.addGroup(this.groupView, splitDirection);
      } else {
        targetGroup = this.groupView;
      }
      return targetGroup;
    };
    if (this.groupTransfer.hasData(DraggedEditorGroupIdentifier.prototype)) {
      const data = this.groupTransfer.getData(DraggedEditorGroupIdentifier.prototype);
      if (Array.isArray(data) && data.length > 0) {
        const sourceGroup = this.editorGroupService.getGroup(data[0].identifier);
        if (sourceGroup) {
          if (typeof splitDirection !== "number" && sourceGroup === this.groupView) {
            return;
          }
          let targetGroup;
          if (typeof splitDirection === "number") {
            if (this.isCopyOperation(event)) {
              targetGroup = this.editorGroupService.copyGroup(sourceGroup, this.groupView, splitDirection);
            } else {
              targetGroup = this.editorGroupService.moveGroup(sourceGroup, this.groupView, splitDirection);
            }
          } else {
            let mergeGroupOptions = void 0;
            if (this.isCopyOperation(event)) {
              mergeGroupOptions = { mode: MergeGroupMode.COPY_EDITORS };
            }
            this.editorGroupService.mergeGroup(sourceGroup, this.groupView, mergeGroupOptions);
          }
          if (targetGroup) {
            this.editorGroupService.activateGroup(targetGroup);
          }
        }
        this.groupTransfer.clearData(DraggedEditorGroupIdentifier.prototype);
      }
    } else if (this.editorTransfer.hasData(DraggedEditorIdentifier.prototype)) {
      const data = this.editorTransfer.getData(DraggedEditorIdentifier.prototype);
      if (Array.isArray(data) && data.length > 0) {
        const draggedEditors = data;
        const firstDraggedEditor = data[0].identifier;
        const sourceGroup = this.editorGroupService.getGroup(firstDraggedEditor.groupId);
        if (sourceGroup) {
          const copyEditor = this.isCopyOperation(event, firstDraggedEditor);
          let targetGroup = void 0;
          if (this.groupView.groupsView.partOptions.closeEmptyGroups && sourceGroup.count === 1 && typeof splitDirection === "number" && !copyEditor) {
            targetGroup = this.editorGroupService.moveGroup(sourceGroup, this.groupView, splitDirection);
          } else {
            targetGroup = ensureTargetGroup();
            if (sourceGroup === targetGroup) {
              return;
            }
            const editorsWithOptions = prepareMoveCopyEditors(this.groupView, draggedEditors.map((editor) => editor.identifier.editor));
            if (!copyEditor) {
              sourceGroup.moveEditors(editorsWithOptions, targetGroup);
            } else {
              sourceGroup.copyEditors(editorsWithOptions, targetGroup);
            }
          }
          targetGroup.focus();
        }
        this.editorTransfer.clearData(DraggedEditorIdentifier.prototype);
      }
    } else if (this.treeItemsTransfer.hasData(DraggedTreeItemsIdentifier.prototype)) {
      const data = this.treeItemsTransfer.getData(DraggedTreeItemsIdentifier.prototype);
      if (Array.isArray(data) && data.length > 0) {
        const editors = [];
        for (const id of data) {
          const dataTransferItem = await this.treeViewsDragAndDropService.removeDragOperationTransfer(id.identifier);
          if (dataTransferItem) {
            const treeDropData = await extractTreeDropData(dataTransferItem);
            editors.push(...treeDropData.map((editor) => ({ ...editor, options: { ...editor.options, pinned: true } })));
          }
        }
        if (editors.length) {
          this.editorService.openEditors(editors, ensureTargetGroup(), { validateTrust: true });
        }
      }
      this.treeItemsTransfer.clearData(DraggedTreeItemsIdentifier.prototype);
    } else {
      const dropHandler = this.instantiationService.createInstance(ResourcesDropHandler, { allowWorkspaceOpen: !isWeb || isTemporaryWorkspace(this.contextService.getWorkspace()) });
      dropHandler.handleDrop(event, getWindow(this.groupView.element), () => ensureTargetGroup(), (targetGroup) => targetGroup?.focus());
    }
  }
  isCopyOperation(e, draggedEditor) {
    if (draggedEditor?.editor.hasCapability(EditorInputCapabilities.Singleton)) {
      return false;
    }
    return e.ctrlKey && !isMacintosh || e.altKey && isMacintosh;
  }
  isToggleSplitOperation(e) {
    return e.altKey && !isMacintosh || e.shiftKey && isMacintosh;
  }
  positionOverlay(mousePosX, mousePosY, isDraggingGroup, enableSplitting) {
    const preferSplitVertically = this.groupView.groupsView.partOptions.openSideBySideDirection === "right";
    const editorControlWidth = this.groupView.element.clientWidth;
    const editorControlHeight = this.groupView.element.clientHeight - this.getOverlayOffsetHeight();
    let edgeWidthThresholdFactor;
    let edgeHeightThresholdFactor;
    if (enableSplitting) {
      if (isDraggingGroup) {
        edgeWidthThresholdFactor = preferSplitVertically ? 0.3 : 0.1;
      } else {
        edgeWidthThresholdFactor = 0.1;
      }
      if (isDraggingGroup) {
        edgeHeightThresholdFactor = preferSplitVertically ? 0.1 : 0.3;
      } else {
        edgeHeightThresholdFactor = 0.1;
      }
    } else {
      edgeWidthThresholdFactor = 0;
      edgeHeightThresholdFactor = 0;
    }
    const edgeWidthThreshold = editorControlWidth * edgeWidthThresholdFactor;
    const edgeHeightThreshold = editorControlHeight * edgeHeightThresholdFactor;
    const splitWidthThreshold = editorControlWidth / 3;
    const splitHeightThreshold = editorControlHeight / 3;
    let splitDirection;
    if (mousePosX > edgeWidthThreshold && mousePosX < editorControlWidth - edgeWidthThreshold && mousePosY > edgeHeightThreshold && mousePosY < editorControlHeight - edgeHeightThreshold) {
      splitDirection = void 0;
    } else {
      if (preferSplitVertically) {
        if (mousePosX < splitWidthThreshold) {
          splitDirection = GroupDirection.LEFT;
        } else if (mousePosX > splitWidthThreshold * 2) {
          splitDirection = GroupDirection.RIGHT;
        } else if (mousePosY < editorControlHeight / 2) {
          splitDirection = GroupDirection.UP;
        } else {
          splitDirection = GroupDirection.DOWN;
        }
      } else {
        if (mousePosY < splitHeightThreshold) {
          splitDirection = GroupDirection.UP;
        } else if (mousePosY > splitHeightThreshold * 2) {
          splitDirection = GroupDirection.DOWN;
        } else if (mousePosX < editorControlWidth / 2) {
          splitDirection = GroupDirection.LEFT;
        } else {
          splitDirection = GroupDirection.RIGHT;
        }
      }
    }
    switch (splitDirection) {
      case GroupDirection.UP:
        this.doPositionOverlay({ top: "0", left: "0", width: "100%", height: "50%" });
        this.toggleDropIntoPrompt(false);
        break;
      case GroupDirection.DOWN:
        this.doPositionOverlay({ top: "50%", left: "0", width: "100%", height: "50%" });
        this.toggleDropIntoPrompt(false);
        break;
      case GroupDirection.LEFT:
        this.doPositionOverlay({ top: "0", left: "0", width: "50%", height: "100%" });
        this.toggleDropIntoPrompt(false);
        break;
      case GroupDirection.RIGHT:
        this.doPositionOverlay({ top: "0", left: "50%", width: "50%", height: "100%" });
        this.toggleDropIntoPrompt(false);
        break;
      default:
        this.doPositionOverlay({ top: "0", left: "0", width: "100%", height: "100%" });
        this.toggleDropIntoPrompt(true);
    }
    const overlay = assertReturnsDefined(this.overlay);
    overlay.style.opacity = "1";
    setTimeout(() => overlay.classList.add("overlay-move-transition"), 0);
    this.currentDropOperation = { splitDirection };
  }
  doPositionOverlay(options) {
    const [container, overlay] = assertReturnsAllDefined(this.container, this.overlay);
    const offsetHeight = this.getOverlayOffsetHeight();
    if (offsetHeight) {
      container.style.height = `calc(100% - ${offsetHeight}px)`;
    } else {
      container.style.height = "100%";
    }
    overlay.style.top = options.top;
    overlay.style.left = options.left;
    overlay.style.width = options.width;
    overlay.style.height = options.height;
  }
  getOverlayOffsetHeight() {
    if (!this.groupView.isEmpty && this.groupView.groupsView.partOptions.showTabs === "multiple") {
      return this.groupView.titleHeight.offset;
    }
    return 0;
  }
  hideOverlay() {
    const overlay = assertReturnsDefined(this.overlay);
    this.doPositionOverlay({ top: "0", left: "0", width: "100%", height: "100%" });
    overlay.style.opacity = "0";
    overlay.classList.remove("overlay-move-transition");
    this.currentDropOperation = void 0;
  }
  toggleDropIntoPrompt(showing) {
    if (!this.dropIntoPromptElement) {
      return;
    }
    this.dropIntoPromptElement.style.opacity = showing ? "1" : "0";
  }
  contains(element) {
    return element === this.container || element === this.overlay;
  }
  dispose() {
    super.dispose();
    this._disposed = true;
  }
};
DropOverlay = __decorateClass([
  __decorateParam(1, IThemeService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IEditorService),
  __decorateParam(5, IEditorGroupsService),
  __decorateParam(6, ITreeViewsDnDService),
  __decorateParam(7, IWorkspaceContextService)
], DropOverlay);
let EditorDropTarget = class extends Themable {
  constructor(groupsView, container, delegate, editorGroupService, themeService, configurationService, instantiationService) {
    super(themeService);
    this.groupsView = groupsView;
    this.container = container;
    this.delegate = delegate;
    this.editorGroupService = editorGroupService;
    this.configurationService = configurationService;
    this.instantiationService = instantiationService;
    this.counter = 0;
    this.editorTransfer = LocalSelectionTransfer.getInstance();
    this.groupTransfer = LocalSelectionTransfer.getInstance();
    this.registerListeners();
  }
  get overlay() {
    if (this._overlay && !this._overlay.disposed) {
      return this._overlay;
    }
    return void 0;
  }
  registerListeners() {
    this._register(addDisposableListener(this.container, EventType.DRAG_ENTER, (e) => this.onDragEnter(e)));
    this._register(addDisposableListener(this.container, EventType.DRAG_LEAVE, () => this.onDragLeave()));
    for (const target of [this.container, getWindow(this.container)]) {
      this._register(addDisposableListener(target, EventType.DRAG_END, () => this.onDragEnd()));
    }
  }
  onDragEnter(event) {
    if (isDropIntoEditorEnabledGlobally(this.configurationService) && isDragIntoEditorEvent(event)) {
      return;
    }
    this.counter++;
    if (!this.editorTransfer.hasData(DraggedEditorIdentifier.prototype) && !this.groupTransfer.hasData(DraggedEditorGroupIdentifier.prototype) && event.dataTransfer) {
      const dndContributions = Registry.as(DragAndDropExtensions.DragAndDropContribution).getAll();
      const dndContributionKeys = Array.from(dndContributions).map((e) => e.dataFormatKey);
      if (!containsDragType(event, DataTransfers.FILES, CodeDataTransfers.FILES, DataTransfers.RESOURCES, CodeDataTransfers.EDITORS, ...dndContributionKeys)) {
        event.dataTransfer.dropEffect = "none";
        return;
      }
    }
    if (!this.groupsView.partOptions.allowDropIntoGroup) {
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "none";
      }
      return;
    }
    this.updateContainer(true);
    const target = event.target;
    if (target) {
      if (this.overlay && !this.overlay.contains(target)) {
        this.disposeOverlay();
      }
      if (!this.overlay) {
        const targetGroupView = this.findTargetGroupView(target);
        if (targetGroupView) {
          this._overlay = this.instantiationService.createInstance(DropOverlay, targetGroupView);
        }
      }
    }
  }
  onDragLeave() {
    this.counter--;
    if (this.counter === 0) {
      this.updateContainer(false);
    }
  }
  onDragEnd() {
    this.counter = 0;
    this.updateContainer(false);
    this.disposeOverlay();
  }
  findTargetGroupView(child) {
    const groups = this.editorGroupService.groups;
    return groups.find((groupView) => isAncestor(child, groupView.element) || this.delegate.containsGroup?.(groupView));
  }
  updateContainer(isDraggedOver) {
    this.container.classList.toggle("dragged-over", isDraggedOver);
  }
  dispose() {
    super.dispose();
    this.disposeOverlay();
  }
  disposeOverlay() {
    if (this.overlay) {
      this.overlay.dispose();
      this._overlay = void 0;
    }
  }
};
EditorDropTarget = __decorateClass([
  __decorateParam(3, IEditorGroupsService),
  __decorateParam(4, IThemeService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IInstantiationService)
], EditorDropTarget);
export {
  EditorDropTarget
};
