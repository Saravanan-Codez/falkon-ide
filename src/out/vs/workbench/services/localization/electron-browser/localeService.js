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
import { Language, LANGUAGE_DEFAULT } from "../../../../base/common/platform.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IJSONEditingService } from "../../configuration/common/jsonEditing.js";
import { IActiveLanguagePackService, ILocaleService } from "../common/locale.js";
import { ILanguagePackService } from "../../../../platform/languagePacks/common/languagePacks.js";
import { IPaneCompositePartService } from "../../panecomposite/browser/panecomposite.js";
import { ViewContainerLocation } from "../../../common/views.js";
import { IExtensionManagementService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { localize } from "../../../../nls.js";
import { toAction } from "../../../../base/common/actions.js";
import { ITextFileService } from "../../textfile/common/textfiles.js";
import { parse } from "../../../../base/common/jsonc.js";
import { IEditorService } from "../../editor/common/editorService.js";
import { IHostService } from "../../host/browser/host.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
const EXTENSIONS_VIEWLET_ID = "workbench.view.extensions";
let NativeLocaleService = class {
  constructor(jsonEditingService, environmentService, notificationService, languagePackService, paneCompositePartService, extensionManagementService, progressService, textFileService, editorService, dialogService, hostService, productService) {
    this.jsonEditingService = jsonEditingService;
    this.environmentService = environmentService;
    this.notificationService = notificationService;
    this.languagePackService = languagePackService;
    this.paneCompositePartService = paneCompositePartService;
    this.extensionManagementService = extensionManagementService;
    this.progressService = progressService;
    this.textFileService = textFileService;
    this.editorService = editorService;
    this.dialogService = dialogService;
    this.hostService = hostService;
    this.productService = productService;
  }
  async validateLocaleFile() {
    try {
      const content = await this.textFileService.read(this.environmentService.argvResource, { encoding: "utf8" });
      parse(content.value);
    } catch (error) {
      this.notificationService.notify({
        severity: Severity.Error,
        message: localize("argvInvalid", "Unable to write display language. Please open the runtime settings, correct errors/warnings in it and try again."),
        actions: {
          primary: [
            toAction({
              id: "openArgv",
              label: localize("openArgv", "Open Runtime Settings"),
              run: () => this.editorService.openEditor({ resource: this.environmentService.argvResource })
            })
          ]
        }
      });
      return false;
    }
    return true;
  }
  async writeLocaleValue(locale) {
    if (!await this.validateLocaleFile()) {
      return false;
    }
    await this.jsonEditingService.write(this.environmentService.argvResource, [{ path: ["locale"], value: locale }], true);
    return true;
  }
  async setLocale(languagePackItem, skipDialog = false) {
    const locale = languagePackItem.id;
    if (locale === Language.value() || !locale && Language.isDefaultVariant()) {
      return;
    }
    const installedLanguages = await this.languagePackService.getInstalledLanguages();
    try {
      if (!installedLanguages.some((installedLanguage) => installedLanguage.id === languagePackItem.id)) {
        if (languagePackItem.galleryExtension?.publisher.toLowerCase() !== "ms-ceintl") {
          const viewlet = await this.paneCompositePartService.openPaneComposite(EXTENSIONS_VIEWLET_ID, ViewContainerLocation.Sidebar);
          (viewlet?.getViewPaneContainer()).search(`@id:${languagePackItem.extensionId}`);
          return;
        }
        await this.progressService.withProgress(
          {
            location: ProgressLocation.Notification,
            title: localize("installing", "Installing {0} language support...", languagePackItem.label)
          },
          (progress) => this.extensionManagementService.installFromGallery(languagePackItem.galleryExtension, {
            // Setting this to false is how you get the extension to be synced with Settings Sync (if enabled).
            isMachineScoped: false
          })
        );
      }
      if (!skipDialog && !await this.showRestartDialog(languagePackItem.label)) {
        return;
      }
      await this.writeLocaleValue(locale);
      await this.hostService.restart();
    } catch (err) {
      this.notificationService.error(err);
    }
  }
  async clearLocalePreference() {
    try {
      await this.writeLocaleValue(void 0);
      if (!Language.isDefaultVariant()) {
        await this.showRestartDialog("English");
      }
    } catch (err) {
      this.notificationService.error(err);
    }
  }
  async showRestartDialog(languageName) {
    const { confirmed } = await this.dialogService.confirm({
      message: localize("restartDisplayLanguageMessage1", "Restart {0} to switch to {1}?", this.productService.nameLong, languageName),
      detail: localize(
        "restartDisplayLanguageDetail1",
        "To change the display language to {0}, {1} needs to restart.",
        languageName,
        this.productService.nameLong
      ),
      primaryButton: localize({ key: "restart", comment: ["&& denotes a mnemonic character"] }, "&&Restart")
    });
    return confirmed;
  }
};
NativeLocaleService = __decorateClass([
  __decorateParam(0, IJSONEditingService),
  __decorateParam(1, IEnvironmentService),
  __decorateParam(2, INotificationService),
  __decorateParam(3, ILanguagePackService),
  __decorateParam(4, IPaneCompositePartService),
  __decorateParam(5, IExtensionManagementService),
  __decorateParam(6, IProgressService),
  __decorateParam(7, ITextFileService),
  __decorateParam(8, IEditorService),
  __decorateParam(9, IDialogService),
  __decorateParam(10, IHostService),
  __decorateParam(11, IProductService)
], NativeLocaleService);
let NativeActiveLanguagePackService = class {
  constructor(languagePackService) {
    this.languagePackService = languagePackService;
  }
  async getExtensionIdProvidingCurrentLocale() {
    const language = Language.value();
    if (language === LANGUAGE_DEFAULT) {
      return void 0;
    }
    const languages = await this.languagePackService.getInstalledLanguages();
    const languagePack = languages.find((l) => l.id === language);
    return languagePack?.extensionId;
  }
};
NativeActiveLanguagePackService = __decorateClass([
  __decorateParam(0, ILanguagePackService)
], NativeActiveLanguagePackService);
registerSingleton(ILocaleService, NativeLocaleService, InstantiationType.Delayed);
registerSingleton(IActiveLanguagePackService, NativeActiveLanguagePackService, InstantiationType.Delayed);
