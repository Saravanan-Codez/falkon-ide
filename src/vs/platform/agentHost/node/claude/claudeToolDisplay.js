import { localize } from "../../../../nls.js";
import { appendEscapedMarkdownInlineCode, escapeMarkdownLinkLabel } from "../../../../base/common/htmlContent.js";
import { basename } from "../../../../base/common/resources.js";
import { truncate } from "../../../../base/common/strings.js";
import { URI } from "../../../../base/common/uri.js";
import { getStreamingCreateMessage, getStreamingEditMessage, getStreamingReplaceMessage, streamingToolTextLineCount } from "../../common/streamingToolCallDisplay.js";
import { toToolCallMeta } from "../../common/meta/agentToolCallMeta.js";
import { getServerToolDisplay } from "../shared/serverToolGroups.js";
const TOOL_ROWS = {
  // shell tools — no `language` is carried: the workbench picks
  // `'shellscript'` from the tool name (it only special-cases
  // `'powershell'`), and the SDK's `Bash` tool is the generic shell
  // entry point (bash on POSIX, Git Bash on Windows), so claiming a
  // specific dialect here would be misleading and unused.
  Bash: { permissionKind: "shell", toolKind: "terminal" },
  BashOutput: { permissionKind: "shell", toolKind: "terminal" },
  KillBash: { permissionKind: "shell", toolKind: "terminal" },
  // read tools
  Read: { permissionKind: "read", pathField: "file_path", toolKind: "read" },
  Glob: { permissionKind: "read", pathField: "path", toolKind: "search" },
  Grep: { permissionKind: "read", pathField: "path", toolKind: "search" },
  LS: { permissionKind: "read", pathField: "path" },
  NotebookRead: { permissionKind: "read", pathField: "notebook_path", toolKind: "read" },
  // write tools
  Write: { permissionKind: "write", pathField: "file_path", isFileEdit: true },
  Edit: { permissionKind: "write", pathField: "file_path", isFileEdit: true },
  MultiEdit: { permissionKind: "write", pathField: "file_path", isFileEdit: true },
  NotebookEdit: { permissionKind: "write", pathField: "notebook_path", isFileEdit: true },
  TodoWrite: { permissionKind: "write" },
  // network tools
  WebFetch: { permissionKind: "url", pathField: "url" },
  // host-routed / custom
  Task: { permissionKind: "custom-tool", toolKind: "subagent" },
  Agent: { permissionKind: "custom-tool", toolKind: "subagent" },
  ExitPlanMode: { permissionKind: "custom-tool", interactive: true },
  AskUserQuestion: { permissionKind: "custom-tool", interactive: true },
  // skill + task-list family — host-routed custom tools that render in the
  // generic tool renderer (no `toolKind`) but carry rich invocation /
  // past-tense messages so their collapsed row is self-explanatory.
  Skill: { permissionKind: "skill" },
  TaskCreate: { permissionKind: "custom-tool" },
  TaskUpdate: { permissionKind: "custom-tool" },
  TaskList: { permissionKind: "custom-tool" },
  TaskGet: { permissionKind: "custom-tool" }
};
const MCP_TOOL_PREFIX = "mcp__";
function getClaudePermissionKind(toolName) {
  const row = TOOL_ROWS[toolName];
  if (row) {
    return row.permissionKind;
  }
  if (toolName.startsWith(MCP_TOOL_PREFIX)) {
    return "mcp";
  }
  return "custom-tool";
}
function getClaudeToolDisplayName(toolName) {
  const serverDisplay = getServerToolDisplay(toolName, void 0)?.displayName;
  if (serverDisplay !== void 0) {
    return serverDisplay;
  }
  switch (toolName) {
    case "Bash":
      return localize("claude.tool.bash", "Run shell command");
    case "BashOutput":
      return localize("claude.tool.bashOutput", "Read shell output");
    case "KillBash":
      return localize("claude.tool.killBash", "Kill shell command");
    case "Read":
      return localize("claude.tool.read", "Read file");
    case "Glob":
      return localize("claude.tool.glob", "Find files");
    case "Grep":
      return localize("claude.tool.grep", "Search files");
    case "LS":
      return localize("claude.tool.ls", "List directory");
    case "NotebookRead":
      return localize("claude.tool.notebookRead", "Read notebook");
    case "Write":
      return localize("claude.tool.write", "Write file");
    case "Edit":
      return localize("claude.tool.edit", "Edit file");
    case "MultiEdit":
      return localize("claude.tool.multiEdit", "Edit file");
    case "NotebookEdit":
      return localize("claude.tool.notebookEdit", "Edit notebook");
    case "TodoWrite":
      return localize("claude.tool.todoWrite", "Update todo list");
    case "WebFetch":
      return localize("claude.tool.webFetch", "Fetch URL");
    case "Task":
    case "Agent":
      return localize("claude.tool.task", "Run subagent task");
    case "ExitPlanMode":
      return localize("claude.tool.exitPlanMode", "Ready to code?");
    case "AskUserQuestion":
      return localize("claude.tool.askUserQuestion", "Ask user a question");
    case "Skill":
      return localize("claude.tool.skill", "Run skill");
    case "TaskCreate":
      return localize("claude.tool.taskCreate", "Create task");
    case "TaskUpdate":
      return localize("claude.tool.taskUpdate", "Update task");
    case "TaskList":
      return localize("claude.tool.taskList", "List tasks");
    case "TaskGet":
      return localize("claude.tool.taskGet", "Read task");
  }
  if (toolName.startsWith(MCP_TOOL_PREFIX)) {
    return localize("claude.tool.mcp", "Run MCP tool {0}", toolName.slice(MCP_TOOL_PREFIX.length));
  }
  return toolName;
}
function getClaudeToolPath(toolName, input) {
  const row = TOOL_ROWS[toolName];
  if (!row?.pathField || typeof input !== "object" || input === null) {
    return void 0;
  }
  const value = input[row.pathField];
  return typeof value === "string" ? value : void 0;
}
function isClaudeFileEditTool(toolName) {
  return TOOL_ROWS[toolName]?.isFileEdit === true;
}
const INTERACTIVE_CLAUDE_TOOLS = new Set(
  Object.entries(TOOL_ROWS).filter(([, row]) => row.interactive).map(([name]) => name)
);
function getClaudeConfirmationTitle(toolName) {
  switch (getClaudePermissionKind(toolName)) {
    case "shell":
      return localize("claude.permission.shell.title", "Run in terminal?");
    case "write":
      return localize("claude.permission.write.title", "Edit file?");
    case "read":
      return localize("claude.permission.read.title", "Read file?");
    case "url":
      return localize("claude.permission.url.title", "Fetch URL?");
    case "skill":
      return localize("claude.permission.skill.title", "Run skill?");
    case "mcp": {
      const serverName = toolName.startsWith(MCP_TOOL_PREFIX) ? toolName.slice(MCP_TOOL_PREFIX.length).split("__")[0] : void 0;
      return serverName ? localize("claude.permission.mcp.title", "Allow tool from {0}?", serverName) : localize("claude.permission.default.title", "Allow tool call?");
    }
    case "custom-tool":
    default:
      return localize("claude.permission.default.title", "Allow tool call?");
  }
}
function getClaudeToolKind(toolName) {
  return TOOL_ROWS[toolName]?.toolKind;
}
function buildClaudeToolMeta(toolName) {
  const meta = buildClaudeToolCallMeta(toolName);
  return meta ? toToolCallMeta(meta) : void 0;
}
function buildClaudeToolCallMeta(toolName) {
  const row = TOOL_ROWS[toolName];
  if (!row?.toolKind) {
    return void 0;
  }
  return { toolKind: row.toolKind };
}
function md(value) {
  return { markdown: value };
}
function formatPathAsMarkdownLink(path) {
  const uri = URI.file(path);
  return `[${escapeMarkdownLinkLabel(basename(uri))}](${uri})`;
}
function readStringField(input, field) {
  if (input === null || typeof input !== "object") {
    return void 0;
  }
  const value = input[field];
  return typeof value === "string" && value.length > 0 ? value : void 0;
}
function firstShellLine(input) {
  const command = readStringField(input, "command");
  return command ? command.split("\n")[0] : void 0;
}
function readTaskUpdateStatus(input) {
  const status = readStringField(input, "status");
  return status === "in_progress" || status === "completed" || status === "deleted" ? status : void 0;
}
function getClaudeInvocationMessage(toolName, displayName, input) {
  const serverDisplay = getServerToolDisplay(toolName, input)?.invocationMessage;
  if (serverDisplay !== void 0) {
    return serverDisplay;
  }
  switch (toolName) {
    case "Bash": {
      const firstLine = firstShellLine(input);
      if (firstLine) {
        return md(localize("claude.toolInvoke.bashCmd", "Running {0}", appendEscapedMarkdownInlineCode(truncate(firstLine, 80))));
      }
      return localize("claude.toolInvoke.bash", "Running shell command");
    }
    case "BashOutput":
      return localize("claude.toolInvoke.bashOutput", "Reading shell output");
    case "KillBash":
      return localize("claude.toolInvoke.killBash", "Killing shell command");
    case "Read":
    case "NotebookRead": {
      const path = getClaudeToolPath(toolName, input);
      if (path) {
        return md(localize("claude.toolInvoke.readFile", "Reading {0}", formatPathAsMarkdownLink(path)));
      }
      return localize("claude.toolInvoke.read", "Reading file");
    }
    case "LS": {
      const path = getClaudeToolPath(toolName, input);
      if (path) {
        return md(localize("claude.toolInvoke.lsPath", "Listing {0}", formatPathAsMarkdownLink(path)));
      }
      return localize("claude.toolInvoke.ls", "Listing directory");
    }
    case "Write":
    case "Edit":
    case "MultiEdit":
    case "NotebookEdit": {
      const path = getClaudeToolPath(toolName, input);
      if (path) {
        return md(localize("claude.toolInvoke.editFile", "Editing {0}", formatPathAsMarkdownLink(path)));
      }
      return localize("claude.toolInvoke.edit", "Editing file");
    }
    case "TodoWrite":
      return localize("claude.toolInvoke.todoWrite", "Updating todo list");
    case "Grep": {
      const pattern = readStringField(input, "pattern");
      if (pattern) {
        return md(localize("claude.toolInvoke.grepPattern", "Searching for {0}", appendEscapedMarkdownInlineCode(truncate(pattern, 80))));
      }
      return localize("claude.toolInvoke.grep", "Searching files");
    }
    case "Glob": {
      const pattern = readStringField(input, "pattern");
      if (pattern) {
        return md(localize("claude.toolInvoke.globPattern", "Finding files matching {0}", appendEscapedMarkdownInlineCode(truncate(pattern, 80))));
      }
      return localize("claude.toolInvoke.glob", "Finding files");
    }
    case "WebFetch": {
      const url = readStringField(input, "url");
      if (url) {
        return md(localize("claude.toolInvoke.webFetch", "Fetching {0}", `[${escapeMarkdownLinkLabel(truncate(url, 80))}](${url})`));
      }
      return localize("claude.toolInvoke.webFetchGeneric", "Fetching URL");
    }
    case "Task":
    case "Agent": {
      const description = readStringField(input, "description");
      if (description) {
        return description;
      }
      return displayName;
    }
    case "Skill": {
      const skill = readStringField(input, "skill");
      if (skill) {
        return md(localize("claude.toolInvoke.skillNamed", "Running skill {0}", appendEscapedMarkdownInlineCode(truncate(skill, 80))));
      }
      return localize("claude.toolInvoke.skill", "Running skill");
    }
    case "TaskCreate": {
      const subject = readStringField(input, "subject");
      if (subject) {
        return localize("claude.toolInvoke.taskCreateNamed", "Creating task: {0}", truncate(subject, 80));
      }
      return localize("claude.toolInvoke.taskCreate", "Creating task");
    }
    case "TaskUpdate":
      switch (readTaskUpdateStatus(input)) {
        case "in_progress":
          return localize("claude.toolInvoke.taskStart", "Starting task");
        case "completed":
          return localize("claude.toolInvoke.taskComplete", "Completing task");
        case "deleted":
          return localize("claude.toolInvoke.taskDelete", "Deleting task");
        default:
          return localize("claude.toolInvoke.taskUpdate", "Updating task");
      }
    case "TaskList":
      return localize("claude.toolInvoke.taskList", "Reading task list");
    case "TaskGet":
      return localize("claude.toolInvoke.taskGet", "Reading task");
    default:
      return displayName;
  }
}
function getClaudeStreamingInvocationMessage(toolName, input) {
  switch (toolName) {
    case "Write":
      return getStreamingCreateMessage(input?.["file_path"], streamingToolTextLineCount(input?.["content"]));
    case "Edit":
      return getStreamingReplaceMessage(
        input?.["file_path"],
        streamingToolTextLineCount(input?.["old_string"]),
        streamingToolTextLineCount(input?.["new_string"])
      );
    case "MultiEdit": {
      const edits = Array.isArray(input?.["edits"]) ? input["edits"] : [];
      let oldLineCount;
      let newLineCount;
      for (const edit of edits) {
        if (!edit || typeof edit !== "object" || Array.isArray(edit)) {
          continue;
        }
        const oldLines = streamingToolTextLineCount(edit["old_string"]);
        const newLines = streamingToolTextLineCount(edit["new_string"]);
        if (oldLines !== void 0) {
          oldLineCount = (oldLineCount ?? 0) + oldLines;
        }
        if (newLines !== void 0) {
          newLineCount = (newLineCount ?? 0) + newLines;
        }
      }
      return getStreamingReplaceMessage(input?.["file_path"], oldLineCount, newLineCount);
    }
    case "NotebookEdit":
      return getStreamingEditMessage(input?.["notebook_path"], streamingToolTextLineCount(input?.["new_source"]));
    default:
      return void 0;
  }
}
function getClaudePastTenseMessage(toolName, displayName, input, success, resultText) {
  if (!success) {
    return localize("claude.toolComplete.failed", '"{0}" failed', displayName);
  }
  const serverDisplay = getServerToolDisplay(toolName, input, { text: resultText, success })?.pastTenseMessage;
  if (serverDisplay !== void 0) {
    return serverDisplay;
  }
  switch (toolName) {
    case "Bash": {
      const firstLine = firstShellLine(input);
      if (firstLine) {
        return md(localize("claude.toolComplete.bashCmd", "Ran {0}", appendEscapedMarkdownInlineCode(truncate(firstLine, 80))));
      }
      return localize("claude.toolComplete.bash", "Ran shell command");
    }
    case "BashOutput":
      return localize("claude.toolComplete.bashOutput", "Read shell output");
    case "KillBash":
      return localize("claude.toolComplete.killBash", "Killed shell command");
    case "Read":
    case "NotebookRead": {
      const path = getClaudeToolPath(toolName, input);
      if (path) {
        return md(localize("claude.toolComplete.readFile", "Read {0}", formatPathAsMarkdownLink(path)));
      }
      return localize("claude.toolComplete.read", "Read file");
    }
    case "LS": {
      const path = getClaudeToolPath(toolName, input);
      if (path) {
        return md(localize("claude.toolComplete.lsPath", "Listed {0}", formatPathAsMarkdownLink(path)));
      }
      return localize("claude.toolComplete.ls", "Listed directory");
    }
    case "Write":
    case "Edit":
    case "MultiEdit":
    case "NotebookEdit": {
      const path = getClaudeToolPath(toolName, input);
      if (path) {
        return md(localize("claude.toolComplete.editFile", "Edited {0}", formatPathAsMarkdownLink(path)));
      }
      return localize("claude.toolComplete.edit", "Edited file");
    }
    case "TodoWrite":
      return localize("claude.toolComplete.todoWrite", "Updated todo list");
    case "Grep": {
      const pattern = readStringField(input, "pattern");
      if (pattern) {
        return md(localize("claude.toolComplete.grepPattern", "Searched for {0}", appendEscapedMarkdownInlineCode(truncate(pattern, 80))));
      }
      return localize("claude.toolComplete.grep", "Searched files");
    }
    case "Glob": {
      const pattern = readStringField(input, "pattern");
      if (pattern) {
        return md(localize("claude.toolComplete.globPattern", "Found files matching {0}", appendEscapedMarkdownInlineCode(truncate(pattern, 80))));
      }
      return localize("claude.toolComplete.glob", "Found files");
    }
    case "WebFetch": {
      const url = readStringField(input, "url");
      if (url) {
        return md(localize("claude.toolComplete.webFetch", "Fetched {0}", `[${escapeMarkdownLinkLabel(truncate(url, 80))}](${url})`));
      }
      return localize("claude.toolComplete.webFetchGeneric", "Fetched URL");
    }
    case "Task":
    case "Agent":
      return localize("claude.toolComplete.task", "Ran subagent");
    case "Skill": {
      const skill = readStringField(input, "skill");
      if (skill) {
        return md(localize("claude.toolComplete.skillNamed", "Ran skill {0}", appendEscapedMarkdownInlineCode(truncate(skill, 80))));
      }
      return localize("claude.toolComplete.skill", "Ran skill");
    }
    case "TaskCreate": {
      const subject = readStringField(input, "subject");
      if (subject) {
        return localize("claude.toolComplete.taskCreateNamed", "Created task: {0}", truncate(subject, 80));
      }
      return localize("claude.toolComplete.taskCreate", "Created task");
    }
    case "TaskUpdate":
      switch (readTaskUpdateStatus(input)) {
        case "in_progress":
          return localize("claude.toolComplete.taskStart", "Started task");
        case "completed":
          return localize("claude.toolComplete.taskComplete", "Completed task");
        case "deleted":
          return localize("claude.toolComplete.taskDelete", "Deleted task");
        default:
          return localize("claude.toolComplete.taskUpdate", "Updated task");
      }
    case "TaskList":
      return localize("claude.toolComplete.taskList", "Read task list");
    case "TaskGet":
      return localize("claude.toolComplete.taskGet", "Read task");
    default:
      return displayName;
  }
}
function getClaudeToolInputString(toolName, input) {
  if (input === void 0) {
    return void 0;
  }
  if (toolName === "Bash" || toolName === "BashOutput" || toolName === "KillBash") {
    const command = readStringField(input, "command");
    if (command) {
      return command;
    }
  }
  if (toolName === "Grep" || toolName === "Glob") {
    const pattern = readStringField(input, "pattern");
    if (pattern) {
      return pattern;
    }
  }
  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return void 0;
  }
}
export {
  INTERACTIVE_CLAUDE_TOOLS,
  buildClaudeToolCallMeta,
  buildClaudeToolMeta,
  getClaudeConfirmationTitle,
  getClaudeInvocationMessage,
  getClaudePastTenseMessage,
  getClaudePermissionKind,
  getClaudeStreamingInvocationMessage,
  getClaudeToolDisplayName,
  getClaudeToolInputString,
  getClaudeToolKind,
  getClaudeToolPath,
  isClaudeFileEditTool
};
