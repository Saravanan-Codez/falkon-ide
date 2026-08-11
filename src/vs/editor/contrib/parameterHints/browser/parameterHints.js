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
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { Lazy } from "../../../../base/common/lazy.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { EditorAction, EditorCommand, EditorContributionInstantiation, registerEditorAction, registerEditorCommand, registerEditorContribution } from "../../../browser/editorExtensions.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import * as languages from "../../../common/languages.js";
import { ILanguageFeaturesService } from "../../../common/services/languageFeatures.js";
import { ParameterHintsModel } from "./parameterHintsModel.js";
import { Context } from "./provideSignatureHelp.js";
import * as nls from "../../../../nls.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ParameterHintsWidget } from "./parameterHintsWidget.js";
let ParameterHintsController = class extends Disposable {
  static {
    this.ID = "editor.controller.parameterHints";
  }
  static get(editor) {
    return editor.getContribution(ParameterHintsController.ID);
  }
  constructor(editor, instantiationService, languageFeaturesService) {
    super();
    this.editor = editor;
    this.model = this._register(new ParameterHintsModel(editor, languageFeaturesService.signatureHelpProvider));
    this._register(this.model.onChangedHints((newParameterHints) => {
      if (newParameterHints) {
        this.widget.value.show();
        this.widget.value.render(newParameterHints);
      } else {
        this.widget.rawValue?.hide();
      }
    }));
    this.widget = new Lazy(() => this._register(instantiationService.createInstance(ParameterHintsWidget, this.editor, this.model)));
  }
  cancel() {
    this.model.cancel();
  }
  previous() {
    this.widget.rawValue?.previous();
  }
  next() {
    this.widget.rawValue?.next();
  }
  trigger(context) {
    this.model.trigger(context, 0);
  }
};
ParameterHintsController = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ILanguageFeaturesService)
], ParameterHintsController);
class TriggerParameterHintsAction extends EditorAction {
  constructor() {
    super({
      id: "editor.action.triggerParameterHints",
      label: nls.localize2("parameterHints.trigger.label", "Trigger Parameter Hints"),
      precondition: EditorContextKeys.hasSignatureHelpProvider,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Space,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  run(accessor, editor) {
    const controller = ParameterHintsController.get(editor);
    controller?.trigger({
      triggerKind: languages.SignatureHelpTriggerKind.Invoke
    });
  }
}
registerEditorContribution(ParameterHintsController.ID, ParameterHintsController, EditorContributionInstantiation.BeforeFirstInteraction);
registerEditorAction(TriggerParameterHintsAction);
const weight = KeybindingWeight.EditorContrib + 75;
const ParameterHintsCommand = EditorCommand.bindToContribution(ParameterHintsController.get);
registerEditorCommand(new ParameterHintsCommand({
  id: "closeParameterHints",
  precondition: Context.Visible,
  handler: (x) => x.cancel(),
  kbOpts: {
    weight,
    kbExpr: EditorContextKeys.focus,
    primary: KeyCode.Escape,
    secondary: [KeyMod.Shift | KeyCode.Escape]
  }
}));
registerEditorCommand(new ParameterHintsCommand({
  id: "showPrevParameterHint",
  precondition: ContextKeyExpr.and(Context.Visible, Context.MultipleSignatures),
  handler: (x) => x.previous(),
  kbOpts: {
    weight,
    kbExpr: EditorContextKeys.focus,
    primary: KeyCode.UpArrow,
    secondary: [KeyMod.Alt | KeyCode.UpArrow],
    mac: { primary: KeyCode.UpArrow, secondary: [KeyMod.Alt | KeyCode.UpArrow, KeyMod.WinCtrl | KeyCode.KeyP] }
  }
}));
registerEditorCommand(new ParameterHintsCommand({
  id: "showNextParameterHint",
  precondition: ContextKeyExpr.and(Context.Visible, Context.MultipleSignatures),
  handler: (x) => x.next(),
  kbOpts: {
    weight,
    kbExpr: EditorContextKeys.focus,
    primary: KeyCode.DownArrow,
    secondary: [KeyMod.Alt | KeyCode.DownArrow],
    mac: { primary: KeyCode.DownArrow, secondary: [KeyMod.Alt | KeyCode.DownArrow, KeyMod.WinCtrl | KeyCode.KeyN] }
  }
}));
export {
  ParameterHintsController,
  TriggerParameterHintsAction
};
