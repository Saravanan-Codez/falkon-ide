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
import { localize } from "../../../../../nls.js";
import { IAgentNetworkFilterService } from "../../../../../platform/networkFilter/common/networkFilterService.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { ToolDataSource } from "../../../chat/common/tools/languageModelToolsService.js";
import { IBrowserViewWorkbenchService } from "../../common/browserView.js";
import { getBrowserPagesContext } from "./browserToolHelpers.js";
const ListBrowserPagesToolData = {
  id: "list_browser_pages",
  displayName: localize("listBrowserPagesTool.displayName", "List Browser Pages"),
  userDescription: localize("listBrowserPagesTool.userDescription", "List browser pages that are shared with the agent"),
  modelDescription: "Lists the browser pages that are currently shared with the agent.",
  source: ToolDataSource.Internal,
  // Note: this tool has no toolReferenceName and cannot be referenced in prompts.
  // It is not intended to be used by models directly since browser pages are supplied as context.
  canBeReferencedInPrompt: false,
  inputSchema: {
    type: "object",
    properties: {}
  }
};
let ListBrowserPagesTool = class {
  constructor(editorService, browserViewService, agentNetworkFilterService) {
    this.editorService = editorService;
    this.browserViewService = browserViewService;
    this.agentNetworkFilterService = agentNetworkFilterService;
  }
  async invoke(invocation, _countTokens, _progress, _token) {
    const activeSessionId = invocation.context?.sessionResource.toString();
    const value = getBrowserPagesContext(
      this.editorService,
      this.browserViewService,
      this.agentNetworkFilterService,
      {
        activeSessionId,
        canPromptUser: activeSessionId !== void 0
      }
    );
    return {
      content: [{
        kind: "text",
        value: value ?? "No browser pages are currently open."
      }]
    };
  }
};
ListBrowserPagesTool = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IBrowserViewWorkbenchService),
  __decorateParam(2, IAgentNetworkFilterService)
], ListBrowserPagesTool);
export {
  ListBrowserPagesTool,
  ListBrowserPagesToolData
};
