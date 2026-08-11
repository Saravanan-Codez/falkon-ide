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
import { logBrowserOpen } from "../../../../../platform/browserView/common/browserViewTelemetry.js";
import { BrowserViewUri } from "../../../../../platform/browserView/common/browserViewUri.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { OpenBrowserToolData } from "./openBrowserTool.js";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { createBrowserPageLink, findExistingPagesByHost, getExistingPagesResult } from "./browserToolHelpers.js";
import { IBrowserViewWorkbenchService } from "../../common/browserView.js";
const OpenBrowserToolNonAgenticData = {
  ...OpenBrowserToolData,
  modelDescription: "Open a new browser page in the integrated browser at the given URL.",
  inputSchema: {
    ...OpenBrowserToolData.inputSchema,
    required: ["url"],
    $comment: void 0
  }
};
let OpenBrowserToolNonAgentic = class {
  constructor(telemetryService, editorService, browserViewService) {
    this.telemetryService = telemetryService;
    this.editorService = editorService;
    this.browserViewService = browserViewService;
  }
  async prepareToolInvocation(context, _token) {
    const params = context.parameters;
    if (!params.url) {
      throw new Error('The "url" parameter is required.');
    }
    const parsed = URL.parse(params.url);
    if (!parsed) {
      throw new Error("You must provide a complete, valid URL.");
    }
    return {
      invocationMessage: localize("browser.open.nonAgentic.invocation", "Opening browser page at {0}", parsed.href),
      pastTenseMessage: localize("browser.open.nonAgentic.past", "Opened browser page at {0}", parsed.href),
      confirmationMessages: {
        title: localize("browser.open.nonAgentic.confirmTitle", "Open Browser Page?"),
        message: localize("browser.open.nonAgentic.confirmMessage", "This will open {0} in the integrated browser. The agent will not be able to read its contents.", parsed.href),
        allowAutoConfirm: true
      }
    };
  }
  async invoke(invocation, _countTokens, _progress, _token) {
    const params = invocation.parameters;
    if (!params.forceNew) {
      const existingPages = findExistingPagesByHost(this.browserViewService, params.url, { activeSessionId: invocation.context?.sessionResource.toString() });
      const existingResult = await getExistingPagesResult(this.editorService, existingPages, { excludeIds: true });
      if (existingResult) {
        return existingResult;
      }
    }
    logBrowserOpen(this.telemetryService, "chatTool");
    const browserUri = BrowserViewUri.forId(generateUuid());
    await this.editorService.openEditor({ resource: browserUri, options: { pinned: true, preserveFocus: true, viewState: { url: params.url } } });
    return {
      content: [{
        kind: "text",
        value: `Page opened successfully. Note that you do not have access to the page contents unless the user enables agentic tools via the \`workbench.browser.enableChatTools\` setting.`
      }],
      toolResultMessage: new MarkdownString(localize("browser.open.nonAgentic.result", "Opened {0}", createBrowserPageLink(browserUri)))
    };
  }
};
OpenBrowserToolNonAgentic = __decorateClass([
  __decorateParam(0, ITelemetryService),
  __decorateParam(1, IEditorService),
  __decorateParam(2, IBrowserViewWorkbenchService)
], OpenBrowserToolNonAgentic);
export {
  OpenBrowserToolNonAgentic,
  OpenBrowserToolNonAgenticData
};
