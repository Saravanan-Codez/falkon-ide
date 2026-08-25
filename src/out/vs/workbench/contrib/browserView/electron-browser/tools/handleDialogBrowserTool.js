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
import { Codicon } from "../../../../../base/common/codicons.js";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { localize } from "../../../../../nls.js";
import { IPlaywrightService } from "../../../../../platform/browserView/common/playwrightService.js";
import { ToolDataSource } from "../../../chat/common/tools/languageModelToolsService.js";
import { createBrowserPageLink, errorResult, getSessionId } from "./browserToolHelpers.js";
import { BrowserChatToolReferenceName } from "../../../../../platform/browserView/common/browserChatToolReferenceNames.js";
import { OpenPageToolId } from "./openBrowserTool.js";
const HandleDialogBrowserToolData = {
  id: "handle_dialog",
  toolReferenceName: BrowserChatToolReferenceName.HandleDialog,
  displayName: localize("handleDialogBrowserTool.displayName", "Handle Dialog"),
  userDescription: localize("handleDialogBrowserTool.userDescription", "Respond to a dialog in a browser page"),
  modelDescription: "Respond to a pending modal (alert, confirm, prompt) or file chooser dialog on a browser page.",
  icon: Codicon.comment,
  source: ToolDataSource.Internal,
  inputSchema: {
    type: "object",
    properties: {
      pageId: {
        type: "string",
        description: `The browser page ID, acquired from context or the open tool.`
      },
      acceptModal: {
        type: "boolean",
        description: "Whether to accept (true) or dismiss (false) a modal dialog."
      },
      promptText: {
        type: "string",
        description: "Text to enter into a prompt dialog."
      },
      selectFiles: {
        type: "array",
        items: { type: "string" },
        description: "Absolute paths of files to select, or empty to dismiss. Required for file chooser dialogs."
      }
    },
    required: ["pageId"]
  }
};
let HandleDialogBrowserTool = class {
  constructor(playwrightService) {
    this.playwrightService = playwrightService;
  }
  async prepareToolInvocation(_context, _token) {
    const link = createBrowserPageLink(_context.parameters.pageId);
    return {
      invocationMessage: new MarkdownString(localize("browser.handleDialog.invocation", "Handling dialog in {0}", link)),
      pastTenseMessage: new MarkdownString(localize("browser.handleDialog.past", "Handled dialog in {0}", link))
    };
  }
  async invoke(invocation, _countTokens, _progress, _token) {
    const params = invocation.parameters;
    const sessionId = getSessionId(invocation);
    if (!params.pageId) {
      return errorResult(`No page ID provided. Use '${OpenPageToolId}' first.`);
    }
    if (params.selectFiles !== void 0 && (params.acceptModal !== void 0 || params.promptText !== void 0)) {
      return errorResult(`Invalid parameters. 'selectFiles' cannot be used with 'acceptModal' or 'promptText'.`);
    }
    if (!Array.isArray(params.selectFiles) && (params.acceptModal === void 0 || params.acceptModal === null)) {
      return errorResult(`Invalid parameters. Either 'selectFiles' or 'acceptModal' must be provided.`);
    }
    try {
      let result;
      if (params.selectFiles !== void 0) {
        result = await this.playwrightService.replyToFileChooser(sessionId, params.pageId, params.selectFiles);
      } else {
        result = await this.playwrightService.replyToDialog(sessionId, params.pageId, params.acceptModal, params.promptText);
      }
      return { content: [{ kind: "text", value: result.summary }] };
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  }
};
HandleDialogBrowserTool = __decorateClass([
  __decorateParam(0, IPlaywrightService)
], HandleDialogBrowserTool);
export {
  HandleDialogBrowserTool,
  HandleDialogBrowserToolData
};
