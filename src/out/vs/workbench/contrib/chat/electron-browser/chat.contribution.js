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
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { timeout } from "../../../../base/common/async.js";
import { autorun } from "../../../../base/common/observable.js";
import { resolve } from "../../../../base/common/path.js";
import { isMacintosh } from "../../../../base/common/platform.js";
import { URI } from "../../../../base/common/uri.js";
import { ipcRenderer } from "../../../../base/parts/sandbox/electron-browser/globals.js";
import { localize } from "../../../../nls.js";
import { registerAction2 } from "../../../../platform/actions/common/actions.js";
import { CommandsRegistry, ICommandService } from "../../../../platform/commands/common/commands.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { ILocalGitService } from "../../../../platform/git/common/localGitService.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { registerSharedProcessRemoteService } from "../../../../platform/ipc/electron-browser/services.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { IWorkspaceTrustRequestService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { ViewContainerLocation } from "../../../common/views.js";
import { IChatEntitlementService } from "../../../services/chat/common/chatEntitlementService.js";
import { INativeWorkbenchEnvironmentService } from "../../../services/environment/electron-browser/environmentService.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IWorkbenchLayoutService } from "../../../services/layout/browser/layoutService.js";
import { ILifecycleService, ShutdownReason } from "../../../services/lifecycle/common/lifecycle.js";
import { ACTION_ID_NEW_CHAT, CHAT_OPEN_ACTION_ID } from "../browser/actions/chatActions.js";
import "./codexCustomizationSettings.contribution.js";
import { AgentSessionProviders, getAgentSessionProviderName } from "../browser/agentSessions/agentSessions.js";
import { IAgentSessionsService } from "../browser/agentSessions/agentSessionsService.js";
import { ChatViewPaneTarget, IChatWidgetService } from "../browser/chat.js";
import { ChatSessionPosition, openChatSession } from "../browser/chatSessions/chatSessions.contribution.js";
import { IAgentHostService } from "../../../../platform/agentHost/common/agentService.js";
import { ChatContextKeys } from "../common/actions/chatContextKeys.js";
import { IChatService } from "../common/chatService/chatService.js";
import { ChatModeKind } from "../common/constants.js";
import { IPluginGitService } from "../common/plugins/pluginGitService.js";
import { registerChatDeveloperActions } from "./actions/chatDeveloperActions.js";
import { registerChatExportZipAction } from "./actions/chatExportZip.js";
import { registerExportAgentTracesDbAction } from "./actions/exportAgentTracesDb.js";
import { registerInstallDictationModelAction } from "./actions/installDictationModelAction.js";
import { shouldWarnForSessionShutdown } from "./chatLifecycle.js";
import { HoldToVoiceChatInChatViewAction, InlineVoiceChatAction, KeywordActivationContribution, QuickVoiceChatAction, ReadChatResponseAloud, StartVoiceChatAction, StopListeningAction, StopListeningAndSubmitAction, StopReadAloud, StopReadChatItemAloud, VoiceChatInChatViewAction } from "./actions/voiceChatActions.js";
import { OpenWorkspaceInAgentsWindowAction, OpenWorkspaceInAgentsContribution, OpenAgentsWindowAction, OpenChatSessionInAgentsWindowAction, AgentsHandoffInputTipContribution, ToggleOpenInAgentsWindowTitleBarAction, OpenWorkspaceInAgentsWindowChatTitleAction, OpenWorkspaceInAgentsWindowTitleBarAction } from "./agentSessions/agentSessionsActions.js";
import { NativeBuiltinToolsContribution } from "./builtInTools/tools.js";
import { NativePluginGitCommandService } from "./pluginGitCommandService.js";
registerSingleton(IPluginGitService, NativePluginGitCommandService, InstantiationType.Delayed);
registerSharedProcessRemoteService(ILocalGitService, "localGit");
let ChatCommandLineHandler = class extends Disposable {
  constructor(environmentService, commandService, workspaceTrustRequestService, logService, layoutService, contextKeyService, chatWidgetService) {
    super();
    this.environmentService = environmentService;
    this.commandService = commandService;
    this.workspaceTrustRequestService = workspaceTrustRequestService;
    this.logService = logService;
    this.layoutService = layoutService;
    this.contextKeyService = contextKeyService;
    this.chatWidgetService = chatWidgetService;
    this.registerListeners();
  }
  static {
    this.ID = "workbench.contrib.chatCommandLineHandler";
  }
  registerListeners() {
    const handleChatRequest = (_, ...args) => {
      const chatArgs = args[0];
      this.logService.trace("vscode:handleChatRequest", chatArgs);
      this.prompt(chatArgs).catch((err) => this.logService.error("vscode:handleChatRequest failed", err));
    };
    ipcRenderer.on("vscode:handleChatRequest", handleChatRequest);
    this._register({ dispose: () => ipcRenderer.removeListener("vscode:handleChatRequest", handleChatRequest) });
    const handleOpenChatSession = (_, ...args) => {
      const sessionUriString = args[0];
      this.logService.trace("vscode:openChatSession", sessionUriString);
      const sessionResource = URI.parse(sessionUriString);
      Promise.resolve(this.chatWidgetService.openSession(sessionResource, ChatViewPaneTarget)).catch((err) => this.logService.error("vscode:openChatSession failed", err));
    };
    ipcRenderer.on("vscode:openChatSession", handleOpenChatSession);
    this._register({ dispose: () => ipcRenderer.removeListener("vscode:openChatSession", handleOpenChatSession) });
  }
  async prompt(args) {
    if (!Array.isArray(args?._)) {
      return;
    }
    const trusted = await this.workspaceTrustRequestService.requestWorkspaceTrust({
      message: localize("copilotWorkspaceTrust", "AI features are currently only supported in trusted workspaces.")
    });
    if (!trusted) {
      return;
    }
    const opts = {
      query: args._.length > 0 ? args._.join(" ") : "",
      mode: args.mode ?? ChatModeKind.Agent,
      attachFiles: args["add-file"]?.map((file) => URI.file(resolve(file)))
      // use `resolve` to deal with relative paths properly
    };
    if (args.maximize) {
      const location = this.contextKeyService.getContextKeyValue(ChatContextKeys.panelLocation.key);
      if (location === ViewContainerLocation.AuxiliaryBar) {
        this.layoutService.setAuxiliaryBarMaximized(true);
      } else if (location === ViewContainerLocation.Panel && !this.layoutService.isPanelMaximized()) {
        this.layoutService.toggleMaximizedPanel();
      }
    }
    await this.commandService.executeCommand(ACTION_ID_NEW_CHAT);
    await this.commandService.executeCommand(CHAT_OPEN_ACTION_ID, opts);
  }
};
ChatCommandLineHandler = __decorateClass([
  __decorateParam(0, INativeWorkbenchEnvironmentService),
  __decorateParam(1, ICommandService),
  __decorateParam(2, IWorkspaceTrustRequestService),
  __decorateParam(3, ILogService),
  __decorateParam(4, IWorkbenchLayoutService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IChatWidgetService)
], ChatCommandLineHandler);
let ChatSuspendThrottlingHandler = class extends Disposable {
  static {
    this.ID = "workbench.contrib.chatSuspendThrottlingHandler";
  }
  constructor(nativeHostService, chatService) {
    super();
    this._register(autorun((reader) => {
      const running = chatService.requestInProgressObs.read(reader);
      nativeHostService.setBackgroundThrottling(!running);
    }));
  }
};
ChatSuspendThrottlingHandler = __decorateClass([
  __decorateParam(0, INativeHostService),
  __decorateParam(1, IChatService)
], ChatSuspendThrottlingHandler);
let ChatLifecycleHandler = class extends Disposable {
  constructor(lifecycleService, agentSessionsService, dialogService, widgetService, contextKeyService, extensionService, environmentService, chatEntitlementService) {
    super();
    this.agentSessionsService = agentSessionsService;
    this.dialogService = dialogService;
    this.widgetService = widgetService;
    this.contextKeyService = contextKeyService;
    this.environmentService = environmentService;
    this.chatEntitlementService = chatEntitlementService;
    this._register(lifecycleService.onBeforeShutdown((e) => {
      e.veto(this.shouldVetoShutdown(e.reason), "veto.chat");
    }));
    this._register(extensionService.onWillStop((e) => {
      e.veto(this.hasSessionThatWillStop(ShutdownReason.CLOSE), localize("chatRequestInProgress", "A session is in progress."));
    }));
  }
  static {
    this.ID = "workbench.contrib.chatLifecycleHandler";
  }
  hasSessionThatWillStop(reason) {
    if (this.chatEntitlementService.sentiment.hidden) {
      return false;
    }
    return this.agentSessionsService.model.sessions.some((session) => shouldWarnForSessionShutdown(session, reason));
  }
  shouldVetoShutdown(reason) {
    if (this.environmentService.enableSmokeTestDriver) {
      return false;
    }
    if (!this.hasSessionThatWillStop(reason)) {
      return false;
    }
    if (ChatContextKeys.skipChatRequestInProgressMessage.getValue(this.contextKeyService) === true) {
      return false;
    }
    return this.doShouldVetoShutdown(reason);
  }
  async doShouldVetoShutdown(reason) {
    this.widgetService.revealWidget();
    let message;
    let detail;
    switch (reason) {
      case ShutdownReason.CLOSE:
        message = localize("closeTheWindow.message", "A session is in progress. Are you sure you want to close the window?");
        detail = localize("closeTheWindow.detail", "The session will stop if you close the window.");
        break;
      case ShutdownReason.LOAD:
        message = localize("changeWorkspace.message", "A session is in progress. Are you sure you want to change the workspace?");
        detail = localize("changeWorkspace.detail", "The session will stop if you change the workspace.");
        break;
      case ShutdownReason.RELOAD:
        message = localize("reloadTheWindow.message", "A session is in progress. Are you sure you want to reload the window?");
        detail = localize("reloadTheWindow.detail", "The session will stop if you reload the window.");
        break;
      default:
        message = isMacintosh ? localize("quit.message", "A session is in progress. Are you sure you want to quit?") : localize("exit.message", "A session is in progress. Are you sure you want to exit?");
        detail = isMacintosh ? localize("quit.detail", "The session will stop if you quit.") : localize("exit.detail", "The session will stop if you exit.");
        break;
    }
    const result = await this.dialogService.confirm({ message, detail });
    return !result.confirmed;
  }
};
ChatLifecycleHandler = __decorateClass([
  __decorateParam(0, ILifecycleService),
  __decorateParam(1, IAgentSessionsService),
  __decorateParam(2, IDialogService),
  __decorateParam(3, IChatWidgetService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IExtensionService),
  __decorateParam(6, INativeWorkbenchEnvironmentService),
  __decorateParam(7, IChatEntitlementService)
], ChatLifecycleHandler);
registerAction2(OpenWorkspaceInAgentsWindowAction);
registerAction2(OpenWorkspaceInAgentsWindowChatTitleAction);
registerAction2(OpenWorkspaceInAgentsWindowTitleBarAction);
registerAction2(ToggleOpenInAgentsWindowTitleBarAction);
registerAction2(OpenAgentsWindowAction);
registerAction2(OpenChatSessionInAgentsWindowAction);
registerAction2(StartVoiceChatAction);
registerAction2(VoiceChatInChatViewAction);
registerAction2(HoldToVoiceChatInChatViewAction);
registerAction2(QuickVoiceChatAction);
registerAction2(InlineVoiceChatAction);
registerAction2(StopListeningAction);
registerAction2(StopListeningAndSubmitAction);
registerAction2(ReadChatResponseAloud);
registerAction2(StopReadChatItemAloud);
registerAction2(StopReadAloud);
registerChatDeveloperActions();
registerChatExportZipAction();
registerExportAgentTracesDbAction();
registerInstallDictationModelAction();
registerWorkbenchContribution2(KeywordActivationContribution.ID, KeywordActivationContribution, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(NativeBuiltinToolsContribution.ID, NativeBuiltinToolsContribution, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(ChatCommandLineHandler.ID, ChatCommandLineHandler, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(ChatSuspendThrottlingHandler.ID, ChatSuspendThrottlingHandler, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(ChatLifecycleHandler.ID, ChatLifecycleHandler, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(OpenWorkspaceInAgentsContribution.ID, OpenWorkspaceInAgentsContribution, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(AgentsHandoffInputTipContribution.ID, AgentsHandoffInputTipContribution, WorkbenchPhase.Eventually);
const AGENT_HOST_REGISTRATION_TIMEOUT_MS = 3e4;
function getCopilotAgentInfo(rootState) {
  if (!rootState || rootState instanceof Error) {
    return void 0;
  }
  return rootState.agents.find((a) => a.provider === "copilotcli");
}
async function resolveAgentHostSessionType(agentHostService) {
  const agent = getCopilotAgentInfo(agentHostService.rootState.value);
  if (agent) {
    return `agent-host-${agent.provider}`;
  }
  const cts = new CancellationTokenSource();
  const waitForAgent = new Promise((res) => {
    const sub = agentHostService.rootState.onDidChange((state) => {
      const found = getCopilotAgentInfo(state);
      if (found) {
        sub.dispose();
        res(found);
      }
    });
    cts.token.onCancellationRequested(() => {
      sub.dispose();
      res(void 0);
    });
  });
  const resolved = await Promise.race([
    waitForAgent,
    timeout(AGENT_HOST_REGISTRATION_TIMEOUT_MS).then(() => {
      cts.cancel();
      cts.dispose();
      return void 0;
    })
  ]);
  if (!resolved) {
    throw new Error("Agent host did not register a copilotcli agent within the timeout period. Ensure the agent host is enabled and running.");
  }
  return `agent-host-${resolved.provider}`;
}
async function openNewAgentHostSession(accessor, position) {
  const agentHostService = accessor.get(IAgentHostService);
  const instantiationService = accessor.get(IInstantiationService);
  const sessionType = await resolveAgentHostSessionType(agentHostService);
  return instantiationService.invokeFunction((innerAccessor) => openChatSession(innerAccessor, {
    type: sessionType,
    displayName: getAgentSessionProviderName(sessionType),
    position
  }));
}
CommandsRegistry.registerCommand(
  `workbench.action.chat.openNewSessionSidebar.${AgentSessionProviders.AgentHostCopilot}`,
  (accessor) => openNewAgentHostSession(accessor, ChatSessionPosition.Sidebar)
);
CommandsRegistry.registerCommand(
  `workbench.action.chat.openNewSessionEditor.${AgentSessionProviders.AgentHostCopilot}`,
  (accessor) => openNewAgentHostSession(accessor, ChatSessionPosition.Editor)
);
