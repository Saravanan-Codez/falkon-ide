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
import { AbstractGotoLineQuickAccessProvider } from "../../../contrib/quickAccess/browser/gotoLineQuickAccess.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions } from "../../../../platform/quickinput/common/quickAccess.js";
import { ICodeEditorService } from "../../../browser/services/codeEditorService.js";
import { GoToLineNLS } from "../../../common/standaloneStrings.js";
import { Event } from "../../../../base/common/event.js";
import { EditorAction, registerEditorAction } from "../../../browser/editorExtensions.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import { KeyMod, KeyCode } from "../../../../base/common/keyCodes.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
let StandaloneGotoLineQuickAccessProvider = class extends AbstractGotoLineQuickAccessProvider {
  constructor(editorService, storageService) {
    super();
    this.editorService = editorService;
    this.storageService = storageService;
    this.onDidActiveTextEditorControlChange = Event.None;
  }
  get activeTextEditorControl() {
    return this.editorService.getFocusedCodeEditor() ?? void 0;
  }
};
StandaloneGotoLineQuickAccessProvider = __decorateClass([
  __decorateParam(0, ICodeEditorService),
  __decorateParam(1, IStorageService)
], StandaloneGotoLineQuickAccessProvider);
class GotoLineAction extends EditorAction {
  static {
    this.ID = "editor.action.gotoLine";
  }
  constructor() {
    super({
      id: GotoLineAction.ID,
      label: GoToLineNLS.gotoLineActionLabel,
      alias: "Go to Line/Column...",
      precondition: void 0,
      kbOpts: {
        kbExpr: EditorContextKeys.focus,
        primary: KeyMod.CtrlCmd | KeyCode.KeyG,
        mac: { primary: KeyMod.WinCtrl | KeyCode.KeyG },
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  run(accessor) {
    accessor.get(IQuickInputService).quickAccess.show(StandaloneGotoLineQuickAccessProvider.GO_TO_LINE_PREFIX);
  }
}
registerEditorAction(GotoLineAction);
Registry.as(Extensions.Quickaccess).registerQuickAccessProvider({
  ctor: StandaloneGotoLineQuickAccessProvider,
  prefix: StandaloneGotoLineQuickAccessProvider.GO_TO_LINE_PREFIX,
  helpEntries: [{ description: GoToLineNLS.gotoLineActionLabel, commandId: GotoLineAction.ID }]
});
class GotoOffsetAction extends EditorAction {
  static {
    this.ID = "editor.action.gotoOffset";
  }
  constructor() {
    super({
      id: GotoOffsetAction.ID,
      label: GoToLineNLS.gotoOffsetActionLabel,
      alias: "Go to Offset...",
      precondition: void 0
    });
  }
  run(accessor) {
    accessor.get(IQuickInputService).quickAccess.show(StandaloneGotoLineQuickAccessProvider.GO_TO_OFFSET_PREFIX);
  }
}
registerEditorAction(GotoOffsetAction);
Registry.as(Extensions.Quickaccess).registerQuickAccessProvider({
  ctor: StandaloneGotoLineQuickAccessProvider,
  prefix: StandaloneGotoLineQuickAccessProvider.GO_TO_OFFSET_PREFIX,
  helpEntries: [{ description: GoToLineNLS.gotoOffsetActionLabel, commandId: GotoOffsetAction.ID }]
});
export {
  GotoLineAction,
  StandaloneGotoLineQuickAccessProvider
};
