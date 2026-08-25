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
import * as dom from "../../../../../base/browser/dom.js";
import { renderFormattedText } from "../../../../../base/browser/formattedTextRenderer.js";
import { StandardKeyboardEvent } from "../../../../../base/browser/keyboardEvent.js";
import { alert } from "../../../../../base/browser/ui/aria/aria.js";
import { getDefaultHoverDelegate } from "../../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { CachedListVirtualDelegate } from "../../../../../base/browser/ui/list/list.js";
import { coalesce, distinct } from "../../../../../base/common/arrays.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { toErrorMessage } from "../../../../../base/common/errorMessage.js";
import { canceledName } from "../../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { MarkdownString, escapeMarkdownSyntaxTokens } from "../../../../../base/common/htmlContent.js";
import { Iterable } from "../../../../../base/common/iterator.js";
import { KeyCode } from "../../../../../base/common/keyCodes.js";
import { Disposable, DisposableMap, DisposableStore, MutableDisposable, dispose, toDisposable } from "../../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../../base/common/map.js";
import { FileAccess, Schemas } from "../../../../../base/common/network.js";
import { clamp, formatTokenCount } from "../../../../../base/common/numbers.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { URI } from "../../../../../base/common/uri.js";
import { localize } from "../../../../../nls.js";
import { MenuEntryActionViewItem, createActionViewItem } from "../../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { MenuWorkbenchToolBar } from "../../../../../platform/actions/browser/toolbar.js";
import { MenuId, MenuItemAction } from "../../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { isDark } from "../../../../../platform/theme/common/theme.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { parseRemoteAgentHostSessionTypeAuthority } from "../../../../../platform/agentHost/common/agentHostSessionType.js";
import { isCreateChatTool, isCreateSessionTool, isSendMessageTool } from "../../../../../platform/agentHost/common/openSessionLink.js";
import { IChatEntitlementService } from "../../../../services/chat/common/chatEntitlementService.js";
import { CodiconActionViewItem } from "../../../notebook/browser/view/cellParts/cellActionView.js";
import { annotateSpecialMarkdownContent, extractSubAgentInvocationIdFromText, hasCodeblockUriTag, hasEditCodeblockUriTag } from "../../common/widget/annotations.js";
import { checkModeOption } from "../../common/chat.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
import { chatSubcommandLeader } from "../../common/requestParser/chatParserTypes.js";
import { ChatAgentVoteDirection, ChatErrorLevel, ChatRequestQueueKind, IChatService, IChatToolInvocation, isChatFollowup } from "../../common/chatService/chatService.js";
import { ChatPlanReviewData } from "../../common/model/chatProgressTypes/chatPlanReviewData.js";
import { ChatQuestionCarouselData } from "../../common/model/chatProgressTypes/chatQuestionCarouselData.js";
import { localChatSessionType, SessionType } from "../../common/chatSessionsService.js";
import { getChatSessionType } from "../../common/model/chatUri.js";
import { getExplicitFileOrImageAttachmentSummary, isExplicitFileOrImageVariableEntry, isPasteVariableEntry } from "../../common/attachments/chatVariableEntries.js";
import { getStickyScrollTargetItem, isRequestVM, isResponseVM, isPendingDividerVM } from "../../common/model/chatViewModel.js";
import { getNWords } from "../../common/model/chatWordCounter.js";
import { CHAT_OPEN_AGENT_HOST_CHAT_COMMAND_ID, ChatAgentLocation, ChatConfiguration, ChatModeKind, CollapsedToolsDisplayMode, ThinkingDisplayMode } from "../../common/constants.js";
import { formatChatRequestTimestamp, formatChatResponseDetails, formatChatResponseElapsedTime } from "../../common/chatProgressFormatting.js";
import { ClickAnimation } from "../../../../../base/browser/ui/animations/animations.js";
import { ForkConversationActionId } from "../actions/chatForkActions.js";
import { MarkHelpfulActionId } from "../actions/chatTitleActions.js";
import { IChatWidgetService } from "../chat.js";
import { AgentHostSnapshotController } from "../agentSessions/agentHost/agentHostSnapshotController.js";
import { RestoreCheckpointActionId } from "../chatEditing/chatEditingActions.js";
import { ChatForkActionViewItem } from "./chatForkActionViewItem.js";
import { ChatRestoreCheckpointActionViewItem } from "./chatRestoreCheckpointActionViewItem.js";
import { ChatAgentHover, getChatAgentHoverOptions } from "./chatAgentHover.js";
import { ChatContentMarkdownRenderer } from "./chatContentMarkdownRenderer.js";
import { ChatAgentCommandContentPart } from "./chatContentParts/chatAgentCommandContentPart.js";
import { ChatAnonymousRateLimitedPart } from "./chatContentParts/chatAnonymousRateLimitedPart.js";
import { ChatAttachmentsContentPart } from "./chatContentParts/chatAttachmentsContentPart.js";
import { ChatAutoModeResolutionContentPart } from "./chatContentParts/chatAutoModeResolutionContentPart.js";
import { ChatCheckpointFileChangesSummaryContentPart } from "./chatContentParts/chatChangesSummaryPart.js";
import { ChatTurnPillsContentPart } from "./chatContentParts/chatTurnPillsPart.js";
import { isChatTurnStatusPillsEnabled } from "./chatTurnPills.js";
import { ChatCodeCitationContentPart } from "./chatContentParts/chatCodeCitationContentPart.js";
import { ChatCollapsibleContentPart } from "./chatContentParts/chatCollapsibleContentPart.js";
import { ChatCommandButtonContentPart } from "./chatContentParts/chatCommandContentPart.js";
import { ChatConfirmationContentPart } from "./chatContentParts/chatConfirmationContentPart.js";
import { DiffEditorPool, EditorPool } from "./chatContentParts/chatContentCodePools.js";
import { InlineTextModelCollection } from "./chatContentParts/chatContentParts.js";
import { ChatElicitationContentPart } from "./chatContentParts/chatElicitationContentPart.js";
import { ChatErrorConfirmationContentPart } from "./chatContentParts/chatErrorConfirmationPart.js";
import { ChatErrorContentPart } from "./chatContentParts/chatErrorContentPart.js";
import { ChatPlanReviewPart } from "./chatContentParts/chatPlanReviewPart.js";
import { ChatQuestionCarouselPart } from "./chatContentParts/chatQuestionCarouselPart.js";
import { ChatExtensionsContentPart } from "./chatContentParts/chatExtensionsContentPart.js";
import { ChatMarkdownContentPart, codeblockHasClosingBackticks } from "./chatContentParts/chatMarkdownContentPart.js";
import { ChatMcpServersInteractionContentPart } from "./chatContentParts/chatMcpServersInteractionContentPart.js";
import { ChatMcpAuthenticationContentPart } from "./chatContentParts/chatMcpAuthenticationContentPart.js";
import { ChatMcpServersStartingContentPart } from "./chatContentParts/chatMcpServersStartingContentPart.js";
import { ChatDisabledClaudeHooksContentPart } from "./chatContentParts/chatDisabledClaudeHooksContentPart.js";
import { ChatMultiDiffContentPart } from "./chatContentParts/chatMultiDiffContentPart.js";
import { ChatProgressContentPart, ChatWorkingProgressContentPart } from "./chatContentParts/chatProgressContentPart.js";
import { ChatPullRequestContentPart } from "./chatContentParts/chatPullRequestContentPart.js";
import { ChatQuotaExceededPart } from "./chatContentParts/chatQuotaExceededPart.js";
import { ChatUsedReferencesListContentPart, CollapsibleListPool } from "./chatContentParts/chatReferencesContentPart.js";
import { ChatSideChatOriginPart } from "./chatContentParts/chatSideChatOriginPart.js";
import { ChatTaskContentPart } from "./chatContentParts/chatTaskContentPart.js";
import { ChatSystemNotificationContentPart } from "./chatContentParts/chatSystemNotificationContentPart.js";
import { ChatTextEditContentPart } from "./chatContentParts/chatTextEditContentPart.js";
import { ChatThinkingContentPart, getEffectiveThinkingDisplayMode } from "./chatContentParts/chatThinkingContentPart.js";
import { ChatSubagentContentPart } from "./chatContentParts/chatSubagentContentPart.js";
import { ChatTreeContentPart, TreePool } from "./chatContentParts/chatTreeContentPart.js";
import { ChatWorkspaceEditContentPart } from "./chatContentParts/chatWorkspaceEditContentPart.js";
import { ChatExternalEditContentPart } from "./chatContentParts/chatExternalEditContentPart.js";
import { ChatToolInvocationPart } from "./chatContentParts/toolInvocationParts/chatToolInvocationPart.js";
import { ChatMarkdownDecorationsRenderer } from "./chatContentParts/chatMarkdownDecorationsRenderer.js";
import { ChatCodeBlockContentProvider } from "./chatContentParts/codeBlockPart.js";
import { autorun, observableValue } from "../../../../../base/common/observable.js";
import { basename, isEqual } from "../../../../../base/common/resources.js";
import { IAccessibilityService } from "../../../../../platform/accessibility/common/accessibility.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { ChatHookContentPart } from "./chatContentParts/chatHookContentPart.js";
import { HookType } from "../../common/promptSyntax/hookTypes.js";
import { IWorkbenchEnvironmentService } from "../../../../services/environment/common/environmentService.js";
import { AccessibilityWorkbenchSettingId } from "../../../accessibility/browser/accessibilityConfiguration.js";
import { isAskQuestionsToolInvocation, isMcpToolInvocation } from "./chatContentParts/toolInvocationParts/chatToolPartUtilities.js";
import { AgentSessionProviders, isAgentHostTarget } from "../agentSessions/agentSessions.js";
const $ = dom.$;
const COPILOT_USERNAME = "GitHub Copilot";
const WORKING_CAUGHT_UP_DEBOUNCE_MS = 750;
const DEFAULT_CHAT_ITEM_HORIZONTAL_PADDING = 40;
function escapeMarkdownLinkLabel(label) {
  return label.replace(/\\/g, "\\\\").replace(/\]/g, "\\]");
}
function buildPlanReviewProgressContent(review, message) {
  const renderedAsUsed = !!review.isUsed;
  const data = renderedAsUsed && !review.data?.rejected ? review.data : void 0;
  const overall = data?.feedbackOverall?.trim();
  const inlineMd = data?.feedbackInlineMarkdown?.trim();
  const feedbackMarkdown = [overall, inlineMd].filter((value) => !!value).join("\n\n") || data?.feedback?.trim();
  const content = new MarkdownString(void 0, { supportThemeIcons: true });
  content.appendText(message);
  if (feedbackMarkdown) {
    content.appendMarkdown("\n\n");
    content.appendMarkdown(feedbackMarkdown);
  }
  if (renderedAsUsed) {
    const reviewContent = review.content.trim();
    const planUri = review.planUri ? URI.revive(review.planUri) : void 0;
    if (reviewContent || planUri) {
      content.appendMarkdown("\n\n");
      if (reviewContent) {
        content.appendMarkdown(reviewContent);
      }
      if (planUri) {
        if (reviewContent) {
          content.appendMarkdown("\n\n");
        }
        const planFileName = basename(planUri);
        const label = planFileName ? localize("chat.planReview.openFullPlanFile", "Open full plan file ({0})", planFileName) : localize("chat.planReview.openFullPlan", "Open full plan file");
        const planWidgetUri = planUri.with({ query: planUri.query ? `${planUri.query}&vscodeLinkType=file` : "vscodeLinkType=file" });
        content.appendMarkdown(`[${escapeMarkdownLinkLabel(label)}](${planWidgetUri.toString(true)})`);
      }
    }
  }
  return content;
}
function shouldScheduleInitialHeightChange(normalizedHeight, allocatedHeight) {
  return typeof allocatedHeight !== "number" || normalizedHeight > allocatedHeight;
}
function getFinalResponseStartIndex(content) {
  let index = content.length - 1;
  while (index >= 0) {
    const part = content[index];
    if (part.kind === "markdownContent" && part.content.value.length) {
      break;
    }
    index--;
  }
  if (index < 0) {
    return void 0;
  }
  while (index > 0 && content[index - 1].kind === "markdownContent") {
    index--;
  }
  return index;
}
function isSessionCreatedTool(part) {
  return (part.kind === "toolInvocation" || part.kind === "toolInvocationSerialized") && part.toolSpecificData?.kind === "sessionCreated";
}
function getFinalResponseStartIndexAfterMovingSessionCreatedTools(content) {
  const finalResponseStartIndex = getFinalResponseStartIndex(content);
  if (finalResponseStartIndex === void 0) {
    return void 0;
  }
  let movedToolCount = 0;
  for (let index = 0; index < finalResponseStartIndex; index++) {
    if (isSessionCreatedTool(content[index])) {
      movedToolCount++;
    }
  }
  return finalResponseStartIndex - movedToolCount;
}
function isFinalResponseRendered(content, finalResponseStartIndex) {
  return finalResponseStartIndex !== void 0 && content[finalResponseStartIndex]?.kind === "markdownContent";
}
function moveSessionCreatedToolsAfterFinalResponse(content) {
  const sessionCreatedTools = content.filter(isSessionCreatedTool);
  if (sessionCreatedTools.length === 0) {
    return [...content];
  }
  const finalResponseStartIndex = getFinalResponseStartIndexAfterMovingSessionCreatedTools(content);
  if (finalResponseStartIndex === void 0) {
    return [...content];
  }
  const reordered = content.filter((part) => !isSessionCreatedTool(part));
  let insertionIndex = finalResponseStartIndex;
  while (reordered[insertionIndex]?.kind === "markdownContent") {
    insertionIndex++;
  }
  reordered.splice(insertionIndex, 0, ...sessionCreatedTools);
  return reordered;
}
function formatCompletedResponseDisclosureLabel(stepCount, elapsedMs) {
  const elapsed = formatChatResponseElapsedTime(elapsedMs);
  if (stepCount === 1) {
    return elapsed ? localize("chat.responseCompletedOneStepIn", "Completed 1 step in {0}", elapsed) : localize("chat.responseCompletedOneStep", "Completed 1 step");
  }
  return elapsed ? localize("chat.responseCompletedStepsIn", "Completed {0} steps in {1}", stepCount, elapsed) : localize("chat.responseCompletedSteps", "Completed {0} steps", stepCount);
}
function getVisibleCompletedResponseItemCount(nodes) {
  let visibleItemCount = 0;
  for (const node of nodes) {
    if (dom.isHTMLElement(node) && (node.hidden || node.style.display === "none")) {
      continue;
    }
    visibleItemCount++;
  }
  return visibleItemCount;
}
function formatResponseTokenStats(modelTotals) {
  if (!modelTotals?.length) {
    return void 0;
  }
  const title = localize("chat.responseTokenStats.title", "Tokens used this turn");
  const markdown = new MarkdownString();
  markdown.appendMarkdown(`**${escapeMarkdownSyntaxTokens(title)}**

`);
  const ariaParts = [title];
  for (const total of modelTotals) {
    const line = total.cachedTokens > 0 ? localize(
      "chat.responseTokenStats.modelLineCached",
      "{0} \u2014 {1} in, {2} out, {3} cached",
      total.model,
      formatTokenCount(total.inputTokens),
      formatTokenCount(total.outputTokens),
      formatTokenCount(total.cachedTokens)
    ) : localize(
      "chat.responseTokenStats.modelLine",
      "{0} \u2014 {1} in, {2} out",
      total.model,
      formatTokenCount(total.inputTokens),
      formatTokenCount(total.outputTokens)
    );
    markdown.appendMarkdown(`${escapeMarkdownSyntaxTokens(line)}

`);
    ariaParts.push(total.cachedTokens > 0 ? localize(
      "chat.responseTokenStats.modelAriaCached",
      "{0}: {1} input tokens, {2} output tokens, {3} cached tokens",
      total.model,
      total.inputTokens,
      total.outputTokens,
      total.cachedTokens
    ) : localize(
      "chat.responseTokenStats.modelAria",
      "{0}: {1} input tokens, {2} output tokens",
      total.model,
      total.inputTokens,
      total.outputTokens
    ));
  }
  const ariaLabel = ariaParts.join(". ");
  return { markdown, markdownNotSupportedFallback: ariaLabel, ariaLabel };
}
function shouldCollapseCompletedResponsePart(part) {
  return part.kind !== "toolInvocation" && part.kind !== "toolInvocationSerialized" || !toolInvocationHasMcpAppData(part);
}
function getCompletedResponseCollapseEndIndex(content, finalResponseStartIndex) {
  for (let index = 0; index < finalResponseStartIndex; index++) {
    if (!shouldCollapseCompletedResponsePart(content[index])) {
      return index;
    }
  }
  return finalResponseStartIndex;
}
function reconcileChatItemHeight(normalizedHeight, currentRenderedHeight, isBeingRendered, allocatedHeight) {
  if (normalizedHeight === currentRenderedHeight) {
    return { nextRenderedHeight: currentRenderedHeight, kind: "none", height: normalizedHeight };
  }
  if (isBeingRendered) {
    return { nextRenderedHeight: currentRenderedHeight, kind: "deferReMeasure", height: normalizedHeight };
  }
  if (typeof currentRenderedHeight === "number") {
    return { nextRenderedHeight: normalizedHeight, kind: "fire", height: normalizedHeight };
  }
  if (!shouldScheduleInitialHeightChange(normalizedHeight, allocatedHeight)) {
    return { nextRenderedHeight: normalizedHeight, kind: "none", height: normalizedHeight };
  }
  return { nextRenderedHeight: normalizedHeight, kind: "scheduleInitial", height: normalizedHeight };
}
function renderChatResponseDetails(container, details, completedAt, elapsedMs, verbose, tokenStatsAriaLabel) {
  dom.clearNode(container);
  container.classList.remove("chat-response-flip-active", "chat-response-flip-down", "chat-response-flip-reset");
  const completion = verbose ? formatChatRequestTimestamp(completedAt) : void 0;
  const elapsed = completion ? formatChatResponseElapsedTime(elapsedMs) : void 0;
  const alternate = completion?.isRelative ? formatChatResponseDetails(elapsed, completion.fullText) : elapsed;
  const responseDetails = formatChatResponseDetails(details, completion?.text);
  let completedAtElement;
  if (completion) {
    const timing = dom.append(container, $("span.chat-response-timing"));
    completedAtElement = dom.append(timing, $("time.chat-response-completed-at", { datetime: completion.dateTime }, completion.text));
    if (alternate) {
      dom.append(timing, $("span.chat-response-alternate", void 0, alternate));
    }
    timing.classList.toggle("has-alternate", !!alternate);
  }
  if (completion && details) {
    dom.append(container, $("span.chat-response-details-separator", { "aria-hidden": "true" }, "\u2022"));
  }
  if (details) {
    dom.append(container, $("span.chat-response-model-details", void 0, details));
  }
  const accessibleTiming = completion ? localize("chatResponseCompletedAt", "Completed {0}", completion.fullText) : void 0;
  const accessibleElapsed = elapsed ? localize("chatResponseElapsed", "Elapsed time {0}", elapsed) : void 0;
  container.ariaLabel = [accessibleTiming, accessibleElapsed, details, tokenStatsAriaLabel].filter(Boolean).join(", ");
  container.classList.toggle("hidden", !responseDetails);
  container.tabIndex = responseDetails ? 0 : -1;
  return completedAtElement;
}
function renderChatRequestTimestamp(container, timestamp) {
  const formatted = formatChatRequestTimestamp(timestamp);
  if (!formatted) {
    return void 0;
  }
  if (!formatted.isRelative) {
    const element2 = dom.append(container, $("time.chat-request-timestamp", {
      datetime: formatted.dateTime,
      "aria-label": localize("chatRequestSentAt", "Sent {0}", formatted.fullText),
      tabindex: 0
    }, formatted.text));
    return { element: element2, hoverText: formatted.fullText };
  }
  const element = dom.append(container, $("span.chat-request-timestamp", {
    "aria-label": localize("chatRequestSentAt", "Sent {0}", formatted.fullText),
    tabindex: 0
  }));
  const timing = dom.append(element, $("span.chat-request-timing.has-alternate"));
  dom.append(timing, $("time.chat-request-relative", { datetime: formatted.dateTime }, formatted.text));
  dom.append(timing, $("time.chat-request-full-date", { datetime: formatted.dateTime }, formatted.fullText));
  return { element };
}
function shouldRenderInitialProgressiveContentImmediately(isComplete, hasMarkdownParts, hasRenderData) {
  return !isComplete && hasMarkdownParts && !hasRenderData;
}
function shouldStartNewCollapsedThinkingGroup(displayMode, existingGroup, incomingGroup) {
  return displayMode === ThinkingDisplayMode.Collapsed && existingGroup !== incomingGroup;
}
function shouldCreateGroupedThinkingPart(collapsedToolsMode, separatedFromReasoning) {
  return collapsedToolsMode === CollapsedToolsDisplayMode.Always || separatedFromReasoning;
}
function shouldShowFileChangesSummaryForSettings(isComplete, isLocalSession, showFileChanges) {
  return isComplete && isLocalSession && showFileChanges;
}
function shouldShowPillsSummaryForSettings(isComplete, isAgentHostSession, turnStatusPills) {
  return isComplete && isAgentHostSession && isChatTurnStatusPillsEnabled(turnStatusPills);
}
function shouldPinToolInvocationToThinking(state, hasConfirmationMessages, hasMcpAppData) {
  return !hasMcpAppData && state !== IChatToolInvocation.StateKind.WaitingForConfirmation && state !== IChatToolInvocation.StateKind.WaitingForPostApproval && state !== IChatToolInvocation.StateKind.WaitingForAuthentication && !hasConfirmationMessages;
}
function toolInvocationHasMcpAppData(toolInvocation) {
  return toolInvocation.toolSpecificData?.kind === "input" && !!toolInvocation.toolSpecificData.mcpAppData;
}
const forceVerboseLayoutTracing = false;
const mostRecentResponseClassName = "chat-most-recent-response";
function shouldHideChatUserIdentity(username, sessionResource, isResponse, isSessionsWindow, isSystemInitiatedRequest) {
  const sessionType = getChatSessionType(sessionResource);
  return username === COPILOT_USERNAME || isResponse && isAgentHostCopilotSessionType(sessionType) || isSessionsWindow || isSystemInitiatedRequest;
}
function isAgentHostCopilotSessionType(sessionType) {
  return sessionType === AgentSessionProviders.AgentHostCopilot || parseRemoteAgentHostSessionTypeAuthority(sessionType, SessionType.CopilotCLI) !== void 0;
}
function upvoteAnimationSettingToEnum(value) {
  switch (value) {
    case "confetti":
      return ClickAnimation.Confetti;
    case "floatingThumbs":
      return ClickAnimation.FloatingIcons;
    case "pulseWave":
      return ClickAnimation.PulseWave;
    case "radiantLines":
      return ClickAnimation.RadiantLines;
    default:
      return void 0;
  }
}
let ChatListItemRenderer = class extends Disposable {
  constructor(editorOptions, rendererOptions, delegate, overflowWidgetsDomNode, viewModel, instantiationService, configService, logService, contextKeyService, themeService, commandService, hoverService, chatWidgetService, chatEntitlementService, chatService, accessibilitySignalService, accessibilityService, environmentService, telemetryService) {
    super();
    this.rendererOptions = rendererOptions;
    this.delegate = delegate;
    this.viewModel = viewModel;
    this.instantiationService = instantiationService;
    this.configService = configService;
    this.logService = logService;
    this.contextKeyService = contextKeyService;
    this.themeService = themeService;
    this.commandService = commandService;
    this.hoverService = hoverService;
    this.chatWidgetService = chatWidgetService;
    this.chatEntitlementService = chatEntitlementService;
    this.chatService = chatService;
    this.accessibilitySignalService = accessibilitySignalService;
    this.accessibilityService = accessibilityService;
    this.environmentService = environmentService;
    this.telemetryService = telemetryService;
    this.codeBlocksByResponseId = /* @__PURE__ */ new Map();
    this.codeBlocksByEditorUri = new ResourceMap();
    this.fileTreesByResponseId = /* @__PURE__ */ new Map();
    this.focusedFileTreesByResponseId = /* @__PURE__ */ new Map();
    this.templateDataByRequestId = /* @__PURE__ */ new Map();
    this.responseTemplateDataByRequestId = /* @__PURE__ */ new Map();
    this.templateDataByRow = /* @__PURE__ */ new WeakMap();
    /** Track pending question carousels by session resource for auto-skip on chat submission */
    this.pendingQuestionCarousels = new ResourceMap();
    this._notifiedQuestionCarousels = /* @__PURE__ */ new Set();
    this.workingProgressConfirmationEndListeners = /* @__PURE__ */ new WeakSet();
    this._onDidClickFollowup = this._register(new Emitter());
    this.onDidClickFollowup = this._onDidClickFollowup.event;
    this._onDidClickRerunWithAgentOrCommandDetection = this._register(new Emitter());
    this.onDidClickRerunWithAgentOrCommandDetection = this._onDidClickRerunWithAgentOrCommandDetection.event;
    this._onDidClickRequest = this._register(new Emitter());
    this.onDidClickRequest = this._onDidClickRequest.event;
    this._onDidRerender = this._register(new Emitter());
    this.onDidRerender = this._onDidRerender.event;
    this._onDidDispose = this._register(new Emitter());
    this.onDidDispose = this._onDidDispose.event;
    this._onDidFocusOutside = this._register(new Emitter());
    this.onDidFocusOutside = this._onDidFocusOutside.event;
    this._onDidChangeItemHeight = this._register(new Emitter());
    this.onDidChangeItemHeight = this._onDidChangeItemHeight.event;
    this._onDidUpdateViewModel = this._register(new Emitter());
    this._currentLayoutWidth = observableValue(this, 0);
    this._isVisible = true;
    this._onDidChangeVisibility = this._register(new Emitter());
    /** Whether we have already logged the incremental-rendering telemetry event for this renderer instance. */
    this._incrementalRenderingTelemetryLogged = false;
    /**
     * Prevents re-announcement of already rendered chat progress
     * by screen readers
     */
    this._announcedToolProgressKeys = /* @__PURE__ */ new Set();
    this.chatContentMarkdownRenderer = this.instantiationService.createInstance(ChatContentMarkdownRenderer);
    this.markdownDecorationsRenderer = this.instantiationService.createInstance(ChatMarkdownDecorationsRenderer);
    this._editorPool = this._register(this.instantiationService.createInstance(EditorPool, editorOptions, delegate, overflowWidgetsDomNode, true));
    this._toolEditorPool = this._register(this.instantiationService.createInstance(EditorPool, editorOptions, delegate, overflowWidgetsDomNode, true));
    this._diffEditorPool = this._register(this.instantiationService.createInstance(DiffEditorPool, editorOptions, delegate, overflowWidgetsDomNode, true));
    this._treePool = this._register(this.instantiationService.createInstance(TreePool, this._onDidChangeVisibility.event));
    this._contentReferencesListPool = this._register(this.instantiationService.createInstance(CollapsibleListPool, this._onDidChangeVisibility.event, void 0, void 0));
    this._inlineTextModels = this._register(this.instantiationService.createInstance(InlineTextModelCollection));
    this._register(this.instantiationService.createInstance(ChatCodeBlockContentProvider));
    this._register(this.chatService.onDidSubmitRequest((e) => {
      const carousels = this.pendingQuestionCarousels.get(e.chatSessionResource);
      if (carousels) {
        for (const carousel of carousels) {
          carousel.skip();
        }
        carousels.clear();
      }
    }));
    this._register(this.configService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(ChatConfiguration.AutoReply) && this.configService.getValue(ChatConfiguration.AutoReply)) {
        for (const [, carousels] of this.pendingQuestionCarousels) {
          for (const carousel of carousels) {
            carousel.skip();
          }
          carousels.clear();
        }
      }
    }));
  }
  static {
    this.ID = "item";
  }
  set pendingDragController(controller) {
    this._pendingDragController = controller;
  }
  updateOptions(options) {
    this.rendererOptions = { ...this.rendererOptions, ...options };
  }
  get templateId() {
    return ChatListItemRenderer.ID;
  }
  editorsInUse() {
    return Iterable.concat(this._editorPool.inUse(), this._toolEditorPool.inUse());
  }
  traceLayout(method, message) {
    if (forceVerboseLayoutTracing) {
      this.logService.info(`ChatListItemRenderer#${method}: ${message}`);
    } else {
      this.logService.trace(`ChatListItemRenderer#${method}: ${message}`);
    }
  }
  fireItemHeightChange(template, measuredHeight) {
    if (!template.currentElement || !template.rowContainer.isConnected) {
      return;
    }
    const height = measuredHeight ?? template.rowContainer.getBoundingClientRect().height;
    if (height === 0 || !height) {
      return;
    }
    const normalizedHeight = Math.ceil(height);
    const element = template.currentElement;
    const update = reconcileChatItemHeight(
      normalizedHeight,
      element.currentRenderedHeight,
      element === this._elementBeingRendered,
      template.allocatedHeight
    );
    element.currentRenderedHeight = update.nextRenderedHeight;
    if (update.kind === "fire") {
      this._onDidChangeItemHeight.fire({ element, height: update.height });
    } else if (update.kind === "scheduleInitial") {
      const scheduledHeight = update.height;
      dom.scheduleAtNextAnimationFrame(dom.getWindow(template.rowContainer), () => {
        if (template.currentElement !== element || element.currentRenderedHeight !== scheduledHeight) {
          return;
        }
        this._onDidChangeItemHeight.fire({ element, height: scheduledHeight });
      });
    } else if (update.kind === "deferReMeasure") {
      dom.scheduleAtNextAnimationFrame(dom.getWindow(template.rowContainer), () => {
        if (template.currentElement === element && element !== this._elementBeingRendered) {
          this.fireItemHeightChange(template);
        }
      });
    }
  }
  /**
   * Compute a rate to render at in words/s.
   */
  getProgressiveRenderRate(element) {
    let Rate;
    ((Rate2) => {
      Rate2[Rate2["Min"] = 40] = "Min";
      Rate2[Rate2["Max"] = 2e3] = "Max";
    })(Rate || (Rate = {}));
    const minAfterComplete = 80;
    const rate = element.contentUpdateTimings?.impliedWordLoadRate;
    if (element.isComplete) {
      if (typeof rate === "number") {
        return clamp(rate, minAfterComplete, 2e3 /* Max */);
      } else {
        return minAfterComplete;
      }
    }
    if (typeof rate === "number") {
      return clamp(rate, 40 /* Min */, 2e3 /* Max */);
    }
    return 8;
  }
  getCodeBlockInfosForResponse(response) {
    const codeBlocks = this.codeBlocksByResponseId.get(response.id);
    return codeBlocks ?? [];
  }
  updateViewModel(viewModel) {
    this.viewModel = viewModel;
    this._announcedToolProgressKeys.clear();
    this._notifiedQuestionCarousels.clear();
    this.codeBlocksByEditorUri.clear();
    this.codeBlocksByResponseId.clear();
    this.fileTreesByResponseId.clear();
    this.focusedFileTreesByResponseId.clear();
    this.responseTemplateDataByRequestId.clear();
    this.templateDataByRequestId.clear();
    this._onDidUpdateViewModel.fire();
    this._editorPool.clear();
    this._toolEditorPool.clear();
    this._diffEditorPool.clear();
    this._treePool.clear();
    this._contentReferencesListPool.clear();
  }
  getCodeBlockInfoForEditor(uri) {
    return this.codeBlocksByEditorUri.get(uri);
  }
  getFileTreeInfosForResponse(response) {
    const fileTrees = this.fileTreesByResponseId.get(response.id);
    return fileTrees ?? [];
  }
  getLastFocusedFileTreeForResponse(response) {
    const fileTrees = this.fileTreesByResponseId.get(response.id);
    const lastFocusedFileTreeIndex = this.focusedFileTreesByResponseId.get(response.id);
    if (fileTrees?.length && lastFocusedFileTreeIndex !== void 0 && lastFocusedFileTreeIndex < fileTrees.length) {
      return fileTrees[lastFocusedFileTreeIndex];
    }
    return void 0;
  }
  getTemplateDataForRequestId(requestId) {
    if (!requestId) {
      return void 0;
    }
    const templateData = this.templateDataByRequestId.get(requestId);
    if (templateData && templateData.currentElement?.id === requestId) {
      return templateData;
    }
    if (templateData) {
      this.templateDataByRequestId.delete(requestId);
    }
    return void 0;
  }
  setVisible(visible) {
    this._isVisible = visible;
    this._onDidChangeVisibility.fire(visible);
  }
  layout(width) {
    const newWidth = width - (this.rendererOptions.contentHorizontalPadding ?? DEFAULT_CHAT_ITEM_HORIZONTAL_PADDING);
    if (newWidth !== this._currentLayoutWidth.get()) {
      this._currentLayoutWidth.set(newWidth, void 0);
      for (const editor of this._editorPool.inUse()) {
        editor.layout(newWidth);
      }
      for (const toolEditor of this._toolEditorPool.inUse()) {
        toolEditor.layout(newWidth);
      }
      for (const diffEditor of this._diffEditorPool.inUse()) {
        diffEditor.layout(newWidth);
      }
    }
  }
  /**
   * Returns the currently rendered chat item containing the node.
   */
  getElementFromNode(node) {
    let current = node;
    while (current && this.delegate.container.contains(current)) {
      const element = this.templateDataByRow.get(current)?.currentElement;
      if (element) {
        return element;
      }
      current = current.parentElement;
    }
    return void 0;
  }
  renderTemplate(container) {
    const templateDisposables = new DisposableStore();
    const disabledOverlay = dom.append(container, $(".chat-row-disabled-overlay"));
    const rowContainer = dom.append(container, $(".interactive-item-container"));
    if (this.rendererOptions.renderStyle === "compact") {
      rowContainer.classList.add("interactive-item-compact");
    }
    let headerParent = rowContainer;
    let valueParent = rowContainer;
    let detailContainerParent;
    if (this.rendererOptions.renderStyle === "minimal") {
      rowContainer.classList.add("interactive-item-compact");
      rowContainer.classList.add("minimal");
      const lhsContainer = dom.append(rowContainer, $(".column.left"));
      const rhsContainer = dom.append(rowContainer, $(".column.right"));
      headerParent = lhsContainer;
      detailContainerParent = rhsContainer;
      valueParent = rhsContainer;
    }
    const header = dom.append(headerParent, $(".header"));
    const contextKeyService = templateDisposables.add(this.contextKeyService.createScoped(rowContainer));
    const scopedInstantiationService = templateDisposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, contextKeyService])));
    const requestHover = dom.append(rowContainer, $(".request-hover"));
    let titleToolbar;
    if (this.rendererOptions.noHeader) {
      header.classList.add("hidden");
    } else {
      titleToolbar = templateDisposables.add(scopedInstantiationService.createInstance(MenuWorkbenchToolBar, requestHover, MenuId.ChatMessageTitle, {
        menuOptions: {
          shouldForwardArgs: true
        },
        toolbarOptions: {
          shouldInlineSubmenu: (submenu) => submenu.actions.length <= 1
        }
      }));
    }
    this.hoverHidden(requestHover);
    const checkpointContainer = dom.append(rowContainer, $(".checkpoint-container"));
    dom.append(checkpointContainer, $(".checkpoint-line-left"));
    const checkpointToolbar = templateDisposables.add(scopedInstantiationService.createInstance(MenuWorkbenchToolBar, checkpointContainer, MenuId.ChatMessageCheckpoint, {
      actionViewItemProvider: (action, options) => {
        if (action instanceof MenuItemAction) {
          if (action.item.id === RestoreCheckpointActionId) {
            return this.instantiationService.createInstance(ChatRestoreCheckpointActionViewItem, action, { hoverDelegate: options.hoverDelegate }, (context) => this.checkpointRestoreNeedsConfirmation(context));
          }
          if (action.item.id === ForkConversationActionId) {
            return this.instantiationService.createInstance(ChatForkActionViewItem, action, { hoverDelegate: options.hoverDelegate });
          }
          return this.instantiationService.createInstance(CodiconActionViewItem, action, { hoverDelegate: options.hoverDelegate });
        }
        return void 0;
      },
      renderDropdownAsChildElement: true,
      menuOptions: {
        shouldForwardArgs: true
      },
      toolbarOptions: {
        shouldInlineSubmenu: (submenu) => submenu.actions.length <= 1
      }
    }));
    dom.append(checkpointContainer, $(".checkpoint-line-right"));
    const user = dom.append(header, $(".user"));
    const avatarContainer = dom.append(user, $(".avatar-container"));
    const username = dom.append(user, $("h3.username"));
    username.tabIndex = 0;
    const detailContainer = dom.append(detailContainerParent ?? user, $("span.detail-container"));
    const detail = dom.append(detailContainer, $("span.detail"));
    dom.append(detailContainer, $("span.chat-animated-ellipsis"));
    const value = dom.append(valueParent, $(".value"));
    const requestTimestampContainer = dom.append(valueParent, $(".chat-request-timestamp-container"));
    const elementDisposables = templateDisposables.add(new DisposableStore());
    const completedResponseDisclosureDisposables = templateDisposables.add(new DisposableStore());
    const responseTokenStatsHover = templateDisposables.add(new MutableDisposable());
    const footerToolbarContainer = dom.append(rowContainer, $(".chat-footer-toolbar"));
    if (this.rendererOptions.noFooter) {
      footerToolbarContainer.classList.add("hidden");
    }
    const footerToolbar = templateDisposables.add(scopedInstantiationService.createInstance(MenuWorkbenchToolBar, footerToolbarContainer, MenuId.ChatMessageFooter, {
      menuOptions: { shouldForwardArgs: true, renderShortTitle: true },
      toolbarOptions: { shouldInlineSubmenu: (submenu) => submenu.actions.length <= 1 },
      actionViewItemProvider: (action, options) => {
        if (action instanceof MenuItemAction && action.item.id === MarkHelpfulActionId) {
          const animation = upvoteAnimationSettingToEnum(this.configService.getValue("chat.upvoteAnimation"));
          return scopedInstantiationService.createInstance(MenuEntryActionViewItem, action, { ...options, onClickAnimation: animation });
        }
        return createActionViewItem(scopedInstantiationService, action, options);
      }
    }));
    const footerDetailsContainer = dom.append(footerToolbar.getElement(), $(".chat-footer-details"));
    footerDetailsContainer.tabIndex = 0;
    const checkpointRestoreContainer = dom.append(rowContainer, $(".checkpoint-restore-container"));
    dom.append(checkpointRestoreContainer, $(".checkpoint-line-left"));
    const label = dom.append(checkpointRestoreContainer, $("span.checkpoint-label-text"));
    label.textContent = localize("checkpointRestore", "Checkpoint Restored");
    const dot = dom.append(checkpointRestoreContainer, $("span.checkpoint-dot-separator"));
    dot.textContent = "\xB7";
    dot.setAttribute("aria-hidden", "true");
    const checkpointRestoreToolbar = templateDisposables.add(scopedInstantiationService.createInstance(MenuWorkbenchToolBar, checkpointRestoreContainer, MenuId.ChatMessageRestoreCheckpoint, {
      actionViewItemProvider: (action, options) => {
        if (action instanceof MenuItemAction) {
          return this.instantiationService.createInstance(CodiconActionViewItem, action, { hoverDelegate: options.hoverDelegate });
        }
        return void 0;
      },
      renderDropdownAsChildElement: true,
      menuOptions: {
        shouldForwardArgs: true
      },
      toolbarOptions: {
        shouldInlineSubmenu: (submenu) => submenu.actions.length <= 1
      }
    }));
    dom.append(checkpointRestoreContainer, $(".checkpoint-line-right"));
    const agentHover = templateDisposables.add(this.instantiationService.createInstance(ChatAgentHover));
    const hoverContent = () => {
      if (isResponseVM(template.currentElement) && template.currentElement.agent && !template.currentElement.agent.isDefault) {
        agentHover.setAgent(template.currentElement.agent.id);
        return agentHover.domNode;
      }
      return void 0;
    };
    const hoverOptions = getChatAgentHoverOptions(() => isResponseVM(template.currentElement) ? template.currentElement.agent : void 0, this.commandService);
    templateDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), user, hoverContent, hoverOptions));
    templateDisposables.add(dom.addDisposableListener(user, dom.EventType.KEY_DOWN, (e) => {
      const ev = new StandardKeyboardEvent(e);
      if (ev.equals(KeyCode.Space) || ev.equals(KeyCode.Enter)) {
        const content = hoverContent();
        if (content) {
          this.hoverService.showInstantHover({ content, target: user, trapFocus: true, actions: hoverOptions.actions }, true);
        }
      } else if (ev.equals(KeyCode.Escape)) {
        this.hoverService.hideHover();
      }
    }));
    const connectionObserver = document.createElement("connection-observer");
    dom.append(container, connectionObserver);
    const template = { header, avatarContainer, requestHover, username, detail, value, requestTimestampContainer, rowContainer, elementDisposables, templateDisposables, contextKeyService, instantiationService: scopedInstantiationService, agentHover, titleToolbar, footerToolbar, footerToolbarContainer, footerDetailsContainer, disabledOverlay, checkpointToolbar, checkpointRestoreToolbar, checkpointContainer, checkpointRestoreContainer, completedResponseDisclosureDisposables, responseTokenStatsHover };
    this.templateDataByRow.set(rowContainer, template);
    templateDisposables.add(this._onDidUpdateViewModel.event(() => {
      if (!template.currentElement || !this.viewModel?.sessionResource || !isEqual(template.currentElement.sessionResource, this.viewModel.sessionResource)) {
        this.clearRenderedParts(template);
      }
    }));
    templateDisposables.add(dom.addDisposableListener(disabledOverlay, dom.EventType.CLICK, (e) => {
      if (!this.viewModel?.editing) {
        return;
      }
      const current = template.currentElement;
      if (!current || current.id === this.viewModel.editing.id) {
        return;
      }
      if (disabledOverlay.classList.contains("disabled")) {
        e.preventDefault();
        e.stopPropagation();
        this._onDidFocusOutside.fire();
      }
    }));
    const resizeObserver = templateDisposables.add(new dom.DisposableResizeObserver("ChatListItemRenderer.itemHeight", (entries) => {
      const entry = entries[0];
      if (entry) {
        this.fireItemHeightChange(template, entry.borderBoxSize.at(0)?.blockSize);
      }
    }));
    const resizeObservation = templateDisposables.add(new MutableDisposable());
    connectionObserver.onDidConnect = () => {
      resizeObservation.value = resizeObserver.observe(rowContainer);
    };
    connectionObserver.onDidDisconnect = () => {
      template.renderedPartsMounted = false;
      resizeObservation.clear();
    };
    if (rowContainer.isConnected) {
      connectionObserver.onDidConnect();
    }
    return template;
  }
  /**
   * Determines whether restoring to the checkpoint at the given chat item
   * would discard file edits that the user should confirm in-place. Used by
   * the "Restore Checkpoint" button to present an inline confirm/cancel
   * affordance for agent host sessions, which do not surface the modal
   * removal-confirmation dialog used by the standard editing session.
   */
  checkpointRestoreNeedsConfirmation(context) {
    if (!isRequestVM(context) && !isResponseVM(context)) {
      return false;
    }
    const requestId = isRequestVM(context) ? context.id : context.requestId;
    const model = this.chatService.getSession(context.sessionResource);
    const session = model?.editingSession;
    if (!model || !(session instanceof AgentHostSnapshotController)) {
      return false;
    }
    const requests = model.getRequests();
    const index = requests.findIndex((request) => request.id === requestId);
    if (index === -1) {
      return false;
    }
    return requests.slice(index).some((request) => session.hasEditsInRequest(request.id));
  }
  renderElement(node, index, templateData, details) {
    templateData.allocatedHeight = details?.height;
    this._elementBeingRendered = node.element;
    try {
      this.renderChatTreeItem(node.element, index, templateData);
    } finally {
      this._elementBeingRendered = void 0;
    }
  }
  /**
   * Dispose the rendered parts in the template, which aren't done in disposeElement
   * so they can be reused when a new render is started.
   */
  clearRenderedParts(templateData) {
    this.removeCompletedResponseDisclosure(templateData);
    if (templateData.renderedParts) {
      dispose(coalesce(templateData.renderedParts));
      templateData.renderedParts = void 0;
      templateData.renderedContent = void 0;
      dom.clearNode(templateData.value);
    } else if (isPendingDividerVM(templateData.currentElement)) {
      dom.clearNode(templateData.value);
    }
    templateData.movedOutToolParts?.dispose();
    templateData.movedOutToolParts = void 0;
    if (templateData.titleToolbar) {
      templateData.titleToolbar.context = void 0;
    }
    templateData.footerToolbar.context = void 0;
    templateData.checkpointToolbar.context = void 0;
    templateData.checkpointRestoreToolbar.context = void 0;
    templateData.currentElement = void 0;
    templateData.completedResponseDisclosureOpen = void 0;
    templateData.completedResponseCollapseEndIndex = void 0;
    templateData.wasResponseComplete = void 0;
  }
  renderChatTreeItem(element, index, templateData) {
    if (templateData.currentElement && templateData.currentElement.id !== element.id) {
      this.traceLayout("renderChatTreeItem", `Rendering a different element into the template, index=${index}`);
      const mappedTemplateData = this.templateDataByRequestId.get(templateData.currentElement.id);
      if (mappedTemplateData && mappedTemplateData.currentElement?.id !== templateData.currentElement.id) {
        this.templateDataByRequestId.delete(templateData.currentElement.id);
      }
      this.clearRenderedParts(templateData);
    }
    templateData.currentElement = element;
    this.templateDataByRequestId.set(element.id, templateData);
    templateData.rowContainer.classList.remove("pending-item", "pending-divider", "pending-request", "chat-pending-dragging", "terminal-command-request");
    templateData.dragHandle?.remove();
    templateData.dragHandle = void 0;
    delete templateData.rowContainer.dataset.pendingRequestId;
    delete templateData.rowContainer.dataset.pendingKind;
    if (isPendingDividerVM(element)) {
      this.renderPendingDivider(element, templateData);
      return;
    }
    const kind = isRequestVM(element) ? "request" : isResponseVM(element) ? "response" : isPendingDividerVM(element) ? "pendingDivider" : "welcome";
    this.traceLayout("renderElement", `${kind}, index=${index}`);
    ChatContextKeys.isResponse.bindTo(templateData.contextKeyService).set(isResponseVM(element));
    ChatContextKeys.itemId.bindTo(templateData.contextKeyService).set(element.id);
    ChatContextKeys.isRequest.bindTo(templateData.contextKeyService).set(isRequestVM(element));
    ChatContextKeys.isFirstRequest.bindTo(templateData.contextKeyService).set(isRequestVM(element) && this.viewModel?.model.getRequests()[0]?.id === element.id);
    ChatContextKeys.isPendingRequest.bindTo(templateData.contextKeyService).set(isRequestVM(element) && !!element.pendingKind);
    ChatContextKeys.responseDetectedAgentCommand.bindTo(templateData.contextKeyService).set(isResponseVM(element) && element.agentOrSlashCommandDetected);
    if (isResponseVM(element)) {
      ChatContextKeys.responseSupportsIssueReporting.bindTo(templateData.contextKeyService).set(!!element.agent?.metadata.supportIssueReporting);
      ChatContextKeys.responseVote.bindTo(templateData.contextKeyService).set(element.vote === ChatAgentVoteDirection.Up ? "up" : element.vote === ChatAgentVoteDirection.Down ? "down" : "");
    } else {
      ChatContextKeys.responseVote.bindTo(templateData.contextKeyService).set("");
    }
    if (templateData.titleToolbar) {
      templateData.titleToolbar.context = element;
    }
    templateData.footerToolbar.context = element;
    const responseTimingListeners = templateData.elementDisposables.add(new MutableDisposable());
    const updateResponseDetails = () => {
      const details = isResponseVM(element) ? element.result?.details : void 0;
      const tokenStats = isResponseVM(element) ? formatResponseTokenStats(element.model.usage?.modelTotals) : void 0;
      const completedAtElement = renderChatResponseDetails(
        templateData.footerDetailsContainer,
        details,
        isResponseVM(element) ? element.model.completionTimestamp : void 0,
        isResponseVM(element) ? element.model.elapsedMs : void 0,
        isResponseVM(element) && this.configService.getValue(ChatConfiguration.Verbose),
        tokenStats?.ariaLabel
      );
      const tokenStatsHover = templateData.responseTokenStatsHover;
      if (!tokenStats) {
        tokenStatsHover.clear();
      } else if (tokenStatsHover.value) {
        tokenStatsHover.value.update(tokenStats);
      } else {
        tokenStatsHover.value = this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), templateData.footerDetailsContainer, tokenStats);
      }
      if (!completedAtElement) {
        responseTimingListeners.clear();
        return;
      }
      const listeners = new DisposableStore();
      responseTimingListeners.value = listeners;
      let responseTimingBounds;
      listeners.add(dom.addDisposableListener(completedAtElement, dom.EventType.MOUSE_ENTER, (e) => {
        const bounds = completedAtElement.getBoundingClientRect();
        responseTimingBounds = bounds;
        templateData.footerDetailsContainer.classList.add("chat-response-flip-reset");
        templateData.footerDetailsContainer.classList.remove("chat-response-flip-active");
        templateData.footerDetailsContainer.classList.toggle("chat-response-flip-down", e.clientY < bounds.top + bounds.height / 2);
        void templateData.footerDetailsContainer.offsetWidth;
        templateData.footerDetailsContainer.classList.remove("chat-response-flip-reset");
        void templateData.footerDetailsContainer.offsetWidth;
        templateData.footerDetailsContainer.classList.add("chat-response-flip-active");
      }));
      listeners.add(dom.addDisposableListener(templateData.footerDetailsContainer, dom.EventType.MOUSE_MOVE, (e) => {
        if (responseTimingBounds && (e.clientX < responseTimingBounds.left || e.clientX > responseTimingBounds.right || e.clientY < responseTimingBounds.top || e.clientY > responseTimingBounds.bottom)) {
          responseTimingBounds = void 0;
          templateData.footerDetailsContainer.classList.remove("chat-response-flip-active");
        }
      }));
      listeners.add(dom.addDisposableListener(templateData.footerDetailsContainer, dom.EventType.MOUSE_LEAVE, () => {
        responseTimingBounds = void 0;
        templateData.footerDetailsContainer.classList.remove("chat-response-flip-active");
      }));
      listeners.add(dom.addDisposableListener(templateData.footerDetailsContainer, dom.EventType.FOCUS, () => {
        templateData.footerDetailsContainer.classList.remove("chat-response-flip-active", "chat-response-flip-down");
      }));
    };
    updateResponseDetails();
    ChatContextKeys.responseHasError.bindTo(templateData.contextKeyService).set(isResponseVM(element) && !!element.errorDetails);
    const isFiltered = !!(isResponseVM(element) && element.errorDetails?.responseIsFiltered);
    ChatContextKeys.responseIsFiltered.bindTo(templateData.contextKeyService).set(isFiltered);
    const location = this.chatWidgetService.getWidgetBySessionResource(element.sessionResource)?.location;
    templateData.rowContainer.classList.toggle("editing-session", location === ChatAgentLocation.Chat);
    templateData.rowContainer.classList.toggle("interactive-request", isRequestVM(element));
    templateData.rowContainer.classList.toggle("interactive-response", isResponseVM(element));
    const progressMessageAtBottomOfResponse = checkModeOption(this.delegate.currentChatMode(), this.rendererOptions.progressMessageAtBottomOfResponse);
    templateData.rowContainer.classList.toggle("show-detail-progress", isResponseVM(element) && !element.isComplete && !element.progressMessages.length && !progressMessageAtBottomOfResponse);
    templateData.rowContainer.classList.toggle("chat-progress-reservable", isResponseVM(element) && !element.isComplete && !!progressMessageAtBottomOfResponse);
    const updateContainerCheckmarks = () => templateData.rowContainer.classList.toggle("show-checkmarks", !!this.configService.getValue(AccessibilityWorkbenchSettingId.ShowChatCheckmarks));
    updateContainerCheckmarks();
    const updateVerboseDetails = () => templateData.rowContainer.classList.toggle("show-verbose-details", !!this.configService.getValue(ChatConfiguration.Verbose));
    updateVerboseDetails();
    templateData.elementDisposables.add(this.configService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(AccessibilityWorkbenchSettingId.ShowChatCheckmarks)) {
        updateContainerCheckmarks();
      }
      if (e.affectsConfiguration(ChatConfiguration.Verbose)) {
        updateVerboseDetails();
        updateResponseDetails();
      }
      if (e.affectsConfiguration(ChatConfiguration.CollapseCompletedResponses) && isResponseVM(element)) {
        this.updateCompletedResponseDisclosure(element, templateData.renderedContent ?? [], templateData, false);
      }
    }));
    if (!this.rendererOptions.noHeader) {
      this.renderAvatar(element, templateData);
    }
    const isSystemInitiatedRequest = isRequestVM(element) && !!element.isSystemInitiated;
    templateData.username.textContent = element.username;
    const hideChatUserIdentity = shouldHideChatUserIdentity(element.username, element.sessionResource, isResponseVM(element), this.environmentService.isSessionsWindow, isSystemInitiatedRequest);
    templateData.username.classList.toggle("hidden", hideChatUserIdentity);
    templateData.avatarContainer.classList.toggle("hidden", hideChatUserIdentity);
    this.hoverHidden(templateData.requestHover);
    dom.clearNode(templateData.detail);
    dom.clearNode(templateData.requestTimestampContainer);
    if (isResponseVM(element)) {
      this.renderDetail(element, templateData);
    }
    templateData.checkpointToolbar.context = element;
    const supportsForkOrRestoration = this.rendererOptions.supportsFork || (this.rendererOptions.restorable ?? true);
    const checkpointEnabled = this.configService.getValue(ChatConfiguration.CheckpointsEnabled) && supportsForkOrRestoration;
    const isPendingRequest = isRequestVM(element) && !!element.pendingKind;
    templateData.checkpointContainer.classList.toggle("hidden", isResponseVM(element) || isPendingRequest || isSystemInitiatedRequest || !checkpointEnabled);
    templateData.footerToolbar.refresh();
    templateData.checkpointToolbar.refresh();
    templateData.checkpointRestoreToolbar.refresh();
    if (isResponseVM(element)) {
      this.responseTemplateDataByRequestId.set(element.requestId, templateData);
      templateData.elementDisposables.add(toDisposable(() => this.responseTemplateDataByRequestId.delete(element.requestId)));
    }
    if (!isPendingRequest) {
      const setGroupHover = (hovered) => {
        const requestId = isRequestVM(element) ? element.id : isResponseVM(element) ? element.requestId : void 0;
        if (!requestId) {
          return;
        }
        const reqData = this.templateDataByRequestId.get(requestId);
        const resData = this.responseTemplateDataByRequestId.get(requestId);
        reqData?.rowContainer.classList.toggle("group-hovered", hovered);
        reqData?.checkpointContainer.classList.toggle("group-hovered", hovered);
        resData?.rowContainer.classList.toggle("group-hovered", hovered);
      };
      const hoverTargets = isResponseVM(element) ? [templateData.value, templateData.footerToolbarContainer] : [templateData.rowContainer];
      const isHoverTarget = (target) => dom.isHTMLElement(target) && hoverTargets.some((hoverTarget) => hoverTarget.contains(target));
      for (const hoverTarget of hoverTargets) {
        templateData.elementDisposables.add(dom.addDisposableListener(hoverTarget, dom.EventType.MOUSE_ENTER, () => setGroupHover(true)));
        templateData.elementDisposables.add(dom.addDisposableListener(hoverTarget, dom.EventType.MOUSE_LEAVE, (e) => {
          if (!isHoverTarget(e.relatedTarget)) {
            setGroupHover(false);
          }
        }));
      }
      templateData.elementDisposables.add(toDisposable(() => setGroupHover(false)));
    }
    const shouldShowRestore = this.viewModel?.model.checkpoint && !this.viewModel?.editing && index === this.delegate.getListLength() - 1 && !isPendingRequest;
    templateData.checkpointRestoreContainer.classList.toggle("hidden", !(shouldShowRestore && checkpointEnabled));
    const editing = element.id === this.viewModel?.editing?.id;
    const isInput = this.configService.getValue("chat.editRequests") === "input";
    templateData.elementDisposables.add(autorun((r) => {
      const shouldBeBlocked = element.shouldBeBlocked.read(r);
      templateData.disabledOverlay.classList.toggle("disabled", shouldBeBlocked && !editing && this.viewModel?.editing !== void 0);
    }));
    templateData.rowContainer.classList.toggle("editing", editing && !isInput);
    templateData.rowContainer.classList.toggle("editing-input", editing && isInput);
    templateData.requestHover.classList.toggle("editing", editing && isInput);
    templateData.requestHover.classList.toggle("hidden", !!this.viewModel?.editing && !editing || isResponseVM(element) || !this.rendererOptions.editable || isSystemInitiatedRequest);
    templateData.requestHover.classList.toggle("expanded", this.configService.getValue("chat.editRequests") === "hover");
    templateData.requestHover.classList.toggle("checkpoints-enabled", checkpointEnabled);
    templateData.elementDisposables.add(dom.addStandardDisposableListener(templateData.rowContainer, dom.EventType.CLICK, (e) => {
      const current = templateData.currentElement;
      if (current && this.viewModel?.editing && current.id !== this.viewModel.editing.id) {
        e.stopPropagation();
        e.preventDefault();
        this._onDidFocusOutside.fire();
      }
    }));
    const rowRoot = templateData.rowContainer.parentElement?.parentElement?.parentElement;
    rowRoot?.classList.toggle("request", isRequestVM(element));
    rowRoot?.classList.toggle("response", isResponseVM(element));
    templateData.rowContainer.classList.toggle(mostRecentResponseClassName, index === this.delegate.getListLength() - 1);
    templateData.rowContainer.classList.toggle("confirmation-message", isRequestVM(element) && !!element.confirmation);
    const isStickyScrollTargetItem = getStickyScrollTargetItem(this.viewModel?.getItems() ?? []) === element;
    const shouldShowHeader = isResponseVM(element) && !this.rendererOptions.noHeader && !isSystemInitiatedRequest;
    templateData.header?.classList.toggle("header-disabled", !shouldShowHeader);
    if (isRequestVM(element) && element.confirmation) {
      this.renderConfirmationAction(element, templateData);
    }
    const incrementalRendering = this.configService.getValue(ChatConfiguration.IncrementalRendering);
    if (isResponseVM(element) && isStickyScrollTargetItem && (!element.isComplete || element.renderData)) {
      this.traceLayout("renderElement", `start progressive render, index=${index}`);
      if (incrementalRendering && !element.renderData) {
        this.logIncrementalRenderingTelemetry();
        this.doIncrementalRender(element, index, templateData);
      } else {
        const timer = templateData.elementDisposables.add(new dom.WindowIntervalTimer());
        const runProgressiveRender = (initial) => {
          try {
            if (this.doNextProgressiveRender(element, index, templateData, !!initial)) {
              timer.cancel();
            }
          } catch (err) {
            timer.cancel();
            this.logService.error(err);
          }
        };
        timer.cancelAndSet(runProgressiveRender, 50, dom.getWindow(templateData.rowContainer));
        runProgressiveRender(true);
      }
    } else {
      if (isResponseVM(element)) {
        if (incrementalRendering) {
          const rate = this.getProgressiveRenderRate(element);
          this._updateMorpherRate(templateData, rate, true);
        }
        this.renderChatResponseBasic(element, index, templateData);
      } else if (isRequestVM(element)) {
        this.renderChatRequest(element, index, templateData);
      }
    }
    templateData.renderedPartsMounted = true;
  }
  renderPendingDivider(element, templateData) {
    templateData.rowContainer.classList.add("pending-item");
    templateData.rowContainer.classList.add("pending-divider");
    templateData.rowContainer.classList.remove("interactive-request", "interactive-response", "pending-request");
    templateData.avatarContainer.classList.add("hidden");
    templateData.username.classList.add("hidden");
    templateData.requestHover.classList.add("hidden");
    templateData.checkpointContainer.classList.add("hidden");
    templateData.checkpointRestoreContainer.classList.add("hidden");
    templateData.footerToolbar.getElement().classList.add("hidden");
    if (templateData.titleToolbar) {
      templateData.titleToolbar.getElement().classList.add("hidden");
    }
    dom.clearNode(templateData.value);
    dom.clearNode(templateData.detail);
    dom.clearNode(templateData.requestTimestampContainer);
    const dividerContent = dom.$(".pending-divider-content");
    const label = dom.append(dividerContent, dom.$("span.pending-divider-label"));
    if (element.dividerKind === ChatRequestQueueKind.Steering) {
      if (element.isSystemInitiated) {
        label.textContent = localize("systemNotificationDivider", "System Notification");
        label.title = localize("systemNotificationDividerTooltip", "System notification will be sent after the next tool call happens");
      } else {
        label.textContent = localize("steeringDivider", "Steering");
        label.title = localize("steeringDividerTooltip", "Steering message will be sent after the next tool call happens");
      }
    } else {
      label.textContent = localize("queuedDivider", "Queued");
      label.title = localize("queuedDividerTooltip", "Queued messages will be sent after the current request completes");
    }
    templateData.value.appendChild(dividerContent);
  }
  renderDetail(element, templateData) {
    dom.clearNode(templateData.detail);
    if (element.agentOrSlashCommandDetected) {
      const msg = element.slashCommand ? localize("usedAgentSlashCommand", "used {0} [[(rerun without)]]", `${chatSubcommandLeader}${element.slashCommand.name}`) : localize("usedAgent", "[[(rerun without)]]");
      dom.reset(templateData.detail, renderFormattedText(msg, {
        actionHandler: {
          disposables: templateData.elementDisposables,
          callback: (content) => {
            this._onDidClickRerunWithAgentOrCommandDetection.fire(element);
          }
        }
      }, $("span.agentOrSlashCommandDetected")));
    } else if (this.rendererOptions.renderStyle !== "minimal" && !element.isComplete && !checkModeOption(this.delegate.currentChatMode(), this.rendererOptions.progressMessageAtBottomOfResponse)) {
      templateData.detail.textContent = localize("working", "Working");
    }
  }
  renderConfirmationAction(element, templateData) {
    dom.clearNode(templateData.detail);
    if (element.confirmation) {
      dom.append(templateData.detail, $("span.codicon.codicon-check", { "aria-hidden": "true" }));
      dom.append(templateData.detail, $("span.confirmation-text", void 0, localize("chatConfirmationAction", 'Selected "{0}"', element.confirmation)));
      templateData.header?.classList.remove("header-disabled");
      templateData.header?.classList.add("partially-disabled");
    }
  }
  renderAvatar(element, templateData) {
    if (isPendingDividerVM(element)) {
      return;
    }
    let icon;
    if (isResponseVM(element)) {
      icon = this.getAgentIcon(element.agent?.metadata);
    } else if (isRequestVM(element)) {
      icon = element.avatarIcon ?? Codicon.account;
    } else {
      icon = Codicon.account;
    }
    if (icon instanceof URI) {
      const avatarIcon = dom.$("img.icon");
      avatarIcon.src = FileAccess.uriToBrowserUri(icon).toString(true);
      templateData.avatarContainer.replaceChildren(dom.$(".avatar", void 0, avatarIcon));
    } else {
      const avatarIcon = dom.$(ThemeIcon.asCSSSelector(icon));
      templateData.avatarContainer.replaceChildren(dom.$(".avatar.codicon-avatar", void 0, avatarIcon));
    }
  }
  getAgentIcon(agent) {
    if (agent?.themeIcon) {
      return agent.themeIcon;
    } else if (agent?.iconDark && isDark(this.themeService.getColorTheme().type)) {
      return agent.iconDark;
    } else if (agent?.icon) {
      return agent.icon;
    } else {
      return Codicon.chatSparkle;
    }
  }
  renderChatResponseBasic(element, index, templateData) {
    templateData.rowContainer.classList.toggle("chat-response-loading", isResponseVM(element) && !element.isComplete);
    this.finalizeCompletedResponseParts(element, templateData);
    const content = [];
    const isFiltered = !!element.errorDetails?.responseIsFiltered;
    if (!isFiltered) {
      content.push({ kind: "references", references: element.contentReferences });
      const responseContent = annotateSpecialMarkdownContent(element.response.value);
      content.push(...element.isComplete ? moveSessionCreatedToolsAfterFinalResponse(responseContent) : responseContent);
      if (element.codeCitations.length) {
        content.push({ kind: "codeCitations", citations: element.codeCitations });
      }
    }
    if (element.model.response === element.model.entireResponse && !element.isCanceled && element.errorDetails?.message && element.errorDetails.message !== canceledName) {
      content.push({ kind: "errorDetails", errorDetails: element.errorDetails, isLast: getStickyScrollTargetItem(this.viewModel?.getItems() ?? []) === element });
    }
    const fileChangesSummaryPart = this.getChatFileChangesSummaryPart(element);
    if (fileChangesSummaryPart) {
      content.push(fileChangesSummaryPart);
    }
    const turnPillsPart = this.getChatTurnPillsPart(element);
    if (turnPillsPart) {
      content.push(turnPillsPart);
    }
    const workingProgress = this.shouldShowWorkingProgress(element, content, false, templateData);
    if (workingProgress) {
      content.push(workingProgress);
    }
    const diff = this.diff(templateData.renderedParts ?? [], content, element);
    this.renderChatContentDiff(diff, content, element, index, templateData);
    this.finalizeCompletedResponseParts(element, templateData);
  }
  finalizeCompletedResponseParts(element, templateData) {
    if (!element.isComplete && !element.isCanceled) {
      return;
    }
    const lastThinking = this.getLastThinkingPart(templateData.renderedParts);
    if (lastThinking?.domNode && lastThinking.getIsActive()) {
      lastThinking.finalizeTitleIfDefault();
      lastThinking.markAsInactive();
    }
    this.finalizeAllSubagentParts(templateData, true);
  }
  shouldShowWorkingProgress(element, partsToRender, moreContentAvailable, templateData) {
    if (element.agentOrSlashCommandDetected || this.rendererOptions.renderStyle === "minimal" || element.isComplete || !checkModeOption(this.delegate.currentChatMode(), this.rendererOptions.progressMessageAtBottomOfResponse)) {
      return void 0;
    }
    if (partsToRender.some((part) => part.kind === "planReview" && !part.isUsed)) {
      return void 0;
    }
    if (endsWithActiveSubagentContent(partsToRender)) {
      return void 0;
    }
    if (isResponseVM(element)) {
      const widget = this.chatWidgetService.getWidgetBySessionResource(element.sessionResource);
      if (widget?.inputPart.hasActiveToolConfirmationCarousel) {
        const nonSubagentConfirmationCount = this.getPendingToolConfirmationCount(partsToRender, false);
        if (nonSubagentConfirmationCount > 0) {
          return {
            kind: "working",
            content: new MarkdownString().appendText(this.getConfirmationPendingLabel(nonSubagentConfirmationCount))
          };
        }
        if (this.getPendingToolConfirmationCount(partsToRender, true) > 0) {
          return void 0;
        }
        return {
          kind: "working",
          content: new MarkdownString().appendText(this.getConfirmationPendingLabel(1))
        };
      }
    }
    if (isWaitingForMcpServers(partsToRender)) {
      return void 0;
    }
    const workingParts = getWorkingProgressRelevantParts(partsToRender);
    const lastPart = findLastMeaningfulPart(workingParts);
    const endsWithCompletedQuestion = endsWithCompletedQuestionInteraction(workingParts);
    if (workingParts.some((part) => part.kind === "toolInvocation" && IChatToolInvocation.isStreaming(part))) {
      return void 0;
    }
    if (workingParts.some((part) => part.kind === "toolInvocation" && !IChatToolInvocation.isComplete(part) && isMcpToolInvocation(part))) {
      return void 0;
    }
    const lastThinking = this.getLastThinkingPart(templateData.renderedParts);
    if (lastThinking && !endsWithCompletedQuestion) {
      return void 0;
    }
    if (lastPart && (lastPart.kind === "toolInvocation" || lastPart.kind === "toolInvocationSerialized")) {
      if (lastPart.isAttachedToThinking) {
        return void 0;
      }
      const isEffectivelyHiddenToolInvocation = IChatToolInvocation.isEffectivelyHidden(lastPart);
      const collapsedToolsMode = this.configService.getValue("chat.agent.thinking.collapsedTools");
      if (!isEffectivelyHiddenToolInvocation && collapsedToolsMode !== CollapsedToolsDisplayMode.Off && this.shouldPinPart(lastPart, isResponseVM(element) ? element : void 0)) {
        return void 0;
      }
    }
    const hasRenderedThinkingPart = (templateData.renderedParts ?? []).some((part) => part instanceof ChatThinkingContentPart);
    const hasEditPillMarkdown = workingParts.some((part) => part.kind === "markdownContent" && this.hasEditCodeblockUri(part));
    if (hasRenderedThinkingPart && hasEditPillMarkdown) {
      return void 0;
    }
    if (!lastPart || lastPart.kind === "references" || lastPart.kind === "markdownContent" && !moreContentAvailable && this.hasBeenCaughtUpLongEnough(element) || (lastPart.kind === "toolInvocation" || lastPart.kind === "toolInvocationSerialized") && (IChatToolInvocation.isComplete(lastPart) || IChatToolInvocation.isEffectivelyHidden(lastPart)) || (lastPart.kind === "textEditGroup" || lastPart.kind === "notebookEditGroup") && lastPart.done && !workingParts.some((part) => part.kind === "toolInvocation" && !IChatToolInvocation.isComplete(part)) || lastPart.kind === "externalEdit" && !workingParts.some((part) => part.kind === "toolInvocation" && !IChatToolInvocation.isComplete(part)) || lastPart.kind === "progressTask" && lastPart.deferred.isSettled || endsWithCompletedQuestion || lastPart.kind === "mcpServersStarting" || lastPart.kind === "mcpAuthenticationRequired" || lastPart.kind === "mcpServersStartingSlow" || lastPart.kind === "disabledClaudeHooks" || lastPart.kind === "hook") {
      return { kind: "working" };
    }
    return void 0;
  }
  getPendingToolConfirmationCount(parts, includeSubagentConfirmations) {
    return parts.filter((part) => {
      if (part.kind !== "toolInvocation") {
        return false;
      }
      const state = part.state.get();
      return state.type === IChatToolInvocation.StateKind.WaitingForConfirmation && !!state.confirmationMessages?.title && part.presentation !== "hidden" && part.source.type !== "mcp" && isSubagentToolInvocation(part) === includeSubagentConfirmations;
    }).length;
  }
  getConfirmationPendingLabel(count) {
    return count === 1 ? localize("confirmationPending", "1 confirmation pending") : localize("confirmationsPending", "{0} confirmations pending", count);
  }
  removeWorkingProgressContentPart(templateData) {
    const renderedParts = templateData.renderedParts;
    if (!renderedParts) {
      return;
    }
    for (let i = renderedParts.length - 1; i >= 0; i--) {
      const part = renderedParts[i];
      if (part instanceof ChatWorkingProgressContentPart) {
        part.dispose();
        part.domNode?.remove();
        renderedParts.splice(i, 1);
        this.fireItemHeightChange(templateData);
        return;
      }
    }
  }
  updateWorkingProgressForPendingConfirmations(templateData) {
    const originalElement = templateData.currentElement;
    queueMicrotask(() => {
      if (templateData.currentElement !== originalElement) {
        return;
      }
      this.doUpdateWorkingProgressForPendingConfirmations(templateData);
    });
  }
  doUpdateWorkingProgressForPendingConfirmations(templateData) {
    const element = templateData.currentElement;
    if (!isResponseVM(element)) {
      return;
    }
    const pendingConfirmationCount = this.getPendingToolConfirmationCount(element.response.value, false);
    if (pendingConfirmationCount === 0) {
      this.removeWorkingProgressContentPart(templateData);
      return;
    }
    const workingProgressPart = this.getWorkingProgressContentPart(templateData);
    if (workingProgressPart) {
      workingProgressPart.updateWorkingContent(new MarkdownString().appendText(this.getConfirmationPendingLabel(pendingConfirmationCount)));
    }
  }
  getWorkingProgressContentPart(templateData) {
    const renderedParts = templateData.renderedParts;
    if (!renderedParts) {
      return void 0;
    }
    for (let i = renderedParts.length - 1; i >= 0; i--) {
      const part = renderedParts[i];
      if (part instanceof ChatWorkingProgressContentPart) {
        return part;
      }
    }
    return void 0;
  }
  createUpdateWorkingProgressOnConfirmationEnd(toolInvocation, templateData) {
    if (this.workingProgressConfirmationEndListeners.has(toolInvocation)) {
      return void 0;
    }
    this.workingProgressConfirmationEndListeners.add(toolInvocation);
    let wasWaitingForConfirmation = false;
    const disposable = autorun((reader) => {
      const currentState = toolInvocation.state.read(reader);
      const isWaitingForConfirmation = currentState.type === IChatToolInvocation.StateKind.WaitingForConfirmation;
      if (wasWaitingForConfirmation && !isWaitingForConfirmation) {
        this.updateWorkingProgressForPendingConfirmations(templateData);
        this.workingProgressConfirmationEndListeners.delete(toolInvocation);
        disposable.dispose();
      }
      wasWaitingForConfirmation = isWaitingForConfirmation;
    });
    return toDisposable(() => {
      this.workingProgressConfirmationEndListeners.delete(toolInvocation);
      disposable.dispose();
    });
  }
  hasBeenCaughtUpLongEnough(element) {
    const lastRenderTime = element.renderData?.lastRenderTime;
    if (typeof lastRenderTime !== "number" || lastRenderTime === 0) {
      return false;
    }
    return Date.now() - lastRenderTime >= WORKING_CAUGHT_UP_DEBOUNCE_MS;
  }
  /**
   * Returns the last part that visually contributes to the response, skipping
   * empty markdown placeholders.
   */
  /**
   * True while we have caught up to streamed markdown but are still within the
   * {@link WORKING_CAUGHT_UP_DEBOUNCE_MS} window before the working indicator
   * should appear. The progressive render loop keeps polling in this state so
   * the indicator can still surface after a genuine pause, instead of being
   * dropped when the loop would otherwise stop (the debounce itself avoids
   * flicker during normal token streaming).
   */
  isWorkingProgressDebouncePending(element, partsToRender) {
    if (element.isComplete) {
      return false;
    }
    if (partsToRender.some((part) => part.kind === "working")) {
      return false;
    }
    return findLastMeaningfulPart(getWorkingProgressRelevantParts(partsToRender))?.kind === "markdownContent" && !this.hasBeenCaughtUpLongEnough(element);
  }
  getChatFileChangesSummaryPart(element) {
    if (this.shouldShowPillsSummary(element) || !this.shouldShowFileChangesSummary(element)) {
      return void 0;
    }
    const sessionType = getChatSessionType(element.sessionResource);
    if (!isAgentHostTarget(sessionType) && !element.model.entireResponse.value.some((part) => part.kind === "textEditGroup" || part.kind === "notebookEditGroup")) {
      return void 0;
    }
    return { kind: "changesSummary", requestId: element.requestId, sessionResource: element.sessionResource };
  }
  getChatTurnPillsPart(element) {
    if (!this.shouldShowPillsSummary(element)) {
      return void 0;
    }
    return { kind: "turnPills", requestId: element.requestId, sessionResource: element.sessionResource };
  }
  renderChatRequest(element, index, templateData) {
    templateData.rowContainer.classList.toggle("chat-response-loading", false);
    templateData.rowContainer.classList.toggle("pending-request", !!element.pendingKind);
    templateData.rowContainer.classList.toggle("system-initiated-request", !!element.isSystemInitiated);
    templateData.rowContainer.classList.toggle("terminal-command-request", !element.isSystemInitiated && element.isTerminalCommand);
    if (element.isSystemInitiated) {
      this.renderSystemInitiatedRequest(element, templateData);
      return;
    }
    if (element.pendingKind && this._pendingDragController) {
      templateData.rowContainer.dataset.pendingRequestId = element.id;
      templateData.rowContainer.dataset.pendingKind = element.pendingKind;
      const sameKindCount = (this.viewModel?.model.getPendingRequests() ?? []).filter((p) => p.kind === element.pendingKind).length;
      if (sameKindCount > 1) {
        const handle = dom.$(".chat-pending-drag-handle" + ThemeIcon.asCSSSelector(Codicon.gripper));
        templateData.rowContainer.prepend(handle);
        templateData.dragHandle = handle;
        this._pendingDragController.attachDragHandle(element, handle, templateData.rowContainer, templateData.elementDisposables);
      }
    }
    if (element.id === this.viewModel?.editing?.id) {
      this._onDidRerender.fire(templateData);
    }
    if (this.configService.getValue("chat.editRequests") !== "none" && this.rendererOptions.editable) {
      templateData.elementDisposables.add(dom.addDisposableListener(templateData.rowContainer, dom.EventType.KEY_DOWN, (e) => {
        const ev = new StandardKeyboardEvent(e);
        if (ev.equals(KeyCode.Space) || ev.equals(KeyCode.Enter)) {
          if (this.viewModel?.editing?.id !== element.id) {
            ev.preventDefault();
            ev.stopPropagation();
            this._onDidClickRequest.fire(templateData);
          }
        }
      }));
    }
    let content = [];
    const explicitFileOrImageVariables = element.variables.filter(isExplicitFileOrImageVariableEntry);
    const explicitImageVariables = explicitFileOrImageVariables.filter((variable) => variable.kind === "image");
    const explicitFileOrDirectoryVariables = element.variables.filter((variable) => variable.kind === "file" || variable.kind === "directory" || isPasteVariableEntry(variable));
    const otherVariables = element.variables.filter((variable) => !isExplicitFileOrImageVariableEntry(variable) && !isPasteVariableEntry(variable));
    if (!element.confirmation) {
      const markdown = isChatFollowup(element.message) ? element.message.message : this.markdownDecorationsRenderer.convertParsedRequestToMarkdown(element.sessionResource, element.message);
      const attachmentSummary = !element.messageText.trim() && !explicitFileOrImageVariables.length ? getExplicitFileOrImageAttachmentSummary(element.variables) : void 0;
      const requestMarkdown = markdown.trim() ? markdown : attachmentSummary;
      if (requestMarkdown) {
        content = [{ content: new MarkdownString(requestMarkdown), kind: "markdownContent" }];
      }
      if (this.rendererOptions.renderStyle === "minimal" && !element.isComplete) {
        templateData.value.classList.add("inline-progress");
        templateData.elementDisposables.add(toDisposable(() => templateData.value.classList.remove("inline-progress")));
        content.push({ content: new MarkdownString("<span></span>", { supportHtml: true }), kind: "markdownContent" });
      } else {
        templateData.value.classList.remove("inline-progress");
      }
    }
    dom.clearNode(templateData.value);
    if (this.environmentService.isSessionsWindow && this.viewModel?.model.getRequests()[0]?.id === element.id) {
      const sideChatOriginPart = this.instantiationService.createInstance(ChatSideChatOriginPart, element.sessionResource);
      templateData.value.appendChild(sideChatOriginPart.domNode);
      templateData.elementDisposables.add(sideChatOriginPart);
    }
    const parts = [];
    const explicitImageAttachmentsPart = explicitImageVariables.length ? this.renderAttachments(explicitImageVariables, element.contentReferences, element.modelId, templateData, element.resolvedModelId) : void 0;
    if (explicitImageAttachmentsPart?.domNode) {
      explicitImageAttachmentsPart.domNode.classList.add("chat-request-attachment-cards", "chat-request-image-attachments");
      templateData.value.appendChild(explicitImageAttachmentsPart.domNode);
      templateData.elementDisposables.add(explicitImageAttachmentsPart);
    }
    const explicitFileAttachmentsPart = explicitFileOrDirectoryVariables.length ? this.renderAttachments(explicitFileOrDirectoryVariables, element.contentReferences, element.modelId, templateData) : void 0;
    if (explicitFileAttachmentsPart?.domNode) {
      explicitFileAttachmentsPart.domNode.classList.add("chat-request-attachment-cards", "chat-request-file-attachments");
      explicitFileAttachmentsPart.domNode.style.display = "flex";
      explicitFileAttachmentsPart.domNode.style.flexDirection = "column";
      explicitFileAttachmentsPart.domNode.style.alignItems = "flex-end";
      explicitFileAttachmentsPart.domNode.style.flexWrap = "nowrap";
      templateData.value.appendChild(explicitFileAttachmentsPart.domNode);
      templateData.elementDisposables.add(explicitFileAttachmentsPart);
    }
    const contentContainer = templateData.value;
    let inlineSlashCommandRendered = false;
    let codeBlockStartIndex = 0;
    content.forEach((data, contentIndex) => {
      const context = {
        element,
        elementIndex: index,
        contentIndex,
        content,
        container: templateData.rowContainer,
        editorPool: this._editorPool,
        diffEditorPool: this._diffEditorPool,
        currentWidth: this._currentLayoutWidth,
        onDidChangeVisibility: this._onDidChangeVisibility.event,
        inlineTextModels: this._inlineTextModels,
        codeBlockStartIndex,
        treeStartIndex: 0
        // no trees in requests
      };
      const newPart = this.renderChatContentPart(data, templateData, context);
      if (newPart) {
        if (this.rendererOptions.renderDetectedCommandsWithRequest && !inlineSlashCommandRendered && element.agentOrSlashCommandDetected && element.slashCommand && data.kind === "markdownContent") {
          if (newPart.domNode) {
            newPart.domNode.style.display = "inline-flex";
          }
          const cmdPart = this.instantiationService.createInstance(ChatAgentCommandContentPart, element.slashCommand, () => this._onDidClickRerunWithAgentOrCommandDetection.fire({ sessionResource: element.sessionResource, requestId: element.id }));
          contentContainer.appendChild(cmdPart.domNode);
          parts.push(cmdPart);
          inlineSlashCommandRendered = true;
        }
        if (newPart.domNode && !newPart.domNode.parentElement) {
          contentContainer.appendChild(newPart.domNode);
        }
        parts.push(newPart);
        codeBlockStartIndex += newPart.codeblocks?.length ?? 0;
      }
    });
    if (templateData.renderedParts) {
      dispose(templateData.renderedParts);
    }
    templateData.renderedParts = parts;
    if (otherVariables.length) {
      const newPart = this.renderAttachments(otherVariables, element.contentReferences, element.modelId, templateData);
      if (newPart.domNode) {
        templateData.value.appendChild(newPart.domNode);
      }
      templateData.elementDisposables.add(newPart);
    }
    if (!element.pendingKind && !element.confirmation && this.rendererOptions.renderStyle !== "minimal" && templateData.value.childElementCount > 0) {
      const timestamp = renderChatRequestTimestamp(templateData.requestTimestampContainer, element.requestTimestamp);
      if (timestamp?.hoverText) {
        templateData.elementDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), timestamp.element, timestamp.hoverText));
      } else if (timestamp) {
        let requestTimingBounds;
        templateData.elementDisposables.add(dom.addDisposableListener(timestamp.element, dom.EventType.MOUSE_OVER, (e) => {
          const target = dom.isHTMLElement(e.target) ? e.target.closest(".chat-request-relative") : void 0;
          if (!dom.isHTMLElement(target) || !timestamp.element.contains(target)) {
            return;
          }
          const bounds = target.getBoundingClientRect();
          requestTimingBounds = bounds;
          timestamp.element.classList.add("chat-request-flip-reset");
          timestamp.element.classList.remove("chat-request-flip-active");
          timestamp.element.classList.toggle("chat-request-flip-down", e.clientY < bounds.top + bounds.height / 2);
          void timestamp.element.offsetWidth;
          timestamp.element.classList.remove("chat-request-flip-reset");
          void timestamp.element.offsetWidth;
          timestamp.element.classList.add("chat-request-flip-active");
        }));
        templateData.elementDisposables.add(dom.addDisposableListener(timestamp.element, dom.EventType.MOUSE_MOVE, (e) => {
          if (requestTimingBounds && (e.clientX < requestTimingBounds.left || e.clientX > requestTimingBounds.right || e.clientY < requestTimingBounds.top || e.clientY > requestTimingBounds.bottom)) {
            requestTimingBounds = void 0;
            timestamp.element.classList.remove("chat-request-flip-active");
          }
        }));
        templateData.elementDisposables.add(dom.addDisposableListener(timestamp.element, dom.EventType.MOUSE_LEAVE, () => {
          requestTimingBounds = void 0;
          timestamp.element.classList.remove("chat-request-flip-active");
        }));
        templateData.elementDisposables.add(dom.addDisposableListener(timestamp.element, dom.EventType.FOCUS, () => {
          timestamp.element.classList.remove("chat-request-flip-active", "chat-request-flip-down");
        }));
      }
    }
  }
  renderSystemInitiatedRequest(element, templateData) {
    dom.clearNode(templateData.value);
    if (templateData.renderedParts) {
      dispose(templateData.renderedParts);
    }
    templateData.renderedParts = [];
    const label = element.systemInitiatedLabel ?? element.messageText;
    const notificationPart = this.instantiationService.createInstance(
      ChatSystemNotificationContentPart,
      { kind: "systemNotification", content: new MarkdownString(label) },
      this.chatContentMarkdownRenderer
    );
    templateData.elementDisposables.add(notificationPart);
    templateData.value.appendChild(notificationPart.domNode);
  }
  /**
   * Smooth streaming render path — event-driven, rAF-batched.
   *
   * Does a render pass that feeds the full content through
   * `getNextProgressiveRenderContent` → `diff` → `renderChatContentDiff`,
   * where the morpher intercepts markdown appends and schedules
   * rAF-batched re-renders through the standard markdown pipeline.
   *
   * Called on every `renderElement` invocation (which fires each time
   * the model changes). On completion/cancellation the morpher's
   * content is already correctly rendered, so we do a final diff pass
   * (not a destructive re-render) to finalize non-markdown parts like
   * thinking indicators, error details, and code citations.
   */
  doIncrementalRender(element, index, templateData) {
    if (!this._isVisible) {
      return;
    }
    const rate = this.getProgressiveRenderRate(element);
    this._updateMorpherRate(templateData, rate, element.isComplete || element.isCanceled);
    if (element.isCanceled || element.isComplete) {
      element.renderData = void 0;
      templateData.rowContainer.classList.toggle("chat-response-loading", false);
      this.renderChatResponseBasic(element, index, templateData);
      return;
    }
    templateData.rowContainer.classList.toggle("chat-response-loading", true);
    const contentForThisTurn = this.getNextProgressiveRenderContent(element, templateData);
    const partsToRender = this.diff(templateData.renderedParts ?? [], contentForThisTurn.content, element);
    const contentIsAlreadyRendered = partsToRender.every((part) => part === null);
    if (!contentIsAlreadyRendered) {
      this.renderChatContentDiff(partsToRender, contentForThisTurn.content, element, index, templateData);
    }
  }
  /**
   * Propagate the stream's word-rate estimate to any active morpher's
   * word buffer so it reveals content at the model's speed.
   */
  _updateMorpherRate(templateData, rate, isComplete) {
    const renderedParts = templateData.renderedParts;
    if (!renderedParts) {
      return;
    }
    for (const part of renderedParts) {
      if (part instanceof ChatMarkdownContentPart) {
        part.updateStreamRate(rate, isComplete);
      }
    }
  }
  logIncrementalRenderingTelemetry() {
    if (this._incrementalRenderingTelemetryLogged) {
      return;
    }
    this._incrementalRenderingTelemetryLogged = true;
    this.telemetryService.publicLog2("chatIncrementalRenderingSettings", {
      animationStyle: this.configService.getValue(ChatConfiguration.IncrementalRenderingStyle) ?? "none",
      buffering: this.configService.getValue(ChatConfiguration.IncrementalRenderingBuffering) ?? "word"
    });
  }
  /**
   *	@returns true if progressive rendering should be considered complete- the element's data is fully rendered or the view is not visible
   */
  doNextProgressiveRender(element, index, templateData, isInRenderElement) {
    if (!this._isVisible) {
      return true;
    }
    if (element.isCanceled) {
      this.traceLayout("doNextProgressiveRender", `canceled, index=${index}`);
      element.renderData = void 0;
      this.renderChatResponseBasic(element, index, templateData);
      return true;
    }
    templateData.rowContainer.classList.toggle("chat-response-loading", true);
    this.traceLayout("doNextProgressiveRender", `START progressive render, index=${index}`);
    const contentForThisTurn = this.getNextProgressiveRenderContent(element, templateData);
    const partsToRender = this.diff(templateData.renderedParts ?? [], contentForThisTurn.content, element);
    const contentIsAlreadyRendered = partsToRender.every((part) => part === null);
    if (contentIsAlreadyRendered) {
      if (contentForThisTurn.moreContentAvailable) {
        this.traceLayout("doNextProgressiveRender", "not rendering any new content this tick, but more available");
        return false;
      } else if (element.isComplete) {
        this.traceLayout("doNextProgressiveRender", `END progressive render, index=${index} and clearing renderData, response is complete`);
        element.renderData = void 0;
        this.renderChatResponseBasic(element, index, templateData);
        return true;
      } else if (this.isWorkingProgressDebouncePending(element, contentForThisTurn.content)) {
        return false;
      } else {
        return true;
      }
    }
    this.traceLayout("doNextProgressiveRender", `doing progressive render, ${partsToRender.length} parts to render`);
    this.renderChatContentDiff(partsToRender, contentForThisTurn.content, element, index, templateData);
    return false;
  }
  renderChatContentDiff(partsToRender, contentForThisTurn, element, elementIndex, templateData) {
    const renderedParts = templateData.renderedParts ?? [];
    templateData.renderedParts = renderedParts;
    templateData.renderedContent = contentForThisTurn;
    const batchedSubagentParts = /* @__PURE__ */ new Set();
    let codeBlockStartIndex = 0;
    let treeStartIndex = 0;
    let displacedWorkingPart;
    const renderParts = () => partsToRender.forEach((partToRender, contentIndex) => {
      if (contentIndex > 0) {
        const prevPart = renderedParts[contentIndex - 1];
        if (prevPart) {
          codeBlockStartIndex += prevPart.codeblocks?.length ?? 0;
          if (prevPart instanceof ChatTreeContentPart) {
            treeStartIndex++;
          }
        }
      }
      const alreadyRenderedPart = templateData.renderedParts?.[contentIndex];
      if (!partToRender) {
        if (!templateData.renderedPartsMounted) {
          alreadyRenderedPart?.onDidRemount?.();
        }
        return;
      }
      if (partToRender.kind === "working" && displacedWorkingPart?.hasSameContent(partToRender, contentForThisTurn.slice(contentIndex + 1), element)) {
        renderedParts[contentIndex] = displacedWorkingPart;
        displacedWorkingPart = void 0;
        return;
      }
      const preserveWorkingPart = alreadyRenderedPart instanceof ChatWorkingProgressContentPart && partToRender.kind !== "working" && contentForThisTurn.slice(contentIndex + 1).some((part) => part.kind === "working");
      if (alreadyRenderedPart) {
        if (partToRender.kind === "thinking" && alreadyRenderedPart instanceof ChatThinkingContentPart) {
          if (!Array.isArray(partToRender.value)) {
            alreadyRenderedPart.updateThinking(partToRender);
          }
          renderedParts[contentIndex] = alreadyRenderedPart;
          return;
        } else if (alreadyRenderedPart instanceof ChatThinkingContentPart && this.shouldPinPart(partToRender, element)) {
          renderedParts[contentIndex] = alreadyRenderedPart;
          return;
        }
        if (partToRender.kind === "markdownContent" && alreadyRenderedPart instanceof ChatMarkdownContentPart && this.configService.getValue(ChatConfiguration.IncrementalRendering)) {
          if (alreadyRenderedPart.tryIncrementalUpdate(partToRender)) {
            renderedParts[contentIndex] = alreadyRenderedPart;
            return;
          }
        }
        if (preserveWorkingPart) {
          displacedWorkingPart = alreadyRenderedPart;
        } else {
          alreadyRenderedPart.dispose();
        }
        if (alreadyRenderedPart.domNode) {
          const thinkingToolWrapper = dom.findParentWithClass(alreadyRenderedPart.domNode, "chat-thinking-tool-wrapper");
          if (thinkingToolWrapper) {
            thinkingToolWrapper.replaceWith(alreadyRenderedPart.domNode);
          }
        }
      }
      const context = {
        element,
        elementIndex,
        content: contentForThisTurn,
        contentIndex,
        container: templateData.rowContainer,
        editorPool: this._editorPool,
        diffEditorPool: this._diffEditorPool,
        currentWidth: this._currentLayoutWidth,
        onDidChangeVisibility: this._onDidChangeVisibility.event,
        inlineTextModels: this._inlineTextModels,
        codeBlockStartIndex,
        treeStartIndex
      };
      const lastThinking = this.getLastThinkingPart(renderedParts);
      if (lastThinking && (partToRender.kind === "toolInvocation" || partToRender.kind === "toolInvocationSerialized" || partToRender.kind === "markdownContent" || partToRender.kind === "textEditGroup" || partToRender.kind === "externalEdit" || partToRender.kind === "hook") && this.shouldPinPart(partToRender, element)) {
        if (alreadyRenderedPart instanceof ChatMarkdownContentPart) {
          lastThinking.removeEditPillByPartId(alreadyRenderedPart.codeblocksPartId);
        }
        const newPart2 = this.renderChatContentPart(partToRender, templateData, context, batchedSubagentParts);
        if (newPart2) {
          renderedParts[contentIndex] = newPart2;
          alreadyRenderedPart?.domNode?.remove();
        }
        return;
      }
      const newPart = this.renderChatContentPart(partToRender, templateData, context, batchedSubagentParts);
      if (newPart) {
        renderedParts[contentIndex] = newPart;
        try {
          if (alreadyRenderedPart?.domNode) {
            if (newPart.domNode) {
              if (preserveWorkingPart) {
                alreadyRenderedPart.domNode.before(newPart.domNode);
              } else {
                alreadyRenderedPart.domNode.replaceWith(newPart.domNode);
              }
            } else {
              if (!preserveWorkingPart) {
                alreadyRenderedPart.domNode.remove();
              }
            }
          } else if (newPart.domNode && !newPart.domNode.parentElement) {
            templateData.value.appendChild(newPart.domNode);
          }
        } catch (err) {
          this.logService.error("ChatListItemRenderer#renderChatContentDiff: error replacing part", err);
        }
      } else {
        alreadyRenderedPart?.domNode?.remove();
      }
    });
    try {
      renderParts();
    } finally {
      for (const subagentPart of batchedSubagentParts) {
        try {
          subagentPart.endToolPresentationBatch();
        } catch (error) {
          this.logService.error("ChatListItemRenderer#renderChatContentDiff: error flushing subagent presentation", error);
        }
      }
    }
    displacedWorkingPart?.dispose();
    displacedWorkingPart?.domNode?.remove();
    for (let i = partsToRender.length; i < renderedParts.length; i++) {
      const part = renderedParts[i];
      if (part) {
        part.dispose();
        part.domNode?.remove();
        delete renderedParts[i];
      }
    }
    const animateCollapse = templateData.wasResponseComplete === false && element.isComplete;
    this.updateCompletedResponseDisclosure(element, contentForThisTurn, templateData, animateCollapse);
    templateData.wasResponseComplete = element.isComplete;
  }
  updateCompletedResponseDisclosure(element, content, templateData, animateCollapse) {
    if (!element.isComplete || !this.configService.getValue(ChatConfiguration.CollapseCompletedResponses)) {
      this.removeCompletedResponseDisclosure(templateData);
      templateData.completedResponseDisclosureOpen = void 0;
      return;
    }
    const responseContent = annotateSpecialMarkdownContent(element.response.value);
    const responseFinalStartIndex = getFinalResponseStartIndexAfterMovingSessionCreatedTools(responseContent);
    const finalResponseStartIndex = responseFinalStartIndex === void 0 ? void 0 : responseFinalStartIndex + 1;
    if (finalResponseStartIndex === void 0 || !isFinalResponseRendered(content, finalResponseStartIndex) || finalResponseStartIndex === 0 || !content.slice(0, finalResponseStartIndex).some((part) => part.kind !== "references" || part.references.length > 0)) {
      this.removeCompletedResponseDisclosure(templateData);
      return;
    }
    const finalResponsePart = templateData.renderedParts?.[finalResponseStartIndex];
    if (!(finalResponsePart instanceof ChatMarkdownContentPart) || !finalResponsePart.isRenderComplete) {
      this.removeCompletedResponseDisclosure(templateData);
      if (finalResponsePart instanceof ChatMarkdownContentPart) {
        templateData.completedResponseDisclosureDisposables.add(Event.once(finalResponsePart.onDidFinishRendering)(() => {
          this.updateCompletedResponseDisclosure(element, content, templateData, false);
        }));
      }
      return;
    }
    const collapseEndIndex = getCompletedResponseCollapseEndIndex(content, finalResponseStartIndex);
    if (collapseEndIndex === 0) {
      this.removeCompletedResponseDisclosure(templateData);
      return;
    }
    const collapseEndNode = templateData.renderedParts?.[collapseEndIndex]?.domNode;
    if (!collapseEndNode) {
      this.removeCompletedResponseDisclosure(templateData);
      return;
    }
    let existingDisclosure = templateData.completedResponseDisclosure;
    if (existingDisclosure?.contains(collapseEndNode)) {
      this.removeCompletedResponseDisclosure(templateData);
      existingDisclosure = void 0;
    }
    let collapseEndRoot = collapseEndNode;
    while (collapseEndRoot.parentElement && collapseEndRoot.parentElement !== templateData.value) {
      collapseEndRoot = collapseEndRoot.parentElement;
    }
    if (collapseEndRoot.parentElement !== templateData.value) {
      this.removeCompletedResponseDisclosure(templateData);
      return;
    }
    if (existingDisclosure && templateData.completedResponseCollapseEndIndex === collapseEndIndex && existingDisclosure.nextSibling === collapseEndRoot && templateData.renderedParts?.slice(0, collapseEndIndex).every((part) => !part?.domNode || existingDisclosure.contains(part.domNode))) {
      return;
    }
    this.removeCompletedResponseDisclosure(templateData);
    const valueChildren = Array.from(templateData.value.childNodes);
    const nodesToCollapse = valueChildren.slice(0, valueChildren.indexOf(collapseEndRoot));
    const stepCount = getVisibleCompletedResponseItemCount(nodesToCollapse);
    if (stepCount < 2) {
      return;
    }
    const details = document.createElement("details");
    details.classList.add("completed-response-disclosure");
    const summary = details.appendChild(document.createElement("summary"));
    summary.classList.add("completed-response-summary", "chat-used-context-label");
    const button = summary.appendChild($("span.monaco-button.monaco-text-button.monaco-icon-button"));
    const label = button.appendChild($("span.monaco-button-mdlabel"));
    const chevron = button.appendChild($("span.chat-collapsible-hover-chevron", { "aria-hidden": "true" }));
    chevron.classList.add(...ThemeIcon.asClassNameArray(Codicon.chevronRight));
    const disclosureLabel = formatCompletedResponseDisclosureLabel(stepCount, element.model.elapsedMs);
    label.textContent = disclosureLabel;
    const activeElement = dom.getActiveElement();
    const keepOpenForFocus = nodesToCollapse.some((node) => node.contains(activeElement));
    const shouldAnimateInitialCollapse = animateCollapse && !keepOpenForFocus && !this.accessibilityService.isMotionReduced() && templateData.completedResponseDisclosureOpen === void 0;
    if (keepOpenForFocus) {
      templateData.completedResponseDisclosureOpen = true;
    }
    details.open = templateData.completedResponseDisclosureOpen ?? shouldAnimateInitialCollapse;
    const updateExpansionState = () => {
      summary.setAttribute("aria-expanded", String(details.open));
      chevron.classList.toggle("expanded", details.open);
    };
    updateExpansionState();
    templateData.value.insertBefore(details, collapseEndRoot);
    details.append(...nodesToCollapse);
    templateData.completedResponseDisclosure = details;
    templateData.completedResponseCollapseEndIndex = collapseEndIndex;
    templateData.completedResponseDisclosureDisposables.add(dom.addDisposableListener(details, "toggle", () => {
      templateData.completedResponseDisclosureOpen = details.open;
      updateExpansionState();
    }));
    templateData.completedResponseDisclosureDisposables.add(dom.addDisposableListener(summary, dom.EventType.CLICK, () => {
      details.dispatchEvent(new CustomEvent(ChatCollapsibleContentPart.userToggleEvent, { bubbles: true }));
    }));
    if (shouldAnimateInitialCollapse) {
      const targetWindow = dom.getWindow(details);
      const animationFrame = targetWindow.requestAnimationFrame(() => {
        if (templateData.completedResponseDisclosure === details && details.open) {
          details.open = false;
        }
      });
      templateData.completedResponseDisclosureDisposables.add(toDisposable(() => targetWindow.cancelAnimationFrame(animationFrame)));
    }
  }
  removeCompletedResponseDisclosure(templateData) {
    templateData.completedResponseDisclosureDisposables.clear();
    const details = templateData.completedResponseDisclosure;
    if (!details) {
      return;
    }
    while (details.childNodes.length > 1) {
      details.before(details.childNodes[1]);
    }
    details.remove();
    templateData.completedResponseDisclosure = void 0;
    templateData.completedResponseCollapseEndIndex = void 0;
  }
  /**
   * Returns all content parts that should be rendered, and trimmed markdown content. We will diff this with the current rendered set.
   */
  getNextProgressiveRenderContent(element, templateData) {
    const data = this.getDataForProgressiveRender(element);
    const incrementalRendering = this.configService.getValue(ChatConfiguration.IncrementalRendering) === true;
    const responseContent = annotateSpecialMarkdownContent(element.response.value);
    const renderableResponse = element.isComplete ? moveSessionCreatedToolsAfterFinalResponse(responseContent) : responseContent;
    this.traceLayout("getNextProgressiveRenderContent", `Want to render ${data.numWordsToRender} at ${data.rate} words/s, counting...`);
    let numNeededWords = data.numWordsToRender;
    const partsToRender = [];
    partsToRender.push({ kind: "references", references: element.contentReferences });
    let moreContentAvailable = false;
    for (let i = 0; i < renderableResponse.length; i++) {
      const part = renderableResponse[i];
      if (part.kind === "markdownContent" && !incrementalRendering) {
        const wordCountResult = getNWords(part.content.value, numNeededWords);
        this.traceLayout("getNextProgressiveRenderContent", `  Chunk ${i}: Want to render ${numNeededWords} words and found ${wordCountResult.returnedWordCount} words. Total words in chunk: ${wordCountResult.totalWordCount}`);
        numNeededWords -= wordCountResult.returnedWordCount;
        if (wordCountResult.isFullString) {
          partsToRender.push(part);
          for (const nextPart of renderableResponse.slice(i + 1)) {
            if (nextPart.kind !== "markdownContent") {
              i++;
              partsToRender.push(nextPart);
            } else {
              break;
            }
          }
        } else {
          moreContentAvailable = true;
          partsToRender.push({ ...part, content: new MarkdownString(wordCountResult.value, part.content) });
        }
        if (numNeededWords <= 0) {
          if (renderableResponse.slice(i + 1).some((part2) => part2.kind === "markdownContent")) {
            moreContentAvailable = true;
          }
          break;
        }
      } else {
        partsToRender.push(part);
      }
    }
    const lastWordCount = element.contentUpdateTimings?.lastWordCount ?? 0;
    const newRenderedWordCount = data.numWordsToRender - numNeededWords;
    const bufferWords = lastWordCount - newRenderedWordCount;
    this.traceLayout("getNextProgressiveRenderContent", `Want to render ${data.numWordsToRender} words. Rendering ${newRenderedWordCount} words. Buffer: ${bufferWords} words`);
    if (newRenderedWordCount > 0 && newRenderedWordCount !== element.renderData?.renderedWordCount) {
      element.renderData = { lastRenderTime: Date.now(), renderedWordCount: newRenderedWordCount, renderedParts: partsToRender };
    }
    const workingProgress = this.shouldShowWorkingProgress(element, partsToRender, moreContentAvailable, templateData);
    if (workingProgress) {
      partsToRender.push(workingProgress);
    }
    const fileChangesSummaryPart = this.getChatFileChangesSummaryPart(element);
    if (fileChangesSummaryPart) {
      partsToRender.push(fileChangesSummaryPart);
    }
    const turnPillsPart = this.getChatTurnPillsPart(element);
    if (turnPillsPart) {
      partsToRender.push(turnPillsPart);
    }
    return { content: partsToRender, moreContentAvailable };
  }
  shouldShowFileChangesSummary(element) {
    const sessionType = getChatSessionType(element.sessionResource);
    const isLocalSession = sessionType === localChatSessionType || isAgentHostTarget(sessionType);
    return shouldShowFileChangesSummaryForSettings(
      element.isComplete,
      isLocalSession,
      this.configService.getValue("chat.checkpoints.showFileChanges")
    );
  }
  shouldShowPillsSummary(element) {
    return shouldShowPillsSummaryForSettings(
      element.isComplete,
      isAgentHostTarget(getChatSessionType(element.sessionResource)),
      this.configService.getValue(ChatConfiguration.TurnStatusPills)
    );
  }
  getDataForProgressiveRender(element) {
    const hasMarkdownParts = element.response.value.some((part) => part.kind === "markdownContent" && part.content.value.trim().length > 0);
    if (shouldRenderInitialProgressiveContentImmediately(element.isComplete, hasMarkdownParts, element.renderData !== void 0)) {
      return {
        numWordsToRender: Number.MAX_SAFE_INTEGER,
        rate: Number.MAX_SAFE_INTEGER
      };
    }
    const renderData = element.renderData ?? { lastRenderTime: 0, renderedWordCount: 0 };
    const rate = this.getProgressiveRenderRate(element);
    const numWordsToRender = renderData.lastRenderTime === 0 ? 1 : renderData.renderedWordCount + // Additional words to render beyond what's already rendered
    Math.floor((Date.now() - renderData.lastRenderTime) / 1e3 * rate);
    return {
      numWordsToRender,
      rate
    };
  }
  diff(renderedParts, contentToRender, element) {
    const diff = [];
    for (let i = 0; i < contentToRender.length; i++) {
      const content = contentToRender[i];
      const renderedPart = renderedParts[i];
      if (!renderedPart || !renderedPart.hasSameContent(content, contentToRender.slice(i + 1), element)) {
        diff.push(content);
      } else {
        diff.push(null);
      }
    }
    return diff;
  }
  hasEditCodeblockUri(part) {
    if (part.kind !== "markdownContent") {
      return false;
    }
    return hasEditCodeblockUriTag(part.content.value);
  }
  isCodeblockComplete(part, element) {
    if (part.kind !== "markdownContent") {
      return true;
    }
    return !isResponseVM(element) || element.isComplete || codeblockHasClosingBackticks(part.content.value);
  }
  // todo @justschen initially split up each of the checks to easily see what should be pinned/not pinned, we can probably consolidate this down by a lot once we're more confident in the logic.
  shouldPinPart(part, element) {
    const collapsedToolsMode = this.configService.getValue("chat.agent.thinking.collapsedTools");
    if (part.kind === "thinking" || part.kind === "working") {
      return true;
    }
    if (part.kind === "undoStop") {
      return true;
    }
    if (part.kind === "hook") {
      if (part.subAgentInvocationId) {
        return false;
      }
      return part.hookType === HookType.PreToolUse || part.hookType === HookType.PostToolUse;
    }
    if (collapsedToolsMode === CollapsedToolsDisplayMode.Off) {
      return false;
    }
    if (this.hasEditCodeblockUri(part) || part.kind === "textEditGroup" || part.kind === "externalEdit") {
      return true;
    }
    const isMcpTool = (part.kind === "toolInvocation" || part.kind === "toolInvocationSerialized") && isMcpToolInvocation(part);
    if (isMcpTool) {
      return false;
    }
    const isMermaidTool = (part.kind === "toolInvocation" || part.kind === "toolInvocationSerialized") && part.toolId.toLowerCase().includes("mermaid");
    if (isMermaidTool) {
      return false;
    }
    const isAskQuestionsTool = (part.kind === "toolInvocation" || part.kind === "toolInvocationSerialized") && isAskQuestionsToolInvocation(part);
    if (isAskQuestionsTool) {
      return false;
    }
    if ((part.kind === "toolInvocation" || part.kind === "toolInvocationSerialized") && isSubagentToolInvocation(part)) {
      return false;
    }
    if ((part.kind === "toolInvocation" || part.kind === "toolInvocationSerialized") && (isCreateSessionTool(part.toolId) || isCreateChatTool(part.toolId) || isSendMessageTool(part.toolId))) {
      return false;
    }
    const isTerminalTool = (part.kind === "toolInvocation" || part.kind === "toolInvocationSerialized") && part.toolSpecificData?.kind === "terminal";
    const isContributedTerminalToolInvocation = element && (element.sessionResource.scheme !== Schemas.vscodeChatInput && getChatSessionType(element.sessionResource) !== localChatSessionType) && part.kind === "toolInvocationSerialized" && part.toolSpecificData?.kind === "terminal";
    if (isTerminalTool && !isContributedTerminalToolInvocation) {
      if (part.kind === "toolInvocation" && IChatToolInvocation.getConfirmationMessages(part)) {
        return false;
      }
      const terminalToolsInThinking = this.configService.getValue(ChatConfiguration.TerminalToolsInThinking);
      return !!terminalToolsInThinking;
    }
    if (part.kind === "toolInvocation") {
      const state = part.state.get();
      return shouldPinToolInvocationToThinking(state.type, !!IChatToolInvocation.getConfirmationMessages(part), toolInvocationHasMcpAppData(part));
    }
    if (part.kind === "toolInvocationSerialized") {
      return !toolInvocationHasMcpAppData(part);
    }
    return false;
  }
  getLastThinkingPart(renderedParts) {
    if (!renderedParts || renderedParts.length === 0) {
      return void 0;
    }
    for (let i = renderedParts.length - 1; i >= 0; i--) {
      const part = renderedParts[i];
      if (part instanceof ChatThinkingContentPart && part.getIsActive()) {
        return part;
      }
    }
    return void 0;
  }
  getLastThinkingPartForGroupedItem(context, templateData) {
    const lastThinking = this.getLastThinkingPart(templateData.renderedParts);
    const displayMode = getEffectiveThinkingDisplayMode(this.configService, this.contextKeyService);
    if (lastThinking?.hasReasoningContent() && shouldStartNewCollapsedThinkingGroup(displayMode, "reasoning", "items")) {
      this.finalizeCurrentThinkingPart(context, templateData);
      return { part: void 0, separatedFromReasoning: true };
    }
    return { part: lastThinking, separatedFromReasoning: false };
  }
  /**
   * Determines if a thinking part at the given content index is "look-ahead complete".
   * A thinking part is look-ahead complete if there are subsequent parts that will NOT
   * be pinned to it, meaning we know this thinking part is already done even though
   * the overall response is still in progress.
   */
  isThinkingLookAheadComplete(context, element) {
    if (element?.isComplete) {
      return true;
    }
    for (let i = context.contentIndex + 1; i < context.content.length; i++) {
      const nextPart = context.content[i];
      if (!this.shouldPinPart(nextPart, element)) {
        return true;
      }
    }
    return false;
  }
  getSubagentPart(renderedParts, subAgentInvocationId) {
    if (!renderedParts || renderedParts.length === 0) {
      return void 0;
    }
    for (let i = renderedParts.length - 1; i >= 0; i--) {
      const part = renderedParts[i];
      if (part instanceof ChatSubagentContentPart) {
        if (subAgentInvocationId && part.subAgentInvocationId === subAgentInvocationId) {
          return part;
        }
        if (!subAgentInvocationId && part.getIsActive()) {
          return part;
        }
      }
    }
    return void 0;
  }
  finalizeAllSubagentParts(templateData, force = false) {
    if (!templateData.renderedParts) {
      return;
    }
    for (const part of templateData.renderedParts) {
      if (part instanceof ChatSubagentContentPart && part.getIsActive() && (force || !part.shouldRemainActive()) && (force || !part.hasToolsWaitingForConfirmation)) {
        part.markAsInactive(force);
      }
    }
  }
  handleSubagentToolGrouping(toolInvocation, subagentId, context, templateData, codeBlockStartIndex, batchedSubagentParts) {
    this.finalizeCurrentThinkingPart(context, templateData);
    const lastSubagent = this.getSubagentPart(templateData.renderedParts, subagentId);
    if (lastSubagent) {
      this.beginSubagentToolPresentationBatch(lastSubagent, batchedSubagentParts);
      this.maybeRouteSubagentToolToCarousel(toolInvocation, lastSubagent, context, templateData, codeBlockStartIndex);
      if (!isParentSubagentTool(toolInvocation)) {
        lastSubagent.appendToolInvocation(toolInvocation, codeBlockStartIndex);
        return this.renderNoContent((other) => (other.kind === "toolInvocation" || other.kind === "toolInvocationSerialized") && other.toolCallId === toolInvocation.toolCallId);
      }
      return lastSubagent;
    }
    const subagentPart = this.instantiationService.createInstance(
      ChatSubagentContentPart,
      subagentId,
      toolInvocation,
      context,
      this.chatContentMarkdownRenderer,
      this._contentReferencesListPool,
      this._toolEditorPool,
      () => this._currentLayoutWidth.get(),
      this._announcedToolProgressKeys
    );
    this.beginSubagentToolPresentationBatch(subagentPart, batchedSubagentParts);
    this.maybeRouteSubagentToolToCarousel(toolInvocation, subagentPart, context, templateData, codeBlockStartIndex);
    if (!isParentSubagentTool(toolInvocation)) {
      subagentPart.appendToolInvocation(toolInvocation, codeBlockStartIndex);
    }
    return subagentPart;
  }
  beginSubagentToolPresentationBatch(subagentPart, batchedSubagentParts) {
    if (batchedSubagentParts && !batchedSubagentParts.has(subagentPart)) {
      batchedSubagentParts.add(subagentPart);
      subagentPart.beginToolPresentationBatch();
    }
  }
  /** Routes subagent confirmations to the input carousel and leaves a placeholder inline. */
  maybeRouteSubagentToolToCarousel(toolInvocation, subagentPart, context, templateData, codeBlockStartIndex) {
    if (!this.configService.getValue(ChatConfiguration.ToolConfirmationCarousel)) {
      return;
    }
    if (toolInvocation.kind !== "toolInvocation" || !isResponseVM(context.element)) {
      return;
    }
    if (isParentSubagentTool(toolInvocation) || toolInvocation.presentation === "hidden" || toolInvocation.source.type === "mcp") {
      return;
    }
    if (!!this.viewModel?.editing) {
      return;
    }
    const widget = this.chatWidgetService.getWidgetBySessionResource(context.element.sessionResource);
    if (!widget) {
      return;
    }
    const subAgentInvocationId = subagentPart.subAgentInvocationId;
    const agentName = subagentPart.getAgentLabel();
    const revealSubagent = (targetSubAgentId) => {
      const currentTemplateData = this.getTemplateDataForRequestId(context.element.id);
      const currentSubagentPart = this.getSubagentPart(currentTemplateData?.renderedParts, targetSubAgentId) ?? subagentPart;
      const chatResource = currentSubagentPart.getChatResource();
      if (this.environmentService.isSessionsWindow && chatResource) {
        void this.commandService.executeCommand(CHAT_OPEN_AGENT_HOST_CHAT_COMMAND_ID, { chatResource });
      } else {
        currentSubagentPart.domNode.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };
    const revealSubagentLabel = this.environmentService.isSessionsWindow ? localize("openSubagentChat", "Open {0} Chat", agentName) : void 0;
    const navigateToCarousel = (targetSubAgentId) => {
      widget.inputPart.activateCarouselForSubagent(targetSubAgentId);
    };
    const factory = (tool) => this.instantiationService.createInstance(
      ChatToolInvocationPart,
      tool,
      context,
      this.chatContentMarkdownRenderer,
      this._contentReferencesListPool,
      this._toolEditorPool,
      () => this._currentLayoutWidth.get(),
      this._announcedToolProgressKeys,
      codeBlockStartIndex
    );
    const addToolToCarousel = (tool) => {
      widget.inputPart.addToolToConfirmationCarousel(tool, factory, subAgentInvocationId, agentName, revealSubagent, revealSubagentLabel);
      const listener = this.createUpdateWorkingProgressOnConfirmationEnd(tool, templateData);
      if (listener) {
        templateData.elementDisposables.add(listener);
      }
    };
    const shouldUseCarouselForTool = (tool, state) => this.configService.getValue(ChatConfiguration.ToolConfirmationCarousel) && !this.viewModel?.editing && tool.presentation !== "hidden" && tool.source.type !== "mcp" && state.type === IChatToolInvocation.StateKind.WaitingForConfirmation && !!state.confirmationMessages?.title;
    subagentPart.enableCarouselMode(navigateToCarousel, addToolToCarousel, shouldUseCarouselForTool, widget.inputPart.onDidChangeActiveConfirmationSubagent);
    subagentPart.setConfirmationActive(widget.inputPart.activeConfirmationSubagentId === subAgentInvocationId);
    const toolState = toolInvocation.state.get();
    if (toolState.type === IChatToolInvocation.StateKind.WaitingForConfirmation && toolState.confirmationMessages?.title) {
      addToolToCarousel(toolInvocation);
    }
  }
  finalizeCurrentThinkingPart(context, templateData) {
    const lastThinking = this.getLastThinkingPart(templateData.renderedParts);
    if (!lastThinking) {
      return;
    }
    const style = getEffectiveThinkingDisplayMode(this.configService, this.contextKeyService);
    if (style === ThinkingDisplayMode.CollapsedPreview) {
      lastThinking.collapseContent();
    }
    lastThinking.finalizeTitleIfDefault();
    lastThinking.resetId();
    lastThinking.markAsInactive();
  }
  renderChatContentPart(content, templateData, context, batchedSubagentParts) {
    try {
      if (content.kind === "thinking" && (Array.isArray(content.value) ? content.value.length === 0 : content.value === "")) {
        const lastThinking = this.getLastThinkingPart(templateData.renderedParts);
        lastThinking?.resetId();
        return this.renderNoContent((other) => content.kind === other.kind);
      }
      const isResponseElement = isResponseVM(context.element);
      const shouldPin = this.shouldPinPart(content, isResponseElement ? context.element : void 0);
      if (context.element.isComplete && !shouldPin) {
        const elementTemplateData = this.getTemplateDataForRequestId(context.element.id);
        if (elementTemplateData?.renderedParts) {
          const lastThinking = this.getLastThinkingPart(elementTemplateData.renderedParts);
          if (lastThinking?.getIsActive()) {
            this.finalizeCurrentThinkingPart(context, elementTemplateData);
          }
        }
      }
      const isSubagentContent = (content.kind === "toolInvocation" || content.kind === "toolInvocationSerialized") && isSubagentToolInvocation(content);
      if (context.element.isComplete && !isSubagentContent) {
        const elementTemplateData = this.getTemplateDataForRequestId(context.element.id);
        if (elementTemplateData) {
          this.finalizeAllSubagentParts(elementTemplateData);
        }
      }
      if (content.kind === "treeData") {
        return this.renderTreeData(content, templateData, context);
      } else if (content.kind === "multiDiffData") {
        return this.renderMultiDiffData(content, templateData, context);
      } else if (content.kind === "progressMessage") {
        return this.instantiationService.createInstance(ChatProgressContentPart, content, this.chatContentMarkdownRenderer, context, void 0, void 0, void 0, void 0, content.shimmer);
      } else if (content.kind === "systemNotification") {
        return this.instantiationService.createInstance(ChatSystemNotificationContentPart, content, this.chatContentMarkdownRenderer);
      } else if (content.kind === "working") {
        return this.instantiationService.createInstance(ChatWorkingProgressContentPart, content, this.chatContentMarkdownRenderer, context);
      } else if (content.kind === "progressTask" || content.kind === "progressTaskSerialized") {
        return this.renderProgressTask(content, templateData, context);
      } else if (content.kind === "command") {
        return this.instantiationService.createInstance(ChatCommandButtonContentPart, content, context);
      } else if (content.kind === "textEditGroup") {
        return this.renderTextEdit(context, content, templateData);
      } else if (content.kind === "confirmation") {
        return this.renderConfirmation(context, content, templateData);
      } else if (content.kind === "warning") {
        return this.instantiationService.createInstance(ChatErrorContentPart, ChatErrorLevel.Warning, content.content, content, this.chatContentMarkdownRenderer);
      } else if (content.kind === "info") {
        return this.instantiationService.createInstance(ChatErrorContentPart, ChatErrorLevel.Info, content.content, content, this.chatContentMarkdownRenderer);
      } else if (content.kind === "hook") {
        return this.renderHookPart(content, context, templateData, batchedSubagentParts);
      } else if (content.kind === "markdownContent") {
        return this.renderMarkdown(content, templateData, context);
      } else if (content.kind === "references") {
        if (isResponseVM(context.element) && context.element.agent?.isDefault && !context.element.agent.modes.includes(ChatModeKind.Ask)) {
          return this.renderNoContent((other) => other.kind === content.kind);
        }
        return this.renderContentReferencesListData(content, void 0, context, templateData);
      } else if (content.kind === "codeCitations") {
        return this.renderCodeCitations(content, context, templateData);
      } else if (content.kind === "toolInvocation" || content.kind === "toolInvocationSerialized") {
        return this.renderToolInvocation(content, context, templateData, batchedSubagentParts);
      } else if (content.kind === "extensions") {
        return this.renderExtensionsContent(content, context, templateData);
      } else if (content.kind === "pullRequest") {
        return this.renderPullRequestContent(content, context, templateData);
      } else if (content.kind === "undoStop") {
        return this.renderUndoStop(content);
      } else if (content.kind === "errorDetails") {
        return this.renderChatErrorDetails(context, content, templateData);
      } else if (content.kind === "elicitation2" || content.kind === "elicitationSerialized") {
        return this.renderElicitation(context, content, templateData);
      } else if (content.kind === "questionCarousel") {
        return this.renderQuestionCarousel(context, content, templateData);
      } else if (content.kind === "planReview") {
        return this.renderPlanReview(context, content, templateData);
      } else if (content.kind === "changesSummary") {
        return this.renderChangesSummary(content, context, templateData);
      } else if (content.kind === "turnPills") {
        return this.renderTurnPills(content, context);
      } else if (content.kind === "mcpServersStarting") {
        return this.renderMcpServersInteractionRequired(content, context, templateData);
      } else if (content.kind === "mcpAuthenticationRequired") {
        return this.instantiationService.createInstance(ChatMcpAuthenticationContentPart, content);
      } else if (content.kind === "mcpServersStartingSlow") {
        return this.instantiationService.createInstance(ChatMcpServersStartingContentPart, content, {
          onDidFinishStarting: () => this.showWorkingProgressAfterMcp(context, templateData)
        });
      } else if (content.kind === "disabledClaudeHooks") {
        return this.renderDisabledClaudeHooks(content, context);
      } else if (content.kind === "thinking") {
        return this.renderThinkingPart(content, context, templateData);
      } else if (content.kind === "workspaceEdit") {
        return this.instantiationService.createInstance(ChatWorkspaceEditContentPart, content, context, this.chatContentMarkdownRenderer);
      } else if (content.kind === "externalEdit") {
        return this.renderExternalEdit(content, context, templateData);
      } else if (content.kind === "autoModeResolution") {
        return this.instantiationService.createInstance(ChatAutoModeResolutionContentPart, content, context, this.chatContentMarkdownRenderer);
      }
      return this.renderNoContent((other) => content.kind === other.kind);
    } catch (err) {
      alert(`Chat error: ${toErrorMessage(err, false)}`);
      this.logService.error("ChatListItemRenderer#renderChatContentPart: error rendering content", toErrorMessage(err, true));
      const errorPart = this.instantiationService.createInstance(ChatErrorContentPart, ChatErrorLevel.Error, new MarkdownString(localize("renderFailMsg", "Failed to render content") + `: ${toErrorMessage(err, false)}`), content, this.chatContentMarkdownRenderer);
      return {
        dispose: () => errorPart.dispose(),
        domNode: errorPart.domNode,
        hasSameContent: ((other) => content.kind === other.kind)
      };
    }
  }
  showWorkingProgressAfterMcp(context, templateData) {
    const originalElement = context.element;
    const originalRenderedParts = templateData.renderedParts;
    queueMicrotask(() => {
      if (!isResponseVM(originalElement) || templateData.currentElement !== originalElement || originalElement.isComplete || originalElement.isCanceled) {
        return;
      }
      if (!originalRenderedParts || templateData.renderedParts !== originalRenderedParts || originalRenderedParts.some((part) => part instanceof ChatWorkingProgressContentPart)) {
        return;
      }
      this.renderChatResponseBasic(originalElement, context.elementIndex, templateData);
      this.fireItemHeightChange(templateData);
    });
  }
  dispose() {
    this._announcedToolProgressKeys.clear();
    super.dispose();
  }
  renderChatErrorDetails(context, content, templateData) {
    if (!isResponseVM(context.element)) {
      return this.renderNoContent((other) => content.kind === other.kind);
    }
    const isLast = content.isLast;
    if (content.errorDetails.isQuotaExceeded) {
      const renderedError = this.instantiationService.createInstance(ChatQuotaExceededPart, context.element, content, this.chatContentMarkdownRenderer);
      return renderedError;
    } else if (content.errorDetails.isRateLimited && this.chatEntitlementService.anonymous) {
      const renderedError = this.instantiationService.createInstance(ChatAnonymousRateLimitedPart, content);
      return renderedError;
    } else if (content.errorDetails.confirmationButtons && isLast) {
      const level = content.errorDetails.level ?? ChatErrorLevel.Error;
      const errorConfirmation = this.instantiationService.createInstance(ChatErrorConfirmationContentPart, level, new MarkdownString(content.errorDetails.message), content, content.errorDetails.confirmationButtons, this.chatContentMarkdownRenderer, context);
      return errorConfirmation;
    } else {
      const level = content.errorDetails.level ?? ChatErrorLevel.Error;
      return this.instantiationService.createInstance(ChatErrorContentPart, level, new MarkdownString(content.errorDetails.message), content, this.chatContentMarkdownRenderer);
    }
  }
  renderUndoStop(content) {
    return this.renderNoContent((other) => other.kind === content.kind && other.id === content.id);
  }
  renderNoContent(equals) {
    return {
      dispose: () => {
      },
      domNode: void 0,
      hasSameContent: equals
    };
  }
  renderTreeData(content, templateData, context) {
    const data = content.treeData;
    const treePart = this.instantiationService.createInstance(ChatTreeContentPart, data, this._treePool);
    if (isResponseVM(context.element)) {
      const fileTreeFocusInfo = {
        treeDataId: data.uri.toString(),
        treeIndex: context.treeStartIndex,
        focus() {
          treePart.domFocus();
        }
      };
      treePart.addDisposable(treePart.onDidFocus(() => {
        this.focusedFileTreesByResponseId.set(context.element.id, fileTreeFocusInfo.treeIndex);
      }));
      const fileTrees = this.fileTreesByResponseId.get(context.element.id) ?? [];
      fileTrees.push(fileTreeFocusInfo);
      this.fileTreesByResponseId.set(context.element.id, distinct(fileTrees, (v) => v.treeDataId));
      treePart.addDisposable(toDisposable(() => this.fileTreesByResponseId.set(context.element.id, fileTrees.filter((v) => v.treeDataId !== data.uri.toString()))));
    }
    return treePart;
  }
  renderMultiDiffData(content, templateData, context) {
    const multiDiffPart = this.instantiationService.createInstance(ChatMultiDiffContentPart, content, context.element);
    return multiDiffPart;
  }
  renderContentReferencesListData(references, labelOverride, context, templateData) {
    const referencesPart = this.instantiationService.createInstance(ChatUsedReferencesListContentPart, references.references, labelOverride, context, this._contentReferencesListPool, { expandedWhenEmptyResponse: checkModeOption(this.delegate.currentChatMode(), this.rendererOptions.referencesExpandedWhenEmptyResponse) });
    return referencesPart;
  }
  renderCodeCitations(citations, context, templateData) {
    const citationsPart = this.instantiationService.createInstance(ChatCodeCitationContentPart, citations, context);
    return citationsPart;
  }
  handleRenderedCodeblocks(element, part, codeBlockStartIndex) {
    if (!part.addDisposable || part.codeblocksPartId === void 0) {
      return;
    }
    const codeBlocksByResponseId = this.codeBlocksByResponseId.get(element.id) ?? [];
    this.codeBlocksByResponseId.set(element.id, codeBlocksByResponseId);
    part.addDisposable(toDisposable(() => {
      const codeBlocksByResponseId2 = this.codeBlocksByResponseId.get(element.id);
      if (codeBlocksByResponseId2) {
        part.codeblocks?.forEach((info, i) => {
          const codeblock = codeBlocksByResponseId2[codeBlockStartIndex + i];
          if (codeblock?.ownerMarkdownPartId === part.codeblocksPartId) {
            delete codeBlocksByResponseId2[codeBlockStartIndex + i];
          }
        });
      }
    }));
    part.codeblocks?.forEach((info, i) => {
      codeBlocksByResponseId[codeBlockStartIndex + i] = info;
      const uri = info.uri;
      if (uri) {
        this.codeBlocksByEditorUri.set(uri, info);
        part.addDisposable(toDisposable(() => {
          const codeblock = this.codeBlocksByEditorUri.get(uri);
          if (codeblock?.ownerMarkdownPartId === part.codeblocksPartId) {
            this.codeBlocksByEditorUri.delete(uri);
          }
        }));
      }
    });
  }
  renderToolInvocation(toolInvocation, context, templateData, batchedSubagentParts) {
    if (IChatToolInvocation.isComplete(toolInvocation) && IChatToolInvocation.isEffectivelyHidden(toolInvocation)) {
      const msg = toolInvocation.pastTenseMessage ?? toolInvocation.invocationMessage;
      const text = typeof msg === "string" ? msg : msg?.value;
      if (!text || text.trim().length === 0) {
        return this.renderNoContent((other) => (other.kind === "toolInvocation" || other.kind === "toolInvocationSerialized") && other.toolCallId === toolInvocation.toolCallId);
      }
    }
    if (this.configService.getValue("chat.agent.thinking.collapsedTools") === CollapsedToolsDisplayMode.Off) {
      this.finalizeCurrentThinkingPart(context, templateData);
    }
    const codeBlockStartIndex = context.codeBlockStartIndex;
    let lazilyCreatedPart = void 0;
    const createToolPart = () => {
      lazilyCreatedPart = this.instantiationService.createInstance(ChatToolInvocationPart, toolInvocation, context, this.chatContentMarkdownRenderer, this._contentReferencesListPool, this._toolEditorPool, () => this._currentLayoutWidth.get(), this._announcedToolProgressKeys, codeBlockStartIndex);
      this.handleRenderedCodeblocks(context.element, lazilyCreatedPart, codeBlockStartIndex);
      return { domNode: lazilyCreatedPart.domNode, disposable: lazilyCreatedPart, part: lazilyCreatedPart };
    };
    const collapsedToolsMode = this.configService.getValue("chat.agent.thinking.collapsedTools");
    if (isResponseVM(context.element) && collapsedToolsMode !== CollapsedToolsDisplayMode.Off) {
      const { part: lastThinking, separatedFromReasoning } = this.getLastThinkingPartForGroupedItem(context, templateData);
      if (!lastThinking && !IChatToolInvocation.isEffectivelyHidden(toolInvocation) && this.shouldPinPart(toolInvocation, context.element) && shouldCreateGroupedThinkingPart(collapsedToolsMode, separatedFromReasoning)) {
        const thinkingPart = this.renderThinkingPart({
          kind: "thinking"
        }, context, templateData);
        if (thinkingPart instanceof ChatThinkingContentPart) {
          toolInvocation.isAttachedToThinking = true;
          thinkingPart.appendItem(createToolPart, toolInvocation.toolId, toolInvocation, templateData.value);
          this.setupConfirmationTransitionWatcher(toolInvocation, thinkingPart, () => lazilyCreatedPart, createToolPart, context, templateData);
        }
        return thinkingPart;
      }
      if (this.shouldPinPart(toolInvocation, context.element)) {
        if (lastThinking && !IChatToolInvocation.isEffectivelyHidden(toolInvocation)) {
          toolInvocation.isAttachedToThinking = true;
          lastThinking.appendItem(createToolPart, toolInvocation.toolId, toolInvocation, templateData.value);
          this.setupConfirmationTransitionWatcher(toolInvocation, lastThinking, () => lazilyCreatedPart, createToolPart, context, templateData);
          return this.renderNoContent((other, followingContent, element) => lazilyCreatedPart ? lazilyCreatedPart.hasSameContent(other, followingContent, element) : toolInvocation.kind === other.kind);
        }
      } else {
        this.finalizeCurrentThinkingPart(context, templateData);
      }
    }
    const subagentId = getSubagentId(toolInvocation);
    if (subagentId && isResponseVM(context.element) && !IChatToolInvocation.isEffectivelyHidden(toolInvocation)) {
      return this.handleSubagentToolGrouping(toolInvocation, subagentId, context, templateData, codeBlockStartIndex, batchedSubagentParts);
    }
    const { part } = createToolPart();
    if (this.configService.getValue(ChatConfiguration.ToolConfirmationCarousel) && toolInvocation.kind === "toolInvocation" && isResponseVM(context.element) && toolInvocation.source.type !== "mcp" && !this.viewModel?.editing) {
      const widget = this.chatWidgetService.getWidgetBySessionResource(context.element.sessionResource);
      if (widget) {
        const factory = (tool) => this.instantiationService.createInstance(
          ChatToolInvocationPart,
          tool,
          context,
          this.chatContentMarkdownRenderer,
          this._contentReferencesListPool,
          this._toolEditorPool,
          () => this._currentLayoutWidth.get(),
          this._announcedToolProgressKeys,
          codeBlockStartIndex
        );
        const routePartToCarousel = () => {
          widget.inputPart.addToolToConfirmationCarousel(toolInvocation, factory);
          dom.hide(part.domNode);
          return true;
        };
        let hasScheduledCarouselRoute = false;
        const scheduleRoutePartToCarousel = () => {
          if (hasScheduledCarouselRoute) {
            return;
          }
          hasScheduledCarouselRoute = true;
          part.addDisposable(dom.scheduleAtNextAnimationFrame(dom.getWindow(part.domNode), () => {
            hasScheduledCarouselRoute = false;
            const state = toolInvocation.state.get();
            if (state.type === IChatToolInvocation.StateKind.WaitingForConfirmation && state.confirmationMessages?.title && toolInvocation.presentation !== "hidden" && toolInvocation.source.type !== "mcp" && !this.viewModel?.editing) {
              routePartToCarousel();
            }
          }));
        };
        part.addDisposable(autorun((reader) => {
          const state = toolInvocation.state.read(reader);
          const isCarouselConfirmation = state.type === IChatToolInvocation.StateKind.WaitingForConfirmation && !!state.confirmationMessages?.title && toolInvocation.presentation !== "hidden" && toolInvocation.source.type !== "mcp" && !this.viewModel?.editing;
          if (isCarouselConfirmation) {
            if (!routePartToCarousel()) {
              dom.hide(part.domNode);
              scheduleRoutePartToCarousel();
            }
          } else if (IChatToolInvocation.isEffectivelyHidden(toolInvocation, reader)) {
            this.updateWorkingProgressForPendingConfirmations(templateData);
            dom.hide(part.domNode);
          } else {
            this.updateWorkingProgressForPendingConfirmations(templateData);
            dom.show(part.domNode);
          }
        }));
      }
    }
    return part;
  }
  // watch for confirmation part transition when tool invocation is streaming
  setupConfirmationTransitionWatcher(toolInvocation, thinkingPart, getCreatedPart, createToolPart, context, templateData) {
    if (toolInvocation.kind !== "toolInvocation") {
      return;
    }
    const moveConfirmationWidgetOutOfThinking = () => {
      const createdPart = getCreatedPart();
      toolInvocation.isAttachedToThinking = false;
      let part;
      if (createdPart?.domNode) {
        part = createdPart;
        const wrapper = createdPart.domNode.parentElement;
        if (wrapper?.classList.contains("chat-thinking-tool-wrapper")) {
          wrapper.remove();
        }
        templateData.value.appendChild(createdPart.domNode);
        thinkingPart.removeMaterializedItem(toolInvocation.toolCallId);
        (templateData.movedOutToolParts ??= new DisposableMap()).set(toolInvocation.toolCallId, createdPart);
      } else {
        thinkingPart.removeLazyItem(toolInvocation.toolId);
        const { domNode, part: createdPart2 } = createToolPart();
        part = createdPart2;
        (templateData.movedOutToolParts ??= new DisposableMap()).set(toolInvocation.toolCallId, createdPart2);
        templateData.value.appendChild(domNode);
      }
      this.finalizeCurrentThinkingPart(context, templateData);
      if (thinkingPart.isEffectivelyEmpty()) {
        thinkingPart.domNode?.remove();
        thinkingPart.dispose();
      }
      return part;
    };
    const isWorkingState = (type) => type === IChatToolInvocation.StateKind.Streaming || type === IChatToolInvocation.StateKind.Executing;
    const tryRouteConfirmationToCarousel = () => {
      if (!this.configService.getValue(ChatConfiguration.ToolConfirmationCarousel) || !isResponseVM(context.element) || this.viewModel?.editing || toolInvocation.presentation === "hidden" || toolInvocation.source.type === "mcp") {
        return false;
      }
      const state = toolInvocation.state.get();
      if (state.type !== IChatToolInvocation.StateKind.WaitingForConfirmation || !state.confirmationMessages?.title) {
        return false;
      }
      const widget = this.chatWidgetService.getWidgetBySessionResource(context.element.sessionResource);
      if (!widget) {
        return false;
      }
      const part = moveConfirmationWidgetOutOfThinking();
      const factory = (tool) => this.instantiationService.createInstance(
        ChatToolInvocationPart,
        tool,
        context,
        this.chatContentMarkdownRenderer,
        this._contentReferencesListPool,
        this._toolEditorPool,
        () => this._currentLayoutWidth.get(),
        this._announcedToolProgressKeys,
        context.codeBlockStartIndex
      );
      part.addDisposable(autorun((reader) => {
        const currentState2 = toolInvocation.state.read(reader);
        if (currentState2.type === IChatToolInvocation.StateKind.WaitingForConfirmation && currentState2.confirmationMessages?.title) {
          widget.inputPart.addToolToConfirmationCarousel(toolInvocation, factory);
          dom.hide(part.domNode);
        } else if (IChatToolInvocation.isEffectivelyHidden(toolInvocation, reader)) {
          this.updateWorkingProgressForPendingConfirmations(templateData);
          dom.hide(part.domNode);
        } else {
          this.updateWorkingProgressForPendingConfirmations(templateData);
          dom.show(part.domNode);
        }
      }));
      return true;
    };
    const currentState = toolInvocation.state.get();
    if (toolInvocationHasMcpAppData(toolInvocation)) {
      moveConfirmationWidgetOutOfThinking();
      return;
    }
    if (currentState.type === IChatToolInvocation.StateKind.WaitingForConfirmation) {
      if (!tryRouteConfirmationToCarousel()) {
        moveConfirmationWidgetOutOfThinking();
      }
      return;
    }
    if (currentState.type === IChatToolInvocation.StateKind.WaitingForPostApproval) {
      moveConfirmationWidgetOutOfThinking();
      return;
    }
    if (!isWorkingState(currentState.type)) {
      return;
    }
    let didMoveToolOut = false;
    const disposable = autorun((reader) => {
      const state = toolInvocation.state.read(reader);
      toolInvocation.toolSpecificDataKind.read(reader);
      if (toolInvocationHasMcpAppData(toolInvocation)) {
        if (didMoveToolOut) {
          return;
        }
        didMoveToolOut = true;
        disposable.dispose();
        moveConfirmationWidgetOutOfThinking();
        return;
      }
      if (state.type === IChatToolInvocation.StateKind.WaitingForConfirmation || state.type === IChatToolInvocation.StateKind.WaitingForPostApproval) {
        if (didMoveToolOut) {
          return;
        }
        didMoveToolOut = true;
        disposable.dispose();
        if (state.type !== IChatToolInvocation.StateKind.WaitingForConfirmation || !tryRouteConfirmationToCarousel()) {
          moveConfirmationWidgetOutOfThinking();
        }
      }
    });
    thinkingPart.addDisposable(disposable);
  }
  renderExtensionsContent(extensionsContent, context, templateData) {
    const part = this.instantiationService.createInstance(ChatExtensionsContentPart, extensionsContent);
    return part;
  }
  renderHookPart(hookPart, context, templateData, batchedSubagentParts) {
    if (!(hookPart.stopReason || hookPart.systemMessage)) {
      return this.renderNoContent((other) => other.kind === "hook" && other.hookType === hookPart.hookType);
    }
    if (hookPart.subAgentInvocationId) {
      const subagentPart = this.getSubagentPart(templateData.renderedParts, hookPart.subAgentInvocationId);
      if (subagentPart) {
        this.beginSubagentToolPresentationBatch(subagentPart, batchedSubagentParts);
        subagentPart.appendHookItem(() => {
          const part2 = this.instantiationService.createInstance(ChatHookContentPart, hookPart, context);
          return { domNode: part2.domNode, disposable: part2 };
        }, hookPart);
        return this.renderNoContent((other) => other.kind === "hook" && other.hookType === hookPart.hookType && other.subAgentInvocationId === hookPart.subAgentInvocationId);
      }
    }
    const shouldPinToThinking = hookPart.hookType === HookType.PreToolUse || hookPart.hookType === HookType.PostToolUse;
    if (shouldPinToThinking) {
      const hookTitle = hookPart.stopReason ? hookPart.toolDisplayName ? localize("hook.thinking.blocked", "Blocked {0}", hookPart.toolDisplayName) : localize("hook.thinking.blockedGeneric", "Blocked by hook") : hookPart.toolDisplayName ? localize("hook.thinking.warning", "Used {0}, but received a warning", hookPart.toolDisplayName) : localize("hook.thinking.warningGeneric", "Tool call received a warning");
      let { part: thinkingPart } = this.getLastThinkingPartForGroupedItem(context, templateData);
      if (!thinkingPart) {
        const newThinking = this.renderThinkingPart({ kind: "thinking" }, context, templateData);
        if (newThinking instanceof ChatThinkingContentPart) {
          thinkingPart = newThinking;
        }
      }
      if (thinkingPart) {
        thinkingPart.appendItem(() => {
          const part2 = this.instantiationService.createInstance(ChatHookContentPart, hookPart, context);
          return { domNode: part2.domNode, disposable: part2 };
        }, hookTitle, void 0, templateData.value);
        return thinkingPart;
      }
    }
    const part = this.instantiationService.createInstance(ChatHookContentPart, hookPart, context);
    return part;
  }
  renderPullRequestContent(pullRequestContent, context, templateData) {
    const part = this.instantiationService.createInstance(ChatPullRequestContentPart, pullRequestContent);
    return part;
  }
  renderProgressTask(task, templateData, context) {
    if (!isResponseVM(context.element)) {
      return;
    }
    this.finalizeCurrentThinkingPart(context, templateData);
    const taskPart = this.instantiationService.createInstance(ChatTaskContentPart, task, this._contentReferencesListPool, this.chatContentMarkdownRenderer, context);
    return taskPart;
  }
  renderConfirmation(context, confirmation, templateData) {
    const part = this.instantiationService.createInstance(ChatConfirmationContentPart, confirmation, context);
    return part;
  }
  renderElicitation(context, elicitation, templateData) {
    if (elicitation.kind === "elicitationSerialized" ? elicitation.isHidden : elicitation.isHidden?.get()) {
      return this.renderNoContent((other) => elicitation.kind === other.kind);
    }
    this.finalizeCurrentThinkingPart(context, templateData);
    const part = this.instantiationService.createInstance(ChatElicitationContentPart, elicitation, context);
    return part;
  }
  renderQuestionCarousel(context, carousel, templateData) {
    this.finalizeCurrentThinkingPart(context, templateData);
    this._notifyOnQuestionCarousel(context, carousel);
    if (!carousel.terminalId && isResponseVM(context.element)) {
      const responseElement = context.element;
      const model = this.chatService.getSession(responseElement.sessionResource);
      const request = model?.getRequests().find((r) => r.id === responseElement.requestId);
      if (request?.terminalExecutionId) {
        carousel.terminalId = request.terminalExecutionId;
        this.logService.trace(`ChatListItemRenderer#renderQuestionCarousel: backfilled terminalId=${carousel.terminalId} for request=${responseElement.requestId}`);
      } else {
        this.logService.trace(`ChatListItemRenderer#renderQuestionCarousel: no terminalExecutionId to backfill for request=${responseElement.requestId}`);
      }
    }
    const widget = isResponseVM(context.element) ? this.chatWidgetService.getWidgetBySessionResource(context.element.sessionResource) : void 0;
    const shouldAutoFocus = !!widget && dom.isAncestorOfActiveElement(widget.domNode) && widget.getInput() === "";
    const responseId = isResponseVM(context.element) ? context.element.requestId : void 0;
    const carouselKey = carousel.resolveId ?? `${responseId ?? ""}_${context.contentIndex}`;
    const handleSubmit = async (answers, part2) => {
      if (carousel.isUsed) {
        return;
      }
      const answersRecord = answers ? Object.fromEntries(answers) : void 0;
      carousel.data = answersRecord ?? {};
      carousel.isUsed = true;
      if (carousel instanceof ChatQuestionCarouselData) {
        carousel.draftAnswers = void 0;
        carousel.draftCurrentIndex = void 0;
        carousel.completion.complete({ answers: answersRecord });
      }
      if (isResponseVM(context.element) && carousel.resolveId) {
        this.chatService.notifyQuestionCarouselAnswer(context.element.requestId, carousel.resolveId, answersRecord);
      }
      this.removeCarouselFromTracking(context, part2);
      widget?.input.clearQuestionCarousel(void 0, carouselKey);
    };
    const responseIsComplete = isResponseVM(context.element) && context.element.isComplete;
    const inputPartHasCarousel = widget?.input.questionCarousel !== void 0;
    if (carousel.isUsed || responseIsComplete) {
      if (responseIsComplete && !carousel.isUsed && isResponseVM(context.element) && carousel.resolveId) {
        carousel.data = {};
        carousel.isUsed = true;
        if (carousel instanceof ChatQuestionCarouselData) {
          carousel.draftAnswers = void 0;
          carousel.draftCurrentIndex = void 0;
          carousel.completion.complete({ answers: void 0 });
        }
        this.chatService.notifyQuestionCarouselAnswer(context.element.requestId, carousel.resolveId, void 0);
        this.pendingQuestionCarousels.get(context.element.sessionResource)?.clear();
      }
      if (inputPartHasCarousel) {
        if (carousel.isUsed) {
          widget?.input.clearQuestionCarousel(void 0, carouselKey);
        } else if (responseIsComplete && responseId) {
          widget?.input.clearQuestionCarousel(responseId);
        }
      }
      const part2 = this.instantiationService.createInstance(ChatQuestionCarouselPart, carousel, context, {
        shouldAutoFocus: false,
        onSubmit: async (answers) => handleSubmit(answers, part2)
      });
      return part2;
    }
    const isEditing = !!this.viewModel?.editing;
    const part = isEditing ? void 0 : widget?.input.renderQuestionCarousel(carousel, context, {
      shouldAutoFocus,
      onSubmit: async (answers) => handleSubmit(answers, part)
    });
    if (!part) {
      const fallbackPart = this.instantiationService.createInstance(ChatQuestionCarouselPart, carousel, context, {
        shouldAutoFocus,
        onSubmit: async (answers) => handleSubmit(answers, fallbackPart)
      });
      return fallbackPart;
    }
    if (isResponseVM(context.element) && carousel.allowSkip && !carousel.isUsed) {
      let carousels = this.pendingQuestionCarousels.get(context.element.sessionResource);
      if (!carousels) {
        carousels = /* @__PURE__ */ new Set();
        this.pendingQuestionCarousels.set(context.element.sessionResource, carousels);
      }
      if (!carousels.has(part)) {
        carousels.add(part);
        part.addDisposable({ dispose: () => this.removeCarouselFromTracking(context, part) });
      }
    }
    return this.renderNoContent((other, _followingContent, element) => {
      if (carousel.isUsed || isResponseVM(element) && element.isComplete) {
        return false;
      }
      if (other.kind === "questionCarousel") {
        const otherCarousel = other;
        if (carousel.resolveId && otherCarousel.resolveId) {
          return carousel.resolveId === otherCarousel.resolveId;
        }
        return other === carousel;
      }
      return false;
    });
  }
  _getCarouselStableKey(context, carousel) {
    const requestId = isResponseVM(context.element) ? context.element.requestId : void 0;
    if (!requestId || !carousel.resolveId) {
      return void 0;
    }
    return `${requestId}::${carousel.resolveId}`;
  }
  _notifyOnQuestionCarousel(context, carousel) {
    if (carousel.isUsed) {
      return;
    }
    const stableKey = this._getCarouselStableKey(context, carousel);
    if (stableKey ? this._notifiedQuestionCarousels.has(stableKey) : false) {
      return;
    }
    const questionCount = carousel.questions.length;
    const question = carousel.questions.length > 0 && carousel.questions[0].message ? carousel.questions[0].message : localize("chat.questionCarouselNeedsInputSR", "Chat input required.");
    const stringQuestion = typeof question === "string" ? question : question.value;
    const alertMessage = questionCount === 1 ? localize("chat.questionCarouselAlertOne", "Chat input required (1 question): {0}", stringQuestion) : localize("chat.questionCarouselAlertMany", "Chat input required ({0} questions): {1}", questionCount, stringQuestion);
    this.accessibilityService.alert(alertMessage);
    if (stableKey) {
      this._notifiedQuestionCarousels.add(stableKey);
    }
    const signalMessage = questionCount === 1 ? localize("chat.questionCarouselSignalOne", "Chat needs your input (1 question).") : localize("chat.questionCarouselSignalMany", "Chat needs your input ({0} questions).", questionCount);
    this.accessibilitySignalService.playSignal(AccessibilitySignal.chatUserActionRequired, { allowManyInParallel: true, customAlertMessage: signalMessage });
  }
  renderPlanReview(context, review, templateData) {
    const widget = isResponseVM(context.element) ? this.chatWidgetService.getWidgetBySessionResource(context.element.sessionResource) : void 0;
    const responseId = isResponseVM(context.element) ? context.element.requestId : void 0;
    const reviewKey = review.resolveId ?? `${responseId ?? ""}_${context.contentIndex}`;
    this.finalizeCurrentThinkingPart(context, templateData);
    const handleSubmit = (result) => {
      review.data = result;
      review.isUsed = true;
      if (review instanceof ChatPlanReviewData) {
        review.completion.complete(result);
      }
      widget?.input.clearPlanReview(void 0, reviewKey);
    };
    const responseIsComplete = isResponseVM(context.element) && context.element.isComplete;
    if (responseIsComplete && !review.isUsed) {
      review.isUsed = true;
      if (review instanceof ChatPlanReviewData) {
        review.completion.complete(void 0);
      }
    }
    if (responseIsComplete && responseId) {
      widget?.input.clearPlanReview(responseId);
    }
    const renderProgress = () => {
      const message = this.getPlanReviewProgressMessage(review);
      if (!message) {
        return this.renderNoContent((other) => other.kind === "planReview");
      }
      const renderedAsUsed = !!review.isUsed;
      const isPending = !renderedAsUsed;
      const content = buildPlanReviewProgressContent(review, message);
      const progressPart = this.instantiationService.createInstance(
        ChatProgressContentPart,
        { content },
        this.chatContentMarkdownRenderer,
        context,
        /* forceShowSpinner */
        isPending,
        /* forceShowMessage */
        true,
        /* icon */
        isPending ? void 0 : Codicon.check,
        void 0,
        /* shimmer */
        isPending
      );
      return {
        domNode: progressPart.domNode,
        dispose: () => progressPart.dispose(),
        hasSameContent: (other, _followingContent, _element) => {
          if (other.kind !== "planReview") {
            return false;
          }
          if (!!review.isUsed !== renderedAsUsed) {
            return false;
          }
          if (review.resolveId && other.resolveId) {
            return review.resolveId === other.resolveId;
          }
          return other === review;
        }
      };
    };
    if (review.isUsed) {
      return renderProgress();
    }
    const isEditing = !!this.viewModel?.editing;
    const dockedPart = isEditing ? void 0 : widget?.input.renderPlanReview(review, context, {
      onSubmit: handleSubmit
    });
    if (!dockedPart) {
      const fallbackPart = this.instantiationService.createInstance(ChatPlanReviewPart, review, context, {
        onSubmit: handleSubmit
      });
      return fallbackPart;
    }
    return renderProgress();
  }
  getPlanReviewProgressMessage(review) {
    if (!review.isUsed) {
      return localize("chat.planReview.required", "Plan review required");
    }
    const result = review.data;
    if (!result) {
      return void 0;
    }
    if (result.rejected) {
      return localize("chat.planReview.rejected", "Rejected plan");
    }
    if (result.feedback) {
      return localize("chat.planReview.feedback", "Provided feedback");
    }
    const action = review.actions.find((a) => a.label === result.action);
    if (action?.permissionLevel === "autopilot") {
      return localize("chat.planReview.autopilot", "Started implementation with Autopilot");
    }
    return localize("chat.planReview.approved", "Approved plan");
  }
  removeCarouselFromTracking(context, part) {
    if (isResponseVM(context.element)) {
      const carousels = this.pendingQuestionCarousels.get(context.element.sessionResource);
      if (carousels) {
        carousels.delete(part);
      }
    }
  }
  renderChangesSummary(content, context, templateData) {
    const part = this.instantiationService.createInstance(ChatCheckpointFileChangesSummaryContentPart, content, context);
    return part;
  }
  renderTurnPills(content, context) {
    return this.instantiationService.createInstance(ChatTurnPillsContentPart, content, context);
  }
  renderAttachments(variables, contentReferences, modelId, templateData, resolvedModelId) {
    return this.instantiationService.createInstance(ChatAttachmentsContentPart, {
      variables,
      contentReferences,
      modelId,
      resolvedModelId,
      domNode: void 0
    });
  }
  renderTextEdit(context, chatTextEdit, templateData) {
    const textEditPart = this.instantiationService.createInstance(ChatTextEditContentPart, chatTextEdit, context, this.rendererOptions, this._diffEditorPool, this._currentLayoutWidth.get());
    return textEditPart;
  }
  renderExternalEdit(content, context, templateData) {
    const editPart = this.instantiationService.createInstance(ChatExternalEditContentPart, content, context);
    const collapsedToolsMode = this.configService.getValue("chat.agent.thinking.collapsedTools");
    if (isResponseVM(context.element) && collapsedToolsMode !== CollapsedToolsDisplayMode.Off && this.shouldPinPart(content, context.element)) {
      const partId = `externalEdit-${content.uri.toString()}-${content.undoStopId ?? ""}`;
      const { part: lastThinking, separatedFromReasoning } = this.getLastThinkingPartForGroupedItem(context, templateData);
      if (!lastThinking && shouldCreateGroupedThinkingPart(collapsedToolsMode, separatedFromReasoning)) {
        const thinkingPart = this.renderThinkingPart({ kind: "thinking" }, context, templateData);
        if (thinkingPart instanceof ChatThinkingContentPart) {
          thinkingPart.appendItem(
            () => ({ domNode: editPart.domNode, disposable: editPart }),
            partId,
            content,
            templateData.value,
            editPart.onDidChangeDiff,
            editPart
          );
        }
        return thinkingPart;
      }
      if (lastThinking) {
        lastThinking.appendItem(
          () => ({ domNode: editPart.domNode, disposable: editPart }),
          partId,
          content,
          templateData.value,
          editPart.onDidChangeDiff,
          editPart
        );
        return this.renderNoContent((other) => other.kind === content.kind);
      }
    }
    return editPart;
  }
  renderMarkdown(markdown, templateData, context) {
    const element = context.element;
    const isBlankMarkdown = !markdown.content.value.trim();
    const hasPendingEditCodeblock = isResponseVM(element) && !element.isComplete && hasCodeblockUriTag(markdown.content.value) && !codeblockHasClosingBackticks(markdown.content.value);
    if (!this.hasEditCodeblockUri(markdown) && !isBlankMarkdown && !hasPendingEditCodeblock) {
      this.finalizeCurrentThinkingPart(context, templateData);
    }
    const fillInIncompleteTokens = isResponseVM(element) && (!element.isComplete || element.isCanceled || element.errorDetails?.responseIsFiltered || element.errorDetails?.responseIsIncomplete || !!element.renderData);
    const codeBlockStartIndex = context.codeBlockStartIndex;
    const markdownPart = templateData.instantiationService.createInstance(ChatMarkdownContentPart, markdown, context, this._editorPool, fillInIncompleteTokens, codeBlockStartIndex, this.chatContentMarkdownRenderer, void 0, this._currentLayoutWidth.get(), { codeBlockRenderOptions: this.rendererOptions.codeBlockRenderOptions });
    markdownPart.addDisposable(markdownPart.onDidChangeHeight(() => this.fireItemHeightChange(templateData)));
    if (isRequestVM(element)) {
      markdownPart.domNode.tabIndex = 0;
      if (this.configService.getValue("chat.editRequests") === "inline" && this.rendererOptions.editable) {
        markdownPart.domNode.classList.add("clickable");
        markdownPart.addDisposable(dom.addDisposableListener(markdownPart.domNode, dom.EventType.CLICK, (e) => {
          if (this.viewModel?.editing?.id === element.id) {
            return;
          }
          const clickedElement = e.target;
          if (clickedElement.tagName === "A") {
            return;
          }
          const selection = dom.getWindow(templateData.rowContainer).getSelection();
          if (selection && !selection.isCollapsed && selection.toString().length > 0) {
            return;
          }
          const monacoEditor = dom.findParentWithClass(clickedElement, "monaco-editor");
          if (monacoEditor) {
            const editorPart = Array.from(this.editorsInUse()).find((editor) => editor.element.contains(monacoEditor));
            if (editorPart?.editor.getSelection()?.isEmpty() === false) {
              return;
            }
          }
          e.preventDefault();
          e.stopPropagation();
          this._onDidClickRequest.fire(templateData);
        }));
        markdownPart.addDisposable(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), markdownPart.domNode, localize("requestMarkdownPartTitle", "Click to Edit"), { trapFocus: true }));
      }
      markdownPart.addDisposable(dom.addDisposableListener(markdownPart.domNode, dom.EventType.FOCUS, () => {
        this.hoverVisible(templateData.requestHover);
      }));
      markdownPart.addDisposable(dom.addDisposableListener(markdownPart.domNode, dom.EventType.BLUR, () => {
        this.hoverHidden(templateData.requestHover);
      }));
    }
    this.handleRenderedCodeblocks(element, markdownPart, codeBlockStartIndex);
    const collapsedToolsMode = this.configService.getValue("chat.agent.thinking.collapsedTools");
    if (isResponseVM(context.element) && collapsedToolsMode !== CollapsedToolsDisplayMode.Off) {
      const isComplete = this.isCodeblockComplete(markdown, context.element);
      const subAgentInvocationId = extractSubAgentInvocationIdFromText(markdown.content.value);
      if (subAgentInvocationId) {
        const subagentPart = this.getSubagentPart(templateData.renderedParts, subAgentInvocationId);
        if (subagentPart && markdownPart?.domNode && isComplete) {
          subagentPart.appendMarkdownItem(
            () => ({ domNode: markdownPart.domNode, disposable: markdownPart }),
            markdownPart.codeblocksPartId,
            markdown,
            templateData.value,
            markdownPart
          );
          return this.renderNoContent((other) => other.kind === "markdownContent" && other.content.value === markdown.content.value && extractSubAgentInvocationIdFromText(other.content.value) === subAgentInvocationId);
        }
      }
      const shouldPin = this.shouldPinPart(markdown, context.element);
      if (markdownPart?.domNode && shouldPin && isComplete) {
        const { part: lastThinking, separatedFromReasoning } = this.getLastThinkingPartForGroupedItem(context, templateData);
        if (!lastThinking && shouldCreateGroupedThinkingPart(collapsedToolsMode, separatedFromReasoning)) {
          const thinkingPart = this.renderThinkingPart({
            kind: "thinking"
          }, context, templateData);
          if (thinkingPart instanceof ChatThinkingContentPart) {
            thinkingPart.appendItem(
              () => ({ domNode: markdownPart.domNode, disposable: markdownPart }),
              markdownPart.codeblocksPartId,
              markdown,
              templateData.value,
              markdownPart.onDidChangeDiff,
              markdownPart
            );
          }
          return thinkingPart;
        }
        if (lastThinking) {
          lastThinking.appendItem(
            () => ({ domNode: markdownPart.domNode, disposable: markdownPart }),
            markdownPart.codeblocksPartId,
            markdown,
            templateData.value,
            markdownPart.onDidChangeDiff
          );
        }
      } else if (!shouldPin && !isBlankMarkdown && !hasPendingEditCodeblock) {
        this.finalizeCurrentThinkingPart(context, templateData);
      }
    }
    return markdownPart;
  }
  renderThinkingPart(content, context, templateData) {
    if (!content.id) {
      content.id = Date.now().toString();
    }
    const element = isResponseVM(context.element) ? context.element : void 0;
    const streamingCompleted = this.isThinkingLookAheadComplete(context, element);
    const lastThinkingPart = this.getLastThinkingPart(templateData.renderedParts);
    if (lastThinkingPart?.hasGroupedItems() && shouldStartNewCollapsedThinkingGroup(getEffectiveThinkingDisplayMode(this.configService, this.contextKeyService), "items", "reasoning")) {
      this.finalizeCurrentThinkingPart(context, templateData);
    }
    if (Array.isArray(content.value)) {
      if (content.value.length < 1) {
        const lastThinking = this.getLastThinkingPart(templateData.renderedParts);
        lastThinking?.finalizeTitleIfDefault();
        return this.renderNoContent((other) => content.kind === other.kind);
      }
      let lastPart;
      for (const item of content.value) {
        if (item) {
          const lastThinkingPart2 = lastPart instanceof ChatThinkingContentPart && lastPart.getIsActive() ? lastPart : void 0;
          if (lastThinkingPart2) {
            lastThinkingPart2.setupThinkingContainer({ ...content, value: item });
          } else {
            const itemContent = { ...content, value: item };
            const itemPart = templateData.instantiationService.createInstance(ChatThinkingContentPart, itemContent, context, this.chatContentMarkdownRenderer, streamingCompleted);
            lastPart = itemPart;
          }
        }
      }
      return lastPart ?? this.renderNoContent((other) => content.kind === other.kind);
    } else {
      const lastActiveThinking = this.getLastThinkingPart(templateData.renderedParts);
      if (lastActiveThinking) {
        lastActiveThinking.setupThinkingContainer(content);
        return lastActiveThinking;
      } else {
        const part = templateData.instantiationService.createInstance(ChatThinkingContentPart, content, context, this.chatContentMarkdownRenderer, streamingCompleted);
        return part;
      }
    }
  }
  disposeElement(node, index, templateData, details) {
    this.traceLayout("disposeElement", `Disposing element, index=${index}`);
    templateData.elementDisposables.clear();
    if (templateData.currentElement && !this.viewModel?.editing) {
      this.templateDataByRequestId.delete(templateData.currentElement.id);
    }
    const codeBlocks = this.codeBlocksByResponseId.get(node.element.id);
    if (codeBlocks) {
      for (const info of codeBlocks) {
        if (info?.uri) {
          this.codeBlocksByEditorUri.delete(info.uri);
        }
      }
      this.codeBlocksByResponseId.delete(node.element.id);
    }
    this.fileTreesByResponseId.delete(node.element.id);
    this.focusedFileTreesByResponseId.delete(node.element.id);
    if (isRequestVM(node.element) && node.element.id === this.viewModel?.editing?.id && details?.onScroll) {
      this._onDidDispose.fire(templateData);
    }
    if (templateData.titleToolbar) {
      templateData.titleToolbar.context = void 0;
    }
    templateData.footerToolbar.context = void 0;
    templateData.checkpointToolbar.context = void 0;
    templateData.checkpointRestoreToolbar.context = void 0;
    templateData.responseTokenStatsHover.clear();
  }
  renderMcpServersInteractionRequired(content, context, templateData) {
    return this.instantiationService.createInstance(ChatMcpServersInteractionContentPart, content, context);
  }
  renderDisabledClaudeHooks(content, context) {
    return this.instantiationService.createInstance(ChatDisabledClaudeHooksContentPart, context);
  }
  disposeTemplate(templateData) {
    this.clearRenderedParts(templateData);
    templateData.templateDisposables.dispose();
  }
  hoverVisible(requestHover) {
    requestHover.style.opacity = "1";
  }
  hoverHidden(requestHover) {
    requestHover.style.opacity = "0";
  }
};
ChatListItemRenderer = __decorateClass([
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, ILogService),
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, IThemeService),
  __decorateParam(10, ICommandService),
  __decorateParam(11, IHoverService),
  __decorateParam(12, IChatWidgetService),
  __decorateParam(13, IChatEntitlementService),
  __decorateParam(14, IChatService),
  __decorateParam(15, IAccessibilitySignalService),
  __decorateParam(16, IAccessibilityService),
  __decorateParam(17, IWorkbenchEnvironmentService),
  __decorateParam(18, ITelemetryService)
], ChatListItemRenderer);
class ChatListDelegate extends CachedListVirtualDelegate {
  constructor(defaultElementHeight) {
    super();
    this.defaultElementHeight = defaultElementHeight;
  }
  estimateHeight(element) {
    return element.currentRenderedHeight ?? this.defaultElementHeight;
  }
  getTemplateId(element) {
    return ChatListItemRenderer.ID;
  }
  hasDynamicHeight(element) {
    return true;
  }
  getMeasuredHeight(element) {
    return this.getCachedHeight(element);
  }
}
function isParentSubagentTool(invocation) {
  return invocation.toolSpecificData?.kind === "subagent" && !invocation.subAgentInvocationId;
}
function getSubagentId(invocation) {
  if (isParentSubagentTool(invocation)) {
    return invocation.toolCallId;
  }
  return invocation.subAgentInvocationId;
}
function isSubagentToolInvocation(invocation) {
  return !!getSubagentId(invocation);
}
function getWorkingProgressRelevantParts(parts) {
  return parts.filter((part) => {
    if (part.kind === "toolInvocation" || part.kind === "toolInvocationSerialized") {
      return !isSubagentToolInvocation(part);
    }
    if (part.kind === "hook") {
      return !part.subAgentInvocationId;
    }
    return part.kind !== "markdownContent" || !extractSubAgentInvocationIdFromText(part.content.value);
  });
}
function endsWithActiveSubagentContent(parts) {
  const lastPart = findLastMeaningfulPart(parts);
  if (!lastPart) {
    return false;
  }
  const subagentId = lastPart.kind === "toolInvocation" || lastPart.kind === "toolInvocationSerialized" ? getSubagentId(lastPart) : lastPart.kind === "hook" ? lastPart.subAgentInvocationId : lastPart.kind === "markdownContent" ? extractSubAgentInvocationIdFromText(lastPart.content.value) : void 0;
  if (!subagentId) {
    return false;
  }
  const parentSubagent = parts.find(
    (part) => (part.kind === "toolInvocation" || part.kind === "toolInvocationSerialized") && isParentSubagentTool(part) && part.toolCallId === subagentId
  );
  return parentSubagent?.toolSpecificData?.kind === "subagent" && (parentSubagent.toolSpecificData.isActive ?? !IChatToolInvocation.isComplete(parentSubagent));
}
function endsWithCompletedQuestionInteraction(parts) {
  const lastPart = findLastMeaningfulPart(parts);
  if (!lastPart) {
    return false;
  }
  if (lastPart.kind === "questionCarousel") {
    return !!lastPart.isUsed;
  }
  return (lastPart.kind === "toolInvocation" || lastPart.kind === "toolInvocationSerialized") && isAskQuestionsToolInvocation(lastPart) && IChatToolInvocation.isComplete(lastPart);
}
function isWaitingForMcpServers(parts) {
  return parts.some((part) => part.kind === "mcpServersStartingSlow" && part.servers.get().length > 0);
}
function findLastMeaningfulPart(parts) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (part.kind !== "markdownContent" || part.content.value.trim().length > 0) {
      return part;
    }
  }
  return void 0;
}
export {
  ChatListDelegate,
  ChatListItemRenderer,
  buildPlanReviewProgressContent,
  endsWithActiveSubagentContent,
  endsWithCompletedQuestionInteraction,
  formatCompletedResponseDisclosureLabel,
  formatResponseTokenStats,
  getCompletedResponseCollapseEndIndex,
  getFinalResponseStartIndex,
  getFinalResponseStartIndexAfterMovingSessionCreatedTools,
  getVisibleCompletedResponseItemCount,
  getWorkingProgressRelevantParts,
  isFinalResponseRendered,
  isWaitingForMcpServers,
  moveSessionCreatedToolsAfterFinalResponse,
  reconcileChatItemHeight,
  renderChatRequestTimestamp,
  renderChatResponseDetails,
  shouldCollapseCompletedResponsePart,
  shouldCreateGroupedThinkingPart,
  shouldHideChatUserIdentity,
  shouldPinToolInvocationToThinking,
  shouldRenderInitialProgressiveContentImmediately,
  shouldScheduleInitialHeightChange,
  shouldShowFileChangesSummaryForSettings,
  shouldShowPillsSummaryForSettings,
  shouldStartNewCollapsedThinkingGroup
};
