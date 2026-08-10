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
import { timeout } from "../../../../../base/common/async.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { FileAccess } from "../../../../../base/common/network.js";
import { dirname } from "../../../../../base/common/path.js";
import { OperatingSystem, OS } from "../../../../../base/common/platform.js";
import { arch } from "../../../../../base/common/process.js";
import { URI } from "../../../../../base/common/uri.js";
import { localize } from "../../../../../nls.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IEnvironmentService } from "../../../../../platform/environment/common/environment.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { SANDBOX_HELPER_CHANNEL_NAME, SandboxHelperChannelClient } from "../../../../../platform/sandbox/common/sandboxHelperIpc.js";
import { ISandboxHelperService } from "../../../../../platform/sandbox/common/sandboxHelperService.js";
import { TerminalSandboxEngine } from "../../../../../platform/sandbox/common/terminalSandboxEngine.js";
import { readSandboxSetting, SANDBOX_SETTING_KEYS } from "./sandboxSettingsReader.js";
import { TerminalSandboxPreCheckRemediation } from "../../../../../platform/sandbox/common/terminalSandboxService.js";
import { TerminalCapability } from "../../../../../platform/terminal/common/capabilities/capabilities.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { ChatModel } from "../../../chat/common/model/chatModel.js";
import { ChatElicitationRequestPart } from "../../../chat/common/model/chatProgressTypes/chatElicitationRequestPart.js";
import { ElicitationState, IChatService } from "../../../chat/common/chatService/chatService.js";
import { IRemoteAgentService } from "../../../../services/remote/common/remoteAgentService.js";
import { ILifecycleService, WillShutdownJoinerOrder } from "../../../../services/lifecycle/common/lifecycle.js";
import { ITerminalSandboxService as ITerminalSandboxService2, TerminalSandboxPrerequisiteCheck, TerminalSandboxPreCheckRemediation as TerminalSandboxPreCheckRemediation2 } from "../../../../../platform/sandbox/common/terminalSandboxService.js";
const SANDBOX_TEMP_DIR_NAME = "tmp";
function affectsSandboxSettings(e) {
  return SANDBOX_SETTING_KEYS.some((key) => e.affectsConfiguration(key));
}
let TerminalSandboxService = class extends Disposable {
  constructor(_configurationService, fileService, _environmentService, _logService, _remoteAgentService, _workspaceContextService, _productService, lifecycleService, _sandboxHelperService, _chatService, instantiationService) {
    super();
    this._configurationService = _configurationService;
    this._environmentService = _environmentService;
    this._logService = _logService;
    this._remoteAgentService = _remoteAgentService;
    this._workspaceContextService = _workspaceContextService;
    this._productService = _productService;
    this._sandboxHelperService = _sandboxHelperService;
    this._chatService = _chatService;
    this._onDidChangeRoots = this._register(new Emitter());
    this._remoteEnvDetailsPromise = this._remoteAgentService.getEnvironment();
    const onDidChangeSandboxSettings = Event.filter(this._configurationService.onDidChangeConfiguration, affectsSandboxSettings);
    const host = {
      getOS: () => this._resolveOS(),
      getRuntimeInfo: () => this._resolveRuntimeInfo(),
      getUserHome: () => this._resolveUserHome(),
      getSandboxTempDir: () => this._resolveSandboxTempDir(),
      getWorkspaceStorageReadRoot: () => this._resolveWorkspaceStorageReadRoot(),
      getWriteRoots: () => this._workspaceContextService.getWorkspace().folders.map((folder) => folder.uri),
      onDidChangeRoots: this._onDidChangeRoots.event,
      checkSandboxDependencies: () => this._resolveSandboxDependencyStatus(),
      getWindowsMxcFilesystemPolicy: () => this._resolveWindowsMxcFilesystemPolicy(),
      getWindowsMxcEnvironment: () => this._resolveWindowsMxcEnvironment(),
      buildWindowsMxcSandboxPayload: (commandLine, policy, workingDirectory, containerName, containment) => this._resolveWindowsMxcSandboxPayload(commandLine, policy, workingDirectory, containerName, containment),
      getSandboxSetting: (settingId) => this._readSandboxSetting(settingId),
      onDidChangeSandboxSettings: Event.map(onDidChangeSandboxSettings, () => void 0)
    };
    this._engine = this._register(instantiationService.createInstance(TerminalSandboxEngine, host));
    this._register(this._workspaceContextService.onDidChangeWorkspaceFolders(() => this._onDidChangeRoots.fire()));
    this._register(lifecycleService.onWillShutdown((e) => {
      if (!this._engine.getTempDir()) {
        return;
      }
      e.join(this._engine.cleanupTempDir(), {
        id: "join.deleteFilesInSandboxTempDir",
        label: localize("deleteFilesInSandboxTempDir", "Delete Files in Sandbox Temp Dir"),
        order: WillShutdownJoinerOrder.Default
      });
    }));
  }
  // ---- ITerminalSandboxService forwarders ---------------------------------
  isEnabled(precheckInputs) {
    return this._engine.isEnabled(precheckInputs);
  }
  isSandboxAllowNetworkEnabled(precheckInputs) {
    return this._engine.isSandboxAllowNetworkEnabled(precheckInputs);
  }
  getOS() {
    return this._engine.getOS();
  }
  wrapCommand(command, requestUnsandboxedExecution, shell, cwd, commandDetails, requestAllowNetwork) {
    return this._engine.wrapCommand(command, requestUnsandboxedExecution, shell, cwd, commandDetails, requestAllowNetwork);
  }
  checkFileAccess(permission, paths, precheckInputs) {
    return this._engine.checkFileAccess(permission, paths, precheckInputs);
  }
  checkForSandboxingPrereqs(forceRefresh = false, precheckInputs) {
    return this._engine.checkForSandboxingPrereqs(forceRefresh, precheckInputs);
  }
  getSandboxConfigPath(forceRefresh = false, precheckInputs) {
    return this._engine.getSandboxConfigPath(forceRefresh, precheckInputs);
  }
  getTempDir() {
    return this._engine.getTempDir();
  }
  setNeedsForceUpdateConfigFile() {
    this._engine.setNeedsForceUpdateConfigFile();
  }
  getResolvedNetworkDomains() {
    return this._engine.getResolvedNetworkDomains();
  }
  getMissingSandboxDependencies() {
    return this._engine.getMissingSandboxDependencies();
  }
  // ---- host adapter helpers -----------------------------------------------
  async _resolveRemoteEnv() {
    if (this._remoteEnvDetails === void 0) {
      this._remoteEnvDetails = await this._remoteEnvDetailsPromise;
    }
    return this._remoteEnvDetails;
  }
  async _resolveOS() {
    const remoteEnv = await this._resolveRemoteEnv();
    return remoteEnv ? remoteEnv.os : OS;
  }
  _readSandboxSetting(settingId) {
    return readSandboxSetting(this._configurationService, this._logService, settingId);
  }
  async _resolveRuntimeInfo() {
    const remoteEnv = await this._resolveRemoteEnv();
    if (remoteEnv) {
      return { appRoot: remoteEnv.os === OperatingSystem.Windows ? this._toWindowsPath(remoteEnv.appRoot) : remoteEnv.appRoot.path, execPath: remoteEnv.execPath, runAsNode: false, arch: remoteEnv.arch, nativeModulesDir: "node_modules" };
    }
    const localAppRootUri = FileAccess.asFileUri("");
    const localAppRoot = OS === OperatingSystem.Windows ? dirname(localAppRootUri.fsPath) : dirname(localAppRootUri.path);
    const nativeEnv = this._environmentService;
    const nativeModulesDir = this._environmentService.isBuilt ? "node_modules.asar.unpacked" : "node_modules";
    return { appRoot: localAppRoot, execPath: nativeEnv.execPath, runAsNode: true, arch, nativeModulesDir };
  }
  _toWindowsPath(uri) {
    let value;
    if (uri.authority && uri.path.length > 1 && uri.scheme === "file") {
      value = `\\\\${uri.authority}${uri.path}`;
    } else if (/^\/[a-zA-Z]:/.test(uri.path)) {
      value = uri.path.slice(1);
    } else {
      value = uri.fsPath;
    }
    return value.replace(/\//g, "\\");
  }
  async _resolveUserHome() {
    const remoteEnv = await this._resolveRemoteEnv();
    if (remoteEnv?.userHome) {
      return remoteEnv.userHome;
    }
    const nativeEnv = this._environmentService;
    return nativeEnv.userHome;
  }
  async _resolveSandboxTempDir() {
    const remoteEnv = await this._resolveRemoteEnv();
    const sandboxTempDirName = this._getSandboxWindowTempDirName();
    if (remoteEnv?.userHome) {
      const sandboxRoot = URI.joinPath(remoteEnv.userHome, this._productService.serverDataFolderName ?? this._productService.dataFolderName, SANDBOX_TEMP_DIR_NAME);
      return sandboxTempDirName ? URI.joinPath(sandboxRoot, sandboxTempDirName) : sandboxRoot;
    }
    const nativeEnv = this._environmentService;
    if (nativeEnv.userHome) {
      const sandboxRoot = URI.joinPath(nativeEnv.userHome, this._productService.dataFolderName, SANDBOX_TEMP_DIR_NAME);
      return sandboxTempDirName ? URI.joinPath(sandboxRoot, sandboxTempDirName) : sandboxRoot;
    }
    return void 0;
  }
  async _resolveWorkspaceStorageReadRoot() {
    const remoteEnv = await this._resolveRemoteEnv();
    const workspaceStorageHome = remoteEnv?.workspaceStorageHome ?? this._environmentService.workspaceStorageHome;
    const workspaceId = this._workspaceContextService.getWorkspace().id;
    return URI.joinPath(workspaceStorageHome, workspaceId);
  }
  _getSandboxWindowTempDirName() {
    const workbenchEnv = this._environmentService;
    const windowId = workbenchEnv.window?.id;
    return typeof windowId === "number" ? `tmp_vscode_${windowId}` : void 0;
  }
  async _resolveSandboxDependencyStatus() {
    const connection = this._remoteAgentService.getConnection();
    if (connection) {
      return connection.withChannel(SANDBOX_HELPER_CHANNEL_NAME, (channel) => {
        const sandboxHelper = new SandboxHelperChannelClient(channel);
        return sandboxHelper.checkSandboxDependencies();
      });
    }
    return this._sandboxHelperService.checkSandboxDependencies();
  }
  async _resolveWindowsMxcFilesystemPolicy() {
    const connection = this._remoteAgentService.getConnection();
    if (connection) {
      return connection.withChannel(SANDBOX_HELPER_CHANNEL_NAME, (channel) => {
        const sandboxHelper = new SandboxHelperChannelClient(channel);
        return sandboxHelper.getWindowsMxcFilesystemPolicy();
      });
    }
    return this._sandboxHelperService.getWindowsMxcFilesystemPolicy();
  }
  async _resolveWindowsMxcEnvironment() {
    const connection = this._remoteAgentService.getConnection();
    if (connection) {
      return connection.withChannel(SANDBOX_HELPER_CHANNEL_NAME, (channel) => {
        const sandboxHelper = new SandboxHelperChannelClient(channel);
        return sandboxHelper.getWindowsMxcEnvironment();
      });
    }
    return this._sandboxHelperService.getWindowsMxcEnvironment();
  }
  async _resolveWindowsMxcSandboxPayload(commandLine, policy, workingDirectory, containerName, containment) {
    const connection = this._remoteAgentService.getConnection();
    if (connection) {
      return connection.withChannel(SANDBOX_HELPER_CHANNEL_NAME, (channel) => {
        const sandboxHelper = new SandboxHelperChannelClient(channel);
        return sandboxHelper.buildWindowsMxcSandboxPayload(commandLine, policy, workingDirectory, containerName, containment);
      });
    }
    return this._sandboxHelperService.buildWindowsMxcSandboxPayload(commandLine, policy, workingDirectory, containerName, containment);
  }
  // ---- workbench-only flows -----------------------------------------------
  async installMissingSandboxDependencies(missingDependencies, sessionResource, token, options) {
    const status = await this._resolveSandboxDependencyStatus();
    if (!status?.dependencyInstallCommand) {
      return { exitCode: void 0 };
    }
    const depsList = missingDependencies.map((dependency) => this._quoteShellArgument(dependency)).join(" ");
    return this._runSandboxPrerequisiteCommand(`${status.dependencyInstallCommand} ${depsList}`, sessionResource, token, options);
  }
  async runSandboxRemediation(remediation, sessionResource, token, options) {
    let command;
    switch (remediation) {
      case TerminalSandboxPreCheckRemediation.DisableUnprivilagedusernamespaceRestriction:
        command = "sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0";
        break;
      default:
        throw new Error("Unsupported sandbox remediation");
    }
    return this._runSandboxPrerequisiteCommand(command, sessionResource, token, options);
  }
  async _runSandboxPrerequisiteCommand(command, sessionResource, token, options) {
    const instance = await options.createTerminal();
    let installCommandSent = false;
    const completionPromise = new Promise((resolve) => {
      const store = new DisposableStore();
      let resolved = false;
      const resolveOnce = (code) => {
        if (resolved) {
          return;
        }
        resolved = true;
        store.dispose();
        resolve(code);
      };
      const attachListener = () => {
        const detection = instance.capabilities.get(TerminalCapability.CommandDetection);
        if (detection) {
          store.add(detection.onCommandFinished((cmd) => resolveOnce(cmd.exitCode)));
        }
      };
      attachListener();
      store.add(instance.capabilities.onDidAddCapability((e) => {
        if (e.id === TerminalCapability.CommandDetection) {
          attachListener();
        }
      }));
      store.add(instance.onDisposed(() => resolveOnce(void 0)));
      store.add(token.onCancellationRequested(() => resolveOnce(void 0)));
      const safetyTimeout = timeout(5 * 60 * 1e3);
      store.add({ dispose: () => safetyTimeout.cancel() });
      safetyTimeout.then(() => resolveOnce(void 0));
      const passwordPrompt = this._createMissingDependencyPasswordPrompt(sessionResource, {
        focusTerminal: () => options.focusTerminal(instance),
        onDidInputData: instance.onDidInputData,
        onDisposed: instance.onDisposed,
        didSendInstallCommand: () => installCommandSent
      }, token);
      store.add(passwordPrompt);
    });
    await instance.sendText(command, true);
    installCommandSent = true;
    return { exitCode: await completionPromise };
  }
  _quoteShellArgument(value) {
    return `'${value.replace(/'/g, `'\\''`)}'`;
  }
  /**
   * Shows a chat elicitation that keeps the "Install" flow grounded in chat while
   * the user focuses the terminal and types a sudo password.
   */
  _createMissingDependencyPasswordPrompt(sessionResource, promptContext, token) {
    const chatModel = sessionResource && this._chatService.getSession(sessionResource);
    if (!(chatModel instanceof ChatModel)) {
      return new DisposableStore();
    }
    const request = chatModel.getRequests().at(-1);
    if (!request) {
      return new DisposableStore();
    }
    const part = new ChatElicitationRequestPart(
      localize("runInTerminal.missingDeps.passwordPromptTitle", "The terminal is awaiting input."),
      new MarkdownString(localize(
        "runInTerminal.missingDeps.passwordPromptMessage",
        "Applying sandbox prerequisites may prompt for your sudo password. Select Focus Terminal to type it in the terminal."
      )),
      "",
      localize("runInTerminal.missingDeps.focusTerminal", "Focus Terminal"),
      void 0,
      async () => {
        await promptContext.focusTerminal();
        return ElicitationState.Pending;
      }
    );
    chatModel.acceptResponseProgress(request, part);
    const store = new DisposableStore();
    const disposePrompt = () => store.dispose();
    store.add({ dispose: () => part.hide() });
    store.add(token.onCancellationRequested(disposePrompt));
    store.add(promptContext.onDisposed(disposePrompt));
    store.add(promptContext.onDidInputData((data) => {
      if (promptContext.didSendInstallCommand() && data.length > 0) {
        disposePrompt();
      }
    }));
    return store;
  }
};
TerminalSandboxService = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IFileService),
  __decorateParam(2, IEnvironmentService),
  __decorateParam(3, ILogService),
  __decorateParam(4, IRemoteAgentService),
  __decorateParam(5, IWorkspaceContextService),
  __decorateParam(6, IProductService),
  __decorateParam(7, ILifecycleService),
  __decorateParam(8, ISandboxHelperService),
  __decorateParam(9, IChatService),
  __decorateParam(10, IInstantiationService)
], TerminalSandboxService);
export {
  ITerminalSandboxService2 as ITerminalSandboxService,
  TerminalSandboxPreCheckRemediation2 as TerminalSandboxPreCheckRemediation,
  TerminalSandboxPrerequisiteCheck,
  TerminalSandboxService
};
