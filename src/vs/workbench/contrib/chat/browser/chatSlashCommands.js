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
import { timeout } from "../../../../base/common/async.js";
import { MarkdownString, isMarkdownString } from "../../../../base/common/htmlContent.js";
import { Disposable, DisposableMap, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import * as nls from "../../../../nls.js";
import { IAgentHostService } from "../../../../platform/agentHost/common/agentService.js";
import { SessionConfigKey } from "../../../../platform/agentHost/common/sessionConfigKeys.js";
import { ActionType } from "../../../../platform/agentHost/common/state/protocol/actions.js";
import { StateComponents } from "../../../../platform/agentHost/common/state/sessionState.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IChatAgentService } from "../common/participants/chatAgents.js";
import { ChatContextKeys } from "../common/actions/chatContextKeys.js";
import { IChatSlashCommandService } from "../common/participants/chatSlashCommands.js";
import { IChatService } from "../common/chatService/chatService.js";
import { IChatSessionsService, SessionType } from "../common/chatSessionsService.js";
import { ChatAgentLocation, ChatConfiguration, ChatModeKind, ChatPermissionLevel } from "../common/constants.js";
import { getChatSessionType, isUntitledChatSession } from "../common/model/chatUri.js";
import { ACTION_ID_NEW_CHAT } from "./actions/chatActions.js";
import { ChatSubmitAction, OpenModePickerAction, OpenModelPickerAction } from "./actions/chatExecuteActions.js";
import { ManagePluginsAction } from "./actions/chatPluginActions.js";
import { ConfigureToolsAction } from "./actions/chatToolActions.js";
import { IAgentSessionsService } from "./agentSessions/agentSessionsService.js";
import { IAgentHostSessionWorkingDirectoryResolver } from "./agentSessions/agentHost/agentHostSessionWorkingDirectoryResolver.js";
import { toAgentHostBackendSessionUri } from "./agentSessions/agentHost/agentHostSessionUri.js";
import { IAgentHostUntitledProvisionalSessionService } from "./agentSessions/agentHost/agentHostUntitledProvisionalSessionService.js";
import { CONFIGURE_INSTRUCTIONS_ACTION_ID } from "./promptSyntax/attachInstructionsAction.js";
import { showConfigureHooksQuickPick } from "./promptSyntax/hookActions.js";
import { CONFIGURE_PROMPTS_ACTION_ID } from "./promptSyntax/runPromptAction.js";
import { CONFIGURE_SKILLS_ACTION_ID } from "./promptSyntax/skillActions.js";
import { IChatWidgetService } from "./chat.js";
import { agentSlashCommandToMarkdown, agentToMarkdown } from "./widget/chatContentParts/chatMarkdownDecorationsRenderer.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { AICustomizationManagementCommands, AICustomizationManagementSection } from "./aiCustomization/aiCustomizationManagement.js";
import { IChatPetService } from "./chatPetService.js";
import { ChatSessionArchiveActionWording, ChatSessionArchiveActionWordingSettingId, getChatSessionArchiveActionWording } from "../../../../platform/chat/common/sessionArchiveActions.js";
let ChatSlashCommandsContribution = class extends Disposable {
  constructor(slashCommandService, commandService, chatAgentService, instantiationService, agentSessionsService, chatService, configurationService, chatWidgetService, agentHostService, agentHostProvisionalService, agentHostWorkingDirectoryResolver, workspaceContextService, chatPetService, environmentService) {
    super();
    this.environmentService = environmentService;
    this._store.add(slashCommandService.registerSlashCommand({
      command: "vscode-pet",
      detail: nls.localize("vscodePet", "Toggle an interactive VS Code pet (Experimental)"),
      sortText: "z3_vscodePet",
      executeImmediately: true,
      silent: true,
      locations: [ChatAgentLocation.Chat]
    }, async () => {
      chatPetService.toggle();
    }));
    const clearCommandRegistration = this._register(new MutableDisposable());
    const registerClearCommand = () => {
      const wording = getChatSessionArchiveActionWording(configurationService);
      clearCommandRegistration.clear();
      clearCommandRegistration.value = slashCommandService.registerSlashCommand({
        command: "clear",
        detail: wording === ChatSessionArchiveActionWording.MarkAsDone ? nls.localize("clear.markDone", "Start a new chat and mark the current one as done") : nls.localize("clear.archive", "Start a new chat and archive the current one"),
        sortText: "z2_clear",
        executeImmediately: true,
        locations: [ChatAgentLocation.Chat]
      }, async (_prompt, _progress, _history, _location, sessionResource) => {
        agentSessionsService.getSession(sessionResource)?.setArchived(true);
        commandService.executeCommand(ACTION_ID_NEW_CHAT);
      });
    };
    registerClearCommand();
    this._register(configurationService.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(ChatSessionArchiveActionWordingSettingId)) {
        registerClearCommand();
      }
    }));
    this._store.add(slashCommandService.registerSlashCommand({
      command: "hooks",
      detail: nls.localize("hooks", "Configure hooks"),
      sortText: "z3_hooks",
      executeImmediately: true,
      silent: true,
      locations: [ChatAgentLocation.Chat],
      sessionTypes: [SessionType.Local, SessionType.AgentHostCopilot]
    }, async (_prompt, _progress, _history, _location, sessionResource) => {
      if (getChatSessionType(sessionResource) === SessionType.AgentHostCopilot) {
        await commandService.executeCommand(AICustomizationManagementCommands.OpenEditor, AICustomizationManagementSection.Hooks);
      } else {
        await instantiationService.invokeFunction(showConfigureHooksQuickPick);
      }
    }));
    this._store.add(slashCommandService.registerSlashCommand({
      command: "models",
      detail: nls.localize("models", "Open the model picker"),
      sortText: "z3_models",
      executeImmediately: true,
      silent: true,
      locations: [ChatAgentLocation.Chat]
    }, async (_promp) => {
      await commandService.executeCommand(OpenModelPickerAction.ID);
    }));
    this._store.add(slashCommandService.registerSlashCommand({
      command: "tools",
      detail: nls.localize("tools", "Configure tools"),
      sortText: "z3_tools",
      executeImmediately: true,
      silent: true,
      locations: [ChatAgentLocation.Chat],
      sessionTypes: [SessionType.Local]
    }, async () => {
      await commandService.executeCommand(ConfigureToolsAction.ID);
    }));
    this._store.add(slashCommandService.registerSlashCommand({
      command: "plugins",
      detail: nls.localize("plugins", "Manage plugins"),
      sortText: "z3_plugins",
      executeImmediately: true,
      silent: true,
      locations: [ChatAgentLocation.Chat],
      sessionTypes: [SessionType.Local]
    }, async () => {
      await commandService.executeCommand(ManagePluginsAction.ID);
    }));
    if (!this.environmentService.isSessionsWindow) {
      this._store.add(slashCommandService.registerSlashCommand({
        command: "debug",
        detail: nls.localize("debug", "Show Chat Debug View"),
        sortText: "z3_debug",
        executeImmediately: true,
        silent: true,
        locations: [ChatAgentLocation.Chat]
      }, async () => {
        await commandService.executeCommand("github.copilot.debug.showChatLogView");
      }));
    }
    this._store.add(slashCommandService.registerSlashCommand({
      command: "agents",
      detail: nls.localize("agents", "Configure custom agents"),
      sortText: "z3_agents",
      executeImmediately: true,
      silent: true,
      locations: [ChatAgentLocation.Chat],
      sessionTypes: [SessionType.Local, SessionType.AgentHostCopilot]
    }, async (_prompt, _progress, _history, _location, sessionResource) => {
      if (getChatSessionType(sessionResource) === SessionType.AgentHostCopilot) {
        await commandService.executeCommand(AICustomizationManagementCommands.OpenEditor, AICustomizationManagementSection.Agents);
      } else {
        await commandService.executeCommand(OpenModePickerAction.ID);
      }
    }));
    this._store.add(slashCommandService.registerSlashCommand({
      command: "skills",
      detail: nls.localize("skills", "Configure skills"),
      sortText: "z3_skills",
      executeImmediately: true,
      silent: true,
      locations: [ChatAgentLocation.Chat],
      sessionTypes: [SessionType.Local, SessionType.AgentHostCopilot]
    }, async (_prompt, _progress, _history, _location, sessionResource) => {
      if (getChatSessionType(sessionResource) === SessionType.AgentHostCopilot) {
        await commandService.executeCommand(AICustomizationManagementCommands.OpenEditor, AICustomizationManagementSection.Skills);
      } else {
        await commandService.executeCommand(CONFIGURE_SKILLS_ACTION_ID);
      }
    }));
    this._store.add(slashCommandService.registerSlashCommand({
      command: "instructions",
      detail: nls.localize("instructions", "Configure instructions"),
      sortText: "z3_instructions",
      executeImmediately: true,
      silent: true,
      locations: [ChatAgentLocation.Chat],
      sessionTypes: [SessionType.Local, SessionType.AgentHostCopilot]
    }, async (_prompt, _progress, _history, _location, sessionResource) => {
      if (getChatSessionType(sessionResource) === SessionType.AgentHostCopilot) {
        await commandService.executeCommand(AICustomizationManagementCommands.OpenEditor, AICustomizationManagementSection.Instructions);
      } else {
        await commandService.executeCommand(CONFIGURE_INSTRUCTIONS_ACTION_ID);
      }
    }));
    this._store.add(slashCommandService.registerSlashCommand({
      command: "prompts",
      detail: nls.localize("prompts", "Configure prompt files"),
      sortText: "z3_prompts",
      executeImmediately: true,
      silent: true,
      locations: [ChatAgentLocation.Chat],
      sessionTypes: [SessionType.Local, SessionType.AgentHostCopilot]
    }, async (_prompt, _progress, _history, _location, sessionResource) => {
      if (getChatSessionType(sessionResource) === SessionType.AgentHostCopilot) {
        await commandService.executeCommand(AICustomizationManagementCommands.OpenEditor, AICustomizationManagementSection.Prompts);
      } else {
        await commandService.executeCommand(CONFIGURE_PROMPTS_ACTION_ID);
      }
    }));
    this._store.add(slashCommandService.registerSlashCommand({
      command: "fork",
      detail: nls.localize("fork", "Fork conversation into a new chat session"),
      sortText: "z2_fork",
      executeImmediately: true,
      silent: true,
      locations: [ChatAgentLocation.Chat],
      when: ContextKeyExpr.or(
        ChatContextKeys.lockedToCodingAgent.negate(),
        ChatContextKeys.chatSessionSupportsFork
      )
    }, async (_prompt, _progress, _history, _location, sessionResource) => {
      await commandService.executeCommand("workbench.action.chat.forkConversation", sessionResource);
    }));
    this._store.add(slashCommandService.registerSlashCommand({
      command: "rename",
      detail: nls.localize("rename", "Rename this chat"),
      sortText: "z2_rename",
      executeImmediately: false,
      silent: true,
      locations: [ChatAgentLocation.Chat],
      sessionTypes: [SessionType.Local]
    }, async (prompt, _progress, _history, _location, sessionResource) => {
      const title = prompt.trim();
      if (title) {
        chatService.setChatSessionTitle(sessionResource, title);
      }
    }));
    const getAgentHostWorkingDirectory = (sessionResource) => {
      return agentHostWorkingDirectoryResolver.resolve(sessionResource) ?? workspaceContextService.getWorkspace().folders[0]?.uri;
    };
    const readAgentHostConfigValues = (backendSession) => {
      const state = agentHostService.getSubscriptionUnmanaged(StateComponents.Session, backendSession)?.value;
      return state && !(state instanceof Error) ? state.config?.values : void 0;
    };
    const setPermissionLevelForSession = async (sessionResource, level) => {
      const backendSession = toAgentHostBackendSessionUri(sessionResource);
      if (backendSession) {
        const permittedLevel = configurationService.inspect(ChatConfiguration.GlobalAutoApprove).policyValue === false ? ChatPermissionLevel.Default : level;
        const partial = { [SessionConfigKey.AutoApprove]: permittedLevel };
        const workingDirectory = getAgentHostWorkingDirectory(sessionResource);
        if (isUntitledChatSession(sessionResource)) {
          await agentHostProvisionalService.applyConfigChange(sessionResource, backendSession.scheme, workingDirectory, partial);
          return;
        }
        agentHostService.dispatch(backendSession.toString(), {
          type: ActionType.SessionConfigChanged,
          config: partial
        });
        const nextConfig = { ...readAgentHostConfigValues(backendSession) ?? {}, ...partial };
        void agentHostProvisionalService.refreshResolvedConfig(sessionResource, backendSession.scheme, workingDirectory, nextConfig);
        return;
      }
      const widget = chatWidgetService.getWidgetBySessionResource(sessionResource) ?? chatWidgetService.lastFocusedWidget;
      if (widget) {
        widget.input.setPermissionLevel(level);
      }
    };
    const autoApprovePolicyValue = configurationService.inspect(ChatConfiguration.GlobalAutoApprove).policyValue;
    if (autoApprovePolicyValue !== false) {
      this._store.add(slashCommandService.registerSlashCommand({
        command: "autoApprove",
        detail: nls.localize("autoApprove", "Set permissions to bypass approvals"),
        sortText: "z1_autoApprove",
        executeImmediately: true,
        silent: true,
        locations: [ChatAgentLocation.Chat],
        sessionTypes: [SessionType.Local, SessionType.CopilotCLI]
      }, async (_prompt, _progress, _history, _location, sessionResource) => {
        await setPermissionLevelForSession(sessionResource, ChatPermissionLevel.AutoApprove);
      }));
      this._store.add(slashCommandService.registerSlashCommand({
        command: "disableAutoApprove",
        detail: nls.localize("disableAutoApprove", "Set permissions back to default"),
        sortText: "z1_disableAutoApprove",
        executeImmediately: true,
        silent: true,
        locations: [ChatAgentLocation.Chat],
        sessionTypes: [SessionType.Local, SessionType.CopilotCLI]
      }, async (_prompt, _progress, _history, _location, sessionResource) => {
        await setPermissionLevelForSession(sessionResource, ChatPermissionLevel.Default);
      }));
      this._store.add(slashCommandService.registerSlashCommand({
        command: "yolo",
        detail: nls.localize("yolo", "Set permissions to bypass approvals"),
        sortText: "z1_yolo",
        executeImmediately: true,
        silent: true,
        locations: [ChatAgentLocation.Chat],
        sessionTypes: [SessionType.Local, SessionType.CopilotCLI]
      }, async (_prompt, _progress, _history, _location, sessionResource) => {
        await setPermissionLevelForSession(sessionResource, ChatPermissionLevel.AutoApprove);
      }));
      this._store.add(slashCommandService.registerSlashCommand({
        command: "disableYolo",
        detail: nls.localize("disableYolo", "Set permissions back to default"),
        sortText: "z1_disableYolo",
        executeImmediately: true,
        silent: true,
        locations: [ChatAgentLocation.Chat],
        sessionTypes: [SessionType.Local, SessionType.CopilotCLI]
      }, async (_prompt, _progress, _history, _location, sessionResource) => {
        await setPermissionLevelForSession(sessionResource, ChatPermissionLevel.Default);
      }));
      this._store.add(slashCommandService.registerSlashCommand({
        command: "autopilot",
        detail: nls.localize("autopilot", "Set permissions to autopilot mode"),
        sortText: "z1_autopilot",
        executeImmediately: true,
        silent: true,
        locations: [ChatAgentLocation.Chat],
        sessionTypes: [SessionType.Local, SessionType.CopilotCLI]
      }, async (_prompt, _progress, _history, _location, sessionResource) => {
        await setPermissionLevelForSession(sessionResource, ChatPermissionLevel.Autopilot);
      }));
      this._store.add(slashCommandService.registerSlashCommand({
        command: "exitAutopilot",
        detail: nls.localize("exitAutopilot", "Set permissions back to default"),
        sortText: "z1_exitAutopilot",
        executeImmediately: true,
        silent: true,
        locations: [ChatAgentLocation.Chat],
        sessionTypes: [SessionType.Local, SessionType.CopilotCLI]
      }, async (_prompt, _progress, _history, _location, sessionResource) => {
        await setPermissionLevelForSession(sessionResource, ChatPermissionLevel.Default);
      }));
    }
    this._store.add(slashCommandService.registerSlashCommand({
      command: "help",
      detail: "",
      sortText: "z1_help",
      executeImmediately: true,
      locations: [ChatAgentLocation.Chat],
      modes: [ChatModeKind.Ask],
      sessionTypes: [SessionType.Local]
    }, async (prompt, progress, _history, _location, sessionResource) => {
      const defaultAgent = chatAgentService.getDefaultAgent(ChatAgentLocation.Chat);
      const agents = chatAgentService.getAgents();
      if (defaultAgent?.metadata.helpTextPrefix) {
        if (isMarkdownString(defaultAgent.metadata.helpTextPrefix)) {
          progress.report({ content: defaultAgent.metadata.helpTextPrefix, kind: "markdownContent" });
        } else {
          progress.report({ content: new MarkdownString(defaultAgent.metadata.helpTextPrefix), kind: "markdownContent" });
        }
        progress.report({ content: new MarkdownString("\n\n"), kind: "markdownContent" });
      }
      const agentText = (await Promise.all(agents.filter((a) => !a.isDefault && !a.isCore).filter((a) => a.locations.includes(ChatAgentLocation.Chat)).map(async (a) => {
        const description = a.description ? `- ${a.description}` : "";
        const agentMarkdown = instantiationService.invokeFunction((accessor) => agentToMarkdown(a, sessionResource, true, accessor));
        const agentLine = `- ${agentMarkdown} ${description}`;
        const commandText = a.slashCommands.map((c) => {
          const description2 = c.description ? `- ${c.description}` : "";
          return `	* ${agentSlashCommandToMarkdown(a, c, sessionResource)} ${description2}`;
        }).join("\n");
        return (agentLine + "\n" + commandText).trim();
      }))).join("\n");
      progress.report({ content: new MarkdownString(agentText, { isTrusted: { enabledCommands: [ChatSubmitAction.ID] } }), kind: "markdownContent" });
      if (defaultAgent?.metadata.helpTextPostfix) {
        progress.report({ content: new MarkdownString("\n\n"), kind: "markdownContent" });
        if (isMarkdownString(defaultAgent.metadata.helpTextPostfix)) {
          progress.report({ content: defaultAgent.metadata.helpTextPostfix, kind: "markdownContent" });
        } else {
          progress.report({ content: new MarkdownString(defaultAgent.metadata.helpTextPostfix), kind: "markdownContent" });
        }
      }
      await timeout(200);
    }));
  }
  static {
    this.ID = "workbench.contrib.chatSlashCommands";
  }
};
ChatSlashCommandsContribution = __decorateClass([
  __decorateParam(0, IChatSlashCommandService),
  __decorateParam(1, ICommandService),
  __decorateParam(2, IChatAgentService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IAgentSessionsService),
  __decorateParam(5, IChatService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IChatWidgetService),
  __decorateParam(8, IAgentHostService),
  __decorateParam(9, IAgentHostUntitledProvisionalSessionService),
  __decorateParam(10, IAgentHostSessionWorkingDirectoryResolver),
  __decorateParam(11, IWorkspaceContextService),
  __decorateParam(12, IChatPetService),
  __decorateParam(13, IWorkbenchEnvironmentService)
], ChatSlashCommandsContribution);
let ChatSessionOptionSlashCommandsContribution = class extends Disposable {
  constructor(chatSessionsService, slashCommandService, logService) {
    super();
    this.chatSessionsService = chatSessionsService;
    this.slashCommandService = slashCommandService;
    this.logService = logService;
    this._registrationsByType = this._register(new DisposableMap());
    this._register(this.chatSessionsService.onDidChangeOptionGroups((chatSessionType) => {
      this.refreshForSessionType(chatSessionType);
    }));
  }
  static {
    this.ID = "workbench.contrib.chatSessionOptionSlashCommands";
  }
  refreshForSessionType(chatSessionType) {
    this._registrationsByType.deleteAndDispose(chatSessionType);
    const groups = this.chatSessionsService.getOptionGroupsForSessionType(chatSessionType);
    if (!groups || groups.length === 0) {
      return;
    }
    const store = new DisposableStore();
    const seen = /* @__PURE__ */ new Set();
    for (const group of groups) {
      for (const item of group.items) {
        const name = item.slashCommand?.trim();
        if (!name) {
          continue;
        }
        if (seen.has(name)) {
          this.logService.warn(`[ChatSessionOptionSlashCommands] Skipping duplicate slash command '${name}' contributed by session type '${chatSessionType}'.`);
          continue;
        }
        if (this.slashCommandService.hasCommand(name, chatSessionType)) {
          this.logService.warn(`[ChatSessionOptionSlashCommands] Slash command '${name}' contributed by session type '${chatSessionType}' is already registered; skipping.`);
          continue;
        }
        seen.add(name);
        store.add(this.registerOne(chatSessionType, group, item, name));
      }
    }
    if (store.isDisposed || seen.size === 0) {
      store.dispose();
      return;
    }
    this._registrationsByType.set(chatSessionType, store);
  }
  registerOne(chatSessionType, group, item, name) {
    return this.slashCommandService.registerSlashCommand({
      command: name,
      detail: item.description ?? nls.localize("chatSessionOption.slashCommand.detail", "Switch to '{0}'", item.name),
      sortText: `z1_${name}`,
      executeImmediately: true,
      silent: true,
      locations: [ChatAgentLocation.Chat],
      sessionTypes: [chatSessionType]
    }, async (_prompt, _progress, _history, _location, sessionResource) => {
      if (!sessionResource) {
        return;
      }
      this.chatSessionsService.setSessionOption(sessionResource, group.id, item);
    });
  }
};
ChatSessionOptionSlashCommandsContribution = __decorateClass([
  __decorateParam(0, IChatSessionsService),
  __decorateParam(1, IChatSlashCommandService),
  __decorateParam(2, ILogService)
], ChatSessionOptionSlashCommandsContribution);
export {
  ChatSessionOptionSlashCommandsContribution,
  ChatSlashCommandsContribution
};
