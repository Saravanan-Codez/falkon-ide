import { Disposable } from "../../../../base/common/lifecycle.js";
import { StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ChatContextKeys } from "../common/actions/chatContextKeys.js";
import { ChatRequestSlashCommandPart } from "../common/requestParser/chatParserTypes.js";
class CreateSlashCommandsUsageTracker extends Disposable {
  constructor(_chatService, _storageService, _getActiveContextKeyService) {
    super();
    this._chatService = _chatService;
    this._storageService = _storageService;
    this._getActiveContextKeyService = _getActiveContextKeyService;
    this._register(this._chatService.onDidSubmitRequest((e) => {
      const message = e.message ?? this._chatService.getSession(e.chatSessionResource)?.lastRequest?.message;
      if (!message) {
        return;
      }
      for (const part of message.parts) {
        if (part.kind === ChatRequestSlashCommandPart.Kind) {
          const slash = part;
          if (CreateSlashCommandsUsageTracker._isCreateSlashCommand(slash.slashCommand.command)) {
            this._markUsed();
            return;
          }
        }
      }
      const trimmed = message.text.trimStart();
      const match = /^\/(create-(?:instructions|prompt|agent|skill))(?:\s|$)/.exec(trimmed);
      if (match && CreateSlashCommandsUsageTracker._isCreateSlashCommand(match[1])) {
        this._markUsed();
      }
    }));
  }
  static {
    this._USED_CREATE_SLASH_COMMANDS_KEY = "chat.tips.usedCreateSlashCommands";
  }
  syncContextKey(contextKeyService) {
    const used = this._storageService.getBoolean(CreateSlashCommandsUsageTracker._USED_CREATE_SLASH_COMMANDS_KEY, StorageScope.APPLICATION, false);
    ChatContextKeys.hasUsedCreateSlashCommands.bindTo(contextKeyService).set(used);
  }
  _markUsed() {
    if (this._storageService.getBoolean(CreateSlashCommandsUsageTracker._USED_CREATE_SLASH_COMMANDS_KEY, StorageScope.APPLICATION, false)) {
      return;
    }
    this._storageService.store(CreateSlashCommandsUsageTracker._USED_CREATE_SLASH_COMMANDS_KEY, true, StorageScope.APPLICATION, StorageTarget.MACHINE);
    const contextKeyService = this._getActiveContextKeyService();
    if (contextKeyService) {
      ChatContextKeys.hasUsedCreateSlashCommands.bindTo(contextKeyService).set(true);
    }
  }
  static _isCreateSlashCommand(command) {
    switch (command) {
      case "create-instructions":
      case "create-prompt":
      case "create-agent":
      case "create-skill":
        return true;
      default:
        return false;
    }
  }
}
export {
  CreateSlashCommandsUsageTracker
};
