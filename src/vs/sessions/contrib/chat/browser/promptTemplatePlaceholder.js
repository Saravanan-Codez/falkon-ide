import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { MouseTargetType } from "../../../../editor/browser/editorBrowser.js";
import { Selection } from "../../../../editor/common/core/selection.js";
import { localize } from "../../../../nls.js";
import { RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
const REPLACE_PROMPT_TEMPLATE_PLACEHOLDER_COMMAND_ID = "sessions.chat.replacePromptTemplatePlaceholder";
const PromptTemplatePlaceholderFocused = new RawContextKey("sessionsPromptTemplatePlaceholderFocused", false, localize("sessionsPromptTemplatePlaceholderFocused", "Whether the caret is inside an editable prompt template placeholder."));
let activePromptTemplatePlaceholderController;
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: REPLACE_PROMPT_TEMPLATE_PLACEHOLDER_COMMAND_ID,
  weight: KeybindingWeight.WorkbenchContrib + 2,
  when: PromptTemplatePlaceholderFocused,
  primary: KeyCode.Enter,
  handler: () => activePromptTemplatePlaceholderController?.replaceAtCursor()
});
class PromptTemplatePlaceholderController extends Disposable {
  constructor(_editor, _onWillReplace) {
    super();
    this._editor = _editor;
    this._onWillReplace = _onWillReplace;
    this._wasPresent = false;
    this._decorations = this._editor.createDecorationsCollection();
    this._focusedContextKey = PromptTemplatePlaceholderFocused.bindTo(this._editor.contextKeyService);
    this._register(toDisposable(() => this._decorations.clear()));
    this._register(toDisposable(() => {
      this._focusedContextKey.reset();
      if (activePromptTemplatePlaceholderController === this) {
        activePromptTemplatePlaceholderController = void 0;
      }
    }));
    this._register(this._editor.onDidChangeModelContent(() => {
      this._updateDecorations();
      this._updateActiveState();
    }));
    this._register(this._editor.onDidChangeCursorPosition(() => this._updateActiveState()));
    this._register(this._editor.onDidFocusEditorWidget(() => this._updateActiveState()));
    this._register(this._editor.onDidBlurEditorWidget(() => this._updateActiveState()));
    this._register(this._editor.onMouseUp((event) => {
      if (!event.event.leftButton || event.target.type !== MouseTargetType.CONTENT_TEXT || !this._editor.getSelection()?.isEmpty()) {
        return;
      }
      this.replaceAt(event.target.position);
    }));
  }
  static {
    this._className = "sessions-prompt-template-placeholder";
  }
  setPlaceholder(placeholder) {
    this._placeholder = placeholder;
    this._wasPresent = false;
    this._updateDecorations();
    this._updateActiveState();
  }
  replaceAtCursor() {
    const position = this._editor.getPosition();
    return position ? this.replaceAt(position) : false;
  }
  replaceAt(position) {
    if (!this._contains(position)) {
      return false;
    }
    this._onWillReplace();
    const model = this._editor.getModel();
    const range = this._decorations.getRange(0);
    if (!model || !range || !this._placeholder || !this._contains(position) || model.getValueInRange(range) !== this._placeholder) {
      return false;
    }
    const start = range.getStartPosition();
    this._editor.pushUndoStop();
    const edited = this._editor.executeEdits("sessions.promptTemplatePlaceholder", [{ range, text: "" }], [Selection.fromPositions(start)]);
    if (edited) {
      this._editor.pushUndoStop();
      this._editor.focus();
    }
    this._updateActiveState();
    return edited;
  }
  _updateActiveState() {
    const position = this._editor.getPosition();
    const active = this._editor.hasTextFocus() && !!position && this._contains(position);
    this._focusedContextKey.set(active);
    if (active) {
      activePromptTemplatePlaceholderController = this;
    } else if (activePromptTemplatePlaceholderController === this) {
      activePromptTemplatePlaceholderController = void 0;
    }
  }
  _contains(position) {
    const model = this._editor.getModel();
    const range = this._decorations.getRange(0);
    if (!model || !range) {
      return false;
    }
    const offset = model.getOffsetAt(position);
    return offset >= model.getOffsetAt(range.getStartPosition()) && offset < model.getOffsetAt(range.getEndPosition());
  }
  _updateDecorations() {
    const model = this._editor.getModel();
    const match = this._placeholder && model ? model.findMatches(this._placeholder, model.getFullModelRange(), false, true, null, false, 1)[0] : void 0;
    if (!match) {
      this._decorations.clear();
      if (this._wasPresent) {
        this._placeholder = void 0;
      }
      return;
    }
    this._wasPresent = true;
    this._decorations.set([{
      range: match.range,
      options: {
        description: "sessions-prompt-template-placeholder",
        inlineClassName: PromptTemplatePlaceholderController._className,
        hoverMessage: { value: localize("sessions.promptTemplatePlaceholder.hover", "Click or place the caret here and press Enter to describe the coding task") }
      }
    }]);
  }
}
export {
  PromptTemplatePlaceholderController,
  REPLACE_PROMPT_TEMPLATE_PLACEHOLDER_COMMAND_ID
};
