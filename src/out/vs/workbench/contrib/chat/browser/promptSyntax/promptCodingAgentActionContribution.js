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
import { Disposable, DisposableMap } from "../../../../../base/common/lifecycle.js";
import { registerEditorContribution, EditorContributionInstantiation } from "../../../../../editor/browser/editorExtensions.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { PROMPT_LANGUAGE_ID } from "../../common/promptSyntax/promptTypes.js";
import { PromptCodingAgentActionOverlayWidget } from "./promptCodingAgentActionOverlay.js";
let PromptCodingAgentActionContribution = class extends Disposable {
  constructor(_editor, _instantiationService) {
    super();
    this._editor = _editor;
    this._instantiationService = _instantiationService;
    this._overlayWidgets = this._register(new DisposableMap());
    this._register(this._editor.onDidChangeModel(() => {
      this._updateOverlayWidget();
    }));
    this._updateOverlayWidget();
  }
  static {
    this.ID = "promptCodingAgentActionContribution";
  }
  _updateOverlayWidget() {
    const model = this._editor.getModel();
    this._overlayWidgets.deleteAndDispose(this._editor);
    if (model && model.getLanguageId() === PROMPT_LANGUAGE_ID) {
      const widget = this._instantiationService.createInstance(PromptCodingAgentActionOverlayWidget, this._editor);
      this._overlayWidgets.set(this._editor, widget);
    }
  }
};
PromptCodingAgentActionContribution = __decorateClass([
  __decorateParam(1, IInstantiationService)
], PromptCodingAgentActionContribution);
registerEditorContribution(PromptCodingAgentActionContribution.ID, PromptCodingAgentActionContribution, EditorContributionInstantiation.AfterFirstRender);
export {
  PromptCodingAgentActionContribution
};
