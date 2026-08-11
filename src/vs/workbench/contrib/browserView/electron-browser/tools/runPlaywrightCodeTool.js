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
import { errorResult, getSessionId, invokeFunctionResultToToolResult } from "./browserToolHelpers.js";
import { BrowserChatToolReferenceName } from "../../../../../platform/browserView/common/browserChatToolReferenceNames.js";
import { OpenPageToolId } from "./openBrowserTool.js";
const RunPlaywrightCodeToolData = {
  id: "run_playwright_code",
  toolReferenceName: BrowserChatToolReferenceName.RunPlaywrightCode,
  displayName: localize("runPlaywrightCodeTool.displayName", "Run Playwright Code"),
  userDescription: localize("runPlaywrightCodeTool.userDescription", "Run a Playwright code snippet against a browser page"),
  modelDescription: `Run a Playwright code snippet to control a browser page. Only use this if other browser tools are insufficient.`,
  icon: Codicon.terminal,
  source: ToolDataSource.Internal,
  inputSchema: {
    type: "object",
    properties: {
      pageId: {
        type: "string",
        description: `The browser page ID, acquired from context or the open tool.`
      },
      code: {
        type: "string",
        description: `The Playwright code to execute. The code must be concise, serve one clear purpose, and be self-contained. You **must not** directly access \`document\` or \`window\` using this tool. You must access it via the provided \`page\` object, e.g. "return page.evaluate(() => document.title)". Omit this when resuming a deferred execution via deferredResultId.`
      },
      deferredResultId: {
        type: "string",
        description: `If a previous call returned a deferredResultId, pass it here to continue waiting for that execution to complete.`
      },
      timeoutMs: {
        type: "number",
        description: `Maximum time in milliseconds to wait for the code to complete. Defaults to 5000 (5 seconds).`
      }
    },
    required: ["pageId"],
    $comment: 'Either "code" or "deferredResultId" must be provided.'
  }
};
let RunPlaywrightCodeTool = class {
  constructor(playwrightService) {
    this.playwrightService = playwrightService;
  }
  async prepareToolInvocation(context, _token) {
    const params = context.parameters;
    if (params.deferredResultId) {
      return {
        invocationMessage: new MarkdownString(localize("browser.runCode.waitInvocation", "Waiting for Playwright code to complete...")),
        pastTenseMessage: new MarkdownString(localize("browser.runCode.waitPast", "Waited for Playwright code"))
      };
    }
    const code = params.code ?? "";
    return {
      invocationMessage: new MarkdownString(localize("browser.runCode.invocation", "Running Playwright code...")),
      pastTenseMessage: new MarkdownString(localize("browser.runCode.past", "Ran Playwright code")),
      confirmationMessages: {
        title: localize("browser.runCode.confirmTitle", "Run Playwright Code?"),
        message: new MarkdownString(`\`\`\`javascript
${code.trim()}
\`\`\``),
        disclaimer: localize("browser.runCode.confirmDisclaimer", "Make sure you trust the code before continuing."),
        allowAutoConfirm: true
      }
    };
  }
  async invoke(invocation, _countTokens, _progress, _token) {
    const params = invocation.parameters;
    const sessionId = getSessionId(invocation);
    if (!params.pageId) {
      return errorResult(`No page ID provided. Use '${OpenPageToolId}' first.`);
    }
    if (params.deferredResultId) {
      try {
        const result2 = await this.playwrightService.waitForDeferredResult(sessionId, params.deferredResultId, params.timeoutMs ?? 5e3);
        return invokeFunctionResultToToolResult(result2);
      } catch (e) {
        return errorResult(e instanceof Error ? e.message : String(e));
      }
    }
    if (!params.code) {
      return errorResult('Either "code" or "deferredResultId" must be provided.');
    }
    let result;
    try {
      result = await this.playwrightService.invokeFunction(sessionId, params.pageId, `async (page) => { ${params.code} }`, void 0, params.timeoutMs ?? 5e3);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return errorResult(`Code execution failed: ${message}`);
    }
    return invokeFunctionResultToToolResult(result, params.code.trim());
  }
};
RunPlaywrightCodeTool = __decorateClass([
  __decorateParam(0, IPlaywrightService)
], RunPlaywrightCodeTool);
export {
  RunPlaywrightCodeTool,
  RunPlaywrightCodeToolData
};
