import { Disposable } from "../../../base/common/lifecycle.js";
import { URI } from "../../../base/common/uri.js";
import { SYNCED_CUSTOMIZATION_SCHEME } from "../common/agentHostFileSystemService.js";
import { CompletionItemKind } from "../common/state/protocol/commands.js";
import { MessageAttachmentKind } from "../common/state/protocol/state.js";
import { toSkillCompletionAttachmentMeta } from "../common/meta/agentCompletionAttachmentMeta.js";
import { CustomizationType } from "../common/state/sessionState.js";
import { CompletionTriggerCharacter } from "./agentHostCompletions.js";
import { extractWhitespaceDelimitedSlashToken, matchesSlashCompletion } from "./agentHostSlashCompletion.js";
class AgentHostSkillCompletionProvider extends Disposable {
  constructor(_getAgent) {
    super();
    this._getAgent = _getAgent;
    this.kinds = /* @__PURE__ */ new Set([CompletionItemKind.UserMessage]);
    this.triggerCharacters = [CompletionTriggerCharacter.Slash];
  }
  async provideCompletionItems(params, token) {
    const leading = extractWhitespaceDelimitedSlashToken(params.text, params.offset);
    if (!leading) {
      return [];
    }
    const sessionUri = typeof params.channel === "string" ? URI.parse(params.channel) : params.channel;
    const agent = this._getAgent(sessionUri);
    if (!agent) {
      return [];
    }
    const candidates = await this._getCandidates(agent, sessionUri);
    if (token.isCancellationRequested || candidates.length === 0) {
      return [];
    }
    const typed = leading.typed;
    const skillsSeen = /* @__PURE__ */ new Set();
    return candidates.filter((skill) => {
      const uri = skill.uri;
      if (matchesSlashCompletion(typed, skill.slashCommandName) && !skillsSeen.has(uri)) {
        skillsSeen.add(uri);
        return true;
      }
      return false;
    }).map((skill) => ({
      insertText: "/" + skill.slashCommandName + " ",
      rangeStart: leading.rangeStart,
      rangeEnd: leading.rangeEnd,
      attachment: {
        type: MessageAttachmentKind.Simple,
        label: "/" + skill.slashCommandName,
        _meta: toSkillCompletionAttachmentMeta({
          uri: skill.uri,
          name: skill.name,
          displayName: skill.slashCommandName,
          description: skill.description
        })
      }
    }));
  }
  async _getCandidates(agent, session) {
    if (!agent.getSessionCustomizations) {
      return [];
    }
    const customizations = await agent.getSessionCustomizations(session);
    const result = [];
    for (const c of customizations) {
      if (c.type === CustomizationType.McpServer || !c.enabled || !c.children) {
        continue;
      }
      for (const child of c.children) {
        if (child.type === CustomizationType.Skill) {
          result.push(this._toSlashCommandCandidate(c, child));
        }
      }
    }
    return result;
  }
  _toSlashCommandCandidate(container, skill) {
    let slashCommandName = skill.name;
    if (container.type === CustomizationType.Plugin && !isSyncedCustomization(container) && skill.name !== container.name) {
      slashCommandName = `${container.name}:${skill.name}`;
    }
    return {
      slashCommandName,
      name: skill.name,
      description: skill.description,
      uri: skill.uri
    };
  }
}
function isSyncedCustomization(container) {
  return container.uri.startsWith(SYNCED_CUSTOMIZATION_SCHEME + ":");
}
export {
  AgentHostSkillCompletionProvider
};
