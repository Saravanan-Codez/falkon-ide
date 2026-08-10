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
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { IMarkerService, MarkerSeverity } from "../../../../platform/markers/common/markers.js";
import { IDecorationsService } from "../../../services/decorations/common/decorations.js";
import { dispose } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { listErrorForeground, listWarningForeground } from "../../../../platform/theme/common/colorRegistry.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { Extensions as ConfigurationExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
class MarkersDecorationsProvider {
  constructor(_markerService) {
    this._markerService = _markerService;
    this.label = localize("label", "Problems");
    this.onDidChange = _markerService.onMarkerChanged;
  }
  provideDecorations(resource) {
    const markers = this._markerService.read({
      resource,
      severities: MarkerSeverity.Error | MarkerSeverity.Warning
    });
    let first;
    for (const marker of markers) {
      if (!first || marker.severity > first.severity) {
        first = marker;
      }
    }
    if (!first) {
      return void 0;
    }
    return {
      weight: 100 * first.severity,
      bubble: true,
      tooltip: markers.length === 1 ? localize("tooltip.1", "1 problem in this file") : localize("tooltip.N", "{0} problems in this file", markers.length),
      letter: markers.length < 10 ? markers.length.toString() : "9+",
      color: first.severity === MarkerSeverity.Error ? listErrorForeground : listWarningForeground
    };
  }
}
let MarkersFileDecorations = class {
  constructor(_markerService, _decorationsService, _configurationService) {
    this._markerService = _markerService;
    this._decorationsService = _decorationsService;
    this._configurationService = _configurationService;
    this._disposables = [
      this._configurationService.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("problems.visibility")) {
          this._updateEnablement();
        }
      })
    ];
    this._updateEnablement();
  }
  dispose() {
    dispose(this._provider);
    dispose(this._disposables);
  }
  _updateEnablement() {
    const problem = this._configurationService.getValue("problems.visibility");
    if (problem === void 0) {
      return;
    }
    const value = this._configurationService.getValue("problems");
    const shouldEnable = problem && value.decorations.enabled;
    if (shouldEnable === this._enabled) {
      if (!problem || !value.decorations.enabled) {
        this._provider?.dispose();
        this._provider = void 0;
      }
      return;
    }
    this._enabled = shouldEnable;
    if (this._enabled) {
      const provider = new MarkersDecorationsProvider(this._markerService);
      this._provider = this._decorationsService.registerDecorationsProvider(provider);
    } else if (this._provider) {
      this._provider.dispose();
    }
  }
};
MarkersFileDecorations = __decorateClass([
  __decorateParam(0, IMarkerService),
  __decorateParam(1, IDecorationsService),
  __decorateParam(2, IConfigurationService)
], MarkersFileDecorations);
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  "id": "problems",
  "order": 101,
  "type": "object",
  "properties": {
    "problems.decorations.enabled": {
      "markdownDescription": localize("markers.showOnFile", "Show Errors & Warnings on files and folder. Overwritten by {0} when it is off.", "`#problems.visibility#`"),
      "type": "boolean",
      "default": true
    }
  }
});
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(MarkersFileDecorations, LifecyclePhase.Restored);
