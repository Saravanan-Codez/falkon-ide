import { URI } from "../../../../base/common/uri.js";
import { localize } from "../../../../nls.js";
import { AgentSession } from "../../common/agentService.js";
import { SessionStatus } from "../../common/state/protocol/channels-session/state.js";
import { buildChatUri, buildDefaultChatUri, getInlineToolInput, isSessionStatusArchived, isSessionStatusRead, parseChatUri, readSessionGitState, readSessionGitHubState, ResponsePartKind, ToolCallStatus, TurnState } from "../../common/state/sessionState.js";
import { buildOpenSessionLinkUri, parseOpenSessionLinkChatId, parseOpenSessionLinkUri } from "../../common/openSessionLink.js";
import { SessionServerToolName } from "../../common/serverToolNames.js";
import { generateUuid } from "../../../../base/common/uuid.js";
const maxSessionSpawnDepth = 3;
const maxCreatedSessions = 25;
const maxCreatedChats = 25;
const maxSentMessages = 50;
const sessionConfirmationToolNames = /* @__PURE__ */ new Set([SessionServerToolName.CreateSession, SessionServerToolName.CreateChat, SessionServerToolName.SendMessage, SessionServerToolName.DeleteSession]);
function sessionToolRequiresConfirmation(toolName) {
  return sessionConfirmationToolNames.has(toolName);
}
const listSessionsStatusValues = ["idle", "inProgress", "inputNeeded", "error", "archived"];
const listSessionsInputSchema = {
  type: "object",
  properties: {
    session: { type: "string", description: "Return only the session with this URI or `agent-host-session://` link (a direct lookup that ignores the other filters). Use this to fetch one known session's metadata." },
    status: {
      type: "array",
      items: { type: "string", enum: [...listSessionsStatusValues] },
      description: "Only return sessions whose status matches one of these (e.g. `inputNeeded` for sessions awaiting a reply, `inProgress` for running ones, `archived` for sessions marked Done/completed \u2014 implies `includeArchived`). Omit to return every status."
    },
    workspace: { type: "string", description: "Only return sessions whose working directory is this folder \u2014 an absolute path or a workspace URI." },
    withChanges: { type: "boolean", description: "When true, only return sessions that have pending worktree changes." },
    unread: { type: "boolean", description: "When true, only return sessions with updates the user has not seen yet." },
    withPullRequest: { type: "boolean", description: "When true, only return sessions that have a linked GitHub pull request." },
    includeArchived: { type: "boolean", description: "Whether to include archived sessions. Defaults to false; set true to also return archived sessions." },
    createdAfter: { type: "string", description: "Only return sessions created at or after this time (ISO-8601 timestamp, e.g. `2025-01-31T00:00:00Z`)." },
    createdBefore: { type: "string", description: "Only return sessions created at or before this time (ISO-8601 timestamp)." }
  }
};
const createSessionInputSchema = {
  type: "object",
  properties: {
    workspace: { type: "string", description: "Absolute folder path, workspace URI, or a working directory from an existing session." },
    prompt: { type: "string", description: "Initial prompt to send to the new session." },
    model: { type: "string", description: "Optional model ID or display name. Defaults to the current chat's model." }
  },
  required: ["workspace", "prompt"]
};
const getCurrentSessionInputSchema = {
  type: "object",
  properties: {}
};
const createChatInputSchema = {
  type: "object",
  properties: {
    session: { type: "string", description: "Optional session to add the chat to: a session URI from `list_sessions` or an `agent-host-session://` link. Defaults to the current session when omitted." },
    prompt: { type: "string", description: "Initial prompt to send to the new chat." },
    title: { type: "string", description: "Optional title for the new chat." },
    model: { type: "string", description: "Optional model ID or display name. Defaults to the current chat's model." }
  },
  required: ["prompt"]
};
const deleteSessionInputSchema = {
  type: "object",
  properties: {
    session: { type: "string", description: "The session to delete: a session URI from `list_sessions` or an `agent-host-session://` link (e.g. from `create_session`)." }
  },
  required: ["session"]
};
const sendMessageInputSchema = {
  type: "object",
  properties: {
    session: { type: "string", description: "The session or chat to message: a session URI from `list_sessions`, or an `agent-host-session://` link (from `create_session`/`create_chat`; a `create_chat` link targets that specific chat)." },
    message: { type: "string", description: "The message to send." }
  },
  required: ["session", "message"]
};
const sessionContextDetailValues = ["summary", "digest", "full"];
const getSessionContextInputSchema = {
  type: "object",
  properties: {
    session: { type: "string", description: "The session or chat to read: a session URI from `list_sessions`, or an `agent-host-session://` link (a `create_chat` link targets that specific chat)." },
    detail: {
      type: "string",
      enum: [...sessionContextDetailValues],
      description: "How much conversation detail to return. `summary` (default): status and a short per-turn gist (the message plus a compact snippet of the reply). `digest`: adds the full assistant reply text and tool-call names. `full`: adds tool-call inputs. Higher levels return more tokens."
    },
    transcriptLimit: { type: "number", description: "Maximum number of most-recent turns to include. Defaults to 10; capped at 50." }
  },
  required: ["session"]
};
const sessionServerToolDefinitions = [
  {
    name: SessionServerToolName.ListSessions,
    title: "List Sessions",
    description: "List sessions and their compact metadata (status, activity, working directory, project, worktree changes, git/GitHub info, timestamps). Pass `session` to fetch a single known session by URI. By default archived sessions are omitted. Optionally filter by `status`, `workspace`, `withChanges`, `unread`, `withPullRequest`, `includeArchived`, `createdAfter`, or `createdBefore`.",
    inputSchema: listSessionsInputSchema,
    annotations: { readOnlyHint: true }
  },
  {
    name: SessionServerToolName.GetCurrentSession,
    title: "Get Current Session",
    description: "Get metadata and the open link for the session this conversation is running in. Use this to reference the current session (for example before adding a chat to it).",
    inputSchema: getCurrentSessionInputSchema,
    annotations: { readOnlyHint: true }
  },
  {
    name: SessionServerToolName.CreateSession,
    title: "Create Session",
    description: 'Create a session in a workspace and start it with an initial prompt. The UI shows a "Session Created" confirmation with a button to open it, so reply with a single short sentence confirming the session was created and do NOT print the session URL or tell the user to click a button.',
    inputSchema: createSessionInputSchema,
    annotations: { readOnlyHint: false }
  },
  {
    name: SessionServerToolName.CreateChat,
    title: "Create Chat",
    description: 'Add a new chat to an existing session and start it with an initial prompt. Omit `session` to add the chat to the current session; otherwise pass a session URI from `list_sessions`. Optionally pass a `model` to use for the chat (defaults to the current chat\'s model). The UI shows a "Chat Created" confirmation with a button to open the session, so reply with a single short sentence and do NOT print the session URL or tell the user to click a button.',
    inputSchema: createChatInputSchema,
    annotations: { readOnlyHint: false }
  },
  {
    name: SessionServerToolName.SendMessage,
    title: "Send Message",
    description: "Send a message to an existing session or chat, starting a new turn there. Provide a session URI from `list_sessions` or an `agent-host-session://` link (a `create_chat` link targets that specific chat). The message is delivered asynchronously \u2014 this tool does not wait for or return the reply. The UI shows a confirmation with a button to open the target, so reply with a single short sentence and do NOT print the URL or tell the user to click a button.",
    inputSchema: sendMessageInputSchema,
    annotations: { readOnlyHint: false }
  },
  {
    name: SessionServerToolName.GetSessionContext,
    title: "Get Session Context",
    description: 'Read the recent conversation of an existing session or chat: a compacted transcript of its turns (messages, replies, and tool calls). Use this to see what a session you created is doing, or to gather context before sending it a message. Returns a compacted summary by default (`detail: "summary"`); request `digest` or `full` for more detail. For session metadata (status, working directory, changes, \u2026) use `list_sessions` with the `session` argument.',
    inputSchema: getSessionContextInputSchema,
    annotations: { readOnlyHint: true }
  },
  {
    name: SessionServerToolName.DeleteSession,
    title: "Delete Session",
    description: "Permanently delete a session (identified by a session URI from `list_sessions`), including its stored data. This cannot be undone. Refuses to delete the current session.",
    inputSchema: deleteSessionInputSchema,
    annotations: { readOnlyHint: false, destructiveHint: true }
  }
];
function currentSessionUri(toolCallChannel) {
  const owning = parseChatUri(toolCallChannel) ?? void 0;
  return URI.parse(owning?.session ?? toolCallChannel);
}
function getRequiredString(value, field, toolName) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid ${toolName} input: ${field} must be a non-empty string.`);
  }
  return value;
}
function getOptionalString(value, field, toolName) {
  if (value === void 0) {
    return void 0;
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid ${toolName} input: ${field} must be a non-empty string.`);
  }
  return value;
}
function parseWorkspaceUri(workspace) {
  if (/^(\/|[a-zA-Z]:[\\/]|\\\\)/.test(workspace)) {
    return URI.file(workspace);
  }
  try {
    const parsed = URI.parse(workspace, true);
    return parsed.scheme ? parsed : void 0;
  } catch {
    return void 0;
  }
}
function resolveWorkspace(workspace, sessions) {
  for (const session of sessions) {
    const match = session.workingDirectories?.find((d) => d.toString() === workspace || d.fsPath === workspace);
    if (match) {
      return match;
    }
  }
  const parsed = parseWorkspaceUri(workspace);
  if (!parsed) {
    throw new Error(`Invalid ${SessionServerToolName.CreateSession} input: workspace must match a known session workingDirectory, an absolute path, or a valid URI string.`);
  }
  return parsed;
}
function resolveModel(modelName, models) {
  if (modelName === void 0) {
    return void 0;
  }
  const model = models.find((candidate) => candidate.id === modelName || candidate.name === modelName);
  if (!model) {
    throw new Error(`Invalid ${SessionServerToolName.CreateSession} input: model must match an available model id or name.`);
  }
  return model;
}
function getCreateSessionArgs(rawArgs, sessions, models) {
  const args = rawArgs ?? {};
  const workspace = getRequiredString(args.workspace, "workspace", SessionServerToolName.CreateSession);
  const prompt = getRequiredString(args.prompt, "prompt", SessionServerToolName.CreateSession);
  const modelName = getOptionalString(args.model, "model", SessionServerToolName.CreateSession);
  return {
    workspace: resolveWorkspace(workspace, sessions),
    prompt,
    model: resolveModel(modelName, models)
  };
}
function describeSessionStatusBits(status) {
  const names = [];
  if ((status & SessionStatus.InputNeeded) === SessionStatus.InputNeeded) {
    names.push("inputNeeded");
  } else if (status & SessionStatus.InProgress) {
    names.push("inProgress");
  } else if (status & SessionStatus.Idle) {
    names.push("idle");
  }
  if (status & SessionStatus.Error) {
    names.push("error");
  }
  if (status & SessionStatus.IsArchived) {
    names.push("archived");
  }
  return names;
}
function describeSessionStatusNames(session) {
  return session.status !== void 0 ? describeSessionStatusBits(session.status) : [];
}
function describeSessionStatus(session) {
  const names = describeSessionStatusNames(session);
  if (names.length > 0) {
    return names.join(",");
  }
  return session.status !== void 0 ? "unknown" : void 0;
}
function getOptionalBoolean(value, field, toolName) {
  if (value === void 0) {
    return void 0;
  }
  if (typeof value !== "boolean") {
    throw new Error(`Invalid ${toolName} input: ${field} must be a boolean.`);
  }
  return value;
}
function getOptionalTimestamp(value, field, toolName) {
  if (value === void 0) {
    return void 0;
  }
  if (typeof value !== "string") {
    throw new Error(`Invalid ${toolName} input: ${field} must be an ISO-8601 timestamp string.`);
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid ${toolName} input: ${field} must be a valid ISO-8601 timestamp (e.g. 2025-01-31T00:00:00Z).`);
  }
  return parsed;
}
function getListSessionsArgs(rawArgs) {
  const args = rawArgs ?? {};
  let status;
  if (args.status !== void 0) {
    if (!Array.isArray(args.status) || args.status.some((value) => typeof value !== "string")) {
      throw new Error(`Invalid ${SessionServerToolName.ListSessions} input: status must be an array of status names.`);
    }
    const invalid = args.status.filter((value) => !listSessionsStatusValues.includes(value));
    if (invalid.length > 0) {
      throw new Error(`Invalid ${SessionServerToolName.ListSessions} input: unknown status value(s) ${invalid.join(", ")}. Valid values: ${listSessionsStatusValues.join(", ")}.`);
    }
    status = new Set(args.status);
  }
  return {
    session: getOptionalString(args.session, "session", SessionServerToolName.ListSessions),
    status,
    workspace: getOptionalString(args.workspace, "workspace", SessionServerToolName.ListSessions),
    withChanges: getOptionalBoolean(args.withChanges, "withChanges", SessionServerToolName.ListSessions),
    unread: getOptionalBoolean(args.unread, "unread", SessionServerToolName.ListSessions),
    withPullRequest: getOptionalBoolean(args.withPullRequest, "withPullRequest", SessionServerToolName.ListSessions),
    includeArchived: getOptionalBoolean(args.includeArchived, "includeArchived", SessionServerToolName.ListSessions),
    createdAfter: getOptionalTimestamp(args.createdAfter, "createdAfter", SessionServerToolName.ListSessions),
    createdBefore: getOptionalTimestamp(args.createdBefore, "createdBefore", SessionServerToolName.ListSessions)
  };
}
function sessionHasChanges(session) {
  const changes = session.changes;
  return !!changes && ((changes.files ?? 0) > 0 || (changes.additions ?? 0) > 0 || (changes.deletions ?? 0) > 0);
}
function sessionIsArchived(session) {
  return isSessionStatusArchived(session.status);
}
function sessionIsUnread(session) {
  return session.status !== void 0 && !isSessionStatusRead(session.status);
}
function sessionMatchesWorkspace(session, workspace) {
  const dirs = session.workingDirectories;
  if (!dirs || dirs.length === 0) {
    return false;
  }
  const parsed = parseWorkspaceUri(workspace);
  return dirs.some((dir) => dir.toString() === workspace || dir.fsPath === workspace || !!parsed && parsed.toString() === dir.toString());
}
function filterSessions(sessions, args) {
  if (args.session !== void 0) {
    const target = parseOpenSessionLinkUri(args.session)?.toString() ?? args.session;
    return sessions.filter((session) => session.session.toString() === target);
  }
  return sessions.filter((session) => {
    if (args.status) {
      const names = describeSessionStatusNames(session);
      if (!names.some((name) => args.status.has(name))) {
        return false;
      }
    }
    if (args.workspace !== void 0 && !sessionMatchesWorkspace(session, args.workspace)) {
      return false;
    }
    if (args.withChanges && !sessionHasChanges(session)) {
      return false;
    }
    if (args.unread && !sessionIsUnread(session)) {
      return false;
    }
    if (args.withPullRequest && !readSessionGitHubState(session._meta)?.pullRequestUrls?.length) {
      return false;
    }
    if (args.includeArchived !== true && !args.status?.has("archived") && sessionIsArchived(session)) {
      return false;
    }
    if (args.createdAfter !== void 0 && session.startTime < args.createdAfter) {
      return false;
    }
    if (args.createdBefore !== void 0 && session.startTime > args.createdBefore) {
      return false;
    }
    return true;
  });
}
function serializeGitState(session) {
  const git = readSessionGitState(session._meta);
  if (!git) {
    return void 0;
  }
  const result = {};
  if (git.branchName !== void 0) {
    result.branch = git.branchName;
  }
  if (git.baseBranchName !== void 0) {
    result.baseBranch = git.baseBranchName;
  }
  if (git.upstreamBranchName !== void 0) {
    result.upstreamBranch = git.upstreamBranchName;
  }
  if (git.outgoingChanges !== void 0) {
    result.ahead = git.outgoingChanges;
  }
  if (git.incomingChanges !== void 0) {
    result.behind = git.incomingChanges;
  }
  if (git.uncommittedChanges !== void 0) {
    result.uncommittedChanges = git.uncommittedChanges;
  }
  return Object.keys(result).length > 0 ? result : void 0;
}
function serializeGitHubState(session) {
  const github = readSessionGitHubState(session._meta);
  if (!github) {
    return void 0;
  }
  const result = {};
  if (github.owner !== void 0) {
    result.owner = github.owner;
  }
  if (github.repo !== void 0) {
    result.repo = github.repo;
  }
  if (github.pullRequestUrls?.[0] !== void 0) {
    result.pullRequestUrl = github.pullRequestUrls[0];
  }
  return Object.keys(result).length > 0 ? result : void 0;
}
function serializeSession(session) {
  const git = serializeGitState(session);
  const github = serializeGitHubState(session);
  const status = describeSessionStatus(session);
  return {
    session: session.session.toString(),
    ...session.summary !== void 0 ? { title: session.summary } : {},
    ...status !== void 0 ? { status } : {},
    ...session.activity !== void 0 ? { activity: session.activity } : {},
    ...session.workingDirectories?.[0] !== void 0 ? { workingDirectory: session.workingDirectories[0].toString() } : {},
    ...session.project !== void 0 ? { project: session.project.displayName } : {},
    ...sessionIsUnread(session) ? { unread: true } : {},
    ...session.startTime > 0 ? { createdAt: new Date(session.startTime).toISOString() } : {},
    ...session.modifiedTime > 0 ? { modifiedAt: new Date(session.modifiedTime).toISOString() } : {},
    ...session.changes !== void 0 ? { changes: session.changes } : {},
    ...session.changesets !== void 0 ? {
      changesets: session.changesets.map((changeset) => ({
        label: changeset.label,
        changeKind: changeset.changeKind,
        uriTemplate: changeset.uriTemplate,
        ...changeset.description !== void 0 ? { description: changeset.description } : {}
      }))
    } : {},
    ...git !== void 0 ? { git } : {},
    ...github !== void 0 ? { github } : {}
  };
}
function serializeSessions(sessions) {
  return JSON.stringify({ sessions: sessions.map(serializeSession) });
}
async function applyCreateSessionTool(accessor, rawArgs, source) {
  const currentSession = source ? currentSessionUri(source.toString()) : void 0;
  const parentDepth = currentSession ? accessor.getSessionSpawnDepth(currentSession) : 0;
  if (parentDepth >= maxSessionSpawnDepth) {
    throw new Error(`Refusing to create a session: recursion limit reached (max spawn depth ${maxSessionSpawnDepth}). This session was itself created ${parentDepth} level(s) deep.`);
  }
  const sessions = await accessor.listSessions();
  const args = getCreateSessionArgs(rawArgs, sessions, accessor.getModels());
  const defaults = source ? accessor.getCreationDefaults(source) : void 0;
  const provider = args.model?.provider ?? defaults?.provider;
  const inheritsSourceProvider = provider !== void 0 && provider === defaults?.provider;
  const config = {
    workingDirectories: args.workspace ? [args.workspace] : void 0,
    ...provider !== void 0 ? { provider } : {},
    ...args.model !== void 0 ? { model: { id: args.model.id } } : defaults?.model !== void 0 ? { model: defaults.model } : {},
    ...inheritsSourceProvider && defaults?.config !== void 0 ? { config: defaults.config } : {}
  };
  const session = await accessor.createSession(config);
  accessor.setSessionSpawnDepth(session, parentDepth + 1);
  const chat = URI.parse(buildDefaultChatUri(session));
  await accessor.startPrompt(session, chat, args.prompt);
  return { session: session.toString(), chat: chat.toString(), openLink: buildOpenSessionLinkUri(session) };
}
function formatCreateSessionResult(result) {
  return `Session created (${result.openLink}). Reply with one short sentence confirming the session was created; do not print the URL or mention a button.`;
}
function resolveKnownSession(sessionInput, sessions) {
  const fromLink = parseOpenSessionLinkUri(sessionInput);
  const candidate = fromLink?.toString() ?? sessionInput;
  const match = sessions.find((s) => s.session.toString() === candidate);
  return match?.session;
}
function resolveChatSession(sessionInput, sessions) {
  const session = resolveKnownSession(sessionInput, sessions);
  if (!session) {
    throw new Error(`Invalid ${SessionServerToolName.CreateChat} input: session must match the URI of a known session (see list_sessions).`);
  }
  return session;
}
function getCreateChatArgs(rawArgs, sessions, models, currentSession) {
  const args = rawArgs ?? {};
  const prompt = getRequiredString(args.prompt, "prompt", SessionServerToolName.CreateChat);
  const title = getOptionalString(args.title, "title", SessionServerToolName.CreateChat);
  const modelName = getOptionalString(args.model, "model", SessionServerToolName.CreateChat);
  const model = resolveModel(modelName, models);
  const sessionInput = getOptionalString(args.session, "session", SessionServerToolName.CreateChat);
  let session;
  if (sessionInput !== void 0) {
    session = resolveChatSession(sessionInput, sessions);
  } else if (currentSession) {
    session = currentSession;
  } else {
    throw new Error(`Invalid ${SessionServerToolName.CreateChat} input: no session provided and the current session could not be determined.`);
  }
  return { session, prompt, ...title !== void 0 ? { title } : {}, ...model !== void 0 ? { model } : {} };
}
async function applyCreateChatTool(accessor, rawArgs, source) {
  const sessions = await accessor.listSessions();
  const currentSession = source ? currentSessionUri(source.toString()) : void 0;
  const args = getCreateChatArgs(rawArgs, sessions, accessor.getModels(), currentSession);
  const defaults = source ? accessor.getCreationDefaults(source) : void 0;
  const targetProvider = AgentSession.provider(args.session);
  const model = args.model !== void 0 ? { id: args.model.id } : targetProvider === defaults?.provider ? defaults?.model : void 0;
  const chatId = generateUuid();
  const chat = URI.parse(buildChatUri(args.session.toString(), chatId));
  await accessor.createChat(args.session, chat, { title: args.title, model });
  await accessor.startPrompt(args.session, chat, args.prompt);
  return { session: args.session.toString(), chat: chat.toString(), openLink: buildOpenSessionLinkUri(args.session, chatId) };
}
function formatCreateChatResult(result) {
  return `Chat created (${result.openLink}). Reply with one short sentence confirming the chat was created; do not print the URL or mention a button.`;
}
function getSendMessageArgs(rawArgs, sessions) {
  const args = rawArgs ?? {};
  const message = getRequiredString(args.message, "message", SessionServerToolName.SendMessage);
  const sessionInput = getRequiredString(args.session, "session", SessionServerToolName.SendMessage);
  const session = resolveKnownSession(sessionInput, sessions);
  if (!session) {
    throw new Error(`Invalid ${SessionServerToolName.SendMessage} input: session must match the URI of a known session (see list_sessions).`);
  }
  const chatId = parseOpenSessionLinkChatId(sessionInput);
  const chat = URI.parse(chatId ? buildChatUri(session.toString(), chatId) : buildDefaultChatUri(session.toString()));
  return { session, chat, message, ...chatId !== void 0 ? { chatId } : {} };
}
async function applySendMessageTool(accessor, rawArgs, currentChannel) {
  const sessions = await accessor.listSessions();
  const { session, chat, chatId, message } = getSendMessageArgs(rawArgs, sessions);
  if (currentChannel && chat.toString() === URI.parse(currentChannel).toString()) {
    throw new Error(`Invalid ${SessionServerToolName.SendMessage} input: refusing to send a message to the current chat.`);
  }
  await accessor.startPrompt(session, chat, message);
  return formatSendMessageResult(buildOpenSessionLinkUri(session, chatId));
}
function formatSendMessageResult(openLink) {
  return `Message sent (${openLink}). Reply with one short sentence confirming the message was sent; do not print the URL or mention a button.`;
}
const defaultTranscriptLimit = 10;
const maxTranscriptLimit = 50;
const contextCaps = {
  // `summary` still carries a short assistant gist per turn so the reader sees
  // what each turn actually did, not just what was asked.
  summary: { user: 160, assistant: 140, toolInput: 0 },
  digest: { user: 300, assistant: 800, toolInput: 0 },
  full: { user: 1e3, assistant: 2e3, toolInput: 200 }
};
function getSessionContextArgs(rawArgs, sessions) {
  const args = rawArgs ?? {};
  const sessionInput = getRequiredString(args.session, "session", SessionServerToolName.GetSessionContext);
  const session = resolveKnownSession(sessionInput, sessions);
  if (!session) {
    throw new Error(`Invalid ${SessionServerToolName.GetSessionContext} input: session must match the URI of a known session (see list_sessions).`);
  }
  let detail = "summary";
  if (args.detail !== void 0) {
    if (typeof args.detail !== "string" || !sessionContextDetailValues.includes(args.detail)) {
      throw new Error(`Invalid ${SessionServerToolName.GetSessionContext} input: detail must be one of ${sessionContextDetailValues.join(", ")}.`);
    }
    detail = args.detail;
  }
  let transcriptLimit = defaultTranscriptLimit;
  if (args.transcriptLimit !== void 0) {
    if (typeof args.transcriptLimit !== "number" || !Number.isFinite(args.transcriptLimit) || args.transcriptLimit < 1) {
      throw new Error(`Invalid ${SessionServerToolName.GetSessionContext} input: transcriptLimit must be a positive number.`);
    }
    transcriptLimit = Math.min(Math.floor(args.transcriptLimit), maxTranscriptLimit);
  }
  const chatId = parseOpenSessionLinkChatId(sessionInput);
  return { session, detail, transcriptLimit, ...chatId !== void 0 ? { chatId } : {} };
}
function truncateText(text, max) {
  const trimmed = text.trim();
  if (trimmed.length <= max) {
    return { text: trimmed, truncated: false };
  }
  return { text: `${trimmed.slice(0, Math.max(0, max - 1))}\u2026`, truncated: true };
}
function toolCallsOf(parts) {
  return parts.filter((p) => p.kind === ResponsePartKind.ToolCall).map((p) => p.toolCall);
}
function assistantTextOf(parts) {
  return parts.filter((p) => p.kind === ResponsePartKind.Markdown).map((p) => p.content).join("").trim();
}
function describeTurnState(state) {
  switch (state) {
    case TurnState.Complete:
      return "complete";
    case TurnState.Cancelled:
      return "cancelled";
    case TurnState.Error:
      return "error";
    default:
      return "inProgress";
  }
}
function serializeSessionContext(session, chatId, snapshot, detail, transcriptLimit) {
  const caps = contextCaps[detail];
  let truncated = false;
  const trunc = (text, max) => {
    if (max <= 0 || !text) {
      return void 0;
    }
    const result = truncateText(text, max);
    truncated = truncated || result.truncated;
    return result.text || void 0;
  };
  const entries = snapshot.turns.map((t) => ({ message: t.message, parts: t.responseParts, state: t.state }));
  if (snapshot.activeTurn) {
    entries.push({ message: snapshot.activeTurn.message, parts: snapshot.activeTurn.responseParts, state: "inProgress" });
  }
  if (entries.length > transcriptLimit) {
    truncated = true;
  }
  const windowStart = Math.max(0, entries.length - transcriptLimit);
  const windowed = entries.slice(windowStart);
  const transcript = windowed.map((entry, index) => {
    const user = trunc(entry.message.text, caps.user);
    const assistant = trunc(assistantTextOf(entry.parts), caps.assistant);
    const toolCalls = toolCallsOf(entry.parts);
    let serializedToolCalls;
    if (detail !== "summary" && toolCalls.length > 0) {
      serializedToolCalls = toolCalls.map((tc) => {
        if (caps.toolInput > 0) {
          const input = trunc(tc.status === ToolCallStatus.Streaming ? "" : getInlineToolInput(tc.toolInput) ?? "", caps.toolInput);
          return input !== void 0 ? { name: tc.toolName, input } : { name: tc.toolName };
        }
        return tc.toolName;
      });
    }
    return {
      turn: windowStart + index + 1,
      state: describeTurnState(entry.state),
      ...user !== void 0 ? { user } : {},
      ...assistant !== void 0 ? { assistant } : {},
      ...serializedToolCalls ? { toolCalls: serializedToolCalls } : {}
    };
  });
  const payload = {
    session: session.toString(),
    openLink: buildOpenSessionLinkUri(session, chatId),
    detail,
    transcript,
    hasMoreHistory: snapshot.hasMoreHistory,
    truncated
  };
  return JSON.stringify(payload);
}
async function applyGetSessionContextTool(accessor, rawArgs) {
  const sessions = await accessor.listSessions();
  const { session, chatId, detail, transcriptLimit } = getSessionContextArgs(rawArgs, sessions);
  const snapshot = await accessor.getChatContext(session, chatId);
  if (!snapshot) {
    return JSON.stringify({
      session: session.toString(),
      openLink: buildOpenSessionLinkUri(session, chatId),
      detail,
      transcript: [],
      hasMoreHistory: false,
      truncated: false
    });
  }
  return serializeSessionContext(session, chatId, snapshot, detail, transcriptLimit);
}
function serializeCurrentSession(currentSession, sessions) {
  const meta = sessions.find((s) => s.session.toString() === currentSession.toString());
  return JSON.stringify({
    session: currentSession.toString(),
    openLink: buildOpenSessionLinkUri(currentSession),
    ...meta ? serializeSession(meta) : {}
  });
}
function parseListedSessionCount(resultText) {
  if (!resultText) {
    return void 0;
  }
  try {
    const parsed = JSON.parse(resultText);
    return Array.isArray(parsed.sessions) ? parsed.sessions.length : void 0;
  } catch {
    return void 0;
  }
}
function getDeleteSessionArgs(rawArgs, sessions, currentSession) {
  const args = rawArgs ?? {};
  const sessionInput = getRequiredString(args.session, "session", SessionServerToolName.DeleteSession);
  const session = resolveKnownSession(sessionInput, sessions);
  if (!session) {
    throw new Error(`Invalid ${SessionServerToolName.DeleteSession} input: session must match the URI of a known session (see list_sessions).`);
  }
  if (currentSession && session.toString() === currentSession.toString()) {
    throw new Error(`Invalid ${SessionServerToolName.DeleteSession} input: refusing to delete the current session.`);
  }
  return session;
}
async function applyDeleteSessionTool(accessor, rawArgs, currentSession) {
  const sessions = await accessor.listSessions();
  const session = getDeleteSessionArgs(rawArgs, sessions, currentSession);
  await accessor.deleteSession(session);
  return `Deleted session ${session.toString()}. Reply with one short sentence confirming the session was deleted.`;
}
function getSessionToolDisplay(toolName, _args, result) {
  switch (toolName) {
    case SessionServerToolName.ListSessions: {
      let pastTenseMessage;
      const count = result ? parseListedSessionCount(result.text) : void 0;
      if (count === void 0) {
        pastTenseMessage = localize("toolComplete.listSessions", "Checked sessions");
      } else if (count === 1) {
        pastTenseMessage = localize("toolComplete.listSessions.one", "Checked 1 session");
      } else {
        pastTenseMessage = localize("toolComplete.listSessions.many", "Checked {0} sessions", count);
      }
      return {
        displayName: localize("toolName.listSessions", "List Sessions"),
        invocationMessage: localize("toolInvoke.listSessions", "Checking sessions"),
        pastTenseMessage
      };
    }
    case SessionServerToolName.CreateSession:
      return {
        displayName: localize("toolName.createSession", "Create Session"),
        invocationMessage: localize("toolInvoke.createSession", "Creating session"),
        pastTenseMessage: localize("toolComplete.createSession", "Created session")
      };
    case SessionServerToolName.CreateChat:
      return {
        displayName: localize("toolName.createChat", "Create Chat"),
        invocationMessage: localize("toolInvoke.createChat", "Creating chat"),
        pastTenseMessage: localize("toolComplete.createChat", "Created chat")
      };
    case SessionServerToolName.SendMessage:
      return {
        displayName: localize("toolName.sendMessage", "Send Message"),
        invocationMessage: localize("toolInvoke.sendMessage", "Sending message"),
        pastTenseMessage: localize("toolComplete.sendMessage", "Sent message")
      };
    case SessionServerToolName.GetSessionContext:
      return {
        displayName: localize("toolName.getSessionContext", "Get Session Context"),
        invocationMessage: localize("toolInvoke.getSessionContext", "Reading session context"),
        pastTenseMessage: localize("toolComplete.getSessionContext", "Read session context")
      };
    case SessionServerToolName.GetCurrentSession:
      return {
        displayName: localize("toolName.getCurrentSession", "Get Current Session"),
        invocationMessage: localize("toolInvoke.getCurrentSession", "Checking current session"),
        pastTenseMessage: localize("toolComplete.getCurrentSession", "Checked current session")
      };
    case SessionServerToolName.DeleteSession:
      return {
        displayName: localize("toolName.deleteSession", "Delete Session"),
        invocationMessage: localize("toolInvoke.deleteSession", "Deleting session"),
        pastTenseMessage: localize("toolComplete.deleteSession", "Deleted session")
      };
    default:
      return void 0;
  }
}
function createSessionServerToolGroup(accessor) {
  let createdSessionCount = 0;
  let createdChatCount = 0;
  let sentMessageCount = 0;
  const group = {
    definitions: sessionServerToolDefinitions,
    canRequireConfirmation(toolName) {
      return sessionToolRequiresConfirmation(toolName);
    },
    getDisplay(toolName, args, result) {
      return getSessionToolDisplay(toolName, args, result);
    },
    async execute(_stateManager, sessionUri, toolName, rawArgs) {
      if (!accessor) {
        throw new Error(`Session server tool "${toolName}" cannot run: the group was built without a session accessor.`);
      }
      switch (toolName) {
        case SessionServerToolName.ListSessions:
          return serializeSessions(filterSessions(await accessor.listSessions(), getListSessionsArgs(rawArgs)));
        case SessionServerToolName.GetCurrentSession:
          return serializeCurrentSession(currentSessionUri(sessionUri), await accessor.listSessions());
        case SessionServerToolName.CreateSession: {
          if (createdSessionCount >= maxCreatedSessions) {
            throw new Error(`Refusing to create more than ${maxCreatedSessions} sessions from server tools in this process.`);
          }
          const result = await applyCreateSessionTool(accessor, rawArgs, URI.parse(sessionUri));
          createdSessionCount++;
          return formatCreateSessionResult(result);
        }
        case SessionServerToolName.CreateChat: {
          if (createdChatCount >= maxCreatedChats) {
            throw new Error(`Refusing to create more than ${maxCreatedChats} chats from server tools in this process.`);
          }
          const result = await applyCreateChatTool(accessor, rawArgs, URI.parse(sessionUri));
          createdChatCount++;
          return formatCreateChatResult(result);
        }
        case SessionServerToolName.SendMessage: {
          if (sentMessageCount >= maxSentMessages) {
            throw new Error(`Refusing to send more than ${maxSentMessages} messages from server tools in this process.`);
          }
          const result = await applySendMessageTool(accessor, rawArgs, sessionUri);
          sentMessageCount++;
          return result;
        }
        case SessionServerToolName.GetSessionContext:
          return applyGetSessionContextTool(accessor, rawArgs);
        case SessionServerToolName.DeleteSession:
          return applyDeleteSessionTool(accessor, rawArgs, currentSessionUri(sessionUri));
        default:
          throw new Error(`Unknown session server tool: ${toolName}`);
      }
    }
  };
  return group;
}
export {
  applyCreateChatTool,
  applyCreateSessionTool,
  applyDeleteSessionTool,
  applyGetSessionContextTool,
  applySendMessageTool,
  createSessionServerToolGroup,
  currentSessionUri,
  filterSessions,
  formatCreateChatResult,
  formatCreateSessionResult,
  formatSendMessageResult,
  getCreateChatArgs,
  getCreateSessionArgs,
  getDeleteSessionArgs,
  getListSessionsArgs,
  getSendMessageArgs,
  getSessionContextArgs,
  serializeCurrentSession,
  serializeSessionContext,
  serializeSessions,
  sessionServerToolDefinitions,
  sessionToolRequiresConfirmation
};
