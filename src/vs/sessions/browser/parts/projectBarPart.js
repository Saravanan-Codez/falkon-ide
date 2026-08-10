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
import "./media/projectBarPart.css";
import { Part } from "../../../workbench/browser/part.js";
import { IWorkbenchLayoutService, Position } from "../../../workbench/services/layout/browser/layoutService.js";
import { IThemeService } from "../../../platform/theme/common/themeService.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../platform/storage/common/storage.js";
import { IWorkspaceContextService } from "../../../platform/workspace/common/workspace.js";
import { IHoverService } from "../../../platform/hover/browser/hover.js";
import { DisposableStore, MutableDisposable } from "../../../base/common/lifecycle.js";
import { $, addDisposableListener, append, clearNode, Dimension, EventType, getActiveDocument, getWindow } from "../../../base/browser/dom.js";
import { Emitter } from "../../../base/common/event.js";
import { ACTIVITY_BAR_BACKGROUND, ACTIVITY_BAR_BADGE_BACKGROUND, ACTIVITY_BAR_BADGE_FOREGROUND, ACTIVITY_BAR_BORDER, ACTIVITY_BAR_FOREGROUND, ACTIVITY_BAR_INACTIVE_FOREGROUND } from "../../../workbench/common/theme.js";
import { contrastBorder } from "../../../platform/theme/common/colorRegistry.js";
import { assertReturnsDefined } from "../../../base/common/types.js";
import { ThemeIcon } from "../../../base/common/themables.js";
import { Codicon } from "../../../base/common/codicons.js";
import { codiconsLibrary } from "../../../base/common/codiconsLibrary.js";
import { Lazy } from "../../../base/common/lazy.js";
import { HoverPosition } from "../../../base/browser/ui/hover/hoverWidget.js";
import { GlobalCompositeBar } from "../../../workbench/browser/parts/globalCompositeBar.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { Action, Separator } from "../../../base/common/actions.js";
import { URI } from "../../../base/common/uri.js";
import { IFileDialogService } from "../../../platform/dialogs/common/dialogs.js";
import { IPathService } from "../../../workbench/services/path/common/pathService.js";
import { IWorkspaceEditingService } from "../../../workbench/services/workspaces/common/workspaceEditing.js";
import { ILabelService } from "../../../platform/label/common/label.js";
import { basename } from "../../../base/common/resources.js";
import { IContextMenuService } from "../../../platform/contextview/browser/contextView.js";
import { StandardMouseEvent } from "../../../base/browser/mouseEvent.js";
import { IQuickInputService } from "../../../platform/quickinput/common/quickInput.js";
import { getIconRegistry } from "../../../platform/theme/common/iconRegistry.js";
import { defaultInputBoxStyles } from "../../../platform/theme/browser/defaultStyles.js";
import { WorkbenchIconSelectBox } from "../../../workbench/services/userDataProfile/browser/iconSelectBox.js";
import { localize } from "../../../nls.js";
import { AgenticParts } from "./parts.js";
const HOVER_GROUP_ID = "projectbar";
const PROJECT_BAR_FOLDERS_KEY = "workbench.agentsession.projectbar.folders";
const icons = new Lazy(() => {
  const iconDefinitions = getIconRegistry().getIcons();
  const includedChars = /* @__PURE__ */ new Set();
  const dedupedIcons = iconDefinitions.filter((e) => {
    if (e.id === codiconsLibrary.blank.id) {
      return false;
    }
    if (ThemeIcon.isThemeIcon(e.defaults)) {
      return false;
    }
    if (includedChars.has(e.defaults.fontCharacter)) {
      return false;
    }
    includedChars.add(e.defaults.fontCharacter);
    return true;
  });
  return dedupedIcons;
});
let ProjectBarPart = class extends Part {
  constructor(layoutService, themeService, storageService, workspaceContextService, fileDialogService, pathService, workspaceEditingService, labelService, hoverService, contextMenuService, quickInputService, instantiationService) {
    super(AgenticParts.PROJECTBAR_PART, { hasTitle: false }, themeService, storageService, layoutService);
    this.storageService = storageService;
    this.workspaceContextService = workspaceContextService;
    this.fileDialogService = fileDialogService;
    this.pathService = pathService;
    this.workspaceEditingService = workspaceEditingService;
    this.labelService = labelService;
    this.hoverService = hoverService;
    this.contextMenuService = contextMenuService;
    this.quickInputService = quickInputService;
    this.instantiationService = instantiationService;
    //#region IView
    this.minimumWidth = 48;
    this.maximumWidth = 48;
    this.minimumHeight = 0;
    this.maximumHeight = Number.POSITIVE_INFINITY;
    this.entries = [];
    this.workspaceEntryDisposables = this._register(new MutableDisposable());
    this._onDidSelectWorkspace = this._register(new Emitter());
    this.onDidSelectWorkspace = this._onDidSelectWorkspace.event;
    this.globalCompositeBar = this._register(instantiationService.createInstance(
      GlobalCompositeBar,
      () => this.getContextMenuActions(),
      (theme) => ({
        activeForegroundColor: theme.getColor(ACTIVITY_BAR_FOREGROUND),
        inactiveForegroundColor: theme.getColor(ACTIVITY_BAR_INACTIVE_FOREGROUND),
        badgeBackground: theme.getColor(ACTIVITY_BAR_BADGE_BACKGROUND),
        badgeForeground: theme.getColor(ACTIVITY_BAR_BADGE_FOREGROUND),
        activeBackgroundColor: void 0,
        inactiveBackgroundColor: void 0,
        activeBorderBottomColor: void 0
      }),
      {
        position: () => this.layoutService.getSideBarPosition() === Position.LEFT ? HoverPosition.RIGHT : HoverPosition.LEFT
      }
    ));
    this.loadEntriesFromStorage();
  }
  static {
    this.ACTION_HEIGHT = 48;
  }
  getContextMenuActions() {
    return this.globalCompositeBar.getContextMenuActions();
  }
  loadEntriesFromStorage() {
    const raw = this.storageService.get(PROJECT_BAR_FOLDERS_KEY, StorageScope.WORKSPACE);
    if (raw) {
      try {
        const data = JSON.parse(raw);
        this.entries = data.map((item) => {
          if (typeof item === "string") {
            const uri = URI.parse(item);
            return { uri, name: basename(uri), displayType: "letter" };
          } else {
            const uri = URI.parse(item.uri);
            return {
              uri,
              name: basename(uri),
              displayType: item.displayType ?? "letter",
              iconId: item.iconId
            };
          }
        });
      } catch {
        this.entries = [];
      }
    } else {
      this.entries = [];
    }
    const currentFolders = this.workspaceContextService.getWorkspace().folders;
    this._selectedFolderUri = currentFolders.length > 0 ? currentFolders[0].uri : void 0;
  }
  saveEntriesToStorage() {
    const data = this.entries.map((e) => ({
      uri: e.uri.toString(),
      displayType: e.displayType,
      iconId: e.iconId
    }));
    this.storageService.store(PROJECT_BAR_FOLDERS_KEY, JSON.stringify(data), StorageScope.WORKSPACE, StorageTarget.MACHINE);
  }
  addFolderEntry(uri) {
    if (this.entries.some((e) => e.uri.toString() === uri.toString())) {
      return;
    }
    this.entries.push({ uri, name: basename(uri), displayType: "letter" });
    this.saveEntriesToStorage();
    this._selectedFolderUri = uri;
    this.saveEntriesToStorage();
    this.applySelectedFolder();
    this._onDidSelectWorkspace.fire(this._selectedFolderUri);
    this.renderContent();
  }
  async applySelectedFolder() {
    if (!this._selectedFolderUri) {
      return;
    }
    const currentFolders = this.workspaceContextService.getWorkspace().folders;
    const foldersToRemove = currentFolders.map((f) => f.uri);
    await this.workspaceEditingService.updateFolders(
      0,
      foldersToRemove.length,
      [{ uri: this._selectedFolderUri }]
    );
  }
  createContentArea(parent) {
    this.element = parent;
    this.content = append(this.element, $(".content"));
    this.actionsContainer = append(this.content, $(".actions-container"));
    this.renderContent();
    this.globalCompositeBar.create(this.content);
    return this.content;
  }
  renderContent() {
    if (!this.actionsContainer) {
      return;
    }
    clearNode(this.actionsContainer);
    this.workspaceEntryDisposables.value = new DisposableStore();
    this.createAddFolderButton(this.actionsContainer);
    this.createWorkspaceEntries(this.actionsContainer);
  }
  createAddFolderButton(container) {
    this.addFolderButton = append(container, $(".action-item.add-folder"));
    const actionLabel = append(this.addFolderButton, $("span.action-label"));
    actionLabel.classList.add(...ThemeIcon.asClassNameArray(Codicon.add));
    this.workspaceEntryDisposables.value?.add(
      this.hoverService.setupDelayedHover(
        this.addFolderButton,
        {
          appearance: { showPointer: true },
          position: { hoverPosition: HoverPosition.RIGHT },
          content: "Add Folder to Project"
        },
        { groupId: HOVER_GROUP_ID }
      )
    );
    this.workspaceEntryDisposables.value?.add(
      addDisposableListener(this.addFolderButton, EventType.CLICK, () => {
        this.pickAndAddFolder();
      })
    );
    this.addFolderButton.setAttribute("tabindex", "0");
    this.addFolderButton.setAttribute("role", "button");
    this.addFolderButton.setAttribute("aria-label", "Add Folder to Project");
    this.workspaceEntryDisposables.value?.add(
      addDisposableListener(this.addFolderButton, EventType.KEY_DOWN, (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.pickAndAddFolder();
        }
      })
    );
  }
  async pickAndAddFolder() {
    const folders = await this.fileDialogService.showOpenDialog({
      openLabel: "Add",
      title: "Add Folder to Project",
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri: await this.fileDialogService.defaultFolderPath(),
      availableFileSystems: [this.pathService.defaultUriScheme]
    });
    if (folders?.length) {
      this.addFolderEntry(folders[0]);
    }
  }
  createWorkspaceEntries(container) {
    for (let i = 0; i < this.entries.length; i++) {
      this.createWorkspaceEntry(container, this.entries[i], i);
    }
    if (this.entries.length > 0 && this._selectedFolderUri) {
      this._onDidSelectWorkspace.fire(this._selectedFolderUri);
    }
  }
  createWorkspaceEntry(container, entry, index) {
    const entryDisposables = this.workspaceEntryDisposables.value;
    const entryElement = append(container, $(".action-item.workspace-entry"));
    const actionLabel = append(entryElement, $("span.action-label.workspace-icon"));
    append(entryElement, $("span.active-item-indicator"));
    const folderName = entry.name;
    if (entry.displayType === "icon" && entry.iconId) {
      const icon = ThemeIcon.fromId(entry.iconId);
      actionLabel.classList.add(...ThemeIcon.asClassNameArray(icon));
      actionLabel.classList.add("codicon-icon");
      actionLabel.textContent = "";
    } else {
      const firstLetter = folderName.charAt(0).toUpperCase();
      actionLabel.textContent = firstLetter;
    }
    const isSelected = this._selectedFolderUri?.toString() === entry.uri.toString();
    if (isSelected) {
      entryElement.classList.add("checked");
    }
    const folderPath = this.labelService.getUriLabel(entry.uri, { relative: false });
    entryDisposables.add(
      this.hoverService.setupDelayedHover(
        entryElement,
        {
          appearance: { showPointer: true },
          position: { hoverPosition: HoverPosition.RIGHT },
          content: folderPath
        },
        { groupId: HOVER_GROUP_ID }
      )
    );
    entryDisposables.add(
      addDisposableListener(entryElement, EventType.CLICK, () => {
        this.selectWorkspace(index);
      })
    );
    entryElement.setAttribute("tabindex", "0");
    entryElement.setAttribute("role", "button");
    entryElement.setAttribute("aria-label", folderName);
    entryElement.setAttribute("aria-pressed", isSelected ? "true" : "false");
    entryDisposables.add(
      addDisposableListener(entryElement, EventType.KEY_DOWN, (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.selectWorkspace(index);
        }
      })
    );
    entryDisposables.add(
      addDisposableListener(entryElement, EventType.CONTEXT_MENU, (e) => {
        e.preventDefault();
        e.stopPropagation();
        const event = new StandardMouseEvent(getWindow(entryElement), e);
        this.contextMenuService.showContextMenu({
          getAnchor: () => event,
          getActions: () => [
            new Action("projectbar.customize", localize("projectbar.customize", "Customize"), void 0, true, () => this.showCustomizeQuickPick(index)),
            new Separator(),
            new Action("projectbar.removeFolder", localize("projectbar.removeFolder", "Remove Folder"), void 0, true, () => this.removeFolderEntry(index))
          ]
        });
      })
    );
  }
  selectWorkspace(index) {
    if (index < 0 || index >= this.entries.length) {
      return;
    }
    const entry = this.entries[index];
    if (this._selectedFolderUri?.toString() === entry.uri.toString()) {
      return;
    }
    this._selectedFolderUri = entry.uri;
    this.saveEntriesToStorage();
    this.renderContent();
    this.applySelectedFolder();
    this._onDidSelectWorkspace.fire(this._selectedFolderUri);
  }
  removeFolderEntry(index) {
    if (index < 0 || index >= this.entries.length) {
      return;
    }
    const removedUri = this.entries[index].uri;
    this.entries.splice(index, 1);
    this.saveEntriesToStorage();
    if (this._selectedFolderUri?.toString() === removedUri.toString()) {
      if (this.entries.length > 0) {
        this._selectedFolderUri = this.entries[0].uri;
        this.applySelectedFolder();
        this._onDidSelectWorkspace.fire(this._selectedFolderUri);
      } else {
        this._selectedFolderUri = void 0;
        this._onDidSelectWorkspace.fire(void 0);
      }
    }
    this.renderContent();
  }
  async showCustomizeQuickPick(index) {
    if (index < 0 || index >= this.entries.length) {
      return;
    }
    const entry = this.entries[index];
    const items = [
      {
        customType: "letter",
        label: localize("projectbar.customize.letter", "Letter"),
        description: localize("projectbar.customize.letter.description", "Show the first letter of the workspace name")
      },
      {
        customType: "icon",
        label: localize("projectbar.customize.icon", "Icon"),
        description: localize("projectbar.customize.icon.description", "Choose a codicon to represent the workspace")
      }
    ];
    const picked = await this.quickInputService.pick(items, {
      placeHolder: localize("projectbar.customize.placeholder", "Choose how to display the workspace in the project bar"),
      title: localize("projectbar.customize.title", "Customize Workspace Appearance")
    });
    if (!picked) {
      return;
    }
    if (picked.customType === "letter") {
      entry.displayType = "letter";
      entry.iconId = void 0;
      this.saveEntriesToStorage();
      this.renderContent();
    } else if (picked.customType === "icon") {
      const icon = await this.pickIcon();
      if (icon) {
        entry.displayType = "icon";
        entry.iconId = icon.id;
        this.saveEntriesToStorage();
        this.renderContent();
      }
    }
  }
  async pickIcon() {
    const iconSelectBox = this.instantiationService.createInstance(WorkbenchIconSelectBox, {
      icons: icons.value,
      inputBoxStyles: defaultInputBoxStyles
    });
    const dimension = new Dimension(486, 260);
    return new Promise((resolve) => {
      const disposables = new DisposableStore();
      disposables.add(iconSelectBox.onDidSelect((e) => {
        resolve(e);
        disposables.dispose();
        iconSelectBox.dispose();
      }));
      iconSelectBox.clearInput();
      const body = getActiveDocument().body;
      const bodyRect = body.getBoundingClientRect();
      const hoverWidget = this.hoverService.showInstantHover({
        content: iconSelectBox.domNode,
        target: {
          targetElements: [body],
          x: bodyRect.left + (bodyRect.width - dimension.width) / 2,
          y: bodyRect.top + this.layoutService.activeContainerOffset.top
        },
        position: {
          hoverPosition: HoverPosition.BELOW
        },
        persistence: {
          sticky: true
        }
      }, true);
      if (hoverWidget) {
        disposables.add(hoverWidget);
      }
      iconSelectBox.layout(dimension);
      iconSelectBox.focus();
    });
  }
  get selectedWorkspaceFolder() {
    return this._selectedFolderUri;
  }
  updateStyles() {
    super.updateStyles();
    const container = assertReturnsDefined(this.getContainer());
    const background = this.getColor(ACTIVITY_BAR_BACKGROUND) || "";
    container.style.backgroundColor = background;
    const borderColor = this.getColor(ACTIVITY_BAR_BORDER) || this.getColor(contrastBorder) || "";
    container.classList.toggle("bordered", !!borderColor);
    container.style.borderColor = borderColor ? borderColor : "";
  }
  focus() {
    this.addFolderButton?.focus();
  }
  focusGlobalCompositeBar() {
    this.globalCompositeBar.focus();
  }
  layout(width, height) {
    super.layout(width, height, 0, 0);
  }
  toJSON() {
    return {
      type: AgenticParts.PROJECTBAR_PART
    };
  }
};
ProjectBarPart = __decorateClass([
  __decorateParam(0, IWorkbenchLayoutService),
  __decorateParam(1, IThemeService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, IWorkspaceContextService),
  __decorateParam(4, IFileDialogService),
  __decorateParam(5, IPathService),
  __decorateParam(6, IWorkspaceEditingService),
  __decorateParam(7, ILabelService),
  __decorateParam(8, IHoverService),
  __decorateParam(9, IContextMenuService),
  __decorateParam(10, IQuickInputService),
  __decorateParam(11, IInstantiationService)
], ProjectBarPart);
export {
  ProjectBarPart
};
