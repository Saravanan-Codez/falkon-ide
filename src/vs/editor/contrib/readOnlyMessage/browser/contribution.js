import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { EditorContributionInstantiation, registerEditorContribution } from "../../../browser/editorExtensions.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { MessageController } from "../../message/browser/messageController.js";
import * as nls from "../../../../nls.js";
class ReadOnlyMessageController extends Disposable {
  constructor(editor) {
    super();
    this.editor = editor;
    this._register(this.editor.onDidAttemptReadOnlyEdit(() => this._onDidAttemptReadOnlyEdit()));
  }
  static {
    this.ID = "editor.contrib.readOnlyMessageController";
  }
  _onDidAttemptReadOnlyEdit() {
    const messageController = MessageController.get(this.editor);
    if (messageController && this.editor.hasModel()) {
      let message = this.editor.getOptions().get(EditorOption.readOnlyMessage);
      if (!message) {
        if (this.editor.isSimpleWidget) {
          message = new MarkdownString(nls.localize("editor.simple.readonly", "Cannot edit in read-only input"));
        } else {
          message = new MarkdownString(nls.localize("editor.readonly", "Cannot edit in read-only editor"));
        }
      }
      messageController.showMessage(message, this.editor.getPosition());
    }
  }
}
registerEditorContribution(ReadOnlyMessageController.ID, ReadOnlyMessageController, EditorContributionInstantiation.BeforeFirstInteraction);
export {
  ReadOnlyMessageController
};
