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
import { localize, localize2 } from "../../../../../nls.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { KeyCode } from "../../../../../base/common/keyCodes.js";
import { RawContextKey, IContextKeyService, ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { Action2, registerAction2, MenuId } from "../../../../../platform/actions/common/actions.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { BrowserViewCommandId } from "../../../../../platform/browserView/common/browserView.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { BrowserEditor, BrowserEditorContribution, BROWSER_EDITOR_ACTIVE, BrowserActionCategory, CONTEXT_BROWSER_HAS_ERROR, CONTEXT_BROWSER_HAS_URL, BrowserActionGroup } from "../browserEditor.js";
const CONTEXT_BROWSER_DEVTOOLS_OPEN = new RawContextKey("browserDevToolsOpen", false, localize("browser.devToolsOpen", "Whether developer tools are open for the current browser view"));
let BrowserEditorDevToolsContribution = class extends BrowserEditorContribution {
  constructor(editor, contextKeyService) {
    super(editor);
    this._devToolsOpenContext = CONTEXT_BROWSER_DEVTOOLS_OPEN.bindTo(contextKeyService);
  }
  onModelAttached(model, store) {
    this._devToolsOpenContext.set(model.isDevToolsOpen);
    store.add(model.onDidChangeDevToolsState((e) => {
      this._devToolsOpenContext.set(e.isDevToolsOpen);
    }));
  }
  onModelDetached() {
    this._devToolsOpenContext.reset();
  }
};
BrowserEditorDevToolsContribution = __decorateClass([
  __decorateParam(1, IContextKeyService)
], BrowserEditorDevToolsContribution);
BrowserEditor.registerContribution(BrowserEditorDevToolsContribution);
class ToggleDevToolsAction extends Action2 {
  static {
    this.ID = BrowserViewCommandId.ToggleDevTools;
  }
  constructor() {
    super({
      id: ToggleDevToolsAction.ID,
      title: localize2("browser.toggleDevToolsAction", "Developer Tools"),
      category: BrowserActionCategory,
      icon: Codicon.developerTools,
      f1: true,
      precondition: ContextKeyExpr.and(BROWSER_EDITOR_ACTIVE, CONTEXT_BROWSER_HAS_URL, CONTEXT_BROWSER_HAS_ERROR.negate()),
      toggled: ContextKeyExpr.equals(CONTEXT_BROWSER_DEVTOOLS_OPEN.key, true),
      menu: {
        id: MenuId.BrowserActionsToolbar,
        group: BrowserActionGroup.Tools,
        order: 2
      },
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyCode.F12
      }
    });
  }
  async run(accessor, browserEditor = accessor.get(IEditorService).activeEditorPane) {
    if (browserEditor instanceof BrowserEditor) {
      await browserEditor.model?.toggleDevTools();
    }
  }
}
registerAction2(ToggleDevToolsAction);
