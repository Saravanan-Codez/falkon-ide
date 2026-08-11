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
import "./media/unifiedQuickAccess.css";
import { $, addDisposableListener, EventType } from "../../../../../../base/browser/dom.js";
import { Disposable, DisposableStore, isDisposable } from "../../../../../../base/common/lifecycle.js";
import { IQuickInputService } from "../../../../../../platform/quickinput/common/quickInput.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { localize } from "../../../../../../nls.js";
import { Radio } from "../../../../../../base/browser/ui/radio/radio.js";
import { CancellationTokenSource } from "../../../../../../base/common/cancellation.js";
import { Extensions } from "../../../../../../platform/quickinput/common/quickAccess.js";
import { Registry } from "../../../../../../platform/registry/common/platform.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { createInstantHoverDelegate, getDefaultHoverDelegate } from "../../../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { IHoverService } from "../../../../../../platform/hover/browser/hover.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { renderIcon } from "../../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Event } from "../../../../../../base/common/event.js";
import { ILayoutService } from "../../../../../../platform/layout/browser/layoutService.js";
import { ICommandService } from "../../../../../../platform/commands/common/commands.js";
import { IKeybindingService } from "../../../../../../platform/keybinding/common/keybinding.js";
import { ACTION_ID_NEW_CHAT, CHAT_OPEN_ACTION_ID } from "../../actions/chatActions.js";
const SEND_TO_AGENT_ID = "unified-quick-access-send-to-agent";
const DEFAULT_UNIFIED_QUICK_ACCESS_TABS = [
  {
    id: "agentSessions",
    label: localize("agentSessionsTab", "Sessions"),
    prefix: "agent ",
    placeholder: localize("agentSessionsPlaceholder", "Search sessions or type a message..."),
    tooltip: localize("agentSessionsTooltip", "Search sessions or send a message to agent")
  },
  {
    id: "commands",
    label: localize("commandsTab", "Commands"),
    prefix: ">",
    placeholder: localize("commandsPlaceholder", "Search commands..."),
    tooltip: localize("commandsTooltip", "Run commands")
  },
  {
    id: "files",
    label: localize("filesTab", "Files"),
    prefix: "",
    placeholder: localize("filesPlaceholder", "Search files..."),
    tooltip: localize("filesTooltip", "Go to files")
  }
];
let UnifiedQuickAccess = class extends Disposable {
  constructor(tabs, quickInputService, instantiationService, contextKeyService, layoutService, commandService, keybindingService, hoverService) {
    super();
    this.quickInputService = quickInputService;
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.layoutService = layoutService;
    this.commandService = commandService;
    this.keybindingService = keybindingService;
    this.hoverService = hoverService;
    this.registry = Registry.as(Extensions.Quickaccess);
    this.mapProviderToDescriptor = /* @__PURE__ */ new Map();
    this._currentDisposables = this._register(new DisposableStore());
    this._providerDisposables = this._register(new DisposableStore());
    this._isInternalValueChange = false;
    // Flag to prevent recursive tab detection
    this._isUpdatingSendToAgent = false;
    this._tabs = tabs ?? DEFAULT_UNIFIED_QUICK_ACCESS_TABS;
  }
  /**
   * Show the unified quick access widget.
   * @param initialTabId Optional tab ID to start with. Defaults to first tab.
   * @param initialValue Optional initial filter value.
   */
  show(initialTabId, initialValue) {
    if (this._currentPicker) {
      return;
    }
    this._currentDisposables.clear();
    const picker = this._currentDisposables.add(this.quickInputService.createQuickPick({ useSeparators: true }));
    this._currentPicker = picker;
    picker.ignoreFocusOut = false;
    picker.matchOnDescription = true;
    picker.matchOnDetail = true;
    picker.sortByLabel = false;
    const initialTab = initialTabId ? this._tabs.find((t) => t.id === initialTabId) ?? this._tabs[0] : this._tabs[0];
    this._currentTab = initialTab;
    this._injectTabBar(picker);
    this._isInternalValueChange = true;
    picker.value = initialValue ?? "";
    picker.placeholder = initialTab.placeholder;
    this._isInternalValueChange = false;
    this._activateProvider(initialTab, picker);
    this._currentDisposables.add(picker.onDidChangeValue((value) => {
      if (this._isInternalValueChange) {
        return;
      }
      if (this._arrivedViaShortcut) {
        const shortcut = this._arrivedViaShortcut;
        if (!value.startsWith(shortcut)) {
          const filesTab = this._tabs.find((t) => t.id === "files");
          if (filesTab && filesTab !== this._currentTab) {
            this._arrivedViaShortcut = void 0;
            this._switchTab(filesTab, picker, false);
            return;
          }
        }
      }
      const matchingTab = this._detectTabFromValue(value);
      if (matchingTab && matchingTab !== this._currentTab) {
        this._switchTab(matchingTab, picker, true);
      }
      this._updateSendButtonState(value);
      if (this._sendToAgentTimeout) {
        clearTimeout(this._sendToAgentTimeout);
      }
      this._sendToAgentTimeout = setTimeout(() => this._maybeShowSendToAgent(picker), 150);
    }));
    this._currentDisposables.add(picker.onDidAccept(() => {
      const selectedItems = picker.selectedItems;
      const activeItems = picker.activeItems;
      const sendToAgentSelected = selectedItems.length > 0 && selectedItems[0].id === SEND_TO_AGENT_ID;
      const hasRealActiveItem = activeItems.some(
        (item) => item.id !== SEND_TO_AGENT_ID
      );
      let filterText;
      if (this._arrivedViaShortcut && picker.value.startsWith(this._arrivedViaShortcut)) {
        filterText = picker.value.substring(1).trim();
      } else if (this._currentTab) {
        filterText = picker.value.substring(this._currentTab.prefix.length).trim();
      } else {
        filterText = picker.value.trim();
      }
      if (sendToAgentSelected || !hasRealActiveItem && filterText) {
        this._sendMessage(picker.value);
      }
    }));
    this._currentDisposables.add(picker.onDidHide(() => {
      this._providerDisposables.clear();
      this._providerCts?.cancel();
      this._providerCts = void 0;
      this._currentPicker = void 0;
      this._currentTab = void 0;
      this._arrivedViaShortcut = void 0;
      if (this._sendToAgentTimeout) {
        clearTimeout(this._sendToAgentTimeout);
        this._sendToAgentTimeout = void 0;
      }
      this._tabBarContainer?.remove();
      this._tabBarContainer = void 0;
      this._sendButton = void 0;
      this._sendButtonLabel = void 0;
      this._sendButtonIcon = void 0;
      this._sendButtonHover = void 0;
      this._currentDisposables.clear();
    }));
    picker.show();
  }
  /**
   * Hide the unified quick access widget if visible.
   */
  hide() {
    this._currentPicker?.hide();
  }
  /**
   * Check if the widget is currently visible.
   */
  get isVisible() {
    return !!this._currentPicker;
  }
  /**
   * Inject the custom tab bar into the picker's header area.
   */
  _injectTabBar(picker) {
    const showDisposable = this._currentDisposables.add(Event.once(this.quickInputService.onShow)(() => {
      this._currentDisposables.delete(showDisposable);
      const quickInputWidget = this.layoutService.activeContainer.querySelector(".quick-input-widget");
      if (!quickInputWidget) {
        return;
      }
      const header = quickInputWidget.querySelector(".quick-input-header");
      const list = quickInputWidget.querySelector(".quick-input-list");
      if (!header || !list) {
        return;
      }
      const tabBarContainer = $("div.unified-quick-access-tabs");
      this._tabBarContainer = tabBarContainer;
      const hoverDelegate = this._currentDisposables.add(createInstantHoverDelegate());
      const radioItems = this._tabs.map((tab) => ({
        text: tab.label,
        tooltip: tab.tooltip,
        isActive: tab === this._currentTab
      }));
      const radio = this._currentDisposables.add(new Radio({
        items: radioItems,
        hoverDelegate
      }));
      tabBarContainer.appendChild(radio.domNode);
      this._currentDisposables.add(radio.onDidSelect((index) => {
        const selectedTab = this._tabs[index];
        if (selectedTab && selectedTab !== this._currentTab) {
          this._switchTab(selectedTab, picker, false);
        }
      }));
      const sendButton = this._createSendButton(picker);
      tabBarContainer.appendChild(sendButton);
      list.parentElement?.insertBefore(tabBarContainer, list);
      picker._unifiedRadio = radio;
    }));
  }
  /**
   * Create the send button.
   */
  _createSendButton(picker) {
    const container = $("div.unified-quick-access-send-container");
    const button = $("button.unified-send-button");
    button.setAttribute("type", "button");
    this._sendButton = button;
    const icon = renderIcon(Codicon.send);
    icon.classList.add("unified-send-icon");
    this._sendButtonIcon = icon;
    button.appendChild(icon);
    const labelSpan = $("span.unified-send-label");
    this._sendButtonLabel = labelSpan;
    button.appendChild(labelSpan);
    container.appendChild(button);
    this._sendButtonHover = this._currentDisposables.add(
      this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), button, "")
    );
    this._updateSendButtonState(picker.value);
    this._currentDisposables.add(addDisposableListener(button, EventType.CLICK, (e) => {
      e.preventDefault();
      e.stopPropagation();
      const hasInput = picker.value.trim().length > 0;
      if (hasInput) {
        this._sendMessageRaw(picker.value);
      } else {
        this._openChat();
      }
    }));
    return container;
  }
  /**
   * Update the send button label and tooltip based on input state.
   */
  _updateSendButtonState(value) {
    if (!this._sendButton || !this._sendButtonLabel || !this._sendButtonIcon) {
      return;
    }
    const hasInput = value.trim().length > 0;
    if (hasInput) {
      this._sendButtonLabel.textContent = localize("send", "Send");
      this._sendButtonHover?.update(localize("sendTooltipNoKeybinding", "Send message to new agent session"));
      this._sendButtonIcon.style.display = "";
    } else {
      const openChatKeybinding = this.keybindingService.lookupKeybinding(CHAT_OPEN_ACTION_ID);
      const openChatLabel = openChatKeybinding?.getLabel() ?? "";
      this._sendButtonLabel.textContent = localize("openChat", "Open Chat");
      const tooltip = openChatLabel ? localize("openChatTooltipWithKeybinding", "Open chat ({0})", openChatLabel) : localize("openChatTooltipNoKeybinding", "Open chat");
      this._sendButtonHover?.update(tooltip);
      this._sendButtonIcon.style.display = "none";
    }
  }
  /**
   * Open chat without sending a message.
   */
  _openChat() {
    this.hide();
    this.commandService.executeCommand(CHAT_OPEN_ACTION_ID);
  }
  /**
   * Send the exact message to a new agent session (no prefix stripping).
   */
  async _sendMessageRaw(value) {
    const message = value.trim();
    if (!message) {
      return;
    }
    this.hide();
    await this.commandService.executeCommand(ACTION_ID_NEW_CHAT);
    const options = {
      query: message,
      isPartialQuery: false
    };
    this.commandService.executeCommand(CHAT_OPEN_ACTION_ID, options);
  }
  /**
   * Send the current message to a new agent session (strips prefix or shortcut character).
   */
  async _sendMessage(value) {
    let message = value;
    if (this._arrivedViaShortcut && message.startsWith(this._arrivedViaShortcut)) {
      message = message.substring(1).trim();
    } else if (this._currentTab) {
      if (value.startsWith(this._currentTab.prefix)) {
        message = value.substring(this._currentTab.prefix.length).trim();
      }
    }
    if (!message) {
      return;
    }
    this.hide();
    await this.commandService.executeCommand(ACTION_ID_NEW_CHAT);
    const options = {
      query: message,
      isPartialQuery: false
    };
    this.commandService.executeCommand(CHAT_OPEN_ACTION_ID, options);
  }
  /**
   * Check if we should show the "send to agent" item.
   * Always shows it as the first item when user has typed something.
   */
  _maybeShowSendToAgent(picker) {
    if (this._isUpdatingSendToAgent) {
      return;
    }
    let filterText;
    if (this._arrivedViaShortcut && picker.value.startsWith(this._arrivedViaShortcut)) {
      filterText = picker.value.substring(1).trim();
    } else if (this._currentTab) {
      filterText = picker.value.substring(this._currentTab.prefix.length).trim();
    } else {
      filterText = picker.value.trim();
    }
    const fullInput = picker.value.trim();
    const messageToSend = filterText || fullInput;
    if (!messageToSend) {
      return;
    }
    if (picker.busy) {
      return;
    }
    const firstItem = picker.items[0];
    if (firstItem?.id === SEND_TO_AGENT_ID && firstItem.description === fullInput) {
      return;
    }
    const sendItem = {
      id: SEND_TO_AGENT_ID,
      label: `$(send) ${localize("sendToAgentLabel", "Send to agent")}`,
      description: fullInput,
      alwaysShow: true,
      ariaLabel: localize("sendToAgentAria", "Send message to agent: {0}", fullInput)
    };
    const currentItems = picker.items.filter(
      (item) => item.id !== SEND_TO_AGENT_ID
    );
    const isSessionsTab = this._currentTab?.id === "agentSessions";
    const hasOtherItems = currentItems.length > 0;
    const showFirst = isSessionsTab || !hasOtherItems;
    this._isUpdatingSendToAgent = true;
    try {
      if (showFirst) {
        picker.items = [sendItem, ...currentItems];
      } else {
        picker.items = currentItems;
      }
    } finally {
      this._isUpdatingSendToAgent = false;
    }
  }
  /**
   * Switch to a different tab.
   */
  _switchTab(tab, picker, preserveFilterText) {
    if (tab === this._currentTab) {
      return;
    }
    const previousTab = this._currentTab;
    this._currentTab = tab;
    const radio = picker._unifiedRadio;
    if (radio) {
      const index = this._tabs.indexOf(tab);
      if (index >= 0) {
        radio.setActiveItem(index);
      }
    }
    this._isInternalValueChange = true;
    if (preserveFilterText && previousTab) {
      const currentValue = picker.value;
      let filterText = currentValue;
      if (currentValue.startsWith(previousTab.prefix)) {
        filterText = currentValue.substring(previousTab.prefix.length);
      }
      if (this._arrivedViaShortcut === "<" && tab.id === "agentSessions") {
        filterText = filterText.replace(/^<+/, "");
        picker.value = "<" + filterText;
      } else if (this._arrivedViaShortcut === ">" && tab.id === "commands") {
        filterText = filterText.replace(/^>+/, "");
        picker.value = ">" + filterText;
      } else {
        picker.value = tab.prefix + filterText;
      }
    } else if (previousTab) {
      const currentValue = picker.value;
      if (currentValue.startsWith(previousTab.prefix)) {
        picker.value = currentValue.substring(previousTab.prefix.length);
      }
      if (picker.value.startsWith("<") || picker.value.startsWith(">")) {
        picker.value = picker.value.substring(1);
      }
      this._arrivedViaShortcut = void 0;
    }
    this._isInternalValueChange = false;
    picker.placeholder = tab.placeholder;
    this._activateProvider(tab, picker);
  }
  /**
   * Detect which tab matches the current value based on prefix.
   * Only switches away from current tab if user explicitly typed a different prefix.
   * Supports shortcut keys: ">" for Commands, "<" for Sessions.
   */
  _detectTabFromValue(value) {
    if (value === "<" || value.startsWith("<")) {
      const sessionsTab = this._tabs.find((t) => t.id === "agentSessions");
      if (sessionsTab && this._currentTab?.id !== "agentSessions") {
        this._arrivedViaShortcut = "<";
        return sessionsTab;
      }
    }
    if (value === ">" || value.startsWith(">")) {
      const commandsTab = this._tabs.find((t) => t.id === "commands");
      if (commandsTab && this._currentTab?.id !== "commands") {
        this._arrivedViaShortcut = ">";
        return commandsTab;
      }
    }
    if (this._currentTab && value.startsWith(this._currentTab.prefix)) {
      return this._currentTab;
    }
    const sortedTabs = [...this._tabs].filter((tab) => tab.prefix.length > 0).sort((a, b) => b.prefix.length - a.prefix.length);
    return sortedTabs.find((tab) => value.startsWith(tab.prefix));
  }
  /**
   * Activate the provider for a given tab.
   */
  _activateProvider(tab, picker) {
    this._providerDisposables.clear();
    this._providerCts?.cancel();
    this._providerCts = new CancellationTokenSource();
    this._providerDisposables.add(this._providerCts);
    if (tab.isSendTab) {
      picker.busy = false;
      picker.items = [{
        label: localize("pressSendOrEnter", "Press Enter or click Send to create a new agent session"),
        alwaysShow: true
      }];
      return;
    }
    picker.items = [];
    picker.busy = true;
    const [provider] = this._getOrInstantiateProvider(tab.prefix);
    if (provider) {
      const tabPrefix = tab.prefix;
      const arrivedViaShortcut = this._arrivedViaShortcut;
      picker.filterValue = (value) => {
        if (arrivedViaShortcut && value.startsWith(arrivedViaShortcut)) {
          return value.substring(1);
        }
        if (value.startsWith(tabPrefix)) {
          return value.substring(tabPrefix.length);
        }
        return value;
      };
      const providerDisposable = provider.provide(picker, this._providerCts.token);
      this._providerDisposables.add(providerDisposable);
    } else {
      picker.busy = false;
      picker.items = [{
        label: localize("noProvider", "No provider available for this tab"),
        alwaysShow: true
      }];
    }
  }
  /**
   * Get or create a provider instance for the given prefix.
   */
  _getOrInstantiateProvider(prefix) {
    const providerDescriptor = this.registry.getQuickAccessProvider(prefix, this.contextKeyService);
    if (!providerDescriptor) {
      return [void 0, void 0];
    }
    let provider = this.mapProviderToDescriptor.get(providerDescriptor);
    if (!provider) {
      provider = this.instantiationService.createInstance(providerDescriptor.ctor);
      this.mapProviderToDescriptor.set(providerDescriptor, provider);
    }
    return [provider, providerDescriptor];
  }
  dispose() {
    this._providerCts?.cancel();
    for (const provider of this.mapProviderToDescriptor.values()) {
      if (isDisposable(provider)) {
        provider.dispose();
      }
    }
    super.dispose();
  }
};
UnifiedQuickAccess = __decorateClass([
  __decorateParam(1, IQuickInputService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, ILayoutService),
  __decorateParam(5, ICommandService),
  __decorateParam(6, IKeybindingService),
  __decorateParam(7, IHoverService)
], UnifiedQuickAccess);
export {
  DEFAULT_UNIFIED_QUICK_ACCESS_TABS,
  UnifiedQuickAccess
};
