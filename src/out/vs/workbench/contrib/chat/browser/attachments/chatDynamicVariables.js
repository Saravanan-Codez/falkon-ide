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
import { coalesce } from "../../../../../base/common/arrays.js";
import { Emitter } from "../../../../../base/common/event.js";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { Disposable, dispose, isDisposable, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { URI } from "../../../../../base/common/uri.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { isLocation } from "../../../../../editor/common/languages.js";
import { Action2, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { IChatRequestVariableEntry, isImageVariableEntry } from "../../common/attachments/chatVariableEntries.js";
import { toAttachedContextDynamicVariable } from "../../common/attachments/chatVariables.js";
const dynamicVariableDecorationType = "chat-dynamic-variable";
let ChatDynamicVariableModel = class extends Disposable {
  constructor(widget, labelService) {
    super();
    this.widget = widget;
    this.labelService = labelService;
    this._variables = [];
    this._onDidChangeReferences = this._register(new Emitter());
    /**
     * Fires whenever the set of dynamic-variable references changes (added,
     * removed, moved, or restored). Consumers that render UI derived from the
     * references should listen to this instead of relying on
     * `onDidChangeParsedInput`, which does not fire when a reference is added
     * without changing the parsed request (e.g. a `/command` reference that the
     * parser resolves as a slash-prompt part).
     */
    this.onDidChangeReferences = this._onDidChangeReferences.event;
    this.decorationData = [];
    this._editorListener = this._register(new MutableDisposable());
    this._subscribeToEditor();
    this._register(widget.onDidChangeActiveInputEditor(() => {
      this._subscribeToEditor();
      this.updateDecorations();
    }));
    this._register(widget.input.attachmentModel.onDidChange(() => this.updateDecorations()));
  }
  static {
    this.ID = "chatDynamicVariableModel";
  }
  get variables() {
    return [...this._variables];
  }
  get id() {
    return ChatDynamicVariableModel.ID;
  }
  _subscribeToEditor() {
    this._editorListener.value = this.widget.inputEditor.onDidChangeModelContent((e) => {
      const removed = [];
      let didChange = false;
      this._variables = coalesce(this._variables.map((ref, idx) => {
        const model = this.widget.inputEditor.getModel();
        if (!model) {
          removed.push(ref);
          return null;
        }
        const data = this.decorationData[idx];
        if (!data) {
          removed.push(ref);
          return null;
        }
        const newRange = model.getDecorationRange(data.id);
        if (!newRange) {
          removed.push(ref);
          return null;
        }
        const newText = model.getValueInRange(newRange);
        if (newText !== data.text) {
          const replacement = e.changes.find(
            (change) => change.rangeOffset <= data.rangeOffset && change.rangeOffset + change.rangeLength >= data.rangeOffset + data.text.length
          );
          const preservedRange = replacement && this.findReferenceRangeInReplacement(model, e.changes, replacement, data);
          if (preservedRange) {
            didChange = true;
            return { ...ref, range: preservedRange };
          }
          if (!replacement) {
            this.widget.inputEditor.executeEdits(this.id, [{
              range: newRange,
              text: ""
            }]);
            this.widget.refreshParsedInput();
          }
          removed.push(ref);
          return null;
        }
        if (newRange.equalsRange(ref.range)) {
          return ref;
        }
        didChange = true;
        return { ...ref, range: newRange };
      }));
      dispose(removed.filter(isDisposable));
      if (didChange || removed.length > 0) {
        this.widget.refreshParsedInput();
        this._onDidChangeReferences.fire();
      }
      this.updateDecorations();
    });
  }
  findReferenceRangeInReplacement(model, changes, replacement, data) {
    if (!data.text) {
      return void 0;
    }
    const previousRelativeOffset = data.rangeOffset - replacement.rangeOffset;
    let matchOffset = replacement.text.indexOf(data.text);
    let closestMatchOffset = matchOffset;
    while (matchOffset !== -1) {
      if (Math.abs(matchOffset - previousRelativeOffset) < Math.abs(closestMatchOffset - previousRelativeOffset)) {
        closestMatchOffset = matchOffset;
      }
      matchOffset = replacement.text.indexOf(data.text, matchOffset + data.text.length);
    }
    if (closestMatchOffset === -1) {
      return void 0;
    }
    const precedingChangesDelta = changes.reduce((delta, change) => change.rangeOffset < replacement.rangeOffset ? delta + change.text.length - change.rangeLength : delta, 0);
    const startOffset = replacement.rangeOffset + precedingChangesDelta + closestMatchOffset;
    const range = Range.fromPositions(
      model.getPositionAt(startOffset),
      model.getPositionAt(startOffset + data.text.length)
    );
    return model.getValueInRange(range) === data.text ? range : void 0;
  }
  getInputState(contrib) {
    contrib[ChatDynamicVariableModel.ID] = [...this._variables];
  }
  setInputState(contrib) {
    let s = contrib[ChatDynamicVariableModel.ID];
    if (!Array.isArray(s)) {
      s = [];
    }
    this.disposeVariables();
    this._variables = [];
    for (const variable of s) {
      if (!isDynamicVariable(variable)) {
        continue;
      }
      this.addReference(variable);
    }
  }
  addReference(ref) {
    if (!isValidEditorRange(ref.range)) {
      return;
    }
    const existingAttachment = this.widget.input.attachmentModel.attachments.find((attachment) => attachment.id === ref.id && !attachment.range);
    if (existingAttachment) {
      ref = toAttachedContextDynamicVariable(existingAttachment, ref.range);
    }
    this._variables.push(ref);
    this.updateDecorations();
    this.widget.refreshParsedInput();
    this._onDidChangeReferences.fire();
  }
  updateDecorations() {
    const model = this.widget.inputEditor.getModel();
    if (!model) {
      this.decorationData = [];
      return;
    }
    const validVariables = this._variables.filter((v) => isValidEditorRange(v.range));
    const decorationIds = this.widget.inputEditor.setDecorationsByType("chat", dynamicVariableDecorationType, validVariables.map((r) => ({
      range: r.range,
      hoverMessage: this.getHoverForReference(r)
    })));
    this._variables = validVariables.slice(0, decorationIds.length);
    this.decorationData = [];
    for (let i = 0; i < decorationIds.length; i++) {
      const range = this._variables[i].range;
      this.decorationData.push({
        id: decorationIds[i],
        text: model.getValueInRange(range),
        rangeOffset: model.getOffsetAt({ lineNumber: range.startLineNumber, column: range.startColumn })
      });
    }
  }
  getHoverForReference(ref) {
    const attachment = this.widget.input.attachmentModel.attachments.find((attachment2) => attachment2.id === ref.id && !attachment2.range);
    if (attachment) {
      return isImageVariableEntry(attachment) ? void 0 : this.createAttachmentLabelHover(attachment);
    }
    const value = ref.data;
    if (URI.isUri(value)) {
      return new MarkdownString(this.labelService.getUriLabel(value, { relative: true }));
    } else if (isLocation(value)) {
      const prefix = ref.fullName ? ` ${ref.fullName}` : "";
      const rangeString = `#${value.range.startLineNumber}-${value.range.endLineNumber}`;
      return new MarkdownString(prefix + this.labelService.getUriLabel(value.uri, { relative: true }) + rangeString);
    } else {
      return void 0;
    }
  }
  createAttachmentLabelHover(attachment) {
    const resource = IChatRequestVariableEntry.toUri(attachment) ?? attachment.references?.find((reference) => URI.isUri(reference.reference))?.reference;
    const label = URI.isUri(resource) ? this.labelService.getUriLabel(resource, { relative: true }) : attachment.modelDescription ?? attachment.fullName ?? attachment.name;
    return new MarkdownString().appendText(label);
  }
  /**
   * Dispose all existing variables.
   */
  disposeVariables() {
    for (const variable of this._variables) {
      if (isDisposable(variable)) {
        variable.dispose();
      }
    }
  }
  dispose() {
    this.disposeVariables();
    super.dispose();
  }
};
ChatDynamicVariableModel = __decorateClass([
  __decorateParam(1, ILabelService)
], ChatDynamicVariableModel);
function isDynamicVariable(obj) {
  return obj && typeof obj.id === "string" && Range.isIRange(obj.range) && isValidEditorRange(obj.range) && "data" in obj;
}
function isValidEditorRange(range) {
  if (range.startLineNumber < 1 || range.endLineNumber < 1 || range.startColumn < 1 || range.endColumn < 1) {
    return false;
  }
  if (range.startLineNumber > range.endLineNumber) {
    return false;
  }
  if (range.startLineNumber === range.endLineNumber && range.startColumn >= range.endColumn) {
    return false;
  }
  return true;
}
function isAddDynamicVariableContext(context) {
  return "widget" in context && "range" in context && "variableData" in context;
}
class AddDynamicVariableAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.addDynamicVariable";
  }
  constructor() {
    super({
      id: AddDynamicVariableAction.ID,
      title: ""
      // not displayed
    });
  }
  async run(accessor, ...args) {
    const context = args[0];
    if (!isAddDynamicVariableContext(context)) {
      return;
    }
    let range = context.range;
    const variableData = context.variableData;
    const doCleanup = () => {
      context.widget.inputEditor.executeEdits("chatInsertDynamicVariableWithArguments", [{ range: context.range, text: `` }]);
    };
    if (context.command) {
      const commandService = accessor.get(ICommandService);
      const selection = await commandService.executeCommand(context.command.id, ...context.command.arguments ?? []);
      if (!selection) {
        doCleanup();
        return;
      }
      const insertText = ":" + selection;
      const insertRange = new Range(range.startLineNumber, range.endColumn, range.endLineNumber, range.endColumn + insertText.length);
      range = new Range(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn + insertText.length);
      const editor = context.widget.inputEditor;
      const success = editor.executeEdits("chatInsertDynamicVariableWithArguments", [{ range: insertRange, text: insertText + " " }]);
      if (!success) {
        doCleanup();
        return;
      }
    }
    context.widget.getContrib(ChatDynamicVariableModel.ID)?.addReference({
      id: context.id,
      range,
      isFile: true,
      data: variableData
    });
  }
}
registerAction2(AddDynamicVariableAction);
export {
  AddDynamicVariableAction,
  ChatDynamicVariableModel,
  dynamicVariableDecorationType
};
