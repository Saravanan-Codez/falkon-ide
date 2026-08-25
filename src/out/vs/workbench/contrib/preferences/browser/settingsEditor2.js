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
import * as DOM from "../../../../base/browser/dom.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import * as aria from "../../../../base/browser/ui/aria/aria.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { Orientation, Sizing, SplitView } from "../../../../base/browser/ui/splitview/splitview.js";
import { ToggleActionViewItem } from "../../../../base/browser/ui/toggle/toggle.js";
import { Action } from "../../../../base/common/actions.js";
import { createCancelablePromise, Delayer, raceTimeout } from "../../../../base/common/async.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Color } from "../../../../base/common/color.js";
import { fromNow } from "../../../../base/common/date.js";
import { isCancellationError } from "../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore, dispose, MutableDisposable } from "../../../../base/common/lifecycle.js";
import * as platform from "../../../../base/common/platform.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { URI } from "../../../../base/common/uri.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { localize } from "../../../../nls.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { ConfigurationTarget } from "../../../../platform/configuration/common/configuration.js";
import { ConfigurationScope, Extensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IExtensionGalleryService, IExtensionManagementService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IEditorProgressService } from "../../../../platform/progress/common/progress.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { defaultButtonStyles, defaultToggleStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { asCssVariable, editorForeground } from "../../../../platform/theme/common/colorRegistry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IUserDataSyncEnablementService, IUserDataSyncService, SyncStatus } from "../../../../platform/userDataSync/common/userDataSync.js";
import { IWorkspaceTrustManagementService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { registerNavigableContainer } from "../../../browser/actions/widgetNavigationCommands.js";
import { EditorPane } from "../../../browser/parts/editor/editorPane.js";
import { IChatEntitlementService } from "../../../services/chat/common/chatEntitlementService.js";
import { APPLICATION_SCOPES, IWorkbenchConfigurationService } from "../../../services/configuration/common/configuration.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { ALWAYS_SHOW_ADVANCED_SETTINGS_SETTING, IPreferencesService, SettingMatchType, SettingValueType, validateSettingsEditorOptions } from "../../../services/preferences/common/preferences.js";
import { nullRange, Settings2EditorModel } from "../../../services/preferences/common/preferencesModels.js";
import { IUserDataProfileService } from "../../../services/userDataProfile/common/userDataProfile.js";
import { IUserDataSyncWorkbenchService } from "../../../services/userDataSync/common/userDataSync.js";
import { SuggestEnabledInputWithHistory } from "../../codeEditor/browser/suggestEnabledInput/suggestEnabledInput.js";
import { ADVANCED_SETTING_TAG, AGENTS_WINDOW_SETTING_TAG, CONTEXT_AI_SETTING_RESULTS_AVAILABLE, CONTEXT_SETTINGS_EDITOR, CONTEXT_SETTINGS_FIRST_ROW_FOCUS, CONTEXT_SETTINGS_ROW_FOCUS, CONTEXT_SETTINGS_SEARCH_FOCUS, CONTEXT_TOC_ROW_FOCUS, EMBEDDINGS_SEARCH_PROVIDER_NAME, ENABLE_LANGUAGE_FILTER, EXTENSION_FETCH_TIMEOUT_MS, EXTENSION_SETTING_TAG, FEATURE_SETTING_TAG, FILTER_MODEL_SEARCH_PROVIDER_NAME, getExperimentalExtensionToggleData, ID_SETTING_TAG, IPreferencesSearchService, LANGUAGE_SETTING_TAG, LLM_RANKED_SEARCH_PROVIDER_NAME, MODIFIED_SETTING_TAG, POLICY_SETTING_TAG, REQUIRE_TRUSTED_WORKSPACE_SETTING_TAG, SETTINGS_EDITOR_COMMAND_CLEAR_SEARCH_RESULTS, SETTINGS_EDITOR_COMMAND_SHOW_AI_RESULTS, SETTINGS_EDITOR_COMMAND_SUGGEST_FILTERS, SETTINGS_EDITOR_COMMAND_TOGGLE_AI_SEARCH, STRING_MATCH_SEARCH_PROVIDER_NAME, TF_IDF_SEARCH_PROVIDER_NAME, WorkbenchSettingsEditorSettings, WORKSPACE_TRUST_SETTING_TAG } from "../common/preferences.js";
import { settingsHeaderBorder, settingsSashBorder, settingsTextInputBorder } from "../common/settingsEditorColorRegistry.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import "./media/settingsEditor2.css";
import { preferencesAiResultsIcon, preferencesClearInputIcon, preferencesFilterIcon } from "./preferencesIcons.js";
import { SettingsTargetsWidget } from "./preferencesWidgets.js";
import { getCommonlyUsedData, tocData } from "./settingsLayout.js";
import { SettingsSearchFilterDropdownMenuActionViewItem } from "./settingsSearchMenu.js";
import { AbstractSettingRenderer, createTocTreeForExtensionSettings, resolveConfiguredUntrustedSettings, resolveSettingsTree, SettingsTree, SettingTreeRenderers } from "./settingsTree.js";
import { parseQuery, SearchResultIdx, SearchResultModel, SettingsTreeGroupElement, SettingsTreeModel, SettingsTreeSettingElement } from "./settingsTreeModels.js";
import { createTOCIterator, TOCTree, TOCTreeModel } from "./tocTree.js";
var SettingsFocusContext = /* @__PURE__ */ ((SettingsFocusContext2) => {
  SettingsFocusContext2[SettingsFocusContext2["Search"] = 0] = "Search";
  SettingsFocusContext2[SettingsFocusContext2["TableOfContents"] = 1] = "TableOfContents";
  SettingsFocusContext2[SettingsFocusContext2["SettingTree"] = 2] = "SettingTree";
  SettingsFocusContext2[SettingsFocusContext2["SettingControl"] = 3] = "SettingControl";
  return SettingsFocusContext2;
})(SettingsFocusContext || {});
function createGroupIterator(group) {
  return Iterable.map(group.children, (g) => {
    return {
      element: g,
      children: g instanceof SettingsTreeGroupElement ? createGroupIterator(g) : void 0
    };
  });
}
const $ = DOM.$;
const searchBoxLabel = localize("SearchSettings.AriaLabel", "Search settings");
const searchBoxPlaceholderWithHistory = localize({
  key: "SearchSettings.PlaceholderWithHistory",
  comment: ["Placeholder for the settings search input hinting that the up and down arrow keys navigate the search history. The character inserted for {0} is \u21C5 to represent the up and down arrow keys."]
}, "Search settings ({0} for history)", "\u21C5");
const SEARCH_TOC_BEHAVIOR_KEY = "workbench.settings.settingsSearchTocBehavior";
const SHOW_AI_RESULTS_ENABLED_LABEL = localize("showAiResultsEnabled", "Show AI-recommended results");
const SHOW_AI_RESULTS_DISABLED_LABEL = localize("showAiResultsDisabled", "No AI results available at this time...");
const SETTINGS_EDITOR_STATE_KEY = "settingsEditorState";
let SettingsEditor2 = class extends EditorPane {
  constructor(group, telemetryService, configurationService, textResourceConfigurationService, themeService, preferencesService, instantiationService, preferencesSearchService, logService, contextKeyService, storageService, editorGroupService, userDataSyncWorkbenchService, userDataSyncEnablementService, workspaceTrustManagementService, extensionService, languageService, extensionManagementService, productService, extensionGalleryService, editorProgressService, userDataProfileService, keybindingService, chatEntitlementService, environmentService) {
    super(SettingsEditor2.ID, group, telemetryService, themeService, storageService);
    this.configurationService = configurationService;
    this.preferencesService = preferencesService;
    this.instantiationService = instantiationService;
    this.preferencesSearchService = preferencesSearchService;
    this.logService = logService;
    this.storageService = storageService;
    this.editorGroupService = editorGroupService;
    this.userDataSyncWorkbenchService = userDataSyncWorkbenchService;
    this.userDataSyncEnablementService = userDataSyncEnablementService;
    this.workspaceTrustManagementService = workspaceTrustManagementService;
    this.extensionService = extensionService;
    this.languageService = languageService;
    this.extensionManagementService = extensionManagementService;
    this.productService = productService;
    this.extensionGalleryService = extensionGalleryService;
    this.editorProgressService = editorProgressService;
    this.keybindingService = keybindingService;
    this.chatEntitlementService = chatEntitlementService;
    this.environmentService = environmentService;
    this.searchContainer = null;
    this.settingsTreeModel = this._register(new MutableDisposable());
    this.searchInProgress = null;
    this.aiSearchPromise = null;
    /**
     * The trimmed query value that the currently rendered results reflect. Used to determine
     * whether the displayed results are up to date with the current search input value before
     * moving focus into the results.
     */
    this.renderedSearchQuery = "";
    this.showAiResultsAction = null;
    this.pendingSettingUpdate = null;
    this._searchResultModel = this._register(new MutableDisposable());
    this.searchResultLabel = null;
    this.lastSyncedLabel = null;
    this.settingsOrderByTocIndex = null;
    this._currentFocusContext = 0 /* Search */;
    /** Don't spam warnings */
    this.hasWarnedMissingSettings = false;
    this.tocTreeDisposed = false;
    this.tocFocusedElement = null;
    this.treeFocusedElement = null;
    this.settingsTreeScrollTop = 0;
    this.installedExtensionIds = [];
    this.dismissedExtensionSettings = [];
    this.DISMISSED_EXTENSION_SETTINGS_STORAGE_KEY = "settingsEditor2.dismissedExtensionSettings";
    this.DISMISSED_EXTENSION_SETTINGS_DELIMITER = "	";
    this.SEARCH_HISTORY_STORAGE_KEY = "settingsEditor2.searchHistory";
    this.searchInputActionBar = null;
    this.searchDelayer = this._register(new Delayer(200));
    this.viewState = { settingsTarget: ConfigurationTarget.USER_LOCAL };
    this.settingFastUpdateDelayer = this._register(new Delayer(SettingsEditor2.SETTING_UPDATE_FAST_DEBOUNCE));
    this.settingSlowUpdateDelayer = this._register(new Delayer(SettingsEditor2.SETTING_UPDATE_SLOW_DEBOUNCE));
    this.searchInputDelayer = this._register(new Delayer(SettingsEditor2.SEARCH_DEBOUNCE));
    this.updatedConfigSchemaDelayer = this._register(new Delayer(SettingsEditor2.CONFIG_SCHEMA_UPDATE_DELAYER));
    this.inSettingsEditorContextKey = CONTEXT_SETTINGS_EDITOR.bindTo(contextKeyService);
    this.searchFocusContextKey = CONTEXT_SETTINGS_SEARCH_FOCUS.bindTo(contextKeyService);
    this.tocRowFocused = CONTEXT_TOC_ROW_FOCUS.bindTo(contextKeyService);
    this.settingRowFocused = CONTEXT_SETTINGS_ROW_FOCUS.bindTo(contextKeyService);
    this.settingFirstRowFocused = CONTEXT_SETTINGS_FIRST_ROW_FOCUS.bindTo(contextKeyService);
    this.aiResultsAvailable = CONTEXT_AI_SETTING_RESULTS_AVAILABLE.bindTo(contextKeyService);
    this.scheduledRefreshes = /* @__PURE__ */ new Map();
    this.editorMemento = this.getEditorMemento(editorGroupService, textResourceConfigurationService, SETTINGS_EDITOR_STATE_KEY);
    this.dismissedExtensionSettings = this.storageService.get(this.DISMISSED_EXTENSION_SETTINGS_STORAGE_KEY, StorageScope.PROFILE, "").split(this.DISMISSED_EXTENSION_SETTINGS_DELIMITER);
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectedKeys.has(WorkbenchSettingsEditorSettings.ShowAISearchToggle) || e.affectedKeys.has(WorkbenchSettingsEditorSettings.EnableNaturalLanguageSearch)) {
        this.updateAiSearchToggleVisibility();
      }
      if (e.affectsConfiguration(ALWAYS_SHOW_ADVANCED_SETTINGS_SETTING)) {
        this.onConfigUpdate(void 0, true, true);
      }
      if (e.source !== ConfigurationTarget.DEFAULT) {
        this.onConfigUpdate(e.affectedKeys);
      }
    }));
    this._register(chatEntitlementService.onDidChangeSentiment(() => {
      this.updateAiSearchToggleVisibility();
    }));
    this._register(userDataProfileService.onDidChangeCurrentProfile((e) => {
      e.join(this.whenCurrentProfileChanged());
    }));
    this._register(workspaceTrustManagementService.onDidChangeTrust(() => {
      this.searchResultModel?.updateWorkspaceTrust(workspaceTrustManagementService.isWorkspaceTrusted());
      if (this.settingsTreeModel.value) {
        this.settingsTreeModel.value.updateWorkspaceTrust(workspaceTrustManagementService.isWorkspaceTrusted());
        this.renderTree();
      }
    }));
    this._register(configurationService.onDidChangeRestrictedSettings((e) => {
      if (e.default.length && this.currentSettingsModel) {
        this.updateElementsByKey(new Set(e.default));
      }
    }));
    this._register(extensionManagementService.onDidInstallExtensions(() => {
      this.refreshInstalledExtensionsList();
    }));
    this._register(extensionManagementService.onDidUninstallExtension(() => {
      this.refreshInstalledExtensionsList();
    }));
    this.modelDisposables = this._register(new DisposableStore());
    if (ENABLE_LANGUAGE_FILTER && !SettingsEditor2.SUGGESTIONS.includes(`@${LANGUAGE_SETTING_TAG}`)) {
      SettingsEditor2.SUGGESTIONS.push(`@${LANGUAGE_SETTING_TAG}`);
    }
    if (this.environmentService.isSessionsWindow && !SettingsEditor2.SUGGESTIONS.includes(`@${AGENTS_WINDOW_SETTING_TAG}`)) {
      SettingsEditor2.SUGGESTIONS.push(`@${AGENTS_WINDOW_SETTING_TAG}`);
    }
    this.inputChangeListener = this._register(new MutableDisposable());
  }
  static {
    this.ID = "workbench.editor.settings2";
  }
  static {
    this.NUM_INSTANCES = 0;
  }
  static {
    this.SEARCH_DEBOUNCE = 200;
  }
  static {
    this.SETTING_UPDATE_FAST_DEBOUNCE = 200;
  }
  static {
    this.SETTING_UPDATE_SLOW_DEBOUNCE = 1e3;
  }
  static {
    this.CONFIG_SCHEMA_UPDATE_DELAYER = 500;
  }
  static {
    this.TOC_MIN_WIDTH = 100;
  }
  static {
    this.TOC_RESET_WIDTH = 200;
  }
  static {
    this.EDITOR_MIN_WIDTH = 500;
  }
  static {
    // Below NARROW_TOTAL_WIDTH, we only render the editor rather than the ToC.
    this.NARROW_TOTAL_WIDTH = this.TOC_RESET_WIDTH + this.EDITOR_MIN_WIDTH;
  }
  static {
    this.SUGGESTIONS = [
      `@${MODIFIED_SETTING_TAG}`,
      "@tag:notebookLayout",
      "@tag:notebookOutputLayout",
      `@tag:${REQUIRE_TRUSTED_WORKSPACE_SETTING_TAG}`,
      `@tag:${WORKSPACE_TRUST_SETTING_TAG}`,
      "@tag:sync",
      "@tag:usesOnlineServices",
      "@tag:telemetry",
      "@tag:accessibility",
      "@tag:preview",
      "@tag:experimental",
      `@tag:${ADVANCED_SETTING_TAG}`,
      `@${ID_SETTING_TAG}`,
      `@${EXTENSION_SETTING_TAG}`,
      `@${FEATURE_SETTING_TAG}scm`,
      `@${FEATURE_SETTING_TAG}explorer`,
      `@${FEATURE_SETTING_TAG}search`,
      `@${FEATURE_SETTING_TAG}debug`,
      `@${FEATURE_SETTING_TAG}extensions`,
      `@${FEATURE_SETTING_TAG}terminal`,
      `@${FEATURE_SETTING_TAG}task`,
      `@${FEATURE_SETTING_TAG}problems`,
      `@${FEATURE_SETTING_TAG}output`,
      `@${FEATURE_SETTING_TAG}comments`,
      `@${FEATURE_SETTING_TAG}remote`,
      `@${FEATURE_SETTING_TAG}timeline`,
      `@${FEATURE_SETTING_TAG}notebook`,
      `@${FEATURE_SETTING_TAG}chat`,
      `@${POLICY_SETTING_TAG}`
    ];
  }
  static shouldSettingUpdateFast(type) {
    if (Array.isArray(type)) {
      return false;
    }
    return type === SettingValueType.Enum || type === SettingValueType.Array || type === SettingValueType.BooleanObject || type === SettingValueType.Object || type === SettingValueType.Complex || type === SettingValueType.Boolean || type === SettingValueType.Exclude || type === SettingValueType.Include;
  }
  async whenCurrentProfileChanged() {
    this.updatedConfigSchemaDelayer.trigger(() => {
      this.dismissedExtensionSettings = this.storageService.get(this.DISMISSED_EXTENSION_SETTINGS_STORAGE_KEY, StorageScope.PROFILE, "").split(this.DISMISSED_EXTENSION_SETTINGS_DELIMITER);
      this.onConfigUpdate(void 0, true);
    });
  }
  canShowAdvancedSettings() {
    if (this.configurationService.getValue(ALWAYS_SHOW_ADVANCED_SETTINGS_SETTING) ?? false) {
      return true;
    }
    return this.viewState.tagFilters?.has(ADVANCED_SETTING_TAG) ?? false;
  }
  /**
   * Determines whether a setting should be shown even when advanced settings are filtered out.
   * Returns true if:
   * - The setting is not tagged as advanced, OR
   * - The setting matches an ID filter (@id:settingKey), OR
   * - The setting key appears in the search query, OR
   * - The @hasPolicy filter is active (policy settings should always be shown when filtering by policy)
   */
  shouldShowSetting(setting) {
    if (!setting.tags?.includes(ADVANCED_SETTING_TAG)) {
      return true;
    }
    if (this.viewState.idFilters?.has(setting.key)) {
      return true;
    }
    if (this.viewState.query?.toLowerCase().includes(setting.key.toLowerCase())) {
      return true;
    }
    if (this.viewState.tagFilters?.has(POLICY_SETTING_TAG)) {
      return true;
    }
    return false;
  }
  disableAiSearchToggle() {
    if (this.showAiResultsAction) {
      this.showAiResultsAction.checked = false;
      this.showAiResultsAction.enabled = false;
      this.aiResultsAvailable.set(false);
      this.showAiResultsAction.label = SHOW_AI_RESULTS_DISABLED_LABEL;
    }
  }
  updateAiSearchToggleVisibility() {
    if (!this.searchContainer || !this.showAiResultsAction || !this.searchInputActionBar) {
      return;
    }
    const showAiToggle = this.configurationService.getValue(WorkbenchSettingsEditorSettings.ShowAISearchToggle);
    const enableNaturalLanguageSearch = this.configurationService.getValue(WorkbenchSettingsEditorSettings.EnableNaturalLanguageSearch);
    const chatHidden = this.chatEntitlementService.sentiment.hidden || this.chatEntitlementService.sentiment.disabled;
    const canShowToggle = showAiToggle && enableNaturalLanguageSearch && !chatHidden;
    const alreadyVisible = this.searchInputActionBar.hasAction(this.showAiResultsAction);
    if (!alreadyVisible && canShowToggle) {
      this.searchInputActionBar.push(this.showAiResultsAction, {
        index: 0,
        label: false,
        icon: true
      });
      this.searchContainer.classList.add("with-ai-toggle");
    } else if (alreadyVisible) {
      this.searchInputActionBar.pull(0);
      this.searchContainer.classList.remove("with-ai-toggle");
      this.showAiResultsAction.checked = false;
    }
  }
  get minimumWidth() {
    return SettingsEditor2.EDITOR_MIN_WIDTH;
  }
  get maximumWidth() {
    return Number.POSITIVE_INFINITY;
  }
  get minimumHeight() {
    return 180;
  }
  // these setters need to exist because this extends from EditorPane
  set minimumWidth(value) {
  }
  set maximumWidth(value) {
  }
  get currentSettingsModel() {
    return this.searchResultModel || this.settingsTreeModel.value;
  }
  get searchResultModel() {
    return this._searchResultModel.value ?? null;
  }
  set searchResultModel(value) {
    this._searchResultModel.value = value ?? void 0;
    this.rootElement.classList.toggle("search-mode", !!this._searchResultModel.value);
  }
  get focusedSettingDOMElement() {
    const focused = this.settingsTree.getFocus()[0];
    if (!(focused instanceof SettingsTreeSettingElement)) {
      return;
    }
    return this.settingRenderers.getDOMElementsForSettingKey(this.settingsTree.getHTMLElement(), focused.setting.key)[0];
  }
  get currentFocusContext() {
    return this._currentFocusContext;
  }
  createEditor(parent) {
    parent.setAttribute("tabindex", "-1");
    this.rootElement = DOM.append(parent, $(".settings-editor", { tabindex: "-1" }));
    this.createHeader(this.rootElement);
    this.createBody(this.rootElement);
    this.addCtrlAInterceptor(this.rootElement);
    this.updateStyles();
    this._register(registerNavigableContainer({
      name: "settingsEditor2",
      focusNotifiers: [this],
      focusNextWidget: () => {
        if (this.searchWidget.inputWidget.hasWidgetFocus()) {
          this.focusTOC();
        }
      },
      focusPreviousWidget: () => {
        if (!this.searchWidget.inputWidget.hasWidgetFocus()) {
          this.focusSearch();
        }
      }
    }));
  }
  async setInput(input, options, context, token) {
    this.inSettingsEditorContextKey.set(true);
    await super.setInput(input, options, context, token);
    if (!this.input) {
      return;
    }
    const model = await this.input.resolve();
    if (token.isCancellationRequested || !(model instanceof Settings2EditorModel)) {
      return;
    }
    this.modelDisposables.clear();
    this.modelDisposables.add(model.onDidChangeGroups(() => {
      this.updatedConfigSchemaDelayer.trigger(() => {
        this.onConfigUpdate(void 0, false, true);
      });
    }));
    this.defaultSettingsEditorModel = model;
    options = options || validateSettingsEditorOptions({});
    if (!this.viewState.settingsTarget || !this.settingsTargetsWidget.settingsTarget) {
      const optionsHasViewStateTarget = options.viewState && options.viewState.settingsTarget;
      if (!options.target && !optionsHasViewStateTarget) {
        options.target = ConfigurationTarget.USER_LOCAL;
      }
    }
    this._setOptions(options);
    this.onConfigUpdate(void 0, true).then(() => {
      this.inputChangeListener.value = input.onWillDispose(() => {
        this.searchWidget.setValue("");
      });
      this.updateTreeScrollSync();
    });
    await this.refreshInstalledExtensionsList();
  }
  async refreshInstalledExtensionsList() {
    const installedExtensions = await this.extensionManagementService.getInstalled();
    this.installedExtensionIds = installedExtensions.filter((ext) => ext.manifest.contributes?.configuration).map((ext) => ext.identifier.id);
  }
  restoreCachedState() {
    const cachedState = this.input && this.editorMemento.loadEditorState(this.group, this.input);
    if (cachedState && typeof cachedState.target === "object") {
      cachedState.target = URI.revive(cachedState.target);
    }
    if (cachedState) {
      const settingsTarget = cachedState.target;
      this.settingsTargetsWidget.settingsTarget = settingsTarget;
      this.viewState.settingsTarget = settingsTarget;
      if (!this.searchWidget.getValue()) {
        this.searchWidget.setValue(cachedState.searchQuery);
      }
    }
    if (this.input) {
      this.editorMemento.clearEditorState(this.input, this.group);
    }
    return cachedState ?? null;
  }
  getViewState() {
    return this.viewState;
  }
  setOptions(options) {
    super.setOptions(options);
    if (options) {
      this._setOptions(options);
    }
  }
  _setOptions(options) {
    if (options.focusSearch && !platform.isIOS) {
      this.focusSearch();
    }
    const recoveredViewState = options.viewState ? options.viewState : void 0;
    const query = recoveredViewState?.query ?? options.query;
    if (query !== void 0) {
      this.searchWidget.setValue(query);
      this.viewState.query = query;
    }
    const target = options.folderUri ?? recoveredViewState?.settingsTarget ?? options.target;
    if (target) {
      this.settingsTargetsWidget.updateTarget(target);
    }
  }
  clearInput() {
    this.inSettingsEditorContextKey.set(false);
    super.clearInput();
  }
  layout(dimension) {
    this.dimension = dimension;
    if (!this.isVisible()) {
      return;
    }
    this.layoutSplitView(dimension);
    const innerWidth = Math.min(this.headerContainer.clientWidth, dimension.width) - 24 * 2;
    const monacoWidth = innerWidth - 10 - this.controlsElement.clientWidth - 12;
    this.searchWidget.layout(new DOM.Dimension(monacoWidth, 20));
    this.rootElement.classList.toggle("narrow-width", dimension.width < SettingsEditor2.NARROW_TOTAL_WIDTH);
  }
  focus() {
    super.focus();
    if (this._currentFocusContext === 0 /* Search */) {
      if (!platform.isIOS) {
        this.focusSearch();
      }
    } else if (this._currentFocusContext === 3 /* SettingControl */) {
      const element = this.focusedSettingDOMElement;
      if (element) {
        const control = element.querySelector(AbstractSettingRenderer.CONTROL_SELECTOR);
        if (control) {
          control.focus();
          return;
        }
      }
    } else if (this._currentFocusContext === 2 /* SettingTree */) {
      this.settingsTree.domFocus();
    } else if (this._currentFocusContext === 1 /* TableOfContents */) {
      this.tocTree.domFocus();
    }
  }
  setEditorVisible(visible) {
    super.setEditorVisible(visible);
    if (!visible) {
      setTimeout(() => {
        this.searchWidget.onHide();
        this.settingRenderers.cancelSuggesters();
      }, 0);
    }
  }
  focusSettings(focusSettingInput = false) {
    const focused = this.settingsTree.getFocus();
    if (!focused.length) {
      this.settingsTree.focusFirst();
    }
    this.settingsTree.domFocus();
    if (focusSettingInput) {
      const controlInFocusedRow = this.settingsTree.getHTMLElement().querySelector(`.focused ${AbstractSettingRenderer.CONTROL_SELECTOR}`);
      if (controlInFocusedRow) {
        controlInFocusedRow.focus();
      }
    }
  }
  focusTOC() {
    this.tocTree.domFocus();
  }
  /**
   * Invoked when the user presses the down arrow while the search input is focused.
   * Navigates forward through the search history first; only once there are no more
   * recent history entries does focus move down into the settings results.
   */
  navigateSearchHistoryNextOrFocusSettings() {
    if (this.searchWidget.isNavigatingHistory()) {
      this.searchWidget.showNextValue();
    } else {
      this.focusFirstSettingFromSearch();
    }
  }
  /**
   * Invoked when the user presses the up arrow while the search input is focused.
   * Navigates backward through the search history.
   */
  navigateSearchHistoryPrevious() {
    this.searchWidget.showPreviousValue();
  }
  /**
   * Whether the currently rendered results reflect the current search input value.
   * Returns false while a search is still pending (debounced) or in progress, so that
   * focus is not moved into stale results.
   */
  isSearchUpToDate() {
    return !this.searchInputDelayer.isTriggered && this.renderedSearchQuery === this.searchWidget.getValue().trim();
  }
  /**
   * Moves focus from the search input into the first settings result, but only when the
   * displayed results are up to date with the current search input. If the results are
   * stale (a search is still pending or in progress), this does nothing so that focus does
   * not land on results from a previous query.
   */
  focusFirstSettingFromSearch() {
    if (!this.isSearchUpToDate()) {
      return;
    }
    this.focusSettings();
  }
  updateSettingFirstRowFocusedContext(element) {
    this.settingFirstRowFocused.set(!!element && element === this.settingsTree.navigate().first());
  }
  showContextMenu() {
    const focused = this.settingsTree.getFocus()[0];
    const rowElement = this.focusedSettingDOMElement;
    if (rowElement && focused instanceof SettingsTreeSettingElement) {
      this.settingRenderers.showContextMenu(focused, rowElement);
    }
  }
  focusSearch(filter, selectAll = true) {
    if (filter && this.searchWidget) {
      this.searchWidget.setValue(filter);
    }
    this.searchWidget.focus(selectAll && !this.searchInputDelayer.isTriggered);
  }
  clearSearchResults() {
    this.disableAiSearchToggle();
    this.searchWidget.setValue("");
    this.focusSearch();
  }
  clearSearchFilters() {
    const query = this.searchWidget.getValue();
    const splitQuery = query.split(" ").filter((word) => {
      return word.length && !SettingsEditor2.SUGGESTIONS.some((suggestion) => word.startsWith(suggestion));
    });
    this.searchWidget.setValue(splitQuery.join(" "));
  }
  /**
   * Updates the search input placeholder so that it hints at history navigation
   * (up/down arrows) once the user has search history, similar to the keyboard
   * shortcuts editor.
   */
  updateSearchPlaceholder() {
    const hasHistory = this.searchWidget.getHistory().length > 0;
    this.searchWidget.setPlaceHolder(hasHistory ? searchBoxPlaceholderWithHistory : searchBoxLabel);
  }
  updateInputAriaLabel() {
    let label = searchBoxLabel;
    if (this.searchResultLabel) {
      label += `. ${this.searchResultLabel}`;
    }
    if (this.lastSyncedLabel) {
      label += `. ${this.lastSyncedLabel}`;
    }
    this.searchWidget.updateAriaLabel(label);
  }
  /**
   * Render the header of the Settings editor, which includes the content above the splitview.
   */
  createHeader(parent) {
    this.headerContainer = DOM.append(parent, $(".settings-header"));
    this.searchContainer = DOM.append(this.headerContainer, $(".search-container"));
    const clearInputAction = this._register(new Action(
      SETTINGS_EDITOR_COMMAND_CLEAR_SEARCH_RESULTS,
      localize("clearInput", "Clear Settings Search Input"),
      ThemeIcon.asClassName(preferencesClearInputIcon),
      false,
      async () => this.clearSearchResults()
    ));
    const showAiResultActionClassNames = ["action-label", ThemeIcon.asClassName(preferencesAiResultsIcon)];
    this.showAiResultsAction = this._register(new Action(
      SETTINGS_EDITOR_COMMAND_SHOW_AI_RESULTS,
      SHOW_AI_RESULTS_DISABLED_LABEL,
      showAiResultActionClassNames.join(" "),
      true
    ));
    this._register(this.showAiResultsAction.onDidChange(async () => {
      await this.onDidToggleAiSearch();
    }));
    const filterAction = this._register(new Action(
      SETTINGS_EDITOR_COMMAND_SUGGEST_FILTERS,
      localize("filterInput", "Filter Settings"),
      ThemeIcon.asClassName(preferencesFilterIcon)
    ));
    this.searchWidget = this._register(this.instantiationService.createInstance(SuggestEnabledInputWithHistory, {
      id: `${SettingsEditor2.ID}.searchbox`,
      parent: this.searchContainer,
      ariaLabel: searchBoxLabel,
      resourceHandle: "settingseditor:searchinput" + SettingsEditor2.NUM_INSTANCES++,
      suggestionProvider: {
        triggerCharacters: ["@", ":"],
        provideResults: (query) => {
          const queryParts = query.split(/\s/g);
          if (queryParts[queryParts.length - 1].startsWith(`@${LANGUAGE_SETTING_TAG}`)) {
            const sortedLanguages = this.languageService.getRegisteredLanguageIds().map((languageId) => {
              return `@${LANGUAGE_SETTING_TAG}${languageId} `;
            }).sort();
            return sortedLanguages.filter((langFilter) => !query.includes(langFilter));
          } else if (queryParts[queryParts.length - 1].startsWith(`@${EXTENSION_SETTING_TAG}`)) {
            const installedExtensionsTags = this.installedExtensionIds.map((extensionId) => {
              return `@${EXTENSION_SETTING_TAG}${extensionId} `;
            }).sort();
            return installedExtensionsTags.filter((extFilter) => !query.includes(extFilter));
          } else if (query === "" || queryParts[queryParts.length - 1].startsWith("@")) {
            return SettingsEditor2.SUGGESTIONS.filter((tag) => !query.includes(tag)).map((tag) => tag.endsWith(":") ? tag : tag + " ");
          }
          return [];
        }
      },
      suggestOptions: {
        placeholderText: searchBoxLabel,
        focusContextKey: this.searchFocusContextKey,
        styleOverrides: {
          inputBorder: settingsTextInputBorder
        }
        // TODO: Aria-live
      },
      history: this.loadSearchHistory()
    }));
    this._register(this.searchWidget.onDidFocus(() => {
      this._currentFocusContext = 0 /* Search */;
    }));
    this.updateSearchPlaceholder();
    this._register(this.searchWidget.onInputDidChange(() => {
      const searchVal = this.searchWidget.getValue();
      clearInputAction.enabled = !!searchVal;
      this.searchInputDelayer.trigger(() => this.onSearchInputChanged(true));
    }));
    const headerControlsContainer = DOM.append(this.headerContainer, $(".settings-header-controls"));
    headerControlsContainer.style.borderColor = asCssVariable(settingsHeaderBorder);
    const targetWidgetContainer = DOM.append(headerControlsContainer, $(".settings-target-container"));
    this.settingsTargetsWidget = this._register(this.instantiationService.createInstance(SettingsTargetsWidget, targetWidgetContainer, { enableRemoteSettings: true }));
    this.settingsTargetsWidget.settingsTarget = ConfigurationTarget.USER_LOCAL;
    this._register(this.settingsTargetsWidget.onDidTargetChange((target) => this.onDidSettingsTargetChange(target)));
    this._register(DOM.addDisposableListener(targetWidgetContainer, DOM.EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.keyCode === KeyCode.DownArrow) {
        this.focusSettings();
      }
    }));
    if (this.userDataSyncWorkbenchService.enabled && this.userDataSyncEnablementService.canToggleEnablement()) {
      const syncControls = this._register(this.instantiationService.createInstance(SyncControls, this.window, headerControlsContainer));
      this._register(syncControls.onDidChangeLastSyncedLabel((lastSyncedLabel) => {
        this.lastSyncedLabel = lastSyncedLabel;
        this.updateInputAriaLabel();
      }));
    }
    this.controlsElement = DOM.append(this.searchContainer, DOM.$(".search-container-widgets"));
    this.countElement = DOM.append(this.controlsElement, DOM.$(".settings-count-widget.monaco-count-badge.long"));
    this.searchInputActionBar = this._register(new ActionBar(this.controlsElement, {
      actionViewItemProvider: (action, options) => {
        if (action.id === filterAction.id) {
          return this.instantiationService.createInstance(SettingsSearchFilterDropdownMenuActionViewItem, action, options, this.actionRunner, this.searchWidget);
        }
        if (this.showAiResultsAction && action.id === this.showAiResultsAction.id) {
          const keybindingLabel = this.keybindingService.lookupKeybinding(SETTINGS_EDITOR_COMMAND_TOGGLE_AI_SEARCH)?.getLabel();
          return new ToggleActionViewItem(null, action, { ...options, keybinding: keybindingLabel, toggleStyles: defaultToggleStyles });
        }
        return void 0;
      }
    }));
    const actionsToPush = [clearInputAction, filterAction];
    this.searchInputActionBar.push(actionsToPush, { label: false, icon: true });
    this.disableAiSearchToggle();
    this.updateAiSearchToggleVisibility();
  }
  toggleAiSearch() {
    if (this.searchInputActionBar && this.showAiResultsAction && this.searchInputActionBar.hasAction(this.showAiResultsAction)) {
      if (!this.showAiResultsAction.enabled) {
        aria.status(localize("noAiResults", "No AI results available at this time."));
      }
      this.showAiResultsAction.checked = !this.showAiResultsAction.checked;
    }
  }
  async onDidToggleAiSearch() {
    if (this.searchResultModel && this.showAiResultsAction) {
      this.searchResultModel.showAiResults = this.showAiResultsAction.checked ?? false;
      this.renderResultCountMessages(false);
      this.onDidFinishSearch(true, void 0);
    }
  }
  onDidSettingsTargetChange(target) {
    this.viewState.settingsTarget = target;
    this.onConfigUpdate(void 0, true);
  }
  onDidDismissExtensionSetting(extensionId) {
    if (!this.dismissedExtensionSettings.includes(extensionId)) {
      this.dismissedExtensionSettings.push(extensionId);
    }
    this.storageService.store(
      this.DISMISSED_EXTENSION_SETTINGS_STORAGE_KEY,
      this.dismissedExtensionSettings.join(this.DISMISSED_EXTENSION_SETTINGS_DELIMITER),
      StorageScope.PROFILE,
      StorageTarget.USER
    );
    this.onConfigUpdate(void 0, true);
  }
  onDidClickSetting(evt, recursed) {
    const targetElement = this.currentSettingsModel?.getElementsByName(evt.targetKey)?.[0];
    let revealFailed = false;
    if (targetElement) {
      let sourceTop = 0.5;
      try {
        const _sourceTop = this.settingsTree.getRelativeTop(evt.source);
        if (_sourceTop !== null) {
          sourceTop = _sourceTop;
        }
      } catch {
      }
      if (this.viewState.categoryFilter && evt.source.displayCategory !== targetElement.displayCategory) {
        this.tocTree.setFocus([]);
      }
      try {
        this.settingsTree.reveal(targetElement, sourceTop);
      } catch (_) {
        revealFailed = true;
      }
      if (!revealFailed) {
        setTimeout(() => {
          this.settingsTree.setFocus([targetElement]);
        }, 50);
        const domElements = this.settingRenderers.getDOMElementsForSettingKey(this.settingsTree.getHTMLElement(), evt.targetKey);
        if (domElements && domElements[0]) {
          const control = domElements[0].querySelector(AbstractSettingRenderer.CONTROL_SELECTOR);
          if (control) {
            control.focus();
          }
        }
      }
    }
    if (!recursed && (!targetElement || revealFailed)) {
      const idQuery = `@id:${evt.targetKey}`;
      this.searchWidget.setValue(idQuery);
      this.searchInputDelayer.cancel();
      const p = this.triggerSearch(idQuery, true);
      p.then(() => {
        this.onDidClickSetting(evt, true);
      });
    }
  }
  switchToSettingsFile() {
    const query = parseQuery(this.searchWidget.getValue()).query;
    return this.openSettingsFile({ query });
  }
  async openSettingsFile(options) {
    const currentSettingsTarget = this.settingsTargetsWidget.settingsTarget;
    const openOptions = { jsonEditor: true, groupId: this.group.id, ...options };
    if (currentSettingsTarget === ConfigurationTarget.USER_LOCAL) {
      if (options?.revealSetting) {
        const configurationProperties = Registry.as(Extensions.Configuration).getConfigurationProperties();
        const configurationScope = configurationProperties[options?.revealSetting.key]?.scope;
        if (configurationScope && APPLICATION_SCOPES.includes(configurationScope)) {
          return this.preferencesService.openApplicationSettings(openOptions);
        }
      }
      return this.preferencesService.openUserSettings(openOptions);
    } else if (currentSettingsTarget === ConfigurationTarget.USER_REMOTE) {
      return this.preferencesService.openRemoteSettings(openOptions);
    } else if (currentSettingsTarget === ConfigurationTarget.WORKSPACE) {
      return this.preferencesService.openWorkspaceSettings(openOptions);
    } else if (URI.isUri(currentSettingsTarget)) {
      return this.preferencesService.openFolderSettings({ folderUri: currentSettingsTarget, ...openOptions });
    }
    return void 0;
  }
  createBody(parent) {
    this.bodyContainer = DOM.append(parent, $(".settings-body"));
    this.noResultsMessage = DOM.append(this.bodyContainer, $(".no-results-message"));
    this.noResultsMessage.innerText = localize("noResults", "No Settings Found");
    this.clearFilterLinkContainer = $("span.clear-search-filters");
    this.clearFilterLinkContainer.textContent = " - ";
    const clearFilterLink = DOM.append(this.clearFilterLinkContainer, $("a.pointer.prominent", { tabindex: 0 }, localize("clearSearchFilters", "Clear Filters")));
    this._register(DOM.addDisposableListener(clearFilterLink, DOM.EventType.CLICK, (e) => {
      DOM.EventHelper.stop(e, false);
      this.clearSearchFilters();
    }));
    DOM.append(this.noResultsMessage, this.clearFilterLinkContainer);
    this.noResultsMessage.style.color = asCssVariable(editorForeground);
    this.tocTreeContainer = $(".settings-toc-container");
    this.settingsTreeContainer = $(".settings-tree-container");
    this.createTOC(this.tocTreeContainer);
    this.createSettingsTree(this.settingsTreeContainer);
    this.splitView = this._register(new SplitView(this.bodyContainer, {
      orientation: Orientation.HORIZONTAL,
      proportionalLayout: true
    }));
    const startingWidth = this.storageService.getNumber("settingsEditor2.splitViewWidth", StorageScope.PROFILE, SettingsEditor2.TOC_RESET_WIDTH);
    this.splitView.addView({
      onDidChange: Event.None,
      element: this.tocTreeContainer,
      minimumSize: SettingsEditor2.TOC_MIN_WIDTH,
      maximumSize: Number.POSITIVE_INFINITY,
      layout: (width, _, height) => {
        this.tocTreeContainer.style.width = `${width}px`;
        this.tocTree.layout(height, width);
      }
    }, startingWidth, void 0, true);
    this.splitView.addView({
      onDidChange: Event.None,
      element: this.settingsTreeContainer,
      minimumSize: SettingsEditor2.EDITOR_MIN_WIDTH,
      maximumSize: Number.POSITIVE_INFINITY,
      layout: (width, _, height) => {
        this.settingsTreeContainer.style.width = `${width}px`;
        this.settingsTree.layout(height, width);
      }
    }, Sizing.Distribute, void 0, true);
    this._register(this.splitView.onDidSashReset(() => {
      const totalSize = this.splitView.getViewSize(0) + this.splitView.getViewSize(1);
      this.splitView.resizeView(0, SettingsEditor2.TOC_RESET_WIDTH);
      this.splitView.resizeView(1, totalSize - SettingsEditor2.TOC_RESET_WIDTH);
    }));
    this._register(this.splitView.onDidSashChange(() => {
      const width = this.splitView.getViewSize(0);
      this.storageService.store("settingsEditor2.splitViewWidth", width, StorageScope.PROFILE, StorageTarget.USER);
    }));
    const borderColor = this.theme.getColor(settingsSashBorder);
    this.splitView.style({ separatorBorder: borderColor });
  }
  addCtrlAInterceptor(container) {
    this._register(DOM.addStandardDisposableListener(container, DOM.EventType.KEY_DOWN, (e) => {
      if (e.keyCode === KeyCode.KeyA && (platform.isMacintosh ? e.metaKey : e.ctrlKey) && !DOM.isEditableElement(e.target)) {
        e.browserEvent.stopPropagation();
        e.browserEvent.preventDefault();
      }
    }));
  }
  createTOC(container) {
    this.tocTreeModel = this.instantiationService.createInstance(TOCTreeModel, this.viewState);
    this.tocTree = this._register(this.instantiationService.createInstance(
      TOCTree,
      DOM.append(container, $(".settings-toc-wrapper", {
        "role": "navigation",
        "aria-label": localize("settings", "Settings")
      })),
      this.viewState
    ));
    this.tocTreeDisposed = false;
    this._register(this.tocTree.onDidFocus(() => {
      this._currentFocusContext = 1 /* TableOfContents */;
    }));
    this._register(this.tocTree.onDidChangeFocus((e) => {
      const element = e.elements?.[0] ?? null;
      if (this.tocFocusedElement === element) {
        return;
      }
      this.tocFocusedElement = element;
      this.tocTree.setSelection(element ? [element] : []);
      if (this.viewState.categoryFilter !== element) {
        this.viewState.categoryFilter = element ?? void 0;
        this.renderTree(void 0, true);
        this.settingsTree.scrollTop = 0;
      }
    }));
    this._register(this.tocTree.onDidFocus(() => {
      this.tocRowFocused.set(true);
    }));
    this._register(this.tocTree.onDidBlur(() => {
      this.tocRowFocused.set(false);
    }));
    this._register(this.tocTree.onDidDispose(() => {
      this.tocTreeDisposed = true;
    }));
  }
  applyFilter(filter) {
    if (this.searchWidget && !this.searchWidget.getValue().includes(filter)) {
      const newQuery = `${filter} ${this.searchWidget.getValue().trimStart()}`;
      this.focusSearch(newQuery, false);
    }
  }
  removeLanguageFilters() {
    if (this.searchWidget && this.searchWidget.getValue().includes(`@${LANGUAGE_SETTING_TAG}`)) {
      const query = this.searchWidget.getValue().split(" ");
      const newQuery = query.filter((word) => !word.startsWith(`@${LANGUAGE_SETTING_TAG}`)).join(" ");
      this.focusSearch(newQuery, false);
    }
  }
  createSettingsTree(container) {
    this.settingRenderers = this._register(this.instantiationService.createInstance(SettingTreeRenderers));
    this._register(this.settingRenderers.onDidChangeSetting((e) => this.onDidChangeSetting(e.key, e.value, e.type, e.manualReset, e.scope)));
    this._register(this.settingRenderers.onDidDismissExtensionSetting((e) => this.onDidDismissExtensionSetting(e)));
    this._register(this.settingRenderers.onDidOpenSettings((settingKey) => {
      this.openSettingsFile({ revealSetting: { key: settingKey, edit: true } });
    }));
    this._register(this.settingRenderers.onDidClickSettingLink((settingName) => this.onDidClickSetting(settingName)));
    this._register(this.settingRenderers.onDidFocusSetting((element) => {
      this.settingsTree.setFocus([element]);
      this._currentFocusContext = 3 /* SettingControl */;
      this.settingRowFocused.set(false);
    }));
    this._register(this.settingRenderers.onDidChangeSettingHeight((params) => {
      const { element, height } = params;
      try {
        this.settingsTree.updateElementHeight(element, height);
      } catch (e) {
      }
    }));
    this._register(this.settingRenderers.onApplyFilter((filter) => this.applyFilter(filter)));
    this._register(this.settingRenderers.onDidClickOverrideElement((element) => {
      this.removeLanguageFilters();
      if (element.language) {
        this.applyFilter(`@${LANGUAGE_SETTING_TAG}${element.language}`);
      }
      if (element.scope === "workspace") {
        this.settingsTargetsWidget.updateTarget(ConfigurationTarget.WORKSPACE);
      } else if (element.scope === "user") {
        this.settingsTargetsWidget.updateTarget(ConfigurationTarget.USER_LOCAL);
      } else if (element.scope === "remote") {
        this.settingsTargetsWidget.updateTarget(ConfigurationTarget.USER_REMOTE);
      }
      this.applyFilter(`@${ID_SETTING_TAG}${element.settingKey}`);
    }));
    this.settingsTree = this._register(this.instantiationService.createInstance(
      SettingsTree,
      container,
      this.viewState,
      this.settingRenderers.allRenderers
    ));
    this._register(this.settingsTree.onDidScroll(() => {
      if (this.settingsTree.scrollTop === this.settingsTreeScrollTop) {
        return;
      }
      this.settingsTreeScrollTop = this.settingsTree.scrollTop;
      setTimeout(() => {
        this.updateTreeScrollSync();
      }, 0);
    }));
    this._register(this.settingsTree.onDidFocus(() => {
      const classList = container.ownerDocument.activeElement?.classList;
      if (classList && classList.contains("monaco-list") && classList.contains("settings-editor-tree")) {
        this._currentFocusContext = 2 /* SettingTree */;
        this.settingRowFocused.set(true);
        this.treeFocusedElement ??= this.settingsTree.firstVisibleElement ?? null;
        if (this.treeFocusedElement) {
          this.treeFocusedElement.tabbable = true;
        }
        this.updateSettingFirstRowFocusedContext(this.treeFocusedElement);
      }
    }));
    this._register(this.settingsTree.onDidBlur(() => {
      this.settingRowFocused.set(false);
      this.settingFirstRowFocused.set(false);
      this.treeFocusedElement = null;
    }));
    this._register(this.settingsTree.onDidChangeFocus((e) => {
      const element = e.elements[0];
      this.updateSettingFirstRowFocusedContext(element ?? null);
      if (this.treeFocusedElement === element) {
        return;
      }
      if (this.treeFocusedElement) {
        this.treeFocusedElement.tabbable = false;
      }
      this.treeFocusedElement = element;
      if (this.treeFocusedElement) {
        this.treeFocusedElement.tabbable = true;
      }
      this.settingsTree.setSelection(element ? [element] : []);
    }));
  }
  onDidChangeSetting(key, value, type, manualReset, scope) {
    const parsedQuery = parseQuery(this.searchWidget.getValue());
    const languageFilter = parsedQuery.languageFilter;
    if (manualReset || this.pendingSettingUpdate && this.pendingSettingUpdate.key !== key) {
      this.updateChangedSetting(key, value, manualReset, languageFilter, scope);
    }
    this.pendingSettingUpdate = { key, value, languageFilter };
    if (SettingsEditor2.shouldSettingUpdateFast(type)) {
      this.settingFastUpdateDelayer.trigger(() => this.updateChangedSetting(key, value, manualReset, languageFilter, scope));
    } else {
      this.settingSlowUpdateDelayer.trigger(() => this.updateChangedSetting(key, value, manualReset, languageFilter, scope));
    }
  }
  updateTreeScrollSync() {
    this.settingRenderers.cancelSuggesters();
  }
  updateChangedSetting(key, value, manualReset, languageFilter, scope) {
    const settingsTarget = this.settingsTargetsWidget.settingsTarget;
    const resource = URI.isUri(settingsTarget) ? settingsTarget : void 0;
    const configurationTarget = (resource ? ConfigurationTarget.WORKSPACE_FOLDER : settingsTarget) ?? ConfigurationTarget.USER_LOCAL;
    const overrides = { resource, overrideIdentifiers: languageFilter ? [languageFilter] : void 0 };
    const configurationTargetIsWorkspace = configurationTarget === ConfigurationTarget.WORKSPACE || configurationTarget === ConfigurationTarget.WORKSPACE_FOLDER;
    const userPassedInManualReset = configurationTargetIsWorkspace || !!languageFilter;
    const isManualReset = userPassedInManualReset ? manualReset : value === void 0;
    const inspected = this.configurationService.inspect(key, overrides);
    if (!userPassedInManualReset && inspected.defaultValue === value) {
      value = void 0;
    }
    return this.configurationService.updateValue(key, value, overrides, configurationTarget, { handleDirtyFile: "save" }).then(() => {
      const query = this.searchWidget.getValue();
      if (query.includes(`@${MODIFIED_SETTING_TAG}`)) {
        this.refreshTOCTree();
      }
      this.renderTree(key, isManualReset);
      this.pendingSettingUpdate = null;
      const reportModifiedProps = {
        key,
        query,
        searchResults: this.searchResultModel?.getUniqueSearchResults() ?? null,
        rawResults: this.searchResultModel?.getRawResults() ?? null,
        showConfiguredOnly: !!this.viewState.tagFilters && this.viewState.tagFilters.has(MODIFIED_SETTING_TAG),
        isReset: typeof value === "undefined",
        settingsTarget: this.settingsTargetsWidget.settingsTarget
      };
      return this.reportModifiedSetting(reportModifiedProps);
    });
  }
  reportModifiedSetting(props) {
    let groupId = void 0;
    let providerName = void 0;
    let nlpIndex = void 0;
    let displayIndex = void 0;
    if (props.searchResults) {
      displayIndex = props.searchResults.filterMatches.findIndex((m) => m.setting.key === props.key);
      if (this.searchResultModel) {
        providerName = props.searchResults.filterMatches.find((m) => m.setting.key === props.key)?.providerName;
        const rawResults = this.searchResultModel.getRawResults();
        if (rawResults[SearchResultIdx.Local] && displayIndex >= 0) {
          const settingInLocalResults = rawResults[SearchResultIdx.Local].filterMatches.some((m) => m.setting.key === props.key);
          groupId = settingInLocalResults ? "local" : "remote";
        }
        if (rawResults[SearchResultIdx.Remote]) {
          const _nlpIndex = rawResults[SearchResultIdx.Remote].filterMatches.findIndex((m) => m.setting.key === props.key);
          nlpIndex = _nlpIndex >= 0 ? _nlpIndex : void 0;
        }
      }
    }
    const reportedTarget = props.settingsTarget === ConfigurationTarget.USER_LOCAL ? "user" : props.settingsTarget === ConfigurationTarget.USER_REMOTE ? "user_remote" : props.settingsTarget === ConfigurationTarget.WORKSPACE ? "workspace" : "folder";
    const data = {
      key: props.key,
      groupId,
      providerName,
      nlpIndex,
      displayIndex,
      showConfiguredOnly: props.showConfiguredOnly,
      isReset: props.isReset,
      target: reportedTarget
    };
    this.telemetryService.publicLog2("settingsEditor.settingModified", data);
  }
  scheduleRefresh(element, key = "") {
    if (key && this.scheduledRefreshes.has(key)) {
      return;
    }
    if (!key) {
      dispose(this.scheduledRefreshes.values());
      this.scheduledRefreshes.clear();
    }
    const store = new DisposableStore();
    const scheduledRefreshTracker = DOM.trackFocus(element);
    store.add(scheduledRefreshTracker);
    store.add(scheduledRefreshTracker.onDidBlur(() => {
      this.scheduledRefreshes.get(key)?.dispose();
      this.scheduledRefreshes.delete(key);
      this.onConfigUpdate(/* @__PURE__ */ new Set([key]));
    }));
    this.scheduledRefreshes.set(key, store);
  }
  createSettingsOrderByTocIndex(resolvedSettingsRoot) {
    const index = /* @__PURE__ */ new Map();
    function indexSettings(resolvedSettingsRoot2, counter = 0) {
      if (resolvedSettingsRoot2.settings) {
        for (const setting of resolvedSettingsRoot2.settings) {
          if (!index.has(setting.key)) {
            index.set(setting.key, counter++);
          }
        }
      }
      if (resolvedSettingsRoot2.children) {
        for (const child of resolvedSettingsRoot2.children) {
          counter = indexSettings(child, counter);
        }
      }
      return counter;
    }
    indexSettings(resolvedSettingsRoot);
    return index;
  }
  refreshModels(resolvedSettingsRoot) {
    this.settingsTreeModel.value.update(resolvedSettingsRoot);
    this.tocTreeModel.settingsTreeRoot = this.settingsTreeModel.value.root;
    this.settingsOrderByTocIndex = this.createSettingsOrderByTocIndex(resolvedSettingsRoot);
  }
  async onConfigUpdate(keys, forceRefresh = false, triggerSearch = false) {
    if (keys && this.settingsTreeModel) {
      return this.updateElementsByKey(keys);
    }
    if (!this.defaultSettingsEditorModel) {
      return;
    }
    const groups = this.defaultSettingsEditorModel.settingsGroups.slice(1);
    const coreSettingsGroups = [], extensionSettingsGroups = [];
    for (const group of groups) {
      if (group.extensionInfo) {
        extensionSettingsGroups.push(group);
      } else {
        coreSettingsGroups.push(group);
      }
    }
    const filter = this.canShowAdvancedSettings() ? void 0 : { exclude: { tags: [ADVANCED_SETTING_TAG] } };
    const settingsResult = resolveSettingsTree(tocData, coreSettingsGroups, filter, this.logService);
    const resolvedSettingsRoot = settingsResult.tree;
    if (settingsResult.leftoverSettings.size && !this.hasWarnedMissingSettings) {
      const settingKeyList = [];
      settingsResult.leftoverSettings.forEach((s) => {
        settingKeyList.push(s.key);
      });
      this.logService.warn(`SettingsEditor2: Settings not included in settingsLayout.ts: ${settingKeyList.join(", ")}`);
      this.hasWarnedMissingSettings = true;
    }
    const additionalGroups = [];
    let setAdditionalGroups = false;
    const toggleData = await getExperimentalExtensionToggleData(this.chatEntitlementService, this.extensionGalleryService, this.productService);
    if (toggleData && groups.filter((g) => g.extensionInfo).length && Object.keys(toggleData.settingsEditorRecommendedExtensions).length) {
      await this.refreshInstalledExtensionsList();
      for (const key in toggleData.settingsEditorRecommendedExtensions) {
        const extension = toggleData.recommendedExtensionsGalleryInfo[key];
        if (!extension) {
          continue;
        }
        const extensionId = extension.identifier.id;
        const extensionInstalled = this.installedExtensionIds.includes(extensionId);
        const matchingGroupIndex = groups.findIndex(
          (g) => g.extensionInfo && g.extensionInfo.id.toLowerCase() === extensionId.toLowerCase() && g.sections.length === 1 && g.sections[0].settings.length === 1 && g.sections[0].settings[0].displayExtensionId
        );
        if (extensionInstalled || this.dismissedExtensionSettings.includes(extensionId)) {
          if (matchingGroupIndex !== -1) {
            groups.splice(matchingGroupIndex, 1);
            setAdditionalGroups = true;
          }
          continue;
        }
        if (matchingGroupIndex !== -1) {
          continue;
        }
        let manifest = null;
        try {
          manifest = await raceTimeout(
            this.extensionGalleryService.getManifest(extension, CancellationToken.None),
            EXTENSION_FETCH_TIMEOUT_MS
          ) ?? null;
        } catch (e) {
          continue;
        }
        if (manifest === null) {
          continue;
        }
        const contributesConfiguration = manifest?.contributes?.configuration;
        let groupTitle;
        if (!Array.isArray(contributesConfiguration)) {
          groupTitle = contributesConfiguration?.title;
        } else if (contributesConfiguration.length === 1) {
          groupTitle = contributesConfiguration[0].title;
        }
        const recommendationInfo = toggleData.settingsEditorRecommendedExtensions[key];
        const extensionName = extension.displayName ?? extension.name ?? extensionId;
        const settingKey = `${key}.manageExtension`;
        const setting = {
          range: nullRange,
          key: settingKey,
          keyRange: nullRange,
          value: null,
          valueRange: nullRange,
          description: [recommendationInfo.onSettingsEditorOpen?.descriptionOverride ?? extension.description],
          descriptionIsMarkdown: false,
          descriptionRanges: [],
          scope: ConfigurationScope.WINDOW,
          type: "null",
          displayExtensionId: extensionId,
          extensionGroupTitle: groupTitle ?? extensionName,
          categoryLabel: "Extensions",
          title: extensionName
        };
        const additionalGroup = {
          sections: [{
            settings: [setting]
          }],
          id: extensionId,
          title: setting.extensionGroupTitle,
          titleRange: nullRange,
          range: nullRange,
          extensionInfo: {
            id: extensionId,
            displayName: extension.displayName
          }
        };
        groups.push(additionalGroup);
        additionalGroups.push(additionalGroup);
        setAdditionalGroups = true;
      }
    }
    resolvedSettingsRoot.children.push(await createTocTreeForExtensionSettings(this.extensionService, extensionSettingsGroups, filter));
    resolvedSettingsRoot.children.unshift(getCommonlyUsedData(groups));
    if (toggleData && setAdditionalGroups) {
      this.defaultSettingsEditorModel.setAdditionalGroups(additionalGroups);
    }
    if (!this.workspaceTrustManagementService.isWorkspaceTrusted() && (this.viewState.settingsTarget instanceof URI || this.viewState.settingsTarget === ConfigurationTarget.WORKSPACE)) {
      const configuredUntrustedWorkspaceSettings = resolveConfiguredUntrustedSettings(groups, this.viewState.settingsTarget, this.viewState.languageFilter, this.configurationService);
      if (configuredUntrustedWorkspaceSettings.length) {
        resolvedSettingsRoot.children.unshift({
          id: "workspaceTrust",
          label: localize("settings require trust", "Workspace Trust"),
          settings: configuredUntrustedWorkspaceSettings
        });
      }
    }
    this.searchResultModel?.updateChildren();
    const firstVisibleElement = this.settingsTree.firstVisibleElement;
    let anchorId;
    if (firstVisibleElement instanceof SettingsTreeSettingElement) {
      anchorId = firstVisibleElement.setting.key;
    } else if (firstVisibleElement instanceof SettingsTreeGroupElement) {
      anchorId = firstVisibleElement.id;
    }
    if (this.settingsTreeModel.value) {
      this.refreshModels(resolvedSettingsRoot);
      if (triggerSearch && this.searchResultModel) {
        return await this.onSearchInputChanged(false);
      }
      this.refreshTOCTree();
      this.renderTree(void 0, forceRefresh);
      if (anchorId) {
        const newModel = this.settingsTreeModel.value;
        let newElement;
        const settings = newModel.getElementsByName(anchorId);
        if (settings && settings.length > 0) {
          newElement = settings[0];
        } else {
          const findGroup = (roots) => {
            for (const g of roots) {
              if (g.id === anchorId) {
                return g;
              }
              if (g.children) {
                for (const child of g.children) {
                  if (child instanceof SettingsTreeGroupElement) {
                    const found = findGroup([child]);
                    if (found) {
                      return found;
                    }
                  }
                }
              }
            }
            return void 0;
          };
          newElement = findGroup([newModel.root]);
        }
        if (newElement) {
          try {
            this.settingsTree.reveal(newElement, 0);
          } catch (e) {
          }
        }
      }
    } else {
      this.settingsTreeModel.value = this.instantiationService.createInstance(SettingsTreeModel, this.viewState, this.workspaceTrustManagementService.isWorkspaceTrusted());
      this.refreshModels(resolvedSettingsRoot);
      const cachedState = !this.viewState.query ? this.restoreCachedState() : void 0;
      if (cachedState?.searchQuery || this.searchWidget.getValue()) {
        await this.onSearchInputChanged(true);
      } else {
        this.refreshTOCTree();
        const rootChildren = this.settingsTreeModel.value.root.children;
        if (Array.isArray(rootChildren) && rootChildren.length > 0) {
          const firstCategory = rootChildren[0];
          if (firstCategory instanceof SettingsTreeGroupElement) {
            this.viewState.categoryFilter = firstCategory;
            this.tocTree.setFocus([firstCategory]);
            this.tocTree.setSelection([firstCategory]);
          }
        }
        this.refreshTree();
        this.tocTree.collapseAll();
      }
    }
  }
  updateElementsByKey(keys) {
    if (keys.size) {
      if (this.searchResultModel) {
        keys.forEach((key) => this.searchResultModel.updateElementsByName(key));
      }
      if (this.settingsTreeModel.value) {
        keys.forEach((key) => this.settingsTreeModel.value.updateElementsByName(key));
      }
      keys.forEach((key) => this.renderTree(key));
    } else {
      this.renderTree();
    }
  }
  getActiveControlInSettingsTree() {
    const element = this.settingsTree.getHTMLElement();
    const activeElement = element.ownerDocument.activeElement;
    return activeElement && DOM.isAncestorOfActiveElement(element) ? activeElement : null;
  }
  renderTree(key, force = false) {
    if (!force && key && this.scheduledRefreshes.has(key)) {
      this.updateModifiedLabelForKey(key);
      return;
    }
    if (this.contextViewFocused()) {
      const element = this.window.document.querySelector(".context-view");
      if (element) {
        this.scheduleRefresh(element, key);
      }
      return;
    }
    const activeElement = this.getActiveControlInSettingsTree();
    const focusedSetting = activeElement && this.settingRenderers.getSettingDOMElementForDOMElement(activeElement);
    if (focusedSetting && !force) {
      if (key) {
        const focusedKey = focusedSetting.getAttribute(AbstractSettingRenderer.SETTING_KEY_ATTR);
        if (focusedKey === key && // update `list`s live, as they have a separate "submit edit" step built in before this
        (focusedSetting.parentElement && !focusedSetting.parentElement.classList.contains("setting-item-list"))) {
          this.updateModifiedLabelForKey(key);
          this.scheduleRefresh(focusedSetting, key);
          return;
        }
      } else {
        this.scheduleRefresh(focusedSetting);
        return;
      }
    }
    this.renderResultCountMessages(false);
    if (key) {
      const elements = this.currentSettingsModel?.getElementsByName(key);
      if (elements?.length) {
        if (elements.length >= 2) {
          console.warn("More than one setting with key " + key + " found");
        }
        this.refreshSingleElement(elements[0]);
      } else {
        return;
      }
    } else {
      this.refreshTree();
    }
    return;
  }
  contextViewFocused() {
    return !!DOM.findParentWithClass(this.rootElement.ownerDocument.activeElement, "context-view");
  }
  refreshSingleElement(element) {
    if (this.isVisible() && this.settingsTree.hasElement(element) && (!element.setting.deprecationMessage || element.isConfigured)) {
      this.settingsTree.rerender(element);
    }
  }
  refreshTree() {
    if (this.isVisible() && this.currentSettingsModel) {
      this.settingsTree.setChildren(null, createGroupIterator(this.currentSettingsModel.root));
    }
  }
  refreshTOCTree() {
    if (this.isVisible()) {
      this.tocTreeModel.update();
      this.tocTree.setChildren(null, createTOCIterator(this.tocTreeModel, this.tocTree));
    }
  }
  updateModifiedLabelForKey(key) {
    if (!this.currentSettingsModel) {
      return;
    }
    const dataElements = this.currentSettingsModel.getElementsByName(key);
    const isModified = dataElements && dataElements[0] && dataElements[0].isConfigured;
    const elements = this.settingRenderers.getDOMElementsForSettingKey(this.settingsTree.getHTMLElement(), key);
    if (elements && elements[0]) {
      elements[0].classList.toggle("is-configured", !!isModified);
    }
  }
  async onSearchInputChanged(expandResults) {
    if (!this.currentSettingsModel) {
      return;
    }
    const query = this.searchWidget.getValue().trim();
    this.viewState.query = query;
    if (query) {
      this.searchWidget.addToHistory();
      this.updateSearchPlaceholder();
      this.saveSearchHistory();
    }
    await this.triggerSearch(query.replace(/\u203A/g, " "), expandResults);
  }
  loadSearchHistory() {
    const raw = this.storageService.get(this.SEARCH_HISTORY_STORAGE_KEY, StorageScope.PROFILE);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === "string") : [];
    } catch {
      return [];
    }
  }
  saveSearchHistory() {
    if (!this.searchWidget) {
      return;
    }
    const history = this.searchWidget.getHistory();
    if (history.length) {
      this.storageService.store(this.SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(history), StorageScope.PROFILE, StorageTarget.MACHINE);
    } else {
      this.storageService.remove(this.SEARCH_HISTORY_STORAGE_KEY, StorageScope.PROFILE);
    }
  }
  parseSettingFromJSON(query) {
    const match = query.match(/"([a-zA-Z.]+)": /);
    return match && match[1];
  }
  /**
   * Toggles the visibility of the Settings editor table of contents during a search
   * depending on the behavior.
   */
  toggleTocBySearchBehaviorType() {
    const tocBehavior = this.configurationService.getValue(SEARCH_TOC_BEHAVIOR_KEY);
    const hideToc = tocBehavior === "hide";
    if (hideToc) {
      this.splitView.setViewVisible(0, false);
      this.splitView.style({
        separatorBorder: Color.transparent
      });
    } else {
      this.layoutSplitView(this.dimension);
    }
  }
  async triggerSearch(query, expandResults) {
    const progressRunner = this.editorProgressService.show(true, 800);
    const showAdvanced = this.viewState.tagFilters?.has(ADVANCED_SETTING_TAG);
    this.viewState.tagFilters = /* @__PURE__ */ new Set();
    this.viewState.extensionFilters = /* @__PURE__ */ new Set();
    this.viewState.featureFilters = /* @__PURE__ */ new Set();
    this.viewState.idFilters = /* @__PURE__ */ new Set();
    this.viewState.languageFilter = void 0;
    if (query) {
      const parsedQuery = parseQuery(query);
      query = parsedQuery.query;
      parsedQuery.tags.forEach((tag) => this.viewState.tagFilters.add(tag));
      parsedQuery.extensionFilters.forEach((extensionId) => this.viewState.extensionFilters.add(extensionId));
      parsedQuery.featureFilters.forEach((feature) => this.viewState.featureFilters.add(feature));
      parsedQuery.idFilters.forEach((id) => this.viewState.idFilters.add(id));
      this.viewState.languageFilter = parsedQuery.languageFilter;
    }
    if (showAdvanced !== this.viewState.tagFilters?.has(ADVANCED_SETTING_TAG)) {
      await this.onConfigUpdate();
    }
    this.settingsTargetsWidget.updateLanguageFilterIndicators(this.viewState.languageFilter);
    if (query && query !== "@") {
      query = this.parseSettingFromJSON(query) || query;
      await this.triggerFilterPreferences(query, expandResults, progressRunner);
      this.toggleTocBySearchBehaviorType();
    } else {
      if (this.viewState.tagFilters.size || this.viewState.extensionFilters.size || this.viewState.featureFilters.size || this.viewState.idFilters.size || this.viewState.languageFilter) {
        this.searchResultModel = this.createFilterModel();
      } else {
        this.searchResultModel = null;
      }
      this.searchDelayer.cancel();
      if (this.searchInProgress) {
        this.searchInProgress.dispose(true);
        this.searchInProgress = null;
      }
      if (expandResults) {
        this.tocTree.setFocus([]);
        this.viewState.categoryFilter = void 0;
      }
      this.tocTreeModel.currentSearchModel = this.searchResultModel;
      this.renderedSearchQuery = this.viewState.query;
      if (this.searchResultModel) {
        if (expandResults) {
          this.tocTree.setSelection([]);
          this.tocTree.expandAll();
        }
        this.refreshTOCTree();
        this.renderResultCountMessages(false);
        this.refreshTree();
        this.toggleTocBySearchBehaviorType();
      } else if (!this.tocTreeDisposed) {
        this.tocTree.collapseAll();
        this.refreshTOCTree();
        this.renderResultCountMessages(false);
        this.refreshTree();
        this.layoutSplitView(this.dimension);
      }
      progressRunner.done();
    }
  }
  /**
   * Return a fake SearchResultModel which can hold a flat list of all settings, to be filtered (@modified etc)
   */
  createFilterModel() {
    const filterModel = this.instantiationService.createInstance(SearchResultModel, this.viewState, this.settingsOrderByTocIndex, this.workspaceTrustManagementService.isWorkspaceTrusted());
    const fullResult = {
      filterMatches: [],
      exactMatch: false
    };
    const shouldShowAdvanced = this.canShowAdvancedSettings();
    for (const g of this.defaultSettingsEditorModel.settingsGroups.slice(1)) {
      for (const sect of g.sections) {
        for (const setting of sect.settings) {
          if (!shouldShowAdvanced && !this.shouldShowSetting(setting)) {
            continue;
          }
          fullResult.filterMatches.push({
            setting,
            matches: [],
            matchType: SettingMatchType.None,
            keyMatchScore: 0,
            score: 0,
            providerName: FILTER_MODEL_SEARCH_PROVIDER_NAME
          });
        }
      }
    }
    filterModel.setResult(0, fullResult);
    return filterModel;
  }
  async triggerFilterPreferences(query, expandResults, progressRunner) {
    if (this.searchInProgress) {
      this.searchInProgress.dispose(true);
      this.searchInProgress = null;
    }
    const searchInProgress = this.searchInProgress = new CancellationTokenSource();
    return this.searchDelayer.trigger(async () => {
      if (searchInProgress.token.isCancellationRequested) {
        return;
      }
      this.disableAiSearchToggle();
      const localResults = await this.doLocalSearch(query, searchInProgress.token);
      if (!this.searchResultModel || searchInProgress.token.isCancellationRequested) {
        return;
      }
      this.searchResultModel.showAiResults = false;
      if (localResults && localResults.filterMatches.length > 0) {
        this.onDidFinishSearch(expandResults, void 0);
      }
      if (!localResults || !localResults.exactMatch) {
        await this.doRemoteSearch(query, searchInProgress.token);
      }
      if (searchInProgress.token.isCancellationRequested) {
        return;
      }
      if (this.aiSearchPromise) {
        this.aiSearchPromise.cancel();
      }
      if (this.searchInputActionBar && this.showAiResultsAction && this.searchInputActionBar.hasAction(this.showAiResultsAction)) {
        this.aiSearchPromise = createCancelablePromise((token) => {
          return this.doAiSearch(query, token).then((results) => {
            if (results && this.showAiResultsAction) {
              this.showAiResultsAction.enabled = true;
              this.aiResultsAvailable.set(true);
              this.showAiResultsAction.label = SHOW_AI_RESULTS_ENABLED_LABEL;
              this.renderResultCountMessages(true);
            }
          }).catch((e) => {
            if (!isCancellationError(e)) {
              this.logService.trace("Error during AI settings search:", e);
            }
          });
        });
      }
      this.onDidFinishSearch(expandResults, progressRunner);
    });
  }
  onDidFinishSearch(expandResults, progressRunner) {
    this.tocTreeModel.currentSearchModel = this.searchResultModel;
    this.renderedSearchQuery = this.viewState.query;
    if (expandResults) {
      this.tocTree.setFocus([]);
      this.viewState.categoryFilter = void 0;
      this.tocTree.expandAll();
      this.settingsTree.scrollTop = 0;
    }
    this.refreshTOCTree();
    this.renderTree(void 0, true);
    progressRunner?.done();
  }
  doLocalSearch(query, token) {
    const localSearchProvider = this.preferencesSearchService.getLocalSearchProvider(query);
    return this.searchWithProvider(SearchResultIdx.Local, localSearchProvider, STRING_MATCH_SEARCH_PROVIDER_NAME, token);
  }
  doRemoteSearch(query, token) {
    const remoteSearchProvider = this.preferencesSearchService.getRemoteSearchProvider(query);
    if (!remoteSearchProvider) {
      return Promise.resolve(null);
    }
    return this.searchWithProvider(SearchResultIdx.Remote, remoteSearchProvider, TF_IDF_SEARCH_PROVIDER_NAME, token);
  }
  async doAiSearch(query, token) {
    const aiSearchProvider = this.preferencesSearchService.getAiSearchProvider(query);
    if (!aiSearchProvider) {
      return null;
    }
    const embeddingsResults = await this.searchWithProvider(SearchResultIdx.Embeddings, aiSearchProvider, EMBEDDINGS_SEARCH_PROVIDER_NAME, token);
    if (!embeddingsResults || token.isCancellationRequested) {
      return null;
    }
    const llmResults = await this.getLLMRankedResults(query, token);
    if (token.isCancellationRequested) {
      return null;
    }
    return {
      filterMatches: embeddingsResults.filterMatches.concat(llmResults?.filterMatches ?? []),
      exactMatch: false
    };
  }
  async getLLMRankedResults(query, token) {
    const aiSearchProvider = this.preferencesSearchService.getAiSearchProvider(query);
    if (!aiSearchProvider) {
      return null;
    }
    const stopWatch = new StopWatch(false);
    const result = await aiSearchProvider.getLLMRankedResults(token);
    stopWatch.stop();
    if (token.isCancellationRequested) {
      return null;
    }
    if (result && result.filterMatches.length > 0) {
      const elapsed = stopWatch.elapsed();
      this.logSearchPerformance(LLM_RANKED_SEARCH_PROVIDER_NAME, elapsed);
    }
    this.searchResultModel.setResult(SearchResultIdx.AiSelected, result);
    return result;
  }
  async searchWithProvider(type, searchProvider, providerName, token) {
    const stopWatch = new StopWatch(false);
    const result = await this._searchPreferencesModel(this.defaultSettingsEditorModel, searchProvider, token);
    stopWatch.stop();
    if (token.isCancellationRequested) {
      return null;
    }
    if (result && !this.canShowAdvancedSettings()) {
      result.filterMatches = result.filterMatches.filter((match) => this.shouldShowSetting(match.setting));
    }
    if (result && result.filterMatches.length > 0) {
      const elapsed = stopWatch.elapsed();
      this.logSearchPerformance(providerName, elapsed);
    }
    this.searchResultModel ??= this.instantiationService.createInstance(SearchResultModel, this.viewState, this.settingsOrderByTocIndex, this.workspaceTrustManagementService.isWorkspaceTrusted());
    this.searchResultModel.setResult(type, result);
    return result;
  }
  logSearchPerformance(providerName, elapsed) {
    this.telemetryService.publicLog2("settingsEditor.searchPerformance", {
      providerName,
      elapsedMs: elapsed
    });
  }
  renderResultCountMessages(showAiResultsMessage) {
    if (!this.currentSettingsModel) {
      return;
    }
    this.clearFilterLinkContainer.style.display = this.viewState.tagFilters && this.viewState.tagFilters.size > 0 ? "initial" : "none";
    if (!this.searchResultModel) {
      if (this.countElement.style.display !== "none") {
        this.searchResultLabel = null;
        this.updateInputAriaLabel();
        this.countElement.style.display = "none";
        this.countElement.innerText = "";
        this.layout(this.dimension);
      }
      this.rootElement.classList.remove("no-results");
      this.splitView.el.style.visibility = "visible";
      return;
    } else {
      const count = this.searchResultModel.getUniqueResultsCount();
      let resultString;
      if (showAiResultsMessage) {
        switch (count) {
          case 0:
            resultString = localize("noResultsWithAiAvailable", "No Settings Found. AI Results Available");
            break;
          case 1:
            resultString = localize("oneResultWithAiAvailable", "1 Setting Found. AI Results Available");
            break;
          default:
            resultString = localize("moreThanOneResultWithAiAvailable", "{0} Settings Found. AI Results Available", count);
        }
      } else {
        switch (count) {
          case 0:
            resultString = localize("noResults", "No Settings Found");
            break;
          case 1:
            resultString = localize("oneResult", "1 Setting Found");
            break;
          default:
            resultString = localize("moreThanOneResult", "{0} Settings Found", count);
        }
      }
      this.searchResultLabel = resultString;
      this.updateInputAriaLabel();
      this.countElement.innerText = resultString;
      aria.status(resultString);
      if (this.countElement.style.display !== "block") {
        this.countElement.style.display = "block";
      }
      this.layout(this.dimension);
      this.rootElement.classList.toggle("no-results", count === 0);
      this.splitView.el.style.visibility = count === 0 ? "hidden" : "visible";
    }
  }
  async _searchPreferencesModel(model, provider, token) {
    try {
      return await provider.searchModel(model, token);
    } catch (err) {
      if (isCancellationError(err)) {
        return Promise.reject(err);
      } else {
        return null;
      }
    }
  }
  layoutSplitView(dimension) {
    if (!this.isVisible()) {
      return;
    }
    const listHeight = dimension.height - (72 + 11 + 14);
    this.splitView.el.style.height = `${listHeight}px`;
    this.splitView.layout(this.bodyContainer.clientWidth, listHeight);
    const tocBehavior = this.configurationService.getValue(SEARCH_TOC_BEHAVIOR_KEY);
    const hideTocForSearch = tocBehavior === "hide" && this.searchResultModel;
    if (!hideTocForSearch) {
      const firstViewWasVisible = this.splitView.isViewVisible(0);
      const firstViewVisible = this.bodyContainer.clientWidth >= SettingsEditor2.NARROW_TOTAL_WIDTH;
      this.splitView.setViewVisible(0, firstViewVisible);
      if (!firstViewWasVisible && firstViewVisible && this.bodyContainer.clientWidth >= SettingsEditor2.EDITOR_MIN_WIDTH + SettingsEditor2.TOC_RESET_WIDTH) {
        this.splitView.resizeView(0, SettingsEditor2.TOC_RESET_WIDTH);
      }
      this.splitView.style({
        separatorBorder: firstViewVisible ? this.theme.getColor(settingsSashBorder) : Color.transparent
      });
    }
  }
  saveState() {
    this.saveSearchHistory();
    if (this.isVisible()) {
      const searchQuery = this.searchWidget.getValue().trim();
      const target = this.settingsTargetsWidget.settingsTarget;
      if (this.input) {
        this.editorMemento.saveEditorState(this.group, this.input, { searchQuery, target });
      }
    } else if (this.input) {
      this.editorMemento.clearEditorState(this.input, this.group);
    }
    super.saveState();
  }
};
SettingsEditor2 = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IWorkbenchConfigurationService),
  __decorateParam(3, ITextResourceConfigurationService),
  __decorateParam(4, IThemeService),
  __decorateParam(5, IPreferencesService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IPreferencesSearchService),
  __decorateParam(8, ILogService),
  __decorateParam(9, IContextKeyService),
  __decorateParam(10, IStorageService),
  __decorateParam(11, IEditorGroupsService),
  __decorateParam(12, IUserDataSyncWorkbenchService),
  __decorateParam(13, IUserDataSyncEnablementService),
  __decorateParam(14, IWorkspaceTrustManagementService),
  __decorateParam(15, IExtensionService),
  __decorateParam(16, ILanguageService),
  __decorateParam(17, IExtensionManagementService),
  __decorateParam(18, IProductService),
  __decorateParam(19, IExtensionGalleryService),
  __decorateParam(20, IEditorProgressService),
  __decorateParam(21, IUserDataProfileService),
  __decorateParam(22, IKeybindingService),
  __decorateParam(23, IChatEntitlementService),
  __decorateParam(24, IWorkbenchEnvironmentService)
], SettingsEditor2);
let SyncControls = class extends Disposable {
  constructor(window, container, commandService, userDataSyncService, userDataSyncEnablementService, telemetryService) {
    super();
    this.commandService = commandService;
    this.userDataSyncService = userDataSyncService;
    this.userDataSyncEnablementService = userDataSyncEnablementService;
    this._onDidChangeLastSyncedLabel = this._register(new Emitter());
    this.onDidChangeLastSyncedLabel = this._onDidChangeLastSyncedLabel.event;
    const headerRightControlsContainer = DOM.append(container, $(".settings-right-controls"));
    const turnOnSyncButtonContainer = DOM.append(headerRightControlsContainer, $(".turn-on-sync"));
    this.turnOnSyncButton = this._register(new Button(turnOnSyncButtonContainer, { title: true, ...defaultButtonStyles }));
    this.lastSyncedLabel = DOM.append(headerRightControlsContainer, $(".last-synced-label"));
    DOM.hide(this.lastSyncedLabel);
    this.turnOnSyncButton.enabled = true;
    this.turnOnSyncButton.label = localize("turnOnSyncButton", "Backup and Sync Settings");
    DOM.hide(this.turnOnSyncButton.element);
    this._register(this.turnOnSyncButton.onDidClick(async () => {
      await this.commandService.executeCommand("workbench.userDataSync.actions.turnOn");
    }));
    this.updateLastSyncedTime();
    this._register(this.userDataSyncService.onDidChangeLastSyncTime(() => {
      this.updateLastSyncedTime();
    }));
    const updateLastSyncedTimer = this._register(new DOM.WindowIntervalTimer());
    updateLastSyncedTimer.cancelAndSet(() => this.updateLastSyncedTime(), 60 * 1e3, window);
    this.update();
    this._register(this.userDataSyncService.onDidChangeStatus(() => {
      this.update();
    }));
    this._register(this.userDataSyncEnablementService.onDidChangeEnablement(() => {
      this.update();
    }));
  }
  updateLastSyncedTime() {
    const last = this.userDataSyncService.lastSyncTime;
    let label;
    if (typeof last === "number") {
      const d = fromNow(last, true, void 0, true);
      label = localize("lastSyncedLabel", "Last synced: {0}", d);
    } else {
      label = "";
    }
    this.lastSyncedLabel.textContent = label;
    this._onDidChangeLastSyncedLabel.fire(label);
  }
  update() {
    if (this.userDataSyncService.status === SyncStatus.Uninitialized) {
      return;
    }
    if (this.userDataSyncEnablementService.isEnabled() || this.userDataSyncService.status !== SyncStatus.Idle) {
      DOM.show(this.lastSyncedLabel);
      DOM.hide(this.turnOnSyncButton.element);
    } else {
      DOM.hide(this.lastSyncedLabel);
      DOM.show(this.turnOnSyncButton.element);
    }
  }
};
SyncControls = __decorateClass([
  __decorateParam(2, ICommandService),
  __decorateParam(3, IUserDataSyncService),
  __decorateParam(4, IUserDataSyncEnablementService),
  __decorateParam(5, ITelemetryService)
], SyncControls);
export {
  SettingsEditor2,
  SettingsFocusContext,
  createGroupIterator
};
