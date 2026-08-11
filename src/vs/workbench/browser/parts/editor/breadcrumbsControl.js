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
import * as dom from "../../../../base/browser/dom.js";
import { StandardMouseEvent } from "../../../../base/browser/mouseEvent.js";
import { PixelRatio } from "../../../../base/browser/pixelRatio.js";
import { BreadcrumbsItem, BreadcrumbsWidget } from "../../../../base/browser/ui/breadcrumbs/breadcrumbsWidget.js";
import { applyDragImage } from "../../../../base/browser/ui/dnd/dnd.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { timeout } from "../../../../base/common/async.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { Emitter } from "../../../../base/common/event.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { combinedDisposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { basename } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { OutlineElement } from "../../../../editor/contrib/documentSymbols/browser/outlineModel.js";
import { localize, localize2 } from "../../../../nls.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { Action2, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextViewService, IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { fillInSymbolsDragData, LocalSelectionTransfer } from "../../../../platform/dnd/browser/dnd.js";
import { FileKind, IFileService } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { IListService, WorkbenchAsyncDataTree, WorkbenchDataTree, WorkbenchListFocusContextKey } from "../../../../platform/list/browser/listService.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { defaultBreadcrumbsWidgetStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { EditorResourceAccessor, SideBySideEditor } from "../../../common/editor.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IEditorResolverService } from "../../../services/editor/common/editorResolverService.js";
import { ACTIVE_GROUP, IEditorService, SIDE_GROUP } from "../../../services/editor/common/editorService.js";
import { IOutlineService, OutlineTarget } from "../../../services/outline/browser/outline.js";
import { DraggedEditorIdentifier, fillEditorsDragData } from "../../dnd.js";
import { DEFAULT_LABELS_CONTAINER, ResourceLabels } from "../../labels.js";
import { BreadcrumbsConfig, IBreadcrumbsService } from "./breadcrumbs.js";
import { BreadcrumbsModel, FileElement, OutlineElement2 } from "./breadcrumbsModel.js";
import { BreadcrumbsFilePicker, BreadcrumbsOutlinePicker } from "./breadcrumbsPicker.js";
import { createEditorTypeActions, editorTypeDisplayLabel, getAvailableEditorTypes, hasDefaultEditorAssociation } from "./editorTypePicker.js";
import "./media/breadcrumbscontrol.css";
import { ScrollbarVisibility } from "../../../../base/common/scrollable.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
let OutlineItem = class extends BreadcrumbsItem {
  constructor(model, element, options, _instantiationService) {
    super();
    this.model = model;
    this.element = element;
    this.options = options;
    this._instantiationService = _instantiationService;
    this._disposables = new DisposableStore();
  }
  dispose() {
    this._disposables.dispose();
  }
  equals(other) {
    if (!(other instanceof OutlineItem)) {
      return false;
    }
    return this.element.element === other.element.element && this.options.showFileIcons === other.options.showFileIcons && this.options.showSymbolIcons === other.options.showSymbolIcons;
  }
  render(container) {
    const { element, outline } = this.element;
    if (element === outline) {
      const element2 = dom.$("span", void 0, "\u2026");
      container.appendChild(element2);
      return;
    }
    const templateId = outline.config.delegate.getTemplateId(element);
    const renderer = outline.config.renderers.find((renderer2) => renderer2.templateId === templateId);
    if (!renderer) {
      container.textContent = "<<NO RENDERER>>";
      return;
    }
    const template = renderer.renderTemplate(container);
    renderer.renderElement({
      element,
      children: [],
      depth: 0,
      visibleChildrenCount: 0,
      visibleChildIndex: 0,
      collapsible: false,
      collapsed: false,
      visible: true,
      filterData: void 0
    }, 0, template, void 0);
    if (!this.options.showSymbolIcons) {
      dom.hide(template.iconClass);
    }
    this._disposables.add(toDisposable(() => {
      renderer.disposeTemplate(template);
    }));
    if (element instanceof OutlineElement && outline.uri) {
      this._disposables.add(this._instantiationService.invokeFunction((accessor) => createBreadcrumbDndObserver(accessor, container, element.symbol.name, { symbol: element.symbol, uri: outline.uri }, this.model, this.options.dragEditor)));
    }
  }
};
OutlineItem = __decorateClass([
  __decorateParam(3, IInstantiationService)
], OutlineItem);
let FileItem = class extends BreadcrumbsItem {
  constructor(model, element, options, _labels, _hoverDelegate, _instantiationService) {
    super();
    this.model = model;
    this.element = element;
    this.options = options;
    this._labels = _labels;
    this._hoverDelegate = _hoverDelegate;
    this._instantiationService = _instantiationService;
    this._disposables = new DisposableStore();
  }
  dispose() {
    this._disposables.dispose();
  }
  equals(other) {
    if (!(other instanceof FileItem)) {
      return false;
    }
    return this.element.equals(other.element) && this.options.showFileIcons === other.options.showFileIcons && this.options.showSymbolIcons === other.options.showSymbolIcons;
  }
  render(container) {
    const label = this._labels.create(container, { hoverDelegate: this._hoverDelegate });
    const options = {
      hidePath: true,
      hideIcon: this.element.kind === FileKind.FOLDER || !this.options.showFileIcons,
      fileKind: this.element.kind,
      fileDecorations: { colors: this.options.showDecorationColors, badges: false }
    };
    if (this.element.label) {
      label.setResource({ resource: this.element.uri, name: this.element.label }, { ...options, forceLabel: true });
    } else {
      label.setFile(this.element.uri, options);
    }
    container.classList.add(FileKind[this.element.kind].toLowerCase());
    this._disposables.add(label);
    this._disposables.add(this._instantiationService.invokeFunction((accessor) => createBreadcrumbDndObserver(accessor, container, basename(this.element.uri), this.element.uri, this.model, this.options.dragEditor)));
  }
};
FileItem = __decorateClass([
  __decorateParam(5, IInstantiationService)
], FileItem);
function createBreadcrumbDndObserver(accessor, container, label, item, model, dragEditor) {
  const instantiationService = accessor.get(IInstantiationService);
  container.draggable = true;
  return new dom.DragAndDropObserver(container, {
    onDragStart: (event) => {
      if (!event.dataTransfer) {
        return;
      }
      event.dataTransfer.effectAllowed = "copyMove";
      instantiationService.invokeFunction((accessor2) => {
        if (URI.isUri(item)) {
          fillEditorsDragData(accessor2, [item], event);
        } else {
          fillEditorsDragData(accessor2, [{ resource: item.uri, selection: item.symbol.range }], event);
          fillInSymbolsDragData([{
            name: item.symbol.name,
            fsPath: item.uri.fsPath,
            range: item.symbol.range,
            kind: item.symbol.kind
          }], event);
        }
        if (dragEditor && model.editor?.input) {
          const editorTransfer = LocalSelectionTransfer.getInstance();
          editorTransfer.setData([new DraggedEditorIdentifier({ editor: model.editor.input, groupId: model.editor.group.id })], DraggedEditorIdentifier.prototype);
        }
      });
      applyDragImage(event, container, label);
    }
  });
}
const separatorIcon = registerIcon("breadcrumb-separator", Codicon.chevronRight, localize("separatorIcon", "Icon for the separator in the breadcrumbs."));
let BreadcrumbsControl = class {
  constructor(container, _options, _editorGroup, _contextKeyService, _contextViewService, _contextMenuService, _instantiationService, _quickInputService, _fileService, _editorService, _editorResolverService, _commandService, _labelService, configurationService, _hoverService, breadcrumbsService) {
    this._options = _options;
    this._editorGroup = _editorGroup;
    this._contextKeyService = _contextKeyService;
    this._contextViewService = _contextViewService;
    this._contextMenuService = _contextMenuService;
    this._instantiationService = _instantiationService;
    this._quickInputService = _quickInputService;
    this._fileService = _fileService;
    this._editorService = _editorService;
    this._editorResolverService = _editorResolverService;
    this._commandService = _commandService;
    this._labelService = _labelService;
    this._hoverService = _hoverService;
    this._disposables = new DisposableStore();
    this._editorTypeDisposables = this._disposables.add(new DisposableStore());
    this._breadcrumbsDisposables = new DisposableStore();
    this._model = new MutableDisposable();
    this._breadcrumbsPickerShowing = false;
    this._onDidVisibilityChange = this._disposables.add(new Emitter());
    this.domNode = document.createElement("div");
    this.domNode.classList.add("breadcrumbs-control");
    this.domNode.classList.toggle("with-editor-type", !!_options.showEditorTypePicker);
    dom.append(container, this.domNode);
    this._cfUseQuickPick = BreadcrumbsConfig.UseQuickPick.bindTo(configurationService);
    this._cfShowIcons = BreadcrumbsConfig.Icons.bindTo(configurationService);
    this._cfShowEditorType = BreadcrumbsConfig.ShowEditorType.bindTo(configurationService);
    this._cfTitleScrollbarSizing = BreadcrumbsConfig.TitleScrollbarSizing.bindTo(configurationService);
    this._cfTitleScrollbarVisibility = BreadcrumbsConfig.TitleScrollbarVisibility.bindTo(configurationService);
    this._labels = this._instantiationService.createInstance(ResourceLabels, DEFAULT_LABELS_CONTAINER);
    const sizing = this._cfTitleScrollbarSizing.getValue() ?? "default";
    const styles = _options.widgetStyles ?? defaultBreadcrumbsWidgetStyles;
    const visibility = this._cfTitleScrollbarVisibility?.getValue() ?? "auto";
    this._widget = new BreadcrumbsWidget(
      this.domNode,
      BreadcrumbsControl.SCROLLBAR_SIZES[sizing],
      BreadcrumbsControl.SCROLLBAR_VISIBILITY[visibility],
      separatorIcon,
      styles
    );
    this._widget.onDidSelectItem(this._onSelectEvent, this, this._disposables);
    this._widget.onDidFocusItem(this._onFocusEvent, this, this._disposables);
    this._widget.onDidChangeFocus(this._updateCkBreadcrumbsActive, this, this._disposables);
    if (this._options.showEditorTypePicker) {
      this._disposables.add(this._cfShowEditorType.onDidChange(() => this._updateEditorTypeControl()));
    }
    this._ckBreadcrumbsPossible = BreadcrumbsControl.CK_BreadcrumbsPossible.bindTo(this._contextKeyService);
    this._ckBreadcrumbsVisible = BreadcrumbsControl.CK_BreadcrumbsVisible.bindTo(this._contextKeyService);
    this._ckBreadcrumbsActive = BreadcrumbsControl.CK_BreadcrumbsActive.bindTo(this._contextKeyService);
    this._ckBreadcrumbsHasSymbols = BreadcrumbsControl.CK_BreadcrumbsHasSymbols.bindTo(this._contextKeyService);
    this._hoverDelegate = getDefaultHoverDelegate("mouse");
    this._disposables.add(breadcrumbsService.register(this._editorGroup.id, this._widget));
    this.hide();
  }
  static {
    this.HEIGHT = 22;
  }
  static {
    this.SCROLLBAR_SIZES = {
      default: 3,
      large: 8
    };
  }
  static {
    this.SCROLLBAR_VISIBILITY = {
      auto: ScrollbarVisibility.Auto,
      visible: ScrollbarVisibility.Visible,
      hidden: ScrollbarVisibility.Hidden
    };
  }
  static {
    this.Payload_Reveal = {};
  }
  static {
    this.Payload_RevealAside = {};
  }
  static {
    this.Payload_Pick = {};
  }
  static {
    this.CK_BreadcrumbsPossible = new RawContextKey("breadcrumbsPossible", false, localize("breadcrumbsPossible", "Whether the editor can show breadcrumbs"));
  }
  static {
    this.CK_BreadcrumbsVisible = new RawContextKey("breadcrumbsVisible", false, localize("breadcrumbsVisible", "Whether breadcrumbs are currently visible"));
  }
  static {
    this.CK_BreadcrumbsActive = new RawContextKey("breadcrumbsActive", false, localize("breadcrumbsActive", "Whether breadcrumbs have focus"));
  }
  static {
    this.CK_BreadcrumbsHasSymbols = new RawContextKey("breadcrumbsHasSymbols", false, localize("breadcrumbsHasSymbols", "Whether breadcrumbs contain symbol items"));
  }
  get onDidVisibilityChange() {
    return this._onDidVisibilityChange.event;
  }
  dispose() {
    this._disposables.dispose();
    this._breadcrumbsDisposables.dispose();
    this._model.dispose();
    this._ckBreadcrumbsPossible.reset();
    this._ckBreadcrumbsVisible.reset();
    this._ckBreadcrumbsActive.reset();
    this._ckBreadcrumbsHasSymbols.reset();
    this._cfUseQuickPick.dispose();
    this._cfShowIcons.dispose();
    this._cfShowEditorType.dispose();
    this._cfTitleScrollbarSizing.dispose();
    this._cfTitleScrollbarVisibility.dispose();
    this._widget.dispose();
    this._labels.dispose();
    this.domNode.remove();
  }
  get model() {
    return this._model.value;
  }
  layout(dim) {
    if (dim) {
      this._lastLayoutDimension = dim;
    }
    if (dim && this._editorTypeNode) {
      const editorTypeWidth = this._editorTypeNode.offsetWidth;
      dim = new dom.Dimension(Math.max(0, dim.width - editorTypeWidth), dim.height);
    }
    this._widget.layout(dim);
  }
  isHidden() {
    return this.domNode.classList.contains("hidden");
  }
  hide() {
    const wasHidden = this.isHidden();
    this._breadcrumbsDisposables.clear();
    this._ckBreadcrumbsVisible.set(false);
    this._ckBreadcrumbsHasSymbols.set(false);
    this.domNode.classList.toggle("hidden", true);
    this._hideEditorTypeControl();
    if (!wasHidden) {
      this._onDidVisibilityChange.fire();
    }
  }
  show() {
    const wasHidden = this.isHidden();
    this._ckBreadcrumbsVisible.set(true);
    this.domNode.classList.toggle("hidden", false);
    if (wasHidden) {
      this._onDidVisibilityChange.fire();
    }
  }
  revealLast() {
    this._widget.revealLast();
  }
  update() {
    this._breadcrumbsDisposables.clear();
    const uri = EditorResourceAccessor.getCanonicalUri(this._editorGroup.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
    const wasHidden = this.isHidden();
    if (!uri || !this._fileService.hasProvider(uri)) {
      this._ckBreadcrumbsPossible.set(false);
      this._ckBreadcrumbsHasSymbols.set(false);
      if (!wasHidden) {
        this.hide();
        return true;
      } else {
        return false;
      }
    }
    const fileInfoUri = EditorResourceAccessor.getOriginalUri(this._editorGroup.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
    this.show();
    this._ckBreadcrumbsPossible.set(true);
    this._updateEditorTypeControl();
    const model = this._instantiationService.createInstance(
      BreadcrumbsModel,
      fileInfoUri ?? uri,
      this._editorGroup.activeEditorPane
    );
    this._model.value = model;
    this.domNode.classList.toggle("backslash-path", this._labelService.getSeparator(uri.scheme, uri.authority) === "\\");
    const updateBreadcrumbs = () => {
      this.domNode.classList.toggle("relative-path", model.isRelative());
      const showIcons = this._cfShowIcons.getValue();
      const options = {
        ...this._options,
        showFileIcons: this._options.showFileIcons && showIcons,
        showSymbolIcons: this._options.showSymbolIcons && showIcons
      };
      const elements = model.getElements();
      this._ckBreadcrumbsHasSymbols.set(elements.some((element) => !(element instanceof FileElement)));
      const items = elements.map((element) => element instanceof FileElement ? this._instantiationService.createInstance(FileItem, model, element, options, this._labels, this._hoverDelegate) : this._instantiationService.createInstance(OutlineItem, model, element, options));
      if (items.length === 0) {
        this._widget.setEnabled(false);
        this._widget.setItems([new class extends BreadcrumbsItem {
          render(container) {
            container.textContent = localize("empty", "no elements");
          }
          equals(other) {
            return other === this;
          }
          dispose() {
          }
        }()]);
      } else {
        this._widget.setEnabled(true);
        this._widget.setItems(items);
        this._widget.reveal(items[items.length - 1]);
      }
    };
    const listener = model.onDidUpdate(updateBreadcrumbs);
    const configListener = this._cfShowIcons.onDidChange(updateBreadcrumbs);
    updateBreadcrumbs();
    this._breadcrumbsDisposables.clear();
    this._breadcrumbsDisposables.add(listener);
    this._breadcrumbsDisposables.add(toDisposable(() => this._model.clear()));
    this._breadcrumbsDisposables.add(configListener);
    this._breadcrumbsDisposables.add(toDisposable(() => this._widget.setItems([])));
    const updateScrollbarSizing = () => {
      const sizing = this._cfTitleScrollbarSizing.getValue() ?? "default";
      const visibility = this._cfTitleScrollbarVisibility?.getValue() ?? "auto";
      this._widget.setHorizontalScrollbarSize(BreadcrumbsControl.SCROLLBAR_SIZES[sizing]);
      this._widget.setHorizontalScrollbarVisibility(BreadcrumbsControl.SCROLLBAR_VISIBILITY[visibility]);
    };
    updateScrollbarSizing();
    const updateScrollbarSizeListener = this._cfTitleScrollbarSizing.onDidChange(updateScrollbarSizing);
    const updateScrollbarVisibilityListener = this._cfTitleScrollbarVisibility.onDidChange(updateScrollbarSizing);
    this._breadcrumbsDisposables.add(updateScrollbarSizeListener);
    this._breadcrumbsDisposables.add(updateScrollbarVisibilityListener);
    this._breadcrumbsDisposables.add({
      dispose: () => {
        if (this._breadcrumbsPickerShowing) {
          this._contextViewService.hideContextView({ source: this });
        }
      }
    });
    return wasHidden !== this.isHidden();
  }
  _updateEditorTypeControl() {
    const previousWidth = this._editorTypeNode?.offsetWidth ?? 0;
    const available = this._options.showEditorTypePicker && this._cfShowEditorType.getValue() ? getAvailableEditorTypes(this._editorGroup.activeEditor, this._editorResolverService) : void 0;
    const configuredDefaultEditor = available ? this._editorResolverService.getConfiguredDefaultEditor(available.resource, available.isDiffEditor) : void 0;
    if (!available || !hasDefaultEditorAssociation(available, configuredDefaultEditor)) {
      this._hideEditorTypeControl();
    } else {
      const { label: editorTypeLabel, hover: editorTypeHover } = this._createEditorTypeControl();
      const current = available.editors.find((editor) => editor.id === available.currentId);
      const label = current ? editorTypeDisplayLabel(current, available.isDiffEditor) : available.currentId;
      editorTypeLabel.textContent = label;
      editorTypeHover.update(localize("editorType.hover", "Editor: {0}", label));
    }
    const currentWidth = this._editorTypeNode?.offsetWidth ?? 0;
    if (this._lastLayoutDimension && currentWidth !== previousWidth) {
      this.layout(this._lastLayoutDimension);
    }
  }
  _createEditorTypeControl() {
    if (this._editorTypeNode && this._editorTypeLabel && this._editorTypeHover) {
      return { label: this._editorTypeLabel, hover: this._editorTypeHover };
    }
    this._editorTypeNode = document.createElement("div");
    this._editorTypeNode.classList.add("breadcrumbs-editor-type");
    this._editorTypeNode.setAttribute("role", "button");
    this._editorTypeLabel = document.createElement("span");
    this._editorTypeLabel.classList.add("label");
    this._editorTypeNode.appendChild(this._editorTypeLabel);
    const editorTypeChevron = document.createElement("span");
    editorTypeChevron.classList.add(...ThemeIcon.asClassNameArray(Codicon.chevronDown));
    this._editorTypeNode.appendChild(editorTypeChevron);
    dom.append(this.domNode, this._editorTypeNode);
    this._editorTypeHover = this._editorTypeDisposables.add(this._hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), this._editorTypeNode, ""));
    this._editorTypeDisposables.add(dom.addDisposableListener(this._editorTypeNode, dom.EventType.CLICK, (e) => {
      dom.EventHelper.stop(e, true);
      this._showEditorTypePicker();
    }));
    return { label: this._editorTypeLabel, hover: this._editorTypeHover };
  }
  _hideEditorTypeControl() {
    this._editorTypeDisposables.clear();
    this._editorTypeNode?.remove();
    this._editorTypeNode = void 0;
    this._editorTypeLabel = void 0;
    this._editorTypeHover = void 0;
  }
  _showEditorTypePicker() {
    const editorTypeNode = this._editorTypeNode;
    if (!editorTypeNode) {
      return;
    }
    const available = getAvailableEditorTypes(this._editorGroup.activeEditor, this._editorResolverService);
    if (!available) {
      return;
    }
    const actions = createEditorTypeActions(available, this._editorResolverService, this._commandService, this._editorService);
    this._contextMenuService.showContextMenu({
      getAnchor: () => editorTypeNode,
      getActions: () => actions
    });
  }
  _onFocusEvent(event) {
    if (event.item && this._breadcrumbsPickerShowing) {
      this._breadcrumbsPickerIgnoreOnceItem = void 0;
      this._widget.setSelection(event.item);
    }
  }
  _onSelectEvent(event) {
    if (!event.item) {
      return;
    }
    if (event.item === this._breadcrumbsPickerIgnoreOnceItem) {
      this._breadcrumbsPickerIgnoreOnceItem = void 0;
      this._widget.setFocused(void 0);
      this._widget.setSelection(void 0);
      return;
    }
    const { element } = event.item;
    this._editorGroup.focus();
    const group = this._getEditorGroup(event.payload);
    if (group !== void 0) {
      this._widget.setFocused(void 0);
      this._widget.setSelection(void 0);
      this._revealInEditor(event, element, group);
      return;
    }
    if (this._cfUseQuickPick.getValue()) {
      this._widget.setFocused(void 0);
      this._widget.setSelection(void 0);
      this._quickInputService.quickAccess.show(element instanceof OutlineElement2 ? "@" : "");
      return;
    }
    let picker;
    let pickerAnchor;
    this._contextViewService.showContextView({
      render: (parent) => {
        if (event.item instanceof FileItem) {
          picker = this._instantiationService.createInstance(BreadcrumbsFilePicker, parent, event.item.model.resource);
        } else if (event.item instanceof OutlineItem) {
          picker = this._instantiationService.createInstance(BreadcrumbsOutlinePicker, parent, event.item.model.resource);
        }
        const selectListener = picker.onWillPickElement(() => this._contextViewService.hideContextView({ source: this, didPick: true }));
        const zoomListener = PixelRatio.getInstance(dom.getWindow(this.domNode)).onDidChange(() => this._contextViewService.hideContextView({ source: this }));
        const focusTracker = dom.trackFocus(parent);
        const blurListener = focusTracker.onDidBlur(() => {
          this._breadcrumbsPickerIgnoreOnceItem = this._widget.isDOMFocused() ? event.item : void 0;
          this._contextViewService.hideContextView({ source: this });
        });
        this._breadcrumbsPickerShowing = true;
        this._updateCkBreadcrumbsActive();
        return combinedDisposable(
          picker,
          selectListener,
          zoomListener,
          focusTracker,
          blurListener
        );
      },
      getAnchor: () => {
        if (!pickerAnchor) {
          const window = dom.getWindow(this.domNode);
          const maxInnerWidth = window.innerWidth - 8;
          let maxHeight = Math.min(window.innerHeight * 0.7, 300);
          const pickerWidth = Math.min(maxInnerWidth, Math.max(240, maxInnerWidth / 4.17));
          const pickerArrowSize = 8;
          let pickerArrowOffset;
          const data = dom.getDomNodePagePosition(event.node);
          const y = data.top + data.height + pickerArrowSize;
          if (y + maxHeight >= window.innerHeight) {
            maxHeight = window.innerHeight - y - 30;
          }
          let x = data.left;
          if (x + pickerWidth >= maxInnerWidth) {
            x = maxInnerWidth - pickerWidth;
          }
          if (event.payload instanceof StandardMouseEvent) {
            const maxPickerArrowOffset = pickerWidth - 2 * pickerArrowSize;
            pickerArrowOffset = event.payload.posx - x;
            if (pickerArrowOffset > maxPickerArrowOffset) {
              x = Math.min(maxInnerWidth - pickerWidth, x + pickerArrowOffset - maxPickerArrowOffset);
              pickerArrowOffset = maxPickerArrowOffset;
            }
          } else {
            pickerArrowOffset = data.left + data.width * 0.3 - x;
          }
          picker.show(element, maxHeight, pickerWidth, pickerArrowSize, Math.max(0, pickerArrowOffset));
          pickerAnchor = { x, y };
        }
        return pickerAnchor;
      },
      onHide: (data) => {
        if (!data?.didPick) {
          picker.restoreViewState();
        }
        this._breadcrumbsPickerShowing = false;
        this._updateCkBreadcrumbsActive();
        if (data?.source === this) {
          this._widget.setFocused(void 0);
          this._widget.setSelection(void 0);
        }
        picker.dispose();
      }
    });
  }
  _updateCkBreadcrumbsActive() {
    const value = this._widget.isDOMFocused() || this._breadcrumbsPickerShowing;
    this._ckBreadcrumbsActive.set(value);
  }
  async _revealInEditor(event, element, group, pinned = false) {
    if (element instanceof FileElement) {
      if (element.kind === FileKind.FILE) {
        await this._editorService.openEditor({ resource: element.uri, options: { pinned } }, group);
      } else {
        const items = this._widget.getItems();
        const idx = items.indexOf(event.item);
        this._widget.setFocused(items[idx + 1]);
        this._widget.setSelection(items[idx + 1], BreadcrumbsControl.Payload_Pick);
      }
    } else {
      element.outline.reveal(element, { pinned }, group === SIDE_GROUP, false);
    }
  }
  _getEditorGroup(data) {
    if (data === BreadcrumbsControl.Payload_RevealAside) {
      return SIDE_GROUP;
    } else if (data === BreadcrumbsControl.Payload_Reveal) {
      return ACTIVE_GROUP;
    } else {
      return void 0;
    }
  }
};
BreadcrumbsControl = __decorateClass([
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IContextViewService),
  __decorateParam(5, IContextMenuService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IQuickInputService),
  __decorateParam(8, IFileService),
  __decorateParam(9, IEditorService),
  __decorateParam(10, IEditorResolverService),
  __decorateParam(11, ICommandService),
  __decorateParam(12, ILabelService),
  __decorateParam(13, IConfigurationService),
  __decorateParam(14, IHoverService),
  __decorateParam(15, IBreadcrumbsService)
], BreadcrumbsControl);
let BreadcrumbsControlFactory = class {
  constructor(_container, _editorGroup, _options, configurationService, _instantiationService, fileService) {
    this._container = _container;
    this._editorGroup = _editorGroup;
    this._options = _options;
    this._instantiationService = _instantiationService;
    this._disposables = new DisposableStore();
    this._controlDisposables = new DisposableStore();
    this._onDidEnablementChange = this._disposables.add(new Emitter());
    this._onDidVisibilityChange = this._disposables.add(new Emitter());
    const config = this._disposables.add(BreadcrumbsConfig.IsEnabled.bindTo(configurationService));
    this._disposables.add(config.onDidChange(() => {
      const value = config.getValue();
      if (!value && this._control) {
        this._controlDisposables.clear();
        this._control = void 0;
        this._onDidEnablementChange.fire();
      } else if (value && !this._control) {
        this._control = this.createControl();
        this._control.update();
        this._onDidEnablementChange.fire();
      }
    }));
    if (config.getValue()) {
      this._control = this.createControl();
    }
    this._disposables.add(fileService.onDidChangeFileSystemProviderRegistrations((e) => {
      if (this._control?.model && this._control.model.resource.scheme !== e.scheme) {
        return;
      }
      if (this._control?.update()) {
        this._onDidEnablementChange.fire();
      }
    }));
  }
  get control() {
    return this._control;
  }
  get onDidEnablementChange() {
    return this._onDidEnablementChange.event;
  }
  get onDidVisibilityChange() {
    return this._onDidVisibilityChange.event;
  }
  createControl() {
    const control = this._controlDisposables.add(this._instantiationService.createInstance(BreadcrumbsControl, this._container, this._options, this._editorGroup));
    this._controlDisposables.add(control.onDidVisibilityChange(() => this._onDidVisibilityChange.fire()));
    return control;
  }
  dispose() {
    this._disposables.dispose();
    this._controlDisposables.dispose();
  }
};
BreadcrumbsControlFactory = __decorateClass([
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IFileService)
], BreadcrumbsControlFactory);
registerAction2(class ToggleBreadcrumb extends Action2 {
  constructor() {
    super({
      id: "breadcrumbs.toggle",
      title: localize2("cmd.toggle", "Toggle Breadcrumbs"),
      shortTitle: localize2("cmd.toggle.short", "Breadcrumbs"),
      category: Categories.View,
      toggled: {
        condition: ContextKeyExpr.equals("config.breadcrumbs.enabled", true),
        title: localize("cmd.toggle2", "Breadcrumbs"),
        mnemonicTitle: localize({ key: "miBreadcrumbs2", comment: ["&& denotes a mnemonic"] }, "&&Breadcrumbs")
      },
      menu: [
        { id: MenuId.CommandPalette },
        { id: MenuId.MenubarAppearanceMenu, group: "4_editor", order: 2 },
        { id: MenuId.NotebookToolbar, group: "notebookLayout", order: 2 },
        { id: MenuId.StickyScrollContext },
        { id: MenuId.NotebookStickyScrollContext, group: "notebookView", order: 2 },
        { id: MenuId.NotebookToolbarContext, group: "notebookView", order: 2 }
      ]
    });
  }
  run(accessor) {
    const config = accessor.get(IConfigurationService);
    const breadCrumbsConfig = BreadcrumbsConfig.IsEnabled.bindTo(config);
    const value = breadCrumbsConfig.getValue();
    breadCrumbsConfig.updateValue(!value);
    breadCrumbsConfig.dispose();
  }
});
function focusAndSelectHandler(accessor, select) {
  const groups = accessor.get(IEditorGroupsService);
  const breadcrumbs = accessor.get(IBreadcrumbsService);
  const widget = breadcrumbs.getWidget(groups.activeGroup.id);
  if (widget) {
    const item = widget.getItems().at(-1);
    widget.setFocused(item);
    if (select) {
      widget.setSelection(item, BreadcrumbsControl.Payload_Pick);
    }
  }
}
registerAction2(class FocusAndSelectBreadcrumbs extends Action2 {
  constructor() {
    super({
      id: "breadcrumbs.focusAndSelect",
      title: localize2("cmd.focusAndSelect", "Focus and Select Breadcrumbs"),
      precondition: BreadcrumbsControl.CK_BreadcrumbsVisible,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Period,
        when: BreadcrumbsControl.CK_BreadcrumbsPossible
      },
      f1: true
    });
  }
  run(accessor, ...args) {
    focusAndSelectHandler(accessor, true);
  }
});
registerAction2(class FocusBreadcrumbs extends Action2 {
  constructor() {
    super({
      id: "breadcrumbs.focus",
      title: localize2("cmd.focus", "Focus Breadcrumbs"),
      precondition: BreadcrumbsControl.CK_BreadcrumbsVisible,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Semicolon,
        when: BreadcrumbsControl.CK_BreadcrumbsPossible
      },
      f1: true
    });
  }
  run(accessor, ...args) {
    focusAndSelectHandler(accessor, false);
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "breadcrumbs.toggleToOn",
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Period,
  when: ContextKeyExpr.not("config.breadcrumbs.enabled"),
  handler: async (accessor) => {
    const instant = accessor.get(IInstantiationService);
    const config = accessor.get(IConfigurationService);
    const isEnabled = BreadcrumbsConfig.IsEnabled.bindTo(config);
    if (!isEnabled.getValue()) {
      await isEnabled.updateValue(true);
      await timeout(50);
    }
    isEnabled.dispose();
    return instant.invokeFunction(focusAndSelectHandler, true);
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "breadcrumbs.focusNext",
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyCode.RightArrow,
  secondary: [KeyMod.CtrlCmd | KeyCode.RightArrow],
  mac: {
    primary: KeyCode.RightArrow,
    secondary: [KeyMod.Alt | KeyCode.RightArrow]
  },
  when: ContextKeyExpr.and(BreadcrumbsControl.CK_BreadcrumbsVisible, BreadcrumbsControl.CK_BreadcrumbsActive),
  handler(accessor) {
    const groups = accessor.get(IEditorGroupsService);
    const breadcrumbs = accessor.get(IBreadcrumbsService);
    const widget = breadcrumbs.getWidget(groups.activeGroup.id);
    if (!widget) {
      return;
    }
    widget.focusNext();
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "breadcrumbs.focusPrevious",
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyCode.LeftArrow,
  secondary: [KeyMod.CtrlCmd | KeyCode.LeftArrow],
  mac: {
    primary: KeyCode.LeftArrow,
    secondary: [KeyMod.Alt | KeyCode.LeftArrow]
  },
  when: ContextKeyExpr.and(BreadcrumbsControl.CK_BreadcrumbsVisible, BreadcrumbsControl.CK_BreadcrumbsActive),
  handler(accessor) {
    const groups = accessor.get(IEditorGroupsService);
    const breadcrumbs = accessor.get(IBreadcrumbsService);
    const widget = breadcrumbs.getWidget(groups.activeGroup.id);
    if (!widget) {
      return;
    }
    widget.focusPrev();
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "breadcrumbs.focusNextWithPicker",
  weight: KeybindingWeight.WorkbenchContrib + 1,
  primary: KeyMod.CtrlCmd | KeyCode.RightArrow,
  mac: {
    primary: KeyMod.Alt | KeyCode.RightArrow
  },
  when: ContextKeyExpr.and(BreadcrumbsControl.CK_BreadcrumbsVisible, BreadcrumbsControl.CK_BreadcrumbsActive, WorkbenchListFocusContextKey),
  handler(accessor) {
    const groups = accessor.get(IEditorGroupsService);
    const breadcrumbs = accessor.get(IBreadcrumbsService);
    const widget = breadcrumbs.getWidget(groups.activeGroup.id);
    if (!widget) {
      return;
    }
    widget.focusNext();
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "breadcrumbs.focusPreviousWithPicker",
  weight: KeybindingWeight.WorkbenchContrib + 1,
  primary: KeyMod.CtrlCmd | KeyCode.LeftArrow,
  mac: {
    primary: KeyMod.Alt | KeyCode.LeftArrow
  },
  when: ContextKeyExpr.and(BreadcrumbsControl.CK_BreadcrumbsVisible, BreadcrumbsControl.CK_BreadcrumbsActive, WorkbenchListFocusContextKey),
  handler(accessor) {
    const groups = accessor.get(IEditorGroupsService);
    const breadcrumbs = accessor.get(IBreadcrumbsService);
    const widget = breadcrumbs.getWidget(groups.activeGroup.id);
    if (!widget) {
      return;
    }
    widget.focusPrev();
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "breadcrumbs.selectFocused",
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyCode.Enter,
  secondary: [KeyCode.DownArrow],
  when: ContextKeyExpr.and(BreadcrumbsControl.CK_BreadcrumbsVisible, BreadcrumbsControl.CK_BreadcrumbsActive),
  handler(accessor) {
    const groups = accessor.get(IEditorGroupsService);
    const breadcrumbs = accessor.get(IBreadcrumbsService);
    const widget = breadcrumbs.getWidget(groups.activeGroup.id);
    if (!widget) {
      return;
    }
    widget.setSelection(widget.getFocused(), BreadcrumbsControl.Payload_Pick);
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "breadcrumbs.revealFocused",
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyCode.Space,
  secondary: [KeyMod.CtrlCmd | KeyCode.Enter],
  when: ContextKeyExpr.and(BreadcrumbsControl.CK_BreadcrumbsVisible, BreadcrumbsControl.CK_BreadcrumbsActive),
  handler(accessor) {
    const groups = accessor.get(IEditorGroupsService);
    const breadcrumbs = accessor.get(IBreadcrumbsService);
    const widget = breadcrumbs.getWidget(groups.activeGroup.id);
    if (!widget) {
      return;
    }
    widget.setSelection(widget.getFocused(), BreadcrumbsControl.Payload_Reveal);
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "breadcrumbs.selectEditor",
  weight: KeybindingWeight.WorkbenchContrib + 1,
  primary: KeyCode.Escape,
  when: ContextKeyExpr.and(BreadcrumbsControl.CK_BreadcrumbsVisible, BreadcrumbsControl.CK_BreadcrumbsActive),
  handler(accessor) {
    const groups = accessor.get(IEditorGroupsService);
    const breadcrumbs = accessor.get(IBreadcrumbsService);
    const widget = breadcrumbs.getWidget(groups.activeGroup.id);
    if (!widget) {
      return;
    }
    widget.setFocused(void 0);
    widget.setSelection(void 0);
    groups.activeGroup.activeEditorPane?.focus();
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "breadcrumbs.revealFocusedFromTreeAside",
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyMod.CtrlCmd | KeyCode.Enter,
  when: ContextKeyExpr.and(BreadcrumbsControl.CK_BreadcrumbsVisible, BreadcrumbsControl.CK_BreadcrumbsActive, WorkbenchListFocusContextKey),
  handler(accessor) {
    const editors = accessor.get(IEditorService);
    const lists = accessor.get(IListService);
    const tree = lists.lastFocusedList;
    if (!(tree instanceof WorkbenchDataTree) && !(tree instanceof WorkbenchAsyncDataTree)) {
      return;
    }
    const element = tree.getFocus()[0];
    if (URI.isUri(element?.resource)) {
      return editors.openEditor({
        resource: element.resource,
        options: { pinned: true }
      }, SIDE_GROUP);
    }
    const input = tree.getInput();
    if (input && typeof input.outlineKind === "string") {
      return input.reveal(element, {
        pinned: true,
        preserveFocus: false
      }, true, false);
    }
  }
});
registerAction2(class CopyBreadcrumbPath extends Action2 {
  constructor() {
    super({
      id: "breadcrumbs.copyPath",
      title: localize2("cmd.copyPath", "Copy Breadcrumbs Path"),
      category: Categories.View,
      precondition: ContextKeyExpr.and(BreadcrumbsControl.CK_BreadcrumbsVisible, BreadcrumbsControl.CK_BreadcrumbsHasSymbols),
      f1: true,
      menu: [{
        id: MenuId.EditorTitleContext,
        group: "1_cutcopypaste",
        order: 100,
        when: ContextKeyExpr.and(BreadcrumbsControl.CK_BreadcrumbsPossible, BreadcrumbsControl.CK_BreadcrumbsHasSymbols)
      }]
    });
  }
  async run(accessor) {
    const groups = accessor.get(IEditorGroupsService);
    const clipboardService = accessor.get(IClipboardService);
    const configurationService = accessor.get(IConfigurationService);
    const outlineService = accessor.get(IOutlineService);
    if (!groups.activeGroup.activeEditorPane) {
      return;
    }
    const outline = await outlineService.createOutline(groups.activeGroup.activeEditorPane, OutlineTarget.Breadcrumbs, CancellationToken.None);
    if (!outline) {
      return;
    }
    const elements = outline.config.breadcrumbsDataSource.getBreadcrumbElements();
    const labels = elements.map((item) => item.label).filter(Boolean);
    outline.dispose();
    if (labels.length === 0) {
      return;
    }
    const resource = groups.activeGroup.activeEditorPane.input.resource;
    const config = BreadcrumbsConfig.SymbolPathSeparator.bindTo(configurationService);
    const separator = config.getValue(resource && { resource }) ?? ".";
    config.dispose();
    const path = labels.join(separator);
    await clipboardService.writeText(path);
  }
});
export {
  BreadcrumbsControl,
  BreadcrumbsControlFactory
};
