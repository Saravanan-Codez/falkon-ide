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
import { constObservable, derived, observableFromEventOpts } from "../../../../../base/common/observable.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { IAICustomizationWorkspaceService, AICustomizationManagementSection } from "../../common/aiCustomizationWorkspaceService.js";
import { InstantiationType, registerSingleton } from "../../../../../platform/instantiation/common/extensions.js";
import { IPromptsService } from "../../common/promptSyntax/service/promptsService.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { PromptsType } from "../../common/promptSyntax/promptTypes.js";
import {
  GENERATE_AGENT_COMMAND_ID,
  GENERATE_HOOK_COMMAND_ID,
  GENERATE_ON_DEMAND_INSTRUCTIONS_COMMAND_ID,
  GENERATE_PROMPT_COMMAND_ID,
  GENERATE_SKILL_COMMAND_ID
} from "../actions/chatActions.js";
let AICustomizationWorkspaceService = class {
  constructor(workspaceContextService, commandService, promptsService) {
    this.workspaceContextService = workspaceContextService;
    this.commandService = commandService;
    this.promptsService = promptsService;
    this.managementSections = [
      AICustomizationManagementSection.Agents,
      AICustomizationManagementSection.Skills,
      AICustomizationManagementSection.Instructions,
      AICustomizationManagementSection.Prompts,
      AICustomizationManagementSection.Hooks,
      AICustomizationManagementSection.McpServers,
      AICustomizationManagementSection.Plugins,
      AICustomizationManagementSection.Tools,
      AICustomizationManagementSection.HarnessSettings
    ];
    this.isSessionsWindow = false;
    this.welcomePageFeatures = {
      showGettingStartedBanner: true
    };
    this.hasOverrideProjectRoot = constObservable(false);
    const workspaceFolders = observableFromEventOpts(
      { owner: this },
      this.workspaceContextService.onDidChangeWorkspaceFolders,
      () => this.workspaceContextService.getWorkspace().folders
    );
    this.activeProjectRoot = derived((reader) => {
      const folders = workspaceFolders.read(reader);
      return folders[0]?.uri;
    });
  }
  getActiveProjectRoot() {
    const folders = this.workspaceContextService.getWorkspace().folders;
    return folders[0]?.uri;
  }
  setOverrideProjectRoot(_root) {
  }
  clearOverrideProjectRoot() {
  }
  async commitFiles(_projectRoot, _fileUris) {
  }
  async deleteFiles(_projectRoot, _fileUris) {
  }
  async generateCustomization(type) {
    const commandIds = {
      [PromptsType.agent]: GENERATE_AGENT_COMMAND_ID,
      [PromptsType.skill]: GENERATE_SKILL_COMMAND_ID,
      [PromptsType.instructions]: GENERATE_ON_DEMAND_INSTRUCTIONS_COMMAND_ID,
      [PromptsType.prompt]: GENERATE_PROMPT_COMMAND_ID,
      [PromptsType.hook]: GENERATE_HOOK_COMMAND_ID
    };
    const commandId = commandIds[type];
    if (commandId) {
      await this.commandService.executeCommand(commandId);
    }
  }
  async getFilteredPromptSlashCommands(token) {
    return this.promptsService.getPromptSlashCommands(token);
  }
  static {
    this._emptyIntegrations = /* @__PURE__ */ new Map();
  }
  getSkillUIIntegrations() {
    return AICustomizationWorkspaceService._emptyIntegrations;
  }
};
AICustomizationWorkspaceService = __decorateClass([
  __decorateParam(0, IWorkspaceContextService),
  __decorateParam(1, ICommandService),
  __decorateParam(2, IPromptsService)
], AICustomizationWorkspaceService);
registerSingleton(IAICustomizationWorkspaceService, AICustomizationWorkspaceService, InstantiationType.Delayed);
