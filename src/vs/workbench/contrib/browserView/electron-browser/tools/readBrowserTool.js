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
const ReadBrowserToolData = {
  id: "read_page",
  toolReferenceName: BrowserChatToolReferenceName.ReadPage,
  displayName: localize("readBrowserTool.displayName", "Read Page"),
  userDescription: localize("readBrowserTool.userDescription", "Read the content of a browser page"),
  modelDescription: "Get a snapshot of the current browser page state. This is better than screenshot.",
  icon: Codicon.fileText,
  source: ToolDataSource.Internal,
  inputSchema: {
    type: "object",
    properties: {
      pageId: {
        type: "string",
        description: `The browser page ID to read, acquired from context or the open tool.`
      }
    },
    required: ["pageId"]
  }
};
let ReadBrowserTool = class {
  constructor(playwrightService) {
    this.playwrightService = playwrightService;
  }
  async prepareToolInvocation(_context, _token) {
    const link = createBrowserPageLink(_context.parameters.pageId);
    return {
      invocationMessage: new MarkdownString(localize("browser.read.invocation", "Reading {0}", link)),
      pastTenseMessage: new MarkdownString(localize("browser.read.past", "Read {0}", link))
    };
  }
  async invoke(invocation, _countTokens, _progress, _token) {
    const params = invocation.parameters;
    const sessionId = getSessionId(invocation);
    if (!params.pageId) {
      return errorResult(`No page ID provided. Use '${OpenPageToolId}' first.`);
    }
    const summary = await this.playwrightService.getSummary(sessionId, params.pageId);
    if (!summary) {
      return errorResult("No page summary available.");
    }
    return {
      content: [{
        kind: "text",
        value: summary
      }]
    };
  }
};
ReadBrowserTool = __decorateClass([
  __decorateParam(0, IPlaywrightService)
], ReadBrowserTool);
export {
  ReadBrowserTool,
  ReadBrowserToolData
};
