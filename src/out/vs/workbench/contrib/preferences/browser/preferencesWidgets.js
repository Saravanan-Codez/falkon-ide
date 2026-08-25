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
import { ActionBar, ActionsOrientation } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { BaseActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { Widget } from "../../../../base/browser/ui/widget.js";
import { Action } from "../../../../base/common/actions.js";
import { Emitter } from "../../../../base/common/event.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { isEqual } from "../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { URI } from "../../../../base/common/uri.js";
import { MouseTargetType } from "../../../../editor/browser/editorBrowser.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { TrackedRangeStickiness } from "../../../../editor/common/model.js";
import { localize } from "../../../../nls.js";
import { ConfigurationTarget } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService, IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { ContextScopedHistoryInputBox } from "../../../../platform/history/browser/contextScopedHistoryWidget.js";
import { showHistoryKeybindingHint } from "../../../../platform/history/browser/historyWidgetKeybindingHint.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { asCssVariable, badgeBackground, badgeForeground, contrastBorder } from "../../../../platform/theme/common/colorRegistry.js";
import { isWorkspaceFolder, IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { settingsEditIcon, settingsScopeDropDownIcon } from "./preferencesIcons.js";
let FolderSettingsActionViewItem = class extends BaseActionViewItem {
  constructor(action, contextService, contextMenuService, hoverService) {
    super(null, action);
    this.contextService = contextService;
    this.contextMenuService = contextMenuService;
    this.hoverService = hoverService;
    this._folderSettingCounts = /* @__PURE__ */ new Map();
    const workspace = this.contextService.getWorkspace();
    this._folder = workspace.folders.length === 1 ? workspace.folders[0] : null;
    this._register(this.contextService.onDidChangeWorkspaceFolders(() => this.onWorkspaceFoldersChanged()));
  }
  get folder() {
    return this._folder;
  }
  set folder(folder) {
    this._folder = folder;
    this.update();
  }
  setCount(settingsTarget, count) {
    const workspaceFolder = this.contextService.getWorkspaceFolder(settingsTarget);
    if (!workspaceFolder) {
      throw new Error("unknown folder");
    }
    const folder = workspaceFolder.uri;
    this._folderSettingCounts.set(folder.toString(), count);
    this.update();
  }
  render(container) {
    this.element = container;
    this.container = container;
    this.labelElement = DOM.$(".action-title");
    this.detailsElement = DOM.$(".action-details");
    this.dropDownElement = DOM.$(".dropdown-icon.hide" + ThemeIcon.asCSSSelector(settingsScopeDropDownIcon));
    this.anchorElement = DOM.$("a.action-label.folder-settings", {
      role: "button",
      "aria-haspopup": "true",
      "tabindex": "0"
    }, this.labelElement, this.detailsElement, this.dropDownElement);
    this.anchorElementHover = this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), this.anchorElement, ""));
    this._register(DOM.addDisposableListener(this.anchorElement, DOM.EventType.MOUSE_DOWN, (e) => DOM.EventHelper.stop(e)));
    this._register(DOM.addDisposableListener(this.anchorElement, DOM.EventType.CLICK, (e) => this.onClick(e)));
    this._register(DOM.addDisposableListener(this.container, DOM.EventType.KEY_UP, (e) => this.onKeyUp(e)));
    DOM.append(this.container, this.anchorElement);
    this.update();
  }
  onKeyUp(event) {
    const keyboardEvent = new StandardKeyboardEvent(event);
    switch (keyboardEvent.keyCode) {
      case KeyCode.Enter:
      case KeyCode.Space:
        this.onClick(event);
        return;
    }
  }
  onClick(event) {
    DOM.EventHelper.stop(event, true);
    if (!this.folder || this._action.checked) {
      this.showMenu();
    } else {
      this._action.run(this._folder);
    }
  }
  updateEnabled() {
    this.update();
  }
  updateChecked() {
    this.update();
  }
  onWorkspaceFoldersChanged() {
    const oldFolder = this._folder;
    const workspace = this.contextService.getWorkspace();
    if (oldFolder) {
      this._folder = workspace.folders.filter((folder) => isEqual(folder.uri, oldFolder.uri))[0] || workspace.folders[0];
    }
    this._folder = this._folder ? this._folder : workspace.folders.length === 1 ? workspace.folders[0] : null;
    this.update();
    if (this._action.checked) {
      this._action.run(this._folder);
    }
  }
  update() {
    let total = 0;
    this._folderSettingCounts.forEach((n) => total += n);
    const workspace = this.contextService.getWorkspace();
    if (this._folder) {
      this.labelElement.textContent = this._folder.name;
      this.anchorElementHover.update(this._folder.name);
      const detailsText = this.labelWithCount(this._action.label, total);
      this.detailsElement.textContent = detailsText;
      this.dropDownElement.classList.toggle("hide", workspace.folders.length === 1 || !this._action.checked);
    } else {
      const labelText = this.labelWithCount(this._action.label, total);
      this.labelElement.textContent = labelText;
      this.detailsElement.textContent = "";
      this.anchorElementHover.update(this._action.label);
      this.dropDownElement.classList.remove("hide");
    }
    this.anchorElement.classList.toggle("checked", this._action.checked);
    this.container.classList.toggle("disabled", !this._action.enabled);
  }
  showMenu() {
    this.contextMenuService.showContextMenu({
      getAnchor: () => this.container,
      getActions: () => this.getDropdownMenuActions(),
      getActionViewItem: () => void 0,
      onHide: () => {
        this.anchorElement.blur();
      }
    });
  }
  getDropdownMenuActions() {
    const actions = [];
    const workspaceFolders = this.contextService.getWorkspace().folders;
    if (this.contextService.getWorkbenchState() === WorkbenchState.WORKSPACE && workspaceFolders.length > 0) {
      actions.push(...workspaceFolders.map((folder, index) => {
        const folderCount = this._folderSettingCounts.get(folder.uri.toString());
        return {
          id: "folderSettingsTarget" + index,
          label: this.labelWithCount(folder.name, folderCount),
          tooltip: this.labelWithCount(folder.name, folderCount),
          checked: !!this.folder && isEqual(this.folder.uri, folder.uri),
          enabled: true,
          class: void 0,
          run: () => this._action.run(folder)
        };
      }));
    }
    return actions;
  }
  labelWithCount(label, count) {
    if (count) {
      label += ` (${count})`;
    }
    return label;
  }
};
FolderSettingsActionViewItem = __decorateClass([
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IHoverService)
], FolderSettingsActionViewItem);
let SettingsTargetsWidget = class extends Widget {
  constructor(parent, options, contextService, instantiationService, environmentService, labelService, languageService) {
    super();
    this.contextService = contextService;
    this.instantiationService = instantiationService;
    this.environmentService = environmentService;
    this.labelService = labelService;
    this.languageService = languageService;
    this._settingsTarget = null;
    this._onDidTargetChange = this._register(new Emitter());
    this.onDidTargetChange = this._onDidTargetChange.event;
    this.options = options ?? {};
    this.create(parent);
    this._register(this.contextService.onDidChangeWorkbenchState(() => this.onWorkbenchStateChanged()));
    this._register(this.contextService.onDidChangeWorkspaceFolders(() => this.update()));
  }
  resetLabels() {
    const remoteAuthority = this.environmentService.remoteAuthority;
    const hostLabel = remoteAuthority && this.labelService.getHostLabel(Schemas.vscodeRemote, remoteAuthority);
    this.userLocalSettings.label = localize("userSettings", "User");
    this.userRemoteSettings.label = localize("userSettingsRemote", "Remote") + (hostLabel ? ` [${hostLabel}]` : "");
    this.workspaceSettings.label = this.contextService.getWorkspace().name || localize("workspaceSettings", "Workspace");
    this.folderSettingsAction.label = localize("folderSettings", "Folder");
  }
  create(parent) {
    const settingsTabsWidget = DOM.append(parent, DOM.$(".settings-tabs-widget"));
    this.settingsSwitcherBar = this._register(new ActionBar(settingsTabsWidget, {
      orientation: ActionsOrientation.HORIZONTAL,
      focusOnlyEnabledItems: true,
      ariaLabel: localize("settingsSwitcherBarAriaLabel", "Settings Switcher"),
      ariaRole: "tablist",
      actionViewItemProvider: (action, options) => action.id === "folderSettings" ? this.folderSettings : void 0
    }));
    this.userLocalSettings = this._register(new Action("userSettings", "", ".settings-tab", true, () => this.updateTarget(ConfigurationTarget.USER_LOCAL)));
    this.userLocalSettings.tooltip = localize("userSettings", "User");
    this.userRemoteSettings = this._register(new Action("userSettingsRemote", "", ".settings-tab", true, () => this.updateTarget(ConfigurationTarget.USER_REMOTE)));
    const remoteAuthority = this.environmentService.remoteAuthority;
    const hostLabel = remoteAuthority && this.labelService.getHostLabel(Schemas.vscodeRemote, remoteAuthority);
    this.userRemoteSettings.tooltip = localize("userSettingsRemote", "Remote") + (hostLabel ? ` [${hostLabel}]` : "");
    this.workspaceSettings = this._register(new Action("workspaceSettings", "", ".settings-tab", false, () => this.updateTarget(ConfigurationTarget.WORKSPACE)));
    this.folderSettingsAction = this._register(new Action("folderSettings", "", ".settings-tab", false, async (folder) => {
      this.updateTarget(isWorkspaceFolder(folder) ? folder.uri : ConfigurationTarget.USER_LOCAL);
    }));
    this.folderSettings = this._register(this.instantiationService.createInstance(FolderSettingsActionViewItem, this.folderSettingsAction));
    this.resetLabels();
    this.update();
    this.settingsSwitcherBar.push([this.userLocalSettings, this.userRemoteSettings, this.workspaceSettings, this.folderSettingsAction]);
  }
  get settingsTarget() {
    return this._settingsTarget;
  }
  set settingsTarget(settingsTarget) {
    this._settingsTarget = settingsTarget;
    this.userLocalSettings.checked = ConfigurationTarget.USER_LOCAL === this.settingsTarget;
    this.userRemoteSettings.checked = ConfigurationTarget.USER_REMOTE === this.settingsTarget;
    this.workspaceSettings.checked = ConfigurationTarget.WORKSPACE === this.settingsTarget;
    if (this.settingsTarget instanceof URI) {
      this.folderSettings.action.checked = true;
      this.folderSettings.folder = this.contextService.getWorkspaceFolder(this.settingsTarget);
    } else {
      this.folderSettings.action.checked = false;
    }
  }
  setResultCount(settingsTarget, count) {
    if (settingsTarget === ConfigurationTarget.WORKSPACE) {
      let label = this.contextService.getWorkspace().name ?? localize("workspaceSettings", "Workspace");
      if (count) {
        label += ` (${count})`;
      }
      this.workspaceSettings.label = label;
    } else if (settingsTarget === ConfigurationTarget.USER_LOCAL) {
      let label = localize("userSettings", "User");
      if (count) {
        label += ` (${count})`;
      }
      this.userLocalSettings.label = label;
    } else if (settingsTarget instanceof URI) {
      this.folderSettings.setCount(settingsTarget, count);
    }
  }
  updateLanguageFilterIndicators(filter) {
    this.resetLabels();
    if (filter) {
      const languageToUse = this.languageService.getLanguageName(filter);
      if (languageToUse) {
        const languageSuffix = ` [${languageToUse}]`;
        this.userLocalSettings.label += languageSuffix;
        this.userRemoteSettings.label += languageSuffix;
        this.workspaceSettings.label += languageSuffix;
        this.folderSettingsAction.label += languageSuffix;
      }
    }
  }
  onWorkbenchStateChanged() {
    this.folderSettings.folder = null;
    this.update();
    if (this.settingsTarget === ConfigurationTarget.WORKSPACE && this.contextService.getWorkbenchState() === WorkbenchState.WORKSPACE) {
      this.updateTarget(ConfigurationTarget.USER_LOCAL);
    }
  }
  updateTarget(settingsTarget) {
    const isSameTarget = this.settingsTarget === settingsTarget || settingsTarget instanceof URI && this.settingsTarget instanceof URI && isEqual(this.settingsTarget, settingsTarget);
    if (!isSameTarget) {
      this.settingsTarget = settingsTarget;
      this._onDidTargetChange.fire(this.settingsTarget);
    }
    return Promise.resolve(void 0);
  }
  async update() {
    this.settingsSwitcherBar.domNode.classList.toggle("empty-workbench", this.contextService.getWorkbenchState() === WorkbenchState.EMPTY);
    this.userRemoteSettings.enabled = !!(this.options.enableRemoteSettings && this.environmentService.remoteAuthority);
    this.workspaceSettings.enabled = this.contextService.getWorkbenchState() !== WorkbenchState.EMPTY;
    this.folderSettings.action.enabled = this.contextService.getWorkbenchState() === WorkbenchState.WORKSPACE && this.contextService.getWorkspace().folders.length > 0;
    this.workspaceSettings.tooltip = localize("workspaceSettings", "Workspace");
  }
};
SettingsTargetsWidget = __decorateClass([
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IWorkbenchEnvironmentService),
  __decorateParam(5, ILabelService),
  __decorateParam(6, ILanguageService)
], SettingsTargetsWidget);
let SearchWidget = class extends Widget {
  constructor(parent, options, contextViewService, instantiationService, contextKeyService, keybindingService) {
    super();
    this.options = options;
    this.contextViewService = contextViewService;
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.keybindingService = keybindingService;
    this._onDidChange = this._register(new Emitter());
    this._onFocus = this._register(new Emitter());
    this.create(parent);
  }
  get onDidChange() {
    return this._onDidChange.event;
  }
  get onFocus() {
    return this._onFocus.event;
  }
  create(parent) {
    this.domNode = DOM.append(parent, DOM.$("div.settings-header-widget"));
    this.createSearchContainer(DOM.append(this.domNode, DOM.$("div.settings-search-container")));
    this.controlsDiv = DOM.append(this.domNode, DOM.$("div.settings-search-controls"));
    if (this.options.showResultCount) {
      this.countElement = DOM.append(this.controlsDiv, DOM.$(".settings-count-widget"));
      this.countElement.style.backgroundColor = asCssVariable(badgeBackground);
      this.countElement.style.color = asCssVariable(badgeForeground);
      this.countElement.style.border = `1px solid ${asCssVariable(contrastBorder)}`;
    }
    this.inputBox.inputElement.setAttribute("aria-live", this.options.ariaLive || "off");
    if (this.options.ariaLabelledBy) {
      this.inputBox.inputElement.setAttribute("aria-labelledBy", this.options.ariaLabelledBy);
    }
    const focusTracker = this._register(DOM.trackFocus(this.inputBox.inputElement));
    this._register(focusTracker.onDidFocus(() => this._onFocus.fire()));
    const focusKey = this.options.focusKey;
    if (focusKey) {
      this._register(focusTracker.onDidFocus(() => focusKey.set(true)));
      this._register(focusTracker.onDidBlur(() => focusKey.set(false)));
    }
  }
  createSearchContainer(searchContainer) {
    this.searchContainer = searchContainer;
    const searchInput = DOM.append(this.searchContainer, DOM.$("div.settings-search-input"));
    this.inputBox = this._register(this.createInputBox(searchInput));
    this._register(this.inputBox.onDidChange((value) => this._onDidChange.fire(value)));
  }
  createInputBox(parent) {
    const showHistoryHint = () => showHistoryKeybindingHint(this.keybindingService);
    return new ContextScopedHistoryInputBox(parent, this.contextViewService, { ...this.options, showHistoryHint }, this.contextKeyService);
  }
  showMessage(message) {
    if (this.countElement && message !== this.countElement.textContent) {
      this.countElement.textContent = message;
      this.inputBox.inputElement.setAttribute("aria-label", message);
      this.inputBox.inputElement.style.paddingRight = this.getControlsWidth() + "px";
    }
  }
  layout(dimension) {
    if (dimension.width < 400) {
      this.countElement?.classList.add("hide");
      this.inputBox.inputElement.style.paddingRight = "0px";
    } else {
      this.countElement?.classList.remove("hide");
      this.inputBox.inputElement.style.paddingRight = this.getControlsWidth() + "px";
    }
  }
  getControlsWidth() {
    const countWidth = this.countElement ? DOM.getTotalWidth(this.countElement) : 0;
    return countWidth + 20;
  }
  focus() {
    this.inputBox.focus();
    if (this.getValue()) {
      this.inputBox.select();
    }
  }
  hasFocus() {
    return this.inputBox.hasFocus();
  }
  clear() {
    this.inputBox.value = "";
  }
  getValue() {
    return this.inputBox.value;
  }
  setValue(value) {
    return this.inputBox.value = value;
  }
  dispose() {
    this.options.focusKey?.set(false);
    super.dispose();
  }
};
SearchWidget = __decorateClass([
  __decorateParam(2, IContextViewService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IKeybindingService)
], SearchWidget);
class EditPreferenceWidget extends Disposable {
  constructor(editor) {
    super();
    this.editor = editor;
    this._line = -1;
    this._preferences = [];
    this._onClick = this._register(new Emitter());
    this.onClick = this._onClick.event;
    this._editPreferenceDecoration = this.editor.createDecorationsCollection();
    this._register(this.editor.onMouseDown((e) => {
      if (e.target.type !== MouseTargetType.GUTTER_GLYPH_MARGIN || e.target.detail.isAfterLines || !this.isVisible()) {
        return;
      }
      this._onClick.fire(e);
    }));
  }
  get preferences() {
    return this._preferences;
  }
  getLine() {
    return this._line;
  }
  show(line, hoverMessage, preferences) {
    this._preferences = preferences;
    const newDecoration = [];
    this._line = line;
    newDecoration.push({
      options: {
        description: "edit-preference-widget-decoration",
        glyphMarginClassName: ThemeIcon.asClassName(settingsEditIcon),
        glyphMarginHoverMessage: new MarkdownString().appendText(hoverMessage),
        stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
      },
      range: {
        startLineNumber: line,
        startColumn: 1,
        endLineNumber: line,
        endColumn: 1
      }
    });
    this._editPreferenceDecoration.set(newDecoration);
  }
  hide() {
    this._editPreferenceDecoration.clear();
  }
  isVisible() {
    return this._editPreferenceDecoration.length > 0;
  }
  dispose() {
    this.hide();
    super.dispose();
  }
}
export {
  EditPreferenceWidget,
  FolderSettingsActionViewItem,
  SearchWidget,
  SettingsTargetsWidget
};
