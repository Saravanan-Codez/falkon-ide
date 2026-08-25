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
import "../../../../base/browser/ui/codicons/codiconStyles.js";
import "../../../contrib/symbolIcons/browser/symbolIcons.js";
import { AbstractGotoSymbolQuickAccessProvider } from "../../../contrib/quickAccess/browser/gotoSymbolQuickAccess.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions } from "../../../../platform/quickinput/common/quickAccess.js";
import { ICodeEditorService } from "../../../browser/services/codeEditorService.js";
import { QuickOutlineNLS } from "../../../common/standaloneStrings.js";
import { Event } from "../../../../base/common/event.js";
import { EditorAction, registerEditorAction } from "../../../browser/editorExtensions.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import { KeyMod, KeyCode } from "../../../../base/common/keyCodes.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IQuickInputService, ItemActivation } from "../../../../platform/quickinput/common/quickInput.js";
import { IOutlineModelService } from "../../../contrib/documentSymbols/browser/outlineModel.js";
import { ILanguageFeaturesService } from "../../../common/services/languageFeatures.js";
let StandaloneGotoSymbolQuickAccessProvider = class extends AbstractGotoSymbolQuickAccessProvider {
  constructor(editorService, languageFeaturesService, outlineModelService) {
    super(languageFeaturesService, outlineModelService);
    this.editorService = editorService;
    this.onDidActiveTextEditorControlChange = Event.None;
  }
  get activeTextEditorControl() {
    return this.editorService.getFocusedCodeEditor() ?? void 0;
  }
};
StandaloneGotoSymbolQuickAccessProvider = __decorateClass([
  __decorateParam(0, ICodeEditorService),
  __decorateParam(1, ILanguageFeaturesService),
  __decorateParam(2, IOutlineModelService)
], StandaloneGotoSymbolQuickAccessProvider);
class GotoSymbolAction extends EditorAction {
  static {
    this.ID = "editor.action.quickOutline";
  }
  constructor() {
    super({
      id: GotoSymbolAction.ID,
      label: QuickOutlineNLS.quickOutlineActionLabel,
      alias: "Go to Symbol...",
      precondition: EditorContextKeys.hasDocumentSymbolProvider,
      kbOpts: {
        kbExpr: EditorContextKeys.focus,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyO,
        weight: KeybindingWeight.EditorContrib
      },
      contextMenuOpts: {
        group: "navigation",
        order: 3
      }
    });
  }
  run(accessor) {
    accessor.get(IQuickInputService).quickAccess.show(AbstractGotoSymbolQuickAccessProvider.PREFIX, { itemActivation: ItemActivation.NONE });
  }
}
registerEditorAction(GotoSymbolAction);
Registry.as(Extensions.Quickaccess).registerQuickAccessProvider({
  ctor: StandaloneGotoSymbolQuickAccessProvider,
  prefix: AbstractGotoSymbolQuickAccessProvider.PREFIX,
  helpEntries: [
    { description: QuickOutlineNLS.quickOutlineActionLabel, prefix: AbstractGotoSymbolQuickAccessProvider.PREFIX, commandId: GotoSymbolAction.ID },
    { description: QuickOutlineNLS.quickOutlineByCategoryActionLabel, prefix: AbstractGotoSymbolQuickAccessProvider.PREFIX_BY_CATEGORY }
  ]
});
export {
  GotoSymbolAction,
  StandaloneGotoSymbolQuickAccessProvider
};
