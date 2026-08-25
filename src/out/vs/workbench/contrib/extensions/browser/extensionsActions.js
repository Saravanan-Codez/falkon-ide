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
import "./media/extensionActions.css";
import { localize, localize2 } from "../../../../nls.js";
import { Action, Separator, SubmenuAction } from "../../../../base/common/actions.js";
import { Delayer, Promises, Throttler } from "../../../../base/common/async.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import * as json from "../../../../base/common/json.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { disposeIfDisposable } from "../../../../base/common/lifecycle.js";
import { ExtensionState, IExtensionsWorkbenchService, TOGGLE_IGNORE_EXTENSION_ACTION_ID, SELECT_INSTALL_VSIX_EXTENSION_COMMAND_ID, THEME_ACTIONS_GROUP, INSTALL_ACTIONS_GROUP, UPDATE_ACTIONS_GROUP, ExtensionEditorTab, ExtensionRuntimeActionType, AutoUpdateConfigurationKey } from "../common/extensions.js";
import { ExtensionsConfigurationInitialContent } from "../common/extensionsFileTemplate.js";
import { IExtensionGalleryService, InstallOperation, ExtensionManagementErrorCode, IAllowedExtensionsService, shouldRequireRepositorySignatureFor } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { IWorkbenchExtensionEnablementService, EnablementState, IExtensionManagementServerService, IWorkbenchExtensionManagementService } from "../../../services/extensionManagement/common/extensionManagement.js";
import { ExtensionRecommendationReason, IExtensionIgnoredRecommendationsService, IExtensionRecommendationsService } from "../../../services/extensionRecommendations/common/extensionRecommendations.js";
import { areSameExtensions, getExtensionId } from "../../../../platform/extensionManagement/common/extensionManagementUtil.js";
import { ExtensionType, ExtensionIdentifier, isLanguagePackExtension, getWorkspaceSupportTypeMessage, TargetPlatform, isApplicationScopedExtension } from "../../../../platform/extensions/common/extensions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { IExtensionService, toExtension, toExtensionDescription } from "../../../services/extensions/common/extensions.js";
import { URI } from "../../../../base/common/uri.js";
import { CommandsRegistry, ICommandService } from "../../../../platform/commands/common/commands.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ChatAIDisabledSettingId } from "../../../../platform/chat/common/chatSettings.js";
import { registerThemingParticipant } from "../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { buttonBackground, buttonForeground, buttonHoverBackground, buttonSecondaryBackground, buttonSecondaryForeground, buttonSecondaryHoverBackground, registerColor, editorWarningForeground, editorInfoForeground, editorErrorForeground, buttonSeparator, buttonSecondaryBorder } from "../../../../platform/theme/common/colorRegistry.js";
import { IJSONEditingService } from "../../../services/configuration/common/jsonEditing.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { MenuId, IMenuService } from "../../../../platform/actions/common/actions.js";
import { PICK_WORKSPACE_FOLDER_COMMAND_ID } from "../../../browser/actions/workspaceCommands.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { alert } from "../../../../base/browser/ui/aria/aria.js";
import { IWorkbenchThemeService } from "../../../services/themes/common/workbenchThemeService.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { ITextFileService } from "../../../services/textfile/common/textfiles.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { ActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { EXTENSIONS_CONFIG } from "../../../services/extensionRecommendations/common/workspaceExtensionsConfig.js";
import { getErrorMessage, isCancellationError } from "../../../../base/common/errors.js";
import { IUserDataSyncEnablementService } from "../../../../platform/userDataSync/common/userDataSync.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { errorIcon, infoIcon, manageExtensionIcon, syncEnabledIcon, syncIgnoredIcon, trustIcon, warningIcon } from "./extensionsIcons.js";
import { isIOS, isWeb, language } from "../../../../base/common/platform.js";
import { IExtensionManifestPropertiesService } from "../../../services/extensions/common/extensionManifestPropertiesService.js";
import { IWorkspaceTrustEnablementService, IWorkspaceTrustManagementService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { isVirtualWorkspace } from "../../../../platform/workspace/common/virtualWorkspace.js";
import { createCommandUri, escapeMarkdownSyntaxTokens, MarkdownString } from "../../../../base/common/htmlContent.js";
import { fromNow } from "../../../../base/common/date.js";
import { IPreferencesService } from "../../../services/preferences/common/preferences.js";
import { getLocale } from "../../../../platform/languagePacks/common/languagePacks.js";
import { ILocaleService } from "../../../services/localization/common/locale.js";
import { isString } from "../../../../base/common/types.js";
import { showWindowLogActionId } from "../../../services/log/common/logConstants.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { Extensions, IExtensionFeaturesManagementService } from "../../../services/extensionManagement/common/extensionFeatures.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IUpdateService } from "../../../../platform/update/common/update.js";
import { ActionWithDropdownActionViewItem } from "../../../../base/browser/ui/dropdown/dropdownActionViewItem.js";
import { IAuthenticationUsageService } from "../../../services/authentication/browser/authenticationUsageService.js";
import { IExtensionGalleryManifestService } from "../../../../platform/extensionManagement/common/extensionGalleryManifest.js";
import { IWorkbenchIssueService } from "../../issue/common/issue.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { getWorkbenchMenuMotionContextMenuOptions } from "../../../browser/actions/menuMotion.js";
let PromptExtensionInstallFailureAction = class extends Action {
  constructor(extension, options, version, installOperation, error, productService, openerService, notificationService, dialogService, commandService, logService, extensionManagementServerService, instantiationService, galleryService, extensionManifestPropertiesService, workbenchIssueService) {
    super("extension.promptExtensionInstallFailure");
    this.extension = extension;
    this.options = options;
    this.version = version;
    this.installOperation = installOperation;
    this.error = error;
    this.productService = productService;
    this.openerService = openerService;
    this.notificationService = notificationService;
    this.dialogService = dialogService;
    this.commandService = commandService;
    this.logService = logService;
    this.extensionManagementServerService = extensionManagementServerService;
    this.instantiationService = instantiationService;
    this.galleryService = galleryService;
    this.extensionManifestPropertiesService = extensionManifestPropertiesService;
    this.workbenchIssueService = workbenchIssueService;
  }
  async run() {
    if (isCancellationError(this.error)) {
      return;
    }
    this.logService.error(this.error);
    if (this.error.name === ExtensionManagementErrorCode.Unsupported) {
      const productName = isWeb ? localize("VS Code for Web", "{0} for the Web", this.productService.nameLong) : this.productService.nameLong;
      const message2 = localize("cannot be installed", "The '{0}' extension is not available in {1}. Click 'More Information' to learn more.", this.extension.displayName || this.extension.identifier.id, productName);
      const { confirmed } = await this.dialogService.confirm({
        type: Severity.Info,
        message: message2,
        primaryButton: localize({ key: "more information", comment: ["&& denotes a mnemonic"] }, "&&More Information"),
        cancelButton: localize("close", "Close")
      });
      if (confirmed) {
        this.openerService.open(isWeb ? URI.parse("https://aka.ms/vscode-web-extensions-guide") : URI.parse("https://aka.ms/vscode-remote"));
      }
      return;
    }
    if (ExtensionManagementErrorCode.ReleaseVersionNotFound === this.error.name) {
      await this.dialogService.prompt({
        type: "error",
        message: getErrorMessage(this.error),
        buttons: [{
          label: localize("install prerelease", "Install Pre-Release"),
          run: () => {
            const installAction = this.instantiationService.createInstance(InstallAction, { installPreReleaseVersion: true });
            installAction.extension = this.extension;
            return installAction.run();
          }
        }],
        cancelButton: localize("cancel", "Cancel")
      });
      return;
    }
    if ([ExtensionManagementErrorCode.Incompatible, ExtensionManagementErrorCode.IncompatibleApi, ExtensionManagementErrorCode.IncompatibleTargetPlatform, ExtensionManagementErrorCode.Malicious, ExtensionManagementErrorCode.Deprecated].includes(this.error.name)) {
      await this.dialogService.info(getErrorMessage(this.error));
      return;
    }
    if (ExtensionManagementErrorCode.PackageNotSigned === this.error.name) {
      await this.dialogService.prompt({
        type: "error",
        message: localize("not signed", "'{0}' is an extension from an unknown source. Are you sure you want to install?", this.extension.displayName),
        detail: getErrorMessage(this.error),
        buttons: [{
          label: localize("install anyway", "Install Anyway"),
          run: () => {
            const installAction = this.instantiationService.createInstance(InstallAction, { ...this.options, donotVerifySignature: true });
            installAction.extension = this.extension;
            return installAction.run();
          }
        }],
        cancelButton: true
      });
      return;
    }
    if (ExtensionManagementErrorCode.SignatureVerificationFailed === this.error.name) {
      await this.dialogService.prompt({
        type: "error",
        message: localize("verification failed", "Cannot install '{0}' extension because {1} cannot verify the extension signature", this.extension.displayName, this.productService.nameLong),
        detail: getErrorMessage(this.error),
        buttons: [{
          label: localize("learn more", "Learn More"),
          run: () => this.openerService.open("https://code.visualstudio.com/docs/editor/extension-marketplace#_the-extension-signature-cannot-be-verified-by-vs-code")
        }, {
          label: localize("install donot verify", "Install Anyway (Don't Verify Signature)"),
          run: () => {
            const installAction = this.instantiationService.createInstance(InstallAction, { ...this.options, donotVerifySignature: true });
            installAction.extension = this.extension;
            return installAction.run();
          }
        }],
        cancelButton: true
      });
      return;
    }
    if (ExtensionManagementErrorCode.SignatureVerificationInternal === this.error.name) {
      await this.dialogService.prompt({
        type: "error",
        message: localize("verification failed", "Cannot install '{0}' extension because {1} cannot verify the extension signature", this.extension.displayName, this.productService.nameLong),
        detail: getErrorMessage(this.error),
        buttons: [{
          label: localize("learn more", "Learn More"),
          run: () => this.openerService.open("https://code.visualstudio.com/docs/editor/extension-marketplace#_the-extension-signature-cannot-be-verified-by-vs-code")
        }, {
          label: localize("report issue", "Report Issue"),
          run: () => this.workbenchIssueService.openReporter({
            issueTitle: localize("report issue title", "Extension Signature Verification Failed: {0}", this.extension.displayName),
            issueBody: localize("report issue body", "Please include following log `F1 > Open View... > Shared` below.\n\n")
          })
        }, {
          label: localize("install donot verify", "Install Anyway (Don't Verify Signature)"),
          run: () => {
            const installAction = this.instantiationService.createInstance(InstallAction, { ...this.options, donotVerifySignature: true });
            installAction.extension = this.extension;
            return installAction.run();
          }
        }],
        cancelButton: true
      });
      return;
    }
    const operationMessage = this.installOperation === InstallOperation.Update ? localize("update operation", "Error while updating '{0}' extension.", this.extension.displayName || this.extension.identifier.id) : localize("install operation", "Error while installing '{0}' extension.", this.extension.displayName || this.extension.identifier.id);
    let additionalMessage;
    const promptChoices = [];
    const downloadUrl = await this.getDownloadUrl();
    if (downloadUrl) {
      additionalMessage = localize("check logs", "Please check the [log]({0}) for more details.", createCommandUri(showWindowLogActionId).toString());
      promptChoices.push({
        label: localize("download", "Try Downloading Manually..."),
        run: () => this.openerService.open(downloadUrl).then(() => {
          this.notificationService.prompt(
            Severity.Info,
            localize("install vsix", "Once downloaded, please manually install the downloaded VSIX of '{0}'.", this.extension.identifier.id),
            [{
              label: localize("installVSIX", "Install from VSIX..."),
              run: () => this.commandService.executeCommand(SELECT_INSTALL_VSIX_EXTENSION_COMMAND_ID)
            }]
          );
        })
      });
    }
    const message = `${operationMessage}${additionalMessage ? ` ${additionalMessage}` : ""}`;
    this.notificationService.prompt(Severity.Error, message, promptChoices);
  }
  async getDownloadUrl() {
    if (isIOS) {
      return void 0;
    }
    if (!this.extension.gallery) {
      return void 0;
    }
    if (!this.extensionManagementServerService.localExtensionManagementServer && !this.extensionManagementServerService.remoteExtensionManagementServer) {
      return void 0;
    }
    let targetPlatform = this.extension.gallery.properties.targetPlatform;
    if (targetPlatform !== TargetPlatform.UNIVERSAL && targetPlatform !== TargetPlatform.UNDEFINED && this.extensionManagementServerService.remoteExtensionManagementServer) {
      try {
        const manifest = await this.galleryService.getManifest(this.extension.gallery, CancellationToken.None);
        if (manifest && this.extensionManifestPropertiesService.prefersExecuteOnWorkspace(manifest)) {
          targetPlatform = await this.extensionManagementServerService.remoteExtensionManagementServer.extensionManagementService.getTargetPlatform();
        }
      } catch (error) {
        this.logService.error(error);
        return void 0;
      }
    }
    if (targetPlatform === TargetPlatform.UNKNOWN) {
      return void 0;
    }
    const [extension] = await this.galleryService.getExtensions([{
      ...this.extension.identifier,
      version: this.version
    }], {
      targetPlatform
    }, CancellationToken.None);
    if (!extension) {
      return void 0;
    }
    return URI.parse(extension.assets.download.uri);
  }
};
PromptExtensionInstallFailureAction = __decorateClass([
  __decorateParam(5, IProductService),
  __decorateParam(6, IOpenerService),
  __decorateParam(7, INotificationService),
  __decorateParam(8, IDialogService),
  __decorateParam(9, ICommandService),
  __decorateParam(10, ILogService),
  __decorateParam(11, IExtensionManagementServerService),
  __decorateParam(12, IInstantiationService),
  __decorateParam(13, IExtensionGalleryService),
  __decorateParam(14, IExtensionManifestPropertiesService),
  __decorateParam(15, IWorkbenchIssueService)
], PromptExtensionInstallFailureAction);
class ExtensionAction extends Action {
  constructor() {
    super(...arguments);
    this._onDidChange = this._register(new Emitter());
    this._extension = null;
    this._hidden = false;
    this.hideOnDisabled = true;
  }
  get onDidChange() {
    return this._onDidChange.event;
  }
  static {
    this.EXTENSION_ACTION_CLASS = "extension-action";
  }
  static {
    this.TEXT_ACTION_CLASS = `${ExtensionAction.EXTENSION_ACTION_CLASS} text`;
  }
  static {
    this.LABEL_ACTION_CLASS = `${ExtensionAction.EXTENSION_ACTION_CLASS} label`;
  }
  static {
    this.ICON_ACTION_CLASS = `${ExtensionAction.EXTENSION_ACTION_CLASS} icon`;
  }
  get extension() {
    return this._extension;
  }
  set extension(extension) {
    this._extension = extension;
    this.update();
  }
  get hidden() {
    return this._hidden;
  }
  set hidden(hidden) {
    if (this._hidden !== hidden) {
      this._hidden = hidden;
      this._onDidChange.fire({ hidden });
    }
  }
  _setEnabled(value) {
    super._setEnabled(value);
    if (this.hideOnDisabled) {
      this.hidden = !value;
    }
  }
}
class ButtonWithDropDownExtensionAction extends ExtensionAction {
  constructor(id, clazz, actionsGroups) {
    clazz = `${clazz} action-dropdown`;
    super(id, void 0, clazz);
    this.actionsGroups = actionsGroups;
    this.menuActionClassNames = [];
    this._menuActions = [];
    this.menuActionClassNames = clazz.split(" ");
    this.hideOnDisabled = false;
    this.extensionActions = actionsGroups.flat();
    this.update();
    this._register(Event.any(...this.extensionActions.map((a) => a.onDidChange))(() => this.update(true)));
    this.extensionActions.forEach((a) => this._register(a));
  }
  get menuActions() {
    return [...this._menuActions];
  }
  get extension() {
    return super.extension;
  }
  set extension(extension) {
    this.extensionActions.forEach((a) => a.extension = extension);
    super.extension = extension;
  }
  update(donotUpdateActions) {
    if (!donotUpdateActions) {
      this.extensionActions.forEach((a) => a.update());
    }
    const actionsGroups = this.actionsGroups.map((actionsGroup) => actionsGroup.filter((a) => !a.hidden));
    let actions = [];
    for (const visibleActions of actionsGroups) {
      if (visibleActions.length) {
        actions = [...actions, ...visibleActions, new Separator()];
      }
    }
    actions = actions.length ? actions.slice(0, actions.length - 1) : actions;
    this.primaryAction = actions[0];
    this._menuActions = actions.length > 1 ? actions : [];
    this._onDidChange.fire({ menuActions: this._menuActions });
    if (this.primaryAction) {
      this.hidden = false;
      this.enabled = this.primaryAction.enabled;
      this.label = this.getLabel(this.primaryAction);
      this.tooltip = this.primaryAction.tooltip;
    } else {
      this.hidden = true;
      this.enabled = false;
    }
  }
  async run() {
    if (this.enabled) {
      await this.primaryAction?.run();
    }
  }
  getLabel(action) {
    return action.label;
  }
}
class ButtonWithDropdownExtensionActionViewItem extends ActionWithDropdownActionViewItem {
  constructor(action, options, contextMenuProvider) {
    super(null, action, options, contextMenuProvider);
    this._register(action.onDidChange((e) => {
      if (e.hidden !== void 0 || e.menuActions !== void 0) {
        this.updateClass();
      }
    }));
  }
  render(container) {
    super.render(container);
    this.updateClass();
  }
  updateClass() {
    super.updateClass();
    if (this.element && this.dropdownMenuActionViewItem?.element) {
      this.element.classList.toggle("hide", this._action.hidden);
      const isMenuEmpty = this._action.menuActions.length === 0;
      this.element.classList.toggle("empty", isMenuEmpty);
      this.dropdownMenuActionViewItem.element.classList.toggle("hide", isMenuEmpty);
    }
  }
}
let InstallAction = class extends ExtensionAction {
  constructor(options, extensionsWorkbenchService, instantiationService, runtimeExtensionService, workbenchThemeService, labelService, dialogService, preferencesService, telemetryService, contextService, allowedExtensionsService, extensionGalleryManifestService) {
    super("extensions.install", localize("install", "Install"), InstallAction.CLASS, false);
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.instantiationService = instantiationService;
    this.runtimeExtensionService = runtimeExtensionService;
    this.workbenchThemeService = workbenchThemeService;
    this.labelService = labelService;
    this.dialogService = dialogService;
    this.preferencesService = preferencesService;
    this.telemetryService = telemetryService;
    this.contextService = contextService;
    this.allowedExtensionsService = allowedExtensionsService;
    this.extensionGalleryManifestService = extensionGalleryManifestService;
    this._manifest = null;
    this.updateThrottler = this._register(new Throttler());
    this.hideOnDisabled = false;
    this.options = { isMachineScoped: false, ...options };
    this.update();
    this._register(allowedExtensionsService.onDidChangeAllowedExtensionsConfigValue(() => this.update()));
    this._register(this.labelService.onDidChangeFormatters(() => this.updateLabel(), this));
  }
  static {
    this.CLASS = `${this.LABEL_ACTION_CLASS} prominent install`;
  }
  static {
    this.HIDE = `${this.CLASS} hide`;
  }
  set manifest(manifest) {
    this._manifest = manifest;
    this.updateLabel();
  }
  update() {
    this.updateThrottler.queue(() => this.computeAndUpdateEnablement());
  }
  async computeAndUpdateEnablement() {
    this.enabled = false;
    this.class = InstallAction.HIDE;
    this.hidden = true;
    if (!this.extension) {
      return;
    }
    if (this.extension.isBuiltin) {
      return;
    }
    if (this.extensionsWorkbenchService.canSetLanguage(this.extension)) {
      return;
    }
    if (this.extension.state !== ExtensionState.Uninstalled) {
      return;
    }
    if (this.options.installPreReleaseVersion && (!this.extension.hasPreReleaseVersion || this.allowedExtensionsService.isAllowed({ id: this.extension.identifier.id, publisherDisplayName: this.extension.publisherDisplayName, prerelease: true }) !== true)) {
      return;
    }
    if (!this.options.installPreReleaseVersion && !this.extension.hasReleaseVersion) {
      return;
    }
    this.hidden = false;
    this.class = InstallAction.CLASS;
    if (await this.extensionsWorkbenchService.canInstall(this.extension) === true) {
      this.enabled = true;
      this.updateLabel();
    }
  }
  async run() {
    if (!this.extension) {
      return;
    }
    if (this.extension.gallery && !this.extension.gallery.isSigned && shouldRequireRepositorySignatureFor(this.extension.private, await this.extensionGalleryManifestService.getExtensionGalleryManifest())) {
      const { result } = await this.dialogService.prompt({
        type: Severity.Warning,
        message: localize("not signed", "'{0}' is an extension from an unknown source. Are you sure you want to install?", this.extension.displayName),
        detail: localize("not signed detail", "Extension is not signed."),
        buttons: [
          {
            label: localize("install anyway", "Install Anyway"),
            run: () => {
              this.options.donotVerifySignature = true;
              return true;
            }
          }
        ],
        cancelButton: {
          run: () => false
        }
      });
      if (!result) {
        return;
      }
    }
    if (this.extension.deprecationInfo) {
      let detail = localize("deprecated message", "This extension is deprecated as it is no longer being maintained.");
      let DeprecationChoice;
      ((DeprecationChoice2) => {
        DeprecationChoice2[DeprecationChoice2["InstallAnyway"] = 0] = "InstallAnyway";
        DeprecationChoice2[DeprecationChoice2["ShowAlternateExtension"] = 1] = "ShowAlternateExtension";
        DeprecationChoice2[DeprecationChoice2["ConfigureSettings"] = 2] = "ConfigureSettings";
        DeprecationChoice2[DeprecationChoice2["Cancel"] = 3] = "Cancel";
      })(DeprecationChoice || (DeprecationChoice = {}));
      const buttons = [
        {
          label: localize("install anyway", "Install Anyway"),
          run: () => 0 /* InstallAnyway */
        }
      ];
      if (this.extension.deprecationInfo.extension) {
        detail = localize("deprecated with alternate extension message", "This extension is deprecated. Use the {0} extension instead.", this.extension.deprecationInfo.extension.displayName);
        const alternateExtension = this.extension.deprecationInfo.extension;
        buttons.push({
          label: localize({ key: "Show alternate extension", comment: ["&& denotes a mnemonic"] }, "&&Open {0}", this.extension.deprecationInfo.extension.displayName),
          run: async () => {
            const [extension2] = await this.extensionsWorkbenchService.getExtensions([{ id: alternateExtension.id, preRelease: alternateExtension.preRelease }], CancellationToken.None);
            await this.extensionsWorkbenchService.open(extension2);
            return 1 /* ShowAlternateExtension */;
          }
        });
      } else if (this.extension.deprecationInfo.settings) {
        detail = localize("deprecated with alternate settings message", "This extension is deprecated as this functionality is now built-in to VS Code.");
        const settings = this.extension.deprecationInfo.settings;
        buttons.push({
          label: localize({ key: "configure in settings", comment: ["&& denotes a mnemonic"] }, "&&Configure Settings"),
          run: async () => {
            await this.preferencesService.openSettings({ query: settings.map((setting) => `@id:${setting}`).join(" ") });
            return 2 /* ConfigureSettings */;
          }
        });
      } else if (this.extension.deprecationInfo.additionalInfo) {
        detail = new MarkdownString(`${detail} ${this.extension.deprecationInfo.additionalInfo}`);
      }
      const { result } = await this.dialogService.prompt({
        type: Severity.Warning,
        message: localize("install confirmation", "Are you sure you want to install '{0}'?", this.extension.displayName),
        detail: isString(detail) ? detail : void 0,
        custom: isString(detail) ? void 0 : {
          markdownDetails: [{
            markdown: detail
          }]
        },
        buttons,
        cancelButton: {
          run: () => 3 /* Cancel */
        }
      });
      if (result !== 0 /* InstallAnyway */) {
        return;
      }
    }
    this.extensionsWorkbenchService.open(this.extension, { showPreReleaseVersion: this.options.installPreReleaseVersion });
    alert(localize("installExtensionStart", "Installing extension {0} started. An editor is now open with more details on this extension", this.extension.displayName));
    this.telemetryService.publicLog("extensions:action:install", { ...this.extension.telemetryData, actionId: this.id });
    const extension = await this.install(this.extension);
    if (extension?.local) {
      alert(localize("installExtensionComplete", "Installing extension {0} is completed.", this.extension.displayName));
      const runningExtension = await this.getRunningExtension(extension.local);
      if (runningExtension && !(runningExtension.activationEvents && runningExtension.activationEvents.some((activationEent) => activationEent.startsWith("onLanguage")))) {
        const action = await this.getThemeAction(extension);
        if (action) {
          action.extension = extension;
          try {
            return action.run({ showCurrentTheme: true, ignoreFocusLost: true });
          } finally {
            action.dispose();
          }
        }
      }
    }
  }
  async getThemeAction(extension) {
    const colorThemes = await this.workbenchThemeService.getColorThemes();
    if (colorThemes.some((theme) => isThemeFromExtension(theme, extension))) {
      return this.instantiationService.createInstance(SetColorThemeAction);
    }
    const fileIconThemes = await this.workbenchThemeService.getFileIconThemes();
    if (fileIconThemes.some((theme) => isThemeFromExtension(theme, extension))) {
      return this.instantiationService.createInstance(SetFileIconThemeAction);
    }
    const productIconThemes = await this.workbenchThemeService.getProductIconThemes();
    if (productIconThemes.some((theme) => isThemeFromExtension(theme, extension))) {
      return this.instantiationService.createInstance(SetProductIconThemeAction);
    }
    return void 0;
  }
  async install(extension) {
    try {
      return await this.extensionsWorkbenchService.install(extension, this.options);
    } catch (error) {
      await this.instantiationService.createInstance(PromptExtensionInstallFailureAction, extension, this.options, extension.latestVersion, InstallOperation.Install, error).run();
      return void 0;
    }
  }
  async getRunningExtension(extension) {
    const runningExtension = await this.runtimeExtensionService.getExtension(extension.identifier.id);
    if (runningExtension) {
      return runningExtension;
    }
    if (this.runtimeExtensionService.canAddExtension(toExtensionDescription(extension))) {
      return new Promise((c, e) => {
        const disposable = this.runtimeExtensionService.onDidChangeExtensions(async () => {
          const runningExtension2 = await this.runtimeExtensionService.getExtension(extension.identifier.id);
          if (runningExtension2) {
            disposable.dispose();
            c(runningExtension2);
          }
        });
      });
    }
    return null;
  }
  updateLabel() {
    this.label = this.getLabel();
  }
  getLabel(primary) {
    if (this.extension?.isWorkspaceScoped && this.extension.resourceExtension && this.contextService.isInsideWorkspace(this.extension.resourceExtension.location)) {
      return localize("install workspace version", "Install Workspace Extension");
    }
    if (this.options.installPreReleaseVersion && this.extension?.hasPreReleaseVersion) {
      return primary ? localize("install pre-release", "Install Pre-Release") : localize("install pre-release version", "Install Pre-Release Version");
    }
    if (this.extension?.hasPreReleaseVersion) {
      return primary ? localize("install", "Install") : localize("install release version", "Install Release Version");
    }
    return localize("install", "Install");
  }
};
InstallAction = __decorateClass([
  __decorateParam(1, IExtensionsWorkbenchService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IExtensionService),
  __decorateParam(4, IWorkbenchThemeService),
  __decorateParam(5, ILabelService),
  __decorateParam(6, IDialogService),
  __decorateParam(7, IPreferencesService),
  __decorateParam(8, ITelemetryService),
  __decorateParam(9, IWorkspaceContextService),
  __decorateParam(10, IAllowedExtensionsService),
  __decorateParam(11, IExtensionGalleryManifestService)
], InstallAction);
let InstallDropdownAction = class extends ButtonWithDropDownExtensionAction {
  set manifest(manifest) {
    this.extensionActions.forEach((a) => a.manifest = manifest);
    this.update();
  }
  constructor(instantiationService, extensionManagementService) {
    super(`extensions.installActions`, InstallAction.CLASS, [
      [
        instantiationService.createInstance(InstallAction, { installPreReleaseVersion: extensionManagementService.preferPreReleases }),
        instantiationService.createInstance(InstallAction, { installPreReleaseVersion: !extensionManagementService.preferPreReleases })
      ]
    ]);
  }
  getLabel(action) {
    return action.getLabel(true);
  }
};
InstallDropdownAction = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IWorkbenchExtensionManagementService)
], InstallDropdownAction);
class InstallingLabelAction extends ExtensionAction {
  static {
    this.LABEL = localize("installing", "Installing");
  }
  static {
    this.CLASS = `${ExtensionAction.LABEL_ACTION_CLASS} install installing`;
  }
  constructor() {
    super("extension.installing", InstallingLabelAction.LABEL, InstallingLabelAction.CLASS, false);
  }
  update() {
    this.class = `${InstallingLabelAction.CLASS}${this.extension && this.extension.state === ExtensionState.Installing ? "" : " hide"}`;
  }
}
let InstallInOtherServerAction = class extends ExtensionAction {
  constructor(id, server, canInstallAnyWhere, extensionsWorkbenchService, extensionManagementServerService, extensionManifestPropertiesService) {
    super(id, InstallInOtherServerAction.INSTALL_LABEL, InstallInOtherServerAction.Class, false);
    this.server = server;
    this.canInstallAnyWhere = canInstallAnyWhere;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.extensionManagementServerService = extensionManagementServerService;
    this.extensionManifestPropertiesService = extensionManifestPropertiesService;
    this.updateWhenCounterExtensionChanges = true;
    this.update();
  }
  static {
    this.INSTALL_LABEL = localize("install", "Install");
  }
  static {
    this.INSTALLING_LABEL = localize("installing", "Installing");
  }
  static {
    this.Class = `${ExtensionAction.LABEL_ACTION_CLASS} prominent install-other-server`;
  }
  static {
    this.InstallingClass = `${ExtensionAction.LABEL_ACTION_CLASS} install-other-server installing`;
  }
  update() {
    this.enabled = false;
    this.class = InstallInOtherServerAction.Class;
    if (this.canInstall()) {
      const extensionInOtherServer = this.extensionsWorkbenchService.installed.filter((e) => areSameExtensions(e.identifier, this.extension.identifier) && e.server === this.server)[0];
      if (extensionInOtherServer) {
        if (extensionInOtherServer.state === ExtensionState.Installing && !extensionInOtherServer.local) {
          this.enabled = true;
          this.label = InstallInOtherServerAction.INSTALLING_LABEL;
          this.class = InstallInOtherServerAction.InstallingClass;
        }
      } else {
        this.enabled = true;
        this.label = this.getInstallLabel();
      }
    }
  }
  canInstall() {
    if (!this.extension || !this.server || !this.extension.local || this.extension.state !== ExtensionState.Installed || this.extension.type !== ExtensionType.User || this.extension.enablementState === EnablementState.DisabledByEnvironment || this.extension.enablementState === EnablementState.DisabledByTrustRequirement || this.extension.enablementState === EnablementState.DisabledByVirtualWorkspace) {
      return false;
    }
    if (isLanguagePackExtension(this.extension.local.manifest)) {
      return true;
    }
    if (this.server === this.extensionManagementServerService.localExtensionManagementServer && this.extensionManifestPropertiesService.prefersExecuteOnUI(this.extension.local.manifest)) {
      return true;
    }
    if (this.server === this.extensionManagementServerService.remoteExtensionManagementServer && this.extensionManifestPropertiesService.prefersExecuteOnWorkspace(this.extension.local.manifest)) {
      return true;
    }
    if (this.server === this.extensionManagementServerService.webExtensionManagementServer && this.extensionManifestPropertiesService.prefersExecuteOnWeb(this.extension.local.manifest)) {
      return true;
    }
    if (this.canInstallAnyWhere) {
      if (this.server === this.extensionManagementServerService.localExtensionManagementServer && this.extensionManifestPropertiesService.canExecuteOnUI(this.extension.local.manifest)) {
        return true;
      }
      if (this.server === this.extensionManagementServerService.remoteExtensionManagementServer && this.extensionManifestPropertiesService.canExecuteOnWorkspace(this.extension.local.manifest)) {
        return true;
      }
    }
    return false;
  }
  async run() {
    if (!this.extension?.local) {
      return;
    }
    if (!this.extension?.server) {
      return;
    }
    if (!this.server) {
      return;
    }
    this.extensionsWorkbenchService.open(this.extension);
    alert(localize("installExtensionStart", "Installing extension {0} started. An editor is now open with more details on this extension", this.extension.displayName));
    return this.extensionsWorkbenchService.installInServer(this.extension, this.server);
  }
};
InstallInOtherServerAction = __decorateClass([
  __decorateParam(3, IExtensionsWorkbenchService),
  __decorateParam(4, IExtensionManagementServerService),
  __decorateParam(5, IExtensionManifestPropertiesService)
], InstallInOtherServerAction);
let RemoteInstallAction = class extends InstallInOtherServerAction {
  constructor(canInstallAnyWhere, extensionsWorkbenchService, extensionManagementServerService, extensionManifestPropertiesService) {
    super(`extensions.remoteinstall`, extensionManagementServerService.remoteExtensionManagementServer, canInstallAnyWhere, extensionsWorkbenchService, extensionManagementServerService, extensionManifestPropertiesService);
  }
  getInstallLabel() {
    return this.extensionManagementServerService.remoteExtensionManagementServer ? localize({ key: "install in remote", comment: ["This is the name of the action to install an extension in remote server. Placeholder is for the name of remote server."] }, "Install in {0}", this.extensionManagementServerService.remoteExtensionManagementServer.label) : InstallInOtherServerAction.INSTALL_LABEL;
  }
};
RemoteInstallAction = __decorateClass([
  __decorateParam(1, IExtensionsWorkbenchService),
  __decorateParam(2, IExtensionManagementServerService),
  __decorateParam(3, IExtensionManifestPropertiesService)
], RemoteInstallAction);
let LocalInstallAction = class extends InstallInOtherServerAction {
  constructor(extensionsWorkbenchService, extensionManagementServerService, extensionManifestPropertiesService) {
    super(`extensions.localinstall`, extensionManagementServerService.localExtensionManagementServer, false, extensionsWorkbenchService, extensionManagementServerService, extensionManifestPropertiesService);
  }
  getInstallLabel() {
    return localize("install locally", "Install Locally");
  }
};
LocalInstallAction = __decorateClass([
  __decorateParam(0, IExtensionsWorkbenchService),
  __decorateParam(1, IExtensionManagementServerService),
  __decorateParam(2, IExtensionManifestPropertiesService)
], LocalInstallAction);
let WebInstallAction = class extends InstallInOtherServerAction {
  constructor(extensionsWorkbenchService, extensionManagementServerService, extensionManifestPropertiesService) {
    super(`extensions.webInstall`, extensionManagementServerService.webExtensionManagementServer, false, extensionsWorkbenchService, extensionManagementServerService, extensionManifestPropertiesService);
  }
  getInstallLabel() {
    return localize("install browser", "Install in Browser");
  }
};
WebInstallAction = __decorateClass([
  __decorateParam(0, IExtensionsWorkbenchService),
  __decorateParam(1, IExtensionManagementServerService),
  __decorateParam(2, IExtensionManifestPropertiesService)
], WebInstallAction);
let UninstallAction = class extends ExtensionAction {
  constructor(extensionsWorkbenchService, userDataProfilesService, dialogService) {
    super("extensions.uninstall", UninstallAction.UninstallLabel, UninstallAction.UninstallClass, false);
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.userDataProfilesService = userDataProfilesService;
    this.dialogService = dialogService;
    this.update();
  }
  static {
    this.UninstallLabel = localize("uninstallAction", "Uninstall");
  }
  static {
    this.UninstallingLabel = localize("Uninstalling", "Uninstalling");
  }
  static {
    this.UninstallClass = `${ExtensionAction.LABEL_ACTION_CLASS} uninstall`;
  }
  static {
    this.UnInstallingClass = `${ExtensionAction.LABEL_ACTION_CLASS} uninstall uninstalling`;
  }
  update() {
    if (!this.extension) {
      this.enabled = false;
      return;
    }
    const state = this.extension.state;
    if (state === ExtensionState.Uninstalling) {
      this.label = UninstallAction.UninstallingLabel;
      this.class = UninstallAction.UnInstallingClass;
      this.enabled = false;
      return;
    }
    this.label = this.extension.local?.isApplicationScoped && this.userDataProfilesService.profiles.length > 1 ? localize("uninstallAll", "Uninstall (All Profiles)") : UninstallAction.UninstallLabel;
    this.class = UninstallAction.UninstallClass;
    this.tooltip = UninstallAction.UninstallLabel;
    if (state !== ExtensionState.Installed) {
      this.enabled = false;
      return;
    }
    if (this.extension.isBuiltin) {
      this.enabled = false;
      return;
    }
    this.enabled = true;
  }
  async run() {
    if (!this.extension) {
      return;
    }
    alert(localize("uninstallExtensionStart", "Uninstalling extension {0} started.", this.extension.displayName));
    try {
      await this.extensionsWorkbenchService.uninstall(this.extension);
      alert(localize("uninstallExtensionComplete", "Please reload Visual Studio Code to complete the uninstallation of the extension {0}.", this.extension.displayName));
    } catch (error) {
      if (!isCancellationError(error)) {
        this.dialogService.error(getErrorMessage(error));
      }
    }
  }
};
UninstallAction = __decorateClass([
  __decorateParam(0, IExtensionsWorkbenchService),
  __decorateParam(1, IUserDataProfilesService),
  __decorateParam(2, IDialogService)
], UninstallAction);
let UpdateAction = class extends ExtensionAction {
  constructor(verbose, extensionsWorkbenchService, dialogService, openerService, instantiationService) {
    super(`extensions.update`, localize("update", "Update"), UpdateAction.DisabledClass, false);
    this.verbose = verbose;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.dialogService = dialogService;
    this.openerService = openerService;
    this.instantiationService = instantiationService;
    this.updateThrottler = this._register(new Throttler());
    this.update();
  }
  static {
    this.EnabledClass = `${this.LABEL_ACTION_CLASS} update`;
  }
  static {
    this.DisabledClass = `${this.EnabledClass} disabled`;
  }
  update() {
    this.updateThrottler.queue(() => this.computeAndUpdateEnablement());
    if (this.extension) {
      this.label = this.verbose ? localize("update to", "Update to v{0}", this.extension.latestVersion) : localize("update", "Update");
    }
  }
  async computeAndUpdateEnablement() {
    this.enabled = false;
    this.class = UpdateAction.DisabledClass;
    if (!this.extension) {
      return;
    }
    if (this.extension.deprecationInfo) {
      return;
    }
    const canInstall = await this.extensionsWorkbenchService.canInstall(this.extension);
    const isInstalled = this.extension.state === ExtensionState.Installed;
    this.enabled = canInstall === true && isInstalled && this.extension.outdated;
    this.class = this.enabled ? UpdateAction.EnabledClass : UpdateAction.DisabledClass;
  }
  async run() {
    if (!this.extension) {
      return;
    }
    const consent = await this.extensionsWorkbenchService.shouldRequireConsentToUpdate(this.extension);
    if (consent) {
      const { result } = await this.dialogService.prompt({
        type: "warning",
        title: localize("updateExtensionConsentTitle", "Update {0} Extension", this.extension.displayName),
        message: localize("updateExtensionConsent", "{0}\n\nWould you like to update the extension?", consent),
        buttons: [{
          label: localize("update", "Update"),
          run: () => "update"
        }, {
          label: localize("review", "Review"),
          run: () => "review"
        }, {
          label: localize("cancel", "Cancel"),
          run: () => "cancel"
        }]
      });
      if (result === "cancel") {
        return;
      }
      if (result === "review") {
        if (this.extension.hasChangelog()) {
          return this.extensionsWorkbenchService.open(this.extension, { tab: ExtensionEditorTab.Changelog });
        }
        if (this.extension.repository) {
          return this.openerService.open(this.extension.repository);
        }
        return this.extensionsWorkbenchService.open(this.extension);
      }
    }
    const installOptions = {};
    if (this.extension.local?.source === "vsix" && this.extension.local.pinned) {
      installOptions.pinned = false;
    }
    if (this.extension.local?.preRelease) {
      installOptions.installPreReleaseVersion = true;
    }
    try {
      alert(localize("updateExtensionStart", "Updating extension {0} to version {1} started.", this.extension.displayName, this.extension.latestVersion));
      await this.extensionsWorkbenchService.install(this.extension, installOptions);
      alert(localize("updateExtensionComplete", "Updating extension {0} to version {1} completed.", this.extension.displayName, this.extension.latestVersion));
    } catch (err) {
      this.instantiationService.createInstance(PromptExtensionInstallFailureAction, this.extension, installOptions, this.extension.latestVersion, InstallOperation.Update, err).run();
    }
  }
};
UpdateAction = __decorateClass([
  __decorateParam(1, IExtensionsWorkbenchService),
  __decorateParam(2, IDialogService),
  __decorateParam(3, IOpenerService),
  __decorateParam(4, IInstantiationService)
], UpdateAction);
let ToggleAutoUpdateForExtensionAction = class extends ExtensionAction {
  constructor(extensionsWorkbenchService, extensionEnablementService, allowedExtensionsService, configurationService) {
    super(ToggleAutoUpdateForExtensionAction.ID, ToggleAutoUpdateForExtensionAction.LABEL.value, ToggleAutoUpdateForExtensionAction.DisabledClass);
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.extensionEnablementService = extensionEnablementService;
    this.allowedExtensionsService = allowedExtensionsService;
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(AutoUpdateConfigurationKey)) {
        this.update();
      }
    }));
    this._register(allowedExtensionsService.onDidChangeAllowedExtensionsConfigValue((e) => this.update()));
    this.update();
  }
  static {
    this.ID = "workbench.extensions.action.toggleAutoUpdateForExtension";
  }
  static {
    this.LABEL = localize2("enableAutoUpdateLabel", "Auto Update");
  }
  static {
    this.EnabledClass = `${ExtensionAction.EXTENSION_ACTION_CLASS} auto-update`;
  }
  static {
    this.DisabledClass = `${this.EnabledClass} hide`;
  }
  update() {
    this.enabled = false;
    this.class = ToggleAutoUpdateForExtensionAction.DisabledClass;
    if (!this.extension) {
      return;
    }
    if (this.extension.isBuiltin) {
      return;
    }
    if (this.extension.deprecationInfo?.disallowInstall) {
      return;
    }
    const extension = this.extension.local ?? this.extension.gallery;
    if (extension && this.allowedExtensionsService.isAllowed(extension) !== true) {
      return;
    }
    if (this.extensionsWorkbenchService.getAutoUpdateValue() === "on" && !this.extensionEnablementService.isEnabledEnablementState(this.extension.enablementState)) {
      return;
    }
    this.enabled = true;
    this.class = ToggleAutoUpdateForExtensionAction.EnabledClass;
    this.checked = this.extensionsWorkbenchService.isAutoUpdateEnabledFor(this.extension);
  }
  async run() {
    if (!this.extension) {
      return;
    }
    const enableAutoUpdate = !this.extensionsWorkbenchService.isAutoUpdateEnabledFor(this.extension);
    await this.extensionsWorkbenchService.updateAutoUpdateEnablementFor(this.extension, enableAutoUpdate);
    if (enableAutoUpdate) {
      alert(localize("enableAutoUpdate", "Enabled auto updates for", this.extension.displayName));
    } else {
      alert(localize("disableAutoUpdate", "Disabled auto updates for", this.extension.displayName));
    }
  }
};
ToggleAutoUpdateForExtensionAction = __decorateClass([
  __decorateParam(0, IExtensionsWorkbenchService),
  __decorateParam(1, IWorkbenchExtensionEnablementService),
  __decorateParam(2, IAllowedExtensionsService),
  __decorateParam(3, IConfigurationService)
], ToggleAutoUpdateForExtensionAction);
let ToggleAutoUpdatesForPublisherAction = class extends ExtensionAction {
  constructor(extensionsWorkbenchService) {
    super(ToggleAutoUpdatesForPublisherAction.ID, ToggleAutoUpdatesForPublisherAction.LABEL);
    this.extensionsWorkbenchService = extensionsWorkbenchService;
  }
  static {
    this.ID = "workbench.extensions.action.toggleAutoUpdatesForPublisher";
  }
  static {
    this.LABEL = localize("toggleAutoUpdatesForPublisherLabel", "Auto Update All (From Publisher)");
  }
  update() {
  }
  async run() {
    if (!this.extension) {
      return;
    }
    alert(localize("ignoreExtensionUpdatePublisher", "Ignoring updates published by {0}.", this.extension.publisherDisplayName));
    const enableAutoUpdate = !this.extensionsWorkbenchService.isAutoUpdateEnabledFor(this.extension.publisher);
    await this.extensionsWorkbenchService.updateAutoUpdateEnablementFor(this.extension.publisher, enableAutoUpdate);
    if (enableAutoUpdate) {
      alert(localize("enableAutoUpdate", "Enabled auto updates for", this.extension.displayName));
    } else {
      alert(localize("disableAutoUpdate", "Disabled auto updates for", this.extension.displayName));
    }
  }
};
ToggleAutoUpdatesForPublisherAction = __decorateClass([
  __decorateParam(0, IExtensionsWorkbenchService)
], ToggleAutoUpdatesForPublisherAction);
let MigrateDeprecatedExtensionAction = class extends ExtensionAction {
  constructor(small, extensionsWorkbenchService) {
    super("extensionsAction.migrateDeprecatedExtension", localize("migrateExtension", "Migrate"), MigrateDeprecatedExtensionAction.DisabledClass, false);
    this.small = small;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.update();
  }
  static {
    this.EnabledClass = `${ExtensionAction.LABEL_ACTION_CLASS} migrate`;
  }
  static {
    this.DisabledClass = `${this.EnabledClass} disabled`;
  }
  update() {
    this.enabled = false;
    this.class = MigrateDeprecatedExtensionAction.DisabledClass;
    if (!this.extension?.local) {
      return;
    }
    if (this.extension.state !== ExtensionState.Installed) {
      return;
    }
    if (!this.extension.deprecationInfo?.extension) {
      return;
    }
    const id = this.extension.deprecationInfo.extension.id;
    if (this.extensionsWorkbenchService.local.some((e) => areSameExtensions(e.identifier, { id }))) {
      return;
    }
    this.enabled = true;
    this.class = MigrateDeprecatedExtensionAction.EnabledClass;
    this.tooltip = localize("migrate to", "Migrate to {0}", this.extension.deprecationInfo.extension.displayName);
    this.label = this.small ? localize("migrate", "Migrate") : this.tooltip;
  }
  async run() {
    if (!this.extension?.deprecationInfo?.extension) {
      return;
    }
    const local = this.extension.local;
    await this.extensionsWorkbenchService.uninstall(this.extension);
    const [extension] = await this.extensionsWorkbenchService.getExtensions([{ id: this.extension.deprecationInfo.extension.id, preRelease: this.extension.deprecationInfo?.extension?.preRelease }], CancellationToken.None);
    await this.extensionsWorkbenchService.install(extension, { isMachineScoped: local?.isMachineScoped });
  }
};
MigrateDeprecatedExtensionAction = __decorateClass([
  __decorateParam(1, IExtensionsWorkbenchService)
], MigrateDeprecatedExtensionAction);
let DropDownExtensionAction = class extends ExtensionAction {
  constructor(id, label, cssClass, enabled, instantiationService) {
    super(id, label, cssClass, enabled);
    this.instantiationService = instantiationService;
    this._actionViewItem = null;
  }
  createActionViewItem(options) {
    this._actionViewItem = this.instantiationService.createInstance(DropDownExtensionActionViewItem, this, options);
    return this._actionViewItem;
  }
  run(actionGroups) {
    this._actionViewItem?.showMenu(actionGroups);
    return Promise.resolve();
  }
};
DropDownExtensionAction = __decorateClass([
  __decorateParam(4, IInstantiationService)
], DropDownExtensionAction);
let DropDownExtensionActionViewItem = class extends ActionViewItem {
  constructor(action, options, contextMenuService) {
    super(null, action, { ...options, icon: true, label: true });
    this.contextMenuService = contextMenuService;
  }
  showMenu(menuActionGroups) {
    if (this.element) {
      const actions = this.getActions(menuActionGroups);
      this.contextMenuService.showContextMenu({
        ...getWorkbenchMenuMotionContextMenuOptions(this.element),
        getActions: () => actions,
        actionRunner: this.actionRunner,
        onHide: () => disposeIfDisposable(actions)
      });
    }
  }
  getActions(menuActionGroups) {
    let actions = [];
    for (const menuActions of menuActionGroups) {
      actions = [...actions, ...menuActions, new Separator()];
    }
    return actions.length ? actions.slice(0, actions.length - 1) : actions;
  }
};
DropDownExtensionActionViewItem = __decorateClass([
  __decorateParam(2, IContextMenuService)
], DropDownExtensionActionViewItem);
async function getContextMenuActionsGroups(extension, contextKeyService, instantiationService) {
  return instantiationService.invokeFunction(async (accessor) => {
    const extensionsWorkbenchService = accessor.get(IExtensionsWorkbenchService);
    const extensionEnablementService = accessor.get(IWorkbenchExtensionEnablementService);
    const menuService = accessor.get(IMenuService);
    const extensionRecommendationsService = accessor.get(IExtensionRecommendationsService);
    const extensionIgnoredRecommendationsService = accessor.get(IExtensionIgnoredRecommendationsService);
    const workbenchThemeService = accessor.get(IWorkbenchThemeService);
    const authenticationUsageService = accessor.get(IAuthenticationUsageService);
    const allowedExtensionsService = accessor.get(IAllowedExtensionsService);
    const cksOverlay = [];
    if (extension) {
      cksOverlay.push(["extension", extension.identifier.id]);
      cksOverlay.push(["isBuiltinExtension", extension.isBuiltin]);
      cksOverlay.push(["isDefaultApplicationScopedExtension", extension.local && isApplicationScopedExtension(extension.local.manifest)]);
      cksOverlay.push(["isApplicationScopedExtension", extension.local && extension.local.isApplicationScoped]);
      cksOverlay.push(["isWorkspaceScopedExtension", extension.isWorkspaceScoped]);
      cksOverlay.push(["isGalleryExtension", !!extension.identifier.uuid]);
      if (extension.local) {
        cksOverlay.push(["extensionSource", extension.local.source]);
      }
      cksOverlay.push(["extensionHasConfiguration", extension.local && !!extension.local.manifest.contributes && !!extension.local.manifest.contributes.configuration]);
      cksOverlay.push(["extensionHasKeybindings", extension.local && !!extension.local.manifest.contributes && !!extension.local.manifest.contributes.keybindings]);
      cksOverlay.push(["extensionHasCommands", extension.local && !!extension.local.manifest.contributes && !!extension.local.manifest.contributes?.commands]);
      cksOverlay.push(["isExtensionRecommended", !!extensionRecommendationsService.getAllRecommendationsWithReason()[extension.identifier.id.toLowerCase()]]);
      cksOverlay.push(["isExtensionWorkspaceRecommended", extensionRecommendationsService.getAllRecommendationsWithReason()[extension.identifier.id.toLowerCase()]?.reasonId === ExtensionRecommendationReason.Workspace]);
      cksOverlay.push(["isUserIgnoredRecommendation", extensionIgnoredRecommendationsService.globalIgnoredRecommendations.some((e) => e === extension.identifier.id.toLowerCase())]);
      cksOverlay.push(["isExtensionPinned", extension.pinned]);
      cksOverlay.push(["isExtensionEnabled", extensionEnablementService.isEnabledEnablementState(extension.enablementState)]);
      switch (extension.state) {
        case ExtensionState.Installing:
          cksOverlay.push(["extensionStatus", "installing"]);
          break;
        case ExtensionState.Installed:
          cksOverlay.push(["extensionStatus", "installed"]);
          break;
        case ExtensionState.Uninstalling:
          cksOverlay.push(["extensionStatus", "uninstalling"]);
          break;
        case ExtensionState.Uninstalled:
          cksOverlay.push(["extensionStatus", "uninstalled"]);
          break;
      }
      cksOverlay.push(["installedExtensionIsPreReleaseVersion", !!extension.local?.isPreReleaseVersion]);
      cksOverlay.push(["installedExtensionIsOptedToPreRelease", !!extension.local?.preRelease]);
      cksOverlay.push(["galleryExtensionIsPreReleaseVersion", !!extension.gallery?.properties.isPreReleaseVersion]);
      cksOverlay.push(["galleryExtensionHasPreReleaseVersion", extension.gallery?.hasPreReleaseVersion]);
      cksOverlay.push(["extensionHasPreReleaseVersion", extension.hasPreReleaseVersion]);
      cksOverlay.push(["extensionHasReleaseVersion", extension.hasReleaseVersion]);
      cksOverlay.push(["extensionDisallowInstall", extension.isMalicious || extension.deprecationInfo?.disallowInstall]);
      cksOverlay.push(["isExtensionAllowed", allowedExtensionsService.isAllowed({ id: extension.identifier.id, publisherDisplayName: extension.publisherDisplayName }) === true]);
      cksOverlay.push(["isPreReleaseExtensionAllowed", allowedExtensionsService.isAllowed({ id: extension.identifier.id, publisherDisplayName: extension.publisherDisplayName, prerelease: true }) === true]);
      cksOverlay.push(["extensionIsUnsigned", extension.gallery && !extension.gallery.isSigned]);
      cksOverlay.push(["extensionIsPrivate", extension.gallery?.private]);
      const [colorThemes, fileIconThemes, productIconThemes, extensionUsesAuth] = await Promise.all([workbenchThemeService.getColorThemes(), workbenchThemeService.getFileIconThemes(), workbenchThemeService.getProductIconThemes(), authenticationUsageService.extensionUsesAuth(extension.identifier.id.toLowerCase())]);
      cksOverlay.push(["extensionHasColorThemes", colorThemes.some((theme) => isThemeFromExtension(theme, extension))]);
      cksOverlay.push(["extensionHasFileIconThemes", fileIconThemes.some((theme) => isThemeFromExtension(theme, extension))]);
      cksOverlay.push(["extensionHasProductIconThemes", productIconThemes.some((theme) => isThemeFromExtension(theme, extension))]);
      cksOverlay.push(["extensionHasAccountPreferences", extensionUsesAuth]);
      cksOverlay.push(["canSetLanguage", extensionsWorkbenchService.canSetLanguage(extension)]);
      cksOverlay.push(["isActiveLanguagePackExtension", extension.gallery && language === getLocale(extension.gallery)]);
    }
    const actionsGroups = menuService.getMenuActions(MenuId.ExtensionContext, contextKeyService.createOverlay(cksOverlay), { shouldForwardArgs: true });
    return actionsGroups;
  });
}
function toActions(actionsGroups, instantiationService) {
  const result = [];
  for (const [, actions] of actionsGroups) {
    result.push(actions.map((action) => {
      if (action instanceof SubmenuAction) {
        return action;
      }
      return instantiationService.createInstance(MenuItemExtensionAction, action);
    }));
  }
  return result;
}
async function getContextMenuActions(extension, contextKeyService, instantiationService) {
  const actionsGroups = await getContextMenuActionsGroups(extension, contextKeyService, instantiationService);
  return toActions(actionsGroups, instantiationService);
}
let ManageExtensionAction = class extends DropDownExtensionAction {
  constructor(instantiationService, extensionService, contextKeyService, productService) {
    super(ManageExtensionAction.ID, "", "", true, instantiationService);
    this.extensionService = extensionService;
    this.contextKeyService = contextKeyService;
    this.productService = productService;
    this.tooltip = localize("manage", "Manage");
    this.update();
  }
  static {
    this.ID = "extensions.manage";
  }
  static {
    this.Class = `${ExtensionAction.ICON_ACTION_CLASS} manage ` + ThemeIcon.asClassName(manageExtensionIcon);
  }
  static {
    this.HideManageExtensionClass = `${this.Class} hide`;
  }
  async getActionGroups() {
    const groups = [];
    const contextMenuActionsGroups = await getContextMenuActionsGroups(this.extension, this.contextKeyService, this.instantiationService);
    const themeActions = [], installActions = [], updateActions = [], otherActionGroups = [];
    for (const [group, actions] of contextMenuActionsGroups) {
      if (group === INSTALL_ACTIONS_GROUP) {
        installActions.push(...toActions([[group, actions]], this.instantiationService)[0]);
      } else if (group === UPDATE_ACTIONS_GROUP) {
        updateActions.push(...toActions([[group, actions]], this.instantiationService)[0]);
      } else if (group === THEME_ACTIONS_GROUP) {
        themeActions.push(...toActions([[group, actions]], this.instantiationService)[0]);
      } else {
        otherActionGroups.push(...toActions([[group, actions]], this.instantiationService));
      }
    }
    if (themeActions.length) {
      groups.push(themeActions);
    }
    const isChatExtension = this.extension && ExtensionIdentifier.equals(this.extension.identifier.id, this.productService.defaultChatAgent?.chatExtensionId);
    if (isChatExtension) {
      groups.push([
        this.instantiationService.createInstance(EnableAIFeaturesGloballyAction),
        this.instantiationService.createInstance(EnableAIFeaturesInWorkspaceAction)
      ]);
      groups.push([
        this.instantiationService.createInstance(DisableAIFeaturesGloballyAction),
        this.instantiationService.createInstance(DisableAIFeaturesInWorkspaceAction)
      ]);
    } else {
      groups.push([
        this.instantiationService.createInstance(EnableGloballyAction),
        this.instantiationService.createInstance(EnableForWorkspaceAction)
      ]);
      groups.push([
        this.instantiationService.createInstance(DisableGloballyAction),
        this.instantiationService.createInstance(DisableForWorkspaceAction)
      ]);
    }
    if (updateActions.length) {
      groups.push(updateActions);
    }
    groups.push([
      ...installActions.length ? installActions : [],
      this.instantiationService.createInstance(InstallAnotherVersionAction, this.extension, false),
      this.instantiationService.createInstance(UninstallAction)
    ]);
    otherActionGroups.forEach((actions) => groups.push(actions));
    groups.forEach((group) => group.forEach((extensionAction) => {
      if (extensionAction instanceof ExtensionAction) {
        extensionAction.extension = this.extension;
      }
    }));
    return groups;
  }
  async run() {
    await this.extensionService.whenInstalledExtensionsRegistered();
    return super.run(await this.getActionGroups());
  }
  update() {
    this.class = ManageExtensionAction.HideManageExtensionClass;
    this.enabled = false;
    if (this.extension) {
      const state = this.extension.state;
      this.enabled = state === ExtensionState.Installed;
      this.class = this.enabled || state === ExtensionState.Uninstalling ? ManageExtensionAction.Class : ManageExtensionAction.HideManageExtensionClass;
    }
  }
};
ManageExtensionAction = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IExtensionService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IProductService)
], ManageExtensionAction);
class ExtensionEditorManageExtensionAction extends DropDownExtensionAction {
  constructor(contextKeyService, instantiationService) {
    super("extensionEditor.manageExtension", "", `${ExtensionAction.ICON_ACTION_CLASS} manage ${ThemeIcon.asClassName(manageExtensionIcon)}`, true, instantiationService);
    this.contextKeyService = contextKeyService;
    this.tooltip = localize("manage", "Manage");
  }
  update() {
  }
  async run() {
    const actionGroups = [];
    (await getContextMenuActions(this.extension, this.contextKeyService, this.instantiationService)).forEach((actions) => actionGroups.push(actions));
    actionGroups.forEach((group) => group.forEach((extensionAction) => {
      if (extensionAction instanceof ExtensionAction) {
        extensionAction.extension = this.extension;
      }
    }));
    return super.run(actionGroups);
  }
}
let MenuItemExtensionAction = class extends ExtensionAction {
  constructor(action, extensionsWorkbenchService) {
    super(action.id, action.label);
    this.action = action;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
  }
  get enabled() {
    return this.action.enabled;
  }
  set enabled(value) {
    this.action.enabled = value;
  }
  update() {
    if (!this.extension) {
      return;
    }
    if (this.action.id === TOGGLE_IGNORE_EXTENSION_ACTION_ID) {
      this.checked = !this.extensionsWorkbenchService.isExtensionIgnoredToSync(this.extension);
    } else if (this.action.id === ToggleAutoUpdateForExtensionAction.ID) {
      this.checked = this.extensionsWorkbenchService.isAutoUpdateEnabledFor(this.extension);
    } else if (this.action.id === ToggleAutoUpdatesForPublisherAction.ID) {
      this.checked = this.extensionsWorkbenchService.isAutoUpdateEnabledFor(this.extension.publisher);
    } else {
      this.checked = this.action.checked;
    }
  }
  async run() {
    if (this.extension) {
      const id = this.extension.local ? getExtensionId(this.extension.local.manifest.publisher, this.extension.local.manifest.name) : this.extension.gallery ? getExtensionId(this.extension.gallery.publisher, this.extension.gallery.name) : this.extension.identifier.id;
      const extensionArg = {
        id: this.extension.identifier.id,
        version: this.extension.version,
        location: this.extension.local?.location,
        galleryLink: this.extension.url
      };
      await this.action.run(id, extensionArg);
    }
  }
};
MenuItemExtensionAction = __decorateClass([
  __decorateParam(1, IExtensionsWorkbenchService)
], MenuItemExtensionAction);
let TogglePreReleaseExtensionAction = class extends ExtensionAction {
  constructor(extensionsWorkbenchService, allowedExtensionsService) {
    super(TogglePreReleaseExtensionAction.ID, TogglePreReleaseExtensionAction.LABEL, TogglePreReleaseExtensionAction.DisabledClass);
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.allowedExtensionsService = allowedExtensionsService;
    this._register(allowedExtensionsService.onDidChangeAllowedExtensionsConfigValue(() => this.update()));
    this.update();
  }
  static {
    this.ID = "workbench.extensions.action.togglePreRlease";
  }
  static {
    this.LABEL = localize("togglePreRleaseLabel", "Pre-Release");
  }
  static {
    this.EnabledClass = `${ExtensionAction.LABEL_ACTION_CLASS} prominent pre-release`;
  }
  static {
    this.DisabledClass = `${this.EnabledClass} hide`;
  }
  update() {
    this.enabled = false;
    this.class = TogglePreReleaseExtensionAction.DisabledClass;
    if (!this.extension) {
      return;
    }
    if (this.extension.isBuiltin) {
      return;
    }
    if (this.extension.state !== ExtensionState.Installed) {
      return;
    }
    if (!this.extension.hasPreReleaseVersion) {
      return;
    }
    if (!this.extension.gallery) {
      return;
    }
    if (this.extension.preRelease) {
      if (!this.extension.isPreReleaseVersion) {
        return;
      }
      if (this.allowedExtensionsService.isAllowed({ id: this.extension.identifier.id, publisherDisplayName: this.extension.publisherDisplayName }) !== true) {
        return;
      }
    }
    if (!this.extension.preRelease) {
      if (!this.extension.gallery.hasPreReleaseVersion) {
        return;
      }
      if (this.allowedExtensionsService.isAllowed(this.extension.gallery) !== true) {
        return;
      }
    }
    this.enabled = true;
    this.class = TogglePreReleaseExtensionAction.EnabledClass;
    if (this.extension.preRelease) {
      this.label = localize("togglePreRleaseDisableLabel", "Switch to Release Version");
      this.tooltip = localize("togglePreRleaseDisableTooltip", "This will switch and enable updates to release versions");
    } else {
      this.label = localize("switchToPreReleaseLabel", "Switch to Pre-Release Version");
      this.tooltip = localize("switchToPreReleaseTooltip", "This will switch to pre-release version and enable updates to latest version always");
    }
  }
  async run() {
    if (!this.extension) {
      return;
    }
    this.extensionsWorkbenchService.open(this.extension, { showPreReleaseVersion: !this.extension.preRelease });
    await this.extensionsWorkbenchService.togglePreRelease(this.extension);
  }
};
TogglePreReleaseExtensionAction = __decorateClass([
  __decorateParam(0, IExtensionsWorkbenchService),
  __decorateParam(1, IAllowedExtensionsService)
], TogglePreReleaseExtensionAction);
let InstallAnotherVersionAction = class extends ExtensionAction {
  constructor(extension, whenInstalled, extensionsWorkbenchService, extensionManagementService, extensionGalleryService, quickInputService, instantiationService, dialogService, allowedExtensionsService) {
    super(InstallAnotherVersionAction.ID, InstallAnotherVersionAction.LABEL, ExtensionAction.LABEL_ACTION_CLASS);
    this.whenInstalled = whenInstalled;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.extensionManagementService = extensionManagementService;
    this.extensionGalleryService = extensionGalleryService;
    this.quickInputService = quickInputService;
    this.instantiationService = instantiationService;
    this.dialogService = dialogService;
    this.allowedExtensionsService = allowedExtensionsService;
    this._register(allowedExtensionsService.onDidChangeAllowedExtensionsConfigValue(() => this.update()));
    this.extension = extension;
    this.update();
  }
  static {
    this.ID = "workbench.extensions.action.install.anotherVersion";
  }
  static {
    this.LABEL = localize("install another version", "Install Specific Version...");
  }
  update() {
    this.enabled = !!this.extension && !this.extension.isBuiltin && !!this.extension.identifier.uuid && !this.extension.deprecationInfo && this.allowedExtensionsService.isAllowed({ id: this.extension.identifier.id, publisherDisplayName: this.extension.publisherDisplayName }) === true;
    if (this.enabled && this.whenInstalled) {
      this.enabled = !!this.extension?.local && !!this.extension.server && this.extension.state === ExtensionState.Installed;
    }
  }
  async run() {
    if (!this.enabled) {
      return;
    }
    if (!this.extension) {
      return;
    }
    const targetPlatform = this.extension.server ? await this.extension.server.extensionManagementService.getTargetPlatform() : await this.extensionManagementService.getTargetPlatform();
    const allVersions = await this.extensionGalleryService.getAllCompatibleVersions(this.extension.identifier, this.extension.local?.preRelease ?? this.extension.gallery?.properties.isPreReleaseVersion ?? false, targetPlatform);
    if (!allVersions.length) {
      await this.dialogService.info(localize("no versions", "This extension has no other versions."));
      return;
    }
    const picks = allVersions.map((v, i) => {
      return {
        id: v.version,
        label: v.version,
        description: `${fromNow(new Date(Date.parse(v.date)), true)}${v.isPreReleaseVersion ? ` (${localize("pre-release", "pre-release")})` : ""}${v.version === this.extension?.local?.manifest.version ? ` (${localize("current", "current")})` : ""}`,
        ariaLabel: `${v.isPreReleaseVersion ? "Pre-Release version" : "Release version"} ${v.version}`,
        isPreReleaseVersion: v.isPreReleaseVersion
      };
    });
    const pick = await this.quickInputService.pick(
      picks,
      {
        placeHolder: localize("selectVersion", "Select Version to Install"),
        matchOnDetail: true
      }
    );
    if (pick) {
      if (this.extension.local?.manifest.version === pick.id) {
        return;
      }
      const options = { installPreReleaseVersion: pick.isPreReleaseVersion, version: pick.id };
      try {
        await this.extensionsWorkbenchService.install(this.extension, options);
      } catch (error) {
        this.instantiationService.createInstance(PromptExtensionInstallFailureAction, this.extension, options, pick.id, InstallOperation.Install, error).run();
      }
    }
    return null;
  }
};
InstallAnotherVersionAction = __decorateClass([
  __decorateParam(2, IExtensionsWorkbenchService),
  __decorateParam(3, IWorkbenchExtensionManagementService),
  __decorateParam(4, IExtensionGalleryService),
  __decorateParam(5, IQuickInputService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IDialogService),
  __decorateParam(8, IAllowedExtensionsService)
], InstallAnotherVersionAction);
let EnableForWorkspaceAction = class extends ExtensionAction {
  constructor(extensionsWorkbenchService, extensionEnablementService, productService) {
    super(EnableForWorkspaceAction.ID, EnableForWorkspaceAction.LABEL, ExtensionAction.LABEL_ACTION_CLASS);
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.extensionEnablementService = extensionEnablementService;
    this.productService = productService;
    this.tooltip = localize("enableForWorkspaceActionToolTip", "Enable this extension only in this workspace");
    this.update();
  }
  static {
    this.ID = "extensions.enableForWorkspace";
  }
  static {
    this.LABEL = localize("enableForWorkspaceAction", "Enable (Workspace)");
  }
  update() {
    this.enabled = false;
    if (this.extension && this.extension.local && !this.extension.isWorkspaceScoped) {
      if (ExtensionIdentifier.equals(this.extension.identifier.id, this.productService.defaultChatAgent?.chatExtensionId)) {
        return;
      }
      this.enabled = this.extension.state === ExtensionState.Installed && !this.extensionEnablementService.isEnabled(this.extension.local) && this.extensionEnablementService.canChangeWorkspaceEnablement(this.extension.local);
    }
  }
  async run() {
    if (!this.extension) {
      return;
    }
    return this.extensionsWorkbenchService.setEnablement(this.extension, EnablementState.EnabledWorkspace);
  }
};
EnableForWorkspaceAction = __decorateClass([
  __decorateParam(0, IExtensionsWorkbenchService),
  __decorateParam(1, IWorkbenchExtensionEnablementService),
  __decorateParam(2, IProductService)
], EnableForWorkspaceAction);
let EnableGloballyAction = class extends ExtensionAction {
  constructor(extensionsWorkbenchService, extensionEnablementService, productService) {
    super(EnableGloballyAction.ID, EnableGloballyAction.LABEL, ExtensionAction.LABEL_ACTION_CLASS);
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.extensionEnablementService = extensionEnablementService;
    this.productService = productService;
    this.tooltip = localize("enableGloballyActionToolTip", "Enable this extension");
    this.update();
  }
  static {
    this.ID = "extensions.enableGlobally";
  }
  static {
    this.LABEL = localize("enableGloballyAction", "Enable");
  }
  update() {
    this.enabled = false;
    if (this.extension && this.extension.local && !this.extension.isWorkspaceScoped) {
      if (ExtensionIdentifier.equals(this.extension.identifier.id, this.productService.defaultChatAgent?.chatExtensionId)) {
        return;
      }
      this.enabled = this.extension.state === ExtensionState.Installed && this.extensionEnablementService.isDisabledGlobally(this.extension.local) && this.extensionEnablementService.canChangeEnablement(this.extension.local);
    }
  }
  async run() {
    if (!this.extension) {
      return;
    }
    return this.extensionsWorkbenchService.setEnablement(this.extension, EnablementState.EnabledGlobally);
  }
};
EnableGloballyAction = __decorateClass([
  __decorateParam(0, IExtensionsWorkbenchService),
  __decorateParam(1, IWorkbenchExtensionEnablementService),
  __decorateParam(2, IProductService)
], EnableGloballyAction);
let DisableForWorkspaceAction = class extends ExtensionAction {
  constructor(workspaceContextService, extensionsWorkbenchService, extensionEnablementService, extensionService, productService) {
    super(DisableForWorkspaceAction.ID, DisableForWorkspaceAction.LABEL, ExtensionAction.LABEL_ACTION_CLASS);
    this.workspaceContextService = workspaceContextService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.extensionEnablementService = extensionEnablementService;
    this.extensionService = extensionService;
    this.productService = productService;
    this.tooltip = localize("disableForWorkspaceActionToolTip", "Disable this extension only in this workspace");
    this.update();
    this._register(this.extensionService.onDidChangeExtensions(() => this.update()));
  }
  static {
    this.ID = "extensions.disableForWorkspace";
  }
  static {
    this.LABEL = localize("disableForWorkspaceAction", "Disable (Workspace)");
  }
  update() {
    this.enabled = false;
    if (this.extension && this.extension.local && !this.extension.isWorkspaceScoped && this.extensionService.extensions.some((e) => areSameExtensions({ id: e.identifier.value, uuid: e.uuid }, this.extension.identifier) && this.workspaceContextService.getWorkbenchState() !== WorkbenchState.EMPTY)) {
      if (ExtensionIdentifier.equals(this.extension.identifier.id, this.productService.defaultChatAgent?.chatExtensionId)) {
        return;
      }
      this.enabled = this.extension.state === ExtensionState.Installed && (this.extension.enablementState === EnablementState.EnabledGlobally || this.extension.enablementState === EnablementState.EnabledWorkspace) && this.extensionEnablementService.canChangeWorkspaceEnablement(this.extension.local);
    }
  }
  async run() {
    if (!this.extension) {
      return;
    }
    return this.extensionsWorkbenchService.setEnablement(this.extension, EnablementState.DisabledWorkspace);
  }
};
DisableForWorkspaceAction = __decorateClass([
  __decorateParam(0, IWorkspaceContextService),
  __decorateParam(1, IExtensionsWorkbenchService),
  __decorateParam(2, IWorkbenchExtensionEnablementService),
  __decorateParam(3, IExtensionService),
  __decorateParam(4, IProductService)
], DisableForWorkspaceAction);
let DisableGloballyAction = class extends ExtensionAction {
  constructor(extensionsWorkbenchService, extensionEnablementService, extensionService, productService) {
    super(DisableGloballyAction.ID, DisableGloballyAction.LABEL, ExtensionAction.LABEL_ACTION_CLASS);
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.extensionEnablementService = extensionEnablementService;
    this.extensionService = extensionService;
    this.productService = productService;
    this.tooltip = localize("disableGloballyActionToolTip", "Disable this extension");
    this.update();
    this._register(this.extensionService.onDidChangeExtensions(() => this.update()));
  }
  static {
    this.ID = "extensions.disableGlobally";
  }
  static {
    this.LABEL = localize("disableGloballyAction", "Disable");
  }
  update() {
    this.enabled = false;
    if (this.extension && this.extension.local && !this.extension.isWorkspaceScoped && this.extensionService.extensions.some((e) => areSameExtensions({ id: e.identifier.value, uuid: e.uuid }, this.extension.identifier))) {
      if (ExtensionIdentifier.equals(this.extension.identifier.id, this.productService.defaultChatAgent?.chatExtensionId)) {
        return;
      }
      this.enabled = this.extension.state === ExtensionState.Installed && (this.extension.enablementState === EnablementState.EnabledGlobally || this.extension.enablementState === EnablementState.EnabledWorkspace) && this.extensionEnablementService.canChangeEnablement(this.extension.local);
    }
  }
  async run() {
    if (!this.extension) {
      return;
    }
    return this.extensionsWorkbenchService.setEnablement(this.extension, EnablementState.DisabledGlobally);
  }
};
DisableGloballyAction = __decorateClass([
  __decorateParam(0, IExtensionsWorkbenchService),
  __decorateParam(1, IWorkbenchExtensionEnablementService),
  __decorateParam(2, IExtensionService),
  __decorateParam(3, IProductService)
], DisableGloballyAction);
let EnableAIFeaturesGloballyAction = class extends ExtensionAction {
  constructor(productService, configurationService) {
    super(EnableAIFeaturesGloballyAction.ID, EnableAIFeaturesGloballyAction.LABEL, ExtensionAction.LABEL_ACTION_CLASS);
    this.productService = productService;
    this.configurationService = configurationService;
    this.tooltip = localize("enableAIGloballyActionToolTip", "Enable AI features");
    this.update();
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(ChatAIDisabledSettingId)) {
        this.update();
      }
    }));
  }
  static {
    this.ID = "extensions.enableAIGlobally";
  }
  static {
    this.LABEL = localize("enableAIGloballyAction", "Enable AI Features");
  }
  update() {
    this.enabled = false;
    if (!this.extension?.local) {
      return;
    }
    if (!ExtensionIdentifier.equals(this.extension.identifier.id, this.productService.defaultChatAgent?.chatExtensionId)) {
      return;
    }
    if (this.extension.enablementState === EnablementState.DisabledWorkspace) {
      return;
    }
    if (this.extension.enablementState === EnablementState.EnabledWorkspace) {
      return;
    }
    const inspect = this.configurationService.inspect(ChatAIDisabledSettingId);
    if (inspect?.workspaceValue === true) {
      return;
    }
    this.enabled = inspect.value === true;
  }
  async run() {
    await this.configurationService.updateValue(ChatAIDisabledSettingId, false);
  }
};
EnableAIFeaturesGloballyAction = __decorateClass([
  __decorateParam(0, IProductService),
  __decorateParam(1, IConfigurationService)
], EnableAIFeaturesGloballyAction);
let EnableAIFeaturesInWorkspaceAction = class extends ExtensionAction {
  constructor(productService, extensionsWorkbenchService, configurationService, extensionEnablementService) {
    super(EnableAIFeaturesInWorkspaceAction.ID, EnableAIFeaturesInWorkspaceAction.LABEL, ExtensionAction.LABEL_ACTION_CLASS);
    this.productService = productService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.configurationService = configurationService;
    this.extensionEnablementService = extensionEnablementService;
    this.tooltip = localize("enableAIInWorkspaceActionToolTip", "Enable AI features in this workspace");
    this.update();
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(ChatAIDisabledSettingId)) {
        this.update();
      }
    }));
  }
  static {
    this.ID = "extensions.enableAIInWorkspace";
  }
  static {
    this.LABEL = localize("enableAIInWorkspaceAction", "Enable AI Features (Workspace)");
  }
  update() {
    this.enabled = false;
    if (!this.extension?.local) {
      return;
    }
    if (!ExtensionIdentifier.equals(this.extension.identifier.id, this.productService.defaultChatAgent?.chatExtensionId)) {
      return;
    }
    if (!this.extensionEnablementService.canChangeWorkspaceEnablement(this.extension.local)) {
      return;
    }
    const inspect = this.configurationService.inspect(ChatAIDisabledSettingId);
    if (inspect.value === false) {
      return;
    }
    if (inspect?.workspaceValue === true) {
      this.enabled = true;
      return;
    }
    if (this.extension.enablementState === EnablementState.EnabledWorkspace) {
      return;
    }
    this.enabled = true;
    return;
  }
  async run() {
    if (!this.extension) {
      return;
    }
    await this.extensionsWorkbenchService.setEnablement(this.extension, EnablementState.EnabledWorkspace);
    if (this.configurationService.getValue(ChatAIDisabledSettingId) === true) {
      await this.configurationService.updateValue(ChatAIDisabledSettingId, false, ConfigurationTarget.WORKSPACE);
    }
  }
};
EnableAIFeaturesInWorkspaceAction = __decorateClass([
  __decorateParam(0, IProductService),
  __decorateParam(1, IExtensionsWorkbenchService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IWorkbenchExtensionEnablementService)
], EnableAIFeaturesInWorkspaceAction);
let DisableAIFeaturesGloballyAction = class extends ExtensionAction {
  constructor(productService, configurationService) {
    super(DisableAIFeaturesGloballyAction.ID, DisableAIFeaturesGloballyAction.LABEL, ExtensionAction.LABEL_ACTION_CLASS);
    this.productService = productService;
    this.configurationService = configurationService;
    this.tooltip = localize("disableAIGloballyActionToolTip", "Disable AI features");
    this.update();
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(ChatAIDisabledSettingId)) {
        this.update();
      }
    }));
  }
  static {
    this.ID = "extensions.disableAIGlobally";
  }
  static {
    this.LABEL = localize("disableAIGloballyAction", "Disable AI Features");
  }
  update() {
    this.enabled = false;
    if (this.extension && ExtensionIdentifier.equals(this.extension.identifier.id, this.productService.defaultChatAgent?.chatExtensionId)) {
      this.enabled = this.extension.state === ExtensionState.Installed && this.configurationService.getValue(ChatAIDisabledSettingId) !== true && this.extension.enablementState !== EnablementState.DisabledWorkspace;
    }
  }
  async run() {
    await this.configurationService.updateValue(ChatAIDisabledSettingId, true);
  }
};
DisableAIFeaturesGloballyAction = __decorateClass([
  __decorateParam(0, IProductService),
  __decorateParam(1, IConfigurationService)
], DisableAIFeaturesGloballyAction);
let DisableAIFeaturesInWorkspaceAction = class extends ExtensionAction {
  constructor(productService, extensionsWorkbenchService, extensionEnablementService, extensionService) {
    super(DisableAIFeaturesInWorkspaceAction.ID, DisableAIFeaturesInWorkspaceAction.LABEL, ExtensionAction.LABEL_ACTION_CLASS);
    this.productService = productService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.extensionEnablementService = extensionEnablementService;
    this.extensionService = extensionService;
    this.tooltip = localize("disableAIInWorkspaceActionToolTip", "Disable AI features in this workspace");
    this.update();
    this._register(this.extensionService.onDidChangeExtensions(() => this.update()));
  }
  static {
    this.ID = "extensions.disableAIInWorkspace";
  }
  static {
    this.LABEL = localize("disableAIInWorkspaceAction", "Disable AI Features (Workspace)");
  }
  update() {
    this.enabled = false;
    if (this.extension && this.extension.local && ExtensionIdentifier.equals(this.extension.identifier.id, this.productService.defaultChatAgent?.chatExtensionId)) {
      this.enabled = this.extension.state === ExtensionState.Installed && (this.extension.enablementState === EnablementState.EnabledGlobally || this.extension.enablementState === EnablementState.EnabledWorkspace) && this.extensionEnablementService.canChangeWorkspaceEnablement(this.extension.local);
    }
  }
  async run() {
    if (!this.extension) {
      return;
    }
    await this.extensionsWorkbenchService.setEnablement(this.extension, EnablementState.DisabledWorkspace);
    await this.extensionsWorkbenchService.updateRunningExtensions(localize("restartExtensionHost.reason.disable", "Disabling AI features"));
  }
};
DisableAIFeaturesInWorkspaceAction = __decorateClass([
  __decorateParam(0, IProductService),
  __decorateParam(1, IExtensionsWorkbenchService),
  __decorateParam(2, IWorkbenchExtensionEnablementService),
  __decorateParam(3, IExtensionService)
], DisableAIFeaturesInWorkspaceAction);
let EnableDropDownAction = class extends ButtonWithDropDownExtensionAction {
  constructor(instantiationService) {
    super("extensions.enable", ExtensionAction.LABEL_ACTION_CLASS, [
      [
        instantiationService.createInstance(EnableGloballyAction),
        instantiationService.createInstance(EnableForWorkspaceAction)
      ],
      [
        instantiationService.createInstance(EnableAIFeaturesGloballyAction),
        instantiationService.createInstance(EnableAIFeaturesInWorkspaceAction)
      ]
    ]);
  }
};
EnableDropDownAction = __decorateClass([
  __decorateParam(0, IInstantiationService)
], EnableDropDownAction);
let DisableDropDownAction = class extends ButtonWithDropDownExtensionAction {
  constructor(instantiationService) {
    super("extensions.disable", ExtensionAction.LABEL_ACTION_CLASS, [
      [
        instantiationService.createInstance(DisableGloballyAction),
        instantiationService.createInstance(DisableForWorkspaceAction)
      ],
      [
        instantiationService.createInstance(DisableAIFeaturesGloballyAction),
        instantiationService.createInstance(DisableAIFeaturesInWorkspaceAction)
      ]
    ]);
  }
};
DisableDropDownAction = __decorateClass([
  __decorateParam(0, IInstantiationService)
], DisableDropDownAction);
let ExtensionRuntimeStateAction = class extends ExtensionAction {
  constructor(hostService, extensionsWorkbenchService, updateService, extensionService, productService, telemetryService) {
    super("extensions.runtimeState", "", ExtensionRuntimeStateAction.DisabledClass, false);
    this.hostService = hostService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.updateService = updateService;
    this.extensionService = extensionService;
    this.productService = productService;
    this.telemetryService = telemetryService;
    this.updateWhenCounterExtensionChanges = true;
    this._register(this.extensionService.onDidChangeExtensions(() => this.update()));
    this.update();
  }
  static {
    this.EnabledClass = `${ExtensionAction.LABEL_ACTION_CLASS} prominent reload`;
  }
  static {
    this.DisabledClass = `${this.EnabledClass} disabled`;
  }
  update() {
    this.enabled = false;
    this.tooltip = "";
    this.class = ExtensionRuntimeStateAction.DisabledClass;
    if (!this.extension) {
      return;
    }
    const state = this.extension.state;
    if (state === ExtensionState.Installing || state === ExtensionState.Uninstalling) {
      return;
    }
    if (this.extension.local && this.extension.local.manifest && this.extension.local.manifest.contributes && this.extension.local.manifest.contributes.localizations && this.extension.local.manifest.contributes.localizations.length > 0) {
      return;
    }
    const runtimeState = this.extension.runtimeState;
    if (!runtimeState) {
      return;
    }
    this.enabled = true;
    this.class = ExtensionRuntimeStateAction.EnabledClass;
    this.tooltip = runtimeState.reason;
    this.label = runtimeState.action === ExtensionRuntimeActionType.ReloadWindow ? localize("reload window", "Reload Window") : runtimeState.action === ExtensionRuntimeActionType.RestartExtensions ? localize("restart extensions", "Restart Extensions") : runtimeState.action === ExtensionRuntimeActionType.QuitAndInstall ? localize("restart product", "Restart to Update") : runtimeState.action === ExtensionRuntimeActionType.ApplyUpdate || runtimeState.action === ExtensionRuntimeActionType.DownloadUpdate ? localize("update product", "Update {0}", this.productService.nameShort) : "";
  }
  async run() {
    const runtimeState = this.extension?.runtimeState;
    if (!runtimeState?.action) {
      return;
    }
    this.telemetryService.publicLog2("extensions:runtimestate:action", {
      action: runtimeState.action
    });
    if (runtimeState?.action === ExtensionRuntimeActionType.ReloadWindow) {
      return this.hostService.reload();
    } else if (runtimeState?.action === ExtensionRuntimeActionType.RestartExtensions) {
      return this.extensionsWorkbenchService.updateRunningExtensions();
    } else if (runtimeState?.action === ExtensionRuntimeActionType.DownloadUpdate) {
      return this.updateService.downloadUpdate(true);
    } else if (runtimeState?.action === ExtensionRuntimeActionType.ApplyUpdate) {
      return this.updateService.applyUpdate();
    } else if (runtimeState?.action === ExtensionRuntimeActionType.QuitAndInstall) {
      return this.updateService.quitAndInstall();
    }
  }
};
ExtensionRuntimeStateAction = __decorateClass([
  __decorateParam(0, IHostService),
  __decorateParam(1, IExtensionsWorkbenchService),
  __decorateParam(2, IUpdateService),
  __decorateParam(3, IExtensionService),
  __decorateParam(4, IProductService),
  __decorateParam(5, ITelemetryService)
], ExtensionRuntimeStateAction);
function isThemeFromExtension(theme, extension) {
  return !!(extension && theme.extensionData && ExtensionIdentifier.equals(theme.extensionData.extensionId, extension.identifier.id));
}
function getQuickPickEntries(themes, currentTheme, extension, showCurrentTheme) {
  const picks = [];
  for (const theme of themes) {
    if (isThemeFromExtension(theme, extension) && !(showCurrentTheme && theme === currentTheme)) {
      picks.push({ label: theme.label, id: theme.id });
    }
  }
  if (showCurrentTheme) {
    picks.push({ type: "separator", label: localize("current", "current") });
    picks.push({ label: currentTheme.label, id: currentTheme.id });
  }
  return picks;
}
let SetColorThemeAction = class extends ExtensionAction {
  constructor(extensionService, workbenchThemeService, quickInputService, extensionEnablementService) {
    super(SetColorThemeAction.ID, SetColorThemeAction.TITLE.value, SetColorThemeAction.DisabledClass, false);
    this.workbenchThemeService = workbenchThemeService;
    this.quickInputService = quickInputService;
    this.extensionEnablementService = extensionEnablementService;
    this._register(Event.any(extensionService.onDidChangeExtensions, workbenchThemeService.onDidColorThemeChange)(() => this.update(), this));
    this.update();
  }
  static {
    this.ID = "workbench.extensions.action.setColorTheme";
  }
  static {
    this.TITLE = localize2("workbench.extensions.action.setColorTheme", "Set Color Theme");
  }
  static {
    this.EnabledClass = `${ExtensionAction.LABEL_ACTION_CLASS} theme`;
  }
  static {
    this.DisabledClass = `${this.EnabledClass} disabled`;
  }
  update() {
    this.workbenchThemeService.getColorThemes().then((colorThemes) => {
      this.enabled = this.computeEnablement(colorThemes);
      this.class = this.enabled ? SetColorThemeAction.EnabledClass : SetColorThemeAction.DisabledClass;
    });
  }
  computeEnablement(colorThemes) {
    return !!this.extension && this.extension.state === ExtensionState.Installed && this.extensionEnablementService.isEnabledEnablementState(this.extension.enablementState) && colorThemes.some((th) => isThemeFromExtension(th, this.extension));
  }
  async run({ showCurrentTheme, ignoreFocusLost } = { showCurrentTheme: false, ignoreFocusLost: false }) {
    const colorThemes = await this.workbenchThemeService.getColorThemes();
    if (!this.computeEnablement(colorThemes)) {
      return;
    }
    const currentTheme = this.workbenchThemeService.getColorTheme();
    const delayer = new Delayer(100);
    const picks = getQuickPickEntries(colorThemes, currentTheme, this.extension, showCurrentTheme);
    const pickedTheme = await this.quickInputService.pick(
      picks,
      {
        placeHolder: localize("select color theme", "Select Color Theme"),
        onDidFocus: (item) => delayer.trigger(() => this.workbenchThemeService.setColorTheme(item.id, void 0)),
        ignoreFocusLost
      }
    );
    return this.workbenchThemeService.setColorTheme(pickedTheme ? pickedTheme.id : currentTheme.id, "auto");
  }
};
SetColorThemeAction = __decorateClass([
  __decorateParam(0, IExtensionService),
  __decorateParam(1, IWorkbenchThemeService),
  __decorateParam(2, IQuickInputService),
  __decorateParam(3, IWorkbenchExtensionEnablementService)
], SetColorThemeAction);
let SetFileIconThemeAction = class extends ExtensionAction {
  constructor(extensionService, workbenchThemeService, quickInputService, extensionEnablementService) {
    super(SetFileIconThemeAction.ID, SetFileIconThemeAction.TITLE.value, SetFileIconThemeAction.DisabledClass, false);
    this.workbenchThemeService = workbenchThemeService;
    this.quickInputService = quickInputService;
    this.extensionEnablementService = extensionEnablementService;
    this._register(Event.any(extensionService.onDidChangeExtensions, workbenchThemeService.onDidFileIconThemeChange)(() => this.update(), this));
    this.update();
  }
  static {
    this.ID = "workbench.extensions.action.setFileIconTheme";
  }
  static {
    this.TITLE = localize2("workbench.extensions.action.setFileIconTheme", "Set File Icon Theme");
  }
  static {
    this.EnabledClass = `${ExtensionAction.LABEL_ACTION_CLASS} theme`;
  }
  static {
    this.DisabledClass = `${this.EnabledClass} disabled`;
  }
  update() {
    this.workbenchThemeService.getFileIconThemes().then((fileIconThemes) => {
      this.enabled = this.computeEnablement(fileIconThemes);
      this.class = this.enabled ? SetFileIconThemeAction.EnabledClass : SetFileIconThemeAction.DisabledClass;
    });
  }
  computeEnablement(colorThemfileIconThemess) {
    return !!this.extension && this.extension.state === ExtensionState.Installed && this.extensionEnablementService.isEnabledEnablementState(this.extension.enablementState) && colorThemfileIconThemess.some((th) => isThemeFromExtension(th, this.extension));
  }
  async run({ showCurrentTheme, ignoreFocusLost } = { showCurrentTheme: false, ignoreFocusLost: false }) {
    const fileIconThemes = await this.workbenchThemeService.getFileIconThemes();
    if (!this.computeEnablement(fileIconThemes)) {
      return;
    }
    const currentTheme = this.workbenchThemeService.getFileIconTheme();
    const delayer = new Delayer(100);
    const picks = getQuickPickEntries(fileIconThemes, currentTheme, this.extension, showCurrentTheme);
    const pickedTheme = await this.quickInputService.pick(
      picks,
      {
        placeHolder: localize("select file icon theme", "Select File Icon Theme"),
        onDidFocus: (item) => delayer.trigger(() => this.workbenchThemeService.setFileIconTheme(item.id, void 0)),
        ignoreFocusLost
      }
    );
    return this.workbenchThemeService.setFileIconTheme(pickedTheme ? pickedTheme.id : currentTheme.id, "auto");
  }
};
SetFileIconThemeAction = __decorateClass([
  __decorateParam(0, IExtensionService),
  __decorateParam(1, IWorkbenchThemeService),
  __decorateParam(2, IQuickInputService),
  __decorateParam(3, IWorkbenchExtensionEnablementService)
], SetFileIconThemeAction);
let SetProductIconThemeAction = class extends ExtensionAction {
  constructor(extensionService, workbenchThemeService, quickInputService, extensionEnablementService) {
    super(SetProductIconThemeAction.ID, SetProductIconThemeAction.TITLE.value, SetProductIconThemeAction.DisabledClass, false);
    this.workbenchThemeService = workbenchThemeService;
    this.quickInputService = quickInputService;
    this.extensionEnablementService = extensionEnablementService;
    this._register(Event.any(extensionService.onDidChangeExtensions, workbenchThemeService.onDidProductIconThemeChange)(() => this.update(), this));
    this.update();
  }
  static {
    this.ID = "workbench.extensions.action.setProductIconTheme";
  }
  static {
    this.TITLE = localize2("workbench.extensions.action.setProductIconTheme", "Set Product Icon Theme");
  }
  static {
    this.EnabledClass = `${ExtensionAction.LABEL_ACTION_CLASS} theme`;
  }
  static {
    this.DisabledClass = `${this.EnabledClass} disabled`;
  }
  update() {
    this.workbenchThemeService.getProductIconThemes().then((productIconThemes) => {
      this.enabled = this.computeEnablement(productIconThemes);
      this.class = this.enabled ? SetProductIconThemeAction.EnabledClass : SetProductIconThemeAction.DisabledClass;
    });
  }
  computeEnablement(productIconThemes) {
    return !!this.extension && this.extension.state === ExtensionState.Installed && this.extensionEnablementService.isEnabledEnablementState(this.extension.enablementState) && productIconThemes.some((th) => isThemeFromExtension(th, this.extension));
  }
  async run({ showCurrentTheme, ignoreFocusLost } = { showCurrentTheme: false, ignoreFocusLost: false }) {
    const productIconThemes = await this.workbenchThemeService.getProductIconThemes();
    if (!this.computeEnablement(productIconThemes)) {
      return;
    }
    const currentTheme = this.workbenchThemeService.getProductIconTheme();
    const delayer = new Delayer(100);
    const picks = getQuickPickEntries(productIconThemes, currentTheme, this.extension, showCurrentTheme);
    const pickedTheme = await this.quickInputService.pick(
      picks,
      {
        placeHolder: localize("select product icon theme", "Select Product Icon Theme"),
        onDidFocus: (item) => delayer.trigger(() => this.workbenchThemeService.setProductIconTheme(item.id, void 0)),
        ignoreFocusLost
      }
    );
    return this.workbenchThemeService.setProductIconTheme(pickedTheme ? pickedTheme.id : currentTheme.id, "auto");
  }
};
SetProductIconThemeAction = __decorateClass([
  __decorateParam(0, IExtensionService),
  __decorateParam(1, IWorkbenchThemeService),
  __decorateParam(2, IQuickInputService),
  __decorateParam(3, IWorkbenchExtensionEnablementService)
], SetProductIconThemeAction);
let SetLanguageAction = class extends ExtensionAction {
  constructor(extensionsWorkbenchService) {
    super(SetLanguageAction.ID, SetLanguageAction.TITLE.value, SetLanguageAction.DisabledClass, false);
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.update();
  }
  static {
    this.ID = "workbench.extensions.action.setDisplayLanguage";
  }
  static {
    this.TITLE = localize2("workbench.extensions.action.setDisplayLanguage", "Set Display Language");
  }
  static {
    this.EnabledClass = `${ExtensionAction.LABEL_ACTION_CLASS} language`;
  }
  static {
    this.DisabledClass = `${this.EnabledClass} disabled`;
  }
  update() {
    this.enabled = false;
    this.class = SetLanguageAction.DisabledClass;
    if (!this.extension) {
      return;
    }
    if (!this.extensionsWorkbenchService.canSetLanguage(this.extension)) {
      return;
    }
    if (this.extension.gallery && language === getLocale(this.extension.gallery)) {
      return;
    }
    this.enabled = true;
    this.class = SetLanguageAction.EnabledClass;
  }
  async run() {
    return this.extension && this.extensionsWorkbenchService.setLanguage(this.extension);
  }
};
SetLanguageAction = __decorateClass([
  __decorateParam(0, IExtensionsWorkbenchService)
], SetLanguageAction);
let ClearLanguageAction = class extends ExtensionAction {
  constructor(extensionsWorkbenchService, localeService) {
    super(ClearLanguageAction.ID, ClearLanguageAction.TITLE.value, ClearLanguageAction.DisabledClass, false);
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.localeService = localeService;
    this.update();
  }
  static {
    this.ID = "workbench.extensions.action.clearLanguage";
  }
  static {
    this.TITLE = localize2("workbench.extensions.action.clearLanguage", "Clear Display Language");
  }
  static {
    this.EnabledClass = `${ExtensionAction.LABEL_ACTION_CLASS} language`;
  }
  static {
    this.DisabledClass = `${this.EnabledClass} disabled`;
  }
  update() {
    this.enabled = false;
    this.class = ClearLanguageAction.DisabledClass;
    if (!this.extension) {
      return;
    }
    if (!this.extensionsWorkbenchService.canSetLanguage(this.extension)) {
      return;
    }
    if (this.extension.gallery && language !== getLocale(this.extension.gallery)) {
      return;
    }
    this.enabled = true;
    this.class = ClearLanguageAction.EnabledClass;
  }
  async run() {
    return this.extension && this.localeService.clearLocalePreference();
  }
};
ClearLanguageAction = __decorateClass([
  __decorateParam(0, IExtensionsWorkbenchService),
  __decorateParam(1, ILocaleService)
], ClearLanguageAction);
let ShowRecommendedExtensionAction = class extends Action {
  constructor(extensionId, extensionWorkbenchService) {
    super(ShowRecommendedExtensionAction.ID, ShowRecommendedExtensionAction.LABEL, void 0, false);
    this.extensionWorkbenchService = extensionWorkbenchService;
    this.extensionId = extensionId;
  }
  static {
    this.ID = "workbench.extensions.action.showRecommendedExtension";
  }
  static {
    this.LABEL = localize("showRecommendedExtension", "Show Recommended Extension");
  }
  async run() {
    await this.extensionWorkbenchService.openSearch(`@id:${this.extensionId}`);
    const [extension] = await this.extensionWorkbenchService.getExtensions([{ id: this.extensionId }], { source: "install-recommendation" }, CancellationToken.None);
    if (extension) {
      return this.extensionWorkbenchService.open(extension);
    }
    return null;
  }
};
ShowRecommendedExtensionAction = __decorateClass([
  __decorateParam(1, IExtensionsWorkbenchService)
], ShowRecommendedExtensionAction);
let InstallRecommendedExtensionAction = class extends Action {
  constructor(extensionId, instantiationService, extensionWorkbenchService) {
    super(InstallRecommendedExtensionAction.ID, InstallRecommendedExtensionAction.LABEL, void 0, false);
    this.instantiationService = instantiationService;
    this.extensionWorkbenchService = extensionWorkbenchService;
    this.extensionId = extensionId;
  }
  static {
    this.ID = "workbench.extensions.action.installRecommendedExtension";
  }
  static {
    this.LABEL = localize("installRecommendedExtension", "Install Recommended Extension");
  }
  async run() {
    await this.extensionWorkbenchService.openSearch(`@id:${this.extensionId}`);
    const [extension] = await this.extensionWorkbenchService.getExtensions([{ id: this.extensionId }], { source: "install-recommendation" }, CancellationToken.None);
    if (extension) {
      await this.extensionWorkbenchService.open(extension);
      try {
        await this.extensionWorkbenchService.install(extension);
      } catch (err) {
        this.instantiationService.createInstance(PromptExtensionInstallFailureAction, extension, void 0, extension.latestVersion, InstallOperation.Install, err).run();
      }
    }
  }
};
InstallRecommendedExtensionAction = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IExtensionsWorkbenchService)
], InstallRecommendedExtensionAction);
let IgnoreExtensionRecommendationAction = class extends Action {
  constructor(extension, extensionRecommendationsManagementService) {
    super(IgnoreExtensionRecommendationAction.ID, "Ignore Recommendation");
    this.extension = extension;
    this.extensionRecommendationsManagementService = extensionRecommendationsManagementService;
    this.class = IgnoreExtensionRecommendationAction.Class;
    this.tooltip = localize("ignoreExtensionRecommendation", "Do not recommend this extension again");
    this.enabled = true;
  }
  static {
    this.ID = "extensions.ignore";
  }
  static {
    this.Class = `${ExtensionAction.LABEL_ACTION_CLASS} ignore`;
  }
  run() {
    this.extensionRecommendationsManagementService.toggleGlobalIgnoredRecommendation(this.extension.identifier.id, true);
    return Promise.resolve();
  }
};
IgnoreExtensionRecommendationAction = __decorateClass([
  __decorateParam(1, IExtensionIgnoredRecommendationsService)
], IgnoreExtensionRecommendationAction);
let UndoIgnoreExtensionRecommendationAction = class extends Action {
  constructor(extension, extensionRecommendationsManagementService) {
    super(UndoIgnoreExtensionRecommendationAction.ID, "Undo");
    this.extension = extension;
    this.extensionRecommendationsManagementService = extensionRecommendationsManagementService;
    this.class = UndoIgnoreExtensionRecommendationAction.Class;
    this.tooltip = localize("undo", "Undo");
    this.enabled = true;
  }
  static {
    this.ID = "extensions.ignore";
  }
  static {
    this.Class = `${ExtensionAction.LABEL_ACTION_CLASS} undo-ignore`;
  }
  run() {
    this.extensionRecommendationsManagementService.toggleGlobalIgnoredRecommendation(this.extension.identifier.id, false);
    return Promise.resolve();
  }
};
UndoIgnoreExtensionRecommendationAction = __decorateClass([
  __decorateParam(1, IExtensionIgnoredRecommendationsService)
], UndoIgnoreExtensionRecommendationAction);
let AbstractConfigureRecommendedExtensionsAction = class extends Action {
  constructor(id, label, contextService, fileService, textFileService, editorService, jsonEditingService, textModelResolverService) {
    super(id, label);
    this.contextService = contextService;
    this.fileService = fileService;
    this.textFileService = textFileService;
    this.editorService = editorService;
    this.jsonEditingService = jsonEditingService;
    this.textModelResolverService = textModelResolverService;
  }
  openExtensionsFile(extensionsFileResource) {
    return this.getOrCreateExtensionsFile(extensionsFileResource).then(
      ({ created, content }) => this.getSelectionPosition(content, extensionsFileResource, ["recommendations"]).then((selection) => this.editorService.openEditor({
        resource: extensionsFileResource,
        options: {
          pinned: created,
          selection
        }
      })),
      (error) => Promise.reject(new Error(localize("OpenExtensionsFile.failed", "Unable to create 'extensions.json' file inside the '.vscode' folder ({0}).", error)))
    );
  }
  openWorkspaceConfigurationFile(workspaceConfigurationFile) {
    return this.getOrUpdateWorkspaceConfigurationFile(workspaceConfigurationFile).then((content) => this.getSelectionPosition(content.value.toString(), content.resource, ["extensions", "recommendations"])).then((selection) => this.editorService.openEditor({
      resource: workspaceConfigurationFile,
      options: {
        selection,
        forceReload: true
        // because content has changed
      }
    }));
  }
  getOrUpdateWorkspaceConfigurationFile(workspaceConfigurationFile) {
    return Promise.resolve(this.fileService.readFile(workspaceConfigurationFile)).then((content) => {
      const workspaceRecommendations = json.parse(content.value.toString())["extensions"];
      if (!workspaceRecommendations || !workspaceRecommendations.recommendations) {
        return this.jsonEditingService.write(workspaceConfigurationFile, [{ path: ["extensions"], value: { recommendations: [] } }], true).then(() => this.fileService.readFile(workspaceConfigurationFile));
      }
      return content;
    });
  }
  getSelectionPosition(content, resource, path) {
    const tree = json.parseTree(content);
    const node = json.findNodeAtLocation(tree, path);
    if (node && node.parent && node.parent.children) {
      const recommendationsValueNode = node.parent.children[1];
      const lastExtensionNode = recommendationsValueNode.children && recommendationsValueNode.children.length ? recommendationsValueNode.children[recommendationsValueNode.children.length - 1] : null;
      const offset = lastExtensionNode ? lastExtensionNode.offset + lastExtensionNode.length : recommendationsValueNode.offset + 1;
      return Promise.resolve(this.textModelResolverService.createModelReference(resource)).then((reference) => {
        const position = reference.object.textEditorModel.getPositionAt(offset);
        reference.dispose();
        return {
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        };
      });
    }
    return Promise.resolve(void 0);
  }
  getOrCreateExtensionsFile(extensionsFileResource) {
    return Promise.resolve(this.fileService.readFile(extensionsFileResource)).then((content) => {
      return { created: false, extensionsFileResource, content: content.value.toString() };
    }, (err) => {
      return this.textFileService.write(extensionsFileResource, ExtensionsConfigurationInitialContent).then(() => {
        return { created: true, extensionsFileResource, content: ExtensionsConfigurationInitialContent };
      });
    });
  }
};
AbstractConfigureRecommendedExtensionsAction = __decorateClass([
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, IFileService),
  __decorateParam(4, ITextFileService),
  __decorateParam(5, IEditorService),
  __decorateParam(6, IJSONEditingService),
  __decorateParam(7, ITextModelService)
], AbstractConfigureRecommendedExtensionsAction);
let ConfigureWorkspaceRecommendedExtensionsAction = class extends AbstractConfigureRecommendedExtensionsAction {
  static {
    this.ID = "workbench.extensions.action.configureWorkspaceRecommendedExtensions";
  }
  static {
    this.LABEL = localize("configureWorkspaceRecommendedExtensions", "Configure Recommended Extensions (Workspace)");
  }
  constructor(id, label, fileService, textFileService, contextService, editorService, jsonEditingService, textModelResolverService) {
    super(id, label, contextService, fileService, textFileService, editorService, jsonEditingService, textModelResolverService);
    this._register(this.contextService.onDidChangeWorkbenchState(() => this.update(), this));
    this.update();
  }
  update() {
    this.enabled = this.contextService.getWorkbenchState() !== WorkbenchState.EMPTY;
  }
  run() {
    switch (this.contextService.getWorkbenchState()) {
      case WorkbenchState.FOLDER:
        return this.openExtensionsFile(this.contextService.getWorkspace().folders[0].toResource(EXTENSIONS_CONFIG));
      case WorkbenchState.WORKSPACE:
        return this.openWorkspaceConfigurationFile(this.contextService.getWorkspace().configuration);
    }
    return Promise.resolve();
  }
};
ConfigureWorkspaceRecommendedExtensionsAction = __decorateClass([
  __decorateParam(2, IFileService),
  __decorateParam(3, ITextFileService),
  __decorateParam(4, IWorkspaceContextService),
  __decorateParam(5, IEditorService),
  __decorateParam(6, IJSONEditingService),
  __decorateParam(7, ITextModelService)
], ConfigureWorkspaceRecommendedExtensionsAction);
let ConfigureWorkspaceFolderRecommendedExtensionsAction = class extends AbstractConfigureRecommendedExtensionsAction {
  constructor(id, label, fileService, textFileService, contextService, editorService, jsonEditingService, textModelResolverService, commandService) {
    super(id, label, contextService, fileService, textFileService, editorService, jsonEditingService, textModelResolverService);
    this.commandService = commandService;
  }
  static {
    this.ID = "workbench.extensions.action.configureWorkspaceFolderRecommendedExtensions";
  }
  static {
    this.LABEL = localize("configureWorkspaceFolderRecommendedExtensions", "Configure Recommended Extensions (Workspace Folder)");
  }
  run() {
    const folderCount = this.contextService.getWorkspace().folders.length;
    const pickFolderPromise = folderCount === 1 ? Promise.resolve(this.contextService.getWorkspace().folders[0]) : this.commandService.executeCommand(PICK_WORKSPACE_FOLDER_COMMAND_ID);
    return Promise.resolve(pickFolderPromise).then((workspaceFolder) => {
      if (workspaceFolder) {
        return this.openExtensionsFile(workspaceFolder.toResource(EXTENSIONS_CONFIG));
      }
      return null;
    });
  }
};
ConfigureWorkspaceFolderRecommendedExtensionsAction = __decorateClass([
  __decorateParam(2, IFileService),
  __decorateParam(3, ITextFileService),
  __decorateParam(4, IWorkspaceContextService),
  __decorateParam(5, IEditorService),
  __decorateParam(6, IJSONEditingService),
  __decorateParam(7, ITextModelService),
  __decorateParam(8, ICommandService)
], ConfigureWorkspaceFolderRecommendedExtensionsAction);
let ExtensionStatusLabelAction = class extends Action {
  constructor(extensionService, extensionManagementServerService, extensionEnablementService) {
    super("extensions.action.statusLabel", "", ExtensionStatusLabelAction.DISABLED_CLASS, false);
    this.extensionService = extensionService;
    this.extensionManagementServerService = extensionManagementServerService;
    this.extensionEnablementService = extensionEnablementService;
    this.initialStatus = null;
    this.status = null;
    this.version = null;
    this.enablementState = null;
    this._extension = null;
  }
  static {
    this.ENABLED_CLASS = `${ExtensionAction.TEXT_ACTION_CLASS} extension-status-label`;
  }
  static {
    this.DISABLED_CLASS = `${this.ENABLED_CLASS} hide`;
  }
  get extension() {
    return this._extension;
  }
  set extension(extension) {
    if (!(this._extension && extension && areSameExtensions(this._extension.identifier, extension.identifier))) {
      this.initialStatus = null;
      this.status = null;
      this.enablementState = null;
    }
    this._extension = extension;
    this.update();
  }
  update() {
    const label = this.computeLabel();
    this.label = label || "";
    this.class = label ? ExtensionStatusLabelAction.ENABLED_CLASS : ExtensionStatusLabelAction.DISABLED_CLASS;
  }
  computeLabel() {
    if (!this.extension) {
      return null;
    }
    const currentStatus = this.status;
    const currentVersion = this.version;
    const currentEnablementState = this.enablementState;
    this.status = this.extension.state;
    this.version = this.extension.version;
    if (this.initialStatus === null) {
      this.initialStatus = this.status;
    }
    this.enablementState = this.extension.enablementState;
    const canAddExtension = () => {
      const runningExtension = this.extensionService.extensions.filter((e) => areSameExtensions({ id: e.identifier.value, uuid: e.uuid }, this.extension.identifier))[0];
      if (this.extension.local) {
        if (runningExtension && this.extension.version === runningExtension.version) {
          return true;
        }
        return this.extensionService.canAddExtension(toExtensionDescription(this.extension.local));
      }
      return false;
    };
    const canRemoveExtension = () => {
      if (this.extension.local) {
        if (this.extensionService.extensions.every((e) => !(areSameExtensions({ id: e.identifier.value, uuid: e.uuid }, this.extension.identifier) && this.extension.server === this.extensionManagementServerService.getExtensionManagementServer(toExtension(e))))) {
          return true;
        }
        return this.extensionService.canRemoveExtension(toExtensionDescription(this.extension.local));
      }
      return false;
    };
    if (currentStatus !== null) {
      if (currentStatus === ExtensionState.Installing && this.status === ExtensionState.Installed) {
        if (this.initialStatus === ExtensionState.Uninstalled && canAddExtension()) {
          return localize("installed", "Installed");
        }
        if (this.initialStatus === ExtensionState.Installed && this.version !== currentVersion && canAddExtension()) {
          return localize("updated", "Updated");
        }
        return null;
      }
      if (currentStatus === ExtensionState.Uninstalling && this.status === ExtensionState.Uninstalled) {
        this.initialStatus = this.status;
        return canRemoveExtension() ? localize("uninstalled", "Uninstalled") : null;
      }
    }
    if (currentEnablementState !== null) {
      const currentlyEnabled = this.extensionEnablementService.isEnabledEnablementState(currentEnablementState);
      const enabled = this.extensionEnablementService.isEnabledEnablementState(this.enablementState);
      if (!currentlyEnabled && enabled) {
        return canAddExtension() ? localize("enabled", "Enabled") : null;
      }
      if (currentlyEnabled && !enabled) {
        return canRemoveExtension() ? localize("disabled", "Disabled") : null;
      }
    }
    return null;
  }
  run() {
    return Promise.resolve();
  }
};
ExtensionStatusLabelAction = __decorateClass([
  __decorateParam(0, IExtensionService),
  __decorateParam(1, IExtensionManagementServerService),
  __decorateParam(2, IWorkbenchExtensionEnablementService)
], ExtensionStatusLabelAction);
let ToggleSyncExtensionAction = class extends DropDownExtensionAction {
  constructor(configurationService, extensionsWorkbenchService, userDataSyncEnablementService, instantiationService) {
    super("extensions.sync", "", ToggleSyncExtensionAction.SYNC_CLASS, false, instantiationService);
    this.configurationService = configurationService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.userDataSyncEnablementService = userDataSyncEnablementService;
    this._register(Event.filter(this.configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration("settingsSync.ignoredExtensions"))(() => this.update()));
    this._register(userDataSyncEnablementService.onDidChangeEnablement(() => this.update()));
    this.update();
  }
  static {
    this.IGNORED_SYNC_CLASS = `${ExtensionAction.ICON_ACTION_CLASS} extension-sync ${ThemeIcon.asClassName(syncIgnoredIcon)}`;
  }
  static {
    this.SYNC_CLASS = `${this.ICON_ACTION_CLASS} extension-sync ${ThemeIcon.asClassName(syncEnabledIcon)}`;
  }
  update() {
    this.enabled = !!this.extension && this.userDataSyncEnablementService.isEnabled() && this.extension.state === ExtensionState.Installed;
    if (this.extension) {
      const isIgnored = this.extensionsWorkbenchService.isExtensionIgnoredToSync(this.extension);
      this.class = isIgnored ? ToggleSyncExtensionAction.IGNORED_SYNC_CLASS : ToggleSyncExtensionAction.SYNC_CLASS;
      this.tooltip = isIgnored ? localize("ignored", "This extension is ignored during sync") : localize("synced", "This extension is synced");
    }
  }
  async run() {
    return super.run([
      [
        new Action(
          "extensions.syncignore",
          this.extensionsWorkbenchService.isExtensionIgnoredToSync(this.extension) ? localize("sync", "Sync this extension") : localize("do not sync", "Do not sync this extension"),
          void 0,
          true,
          () => this.extensionsWorkbenchService.toggleExtensionIgnoredToSync(this.extension)
        )
      ]
    ]);
  }
};
ToggleSyncExtensionAction = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IExtensionsWorkbenchService),
  __decorateParam(2, IUserDataSyncEnablementService),
  __decorateParam(3, IInstantiationService)
], ToggleSyncExtensionAction);
let ExtensionStatusAction = class extends ExtensionAction {
  constructor(extensionManagementServerService, labelService, commandService, workspaceTrustEnablementService, workspaceTrustService, extensionsWorkbenchService, extensionService, extensionManifestPropertiesService, contextService, productService, allowedExtensionsService, workbenchExtensionEnablementService, extensionFeaturesManagementService, extensionGalleryManifestService, configurationService) {
    super("extensions.status", "", `${ExtensionStatusAction.CLASS} hide`, false);
    this.extensionManagementServerService = extensionManagementServerService;
    this.labelService = labelService;
    this.commandService = commandService;
    this.workspaceTrustEnablementService = workspaceTrustEnablementService;
    this.workspaceTrustService = workspaceTrustService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.extensionService = extensionService;
    this.extensionManifestPropertiesService = extensionManifestPropertiesService;
    this.contextService = contextService;
    this.productService = productService;
    this.allowedExtensionsService = allowedExtensionsService;
    this.workbenchExtensionEnablementService = workbenchExtensionEnablementService;
    this.extensionFeaturesManagementService = extensionFeaturesManagementService;
    this.extensionGalleryManifestService = extensionGalleryManifestService;
    this.configurationService = configurationService;
    this.updateWhenCounterExtensionChanges = true;
    this._status = [];
    this._onDidChangeStatus = this._register(new Emitter());
    this.onDidChangeStatus = this._onDidChangeStatus.event;
    this.updateThrottler = this._register(new Throttler());
    this._register(this.labelService.onDidChangeFormatters(() => this.update(), this));
    this._register(this.extensionService.onDidChangeExtensions(() => this.update()));
    this._register(this.extensionFeaturesManagementService.onDidChangeAccessData(() => this.update()));
    this._register(allowedExtensionsService.onDidChangeAllowedExtensionsConfigValue(() => this.update()));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(AutoUpdateConfigurationKey)) {
        this.update();
      }
    }));
    this.update();
  }
  static {
    this.CLASS = `${ExtensionAction.ICON_ACTION_CLASS} extension-status`;
  }
  get status() {
    return this._status;
  }
  update() {
    this.recomputeStatus();
  }
  /**
   * Recomputes the status and returns a promise that resolves when the
   * computation is done. Use this when callers need to await time-sensitive
   * status content (e.g. the delayed auto-update message) before reading it.
   */
  recomputeStatus() {
    return this.updateThrottler.queue(() => this.computeAndUpdateStatus());
  }
  async computeAndUpdateStatus() {
    this.updateStatus(void 0, true);
    this.enabled = false;
    if (!this.extension) {
      return;
    }
    if (this.extension.isMalicious) {
      this.updateStatus({ icon: warningIcon, message: new MarkdownString(localize("malicious tooltip", "This extension was reported to be problematic.")) }, true);
      return;
    }
    if (this.extension.state === ExtensionState.Uninstalled && this.extension.gallery && !this.extension.gallery.isSigned && shouldRequireRepositorySignatureFor(this.extension.private, await this.extensionGalleryManifestService.getExtensionGalleryManifest())) {
      this.updateStatus({ icon: warningIcon, message: new MarkdownString(localize("not signed tooltip", "This extension is not signed by the Extension Marketplace.")) }, true);
      return;
    }
    if (this.extension.deprecationInfo) {
      if (this.extension.deprecationInfo.extension) {
        const link = `[${this.extension.deprecationInfo.extension.displayName}](${createCommandUri("extension.open", this.extension.deprecationInfo.extension.id)})`;
        this.updateStatus({ icon: warningIcon, message: new MarkdownString(localize("deprecated with alternate extension tooltip", "This extension is deprecated. Use the {0} extension instead.", link)) }, true);
      } else if (this.extension.deprecationInfo.settings) {
        const link = `[${localize("settings", "settings")}](${createCommandUri("workbench.action.openSettings", this.extension.deprecationInfo.settings.map((setting) => `@id:${setting}`).join(" "))}})`;
        this.updateStatus({ icon: warningIcon, message: new MarkdownString(localize("deprecated with alternate settings tooltip", "This extension is deprecated as this functionality is now built-in to VS Code. Configure these {0} to use this functionality.", link)) }, true);
      } else {
        const message = new MarkdownString(localize("deprecated tooltip", "This extension is deprecated as it is no longer being maintained."));
        if (this.extension.deprecationInfo.additionalInfo) {
          message.appendMarkdown(` ${this.extension.deprecationInfo.additionalInfo}`);
        }
        this.updateStatus({ icon: warningIcon, message }, true);
      }
      return;
    }
    if (this.extension.missingFromGallery) {
      this.updateStatus({ icon: warningIcon, message: new MarkdownString(localize("missing from gallery tooltip", "This extension is no longer available on the Extension Marketplace.")) }, true);
      return;
    }
    if (this.extensionsWorkbenchService.canSetLanguage(this.extension)) {
      return;
    }
    if (this.extension.outdated) {
      let hasConsentWarning = false;
      const message = await this.extensionsWorkbenchService.shouldRequireConsentToUpdate(this.extension);
      if (message) {
        hasConsentWarning = true;
        const markdown = new MarkdownString();
        markdown.appendMarkdown(`${message} `);
        markdown.appendMarkdown(
          localize(
            "auto update message",
            "Please [review the extension]({0}) and update it manually.",
            this.extension.hasChangelog() ? createCommandUri("extension.open", this.extension.identifier.id, ExtensionEditorTab.Changelog).toString() : this.extension.repository ? this.extension.repository : createCommandUri("extension.open", this.extension.identifier.id).toString()
          )
        );
        this.updateStatus({ icon: warningIcon, message: markdown }, true);
      }
      if (this.extensionsWorkbenchService.isAutoUpdateDelayed(this.extension)) {
        const delay = fromNow(Date.now() - this.extensionsWorkbenchService.getAutoUpdateDelay(), false, true);
        const updateAt = fromNow(Date.now() + this.extensionsWorkbenchService.getAutoUpdateDelayRemaining(this.extension), false, true);
        this.updateStatus({ icon: infoIcon, message: new MarkdownString(localize("autoUpdateDelayed", "This extension is not updated yet because new versions are auto updated {0} after they are published. It will be auto updated {1}.", delay, updateAt)) }, !hasConsentWarning);
      }
    }
    if (this.extension.gallery && this.extension.state === ExtensionState.Uninstalled) {
      const result = await this.extensionsWorkbenchService.canInstall(this.extension);
      if (result !== true) {
        this.updateStatus({ icon: warningIcon, message: result }, true);
        return;
      }
    }
    if (!this.extension.local || !this.extension.server || this.extension.state !== ExtensionState.Installed) {
      return;
    }
    if (this.extension.enablementState === EnablementState.DisabledByAllowlist) {
      const result = this.allowedExtensionsService.isAllowed(this.extension.local);
      if (result !== true) {
        this.updateStatus({ icon: warningIcon, message: new MarkdownString(localize("disabled - not allowed", "This extension is disabled because {0}", result.value)) }, true);
        return;
      }
    }
    if (this.extension.enablementState === EnablementState.DisabledByEnvironment) {
      this.updateStatus({ message: new MarkdownString(localize("disabled by environment", "This extension is disabled by the environment.")) }, true);
      return;
    }
    if (this.extension.enablementState === EnablementState.EnabledByEnvironment) {
      this.updateStatus({ message: new MarkdownString(localize("enabled by environment", "This extension is enabled because it is required in the current environment.")) }, true);
      return;
    }
    if (this.extension.enablementState === EnablementState.DisabledByVirtualWorkspace) {
      const details = getWorkspaceSupportTypeMessage(this.extension.local.manifest.capabilities?.virtualWorkspaces);
      this.updateStatus({ icon: infoIcon, message: new MarkdownString(details ? escapeMarkdownSyntaxTokens(details) : localize("disabled because of virtual workspace", "This extension has been disabled because it does not support virtual workspaces.")) }, true);
      return;
    }
    if (isVirtualWorkspace(this.contextService.getWorkspace())) {
      const virtualSupportType = this.extensionManifestPropertiesService.getExtensionVirtualWorkspaceSupportType(this.extension.local.manifest);
      const details = getWorkspaceSupportTypeMessage(this.extension.local.manifest.capabilities?.virtualWorkspaces);
      if (virtualSupportType === "limited" || details) {
        this.updateStatus({ icon: warningIcon, message: new MarkdownString(details ? escapeMarkdownSyntaxTokens(details) : localize("extension limited because of virtual workspace", "This extension has limited features because the current workspace is virtual.")) }, true);
        return;
      }
    }
    if (this.extension.enablementState === EnablementState.DisabledByUnification) {
      this.updateStatus({ icon: infoIcon, message: new MarkdownString(localize("extension disabled because of unification", "All GitHub Copilot functionality is now being served from the GitHub Copilot Chat extension. To temporarily opt out of this extension unification, toggle the {0} setting.", "`chat.extensionUnification.enabled`")) }, true);
      return;
    }
    if (!this.workspaceTrustService.isWorkspaceTrusted() && // Extension is disabled by untrusted workspace
    (this.extension.enablementState === EnablementState.DisabledByTrustRequirement || // All disabled dependencies of the extension are disabled by untrusted workspace
    this.extension.enablementState === EnablementState.DisabledByExtensionDependency && this.workbenchExtensionEnablementService.getDependenciesEnablementStates(this.extension.local).every(([, enablementState]) => this.workbenchExtensionEnablementService.isEnabledEnablementState(enablementState) || enablementState === EnablementState.DisabledByTrustRequirement))) {
      this.enabled = true;
      const untrustedDetails = getWorkspaceSupportTypeMessage(this.extension.local.manifest.capabilities?.untrustedWorkspaces);
      this.updateStatus({ icon: trustIcon, message: new MarkdownString(untrustedDetails ? escapeMarkdownSyntaxTokens(untrustedDetails) : localize("extension disabled because of trust requirement", "This extension has been disabled because the current workspace is not trusted.")) }, true);
      return;
    }
    if (this.workspaceTrustEnablementService.isWorkspaceTrustEnabled() && !this.workspaceTrustService.isWorkspaceTrusted()) {
      const untrustedSupportType = this.extensionManifestPropertiesService.getExtensionUntrustedWorkspaceSupportType(this.extension.local.manifest);
      const untrustedDetails = getWorkspaceSupportTypeMessage(this.extension.local.manifest.capabilities?.untrustedWorkspaces);
      if (untrustedSupportType === "limited" || untrustedDetails) {
        this.enabled = true;
        this.updateStatus({ icon: trustIcon, message: new MarkdownString(untrustedDetails ? escapeMarkdownSyntaxTokens(untrustedDetails) : localize("extension limited because of trust requirement", "This extension has limited features because the current workspace is not trusted.")) }, true);
        return;
      }
    }
    if (this.extension.enablementState === EnablementState.DisabledByExtensionKind) {
      if (!this.extensionsWorkbenchService.installed.some((e) => areSameExtensions(e.identifier, this.extension.identifier) && e.server !== this.extension.server)) {
        let message;
        if (this.extensionManagementServerService.localExtensionManagementServer === this.extension.server) {
          if (this.extensionManifestPropertiesService.prefersExecuteOnWorkspace(this.extension.local.manifest)) {
            if (this.extensionManagementServerService.remoteExtensionManagementServer) {
              message = new MarkdownString(`${localize("Install in remote server to enable", "This extension is disabled in this workspace because it is defined to run in the Remote Extension Host. Please install the extension in '{0}' to enable.", this.extensionManagementServerService.remoteExtensionManagementServer.label)} [${localize("learn more", "Learn More")}](https://code.visualstudio.com/api/advanced-topics/remote-extensions#architecture-and-extension-kinds)`);
            }
          }
        } else if (this.extensionManagementServerService.remoteExtensionManagementServer === this.extension.server) {
          if (this.extensionManifestPropertiesService.prefersExecuteOnUI(this.extension.local.manifest)) {
            if (this.extensionManagementServerService.localExtensionManagementServer) {
              message = new MarkdownString(`${localize("Install in local server to enable", "This extension is disabled in this workspace because it is defined to run in the Local Extension Host. Please install the extension locally to enable.", this.extensionManagementServerService.remoteExtensionManagementServer.label)} [${localize("learn more", "Learn More")}](https://code.visualstudio.com/api/advanced-topics/remote-extensions#architecture-and-extension-kinds)`);
            } else if (isWeb) {
              message = new MarkdownString(`${localize("Defined to run in desktop", "This extension is disabled because it is defined to run only in {0} for the Desktop.", this.productService.nameLong)} [${localize("learn more", "Learn More")}](https://code.visualstudio.com/api/advanced-topics/remote-extensions#architecture-and-extension-kinds)`);
            }
          }
        } else if (this.extensionManagementServerService.webExtensionManagementServer === this.extension.server) {
          message = new MarkdownString(`${localize("Cannot be enabled", "This extension is disabled because it is not supported in {0} for the Web.", this.productService.nameLong)} [${localize("learn more", "Learn More")}](https://code.visualstudio.com/api/advanced-topics/remote-extensions#architecture-and-extension-kinds)`);
        }
        if (message) {
          this.updateStatus({ icon: warningIcon, message }, true);
        }
        return;
      }
    }
    const extensionId = new ExtensionIdentifier(this.extension.identifier.id);
    const features = Registry.as(Extensions.ExtensionFeaturesRegistry).getExtensionFeatures();
    for (const feature of features) {
      const status = this.extensionFeaturesManagementService.getAccessData(extensionId, feature.id)?.current?.status;
      const manageAccessLink = `[${localize("manage access", "Manage Access")}](${createCommandUri("extension.open", this.extension.identifier.id, ExtensionEditorTab.Features, false, feature.id)})`;
      if (status?.severity === Severity.Error) {
        this.updateStatus({ icon: errorIcon, message: new MarkdownString().appendText(status.message).appendMarkdown(` ${manageAccessLink}`) }, true);
        return;
      }
      if (status?.severity === Severity.Warning) {
        this.updateStatus({ icon: warningIcon, message: new MarkdownString().appendText(status.message).appendMarkdown(` ${manageAccessLink}`) }, true);
        return;
      }
    }
    if (this.extensionManagementServerService.remoteExtensionManagementServer) {
      if (isLanguagePackExtension(this.extension.local.manifest)) {
        if (!this.extensionsWorkbenchService.installed.some((e) => areSameExtensions(e.identifier, this.extension.identifier) && e.server !== this.extension.server)) {
          const message = this.extension.server === this.extensionManagementServerService.localExtensionManagementServer ? new MarkdownString(localize("Install language pack also in remote server", "Install the language pack extension on '{0}' to enable it there also.", this.extensionManagementServerService.remoteExtensionManagementServer.label)) : new MarkdownString(localize("Install language pack also locally", "Install the language pack extension locally to enable it there also."));
          this.updateStatus({ icon: infoIcon, message }, true);
        }
        return;
      }
      const runningExtension = this.extensionService.extensions.filter((e) => areSameExtensions({ id: e.identifier.value, uuid: e.uuid }, this.extension.identifier))[0];
      const runningExtensionServer = runningExtension ? this.extensionManagementServerService.getExtensionManagementServer(toExtension(runningExtension)) : null;
      if (this.extension.server === this.extensionManagementServerService.localExtensionManagementServer && runningExtensionServer === this.extensionManagementServerService.remoteExtensionManagementServer) {
        if (this.extensionManifestPropertiesService.prefersExecuteOnWorkspace(this.extension.local.manifest)) {
          this.updateStatus({ icon: infoIcon, message: new MarkdownString(`${localize("enabled remotely", "This extension is enabled in the Remote Extension Host because it prefers to run there.")} [${localize("learn more", "Learn More")}](https://code.visualstudio.com/api/advanced-topics/remote-extensions#architecture-and-extension-kinds)`) }, true);
        }
        return;
      }
      if (this.extension.server === this.extensionManagementServerService.remoteExtensionManagementServer && runningExtensionServer === this.extensionManagementServerService.localExtensionManagementServer) {
        if (this.extensionManifestPropertiesService.prefersExecuteOnUI(this.extension.local.manifest)) {
          this.updateStatus({ icon: infoIcon, message: new MarkdownString(`${localize("enabled locally", "This extension is enabled in the Local Extension Host because it prefers to run there.")} [${localize("learn more", "Learn More")}](https://code.visualstudio.com/api/advanced-topics/remote-extensions#architecture-and-extension-kinds)`) }, true);
        }
        return;
      }
      if (this.extension.server === this.extensionManagementServerService.remoteExtensionManagementServer && runningExtensionServer === this.extensionManagementServerService.webExtensionManagementServer) {
        if (this.extensionManifestPropertiesService.canExecuteOnWeb(this.extension.local.manifest)) {
          this.updateStatus({ icon: infoIcon, message: new MarkdownString(`${localize("enabled in web worker", "This extension is enabled in the Web Worker Extension Host because it prefers to run there.")} [${localize("learn more", "Learn More")}](https://code.visualstudio.com/api/advanced-topics/remote-extensions#architecture-and-extension-kinds)`) }, true);
        }
        return;
      }
    }
    if (this.extension.enablementState === EnablementState.DisabledByExtensionDependency) {
      this.updateStatus({
        icon: warningIcon,
        message: new MarkdownString(localize("extension disabled because of dependency", "This extension depends on an extension that is disabled.")).appendMarkdown(`&nbsp;[${localize("dependencies", "Show Dependencies")}](${createCommandUri("extension.open", this.extension.identifier.id, ExtensionEditorTab.Dependencies)})`)
      }, true);
      return;
    }
    if (!this.extension.local.isValid) {
      const errors = this.extension.local.validations.filter(([severity]) => severity === Severity.Error).map(([, message]) => message);
      this.updateStatus({ icon: warningIcon, message: new MarkdownString(errors.join(" ").trim()) }, true);
      return;
    }
    const isEnabled = this.workbenchExtensionEnablementService.isEnabled(this.extension.local);
    const isRunning = this.extensionService.extensions.some((e) => areSameExtensions({ id: e.identifier.value, uuid: e.uuid }, this.extension.identifier));
    if (!this.extension.isWorkspaceScoped && isEnabled && isRunning) {
      if (this.extension.enablementState === EnablementState.EnabledWorkspace) {
        this.updateStatus({ message: new MarkdownString(localize("workspace enabled", "This extension is enabled for this workspace by the user.")) }, true);
        return;
      }
      if (this.extensionManagementServerService.localExtensionManagementServer && this.extensionManagementServerService.remoteExtensionManagementServer) {
        if (this.extension.server === this.extensionManagementServerService.remoteExtensionManagementServer) {
          this.updateStatus({ message: new MarkdownString(localize("extension enabled on remote", "Extension is enabled on '{0}'", this.extension.server.label)) }, true);
          return;
        }
      }
      if (this.extension.enablementState === EnablementState.EnabledGlobally) {
        return;
      }
    }
    if (!isEnabled && !isRunning) {
      if (this.extension.enablementState === EnablementState.DisabledGlobally) {
        this.updateStatus({ message: new MarkdownString(localize("globally disabled", "This extension is disabled globally by the user.")) }, true);
        return;
      }
      if (this.extension.enablementState === EnablementState.DisabledWorkspace) {
        this.updateStatus({ message: new MarkdownString(localize("workspace disabled", "This extension is disabled for this workspace by the user.")) }, true);
        return;
      }
    }
  }
  updateStatus(status, updateClass) {
    if (status) {
      if (this._status.some((s) => s.message.value === status.message.value && s.icon?.id === status.icon?.id)) {
        return;
      }
    } else {
      if (this._status.length === 0) {
        return;
      }
      this._status = [];
    }
    if (status) {
      this._status.push(status);
      this._status.sort(
        (a, b) => b.icon === trustIcon ? -1 : a.icon === trustIcon ? 1 : b.icon === errorIcon ? -1 : a.icon === errorIcon ? 1 : b.icon === warningIcon ? -1 : a.icon === warningIcon ? 1 : b.icon === infoIcon ? -1 : a.icon === infoIcon ? 1 : 0
      );
    }
    if (updateClass) {
      if (status?.icon === errorIcon) {
        this.class = `${ExtensionStatusAction.CLASS} extension-status-error ${ThemeIcon.asClassName(errorIcon)}`;
      } else if (status?.icon === warningIcon) {
        this.class = `${ExtensionStatusAction.CLASS} extension-status-warning ${ThemeIcon.asClassName(warningIcon)}`;
      } else if (status?.icon === infoIcon) {
        this.class = `${ExtensionStatusAction.CLASS} extension-status-info ${ThemeIcon.asClassName(infoIcon)}`;
      } else if (status?.icon === trustIcon) {
        this.class = `${ExtensionStatusAction.CLASS} ${ThemeIcon.asClassName(trustIcon)}`;
      } else {
        this.class = `${ExtensionStatusAction.CLASS} hide`;
      }
    }
    this._onDidChangeStatus.fire();
  }
  async run() {
    if (this._status[0]?.icon === trustIcon) {
      return this.commandService.executeCommand("workbench.trust.manage");
    }
  }
};
ExtensionStatusAction = __decorateClass([
  __decorateParam(0, IExtensionManagementServerService),
  __decorateParam(1, ILabelService),
  __decorateParam(2, ICommandService),
  __decorateParam(3, IWorkspaceTrustEnablementService),
  __decorateParam(4, IWorkspaceTrustManagementService),
  __decorateParam(5, IExtensionsWorkbenchService),
  __decorateParam(6, IExtensionService),
  __decorateParam(7, IExtensionManifestPropertiesService),
  __decorateParam(8, IWorkspaceContextService),
  __decorateParam(9, IProductService),
  __decorateParam(10, IAllowedExtensionsService),
  __decorateParam(11, IWorkbenchExtensionEnablementService),
  __decorateParam(12, IExtensionFeaturesManagementService),
  __decorateParam(13, IExtensionGalleryManifestService),
  __decorateParam(14, IConfigurationService)
], ExtensionStatusAction);
let InstallSpecificVersionOfExtensionAction = class extends Action {
  constructor(id = InstallSpecificVersionOfExtensionAction.ID, label = InstallSpecificVersionOfExtensionAction.LABEL, extensionsWorkbenchService, quickInputService, instantiationService, extensionEnablementService) {
    super(id, label);
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.quickInputService = quickInputService;
    this.instantiationService = instantiationService;
    this.extensionEnablementService = extensionEnablementService;
  }
  static {
    this.ID = "workbench.extensions.action.install.specificVersion";
  }
  static {
    this.LABEL = localize("install previous version", "Install Specific Version of Extension...");
  }
  get enabled() {
    return this.extensionsWorkbenchService.local.some((l) => this.isEnabled(l));
  }
  async run() {
    const extensionPick = await this.quickInputService.pick(this.getExtensionEntries(), { placeHolder: localize("selectExtension", "Select Extension"), matchOnDetail: true });
    if (extensionPick && extensionPick.extension) {
      const action = this.instantiationService.createInstance(InstallAnotherVersionAction, extensionPick.extension, true);
      try {
        await action.run();
      } finally {
        action.dispose();
      }
      await this.extensionsWorkbenchService.openSearch(extensionPick.extension.identifier.id);
    }
  }
  isEnabled(extension) {
    const action = this.instantiationService.createInstance(InstallAnotherVersionAction, extension, true);
    try {
      return action.enabled && !!extension.local && this.extensionEnablementService.isEnabled(extension.local);
    } finally {
      action.dispose();
    }
  }
  async getExtensionEntries() {
    const installed = await this.extensionsWorkbenchService.queryLocal();
    const entries = [];
    for (const extension of installed) {
      if (this.isEnabled(extension)) {
        entries.push({
          id: extension.identifier.id,
          label: extension.displayName || extension.identifier.id,
          description: extension.identifier.id,
          extension
        });
      }
    }
    return entries.sort((e1, e2) => e1.extension.displayName.localeCompare(e2.extension.displayName));
  }
};
InstallSpecificVersionOfExtensionAction = __decorateClass([
  __decorateParam(2, IExtensionsWorkbenchService),
  __decorateParam(3, IQuickInputService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IWorkbenchExtensionEnablementService)
], InstallSpecificVersionOfExtensionAction);
let AbstractInstallExtensionsInServerAction = class extends Action {
  constructor(id, extensionsWorkbenchService, quickInputService, notificationService, progressService) {
    super(id);
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.quickInputService = quickInputService;
    this.notificationService = notificationService;
    this.progressService = progressService;
    this.extensions = void 0;
    this.update();
    this.extensionsWorkbenchService.queryLocal().then(() => this.updateExtensions());
    this._register(this.extensionsWorkbenchService.onChange(() => {
      if (this.extensions) {
        this.updateExtensions();
      }
    }));
  }
  updateExtensions() {
    this.extensions = this.extensionsWorkbenchService.local;
    this.update();
  }
  update() {
    this.enabled = !!this.extensions && this.getExtensionsToInstall(this.extensions).length > 0;
    this.tooltip = this.label;
  }
  async run() {
    return this.selectAndInstallExtensions();
  }
  async queryExtensionsToInstall() {
    const local = await this.extensionsWorkbenchService.queryLocal();
    return this.getExtensionsToInstall(local);
  }
  async selectAndInstallExtensions() {
    const quickPick = this.quickInputService.createQuickPick();
    quickPick.busy = true;
    const disposable = quickPick.onDidAccept(() => {
      disposable.dispose();
      quickPick.hide();
      quickPick.dispose();
      this.onDidAccept(quickPick.selectedItems);
    });
    quickPick.show();
    const localExtensionsToInstall = await this.queryExtensionsToInstall();
    quickPick.busy = false;
    if (localExtensionsToInstall.length) {
      quickPick.title = this.getQuickPickTitle();
      quickPick.placeholder = localize("select extensions to install", "Select extensions to install");
      quickPick.canSelectMany = true;
      localExtensionsToInstall.sort((e1, e2) => e1.displayName.localeCompare(e2.displayName));
      quickPick.items = localExtensionsToInstall.map((extension) => ({ extension, label: extension.displayName, description: extension.version }));
    } else {
      quickPick.hide();
      quickPick.dispose();
      this.notificationService.notify({
        severity: Severity.Info,
        message: localize("no local extensions", "There are no extensions to install.")
      });
    }
  }
  async onDidAccept(selectedItems) {
    if (selectedItems.length) {
      const localExtensionsToInstall = selectedItems.filter((r) => !!r.extension).map((r) => r.extension);
      if (localExtensionsToInstall.length) {
        await this.progressService.withProgress(
          {
            location: ProgressLocation.Notification,
            title: localize("installing extensions", "Installing Extensions...")
          },
          () => this.installExtensions(localExtensionsToInstall)
        );
        this.notificationService.info(localize("finished installing", "Successfully installed extensions."));
      }
    }
  }
};
AbstractInstallExtensionsInServerAction = __decorateClass([
  __decorateParam(1, IExtensionsWorkbenchService),
  __decorateParam(2, IQuickInputService),
  __decorateParam(3, INotificationService),
  __decorateParam(4, IProgressService)
], AbstractInstallExtensionsInServerAction);
let InstallLocalExtensionsInRemoteAction = class extends AbstractInstallExtensionsInServerAction {
  constructor(extensionsWorkbenchService, quickInputService, progressService, notificationService, extensionManagementServerService, extensionGalleryService, instantiationService, fileService, logService) {
    super("workbench.extensions.actions.installLocalExtensionsInRemote", extensionsWorkbenchService, quickInputService, notificationService, progressService);
    this.extensionManagementServerService = extensionManagementServerService;
    this.extensionGalleryService = extensionGalleryService;
    this.instantiationService = instantiationService;
    this.fileService = fileService;
    this.logService = logService;
  }
  get label() {
    if (this.extensionManagementServerService && this.extensionManagementServerService.remoteExtensionManagementServer) {
      return localize("select and install local extensions", "Install Local Extensions in '{0}'...", this.extensionManagementServerService.remoteExtensionManagementServer.label);
    }
    return "";
  }
  getQuickPickTitle() {
    return localize("install local extensions title", "Install Local Extensions in '{0}'", this.extensionManagementServerService.remoteExtensionManagementServer.label);
  }
  getExtensionsToInstall(local) {
    return local.filter((extension) => {
      const action = this.instantiationService.createInstance(RemoteInstallAction, true);
      action.extension = extension;
      return action.enabled;
    });
  }
  async installExtensions(localExtensionsToInstall) {
    const galleryExtensions = [];
    const vsixs = [];
    const targetPlatform = await this.extensionManagementServerService.remoteExtensionManagementServer.extensionManagementService.getTargetPlatform();
    await Promises.settled(localExtensionsToInstall.map(async (extension) => {
      if (this.extensionGalleryService.isEnabled()) {
        const gallery = (await this.extensionGalleryService.getExtensions([{ ...extension.identifier, preRelease: !!extension.local?.preRelease }], { targetPlatform, compatible: true }, CancellationToken.None))[0];
        if (gallery) {
          galleryExtensions.push(gallery);
          return;
        }
      }
      const vsix = await this.extensionManagementServerService.localExtensionManagementServer.extensionManagementService.zip(extension.local);
      vsixs.push(vsix);
    }));
    await Promises.settled(galleryExtensions.map((gallery) => this.extensionManagementServerService.remoteExtensionManagementServer.extensionManagementService.installFromGallery(gallery)));
    try {
      await Promises.settled(vsixs.map((vsix) => this.extensionManagementServerService.remoteExtensionManagementServer.extensionManagementService.install(vsix)));
    } finally {
      try {
        await Promise.allSettled(vsixs.map((vsix) => this.fileService.del(vsix)));
      } catch (error) {
        this.logService.error(error);
      }
    }
  }
};
InstallLocalExtensionsInRemoteAction = __decorateClass([
  __decorateParam(0, IExtensionsWorkbenchService),
  __decorateParam(1, IQuickInputService),
  __decorateParam(2, IProgressService),
  __decorateParam(3, INotificationService),
  __decorateParam(4, IExtensionManagementServerService),
  __decorateParam(5, IExtensionGalleryService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IFileService),
  __decorateParam(8, ILogService)
], InstallLocalExtensionsInRemoteAction);
let InstallRemoteExtensionsInLocalAction = class extends AbstractInstallExtensionsInServerAction {
  constructor(id, extensionsWorkbenchService, quickInputService, progressService, notificationService, extensionManagementServerService, extensionGalleryService, fileService, logService) {
    super(id, extensionsWorkbenchService, quickInputService, notificationService, progressService);
    this.extensionManagementServerService = extensionManagementServerService;
    this.extensionGalleryService = extensionGalleryService;
    this.fileService = fileService;
    this.logService = logService;
  }
  get label() {
    return localize("select and install remote extensions", "Install Remote Extensions Locally...");
  }
  getQuickPickTitle() {
    return localize("install remote extensions", "Install Remote Extensions Locally");
  }
  getExtensionsToInstall(local) {
    return local.filter((extension) => extension.type === ExtensionType.User && extension.server !== this.extensionManagementServerService.localExtensionManagementServer && !this.extensionsWorkbenchService.installed.some((e) => e.server === this.extensionManagementServerService.localExtensionManagementServer && areSameExtensions(e.identifier, extension.identifier)));
  }
  async installExtensions(extensions) {
    const galleryExtensions = [];
    const vsixs = [];
    const targetPlatform = await this.extensionManagementServerService.localExtensionManagementServer.extensionManagementService.getTargetPlatform();
    await Promises.settled(extensions.map(async (extension) => {
      if (this.extensionGalleryService.isEnabled()) {
        const gallery = (await this.extensionGalleryService.getExtensions([{ ...extension.identifier, preRelease: !!extension.local?.preRelease }], { targetPlatform, compatible: true }, CancellationToken.None))[0];
        if (gallery) {
          galleryExtensions.push(gallery);
          return;
        }
      }
      const vsix = await this.extensionManagementServerService.remoteExtensionManagementServer.extensionManagementService.zip(extension.local);
      vsixs.push(vsix);
    }));
    await Promises.settled(galleryExtensions.map((gallery) => this.extensionManagementServerService.localExtensionManagementServer.extensionManagementService.installFromGallery(gallery)));
    try {
      await Promises.settled(vsixs.map((vsix) => this.extensionManagementServerService.localExtensionManagementServer.extensionManagementService.install(vsix)));
    } finally {
      try {
        await Promise.allSettled(vsixs.map((vsix) => this.fileService.del(vsix)));
      } catch (error) {
        this.logService.error(error);
      }
    }
  }
};
InstallRemoteExtensionsInLocalAction = __decorateClass([
  __decorateParam(1, IExtensionsWorkbenchService),
  __decorateParam(2, IQuickInputService),
  __decorateParam(3, IProgressService),
  __decorateParam(4, INotificationService),
  __decorateParam(5, IExtensionManagementServerService),
  __decorateParam(6, IExtensionGalleryService),
  __decorateParam(7, IFileService),
  __decorateParam(8, ILogService)
], InstallRemoteExtensionsInLocalAction);
CommandsRegistry.registerCommand("workbench.extensions.action.showExtensionsForLanguage", function(accessor, fileExtension) {
  const extensionsWorkbenchService = accessor.get(IExtensionsWorkbenchService);
  return extensionsWorkbenchService.openSearch(`ext:${fileExtension.replace(/^\./, "")}`);
});
const showExtensionsWithIdsCommandId = "workbench.extensions.action.showExtensionsWithIds";
CommandsRegistry.registerCommand(showExtensionsWithIdsCommandId, function(accessor, extensionIds) {
  const extensionsWorkbenchService = accessor.get(IExtensionsWorkbenchService);
  return extensionsWorkbenchService.openSearch(extensionIds.map((id) => `@id:${id}`).join(" "));
});
registerColor("extensionButton.background", {
  dark: buttonSecondaryBackground,
  light: buttonSecondaryBackground,
  hcDark: null,
  hcLight: null
}, localize("extensionButtonBackground", "Button background color for extension actions."));
registerColor("extensionButton.foreground", {
  dark: buttonSecondaryForeground,
  light: buttonSecondaryForeground,
  hcDark: null,
  hcLight: null
}, localize("extensionButtonForeground", "Button foreground color for extension actions."));
registerColor("extensionButton.hoverBackground", {
  dark: buttonSecondaryHoverBackground,
  light: buttonSecondaryHoverBackground,
  hcDark: null,
  hcLight: null
}, localize("extensionButtonHoverBackground", "Button background hover color for extension actions."));
registerColor("extensionButton.border", {
  dark: buttonSecondaryBorder,
  light: buttonSecondaryBorder,
  hcDark: buttonSecondaryBorder,
  hcLight: buttonSecondaryBorder
}, localize("extensionButtonBorder", "Button border color for extension actions."));
registerColor("extensionButton.separator", buttonSeparator, localize("extensionButtonSeparator", "Button separator color for extension actions"));
const extensionButtonProminentBackground = registerColor("extensionButton.prominentBackground", {
  dark: buttonBackground,
  light: buttonBackground,
  hcDark: null,
  hcLight: null
}, localize("extensionButtonProminentBackground", "Button background color for extension actions that stand out (e.g. install button)."));
registerColor("extensionButton.prominentForeground", {
  dark: buttonForeground,
  light: buttonForeground,
  hcDark: null,
  hcLight: null
}, localize("extensionButtonProminentForeground", "Button foreground color for extension actions that stand out (e.g. install button)."));
registerColor("extensionButton.prominentHoverBackground", {
  dark: buttonHoverBackground,
  light: buttonHoverBackground,
  hcDark: null,
  hcLight: null
}, localize("extensionButtonProminentHoverBackground", "Button background hover color for extension actions that stand out (e.g. install button)."));
registerThemingParticipant((theme, collector) => {
  const errorColor = theme.getColor(editorErrorForeground);
  if (errorColor) {
    collector.addRule(`.extension-editor .header .actions-status-container > .status ${ThemeIcon.asCSSSelector(errorIcon)} { color: ${errorColor}; }`);
    collector.addRule(`.extension-editor .body .subcontent .runtime-status ${ThemeIcon.asCSSSelector(errorIcon)} { color: ${errorColor}; }`);
    collector.addRule(`.monaco-hover.extension-hover .markdown-hover .hover-contents ${ThemeIcon.asCSSSelector(errorIcon)} { color: ${errorColor}; }`);
  }
  const warningColor = theme.getColor(editorWarningForeground);
  if (warningColor) {
    collector.addRule(`.extension-editor .header .actions-status-container > .status ${ThemeIcon.asCSSSelector(warningIcon)} { color: ${warningColor}; }`);
    collector.addRule(`.extension-editor .body .subcontent .runtime-status ${ThemeIcon.asCSSSelector(warningIcon)} { color: ${warningColor}; }`);
    collector.addRule(`.monaco-hover.extension-hover .markdown-hover .hover-contents ${ThemeIcon.asCSSSelector(warningIcon)} { color: ${warningColor}; }`);
  }
  const infoColor = theme.getColor(editorInfoForeground);
  if (infoColor) {
    collector.addRule(`.extension-editor .header .actions-status-container > .status ${ThemeIcon.asCSSSelector(infoIcon)} { color: ${infoColor}; }`);
    collector.addRule(`.extension-editor .body .subcontent .runtime-status ${ThemeIcon.asCSSSelector(infoIcon)} { color: ${infoColor}; }`);
    collector.addRule(`.monaco-hover.extension-hover .markdown-hover .hover-contents ${ThemeIcon.asCSSSelector(infoIcon)} { color: ${infoColor}; }`);
  }
});
export {
  AbstractConfigureRecommendedExtensionsAction,
  AbstractInstallExtensionsInServerAction,
  ButtonWithDropDownExtensionAction,
  ButtonWithDropdownExtensionActionViewItem,
  ClearLanguageAction,
  ConfigureWorkspaceFolderRecommendedExtensionsAction,
  ConfigureWorkspaceRecommendedExtensionsAction,
  DisableDropDownAction,
  DisableForWorkspaceAction,
  DisableGloballyAction,
  DropDownExtensionAction,
  DropDownExtensionActionViewItem,
  EnableAIFeaturesInWorkspaceAction,
  EnableDropDownAction,
  EnableForWorkspaceAction,
  EnableGloballyAction,
  ExtensionAction,
  ExtensionEditorManageExtensionAction,
  ExtensionRuntimeStateAction,
  ExtensionStatusAction,
  ExtensionStatusLabelAction,
  IgnoreExtensionRecommendationAction,
  InstallAction,
  InstallAnotherVersionAction,
  InstallDropdownAction,
  InstallInOtherServerAction,
  InstallLocalExtensionsInRemoteAction,
  InstallRecommendedExtensionAction,
  InstallRemoteExtensionsInLocalAction,
  InstallSpecificVersionOfExtensionAction,
  InstallingLabelAction,
  LocalInstallAction,
  ManageExtensionAction,
  MenuItemExtensionAction,
  MigrateDeprecatedExtensionAction,
  PromptExtensionInstallFailureAction,
  RemoteInstallAction,
  SetColorThemeAction,
  SetFileIconThemeAction,
  SetLanguageAction,
  SetProductIconThemeAction,
  ShowRecommendedExtensionAction,
  ToggleAutoUpdateForExtensionAction,
  ToggleAutoUpdatesForPublisherAction,
  TogglePreReleaseExtensionAction,
  ToggleSyncExtensionAction,
  UndoIgnoreExtensionRecommendationAction,
  UninstallAction,
  UpdateAction,
  WebInstallAction,
  extensionButtonProminentBackground,
  getContextMenuActions,
  showExtensionsWithIdsCommandId
};
