var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { Disposable } from "../../../../base/common/lifecycle.js";
import { parseLeadingSlashCommand } from "../../../../platform/agentHost/common/agentHostSlashCommand.js";
import { resolveCopilotConfigSlashCommandOnSend } from "../../../../platform/agentHost/common/copilotConfigSlashCommands.js";
import { IChatSubmitRequestHandlerService } from "../../../../workbench/contrib/chat/browser/chatSubmitRequestHandlerService.js";
import { applyAgentHostCompletionAction } from "../../../../workbench/contrib/chat/browser/agentHostCompletionAction.js";
import { SessionType } from "../../../../workbench/contrib/chat/common/chatSessionsService.js";
import { getChatSessionType } from "../../../../workbench/contrib/chat/common/model/chatUri.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { isAgentHostProvider } from "../../../common/agentHostSessionsProvider.js";
import { ISessionsProvidersService } from "../../../services/sessions/browser/sessionsProvidersService.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
let SessionsCopilotConfigSlashSubmitHandlerContribution = class extends Disposable {
  constructor(submitRequestHandlerService, _sessionsManagementService, _sessionsProvidersService, _dialogService, _storageService) {
    super();
    this._sessionsManagementService = _sessionsManagementService;
    this._sessionsProvidersService = _sessionsProvidersService;
    this._dialogService = _dialogService;
    this._storageService = _storageService;
    this._register(submitRequestHandlerService.register({
      id: "sessions.copilot.configSlash",
      tryHandle: (request) => this._tryHandle(request)
    }));
  }
  static {
    this.ID = "sessions.contrib.chat.copilotConfigSlashSubmitHandler";
  }
  async _tryHandle(request) {
    if (getChatSessionType(request.sessionResource) !== SessionType.AgentHostCopilot) {
      return false;
    }
    const slashCommand = parseLeadingSlashCommand(request.input);
    const configAction = slashCommand ? resolveCopilotConfigSlashCommandOnSend(slashCommand.command, slashCommand.rawRest) : void 0;
    if (!configAction) {
      return false;
    }
    const session = this._sessionsManagementService.getSession(request.sessionResource);
    const providerId = session?.providerId ?? request.providerId;
    const sessionId = session?.sessionId ?? request.sessionId;
    if (!providerId || !sessionId) {
      return false;
    }
    const provider = this._sessionsProvidersService.getProvider(providerId);
    if (!provider || !isAgentHostProvider(provider)) {
      return false;
    }
    await applyAgentHostCompletionAction({ applyConfig: configAction.applyConfig }, this._dialogService, this._storageService, async (config) => {
      await Promise.all(Object.entries(config).map(([key, value]) => provider.setSessionConfigValue(sessionId, key, value)));
    });
    return !configAction.strippedPrompt;
  }
};
SessionsCopilotConfigSlashSubmitHandlerContribution = __decorateClass([
  __decorateParam(0, IChatSubmitRequestHandlerService),
  __decorateParam(1, ISessionsManagementService),
  __decorateParam(2, ISessionsProvidersService),
  __decorateParam(3, IDialogService),
  __decorateParam(4, IStorageService)
], SessionsCopilotConfigSlashSubmitHandlerContribution);
export {
  SessionsCopilotConfigSlashSubmitHandlerContribution
};
