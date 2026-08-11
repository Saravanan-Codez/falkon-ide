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
import "./media/sessionFilesWidget.css";
import * as dom from "../../../../base/browser/dom.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { Gesture, EventType as TouchEventType } from "../../../../base/browser/touch.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { toAction } from "../../../../base/common/actions.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { autorun } from "../../../../base/common/observable.js";
import { basename } from "../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { localize } from "../../../../nls.js";
import { WorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { FileKind, IFileService } from "../../../../platform/files/common/files.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { WorkbenchList } from "../../../../platform/list/browser/listService.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { DEFAULT_LABELS_CONTAINER, ResourceLabels } from "../../../../workbench/browser/labels.js";
import { createFileIconThemableTreeContainerScope } from "../../../../workbench/contrib/files/browser/views/explorerView.js";
import { ACTIVE_GROUP, IEditorService } from "../../../../workbench/services/editor/common/editorService.js";
import { SessionFileOperation } from "../../../services/sessions/common/session.js";
const $ = dom.$;
class SessionFileListDelegate {
  static {
    this.ITEM_HEIGHT = 22;
  }
  getHeight(_element) {
    return SessionFileListDelegate.ITEM_HEIGHT;
  }
  getTemplateId(_element) {
    return SessionFileListRenderer.TEMPLATE_ID;
  }
}
let SessionFileListRenderer = class {
  constructor(_labels, _onOpenFile, _labelService, _instantiationService) {
    this._labels = _labels;
    this._onOpenFile = _onOpenFile;
    this._labelService = _labelService;
    this._instantiationService = _instantiationService;
    this.templateId = SessionFileListRenderer.TEMPLATE_ID;
  }
  static {
    this.TEMPLATE_ID = "sessionFile";
  }
  renderTemplate(container) {
    const templateDisposables = new DisposableStore();
    const row = dom.append(container, $(".session-files-widget-file"));
    const label = templateDisposables.add(this._labels.create(row));
    const actionBarContainer = $(".chat-collapsible-list-action-bar");
    const toolbar = templateDisposables.add(this._instantiationService.createInstance(WorkbenchToolBar, actionBarContainer, void 0));
    label.element.appendChild(actionBarContainer);
    return { label, toolbar, templateDisposables };
  }
  renderElement(element, _index, templateData) {
    templateData.label.setResource({
      resource: element.uri,
      name: basename(element.uri)
    }, {
      fileKind: FileKind.FILE,
      fileDecorations: void 0,
      strikethrough: element.operation === SessionFileOperation.Deleted,
      title: getSessionFileTitle(element, this._labelService)
    });
    templateData.toolbar.setActions([toAction({
      id: "sessionFiles.openFile",
      label: localize("sessionFiles.openFileAction", "Open File"),
      class: ThemeIcon.asClassName(Codicon.goToFile),
      run: () => this._onOpenFile(element)
    })]);
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
};
SessionFileListRenderer = __decorateClass([
  __decorateParam(2, ILabelService),
  __decorateParam(3, IInstantiationService)
], SessionFileListRenderer);
let SessionFilesWidget = class extends Disposable {
  constructor(container, _instantiationService, _labelService, _editorService, _hoverService, _fileService, _themeService) {
    super();
    this._instantiationService = _instantiationService;
    this._labelService = _labelService;
    this._editorService = _editorService;
    this._hoverService = _hoverService;
    this._fileService = _fileService;
    this._themeService = _themeService;
    this._onDidChangeHeight = this._register(new Emitter());
    this.onDidChangeHeight = this._onDidChangeHeight.event;
    this._onDidToggleCollapsed = this._register(new Emitter());
    this.onDidToggleCollapsed = this._onDidToggleCollapsed.event;
    this._fileCount = 0;
    this._collapsed = false;
    this._labels = this._register(this._instantiationService.createInstance(ResourceLabels, DEFAULT_LABELS_CONTAINER));
    this._domNode = dom.append(container, $(".session-files-widget"));
    this._domNode.style.display = "none";
    this._register(createFileIconThemableTreeContainerScope(this._domNode, this._themeService));
    this._headerNode = dom.append(this._domNode, $(".session-files-widget-header"));
    this._titleNode = dom.append(this._headerNode, $(".session-files-widget-title"));
    this._titleLabelNode = dom.append(this._titleNode, $(".session-files-widget-title-label"));
    this._titleLabelNode.textContent = localize("sessionFiles.label", "Other Files");
    this._countNode = dom.append(this._headerNode, $(".session-files-widget-count.hidden"));
    this._chevronNode = dom.append(this._headerNode, $(".group-chevron"));
    this._chevronNode.classList.add(...ThemeIcon.asClassNameArray(Codicon.chevronDown));
    this._headerNode.setAttribute("role", "button");
    this._headerNode.setAttribute("aria-label", localize("sessionFiles.toggle", "Toggle Other Files"));
    this._headerNode.setAttribute("aria-expanded", "true");
    this._headerNode.tabIndex = 0;
    this._register(this._hoverService.setupManagedHover(
      getDefaultHoverDelegate("mouse"),
      this._headerNode,
      localize("sessionFiles.hover", "Files created, edited, or deleted outside the workspace during this session. These files are not part of the workspace and won't be committed.")
    ));
    this._register(Gesture.addTarget(this._headerNode));
    for (const eventType of [dom.EventType.CLICK, TouchEventType.Tap]) {
      this._register(dom.addDisposableListener(this._headerNode, eventType, () => {
        this._toggleCollapsed();
      }));
    }
    this._register(dom.addDisposableListener(this._headerNode, dom.EventType.KEY_DOWN, (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target === this._headerNode) {
        e.preventDefault();
        this._toggleCollapsed();
      }
    }));
    const bodyId = "session-files-widget-body";
    this._bodyNode = dom.append(this._domNode, $(`.${bodyId}`));
    this._bodyNode.id = bodyId;
    this._headerNode.setAttribute("aria-controls", bodyId);
    const listContainer = $(".session-files-widget-list");
    this._list = this._register(this._instantiationService.createInstance(
      WorkbenchList,
      "SessionFilesWidget",
      listContainer,
      new SessionFileListDelegate(),
      [this._instantiationService.createInstance(SessionFileListRenderer, this._labels, (file) => this._openFilePlain(file))],
      {
        multipleSelectionSupport: false,
        openOnSingleClick: true,
        accessibilityProvider: {
          getWidgetAriaLabel: () => localize("sessionFiles.listAriaLabel", "Other Files"),
          getAriaLabel: (item) => localize("sessionFiles.fileAriaLabel", "{0}, {1}", basename(item.uri), getSessionFileOperationLabel(item.operation))
        },
        keyboardNavigationLabelProvider: {
          getKeyboardNavigationLabel: (item) => basename(item.uri)
        }
      }
    ));
    this._bodyNode.appendChild(listContainer);
    this._register(this._list.onDidOpen((e) => {
      if (e.element) {
        void this._openFile(e.element, !!e.editorOptions?.preserveFocus, !!e.editorOptions?.pinned);
      }
    }));
  }
  static {
    this.HEADER_HEIGHT = 34;
  }
  static {
    // 6px header margin-top + 8px header padding + 20px header min-height
    this.MIN_BODY_HEIGHT = 3 * SessionFileListDelegate.ITEM_HEIGHT;
  }
  static {
    this.PREFERRED_BODY_HEIGHT = 3 * SessionFileListDelegate.ITEM_HEIGHT;
  }
  static {
    this.MAX_BODY_HEIGHT = 240;
  }
  get element() {
    return this._domNode;
  }
  /** The full content height the widget would like (header + all files). */
  get desiredHeight() {
    if (this._fileCount === 0) {
      return 0;
    }
    if (this._collapsed) {
      return SessionFilesWidget.HEADER_HEIGHT;
    }
    return SessionFilesWidget.HEADER_HEIGHT + this._fileCount * SessionFileListDelegate.ITEM_HEIGHT;
  }
  /** Whether the widget is currently visible (has files to show). */
  get visible() {
    return this._fileCount > 0;
  }
  /** Whether the body is collapsed (header-only). */
  get collapsed() {
    return this._collapsed;
  }
  setInput(input) {
    return autorun((reader) => {
      const files = input.sessionFilesObs.read(reader);
      const oldCount = this._fileCount;
      this._fileCount = files.length;
      if (files.length === 0) {
        this._renderBody([]);
        this._domNode.style.display = "none";
        if (oldCount !== 0) {
          this._onDidChangeHeight.fire();
        }
        return;
      }
      this._domNode.style.display = "";
      this._renderBody(files);
      this._renderCount();
      if (this._fileCount !== oldCount) {
        this._onDidChangeHeight.fire();
      }
    });
  }
  /**
   * Layout the widget body list to the given height.
   * Called by the parent view after computing available space.
   */
  layout(height) {
    if (this._collapsed) {
      this._bodyNode.style.display = "none";
      return;
    }
    this._bodyNode.style.display = "";
    this._list.layout(height);
  }
  _toggleCollapsed() {
    this.setCollapsed(!this._collapsed);
  }
  /** Sets the collapsed state and notifies the SplitView layout. */
  setCollapsed(collapsed) {
    if (this._collapsed === collapsed) {
      return;
    }
    this._setCollapsed(collapsed);
    this._onDidToggleCollapsed.fire(collapsed);
    this._onDidChangeHeight.fire();
  }
  /**
   * Expand the body if it is currently collapsed, notifying listeners so the
   * parent pane restores its size. No-op when already expanded.
   */
  expand() {
    this.setCollapsed(false);
  }
  /**
   * Move keyboard focus into the files list. Falls back to the header when the
   * body is collapsed or there is nothing to focus.
   */
  focus() {
    if (this._collapsed || this._fileCount === 0) {
      this._headerNode.focus();
      return;
    }
    this._list.domFocus();
    if (this._list.length > 0 && this._list.getFocus().length === 0) {
      this._list.setFocus([0]);
    }
  }
  _setCollapsed(collapsed) {
    this._collapsed = collapsed;
    this._updateChevron();
    this._headerNode.classList.toggle("collapsed", collapsed);
    this._headerNode.setAttribute("aria-expanded", String(!collapsed));
    this._renderCount();
  }
  /** Show the file count in the header only while collapsed. */
  _renderCount() {
    this._countNode.textContent = this._fileCount > 0 ? `${this._fileCount}` : "";
    this._countNode.classList.toggle("hidden", !this._collapsed || this._fileCount === 0);
  }
  _updateChevron() {
    this._chevronNode.className = "group-chevron";
    this._chevronNode.classList.add(
      ...ThemeIcon.asClassNameArray(
        this._collapsed ? Codicon.chevronRight : Codicon.chevronDown
      )
    );
  }
  _renderBody(files) {
    this._list.splice(0, this._list.length, files);
  }
  async _openFile(file, preserveFocus, pinned) {
    if (file.operation === SessionFileOperation.Modified && file.originalUri && await this._hasContent(file.originalUri)) {
      await this._editorService.openEditor({
        original: { resource: file.originalUri },
        modified: { resource: file.uri },
        label: getDiffEditorLabel(file.uri, this._labelService),
        options: { preserveFocus, pinned }
      }, ACTIVE_GROUP);
      return;
    }
    await this._editorService.openEditor({
      resource: file.uri,
      options: { preserveFocus, pinned }
    }, ACTIVE_GROUP);
  }
  async _hasContent(resource) {
    try {
      const content = await this._fileService.readFile(resource);
      return content.value.byteLength > 0;
    } catch {
      return false;
    }
  }
  /** Open the file in a normal editor, ignoring the pre-session diff. */
  _openFilePlain(file) {
    void this._editorService.openEditor({ resource: file.uri }, ACTIVE_GROUP);
  }
};
SessionFilesWidget = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ILabelService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IHoverService),
  __decorateParam(5, IFileService),
  __decorateParam(6, IThemeService)
], SessionFilesWidget);
function getSessionFileOperationLabel(operation) {
  switch (operation) {
    case SessionFileOperation.Created:
      return localize("sessionFiles.created", "Created");
    case SessionFileOperation.Modified:
      return localize("sessionFiles.modified", "Modified");
    case SessionFileOperation.Deleted:
      return localize("sessionFiles.deleted", "Deleted");
  }
}
function getSessionFileTitle(file, labelService) {
  const path = labelService.getUriLabel(file.uri);
  return localize("sessionFiles.title", "{0} ({1})", path, getSessionFileOperationLabel(file.operation));
}
function getDiffEditorLabel(uri, labelService) {
  return localize("sessionFiles.diffLabel", "{0} (Session Changes)", basename(uri) || labelService.getUriLabel(uri));
}
export {
  SessionFilesWidget
};
