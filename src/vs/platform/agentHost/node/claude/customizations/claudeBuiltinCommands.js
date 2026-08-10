import { URI } from "../../../../../base/common/uri.js";
import { localize } from "../../../../../nls.js";
import { CustomizationType } from "../../../common/state/protocol/channels-session/state.js";
import { CustomizationLoadStatus, customizationId } from "../../../common/state/sessionState.js";
const AGENT_BUILTIN_SCHEME = "agent-builtin";
const CLAUDE_BUILTIN_COMMANDS = [
  { name: "init", description: () => localize("claude.builtin.init", "(Built-In) Scan the codebase and generate a `CLAUDE.md` file with project structure, conventions, and instructions for future sessions.") },
  { name: "review", description: () => localize("claude.builtin.review", "(Built-In) Review a pull request or set of changes.") },
  { name: "security-review", description: () => localize("claude.builtin.securityReview", "(Built-In) Complete a security review of the pending changes on the current branch.") },
  { name: "code-review", description: () => localize("claude.builtin.codeReview", "(Built-In) Review the current diff for correctness bugs and reuse/simplification/efficiency cleanups at a chosen effort level (low\u2192max). Pass `--comment` to post findings as inline PR comments, or `--fix` to apply them to the working tree.") },
  { name: "simplify", description: () => localize("claude.builtin.simplify", "(Built-In) Review changed code for reuse, simplification, efficiency, and altitude cleanups, then apply the fixes. Quality only \u2014 it doesn't hunt for bugs (use `/code-review` for that).") },
  { name: "verify", description: () => localize("claude.builtin.verify", "(Built-In) Run the app and observe behavior to confirm a code change actually does what it's supposed to. Use to verify a PR, confirm a fix, or validate local changes before pushing.") },
  { name: "run", description: () => localize("claude.builtin.run", "(Built-In) Launch and drive the project's app to see a change working \u2014 run, start, or screenshot the app, or confirm a change works in the real app (not just tests).") },
  { name: "loop", description: () => localize("claude.builtin.loop", "(Built-In) Run a prompt or slash command on a recurring interval (e.g. `/loop 5m /foo`, defaults to 10m). For recurring tasks or polling status \u2014 not one-off work.") },
  { name: "claude-api", description: () => localize("claude.builtin.claudeApi", "(Built-In) Reference for the Claude API / Anthropic SDK: model IDs, pricing, params, streaming, tool use, MCP, agents, caching, token counting, migration.") },
  { name: "fewer-permission-prompts", description: () => localize("claude.builtin.fewerPermissionPrompts", "(Built-In) Scan transcripts for common read-only Bash/MCP calls and add a prioritized allowlist to project `.claude/settings.json` to reduce permission prompts.") },
  { name: "update-config", description: () => localize("claude.builtin.updateConfig", "(Built-In) Configure the Claude Code harness via `settings.json`: hooks for automated behaviors, permissions, env vars, and hook troubleshooting.") },
  { name: "keybindings-help", description: () => localize("claude.builtin.keybindingsHelp", "(Built-In) Customize keyboard shortcuts, rebind keys, add chord bindings, or modify `~/.claude/keybindings.json`.") },
  { name: "write-a-skill", description: () => localize("claude.builtin.writeASkill", "(Built-In) Author a new skill.") }
];
const CLAUDE_BUILTIN_AGENTS = [
  { name: "claude", description: () => localize("claude.builtinAgent.claude", "(Built-In) Catch-all for any task that doesn't fit a more specific agent \u2014 the default when no agent name is typed.") },
  { name: "claude-code-guide", description: () => localize("claude.builtinAgent.claudeCodeGuide", "(Built-In) Answers questions about the Claude Agent SDK, and the Claude/Anthropic API \u2014 features, hooks, slash commands, MCP servers, settings, IDE integrations, SDK agent-building, and API usage. Model: Haiku.") },
  { name: "Explore", description: () => localize("claude.builtinAgent.explore", "(Built-In) Read-only search agent for broad fan-out searches across many files when you only need the conclusion; it locates code rather than reviewing it. Model: Haiku.") },
  { name: "general-purpose", description: () => localize("claude.builtinAgent.generalPurpose", "(Built-In) General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks.") },
  { name: "Plan", description: () => localize("claude.builtinAgent.plan", "(Built-In) Software architect agent for designing implementation plans \u2014 step-by-step plans, critical files, and architectural trade-offs.") }
];
function buildBuiltinSkillsContainer(entries) {
  if (entries.length === 0) {
    return void 0;
  }
  const children = entries.map((entry) => {
    const uri = URI.from({ scheme: AGENT_BUILTIN_SCHEME, path: `/skill/${encodeURIComponent(entry.name)}` }).toString();
    return {
      type: CustomizationType.Skill,
      id: customizationId(uri),
      uri,
      name: entry.name,
      description: entry.description
    };
  });
  const containerUri = URI.from({ scheme: AGENT_BUILTIN_SCHEME, path: "/skills" }).toString();
  return {
    type: CustomizationType.Directory,
    id: customizationId(containerUri),
    uri: containerUri,
    name: "builtin",
    enabled: true,
    contents: CustomizationType.Skill,
    writable: false,
    load: { kind: CustomizationLoadStatus.Loaded },
    children
  };
}
function buildClaudeBuiltinSkillsContainer(diskSkillNames) {
  return buildBuiltinSkillsContainer(
    CLAUDE_BUILTIN_COMMANDS.filter((cmd) => !diskSkillNames.has(cmd.name)).map((cmd) => ({ name: cmd.name, description: cmd.description() }))
  );
}
function buildSdkBuiltinSkillsContainer(commands, diskSkillNames) {
  const seen = /* @__PURE__ */ new Set();
  const entries = [];
  for (const command of commands) {
    if (diskSkillNames.has(command.name) || seen.has(command.name)) {
      continue;
    }
    seen.add(command.name);
    entries.push({ name: command.name, description: command.description });
  }
  return buildBuiltinSkillsContainer(entries);
}
export {
  CLAUDE_BUILTIN_AGENTS,
  buildClaudeBuiltinSkillsContainer,
  buildSdkBuiltinSkillsContainer
};
