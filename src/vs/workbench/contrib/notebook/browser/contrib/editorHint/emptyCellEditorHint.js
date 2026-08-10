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
import { Schemas } from "../../../../../../base/common/network.js";
import { EditorContributionInstantiation, registerEditorContribution } from "../../../../../../editor/browser/editorExtensions.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IChatAgentService } from "../../../../chat/common/participants/chatAgents.js";
import { EmptyTextEditorHintContribution } from "../../../../codeEditor/browser/emptyTextEditorHint/emptyTextEditorHint.js";
import { IInlineChatSessionService } from "../../../../inlineChat/browser/inlineChatSessionService.js";
import { getNotebookEditorFromEditorPane } from "../../notebookBrowser.js";
import { IEditorService } from "../../../../../services/editor/common/editorService.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
let EmptyCellEditorHintContribution = class extends EmptyTextEditorHintContribution {
  constructor(editor, _editorService, configurationService, inlineChatSessionService, chatAgentService, instantiationService) {
    super(
      editor,
      configurationService,
      inlineChatSessionService,
      chatAgentService,
      instantiationService
    );
    this._editorService = _editorService;
    const activeEditor = getNotebookEditorFromEditorPane(this._editorService.activeEditorPane);
    if (!activeEditor) {
      return;
    }
    this._register(activeEditor.onDidChangeActiveCell(() => this.update()));
  }
  static {
    this.CONTRIB_ID = "notebook.editor.contrib.emptyCellEditorHint";
  }
  shouldRenderHint() {
    const model = this.editor.getModel();
    if (!model) {
      return false;
    }
    const isNotebookCell = model?.uri.scheme === Schemas.vscodeNotebookCell;
    if (!isNotebookCell) {
      return false;
    }
    const activeEditor = getNotebookEditorFromEditorPane(this._editorService.activeEditorPane);
    if (!activeEditor || !activeEditor.isDisposed) {
      return false;
    }
    const shouldRenderHint = super.shouldRenderHint();
    if (!shouldRenderHint) {
      return false;
    }
    const activeCell = activeEditor.getActiveCell();
    if (activeCell?.uri.fragment !== model.uri.fragment) {
      return false;
    }
    return true;
  }
};
EmptyCellEditorHintContribution = __decorateClass([
  __decorateParam(1, IEditorService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IInlineChatSessionService),
  __decorateParam(4, IChatAgentService),
  __decorateParam(5, IInstantiationService)
], EmptyCellEditorHintContribution);
registerEditorContribution(EmptyCellEditorHintContribution.CONTRIB_ID, EmptyCellEditorHintContribution, EditorContributionInstantiation.Eager);
export {
  EmptyCellEditorHintContribution
};
