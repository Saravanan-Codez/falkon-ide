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
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { MultiDiffEditorWidget } from "../../../../editor/browser/widget/multiDiffEditor/multiDiffEditorWidget.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { MenuId } from "../../../../platform/actions/common/actions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ResourceLabel } from "../../../browser/labels.js";
import { IsSessionsWindowContext } from "../../../common/contextkeys.js";
import { AbstractEditorWithViewState } from "../../../browser/parts/editor/editorWithViewState.js";
import { MultiDiffEditorInput } from "./multiDiffEditorInput.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { Range } from "../../../../editor/common/core/range.js";
import { IEditorProgressService } from "../../../../platform/progress/common/progress.js";
import { autorun, derived, observableValue } from "../../../../base/common/observable.js";
import { FloatingEditorToolbarWidget } from "../../../../editor/contrib/floatingMenu/browser/floatingMenu.js";
let MultiDiffEditor = class extends AbstractEditorWithViewState {
  constructor(group, instantiationService, telemetryService, themeService, storageService, editorService, editorGroupService, textResourceConfigurationService, editorProgressService) {
    super(
      MultiDiffEditor.ID,
      group,
      "multiDiffEditor",
      telemetryService,
      instantiationService,
      storageService,
      textResourceConfigurationService,
      themeService,
      editorService,
      editorGroupService
    );
    this.editorProgressService = editorProgressService;
    this._multiDiffEditorWidget = void 0;
  }
  static {
    this.ID = "multiDiffEditor";
  }
  get viewModel() {
    return this._viewModel;
  }
  createEditor(parent) {
    this._multiDiffEditorWidget = this._register(this.instantiationService.createInstance(
      MultiDiffEditorWidget,
      parent,
      this.instantiationService.createInstance(WorkbenchUIElementFactory),
      void 0
    ));
    this._register(this._multiDiffEditorWidget.onDidChangeActiveControl(() => {
      this._onDidChangeControl.fire();
    }));
    this._contentOverlay = this._register(new MultiDiffEditorContentMenuOverlay(
      this._multiDiffEditorWidget.getRootElement(),
      this._multiDiffEditorWidget.getContextKeyService(),
      this._multiDiffEditorWidget.getScopedInstantiationService()
    ));
  }
  async setInput(input, options, context, token) {
    await super.setInput(input, options, context, token);
    this._viewModel = await input.getViewModel();
    this._contentOverlay?.updateResource(input.resource);
    const viewState = this.loadEditorViewState(input, context);
    this._multiDiffEditorWidget.setViewModel(this._viewModel, { preserveFocus: options?.preserveFocus, viewState });
    this._applyOptions(options);
  }
  setOptions(options) {
    this._applyOptions(options);
  }
  _applyOptions(options) {
    const viewState = options?.viewState;
    if (!viewState || !viewState.revealData) {
      return;
    }
    this._multiDiffEditorWidget?.reveal(viewState.revealData.resource, {
      range: viewState.revealData.range ? Range.lift(viewState.revealData.range) : void 0,
      highlight: true
    });
  }
  async clearInput() {
    await super.clearInput();
    this._contentOverlay?.updateResource(void 0);
    this._multiDiffEditorWidget.setViewModel(void 0);
  }
  layout(dimension) {
    this._multiDiffEditorWidget.layout(dimension);
  }
  getControl() {
    return this._multiDiffEditorWidget.getActiveControl();
  }
  focus() {
    super.focus();
    this._multiDiffEditorWidget?.getActiveControl()?.focus();
  }
  hasFocus() {
    return this._multiDiffEditorWidget?.getActiveControl()?.hasTextFocus() || super.hasFocus();
  }
  computeEditorViewState(resource) {
    return this._multiDiffEditorWidget.getViewState();
  }
  tracksEditorViewState(input) {
    return input instanceof MultiDiffEditorInput;
  }
  toEditorViewStateResource(input) {
    return input.resource;
  }
  tryGetCodeEditor(resource) {
    return this._multiDiffEditorWidget.tryGetCodeEditor(resource);
  }
  findDocumentDiffItem(resource) {
    const i = this._multiDiffEditorWidget.findDocumentDiffItem(resource);
    if (!i) {
      return void 0;
    }
    const i2 = i;
    return i2.multiDiffEditorItem;
  }
  goToNextChange() {
    this._multiDiffEditorWidget?.goToNextChange();
  }
  goToPreviousChange() {
    this._multiDiffEditorWidget?.goToPreviousChange();
  }
  async showWhile(promise) {
    return this.editorProgressService.showWhile(promise);
  }
};
MultiDiffEditor = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ITelemetryService),
  __decorateParam(3, IThemeService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, IEditorService),
  __decorateParam(6, IEditorGroupsService),
  __decorateParam(7, ITextResourceConfigurationService),
  __decorateParam(8, IEditorProgressService)
], MultiDiffEditor);
class MultiDiffEditorContentMenuOverlay extends Disposable {
  constructor(root, contextKeyService, instantiationService) {
    super();
    this.resourceObs = observableValue(this, void 0);
    const widget = instantiationService.createInstance(
      FloatingEditorToolbarWidget,
      MenuId.MultiDiffEditorContent,
      contextKeyService,
      this.resourceObs
    );
    widget.element.classList.add("multi-diff-root-floating-menu");
    this._register(widget);
    const showToolbarObs = derived((reader) => {
      const resource = this.resourceObs.read(reader);
      const hasActions = widget.hasActions.read(reader);
      return resource !== void 0 && hasActions;
    });
    this._register(autorun((reader) => {
      const showToolbar = showToolbarObs.read(reader);
      if (!showToolbar) {
        return;
      }
      root.appendChild(widget.element);
      reader.store.add(toDisposable(() => {
        widget.element.remove();
      }));
    }));
  }
  updateResource(resource) {
    this.resourceObs.set(resource, void 0);
  }
}
let WorkbenchUIElementFactory = class {
  constructor(_instantiationService, contextKeyService) {
    this._instantiationService = _instantiationService;
    this.headerClickToCollapse = IsSessionsWindowContext.getValue(contextKeyService) === true;
  }
  createResourceLabel(element, _kind) {
    const label = this._instantiationService.createInstance(ResourceLabel, element, {});
    return {
      setUri(uri, options = {}) {
        if (!uri) {
          label.element.clear();
        } else {
          label.element.setFile(uri, { strikethrough: options.strikethrough });
        }
      },
      dispose() {
        label.dispose();
      }
    };
  }
};
WorkbenchUIElementFactory = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IContextKeyService)
], WorkbenchUIElementFactory);
export {
  MultiDiffEditor
};
