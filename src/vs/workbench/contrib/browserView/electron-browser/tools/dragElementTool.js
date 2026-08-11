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
const DragElementToolData = {
  id: "drag_element",
  toolReferenceName: BrowserChatToolReferenceName.DragElement,
  displayName: localize("dragElementTool.displayName", "Drag Element"),
  userDescription: localize("dragElementTool.userDescription", "Drag an element over another element"),
  modelDescription: "Drag an element over another element in a browser page.",
  icon: Codicon.move,
  source: ToolDataSource.Internal,
  inputSchema: {
    type: "object",
    properties: {
      pageId: {
        type: "string",
        description: `The browser page ID, acquired from context or the open tool.`
      },
      fromRef: {
        type: "string",
        description: "Element reference of the element to drag."
      },
      fromSelector: {
        type: "string",
        description: 'Playwright selector of the element to drag when "fromRef" is not available.'
      },
      fromElement: {
        type: "string",
        description: 'Human-readable description of the element to drag (e.g., "file item", "draggable card").'
      },
      toRef: {
        type: "string",
        description: "Element reference of the element to drop onto."
      },
      toSelector: {
        type: "string",
        description: 'Playwright selector of the element to drop onto when "toRef" is not available.'
      },
      toElement: {
        type: "string",
        description: 'Human-readable description of the element to drop onto (e.g., "drop zone", "target folder").'
      }
    },
    required: ["pageId", "fromElement", "toElement"],
    $comment: 'One of "fromRef" or "fromSelector" is required, and one of "toRef" or "toSelector" is required.'
  }
};
let DragElementTool = class {
  constructor(playwrightService) {
    this.playwrightService = playwrightService;
  }
  async prepareToolInvocation(_context, _token) {
    const params = _context.parameters;
    const link = createBrowserPageLink(params.pageId);
    const fromElement = escapeMarkdownSyntaxTokens(params.fromElement ?? DEFAULT_ELEMENT_LABEL);
    const toElement = escapeMarkdownSyntaxTokens(params.toElement ?? DEFAULT_ELEMENT_LABEL);
    return {
      invocationMessage: new MarkdownString(localize("browser.drag.invocation", "Dragging {0} to {1} in {2}", fromElement, toElement, link)),
      pastTenseMessage: new MarkdownString(localize("browser.drag.past", "Dragged {0} to {1} in {2}", fromElement, toElement, link))
    };
  }
  async invoke(invocation, _countTokens, _progress, _token) {
    const params = invocation.parameters;
    const sessionId = getSessionId(invocation);
    if (!params.pageId) {
      return errorResult(`No page ID provided. Use '${OpenPageToolId}' first.`);
    }
    let fromSelector = params.fromSelector;
    if (params.fromRef) {
      fromSelector = `aria-ref=${params.fromRef}`;
    }
    if (!fromSelector) {
      return errorResult('Either a "fromRef" or "fromSelector" parameter is required for the source element.');
    }
    let toSelector = params.toSelector;
    if (params.toRef) {
      toSelector = `aria-ref=${params.toRef}`;
    }
    if (!toSelector) {
      return errorResult('Either a "toRef" or "toSelector" parameter is required for the target element.');
    }
    return playwrightInvoke(this.playwrightService, sessionId, params.pageId, (page, from, to) => page.dragAndDrop(from, to), fromSelector, toSelector);
  }
};
DragElementTool = __decorateClass([
  __decorateParam(0, IPlaywrightService)
], DragElementTool);
export {
  DragElementTool,
  DragElementToolData
};
