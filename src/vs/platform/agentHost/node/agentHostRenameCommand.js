import { localize } from "../../../nls.js";
import { CompletionItemKind } from "../common/state/protocol/commands.js";
import { MessageAttachmentKind } from "../common/state/protocol/state.js";
import { toCommandCompletionAttachmentMeta } from "../common/meta/agentCompletionAttachmentMeta.js";
import { CompletionTriggerCharacter } from "./agentHostCompletions.js";
import { extractLeadingSlashToken, matchesSlashCompletion } from "./agentHostSlashCompletion.js";
const RENAME_SLASH_COMMAND = "rename";
function parseRenameCommand(prompt) {
  const match = /^\/rename(?:$|\s+([\s\S]*))/.exec(prompt);
  if (!match) {
    return void 0;
  }
  return (match[1] ?? "").trim();
}
class AgentHostRenameCompletionProvider {
  constructor(_hasHistory) {
    this._hasHistory = _hasHistory;
    this.kinds = /* @__PURE__ */ new Set([CompletionItemKind.UserMessage]);
    this.triggerCharacters = [CompletionTriggerCharacter.Slash];
  }
  async provideCompletionItems(params, _token) {
    const leading = extractLeadingSlashToken(params.text, params.offset);
    if (!leading) {
      return [];
    }
    if (!this._hasHistory(params.channel)) {
      return [];
    }
    const typed = leading.typed;
    if (!matchesSlashCompletion(typed, RENAME_SLASH_COMMAND)) {
      return [];
    }
    return [{
      insertText: "/" + RENAME_SLASH_COMMAND + " ",
      rangeStart: leading.rangeStart,
      rangeEnd: leading.rangeEnd,
      attachment: {
        type: MessageAttachmentKind.Simple,
        label: "/" + RENAME_SLASH_COMMAND,
        _meta: toCommandCompletionAttachmentMeta({
          command: RENAME_SLASH_COMMAND,
          description: localize("agentHostSlashCommand.rename.description", "Rename this chat")
        })
      }
    }];
  }
}
export {
  AgentHostRenameCompletionProvider,
  RENAME_SLASH_COMMAND,
  parseRenameCommand
};
