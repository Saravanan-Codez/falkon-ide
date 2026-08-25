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
import { URI } from "../../../../../base/common/uri.js";
import { localize } from "../../../../../nls.js";
import { IPlaywrightService } from "../../../../../platform/browserView/common/playwrightService.js";
import { ToolDataSource } from "../../../chat/common/tools/languageModelToolsService.js";
import { IAgentNetworkFilterService } from "../../../../../platform/networkFilter/common/networkFilterService.js";
import { createBrowserPageLink, errorResult, getSessionId, playwrightInvoke, remoteUrlRewriteNotice, rewriteRemoteLocalhostUrl } from "./browserToolHelpers.js";
import { BrowserChatToolReferenceName } from "../../../../../platform/browserView/common/browserChatToolReferenceNames.js";
import { IBrowserViewWorkbenchService } from "../../common/browserView.js";
import { IRemoteExplorerService } from "../../../../services/remote/common/remoteExplorerService.js";
import { OpenPageToolId } from "./openBrowserTool.js";
const NavigateBrowserToolData = {
  id: "navigate_page",
  toolReferenceName: BrowserChatToolReferenceName.NavigatePage,
  displayName: localize("navigateBrowserTool.displayName", "Navigate Page"),
  userDescription: localize("navigateBrowserTool.userDescription", "Navigate or reload a browser page"),
  modelDescription: "Navigate a browser page by URL, history, or reload.",
  icon: Codicon.arrowRight,
  source: ToolDataSource.Internal,
  inputSchema: {
    type: "object",
    properties: {
      pageId: {
        type: "string",
        description: `The browser page ID to navigate, acquired from context or the open tool.`
      },
      type: {
        type: "string",
        enum: ["url", "back", "forward", "reload"],
        description: 'Navigation type: "url" to navigate to a URL (default, requires "url" param), "back" or "forward" for history, "reload" to refresh.'
      },
      url: {
        type: "string",
        description: 'The URL to navigate to. Required when type is "url".'
      }
    },
    required: ["pageId"]
  }
};
let NavigateBrowserTool = class {
  constructor(playwrightService, agentNetworkFilterService, browserViewService, remoteExplorerService) {
    this.playwrightService = playwrightService;
    this.agentNetworkFilterService = agentNetworkFilterService;
    this.browserViewService = browserViewService;
    this.remoteExplorerService = remoteExplorerService;
  }
  async prepareToolInvocation(context, _token) {
    const params = context.parameters;
    const link = createBrowserPageLink(params.pageId);
    switch (params.type) {
      case "reload":
        return {
          invocationMessage: new MarkdownString(localize("browser.reload.invocation", "Reloading {0}", link)),
          pastTenseMessage: new MarkdownString(localize("browser.reload.past", "Reloaded {0}", link)),
          icon: Codicon.refresh
        };
      case "back":
        return {
          invocationMessage: new MarkdownString(localize("browser.goBack.invocation", "Navigating backward in {0}", link)),
          pastTenseMessage: new MarkdownString(localize("browser.goBack.past", "Navigated backward in {0}", link)),
          icon: Codicon.arrowLeft
        };
      case "forward":
        return {
          invocationMessage: new MarkdownString(localize("browser.goForward.invocation", "Navigating forward in {0}", link)),
          pastTenseMessage: new MarkdownString(localize("browser.goForward.past", "Navigated forward in {0}", link)),
          icon: Codicon.arrowRight
        };
      default: {
        if (!params.url) {
          throw new Error('The "url" parameter is required when type is "url".');
        }
        const parsed = URL.parse(params.url);
        if (!parsed) {
          throw new Error("You must provide a complete, valid URL.");
        }
        const uri = URI.parse(params.url);
        if (!this.agentNetworkFilterService.isUriAllowed(uri)) {
          throw new Error(this.agentNetworkFilterService.formatError(uri));
        }
        return {
          invocationMessage: new MarkdownString(localize("browser.navigate.invocation", "Navigating to {0} in {1}", parsed.href, link)),
          pastTenseMessage: new MarkdownString(localize("browser.navigate.past", "Navigated to {0} in {1}", parsed.href, link)),
          confirmationMessages: {
            title: localize("browser.navigate.confirmTitle", "Navigate Browser?"),
            message: localize("browser.navigate.confirmMessage", "This will navigate the browser to {0} and allow the agent to access its contents.", parsed.href),
            allowAutoConfirm: true
          }
        };
      }
    }
  }
  async invoke(invocation, _countTokens, _progress, _token) {
    const params = invocation.parameters;
    const sessionId = getSessionId(invocation);
    if (!params.pageId) {
      return errorResult(`No page ID provided. Use '${OpenPageToolId}' first.`);
    }
    switch (params.type) {
      case "reload":
        return playwrightInvoke(this.playwrightService, sessionId, params.pageId, (page) => page.reload({ waitUntil: "domcontentloaded" }));
      case "back":
        return playwrightInvoke(this.playwrightService, sessionId, params.pageId, (page) => page.goBack({ waitUntil: "domcontentloaded" }));
      case "forward":
        return playwrightInvoke(this.playwrightService, sessionId, params.pageId, (page) => page.goForward({ waitUntil: "domcontentloaded" }));
      default: {
        const rewrite = rewriteRemoteLocalhostUrl(params.url, this.browserViewService, this.remoteExplorerService);
        const result = await playwrightInvoke(this.playwrightService, sessionId, params.pageId, (page, target) => {
          return page.goto(target, { waitUntil: "domcontentloaded" });
        }, rewrite.url);
        return rewrite.rewritten ? { ...result, content: [remoteUrlRewriteNotice(params.url, rewrite.url), ...result.content] } : result;
      }
    }
  }
};
NavigateBrowserTool = __decorateClass([
  __decorateParam(0, IPlaywrightService),
  __decorateParam(1, IAgentNetworkFilterService),
  __decorateParam(2, IBrowserViewWorkbenchService),
  __decorateParam(3, IRemoteExplorerService)
], NavigateBrowserTool);
export {
  NavigateBrowserTool,
  NavigateBrowserToolData
};
