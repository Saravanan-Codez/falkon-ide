import { Handler } from "../../../../editor/common/editorCommon.js";
import { localize } from "../../../../nls.js";
import { StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
const terminalCommandPasteDontAskAgainStorageKey = "chat.terminalCommandPaste.dontAskAgain";
function isTerminalCommandInput(value, prefix) {
  return !!prefix && value.startsWith(prefix);
}
function isTerminalCommandPaste(paste) {
  const selectionStartOffset = Math.max(0, Math.min(paste.selectionStartOffset, paste.currentValue.length));
  const selectionEndOffset = Math.max(selectionStartOffset, Math.min(paste.selectionEndOffset, paste.currentValue.length));
  if (paste.currentValue.length !== 0 && selectionStartOffset !== 0) {
    return false;
  }
  const resultingText = paste.currentValue.slice(0, selectionStartOffset) + paste.pastedText + paste.currentValue.slice(selectionEndOffset);
  return resultingText.startsWith(paste.prefix);
}
function isTerminalCommandPasteWarningSuppressed(storageService) {
  return storageService.getBoolean(terminalCommandPasteDontAskAgainStorageKey, StorageScope.APPLICATION, false);
}
async function shouldPasteTerminalCommand(dialogService, storageService, prefix) {
  if (isTerminalCommandPasteWarningSuppressed(storageService)) {
    return "paste";
  }
  const { result } = await dialogService.prompt({
    type: "warning",
    message: localize("terminalCommandPasteWarning", 'The pasted text starts with "{0}", which will run the message as a terminal command when sent. Paste anyway?', prefix),
    buttons: [
      {
        label: localize("paste", "Paste"),
        run: () => "paste"
      },
      {
        label: localize("pasteAndDontAskAgain", "Paste and Don't Ask Again"),
        run: () => "pasteAndDontAskAgain"
      }
    ],
    custom: true,
    cancelButton: true
  });
  if (result === "pasteAndDontAskAgain") {
    storageService.store(terminalCommandPasteDontAskAgainStorageKey, true, StorageScope.APPLICATION, StorageTarget.USER);
    return "paste";
  }
  return result === "paste" ? "paste" : "cancel";
}
function handleTerminalCommandPaste(e, editor, prefix, dialogService, storageService) {
  if (e.defaultPrevented || !prefix) {
    return;
  }
  const pastedText = e.clipboardData?.getData("text");
  const model = editor.getModel();
  const selection = editor.getSelection();
  if (!pastedText || !model || !selection) {
    return;
  }
  const paste = {
    prefix,
    pastedText,
    currentValue: model.getValue(),
    selectionStartOffset: model.getOffsetAt(selection.getStartPosition()),
    selectionEndOffset: model.getOffsetAt(selection.getEndPosition())
  };
  if (!isTerminalCommandPaste(paste) || isTerminalCommandPasteWarningSuppressed(storageService)) {
    return;
  }
  e.preventDefault();
  e.stopImmediatePropagation();
  shouldPasteTerminalCommand(dialogService, storageService, prefix).then((result) => {
    if (result === "paste") {
      editor.trigger("keyboard", Handler.Paste, { text: pastedText });
    }
  });
}
export {
  handleTerminalCommandPaste,
  isTerminalCommandInput
};
