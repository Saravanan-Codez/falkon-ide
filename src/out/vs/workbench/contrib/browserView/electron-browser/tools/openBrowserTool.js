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
import { raceCancellation } from "../../../../../base/common/async.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { CancellationError } from "../../../../../base/common/errors.js";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { hasKey } from "../../../../../base/common/types.js";
import { URI } from "../../../../../base/common/uri.js";
import { localize } from "../../../../../nls.js";
import { IPlaywrightService } from "../../../../../platform/browserView/common/playwrightService.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { IAgentNetworkFilterService } from "../../../../../platform/networkFilter/common/networkFilterService.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { IChatService } from "../../../chat/common/chatService/chatService.js";
import { ChatConfiguration, ChatPermissionLevel } from "../../../chat/common/constants.js";
import { ChatQuestionCarouselData } from "../../../chat/common/model/chatProgressTypes/chatQuestionCarouselData.js";
import { ToolDataSource } from "../../../chat/common/tools/languageModelToolsService.js";
import { BrowserViewSharingState, IBrowserViewWorkbenchService } from "../../common/browserView.js";
import { BrowserChatToolReferenceName } from "../../../../../platform/browserView/common/browserChatToolReferenceNames.js";
import { createBrowserPageLink, findExistingPagesByHost, getExistingPagesResult, getSessionId, remoteUrlRewriteNotice, rewriteRemoteLocalhostUrl } from "./browserToolHelpers.js";
import { IRemoteExplorerService } from "../../../../services/remote/common/remoteExplorerService.js";
const OpenPageToolId = "open_browser_page";
const OpenBrowserToolData = {
  id: OpenPageToolId,
  toolReferenceName: BrowserChatToolReferenceName.OpenBrowserPage,
  displayName: localize("openBrowserTool.displayName", "Open Browser Page"),
  userDescription: localize("openBrowserTool.userDescription", "Open a URL in the integrated browser"),
  modelDescription: `Open a new browser page in the integrated browser at the given URL.
May prompt the user to share a page if there is a similar one already open, unless "forceNew" is true.
Returns a page ID that must be used with other browser tools to interact with the page, as well as an accessibility snapshot of the page.

Important: Prefer to reuse existing pages whenever possible and only call this tool if you do not already have access to a tab you can reuse.`,
  icon: Codicon.openInProduct,
  source: ToolDataSource.Internal,
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The URL to open in the browser. Must be an absolute URI with a scheme such as file:, http:, or https:. For local files, use the canonical absolute form, for example file:///path/to/file."
      },
      forceNew: {
        type: "boolean",
        description: "Whether to force opening a new page even if a page with the same host already exists. Default is false."
      }
    },
    $comment: 'If you omit "url", the user will be prompted to share an existing page instead. Use this if there are unshared pages that the user may be interested in sharing with you.'
  }
};
const DECLINE_OPTION_ID = "__decline__";
let OpenBrowserTool = class {
  constructor(playwrightService, editorService, browserViewService, remoteExplorerService, agentNetworkFilterService, chatService, configService, logService) {
    this.playwrightService = playwrightService;
    this.editorService = editorService;
    this.browserViewService = browserViewService;
    this.remoteExplorerService = remoteExplorerService;
    this.agentNetworkFilterService = agentNetworkFilterService;
    this.chatService = chatService;
    this.configService = configService;
    this.logService = logService;
  }
  async prepareToolInvocation(context, _token) {
    const params = context.parameters;
    if (!params.url) {
      return {
        invocationMessage: localize("browser.open.prompt.invocation", "Prompting user to share a browser tab"),
        pastTenseMessage: localize("browser.open.prompt.past", "Prompted user to share a browser tab")
      };
    }
    const parsed = URL.parse(params.url);
    if (!parsed) {
      throw new Error("You must provide a complete, valid URL.");
    }
    params.url = parsed.href;
    const uri = URI.parse(params.url);
    if (!this.agentNetworkFilterService.isUriAllowed(uri)) {
      throw new Error(this.agentNetworkFilterService.formatError(uri));
    }
    return {
      invocationMessage: localize("browser.open.invocation", "Opening browser page at {0}", parsed.href),
      pastTenseMessage: localize("browser.open.past", "Opened browser page at {0}", parsed.href),
      confirmationMessages: {
        title: localize("browser.open.confirmTitle", "Open Browser Page?"),
        message: localize("browser.open.confirmMessage", "This will open {0} in the integrated browser. The agent will be able to read and interact with its contents.", parsed.href),
        allowAutoConfirm: true
      }
    };
  }
  async invoke(invocation, _countTokens, _progress, token) {
    const params = invocation.parameters;
    const sessionId = getSessionId(invocation);
    const activeSessionId = invocation.context?.sessionResource.toString();
    if (!params.url) {
      const allPages = [...this.browserViewService.getContextualBrowserViews({ activeSessionId }).values()];
      if (allPages.length === 0) {
        return { content: [{ kind: "text", value: "No browser pages are currently open." }] };
      }
      const shareResult = await this._promptForUnsharedPages(invocation, allPages, params, token);
      if (shareResult) {
        return shareResult;
      } else {
        return { content: [{ kind: "text", value: "The user opted not to share an existing page." }] };
      }
    }
    const rewrite = rewriteRemoteLocalhostUrl(params.url, this.browserViewService, this.remoteExplorerService);
    const rewriteNotice = rewrite.rewritten ? remoteUrlRewriteNotice(params.url, rewrite.url) : void 0;
    params.url = rewrite.url;
    const withNotice = (result) => rewriteNotice ? { ...result, content: [rewriteNotice, ...result.content] } : result;
    if (!params.forceNew) {
      const shared = findExistingPagesByHost(this.browserViewService, params.url, { includeBlank: true, sharingState: BrowserViewSharingState.Shared, activeSessionId });
      const alreadyShared = await getExistingPagesResult(this.editorService, shared, { agentNetworkFilterService: this.agentNetworkFilterService });
      if (alreadyShared) {
        return withNotice(alreadyShared);
      }
      const unshared = findExistingPagesByHost(this.browserViewService, params.url, { includeBlank: false, sharingState: BrowserViewSharingState.NotShared, activeSessionId });
      if (unshared.length > 0) {
        const shareResult = await this._promptForUnsharedPages(invocation, unshared, params, token);
        if (shareResult) {
          return withNotice(shareResult);
        }
      }
    }
    return withNotice(await this._openNewPage(sessionId, params.url));
  }
  /**
   * Shows a carousel prompting the user to share one of the given unshared
   * browser pages instead of opening a new page. Returns `undefined` if the
   * prompt should be skipped or the user chose to open a new page.
   */
  async _promptForUnsharedPages(invocation, candidateEditors, params, token) {
    const chatSessionResource = invocation.context?.sessionResource;
    const chatRequestId = invocation.chatRequestId;
    const request = this._getRequest(chatSessionResource, chatRequestId);
    if (!request) {
      return void 0;
    }
    if (request.modeInfo?.permissionLevel === ChatPermissionLevel.Autopilot || this.configService.getValue(ChatConfiguration.AutoReply)) {
      return void 0;
    }
    const carousel = this._buildShareCarousel(candidateEditors, params.url, invocation.chatStreamToolCallId ?? invocation.callId);
    this.chatService.appendProgress(request, carousel);
    const externalAnswerListener = this.chatService.onDidReceiveQuestionCarouselAnswer((event) => {
      if (event.resolveId !== carousel.resolveId || carousel.isUsed) {
        return;
      }
      carousel.dismiss(event.answers);
    });
    let answerResult;
    try {
      answerResult = await raceCancellation(carousel.completion.p, token);
    } catch (error) {
      if (error instanceof CancellationError) {
        carousel.dismiss(void 0);
      }
      throw error;
    } finally {
      externalAnswerListener.dispose();
    }
    if (!answerResult || token.isCancellationRequested) {
      carousel.dismiss(void 0);
      throw new CancellationError();
    }
    const selectedOptionId = this._extractSelectedOption(answerResult.answers);
    if (!selectedOptionId || selectedOptionId === DECLINE_OPTION_ID) {
      return void 0;
    }
    const editor = candidateEditors.find((e) => e.id === selectedOptionId);
    if (!editor) {
      this.logService.warn(`[OpenBrowserTool] Selected option '${selectedOptionId}' not found.`);
      return void 0;
    }
    return this._shareExistingPage(getSessionId(invocation), editor);
  }
  _buildShareCarousel(editors, url, resolveId) {
    const options = [];
    for (const editor of editors) {
      const editorTitle = (editor.title || editor.getName()).replaceAll(" - ", "\xA0-\xA0");
      const editorUrl = editor.url || "about:blank";
      const truncatedUrl = editorUrl.length > 40 ? editorUrl.substring(0, 40) + "\u2026" : editorUrl;
      options.push({
        id: editor.id,
        label: localize(
          { key: "browser.open.shareExistingOption", comment: ['{Locked=" - "}', "{0} is the editor title", "{1} is the truncated URL"] },
          'Yes, share "{0}" - {1}',
          editorTitle,
          truncatedUrl
        ),
        value: editor.id
      });
    }
    options.push({
      id: DECLINE_OPTION_ID,
      label: url ? localize("browser.open.newPageOption", "No, open a new page at {0}", url) : localize({ key: "browser.open.noPagesOption", comment: ['{Locked=" - "}'] }, "No - Do not share any tabs with the agent"),
      value: DECLINE_OPTION_ID
    });
    const question = {
      id: `${resolveId}:0`,
      type: "singleSelect",
      title: localize("browser.open.shareQuestion.title", "Share Browser Tab"),
      message: localize("browser.open.shareQuestion.message", "Share an existing browser tab?"),
      options,
      defaultValue: DECLINE_OPTION_ID,
      allowFreeformInput: false
    };
    return new ChatQuestionCarouselData([question], true, resolveId);
  }
  _extractSelectedOption(answers) {
    if (!answers) {
      return void 0;
    }
    for (const answer of Object.values(answers)) {
      if (typeof answer === "string") {
        return answer;
      }
      if (typeof answer === "object" && answer !== null && hasKey(answer, { selectedValue: true })) {
        return answer.selectedValue;
      }
    }
    return void 0;
  }
  async _openNewPage(sessionId, url) {
    const { pageId, summary } = await this.playwrightService.openPage(sessionId, url);
    return this._pageResult(pageId, summary, localize("browser.open.result", "Opened {0}", createBrowserPageLink(pageId)));
  }
  async _shareExistingPage(sessionId, editor) {
    const model = await editor.resolve();
    if (model.sharingState !== BrowserViewSharingState.Shared) {
      if (!await model.setSharedWithAgent(true)) {
        return { content: [{ kind: "text", value: "The user declined to share the page." }] };
      }
    }
    const summary = await this.playwrightService.getSummary(sessionId, editor.id);
    return this._pageResult(editor.id, summary, localize("browser.open.sharedResult", "User shared {0}", createBrowserPageLink(editor.id)));
  }
  _pageResult(pageId, summary, resultMessage) {
    return {
      content: [
        { kind: "text", value: `Page ID: ${pageId}

Summary:
` },
        { kind: "text", value: summary }
      ],
      toolResultMessage: new MarkdownString(resultMessage)
    };
  }
  _getRequest(chatSessionResource, chatRequestId) {
    if (!chatSessionResource) {
      return void 0;
    }
    const model = this.chatService.getSession(chatSessionResource);
    if (!model) {
      return void 0;
    }
    if (chatRequestId) {
      const request = model.getRequests().find((r) => r.id === chatRequestId);
      if (request) {
        return request;
      }
    }
    return model.getRequests().at(-1);
  }
};
OpenBrowserTool = __decorateClass([
  __decorateParam(0, IPlaywrightService),
  __decorateParam(1, IEditorService),
  __decorateParam(2, IBrowserViewWorkbenchService),
  __decorateParam(3, IRemoteExplorerService),
  __decorateParam(4, IAgentNetworkFilterService),
  __decorateParam(5, IChatService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, ILogService)
], OpenBrowserTool);
export {
  OpenBrowserTool,
  OpenBrowserToolData,
  OpenPageToolId
};
