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
import { autorunWithStore, observableFromEvent } from "../../../../base/common/observable.js";
import { registerDiffEditorContribution } from "../../../../editor/browser/editorExtensions.js";
import { EmbeddedDiffEditorWidget } from "../../../../editor/browser/widget/diffEditor/embeddedDiffEditorWidget.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { localize } from "../../../../nls.js";
import { AccessibleViewRegistry } from "../../../../platform/accessibility/browser/accessibleViewRegistry.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { FloatingEditorClickWidget } from "../../../browser/codeeditor.js";
import { Extensions } from "../../../common/configuration.js";
import { DiffEditorAccessibilityHelp } from "./diffEditorAccessibilityHelp.js";
let DiffEditorHelperContribution = class extends Disposable {
  constructor(_diffEditor, _instantiationService, _textResourceConfigurationService, _notificationService) {
    super();
    this._diffEditor = _diffEditor;
    this._instantiationService = _instantiationService;
    this._textResourceConfigurationService = _textResourceConfigurationService;
    this._notificationService = _notificationService;
    const isEmbeddedDiffEditor = this._diffEditor instanceof EmbeddedDiffEditorWidget;
    if (!isEmbeddedDiffEditor) {
      const computationResult = observableFromEvent(this, (e) => this._diffEditor.onDidUpdateDiff(e), () => (
        /** @description diffEditor.diffComputationResult */
        this._diffEditor.getDiffComputationResult()
      ));
      const onlyWhiteSpaceChange = computationResult.map((r) => r && !r.identical && r.changes2.length === 0);
      this._register(autorunWithStore((reader, store) => {
        if (onlyWhiteSpaceChange.read(reader)) {
          const helperWidget = store.add(this._instantiationService.createInstance(
            FloatingEditorClickWidget,
            this._diffEditor.getModifiedEditor(),
            localize("hintWhitespace", "Show Whitespace Differences"),
            null
          ));
          store.add(helperWidget.onClick(() => {
            this._textResourceConfigurationService.updateValue(this._diffEditor.getModel().modified.uri, "diffEditor.ignoreTrimWhitespace", false);
          }));
          helperWidget.render();
        }
      }));
      this._register(this._diffEditor.onDidUpdateDiff(() => {
        const diffComputationResult = this._diffEditor.getDiffComputationResult();
        if (diffComputationResult && diffComputationResult.quitEarly) {
          this._notificationService.prompt(
            Severity.Warning,
            localize("hintTimeout", "The diff algorithm was stopped early (after {0} ms.)", this._diffEditor.maxComputationTime),
            [{
              label: localize("removeTimeout", "Remove Limit"),
              run: () => {
                this._textResourceConfigurationService.updateValue(this._diffEditor.getModel().modified.uri, "diffEditor.maxComputationTime", 0);
              }
            }],
            {}
          );
        }
      }));
    }
  }
  static {
    this.ID = "editor.contrib.diffEditorHelper";
  }
};
DiffEditorHelperContribution = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ITextResourceConfigurationService),
  __decorateParam(3, INotificationService)
], DiffEditorHelperContribution);
registerDiffEditorContribution(DiffEditorHelperContribution.ID, DiffEditorHelperContribution);
Registry.as(Extensions.ConfigurationMigration).registerConfigurationMigrations([{
  key: "diffEditor.experimental.collapseUnchangedRegions",
  migrateFn: (value, accessor) => {
    return [
      ["diffEditor.hideUnchangedRegions.enabled", { value }],
      ["diffEditor.experimental.collapseUnchangedRegions", { value: void 0 }]
    ];
  }
}]);
AccessibleViewRegistry.register(new DiffEditorAccessibilityHelp());
