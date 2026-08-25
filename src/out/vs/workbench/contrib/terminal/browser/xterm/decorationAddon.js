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
import { Separator } from "../../../../../base/common/actions.js";
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, DisposableMap, DisposableStore, dispose, toDisposable } from "../../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { localize } from "../../../../../nls.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { IClipboardService } from "../../../../../platform/clipboard/common/clipboardService.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { INotificationService, Severity } from "../../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { CommandInvalidationReason, TerminalCapability } from "../../../../../platform/terminal/common/capabilities/capabilities.js";
import { TerminalSettingId } from "../../../../../platform/terminal/common/terminal.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { terminalDecorationMark } from "../terminalIcons.js";
import { DecorationSelector, getTerminalCommandDecorationState, getTerminalDecorationHoverContent, updateLayout } from "./decorationStyles.js";
import { TERMINAL_COMMAND_DECORATION_DEFAULT_BACKGROUND_COLOR, TERMINAL_COMMAND_DECORATION_ERROR_BACKGROUND_COLOR, TERMINAL_COMMAND_DECORATION_SUCCESS_BACKGROUND_COLOR } from "../../common/terminalColorRegistry.js";
import { ILifecycleService } from "../../../../services/lifecycle/common/lifecycle.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { IChatContextPickService } from "../../../chat/browser/attachments/chatContextPickService.js";
import { IChatWidgetService } from "../../../chat/browser/chat.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { TerminalContext } from "../../../chat/browser/actions/chatContext.js";
import { getTerminalUri, parseTerminalUri } from "../terminalUri.js";
import { ChatAgentLocation } from "../../../chat/common/constants.js";
import { isString } from "../../../../../base/common/types.js";
let DecorationAddon = class extends Disposable {
  constructor(_resource, _capabilities, _clipboardService, _contextMenuService, _configurationService, _themeService, _openerService, _quickInputService, lifecycleService, _commandService, _accessibilitySignalService, _notificationService, _hoverService, _contextPickService, _chatWidgetService, _instantiationService) {
    super();
    this._resource = _resource;
    this._capabilities = _capabilities;
    this._clipboardService = _clipboardService;
    this._contextMenuService = _contextMenuService;
    this._configurationService = _configurationService;
    this._themeService = _themeService;
    this._openerService = _openerService;
    this._quickInputService = _quickInputService;
    this._commandService = _commandService;
    this._accessibilitySignalService = _accessibilitySignalService;
    this._notificationService = _notificationService;
    this._hoverService = _hoverService;
    this._contextPickService = _contextPickService;
    this._chatWidgetService = _chatWidgetService;
    this._instantiationService = _instantiationService;
    this._capabilityDisposables = this._register(new DisposableMap());
    this._decorations = /* @__PURE__ */ new Map();
    this._registeredMenuItems = /* @__PURE__ */ new Map();
    this._onDidRequestRunCommand = this._register(new Emitter());
    this.onDidRequestRunCommand = this._onDidRequestRunCommand.event;
    this._onDidRequestCopyAsHtml = this._register(new Emitter());
    this.onDidRequestCopyAsHtml = this._onDidRequestCopyAsHtml.event;
    this._register(toDisposable(() => this._dispose()));
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(TerminalSettingId.FontSize) || e.affectsConfiguration(TerminalSettingId.LineHeight)) {
        this.refreshLayouts();
      } else if (e.affectsConfiguration("workbench.colorCustomizations")) {
        this._refreshStyles(true);
      } else if (e.affectsConfiguration(TerminalSettingId.ShellIntegrationDecorationsEnabled)) {
        this._removeCapabilityDisposables(TerminalCapability.CommandDetection);
        this._updateDecorationVisibility();
      }
    }));
    this._register(this._themeService.onDidColorThemeChange(() => this._refreshStyles(true)));
    this._updateDecorationVisibility();
    this._register(this._capabilities.onDidAddCapability((c) => this._createCapabilityDisposables(c.id)));
    this._register(this._capabilities.onDidRemoveCapability((c) => this._removeCapabilityDisposables(c.id)));
    this._register(lifecycleService.onWillShutdown(() => this._disposeAllDecorations()));
  }
  _createCapabilityDisposables(c) {
    const capability = this._capabilities.get(c);
    if (!capability || this._capabilityDisposables.has(c)) {
      return;
    }
    const store = new DisposableStore();
    switch (capability.type) {
      case TerminalCapability.BufferMarkDetection:
        store.add(capability.onMarkAdded((mark) => this.registerMarkDecoration(mark)));
        break;
      case TerminalCapability.CommandDetection: {
        const disposables = this._getCommandDetectionListeners(capability);
        for (const d of disposables) {
          store.add(d);
        }
        break;
      }
    }
    this._capabilityDisposables.set(c, store);
  }
  _removeCapabilityDisposables(c) {
    this._capabilityDisposables.deleteAndDispose(c);
  }
  registerMarkDecoration(mark) {
    if (!this._terminal || !this._showGutterDecorations && !this._showOverviewRulerDecorations) {
      return void 0;
    }
    if (mark.hidden) {
      return void 0;
    }
    return this.registerCommandDecoration(void 0, void 0, mark);
  }
  _updateDecorationVisibility() {
    const showDecorations = this._configurationService.getValue(TerminalSettingId.ShellIntegrationDecorationsEnabled);
    this._showGutterDecorations = showDecorations === "both" || showDecorations === "gutter";
    this._showOverviewRulerDecorations = showDecorations === "both" || showDecorations === "overviewRuler";
    this._disposeAllDecorations();
    if (this._showGutterDecorations || this._showOverviewRulerDecorations) {
      this._attachToCommandCapability();
      this._updateGutterDecorationVisibility();
    }
    const currentCommand = this._capabilities.get(TerminalCapability.CommandDetection)?.executingCommandObject;
    if (currentCommand) {
      this.registerCommandDecoration(currentCommand, true);
    }
  }
  _disposeAllDecorations() {
    this._placeholderDecoration?.dispose();
    for (const value of this._decorations.values()) {
      value.decoration.dispose();
      dispose(value.disposables);
    }
  }
  _updateGutterDecorationVisibility() {
    const commandDecorationElements = this._terminal?.element?.querySelectorAll(DecorationSelector.CommandDecoration);
    if (commandDecorationElements) {
      for (const commandDecorationElement of commandDecorationElements) {
        this._updateCommandDecorationVisibility(commandDecorationElement);
      }
    }
  }
  _updateCommandDecorationVisibility(commandDecorationElement) {
    if (this._showGutterDecorations) {
      commandDecorationElement.classList.remove(DecorationSelector.Hide);
    } else {
      commandDecorationElement.classList.add(DecorationSelector.Hide);
    }
  }
  refreshLayouts() {
    updateLayout(this._configurationService, this._placeholderDecoration?.element);
    for (const decoration of this._decorations) {
      updateLayout(this._configurationService, decoration[1].decoration.element);
    }
  }
  _refreshStyles(refreshOverviewRulerColors) {
    if (refreshOverviewRulerColors) {
      for (const decoration of this._decorations.values()) {
        const color = this._getDecorationCssColor(decoration.command)?.toString() ?? "";
        if (decoration.decoration.options?.overviewRulerOptions) {
          decoration.decoration.options.overviewRulerOptions.color = color;
        } else if (decoration.decoration.options) {
          decoration.decoration.options.overviewRulerOptions = { color };
        }
      }
    }
    this._updateClasses(this._placeholderDecoration?.element);
    for (const decoration of this._decorations.values()) {
      this._updateClasses(decoration.decoration.element, decoration.command, decoration.markProperties);
    }
  }
  _dispose() {
    for (const disposable of this._capabilityDisposables.values()) {
      dispose(disposable);
    }
    this.clearDecorations();
  }
  _clearPlaceholder() {
    this._placeholderDecoration?.dispose();
    this._placeholderDecoration = void 0;
  }
  clearDecorations() {
    this._placeholderDecoration?.marker.dispose();
    this._clearPlaceholder();
    this._disposeAllDecorations();
    this._decorations.clear();
  }
  _attachToCommandCapability() {
    if (this._capabilities.has(TerminalCapability.CommandDetection)) {
      const capability = this._capabilities.get(TerminalCapability.CommandDetection);
      const disposables = this._getCommandDetectionListeners(capability);
      const store = new DisposableStore();
      for (const d of disposables) {
        store.add(d);
      }
      this._capabilityDisposables.set(TerminalCapability.CommandDetection, store);
    }
  }
  _getCommandDetectionListeners(capability) {
    this._removeCapabilityDisposables(TerminalCapability.CommandDetection);
    const commandDetectionListeners = [];
    if (capability.executingCommandObject?.marker) {
      this.registerCommandDecoration(capability.executingCommandObject, true);
    }
    commandDetectionListeners.push(capability.onCommandStarted((command) => this.registerCommandDecoration(command, true)));
    for (const command of capability.commands) {
      this.registerCommandDecoration(command);
    }
    commandDetectionListeners.push(capability.onCommandFinished((command) => {
      const buffer = this._terminal?.buffer?.active;
      const marker = command.promptStartMarker;
      const shouldRegisterDecoration = command.exitCode === void 0 || // Only register decoration if the cursor is at or below the promptStart marker.
      buffer && marker && buffer.baseY + buffer.cursorY >= marker.line;
      if (shouldRegisterDecoration) {
        this.registerCommandDecoration(command);
      }
      if (command.exitCode) {
        this._accessibilitySignalService.playSignal(AccessibilitySignal.terminalCommandFailed);
      } else {
        this._accessibilitySignalService.playSignal(AccessibilitySignal.terminalCommandSucceeded);
      }
    }));
    commandDetectionListeners.push(capability.onCommandInvalidated((commands) => {
      for (const command of commands) {
        const id = command.marker?.id;
        if (id) {
          const match = this._decorations.get(id);
          if (match) {
            match.decoration.dispose();
            dispose(match.disposables);
          }
        }
      }
    }));
    commandDetectionListeners.push(capability.onCurrentCommandInvalidated((request) => {
      if (request.reason === CommandInvalidationReason.NoProblemsReported) {
        const lastDecoration = Array.from(this._decorations.entries())[this._decorations.size - 1];
        lastDecoration?.[1].decoration.dispose();
      } else if (request.reason === CommandInvalidationReason.Windows) {
        this._clearPlaceholder();
      }
    }));
    return commandDetectionListeners;
  }
  activate(terminal) {
    this._terminal = terminal;
    this._attachToCommandCapability();
  }
  registerCommandDecoration(command, beforeCommandExecution, markProperties) {
    if (!this._terminal || beforeCommandExecution && !command || !this._showGutterDecorations && !this._showOverviewRulerDecorations) {
      return void 0;
    }
    const marker = command?.marker || markProperties?.marker;
    if (!marker) {
      throw new Error(`cannot add a decoration for a command ${JSON.stringify(command)} with no marker`);
    }
    this._clearPlaceholder();
    const color = this._getDecorationCssColor(command)?.toString() ?? "";
    const decoration = this._terminal.registerDecoration({
      marker,
      overviewRulerOptions: this._showOverviewRulerDecorations ? beforeCommandExecution ? { color, position: "left" } : { color, position: command?.exitCode ? "right" : "left" } : void 0
    });
    if (!decoration) {
      return void 0;
    }
    if (beforeCommandExecution) {
      this._placeholderDecoration = decoration;
    }
    decoration.onRender((element) => {
      if (element.classList.contains(DecorationSelector.OverviewRuler)) {
        return;
      }
      if (!this._decorations.get(decoration.marker.id)) {
        decoration.onDispose(() => {
          const disposableDecoration = this._decorations.get(decoration.marker.id);
          if (disposableDecoration) {
            dispose(disposableDecoration.disposables);
            this._decorations.delete(decoration.marker.id);
          }
        });
        this._decorations.set(
          decoration.marker.id,
          {
            decoration,
            disposables: this._createDisposables(element, command, markProperties),
            command,
            markProperties: command?.markProperties || markProperties
          }
        );
      }
      if (!element.classList.contains(DecorationSelector.Codicon) || command?.marker?.line === 0) {
        updateLayout(this._configurationService, element);
        this._updateClasses(element, command, command?.markProperties || markProperties);
      }
    });
    return decoration;
  }
  registerMenuItems(command, items) {
    const existingItems = this._registeredMenuItems.get(command);
    if (existingItems) {
      existingItems.push(...items);
    } else {
      this._registeredMenuItems.set(command, [...items]);
    }
    return toDisposable(() => {
      const commandItems = this._registeredMenuItems.get(command);
      if (commandItems) {
        for (const item of items.values()) {
          const index = commandItems.indexOf(item);
          if (index !== -1) {
            commandItems.splice(index, 1);
          }
        }
      }
    });
  }
  _createDisposables(element, command, markProperties) {
    if (command?.exitCode === void 0 && !command?.markProperties) {
      return [];
    } else if (command?.markProperties || markProperties) {
      return [this._createHover(element, command || markProperties, markProperties?.hoverMessage)];
    }
    return [...this._createContextMenu(element, command), this._createHover(element, command)];
  }
  _createHover(element, command, hoverMessage) {
    return this._hoverService.setupDelayedHover(element, () => ({
      content: new MarkdownString(getTerminalDecorationHoverContent(command, hoverMessage, true))
    }));
  }
  _updateClasses(element, command, markProperties) {
    if (!element) {
      return;
    }
    for (const classes of element.classList) {
      element.classList.remove(classes);
    }
    element.classList.add(DecorationSelector.CommandDecoration, DecorationSelector.Codicon, DecorationSelector.XtermDecoration);
    if (markProperties) {
      element.classList.add(DecorationSelector.DefaultColor, ...ThemeIcon.asClassNameArray(terminalDecorationMark));
      if (!markProperties.hoverMessage) {
        element.classList.add(DecorationSelector.Default);
      }
    } else {
      const state = getTerminalCommandDecorationState(command);
      this._updateCommandDecorationVisibility(element);
      for (const className of state.classNames) {
        element.classList.add(className);
      }
      element.classList.add(...ThemeIcon.asClassNameArray(state.icon));
    }
    element.removeAttribute("title");
    element.removeAttribute("aria-label");
  }
  _createContextMenu(element, command) {
    return [
      dom.addDisposableListener(element, dom.EventType.MOUSE_DOWN, async (e) => {
        e.stopImmediatePropagation();
      }),
      dom.addDisposableListener(element, dom.EventType.CLICK, async (e) => {
        e.stopImmediatePropagation();
        const actions = await this._getCommandActions(command);
        this._contextMenuService.showContextMenu({ getAnchor: () => element, getActions: () => actions });
      }),
      dom.addDisposableListener(element, dom.EventType.CONTEXT_MENU, async (e) => {
        e.stopImmediatePropagation();
        const chatActions = await this._getCommandActions(command);
        const actions = this._getContextMenuActions();
        this._contextMenuService.showContextMenu({ getAnchor: () => element, getActions: () => [...actions, ...chatActions] });
      })
    ];
  }
  _getContextMenuActions() {
    const label = localize("workbench.action.terminal.toggleVisibility", "Toggle Visibility");
    return [
      {
        class: void 0,
        tooltip: label,
        id: "terminal.toggleVisibility",
        label,
        enabled: true,
        run: async () => {
          this._showToggleVisibilityQuickPick();
        }
      }
    ];
  }
  async _getCommandActions(command) {
    const actions = [];
    const registeredMenuItems = this._registeredMenuItems.get(command);
    if (registeredMenuItems?.length) {
      actions.push(...registeredMenuItems, new Separator());
    }
    const attachToChatAction = this._createAttachToChatAction(command);
    if (attachToChatAction) {
      actions.push(attachToChatAction, new Separator());
    }
    if (command.command !== "") {
      const labelRun = localize("terminal.rerunCommand", "Rerun Command");
      actions.push({
        class: void 0,
        tooltip: labelRun,
        id: "terminal.rerunCommand",
        label: labelRun,
        enabled: true,
        run: async () => {
          if (command.command === "") {
            return;
          }
          if (!command.isTrusted) {
            const shouldRun = await new Promise((r) => {
              this._notificationService.prompt(Severity.Info, localize("rerun", "Do you want to run the command: {0}", command.command), [{
                label: localize("yes", "Yes"),
                run: () => r(true)
              }, {
                label: localize("no", "No"),
                run: () => r(false)
              }]);
            });
            if (!shouldRun) {
              return;
            }
          }
          this._onDidRequestRunCommand.fire({ command });
        }
      });
      actions.push(new Separator());
      const labelCopy = localize("terminal.copyCommand", "Copy Command");
      actions.push({
        class: void 0,
        tooltip: labelCopy,
        id: "terminal.copyCommand",
        label: labelCopy,
        enabled: true,
        run: () => this._clipboardService.writeText(command.command)
      });
    }
    if (command.hasOutput()) {
      const labelCopyCommandAndOutput = localize("terminal.copyCommandAndOutput", "Copy Command and Output");
      actions.push({
        class: void 0,
        tooltip: labelCopyCommandAndOutput,
        id: "terminal.copyCommandAndOutput",
        label: labelCopyCommandAndOutput,
        enabled: true,
        run: () => {
          const output = command.getOutput();
          if (isString(output)) {
            this._clipboardService.writeText(`${command.command !== "" ? command.command + "\n" : ""}${output}`);
          }
        }
      });
      const labelText = localize("terminal.copyOutput", "Copy Output");
      actions.push({
        class: void 0,
        tooltip: labelText,
        id: "terminal.copyOutput",
        label: labelText,
        enabled: true,
        run: () => {
          const text = command.getOutput();
          if (isString(text)) {
            this._clipboardService.writeText(text);
          }
        }
      });
      const labelHtml = localize("terminal.copyOutputAsHtml", "Copy Output as HTML");
      actions.push({
        class: void 0,
        tooltip: labelHtml,
        id: "terminal.copyOutputAsHtml",
        label: labelHtml,
        enabled: true,
        run: () => this._onDidRequestCopyAsHtml.fire({ command })
      });
    }
    if (actions.length > 0) {
      actions.push(new Separator());
    }
    const labelRunRecent = localize("workbench.action.terminal.runRecentCommand", "Run Recent Command");
    actions.push({
      class: void 0,
      tooltip: labelRunRecent,
      id: "workbench.action.terminal.runRecentCommand",
      label: labelRunRecent,
      enabled: true,
      run: () => this._commandService.executeCommand("workbench.action.terminal.runRecentCommand")
    });
    const labelGoToRecent = localize("workbench.action.terminal.goToRecentDirectory", "Go To Recent Directory");
    actions.push({
      class: void 0,
      tooltip: labelRunRecent,
      id: "workbench.action.terminal.goToRecentDirectory",
      label: labelGoToRecent,
      enabled: true,
      run: () => this._commandService.executeCommand("workbench.action.terminal.goToRecentDirectory")
    });
    actions.push(new Separator());
    const labelAbout = localize("terminal.learnShellIntegration", "Learn About Shell Integration");
    actions.push({
      class: void 0,
      tooltip: labelAbout,
      id: "terminal.learnShellIntegration",
      label: labelAbout,
      enabled: true,
      run: () => this._openerService.open("https://code.visualstudio.com/docs/terminal/shell-integration")
    });
    return actions;
  }
  _createAttachToChatAction(command) {
    const chatIsEnabled = this._chatWidgetService.getWidgetsByLocations(ChatAgentLocation.Chat).some((w) => w.attachmentCapabilities.supportsTerminalAttachments);
    if (!chatIsEnabled) {
      return void 0;
    }
    const labelAttachToChat = localize("terminal.attachToChat", "Attach To Chat");
    return {
      class: void 0,
      tooltip: labelAttachToChat,
      id: "terminal.attachToChat",
      label: labelAttachToChat,
      enabled: true,
      run: async () => {
        let widget = this._chatWidgetService.lastFocusedWidget ?? this._chatWidgetService.getWidgetsByLocations(ChatAgentLocation.Chat)?.find((w) => w.attachmentCapabilities.supportsTerminalAttachments);
        if (!widget) {
          widget = await this._chatWidgetService.revealWidget();
        }
        if (!widget) {
          return;
        }
        let terminalContext;
        if (this._resource) {
          const parsedUri = parseTerminalUri(this._resource);
          terminalContext = this._instantiationService.createInstance(TerminalContext, getTerminalUri(parsedUri.workspaceId, parsedUri.instanceId, void 0, command.id));
        }
        if (terminalContext && widget.attachmentCapabilities.supportsTerminalAttachments) {
          try {
            const attachment = await terminalContext.asAttachment(widget);
            if (attachment) {
              widget.attachmentModel.addContext(attachment);
              widget.focusInput();
              return;
            }
          } catch (err) {
          }
          this._store.add(this._contextPickService.registerChatContextItem(terminalContext));
        }
      }
    };
  }
  _showToggleVisibilityQuickPick() {
    const quickPick = this._register(this._quickInputService.createQuickPick());
    quickPick.hideInput = true;
    quickPick.hideCheckAll = true;
    quickPick.canSelectMany = true;
    quickPick.title = localize("toggleVisibility", "Toggle visibility");
    const configValue = this._configurationService.getValue(TerminalSettingId.ShellIntegrationDecorationsEnabled);
    const gutterIcon = {
      label: localize("gutter", "Gutter command decorations"),
      picked: configValue !== "never" && configValue !== "overviewRuler"
    };
    const overviewRulerIcon = {
      label: localize("overviewRuler", "Overview ruler command decorations"),
      picked: configValue !== "never" && configValue !== "gutter"
    };
    quickPick.items = [gutterIcon, overviewRulerIcon];
    const selectedItems = [];
    if (configValue !== "never") {
      if (configValue !== "gutter") {
        selectedItems.push(gutterIcon);
      }
      if (configValue !== "overviewRuler") {
        selectedItems.push(overviewRulerIcon);
      }
    }
    quickPick.selectedItems = selectedItems;
    this._register(quickPick.onDidChangeSelection(async (e) => {
      let newValue = "never";
      if (e.includes(gutterIcon)) {
        if (e.includes(overviewRulerIcon)) {
          newValue = "both";
        } else {
          newValue = "gutter";
        }
      } else if (e.includes(overviewRulerIcon)) {
        newValue = "overviewRuler";
      }
      await this._configurationService.updateValue(TerminalSettingId.ShellIntegrationDecorationsEnabled, newValue);
    }));
    quickPick.ok = false;
    quickPick.show();
  }
  _getDecorationCssColor(command) {
    let colorId;
    if (command?.exitCode === void 0) {
      colorId = TERMINAL_COMMAND_DECORATION_DEFAULT_BACKGROUND_COLOR;
    } else {
      colorId = command.exitCode ? TERMINAL_COMMAND_DECORATION_ERROR_BACKGROUND_COLOR : TERMINAL_COMMAND_DECORATION_SUCCESS_BACKGROUND_COLOR;
    }
    return this._themeService.getColorTheme().getColor(colorId)?.toString();
  }
};
DecorationAddon = __decorateClass([
  __decorateParam(2, IClipboardService),
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IThemeService),
  __decorateParam(6, IOpenerService),
  __decorateParam(7, IQuickInputService),
  __decorateParam(8, ILifecycleService),
  __decorateParam(9, ICommandService),
  __decorateParam(10, IAccessibilitySignalService),
  __decorateParam(11, INotificationService),
  __decorateParam(12, IHoverService),
  __decorateParam(13, IChatContextPickService),
  __decorateParam(14, IChatWidgetService),
  __decorateParam(15, IInstantiationService)
], DecorationAddon);
export {
  DecorationAddon
};
