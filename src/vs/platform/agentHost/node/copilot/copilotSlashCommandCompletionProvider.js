import { AgentSession } from "../../common/agentService.js";
import { CompletionItemKind } from "../../common/state/protocol/commands.js";
import { CustomizationType, MessageAttachmentKind } from "../../common/state/protocol/state.js";
import { getCompletionAction, toCommandCompletionAttachmentMeta } from "../../common/meta/agentCompletionAttachmentMeta.js";
import { getCopilotConfigSlashCommandItems, isCopilotConfigSlashCommand } from "../../common/copilotConfigSlashCommands.js";
import { CompletionTriggerCharacter } from "../agentHostCompletions.js";
import { extractLeadingSlashToken, extractWhitespaceDelimitedSlashToken, matchesSlashCompletion } from "../agentHostSlashCompletion.js";
import { SYNCED_CUSTOMIZATION_SCHEME } from "../../common/agentHostFileSystemService.js";
import { parseLeadingSlashCommand } from "../../common/agentHostSlashCommand.js";
const HIDDEN_RUNTIME_COMMANDS = /* @__PURE__ */ new Set(["agent", "app", "changelog", "context", "copy", "exit", "extensions", "feedback", "help", "ide", "instructions", "login", "logout", "mcp", "model", "new", "plugin", "rename", "restart", "resume", "sandbox", "session", "settings", "skills", "statusline", "streamer-mode", "subagents", "tasks", "terminal-setup", "theme", "undo", "update", "user", "voice", "worktree", "autopilot", "yolo", "cd", "cwd", "after", "before", "add-dir", "allow-all", "list-dirs", "reset-allowed-tools"]);
const DEFAULT_RUNTIME_SLASH_COMMAND_COMPLETION_WAIT_MS = 300;
class CopilotSlashCommandCompletionProvider {
  constructor(copilotcliId, _sessionInfo, _runtimeSlashCommandCompletionWaitMs = DEFAULT_RUNTIME_SLASH_COMMAND_COMPLETION_WAIT_MS) {
    this.copilotcliId = copilotcliId;
    this._sessionInfo = _sessionInfo;
    this._runtimeSlashCommandCompletionWaitMs = _runtimeSlashCommandCompletionWaitMs;
    this.kinds = /* @__PURE__ */ new Set([CompletionItemKind.UserMessage]);
    this.triggerCharacters = [CompletionTriggerCharacter.Slash];
  }
  async provideCompletionItems(params, _token) {
    if (AgentSession.provider(params.channel) !== this.copilotcliId) {
      return [];
    }
    const leadingTokenForSkills = extractWhitespaceDelimitedSlashToken(params.text, params.offset);
    const leadingTokenForCommands = extractLeadingSlashToken(params.text, params.offset);
    const leading = leadingTokenForCommands ?? leadingTokenForSkills;
    const returnJustSkills = !leadingTokenForCommands && !!leadingTokenForSkills;
    if (!leading) {
      return [];
    }
    const sessionId = AgentSession.id(params.channel);
    const typed = leading.typed;
    return await this._getRuntimeSlashCommandCompletionInfo(sessionId, typed, leading, returnJustSkills);
  }
  async _getKnownSkills(sessionId) {
    const knownCommands = /* @__PURE__ */ new Set();
    const customizations = await this._sessionInfo.getSessionCustomizations(sessionId) ?? [];
    for (const c of customizations) {
      if (c.type === CustomizationType.McpServer || !c.enabled || !c.children) {
        continue;
      }
      for (const child of c.children) {
        if (child.type === CustomizationType.Skill) {
          knownCommands.add(this._toSlashCommandCandidate(c, child));
        }
      }
    }
    return knownCommands;
  }
  _toSlashCommandCandidate(container, skill) {
    let slashCommandName = skill.name;
    if (container.type === CustomizationType.Plugin && !isSyncedCustomization(container) && skill.name !== container.name) {
      slashCommandName = `${container.name}:${skill.name}`;
    }
    return slashCommandName;
  }
  async _getRuntimeSlashCommandCompletionInfo(sessionId, typed, { rangeStart, rangeEnd }, returnJustSkills) {
    const [runtimeCommands, knownSkills] = await Promise.all([
      this._sessionInfo.getRuntimeSlashCommands?.(sessionId, { maxWaitMs: this._runtimeSlashCommandCompletionWaitMs }) ?? [],
      this._getKnownSkills(sessionId)
    ]);
    const typedLower = typed.toLowerCase();
    const rubberDuckEnabled = this._sessionInfo?.isRubberDuckEnabled?.() ?? true;
    const completionItems = [];
    const addedAliases = /* @__PURE__ */ new Set();
    for (const command of runtimeCommands) {
      if (!command.name) {
        continue;
      }
      if (returnJustSkills && command.kind !== "skill") {
        continue;
      }
      if (command.kind === "skill" && knownSkills.has(command.name)) {
        continue;
      }
      if (HIDDEN_RUNTIME_COMMANDS.has(command.name) || command.aliases?.some((alias) => HIDDEN_RUNTIME_COMMANDS.has(alias))) {
        continue;
      }
      if (isCopilotConfigSlashCommand(command.name) || command.aliases?.some((alias) => isCopilotConfigSlashCommand(alias))) {
        continue;
      }
      if (!rubberDuckEnabled && command.name === "rubber-duck") {
        continue;
      }
      if (!matchesSlashCompletion(typedLower, command.name) && !command.aliases?.some((alias) => matchesSlashCompletion(typedLower, alias))) {
        continue;
      }
      const options = [];
      if (command.input?.hint || !command.input?.choices?.length) {
        options.push({ name: "", description: command.description, argumentHint: command.input?.hint });
      }
      if (command.input?.choices?.length) {
        options.push(...command.input.choices);
      }
      const aliases = Array.from(new Set([command.name].concat(command.aliases ?? [])));
      aliases.filter((alias) => !addedAliases.has(alias)).forEach((alias) => {
        options.forEach((option) => {
          const insertText = `/${alias}${option.name ? " " + option.name : ""} `;
          const description = option.description ?? command.description;
          const argumentHint = option.argumentHint;
          addedAliases.add(alias);
          completionItems.push({
            insertText,
            rangeStart,
            rangeEnd,
            attachment: {
              type: MessageAttachmentKind.Simple,
              label: insertText,
              _meta: toCommandCompletionAttachmentMeta({
                command: command.name,
                ...description !== void 0 ? { description } : {},
                ...argumentHint !== void 0 ? { argumentHint } : {}
              })
            }
          });
        });
      });
    }
    if (!returnJustSkills) {
      const configState = this._sessionInfo.getSessionConfigState?.(sessionId);
      for (const item of getCopilotConfigSlashCommandItems(typed, configState)) {
        completionItems.push({
          insertText: item.insertText,
          rangeStart,
          rangeEnd,
          attachment: {
            type: MessageAttachmentKind.Simple,
            label: item.label,
            _meta: toCommandCompletionAttachmentMeta({
              command: item.command,
              description: item.description,
              ...item.argumentHint !== void 0 ? { argumentHint: item.argumentHint } : {},
              action: { applyConfig: item.applyConfig }
            })
          }
        });
      }
    }
    const getSortText = (item) => {
      return getCompletionAction(item.attachment._meta) ? item.attachment.label : item.insertText;
    };
    return completionItems.sort((a, b) => getSortText(a).localeCompare(getSortText(b)));
  }
}
function isSyncedCustomization(container) {
  return container.uri.startsWith(SYNCED_CUSTOMIZATION_SCHEME + ":");
}
export {
  CopilotSlashCommandCompletionProvider,
  DEFAULT_RUNTIME_SLASH_COMMAND_COMPLETION_WAIT_MS,
  parseLeadingSlashCommand
};
