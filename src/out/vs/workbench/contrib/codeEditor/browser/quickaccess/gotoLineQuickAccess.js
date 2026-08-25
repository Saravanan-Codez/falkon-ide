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
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { IEditorService, SIDE_GROUP } from "../../../../services/editor/common/editorService.js";
import { AbstractGotoLineQuickAccessProvider } from "../../../../../editor/contrib/quickAccess/browser/gotoLineQuickAccess.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { Extensions as QuickAccessExtensions } from "../../../../../platform/quickinput/common/quickAccess.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { Action2, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { KeyMod, KeyCode } from "../../../../../base/common/keyCodes.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IStorageService } from "../../../../../platform/storage/common/storage.js";
let GotoLineQuickAccessProvider = class extends AbstractGotoLineQuickAccessProvider {
  constructor(editorService, configurationService, storageService) {
    super();
    this.editorService = editorService;
    this.configurationService = configurationService;
    this.storageService = storageService;
    this.onDidActiveTextEditorControlChange = this.editorService.onDidActiveEditorChange;
  }
  get configuration() {
    const editorConfig = this.configurationService.getValue().workbench?.editor;
    return {
      openEditorPinned: !editorConfig?.enablePreviewFromQuickOpen || !editorConfig?.enablePreview
    };
  }
  get activeTextEditorControl() {
    return this.editorService.activeTextEditorControl;
  }
  gotoLocation(context, options) {
    if ((options.keyMods.alt || this.configuration.openEditorPinned && options.keyMods.ctrlCmd || options.forceSideBySide) && this.editorService.activeEditor) {
      context.restoreViewState?.();
      const editorOptions = {
        selection: options.range,
        pinned: options.keyMods.ctrlCmd || this.configuration.openEditorPinned,
        preserveFocus: options.preserveFocus
      };
      this.editorService.openEditor(this.editorService.activeEditor, editorOptions, SIDE_GROUP);
    } else {
      super.gotoLocation(context, options);
    }
  }
};
GotoLineQuickAccessProvider = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IStorageService)
], GotoLineQuickAccessProvider);
class GotoLineAction extends Action2 {
  static {
    this.ID = "workbench.action.gotoLine";
  }
  constructor() {
    super({
      id: GotoLineAction.ID,
      title: localize2("gotoLine", "Go to Line/Column..."),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: null,
        primary: KeyMod.CtrlCmd | KeyCode.KeyG,
        mac: { primary: KeyMod.WinCtrl | KeyCode.KeyG }
      }
    });
  }
  async run(accessor) {
    accessor.get(IQuickInputService).quickAccess.show(GotoLineQuickAccessProvider.GO_TO_LINE_PREFIX);
  }
}
registerAction2(GotoLineAction);
Registry.as(QuickAccessExtensions.Quickaccess).registerQuickAccessProvider({
  ctor: GotoLineQuickAccessProvider,
  prefix: AbstractGotoLineQuickAccessProvider.GO_TO_LINE_PREFIX,
  placeholder: localize("gotoLineQuickAccessPlaceholder", "Type the line number and optional column to go to (e.g. :42:5 for line 42, column 5). Type :: to go to a character offset (e.g. ::1024 for character 1024 from the start of the file). Use negative values to navigate backwards."),
  helpEntries: [{ description: localize("gotoLineQuickAccess", "Go to Line/Column"), commandId: GotoLineAction.ID }]
});
class GotoOffsetAction extends Action2 {
  static {
    this.ID = "workbench.action.gotoOffset";
  }
  constructor() {
    super({
      id: GotoOffsetAction.ID,
      title: localize2("gotoOffset", "Go to Offset..."),
      f1: true
    });
  }
  async run(accessor) {
    accessor.get(IQuickInputService).quickAccess.show(GotoLineQuickAccessProvider.GO_TO_OFFSET_PREFIX);
  }
}
registerAction2(GotoOffsetAction);
Registry.as(QuickAccessExtensions.Quickaccess).registerQuickAccessProvider({
  ctor: GotoLineQuickAccessProvider,
  prefix: GotoLineQuickAccessProvider.GO_TO_OFFSET_PREFIX,
  placeholder: localize("gotoLineQuickAccessPlaceholder", "Type the line number and optional column to go to (e.g. :42:5 for line 42, column 5). Type :: to go to a character offset (e.g. ::1024 for character 1024 from the start of the file). Use negative values to navigate backwards."),
  helpEntries: [{ description: localize("gotoOffsetQuickAccess", "Go to Offset"), commandId: GotoOffsetAction.ID }]
});
export {
  GotoLineQuickAccessProvider
};
