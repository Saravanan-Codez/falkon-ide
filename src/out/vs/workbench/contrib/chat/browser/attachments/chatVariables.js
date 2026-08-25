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
import { ToolAndToolSetEnablementMap } from "../../common/tools/languageModelToolsService.js";
import { IChatWidgetService } from "../chat.js";
import { ChatDynamicVariableModel } from "./chatDynamicVariables.js";
import { Range } from "../../../../../editor/common/core/range.js";
function getDynamicVariablesForWidget(widget) {
  if (!widget.viewModel || !widget.supportsFileReferences) {
    return [];
  }
  const model = widget.getContrib(ChatDynamicVariableModel.ID);
  if (!model) {
    return [];
  }
  if (widget.viewModel.editing && model.variables.length > 0) {
    return model.variables;
  }
  if (widget.input.attachmentModel.attachments.length > 0 && widget.viewModel.editing) {
    const references = [];
    const editorModel = widget.inputEditor.getModel();
    const modelTextLength = editorModel?.getValueLength() ?? 0;
    for (const attachment of widget.input.attachmentModel.attachments) {
      if (attachment.range) {
        if (attachment.range.start >= attachment.range.endExclusive) {
          continue;
        }
        if (attachment.range.start < 0 || attachment.range.endExclusive > modelTextLength) {
          continue;
        }
        if (!editorModel) {
          continue;
        }
        const startPos = editorModel.getPositionAt(attachment.range.start);
        const endPos = editorModel.getPositionAt(attachment.range.endExclusive);
        const referenceObj = {
          id: attachment.id,
          fullName: attachment.name,
          modelDescription: attachment.modelDescription,
          range: new Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
          icon: attachment.icon,
          isFile: attachment.kind === "file",
          isDirectory: attachment.kind === "directory",
          data: attachment.value
        };
        references.push(referenceObj);
      }
    }
    return references.length > 0 ? references : model.variables;
  }
  return model.variables;
}
function getSelectedToolAndToolSetsForWidget(widget) {
  return widget.input.selectedToolsModel.entriesMap.get();
}
let ChatVariablesService = class {
  constructor(chatWidgetService) {
    this.chatWidgetService = chatWidgetService;
  }
  getDynamicVariables(sessionResource) {
    const widget = this.chatWidgetService.getWidgetBySessionResource(sessionResource);
    if (!widget) {
      return [];
    }
    return getDynamicVariablesForWidget(widget);
  }
  getSelectedToolAndToolSets(sessionResource) {
    const widget = this.chatWidgetService.getWidgetBySessionResource(sessionResource);
    if (!widget) {
      return ToolAndToolSetEnablementMap.fromEntries([]);
    }
    return getSelectedToolAndToolSetsForWidget(widget);
  }
};
ChatVariablesService = __decorateClass([
  __decorateParam(0, IChatWidgetService)
], ChatVariablesService);
export {
  ChatVariablesService,
  getDynamicVariablesForWidget,
  getSelectedToolAndToolSetsForWidget
};
