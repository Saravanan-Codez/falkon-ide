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
import { Event } from "../../../../base/common/event.js";
import { readHotReloadableExport } from "../../../../base/common/hotReloadHelpers.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { derived, observableValue, recomputeInitiallyAndOnChange, transaction } from "../../../../base/common/observable.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import "./colors.js";
import { DiffEditorItemTemplate } from "./diffEditorItemTemplate.js";
import { MultiDiffEditorViewModel } from "./multiDiffEditorViewModel.js";
import { MultiDiffEditorWidgetImpl } from "./multiDiffEditorWidgetImpl.js";
let MultiDiffEditorWidget = class extends Disposable {
  constructor(_element, _workbenchUIElementFactory, _diffEditorOptions, _instantiationService) {
    super();
    this._element = _element;
    this._workbenchUIElementFactory = _workbenchUIElementFactory;
    this._diffEditorOptions = _diffEditorOptions;
    this._instantiationService = _instantiationService;
    this._dimension = observableValue(this, void 0);
    this._viewModel = observableValue(this, void 0);
    this._renderSideBySide = observableValue(this, void 0);
    this._widgetImpl = derived(this, (reader) => {
      readHotReloadableExport(DiffEditorItemTemplate, reader);
      return reader.store.add(this._instantiationService.createInstance(
        readHotReloadableExport(MultiDiffEditorWidgetImpl, reader),
        this._element,
        this._dimension,
        this._viewModel,
        this._workbenchUIElementFactory,
        this._renderSideBySide,
        this._diffEditorOptions
      ));
    });
    this._activeControl = derived(this, (reader) => this._widgetImpl.read(reader).activeControl.read(reader));
    this.onDidChangeActiveControl = Event.fromObservableLight(this._activeControl);
    this._register(recomputeInitiallyAndOnChange(this._widgetImpl));
  }
  reveal(resource, options) {
    this._widgetImpl.get().reveal(resource, options);
  }
  createViewModel(model) {
    return new MultiDiffEditorViewModel(model, this._instantiationService);
  }
  setViewModel(viewModel, options) {
    if (this._store.isDisposed) {
      return;
    }
    this._widgetImpl.get().setPreserveFocusOnLoad(!!options?.preserveFocus);
    transaction((tx) => {
      this._viewModel.set(viewModel, tx);
      if (options?.viewState) {
        this._widgetImpl.get().setViewState(options.viewState, tx);
      } else {
        this._widgetImpl.get().clearPendingRestorationState();
      }
    });
  }
  layout(dimension) {
    this._dimension.set(dimension, void 0);
  }
  /**
   * Overrides whether the embedded diffs render side by side (`true`) or inline
   * (`false`) as editor-local state, independent of the
   * `diffEditor.renderSideBySide` setting. When left unset the setting applies.
   */
  setRenderSideBySide(renderSideBySide) {
    this._renderSideBySide.set(renderSideBySide, void 0);
  }
  toggleRenderSideBySide() {
    this._renderSideBySide.set(!(this._renderSideBySide.get() ?? true), void 0);
  }
  getActiveControl() {
    return this._activeControl.get();
  }
  getViewState() {
    return this._widgetImpl.get().getViewState();
  }
  setViewState(viewState) {
    this._widgetImpl.get().setViewState(viewState);
  }
  tryGetCodeEditor(resource) {
    return this._widgetImpl.get().tryGetCodeEditor(resource);
  }
  getRootElement() {
    return this._widgetImpl.get().getRootElement();
  }
  getContextKeyService() {
    return this._widgetImpl.get().getContextKeyService();
  }
  getScopedInstantiationService() {
    return this._widgetImpl.get().getScopedInstantiationService();
  }
  findDocumentDiffItem(resource) {
    return this._widgetImpl.get().findDocumentDiffItem(resource);
  }
  goToNextChange() {
    this._widgetImpl.get().goToNextChange();
  }
  goToPreviousChange() {
    this._widgetImpl.get().goToPreviousChange();
  }
};
MultiDiffEditorWidget = __decorateClass([
  __decorateParam(3, IInstantiationService)
], MultiDiffEditorWidget);
export {
  MultiDiffEditorWidget
};
