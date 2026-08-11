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
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { parseLeadingSlashCommand } from "../../../../../../platform/agentHost/common/agentHostSlashCommand.js";
import { resolveCopilotConfigSlashCommandOnSend } from "../../../../../../platform/agentHost/common/copilotConfigSlashCommands.js";
import { IAgentHostService } from "../../../../../../platform/agentHost/common/agentService.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IDialogService } from "../../../../../../platform/dialogs/common/dialogs.js";
import { IStorageService } from "../../../../../../platform/storage/common/storage.js";
import { IWorkspaceContextService } from "../../../../../../platform/workspace/common/workspace.js";
import { IChatSubmitRequestHandlerService } from "../../chatSubmitRequestHandlerService.js";
import { SessionType } from "../../../common/chatSessionsService.js";
import { getChatSessionType } from "../../../common/model/chatUri.js";
import { IAgentHostSessionWorkingDirectoryResolver } from "./agentHostSessionWorkingDirectoryResolver.js";
import { IAgentHostUntitledProvisionalSessionService } from "./agentHostUntitledProvisionalSessionService.js";
import { applyAgentHostSubmitConfig } from "./applyAgentHostSubmitConfig.js";
function resolveCopilotConfigSlashSubmit(input) {
  const slashCommand = parseLeadingSlashCommand(input);
  return slashCommand ? resolveCopilotConfigSlashCommandOnSend(slashCommand.command, slashCommand.rawRest) : void 0;
}
let CopilotConfigSlashSubmitHandlerContribution = class extends Disposable {
  constructor(submitRequestHandlerService, _agentHostService, _provisionalService, _workingDirectoryResolver, _workspaceContextService, _configurationService, _dialogService, _storageService) {
    super();
    this._agentHostService = _agentHostService;
    this._provisionalService = _provisionalService;
    this._workingDirectoryResolver = _workingDirectoryResolver;
    this._workspaceContextService = _workspaceContextService;
    this._configurationService = _configurationService;
    this._dialogService = _dialogService;
    this._storageService = _storageService;
    this._register(submitRequestHandlerService.register({
      id: "copilot.configSlash",
      tryHandle: (request) => this._tryHandle(request)
    }));
  }
  static {
    this.ID = "workbench.contrib.chat.copilotConfigSlashSubmitHandler";
  }
  async _tryHandle(request) {
    if (getChatSessionType(request.sessionResource) !== SessionType.AgentHostCopilot) {
      return false;
    }
    const configAction = resolveCopilotConfigSlashSubmit(request.input);
    if (!configAction) {
      return false;
    }
    await applyAgentHostSubmitConfig(request.sessionResource, configAction.applyConfig, {
      agentHostService: this._agentHostService,
      provisionalService: this._provisionalService,
      workingDirectoryResolver: this._workingDirectoryResolver,
      workspaceContextService: this._workspaceContextService,
      configurationService: this._configurationService,
      dialogService: this._dialogService,
      storageService: this._storageService
    });
    return !configAction.strippedPrompt;
  }
};
CopilotConfigSlashSubmitHandlerContribution = __decorateClass([
  __decorateParam(0, IChatSubmitRequestHandlerService),
  __decorateParam(1, IAgentHostService),
  __decorateParam(2, IAgentHostUntitledProvisionalSessionService),
  __decorateParam(3, IAgentHostSessionWorkingDirectoryResolver),
  __decorateParam(4, IWorkspaceContextService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IDialogService),
  __decorateParam(7, IStorageService)
], CopilotConfigSlashSubmitHandlerContribution);
export {
  CopilotConfigSlashSubmitHandlerContribution,
  resolveCopilotConfigSlashSubmit
};
