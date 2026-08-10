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
import { Codicon } from "../../../../../../base/common/codicons.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../../nls.js";
import { ToolDataSource } from "../../../../chat/common/tools/languageModelToolsService.js";
import { ITerminalService } from "../../../../terminal/browser/terminal.js";
import { TerminalToolId } from "./toolIds.js";
const GetTerminalSelectionToolData = {
  id: TerminalToolId.TerminalSelection,
  toolReferenceName: "terminalSelection",
  legacyToolReferenceFullNames: ["runCommands/terminalSelection"],
  displayName: localize("terminalSelectionTool.displayName", "Get Terminal Selection"),
  modelDescription: "Get the current selection in the active terminal.",
  source: ToolDataSource.Internal,
  icon: Codicon.terminal
};
let GetTerminalSelectionTool = class extends Disposable {
  constructor(_terminalService) {
    super();
    this._terminalService = _terminalService;
  }
  async prepareToolInvocation(context, token) {
    return {
      invocationMessage: localize("getTerminalSelection.progressive", "Reading terminal selection"),
      pastTenseMessage: localize("getTerminalSelection.past", "Read terminal selection")
    };
  }
  async invoke(invocation, _countTokens, _progress, token) {
    const activeInstance = this._terminalService.activeInstance;
    if (!activeInstance) {
      return {
        content: [{
          kind: "text",
          value: "No active terminal instance found."
        }]
      };
    }
    const selection = activeInstance.selection;
    if (!selection) {
      return {
        content: [{
          kind: "text",
          value: "No text is currently selected in the active terminal."
        }]
      };
    }
    return {
      content: [{
        kind: "text",
        value: `The active terminal's selection:
${selection}`
      }]
    };
  }
};
GetTerminalSelectionTool = __decorateClass([
  __decorateParam(0, ITerminalService)
], GetTerminalSelectionTool);
export {
  GetTerminalSelectionTool,
  GetTerminalSelectionToolData
};
