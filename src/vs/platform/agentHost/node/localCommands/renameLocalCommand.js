import { Disposable } from "../../../../base/common/lifecycle.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { localize } from "../../../../nls.js";
import { ActionType } from "../../common/state/sessionActions.js";
import { isAhpChatChannel, isDefaultChatUri, parseRequiredSessionUriFromChatUri, ResponsePartKind } from "../../common/state/sessionState.js";
import { parseRenameCommand } from "../agentHostRenameCommand.js";
import { LocalChatCommandRegistry } from "./localChatCommand.js";
class RenameLocalCommand extends Disposable {
  constructor(_context) {
    super();
    this._context = _context;
    this.name = "rename";
    this.recordsLocalTurn = true;
  }
  tryHandle(request) {
    const title = parseRenameCommand(request.text);
    if (title === void 0) {
      return void 0;
    }
    return { run: async () => this._run(request.turnChannel, request.turnId, title), suggestedTitle: title };
  }
  _run(channel, turnId, title) {
    if (title.length === 0) {
      return;
    }
    const isAdditional = (uri) => isAhpChatChannel(uri) && !isDefaultChatUri(uri);
    const chatTarget = isAdditional(channel) ? channel : void 0;
    const sessionChannel = isAhpChatChannel(channel) ? parseRequiredSessionUriFromChatUri(channel) : channel;
    if (chatTarget) {
      this._context.updateChatTitle(sessionChannel, chatTarget, title);
      this._context.persistSessionFlag(sessionChannel, `customChatTitle:${chatTarget}`, title);
    } else {
      this._context.dispatch(sessionChannel, { type: ActionType.SessionTitleChanged, title });
      this._context.persistSessionFlag(sessionChannel, "customTitle", title);
    }
    this._context.dispatch(channel, {
      type: ActionType.ChatResponsePart,
      turnId,
      part: {
        kind: ResponsePartKind.Markdown,
        id: generateUuid(),
        content: localize("agentHostRename.renamed", "Renamed: {0}", title)
      }
    });
  }
}
LocalChatCommandRegistry.register(RenameLocalCommand);
export {
  RenameLocalCommand
};
