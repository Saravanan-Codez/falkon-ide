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
const ClickBrowserToolData = {
  id: "click_element",
  toolReferenceName: BrowserChatToolReferenceName.ClickElement,
  displayName: localize("clickBrowserTool.displayName", "Click Element"),
  userDescription: localize("clickBrowserTool.userDescription", "Click an element in a browser page"),
  modelDescription: "Click on an element in a browser page.",
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
        description: "Element reference to click."
      },
      selector: {
        type: "string",
        description: 'Playwright selector of the element to click when "ref" is not available.'
      },
      element: {
        type: "string",
        description: 'Human-readable description of the element to click (e.g., "submit button", "search icon").'
      },
      dblClick: {
        type: "boolean",
        description: "Set to true for double clicks. Default is false."
      },
      button: {
        type: "string",
        enum: ["left", "right", "middle"],
        description: 'Mouse button to click with. Default is "left".'
      }
    },
    required: ["pageId", "element"],
    $comment: 'One of "ref" or "selector" is required.'
  }
};
let ClickBrowserTool = class {
  constructor(playwrightService) {
    this.playwrightService = playwrightService;
  }
  async prepareToolInvocation(_context, _token) {
    const params = _context.parameters;
    const link = createBrowserPageLink(params.pageId);
    const element = escapeMarkdownSyntaxTokens(params.element ?? DEFAULT_ELEMENT_LABEL);
    return {
      invocationMessage: params.button === "right" ? new MarkdownString(localize("browser.click.invocation.right", "Right-clicking {0} in {1}", element, link)) : params.button === "middle" ? new MarkdownString(localize("browser.click.invocation.middle", "Middle-clicking {0} in {1}", element, link)) : params.dblClick ? new MarkdownString(localize("browser.dblClick.invocation", "Double-clicking {0} in {1}", element, link)) : new MarkdownString(localize("browser.click.invocation", "Clicking {0} in {1}", element, link)),
      pastTenseMessage: params.button === "right" ? new MarkdownString(localize("browser.click.past.right", "Right-clicked {0} in {1}", element, link)) : params.button === "middle" ? new MarkdownString(localize("browser.click.past.middle", "Middle-clicked {0} in {1}", element, link)) : params.dblClick ? new MarkdownString(localize("browser.dblClick.past", "Double-clicked {0} in {1}", element, link)) : new MarkdownString(localize("browser.click.past", "Clicked {0} in {1}", element, link))
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
    const button = params.button ?? "left";
    if (params.dblClick) {
      return playwrightInvoke(this.playwrightService, sessionId, params.pageId, (page, sel, btn) => page.locator(sel).dblclick({ button: btn }), selector, button);
    }
    return playwrightInvoke(this.playwrightService, sessionId, params.pageId, (page, sel, btn) => page.locator(sel).click({ button: btn }), selector, button);
  }
};
ClickBrowserTool = __decorateClass([
  __decorateParam(0, IPlaywrightService)
], ClickBrowserTool);
export {
  ClickBrowserTool,
  ClickBrowserToolData
};
