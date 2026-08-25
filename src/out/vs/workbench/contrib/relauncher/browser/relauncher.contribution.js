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
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { Disposable, dispose, toDisposable } from "../../../../base/common/lifecycle.js";
import { isLinux, isMacintosh, isNative } from "../../../../base/common/platform.js";
import { isEqual } from "../../../../base/common/resources.js";
import { localize } from "../../../../nls.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IUserDataSyncEnablementService, IUserDataSyncService, SyncStatus } from "../../../../platform/userDataSync/common/userDataSync.js";
import { MenuSettings, TitleBarSetting, TitlebarStyle } from "../../../../platform/window/common/window.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { IUserDataSyncWorkbenchService } from "../../../services/userDataSync/common/userDataSync.js";
let SettingsChangeRelauncher = class extends Disposable {
  constructor(hostService, configurationService, userDataSyncService, userDataSyncEnablementService, userDataSyncWorkbenchService, productService, dialogService) {
    super();
    this.hostService = hostService;
    this.configurationService = configurationService;
    this.userDataSyncService = userDataSyncService;
    this.userDataSyncEnablementService = userDataSyncEnablementService;
    this.productService = productService;
    this.dialogService = dialogService;
    this.titleBarStyle = new ChangeObserver("string");
    this.menuStyle = new ChangeObserver("string");
    this.nativeTabs = new ChangeObserver("boolean");
    this.nativeFullScreen = new ChangeObserver("boolean");
    this.clickThroughInactive = new ChangeObserver("boolean");
    this.controlsStyle = new ChangeObserver("string");
    this.workspaceTrustEnabled = new ChangeObserver("boolean");
    this.experimentsEnabled = new ChangeObserver("boolean");
    this.enablePPEExtensionsGallery = new ChangeObserver("boolean");
    this.restrictUNCAccess = new ChangeObserver("boolean");
    this.accessibilityVerbosityDebug = new ChangeObserver("boolean");
    this.telemetryFeedbackEnabled = new ChangeObserver("boolean");
    this.extensionUnificationEnabled = new ChangeObserver("boolean");
    this.agentHostClaudeAgentEnabled = new ChangeObserver("boolean");
    this.agentHostByokModelsEnabled = new ChangeObserver("boolean");
    this.editorCodexPreferAgentHost = new ChangeObserver("boolean");
    this.agentHostOTelEnabled = new ChangeObserver("boolean");
    this.agentHostOTelExporterType = new ChangeObserver("string");
    this.agentHostOTelOtlpEndpoint = new ChangeObserver("string");
    this.agentHostOTelCaptureContent = new ChangeObserver("boolean");
    this.agentHostOTelOutfile = new ChangeObserver("string");
    this.agentHostOTelDbSpanExporterEnabled = new ChangeObserver("boolean");
    this.update(false);
    this._register(this.configurationService.onDidChangeConfiguration((e) => this.onConfigurationChange(e)));
    this._register(userDataSyncWorkbenchService.onDidTurnOnSync((e) => this.update(true)));
  }
  static {
    this.SETTINGS = [
      TitleBarSetting.TITLE_BAR_STYLE,
      MenuSettings.MenuStyle,
      "window.nativeTabs",
      "window.nativeFullScreen",
      "window.clickThroughInactive",
      "window.controlsStyle",
      "editor.accessibilitySupport",
      "security.workspace.trust.enabled",
      "workbench.enableExperiments",
      "_extensionsGallery.enablePPE",
      "security.restrictUNCAccess",
      "accessibility.verbosity.debug",
      "telemetry.feedback.enabled",
      "chat.extensionUnification.enabled",
      "chat.agentHost.claudeAgent.enabled",
      "chat.agentHost.byokModels.enabled",
      "chat.editor.codex.preferAgentHost",
      "chat.agentHost.otel.enabled",
      "chat.agentHost.otel.exporterType",
      "chat.agentHost.otel.otlpEndpoint",
      "chat.agentHost.otel.captureContent",
      "chat.agentHost.otel.outfile",
      "chat.agentHost.otel.dbSpanExporter.enabled"
    ];
  }
  onConfigurationChange(e) {
    if (e && !SettingsChangeRelauncher.SETTINGS.some((key) => e.affectsConfiguration(key))) {
      return;
    }
    if (this.isTurningOnSyncInProgress()) {
      return;
    }
    this.update(
      e.source !== ConfigurationTarget.DEFAULT
      /* do not ask to relaunch if defaults changed */
    );
  }
  isTurningOnSyncInProgress() {
    return !this.userDataSyncEnablementService.isEnabled() && this.userDataSyncService.status === SyncStatus.Syncing;
  }
  update(askToRelaunch) {
    let changed = false;
    function processChanged(didChange) {
      changed = changed || didChange;
    }
    const config = this.configurationService.getValue();
    if (isNative) {
      processChanged((config.window.titleBarStyle === TitlebarStyle.NATIVE || config.window.titleBarStyle === TitlebarStyle.CUSTOM) && this.titleBarStyle.handleChange(config.window?.titleBarStyle));
      processChanged(!isMacintosh && this.menuStyle.handleChange(config.window?.menuStyle));
      processChanged(isMacintosh && this.nativeTabs.handleChange(config.window?.nativeTabs));
      processChanged(isMacintosh && this.nativeFullScreen.handleChange(config.window?.nativeFullScreen));
      processChanged(isMacintosh && this.clickThroughInactive.handleChange(config.window?.clickThroughInactive));
      processChanged(!isMacintosh && this.controlsStyle.handleChange(config.window?.controlsStyle));
      if (isLinux && typeof config.editor?.accessibilitySupport === "string" && config.editor.accessibilitySupport !== this.accessibilitySupport) {
        this.accessibilitySupport = config.editor.accessibilitySupport;
        if (this.accessibilitySupport === "on") {
          changed = true;
        }
      }
      processChanged(this.workspaceTrustEnabled.handleChange(config?.security?.workspace?.trust?.enabled));
      processChanged(this.restrictUNCAccess.handleChange(config?.security?.restrictUNCAccess));
      processChanged(this.accessibilityVerbosityDebug.handleChange(config?.accessibility?.verbosity?.debug));
    }
    processChanged(this.experimentsEnabled.handleChange(config.workbench?.enableExperiments));
    processChanged(this.productService.quality !== "stable" && this.enablePPEExtensionsGallery.handleChange(config._extensionsGallery?.enablePPE));
    processChanged(this.telemetryFeedbackEnabled.handleChange(config.telemetry?.feedback?.enabled));
    processChanged(this.extensionUnificationEnabled.handleChange(config.chat?.extensionUnification?.enabled) && config.chat?.extensionUnification?.enabled === true);
    processChanged(this.agentHostByokModelsEnabled.handleChange(config.chat?.agentHost?.byokModels?.enabled));
    processChanged(this.agentHostClaudeAgentEnabled.handleChange(config.chat?.agentHost?.claudeAgent?.enabled));
    processChanged(this.editorCodexPreferAgentHost.handleChange(config.chat?.editor?.codex?.preferAgentHost));
    processChanged(this.agentHostOTelEnabled.handleChange(config.chat?.agentHost?.otel?.enabled));
    processChanged(this.agentHostOTelExporterType.handleChange(config.chat?.agentHost?.otel?.exporterType));
    processChanged(this.agentHostOTelOtlpEndpoint.handleChange(config.chat?.agentHost?.otel?.otlpEndpoint));
    processChanged(this.agentHostOTelCaptureContent.handleChange(config.chat?.agentHost?.otel?.captureContent));
    processChanged(this.agentHostOTelOutfile.handleChange(config.chat?.agentHost?.otel?.outfile));
    processChanged(this.agentHostOTelDbSpanExporterEnabled.handleChange(config.chat?.agentHost?.otel?.dbSpanExporter?.enabled));
    if (askToRelaunch && changed && this.hostService.hasFocus) {
      this.doConfirm(
        isNative ? localize("relaunchSettingMessage", "A setting has changed that requires a restart to take effect.") : localize("relaunchSettingMessageWeb", "A setting has changed that requires a reload to take effect."),
        isNative ? localize("relaunchSettingDetail", "Press the restart button to restart {0} and enable the setting.", this.productService.nameLong) : localize("relaunchSettingDetailWeb", "Press the reload button to reload {0} and enable the setting.", this.productService.nameLong),
        isNative ? localize({ key: "restart", comment: ["&& denotes a mnemonic"] }, "&&Restart") : localize({ key: "restartWeb", comment: ["&& denotes a mnemonic"] }, "&&Reload"),
        () => this.hostService.restart()
      );
    }
  }
  async doConfirm(message, detail, primaryButton, confirmedFn) {
    const { confirmed } = await this.dialogService.confirm({ message, detail, primaryButton });
    if (confirmed) {
      confirmedFn();
    }
  }
};
SettingsChangeRelauncher = __decorateClass([
  __decorateParam(0, IHostService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IUserDataSyncService),
  __decorateParam(3, IUserDataSyncEnablementService),
  __decorateParam(4, IUserDataSyncWorkbenchService),
  __decorateParam(5, IProductService),
  __decorateParam(6, IDialogService)
], SettingsChangeRelauncher);
class ChangeObserver {
  constructor(typeName) {
    this.typeName = typeName;
    this.lastValue = void 0;
  }
  static create(typeName) {
    return new ChangeObserver(typeName);
  }
  /**
   * Returns if there was a change compared to the last value
   */
  handleChange(value) {
    if (typeof value === this.typeName && value !== this.lastValue) {
      this.lastValue = value;
      return true;
    }
    return false;
  }
}
let WorkspaceChangeExtHostRelauncher = class extends Disposable {
  constructor(contextService, extensionService, hostService, environmentService) {
    super();
    this.contextService = contextService;
    this.extensionHostRestarter = this._register(new RunOnceScheduler(async () => {
      if (!!environmentService.extensionTestsLocationURI) {
        return;
      }
      if (environmentService.isSessionsWindow) {
        return;
      }
      if (environmentService.remoteAuthority) {
        hostService.reload();
      } else if (isNative) {
        const stopped = await extensionService.stopExtensionHosts(localize("restartExtensionHost.reason", "Changing workspace folders"));
        if (stopped) {
          extensionService.startExtensionHosts();
        }
      }
    }, 10));
    this.contextService.getCompleteWorkspace().then((workspace) => {
      this.firstFolderResource = workspace.folders.length > 0 ? workspace.folders[0].uri : void 0;
      this.handleWorkbenchState();
      this._register(this.contextService.onDidChangeWorkbenchState(() => setTimeout(() => this.handleWorkbenchState())));
    });
    this._register(toDisposable(() => {
      this.onDidChangeWorkspaceFoldersUnbind?.dispose();
    }));
  }
  handleWorkbenchState() {
    if (this.contextService.getWorkbenchState() === WorkbenchState.WORKSPACE) {
      const workspace = this.contextService.getWorkspace();
      this.firstFolderResource = workspace.folders.length > 0 ? workspace.folders[0].uri : void 0;
      if (!this.onDidChangeWorkspaceFoldersUnbind) {
        this.onDidChangeWorkspaceFoldersUnbind = this.contextService.onDidChangeWorkspaceFolders(() => this.onDidChangeWorkspaceFolders());
      }
    } else {
      dispose(this.onDidChangeWorkspaceFoldersUnbind);
      this.onDidChangeWorkspaceFoldersUnbind = void 0;
    }
  }
  onDidChangeWorkspaceFolders() {
    const workspace = this.contextService.getWorkspace();
    const newFirstFolderResource = workspace.folders.length > 0 ? workspace.folders[0].uri : void 0;
    if (!isEqual(this.firstFolderResource, newFirstFolderResource)) {
      this.firstFolderResource = newFirstFolderResource;
      this.extensionHostRestarter.schedule();
    }
  }
};
WorkspaceChangeExtHostRelauncher = __decorateClass([
  __decorateParam(0, IWorkspaceContextService),
  __decorateParam(1, IExtensionService),
  __decorateParam(2, IHostService),
  __decorateParam(3, IWorkbenchEnvironmentService)
], WorkspaceChangeExtHostRelauncher);
const workbenchRegistry = Registry.as(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(SettingsChangeRelauncher, LifecyclePhase.Restored);
workbenchRegistry.registerWorkbenchContribution(WorkspaceChangeExtHostRelauncher, LifecyclePhase.Restored);
export {
  SettingsChangeRelauncher,
  WorkspaceChangeExtHostRelauncher
};
