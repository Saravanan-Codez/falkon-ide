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
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { AccessibleViewProviderId, AccessibleViewType } from "../../../../../platform/accessibility/browser/accessibleView.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { TerminalCapability } from "../../../../../platform/terminal/common/capabilities/capabilities.js";
import { isFullTerminalCommand } from "../../../../../platform/terminal/common/capabilities/commandDetection/terminalCommand.js";
import { AccessibilityVerbositySettingId } from "../../../accessibility/browser/accessibilityConfiguration.js";
import { ITerminalService } from "../../../terminal/browser/terminal.js";
import { TerminalAccessibilitySettingId, TerminalAccessibleViewPreserveCursorPosition } from "../common/terminalAccessibilityConfiguration.js";
let TerminalAccessibleBufferProvider = class extends Disposable {
  constructor(_instance, _bufferTracker, customHelp, configurationService, terminalService) {
    super();
    this._instance = _instance;
    this._bufferTracker = _bufferTracker;
    this.id = AccessibleViewProviderId.Terminal;
    this.options = { type: AccessibleViewType.View, language: "terminal", id: AccessibleViewProviderId.Terminal };
    this.verbositySettingKey = AccessibilityVerbositySettingId.Terminal;
    this._onDidRequestClearProvider = this._register(new Emitter());
    this.onDidRequestClearLastProvider = this._onDidRequestClearProvider.event;
    this._onDidChangeContent = this._register(new Emitter());
    this.onDidChangeContent = this._onDidChangeContent.event;
    this.options.customHelp = customHelp;
    this._updatePosition(configurationService);
    this._register(this._instance.onDisposed(() => this._onDidRequestClearProvider.fire(AccessibleViewProviderId.Terminal)));
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(TerminalAccessibilitySettingId.AccessibleViewPreserveCursorPosition)) {
        this._updatePosition(configurationService);
      }
    }));
    this._focusedInstance = terminalService.activeInstance;
    this._register(terminalService.onDidChangeActiveInstance(() => {
      if (terminalService.activeInstance && this._focusedInstance?.instanceId !== terminalService.activeInstance?.instanceId) {
        this._onDidRequestClearProvider.fire(AccessibleViewProviderId.Terminal);
        this._focusedInstance = terminalService.activeInstance;
      }
    }));
  }
  _updatePosition(configurationService) {
    const preserveCursorPosition = configurationService.getValue(TerminalAccessibilitySettingId.AccessibleViewPreserveCursorPosition);
    this.options.position = preserveCursorPosition === TerminalAccessibleViewPreserveCursorPosition.Always ? "initial-bottom-preserve" : preserveCursorPosition ? "initial-bottom" : "bottom";
  }
  refresh() {
    this._onDidChangeContent.fire();
  }
  onClose() {
    this._instance.focus();
  }
  provideContent() {
    this._bufferTracker.update();
    return this._bufferTracker.lines.join("\n");
  }
  getSymbols() {
    const commands = this._getCommandsWithEditorLine() ?? [];
    const symbols = [];
    for (const command of commands) {
      const label = command.command.command;
      if (label) {
        symbols.push({
          label,
          lineNumber: command.lineNumber
        });
      }
    }
    return symbols;
  }
  _getCommandsWithEditorLine() {
    const capability = this._instance.capabilities.get(TerminalCapability.CommandDetection);
    const commands = capability?.commands;
    const currentCommand = capability?.currentCommand;
    if (!commands?.length) {
      return;
    }
    const result = [];
    for (const command of commands) {
      const lineNumber = this._getEditorLineForCommand(command);
      if (lineNumber === void 0) {
        continue;
      }
      result.push({ command, lineNumber, exitCode: command.exitCode });
    }
    if (currentCommand) {
      const lineNumber = this._getEditorLineForCommand(currentCommand);
      if (lineNumber !== void 0) {
        result.push({ command: currentCommand, lineNumber });
      }
    }
    return result;
  }
  _getEditorLineForCommand(command) {
    let line;
    if (isFullTerminalCommand(command)) {
      line = command.marker?.line;
    } else {
      line = command.commandStartMarker?.line;
    }
    if (line === void 0 || line < 0) {
      return;
    }
    line = this._bufferTracker.bufferToEditorLineMapping.get(line);
    if (line === void 0) {
      return;
    }
    return line + 1;
  }
};
TerminalAccessibleBufferProvider = __decorateClass([
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, ITerminalService)
], TerminalAccessibleBufferProvider);
export {
  TerminalAccessibleBufferProvider
};
