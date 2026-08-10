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
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
import { OutlineConfigCollapseItemsValues, IOutlineService, OutlineConfigKeys, OutlineTarget } from "../../../../services/outline/browser/outline.js";
import { Extensions as WorkbenchExtensions } from "../../../../common/contributions.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { LifecyclePhase } from "../../../../services/lifecycle/common/lifecycle.js";
import { DocumentSymbolComparator, DocumentSymbolAccessibilityProvider, DocumentSymbolRenderer, DocumentSymbolFilter, DocumentSymbolGroupRenderer, DocumentSymbolIdentityProvider, DocumentSymbolNavigationLabelProvider, DocumentSymbolVirtualDelegate, DocumentSymbolDragAndDrop } from "./documentSymbolsTree.js";
import { isCodeEditor, isDiffEditor } from "../../../../../editor/browser/editorBrowser.js";
import { OutlineGroup, OutlineElement, OutlineModel, TreeElement, IOutlineModelService } from "../../../../../editor/contrib/documentSymbols/browser/outlineModel.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { raceCancellation, TimeoutTimer, timeout, Barrier } from "../../../../../base/common/async.js";
import { onUnexpectedError } from "../../../../../base/common/errors.js";
import { ITextResourceConfigurationService } from "../../../../../editor/common/services/textResourceConfiguration.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ScrollType } from "../../../../../editor/common/editorCommon.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { TextEditorSelectionRevealType } from "../../../../../platform/editor/common/editor.js";
import { ICodeEditorService } from "../../../../../editor/browser/services/codeEditorService.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { localize } from "../../../../../nls.js";
import { IMarkerDecorationsService } from "../../../../../editor/common/services/markerDecorations.js";
import { MarkerSeverity } from "../../../../../platform/markers/common/markers.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { ILanguageFeaturesService } from "../../../../../editor/common/services/languageFeatures.js";
let DocumentSymbolBreadcrumbsSource = class {
  constructor(_editor, _textResourceConfigurationService) {
    this._editor = _editor;
    this._textResourceConfigurationService = _textResourceConfigurationService;
    this._breadcrumbs = [];
  }
  getBreadcrumbElements() {
    return this._breadcrumbs;
  }
  clear() {
    this._breadcrumbs = [];
  }
  update(model, position) {
    const newElements = this._computeBreadcrumbs(model, position);
    this._breadcrumbs = newElements.map((element) => ({
      element,
      label: element instanceof OutlineElement ? element.symbol.name : ""
    }));
  }
  _computeBreadcrumbs(model, position) {
    let item = model.getItemEnclosingPosition(position);
    if (!item) {
      return [];
    }
    const chain = [];
    while (item) {
      chain.push(item);
      const parent = item.parent;
      if (parent instanceof OutlineModel) {
        break;
      }
      if (parent instanceof OutlineGroup && parent.parent && parent.parent.children.size === 1) {
        break;
      }
      item = parent;
    }
    const result = [];
    for (let i = chain.length - 1; i >= 0; i--) {
      const element = chain[i];
      if (this._isFiltered(element)) {
        break;
      }
      result.push(element);
    }
    if (result.length === 0) {
      return [];
    }
    return result;
  }
  _isFiltered(element) {
    if (!(element instanceof OutlineElement)) {
      return false;
    }
    const key = `breadcrumbs.${DocumentSymbolFilter.kindToConfigName[element.symbol.kind]}`;
    let uri;
    if (this._editor && this._editor.getModel()) {
      const model = this._editor.getModel();
      uri = model.uri;
    }
    return !this._textResourceConfigurationService.getValue(uri, key);
  }
};
DocumentSymbolBreadcrumbsSource = __decorateClass([
  __decorateParam(1, ITextResourceConfigurationService)
], DocumentSymbolBreadcrumbsSource);
let DocumentSymbolsOutline = class {
  constructor(_editor, target, firstLoadBarrier, _languageFeaturesService, _codeEditorService, _outlineModelService, _configurationService, _markerDecorationsService, textResourceConfigurationService, instantiationService) {
    this._editor = _editor;
    this._languageFeaturesService = _languageFeaturesService;
    this._codeEditorService = _codeEditorService;
    this._outlineModelService = _outlineModelService;
    this._configurationService = _configurationService;
    this._markerDecorationsService = _markerDecorationsService;
    this._disposables = new DisposableStore();
    this._onDidChange = this._disposables.add(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._outlineDisposables = new DisposableStore();
    this.outlineKind = "documentSymbols";
    this._breadcrumbsDataSource = new DocumentSymbolBreadcrumbsSource(_editor, textResourceConfigurationService);
    const delegate = new DocumentSymbolVirtualDelegate();
    const renderers = [new DocumentSymbolGroupRenderer(), instantiationService.createInstance(DocumentSymbolRenderer, true, target)];
    const treeDataSource = {
      getChildren: (parent) => {
        if (parent instanceof OutlineElement || parent instanceof OutlineGroup) {
          return parent.children.values();
        }
        if (parent === this && this._outlineModel) {
          return this._outlineModel.children.values();
        }
        return [];
      }
    };
    const comparator = new DocumentSymbolComparator();
    const initialState = textResourceConfigurationService.getValue(_editor.getModel()?.uri, OutlineConfigKeys.collapseItems);
    const options = {
      collapseByDefault: target === OutlineTarget.Breadcrumbs || target === OutlineTarget.OutlinePane && initialState === OutlineConfigCollapseItemsValues.Collapsed,
      expandOnlyOnTwistieClick: true,
      multipleSelectionSupport: false,
      identityProvider: new DocumentSymbolIdentityProvider(),
      keyboardNavigationLabelProvider: new DocumentSymbolNavigationLabelProvider(),
      accessibilityProvider: new DocumentSymbolAccessibilityProvider(localize("document", "Document Symbols")),
      filter: target === OutlineTarget.OutlinePane ? instantiationService.createInstance(DocumentSymbolFilter, "outline") : target === OutlineTarget.Breadcrumbs ? instantiationService.createInstance(DocumentSymbolFilter, "breadcrumbs") : void 0,
      dnd: instantiationService.createInstance(DocumentSymbolDragAndDrop)
    };
    this.config = {
      breadcrumbsDataSource: this._breadcrumbsDataSource,
      delegate,
      renderers,
      treeDataSource,
      comparator,
      options,
      quickPickDataSource: { getQuickPickElements: () => {
        throw new Error("not implemented");
      } }
    };
    this._disposables.add(_languageFeaturesService.documentSymbolProvider.onDidChange((_) => this._createOutline()));
    this._disposables.add(this._editor.onDidChangeModel((_) => this._createOutline()));
    this._disposables.add(this._editor.onDidChangeModelLanguage((_) => this._createOutline()));
    const updateSoon = new TimeoutTimer();
    this._disposables.add(updateSoon);
    this._disposables.add(this._editor.onDidChangeModelContent((event) => {
      const model = this._editor.getModel();
      if (model) {
        const timeout2 = _outlineModelService.getDebounceValue(model);
        updateSoon.cancelAndSet(() => this._createOutline(event), timeout2);
      }
    }));
    this._disposables.add(this._editor.onDidDispose(() => this._outlineDisposables.clear()));
    this._createOutline().finally(() => firstLoadBarrier.open());
  }
  get activeElement() {
    const posistion = this._editor.getPosition();
    if (!posistion || !this._outlineModel) {
      return void 0;
    } else {
      return this._outlineModel.getItemEnclosingPosition(posistion);
    }
  }
  dispose() {
    this._disposables.dispose();
    this._outlineDisposables.dispose();
  }
  get isEmpty() {
    return !this._outlineModel || TreeElement.empty(this._outlineModel);
  }
  get uri() {
    return this._outlineModel?.uri;
  }
  async reveal(entry, options, sideBySide, select) {
    const model = OutlineModel.get(entry);
    if (!model || !(entry instanceof OutlineElement)) {
      return;
    }
    await this._codeEditorService.openCodeEditor({
      resource: model.uri,
      options: {
        ...options,
        selection: select ? entry.symbol.range : Range.collapseToStart(entry.symbol.selectionRange),
        selectionRevealType: TextEditorSelectionRevealType.NearTopIfOutsideViewport
      }
    }, this._editor, sideBySide);
  }
  preview(entry) {
    if (!(entry instanceof OutlineElement)) {
      return Disposable.None;
    }
    const { symbol } = entry;
    this._editor.revealRangeInCenterIfOutsideViewport(symbol.range, ScrollType.Smooth);
    const decorationsCollection = this._editor.createDecorationsCollection([{
      range: symbol.range,
      options: {
        description: "document-symbols-outline-range-highlight",
        className: "rangeHighlight",
        isWholeLine: true
      }
    }]);
    return toDisposable(() => decorationsCollection.clear());
  }
  captureViewState() {
    const viewState = this._editor.saveViewState();
    return toDisposable(() => {
      if (viewState) {
        this._editor.restoreViewState(viewState);
      }
    });
  }
  async _createOutline(contentChangeEvent) {
    this._outlineDisposables.clear();
    if (!contentChangeEvent) {
      this._setOutlineModel(void 0);
    }
    if (!this._editor.hasModel()) {
      return;
    }
    const buffer = this._editor.getModel();
    if (!this._languageFeaturesService.documentSymbolProvider.has(buffer)) {
      return;
    }
    const cts = new CancellationTokenSource();
    const versionIdThen = buffer.getVersionId();
    const timeoutTimer = new TimeoutTimer();
    this._outlineDisposables.add(timeoutTimer);
    this._outlineDisposables.add(toDisposable(() => cts.dispose(true)));
    try {
      const model = await this._outlineModelService.getOrCreate(buffer, cts.token);
      if (cts.token.isCancellationRequested) {
        return;
      }
      if (TreeElement.empty(model) || !this._editor.hasModel()) {
        this._setOutlineModel(model);
        return;
      }
      if (contentChangeEvent && this._outlineModel && buffer.getLineCount() >= 25) {
        const newSize = TreeElement.size(model);
        const newLength = buffer.getValueLength();
        const newRatio = newSize / newLength;
        const oldSize = TreeElement.size(this._outlineModel);
        const oldLength = newLength - contentChangeEvent.changes.reduce((prev, value) => prev + value.rangeLength, 0);
        const oldRatio = oldSize / oldLength;
        if (newRatio <= oldRatio * 0.5 || newRatio >= oldRatio * 1.5) {
          const value = await raceCancellation(timeout(2e3).then(() => true), cts.token, false);
          if (!value) {
            return;
          }
        }
      }
      this._applyMarkersToOutline(model);
      this._outlineDisposables.add(this._markerDecorationsService.onDidChangeMarker((textModel) => {
        if (isEqual(model.uri, textModel.uri)) {
          this._applyMarkersToOutline(model);
          this._onDidChange.fire({});
        }
      }));
      this._outlineDisposables.add(this._configurationService.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(OutlineConfigKeys.problemsEnabled) || e.affectsConfiguration("problems.visibility")) {
          const problem = this._configurationService.getValue("problems.visibility");
          const config = this._configurationService.getValue(OutlineConfigKeys.problemsEnabled);
          if (!problem || !config) {
            model.updateMarker([]);
          } else {
            this._applyMarkersToOutline(model);
          }
          this._onDidChange.fire({});
        }
        if (e.affectsConfiguration("outline")) {
          this._onDidChange.fire({});
        }
        if (e.affectsConfiguration("breadcrumbs") && this._editor.hasModel()) {
          this._breadcrumbsDataSource.update(model, this._editor.getPosition());
          this._onDidChange.fire({});
        }
      }));
      this._outlineDisposables.add(this._configurationService.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(OutlineConfigKeys.icons)) {
          this._onDidChange.fire({});
        }
        if (e.affectsConfiguration("outline")) {
          this._onDidChange.fire({});
        }
      }));
      this._outlineDisposables.add(this._editor.onDidChangeCursorPosition((_) => {
        timeoutTimer.cancelAndSet(() => {
          if (!buffer.isDisposed() && versionIdThen === buffer.getVersionId() && this._editor.hasModel()) {
            this._breadcrumbsDataSource.update(model, this._editor.getPosition());
            this._onDidChange.fire({ affectOnlyActiveElement: true });
          }
        }, 150);
      }));
      this._setOutlineModel(model);
    } catch (err) {
      this._setOutlineModel(void 0);
      onUnexpectedError(err);
    }
  }
  _applyMarkersToOutline(model) {
    const problem = this._configurationService.getValue("problems.visibility");
    const config = this._configurationService.getValue(OutlineConfigKeys.problemsEnabled);
    if (!model || !problem || !config) {
      return;
    }
    const markers = [];
    for (const [range, marker] of this._markerDecorationsService.getLiveMarkers(model.uri)) {
      if (marker.severity === MarkerSeverity.Error || marker.severity === MarkerSeverity.Warning) {
        markers.push({ ...range, severity: marker.severity });
      }
    }
    model.updateMarker(markers);
  }
  _setOutlineModel(model) {
    const position = this._editor.getPosition();
    if (!position || !model) {
      this._outlineModel = void 0;
      this._breadcrumbsDataSource.clear();
    } else {
      if (!this._outlineModel?.merge(model)) {
        this._outlineModel = model;
      }
      this._breadcrumbsDataSource.update(model, position);
    }
    this._onDidChange.fire({});
  }
};
DocumentSymbolsOutline = __decorateClass([
  __decorateParam(3, ILanguageFeaturesService),
  __decorateParam(4, ICodeEditorService),
  __decorateParam(5, IOutlineModelService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IMarkerDecorationsService),
  __decorateParam(8, ITextResourceConfigurationService),
  __decorateParam(9, IInstantiationService)
], DocumentSymbolsOutline);
let DocumentSymbolsOutlineCreator = class {
  constructor(outlineService) {
    const reg = outlineService.registerOutlineCreator(this);
    this.dispose = () => reg.dispose();
  }
  matches(candidate) {
    const ctrl = candidate.getControl();
    return isCodeEditor(ctrl) || isDiffEditor(ctrl);
  }
  async createOutline(pane, target, _token) {
    const control = pane.getControl();
    let editor;
    if (isCodeEditor(control)) {
      editor = control;
    } else if (isDiffEditor(control)) {
      editor = control.getModifiedEditor();
    }
    if (!editor) {
      return void 0;
    }
    const firstLoadBarrier = new Barrier();
    const result = editor.invokeWithinContext((accessor) => accessor.get(IInstantiationService).createInstance(DocumentSymbolsOutline, editor, target, firstLoadBarrier));
    await firstLoadBarrier.wait();
    return result;
  }
};
DocumentSymbolsOutlineCreator = __decorateClass([
  __decorateParam(0, IOutlineService)
], DocumentSymbolsOutlineCreator);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(DocumentSymbolsOutlineCreator, LifecyclePhase.Eventually);
