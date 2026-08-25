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
import { escapeMarkdownSyntaxTokens, MarkdownString } from "../../../../../base/common/htmlContent.js";
import { localize } from "../../../../../nls.js";
import { IPlaywrightService } from "../../../../../platform/browserView/common/playwrightService.js";
import { ToolDataSource } from "../../../chat/common/tools/languageModelToolsService.js";
import { createBrowserPageLink, DEFAULT_ELEMENT_LABEL, errorResult, getSessionId, playwrightInvoke } from "./browserToolHelpers.js";
import { BrowserChatToolReferenceName } from "../../../../../platform/browserView/common/browserChatToolReferenceNames.js";
import { OpenPageToolId } from "./openBrowserTool.js";
const HoverElementToolData = {
  id: "hover_element",
  toolReferenceName: BrowserChatToolReferenceName.HoverElement,
  displayName: localize("hoverElementTool.displayName", "Hover Element"),
  userDescription: localize("hoverElementTool.userDescription", "Hover over an element in a browser page"),
  modelDescription: "Hover over an element in a browser page. Provide either a Playwright selector or an element reference.",
  icon: Codicon.cursor,
  source: ToolDataSource.Internal,
  inputSchema: {
    type: "object",
    properties: {
      pageId: {
        type: "string",
        description: `The browser page ID, acquired from context or the open tool.`
      },
      ref: {
        type: "string",
        description: "Element reference to hover over."
      },
      selector: {
        type: "string",
        description: 'Playwright selector of the element to hover over when "ref" is not available.'
      },
      element: {
        type: "string",
        description: 'Human-readable description of the element to hover over (e.g., "navigation menu", "tooltip trigger").'
      }
    },
    required: ["pageId", "element"],
    $comment: 'One of "ref" or "selector" is required.'
  }
};
let HoverElementTool = class {
  constructor(playwrightService) {
    this.playwrightService = playwrightService;
  }
  async prepareToolInvocation(_context, _token) {
    const params = _context.parameters;
    const link = createBrowserPageLink(params.pageId);
    const element = escapeMarkdownSyntaxTokens(params.element ?? DEFAULT_ELEMENT_LABEL);
    return {
      invocationMessage: new MarkdownString(localize("browser.hover.invocation", "Hovering over {0} in {1}", element, link)),
      pastTenseMessage: new MarkdownString(localize("browser.hover.past", "Hovered over {0} in {1}", element, link))
    };
  }
  async invoke(invocation, _countTokens, _progress, _token) {
    const params = invocation.parameters;
    const sessionId = getSessionId(invocation);
    if (!params.pageId) {
      return errorResult(`No page ID provided. Use '${OpenPageToolId}' first.`);
    }
    let selector = params.selector;
    if (params.ref) {
      selector = `aria-ref=${params.ref}`;
    }
    if (!selector) {
      return errorResult('Either a "ref" or "selector" parameter is required.');
    }
    return playwrightInvoke(this.playwrightService, sessionId, params.pageId, (page, sel) => page.locator(sel).hover(), selector);
  }
};
HoverElementTool = __decorateClass([
  __decorateParam(0, IPlaywrightService)
], HoverElementTool);
export {
  HoverElementTool,
  HoverElementToolData
};
