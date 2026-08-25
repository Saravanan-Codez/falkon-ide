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
import { Action2, MenuId, MenuRegistry, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { KeyMod, KeyCode } from "../../../../../base/common/keyCodes.js";
import { ACTIVE_GROUP, IEditorService, SIDE_GROUP } from "../../../../services/editor/common/editorService.js";
import { IEditorGroupsService, GroupsOrder } from "../../../../services/editor/common/editorGroupsService.js";
import { EditorsOrder, EditorResourceAccessor, SideBySideEditor } from "../../../../common/editor.js";
import { IQuickInputService, QuickInputButtonLocation } from "../../../../../platform/quickinput/common/quickInput.js";
import { Disposable, DisposableMap, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { Emitter } from "../../../../../base/common/event.js";
import { URI } from "../../../../../base/common/uri.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { BrowserViewUri } from "../../../../../platform/browserView/common/browserViewUri.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { BrowserEditorInput } from "../../common/browserEditorInput.js";
import { logBrowserOpen } from "../../../../../platform/browserView/common/browserViewTelemetry.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../../platform/contextkey/common/contextkey.js";
import { BrowserViewCommandId } from "../../../../../platform/browserView/common/browserView.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../common/contributions.js";
import { IBrowserViewWorkbenchService } from "../../common/browserView.js";
import { BrowserNewTabPlacementSettingId } from "../browserViewWorkbenchService.js";
import { Extensions as ConfigurationExtensions, ConfigurationScope } from "../../../../../platform/configuration/common/configurationRegistry.js";
import { workbenchConfigurationNodeBase } from "../../../../common/configuration.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { isLocalhostAuthority, isAllInterfacesAuthority } from "../../../../../platform/url/common/trustedDomains.js";
import { IConfigurationService, isConfigured } from "../../../../../platform/configuration/common/configuration.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { ToggleTitleBarConfigAction } from "../../../../browser/parts/titlebar/titlebarActions.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { match } from "../../../../../base/common/glob.js";
import { $, addDisposableListener, EventType } from "../../../../../base/browser/dom.js";
import { BrowserEditor, BrowserEditorContribution, BrowserWidgetLocation, BROWSER_EDITOR_ACTIVE, BrowserActionCategory, BrowserActionGroup } from "../browserEditor.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { HoverPosition } from "../../../../../base/browser/ui/hover/hoverWidget.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { IPreferencesService } from "../../../../services/preferences/common/preferences.js";
import { disposableTimeout } from "../../../../../base/common/async.js";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { IsSessionsWindowContext, ResourceContextKey } from "../../../../common/contextkeys.js";
import { Schemas } from "../../../../../base/common/network.js";
const CONTEXT_BROWSER_EDITOR_OPEN = new RawContextKey("browserEditorOpen", false, localize("browser.editorOpen", "Whether any browser editor is currently open"));
const closeButtonItem = {
  iconClass: ThemeIcon.asClassName(Codicon.close),
  tooltip: localize("browser.closeTab", "Close")
};
const closeAllButtonItem = {
  iconClass: ThemeIcon.asClassName(Codicon.closeAll),
  tooltip: localize("browser.closeAllTabs", "Close All"),
  location: QuickInputButtonLocation.Inline
};
let BrowserTabQuickPick = class extends Disposable {
  constructor(_editorService, _editorGroupsService, quickInputService, telemetryService, _browserViewService) {
    super();
    this._editorService = _editorService;
    this._editorGroupsService = _editorGroupsService;
    this._browserViewService = _browserViewService;
    this._itemListeners = this._register(new DisposableStore());
    this._openNewTabPick = {
      groupId: -1,
      editor: void 0,
      label: localize("browser.openNewTab", "New Integrated Browser Tab"),
      iconClass: ThemeIcon.asClassName(Codicon.add),
      alwaysShow: true
    };
    this._quickPick = this._register(quickInputService.createQuickPick({ useSeparators: true }));
    this._quickPick.placeholder = localize("browser.quickOpenPlaceholder", "Select a browser tab");
    this._quickPick.matchOnDescription = true;
    this._quickPick.sortByLabel = false;
    this._quickPick.buttons = [closeAllButtonItem];
    this._register(this._quickPick.onDidTriggerItemButton(async ({ item }) => {
      item.editor?.dispose(true);
    }));
    this._register(this._quickPick.onDidTriggerButton(async () => {
      for (const editor of this._browserViewService.getContextualBrowserViews().values()) {
        editor.dispose(true);
      }
    }));
    this._register(this._quickPick.onDidAccept(async () => {
      const [selected] = this._quickPick.selectedItems;
      if (!selected) {
        return;
      }
      if (selected === this._openNewTabPick) {
        logBrowserOpen(telemetryService, "quickOpenWithoutUrl");
        this._quickPick.hide();
        await this._editorService.openEditor({
          resource: BrowserViewUri.forId(generateUuid())
        }, await this._browserViewService.getPreferredGroup());
      } else {
        await this._editorService.openEditor(selected.editor, await this._browserViewService.getPreferredGroup(selected.groupId));
      }
    }));
    this._register(this._quickPick.onDidHide(() => this.dispose()));
  }
  show() {
    this._buildItems();
    const activeEditor = this._editorService.activeEditor;
    if (activeEditor instanceof BrowserEditorInput) {
      const activePick = this._quickPick.items.find((item) => item.type !== "separator" && item.editor === activeEditor);
      if (activePick) {
        this._quickPick.activeItems = [activePick];
      }
    }
    this._quickPick.show();
  }
  _buildItems() {
    this._itemListeners.clear();
    const activeEditor = this._quickPick.activeItems[0]?.editor;
    const picks = [];
    const groups = this._editorGroupsService.getGroups(GroupsOrder.GRID_APPEARANCE);
    const groupsWithBrowserEditors = groups.map((group) => ({ group, browserEditors: group.editors.filter((e) => e instanceof BrowserEditorInput) })).filter(({ browserEditors }) => browserEditors.length > 0);
    const viewsInGroups = /* @__PURE__ */ new Set();
    for (const { browserEditors } of groupsWithBrowserEditors) {
      for (const editor of browserEditors) {
        viewsInGroups.add(editor.id);
      }
    }
    const backgroundEditors = [...this._browserViewService.getContextualBrowserViews().values()].filter((e) => !viewsInGroups.has(e.id));
    const backgroundLabel = localize("browser.backgroundGroup", "Background");
    const sections = groupsWithBrowserEditors.map(({ group, browserEditors }) => ({
      label: group.label,
      ariaLabel: group.ariaLabel,
      groupId: group.id,
      editors: browserEditors,
      isPinned: (e) => group.isPinned(e)
    }));
    if (backgroundEditors.length > 0) {
      sections.push({ label: backgroundLabel, ariaLabel: backgroundLabel, groupId: ACTIVE_GROUP, editors: backgroundEditors });
    }
    for (const { group } of groupsWithBrowserEditors) {
      this._itemListeners.add(group.onDidModelChange(() => this._buildItems()));
    }
    this._itemListeners.add(this._browserViewService.onDidChangeBrowserViews(() => this._buildItems()));
    const hasMultipleSections = sections.length > 1;
    let newActivePick;
    for (const section of sections) {
      if (hasMultipleSections) {
        picks.push({ type: "separator", label: section.label });
      }
      for (const editor of section.editors) {
        const icon = editor.getIcon();
        const description = editor.getDescription();
        const nameAndDescription = description ? `${editor.getName()} ${description}` : editor.getName();
        const pick = {
          groupId: section.groupId,
          editor,
          label: editor.getName(),
          ariaLabel: hasMultipleSections ? localize("browserEntryAriaLabelWithGroup", "{0}, {1}", nameAndDescription, section.ariaLabel) : nameAndDescription,
          description,
          buttons: [closeButtonItem],
          italic: section.isPinned ? !section.isPinned(editor) : void 0
        };
        if (icon instanceof URI) {
          pick.iconPath = { dark: icon };
        } else if (icon) {
          pick.iconClass = ThemeIcon.asClassName(icon);
        }
        picks.push(pick);
        if (editor === activeEditor) {
          newActivePick = pick;
        }
        this._itemListeners.add(editor.onDidChangeLabel(() => this._buildItems()));
      }
    }
    picks.push({ type: "separator" });
    picks.push(this._openNewTabPick);
    this._quickPick.keepScrollPosition = true;
    this._quickPick.items = picks;
    if (newActivePick) {
      this._quickPick.activeItems = [newActivePick];
    }
  }
};
BrowserTabQuickPick = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IEditorGroupsService),
  __decorateParam(2, IQuickInputService),
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, IBrowserViewWorkbenchService)
], BrowserTabQuickPick);
class QuickOpenBrowserAction extends Action2 {
  constructor() {
    super({
      id: BrowserViewCommandId.QuickOpen,
      title: localize2("browser.quickOpenAction", "Quick Open Browser Tab..."),
      icon: Codicon.globe,
      category: BrowserActionCategory,
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        // Note: on Linux this conflicts with the "toggle block comment" keybinding.
        //       it's not as problem at the moment becase oh the `when`, but worth noting for the future.
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyA,
        when: BROWSER_EDITOR_ACTIVE
      }
    });
  }
  run(accessor) {
    const picker = accessor.get(IInstantiationService).createInstance(BrowserTabQuickPick);
    picker.show();
  }
}
class OpenIntegratedBrowserAction extends Action2 {
  constructor() {
    super({
      id: BrowserViewCommandId.Open,
      title: localize2("browser.openAction", "Open Integrated Browser"),
      category: BrowserActionCategory,
      icon: Codicon.globe,
      f1: true
    });
  }
  async run(accessor, urlOrOptions) {
    const editorService = accessor.get(IEditorService);
    const telemetryService = accessor.get(ITelemetryService);
    const browserViewService = accessor.get(IBrowserViewWorkbenchService);
    const options = typeof urlOrOptions === "string" ? { url: urlOrOptions } : urlOrOptions ?? {};
    const resource = BrowserViewUri.forId(generateUuid());
    const group = await browserViewService.getPreferredGroup(options.openToSide ? SIDE_GROUP : void 0);
    if (options.reuseUrlFilter) {
      const filterUri = URI.parse(options.reuseUrlFilter);
      const matchingEditor = [...browserViewService.getContextualBrowserViews().values()].find((e) => {
        const editorUri = URI.parse(e.url || "");
        if (filterUri.scheme && options.reuseUrlFilter.startsWith(`${filterUri.scheme}:`) && filterUri.scheme !== editorUri.scheme) {
          return false;
        }
        if (filterUri.authority && !match(filterUri.authority, editorUri.authority)) {
          return false;
        }
        if (filterUri.path && !match(filterUri.path, editorUri.path)) {
          return false;
        }
        if (filterUri.query) {
          const filterParams = new URLSearchParams(filterUri.query);
          const editorParams = new URLSearchParams(editorUri.query);
          if (![...filterParams].every(([key, value]) => match(value, editorParams.get(key) ?? ""))) {
            return false;
          }
        }
        return true;
      });
      if (matchingEditor) {
        if (options.url) {
          matchingEditor.navigate(options.url);
        }
        await editorService.openEditor(matchingEditor);
        return;
      }
    }
    logBrowserOpen(telemetryService, options.url ? "commandWithUrl" : "commandWithoutUrl");
    const editorPane = await editorService.openEditor({ resource, options: { viewState: { url: options.url } } }, group);
    if (options.openToSide && editorPane?.group) {
      editorPane.group.lock(true);
    }
  }
}
class OpenFileInIntegratedBrowserAction extends Action2 {
  constructor() {
    const IS_LOCAL_HTML_FILE = ContextKeyExpr.and(
      ResourceContextKey.Scheme.isEqualTo(Schemas.file),
      ContextKeyExpr.regex(ResourceContextKey.Extension.key, /\.html?$/i)
    );
    super({
      id: BrowserViewCommandId.OpenFile,
      title: localize2("browser.openFileAction", "Open in Integrated Browser"),
      category: BrowserActionCategory,
      icon: Codicon.globe,
      f1: true,
      precondition: IS_LOCAL_HTML_FILE,
      menu: [
        {
          id: MenuId.ExplorerContext,
          group: "navigation",
          order: 29,
          when: IS_LOCAL_HTML_FILE
        },
        {
          id: MenuId.EditorTitleContext,
          group: "1_open",
          order: 5,
          when: IS_LOCAL_HTML_FILE
        },
        {
          id: MenuId.EditorTitle,
          group: "navigation",
          order: 99,
          when: IS_LOCAL_HTML_FILE
        }
      ]
    });
  }
  async run(accessor, resource) {
    const editorService = accessor.get(IEditorService);
    const telemetryService = accessor.get(ITelemetryService);
    const browserViewService = accessor.get(IBrowserViewWorkbenchService);
    const fileUri = resource ?? EditorResourceAccessor.getOriginalUri(editorService.activeEditor, { filterByScheme: [Schemas.file], supportSideBySide: SideBySideEditor.PRIMARY });
    if (!fileUri) {
      return;
    }
    logBrowserOpen(telemetryService, "openFileCommand");
    const browserUri = BrowserViewUri.forId(generateUuid());
    await editorService.openEditor({ resource: browserUri, options: { viewState: { url: fileUri.toString() } } }, await browserViewService.getPreferredGroup());
  }
}
class NewTabAction extends Action2 {
  constructor() {
    super({
      id: BrowserViewCommandId.NewTab,
      title: localize2("browser.newTabAction", "New Tab"),
      category: BrowserActionCategory,
      icon: Codicon.add,
      f1: true,
      precondition: BROWSER_EDITOR_ACTIVE,
      menu: {
        id: MenuId.BrowserActionsToolbar,
        group: BrowserActionGroup.Tabs,
        order: 1,
        isHiddenByDefault: true
      },
      // When already in a browser, Ctrl/Cmd + T opens a new tab
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib + 50,
        // Priority over search actions
        primary: KeyMod.CtrlCmd | KeyCode.KeyT
      }
    });
  }
  async run(accessor, _browserEditor = accessor.get(IEditorService).activeEditorPane) {
    const editorService = accessor.get(IEditorService);
    const telemetryService = accessor.get(ITelemetryService);
    const browserViewService = accessor.get(IBrowserViewWorkbenchService);
    const resource = BrowserViewUri.forId(generateUuid());
    logBrowserOpen(telemetryService, "newTabCommand");
    await editorService.openEditor({ resource }, await browserViewService.getPreferredGroup());
  }
}
class CloseAllBrowserTabsAction extends Action2 {
  constructor() {
    super({
      id: BrowserViewCommandId.CloseAll,
      title: localize2("browser.closeAll", "Close All Browser Tabs"),
      category: BrowserActionCategory,
      f1: true,
      precondition: CONTEXT_BROWSER_EDITOR_OPEN
    });
  }
  async run(accessor) {
    const editorGroupsService = accessor.get(IEditorGroupsService);
    for (const group of editorGroupsService.getGroups(GroupsOrder.GRID_APPEARANCE)) {
      const browserEditors = group.getEditors(EditorsOrder.SEQUENTIAL).filter((e) => e instanceof BrowserEditorInput);
      if (browserEditors.length > 0) {
        await group.closeEditors(browserEditors);
      }
    }
  }
}
class CloseAllBrowserTabsInGroupAction extends Action2 {
  constructor() {
    super({
      id: BrowserViewCommandId.CloseAllInGroup,
      title: localize2("browser.closeAllInGroup", "Close All Browser Tabs in Group"),
      category: BrowserActionCategory,
      f1: true,
      precondition: BROWSER_EDITOR_ACTIVE
    });
  }
  async run(accessor) {
    const editorGroupsService = accessor.get(IEditorGroupsService);
    const editorService = accessor.get(IEditorService);
    const group = editorGroupsService.getGroup(editorService.activeEditorPane?.group?.id ?? editorGroupsService.activeGroup.id);
    if (!group) {
      return;
    }
    const browserEditors = group.getEditors(EditorsOrder.SEQUENTIAL).filter((e) => e instanceof BrowserEditorInput);
    if (browserEditors.length > 0) {
      await group.closeEditors(browserEditors);
    }
  }
}
class OpenOrListBrowsersAction extends Action2 {
  constructor() {
    super({
      id: BrowserViewCommandId.OpenOrList,
      title: localize2("browser.openOrListAction", "Browser"),
      icon: Codicon.globe,
      f1: false,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.Slash
      },
      menu: {
        id: MenuId.TitleBar,
        group: "navigation",
        order: 10,
        when: ContextKeyExpr.and(
          ContextKeyExpr.equals("config.workbench.browser.showInTitleBar", false).negate(),
          ContextKeyExpr.or(
            CONTEXT_BROWSER_EDITOR_OPEN,
            // This is a hack to work around `true` just testing for truthiness of the key. It works since `1 == true` in JS.
            ContextKeyExpr.equals("config.workbench.browser.showInTitleBar", 1)
          )
        )
      }
    });
  }
  async run(accessor) {
    const browserViewService = accessor.get(IBrowserViewWorkbenchService);
    const commandService = accessor.get(ICommandService);
    const hasOpenBrowserEditor = browserViewService.getContextualBrowserViews().size > 0;
    if (hasOpenBrowserEditor) {
      await commandService.executeCommand(BrowserViewCommandId.QuickOpen);
      return;
    }
    await commandService.executeCommand(BrowserViewCommandId.Open);
  }
}
MenuRegistry.appendMenuItem(MenuId.MenubarViewMenu, {
  group: "4_auxbar",
  command: {
    id: BrowserViewCommandId.OpenOrList,
    title: localize({ key: "miOpenBrowser", comment: ["&& denotes a mnemonic"] }, "&&Browser")
  },
  order: 2
});
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: BrowserViewCommandId.CloseAllInGroup, title: localize("browser.closeAllInGroupShort", "Close All Browser Tabs") }, group: "1_close", order: 55, when: BROWSER_EDITOR_ACTIVE });
MenuRegistry.appendMenuItem(MenuId.EditorTitle, {
  command: {
    id: BrowserViewCommandId.NewTab,
    title: localize2("browser.newTabAction", "New Tab"),
    icon: Codicon.add
  },
  group: "navigation",
  order: 1,
  when: ContextKeyExpr.and(BROWSER_EDITOR_ACTIVE, IsSessionsWindowContext)
});
registerAction2(QuickOpenBrowserAction);
registerAction2(OpenIntegratedBrowserAction);
registerAction2(OpenFileInIntegratedBrowserAction);
registerAction2(OpenOrListBrowsersAction);
registerAction2(NewTabAction);
registerAction2(CloseAllBrowserTabsAction);
registerAction2(CloseAllBrowserTabsInGroupAction);
registerAction2(class ToggleBrowserTitleBarButton extends ToggleTitleBarConfigAction {
  constructor() {
    super("workbench.browser.showInTitleBar", localize("toggle.browser", "Integrated Browser"), localize("toggle.browserDescription", "Toggle visibility of the Integrated Browser button in title bar"), 8);
  }
});
let BrowserEditorOpenContextKeyContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.browserEditorOpenContextKey";
  }
  constructor(contextKeyService, browserViewService) {
    super();
    const contextKey = CONTEXT_BROWSER_EDITOR_OPEN.bindTo(contextKeyService);
    const update = () => contextKey.set(browserViewService.getContextualBrowserViews().size > 0);
    update();
    this._register(browserViewService.onDidChangeBrowserViews(() => update()));
  }
};
BrowserEditorOpenContextKeyContribution = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, IBrowserViewWorkbenchService)
], BrowserEditorOpenContextKeyContribution);
registerWorkbenchContribution2(BrowserEditorOpenContextKeyContribution.ID, BrowserEditorOpenContextKeyContribution, WorkbenchPhase.AfterRestored);
let LocalhostLinkOpenerContribution = class extends Disposable {
  constructor(openerService, configurationService, editorService, telemetryService, browserViewWorkbenchService) {
    super();
    this.configurationService = configurationService;
    this.editorService = editorService;
    this.telemetryService = telemetryService;
    this.browserViewWorkbenchService = browserViewWorkbenchService;
    this._register(openerService.registerExternalOpener(this));
  }
  static {
    this.ID = "workbench.contrib.localhostLinkOpener";
  }
  async openExternal(href, ctx, _token) {
    if (!this.configurationService.getValue("workbench.browser.openLocalhostLinks")) {
      return false;
    }
    if (this.browserViewWorkbenchService.willUseRemoteProxy() && ctx.sourceUri) {
      href = ctx.sourceUri.toString();
    }
    try {
      const parsed = new URL(href);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return false;
      }
      if (!isLocalhostAuthority(parsed.host) && !isAllInterfacesAuthority(parsed.host)) {
        return false;
      }
    } catch {
      return false;
    }
    logBrowserOpen(this.telemetryService, "localhostLinkOpener");
    const isDefaultLinkOpen = !isConfigured(this.configurationService.inspect("workbench.browser.openLocalhostLinks"));
    const browserUri = BrowserViewUri.forId(generateUuid());
    await this.editorService.openEditor({ resource: browserUri, options: { pinned: true, viewState: { url: href, isDefaultLinkOpen } } }, await this.browserViewWorkbenchService.getPreferredGroup());
    return true;
  }
};
LocalhostLinkOpenerContribution = __decorateClass([
  __decorateParam(0, IOpenerService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IEditorService),
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, IBrowserViewWorkbenchService)
], LocalhostLinkOpenerContribution);
registerWorkbenchContribution2(LocalhostLinkOpenerContribution.ID, LocalhostLinkOpenerContribution, WorkbenchPhase.BlockStartup);
const LOCALHOST_HINT_DISMISSED_KEY = "workbench.browser.linkOpenedHintDismissed";
let LinkOpenedHintPill = class extends BrowserEditorContribution {
  constructor(editor, hoverService, storageService, preferencesService, contextKeyService) {
    super(editor);
    this.hoverService = hoverService;
    this.storageService = storageService;
    this.preferencesService = preferencesService;
    this.contextKeyService = contextKeyService;
    this._attentionTimeout = this._register(new MutableDisposable());
    this._pill = $(".browser-link-opened-hint-pill");
    this._pill.tabIndex = 0;
    this._pill.role = "button";
    this._pill.ariaLabel = localize("browser.linkOpenedHint.ariaLabel", "This link opened in the integrated browser");
    this._pill.ariaHidden = "true";
    const icon = $("span");
    icon.className = ThemeIcon.asClassName(Codicon.info);
    const label = $("span");
    label.textContent = localize("browser.linkOpenedHint.label", "Link opened here");
    this._pill.appendChild(icon);
    this._pill.appendChild(label);
    const hoverOptions = () => ({
      content: new MarkdownString(localize("browser.linkOpenedHint.detail", "**Integrated Browser**\n\nLocalhost links automatically open in the integrated browser.")),
      actions: [
        {
          label: localize("browser.linkOpenedHint.openSettings", "Open Settings"),
          commandId: "workbench.action.openSettings",
          iconClass: ThemeIcon.asClassName(Codicon.settingsGear),
          run: () => {
            this.preferencesService.openUserSettings({ query: "workbench.browser.openLocalhostLinks" });
          }
        },
        {
          label: localize("browser.linkOpenedHint.dismiss", "Don't Show Again"),
          commandId: "",
          run: () => {
            this._dismiss();
          }
        }
      ],
      position: { hoverPosition: HoverPosition.BELOW }
    });
    this._register(this.hoverService.setupDelayedHover(this._pill, hoverOptions, { setupKeyboardEvents: true }));
    this._register(addDisposableListener(this._pill, EventType.CLICK, () => {
      this.hoverService.showInstantHover({ ...hoverOptions(), target: this._pill, persistence: { sticky: true } }, true);
    }));
  }
  get widgets() {
    return [{ location: BrowserWidgetLocation.PostUrl, element: this._pill, order: 100 }];
  }
  onModelAttached(_model, _store, isNew) {
    if (IsSessionsWindowContext.getValue(this.contextKeyService)) {
      this._setVisible(false);
      return;
    }
    const input = this.editor.input;
    if (input instanceof BrowserEditorInput && input.isDefaultLinkOpen) {
      const dismissed = this.storageService.getBoolean(LOCALHOST_HINT_DISMISSED_KEY, StorageScope.APPLICATION, false);
      this._setVisible(!dismissed);
      if (!dismissed && isNew) {
        this._callAttention();
      }
    } else {
      this._setVisible(false);
    }
  }
  onModelDetached() {
    this._attentionTimeout.clear();
    this._setVisible(false);
  }
  _setVisible(visible) {
    if (!visible) {
      this._attentionTimeout.clear();
      this._pill.classList.remove("attention");
    }
    this._pill.classList.toggle("visible", visible);
    this._pill.ariaHidden = visible ? "false" : "true";
  }
  _callAttention() {
    this._attentionTimeout.clear();
    this._pill.classList.remove("attention");
    this._attentionTimeout.value = disposableTimeout(() => {
      this._pill.classList.add("attention");
      this._attentionTimeout.value = disposableTimeout(() => {
        this._pill.classList.remove("attention");
      }, 2e3);
    }, 300);
  }
  _dismiss() {
    this.storageService.store(LOCALHOST_HINT_DISMISSED_KEY, true, StorageScope.APPLICATION, StorageTarget.USER);
    this._setVisible(false);
  }
};
LinkOpenedHintPill = __decorateClass([
  __decorateParam(1, IHoverService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, IPreferencesService),
  __decorateParam(4, IContextKeyService)
], LinkOpenedHintPill);
BrowserEditor.registerContribution(LinkOpenedHintPill);
let BrowserTabUrlSuggestions = class extends BrowserEditorContribution {
  constructor(editor, _browserViewService, _editorService, _editorGroupsService) {
    super(editor);
    this._browserViewService = _browserViewService;
    this._editorService = _editorService;
    this._editorGroupsService = _editorGroupsService;
    this._onDidChange = this._register(new Emitter());
    this._groupListeners = this._register(new DisposableMap());
    this._editorLabelListeners = this._register(new DisposableMap());
    for (const group of this._editorGroupsService.getGroups(GroupsOrder.GRID_APPEARANCE)) {
      this._trackGroup(group);
    }
    this._register(this._editorGroupsService.onDidAddGroup((group) => {
      this._trackGroup(group);
      this._onDidChange.fire();
    }));
    this._register(this._editorGroupsService.onDidRemoveGroup((group) => {
      this._groupListeners.deleteAndDispose(group.id);
      this._onDidChange.fire();
    }));
    this._register(this._editorGroupsService.onDidMoveGroup(() => this._onDidChange.fire()));
    this._register(this._editorGroupsService.onDidChangeGroupIndex(() => this._onDidChange.fire()));
    this._refreshEditorLabelListeners();
    this._register(this._browserViewService.onDidChangeBrowserViews(() => {
      this._refreshEditorLabelListeners();
      this._onDidChange.fire();
    }));
    this._provider = {
      label: localize("browser.openTabs", "Open Tabs"),
      description: localize("browser.openTabsDescription", "Select a tab to switch"),
      order: 100,
      actions: [],
      onDidChange: this._onDidChange.event,
      getSuggestions: async ({ input }) => {
        if (input.url) {
          return [];
        }
        return this._collectSuggestions(input);
      }
    };
  }
  get urlSuggestionProviders() {
    return [this._provider];
  }
  _trackGroup(group) {
    this._groupListeners.set(group.id, group.onDidModelChange(() => this._onDidChange.fire()));
  }
  _refreshEditorLabelListeners() {
    const known = this._browserViewService.getContextualBrowserViews();
    for (const id of [...this._editorLabelListeners.keys()]) {
      if (!known.has(id)) {
        this._editorLabelListeners.deleteAndDispose(id);
      }
    }
    for (const [id, editor] of known) {
      if (!this._editorLabelListeners.has(id)) {
        this._editorLabelListeners.set(id, editor.onDidChangeLabel(() => this._onDidChange.fire()));
      }
    }
  }
  /**
   * Return tabs in editor-group visibility order (grid appearance, then
   * within-group editor order), with background tabs (known but not open
   * in any group) appended at the end. Excludes the editor's own input.
   */
  _collectSuggestions(input) {
    const ordered = [];
    const seen = /* @__PURE__ */ new Set();
    for (const group of this._editorGroupsService.getGroups(GroupsOrder.GRID_APPEARANCE)) {
      for (const editor of group.editors) {
        if (editor instanceof BrowserEditorInput && !seen.has(editor.id)) {
          seen.add(editor.id);
          ordered.push(editor);
        }
      }
    }
    for (const tab of this._browserViewService.getContextualBrowserViews().values()) {
      if (!seen.has(tab.id)) {
        seen.add(tab.id);
        ordered.push(tab);
      }
    }
    const suggestions = [];
    for (const tab of ordered) {
      if (tab === input) {
        continue;
      }
      const rawIcon = tab.getIcon();
      suggestions.push({
        id: tab.id,
        label: tab.getName(),
        description: tab.getDescription(),
        icon: rawIcon instanceof URI ? void 0 : rawIcon,
        iconPath: rawIcon instanceof URI ? { dark: rawIcon } : void 0,
        apply: (source) => this._switchToTab(source, tab)
      });
    }
    return suggestions;
  }
  /**
   * Close {@link source} and focus {@link target} where it already lives.
   *
   * The navbar's picker-hide handler synchronously calls
   * `ensureBrowserFocus()` on the source editor before any of our awaits
   * resolve, so we have to explicitly refocus the target group after the
   * editor service operations complete — otherwise focus snaps back to
   * the (about-to-close) source's window.
   */
  async _switchToTab(source, target) {
    if (source === target) {
      await this._editorService.openEditor(target);
      return;
    }
    const sourceGroup = this._editorGroupsService.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE).find((g) => g.contains(source));
    if (sourceGroup) {
      await sourceGroup.closeEditor(source, { preserveFocus: true });
    }
    await this._editorService.openEditor(target);
  }
};
BrowserTabUrlSuggestions = __decorateClass([
  __decorateParam(1, IBrowserViewWorkbenchService),
  __decorateParam(2, IEditorService),
  __decorateParam(3, IEditorGroupsService)
], BrowserTabUrlSuggestions);
BrowserEditor.registerContribution(BrowserTabUrlSuggestions);
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  ...workbenchConfigurationNodeBase,
  properties: {
    "workbench.browser.showInTitleBar": {
      type: ["boolean", "string"],
      enum: [true, false, "whenOpen"],
      enumDescriptions: [
        localize({ comment: ["This is the description for a setting. Values surrounded by single quotes are not to be translated."], key: "browser.showInTitleBar.true" }, "The button is always shown in the title bar."),
        localize({ comment: ["This is the description for a setting. Values surrounded by single quotes are not to be translated."], key: "browser.showInTitleBar.false" }, "The button is never shown in the title bar."),
        localize({ comment: ["This is the description for a setting. Values surrounded by single quotes are not to be translated."], key: "browser.showInTitleBar.whenOpen" }, "The button is shown in the title bar when a browser editor is open.")
      ],
      default: "whenOpen",
      experiment: { mode: "startup" },
      description: localize(
        { comment: ["This is the description for a setting."], key: "browser.showInTitleBar" },
        "Controls whether the Integrated Browser button is shown in the title bar."
      )
    },
    "workbench.browser.openLocalhostLinks": {
      type: "boolean",
      default: false,
      experiment: { mode: "startup" },
      markdownDescription: localize(
        { comment: ["This is the description for a setting."], key: "browser.openLocalhostLinks" },
        "When enabled, localhost links (`localhost`, `127.0.0.1`, `[::1]`) and all-interfaces links (`0.0.0.0`, `[0:0:0:0:0:0:0:0]`, `[::]`) from the terminal, chat, and other sources will open in the Integrated Browser instead of the system browser."
      ),
      agentsWindow: { default: true }
    },
    [BrowserNewTabPlacementSettingId]: {
      type: "string",
      enum: ["activeGroup", "sideGroup", "window"],
      enumDescriptions: [
        localize({ comment: ["This is the description for a setting."], key: "browser.newTabPlacement.activeGroup" }, "New browser tabs open in the currently active editor group."),
        localize({ comment: ["This is the description for a setting."], key: "browser.newTabPlacement.sideGroup" }, "New browser tabs open in a dedicated editor group to the side that is reused for subsequent tabs. The group is locked so other editors are not opened into it."),
        localize({ comment: ["This is the description for a setting."], key: "browser.newTabPlacement.window" }, "New browser tabs open in a dedicated window that is reused for subsequent tabs. The window is locked so other editors are not opened into it.")
      ],
      default: "activeGroup",
      markdownDescription: localize(
        { comment: ["This is the description for a setting."], key: "browser.newTabPlacement" },
        "Controls where new Integrated Browser tabs are opened."
      ),
      scope: ConfigurationScope.WINDOW
    }
  }
});
