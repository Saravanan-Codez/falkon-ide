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
import { Codicon } from "../../../../../base/common/codicons.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../nls.js";
import { MenuId } from "../../../../../platform/actions/common/actions.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { AgentSandboxSettingId } from "../../../../../platform/sandbox/common/settings.js";
import { TerminalSettingId } from "../../../../../platform/terminal/common/terminal.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../common/contributions.js";
import { IChatWidgetService } from "../../../chat/browser/chat.js";
import { ChatContextKeys } from "../../../chat/common/actions/chatContextKeys.js";
import { ILanguageModelToolsService } from "../../../chat/common/tools/languageModelToolsService.js";
import { IToolResultCompressor } from "../../../chat/common/tools/toolResultCompressor.js";
import { registerActiveInstanceAction, sharedWhenClause } from "../../../terminal/browser/terminalActions.js";
import { TerminalContextMenuGroup } from "../../../terminal/browser/terminalMenus.js";
import { TerminalContextKeys } from "../../../terminal/common/terminalContextKey.js";
import { TerminalChatAgentToolsCommandId } from "../common/terminal.chatAgentTools.js";
import { TerminalChatAgentToolsSettingId } from "../common/terminalChatAgentToolsConfiguration.js";
import { AgentNetworkDomainSettingId } from "../../../../../platform/networkFilter/common/settings.js";
import { AgentHostSandboxForwarder } from "./agentHostSandboxForwarder.js";
import { GetTerminalLastCommandTool, GetTerminalLastCommandToolData } from "./tools/getTerminalLastCommandTool.js";
import { KillTerminalTool, KillTerminalToolData } from "./tools/killTerminalTool.js";
import { GetTerminalOutputTool, GetTerminalOutputToolData } from "./tools/getTerminalOutputTool.js";
import { SendToTerminalTool, SendToTerminalToolData } from "./tools/sendToTerminalTool.js";
import { GetTerminalSelectionTool, GetTerminalSelectionToolData } from "./tools/getTerminalSelectionTool.js";
import { ConfirmTerminalCommandTool, ConfirmTerminalCommandToolData } from "./tools/runInTerminalConfirmationTool.js";
import { RunInTerminalTool, createRunInTerminalToolData } from "./tools/runInTerminalTool.js";
import { CreateAndRunTaskTool, CreateAndRunTaskToolData } from "./tools/task/createAndRunTaskTool.js";
import { GetTaskOutputTool, GetTaskOutputToolData } from "./tools/task/getTaskOutputTool.js";
import { RunTaskTool, RunTaskToolData } from "./tools/task/runTaskTool.js";
import { registerTerminalCompressors } from "./tools/terminalOutputCompressor.js";
import { InstantiationType, registerSingleton } from "../../../../../platform/instantiation/common/extensions.js";
import { IWindowsMxcTerminalSandboxRuntime, WindowsMxcTerminalSandboxRuntime } from "../../../../../platform/sandbox/common/terminalSandboxMxcRuntime.js";
import { ITerminalSandboxService, TerminalSandboxService } from "../common/terminalSandboxService.js";
import { isNumber } from "../../../../../base/common/types.js";
registerSingleton(IWindowsMxcTerminalSandboxRuntime, WindowsMxcTerminalSandboxRuntime, InstantiationType.Delayed);
registerSingleton(ITerminalSandboxService, TerminalSandboxService, InstantiationType.Delayed);
let ShellIntegrationTimeoutMigrationContribution = class extends Disposable {
  static {
    this.ID = "terminal.shellIntegrationTimeoutMigration";
  }
  constructor(configurationService) {
    super();
    const deprecated = configurationService.inspect(TerminalChatAgentToolsSettingId.ShellIntegrationTimeout);
    const target = configurationService.inspect(TerminalSettingId.ShellIntegrationTimeout);
    if (deprecated.userValue !== void 0 && target.userValue === void 0 && isNumber(deprecated.userValue)) {
      configurationService.updateValue(TerminalSettingId.ShellIntegrationTimeout, deprecated.userValue, ConfigurationTarget.USER);
    }
    if (deprecated.workspaceValue !== void 0 && target.workspaceValue === void 0 && isNumber(deprecated.workspaceValue)) {
      configurationService.updateValue(TerminalSettingId.ShellIntegrationTimeout, deprecated.workspaceValue, ConfigurationTarget.WORKSPACE);
    }
  }
};
ShellIntegrationTimeoutMigrationContribution = __decorateClass([
  __decorateParam(0, IConfigurationService)
], ShellIntegrationTimeoutMigrationContribution);
registerWorkbenchContribution2(ShellIntegrationTimeoutMigrationContribution.ID, ShellIntegrationTimeoutMigrationContribution, WorkbenchPhase.Eventually);
let OutputLocationMigrationContribution = class extends Disposable {
  static {
    this.ID = "terminal.outputLocationMigration";
  }
  constructor(configurationService) {
    super();
    const currentValue = configurationService.getValue(TerminalChatAgentToolsSettingId.OutputLocation);
    if (currentValue === "none") {
      configurationService.updateValue(TerminalChatAgentToolsSettingId.OutputLocation, "chat");
    }
  }
};
OutputLocationMigrationContribution = __decorateClass([
  __decorateParam(0, IConfigurationService)
], OutputLocationMigrationContribution);
registerWorkbenchContribution2(OutputLocationMigrationContribution.ID, OutputLocationMigrationContribution, WorkbenchPhase.Eventually);
let ChatAgentToolsContribution = class extends Disposable {
  constructor(_instantiationService, _toolsService, _configurationService, toolResultCompressor) {
    super();
    this._instantiationService = _instantiationService;
    this._toolsService = _toolsService;
    this._configurationService = _configurationService;
    this._runInTerminalToolRegistration = this._register(new MutableDisposable());
    this._runInTerminalToolRegistrationVersion = 0;
    registerTerminalCompressors(toolResultCompressor);
    const confirmTerminalCommandTool = _instantiationService.createInstance(ConfirmTerminalCommandTool);
    this._register(_toolsService.registerTool(ConfirmTerminalCommandToolData, confirmTerminalCommandTool));
    const getTerminalOutputTool = _instantiationService.createInstance(GetTerminalOutputTool);
    this._register(_toolsService.registerTool(GetTerminalOutputToolData, getTerminalOutputTool));
    this._register(_toolsService.executeToolSet.addTool(GetTerminalOutputToolData));
    const killTerminalTool = _instantiationService.createInstance(KillTerminalTool);
    this._register(_toolsService.registerTool(KillTerminalToolData, killTerminalTool));
    this._register(_toolsService.executeToolSet.addTool(KillTerminalToolData));
    const sendToTerminalTool = _instantiationService.createInstance(SendToTerminalTool);
    this._register(_toolsService.registerTool(SendToTerminalToolData, sendToTerminalTool));
    this._register(_toolsService.executeToolSet.addTool(SendToTerminalToolData));
    this._registerRunInTerminalTool();
    const getTerminalSelectionTool = _instantiationService.createInstance(GetTerminalSelectionTool);
    this._register(_toolsService.registerTool(GetTerminalSelectionToolData, getTerminalSelectionTool));
    const getTerminalLastCommandTool = _instantiationService.createInstance(GetTerminalLastCommandTool);
    this._register(_toolsService.registerTool(GetTerminalLastCommandToolData, getTerminalLastCommandTool));
    this._register(_toolsService.readToolSet.addTool(GetTerminalSelectionToolData));
    this._register(_toolsService.readToolSet.addTool(GetTerminalLastCommandToolData));
    const runTaskTool = _instantiationService.createInstance(RunTaskTool);
    this._register(_toolsService.registerTool(RunTaskToolData, runTaskTool));
    const getTaskOutputTool = _instantiationService.createInstance(GetTaskOutputTool);
    this._register(_toolsService.registerTool(GetTaskOutputToolData, getTaskOutputTool));
    const createAndRunTaskTool = _instantiationService.createInstance(CreateAndRunTaskTool);
    this._register(_toolsService.registerTool(CreateAndRunTaskToolData, createAndRunTaskTool));
    this._register(_toolsService.executeToolSet.addTool(RunTaskToolData));
    this._register(_toolsService.executeToolSet.addTool(CreateAndRunTaskToolData));
    this._register(_toolsService.readToolSet.addTool(GetTaskOutputToolData));
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(AgentSandboxSettingId.AgentSandboxEnabled) || e.affectsConfiguration(AgentSandboxSettingId.AgentSandboxWindowsEnabled) || e.affectsConfiguration(AgentSandboxSettingId.AgentSandboxAllowNetwork) || e.affectsConfiguration(AgentSandboxSettingId.AgentSandboxAllowUnsandboxedCommands) || e.affectsConfiguration(AgentNetworkDomainSettingId.AllowedNetworkDomains) || e.affectsConfiguration(AgentNetworkDomainSettingId.DeniedNetworkDomains) || e.affectsConfiguration(TerminalChatAgentToolsSettingId.AgentSandboxLinuxFileSystem) || e.affectsConfiguration(TerminalChatAgentToolsSettingId.AgentSandboxMacFileSystem) || e.affectsConfiguration(TerminalChatAgentToolsSettingId.AgentSandboxWindowsFileSystem)) {
        this._registerRunInTerminalTool();
      }
    }));
  }
  static {
    this.ID = "terminal.chatAgentTools";
  }
  _registerRunInTerminalTool() {
    const version = ++this._runInTerminalToolRegistrationVersion;
    this._instantiationService.invokeFunction(createRunInTerminalToolData).then((runInTerminalToolData) => {
      if (this._store.isDisposed || version !== this._runInTerminalToolRegistrationVersion) {
        return;
      }
      if (!this._runInTerminalTool) {
        this._runInTerminalTool = this._register(this._instantiationService.createInstance(RunInTerminalTool));
      }
      this._runInTerminalToolRegistration.value = void 0;
      const store = new DisposableStore();
      store.add(this._toolsService.registerToolData(runInTerminalToolData));
      store.add(this._toolsService.registerToolImplementation(runInTerminalToolData.id, this._runInTerminalTool));
      store.add(this._toolsService.executeToolSet.addTool(runInTerminalToolData));
      this._runInTerminalToolRegistration.value = store;
    });
  }
};
ChatAgentToolsContribution = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, ILanguageModelToolsService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IToolResultCompressor)
], ChatAgentToolsContribution);
registerWorkbenchContribution2(ChatAgentToolsContribution.ID, ChatAgentToolsContribution, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(AgentHostSandboxForwarder.ID, AgentHostSandboxForwarder, WorkbenchPhase.AfterRestored);
registerActiveInstanceAction({
  id: TerminalChatAgentToolsCommandId.ChatAddTerminalSelection,
  title: localize("addTerminalSelection", "Add Terminal Selection to Chat"),
  precondition: ContextKeyExpr.and(ChatContextKeys.enabled, sharedWhenClause.terminalAvailable),
  menu: [
    {
      id: MenuId.TerminalInstanceContext,
      group: TerminalContextMenuGroup.Chat,
      order: 1,
      when: ContextKeyExpr.and(ChatContextKeys.enabled, TerminalContextKeys.textSelected)
    }
  ],
  run: async (activeInstance, _c, accessor) => {
    const chatWidgetService = accessor.get(IChatWidgetService);
    const selection = activeInstance.selection;
    if (!selection) {
      return;
    }
    const chatView = chatWidgetService.lastFocusedWidget ?? await chatWidgetService.revealWidget();
    if (!chatView) {
      return;
    }
    chatView.attachmentModel.addContext({
      id: `terminal-selection-${Date.now()}`,
      kind: "generic",
      name: localize("terminalSelection", "Terminal Selection"),
      fullName: localize("terminalSelection", "Terminal Selection"),
      value: selection,
      icon: Codicon.terminal
    });
    chatView.focusInput();
  }
});
export {
  ChatAgentToolsContribution
};
