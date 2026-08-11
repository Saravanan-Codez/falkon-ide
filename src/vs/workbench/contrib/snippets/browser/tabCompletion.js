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
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { RawContextKey, IContextKeyService, ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ISnippetsService } from "./snippets.js";
import { getNonWhitespacePrefix } from "./snippetsService.js";
import { Range } from "../../../../editor/common/core/range.js";
import { registerEditorContribution, EditorCommand, registerEditorCommand, EditorContributionInstantiation } from "../../../../editor/browser/editorExtensions.js";
import { SnippetController2 } from "../../../../editor/contrib/snippet/browser/snippetController2.js";
import { showSimpleSuggestions } from "../../../../editor/contrib/suggest/browser/suggest.js";
import { EditorContextKeys } from "../../../../editor/common/editorContextKeys.js";
import { SnippetCompletion } from "./snippetCompletionProvider.js";
import { EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { EditorState, CodeEditorStateFlag } from "../../../../editor/contrib/editorState/browser/editorState.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
let TabCompletionController = class {
  constructor(_editor, _snippetService, _clipboardService, _languageFeaturesService, contextKeyService) {
    this._editor = _editor;
    this._snippetService = _snippetService;
    this._clipboardService = _clipboardService;
    this._languageFeaturesService = _languageFeaturesService;
    this._activeSnippets = [];
    this._hasSnippets = TabCompletionController.ContextKey.bindTo(contextKeyService);
    this._configListener = this._editor.onDidChangeConfiguration((e) => {
      if (e.hasChanged(EditorOption.tabCompletion)) {
        this._update();
      }
    });
    this._update();
  }
  static {
    this.ID = "editor.tabCompletionController";
  }
  static {
    this.ContextKey = new RawContextKey("hasSnippetCompletions", void 0);
  }
  static get(editor) {
    return editor.getContribution(TabCompletionController.ID);
  }
  dispose() {
    this._configListener.dispose();
    this._selectionListener?.dispose();
  }
  _update() {
    const enabled = this._editor.getOption(EditorOption.tabCompletion) === "onlySnippets";
    if (this._enabled !== enabled) {
      this._enabled = enabled;
      if (!this._enabled) {
        this._selectionListener?.dispose();
      } else {
        this._selectionListener = this._editor.onDidChangeCursorSelection((e) => this._updateSnippets());
        if (this._editor.getModel()) {
          this._updateSnippets();
        }
      }
    }
  }
  _updateSnippets() {
    this._activeSnippets = [];
    this._completionProvider?.dispose();
    if (!this._editor.hasModel()) {
      return;
    }
    const selection = this._editor.getSelection();
    const model = this._editor.getModel();
    model.tokenization.tokenizeIfCheap(selection.positionLineNumber);
    const id = model.getLanguageIdAtPosition(selection.positionLineNumber, selection.positionColumn);
    const snippets = this._snippetService.getSnippetsSync(id, model.uri);
    if (!snippets) {
      this._hasSnippets.set(false);
      return;
    }
    if (Range.isEmpty(selection)) {
      const prefix = getNonWhitespacePrefix(model, selection.getPosition());
      if (prefix) {
        for (const snippet of snippets) {
          if (prefix.endsWith(snippet.prefix)) {
            this._activeSnippets.push(snippet);
          }
        }
      }
    } else if (!Range.spansMultipleLines(selection) && model.getValueLengthInRange(selection) <= 100) {
      const selected = model.getValueInRange(selection);
      if (selected) {
        for (const snippet of snippets) {
          if (selected === snippet.prefix) {
            this._activeSnippets.push(snippet);
          }
        }
      }
    }
    const len = this._activeSnippets.length;
    if (len === 0) {
      this._hasSnippets.set(false);
    } else if (len === 1) {
      this._hasSnippets.set(true);
    } else {
      this._hasSnippets.set(true);
      this._completionProvider = {
        _debugDisplayName: "tabCompletion",
        dispose: () => {
          registration.dispose();
        },
        provideCompletionItems: (_model, position) => {
          if (_model !== model || !selection.containsPosition(position)) {
            return;
          }
          const suggestions = this._activeSnippets.map((snippet) => {
            const range = Range.fromPositions(position.delta(0, -snippet.prefix.length), position);
            return new SnippetCompletion(snippet, range);
          });
          return { suggestions };
        }
      };
      const registration = this._languageFeaturesService.completionProvider.register(
        { language: model.getLanguageId(), pattern: model.uri.fsPath, scheme: model.uri.scheme },
        this._completionProvider
      );
    }
  }
  async performSnippetCompletions() {
    if (!this._editor.hasModel()) {
      return;
    }
    if (this._activeSnippets.length === 1) {
      const [snippet] = this._activeSnippets;
      let clipboardText;
      if (snippet.needsClipboard) {
        const state = new EditorState(this._editor, CodeEditorStateFlag.Value | CodeEditorStateFlag.Position);
        clipboardText = await this._clipboardService.readText();
        if (!state.validate(this._editor)) {
          return;
        }
      }
      SnippetController2.get(this._editor)?.insert(snippet.codeSnippet, {
        overwriteBefore: snippet.prefix.length,
        overwriteAfter: 0,
        clipboardText
      });
    } else if (this._activeSnippets.length > 1) {
      if (this._completionProvider) {
        showSimpleSuggestions(this._editor, this._completionProvider);
      }
    }
  }
};
TabCompletionController = __decorateClass([
  __decorateParam(1, ISnippetsService),
  __decorateParam(2, IClipboardService),
  __decorateParam(3, ILanguageFeaturesService),
  __decorateParam(4, IContextKeyService)
], TabCompletionController);
registerEditorContribution(TabCompletionController.ID, TabCompletionController, EditorContributionInstantiation.Eager);
const TabCompletionCommand = EditorCommand.bindToContribution(TabCompletionController.get);
registerEditorCommand(new TabCompletionCommand({
  id: "insertSnippet",
  precondition: TabCompletionController.ContextKey,
  handler: (x) => x.performSnippetCompletions(),
  kbOpts: {
    weight: KeybindingWeight.EditorContrib,
    kbExpr: ContextKeyExpr.and(
      EditorContextKeys.editorTextFocus,
      EditorContextKeys.tabDoesNotMoveFocus,
      SnippetController2.InSnippetMode.toNegated()
    ),
    primary: KeyCode.Tab
  }
}));
export {
  TabCompletionController
};
