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
import { Event, Emitter } from "../../../../base/common/event.js";
import { basename, dirname } from "../../../../base/common/resources.js";
import { Disposable, DisposableStore, combinedDisposable, dispose, toDisposable, MutableDisposable, DisposableMap } from "../../../../base/common/lifecycle.js";
import { ViewPane, ViewAction } from "../../../browser/parts/views/viewPane.js";
import { append, $, clearNode, isPointerEvent, isActiveElement } from "../../../../base/browser/dom.js";
import { asCSSUrl } from "../../../../base/browser/cssValue.js";
import { ISCMViewService, ISCMService, VIEW_PANE_ID, ISCMRepositorySortKey, ViewMode, ISCMRepositorySelectionMode } from "../common/scm.js";
import { ResourceLabels } from "../../../browser/labels.js";
import { CountBadge } from "../../../../base/browser/ui/countBadge/countBadge.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IContextKeyService, ContextKeyExpr, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { MenuItemAction, IMenuService, registerAction2, MenuId, MenuRegistry, Action2 } from "../../../../platform/actions/common/actions.js";
import { ActionRunner, Separator, toAction } from "../../../../base/common/actions.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { isSCMResource, isSCMResourceGroup, isSCMRepository, isSCMInput, collectContextMenuActions, getActionViewItemProvider, isSCMActionButton, isSCMViewService, isSCMResourceNode, connectPrimaryMenu } from "./util.js";
import { WorkbenchCompressibleAsyncDataTree } from "../../../../platform/list/browser/listService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { disposableTimeout, Sequencer, Throttler } from "../../../../base/common/async.js";
import { ResourceTree } from "../../../../base/common/resourceTree.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { FileKind } from "../../../../platform/files/common/files.js";
import { compareFileNames, comparePaths } from "../../../../base/common/comparers.js";
import { createMatches } from "../../../../base/common/filters.js";
import { IViewDescriptorService } from "../../../common/views.js";
import { localize } from "../../../../nls.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { EditorResourceAccessor, SideBySideEditor } from "../../../common/editor.js";
import { compare } from "../../../../base/common/strings.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { RepositoryActionRunner, RepositoryRenderer } from "./scmRepositoryRenderer.js";
import { isDark } from "../../../../platform/theme/common/theme.js";
import { API_OPEN_DIFF_EDITOR_COMMAND_ID, API_OPEN_EDITOR_COMMAND_ID } from "../../../browser/parts/editor/editorCommands.js";
import { getFlatContextMenuActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { Button, ButtonWithDropdown } from "../../../../base/browser/ui/button/button.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { RepositoryContextKeys } from "./scmViewService.js";
import { defaultButtonStyles, defaultCountBadgeStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { Schemas } from "../../../../base/common/network.js";
import { fillEditorsDragData } from "../../../browser/dnd.js";
import { CodeDataTransfers } from "../../../../platform/dnd/browser/dnd.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { WorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { rot } from "../../../../base/common/numbers.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { OpenScmGroupAction } from "../../multiDiffEditor/browser/scmMultiDiffSourceResolver.js";
import { autorun } from "../../../../base/common/observable.js";
import { observableConfigValue } from "../../../../platform/observable/common/platformObservableUtils.js";
import { AccessibilityVerbositySettingId } from "../../accessibility/browser/accessibilityConfiguration.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { AccessibilityCommandId } from "../../accessibility/common/accessibilityCommands.js";
import { SCMInputWidget } from "./scmInput.js";
function processResourceFilterData(uri, filterData) {
  if (!filterData) {
    return [void 0, void 0];
  }
  if (!filterData.label) {
    const matches2 = createMatches(filterData);
    return [matches2, void 0];
  }
  const fileName = basename(uri);
  const label = filterData.label;
  const pathLength = label.length - fileName.length;
  const matches = createMatches(filterData.score);
  if (label === fileName) {
    return [matches, void 0];
  }
  const labelMatches = [];
  const descriptionMatches = [];
  for (const match of matches) {
    if (match.start > pathLength) {
      labelMatches.push({
        start: match.start - pathLength,
        end: match.end - pathLength
      });
    } else if (match.end < pathLength) {
      descriptionMatches.push(match);
    } else {
      labelMatches.push({
        start: 0,
        end: match.end - pathLength
      });
      descriptionMatches.push({
        start: match.start,
        end: pathLength
      });
    }
  }
  return [labelMatches, descriptionMatches];
}
let ActionButtonRenderer = class {
  constructor(commandService, contextMenuService, notificationService) {
    this.commandService = commandService;
    this.contextMenuService = contextMenuService;
    this.notificationService = notificationService;
    this.actionButtons = /* @__PURE__ */ new Map();
  }
  static {
    this.DEFAULT_HEIGHT = 28;
  }
  static {
    this.TEMPLATE_ID = "actionButton";
  }
  get templateId() {
    return ActionButtonRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    container.parentElement.parentElement.classList.add("cursor-default", "force-no-hover");
    const buttonContainer = append(container, $(".button-container"));
    const actionButton = new SCMActionButton(buttonContainer, this.contextMenuService, this.commandService, this.notificationService);
    return { actionButton, disposable: Disposable.None, templateDisposable: actionButton };
  }
  renderElement(node, index, templateData) {
    templateData.disposable.dispose();
    const disposables = new DisposableStore();
    const actionButton = node.element;
    templateData.actionButton.setButton(node.element.button);
    this.actionButtons.set(actionButton, templateData.actionButton);
    disposables.add({ dispose: () => this.actionButtons.delete(actionButton) });
    templateData.disposable = disposables;
  }
  renderCompressedElements() {
    throw new Error("Should never happen since node is incompressible");
  }
  focusActionButton(actionButton) {
    this.actionButtons.get(actionButton)?.focus();
  }
  disposeElement(node, index, template) {
    template.disposable.dispose();
  }
  disposeTemplate(templateData) {
    templateData.disposable.dispose();
    templateData.templateDisposable.dispose();
  }
};
ActionButtonRenderer = __decorateClass([
  __decorateParam(0, ICommandService),
  __decorateParam(1, IContextMenuService),
  __decorateParam(2, INotificationService)
], ActionButtonRenderer);
class SCMTreeDragAndDrop {
  constructor(instantiationService) {
    this.instantiationService = instantiationService;
  }
  getDragURI(element) {
    if (isSCMResource(element)) {
      return element.sourceUri.toString();
    }
    return null;
  }
  onDragStart(data, originalEvent) {
    const items = SCMTreeDragAndDrop.getResourcesFromDragAndDropData(data);
    if (originalEvent.dataTransfer && items?.length) {
      this.instantiationService.invokeFunction((accessor) => fillEditorsDragData(accessor, items, originalEvent));
      const fileResources = items.filter((s) => s.scheme === Schemas.file).map((r) => r.fsPath);
      if (fileResources.length) {
        originalEvent.dataTransfer.setData(CodeDataTransfers.FILES, JSON.stringify(fileResources));
      }
    }
  }
  getDragLabel(elements, originalEvent) {
    if (elements.length === 1) {
      const element = elements[0];
      if (isSCMResource(element)) {
        return basename(element.sourceUri);
      }
    }
    return String(elements.length);
  }
  onDragOver(data, targetElement, targetIndex, targetSector, originalEvent) {
    return true;
  }
  drop(data, targetElement, targetIndex, targetSector, originalEvent) {
  }
  static getResourcesFromDragAndDropData(data) {
    const uris = [];
    for (const element of [...data.context ?? [], ...data.elements]) {
      if (isSCMResource(element)) {
        uris.push(element.sourceUri);
      }
    }
    return uris;
  }
  dispose() {
  }
}
let InputRenderer = class {
  constructor(outerLayout, overflowWidgetsDomNode, updateHeight, instantiationService) {
    this.outerLayout = outerLayout;
    this.overflowWidgetsDomNode = overflowWidgetsDomNode;
    this.updateHeight = updateHeight;
    this.instantiationService = instantiationService;
    this.inputWidgets = /* @__PURE__ */ new Map();
    this.contentHeights = /* @__PURE__ */ new WeakMap();
    this.editorSelections = /* @__PURE__ */ new WeakMap();
  }
  static {
    this.DEFAULT_HEIGHT = 26;
  }
  static {
    this.TEMPLATE_ID = "input";
  }
  get templateId() {
    return InputRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    container.parentElement.parentElement.classList.add("force-no-hover");
    const templateDisposable = new DisposableStore();
    const inputElement = append(container, $(".scm-input"));
    const inputWidget = this.instantiationService.createInstance(SCMInputWidget, inputElement, this.overflowWidgetsDomNode);
    templateDisposable.add(inputWidget);
    return { inputWidget, inputWidgetHeight: InputRenderer.DEFAULT_HEIGHT, elementDisposables: new DisposableStore(), templateDisposable };
  }
  renderElement(node, index, templateData) {
    const input = node.element;
    templateData.inputWidget.input = input;
    this.inputWidgets.set(input, templateData.inputWidget);
    templateData.elementDisposables.add({
      dispose: () => this.inputWidgets.delete(input)
    });
    const selections = this.editorSelections.get(input);
    if (selections) {
      templateData.inputWidget.selections = selections;
    }
    templateData.elementDisposables.add(toDisposable(() => {
      const selections2 = templateData.inputWidget.selections;
      if (selections2) {
        this.editorSelections.set(input, selections2);
      }
    }));
    templateData.inputWidgetHeight = InputRenderer.DEFAULT_HEIGHT;
    const onDidChangeContentHeight = () => {
      const contentHeight = templateData.inputWidget.getContentHeight();
      this.contentHeights.set(input, contentHeight);
      if (templateData.inputWidgetHeight !== contentHeight) {
        this.updateHeight(input, contentHeight + 10);
        templateData.inputWidgetHeight = contentHeight;
        templateData.inputWidget.layout();
      }
    };
    const startListeningContentHeightChange = () => {
      templateData.elementDisposables.add(templateData.inputWidget.onDidChangeContentHeight(onDidChangeContentHeight));
      onDidChangeContentHeight();
    };
    disposableTimeout(startListeningContentHeightChange, 0, templateData.elementDisposables);
    const layoutEditor = () => templateData.inputWidget.layout();
    templateData.elementDisposables.add(this.outerLayout.onDidChange(layoutEditor));
    layoutEditor();
  }
  renderCompressedElements() {
    throw new Error("Should never happen since node is incompressible");
  }
  disposeElement(group, index, template) {
    template.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.elementDisposables.dispose();
    templateData.templateDisposable.dispose();
  }
  getHeight(input) {
    return (this.contentHeights.get(input) ?? InputRenderer.DEFAULT_HEIGHT) + 10;
  }
  getRenderedInputWidget(input) {
    return this.inputWidgets.get(input);
  }
  getFocusedInput() {
    for (const [input, inputWidget] of this.inputWidgets) {
      if (inputWidget.hasFocus()) {
        return input;
      }
    }
    return void 0;
  }
  clearValidation() {
    for (const [, inputWidget] of this.inputWidgets) {
      inputWidget.clearValidation();
    }
  }
};
InputRenderer = __decorateClass([
  __decorateParam(3, IInstantiationService)
], InputRenderer);
let ResourceGroupRenderer = class {
  constructor(actionViewItemProvider, actionRunner, commandService, contextKeyService, contextMenuService, keybindingService, menuService, scmViewService, telemetryService) {
    this.actionViewItemProvider = actionViewItemProvider;
    this.actionRunner = actionRunner;
    this.commandService = commandService;
    this.contextKeyService = contextKeyService;
    this.contextMenuService = contextMenuService;
    this.keybindingService = keybindingService;
    this.menuService = menuService;
    this.scmViewService = scmViewService;
    this.telemetryService = telemetryService;
  }
  static {
    this.TEMPLATE_ID = "resource group";
  }
  get templateId() {
    return ResourceGroupRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    const element = append(container, $(".resource-group"));
    const name = append(element, $(".name"));
    const actionsContainer = append(element, $(".actions"));
    const actionBar = new WorkbenchToolBar(actionsContainer, {
      actionViewItemProvider: this.actionViewItemProvider,
      actionRunner: this.actionRunner
    }, this.menuService, this.contextKeyService, this.contextMenuService, this.keybindingService, this.commandService, this.telemetryService);
    const countContainer = append(element, $(".count"));
    const count = new CountBadge(countContainer, {}, defaultCountBadgeStyles);
    const disposables = combinedDisposable(actionBar, count);
    return { name, count, actionBar, elementDisposables: new DisposableStore(), disposables };
  }
  renderElement(node, index, template) {
    const group = node.element;
    template.name.textContent = group.label;
    template.count.setCount(group.resources.length);
    const menus = this.scmViewService.menus.getRepositoryMenus(group.provider);
    template.elementDisposables.add(connectPrimaryMenu(menus.getResourceGroupMenu(group), (primary) => {
      template.actionBar.setActions(primary);
    }, "inline"));
    template.actionBar.context = group;
  }
  renderCompressedElements(node) {
    throw new Error("Should never happen since node is incompressible");
  }
  disposeElement(group, index, template) {
    template.elementDisposables.clear();
  }
  disposeTemplate(template) {
    template.elementDisposables.dispose();
    template.disposables.dispose();
  }
};
ResourceGroupRenderer = __decorateClass([
  __decorateParam(2, ICommandService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, IKeybindingService),
  __decorateParam(6, IMenuService),
  __decorateParam(7, ISCMViewService),
  __decorateParam(8, ITelemetryService)
], ResourceGroupRenderer);
class RepositoryPaneActionRunner extends ActionRunner {
  constructor(getSelectedResources) {
    super();
    this.getSelectedResources = getSelectedResources;
  }
  async runAction(action, context) {
    if (!(action instanceof MenuItemAction)) {
      return super.runAction(action, context);
    }
    const isContextResourceGroup = isSCMResourceGroup(context);
    const selection = this.getSelectedResources().filter((r) => isSCMResourceGroup(r) === isContextResourceGroup);
    const contextIsSelected = selection.some((s) => s === context);
    const actualContext = contextIsSelected ? selection : [context];
    const args = actualContext.map((e) => ResourceTree.isResourceNode(e) ? ResourceTree.collect(e) : [e]).flat();
    await action.run(...args);
  }
}
let ResourceRenderer = class {
  constructor(viewMode, labels, actionViewItemProvider, actionRunner, commandService, contextKeyService, contextMenuService, keybindingService, labelService, menuService, scmViewService, telemetryService, themeService) {
    this.viewMode = viewMode;
    this.labels = labels;
    this.actionViewItemProvider = actionViewItemProvider;
    this.actionRunner = actionRunner;
    this.commandService = commandService;
    this.contextKeyService = contextKeyService;
    this.contextMenuService = contextMenuService;
    this.keybindingService = keybindingService;
    this.labelService = labelService;
    this.menuService = menuService;
    this.scmViewService = scmViewService;
    this.telemetryService = telemetryService;
    this.themeService = themeService;
    this.disposables = new DisposableStore();
    this.renderedResources = /* @__PURE__ */ new Map();
    themeService.onDidColorThemeChange(this.onDidColorThemeChange, this, this.disposables);
  }
  static {
    this.TEMPLATE_ID = "resource";
  }
  get templateId() {
    return ResourceRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    const element = append(container, $(".resource"));
    const name = append(element, $(".name"));
    const fileLabel = this.labels.create(name, { supportDescriptionHighlights: true, supportHighlights: true });
    const actionsContainer = append(fileLabel.element, $(".actions"));
    const actionBar = new WorkbenchToolBar(actionsContainer, {
      actionViewItemProvider: this.actionViewItemProvider,
      actionRunner: this.actionRunner
    }, this.menuService, this.contextKeyService, this.contextMenuService, this.keybindingService, this.commandService, this.telemetryService);
    const decorationIcon = append(element, $(".decoration-icon"));
    const actionBarMenuListener = new MutableDisposable();
    const disposables = combinedDisposable(actionBar, fileLabel, actionBarMenuListener);
    return { element, name, fileLabel, decorationIcon, actionBar, actionBarMenu: void 0, actionBarMenuListener, elementDisposables: new DisposableStore(), disposables };
  }
  renderElement(node, index, template) {
    const resourceOrFolder = node.element;
    const iconResource = ResourceTree.isResourceNode(resourceOrFolder) ? resourceOrFolder.element : resourceOrFolder;
    const uri = ResourceTree.isResourceNode(resourceOrFolder) ? resourceOrFolder.uri : resourceOrFolder.sourceUri;
    const fileKind = ResourceTree.isResourceNode(resourceOrFolder) ? FileKind.FOLDER : FileKind.FILE;
    const tooltip = !ResourceTree.isResourceNode(resourceOrFolder) && resourceOrFolder.decorations.tooltip || "";
    const hidePath = this.viewMode() === ViewMode.Tree;
    let matches;
    let descriptionMatches;
    let strikethrough;
    if (ResourceTree.isResourceNode(resourceOrFolder)) {
      if (resourceOrFolder.element) {
        const menus = this.scmViewService.menus.getRepositoryMenus(resourceOrFolder.element.resourceGroup.provider);
        this._renderActionBar(template, resourceOrFolder, menus.getResourceMenu(resourceOrFolder.element));
        template.element.classList.toggle("faded", resourceOrFolder.element.decorations.faded);
        strikethrough = resourceOrFolder.element.decorations.strikeThrough;
      } else {
        const menus = this.scmViewService.menus.getRepositoryMenus(resourceOrFolder.context.provider);
        this._renderActionBar(template, resourceOrFolder, menus.getResourceFolderMenu(resourceOrFolder.context));
        matches = createMatches(node.filterData);
        template.element.classList.remove("faded");
      }
    } else {
      const menus = this.scmViewService.menus.getRepositoryMenus(resourceOrFolder.resourceGroup.provider);
      this._renderActionBar(template, resourceOrFolder, menus.getResourceMenu(resourceOrFolder));
      [matches, descriptionMatches] = processResourceFilterData(uri, node.filterData);
      template.element.classList.toggle("faded", resourceOrFolder.decorations.faded);
      strikethrough = resourceOrFolder.decorations.strikeThrough;
    }
    const renderedData = {
      tooltip,
      uri,
      fileLabelOptions: { hidePath, fileKind, matches, descriptionMatches, strikethrough },
      iconResource
    };
    this.renderIcon(template, renderedData);
    this.renderedResources.set(template, renderedData);
    template.elementDisposables.add(toDisposable(() => this.renderedResources.delete(template)));
    template.element.setAttribute("data-tooltip", tooltip);
  }
  disposeElement(resource, index, template) {
    template.elementDisposables.clear();
  }
  renderCompressedElements(node, index, template) {
    const compressed = node.element;
    const folder = compressed.elements[compressed.elements.length - 1];
    const label = compressed.elements.map((e) => e.name);
    const fileKind = FileKind.FOLDER;
    const matches = createMatches(node.filterData);
    template.fileLabel.setResource({ resource: folder.uri, name: label }, {
      fileDecorations: { colors: false, badges: true },
      fileKind,
      matches,
      separator: this.labelService.getSeparator(folder.uri.scheme)
    });
    const menus = this.scmViewService.menus.getRepositoryMenus(folder.context.provider);
    this._renderActionBar(template, folder, menus.getResourceFolderMenu(folder.context));
    template.name.classList.remove("strike-through");
    template.element.classList.remove("faded");
    template.decorationIcon.style.display = "none";
    template.decorationIcon.style.backgroundImage = "";
    template.element.setAttribute("data-tooltip", "");
  }
  disposeCompressedElements(node, index, template) {
    template.elementDisposables.clear();
  }
  disposeTemplate(template) {
    template.elementDisposables.dispose();
    template.disposables.dispose();
  }
  _renderActionBar(template, resourceOrFolder, menu) {
    if (!template.actionBarMenu || template.actionBarMenu !== menu) {
      template.actionBarMenu = menu;
      template.actionBarMenuListener.value = connectPrimaryMenu(menu, (primary) => {
        template.actionBar.setActions(primary);
      }, "inline");
    }
    template.actionBar.context = resourceOrFolder;
  }
  onDidColorThemeChange() {
    for (const [template, data] of this.renderedResources) {
      this.renderIcon(template, data);
    }
  }
  renderIcon(template, data) {
    const theme = this.themeService.getColorTheme();
    const icon = isDark(theme.type) ? data.iconResource?.decorations.iconDark : data.iconResource?.decorations.icon;
    template.fileLabel.setFile(data.uri, {
      ...data.fileLabelOptions,
      fileDecorations: { colors: false, badges: !icon }
    });
    if (icon) {
      if (ThemeIcon.isThemeIcon(icon)) {
        template.decorationIcon.className = `decoration-icon ${ThemeIcon.asClassName(icon)}`;
        if (icon.color) {
          template.decorationIcon.style.color = theme.getColor(icon.color.id)?.toString() ?? "";
        }
        template.decorationIcon.style.display = "";
        template.decorationIcon.style.backgroundImage = "";
      } else {
        template.decorationIcon.className = "decoration-icon";
        template.decorationIcon.style.color = "";
        template.decorationIcon.style.display = "";
        template.decorationIcon.style.backgroundImage = asCSSUrl(icon);
      }
      template.decorationIcon.title = data.tooltip;
    } else {
      template.decorationIcon.className = "decoration-icon";
      template.decorationIcon.style.color = "";
      template.decorationIcon.style.display = "none";
      template.decorationIcon.style.backgroundImage = "";
      template.decorationIcon.title = "";
    }
  }
  dispose() {
    this.disposables.dispose();
  }
};
ResourceRenderer = __decorateClass([
  __decorateParam(4, ICommandService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IContextMenuService),
  __decorateParam(7, IKeybindingService),
  __decorateParam(8, ILabelService),
  __decorateParam(9, IMenuService),
  __decorateParam(10, ISCMViewService),
  __decorateParam(11, ITelemetryService),
  __decorateParam(12, IThemeService)
], ResourceRenderer);
class ListDelegate {
  constructor(inputRenderer) {
    this.inputRenderer = inputRenderer;
  }
  getHeight(element) {
    if (isSCMInput(element)) {
      return this.inputRenderer.getHeight(element);
    } else if (isSCMActionButton(element)) {
      return ActionButtonRenderer.DEFAULT_HEIGHT + 8;
    } else {
      return 22;
    }
  }
  getTemplateId(element) {
    if (isSCMRepository(element)) {
      return RepositoryRenderer.TEMPLATE_ID;
    } else if (isSCMInput(element)) {
      return InputRenderer.TEMPLATE_ID;
    } else if (isSCMActionButton(element)) {
      return ActionButtonRenderer.TEMPLATE_ID;
    } else if (isSCMResourceGroup(element)) {
      return ResourceGroupRenderer.TEMPLATE_ID;
    } else if (isSCMResource(element) || isSCMResourceNode(element)) {
      return ResourceRenderer.TEMPLATE_ID;
    } else {
      throw new Error("Unknown element");
    }
  }
}
class SCMTreeCompressionDelegate {
  isIncompressible(element) {
    if (ResourceTree.isResourceNode(element)) {
      return element.childrenCount === 0 || !element.parent || !element.parent.parent;
    }
    return true;
  }
}
class SCMTreeFilter {
  filter(element) {
    if (isSCMResourceGroup(element)) {
      return element.resources.length > 0 || !element.hideWhenEmpty;
    } else {
      return true;
    }
  }
}
class SCMTreeSorter {
  constructor(viewMode, viewSortKey) {
    this.viewMode = viewMode;
    this.viewSortKey = viewSortKey;
  }
  compare(one, other) {
    if (isSCMRepository(one)) {
      if (!isSCMRepository(other)) {
        throw new Error("Invalid comparison");
      }
      return 0;
    }
    if (isSCMInput(one)) {
      return -1;
    } else if (isSCMInput(other)) {
      return 1;
    }
    if (isSCMActionButton(one)) {
      return -1;
    } else if (isSCMActionButton(other)) {
      return 1;
    }
    if (isSCMResourceGroup(one)) {
      return isSCMResourceGroup(other) ? 0 : -1;
    }
    if (this.viewMode() === ViewMode.List) {
      if (this.viewSortKey() === "name" /* Name */) {
        const oneName2 = basename(one.sourceUri);
        const otherName2 = basename(other.sourceUri);
        return compareFileNames(oneName2, otherName2);
      }
      if (this.viewSortKey() === "status" /* Status */) {
        const oneTooltip = one.decorations.tooltip ?? "";
        const otherTooltip = other.decorations.tooltip ?? "";
        if (oneTooltip !== otherTooltip) {
          return compare(oneTooltip, otherTooltip);
        }
      }
      const onePath = one.sourceUri.fsPath;
      const otherPath = other.sourceUri.fsPath;
      return comparePaths(onePath, otherPath);
    }
    const oneIsDirectory = ResourceTree.isResourceNode(one);
    const otherIsDirectory = ResourceTree.isResourceNode(other);
    if (oneIsDirectory !== otherIsDirectory) {
      return oneIsDirectory ? -1 : 1;
    }
    const oneName = ResourceTree.isResourceNode(one) ? one.name : basename(one.sourceUri);
    const otherName = ResourceTree.isResourceNode(other) ? other.name : basename(other.sourceUri);
    return compareFileNames(oneName, otherName);
  }
}
let SCMTreeKeyboardNavigationLabelProvider = class {
  constructor(viewMode, labelService) {
    this.viewMode = viewMode;
    this.labelService = labelService;
  }
  getKeyboardNavigationLabel(element) {
    if (ResourceTree.isResourceNode(element)) {
      return element.name;
    } else if (isSCMRepository(element) || isSCMInput(element) || isSCMActionButton(element)) {
      return void 0;
    } else if (isSCMResourceGroup(element)) {
      return element.label;
    } else {
      if (this.viewMode() === ViewMode.List) {
        const fileName = basename(element.sourceUri);
        const filePath = this.labelService.getUriLabel(element.sourceUri, { relative: true });
        return [fileName, filePath];
      } else {
        return basename(element.sourceUri);
      }
    }
  }
  getCompressedNodeKeyboardNavigationLabel(elements) {
    const folders = elements;
    return folders.map((e) => e.name).join("/");
  }
};
SCMTreeKeyboardNavigationLabelProvider = __decorateClass([
  __decorateParam(1, ILabelService)
], SCMTreeKeyboardNavigationLabelProvider);
function getSCMResourceId(element) {
  if (isSCMRepository(element)) {
    const provider = element.provider;
    return `repo:${provider.id}`;
  } else if (isSCMInput(element)) {
    const provider = element.repository.provider;
    return `input:${provider.id}`;
  } else if (isSCMActionButton(element)) {
    const provider = element.repository.provider;
    return `actionButton:${provider.id}`;
  } else if (isSCMResourceGroup(element)) {
    const provider = element.provider;
    return `resourceGroup:${provider.id}/${element.id}`;
  } else if (isSCMResource(element)) {
    const group = element.resourceGroup;
    const provider = group.provider;
    return `resource:${provider.id}/${group.id}/${element.sourceUri.toString()}`;
  } else if (isSCMResourceNode(element)) {
    const group = element.context;
    return `folder:${group.provider.id}/${group.id}/$FOLDER/${element.uri.toString()}`;
  } else {
    throw new Error("Invalid tree element");
  }
}
class SCMResourceIdentityProvider {
  getId(element) {
    return getSCMResourceId(element);
  }
}
let SCMAccessibilityProvider = class {
  constructor(accessibilityService, configurationService, keybindingService, labelService) {
    this.accessibilityService = accessibilityService;
    this.configurationService = configurationService;
    this.keybindingService = keybindingService;
    this.labelService = labelService;
  }
  getWidgetAriaLabel() {
    return localize("scm", "Source Control Management");
  }
  getAriaLabel(element) {
    if (ResourceTree.isResourceNode(element)) {
      return this.labelService.getUriLabel(element.uri, { relative: true, noPrefix: true }) || element.name;
    } else if (isSCMRepository(element)) {
      return `${element.provider.name} ${element.provider.label}`;
    } else if (isSCMInput(element)) {
      const verbosity = this.configurationService.getValue(AccessibilityVerbositySettingId.SourceControl) === true;
      if (!verbosity || !this.accessibilityService.isScreenReaderOptimized()) {
        return localize("scmInput", "Source Control Input");
      }
      const kbLabel = this.keybindingService.lookupKeybinding(AccessibilityCommandId.OpenAccessibilityHelp)?.getLabel();
      return kbLabel ? localize("scmInputRow.accessibilityHelp", "Source Control Input, Use {0} to open Source Control Accessibility Help.", kbLabel) : localize("scmInputRow.accessibilityHelpNoKb", "Source Control Input, Run the Open Accessibility Help command for more information.");
    } else if (isSCMActionButton(element)) {
      return element.button?.command.title ?? "";
    } else if (isSCMResourceGroup(element)) {
      return element.label;
    } else {
      const result = [];
      result.push(basename(element.sourceUri));
      if (element.decorations.tooltip) {
        result.push(element.decorations.tooltip);
      }
      const path = this.labelService.getUriLabel(dirname(element.sourceUri), { relative: true, noPrefix: true });
      if (path) {
        result.push(path);
      }
      return result.join(", ");
    }
  }
};
SCMAccessibilityProvider = __decorateClass([
  __decorateParam(0, IAccessibilityService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IKeybindingService),
  __decorateParam(3, ILabelService)
], SCMAccessibilityProvider);
var ViewSortKey = /* @__PURE__ */ ((ViewSortKey2) => {
  ViewSortKey2["Path"] = "path";
  ViewSortKey2["Name"] = "name";
  ViewSortKey2["Status"] = "status";
  return ViewSortKey2;
})(ViewSortKey || {});
const Menus = {
  ViewSort: new MenuId("SCMViewSort"),
  Repositories: new MenuId("SCMRepositories"),
  ChangesSettings: new MenuId("SCMChangesSettings")
};
const ContextKeys = {
  SCMViewMode: new RawContextKey("scmViewMode", ViewMode.List),
  SCMViewSortKey: new RawContextKey("scmViewSortKey", "path" /* Path */),
  SCMViewAreAllRepositoriesCollapsed: new RawContextKey("scmViewAreAllRepositoriesCollapsed", false),
  SCMViewIsAnyRepositoryCollapsible: new RawContextKey("scmViewIsAnyRepositoryCollapsible", false),
  SCMProvider: new RawContextKey("scmProvider", void 0),
  SCMProviderRootUri: new RawContextKey("scmProviderRootUri", void 0),
  SCMProviderHasRootUri: new RawContextKey("scmProviderHasRootUri", void 0),
  SCMHistoryItemCount: new RawContextKey("scmHistoryItemCount", 0),
  SCMHistoryViewMode: new RawContextKey("scmHistoryViewMode", ViewMode.List),
  SCMCurrentHistoryItemRefHasRemote: new RawContextKey("scmCurrentHistoryItemRefHasRemote", false),
  SCMCurrentHistoryItemRefHasBase: new RawContextKey("scmCurrentHistoryItemRefHasBase", false),
  SCMCurrentHistoryItemRefInFilter: new RawContextKey("scmCurrentHistoryItemRefInFilter", false),
  RepositoryCount: new RawContextKey("scmRepositoryCount", 0),
  RepositoryVisibilityCount: new RawContextKey("scmRepositoryVisibleCount", 0),
  RepositoryVisibility(repository) {
    return new RawContextKey(`scmRepositoryVisible:${repository.provider.id}`, false);
  }
};
MenuRegistry.appendMenuItem(MenuId.SCMTitle, {
  title: localize("sortAction", "View & Sort"),
  submenu: Menus.ViewSort,
  when: ContextKeyExpr.and(ContextKeyExpr.equals("view", VIEW_PANE_ID), ContextKeys.RepositoryCount.notEqualsTo(0)),
  group: "0_view&sort",
  order: 1
});
MenuRegistry.appendMenuItem(Menus.ViewSort, {
  title: localize("repositories", "Repositories"),
  submenu: Menus.Repositories,
  when: ContextKeyExpr.greater(ContextKeys.RepositoryCount.key, 1),
  group: "0_repositories"
});
class RepositoryVisibilityAction extends Action2 {
  constructor(repository) {
    super({
      id: `workbench.scm.action.toggleRepositoryVisibility.${repository.provider.id}`,
      title: repository.provider.name,
      f1: false,
      precondition: ContextKeyExpr.or(ContextKeys.RepositoryVisibilityCount.notEqualsTo(1), ContextKeys.RepositoryVisibility(repository).isEqualTo(false)),
      toggled: ContextKeys.RepositoryVisibility(repository).isEqualTo(true),
      menu: { id: Menus.Repositories, group: "0_repositories" }
    });
    this.repository = repository;
  }
  run(accessor) {
    const scmViewService = accessor.get(ISCMViewService);
    scmViewService.toggleVisibility(this.repository);
  }
}
let RepositoryVisibilityActionController = class {
  constructor(contextKeyService, scmViewService, scmService) {
    this.contextKeyService = contextKeyService;
    this.scmViewService = scmViewService;
    this.items = /* @__PURE__ */ new Map();
    this.disposables = new DisposableStore();
    this.repositoryCountContextKey = ContextKeys.RepositoryCount.bindTo(contextKeyService);
    this.repositoryVisibilityCountContextKey = ContextKeys.RepositoryVisibilityCount.bindTo(contextKeyService);
    scmViewService.onDidChangeVisibleRepositories(this.onDidChangeVisibleRepositories, this, this.disposables);
    scmService.onDidAddRepository(this.onDidAddRepository, this, this.disposables);
    scmService.onDidRemoveRepository(this.onDidRemoveRepository, this, this.disposables);
    for (const repository of scmService.repositories) {
      this.onDidAddRepository(repository);
    }
  }
  onDidAddRepository(repository) {
    if (repository.provider.isHidden) {
      return;
    }
    const action = registerAction2(class extends RepositoryVisibilityAction {
      constructor() {
        super(repository);
      }
    });
    const contextKey = ContextKeys.RepositoryVisibility(repository).bindTo(this.contextKeyService);
    contextKey.set(this.scmViewService.isVisible(repository));
    this.items.set(repository, {
      contextKey,
      dispose() {
        contextKey.reset();
        action.dispose();
      }
    });
    this.updateRepositoryContextKeys();
  }
  onDidRemoveRepository(repository) {
    this.items.get(repository)?.dispose();
    this.items.delete(repository);
    this.updateRepositoryContextKeys();
  }
  onDidChangeVisibleRepositories() {
    let count = 0;
    for (const [repository, item] of this.items) {
      const isVisible = this.scmViewService.isVisible(repository);
      item.contextKey.set(isVisible);
      if (isVisible) {
        count++;
      }
    }
    this.repositoryCountContextKey.set(this.items.size);
    this.repositoryVisibilityCountContextKey.set(count);
  }
  updateRepositoryContextKeys() {
    this.repositoryCountContextKey.set(this.items.size);
    this.repositoryVisibilityCountContextKey.set(Iterable.reduce(this.items.keys(), (r, repository) => r + (this.scmViewService.isVisible(repository) ? 1 : 0), 0));
  }
  dispose() {
    this.disposables.dispose();
    dispose(this.items.values());
    this.items.clear();
  }
};
RepositoryVisibilityActionController = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, ISCMViewService),
  __decorateParam(2, ISCMService)
], RepositoryVisibilityActionController);
class SetListViewModeAction extends ViewAction {
  constructor(id = "workbench.scm.action.setListViewMode", menu = {}) {
    super({
      id,
      title: localize("setListViewMode", "View as List"),
      viewId: VIEW_PANE_ID,
      f1: false,
      icon: Codicon.listTree,
      toggled: ContextKeys.SCMViewMode.isEqualTo(ViewMode.List),
      menu: { id: Menus.ViewSort, group: "1_viewmode", ...menu }
    });
  }
  async runInView(_, view) {
    view.viewMode = ViewMode.List;
  }
}
class SetListViewModeNavigationAction extends SetListViewModeAction {
  constructor() {
    super(
      "workbench.scm.action.setListViewModeNavigation",
      {
        id: MenuId.SCMTitle,
        when: ContextKeyExpr.and(ContextKeyExpr.equals("view", VIEW_PANE_ID), ContextKeys.RepositoryCount.notEqualsTo(0), ContextKeys.SCMViewMode.isEqualTo(ViewMode.Tree)),
        group: "navigation",
        isHiddenByDefault: true,
        order: -1e3
      }
    );
  }
}
class SetTreeViewModeAction extends ViewAction {
  constructor(id = "workbench.scm.action.setTreeViewMode", menu = {}) {
    super(
      {
        id,
        title: localize("setTreeViewMode", "View as Tree"),
        viewId: VIEW_PANE_ID,
        f1: false,
        icon: Codicon.listFlat,
        toggled: ContextKeys.SCMViewMode.isEqualTo(ViewMode.Tree),
        menu: { id: Menus.ViewSort, group: "1_viewmode", ...menu }
      }
    );
  }
  async runInView(_, view) {
    view.viewMode = ViewMode.Tree;
  }
}
class SetTreeViewModeNavigationAction extends SetTreeViewModeAction {
  constructor() {
    super(
      "workbench.scm.action.setTreeViewModeNavigation",
      {
        id: MenuId.SCMTitle,
        when: ContextKeyExpr.and(ContextKeyExpr.equals("view", VIEW_PANE_ID), ContextKeys.RepositoryCount.notEqualsTo(0), ContextKeys.SCMViewMode.isEqualTo(ViewMode.List)),
        group: "navigation",
        isHiddenByDefault: true,
        order: -1e3
      }
    );
  }
}
registerAction2(SetListViewModeAction);
registerAction2(SetTreeViewModeAction);
registerAction2(SetListViewModeNavigationAction);
registerAction2(SetTreeViewModeNavigationAction);
class RepositorySortAction extends Action2 {
  constructor(sortKey, title) {
    super({
      id: `workbench.scm.action.repositories.setSortKey.${sortKey}`,
      title,
      f1: false,
      toggled: RepositoryContextKeys.RepositorySortKey.isEqualTo(sortKey),
      menu: [
        {
          id: Menus.Repositories,
          group: "1_sort"
        },
        {
          id: MenuId.SCMSourceControlTitle,
          group: "1_sort"
        }
      ]
    });
    this.sortKey = sortKey;
  }
  run(accessor) {
    accessor.get(ISCMViewService).toggleSortKey(this.sortKey);
  }
}
class RepositorySortByDiscoveryTimeAction extends RepositorySortAction {
  constructor() {
    super(ISCMRepositorySortKey.DiscoveryTime, localize("repositorySortByDiscoveryTime", "Sort by Discovery Time"));
  }
}
class RepositorySortByNameAction extends RepositorySortAction {
  constructor() {
    super(ISCMRepositorySortKey.Name, localize("repositorySortByName", "Sort by Name"));
  }
}
class RepositorySortByPathAction extends RepositorySortAction {
  constructor() {
    super(ISCMRepositorySortKey.Path, localize("repositorySortByPath", "Sort by Path"));
  }
}
registerAction2(RepositorySortByDiscoveryTimeAction);
registerAction2(RepositorySortByNameAction);
registerAction2(RepositorySortByPathAction);
class RepositorySelectionModeAction extends Action2 {
  constructor(selectionMode, title, order) {
    super({
      id: `workbench.scm.action.repositories.setSelectionMode.${selectionMode}`,
      title,
      f1: false,
      toggled: RepositoryContextKeys.RepositorySelectionMode.isEqualTo(selectionMode),
      menu: [
        {
          id: Menus.Repositories,
          when: ContextKeyExpr.and(
            ContextKeyExpr.has("scm.providerCount"),
            ContextKeyExpr.greater("scm.providerCount", 1)
          ),
          group: "2_selectionMode",
          order
        },
        {
          id: MenuId.SCMSourceControlTitle,
          when: ContextKeyExpr.and(
            ContextKeyExpr.has("scm.providerCount"),
            ContextKeyExpr.greater("scm.providerCount", 1)
          ),
          group: "2_selectionMode",
          order
        }
      ]
    });
    this.selectionMode = selectionMode;
  }
  run(accessor) {
    accessor.get(ISCMViewService).toggleSelectionMode(this.selectionMode);
  }
}
class RepositorySingleSelectionModeAction extends RepositorySelectionModeAction {
  constructor() {
    super(ISCMRepositorySelectionMode.Single, localize("repositorySingleSelectionMode", "Select Single Repository"), 1);
  }
}
class RepositoryMultiSelectionModeAction extends RepositorySelectionModeAction {
  constructor() {
    super(ISCMRepositorySelectionMode.Multiple, localize("repositoryMultiSelectionMode", "Select Multiple Repositories"), 2);
  }
}
registerAction2(RepositorySingleSelectionModeAction);
registerAction2(RepositoryMultiSelectionModeAction);
class SetSortKeyAction extends ViewAction {
  constructor(sortKey, title) {
    super({
      id: `workbench.scm.action.setSortKey.${sortKey}`,
      title,
      viewId: VIEW_PANE_ID,
      f1: false,
      toggled: ContextKeys.SCMViewSortKey.isEqualTo(sortKey),
      precondition: ContextKeys.SCMViewMode.isEqualTo(ViewMode.List),
      menu: { id: Menus.ViewSort, group: "2_sort" }
    });
    this.sortKey = sortKey;
  }
  async runInView(_, view) {
    view.viewSortKey = this.sortKey;
  }
}
class SetSortByNameAction extends SetSortKeyAction {
  constructor() {
    super("name" /* Name */, localize("sortChangesByName", "Sort Changes by Name"));
  }
}
class SetSortByPathAction extends SetSortKeyAction {
  constructor() {
    super("path" /* Path */, localize("sortChangesByPath", "Sort Changes by Path"));
  }
}
class SetSortByStatusAction extends SetSortKeyAction {
  constructor() {
    super("status" /* Status */, localize("sortChangesByStatus", "Sort Changes by Status"));
  }
}
registerAction2(SetSortByNameAction);
registerAction2(SetSortByPathAction);
registerAction2(SetSortByStatusAction);
class CollapseAllRepositoriesAction extends ViewAction {
  constructor() {
    super({
      id: `workbench.scm.action.collapseAllRepositories`,
      title: localize("collapse all", "Collapse All Repositories"),
      viewId: VIEW_PANE_ID,
      f1: false,
      icon: Codicon.collapseAll,
      menu: {
        id: MenuId.SCMTitle,
        group: "navigation",
        when: ContextKeyExpr.and(ContextKeyExpr.equals("view", VIEW_PANE_ID), ContextKeys.SCMViewIsAnyRepositoryCollapsible.isEqualTo(true), ContextKeys.SCMViewAreAllRepositoriesCollapsed.isEqualTo(false))
      }
    });
  }
  async runInView(_, view) {
    view.collapseAllRepositories();
  }
}
class ExpandAllRepositoriesAction extends ViewAction {
  constructor() {
    super({
      id: `workbench.scm.action.expandAllRepositories`,
      title: localize("expand all", "Expand All Repositories"),
      viewId: VIEW_PANE_ID,
      f1: false,
      icon: Codicon.expandAll,
      menu: {
        id: MenuId.SCMTitle,
        group: "navigation",
        when: ContextKeyExpr.and(ContextKeyExpr.equals("view", VIEW_PANE_ID), ContextKeys.SCMViewIsAnyRepositoryCollapsible.isEqualTo(true), ContextKeys.SCMViewAreAllRepositoriesCollapsed.isEqualTo(true))
      }
    });
  }
  async runInView(_, view) {
    view.expandAllRepositories();
  }
}
registerAction2(CollapseAllRepositoriesAction);
registerAction2(ExpandAllRepositoriesAction);
class CollapseAllAction extends ViewAction {
  constructor() {
    super({
      id: `workbench.scm.action.collapseAll`,
      title: localize("scmCollapseAll", "Collapse All"),
      viewId: VIEW_PANE_ID,
      f1: false,
      icon: Codicon.collapseAll,
      menu: {
        id: MenuId.SCMResourceGroupContext,
        group: "9_collapse",
        when: ContextKeys.SCMViewMode.isEqualTo(ViewMode.Tree)
      }
    });
  }
  async runInView(_accessor, view, context) {
    if (context) {
      view.collapseAllResources(context);
    }
  }
}
registerAction2(CollapseAllAction);
let SCMViewPane = class extends ViewPane {
  constructor(options, commandService, editorService, menuService, scmService, scmViewService, storageService, uriIdentityService, keybindingService, themeService, contextMenuService, instantiationService, viewDescriptorService, configurationService, contextKeyService, openerService, hoverService) {
    super({ ...options, titleMenuId: MenuId.SCMTitle }, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.commandService = commandService;
    this.editorService = editorService;
    this.menuService = menuService;
    this.scmService = scmService;
    this.scmViewService = scmViewService;
    this.storageService = storageService;
    this.uriIdentityService = uriIdentityService;
    this._onDidChangeViewMode = this._register(new Emitter());
    this.onDidChangeViewMode = this._onDidChangeViewMode.event;
    this._onDidChangeViewSortKey = this._register(new Emitter());
    this.onDidChangeViewSortKey = this._onDidChangeViewSortKey.event;
    this.items = new DisposableMap();
    this.visibilityDisposables = new DisposableStore();
    this.treeOperationSequencer = new Sequencer();
    this.revealResourceThrottler = new Throttler();
    this.updateChildrenThrottler = new Throttler();
    this.disposables = new DisposableStore();
    this._viewMode = this.getViewMode();
    this._viewSortKey = this.getViewSortKey();
    this.viewModeContextKey = ContextKeys.SCMViewMode.bindTo(contextKeyService);
    this.viewModeContextKey.set(this._viewMode);
    this.viewSortKeyContextKey = ContextKeys.SCMViewSortKey.bindTo(contextKeyService);
    this.viewSortKeyContextKey.set(this.viewSortKey);
    this.areAllRepositoriesCollapsedContextKey = ContextKeys.SCMViewAreAllRepositoriesCollapsed.bindTo(contextKeyService);
    this.isAnyRepositoryCollapsibleContextKey = ContextKeys.SCMViewIsAnyRepositoryCollapsible.bindTo(contextKeyService);
    this.scmProviderContextKey = ContextKeys.SCMProvider.bindTo(contextKeyService);
    this.scmProviderRootUriContextKey = ContextKeys.SCMProviderRootUri.bindTo(contextKeyService);
    this.scmProviderHasRootUriContextKey = ContextKeys.SCMProviderHasRootUri.bindTo(contextKeyService);
    this._onDidLayout = this._register(new Emitter());
    this.layoutCache = { height: void 0, width: void 0, onDidChange: this._onDidLayout.event };
    this.storageService.onDidChangeValue(StorageScope.WORKSPACE, void 0, this.disposables)((e) => {
      switch (e.key) {
        case "scm.viewMode":
          this.viewMode = this.getViewMode();
          break;
        case "scm.viewSortKey":
          this.viewSortKey = this.getViewSortKey();
          break;
      }
    }, this, this.disposables);
    this.storageService.onWillSaveState((e) => {
      this.viewMode = this.getViewMode();
      this.viewSortKey = this.getViewSortKey();
      this.storeTreeViewState();
    }, this, this.disposables);
    Event.any(this.scmService.onDidAddRepository, this.scmService.onDidRemoveRepository)(() => this._onDidChangeViewWelcomeState.fire(), this, this.disposables);
    this.disposables.add(this.revealResourceThrottler);
    this.disposables.add(this.updateChildrenThrottler);
  }
  get viewMode() {
    return this._viewMode;
  }
  set viewMode(mode) {
    if (this._viewMode === mode) {
      return;
    }
    this._viewMode = mode;
    this.viewSortKey = this.getViewSortKey();
    this.updateChildren();
    this.onDidActiveEditorChange();
    this._onDidChangeViewMode.fire(mode);
    this.viewModeContextKey.set(mode);
    this.updateIndentStyles(this.themeService.getFileIconTheme());
    this.storageService.store(`scm.viewMode`, mode, StorageScope.WORKSPACE, StorageTarget.USER);
  }
  get viewSortKey() {
    return this._viewSortKey;
  }
  set viewSortKey(sortKey) {
    if (this._viewSortKey === sortKey) {
      return;
    }
    this._viewSortKey = sortKey;
    this.updateChildren();
    this.viewSortKeyContextKey.set(sortKey);
    this._onDidChangeViewSortKey.fire(sortKey);
    if (this._viewMode === ViewMode.List) {
      this.storageService.store(`scm.viewSortKey`, sortKey, StorageScope.WORKSPACE, StorageTarget.USER);
    }
  }
  layoutBody(height = this.layoutCache.height, width = this.layoutCache.width) {
    if (height === void 0) {
      return;
    }
    if (width !== void 0) {
      super.layoutBody(height, width);
    }
    this.layoutCache.height = height;
    this.layoutCache.width = width;
    this._onDidLayout.fire();
    this.treeContainer.style.height = `${height}px`;
    this.tree.layout(height, width);
  }
  renderBody(container) {
    super.renderBody(container);
    this.treeContainer = append(container, $(".scm-view.show-file-icons"));
    this.treeContainer.classList.add("file-icon-themable-tree");
    this.treeContainer.classList.add("show-file-icons");
    const updateActionsVisibility = () => this.treeContainer.classList.toggle("show-actions", this.configurationService.getValue("scm.alwaysShowActions"));
    Event.filter(this.configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration("scm.alwaysShowActions"), this.disposables)(updateActionsVisibility, this, this.disposables);
    updateActionsVisibility();
    const updateProviderCountVisibility = () => {
      const value = this.configurationService.getValue("scm.providerCountBadge");
      this.treeContainer.classList.toggle("hide-provider-counts", value === "hidden");
      this.treeContainer.classList.toggle("auto-provider-counts", value === "auto");
    };
    Event.filter(this.configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration("scm.providerCountBadge"), this.disposables)(updateProviderCountVisibility, this, this.disposables);
    updateProviderCountVisibility();
    const viewState = this.loadTreeViewState();
    this.createTree(this.treeContainer, viewState);
    this.onDidChangeBodyVisibility(async (visible) => {
      if (visible) {
        this.treeOperationSequencer.queue(async () => {
          await this.tree.setInput(this.scmViewService, viewState);
          Event.filter(
            this.configurationService.onDidChangeConfiguration,
            (e) => e.affectsConfiguration("scm.alwaysShowRepositories"),
            this.visibilityDisposables
          )(() => {
            this.updateActions();
            this.updateChildren();
          }, this, this.visibilityDisposables);
          Event.filter(
            this.configurationService.onDidChangeConfiguration,
            (e) => e.affectsConfiguration("scm.inputMinLineCount") || e.affectsConfiguration("scm.inputMaxLineCount") || e.affectsConfiguration("scm.showActionButton"),
            this.visibilityDisposables
          )(() => this.updateChildren(), this, this.visibilityDisposables);
          this.editorService.onDidActiveEditorChange(this.onDidActiveEditorChange, this, this.visibilityDisposables);
          this.scmViewService.onDidChangeVisibleRepositories(this.onDidChangeVisibleRepositories, this, this.visibilityDisposables);
          this.onDidChangeVisibleRepositories({ added: this.scmViewService.visibleRepositories, removed: Iterable.empty() });
          if (typeof this.treeScrollTop === "number") {
            this.tree.scrollTop = this.treeScrollTop;
            this.treeScrollTop = void 0;
          }
          this.updateRepositoryCollapseAllContextKeys();
        });
      } else {
        this.visibilityDisposables.clear();
        this.onDidChangeVisibleRepositories({ added: Iterable.empty(), removed: [...this.items.keys()] });
        this.treeScrollTop = this.tree.scrollTop;
        this.updateRepositoryCollapseAllContextKeys();
      }
    }, this, this.disposables);
    this.disposables.add(this.instantiationService.createInstance(RepositoryVisibilityActionController));
    this.themeService.onDidFileIconThemeChange(this.updateIndentStyles, this, this.disposables);
    this.updateIndentStyles(this.themeService.getFileIconTheme());
  }
  createTree(container, viewState) {
    const overflowWidgetsDomNode = $(".scm-overflow-widgets-container.monaco-editor");
    this.inputRenderer = this.instantiationService.createInstance(InputRenderer, this.layoutCache, overflowWidgetsDomNode, (input, height) => {
      try {
        this.tree.updateElementHeight(input, height);
      } catch {
      }
    });
    this.actionButtonRenderer = this.instantiationService.createInstance(ActionButtonRenderer);
    this.listLabels = this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this.onDidChangeBodyVisibility });
    this.disposables.add(this.listLabels);
    const resourceActionRunner = new RepositoryPaneActionRunner(() => this.getSelectedResources());
    resourceActionRunner.onWillRun(() => this.tree.domFocus(), this, this.disposables);
    this.disposables.add(resourceActionRunner);
    const treeDataSource = this.instantiationService.createInstance(SCMTreeDataSource, () => this.viewMode);
    this.disposables.add(treeDataSource);
    const compressionEnabled = observableConfigValue("scm.compactFolders", true, this.configurationService);
    this.tree = this.instantiationService.createInstance(
      WorkbenchCompressibleAsyncDataTree,
      "SCM Tree Repo",
      container,
      new ListDelegate(this.inputRenderer),
      new SCMTreeCompressionDelegate(),
      [
        this.inputRenderer,
        this.actionButtonRenderer,
        this.instantiationService.createInstance(RepositoryRenderer, MenuId.SCMTitle, getActionViewItemProvider(this.instantiationService)),
        this.instantiationService.createInstance(ResourceGroupRenderer, getActionViewItemProvider(this.instantiationService), resourceActionRunner),
        this.instantiationService.createInstance(ResourceRenderer, () => this.viewMode, this.listLabels, getActionViewItemProvider(this.instantiationService), resourceActionRunner)
      ],
      treeDataSource,
      {
        horizontalScrolling: false,
        setRowLineHeight: false,
        transformOptimization: false,
        filter: new SCMTreeFilter(),
        dnd: new SCMTreeDragAndDrop(this.instantiationService),
        identityProvider: new SCMResourceIdentityProvider(),
        sorter: new SCMTreeSorter(() => this.viewMode, () => this.viewSortKey),
        keyboardNavigationLabelProvider: this.instantiationService.createInstance(SCMTreeKeyboardNavigationLabelProvider, () => this.viewMode),
        overrideStyles: this.getLocationBasedColors().listOverrideStyles,
        compressionEnabled: compressionEnabled.get(),
        collapseByDefault: (e) => {
          return !(isSCMRepository(e) || isSCMResourceGroup(e) || isSCMResourceNode(e));
        },
        accessibilityProvider: this.instantiationService.createInstance(SCMAccessibilityProvider),
        twistieAdditionalCssClass: (e) => {
          if (isSCMActionButton(e) || isSCMInput(e)) {
            return "force-no-twistie";
          }
          return void 0;
        }
      }
    );
    this.disposables.add(this.tree);
    this.tree.onDidOpen(this.open, this, this.disposables);
    this.tree.onContextMenu(this.onListContextMenu, this, this.disposables);
    this.tree.onDidScroll(this.inputRenderer.clearValidation, this.inputRenderer, this.disposables);
    Event.filter(this.tree.onDidChangeCollapseState, (e) => isSCMRepository(e.node.element?.element), this.disposables)(this.updateRepositoryCollapseAllContextKeys, this, this.disposables);
    this.disposables.add(autorun((reader) => {
      this.tree.updateOptions({
        compressionEnabled: compressionEnabled.read(reader)
      });
    }));
    append(container, overflowWidgetsDomNode);
  }
  async open(e) {
    if (!e.element) {
      return;
    } else if (isSCMRepository(e.element)) {
      this.scmViewService.focus(e.element);
      return;
    } else if (isSCMInput(e.element)) {
      this.scmViewService.focus(e.element.repository);
      const widget = this.inputRenderer.getRenderedInputWidget(e.element);
      if (widget) {
        widget.focus();
        this.tree.setFocus([], e.browserEvent);
        const selection = this.tree.getSelection();
        if (selection.length === 1 && selection[0] === e.element) {
          setTimeout(() => this.tree.setSelection([]));
        }
      }
      return;
    } else if (isSCMActionButton(e.element)) {
      this.scmViewService.focus(e.element.repository);
      this.actionButtonRenderer.focusActionButton(e.element);
      this.tree.setFocus([], e.browserEvent);
      return;
    } else if (isSCMResourceGroup(e.element)) {
      const provider = e.element.provider;
      const repository = Iterable.find(this.scmService.repositories, (r) => r.provider === provider);
      if (repository) {
        this.scmViewService.focus(repository);
      }
      return;
    } else if (isSCMResource(e.element)) {
      if (e.element.command?.id === API_OPEN_EDITOR_COMMAND_ID || e.element.command?.id === API_OPEN_DIFF_EDITOR_COMMAND_ID) {
        if (isPointerEvent(e.browserEvent) && e.browserEvent.button === 1) {
          const resourceGroup = e.element.resourceGroup;
          const title = `${resourceGroup.provider.label}: ${resourceGroup.label}`;
          await OpenScmGroupAction.openMultiFileDiffEditor(this.editorService, title, resourceGroup.provider.rootUri, resourceGroup.id, {
            ...e.editorOptions,
            viewState: {
              revealData: {
                resource: {
                  original: e.element.multiDiffEditorOriginalUri,
                  modified: e.element.multiDiffEditorModifiedUri
                }
              }
            },
            preserveFocus: true
          });
        } else {
          await this.commandService.executeCommand(e.element.command.id, ...e.element.command.arguments || [], e);
        }
      } else {
        await e.element.open(!!e.editorOptions.preserveFocus);
        if (e.editorOptions.pinned) {
          const activeEditorPane = this.editorService.activeEditorPane;
          activeEditorPane?.group.pinEditor(activeEditorPane.input);
        }
      }
      const provider = e.element.resourceGroup.provider;
      const repository = Iterable.find(this.scmService.repositories, (r) => r.provider === provider);
      if (repository) {
        this.scmViewService.focus(repository);
      }
    } else if (isSCMResourceNode(e.element)) {
      const provider = e.element.context.provider;
      const repository = Iterable.find(this.scmService.repositories, (r) => r.provider === provider);
      if (repository) {
        this.scmViewService.focus(repository);
      }
      return;
    }
  }
  onDidActiveEditorChange() {
    if (!this.configurationService.getValue("scm.autoReveal")) {
      return;
    }
    const uri = EditorResourceAccessor.getOriginalUri(this.editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
    if (!uri) {
      return;
    }
    if (this.tree.getFocus().some((e) => isSCMResource(e) && this.uriIdentityService.extUri.isEqual(e.sourceUri, uri)) && this.tree.getSelection().some((e) => isSCMResource(e) && this.uriIdentityService.extUri.isEqual(e.sourceUri, uri))) {
      return;
    }
    this.revealResourceThrottler.queue(
      () => this.treeOperationSequencer.queue(
        async () => {
          for (const repository of this.scmViewService.visibleRepositories) {
            const item = this.items.get(repository);
            if (!item) {
              continue;
            }
            for (let j = repository.provider.groups.length - 1; j >= 0; j--) {
              const groupItem = repository.provider.groups[j];
              const resource = this.viewMode === ViewMode.Tree ? groupItem.resourceTree.getNode(uri)?.element : groupItem.resources.find((r) => this.uriIdentityService.extUri.isEqual(r.sourceUri, uri));
              if (resource) {
                await this.tree.expandTo(resource);
                this.tree.reveal(resource);
                this.tree.setSelection([resource]);
                this.tree.setFocus([resource]);
                return;
              }
            }
          }
        }
      )
    );
  }
  onDidChangeVisibleRepositories({ added, removed }) {
    for (const repository of added) {
      const repositoryDisposables = new DisposableStore();
      repositoryDisposables.add(autorun((reader) => {
        repository.provider.actionButton.read(reader);
        this.updateChildren(repository);
      }));
      repositoryDisposables.add(repository.input.onDidChangeVisibility(() => this.updateChildren(repository)));
      repositoryDisposables.add(repository.provider.onDidChangeResourceGroups(() => this.updateChildren(repository)));
      const resourceGroupDisposables = repositoryDisposables.add(new DisposableMap());
      const onDidChangeResourceGroups = () => {
        for (const [resourceGroup] of resourceGroupDisposables) {
          if (!repository.provider.groups.includes(resourceGroup)) {
            resourceGroupDisposables.deleteAndDispose(resourceGroup);
          }
        }
        for (const resourceGroup of repository.provider.groups) {
          if (!resourceGroupDisposables.has(resourceGroup)) {
            const disposableStore = new DisposableStore();
            disposableStore.add(resourceGroup.onDidChange(() => this.updateChildren(repository)));
            disposableStore.add(resourceGroup.onDidChangeResources(() => this.updateChildren(repository)));
            resourceGroupDisposables.set(resourceGroup, disposableStore);
          }
        }
      };
      repositoryDisposables.add(repository.provider.onDidChangeResourceGroups(onDidChangeResourceGroups));
      onDidChangeResourceGroups();
      this.items.set(repository, repositoryDisposables);
    }
    for (const repository of removed) {
      this.items.deleteAndDispose(repository);
    }
    this.updateChildren();
    this.onDidActiveEditorChange();
  }
  onListContextMenu(e) {
    if (!e.element) {
      const menu = this.menuService.getMenuActions(Menus.ViewSort, this.contextKeyService);
      const actions2 = getFlatContextMenuActions(menu);
      return this.contextMenuService.showContextMenu({
        getAnchor: () => e.anchor,
        getActions: () => actions2,
        onHide: () => {
        }
      });
    }
    const element = e.element;
    let context = element;
    let actions = [];
    const disposables = new DisposableStore();
    let actionRunner = new RepositoryPaneActionRunner(() => this.getSelectedResources());
    disposables.add(actionRunner);
    if (isSCMRepository(element)) {
      const menus = this.scmViewService.menus.getRepositoryMenus(element.provider);
      const menu = menus.getRepositoryContextMenu(element);
      context = element.provider;
      actionRunner = new RepositoryActionRunner(() => this.getSelectedRepositories());
      disposables.add(actionRunner);
      actions = collectContextMenuActions(menu);
    } else if (isSCMInput(element) || isSCMActionButton(element)) {
    } else if (isSCMResourceGroup(element)) {
      const menus = this.scmViewService.menus.getRepositoryMenus(element.provider);
      const menu = menus.getResourceGroupMenu(element);
      actions = collectContextMenuActions(menu);
    } else if (isSCMResource(element)) {
      const menus = this.scmViewService.menus.getRepositoryMenus(element.resourceGroup.provider);
      const menu = menus.getResourceMenu(element);
      actions = collectContextMenuActions(menu);
    } else if (isSCMResourceNode(element)) {
      if (element.element) {
        const menus = this.scmViewService.menus.getRepositoryMenus(element.element.resourceGroup.provider);
        const menu = menus.getResourceMenu(element.element);
        actions = collectContextMenuActions(menu);
      } else {
        const menus = this.scmViewService.menus.getRepositoryMenus(element.context.provider);
        const menu = menus.getResourceFolderMenu(element.context);
        actions = collectContextMenuActions(menu);
      }
    }
    disposables.add(actionRunner.onWillRun(() => this.tree.domFocus()));
    this.contextMenuService.showContextMenu({
      actionRunner,
      getAnchor: () => e.anchor,
      getActions: () => actions,
      getActionsContext: () => context,
      onHide: () => disposables.dispose()
    });
  }
  getSelectedRepositories() {
    const focusedRepositories = this.tree.getFocus().filter((r) => !!r && isSCMRepository(r));
    const selectedRepositories = this.tree.getSelection().filter((r) => !!r && isSCMRepository(r));
    return Array.from(/* @__PURE__ */ new Set([...focusedRepositories, ...selectedRepositories]));
  }
  getSelectedResources() {
    return this.tree.getSelection().filter((r) => isSCMResourceGroup(r) || isSCMResource(r) || isSCMResourceNode(r));
  }
  getViewMode() {
    let mode = this.configurationService.getValue("scm.defaultViewMode") === "list" ? ViewMode.List : ViewMode.Tree;
    const storageMode = this.storageService.get(`scm.viewMode`, StorageScope.WORKSPACE);
    if (typeof storageMode === "string") {
      mode = storageMode;
    }
    return mode;
  }
  getViewSortKey() {
    if (this._viewMode === ViewMode.Tree) {
      return "path" /* Path */;
    }
    let viewSortKey;
    const viewSortKeyString = this.configurationService.getValue("scm.defaultViewSortKey");
    switch (viewSortKeyString) {
      case "name":
        viewSortKey = "name" /* Name */;
        break;
      case "status":
        viewSortKey = "status" /* Status */;
        break;
      default:
        viewSortKey = "path" /* Path */;
        break;
    }
    const storageSortKey = this.storageService.get(`scm.viewSortKey`, StorageScope.WORKSPACE);
    if (typeof storageSortKey === "string") {
      viewSortKey = storageSortKey;
    }
    return viewSortKey;
  }
  loadTreeViewState() {
    const storageViewState = this.storageService.get("scm.viewState2", StorageScope.WORKSPACE);
    if (!storageViewState) {
      return void 0;
    }
    try {
      const treeViewState = JSON.parse(storageViewState);
      return treeViewState;
    } catch {
      return void 0;
    }
  }
  storeTreeViewState() {
    if (this.tree) {
      this.storageService.store("scm.viewState2", JSON.stringify(this.tree.getViewState()), StorageScope.WORKSPACE, StorageTarget.MACHINE);
    }
  }
  updateChildren(element) {
    this.updateChildrenThrottler.queue(
      () => this.treeOperationSequencer.queue(
        async () => {
          const focusedInput = this.inputRenderer.getFocusedInput();
          if (element && this.tree.hasNode(element)) {
            await this.tree.updateChildren(element);
          } else {
            await this.tree.updateChildren(void 0);
          }
          if (focusedInput) {
            this.inputRenderer.getRenderedInputWidget(focusedInput)?.focus();
          }
          this.updateScmProviderContextKeys();
          this.updateRepositoryCollapseAllContextKeys();
        }
      )
    );
  }
  updateIndentStyles(theme) {
    this.treeContainer.classList.toggle("list-view-mode", this.viewMode === ViewMode.List);
    this.treeContainer.classList.toggle("tree-view-mode", this.viewMode === ViewMode.Tree);
    this.treeContainer.classList.toggle("align-icons-and-twisties", this.viewMode === ViewMode.List && theme.hasFileIcons || theme.hasFileIcons && !theme.hasFolderIcons);
    this.treeContainer.classList.toggle("hide-arrows", this.viewMode === ViewMode.Tree && theme.hidesExplorerArrows === true);
  }
  updateScmProviderContextKeys() {
    const alwaysShowRepositories = this.configurationService.getValue("scm.alwaysShowRepositories");
    if (!alwaysShowRepositories && this.items.size === 1) {
      const provider = Iterable.first(this.items.keys()).provider;
      this.scmProviderContextKey.set(provider.providerId);
      this.scmProviderRootUriContextKey.set(provider.rootUri?.toString());
      this.scmProviderHasRootUriContextKey.set(!!provider.rootUri);
    } else {
      this.scmProviderContextKey.set(void 0);
      this.scmProviderRootUriContextKey.set(void 0);
      this.scmProviderHasRootUriContextKey.set(false);
    }
  }
  updateRepositoryCollapseAllContextKeys() {
    if (!this.isBodyVisible() || this.items.size === 1) {
      this.isAnyRepositoryCollapsibleContextKey.set(false);
      this.areAllRepositoriesCollapsedContextKey.set(false);
      return;
    }
    this.isAnyRepositoryCollapsibleContextKey.set(this.scmViewService.visibleRepositories.some((r) => this.tree.hasNode(r) && this.tree.isCollapsible(r)));
    this.areAllRepositoriesCollapsedContextKey.set(this.scmViewService.visibleRepositories.every((r) => this.tree.hasNode(r) && (!this.tree.isCollapsible(r) || this.tree.isCollapsed(r))));
  }
  collapseAllRepositories() {
    for (const repository of this.scmViewService.visibleRepositories) {
      if (this.tree.isCollapsible(repository)) {
        this.tree.collapse(repository);
      }
    }
  }
  expandAllRepositories() {
    for (const repository of this.scmViewService.visibleRepositories) {
      if (this.tree.isCollapsible(repository)) {
        this.tree.expand(repository);
      }
    }
  }
  collapseAllResources(group) {
    for (const { element } of this.tree.getNode(group).children) {
      if (!isSCMViewService(element)) {
        this.tree.collapse(element, true);
      }
    }
  }
  focusPreviousInput() {
    this.treeOperationSequencer.queue(() => this.focusInput(-1));
  }
  focusNextInput() {
    this.treeOperationSequencer.queue(() => this.focusInput(1));
  }
  async focusInput(delta) {
    if (!this.scmViewService.focusedRepository || this.scmViewService.visibleRepositories.length === 0) {
      return;
    }
    let input = this.scmViewService.focusedRepository.input;
    const repositories = this.scmViewService.visibleRepositories;
    if (repositories.length === 1 && this.inputRenderer.getRenderedInputWidget(input)?.hasFocus() === true) {
      return;
    }
    if (repositories.length > 1 && this.inputRenderer.getRenderedInputWidget(input)?.hasFocus() === true) {
      const focusedRepositoryIndex = repositories.indexOf(this.scmViewService.focusedRepository);
      const newFocusedRepositoryIndex = rot(focusedRepositoryIndex + delta, repositories.length);
      input = repositories[newFocusedRepositoryIndex].input;
    }
    await this.tree.expandTo(input);
    this.tree.reveal(input);
    this.inputRenderer.getRenderedInputWidget(input)?.focus();
  }
  focusPreviousResourceGroup() {
    this.treeOperationSequencer.queue(() => this.focusResourceGroup(-1));
  }
  focusNextResourceGroup() {
    this.treeOperationSequencer.queue(() => this.focusResourceGroup(1));
  }
  async focusResourceGroup(delta) {
    if (!this.scmViewService.focusedRepository || this.scmViewService.visibleRepositories.length === 0) {
      return;
    }
    const treeHasDomFocus = isActiveElement(this.tree.getHTMLElement());
    const resourceGroups = this.scmViewService.focusedRepository.provider.groups;
    const focusedResourceGroup = this.tree.getFocus().find((e) => isSCMResourceGroup(e));
    const focusedResourceGroupIndex = treeHasDomFocus && focusedResourceGroup ? resourceGroups.indexOf(focusedResourceGroup) : -1;
    let resourceGroupNext;
    if (focusedResourceGroupIndex === -1) {
      for (const resourceGroup of resourceGroups) {
        if (this.tree.hasNode(resourceGroup)) {
          resourceGroupNext = resourceGroup;
          break;
        }
      }
    } else {
      let index = rot(focusedResourceGroupIndex + delta, resourceGroups.length);
      while (index !== focusedResourceGroupIndex) {
        if (this.tree.hasNode(resourceGroups[index])) {
          resourceGroupNext = resourceGroups[index];
          break;
        }
        index = rot(index + delta, resourceGroups.length);
      }
    }
    if (resourceGroupNext) {
      await this.tree.expandTo(resourceGroupNext);
      this.tree.reveal(resourceGroupNext);
      this.tree.setSelection([resourceGroupNext]);
      this.tree.setFocus([resourceGroupNext]);
      this.tree.domFocus();
    }
  }
  shouldShowWelcome() {
    return this.scmService.repositoryCount === 0;
  }
  getActionsContext() {
    return this.scmViewService.visibleRepositories.length === 1 ? this.scmViewService.visibleRepositories[0].provider : void 0;
  }
  focus() {
    super.focus();
    this.treeOperationSequencer.queue(() => {
      return new Promise((resolve) => {
        if (this.isExpanded()) {
          if (this.tree.getFocus().length === 0) {
            for (const repository of this.scmViewService.visibleRepositories) {
              const widget = this.inputRenderer.getRenderedInputWidget(repository.input);
              if (widget) {
                widget.focus();
                resolve();
                return;
              }
            }
          }
          this.tree.domFocus();
          resolve();
        }
      });
    });
  }
  dispose() {
    this._onDidChangeViewMode.dispose();
    this._onDidChangeViewSortKey.dispose();
    this.visibilityDisposables.dispose();
    this.disposables.dispose();
    this.items.dispose();
    super.dispose();
  }
};
SCMViewPane = __decorateClass([
  __decorateParam(1, ICommandService),
  __decorateParam(2, IEditorService),
  __decorateParam(3, IMenuService),
  __decorateParam(4, ISCMService),
  __decorateParam(5, ISCMViewService),
  __decorateParam(6, IStorageService),
  __decorateParam(7, IUriIdentityService),
  __decorateParam(8, IKeybindingService),
  __decorateParam(9, IThemeService),
  __decorateParam(10, IContextMenuService),
  __decorateParam(11, IInstantiationService),
  __decorateParam(12, IViewDescriptorService),
  __decorateParam(13, IConfigurationService),
  __decorateParam(14, IContextKeyService),
  __decorateParam(15, IOpenerService),
  __decorateParam(16, IHoverService)
], SCMViewPane);
let SCMTreeDataSource = class extends Disposable {
  constructor(viewMode, configurationService, scmViewService) {
    super();
    this.viewMode = viewMode;
    this.configurationService = configurationService;
    this.scmViewService = scmViewService;
  }
  async getChildren(inputOrElement) {
    const repositoryCount = this.scmViewService.visibleRepositories.length;
    const showActionButton = this.configurationService.getValue("scm.showActionButton") === true;
    const alwaysShowRepositories = this.configurationService.getValue("scm.alwaysShowRepositories") === true;
    if (isSCMViewService(inputOrElement) && (repositoryCount > 1 || alwaysShowRepositories)) {
      return this.scmViewService.visibleRepositories;
    } else if (isSCMViewService(inputOrElement) && repositoryCount === 1 && !alwaysShowRepositories || isSCMRepository(inputOrElement)) {
      const children = [];
      inputOrElement = isSCMRepository(inputOrElement) ? inputOrElement : this.scmViewService.visibleRepositories[0];
      const actionButton = inputOrElement.provider.actionButton.get();
      const resourceGroups = inputOrElement.provider.groups;
      if (inputOrElement.input.visible) {
        children.push(inputOrElement.input);
      }
      if (showActionButton && actionButton) {
        children.push({
          type: "actionButton",
          repository: inputOrElement,
          button: actionButton
        });
      }
      const hasSomeChanges = resourceGroups.some((group) => group.resources.length > 0);
      if (hasSomeChanges || repositoryCount === 1 && (!showActionButton || !actionButton)) {
        children.push(...resourceGroups);
      }
      return children;
    } else if (isSCMResourceGroup(inputOrElement)) {
      if (this.viewMode() === ViewMode.List) {
        return inputOrElement.resources;
      } else if (this.viewMode() === ViewMode.Tree) {
        const children = [];
        for (const node of inputOrElement.resourceTree.root.children) {
          children.push(node.element && node.childrenCount === 0 ? node.element : node);
        }
        return children;
      }
    } else if (isSCMResourceNode(inputOrElement)) {
      const children = [];
      for (const node of inputOrElement.children) {
        children.push(node.element && node.childrenCount === 0 ? node.element : node);
      }
      return children;
    }
    return [];
  }
  getParent(element) {
    if (isSCMResourceNode(element)) {
      if (element.parent === element.context.resourceTree.root) {
        return element.context;
      } else if (element.parent) {
        return element.parent;
      } else {
        throw new Error("Invalid element passed to getParent");
      }
    } else if (isSCMResource(element)) {
      if (this.viewMode() === ViewMode.List) {
        return element.resourceGroup;
      }
      const node = element.resourceGroup.resourceTree.getNode(element.sourceUri);
      const result = node?.parent;
      if (!result) {
        throw new Error("Invalid element passed to getParent");
      }
      if (result === element.resourceGroup.resourceTree.root) {
        return element.resourceGroup;
      }
      return result;
    } else if (isSCMInput(element)) {
      return element.repository;
    } else if (isSCMActionButton(element)) {
      return element.repository;
    } else if (isSCMResourceGroup(element)) {
      const repository = this.scmViewService.visibleRepositories.find((r) => r.provider === element.provider);
      if (!repository) {
        throw new Error("Invalid element passed to getParent");
      }
      return repository;
    } else if (isSCMRepository(element)) {
      return this.scmViewService;
    } else {
      throw new Error("Unexpected call to getParent");
    }
  }
  hasChildren(inputOrElement) {
    if (isSCMViewService(inputOrElement)) {
      return this.scmViewService.visibleRepositories.length !== 0;
    } else if (isSCMRepository(inputOrElement)) {
      return true;
    } else if (isSCMInput(inputOrElement)) {
      return false;
    } else if (isSCMActionButton(inputOrElement)) {
      return false;
    } else if (isSCMResourceGroup(inputOrElement)) {
      return true;
    } else if (isSCMResource(inputOrElement)) {
      return false;
    } else if (ResourceTree.isResourceNode(inputOrElement)) {
      return inputOrElement.childrenCount > 0;
    } else {
      throw new Error("hasChildren not implemented.");
    }
  }
};
SCMTreeDataSource = __decorateClass([
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, ISCMViewService)
], SCMTreeDataSource);
class SCMActionButton {
  constructor(container, contextMenuService, commandService, notificationService) {
    this.container = container;
    this.contextMenuService = contextMenuService;
    this.commandService = commandService;
    this.notificationService = notificationService;
    this.disposables = new MutableDisposable();
  }
  dispose() {
    this.disposables?.dispose();
  }
  setButton(button) {
    this.clear();
    if (!button) {
      return;
    }
    if (button.secondaryCommands?.length) {
      const actions = [];
      for (let index = 0; index < button.secondaryCommands.length; index++) {
        const commands = button.secondaryCommands[index];
        for (const command of commands) {
          actions.push(toAction({
            id: command.id,
            label: command.title,
            enabled: true,
            run: async () => {
              await this.executeCommand(command.id, ...command.arguments || []);
            }
          }));
        }
        if (commands.length) {
          actions.push(new Separator());
        }
      }
      actions.pop();
      this.button = new ButtonWithDropdown(this.container, {
        actions,
        addPrimaryActionToDropdown: false,
        contextMenuProvider: this.contextMenuService,
        title: button.command.tooltip,
        supportIcons: true,
        ...defaultButtonStyles
      });
    } else {
      this.button = new Button(this.container, { supportIcons: true, supportShortLabel: !!button.command.shortTitle, title: button.command.tooltip, ...defaultButtonStyles });
    }
    this.button.enabled = button.enabled;
    this.button.label = button.command.title;
    if (this.button instanceof Button && button.command.shortTitle) {
      this.button.labelShort = button.command.shortTitle;
    }
    this.button.onDidClick(async () => await this.executeCommand(button.command.id, ...button.command.arguments || []), null, this.disposables.value);
    this.disposables.value.add(this.button);
  }
  focus() {
    this.button?.focus();
  }
  clear() {
    this.disposables.value = new DisposableStore();
    this.button = void 0;
    clearNode(this.container);
  }
  async executeCommand(commandId, ...args) {
    try {
      await this.commandService.executeCommand(commandId, ...args);
    } catch (ex) {
      this.notificationService.error(ex);
    }
  }
}
export {
  ActionButtonRenderer,
  ContextKeys,
  SCMAccessibilityProvider,
  SCMActionButton,
  SCMTreeKeyboardNavigationLabelProvider,
  SCMTreeSorter,
  SCMViewPane
};
