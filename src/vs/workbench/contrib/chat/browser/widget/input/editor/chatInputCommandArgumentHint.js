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
import { Disposable, MutableDisposable } from "../../../../../../../base/common/lifecycle.js";
import { ICodeEditorService } from "../../../../../../../editor/browser/services/codeEditorService.js";
import { Range } from "../../../../../../../editor/common/core/range.js";
import { IThemeService } from "../../../../../../../platform/theme/common/themeService.js";
import { getCommandArgumentHint } from "../../../../../../../platform/agentHost/common/meta/agentCompletionAttachmentMeta.js";
import { AgentHostCompletionReferenceKind, getAgentHostCompletionReferenceKindFromValue } from "../../../../common/attachments/chatVariableEntries.js";
import { ChatDynamicVariableModel } from "../../../attachments/chatDynamicVariables.js";
import { ChatWidget } from "../../chatWidget.js";
import { getInputPlaceholderColor, getRangeForPlaceholder } from "./chatInputPlaceholderDecoration.js";
const decorationDescription = "chat";
const commandArgumentHintDecorationType = "chat-command-argument-hint";
let InputEditorCommandArgumentHint = class extends Disposable {
  constructor(widget, codeEditorService, themeService) {
    super();
    this.widget = widget;
    this.codeEditorService = codeEditorService;
    this.themeService = themeService;
    this.id = "inputEditorCommandArgumentHint";
    /**
     * Subscription to {@link ChatDynamicVariableModel.onDidChangeReferences}.
     * Established lazily because that contribution may be constructed after this
     * one; accepting a completion adds the reference via a command that runs
     * after the insert, and it does not change the parsed input, so neither
     * `onDidChangeModelContent` nor `onDidChangeParsedInput` re-fires with the
     * reference present — this event is what triggers the hint on accept.
     */
    this._referencesListener = this._register(new MutableDisposable());
    this._register(this.codeEditorService.registerDecorationType(decorationDescription, commandArgumentHintDecorationType, {}));
    this.update();
    this._register(this.widget.onDidChangeParsedInput(() => this.update()));
    this._register(this.widget.inputEditor.onDidChangeModelContent(() => this.update()));
  }
  update() {
    this._ensureSubscribedToReferences();
    const decoration = this.getArgumentHintDecoration();
    this.widget.inputEditor.setDecorationsByType(decorationDescription, commandArgumentHintDecorationType, decoration ? [decoration] : []);
  }
  _ensureSubscribedToReferences() {
    if (this._referencesListener.value) {
      return;
    }
    const dynamicVariableModel = this.widget.getContrib(ChatDynamicVariableModel.ID);
    if (dynamicVariableModel) {
      this._referencesListener.value = dynamicVariableModel.onDidChangeReferences(() => this.update());
    }
  }
  getArgumentHintDecoration() {
    const model = this.widget.inputEditor.getModel();
    if (!model) {
      return void 0;
    }
    const dynamicVariableModel = this.widget.getContrib(ChatDynamicVariableModel.ID);
    if (!dynamicVariableModel) {
      return void 0;
    }
    for (const ref of dynamicVariableModel.variables) {
      if (getAgentHostCompletionReferenceKindFromValue(ref.data) !== AgentHostCompletionReferenceKind.Command) {
        continue;
      }
      const argumentHint = getCommandArgumentHint(ref._meta);
      if (!argumentHint) {
        continue;
      }
      if (!this.isCommandOnlyContent(model, ref.range)) {
        return void 0;
      }
      return {
        range: getRangeForPlaceholder(ref.range),
        renderOptions: {
          after: {
            contentText: argumentHint,
            color: getInputPlaceholderColor(this.themeService)
          }
        }
      };
    }
    return void 0;
  }
  isCommandOnlyContent(model, range) {
    const beforeRange = new Range(1, 1, range.startLineNumber, range.startColumn);
    if (model.getValueInRange(beforeRange).trim().length > 0) {
      return false;
    }
    const fullRange = model.getFullModelRange();
    const afterRange = new Range(range.endLineNumber, range.endColumn, fullRange.endLineNumber, fullRange.endColumn);
    return model.getValueInRange(afterRange) === " ";
  }
};
InputEditorCommandArgumentHint = __decorateClass([
  __decorateParam(1, ICodeEditorService),
  __decorateParam(2, IThemeService)
], InputEditorCommandArgumentHint);
ChatWidget.CONTRIBS.push(InputEditorCommandArgumentHint);
