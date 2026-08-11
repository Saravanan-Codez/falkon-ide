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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { isEqual } from "../../../../base/common/resources.js";
import { EditorContributionInstantiation, registerEditorContribution } from "../../../browser/editorExtensions.js";
import { Range } from "../../../common/core/range.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IMarkerService, MarkerSeverity } from "../../../../platform/markers/common/markers.js";
let MarkerSelectionStatus = class extends Disposable {
  constructor(_editor, contextKeyService, _markerService) {
    super();
    this._editor = _editor;
    this._markerService = _markerService;
    this._ctxHasDiagnostics = EditorContextKeys.selectionHasDiagnostics.bindTo(contextKeyService);
    this._store.add(this._editor.onDidChangeCursorSelection(() => this._update()));
    this._store.add(this._editor.onDidChangeModel(() => this._update()));
    this._store.add(this._markerService.onMarkerChanged((e) => {
      const model = this._editor.getModel();
      if (model && e.some((uri) => isEqual(uri, model.uri))) {
        this._update();
      }
    }));
    this._update();
  }
  static {
    this.ID = "editor.contrib.markerSelectionStatus";
  }
  dispose() {
    this._ctxHasDiagnostics.reset();
    super.dispose();
  }
  _update() {
    const model = this._editor.getModel();
    const selection = this._editor.getSelection();
    if (!model || !selection) {
      this._ctxHasDiagnostics.reset();
      return;
    }
    const markers = this._markerService.read({
      resource: model.uri,
      severities: MarkerSeverity.Error | MarkerSeverity.Warning | MarkerSeverity.Info
    });
    const hasIntersecting = markers.some((marker) => Range.areIntersecting(
      { startLineNumber: marker.startLineNumber, startColumn: marker.startColumn, endLineNumber: marker.endLineNumber, endColumn: marker.endColumn },
      selection
    ));
    this._ctxHasDiagnostics.set(hasIntersecting);
  }
};
MarkerSelectionStatus = __decorateClass([
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IMarkerService)
], MarkerSelectionStatus);
registerEditorContribution(MarkerSelectionStatus.ID, MarkerSelectionStatus, EditorContributionInstantiation.AfterFirstRender);
