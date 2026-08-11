import * as os from "os";
import { Emitter, Event } from "../../base/common/event.js";
import { cloneAndChange } from "../../base/common/objects.js";
import { Disposable } from "../../base/common/lifecycle.js";
import * as path from "../../base/common/path.js";
import * as platform from "../../base/common/platform.js";
import { URI } from "../../base/common/uri.js";
import { createRandomIPCHandle } from "../../base/parts/ipc/node/ipc.net.js";
import { createURITransformer } from "../../base/common/uriTransformer.js";
import { CLIServerBase } from "../../workbench/api/node/extHostCLIServer.js";
import { MergedEnvironmentVariableCollection } from "../../platform/terminal/common/environmentVariableCollection.js";
import { deserializeEnvironmentDescriptionMap, deserializeEnvironmentVariableCollection } from "../../platform/terminal/common/environmentVariableShared.js";
import { RemoteTerminalChannelEvent, RemoteTerminalChannelRequest } from "../../workbench/contrib/terminal/common/remote/terminal.js";
import * as terminalEnvironment from "../../workbench/contrib/terminal/common/terminalEnvironment.js";
import { AbstractVariableResolverService } from "../../workbench/services/configurationResolver/common/variableResolver.js";
import { buildUserEnvironment } from "./extensionHostConnection.js";
import { promiseWithResolvers } from "../../base/common/async.js";
import { shouldUseEnvironmentVariableCollection } from "../../platform/terminal/common/terminalEnvironment.js";
class CustomVariableResolver extends AbstractVariableResolverService {
  constructor(env, workspaceFolders, activeFileResource, resolvedVariables, extensionService) {
    super({
      getFolderUri: (folderName) => {
        const found = workspaceFolders.filter((f) => f.name === folderName);
        if (found && found.length > 0) {
          return found[0].uri;
        }
        return void 0;
      },
      getWorkspaceFolderCount: () => {
        return workspaceFolders.length;
      },
      getConfigurationValue: (folderUri, section) => {
        return resolvedVariables[`config:${section}`];
      },
      getExecPath: () => {
        return env["VSCODE_EXEC_PATH"];
      },
      getAppRoot: () => {
        return env["VSCODE_CWD"];
      },
      getFilePath: () => {
        if (activeFileResource) {
          return path.normalize(activeFileResource.fsPath);
        }
        return void 0;
      },
      getSelectedText: () => {
        return resolvedVariables["selectedText"];
      },
      getLineNumber: () => {
        return resolvedVariables["lineNumber"];
      },
      getColumnNumber: () => {
        return resolvedVariables["columnNumber"];
      },
      getExtension: async (id) => {
        const installed = await extensionService.getInstalled();
        const found = installed.find((e) => e.identifier.id === id);
        return found && { extensionLocation: found.location };
      }
    }, void 0, Promise.resolve(os.homedir()), Promise.resolve(env));
  }
}
class RemoteTerminalChannel extends Disposable {
  constructor(_environmentService, _logService, _ptyHostService, _productService, _extensionManagementService, _configurationService) {
    super();
    this._environmentService = _environmentService;
    this._logService = _logService;
    this._ptyHostService = _ptyHostService;
    this._productService = _productService;
    this._extensionManagementService = _extensionManagementService;
    this._configurationService = _configurationService;
    this._lastReqId = 0;
    this._pendingCommands = /* @__PURE__ */ new Map();
    this._onExecuteCommand = this._register(new Emitter());
    this.onExecuteCommand = this._onExecuteCommand.event;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async call(ctx, command, args) {
    switch (command) {
      case RemoteTerminalChannelRequest.RestartPtyHost:
        return this._ptyHostService.restartPtyHost.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.CreateProcess: {
        const uriTransformer = createURITransformer(ctx.remoteAuthority);
        return this._createProcess(uriTransformer, args);
      }
      case RemoteTerminalChannelRequest.AttachToProcess:
        return this._ptyHostService.attachToProcess.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.DetachFromProcess:
        return this._ptyHostService.detachFromProcess.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.ListProcesses:
        return this._ptyHostService.listProcesses.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.GetLatency:
        return this._ptyHostService.getLatency.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.GetPerformanceMarks:
        return this._ptyHostService.getPerformanceMarks.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.OrphanQuestionReply:
        return this._ptyHostService.orphanQuestionReply.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.AcceptPtyHostResolvedVariables:
        return this._ptyHostService.acceptPtyHostResolvedVariables.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.Start:
        return this._ptyHostService.start.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.Input:
        return this._ptyHostService.input.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.SendSignal:
        return this._ptyHostService.sendSignal.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.AcknowledgeDataEvent:
        return this._ptyHostService.acknowledgeDataEvent.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.Shutdown:
        return this._ptyHostService.shutdown.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.Resize:
        return this._ptyHostService.resize.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.ClearBuffer:
        return this._ptyHostService.clearBuffer.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.GetInitialCwd:
        return this._ptyHostService.getInitialCwd.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.GetCwd:
        return this._ptyHostService.getCwd.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.ProcessBinary:
        return this._ptyHostService.processBinary.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.SendCommandResult:
        return this._sendCommandResult(args[0], args[1], args[2]);
      case RemoteTerminalChannelRequest.InstallAutoReply:
        return this._ptyHostService.installAutoReply.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.UninstallAllAutoReplies:
        return this._ptyHostService.uninstallAllAutoReplies.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.GetDefaultSystemShell:
        return this._getDefaultSystemShell.apply(this, args);
      case RemoteTerminalChannelRequest.GetProfiles:
        return this._getProfiles.apply(this, args);
      case RemoteTerminalChannelRequest.GetEnvironment:
        return this._getEnvironment();
      case RemoteTerminalChannelRequest.GetWslPath:
        return this._getWslPath(args[0], args[1]);
      case RemoteTerminalChannelRequest.GetTerminalLayoutInfo:
        return this._ptyHostService.getTerminalLayoutInfo(args);
      case RemoteTerminalChannelRequest.SetTerminalLayoutInfo:
        return this._ptyHostService.setTerminalLayoutInfo(args);
      case RemoteTerminalChannelRequest.SerializeTerminalState:
        return this._ptyHostService.serializeTerminalState.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.ReviveTerminalProcesses:
        return this._ptyHostService.reviveTerminalProcesses.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.GetRevivedPtyNewId:
        return this._ptyHostService.getRevivedPtyNewId.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.SetUnicodeVersion:
        return this._ptyHostService.setUnicodeVersion.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.SetNextCommandId:
        return this._ptyHostService.setNextCommandId.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.ReduceConnectionGraceTime:
        return this._reduceConnectionGraceTime();
      case RemoteTerminalChannelRequest.UpdateIcon:
        return this._ptyHostService.updateIcon.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.UpdateTitle:
        return this._ptyHostService.updateTitle.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.UpdateProperty:
        return this._ptyHostService.updateProperty.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.RefreshProperty:
        return this._ptyHostService.refreshProperty.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.RequestDetachInstance:
        return this._ptyHostService.requestDetachInstance(args[0], args[1]);
      case RemoteTerminalChannelRequest.AcceptDetachedInstance:
        return this._ptyHostService.acceptDetachInstanceReply(args[0], args[1]);
      case RemoteTerminalChannelRequest.FreePortKillProcess:
        return this._ptyHostService.freePortKillProcess.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.AcceptDetachInstanceReply:
        return this._ptyHostService.acceptDetachInstanceReply.apply(this._ptyHostService, args);
    }
    throw new Error(`IPC Command ${command} not found`);
  }
  listen(_, event, _arg) {
    switch (event) {
      case RemoteTerminalChannelEvent.OnPtyHostExitEvent:
        return this._ptyHostService.onPtyHostExit || Event.None;
      case RemoteTerminalChannelEvent.OnPtyHostStartEvent:
        return this._ptyHostService.onPtyHostStart || Event.None;
      case RemoteTerminalChannelEvent.OnPtyHostUnresponsiveEvent:
        return this._ptyHostService.onPtyHostUnresponsive || Event.None;
      case RemoteTerminalChannelEvent.OnPtyHostResponsiveEvent:
        return this._ptyHostService.onPtyHostResponsive || Event.None;
      case RemoteTerminalChannelEvent.OnPtyHostRequestResolveVariablesEvent:
        return this._ptyHostService.onPtyHostRequestResolveVariables || Event.None;
      case RemoteTerminalChannelEvent.OnProcessDataEvent:
        return this._ptyHostService.onProcessData;
      case RemoteTerminalChannelEvent.OnProcessReadyEvent:
        return this._ptyHostService.onProcessReady;
      case RemoteTerminalChannelEvent.OnProcessExitEvent:
        return this._ptyHostService.onProcessExit;
      case RemoteTerminalChannelEvent.OnProcessReplayEvent:
        return this._ptyHostService.onProcessReplay;
      case RemoteTerminalChannelEvent.OnProcessOrphanQuestion:
        return this._ptyHostService.onProcessOrphanQuestion;
      case RemoteTerminalChannelEvent.OnExecuteCommand:
        return this.onExecuteCommand;
      case RemoteTerminalChannelEvent.OnDidRequestDetach:
        return this._ptyHostService.onDidRequestDetach || Event.None;
      case RemoteTerminalChannelEvent.OnDidChangeProperty:
        return this._ptyHostService.onDidChangeProperty;
    }
    throw new Error(`IPC Command ${event} not found`);
  }
  async _createProcess(uriTransformer, args) {
    const shellLaunchConfig = {
      name: args.shellLaunchConfig.name,
      executable: args.shellLaunchConfig.executable,
      args: args.shellLaunchConfig.args,
      cwd: typeof args.shellLaunchConfig.cwd === "string" || typeof args.shellLaunchConfig.cwd === "undefined" ? args.shellLaunchConfig.cwd : URI.revive(uriTransformer.transformIncoming(args.shellLaunchConfig.cwd)),
      env: args.shellLaunchConfig.env,
      useShellEnvironment: args.shellLaunchConfig.useShellEnvironment,
      reconnectionProperties: args.shellLaunchConfig.reconnectionProperties,
      type: args.shellLaunchConfig.type,
      isFeatureTerminal: args.shellLaunchConfig.isFeatureTerminal,
      forceShellIntegration: args.shellLaunchConfig.forceShellIntegration,
      tabActions: args.shellLaunchConfig.tabActions,
      shellIntegrationEnvironmentReporting: args.shellLaunchConfig.shellIntegrationEnvironmentReporting
    };
    const baseEnv = await buildUserEnvironment(args.resolverEnv, !!args.shellLaunchConfig.useShellEnvironment, platform.language, this._environmentService, this._logService, this._configurationService);
    this._logService.trace("baseEnv", baseEnv);
    const reviveWorkspaceFolder = (workspaceData) => {
      return {
        uri: URI.revive(uriTransformer.transformIncoming(workspaceData.uri)),
        name: workspaceData.name,
        index: workspaceData.index,
        toResource: () => {
          throw new Error("Not implemented");
        }
      };
    };
    const workspaceFolders = args.workspaceFolders.map(reviveWorkspaceFolder);
    const activeWorkspaceFolder = args.activeWorkspaceFolder ? reviveWorkspaceFolder(args.activeWorkspaceFolder) : void 0;
    const activeFileResource = args.activeFileResource ? URI.revive(uriTransformer.transformIncoming(args.activeFileResource)) : void 0;
    const customVariableResolver = new CustomVariableResolver(baseEnv, workspaceFolders, activeFileResource, args.resolvedVariables, this._extensionManagementService);
    const variableResolver = terminalEnvironment.createVariableResolver(activeWorkspaceFolder, baseEnv, customVariableResolver);
    const initialCwd = await terminalEnvironment.getCwd(shellLaunchConfig, os.homedir(), variableResolver, activeWorkspaceFolder?.uri, args.configuration["terminal.integrated.cwd"], this._logService);
    shellLaunchConfig.cwd = initialCwd;
    const envPlatformKey = platform.isWindows ? "terminal.integrated.env.windows" : platform.isMacintosh ? "terminal.integrated.env.osx" : "terminal.integrated.env.linux";
    const envFromConfig = args.configuration[envPlatformKey];
    const env = await terminalEnvironment.createTerminalEnvironment(
      shellLaunchConfig,
      envFromConfig,
      variableResolver,
      this._productService.version,
      args.configuration["terminal.integrated.detectLocale"],
      baseEnv
    );
    if (shouldUseEnvironmentVariableCollection(shellLaunchConfig)) {
      const entries = [];
      for (const [k, v, d] of args.envVariableCollections) {
        entries.push([k, { map: deserializeEnvironmentVariableCollection(v), descriptionMap: deserializeEnvironmentDescriptionMap(d) }]);
      }
      const envVariableCollections = new Map(entries);
      const mergedCollection = new MergedEnvironmentVariableCollection(envVariableCollections);
      const workspaceFolder = activeWorkspaceFolder ? activeWorkspaceFolder ?? void 0 : void 0;
      await mergedCollection.applyToProcessEnvironment(env, { workspaceFolder }, variableResolver);
    }
    this._logService.debug(`Terminal process launching on remote agent`, { shellLaunchConfig, initialCwd, cols: args.cols, rows: args.rows, env });
    const ipcHandlePath = createRandomIPCHandle();
    env.VSCODE_IPC_HOOK_CLI = ipcHandlePath;
    const persistentProcessId = await this._ptyHostService.createProcess(shellLaunchConfig, initialCwd, args.cols, args.rows, args.unicodeVersion, env, baseEnv, args.options, args.shouldPersistTerminal, args.workspaceId, args.workspaceName);
    const commandsExecuter = {
      executeCommand: (id, ...args2) => this._executeCommand(persistentProcessId, id, args2, uriTransformer)
    };
    const cliServer = new CLIServerBase(commandsExecuter, this._logService, ipcHandlePath);
    this._ptyHostService.onProcessExit((e) => e.id === persistentProcessId && cliServer.dispose());
    return {
      persistentTerminalId: persistentProcessId,
      resolvedShellLaunchConfig: shellLaunchConfig
    };
  }
  _executeCommand(persistentProcessId, commandId, commandArgs, uriTransformer) {
    const { resolve, reject, promise } = promiseWithResolvers();
    const reqId = ++this._lastReqId;
    this._pendingCommands.set(reqId, { resolve, reject, uriTransformer });
    const serializedCommandArgs = cloneAndChange(commandArgs, (obj) => {
      if (obj && obj.$mid === 1) {
        return uriTransformer.transformOutgoing(obj);
      }
      if (obj && obj instanceof URI) {
        return uriTransformer.transformOutgoingURI(obj);
      }
      return void 0;
    });
    this._onExecuteCommand.fire({
      reqId,
      persistentProcessId,
      commandId,
      commandArgs: serializedCommandArgs
    });
    return promise;
  }
  _sendCommandResult(reqId, isError, serializedPayload) {
    const data = this._pendingCommands.get(reqId);
    if (!data) {
      return;
    }
    this._pendingCommands.delete(reqId);
    const payload = cloneAndChange(serializedPayload, (obj) => {
      if (obj && obj.$mid === 1) {
        return data.uriTransformer.transformIncoming(obj);
      }
      return void 0;
    });
    if (isError) {
      data.reject(payload);
    } else {
      data.resolve(payload);
    }
  }
  _getDefaultSystemShell(osOverride) {
    return this._ptyHostService.getDefaultSystemShell(osOverride);
  }
  async _getProfiles(workspaceId, profiles, defaultProfile, includeDetectedProfiles) {
    return this._ptyHostService.getProfiles(workspaceId, profiles, defaultProfile, includeDetectedProfiles) || [];
  }
  _getEnvironment() {
    return { ...process.env };
  }
  _getWslPath(original, direction) {
    return this._ptyHostService.getWslPath(original, direction);
  }
  _reduceConnectionGraceTime() {
    return this._ptyHostService.reduceConnectionGraceTime();
  }
}
export {
  RemoteTerminalChannel
};
