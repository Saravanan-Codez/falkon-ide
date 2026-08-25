import { distinct } from "../../../../base/common/arrays.js";
import { decodeBase64, encodeBase64, VSBuffer } from "../../../../base/common/buffer.js";
import { hasKey } from "../../../../base/common/types.js";
import { URI as ResourceURI } from "../../../../base/common/uri.js";
import { readToolCallMeta } from "../meta/agentToolCallMeta.js";
import {
  ResponsePartKind,
  SessionStatus,
  ToolCallStatus,
  SessionLifecycle,
  ToolResultContentType,
  ChatOriginKind,
  ChatInteractivity
} from "./protocol/state.js";
import {
  ChangesetOperationScope,
  ChangesetOperationStatus,
  ChangesetStatus,
  CustomizationLoadStatus,
  CustomizationType,
  MessageAttachmentKind,
  MessageKind,
  PendingMessageKind,
  PolicyState,
  ResponsePartKind as ResponsePartKind2,
  ChatInputAnswerState,
  ChatInputAnswerValueKind,
  ChatInputQuestionKind,
  ChatInputRequestPurpose,
  ChatInputResponseKind,
  ChatInteractivity as ChatInteractivity2,
  ChatOriginKind as ChatOriginKind2,
  SessionLifecycle as SessionLifecycle2,
  SessionStatus as SessionStatus2,
  ToolCallCancellationReason,
  ToolCallConfirmationReason,
  ToolCallContributorKind,
  ToolCallRiskAssessmentKind,
  ToolCallRiskAssessmentStatus,
  ToolCallStatus as ToolCallStatus2,
  ToolResultContentType as ToolResultContentType2,
  TurnState
} from "./protocol/state.js";
function readAccountQuotaSnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return void 0;
  }
  const raw = value;
  const snapshot = {};
  if (typeof raw["isUnlimitedEntitlement"] === "boolean") {
    snapshot.isUnlimitedEntitlement = raw["isUnlimitedEntitlement"];
  }
  if (typeof raw["entitlementRequests"] === "number") {
    snapshot.entitlementRequests = raw["entitlementRequests"];
  }
  if (typeof raw["usedRequests"] === "number") {
    snapshot.usedRequests = raw["usedRequests"];
  }
  if (typeof raw["remainingPercentage"] === "number") {
    snapshot.remainingPercentage = raw["remainingPercentage"];
  }
  if (typeof raw["overage"] === "number") {
    snapshot.overage = raw["overage"];
  }
  if (typeof raw["overageAllowedWithExhaustedQuota"] === "boolean") {
    snapshot.overageAllowedWithExhaustedQuota = raw["overageAllowedWithExhaustedQuota"];
  }
  if (typeof raw["resetDate"] === "string") {
    snapshot.resetDate = raw["resetDate"];
  }
  return snapshot;
}
function readUsageInfoMeta(usage) {
  const meta = usage?._meta;
  if (!meta) {
    return {};
  }
  const result = {};
  if (typeof meta["cost"] === "number") {
    result.cost = meta["cost"];
  }
  const autoModeResolved = readAutoModeResolvedInfo(meta["autoModeResolved"]);
  if (autoModeResolved) {
    result.autoModeResolved = autoModeResolved;
  }
  const copilotUsage = meta["copilotUsage"];
  if (copilotUsage && typeof copilotUsage === "object" && !Array.isArray(copilotUsage)) {
    const rawUsage = copilotUsage;
    const usage2 = {};
    if (typeof rawUsage["totalNanoAiu"] === "number") {
      usage2.totalNanoAiu = rawUsage["totalNanoAiu"];
    }
    if (typeof rawUsage["sessionTotalNanoAiu"] === "number") {
      usage2.sessionTotalNanoAiu = rawUsage["sessionTotalNanoAiu"];
    }
    result.copilotUsage = usage2;
  }
  const quotaSnapshots = meta["quotaSnapshots"];
  if (quotaSnapshots && typeof quotaSnapshots === "object" && !Array.isArray(quotaSnapshots)) {
    const snapshots = {};
    for (const [quotaType, value] of Object.entries(quotaSnapshots)) {
      snapshots[quotaType] = readAccountQuotaSnapshot(value);
    }
    result.quotaSnapshots = snapshots;
  }
  const contextAttribution = readContextAttribution(meta["contextAttribution"]);
  if (contextAttribution) {
    result.contextAttribution = contextAttribution;
  }
  const turnTokenTotals = readTurnTokenTotals(meta["turnTokenTotals"]);
  if (turnTokenTotals) {
    result.turnTokenTotals = turnTokenTotals;
  }
  return result;
}
function readTurnTokenTotals(value) {
  if (!Array.isArray(value)) {
    return void 0;
  }
  const totals = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const raw = item;
    if (typeof raw["model"] !== "string" || !raw["model"] || !isTokenCount(raw["inputTokens"]) || !isTokenCount(raw["cachedTokens"]) || !isTokenCount(raw["outputTokens"])) {
      continue;
    }
    totals.push({
      model: raw["model"],
      inputTokens: raw["inputTokens"],
      cachedTokens: raw["cachedTokens"],
      outputTokens: raw["outputTokens"]
    });
  }
  return totals.length > 0 ? totals : void 0;
}
function isTokenCount(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function hasReportedUsage(usage) {
  if (!usage) {
    return false;
  }
  if (typeof usage.inputTokens === "number" || typeof usage.outputTokens === "number") {
    return true;
  }
  const meta = readUsageInfoMeta(usage);
  return typeof meta.copilotUsage?.totalNanoAiu === "number" && meta.copilotUsage.totalNanoAiu >= 0 || typeof meta.copilotUsage?.sessionTotalNanoAiu === "number" && meta.copilotUsage.sessionTotalNanoAiu >= 0 || typeof meta.cost === "number" && meta.cost >= 0;
}
function readAutoModeResolvedInfo(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return void 0;
  }
  const raw = value;
  if (typeof raw["chosenModel"] !== "string") {
    return void 0;
  }
  const result = { chosenModel: raw["chosenModel"] };
  const reasoningBucket = raw["reasoningBucket"];
  if (reasoningBucket === "low" || reasoningBucket === "medium" || reasoningBucket === "high") {
    result.reasoningBucket = reasoningBucket;
  }
  const categoryScores = raw["categoryScores"];
  if (categoryScores && typeof categoryScores === "object" && !Array.isArray(categoryScores)) {
    const scores = {};
    for (const [category, score] of Object.entries(categoryScores)) {
      if (typeof score === "number") {
        scores[category] = score;
      }
    }
    result.categoryScores = scores;
  }
  if (typeof raw["predictedLabel"] === "string") {
    result.predictedLabel = raw["predictedLabel"];
  }
  if (typeof raw["confidence"] === "number") {
    result.confidence = raw["confidence"];
  }
  if (Array.isArray(raw["candidateModels"]) && raw["candidateModels"].every((candidate) => typeof candidate === "string")) {
    result.candidateModels = raw["candidateModels"];
  }
  return result;
}
function readContextAttribution(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return void 0;
  }
  const raw = value;
  if (typeof raw["totalTokens"] !== "number" || !Array.isArray(raw["entries"])) {
    return void 0;
  }
  const entries = [];
  for (const item of raw["entries"]) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const entry = item;
    if (typeof entry["kind"] !== "string" || typeof entry["id"] !== "string" || typeof entry["label"] !== "string" || typeof entry["tokens"] !== "number") {
      continue;
    }
    entries.push({
      kind: entry["kind"],
      id: entry["id"],
      label: entry["label"],
      tokens: entry["tokens"],
      parentId: typeof entry["parentId"] === "string" ? entry["parentId"] : void 0,
      attributes: entry["attributes"] && typeof entry["attributes"] === "object" && !Array.isArray(entry["attributes"]) ? filterStringAttributes(entry["attributes"]) : void 0
    });
  }
  const compactionsRaw = raw["compactions"];
  const compactions = compactionsRaw && typeof compactionsRaw === "object" && !Array.isArray(compactionsRaw) && typeof compactionsRaw["count"] === "number" ? { count: compactionsRaw["count"] } : { count: 0 };
  return { totalTokens: raw["totalTokens"], entries, compactions };
}
function filterStringAttributes(raw) {
  const result = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" || value === void 0) {
      result[key] = value;
    }
  }
  return result;
}
import {
  ChangesetOperationTargetKind
} from "./protocol/commands.js";
import {
  ChatInputAnswerState as ChatInputAnswerState2,
  ChatInputAnswerValueKind as ChatInputAnswerValueKind2,
  ChatInputQuestionKind as ChatInputQuestionKind2,
  ChatInputResponseKind as ChatInputResponseKind2
} from "./protocol/state.js";
var FileEditKind = /* @__PURE__ */ ((FileEditKind2) => {
  FileEditKind2["Edit"] = "edit";
  FileEditKind2["Create"] = "create";
  FileEditKind2["Delete"] = "delete";
  FileEditKind2["Rename"] = "rename";
  return FileEditKind2;
})(FileEditKind || {});
const ROOT_STATE_URI = "ahp-root://";
const AHP_ROOT_SCHEME = "ahp-root";
const AHP_RESOURCE_WATCH_SCHEME = "ahp-resource-watch";
function buildResourceWatchChannelUri(descriptor) {
  const payload = { root: descriptor.root };
  if (descriptor.recursive) {
    payload.recursive = true;
  }
  if (descriptor.excludes && descriptor.excludes.items.length > 0) {
    payload.excludes = [...descriptor.excludes.items];
  }
  if (descriptor.includes && descriptor.includes.items.length > 0) {
    payload.includes = [...descriptor.includes.items];
  }
  const json = encodeBase64(VSBuffer.fromString(JSON.stringify(payload)), false, true);
  return `${AHP_RESOURCE_WATCH_SCHEME}://r/${json}`;
}
function parseResourceWatchChannelUri(uri) {
  let parsed;
  try {
    parsed = ResourceURI.parse(uri);
  } catch {
    return void 0;
  }
  if (parsed.scheme !== AHP_RESOURCE_WATCH_SCHEME) {
    return void 0;
  }
  const encoded = parsed.path.replace(/^\//, "");
  if (!encoded) {
    return void 0;
  }
  try {
    const payload = JSON.parse(decodeBase64(encoded).toString());
    if (typeof payload.root !== "string") {
      return void 0;
    }
    return {
      root: payload.root,
      recursive: payload.recursive === true,
      ...Array.isArray(payload.excludes) ? { excludes: { items: payload.excludes.filter((x) => typeof x === "string") } } : {},
      ...Array.isArray(payload.includes) ? { includes: { items: payload.includes.filter((x) => typeof x === "string") } } : {}
    };
  } catch {
    return void 0;
  }
}
function isAhpResourceWatchChannel(uri) {
  try {
    return ResourceURI.parse(uri).scheme === AHP_RESOURCE_WATCH_SCHEME;
  } catch {
    return false;
  }
}
function isAhpRootChannel(uri) {
  if (uri === ROOT_STATE_URI) {
    return true;
  }
  try {
    return ResourceURI.parse(uri).scheme === AHP_ROOT_SCHEME;
  } catch {
    return false;
  }
}
function customizationId(uri, range) {
  if (!range) {
    return uri;
  }
  const safeUri = uri.replace(/#/g, "%23");
  return `${safeUri}#range=${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
}
function getToolOutputText(result) {
  if (!result.content || result.content.length === 0) {
    return void 0;
  }
  const textParts = [];
  for (const c of result.content) {
    if (hasKey(c, { type: true }) && c.type === ToolResultContentType.Text) {
      textParts.push(c);
    }
  }
  if (textParts.length === 0) {
    return void 0;
  }
  return textParts.map((p) => p.text).join("\n");
}
function getInlineToolInput(toolInput) {
  return typeof toolInput === "string" ? toolInput : void 0;
}
function getToolFileEdits(result) {
  if (!result.content || result.content.length === 0) {
    return [];
  }
  const edits = [];
  for (const c of result.content) {
    if (hasKey(c, { type: true }) && c.type === ToolResultContentType.FileEdit) {
      edits.push(c);
    }
  }
  return edits;
}
function getToolSubagentContent(result) {
  if (!result.content || result.content.length === 0) {
    return void 0;
  }
  for (const c of result.content) {
    if (hasKey(c, { type: true }) && c.type === ToolResultContentType.Subagent) {
      return c;
    }
  }
  return void 0;
}
const SUBAGENT_URI_SEGMENT = "subagent";
const SUBAGENT_URI_MARKER = `/${SUBAGENT_URI_SEGMENT}/`;
const SUBAGENT_URI_PATH_REGEX = /^(?<parentPath>.+)\/subagent\/(?<toolCallId>.+)$/;
function asResourceUri(uri) {
  return typeof uri === "string" ? ResourceURI.parse(uri) : uri;
}
function getSubagentBasePath(parentSession) {
  const parent = asResourceUri(parentSession);
  const parentPath = parent.path.endsWith("/") ? parent.path.slice(0, -1) : parent.path;
  return { parent, path: `${parentPath}${SUBAGENT_URI_MARKER}` };
}
function buildSubagentSessionUri(parentSession, toolCallId) {
  const { parent, path } = getSubagentBasePath(parentSession);
  return parent.with({ path: `${path}${toolCallId}` }).toString();
}
function parseSubagentSessionUri(uri) {
  const resource = asResourceUri(uri);
  const match = SUBAGENT_URI_PATH_REGEX.exec(resource.path);
  if (!match?.groups) {
    return void 0;
  }
  return {
    parentSession: resource.with({ path: match.groups.parentPath }),
    toolCallId: match.groups.toolCallId
  };
}
function isSubagentSession(uri) {
  return parseSubagentSessionUri(uri) !== void 0;
}
function buildSubagentSessionUriPrefix(parentSession) {
  const { parent, path } = getSubagentBasePath(parentSession);
  return parent.with({ path }).toString();
}
function createRootState() {
  return {
    agents: [],
    activeSessions: 0
  };
}
function createSessionState(summary) {
  const state = {
    provider: summary.provider,
    title: summary.title,
    status: summary.status,
    lifecycle: SessionLifecycle.Creating,
    activeClients: [],
    chats: [],
    defaultChat: void 0
  };
  if (summary.activity !== void 0) {
    state.activity = summary.activity;
  }
  if (summary.project !== void 0) {
    state.project = summary.project;
  }
  if (summary.workingDirectories !== void 0) {
    state.workingDirectories = summary.workingDirectories;
  }
  if (summary.annotations !== void 0) {
    state.annotations = summary.annotations;
  }
  if (summary._meta !== void 0) {
    state._meta = summary._meta;
  }
  return state;
}
function createChatState(summary) {
  return {
    resource: summary.resource,
    title: summary.title,
    status: summary.status,
    activity: summary.activity,
    modifiedAt: summary.modifiedAt,
    origin: summary.origin,
    interactivity: summary.interactivity,
    workingDirectories: summary.workingDirectories,
    turns: [],
    activeTurn: void 0
  };
}
function createDefaultChatSummary(session, chatUri) {
  const summary = {
    resource: chatUri,
    title: session.title,
    status: session.status,
    modifiedAt: session.modifiedAt,
    origin: { kind: ChatOriginKind.User }
  };
  if (session.activity !== void 0) {
    summary.activity = session.activity;
  }
  return summary;
}
const STATUS_ACTIVITY_MASK = (1 << 5) - 1;
function hasAutoApprovedPendingConfirmation(state) {
  return !!state.activeTurn?.responseParts.some(
    (part) => part.kind === ResponsePartKind.ToolCall && part.toolCall.status === ToolCallStatus.PendingConfirmation && readToolCallMeta(part.toolCall).autoApproveBySetting === true
  );
}
function chatAwaitsUserInput(state) {
  return !!state.activeTurn?.responseParts.some((part) => {
    if (part.kind === ResponsePartKind.InputRequest) {
      return part.response === void 0;
    }
    if (part.kind !== ResponsePartKind.ToolCall) {
      return false;
    }
    const status = part.toolCall.status;
    if (status === ToolCallStatus.PendingResultConfirmation || status === ToolCallStatus.AuthRequired) {
      return true;
    }
    return status === ToolCallStatus.PendingConfirmation && readToolCallMeta(part.toolCall).autoApproveBySetting !== true;
  });
}
function chatSummaryStatus(state) {
  const status = state.status;
  if ((status & SessionStatus.InputNeeded) !== SessionStatus.InputNeeded) {
    return status;
  }
  if (hasAutoApprovedPendingConfirmation(state) && !chatAwaitsUserInput(state)) {
    return status & ~STATUS_ACTIVITY_MASK | SessionStatus.InProgress;
  }
  return status;
}
function chatSummaryFromState(state) {
  const summary = {
    resource: state.resource,
    title: state.title,
    status: chatSummaryStatus(state),
    modifiedAt: state.modifiedAt
  };
  if (state.activity !== void 0) {
    summary.activity = state.activity;
  }
  if (state.origin !== void 0) {
    summary.origin = state.origin;
  }
  if (state.interactivity !== void 0) {
    summary.interactivity = state.interactivity;
  }
  if (state.workingDirectories !== void 0) {
    summary.workingDirectories = state.workingDirectories;
  }
  return summary;
}
function effectiveChatInteractivity(interactivity, sessionArchived) {
  if (interactivity === ChatInteractivity.Hidden) {
    return ChatInteractivity.Hidden;
  }
  if (sessionArchived) {
    return ChatInteractivity.ReadOnly;
  }
  return interactivity ?? ChatInteractivity.Full;
}
function isChatReadOnly(interactivity, sessionArchived) {
  return effectiveChatInteractivity(interactivity, sessionArchived) === ChatInteractivity.ReadOnly;
}
function createActiveTurn(id, message, startedAt) {
  return {
    id,
    startedAt,
    message,
    responseParts: [],
    usage: void 0
  };
}
var StateComponents = /* @__PURE__ */ ((StateComponents2) => {
  StateComponents2[StateComponents2["Root"] = 0] = "Root";
  StateComponents2[StateComponents2["Session"] = 1] = "Session";
  StateComponents2[StateComponents2["Chat"] = 2] = "Chat";
  StateComponents2[StateComponents2["Terminal"] = 3] = "Terminal";
  StateComponents2[StateComponents2["Changeset"] = 4] = "Changeset";
  StateComponents2[StateComponents2["Annotations"] = 5] = "Annotations";
  return StateComponents2;
})(StateComponents || {});
const AHP_CHAT_SCHEME = "ahp-chat";
const DEFAULT_CHAT_ID = "default";
function buildChatUri(sessionUri, chatId) {
  const session = typeof sessionUri === "string" ? sessionUri : sessionUri.toString();
  const encoded = encodeBase64(VSBuffer.fromString(session), false, true);
  return `${AHP_CHAT_SCHEME}://${chatId}/${encoded}`;
}
function buildDefaultChatUri(sessionUri) {
  return buildChatUri(sessionUri, DEFAULT_CHAT_ID);
}
const SUBAGENT_CHAT_ID = "subagent";
function isSubagentChatUri(uri) {
  const parsed = typeof uri === "string" ? ResourceURI.parse(uri) : uri;
  return parsed.scheme === AHP_CHAT_SCHEME && parsed.authority === SUBAGENT_CHAT_ID;
}
function buildSubagentChatUri(sessionUri, toolCallId) {
  const session = typeof sessionUri === "string" ? sessionUri : sessionUri.toString();
  const encoded = encodeBase64(VSBuffer.fromString(session), false, true);
  return `${AHP_CHAT_SCHEME}://${SUBAGENT_CHAT_ID}/${encoded}/${encodeURIComponent(toolCallId)}`;
}
function parseChatUri(uri) {
  let parsed;
  try {
    parsed = typeof uri === "string" ? ResourceURI.parse(uri) : uri;
  } catch {
    return void 0;
  }
  if (parsed.scheme !== AHP_CHAT_SCHEME || !parsed.authority) {
    return void 0;
  }
  const encoded = parsed.path.replace(/^\//, "");
  if (!encoded) {
    return void 0;
  }
  try {
    if (parsed.authority === SUBAGENT_CHAT_ID) {
      const [sessionPart, ...toolCallIdParts] = encoded.split("/");
      const toolCallId = toolCallIdParts.join("/");
      if (!sessionPart || !toolCallId) {
        return void 0;
      }
      return { session: decodeBase64(sessionPart).toString(), chatId: `${SUBAGENT_CHAT_ID}/${decodeURIComponent(toolCallId)}` };
    }
    return { session: decodeBase64(encoded).toString(), chatId: parsed.authority };
  } catch {
    return void 0;
  }
}
function parseDefaultChatUri(uri) {
  return parseChatUri(uri)?.session;
}
function parseRequiredSessionUriFromChatUri(uri) {
  const session = parseDefaultChatUri(uri);
  if (session === void 0) {
    throw new Error(`Malformed AHP chat URI: ${typeof uri === "string" ? uri : uri.toString()}`);
  }
  return session;
}
function isDefaultChatUri(uri) {
  return parseChatUri(uri)?.chatId === DEFAULT_CHAT_ID;
}
function resolveChatUri(session, chat) {
  return isDefaultChatUri(chat) ? session : chat;
}
function chatStorageUri(chatChannel) {
  const parsed = parseChatUri(chatChannel);
  if (!parsed) {
    return void 0;
  }
  return resolveChatUri(ResourceURI.parse(parsed.session), ResourceURI.parse(chatChannel.toString()));
}
function isAhpChatChannel(uri) {
  try {
    return ResourceURI.parse(uri).scheme === AHP_CHAT_SCHEME;
  } catch {
    return false;
  }
}
function mergeSessionWithDefaultChat(session, chat) {
  return {
    ...session,
    workingDirectories: chat?.workingDirectories ?? session.workingDirectories,
    turns: chat?.turns ?? [],
    activeTurn: chat?.activeTurn,
    steeringMessage: chat?.steeringMessage,
    queuedMessages: chat?.queuedMessages,
    draft: chat?.draft
  };
}
function getActiveTurn(chat) {
  return chat?.activeTurn;
}
function getDefaultChat(session) {
  if (session.defaultChat !== void 0) {
    const match = session.chats.find((c) => c.resource === session.defaultChat);
    if (match) {
      return match;
    }
  }
  return session.chats[0];
}
const SESSION_META_GIT_KEY = "git";
const SESSION_META_GITHUB_KEY = "github";
const SESSION_META_PROMPT_CACHE_KEY = "vscode.promptCache";
const SESSION_META_MULTI_ROOT_KEY = "multiRoot";
const MAX_WORKSPACE_FILE_LENGTH = 4096;
function readSessionMultiRootMetadata(meta) {
  return validateSessionMultiRootMetadata(meta?.[SESSION_META_MULTI_ROOT_KEY]);
}
function parseSessionMultiRootMetadata(value) {
  if (!value) {
    return void 0;
  }
  try {
    return validateSessionMultiRootMetadata(JSON.parse(value));
  } catch {
    return void 0;
  }
}
function withSessionMultiRootMetadata(meta, multiRoot) {
  const next = { ...meta };
  if (multiRoot) {
    next[SESSION_META_MULTI_ROOT_KEY] = multiRoot;
  } else {
    delete next[SESSION_META_MULTI_ROOT_KEY];
  }
  return Object.keys(next).length > 0 ? next : void 0;
}
function validateSessionMultiRootMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return void 0;
  }
  const raw = value;
  if (typeof raw.workspaceFile !== "string" || raw.workspaceFile.length === 0 || raw.workspaceFile.length > MAX_WORKSPACE_FILE_LENGTH) {
    return void 0;
  }
  try {
    if (!ResourceURI.parse(raw.workspaceFile, true).scheme) {
      return void 0;
    }
  } catch {
    return void 0;
  }
  return { workspaceFile: raw.workspaceFile };
}
function readSessionPromptCacheState(meta) {
  const value = meta?.[SESSION_META_PROMPT_CACHE_KEY];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return void 0;
  }
  const raw = value;
  return typeof raw["modelId"] === "string" && typeof raw["cacheExpiresAt"] === "string" ? { modelId: raw["modelId"], cacheExpiresAt: raw["cacheExpiresAt"] } : void 0;
}
function withSessionPromptCacheState(meta, promptCache) {
  const next = { ...meta };
  if (promptCache) {
    next[SESSION_META_PROMPT_CACHE_KEY] = promptCache;
  } else {
    delete next[SESSION_META_PROMPT_CACHE_KEY];
  }
  return Object.keys(next).length > 0 ? next : void 0;
}
function hasSessionPullRequestForBranch(gitHubState, branchName) {
  if (!gitHubState?.pullRequestUrls?.length) {
    return false;
  }
  return gitHubState.pullRequestBranchName === void 0 || gitHubState.pullRequestBranchName === branchName;
}
const MAX_SESSION_PULL_REQUEST_REFERENCES = 10;
function normalizeSessionPullRequestUrls(urls) {
  const normalizedUrls = urls.map((url) => {
    const match = /^https:\/\/github\.com\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/pull\/(?<number>\d+)\/?$/.exec(url);
    const groups = match?.groups;
    return groups ? `https://github.com/${groups["owner"]}/${groups["repo"]}/pull/${groups["number"]}` : url;
  });
  return distinct(normalizedUrls, (url) => url.toLowerCase()).slice(0, MAX_SESSION_PULL_REQUEST_REFERENCES);
}
function withMostRecentSessionPullRequest(gitHubState, pullRequestUrl, branchName) {
  const pullRequestUrls = normalizeSessionPullRequestUrls([
    pullRequestUrl,
    ...gitHubState?.pullRequestUrls ?? []
  ]);
  return {
    pullRequestUrls,
    pullRequestBranchName: branchName
  };
}
function readSessionGitState(meta) {
  const value = meta?.[SESSION_META_GIT_KEY];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return void 0;
  }
  const raw = value;
  const result = {};
  if (typeof raw["hasGitHubRemote"] === "boolean") {
    result.hasGitHubRemote = raw["hasGitHubRemote"];
  }
  if (typeof raw["branchName"] === "string") {
    result.branchName = raw["branchName"];
  }
  if (typeof raw["baseBranchName"] === "string") {
    result.baseBranchName = raw["baseBranchName"];
  }
  if (typeof raw["upstreamBranchName"] === "string") {
    result.upstreamBranchName = raw["upstreamBranchName"];
  }
  if (typeof raw["incomingChanges"] === "number") {
    result.incomingChanges = raw["incomingChanges"];
  }
  if (typeof raw["outgoingChanges"] === "number") {
    result.outgoingChanges = raw["outgoingChanges"];
  }
  if (typeof raw["uncommittedChanges"] === "number") {
    result.uncommittedChanges = raw["uncommittedChanges"];
  }
  if (typeof raw["githubOwner"] === "string") {
    result.githubOwner = raw["githubOwner"];
  }
  if (typeof raw["githubHeadOwner"] === "string") {
    result.githubHeadOwner = raw["githubHeadOwner"];
  }
  if (typeof raw["githubRepo"] === "string") {
    result.githubRepo = raw["githubRepo"];
  }
  return result;
}
function withSessionGitState(meta, gitState) {
  const next = { ...meta };
  if (gitState !== void 0) {
    next[SESSION_META_GIT_KEY] = gitState;
  } else {
    delete next[SESSION_META_GIT_KEY];
  }
  return Object.keys(next).length > 0 ? next : void 0;
}
function readSessionGitHubState(meta) {
  const value = meta?.[SESSION_META_GITHUB_KEY];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return void 0;
  }
  const raw = value;
  const result = {};
  if (typeof raw["owner"] === "string") {
    result.owner = raw["owner"];
  }
  if (typeof raw["repo"] === "string") {
    result.repo = raw["repo"];
  }
  const pullRequestUrls = Array.isArray(raw["pullRequestUrls"]) ? raw["pullRequestUrls"].filter((url) => typeof url === "string") : typeof raw["pullRequestUrl"] === "string" ? [raw["pullRequestUrl"]] : [];
  if (pullRequestUrls.length > 0) {
    result.pullRequestUrls = normalizeSessionPullRequestUrls(pullRequestUrls);
  }
  if (Array.isArray(raw["issueUrls"])) {
    result.issueUrls = raw["issueUrls"].filter((url) => typeof url === "string");
  }
  if (typeof raw["pullRequestBranchName"] === "string") {
    result.pullRequestBranchName = raw["pullRequestBranchName"];
  }
  return result;
}
function withSessionGitHubState(meta, gitHubState) {
  const next = { ...meta };
  if (gitHubState !== void 0) {
    next[SESSION_META_GITHUB_KEY] = gitHubState;
  } else {
    delete next[SESSION_META_GITHUB_KEY];
  }
  return Object.keys(next).length > 0 ? next : void 0;
}
const SESSION_META_SPAWN_DEPTH_KEY = "agentHost/sessionSpawnDepth";
function readSessionSpawnDepth(meta) {
  const value = meta?.[SESSION_META_SPAWN_DEPTH_KEY];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
function withSessionSpawnDepth(meta, depth) {
  return { ...meta, [SESSION_META_SPAWN_DEPTH_KEY]: depth };
}
const SESSION_META_WORKSPACELESS_KEY = "workspaceless";
const AH_META_WORKSPACELESS_DB_KEY = "agentHost.workspaceless";
const AH_META_IS_ARCHIVED_DB_KEY = "isArchived";
const AH_META_IS_DONE_DB_KEY = "isDone";
const AH_META_IS_READ_DB_KEY = "isRead";
function withSessionStatusFlag(status, flag, set) {
  return set ? status | flag : status & ~flag;
}
function isSessionStatusRead(status) {
  return status !== void 0 && (status & SessionStatus.IsRead) !== 0;
}
function isSessionStatusArchived(status) {
  return status !== void 0 && (status & SessionStatus.IsArchived) !== 0;
}
function readSessionWorkspaceless(meta) {
  return meta?.[SESSION_META_WORKSPACELESS_KEY] === true;
}
function withSessionWorkspaceless(meta, workspaceless) {
  const next = { ...meta };
  if (workspaceless) {
    next[SESSION_META_WORKSPACELESS_KEY] = true;
  } else {
    delete next[SESSION_META_WORKSPACELESS_KEY];
  }
  return Object.keys(next).length > 0 ? next : void 0;
}
const SESSION_META_EHCLI_ADOPTABLE_KEY = "ehcliAdoptable";
function readSessionEhcliAdoptable(meta) {
  return meta?.[SESSION_META_EHCLI_ADOPTABLE_KEY] === true;
}
function withSessionEhcliAdoptable(meta) {
  return { ...meta, [SESSION_META_EHCLI_ADOPTABLE_KEY]: true };
}
const ROOT_META_HOST_BUILD_KEY = "hostBuild";
function hostBuildInfoFromProduct(productService) {
  return {
    version: productService.version,
    commit: productService.commit,
    date: productService.date,
    quality: productService.quality
  };
}
function readHostBuildInfo(state) {
  const meta = state?._meta;
  const value = meta?.[ROOT_META_HOST_BUILD_KEY];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return void 0;
  }
  const raw = value;
  if (typeof raw["version"] !== "string") {
    return void 0;
  }
  const result = {
    version: raw["version"]
  };
  if (typeof raw["commit"] === "string") {
    result.commit = raw["commit"];
  }
  if (typeof raw["date"] === "string") {
    result.date = raw["date"];
  }
  if (typeof raw["quality"] === "string") {
    result.quality = raw["quality"];
  }
  return result;
}
function withHostBuildInfo(meta, buildInfo) {
  const next = { ...meta };
  if (buildInfo !== void 0) {
    next[ROOT_META_HOST_BUILD_KEY] = buildInfo;
  } else {
    delete next[ROOT_META_HOST_BUILD_KEY];
  }
  return Object.keys(next).length > 0 ? next : void 0;
}
function formatHostBuildInfo(info) {
  const details = [];
  if (info.commit) {
    details.push(`commit ${info.commit}`);
  }
  if (info.date) {
    details.push(info.date);
  }
  if (info.quality) {
    details.push(info.quality);
  }
  return details.length > 0 ? `${info.version} (${details.join(", ")})` : info.version;
}
export {
  AHP_CHAT_SCHEME,
  AHP_RESOURCE_WATCH_SCHEME,
  AHP_ROOT_SCHEME,
  AH_META_IS_ARCHIVED_DB_KEY,
  AH_META_IS_DONE_DB_KEY,
  AH_META_IS_READ_DB_KEY,
  AH_META_WORKSPACELESS_DB_KEY,
  ChangesetOperationScope,
  ChangesetOperationStatus,
  ChangesetOperationTargetKind,
  ChangesetStatus,
  ChatInputAnswerState2 as ChatInputAnswerState,
  ChatInputAnswerValueKind2 as ChatInputAnswerValueKind,
  ChatInputQuestionKind2 as ChatInputQuestionKind,
  ChatInputRequestPurpose,
  ChatInputResponseKind2 as ChatInputResponseKind,
  ChatInteractivity2 as ChatInteractivity,
  ChatOriginKind2 as ChatOriginKind,
  CustomizationLoadStatus,
  CustomizationType,
  DEFAULT_CHAT_ID,
  FileEditKind,
  MAX_SESSION_PULL_REQUEST_REFERENCES,
  MessageAttachmentKind,
  MessageKind,
  PendingMessageKind,
  PolicyState,
  ROOT_META_HOST_BUILD_KEY,
  ROOT_STATE_URI,
  ResponsePartKind2 as ResponsePartKind,
  SESSION_META_EHCLI_ADOPTABLE_KEY,
  SESSION_META_GITHUB_KEY,
  SESSION_META_GIT_KEY,
  SESSION_META_MULTI_ROOT_KEY,
  SESSION_META_PROMPT_CACHE_KEY,
  SESSION_META_SPAWN_DEPTH_KEY,
  SESSION_META_WORKSPACELESS_KEY,
  ChatInputAnswerState as SessionInputAnswerState,
  ChatInputAnswerValueKind as SessionInputAnswerValueKind,
  ChatInputQuestionKind as SessionInputQuestionKind,
  ChatInputResponseKind as SessionInputResponseKind,
  SessionLifecycle2 as SessionLifecycle,
  SessionStatus2 as SessionStatus,
  StateComponents,
  ToolCallCancellationReason,
  ToolCallConfirmationReason,
  ToolCallContributorKind,
  ToolCallRiskAssessmentKind,
  ToolCallRiskAssessmentStatus,
  ToolCallStatus2 as ToolCallStatus,
  ToolResultContentType2 as ToolResultContentType,
  TurnState,
  buildChatUri,
  buildDefaultChatUri,
  buildResourceWatchChannelUri,
  buildSubagentChatUri,
  buildSubagentSessionUri,
  buildSubagentSessionUriPrefix,
  chatStorageUri,
  chatSummaryFromState,
  createActiveTurn,
  createChatState,
  createDefaultChatSummary,
  createRootState,
  createSessionState,
  customizationId,
  effectiveChatInteractivity,
  formatHostBuildInfo,
  getActiveTurn,
  getDefaultChat,
  getInlineToolInput,
  getToolFileEdits,
  getToolOutputText,
  getToolSubagentContent,
  hasReportedUsage,
  hasSessionPullRequestForBranch,
  hostBuildInfoFromProduct,
  isAhpChatChannel,
  isAhpResourceWatchChannel,
  isAhpRootChannel,
  isChatReadOnly,
  isDefaultChatUri,
  isSessionStatusArchived,
  isSessionStatusRead,
  isSubagentChatUri,
  isSubagentSession,
  mergeSessionWithDefaultChat,
  parseChatUri,
  parseDefaultChatUri,
  parseRequiredSessionUriFromChatUri,
  parseResourceWatchChannelUri,
  parseSessionMultiRootMetadata,
  parseSubagentSessionUri,
  readHostBuildInfo,
  readSessionEhcliAdoptable,
  readSessionGitHubState,
  readSessionGitState,
  readSessionMultiRootMetadata,
  readSessionPromptCacheState,
  readSessionSpawnDepth,
  readSessionWorkspaceless,
  readUsageInfoMeta,
  resolveChatUri,
  withHostBuildInfo,
  withMostRecentSessionPullRequest,
  withSessionEhcliAdoptable,
  withSessionGitHubState,
  withSessionGitState,
  withSessionMultiRootMetadata,
  withSessionPromptCacheState,
  withSessionSpawnDepth,
  withSessionStatusFlag,
  withSessionWorkspaceless
};
