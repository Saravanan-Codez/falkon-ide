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
import * as dom from "../../../../../base/browser/dom.js";
import { Event } from "../../../../../base/common/event.js";
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { DisposableStore, MutableDisposable, toDisposable, Disposable, DisposableMap } from "../../../../../base/common/lifecycle.js";
import { isWindows } from "../../../../../base/common/platform.js";
import { localize2 } from "../../../../../nls.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { TerminalLocation } from "../../../../../platform/terminal/common/terminal.js";
import { registerActiveInstanceAction, registerTerminalAction } from "../../../terminal/browser/terminalActions.js";
import { registerTerminalContribution } from "../../../terminal/browser/terminalExtensions.js";
import { TerminalContextKeys } from "../../../terminal/common/terminalContextKey.js";
import { TerminalSuggestCommandId } from "../common/terminal.suggest.js";
import { terminalSuggestConfigSection, TerminalSuggestSettingId, registerTerminalSuggestProvidersConfiguration } from "../common/terminalSuggestConfiguration.js";
import { ITerminalCompletionService, TerminalCompletionService } from "./terminalCompletionService.js";
import { ITerminalContributionService } from "../../../terminal/common/terminalExtensionPoints.js";
import { InstantiationType, registerSingleton } from "../../../../../platform/instantiation/common/extensions.js";
import { SuggestAddon } from "./terminalSuggestAddon.js";
import { TerminalClipboardContribution } from "../../clipboard/browser/terminal.clipboard.contribution.js";
import { SimpleSuggestContext } from "../../../../services/suggest/browser/simpleSuggestWidget.js";
import { SuggestDetailsClassName } from "../../../../services/suggest/browser/simpleSuggestWidgetDetails.js";
import { EditorContextKeys } from "../../../../../editor/common/editorContextKeys.js";
import { MenuId } from "../../../../../platform/actions/common/actions.js";
import { IPreferencesService } from "../../../../services/preferences/common/preferences.js";
import "./terminalSymbolIcons.js";
import { LspCompletionProviderAddon } from "./lspCompletionProviderAddon.js";
import { createTerminalLanguageVirtualUri, LspTerminalModelContentProvider } from "./lspTerminalModelContentProvider.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { ILanguageFeaturesService } from "../../../../../editor/common/services/languageFeatures.js";
import { getTerminalLspSupportedLanguageObj } from "./lspTerminalUtil.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { Codicon } from "../../../../../base/common/codicons.js";
registerSingleton(ITerminalCompletionService, TerminalCompletionService, InstantiationType.Delayed);
let TerminalSuggestContribution = class extends DisposableStore {
  constructor(_ctx, _contextKeyService, _configurationService, _instantiationService, _terminalCompletionService, _textModelService, _languageFeaturesService) {
    super();
    this._ctx = _ctx;
    this._contextKeyService = _contextKeyService;
    this._configurationService = _configurationService;
    this._instantiationService = _instantiationService;
    this._terminalCompletionService = _terminalCompletionService;
    this._textModelService = _textModelService;
    this._languageFeaturesService = _languageFeaturesService;
    this._addon = new MutableDisposable();
    this._lspAddons = this.add(new DisposableMap());
    this._lspModelProvider = new MutableDisposable();
    this.add(toDisposable(() => {
      this._addon?.dispose();
      this._lspModelProvider?.value?.dispose();
      this._lspModelProvider?.dispose();
    }));
    this._terminalSuggestWidgetVisibleContextKey = TerminalContextKeys.suggestWidgetVisible.bindTo(this._contextKeyService);
    this.add(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(TerminalSuggestSettingId.Enabled)) {
        const completionsEnabled = this._configurationService.getValue(terminalSuggestConfigSection).enabled;
        if (!completionsEnabled) {
          this._addon.clear();
          this._lspAddons.clearAndDisposeAll();
        }
        const xtermRaw = this._ctx.instance.xterm?.raw;
        if (!!xtermRaw && completionsEnabled) {
          this._loadAddons(xtermRaw);
        }
      }
    }));
    TerminalSuggestProvidersConfigurationManager.initialize(this._instantiationService);
    this.add(this._ctx.instance.onDidChangeTarget((target) => {
      this._updateContainerForTarget(target);
    }));
    this.add(this._ctx.instance.onDidFocus(() => {
      const xtermRaw = this._ctx.instance.xterm?.raw;
      if (xtermRaw) {
        this._prepareAddonLayout(xtermRaw);
      }
    }));
  }
  static {
    this.ID = "terminal.suggest";
  }
  static get(instance) {
    return instance.getContribution(TerminalSuggestContribution.ID);
  }
  get addon() {
    return this._addon.value;
  }
  get lspAddons() {
    return Array.from(this._lspAddons.values());
  }
  xtermOpen(xterm) {
    const config = this._configurationService.getValue(terminalSuggestConfigSection);
    const enabled = config.enabled;
    if (!enabled) {
      return;
    }
    this._loadAddons(xterm.raw);
    this.add(Event.runAndSubscribe(this._ctx.instance.onDidChangeShellType, async () => {
      this._refreshAddons();
      this._lspModelProvider.value?.shellTypeChanged(this._ctx.instance.shellType);
    }));
  }
  async _loadLspCompletionAddon(xterm) {
    let lspTerminalObj = void 0;
    if (!this._ctx.instance.shellType || !(lspTerminalObj = getTerminalLspSupportedLanguageObj(this._ctx.instance.shellType))) {
      this._lspAddons.clearAndDisposeAll();
      return;
    }
    const virtualTerminalDocumentUri = createTerminalLanguageVirtualUri(this._ctx.instance.instanceId, lspTerminalObj.extension);
    this._lspModelProvider.value = this._instantiationService.createInstance(LspTerminalModelContentProvider, this._ctx.instance.capabilities, this._ctx.instance.instanceId, virtualTerminalDocumentUri, this._ctx.instance.shellType);
    this.add(this._lspModelProvider.value);
    const textVirtualModel = await this._textModelService.createModelReference(virtualTerminalDocumentUri);
    this.add(textVirtualModel);
    const virtualProviders = this._languageFeaturesService.completionProvider.all(textVirtualModel.object.textEditorModel);
    const filteredProviders = virtualProviders.filter((p) => p._debugDisplayName !== "wordbasedCompletions");
    for (const provider of filteredProviders) {
      const lspCompletionProviderAddon = this._instantiationService.createInstance(LspCompletionProviderAddon, provider, textVirtualModel, this._lspModelProvider.value);
      this._lspAddons.set(provider._debugDisplayName, lspCompletionProviderAddon);
      xterm.loadAddon(lspCompletionProviderAddon);
      this.add(this._terminalCompletionService.registerTerminalCompletionProvider(
        "lsp",
        lspCompletionProviderAddon.id,
        lspCompletionProviderAddon,
        ...lspCompletionProviderAddon.triggerCharacters ?? []
      ));
    }
  }
  _loadAddons(xterm) {
    if (this._addon.value) {
      return;
    }
    const addon = this._addon.value = this._instantiationService.createInstance(SuggestAddon, this._ctx.instance.sessionId, this._ctx.instance.shellType, this._ctx.instance.capabilities, this._terminalSuggestWidgetVisibleContextKey);
    xterm.loadAddon(addon);
    this._loadLspCompletionAddon(xterm);
    this._prepareAddonLayout(xterm);
    this.add(dom.addDisposableListener(this._ctx.instance.domElement, dom.EventType.FOCUS_OUT, (e) => {
      const focusedElement = e.relatedTarget;
      if (focusedElement?.classList.contains(SuggestDetailsClassName)) {
        return;
      }
      addon.hideSuggestWidget(true);
    }));
    this.add(addon.onAcceptedCompletion(async (text) => {
      this._ctx.instance.focus();
      this._ctx.instance.sendText(text, false);
    }));
    const clipboardContrib = TerminalClipboardContribution.get(this._ctx.instance);
    this.add(clipboardContrib.onWillPaste(() => addon.isPasting = true));
    this.add(clipboardContrib.onDidPaste(() => {
      setTimeout(() => addon.isPasting = false, 100);
    }));
    if (!isWindows) {
      let barrier;
      this.add(addon.onDidReceiveCompletions(() => {
        barrier?.open();
        barrier = void 0;
      }));
    }
  }
  _refreshAddons() {
    const addon = this._addon.value;
    if (!addon) {
      return;
    }
    addon.shellType = this._ctx.instance.shellType;
    if (!this._ctx.instance.xterm?.raw) {
      return;
    }
    this._loadLspCompletionAddon(this._ctx.instance.xterm.raw);
  }
  _updateContainerForTarget(target) {
    const addon = this._addon.value;
    if (!addon || !this._ctx.instance.xterm?.raw) {
      return;
    }
    this._prepareAddonLayout(this._ctx.instance.xterm.raw);
  }
  async _prepareAddonLayout(xterm) {
    const addon = this._addon.value;
    if (!addon || this.isDisposed) {
      return;
    }
    const xtermElement = xterm.element ?? await this._waitForXtermElement(xterm);
    if (!xtermElement || this.isDisposed || addon !== this._addon.value) {
      return;
    }
    const container = this._resolveAddonContainer(xtermElement);
    addon.setContainerWithOverflow(container);
    const screenElement = xtermElement?.querySelector(".xterm-screen");
    if (dom.isHTMLElement(screenElement)) {
      addon.setScreen(screenElement);
    }
  }
  async _waitForXtermElement(xterm) {
    if (xterm.element) {
      return xterm.element;
    }
    await Promise.race([
      Event.toPromise(Event.filter(this._ctx.instance.onDidChangeVisibility, (visible) => visible)),
      Event.toPromise(this._ctx.instance.onDisposed)
    ]);
    if (this.isDisposed || this._ctx.instance.isDisposed) {
      return void 0;
    }
    return xterm.element ?? void 0;
  }
  _resolveAddonContainer(xtermElement) {
    if (this._ctx.instance.target === TerminalLocation.Editor) {
      return xtermElement;
    }
    return dom.findParentWithClass(xtermElement, "panel") ?? xtermElement;
  }
};
TerminalSuggestContribution = __decorateClass([
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, ITerminalCompletionService),
  __decorateParam(5, ITextModelService),
  __decorateParam(6, ILanguageFeaturesService)
], TerminalSuggestContribution);
registerTerminalContribution(TerminalSuggestContribution.ID, TerminalSuggestContribution);
registerTerminalAction({
  id: TerminalSuggestCommandId.ChangeSelectionModeNever,
  title: localize2("workbench.action.terminal.changeSelectionMode.never", "Selection Mode: None"),
  tooltip: localize2("workbench.action.terminal.changeSelectionMode.never.tooltip", "Do not select the top suggestion until down is pressed, at which point Tab or Enter will accept the suggestion. Activate to change."),
  f1: false,
  precondition: ContextKeyExpr.and(
    ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated),
    TerminalContextKeys.focus,
    TerminalContextKeys.isOpen,
    TerminalContextKeys.suggestWidgetVisible,
    ContextKeyExpr.equals(`config.${TerminalSuggestSettingId.SelectionMode}`, "never")
  ),
  menu: {
    id: MenuId.MenubarTerminalSuggestStatusMenu,
    group: "left",
    order: 1,
    when: ContextKeyExpr.and(
      ContextKeyExpr.equals(`config.${TerminalSuggestSettingId.SelectionMode}`, "never"),
      ContextKeyExpr.or(
        ContextKeyExpr.equals(`config.${TerminalSuggestSettingId.QuickSuggestions}`, true),
        ContextKeyExpr.equals(`config.${TerminalSuggestSettingId.SuggestOnTriggerCharacters}`, true)
      )
    )
  },
  run: (c, accessor) => {
    accessor.get(IConfigurationService).updateValue(TerminalSuggestSettingId.SelectionMode, "partial");
  }
});
registerTerminalAction({
  id: TerminalSuggestCommandId.ChangeSelectionModePartial,
  title: localize2("workbench.action.terminal.changeSelectionMode.partial", "Selection Mode: Partial (Tab)"),
  tooltip: localize2("workbench.action.terminal.changeSelectionMode.partial.tooltip", "Partially select the top suggestion, Tab will accept a suggestion when visible. Activate to change."),
  f1: false,
  precondition: ContextKeyExpr.and(
    ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated),
    TerminalContextKeys.focus,
    TerminalContextKeys.isOpen,
    TerminalContextKeys.suggestWidgetVisible,
    ContextKeyExpr.equals(`config.${TerminalSuggestSettingId.SelectionMode}`, "partial")
  ),
  menu: {
    id: MenuId.MenubarTerminalSuggestStatusMenu,
    group: "left",
    order: 1,
    when: ContextKeyExpr.and(
      ContextKeyExpr.equals(`config.${TerminalSuggestSettingId.SelectionMode}`, "partial"),
      ContextKeyExpr.or(
        ContextKeyExpr.equals(`config.${TerminalSuggestSettingId.QuickSuggestions}`, true),
        ContextKeyExpr.equals(`config.${TerminalSuggestSettingId.SuggestOnTriggerCharacters}`, true)
      )
    )
  },
  run: (c, accessor) => {
    accessor.get(IConfigurationService).updateValue(TerminalSuggestSettingId.SelectionMode, "always");
  }
});
registerTerminalAction({
  id: TerminalSuggestCommandId.ChangeSelectionModeAlways,
  title: localize2("workbench.action.terminal.changeSelectionMode.always", "Selection Mode: Always (Tab or Enter)"),
  tooltip: localize2("workbench.action.terminal.changeSelectionMode.always.tooltip", "Always select the top suggestion, Tab or Enter will accept a suggestion when visible. Activate to change."),
  f1: false,
  precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
  menu: {
    id: MenuId.MenubarTerminalSuggestStatusMenu,
    group: "left",
    order: 1,
    when: ContextKeyExpr.and(
      ContextKeyExpr.equals(`config.${TerminalSuggestSettingId.SelectionMode}`, "always"),
      ContextKeyExpr.or(
        ContextKeyExpr.equals(`config.${TerminalSuggestSettingId.QuickSuggestions}`, true),
        ContextKeyExpr.equals(`config.${TerminalSuggestSettingId.SuggestOnTriggerCharacters}`, true)
      )
    )
  },
  run: (c, accessor) => {
    accessor.get(IConfigurationService).updateValue(TerminalSuggestSettingId.SelectionMode, "never");
  }
});
registerTerminalAction({
  id: TerminalSuggestCommandId.DoNotShowOnType,
  title: localize2("workbench.action.terminal.doNotShowSuggestOnType", "Don't show IntelliSense unless triggered explicitly. This disables the quick suggestions and suggest on trigger characters settings."),
  f1: false,
  precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
  icon: Codicon.eye,
  menu: {
    id: MenuId.MenubarTerminalSuggestStatusMenu,
    group: "right",
    order: 1,
    when: ContextKeyExpr.and(
      ContextKeyExpr.or(
        ContextKeyExpr.equals(`config.${TerminalSuggestSettingId.QuickSuggestions}.commands`, "on"),
        ContextKeyExpr.equals(`config.${TerminalSuggestSettingId.QuickSuggestions}.arguments`, "on")
      ),
      ContextKeyExpr.equals(`config.${TerminalSuggestSettingId.SuggestOnTriggerCharacters}`, true)
    )
  },
  run: (c, accessor) => {
    accessor.get(IConfigurationService).updateValue(TerminalSuggestSettingId.QuickSuggestions, { commands: "off", arguments: "off", unknown: "off" });
    accessor.get(IConfigurationService).updateValue(TerminalSuggestSettingId.SuggestOnTriggerCharacters, false);
  }
});
registerTerminalAction({
  id: TerminalSuggestCommandId.ShowOnType,
  title: localize2("workbench.action.terminal.showSuggestOnType", "Show IntelliSense while typing. This enables the quick suggestions for commands and arguments, and suggest on trigger characters settings."),
  f1: false,
  precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
  icon: Codicon.eyeClosed,
  menu: {
    id: MenuId.MenubarTerminalSuggestStatusMenu,
    group: "right",
    order: 1,
    when: ContextKeyExpr.or(
      ContextKeyExpr.and(
        ContextKeyExpr.equals(`config.${TerminalSuggestSettingId.QuickSuggestions}.commands`, "off"),
        ContextKeyExpr.equals(`config.${TerminalSuggestSettingId.QuickSuggestions}.arguments`, "off")
      ),
      ContextKeyExpr.equals(`config.${TerminalSuggestSettingId.SuggestOnTriggerCharacters}`, false)
    )
  },
  run: (c, accessor) => {
    accessor.get(IConfigurationService).updateValue(TerminalSuggestSettingId.QuickSuggestions, { commands: "on", arguments: "on", unknown: "off" });
    accessor.get(IConfigurationService).updateValue(TerminalSuggestSettingId.SuggestOnTriggerCharacters, true);
  }
});
registerTerminalAction({
  id: TerminalSuggestCommandId.LearnMore,
  title: localize2("workbench.action.terminal.learnMore", "Learn More"),
  f1: false,
  precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
  icon: Codicon.question,
  menu: {
    id: MenuId.MenubarTerminalSuggestStatusMenu,
    group: "right",
    order: 2
  },
  run: (c, accessor) => {
    accessor.get(IOpenerService).open("https://aka.ms/vscode-terminal-intellisense");
  }
});
registerTerminalAction({
  id: TerminalSuggestCommandId.ConfigureSettings,
  title: localize2("workbench.action.terminal.configureSuggestSettings", "Configure"),
  f1: false,
  precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
  icon: Codicon.gear,
  menu: {
    id: MenuId.MenubarTerminalSuggestStatusMenu,
    group: "right",
    order: 3
  },
  run: (c, accessor) => accessor.get(IPreferencesService).openSettings({ query: terminalSuggestConfigSection })
});
registerActiveInstanceAction({
  id: TerminalSuggestCommandId.TriggerSuggest,
  title: localize2("workbench.action.terminal.triggerSuggest", "Trigger Suggest"),
  f1: false,
  keybinding: {
    primary: KeyMod.CtrlCmd | KeyCode.Space,
    mac: { primary: KeyMod.WinCtrl | KeyCode.Space },
    weight: KeybindingWeight.WorkbenchContrib + 1,
    when: ContextKeyExpr.and(TerminalContextKeys.focus, TerminalContextKeys.suggestWidgetVisible.negate(), ContextKeyExpr.equals(`config.${TerminalSuggestSettingId.Enabled}`, true))
  },
  run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.requestCompletions(true)
});
registerActiveInstanceAction({
  id: TerminalSuggestCommandId.ResetWidgetSize,
  title: localize2("workbench.action.terminal.resetSuggestWidgetSize", "Reset Suggest Widget Size"),
  run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.resetWidgetSize()
});
registerActiveInstanceAction({
  id: TerminalSuggestCommandId.SelectPrevSuggestion,
  title: localize2("workbench.action.terminal.selectPrevSuggestion", "Select the Previous Suggestion"),
  f1: false,
  precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
  keybinding: {
    // Up is bound to other workbench keybindings that this needs to beat
    primary: KeyCode.UpArrow,
    weight: KeybindingWeight.WorkbenchContrib + 1,
    when: ContextKeyExpr.or(SimpleSuggestContext.HasNavigated, ContextKeyExpr.equals(`config.${TerminalSuggestSettingId.UpArrowNavigatesHistory}`, false))
  },
  run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.selectPreviousSuggestion()
});
registerActiveInstanceAction({
  id: TerminalSuggestCommandId.SelectPrevPageSuggestion,
  title: localize2("workbench.action.terminal.selectPrevPageSuggestion", "Select the Previous Page Suggestion"),
  f1: false,
  precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
  keybinding: {
    // Up is bound to other workbench keybindings that this needs to beat
    primary: KeyCode.PageUp,
    weight: KeybindingWeight.WorkbenchContrib + 1
  },
  run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.selectPreviousPageSuggestion()
});
registerActiveInstanceAction({
  id: TerminalSuggestCommandId.SelectNextSuggestion,
  title: localize2("workbench.action.terminal.selectNextSuggestion", "Select the Next Suggestion"),
  f1: false,
  precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
  keybinding: {
    // Down is bound to other workbench keybindings that this needs to beat
    primary: KeyCode.DownArrow,
    weight: KeybindingWeight.WorkbenchContrib + 1
  },
  run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.selectNextSuggestion()
});
registerActiveInstanceAction({
  id: "terminalSuggestToggleExplainMode",
  title: localize2("workbench.action.terminal.suggestToggleExplainMode", "Suggest Toggle Explain Modes"),
  f1: false,
  precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
  keybinding: {
    // Down is bound to other workbench keybindings that this needs to beat
    weight: KeybindingWeight.WorkbenchContrib + 1,
    primary: KeyMod.CtrlCmd | KeyCode.Slash
  },
  run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.toggleExplainMode()
});
registerActiveInstanceAction({
  id: TerminalSuggestCommandId.ToggleDetailsFocus,
  title: localize2("workbench.action.terminal.suggestToggleDetailsFocus", "Suggest Toggle Suggestion Focus"),
  f1: false,
  // HACK: This does not work with a precondition of `TerminalContextKeys.suggestWidgetVisible`, so make sure to not override the editor's keybinding
  precondition: EditorContextKeys.textInputFocus.negate(),
  keybinding: {
    weight: KeybindingWeight.WorkbenchContrib,
    primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.Space,
    mac: { primary: KeyMod.WinCtrl | KeyMod.Alt | KeyCode.Space }
  },
  run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.toggleSuggestionFocus()
});
registerActiveInstanceAction({
  id: TerminalSuggestCommandId.ToggleDetails,
  title: localize2("workbench.action.terminal.suggestToggleDetails", "Suggest Toggle Details"),
  f1: false,
  precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.isOpen, TerminalContextKeys.focus, TerminalContextKeys.suggestWidgetVisible, SimpleSuggestContext.HasFocusedSuggestion),
  keybinding: {
    // HACK: Force weight to be higher than that to start terminal chat
    weight: KeybindingWeight.ExternalExtension + 2,
    primary: KeyMod.CtrlCmd | KeyCode.Space,
    secondary: [KeyMod.CtrlCmd | KeyCode.KeyI],
    mac: { primary: KeyMod.WinCtrl | KeyCode.Space, secondary: [KeyMod.CtrlCmd | KeyCode.KeyI] }
  },
  run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.toggleSuggestionDetails()
});
registerActiveInstanceAction({
  id: TerminalSuggestCommandId.SelectNextPageSuggestion,
  title: localize2("workbench.action.terminal.selectNextPageSuggestion", "Select the Next Page Suggestion"),
  f1: false,
  precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
  keybinding: {
    // Down is bound to other workbench keybindings that this needs to beat
    primary: KeyCode.PageDown,
    weight: KeybindingWeight.WorkbenchContrib + 1
  },
  run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.selectNextPageSuggestion()
});
registerActiveInstanceAction({
  id: TerminalSuggestCommandId.AcceptSelectedSuggestion,
  title: localize2("workbench.action.terminal.acceptSelectedSuggestion", "Insert"),
  f1: false,
  precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
  keybinding: [
    {
      primary: KeyCode.Tab,
      // Tab is bound to other workbench keybindings that this needs to beat
      weight: KeybindingWeight.WorkbenchContrib + 2,
      when: ContextKeyExpr.and(SimpleSuggestContext.HasFocusedSuggestion)
    },
    {
      primary: KeyCode.Enter,
      // Enter accepts when: explicitly invoked (ctrl+space), OR not in partial mode, OR not first suggestion, OR user has navigated
      when: ContextKeyExpr.and(SimpleSuggestContext.HasFocusedSuggestion, ContextKeyExpr.or(SimpleSuggestContext.ExplicitlyInvoked, ContextKeyExpr.notEquals(`config.${TerminalSuggestSettingId.SelectionMode}`, "partial"), SimpleSuggestContext.FirstSuggestionFocused.toNegated(), SimpleSuggestContext.HasNavigated)),
      weight: KeybindingWeight.WorkbenchContrib + 1
    }
  ],
  run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.acceptSelectedSuggestion()
});
registerActiveInstanceAction({
  id: TerminalSuggestCommandId.AcceptSelectedSuggestionEnter,
  title: localize2("workbench.action.terminal.acceptSelectedSuggestionEnter", "Accept Selected Suggestion (Enter)"),
  f1: false,
  precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
  keybinding: {
    primary: KeyCode.Enter,
    // Enter is bound to other workbench keybindings that this needs to beat
    weight: KeybindingWeight.WorkbenchContrib + 1,
    when: ContextKeyExpr.notEquals(`config.${TerminalSuggestSettingId.RunOnEnter}`, "never")
  },
  run: async (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.acceptSelectedSuggestion(void 0, true)
});
registerActiveInstanceAction({
  id: TerminalSuggestCommandId.HideSuggestWidget,
  title: localize2("workbench.action.terminal.hideSuggestWidget", "Hide Suggest Widget"),
  f1: false,
  precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
  keybinding: {
    primary: KeyCode.Escape,
    // Escape is bound to other workbench keybindings that this needs to beat
    weight: KeybindingWeight.WorkbenchContrib + 1
  },
  run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.hideSuggestWidget(true)
});
registerActiveInstanceAction({
  id: TerminalSuggestCommandId.HideSuggestWidgetAndNavigateHistory,
  title: localize2("workbench.action.terminal.hideSuggestWidgetAndNavigateHistory", "Hide Suggest Widget and Navigate History"),
  f1: false,
  precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
  keybinding: {
    primary: KeyCode.UpArrow,
    when: ContextKeyExpr.and(SimpleSuggestContext.HasNavigated.negate(), ContextKeyExpr.equals(`config.${TerminalSuggestSettingId.UpArrowNavigatesHistory}`, true)),
    weight: KeybindingWeight.WorkbenchContrib + 2
  },
  run: (activeInstance) => {
    TerminalSuggestContribution.get(activeInstance)?.addon?.hideSuggestWidget(true);
    activeInstance.sendText("\x1B[A", false);
  }
});
let TerminalSuggestProvidersConfigurationManager = class extends Disposable {
  constructor(_terminalCompletionService, _terminalContributionService) {
    super();
    this._terminalCompletionService = _terminalCompletionService;
    this._terminalContributionService = _terminalContributionService;
    this._register(this._terminalCompletionService.onDidChangeProviders(() => {
      this._updateConfiguration();
    }));
    this._register(this._terminalContributionService.onDidChangeTerminalCompletionProviders(() => {
      this._updateConfiguration();
    }));
    this._updateConfiguration();
  }
  static initialize(instantiationService) {
    if (!this._instance) {
      this._instance = instantiationService.createInstance(TerminalSuggestProvidersConfigurationManager);
    }
  }
  _updateConfiguration() {
    const providers = /* @__PURE__ */ new Map();
    this._terminalContributionService.terminalCompletionProviders.forEach((o) => providers.set(o.extensionIdentifier, { ...o, id: o.extensionIdentifier }));
    for (const { id } of this._terminalCompletionService.providers) {
      if (id && !providers.has(id)) {
        providers.set(id, { id });
      }
    }
    registerTerminalSuggestProvidersConfiguration(providers);
  }
};
TerminalSuggestProvidersConfigurationManager = __decorateClass([
  __decorateParam(0, ITerminalCompletionService),
  __decorateParam(1, ITerminalContributionService)
], TerminalSuggestProvidersConfigurationManager);
