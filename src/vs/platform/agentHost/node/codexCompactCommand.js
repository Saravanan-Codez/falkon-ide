import { localize } from "../../../nls.js";
import { AgentSession, CODEX_AGENT_PROVIDER_ID } from "../common/agentService.js";
import { toCommandCompletionAttachmentMeta } from "../common/meta/agentCompletionAttachmentMeta.js";
import { CompletionItemKind } from "../common/state/protocol/commands.js";
import { MessageAttachmentKind } from "../common/state/protocol/state.js";
import { CompletionTriggerCharacter } from "./agentHostCompletions.js";
import { extractLeadingSlashToken, matchesSlashCompletion } from "./agentHostSlashCompletion.js";
const CODEX_COMPACT_SLASH_COMMAND = "compact";
class CodexCompactCompletionProvider {
  constructor(_hasHistory) {
    this._hasHistory = _hasHistory;
    this.kinds = /* @__PURE__ */ new Set([CompletionItemKind.UserMessage]);
    this.triggerCharacters = [CompletionTriggerCharacter.Slash];
  }
  async provideCompletionItems(params, _token) {
    if (AgentSession.provider(params.channel) !== CODEX_AGENT_PROVIDER_ID || !this._hasHistory(params.channel)) {
      return [];
    }
    const leading = extractLeadingSlashToken(params.text, params.offset);
    if (!leading || !matchesSlashCompletion(leading.typed, CODEX_COMPACT_SLASH_COMMAND)) {
      return [];
    }
    return [{
      insertText: `/${CODEX_COMPACT_SLASH_COMMAND} `,
      rangeStart: leading.rangeStart,
      rangeEnd: leading.rangeEnd,
      attachment: {
        type: MessageAttachmentKind.Simple,
        label: `/${CODEX_COMPACT_SLASH_COMMAND}`,
        _meta: toCommandCompletionAttachmentMeta({
          command: CODEX_COMPACT_SLASH_COMMAND,
          description: localize("codex.compact.description", "Compact this conversation's context")
        })
      }
    }];
  }
}
export {
  CODEX_COMPACT_SLASH_COMMAND,
  CodexCompactCompletionProvider
};
