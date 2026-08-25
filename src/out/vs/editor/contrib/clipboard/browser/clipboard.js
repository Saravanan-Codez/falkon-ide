import * as browser from "../../../../base/browser/browser.js";
import { getActiveDocument, getActiveWindow } from "../../../../base/browser/dom.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import * as platform from "../../../../base/common/platform.js";
import * as nls from "../../../../nls.js";
import { MenuId, MenuRegistry } from "../../../../platform/actions/common/actions.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { CopyOptions, generateDataToCopyAndStoreInMemory, InMemoryClipboardMetadataManager } from "../../../browser/controller/editContext/clipboardUtils.js";
import { NativeEditContextRegistry } from "../../../browser/controller/editContext/native/nativeEditContextRegistry.js";
import { EditorAction, MultiCommand, registerEditorAction } from "../../../browser/editorExtensions.js";
import { ICodeEditorService } from "../../../browser/services/codeEditorService.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { Handler } from "../../../common/editorCommon.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import { CopyPasteController } from "../../dropOrPasteInto/browser/copyPasteController.js";
const CLIPBOARD_CONTEXT_MENU_GROUP = "9_cutcopypaste";
const supportsCut = platform.isNative || document.queryCommandSupported("cut");
const supportsCopy = platform.isNative || document.queryCommandSupported("copy");
const supportsPaste = typeof navigator.clipboard === "undefined" || browser.isFirefox ? document.queryCommandSupported("paste") : true;
function registerCommand(command) {
  command.register();
  return command;
}
const CutAction = supportsCut ? registerCommand(new MultiCommand({
  id: "editor.action.clipboardCutAction",
  precondition: void 0,
  kbOpts: (
    // Do not bind cut keybindings in the browser,
    // since browsers do that for us and it avoids security prompts
    platform.isNative ? {
      primary: KeyMod.CtrlCmd | KeyCode.KeyX,
      win: { primary: KeyMod.CtrlCmd | KeyCode.KeyX, secondary: [KeyMod.Shift | KeyCode.Delete] },
      weight: KeybindingWeight.EditorContrib
    } : void 0
  ),
  menuOpts: [{
    menuId: MenuId.MenubarEditMenu,
    group: "2_ccp",
    title: nls.localize({ key: "miCut", comment: ["&& denotes a mnemonic"] }, "Cu&&t"),
    order: 1
  }, {
    menuId: MenuId.EditorContext,
    group: CLIPBOARD_CONTEXT_MENU_GROUP,
    title: nls.localize("actions.clipboard.cutLabel", "Cut"),
    when: EditorContextKeys.writable,
    order: 1
  }, {
    menuId: MenuId.CommandPalette,
    group: "",
    title: nls.localize("actions.clipboard.cutLabel", "Cut"),
    order: 1
  }, {
    menuId: MenuId.SimpleEditorContext,
    group: CLIPBOARD_CONTEXT_MENU_GROUP,
    title: nls.localize("actions.clipboard.cutLabel", "Cut"),
    when: EditorContextKeys.writable,
    order: 1
  }]
})) : void 0;
const CopyAction = supportsCopy ? registerCommand(new MultiCommand({
  id: "editor.action.clipboardCopyAction",
  precondition: void 0,
  kbOpts: (
    // Do not bind copy keybindings in the browser,
    // since browsers do that for us and it avoids security prompts
    platform.isNative ? {
      primary: KeyMod.CtrlCmd | KeyCode.KeyC,
      win: { primary: KeyMod.CtrlCmd | KeyCode.KeyC, secondary: [KeyMod.CtrlCmd | KeyCode.Insert] },
      weight: KeybindingWeight.EditorContrib
    } : void 0
  ),
  menuOpts: [{
    menuId: MenuId.MenubarEditMenu,
    group: "2_ccp",
    title: nls.localize({ key: "miCopy", comment: ["&& denotes a mnemonic"] }, "&&Copy"),
    order: 2
  }, {
    menuId: MenuId.EditorContext,
    group: CLIPBOARD_CONTEXT_MENU_GROUP,
    title: nls.localize("actions.clipboard.copyLabel", "Copy"),
    order: 2
  }, {
    menuId: MenuId.CommandPalette,
    group: "",
    title: nls.localize("actions.clipboard.copyLabel", "Copy"),
    order: 1
  }, {
    menuId: MenuId.SimpleEditorContext,
    group: CLIPBOARD_CONTEXT_MENU_GROUP,
    title: nls.localize("actions.clipboard.copyLabel", "Copy"),
    order: 2
  }]
})) : void 0;
MenuRegistry.appendMenuItem(MenuId.MenubarEditMenu, { submenu: MenuId.MenubarCopy, title: nls.localize2("copy as", "Copy As"), group: "2_ccp", order: 3 });
MenuRegistry.appendMenuItem(MenuId.EditorContext, { submenu: MenuId.EditorContextCopy, title: nls.localize2("copy as", "Copy As"), group: CLIPBOARD_CONTEXT_MENU_GROUP, order: 3 });
MenuRegistry.appendMenuItem(MenuId.EditorContext, { submenu: MenuId.EditorContextShare, title: nls.localize2("share", "Share"), group: "11_share", order: -1, when: ContextKeyExpr.and(ContextKeyExpr.notEquals("resourceScheme", "output"), EditorContextKeys.editorTextFocus) });
MenuRegistry.appendMenuItem(MenuId.ExplorerContext, { submenu: MenuId.ExplorerContextShare, title: nls.localize2("share", "Share"), group: "11_share", order: -1 });
const PasteAction = supportsPaste ? registerCommand(new MultiCommand({
  id: "editor.action.clipboardPasteAction",
  precondition: void 0,
  kbOpts: (
    // Do not bind paste keybindings in the browser,
    // since browsers do that for us and it avoids security prompts
    platform.isNative ? {
      primary: KeyMod.CtrlCmd | KeyCode.KeyV,
      win: { primary: KeyMod.CtrlCmd | KeyCode.KeyV, secondary: [KeyMod.Shift | KeyCode.Insert] },
      linux: { primary: KeyMod.CtrlCmd | KeyCode.KeyV, secondary: [KeyMod.Shift | KeyCode.Insert] },
      weight: KeybindingWeight.EditorContrib
    } : void 0
  ),
  menuOpts: [{
    menuId: MenuId.MenubarEditMenu,
    group: "2_ccp",
    title: nls.localize({ key: "miPaste", comment: ["&& denotes a mnemonic"] }, "&&Paste"),
    order: 4
  }, {
    menuId: MenuId.EditorContext,
    group: CLIPBOARD_CONTEXT_MENU_GROUP,
    title: nls.localize("actions.clipboard.pasteLabel", "Paste"),
    when: EditorContextKeys.writable,
    order: 4
  }, {
    menuId: MenuId.CommandPalette,
    group: "",
    title: nls.localize("actions.clipboard.pasteLabel", "Paste"),
    order: 1
  }, {
    menuId: MenuId.SimpleEditorContext,
    group: CLIPBOARD_CONTEXT_MENU_GROUP,
    title: nls.localize("actions.clipboard.pasteLabel", "Paste"),
    when: EditorContextKeys.writable,
    order: 4
  }]
})) : void 0;
class ExecCommandCopyWithSyntaxHighlightingAction extends EditorAction {
  constructor() {
    super({
      id: "editor.action.clipboardCopyWithSyntaxHighlightingAction",
      label: nls.localize2("actions.clipboard.copyWithSyntaxHighlightingLabel", "Copy with Syntax Highlighting"),
      precondition: void 0,
      kbOpts: {
        kbExpr: EditorContextKeys.textInputFocus,
        primary: 0,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  run(accessor, editor) {
    const logService = accessor.get(ILogService);
    const clipboardService = accessor.get(IClipboardService);
    logService.trace("ExecCommandCopyWithSyntaxHighlightingAction#run");
    if (!editor.hasModel()) {
      return;
    }
    const emptySelectionClipboard = editor.getOption(EditorOption.emptySelectionClipboard);
    if (!emptySelectionClipboard && editor.getSelection().isEmpty()) {
      return;
    }
    CopyOptions.forceCopyWithSyntaxHighlighting = true;
    editor.focus();
    logService.trace("ExecCommandCopyWithSyntaxHighlightingAction (before execCommand copy)");
    executeClipboardCopyWithWorkaround(editor, clipboardService);
    logService.trace("ExecCommandCopyWithSyntaxHighlightingAction (after execCommand copy)");
    CopyOptions.forceCopyWithSyntaxHighlighting = false;
  }
}
function executeClipboardCopyWithWorkaround(editor, clipboardService) {
  CopyOptions.electronBugWorkaroundCopyEventHasFired = false;
  editor.getContainerDomNode().ownerDocument.execCommand("copy");
  if (platform.isNative && CopyOptions.electronBugWorkaroundCopyEventHasFired === false) {
    const { dataToCopy } = generateDataToCopyAndStoreInMemory(editor._getViewModel(), void 0, browser.isFirefox);
    clipboardService.writeText(dataToCopy.text);
  }
}
function registerExecCommandImpl(target, browserCommand) {
  if (!target) {
    return;
  }
  target.addImplementation(1e4, "code-editor", (accessor, args) => {
    const logService = accessor.get(ILogService);
    const clipboardService = accessor.get(IClipboardService);
    logService.trace("registerExecCommandImpl (addImplementation code-editor for : ", browserCommand, ")");
    const focusedEditor = accessor.get(ICodeEditorService).getFocusedCodeEditor();
    if (focusedEditor && focusedEditor.hasTextFocus() && focusedEditor.hasModel()) {
      const emptySelectionClipboard = focusedEditor.getOption(EditorOption.emptySelectionClipboard);
      const selection = focusedEditor.getSelection();
      if (selection && selection.isEmpty() && !emptySelectionClipboard) {
        return true;
      }
      if (focusedEditor.getOption(EditorOption.effectiveEditContext) && browserCommand === "cut") {
        logCopyCommand(focusedEditor);
        logService.trace("registerExecCommandImpl (before execCommand copy)");
        executeClipboardCopyWithWorkaround(focusedEditor, clipboardService);
        focusedEditor.trigger(void 0, Handler.Cut, void 0);
        logService.trace("registerExecCommandImpl (after execCommand copy)");
      } else {
        logCopyCommand(focusedEditor);
        logService.trace("registerExecCommandImpl (before execCommand " + browserCommand + ")");
        if (browserCommand === "copy") {
          executeClipboardCopyWithWorkaround(focusedEditor, clipboardService);
        } else {
          focusedEditor.getContainerDomNode().ownerDocument.execCommand(browserCommand);
        }
        logService.trace("registerExecCommandImpl (after execCommand " + browserCommand + ")");
      }
      return true;
    }
    return false;
  });
  target.addImplementation(0, "generic-dom", (accessor, args) => {
    const logService = accessor.get(ILogService);
    logService.trace("registerExecCommandImpl (addImplementation generic-dom for : ", browserCommand, ")");
    logService.trace("registerExecCommandImpl (before execCommand " + browserCommand + ")");
    getActiveDocument().execCommand(browserCommand);
    logService.trace("registerExecCommandImpl (after execCommand " + browserCommand + ")");
    return true;
  });
}
function logCopyCommand(editor) {
  const editContextEnabled = editor.getOption(EditorOption.effectiveEditContext);
  if (editContextEnabled) {
    const nativeEditContext = NativeEditContextRegistry.get(editor.getId());
    if (nativeEditContext) {
      nativeEditContext.handleWillCopy();
    }
  }
}
registerExecCommandImpl(CutAction, "cut");
registerExecCommandImpl(CopyAction, "copy");
if (PasteAction) {
  PasteAction.addImplementation(1e4, "code-editor", (accessor, args) => {
    const logService = accessor.get(ILogService);
    logService.trace("registerExecCommandImpl (addImplementation code-editor for : paste)");
    const codeEditorService = accessor.get(ICodeEditorService);
    const clipboardService = accessor.get(IClipboardService);
    const focusedEditor = codeEditorService.getFocusedCodeEditor();
    if (focusedEditor && focusedEditor.hasModel() && focusedEditor.hasTextFocus()) {
      const editContextEnabled = focusedEditor.getOption(EditorOption.effectiveEditContext);
      if (editContextEnabled) {
        const nativeEditContext = NativeEditContextRegistry.get(focusedEditor.getId());
        if (nativeEditContext) {
          nativeEditContext.handleWillPaste();
        }
      }
      logService.trace("registerExecCommandImpl (before triggerPaste)");
      const triggerPaste = clipboardService.triggerPaste(getActiveWindow().vscodeWindowId);
      if (triggerPaste) {
        logService.trace("registerExecCommandImpl (triggerPaste defined)");
        return triggerPaste.then(async () => {
          logService.trace("registerExecCommandImpl (after triggerPaste)");
          return CopyPasteController.get(focusedEditor)?.finishedPaste() ?? Promise.resolve();
        });
      } else {
        logService.trace("registerExecCommandImpl (triggerPaste undefined)");
      }
      if (platform.isWeb) {
        logService.trace("registerExecCommandImpl (Paste handling on web)");
        return (async () => {
          const clipboardText = await clipboardService.readText();
          if (clipboardText !== "") {
            const metadata = InMemoryClipboardMetadataManager.INSTANCE.get(clipboardText);
            let pasteOnNewLine = false;
            let multicursorText = null;
            let mode = null;
            if (metadata) {
              pasteOnNewLine = focusedEditor.getOption(EditorOption.emptySelectionClipboard) && !!metadata.isFromEmptySelection;
              multicursorText = typeof metadata.multicursorText !== "undefined" ? metadata.multicursorText : null;
              mode = metadata.mode;
            }
            logService.trace("registerExecCommandImpl (clipboardText.length : ", clipboardText.length, " id : ", metadata?.id, ")");
            focusedEditor.trigger("keyboard", Handler.Paste, {
              text: clipboardText,
              pasteOnNewLine,
              multicursorText,
              mode
            });
          }
        })();
      }
      return true;
    }
    return false;
  });
  PasteAction.addImplementation(0, "generic-dom", (accessor, args) => {
    const logService = accessor.get(ILogService);
    logService.trace("registerExecCommandImpl (addImplementation generic-dom for : paste)");
    const triggerPaste = accessor.get(IClipboardService).triggerPaste(getActiveWindow().vscodeWindowId);
    return triggerPaste ?? false;
  });
}
if (supportsCopy) {
  registerEditorAction(ExecCommandCopyWithSyntaxHighlightingAction);
}
export {
  CopyAction,
  CutAction,
  PasteAction
};
