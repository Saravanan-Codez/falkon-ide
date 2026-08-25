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
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../../../common/contributions.js";
import { MarkerList, IMarkerNavigationService } from "../../../../../../editor/contrib/gotoError/browser/markerNavigationService.js";
import { CellUri } from "../../../common/notebookCommon.js";
import { IMarkerService, MarkerSeverity } from "../../../../../../platform/markers/common/markers.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { NotebookOverviewRulerLane } from "../../notebookBrowser.js";
import { registerNotebookContribution } from "../../notebookEditorExtensions.js";
import { throttle } from "../../../../../../base/common/decorators.js";
import { editorErrorForeground, editorWarningForeground } from "../../../../../../platform/theme/common/colorRegistry.js";
import { isEqual } from "../../../../../../base/common/resources.js";
let MarkerListProvider = class {
  constructor(_markerService, markerNavigation, _configService) {
    this._markerService = _markerService;
    this._configService = _configService;
    this._dispoables = markerNavigation.registerProvider(this);
  }
  static {
    this.ID = "workbench.contrib.markerListProvider";
  }
  dispose() {
    this._dispoables.dispose();
  }
  getMarkerList(resource) {
    if (!resource) {
      return void 0;
    }
    const data = CellUri.parse(resource);
    if (!data) {
      return void 0;
    }
    return new MarkerList((uri) => {
      const otherData = CellUri.parse(uri);
      return otherData?.notebook.toString() === data.notebook.toString();
    }, this._markerService, this._configService);
  }
};
MarkerListProvider = __decorateClass([
  __decorateParam(0, IMarkerService),
  __decorateParam(1, IMarkerNavigationService),
  __decorateParam(2, IConfigurationService)
], MarkerListProvider);
let NotebookMarkerDecorationContribution = class extends Disposable {
  constructor(_notebookEditor, _markerService) {
    super();
    this._notebookEditor = _notebookEditor;
    this._markerService = _markerService;
    this._markersOverviewRulerDecorations = [];
    this._update();
    this._register(this._notebookEditor.onDidChangeModel(() => this._update()));
    this._register(this._markerService.onMarkerChanged((e) => {
      if (e.some((uri) => this._notebookEditor.getCellsInRange().some((cell) => isEqual(cell.uri, uri)))) {
        this._update();
      }
    }));
  }
  static {
    this.id = "workbench.notebook.markerDecoration";
  }
  _update() {
    if (!this._notebookEditor.hasModel()) {
      return;
    }
    const cellDecorations = [];
    this._notebookEditor.getCellsInRange().forEach((cell) => {
      const marker = this._markerService.read({ resource: cell.uri, severities: MarkerSeverity.Error | MarkerSeverity.Warning });
      marker.forEach((m) => {
        const color = m.severity === MarkerSeverity.Error ? editorErrorForeground : editorWarningForeground;
        const range = { startLineNumber: m.startLineNumber, startColumn: m.startColumn, endLineNumber: m.endLineNumber, endColumn: m.endColumn };
        cellDecorations.push({
          handle: cell.handle,
          options: {
            overviewRuler: {
              color,
              modelRanges: [range],
              includeOutput: false,
              position: NotebookOverviewRulerLane.Right
            }
          }
        });
      });
    });
    this._markersOverviewRulerDecorations = this._notebookEditor.deltaCellDecorations(this._markersOverviewRulerDecorations, cellDecorations);
  }
};
__decorateClass([
  throttle(100)
], NotebookMarkerDecorationContribution.prototype, "_update", 1);
NotebookMarkerDecorationContribution = __decorateClass([
  __decorateParam(1, IMarkerService)
], NotebookMarkerDecorationContribution);
registerWorkbenchContribution2(MarkerListProvider.ID, MarkerListProvider, WorkbenchPhase.BlockRestore);
registerNotebookContribution(NotebookMarkerDecorationContribution.id, NotebookMarkerDecorationContribution);
