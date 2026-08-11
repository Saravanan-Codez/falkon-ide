import { EditorAction, registerEditorAction } from "../../../browser/editorExtensions.js";
import { InsertFinalNewLineCommand } from "./insertFinalNewLineCommand.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import * as nls from "../../../../nls.js";
class InsertFinalNewLineAction extends EditorAction {
  static {
    this.ID = "editor.action.insertFinalNewLine";
  }
  constructor() {
    super({
      id: InsertFinalNewLineAction.ID,
      label: nls.localize2("insertFinalNewLine", "Insert Final New Line"),
      precondition: EditorContextKeys.writable
    });
  }
  run(_accessor, editor, args) {
    const selection = editor.getSelection();
    if (selection === null) {
      return;
    }
    const command = new InsertFinalNewLineCommand(selection);
    editor.pushUndoStop();
    editor.executeCommands(this.id, [command]);
    editor.pushUndoStop();
  }
}
registerEditorAction(InsertFinalNewLineAction);
export {
  InsertFinalNewLineAction
};
