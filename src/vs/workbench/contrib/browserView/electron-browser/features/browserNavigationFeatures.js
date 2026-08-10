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
import { localize, localize2 } from "../../../../../nls.js";
import { $ } from "../../../../../base/browser/dom.js";
import { disposableTimeout } from "../../../../../base/common/async.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { KeyMod, KeyCode } from "../../../../../base/common/keyCodes.js";
import { Action2, MenuId, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { MenuWorkbenchToolBar } from "../../../../../platform/actions/browser/toolbar.js";
import { HoverPosition } from "../../../../../base/browser/ui/hover/hoverWidget.js";
import { WorkbenchHoverDelegate } from "../../../../../platform/hover/browser/hover.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { BrowserViewCommandId } from "../../../../../platform/browserView/common/browserView.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { IPreferencesService } from "../../../../services/preferences/common/preferences.js";
import { BrowserEditorInput } from "../../common/browserEditorInput.js";
import {
  BROWSER_SEARCH_NONE,
  BrowserSearchEngineSettingId,
  buildSearchUrl,
  getBrowserSearchEngineLabel,
  resolveAddressBarInputType
} from "../../common/browserSearch.js";
import {
  BROWSER_EDITOR_ACTIVE,
  BrowserActionCategory,
  BrowserActionGroup,
  BrowserEditor,
  BrowserEditorContribution,
  BrowserWidgetLocation,
  CONTEXT_BROWSER_FOCUSED,
  CONTEXT_BROWSER_HAS_URL
} from "../browserEditor.js";
import { BrowserUrlBarWidget } from "../widgets/browserUrlBarWidget.js";
const CONTEXT_BROWSER_CAN_GO_BACK = new RawContextKey("browserCanGoBack", false, localize("browser.canGoBack", "Whether the browser can go back"));
const CONTEXT_BROWSER_CAN_GO_FORWARD = new RawContextKey("browserCanGoForward", false, localize("browser.canGoForward", "Whether the browser can go forward"));
class BrowserNavigationBar extends Disposable {
  constructor(editor, instantiationService, scopedContextKeyService, _configurationService, _preferencesService) {
    super();
    this._configurationService = _configurationService;
    this._preferencesService = _preferencesService;
    this._contributionListeners = this._register(new DisposableStore());
    this._contributions = [];
    this.element = $(".browser-navbar");
    const hoverDelegate = this._register(
      instantiationService.createInstance(
        WorkbenchHoverDelegate,
        "element",
        void 0,
        { position: { hoverPosition: HoverPosition.ABOVE } }
      )
    );
    const scopedInstantiationService = instantiationService.createChild(new ServiceCollection(
      [IContextKeyService, scopedContextKeyService]
    ));
    const navContainer = $(".browser-nav-toolbar");
    this._navToolbar = this._register(scopedInstantiationService.createInstance(
      MenuWorkbenchToolBar,
      navContainer,
      MenuId.BrowserNavigationToolbar,
      {
        hoverDelegate,
        highlightToggledItems: true,
        actionViewItemProvider: (action, options) => {
          for (const contribution of this._contributions) {
            const viewItem = contribution.getActionViewItem(action, options, scopedInstantiationService);
            if (viewItem) {
              return viewItem;
            }
          }
          return void 0;
        },
        // Render all actions inline regardless of group.
        toolbarOptions: { primaryGroup: () => true, useSeparatorsInPrimaryActions: true },
        menuOptions: { shouldForwardArgs: true }
      }
    ));
    this._navToolbar.context = editor;
    const urlBarHost = {
      get input() {
        return editor.input instanceof BrowserEditorInput ? editor.input : void 0;
      },
      ensureBrowserFocus: () => editor.ensureBrowserFocus(),
      getPrimaryActions: (text) => this._resolvePrimaryActions(text),
      getPlaceholder: () => this._searchEngine ? localize({ key: "browser.urlOrSearchPlaceholder", comment: ["Placeholder text shown in the integrated browser's address (URL) bar when it is empty. The user can either type a search query to search the web, or type a URL to navigate to it."] }, "Search or enter URL") : localize("browser.urlPlaceholder", "Enter a URL")
    };
    this._urlBar = this._register(instantiationService.createInstance(BrowserUrlBarWidget, urlBarHost));
    const actionsContainer = $(".browser-actions-toolbar");
    const actionsToolbar = this._register(scopedInstantiationService.createInstance(
      MenuWorkbenchToolBar,
      actionsContainer,
      MenuId.BrowserActionsToolbar,
      {
        hoverDelegate,
        highlightToggledItems: true,
        toolbarOptions: { primaryGroup: () => true, useSeparatorsInPrimaryActions: true },
        menuOptions: { shouldForwardArgs: true },
        responsiveBehavior: {
          enabled: true,
          kind: "last",
          minItems: 0,
          // The URL bar is the flexible element, so the actions toolbar's own
          // element width does not reflect the room it could occupy.
          // So we pass manual calculations based on the navbar's overall width and the URL bar's width.
          observedElement: this.element,
          getAvailableWidth: () => {
            const toolbarBounds = this.element.getBoundingClientRect();
            const urlBarBounds = this._urlBar.element.getBoundingClientRect();
            return Math.max(
              0,
              toolbarBounds.right - urlBarBounds.left - 240
              /* approximate: preferred width of the URL input plus padding */
            );
          }
        }
      }
    ));
    actionsToolbar.context = editor;
    this.element.appendChild(navContainer);
    this.element.appendChild(this._urlBar.element);
    this.element.appendChild(actionsContainer);
  }
  refreshUrl() {
    this._urlBar.refreshUrl();
  }
  previewUrl(url) {
    this._urlBar.previewUrl(url);
  }
  focusUrlInput() {
    this._urlBar.focusUrlInput();
  }
  openUrlPicker() {
    this._urlBar.openUrlPicker();
  }
  clear() {
    this._urlBar.clear();
  }
  mountContributions(contributions) {
    this._contributions = contributions;
    this._contributionListeners.clear();
    for (const contribution of contributions) {
      this._contributionListeners.add(contribution.onDidChangeActionViewItems(() => this._navToolbar.refresh()));
    }
    this._navToolbar.refresh();
    this._urlBar.mountContributions(contributions);
  }
  /**
   * The configured address bar search engine, or `undefined` when search
   * routing is disabled (the setting is `'none'`).
   */
  get _searchEngine() {
    const value = this._configurationService.getValue(BrowserSearchEngineSettingId);
    return value && value !== BROWSER_SEARCH_NONE ? value : void 0;
  }
  /**
   * The URL bar's primary picker item(s) for the given text, mirroring
   * Chrome/Edge. With search enabled: a URL reads "{url}" (globe icon) first
   * with a search fallback after, a clear query reads "{query} - {engine}
   * Search" (search icon), and an ambiguous input offers both — Search first,
   * then Go to — so the user can pick. The destination URL is resolved here
   * (search text → search-engine URL) so {@link BrowserEditorInput.navigate}
   * receives a plain URL; the telemetry source is passed through so a
   * search-initiated navigation is tracked as such.
   */
  _resolvePrimaryActions(text) {
    const goTo = {
      id: text,
      label: text,
      iconClass: ThemeIcon.asClassName(Codicon.globe),
      apply: (input) => input.navigate(text)
    };
    const engineId = this._searchEngine;
    if (!engineId) {
      return [goTo];
    }
    const configureEngineButton = {
      id: "browser.configureSearchEngine",
      iconClass: ThemeIcon.asClassName(Codicon.settingsGear),
      tooltip: localize("browser.configureSearchEngine", "Configure Search Engine"),
      run: () => void this._preferencesService.openSettings({ query: `@id:${BrowserSearchEngineSettingId}` })
    };
    const search = {
      id: text,
      label: localize("browser.searchFor", "{0} - {1} Search", text, getBrowserSearchEngineLabel(engineId)),
      iconClass: ThemeIcon.asClassName(Codicon.search),
      buttons: [configureEngineButton],
      apply: (input) => input.navigate(buildSearchUrl(text, engineId), { source: "searchInput" })
    };
    switch (resolveAddressBarInputType(text)) {
      case "url":
        return [goTo, search];
      case "query":
        return [search];
      default:
        return [search, goTo];
    }
  }
}
let BrowserNavigationFeatures = class extends BrowserEditorContribution {
  constructor(editor, instantiationService, contextKeyService, configurationService, preferencesService) {
    super(editor);
    this._pendingTryFocus = this._register(new MutableDisposable());
    /**
     * Whether a navigation has been initiated on the current tab. Once true,
     * an empty URL means "navigation in flight" rather than "fresh tab", so
     * {@link tryFocus} keeps focus on the page instead of reopening the picker.
     */
    this._hasInitiatedNavigation = false;
    this._navbar = this._register(new BrowserNavigationBar(editor, instantiationService, contextKeyService, configurationService, preferencesService));
    this._canGoBackContext = CONTEXT_BROWSER_CAN_GO_BACK.bindTo(contextKeyService);
    this._canGoForwardContext = CONTEXT_BROWSER_CAN_GO_FORWARD.bindTo(contextKeyService);
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(BrowserSearchEngineSettingId)) {
        this._navbar.refreshUrl();
      }
    }));
  }
  get widgets() {
    return [{ location: BrowserWidgetLocation.Toolbar, element: this._navbar.element, order: 0 }];
  }
  onContainerCreated() {
    const contributions = [];
    for (const contribution of this.editor.getContributions()) {
      if (contribution !== this) {
        contributions.push(contribution);
      }
    }
    this._navbar.mountContributions(contributions);
  }
  prerenderInput(_input) {
    this._navbar.refreshUrl();
    this._canGoBackContext.set(false);
    this._canGoForwardContext.set(false);
  }
  onModelAttached(model, store) {
    this._hasInitiatedNavigation = model.loading;
    this._updateFromModel(model);
    store.add(model.onDidNavigate(() => this._updateFromModel(model)));
    store.add(model.onWillNavigate((url) => {
      this._hasInitiatedNavigation = true;
      this._navbar.previewUrl(url);
    }));
  }
  onModelDetached() {
    this._hasInitiatedNavigation = false;
    this._navbar.clear();
    this._canGoBackContext.reset();
    this._canGoForwardContext.reset();
  }
  tryFocus() {
    const input = this.editor.input;
    this._pendingTryFocus.value = disposableTimeout(() => {
      if (this.editor.input !== input) {
        return;
      }
      const url = this.editor.model?.url ?? (input instanceof BrowserEditorInput ? input.url : void 0);
      if (!url && !this._hasInitiatedNavigation) {
        this._navbar.openUrlPicker();
      } else {
        this.editor.ensureBrowserFocus();
      }
    }, 0);
    return true;
  }
  _updateFromModel(model) {
    this._navbar.refreshUrl();
    this._canGoBackContext.set(model.canGoBack);
    this._canGoForwardContext.set(model.canGoForward);
  }
  focusUrlInput() {
    this._navbar.focusUrlInput();
  }
  openUrlPicker() {
    this._navbar.openUrlPicker();
  }
};
BrowserNavigationFeatures = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IPreferencesService)
], BrowserNavigationFeatures);
BrowserEditor.registerContribution(BrowserNavigationFeatures);
class GoBackAction extends Action2 {
  static {
    this.ID = BrowserViewCommandId.GoBack;
  }
  constructor() {
    super({
      id: GoBackAction.ID,
      title: localize2("browser.goBackAction", "Go Back"),
      category: BrowserActionCategory,
      icon: Codicon.arrowLeft,
      f1: true,
      precondition: ContextKeyExpr.and(BROWSER_EDITOR_ACTIVE, CONTEXT_BROWSER_CAN_GO_BACK),
      menu: {
        id: MenuId.BrowserNavigationToolbar,
        group: "navigation",
        order: 1
      },
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib + 50,
        primary: KeyMod.Alt | KeyCode.LeftArrow,
        secondary: [KeyCode.BrowserBack],
        mac: { primary: KeyMod.CtrlCmd | KeyCode.BracketLeft, secondary: [KeyCode.BrowserBack, KeyMod.CtrlCmd | KeyCode.LeftArrow] }
      }
    });
  }
  async run(accessor, browserEditor = accessor.get(IEditorService).activeEditorPane) {
    if (browserEditor instanceof BrowserEditor) {
      await browserEditor.model?.goBack();
    }
  }
}
class GoForwardAction extends Action2 {
  static {
    this.ID = BrowserViewCommandId.GoForward;
  }
  constructor() {
    super({
      id: GoForwardAction.ID,
      title: localize2("browser.goForwardAction", "Go Forward"),
      category: BrowserActionCategory,
      icon: Codicon.arrowRight,
      f1: true,
      precondition: ContextKeyExpr.and(BROWSER_EDITOR_ACTIVE, CONTEXT_BROWSER_CAN_GO_FORWARD),
      menu: {
        id: MenuId.BrowserNavigationToolbar,
        group: "navigation",
        order: 2
      },
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib + 50,
        primary: KeyMod.Alt | KeyCode.RightArrow,
        secondary: [KeyCode.BrowserForward],
        mac: { primary: KeyMod.CtrlCmd | KeyCode.BracketRight, secondary: [KeyCode.BrowserForward, KeyMod.CtrlCmd | KeyCode.RightArrow] }
      }
    });
  }
  async run(accessor, browserEditor = accessor.get(IEditorService).activeEditorPane) {
    if (browserEditor instanceof BrowserEditor) {
      await browserEditor.model?.goForward();
    }
  }
}
class ReloadAction extends Action2 {
  static {
    this.ID = BrowserViewCommandId.Reload;
  }
  constructor() {
    super({
      id: ReloadAction.ID,
      title: localize2("browser.reloadAction", "Reload"),
      category: BrowserActionCategory,
      icon: Codicon.refresh,
      f1: true,
      precondition: BROWSER_EDITOR_ACTIVE,
      menu: {
        id: MenuId.BrowserNavigationToolbar,
        group: "navigation",
        order: 3,
        alt: {
          id: HardReloadAction.ID,
          title: localize2("browser.hardReloadAction", "Hard Reload"),
          icon: Codicon.refresh
        }
      },
      keybinding: {
        when: CONTEXT_BROWSER_FOCUSED,
        weight: KeybindingWeight.WorkbenchContrib + 75,
        primary: KeyMod.CtrlCmd | KeyCode.KeyR,
        secondary: [KeyCode.F5],
        mac: { primary: KeyMod.CtrlCmd | KeyCode.KeyR, secondary: [] }
      }
    });
  }
  async run(accessor, browserEditor = accessor.get(IEditorService).activeEditorPane) {
    if (browserEditor instanceof BrowserEditor) {
      await browserEditor.model?.reload();
    }
  }
}
class HardReloadAction extends Action2 {
  static {
    this.ID = BrowserViewCommandId.HardReload;
  }
  constructor() {
    super({
      id: HardReloadAction.ID,
      title: localize2("browser.hardReloadAction", "Hard Reload"),
      category: BrowserActionCategory,
      icon: Codicon.refresh,
      f1: true,
      precondition: BROWSER_EDITOR_ACTIVE,
      keybinding: {
        when: CONTEXT_BROWSER_FOCUSED,
        weight: KeybindingWeight.WorkbenchContrib + 75,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyR,
        secondary: [KeyMod.CtrlCmd | KeyCode.F5],
        mac: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyR, secondary: [] }
      }
    });
  }
  async run(accessor, browserEditor = accessor.get(IEditorService).activeEditorPane) {
    if (browserEditor instanceof BrowserEditor) {
      await browserEditor.model?.reload(true);
    }
  }
}
class FocusUrlInputAction extends Action2 {
  static {
    this.ID = BrowserViewCommandId.FocusUrlInput;
  }
  constructor() {
    super({
      id: FocusUrlInputAction.ID,
      title: localize2("browser.focusUrlInputAction", "Focus URL Input"),
      category: BrowserActionCategory,
      f1: true,
      precondition: BROWSER_EDITOR_ACTIVE,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyCode.KeyL
      }
    });
  }
  async run(accessor, browserEditor = accessor.get(IEditorService).activeEditorPane) {
    if (browserEditor instanceof BrowserEditor) {
      browserEditor.getContribution(BrowserNavigationFeatures)?.openUrlPicker();
    }
  }
}
class OpenInExternalBrowserAction extends Action2 {
  static {
    this.ID = BrowserViewCommandId.OpenExternal;
  }
  constructor() {
    super({
      id: OpenInExternalBrowserAction.ID,
      title: localize2("browser.openExternalAction", "Open in External Browser"),
      category: BrowserActionCategory,
      icon: Codicon.linkExternal,
      f1: true,
      // Note: We do allow opening in an external browser even if there is an error page shown
      precondition: ContextKeyExpr.and(BROWSER_EDITOR_ACTIVE, CONTEXT_BROWSER_HAS_URL),
      menu: {
        id: MenuId.BrowserActionsToolbar,
        group: BrowserActionGroup.Tools,
        order: 10,
        isHiddenByDefault: true
      }
    });
  }
  async run(accessor, browserEditor = accessor.get(IEditorService).activeEditorPane) {
    if (browserEditor instanceof BrowserEditor) {
      const url = browserEditor.model?.url;
      if (url) {
        const openerService = accessor.get(IOpenerService);
        await openerService.open(url, {
          // ensures that VS Code itself doesn't try to open the URL, even for non-"http(s):" scheme URLs.
          openExternal: true,
          // ensures that the link isn't opened in Integrated Browser or other contributed external openers. False is the default, but just being explicit here.
          allowContributedOpeners: false
        });
      }
    }
  }
}
class OpenBrowserSettingsAction extends Action2 {
  static {
    this.ID = BrowserViewCommandId.OpenSettings;
  }
  constructor() {
    super({
      id: OpenBrowserSettingsAction.ID,
      title: localize2("browser.openSettingsAction", "Browser Settings"),
      category: BrowserActionCategory,
      icon: Codicon.settingsGear,
      f1: false,
      menu: {
        id: MenuId.BrowserActionsToolbar,
        group: BrowserActionGroup.Settings,
        order: 2,
        isHiddenByDefault: true
      }
    });
  }
  async run(accessor) {
    const preferencesService = accessor.get(IPreferencesService);
    await preferencesService.openSettings({ query: `@id:workbench.browser.*` });
  }
}
registerAction2(GoBackAction);
registerAction2(GoForwardAction);
registerAction2(ReloadAction);
registerAction2(HardReloadAction);
registerAction2(FocusUrlInputAction);
registerAction2(OpenInExternalBrowserAction);
registerAction2(OpenBrowserSettingsAction);
export {
  BrowserNavigationFeatures
};
