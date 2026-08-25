import { ClaudeSessionConfigKey } from "../../common/claudeSessionConfigKeys.js";
import { ChatInputRequestPurpose, ChatInputResponseKind, ToolCallStatus } from "../../common/state/protocol/state.js";
import { extractServerToolName } from "./claudeServerToolMcpServer.js";
import { buildAskUserSessionInputQuestions, buildExitPlanModeConfirmationState, flattenAskUserAnswers, parseAskUserQuestionInput } from "./claudeInteractiveTools.js";
import { CLAUDE_PLAN_DECLINED_MESSAGE, CLAUDE_QUESTION_CANCELLED_MESSAGE, CLAUDE_USER_DECLINED_MESSAGE } from "./claudeToolDenial.js";
import { getClaudeConfirmationTitle, getClaudeInvocationMessage, getClaudePermissionKind, getClaudeToolDisplayName, getClaudeToolInputString, getClaudeToolPath, INTERACTIVE_CLAUDE_TOOLS, buildClaudeToolMeta } from "./claudeToolDisplay.js";
async function handleCanUseTool(deps, sessionId, toolName, input, options) {
  const session = deps.getSession(sessionId);
  if (!session) {
    return { behavior: "deny", message: "Session is no longer active" };
  }
  if (options.signal.aborted) {
    return { behavior: "deny", message: "SDK aborted the tool request" };
  }
  const abortHandler = () => {
    session.respondToPermissionRequest(options.toolUseID, false);
    session.respondToUserInputRequest(options.toolUseID, ChatInputResponseKind.Cancel);
  };
  options.signal.addEventListener("abort", abortHandler);
  try {
    return await dispatchCanUseTool(deps, session, toolName, input, options);
  } finally {
    options.signal.removeEventListener("abort", abortHandler);
  }
}
async function dispatchCanUseTool(deps, session, toolName, input, options) {
  if (INTERACTIVE_CLAUDE_TOOLS.has(toolName)) {
    return handleInteractiveTool(deps, session, toolName, input, options);
  }
  const serverToolName = extractServerToolName(toolName);
  const serverToolHost = deps.serverToolHost;
  if (serverToolName && serverToolHost?.toolNames.includes(serverToolName) && !serverToolHost.requiresConfirmation(session.chatChannelUri.toString(), serverToolName)) {
    return { behavior: "allow", updatedInput: input };
  }
  const permissionKind = getClaudePermissionKind(toolName);
  const displayName = getClaudeToolDisplayName(toolName);
  const permissionPath = options.blockedPath ?? getClaudeToolPath(toolName, input);
  const toolInputString = getClaudeToolInputString(toolName, input);
  const meta = buildClaudeToolMeta(toolName);
  const state = {
    status: ToolCallStatus.PendingConfirmation,
    toolCallId: options.toolUseID,
    toolName,
    displayName,
    invocationMessage: getClaudeInvocationMessage(toolName, displayName, input),
    toolInput: toolInputString,
    confirmationTitle: getClaudeConfirmationTitle(toolName),
    ...meta ? { _meta: meta } : {}
  };
  const parentToolCallId = resolveSubagentParent(session, options);
  const approved = await session.requestPermission({
    toolUseID: options.toolUseID,
    state,
    permissionKind,
    ...permissionPath !== void 0 ? { permissionPath } : {},
    ...parentToolCallId !== void 0 ? { parentToolCallId } : {}
  });
  return approved ? { behavior: "allow", updatedInput: input } : { behavior: "deny", message: CLAUDE_USER_DECLINED_MESSAGE };
}
function resolveSubagentParent(session, options) {
  if (!options.agentID) {
    return void 0;
  }
  const parentSpawn = session.subagents.getParentSpawn(options.toolUseID);
  if (parentSpawn) {
    parentSpawn.setAgentId(options.agentID);
    return parentSpawn.toolUseId;
  }
  return void 0;
}
function handleInteractiveTool(deps, session, toolName, input, options) {
  switch (toolName) {
    case "ExitPlanMode":
      return handleExitPlanMode(deps, session, input, options);
    case "AskUserQuestion":
      return handleAskUserQuestion(deps, session, input, options);
    default:
      return Promise.resolve({ behavior: "deny", message: `Unsupported interactive tool: ${toolName}` });
  }
}
async function handleExitPlanMode(deps, session, input, options) {
  const toolUseID = options.toolUseID;
  const parentToolCallId = resolveSubagentParent(session, options);
  const approved = await session.requestPermission({
    toolUseID,
    state: buildExitPlanModeConfirmationState(input, toolUseID),
    permissionKind: getClaudePermissionKind("ExitPlanMode"),
    ...parentToolCallId !== void 0 ? { parentToolCallId } : {}
  });
  if (approved) {
    deps.configurationService.updateSessionConfig(session.sessionUri.toString(), {
      [ClaudeSessionConfigKey.PermissionMode]: "acceptEdits"
    });
    return { behavior: "allow", updatedInput: input };
  }
  return { behavior: "deny", message: CLAUDE_PLAN_DECLINED_MESSAGE };
}
async function handleAskUserQuestion(deps, session, input, options) {
  const toolUseID = options.toolUseID;
  const askInput = parseAskUserQuestionInput(input);
  if (!askInput) {
    return { behavior: "deny", message: "AskUserQuestion called without questions" };
  }
  const parentToolCallId = resolveSubagentParent(session, options);
  const answer = await session.requestUserInput({
    id: toolUseID,
    purpose: ChatInputRequestPurpose.AskUser,
    questions: buildAskUserSessionInputQuestions(askInput)
  }, parentToolCallId);
  if (answer.response !== ChatInputResponseKind.Accept || !answer.answers) {
    return { behavior: "deny", message: CLAUDE_QUESTION_CANCELLED_MESSAGE };
  }
  const answers = flattenAskUserAnswers(askInput, answer.answers);
  if (Object.keys(answers).length === 0) {
    return { behavior: "deny", message: CLAUDE_QUESTION_CANCELLED_MESSAGE };
  }
  return { behavior: "allow", updatedInput: { ...input, answers } };
}
export {
  handleCanUseTool
};
