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
import * as nls from "../../../../nls.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IRemoteAgentService, remoteConnectionLatencyMeasurer } from "../../../services/remote/common/remoteAgentService.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { isMacintosh, isWindows } from "../../../../base/common/platform.js";
import { KeyMod, KeyChord, KeyCode } from "../../../../base/common/keyCodes.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { WorkbenchPhase, Extensions as WorkbenchContributionsExtensions, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { ILifecycleService, LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { Schemas } from "../../../../base/common/network.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { ipcRenderer } from "../../../../base/parts/sandbox/electron-browser/globals.js";
import { INativeWorkbenchEnvironmentService } from "../../../services/environment/electron-browser/environmentService.js";
import { PersistentConnectionEventType } from "../../../../platform/remote/common/remoteAgentConnection.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { Extensions as ConfigurationExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { IRemoteAuthorityResolverService } from "../../../../platform/remote/common/remoteAuthorityResolver.js";
import { OpenLocalFileFolderCommand, OpenLocalFileCommand, OpenLocalFolderCommand, SaveLocalFileCommand, RemoteFileDialogContext } from "../../../services/dialogs/browser/simpleFileDialog.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { TELEMETRY_SETTING_ID } from "../../../../platform/telemetry/common/telemetry.js";
import { getTelemetryLevel } from "../../../../platform/telemetry/common/telemetryUtils.js";
import { IContextKeyService, RawContextKey, ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { Action2, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IRemoteExplorerService, PORT_AUTO_SOURCE_SETTING, PORT_AUTO_SOURCE_SETTING_OUTPUT } from "../../../services/remote/common/remoteExplorerService.js";
import { TunnelCloseReason } from "../../../services/remote/common/tunnelModel.js";
import { localize } from "../../../../nls.js";
import { RemoteNameContext } from "../../../common/contextkeys.js";
let RemoteAgentDiagnosticListener = class {
  constructor(remoteAgentService, labelService) {
    ipcRenderer.on("vscode:getDiagnosticInfo", (event, ...args) => {
      const request = args[0];
      const connection = remoteAgentService.getConnection();
      if (connection) {
        const hostName = labelService.getHostLabel(Schemas.vscodeRemote, connection.remoteAuthority);
        remoteAgentService.getDiagnosticInfo(request.args).then((info) => {
          if (info) {
            info.hostName = hostName;
            if (remoteConnectionLatencyMeasurer.latency?.high) {
              info.latency = {
                average: remoteConnectionLatencyMeasurer.latency.average,
                current: remoteConnectionLatencyMeasurer.latency.current
              };
            }
          }
          ipcRenderer.send(request.replyChannel, info);
        }).catch((e) => {
          const errorMessage = e && e.message ? `Connection to '${hostName}' could not be established  ${e.message}` : `Connection to '${hostName}' could not be established `;
          ipcRenderer.send(request.replyChannel, { hostName, errorMessage });
        });
      } else {
        ipcRenderer.send(request.replyChannel);
      }
    });
  }
};
RemoteAgentDiagnosticListener = __decorateClass([
  __decorateParam(0, IRemoteAgentService),
  __decorateParam(1, ILabelService)
], RemoteAgentDiagnosticListener);
let RemoteExtensionHostEnvironmentUpdater = class extends Disposable {
  constructor(remoteAgentService, remoteResolverService, extensionService) {
    super();
    const connection = remoteAgentService.getConnection();
    if (connection) {
      this._register(connection.onDidStateChange(async (e) => {
        if (e.type === PersistentConnectionEventType.ConnectionGain) {
          const resolveResult = await remoteResolverService.resolveAuthority(connection.remoteAuthority);
          if (resolveResult.options && resolveResult.options.extensionHostEnv) {
            await extensionService.setRemoteEnvironment(resolveResult.options.extensionHostEnv);
          }
        }
      }));
    }
  }
};
RemoteExtensionHostEnvironmentUpdater = __decorateClass([
  __decorateParam(0, IRemoteAgentService),
  __decorateParam(1, IRemoteAuthorityResolverService),
  __decorateParam(2, IExtensionService)
], RemoteExtensionHostEnvironmentUpdater);
let RemoteTelemetryEnablementUpdater = class extends Disposable {
  constructor(remoteAgentService, configurationService) {
    super();
    this.remoteAgentService = remoteAgentService;
    this.configurationService = configurationService;
    this.updateRemoteTelemetryEnablement();
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(TELEMETRY_SETTING_ID)) {
        this.updateRemoteTelemetryEnablement();
      }
    }));
  }
  static {
    this.ID = "workbench.contrib.remoteTelemetryEnablementUpdater";
  }
  updateRemoteTelemetryEnablement() {
    return this.remoteAgentService.updateTelemetryLevel(getTelemetryLevel(this.configurationService));
  }
};
RemoteTelemetryEnablementUpdater = __decorateClass([
  __decorateParam(0, IRemoteAgentService),
  __decorateParam(1, IConfigurationService)
], RemoteTelemetryEnablementUpdater);
let RemoteEmptyWorkbenchPresentation = class extends Disposable {
  static {
    this.ID = "workbench.contrib.remoteEmptyWorkbenchPresentation";
  }
  constructor(environmentService, remoteAuthorityResolverService, configurationService, commandService, contextService) {
    super();
    function shouldShowExplorer() {
      const startupEditor = configurationService.getValue("workbench.startupEditor");
      return startupEditor !== "welcomePage" && startupEditor !== "welcomePageInEmptyWorkbench";
    }
    function shouldShowTerminal() {
      return shouldShowExplorer();
    }
    const { remoteAuthority, filesToDiff, filesToMerge, filesToOpenOrCreate, filesToWait } = environmentService;
    if (remoteAuthority && contextService.getWorkbenchState() === WorkbenchState.EMPTY && !filesToDiff?.length && !filesToMerge?.length && !filesToOpenOrCreate?.length && !filesToWait) {
      remoteAuthorityResolverService.resolveAuthority(remoteAuthority).then(() => {
        if (shouldShowExplorer()) {
          commandService.executeCommand("workbench.view.explorer");
        }
        if (shouldShowTerminal()) {
          commandService.executeCommand("workbench.action.terminal.toggleTerminal");
        }
      });
    }
  }
};
RemoteEmptyWorkbenchPresentation = __decorateClass([
  __decorateParam(0, INativeWorkbenchEnvironmentService),
  __decorateParam(1, IRemoteAuthorityResolverService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, ICommandService),
  __decorateParam(4, IWorkspaceContextService)
], RemoteEmptyWorkbenchPresentation);
let WSLContextKeyInitializer = class extends Disposable {
  static {
    this.ID = "workbench.contrib.wslContextKeyInitializer";
  }
  constructor(contextKeyService, nativeHostService, storageService, lifecycleService) {
    super();
    const contextKeyId = "wslFeatureInstalled";
    const storageKey = "remote.wslFeatureInstalled";
    const defaultValue = storageService.getBoolean(storageKey, StorageScope.APPLICATION, void 0);
    const hasWSLFeatureContext = new RawContextKey(contextKeyId, !!defaultValue, nls.localize("wslFeatureInstalled", "Whether the platform has the WSL feature installed"));
    const contextKey = hasWSLFeatureContext.bindTo(contextKeyService);
    if (defaultValue === void 0) {
      lifecycleService.when(LifecyclePhase.Eventually).then(async () => {
        nativeHostService.hasWSLFeatureInstalled().then((res) => {
          if (res) {
            contextKey.set(true);
            storageService.store(storageKey, true, StorageScope.APPLICATION, StorageTarget.MACHINE);
          }
        });
      });
    }
  }
};
WSLContextKeyInitializer = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, INativeHostService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, ILifecycleService)
], WSLContextKeyInitializer);
const workbenchContributionsRegistry = Registry.as(WorkbenchContributionsExtensions.Workbench);
workbenchContributionsRegistry.registerWorkbenchContribution(RemoteAgentDiagnosticListener, LifecyclePhase.Eventually);
workbenchContributionsRegistry.registerWorkbenchContribution(RemoteExtensionHostEnvironmentUpdater, LifecyclePhase.Eventually);
registerWorkbenchContribution2(RemoteTelemetryEnablementUpdater.ID, RemoteTelemetryEnablementUpdater, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(RemoteEmptyWorkbenchPresentation.ID, RemoteEmptyWorkbenchPresentation, WorkbenchPhase.BlockRestore);
if (isWindows) {
  registerWorkbenchContribution2(WSLContextKeyInitializer.ID, WSLContextKeyInitializer, WorkbenchPhase.BlockRestore);
}
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  id: "remote",
  title: nls.localize("remote", "Remote"),
  type: "object",
  properties: {
    "remote.downloadExtensionsLocally": {
      type: "boolean",
      markdownDescription: nls.localize("remote.downloadExtensionsLocally", "When enabled extensions are downloaded locally and installed on remote."),
      default: false
    }
  }
});
if (isMacintosh) {
  KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: OpenLocalFileFolderCommand.ID,
    weight: KeybindingWeight.WorkbenchContrib,
    primary: KeyMod.CtrlCmd | KeyCode.KeyO,
    when: RemoteFileDialogContext,
    metadata: { description: OpenLocalFileFolderCommand.LABEL, args: [] },
    handler: OpenLocalFileFolderCommand.handler()
  });
} else {
  KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: OpenLocalFileCommand.ID,
    weight: KeybindingWeight.WorkbenchContrib,
    primary: KeyMod.CtrlCmd | KeyCode.KeyO,
    when: RemoteFileDialogContext,
    metadata: { description: OpenLocalFileCommand.LABEL, args: [] },
    handler: OpenLocalFileCommand.handler()
  });
  KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: OpenLocalFolderCommand.ID,
    weight: KeybindingWeight.WorkbenchContrib,
    primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyO),
    when: RemoteFileDialogContext,
    metadata: { description: OpenLocalFolderCommand.LABEL, args: [] },
    handler: OpenLocalFolderCommand.handler()
  });
}
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: SaveLocalFileCommand.ID,
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyS,
  when: RemoteFileDialogContext,
  metadata: { description: SaveLocalFileCommand.LABEL, args: [] },
  handler: SaveLocalFileCommand.handler()
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.remote.action.closeUnusedPorts",
      title: localize("remote.actions.closeUnusedPorts", "Close Unused Forwarded Ports"),
      category: localize("remote.category", "Remote"),
      menu: [{
        id: MenuId.CommandPalette
      }],
      precondition: ContextKeyExpr.and(ContextKeyExpr.notEquals(`config.${PORT_AUTO_SOURCE_SETTING}`, PORT_AUTO_SOURCE_SETTING_OUTPUT), RemoteNameContext)
    });
  }
  async run(accessor) {
    const remoteExplorerService = accessor.get(IRemoteExplorerService);
    const ports = [];
    const forwarded = remoteExplorerService.tunnelModel.forwarded;
    for (const [_, tunnel] of forwarded) {
      if (tunnel.hasRunningProcess === false) {
        ports.push(tunnel);
      }
    }
    if (ports.length) {
      for (const port of ports) {
        await remoteExplorerService.close({
          host: port.remoteHost,
          port: port.remotePort
        }, TunnelCloseReason.User);
      }
    }
  }
});
