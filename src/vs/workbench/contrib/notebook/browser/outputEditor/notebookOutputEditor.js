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
import * as DOM from "../../../../../base/browser/dom.js";
import * as nls from "../../../../../nls.js";
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../base/common/network.js";
import { URI } from "../../../../../base/common/uri.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IStorageService } from "../../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { IUriIdentityService } from "../../../../../platform/uriIdentity/common/uriIdentity.js";
import { EditorPane } from "../../../../browser/parts/editor/editorPane.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../common/contributions.js";
import { IEditorResolverService, RegisteredEditorPriority } from "../../../../services/editor/common/editorResolverService.js";
import { CellUri, NOTEBOOK_OUTPUT_EDITOR_ID } from "../../common/notebookCommon.js";
import { INotebookService } from "../../common/notebookService.js";
import { RenderOutputType } from "../notebookBrowser.js";
import { getDefaultNotebookCreationOptions } from "../notebookEditorWidget.js";
import { NotebookOptions } from "../notebookOptions.js";
import { BackLayerWebView } from "../view/renderers/backLayerWebView.js";
import { NotebookOutputEditorInput } from "./notebookOutputEditorInput.js";
import { createBareFontInfoFromRawSettings } from "../../../../../editor/common/config/fontInfoFromSettings.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { FontMeasurements } from "../../../../../editor/browser/config/fontMeasurements.js";
import { PixelRatio } from "../../../../../base/browser/pixelRatio.js";
import { NotebookViewModel } from "../viewModel/notebookViewModelImpl.js";
import { NotebookEventDispatcher } from "../viewModel/eventDispatcher.js";
import { ViewContext } from "../viewModel/viewContext.js";
class NoopCellEditorOptions extends Disposable {
  constructor() {
    super();
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._value = Object.freeze({
      ...NoopCellEditorOptions.fixedEditorOptions,
      padding: { top: 12, bottom: 12 },
      readOnly: true
    });
  }
  static {
    this.fixedEditorOptions = {
      scrollBeyondLastLine: false,
      scrollbar: {
        verticalScrollbarSize: 14,
        horizontal: "auto",
        useShadows: true,
        verticalHasArrows: false,
        horizontalHasArrows: false,
        alwaysConsumeMouseWheel: false
      },
      renderLineHighlightOnlyWhenFocus: true,
      overviewRulerLanes: 0,
      lineDecorationsWidth: 0,
      folding: true,
      fixedOverflowWidgets: true,
      minimap: { enabled: false },
      renderValidationDecorations: "on",
      lineNumbersMinChars: 3
    };
  }
  get value() {
    return this._value;
  }
}
let NotebookOutputEditor = class extends EditorPane {
  constructor(group, instantiationService, themeService, telemetryService, storageService, configurationService, notebookService) {
    super(NotebookOutputEditor.ID, group, telemetryService, themeService, storageService);
    this.instantiationService = instantiationService;
    this.configurationService = configurationService;
    this.notebookService = notebookService;
    this.creationOptions = getDefaultNotebookCreationOptions();
    this._outputWebview = null;
    this._isDisposed = false;
    this._notebookOptions = this.instantiationService.createInstance(NotebookOptions, this.window, false, void 0);
    this._register(this._notebookOptions);
  }
  static {
    this.ID = NOTEBOOK_OUTPUT_EDITOR_ID;
  }
  get isDisposed() {
    return this._isDisposed;
  }
  createEditor(parent) {
    this._rootElement = DOM.append(parent, DOM.$(".notebook-output-editor"));
  }
  get fontInfo() {
    if (!this._fontInfo) {
      this._fontInfo = this.createFontInfo();
    }
    return this._fontInfo;
  }
  createFontInfo() {
    const editorOptions = this.configurationService.getValue("editor");
    return FontMeasurements.readFontInfo(this.window, createBareFontInfoFromRawSettings(editorOptions, PixelRatio.getInstance(this.window).value));
  }
  async _createOriginalWebview(id, viewType, resource) {
    this._outputWebview?.dispose();
    this._outputWebview = this.instantiationService.createInstance(BackLayerWebView, this, id, viewType, resource, {
      ...this._notebookOptions.computeDiffWebviewOptions(),
      fontFamily: this._generateFontFamily()
    }, void 0);
    DOM.append(this._rootElement, this._outputWebview.element);
    this._outputWebview.createWebview(this.window);
    this._outputWebview.element.style.width = `calc(100% - 16px)`;
    this._outputWebview.element.style.left = `16px`;
  }
  _generateFontFamily() {
    return this.fontInfo.fontFamily ?? `"SF Mono", Monaco, Menlo, Consolas, "Ubuntu Mono", "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace`;
  }
  getTitle() {
    if (this.input) {
      return this.input.getName();
    }
    return nls.localize("notebookOutputEditor", "Notebook Output Editor");
  }
  async setInput(input, options, context, token) {
    await super.setInput(input, options, context, token);
    const model = await input.resolve();
    if (!model) {
      throw new Error("Invalid notebook output editor input");
    }
    const resolvedNotebookEditorModel = model.resolvedNotebookEditorModel;
    await this._createOriginalWebview(generateUuid(), resolvedNotebookEditorModel.viewType, URI.from({ scheme: Schemas.vscodeNotebookCellOutput, path: "", query: "openIn=notebookOutputEditor" }));
    const notebookTextModel = resolvedNotebookEditorModel.notebook;
    const eventDispatcher = this._register(new NotebookEventDispatcher());
    const editorOptions = this._register(new NoopCellEditorOptions());
    const viewContext = new ViewContext(
      this._notebookOptions,
      eventDispatcher,
      (_language) => editorOptions
    );
    this._notebookViewModel = this.instantiationService.createInstance(NotebookViewModel, notebookTextModel.viewType, notebookTextModel, viewContext, null, { isReadOnly: true });
    const cellViewModel = this._notebookViewModel.getCellByHandle(model.cell.handle);
    if (!cellViewModel) {
      throw new Error("Invalid NotebookOutputEditorInput, no matching cell view model");
    }
    const cellOutputViewModel = cellViewModel.outputsViewModels.find((outputViewModel) => outputViewModel.model.outputId === model.outputId);
    if (!cellOutputViewModel) {
      throw new Error("Invalid NotebookOutputEditorInput, no matching cell output view model");
    }
    let result = void 0;
    const [mimeTypes, pick] = cellOutputViewModel.resolveMimeTypes(notebookTextModel, void 0);
    const pickedMimeTypeRenderer = cellOutputViewModel.pickedMimeType || mimeTypes[pick];
    if (mimeTypes.length !== 0) {
      const renderer = this.notebookService.getRendererInfo(pickedMimeTypeRenderer.rendererId);
      result = renderer ? { type: RenderOutputType.Extension, renderer, source: cellOutputViewModel, mimeType: pickedMimeTypeRenderer.mimeType } : this._renderMissingRenderer(cellOutputViewModel, pickedMimeTypeRenderer.mimeType);
    }
    if (!result) {
      throw new Error("No InsetRenderInfo for output");
    }
    const cellInfo = {
      cellId: cellViewModel.id,
      cellHandle: model.cell.handle,
      cellUri: model.cell.uri
    };
    this._outputWebview?.createOutput(cellInfo, result, 0, 0);
  }
  _renderMissingRenderer(viewModel, preferredMimeType) {
    if (!viewModel.model.outputs.length) {
      return this._renderMessage(viewModel, nls.localize("empty", "Cell has no output"));
    }
    if (!preferredMimeType) {
      const mimeTypes = viewModel.model.outputs.map((op) => op.mime);
      const mimeTypesMessage = mimeTypes.join(", ");
      return this._renderMessage(viewModel, nls.localize("noRenderer.2", "No renderer could be found for output. It has the following mimetypes: {0}", mimeTypesMessage));
    }
    return this._renderSearchForMimetype(viewModel, preferredMimeType);
  }
  _renderMessage(viewModel, message) {
    const el = DOM.$("p", void 0, message);
    return { type: RenderOutputType.Html, source: viewModel, htmlContent: el.outerHTML };
  }
  _renderSearchForMimetype(viewModel, mimeType) {
    const query = `@tag:notebookRenderer ${mimeType}`;
    const p = DOM.$("p", void 0, `No renderer could be found for mimetype "${mimeType}", but one might be available on the Marketplace.`);
    const a = DOM.$("a", { href: `command:workbench.extensions.search?%22${query}%22`, class: "monaco-button monaco-text-button", tabindex: 0, role: "button", style: "padding: 8px; text-decoration: none; color: rgb(255, 255, 255); background-color: rgb(14, 99, 156); max-width: 200px;" }, `Search Marketplace`);
    return {
      type: RenderOutputType.Html,
      source: viewModel,
      htmlContent: p.outerHTML + a.outerHTML
    };
  }
  scheduleOutputHeightAck(cellInfo, outputId, height) {
    DOM.scheduleAtNextAnimationFrame(this.window, () => {
      this._outputWebview?.ackHeight([{ cellId: cellInfo.cellId, outputId, height }]);
    }, 10);
  }
  async focusNotebookCell(cell, focus) {
  }
  async focusNextNotebookCell(cell, focus) {
  }
  toggleNotebookCellSelection(cell) {
    throw new Error("Not implemented.");
  }
  getCellById(cellId) {
    throw new Error("Not implemented");
  }
  getCellByInfo(cellInfo) {
    return this._notebookViewModel?.getCellByHandle(cellInfo.cellHandle);
  }
  layout(dimension, position) {
  }
  setScrollTop(scrollTop) {
  }
  triggerScroll(event) {
  }
  getOutputRenderer() {
  }
  updateOutputHeight(cellInfo, output, height, isInit, source) {
  }
  updateMarkupCellHeight(cellId, height, isInit) {
  }
  setMarkupCellEditState(cellId, editState) {
  }
  didResizeOutput(cellId) {
  }
  didStartDragMarkupCell(cellId, event) {
  }
  didDragMarkupCell(cellId, event) {
  }
  didDropMarkupCell(cellId, event) {
  }
  didEndDragMarkupCell(cellId) {
  }
  updatePerformanceMetadata(cellId, executionId, duration, rendererId) {
  }
  didFocusOutputInputChange(inputFocused) {
  }
  dispose() {
    this._isDisposed = true;
    super.dispose();
  }
};
NotebookOutputEditor = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, INotebookService)
], NotebookOutputEditor);
let NotebookOutputEditorContribution = class {
  constructor(editorResolverService, instantiationService, uriIdentityService) {
    this.instantiationService = instantiationService;
    this.uriIdentityService = uriIdentityService;
    editorResolverService.registerEditor(
      `${Schemas.vscodeNotebookCellOutput}:/**`,
      {
        id: "notebookOutputEditor",
        label: "Notebook Output Editor",
        priority: RegisteredEditorPriority.default
      },
      {
        canSupportResource: (resource) => {
          if (resource.scheme === Schemas.vscodeNotebookCellOutput) {
            const params = new URLSearchParams(resource.query);
            return params.get("openIn") === "notebookOutputEditor";
          }
          return false;
        }
      },
      {
        createEditorInput: async ({ resource, options }) => {
          const outputUriData = CellUri.parseCellOutputUri(resource);
          if (!outputUriData || !outputUriData.notebook || outputUriData.cellIndex === void 0 || outputUriData.outputIndex === void 0 || !outputUriData.outputId) {
            throw new Error("Invalid output uri for notebook output editor");
          }
          const notebookUri = this.uriIdentityService.asCanonicalUri(outputUriData.notebook);
          const cellIndex = outputUriData.cellIndex;
          const outputId = outputUriData.outputId;
          const outputIndex = outputUriData.outputIndex;
          const editorInput = this.instantiationService.createInstance(NotebookOutputEditorInput, notebookUri, cellIndex, outputId, outputIndex);
          return {
            editor: editorInput,
            options
          };
        }
      }
    );
  }
  static {
    this.ID = "workbench.contribution.notebookOutputEditorContribution";
  }
};
NotebookOutputEditorContribution = __decorateClass([
  __decorateParam(0, IEditorResolverService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IUriIdentityService)
], NotebookOutputEditorContribution);
registerWorkbenchContribution2(NotebookOutputEditorContribution.ID, NotebookOutputEditorContribution, WorkbenchPhase.BlockRestore);
export {
  NoopCellEditorOptions,
  NotebookOutputEditor,
  NotebookOutputEditorContribution
};
