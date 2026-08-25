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
import { Codicon } from "../../../../../base/common/codicons.js";
import { Emitter } from "../../../../../base/common/event.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { URI } from "../../../../../base/common/uri.js";
import { Action2, MenuId, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { Extensions as ConfigurationExtensions, ConfigurationScope } from "../../../../../platform/configuration/common/configurationRegistry.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { BrowserViewCommandId, BrowserViewStorageScope } from "../../../../../platform/browserView/common/browserView.js";
import { workbenchConfigurationNodeBase } from "../../../../common/configuration.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { BrowserMaxHistoryEntriesSettingId } from "../browserViewWorkbenchService.js";
import {
  BROWSER_EDITOR_ACTIVE,
  BrowserActionCategory,
  BrowserActionGroup,
  BrowserEditor,
  BrowserEditorContribution
} from "../browserEditor.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { CONTEXT_BROWSER_STORAGE_SCOPE } from "./browserDataStorageFeatures.js";
const MAX_RECENTS = 3;
const MAX_HISTORY = 6;
let BrowserHistoryFeature = class extends BrowserEditorContribution {
  constructor(editor, _quickInputService) {
    super(editor);
    this._quickInputService = _quickInputService;
    this._modelDisposables = this._register(new DisposableStore());
    this._onDidChange = this._register(new Emitter());
    this._recentsProvider = {
      label: localize("browser.recents", "Recents"),
      order: 5,
      onDidChange: this._onDidChange.event,
      getSuggestions: async ({ input, text }) => this._buildRecents(input.url, text)
    };
    this._historyProvider = {
      label: localize("browser.history", "History"),
      order: 10,
      onDidChange: this._onDidChange.event,
      getSuggestions: async ({ input, text }) => this._buildHistory(input.url, text)
    };
  }
  get urlSuggestionProviders() {
    return [this._recentsProvider, this._historyProvider];
  }
  onModelAttached() {
    this._modelDisposables.clear();
    this._model = this.editor.model;
    this._history = this._model.history;
    this._modelDisposables.add(this._history.onDidChange(() => this._onDidChange.fire()));
    this._onDidChange.fire();
  }
  onModelDetached() {
    this._modelDisposables.clear();
    this._model = void 0;
    this._history = void 0;
    this._onDidChange.fire();
  }
  showManagementPicker() {
    const model = this._model;
    const history = this._history;
    if (!model || !history) {
      return;
    }
    showHistoryPicker(this._quickInputService, model, history);
  }
  _buildRecents(currentUrl, text) {
    if (text.trim().length > 0) {
      return [];
    }
    return this._buildList(
      currentUrl,
      "",
      /* onlyUserInitiated */
      true,
      MAX_RECENTS
    );
  }
  _buildHistory(currentUrl, text) {
    const needle = text.trim().toLowerCase();
    if (needle.length === 0) {
      return [];
    }
    return this._buildList(
      currentUrl,
      needle,
      /* onlyUserInitiated */
      false,
      MAX_HISTORY
    );
  }
  _buildList(currentUrl, needle, onlyUserInitiated, max) {
    const history = this._history;
    const model = this._model;
    if (!history || !model) {
      return [];
    }
    const entries = history.entries.items;
    if (entries.length === 0) {
      return [];
    }
    const seen = /* @__PURE__ */ new Set();
    if (currentUrl) {
      seen.add(dedupKey(currentUrl));
    }
    const out = [];
    for (let i = entries.length - 1; i >= 0 && out.length < max; i--) {
      const entry = entries[i];
      if (onlyUserInitiated && !entry.explicit) {
        continue;
      }
      const key = dedupKey(entry.url);
      if (seen.has(key)) {
        continue;
      }
      if (needle && !matches(entry, needle)) {
        continue;
      }
      seen.add(key);
      out.push(toSuggestion(model, history, entry));
    }
    return out;
  }
};
BrowserHistoryFeature = __decorateClass([
  __decorateParam(1, IQuickInputService)
], BrowserHistoryFeature);
BrowserEditor.registerContribution(BrowserHistoryFeature);
function toSuggestion(model, history, entry) {
  const label = entry.title || entry.url;
  const description = entry.title ? entry.url : void 0;
  const faviconUri = entry.icon ? resolveFavicon(history, entry.icon) : void 0;
  const deleteAction = {
    id: "browser.history.delete",
    iconClass: ThemeIcon.asClassName(Codicon.close),
    tooltip: localize("browser.removeFromHistory", "Remove from History"),
    run: () => model.deleteHistory([entry.id])
  };
  return {
    id: "history:" + entry.id,
    label,
    description,
    icon: faviconUri ? void 0 : Codicon.globe,
    iconPath: faviconUri ? { dark: faviconUri } : void 0,
    apply: (input) => input.navigate(entry.url),
    actions: [deleteAction]
  };
}
function dedupKey(url) {
  const parsed = URL.parse(url);
  if (!parsed) {
    return url;
  }
  return parsed.host + parsed.pathname;
}
function matches(entry, needle) {
  return entry.url.toLowerCase().includes(needle) || entry.title.toLowerCase().includes(needle);
}
function resolveFavicon(history, hash) {
  const dataUri = history.favicons.get(hash);
  if (!dataUri) {
    return void 0;
  }
  try {
    return URI.parse(dataUri);
  } catch {
    return void 0;
  }
}
function showHistoryPicker(quickInputService, model, history) {
  const disposables = new DisposableStore();
  const picker = disposables.add(quickInputService.createQuickPick({ useSeparators: true }));
  picker.title = localize("browser.history.title", "Browser History");
  picker.placeholder = localize("browser.history.placeholder", "Filter browser history");
  picker.matchOnDescription = true;
  picker.matchOnDetail = true;
  const clearAllButton = {
    iconClass: ThemeIcon.asClassName(Codicon.trash),
    tooltip: localize("browser.history.clearAll", "Clear All History")
  };
  const clearDayButton = {
    iconClass: ThemeIcon.asClassName(Codicon.trash),
    tooltip: localize("browser.history.clearDay", "Clear Entries for This Day")
  };
  const removeEntryButton = {
    iconClass: ThemeIcon.asClassName(Codicon.close),
    tooltip: localize("browser.removeFromHistory", "Remove from History")
  };
  picker.buttons = [clearAllButton];
  const rebuild = () => {
    picker.items = buildPickerItems(history, clearDayButton, removeEntryButton);
  };
  rebuild();
  disposables.add(history.onDidChange(rebuild));
  disposables.add(picker.onDidTriggerButton((button) => {
    if (button === clearAllButton) {
      void model.deleteHistory();
    }
  }));
  disposables.add(picker.onDidTriggerSeparatorButton(({ button, separator }) => {
    if (button === clearDayButton) {
      void model.deleteHistory(separator.entryIds);
    }
  }));
  disposables.add(picker.onDidTriggerItemButton(({ button, item }) => {
    if (button === removeEntryButton) {
      void model.deleteHistory([item.entryId]);
    }
  }));
  disposables.add(picker.onDidAccept(() => {
    const selected = picker.selectedItems[0];
    if (selected) {
      void model.loadURL(selected.entryUrl);
    }
    picker.hide();
  }));
  disposables.add(picker.onDidHide(() => disposables.dispose()));
  picker.show();
}
function buildPickerItems(history, clearDayButton, removeEntryButton) {
  const sorted = [...history.entries.items].sort((a, b) => b.time - a.time);
  const groups = /* @__PURE__ */ new Map();
  const orderedKeys = [];
  const now = /* @__PURE__ */ new Date();
  for (const entry of sorted) {
    const key = dayKey(entry.time);
    let group = groups.get(key);
    if (!group) {
      group = { label: dayLabel(entry.time, now), entries: [] };
      groups.set(key, group);
      orderedKeys.push(key);
    }
    group.entries.push(entry);
  }
  const out = [];
  for (const key of orderedKeys) {
    const group = groups.get(key);
    out.push({
      type: "separator",
      id: key,
      label: group.label,
      buttons: [clearDayButton],
      entryIds: group.entries.map((e) => e.id)
    });
    for (const entry of group.entries) {
      const faviconUri = entry.icon ? resolveFavicon(history, entry.icon) : void 0;
      out.push({
        label: entry.title || entry.url,
        description: entry.title ? entry.url : void 0,
        iconPath: faviconUri ? { dark: faviconUri } : void 0,
        iconClass: faviconUri ? void 0 : ThemeIcon.asClassName(Codicon.globe),
        buttons: [removeEntryButton],
        entryId: entry.id,
        entryUrl: entry.url
      });
    }
  }
  return out;
}
function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function dayLabel(ts, now) {
  const d = new Date(ts);
  if (isSameDay(d, now)) {
    return localize("browser.history.today", "Today");
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(d, yesterday)) {
    return localize("browser.history.yesterday", "Yesterday");
  }
  return d.toLocaleDateString(void 0, { year: "numeric", month: "long", day: "numeric" });
}
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
class ShowBrowserHistoryAction extends Action2 {
  static {
    this.ID = BrowserViewCommandId.ShowHistory;
  }
  constructor() {
    const when = ContextKeyExpr.and(BROWSER_EDITOR_ACTIVE, ContextKeyExpr.equals(CONTEXT_BROWSER_STORAGE_SCOPE.key, BrowserViewStorageScope.Ephemeral).negate());
    super({
      id: ShowBrowserHistoryAction.ID,
      title: localize2("browser.showHistory", "History"),
      category: BrowserActionCategory,
      icon: Codicon.history,
      f1: true,
      precondition: when,
      menu: {
        id: MenuId.BrowserActionsToolbar,
        group: BrowserActionGroup.Data,
        order: 1,
        when,
        isHiddenByDefault: true
      },
      keybinding: {
        primary: KeyMod.CtrlCmd | KeyCode.KeyH,
        mac: { primary: KeyMod.CtrlCmd | KeyCode.KeyY },
        weight: KeybindingWeight.WorkbenchContrib
      }
    });
  }
  async run(accessor, browserEditor = accessor.get(IEditorService).activeEditorPane) {
    if (browserEditor instanceof BrowserEditor) {
      browserEditor.getContribution(BrowserHistoryFeature)?.showManagementPicker();
    }
  }
}
registerAction2(ShowBrowserHistoryAction);
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  ...workbenchConfigurationNodeBase,
  properties: {
    [BrowserMaxHistoryEntriesSettingId]: {
      type: "integer",
      default: 200,
      minimum: 0,
      maximum: 1e4,
      scope: ConfigurationScope.APPLICATION,
      description: localize("browser.maxHistoryEntries", "Maximum number of history items kept per session scope. Older entries are evicted first."),
      order: 110
    }
  }
});
export {
  BrowserHistoryFeature
};
