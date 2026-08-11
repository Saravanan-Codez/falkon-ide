import { decodeBase64 } from "../../../../../../base/common/buffer.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { escapeMarkdownLinkLabel, MarkdownString } from "../../../../../../base/common/htmlContent.js";
import { escapeIcons } from "../../../../../../base/common/iconLabels.js";
import { rewriteMarkdownLinks as rewriteMarkdownSource } from "../../../../../../base/common/markdownLinks.js";
import { Schemas } from "../../../../../../base/common/network.js";
import { posix, win32 } from "../../../../../../base/common/path.js";
import { URI } from "../../../../../../base/common/uri.js";
import { generateUuid } from "../../../../../../base/common/uuid.js";
import { buildSubagentChatUri, MessageKind, ToolCallCancellationReason, ToolCallContributorKind, ToolCallRiskAssessmentStatus, ToolCallStatus, TurnState, ResponsePartKind, getInlineToolInput, getToolFileEdits, getToolOutputText, getToolSubagentContent, hasReportedUsage, readUsageInfoMeta, ChatInputAnswerState, ChatInputAnswerValueKind, ChatInputQuestionKind, ChatInputResponseKind, FileEditKind, ToolResultContentType } from "../../../../../../platform/agentHost/common/state/sessionState.js";
import { getToolKind } from "../../../../../../platform/agentHost/common/state/sessionReducers.js";
import { readToolCallMeta } from "../../../../../../platform/agentHost/common/meta/agentToolCallMeta.js";
import { getChatErrorDetailsFromMeta } from "../../../common/chatErrorMessages.js";
import { AGENT_HOST_SCHEME, toAgentHostUri } from "../../../../../../platform/agentHost/common/agentHostUri.js";
import { AgentHostElementAttachmentDisplayKind, getElementAttachmentCorrelationId } from "../../../../../../platform/agentHost/common/meta/agentElementAttachments.js";
import { AgentHostAutoReplyAnswer } from "../../../../../../platform/agentHost/common/agentHostSchema.js";
import { getAgentFeedbackAttachmentMetadata, isAgentFeedbackAnnotationsAttachment, isAgentFeedbackAttachment } from "../../../../../../platform/agentHost/common/meta/agentFeedbackAttachments.js";
import { getBrowserViewAttachmentMetadata, isBrowserViewAttachment } from "../../../../../../platform/agentHost/common/meta/browserViewAttachments.js";
import { AgentSystemNotificationKind, AgentSystemNotificationSeverity, readAgentSystemNotificationMeta } from "../../../../../../platform/agentHost/common/meta/agentSystemNotificationMeta.js";
import { isViewUnreviewedCommentsTool, isAddCommentTool } from "../../../../../../platform/agentHost/common/meta/agentFeedbackAnnotations.js";
import { isCreateChatTool, isCreateSessionTool, isSendMessageTool, parseOpenSessionLinkChatId, parseOpenSessionLinkUri } from "../../../../../../platform/agentHost/common/openSessionLink.js";
import { parsePartialToolInputForDisplay } from "../../../../../../platform/agentHost/common/partialToolInput.js";
import { MessageAttachmentKind } from "../../../../../../platform/agentHost/common/state/protocol/state.js";
import { normalizeFileEdit } from "../../../../../../platform/agentHost/common/fileEditDiff.js";
import product from "../../../../../../platform/product/common/product.js";
import { ConfigureAutomationToolReferenceName } from "../../../common/automations/automationService.js";
import { formatCopilotCredits, ElicitationState, ToolConfirmKind, AgentFeedbackReviewCommandId } from "../../../common/chatService/chatService.js";
import { isTerminalCommandPrompt } from "../../../common/chatSessionsService.js";
import { ChatToolInvocation } from "../../../common/model/chatProgressTypes/chatToolInvocation.js";
import { ChatPlanReviewData } from "../../../common/model/chatProgressTypes/chatPlanReviewData.js";
import { ChatQuestionCarouselData } from "../../../common/model/chatProgressTypes/chatQuestionCarouselData.js";
import { AgentHostCompletionReferenceKind, restorePasteVariableEntryFromAttachment, toAgentHostCompletionVariableEntryFromMetadata } from "../../../common/attachments/chatVariableEntries.js";
import { ToolDataSource, ToolInvocationPresentation } from "../../../common/tools/languageModelToolsService.js";
import { basename } from "../../../../../../base/common/resources.js";
import { hasKey } from "../../../../../../base/common/types.js";
import { localize } from "../../../../../../nls.js";
import { isSessionReferenceTrajectoryAttachment, restoreSessionReferenceVariableEntryFromAttachment } from "./agentHostSessionReferenceAttachment.js";
import { restoreChatReferenceVariableEntryFromAttachment } from "./agentHostChatReferenceAttachment.js";
const BOOLEAN_TRUE_OPTION_ID = "true";
const BOOLEAN_FALSE_OPTION_ID = "false";
const agentHostAskUserToolNames = /* @__PURE__ */ new Set(["ask_user", "AskUserQuestion", "request_user_input"]);
function isAgentHostAskUserTool(toolName) {
  return agentHostAskUserToolNames.has(toolName);
}
function shouldHideCompletedAgentHostAskUserTool(toolCall) {
  if (!isAgentHostAskUserTool(toolCall.toolName)) {
    return false;
  }
  if (toolCall.status === ToolCallStatus.Completed) {
    return toolCall.success;
  }
  return toolCall.status === ToolCallStatus.Cancelled && toolCall.reason === ToolCallCancellationReason.Skipped;
}
function makeAhpTerminalToolSessionId(terminalUri, session) {
  return JSON.stringify({ terminal: terminalUri, session: session.toString() });
}
function parseAhpTerminalToolSessionId(id) {
  try {
    const parsed = JSON.parse(id);
    if (typeof parsed?.terminal === "string" && typeof parsed?.session === "string") {
      return parsed;
    }
  } catch {
  }
  return void 0;
}
function convertProtocolAnswer(answer) {
  if (answer.state !== ChatInputAnswerState.Submitted) {
    return void 0;
  }
  switch (answer.value.kind) {
    case ChatInputAnswerValueKind.Text:
      return answer.value.value;
    case ChatInputAnswerValueKind.Number:
    case ChatInputAnswerValueKind.Boolean:
      return String(answer.value.value);
    case ChatInputAnswerValueKind.Selected:
      return {
        selectedValue: answer.value.value,
        freeformValue: answer.value.freeformValues?.[0]
      };
    case ChatInputAnswerValueKind.SelectedMany:
      return {
        selectedValues: answer.value.value,
        freeformValue: answer.value.freeformValues?.[0]
      };
  }
}
function convertProtocolAnswers(raw) {
  if (!raw) {
    return void 0;
  }
  const answers = {};
  for (const [questionId, answer] of Object.entries(raw)) {
    const converted = convertProtocolAnswer(answer);
    if (converted !== void 0) {
      answers[questionId] = converted;
    }
  }
  return Object.keys(answers).length > 0 ? answers : void 0;
}
function containsAutomaticReplyAnswer(raw) {
  return Object.values(raw ?? {}).some(
    (answer) => answer.state === ChatInputAnswerState.Submitted && answer.value.kind === ChatInputAnswerValueKind.Text && answer.value.value === AgentHostAutoReplyAnswer
  );
}
function getPlanReviewAction(planReview, actionId) {
  return actionId ? planReview.actions.find((action) => action.id === actionId) : void 0;
}
function convertProtocolPlanReviewResult(planReview, response, answers) {
  if (response === ChatInputResponseKind.Decline) {
    return { rejected: true };
  }
  if (response !== ChatInputResponseKind.Accept) {
    return void 0;
  }
  const answer = answers?.[planReview.answerQuestionId];
  if (!answer || answer.state === ChatInputAnswerState.Skipped) {
    return void 0;
  }
  const value = answer.value;
  if (value.kind === ChatInputAnswerValueKind.Text) {
    const feedback2 = value.value.trim();
    return feedback2 ? { rejected: false, feedback: feedback2, feedbackOverall: feedback2 } : void 0;
  }
  if (value.kind !== ChatInputAnswerValueKind.Selected) {
    return void 0;
  }
  const action = getPlanReviewAction(planReview, value.value);
  const feedback = value.freeformValues?.find((v) => v.trim().length > 0)?.trim();
  return {
    rejected: false,
    action: action?.label ?? value.value,
    actionId: action?.id ?? value.value,
    ...feedback ? { feedback, feedbackOverall: feedback } : {}
  };
}
function createInputRequestCarousel(inputReq, connectionAuthority) {
  const questions = (inputReq.questions ?? []).map((question) => {
    let title = question.title;
    let message = question.message;
    if (!title) {
      const endOfLine = question.message.indexOf("\n");
      title = endOfLine === -1 ? question.message : question.message.substring(0, endOfLine).trim();
      message = endOfLine === -1 ? "" : question.message.substring(endOfLine + 1).trim();
    }
    const detailedMessage = new MarkdownString(message, { isTrusted: false });
    switch (question.kind) {
      case ChatInputQuestionKind.SingleSelect:
        return {
          id: question.id,
          type: "singleSelect",
          title,
          detailedMessage,
          required: question.required,
          allowFreeformInput: question.allowFreeformInput ?? true,
          options: question.options.map((option) => ({ id: option.id, label: option.label, value: option.id }))
        };
      case ChatInputQuestionKind.MultiSelect:
        return {
          id: question.id,
          type: "multiSelect",
          title,
          detailedMessage,
          required: question.required,
          allowFreeformInput: question.allowFreeformInput ?? true,
          options: question.options.map((option) => ({ id: option.id, label: option.label, value: option.id }))
        };
      case ChatInputQuestionKind.Boolean:
        return {
          id: question.id,
          type: "singleSelect",
          title,
          detailedMessage,
          required: question.required,
          allowFreeformInput: false,
          defaultValue: question.defaultValue === void 0 ? void 0 : String(question.defaultValue),
          options: [
            { id: BOOLEAN_TRUE_OPTION_ID, label: localize("chat.inputRequest.boolean.true", "True"), value: BOOLEAN_TRUE_OPTION_ID },
            { id: BOOLEAN_FALSE_OPTION_ID, label: localize("chat.inputRequest.boolean.false", "False"), value: BOOLEAN_FALSE_OPTION_ID }
          ]
        };
      case ChatInputQuestionKind.Text:
        return {
          id: question.id,
          type: "text",
          title,
          detailedMessage,
          required: question.required,
          defaultValue: question.defaultValue
        };
      default:
        return {
          id: question.id,
          type: "text",
          title,
          detailedMessage,
          required: question.required
        };
    }
  });
  if (questions.length === 0) {
    questions.push({
      id: "answer",
      type: "text",
      title: inputReq.message ?? "",
      required: true
    });
  }
  const carousel = new ChatQuestionCarouselData(
    questions,
    true,
    inputReq.id,
    void 0,
    void 0,
    inputReq.message ? rawMarkdownToString(inputReq.message, connectionAuthority) : void 0
  );
  carousel.answerPresentation = "conversation";
  return carousel;
}
function createInputRequestPlanReview(inputReq, planReview) {
  return new ChatPlanReviewData(
    planReview.title,
    planReview.content,
    planReview.actions.map((action) => ({
      id: action.id,
      label: action.label,
      ...action.description ? { description: action.description } : {},
      ...action.default ? { default: true } : {},
      ...action.permissionLevel ? { permissionLevel: action.permissionLevel } : {}
    })),
    planReview.canProvideFeedback,
    planReview.planUri ? URI.parse(planReview.planUri).toJSON() : void 0,
    inputReq.id
  );
}
function getUrlInputRequestPresentation(inputReq, url) {
  let authority = url;
  try {
    authority = URI.parse(url).authority || url;
  } catch {
  }
  const message = new MarkdownString();
  if (inputReq.message) {
    message.appendText(inputReq.message);
    message.appendMarkdown("\n\n");
  }
  message.appendMarkdown(localize("agentHost.elicit.url.instruction", "Open this URL?"));
  message.appendCodeblock("", url);
  return { authority, message };
}
function inputRequestResponsePartToProgress(part, connectionAuthority) {
  const inputReq = part.request;
  const planReview = inputReq.planReview;
  if (planReview) {
    const review = createInputRequestPlanReview(inputReq, planReview);
    review.data = part.response === void 0 ? void 0 : convertProtocolPlanReviewResult(planReview, part.response, inputReq.answers);
    review.isUsed = true;
    return review;
  }
  if (inputReq.url) {
    const presentation = getUrlInputRequestPresentation(inputReq, inputReq.url);
    return {
      kind: "elicitationSerialized",
      title: localize("agentHost.elicit.url.title", "Authorization Required"),
      message: presentation.message,
      subtitle: "",
      source: void 0,
      state: part.response === ChatInputResponseKind.Accept ? ElicitationState.Accepted : ElicitationState.Rejected,
      isHidden: false
    };
  }
  const carousel = createInputRequestCarousel(inputReq, connectionAuthority);
  const answers = part.response === ChatInputResponseKind.Accept ? convertProtocolAnswers(inputReq.answers) : void 0;
  carousel.data = answers ?? {};
  carousel.isUsed = true;
  carousel.autoReply = containsAutomaticReplyAnswer(inputReq.answers);
  carousel.answeredExternally = part.response === ChatInputResponseKind.Accept && (carousel.autoReply || !answers);
  return carousel;
}
function getSubagentTaskDescription(tc) {
  const v = readToolCallMeta(tc).subagentDescription;
  return v && v.length > 0 ? v : void 0;
}
function getSubagentAgentName(tc) {
  const v = readToolCallMeta(tc).subagentAgentName;
  return v && v.length > 0 ? v : void 0;
}
function getSubagentChatResource(tc, subagentContent, sessionResource) {
  return readToolCallMeta(tc).subagentChatUri ?? subagentContent?.resource ?? buildSubagentChatUri(sessionResource.toString(), tc.toolCallId);
}
function getMcpAppData(tc, _sessionResource) {
  if (tc.contributor?.kind !== ToolCallContributorKind.MCP) {
    return void 0;
  }
  const ui = readToolCallMeta(tc).ui;
  if (!ui) {
    return void 0;
  }
  const resourceUri = ui.resourceUri;
  const channelValue = ui.channel;
  if (channelValue === void 0) {
    return void 0;
  }
  return {
    kind: "agentHost",
    resourceUri,
    serverId: tc.contributor.customizationId,
    channel: channelValue
  };
}
function getToolRawInput(tc) {
  const toolInput = tc.status === ToolCallStatus.Streaming ? void 0 : getInlineToolInput(tc.toolInput);
  try {
    return toolInput ? JSON.parse(toolInput) : {};
  } catch {
    return { input: toolInput };
  }
}
function buildMcpAppToolInputData(tc, sessionResource, existingRawInput) {
  const mcpAppData = getMcpAppData(tc, sessionResource);
  if (!mcpAppData) {
    return void 0;
  }
  return {
    kind: "input",
    rawInput: existingRawInput ?? getToolRawInput(tc),
    mcpAppData
  };
}
function isSameMcpAppData(a, b) {
  if (a?.kind !== b?.kind || a?.resourceUri !== b?.resourceUri) {
    return false;
  }
  if (a?.kind === "agentHost" && b?.kind === "agentHost") {
    return a.serverId === b.serverId && a.channel === b.channel;
  }
  if (a?.kind === "local" && b?.kind === "local") {
    return a.serverDefinitionId === b.serverDefinitionId && a.collectionId === b.collectionId;
  }
  return a === b;
}
const SUBAGENT_TOOL_NAMES = /* @__PURE__ */ new Set(["task"]);
function isSubagentToolName(toolName) {
  return SUBAGENT_TOOL_NAMES.has(toolName);
}
function systemNotificationToChatPart(content, connectionAuthority, _meta) {
  if (!content) {
    return void 0;
  }
  const value = stringOrMarkdownToString(content, connectionAuthority);
  const markdown = typeof value === "string" ? new MarkdownString(value) : value;
  const meta = readAgentSystemNotificationMeta({ _meta });
  return meta.kind === AgentSystemNotificationKind.WorktreeCreationFailure && meta.severity === AgentSystemNotificationSeverity.Warning ? { kind: "warning", content: markdown } : { kind: "systemNotification", content: markdown };
}
function isSubagentTool(tc) {
  return getToolKind(tc) === "subagent" || isSubagentToolName(tc.toolName);
}
function getTerminalContentUri(content) {
  return getTerminalContent(content)?.resource;
}
function getTerminalContent(content) {
  return content?.find(isToolResultTerminalContent);
}
function formatTurnResponseDetails(model, billedModelId, usage) {
  if (!model) {
    return void 0;
  }
  const displayName = formatTurnModelName(model, billedModelId);
  const credits = usageInfoToChatUsage(usage)?.copilotCredits;
  if (credits !== void 0) {
    const formatted = formatCopilotCredits(credits);
    const creditDetails = formatted === "1" ? localize("agentHost.responseDetails.credit", "{0} credit", formatted) : localize("agentHost.responseDetails.credits", "{0} credits", formatted);
    return [displayName, creditDetails].join(" \u2022 ");
  }
  return [displayName, model.pricing].filter(Boolean).join(" \xB7 ");
}
function usageInfoToAutoModeResolution(usage, resolvedModelName) {
  const resolution = readUsageInfoMeta(usage).autoModeResolved;
  if (!resolution || typeof resolution.confidence !== "number" || !Number.isFinite(resolution.confidence)) {
    return void 0;
  }
  const predictedLabel = resolution.predictedLabel;
  if (predictedLabel !== "needs_reasoning" && predictedLabel !== "no_reasoning" && predictedLabel !== "fallback") {
    return void 0;
  }
  return {
    kind: "autoModeResolution",
    resolvedModel: resolution.chosenModel,
    resolvedModelName: resolvedModelName ?? resolution.chosenModel,
    predictedLabel,
    confidence: Math.max(0, Math.min(1, resolution.confidence))
  };
}
function formatTurnModelName(model, billedModelId) {
  if (billedModelId) {
    return localize("agentHost.responseDetails.resolvedModel", "{0} ({1})", model.name, billedModelId);
  }
  return model.name;
}
function usageInfoToChatUsage(usage, modelDisplayNameResolver) {
  if (!hasReportedUsage(usage)) {
    return void 0;
  }
  const turnTokenTotals = readUsageInfoMeta(usage).turnTokenTotals;
  return {
    kind: "usage",
    promptTokens: usage?.inputTokens ?? 0,
    completionTokens: usage?.outputTokens ?? 0,
    copilotCredits: getCopilotCredits(usage),
    sessionCopilotCredits: getSessionCopilotCredits(usage),
    promptTokenDetails: contextAttributionToPromptTokenDetails(usage),
    modelTotals: turnTokenTotals?.map((total) => ({
      ...total,
      model: modelDisplayNameResolver?.(total.model) ?? total.model
    }))
  };
}
function getSessionCopilotCredits(usage) {
  const sessionTotalNanoAiu = readUsageInfoMeta(usage).copilotUsage?.sessionTotalNanoAiu;
  return typeof sessionTotalNanoAiu === "number" && sessionTotalNanoAiu >= 0 ? sessionTotalNanoAiu / 1e9 : void 0;
}
function getCopilotCredits(usage) {
  const meta = readUsageInfoMeta(usage);
  const totalNanoAiu = meta?.copilotUsage?.totalNanoAiu;
  if (typeof totalNanoAiu === "number" && totalNanoAiu >= 0) {
    return totalNanoAiu / 1e9;
  }
  const cost = meta?.cost;
  return typeof cost === "number" && cost >= 0 ? cost : void 0;
}
function kindToCategory(kind) {
  switch (kind) {
    case "system":
    case "toolDefinition":
      return localize("contextAttribution.category.system", "System");
    case "tool":
    case "skill":
    case "subagent":
    case "mcpServer":
    case "plugin":
      return localize("contextAttribution.category.userContext", "User Context");
    default:
      return localize("contextAttribution.category.userContext", "User Context");
  }
}
function kindToAggregateLabel(kind) {
  switch (kind) {
    case "tool":
      return localize("contextAttribution.label.toolResults", "Tool Results");
    case "toolDefinition":
      return localize("contextAttribution.label.toolDefinitions", "Tool Definitions");
    case "skill":
      return localize("contextAttribution.label.skills", "Skills");
    case "subagent":
      return localize("contextAttribution.label.subAgents", "Sub-agents");
    case "mcpServer":
      return localize("contextAttribution.label.mcpTools", "MCP Tools");
    case "plugin":
      return localize("contextAttribution.label.plugins", "Plugins");
    default:
      return kind;
  }
}
function contextAttributionToPromptTokenDetails(usage) {
  const meta = readUsageInfoMeta(usage);
  const attribution = meta?.contextAttribution;
  if (!attribution || attribution.totalTokens <= 0 || attribution.entries.length === 0) {
    return void 0;
  }
  const details = [];
  const parentIds = /* @__PURE__ */ new Set();
  for (const entry of attribution.entries) {
    if (entry.parentId) {
      parentIds.add(entry.parentId);
    }
  }
  const kindTokens = /* @__PURE__ */ new Map();
  let accountedTokens = 0;
  for (const entry of attribution.entries) {
    if (entry.kind === "system") {
      if (parentIds.has(entry.id)) {
        continue;
      }
      accountedTokens += entry.tokens;
      const percentageOfPrompt = Math.round(entry.tokens / attribution.totalTokens * 100);
      if (percentageOfPrompt > 0) {
        details.push({
          category: kindToCategory("system"),
          label: entry.label,
          percentageOfPrompt
        });
      }
    } else {
      kindTokens.set(entry.kind, (kindTokens.get(entry.kind) ?? 0) + entry.tokens);
    }
  }
  for (const [kind, tokens] of kindTokens) {
    accountedTokens += tokens;
    const percentageOfPrompt = Math.round(tokens / attribution.totalTokens * 100);
    if (percentageOfPrompt <= 0) {
      continue;
    }
    const category = kindToCategory(kind);
    const label = kindToAggregateLabel(kind);
    details.push({ category, label, percentageOfPrompt });
  }
  const messageTokens = Math.max(0, attribution.totalTokens - accountedTokens);
  if (messageTokens > 0) {
    const percentageOfPrompt = Math.round(messageTokens / attribution.totalTokens * 100);
    if (percentageOfPrompt > 0) {
      details.push({
        category: localize("contextAttribution.category.userContext", "User Context"),
        label: localize("contextAttribution.label.messages", "Messages"),
        percentageOfPrompt
      });
    }
  }
  return details.length > 0 ? details : void 0;
}
function mapAccountQuotaSnapshot(snapshot) {
  const unlimited = snapshot.isUnlimitedEntitlement ?? false;
  const entitlement = typeof snapshot.entitlementRequests === "number" ? snapshot.entitlementRequests : void 0;
  if (!unlimited && entitlement === 0) {
    return void 0;
  }
  if (typeof snapshot.remainingPercentage !== "number") {
    return void 0;
  }
  const used = typeof snapshot.usedRequests === "number" ? snapshot.usedRequests : void 0;
  const resetAt = snapshot.resetDate ? Date.parse(snapshot.resetDate) : NaN;
  return {
    percentRemaining: Math.min(100, Math.max(0, snapshot.remainingPercentage)),
    unlimited,
    entitlement: !unlimited && entitlement !== void 0 && entitlement >= 0 ? entitlement : void 0,
    quotaRemaining: !unlimited && entitlement !== void 0 && used !== void 0 ? Math.max(0, entitlement - used) : void 0,
    resetAt: Number.isFinite(resetAt) ? resetAt : void 0
  };
}
function usageInfoToQuotas(usage) {
  const meta = readUsageInfoMeta(usage);
  const snapshots = meta?.quotaSnapshots;
  if (!snapshots) {
    return void 0;
  }
  const update = {};
  let hasAny = false;
  const chat = snapshots["chat"] && mapAccountQuotaSnapshot(snapshots["chat"]);
  if (chat) {
    update.chat = chat;
    hasAny = true;
  }
  const completions = snapshots["completions"] && mapAccountQuotaSnapshot(snapshots["completions"]);
  if (completions) {
    update.completions = completions;
    hasAny = true;
  }
  const premiumRaw = snapshots["premium_interactions"];
  const premiumChat = premiumRaw && mapAccountQuotaSnapshot(premiumRaw);
  if (premiumChat) {
    update.premiumChat = premiumChat;
    hasAny = true;
  }
  if (premiumRaw) {
    update.additionalUsageEnabled = premiumRaw.overageAllowedWithExhaustedQuota ?? false;
    update.additionalUsageCount = typeof premiumRaw.overage === "number" ? premiumRaw.overage : 0;
    hasAny = true;
  }
  const resetDate = premiumRaw?.resetDate ?? snapshots["chat"]?.resetDate;
  if (resetDate) {
    update.resetDate = resetDate;
  }
  return hasAny ? update : void 0;
}
function turnsToHistory(backendSession, turns, participantId, connectionAuthority, lookup, errorContext, terminalCommandPrefix) {
  const history = [];
  for (const turn of turns) {
    const rawModelId = turn.usage?.model;
    const modelId = lookup?.toLanguageModelId(rawModelId);
    const details = lookup?.toResponseDetails(rawModelId, turn.usage);
    const variableData = messageToVariableData(turn.message, connectionAuthority);
    const isSystemInitiated = turn.message.origin.kind === MessageKind.SystemNotification;
    const isTerminalRequest = isTerminalCommandPrompt(turn.message.text, terminalCommandPrefix);
    history.push({
      id: turn.id,
      type: "request",
      prompt: turn.message.text,
      participant: participantId,
      modelId,
      ...turn.startedAt !== void 0 && Number.isFinite(Date.parse(turn.startedAt)) ? { timestamp: Date.parse(turn.startedAt) } : {},
      variableData,
      ...isSystemInitiated ? {
        isSystemInitiated: true
      } : {},
      ...isTerminalRequest ? {
        isTerminalRequest: true
      } : {}
    });
    const parts = [];
    const autoModeResolution = lookup?.toAutoModeResolution?.(turn.usage);
    if (autoModeResolution) {
      parts.push(autoModeResolution);
    }
    const usage = usageInfoToChatUsage(turn.usage, lookup?.toModelDisplayName);
    if (usage) {
      parts.push(usage);
    }
    for (const rp of turn.responseParts) {
      switch (rp.kind) {
        case ResponsePartKind.Markdown:
          if (rp.content) {
            parts.push({ kind: "markdownContent", content: new MarkdownString(rp.content) });
          }
          break;
        case ResponsePartKind.ToolCall: {
          const tc = rp.toolCall;
          const fileEditParts = completedToolCallToEditParts(tc, connectionAuthority);
          const serialized = completedToolCallToSerialized(tc, void 0, backendSession, connectionAuthority);
          if (fileEditParts.length > 0) {
            serialized.presentation = ToolInvocationPresentation.Hidden;
          }
          parts.push(serialized);
          parts.push(...fileEditParts);
          break;
        }
        case ResponsePartKind.Reasoning:
          if (rp.content) {
            parts.push({ kind: "thinking", value: rp.content, id: rp.id });
          }
          break;
        case ResponsePartKind.SystemNotification:
          {
            const progress = systemNotificationToChatPart(rp.content, connectionAuthority, rp._meta);
            if (progress) {
              parts.push(progress);
            }
          }
          break;
        case ResponsePartKind.ContentRef:
          break;
        case ResponsePartKind.InputRequest: {
          parts.push(inputRequestResponsePartToProgress(rp, connectionAuthority));
          break;
        }
      }
    }
    let errorDetails;
    if (turn.state === TurnState.Error && turn.error) {
      errorDetails = getChatErrorDetailsFromMeta(turn.error, errorContext) ?? { message: `Error: (${turn.error.errorType}) ${turn.error.message}` };
    }
    const startedAt = turn.startedAt === void 0 ? void 0 : Date.parse(turn.startedAt);
    const completedAt = startedAt !== void 0 && Number.isFinite(startedAt) && typeof turn.duration === "number" && Number.isFinite(turn.duration) && turn.duration >= 0 ? startedAt + turn.duration : void 0;
    history.push({ type: "response", parts, participant: participantId, details, elapsedMs: turn.duration, completedAt, ...errorDetails ? { errorDetails } : {} });
  }
  return history;
}
function messageToVariableData(message, connectionAuthority) {
  return messageAttachmentsToVariableData(message.attachments, connectionAuthority, message.text);
}
function messageAttachmentsToVariableData(attachments, connectionAuthority, messageText) {
  if (!attachments?.length) {
    return void 0;
  }
  const variables = [];
  const aggregatedFeedback = aggregateAgentFeedbackAnnotationAttachments(attachments, connectionAuthority);
  if (aggregatedFeedback) {
    variables.push(aggregatedFeedback);
  }
  const consumedAttachments = /* @__PURE__ */ new Set();
  for (const a of attachments) {
    if (isAgentFeedbackAnnotationsAttachment(a) || consumedAttachments.has(a)) {
      continue;
    }
    const element = restoreElementVariableEntry(a, a.type === MessageAttachmentKind.Simple ? a.modelRepresentation : void 0);
    if (element) {
      const correlationId = getElementAttachmentCorrelationId(a);
      const imageAttachment = correlationId ? attachments.find((candidate) => candidate.displayKind === "image" && getElementAttachmentCorrelationId(candidate) === correlationId) : void 0;
      const image = imageAttachment ? messageAttachmentToVariableEntry(imageAttachment, connectionAuthority) : void 0;
      if (imageAttachment && image?.kind === "image") {
        consumedAttachments.add(imageAttachment);
      }
      variables.push(image?.kind === "image" ? { ...element, imageData: image.value instanceof Uint8Array || URI.isUri(image.value) ? image.value : void 0, imageMimeType: image.mimeType } : element);
      continue;
    }
    const v = messageAttachmentToVariableEntry(a, connectionAuthority, messageText);
    if (v) {
      variables.push(v);
    }
  }
  return variables.length > 0 ? { variables } : void 0;
}
function aggregateAgentFeedbackAnnotationAttachments(attachments, connectionAuthority) {
  const feedbackAttachments = attachments.filter(isAgentFeedbackAnnotationsAttachment);
  if (feedbackAttachments.length === 0) {
    return void 0;
  }
  let sessionResource;
  let annotationsResource;
  const feedbackItems = [];
  for (const attachment of feedbackAttachments) {
    annotationsResource ??= attachment.resource;
    const metadata = getAgentFeedbackAttachmentMetadata(attachment);
    if (!metadata) {
      continue;
    }
    sessionResource ??= metadata.sessionResource;
    for (const item of metadata.feedbackItems) {
      feedbackItems.push({
        id: item.id,
        text: item.text,
        resourceUri: toAgentHostUri(URI.parse(item.resourceUri), connectionAuthority),
        range: textRangeToIRange(item.range),
        ...item.replies?.length ? { replies: item.replies } : {}
      });
    }
  }
  if (feedbackItems.length === 0 || !sessionResource) {
    return void 0;
  }
  return {
    kind: "agentFeedback",
    id: generateUuid(),
    name: feedbackItems.length === 1 ? localize("agentFeedback.one", "1 comment") : localize("agentFeedback.many", "{0} comments", feedbackItems.length),
    value: feedbackAttachments[0].label,
    sessionResource: URI.parse(sessionResource),
    annotationsResource: annotationsResource ? URI.parse(annotationsResource) : void 0,
    feedbackItems
  };
}
function messageAttachmentToVariableEntry(attachment, connectionAuthority, messageText) {
  if (isAgentFeedbackAttachment(attachment)) {
    const metadata = getAgentFeedbackAttachmentMetadata(attachment);
    if (metadata) {
      return {
        kind: "agentFeedback",
        id: generateUuid(),
        name: attachment.label,
        value: attachment.modelRepresentation || attachment.label,
        sessionResource: URI.parse(metadata.sessionResource),
        feedbackItems: metadata.feedbackItems.map((item) => ({
          id: item.id,
          text: item.text,
          resourceUri: toAgentHostUri(URI.parse(item.resourceUri), connectionAuthority),
          range: textRangeToIRange(item.range)
        })),
        _meta: attachment._meta
      };
    }
  }
  if (attachment.type === MessageAttachmentKind.Resource) {
    if (isSessionReferenceTrajectoryAttachment(attachment)) {
      return void 0;
    }
    const uri = toAgentHostUri(URI.parse(attachment.uri), connectionAuthority);
    const name = attachment.label;
    const id = uri.toString() + (attachment.selection ? `:${attachment.selection.range.start.line}-${attachment.selection.range.end.line}` : "");
    const _meta = attachment._meta;
    if (attachment.displayKind === "directory") {
      return { kind: "directory", id, name, value: uri, _meta };
    }
    if (attachment.displayKind === "image") {
      return {
        kind: "image",
        id,
        name,
        value: uri,
        isURL: true,
        references: [{ kind: "reference", reference: uri }],
        _meta
      };
    }
    if (attachment.selection) {
      return {
        kind: "file",
        id,
        name,
        value: { uri, range: textRangeToIRange(attachment.selection.range) },
        _meta
      };
    }
    return { kind: "file", id, name, value: uri, _meta };
  }
  if (attachment.type === MessageAttachmentKind.EmbeddedResource) {
    if (!attachment.contentType.startsWith("image/")) {
      return {
        kind: "generic",
        id: generateUuid(),
        name: attachment.label,
        value: decodeBase64(attachment.data).buffer,
        _meta: attachment._meta
      };
    }
    return {
      kind: "image",
      id: generateUuid(),
      name: attachment.label || "image",
      value: decodeBase64(attachment.data).buffer,
      mimeType: attachment.contentType,
      isURL: false,
      _meta: attachment._meta
    };
  }
  if (attachment.type === MessageAttachmentKind.Chat) {
    return restoreChatReferenceVariableEntryFromAttachment(attachment, messageText);
  }
  const agentHostCompletionKind = getAgentHostCompletionKind(attachment);
  if (agentHostCompletionKind !== void 0) {
    return toAgentHostCompletionVariableEntryFromMetadata(agentHostCompletionKind, attachment.label, attachment._meta);
  }
  const modelRepresentation = attachment.type === MessageAttachmentKind.Simple ? attachment.modelRepresentation : void 0;
  if (isBrowserViewAttachment(attachment) && modelRepresentation !== void 0) {
    const metadata = getBrowserViewAttachmentMetadata(attachment);
    if (metadata) {
      return {
        kind: "browserView",
        id: metadata.browserUri,
        name: attachment.label,
        value: URI.parse(metadata.browserUri),
        browserId: metadata.browserId,
        modelDescription: modelRepresentation,
        _meta: attachment._meta
      };
    }
  }
  if (attachment.displayKind === "workspace" && modelRepresentation !== void 0) {
    return {
      kind: "workspace",
      id: attachment.label,
      name: attachment.label,
      value: modelRepresentation,
      _meta: attachment._meta
    };
  }
  if (attachment.type === MessageAttachmentKind.Simple) {
    const sessionReferenceEntry = restoreSessionReferenceVariableEntryFromAttachment(attachment);
    if (sessionReferenceEntry) {
      return sessionReferenceEntry;
    }
  }
  const pasteEntry = restorePasteVariableEntryFromAttachment({
    label: attachment.label,
    displayKind: attachment.displayKind,
    modelRepresentation,
    _meta: attachment._meta
  });
  if (pasteEntry) {
    return pasteEntry;
  }
  return {
    kind: "generic",
    id: generateUuid(),
    name: attachment.label,
    value: modelRepresentation || attachment.label,
    _meta: attachment._meta
  };
}
function restoreElementVariableEntry(attachment, modelRepresentation) {
  if (attachment.displayKind !== AgentHostElementAttachmentDisplayKind || modelRepresentation === void 0) {
    return void 0;
  }
  const fullName = /^Element:\s*(?<name>.+)$/m.exec(modelRepresentation)?.groups?.name;
  return {
    kind: "element",
    id: generateUuid(),
    name: attachment.label,
    ...fullName ? { fullName } : {},
    icon: Codicon.layout,
    value: modelRepresentation,
    _meta: attachment._meta
  };
}
function getAgentHostCompletionKind(attachment) {
  if (attachment.type !== MessageAttachmentKind.Simple) {
    return void 0;
  }
  switch (attachment.displayKind) {
    case "command":
      return AgentHostCompletionReferenceKind.Command;
    case "skill":
      return AgentHostCompletionReferenceKind.Skill;
  }
  return void 0;
}
function textRangeToIRange(range) {
  return {
    startLineNumber: range.start.line + 1,
    startColumn: range.start.character + 1,
    endLineNumber: range.end.line + 1,
    endColumn: range.end.character + 1
  };
}
function activeTurnToProgress(sessionResource, activeTurn, connectionAuthority, mcpServerAuthority = sessionResource.authority, toolInvocationOptions, lookup) {
  const parts = [];
  const usage = usageInfoToChatUsage(activeTurn.usage, lookup?.toModelDisplayName);
  if (usage) {
    parts.push(usage);
  }
  for (const rp of activeTurn.responseParts) {
    switch (rp.kind) {
      case ResponsePartKind.Markdown:
        if (rp.content) {
          parts.push({ kind: "markdownContent", content: new MarkdownString(rp.content) });
        }
        break;
      case ResponsePartKind.Reasoning:
        if (rp.content) {
          parts.push({ kind: "thinking", value: rp.content, id: rp.id });
        }
        break;
      case ResponsePartKind.ToolCall: {
        const tc = rp.toolCall;
        const isOtherClientToolCall = tc.contributor?.kind === ToolCallContributorKind.Client && toolInvocationOptions && tc.contributor.clientId !== toolInvocationOptions.currentClientId;
        if (tc.status === ToolCallStatus.Completed || tc.status === ToolCallStatus.Cancelled) {
          parts.push(completedToolCallToSerialized(tc, void 0, sessionResource, connectionAuthority));
        } else if (tc.status === ToolCallStatus.Streaming && !isOtherClientToolCall) {
          parts.push(toolCallStateToStreamingInvocation(tc, void 0, sessionResource, connectionAuthority, mcpServerAuthority));
        } else if (tc.status === ToolCallStatus.Running || tc.status === ToolCallStatus.AuthRequired || tc.status === ToolCallStatus.Streaming || tc.status === ToolCallStatus.PendingConfirmation) {
          parts.push(toolCallStateToInvocation(tc, void 0, sessionResource, connectionAuthority, mcpServerAuthority, toolInvocationOptions));
        }
        break;
      }
      case ResponsePartKind.SystemNotification:
        {
          const progress = systemNotificationToChatPart(rp.content, connectionAuthority, rp._meta);
          if (progress) {
            parts.push(progress);
          }
        }
        break;
      case ResponsePartKind.ContentRef:
        break;
    }
  }
  return parts;
}
function getTerminalInput(tc) {
  const toolInput = tc.status === ToolCallStatus.Streaming ? void 0 : getInlineToolInput(tc.toolInput);
  if (toolInput) {
    try {
      return JSON.parse(toolInput).command || toolInput;
    } catch {
      return toolInput;
    }
  }
  return void 0;
}
function getTerminalOutput(tc) {
  if (tc.status !== ToolCallStatus.Completed && tc.status !== ToolCallStatus.Running) {
    return void 0;
  }
  const terminalContent = getTerminalContent(tc.content);
  const terminalResult = getTerminalCommandResult(tc);
  const fallbackText = tc.content?.find(isToolResultTextContent)?.text;
  let text = terminalResult?.truncated === true && fallbackText !== void 0 ? stripLegacyTerminalExitMarkers(fallbackText) : terminalResult?.preview;
  const hasRetainedNonPtySnapshot = terminalContent?.isPty === false && text !== void 0;
  if (text === void 0 && terminalContent?.isPty !== false) {
    text = fallbackText === void 0 ? void 0 : stripLegacyTerminalExitMarkers(fallbackText);
  }
  if (text === void 0 || !text && !hasRetainedNonPtySnapshot && terminalResult?.truncated !== true) {
    return void 0;
  }
  return {
    text: text.replace(/\r?\n/g, "\r\n"),
    ...terminalResult?.truncated !== void 0 ? { truncated: terminalResult.truncated } : {}
  };
}
function stripLegacyTerminalExitMarkers(text) {
  return text.replace(/<shellId:[^>\r\n]*completed with exit code -?\d+>\s*$/i, "");
}
function isToolResultTextContent(content) {
  return content.type === ToolResultContentType.Text;
}
function getTerminalCommandState(tc, fallbackSuccess) {
  const terminalResult = tc.status === ToolCallStatus.Completed || tc.status === ToolCallStatus.Running ? getTerminalCommandResult(tc) : void 0;
  if (terminalResult?.exitCode !== void 0) {
    return { exitCode: terminalResult.exitCode };
  }
  if ((tc.status === ToolCallStatus.Completed || tc.status === ToolCallStatus.Running) && getTerminalContent(tc.content)?.isPty === false) {
    return fallbackSuccess === false ? { exitCode: 1 } : void 0;
  }
  return fallbackSuccess === void 0 ? void 0 : { exitCode: fallbackSuccess ? 0 : 1 };
}
function isToolResultTerminalContent(content) {
  return content.type === ToolResultContentType.Terminal;
}
function getTerminalCommandResult(tc) {
  const result = tc.content?.find(isToolResultTerminalContent)?.result;
  if (result) {
    return result;
  }
  return tc.content?.find((c) => c.type === "terminalComplete");
}
function getTerminalLanguage(tc) {
  return tc.toolName === "powershell" ? "powershell" : "shellscript";
}
function isTerminalToolCall(tc, existingKind) {
  if (existingKind === "terminal") {
    return true;
  }
  if (getToolKind(tc) === "terminal" && getTerminalInput(tc) !== void 0) {
    return true;
  }
  if (tc.status === ToolCallStatus.Running || tc.status === ToolCallStatus.Completed) {
    return !!getTerminalContentUri(tc.content);
  }
  return false;
}
function buildTerminalToolSpecificData(tc, sessionResource, existing) {
  const terminalContent = tc.status === ToolCallStatus.Running || tc.status === ToolCallStatus.Completed ? getTerminalContent(tc.content) : void 0;
  const terminalContentUri = terminalContent?.resource;
  const nextCommand = getTerminalInput(tc);
  const commandLine = nextCommand ? { ...existing?.commandLine, original: nextCommand } : existing?.commandLine ?? { original: "" };
  const nextOutput = getTerminalOutput(tc);
  return {
    ...existing,
    kind: "terminal",
    commandLine,
    intention: tc.intention ?? existing?.intention,
    language: existing?.language ?? getTerminalLanguage(tc),
    autoApproveRuleResolvable: readToolCallMeta(tc).autoApproveRuleResolvable ?? existing?.autoApproveRuleResolvable,
    terminalToolSessionId: terminalContentUri ? makeAhpTerminalToolSessionId(terminalContentUri, sessionResource) : existing?.terminalToolSessionId,
    terminalCommandUri: terminalContentUri ? URI.parse(terminalContentUri) : existing?.terminalCommandUri,
    isPty: terminalContent?.isPty ?? existing?.isPty,
    terminalCommandOutput: nextOutput ?? existing?.terminalCommandOutput
  };
}
function getToolInputOutputDetails(tc, isError, errorString, includeMcpOutput, connectionAuthority) {
  const toolInput = tc.status === ToolCallStatus.Streaming ? void 0 : getInlineToolInput(tc.toolInput);
  if (!toolInput) {
    return void 0;
  }
  const output = [];
  if (tc.status === ToolCallStatus.Completed || tc.status === ToolCallStatus.Running) {
    for (const block of tc.content ?? []) {
      switch (block.type) {
        case ToolResultContentType.Text:
          output.push({ type: "embed", value: block.text, isText: true, mimeType: "text/plain" });
          break;
        case ToolResultContentType.EmbeddedResource:
          output.push({ type: "embed", value: block.data, mimeType: block.contentType });
          break;
        case ToolResultContentType.Resource:
          output.push({ type: "ref", uri: wrapResourceUri(block.uri, connectionAuthority), mimeType: block.contentType });
          break;
      }
    }
  }
  if (output.length === 0 && errorString) {
    output.push({ type: "embed", value: errorString, isText: true, mimeType: "text/plain" });
  }
  return {
    input: toolInput,
    inputLanguage: "json",
    output,
    isError,
    mcpOutput: includeMcpOutput ? toMcpCallToolResult(tc, isError, connectionAuthority) : void 0
  };
}
function toMcpCallToolResult(tc, isError, connectionAuthority) {
  if (tc.status !== ToolCallStatus.Completed && tc.status !== ToolCallStatus.Running) {
    return void 0;
  }
  const content = [];
  for (const block of tc.content ?? []) {
    const mcpBlock = toMcpContentBlock(block, connectionAuthority);
    if (mcpBlock) {
      content.push(mcpBlock);
    }
  }
  if (content.length === 0 && !isError) {
    return void 0;
  }
  return { content, isError: isError || void 0 };
}
function toMcpContentBlock(block, connectionAuthority) {
  switch (block.type) {
    case ToolResultContentType.Text:
      return { type: "text", text: block.text };
    case ToolResultContentType.EmbeddedResource: {
      if (block.contentType.startsWith("image/")) {
        return { type: "image", data: block.data, mimeType: block.contentType };
      }
      if (block.contentType.startsWith("audio/")) {
        return { type: "audio", data: block.data, mimeType: block.contentType };
      }
      return {
        type: "resource",
        resource: {
          uri: `data:${block.contentType};base64,${block.data}`,
          mimeType: block.contentType,
          blob: block.data
        }
      };
    }
    case ToolResultContentType.Resource: {
      const wrapped = wrapResourceUri(block.uri, connectionAuthority);
      return {
        type: "resource_link",
        name: basename(wrapped) || wrapped.toString(),
        uri: wrapped.toString(),
        mimeType: block.contentType
      };
    }
    default:
      return void 0;
  }
}
function wrapResourceUri(uri, connectionAuthority) {
  return toAgentHostUri(URI.parse(uri), connectionAuthority);
}
function getToolErrorString(tc) {
  if (tc.status === ToolCallStatus.Completed) {
    return tc.error?.message;
  }
  if (tc.status === ToolCallStatus.Cancelled) {
    return typeof tc.reasonMessage === "string" ? tc.reasonMessage : tc.reasonMessage?.markdown;
  }
  return void 0;
}
function buildSessionCreatedToolData(tc) {
  if (tc.status !== ToolCallStatus.Completed || !tc.success) {
    return void 0;
  }
  const isSend = isSendMessageTool(tc.toolName);
  if (!isCreateSessionTool(tc.toolName) && !isCreateChatTool(tc.toolName) && !isSend) {
    return void 0;
  }
  const output = getToolOutputText(tc);
  const match = output?.match(/agent-host-session:\/\/[^\s)<>;"']+/);
  const openLink = match?.[0];
  const backend = openLink ? parseOpenSessionLinkUri(openLink) : void 0;
  if (!openLink || !backend) {
    return void 0;
  }
  const isChat = isCreateChatTool(tc.toolName) || isSend && !!parseOpenSessionLinkChatId(openLink);
  const label = createSessionTitleFromArgs(getInlineToolInput(tc.toolInput)) ?? (backend.path.replace(/^\//, "") || backend.toString());
  return { kind: "sessionCreated", openLink, label, isChat };
}
function buildAutomationConfiguredToolData(tc) {
  if (tc.status !== ToolCallStatus.Completed || !tc.success || tc.toolName !== ConfigureAutomationToolReferenceName) {
    return void 0;
  }
  const output = getToolOutputText(tc);
  if (!output) {
    return void 0;
  }
  try {
    const parsed = JSON.parse(output);
    const operation = parsed.status === "created" || parsed.status === "updated" ? parsed.status : void 0;
    if (!operation || typeof parsed.automation?.id !== "string" || typeof parsed.automation.name !== "string") {
      return void 0;
    }
    return {
      kind: "automationConfigured",
      automationId: parsed.automation.id,
      automationName: parsed.automation.name,
      operation
    };
  } catch {
    return void 0;
  }
}
function createSessionTitleFromArgs(toolInput) {
  if (!toolInput) {
    return void 0;
  }
  try {
    const args = JSON.parse(toolInput);
    const text = typeof args.prompt === "string" ? args.prompt : typeof args.message === "string" ? args.message : void 0;
    if (text === void 0) {
      return void 0;
    }
    const firstLine = text.trim().split("\n")[0].trim();
    if (!firstLine) {
      return void 0;
    }
    return firstLine.length > 60 ? `${firstLine.slice(0, 57)}\u2026` : firstLine;
  } catch {
    return void 0;
  }
}
function completedToolCallConfirmedReason(tc) {
  if (tc.status === ToolCallStatus.Completed) {
    return { type: ToolConfirmKind.ConfirmationNotNeeded };
  }
  return { type: tc.reason === ToolCallCancellationReason.Skipped ? ToolConfirmKind.Skipped : ToolConfirmKind.Denied };
}
function completedToolCallToSerialized(tc, subAgentInvocationId, sessionResource, connectionAuthority) {
  const isTerminal = isTerminalToolCall(tc);
  const isSuccess = tc.status === ToolCallStatus.Completed && tc.success;
  let invocationMsg = stringOrMarkdownToString(tc.invocationMessage, connectionAuthority) ?? tc.displayName;
  const subagentContent = tc.status === ToolCallStatus.Completed ? getToolSubagentContent(tc) : void 0;
  const isSubagent = subagentContent || isSubagentTool(tc);
  if (isSubagent && tc.status === ToolCallStatus.Completed) {
    const resultText = getToolOutputText(tc);
    const pastTenseMsg2 = isSuccess ? stringOrMarkdownToString(tc.pastTenseMessage, connectionAuthority) ?? invocationMsg : invocationMsg;
    return {
      kind: "toolInvocationSerialized",
      toolCallId: tc.toolCallId,
      toolId: tc.toolName,
      source: ToolDataSource.Internal,
      invocationMessage: invocationMsg,
      originMessage: void 0,
      pastTenseMessage: pastTenseMsg2,
      isConfirmed: completedToolCallConfirmedReason(tc),
      isComplete: true,
      presentation: void 0,
      subAgentInvocationId,
      toolSpecificData: {
        kind: "subagent",
        description: getSubagentTaskDescription(tc) ?? tc.displayName,
        agentName: subagentContent?.agentName ?? getSubagentAgentName(tc),
        result: resultText,
        chatResource: getSubagentChatResource(tc, subagentContent, sessionResource)
      }
    };
  }
  let toolSpecificData;
  if (isTerminal) {
    toolSpecificData = {
      ...buildTerminalToolSpecificData(tc, sessionResource),
      terminalCommandState: getTerminalCommandState(tc, isSuccess)
    };
  } else if (getToolKind(tc) === "search") {
    toolSpecificData = { kind: "search" };
  } else {
    toolSpecificData = buildSessionCreatedToolData(tc) ?? buildAutomationConfiguredToolData(tc);
    if (!toolSpecificData) {
      toolSpecificData = buildMcpAppToolInputData(tc, sessionResource);
    }
  }
  let pastTenseMsg = isSuccess ? stringOrMarkdownToString(tc.pastTenseMessage, connectionAuthority) ?? invocationMsg : invocationMsg;
  if (isAddCommentTool(tc.toolName)) {
    const ref = addCommentReference(tc);
    if (ref) {
      invocationMsg = ref;
      pastTenseMsg = ref;
    }
  }
  const resultDetails = (!toolSpecificData || toolSpecificData.kind === "input" && toolSpecificData.mcpAppData) && (tc.status !== ToolCallStatus.Completed || getToolFileEdits(tc).length === 0) ? getToolInputOutputDetails(tc, !isSuccess, getToolErrorString(tc), !!(toolSpecificData?.kind === "input" && toolSpecificData.mcpAppData), connectionAuthority) : void 0;
  return {
    kind: "toolInvocationSerialized",
    toolCallId: tc.toolCallId,
    toolId: tc.toolName,
    source: ToolDataSource.Internal,
    invocationMessage: invocationMsg,
    originMessage: void 0,
    pastTenseMessage: isTerminal ? void 0 : pastTenseMsg,
    isConfirmed: completedToolCallConfirmedReason(tc),
    isComplete: true,
    presentation: shouldHideCompletedAgentHostAskUserTool(tc) ? ToolInvocationPresentation.HiddenAfterComplete : void 0,
    subAgentInvocationId,
    toolSpecificData,
    resultDetails
  };
}
function completedToolCallToEditParts(tc, connectionAuthority) {
  if (tc.status !== ToolCallStatus.Completed) {
    return [];
  }
  const fileEdits = getToolFileEdits(tc);
  if (fileEdits.length === 0) {
    return [];
  }
  const parts = [];
  for (const edit of fileEdits) {
    const part = fileEditToExternalEdit(edit, tc.toolCallId, connectionAuthority);
    if (part) {
      parts.push(part);
    }
  }
  return parts;
}
function fileEditToExternalEdit(edit, undoStopId, connectionAuthority) {
  const normalized = normalizeFileEdit(edit);
  if (!normalized) {
    return void 0;
  }
  const diff = edit.diff && (edit.diff.added !== void 0 || edit.diff.removed !== void 0) ? { added: edit.diff.added ?? 0, removed: edit.diff.removed ?? 0 } : void 0;
  return {
    kind: "externalEdit",
    uri: toAgentHostUri(normalized.resource, connectionAuthority),
    editKind: normalized.kind,
    originalUri: normalized.kind === FileEditKind.Rename && normalized.beforeUri ? toAgentHostUri(normalized.beforeUri, connectionAuthority) : void 0,
    beforeContentUri: normalized.beforeContentUri ? toAgentHostUri(normalized.beforeContentUri, connectionAuthority) : void 0,
    afterContentUri: normalized.afterContentUri ? toAgentHostUri(normalized.afterContentUri, connectionAuthority) : void 0,
    diff,
    undoStopId
  };
}
const EXTERNAL_LINK_SCHEMES = /* @__PURE__ */ new Set([
  "http",
  "https",
  "mailto",
  "ws",
  "wss",
  "ftp",
  "ftps",
  "data",
  "blob",
  "javascript",
  "command",
  "vscode",
  "vscode-insiders",
  Schemas.vscodeBrowser,
  "copilot-skill",
  product.urlProtocol,
  AGENT_HOST_SCHEME
]);
function rewriteMarkdownLinks(markdown, connectionAuthority) {
  return rewriteMarkdownSource(markdown, {
    rewriteLink: (token) => rewriteLinkTokenRaw(token, connectionAuthority)
  });
}
function rewriteLinkTokenRaw(token, connectionAuthority) {
  let parsed;
  try {
    parsed = URI.parse(token.href, true);
  } catch {
    return void 0;
  }
  const scheme = parsed.scheme.toLowerCase();
  if (!scheme || EXTERNAL_LINK_SCHEMES.has(scheme)) {
    return void 0;
  }
  let agentHostUri = toAgentHostUri(parsed, connectionAuthority);
  const isSkill = isSkillFileUri(parsed);
  if (isSkill && !agentHostUri.query.includes("vscodeLinkType=")) {
    const existing = agentHostUri.query;
    agentHostUri = agentHostUri.with({ query: existing ? `${existing}&vscodeLinkType=skill` : "vscodeLinkType=skill" });
  }
  const prefix = token.type === "image" ? "![" : "[";
  const text = isSkill || token.type === "image" ? escapeMarkdownLinkLabel(token.text ?? "") : "";
  return `${prefix}${text}](${agentHostUri.toString()})`;
}
function isSkillFileUri(uri) {
  const name = basename(uri);
  return name.toLowerCase() === "skill.md";
}
function rawMarkdownToString(content, connectionAuthority) {
  const rewritten = connectionAuthority ? rewriteMarkdownLinks(content, connectionAuthority) : content;
  return new MarkdownString(rewritten);
}
function parseAbsoluteFileLinkTarget(href) {
  const fragmentIndex = href.indexOf("#");
  const rawPath = fragmentIndex >= 0 ? href.substring(0, fragmentIndex) : href;
  if (rawPath.includes("?")) {
    return void 0;
  }
  const existingFragment = fragmentIndex >= 0 ? href.substring(fragmentIndex + 1) : "";
  const parsedPath = existingFragment ? { path: rawPath } : parseFileLocation(rawPath);
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(parsedPath.path);
  } catch {
    return void 0;
  }
  const absolutePath = decodedPath;
  const isWindowsPath = win32.isAbsolute(absolutePath);
  if (!posix.isAbsolute(absolutePath) && !isWindowsPath) {
    return void 0;
  }
  const selectionFragment = formatLocationFragment(parsedPath);
  const normalizedPath = isWindowsPath ? absolutePath.replaceAll("\\", "/") : absolutePath;
  return URI.file(normalizedPath).with({ fragment: existingFragment || selectionFragment });
}
function parseFileLocation(path) {
  const match = /^(?<path>.+?):(?<line>[1-9]\d*)(?::(?<column>[1-9]\d*))?$/.exec(path);
  if (!match?.groups) {
    return { path };
  }
  const line = Number(match.groups.line);
  const column = match.groups.column ? Number(match.groups.column) : void 0;
  if (!Number.isSafeInteger(line) || column !== void 0 && !Number.isSafeInteger(column)) {
    return { path };
  }
  return { path: match.groups.path, line, column };
}
function formatLocationFragment(location) {
  if (location.line === void 0) {
    return "";
  }
  return `L${location.line}${location.column !== void 0 && location.column !== 1 ? `,${location.column}` : ""}`;
}
function normalizeFileUriSelection(uri, href) {
  if (uri.scheme.toLowerCase() !== Schemas.file || uri.query || uri.fragment) {
    return uri;
  }
  const parsedPath = parseFileLocation(href);
  if (parsedPath.line === void 0) {
    return uri;
  }
  const fragment = formatLocationFragment(parsedPath);
  const suffixLength = href.length - parsedPath.path.length;
  return uri.with({ path: uri.path.substring(0, uri.path.length - suffixLength), fragment });
}
function rewriteAgentHostLinkTarget(href, connectionAuthority) {
  let parsed = parseAbsoluteFileLinkTarget(href);
  if (!parsed) {
    try {
      parsed = URI.parse(href, true);
    } catch {
      return href;
    }
    const scheme = parsed.scheme.toLowerCase();
    if (!scheme || EXTERNAL_LINK_SCHEMES.has(scheme)) {
      return href;
    }
    parsed = normalizeFileUriSelection(parsed.with({ scheme }), href);
    if (!parsed.path.startsWith("/")) {
      return href;
    }
  }
  let agentHostUri;
  try {
    agentHostUri = toAgentHostUri(parsed, connectionAuthority);
  } catch {
    return href;
  }
  if (isSkillFileUri(parsed) && !agentHostUri.query.includes("vscodeLinkType=")) {
    const existing = agentHostUri.query;
    agentHostUri = agentHostUri.with({ query: existing ? `${existing}&vscodeLinkType=skill` : "vscodeLinkType=skill" });
  }
  return agentHostUri.toString();
}
function stringOrMarkdownToString(value, connectionAuthority) {
  if (value === void 0) {
    return void 0;
  }
  if (typeof value === "string") {
    return value;
  }
  return rawMarkdownToString(value.markdown, connectionAuthority);
}
const ADD_COMMENT_PREVIEW_LENGTH = 40;
function addCommentPreview(text) {
  const singleLine = text.replace(/\s+/g, " ").trim();
  return singleLine.length > ADD_COMMENT_PREVIEW_LENGTH ? `${singleLine.slice(0, ADD_COMMENT_PREVIEW_LENGTH)}\u2026` : singleLine;
}
function isPositiveInteger(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}
function isOneBasedRange(value) {
  const range = value;
  return !!range && typeof range === "object" && isPositiveInteger(range.startLineNumber) && isPositiveInteger(range.startColumn) && isPositiveInteger(range.endLineNumber) && isPositiveInteger(range.endColumn);
}
function addCommentReference(tc) {
  if (tc.status === ToolCallStatus.Streaming || !tc.toolInput) {
    return void 0;
  }
  const toolInput = getInlineToolInput(tc.toolInput);
  if (!toolInput) {
    return void 0;
  }
  let args;
  try {
    args = JSON.parse(toolInput);
  } catch {
    return void 0;
  }
  if (typeof args.resourceUri !== "string" || typeof args.text !== "string" || !isOneBasedRange(args.range)) {
    return void 0;
  }
  const preview = escapeIcons(escapeMarkdownLinkLabel(addCommentPreview(args.text)));
  const commandArgs = encodeURIComponent(JSON.stringify([args.resourceUri, args.range]));
  const link = `command:${AgentFeedbackReviewCommandId.RevealAt}?${commandArgs}`;
  return new MarkdownString(`[addComment "${preview}"](${link})`, {
    isTrusted: { enabledCommands: [AgentFeedbackReviewCommandId.RevealAt] },
    supportThemeIcons: true
  });
}
function toolCallStateToInvocation(tc, subAgentInvocationId, sessionResource, connectionAuthority, mcpServerAuthority = sessionResource.authority, options) {
  const toolData = {
    id: tc.toolName,
    source: ToolDataSource.Internal,
    displayName: tc.displayName,
    modelDescription: tc.toolName
  };
  if (tc.contributor?.kind === ToolCallContributorKind.Client && options && tc.contributor.clientId !== options.currentClientId) {
    const invocation2 = new ChatToolInvocation(void 0, toolData, tc.toolCallId, subAgentInvocationId, void 0);
    invocation2.invocationMessage = localize("agentHost.otherClientTool.running", "Running {0} on another client...", tc.displayName);
    invocation2.otherClientToolCall = {
      cancel: () => options.cancelOtherClientToolCall(tc)
    };
    return invocation2;
  }
  if (tc.status === ToolCallStatus.PendingConfirmation) {
    const confirmationMessages = toolCallConfirmationMessages(tc, connectionAuthority);
    let toolSpecificData;
    const pendingEdits = tc.edits?.items;
    if (isViewUnreviewedCommentsTool(tc.toolName)) {
      toolSpecificData = {
        kind: "agentFeedbackReviewConfirmation",
        options: [localize("agentFeedback.reveal", "Reveal Selected")]
      };
    } else if (pendingEdits?.length) {
      const wrap = (uri) => connectionAuthority ? toAgentHostUri(uri, connectionAuthority) : uri;
      const mapped = mapFileEdits(pendingEdits, tc.toolCallId);
      toolSpecificData = {
        kind: "modifiedFilesConfirmation",
        options: ["Allow"],
        modifiedFiles: mapped.map((edit) => {
          const resource = wrap(edit.resource);
          const originalResource = edit.originalResource ? wrap(edit.originalResource) : void 0;
          const modifiedContent = edit.afterContentUri ? wrap(edit.afterContentUri) : void 0;
          const originalContent = edit.beforeContentUri ? wrap(edit.beforeContentUri) : void 0;
          return {
            uri: resource,
            editKind: edit.kind,
            originalUri: originalResource,
            modifiedContentUri: modifiedContent,
            originalContentUri: originalContent,
            insertions: edit.diff?.added,
            deletions: edit.diff?.removed,
            title: basename(edit.resource),
            description: edit.resource.path
          };
        })
      };
    } else if (getToolKind(tc) === "terminal" && getInlineToolInput(tc.toolInput)) {
      toolSpecificData = buildTerminalToolSpecificData(tc, sessionResource);
    } else {
      const toolInput = getInlineToolInput(tc.toolInput);
      if (toolInput) {
        let rawInput;
        try {
          rawInput = JSON.parse(toolInput);
        } catch {
          rawInput = { input: toolInput };
        }
        toolSpecificData = { kind: "input", rawInput };
      }
    }
    return new ChatToolInvocation(
      {
        invocationMessage: stringOrMarkdownToString(tc.invocationMessage, connectionAuthority),
        confirmationMessages,
        presentation: ToolInvocationPresentation.HiddenAfterComplete,
        toolSpecificData
      },
      toolData,
      tc.toolCallId,
      subAgentInvocationId,
      void 0
    );
  }
  const invocation = new ChatToolInvocation(void 0, toolData, tc.toolCallId, subAgentInvocationId, void 0);
  invocation.invocationMessage = stringOrMarkdownToString(tc.invocationMessage, connectionAuthority) ?? tc.displayName;
  if (isAgentHostAskUserTool(tc.toolName)) {
    invocation.invocationMessage = localize("agentHost.askUser.waiting", "Waiting for answer...");
    invocation.presentation = ToolInvocationPresentation.HiddenAfterComplete;
  }
  if (tc.status === ToolCallStatus.AuthRequired) {
    invocation.setAuthenticationRequired(toolCallAuthenticationServer(tc, mcpServerAuthority));
  }
  if (isAddCommentTool(tc.toolName)) {
    invocation.invocationMessage = addCommentReference(tc) ?? invocation.invocationMessage;
  }
  if (isTerminalToolCall(tc)) {
    invocation.toolSpecificData = buildTerminalToolSpecificData(tc, sessionResource);
  } else if (isSubagentTool(tc)) {
    const subagentContent = tc.status === ToolCallStatus.Running || tc.status === ToolCallStatus.Completed ? getToolSubagentContent(tc) : void 0;
    invocation.toolSpecificData = {
      kind: "subagent",
      description: getSubagentTaskDescription(tc),
      agentName: subagentContent?.agentName ?? getSubagentAgentName(tc),
      chatResource: getSubagentChatResource(tc, subagentContent, sessionResource)
    };
  } else if (getToolKind(tc) === "search") {
    invocation.toolSpecificData = { kind: "search" };
  } else if (tc.status !== ToolCallStatus.Streaming) {
    invocation.toolSpecificData = buildMcpAppToolInputData(tc, sessionResource);
  }
  return invocation;
}
function toolCallConfirmationMessages(tc, connectionAuthority) {
  const riskAssessment = tc.riskAssessment;
  let approvalReason;
  if (riskAssessment?.status === ToolCallRiskAssessmentStatus.Loading) {
    approvalReason = { status: "loading" };
  } else if (riskAssessment?.status === ToolCallRiskAssessmentStatus.Complete) {
    approvalReason = {
      status: "complete",
      explanation: stringOrMarkdownToString(riskAssessment.reason, connectionAuthority),
      safety: riskAssessment.safety
    };
  }
  return {
    title: isViewUnreviewedCommentsTool(tc.toolName) ? localize("agentFeedback.reviewTitle", "Reveal unreviewed comments?") : stringOrMarkdownToString(tc.confirmationTitle, connectionAuthority) ?? tc.displayName,
    message: isViewUnreviewedCommentsTool(tc.toolName) ? localize("agentFeedback.reviewMessage", "Choose which comments to reveal to the agent. Unchecked comments stay hidden.") : stringOrMarkdownToString(tc.invocationMessage, connectionAuthority),
    approvalReason,
    ...tc.options ? { customOptions: tc.options } : {}
  };
}
function toolCallAuthenticationServer(tc, sessionAuthority) {
  const metadata = readToolCallMeta(tc);
  return {
    id: `${sessionAuthority}/${tc.contributor.customizationId}`,
    name: tc.auth.resource.resource_name ?? metadata.mcpServerName ?? tc.displayName,
    resource: tc.auth.resource.resource,
    oauthClient: tc.auth.oauthClient,
    authorizationServers: tc.auth.resource.authorization_servers,
    supportedScopes: tc.auth.resource.scopes_supported,
    requiredScopes: tc.auth.requiredScopes,
    reason: tc.auth.reason
  };
}
function toolCallStateToStreamingInvocation(tc, subAgentInvocationId, sessionResource, connectionAuthority, mcpServerAuthority) {
  const invocation = ChatToolInvocation.createStreaming({
    toolCallId: tc.toolCallId,
    toolId: tc.toolName,
    toolData: {
      id: tc.toolName,
      source: ToolDataSource.Internal,
      displayName: tc.displayName,
      modelDescription: tc.toolName
    },
    subagentInvocationId: subAgentInvocationId
  });
  updateStreamingToolInvocation(invocation, tc, connectionAuthority ?? "");
  if (isAgentHostAskUserTool(tc.toolName)) {
    invocation.invocationMessage = localize("agentHost.askUser.asking", "Asking a question...");
    invocation.presentation = ToolInvocationPresentation.HiddenAfterComplete;
  }
  if (sessionResource && isSubagentTool(tc)) {
    invocation.toolSpecificData = toolCallStateToInvocation(tc, subAgentInvocationId, sessionResource, connectionAuthority ?? "", mcpServerAuthority).toolSpecificData;
  }
  return invocation;
}
function getStreamingToolInputForDisplay(tc) {
  if (tc.status !== ToolCallStatus.Streaming || !tc.partialInput) {
    return void 0;
  }
  return parsePartialToolInputForDisplay(tc.partialInput) ?? tc.partialInput;
}
function updateStreamingToolInvocation(existing, tc, connectionAuthority) {
  if (tc.status !== ToolCallStatus.Streaming) {
    return void 0;
  }
  if (getToolKind(tc) === "read") {
    existing.updatePartialInput(void 0);
    existing.updateStreamingMessage(localize("agentHost.streaming.readingFile", "Reading file"));
    return void 0;
  }
  const partialInput = getStreamingToolInputForDisplay(tc);
  if (partialInput !== void 0) {
    existing.updatePartialInput(partialInput);
  }
  const invocationMessage = stringOrMarkdownToString(tc.invocationMessage, connectionAuthority);
  if (invocationMessage) {
    existing.updateStreamingMessage(invocationMessage);
  }
  return partialInput;
}
function toolCallStateToPreparedInvocation(tc, sessionResource, connectionAuthority, mcpServerAuthority = sessionResource.authority, options) {
  const built = toolCallStateToInvocation(tc, void 0, sessionResource, connectionAuthority, mcpServerAuthority, options);
  return {
    invocationMessage: built.invocationMessage,
    pastTenseMessage: built.pastTenseMessage,
    confirmationMessages: built.confirmationMessages,
    presentation: built.presentation,
    toolSpecificData: built.toolSpecificData
  };
}
function updateRunningToolSpecificData(existing, tc, sessionResource, connectionAuthority) {
  if (tc.status !== ToolCallStatus.Running) {
    return;
  }
  existing.invocationMessage = stringOrMarkdownToString(tc.invocationMessage, connectionAuthority) ?? existing.invocationMessage;
  if (isAgentHostAskUserTool(tc.toolName)) {
    existing.invocationMessage = localize("agentHost.askUser.waiting", "Waiting for answer...");
    existing.presentation = ToolInvocationPresentation.HiddenAfterComplete;
  }
  if (isAddCommentTool(tc.toolName)) {
    existing.invocationMessage = addCommentReference(tc) ?? existing.invocationMessage;
  }
  const subagentContent = getToolSubagentContent(tc);
  if (subagentContent) {
    existing.toolSpecificData = {
      kind: "subagent",
      isActive: existing.toolSpecificData?.kind === "subagent" ? existing.toolSpecificData.isActive : void 0,
      description: getSubagentTaskDescription(tc),
      agentName: subagentContent.agentName,
      credits: existing.toolSpecificData?.kind === "subagent" ? existing.toolSpecificData.credits : void 0,
      modelName: existing.toolSpecificData?.kind === "subagent" ? existing.toolSpecificData.modelName : void 0,
      startedAt: existing.toolSpecificData?.kind === "subagent" ? existing.toolSpecificData.startedAt : void 0,
      duration: existing.toolSpecificData?.kind === "subagent" ? existing.toolSpecificData.duration : void 0,
      chatResource: subagentContent.resource
    };
    existing.notifyToolSpecificDataChanged();
    return;
  }
  if (existing.toolSpecificData?.kind === "subagent") {
    const description = getSubagentTaskDescription(tc) ?? existing.toolSpecificData.description;
    const agentName = getSubagentAgentName(tc) ?? existing.toolSpecificData.agentName;
    if (description !== existing.toolSpecificData.description || agentName !== existing.toolSpecificData.agentName) {
      existing.toolSpecificData = { ...existing.toolSpecificData, description, agentName };
      existing.notifyToolSpecificDataChanged();
    }
    return;
  }
  const existingInput = existing.toolSpecificData?.kind === "input" ? existing.toolSpecificData : void 0;
  const nextInput = buildMcpAppToolInputData(tc, sessionResource, existingInput?.rawInput);
  if (nextInput) {
    if (!existingInput || !isSameMcpAppData(existingInput.mcpAppData, nextInput.mcpAppData)) {
      existing.toolSpecificData = nextInput;
      existing.notifyToolSpecificDataChanged();
    }
    return;
  }
  const existingTerminal = existing.toolSpecificData?.kind === "terminal" ? existing.toolSpecificData : void 0;
  if (isTerminalToolCall(tc, existing.toolSpecificData?.kind)) {
    const next = buildTerminalToolSpecificData(tc, sessionResource, existingTerminal);
    const outputChanged = next.terminalCommandOutput?.text !== existingTerminal?.terminalCommandOutput?.text;
    const commandChanged = next.commandLine.original !== existingTerminal?.commandLine.original;
    if (!existingTerminal || outputChanged || commandChanged) {
      existing.toolSpecificData = next;
      existing.notifyToolSpecificDataChanged();
    }
  }
}
function finalizeToolInvocation(invocation, tc, backendSession, connectionAuthority) {
  const isCompleted = tc.status === ToolCallStatus.Completed;
  const isCancelled = tc.status === ToolCallStatus.Cancelled;
  const isTerminal = isTerminalToolCall(tc, invocation.toolSpecificData?.kind);
  if ((isCompleted || isCancelled) && hasKey(tc, { invocationMessage: true })) {
    invocation.invocationMessage = stringOrMarkdownToString(tc.invocationMessage, connectionAuthority) ?? invocation.invocationMessage;
  }
  if (isAddCommentTool(tc.toolName)) {
    invocation.invocationMessage = addCommentReference(tc) ?? invocation.invocationMessage;
  }
  if (isAgentHostAskUserTool(tc.toolName)) {
    invocation.presentation = ToolInvocationPresentation.HiddenAfterComplete;
  }
  if (isCompleted) {
    const subagentContent = getToolSubagentContent(tc);
    if (subagentContent) {
      const resultText = getToolOutputText(tc);
      invocation.toolSpecificData = {
        kind: "subagent",
        isActive: invocation.toolSpecificData?.kind === "subagent" ? invocation.toolSpecificData.isActive : void 0,
        description: getSubagentTaskDescription(tc),
        agentName: subagentContent.agentName,
        result: resultText,
        credits: invocation.toolSpecificData?.kind === "subagent" ? invocation.toolSpecificData.credits : void 0,
        modelName: invocation.toolSpecificData?.kind === "subagent" ? invocation.toolSpecificData.modelName : void 0,
        startedAt: invocation.toolSpecificData?.kind === "subagent" ? invocation.toolSpecificData.startedAt : void 0,
        duration: invocation.toolSpecificData?.kind === "subagent" ? invocation.toolSpecificData.duration : void 0,
        chatResource: getSubagentChatResource(tc, subagentContent, backendSession)
      };
    } else if (invocation.toolSpecificData?.kind === "subagent") {
      invocation.toolSpecificData = {
        kind: "subagent",
        isActive: invocation.toolSpecificData.isActive,
        description: getSubagentTaskDescription(tc) ?? invocation.toolSpecificData.description,
        agentName: getSubagentAgentName(tc) ?? invocation.toolSpecificData.agentName,
        result: getToolOutputText(tc),
        credits: invocation.toolSpecificData.credits,
        modelName: invocation.toolSpecificData.modelName,
        startedAt: invocation.toolSpecificData.startedAt,
        duration: invocation.toolSpecificData.duration,
        chatResource: invocation.toolSpecificData.chatResource ?? getSubagentChatResource(tc, void 0, backendSession)
      };
    }
  }
  if (isTerminal && (isCompleted || isCancelled)) {
    const existing = invocation.toolSpecificData?.kind === "terminal" ? invocation.toolSpecificData : void 0;
    invocation.presentation = void 0;
    invocation.toolSpecificData = {
      ...buildTerminalToolSpecificData(tc, backendSession, existing),
      terminalCommandState: getTerminalCommandState(tc, isCompleted && tc.success)
    };
  } else if (isCompleted && tc.pastTenseMessage) {
    invocation.pastTenseMessage = stringOrMarkdownToString(tc.pastTenseMessage, connectionAuthority);
  }
  if (isCompleted && isAddCommentTool(tc.toolName)) {
    invocation.pastTenseMessage = addCommentReference(tc) ?? invocation.pastTenseMessage;
  }
  if (isCompleted) {
    const resultToolSpecificData = buildSessionCreatedToolData(tc) ?? buildAutomationConfiguredToolData(tc);
    if (resultToolSpecificData) {
      invocation.presentation = void 0;
      invocation.toolSpecificData = resultToolSpecificData;
      invocation.notifyToolSpecificDataChanged();
    }
  }
  if (isCompleted) {
    const mcpAppInput = buildMcpAppToolInputData(
      tc,
      backendSession,
      invocation.toolSpecificData?.kind === "input" ? invocation.toolSpecificData.rawInput : void 0
    );
    if (mcpAppInput) {
      const existingInput = invocation.toolSpecificData?.kind === "input" ? invocation.toolSpecificData : void 0;
      invocation.toolSpecificData = mcpAppInput;
      if (!existingInput || !isSameMcpAppData(existingInput.mcpAppData, mcpAppInput.mcpAppData)) {
        invocation.notifyToolSpecificDataChanged();
      }
    }
  }
  const isFailure = isCompleted && !tc.success || isCancelled;
  const errorMessage = isCompleted ? tc.error?.message : isCancelled ? tc.reasonMessage : void 0;
  const errorString = typeof errorMessage === "string" ? errorMessage : errorMessage?.markdown;
  const fileEdits = isCompleted ? fileEditsToExternalEdits(tc) : [];
  if (isAgentHostAskUserTool(tc.toolName)) {
    invocation.presentation = shouldHideCompletedAgentHostAskUserTool(tc) ? ToolInvocationPresentation.HiddenAfterComplete : void 0;
  }
  if (fileEdits.length > 0 && !isFailure) {
    invocation.presentation = ToolInvocationPresentation.Hidden;
  }
  const hasMcpAppData = invocation.toolSpecificData?.kind === "input" && !!invocation.toolSpecificData.mcpAppData;
  const resultDetails = !isTerminal && invocation.toolSpecificData?.kind !== "subagent" && invocation.toolSpecificData?.kind !== "sessionCreated" && getToolKind(tc) !== "search" && fileEdits.length === 0 ? getToolInputOutputDetails(tc, isFailure, errorString, hasMcpAppData, connectionAuthority) : void 0;
  const result = isFailure || resultDetails ? { content: [], toolResultError: isFailure ? errorString : void 0, toolResultDetails: resultDetails } : void 0;
  const cancelledFromStreaming = isCancelled && invocation.cancelFromStreaming(
    tc.reason === ToolCallCancellationReason.Skipped ? ToolConfirmKind.Skipped : ToolConfirmKind.Denied,
    tc.reasonMessage ? stringOrMarkdownToString(tc.reasonMessage, connectionAuthority) : void 0
  );
  if (!cancelledFromStreaming) {
    invocation.didExecuteTool(result);
  }
  return fileEdits;
}
function fileEditsToExternalEdits(tc) {
  if (tc.status !== ToolCallStatus.Completed) {
    return [];
  }
  const edits = getToolFileEdits(tc);
  if (edits.length === 0) {
    return [];
  }
  return mapFileEdits(edits, tc.toolCallId);
}
function mapFileEdits(items, undoStopId) {
  const result = [];
  for (const edit of items) {
    const normalized = normalizeFileEdit(edit);
    if (!normalized) {
      continue;
    }
    result.push({
      kind: normalized.kind,
      resource: normalized.resource,
      originalResource: normalized.kind === FileEditKind.Rename ? normalized.beforeUri : void 0,
      beforeContentUri: normalized.beforeContentUri,
      afterContentUri: normalized.afterContentUri,
      undoStopId,
      diff: edit.diff
    });
  }
  return result;
}
export {
  BOOLEAN_FALSE_OPTION_ID,
  BOOLEAN_TRUE_OPTION_ID,
  activeTurnToProgress,
  completedToolCallToEditParts,
  completedToolCallToSerialized,
  containsAutomaticReplyAnswer,
  convertProtocolAnswers,
  convertProtocolPlanReviewResult,
  createInputRequestCarousel,
  createInputRequestPlanReview,
  fileEditsToExternalEdits,
  finalizeToolInvocation,
  formatTurnResponseDetails,
  getTerminalContent,
  getUrlInputRequestPresentation,
  inputRequestResponsePartToProgress,
  isSubagentTool,
  isSubagentToolName,
  makeAhpTerminalToolSessionId,
  messageAttachmentsToVariableData,
  messageToVariableData,
  parseAhpTerminalToolSessionId,
  rawMarkdownToString,
  rewriteAgentHostLinkTarget,
  rewriteMarkdownLinks,
  stringOrMarkdownToString,
  systemNotificationToChatPart,
  toolCallAuthenticationServer,
  toolCallConfirmationMessages,
  toolCallStateToInvocation,
  toolCallStateToPreparedInvocation,
  toolCallStateToStreamingInvocation,
  turnsToHistory,
  updateRunningToolSpecificData,
  updateStreamingToolInvocation,
  usageInfoToAutoModeResolution,
  usageInfoToChatUsage,
  usageInfoToQuotas
};
