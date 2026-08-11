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
import * as nls from "../../../../nls.js";
import * as path from "../../../../base/common/path.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { EditorContributionInstantiation, registerEditorContribution } from "../../../../editor/browser/editorExtensions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
let LargeFileOptimizationsWarner = class extends Disposable {
  constructor(_editor, _notificationService, _configurationService) {
    super();
    this._editor = _editor;
    this._notificationService = _notificationService;
    this._configurationService = _configurationService;
    this._register(this._editor.onDidChangeModel((e) => this._update()));
    this._update();
  }
  static {
    this.ID = "editor.contrib.largeFileOptimizationsWarner";
  }
  _update() {
    const model = this._editor.getModel();
    if (!model) {
      return;
    }
    if (model.isTooLargeForTokenization()) {
      const message = nls.localize(
        {
          key: "largeFile",
          comment: [
            "Variable 0 will be a file name."
          ]
        },
        "{0}: tokenization, wrapping, folding, codelens, word highlighting and sticky scroll have been turned off for this large file in order to reduce memory usage and avoid freezing or crashing.",
        path.basename(model.uri.path)
      );
      this._notificationService.prompt(Severity.Info, message, [
        {
          label: nls.localize("removeOptimizations", "Forcefully Enable Features"),
          run: () => {
            this._configurationService.updateValue(`editor.largeFileOptimizations`, false).then(() => {
              this._notificationService.info(nls.localize("reopenFilePrompt", "Please reopen file in order for this setting to take effect."));
            }, (err) => {
              this._notificationService.error(err);
            });
          }
        }
      ], { neverShowAgain: { id: "editor.contrib.largeFileOptimizationsWarner" } });
    }
  }
};
LargeFileOptimizationsWarner = __decorateClass([
  __decorateParam(1, INotificationService),
  __decorateParam(2, IConfigurationService)
], LargeFileOptimizationsWarner);
registerEditorContribution(LargeFileOptimizationsWarner.ID, LargeFileOptimizationsWarner, EditorContributionInstantiation.AfterFirstRender);
export {
  LargeFileOptimizationsWarner
};
