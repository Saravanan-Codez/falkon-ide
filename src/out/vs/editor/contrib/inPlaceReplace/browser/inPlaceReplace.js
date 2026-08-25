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
import { createCancelablePromise, timeout } from "../../../../base/common/async.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { CodeEditorStateFlag, EditorState } from "../../editorState/browser/editorState.js";
import { EditorAction, EditorContributionInstantiation, registerEditorAction, registerEditorContribution } from "../../../browser/editorExtensions.js";
import { Range } from "../../../common/core/range.js";
import { Selection } from "../../../common/core/selection.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import { ModelDecorationOptions } from "../../../common/model/textModel.js";
import { IEditorWorkerService } from "../../../common/services/editorWorker.js";
import * as nls from "../../../../nls.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { InPlaceReplaceCommand } from "./inPlaceReplaceCommand.js";
import "./inPlaceReplace.css";
let InPlaceReplaceController = class {
  static {
    this.ID = "editor.contrib.inPlaceReplaceController";
  }
  static get(editor) {
    return editor.getContribution(InPlaceReplaceController.ID);
  }
  static {
    this.DECORATION = ModelDecorationOptions.register({
      description: "in-place-replace",
      className: "valueSetReplacement"
    });
  }
  constructor(editor, editorWorkerService) {
    this.editor = editor;
    this.editorWorkerService = editorWorkerService;
    this.decorations = this.editor.createDecorationsCollection();
  }
  dispose() {
  }
  run(source, up) {
    this.currentRequest?.cancel();
    const editorSelection = this.editor.getSelection();
    const model = this.editor.getModel();
    if (!model || !editorSelection) {
      return void 0;
    }
    let selection = editorSelection;
    if (selection.startLineNumber !== selection.endLineNumber) {
      return void 0;
    }
    const state = new EditorState(this.editor, CodeEditorStateFlag.Value | CodeEditorStateFlag.Position);
    const modelURI = model.uri;
    if (!this.editorWorkerService.canNavigateValueSet(modelURI)) {
      return Promise.resolve(void 0);
    }
    this.currentRequest = createCancelablePromise((token) => this.editorWorkerService.navigateValueSet(modelURI, selection, up));
    return this.currentRequest.then((result) => {
      if (!result || !result.range || !result.value) {
        return;
      }
      if (!state.validate(this.editor)) {
        return;
      }
      const editRange = Range.lift(result.range);
      let highlightRange = result.range;
      const diff = result.value.length - (selection.endColumn - selection.startColumn);
      highlightRange = {
        startLineNumber: highlightRange.startLineNumber,
        startColumn: highlightRange.startColumn,
        endLineNumber: highlightRange.endLineNumber,
        endColumn: highlightRange.startColumn + result.value.length
      };
      if (diff > 1) {
        selection = new Selection(selection.startLineNumber, selection.startColumn, selection.endLineNumber, selection.endColumn + diff - 1);
      }
      const command = new InPlaceReplaceCommand(editRange, selection, result.value);
      this.editor.pushUndoStop();
      this.editor.executeCommand(source, command);
      this.editor.pushUndoStop();
      this.decorations.set([{
        range: highlightRange,
        options: InPlaceReplaceController.DECORATION
      }]);
      this.decorationRemover?.cancel();
      this.decorationRemover = timeout(350);
      this.decorationRemover.then(() => this.decorations.clear()).catch(onUnexpectedError);
    }).catch(onUnexpectedError);
  }
};
InPlaceReplaceController = __decorateClass([
  __decorateParam(1, IEditorWorkerService)
], InPlaceReplaceController);
class InPlaceReplaceUp extends EditorAction {
  constructor() {
    super({
      id: "editor.action.inPlaceReplace.up",
      label: nls.localize2("InPlaceReplaceAction.previous.label", "Replace with Previous Value"),
      precondition: EditorContextKeys.writable,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Comma,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  run(accessor, editor) {
    const controller = InPlaceReplaceController.get(editor);
    if (!controller) {
      return Promise.resolve(void 0);
    }
    return controller.run(this.id, false);
  }
}
class InPlaceReplaceDown extends EditorAction {
  constructor() {
    super({
      id: "editor.action.inPlaceReplace.down",
      label: nls.localize2("InPlaceReplaceAction.next.label", "Replace with Next Value"),
      precondition: EditorContextKeys.writable,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Period,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  run(accessor, editor) {
    const controller = InPlaceReplaceController.get(editor);
    if (!controller) {
      return Promise.resolve(void 0);
    }
    return controller.run(this.id, true);
  }
}
registerEditorContribution(InPlaceReplaceController.ID, InPlaceReplaceController, EditorContributionInstantiation.Lazy);
registerEditorAction(InPlaceReplaceUp);
registerEditorAction(InPlaceReplaceDown);
