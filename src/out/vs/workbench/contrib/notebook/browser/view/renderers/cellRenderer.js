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
import { PixelRatio } from "../../../../../../base/browser/pixelRatio.js";
import * as DOM from "../../../../../../base/browser/dom.js";
import { FastDomNode } from "../../../../../../base/browser/fastDomNode.js";
import { Disposable, DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { CodeEditorWidget } from "../../../../../../editor/browser/widget/codeEditor/codeEditorWidget.js";
import { createBareFontInfoFromRawSettings } from "../../../../../../editor/common/config/fontInfoFromSettings.js";
import { EditorContextKeys } from "../../../../../../editor/common/editorContextKeys.js";
import { PLAINTEXT_LANGUAGE_ID } from "../../../../../../editor/common/languages/modesRegistry.js";
import { localize } from "../../../../../../nls.js";
import { IMenuService } from "../../../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../../../platform/instantiation/common/serviceCollection.js";
import { IKeybindingService } from "../../../../../../platform/keybinding/common/keybinding.js";
import { INotificationService } from "../../../../../../platform/notification/common/notification.js";
import { CellPartsCollection } from "../cellPart.js";
import { CellChatPart } from "../cellParts/chat/cellChatPart.js";
import { CellComments } from "../cellParts/cellComments.js";
import { CellContextKeyPart } from "../cellParts/cellContextKeys.js";
import { CellDecorations } from "../cellParts/cellDecorations.js";
import { CellDragAndDropPart } from "../cellParts/cellDnd.js";
import { CodeCellDragImageRenderer } from "../cellParts/cellDragRenderer.js";
import { CellEditorOptions } from "../cellParts/cellEditorOptions.js";
import { CellExecutionPart } from "../cellParts/cellExecution.js";
import { CellFocusPart } from "../cellParts/cellFocus.js";
import { CellFocusIndicator } from "../cellParts/cellFocusIndicator.js";
import { CellProgressBar } from "../cellParts/cellProgressBar.js";
import { CellEditorStatusBar } from "../cellParts/cellStatusPart.js";
import { BetweenCellToolbar, CellTitleToolbarPart } from "../cellParts/cellToolbars.js";
import { CodeCell } from "../cellParts/codeCell.js";
import { RunToolbar } from "../cellParts/codeCellRunToolbar.js";
import { CollapsedCellInput } from "../cellParts/collapsedCellInput.js";
import { CollapsedCellOutput } from "../cellParts/collapsedCellOutput.js";
import { FoldedCellHint } from "../cellParts/foldedCellHint.js";
import { MarkupCell } from "../cellParts/markupCell.js";
import { CellKind } from "../../../common/notebookCommon.js";
import { INotebookExecutionStateService } from "../../../common/notebookExecutionStateService.js";
const $ = DOM.$;
let NotebookCellListDelegate = class extends Disposable {
  constructor(targetWindow, configurationService) {
    super();
    this.configurationService = configurationService;
    const editorOptions = this.configurationService.getValue("editor");
    this.lineHeight = createBareFontInfoFromRawSettings(editorOptions, PixelRatio.getInstance(targetWindow).value).lineHeight;
  }
  getHeight(element) {
    return element.getHeight(this.lineHeight);
  }
  getDynamicHeight(element) {
    return element.getDynamicHeight();
  }
  getTemplateId(element) {
    if (element.cellKind === CellKind.Markup) {
      return MarkupCellRenderer.TEMPLATE_ID;
    } else {
      return CodeCellRenderer.TEMPLATE_ID;
    }
  }
};
NotebookCellListDelegate = __decorateClass([
  __decorateParam(1, IConfigurationService)
], NotebookCellListDelegate);
class AbstractCellRenderer extends Disposable {
  constructor(instantiationService, notebookEditor, contextMenuService, menuService, configurationService, keybindingService, notificationService, contextKeyServiceProvider, language, dndController) {
    super();
    this.instantiationService = instantiationService;
    this.notebookEditor = notebookEditor;
    this.contextMenuService = contextMenuService;
    this.menuService = menuService;
    this.keybindingService = keybindingService;
    this.notificationService = notificationService;
    this.contextKeyServiceProvider = contextKeyServiceProvider;
    this.dndController = dndController;
    this.editorOptions = this._register(new CellEditorOptions(this.notebookEditor.getBaseCellEditorOptions(language), this.notebookEditor.notebookOptions, configurationService));
  }
  dispose() {
    super.dispose();
    this.dndController = void 0;
  }
}
let MarkupCellRenderer = class extends AbstractCellRenderer {
  constructor(notebookEditor, dndController, renderedEditors, contextKeyServiceProvider, configurationService, instantiationService, contextMenuService, menuService, keybindingService, notificationService, notebookExecutionStateService) {
    super(instantiationService, notebookEditor, contextMenuService, menuService, configurationService, keybindingService, notificationService, contextKeyServiceProvider, "markdown", dndController);
    this.renderedEditors = renderedEditors;
    this._notebookExecutionStateService = notebookExecutionStateService;
  }
  static {
    this.TEMPLATE_ID = "markdown_cell";
  }
  get templateId() {
    return MarkupCellRenderer.TEMPLATE_ID;
  }
  renderTemplate(rootContainer) {
    rootContainer.classList.add("markdown-cell-row");
    const container = DOM.append(rootContainer, DOM.$(".cell-inner-container"));
    const templateDisposables = new DisposableStore();
    const contextKeyService = templateDisposables.add(this.contextKeyServiceProvider(container));
    const decorationContainer = DOM.append(rootContainer, $(".cell-decoration"));
    const titleToolbarContainer = DOM.append(container, $(".cell-title-toolbar"));
    const focusIndicatorTop = new FastDomNode(DOM.append(container, $(".cell-focus-indicator.cell-focus-indicator-top")));
    const focusIndicatorLeft = new FastDomNode(DOM.append(container, DOM.$(".cell-focus-indicator.cell-focus-indicator-side.cell-focus-indicator-left")));
    const foldingIndicator = DOM.append(focusIndicatorLeft.domNode, DOM.$(".notebook-folding-indicator"));
    const focusIndicatorRight = new FastDomNode(DOM.append(container, DOM.$(".cell-focus-indicator.cell-focus-indicator-side.cell-focus-indicator-right")));
    const codeInnerContent = DOM.append(container, $(".cell.code"));
    const editorPart = DOM.append(codeInnerContent, $(".cell-editor-part"));
    const cellChatPart = DOM.append(editorPart, $(".cell-chat-part"));
    const cellInputCollapsedContainer = DOM.append(codeInnerContent, $(".input-collapse-container"));
    cellInputCollapsedContainer.style.display = "none";
    const editorContainer = DOM.append(editorPart, $(".cell-editor-container"));
    editorPart.style.display = "none";
    const cellCommentPartContainer = DOM.append(container, $(".cell-comment-container"));
    const innerContent = DOM.append(container, $(".cell.markdown"));
    const bottomCellContainer = DOM.append(container, $(".cell-bottom-toolbar-container"));
    const scopedInstaService = templateDisposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, contextKeyService])));
    const rootClassDelegate = {
      toggle: (className, force) => container.classList.toggle(className, force)
    };
    const titleToolbar = templateDisposables.add(scopedInstaService.createInstance(
      CellTitleToolbarPart,
      titleToolbarContainer,
      rootClassDelegate,
      this.notebookEditor.creationOptions.menuIds.cellTitleToolbar,
      this.notebookEditor.creationOptions.menuIds.cellDeleteToolbar,
      this.notebookEditor
    ));
    const focusIndicatorBottom = new FastDomNode(DOM.append(container, $(".cell-focus-indicator.cell-focus-indicator-bottom")));
    const cellParts = new CellPartsCollection(DOM.getWindow(rootContainer), [
      templateDisposables.add(scopedInstaService.createInstance(CellChatPart, this.notebookEditor, cellChatPart)),
      templateDisposables.add(scopedInstaService.createInstance(CellEditorStatusBar, this.notebookEditor, container, editorPart, void 0)),
      templateDisposables.add(new CellFocusIndicator(this.notebookEditor, titleToolbar, focusIndicatorTop, focusIndicatorLeft, focusIndicatorRight, focusIndicatorBottom)),
      templateDisposables.add(new FoldedCellHint(this.notebookEditor, DOM.append(container, $(".notebook-folded-hint")), this._notebookExecutionStateService)),
      templateDisposables.add(new CellDecorations(this.notebookEditor, rootContainer, decorationContainer)),
      templateDisposables.add(scopedInstaService.createInstance(CellComments, this.notebookEditor, cellCommentPartContainer)),
      templateDisposables.add(new CollapsedCellInput(this.notebookEditor, cellInputCollapsedContainer)),
      templateDisposables.add(new CellFocusPart(container, void 0, this.notebookEditor)),
      templateDisposables.add(new CellDragAndDropPart(container)),
      templateDisposables.add(scopedInstaService.createInstance(CellContextKeyPart, this.notebookEditor))
    ], [
      titleToolbar,
      templateDisposables.add(scopedInstaService.createInstance(BetweenCellToolbar, this.notebookEditor, titleToolbarContainer, bottomCellContainer))
    ]);
    templateDisposables.add(cellParts);
    const templateData = {
      rootContainer,
      cellInputCollapsedContainer,
      instantiationService: scopedInstaService,
      container,
      cellContainer: innerContent,
      editorPart,
      editorContainer,
      foldingIndicator,
      templateDisposables,
      elementDisposables: templateDisposables.add(new DisposableStore()),
      cellParts,
      toJSON: () => {
        return {};
      }
    };
    return templateData;
  }
  renderElement(element, index, templateData, details) {
    if (!this.notebookEditor.hasModel()) {
      throw new Error("The notebook editor is not attached with view model yet.");
    }
    templateData.currentRenderedCell = element;
    templateData.currentEditor = void 0;
    templateData.editorPart.style.display = "none";
    templateData.cellContainer.innerText = "";
    if (details?.height === void 0) {
      return;
    }
    templateData.elementDisposables.add(templateData.instantiationService.createInstance(MarkupCell, this.notebookEditor, element, templateData, this.renderedEditors));
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
  disposeElement(_element, _index, templateData) {
    templateData.elementDisposables.clear();
  }
};
MarkupCellRenderer = __decorateClass([
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IContextMenuService),
  __decorateParam(7, IMenuService),
  __decorateParam(8, IKeybindingService),
  __decorateParam(9, INotificationService),
  __decorateParam(10, INotebookExecutionStateService)
], MarkupCellRenderer);
let CodeCellRenderer = class extends AbstractCellRenderer {
  constructor(notebookEditor, renderedEditors, editorPool, dndController, contextKeyServiceProvider, configurationService, contextMenuService, menuService, instantiationService, keybindingService, notificationService) {
    super(instantiationService, notebookEditor, contextMenuService, menuService, configurationService, keybindingService, notificationService, contextKeyServiceProvider, PLAINTEXT_LANGUAGE_ID, dndController);
    this.renderedEditors = renderedEditors;
    this.editorPool = editorPool;
  }
  static {
    this.TEMPLATE_ID = "code_cell";
  }
  get templateId() {
    return CodeCellRenderer.TEMPLATE_ID;
  }
  renderTemplate(rootContainer) {
    rootContainer.classList.add("code-cell-row");
    const container = DOM.append(rootContainer, DOM.$(".cell-inner-container"));
    const templateDisposables = new DisposableStore();
    const contextKeyService = templateDisposables.add(this.contextKeyServiceProvider(container));
    const decorationContainer = DOM.append(rootContainer, $(".cell-decoration"));
    const focusIndicatorTop = new FastDomNode(DOM.append(container, $(".cell-focus-indicator.cell-focus-indicator-top")));
    const titleToolbarContainer = DOM.append(container, $(".cell-title-toolbar"));
    const focusIndicatorLeft = new FastDomNode(DOM.append(container, DOM.$(".cell-focus-indicator.cell-focus-indicator-side.cell-focus-indicator-left")));
    const cellChatPart = DOM.append(container, $(".cell-chat-part"));
    const cellContainer = DOM.append(container, $(".cell.code"));
    const runButtonContainer = DOM.append(cellContainer, $(".run-button-container"));
    const cellInputCollapsedContainer = DOM.append(cellContainer, $(".input-collapse-container"));
    cellInputCollapsedContainer.style.display = "none";
    const executionOrderLabel = DOM.append(focusIndicatorLeft.domNode, $("div.execution-count-label"));
    executionOrderLabel.title = localize("cellExecutionOrderCountLabel", "Execution Order");
    const editorPart = DOM.append(cellContainer, $(".cell-editor-part"));
    const editorContainer = DOM.append(editorPart, $(".cell-editor-container"));
    const cellCommentPartContainer = DOM.append(container, $(".cell-comment-container"));
    const editorContextKeyService = templateDisposables.add(this.contextKeyServiceProvider(editorPart));
    const editorInstaService = templateDisposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, editorContextKeyService])));
    EditorContextKeys.inCompositeEditor.bindTo(editorContextKeyService).set(true);
    const editor = editorInstaService.createInstance(CodeEditorWidget, editorContainer, {
      ...this.editorOptions.getDefaultValue(),
      allowVariableLineHeights: false,
      dimension: {
        width: 0,
        height: 0
      },
      scrollbar: {
        vertical: "hidden",
        horizontal: "auto",
        handleMouseWheel: false,
        useShadows: false
      }
    }, {
      contributions: this.notebookEditor.creationOptions.cellEditorContributions
    });
    templateDisposables.add(editor);
    const outputContainer = new FastDomNode(DOM.append(container, $(".output")));
    const cellOutputCollapsedContainer = DOM.append(outputContainer.domNode, $(".output-collapse-container"));
    const outputShowMoreContainer = new FastDomNode(DOM.append(container, $(".output-show-more-container")));
    const focusIndicatorRight = new FastDomNode(DOM.append(container, DOM.$(".cell-focus-indicator.cell-focus-indicator-side.cell-focus-indicator-right")));
    const focusSinkElement = DOM.append(container, $(".cell-editor-focus-sink"));
    focusSinkElement.setAttribute("tabindex", "0");
    const bottomCellToolbarContainer = DOM.append(container, $(".cell-bottom-toolbar-container"));
    const focusIndicatorBottom = new FastDomNode(DOM.append(container, $(".cell-focus-indicator.cell-focus-indicator-bottom")));
    const scopedInstaService = templateDisposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, contextKeyService])));
    const rootClassDelegate = {
      toggle: (className, force) => container.classList.toggle(className, force)
    };
    const titleToolbar = templateDisposables.add(scopedInstaService.createInstance(
      CellTitleToolbarPart,
      titleToolbarContainer,
      rootClassDelegate,
      this.notebookEditor.creationOptions.menuIds.cellTitleToolbar,
      this.notebookEditor.creationOptions.menuIds.cellDeleteToolbar,
      this.notebookEditor
    ));
    const focusIndicatorPart = templateDisposables.add(new CellFocusIndicator(this.notebookEditor, titleToolbar, focusIndicatorTop, focusIndicatorLeft, focusIndicatorRight, focusIndicatorBottom));
    const contentParts = [
      focusIndicatorPart,
      templateDisposables.add(scopedInstaService.createInstance(CellChatPart, this.notebookEditor, cellChatPart)),
      templateDisposables.add(scopedInstaService.createInstance(CellEditorStatusBar, this.notebookEditor, container, editorPart, editor)),
      templateDisposables.add(scopedInstaService.createInstance(CellProgressBar, editorPart, cellInputCollapsedContainer)),
      templateDisposables.add(new CellDecorations(this.notebookEditor, rootContainer, decorationContainer)),
      templateDisposables.add(scopedInstaService.createInstance(CellComments, this.notebookEditor, cellCommentPartContainer)),
      templateDisposables.add(scopedInstaService.createInstance(CellExecutionPart, this.notebookEditor, executionOrderLabel)),
      templateDisposables.add(scopedInstaService.createInstance(CollapsedCellOutput, this.notebookEditor, cellOutputCollapsedContainer)),
      templateDisposables.add(new CollapsedCellInput(this.notebookEditor, cellInputCollapsedContainer)),
      templateDisposables.add(new CellFocusPart(container, focusSinkElement, this.notebookEditor)),
      templateDisposables.add(new CellDragAndDropPart(container)),
      templateDisposables.add(scopedInstaService.createInstance(CellContextKeyPart, this.notebookEditor))
    ];
    const { cellExecutePrimary, cellExecuteToolbar } = this.notebookEditor.creationOptions.menuIds;
    if (cellExecutePrimary && cellExecuteToolbar) {
      contentParts.push(templateDisposables.add(
        scopedInstaService.createInstance(RunToolbar, this.notebookEditor, contextKeyService, container, runButtonContainer, cellExecutePrimary, cellExecuteToolbar)
      ));
    }
    const cellParts = new CellPartsCollection(DOM.getWindow(rootContainer), contentParts, [
      titleToolbar,
      templateDisposables.add(scopedInstaService.createInstance(BetweenCellToolbar, this.notebookEditor, titleToolbarContainer, bottomCellToolbarContainer))
    ]);
    templateDisposables.add(cellParts);
    const templateData = {
      rootContainer,
      editorPart,
      cellInputCollapsedContainer,
      cellOutputCollapsedContainer,
      instantiationService: scopedInstaService,
      container,
      cellContainer,
      focusSinkElement,
      outputContainer,
      outputShowMoreContainer,
      editor,
      templateDisposables,
      elementDisposables: templateDisposables.add(new DisposableStore()),
      cellParts,
      toJSON: () => {
        return {};
      }
    };
    const dragHandles = [focusIndicatorLeft.domNode, focusIndicatorPart.codeFocusIndicator.domNode, focusIndicatorPart.outputFocusIndicator.domNode];
    this.dndController?.registerDragHandle(templateData, rootContainer, dragHandles, () => new CodeCellDragImageRenderer().getDragImage(templateData, templateData.editor, "code"));
    return templateData;
  }
  renderElement(element, index, templateData, details) {
    if (!this.notebookEditor.hasModel()) {
      throw new Error("The notebook editor is not attached with view model yet.");
    }
    templateData.currentRenderedCell = element;
    if (details?.height === void 0) {
      return;
    }
    templateData.outputContainer.domNode.innerText = "";
    templateData.outputContainer.domNode.appendChild(templateData.cellOutputCollapsedContainer);
    templateData.elementDisposables.add(templateData.instantiationService.createInstance(CodeCell, this.notebookEditor, element, templateData, this.editorPool));
    this.renderedEditors.set(element, templateData.editor);
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
  disposeElement(element, index, templateData) {
    templateData.elementDisposables.clear();
    this.renderedEditors.delete(element);
  }
};
CodeCellRenderer = __decorateClass([
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IContextMenuService),
  __decorateParam(7, IMenuService),
  __decorateParam(8, IInstantiationService),
  __decorateParam(9, IKeybindingService),
  __decorateParam(10, INotificationService)
], CodeCellRenderer);
export {
  CodeCellRenderer,
  MarkupCellRenderer,
  NotebookCellListDelegate
};
