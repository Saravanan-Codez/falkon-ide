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
import { Disposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../base/common/network.js";
import { IClipboardService } from "../../../../../platform/clipboard/common/clipboardService.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ITerminalConfigurationService } from "../../../terminal/browser/terminal.js";
import { registerTerminalContribution } from "../../../terminal/browser/terminalExtensions.js";
import { shouldPasteTerminalText } from "./terminalClipboard.js";
import { Emitter } from "../../../../../base/common/event.js";
import { BrowserFeatures } from "../../../../../base/browser/canIUse.js";
import { TerminalCapability } from "../../../../../platform/terminal/common/capabilities/capabilities.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { TerminalSettingId } from "../../../../../platform/terminal/common/terminal.js";
import { isLinux, isMacintosh } from "../../../../../base/common/platform.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { registerActiveInstanceAction, registerActiveXtermAction } from "../../../terminal/browser/terminalActions.js";
import { TerminalCommandId } from "../../../terminal/common/terminal.js";
import { localize2 } from "../../../../../nls.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { TerminalContextKeys } from "../../../terminal/common/terminalContextKey.js";
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { terminalStrings } from "../../../terminal/common/terminalStrings.js";
import { isString } from "../../../../../base/common/types.js";
let TerminalClipboardContribution = class extends Disposable {
  constructor(_ctx, _clipboardService, _configurationService, _instantiationService, _notificationService, _terminalConfigurationService) {
    super();
    this._ctx = _ctx;
    this._clipboardService = _clipboardService;
    this._configurationService = _configurationService;
    this._instantiationService = _instantiationService;
    this._notificationService = _notificationService;
    this._terminalConfigurationService = _terminalConfigurationService;
    this._overrideCopySelection = void 0;
    this._onWillPaste = this._register(new Emitter());
    this.onWillPaste = this._onWillPaste.event;
    this._onDidPaste = this._register(new Emitter());
    this.onDidPaste = this._onDidPaste.event;
  }
  static {
    this.ID = "terminal.clipboard";
  }
  static get(instance) {
    return instance.getContribution(TerminalClipboardContribution.ID);
  }
  xtermReady(xterm) {
    this._xterm = xterm;
    this._register(xterm.onDidRequestCopyAsHtml((e) => this.copySelection(true, e.command)));
    this._register(xterm.raw.onSelectionChange(async () => {
      if (this._configurationService.getValue(TerminalSettingId.CopyOnSelection)) {
        if (this._overrideCopySelection === false) {
          return;
        }
        if (this._ctx.instance.hasSelection()) {
          await this.copySelection();
        }
      }
    }));
  }
  async copySelection(asHtml, command) {
    this._xterm?.copySelection(asHtml, command);
  }
  /**
   * Focuses and pastes the contents of the clipboard into the terminal instance.
   */
  async paste() {
    let text = await this._clipboardService.readText();
    if (!text) {
      const [resource] = await this._clipboardService.readResources();
      if (resource?.scheme === Schemas.file) {
        text = resource.fsPath;
      }
    }
    await this._paste(text);
  }
  /**
   * Focuses and pastes the contents of the selection clipboard into the terminal instance.
   */
  async pasteSelection() {
    await this._paste(await this._clipboardService.readText("selection"));
  }
  async _paste(value) {
    if (!this._xterm) {
      return;
    }
    let currentText = value;
    const shouldPasteText = await this._instantiationService.invokeFunction(shouldPasteTerminalText, currentText, this._xterm?.raw.modes.bracketedPasteMode);
    if (!shouldPasteText) {
      return;
    }
    if (typeof shouldPasteText === "object") {
      currentText = shouldPasteText.modifiedText;
    }
    this._ctx.instance.focus();
    this._onWillPaste.fire(currentText);
    this._xterm.raw.paste(currentText);
    this._onDidPaste.fire(currentText);
  }
  async handleMouseEvent(event) {
    switch (event.button) {
      case 1: {
        if (this._terminalConfigurationService.config.middleClickBehavior === "paste") {
          this.paste();
          return { handled: true };
        }
        break;
      }
      case 2: {
        if (event.shiftKey) {
          return;
        }
        const rightClickBehavior = this._terminalConfigurationService.config.rightClickBehavior;
        if (rightClickBehavior !== "copyPaste" && rightClickBehavior !== "paste") {
          return;
        }
        if (rightClickBehavior === "copyPaste" && this._ctx.instance.hasSelection()) {
          await this.copySelection();
          this._ctx.instance.clearSelection();
        } else {
          if (BrowserFeatures.clipboard.readText) {
            this.paste();
          } else {
            this._notificationService.info(`This browser doesn't support the clipboard.readText API needed to trigger a paste, try ${isMacintosh ? "\u2318" : "Ctrl"}+V instead.`);
          }
        }
        if (isMacintosh) {
          setTimeout(() => this._ctx.instance.clearSelection(), 0);
        }
        return { handled: true };
      }
    }
  }
  /**
   * Override the copy on selection feature with a custom value.
   * @param value Whether to enable copySelection.
   */
  overrideCopyOnSelection(value) {
    if (this._overrideCopySelection !== void 0) {
      throw new Error("Cannot set a copy on selection override multiple times");
    }
    this._overrideCopySelection = value;
    return toDisposable(() => this._overrideCopySelection = void 0);
  }
};
TerminalClipboardContribution = __decorateClass([
  __decorateParam(1, IClipboardService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, INotificationService),
  __decorateParam(5, ITerminalConfigurationService)
], TerminalClipboardContribution);
registerTerminalContribution(TerminalClipboardContribution.ID, TerminalClipboardContribution, false);
const terminalAvailableWhenClause = ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated);
registerActiveInstanceAction({
  id: TerminalCommandId.CopyLastCommand,
  title: localize2("workbench.action.terminal.copyLastCommand", "Copy Last Command"),
  precondition: terminalAvailableWhenClause,
  run: async (instance, c, accessor) => {
    const clipboardService = accessor.get(IClipboardService);
    const commands = instance.capabilities.get(TerminalCapability.CommandDetection)?.commands;
    if (!commands || commands.length === 0) {
      return;
    }
    const command = commands[commands.length - 1];
    if (!command.command) {
      return;
    }
    await clipboardService.writeText(command.command);
  }
});
registerActiveInstanceAction({
  id: TerminalCommandId.CopyLastCommandOutput,
  title: localize2("workbench.action.terminal.copyLastCommandOutput", "Copy Last Command Output"),
  precondition: terminalAvailableWhenClause,
  run: async (instance, c, accessor) => {
    const clipboardService = accessor.get(IClipboardService);
    const commands = instance.capabilities.get(TerminalCapability.CommandDetection)?.commands;
    if (!commands || commands.length === 0) {
      return;
    }
    const command = commands[commands.length - 1];
    if (!command?.hasOutput()) {
      return;
    }
    const output = command.getOutput();
    if (isString(output)) {
      await clipboardService.writeText(output);
    }
  }
});
registerActiveInstanceAction({
  id: TerminalCommandId.CopyLastCommandAndLastCommandOutput,
  title: localize2("workbench.action.terminal.copyLastCommandAndOutput", "Copy Last Command and Output"),
  precondition: terminalAvailableWhenClause,
  run: async (instance, c, accessor) => {
    const clipboardService = accessor.get(IClipboardService);
    const commands = instance.capabilities.get(TerminalCapability.CommandDetection)?.commands;
    if (!commands || commands.length === 0) {
      return;
    }
    const command = commands[commands.length - 1];
    if (!command?.hasOutput()) {
      return;
    }
    const output = command.getOutput();
    if (isString(output)) {
      await clipboardService.writeText(`${command.command !== "" ? command.command + "\n" : ""}${output}`);
    }
  }
});
if (BrowserFeatures.clipboard.writeText) {
  registerActiveXtermAction({
    id: TerminalCommandId.CopySelection,
    title: localize2("workbench.action.terminal.copySelection", "Copy Selection"),
    // TODO: Why is copy still showing up when text isn't selected?
    precondition: ContextKeyExpr.or(TerminalContextKeys.textSelectedInFocused, ContextKeyExpr.and(terminalAvailableWhenClause, TerminalContextKeys.textSelected)),
    keybinding: [{
      primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyC,
      mac: { primary: KeyMod.CtrlCmd | KeyCode.KeyC },
      weight: KeybindingWeight.WorkbenchContrib,
      when: ContextKeyExpr.or(
        ContextKeyExpr.and(TerminalContextKeys.textSelected, TerminalContextKeys.focus),
        TerminalContextKeys.textSelectedInFocused
      )
    }],
    run: (activeInstance) => activeInstance.copySelection()
  });
  registerActiveXtermAction({
    id: TerminalCommandId.CopyAndClearSelection,
    title: localize2("workbench.action.terminal.copyAndClearSelection", "Copy and Clear Selection"),
    precondition: ContextKeyExpr.or(TerminalContextKeys.textSelectedInFocused, ContextKeyExpr.and(terminalAvailableWhenClause, TerminalContextKeys.textSelected)),
    keybinding: [{
      win: { primary: KeyMod.CtrlCmd | KeyCode.KeyC },
      weight: KeybindingWeight.WorkbenchContrib,
      when: ContextKeyExpr.or(
        ContextKeyExpr.and(TerminalContextKeys.textSelected, TerminalContextKeys.focus),
        TerminalContextKeys.textSelectedInFocused
      )
    }],
    run: async (xterm) => {
      await xterm.copySelection();
      xterm.clearSelection();
    }
  });
  registerActiveXtermAction({
    id: TerminalCommandId.CopySelectionAsHtml,
    title: localize2("workbench.action.terminal.copySelectionAsHtml", "Copy Selection as HTML"),
    f1: true,
    category: terminalStrings.actionCategory,
    precondition: ContextKeyExpr.or(TerminalContextKeys.textSelectedInFocused, ContextKeyExpr.and(terminalAvailableWhenClause, TerminalContextKeys.textSelected)),
    run: (xterm) => xterm.copySelection(true)
  });
}
if (BrowserFeatures.clipboard.readText) {
  registerActiveInstanceAction({
    id: TerminalCommandId.Paste,
    title: localize2("workbench.action.terminal.paste", "Paste into Active Terminal"),
    precondition: terminalAvailableWhenClause,
    keybinding: [{
      primary: KeyMod.CtrlCmd | KeyCode.KeyV,
      win: { primary: KeyMod.CtrlCmd | KeyCode.KeyV, secondary: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyV] },
      linux: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyV },
      weight: KeybindingWeight.WorkbenchContrib,
      when: TerminalContextKeys.focus
    }],
    run: (activeInstance) => TerminalClipboardContribution.get(activeInstance)?.paste()
  });
}
if (BrowserFeatures.clipboard.readText && isLinux) {
  registerActiveInstanceAction({
    id: TerminalCommandId.PasteSelection,
    title: localize2("workbench.action.terminal.pasteSelection", "Paste Selection into Active Terminal"),
    precondition: terminalAvailableWhenClause,
    keybinding: [{
      linux: { primary: KeyMod.Shift | KeyCode.Insert },
      weight: KeybindingWeight.WorkbenchContrib,
      when: TerminalContextKeys.focus
    }],
    run: (activeInstance) => TerminalClipboardContribution.get(activeInstance)?.pasteSelection()
  });
}
export {
  TerminalClipboardContribution
};
