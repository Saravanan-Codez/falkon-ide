const COPILOT_AGENT_HOST_IDENTITY = "You are an AI assistant using Copilot CLI runtime in VS Code. You help users with software engineering tasks. When asked about your identity, you must state that you are an AI assistant using Copilot CLI runtime in VS Code.";
const COPILOT_AGENT_HOST_FILE_LINK_INSTRUCTIONS = [
  "<file_folder_and_symbol_links>",
  "Always use Markdown links when referring to existing files, folders, or symbols in the workspace. This is very important for helping the user understand your responses.",
  "- File: use the file name as the link text and the absolute filesystem path as the target, for example [foo.ts](/path/to/foo.ts).",
  "- Folder: links to folders are also supported, with an absolute path to the folder as the target, for example [src/](/path/to/src).",
  "- Symbol: link to symbols by using the containing file path with a 1-based line number as the target, for example [myMethod](/path/to/foo.ts:42).",
  "- Use `/` path separators in link targets, including on Windows (`C:/path/to/foo.ts`).",
  "- If a file path has spaces, wrap the target in angle brackets: [foo bar.ts](</path/to/foo bar.ts>).",
  "- Use absolute filesystem paths rather than `file://` URIs.",
  "- Do not provide line ranges.",
  "- Use a markdown link format every time you refer to a file, folder, or symbol, not just the first time.",
  "</file_folder_and_symbol_links>"
].join("\n");
const COPILOT_AGENT_HOST_SYSTEM_MESSAGE = {
  mode: "customize",
  sections: {
    identity: {
      action: "replace",
      content: COPILOT_AGENT_HOST_IDENTITY
    }
  }
};
const COPILOT_AGENT_HOST_WORKSPACELESS_INSTRUCTIONS = [
  "<workspaceless_chat>",
  "This is a lightweight workspace-less chat, not tied to any project or workspace. The user opens it for quick questions, navigation, and triage.",
  "",
  "- Your working directory is a SCRATCH directory for running commands and saving throwaway artifacts \u2014 it is NOT a code repository. Do not treat it as a project to build, test, or commit.",
  "- If the user points you at a real repository, prefer read-only operations: read files, search code, and inspect git metadata (branch, log, diff, status) to answer questions. Avoid modifying files or running builds, tests, linters, or installs in their working copies.",
  "- When the user wants code changes, test runs, or any work that modifies or executes against a real project, delegate it to a dedicated session rather than doing it here.",
  "</workspaceless_chat>"
].join("\n");
function fullSystemPrompt(content) {
  return { mode: "replace", content };
}
function sectionOverrides(sections) {
  return { mode: "customize", sections };
}
function appendSystemMessageContent(config, content) {
  if (config.mode === "replace") {
    return config;
  }
  const existing = config.content;
  return { ...config, content: existing ? `${existing}

${content}` : content };
}
function describeSystemMessageConfig(config) {
  if (config.mode === "replace") {
    return `mode=replace (content length ${config.content.length})`;
  }
  if (config.mode === "customize") {
    const parts = Object.entries(config.sections ?? {}).map(([name, override]) => {
      const action = override?.action;
      return `${name}:${typeof action === "function" ? "transform" : action}`;
    });
    const content = config.content ? ` +content(length ${config.content.length})` : "";
    return `mode=customize sections=[${parts.join(", ")}]${content}`;
  }
  return `mode=append (content length ${config.content?.length ?? 0})`;
}
export {
  COPILOT_AGENT_HOST_FILE_LINK_INSTRUCTIONS,
  COPILOT_AGENT_HOST_IDENTITY,
  COPILOT_AGENT_HOST_SYSTEM_MESSAGE,
  COPILOT_AGENT_HOST_WORKSPACELESS_INSTRUCTIONS,
  appendSystemMessageContent,
  describeSystemMessageConfig,
  fullSystemPrompt,
  sectionOverrides
};
