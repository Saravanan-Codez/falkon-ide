import { hasKey } from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import { appendEscapedMarkdownInlineCode, escapeMarkdownLinkLabel, MarkdownString } from "../../../../base/common/htmlContent.js";
import { hash } from "../../../../base/common/hash.js";
import { localize } from "../../../../nls.js";
import { stripRedundantCdPrefix } from "../../common/commandLineHelpers.js";
import { parsePartialToolInput } from "../../common/partialToolInput.js";
import { basename } from "../../../../base/common/resources.js";
import { getStreamingCreateMessage, getStreamingInsertMessage, getStreamingPatchMessage, getStreamingReplaceMessage, streamingToolTextLineCount } from "../../common/streamingToolCallDisplay.js";
import { getServerToolDisplay } from "../shared/serverToolGroups.js";
var CopilotToolName = /* @__PURE__ */ ((CopilotToolName2) => {
  CopilotToolName2["StrReplaceEditor"] = "str_replace_editor";
  CopilotToolName2["StrReplace"] = "str_replace";
  CopilotToolName2["Insert"] = "insert";
  CopilotToolName2["Bash"] = "bash";
  CopilotToolName2["ReadBash"] = "read_bash";
  CopilotToolName2["WriteBash"] = "write_bash";
  CopilotToolName2["StopBash"] = "stop_bash";
  CopilotToolName2["BashShutdown"] = "bash_shutdown";
  CopilotToolName2["ListBash"] = "list_bash";
  CopilotToolName2["PowerShell"] = "powershell";
  CopilotToolName2["ReadPowerShell"] = "read_powershell";
  CopilotToolName2["WritePowerShell"] = "write_powershell";
  CopilotToolName2["StopPowerShell"] = "stop_powershell";
  CopilotToolName2["PowerShellShutdown"] = "powershell_shutdown";
  CopilotToolName2["ListPowerShell"] = "list_powershell";
  CopilotToolName2["View"] = "view";
  CopilotToolName2["Edit"] = "edit";
  CopilotToolName2["Create"] = "create";
  CopilotToolName2["Grep"] = "grep";
  CopilotToolName2["Rg"] = "rg";
  CopilotToolName2["Glob"] = "glob";
  CopilotToolName2["SearchCodeSubagent"] = "search_code_subagent";
  CopilotToolName2["ReplyToComment"] = "reply_to_comment";
  CopilotToolName2["CodeReview"] = "code_review";
  CopilotToolName2["ApplyPatch"] = "apply_patch";
  CopilotToolName2["GitApplyPatch"] = "git_apply_patch";
  CopilotToolName2["WebSearch"] = "web_search";
  CopilotToolName2["WebFetch"] = "web_fetch";
  CopilotToolName2["AskUser"] = "ask_user";
  CopilotToolName2["ReportIntent"] = "report_intent";
  CopilotToolName2["Think"] = "think";
  CopilotToolName2["ReportProgress"] = "report_progress";
  CopilotToolName2["UpdateTodo"] = "update_todo";
  CopilotToolName2["ShowFile"] = "show_file";
  CopilotToolName2["FetchCopilotCliDocumentation"] = "fetch_copilot_cli_documentation";
  CopilotToolName2["ProposeWork"] = "propose_work";
  CopilotToolName2["TaskComplete"] = "task_complete";
  CopilotToolName2["Skill"] = "skill";
  CopilotToolName2["Task"] = "task";
  CopilotToolName2["ListAgents"] = "list_agents";
  CopilotToolName2["ReadAgent"] = "read_agent";
  CopilotToolName2["ExitPlanMode"] = "exit_plan_mode";
  CopilotToolName2["Sql"] = "sql";
  CopilotToolName2["Lsp"] = "lsp";
  CopilotToolName2["CreatePullRequest"] = "create_pull_request";
  CopilotToolName2["GhAdvisoryDatabase"] = "gh-advisory-database";
  CopilotToolName2["StoreMemory"] = "store_memory";
  CopilotToolName2["ParallelValidation"] = "parallel_validation";
  CopilotToolName2["WriteAgent"] = "write_agent";
  CopilotToolName2["McpReload"] = "mcp_reload";
  CopilotToolName2["McpValidate"] = "mcp_validate";
  CopilotToolName2["ToolSearchToolRegex"] = "tool_search_tool_regex";
  CopilotToolName2["CodeqlChecker"] = "codeql_checker";
  return CopilotToolName2;
})(CopilotToolName || {});
function formatViewRange(view_range) {
  if (!Array.isArray(view_range) || view_range.length !== 2) {
    return void 0;
  }
  const [startLine, endLine] = view_range;
  if (!Number.isInteger(startLine) || !Number.isInteger(endLine)) {
    return void 0;
  }
  if (startLine < 0) {
    return void 0;
  }
  if (endLine !== -1 && endLine < startLine) {
    return void 0;
  }
  return { startLine, endLine };
}
function getAgentId(parameters) {
  const agentId = parameters?.agent_id;
  return typeof agentId === "string" && agentId.length > 0 ? agentId : void 0;
}
const APPLY_PATCH_FILE_HEADERS = [
  /^\s*\*\*\*\s+Update File:\s*(.+?)\s*$/,
  /^\s*\*\*\*\s+Add File:\s*(.+?)\s*$/,
  /^\s*\*\*\*\s+Delete File:\s*(.+?)\s*$/,
  /^\s*\*\*\*\s+Move to:\s*(.+?)\s*$/
];
function getApplyPatchFiles(args) {
  const text = typeof args === "string" ? args : args?.input ?? args?.patch;
  if (typeof text !== "string" || text.length === 0) {
    return [];
  }
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const line of text.split("\n")) {
    for (const re of APPLY_PATCH_FILE_HEADERS) {
      const m = re.exec(line);
      if (m) {
        const path = m[1];
        if (path && !seen.has(path)) {
          seen.add(path);
          out.push(path);
        }
        break;
      }
    }
  }
  return out;
}
const EDIT_TOOL_NAMES = /* @__PURE__ */ new Set([
  "edit" /* Edit */,
  "str_replace" /* StrReplace */,
  "insert" /* Insert */,
  "create" /* Create */,
  "apply_patch" /* ApplyPatch */,
  "git_apply_patch" /* GitApplyPatch */
]);
const STR_REPLACE_EDITOR_EDIT_COMMANDS = /* @__PURE__ */ new Set([
  "edit" /* Edit */,
  "str_replace" /* StrReplace */,
  "insert" /* Insert */,
  "create" /* Create */
]);
function isEditTool(toolName, command) {
  if (EDIT_TOOL_NAMES.has(toolName)) {
    return true;
  }
  if (toolName === "str_replace_editor" /* StrReplaceEditor */) {
    return command !== void 0 && STR_REPLACE_EDITOR_EDIT_COMMANDS.has(command);
  }
  return false;
}
function getEditFilePath(parameters) {
  return getEditFilePaths(parameters)[0];
}
function getEditFilePaths(parameters) {
  if (typeof parameters === "string") {
    try {
      parameters = JSON.parse(parameters);
    } catch {
      return getApplyPatchFiles(parameters);
    }
    if (typeof parameters === "string") {
      return getApplyPatchFiles(parameters);
    }
  }
  if (!parameters || typeof parameters !== "object") {
    return [];
  }
  const patchArgs = parameters;
  if (typeof patchArgs.input === "string" || typeof patchArgs.patch === "string") {
    return getApplyPatchFiles(patchArgs);
  }
  const args = parameters;
  return typeof args.path === "string" ? [args.path] : [];
}
const SHELL_TOOL_NAMES = /* @__PURE__ */ new Set([
  "bash" /* Bash */,
  "powershell" /* PowerShell */
]);
const WRITE_SHELL_TOOL_NAMES = /* @__PURE__ */ new Set([
  "write_bash" /* WriteBash */,
  "write_powershell" /* WritePowerShell */
]);
const READ_SHELL_TOOL_NAMES = /* @__PURE__ */ new Set([
  "read_bash" /* ReadBash */,
  "read_powershell" /* ReadPowerShell */
]);
const SUBAGENT_TOOL_NAMES = /* @__PURE__ */ new Set([
  "task"
]);
const SEARCH_TOOL_NAMES = /* @__PURE__ */ new Set([
  "grep" /* Grep */,
  "rg" /* Rg */,
  "glob" /* Glob */
]);
const HIDDEN_TOOL_NAMES = /* @__PURE__ */ new Set([
  "report_intent" /* ReportIntent */,
  "skill" /* Skill */
]);
function isHiddenTool(toolName) {
  return HIDDEN_TOOL_NAMES.has(toolName);
}
function isAgentCoordinationTool(toolName) {
  return toolName === "list_agents" /* ListAgents */ || toolName === "read_agent" /* ReadAgent */ || toolName === "write_agent" /* WriteAgent */;
}
function isTaskCompleteTool(toolName) {
  return toolName === "task_complete" /* TaskComplete */;
}
function getTaskCompleteSummary(parameters, toolOutput) {
  if (toolOutput && toolOutput.trim().length > 0) {
    return toolOutput;
  }
  const summary = parameters?.summary;
  return typeof summary === "string" && summary.trim().length > 0 ? summary : void 0;
}
function getTaskCompleteMarkdown(parameters, toolOutput) {
  const summary = getTaskCompleteSummary(parameters, toolOutput);
  if (!summary) {
    return void 0;
  }
  return "\n\n" + localize("toolMarkdown.taskComplete", "**Task completed:** {0}", summary);
}
function isMarkdownRenderedTool(toolName) {
  return isTaskCompleteTool(toolName);
}
function getToolMarkdownContent(toolName, parameters) {
  if (!isMarkdownRenderedTool(toolName)) {
    return void 0;
  }
  const summary = getTaskCompleteSummary(parameters, void 0);
  if (!summary) {
    return void 0;
  }
  return getTaskCompleteMarkdown(parameters, void 0);
}
function isShellTool(toolName) {
  return SHELL_TOOL_NAMES.has(toolName);
}
function getShellIntention(toolName, parameters) {
  if (isShellTool(toolName) && typeof parameters?.description === "string" && parameters.description.length > 0) {
    return parameters.description;
  }
  return void 0;
}
function truncate(text, maxLength) {
  return text.length > maxLength ? text.substring(0, maxLength - 3) + "..." : text;
}
function formatPathAsMarkdownLink(path) {
  const uri = URI.file(path);
  return `[${escapeMarkdownLinkLabel(basename(uri))}](${uri})`;
}
function formatUrlAsMarkdownLink(url) {
  return new MarkdownString().appendLink(url, truncate(url, 80)).value;
}
function md(value) {
  return { markdown: value };
}
const identityPathResolver = (path) => path;
function parseCopilotStreamingToolInput(raw) {
  return parsePartialToolInput(raw) ?? raw;
}
function getToolDisplayName(toolName) {
  const serverDisplay = getServerToolDisplay(toolName, void 0)?.displayName;
  if (serverDisplay !== void 0) {
    return serverDisplay;
  }
  switch (toolName) {
    case "str_replace_editor" /* StrReplaceEditor */:
    case "edit" /* Edit */:
    case "str_replace" /* StrReplace */:
    case "insert" /* Insert */:
      return localize("toolName.edit", "Edit File");
    case "create" /* Create */:
      return localize("toolName.create", "Create File");
    case "view" /* View */:
      return localize("toolName.read", "Read");
    case "bash" /* Bash */:
    case "powershell" /* PowerShell */:
      return localize("toolName.shell", "Run Shell Command");
    case "read_bash" /* ReadBash */:
    case "read_powershell" /* ReadPowerShell */:
      return localize("toolName.readTerminal", "Read Terminal");
    case "write_bash" /* WriteBash */:
      return localize("toolName.writeBash", "Write to Bash");
    case "write_powershell" /* WritePowerShell */:
      return localize("toolName.writePowerShell", "Write to PowerShell");
    case "stop_bash" /* StopBash */:
    case "stop_powershell" /* StopPowerShell */:
    case "bash_shutdown" /* BashShutdown */:
    case "powershell_shutdown" /* PowerShellShutdown */:
      return localize("toolName.stopShell", "Stop Terminal Session");
    case "list_bash" /* ListBash */:
    case "list_powershell" /* ListPowerShell */:
      return localize("toolName.listShellSessions", "List Shell Sessions");
    case "grep" /* Grep */:
    case "rg" /* Rg */:
    case "glob" /* Glob */:
      return localize("toolName.search", "Search");
    case "search_code_subagent" /* SearchCodeSubagent */:
      return localize("toolName.searchCode", "Search Code");
    case "apply_patch" /* ApplyPatch */:
      return localize("toolName.applyPatch", "Apply Patch");
    case "git_apply_patch" /* GitApplyPatch */:
      return localize("toolName.patch", "Patch");
    case "codeql_checker" /* CodeqlChecker */:
      return localize("toolName.codeqlChecker", "CodeQL Security Scan");
    case "code_review" /* CodeReview */:
      return localize("toolName.codeReview", "Code Review");
    case "reply_to_comment" /* ReplyToComment */:
      return localize("toolName.replyToComment", "Reply to Comment");
    case "think" /* Think */:
      return localize("toolName.think", "Thinking");
    case "report_intent" /* ReportIntent */:
      return localize("toolName.reportIntent", "Report Intent");
    case "report_progress" /* ReportProgress */:
      return localize("toolName.reportProgress", "Progress update");
    case "web_search" /* WebSearch */:
      return localize("toolName.webSearch", "Web Search");
    case "web_fetch" /* WebFetch */:
      return localize("toolName.fetchWebContent", "Fetch Web Content");
    case "update_todo" /* UpdateTodo */:
      return localize("toolName.updateTodo", "Update Todo");
    case "show_file" /* ShowFile */:
      return localize("toolName.showFile", "Show File");
    case "fetch_copilot_cli_documentation" /* FetchCopilotCliDocumentation */:
      return localize("toolName.fetchCopilotCliDocumentation", "Fetch Documentation");
    case "propose_work" /* ProposeWork */:
      return localize("toolName.proposeWork", "Propose Work");
    case "task_complete" /* TaskComplete */:
      return localize("toolName.taskComplete", "Task Complete");
    case "ask_user" /* AskUser */:
      return localize("toolName.askUser", "Ask User");
    case "skill" /* Skill */:
      return localize("toolName.invokeSkill", "Invoke Skill");
    case "task" /* Task */:
      return localize("toolName.task", "Delegate Task");
    case "list_agents" /* ListAgents */:
      return localize("toolName.listAgents", "List Agents");
    case "read_agent" /* ReadAgent */:
      return localize("toolName.readAgent", "Read Agent");
    case "exit_plan_mode" /* ExitPlanMode */:
      return localize("toolName.exitPlanModeFull", "Exit Plan Mode");
    case "sql" /* Sql */:
      return localize("toolName.sql", "Execute SQL");
    case "lsp" /* Lsp */:
      return localize("toolName.lsp", "Language Server");
    case "create_pull_request" /* CreatePullRequest */:
      return localize("toolName.createPullRequest", "Create Pull Request");
    case "gh-advisory-database" /* GhAdvisoryDatabase */:
      return localize("toolName.ghAdvisoryDatabase", "Check Dependencies");
    case "store_memory" /* StoreMemory */:
      return localize("toolName.storeMemory", "Store Memory");
    case "parallel_validation" /* ParallelValidation */:
      return localize("toolName.parallelValidation", "Validate Changes");
    case "write_agent" /* WriteAgent */:
      return localize("toolName.writeAgent", "Write to Agent");
    case "mcp_reload" /* McpReload */:
      return localize("toolName.mcpReload", "Reload MCP Config");
    case "mcp_validate" /* McpValidate */:
      return localize("toolName.mcpValidate", "Validate MCP Config");
    case "tool_search_tool_regex" /* ToolSearchToolRegex */:
      return localize("toolName.toolSearchToolRegex", "Search Tools");
    default:
      return toolName;
  }
}
function getInvocationMessage(toolName, displayName, parameters, resolvePath = identityPathResolver) {
  const serverDisplay = getServerToolDisplay(toolName, parameters)?.invocationMessage;
  if (serverDisplay !== void 0) {
    return serverDisplay;
  }
  if (SHELL_TOOL_NAMES.has(toolName)) {
    const args = parameters;
    if (args?.command) {
      const firstLine = args.command.split("\n")[0];
      return md(localize("toolInvoke.shellCmd", "Running {0}", appendEscapedMarkdownInlineCode(truncate(firstLine, 80))));
    }
    return localize("toolInvoke.shell", "Running {0} command", displayName);
  }
  if (WRITE_SHELL_TOOL_NAMES.has(toolName)) {
    const args = parameters;
    if (args?.command) {
      const firstLine = args.command.split("\n")[0];
      return md(localize("toolInvoke.writeShellCmd", "Sending {0} to shell", appendEscapedMarkdownInlineCode(truncate(firstLine, 80))));
    }
    return localize("toolInvoke.writeShell", "Sending input to shell");
  }
  if (READ_SHELL_TOOL_NAMES.has(toolName)) {
    return localize("toolInvoke.readTerminal", "Reading Terminal");
  }
  switch (toolName) {
    case "view" /* View */: {
      const args = parameters;
      if (typeof args?.path === "string" && args.path) {
        const link = formatPathAsMarkdownLink(resolvePath(args.path));
        const range = formatViewRange(args.view_range);
        if (range) {
          if (range.endLine === -1) {
            return md(localize("toolInvoke.viewFileFromLine", "Reading {0}, line {1} to the end", link, range.startLine));
          }
          if (range.endLine !== range.startLine) {
            return md(localize("toolInvoke.viewFileRange", "Reading {0}, lines {1} to {2}", link, range.startLine, range.endLine));
          }
          return md(localize("toolInvoke.viewFileLine", "Reading {0}, line {1}", link, range.startLine));
        }
        return md(localize("toolInvoke.viewFile", "Reading {0}", link));
      }
      return localize("toolInvoke.view", "Reading file");
    }
    case "edit" /* Edit */:
    case "str_replace" /* StrReplace */: {
      const args = parameters;
      if (typeof args?.path === "string" && args.path) {
        return md(localize("toolInvoke.editFile", "Editing {0}", formatPathAsMarkdownLink(resolvePath(args.path))));
      }
      return localize("toolInvoke.edit", "Editing file");
    }
    case "insert" /* Insert */: {
      const args = parameters;
      if (typeof args?.path === "string" && args.path) {
        return md(localize("toolInvoke.insertFile", "Inserting text in {0}", formatPathAsMarkdownLink(resolvePath(args.path))));
      }
      return localize("toolInvoke.insert", "Inserting text");
    }
    case "create" /* Create */: {
      const args = parameters;
      if (typeof args?.path === "string" && args.path) {
        return md(localize("toolInvoke.createFile", "Creating {0}", formatPathAsMarkdownLink(resolvePath(args.path))));
      }
      return localize("toolInvoke.create", "Creating file");
    }
    case "str_replace_editor" /* StrReplaceEditor */: {
      const command = parameters?.command;
      switch (command) {
        case "view":
          return getInvocationMessage("view" /* View */, displayName, parameters, resolvePath);
        case "create":
          return getInvocationMessage("create" /* Create */, displayName, parameters, resolvePath);
        case "insert":
          return getInvocationMessage("insert" /* Insert */, displayName, parameters, resolvePath);
        case "edit":
        case "str_replace":
        default:
          return getInvocationMessage("edit" /* Edit */, displayName, parameters, resolvePath);
      }
    }
    case "grep" /* Grep */: {
      const args = parameters;
      if (args?.pattern) {
        return md(localize("toolInvoke.grepPattern", "Searching for {0}", appendEscapedMarkdownInlineCode(truncate(args.pattern, 80))));
      }
      return localize("toolInvoke.grep", "Searching files");
    }
    case "rg" /* Rg */: {
      const args = parameters;
      if (args?.pattern) {
        return md(localize("toolInvoke.grepPattern", "Searching for {0}", appendEscapedMarkdownInlineCode(truncate(args.pattern, 80))));
      }
      return localize("toolInvoke.grep", "Searching files");
    }
    case "glob" /* Glob */: {
      const args = parameters;
      if (args?.pattern) {
        return md(localize("toolInvoke.globPattern", "Finding files matching {0}", appendEscapedMarkdownInlineCode(truncate(args.pattern, 80))));
      }
      return localize("toolInvoke.glob", "Finding files");
    }
    case "apply_patch" /* ApplyPatch */:
    case "git_apply_patch" /* GitApplyPatch */: {
      const files = getEditFilePaths(parameters).map(resolvePath);
      if (files.length === 1) {
        return md(localize("toolInvoke.patchFile", "Editing {0}", formatPathAsMarkdownLink(files[0])));
      }
      if (files.length > 1) {
        return md(localize("toolInvoke.patchFiles", "Editing {0}", files.map(formatPathAsMarkdownLink).join(", ")));
      }
      return localize("toolInvoke.patch", "Editing files");
    }
    case "sql" /* Sql */: {
      const args = parameters;
      return args?.description || localize("toolInvoke.sql", "Executing SQL query");
    }
    case "web_fetch" /* WebFetch */: {
      const args = parameters;
      if (args?.url) {
        return md(localize("toolInvoke.webFetch", "Fetching {0}", formatUrlAsMarkdownLink(args.url)));
      }
      return localize("toolInvoke.webFetchGeneric", "Fetching URL");
    }
    case "exit_plan_mode" /* ExitPlanMode */:
      return localize("toolInvoke.exitPlanMode", "Presenting plan");
    case "task" /* Task */:
      return localize("toolInvoke.task", "Delegating task");
    // The agent-coordination tools (list/read/write agents) are fast, so
    // they use a single message for both the running and completed states:
    // the past-tense phrasing. See getPastTenseMessage.
    case "list_agents" /* ListAgents */:
    case "read_agent" /* ReadAgent */:
    case "write_agent" /* WriteAgent */:
      return getPastTenseMessage(toolName, displayName, parameters, true);
    default:
      return displayName;
  }
}
function getStreamingInvocationMessage(toolName, displayName, parameters, resolvePath = identityPathResolver) {
  const objectParameters = parameters !== null && typeof parameters === "object" && !Array.isArray(parameters) ? parameters : void 0;
  switch (toolName) {
    case "edit" /* Edit */:
    case "str_replace" /* StrReplace */: {
      const args = objectParameters;
      return getStreamingReplaceMessage(args?.path, streamingToolTextLineCount(args?.old_str), streamingToolTextLineCount(args?.new_str), resolvePath);
    }
    case "create" /* Create */: {
      const args = objectParameters;
      return getStreamingCreateMessage(args?.path, streamingToolTextLineCount(args?.file_text), resolvePath);
    }
    case "insert" /* Insert */: {
      const args = objectParameters;
      return getStreamingInsertMessage(args?.path, streamingToolTextLineCount(args?.new_str), resolvePath);
    }
    case "str_replace_editor" /* StrReplaceEditor */: {
      const args = objectParameters;
      const command = args?.command;
      switch (command) {
        case "view":
          return getInvocationMessage("view" /* View */, displayName, objectParameters, resolvePath);
        case "create":
          return getStreamingCreateMessage(args?.path, streamingToolTextLineCount(args?.file_text), resolvePath);
        case "insert":
          return getStreamingInsertMessage(args?.path, streamingToolTextLineCount(args?.new_str), resolvePath);
        case "edit":
        case "str_replace":
        default:
          return getStreamingReplaceMessage(args?.path, streamingToolTextLineCount(args?.old_str), streamingToolTextLineCount(args?.new_str), resolvePath);
      }
    }
    case "apply_patch" /* ApplyPatch */:
    case "git_apply_patch" /* GitApplyPatch */: {
      const args = objectParameters;
      const patch = typeof parameters === "string" ? parameters : args?.input ?? args?.patch;
      return getStreamingPatchMessage(getEditFilePaths(parameters), streamingToolTextLineCount(patch), resolvePath);
    }
    default:
      return getInvocationMessage(toolName, displayName, objectParameters, resolvePath);
  }
}
function getPastTenseMessage(toolName, displayName, parameters, success, resultText, resolvePath = identityPathResolver) {
  if (!success) {
    return localize("toolComplete.failed", '"{0}" failed', displayName);
  }
  const serverDisplay = getServerToolDisplay(toolName, parameters, { text: resultText, success })?.pastTenseMessage;
  if (serverDisplay !== void 0) {
    return serverDisplay;
  }
  if (SHELL_TOOL_NAMES.has(toolName)) {
    const args = parameters;
    if (args?.command) {
      const firstLine = args.command.split("\n")[0];
      return md(localize("toolComplete.shellCmd", "Ran {0}", appendEscapedMarkdownInlineCode(truncate(firstLine, 80))));
    }
    return localize("toolComplete.shell", "Ran {0} command", displayName);
  }
  if (WRITE_SHELL_TOOL_NAMES.has(toolName)) {
    const args = parameters;
    if (args?.command) {
      const firstLine = args.command.split("\n")[0];
      return md(localize("toolComplete.writeShellCmd", "Sent {0} to shell", appendEscapedMarkdownInlineCode(truncate(firstLine, 80))));
    }
    return localize("toolComplete.writeShell", "Sent input to shell");
  }
  if (READ_SHELL_TOOL_NAMES.has(toolName)) {
    return localize("toolComplete.readTerminal", "Read Terminal");
  }
  switch (toolName) {
    case "view" /* View */: {
      const args = parameters;
      if (typeof args?.path === "string" && args.path) {
        const link = formatPathAsMarkdownLink(resolvePath(args.path));
        const range = formatViewRange(args.view_range);
        if (range) {
          if (range.endLine === -1) {
            return md(localize("toolComplete.viewFileFromLine", "Read {0}, line {1} to the end", link, range.startLine));
          }
          if (range.endLine !== range.startLine) {
            return md(localize("toolComplete.viewFileRange", "Read {0}, lines {1} to {2}", link, range.startLine, range.endLine));
          }
          return md(localize("toolComplete.viewFileLine", "Read {0}, line {1}", link, range.startLine));
        }
        return md(localize("toolComplete.viewFile", "Read {0}", link));
      }
      return localize("toolComplete.view", "Read file");
    }
    case "edit" /* Edit */:
    case "str_replace" /* StrReplace */: {
      const args = parameters;
      if (typeof args?.path === "string" && args.path) {
        return md(localize("toolComplete.editFile", "Edited {0}", formatPathAsMarkdownLink(resolvePath(args.path))));
      }
      return localize("toolComplete.edit", "Edited file");
    }
    case "insert" /* Insert */: {
      const args = parameters;
      if (typeof args?.path === "string" && args.path) {
        return md(localize("toolComplete.insertFile", "Inserted text in {0}", formatPathAsMarkdownLink(resolvePath(args.path))));
      }
      return localize("toolComplete.insert", "Inserted text");
    }
    case "create" /* Create */: {
      const args = parameters;
      if (typeof args?.path === "string" && args.path) {
        return md(localize("toolComplete.createFile", "Created {0}", formatPathAsMarkdownLink(resolvePath(args.path))));
      }
      return localize("toolComplete.create", "Created file");
    }
    case "str_replace_editor" /* StrReplaceEditor */: {
      const command = parameters?.command;
      switch (command) {
        case "view":
          return getPastTenseMessage("view" /* View */, displayName, parameters, success, resultText, resolvePath);
        case "create":
          return getPastTenseMessage("create" /* Create */, displayName, parameters, success, resultText, resolvePath);
        case "insert":
          return getPastTenseMessage("insert" /* Insert */, displayName, parameters, success, resultText, resolvePath);
        case "edit":
        case "str_replace":
        default:
          return getPastTenseMessage("edit" /* Edit */, displayName, parameters, success, resultText, resolvePath);
      }
    }
    case "grep" /* Grep */: {
      const args = parameters;
      if (args?.pattern) {
        return md(localize("toolComplete.grepPattern", "Searched for {0}", appendEscapedMarkdownInlineCode(truncate(args.pattern, 80))));
      }
      return localize("toolComplete.grep", "Searched files");
    }
    case "rg" /* Rg */: {
      const args = parameters;
      if (args?.pattern) {
        return md(localize("toolComplete.grepPattern", "Searched for {0}", appendEscapedMarkdownInlineCode(truncate(args.pattern, 80))));
      }
      return localize("toolComplete.grep", "Searched files");
    }
    case "glob" /* Glob */: {
      const args = parameters;
      if (args?.pattern) {
        return md(localize("toolComplete.globPattern", "Found files matching {0}", appendEscapedMarkdownInlineCode(truncate(args.pattern, 80))));
      }
      return localize("toolComplete.glob", "Found files");
    }
    case "apply_patch" /* ApplyPatch */:
    case "git_apply_patch" /* GitApplyPatch */: {
      const files = getEditFilePaths(parameters).map(resolvePath);
      if (files.length === 1) {
        return md(localize("toolComplete.patchFile", "Edited {0}", formatPathAsMarkdownLink(files[0])));
      }
      if (files.length > 1) {
        return md(localize("toolComplete.patchFiles", "Edited {0}", files.map(formatPathAsMarkdownLink).join(", ")));
      }
      return localize("toolComplete.patch", "Edited files");
    }
    case "sql" /* Sql */: {
      const args = parameters;
      return args?.description || localize("toolComplete.sql", "Executed SQL query");
    }
    case "web_fetch" /* WebFetch */: {
      const args = parameters;
      if (args?.url) {
        return md(localize("toolComplete.webFetch", "Fetched {0}", formatUrlAsMarkdownLink(args.url)));
      }
      return localize("toolComplete.webFetchGeneric", "Fetched URL");
    }
    case "exit_plan_mode" /* ExitPlanMode */:
      return localize("toolComplete.exitPlanMode", "Exited plan mode");
    case "task" /* Task */:
      return localize("toolComplete.task", "Delegated task");
    case "list_agents" /* ListAgents */:
      return localize("toolComplete.listAgents", "Listed agents");
    case "read_agent" /* ReadAgent */: {
      const agentId = getAgentId(parameters);
      if (agentId) {
        return md(localize("toolComplete.readAgent", "Read agent {0}", appendEscapedMarkdownInlineCode(agentId)));
      }
      return localize("toolComplete.readAgentGeneric", "Read agent");
    }
    case "write_agent" /* WriteAgent */: {
      const agentId = getAgentId(parameters);
      if (agentId) {
        return md(localize("toolComplete.writeAgent", "Wrote to agent {0}", appendEscapedMarkdownInlineCode(agentId)));
      }
      return localize("toolComplete.writeAgentGeneric", "Wrote to agent");
    }
    default:
      return displayName;
  }
}
function getSkillSyntheticToolCallId(eventId, data) {
  if (eventId) {
    return `synth-skill-${eventId}`;
  }
  return `synth-skill-${hash(data.path).toString(16)}`;
}
function synthesizeSkillToolCall(data, eventId) {
  const toolCallId = getSkillSyntheticToolCallId(eventId, data);
  const displayName = localize("toolName.skill", "Read Skill");
  const escapedName = escapeMarkdownLinkLabel(data.name);
  const skillLink = `[${escapedName}](${URI.file(data.path)})`;
  const invocationMessage = md(localize("toolInvoke.skill", "Reading skill {0}", skillLink));
  const pastTenseMessage = md(localize("toolComplete.skill", "Read skill {0}", skillLink));
  return {
    toolCallId,
    toolName: "skill" /* Skill */,
    displayName,
    invocationMessage,
    pastTenseMessage
  };
}
function getToolInputString(toolName, parameters, rawArguments) {
  if (!parameters && !rawArguments) {
    return void 0;
  }
  if (SHELL_TOOL_NAMES.has(toolName) || WRITE_SHELL_TOOL_NAMES.has(toolName)) {
    const args = parameters;
    const command = args?.command ?? args?.args;
    if (typeof command === "string") {
      return command;
    }
    if (typeof command === "object" && command !== null && hasKey(command, { command: true })) {
      return command.command;
    }
    return rawArguments;
  }
  switch (toolName) {
    case "grep" /* Grep */: {
      const args = parameters;
      return args?.pattern ?? rawArguments;
    }
    case "rg" /* Rg */: {
      const args = parameters;
      return args?.pattern ?? rawArguments;
    }
    case "web_fetch" /* WebFetch */: {
      const args = parameters;
      return args?.url ?? rawArguments;
    }
    default:
      if (parameters) {
        try {
          return JSON.stringify(parameters, null, 2);
        } catch {
          return rawArguments;
        }
      }
      return rawArguments;
  }
}
function getToolKind(toolName, parameters) {
  if (SHELL_TOOL_NAMES.has(toolName)) {
    return "terminal";
  }
  if (SUBAGENT_TOOL_NAMES.has(toolName)) {
    return "subagent";
  }
  if (SEARCH_TOOL_NAMES.has(toolName)) {
    return "search";
  }
  if (toolName === "view" /* View */ || toolName === "str_replace_editor" /* StrReplaceEditor */ && parameters?.["command"] === "view") {
    return "read";
  }
  return void 0;
}
function getSubagentMetadata(parameters) {
  if (!parameters) {
    return {};
  }
  const agentName = typeof parameters.agent_type === "string" && parameters.agent_type.length > 0 ? parameters.agent_type : void 0;
  const description = typeof parameters.description === "string" && parameters.description.length > 0 ? parameters.description : void 0;
  return { agentName, description };
}
function getShellLanguage(toolName) {
  switch (toolName) {
    case "powershell" /* PowerShell */:
    case "write_powershell" /* WritePowerShell */:
    case "read_powershell" /* ReadPowerShell */:
      return "powershell";
    default:
      return "shellscript";
  }
}
function tryStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return void 0;
  }
}
function str(value) {
  return typeof value === "string" ? value : void 0;
}
function getPermissionDisplay(request, workingDirectory, isNewFile) {
  const path = request.kind === "read" ? str(request.path) : request.kind === "write" ? str(request.fileName) : void 0;
  const fullCommandText = request.kind === "shell" ? str(request.fullCommandText) : void 0;
  const intention = request.kind === "shell" || request.kind === "write" || request.kind === "read" || request.kind === "url" ? str(request.intention) : void 0;
  const serverName = request.kind === "mcp" ? str(request.serverName) : void 0;
  const toolName = request.kind === "mcp" || request.kind === "custom-tool" || request.kind === "hook" ? str(request.toolName) : void 0;
  const requestSandboxBypass = request.kind === "shell" || request.kind === "write" || request.kind === "read" || request.kind === "url" ? request.requestSandboxBypass : void 0;
  const shellConfirmationTitle = requestSandboxBypass ? localize("copilot.permission.shell.bypass.title", "Run in terminal outside the sandbox?") : localize("copilot.permission.shell.title", "Run in terminal?");
  switch (request.kind) {
    case "shell": {
      const shellParams = fullCommandText ? { command: fullCommandText } : void 0;
      stripRedundantCdPrefix("bash" /* Bash */, shellParams, workingDirectory);
      const cleanedCommand = typeof shellParams?.command === "string" ? shellParams.command : fullCommandText;
      return {
        confirmationTitle: shellConfirmationTitle,
        invocationMessage: intention ?? getInvocationMessage("bash" /* Bash */, getToolDisplayName("bash" /* Bash */), cleanedCommand ? { command: cleanedCommand } : void 0),
        toolInput: cleanedCommand,
        permissionKind: "shell",
        permissionPath: path
      };
    }
    case "custom-tool": {
      const args = request.args;
      const sdkToolName = str(request.toolName);
      if (args && sdkToolName && isShellTool(sdkToolName) && typeof args.command === "string") {
        stripRedundantCdPrefix(sdkToolName, args, workingDirectory);
        const command = args.command;
        return {
          confirmationTitle: shellConfirmationTitle,
          invocationMessage: getInvocationMessage(sdkToolName, getToolDisplayName(sdkToolName), { command }),
          toolInput: command,
          permissionKind: "shell",
          permissionPath: path
        };
      }
      return {
        confirmationTitle: localize("copilot.permission.default.title", "Allow tool call?"),
        invocationMessage: md(localize("copilot.permission.default.message", "Allow the model to call {0}?", appendEscapedMarkdownInlineCode(toolName ?? request.kind))),
        toolInput: args ? tryStringify(args) : tryStringify(request),
        permissionKind: request.kind,
        permissionPath: path
      };
    }
    case "write": {
      const toolName2 = isNewFile ? "create" /* Create */ : "edit" /* Edit */;
      return {
        confirmationTitle: isNewFile ? localize("copilot.permission.create.title", "Create file?") : localize("copilot.permission.write.title", "Write file?"),
        invocationMessage: getInvocationMessage(toolName2, getToolDisplayName(toolName2), path ? { path } : void 0),
        toolInput: tryStringify(path ? { path } : request) ?? void 0,
        permissionKind: "write",
        permissionPath: path
      };
    }
    case "mcp": {
      const title = toolName ?? localize("copilot.permission.mcp.defaultTool", "MCP Tool");
      return {
        confirmationTitle: serverName ? localize("copilot.permission.mcp.title", "Allow tool from {0}?", serverName) : localize("copilot.permission.default.title", "Allow tool call?"),
        invocationMessage: serverName ? `${serverName}: ${title}` : title,
        toolInput: tryStringify({ serverName, toolName }) ?? void 0,
        permissionKind: "mcp",
        permissionPath: path
      };
    }
    case "read":
      return {
        confirmationTitle: localize("copilot.permission.read.title", "Allow reading file outside of workspace?"),
        invocationMessage: getInvocationMessage("view" /* View */, getToolDisplayName("view" /* View */), path ? { path } : void 0),
        permissionKind: "read",
        permissionPath: path
      };
    case "url": {
      const url = str(request.url);
      const normalizedUrl = url ? URL.canParse(url) ? new URL(url).href : url : void 0;
      return {
        confirmationTitle: localize("copilot.permission.url.title", "Fetch URL?"),
        invocationMessage: md(localize("copilot.permission.url.message", "Allow fetching web content?")),
        toolInput: normalizedUrl ? JSON.stringify({ url: normalizedUrl }) : void 0,
        permissionKind: "url"
      };
    }
    default:
      return {
        confirmationTitle: localize("copilot.permission.default.title", "Allow tool call?"),
        invocationMessage: md(localize("copilot.permission.default.message", "Allow the model to call {0}?", appendEscapedMarkdownInlineCode(toolName ?? request.kind))),
        toolInput: tryStringify(request) ?? void 0,
        permissionKind: request.kind,
        permissionPath: path
      };
  }
}
export {
  getEditFilePath,
  getEditFilePaths,
  getInvocationMessage,
  getPastTenseMessage,
  getPermissionDisplay,
  getShellIntention,
  getShellLanguage,
  getSkillSyntheticToolCallId,
  getStreamingInvocationMessage,
  getSubagentMetadata,
  getTaskCompleteMarkdown,
  getTaskCompleteSummary,
  getToolDisplayName,
  getToolInputString,
  getToolKind,
  getToolMarkdownContent,
  isAgentCoordinationTool,
  isEditTool,
  isHiddenTool,
  isMarkdownRenderedTool,
  isShellTool,
  isTaskCompleteTool,
  parseCopilotStreamingToolInput,
  synthesizeSkillToolCall,
  tryStringify
};
