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
import * as types from "../../../../base/common/types.js";
import { IExtensionService } from "../../extensions/common/extensions.js";
import { IWorkbenchThemeService, ExtensionData, ThemeSettings, ThemeSettingDefaults, COLOR_THEME_DARK_INITIAL_COLORS, COLOR_THEME_LIGHT_INITIAL_COLORS, migrateThemeSettingsId } from "../common/workbenchThemeService.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import * as errors from "../../../../base/common/errors.js";
import { IConfigurationService, ConfigurationTarget } from "../../../../platform/configuration/common/configuration.js";
import { ColorThemeData } from "../common/colorThemeData.js";
import { Extensions as ThemingExtensions } from "../../../../platform/theme/common/themeService.js";
import { Emitter } from "../../../../base/common/event.js";
import { registerFileIconThemeSchemas } from "../common/fileIconThemeSchema.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { FileIconThemeData, FileIconThemeLoader } from "./fileIconThemeData.js";
import { createStyleSheet } from "../../../../base/browser/domStylesheets.js";
import { IBrowserWorkbenchEnvironmentService } from "../../environment/browser/environmentService.js";
import { IFileService, FileChangeType } from "../../../../platform/files/common/files.js";
import * as resources from "../../../../base/common/resources.js";
import { registerColorThemeSchemas } from "../common/colorThemeSchema.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { getRemoteAuthority } from "../../../../platform/remote/common/remoteHosts.js";
import { IWorkbenchLayoutService } from "../../layout/browser/layoutService.js";
import { IExtensionResourceLoaderService } from "../../../../platform/extensionResourceLoader/common/extensionResourceLoader.js";
import { ThemeRegistry, registerColorThemeExtensionPoint, registerFileIconThemeExtensionPoint, registerProductIconThemeExtensionPoint } from "../common/themeExtensionPoints.js";
import { updateColorThemeConfigurationSchemas, updateFileIconThemeConfigurationSchemas, ThemeConfiguration, updateProductIconThemeConfigurationSchemas } from "../common/themeConfiguration.js";
import { ProductIconThemeData, DEFAULT_PRODUCT_ICON_THEME_ID } from "./productIconThemeData.js";
import { registerProductIconThemeSchemas } from "../common/productIconThemeSchema.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { isWeb } from "../../../../base/common/platform.js";
import { ColorScheme, ThemeTypeSelector } from "../../../../platform/theme/common/theme.js";
import { IHostColorSchemeService } from "../common/hostColorSchemeService.js";
import { RunOnceScheduler, Sequencer } from "../../../../base/common/async.js";
import { IUserDataInitializationService } from "../../userData/browser/userDataInit.js";
import { getIconsStyleSheet } from "../../../../platform/theme/browser/iconsStyleSheet.js";
import { getColorRegistry } from "../../../../platform/theme/common/colorRegistry.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { generateColorThemeCSS } from "./colorThemeCss.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IHostService } from "../../host/browser/host.js";
import { toAction } from "../../../../base/common/actions.js";
const defaultThemeExtensionId = "vscode-theme-defaults";
const DEFAULT_FILE_ICON_THEME_ID = "vscode.vscode-theme-seti-vs-seti";
const fileIconsEnabledClass = "file-icons-enabled";
const colorThemeRulesClassName = "contributedColorTheme";
const fileIconThemeRulesClassName = "contributedFileIconTheme";
const productIconThemeRulesClassName = "contributedProductIconTheme";
const themingRegistry = Registry.as(ThemingExtensions.ThemingContribution);
function validateThemeId(theme) {
  switch (theme) {
    case ThemeTypeSelector.VS:
      return `vs ${defaultThemeExtensionId}-themes-light_vs-json`;
    case ThemeTypeSelector.VS_DARK:
      return `vs-dark ${defaultThemeExtensionId}-themes-dark_vs-json`;
    case ThemeTypeSelector.HC_BLACK:
      return `hc-black ${defaultThemeExtensionId}-themes-hc_black-json`;
    case ThemeTypeSelector.HC_LIGHT:
      return `hc-light ${defaultThemeExtensionId}-themes-hc_light-json`;
  }
  return theme;
}
const colorThemesExtPoint = registerColorThemeExtensionPoint();
const fileIconThemesExtPoint = registerFileIconThemeExtensionPoint();
const productIconThemesExtPoint = registerProductIconThemeExtensionPoint();
let WorkbenchThemeService = class extends Disposable {
  constructor(extensionService, storageService, configurationService, telemetryService, environmentService, fileService, extensionResourceLoaderService, layoutService, logService, hostColorService, userDataInitializationService, languageService, notificationService, hostService) {
    super();
    this.storageService = storageService;
    this.configurationService = configurationService;
    this.telemetryService = telemetryService;
    this.environmentService = environmentService;
    this.extensionResourceLoaderService = extensionResourceLoaderService;
    this.logService = logService;
    this.hostColorService = hostColorService;
    this.userDataInitializationService = userDataInitializationService;
    this.languageService = languageService;
    this.notificationService = notificationService;
    this.hostService = hostService;
    this.themeExtensionsActivated = /* @__PURE__ */ new Map();
    this.container = layoutService.mainContainer;
    this.settings = new ThemeConfiguration(configurationService, hostColorService);
    this.colorThemeRegistry = this._register(new ThemeRegistry(colorThemesExtPoint, ColorThemeData.fromExtensionTheme));
    this.colorThemeWatcher = this._register(new ThemeFileWatcher(fileService, environmentService, this.reloadCurrentColorTheme.bind(this)));
    this.onColorThemeChange = this._register(new Emitter({ leakWarningThreshold: 400, leakWarningName: "ThemeService.onColorThemeChange" }));
    this.currentColorTheme = ColorThemeData.createUnloadedTheme("");
    this.colorThemeSequencer = new Sequencer();
    this.fileIconThemeWatcher = this._register(new ThemeFileWatcher(fileService, environmentService, this.reloadCurrentFileIconTheme.bind(this)));
    this.fileIconThemeRegistry = this._register(new ThemeRegistry(fileIconThemesExtPoint, FileIconThemeData.fromExtensionTheme, true, FileIconThemeData.noIconTheme));
    this.fileIconThemeLoader = new FileIconThemeLoader(extensionResourceLoaderService, languageService);
    this.onFileIconThemeChange = this._register(new Emitter({ leakWarningThreshold: 400, leakWarningName: "ThemeService.onFileIconThemeChange" }));
    this.currentFileIconTheme = FileIconThemeData.createUnloadedTheme("");
    this.fileIconThemeSequencer = new Sequencer();
    this.productIconThemeWatcher = this._register(new ThemeFileWatcher(fileService, environmentService, this.reloadCurrentProductIconTheme.bind(this)));
    this.productIconThemeRegistry = this._register(new ThemeRegistry(productIconThemesExtPoint, ProductIconThemeData.fromExtensionTheme, true, ProductIconThemeData.defaultTheme));
    this.onProductIconThemeChange = this._register(new Emitter());
    this.currentProductIconTheme = ProductIconThemeData.createUnloadedTheme("");
    this.productIconThemeSequencer = new Sequencer();
    this._register(this.onDidColorThemeChange((theme) => getColorRegistry().notifyThemeUpdate(theme)));
    let themeData = ColorThemeData.fromStorageData(this.storageService);
    const previousColorThemeSetting = themeData?.settingsId;
    const colorThemeSetting = this.settings.colorTheme;
    if (themeData && colorThemeSetting !== themeData.settingsId) {
      themeData = void 0;
    }
    const defaultColorMap = colorThemeSetting === ThemeSettingDefaults.COLOR_THEME_LIGHT ? COLOR_THEME_LIGHT_INITIAL_COLORS : colorThemeSetting === ThemeSettingDefaults.COLOR_THEME_DARK ? COLOR_THEME_DARK_INITIAL_COLORS : void 0;
    if (!themeData) {
      const initialColorTheme = environmentService.options?.initialColorTheme;
      if (initialColorTheme) {
        themeData = ColorThemeData.createUnloadedThemeForThemeType(initialColorTheme.themeType, initialColorTheme.colors ?? defaultColorMap);
      }
    }
    if (!themeData) {
      const colorScheme = this.settings.getPreferredColorScheme() ?? (isWeb ? ColorScheme.LIGHT : ColorScheme.DARK);
      themeData = ColorThemeData.createUnloadedThemeForThemeType(colorScheme, defaultColorMap);
    }
    themeData.setCustomizations(this.settings);
    this.applyTheme(themeData, void 0, true);
    const fileIconData = FileIconThemeData.fromStorageData(this.storageService);
    if (fileIconData) {
      this.applyAndSetFileIconTheme(fileIconData, true);
    }
    const productIconData = ProductIconThemeData.fromStorageData(this.storageService);
    if (productIconData) {
      this.applyAndSetProductIconTheme(productIconData, true);
    }
    extensionService.whenInstalledExtensionsRegistered().then((_) => {
      this.installConfigurationListener();
      this.installPreferredSchemeListener();
      this.installRegistryListeners();
      this.initialize(previousColorThemeSetting).catch(errors.onUnexpectedError);
    });
    const codiconStyleSheet = createStyleSheet();
    codiconStyleSheet.id = "codiconStyles";
    const iconsStyleSheet = this._register(getIconsStyleSheet(this));
    function updateAll() {
      codiconStyleSheet.textContent = iconsStyleSheet.getCSS();
    }
    const delayer = this._register(new RunOnceScheduler(updateAll, 0));
    this._register(iconsStyleSheet.onDidChange(() => delayer.schedule()));
    delayer.schedule();
  }
  async initialize(themePreviousSettingsId) {
    const extDevLocs = this.environmentService.extensionDevelopmentLocationURI;
    const extDevLoc = extDevLocs && extDevLocs.length === 1 ? extDevLocs[0] : void 0;
    const initializeColorTheme = async () => {
      const devThemes = this.colorThemeRegistry.findThemeByExtensionLocation(extDevLoc);
      if (devThemes.length) {
        const matchedColorTheme = devThemes.find((theme2) => theme2.type === this.currentColorTheme.type);
        return this.setColorTheme(matchedColorTheme ? matchedColorTheme.id : devThemes[0].id, void 0);
      }
      let theme = this.colorThemeRegistry.findThemeBySettingsId(this.settings.colorTheme, void 0);
      if (!theme) {
        await this.userDataInitializationService.whenInitializationFinished();
        const fallbackTheme = this.currentColorTheme.type === ColorScheme.LIGHT ? ThemeSettingDefaults.COLOR_THEME_LIGHT : ThemeSettingDefaults.COLOR_THEME_DARK;
        theme = this.colorThemeRegistry.findThemeBySettingsId(this.settings.colorTheme, fallbackTheme);
      }
      return this.setColorTheme(theme && theme.id, void 0);
    };
    const initializeFileIconTheme = async () => {
      const devThemes = this.fileIconThemeRegistry.findThemeByExtensionLocation(extDevLoc);
      if (devThemes.length) {
        return this.setFileIconTheme(devThemes[0].id, ConfigurationTarget.MEMORY);
      }
      let theme = this.fileIconThemeRegistry.findThemeBySettingsId(this.settings.fileIconTheme);
      if (!theme) {
        await this.userDataInitializationService.whenInitializationFinished();
        theme = this.fileIconThemeRegistry.findThemeBySettingsId(this.settings.fileIconTheme);
      }
      return this.setFileIconTheme(theme ? theme.id : DEFAULT_FILE_ICON_THEME_ID, void 0);
    };
    const initializeProductIconTheme = async () => {
      const devThemes = this.productIconThemeRegistry.findThemeByExtensionLocation(extDevLoc);
      if (devThemes.length) {
        return this.setProductIconTheme(devThemes[0].id, ConfigurationTarget.MEMORY);
      }
      let theme = this.productIconThemeRegistry.findThemeBySettingsId(this.settings.productIconTheme);
      if (!theme) {
        await this.userDataInitializationService.whenInitializationFinished();
        theme = this.productIconThemeRegistry.findThemeBySettingsId(this.settings.productIconTheme);
      }
      return this.setProductIconTheme(theme ? theme.id : DEFAULT_PRODUCT_ICON_THEME_ID, void 0);
    };
    this.migrateColorThemeSettings();
    const result = await Promise.all([initializeColorTheme(), initializeFileIconTheme(), initializeProductIconTheme()]);
    await this.showNewDefaultThemeNotification(themePreviousSettingsId);
    return result;
  }
  static {
    this.NEW_THEME_NOTIFICATION_KEY = "workbench.newDefaultThemeNotification";
  }
  async showNewDefaultThemeNotification(previousSettingsId) {
    if (this.storageService.getBoolean(WorkbenchThemeService.NEW_THEME_NOTIFICATION_KEY, StorageScope.APPLICATION)) {
      return;
    }
    if (!await this.hostService.hadLastFocus() || this.environmentService.isSessionsWindow) {
      return;
    }
    try {
      if (!this.settings.isDefaultColorTheme() || !previousSettingsId) {
        return;
      }
      previousSettingsId = migrateThemeSettingsId(previousSettingsId);
      if (!["Dark Modern", "Light Modern"].includes(previousSettingsId)) {
        return;
      }
      if (![ThemeSettingDefaults.COLOR_THEME_DARK, ThemeSettingDefaults.COLOR_THEME_LIGHT].includes(this.settings.colorTheme)) {
        return;
      }
    } finally {
      this.storageService.store(WorkbenchThemeService.NEW_THEME_NOTIFICATION_KEY, true, StorageScope.APPLICATION, StorageTarget.USER);
    }
    const keepTheme = await new Promise((resolve) => {
      this.notificationService.prompt(
        Severity.Info,
        nls.localize({ key: "themeUpdatedNotification", comment: ["{0} is the name of the new default theme"] }, "VS Code has a new default theme: '{0}'.", this.getColorTheme().label),
        [
          toAction({
            id: "themeUpdated.tryItOut",
            label: nls.localize("tryNewTheme", "Keep It"),
            run: () => resolve(true)
          }),
          toAction({
            id: "themeUpdated.noThanks",
            label: nls.localize("noThanks", "No Thanks"),
            run: () => resolve(false)
          })
        ],
        {
          onCancel: () => resolve(false)
        }
      );
    });
    if (!keepTheme) {
      const previousTheme = this.colorThemeRegistry.findThemeBySettingsId(previousSettingsId);
      if (previousTheme) {
        this.setColorTheme(previousTheme.id, "auto");
      }
    }
  }
  /**
   * Migrates legacy theme setting values to their current equivalents,
   * writing back the migrated value so settings sync distributes the correct ID.
   */
  migrateColorThemeSettings() {
    const themeSettings = [
      ThemeSettings.COLOR_THEME,
      ThemeSettings.PREFERRED_DARK_THEME,
      ThemeSettings.PREFERRED_LIGHT_THEME,
      ThemeSettings.PREFERRED_HC_DARK_THEME,
      ThemeSettings.PREFERRED_HC_LIGHT_THEME
    ];
    for (const key of themeSettings) {
      const inspection = this.configurationService.inspect(key);
      for (const [target, value] of [
        [ConfigurationTarget.USER, inspection.userValue],
        [ConfigurationTarget.USER_REMOTE, inspection.userRemoteValue],
        [ConfigurationTarget.WORKSPACE, inspection.workspaceValue]
      ]) {
        if (value) {
          const migrated = migrateThemeSettingsId(value);
          if (migrated !== value) {
            this.configurationService.updateValue(key, migrated, target);
          }
        }
      }
    }
  }
  installConfigurationListener() {
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(ThemeSettings.COLOR_THEME) || e.affectsConfiguration(ThemeSettings.PREFERRED_DARK_THEME) || e.affectsConfiguration(ThemeSettings.PREFERRED_LIGHT_THEME) || e.affectsConfiguration(ThemeSettings.PREFERRED_HC_DARK_THEME) || e.affectsConfiguration(ThemeSettings.PREFERRED_HC_LIGHT_THEME) || e.affectsConfiguration(ThemeSettings.DETECT_COLOR_SCHEME) || e.affectsConfiguration(ThemeSettings.DETECT_HC) || e.affectsConfiguration(ThemeSettings.SYSTEM_COLOR_THEME)) {
        this.restoreColorTheme();
      }
      if (e.affectsConfiguration(ThemeSettings.FILE_ICON_THEME)) {
        this.restoreFileIconTheme();
      }
      if (e.affectsConfiguration(ThemeSettings.PRODUCT_ICON_THEME)) {
        this.restoreProductIconTheme();
      }
      if (this.currentColorTheme) {
        let hasColorChanges = false;
        if (e.affectsConfiguration(ThemeSettings.COLOR_CUSTOMIZATIONS)) {
          this.currentColorTheme.setCustomColors(this.settings.colorCustomizations);
          hasColorChanges = true;
        }
        if (e.affectsConfiguration(ThemeSettings.TOKEN_COLOR_CUSTOMIZATIONS)) {
          this.currentColorTheme.setCustomTokenColors(this.settings.tokenColorCustomizations);
          hasColorChanges = true;
        }
        if (e.affectsConfiguration(ThemeSettings.SEMANTIC_TOKEN_COLOR_CUSTOMIZATIONS)) {
          this.currentColorTheme.setCustomSemanticTokenColors(this.settings.semanticTokenColorCustomizations);
          hasColorChanges = true;
        }
        if (hasColorChanges) {
          this.updateDynamicCSSRules(this.currentColorTheme);
          this.onColorThemeChange.fire(this.currentColorTheme);
        }
      }
    }));
  }
  installRegistryListeners() {
    let prevColorId = void 0;
    this._register(this.colorThemeRegistry.onDidChange(async (event) => {
      updateColorThemeConfigurationSchemas(event.themes);
      if (await this.restoreColorTheme()) {
        if (this.currentColorTheme.settingsId === ThemeSettingDefaults.COLOR_THEME_DARK && !types.isUndefined(prevColorId) && await this.colorThemeRegistry.findThemeById(prevColorId)) {
          await this.setColorTheme(prevColorId, "auto");
          prevColorId = void 0;
        } else if (event.added.some((t) => t.settingsId === this.currentColorTheme.settingsId)) {
          await this.reloadCurrentColorTheme();
        }
      } else if (event.removed.some((t) => t.settingsId === this.currentColorTheme.settingsId)) {
        prevColorId = this.currentColorTheme.id;
        const defaultTheme = this.colorThemeRegistry.findThemeBySettingsId(ThemeSettingDefaults.COLOR_THEME_DARK);
        await this.setColorTheme(defaultTheme, "auto");
      }
    }));
    let prevFileIconId = void 0;
    this._register(this._register(this.fileIconThemeRegistry.onDidChange(async (event) => {
      updateFileIconThemeConfigurationSchemas(event.themes);
      if (await this.restoreFileIconTheme()) {
        if (this.currentFileIconTheme.id === DEFAULT_FILE_ICON_THEME_ID && !types.isUndefined(prevFileIconId) && this.fileIconThemeRegistry.findThemeById(prevFileIconId)) {
          await this.setFileIconTheme(prevFileIconId, "auto");
          prevFileIconId = void 0;
        } else if (event.added.some((t) => t.settingsId === this.currentFileIconTheme.settingsId)) {
          await this.reloadCurrentFileIconTheme();
        }
      } else if (event.removed.some((t) => t.settingsId === this.currentFileIconTheme.settingsId)) {
        prevFileIconId = this.currentFileIconTheme.id;
        await this.setFileIconTheme(DEFAULT_FILE_ICON_THEME_ID, "auto");
      }
    })));
    let prevProductIconId = void 0;
    this._register(this.productIconThemeRegistry.onDidChange(async (event) => {
      updateProductIconThemeConfigurationSchemas(event.themes);
      if (await this.restoreProductIconTheme()) {
        if (this.currentProductIconTheme.id === DEFAULT_PRODUCT_ICON_THEME_ID && !types.isUndefined(prevProductIconId) && this.productIconThemeRegistry.findThemeById(prevProductIconId)) {
          await this.setProductIconTheme(prevProductIconId, "auto");
          prevProductIconId = void 0;
        } else if (event.added.some((t) => t.settingsId === this.currentProductIconTheme.settingsId)) {
          await this.reloadCurrentProductIconTheme();
        }
      } else if (event.removed.some((t) => t.settingsId === this.currentProductIconTheme.settingsId)) {
        prevProductIconId = this.currentProductIconTheme.id;
        await this.setProductIconTheme(DEFAULT_PRODUCT_ICON_THEME_ID, "auto");
      }
    }));
    this._register(this.languageService.onDidChange(() => this.reloadCurrentFileIconTheme()));
    return Promise.all([this.getColorThemes(), this.getFileIconThemes(), this.getProductIconThemes()]).then(([ct, fit, pit]) => {
      updateColorThemeConfigurationSchemas(ct);
      updateFileIconThemeConfigurationSchemas(fit);
      updateProductIconThemeConfigurationSchemas(pit);
    });
  }
  // preferred scheme handling
  installPreferredSchemeListener() {
    let previous = { dark: this.hostColorService.dark, highContrast: this.hostColorService.highContrast };
    this._register(this.hostColorService.onDidChangeColorScheme(() => {
      const restoreColorTheme = this.settings.isPreferredColorSchemeChange(previous);
      previous = { dark: this.hostColorService.dark, highContrast: this.hostColorService.highContrast };
      if (restoreColorTheme) {
        this.restoreColorTheme();
      }
    }));
  }
  getColorTheme() {
    return this.currentColorTheme;
  }
  async getColorThemes() {
    return this.colorThemeRegistry.getThemes();
  }
  getPreferredColorScheme() {
    return this.settings.getPreferredColorScheme();
  }
  async getMarketplaceColorThemes(publisher, name, version) {
    const extensionLocation = await this.extensionResourceLoaderService.getExtensionGalleryResourceURL({ publisher, name, version }, "extension");
    if (extensionLocation) {
      try {
        const manifestContent = await this.extensionResourceLoaderService.readExtensionResource(resources.joinPath(extensionLocation, "package.json"));
        return this.colorThemeRegistry.getMarketplaceThemes(JSON.parse(manifestContent), extensionLocation, ExtensionData.fromName(publisher, name));
      } catch (e) {
        this.logService.error("Problem loading themes from marketplace", e);
      }
    }
    return [];
  }
  get onDidColorThemeChange() {
    return this.onColorThemeChange.event;
  }
  setColorTheme(themeIdOrTheme, settingsTarget) {
    return this.colorThemeSequencer.queue(async () => {
      return this.internalSetColorTheme(themeIdOrTheme, settingsTarget);
    });
  }
  async internalSetColorTheme(themeIdOrTheme, settingsTarget) {
    if (!themeIdOrTheme) {
      return null;
    }
    const themeId = types.isString(themeIdOrTheme) ? validateThemeId(themeIdOrTheme) : themeIdOrTheme.id;
    if (this.currentColorTheme.isLoaded && themeId === this.currentColorTheme.id) {
      if (settingsTarget !== "preview") {
        this.currentColorTheme.toStorage(this.storageService);
      }
      return this.settings.setColorTheme(this.currentColorTheme, settingsTarget);
    }
    let themeData = this.colorThemeRegistry.findThemeById(themeId);
    if (!themeData) {
      if (themeIdOrTheme instanceof ColorThemeData) {
        themeData = themeIdOrTheme;
      } else {
        return null;
      }
    }
    try {
      await themeData.ensureLoaded(this.extensionResourceLoaderService);
      themeData.setCustomizations(this.settings);
      return this.applyTheme(themeData, settingsTarget);
    } catch (error) {
      throw new Error(nls.localize("error.cannotloadtheme", "Unable to load {0}: {1}", themeData.location?.toString(), error.message));
    }
  }
  reloadCurrentColorTheme() {
    return this.colorThemeSequencer.queue(async () => {
      try {
        const theme = this.colorThemeRegistry.findThemeBySettingsId(this.currentColorTheme.settingsId) || this.currentColorTheme;
        await theme.reload(this.extensionResourceLoaderService);
        theme.setCustomizations(this.settings);
        await this.applyTheme(theme, void 0, false);
      } catch (error) {
        this.logService.info("Unable to reload {0}: {1}", this.currentColorTheme.location?.toString());
      }
    });
  }
  async restoreColorTheme() {
    return this.colorThemeSequencer.queue(async () => {
      const settingId = this.settings.colorTheme;
      const theme = this.colorThemeRegistry.findThemeBySettingsId(settingId);
      if (theme) {
        if (settingId !== this.currentColorTheme.settingsId) {
          await this.internalSetColorTheme(theme.id, void 0);
        } else if (theme !== this.currentColorTheme) {
          await theme.ensureLoaded(this.extensionResourceLoaderService);
          theme.setCustomizations(this.settings);
          await this.applyTheme(theme, void 0, true);
        }
        return true;
      }
      return false;
    });
  }
  updateDynamicCSSRules(themeData) {
    const css = generateColorThemeCSS(
      themeData,
      ".monaco-workbench",
      themingRegistry.getThemingParticipants(),
      this.environmentService
    );
    _applyRules(css.code, colorThemeRulesClassName);
  }
  applyTheme(newTheme, settingsTarget, silent = false) {
    this.updateDynamicCSSRules(newTheme);
    if (this.currentColorTheme.id) {
      this.container.classList.remove(...this.currentColorTheme.classNames);
    } else {
      this.container.classList.remove(ThemeTypeSelector.VS, ThemeTypeSelector.VS_DARK, ThemeTypeSelector.HC_BLACK, ThemeTypeSelector.HC_LIGHT);
    }
    this.container.classList.add(...newTheme.classNames);
    this.currentColorTheme.clearCaches();
    this.currentColorTheme = newTheme;
    if (!this.colorThemingParticipantChangeListener) {
      this.colorThemingParticipantChangeListener = themingRegistry.onThemingParticipantAdded((_) => this.updateDynamicCSSRules(this.currentColorTheme));
    }
    this.colorThemeWatcher.update(newTheme);
    this.sendTelemetry(newTheme.id, newTheme.extensionData, "color");
    if (silent) {
      return Promise.resolve(null);
    }
    this.onColorThemeChange.fire(this.currentColorTheme);
    if (newTheme.isLoaded && settingsTarget !== "preview") {
      newTheme.toStorage(this.storageService);
    }
    return this.settings.setColorTheme(this.currentColorTheme, settingsTarget);
  }
  sendTelemetry(themeId, themeData, themeType) {
    if (themeData) {
      const key = themeType + themeData.extensionId;
      if (!this.themeExtensionsActivated.get(key)) {
        this.telemetryService.publicLog2("activateThemeExtension", {
          id: themeData.extensionId,
          name: themeData.extensionName,
          isBuiltin: themeData.extensionIsBuiltin,
          publisherDisplayName: themeData.extensionPublisher,
          themeId
        });
        this.themeExtensionsActivated.set(key, true);
      }
    }
  }
  async getFileIconThemes() {
    return this.fileIconThemeRegistry.getThemes();
  }
  getFileIconTheme() {
    return this.currentFileIconTheme;
  }
  get onDidFileIconThemeChange() {
    return this.onFileIconThemeChange.event;
  }
  async setFileIconTheme(iconThemeOrId, settingsTarget) {
    return this.fileIconThemeSequencer.queue(async () => {
      return this.internalSetFileIconTheme(iconThemeOrId, settingsTarget);
    });
  }
  async internalSetFileIconTheme(iconThemeOrId, settingsTarget) {
    if (iconThemeOrId === void 0) {
      iconThemeOrId = "";
    }
    const themeId = types.isString(iconThemeOrId) ? iconThemeOrId : iconThemeOrId.id;
    if (themeId !== this.currentFileIconTheme.id || !this.currentFileIconTheme.isLoaded) {
      let newThemeData = this.fileIconThemeRegistry.findThemeById(themeId);
      if (!newThemeData && iconThemeOrId instanceof FileIconThemeData) {
        newThemeData = iconThemeOrId;
      }
      if (!newThemeData) {
        newThemeData = FileIconThemeData.noIconTheme;
      }
      await newThemeData.ensureLoaded(this.fileIconThemeLoader);
      this.applyAndSetFileIconTheme(newThemeData);
    }
    const themeData = this.currentFileIconTheme;
    if (themeData.isLoaded && settingsTarget !== "preview" && (!themeData.location || !getRemoteAuthority(themeData.location))) {
      themeData.toStorage(this.storageService);
    }
    await this.settings.setFileIconTheme(this.currentFileIconTheme, settingsTarget);
    return themeData;
  }
  async getMarketplaceFileIconThemes(publisher, name, version) {
    const extensionLocation = await this.extensionResourceLoaderService.getExtensionGalleryResourceURL({ publisher, name, version }, "extension");
    if (extensionLocation) {
      try {
        const manifestContent = await this.extensionResourceLoaderService.readExtensionResource(resources.joinPath(extensionLocation, "package.json"));
        return this.fileIconThemeRegistry.getMarketplaceThemes(JSON.parse(manifestContent), extensionLocation, ExtensionData.fromName(publisher, name));
      } catch (e) {
        this.logService.error("Problem loading themes from marketplace", e);
      }
    }
    return [];
  }
  async reloadCurrentFileIconTheme() {
    return this.fileIconThemeSequencer.queue(async () => {
      await this.currentFileIconTheme.reload(this.fileIconThemeLoader);
      this.applyAndSetFileIconTheme(this.currentFileIconTheme);
    });
  }
  async restoreFileIconTheme() {
    return this.fileIconThemeSequencer.queue(async () => {
      const settingId = this.settings.fileIconTheme;
      const theme = this.fileIconThemeRegistry.findThemeBySettingsId(settingId);
      if (theme) {
        if (settingId !== this.currentFileIconTheme.settingsId) {
          await this.internalSetFileIconTheme(theme.id, void 0);
        } else if (theme !== this.currentFileIconTheme) {
          await theme.ensureLoaded(this.fileIconThemeLoader);
          this.applyAndSetFileIconTheme(theme, true);
        }
        return true;
      }
      return false;
    });
  }
  applyAndSetFileIconTheme(iconThemeData, silent = false) {
    this.currentFileIconTheme = iconThemeData;
    _applyRules(iconThemeData.styleSheetContent, fileIconThemeRulesClassName);
    if (iconThemeData.id) {
      this.container.classList.add(fileIconsEnabledClass);
    } else {
      this.container.classList.remove(fileIconsEnabledClass);
    }
    this.fileIconThemeWatcher.update(iconThemeData);
    if (iconThemeData.id) {
      this.sendTelemetry(iconThemeData.id, iconThemeData.extensionData, "fileIcon");
    }
    if (!silent) {
      this.onFileIconThemeChange.fire(this.currentFileIconTheme);
    }
  }
  async getProductIconThemes() {
    return this.productIconThemeRegistry.getThemes();
  }
  getProductIconTheme() {
    return this.currentProductIconTheme;
  }
  get onDidProductIconThemeChange() {
    return this.onProductIconThemeChange.event;
  }
  async setProductIconTheme(iconThemeOrId, settingsTarget) {
    return this.productIconThemeSequencer.queue(async () => {
      return this.internalSetProductIconTheme(iconThemeOrId, settingsTarget);
    });
  }
  async internalSetProductIconTheme(iconThemeOrId, settingsTarget) {
    if (iconThemeOrId === void 0) {
      iconThemeOrId = "";
    }
    const themeId = types.isString(iconThemeOrId) ? iconThemeOrId : iconThemeOrId.id;
    if (themeId !== this.currentProductIconTheme.id || !this.currentProductIconTheme.isLoaded) {
      let newThemeData = this.productIconThemeRegistry.findThemeById(themeId);
      if (!newThemeData && iconThemeOrId instanceof ProductIconThemeData) {
        newThemeData = iconThemeOrId;
      }
      if (!newThemeData) {
        newThemeData = ProductIconThemeData.defaultTheme;
      }
      await newThemeData.ensureLoaded(this.extensionResourceLoaderService, this.logService);
      this.applyAndSetProductIconTheme(newThemeData);
    }
    const themeData = this.currentProductIconTheme;
    if (themeData.isLoaded && settingsTarget !== "preview" && (!themeData.location || !getRemoteAuthority(themeData.location))) {
      themeData.toStorage(this.storageService);
    }
    await this.settings.setProductIconTheme(this.currentProductIconTheme, settingsTarget);
    return themeData;
  }
  async getMarketplaceProductIconThemes(publisher, name, version) {
    const extensionLocation = await this.extensionResourceLoaderService.getExtensionGalleryResourceURL({ publisher, name, version }, "extension");
    if (extensionLocation) {
      try {
        const manifestContent = await this.extensionResourceLoaderService.readExtensionResource(resources.joinPath(extensionLocation, "package.json"));
        return this.productIconThemeRegistry.getMarketplaceThemes(JSON.parse(manifestContent), extensionLocation, ExtensionData.fromName(publisher, name));
      } catch (e) {
        this.logService.error("Problem loading themes from marketplace", e);
      }
    }
    return [];
  }
  async reloadCurrentProductIconTheme() {
    return this.productIconThemeSequencer.queue(async () => {
      await this.currentProductIconTheme.reload(this.extensionResourceLoaderService, this.logService);
      this.applyAndSetProductIconTheme(this.currentProductIconTheme);
    });
  }
  async restoreProductIconTheme() {
    return this.productIconThemeSequencer.queue(async () => {
      const settingId = this.settings.productIconTheme;
      const theme = this.productIconThemeRegistry.findThemeBySettingsId(settingId);
      if (theme) {
        if (settingId !== this.currentProductIconTheme.settingsId) {
          await this.internalSetProductIconTheme(theme.id, void 0);
        } else if (theme !== this.currentProductIconTheme) {
          await theme.ensureLoaded(this.extensionResourceLoaderService, this.logService);
          this.applyAndSetProductIconTheme(theme, true);
        }
        return true;
      }
      return false;
    });
  }
  applyAndSetProductIconTheme(iconThemeData, silent = false) {
    this.currentProductIconTheme = iconThemeData;
    _applyRules(iconThemeData.styleSheetContent, productIconThemeRulesClassName);
    this.productIconThemeWatcher.update(iconThemeData);
    if (iconThemeData.id) {
      this.sendTelemetry(iconThemeData.id, iconThemeData.extensionData, "productIcon");
    }
    if (!silent) {
      this.onProductIconThemeChange.fire(this.currentProductIconTheme);
    }
  }
};
WorkbenchThemeService = __decorateClass([
  __decorateParam(0, IExtensionService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, IBrowserWorkbenchEnvironmentService),
  __decorateParam(5, IFileService),
  __decorateParam(6, IExtensionResourceLoaderService),
  __decorateParam(7, IWorkbenchLayoutService),
  __decorateParam(8, ILogService),
  __decorateParam(9, IHostColorSchemeService),
  __decorateParam(10, IUserDataInitializationService),
  __decorateParam(11, ILanguageService),
  __decorateParam(12, INotificationService),
  __decorateParam(13, IHostService)
], WorkbenchThemeService);
class ThemeFileWatcher {
  constructor(fileService, environmentService, onUpdate) {
    this.fileService = fileService;
    this.environmentService = environmentService;
    this.onUpdate = onUpdate;
    this.watcherDisposables = new DisposableStore();
  }
  update(theme) {
    if (!resources.isEqual(theme.location, this.watchedLocation)) {
      this.watchedLocation = void 0;
      this.watcherDisposables.clear();
      if (theme.location && (theme.watch || this.environmentService.isExtensionDevelopment)) {
        this.watchedLocation = theme.location;
        this.watcherDisposables.add(this.fileService.watch(theme.location));
        this.watcherDisposables.add(this.fileService.onDidFilesChange((e) => {
          if (this.watchedLocation && e.contains(this.watchedLocation, FileChangeType.UPDATED)) {
            this.onUpdate();
          }
        }));
      }
    }
  }
  dispose() {
    this.watcherDisposables.dispose();
    this.watchedLocation = void 0;
  }
}
function _applyRules(styleSheetContent, rulesClassName) {
  const themeStyles = mainWindow.document.head.getElementsByClassName(rulesClassName);
  if (themeStyles.length === 0) {
    const elStyle = createStyleSheet();
    elStyle.className = rulesClassName;
    elStyle.textContent = styleSheetContent;
  } else {
    themeStyles[0].textContent = styleSheetContent;
  }
}
registerColorThemeSchemas();
registerFileIconThemeSchemas();
registerProductIconThemeSchemas();
registerSingleton(IWorkbenchThemeService, WorkbenchThemeService, InstantiationType.Eager);
export {
  WorkbenchThemeService
};
