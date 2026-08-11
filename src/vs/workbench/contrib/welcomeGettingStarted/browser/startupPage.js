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
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import * as arrays from "../../../../base/common/arrays.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { IWorkspaceContextService, UNKNOWN_EMPTY_WINDOW_WORKSPACE, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ILifecycleService, LifecyclePhase, StartupKind } from "../../../services/lifecycle/common/lifecycle.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { joinPath } from "../../../../base/common/resources.js";
import { IWorkbenchLayoutService, Parts } from "../../../services/layout/browser/layoutService.js";
import { GettingStartedInput, gettingStartedInputTypeId } from "./gettingStartedInput.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { getTelemetryLevel } from "../../../../platform/telemetry/common/telemetryUtils.js";
import { TelemetryLevel } from "../../../../platform/telemetry/common/telemetry.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { localize } from "../../../../nls.js";
import { IEditorResolverService, RegisteredEditorPriority } from "../../../services/editor/common/editorResolverService.js";
import { TerminalCommandId } from "../../terminal/common/terminal.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { AuxiliaryBarMaximizedContext } from "../../../common/contextkeys.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { getActiveElement } from "../../../../base/browser/dom.js";
import { isWeb } from "../../../../base/common/platform.js";
import { IOnboardingService } from "../../welcomeOnboarding/common/onboardingService.js";
import { ONBOARDING_STORAGE_KEY } from "../../welcomeOnboarding/common/onboardingTypes.js";
import { IChatEntitlementService } from "../../../services/chat/common/chatEntitlementService.js";
const restoreWalkthroughsConfigurationKey = "workbench.welcomePage.restorableWalkthroughs";
const configurationKey = "workbench.startupEditor";
const oldConfigurationKey = "workbench.welcome.enabled";
const telemetryOptOutStorageKey = "workbench.telemetryOptOutShown";
let StartupPageEditorResolverContribution = class extends Disposable {
  constructor(instantiationService, editorResolverService) {
    super();
    this.instantiationService = instantiationService;
    this._register(editorResolverService.registerEditor(
      `${GettingStartedInput.RESOURCE.scheme}:/**`,
      {
        id: GettingStartedInput.ID,
        label: localize("welcome.displayName", "Welcome Page"),
        priority: RegisteredEditorPriority.builtin
      },
      {
        singlePerResource: true,
        canSupportResource: (uri) => uri.scheme === GettingStartedInput.RESOURCE.scheme
      },
      {
        createEditorInput: ({ options }) => {
          return {
            editor: this.instantiationService.createInstance(GettingStartedInput, options),
            options: {
              ...options,
              pinned: false
            }
          };
        }
      }
    ));
  }
  static {
    this.ID = "workbench.contrib.startupPageEditorResolver";
  }
};
StartupPageEditorResolverContribution = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IEditorResolverService)
], StartupPageEditorResolverContribution);
let StartupPageRunnerContribution = class extends Disposable {
  constructor(configurationService, editorService, fileService, contextService, lifecycleService, layoutService, productService, commandService, environmentService, storageService, notificationService, contextKeyService, onboardingService, chatEntitlementService) {
    super();
    this.configurationService = configurationService;
    this.editorService = editorService;
    this.fileService = fileService;
    this.contextService = contextService;
    this.lifecycleService = lifecycleService;
    this.layoutService = layoutService;
    this.productService = productService;
    this.commandService = commandService;
    this.environmentService = environmentService;
    this.storageService = storageService;
    this.notificationService = notificationService;
    this.contextKeyService = contextKeyService;
    this.onboardingService = onboardingService;
    this.chatEntitlementService = chatEntitlementService;
    this.tryShowOnboarding();
    this.run().then(void 0, onUnexpectedError);
    this._register(this.editorService.onDidCloseEditor((e) => {
      if (e.editor instanceof GettingStartedInput) {
        e.editor.selectedCategory = void 0;
        e.editor.selectedStep = void 0;
      }
    }));
  }
  static {
    this.ID = "workbench.contrib.startupPageRunner";
  }
  async run() {
    await this.lifecycleService.when(LifecyclePhase.Restored);
    if (AuxiliaryBarMaximizedContext.getValue(this.contextKeyService)) {
      return;
    }
    if (this.productService.enableTelemetry && this.productService.showTelemetryOptOut && getTelemetryLevel(this.configurationService) !== TelemetryLevel.NONE && !this.environmentService.skipWelcome && !this.storageService.get(telemetryOptOutStorageKey, StorageScope.PROFILE)) {
      this.storageService.store(telemetryOptOutStorageKey, true, StorageScope.PROFILE, StorageTarget.USER);
    }
    if (this.tryOpenWalkthroughForFolder()) {
      return;
    }
    const enabled = isStartupPageEnabled(this.configurationService, this.contextService, this.environmentService);
    if (enabled && this.lifecycleService.startupKind !== StartupKind.ReloadedWindow) {
      if (!this.editorService.activeEditor || this.layoutService.openedDefaultEditors) {
        const startupEditorSetting = this.configurationService.inspect(configurationKey);
        if (startupEditorSetting.value === "readme") {
          await this.openReadme();
        } else if (startupEditorSetting.value === "welcomePage" || startupEditorSetting.value === "welcomePageInEmptyWorkbench") {
          await this.openGettingStarted(true);
        } else if (startupEditorSetting.value === "terminal") {
          this.commandService.executeCommand(TerminalCommandId.CreateTerminalEditor);
        }
      }
    }
  }
  tryOpenWalkthroughForFolder() {
    const toRestore = this.storageService.get(restoreWalkthroughsConfigurationKey, StorageScope.PROFILE);
    if (!toRestore) {
      return false;
    } else {
      const restoreData = JSON.parse(toRestore);
      const currentWorkspace = this.contextService.getWorkspace();
      if (restoreData.folder === UNKNOWN_EMPTY_WINDOW_WORKSPACE.id || restoreData.folder === currentWorkspace.folders[0].uri.toString()) {
        const options = { selectedCategory: restoreData.category, selectedStep: restoreData.step, pinned: false, preserveFocus: this.shouldPreserveFocus() };
        this.editorService.openEditor({
          resource: GettingStartedInput.RESOURCE,
          options
        });
        this.storageService.remove(restoreWalkthroughsConfigurationKey, StorageScope.PROFILE);
        return true;
      }
    }
    return false;
  }
  async openReadme() {
    const readmes = arrays.coalesce(
      await Promise.all(this.contextService.getWorkspace().folders.map(
        async (folder) => {
          const folderUri = folder.uri;
          const folderStat = await this.fileService.resolve(folderUri).catch(onUnexpectedError);
          const files = folderStat?.children ? folderStat.children.map((child) => child.name).sort() : [];
          const file = files.find((file2) => file2.toLowerCase() === "readme.md") || files.find((file2) => file2.toLowerCase().startsWith("readme"));
          if (file) {
            return joinPath(folderUri, file);
          } else {
            return void 0;
          }
        }
      ))
    );
    if (!this.editorService.activeEditor) {
      if (readmes.length) {
        const isMarkDown = (readme) => readme.path.toLowerCase().endsWith(".md");
        await Promise.all([
          this.commandService.executeCommand("markdown.showPreview", null, readmes.filter(isMarkDown), { locked: true }).catch((error) => {
            this.notificationService.error(localize("startupPage.markdownPreviewError", "Could not open markdown preview: {0}.\n\nPlease make sure the markdown extension is enabled.", error.message));
          }),
          this.editorService.openEditors(readmes.filter((readme) => !isMarkDown(readme)).map((readme) => ({ resource: readme, options: { preserveFocus: this.shouldPreserveFocus() } })))
        ]);
      } else {
        await this.openGettingStarted();
      }
    }
  }
  async openGettingStarted(showTelemetryNotice) {
    const startupEditorTypeID = gettingStartedInputTypeId;
    const editor = this.editorService.activeEditor;
    if (editor?.typeId === startupEditorTypeID || this.editorService.editors.some((e) => e.typeId === startupEditorTypeID)) {
      return;
    }
    if (startupEditorTypeID === gettingStartedInputTypeId) {
      this.editorService.openEditor({
        resource: GettingStartedInput.RESOURCE,
        options: {
          index: editor ? 0 : void 0,
          pinned: false,
          preserveFocus: this.shouldPreserveFocus(),
          ...{ showTelemetryNotice }
        }
      });
    }
  }
  shouldPreserveFocus() {
    const activeElement = getActiveElement();
    if (!activeElement || activeElement === mainWindow.document.body || this.layoutService.hasFocus(Parts.EDITOR_PART)) {
      return false;
    }
    return true;
  }
  tryShowOnboarding() {
    if (this.environmentService.skipWelcome) {
      return;
    }
    if (isWeb) {
      return;
    }
    if (!this.configurationService.getValue("workbench.welcomePage.experimentalOnboarding")) {
      return;
    }
    if (this.chatEntitlementService.sentiment.hidden) {
      return;
    }
    if (!this.storageService.isNew(StorageScope.APPLICATION)) {
      return;
    }
    if (this.storageService.getBoolean(ONBOARDING_STORAGE_KEY, StorageScope.APPLICATION)) {
      return;
    }
    this.onboardingService.show();
    this._register(this.onboardingService.onDidDismiss(() => {
      this.storageService.store(ONBOARDING_STORAGE_KEY, true, StorageScope.APPLICATION, StorageTarget.USER);
    }));
  }
};
StartupPageRunnerContribution = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IEditorService),
  __decorateParam(2, IFileService),
  __decorateParam(3, IWorkspaceContextService),
  __decorateParam(4, ILifecycleService),
  __decorateParam(5, IWorkbenchLayoutService),
  __decorateParam(6, IProductService),
  __decorateParam(7, ICommandService),
  __decorateParam(8, IWorkbenchEnvironmentService),
  __decorateParam(9, IStorageService),
  __decorateParam(10, INotificationService),
  __decorateParam(11, IContextKeyService),
  __decorateParam(12, IOnboardingService),
  __decorateParam(13, IChatEntitlementService)
], StartupPageRunnerContribution);
function isStartupPageEnabled(configurationService, contextService, environmentService) {
  if (environmentService.skipWelcome) {
    return false;
  }
  const startupEditor = configurationService.inspect(configurationKey);
  if (!startupEditor.userValue && !startupEditor.workspaceValue) {
    const welcomeEnabled = configurationService.inspect(oldConfigurationKey);
    if (welcomeEnabled.value !== void 0 && welcomeEnabled.value !== null) {
      return welcomeEnabled.value;
    }
  }
  return startupEditor.value === "welcomePage" || startupEditor.value === "readme" || contextService.getWorkbenchState() === WorkbenchState.EMPTY && startupEditor.value === "welcomePageInEmptyWorkbench" || startupEditor.value === "terminal";
}
export {
  StartupPageEditorResolverContribution,
  StartupPageRunnerContribution,
  restoreWalkthroughsConfigurationKey
};
