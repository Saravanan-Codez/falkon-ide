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
import { isNonEmptyArray } from "../../../../base/common/arrays.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { KeyChord, KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { EditorAction, EditorContributionInstantiation, registerEditorAction, registerEditorContribution } from "../../../browser/editorExtensions.js";
import { ICodeEditorService } from "../../../browser/services/codeEditorService.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { CharacterSet } from "../../../common/core/characterClassifier.js";
import { Range } from "../../../common/core/range.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import { IEditorWorkerService } from "../../../common/services/editorWorker.js";
import { ILanguageFeaturesService } from "../../../common/services/languageFeatures.js";
import { formatDocumentRangesWithSelectedProvider, formatDocumentWithSelectedProvider, FormattingMode, getOnTypeFormattingEdits } from "./format.js";
import { FormattingEdit } from "./formattingEdit.js";
import * as nls from "../../../../nls.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { CommandsRegistry, ICommandService } from "../../../../platform/commands/common/commands.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IEditorProgressService, Progress } from "../../../../platform/progress/common/progress.js";
let FormatOnType = class {
  constructor(_editor, _languageFeaturesService, _workerService, _accessibilitySignalService) {
    this._editor = _editor;
    this._languageFeaturesService = _languageFeaturesService;
    this._workerService = _workerService;
    this._accessibilitySignalService = _accessibilitySignalService;
    this._disposables = new DisposableStore();
    this._sessionDisposables = new DisposableStore();
    this._disposables.add(_languageFeaturesService.onTypeFormattingEditProvider.onDidChange(this._update, this));
    this._disposables.add(_editor.onDidChangeModel(() => this._update()));
    this._disposables.add(_editor.onDidChangeModelLanguage(() => this._update()));
    this._disposables.add(_editor.onDidChangeConfiguration((e) => {
      if (e.hasChanged(EditorOption.formatOnType)) {
        this._update();
      }
    }));
    this._update();
  }
  static {
    this.ID = "editor.contrib.autoFormat";
  }
  dispose() {
    this._disposables.dispose();
    this._sessionDisposables.dispose();
  }
  _update() {
    this._sessionDisposables.clear();
    if (!this._editor.getOption(EditorOption.formatOnType)) {
      return;
    }
    if (!this._editor.hasModel()) {
      return;
    }
    const model = this._editor.getModel();
    const [support] = this._languageFeaturesService.onTypeFormattingEditProvider.ordered(model);
    if (!support || !support.autoFormatTriggerCharacters) {
      return;
    }
    const triggerChars = new CharacterSet();
    for (const ch of support.autoFormatTriggerCharacters) {
      triggerChars.add(ch.charCodeAt(0));
    }
    this._sessionDisposables.add(this._editor.onDidType((text) => {
      const lastCharCode = text.charCodeAt(text.length - 1);
      if (triggerChars.has(lastCharCode)) {
        this._trigger(String.fromCharCode(lastCharCode));
      }
    }));
  }
  _trigger(ch) {
    if (!this._editor.hasModel()) {
      return;
    }
    if (this._editor.getSelections().length > 1 || !this._editor.getSelection().isEmpty()) {
      return;
    }
    const model = this._editor.getModel();
    const position = this._editor.getPosition();
    const cts = new CancellationTokenSource();
    const unbind = this._editor.onDidChangeModelContent((e) => {
      if (e.isFlush) {
        cts.cancel();
        unbind.dispose();
        return;
      }
      for (let i = 0, len = e.changes.length; i < len; i++) {
        const change = e.changes[i];
        if (change.range.endLineNumber <= position.lineNumber) {
          cts.cancel();
          unbind.dispose();
          return;
        }
      }
    });
    getOnTypeFormattingEdits(
      this._workerService,
      this._languageFeaturesService,
      model,
      position,
      ch,
      model.getFormattingOptions(),
      cts.token
    ).then((edits) => {
      if (cts.token.isCancellationRequested) {
        return;
      }
      if (isNonEmptyArray(edits)) {
        this._accessibilitySignalService.playSignal(AccessibilitySignal.format, { userGesture: false });
        FormattingEdit.execute(this._editor, edits, true);
      }
    }).finally(() => {
      unbind.dispose();
    });
  }
};
FormatOnType = __decorateClass([
  __decorateParam(1, ILanguageFeaturesService),
  __decorateParam(2, IEditorWorkerService),
  __decorateParam(3, IAccessibilitySignalService)
], FormatOnType);
let FormatOnPaste = class {
  constructor(editor, _languageFeaturesService, _instantiationService) {
    this.editor = editor;
    this._languageFeaturesService = _languageFeaturesService;
    this._instantiationService = _instantiationService;
    this._callOnDispose = new DisposableStore();
    this._callOnModel = new DisposableStore();
    this._callOnDispose.add(editor.onDidChangeConfiguration(() => this._update()));
    this._callOnDispose.add(editor.onDidChangeModel(() => this._update()));
    this._callOnDispose.add(editor.onDidChangeModelLanguage(() => this._update()));
    this._callOnDispose.add(_languageFeaturesService.documentRangeFormattingEditProvider.onDidChange(this._update, this));
  }
  static {
    this.ID = "editor.contrib.formatOnPaste";
  }
  dispose() {
    this._callOnDispose.dispose();
    this._callOnModel.dispose();
  }
  _update() {
    this._callOnModel.clear();
    if (!this.editor.getOption(EditorOption.formatOnPaste)) {
      return;
    }
    if (!this.editor.hasModel()) {
      return;
    }
    if (!this._languageFeaturesService.documentRangeFormattingEditProvider.has(this.editor.getModel())) {
      return;
    }
    this._callOnModel.add(this.editor.onDidPaste(({ range }) => this._trigger(range)));
  }
  _trigger(range) {
    if (!this.editor.hasModel()) {
      return;
    }
    if (this.editor.getSelections().length > 1) {
      return;
    }
    this._instantiationService.invokeFunction(formatDocumentRangesWithSelectedProvider, this.editor, range, FormattingMode.Silent, Progress.None, CancellationToken.None, false).catch(onUnexpectedError);
  }
};
FormatOnPaste = __decorateClass([
  __decorateParam(1, ILanguageFeaturesService),
  __decorateParam(2, IInstantiationService)
], FormatOnPaste);
class FormatDocumentAction extends EditorAction {
  constructor() {
    super({
      id: "editor.action.formatDocument",
      label: nls.localize2("formatDocument.label", "Format Document"),
      precondition: ContextKeyExpr.and(EditorContextKeys.notInCompositeEditor, EditorContextKeys.writable, EditorContextKeys.hasDocumentFormattingProvider),
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyMod.Shift | KeyMod.Alt | KeyCode.KeyF,
        linux: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyI },
        weight: KeybindingWeight.EditorContrib
      },
      contextMenuOpts: {
        group: "1_modification",
        order: 1.3
      }
    });
  }
  async run(accessor, editor) {
    if (editor.hasModel()) {
      const instaService = accessor.get(IInstantiationService);
      const progressService = accessor.get(IEditorProgressService);
      await progressService.showWhile(
        instaService.invokeFunction(formatDocumentWithSelectedProvider, editor, FormattingMode.Explicit, Progress.None, CancellationToken.None, true),
        250
      );
    }
  }
}
class FormatSelectionAction extends EditorAction {
  constructor() {
    super({
      id: "editor.action.formatSelection",
      label: nls.localize2("formatSelection.label", "Format Selection"),
      precondition: ContextKeyExpr.and(EditorContextKeys.writable, EditorContextKeys.hasDocumentSelectionFormattingProvider),
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyF),
        weight: KeybindingWeight.EditorContrib
      },
      contextMenuOpts: {
        when: EditorContextKeys.hasNonEmptySelection,
        group: "1_modification",
        order: 1.31
      }
    });
  }
  async run(accessor, editor) {
    if (!editor.hasModel()) {
      return;
    }
    const instaService = accessor.get(IInstantiationService);
    const model = editor.getModel();
    const ranges = editor.getSelections().map((range) => {
      return range.isEmpty() ? new Range(range.startLineNumber, 1, range.startLineNumber, model.getLineMaxColumn(range.startLineNumber)) : range;
    });
    const progressService = accessor.get(IEditorProgressService);
    await progressService.showWhile(
      instaService.invokeFunction(formatDocumentRangesWithSelectedProvider, editor, ranges, FormattingMode.Explicit, Progress.None, CancellationToken.None, true),
      250
    );
  }
}
registerEditorContribution(FormatOnType.ID, FormatOnType, EditorContributionInstantiation.BeforeFirstInteraction);
registerEditorContribution(FormatOnPaste.ID, FormatOnPaste, EditorContributionInstantiation.BeforeFirstInteraction);
registerEditorAction(FormatDocumentAction);
registerEditorAction(FormatSelectionAction);
CommandsRegistry.registerCommand("editor.action.format", async (accessor) => {
  const editor = accessor.get(ICodeEditorService).getFocusedCodeEditor();
  if (!editor || !editor.hasModel()) {
    return;
  }
  const commandService = accessor.get(ICommandService);
  if (editor.getSelection().isEmpty()) {
    await commandService.executeCommand("editor.action.formatDocument");
  } else {
    await commandService.executeCommand("editor.action.formatSelection");
  }
});
export {
  FormatOnType
};
